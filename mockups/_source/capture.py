"""Capture the site on desktop, tablet and phone for the mockups.

Needs the built site served with PHP (the dashboard shots need its API), for example:
    npm run admin:local                                  # http://127.0.0.1:4322  → BASE below
    php -S 127.0.0.1:4321 -t dist scripts/admin-router.php
Then:
    python mockups/_source/capture.py                    # everything
    python mockups/_source/capture.py pages              # only the pages (pages | extras | dashboard)

Before every shot: reduced motion skips the preloader and scroll reveals, every lazy image is forced to load and
decode, and every video on screen is loaded, played and held on a real frame (never a black box or a poster).
"""
import asyncio, json, os, sys
from pathlib import Path
from playwright.async_api import async_playwright

# The pages are best served by a static server that answers many requests at once (php -S serves one at a time, so
# several videos loading together arrive too late and show black): e.g.  npx serve dist -l 4325.
# The dashboard needs PHP for its API: MN_ADMIN_BASE.
BASE = os.environ.get("MN_BASE", "http://127.0.0.1:4325")
ADMIN_BASE = os.environ.get("MN_ADMIN_BASE", "http://127.0.0.1:4321")
ONLY_PAGES = [p for p in os.environ.get("MN_PAGES", "").split(",") if p]
ONLY_DEVICES = [d for d in os.environ.get("MN_DEVICES", "").split(",") if d]
ADMIN = "/mnvisual00.rec/"
LOGIN = (os.environ.get("MN_EMAIL", "mednoukhal00@gmail.com"), os.environ.get("MN_PASSWORD", "12345678"))
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "screenshots"
PAGES = ["/", "/films/", "/photography/", "/reviews/", "/contact/", "/ar/"]
# Home sections shot in the viewport (their videos and moving rows only look right on screen).
HOME_SECTIONS = {"showcase": "#showcase", "about": "#about", "clients": "#clients", "services": "#services", "reviews": "#reviews", "curve": "[data-curve]"}
DEVICES = {
    "desktop": dict(viewport={"width": 1440, "height": 900}, device_scale_factor=2),
    "tablet": dict(viewport={"width": 834, "height": 1194}, device_scale_factor=2, is_mobile=True, has_touch=True),
    "phone": dict(viewport={"width": 390, "height": 844}, device_scale_factor=3, is_mobile=True, has_touch=True),
}

# Every <video> inside the viewport (and laid out), plus the hero film even before it fades in.
VISIBLE = "[...document.querySelectorAll('video')].filter(v=>{const r=v.getBoundingClientRect();return r.width>0&&r.bottom>0&&r.top<innerHeight})"
# Loads, plays and parks each visible video on a frame a little way in, then waits until that frame is painted.
HOLD_VIDEOS = """async (at) => {
  const vids = %s;
  await Promise.all(vids.map(async (v) => {
    v.muted = true; v.preload = 'auto';
    if (v.readyState < 1) { try { v.load(); } catch (e) {} }
    try { await v.play(); } catch (e) {}
    const until = (ok, ms) => new Promise((res) => { const t0 = Date.now(); const tick = () => (ok() || Date.now() - t0 > ms) ? res() : setTimeout(tick, 100); tick(); });
    await until(() => v.readyState >= 3 && v.duration > 0, 30000);
    const t = Math.min(at, Math.max(0, (v.duration || at) * 0.4));
    await new Promise((res) => { v.addEventListener('seeked', res, { once: true }); try { v.currentTime = t; } catch (e) { res(); } setTimeout(res, 8000); });
    v.pause();
    await until(() => v.readyState >= 2, 8000);
    if (v.matches('[data-hero-video]')) v.classList.add('is-on');
  }));
  return vids.length;
}""" % VISIBLE


def slug(p):
    return "home" if p.strip("/") == "" else p.strip("/").replace("/", "-")


async def load_everything(page):
    """Scroll through the page so lazy images and reveal-on-scroll parts load, then force and decode every image."""
    h = await page.evaluate("document.body.scrollHeight")
    for y in range(0, h, 500):
        await page.evaluate(f"window.scrollTo(0,{y})")
        await page.wait_for_timeout(180)
    await page.evaluate("document.querySelectorAll('img').forEach(i=>{i.loading='eager'; i.decoding='sync'})")
    try:
        await page.wait_for_function("[...document.images].filter(i=>i.getClientRects().length).every(i=>i.complete && i.naturalWidth>0)", timeout=120000, polling=500)
    except Exception:
        print("  warning: some images did not load")
    await page.evaluate("Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))")
    await page.evaluate("Promise.all([...document.querySelectorAll('video[poster]')].map(v=>new Promise(r=>{const i=new Image();i.onload=i.onerror=r;i.src=v.poster})))")


async def hold(page, at=3.0, settle=900):
    n = await page.evaluate(HOLD_VIDEOS, at)
    await page.wait_for_timeout(settle)
    return n


async def open_page(page, path):
    await page.goto(BASE + path, wait_until="load", timeout=90000)
    await page.evaluate("document.fonts.ready")
    await load_everything(page)
    await page.evaluate("window.scrollTo(0,0)")
    await page.wait_for_timeout(800)


async def shoot(page, name, full=False):
    await page.screenshot(path=str(OUT / f"{name}.png"), full_page=full)
    print("ok", name)


async def pages(b, only=None):
    for dname, opts in DEVICES.items():
        if ONLY_DEVICES and dname not in ONLY_DEVICES:
            continue
        ctx = await b.new_context(reduced_motion="reduce", **opts)
        page = await ctx.new_page()
        for p in ONLY_PAGES or PAGES:
            if p == "/ar/" and dname == "tablet":
                continue
            await open_page(page, p)
            await hold(page, 2.5 if p in ("/", "/ar/") else 4)
            await shoot(page, f"{slug(p)}-{dname}")
            await shoot(page, f"{slug(p)}-{dname}-full", full=True)
            if p == "/":
                for name, sel in HOME_SECTIONS.items():
                    await page.evaluate(f"(()=>{{const el=document.querySelector('{sel}'); if(el) window.scrollTo(0, el.getBoundingClientRect().top + scrollY - (innerHeight > 900 ? 60 : 0));}})()")
                    await page.wait_for_timeout(1500)
                    await hold(page, 3.5, 1500)
                    await shoot(page, f"home-{name}-{dname}")
        await ctx.close()


async def extras(b):
    """The film popup, the album viewer and the films page with a preview playing."""
    for dname in ("desktop", "phone"):
        if ONLY_DEVICES and dname not in ONLY_DEVICES:
            continue
        ctx = await b.new_context(reduced_motion="reduce", **DEVICES[dname])
        page = await ctx.new_page()
        # Films page: a film opened in the popup player, held on a frame of the film.
        await open_page(page, "/films/")
        await page.click(".film-grid .film:not(.film--feature)")
        await page.wait_for_selector("[data-theater][open]")
        await page.wait_for_timeout(600)
        await hold(page, 22, 600)
        # The native controls show a stale time while held; the shot reads cleaner without them.
        await page.evaluate("document.querySelector('[data-theater-video]').controls = false")
        await page.wait_for_timeout(600)
        await shoot(page, f"films-popup-{dname}")
        await page.keyboard.press("Escape")
        # Photography: the album viewer open on a photo.
        await open_page(page, "/photography/")
        await page.click("[data-photo]")
        await page.wait_for_selector("[data-lightbox][open]")
        await page.wait_for_function("(()=>{const i=document.querySelector('[data-lightbox-img]');return i&&i.complete&&i.naturalWidth>0})()", timeout=60000)
        await page.evaluate("Promise.all([...document.querySelectorAll('.lightbox__thumb img')].map(i=>i.decode().catch(()=>{})))")
        await page.wait_for_timeout(1200)
        await shoot(page, f"photography-viewer-{dname}")
        await ctx.close()


async def dashboard(b):
    """The dashboard (signed in with LOGIN): album photos with their Home ticks, the films list, the hero screen."""
    for dname in ("desktop", "phone"):
        ctx = await b.new_context(**DEVICES[dname])
        page = await ctx.new_page()
        await page.goto(ADMIN_BASE + ADMIN, wait_until="load")
        await page.wait_for_selector("form input[type=email]")
        await page.wait_for_timeout(500)
        await shoot(page, f"dashboard-login-{dname}")
        await page.fill("form input[type=email]", LOGIN[0])
        await page.fill("form input[type=password]", LOGIN[1])
        await page.click("form button[type=submit]")
        await page.wait_for_selector(".shell", timeout=30000)
        content = await page.evaluate("fetch('/api/mnvisual00/api.php?action=content',{credentials:'same-origin'}).then(r=>r.json())")
        album = content["content"]["albums"][1]["id"] if len(content["content"]["albums"]) > 1 else content["content"]["albums"][0]["id"]
        screens = {"albums-detail": f"albums/{album}", "albums": "albums", "films": "films", "hero": "home", "live": "live", "texts": "texts"}
        for name, hash_ in screens.items():
            await page.evaluate(f"location.hash = '{hash_}'")
            await page.wait_for_timeout(900)
            await load_everything(page)
            await page.evaluate("window.scrollTo(0,0)")
            await page.wait_for_timeout(500)
            await shoot(page, f"dashboard-{name}-{dname}")
            if name == "albums-detail":
                await page.evaluate("document.querySelector('.photos')?.scrollIntoView({block:'start'}); scrollBy(0,-90)")
                await page.wait_for_timeout(700)
                await shoot(page, f"dashboard-albums-photos-{dname}")
        await ctx.close()


async def main(parts):
    OUT.mkdir(exist_ok=True)
    async with async_playwright() as pw:
        b = await pw.chromium.launch(channel="chrome", args=["--autoplay-policy=no-user-gesture-required"])
        if "pages" in parts:
            await pages(b)
        if "extras" in parts:
            await extras(b)
        if "dashboard" in parts:
            await dashboard(b)
    os._exit(0)  # the browser can hang on close on Windows


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:] or ["pages", "extras", "dashboard"]))
