/* Kitchen Ledger — browser/iPhone versions of the phone features the Android app does natively.
   Libraries are loaded only when first needed. */
(function () {
  const LIBS = {
    zxing: "https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js",
    tesseract: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js",
    xlsx: "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"
  };
  const loaded = {};
  function loadScript(name) {
    if (loaded[name]) return loaded[name];
    loaded[name] = new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = LIBS[name]; s.async = true;
      s.onload = () => res(); s.onerror = () => { delete loaded[name]; rej(new Error("load " + name)); };
      document.head.appendChild(s);
    });
    return loaded[name];
  }
  const T = s => (window.I18N ? I18N.tr(s) : s);

  /* ---------- live barcode scanner ---------- */
  function scanBarcode(opts) {
    opts = opts || {};
    return new Promise(resolve => {
      const ov = document.createElement("div");
      ov.className = "scanner";
      ov.innerHTML = `<video playsinline muted autoplay></video>
        <div class="scan-frame"><i></i></div>
        <div class="scan-ui"><p class="scan-msg">Point the camera at a barcode</p>
        <div class="row"><button type="button" class="btn" data-k="type">Type the number</button><button type="button" class="btn primary" data-k="cancel">Cancel</button></div></div>`;
      document.body.appendChild(ov);
      const video = ov.querySelector("video"), msg = ov.querySelector(".scan-msg");
      let done = false, stream = null, reader = null, timer = null;
      function finish(code) {
        if (done) return; done = true;
        clearInterval(timer);
        try { reader && reader.reset(); } catch (e) { }
        try { stream && stream.getTracks().forEach(t => t.stop()); } catch (e) { }
        ov.remove();
        if (code && opts.beep !== false) beep();
        if (code && navigator.vibrate) navigator.vibrate(60);
        resolve(code || "");
      }
      ov.querySelector('[data-k="cancel"]').onclick = () => finish("");
      ov.querySelector('[data-k="type"]').onclick = () => {
        const ui = ov.querySelector(".scan-ui");
        ui.innerHTML = `<form class="row" id="scanType"><input class="field" inputmode="numeric" pattern="[0-9]*" placeholder="e.g. 5410673000013" style="flex:1 1 180px"><button class="btn primary" type="submit">Look up</button></form>`;
        const f = ui.querySelector("form"); f.querySelector("input").focus();
        f.onsubmit = e => { e.preventDefault(); finish(f.querySelector("input").value.replace(/\D/g, "")); };
      };
      (async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
          video.srcObject = stream; await video.play().catch(() => { });
        } catch (e) {
          msg.textContent = T("Camera not available. Allow camera access, or type the number.");
          return;
        }
        // Native detector where available (Chrome/Android), otherwise ZXing (iPhone)
        if ("BarcodeDetector" in window) {
          try {
            const det = new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
            timer = setInterval(async () => {
              if (done || video.readyState < 2) return;
              try { const r = await det.detect(video); if (r && r[0]) finish(r[0].rawValue); } catch (e) { }
            }, 250);
            return;
          } catch (e) { }
        }
        try {
          await loadScript("zxing");
          const hints = new Map();
          hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8, ZXing.BarcodeFormat.UPC_A, ZXing.BarcodeFormat.UPC_E, ZXing.BarcodeFormat.CODE_128]);
          hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
          reader = new ZXing.BrowserMultiFormatReader(hints, 200);
          reader.decodeFromStream(stream, video, (res) => { if (res && !done) finish(res.getText()); });
        } catch (e) {
          msg.textContent = T("The scanner couldn't load. Check your internet, or type the number.");
        }
      })();
    });
  }
  let actx = null;
  function beep() {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.frequency.value = 1400; g.gain.value = 0.08; o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + 0.09);
    } catch (e) { }
  }

  /* ---------- receipt text recognition (on the device, in the browser) ---------- */
  let ocrWorker = null;
  async function ocr(file, onProgress) {
    await loadScript("tesseract");
    if (!ocrWorker) {
      ocrWorker = await Tesseract.createWorker(["fra", "deu", "eng"], 1, {
        logger: m => { if (onProgress && m.status === "recognizing text") onProgress(Math.round(m.progress * 100)); }
      });
    }
    const img = await downscale(file, 2200);
    const { data } = await ocrWorker.recognize(img);
    const out = [];
    (data.lines || []).forEach(l => {
      const t = (l.text || "").trim(); if (!t) return;
      out.push({ text: t, top: l.bbox.y0, bottom: l.bbox.y1, left: l.bbox.x0 });
    });
    return out;
  }
  async function downscale(file, max) {
    try {
      const url = URL.createObjectURL(file);
      const img = await new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = url; });
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      return c;
    } catch (e) { return file; }
  }

  /* ---------- import files: CSV text or Excel ---------- */
  async function readImportFile(file) {
    const buf = new Uint8Array(await file.arrayBuffer());
    const isZip = buf[0] === 0x50 && buf[1] === 0x4b;
    if (isZip) {
      await loadScript("xlsx");
      const wb = XLSX.read(buf, { type: "array", cellFormula: true, cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      // keep IMAGE("url") formulas so pictures can be imported
      Object.keys(ws).forEach(k => { const c = ws[k]; if (k[0] !== "!" && c && c.f && /^IMAGE\(/i.test(c.f)) { c.t = "s"; c.v = "=" + c.f; c.w = "=" + c.f; } });
      return XLSX.utils.sheet_to_csv(ws, { rawNumbers: true, blankrows: false });
    }
    try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); }
    catch (e) { return new TextDecoder("windows-1252").decode(buf); }
  }

  /* ---------- save and share ---------- */
  function saveFile(name, text) {
    const bom = /\.csv$/i.test(name) ? "﻿" : "";
    const blob = new Blob([bom + text], { type: /\.json$/i.test(name) ? "application/json" : "text/csv;charset=utf-8" });
    const file = new File([blob], name, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: name }).catch(() => { });
      return true;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    return true;
  }
  async function shareText(title, text) {
    if (navigator.share) { try { await navigator.share({ title, text }); return "shared"; } catch (e) { if (e && e.name === "AbortError") return "cancel"; } }
    try { await navigator.clipboard.writeText(text); return "copied"; } catch (e) { return "fail"; }
  }

  /* ---------- install as an app ---------- */
  if ("serviceWorker" in navigator && location.protocol === "https:" && !window.Android) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => { }));
  }
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

  window.WebPlatform = { scanBarcode, ocr, readImportFile, saveFile, shareText, isIOS, standalone };
})();
