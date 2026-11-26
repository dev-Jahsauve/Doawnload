#!/usr/bin/env python3
"""Mix v6 : nappe SANS basses (accords >= 260 Hz, registre medium) + arpeggio doux,
voix 9 repliques avec ducking lisse, puis mux avec la video."""
import json, subprocess, sys, wave
import numpy as np
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
SR = 44100
D = "/tmp/promo"

sp = json.load(open(f"{D}/scene-plan-v6.json"))
TOTAL = sp["total"] + 0.4
vp = json.load(open(f"{D}/voice-plan-v6.json"))

def read_wav(path):
    with wave.open(path, "rb") as w:
        assert w.getframerate() == SR and w.getnchannels() == 1
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
    return data.astype(np.float64) / 32768.0

n = int(TOTAL * SR)
t = np.arange(n) / SR

# --- nappe medium (aucune note sous ~260 Hz) : C - Am - F - G (registre aigu-median)
chords = [
    [261.63, 329.63, 392.00],  # C4 E4 G4
    [261.63, 329.63, 440.00],  # C4 E4 A4 (Am7 pastel)
    [349.23, 440.00, 523.25],  # F4 A4 C5
    [293.66, 392.00, 493.88],  # D4 G4 B4 (G)
]
seg = TOTAL / len(chords)
bed = np.zeros_like(t)
for i, notes in enumerate(chords):
    m = (t >= i * seg) & (t < (i + 1) * seg + 1.0)
    env = np.clip((t[m] - i * seg) / 0.8, 0, 1) * np.clip(((i + 1) * seg + 1.0 - t[m]) / 1.0, 0, 1)
    for f in notes:
        bed[m] += env * (
            0.26 * np.sin(2 * np.pi * f * t[m])
            + 0.11 * np.sin(2 * np.pi * f * 2 * t[m] + 0.3)
            + 0.05 * np.sin(2 * np.pi * f * 1.004 * t[m])
        )
bed *= 0.17  # volume nappe discret : la voix et le montage restent au premier plan

# --- arpeggio pluck doux (notes >= 392 Hz, tres court, tres discret)
pluck = np.zeros_like(t)
step = 0.75  # une note toutes les 0,75 s
notes_cycle = [392.00, 523.25, 659.26, 523.25, 440.00, 587.33, 493.88, 587.33]
k = 0
tt = 0.6
while tt < TOTAL - 2.0:
    f = notes_cycle[k % len(notes_cycle)]
    m0 = int(tt * SR)
    dur_p = 0.35
    m1 = min(n, m0 + int(dur_p * SR))
    tp = t[m0:m1] - tt
    env_p = np.exp(-tp * 9.0)
    pluck[m0:m1] += 0.06 * env_p * np.sin(2 * np.pi * f * tp)
    k += 1
    tt += step
# l'arpeggio suit le meme ducking que la nappe (il s'efface sous la voix)

# --- voix + courbe de ducking
voice = np.zeros(n)
duck = np.ones(n)
for sc in sp["scenes"]:
    start, key = sc["voice_start"], sc["key"]
    v = read_wav(vp[key]["wav"]) * 0.94
    i0 = int(start * SR)
    i1 = min(i0 + len(v), n)
    voice[i0:i1] += v[: i1 - i0]
    a, b = max(0, int((start - 0.18) * SR)), min(n, int((start + vp[key]["dur"] + 0.30) * SR))
    duck[a:b] = 0.0

kk = int(0.12 * SR)
kernel = np.ones(kk) / kk
smooth = np.convolve(np.pad(duck, (kk // 2, kk // 2), mode="edge"), kernel, mode="same")[kk // 2: kk // 2 + n]
duck_curve = 0.12 + 0.88 * smooth  # sous la voix, la musique tombe a 12 %

mix = bed * duck_curve + pluck * duck_curve + voice

fi, fo = int(1.2 * SR), int(2.2 * SR)
mix[:fi] *= np.linspace(0, 1, fi)
mix[-fo:] *= np.linspace(1, 0, fo)
peak = np.abs(mix).max()
if peak > 0.95:
    mix *= 0.95 / peak

with wave.open(f"{D}/promo-audio-v6.wav", "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(mix, -1, 1) * 32767).astype(np.int16).tobytes())
print("mix OK", round(len(mix) / SR, 2), "s — nappe medium sans basses, ducking 0,12 s")

r = subprocess.run([FF, "-y", "-i", f"{D}/promo-v6-video.mp4", "-i", f"{D}/promo-audio-v6.wav",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest",
                    f"{D}/promo-android-v6.mp4"], capture_output=True, text=True)
if r.returncode != 0:
    print(r.stderr[-1500:]); sys.exit(1)
print("mux OK -> promo-android-v6.mp4")
