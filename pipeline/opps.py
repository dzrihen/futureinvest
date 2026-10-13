"""מסך 'הזדמנויות היום' – נתונים יומיים ממקורות חינמיים בלבד, ללא AI/LLM.
אירועים: RSS (Yahoo Finance, CNBC, MarketWatch, Google News) + מיפוי מילות מפתח לנושאים/תעודות סל (כללים).
מאקרו: FRED (CSV ציבורי) עם גיבוי Yahoo. משקיעים גדולים: SEC EDGAR 13F. ציונים: Yahoo Finance (מחירים שבועיים + quote + financialData).
כותב data/opps.json. אין כאן שום נתון אישי – ההתאמה לתיק מחושבת בדפדפן בלבד."""
import json, os, re, time, math, datetime as dt, urllib.request, urllib.parse, http.cookiejar, html, email.utils
import xml.etree.ElementTree as ET

ROOT = os.path.join(os.path.dirname(__file__), "..", "data")
UA_SEC = os.environ.get("SEC_UA", "FutureInvest dzrihen.futureinvest@gmail.com")
NOWD = dt.datetime.now(dt.timezone.utc)
log = []

def _ld(name, d=None):
    try:
        with open(os.path.join(ROOT, name), encoding="utf-8") as f: return json.load(f)
    except Exception: return d
def _sv(name, obj):
    with open(os.path.join(ROOT, name), "w", encoding="utf-8") as f: json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))

def sec_get(url):
    for i in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA_SEC, "Accept-Encoding": "identity"})
            with urllib.request.urlopen(req, timeout=60) as r: time.sleep(0.15); return r.read()
        except Exception as e: err = e; time.sleep(1.5 * (i + 1))
    raise err

def web_get(url, timeout=25):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r: return r.read()

class Yahoo:
    def __init__(self):
        cj = http.cookiejar.CookieJar()
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj)); self.op.addheaders = [("User-Agent", "Mozilla/5.0")]
        self.crumb = None
        try: self.op.open("https://fc.yahoo.com", timeout=20)
        except Exception: pass
        try: self.crumb = self.op.open("https://query1.finance.yahoo.com/v1/test/getcrumb", timeout=20).read().decode()
        except Exception as e: log.append({"src": "Yahoo crumb", "ok": False, "err": str(e)[:100]})
    def j(self, url):
        for i in range(3):
            try:
                with self.op.open(url, timeout=30) as r: return json.loads(r.read())
            except Exception as e: err = e; time.sleep(2 * (i + 1))
        raise err
    def quotes(self, syms):
        out = {}
        if not self.crumb: return out
        for i in range(0, len(syms), 40):
            try:
                d = self.j("https://query1.finance.yahoo.com/v7/finance/quote?crumb=" + self.crumb + "&symbols=" + urllib.parse.quote(",".join(syms[i:i + 40])))
                for q in d["quoteResponse"]["result"]: out[q["symbol"]] = q
            except Exception as e: log.append({"src": "Yahoo quote", "ok": False, "err": str(e)[:100]})
            time.sleep(0.4)
        return out
    def weekly(self, sym):
        d = self.j(f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(sym)}?range=5y&interval=1wk&events=div,split")
        r = d["chart"]["result"][0]; adj = (r["indicators"].get("adjclose") or [{}])[0].get("adjclose") or r["indicators"]["quote"][0]["close"]
        return [v for v in adj if v]
    def fin(self, sym):
        d = self.j(f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/{urllib.parse.quote(sym)}?modules=financialData&crumb={self.crumb}")
        f = d["quoteSummary"]["result"][0]["financialData"]
        g = lambda k: (f.get(k) or {}).get("raw")
        return {"pm": g("profitMargins"), "roe": g("returnOnEquity"), "de": g("debtToEquity"), "rg": g("revenueGrowth"), "d": NOWD.strftime("%Y-%m-%d")}

# ---------------- events ----------------
FEEDS = [("Yahoo Finance", "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC,%5EIXIC,%5EDJI&region=US&lang=en-US"),
         ("CNBC", "https://www.cnbc.com/id/100003114/device/rss/rss.html"),
         ("CNBC Economy", "https://www.cnbc.com/id/20910258/device/rss/rss.html"),
         ("MarketWatch", "https://feeds.content.dowjones.io/public/rss/mw_topstories"),
         ("Google News – שווקים", "https://news.google.com/rss/search?q=stock+market+when:2d&hl=en-US&gl=US&ceid=US:en"),
         ("Google News – כלכלה", "https://news.google.com/rss/search?q=economy+OR+fed+OR+inflation+when:2d&hl=en-US&gl=US&ceid=US:en"),
         ("Google News – ישראל", "https://news.google.com/rss/search?q=Israel+stocks+OR+TASE+OR+shekel+OR+%22Bank+of+Israel%22+when:3d&hl=en-US&gl=US&ceid=US:en")]
# נושא: כותרת בעברית, מילות מפתח (regex), תעודות סל/מניות מושפעות, משפט הסבר (כלל)
THEMES = {
 "rates": ("ריבית והפד", r"\b(fed|fomc|powell|rate cut|rate hike|interest rates?|treasury yields?|bond yields?)\b", ["TLT", "IEF", "XLF", "XLRE", "IWM"], "שינוי בציפיות לריבית משפיע על אג\"ח ארוכות, נדל\"ן, בנקים וחברות קטנות."),
 "inflation": ("אינפלציה", r"\b(inflation|cpi|pce|consumer prices|price index)\b", ["TIP", "GLD", "XLE"], "נתוני אינפלציה מזיזים את ציפיות הריבית ואת הנכסים המגינים מאינפלציה."),
 "ai": ("בינה מלאכותית ושבבים", r"\b(ai|artificial intelligence|nvidia|chips?|semiconductors?|data centers?|openai|gpu)\b", ["SMH", "SOXX", "NVDA", "AVGO", "TSM", "MSFT"], "ההשקעות בבינה מלאכותית ממשיכות להניע את מניות השבבים והענן."),
 "energy": ("נפט ואנרגיה", r"\b(oil|crude|opec|brent|natural gas|lng)\b", ["XLE", "XOM", "CVX", "USO"], "תנודות בנפט משפיעות על חברות האנרגיה ועל האינפלציה."),
 "trade": ("מכסים וסחר עולמי", r"\b(tariffs?|trade war|trade deal|export controls?|sanctions?)\b", ["FXI", "MCHI", "VGK", "EWJ"], "מכסים ומגבלות סחר משנים את התחזיות לחברות עם חשיפה לסין ולשרשרת האספקה."),
 "china": ("סין", r"\b(china|chinese|beijing|yuan|xi jinping)\b", ["FXI", "MCHI", "KWEB"], "חדשות מסין משפיעות על השווקים המתעוררים ועל חברות עם חשיפה אליה."),
 "gold": ("זהב ומתכות", r"\b(gold|silver|bullion|precious metals?|copper)\b", ["GLD", "IAU", "GDX", "COPX"], "זהב נוטה לעלות בתקופות של אי-ודאות או ירידת ריבית."),
 "defense": ("ביטחון וגיאופוליטיקה", r"\b(defense|military|missiles?|nato|war|ukraine|iran|pentagon)\b", ["ITA", "XAR", "LMT", "RTX"], "מתיחות גיאופוליטית מגדילה תקציבי ביטחון ואת התנודתיות בשווקים."),
 "crypto": ("קריפטו", r"\b(bitcoin|crypto|ethereum|stablecoins?)\b", ["IBIT", "COIN"], "ביטקוין וקריפטו מגיבים חזק לשינויים בתיאבון לסיכון."),
 "banks": ("בנקים ודוחות כספיים", r"\b(banks?|jpmorgan|goldman|earnings season|quarterly results|beats? estimates)\b", ["XLF", "JPM", "GS"], "עונת הדוחות והבנקים נותנים אינדיקציה לבריאות הכלכלה."),
 "housing": ("נדל\"ן ומשכנתאות", r"\b(housing|home sales|mortgage rates?|homebuilders?|real estate)\b", ["XHB", "ITB", "VNQ"], "ריבית המשכנתאות קובעת את קצב שוק הדיור ואת מניות הבנייה."),
 "health": ("בריאות ותרופות", r"\b(fda|drugs?|pharma|obesity|glp-1|biotech|vaccines?|medicare)\b", ["XLV", "LLY", "NVO", "XBI"], "החלטות רגולציה ותרופות חדשות (כמו תרופות הרזיה) מזיזות את סקטור הבריאות."),
 "recession": ("האטה ותעסוקה", r"\b(recession|layoffs?|jobless|unemployment|payrolls?|jobs report|slowdown)\b", ["XLP", "XLU", "USMV", "TLT"], "סימני האטה מעבירים כסף לסקטורים דפנסיביים ולאג\"ח."),
 "power": ("חשמל ותשתיות", r"\b(power grid|electricity|utilities|nuclear|uranium|infrastructure)\b", ["XLU", "URA", "PAVE", "GRID"], "הביקוש לחשמל מצד מרכזי נתונים מחזק תשתיות, גרעין ואורניום."),
 "cyber": ("סייבר", r"\b(cyber ?attacks?|cybersecurity|ransomware|hack(?:ers|ed)?|data breach)\b", ["CIBR", "CRWD", "PANW", "CHKP"], "מתקפות סייבר מגדילות את הביקוש לחברות אבטחת מידע."),
 "israel": ("ישראל", r"\b(israel|israeli|tel aviv|shekel|tase|bank of israel)\b", ["EIS", "TEVA", "CHKP"], "אירועים בישראל משפיעים על המניות הישראליות ועל שער השקל."),
 "japan": ("יפן", r"\b(japan|boj|bank of japan|yen|nikkei)\b", ["EWJ"], "מדיניות בנק יפן והין משפיעים על השוק היפני ועל זרימות הכסף בעולם."),
 "europe": ("אירופה", r"\b(ecb|eurozone|europe(?:an)?|germany|lagarde)\b", ["VGK", "IMEU"], "החלטות הבנק המרכזי האירופי והכלכלה הגרמנית מזיזות את שוקי אירופה."),
 "india": ("הודו", r"\b(india|indian|rbi|modi|sensex|nifty)\b", ["INDA"], "הודו היא אחת הכלכלות הגדולות שצומחות הכי מהר."),
 "consumer": ("צרכנות וקמעונאות", r"\b(retail sales|consumer spending|consumer confidence|holiday sales|walmart|amazon)\b", ["XLY", "XRT", "AMZN", "WMT"], "נתוני הצריכה מראים אם הצרכן האמריקאי ממשיך להוציא."),
}
POS = r"\b(surges?|soars?|rall(?:y|ies)|jumps?|gains?|record|beats?|upgrades?|boosts?|rebounds?|optimism|strong)\b"
NEG = r"\b(plunges?|tumbles?|falls?|drops?|slumps?|sinks?|misses?|downgrades?|warns?|fears?|selloff|sell-off|weak|crash|slides?)\b"

def rss_items():
    items, seen = [], set()
    for name, url in FEEDS:
        try:
            root = ET.fromstring(web_get(url)); n = 0
            for it in root.iter("item"):
                t = html.unescape((it.findtext("title") or "").strip()); lk = (it.findtext("link") or "").strip()
                if not t or t.lower() in seen: continue
                seen.add(t.lower())
                try: d = email.utils.parsedate_to_datetime(it.findtext("pubDate") or "")
                except Exception: d = None
                if d and (NOWD - d).total_seconds() > 4 * 86400: continue
                desc = re.sub("<[^>]+>", " ", html.unescape(it.findtext("description") or ""))[:300]
                items.append({"t": t, "u": lk, "src": name, "d": d.astimezone(dt.timezone.utc).strftime("%Y-%m-%d %H:%M") if d else None, "x": desc}); n += 1
            log.append({"src": f"RSS {name}", "ok": n > 0, "n": n})
        except Exception as e: log.append({"src": f"RSS {name}", "ok": False, "err": str(e)[:100]})
        time.sleep(0.3)
    return items

def events(items):
    out = []
    for k, (he, rx, tick, why) in THEMES.items():
        hits = [i for i in items if re.search(rx, i["t"] + " " + i["x"], re.I)]
        if not hits: continue
        pos = sum(bool(re.search(POS, i["t"], re.I)) for i in hits); neg = sum(bool(re.search(NEG, i["t"], re.I)) for i in hits)
        tone = "חיובי" if pos > neg * 1.3 else "שלילי" if neg > pos * 1.3 else "מעורב"
        hits.sort(key=lambda i: i["d"] or "", reverse=True)
        out.append({"k": k, "title": he, "why": why, "n": len(hits), "tone": tone, "pos": pos, "neg": neg, "tickers": tick,
                    "heads": [{"t": h["t"], "u": h["u"], "src": h["src"], "d": h["d"]} for h in hits[:3]]})
    out.sort(key=lambda e: -e["n"])
    return out[:8]

# ---------------- macro ----------------
def macro(Y):
    res = {}
    for sid, lab in [("DGS10", "תשואת אג\"ח ארה\"ב ל-10 שנים"), ("FEDFUNDS", "ריבית הפד"), ("CPIAUCSL", "מדד המחירים לצרכן בארה\"ב"), ("VIXCLS", "מדד הפחד VIX")]:
        try:
            rows = [l.split(",") for l in web_get(f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={sid}&cosd={(NOWD - dt.timedelta(days=500)).strftime('%Y-%m-%d')}", 15).decode().splitlines()[1:]]
            rows = [(d, float(v)) for d, v in rows if v not in (".", "")]
            if sid == "CPIAUCSL":
                d, v = rows[-1]; prev = [x for x in rows if x[0] <= f"{int(d[:4]) - 1}{d[4:]}"][-1][1]
                res[sid] = {"l": "אינפלציה שנתית בארה\"ב", "v": round((v / prev - 1) * 100, 1), "u": "%", "d": d, "src": "FRED"}
            else:
                d, v = rows[-1]; res[sid] = {"l": lab, "v": v, "u": "%" if sid != "VIXCLS" else "", "d": d, "src": "FRED", "chg": round(v - rows[max(0, len(rows) - 22)][1], 2)}
            log.append({"src": f"FRED {sid}", "ok": True, "asof": d})
        except Exception as e:
            log.append({"src": f"FRED {sid}", "ok": False, "err": str(e)[:80]})
            if "timed out" in str(e): break  # FRED חוסם/איטי – לא מבזבזים דקות Actions, עוברים לגיבוי Yahoo
    # גיבוי/השלמה מ-Yahoo
    q = Y.quotes(["^VIX", "^TNX", "CL=F", "GC=F", "ILS=X", "^GSPC"])
    lab = {"^VIX": ("VIXCLS", "מדד הפחד VIX", ""), "^TNX": ("DGS10", "תשואת אג\"ח ארה\"ב ל-10 שנים", "%"), "CL=F": ("OIL", "נפט (דולר לחבית)", "$"), "GC=F": ("GOLD", "זהב (דולר לאונקיה)", "$"), "ILS=X": ("USDILS", "דולר-שקל", "₪"), "^GSPC": ("SPX", "S&P 500", "")}
    for s, (k, l, u) in lab.items():
        if s in q and q[s].get("regularMarketPrice") and k not in res:
            x = q[s]; res[k] = {"l": l, "v": round(x["regularMarketPrice"], 2), "u": u, "d": dt.datetime.fromtimestamp(x.get("regularMarketTime", 0), dt.timezone.utc).strftime("%Y-%m-%d"),
                                "src": "Yahoo Finance", "chgp": round(x.get("regularMarketChangePercent") or 0, 2)}
    return res

# ---------------- 13F ----------------
MANAGERS = [(1067983, "ברקשייר האת'וויי", "וורן באפט"), (1350694, "ברידג'ווטר", "ריי דליו"), (1336528, "פרשינג סקוור", "ביל אקמן"),
            (1649339, "סקיון", "מייקל ברי"), (1656456, "אפלוסה", "דייוויד טפר"), (1536411, "דוקסן", "סטנלי דרוקנמילר"), (1061768, "באופוסט", "סת' קלרמן"),
            (1167483, "טייגר גלובל", "צ'ייס קולמן"), (1135730, "קואטו", "פיליפ לפונט"), (1037389, "רנסנס טכנולוגיות", "ג'ים סימונס (קרן כמותית)"),
            (1697748, "ARK", "קת'י ווד"), (1061165, "לון פיין", "סטיבן מנדל"), (1040273, "ת'רד פוינט", "דן לואב"), (1079114, "גרינלייט", "דייוויד איינהורן"),
            (1709323, "הימלאיה", "לי לו")]

def info_table(cik, acc):
    base = f"https://www.sec.gov/Archives/edgar/data/{cik}/{acc.replace('-', '')}/"
    idx = json.loads(sec_get(base + "index.json"))
    xmls = [i["name"] for i in idx["directory"]["item"] if i["name"].lower().endswith(".xml") and "primary_doc" not in i["name"].lower()]
    if not xmls: raise RuntimeError("no infotable")
    root = ET.fromstring(sec_get(base + xmls[0])); pos = {}
    for it in root.iter():
        if not it.tag.endswith("infoTable"): continue
        g = lambda n: next((c.text for c in it.iter() if c.tag.endswith(n)), None)
        if (g("putCall") or "").strip(): continue  # מדלגים על אופציות
        cu = (g("cusip") or "").upper(); v = float(g("value") or 0); sh = float(g("sshPrnamt") or 0)
        p = pos.setdefault(cu, {"n": (g("nameOfIssuer") or "").strip(), "v": 0, "sh": 0}); p["v"] += v; p["sh"] += sh
    return pos

def thirteenf(cusip2t):
    prev = (_ld("opps.json", {}) or {}).get("f13", {}).get("m", {})
    out = {}
    for cik, he, who in MANAGERS:
        try:
            j = json.loads(sec_get(f"https://data.sec.gov/submissions/CIK{cik:010d}.json")); f = j["filings"]["recent"]
            fl = [(a, r, fd) for a, r, fo, fd in zip(f["accessionNumber"], f["reportDate"], f["form"], f["filingDate"]) if fo == "13F-HR"]
            if not fl: raise RuntimeError("no 13F-HR")
            per, filed = fl[0][1], fl[0][2]
            old = prev.get(str(cik))
            if old and old.get("per") == per and old.get("pos"):
                out[str(cik)] = old; log.append({"src": f"13F {he}", "ok": True, "asof": per, "n": len(old["pos"]), "cached": True}); continue
            cur = info_table(cik, fl[0][0]); pre = {}
            nxt = next((x for x in fl[1:] if x[1] < per), None)
            if nxt: pre = info_table(cik, nxt[0])
            tot = sum(p["v"] for p in cur.values()) or 1
            if tot < 5e7: tot *= 1000; [p.update(v=p["v"] * 1000) for p in cur.values()]  # דוחות ישנים באלפי דולרים
            pos = []
            for cu, p in cur.items():
                o = pre.get(cu); ch = "new" if not o else ("add" if p["sh"] > o["sh"] * 1.1 else "trim" if p["sh"] < o["sh"] * 0.9 else "hold")
                pos.append({"t": cusip2t.get(cu), "n": p["n"].title(), "w": round(p["v"] / tot * 100, 2), "ch": ch,
                            "chp": round((p["sh"] / o["sh"] - 1) * 100) if o and o["sh"] else None})
            sold = [{"t": cusip2t.get(cu), "n": o["n"].title(), "wprev": round(o["v"] / (sum(x["v"] for x in pre.values()) or 1) * 100, 2)} for cu, o in pre.items() if cu not in cur]
            pos.sort(key=lambda x: -x["w"]); sold.sort(key=lambda x: -x["wprev"])
            stale = (NOWD.date() - dt.date.fromisoformat(per)).days > 200
            out[str(cik)] = {"he": he, "who": who, "name": j["name"], "per": per, "filed": filed, "stale": stale, "aum": round(tot / 1e9, 2),
                             "n": len(pos), "pos": pos[:60], "sold": sold[:15]}
            log.append({"src": f"13F {he}", "ok": True, "asof": per, "n": len(pos)})
        except Exception as e:
            log.append({"src": f"13F {he}", "ok": False, "err": str(e)[:100]})
            if str(cik) in prev: out[str(cik)] = dict(prev[str(cik)], stale=True)
    # קונצנזוס: מניות שמוחזקות ע"י 3+ מנהלים פעילים (לא כולל רנסנס – קרן כמותית עם אלפי פוזיציות)
    cnt = {}
    for k, m in out.items():
        if m.get("stale") or k == "1037389": continue
        for p in m["pos"][:40]:
            if not p["t"]: continue
            c = cnt.setdefault(p["t"], {"who": [], "buy": 0, "sell": 0})
            c["who"].append(m["he"]); c["buy"] += p["ch"] in ("new", "add"); c["sell"] += p["ch"] == "trim"
        for s in m.get("sold", []):
            if s["t"]: cnt.setdefault(s["t"], {"who": [], "buy": 0, "sell": 0})["sell"] += 1
    cons = sorted([dict(t=t, **c) for t, c in cnt.items() if len(c["who"]) >= 3], key=lambda x: (-len(x["who"]), -x["buy"]))
    return {"m": out, "cons": cons[:30], "note": "דוחות 13F מוגשים עד 45 יום אחרי סוף הרבעון – זו תמונה מאוחרת, רק פוזיציות לונג במניות אמריקאיות."}

# ---------------- universe & scores ----------------
POPULAR = "SPY QQQ DIA IWM VTI VOO VT VXUS VEA VWO EFA EEM SCHD VYM VUG VTV MTUM QUAL USMV SPMO XLK XLF XLV XLE XLI XLY XLP XLU XLB XLRE XLC SMH SOXX IGV CIBR SKYY BOTZ ROBO AIQ ICLN TAN URA GLD IAU SLV GDX COPX LIT TLT IEF SHY BND AGG TIP HYG LQD ITA XAR ARKK IBIT EIS EWJ INDA FXI MCHI KWEB VGK EWZ XHB ITB VNQ IBB XBI PAVE GRID XRT".split()
UCITS = {"CSPX.L": "CSPX", "VWRA.L": "VWRA", "IWDA.L": "IWDA", "EIMI.L": "EIMI", "CNDX.L": "CNDX", "VUAA.L": "VUAA", "SGLN.L": "SGLN", "INRG.L": "INRG", "SEMI.L": "SEMI", "VHYL.L": "VHYL"}
LEV = {"TQQQ", "SQQQ", "UPRO", "SOXL", "USO", "UVXY", "VXX"}

def pctl(vals, x, inv=False):
    v = sorted(a for a in vals if a is not None)
    if x is None or not v: return None
    r = sum(a < x for a in v) + 0.5 * sum(a == x for a in v)
    p = r / len(v) * 100
    return round(100 - p if inv else p)

def scores(Y, spy_rows, cons, sec, extra):
    top = [r["t"].replace(".", "-") for r in sorted(spy_rows, key=lambda r: -r["w"]) if r.get("t") and re.match(r"^[A-Z][A-Z.\-]*$", r["t"])][:100]
    uni = list(dict.fromkeys(POPULAR + list(UCITS) + top + [c["t"] for c in cons] + [e for e in extra if not e.endswith(".TA")]))
    q = Y.quotes(uni); log.append({"src": "Yahoo quote universe", "ok": bool(q), "n": len(q)})
    cache = (_ld("opps.json", {}) or {}).get("fincache", {})
    rows = {}
    for s in uni:
        try: w = Y.weekly(s)
        except Exception as e: w = []; log.append({"src": f"Yahoo weekly {s}", "ok": False, "err": str(e)[:60]})
        time.sleep(0.25)
        x = q.get(s, {}); typ = "etf" if x.get("quoteType") == "ETF" or s in POPULAR or s in UCITS else "stock"
        r = {"t": UCITS.get(s, s), "y": s, "n": x.get("longName") or x.get("shortName") or sec.get(s, {}).get("n") or s, "k": typ,
             "sec": sec.get(s, {}).get("s"), "p": x.get("regularMarketPrice"), "cur": x.get("currency"), "ucits": s in UCITS, "lev": s in LEV}
        if len(w) > 60:
            last = w[-1]
            def cagr(y):
                n = 52 * y
                return round(((last / w[-1 - n]) ** (1 / y) - 1) * 100, 1) if len(w) > n else None
            r.update(r1=cagr(1), r3=cagr(3), r5=cagr(5))
            rets = [w[i] / w[i - 1] - 1 for i in range(1, len(w))][-156:]
            mu = sum(rets) / len(rets); sd = (sum((a - mu) ** 2 for a in rets) / len(rets)) ** .5
            r["vol"] = round(sd * 52 ** .5 * 100, 1)
            pk = w[0]; mdd = 0
            for v in w: pk = max(pk, v); mdd = min(mdd, v / pk - 1)
            r["mdd"] = round(mdd * 100, 1)
            r["hi52"] = round(max(w[-52:]), 2)
            r["m6"] = round((last / w[-27] - 1) * 100, 1) if len(w) > 27 else None
            r["m12"] = round((last / w[-53] - 1) * 100, 1) if len(w) > 53 else None
            base = r["r3"] if r["r3"] is not None else r["r1"]
            r["shp"] = round((base - 4) / r["vol"], 2) if base is not None and r["vol"] else None
        ma = x.get("twoHundredDayAverage")
        r["ma200"] = round((x["regularMarketPrice"] / ma - 1) * 100, 1) if ma and x.get("regularMarketPrice") else None
        if typ == "stock":
            r.update(pe=x.get("trailingPE"), fpe=x.get("forwardPE"), mcap=round(x["marketCap"] / 1e9, 1) if x.get("marketCap") else None)
            c = cache.get(s)
            if not c or (NOWD.date() - dt.date.fromisoformat(c["d"])).days > 7:
                try: c = Y.fin(s); cache[s] = c; time.sleep(0.3)
                except Exception: c = c or {}
            r.update({k: c.get(k) for k in ("pm", "roe", "de", "rg")})
        else:
            r.update(ter=x.get("netExpenseRatio"), aum=round(x["netAssets"] / 1e9, 1) if x.get("netAssets") else None)
        rows[r["t"]] = r
    # ציוני רכיבים (אחוזון בתוך הקבוצה: מניות מול מניות, קרנות מול קרנות)
    for grp in ("stock", "etf"):
        G = [r for r in rows.values() if r["k"] == grp]
        col = lambda k: [r.get(k) for r in G]
        secmed = {}
        for r in G:
            if r.get("fpe") and r["fpe"] > 0: secmed.setdefault(r.get("sec") or "?", []).append(r["fpe"])
        secmed = {k: sorted(v)[len(v) // 2] for k, v in secmed.items()}
        for r in G:
            c = {}
            perf = [pctl(col("r3"), r.get("r3")), pctl(col("r5"), r.get("r5")), pctl(col("shp"), r.get("shp")), pctl(col("mdd"), r.get("mdd"))]
            perf = [a for a in perf if a is not None]; c["perf"] = round(sum(perf) / len(perf)) if perf else None
            mom = [pctl(col("m12"), r.get("m12")), pctl(col("m6"), r.get("m6"))]
            mom = [a for a in mom if a is not None]
            c["mom"] = min(100, round(sum(mom) / len(mom) + (8 if (r.get("ma200") or 0) > 0 else -8))) if mom else None
            if c["mom"] is not None: c["mom"] = max(0, c["mom"])
            risk = [pctl(col("vol"), r.get("vol"), inv=True), pctl(col("mdd"), r.get("mdd"))]
            risk = [a for a in risk if a is not None]; c["risk"] = round(sum(risk) / len(risk)) if risk else None
            if grp == "stock":
                fpe = r.get("fpe"); med = secmed.get(r.get("sec") or "?")
                rel = fpe / med if fpe and fpe > 0 and med else None
                rels = [ (x.get("fpe") / secmed.get(x.get("sec") or "?")) if x.get("fpe") and x["fpe"] > 0 and secmed.get(x.get("sec") or "?") else None for x in G]
                v = [pctl(rels, rel, inv=True), pctl(col("pe"), r.get("pe") if (r.get("pe") or 0) > 0 else None, inv=True)]
                if r.get("fpe") and r.get("pe") and r["fpe"] < r["pe"]: v.append(65)  # צפי לצמיחת רווח
                v = [a for a in v if a is not None]; c["val"] = round(sum(v) / len(v)) if v else None
                qu = [pctl(col("pm"), r.get("pm")), pctl(col("roe"), r.get("roe")), pctl(col("de"), r.get("de"), inv=True), pctl(col("rg"), r.get("rg"))]
                qu = [a for a in qu if a is not None]; c["qual"] = round(sum(qu) / len(qu)) if qu else None
                c["cost"] = None
            else:
                c["val"] = c["qual"] = None
                co = [pctl(col("ter"), r.get("ter"), inv=True), pctl(col("aum"), r.get("aum"))]
                co = [a for a in co if a is not None]; c["cost"] = round(sum(co) / len(co)) if co else None
            r["c"] = c
    for r in rows.values():
        cn = next((x for x in cons if x["t"] == r["t"]), None)
        r["c"]["big"] = min(100, 30 + 15 * len(cn["who"]) + 5 * cn["buy"] - 5 * cn["sell"]) if cn else None
    return rows, cache

def build(spy_rows, sec, extra):
    Y = Yahoo()
    items = rss_items(); ev = events(items)
    mac = macro(Y)
    c2t = {v["cusip"].upper(): k for k, v in sec.items() if v.get("cusip")}
    f13 = thirteenf(c2t)
    # מי מחזיק כל טיקר
    holders = {}
    for k, m in f13["m"].items():
        for p in m["pos"]:
            if p["t"]: holders.setdefault(p["t"], []).append([k, p["w"], p["ch"]])
    rows, cache = scores(Y, spy_rows, f13["cons"], sec, extra)
    for t, r in rows.items(): r["hold"] = holders.get(t, [])
    out = {"built": NOWD.strftime("%Y-%m-%d %H:%M UTC"), "events": ev, "macro": mac, "f13": f13, "u": rows, "fincache": cache,
           "nheads": len(items), "log": log}
    _sv("opps.json", out)
    return log
