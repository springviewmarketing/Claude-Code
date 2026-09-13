from playwright.sync_api import sync_playwright
import os
os.environ["PLAYWRIGHT_BROWSERS_PATH"] = "/root/pw"
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
URL = "http://127.0.0.1:8765/opticians-map.html"
HOST = "http://127.0.0.1:8765/host.html"

# mojibake test: look for the tell-tale bytes U+00C2 / U+00E2 without literals
MOJI = ("(function(s){return s.indexOf(String.fromCharCode(194))>-1"
        "||s.indexOf(String.fromCharCode(226,128))>-1;})")

PROBE = """()=>{const c=document.getElementById('map');
 const w=document.querySelector('.mapwrap').getBoundingClientRect();
 let painted=false;
 try{const g=c.getContext('2d');
   const a=g.getImageData(Math.floor(c.width*0.55),Math.floor(c.height*0.55),1,1).data;
   const b=g.getImageData(Math.floor(c.width*0.50),Math.floor(c.height*0.45),1,1).data;
   painted=(a[3]>0||b[3]>0);}catch(e){painted='err';}
 return {canvas:c.width+'x'+c.height, wrapH:Math.round(w.height), wrapW:Math.round(w.width),
   cards:document.querySelectorAll('.card').length,
   shown:(document.getElementById('k-show')||{}).textContent, painted:painted,
   fatal:!!document.querySelector('body>div[style*="fdf1ec"]'),
   hscroll:document.documentElement.scrollWidth>document.documentElement.clientWidth+2,
   mojibake:MOJIFN(document.getElementById('plist').textContent)};}""".replace("MOJIFN", MOJI)

IPROBE = """()=>{const d=document.getElementById('f').contentDocument;const c=d.getElementById('map');
 return {canvas:c.width+'x'+c.height,
   wrapH:Math.round(d.querySelector('.mapwrap').getBoundingClientRect().height),
   cards:d.querySelectorAll('.card').length,
   fatal:!!d.querySelector('body>div[style*="fdf1ec"]')};}"""


def launch(pw, n):
    if n == "chromium":
        return pw.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    if n == "firefox":
        return pw.firefox.launch()
    return pw.webkit.launch()


def run(pw, name):
    b = launch(pw, name)
    out = {}

    pg = b.new_page(viewport={"width": 1440, "height": 900})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL, wait_until="domcontentloaded")
    pg.wait_for_timeout(3000)
    out["desktop"] = pg.evaluate(PROBE)
    out["desktop"]["js_errors"] = errs[:2]
    pg.screenshot(path="art/x-%s-desktop.png" % name)

    try:
        pg.fill("#near", "Leeds")
        pg.dispatch_event("#near", "change")
        pg.wait_for_timeout(700)
        out["radius_leeds"] = pg.inner_text("#k-show")
        pg.eval_on_selector(".card", "c=>c.click()")
        pg.wait_for_timeout(500)
        out["detail_opens"] = pg.evaluate("()=>!!document.querySelector('.detail h2')")
        out["detail_name"] = pg.inner_text(".detail h2")[:30]
        out["detail_mojibake"] = pg.evaluate(
            "()=>(%s)(document.querySelector('.detail').textContent)" % MOJI)
        pg.click("#back")
        pg.wait_for_timeout(200)
        pg.click("#theme")
        pg.wait_for_timeout(500)
        out["dark_painted"] = pg.evaluate(PROBE)["painted"]
        pg.screenshot(path="art/x-%s-dark.png" % name)
        pg.click("#theme")
        pg.wait_for_timeout(250)
        pg.click("#zin")
        pg.click("#zin")
        pg.wait_for_timeout(350)
        out["zoom_painted"] = pg.evaluate(PROBE)["painted"]
        pg.click("#reset")
        pg.wait_for_timeout(450)
        out["after_reset"] = pg.inner_text("#k-show")
    except Exception as e:
        out["interaction_error"] = str(e)[:110]
    pg.close()

    pg2 = b.new_page(viewport={"width": 1440, "height": 900})
    pg2.goto(HOST, wait_until="domcontentloaded")
    # wait until the framed page has actually booted, then let the observer settle
    for _ in range(40):
        pg2.wait_for_timeout(250)
        try:
            if pg2.evaluate("()=>{const d=document.getElementById('f').contentDocument;"
                            "return !!d && d.querySelectorAll('.card').length>0;}"):
                break
        except Exception:
            pass
    pg2.wait_for_timeout(600)
    out["iframe_late_layout"] = pg2.evaluate(IPROBE)
    pg2.screenshot(path="art/x-%s-iframe.png" % name)
    pg2.close()

    pg3 = b.new_page(viewport={"width": 390, "height": 844})
    e3 = []
    pg3.on("pageerror", lambda e: e3.append(str(e)))
    pg3.goto(URL, wait_until="domcontentloaded")
    pg3.wait_for_timeout(2600)
    out["phone_390"] = pg3.evaluate(PROBE)
    out["phone_390"]["js_errors"] = e3[:2]
    pg3.screenshot(path="art/x-%s-phone.png" % name)
    pg3.close()

    b.close()
    return out


with sync_playwright() as pw:
    for n in ["chromium", "firefox", "webkit"]:
        print("=" * 14, n.upper(), "=" * 14)
        try:
            for k, v in run(pw, n).items():
                print("  %s: %s" % (k, v))
        except Exception as e:
            print("  FAILED:", str(e)[:260])
