/* FutureInvest – מודול נדל"ן. כל החישובים אומדנים. */
"use strict";
TABS.splice(4, 0, ["re", 'נדל"ן']);
const RE = () => (S.re ||= []);
let reOpen = null, reAppr = 3, reMarg = 35, reCPI = 0;
function fxILS(c) { // ILS per 1 unit of currency c
  if (!c || c === "ILS") return 1; const u = fx();
  if (c === "USD") return u; if (c === "EUR") return (D.fxx?.EUR || 1.16) * u; if (c === "GBP") return (D.fxx?.GBP || 1.33) * u; return u;
}
const annuity = (bal, ratePct, years) => { const r = ratePct / 100 / 12, n = Math.max(1, Math.round(years * 12)); return r ? bal * r / (1 - Math.pow(1 + r, -n)) : bal / n; };
const monthsSince = d => { if (!d) return 0; const a = new Date(d), b = new Date(); return Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth()); };
function reCalc(p, o = {}) {
  const k = fxILS(p.cur), own = (p.own ?? 100) / 100;
  const value = (p.value || p.price || 0) * k * own * (1 + (o.dv || 0) / 100);
  const costs = ((p.cTax || 0) + (p.cLaw || 0) + (p.cBroker || 0) + (p.cReno || 0)) * k * own;
  const totalCost = (p.price || 0) * k * own + costs;
  const morts = (p.morts || []).map(m => { const rate = m.rate + (m.type !== "קבועה" ? (o.dr || 0) : 0), bal = (m.bal || 0) * k * own;
    const pay = o.dr && m.type !== "קבועה" ? annuity(bal, rate, m.years) : (m.pay ? m.pay * k * own : annuity(bal, rate, m.years)); return { ...m, rate, bal, pay }; });
  const debt = morts.reduce((a, m) => a + m.bal, 0), ds = morts.reduce((a, m) => a + m.pay, 0) * 12;
  const vac = Math.min(100, (p.vac || 0) + (o.dvac || 0)) / 100;
  const grossRent = (p.rent || 0) * k * own * 12, rentEff = grossRent * (1 - vac);
  const opex = ((p.eVaad || 0) + (p.eArnona || 0) + (p.eIns || 0) + (p.eMaint || 0) + (p.eMgmt || 0)) * k * own * 12;
  const noi = rentEff - opex, cf = noi - ds, equity = value - debt;
  const interest1 = morts.reduce((a, m) => a + m.bal * m.rate / 100, 0), principal1 = ds - interest1;
  const invested = p.equityIn ? p.equityIn * k * own : Math.max(1, totalCost - debt);
  const months = monthsSince(p.date), accCF = cf * months / 12;
  // IRR: -invested at t0, monthly cf, terminal equity now
  let irr = null;
  if (months >= 6 && invested > 0) {
    const f = r => { let v = -invested; const mc = cf / 12; for (let t = 1; t <= months; t++) v += mc / Math.pow(1 + r, t); return v + equity / Math.pow(1 + r, months); };
    let lo = -0.05, hi = 0.1; if (f(lo) * f(hi) < 0) { for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; f(lo) * f(mid) <= 0 ? hi = mid : lo = mid; } irr = (Math.pow(1 + lo, 12) - 1) * 100; }
  }
  return { k, value, totalCost, costs, morts, debt, ds, grossRent, rentEff, opex, noi, cf, equity, invested, interest1, principal1, months, accCF, irr,
    gy: grossRent / value * 100, ny: noi / value * 100, coc: cf / invested * 100, roe: equity > 0 ? (cf + principal1) / equity * 100 : null, ltv: debt / value * 100,
    appr: value - totalCost, totRet: value - totalCost + accCF };
}
function reTax(p, c) {
  const R = FI_RULES, own = (p.own ?? 100) / 100, monthly = c.rentEff / 12, ceil = R.rentExempt.ceilingMonthly;
  const taxableEx = monthly <= ceil ? 0 : monthly >= 2 * ceil ? monthly : 2 * (monthly - ceil);
  const exemptTrack = p.type === "מגורים" ? taxableEx * 12 * reMarg / 100 : null;
  const t10 = c.grossRent * (1 - (p.vac || 0) / 100) * R.rent10.rate;
  const dep = (p.price || 0) * c.k * own * 0.7 * 0.02; // מבנה ~70% מהמחיר, 2% פחת
  const marg = Math.max(0, c.noi - c.interest1 - dep) * reMarg / 100;
  const realCost = c.totalCost * (1 + reCPI / 100), gain = c.value - realCost, shevach = Math.max(0, gain) * R.shevach.rate;
  return { exemptTrack, taxableEx, t10, marg, dep, gain, shevach, ceil };
}
const n0 = x => x == null || isNaN(x) ? "—" : (x < 0 ? "−" : "") + "₪" + Math.abs(Math.round(x)).toLocaleString("he-IL");
function reTotals() {
  let value = 0, debt = 0, cf = 0, noi = 0, ils = 0; const per = [];
  for (const p of RE()) { const c = reCalc(p); value += c.value; debt += c.debt; cf += c.cf; noi += c.noi; if ((p.cur || "ILS") === "ILS") ils += c.equity; per.push([p.name, c.equity, c]); }
  return { value, debt, equity: value - debt, cf, noi, ils, per, ny: value ? noi / value * 100 : null };
}
const BLANK = () => ({ id: uid(), name: "דירה חדשה", city: "", type: "מגורים", country: "IL", cur: "ILS", date: "", price: 0, cTax: 0, cLaw: 0, cBroker: 0, cReno: 0, value: 0, vDate: today(), vSrc: "", own: 100,
  morts: [], rent: 0, vac: 4, eVaad: 0, eArnona: 0, eIns: 0, eMaint: 0, eMgmt: 0, taxStatus: "דירה יחידה", equityIn: null });

VIEWS.re = async m => {
  const T = reTotals(), list = RE();
  m.innerHTML = `<h1>נדל"ן</h1>
  <div class="alert warn">כל המספרים במסך הם ${tag("est")} שמבוססים על הנתונים שהזנת. אינו ייעוץ השקעות או מס. ${esc(FI_RULES.disclaimer)}</div>
  <div class="grid g4"><div class="card kpi"><div class="l">שווי (חלקך)</div><div class="v">${n0(T.value)}</div></div><div class="card kpi"><div class="l">משכנתאות</div><div class="v">${n0(T.debt)}</div></div>
   <div class="card kpi"><div class="l">הון עצמי בנדל"ן</div><div class="v">${n0(T.equity)}</div></div><div class="card kpi"><div class="l">תזרים חודשי אחרי משכנתא</div><div class="v ${sgn(T.cf)}">${n0(T.cf / 12)}</div><div class="muted">תשואה נטו ממוצעת ${pct(T.ny)}</div></div></div>
  <div class="row" style="margin:12px 0"><button class="btn" id="reAdd">+ הוספת נכס</button>
   <label class="f" style="max-width:170px">עליית ערך שנתית מונחת %<input id="reAppr" type="number" step="0.5" value="${reAppr}"></label>
   <label class="f" style="max-width:170px">מס שולי משוער %<input id="reMarg" type="number" value="${reMarg}"></label>
   <label class="f" style="max-width:190px">אינפלציה מצטברת מאז הרכישה %<input id="reCPI" type="number" value="${reCPI}"></label></div>
  ${list.length ? "" : '<div class="card"><p class="muted">עוד לא הוזנו נכסים.</p></div>'}
  ${list.map(p => reCard(p)).join("")}`;
  $("#reAdd").onclick = () => { const p = BLANK(); RE().push(p); reOpen = p.id; save(); go(); };
  $("#reAppr").onchange = e => { reAppr = +e.target.value; go(); }; $("#reMarg").onchange = e => { reMarg = +e.target.value; go(); }; $("#reCPI").onchange = e => { reCPI = +e.target.value; go(); };
  $$("[data-rf]", m).forEach(i => i.onchange = () => { const p = RE().find(x => x.id === i.dataset.id), k = i.dataset.rf; p[k] = i.type === "number" ? (i.value === "" ? null : +i.value) : i.value; reOpen = p.id; save(); go(); });
  $$("[data-mf]", m).forEach(i => i.onchange = () => { const p = RE().find(x => x.id === i.dataset.id), mm = p.morts[+i.dataset.i]; mm[i.dataset.mf] = i.type === "number" ? +i.value : i.value; reOpen = p.id; save(); go(); });
  $$("[data-madd]", m).forEach(b => b.onclick = () => { const p = RE().find(x => x.id === b.dataset.madd); p.morts.push({ bal: 0, rate: 5, type: "פריים", pay: 0, years: 20 }); reOpen = p.id; save(); go(); });
  $$("[data-mdel]", m).forEach(b => b.onclick = () => { const p = RE().find(x => x.id === b.dataset.id); p.morts.splice(+b.dataset.mdel, 1); reOpen = p.id; save(); go(); });
  $$("[data-redel]", m).forEach(b => b.onclick = () => { if (confirm("למחוק את הנכס?")) { S.re = RE().filter(x => x.id !== b.dataset.redel); save(); go(); } });
  $$("details[data-pid]", m).forEach(d => d.ontoggle = () => { if (d.open) { reOpen = d.dataset.pid; reChart(RE().find(x => x.id === reOpen)); } });
  const op = RE().find(x => x.id === reOpen); if (op) reChart(op);
};
function reCard(p) {
  const c = reCalc(p), t = reTax(p, c), id = p.id, R = FI_RULES;
  const f = (k, l, type = "number", w = "") => `<label class="f" ${w}>${l}<input data-rf="${k}" data-id="${id}" type="${type}" step="any" value="${esc(p[k] ?? "")}"></label>`;
  const sel = (k, l, opts) => `<label class="f">${l}<select data-rf="${k}" data-id="${id}">${opts.map(o => `<option ${p[k] === o ? "selected" : ""}>${o}</option>`).join("")}</select></label>`;
  const sens = [["בסיס", {}], ["ריבית +1%", { dr: 1 }], ["ריבית +2%", { dr: 2 }], ["תפוסה: +10% ריק", { dvac: 10 }], ["שווי −10%", { dv: -10 }], ["שווי −20%", { dv: -20 }]].map(([l, o]) => { const s = reCalc(p, o); return `<tr><td>${l}</td><td class="n ${sgn(s.cf)}">${n0(s.cf / 12)}</td><td class="n">${pct(s.ny)}</td><td class="n">${pct(s.coc)}</td><td class="n ${s.ltv > 75 ? "neg" : ""}">${pct(s.ltv)}</td><td class="n">${n0(s.equity)}</td></tr>`; }).join("");
  const kv = (l, v, cls = "") => `<tr><td>${l}</td><td class="n ${cls}">${v}</td></tr>`;
  return `<details class="card" data-pid="${id}" ${reOpen === id ? "open" : ""} style="margin-bottom:10px"><summary><b>${esc(p.name)}</b> · ${esc(p.city || "")} · שווי ${n0(c.value)} · הון ${n0(c.equity)} · תזרים <span class="${sgn(c.cf)}">${n0(c.cf / 12)}</span>/חודש</summary>
  <div class="grid g2" style="margin-top:10px"><div>
   <h3>פרטי הנכס</h3><div class="grid g3">${f("name", "שם", "text")}${f("city", "עיר / כתובת", "text")}${sel("type", "סוג", ["מגורים", "מסחרי", "קרקע", 'חו"ל'])}
    ${f("country", "מדינה (קוד)", "text")}${sel("cur", "מטבע", ["ILS", "USD", "EUR", "GBP"])}${f("date", "תאריך רכישה", "date")}
    ${f("price", "מחיר רכישה")}${f("cTax", "מס רכישה")}${f("cLaw", "עו\"ד")}${f("cBroker", "תיווך")}${f("cReno", "שיפוץ")}${f("own", "אחוז בעלות")}
    ${f("value", "שווי נוכחי מוערך")}${f("vDate", "תאריך הערכה", "date")}${f("vSrc", "מקור ההערכה", "text")}
    ${sel("taxStatus", "סטטוס למס", ["דירה יחידה", "דירה להשקעה"])}${f("equityIn", "הון עצמי שהושקע (ריק = מחיר+עלויות−משכנתא)")}</div>
   <h3>משכנתאות</h3>${(p.morts || []).map((mm, i) => `<div class="row">${["bal:יתרה", "rate:ריבית %", "pay:החזר חודשי (ריק=מחושב)", "years:שנים שנותרו"].map(s => { const [k, l] = s.split(":"); return `<label class="f" style="flex:1 1 90px">${l}<input data-mf="${k}" data-id="${id}" data-i="${i}" type="number" step="any" value="${mm[k] || ""}"></label>`; }).join("")}
     <label class="f" style="flex:1 1 90px">סוג<select data-mf="type" data-id="${id}" data-i="${i}">${["פריים", "קבועה", "משתנה"].map(o => `<option ${mm.type === o ? "selected" : ""}>${o}</option>`).join("")}</select></label><button class="btn del" data-mdel="${i}" data-id="${id}" aria-label="מחיקת מסלול">✕</button></div>`).join("")}
    <button class="btn sec" data-madd="${id}">+ מסלול משכנתא</button>
   <h3>הכנסות והוצאות (חודשי)</h3><div class="grid g3">${f("rent", "שכר דירה")}${f("vac", "אחוז זמן ריק")}${f("eVaad", "ועד בית")}${f("eArnona", "ארנונה (אם על הבעלים)")}${f("eIns", "ביטוח")}${f("eMaint", "תחזוקה")}${f("eMgmt", "ניהול")}</div>
   <p class="small muted">${p.cur !== "ILS" ? `מומר לשקלים בשער ${c.k.toFixed(3)} (Yahoo Finance). ` : ""}הסכומים מוזנים לנכס כולו; החישובים לפי אחוז הבעלות. הערכת שווי: ${esc(p.vSrc || "לא צוין מקור")} · ${esc(p.vDate || "")}</p>
   <button class="btn del" data-redel="${id}">מחיקת הנכס</button></div>
  <div><h3>מדדים ${tag("est")}</h3><table class="tbl">
   ${kv("תשואה ברוטו", pct(c.gy, 2))}${kv("תשואה נטו (NOI / שווי)", pct(c.ny, 2))}${kv("תשואה על ההון שהושקע (Cash-on-Cash)", pct(c.coc, 2), sgn(c.coc))}${kv("תשואה על ההון הנוכחי (תזרים + החזר קרן)", pct(c.roe, 2))}
   ${kv("NOI שנתי", n0(c.noi))}${kv("החזרי משכנתא שנתיים", n0(c.ds))}${kv("תזרים חודשי / שנתי אחרי משכנתא", n0(c.cf / 12) + " / " + n0(c.cf), sgn(c.cf))}
   ${kv("מינוף (LTV)", pct(c.ltv), c.ltv > 75 ? "neg" : "")}${kv("הון עצמי נוכחי", n0(c.equity))}
   ${kv("עליית ערך מאז הרכישה (כולל עלויות)", n0(c.appr), sgn(c.appr))}${kv(`תזרים מצטבר (${c.months} חודשים, בהנחת שכירות קבועה)`, n0(c.accCF))}${kv("תשואה כוללת", n0(c.totRet), sgn(c.totRet))}${kv("IRR שנתי משוער", c.irr == null ? "— (נדרש תאריך רכישה)" : pct(c.irr, 1))}</table>
   <h3>רגישות</h3><div class="scroll"><table class="tbl"><tr><th>תרחיש</th><th>תזרים/חודש</th><th>נטו</th><th>CoC</th><th>LTV</th><th>הון</th></tr>${sens}</table></div>
   <p class="small muted">עליית ריבית חלה על מסלולי פריים ומשתנה בלבד.</p>
   <h3>מיסוי ${tag("est")}</h3><table class="tbl">
   ${p.type === "מגורים" ? kv(`מסלול פטור (תקרה ${n0(t.ceil)}/חודש)`, t.taxableEx ? n0(t.exemptTrack) + " לשנה" : "פטור מלא") : ""}
   ${kv("מסלול 10% מהברוטו", n0(t.t10) + " לשנה")}${kv(`מסלול רגיל (שולי ${reMarg}%, כולל פחת ${n0(t.dep)})`, n0(t.marg) + " לשנה")}
   ${kv(`מס שבח אם נמכר היום (25% על שבח ריאלי ${n0(t.gain)})`, p.taxStatus === "דירה יחידה" ? "ייתכן פטור דירה יחידה · ללא פטור: " + n0(t.shevach) : n0(t.shevach))}</table>
   <p class="small muted">${esc(R.rentExempt.note)} ${esc(R.shevach.label)} רווח ממכירה מצטרף להכנסה לעניין מס יסף (${esc(R.surtax.label)}). מקורות: ${esc(R.rentExempt.source)}; ${esc(R.rent10.source)}; ${esc(R.shevach.source)}.</p>
  </div></div>
  <div class="card" style="margin-top:10px"><h3>לוח סילוקין ובניית הון (בהנחת עליית ערך ${reAppr}% בשנה)</h3><div class="chartbox sm"><canvas id="reC-${id}"></canvas></div><div class="scroll" style="max-height:260px"><table class="tbl" id="reT-${id}"></table></div></div></details>`;
}
function reSchedule(p) {
  const c = reCalc(p), yrs = Math.max(1, ...c.morts.map(m => Math.ceil(m.years || 0)));
  const ms = c.morts.map(m => ({ ...m, b: m.bal })), rows = [];
  for (let y = 1; y <= Math.min(yrs, 35); y++) {
    let int = 0, prin = 0;
    for (let mo = 0; mo < 12; mo++) for (const m of ms) { if (m.b <= 0) continue; const i = m.b * m.rate / 1200, pr = Math.min(m.b, m.pay - i); int += i; prin += pr; m.b -= pr; }
    const bal = ms.reduce((a, m) => a + Math.max(0, m.b), 0), val = c.value * Math.pow(1 + reAppr / 100, y);
    rows.push({ y, int, prin, bal, val, eq: val - bal });
  }
  return rows;
}
function reChart(p) {
  if (!p) return; const rows = reSchedule(p), id = p.id, t = document.getElementById("reT-" + id); if (!t) return;
  t.innerHTML = `<tr><th>שנה</th><th>ריבית</th><th>קרן</th><th>יתרה</th><th>שווי משוער</th><th>הון</th></tr>` + rows.map(r => `<tr><td>${r.y}</td><td class="n">${n0(r.int)}</td><td class="n">${n0(r.prin)}</td><td class="n">${n0(r.bal)}</td><td class="n">${n0(r.val)}</td><td class="n">${n0(r.eq)}</td></tr>`).join("");
  charts["reC-" + id]?.destroy();
  chart("reC-" + id, { type: "line", data: { labels: rows.map(r => "שנה " + r.y), datasets: [{ label: "יתרת משכנתא", data: rows.map(r => r.bal), borderColor: PAL[3], pointRadius: 0 }, { label: "הון עצמי", data: rows.map(r => r.eq), borderColor: PAL[1], pointRadius: 0 }, { label: "שווי", data: rows.map(r => r.val), borderColor: PAL[0], pointRadius: 0, borderDash: [4, 3] }] },
    options: { maintainAspectRatio: false, plugins: { legend: { rtl: true } }, scales: { y: { ticks: { callback: v => (v / 1e6).toFixed(1) + "M" } } } } });
}

/* ---- overview integration: net worth ---- */
const _dash = VIEWS.dash;
VIEWS.dash = async m => {
  await _dash(m);
  const T = reTotals(), sec = S.holdings.reduce((a, h) => a + valueUSD(h), 0) * fx();
  if (!RE().length && !sec) return;
  const nw = sec + T.equity, rePct = nw ? T.equity / nw * 100 : 0;
  const L = S.holdings.length ? await lookThrough() : null, secILS = L ? (L.cur.find(r => r[0] === "ILS")?.[1] || 0) * fx() : 0;
  const ilsPct = nw ? (secILS + T.ils) / nw * 100 : 0, big = T.per.sort((a, b) => b[1] - a[1])[0], bigPct = big && nw ? big[1] / nw * 100 : 0;
  const al = [];
  if (rePct > 60) al.push(`נדל"ן הוא ${pct(rePct)} מההון נטו – ריכוזיות גבוהה בנכס לא נזיל.`);
  if (bigPct > 40) al.push(`נכס בודד (${esc(big[0])}) הוא ${pct(bigPct)} מההון נטו.`);
  if (ilsPct > 70) al.push(`${pct(ilsPct)} מההון חשוף לשקל ולכלכלה הישראלית.`);
  $("h1", m).insertAdjacentHTML("afterend", `<div class="card" style="margin-bottom:14px"><h2>הון נטו ${tag("est")}</h2><div class="grid g4">
   <div class="kpi"><div class="l">הון נטו</div><div class="v">${n0(nw)}</div></div><div class="kpi"><div class="l">ניירות ערך</div><div class="v">${n0(sec)}</div></div>
   <div class="kpi"><div class="l">נדל"ן (שווי פחות משכנתאות)</div><div class="v">${n0(T.equity)}</div><div class="muted">שווי ${n0(T.value)} · חוב ${n0(T.debt)}</div></div>
   <div class="kpi"><div class="l">חשיפה לשקל</div><div class="v">${pct(ilsPct)}</div><div class="muted">נדל"ן ${pct(rePct)} מההון</div></div></div>
   <div class="chartbox sm" style="margin-top:10px"><canvas id="nwC"></canvas></div>${al.map(a => `<div class="alert warn">${a}</div>`).join("")}</div>`);
  doughnut("nwC", [["ניירות ערך", sec], ['נדל"ן (הון)', Math.max(0, T.equity)]].filter(r => r[1] > 0));
};
/* ---- simulator integration ---- */
const _sim = VIEWS.sim;
VIEWS.sim = async m => {
  await _sim(m); if (!RE().length) return;
  const T = reTotals(), o = simIn, b = DET.base, eq = (b[1] * o.eq + b[2] * (100 - o.eq)) / 100;
  m.insertAdjacentHTML("beforeend", `<div class="card" style="margin-top:14px"><h2>נדל"ן מול תיק ניירות הערך ${tag("est")}</h2><table class="tbl">
   <tr><td>תשואה נטו שוטפת מהנדל"ן (NOI / שווי, לפני מס ומימון)</td><td class="n">${pct(T.ny, 2)}</td></tr>
   <tr><td>תשואת תיק בתרחיש הבסיס (נומינלי, לפני דמי ניהול)</td><td class="n">${pct(eq, 2)}</td></tr>
   <tr><td>תזרים חודשי מהנדל"ן אחרי משכנתא</td><td class="n ${sgn(T.cf)}">${n0(T.cf / 12)}</td></tr></table>
   <p class="small muted">תשואת הנדל"ן כאן היא שוטפת בלבד – בלי עליית ערך ובלי מינוף; תשואת התיק כוללת עליית מחירים. ההשוואה נועדה לשאלה "מה מניב יותר על השקל", לא המלצה.</p>
   ${T.cf > 0 ? `<button class="btn sec" id="reToSim">הוספת התזרים מהנדל"ן (${n0(T.cf / 12)}) להפקדה החודשית</button>` : ""}</div>`);
  const btn = $("#reToSim"); if (btn) btn.onclick = () => { simIn.monthly = Math.round(simIn.monthly + T.cf / 12); go(); };
};
/* ---- demo property for data tab ---- */
const _data = VIEWS.data;
VIEWS.data = async m => {
  await _data(m);
  $("#demo").insertAdjacentHTML("afterend", ' <button class="btn sec" id="reDemo">נכס לדוגמה</button>');
  $("#reDemo").onclick = () => { RE().push({ ...BLANK(), name: "דירה להשקעה – חיפה", city: "חיפה", date: "2019-06-01", price: 1400000, cTax: 112000, cLaw: 12000, cBroker: 25000, cReno: 60000, value: 1950000, vSrc: "עסקאות דומות באתר רשות המסים", own: 100, taxStatus: "דירה להשקעה",
    morts: [{ bal: 600000, rate: 5.5, type: "פריים", pay: 0, years: 18 }, { bal: 250000, rate: 4.2, type: "קבועה", pay: 0, years: 18 }], rent: 5600, vac: 4, eVaad: 150, eIns: 120, eMaint: 250, eMgmt: 0 }); reOpen = RE()[RE().length - 1].id; save(); tab = "re"; location.hash = "re"; go(); };
};
