#!/usr/bin/env python3
"""Synthesizes an original 22-second music bed for the notes-app ad.

Everything is generated here from sine/noise oscillators, so there is no
third-party music to license. Needs numpy.  Usage:
    python3 scripts/make-music.py public/music/idea-pulse.wav
"""
import sys
import wave
from pathlib import Path

import numpy as np

SR = 44_100
BPM = 112
BEAT = 60 / BPM
LENGTH = 22.0
DROP = 9.6  # the product walkthrough starts here in the edit

rng = np.random.default_rng(7)
t_all = np.arange(int(SR * LENGTH)) / SR
mix = np.zeros((len(t_all), 2))


def add(signal, start, pan=0.0, gain=1.0):
    i = int(start * SR)
    if i >= len(mix):
        return
    signal = signal[: len(mix) - i] * gain
    mix[i : i + len(signal), 0] += signal * (1 - max(pan, 0))
    mix[i : i + len(signal), 1] += signal * (1 + min(pan, 0))


def env(n, attack=0.005, decay=0.3):
    t = np.arange(n) / SR
    return np.minimum(t / attack, 1) * np.exp(-t / decay)


def kick():
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    freq = 50 + 90 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(freq) / SR) * env(n, 0.002, 0.16)


def hat():
    n = int(0.06 * SR)
    noise = rng.standard_normal(n)
    noise = np.diff(noise, prepend=0)  # crude high-pass
    return noise * env(n, 0.001, 0.018) * 0.35


def pluck(freq, length=0.32):
    n = int(length * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * 2 * freq * t) + 0.12 * np.sin(2 * np.pi * 3 * freq * t)
    return tone * env(n, 0.004, 0.12)


def pad(freqs, length):
    n = int(length * SR)
    t = np.arange(n) / SR
    tone = sum(np.sin(2 * np.pi * f * t + i) + 0.5 * np.sin(2 * np.pi * f * 1.004 * t) for i, f in enumerate(freqs))
    shape = np.minimum(t / 0.4, 1) * np.minimum((length - t) / 0.4, 1)
    return tone * shape / len(freqs)


def note(midi):
    return 440 * 2 ** ((midi - 69) / 12)


# Am - F - C - G, one chord per bar.
chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]
bass = [45, 41, 48, 43]
bar = 4 * BEAT
bars = int(LENGTH / bar) + 1

for b in range(bars):
    start = b * bar
    chord = chords[b % 4]
    add(pad([note(m) for m in chord], bar + 0.2), start, gain=0.11)
    for step in range(8):
        at = start + step * BEAT / 2
        full = at >= DROP
        arp = chord[[0, 1, 2, 1, 0, 2, 1, 2][step]] + 12
        add(pluck(note(arp)), at, pan=0.3 if step % 2 else -0.3, gain=0.16 if full else 0.1)
        if full or at >= DROP - 2 * bar:
            add(hat(), at + BEAT / 2 * 0.5, pan=0.2, gain=0.7 if full else 0.35)
    for beat in range(4):
        at = start + beat * BEAT
        if at >= DROP or (at >= 3.4 and beat % 2 == 0):
            add(kick(), at, gain=0.55)
        if at >= DROP:
            n = int(BEAT * SR)
            tt = np.arange(n) / SR
            add(np.sin(2 * np.pi * note(bass[b % 4]) * tt) * env(n, 0.01, 0.25), at, gain=0.3)

# Riser into the drop.
n = int(1.2 * SR)
tt = np.arange(n) / SR
riser = rng.standard_normal(n) * (tt / 1.2) ** 2 * 0.18
add(riser, DROP - 1.2)

# Fade out and normalise to -1 dBFS.
fade = np.minimum(1, (LENGTH - t_all) / 1.5)[:, None]
mix *= fade
mix /= np.max(np.abs(mix)) / 10 ** (-1 / 20)

out = Path(sys.argv[1] if len(sys.argv) > 1 else "public/music/idea-pulse.wav")
out.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(out), "wb") as f:
    f.setnchannels(2)
    f.setsampwidth(2)
    f.setframerate(SR)
    f.writeframes((mix * 32767).astype("<i2").tobytes())
print(f"wrote {out} ({LENGTH:.0f}s, {BPM} BPM)")
