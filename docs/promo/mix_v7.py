#!/usr/bin/env python3
"""Mix v7 : nappe SANS basses (accords >= 260 Hz, registre medium) + arpeggio doux,
voix 9 repliques avec ducking lisse, puis mux avec la video."""
import json, subprocess, wave
import numpy as np
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
SR = 44100
D = "/tmp/promo"

sp = json.load(open(f"{D}/scene-plan-v7.json"))
TOTAL = sp["total"] + 0.4
vp = json.load(open(f"{D}/voice-plan-v7.json"))

def read_wav(path):
    with wave.open(path, "rb") as w:
        assert w.getframerate() == SR and w.getnchannels() == 1
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
    return data.astype(np.float64) / 32768.0

n = int(TOTAL * SR)
t = np.arange(n) / SR

# --- nappe medium (aucune note sous ~260 Hz) : C - Am - F - G (registre aigu-median)
chords = [
    [261.63, 329.63, 392.00],
    [261.63, 329.63, 440.00],
    [349.23, 440.00, 523.25],
    [293.66, 392.00, 493.88],
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
bed *= 0.17

# --- arpeggio pluck doux (notes >= 392 Hz, tres court, tres discret)
pluck = np.zeros_like(t)
step = 0.75
notes_cycle = [392.00, 523.25, 659.26, 523.25, 440.00, 587.33, 493.88, 587.33]
k = 0
tt = 0.6
while tt < TOTAL - 2.0:
    f = notes_cycle[k % len(notes_cycle)]
    m0 = int(tt * SR)
    m1 = min(n, m0 + int(0.35 * SR))
    tp = t[m0:m1] - tt
    pluck[m0:m1] += 0.06 * np.exp(-tp * 9.0) * np.sin(2 * np.pi * f * tp)
    k += 1
    tt += step

# --- voix + courbe de ducking
voice = np.zeros(n)
duck = np.ones(n)
for sc in sp["scenes"]:
    start, key = sc["voice_start"], sc["key"]
    v = read_wav(vp[key]["wav"]) * 0.94
    i0 = int(start * SR)
    i1 = min(i0 + len(v), n)
    voice[i0:i1] += v[: i1 - i0]
    a = max(i0 - int(0.25 * SR), 0)
    b = min(i1 + int(0.35 * SR), n)
    duck[a:b] = np.minimum(duck[a:b], 0.42)

# ducking lisse (poursuite ~ 250 ms)
kernel = np.hanning(int(0.25 * SR))
kernel /= kernel.sum()
duck = np.convolve(duck, kernel, mode="same")

music = (bed + pluck) * duck
mix = voice + music
peak = np.max(np.abs(mix)) or 1.0
if peak > 0.95:
    mix *= 0.95 / peak

pcm = (mix * 32767).astype(np.int16)
with wave.open(f"{D}/promo-v7-audio.wav", "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())

subprocess.run(
    [FF, "-y", "-i", f"{D}/promo-v7-video.mp4", "-i", f"{D}/promo-v7-audio.wav",
     "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest",
     f"{D}/promo-android-v7.mp4"],
    capture_output=True, check=True,
)
print("final :", f"{D}/promo-android-v7.mp4")
