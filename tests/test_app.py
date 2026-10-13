import sys, subprocess, time, os
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8793/"
srv = None
if "localhost" in BASE:
    srv = subprocess.Popen([sys.executable, "-m", "http.server", "8793"], cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
TABS = ["today", "plan", "re", "dash", "profile", "port", "expo", "cmp", "isr", "sim", "stress", "journal", "data"]
fails = []
try:
  with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get("CHROME", "/usr/bin/google-chrome"))
    for name, ctx_args in [("desktop", {"viewport": {"width": 1366, "height": 900}}), ("mobile", {**p.devices["iPhone 13"]})]:
        ctx = b.new_context(**ctx_args); pg = ctx.new_page(); errs = []
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None); pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("dialog", lambda d: d.accept())
        pg.goto(BASE + "#data"); pg.wait_for_selector("#demo"); pg.click("#demo"); pg.wait_for_selector("text=אחזקות"); pg.wait_for_timeout(1500)
        pg.goto(BASE + "#data"); pg.reload(); pg.wait_for_selector("#reDemo"); pg.click("#reDemo"); pg.wait_for_selector("text=IRR שנתי משוער"); pg.wait_for_timeout(800)
        if "הון נטו" in "": pass
        pg.goto(BASE + "#port"); pg.reload(); pg.wait_for_timeout(1500)
        n = pg.locator("table.tbl tr").count()
        if n < 7: fails.append(f"{name}: demo holdings rows {n}")
        for t in TABS:
            pg.goto(BASE + "#" + t); pg.reload(); pg.wait_for_timeout(2200)
            txt = pg.inner_text("main")
            if "שגיאה" in txt or "טוען" in txt or "מחשב…" in txt: fails.append(f"{name}/{t}: {txt[:120]}")
            pg.screenshot(path=f"tests/shots/{name}-{t}.png", full_page=(t in ("expo","sim")))
            sw = pg.evaluate("document.documentElement.scrollWidth - innerWidth")
            if sw > 2: fails.append(f"{name}/{t}: horizontal overflow {sw}px")
        # הזדמנויות היום: לשונית ראשונה, ברירת מחדל, רעיונות, אירועים, 13F, חיפוש, משקלות
        pg.goto(BASE); pg.reload(); pg.wait_for_timeout(2500)
        if pg.locator("#tabs button").first.inner_text() != "הזדמנויות היום": fails.append(f"{name}: today not first tab")
        t = pg.inner_text("main")
        for need in ["רעיונות היום", "מה קורה בעולם", "המשקיעים הגדולים", "לא ייעוץ"]:
            if need not in t: fails.append(f"{name}: today missing {need}")
        if pg.locator(".idea").count() < 3: fails.append(f"{name}: fewer than 3 ideas")
        if pg.locator(".ev").count() < 3: fails.append(f"{name}: fewer than 3 events")
        pg.fill("#oq", "NVDA"); pg.click("#oqGo"); pg.wait_for_timeout(300)
        if "למה הציון הזה" not in pg.inner_text("#oqOut") or "ביצועי עבר" not in pg.inner_text("#oqOut"): fails.append(f"{name}: search score")
        pg.fill("#oq", "ZZZZ"); pg.click("#oqGo"); pg.wait_for_timeout(200)
        if "לא נמצא" not in pg.inner_text("#oqOut"): fails.append(f"{name}: search missing")
        s0 = pg.locator(".idea .sc").first.inner_text()
        pg.evaluate("document.querySelector('details.card').open=true"); pg.fill("[data-ow=risk]", "50"); pg.dispatch_event("[data-ow=risk]", "change"); pg.wait_for_timeout(800)
        if "\"risk\":50" not in pg.evaluate("localStorage.getItem('futureinvest.v1')"): fails.append(f"{name}: weights not saved")
        pg.evaluate("document.querySelector('#owReset').click()"); pg.wait_for_timeout(500)
        sw = pg.evaluate("document.documentElement.scrollWidth - innerWidth")
        if sw > 2: fails.append(f"{name}/today: overflow {sw}px")
        pg.goto(BASE + "#dash"); pg.reload(); pg.wait_for_timeout(2000)
        if "הון נטו" not in pg.inner_text("main"): fails.append(f"{name}: net worth")
        pg.goto(BASE + "#plan"); pg.reload(); pg.wait_for_timeout(2500)
        t = pg.inner_text("main")
        if "לאן להפנות את ההפקדה הבאה" not in t or "עדיפות" not in t: fails.append(f"{name}: plan")
        pg.fill("#depA", "50000"); pg.click("#depGo"); pg.wait_for_timeout(300)
        if "₪" not in pg.inner_text("#depOut"): fails.append(f"{name}: deposit calc")
        pg.goto(BASE + "#dash"); pg.reload(); pg.wait_for_timeout(2500)
        if "3 הפעולות החשובות" not in pg.inner_text("main"): fails.append(f"{name}: top3 card")
        pg.goto(BASE + "#re"); pg.reload(); pg.wait_for_timeout(1500)
        if "IRR" not in pg.text_content("main"): fails.append(f"{name}: re persistence")
        # sale flow + persistence
        pg.goto(BASE + "#isr"); pg.reload(); pg.wait_for_selector("#sCalc"); pg.select_option("#sH", index=2); pg.fill("#sInc", "800000"); pg.click("#sCalc"); pg.wait_for_selector("#sWhy")
        if "מס רווח הון" not in pg.inner_text("#sOut"): fails.append(f"{name}: sale calc")
        pg.fill("#sWhy", "בדיקה"); pg.click("#sRec"); pg.wait_for_timeout(500)
        pg.goto(BASE + "#journal"); pg.reload(); pg.wait_for_timeout(1500)
        if "בדיקה" not in pg.inner_text("main") and "צינון" not in pg.inner_text("body"): fails.append(f"{name}: journal persistence")
        pg.goto(BASE + "#sim"); pg.reload(); pg.wait_for_timeout(2500)
        if "סיכוי להגיע ליעד" not in pg.inner_text("main"): fails.append(f"{name}: sim")
        # optional: real portfolio file (local only, never committed)
        csvp = os.environ.get("PORT_CSV")
        if csvp and os.path.exists(csvp):
            pg.evaluate("localStorage.clear()"); pg.goto(BASE + "#port"); pg.reload(); pg.wait_for_selector("#impFile", state="attached")
            pg.set_input_files("#impFile", csvp); pg.wait_for_timeout(2000)
            pg.goto(BASE + "#plan"); pg.reload(); pg.wait_for_timeout(3500)
            t = pg.inner_text("main"); open(f"tests/shots/plan-real-{name}.txt", "w").write(t)
            for need in ["מס עיזבון אמריקאי", "איחוד נושא", "TQQQ"]:
                if need not in t: fails.append(f"{name}: real plan missing {need}")
            pg.screenshot(path=f"tests/shots/{name}-plan-real.png", full_page=True)
            sw = pg.evaluate("document.documentElement.scrollWidth - innerWidth")
            if sw > 2: fails.append(f"{name}/plan-real: overflow {sw}px")
            pg.goto(BASE + "#dash"); pg.reload(); pg.wait_for_timeout(3000)
            if "3 הפעולות החשובות" not in pg.inner_text("main"): fails.append(f"{name}: real top3")
        if errs: fails.append(f"{name}: console errors {errs[:3]}")
        ctx.close()
    b.close()
finally:
    if srv: srv.terminate()
print("FAILS:", fails if fails else "none")
