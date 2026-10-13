import sys, subprocess, time, os
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8791/"
srv = None
if "localhost" in BASE:
    srv = subprocess.Popen([sys.executable, "-m", "http.server", "8791"], cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
TABS = ["dash", "profile", "port", "expo", "cmp", "isr", "sim", "stress", "journal", "data"]
fails = []
try:
  with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get("CHROME", "/usr/bin/google-chrome"))
    for name, ctx_args in [("desktop", {"viewport": {"width": 1366, "height": 900}}), ("mobile", {**p.devices["iPhone 13"]})]:
        ctx = b.new_context(**ctx_args); pg = ctx.new_page(); errs = []
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None); pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("dialog", lambda d: d.accept())
        pg.goto(BASE + "#data"); pg.wait_for_selector("#demo"); pg.click("#demo"); pg.wait_for_selector("text=אחזקות"); pg.wait_for_timeout(1500)
        n = pg.locator("table.tbl tr").count()
        if n < 7: fails.append(f"{name}: demo holdings rows {n}")
        for t in TABS:
            pg.goto(BASE + "#" + t); pg.reload(); pg.wait_for_timeout(2200)
            txt = pg.inner_text("main")
            if "שגיאה" in txt or "טוען" in txt or "מחשב…" in txt: fails.append(f"{name}/{t}: {txt[:120]}")
            pg.screenshot(path=f"tests/shots/{name}-{t}.png", full_page=(t in ("expo","sim")))
            sw = pg.evaluate("document.documentElement.scrollWidth - innerWidth")
            if sw > 2: fails.append(f"{name}/{t}: horizontal overflow {sw}px")
        # sale flow + persistence
        pg.goto(BASE + "#isr"); pg.reload(); pg.wait_for_selector("#sCalc"); pg.select_option("#sH", index=2); pg.fill("#sInc", "800000"); pg.click("#sCalc"); pg.wait_for_selector("#sWhy")
        if "מס רווח הון" not in pg.inner_text("#sOut"): fails.append(f"{name}: sale calc")
        pg.fill("#sWhy", "בדיקה"); pg.click("#sRec"); pg.wait_for_timeout(500)
        pg.goto(BASE + "#journal"); pg.reload(); pg.wait_for_timeout(1500)
        if "בדיקה" not in pg.inner_text("main") and "צינון" not in pg.inner_text("body"): fails.append(f"{name}: journal persistence")
        pg.goto(BASE + "#sim"); pg.reload(); pg.wait_for_timeout(2500)
        if "סיכוי להגיע ליעד" not in pg.inner_text("main"): fails.append(f"{name}: sim")
        if errs: fails.append(f"{name}: console errors {errs[:3]}")
        ctx.close()
    b.close()
finally:
    if srv: srv.terminate()
print("FAILS:", fails if fails else "none")
