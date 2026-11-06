/* Kitchen Ledger — translations.
   The app is written in English; this file translates what appears on screen.
   Exact texts are looked up in DICT, texts with numbers or names in PATTERNS.
   Anything inside an element with translate="no" (item names, brands, recipes) is left alone. */
(function () {
  const DICT = { de: {}, fr: {} };
  const PATTERNS = { de: [], fr: [] };
  let lang = "en";
  const miss = new Set();
  const made = new Set(); // texts we produced, so they are not translated twice

  function setLang(l) { lang = (l === "de" || l === "fr") ? l : "en"; document.documentElement.lang = lang; }
  function autoLang() {
    const n = (navigator.language || "en").toLowerCase();
    if (n.startsWith("de") || n.startsWith("lb")) return "de";
    if (n.startsWith("fr")) return "fr";
    return "en";
  }
  function tr(s) {
    if (lang === "en" || s == null) return s;
    const str = String(s);
    const k = str.replace(/\s+/g, " ").trim();
    if (!k || !/[A-Za-z]/.test(k) || made.has(k)) return str;
    const d = DICT[lang];
    if (Object.prototype.hasOwnProperty.call(d, k)) { made.add(d[k]); return str.replace(str.trim(), d[k]); }
    for (const [re, rep] of PATTERNS[lang]) {
      const m = k.match(re);
      if (m) { const out = typeof rep === "function" ? rep(m) : k.replace(re, rep); made.add(out); return str.replace(str.trim(), out); }
    }
    miss.add(k);
    return str;
  }
  const SKIP_TAGS = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, svg: 1, SVG: 1, path: 1 };
  function skipped(el) {
    for (let e = el; e && e !== document.body; e = e.parentNode) {
      if (e.nodeType === 1 && (SKIP_TAGS[e.tagName] || e.getAttribute("translate") === "no")) return true;
    }
    return false;
  }
  function translateNode(root) {
    if (lang === "en" || !root) return;
    if (root.nodeType === 3) { if (!skipped(root.parentNode)) { const t = tr(root.nodeValue); if (t !== root.nodeValue) root.nodeValue = t; } return; }
    if (root.nodeType !== 1 || skipped(root)) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: n => (n.nodeType === 1 && (SKIP_TAGS[n.tagName] || n.getAttribute("translate") === "no")) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    const els = [root];
    for (let n = w.currentNode; n; n = w.nextNode()) {
      if (n.nodeType === 3) { const t = tr(n.nodeValue); if (t !== n.nodeValue) n.nodeValue = t; }
      else els.push(n);
    }
    for (const e of els) for (const a of ["placeholder", "aria-label", "title"]) {
      if (e.hasAttribute && e.hasAttribute(a)) { const v = e.getAttribute(a), t = tr(v); if (t !== v) e.setAttribute(a, t); }
    }
  }
  let obs = null;
  function start() {
    if (obs) return;
    obs = new MutationObserver(list => {
      if (lang === "en") return;
      for (const m of list) {
        if (m.type === "characterData") translateNode(m.target);
        else if (m.type === "attributes") translateNode(m.target);
        else m.addedNodes.forEach(translateNode);
      }
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "aria-label", "title"] });
    translateNode(document.body);
  }
  const FOOD = { de: {}, fr: {} };
  function addFood(l, map) { Object.assign(FOOD[l], map); }
  /* Food name in the current language (English base names come from the food dictionary) */
  function food(en) { if (!en || lang === "en") return en; return FOOD[lang][en] || en; }
  function add(l, dict, patterns) { Object.assign(DICT[l], dict); if (patterns) PATTERNS[l].push(...patterns); }

  window.I18N = { setLang, autoLang, tr, translateNode, start, add, addFood, food, missing: () => [...miss], get lang() { return lang; } };
})();
