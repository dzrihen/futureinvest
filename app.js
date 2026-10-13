/* FutureInvest – שלב 1. כל החישובים בדפדפן, נתונים מחושבים מראש ב-data/. */
"use strict";
const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const KEY = "futureinvest.v1";
const DEF = {
  profile: { horizon: 20, goal: "חיסכון לטווח ארוך / עצמאות כלכלית", goalAmount: 3000000, initial: 200000, monthly: 3000, lossTol: 30, liquidity: "נמוך", taxRes: "ישראל",
    pref: "mix", maxSingle: 10, maxSector: 35, satTotal: 20, satIdea: 5, equityPct: 90, bigSalePct: 10, inflation: 2.5 },
  holdings: [], policy: "1. לא מוכרים בפאניקה – כל מכירה גדולה עוברת 48 שעות צינון.\n2. ליבה בקרנות מדד זולות ורחבות; לווין עד 20% מהתיק ועד 5% לרעיון.\n3. בודקים כל השקעה מחדש פעם בשנה, לא כל יום.",
  journal: [], watch: [], pending: [], saved: null
};
let S = load();
let D = { meta: null, sec: null, prices: null, etf: {} };
let charts = {};
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s) return { ...structuredClone(DEF), ...s, profile: { ...DEF.profile, ...(s.profile || {}) } }; } catch (e) {} return structuredClone(DEF); }
function save() { S.saved = new Date().toISOString(); localStorage.setItem(KEY, JSON.stringify(S)); }
const P = () => S.profile;
const fx = () => D.meta?.fx?.usdils || 3.7;
const cur = () => $("#dispCur").value;
function money(usd, c = cur(), dec = 0) {
  if (usd == null || isNaN(usd)) return "—";
  const v = c === "ILS" ? usd * fx() : usd;
  return (c === "ILS" ? "₪" : "$") + Math.round(v).toLocaleString("he-IL", { maximumFractionDigits: dec });
}
const pct = (x, d = 1) => x == null || isNaN(x) ? "—" : (Math.round(x * 10 ** d) / 10 ** d).toLocaleString("he-IL") + "%";
const sgn = x => x == null ? "" : x >= 0 ? "pos" : "neg";
const tag = (k) => k === "fact" ? '<span class="tag fact">עובדה</span>' : k === "stale" ? '<span class="tag stale">לא עדכני</span>' : '<span class="tag est">אומדן</span>';
const src = (s, d) => `<div class="src">מקור: ${esc(s)}${d ? " · נכון ל־" + esc(d) : ""}</div>`;
const ilTime = s => { const d = new Date(String(s).replace(" UTC", "Z").replace(" ", "T")); return isNaN(d) ? s : d.toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", dateStyle: "short", timeStyle: "short" }) + " (שעון ישראל)"; };
const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().slice(0, 10);
const COUNTRY = { US: "ארה\"ב", IL: "ישראל", GB: "בריטניה", JP: "יפן", CN: "סין", TW: "טייוואן", KR: "דרום קוריאה", IN: "הודו", DE: "גרמניה", FR: "צרפת", CH: "שווייץ", NL: "הולנד", CA: "קנדה", AU: "אוסטרליה", IE: "אירלנד", SE: "שוודיה", DK: "דנמרק", IT: "איטליה", ES: "ספרד", BR: "ברזיל", HK: "הונג קונג", SG: "סינגפור", ZA: "דרום אפריקה", SA: "ערב הסעודית", MX: "מקסיקו", KY: "איי קיימן", BM: "ברמודה", JE: "ג'רזי", LU: "לוקסמבורג", FI: "פינלנד", NO: "נורווגיה", BE: "בלגיה", "??": "לא ידוע" };
const cname = c => COUNTRY[c] || c || "לא ידוע";
const CURN = { USD: "דולר", ILS: "שקל", EUR: "אירו", GBP: "ליש\"ט", JPY: "ין", GBp: "ליש\"ט", CHF: "פרנק", CNY: "יואן", HKD: "דולר הונג קונג", TWD: "דולר טייוואני", KRW: "וון", INR: "רופי", CAD: "דולר קנדי" };

async function getJSON(u) { const r = await fetch(u, { cache: "no-cache" }); if (!r.ok) throw new Error(u + " " + r.status); return r.json(); }
async function etfHold(t) {
  const m = etfMeta(t); if (!m) return null;
  const k = m.kind === "proxy" ? m.proxy : t;
  if (!(k in D.etf)) { try { D.etf[k] = await getJSON(`data/etf/${k}.json`); } catch (e) { D.etf[k] = null; } }
  return D.etf[k];
}
const etfMeta = t => D.meta?.etfs.find(e => e.t === t);

/* ---------- holdings valuation ---------- */
// price in USD of 1 unit
function unitUSD(h) {
  const m = etfMeta(h.sym); let p, c;
  if (m && m.price) { p = m.price; c = m.cur; }
  else { const s = D.sec?.s[h.sym]; if (s && s.p) { p = s.p; c = s.cur; } }
  if (p == null) return null;
  return toUSD(p, c);
}
function toUSD(v, c) {
  if (c === "USD" || !c) return v;
  if (c === "ILS") return v / fx();
  if (c === "ILA") return v / 100 / fx(); // אגורות בבורסת ת"א
  if (c === "GBp") return v / 100 * (D.fxx?.GBP || 1.33);
  if (c === "GBP") return v * (D.fxx?.GBP || 1.33);
  if (c === "EUR") return v * (D.fxx?.EUR || 1.16);
  return v;
}
function valueUSD(h) {
  if (h.type === "cash") return h.cur === "ILS" ? h.value / fx() : h.value;
  if (h.qty) { const u = unitUSD(h); if (u != null) return u * h.qty; }
  if (h.value) return h.cur === "ILS" ? h.value / fx() : h.value;
  return 0;
}
function isETF(sym) { return !!etfMeta(sym); }
function holdingInfo(h) {
  const s = D.sec?.s[h.sym] || {};
  return { name: etfMeta(h.sym)?.n || s.n || h.sym, sector: h.sector || s.s || "לא מסווג", country: h.country || s.c || (h.sym?.endsWith(".TA") ? "IL" : "??"), cur: s.cur || h.cur };
}

/* ---------- look-through ---------- */
async function lookThrough() {
  const tot = S.holdings.reduce((a, h) => a + valueUSD(h), 0) || 1;
  const comp = {}, sec = {}, cty = {}, curx = {}, missing = [];
  const add = (k, n, t, v, s, c, cu, via) => {
    if (!comp[k]) comp[k] = { n, t, v: 0, via: {} }; comp[k].v += v; comp[k].via[via] = (comp[k].via[via] || 0) + v;
    sec[s] = (sec[s] || 0) + v; cty[c] = (cty[c] || 0) + v; curx[cu] = (curx[cu] || 0) + v;
  };
  for (const h of S.holdings) {
    const v = valueUSD(h); if (!v) continue;
    if (h.type === "cash") { add("CASH-" + h.cur, "מזומן " + (CURN[h.cur] || h.cur), null, v, "מזומן/אחר", h.cur === "ILS" ? "IL" : "US", h.cur, "ישיר"); continue; }
    if (isETF(h.sym)) {
      const H = await etfHold(h.sym);
      if (!H) { missing.push(h.sym); add("ETF-" + h.sym, h.sym + " (ללא פירוט)", h.sym, v, "לא מסווג", "??", "USD", h.sym); continue; }
      for (const x of H.h) add(x.agg ? x.k + "|" + h.sym : x.k, x.n, x.t, v * x.w / 100, x.s, x.c, x.cur, h.sym);
    } else {
      const i = holdingInfo(h), s = D.sec?.s[h.sym];
      add(s?.isin || h.sym, i.name, h.sym, v, i.sector, i.country, i.cur || "USD", "ישיר");
    }
  }
  const norm = o => Object.entries(o).map(([k, v]) => [k, v, v / tot * 100]).sort((a, b) => b[1] - a[1]);
  return { tot, comp: Object.entries(comp).filter(([k]) => !k.startsWith("REST|")).map(([k, o]) => ({ k, ...o, p: o.v / tot * 100 })).sort((a, b) => b.v - a.v),
    sec: norm(sec), cty: norm(cty), cur: norm(curx), missing };
}
function overlap(A, B) {
  if (!A || !B) return null;
  const m = {}; for (const x of A.h) if (!x.agg) m[x.k] = x.w;
  let o = 0; for (const x of B.h) if (!x.agg && m[x.k]) o += Math.min(m[x.k], x.w);
  return o;
}

/* ---------- alerts (rules, core/satellite, tax) ---------- */
async function computeAlerts() {
  const out = []; if (!S.holdings.length) return out;
  const L = await lookThrough(), p = P();
  for (const c of L.comp.slice(0, 15)) if (c.p > p.maxSingle && !String(c.k).startsWith("CASH")) out.push(["bad", `ריכוזיות: חשיפה אמיתית של ${pct(c.p)} ל־${esc(c.n)} (כולל דרך קרנות) – מעל הכלל שלך (${p.maxSingle}%).`]);
  for (const [s, , w] of L.sec) if (w > p.maxSector && !["לא מסווג", "מזומן/אחר"].includes(s)) out.push(["warn", `ריכוזיות סקטור: ${esc(s)} ${pct(w)} – מעל הכלל שלך (${p.maxSector}%).`]);
  const tot = L.tot, sat = S.holdings.filter(h => h.role === "sat");
  const satTot = sat.reduce((a, h) => a + valueUSD(h), 0) / tot * 100;
  if (satTot > p.satTotal) out.push(["bad", `לוויין: ${pct(satTot)} מהתיק בהשקעות לוויין – מעל התקרה (${p.satTotal}%).`]);
  for (const h of sat) { const w = valueUSD(h) / tot * 100; if (w > p.satIdea) out.push(["warn", `רעיון לוויין ${esc(h.sym)} מהווה ${pct(w)} – מעל ${p.satIdea}% לרעיון.`]); }
  const usSitus = S.holdings.filter(h => usSitusOf(h)).reduce((a, h) => a + valueUSD(h), 0);
  const ex = FI_RULES.usEstate.exemptionUSD;
  if (usSitus > ex * 0.8) out.push([usSitus > ex ? "bad" : "warn", `מס עיזבון אמריקאי: ${money(usSitus, "USD")} בנכסים אמריקאיים (מניות/ETF בארה"ב) ${usSitus > ex ? "– מעל" : "– קרוב ל"}פטור של ${money(ex, "USD")}. מעל הפטור שיעור המס עד 40%. כדאי לבחון קרנות איריות (UCITS). (אומדן, כלל מ־${FI_RULES.usEstate.source})`]);
  const due = S.journal.filter(j => j.review && j.review <= today() && !j.reviewed);
  if (due.length) out.push(["info", `${due.length} החלטות ביומן ממתינות לבדיקה חוזרת (תאריך בדיקה הגיע).`]);
  return out;
}
function usSitusOf(h) {
  if (h.type === "cash") return false;
  const m = etfMeta(h.sym); if (m) return m.dom === 'ארה"ב';
  const s = D.sec?.s[h.sym]; if (h.sym.endsWith(".TA")) return false;
  return (h.country || s?.c) === "US" || (!!s && !h.sym.includes("."));
}

/* ---------- UI shell ---------- */
const TABS = [["dash", "סקירה"], ["profile", "פרופיל ומדיניות"], ["port", "התיק שלי"], ["expo", "חשיפה אמיתית"], ["cmp", "השוואת ETF"], ["isr", "מיסוי למשקיע ישראלי"], ["sim", "סימולטור"], ["stress", "מבחני קיצון"], ["journal", "יומן החלטות"], ["data", "נתונים וגיבוי"]];
let tab = location.hash.slice(1) || "today";
function renderTabs() {
  $("#tabs").innerHTML = TABS.map(([k, l]) => `<button role="tab" aria-selected="${k === tab}" data-t="${k}">${l}</button>`).join("");
  $("#tabs button[aria-selected=true]")?.scrollIntoView({ block: "nearest", inline: "center" });
  $$("#tabs button").forEach(b => b.onclick = () => { tab = b.dataset.t; history.replaceState(null, "", "#" + tab); go(); });
}
async function go() {
  renderTabs(); Object.values(charts).forEach(c => c.destroy()); charts = {};
  const m = $("#main"); m.innerHTML = '<div class="loading">מחשב…</div>';
  try { await VIEWS[tab](m); } catch (e) { console.warn(e); m.innerHTML = `<div class="alert bad">שגיאה בהצגת המסך: ${esc(e.message)}</div>`; }
  m.focus?.();
}
function chart(id, cfg) {
  if (!window.Chart) return; const el = document.getElementById(id); if (!el) return;
  Chart.defaults.font.family = "Assistant, Rubik, Arial, sans-serif";
  charts[id] = new Chart(el, cfg);
}
const PAL = ["#1f5eff", "#0f8a5f", "#f2a007", "#c62828", "#7b3fe4", "#00a3bf", "#e05a9a", "#5e6b7a", "#8bc34a", "#ff7043", "#3949ab", "#26a69a"];
function doughnut(id, rows) {
  const top = rows.slice(0, 9), rest = rows.slice(9).reduce((a, r) => a + r[1], 0);
  const labels = top.map(r => r[0]).concat(rest > 0 ? ["אחר"] : []), data = top.map(r => r[1]).concat(rest > 0 ? [rest] : []);
  chart(id, { type: "doughnut", data: { labels, datasets: [{ data, backgroundColor: PAL }] }, options: { maintainAspectRatio: false, plugins: { legend: { position: "bottom", rtl: true, labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: c => `${c.label}: ${pct(c.raw / data.reduce((a, b) => a + b, 0) * 100)}` } } } } });
}

/* ---------- Dashboard ---------- */
const VIEWS = {};
VIEWS.dash = async m => {
  const L = S.holdings.length ? await lookThrough() : null, al = await computeAlerts(), p = P();
  const etfs = D.meta.etfs, bad = D.meta.log.filter(l => !l.ok).length;
  m.innerHTML = `<h1>סקירה</h1>
  <div class="grid g4">
    <div class="card kpi"><div class="l">שווי התיק ${tag("est")}</div><div class="v">${L ? money(L.tot) : "—"}</div><div class="muted">${S.holdings.length} אחזקות</div></div>
    <div class="card kpi"><div class="l">אופק השקעה</div><div class="v">${p.horizon} שנים</div><div class="muted">${esc(p.goal)}</div></div>
    <div class="card kpi"><div class="l">דולר/שקל ${tag("fact")}</div><div class="v">${fx().toFixed(3)}</div><div class="muted">${esc(D.meta.fx.src)} · ${esc(D.meta.fx.asof || "")}</div></div>
    <div class="card kpi"><div class="l">עדכון נתונים</div><div class="v small">${esc(D.meta.builtIL)}</div><div class="muted">${D.meta.log.length - bad} מקורות תקינים, ${bad} נכשלו</div></div>
  </div>
  <div class="grid g2" style="margin-top:14px">
    <div class="card"><h2>התראות והחלטות לבדיקה</h2>${al.length ? al.map(([k, t]) => `<div class="alert ${k}">${t}</div>`).join("") : `<div class="alert ok">${S.holdings.length ? "אין חריגות מהכללים שהגדרת." : "עוד לא הוזנו אחזקות. התחל בלשונית \"התיק שלי\"."}</div>`}
      ${S.pending.length ? `<h3>מכירות בתקופת צינון</h3>${S.pending.map(pendingRow).join("")}` : ""}</div>
    <div class="card"><h2>חלוקת התיק – ליבה ולוויין</h2>${L ? coreSatHTML(L.tot) : '<p class="muted">אין נתונים.</p>'}
      <h3>מצב השווקים (מגמה ארוכה) ${tag("fact")}</h3>${marketTable()}</div>
  </div>`;
  bindPending(m);
};
function coreSatHTML(tot) {
  const sat = S.holdings.filter(h => h.role === "sat").reduce((a, h) => a + valueUSD(h), 0) / tot * 100, p = P();
  return `<div class="muted">לוויין: ${pct(sat)} מתוך תקרה של ${p.satTotal}%</div><div class="bar"><i style="width:${Math.min(100, sat / p.satTotal * 100)}%;background:${sat > p.satTotal ? "var(--bad)" : "var(--pri)"}"></i></div>
  <p class="small muted">ליבה = קרנות מדד רחבות וזולות. לוויין = רעיונות ממוקדים (מניה, סקטור, נושא). את התקרות מגדירים בפרופיל.</p>`;
}
function marketTable() {
  const rows = [["VT", "מניות עולם"], ["VOO", "S&P 500"], ["QQQ", "נאסד\"ק-100"], ["VXUS", "מניות מחוץ לארה\"ב"], ["IEMG", "שווקים מתעוררים"]].map(([t, l]) => {
    const e = etfMeta(t); if (!e?.st) return ""; return `<tr><td>${l} (${t})</td><td class="n ${sgn(e.st.r1)}">${pct(e.st.r1)}</td><td class="n ${sgn(e.st.r5)}">${pct(e.st.r5)}</td><td class="n">${pct(e.st.mdd)}</td></tr>`;
  }).join("");
  return `<table class="tbl"><tr><th>מדד</th><th>שנה</th><th>5 שנים (שנתי)</th><th>ירידה מקסימלית</th></tr>${rows}</table>${src("Yahoo Finance, מחירים חודשיים מתואמים", D.meta.etfs[0]?.pasof)}`;
}

/* ---------- Profile & policy ---------- */
VIEWS.profile = async m => {
  const p = P();
  const f = (k, l, type = "number", extra = "") => `<label class="f">${l}<input data-k="${k}" type="${type}" value="${esc(p[k])}" ${extra}></label>`;
  const sel = (k, l, opts) => `<label class="f">${l}<select data-k="${k}">${opts.map(([v, t]) => `<option value="${v}" ${String(p[k]) === String(v) ? "selected" : ""}>${t}</option>`).join("")}</select></label>`;
  m.innerHTML = `<h1>פרופיל משקיע ומדיניות השקעה</h1>
  <div class="grid g2">
  <div class="card"><h2>פרופיל</h2><div class="grid g3">
    ${sel("horizon", "אופק השקעה", [3, 5, 10, 20, 30].map(y => [y, y + " שנים"]))}
    ${f("goal", "מטרה", "text")}${f("goalAmount", "יעד סכום (₪, ריאלי)")}
    ${f("initial", "סכום התחלתי (₪)")}${f("monthly", "הפקדה חודשית (₪)")}
    ${f("lossTol", "ירידה זמנית שאוכל לשאת (%)")}
    ${sel("liquidity", "צורך בנזילות", [["נמוך", "נמוך"], ["בינוני", "בינוני"], ["גבוה", "גבוה"]])}
    ${f("taxRes", "תושבות מס", "text")}
    ${sel("pref", "העדפה", [["etf", "קרנות סל"], ["stocks", "מניות"], ["mix", "שילוב"]])}
    ${f("equityPct", "שיעור מניות בתיק היעד (%)")}${f("inflation", "אינפלציה צפויה (%/שנה)", "number", 'step="0.1"')}
  </div></div>
  <div class="card"><h2>כללי התיק</h2><div class="grid g3">
    ${f("maxSingle", "מקסימום לחברה בודדת (%)")}${f("maxSector", "מקסימום לסקטור (%)")}
    ${f("satTotal", "תקרת לוויין כוללת (%)")}${f("satIdea", "תקרה לרעיון לוויין (%)")}
    ${f("bigSalePct", "מכירה \"גדולה\" מעל (% מהתיק)")}
  </div>
  <p class="small muted">הכללים נבדקים מול החשיפה האמיתית (כולל מה שמוחזק דרך קרנות). מכירה גדולה אחרי ירידה חדה מפעילה תקופת צינון של 48 שעות.</p>
  ${lossTolCheck()}</div>
  </div>
  <div class="card" style="margin-top:14px"><h2>מדיניות ההשקעה שלי (כללים בכתב)</h2>
   <textarea id="policy" rows="7">${esc(S.policy)}</textarea>
   <p class="small muted">המסמך מוצג לפני כל מכירה או קנייה ביומן ההחלטות, כדי לבדוק שההחלטה עקבית עם הכללים.</p></div>`;
  $$("[data-k]", m).forEach(i => i.onchange = () => { const v = i.type === "number" || i.tagName === "SELECT" && !isNaN(+i.value) ? +i.value : i.value; S.profile[i.dataset.k] = v; save(); go(); });
  $("#policy").onchange = e => { S.policy = e.target.value; save(); };
};
function lossTolCheck() {
  const p = P(), eq = p.equityPct / 100, worst = (D.meta.proxies.us_stocks?.crisis?.["2008"] ?? -50) * eq + (D.meta.proxies.bonds?.crisis?.["2008"] ?? -4) * (1 - eq);
  const ok = -worst <= p.lossTol;
  return `<div class="alert ${ok ? "ok" : "warn"}">בדיקת עקביות ${tag("est")}: תיק של ${p.equityPct}% מניות ירד בערך ${pct(-worst, 0)} במשבר 2008 (מבוסס על מחירי VFINX/VBMFX). ${ok ? "בתוך" : "מעבר ל"}רמת הירידה שהגדרת (${p.lossTol}%).${ok ? "" : " כדאי לשקול פחות מניות או להגדיל את הסבילות רק אם באמת לא תמכור בירידה."}</div>`;
}

/* ---------- Portfolio ---------- */
VIEWS.port = async m => {
  const tot = S.holdings.reduce((a, h) => a + valueUSD(h), 0);
  const opts = D.meta.etfs.map(e => `<option value="${e.t}">${esc(e.n)}</option>`).join("") + Object.entries(D.sec.s).slice(0, 3000).map(([k, v]) => `<option value="${esc(k)}">${esc(v.n)}</option>`).join("");
  const rows = S.holdings.map(h => {
    const v = valueUSD(h), i = holdingInfo(h), u = unitUSD(h);
    let a = null, f = null, t = null;
    if (h.buyPrice && u != null) { a = (u / toUSD(h.buyPrice, h.buyCur || "USD") - 1) * 100; }
    if (h.buyFx) f = (fx() / h.buyFx - 1) * 100;
    if (a != null && f != null) t = ((1 + a / 100) * (1 + f / 100) - 1) * 100;
    const noPrice = h.type !== "cash" && h.qty && u == null;
    return `<tr><td><b>${esc(h.sym)}</b><div class="small muted">${esc(i.name)}</div>${noPrice ? '<div class="small neg">אין מחיר – הוסף שווי ידני או טיקר לקובץ extra_tickers</div>' : ""}</td>
      <td class="n">${h.qty ?? "—"}</td><td class="n">${money(v)}</td><td class="n">${pct(v / tot * 100)}</td>
      <td><select data-role="${h.id}" aria-label="תפקיד"><option value="core" ${h.role !== "sat" ? "selected" : ""}>ליבה</option><option value="sat" ${h.role === "sat" ? "selected" : ""}>לוויין</option></select></td>
      <td class="n ${sgn(a)}">${pct(a)}</td><td class="n ${sgn(f)}">${pct(f)}</td><td class="n ${sgn(t)}">${pct(t)}</td>
      <td><button class="btn del" data-sell="${h.id}">מכירה…</button> <button class="btn del" data-del="${h.id}" aria-label="מחיקה">✕</button></td></tr>`;
  }).join("");
  m.innerHTML = `<h1>התיק שלי</h1>
  <div class="card"><h2>הוספת אחזקה</h2>
   <div class="row">
    <label class="f" style="flex:2 1 160px">טיקר / סימול<input id="aSym" list="symList" placeholder="VOO, CSPX, AAPL, TEVA.TA" autocomplete="off"></label><datalist id="symList">${opts}</datalist>
    <label class="f" style="flex:1 1 90px">סוג<select id="aType"><option value="auto">אוטומטי</option><option value="cash">מזומן</option></select></label>
    <label class="f" style="flex:1 1 90px">כמות יחידות<input id="aQty" type="number" step="any"></label>
    <label class="f" style="flex:1 1 110px">או שווי ידני<input id="aVal" type="number" step="any"></label>
    <label class="f" style="flex:1 1 80px">מטבע<select id="aCur"><option>USD</option><option>ILS</option></select></label>
    <label class="f" style="flex:1 1 90px">תפקיד<select id="aRole"><option value="core">ליבה</option><option value="sat">לוויין</option></select></label>
   </div>
   <details><summary>פרטי קנייה (להפרדת תשואת הנכס מהשפעת שער הדולר) ופרטים למניה לא מוכרת</summary><div class="row">
    <label class="f">מחיר קנייה ליחידה (במטבע הנייר)<input id="aBP" type="number" step="any"></label>
    <label class="f">שער דולר/שקל ביום הקנייה<input id="aBF" type="number" step="any"></label>
    <label class="f">סקטור (אם לא מזוהה)<input id="aSec"></label>
    <label class="f">מדינה (קוד, לדוגמה US / IL)<input id="aCty"></label></div></details>
   <div class="row" style="margin-top:8px"><button class="btn" id="aAdd">הוספה</button>
    <label class="btn sec" for="impFile">ייבוא CSV / Excel</label><input type="file" id="impFile" accept=".csv,.txt,.xlsx,.xls" class="hide">
    <span class="small muted">עמודות מזוהות: ticker/סימול, quantity/כמות, value/שווי, currency/מטבע, role/תפקיד, buy_price/מחיר קנייה, buy_fx/שער קנייה</span></div>
   <div id="impMsg"></div>
  </div>
  <div class="card" style="margin-top:14px"><h2>אחזקות</h2>
   ${S.holdings.length ? `<div class="scroll"><table class="tbl"><tr><th>נייר</th><th>כמות</th><th>שווי ${tag("est")}</th><th>משקל</th><th>תפקיד</th><th>תשואת הנכס ($)</th><th>השפעת שער</th><th>סה"כ בשקלים</th><th></th></tr>${rows}</table></div>
   <p class="small muted">שווי = כמות × מחיר אחרון (Yahoo Finance, ${esc(D.sec.asof)}) או שווי ידני. תשואה בשקלים = (1+תשואת הנכס בדולר) × (1+שינוי שער הדולר) − 1. המחיר המוצג לקרנות לונדון/גרמניה מומר לדולר בשער משוער.</p>` : '<p class="muted">אין עדיין אחזקות.</p>'}
  </div>
  ${S.holdings.length ? `<div class="grid g2" style="margin-top:14px">
   <div class="card"><h2>לפי אחזקה</h2><div class="chartbox sm"><canvas id="cH"></canvas></div></div>
   <div class="card"><h2>לפי סקטור (חשיפה אמיתית)</h2><div class="chartbox sm"><canvas id="cS"></canvas></div></div>
   <div class="card"><h2>לפי מדינה (חשיפה אמיתית)</h2><div class="chartbox sm"><canvas id="cC"></canvas></div></div>
   <div class="card"><h2>לפי מטבע הנכסים (חשיפה אמיתית)</h2><div class="chartbox sm"><canvas id="cU"></canvas></div><p class="small muted">מטבע כלכלי לפי מדינת החברה, לא מטבע המסחר. קרן אירית שנסחרת בדולר עדיין חשופה לאירו/ין דרך החברות שבה.</p></div></div>` : ""}`;
  $("#aAdd").onclick = () => {
    const sym = $("#aSym").value.trim().toUpperCase(); if (!sym && $("#aType").value !== "cash") return alert("נא להזין טיקר");
    const h = { id: uid(), sym: $("#aType").value === "cash" ? "CASH-" + $("#aCur").value : sym, type: $("#aType").value === "cash" ? "cash" : (isETF(sym) ? "etf" : "stock"),
      qty: +$("#aQty").value || null, value: +$("#aVal").value || null, cur: $("#aCur").value, role: $("#aRole").value,
      buyPrice: +$("#aBP").value || null, buyFx: +$("#aBF").value || null, sector: $("#aSec").value || null, country: ($("#aCty").value || "").toUpperCase() || null };
    if (!h.qty && !h.value) return alert("נא להזין כמות או שווי");
    if (h.type === "etf" && !$("#aRole").dataset.touched) h.role = coreDefault(sym) ? "core" : "sat";
    S.holdings.push(h); save(); go();
  };
  $("#aRole").onchange = e => e.target.dataset.touched = 1;
  $("#aSym").oninput = e => { const s = e.target.value.trim().toUpperCase(); if (isETF(s) && !$("#aRole").dataset.touched) $("#aRole").value = coreDefault(s) ? "core" : "sat"; };
  $$("[data-del]", m).forEach(b => b.onclick = () => { if (confirm("למחוק את האחזקה?")) { S.holdings = S.holdings.filter(h => h.id !== b.dataset.del); save(); go(); } });
  $$("[data-role]", m).forEach(s => s.onchange = () => { S.holdings.find(h => h.id === s.dataset.role).role = s.value; save(); go(); });
  $$("[data-sell]", m).forEach(b => b.onclick = () => { tab = "isr"; location.hash = "isr"; sellPrefill = b.dataset.sell; go(); });
  $("#impFile").onchange = e => importHoldings(e.target.files[0]);
  if (S.holdings.length) {
    doughnut("cH", S.holdings.map(h => [h.sym, valueUSD(h)]).sort((a, b) => b[1] - a[1]));
    const L = await lookThrough();
    doughnut("cS", L.sec.map(r => [r[0], r[1]])); doughnut("cC", L.cty.map(r => [cname(r[0]), r[1]])); doughnut("cU", L.cur.map(r => [CURN[r[0]] || r[0], r[1]]));
  }
};
const CORE = ["VOO", "IVV", "SPY", "VTI", "VT", "VXUS", "VEA", "VWO", "IEMG", "URTH", "CSPX", "SXR8", "VUAA", "VWRA", "VWCE", "IWDA", "SWDA", "VANGMSA", "EIMI"];
const coreDefault = s => CORE.includes(s);
let sellPrefill = null;

function parseCSV(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(l => l.trim());
  const d = [",", ";", "\t"].sort((a, b) => lines[0].split(b).length - lines[0].split(a).length)[0];
  const split = l => { const out = []; let cur = "", q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === d && !q) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out.map(s => s.trim()); };
  return lines.map(split);
}
async function importHoldings(file) {
  if (!file) return; let rows;
  if (/\.xlsx?$/i.test(file.name)) {
    if (!window.XLSX) await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    const wb = XLSX.read(await file.arrayBuffer()); rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true }).map(r => r.map(x => String(x ?? "").trim()));
  } else rows = parseCSV(await file.text());
  const r = importRows(rows); save();
  $("#impMsg").innerHTML = `<div class="alert ${r.bad.length ? "warn" : "ok"}">יובאו ${r.ok} שורות.${r.bad.length ? " לא יובאו: " + esc(r.bad.join(", ")) : ""}</div>`;
  setTimeout(go, 1500);
}
function importRows(rows) {
  const H = rows[0].map(h => h.toLowerCase().replace(/[\s_"]/g, ""));
  const col = (...names) => H.findIndex(h => names.some(n => h === n || h.includes(n)));
  const ci = { t: col("ticker", "symbol", "סימול", "טיקר", "נייר"), q: col("quantity", "qty", "units", "shares", "כמות"), v: col("value", "שווי"), c: col("currency", "מטבע"), r: col("role", "תפקיד"), bp: col("buyprice", "מחירקנייה", "cost"), bf: col("buyfx", "שערקנייה") };
  let ok = 0; const bad = [];
  if (ci.t < 0) return { ok, bad: ["לא נמצאה עמודת טיקר/סימול"] };
  for (const r of rows.slice(1)) {
    const sym = (r[ci.t] || "").toUpperCase().trim(); if (!sym) continue;
    const num = i => i >= 0 ? parseFloat(String(r[i] || "").replace(/[,₪$\s]/g, "")) || null : null;
    const qty = num(ci.q), value = num(ci.v);
    if (!qty && !value) { bad.push(sym); continue; }
    const c = ci.c >= 0 && /ils|₪|שקל|nis/i.test(r[ci.c]) ? "ILS" : "USD";
    const role = ci.r >= 0 && /sat|לווי/i.test(r[ci.r]) ? "sat" : ci.r >= 0 && /core|ליב/i.test(r[ci.r]) ? "core" : (isETF(sym) && coreDefault(sym) ? "core" : "sat");
    S.holdings.push({ id: uid(), sym, type: isETF(sym) ? "etf" : "stock", qty, value, cur: c, role, buyPrice: num(ci.bp), buyFx: num(ci.bf) }); ok++;
  }
  return { ok, bad };
}

/* ---------- Exposure / look-through ---------- */
VIEWS.expo = async m => {
  if (!S.holdings.length) { m.innerHTML = '<div class="card"><p>הוסף אחזקות בלשונית "התיק שלי" כדי לראות את החשיפה האמיתית.</p></div>'; return; }
  const L = await lookThrough(), p = P();
  const etfs = [...new Set(S.holdings.filter(h => isETF(h.sym)).map(h => h.sym))];
  const H = {}; for (const t of etfs) H[t] = await etfHold(t);
  const srcRows = etfs.map(t => { const e = etfMeta(t), h = H[t]; return `<tr><td>${t}</td><td>${h ? esc(h.src) : "אין נתונים"}${e.kind === "proxy" ? ` <span class="tag est">מבוסס על ${e.proxy} – אותו מדד</span>` : ""}</td><td class="n">${esc(h?.asof || "—")}</td><td class="n">${h?.count ?? "—"}</td></tr>`; }).join("");
  const comp = L.comp.slice(0, 60).map(c => `<tr><td>${esc(c.n)}${c.t ? ` <span class="muted">(${esc(c.t)})</span>` : ""}</td><td class="n ${c.p > p.maxSingle ? "neg" : ""}">${pct(c.p, 2)}</td><td class="n">${money(c.v)}</td><td class="small">${Object.entries(c.via).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${esc(k)} ${pct(v / L.tot * 100, 2)}`).join(" · ")}</td></tr>`).join("");
  const list = (rows, name, lim) => rows.map(([k, , w]) => `<tr><td>${esc(name(k))}</td><td class="n ${lim && w > lim && !["לא מסווג", "מזומן/אחר"].includes(k) ? "neg" : ""}">${pct(w)}</td><td style="width:40%"><div class="bar"><i style="width:${Math.min(100, w)}%"></i></div></td></tr>`).join("");
  let ov = "";
  if (etfs.length > 1) {
    ov = `<table class="tbl"><tr><th></th>${etfs.map(t => `<th>${t}</th>`).join("")}</tr>${etfs.map(a => `<tr><th>${a}</th>${etfs.map(b => { if (a === b) return "<td>—</td>"; const o = overlap(H[a], H[b]); return `<td class="n" style="background:rgba(198,40,40,${(o || 0) / 120})">${o == null ? "—" : pct(o, 0)}</td>`; }).join("")}</tr>`).join("")}</table>
    <p class="small muted">חפיפה = סכום המשקלים המשותפים (המינימום של כל חברה בשתי הקרנות), על בסיס 700 האחזקות הגדולות בכל קרן. 100% = אותו תיק בדיוק.</p>`;
  }
  const uncl = L.sec.find(r => r[0] === "לא מסווג");
  m.innerHTML = `<h1>חשיפה אמיתית (שקיפות דרך הקרנות)</h1>
  <div class="alert info">החשיפה מחושבת מאחזקות הקרנות כפי שדווחו, יחד עם המניות שמוחזקות ישירות. ${tag("est")} משקלי הקרנות משתנים מאז מועד הדיווח.</div>
  ${L.missing.length ? `<div class="alert warn">אין פירוט אחזקות עבור: ${esc(L.missing.join(", "))}</div>` : ""}
  <div class="grid g2">
   <div class="card"><h2>חברות – חשיפה כוללת</h2><div class="scroll"><table class="tbl"><tr><th>חברה</th><th>מהתיק</th><th>שווי</th><th>דרך</th></tr>${comp}</table></div></div>
   <div class="card"><h2>סקטורים</h2><table class="tbl">${list(L.sec, x => x, p.maxSector)}</table>
    ${uncl ? `<p class="small muted">"לא מסווג" (${pct(uncl[2])}): בעיקר חברות מחוץ לארה"ב או מחוץ ל־S&P 500. הסיווג נלקח מחברות קרנות הסקטור של State Street (סיווג GICS), שמכסות את ה־S&P 500.</p>` : ""}
    <h2>מדינות</h2><table class="tbl">${list(L.cty.slice(0, 15), cname)}</table>
    <h2>מטבעות הנכסים</h2><table class="tbl">${list(L.cur.slice(0, 10), k => CURN[k] || k)}</table></div>
  </div>
  ${ov ? `<div class="card" style="margin-top:14px"><h2>חפיפה בין הקרנות בתיק</h2>${ov}</div>` : ""}
  <div class="card" style="margin-top:14px"><h2>מקורות האחזקות</h2><table class="tbl"><tr><th>קרן</th><th>מקור</th><th>תאריך הדיווח</th><th>מספר אחזקות</th></tr>${srcRows}</table></div>`;
};

/* ---------- ETF compare ---------- */
let cmpSel = ["VOO", "CSPX", "VT"];
VIEWS.cmp = async m => {
  const E = D.meta.etfs, sel = cmpSel.filter(t => etfMeta(t));
  const H = {}; for (const t of sel) H[t] = await etfHold(t);
  const row = (l, f, k = "fact") => `<tr><th>${l} ${k ? tag(k) : ""}</th>${sel.map(t => `<td class="${/^[-\d.]/.test(String(f(etfMeta(t)))) ? "n" : ""}">${f(etfMeta(t)) ?? "—"}</td>`).join("")}</tr>`;
  const ret = k => e => e.st?.[k] != null ? `<span class="${sgn(e.st[k])}">${pct(e.st[k])}</span>` : "—";
  const amt = 100000, yrs = 20;
  m.innerHTML = `<h1>השוואת קרנות סל</h1>
  <div class="card"><div class="chips">${E.map(e => `<button class="chip ${sel.includes(e.t) ? "on" : ""}" data-c="${e.t}">${e.t}</button>`).join("")}</div><p class="small muted">בחר 2–5 קרנות.</p></div>
  <div class="card" style="margin-top:14px"><div class="scroll"><table class="tbl">
   <tr><th></th>${sel.map(t => `<th>${t}</th>`).join("")}</tr>
   ${row("שם", e => esc(e.n), "")}${row("מנפיק", e => esc(e.issuer), "")}${row("מדד", e => esc(e.index), "")}${row("ISIN", e => e.isin || "—", "")}
   ${row("מדינת התאגדות", e => e.dom, "")}${row("צבירה/חלוקה", e => e.dist === "Acc" ? "צוברת" : "מחלקת", "")}${row("שכפול", e => e.repl, "")}
   ${row("דמי ניהול (TER)", e => pct(e.ter, 2), "")}
   ${row("מטבע מסחר", e => e.cur || "—")}${row("תשואה שנה", ret("r1"))}${row("תשואה 3 שנים (שנתי)", ret("r3"))}${row("תשואה 5 שנים (שנתי)", ret("r5"))}${row("תשואה 10 שנים (שנתי)", ret("r10"))}
   ${row("ירידה מקסימלית (חודשי)", e => e.st ? pct(e.st.mdd) : "—")}${row("תנודתיות שנתית (10 ש')", e => e.st ? pct(e.st.vol) : "—")}${row("נתוני מחיר מ־", e => e.st?.since || "—")}
   ${row("מספר אחזקות", e => e.hcount ?? (e.kind === "proxy" ? "לפי " + e.proxy : "—"))}${row("תאריך אחזקות", e => e.hasof || (e.kind === "proxy" ? etfMeta(e.proxy)?.hasof + " (" + e.proxy + ")" : "—"))}
   ${row(`עלות מצטברת על ${money(amt / fx(), "ILS")} ל־${yrs} שנה`, e => money(costOver(amt / fx(), e.ter, yrs)), "est")}
  </table></div>
  <p class="small muted">פרטי זהות ודמי ניהול הוזנו ידנית מדפי המנפיקים (לאמת לפני קנייה). תשואות מחושבות ממחירים חודשיים מתואמים לדיבידנדים (Yahoo Finance), במטבע המסחר של כל קרן – קרנות באירו אינן ברות־השוואה ישירה לקרנות בדולר. ירידה מקסימלית מחושבת מנתוני סוף חודש ולכן נמוכה מהירידה היומית בפועל. עלות מצטברת מניחה 6% תשואה שנתית לפני דמי ניהול.</p></div>
  <div class="grid g2" style="margin-top:14px">
   <div class="card"><h2>צמיחה של 100 (מחיר מתואם)</h2><div class="chartbox"><canvas id="cmpC"></canvas></div>${src("Yahoo Finance – מחירים חודשיים מתואמים", D.meta.etfs[0]?.pasof)}</div>
   <div class="card"><h2>חפיפה בין הקרנות</h2>${pairOverlap(sel, H)}
    <h2>ארה"ב מול אירלנד (UCITS) – למשקיע ישראלי</h2>${usVsUcitsNote()}</div>
  </div>`;
  $$("[data-c]", m).forEach(b => b.onclick = () => { const t = b.dataset.c; cmpSel = cmpSel.includes(t) ? cmpSel.filter(x => x !== t) : cmpSel.length >= 5 ? cmpSel : [...cmpSel, t]; go(); });
  const ser = sel.map(t => ({ t, m: D.prices[t]?.m || [] })).filter(s => s.m.length);
  if (ser.length) {
    const start = ser.map(s => s.m[0][0]).sort().pop();
    const labels = ser[0].m.map(x => x[0]).filter(d => d >= start);
    const all = [...new Set(ser.flatMap(s => s.m.map(x => x[0])))].filter(d => d >= start).sort();
    chart("cmpC", { type: "line", data: { labels: all, datasets: ser.map((s, i) => { const mm = Object.fromEntries(s.m), b = mm[start] || s.m.find(x => x[0] >= start)[1]; return { label: s.t, data: all.map(d => mm[d] ? mm[d] / b * 100 : null), borderColor: PAL[i], pointRadius: 0, borderWidth: 2, spanGaps: true }; }) },
      options: { maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { rtl: true } }, scales: { x: { ticks: { maxTicksLimit: 8 } }, y: { type: "logarithmic" } } } });
  }
};
const costOver = (amt, ter, y, g = 0.06) => amt * Math.pow(1 + g, y) - amt * Math.pow((1 + g) * (1 - ter / 100), y);
function pairOverlap(sel, H) {
  const pairs = []; for (let i = 0; i < sel.length; i++) for (let j = i + 1; j < sel.length; j++) pairs.push([sel[i], sel[j], overlap(H[sel[i]], H[sel[j]])]);
  return pairs.length ? `<table class="tbl">${pairs.map(([a, b, o]) => `<tr><td>${a} ↔ ${b}</td><td class="n">${o == null ? "—" : pct(o, 0)}</td><td style="width:40%"><div class="bar"><i style="width:${o || 0}%"></i></div></td></tr>`).join("")}</table><p class="small muted">קרן UCITS מחושבת לפי האחזקות של הקרן האמריקאית שעוקבת אחרי אותו מדד (קירוב).</p>` : '<p class="muted">בחר לפחות 2 קרנות.</p>';
}
function usVsUcitsNote() {
  const R = FI_RULES;
  return `<ul class="small">
  <li><b>דיבידנדים:</b> קרן אמריקאית – ${pct(R.usDivWht.rate * 100, 0)} מס במקור בארה"ב עם W-8BEN. קרן אירית – ${pct(R.ieFundWht.rate * 100, 0)} ברמת הקרן על דיבידנדים אמריקאיים, וקרן צוברת דוחה את המס הישראלי עד המכירה.</li>
  <li><b>מס עיזבון:</b> קרן אמריקאית נחשבת נכס אמריקאי – מעל ${money(R.usEstate.exemptionUSD, "USD")} עלול לחול מס עיזבון של עד 40%. קרן אירית לא נחשבת נכס אמריקאי.</li>
  <li><b>עלויות:</b> קרנות UCITS לרוב יקרות מעט יותר בדמי ניהול ובמרווח, והמסחר בלונדון/גרמניה עשוי לעלות יותר אצל חלק מהברוקרים.</li></ul>
  <p class="small muted">${esc(R.disclaimer)} פירוט וחישוב בלשונית "מיסוי למשקיע ישראלי".</p>`;
}

/* ---------- Israeli investor module ---------- */
let fsIn = { amt: 500000, years: 20, g: 6, y: 1.4, terUS: 0.03, terIE: 0.07, terIL: 0.25, leakIL: 25, conv: 0.2 };
function fundSim(o) {
  const run = (ter, divNet, convCost, acc) => {
    let V = o.amt * (1 - convCost / 100), basis = V;
    for (let i = 0; i < o.years; i++) { const d = V * o.y / 100 * divNet; V = V * (1 + (o.g - ter) / 100) + d; if (!acc) basis += d; }
    const tax = Math.max(0, V - basis) * FI_RULES.capGains.rate; return { V, net: V - tax, tax };
  };
  const wUS = FI_RULES.usDivWht.rate, wIE = FI_RULES.ieFundWht.rate, dIEacc = 1 - wIE;
  return [
    ["קרן אמריקאית מחלקת (למשל VOO)", run(o.terUS, 1 - wUS, o.conv), `דיבידנד: ${wUS * 100}% מס במקור בארה"ב, השאר מושקע מחדש`],
    ["קרן אירית צוברת (למשל CSPX/VUAA)", run(o.terIE, dIEacc, o.conv, true), `דיבידנד: ${wIE * 100}% ברמת הקרן, השאר נצבר בלי מס ישראלי עד המכירה`],
    ["קרן אירית מחלקת", run(o.terIE, (1 - wIE) * (1 - FI_RULES.ilDiv.rate), o.conv), `15% ברמת הקרן + 25% מס ישראלי על הדיבידנד שחולק`],
    ["קרן מחקה ישראלית (בשקלים)", run(o.terIL, 1 - o.leakIL / 100, 0, true), `דליפת מס על דיבידנדים ${o.leakIL}% (הנחה), דמי ניהול גבוהים יותר, בלי המרת מט"ח`]
  ];
}
VIEWS.isr = async m => {
  const R = FI_RULES, p = P();
  const tot = S.holdings.reduce((a, h) => a + valueUSD(h), 0);
  const usSitus = S.holdings.filter(usSitusOf).reduce((a, h) => a + valueUSD(h), 0);
  const res = fundSim(fsIn), best = Math.max(...res.map(r => r[1].net));
  const ruleRow = r => `<tr><td>${esc(r.label)}</td><td class="n">${esc(r.effective)}</td><td>${r.url ? `<a href="${r.url}" target="_blank" rel="noopener">${esc(r.source)}</a>` : esc(r.source)}</td></tr>`;
  const inp = (k, l, st = "any") => `<label class="f">${l}<input data-fs="${k}" type="number" step="${st}" value="${fsIn[k]}"></label>`;
  m.innerHTML = `<h1>מיסוי ועלויות למשקיע ישראלי</h1>
  <div class="alert warn">${esc(R.disclaimer)} כל הסכומים כאן הם ${tag("est")}.</div>
  <div class="grid g2">
  <div class="card"><h2>ארה"ב מול אירלנד מול קרן ישראלית – אחרי מס ועלויות</h2>
   <div class="grid g4">${inp("amt", "סכום (₪)")}${inp("years", "שנים", 1)}${inp("g", "עליית מחיר שנתית %")}${inp("y", "תשואת דיבידנד %")}${inp("terUS", "דמי ניהול ארה\"ב %")}${inp("terIE", "דמי ניהול אירלנד %")}${inp("terIL", "דמי ניהול קרן ישראלית %")}${inp("leakIL", "דליפת מס דיבידנד בקרן ישראלית %")}${inp("conv", "עלות המרת מט\"ח חד-פעמית %")}</div>
   <table class="tbl" style="margin-top:10px"><tr><th>מבנה</th><th>שווי לפני מס</th><th>נטו אחרי מס רווח הון</th><th>פער מהטוב</th></tr>
   ${res.map(([n, r, note]) => `<tr><td>${n}<div class="small muted">${note}</div></td><td class="n">₪${Math.round(r.V).toLocaleString("he-IL")}</td><td class="n"><b>₪${Math.round(r.net).toLocaleString("he-IL")}</b></td><td class="n ${r.net < best ? "neg" : "pos"}">${r.net < best ? "−₪" + Math.round(best - r.net).toLocaleString("he-IL") : "הטוב ביותר"}</td></tr>`).join("")}</table>
   <p class="small muted">מודל מפושט: מס רווח הון 25% על רווח נומינלי במכירה בסוף התקופה (בפועל המס על רווח ריאלי ותלוי בשער), ללא מס עיזבון, ללא עמלות קנייה/מכירה ומרווחים. במקרה של פטירה – לקרן אמריקאית עלול להתווסף מס עיזבון.</p></div>
  <div class="card"><h2>מס עיזבון אמריקאי</h2>
   <div class="alert ${usSitus > R.usEstate.exemptionUSD ? "bad" : usSitus > R.usEstate.exemptionUSD * .8 ? "warn" : "ok"}">נכסים אמריקאיים בתיק: <b>${money(usSitus, "USD")}</b> מתוך ${money(tot, "USD")}. פטור לזרים: ${money(R.usEstate.exemptionUSD, "USD")}.
   ${usSitus > R.usEstate.exemptionUSD ? ` חשיפה משוערת למס עיזבון: עד ${money((usSitus - R.usEstate.exemptionUSD) * R.usEstate.maxRate, "USD")} (בשיעור מרבי 40%, בפועל מדורג).` : ""}</div>
   <p class="small">${esc(R.usEstate.label)}</p>
   <h2>מס יסף</h2><p class="small">${esc(R.surtax.label)}. ${esc(R.surtax.note)}</p>
   <h2>הכללים והמקורות</h2><table class="tbl"><tr><th>כלל</th><th>בתוקף מ־</th><th>מקור</th></tr>${[R.capGains, R.surtax, R.usDivWht, R.ieFundWht, R.ilDiv, R.usEstate].map(ruleRow).join("")}</table>
   <p class="small muted">נבדק לאחרונה: ${R.reviewed}</p></div>
  </div>
  <div class="card" style="margin-top:14px" id="sellCard"><h2>תכנון מכירה – אומדן מס, השפעת שער ובדיקת כללים</h2>${sellForm()}</div>`;
  $$("[data-fs]", m).forEach(i => i.onchange = () => { fsIn[i.dataset.fs] = +i.value; go(); });
  bindSell(m);
};
function sellForm() {
  if (!S.holdings.filter(h => h.type !== "cash").length) return '<p class="muted">אין אחזקות.</p>';
  const opts = S.holdings.filter(h => h.type !== "cash").map(h => `<option value="${h.id}" ${h.id === sellPrefill ? "selected" : ""}>${esc(h.sym)}</option>`).join("");
  return `<div class="row">
   <label class="f">נייר<select id="sH">${opts}</select></label>
   <label class="f">אחוז מהאחזקה למכירה<input id="sPct" type="number" value="100" min="1" max="100"></label>
   <label class="f">מחיר קנייה ליחידה ($)<input id="sBP" type="number" step="any"></label>
   <label class="f">שער דולר בקנייה<input id="sBF" type="number" step="any"></label>
   <label class="f">אינפלציה בישראל מאז הקנייה %<input id="sCPI" type="number" step="any" value="0"></label>
   <label class="f">הכנסה שנתית אחרת (₪, למס יסף)<input id="sInc" type="number" value="0"></label>
   <button class="btn" id="sCalc">חישוב</button></div><div id="sOut"></div>`;
}
function bindSell(m) {
  const fill = () => { const h = S.holdings.find(x => x.id === $("#sH").value); if (!h) return; $("#sBP").value = h.buyPrice || ""; $("#sBF").value = h.buyFx || ""; };
  if (!$("#sH")) return; $("#sH").onchange = fill; fill(); $("#sCalc").onclick = calcSale;
  if (sellPrefill) { $("#sellCard").scrollIntoView(); sellPrefill = null; }
}
function recentDrop(sym) {
  const k = etfMeta(sym) ? sym : "VT", s = D.prices[k]?.m; if (!s || s.length < 4) return null;
  const last = s[s.length - 1][1], mx = Math.max(...s.slice(-4).map(x => x[1])); return (last / mx - 1) * 100;
}
function calcSale() {
  const h = S.holdings.find(x => x.id === $("#sH").value), share = +$("#sPct").value / 100;
  const bp = +$("#sBP").value, bf = +$("#sBF").value, cpi = +$("#sCPI").value / 100, inc = +$("#sInc").value, R = FI_RULES;
  const v = valueUSD(h) * share, u = unitUSD(h), units = h.qty ? h.qty * share : null, F = fx();
  const out = [];
  if (!bp || !bf || !units || !u) { $("#sOut").innerHTML = '<div class="alert warn">נדרשים כמות יחידות, מחיר קנייה ושער קנייה כדי לחשב.</div>'; return; }
  const costILS = units * bp * bf, procILS = v * F, gainILS = procILS - costILS;
  const assetGainUSD = (u - bp) * units, fxPart = gainILS - assetGainUSD * F;
  const infl = costILS * cpi, real = Math.max(0, gainILS - infl);
  const tax = real * R.capGains.rate;
  const totalInc = inc + Math.max(0, gainILS), over = Math.max(0, totalInc - R.surtax.threshold);
  const capOver = Math.min(over, Math.max(0, gainILS)), sur = capOver * (R.surtax.baseRate + R.surtax.capitalExtra);
  const tot = S.holdings.reduce((a, x) => a + valueUSD(x), 0), sz = v / tot * 100, drop = recentDrop(h.sym);
  out.push(`<table class="tbl"><tr><td>תמורה משוערת</td><td class="n">₪${r0(procILS)}</td></tr><tr><td>עלות בשקלים</td><td class="n">₪${r0(costILS)}</td></tr>
   <tr><td>רווח נומינלי בשקלים</td><td class="n ${sgn(gainILS)}">₪${r0(gainILS)}</td></tr><tr><td>&nbsp;– מתוכו מעליית הנכס (בדולר, בשער היום)</td><td class="n">₪${r0(assetGainUSD * F)}</td></tr><tr><td>&nbsp;– מתוכו מהשינוי בשער הדולר</td><td class="n ${sgn(fxPart)}">₪${r0(fxPart)}</td></tr>
   <tr><td>רווח ריאלי (אחרי ${pct(cpi * 100)} אינפלציה)</td><td class="n">₪${r0(real)}</td></tr>
   <tr><th>מס רווח הון משוער (25%) ${tag("est")}</th><th class="n">₪${r0(tax)}</th></tr>
   ${sur > 0 ? `<tr><th>מס יסף משוער (${(R.surtax.baseRate + R.surtax.capitalExtra) * 100}% על החלק מעל ₪${R.surtax.threshold.toLocaleString("he-IL")}) ${tag("est")}</th><th class="n neg">₪${r0(sur)}</th></tr>` : ""}
   <tr><th>נטו אחרי מס</th><th class="n">₪${r0(procILS - tax - sur)}</th></tr></table>
   <p class="small muted">בפועל מס רווח הון על ני"ע במט"ח מחושב לפי כללים מיוחדים (חלק מהרווח מהשער יכול להיחשב "סכום אינפלציוני" פטור), קיזוז הפסדים ודמי ניהול משנים את התוצאה. לבדוק מול רו"ח.</p>`);
  if (totalInc > R.surtax.threshold * 0.9 && sur === 0) out.push(`<div class="alert warn">ההכנסה השנתית קרובה לסף מס היסף. אפשר לשקול לפצל את המכירה בין שנות מס.</div>`);
  const warn = [];
  if (h.role !== "sat") warn.push("מכירה מהליבה – המדיניות שלך מגדירה את הליבה כהחזקה לטווח ארוך.");
  if (sz >= P().bigSalePct) warn.push(`מכירה גדולה: ${pct(sz)} מהתיק (הסף שלך ${P().bigSalePct}%).`);
  if (drop != null && drop <= -10) warn.push(`ירידה חדה: ${h.sym in D.prices ? h.sym : "שוק המניות העולמי (VT)"} ירד ${pct(drop)} ב־3 החודשים האחרונים.`);
  const cooling = sz >= P().bigSalePct && drop != null && drop <= -10;
  out.push(`<h3>בדיקה מול המדיניות שלך</h3>${warn.length ? warn.map(w => `<div class="alert warn">${esc(w)}</div>`).join("") : '<div class="alert ok">לא נמצאה סתירה לכללים.</div>'}
   <details><summary>המדיניות שכתבת</summary><pre style="white-space:pre-wrap;font:inherit">${esc(S.policy)}</pre></details>
   ${cooling ? `<div class="alert bad"><b>תקופת צינון של 48 שעות.</b> זו מכירה גדולה אחרי ירידה חדה – בדיוק המצב שבו החלטות רגשיות הכי יקרות. רשום את הסיבה, וחזור אחרי 48 שעות כדי לאשר.</div>` : ""}
   <label class="f">למה אני מוכר? (נרשם ביומן)<textarea id="sWhy"></textarea></label>
   <div class="row" style="margin-top:8px"><button class="btn" id="sRec">${cooling ? "התחלת צינון 48 שעות" : "רישום ההחלטה ביומן"}</button></div>`);
  $("#sOut").innerHTML = out.join("");
  $("#sRec").onclick = () => {
    const why = $("#sWhy").value.trim(); if (!why) return alert("נא לכתוב סיבה");
    const entry = { id: uid(), date: today(), action: "מכירה", sym: h.sym, size: `${Math.round(share * 100)}% מהאחזקה (~₪${r0(procILS)})`, thesis: why, expected: "", horizon: "", exit: "", review: addMonths(today(), 12), warnings: warn };
    if (cooling) { S.pending.push({ ...entry, until: Date.now() + 48 * 3600e3 }); save(); alert("נפתחה תקופת צינון. ההחלטה מופיעה במסך הסקירה."); }
    else { S.journal.unshift(entry); save(); alert("נרשם ביומן ההחלטות."); }
    go();
  };
}
const r0 = x => Math.round(x).toLocaleString("he-IL");
const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x.toISOString().slice(0, 10); };
function pendingRow(p) {
  const left = p.until - Date.now(), ready = left <= 0;
  return `<div class="alert ${ready ? "info" : "warn"}"><b>${esc(p.action)} ${esc(p.sym)}</b> – ${esc(p.size)}<div class="small">${esc(p.thesis)}</div>
   ${ready ? `<button class="btn" data-pok="${p.id}">עדיין רוצה – לרשום ביומן</button> ` : `<span class="small">אפשר לאשר בעוד ${Math.ceil(left / 3600e3)} שעות.</span> `}<button class="btn sec" data-pno="${p.id}">ביטול המכירה</button></div>`;
}
function bindPending(m) {
  $$("[data-pok]", m).forEach(b => b.onclick = () => { const p = S.pending.find(x => x.id === b.dataset.pok); S.pending = S.pending.filter(x => x !== p); delete p.until; p.date = today(); p.cooled = true; S.journal.unshift(p); save(); go(); });
  $$("[data-pno]", m).forEach(b => b.onclick = () => { const p = S.pending.find(x => x.id === b.dataset.pno); S.pending = S.pending.filter(x => x !== p); S.journal.unshift({ ...p, until: undefined, action: "ויתור על מכירה (אחרי צינון)", date: today() }); save(); go(); });
}

/* ---------- Simulator ---------- */
let simIn = null;
function simDefaults() { const p = P(); return { initial: p.initial, monthly: p.monthly, years: p.horizon, fee: 0.15, infl: p.inflation, eq: p.equityPct, src: "us", fxDrift: 0, tax: true, crashYear: 3, crash: 40, paths: 2000 }; }
const DET = { cons: ["שמרני", 4.0, 2.0], base: ["בסיס", 6.5, 3.5], opt: ["אופטימי", 9.0, 4.5] };
function monthlyRets(sym) { const m = D.prices[sym]?.m || []; const o = {}; for (let i = 1; i < m.length; i++) o[m[i][0]] = m[i][1] / m[i - 1][1] - 1; return o; }
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function monteCarlo(o) {
  const st = monthlyRets("VFINX"), intl = monthlyRets("VGTSX"), bd = monthlyRets("VBMFX"), fxr = monthlyRets("ILS=X");
  let months = Object.keys(st).filter(k => k in bd && (o.src !== "global" || k in intl)).sort();
  const R = months.map(k => (o.src === "global" ? 0.6 * st[k] + 0.4 * intl[k] : st[k]) * o.eq / 100 + bd[k] * (1 - o.eq / 100));
  const F = Object.keys(fxr).sort().map(k => fxr[k]);
  const n = o.years * 12, rand = rng(12345), B = 12, fee = o.fee / 100 / 12, infl = Math.pow(1 + o.infl / 100, 1 / 12);
  const fx0 = fx(), yrs = []; const res = { ils: [], usd: [], realIls: [], net: [] };
  for (let y = 0; y <= o.years; y++) { yrs.push(y); res.ils.push([]); res.usd.push([]); res.realIls.push([]); }
  const finals = [];
  for (let p = 0; p < o.paths; p++) {
    let usd = o.initial / fx0, f = fx0, idx = o.initial, defl = 1, i = 0, ri = 0, fi = 0;
    res.ils[0].push(o.initial); res.usd[0].push(usd); res.realIls[0].push(o.initial);
    for (let t = 1; t <= n; t++) {
      if ((t - 1) % B === 0) { ri = Math.floor(rand() * (R.length - B)); fi = Math.floor(rand() * (F.length - B)); }
      const r = R[ri + (t - 1) % B], fr = F[fi + (t - 1) % B] + o.fxDrift / 100 / 12;
      f *= 1 + fr; usd = usd * (1 + r) * (1 - fee) + o.monthly / f; defl *= infl; idx = idx * infl + o.monthly;
      if (t % 12 === 0) { const y = t / 12; res.ils[y].push(usd * f); res.usd[y].push(usd); res.realIls[y].push(usd * f / defl); }
    }
    const V = usd * f, tax = o.tax ? Math.max(0, V - idx) * FI_RULES.capGains.rate : 0;
    finals.push((V - tax) / defl);
  }
  const q = (a, x) => { const s = [...a].sort((u, v) => u - v); return s[Math.min(s.length - 1, Math.floor(x * s.length))]; };
  const band = k => [0.1, 0.5, 0.9].map(x => res[k].map(a => q(a, x)));
  return { yrs, ils: band("ils"), usd: band("usd"), real: band("realIls"), finals, months: months.length, from: months[0], fxFrom: Object.keys(fxr).sort()[0], q };
}
function detPath(o, rs, rb, crash) {
  const r = (rs * o.eq + rb * (100 - o.eq)) / 100 / 100, mr = Math.pow(1 + r, 1 / 12) - 1, fee = o.fee / 100 / 12, fxm = Math.pow(1 + o.fxDrift / 100, 1 / 12);
  let usd = o.initial / fx(), f = fx(); const out = [o.initial];
  for (let t = 1; t <= o.years * 12; t++) { f *= fxm; usd = usd * (1 + mr) * (1 - fee) + o.monthly / f; if (crash && t === o.crashYear * 12) usd *= 1 - o.crash / 100 * o.eq / 100; if (t % 12 === 0) out.push(usd * f); }
  return out;
}
VIEWS.sim = async m => {
  const o = simIn ||= simDefaults(), p = P();
  const inp = (k, l, st = "any") => `<label class="f">${l}<input data-s="${k}" type="number" step="${st}" value="${o[k]}"></label>`;
  m.innerHTML = `<h1>סימולטור – תרחישים, לא תחזיות</h1>
  <div class="alert info">התוצאות הן ${tag("est")} שמבוססות על הנחות גלויות ועל דגימה מההיסטוריה. העבר לא מבטיח את העתיד, והטווח האמיתי של תוצאות אפשריות רחב יותר.</div>
  <div class="card"><div class="grid g4">${inp("initial", "סכום התחלתי (₪)")}${inp("monthly", "הפקדה חודשית (₪)")}${inp("years", "שנים", 1)}${inp("eq", "מניות % (השאר אג\"ח)")}${inp("fee", "דמי ניהול + עמלות %/שנה")}${inp("infl", "אינפלציה %/שנה")}${inp("fxDrift", "שינוי שנתי נוסף בשער הדולר %")}
   <label class="f">בסיס היסטורי<select data-s="src"><option value="us" ${o.src === "us" ? "selected" : ""}>מניות ארה"ב (S&P 500)</option><option value="global" ${o.src === "global" ? "selected" : ""}>60% ארה"ב / 40% בינלאומי</option></select></label>
   <label class="f">מס רווח הון 25% בסוף<select data-s="tax"><option value="1" ${o.tax ? "selected" : ""}>כן</option><option value="0" ${!o.tax ? "selected" : ""}>לא</option></select></label>
   ${inp("crash", "קריסה בתרחיש המשבר (% מניות)")}${inp("crashYear", "בשנה", 1)}</div></div>
  <div class="grid g2" style="margin-top:14px">
   <div class="card"><h2>מונטה קרלו – טווח תוצאות (₪ ריאלי)</h2><div class="chartbox"><canvas id="mcR"></canvas></div><div id="mcTxt"></div></div>
   <div class="card"><h2>מונטה קרלו – נומינלי בשקלים ובדולרים</h2><div class="chartbox"><canvas id="mcN"></canvas></div><p class="small muted">קווים: אחוזון 10 / חציון / אחוזון 90.</p></div>
   <div class="card"><h2>תרחישים קבועים (₪ נומינלי)</h2><div class="chartbox"><canvas id="det"></canvas></div><div id="detTxt"></div></div>
   <div class="card"><h2>ההנחות</h2><div id="assump" class="small"></div></div>
  </div>`;
  $$("[data-s]", m).forEach(i => i.onchange = () => { o[i.dataset.s] = i.dataset.s === "src" ? i.value : i.dataset.s === "tax" ? i.value === "1" : +i.value; go(); });
  const mc = monteCarlo(o), L = mc.yrs.map(y => "שנה " + y);
  const ds = (arr, lab, col, dash) => [0, 1, 2].map(i => ({ label: lab + [" (10%)", " (חציון)", " (90%)"][i], data: arr[i], borderColor: col, borderDash: i === 1 ? [] : (dash || [5, 4]), pointRadius: 0, borderWidth: i === 1 ? 2.5 : 1.3, fill: false }));
  const yfmt = { ticks: { callback: v => (v / 1e6).toFixed(1) + "M" } };
  chart("mcR", { type: "line", data: { labels: L, datasets: ds(mc.real, "₪ ריאלי", PAL[0]) }, options: { maintainAspectRatio: false, plugins: { legend: { rtl: true, labels: { boxWidth: 10 } } }, scales: { y: yfmt } } });
  chart("mcN", { type: "line", data: { labels: L, datasets: [...ds(mc.ils, "₪", PAL[1]), ...ds(mc.usd.map(a => a.map(x => x * fx())), "$ (בשער היום)", PAL[2], [2, 3])] }, options: { maintainAspectRatio: false, plugins: { legend: { rtl: true, labels: { boxWidth: 10 } } }, scales: { y: yfmt } } });
  const goal = p.goalAmount, prob = mc.finals.filter(x => x >= goal).length / mc.finals.length * 100;
  const dep = o.initial + o.monthly * 12 * o.years;
  $("#mcTxt").innerHTML = `<table class="tbl"><tr><td>סך ההפקדות</td><td class="n">₪${r0(dep)}</td></tr>
   <tr><td>אחרי מס, ריאלי – תרחיש חלש (10%)</td><td class="n">₪${r0(mc.q(mc.finals, .1))}</td></tr><tr><td>אחרי מס, ריאלי – חציון</td><td class="n"><b>₪${r0(mc.q(mc.finals, .5))}</b></td></tr><tr><td>אחרי מס, ריאלי – תרחיש חזק (90%)</td><td class="n">₪${r0(mc.q(mc.finals, .9))}</td></tr>
   <tr><th>סיכוי להגיע ליעד ₪${r0(goal)} (ריאלי, אחרי מס)</th><th class="n ${prob >= 70 ? "pos" : prob < 40 ? "neg" : ""}">${pct(prob, 0)}</th></tr></table>`;
  const sc = Object.entries(DET).map(([k, [n, a, b]]) => [n, detPath(o, a, b)]).concat([["משבר והתאוששות", detPath(o, DET.base[1], DET.base[2], true)]]);
  chart("det", { type: "line", data: { labels: L, datasets: sc.map(([n, d], i) => ({ label: n, data: d, borderColor: PAL[i], pointRadius: 0, borderWidth: 2 })) }, options: { maintainAspectRatio: false, plugins: { legend: { rtl: true } }, scales: { y: yfmt } } });
  $("#detTxt").innerHTML = `<table class="tbl">${sc.map(([n, d]) => `<tr><td>${n}</td><td class="n">₪${r0(d[d.length - 1])}</td><td class="n muted">ריאלי ₪${r0(d[d.length - 1] / Math.pow(1 + o.infl / 100, o.years))}</td></tr>`).join("")}</table>`;
  $("#assump").innerHTML = `<ul>
   <li>מונטה קרלו: ${o.paths.toLocaleString("he-IL")} מסלולים, דגימת בלוקים של 12 חודשים רצופים מתשואות חודשיות היסטוריות (${mc.from} ואילך, ${mc.months} חודשים) של VFINX${o.src === "global" ? " ו־VGTSX" : ""} למניות ו־VBMFX לאג"ח – כולל דיבידנדים (מחיר מתואם, Yahoo Finance).</li>
   <li>שער הדולר נדגם בנפרד מהיסטוריית דולר/שקל (${mc.fxFrom} ואילך) ${o.fxDrift ? `בתוספת ${o.fxDrift}% בשנה` : ""}. הדגימה הנפרדת מתעלמת מהקשר בין השקלים למניות (בפועל הדולר נוטה להתחזק במשברים – מה שמרכך ירידות למשקיע ישראלי).</li>
   <li>תרחישים קבועים: תשואה נומינלית בדולר – מניות/אג"ח: שמרני ${DET.cons[1]}%/${DET.cons[2]}%, בסיס ${DET.base[1]}%/${DET.base[2]}%, אופטימי ${DET.opt[1]}%/${DET.opt[2]}%. משבר: ירידה של ${o.crash}% בחלק המנייתי בשנה ${o.crashYear}, ואחריה המשך תרחיש הבסיס.</li>
   <li>מס: 25% על הרווח שמעל ההפקדות המוצמדות לאינפלציה, במכירה אחת בסוף (הנחה מפושטת). ללא מס יסף, ללא מס על דיבידנדים בדרך (מתאים לקרן צוברת).</li>
   <li>הערך הריאלי מנוכה באינפלציה של ${o.infl}% בשנה.</li></ul>`;
};

/* ---------- Stress tests ---------- */
const TECH = ["QQQ", "QQQM", "SMH", "SOXX", "XLK", "VGT", "ARKK", "BOTZ", "ROBO", "CNDX", "EQQQ", "SCHG", "VUG"];
function assetClass(h) {
  if (h.type === "cash") return "cash";
  if (["VXUS", "VEA"].includes(h.sym)) return "intl_stocks"; if (["VWO", "IEMG", "EIMI"].includes(h.sym)) return "em_stocks";
  if (TECH.includes(h.sym)) return "tech"; if (["VT", "VWRA", "VWCE", "URTH", "IWDA", "SWDA", "VANGMSA"].includes(h.sym)) return "world";
  if (!isETF(h.sym)) return "stock"; return "us_stocks";
}
function crisisFor(h, k) {
  const e = etfMeta(h.sym), Pm = D.meta.proxies;
  if (e?.crisis?.[k] != null) return [e.crisis[k], "מחיר הקרן עצמה", "fact"];
  const ac = assetClass(h);
  if (ac === "cash") return [0, "מזומן", "est"];
  if (ac === "world") { const a = Pm.us_stocks.crisis[k], b = Pm.intl_stocks.crisis[k]; return a != null && b != null ? [0.6 * a + 0.4 * b, "60% VFINX + 40% VGTSX", "est"] : [null]; }
  if (ac === "stock") { const a = Pm.us_stocks.crisis[k]; return a != null ? [Math.max(-95, a * 1.3), "S&P 500 × 1.3 (מניה בודדת)", "est"] : [null]; }
  const pr = Pm[ac]; return pr?.crisis?.[k] != null ? [pr.crisis[k], pr.label, "est"] : [null];
}
VIEWS.stress = async m => {
  if (!S.holdings.length) { m.innerHTML = '<div class="card"><p>הוסף אחזקות כדי להריץ מבחני קיצון.</p></div>'; return; }
  const C = D.meta.crises, tot = S.holdings.reduce((a, h) => a + valueUSD(h), 0), p = P();
  const res = Object.entries(C).map(([k, c]) => { let loss = 0, cover = 0; const det = S.holdings.map(h => { const [d, s, kind] = crisisFor(h, k), w = valueUSD(h) / tot; if (d != null) { loss += w * d; cover += w; } return { h, d, s, kind, w }; }); return { k, c, loss, cover, det }; });
  m.innerHTML = `<h1>מבחני קיצון – מה היה קורה לתיק של היום</h1>
  <div class="alert info">לכל אחזקה נלקחת הירידה מהשיא לשפל בתקופת המשבר: מהמחיר של הקרן עצמה אם היא הייתה קיימת, אחרת ממדד מייצג. ${tag("est")} הסכום משוקלל ולכן מקורב – השפלים לא תמיד היו באותו חודש. בדולרים, לפני השפעת השקל.</div>
  <div class="grid g4">${res.map(r => `<div class="card kpi"><div class="l">${r.k} – ${esc(r.c.label)}</div><div class="v neg">${pct(r.loss)}</div><div class="muted">≈ ${money(tot * r.loss / 100)} · ${r.c.from} עד ${r.c.to}</div>${r.cover < .99 ? `<div class="small neg">כיסוי חלקי (${pct(r.cover * 100, 0)})</div>` : ""}${-r.loss > p.lossTol ? `<div class="small neg">מעל סבילות הירידה שלך (${p.lossTol}%)</div>` : ""}</div>`).join("")}</div>
  <div class="card" style="margin-top:14px"><h2>פירוט לפי אחזקה</h2><div class="scroll"><table class="tbl"><tr><th>נייר</th><th>משקל</th>${res.map(r => `<th>${r.k}</th>`).join("")}</tr>
   ${S.holdings.map((h, i) => `<tr><td>${esc(h.sym)}</td><td class="n">${pct(res[0].det[i].w * 100)}</td>${res.map(r => { const d = r.det[i]; return `<td class="n ${sgn(d.d)}" title="${esc(d.s || "")}">${d.d == null ? "—" : pct(d.d)}<div class="small muted">${esc(d.s || "אין נתון")}</div></td>`; }).join("")}</tr>`).join("")}</table></div>
   ${src("Yahoo Finance – מחירים חודשיים מתואמים (קרנות ומדדים מייצגים VFINX, VGTSX, VEIEX, QQQ, VBMFX)", D.meta.etfs[0]?.pasof)}</div>`;
};

/* ---------- Decision journal ---------- */
VIEWS.journal = async m => {
  const tot = S.holdings.reduce((a, h) => a + valueUSD(h), 0);
  const ent = S.journal.map(j => { const due = j.review && j.review <= today() && !j.reviewed;
    return `<div class="card" style="margin-bottom:10px;${due ? "border-color:var(--warn)" : ""}"><div class="row" style="justify-content:space-between"><b>${esc(j.date)} · ${esc(j.action)} ${esc(j.sym || "")}</b><span class="small muted">${j.cooled ? "אושר אחרי צינון 48 שעות · " : ""}בדיקה חוזרת: ${esc(j.review || "—")}</span></div>
    ${j.size ? `<div class="small">היקף: ${esc(j.size)}</div>` : ""}<div><b>תזה / סיבה:</b> ${esc(j.thesis)}</div>${j.expected ? `<div><b>תוצאה צפויה:</b> ${esc(j.expected)}</div>` : ""}${j.horizon ? `<div><b>אופק:</b> ${esc(j.horizon)}</div>` : ""}${j.exit ? `<div><b>תנאי יציאה:</b> ${esc(j.exit)}</div>` : ""}
    ${(j.warnings || []).length ? `<div class="alert warn small">התראות בזמן ההחלטה: ${esc(j.warnings.join(" | "))}</div>` : ""}
    ${j.reviewed ? `<div class="alert ok small">נבדק ב־${esc(j.reviewed)}: ${esc(j.reviewNote || "")}</div>` : due ? `<div class="alert warn">הגיע זמן הבדיקה החוזרת: האם התזה עדיין תקפה? האם התקיים תנאי יציאה?</div><div class="row"><input data-rn="${j.id}" placeholder="מה למדתי / מה השתנה"><button class="btn" data-rv="${j.id}">סימון כנבדק</button></div>` : ""}
    <button class="btn del" data-jd="${j.id}" style="margin-top:6px">מחיקה</button></div>`; }).join("");
  m.innerHTML = `<h1>יומן החלטות</h1>
  <div class="grid g2"><div class="card"><h2>החלטה חדשה</h2>
   <div class="grid g3"><label class="f">פעולה<select id="jA"><option>קנייה</option><option>מכירה</option><option>החזקה (החלטה לא לפעול)</option><option>איזון מחדש</option></select></label>
   <label class="f">נייר<input id="jS" placeholder="VOO"></label><label class="f">סכום (₪)<input id="jAmt" type="number"></label>
   <label class="f">תפקיד<select id="jR"><option value="core">ליבה</option><option value="sat">לוויין</option></select></label>
   <label class="f">אופק<input id="jH" placeholder="10 שנים"></label><label class="f">תאריך בדיקה חוזרת<input id="jRv" type="date" value="${addMonths(today(), 12)}"></label></div>
   <label class="f">תזה – למה?<textarea id="jT"></textarea></label><label class="f">תוצאה צפויה (מדידה)<input id="jE"></label><label class="f">תנאי יציאה – מה יגרום לי להודות שטעיתי?<input id="jX"></label>
   <div id="jChk"></div><div class="row" style="margin-top:8px"><button class="btn sec" id="jCheck">בדיקה מול הכללים</button><button class="btn" id="jSave">שמירה ביומן</button></div></div>
   <div class="card"><h2>המדיניות שלי</h2><pre style="white-space:pre-wrap;font:inherit">${esc(S.policy)}</pre><p class="small muted">עריכה בלשונית "פרופיל ומדיניות".</p>
   <h2>רשימת מעקב</h2><div class="row"><input id="wS" placeholder="טיקר" style="flex:1 1 90px"><input id="wN" placeholder="למה מעניין?" style="flex:3 1 160px"><button class="btn sec" id="wAdd">הוספה</button></div>
   <table class="tbl">${S.watch.map(w => `<tr><td><b>${esc(w.sym)}</b></td><td>${esc(w.note)}</td><td class="small muted">${esc(w.date)}</td><td><button class="btn del" data-wd="${w.id}">✕</button></td></tr>`).join("")}</table></div></div>
  <h2 style="margin-top:16px">החלטות קודמות</h2>${ent || '<p class="muted">עוד אין החלטות ביומן.</p>'}`;
  const check = () => {
    const a = $("#jA").value, sym = $("#jS").value.trim().toUpperCase(), amt = (+$("#jAmt").value || 0) / fx(), role = $("#jR").value, p = P(), w = [];
    if (a === "קנייה" && amt) {
      const cur = S.holdings.filter(h => h.sym === sym).reduce((x, h) => x + valueUSD(h), 0), nt = tot + amt, nw = (cur + amt) / nt * 100;
      const sat = S.holdings.filter(h => h.role === "sat").reduce((x, h) => x + valueUSD(h), 0) + (role === "sat" ? amt : 0);
      if (role === "sat" && nw > p.satIdea) w.push(`אחרי הקנייה ${sym} יהיה ${pct(nw)} מהתיק – מעל ${p.satIdea}% לרעיון לוויין.`);
      if (sat / nt * 100 > p.satTotal) w.push(`הלוויין יגיע ל־${pct(sat / nt * 100)} – מעל התקרה (${p.satTotal}%).`);
      if (!isETF(sym) && nw > p.maxSingle) w.push(`חשיפה ישירה של ${pct(nw)} לחברה אחת – מעל ${p.maxSingle}%.`);
    }
    if (a === "מכירה") { const d = recentDrop(sym); if (d != null && d <= -10) w.push(`מכירה אחרי ירידה של ${pct(d)} – שקול צינון של 48 שעות (לחישוב מס ותזמון צינון: לשונית מיסוי).`); }
    if (!$("#jX").value.trim() && a !== "החזקה (החלטה לא לפעול)") w.push("לא הוגדר תנאי יציאה.");
    $("#jChk").innerHTML = w.length ? w.map(x => `<div class="alert warn">${esc(x)}</div>`).join("") : '<div class="alert ok">לא נמצאה סתירה לכללים.</div>';
    return w;
  };
  $("#jCheck").onclick = check;
  $("#jSave").onclick = () => { if (!$("#jT").value.trim()) return alert("נא לכתוב תזה"); const w = check();
    S.journal.unshift({ id: uid(), date: today(), action: $("#jA").value, sym: $("#jS").value.trim().toUpperCase(), size: $("#jAmt").value ? "₪" + r0(+$("#jAmt").value) : "", thesis: $("#jT").value, expected: $("#jE").value, horizon: $("#jH").value, exit: $("#jX").value, review: $("#jRv").value, warnings: w }); save(); go(); };
  $$("[data-jd]", m).forEach(b => b.onclick = () => { if (confirm("למחוק?")) { S.journal = S.journal.filter(j => j.id !== b.dataset.jd); save(); go(); } });
  $$("[data-rv]", m).forEach(b => b.onclick = () => { const j = S.journal.find(x => x.id === b.dataset.rv); j.reviewed = today(); j.reviewNote = $(`[data-rn="${j.id}"]`).value; save(); go(); });
  $("#wAdd").onclick = () => { const s = $("#wS").value.trim().toUpperCase(); if (!s) return; S.watch.push({ id: uid(), sym: s, note: $("#wN").value, date: today() }); save(); go(); };
  $$("[data-wd]", m).forEach(b => b.onclick = () => { S.watch = S.watch.filter(w => w.id !== b.dataset.wd); save(); go(); });
};

/* ---------- Data & backup ---------- */
VIEWS.data = async m => {
  const lg = D.meta.log;
  m.innerHTML = `<h1>נתונים, מקורות וגיבוי</h1>
  <div class="grid g2"><div class="card"><h2>גיבוי הנתונים האישיים</h2>
   <p class="small">הפרופיל, התיק, היומן והמדיניות נשמרים רק בדפדפן הזה. רענון לא מוחק אותם, אבל ניקוי נתוני דפדפן או מכשיר אחר – כן. ${S.saved ? "שמירה אחרונה: " + new Date(S.saved).toLocaleString("he-IL") : ""}</p>
   <div class="row"><button class="btn" id="exp">ייצוא לקובץ</button><label class="btn sec" for="impJ">ייבוא מקובץ</label><input type="file" id="impJ" accept=".json" class="hide"><button class="btn del" id="rst">איפוס הכול</button><button class="btn sec" id="demo">טעינת תיק לדוגמה</button></div></div>
   <div class="card"><h2>מקורות</h2><ul class="small">
    <li><b>אחזקות קרנות אמריקאיות:</b> SEC EDGAR – דוחות N-PORT רשמיים (רבעוניים, מתפרסמים כ־60 יום אחרי סוף הרבעון).</li>
    <li><b>SPY וקרנות הסקטור:</b> State Street (SSGA) – קובץ אחזקות יומי. משמש גם לסיווג סקטורים (GICS) ולמיפוי טיקר↔CUSIP.</li>
    <li><b>קרנות UCITS:</b> האחזקות של קרן אמריקאית שעוקבת אחרי אותו מדד (קירוב, מסומן).</li>
    <li><b>מחירים ותשואות:</b> Yahoo Finance (ממשק לא רשמי, חינמי) – מחירים חודשיים מתואמים ומחיר אחרון.</li>
    <li><b>כללי מס:</b> מוזנים ידנית עם תאריך תחולה ומקור (rules.js).</li></ul>
    <p class="small muted">הנתונים מתעדכנים אוטומטית פעם ביום (GitHub Actions). עדכון אחרון: ${esc(D.meta.builtIL)}.</p></div></div>
  <div class="card" style="margin-top:14px"><h2>יומן העדכון האחרון</h2><div class="scroll"><table class="tbl"><tr><th>מקור</th><th>מצב</th><th>נכון ל־</th><th>רשומות</th></tr>
   ${lg.map(l => `<tr><td>${esc(l.src)}</td><td class="${l.ok ? "pos" : "neg"}">${l.ok ? "תקין" : "נכשל – מוצג נתון קודם אם קיים"}</td><td class="n">${esc(l.asof || "")}</td><td class="n">${l.n ?? esc(l.err || "")}</td></tr>`).join("")}</table></div></div>`;
  $("#exp").onclick = () => { const b = new Blob([JSON.stringify(S, null, 1)], { type: "application/json" }), a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `futureinvest-backup-${today()}.json`; a.click(); };
  $("#impJ").onchange = async e => { try { const o = JSON.parse(await e.target.files[0].text()); if (!o.profile || !Array.isArray(o.holdings)) throw 0; S = { ...structuredClone(DEF), ...o }; save(); alert("הנתונים יובאו."); go(); } catch (x) { alert("הקובץ לא תקין."); } };
  $("#rst").onclick = () => { if (confirm("למחוק את כל הנתונים האישיים מהדפדפן?")) { localStorage.removeItem(KEY); S = load(); go(); } };
  $("#demo").onclick = () => { if (S.holdings.length && !confirm("להוסיף תיק לדוגמה לאחזקות הקיימות?")) return;
    importRows([["ticker", "quantity", "role", "buy_price", "buy_fx"], ["CSPX", "120", "core", "520", "3.65"], ["VT", "300", "core", "95", "3.75"], ["QQQ", "60", "sat", "380", "3.6"], ["NVDA", "80", "sat", "60", "3.7"], ["SMH", "40", "sat", "220", "3.7"], ["TEVA", "300", "sat", "15", "3.8"]]); save(); tab = "port"; go(); };
};

/* ---------- init ---------- */
(async function init() {
  $("#dispCur").value = localStorage.getItem(KEY + ".cur") || "ILS";
  $("#dispCur").onchange = e => { localStorage.setItem(KEY + ".cur", e.target.value); go(); };
  try { [D.meta, D.sec, D.prices] = await Promise.all([getJSON("data/meta.json"), getJSON("data/securities.json"), getJSON("data/prices.json")]); }
  catch (e) { $("#main").innerHTML = '<div class="alert bad">לא ניתן לטעון את קובצי הנתונים. נסה לרענן.</div>'; return; }
  D.fxx = { GBP: D.meta.fx.gbpusd, EUR: D.meta.fx.eurusd };
  D.meta.builtIL = ilTime(D.meta.built); $("#dataStamp").textContent = "נתונים עודכנו: " + D.meta.builtIL;
  if (!TABS.some(t => t[0] === tab)) tab = "today";
  if (!window.Chart) await new Promise(r => { const t = setInterval(() => { if (window.Chart) { clearInterval(t); r(); } }, 50); setTimeout(() => { clearInterval(t); r(); }, 4000); });
  go();
})();
