# FutureInvest – שלב 1 (כלי מחקר אישי)
אתר סטטי (GitHub Pages) + נתונים שמחושבים מראש פעם ביום ב-GitHub Actions (`pipeline/build.py` → `data/`). אפס עלות שוטפת, בלי מפתחות API.
- נתונים אישיים: localStorage בדפדפן, עם ייצוא/ייבוא JSON.
- מקורות: SEC EDGAR N-PORT, State Street SSGA, Yahoo Finance (לא רשמי). כללי מס: `rules.js`.
- להוספת מניה לעדכון מחיר יומי: `pipeline/extra_tickers.txt`.
- SEC דורש User-Agent עם מייל: מומלץ להגדיר secret בשם `SEC_UA` (למשל `FutureInvest your@email.com`).
- בדיקות: `python3 tests/test_app.py` (Playwright, דסקטופ + מובייל).
אינו ייעוץ השקעות.
