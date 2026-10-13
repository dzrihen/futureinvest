"""FutureInvest data pipeline. Runs daily in GitHub Actions; writes static JSON to data/.
Sources: SEC EDGAR N-PORT (official holdings), State Street SSGA daily holdings xlsx,
Yahoo Finance chart/spark endpoints (unofficial, prices)."""
import json, os, re, sys, time, io, datetime as dt, urllib.request, urllib.parse, xml.etree.ElementTree as ET
sys.path.insert(0, os.path.dirname(__file__))
from universe import E, SECTOR_SPDR
ROOT = os.path.join(os.path.dirname(__file__), "..", "data")
UA_SEC = os.environ.get("SEC_UA", "FutureInvest dzrihen.futureinvest@gmail.com")  # SEC requires a contact; set SEC_UA secret to your real email
UA_WEB = "Mozilla/5.0"  # Yahoo returns 429 for full browser UA strings
NOW = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")
log = []
utc = lambda t: dt.datetime.fromtimestamp(t or 0, dt.timezone.utc)

def get(url, sec=False, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA_SEC if sec else UA_WEB, "Accept-Encoding": "identity"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except Exception as e:
            err = e; time.sleep(1.5 * (i + 1))
    raise err

def save(name, obj):
    p = os.path.join(ROOT, name); os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f: json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))

def load(name, default=None):
    try:
        with open(os.path.join(ROOT, name), encoding="utf-8") as f: return json.load(f)
    except Exception: return default

def cusip_to_isin(c, cc="US"):
    if not c or len(c) != 9: return None
    s = "".join(str(int(ch, 36)) for ch in cc + c.upper())
    tot = 0
    for i, d in enumerate(reversed(s)):
        n = int(d) * (2 if i % 2 == 0 else 1); tot += n // 10 + n % 10
    return cc + c.upper() + str((10 - tot % 10) % 10)

CCY = {"US":"USD","IL":"ILS","GB":"GBP","JP":"JPY","CN":"CNY","HK":"HKD","TW":"TWD","KR":"KRW","IN":"INR","CA":"CAD","AU":"AUD","CH":"CHF","SE":"SEK","DK":"DKK","NO":"NOK","BR":"BRL","ZA":"ZAR","SA":"SAR","MX":"MXN","SG":"SGD","ID":"IDR","TH":"THB","MY":"MYR","AE":"AED","PL":"PLN","TR":"TRY","CL":"CLP","NZ":"NZD"}
for c in "DE FR NL IT ES IE FI BE AT PT LU GR".split(): CCY[c] = "EUR"
def econ_ccy(country, cur):
    """N-PORT often reports USD for all lines; use issuer country as economic currency."""
    if cur and cur != "USD": return cur
    return CCY.get(country or "", cur or "USD")

# ---------- SSGA ----------
def ssga(t):
    import openpyxl
    raw = get(f"https://www.ssga.com/us/en/intermediary/library-content/products/fund-data/etfs/us/holdings-daily-us-en-{t.lower()}.xlsx")
    ws = openpyxl.load_workbook(io.BytesIO(raw), read_only=True).active
    rows = list(ws.iter_rows(values_only=True)); asof = None; out = []; hdr = None
    for r in rows:
        if r[0] == "Holdings:" and r[1]: asof = str(r[1]).replace("As of ", "")
        if r[0] == "Name" and r[1] == "Ticker": hdr = True; continue
        if hdr and r[0] and isinstance(r[4], (int, float)):
            out.append({"n": str(r[0]).strip(), "t": (r[1] or "").strip() if isinstance(r[1], str) else None,
                        "cusip": str(r[2]).strip() if r[2] else None, "w": float(r[4]), "cur": r[7] or "USD"})
    try: asof = dt.datetime.strptime(asof, "%d-%b-%Y").strftime("%Y-%m-%d")
    except Exception: pass
    return out, asof

# ---------- SEC N-PORT ----------
_mf = None
def series_of(t):
    global _mf
    if _mf is None:
        d = json.loads(get("https://www.sec.gov/files/company_tickers_mf.json", sec=True))
        _mf = {r[3]: r for r in d["data"]}
    return _mf.get(t)

def nport(t):
    s = series_of(t)
    if not s: raise RuntimeError("series not found in SEC ticker map")
    cik, sid = s[0], s[1]
    q = json.loads(get(f"https://efts.sec.gov/LATEST/search-index?q=%22{sid}%22&forms=NPORT-P", sec=True))
    hits = sorted(q["hits"]["hits"], key=lambda h: h["_source"].get("period_ending") or "", reverse=True)
    for h in hits[:3]:
        acc = h["_id"].split(":")[0]; cik2 = h["_source"]["ciks"][0].lstrip("0")
        url = f"https://www.sec.gov/Archives/edgar/data/{cik2}/{acc.replace('-', '')}/primary_doc.xml"
        time.sleep(0.2)
        xml = get(url, sec=True)
        root = ET.fromstring(xml)
        ns = {"n": root.tag.split("}")[0].strip("{")}
        sidx = root.find(".//n:genInfo/n:seriesId", ns)
        if sidx is not None and sidx.text != sid: continue
        rep = root.find(".//n:genInfo/n:repPdDate", ns)
        out = []
        for inv in root.iterfind(".//n:invstOrSec", ns):
            g = lambda k: (inv.find(f"n:{k}", ns).text if inv.find(f"n:{k}", ns) is not None else None)
            isin_el = inv.find("n:identifiers/n:isin", ns)
            pct = g("pctVal")
            if pct is None: continue
            out.append({"n": (g("name") or g("title") or "").strip(), "cusip": g("cusip") if g("cusip") not in (None, "N/A", "000000000") else None,
                        "isin": isin_el.get("value") if isin_el is not None else None, "w": float(pct),
                        "c": g("invCountry"), "cur": g("curCd"), "cat": g("assetCat")})
        return out, (rep.text if rep is not None else h["_source"].get("period_ending")), url
    raise RuntimeError("no matching N-PORT filing")

# ---------- Yahoo ----------
def yahoo_monthly(sym):
    d = json.loads(get(f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(sym)}?period1=473385600&period2={int(time.time())+86400}&interval=1mo&events=div,split"))
    r = d["chart"]["result"][0]; ts = r.get("timestamp") or []
    adj = (r["indicators"].get("adjclose") or [{}])[0].get("adjclose") or r["indicators"]["quote"][0]["close"]
    ser = {}
    for t, v in zip(ts, adj):
        if v: ser[utc(t).strftime("%Y-%m")] = round(v, 4)
    return {"cur": r["meta"].get("currency"), "price": r["meta"].get("regularMarketPrice"),
            "asof": utc(r["meta"].get("regularMarketTime", 0)).strftime("%Y-%m-%d"),
            "m": [[k, ser[k]] for k in sorted(ser)]}

def yahoo_spark(syms):
    out = {}
    for i in range(0, len(syms), 20):
        chunk = syms[i:i + 20]
        try:
            d = json.loads(get("https://query1.finance.yahoo.com/v7/finance/spark?range=1d&interval=1d&symbols=" + urllib.parse.quote(",".join(chunk))))
            for r in d["spark"]["result"]:
                m = r["response"][0]["meta"]
                if m.get("regularMarketPrice"):
                    out[r["symbol"]] = {"p": m["regularMarketPrice"], "cur": m.get("currency"),
                                        "d": utc(m.get("regularMarketTime", 0)).strftime("%Y-%m-%d"), "n": m.get("longName") or m.get("shortName")}
        except Exception as e: log.append({"src": "yahoo-spark", "ok": False, "err": str(e)[:120]})
        time.sleep(0.3)
    return out

def stats(m):
    if len(m) < 13: return {}
    v = [x[1] for x in m]; last = v[-1]; res = {}
    for y in (1, 3, 5, 10, 20):
        if len(v) > 12 * y: res[f"r{y}"] = round(((last / v[-1 - 12 * y]) ** (1 / y) - 1) * 100, 2)
    pk = v[0]; mdd = 0
    for x in v: pk = max(pk, x); mdd = min(mdd, x / pk - 1)
    res["mdd"] = round(mdd * 100, 1); res["since"] = m[0][0]
    rets = [v[i] / v[i - 1] - 1 for i in range(1, len(v))][-120:]
    mu = sum(rets) / len(rets); sd = (sum((r - mu) ** 2 for r in rets) / len(rets)) ** .5
    res["vol"] = round(sd * 12 ** .5 * 100, 1)
    return res

CRISES = {"2000": ("2000-03", "2002-10", "בועת הדוט-קום"), "2008": ("2007-10", "2009-03", "המשבר הפיננסי"),
          "2020": ("2020-01", "2020-03", "קורונה"), "2022": ("2021-12", "2022-10", "ריבית ואינפלציה")}
def crisis_dd(m):
    d = dict(m); out = {}
    for k, (a, b, _) in CRISES.items():
        keys = [x for x in d if a <= x <= b]
        if len(keys) < 2 or keys[0] != a: continue
        pk = d[keys[0]]; worst = 0
        for x in keys: pk = max(pk, d[x]); worst = min(worst, d[x] / pk - 1)
        out[k] = round(worst * 100, 1)
    return out

# Asset-class proxies (long history mutual funds) for stress tests and bootstrap
PROXIES = {"us_stocks": ("VFINX", "מניות ארה\"ב (S&P 500, קרן VFINX)"), "intl_stocks": ("VGTSX", "מניות בינלאומיות (VGTSX)"),
           "em_stocks": ("VEIEX", "שווקים מתעוררים (VEIEX)"), "tech": ("QQQ", "נאסד\"ק-100 (QQQ)"),
           "bonds": ("VBMFX", "אג\"ח ארה\"ב כללי (VBMFX)"), "gold": ("GLD", "זהב (GLD)"), "usdils": ("ILS=X", "שער דולר-שקל")}

def main():
    os.makedirs(ROOT, exist_ok=True)
    # 1) reference maps from SSGA: S&P total market + sector SPDRs (GICS sector membership)
    refs = {}; gics = {}
    for t in ["SPY", "SPTM"] + list(SECTOR_SPDR):
        try:
            rows, asof = ssga(t); refs[t] = (rows, asof)
            if t in SECTOR_SPDR:
                for r in rows:
                    if r["cusip"]: gics[r["cusip"]] = SECTOR_SPDR[t]
                    if r["t"]: gics["T:" + r["t"]] = SECTOR_SPDR[t]
            log.append({"src": f"SSGA {t}", "ok": True, "asof": asof, "n": len(rows)})
        except Exception as e:
            log.append({"src": f"SSGA {t}", "ok": False, "err": str(e)[:120]})
    prev_sec = load("securities.json", {}) or {}
    sec = {k: v for k, v in prev_sec.get("s", {}).items()}
    for t in ["SPTM", "SPY"]:
        for r in refs.get(t, ([], None))[0]:
            if not r["t"] or not r["cusip"] or r["t"] in ("-", "CASH_USD"): continue
            sym = r["t"].replace(".", "-")
            sec[sym] = {"n": r["n"], "cusip": r["cusip"], "isin": cusip_to_isin(r["cusip"]), "c": "US",
                        "s": gics.get(r["cusip"]) or gics.get("T:" + r["t"]) or sec.get(sym, {}).get("s")}
    by_isin = {v["isin"]: k for k, v in sec.items() if v.get("isin")}

    def sector_of(h):
        if h.get("cat") and h["cat"] not in ("EC", "EP"): return "מזומן/אחר"
        if h.get("cusip") and h["cusip"] in gics: return gics[h["cusip"]]
        if h.get("t") and ("T:" + h["t"]) in gics: return gics["T:" + h["t"]]
        tk = by_isin.get(h.get("isin"))
        if tk and sec[tk].get("s"): return sec[tk]["s"]
        return "לא מסווג"

    # 2) holdings per ETF
    meta = []; prev_meta = {m["t"]: m for m in (load("meta.json", {}) or {}).get("etfs", [])}
    done = {}
    for (t, name, issuer, index, dom, dist, repl, ter, isin, ysym, (kind, src)) in E:
        hold = None; info = {}
        try:
            if kind == "proxy":
                info = {"kind": "proxy", "proxy": src}
            else:
                if kind == "ssga":
                    rows, asof = refs[t] if t in refs else ssga(t); url = "ssga.com holdings-daily xlsx"
                    rows = [dict(r, isin=cusip_to_isin(r["cusip"]) if r["cusip"] and len(r["cusip"]) == 9 else None, c="US") for r in rows]
                    srcname = "State Street (SSGA) – קובץ אחזקות יומי"
                else:
                    rows, asof, url = nport(t); srcname = "SEC EDGAR – דוח N-PORT (רבעוני, מתפרסם בעיכוב)"
                tot = sum(r["w"] for r in rows) or 1
                hs = []
                for r in rows:
                    key = r.get("isin") or r.get("cusip") or r["n"].upper()
                    tk = r.get("t") or by_isin.get(r.get("isin"))
                    hs.append({"k": key, "n": r["n"], "t": tk, "w": round(r["w"] / tot * 100, 5), "c": r.get("c") or "??",
                               "cur": econ_ccy(r.get("c"), r.get("cur")), "s": sector_of(dict(r, t=tk))})
                hs.sort(key=lambda x: -x["w"])
                top, rest = hs[:700], hs[700:]
                buckets = {}
                for r in rest:
                    b = (r["s"], r["c"], r["cur"]); buckets[b] = buckets.get(b, 0) + r["w"]
                tail = [{"k": f"REST|{s}|{c}|{cu}", "n": "שאר האחזקות (מצרפי)", "t": None, "w": round(w, 5), "c": c, "cur": cu, "s": s, "agg": 1}
                        for (s, c, cu), w in buckets.items() if w > 0.0005]
                hold = {"t": t, "asof": asof, "src": srcname, "url": url, "count": len(hs), "h": top + tail}
                save(f"etf/{t}.json", hold); done[t] = hold
                info = {"kind": kind, "hasof": asof, "hsrc": srcname, "hcount": len(hs)}
                log.append({"src": f"holdings {t}", "ok": True, "asof": asof, "n": len(hs)})
        except Exception as e:
            log.append({"src": f"holdings {t}", "ok": False, "err": str(e)[:160]})
            old = prev_meta.get(t, {})
            info = {k: old.get(k) for k in ("kind", "hasof", "hsrc", "hcount")}; info["stale"] = True
        meta.append(dict(t=t, n=name, issuer=issuer, index=index, dom=dom, dist=dist, repl=repl, ter=ter, isin=isin, y=ysym, **info))

    # 3) prices (monthly adjusted) for ETFs + proxies
    prices = load("prices.json", {}) or {}
    syms = {m["y"]: m["t"] for m in meta if m["y"]}
    for k, (s, _) in PROXIES.items(): syms[s] = s
    for ysym, key in syms.items():
        try:
            p = yahoo_monthly(ysym); prices[key] = p; p["src"] = f"Yahoo Finance ({ysym}), מחיר מתואם לדיבידנדים ופיצולים"
            log.append({"src": f"prices {ysym}", "ok": True, "asof": p["asof"], "n": len(p["m"])})
        except Exception as e:
            log.append({"src": f"prices {ysym}", "ok": False, "err": str(e)[:120]})
        time.sleep(0.25)
    for m in meta:
        p = prices.get(m["t"])
        if p: m.update(cur=p["cur"], price=p["price"], pasof=p["asof"], st=stats(p["m"]), crisis=crisis_dd(p["m"]))
    proxies = {k: {"label": lab, "sym": s, "st": stats(prices[s]["m"]) if s in prices else {}, "crisis": crisis_dd(prices[s]["m"]) if s in prices else {}}
               for k, (s, lab) in PROXIES.items()}
    save("prices.json", prices)

    # 4) latest prices for stock universe (+ extra tickers file)
    extra = []
    try: extra = [l.strip() for l in open(os.path.join(os.path.dirname(__file__), "extra_tickers.txt")) if l.strip() and not l.startswith("#")]
    except Exception: pass
    spark = yahoo_spark(sorted(set(list(sec.keys()) + extra)))
    fxs = yahoo_spark(["GBPUSD=X", "EURUSD=X"])
    for k, v in spark.items():
        sec.setdefault(k, {"n": v.get("n") or k, "c": "IL" if k.endswith(".TA") else None, "s": None})
        sec[k].update(p=v["p"], cur=v["cur"], d=v["d"])
    save("securities.json", {"asof": NOW, "src": "SSGA (מיפוי טיקר/CUSIP/סקטור GICS) + Yahoo Finance (מחיר אחרון)", "s": sec})
    log.append({"src": "yahoo-spark stocks", "ok": bool(spark), "n": len(spark)})

    fx = prices.get("ILS=X", {})
    save("meta.json", {"built": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC"), "etfs": meta, "proxies": proxies,
                       "crises": {k: {"from": a, "to": b, "label": l} for k, (a, b, l) in CRISES.items()},
                       "fx": {"usdils": fx.get("price"), "asof": fx.get("asof"), "src": "Yahoo Finance (ILS=X)", "gbpusd": fxs.get("GBPUSD=X", {}).get("p"), "eurusd": fxs.get("EURUSD=X", {}).get("p")}, "log": log})
    bad = [l for l in log if not l["ok"]]
    print(f"done: {len(log)-len(bad)} ok, {len(bad)} failed"); [print(" FAIL", b) for b in bad]

if __name__ == "__main__":
    main()
