#!/usr/bin/env python3
"""Mix v7b : musique de reference (upload utilisateur, 30 s) bouclee sur la
duree de la video, nettoyee (highpass 200 Hz : aucune basse sous la voix),
rendue vive entre les scenes et attenuee (ducking) pendant la voix off.
Entree : /mnt/vibefs/.../Forge_Rhythm...mp3 copiee en /tmp/promo/ref.mp3.
Sortie : promo-android-v7b.mp4 (video v7 inchangee + nouveau mix)."""
import json, subprocess, wave, shutil
import numpy as np
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
SR = 44100
D = "/tmp/promo"
REF_SRC = "/mnt/vibefs/uploads/da39599d-4a78-45b5-ac4f-9a01e249c2e5/D8uDskHu-Forge_Rhythm_2026-11-16T192138.mp3"

shutil.copy(REF_SRC, f"{D}/ref.mp3")

# 1) nettoyage : coupure des basses (< 200 Hz) et de l'air ultra-aigu
subprocess.run(
    [FF, "-y", "-i", f"{D}/ref.mp3", "-af", "highpass=f=200,lowpass=f=12000",
     "-ar", str(SR), "-ac", "2", f"{D}/ref_clean.wav"],
    capture_output=True, check=True,
)

sp = json.load(open(f"{D}/scene-plan-v7.json"))
TOTAL = sp["total"] + 0.4
vp = json.load(open(f"{D}/voice-plan-v7.json"))

def read_wav(path):
    with wave.open(path, "rb") as w:
        ch = w.getnchannels()
        assert w.getframerate() == SR
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
    return data.reshape(-1, ch).astype(np.float64) / 32768.0

n = int(TOTAL * SR)

# 2) boucle avec crossfade de 0,5 s aux jointures
seg = read_wav(f"{D}/ref_clean.wav")
L = len(seg)
XF = int(0.5 * SR)
bed = np.zeros((n, seg.shape[1]))
pos = 0
first = True
while pos < n:
    end = min(pos + L, n)
    chunk = seg[: end - pos]
    if not first and pos >= XF:
        # fondu enchaine avec ce qui precede
        fade_in = np.linspace(0, 1, XF)[:, None]
        bed[pos : pos + XF] = bed[pos : pos + XF] * (1 - fade_in) + chunk[:XF] * fade_in
        bed[pos + XF : end] = chunk[XF : end - pos]
    else:
        bed[pos:end] = chunk
    first = False
    pos += L - XF

# 3) fondu d'entree (0,4 s) et de sortie (2,5 s)
fade_in = np.linspace(0, 1, int(0.4 * SR))[:, None]
bed[: fade_in.shape[0]] *= fade_in
fade_out_len = int(2.5 * SR)
fade_out = np.linspace(1, 0, fade_out_len)[:, None]
bed[-fade_out_len:] *= fade_out

# 4) niveau : plus vivant que la v7 hors voix (RMS vise ~ -23 dBFS), ducking sous la voix
rms = np.sqrt(np.mean(bed**2))
target = 10 ** (-23 / 20)
if rms > 0:
    bed *= target / rms
bed = np.clip(bed, -1, 1)

# --- voix + courbe de ducking (0,45 sous la voix, lissage 250 ms)
voice = np.zeros((n, 2))
duck = np.ones(n)
for sc in sp["scenes"]:
    start, key = sc["voice_start"], sc["key"]
    v = read_wav(vp[key]["wav"]).reshape(-1)  # mono
    v_st = np.stack([v, v], axis=1) * 0.94
    i0 = int(start * SR)
    i1 = min(i0 + len(v_st), n)
    voice[i0:i1] += v_st[: i1 - i0]
    a = max(i0 - int(0.25 * SR), 0)
    b = min(i1 + int(0.35 * SR), n)
    duck[a:b] = np.minimum(duck[a:b], 0.45)

kernel = np.hanning(int(0.25 * SR))
kernel /= kernel.sum()
duck = np.convolve(duck, kernel, mode="same")
duck2 = np.stack([duck, duck], axis=1)

music = bed * duck2
mix = voice + music
peak = np.max(np.abs(mix)) or 1.0
if peak > 0.95:
    mix *= 0.95 / peak

pcm = (mix * 32767).astype(np.int16)
with wave.open(f"{D}/promo-v7b-audio.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())

subprocess.run(
    [FF, "-y", "-i", f"{D}/promo-v7-video.mp4", "-i", f"{D}/promo-v7b-audio.wav",
     "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest",
     f"{D}/promo-android-v7b.mp4"],
    capture_output=True, check=True,
)
print("final :", f"{D}/promo-android-v7b.mp4")
