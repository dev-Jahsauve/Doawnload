#!/usr/bin/env python3
"""Voix v6 — 9 repliques : utilisation de SmartDownload APRES installation sur Android.
Sync audio->video : les durees mesurees pilotent le plan de montage."""
import asyncio, json, subprocess
import edge_tts, imageio_ffmpeg

VOICE = "fr-FR-VivienneMultilingualNeural"
FF = imageio_ffmpeg.get_ffmpeg_exe()
D = "/tmp/promo"

LINES = {
    "k1": "Smart Download est maintenant installée sur ton téléphone ! Je te montre, en une minute, comment l'utiliser pour enregistrer tes vidéos.",
    "k2": "On lance l'application. Pas de barre de navigateur : tout est là, comme une vraie application.",
    "k3": "Pour récupérer une vidéo, copie simplement son lien. Ici, une vidéo partagée sur Facebook.",
    "k4": "On colle le lien dans le champ, puis on appuie sur Analyser.",
    "k5": "Et voilà : Smart Download reconnaît la vidéo. Titre, durée, et tous les formats : MP4 jusqu'en 1080 p, ou MP3 si tu veux juste le son.",
    "k6": "Tu choisis ton format, puis tu lances le téléchargement.",
    "k7": "Une petite pub de quelques secondes, et ton téléchargement passe en priorité. C'est ce qui rend le service entièrement gratuit.",
    "k8": "Quelques secondes plus tard... ton fichier est enregistré, prêt à être partagé.",
    "k9": "Smart Download, une réalisation Eddition Smartebooks. Gratuit, sans inscription, sans logiciel. Le lien est dans la description. À toi de jouer !",
}

RATES = {"k1": "-3%", "k2": "-3%", "k3": "-4%", "k4": "-3%", "k5": "-4%",
         "k6": "-3%", "k7": "-4%", "k8": "-3%", "k9": "-4%"}

async def gen(k, t, rate):
    for attempt in range(5):
        try:
            c = edge_tts.Communicate(t, VOICE, rate=rate)
            await c.save(f"{D}/{k}-v6.mp3")
            import os
            if os.path.getsize(f"{D}/{k}-v6.mp3") > 1000:
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
    wav = f"{D}/{k}-v6.wav"
    subprocess.run([FF, "-y", "-i", f"{D}/{k}-v6.mp3", "-ar", "44100", "-ac", "1", wav],
                   capture_output=True, check=True)
    r = subprocess.run([FF, "-i", wav], capture_output=True, text=True)
    dur = 0.0
    for ln in r.stderr.splitlines():
        if "Duration" in ln:
            h, m, s = ln.split("Duration:")[1].split(",")[0].strip().split(":")
            dur = int(h) * 3600 + int(m) * 60 + float(s)
    out[k] = {"wav": wav, "dur": round(dur, 3)}
    print(k, round(dur, 3))

json.dump(out, open(f"{D}/voice-plan-v6.json", "w"), indent=1)
print("total voix :", round(sum(v["dur"] for v in out.values()), 2), "s")
