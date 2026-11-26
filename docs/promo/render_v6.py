#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Promo v6 — vertical 720x1280 @30fps : utilisation de SmartDownload APRES
installation sur Android. 9 scenes pilotees par les durees de voix reelles
(voice-plan-v6.json). Ecran du telephone : charte noir + or de l'app.
Helpers graphiques reutilises depuis render.py (import render as R).
Sortie : /tmp/promo/promo-v6-video.mp4 (video seule, le son est ajoute par mix_v6.py).
"""
import json, math, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, "/tmp/promo")
import render as R

W, H = 720, 1280
FPS = 30
D = "/tmp/promo"
FB_URL = "https://www.facebook.com/share/v/1KWuKPa4cy/"
SITE = "smartdoawnload.vercel.app"

# couleurs ecran (charte app dark)
SCR_BG = (10, 10, 11)        # --bg
SCR_CARD = (23, 19, 16)      # --accent-ink comme carte
SCR_INK = (246, 241, 228)    # --ink
SCR_MUTED = (150, 142, 126)
SCR_LINE = (46, 42, 36)

# ---------------- plan de montage (source unique de verite) ----------------
plan = json.load(open(f"{D}/voice-plan-v6.json"))
TAILS = {"k1": 0.8, "k2": 0.6, "k3": 0.7, "k4": 0.8, "k5": 1.2,
         "k6": 0.6, "k7": 0.9, "k8": 1.0, "k9": 1.6}
VOICE_LEAD = 0.6  # la voix demarre 0,6 s apres le debut de la scene

SCENES = []           # [(cle, duree, voice_start)]
_vstart = 0.0
for k in ("k1", "k2", "k3", "k4", "k5", "k6", "k7", "k8", "k9"):
    vd = plan[k]["dur"]
    SCENES.append((k, round(VOICE_LEAD + vd + TAILS[k], 3), round(_vstart + VOICE_LEAD, 3)))
    _vstart += VOICE_LEAD + vd + TAILS[k]
TOTAL = round(_vstart, 3)
json.dump({"total": TOTAL, "scenes": [{"key": k, "dur": d, "voice_start": s} for k, d, s in SCENES]},
          open(f"{D}/scene-plan-v6.json", "w"), indent=1)
print("plan :")
for k, d, s in SCENES:
    print(f"  {k}  scene {d:6.2f}s  voix @{s:6.2f}s")
print("total :", round(TOTAL, 2), "s")

# ----------------------------- utilitaires -----------------------------

def ease_out(x): return R.ease_out(x)
def clamp01(x): return R.clamp01(x)
def pop(x): return R.ease_pop(x)

def page(t):
    """Fond vertical ivoire + halos or (aplat floute, aucun degrade)."""
    img = Image.new("RGBA", (W, H), R.IVORY + (255,))
    b1 = R.alpha_img(R.BLOB1, 0.13)
    b2 = R.alpha_img(R.BLOB2, 0.10)
    b3 = R.alpha_img(R.BLOB3, 0.12)
    img.alpha_composite(b1, (int(-160 + 50 * math.sin(t * 0.21)), int(-180 + 40 * math.sin(t * 0.17 + 1))))
    img.alpha_composite(b2, (int(W - 220 + 40 * math.sin(t * 0.14 + 2)), int(H - 420 + 36 * math.sin(t * 0.22 + 0.5))))
    img.alpha_composite(b3, (int(120 + 46 * math.sin(t * 0.11 + 4)), int(H - 320 + 30 * math.sin(t * 0.19 + 3))))
    return img

def small_chip(label, selected=False, font_size=20, pad_x=20, h=44):
    f = R.POPP_SB(font_size)
    tmp = R.text_layer(label, f, R.INK)
    w = tmp.width + pad_x * 2
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    fill = R.GOLD if selected else SCR_CARD
    outline = R.GOLD if selected else SCR_LINE
    R.rounded(d, [0, 0, w - 1, h - 1], 12, fill=fill + (255,), outline=outline + (255,), width=2)
    txt = R.text_layer(label, f, (R.BLACK_CARD if selected else SCR_INK))
    img.alpha_composite(txt, (pad_x, (h - txt.height) // 2))
    return img

def ripple(img, cx, cy, radius, p, color=R.GOLD):
    """Onde de tap : cercle or qui grandit et s'efface."""
    if p <= 0 or p >= 1: return
    r = radius * (0.3 + 0.7 * p)
    a = int(150 * (1 - p))
    ov = Image.new("RGBA", (int(r * 2) + 4, int(r * 2) + 4), (0, 0, 0, 0))
    ImageDraw.Draw(ov).ellipse([2, 2, ov.width - 3, ov.height - 3], outline=color + (a,), width=5)
    img.alpha_composite(ov, (int(cx - ov.width / 2), int(cy - ov.height / 2)))

# ------------------------------ telephone ------------------------------

PHONE_W, PHONE_H, BEZEL = 544, 1136, 16
SCR_W, SCR_H = PHONE_W - BEZEL * 2, PHONE_H - BEZEL * 2   # 512 x 1104
CAM_H = 26  # encoche

def phone(content, t, scale=1.0, dy=0):
    """Cadre de telephone + contenu d'ecran (fonction content(draw, p, t) sur Image)."""
    img = page(t)
    pw, ph = int(PHONE_W * scale), int(PHONE_H * scale)
    sw, sh = int(SCR_W * scale), int(SCR_H * scale)
    px, py = int((W - pw) / 2), int((H - ph) / 2 + dy)
    body = Image.new("RGBA", (pw + 8, ph + 8), (0, 0, 0, 0))
    bd = ImageDraw.Draw(body)
    R.rounded(bd, [0, 0, pw + 7, ph + 7], int(52 * scale), fill=(24, 22, 20, 255))
    R.rounded(bd, [2, 2, pw + 5, ph + 5], int(50 * scale), fill=(34, 30, 26, 255))
    img.alpha_composite(body, (px - 4, py - 4))
    # ombre portee legere
    sh_img = Image.new("RGBA", (pw + 60, ph + 60), (0, 0, 0, 0))
    ImageDraw.Draw(sh_img).rounded_rectangle([30, 34, 30 + pw, 34 + ph], int(52 * scale), fill=(60, 50, 20, 70))
    sh_img = sh_img.filter(ImageFilter.GaussianBlur(16))
    img.alpha_composite(sh_img, (px - 30, py - 22))
    # ecran
    scr = Image.new("RGBA", (sw, sh), SCR_BG + (255,))
    sd = ImageDraw.Draw(scr)
    content(sd, scr, scale)
    mask = Image.new("L", (sw * 2, sh * 2), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, sw * 2 - 1, sh * 2 - 1], int(40 * scale * 2), fill=255)
    mask = mask.resize((sw, sh), Image.LANCZOS)
    img.paste(scr.convert("RGB"), (px + BEZEL, py + BEZEL), mask)
    return img

def status_bar(d, s, scale=1.0):
    f = R.POPP_SB(int(17 * scale))
    d.text((int(26 * scale), int(9 * scale)), "14:20", font=f, fill=SCR_INK)
    # wifi + batterie (formes simples)
    x = int(SCR_W - 74 * scale)
    y = int(14 * scale)
    d.pieslice([x, y - 6, x + 20, y + 14], 200, 340, fill=SCR_INK)
    d.rectangle([x + 28, y - 5, x + 28 + int(26 * scale), y + 9], outline=SCR_INK, width=2)
    d.rectangle([x + 30, y - 3, x + 30 + int(18 * scale), y + 7], fill=SCR_INK)

def app_header(d, s, scale=1.0):
    pik = R.logo_pictogram(int(30 * scale))
    s.alpha_composite(pik, (int(22 * scale), int(48 * scale)))
    f = R.POPP_SB(int(24 * scale))
    d.text((int(62 * scale), int(50 * scale)), "SmartDownload", font=f, fill=SCR_INK)

def url_field(d, s, text, scale=1.0, focused=True, placeholder="Colle ton lien ici…"):
    fx, fy = int(26 * scale), int(150 * scale)
    fw, fh = SCR_W - int(52 * scale), int(62 * scale)
    R.rounded(d, [fx, fy, fx + fw, fy + fh], int(14 * scale),
              fill=SCR_CARD + (255,), outline=R.GOLD + (255,) if focused else SCR_LINE + (255,),
              width=2 if focused else 1)
    if text:
        ft = R.POPP_R(int(17 * scale))
        # texte adapte : on tronque a gauche si trop long (effet scroll)
        shown = text
        while R.text_layer(shown, ft, SCR_INK).width > fw - int(28 * scale) and len(shown) > 4:
            shown = shown[1:]
        tl = R.text_layer(shown, ft, SCR_INK)
        s.alpha_composite(tl, (fx + int(14 * scale), fy + (fh - tl.height) // 2))
    else:
        ft = R.POPP_R(int(17 * scale))
        tl = R.text_layer(placeholder, ft, SCR_MUTED)
        s.alpha_composite(tl, (fx + int(14 * scale), fy + (fh - tl.height) // 2))
    return fx, fy, fw, fh

def gold_button(s, d, label, cx, cy, scale=1.0, alpha=1.0, font_size=20):
    f = R.POPP_SB(int(font_size * scale))
    tl = R.text_layer(label, f, R.BLACK_CARD)
    bw, bh = tl.width + int(56 * scale), int(52 * scale)
    btn = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    bd = ImageDraw.Draw(btn)
    R.rounded(bd, [0, 0, bw - 1, bh - 1], int(14 * scale), fill=R.GOLD + (int(255 * alpha),))
    btn.alpha_composite(R.alpha_img(tl, alpha), ((bw - tl.width) // 2, (bh - tl.height) // 2))
    s.alpha_composite(R.alpha_img(btn, alpha), (int(cx - bw / 2), int(cy - bh / 2)))
    return cx, cy, bw, bh

def play_badge(size, alpha=1.0):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([0, 0, size - 1, size - 1], fill=R.GOLD + (int(255 * alpha),))
    tri = [(size * 0.40, size * 0.32), (size * 0.40, size * 0.68), (size * 0.66, size * 0.50)]
    d.polygon(tri, fill=R.BLACK_CARD + (int(255 * alpha),))
    return img

# ------------------------------- scenes --------------------------------

def sc1(p, t):
    """Intro : marque, 'installée sur ton téléphone'."""
    img = page(t)
    pik = R.logo_pictogram(int(150 * pop(clamp01(p * 2.4))))
    R.draw_center(img, pik, W / 2, 400, pop(clamp01(p * 2.4)))
    title = R.text_layer("SmartDownload", R.POPP_B(64), R.INK)
    R.draw_center(img, title, W / 2, 520, pop(clamp01(p * 2.4 - 0.3)))
    up = clamp01(p * 2.4 - 0.55)
    if up > 0:
        line = Image.new("RGBA", (title.width - 30, 5), R.GOLD + (255,))
        img.alpha_composite(line.crop((0, 0, max(2, int(line.width * up)), 5)), (int(W / 2 - (title.width - 30) / 2), 570))
    sub = R.text_layer("Installée sur ton téléphone", R.POPP_R(28), R.MUTED)
    R.draw_center(img, sub, W / 2, 630, clamp01(p * 2.4 - 0.8))
    chips = [small_chip(b, selected=(i == 0)) for i, b in enumerate(["Gratuit", "Sans inscription", "Sans logiciel"])]
    ba = clamp01(p * 2.4 - 1.1)
    tw = sum(c.width for c in chips) + 14 * (len(chips) - 1)
    x = W / 2 - tw / 2
    for c in chips:
        img.alpha_composite(R.alpha_img(c, ba), (int(x), 700))
        x += c.width + 14
    hint = R.text_layer("Démo complète — 1 minute", R.POPP_R(20), R.MUTED)
    R.draw_center(img, hint, W / 2, 810, clamp01(p * 2.4 - 1.4))
    return img

def sc2(p, t):
    """Ecran d'accueil Android : icone SmartDownload + tap."""
    def content(d, s, scale):
        status_bar(d, s, scale)
        # fond ecran : halo or discret
        halo = R.alpha_img(R.BLOB2, 0.10)
        s.alpha_composite(R.alpha_img(halo, 0.5), (SCR_W // 2 - 150, 220))
        # rangee d'icones generiques
        gx, gy = int(40 * scale), int(140 * scale)
        for i in range(4):
            for j in range(2):
                ix, iy = gx + i * int(110 * scale), gy + j * int(120 * scale)
                if i == 1 and j == 1:
                    continue
                d.rounded_rectangle([ix, iy, ix + int(64 * scale), iy + int(64 * scale)],
                                    int(16 * scale), fill=(36, 33, 30, 255))
        # icone SmartDownload mise en avant
        ip = pop(clamp01(p * 3.0))
        ix, iy = gx + int(110 * scale), gy + int(120 * scale)
        icon = R.logo_pictogram(int(72 * scale), circle_alpha=int(255 * ip))
        s.alpha_composite(R.alpha_img(icon, ip), (ix, iy - int((1 - ip) * 14)))
        lab = R.text_layer("SmartDownload", R.POPP_R(int(13 * scale)), SCR_INK)
        s.alpha_composite(R.alpha_img(lab, ip), (ix + int(36 * scale) - lab.width // 2, iy + int(78 * scale)))
        # tap + onde
        rp = clamp01((p * 3.0 - 0.75) / 0.45)
        ripple(s, ix + int(36 * scale), iy + int(36 * scale), int(90 * scale), rp)
        # ouverture : l'application grandit vers le centre
        op = clamp01((p * 3.0 - 1.05) / 0.5)
        if op > 0:
            opa = R.logo_pictogram(int(120 * scale * pop(op)))
            R.draw_center(s, opa, SCR_W / 2, SCR_H * 0.52, op * 0.9)
    return phone(content, t)

def sc3(p, t):
    """App ouverte : accueil, champ vide + toast 'Lien copié'."""
    def content(d, s, scale):
        status_bar(d, s, scale)
        app_header(d, s, scale)
        hero = R.text_layer("Télécharge une vidéo", R.POPP_B(int(27 * scale)), SCR_INK)
        R.draw_center(s, hero, SCR_W / 2, int(100 * scale), pop(clamp01(p * 2.6)))
        hero2 = R.text_layer("depuis un simple lien", R.POPP_B(int(27 * scale)), R.GOLD)
        R.draw_center(s, hero2, SCR_W / 2, int(100 * scale) + hero.height + 4, pop(clamp01(p * 2.6 - 0.2)))
        url_field(d, s, "", scale)
        gold_button(s, d, "Analyser", SCR_W / 2, int(150 * scale) + int(52 * scale) + int(64 * scale),
                    scale, alpha=0.45)
        # toast "Lien copié"
        tp = pop(clamp01((p * 2.6 - 0.55) / 0.35))
        if tp > 0:
            tl = R.text_layer("Lien copié ✓", R.POPP_SB(int(18 * scale)), R.BLACK_CARD)
            tw = tl.width + int(44 * scale)
            toast = Image.new("RGBA", (tw, int(46 * scale)), (0, 0, 0, 0))
            R.rounded(ImageDraw.Draw(toast), [0, 0, tw - 1, int(46 * scale) - 1], int(23 * scale), fill=R.GOLD + (255,))
            toast.alpha_composite(tl, (int(22 * scale), (int(46 * scale) - tl.height) // 2))
            ty = int(240 * scale) - int((1 - tp) * 16 * scale)
            s.alpha_composite(R.alpha_img(toast, tp), ((SCR_W - tw) // 2, ty))
        hint = R.text_layer("Aucune inscription, aucun logiciel", R.POPP_R(int(15 * scale)), SCR_MUTED)
        R.draw_center(s, hint, SCR_W / 2, int(300 * scale), clamp01(p * 2.6 - 0.9))
    return phone(content, t)

def sc4(p, t):
    """Collage du lien FB + appui sur Analyser."""
    def content(d, s, scale):
        status_bar(d, s, scale)
        app_header(d, s, scale)
        hero = R.text_layer("Télécharge une vidéo", R.POPP_B(int(27 * scale)), SCR_INK)
        R.draw_center(s, hero, SCR_W / 2, int(100 * scale))
        hero2 = R.text_layer("depuis un simple lien", R.POPP_B(int(27 * scale)), R.GOLD)
        R.draw_center(s, hero2, SCR_W / 2, int(100 * scale) + hero.height + 4)
        # frappe du lien
        typed = FB_URL[: int(len(FB_URL) * clamp01(p * 2.8 / 0.55))]
        fx, fy, fw, fh = url_field(d, s, typed, scale)
        if typed and len(typed) < len(FB_URL):
            ft = R.POPP_R(int(17 * scale))
            tl = R.text_layer(typed, ft, SCR_INK)
            blink = 0.5 + 0.5 * math.sin(t * 7)
            d.rectangle([fx + tl.width + int(16 * scale), fy + int(18 * scale),
                         fx + tl.width + int(19 * scale), fy + fh - int(18 * scale)],
                        fill=R.GOLD + (int(220 * blink),))
        # bouton Analyser s'active puis tap
        act = clamp01((p * 2.8 - 0.6) / 0.2)
        bx, by, bw, bh = gold_button(s, d, "Analyser", SCR_W / 2, fy + fh + int(52 * scale),
                                     scale, alpha=0.45 + 0.55 * act)
        rp = clamp01((p * 2.8 - 0.8) / 0.4)
        ripple(s, bx + bw / 2, by + bh / 2, int(110 * scale), rp)
        # chargement : trois points
        ld = clamp01((p * 2.8 - 1.25) / 0.15)
        if ld > 0:
            for i in range(3):
                a = 0.35 + 0.65 * abs(math.sin(t * 4 - i * 0.7))
                r = int(7 * scale)
                d.ellipse([SCR_W / 2 - int(34 * scale) + i * int(30 * scale) - r, int(330 * scale) - r,
                           SCR_W / 2 - int(34 * scale) + i * int(30 * scale) + r, int(330 * scale) + r],
                          fill=R.GOLD + (int(255 * a * ld),))
            wait = R.text_layer("Analyse du lien…", R.POPP_R(int(16 * scale)), SCR_MUTED)
            R.draw_center(s, wait, SCR_W / 2, int(368 * scale), ld)
    return phone(content, t)

def sc5(p, t):
    """Apercu : miniature placeholder + titre + chips formats."""
    def content(d, s, scale):
        status_bar(d, s, scale)
        app_header(d, s, scale)
        # carte apercu
        cp = pop(clamp01(p * 2.2))
        cx, cy = int(26 * scale), int(120 * scale)
        cw, ch = SCR_W - int(52 * scale), int(300 * scale)
        card = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        cd = ImageDraw.Draw(card)
        R.rounded(cd, [0, 0, cw - 1, ch - 1], int(18 * scale), fill=SCR_CARD + (255,),
                  outline=SCR_LINE + (255,), width=1)
        # miniature placeholder sombre + cercle lecture or
        th_h = int(196 * scale)
        R.rounded(cd, [int(12 * scale), int(12 * scale), cw - int(12 * scale), th_h],
                  int(12 * scale), fill=(18, 16, 14, 255))
        pb = play_badge(int(62 * scale), alpha=cp)
        card.alpha_composite(pb, ((cw - pb.width) // 2, int(12 * scale) + (th_h - pb.height) // 2))
        dur = R.text_layer("0:34", R.POPP_SB(int(14 * scale)), R.BLACK_CARD)
        pillw = dur.width + int(20 * scale)
        R.rounded(cd, [cw - int(12 * scale) - pillw - int(10 * scale), th_h - int(34 * scale),
                       cw - int(22 * scale) - int(10 * scale), th_h - int(10 * scale)],
                  int(8 * scale), fill=R.GOLD + (255,))
        card.alpha_composite(dur, (cw - int(22 * scale) - pillw - int(10 * scale) + int(10 * scale),
                                   th_h - int(28 * scale)))
        # titre + meta
        ttl = R.text_layer("Vidéo partagée", R.POPP_SB(int(19 * scale)), SCR_INK)
        card.alpha_composite(ttl, (int(16 * scale), th_h + int(14 * scale)))
        meta = R.text_layer("Reconnaissance automatique ✓", R.POPP_R(int(14 * scale)), R.GOLD)
        card.alpha_composite(meta, (int(16 * scale), th_h + int(46 * scale)))
        s.alpha_composite(R.alpha_img(card, cp), (cx, cy))
        # chips formats (apparition sequentielle)
        labels = ["MP4 · 1080p", "MP4 · 720p", "MP4 · 360p", "MP3 · audio"]
        rows = [labels[:2], labels[2:]]
        yy = cy + ch + int(24 * scale)
        for r_i, row in enumerate(rows):
            xx = SCR_W / 2 - (sum(small_chip(l, font_size=17).width for l in row) + int(14 * scale)) / 2
            for c_i, lab in enumerate(row):
                cp2 = pop(clamp01((p * 2.2 - 0.45 - (r_i * 2 + c_i) * 0.12) / 0.45))
                c = small_chip(lab, font_size=17)
                s.alpha_composite(R.alpha_img(c, cp2), (int(xx), int(yy + (1 - cp2) * 12)))
                xx += c.width + int(14 * scale)
            yy += int(60 * scale)
        hint = R.text_layer("Tous les formats détectés", R.POPP_R(int(15 * scale)), SCR_MUTED)
        R.draw_center(s, hint, SCR_W / 2, yy + int(8 * scale), clamp01(p * 2.2 - 1.15))
    return phone(content, t)

def sc6(p, t):
    """Choix du format + bouton Télécharger."""
    def content(d, s, scale):
        status_bar(d, s, scale)
        app_header(d, s, scale)
        cy = int(120 * scale)
        cw = SCR_W - int(52 * scale)
        ch = int(300 * scale)
        R.rounded(d, [int(26 * scale), cy, int(26 * scale) + cw, cy + ch], int(18 * scale),
                  fill=SCR_CARD + (255,), outline=SCR_LINE + (255,), width=1)
        th_h = int(196 * scale)
        R.rounded(d, [int(38 * scale), cy + int(12 * scale), int(26 * scale) + cw - int(12 * scale),
                      cy + int(12 * scale) + th_h], int(12 * scale), fill=(18, 16, 14, 255))
        pb = play_badge(int(62 * scale))
        s.alpha_composite(pb, (SCR_W // 2 - pb.width // 2, cy + int(12 * scale) + (th_h - pb.height) // 2))
        ttl = R.text_layer("Vidéo partagée", R.POPP_SB(int(19 * scale)), SCR_INK)
        s.alpha_composite(ttl, (int(42 * scale), cy + th_h + int(14 * scale)))
        # selection du format
        labels = ["MP4 · 1080p", "MP4 · 720p", "MP4 · 360p", "MP3 · audio"]
        row = labels
        gap = int(14 * scale)
        total_w = sum(small_chip(l, font_size=17).width for l in row) + gap * 3
        xx = SCR_W / 2 - total_w / 2
        yy = cy + ch + int(26 * scale)
        for i, lab in enumerate(row):
            sel = (i == 1)
            sp = clamp01((p * 2.6 - 0.35) / 0.25) if sel else 1.0
            c = small_chip(lab, selected=sel, font_size=17)
            s.alpha_composite(c, (int(xx), int(yy)))
            xx += c.width + gap
        bp = pop(clamp01((p * 2.6 - 0.55) / 0.3))
        bx, by, bw, bh = gold_button(s, d, "Télécharger", SCR_W / 2, yy + int(70 * scale), scale,
                                     alpha=bp, font_size=21)
        rp = clamp01((p * 2.6 - 0.85) / 0.4)
        ripple(s, bx + bw / 2, by + bh / 2, int(120 * scale), rp)
        hint = R.text_layer("MP4 ou MP3, tu choisis", R.POPP_R(int(15 * scale)), SCR_MUTED)
        R.draw_center(s, hint, SCR_W / 2, yy + int(122 * scale), clamp01(p * 2.6 - 1.0))
    return phone(content, t)

def sc7(p, t):
    """Pub simulée + compte a rebours 5 -> 1."""
    def content(d, s, scale):
        status_bar(d, s, scale)
        app_header(d, s, scale)
        # ecran assombri
        ov = Image.new("RGBA", (SCR_W, SCR_H), (0, 0, 0, int(150 * clamp01(p * 3))))
        s.alpha_composite(ov)
        mp = pop(clamp01(p * 3 - 0.1))
        # carte pub simulee (300x250 ratios, sans reseau reel)
        aw, ah = int(300 * scale), int(250 * scale)
        ax, ay = (SCR_W - aw) // 2, (SCR_H - ah) // 2 - int(40 * scale)
        ad = Image.new("RGBA", (aw + 8, ah + 8), (0, 0, 0, 0))
        ad_d = ImageDraw.Draw(ad)
        R.rounded(ad_d, [0, 0, aw + 7, ah + 7], int(16 * scale), fill=R.IVORY + (255,))
        # contenu placeholder d'annonce (formes neutres)
        ad_d.ellipse([int(36 * scale), int(40 * scale), int(76 * scale), int(80 * scale)], fill=R.GOLD + (255,))
        ad_d.rounded_rectangle([int(96 * scale), int(46 * scale), aw - int(36 * scale), int(58 * scale)],
                               6, fill=(214, 208, 196, 255))
        ad_d.rounded_rectangle([int(96 * scale), int(66 * scale), aw - int(70 * scale), int(76 * scale)],
                               5, fill=(226, 220, 206, 255))
        ad_d.rounded_rectangle([int(36 * scale), int(100 * scale), aw - int(36 * scale), ah - int(70 * scale)],
                               int(10 * scale), fill=(240, 236, 226, 255))
        ad_d.ellipse([int(52 * scale), int(116 * scale), int(92 * scale), int(156 * scale)], fill=R.GOLD + (255,))
        btn = R.text_layer("En savoir plus", R.POPP_SB(int(15 * scale)), R.BLACK_CARD)
        R.rounded(ad_d, [int(36 * scale), ah - int(58 * scale), int(36 * scale) + btn.width + int(36 * scale),
                         ah - int(18 * scale)], int(12 * scale), fill=R.GOLD + (255,))
        ad.alpha_composite(btn, (int(54 * scale), ah - int(51 * scale)))
        lab = R.text_layer("Annonce", R.POPP_R(int(12 * scale)), (150, 142, 126))
        ad.alpha_composite(lab, (aw + 8 - lab.width - int(10 * scale), int(8 * scale)))
        s.alpha_composite(R.alpha_img(ad, mp), (ax - 4, ay - 4))
        # compte a rebours 5 -> 1, etale sur presque toute la scene
        cdone = clamp01((p * 3 - 0.3) / 2.1)
        secs_left = max(1, int(round(5 - cdone * 4.4)))
        rp = 1 - ((p * 3 - 0.3) / 2.1 * 4.4) % 1.0
        cr = int(30 * scale)
        ccx, ccy = ax + aw - cr - int(6 * scale), ay - int(6 * scale)
        d.ellipse([ccx - cr, ccy - cr, ccx + cr, ccy + cr], fill=SCR_CARD + (255,), outline=R.GOLD + (255,), width=3)
        # arc de progression
        ang = 360 * clamp01((5 - secs_left - (1 - rp)) / 5.0)
        d.arc([ccx - cr + 3, ccy - cr + 3, ccx + cr - 3, ccy + cr - 3], -90, -90 + ang, fill=R.GOLD, width=4)
        f = R.POPP_SB(int(22 * scale))
        tl = R.text_layer(str(secs_left), f, SCR_INK)
        s.alpha_composite(tl, (ccx - tl.width // 2, ccy - tl.height // 2))
        # message
        msg = R.text_layer("Pub vue = téléchargement prioritaire", R.POPP_SB(int(17 * scale)), R.GOLD)
        R.draw_center(s, msg, SCR_W / 2, ay + ah + int(44 * scale), clamp01(p * 3 - 0.5))
        sub = R.text_layer("C'est ce qui garde l'app gratuite", R.POPP_R(int(15 * scale)), SCR_MUTED)
        R.draw_center(s, sub, SCR_W / 2, ay + ah + int(78 * scale), clamp01(p * 3 - 0.75))
        # fin de pub
        if cdone >= 0.999:
            fp = pop(clamp01((p * 3 - 2.3) / 0.3))
            okl = R.text_layer("✓ Pub terminée — priorité activée", R.POPP_SB(int(15 * scale)), R.BLACK_CARD)
            fw3 = okl.width + int(40 * scale)
            okc = Image.new("RGBA", (fw3, int(42 * scale)), (0, 0, 0, 0))
            R.rounded(ImageDraw.Draw(okc), [0, 0, fw3 - 1, int(42 * scale) - 1], int(21 * scale), fill=R.GOLD + (255,))
            okc.alpha_composite(okl, (int(20 * scale), (int(42 * scale) - okl.height) // 2))
            s.alpha_composite(R.alpha_img(okc, fp), ((SCR_W - fw3) // 2, ay + ah + int(104 * scale)))
    return phone(content, t)

def sc8(p, t):
    """Progression 0 -> 100 % puis fichier enregistré."""
    def content(d, s, scale):
        status_bar(d, s, scale)
        app_header(d, s, scale)
        prog = ease_out(clamp01(p * 2.6 / 0.62))
        # carte fichier
        cy = int(160 * scale)
        cw = SCR_W - int(52 * scale)
        ch = int(240 * scale)
        R.rounded(d, [int(26 * scale), cy, int(26 * scale) + cw, cy + ch], int(18 * scale),
                  fill=SCR_CARD + (255,), outline=SCR_LINE + (255,), width=1)
        # icone fichier + nom
        fz = int(56 * scale)
        fx, fy = int(48 * scale), cy + int(28 * scale)
        R.rounded(d, [fx, fy, fx + fz, fy + int(70 * scale)], int(10 * scale), fill=(18, 16, 14, 255))
        d.polygon([(fx + fz - int(16 * scale), fy), (fx + fz, fy + int(16 * scale)),
                   (fx + fz - int(16 * scale), fy + int(16 * scale))], fill=R.GOLD + (255,))
        d.text((fx + int(12 * scale), fy + int(28 * scale)), "MP4", font=R.POPP_SB(int(14 * scale)), fill=R.GOLD)
        name = R.text_layer("video-partagee.mp4", R.POPP_SB(int(17 * scale)), SCR_INK)
        s.alpha_composite(name, (fx + fz + int(18 * scale), fy + int(8 * scale)))
        meta = R.text_layer("MP4 · 720p · 14,2 Mo", R.POPP_R(int(14 * scale)), SCR_MUTED)
        s.alpha_composite(meta, (fx + fz + int(18 * scale), fy + int(42 * scale)))
        # barre de progression
        bw = cw - int(44 * scale)
        bx, by = int(48 * scale), cy + int(130 * scale)
        R.rounded(d, [bx, by, bx + bw, by + int(16 * scale)], int(8 * scale), fill=(30, 27, 23, 255))
        val = int(bw * prog)
        if val > int(16 * scale):
            R.rounded(d, [bx, by, bx + val, by + int(16 * scale)], int(8 * scale), fill=R.GOLD + (255,))
        pct = R.text_layer(f"{int(prog * 100)} %", R.POPP_SB(int(16 * scale)), R.GOLD)
        s.alpha_composite(pct, (bx + bw - pct.width, by + int(28 * scale)))
        done = prog >= 0.999
        st = R.text_layer("Téléchargement en cours…" if not done else "Fichier enregistré ✓",
                          R.POPP_R(int(15 * scale)), SCR_MUTED if not done else R.GOLD)
        R.draw_center(s, st, SCR_W / 2, by + int(66 * scale))
        # carte finale enregistre
        if done:
            fp = pop(clamp01((p * 2.6 - 0.68) / 0.3))
            fy2 = cy + ch + int(28 * scale)
            fw2 = SCR_W - int(120 * scale)
            fh2 = int(64 * scale)
            card2 = Image.new("RGBA", (fw2, fh2), (0, 0, 0, 0))
            c2d = ImageDraw.Draw(card2)
            R.rounded(c2d, [0, 0, fw2 - 1, fh2 - 1], int(14 * scale), fill=SCR_CARD + (255,),
                      outline=R.GOLD + (255,), width=2)
            chk = R.logo_pictogram(int(34 * scale))
            card2.alpha_composite(chk, (int(14 * scale), (fh2 - int(34 * scale)) // 2))
            tl2 = R.text_layer("Prêt à partager", R.POPP_SB(int(17 * scale)), R.GOLD)
            card2.alpha_composite(tl2, (int(62 * scale), (fh2 - tl2.height) // 2))
            s.alpha_composite(R.alpha_img(card2, fp), (int(60 * scale), int(fy2 + (1 - fp) * 14)))
    return phone(content, t)

def sc9(p, t):
    """Final : carte noire, logo, URL du site, signature Eddition Smartebooks."""
    img = page(t)
    card_w, card_h = int(W * 0.88), int(H * 0.82)
    grow = ease_out(clamp01(p * 6))
    ch = int(card_h * (0.25 + 0.75 * grow))
    cx0, cy0 = (W - card_w) // 2, (H - ch) // 2
    card = Image.new("RGBA", (card_w, card_h), (0, 0, 0, 0))
    R.rounded(ImageDraw.Draw(card), [0, 0, card_w - 1, card_h - 1], 36, fill=R.BLACK_CARD + (int(255 * grow),))
    # logo + titre (la voix dit "Smart Download" des le debut de la scene)
    la = clamp01(p * 6)
    pik = R.logo_pictogram(120, circle_alpha=int(255 * la))
    R.draw_center(card, pik, card_w / 2, 210, la)
    title = R.text_layer("SmartDownload", R.POPP_B(52), R.IVORY)
    R.draw_center(card, title, card_w / 2, 330, clamp01(p * 6 - 0.25))
    # pill URL (appears quand la voix dit "le lien est dans la description")
    ua = clamp01((p - 0.45) / 0.18)
    if ua > 0:
        uto = R.text_layer(SITE, R.POPP_SB(24), R.BLACK_CARD)
        pw, ph = uto.width + 56, 54
        pill = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
        R.rounded(ImageDraw.Draw(pill), [0, 0, pw - 1, ph - 1], 27, fill=R.GOLD + (int(255 * ua),))
        pill.alpha_composite(R.alpha_img(uto, ua), (28, (ph - uto.height) // 2))
        vis = R.text_layer("Visite :", R.POPP_R(20), (214, 208, 196))
        card.alpha_composite(R.alpha_img(vis, ua),
                             (int(card_w / 2 - pill.width / 2 - vis.width - 12), 428))
        card.alpha_composite(R.alpha_img(pill, ua),
                             (int(card_w / 2 - pill.width / 2 + (1 - ua) * 24), 424))
    # signature (appears quand la voix dit "Eddition Smartebooks")
    sig = R.text_layer("EDDITION SMARTEBOOKS", R.POPP_SB(24), R.GOLD, tracking=6)
    R.draw_center(card, sig, card_w / 2, 540, clamp01((p - 0.18) / 0.15))
    tag = R.text_layer("Télécharge ce que tu aimes — gratuitement", R.POPP_R(19), (214, 208, 196))
    R.draw_center(card, tag, card_w / 2, 590, clamp01((p - 0.42) / 0.15))
    foot = R.text_layer("Le lien est dans la description", R.POPP_R(17), (168, 160, 146))
    R.draw_center(card, foot, card_w / 2, 640, clamp01((p - 0.60) / 0.15))
    img.alpha_composite(card, (cx0, cy0))
    return img

SCENE_FNS = {"k1": sc1, "k2": sc2, "k3": sc3, "k4": sc4, "k5": sc5,
             "k6": sc6, "k7": sc7, "k8": sc8, "k9": sc9}

# ------------------------------- boucle -------------------------------

def main(out_path):
    n_frames = int(TOTAL * FPS)
    import imageio.v2 as imageio
    wtr = imageio.get_writer(out_path, fps=FPS, codec="libx264", quality=8, pixelformat="yuv420p")
    fade = 0.35
    for i in range(n_frames):
        t = i / FPS
        elapsed = 0.0
        frame = None
        for idx, (k, dur, vs) in enumerate(SCENES):
            if t < elapsed + dur or idx == len(SCENES) - 1:
                local = clamp01((t - elapsed) / dur)
                fn = SCENE_FNS[k]
                frame = fn(local, t)
                if idx < len(SCENES) - 1 and local > 1 - fade / dur:
                    nxt = SCENE_FNS[SCENES[idx + 1][0]](0.02, t)
                    frame = R.crossfade(frame, nxt, (local - (1 - fade / dur)) / (fade / dur))
                break
            elapsed += dur
        wtr.append_data(np.asarray(frame.convert("RGB")))
        if i % 120 == 0:
            print(f"  frame {i}/{n_frames} ({t:.1f}s)")
    wtr.close()
    print("OK ->", out_path, f"({n_frames} frames, {TOTAL:.1f}s)")

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/tmp/promo/promo-v6-video.mp4")
