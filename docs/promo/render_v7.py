#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Promo v7 — vertical 720x1280 @30fps : utilisation de SmartDownload APRES
installation sur Android, avec un vrai lien YouTube. 9 scenes pilotees par
les durees de voix reelles (voice-plan-v7.json). Ecran du telephone :
charte noir + or de l'app. Autonome : aucune dependance externe hors
PIL / numpy / imageio-ffmpeg.
Sortie : /tmp/promo/promo-v7-video.mp4 (video seule, le son est ajoute par mix_v7.py).
"""
import json, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import imageio

W, H = 720, 1280
FPS = 30
D = "/tmp/promo"
FONT_DIR = f"{D}/fonts"
YT_URL = "youtu.be/hozrRYVJIyA"
YT_TITLE = "What If Isagi Was Reborn with EVERY Weapon? (FULL VIDEO + ENDING)"
SITE = "smartdoawnload.vercel.app"

# couleurs ecran (charte app dark)
SCR_BG = (10, 10, 11)
SCR_CARD = (28, 24, 19)
SCR_INK = (246, 241, 228)
SCR_MUTED = (150, 142, 126)
SCR_LINE = (46, 42, 36)
GOLD = (212, 168, 67)
IVORY = (250, 248, 243)
YT_RED = (255, 0, 0)

# ---------------- plan de montage (source unique de verite) ----------------
plan = json.load(open(f"{D}/voice-plan-v7.json"))
TAILS = {"k1": 0.8, "k2": 0.6, "k3": 0.9, "k4": 0.8, "k5": 1.2,
         "k6": 0.6, "k7": 0.9, "k8": 1.0, "k9": 1.6}
VOICE_LEAD = 0.6

SCENES = []
_vstart = 0.0
for k in ("k1", "k2", "k3", "k4", "k5", "k6", "k7", "k8", "k9"):
    vd = plan[k]["dur"]
    SCENES.append((k, round(VOICE_LEAD + vd + TAILS[k], 3), round(_vstart + VOICE_LEAD, 3)))
    _vstart += VOICE_LEAD + vd + TAILS[k]
TOTAL = round(_vstart, 3)
json.dump({"total": TOTAL, "scenes": [{"key": k, "dur": d, "voice_start": s} for k, d, s in SCENES]},
          open(f"{D}/scene-plan-v7.json", "w"), indent=1)
print("plan :")
for k, d, s in SCENES:
    print(f"  {k}  scene {d:6.2f}s  voix @{s:6.2f}s")
print("total :", round(TOTAL, 2), "s")

# ----------------------------- utilitaires -----------------------------

def clamp01(x): return max(0.0, min(1.0, x))
def ease_out(x): return 1 - (1 - clamp01(x)) ** 3
def pop(x):
    x = clamp01(x)
    return 1 + 0.08 * math.sin(min(x, 1.0) * math.pi) if x < 1 else 1.0

from PIL import ImageFont
_fonts = {}
def F(size, weight="Regular"):
    key = (size, weight)
    if key not in _fonts:
        _fonts[key] = ImageFont.truetype(f"{FONT_DIR}/Poppins-{weight}.ttf", size)
    return _fonts[key]

def _norm(c):
    return c if len(c) == 4 else tuple(c) + (255,)

def text_layer(s, font, color, tracking=0):
    d = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
    box = d.textbbox((0, 0), s, font=font)
    w = box[2] - box[0] + tracking * max(len(s) - 1, 0)
    img = Image.new("RGBA", (max(w, 1), box[3] - box[1] + 8), (0, 0, 0, 0))
    ImageDraw.Draw(img).text((0, 4 - box[1]), s, font=font, fill=_norm(color))
    return img

def text_w(s, font, tracking=0):
    d = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
    box = d.textbbox((0, 0), s, font=font)
    return box[2] - box[0] + tracking * max(len(s) - 1, 0)

def rounded(d, box, r, **kw):
    d.rounded_rectangle(box, radius=r, **kw)

def arrow_down(d, cx, cy, s, color, width):
    d.line([(cx, cy - s), (cx, cy + s * 0.4)], fill=color, width=width)
    d.line([(cx - s * 0.6, cy - s * 0.1), (cx, cy + s * 0.5)], fill=color, width=width)
    d.line([(cx + s * 0.6, cy - s * 0.1), (cx, cy + s * 0.5)], fill=color, width=width)
    d.line([(cx - s, cy + s * 0.9), (cx + s, cy + s * 0.9)], fill=color, width=width)

# ----------------------------- fond de page -----------------------------

BLOB1 = Image.new("RGBA", (420, 420), (0, 0, 0, 0))
rounded(ImageDraw.Draw(BLOB1), [40, 40, 380, 380], 170, fill=GOLD + (255,))
BLOB1 = BLOB1.filter(ImageFilter.GaussianBlur(60))
BLOB2 = Image.new("RGBA", (380, 380), (0, 0, 0, 0))
rounded(ImageDraw.Draw(BLOB2), [30, 30, 350, 350], 160, fill=(196, 150, 84, 255))
BLOB2 = BLOB2.filter(ImageFilter.GaussianBlur(60))
BLOB3 = Image.new("RGBA", (340, 340), (0, 0, 0, 0))
rounded(ImageDraw.Draw(BLOB3), [30, 30, 310, 310], 150, fill=(178, 140, 70, 255))
BLOB3 = BLOB3.filter(ImageFilter.GaussianBlur(60))

def alpha_img(img, alpha):
    a = img.getchannel("A").point(lambda v: int(v * alpha))
    out = img.copy()
    out.putalpha(a)
    return out

def page(t):
    """Fond vertical ivoire + halos or (aplat floute, aucun degrade)."""
    img = Image.new("RGBA", (W, H), IVORY + (255,))
    img.alpha_composite(alpha_img(BLOB1, 0.13), (int(-160 + 50 * math.sin(t * 0.21)), int(-180 + 40 * math.sin(t * 0.17 + 1))))
    img.alpha_composite(alpha_img(BLOB2, 0.10), (int(W - 220 + 40 * math.sin(t * 0.14 + 2)), int(H - 420 + 36 * math.sin(t * 0.22 + 0.5))))
    img.alpha_composite(alpha_img(BLOB3, 0.12), (int(120 + 46 * math.sin(t * 0.11 + 4)), int(H - 320 + 30 * math.sin(t * 0.19 + 3))))
    return img

def ripple(img, cx, cy, radius, p, color=GOLD):
    """Onde de tap : cercle or qui grandit et s'efface."""
    if p <= 0 or p >= 1:
        return
    r = radius * (0.3 + 0.7 * p)
    a = int(120 * (1 - p))
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(ov).ellipse([cx - r, cy - r, cx + r, cy + r], outline=color + (a,), width=6)
    img.alpha_composite(ov)

def ease_in_screen(img, p, y=0):
    if p >= 1:
        return img
    h = int(img.height * (1 - p))
    mask = Image.new("L", img.size, 255)
    ImageDraw.Draw(mask).rectangle([0, 0, img.width, h], fill=0)
    out = img.copy()
    out.putalpha(Image.composite(Image.new("L", img.size, 0), out.getchannel("A"), mask))
    return out

# ----------------------------- ecran du telephone -----------------------------

PHONE_X, PHONE_Y, PHONE_W, PHONE_H = 84, 150, 552, 1050
RAD = 44

def phone_frame(content):
    """Content : image RGBA (PHONE_W x PHONE_H). Renvoie la page avec le telephone."""
    frame = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(frame)
    rounded(d, [PHONE_X - 12, PHONE_Y - 12, PHONE_X + PHONE_W + 12, PHONE_Y + PHONE_H + 12], RAD + 10,
            fill=(28, 24, 20, 255))
    frame.paste(content, (PHONE_X, PHONE_Y))
    mask = Image.new("L", (PHONE_W, PHONE_H), 0)
    rounded(ImageDraw.Draw(mask), [0, 0, PHONE_W - 1, PHONE_H - 1], RAD - 8, fill=255)
    frame.paste(content, (PHONE_X, PHONE_Y), mask)
    return frame

def screen_base():
    img = Image.new("RGBA", (PHONE_W, PHONE_H), SCR_BG + (255,))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([10, 14, 30, 60], 10, fill=(60, 55, 45, 255))  # camera punch
    return img, d

def app_icon(size=120):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rounded(d, [0, 0, size - 1, size - 1], int(size * 0.24), fill=SCR_BG + (255,), outline=GOLD + (255,), width=3)
    cx = cy = size // 2
    s = size * 0.28
    d.line([(cx, cy - s), (cx, cy + s * 0.45)], fill=GOLD + (255,), width=int(size * 0.07))
    d.line([(cx - s * 0.62, cy - s * 0.05), (cx, cy + s * 0.55)], fill=GOLD + (255,), width=int(size * 0.07))
    d.line([(cx + s * 0.62, cy - s * 0.05), (cx, cy + s * 0.55)], fill=GOLD + (255,), width=int(size * 0.07))
    d.line([(cx - s * 0.9, cy + s * 0.85), (cx + s * 0.9, cy + s * 0.85)], fill=GOLD + (255,), width=int(size * 0.07))
    return img

def yt_thumb(w=504, h=284):
    """Miniature YouTube simulee : fond nuance sombre + bouton play rouge."""
    img = Image.new("RGBA", (w, h), (24, 22, 26, 255))
    d = ImageDraw.Draw(img)
    for i in range(h):
        v = 24 + int(14 * i / h)
        d.line([(0, i), (w, i)], fill=(v, v - 2, v + 4, 255))
    for cx, cy, r in [(w * 0.2, h * 0.3, 70), (w * 0.8, h * 0.75, 90), (w * 0.6, h * 0.25, 55)]:
        ov = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        ImageDraw.Draw(ov).ellipse([cx - r, cy - r, cx + r, cy + r], fill=(70, 60, 80, 90))
        ov = ov.filter(ImageFilter.GaussianBlur(30))
        img.alpha_composite(ov)
    bx, by, bw, bh = w // 2 - 46, h // 2 - 32, 92, 64
    rounded(d, [bx, by, bx + bw, by + bh], 18, fill=YT_RED + (255,))
    d.polygon([(bx + 34, by + 16), (bx + 34, by + bh - 16), (bx + bw - 20, by + bh // 2)], fill=(255, 255, 255, 255))
    return img

def chip(label, selected=False, font_size=21, pad_x=20, h=46):
    f = F(font_size, "SemiBold")
    tw = text_w(label, f)
    w = tw + pad_x * 2
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    fill = GOLD if selected else SCR_CARD
    outline = GOLD if selected else SCR_LINE
    rounded(d, [0, 0, w - 1, h - 1], 12, fill=fill + (255,), outline=outline + (255,), width=2)
    txt = text_layer(label, f, ((16, 13, 8) if selected else SCR_INK))
    img.alpha_composite(txt, (pad_x, (h - txt.height) // 2))
    return img

def paste_center(base, img, cy, cx=None):
    x = (base.width - img.width) // 2 if cx is None else cx - img.width // 2
    base.alpha_composite(img, (x, int(cy - img.height / 2)))

def status_bar(img, d, dark=True):
    col = SCR_INK if dark else (30, 26, 20)
    d.text((28, 26), "23:37", font=F(20, "Medium"), fill=col + (235,))
    d.ellipse([PHONE_W - 88, 28, PHONE_W - 64, 46], outline=col + (220,), width=3)
    d.rectangle([PHONE_W - 84, 33, PHONE_W - 68, 41], fill=col + (220,))

# ----------------------------- scenes -----------------------------

def scene_home(t, p):
    """k1-k2 : icone sur l'ecran d'accueil Android, puis lancement de l'app."""
    img, d = screen_base()
    status_bar(img, d)
    if t < 0.55 * p if isinstance(p, float) else True:
        pass
    if p < 0.5:
        d.text((PHONE_W // 2 - 60, 90), "Accueil", font=F(22, "Medium"), fill=SCR_MUTED + (255,))
        for row in range(4):
            for col in range(4):
                x, y = 60 + col * 116, 150 + row * 150
                if (row, col) == (1, 1):
                    ic = app_icon(84)
                    s = 1.0 + 0.06 * math.sin(t * 2.2)
                    ic = ic.resize((int(84 * s), int(84 * s)), Image.LANCZOS)
                    img.alpha_composite(ic, (x - 6, y - 6))
                    lbl = text_layer("SmartDownload", F(14, "Medium"), SCR_INK)
                    img.alpha_composite(lbl, (x + 42 - lbl.width // 2, y + 92))
                else:
                    d.rounded_rectangle([x, y, x + 84, y + 84], 20, fill=(30, 28, 33, 255))
        dock = Image.new("RGBA", (PHONE_W - 40, 120), (0, 0, 0, 0))
        rounded(ImageDraw.Draw(dock), [0, 0, dock.width - 1, dock.height - 1], 30, fill=(24, 22, 26, 220))
        img.alpha_composite(dock, (20, PHONE_H - 160))
    else:
        # splash -> app : bandeau or + logo
        d.rounded_rectangle([PHONE_W // 2 - 130, 300, PHONE_W // 2 + 130, 560], 40, fill=SCR_CARD + (255,), outline=GOLD + (255,), width=3)
        ic = app_icon(130)
        img.alpha_composite(ic, (PHONE_W // 2 - 65, 330))
        lbl = text_layer("SmartDownload", F(28, "Bold"), SCR_INK)
        img.alpha_composite(lbl, (PHONE_W // 2 - lbl.width // 2, 470))
        hero = text_layer("Telecharge,", F(40, "Bold"), SCR_INK)
        img.alpha_composite(hero, (60, 640))
        hero2 = text_layer("simplement.", F(40, "Bold"), GOLD)
        img.alpha_composite(hero2, (60, 700))
        sub = text_layer("Gratuit - Sans inscription", F(20, "Medium"), SCR_MUTED)
        img.alpha_composite(sub, (60, 770))
    return img

def scene_youtube_copy(t, p):
    """k3 : lien YouTube a l'ecran, bouton partager/copier, toast lien copie."""
    img, d = screen_base()
    status_bar(img, d)
    d.text((28, 84), "YouTube", font=F(26, "Bold"), fill=(240, 240, 240, 255))
    th = yt_thumb(464, 240)
    img.alpha_composite(th, (28, 140))
    title = "What If Isagi Was Reborn with EVERY Weapon?"
    for i, ln in enumerate([title[:34], title[34:] + "..."]):
        d.text((28, 404 + i * 30), ln, font=F(19, "SemiBold"), fill=(235, 235, 235, 255))
    d.text((28, 470), "1,2 M vues - il y a 2 jours", font=F(17), fill=(160, 160, 160, 255))
    # bouton Partager
    bx, by, bw, bh = 150, 540, 220, 64
    sel = 0.4 < p < 0.75
    rounded(d, [bx, by, bx + bw, by + bh], 32, fill=YT_RED + (255,) if sel else (45, 42, 48, 255))
    lbl = text_layer("Partager", F(22, "SemiBold"), (255, 255, 255, 255))
    img.alpha_composite(lbl, (bx + (bw - lbl.width) // 2, by + (bh - lbl.height) // 2))
    if sel:
        ripple(img, bx + bw // 2, by + bh // 2, 70, (p - 0.4) / 0.35, color=(255, 120, 120))
    # toast "Lien copie"
    if p > 0.75:
        tp = clamp01((p - 0.75) / 0.1)
        toast = Image.new("RGBA", (PHONE_W - 60, 66), (0, 0, 0, 0))
        rounded(ImageDraw.Draw(toast), [0, 0, toast.width - 1, toast.height - 1], 14, fill=(235, 230, 220, 245))
        lbl = text_layer("Lien copie", F(20, "SemiBold"), (20, 18, 14))
        toast.alpha_composite(lbl, ((toast.width - lbl.width) // 2, (toast.height - lbl.height) // 2))
        y = int(PHONE_H - 220 - (1 - tp) * 40)
        img.alpha_composite(toast, (30, y))
    return img

def scene_paste_analyze(t, p):
    """k4 : champ lien rempli + bouton Analyser."""
    img, d = screen_base()
    status_bar(img, d)
    lbl = text_layer("Colle ton lien :", F(22, "Medium"), SCR_MUTED)
    img.alpha_composite(lbl, (44, 120))
    rounded(d, [40, 170, PHONE_W - 40, 240], 16, fill=SCR_CARD + (255,), outline=GOLD + (255,) if p > 0.35 else SCR_LINE + (255,), width=2)
    shown = YT_URL[:int(len(YT_URL) * clamp01(p / 0.35))]
    d.text((60, 192), shown, font=F(21), fill=SCR_INK + (255,))
    if p > 0.35:
        cur = int(6 * math.sin(t * 6)) 
        d.line([(66 + text_w(shown, F(21)), 186), (66 + text_w(shown, F(21)), 226)], fill=GOLD + (255,), width=2 + max(cur, 0))
    bx, by, bw, bh = 110, 320, PHONE_W - 220, 78
    active = p > 0.45
    scale = 1.0
    if 0.45 < p < 0.6:
        scale = 1.0 + 0.05 * math.sin((p - 0.45) / 0.15 * math.pi)
    bw2, bh2 = int(bw * scale), int(bh * scale)
    rounded(d, [PHONE_W // 2 - bw2 // 2, by - (bh2 - bh) // 2, PHONE_W // 2 + bw2 // 2, by + bh - (bh2 - bh) // 2], 18,
            fill=GOLD + (255,) if active else (60, 52, 38, 255))
    lbl = text_layer("Analyser", F(26, "Bold"), (16, 13, 8) if active else SCR_MUTED)
    img.alpha_composite(lbl, (PHONE_W // 2 - lbl.width // 2, by + (bh - lbl.height) // 2 - (bh2 - bh) // 2))
    if 0.45 < p < 0.62:
        ripple(img, PHONE_W // 2, by + bh // 2, 80, (p - 0.45) / 0.17)
    d.text((PHONE_W // 2 - 118, 470), "MP4 ou MP3, sans compte.", font=F(19), fill=SCR_MUTED + (255,))
    return img

def scene_result(t, p):
    """k5 : analyse -> carte resultat (miniature, titre reel, formats)."""
    img, d = screen_base()
    status_bar(img, d)
    card_y = 96
    card_h = 470
    ap = ease_out(p / 0.3) if p < 0.3 else 1.0
    cy = int(card_y + (1 - ap) * 60)
    card = Image.new("RGBA", (PHONE_W - 56, card_h), (0, 0, 0, 0))
    cd = ImageDraw.Draw(card)
    rounded(cd, [0, 0, card.width - 1, card_h - 1], 24, fill=SCR_CARD + (255,), outline=SCR_LINE + (255,), width=2)
    img.alpha_composite(card, (28, cy))
    th = yt_thumb(card.width - 40, 210)
    img.alpha_composite(th, (48, cy + 20))
    t1 = YT_TITLE[:30]
    t2 = YT_TITLE[30:60] + "..."
    img.alpha_composite(text_layer(t1, F(21, "SemiBold"), SCR_INK), (48, cy + 250))
    img.alpha_composite(text_layer(t2, F(21, "SemiBold"), SCR_INK), (48, cy + 282))
    img.alpha_composite(text_layer("Video YouTube - 12:47", F(17), SCR_MUTED), (48, cy + 318))
    # chips formats (grille 2x2, aucune superposition)
    ch1 = chip("MP4 - 1080p")
    ch2 = chip("MP4 - 720p")
    ch3 = chip("MP4 - 360p")
    ch4 = chip("MP3 - audio")
    img.alpha_composite(ch1, (48, cy + 350))
    img.alpha_composite(ch2, (48 + ch1.width + 16, cy + 350))
    img.alpha_composite(ch3, (48, cy + 408))
    img.alpha_composite(ch4, (48 + ch3.width + 16, cy + 408))
    if p > 0.55:
        ripple(img, 48 + ch2.width // 2, cy + 350 + 23, 60, (p - 0.55) / 0.25)
    return img

def scene_choose_dl(t, p):
    """k6 : 720p selectionne + bouton Telecharger enfonce."""
    img, d = screen_base()
    status_bar(img, d)
    img.alpha_composite(text_layer("Choisis ta qualite :", F(22, "Medium"), SCR_MUTED), (44, 110))
    opts = [("MP4 - 1080p", False), ("MP4 - 720p", True), ("MP4 - 360p", False), ("MP3 - audio", False)]
    y = 170
    for label, sel in opts:
        bx, bw, bh = 44, PHONE_W - 88, 84
        if sel and p > 0.35:
            rounded(d, [bx, y, bx + bw, y + bh], 20, fill=(38, 32, 22, 255), outline=GOLD + (255,), width=3)
            d.ellipse([bx + 18, y + bh // 2 - 13, bx + 44, y + bh // 2 + 13], outline=GOLD + (255,), width=3)
            d.ellipse([bx + 24, y + bh // 2 - 7, bx + 38, y + bh // 2 + 7], fill=GOLD + (255,))
            img.alpha_composite(text_layer(label, F(24, "SemiBold"), GOLD), (bx + 70, y + (bh - 30) // 2))
            img.alpha_composite(text_layer("Recommande", F(16), SCR_MUTED), (bx + 70, y + bh - 40))
        else:
            rounded(d, [bx, y, bx + bw, y + bh], 20, fill=SCR_CARD + (255,), outline=SCR_LINE + (255,), width=2)
            d.ellipse([bx + 18, y + bh // 2 - 13, bx + 44, y + bh // 2 + 13], outline=SCR_MUTED + (255,), width=3)
            img.alpha_composite(text_layer(label, F(24), SCR_INK), (bx + 70, y + (bh - 30) // 2))
        y += 102
    by, bh = PHONE_H - 260, 84
    active = p > 0.55
    rounded(d, [PHONE_W // 2 - 200, by, PHONE_W // 2 + 200, by + bh], 18, fill=GOLD + (255,) if active else (60, 52, 38, 255))
    img.alpha_composite(text_layer("Telecharger", F(26, "Bold"), (16, 13, 8) if active else SCR_MUTED),
                        (PHONE_W // 2 - text_w("Telecharger", F(26, "Bold")) // 2, by + (bh - 36) // 2))
    if 0.55 < p < 0.75:
        ripple(img, PHONE_W // 2, by + bh // 2, 90, (p - 0.55) / 0.2)
    return img

def scene_ad(t, p):
    """k7 : interstitiel publicitaire (simulation fidele de l'unit Adsterra)."""
    img, d = screen_base()
    status_bar(img, d)
    img.alpha_composite(text_layer("Publicite", F(18), SCR_MUTED), (44, 90))
    card = Image.new("RGBA", (PHONE_W - 80, 620), (0, 0, 0, 0))
    cd = ImageDraw.Draw(card)
    rounded(cd, [0, 0, card.width - 1, 619], 26, fill=(30, 27, 24, 255), outline=GOLD + (255,), width=3)
    img.alpha_composite(card, (40, 140))
    inner = Image.new("RGBA", (card.width - 40, 470), (0, 0, 0, 0))
    idr = ImageDraw.Draw(inner)
    idr.rectangle([0, 0, inner.width - 1, inner.height - 1], fill=(46, 40, 34, 255))
    for i in range(0, inner.width, 56):
        idr.line([(i, 0), (i + 28, inner.height)], fill=(56, 50, 42, 255), width=14)
    img.alpha_composite(inner, (60, 170))
    cx, cy = 40 + (PHONE_W - 80) // 2, 140 + 235
    d.rounded_rectangle([cx - 170, cy - 60, cx + 170, cy + 60], 20, fill=(12, 10, 9, 235))
    img.alpha_composite(text_layer("Votre pub ici", F(26, "Bold"), GOLD), (cx - text_w("Votre pub ici", F(26, "Bold")) // 2, cy - 40))
    img.alpha_composite(text_layer("5 s avant la priorite", F(18), SCR_MUTED), (cx - text_w("5 s avant la priorite", F(18)) // 2, cy + 8))
    # compte a rebours
    img.alpha_composite(text_layer("Priorite dans 3s", F(22, "SemiBold"), SCR_INK), (44, 800))
    # bouton passer
    bx, by, bw, bh = PHONE_W - 190, 860, 146, 54
    rounded(d, [bx, by, bx + bw, by + bh], 27, outline=SCR_MUTED + (255,), width=2)
    img.alpha_composite(text_layer("Passer", F(19, "SemiBold"), SCR_MUTED), (bx + (bw - text_w("Passer", F(19, "SemiBold"))) // 2, by + 14))
    if p > 0.7:
        ripple(img, bx + bw // 2, by + bh // 2, 60, (p - 0.7) / 0.3)
    return img

def scene_done(t, p):
    """k8 : progression -> fichier enregistre."""
    img, d = screen_base()
    status_bar(img, d)
    img.alpha_composite(text_layer(YT_TITLE[:28], F(20, "SemiBold"), SCR_INK), (44, 110))
    img.alpha_composite(text_layer("MP4 - 720p", F(18), SCR_MUTED), (44, 146))
    # barre de progression
    by = 210
    rounded(d, [44, by, PHONE_W - 44, by + 26], 13, fill=(32, 28, 24, 255))
    prog = ease_out(clamp01(p / 0.55))
    if prog > 0.01:
        rounded(d, [44, by, int(44 + (PHONE_W - 88) * prog), by + 26], 13, fill=GOLD + (255,))
    img.alpha_composite(text_layer(f"{int(prog * 100)} %", F(18, "Medium"), SCR_MUTED), (44, by + 40))
    # carte terminee
    if p > 0.6:
        cp = clamp01((p - 0.6) / 0.15)
        card_y = int(330 + (1 - cp) * 50)
        card = Image.new("RGBA", (PHONE_W - 88, 300), (0, 0, 0, 0))
        cd = ImageDraw.Draw(card)
        rounded(cd, [0, 0, card.width - 1, 299], 26, fill=SCR_CARD + (255,), outline=GOLD + (255,), width=3)
        img.alpha_composite(card, (44, card_y))
        ic = app_icon(88)
        img.alpha_composite(ic, (68, card_y + 40))
        img.alpha_composite(text_layer("Fichier enregistre", F(24, "Bold"), SCR_INK), (180, card_y + 56))
        img.alpha_composite(text_layer("What If Isagi... (1).mp4", F(17), SCR_MUTED), (180, card_y + 96))
        img.alpha_composite(text_layer("Pret a etre partage !", F(20, "SemiBold"), GOLD), (68, card_y + 180))
        if p > 0.75:
            ripple(img, PHONE_W // 2, card_y + 150, 120, (p - 0.75) / 0.25)
    return img

def scene_outro(t, p):
    """k9 : marque + site + CTA."""
    img, d = screen_base()
    status_bar(img, d)
    ic = app_icon(150)
    s = 1.0 + 0.03 * math.sin(t * 1.8)
    ic = ic.resize((int(150 * s), int(150 * s)), Image.LANCZOS)
    img.alpha_composite(ic, (PHONE_W // 2 - ic.width // 2, 220))
    img.alpha_composite(text_layer("SmartDownload", F(34, "Bold"), SCR_INK), (PHONE_W // 2 - text_w("SmartDownload", F(34, "Bold")) // 2, 400))
    img.alpha_composite(text_layer("Telecharge, simplement.", F(22), GOLD), (PHONE_W // 2 - text_w("Telecharge, simplement.", F(22)) // 2, 460))
    rounded(d, [PHONE_W // 2 - 220, 560, PHONE_W // 2 + 220, 640], 40, fill=GOLD + (255,))
    img.alpha_composite(text_layer(SITE, F(24, "SemiBold"), (16, 13, 8)), (PHONE_W // 2 - text_w(SITE, F(24, "SemiBold")) // 2, 580))
    img.alpha_composite(text_layer("MP4 - MP3 - Gratuit - Sans inscription", F(19), SCR_MUTED),
                        (PHONE_W // 2 - text_w("MP4 - MP3 - Gratuit - Sans inscription", F(19)) // 2, 700))
    img.alpha_composite(text_layer("Eddition Smartebooks", F(18, "Medium"), SCR_MUTED),
                        (PHONE_W // 2 - text_w("Eddition Smartebooks", F(18, "Medium")) // 2, 800))
    return img

SCENE_FN = {
    "k1": lambda t, p: scene_home(t, p * 0.9),
    "k2": lambda t, p: scene_home(t, 0.55 + 0.45 * p),
    "k3": scene_youtube_copy,
    "k4": scene_paste_analyze,
    "k5": scene_result,
    "k6": scene_choose_dl,
    "k7": scene_ad,
    "k8": scene_done,
    "k9": scene_outro,
}

# ----------------------------- rendu -----------------------------

def render_frame(fidx):
    time_s = fidx / FPS
    for key, dur, vstart in SCENES:
        idx = SCENES.index((key, dur, vstart))
        scene_start = sum(s[1] for s in SCENES[:idx])
        if scene_start <= time_s < scene_start + dur or (idx == len(SCENES) - 1 and time_s >= scene_start):
            local_t = time_s - scene_start
            p = clamp01(local_t / dur)
            content = SCENE_FN[key](local_t, p)
            page_img = page(time_s)
            frame = page_img.copy()
            frame.alpha_composite(phone_frame(content))
            return frame
    frame = page(time_s)
    return frame

writer = imageio.get_writer(f"{D}/promo-v7-video.mp4", fps=FPS, codec="libx264",
                            quality=8, macro_block_size=1, ffmpeg_params=["-pix_fmt", "yuv420p"])
total_frames = int(TOTAL * FPS)
for fidx in range(total_frames):
    frame = render_frame(fidx).convert("RGB")
    writer.append_data(np.asarray(frame))
    if fidx % 300 == 0:
        print(f"  frame {fidx}/{total_frames}")
writer.close()
print("video ok :", f"{D}/promo-v7-video.mp4")
