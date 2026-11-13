"""Capture the site on desktop, tablet and phone for the mockups.

Needs the dev server running:  npm run dev   (http://localhost:4321)
    python mockups/_source/capture.py                 # every page + home sections
    python mockups/_source/capture.py /contact/       # only some pages

Reduced motion is requested so the preloader and scroll reveals are skipped.
Every lazy image is forced to load and decode before each shot.
"""
import asyncio, os, sys
from pathlib import Path
from playwright.async_api import async_playwright

BASE = "http://localhost:4321"
OUT = Path(__file__).resolve().parent.parent / "screenshots"
PAGES = ["/", "/films/", "/photography/", "/coaching/", "/contact/", "/advice/"]
HOME_SECTIONS = ["showcase", "about", "services", "booking"]
DEVICES = {
    "desktop": dict(viewport={"width": 1440, "height": 900}, device_scale_factor=2),
    "tablet": dict(viewport={"width": 834, "height": 1194}, device_scale_factor=2, is_mobile=True, has_touch=True),
    "phone": dict(viewport={"width": 390, "height": 844}, device_scale_factor=3, is_mobile=True, has_touch=True),
}
VISIBLE_VIDEOS = "[...document.querySelectorAll('video')].filter(v=>{const r=v.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight&&r.width>0})"


def slug(p):
    return "home" if p.strip("/") == "" else p.strip("/").replace("/", "-")


async def load_everything(page):
    h = await page.evaluate("document.body.scrollHeight")
    for y in range(0, h, 400):
        await page.evaluate(f"window.scrollTo(0,{y})")
        await page.wait_for_timeout(250)
    await page.evaluate("document.querySelectorAll('img').forEach(i=>{i.loading='eager'; i.decoding='sync'})")
    try:
        await page.wait_for_function("[...document.images].every(i=>i.complete && i.naturalWidth>0)", timeout=120000, polling=500)
    except Exception:
        print("  warning: some images did not load")
    await page.evaluate("Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))")
    await page.evaluate("Promise.all([...document.querySelectorAll('video[poster]')].map(v=>new Promise(r=>{const i=new Image();i.onload=i.onerror=r;i.src=v.poster})))")


async def main(pages):
    OUT.mkdir(exist_ok=True)
    async with async_playwright() as pw:
        b = await pw.chromium.launch(channel="chrome", args=["--autoplay-policy=no-user-gesture-required"])
        for dname, opts in DEVICES.items():
            ctx = await b.new_context(reduced_motion="reduce", **opts)
            page = await ctx.new_page()
            for p in pages:
                await page.goto(BASE + p, wait_until="load", timeout=60000)
                await page.evaluate("document.fonts.ready")
                await load_everything(page)
                await page.evaluate("window.scrollTo(0,0)")
                await page.wait_for_timeout(1200)
                # Hold the hero video on a steady frame
                await page.evaluate("document.querySelectorAll('video').forEach(v=>{try{v.currentTime=Math.min(3,v.duration||3);v.pause()}catch(e){}})")
                await page.wait_for_timeout(700)
                await page.screenshot(path=str(OUT / f"{slug(p)}-{dname}.png"))
                await page.screenshot(path=str(OUT / f"{slug(p)}-{dname}-full.png"), full_page=True)
                print("ok", dname, p)
                if p == "/":  # sections with autoplaying video tiles: shoot them in the viewport
                    for sec in HOME_SECTIONS:
                        await page.evaluate(f"window.scrollTo(0, document.getElementById('{sec}').getBoundingClientRect().top + scrollY)")
                        await page.wait_for_timeout(1500)
                        await page.evaluate(VISIBLE_VIDEOS + ".forEach(v=>{v.muted=true; v.play().catch(()=>{})})")
                        try:
                            await page.wait_for_function(VISIBLE_VIDEOS + ".every(v=>v.readyState>=3)", timeout=30000, polling=500)
                        except Exception:
                            pass
                        await page.wait_for_timeout(2500)
                        await page.screenshot(path=str(OUT / f"home-{sec}-{dname}.png"))
                        print("ok", dname, "home#" + sec)
            await ctx.close()
    os._exit(0)  # the browser can hang on close on Windows


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:] or PAGES))
