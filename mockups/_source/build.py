"""Build the Med Noukhal presentation mockups.

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
  <div class="status" style="background:{bg}"><span>9:41&nbsp;&nbsp;Sam. 14 nov.</span><span class="ic">{WIFI}{BATT}</span></div>
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
  <img src="{MARK}" alt=""><div class="word">MED NOUKHAL<small>{sub}</small></div></div>'''


def footbar(left="mednoukhal.com", mid='Films <span class="dot">·</span> Photographie <span class="dot">·</span> Avis', right="© 2026 Med Noukhal", x=170, y=118, fs=19):
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
<div style="position:absolute;z-index:35;left:0;right:0;top:640px;text-align:center">
  <img src="{LOCKUP}" style="width:2200px;filter:drop-shadow(0 30px 80px rgba(0,0,0,.6))" alt="Med Noukhal Visuals">
  <div class="rule" style="margin:150px auto 80px;width:160px"></div>
  <div class="title" style="font-size:44px;letter-spacing:.5em;font-weight:300">Présentation du site web</div>
  <div style="margin-top:36px;font-family:var(--display);font-size:24px;letter-spacing:.6em;color:var(--muted)">MED NOUKHAL <span style="color:var(--accent)">·</span> PHOTOGRAPHIE <span style="color:var(--accent)">·</span> VIDÉOGRAPHIE</div>
</div>
{footbar(left="mednoukhal.com", mid="Desktop · Tablette · Mobile", right="Novembre 2026")}'''
    return page(W, H, body, gy="48%")


def s_hero():
    body = f'''
<div class="ghost" style="font-size:360px;left:50%;top:360px;transform:translateX(-50%)">MED NOUKHAL</div>
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
            [("1440", "Viewport"), ("EN·FR·AR", "Langues"), ("5", "Pages")], tsize=96)}
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
            [("834", "Viewport"), ("3", "Albums"), ("Tactile", "Navigation")], tsize=96)}
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
    items = [("home-phone", "Accueil"), ("films-phone", "Films"), ("photography-phone", "Albums"),
             ("reviews-phone", "Avis"), ("contact-phone", "Contact"), ("ar-phone", "Arabe")]
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
  <h1 class="title" style="font-size:84px;margin-top:40px">Cinq pages, <em>trois langues.</em></h1></div>
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
  <img src="{LOCKUP}" style="width:1500px" alt="Med Noukhal Visuals">
  <div class="eyebrow" style="justify-content:center;margin-top:76px;--eb:30px">Nouveau site web</div>
</div>
{floor_shadow(430, 2260, 880, 110)}
{floor_shadow(1300, 2230, 420, 90)}
{tablet("home-tablet", 400, 1010, 900, z=11)}
{phone("photography-phone", 1330, 1360, 440, z=12, extra="--halo:.2")}
{footbar(left="mednoukhal.com", mid="", right="Films · Photo · Avis", x=150, y=140, fs=24)}'''
    return page(w, h, body, gy="62%"), (w, h)


# ---------- extra scenes (Nov. 2026) ----------
def film_strip(frames, x, y, w, rot="rotate(-7deg)", fw=1280, fh=800, gap=64, z=10):
    """A 35 mm film strip: perforations top and bottom, edge markings, and one page per frame."""
    holes = "".join("<i></i>" for _ in range(60))
    edge = "".join(f'<span>MN VISUAL 400 <b>▸</b> {n:02d}A</span>' for n in range(1, 9))
    cells = "".join(f'<div class="cell"><img src="{shot(n)}" alt=""><em>{i + 1:02d}</em></div>' for i, n in enumerate(frames))
    return f'''<div class="strip" style="left:{x}px;top:{y}px;width:{w}px;--fw:{fw}px;--fh:{fh}px;--fg:{gap}px;transform:{rot};z-index:{z}">
  <div class="holes">{holes}</div><div class="edge">{edge}</div>
  <div class="cells">{cells}</div>
  <div class="edge">{edge}</div><div class="holes">{holes}</div></div>'''


def s_strip():
    frames = ["home-desktop", "home-showcase-desktop", "films-desktop", "home-about-desktop", "photography-desktop", "home-reviews-desktop", "contact-desktop"]
    body = f'''
{viewfinder("00:06:12:20", "35 MM")}
{brand(170, 215)}
<div style="position:absolute;z-index:35;right:190px;top:230px;width:1500px;text-align:right">
  <div class="eyebrow" style="--eb:22px;justify-content:flex-end">Plan par plan</div>
  <h1 class="title" style="font-size:92px;margin-top:40px">Un site <em>monté</em><br>comme un film.</h1></div>
{film_strip(frames, -420, 745, 4700)}
{footbar()}'''
    return page(W, H, body, gy="66%")


def s_dashboard():
    body = f'''
<div class="ghost" style="font-size:330px;right:-60px;top:110px">STUDIO</div>
{viewfinder("00:07:00:00", "ADMIN")}
{brand(170, 215)}
{text_block(210, 560, 1120, "Tableau de bord", 'Le contenu,<br><em>entre ses mains.</em>',
            "Un tableau de bord sur mesure, hébergé avec le site : films, albums, photos de l’accueil, textes en trois langues et publication en un clic. Sans abonnement ni CMS tiers.",
            [("0 €", "Abonnement"), ("3", "Langues"), ("1 clic", "Publication")], tsize=92)}
{floor_shadow(1360, 1700, 2380, 150)}
{laptop("dashboard-albums-photos-desktop", 1330, 420, 2300, url="mednoukhal.com/mnvisual00.rec")}
{floor_shadow(3180, 1900, 460, 80)}
{phone("dashboard-albums-detail-phone", 3200, 1010, 420, z=21, extra="--halo:.2")}
{footbar(mid='Films <span class="dot">·</span> Albums <span class="dot">·</span> Textes <span class="dot">·</span> Publication')}'''
    return page(W, H, body, gx="66%", gy="55%")


def s_popup():
    body = f'''
<div class="ghost" style="font-size:380px;right:-40px;top:100px">CINEMA</div>
{viewfinder("00:01:04:00", "16:9")}
{brand(170, 215)}
{text_block(210, 600, 1100, "Films", 'Chaque film,<br><em>en plein cadre.</em>',
            "Une grille éditoriale numérotée, des aperçus au survol, et le film qui s’ouvre dans un lecteur en popup, sans quitter la page.",
            [("16:9", "Cadre"), ("2", "Par ligne"), ("1 clic", "Lecture")], tsize=92)}
{floor_shadow(1380, 1720, 2300, 150)}
{window("films-desktop-full", 1420, 300, 1700, 1000, "mednoukhal.com/films", z=9, extra="opacity:.55;filter:blur(1px)")}
{laptop("films-popup-desktop", 1500, 560, 2150, url="mednoukhal.com/films", z=12)}
{floor_shadow(3240, 1880, 440, 80)}
{phone("films-popup-phone", 3260, 1080, 400, z=21, extra="--halo:.22")}
{footbar()}'''
    return page(W, H, body, gx="66%", gy="55%")


def s_iso():
    names = ["home-phone", "films-phone", "photography-phone", "reviews-phone", "contact-phone", "home-showcase-phone"]
    w, gx, gy = 560, 700, 1250
    phones = "".join(phone(n, (i % 3) * gx, (i // 3) * gy + (180 if i % 3 == 1 else 0), w, z=10 + i) for i, n in enumerate(names))
    cw, ch = 2 * gx + w, gy + round(w * 874 / 420) + 180
    body = f'''
{viewfinder("00:08:30:00", "9:16")}
{brand(170, 215)}
<div style="position:absolute;z-index:35;left:210px;bottom:300px;width:1250px">
  <div class="eyebrow" style="--eb:22px">Mobile</div>
  <h1 class="title" style="font-size:92px;margin:40px 0 36px">Toutes les pages,<br><em>dans la main.</em></h1>
  <p class="lead" style="--lead:30px">Vidéos plein écran, albums au doigt et carrousels qui se balaient : le même cadre sur chaque page.</p></div>
<div style="position:absolute;z-index:5;left:{2560 - cw // 2}px;top:{1080 - ch // 2}px;width:{cw}px;height:{ch}px;transform:rotateX(52deg) rotateZ(-34deg) scale(.78)">{phones}</div>
{footbar()}'''
    return page(W, H, body, gx="66%", gy="50%")


def s_languages():
    body = f'''
<div class="ghost arabic" style="font-size:420px;right:-40px;top:60px">مرحبا</div>
{viewfinder("00:09:15:00", "EN · FR · AR")}
{brand(170, 215)}
{text_block(210, 600, 1150, "Trois langues", 'Un seul style,<br><em>trois langues.</em>',
            "Anglais, français et arabe, de droite à gauche : chaque page, chaque menu et chaque texte du tableau de bord existe dans les trois langues.",
            [("EN", "English"), ("FR", "Français"), ("AR", "<span class='arabic'>العربية</span>")], tsize=92)}
{floor_shadow(1450, 1720, 1900, 140)}
{window("ar-desktop", 1480, 420, 1880, 900, "mednoukhal.com/ar", z=10)}
{floor_shadow(2980, 1900, 460, 80)}
{phone("ar-phone", 3000, 900, 440, rot="rotate(5deg)", z=21, extra="--halo:.2")}
{floor_shadow(1220, 1930, 420, 80)}
{phone("home-phone", 1240, 1000, 400, rot="rotate(-5deg)", z=20)}
{footbar(mid='English <span class="dot">·</span> Français <span class="dot">·</span> <span class="arabic">العربية</span>')}'''
    return page(W, H, body, gx="66%", gy="56%")


def s_case():
    credits = [("Client", "Med Noukhal · Vidéaste & photographe"), ("Mission", "Design · Développement · Tableau de bord"),
               ("Technologies", "Astro · PHP · ffmpeg"), ("Livraison", "Novembre 2026")]
    rows = "".join(f'<div><b>{a}</b><span>{b}</span></div>' for a, b in credits)
    body = f'''
{viewfinder("00:10:00:00", "CASE STUDY")}
<div style="position:absolute;z-index:35;left:210px;top:330px;width:1300px">
  <div class="eyebrow" style="--eb:22px">Étude de cas · Codesommet</div>
  <img src="{LOCKUP}" style="width:1180px;margin:70px 0 60px;display:block" alt="Med Noukhal Visuals">
  <p class="lead" style="--lead:31px">Un site vitrine cinématographique pour un vidéaste et photographe : films en plein cadre, albums photo, avis clients, et un tableau de bord sur mesure pour tout gérer seul.</p>
  <div class="credits">{rows}</div></div>
{floor_shadow(1640, 1720, 2100, 140)}
{laptop("home-desktop", 1620, 470, 2100)}
{floor_shadow(3260, 1890, 400, 80)}
{phone("home-showcase-phone", 3290, 1060, 380, z=21, extra="--halo:.22")}
{footbar(left="codesommet.com", mid='Étude de cas <span class="dot">·</span> Site web', right="mednoukhal.com")}'''
    return page(W, H, body, gx="70%", gy="54%")


def s_story():
    w, h = 2160, 3840
    body = f'''
<div class="ghost" style="font-size:380px;left:50%;top:2650px;transform:translateX(-50%)">VISUALS</div>
{viewfinder("00:00:09:16", "9:16", inset=64, fs=26, c=76)}
<div style="position:absolute;z-index:35;left:0;right:0;top:330px;text-align:center">
  <img src="{LOCKUP}" style="width:1500px" alt="Med Noukhal Visuals">
  <div class="eyebrow" style="justify-content:center;margin-top:84px;--eb:32px">Nouveau site web</div>
</div>
{floor_shadow(560, 3260, 1040, 120)}
{phone("home-phone", 560, 1080, 1040, z=12, extra="--halo:.25")}
{floor_shadow(1520, 3420, 520, 90)}
{phone("films-popup-phone", 1500, 2180, 540, rot="rotate(7deg)", z=13)}
{footbar(left="mednoukhal.com", mid="", right="Films · Photo · Avis", x=150, y=150, fs=26)}'''
    return page(w, h, body, gy="55%"), (w, h)


SCENES = {
    "00-cover": s_cover,
    "01-responsive-showcase": s_hero,
    "02-desktop": s_desktop,
    "03-tablet": s_tablet,
    "04-mobile": s_mobile,
    "05-all-pages-mobile": s_pages,
    "06-full-page-scroll": s_scroll,
    "07-instagram-post-4x5": s_social,
    "08-film-strip": s_strip,
    "09-dashboard": s_dashboard,
    "10-films-popup": s_popup,
    "11-isometric-mobile": s_iso,
    "12-three-languages": s_languages,
    "13-case-study-codesommet": s_case,
    "14-instagram-story-9x16": s_story,
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
