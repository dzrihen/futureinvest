/* FutureInvest – תוכנית פעולה אישית. מבוסס כללים, דטרמיניסטי, מחושב מחדש בכל הצגה מתוך התיק, המחירים, הנדל"ן והפרופיל. אומדן – לא ייעוץ. */
"use strict";
TABS.splice(1, 0, ["plan", "תוכנית פעולה"]);
const PL = {
  themes: {
    "ARK – חדשנות": ["ARKK", "ARKG", "ARKF", "ARKX", "ARKQ", "ARKW"],
    "אורניום וגרעין": ["URA", "NLR", "URNM"],
    "אנרגיה נקייה": ["ICLN", "TAN", "QCLN", "PBW", "JEDI"],
    "מוליכים למחצה": ["SMH", "SOXQ", "SOXX", "5127329"],
    "סייבר": ["CIBR", "HACK", "BUG"],
    "ענן ודאטה": ["SKYY", "CLOU", "WCLD", "DTCR"],
    "זהב, כסף ומתכות": ["GOAU", "GLD", "IGLD", "SLVP", "IAU", "GDX", "ICOP", "COPX"],
    "רובוטיקה ובינה מלאכותית": ["BOTZ", "ROBO", "KOID", "AIQ", "SNSR", "QTUM", "IRBO"],
    "רכב חשמלי ואוטונומי": ["DRIV", "IDRV", "KARS"],
    "נאסד\"ק / צמיחה גדולה": ["QQQ", "QQQM", "QTEC", "SCHG", "VUG", "MAGS", "5124532", "CNDX", "EQQQ"],
    "מטאברס וגיימינג": ["METV", "ESPO", "HERO"],
    "ביטחון וחלל": ["ITA", "EUAD", "ARKX", "UFO", "XAR"],
  },
  lev: { TQQQ: "ממונפת פי 3 על נאסד\"ק – דעיכת מינוף יומית", SQQQ: "שורט ממונף פי 3", UPRO: "ממונפת פי 3 על S&P 500", SOXL: "ממונפת פי 3 על שבבים", TECL: "ממונפת פי 3", SPXL: "ממונפת פי 3", QLD: "ממונפת פי 2", SSO: "ממונפת פי 2", USO: "חוזים עתידיים על נפט – עלות גלגול (contango)", UNG: "חוזים עתידיים על גז – עלות גלגול", UVXY: "חוזי VIX – דעיכה מובנית", VXX: "חוזי VIX – דעיכה מובנית" },
  ucits: { VOO: "CSPX", IVV: "CSPX", SPY: "CSPX", SPYM: "CSPX", VTI: "CSPX / VWRA", SCHB: "CSPX / VWRA", VTHR: "CSPX / VWRA", QQQ: "CNDX / EQQQ", QQQM: "CNDX / EQQQ", QTEC: "CNDX", VT: "VWRA", URTH: "IWDA / SWDA", SCHD: "VHYL (Vanguard FTSE All-World High Dividend UCITS)", VYM: "VHYL", SMH: "SEMI (iShares MSCI Global Semiconductors UCITS)", SOXX: "SEMI", SOXQ: "SEMI", SCHG: "CNDX / IUSG", VUG: "CNDX / IUSG", IEV: "IMEU (iShares Core MSCI Europe UCITS)", ICLN: "INRG (iShares Global Clean Energy UCITS)", TAN: "INRG", URA: "URNU (Global X Uranium UCITS)", NLR: "URNU", GLD: "SGLN / IGLN (זהב פיזי UCITS)", IAU: "SGLN", GOAU: "GDGB (VanEck Gold Miners UCITS)", CIBR: "ISPY / LOCK (סייבר UCITS)", SKYY: "WCLD UCITS / SKYY UCITS (First Trust)", CLOU: "WCLD UCITS", BOTZ: "RBOT (iShares Automation & Robotics UCITS)", ROBO: "RBOT", AIQ: "AIAG / RBOT", XLE: "IUES (S&P 500 Energy UCITS)", ITA: "DFNS (VanEck Defense UCITS)", EUAD: "DFNS", IXN: "IUIT / XDWT (טכנולוגיה UCITS)", DRIV: "ECAR (iShares Electric Vehicles UCITS)", IDRV: "ECAR", VEA: "IWDA (ללא ארה\"ב: EXUS)", VWO: "EIMI", IEMG: "EIMI", VXUS: "VWRA / EXUS" },
  nonUS: new Set(["CSPX", "SXR8", "VUAA", "VWRA", "VWCE", "IWDA", "EIMI", "CNDX", "EQQQ", "SWDA", "VANGMSA", "SGLN", "IGLN", "INRG", "SEMI", "VHYL"]),
  ter: { ARKK: .75, ARKG: .75, ARKF: .75, ARKX: .75, URA: .69, NLR: .61, ICLN: .41, TAN: .67, SMH: .35, SOXQ: .19, CIBR: .6, SKYY: .6, CLOU: .68, GOAU: .6, GLD: .4, SLVP: .39, BOTZ: .68, ROBO: .95, KOID: .69, AIQ: .68, SNSR: .68, QTUM: .4, DRIV: .68, IDRV: .47, METV: .59, ESPO: .56, ITA: .4, TQQQ: .84, USO: .6, DTCR: .5, JEDI: .69, QTEC: .57, MAGS: .29, SCHB: .03, VTHR: .1, SPYM: .02, ICOP: .47, IXN: .41, IEV: .61, SPMO: .13, ION: .58, OPPJ: .5, EUAD: .5, IVEP: .5, IGLD: .25 },
  cashTarget: { "נמוך": 2, "בינוני": 5, "גבוה": 10 },
};
const PRI = { 3: ["גבוהה", "bad"], 2: ["בינונית", "warn"], 1: ["נמוכה", "info"] };
const ilsV = h => valueUSD(h) * fx();
function costILS(h) { if (!h.qty || !h.buyPrice) return null; return h.qty * h.buyPrice * (h.buyFx || (h.buyCur === "ILS" ? 1 : fx())); }
function gainOf(h) { const c = costILS(h), v = ilsV(h); return c == null ? null : { cost: c, v, g: v - c, gp: (v / c - 1) * 100, tax: Math.max(0, v - c) * FI_RULES.capGains.rate }; }
function situsUS(h) {
  if (h.type === "cash" || /^\d+$/.test(h.sym) || h.sym.endsWith(".TA") || PL.nonUS.has(h.sym)) return false;
  const m = etfMeta(h.sym); if (m) return m.dom === 'ארה"ב';
  if (D.sec?.s[h.sym]) return usSitusOf(h);
  return /^[A-Z]{1,5}$/.test(h.sym); // טיקר אמריקאי שלא במאגר – הנחה
}
function estateTax(x) { // IRC §2001(c) לוח מדורג, פחות זיכוי מאוחד לזר 13,000$ (שווה ל־60,000$)
  const B = [[0, 0, .18], [10e3, 1800, .20], [20e3, 3800, .22], [40e3, 8200, .24], [60e3, 13000, .26], [80e3, 18200, .28], [100e3, 23800, .30], [150e3, 38800, .32], [250e3, 70800, .34], [500e3, 155800, .37], [750e3, 248300, .39], [1e6, 345800, .40]];
  let t = 0; for (const [lo, base, r] of B) if (x > lo) t = base + (x - lo) * r; return Math.max(0, t - 13000);
}
const nI = x => (x < 0 ? "−" : "") + "₪" + Math.abs(Math.round(x)).toLocaleString("he-IL");

async function buildPlan() {
  const H = S.holdings, p = P(), recs = [], ctx = {};
  if (!H.length) return { recs, ctx };
  const L = await lookThrough(), totU = L.tot, tot = totU * fx(); ctx.tot = tot;
  const w = h => ilsV(h) / tot * 100;
  // 1. איחוד לוויינים לפי נושא
  const groups = {};
  for (const [th, list] of Object.entries(PL.themes)) { const hs = H.filter(h => list.includes(h.sym) && h.role !== "core"); if (hs.length >= 2) groups[th] = hs; }
  const small = H.filter(h => h.role === "sat" && h.type !== "cash" && w(h) < 1);
  for (const [th, hs] of Object.entries(groups)) {
    const rows = hs.map(h => ({ h, w: w(h), g: gainOf(h) })).sort((a, b) => b.w - a.w), keep = rows[0], sell = rows.slice(1);
    const tax = sell.reduce((a, r) => a + (r.g?.tax || 0), 0), loss = sell.reduce((a, r) => a + Math.min(0, r.g?.g || 0), 0), val = sell.reduce((a, r) => a + (r.g?.v ?? ilsV(r.h)), 0);
    let ov = ""; const A = await etfHold(keep.h.sym);
    for (const r of sell) { const o = overlap(A, await etfHold(r.h.sym)); if (o != null) ov += ` חפיפה ${keep.h.sym}↔${r.h.sym}: ${pct(o, 0)}.`; }
    recs.push({ id: "theme:" + th, cat: "איחוד לוויינים", pr: sell.length >= 2 || loss < 0 ? 2 : 1, title: `איחוד נושא "${th}": להשאיר ${keep.h.sym} ולאחד אליו ${sell.map(r => r.h.sym).join(", ")}`,
      why: `${rows.length} קרנות באותו נושא, יחד ${pct(rows.reduce((a, r) => a + r.w, 0), 2)} מהתיק: ${rows.map(r => `${r.h.sym} ${pct(r.w, 2)}${r.g ? ` (${r.g.gp >= 0 ? "+" : ""}${pct(r.g.gp, 0)})` : ""}`).join(" · ")}.${ov}`,
      impact: `פחות ${sell.length} פוזיציות למעקב, אותה חשיפה נושאית (${nI(val)} עוברים לקרן אחת).`,
      tax: loss < 0 ? `מכירת הקרנות בהפסד יוצרת הפסד הון של כ־${nI(-loss)} לקיזוז מול רווחים (חיסכון של עד ${nI(-loss * .25)}). מס משוער על הרווחיות: ${nI(tax)}.` : `מס רווח הון משוער (25% נומינלי, בפועל על הרווח הריאלי): ${nI(tax)}.` });
  }
  const losers = H.filter(h => h.type !== "cash").map(h => ({ h, g: gainOf(h) })).filter(r => r.g && r.g.g < 0).sort((a, b) => a.g.g - b.g.g);
  if (losers.length) { const tl = losers.reduce((a, r) => a + r.g.g, 0);
    recs.push({ id: "tlh", cat: "מס", pr: tl < -20000 ? 3 : 2, title: `קצירת הפסדים: ${losers.length} ניירות בהפסד (סה"כ ${nI(tl)})`,
      why: losers.slice(0, 8).map(r => `${r.h.sym} ${nI(r.g.g)} (${pct(r.g.gp, 0)})`).join(" · "),
      impact: `מימוש ההפסד מקזז רווחי הון באותה שנה – חיסכון מס של עד ${nI(-tl * .25)}. אפשר לקנות מיד חלופה דומה (בישראל אין כלל wash-sale כמו בארה"ב – לאמת מול רו"ח).`,
      tax: "ההפסד מקוזז מול רווח הון ממומש באותה שנת מס; עודף מועבר לשנים הבאות רק אם מדווחים בדוח שנתי." }); }
  if (small.length >= 8) recs.push({ id: "small", cat: "איחוד לוויינים", pr: 2, title: `${small.length} פוזיציות לוויין קטנות (מתחת ל־1% כל אחת)`,
    why: `יחד ${pct(small.reduce((a, h) => a + w(h), 0), 1)} מהתיק: ${small.map(h => h.sym).join(", ")}.`, impact: "פיזור מדומה – כל אחת זניחה לתשואה אבל מוסיפה מעקב, עמלות ודוחות מס. שקול 3–5 רעיונות לוויין בגודל משמעותי.", tax: "להתחיל מאלה שבהפסד או ברווח קטן." });
  // 2. מס עיזבון
  const us = H.filter(situsUS), usU = us.reduce((a, h) => a + valueUSD(h), 0), et = estateTax(usU);
  ctx.estate = { usU, et };
  if (usU > FI_RULES.usEstate.exemptionUSD * .8) {
    const sw = us.map(h => ({ h, g: gainOf(h), u: PL.ucits[h.sym] })).filter(r => r.u).sort((a, b) => (a.g?.gp ?? 999) - (b.g?.gp ?? 999));
    const cheap = sw.filter(r => r.g && r.g.gp < 15);
    recs.push({ id: "estate", cat: "מס עיזבון", pr: usU > 250e3 ? 3 : 2, title: `מס עיזבון אמריקאי: ${money(usU, "USD")} בנכסים אמריקאיים – מס משוער ${money(et, "USD")}`,
      why: `פטור לזר: ${money(60000, "USD")}. מעל זה מדרגות 18%–40%. הגדולים: ${us.sort((a, b) => valueUSD(b) - valueUSD(a)).slice(0, 6).map(h => `${h.sym} ${money(valueUSD(h), "USD")}`).join(" · ")}.`,
      impact: `1) כל קנייה חדשה – במקבילה UCITS: ${sw.slice(0, 6).map(r => `${r.h.sym}→${r.u}`).join(" · ")}. 2) החלפה הדרגתית של מגרשים ברווח נמוך: ${cheap.length ? cheap.slice(0, 6).map(r => `${r.h.sym} (${pct(r.g.gp, 0)})`).join(", ") : "אין כרגע ניירות עם רווח נמוך מ־15%"}. מניות בודדות (NVDA, AAPL וכו') אין להן מקבילה – ביטוח חיים בגובה המס הוא חלופה.`,
      tax: `החלפת כל הניירות שיש להם מקבילה תעלה מס רווח הון של כ־${nI(sw.reduce((a, r) => a + (r.g?.tax || 0), 0))} – לכן להתחיל מקניות חדשות ומניירות בהפסד.` });
  }
  // 3. ריכוזיות
  for (const c of L.comp.slice(0, 12)) { if (String(c.k).startsWith("CASH")) continue;
    if (c.p > p.maxSingle * .7) recs.push({ id: "single:" + (c.t || c.k), cat: "ריכוזיות", pr: c.p > p.maxSingle ? 3 : 1, title: `${esc(c.n)}: ${pct(c.p, 1)} מהתיק בחשיפה אמיתית (תקרה ${p.maxSingle}%)`,
      why: `דרך: ${Object.entries(c.via).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${esc(k)} ${pct(v / totU * 100, 1)}`).join(" · ")}.`,
      impact: c.p > p.maxSingle ? `הפחתה לתקרה = ${money((c.p - p.maxSingle) / 100 * totU)} פחות חשיפה.` : `קרוב לתקרה – לא להוסיף ישירות; הפקדות לקרנות רחבות ידללו בהדרגה.`, tax: "דילול דרך הפקדות לא יוצר אירוע מס." }); }
  for (const [s, , pw] of L.sec) if (pw > p.maxSector && !["לא מסווג", "מזומן/אחר"].includes(s)) recs.push({ id: "sector:" + s, cat: "ריכוזיות", pr: 2, title: `סקטור ${esc(s)}: ${pct(pw)} (תקרה ${p.maxSector}%)`, why: "חישוב דרך שקיפות הקרנות.", impact: "להפנות הפקדות לקרן עולמית רחבה / סקטורים אחרים.", tax: "ללא מכירה – ללא מס." });
  const usC = L.cty.find(r => r[0] === "US")?.[2] || 0, usd = L.cur.find(r => r[0] === "USD")?.[2] || 0;
  if (usC > 70) recs.push({ id: "country:US", cat: "ריכוזיות", pr: 1, title: `ארה"ב ${pct(usC)} מהחשיפה הגאוגרפית`, why: `משקל ארה"ב במדד העולמי כ־65%–70%. חשיפה לדולר: ${pct(usd)}.`, impact: "הפקדות עתידיות לקרן עולמית/ללא ארה\"ב (VWRA, EXUS, EIMI) יאזנו.", tax: "ללא מס." });
  const T = typeof reTotals === "function" ? reTotals() : null;
  if (T && RE().length) { const nw = tot + T.equity, rp = T.equity / nw * 100; ctx.re = { rp, nw };
    if (rp > 50) recs.push({ id: "re-share", cat: "ריכוזיות", pr: rp > 65 ? 2 : 1, title: `נדל"ן ${pct(rp)} מההון נטו`, why: `הון בנדל"ן ${nI(T.equity)} מתוך ${nI(nw)}.`, impact: "נכס לא נזיל ומרוכז בישראל – לשקול שהפקדות חדשות ילכו לתיק הנזיל.", tax: "—" }); }
  // 4. איזון ליבה/לוויין
  const coreW = H.filter(h => h.role === "core").reduce((a, h) => a + ilsV(h), 0) / tot * 100, cashW = H.filter(h => h.type === "cash" || h.sym === "5136866").reduce((a, h) => a + ilsV(h), 0) / tot * 100;
  const satW = 100 - coreW - cashW; ctx.mix = { coreW, satW, cashW };
  if (satW > p.satTotal + 2) { const ex = (satW - p.satTotal) / 100 * tot, need = ex / (p.satTotal / 100);
    recs.push({ id: "rebal", cat: "איזון", pr: satW > p.satTotal * 1.5 ? 3 : 2, title: `לוויין ${pct(satW)} מול יעד ${p.satTotal}% – חריגה של ${nI(ex)}`,
      why: `ליבה ${pct(coreW)} · לוויין ${pct(satW)} · מזומן ${pct(cashW)}.`, impact: `איזון בלי מכירה: להפנות את כל ההפקדות לליבה – נדרשות הפקדות של כ־${nI(need)} עד שהלוויין יירד ליעד. איזון עם מכירה: למכור ${nI(ex)} מהלוויינים, קודם מאלה שבהפסד.`, tax: "מכירה ממשת רווח – ראה את מחשבון המכירה בלשונית המס." }); }
  // 5. מינוף, מזומן, עמלות
  for (const h of H.filter(h => PL.lev[h.sym])) { const g = gainOf(h); recs.push({ id: "lev:" + h.sym, cat: "סיכון", pr: 2, title: `${h.sym}: ${PL.lev[h.sym]}`, why: `${pct(w(h), 2)} מהתיק${g ? `, ${g.gp >= 0 ? "רווח" : "הפסד"} ${pct(g.gp, 0)}` : ""}. לא מתאים להחזקה ארוכה לפי המדיניות שלך.`, impact: "לסגור או להגביל בגודל ובזמן.", tax: g ? (g.g < 0 ? `הפסד ${nI(g.g)} לקיזוז.` : `מס משוער ${nI(g.tax)}.`) : "—" }); }
  const ct = PL.cashTarget[p.liquidity] ?? 5;
  if (cashW > ct * 2) recs.push({ id: "cash", cat: "מזומן", pr: 1, title: `מזומן וכספית ${pct(cashW)} מול יעד ${ct}%`, why: `${nI(cashW / 100 * tot)} לא מושקעים.`, impact: `השקעת העודף (${nI((cashW - ct) / 100 * tot)}) בליבה – ראה מחשבון ההפקדה.`, tax: "ללא." });
  let tw = 0, known = 0; const pricey = [];
  for (const h of H) { if (h.type === "cash") continue; const t = etfMeta(h.sym)?.ter ?? PL.ter[h.sym]; if (t == null) continue; tw += t * ilsV(h); known += ilsV(h); if (t >= .5 && w(h) > .1) pricey.push([h.sym, t]); }
  ctx.ter = known ? tw / known : null;
  if (pricey.length >= 3) recs.push({ id: "fees", cat: "עמלות", pr: 1, title: `${pricey.length} קרנות עם דמי ניהול 0.5% ומעלה`, why: `${pricey.sort((a, b) => b[1] - a[1]).map(([s, t]) => `${s} ${t}%`).join(" · ")}. ממוצע משוקלל בקרנות המוכרות: ${pct(ctx.ter, 2)}.`, impact: "באיחוד נושאים – להשאיר את הזולה מבין החלופות.", tax: "—" });
  recs.forEach(r => r.score = r.pr * 10 + (r.cat === "מס עיזבון" ? 3 : r.cat === "מס" ? 2 : 0));
  recs.sort((a, b) => b.score - a.score);
  return { recs, ctx, L };
}
function depositPlan(amt, ctx) {
  const p = P(), tot = ctx.tot, T = tot + amt, out = [];
  const coreT = 100 - p.satTotal, ct = PL.cashTarget[p.liquidity] ?? 5;
  const cores = S.holdings.filter(h => h.role === "core" && !situsUS(h)).sort((a, b) => ilsV(b) - ilsV(a));
  const def = { core: Math.max(0, coreT / 100 * T - ctx.mix.coreW / 100 * tot), sat: Math.max(0, p.satTotal / 100 * T - ctx.mix.satW / 100 * tot) };
  const sum = def.core + def.sat || 1; let coreA = amt * def.core / sum, satA = amt - coreA;
  const names = cores.length ? cores.slice(0, 2).map(h => h.sym) : ["VWRA"];
  if (names.length === 2) { out.push([names[0], coreA * .7, "ליבה UCITS – הקרן הגדולה שלך"], [names[1], coreA * .3, "ליבה UCITS"]); } else out.push([names[0], coreA, "ליבה UCITS"]);
  if (satA > 1) out.push(["לוויין (לבחירתך, רק UCITS)", satA, "התיק מתחת ליעד הלוויין"]);
  const nc = Math.round((ctx.mix.coreW / 100 * tot + coreA) / T * 1000) / 10;
  return { out, nc, ct };
}
VIEWS.plan = async m => {
  if (!S.holdings.length) { m.innerHTML = '<h1>תוכנית פעולה</h1><div class="card"><p>הוסף אחזקות בלשונית "התיק שלי" כדי לקבל תוכנית מותאמת.</p></div>'; return; }
  const { recs, ctx } = await buildPlan(), p = P();
  // מעקב שינויים
  const cur = Object.fromEntries(recs.map(r => [r.id, r.title])), prev = S.planSeen;
  if (!prev || JSON.stringify(Object.keys(prev.items).sort()) !== JSON.stringify(Object.keys(cur).sort())) {
    if (prev) S.planDiff = { at: prev.at, added: Object.keys(cur).filter(k => !prev.items[k]), resolved: Object.entries(prev.items).filter(([k]) => !cur[k]).map(([, t]) => t) };
    S.planSeen = { at: new Date().toISOString(), items: cur }; save();
  }
  const df = S.planDiff, isNew = id => df?.added.includes(id);
  const dep = S.planDep || 10000;
  m.innerHTML = `<h1>תוכנית פעולה אישית</h1>
  <div class="alert warn">כל ההמלצות הן ${tag("est")} שמחושבות אוטומטית מהתיק, מהמחירים העדכניים ומהפרופיל שלך – לא ייעוץ השקעות או מס. מס מחושב נומינלית (25%); בפועל המס על הרווח הריאלי. ${esc(FI_RULES.disclaimer)}</div>
  <div class="grid g4"><div class="card kpi"><div class="l">פעולות פתוחות</div><div class="v">${recs.length}</div><div class="muted">${recs.filter(r => r.pr === 3).length} בעדיפות גבוהה</div></div>
   <div class="card kpi"><div class="l">ליבה / לוויין / מזומן</div><div class="v small">${pct(ctx.mix.coreW, 0)} / ${pct(ctx.mix.satW, 0)} / ${pct(ctx.mix.cashW, 0)}</div><div class="muted">יעד לוויין ${p.satTotal}%</div></div>
   <div class="card kpi"><div class="l">מס עיזבון משוער</div><div class="v">${money(ctx.estate.et, "USD")}</div><div class="muted">על ${money(ctx.estate.usU, "USD")} אמריקאי</div></div>
   <div class="card kpi"><div class="l">דמי ניהול משוקללים</div><div class="v">${pct(ctx.ter, 2)}</div><div class="muted">בקרנות עם נתון</div></div></div>
  ${df && (df.added.length || df.resolved.length) ? `<div class="card" style="margin-top:14px"><h2>מה השתנה מאז ${ilTime(df.at)}</h2>${df.added.map(id => `<div class="alert info">חדש: ${esc(cur[id] || id)}</div>`).join("")}${df.resolved.map(t => `<div class="alert ok">טופל / נפתר: ${esc(t)}</div>`).join("")}</div>` : ""}
  <div class="card" style="margin-top:14px"><h2>לאן להפנות את ההפקדה הבאה</h2>
   <div class="row"><label>סכום (₪) <input id="depA" type="number" min="0" step="1000" value="${dep}"></label><button class="btn" id="depGo">חשב</button></div><div id="depOut"></div>
   <p class="small muted">קנייה בלבד, בלי מכירות: מחלק את הסכום לפי הפער מיעד הליבה/לוויין, ורק לקרנות UCITS (בלי להגדיל את חשיפת מס העיזבון).</p></div>
  <div class="card" style="margin-top:14px"><h2>לפני כל פעולה – רשימת בדיקה</h2>
   <label><input type="checkbox" class="ck"> אני לא פועל בגלל ירידה/עלייה של השבוע האחרון</label><br><label><input type="checkbox" class="ck"> בדקתי את עלות המס (מחשבון המכירה בלשונית המס)</label><br>
   <label><input type="checkbox" class="ck"> הפעולה תואמת את המדיניות שכתבתי</label><br><label><input type="checkbox" class="ck"> מכירה גדולה אחרי ירידה חדה – עוברת 48 שעות צינון</label>
   <p class="small muted">כפתור "בוצע" ליד כל המלצה נפתח רק אחרי סימון כל הסעיפים, ונרשם ביומן ההחלטות.</p></div>
  <div style="margin-top:14px">${recs.map((r, i) => `<div class="card" style="margin-bottom:10px"><div class="row" style="justify-content:space-between"><b>${i + 1}. ${r.title}</b><span><span class="tag ${PRI[r.pr][1] === "bad" ? "stale" : "est"}">עדיפות ${PRI[r.pr][0]}</span> ${isNew(r.id) ? '<span class="tag fact">חדש</span>' : ""} <span class="muted small">${r.cat}</span></span></div>
    <p><b>למה:</b> ${r.why}</p><p><b>השפעה משוערת:</b> ${r.impact}</p><p class="small"><b>מס:</b> ${r.tax}</p><button class="btn sec done" data-id="${esc(r.id)}" disabled>בוצע – לרשום ביומן</button></div>`).join("") || '<div class="alert ok">אין המלצות פתוחות – התיק תואם לכללים שלך.</div>'}</div>`;
  const calc = () => { const a = +$("#depA").value || 0; S.planDep = a; save(); const d = depositPlan(a, ctx);
    $("#depOut").innerHTML = `<table class="tbl">${d.out.map(([s, v, n]) => `<tr><td>${esc(s)}</td><td class="n">${nI(v)}</td><td class="small muted">${n}</td></tr>`).join("")}</table><p class="small">אחרי ההפקדה: ליבה ${pct(d.nc)}.</p>`; };
  $("#depGo").onclick = calc; calc();
  const upd = () => { const ok = $$(".ck", m).every(c => c.checked); $$(".done", m).forEach(b => b.disabled = !ok); };
  $$(".ck", m).forEach(c => c.onchange = upd);
  $$(".done", m).forEach(b => b.onclick = () => { const r = recs.find(x => x.id === b.dataset.id); S.journal.unshift({ id: uid(), date: today(), action: "תוכנית פעולה: " + r.title.replace(/<[^>]+>/g, ""), why: "בוצע אחרי רשימת בדיקה", review: new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10) }); save(); b.textContent = "נרשם ביומן ✓"; b.disabled = true; });
};
const _dashP = VIEWS.dash;
VIEWS.dash = async m => {
  await _dashP(m); if (!S.holdings.length) return;
  const { recs } = await buildPlan(); if (!recs.length) return;
  $("h1", m).insertAdjacentHTML("afterend", `<div class="card" style="margin-bottom:14px"><h2>3 הפעולות החשובות ${tag("est")}</h2>${recs.slice(0, 3).map(r => `<div class="alert ${PRI[r.pr][1]}">${r.title}</div>`).join("")}<a href="#plan" id="toPlan">לתוכנית הפעולה המלאה ←</a></div>`);
  $("#toPlan").onclick = e => { e.preventDefault(); tab = "plan"; history.replaceState(null, "", "#plan"); go(); };
};
