/* Kitchen Ledger — shared household sync through Firebase (Firestore REST API, anonymous sign-in).
   Every item, shopping entry and remembered barcode is its own document, so two people can
   change different things at the same time without overwriting each other.
   Local changes are found by comparing with the last synced version (no bookkeeping in the UI code). */
(function () {
  const CFG = window.KL_FIREBASE || {};
  const enabled = !!(CFG.apiKey && CFG.projectId);
  const COLS = ["items", "shopping", "barcodes"];
  const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const DB = () => `projects/${CFG.projectId}/databases/(default)/documents`;
  const API = () => `https://firestore.googleapis.com/v1/${DB()}`;

  let app = null;          // { getS, save, render, toast }
  let busy = false, again = false, timer = null, poll = null;
  let status = { state: "idle", error: "" };

  /* ---------- helpers ---------- */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  function hash(str) { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + ":" + str.length; }
  function device() { let d = lsGet("kl-dev"); if (!d) { d = Math.random().toString(36).slice(2, 10); lsSet("kl-dev", d); } return d; }
  function newCode() { const a = new Uint32Array(12); crypto.getRandomValues(a); return [...a].map(x => ALPHA[x % ALPHA.length]).join(""); }
  function fmtCode(c) { return (c || "").replace(/(.{4})(?=.)/g, "$1-"); }
  function cleanCode(c) { return String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/O/g, "0").replace(/I/g, "1"); }
  function entries(S, col) {
    if (col === "barcodes") return Object.entries(S.barcodes || {}).map(([k, v]) => [k, v]);
    return (S[col] || []).map(x => [x.id, x]);
  }
  function stripLocal(col, v) { if (col !== "items") return v; const o = { ...v }; delete o.picChecked; delete o.offChecked; return o; }
  function contentHash(col, v) { const o = { ...stripLocal(col, v) }; delete o._mod; return hash(JSON.stringify(o)); }
  /* Stamp the time of every local edit, so the newer edit wins when two phones change the same thing */
  let seen = null;
  function stamp() {
    if (!app) return;
    const S = app.getS(), now = Date.now(), first = !seen;
    seen = seen || {};
    for (const col of COLS) {
      const m = seen[col] = seen[col] || {};
      for (const [id, v] of entries(S, col)) {
        if (!v || typeof v !== "object") continue;
        const h = contentHash(col, v);
        if (m[id] !== h) { if (!first || !v._mod) v._mod = first ? (v._mod || 0) : now; m[id] = h; }
      }
    }
  }
  function markSeen(col, id, v) { if (seen) { seen[col] = seen[col] || {}; seen[col][id] = contentHash(col, v); } }

  /* ---------- sign-in ---------- */
  async function token() {
    let t = null; try { t = JSON.parse(lsGet("kl-auth") || "null"); } catch (e) { }
    if (t && t.idToken && t.exp > Date.now() + 60000) return t.idToken;
    let r;
    if (t && t.refreshToken) {
      r = await fetch(`https://securetoken.googleapis.com/v1/token?key=${CFG.apiKey}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(t.refreshToken) });
      if (r.ok) { const j = await r.json(); t = { idToken: j.id_token, refreshToken: j.refresh_token, exp: Date.now() + (+j.expires_in) * 1000 }; lsSet("kl-auth", JSON.stringify(t)); return t.idToken; }
    }
    r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${CFG.apiKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }) });
    if (!r.ok) throw new Error("auth " + r.status + " " + (await r.text()).slice(0, 200));
    const j = await r.json();
    t = { idToken: j.idToken, refreshToken: j.refreshToken, exp: Date.now() + (+j.expiresIn) * 1000 };
    lsSet("kl-auth", JSON.stringify(t));
    return t.idToken;
  }
  async function call(url, body, method) {
    const tk = await token();
    const r = await fetch(url, { method: method || (body ? "POST" : "GET"), headers: { "Authorization": "Bearer " + tk, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 404) return null;
    if (!r.ok) { const txt = await r.text(); const e = new Error("http " + r.status + " " + txt.slice(0, 300)); e.status = r.status; throw e; }
    return r.json();
  }

  /* ---------- household ---------- */
  async function create() {
    const hid = newCode();
    await call(`${API()}/households/${hid}?currentDocument.exists=false`, { fields: { created: { integerValue: String(Date.now()) }, by: { stringValue: device() } } }, "PATCH");
    const S = app.getS();
    S.sync = { hid, base: {}, lastSrv: "", lastOk: 0 };
    app.save();
    await syncNow(true);
    return hid;
  }
  async function join(code, mode) {
    const hid = cleanCode(code);
    if (hid.length < 8) throw Object.assign(new Error("bad"), { user: "That code is too short. Check it and try again." });
    const doc = await call(`${API()}/households/${hid}`);
    if (!doc) throw Object.assign(new Error("missing"), { user: "No household with this code. Check it and try again." });
    const S = app.getS();
    if (mode === "replace") { S.items = []; S.shopping = []; S.barcodes = {}; }
    // Base empty: every local entry counts as new and is added to the household
    S.sync = { hid, base: {}, lastSrv: "", lastOk: 0, joining: true };
    app.save();
    await syncNow(true);
    return hid;
  }
  function leave() {
    const S = app.getS(); delete S.sync; app.save(); status = { state: "idle", error: "" };
  }

  /* ---------- sync ---------- */
  function schedule(ms) { if (!enabled || !app || !app.getS().sync) return; stamp(); clearTimeout(timer); timer = setTimeout(() => syncNow(), ms == null ? 1500 : ms); }
  async function syncNow(force) {
    if (!enabled || !app) return;
    const S0 = app.getS(); if (!S0.sync || !S0.sync.hid) return;
    stamp();
    if (busy) { again = true; return; }
    if (navigator.onLine === false) { status = { state: "offline", error: "" }; return; }
    busy = true; status = { state: "syncing", error: "" };
    try {
      await pull();
      await push();
      const S = app.getS(); S.sync.lastOk = Date.now(); delete S.sync.joining;
      status = { state: "ok", error: "" };
      app.save();
    } catch (e) {
      status = { state: "error", error: String(e && e.message || e) };
      if (e && e.status === 403) status.error = "permission";
    } finally {
      busy = false;
      if (app.onStatus) app.onStatus(status);
      if (again) { again = false; schedule(300); }
    }
  }
  async function pull() {
    const S = app.getS(), sy = S.sync, hid = sy.hid;
    let changed = false, maxSrv = sy.lastSrv || "";
    for (const col of COLS) {
      const q = { structuredQuery: { from: [{ collectionId: col }] } };
      if (sy.lastSrv) q.structuredQuery.where = { fieldFilter: { field: { fieldPath: "srv" }, op: "GREATER_THAN", value: { timestampValue: sy.lastSrv } } };
      const res = await call(`${API()}/households/${hid}:runQuery`, q) || [];
      sy.base[col] = sy.base[col] || {};
      for (const row of res) {
        const d = row.document; if (!d) continue;
        const id = decodeURIComponent(d.name.split("/").pop());
        const f = d.fields || {};
        const srv = f.srv && f.srv.timestampValue || "";
        if (srv && (!maxSrv || Date.parse(srv) > Date.parse(maxSrv) || (Date.parse(srv) === Date.parse(maxSrv) && srv > maxSrv))) maxSrv = srv;
        const del = !!(f.del && f.del.booleanValue);
        const rmod = +(f.mod && f.mod.integerValue || 0);
        const rjson = f.data && f.data.stringValue || "null";
        const local = findLocal(S, col, id);
        const lh = local ? hash(JSON.stringify(stripLocal(col, local))) : null;
        const baseH = sy.base[col][id];
        const localChanged = lh !== (baseH || null) && !(local == null && baseH === undefined);
        const lmod = local && local._mod || 0;
        if (localChanged && !sy.joining && lmod > rmod) continue; // our newer edit wins, push sends it
        if (del) {
          if (local) { removeLocal(S, col, id); if (seen && seen[col]) delete seen[col][id]; changed = true; }
          delete sy.base[col][id];
        } else {
          let v; try { v = JSON.parse(rjson); } catch (e) { continue; }
          if (!v) continue;
          if (local && col === "items") { if (local.picChecked) v.picChecked = local.picChecked; if (local.offChecked) v.offChecked = local.offChecked; }
          if (sy.joining && local && localChanged) { continue; } // when joining, keep local copy and push it
          if (!local || hash(JSON.stringify(stripLocal(col, local))) !== hash(rjson)) { putLocal(S, col, id, v); markSeen(col, id, v); changed = true; }
          sy.base[col][id] = hash(rjson);
        }
      }
    }
    sy.lastSrv = maxSrv;
    if (changed) { app.save(); app.render(); }
  }
  async function push() {
    const S = app.getS(), sy = S.sync, hid = sy.hid, now = Date.now(), dev = device();
    const writes = [];
    for (const col of COLS) {
      sy.base[col] = sy.base[col] || {};
      const seen = new Set();
      for (const [id, v] of entries(S, col)) {
        if (!id) continue;
        seen.add(String(id));
        const clean = stripLocal(col, v);
        const json = JSON.stringify(clean), h = hash(json);
        if (sy.base[col][id] === h) continue;
        if (typeof v === "object" && !v._mod) v._mod = now;
        const json2 = JSON.stringify(stripLocal(col, v));
        const mod = (v && v._mod) || now;
        writes.push({ col, id, h: hash(json2), w: doc(hid, col, id, { data: { stringValue: json2 }, mod: { integerValue: String(mod) }, del: { booleanValue: false }, by: { stringValue: dev } }) });
      }
      for (const id of Object.keys(sy.base[col])) {
        if (seen.has(id)) continue;
        writes.push({ col, id, h: null, w: doc(hid, col, id, { mod: { integerValue: String(now) }, del: { booleanValue: true }, by: { stringValue: dev } }) });
      }
    }
    // commit in chunks (Firestore: max 500 writes, keep requests small because photos are inside items)
    let chunk = [], size = 0;
    const flush = async () => {
      if (!chunk.length) return;
      await call(`${API().replace(/\/documents$/, "")}/documents:commit`, { writes: chunk.map(c => c.w) });
      for (const c of chunk) { if (c.h) sy.base[c.col][c.id] = c.h; else delete sy.base[c.col][c.id]; }
      chunk = []; size = 0;
    };
    for (const c of writes) {
      const sz = JSON.stringify(c.w).length;
      if (chunk.length >= 400 || size + sz > 3500000) await flush();
      chunk.push(c); size += sz;
    }
    await flush();
  }
  function doc(hid, col, id, fields) {
    return { update: { name: `${DB()}/households/${hid}/${col}/${encodeURIComponent(id)}`, fields }, updateTransforms: [{ fieldPath: "srv", setToServerValue: "REQUEST_TIME" }] };
  }
  function findLocal(S, col, id) {
    if (col === "barcodes") return (S.barcodes || {})[id] || null;
    return (S[col] || []).find(x => String(x.id) === String(id)) || null;
  }
  function removeLocal(S, col, id) {
    if (col === "barcodes") { if (S.barcodes) delete S.barcodes[id]; return; }
    S[col] = (S[col] || []).filter(x => String(x.id) !== String(id));
  }
  function putLocal(S, col, id, v) {
    if (col === "barcodes") { S.barcodes = S.barcodes || {}; S.barcodes[id] = v; return; }
    const arr = S[col] = S[col] || [];
    const i = arr.findIndex(x => String(x.id) === String(id));
    if (i >= 0) arr[i] = v; else arr.push(v);
  }

  function start(a) {
    app = a;
    if (!enabled) return;
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") schedule(200); });
    window.addEventListener("online", () => schedule(200));
    clearInterval(poll);
    poll = setInterval(() => { if (document.visibilityState === "visible") schedule(0); }, 15000);
    schedule(500);
  }

  window.KLSync = { enabled, start, schedule, syncNow, stamp, create, join, leave, fmtCode, cleanCode, get status() { return status; } };
})();
