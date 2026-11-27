#!/usr/bin/env python3
"""Voix v7 — 9 repliques : utilisation de SmartDownload APRES installation
sur Android, avec un vrai lien YouTube. Sync audio->video : les durees
mesurees pilotent le plan de montage (scene-plan-v7.json)."""
import asyncio, json, os, subprocess
import edge_tts, imageio_ffmpeg

VOICE = "fr-FR-VivienneMultilingualNeural"
FF = imageio_ffmpeg.get_ffmpeg_exe()
D = "/tmp/promo"

LINES = {
    "k1": "SmartDownload est maintenant installee sur ton telephone ! En une minute, je te montre comment enregistrer une video YouTube, directement depuis l'appli.",
    "k2": "On lance l'application. Pas de navigateur, pas d'inscription : tout est la.",
    "k3": "Sur YouTube, copie simplement le lien de la video que tu veux garder.",
    "k4": "On revient dans SmartDownload, on colle le lien, et on appuie sur Analyser.",
    "k5": "Et voila ! L'appli reconnait la video : le titre, la miniature, et tous les formats. MP4 jusqu'en 1080 p, ou MP3 si tu veux juste le son.",
    "k6": "On choisit le 720 p, puis on lance le telechargement.",
    "k7": "Une courte publicite de quelques secondes, et ton telechargement passe en priorite. C'est ce qui rend le service entierement gratuit.",
    "k8": "Quelques secondes plus tard... le fichier est enregistre sur ton telephone, pret a etre partage !",
    "k9": "SmartDownload, une realisation Eddition Smartebooks. Gratuit, sans inscription, sans logiciel. Le lien est dans la description. A toi de jouer !",
}

RATES = {k: "-3%" for k in LINES}

async def gen(k, t, rate):
    for attempt in range(5):
        try:
            c = edge_tts.Communicate(t, VOICE, rate=rate)
            await c.save(f"{D}/{k}-v7.mp3")
            if os.path.getsize(f"{D}/{k}-v7.mp3") > 1000:
                return
        except Exception as e:
            print(f"  {k} tentative {attempt + 1} echouee: {e}")
            await asyncio.sleep(2 + attempt * 2)
    raise RuntimeError(f"{k} : impossible de generer la voix")

async def main():
    for k, t in LINES.items():
        await gen(k, t, RATES[k])
        print("  ok", k)

asyncio.run(main())

out = {}
for k in LINES:
    wav = f"{D}/{k}-v7.wav"
    subprocess.run([FF, "-y", "-i", f"{D}/{k}-v7.mp3", "-ar", "44100", "-ac", "1", wav],
                   capture_output=True, check=True)
    r = subprocess.run([FF, "-i", wav], capture_output=True, text=True)
    dur = 0.0
    for ln in r.stderr.splitlines():
        if "Duration" in ln:
            h, m, s = ln.split("Duration:")[1].split(",")[0].strip().split(":")
            dur = int(h) * 3600 + int(m) * 60 + float(s)
    out[k] = {"wav": wav, "dur": round(dur, 3)}
    print(k, round(dur, 3))

json.dump(out, open(f"{D}/voice-plan-v7.json", "w"), indent=1)
