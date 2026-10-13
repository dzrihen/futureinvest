"""התראות רשימת מעקב: קורא watchlist.json (רק אם דניאל העלה אותו), בודק מול data/opps.json,
ופותח GitHub Issue כשכלל מתחיל להתקיים (גיטהאב שולח מייל). רק GITHUB_TOKEN. מתריע פעם אחת לכל מעבר."""
import json, os, urllib.request, datetime as dt
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W_DEF = {"perf": 20, "mom": 15, "val": 15, "qual": 15, "risk": 15, "cost": 10, "big": 5}
LBL = {"drop": "ירידה של {v}% ממחיר ההוספה", "dropHi": "ירידה של {v}% מהשיא השנתי", "score": "ציון מעל {v}",
       "big": "משקיע גדול פתח פוזיציה חדשה", "above": "מחיר מעל {v}", "below": "מחיר מתחת {v}"}

def score(r):
    a = b = 0
    for k, w in W_DEF.items():
        v = (r.get("c") or {}).get(k)
        if v is not None: a += v * w; b += w
    return round(a / b) if b else None

def evaluate(wl, od):
    hits = []
    for it in wl.get("items", []):
        r = od["u"].get(str(it.get("sym", "")).upper())
        if not r: continue
        p = r.get("p")
        for ru in it.get("rules", []):
            k, v = ru.get("k"), ru.get("v"); n = float(v) if v is not None else 0; hit = False; txt = ""
            if k == "drop" and p and it.get("addP"):
                c = (p / it["addP"] - 1) * 100; hit = c <= -n; txt = f"{-c:.1f}% מתחת למחיר ההוספה ({it['addP']})"
            elif k == "dropHi" and p and r.get("hi52"):
                c = (p / r["hi52"] - 1) * 100; hit = c <= -n; txt = f"{-c:.1f}% מתחת לשיא השנתי ({r['hi52']})"
            elif k == "score":
                s = score(r); hit = s is not None and s >= n; txt = f"ציון {s}"
            elif k == "big":
                nw = [od["f13"]["m"].get(h[0], {}).get("he", "") for h in r.get("hold", []) if h[2] == "new"]; hit = bool(nw); txt = "קנייה חדשה: " + ", ".join(nw)
            elif k == "above" and p: hit = p >= n; txt = f"מחיר {p}"
            elif k == "below" and p: hit = p <= n; txt = f"מחיר {p}"
            if hit: hits.append({"key": f"{r['t']}|{k}|{v}", "t": r["t"], "rule": LBL.get(k, k).format(v=v), "txt": txt, "p": p})
    return hits

def main():
    wp = os.path.join(ROOT, "watchlist.json")
    if not os.path.exists(wp): print("no watchlist.json – email alerts off"); return
    wl = json.load(open(wp)); od = json.load(open(os.path.join(ROOT, "data", "opps.json")))
    sp = os.path.join(ROOT, "data", "watch_state.json")
    prev = set(json.load(open(sp))["on"]) if os.path.exists(sp) else set()
    hits = evaluate(wl, od); on = {h["key"] for h in hits}; new = [h for h in hits if h["key"] not in prev]
    json.dump({"on": sorted(on), "checked": dt.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")}, open(sp, "w"), ensure_ascii=False)
    print(f"watchlist: {len(hits)} active, {len(new)} new")
    tok, repo = os.environ.get("GITHUB_TOKEN"), os.environ.get("GITHUB_REPOSITORY")
    if not new or not tok or not repo: return
    body = "התראות מרשימת המעקב:\n\n" + "\n".join(f"- **{h['t']}** – {h['rule']}: {h['txt']}" for h in new) + \
        "\n\nלבדיקה לפני קנייה: https://dzrihen.github.io/futureinvest/#watch\n\n_אומדן, לא ייעוץ. ציון ללא התאמה לתיק._"
    req = urllib.request.Request(f"https://api.github.com/repos/{repo}/issues", method="POST",
        data=json.dumps({"title": f"🔔 התראת מעקב {dt.date.today()}: " + ", ".join(sorted({h['t'] for h in new})), "body": body, "labels": []}).encode(),
        headers={"Authorization": f"Bearer {tok}", "Accept": "application/vnd.github+json", "Content-Type": "application/json"})
    print("issue:", json.load(urllib.request.urlopen(req, timeout=30)).get("html_url"))

if __name__ == "__main__":
    main()
