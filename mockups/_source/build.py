"""Build the MN Visual presentation mockups.

Usage (dev server on http://localhost:4321 not needed here, only the screenshots):
    python mockups/_source/build.py            # all scenes
    python mockups/_source/build.py cover hero # some scenes

Writes HTML scenes to mockups/_source/, PNGs to mockups/ and JPGs to mockups/jpg/.
"""
import asyncio, os, sys
from pathlib import Path
from PIL import Image
from playwright.async_api import async_playwright

SRC = Path(__file__).resolve().parent
ROOT = SRC.parent
SHOTS = ROOT / "screenshots"
DPR = {"desktop": 2, "tablet": 2, "phone": 3}

# ---------- tiny icon set ----------
SIGNAL = '<svg viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>'
WIFI = '<svg viewBox="0 0 16 12"><path d="M8 2.2c2.4 0 4.6.9 6.3 2.5l1.2-1.3C13.5 1.5 10.9.4 8 .4S2.5 1.5.5 3.4l1.2 1.3C3.4 3.1 5.6 2.2 8 2.2zm0 3.6c1.4 0 2.7.5 3.7 1.4l1.2-1.3C11.6 4.7 9.9 4 8 4s-3.6.7-4.9 1.9l1.2 1.3c1-.9 2.3-1.4 3.7-1.4zM8 9.4c-.7 0-1.3.3-1.8.7L8 12l1.8-1.9c-.5-.4-1.1-.7-1.8-.7z"/></svg>'
BATT = '<svg viewBox="0 0 27 12"><rect x="0.5" y="0.5" width="23" height="11" rx="3" fill="none" stroke="#fff" stroke-opacity=".45"/><rect x="2" y="2" width="20" height="8" rx="1.8"/><path d="M25 4v4c.8-.3 1.5-1.1 1.5-2S25.8 4.3 25 4z" fill-opacity=".45"/></svg>'
LOCK = '<svg viewBox="0 0 10 13"><path d="M5 0a3.5 3.5 0 0 0-3.5 3.5V5H1a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-.5V3.5A3.5 3.5 0 0 0 5 0zm-2 3.5a2 2 0 1 1 4 0V5H3V3.5z"/></svg>'

MARK = "../../src/assets/branding/mn-visual-mark.png"
LOCKUP = "../../src/assets/branding/mn-visual-lockup.png"


def shot(name):
    return f"../screenshots/{name}.png"


def top_color(name, off_css, kind):
    """Average colour of the first rows shown on screen, so the status bar blends with the page."""
    im = Image.open(SHOTS / f"{name}.png").convert("RGB")
    y = int(off_css * DPR[kind])
    strip = im.crop((0, y, im.width, y + 6)).resize((1, 1), Image.LANCZOS)
    r, g, b = strip.getpixel((0, 0))
    return f"rgb({r},{g},{b})"


def style(x, y, w, rot="", z=10, extra=""):
    t = f"transform:{rot};" if rot else ""
    return f'style="left:{x}px;top:{y}px;--w:{w}px;z-index:{z};{t}{extra}"'


def phone(name, x, y, w, rot="", off=0, z=10, extra=""):
    bg = top_color(name, off, "phone")
    return f'''<div class="phone" {style(x, y, w, rot, z, extra)}><div class="bezel"><div class="screen">
  <div class="status" style="background:{bg}"><span>9:41</span><span class="ic">{SIGNAL}{WIFI}{BATT}</span></div>
  <div class="island"></div>
  <img src="{shot(name)}" style="top:calc({50 - off} * var(--u))" alt="">
  <div class="home"></div><div class="glare"></div></div></div></div>'''


def tablet(name, x, y, w, rot="", off=0, z=10, extra=""):
    bg = top_color(name, off, "tablet")
    return f'''<div class="tablet" {style(x, y, w, rot, z, extra)}><div class="bezel"><div class="screen">
  <div class="status" style="background:{bg}"><span>9:41&nbsp;&nbsp;Ven. 13 nov.</span><span class="ic">{WIFI}{BATT}</span></div>
  <img src="{shot(name)}" style="top:calc({26 - off} * var(--u))" alt="">
  <div class="home"></div><div class="glare"></div></div></div></div>'''


def chrome_bar(url):
    return f'''<div class="chrome"><div class="lights"><b></b><b></b><b></b></div>
  <div class="url">{LOCK}<span>{url}</span></div><div class="tools"><i></i></div></div>'''


def laptop(name, x, y, w, url="mednoukhal.com", rot="", off=0, z=10):
    return f'''<div class="laptop" {style(x, y, w, rot, z)}><div class="halo"></div>
  <div class="lid"><div class="lid-in"><div class="screen">{chrome_bar(url)}
    <img src="{shot(name)}" style="top:calc({44 - off} * var(--u))" alt=""><div class="glare"></div></div></div></div>
  <div class="base"></div></div>'''


def window(name, x, y, w, page_h, url, off=0, z=10, extra=""):
    return f'''<div class="window" {style(x, y, w, "", z, extra)}>{chrome_bar(url)}
  <div class="page" style="height:calc({page_h} * var(--u))"><img src="{shot(name)}" style="margin-top:calc({-off} * var(--u))" alt=""></div></div>'''


def floor_shadow(x, y, w, h, op=0.85):
    return f'<div class="shadow" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;opacity:{op}"></div>'


def viewfinder(tc="00:00:24:12", ratio="16:9", inset=72, fs=22, c=64):
    return f'''<div class="vf" style="--vf:{inset}px;--vf-fs:{fs}px;--vf-c:{c}px"><i></i><i></i><i></i><i></i>
  <div class="rec"><b></b>REC <span>{tc}</span></div><div class="ratio">{ratio}</div></div>'''


def brand(x, y, fs=30, right=False, sub="Photographie · Vidéographie"):
    pos = f"right:{x}px" if right else f"left:{x}px"
    return f'''<div class="brand" style="position:absolute;z-index:35;{pos};top:{y}px;font-size:{fs}px">
  <img src="{MARK}" alt=""><div class="word">MEDNOUKHAL<small>{sub}</small></div></div>'''


def footbar(left="mednoukhal.com", mid='Films <span class="dot">·</span> Photographie <span class="dot">·</span> Coaching', right="© 2026 MN Visual", x=170, y=118, fs=19):
    return f'<div class="footbar" style="--fb-x:{x}px;--fb-y:{y}px;--fb-fs:{fs}px"><span>{left}</span><span>{mid}</span><span>{right}</span></div>'


def text_block(x, y, w, eyebrow, title, lead, specs=None, tsize=100):
    sp = ""
    if specs:
        sp = '<div class="specs" style="margin-top:84px">' + "".join(f"<div><b>{a}</b>{b}</div>" for a, b in specs) + "</div>"
    return f'''<div style="position:absolute;z-index:35;left:{x}px;top:{y}px;width:{w}px">
  <div class="eyebrow" style="--eb:22px">{eyebrow}</div>
  <h1 class="title" style="font-size:{tsize}px;margin:48px 0 44px">{title}</h1>
  <div class="rule" style="margin-bottom:44px"></div>
  <p class="lead" style="--lead:31px">{lead}</p>{sp}</div>'''


def page(cw, ch, body, gx="50%", gy="62%"):
    return f'''<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>MN Visual mockup</title>
<link rel="stylesheet" href="mockup.css"><style>:root{{--cw:{cw}px;--ch:{ch}px}}</style></head>
<body><div class="stage" style="--gx:{gx};--gy:{gy}"><div class="floor"></div>{body}<div class="vignette"></div></div></body></html>'''


# ---------- scenes ----------
W, H = 3840, 2160


def s_cover():
    body = f'''
<div class="ghost" style="font-size:520px;left:50%;top:50%;transform:translate(-50%,-50%)">MN VISUAL</div>
{viewfinder("00:00:00:01", "4K · 16:9")}
<div style="position:absolute;z-index:35;left:0;right:0;top:470px;text-align:center">
  <img src="{LOCKUP}" style="height:700px;filter:drop-shadow(0 30px 80px rgba(0,0,0,.6))" alt="MN Visual">
  <div class="rule" style="margin:110px auto 70px;width:160px"></div>
  <div class="title" style="font-size:44px;letter-spacing:.5em;font-weight:300">Présentation du site web</div>
  <div style="margin-top:36px;font-family:var(--display);font-size:24px;letter-spacing:.6em;color:var(--muted)">MEDNOUKHAL <span style="color:var(--accent)">·</span> PHOTOGRAPHIE <span style="color:var(--accent)">·</span> VIDÉOGRAPHIE</div>
</div>
{footbar(left="mednoukhal.com", mid="Desktop · Tablette · Mobile", right="Novembre 2026")}'''
    return page(W, H, body, gy="48%")


def s_hero():
    body = f'''
<div class="ghost" style="font-size:430px;left:50%;top:330px;transform:translateX(-50%)">MEDNOUKHAL</div>
{viewfinder()}
{brand(170, 215)}
<div class="eyebrow" style="position:absolute;z-index:35;right:170px;top:245px;--eb:21px">Site web · Responsive</div>
{floor_shadow(700, 1690, 2440, 150)}
{laptop("home-desktop", 795, 450, 2250)}
{floor_shadow(430, 1880, 760, 90)}
{tablet("home-tablet", 470, 965, 660, z=20)}
{floor_shadow(2970, 1860, 440, 80)}
{phone("home-phone", 3010, 1130, 360, z=21)}
{footbar()}'''
    return page(W, H, body, gy="58%")


def s_desktop():
    body = f'''
<div class="ghost" style="font-size:380px;right:-60px;top:120px">VITRINE</div>
{viewfinder("00:01:12:08")}
{brand(170, 215)}
{text_block(210, 560, 1120, "Desktop", 'Grand écran,<br><em>grand format.</em>',
            "Une navigation cinématographique pensée pour les écrans larges : vidéo plein cadre, typographie LEMON MILK et accent orange signature.",
            [("1440", "Viewport"), ("FR·EN·AR", "Langues"), ("6", "Pages")], tsize=96)}
{floor_shadow(1360, 1700, 2380, 150)}
{laptop("home-showcase-desktop", 1330, 440, 2380)}
{footbar()}'''
    return page(W, H, body, gx="66%", gy="55%")


def s_tablet():
    body = f'''
<div class="ghost" style="font-size:380px;right:-40px;top:90px">PHOTO</div>
{viewfinder("00:02:03:16", "3:4")}
{brand(170, 215)}
{text_block(210, 600, 1150, "Tablette", 'Pensé pour<br><em>le toucher.</em>',
            "Les albums photo et les films se parcourent du bout des doigts. Chaque mise en page se réorganise pour garder le cadre lisible.",
            [("834", "Viewport"), ("5", "Albums"), ("Tactile", "Navigation")], tsize=96)}
{floor_shadow(1640, 1800, 950, 120)}
{floor_shadow(2580, 1690, 950, 120)}
{tablet("photography-tablet", 1660, 600, 880, rot="rotate(-5deg)", z=12)}
{tablet("films-tablet", 2620, 360, 880, rot="rotate(4deg)", z=11)}
{footbar()}'''
    return page(W, H, body, gx="66%", gy="52%")


def s_mobile():
    body = f'''
<div class="ghost" style="font-size:380px;right:-40px;top:90px">MOBILE</div>
{viewfinder("00:03:41:02", "9:16")}
{brand(170, 215)}
{text_block(210, 600, 1250, "Mobile", 'Le cadre,<br><em>dans la poche.</em>',
            "Menu plein écran, boutons généreux et vidéos verticales : le site garde son caractère cinématographique jusque sur le plus petit écran.",
            [("390", "Viewport"), ("100%", "Responsive"), ("RTL", "Arabe")], tsize=96)}
{floor_shadow(1800, 1660, 560, 90)}
{floor_shadow(2400, 1580, 560, 90)}
{floor_shadow(3000, 1660, 560, 90)}
{phone("films-phone", 1830, 600, 500, rot="rotate(-6deg)", z=11)}
{phone("home-phone", 2420, 470, 500, z=13, extra="--halo:.22")}
{phone("home-about-phone", 3010, 600, 500, rot="rotate(6deg)", z=12)}
{footbar()}'''
    return page(W, H, body, gx="68%", gy="50%")


def s_pages():
    items = [("home-phone", "Accueil"), ("films-phone", "Films"), ("photography-phone", "Photographie"),
             ("coaching-phone", "Coaching"), ("advice-phone", "Conseils"), ("contact-phone", "Contact")]
    w, gap = 470, 108
    x0 = (W - (6 * w + 5 * gap)) // 2
    parts = []
    for i, (n, label) in enumerate(items):
        x = x0 + i * (w + gap)
        y = 650 + (50 if i % 2 else 0)
        parts.append(floor_shadow(x + 20, y + 940, w - 40, 70, 0.7))
        parts.append(phone(n, x, y, w, z=10 + i))
        parts.append(f'<div class="label" style="left:{x + 18}px;top:{y + 1030}px;z-index:35"><b>0{i + 1}</b>{label}</div>')
    body = f'''
{viewfinder("00:04:20:00")}
<div style="position:absolute;z-index:35;left:{x0}px;top:190px">
  <div class="eyebrow" style="--eb:22px">Toutes les pages</div>
  <h1 class="title" style="font-size:84px;margin-top:40px">Six pages, <em>une signature.</em></h1></div>
{brand(x0, 210, right=True)}
{''.join(parts)}
{footbar(x=x0)}'''
    return page(W, H, body, gy="60%")


def s_scroll():
    cols = [("films-desktop-full", 0, "mednoukhal.com/films"), ("home-desktop-full", 3050, "mednoukhal.com"),
            ("photography-desktop-full", 0, "mednoukhal.com/photography")]
    ww, gap, ph = 1140, 130, 2500
    wins = ""
    for i, (n, off, url) in enumerate(cols):
        wins += window(n, i * (ww + gap), 0, ww, ph, url, off=off, z=10 + i)
    cw = 3 * ww + 2 * gap
    chh = round((ph + 44) * ww / 1440)
    cx, cy = 2480, 1060
    body = f'''
{viewfinder("00:05:00:00")}
{brand(170, 215)}
<div style="position:absolute;z-index:35;left:210px;bottom:300px;width:1200px">
  <div class="eyebrow" style="--eb:22px">Parcours complet</div>
  <h1 class="title" style="font-size:90px;margin:40px 0 36px">Chaque page,<br><em>un plan-séquence.</em></h1>
  <p class="lead" style="--lead:30px">Du film d’ouverture jusqu’au formulaire, un seul fil visuel.</p></div>
<div style="position:absolute;z-index:5;left:{cx - cw // 2}px;top:{cy - chh // 2}px;width:{cw}px;height:{chh}px;transform-origin:50% 50%;transform:rotateX(54deg) rotateZ(-38deg) scale(.86)">{wins}</div>
{footbar()}'''
    return page(W, H, body, gx="64%", gy="48%")


def s_social():
    w, h = 2160, 2700
    body = f'''
<div class="ghost" style="font-size:300px;left:50%;top:1180px;transform:translateX(-50%)">MN VISUAL</div>
{viewfinder("00:00:15:00", "4:5", inset=64, fs=24, c=72)}
<div style="position:absolute;z-index:35;left:0;right:0;top:250px;text-align:center">
  <img src="{LOCKUP}" style="height:330px" alt="MN Visual">
  <div class="eyebrow" style="justify-content:center;margin-top:76px;--eb:30px">Nouveau site web</div>
</div>
{floor_shadow(430, 2260, 880, 110)}
{floor_shadow(1300, 2230, 420, 90)}
{tablet("home-tablet", 400, 1010, 900, z=11)}
{phone("photography-phone", 1330, 1360, 440, z=12, extra="--halo:.2")}
{footbar(left="mednoukhal.com", mid="", right="Films · Photo · Coaching", x=150, y=140, fs=24)}'''
    return page(w, h, body, gy="62%"), (w, h)


SCENES = {
    "00-cover": s_cover,
    "01-responsive-showcase": s_hero,
    "02-desktop": s_desktop,
    "03-tablet": s_tablet,
    "04-mobile": s_mobile,
    "05-all-pages-mobile": s_pages,
    "06-full-page-scroll": s_scroll,
    "07-instagram-post-4x5": s_social,
}


async def render(names):
    (ROOT / "jpg").mkdir(exist_ok=True)
    async with async_playwright() as pw:
        b = await pw.chromium.launch(channel="chrome")
        for name in names:
            res = SCENES[name]()
            html, (cw, ch) = res if isinstance(res, tuple) else (res, (W, H))
            f = SRC / f"{name}.html"
            f.write_text(html, encoding="utf-8")
            pg = await b.new_page(viewport={"width": cw, "height": ch}, device_scale_factor=1)
            await pg.goto(f.as_uri(), wait_until="load")
            await pg.evaluate("document.fonts.ready")
            await pg.wait_for_function("[...document.images].every(i=>i.complete)")
            await pg.wait_for_timeout(300)
            out = ROOT / f"{name}.png"
            await pg.screenshot(path=str(out))
            await pg.close()
            Image.open(out).convert("RGB").save(ROOT / "jpg" / f"{name}.jpg", quality=92, optimize=True, progressive=True)
            print("rendered", name)
    os._exit(0)


if __name__ == "__main__":
    picked = [n for n in SCENES if not sys.argv[1:] or any(a in n for a in sys.argv[1:])]
    asyncio.run(render(picked))
