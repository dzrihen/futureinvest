/* FutureInvest – כלי החלטה: בדיקה לפני קנייה, יומן תזות, רשימת מעקב עם התראות.
   הכול מחושב בדפדפן; הנתונים האישיים נשמרים רק ב-localStorage. אומדן – לא ייעוץ. */
"use strict";
TABS.splice(1, 0, ["watch", "מעקב והתראות"]);
const DREPO = "dzrihen/futureinvest";
const r1 = x => x == null || isNaN(x) ? "—" : (x >= 0 ? "+" : "") + pct(x);
const SPXP = d => d.u.VOO?.p || d.u.CSPX?.p || null;

/* ---------- בדיקה לפני קנייה ---------- */
function dlg() {
  let d = $("#dlg"); if (d) return d;
  d = document.createElement("dialog"); d.id = "dlg"; d.className = "dlg"; document.body.appendChild(d);
  d.addEventListener("click", e => { if (e.target === d) d.close(); });
  return d;
}
document.addEventListener("click", e => { const b = e.target.closest("[data-chk]"); if (b) { e.preventDefault(); openCheck(b.dataset.chk); } });
async function openCheck(t = "") {
  const d = dlg(), od = await oppData().catch(() => null);
  d.innerHTML = `<div class="dh"><h2>🛒 בדיקה לפני קנייה</h2><button class="btn sec" id="dX" aria-label="סגירה">✕</button></div>
   <div class="row"><input id="kT" list="kL" placeholder="נייר, למשל CSPX" value="${esc(t)}" style="flex:2 1 110px" autocomplete="off">
   <input id="kA" type="number" min="0" placeholder="סכום" value="10000" style="flex:1 1 90px"><select id="kC" aria-label="מטבע"><option value="ILS">₪</option><option value="USD">$</option></select>
   <button class="btn" id="kGo">בדוק</button></div>${od ? `<datalist id="kL">${Object.values(od.u).map(r => `<option value="${esc(r.t)}">${esc(r.n)}</option>`).join("")}</datalist>` : ""}<div id="kOut"></div>`;
  if (!d.open) d.showModal();
  $("#dX").onclick = () => d.close();
  const run = () => preBuy($("#kT").value, +$("#kA").value || 0, $("#kC").value);
  $("#kGo").onclick = run; $("#kT").onkeydown = e => { if (e.key === "Enter") run(); };
  if (t) run();
}
function singles(comp, tot) {
  return comp.filter(c => c.t && !/^(ETF-|CASH-)/.test(c.k) && !c.k.includes("|")).map(c => ({ t: c.t, n: c.n, k: c.k, v: c.v, p: c.v / tot * 100 }));
}
async function preBuy(t, amt, ccy) {
  const out = $("#kOut"); t = (t || "").trim().toUpperCase();
  const od = await oppData().catch(() => null);
  const r = od && (od.u[t] || Object.values(od.u).find(x => x.y === t));
  if (!t) return; if (!amt) { out.innerHTML = '<div class="alert warn">נא להזין סכום.</div>'; return; }
  const amtU = ccy === "ILS" ? amt / fx() : amt, sym = r?.t || t, p = P();
  const X = myCtx(), sc = r ? scoreOf(r, X) : null;
  // חשיפה אמיתית לפני ואחרי
  const L = S.holdings.length ? await lookThrough() : { tot: 0, comp: [] };
  const H = isETF(sym) ? await etfHold(sym) : null;
  const add = H ? H.h.filter(x => !x.agg).map(x => ({ k: x.k, t: x.t, n: x.n, v: amtU * x.w / 100 })) : [{ k: D.sec?.s[sym]?.isin || sym, t: sym, n: r?.n || sym, v: amtU }];
  const cur = {}; for (const c of L.comp) cur[c.k] = c;
  let ov = 0; for (const a of add) if (cur[a.k]) ov += Math.min(a.v / amtU * 100, cur[a.k].p);
  const nt = L.tot + amtU, before = singles(L.comp, L.tot || 1);
  const aft = {}; for (const c of before) aft[c.k] = { ...c };
  for (const a of add) { if (!a.t) continue; aft[a.k] = aft[a.k] || { t: a.t, n: a.n, v: 0 }; aft[a.k].v += a.v; }
  const after = Object.values(aft).map(c => ({ ...c, p: c.v / nt * 100 })).sort((a, b) => b.v - a.v).slice(0, 5);
  const bp = Object.fromEntries(before.map(c => [c.t, c.p]));
  const core = coreDefault(sym) || ["CSPX", "VWRA", "IWDA", "SWDA", "VWCE", "SXR8", "VUAA", "EIMI"].includes(sym);
  const coreU = S.holdings.filter(h => h.role === "core").reduce((a, h) => a + valueUSD(h), 0);
  const c0 = L.tot ? coreU / L.tot * 100 : null, c1 = (coreU + (core ? amtU : 0)) / nt * 100;
  // מס עיזבון
  const us = !(r?.ucits || PL.nonUS.has(sym)) && situsUS({ sym, type: isETF(sym) ? "etf" : "stock" });
  const usU = X.usUSD || 0, dEst = us ? estateTax(usU + amtU) - estateTax(usU) : 0, alt = PL.ucits[sym];
  const fee = r?.ter ?? PL.ter[sym] ?? etfMeta(sym)?.ter ?? null;
  // חלופות עם ציון גבוה יותר באותו נושא/סקטור
  let alts = [];
  if (r && od) { const th = X.themeOf(sym); const same = x => x.t !== sym && !x.lev && (th ? X.themeOf(x.t) === th : r.k === "stock" ? x.k === "stock" && x.sec === r.sec : x.k === "etf" && (SAMEG[x.t] || x.t) === (SAMEG[sym] || sym));
    alts = Object.values(od.u).filter(same).map(x => ({ x, s: scoreOf(x, X).s })).filter(a => a.s != null && a.s > (sc.s ?? 0)).sort((a, b) => b.s - a.s).slice(0, 3); }
  // פסק דין
  const red = [], yel = [], grn = [];
  if (r?.lev || PL.lev[sym]) red.push("מוצר ממונף או מבוסס חוזים – לא מתאים להחזקה ארוכה");
  if (sc?.s != null && sc.s < 45) red.push(`ציון נמוך (${sc.s})`);
  const cross = after.find(c => c.p > p.maxSingle && (bp[c.t] || 0) <= p.maxSingle); if (cross) red.push(`${cross.t} יגיע ל־${pct(cross.p)} מהתיק – מעל התקרה של ${p.maxSingle}%`);
  const over = after.find(c => c !== cross && c.p > p.maxSingle && c.p - (bp[c.t] || 0) > 0.1 && add.some(a => a.t === c.t)); if (over) yel.push(`${over.t} כבר מעל התקרה (${pct(bp[over.t] || 0)}), והקנייה מוסיפה לו עוד`);
  if (sc?.s != null && sc.s >= 45 && sc.s < 60) yel.push(`ציון בינוני (${sc.s})`);
  if (ov >= 50) yel.push(`${pct(ov, 0)} מהנייר כבר נמצא אצלך – בעיקר חפיפה`); else if (L.tot) grn.push(ov < 20 ? `מוסיף פיזור – רק ${pct(ov, 0)} חפיפה לתיק` : `חפיפה חלקית (${pct(ov, 0)})`);
  if (us && alt) yel.push(`נייר אמריקאי – המקביל האירופי ${alt} חוסך מס עיזבון`);
  else if (us && usU + amtU > FI_RULES.usEstate.exemptionUSD) yel.push("נייר אמריקאי – מגדיל את החשיפה למס עיזבון");
  if (fee != null && fee >= 0.5) yel.push(`דמי ניהול גבוהים (${pct(fee, 2)})`);
  if (alts.length) yel.push(`יש חלופה עם ציון גבוה יותר: ${alts[0].x.t} (${alts[0].s})`);
  if (!r) yel.push("הנייר לא במאגר הציונים – הבדיקה חלקית");
  if (sc?.s >= 60) grn.push(`ציון טוב (${sc.s})`);
  if (!us) grn.push("בלי חשיפה למס עיזבון אמריקאי");
  const v = red.length ? ["bad", "🔴 עדיף לא", red] : yel.length ? ["warn", "🟡 אפשר, אבל שים לב", yel] : ["ok", "🟢 נראה מתאים", grn];
  const amtTxt = money(amtU);
  out.innerHTML = `<div class="card verdict ${v[0]}"><div class="ih">${sc ? badge(sc.s) : ""}<div><b>${esc(sym)}</b> <span class="muted">${esc(r?.n || "")}</span><div class="vt">${v[1]}</div></div></div>
   <ul class="vl">${v[2].map(x => `<li>${esc(x)}</li>`).join("")}</ul>
   ${red.length || yel.length ? `<p class="small pos">${grn.map(esc).join(" · ")}</p>` : ""}
   <table class="tbl small">
    <tr><td>פיזור או חפיפה</td><td>${L.tot ? `${pct(ov, 0)} מהנייר כבר בתיק דרך האחזקות שלך` : "ייבא את התיק כדי לחשב"}</td></tr>
    <tr><td>ליבה / לוויין</td><td>${c0 == null ? (core ? "ליבה" : "לוויין") : `ליבה ${pct(c0, 0)} ← ${pct(c1, 0)} (הנייר נחשב ${core ? "ליבה" : "לוויין"})`}</td></tr>
    <tr><td>מס עיזבון אמריקאי</td><td>${us ? `${dEst > 0 ? `מוסיף כ־${money(dEst)} למס הצפוי ליורשים` : "בתוך הפטור (60 אלף $)"}${alt ? ` · חלופה: <b>${esc(alt)}</b>` : ""}` : "לא חל ✓"}</td></tr>
    <tr><td>דמי ניהול</td><td>${fee == null ? (r?.k === "stock" ? "מניה – אין" : "אין נתון") : pct(fee, 2) + " בשנה"}</td></tr>
   </table>
   ${L.tot ? `<h3>5 החברות הגדולות בתיק אחרי קנייה של ${amtTxt}</h3><table class="tbl small">${after.map(c => `<tr><td><b>${esc(c.t)}</b></td><td class="n">${pct(bp[c.t] || 0)} ← <b class="${c.p > p.maxSingle ? "neg" : ""}">${pct(c.p)}</b></td></tr>`).join("")}</table>` : ""}
   ${alts.length ? `<h3>חלופות עם ציון גבוה יותר</h3><div class="chips">${alts.map(a => `<button class="chip" data-chk="${esc(a.x.t)}">${esc(a.x.t)} · ${a.s}</button>`).join("")}</div>` : ""}
   <details class="bd" id="thz"><summary><b>📝 קניתי – רשום תזה ביומן</b></summary>
    <label class="f">למה אני קונה? (משפט אחד)<input id="zW" maxlength="200"></label>
    <div class="grid g3"><label class="f">אודה שטעיתי אם<select id="zK"><option value="drop">הנייר ירד ב־%</option><option value="date">עד תאריך לא קרה כלום</option><option value="cond">תנאי אחר</option></select></label>
    <label class="f">ערך<input id="zV" placeholder="25"></label><label class="f">בדיקה חוזרת<input id="zR" type="date" value="${addMonths(today(), 3)}"></label></div>
    <button class="btn" id="zSave">שמירה ביומן</button></details>
   <p class="small muted">אומדן, לא ייעוץ. ההשפעה מחושבת מול התיק השמור בדפדפן.</p></div>`;
  $("#zSave").onclick = () => {
    const why = $("#zW").value.trim(); if (!why) return alert("נא לכתוב משפט אחד: למה?");
    const k = $("#zK").value, val = $("#zV").value.trim();
    S.journal.unshift({ id: uid(), date: today(), action: "קנייה", sym, size: (ccy === "ILS" ? "₪" : "$") + r0(amt), thesis: why, wrongK: k, wrongV: val,
      exit: k === "drop" ? `ירידה של ${val}%` : k === "date" ? `עד ${val} לא קרה כלום` : val, review: $("#zR").value, entryP: r?.p ?? null, entrySPX: od ? SPXP(od) : null, warnings: [...red, ...yel] });
    save(); $("#thz").outerHTML = '<div class="alert ok">נרשם ביומן התזות. תקבל תזכורת לבדיקה בתאריך שבחרת.</div>';
  };
}
const SAMEG = { VUAA: "CSPX", SXR8: "CSPX", VOO: "CSPX", IVV: "CSPX", SPY: "CSPX", IWDA: "VWRA", SWDA: "VWRA", URTH: "VWRA", VT: "VWRA", VWCE: "VWRA", QQQ: "CNDX", QQQM: "CNDX", EQQQ: "CNDX" };

/* ---------- יומן תזות: סקירה רבעונית ---------- */
function thesisRows(od) {
  const spx = SPXP(od);
  return S.journal.filter(j => j.action === "קנייה" && j.sym).map(j => {
    const r = od.u[j.sym], ch = r?.p && j.entryP ? (r.p / j.entryP - 1) * 100 : null, sp = spx && j.entrySPX ? (spx / j.entrySPX - 1) * 100 : null;
    let hit = null;
    if (j.wrongK === "drop" && ch != null && +j.wrongV) hit = ch <= -Math.abs(+j.wrongV);
    else if (j.wrongK === "date" && j.wrongV) hit = today() >= j.wrongV ? "check" : false;
    else if (j.exit) hit = "check";
    return { j, ch, sp, hit };
  });
}
async function thesisHTML() {
  const od = await oppData().catch(() => null); if (!od) return "";
  const R = thesisRows(od); if (!R.length) return `<div class="card"><h2>📝 יומן תזות</h2><p class="muted">עוד אין קניות עם תזה. לחץ "בדיקה לפני קנייה" על נייר כלשהו, ושם "קניתי – רשום תזה".</p></div>`;
  return `<div class="card"><h2>📝 יומן תזות – סקירה רבעונית</h2><p class="small muted">מה קרה לכל קנייה מאז שנרשמה, מול S&P 500. מומלץ לעבור על זה פעם ברבעון.</p>
   <div class="scroll"><table class="tbl"><tr><th>נייר</th><th>למה קניתי</th><th>מאז</th><th>S&P 500</th><th>הודאה בטעות</th></tr>
   ${R.map(({ j, ch, sp, hit }) => `<tr><td><b>${esc(j.sym)}</b><div class="small muted">${esc(j.date)}</div></td><td class="small">${esc(j.thesis)}</td><td class="n ${sgn(ch)}">${r1(ch)}</td><td class="n small">${r1(sp)}${ch != null && sp != null ? `<div class="${sgn(ch - sp)}">${ch >= sp ? "מנצח" : "מפגר"}</div>` : ""}</td>
    <td class="small">${esc(j.exit || "—")}<div>${hit === true ? '<span class="tag stale">התנאי התקיים</span>' : hit === "check" ? '<span class="tag est">לבדוק</span>' : hit === false ? '<span class="tag fact">עוד לא</span>' : ""}</div></td></tr>`).join("")}</table></div></div>`;
}
const _jv = VIEWS.journal;
VIEWS.journal = async m => { await _jv(m); const h = await thesisHTML(); if (h) m.querySelector("h1").insertAdjacentHTML("afterend", h); };

/* ---------- רשימת מעקב עם התראות ---------- */
const RULES = { drop: "ירידה של % ממחיר ההוספה", dropHi: "ירידה של % מהשיא השנתי", score: "ציון מעל", big: "משקיע גדול פתח פוזיציה חדשה", above: "מחיר מעל", below: "מחיר מתחת" };
const W = () => (S.watch || []).filter(w => w.sym);
function evalWatch(od, X) {
  const res = [];
  for (const w of W()) {
    const r = od.u[w.sym]; if (!r) continue; const p = r.p, s = scoreOf(r, X || myCtx()).s;
    for (const ru of (w.rules || [])) {
      const n = +ru.v; let hit = false, txt = "";
      if (ru.k === "drop" && p && w.addP) { const c = (p / w.addP - 1) * 100; hit = c <= -n; txt = `ירד ${pct(-c)} מאז ההוספה`; }
      if (ru.k === "dropHi" && p && r.hi52) { const c = (p / r.hi52 - 1) * 100; hit = c <= -n; txt = `${pct(-c)} מתחת לשיא השנתי`; }
      if (ru.k === "score" && s != null) { hit = s >= n; txt = `ציון ${s}`; }
      if (ru.k === "big") { const nw = (r.hold || []).filter(h => h[2] === "new").map(h => od.f13.m[h[0]]?.he).filter(Boolean); hit = nw.length > 0; txt = `קנייה חדשה: ${nw.join(", ")}`; }
      if (ru.k === "above" && p) { hit = p >= n; txt = `מחיר ${p}`; }
      if (ru.k === "below" && p) { hit = p <= n; txt = `מחיר ${p}`; }
      if (hit) res.push({ w, ru, txt });
    }
  }
  return res;
}
const ruleTxt = ru => ru.k === "big" ? RULES.big : `${RULES[ru.k]} ${ru.v}${/drop/.test(ru.k) ? "%" : ""}`;
VIEWS.watch = async m => {
  let od; try { od = await oppData(); } catch (e) { m.innerHTML = '<div class="alert warn">נתוני המעקב עוד לא נבנו.</div>'; return; }
  const X = myCtx(), hits = evalWatch(od, X), hs = new Set(hits.map(h => h.w.id));
  m.innerHTML = `<h1>מעקב והתראות</h1><p class="muted">ניירות שמעניינים אותך, וכללים פשוטים מתי לקבל התראה. הבדיקה רצה בכל פתיחה של האתר.</p>
   ${hits.length ? `<div class="card"><h2>🔔 התראות עכשיו</h2>${hits.map(h => `<div class="alert warn"><b>${esc(h.w.sym)}</b>: ${esc(ruleTxt(h.ru))} – ${esc(h.txt)} <button class="btn sec" data-chk="${esc(h.w.sym)}">בדיקה לפני קנייה</button></div>`).join("")}</div>` : `<div class="alert ok">אין התראות כרגע.</div>`}
   <div class="card"><h2>➕ הוספה לרשימה</h2><div class="row"><input id="wS" list="wL" placeholder="טיקר" style="flex:1 1 90px" autocomplete="off"><datalist id="wL">${Object.values(od.u).map(r => `<option value="${esc(r.t)}">${esc(r.n)}</option>`).join("")}</datalist>
    <select id="wK" style="flex:2 1 160px">${Object.entries(RULES).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select><input id="wV" type="number" placeholder="15" style="flex:1 1 70px"><button class="btn" id="wAdd">הוספה</button></div>
    <p class="small muted">אפשר להוסיף כמה כללים לאותו נייר.</p></div>
   <div class="grid g2">${W().map(w => { const r = od.u[w.sym];
     return `<div class="card${hs.has(w.id) ? " hit" : ""}"><div class="ih">${r ? badge(scoreOf(r, X).s) : ""}<div><b>${esc(w.sym)}</b> <span class="muted small">${esc(r?.n || "לא במאגר")}</span><div class="small muted">נוסף ${esc(w.date)}${w.addP ? ` במחיר ${w.addP}` : ""}${r?.p ? ` · עכשיו ${r.p}` : ""}</div></div></div>
     <ul class="vl">${(w.rules || []).map((ru, i) => `<li>${esc(ruleTxt(ru))} <button class="btn del" data-wr="${w.id}:${i}" aria-label="מחיקת כלל">✕</button></li>`).join("") || "<li class=muted>אין כללים</li>"}</ul>
     <div class="row"><button class="btn sec" data-chk="${esc(w.sym)}">בדיקה לפני קנייה</button><button class="btn del" data-wd="${w.id}">הסרה</button></div></div>`; }).join("") || '<p class="muted">הרשימה ריקה.</p>'}</div>
   <div class="card" style="margin-top:14px"><h2>📧 התראות במייל (רשות)</h2>
    <p class="small">אם תרצה, ההרצה היומית תבדוק את הרשימה כל בוקר. כשכלל מתקיים, נפתח "Issue" בגיטהאב, וגיטהאב שולח לך עליו מייל בחינם.</p>
    <div class="alert warn small"><b>חשוב:</b> המאגר ציבורי. אם תפעיל, <b>רשימת הטיקרים והכללים תהיה גלויה לכולם</b> בקובץ watchlist.json. לא נשמרים שם אחזקות, כמויות או סכומים.</div>
    <label class="small"><input type="checkbox" id="wOk"> הבנתי שהטיקרים יהיו ציבוריים</label>
    <div class="row" style="margin-top:8px"><button class="btn" id="wExp" disabled>העלאת הרשימה לגיטהאב</button></div><div id="wMsg" class="small"></div></div>
   <p class="small muted">התראות המייל משתמשות בציון ללא "התאמה לתיק" (כי התיק לא נשלח). אומדן, לא ייעוץ.</p>`;
  $("#wAdd").onclick = () => {
    const s = $("#wS").value.trim().toUpperCase(), k = $("#wK").value, v = $("#wV").value; if (!s) return;
    if (k !== "big" && !v) return alert("נא להזין ערך לכלל");
    let w = S.watch.find(x => x.sym === s); if (!w) { w = { id: uid(), sym: s, date: today(), addP: od.u[s]?.p ?? null, rules: [] }; S.watch.push(w); }
    w.rules = w.rules || []; w.rules.push({ k, v: k === "big" ? null : +v }); save(); go();
  };
  $$("[data-wd]", m).forEach(b => b.onclick = () => { S.watch = S.watch.filter(w => w.id !== b.dataset.wd); save(); go(); });
  $$("[data-wr]", m).forEach(b => b.onclick = () => { const [id, i] = b.dataset.wr.split(":"); const w = S.watch.find(x => x.id === id); w.rules.splice(+i, 1); save(); go(); });
  $("#wOk").onchange = e => $("#wExp").disabled = !e.target.checked;
  $("#wExp").onclick = async () => {
    const body = JSON.stringify({ note: "רשימת מעקב ציבורית – טיקרים וכללים בלבד", updated: today(), items: W().map(w => ({ sym: w.sym, addP: w.addP, rules: w.rules || [] })) }, null, 1);
    let exists = false; try { exists = (await fetch("watchlist.json", { cache: "no-cache" })).ok; } catch (e) {}
    try { await navigator.clipboard.writeText(body); } catch (e) {}
    const url = exists ? `https://github.com/${DREPO}/edit/main/watchlist.json` : `https://github.com/${DREPO}/new/main?filename=watchlist.json&value=${encodeURIComponent(body)}`;
    window.open(url, "_blank", "noopener");
    $("#wMsg").innerHTML = exists ? "נפתח עורך הקובץ בגיטהאב. הרשימה הועתקה – הדבק אותה במקום התוכן הקיים ולחץ Commit." : "נפתח דף בגיטהאב עם הרשימה מוכנה. לחץ Commit, ומהבוקר הבא תקבל התראות במייל.";
  };
};
/* כפתורי גישה מהסקירה */
const _dv = VIEWS.dash;
VIEWS.dash = async m => {
  await _dv(m); let n = 0; try { n = evalWatch(await oppData()).length; } catch (e) {}
  m.querySelector("h1").insertAdjacentHTML("afterend", `<div class="card qa"><div class="row"><button class="btn" id="qaChk">🛒 בדיקה לפני קנייה</button><button class="btn sec" id="qaW">🔔 מעקב והתראות${n ? ` (${n})` : ""}</button></div></div>`);
  $("#qaChk").onclick = () => openCheck(); $("#qaW").onclick = () => { tab = "watch"; history.replaceState(null, "", "#watch"); go(); };
};
const _tv = VIEWS.today;
VIEWS.today = async m => {
  await _tv(m); let n = 0; try { n = evalWatch(await oppData()).length; } catch (e) {}
  m.querySelector("h1")?.insertAdjacentHTML("afterend", `<div class="row qa"><button class="btn" id="qaChk">🛒 בדיקה לפני קנייה</button><button class="btn sec" id="qaW">🔔 מעקב${n ? ` – ${n} התראות` : ""}</button></div>`);
  $("#qaChk").onclick = () => openCheck(); $("#qaW").onclick = () => { tab = "watch"; history.replaceState(null, "", "#watch"); go(); };
};
