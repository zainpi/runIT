#!/usr/bin/env python3
"""Synthesizes the notes-app-ideas voiceover with Kokoro-82M (Apache-2.0), offline.

Writes one WAV per line to public/voiceover/<id>.wav plus public/voiceover/vo.json
(start time in the edit, duration, approximate word timings for captions).
The composition places each line at its `at` time.

Needs: pip install kokoro-onnx soundfile numpy
Model files (~350 MB) download once to ~/.cache/runsit-ads/kokoro.

    python3 scripts/make-voiceover.py [--voice af_heart] [--speed 1.12]
"""
import argparse
import json
import re
import urllib.request
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

# `text` is what she says (and what captions show); `say` is the spelling fed to TTS.
LINES = [
    {"id": "hook", "at": 0.25, "text": "Every app idea I've ever had… is still in my notes app."},
    {"id": "notes", "at": 3.8, "text": "Six ideas. Zero built."},
    {"id": "montage", "at": 5.95, "text": "And honestly? Everyone's sitting on one."},
    {"id": "twist", "at": 8.12, "text": "So what if it came with the build plan?"},
    {"id": "pick", "at": 9.85, "text": "Pick a template."},
    {"id": "describe", "at": 11.05, "text": "Describe your idea."},
    {"id": "plan", "at": 12.55, "text": "AI turns it into a real plan,"},
    {"id": "guide", "at": 14.3, "text": "then a step-by-step guide and prototype."},
    {"id": "payoff", "at": 16.3, "text": "Paste it into your AI coder, and actually build it."},
    {"id": "end", "at": 19.08, "text": "runsIT templates. From nine ninety-nine.", "say": "Runs it templates. From nine ninety nine."},
]

MODEL_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
CACHE = Path.home() / ".cache" / "runsit-ads" / "kokoro"


def model_files():
    CACHE.mkdir(parents=True, exist_ok=True)
    paths = []
    for name in ("kokoro-v1.0.onnx", "voices-v1.0.bin"):
        path = CACHE / name
        if not path.exists():
            print(f"downloading {name}…")
            partial = path.with_suffix(".part")
            urllib.request.urlretrieve(MODEL_URL + name, partial)
            partial.rename(path)
        paths.append(str(path))
    return paths


def trim(samples, sr, threshold=0.01, pad=0.03):
    loud = np.flatnonzero(np.abs(samples) > threshold)
    if not len(loud):
        return samples
    start = max(0, loud[0] - int(pad * sr))
    end = min(len(samples), loud[-1] + int(pad * sr))
    return samples[start:end]


def word_timings(text, duration):
    # Kokoro's ONNX build has no timestamps: spread the words by length, with
    # extra weight for punctuation pauses. Good enough for karaoke captions.
    words = text.split()
    weights = [len(re.sub(r"\W", "", w)) + 2 + (4 if re.search(r"[.,?!…]$", w) else 0) for w in words]
    total = sum(weights)
    at, out = 0.0, []
    for word, weight in zip(words, weights):
        out.append({"text": word, "at": round(at, 3)})
        at += duration * weight / total
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--voice", default="af_heart")
    parser.add_argument("--speed", type=float, default=1.15)
    parser.add_argument("--out", default="public/voiceover")
    args = parser.parse_args()

    kokoro = Kokoro(*model_files())
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    manifest = {"voice": args.voice, "speed": args.speed, "model": "Kokoro-82M v1.0 (Apache-2.0)", "lines": []}
    for line in LINES:
        samples, sr = kokoro.create(line.get("say", line["text"]).replace("…", "..."), voice=args.voice, speed=args.speed, lang="en-us")
        samples = trim(np.asarray(samples, dtype=np.float32), sr)
        samples *= 10 ** (-1 / 20) / max(1e-6, np.max(np.abs(samples)))  # peak -1 dBFS
        sf.write(out / f"{line['id']}.wav", samples, sr, subtype="PCM_16")
        duration = round(len(samples) / sr, 3)
        manifest["lines"].append({"id": line["id"], "at": line["at"], "duration": duration, "text": line["text"], "words": word_timings(line["text"], duration)})
        print(f"{line['id']:9} at {line['at']:5.2f}s  {duration:4.2f}s  ends {line['at'] + duration:5.2f}s")
    for a, b in zip(manifest["lines"], manifest["lines"][1:]):
        if a["at"] + a["duration"] > b["at"] + 0.05:
            print(f"warning: {a['id']} overlaps {b['id']} by {a['at'] + a['duration'] - b['at']:.2f}s")
    (out / "vo.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
