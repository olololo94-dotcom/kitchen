/* Kitchen Ledger — pure logic (no DOM). Works in the app and in node for tests. */
(function (root) {
  const CATS = ["Produce","Dairy","Meat & fish","Bakery","Dry goods","Canned & jars","Frozen","Drinks","Spices & sauces","Snacks","Household","Other"];
  const UNITS = ["pcs","g","kg","ml","l","pack"];
  const CAT_DAYS = {"Produce":7,"Dairy":10,"Meat & fish":3,"Bakery":4,"Dry goods":365,"Canned & jars":365,"Frozen":120,"Drinks":180,"Spices & sauces":365,"Snacks":120,"Household":null,"Other":30};
  const CAT_LOC = {"Dairy":"fridge","Meat & fish":"fridge","Frozen":"freezer"};

  /* English name | category | location | days | keys (EN, FR, DE, LB) */
  const FOOD_SRC = `
Milk|Dairy|fridge|7|milk,lait,milch,mellech,lait demi ecreme,vollmilch,h milch
Butter|Dairy|fridge|30|butter,beurre,botter
Cheese|Dairy|fridge|21|cheese,fromage,kase,kaes,emmental,gruyere,comte,raclette
Gouda|Dairy|fridge|28|gouda
Parmesan|Dairy|fridge|45|parmesan,parmigiano,grana padano
Mozzarella|Dairy|fridge|7|mozzarella
Feta|Dairy|fridge|20|feta
Cream cheese|Dairy|fridge|14|cream cheese,frischkase,philadelphia,kachkeis
Yogurt|Dairy|fridge|14|yogurt,yoghurt,yaourt,joghurt,jughurt,skyr
Cream|Dairy|fridge|7|cream,creme,sahne,schlagsahne,creme fraiche,schmand,cremefraiche
Quark|Dairy|fridge|10|quark,fromage blanc,maquee
Eggs|Dairy|fridge|21|egg,eggs,oeuf,oeufs,eier,ei,eeer
Chicken breast|Meat & fish|fridge|2|chicken breast,blanc de poulet,filet de poulet,hahnchenbrust,poulet filet,hahnchenbrustfilet
Chicken|Meat & fish|fridge|2|chicken,poulet,hahnchen,huhn,poulet fermier
Beef|Meat & fish|fridge|3|beef,boeuf,rind,rindfleisch,steak,entrecote
Minced meat|Meat & fish|fridge|1|minced,mince,hache,hackfleisch,gehacktes,viande hachee
Pork|Meat & fish|fridge|3|pork,porc,schwein,schweinefleisch,kotelett,cotelette
Ham|Meat & fish|fridge|7|ham,jambon,schinken,ham sliced
Bacon|Meat & fish|fridge|10|bacon,lardons,speck,lard
Sausages|Meat & fish|fridge|7|sausage,saucisse,wurst,wurstchen,mettwurst,merguez,bratwurst
Salami|Meat & fish|fridge|21|salami,chorizo
Salmon|Meat & fish|fridge|2|salmon,saumon,lachs
Tuna|Canned & jars|pantry|700|tuna,thon,thunfisch
Fish|Meat & fish|fridge|2|fish,poisson,fisch,cabillaud,kabeljau,colin
Prawns|Meat & fish|fridge|2|prawn,prawns,shrimp,crevette,crevettes,garnelen
Bread|Bakery|pantry|4|bread,pain,brot,baguette,brout,toast,toastbrot
Rolls|Bakery|pantry|2|roll,rolls,brotchen,petits pains,weck,mutschel
Croissant|Bakery|pantry|2|croissant,croissants
Wraps|Bakery|pantry|30|wrap,wraps,tortilla,tortillas
Spaghetti|Dry goods|pantry|540|spaghetti
Pasta|Dry goods|pantry|540|pasta,pates,nudeln,penne,fusilli,farfalle,tagliatelle,macaroni,lasagne,lasagna
Rice|Dry goods|pantry|540|rice,riz,reis,basmati,risotto
Flour|Dry goods|pantry|365|flour,farine,mehl
Sugar|Dry goods|pantry|730|sugar,sucre,zucker
Oats|Dry goods|pantry|365|oats,flocons d avoine,haferflocken,porridge,muesli,musli,granola
Cereal|Dry goods|pantry|270|cereal,cereals,cereales,cornflakes
Lentils|Dry goods|pantry|540|lentils,lentilles,linsen
Chickpeas|Canned & jars|pantry|700|chickpeas,pois chiches,kichererbsen
Beans|Canned & jars|pantry|700|beans,haricots,bohnen,kidney
Couscous|Dry goods|pantry|365|couscous,bulgur,quinoa
Breadcrumbs|Dry goods|pantry|180|breadcrumbs,chapelure,paniermehl
Coffee|Drinks|pantry|270|coffee,cafe,kaffee,espresso,capsules
Tea|Drinks|pantry|540|tea,the vert,the noir,tee,infusion
Water|Drinks|pantry|365|water,eau,wasser,rosport,viva,spa
Juice|Drinks|fridge|10|juice,jus,saft,orangensaft,jus d orange,orange juice,jus de pomme,apple juice,jus multifruits
Soda|Drinks|pantry|270|cola,coke,fanta,sprite,limonade,soda,ice tea
Beer|Drinks|pantry|180|beer,biere,bier,bofferding,diekirch,battin
Wine|Drinks|pantry|730|wine,vin,wein,cremant,riesling,rivaner,pinot,auxerrois,elbling
Tomatoes|Produce|fridge|6|tomato,tomatoes,tomate,tomates,tomaten,cherry tomatoes
Chopped tomatoes|Canned & jars|pantry|700|chopped tomatoes,tomates concassees,tomates pelees,passata,polpa,dosentomaten,tomatenmark,tomato paste,concentre de tomates
Potatoes|Produce|pantry|21|potato,potatoes,pomme de terre,pommes de terre,kartoffel,gromperen,grompier
Onions|Produce|pantry|30|onion,onions,oignon,oignons,zwiebel,ziwwel
Garlic|Produce|pantry|60|garlic,ail,knoblauch,knuewelek
Carrots|Produce|fridge|21|carrot,carrots,carotte,carottes,karotte,mohre,muorten
Peppers|Produce|fridge|7|pepper,bell pepper,poivron,poivrons,paprika
Courgette|Produce|fridge|7|courgette,zucchini,zucchetti
Aubergine|Produce|fridge|6|aubergine,eggplant
Cucumber|Produce|fridge|7|cucumber,concombre,gurke
Lettuce|Produce|fridge|5|lettuce,salad,salade,laitue,salat,kopfsalat,rucola,roquette,mache,feldsalat
Spinach|Produce|fridge|4|spinach,epinard,epinards,spinat
Broccoli|Produce|fridge|5|broccoli,brocoli
Cauliflower|Produce|fridge|6|cauliflower,chou fleur,blumenkohl
Cabbage|Produce|fridge|14|cabbage,chou,kohl,wirsing,rotkohl
Leeks|Produce|fridge|10|leek,leeks,poireau,poireaux,lauch,porree
Mushrooms|Produce|fridge|4|mushroom,mushrooms,champignon,champignons,pilze,schwammen
Green beans|Produce|fridge|5|green beans,haricots verts,grune bohnen,bounen
Peas|Frozen|freezer|240|peas,petits pois,erbsen
Corn|Canned & jars|pantry|700|corn,sweetcorn,mais
Avocado|Produce|pantry|4|avocado,avocat,avocats
Lemons|Produce|fridge|21|lemon,lemons,citron,citrons,zitrone,zitronen,lime,citron vert
Apples|Produce|fridge|30|apple,apples,pomme,pommes,apfel,aepel,jonagold,elstar,pink lady,gala
Bananas|Produce|pantry|5|banana,bananas,banane,bananes
Oranges|Produce|pantry|14|orange,oranges,mandarine,clementine,clementines
Pears|Produce|pantry|7|pear,pears,poire,poires,birne,birnen
Grapes|Produce|fridge|7|grapes,raisin,raisins,trauben
Strawberries|Produce|fridge|3|strawberry,strawberries,fraise,fraises,erdbeeren
Berries|Produce|fridge|4|blueberries,raspberries,myrtilles,framboises,heidelbeeren,himbeeren
Ginger|Produce|fridge|21|ginger,gingembre,ingwer
Herbs|Produce|fridge|5|parsley,basil,coriander,persil,basilic,coriandre,petersilie,basilikum,schnittlauch,ciboulette,dill,aneth
Olive oil|Spices & sauces|pantry|540|olive oil,huile d olive,olivenol
Oil|Spices & sauces|pantry|540|oil,huile,ol,sonnenblumenol,rapsol,huile de tournesol
Vinegar|Spices & sauces|pantry|730|vinegar,vinaigre,essig,balsamico
Salt|Spices & sauces|pantry|1800|salt,sel,salz
Black pepper|Spices & sauces|pantry|1095|black pepper,poivre,pfeffer
Spices|Spices & sauces|pantry|730|spice,epices,gewurz,curry,cumin,paprikapulver,cannelle,zimt,oregano,thym,thyme
Mustard|Spices & sauces|fridge|180|mustard,moutarde,senf,moutarde de luxembourg
Ketchup|Spices & sauces|fridge|180|ketchup
Mayonnaise|Spices & sauces|fridge|90|mayonnaise,mayo
Soy sauce|Spices & sauces|pantry|540|soy sauce,sauce soja,sojasauce
Pesto|Canned & jars|fridge|14|pesto
Stock|Spices & sauces|pantry|540|stock,bouillon,bruhe,gemusebruhe,fond
Honey|Canned & jars|pantry|1095|honey,miel,honig
Jam|Canned & jars|pantry|365|jam,confiture,marmelade,konfiture
Peanut butter|Canned & jars|pantry|270|peanut butter,beurre de cacahuete,erdnussbutter
Chocolate spread|Canned & jars|pantry|270|nutella,pate a tartiner,nuss nougat
Chocolate|Snacks|pantry|270|chocolate,chocolat,schokolade,schoko
Biscuits|Snacks|pantry|180|biscuit,biscuits,cookies,kekse,gaufrettes,speculoos
Crisps|Snacks|pantry|120|crisps,chips,pringles
Nuts|Snacks|pantry|180|nuts,noix,nusse,almonds,amandes,mandeln,cashew,peanuts,cacahuetes
Ice cream|Frozen|freezer|180|ice cream,glace,eis,speiseeis,magnum
Frozen pizza|Frozen|freezer|180|pizza
Fries|Frozen|freezer|240|fries,frites,pommes frites
Frozen vegetables|Frozen|freezer|240|frozen vegetables,legumes surgeles,tiefkuhlgemuse,surgeles
Tofu|Meat & fish|fridge|10|tofu,tempeh,seitan
Hummus|Dairy|fridge|7|hummus,houmous
Toilet paper|Household|pantry|0|toilet paper,papier toilette,toilettenpapier,klopapier
Dish soap|Household|pantry|0|dish soap,liquide vaisselle,spulmittel,dreft,pril
Detergent|Household|pantry|0|detergent,lessive,waschmittel,ariel,persil megaperls
Kitchen roll|Household|pantry|0|kitchen roll,essuie tout,kuchenrolle,sopalin
Bin bags|Household|pantry|0|bin bags,sacs poubelle,mullbeutel
`;
  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/ß/g, "ss").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  }
  const FOOD = FOOD_SRC.trim().split("\n").map(l => {
    const [en, cat, loc, days, keys] = l.split("|");
    return { en, cat, loc, days: Number(days) || null, keys: keys.split(",").map(norm).filter(Boolean) };
  });
  function variants(w) {
    const v = [w];
    for (const suf of ["es", "en", "s", "n", "e"]) if (w.length > suf.length + 2 && w.endsWith(suf)) v.push(w.slice(0, -suf.length));
    return v;
  }
  /* Best dictionary entry for a free-text name (any language), or null. */
  function lookupFood(name) {
    const n = norm(name); if (!n) return null;
    const words = n.split(" ");
    const padded = " " + n + " ";
    let best = null, bestLen = 0;
    for (const f of FOOD) {
      for (const k of f.keys) {
        let hit = false;
        if (k.includes(" ")) hit = padded.includes(" " + k + " ") || padded.includes(" " + k + "s ");
        else hit = words.some(w => variants(w).some(v => v === k || (k.length >= 4 && v.length > k.length && v.endsWith(k)) || (k.length >= 6 && v.length > k.length && v.startsWith(k))));
        if (hit && k.length > bestLen) { best = f; bestLen = k.length; }
      }
    }
    return best;
  }
  function guess(name) {
    const f = lookupFood(name);
    if (!f) return { category: "Other", location: "pantry", shelfDays: 30, base: null };
    return { category: f.cat, location: f.loc, shelfDays: f.days, base: f.en };
  }

  /* "500 g", "1,5 L", "6 x 33 cl", "75cl", "12 pièces" -> {qty, unit} */
  function parseQuantity(q) {
    const s = norm(String(q || "").replace(/(\d),(\d)/g, "$1.$2").replace(/(\d)\.(\d)/g, "$1DOT$2")).replace(/dot/g, ".");
    let m = s.match(/^(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*(kg|g|mg|l|cl|ml|dl)\b/);
    if (m) return { qty: Number(m[1]), unit: "pcs" };
    m = s.match(/(\d+(?:\.\d+)?)\s*(kg|g|mg|l|cl|ml|dl)\b/);
    if (m) {
      let v = Number(m[1]), u = m[2];
      if (u === "cl") { v *= 10; u = "ml"; } else if (u === "dl") { v *= 100; u = "ml"; } else if (u === "mg") { v /= 1000; u = "g"; }
      if (u === "g" && v >= 1000) { v /= 1000; u = "kg"; }
      if (u === "ml" && v >= 1000) { v /= 1000; u = "l"; }
      return { qty: Math.round(v * 1000) / 1000, unit: u };
    }
    m = s.match(/(\d+)\s*(pcs|pieces|piece|stuck|st|eggs|oeufs|eier|x)?\b/);
    if (m && m[2]) return { qty: Number(m[1]), unit: "pcs" };
    return null;
  }

  /* Open Food Facts product -> item fields */
  const OFF_MAP = [
    ["Frozen", ["en:frozen-foods", "en:frozen-desserts", "en:ice-creams"]],
    ["Drinks", ["en:beverages", "en:waters", "en:sodas", "en:juices", "en:fruit-juices", "en:alcoholic-beverages", "en:beers", "en:wines", "en:coffees", "en:teas", "en:milk-substitutes"]],
    ["Meat & fish", ["en:meats", "en:fishes", "en:seafood", "en:poultries", "en:hams", "en:sausages", "en:prepared-meats", "en:meat-alternatives", "en:fish-and-meat-and-eggs"]],
    ["Dairy", ["en:dairies", "en:milks", "en:cheeses", "en:yogurts", "en:butters", "en:creams", "en:eggs", "en:fermented-milk-products"]],
    ["Bakery", ["en:breads", "en:pastries", "en:viennoiseries", "en:cakes", "en:sandwich-breads"]],
    ["Snacks", ["en:snacks", "en:sweet-snacks", "en:salty-snacks", "en:biscuits", "en:chocolates", "en:confectioneries", "en:crisps", "en:appetizers", "en:nuts"]],
    ["Spices & sauces", ["en:condiments", "en:sauces", "en:spices", "en:vinegars", "en:salts", "en:vegetable-oils", "en:olive-oils", "en:mustards", "en:ketchup", "en:mayonnaises", "en:broths"]],
    ["Canned & jars", ["en:canned-foods", "en:spreads", "en:jams", "en:honeys", "en:pickles", "en:sweet-spreads", "en:canned-vegetables", "en:canned-fishes"]],
    ["Dry goods", ["en:pastas", "en:rices", "en:cereals-and-their-products", "en:breakfast-cereals", "en:legumes", "en:flours", "en:sugars", "en:dried-products", "en:cereal-grains", "en:seeds"]],
    ["Produce", ["en:fresh-vegetables", "en:vegetables", "en:fruits", "en:fresh-fruits", "en:fresh-plant-based-foods", "en:potatoes"]]
  ];
  function mapOFF(p, code) {
    if (!p) return null;
    const name = (p.product_name_en || p.product_name || p.product_name_fr || p.product_name_de || p.generic_name || "").trim();
    const tags = p.categories_tags || [];
    let cat = null;
    for (const [c, list] of OFF_MAP) if (list.some(t => tags.includes(t))) { cat = c; break; }
    const g = guess(name + " " + (p.generic_name || ""));
    if (!cat) cat = g.category;
    const q = parseQuantity(p.quantity) || { qty: 1, unit: "pcs" };
    let loc = g.base && g.category === cat ? g.location : (CAT_LOC[cat] || "pantry");
    if (tags.includes("en:frozen-foods")) loc = "freezer";
    const days = g.base && g.category === cat ? g.shelfDays : CAT_DAYS[cat];
    const brand = String(p.brands || "").split(",")[0].trim();
    return {
      name: name || (brand ? brand + " product" : "Unknown product"),
      brand, qty: q.qty, unit: q.unit, category: cat, location: loc, shelfDays: days,
      image: p.image_front_small_url || p.image_front_url || p.image_small_url || p.image_url || null,
      barcode: code || p.code || null, base: g.base, packText: p.quantity || ""
    };
  }

  /* ---------- receipts ---------- */
  const SKIP = /\b(total|totaal|somme|summe|sum|subtotal|sous total|zwischensumme|tva|mwst|vat|ust|tax|carte|card|visa|mastercard|maestro|bancontact|payconiq|digicash|cb|espece|especes|bar|cash|rendu|wechselgeld|change|monnaie|pfand|consigne|leergut|vidange|remise|rabatt|reduction|discount|promo|bon|coupon|points|fidelite|payback|ticket|kassenbon|merci|danke|thank|bienvenue|caisse|kasse|kassier|caissier|tel|tél|www|http|siret|rcs|tva intracom|lu\d|iban|date|heure|uhrzeit|article|articles|artikel|nombre|anzahl|sac|tute|tasche|bag|beutel|euro|eur total|a payer|zu zahlen|net|brut|exo|taux)\b/;
  const PRICE_RE = /(-?\d{1,4}[.,]\d{2})\s*(?:€|eur)?\s*(?:[a-d]|[a-d]\d|\*|\d)?\s*$/i;
  /* lines: [{text, top, bottom, left}] from on-device text recognition */
  function groupRows(lines) {
    const L = lines.filter(l => l && l.text && l.text.trim()).map(l => ({ ...l, mid: (l.top + l.bottom) / 2, h: Math.max(1, l.bottom - l.top) }));
    L.sort((a, b) => a.mid - b.mid);
    const rows = [];
    for (const l of L) {
      const r = rows.find(r => Math.abs(r.mid - l.mid) < Math.min(r.h, l.h) * 0.6);
      if (r) { r.parts.push(l); r.mid = (r.mid * (r.parts.length - 1) + l.mid) / r.parts.length; }
      else rows.push({ mid: l.mid, h: l.h, parts: [l] });
    }
    return rows.map(r => r.parts.sort((a, b) => a.left - b.left).map(p => p.text.trim()).join("  "));
  }
  function titleCase(s) { return s.toLowerCase().replace(/(^|[\s\-\/])([a-zà-ÿ])/g, (m, a, b) => a + b.toUpperCase()); }
  function parseReceipt(input) {
    const rows = Array.isArray(input) && input.length && typeof input[0] === "object" ? groupRows(input) : String(input || "").split(/\r?\n/);
    const items = []; let pendingName = null, pendingQty = 1, store = null, date = null;
    const STORES = ["cactus", "delhaize", "auchan", "aldi", "lidl", "match", "colruyt", "carrefour", "cora", "naturata", "smatch", "shop", "pall center", "ikea", "rewe", "intermarche"];
    for (let raw of rows) {
      const line = raw.replace(/\s+/g, " ").trim(); if (!line) continue;
      const n = norm(line);
      if (!store) { const s = STORES.find(s => n.includes(s)); if (s) { store = titleCase(s); continue; } }
      const dm = line.match(/\b(\d{1,2})[.\/-](\d{1,2})[.\/-](20\d{2}|\d{2})\b/);
      if (dm && !date) { const y = dm[3].length === 2 ? "20" + dm[3] : dm[3]; date = `${y}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`; }
      if (SKIP.test(n)) { pendingName = null; continue; }
      const qm = line.match(/^(\d{1,2})\s*[xX*]\s*(\d{1,4}[.,]\d{2})?/);
      const wm = line.match(/(\d+[.,]\d{1,3})\s*kg\s*[xX*@]/i);
      const pm = line.match(PRICE_RE);
      let namePart = pm ? line.slice(0, pm.index) : line;
      if (qm && !/[a-zA-Z]{3,}/.test(namePart.replace(/^(\d{1,2})\s*[xX*]/, ""))) { pendingQty = Number(qm[1]); continue; }
      namePart = namePart.replace(/^(\d{1,2})\s*[xX*]\s*/, m => { pendingQty = Number(m.match(/\d+/)[0]); return ""; })
        .replace(/\b\d{6,14}\b/g, "").replace(/\d+[.,]\d{1,3}\s*(kg|€)?\s*[xX*@].*$/i, "").replace(/[*#]+/g, " ").replace(/\s+/g, " ").trim();
      const letters = (namePart.match(/[a-zA-ZÀ-ÿ]/g) || []).length;
      if (pm && letters >= 3) {
        const price = Number(pm[1].replace(",", "."));
        if (price <= 0) { pendingName = null; continue; }
        pushItem(namePart, price, wm ? Number(wm[1].replace(",", ".")) : null);
      } else if (pm && pendingName) {
        pushItem(pendingName, Number(pm[1].replace(",", ".")), null); pendingName = null;
      } else if (!pm && letters >= 3 && letters / namePart.length > 0.5) {
        pendingName = namePart;
      }
    }
    function pushItem(rawName, price, kg) {
      const g = guess(rawName);
      const clean = titleCase(rawName.replace(/\b\d+([.,]\d+)?\s*(g|kg|ml|cl|l)\b/gi, "").replace(/\s+/g, " ").trim()) || rawName;
      const pq = parseQuantity(rawName);
      let qty = pendingQty, unit = "pcs";
      if (kg) { qty = kg; unit = "kg"; } else if (pq && pq.unit !== "pcs" && pendingQty === 1) { qty = pq.qty; unit = pq.unit; }
      items.push({ name: g.base || clean, original: clean, qty, unit, category: g.category, location: g.location, shelfDays: g.shelfDays, price, matched: !!g.base });
      pendingQty = 1;
    }
    const merged = [];
    for (const it of items) {
      const m = merged.find(x => x.name === it.name && x.unit === it.unit && x.unit === "pcs");
      if (m) { m.qty += it.qty; m.price = Math.round((m.price + it.price) * 100) / 100; } else merged.push(it);
    }
    return { store, date, items: merged };
  }

  /* ---------- CSV ---------- */
  const COLS = ["name","brand","quantity","unit","category","location","best_before","min_quantity","barcode","added","image"];
  function csvCell(v) { v = v == null ? "" : String(v); return /[",;\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function toCSV(items) {
    return [COLS.join(",")].concat(items.map(i => [i.name, i.brand, i.qty, i.unit, i.category, i.location, i.expiry || "", i.minQty ?? "", i.barcode || "", i.added || "", (i.image && /^https?:/.test(i.image)) ? i.image : ""].map(csvCell).join(","))).join("\r\n") + "\r\n";
  }
  function parseCSV(text) {
    text = String(text).replace(/^﻿/, "");
    let forced = null;
    const sm = text.match(/^\s*"?sep=(.)"?\s*\r?\n/i);
    if (sm) { forced = sm[1]; text = text.slice(sm[0].length); }
    const sampleLines = text.split(/\r?\n/).filter(l => l.trim()).slice(0, 6);
    const score = d => { const counts = sampleLines.map(l => l.split(d).length - 1); const min = Math.min(...counts); return min > 0 ? min * 10 + (counts.every(c => c === counts[0]) ? 5 : 0) : 0; };
    let delim = forced || [",", ";", "\t", "|"].sort((x, y) => score(y) - score(x))[0];
    if (!forced && score(delim) === 0) delim = ",";
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
      if (c === '"' && cell.trim() === "") { q = true; cell = ""; }
      else if (c === delim) { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); cell = ""; if (row.some(x => x.trim() !== "")) rows.push(row); row = []; }
      else cell += c;
    }
    row.push(cell); if (row.some(x => x.trim() !== "")) rows.push(row);
    return rows.map(r => r.map(c => c.trim()));
  }

  /* Header words per field (EN, FR, DE, NL, ES, IT). Order matters: specific fields are claimed first, the name last. */
  const FIELDS = [
    ["barcode", ["barcode", "bar code", "ean", "ean13", "gtin", "upc", "code barre", "code barres", "codebarre", "strichcode", "barcode number"]],
    ["image", ["image", "image url", "picture", "photo", "bild", "img", "thumbnail"]],
    ["best_before", ["best before", "best_before", "expiry", "expiry date", "expiration", "expiration date", "expires", "expire", "exp date", "use by", "bbd", "mhd", "haltbar", "haltbarkeit", "ablaufdatum", "verfallsdatum", "dlc", "ddm", "peremption", "date de peremption", "date limite", "date d expiration", "caducidad", "scadenza", "houdbaar"]],
    ["added", ["added", "date added", "added on", "created", "created at", "purchase date", "purchased", "bought", "date d achat", "achat", "ajoute", "ajoute le", "date ajout", "kaufdatum", "hinzugefugt", "erstellt"]],
    ["min_quantity", ["min quantity", "min_quantity", "minimum", "min", "reorder", "reorder level", "low stock", "alert", "seuil", "mindestmenge"]],
    ["category", ["category", "categories", "categorie", "kategorie", "rayon", "type", "group", "groupe", "aisle", "section", "food group", "categoria"]],
    ["location", ["location", "storage", "storage location", "stored", "stored in", "place", "where", "lieu", "emplacement", "rangement", "stockage", "lagerort", "lagerung", "ort", "standort", "ubicacion"]],
    ["brand", ["brand", "brands", "marque", "marke", "hersteller", "manufacturer", "producer", "marca"]],
    ["unit", ["unit", "units", "unite", "unites", "einheit", "measure", "uom", "mesure", "unidad"]],
    ["quantity", ["quantity", "qty", "quantite", "qte", "amount", "count", "stock", "menge", "anzahl", "bestand", "number", "nombre", "cantidad", "quantita", "aantal", "in stock", "quantity in stock"]],
    ["notes", ["notes", "note", "comment", "comments", "remarque", "notiz", "description"]],
    ["name", ["name", "item", "item name", "items", "product", "product name", "products", "article", "articles", "artikel", "produit", "nom", "nom du produit", "libelle", "designation", "bezeichnung", "produktname", "ingredient", "food", "title", "titre", "nombre", "naam", "prodotto"]]
  ];
  function matchHeaders(head) {
    const H = head.map(h => norm(h).replace(/_/g, " "));
    const idx = {}; const used = new Set();
    for (const [f] of FIELDS) idx[f] = -1;
    // pass 1: exact header match; pass 2: header contains the word as a whole token
    for (const pass of [1, 2]) {
      for (const [f, words] of FIELDS) {
        if (idx[f] >= 0) continue;
        for (let i = 0; i < H.length; i++) {
          if (used.has(i) || !H[i]) continue;
          const h = H[i];
          const hit = pass === 1 ? words.includes(h) : words.some(w => w.length >= 3 && (" " + h + " ").includes(" " + w + " "));
          if (hit) { idx[f] = i; used.add(i); break; }
        }
      }
    }
    return idx;
  }

  const MONTHS = { jan: 1, janv: 1, janvier: 1, januar: 1, feb: 2, fev: 2, fevr: 2, fevrier: 2, februar: 2, mar: 3, mars: 3, marz: 3, apr: 4, avr: 4, avril: 4, april: 4, may: 5, mai: 5, jun: 6, juin: 6, juni: 6, jul: 7, juil: 7, juillet: 7, juli: 7, aug: 8, aou: 8, aout: 8, august: 8, sep: 9, sept: 9, septembre: 9, september: 9, oct: 10, okt: 10, octobre: 10, oktober: 10, nov: 11, novembre: 11, november: 11, dec: 12, dez: 12, decembre: 12, dezember: 12, january: 1, february: 2, march: 3, june: 6, july: 7, october: 10, december: 12 };
  const pad = n => String(n).padStart(2, "0");
  function okDate(y, m, d) { y = +y; m = +m; d = +d; if (y < 100) y += 2000; if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null; return `${y}-${pad(m)}-${pad(d)}`; }
  function normDate(v) {
    v = String(v || "").trim(); if (!v) return null;
    let m;
    if (/^\d{10,13}$/.test(v)) { const t = new Date(v.length === 13 ? +v : +v * 1000); return isNaN(t) ? null : t.toISOString().slice(0, 10); }
    if ((m = v.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/))) return okDate(m[1], m[2], m[3]);
    if ((m = v.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})\b/))) {
      let a = +m[1], b = +m[2];
      if (b > 12 && a <= 12) return okDate(m[3], a, b); // US month/day
      return okDate(m[3], b, a);                         // European day/month
    }
    const n = norm(v);
    if ((m = n.match(/^(\d{1,2}) ([a-z]+) (\d{2,4})/)) && MONTHS[m[2]]) return okDate(m[3], MONTHS[m[2]], m[1]);
    if ((m = n.match(/^([a-z]+) (\d{1,2}) (\d{2,4})/)) && MONTHS[m[1]]) return okDate(m[3], MONTHS[m[1]], m[2]);
    if ((m = n.match(/^[a-z]+ ([a-z]+) (\d{1,2}) (\d{4})/)) && MONTHS[m[1]]) return okDate(m[3], MONTHS[m[1]], m[2]);
    if ((m = n.match(/^(\d{1,2}) ([a-z]+)$/)) && MONTHS[m[2]]) return okDate(new Date().getFullYear(), MONTHS[m[2]], m[1]);
    if ((m = n.match(/^([a-z]+) (\d{4})$/)) && MONTHS[m[1]]) return okDate(m[2], MONTHS[m[1]], 1);
    if ((m = v.match(/^(\d{1,2})[.\/-](\d{4})$/))) return okDate(m[2], m[1], 1);
    return null;
  }
  function normLoc(v) {
    v = norm(v); if (!v) return null;
    if (/freez|tiefk|gefrier|cong|surgel|vries/.test(v)) return "freezer";
    if (/fridge|refrig|kuhl|frigo|refri|koelkast|nevera|frigor/.test(v)) return "fridge";
    if (/pantry|vorrat|placard|cellier|schrank|cupboard|cabinet|shelf|garde manger|armoire|epicerie|keller|cellar|kitchen|cuisine|kuche/.test(v)) return "pantry";
    return null;
  }
  /* Map a foreign category label to ours */
  const CAT_WORDS = [
    ["Frozen", /frozen|freez|surgel|congel|tiefk|gefrier|glace|ice cream/],
    ["Household", /household|cleaning|menage|entretien|haushalt|hygiene|toilet|drogerie|non food|nonfood|paper|papier/],
    ["Drinks", /drink|beverage|boisson|getrank|bier|beer|wine|vin|wein|alcohol|alcool|juice|jus|water|eau|coffee|cafe|kaffee|tea|the |tee/],
    ["Dairy", /dairy|laitier|cremerie|milch|molkerei|fromage|cheese|kase|egg|oeuf|eier|yog|lait|milk|butter|beurre/],
    ["Meat & fish", /meat|viande|fleisch|fish|poisson|fisch|seafood|mer|poultry|volaille|charcut|wurst|boucher|butcher|traiteur/],
    ["Bakery", /bak|bread|pain|brot|boulang|patiss|backwar/],
    ["Produce", /produce|fruit|vegetable|veggie|legume|gemuse|obst|primeur|salad|herb/],
    ["Canned & jars", /can|tin|jar|conserve|bocal|konserv|glas|spread|tartin|jam|confiture/],
    ["Spices & sauces", /spice|epice|gewurz|sauce|condiment|herbs and|oil|huile|ol |vinegar|vinaigre|seasoning|assaisonnement/],
    ["Snacks", /snack|sweet|candy|confis|bonbon|chocolat|choco|biscuit|cookie|chips|apero|susswar|knabber|gateau/],
    ["Dry goods", /dry|sec|grocery|epicerie|pasta|pate|rice|riz|grain|cereal|cereale|baking|flour|farine|legumin|nudel|reis|backen|staple|breakfast|petit dej/]
  ];
  function mapCategory(label) {
    const l = norm(label); if (!l) return null;
    const exact = CATS.find(c => norm(c) === l); if (exact) return exact;
    for (const [c, re] of CAT_WORDS) if (re.test(" " + l + " ")) return c;
    return null;
  }
  const UNIT_WORDS = { g: ["g", "gr", "gram", "grams", "gramme", "grammes", "gramm"], kg: ["kg", "kilo", "kilos", "kilogram", "kilograms", "kilogramme", "kilogramm"], ml: ["ml", "milliliter", "millilitre", "milliliters", "millilitres"], l: ["l", "lt", "ltr", "liter", "litre", "liters", "litres"], cl: ["cl", "centiliter", "centilitre"], pack: ["pack", "packs", "package", "packages", "packet", "packets", "paquet", "paquets", "packung", "packungen", "box", "boxes", "boite", "boites", "bag", "bags", "sachet", "sachets", "beutel", "carton", "pkg", "pk"], pcs: ["pcs", "pc", "piece", "pieces", "pce", "pces", "unit", "units", "unite", "unites", "item", "items", "x", "stk", "stuck", "st", "each", "ea", "can", "cans", "tin", "tins", "bottle", "bottles", "bouteille", "bouteilles", "flasche", "flaschen", "jar", "jars", "bocal", "bocaux", "glas", "dose", "dosen", "conserve", "pot", "pots", "tube", "tubes", "slice", "slices", "tranche", "tranches", "bunch", "botte", "head", "loaf", "roll", "rolls", "serving", "servings", "portion", "portions"] };
  function mapUnit(u) {
    u = norm(u).replace(/\s/g, ""); if (!u) return null;
    for (const k in UNIT_WORDS) if (UNIT_WORDS[k].includes(u)) return k;
    return null;
  }
  function num(v) { const m = String(v || "").replace(",", ".").match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : NaN; }
  function readQty(qCell, uCell) {
    let qty = num(qCell), unit = mapUnit(uCell);
    const inline = String(qCell || "").replace(/^[\d\s.,]+/, "").trim();
    if (!unit && inline) unit = mapUnit(inline) || (parseQuantity(qCell) || {}).unit || null;
    if (!unit && uCell) { const pq = parseQuantity("1 " + uCell); if (pq) unit = pq.unit; }
    if (isNaN(qty) || qty < 0) qty = 1;
    if (unit === "cl") { qty *= 10; unit = "ml"; }
    if (unit === "g" && qty >= 1000) { qty /= 1000; unit = "kg"; }
    if (unit === "ml" && qty >= 1000) { qty /= 1000; unit = "l"; }
    return { qty: Math.round(qty * 1000) / 1000, unit: UNITS.includes(unit) ? unit : "pcs" };
  }
  function looksLikeHeader(row) {
    const idx = matchHeaders(row);
    return Object.values(idx).filter(i => i >= 0).length >= (row.length === 1 ? 1 : 2) || idx.name >= 0;
  }
  function textiness(rows, col) {
    let t = 0, n = 0;
    for (const r of rows.slice(0, 30)) { const v = r[col] || ""; if (!v) continue; n++; if (/[a-zA-ZÀ-ÿ]{3,}/.test(v) && !normDate(v) && !/^https?:/.test(v)) t++; }
    return n ? t / n : 0;
  }
  function csvToItems(text, todayIso) {
    const rows = parseCSV(text); if (!rows.length) return { items: [], skipped: 0, columns: [] };
    let hi = rows.slice(0, 6).findIndex(looksLikeHeader);
    let idx, body;
    if (hi >= 0) { idx = matchHeaders(rows[hi]); body = rows.slice(hi + 1); }
    else { idx = matchHeaders([]); body = rows; }
    if (idx.name < 0) {
      // No recognizable name column: use the most text-like column that isn't claimed
      const claimed = new Set(Object.values(idx).filter(i => i >= 0));
      const width = Math.max(...body.slice(0, 30).map(r => r.length));
      let best = -1, bestScore = 0;
      for (let c = 0; c < width; c++) { if (claimed.has(c)) continue; const s = textiness(body, c); if (s > bestScore) { bestScore = s; best = c; } }
      idx.name = best >= 0 ? best : 0;
    }
    if (idx.quantity < 0) {
      // A mostly-numeric unclaimed column is the quantity
      const claimed = new Set(Object.values(idx).filter(i => i >= 0));
      const width = Math.max(...body.slice(0, 30).map(r => r.length));
      for (let c = 0; c < width; c++) {
        if (claimed.has(c)) continue;
        const vals = body.slice(0, 30).map(r => r[c] || "").filter(Boolean);
        if (vals.length && vals.filter(v => /^\d+([.,]\d+)?\s*[a-zA-Z]{0,6}$/.test(v) && !normDate(v)).length / vals.length > 0.8 && vals.every(v => v.replace(/\D/g, "").length < 6)) { idx.quantity = c; break; }
      }
    }
    const headRow = hi >= 0 ? rows[hi] : [];
    const columns = Object.entries(idx).filter(([, i]) => i >= 0).map(([f, i]) => [f, headRow[i] || ("column " + (i + 1))]);
    const get = (r, k) => idx[k] >= 0 ? (r[idx[k]] || "").trim() : "";
    let skipped = 0; const items = [];
    for (const r of body) {
      let name = get(r, "name").replace(/\s+/g, " ").trim();
      if (!name || /^(total|sum|summe)$/i.test(name)) { skipped++; continue; }
      const brand = get(r, "brand");
      const g = guess(name + (brand ? " " + brand : ""));
      const q = readQty(get(r, "quantity"), get(r, "unit"));
      const catIn = get(r, "category");
      const mapped = mapCategory(catIn);
      const cat = g.base ? (mapped && mapped !== g.category && mapped !== "Other" ? mapped : g.category) : (mapped || g.category);
      const locIn = normLoc(get(r, "location"));
      const location = locIn || (cat === g.category ? g.location : (CAT_LOC[cat] || (catIn && normLoc(catIn)) || "pantry"));
      const minRaw = get(r, "min_quantity");
      const bc = get(r, "barcode").replace(/\D/g, "");
      const img = get(r, "image");
      items.push({ name, brand, qty: q.qty, unit: q.unit, category: cat, location,
        expiry: normDate(get(r, "best_before")), minQty: minRaw && !isNaN(num(minRaw)) ? num(minRaw) : null,
        barcode: bc.length >= 6 ? bc : null, added: normDate(get(r, "added")) || todayIso,
        image: /^https?:\/\//.test(img) ? img : null, base: g.base });
    }
    return { items, skipped, columns };
  }

  /* ---------- recipes ---------- */
  const STAPLES = ["salt", "pepper", "black pepper", "water", "oil", "olive oil", "vegetable oil", "sunflower oil", "ice", "boiling water", "cold water", "hot water"];
  const MEAT = /\b(chicken|beef|pork|lamb|bacon|ham|sausage|chorizo|salami|turkey|duck|veal|mince|steak|fish|salmon|tuna|cod|haddock|prawn|prawns|shrimp|anchov|mussels|crab|lobster|squid|pancetta|prosciutto|gelatin|lard|goose|venison|kidney|liver|oxtail|meat)/;
  const ANIMAL = /\b(milk|butter|cheese|cream|yogurt|yoghurt|egg|eggs|honey|parmesan|mozzarella|cheddar|feta|ricotta|mascarpone|ghee|creme fraiche)/;
  function mealIngredients(meal) {
    const out = [];
    for (let i = 1; i <= 20; i++) {
      const n = (meal["strIngredient" + i] || "").trim(); if (!n) continue;
      out.push({ name: n, amount: (meal["strMeasure" + i] || "").trim() });
    }
    return out;
  }
  function itemKeys(it) {
    const keys = new Set();
    const nn = norm(it.name).replace(/\bexample\b/g, "").trim(); if (nn) keys.add(nn);
    const base = it.base || (lookupFood(it.name) || {}).en; if (base) keys.add(norm(base));
    return [...keys];
  }
  function ingredientMatches(ingName, items) {
    const n = norm(ingName); if (!n) return null;
    const nv = n.split(" ").flatMap(variants);
    const lf = lookupFood(ingName); const lb = lf ? norm(lf.en) : null;
    for (const it of items) {
      if (!(it.qty > 0)) continue;
      for (const k of itemKeys(it)) {
        if (k === n || (lb && k === lb)) return it;
        const kv = k.split(" ").flatMap(variants);
        if (k.length >= 4 && (n.includes(k) || k.includes(n))) return it;
        if (kv.length === 1 && nv.includes(kv[0]) && kv[0].length >= 4) return it;
      }
    }
    return null;
  }
  function scoreMeal(meal, items) {
    const ings = mealIngredients(meal).map(x => {
      const st = STAPLES.includes(norm(x.name));
      const m = st ? null : ingredientMatches(x.name, items);
      return { ...x, have: st || !!m, staple: st, match: m ? m.id : null };
    });
    const real = ings.filter(x => !x.staple);
    const have = real.filter(x => x.have).length;
    return { ings, have, total: real.length, missing: real.length - have };
  }
  function dietOk(meal, diet) {
    if (!diet || diet === "Anything") return true;
    const all = norm(mealIngredients(meal).map(x => x.name).join(" ") + " " + (meal.strMeal || ""));
    if (diet === "Vegetarian") return !MEAT.test(all);
    if (diet === "Vegan") return !MEAT.test(all) && !ANIMAL.test(all);
    if (diet === "Pescatarian") return !/\b(chicken|beef|pork|lamb|bacon|ham|sausage|chorizo|salami|turkey|duck|veal|mince|steak|pancetta|prosciutto|goose|venison|meat)/.test(all);
    return true;
  }
  /* Which inventory items to search recipes for: expiring first, cookable only */
  function recipeSeeds(items, daysLeftFn, max) {
    const cookable = items.filter(i => i.qty > 0 && !["Household", "Drinks", "Snacks"].includes(i.category) && !["Salt", "Black pepper", "Oil", "Olive oil", "Sugar", "Spices", "Water"].includes(i.base || (lookupFood(i.name) || {}).en));
    cookable.sort((a, b) => (daysLeftFn(a.expiry) ?? 999) - (daysLeftFn(b.expiry) ?? 999));
    const seeds = []; const seen = new Set();
    for (const it of cookable) {
      const base = it.base || (lookupFood(it.name) || {}).en || it.name;
      const key = norm(base).replace(/ /g, "_");
      if (!key || seen.has(key)) continue; seen.add(key);
      seeds.push({ key, label: base, expiry: it.expiry });
      if (seeds.length >= (max || 6)) break;
    }
    return seeds;
  }

  const api = { CATS, UNITS, CAT_DAYS, CAT_LOC, FOOD, norm, lookupFood, guess, parseQuantity, mapOFF, groupRows, parseReceipt, toCSV, parseCSV, csvToItems, normDate, matchHeaders, mapCategory, mealIngredients, scoreMeal, dietOk, recipeSeeds, ingredientMatches, titleCase };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.KL = api;
})(typeof window !== "undefined" ? window : globalThis);
