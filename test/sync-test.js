/* End-to-end test of the household sync against the real Firebase project.
   Simulates two phones (separate storage), checks that changes travel both ways, then deletes the test household. */
const fs = require("fs"), vm = require("vm"), path = require("path");
const www = path.join(__dirname, "../app/src/main/assets/www");
const cfgSrc = fs.readFileSync(path.join(www, "config.js"), "utf8");
const syncSrc = fs.readFileSync(path.join(www, "sync.js"), "utf8");

function makeDevice(name) {
  const store = {};
  const ctx = {
    console, fetch, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() { }, crypto: globalThis.crypto, Date, JSON, Math, URL, encodeURIComponent, decodeURIComponent,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    navigator: { onLine: true }, document: { visibilityState: "hidden", addEventListener() { } }, addEventListener() { },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(cfgSrc, ctx); vm.runInContext(syncSrc, ctx);
  const dev = { name, S: { items: [], shopping: [], barcodes: {} }, renders: 0, sync: ctx.KLSync };
  ctx.KLSync.start({ getS: () => dev.S, save() { }, render() { dev.renders++; } });
  return dev;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
function check(cond, msg) { console.log((cond ? "PASS " : "FAIL ") + msg); if (!cond) fails++; }

(async () => {
  const A = makeDevice("A"), B = makeDevice("B");
  check(A.sync.enabled, "sync is configured");
  // A has items before creating the household
  A.S.items.push({ id: "i1", name: "Milk", qty: 1, unit: "l", category: "Dairy", location: "fridge" });
  A.S.items.push({ id: "i2", name: "Rice", qty: 500, unit: "g", category: "Dry goods", location: "pantry", image: "data:image/jpeg;base64," + "A".repeat(20000) });
  A.S.shopping.push({ id: "s1", name: "Bread", done: false });
  A.S.barcodes["5410673000013"] = { name: "Milk", category: "Dairy" };
  let hid;
  try { hid = await A.sync.create(); } catch (e) { console.log("FAIL create:", e.message); process.exit(1); }
  console.log("household", A.sync.fmtCode(hid), "status", JSON.stringify(A.sync.status));
  check(A.sync.status.state === "ok", "A created household and synced");

  // B has its own item and joins, keeping it
  B.S.items.push({ id: "b1", name: "Eggs", qty: 6, unit: "pcs", category: "Dairy", location: "fridge" });
  await B.sync.join(A.sync.fmtCode(hid).toLowerCase(), "merge");
  check(B.sync.status.state === "ok", "B joined (code typed in lower case with dashes)");
  check(B.S.items.length === 3, "B sees A's 2 items plus its own: " + B.S.items.map(i => i.name).join(", "));
  check(B.S.shopping.length === 1 && B.S.barcodes["5410673000013"], "B got shopping list and scanned barcodes");
  check((B.S.items.find(i => i.id === "i2") || {}).image?.length > 20000, "photo travelled with the item");

  await A.sync.syncNow();
  check(A.S.items.some(i => i.name === "Eggs"), "A received B's item");

  // edits both ways
  B.S.items.find(i => i.id === "i1").qty = 0.5;
  B.S.shopping[0].done = true;
  await B.sync.syncNow(); await A.sync.syncNow();
  check(A.S.items.find(i => i.id === "i1").qty === 0.5, "A sees B's quantity change");
  check(A.S.shopping[0].done === true, "A sees B ticked the shopping item");

  // delete on A
  A.S.items = A.S.items.filter(i => i.id !== "b1");
  await A.sync.syncNow(); await B.sync.syncNow();
  check(!B.S.items.some(i => i.id === "b1"), "B sees A's deletion");

  // simultaneous edits on different items
  A.S.items.find(i => i.id === "i1").qty = 2;
  B.S.items.find(i => i.id === "i2").qty = 250;
  await A.sync.syncNow(); await B.sync.syncNow(); await A.sync.syncNow();
  check(A.S.items.find(i => i.id === "i2").qty === 250 && B.S.items.find(i => i.id === "i1").qty === 2, "simultaneous edits on different items both survive");

  // same item edited on both: newer wins, nobody crashes
  A.S.items.find(i => i.id === "i1").name = "Milk A";
  await sleep(20);
  B.S.items.find(i => i.id === "i1").name = "Milk B";
  await A.sync.syncNow(); await B.sync.syncNow(); await A.sync.syncNow();
  const na = A.S.items.find(i => i.id === "i1").name, nb = B.S.items.find(i => i.id === "i1").name;
  check(na === nb, "same-item conflict settles on one value on both phones: " + na);

  // nothing changed -> nothing written
  const before = JSON.stringify(A.S);
  await A.sync.syncNow();
  check(JSON.stringify(A.S) === before, "idle sync changes nothing");

  // wrong code
  const C = makeDevice("C");
  try { await C.sync.join("AAAA-BBBB-CCCC", "merge"); check(false, "unknown code rejected"); } catch (e) { check(/No household/.test(e.user || ""), "unknown code rejected with a clear message"); }

  // cleanup: delete everything of the test household
  const tk = JSON.parse((A.sync && null) || "null");
  const base = `https://firestore.googleapis.com/v1/projects/kitchen-ledger-6811b/databases/(default)/documents/households/${hid}`;
  const auth = await (async () => { const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=AIzaSyBMob9ID6OOUJzL5cnsuUWsInmukOBFCbE`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }) }); return (await r.json()).idToken; })();
  let deleted = 0;
  for (const col of ["items", "shopping", "barcodes"]) {
    const r = await fetch(`${base}/${col}?pageSize=300`, { headers: { Authorization: "Bearer " + auth } }); const j = await r.json();
    for (const d of (j.documents || [])) { await fetch(`https://firestore.googleapis.com/v1/${d.name}`, { method: "DELETE", headers: { Authorization: "Bearer " + auth } }); deleted++; }
  }
  await fetch(base, { method: "DELETE", headers: { Authorization: "Bearer " + auth } });
  console.log("cleaned up", deleted, "test documents");
  console.log(fails ? `${fails} FAILED` : "ALL PASSED");
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log("FAIL crashed:", e.stack || e); process.exit(1); });
