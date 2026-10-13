/* FutureInvest – הזדמנויות היום. מסך פשוט: רעיונות, אירועים בעולם, משקיעים גדולים, ציון כדאיות 0–100.
   הנתונים מ-data/opps.json (מתעדכן כל בוקר). ההתאמה לתיק מחושבת כאן בדפדפן בלבד. אומדן – לא ייעוץ. */
"use strict";
TABS.unshift(["today", "הזדמנויות היום"]);
const OW_DEF = { perf: 20, mom: 15, val: 15, qual: 15, risk: 15, cost: 10, big: 5, fit: 15 };
const OC = { perf: "ביצועי עבר", mom: "מגמה", val: "תמחור", qual: "איכות העסק", risk: "סיכון ותנודתיות", cost: "עלות וגודל הקרן", big: "משקיעים גדולים", fit: "התאמה לתיק שלך" };
const OW = () => ({ ...OW_DEF, ...(S.oppW || {}) });
let OD = null;
async function oppData() { if (!OD) OD = await getJSON("data/opps.json"); return OD; }

function myCtx() {
  const tot = S.holdings.reduce((a, h) => a + valueUSD(h), 0);
  const w = {}, sec = {}; let usUSD = 0;
  for (const h of S.holdings) {
    const v = valueUSD(h); w[h.sym] = (w[h.sym] || 0) + (tot ? v / tot * 100 : 0);
    const s = holdingInfo(h).sector; sec[s] = (sec[s] || 0) + (tot ? v / tot * 100 : 0);
    if (typeof situsUS === "function" && situsUS(h)) usUSD += v;
  }
  const themeOf = t => Object.entries(PL.themes).find(([, l]) => l.includes(t))?.[0];
  const myThemes = new Set(S.holdings.map(h => themeOf(h.sym)).filter(Boolean));
  return { has: tot > 0, w, sec, usUSD, themeOf, myThemes };
}
function fitOf(r, X) {
  const why = []; let f = 60;
  if (r.lev) return { f: 0, why: ["מוצר ממונף/חוזים – לא מתאים להחזקה ארוכה"] };
  if (!X.has) { if (r.ucits) { f += 10; why.push("קרן אירופית – בלי חשיפה למס עיזבון אמריקאי"); } return { f: null, why: why.length ? why : ["ייבא את התיק כדי לחשב התאמה"] }; }
  const held = X.w[r.t] || 0;
  if (held > P().maxSingle) { f -= 35; why.push(`כבר ${pct(held)} מהתיק שלך – מעל התקרה`); }
  else if (held > 0) { f -= 10; why.push(`כבר יש לך (${pct(held)} מהתיק)`); }
  const th = X.themeOf(r.t);
  if (th && X.myThemes.has(th) && !held) { f -= 20; why.push(`כבר יש לך קרן בנושא "${th}"`); }
  if (r.sec && r.k === "stock") { const s = X.sec[r.sec] || 0; if (s < 8) { f += 15; why.push(`מגוון – רק ${pct(s, 0)} מהתיק בסקטור הזה`); } else if (s > P().maxSector) { f -= 15; why.push(`הסקטור כבר ${pct(s, 0)} מהתיק`); } }
  const alt = PL.ucits[r.t];
  if (r.ucits) { f += 15; why.push("קרן אירופית – בלי חשיפה למס עיזבון אמריקאי"); }
  else if (X.usUSD > FI_RULES.usEstate.exemptionUSD && (r.k === "stock" || alt)) { f -= alt ? 20 : 10; why.push(alt ? `נייר אמריקאי (מס עיזבון) – עדיף המקביל האירופי: ${alt}` : "נייר אמריקאי – מגדיל את החשיפה למס עיזבון"); }
  return { f: Math.max(0, Math.min(100, f)), why };
}
function scoreOf(r, X) {
  const c = { ...r.c }, fit = fitOf(r, X); c.fit = fit.f;
  const W = OW(); let a = 0, b = 0;
  for (const k in W) if (c[k] != null && W[k] > 0) { a += c[k] * W[k]; b += W[k]; }
  return { s: b ? Math.round(a / b) : null, c, fitWhy: fit.why };
}
const sCls = s => s == null ? "" : s >= 70 ? "hi" : s >= 50 ? "mid" : "lo";
const badge = s => `<span class="sc ${sCls(s)}" title="ציון כדאיות משוקלל 0–100 (אומדן)">${s ?? "—"}</span>`;
const yLink = r => `https://finance.yahoo.com/quote/${encodeURIComponent(r.y || r.t)}`;
const BULL = { perf: "תשואה חזקה בשנים האחרונות", mom: "במגמת עלייה בחצי השנה האחרונה", val: "מתומחר בזול יחסית לענף", qual: "עסק רווחי עם מאזן חזק", risk: "יציב יחסית, תנודתיות נמוכה", cost: "דמי ניהול נמוכים וקרן גדולה", big: "כמה משקיעים גדולים מחזיקים בו", fit: "מתאים לתיק שלך ומגוון אותו" };
const BEAR = { perf: "ביצועי עבר חלשים יחסית", mom: "נמצא כרגע במגמת ירידה", val: "יקר יחסית לענף", qual: "רווחיות או מאזן חלשים", risk: "תנודתי – ירידות חדות אפשריות", cost: "דמי ניהול גבוהים יחסית", big: "משקיעים גדולים מוכרים", fit: "חופף למה שכבר יש לך" };
function bullBear(r, sc) {
  const e = Object.entries(sc.c).filter(([, v]) => v != null).sort((a, b) => b[1] - a[1]);
  let bull = e[0] ? BULL[e[0][0]] : "—", bear = e.length ? BEAR[e[e.length - 1][0]] : "—";
  if (e.length && e[e.length - 1][0] === "risk" && r.mdd != null) bear = `תנודתי – בעבר ירד עד ${pct(-r.mdd, 0)} מהשיא`;
  if (e.length && e[e.length - 1][0] === "fit" && sc.fitWhy[0]) bear = sc.fitWhy.find(w => /כבר|אמריקאי|ממונף/.test(w)) || bear;
  return { bull, bear };
}
function breakdown(r, sc) {
  const W = OW(); const nm = k => OC[k];
  const facts = [["תשואה שנתית 1/3/5 שנים", [r.r1, r.r3, r.r5].map(x => x == null ? "—" : pct(x, 0)).join(" / ")], ["ירידה מקסימלית (5 שנים)", r.mdd == null ? "—" : pct(r.mdd, 0)],
    ["תנודתיות שנתית", r.vol == null ? "—" : pct(r.vol, 0)], ["מעל/מתחת לממוצע 200 יום", r.ma200 == null ? "—" : pct(r.ma200, 0)]];
  if (r.k === "stock") facts.push(["מכפיל רווח (נוכחי / צפוי)", [r.pe, r.fpe].map(x => x == null ? "אין נתון" : x.toFixed(1)).join(" / ")], ["שולי רווח / תשואה להון", [r.pm, r.roe].map(x => x == null ? "אין נתון" : pct(x * 100, 0)).join(" / ")]);
  else facts.push(["דמי ניהול", r.ter == null ? "אין נתון" : pct(r.ter, 2)], ["גודל הקרן", r.aum == null ? "אין נתון" : "$" + r.aum + " מיליארד"]);
  const who = (r.hold || []).map(([k, w, ch]) => { const m = OD.f13.m[k]; return m ? `${m.he} (${pct(w)}${ch === "new" ? ", קנייה חדשה" : ch === "add" ? ", הגדיל" : ch === "trim" ? ", הקטין" : ""})` : ""; }).filter(Boolean);
  return `<details class="bd"><summary>למה הציון הזה?</summary>
   <table class="tbl">${Object.keys(OC).map(k => `<tr><td>${nm(k)}</td><td class="n">${sc.c[k] == null ? '<span class="muted">אין נתון – לא נכלל</span>' : badge(sc.c[k])}</td><td class="n muted">משקל ${W[k]}</td></tr>`).join("")}</table>
   ${sc.fitWhy.length ? `<p class="small">התאמה לתיק: ${sc.fitWhy.map(esc).join(" · ")}</p>` : ""}
   <table class="tbl small">${facts.map(([a, b]) => `<tr><td>${a}</td><td class="n">${b}</td></tr>`).join("")}</table>
   ${who.length ? `<p class="small">מחזיקים לפי 13F: ${who.map(esc).join(", ")}</p>` : ""}
   <p class="small muted">כל רכיב הוא דירוג יחסי (0–100) מול ${r.k === "stock" ? "המניות" : "הקרנות"} במאגר. רכיב בלי נתון לא נכלל בחישוב.</p></details>`;
}
function ideaCard(r, sc, extra = "") {
  const { bull, bear } = bullBear(r, sc); const mine = MYX?.w[r.t];
  return `<div class="card idea"><div class="ih">${badge(sc.s)}<div><b>${esc(r.t)}</b> <span class="muted">${esc(r.n)}</span>${mine ? ' <span class="tag est">יש לך</span>' : ""}${r.ucits ? ' <span class="tag fact">אירופית</span>' : ""}</div></div>
   ${extra}<div class="bb"><div class="pos">👍 ${esc(bull)}</div><div class="neg">👎 ${esc(bear)}</div></div>
   ${breakdown(r, sc)}<a class="small" href="${yLink(r)}" target="_blank" rel="noopener">למידע נוסף ←</a></div>`;
}
let MYX = null;
VIEWS.today = async m => {
  let d; try { d = await oppData(); } catch (e) { m.innerHTML = '<div class="alert warn">נתוני ההזדמנויות עוד לא נבנו. הם יתעדכנו בהרצה היומית הבאה.</div>'; return; }
  const X = MYX = myCtx(); if (X.has && S.holdings.some(h => etfMeta(h.sym))) { /* אין צורך בטעינת אחזקות כאן – שומר על מסך מהיר */ }
  const U = Object.values(d.u), SC = {}; U.forEach(r => SC[r.t] = scoreOf(r, X));
  const evT = {}; d.events.slice(0, 5).forEach((e, i) => e.tickers.forEach(t => { evT[t] = Math.max(evT[t] || 0, (e.tone === "חיובי" ? 6 : e.tone === "מעורב" ? 3 : 1) - i * 0.5); }));
  // רעיונות היום: ציון + רלוונטיות לאירועים + התאמה; גיוון – לא יותר מאחד לכל סקטור/נושא
  const cand = U.filter(r => !r.lev && SC[r.t].s != null && (r.r3 != null || r.r1 != null)).map(r => ({ r, x: SC[r.t].s + (evT[r.t] || 0) + (X.has && SC[r.t].c.fit != null ? (SC[r.t].c.fit - 50) / 10 : 0) })).sort((a, b) => b.x - a.x);
  const ideas = [], used = new Set();
  const SAME = { VUAA: "CSPX", SXR8: "CSPX", VOO: "CSPX", IVV: "CSPX", SPY: "CSPX", VTI: "CSPX", IWDA: "VWRA", SWDA: "VWRA", URTH: "VWRA", VT: "VWRA", VWCE: "VWRA", QQQ: "CNDX", QQQM: "CNDX", EQQQ: "CNDX" };
  const grp = r => r.k === "stock" ? "S:" + (r.sec || r.t) : "E:" + (X.themeOf(r.t) || SAME[r.t] || (PL.ucits[r.t] || r.t).split(" ")[0]);
  let ne = 0;
  for (const c of cand) {
    const g = grp(c.r), isE = c.r.k === "etf";
    if (used.has(g) || (X.w[c.r.t] || 0) > P().maxSingle || (isE && ne >= 3) || (!isE && ideas.length - ne >= 3)) continue;
    used.add(g); ideas.push(c.r); ne += isE; if (ideas.length >= 5) break;
  }
  const mac = d.macro || {}, mk = ["SPX", "VIXCLS", "DGS10", "OIL", "GOLD", "USDILS", "CPIAUCSL", "FEDFUNDS"].filter(k => mac[k]);
  const dataDate = ilTime(d.built);
  const evCard = e => {
    const tk = e.tickers.map(t => { const own = X.w[t] || 0; return `<button class="chip${own ? " on" : ""}" data-sc="${esc(t)}" title="${own ? "יש לך בתיק" : "הצג ציון"}">${esc(t)}${own ? " · יש לך" : ""}</button>`; }).join("");
    const exp = e.tickers.some(t => X.w[t]) || (X.has && e.tickers.some(t => X.myThemes.has(X.themeOf(t))));
    const h = e.heads[0];
    return `<div class="card ev"><div class="ih"><span class="tone ${e.tone === "חיובי" ? "pos" : e.tone === "שלילי" ? "neg" : ""}">${e.tone === "חיובי" ? "▲" : e.tone === "שלילי" ? "▼" : "◆"}</span><b>${esc(e.title)}</b>${exp ? ' <span class="tag est">התיק שלך חשוף</span>' : ""}</div>
     <p>${esc(e.why)} <span class="muted small">(${e.n} כתבות, טון ${e.tone})</span></p><div class="chips">${tk}</div>
     ${h ? `<a class="small" href="${esc(h.u)}" target="_blank" rel="noopener nofollow">${esc(h.t)}</a> <span class="muted small">· ${esc(h.src)}</span>` : ""}</div>`;
  };
  const cons = d.f13.cons.slice(0, 8).map(c => { const r = d.u[c.t]; const own = X.w[c.t];
    return `<tr><td><b>${esc(c.t)}</b>${own ? ' <span class="tag est">גם אצלך</span>' : ""}<div class="small muted">${esc(r?.n || "")}</div></td><td class="small">${c.who.length} משקיעים: ${c.who.slice(0, 4).map(esc).join(", ")}${c.who.length > 4 ? "…" : ""}</td><td class="n small">${c.buy ? `<span class="pos">${c.buy} קנו/הגדילו</span>` : ""}${c.sell ? ` <span class="neg">${c.sell} מכרו</span>` : ""}</td><td>${r ? badge(SC[c.t].s) : ""}</td></tr>`; }).join("");
  const mgr = Object.values(d.f13.m).sort((a, b) => a.stale - b.stale || b.aum - a.aum).map(x => {
    const buys = x.pos.filter(p => p.ch === "new" || p.ch === "add").slice(0, 5), sells = [...x.pos.filter(p => p.ch === "trim").slice(0, 3), ...x.sold.slice(0, 3)];
    const nm = p => `${esc(p.t || p.n)}${p.t && X.w[p.t] ? " ★" : ""}`;
    return `<details class="mg"><summary><b>${esc(x.he)}</b> <span class="muted small">${esc(x.who)} · נכון ל־${esc(x.per)}</span>${x.stale ? ' <span class="tag stale">דוח ישן</span>' : ""}</summary>
     <p class="small"><b>הגדולות:</b> ${x.pos.slice(0, 5).map(p => `${nm(p)} ${pct(p.w, 0)}`).join(", ")}</p>
     <p class="small pos"><b>קנו/הגדילו:</b> ${buys.map(nm).join(", ") || "—"}</p><p class="small neg"><b>מכרו/הקטינו:</b> ${sells.map(nm).join(", ") || "—"}</p></details>`;
  }).join("");
  m.innerHTML = `<h1>הזדמנויות היום <span class="tag est">אומדן, לא ייעוץ</span></h1>
   <p class="muted">מתעדכן כל בוקר (ג׳–ש׳). נתונים נכונים ל־${esc(dataDate)}.${X.has ? "" : " ייבא את התיק בלשונית \"התיק שלי\" כדי לראות מה מתאים לך ומה כבר יש לך."}</p>
   <div class="mac">${mk.map(k => { const x = mac[k]; const ch = x.chgp ?? null; return `<div class="mc"><div class="l">${esc(x.l)}</div><div class="v">${x.u === "$" ? "$" : ""}${Number(x.v).toLocaleString("he-IL")}${x.u === "%" ? "%" : ""}</div>${ch != null ? `<div class="small ${(ch >= 0) !== (k === "VIXCLS") ? "pos" : "neg"}">${ch >= 0 ? "+" : ""}${pct(ch, 1)} היום</div>` : ""}</div>`; }).join("")}</div>
   <h2>💡 רעיונות היום</h2><p class="small muted">דירוג לפי ציון הכדאיות, הקשר לאירועים של היום וההתאמה לתיק. לחיצה על "למה הציון הזה?" מראה את כל החישוב.</p>
   <div class="grid g3">${ideas.map(r => ideaCard(r, SC[r.t], evT[r.t] ? `<p class="small">🌍 קשור לאירוע של היום: ${esc(d.events.find(e => e.tickers.includes(r.t))?.title || "")}</p>` : "")).join("")}</div>
   <div class="card srch"><h2>🔎 בדוק ציון לכל נייר</h2><div class="row"><input id="oq" list="oqL" placeholder="למשל NVDA, CSPX, SMH" autocomplete="off"><datalist id="oqL">${U.map(r => `<option value="${esc(r.t)}">${esc(r.n)}</option>`).join("")}</datalist><button class="btn" id="oqGo">בדוק</button></div><div id="oqOut"></div></div>
   <h2>🌍 מה קורה בעולם</h2><div class="grid g2">${d.events.map(evCard).join("") || '<p class="muted">אין אירועים בולטים היום.</p>'}</div>
   <h2>🐋 מה המשקיעים הגדולים עושים</h2><p class="small muted">${esc(d.f13.note)} ★ = נמצא גם בתיק שלך.</p>
   <div class="grid g2"><div class="card"><h3>מניות שהרבה מהם מחזיקים</h3><div class="scroll"><table class="tbl">${cons}</table></div></div><div class="card"><h3>לפי משקיע</h3>${mgr}</div></div>
   <details class="card" style="margin-top:14px"><summary><b>⚙️ משקלות הציון</b> <span class="muted small">(לשנות מה חשוב לך)</span></summary>
    <div class="grid g4">${Object.keys(OC).map(k => `<label class="small">${OC[k]}<input type="number" min="0" max="50" data-ow="${k}" value="${OW()[k]}"></label>`).join("")}</div>
    <button class="btn sec" id="owReset" style="margin-top:8px">חזרה לברירת המחדל</button></details>
   ${src("RSS: Yahoo Finance, CNBC, MarketWatch, Google News · מאקרו: FRED/Yahoo · 13F: SEC EDGAR · מחירים ונתונים פיננסיים: Yahoo Finance", d.built.slice(0, 10))}
   <p class="small muted">${esc(FI_RULES.disclaimer)} הציון הוא דירוג יחסי לפי נתוני עבר, ותשואות עבר אינן מבטיחות תשואות בעתיד.</p>`;
  const show = t => { t = (t || "").trim().toUpperCase(); const r = d.u[t] || U.find(x => x.y === t);
    $("#oqOut").innerHTML = r ? ideaCard(r, SC[r.t]) : `<div class="alert warn">${esc(t)} לא נמצא במאגר (${U.length} ניירות: מניות S&P 500 הגדולות, קרנות פופולריות, קרנות אירופיות ומניות של המשקיעים הגדולים).</div>`;
    const dd = $("#oqOut details"); if (dd) dd.open = true; };
  $("#oqGo").onclick = () => show($("#oq").value); $("#oq").onkeydown = e => { if (e.key === "Enter") show(e.target.value); };
  $$("[data-sc]", m).forEach(b => b.onclick = () => { $("#oq").value = b.dataset.sc; show(b.dataset.sc); $(".srch").scrollIntoView({ behavior: "smooth", block: "start" }); });
  $$("[data-ow]", m).forEach(i => i.onchange = () => { S.oppW = { ...OW(), [i.dataset.ow]: Math.max(0, +i.value || 0) }; save(); go(); });
  $("#owReset").onclick = () => { delete S.oppW; save(); go(); };
};
