#!/usr/bin/env python3
"""Assemble the 30-second runsIT car-hook ad from generated footage.

Inputs (see README.md):
  --hook        Raw Seedance car-hook clip (9:16, dialogue in the clip audio).
  --narration   One or more Seedance narration clips, in script order. Only their
                audio is used. Together they must contain the five narration lines.
  --preview     Render with a placeholder hook and no narration to check layout.

Outputs in --out (default ./out):
  runsit-car-hook.mp4          8.00 s opening
  runsit-complete-ad-30s.mp4   final ad, H.264/AAC, 1080x1920, 30 fps, fast start
  runsit-complete-ad-30s.srt   captions
  captions.ass, timings.json, report.json

Requires an ffmpeg build with libass, loudnorm and silencedetect.
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
PRODUCT = os.path.join(HERE, "runsit-product-section-9x16.mp4")
FONTS = os.path.join(HERE, "fonts")
W, H, FPS = 1080, 1920, 30
HOOK_LEN, PRODUCT_LEN = 8.0, 22.0
TOTAL = HOOK_LEN + PRODUCT_LEN

HEADLINE = r"20 app ideas.\NNo idea where to start."

# Spoken dialogue in the hook, as caption chunks. {braces} mark the one highlighted word.
HOOK_CHUNKS = [
    ("My Notes app has {20} app ideas.", 0.0, 2.9),
    ("Actual apps? {Zero.}", 3.0, 4.4),
    ("I had no idea where to {start}—", 4.5, 6.6),
    ("until {this.}", 6.6, 7.9),
]

# Narration beats in ad time, each with one-line caption chunks.
BEATS = [
    (8.0, 11.8, ["runsIT has AI {templates}", "to help you get started."]),
    (11.8, 16.6, ["Pick your {template},", "describe your {idea},", "and shape your {plan}."]),
    (16.6, 21.9, ["Get a complete {guide}", "and a sample {prototype}."]),
    (21.9, 26.2, ["Then take your full {prompt}", "into your coding {AI}."]),
    (26.2, 30.0, ["Find your {template}", "at runsit.ca."]),
]

DUCK_DB = -12.0      # product-audio gain under narration
LEAD_IN = 0.2        # narration starts this long after each beat begins
YELLOW = "&H003FD2FF"  # #FFD23F in ASS BGR


def ffmpeg_bin():
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        sys.exit("ffmpeg not found (install ffmpeg or `pip install imageio-ffmpeg`).")


FF = ffmpeg_bin()


def run(args, capture=False):
    proc = subprocess.run([FF, "-hide_banner", "-nostdin", *args], capture_output=True, text=True)
    if proc.returncode != 0:
        sys.exit(f"ffmpeg failed:\n{proc.stderr[-3000:]}")
    return proc.stderr if capture else None


def probe(path):
    err = subprocess.run([FF, "-hide_banner", "-i", path], capture_output=True, text=True).stderr
    info = {"audio": None}
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", err)
    info["duration"] = int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3]) if m else None
    v = re.search(r"Video: .*?, (\d{2,5})x(\d{2,5})[, ].*?([\d.]+) fps", err)
    if v:
        info.update(width=int(v[1]), height=int(v[2]), fps=float(v[3]))
    a = re.search(r"Audio: (\w+).*?(\d+) Hz, (\w+)", err)
    if a:
        info["audio"] = {"codec": a[1], "rate": int(a[2]), "layout": a[3]}
    return info


def speech_segments(path, noise_db=-35, min_silence=0.18, start=0.0, end=None):
    """Return [(start, end)] of non-silent audio via silencedetect."""
    args = ["-ss", f"{start}"] + (["-to", f"{end}"] if end else []) + ["-i", path, "-vn",
            "-af", f"highpass=f=90,silencedetect=noise={noise_db}dB:d={min_silence}", "-f", "null", "-"]
    err = run(args, capture=True)
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", err)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", err)]
    duration = (end or probe(path)["duration"]) - start
    segs, cursor = [], 0.0
    for i, s in enumerate(starts):
        if s > cursor + 0.05:
            segs.append((cursor, s))
        cursor = ends[i] if i < len(ends) else duration
    if cursor < duration - 0.05:
        segs.append((cursor, duration))
    return [(a + start, b + start) for a, b in segs if b - a >= 0.08]


def group_segments(segs, n):
    """Merge speech segments into n groups by splitting at the n-1 widest gaps."""
    if len(segs) < n:
        return None
    gaps = sorted(range(len(segs) - 1), key=lambda i: segs[i + 1][0] - segs[i][1], reverse=True)[: n - 1]
    groups, first = [], 0
    for cut in sorted(gaps) + [len(segs) - 1]:
        groups.append((segs[first][0], segs[cut][1]))
        first = cut + 1
    return groups


def split_by_chars(start, end, chunks):
    weights = [len(strip(c)) for c in chunks]
    total, t, out = sum(weights), start, []
    for c, w in zip(chunks, weights):
        dt = (end - start) * w / total
        out.append((c, t, t + dt))
        t += dt
    return out


def strip(text):
    return text.replace("{", "").replace("}", "")


def ass_text(text):
    return re.sub(r"\{([^}]*)\}", lambda m: "{\\c" + YELLOW + "}" + m[1] + "{\\c&H00FFFFFF&}", text)


def ts_ass(t):
    cs = round(t * 100)
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def ts_srt(t):
    ms = round(t * 1000)
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def write_captions(hook_cues, narr_cues, out):
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Headline,Sora,58,&H00141414,&H00141414,&H00FFFFFF,&H00000000,1,0,0,0,100,100,0,0,3,16,0,2,90,90,650,1
Style: Hook,Inter,48,&H00FFFFFF,&H00FFFFFF,&H40101010,&H00000000,1,0,0,0,100,100,0,0,3,12,0,2,90,180,440,1
Style: Product,Inter,44,&H00FFFFFF,&H00FFFFFF,&H33101010,&H00000000,1,0,0,0,100,100,0,0,3,11,0,2,90,180,175,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = [f"Dialogue: 1,{ts_ass(0)},{ts_ass(HOOK_LEN)},Headline,,0,0,0,,{HEADLINE}"]
    for style, cues in (("Hook", hook_cues), ("Product", narr_cues)):
        for text, a, b, *_ in cues:
            lines.append(f"Dialogue: 0,{ts_ass(a)},{ts_ass(b)},{style},,0,0,0,,{ass_text(text)}")
    with open(os.path.join(out, "captions.ass"), "w") as f:
        f.write(header + "\n".join(lines) + "\n")

    # SRT cues match the burned-in chunks.
    cues = [c[:3] for c in hook_cues + narr_cues]
    srt = [f"{i}\n{ts_srt(a)} --> {ts_srt(b)}\n{strip(t)}\n" for i, (t, a, b) in enumerate(cues, 1)]
    with open(os.path.join(out, "runsit-complete-ad-30s.srt"), "w") as f:
        f.write("\n".join(srt))


def prepare_hook(raw, out, tmp):
    info = probe(raw)
    if not info.get("width"):
        sys.exit("Hook has no video stream.")
    if abs(info["width"] / info["height"] - W / H) > 0.01:
        sys.exit(f"Hook is {info['width']}x{info['height']}, not 9:16. Regenerate it vertical; do not center-crop.")
    if not info["audio"]:
        sys.exit("Hook has no audio; the dialogue must come from the generated clip.")
    segs = speech_segments(raw)
    if not segs:
        sys.exit("No speech detected in the hook audio.")
    offset = 0.0
    if segs[-1][1] > HOOK_LEN - 0.08:
        # Only if the words would be cut: drop leading silence before the first word.
        offset = max(0.0, segs[0][0] - 0.04)
        if segs[-1][1] - offset > HOOK_LEN - 0.08:
            sys.exit(f"Hook speech ends at {segs[-1][1]:.2f}s; it cannot be trimmed to 8.00s without cutting words.")
    path = os.path.join(out, "runsit-car-hook.mp4")
    run(["-y", "-ss", f"{offset}", "-i", raw, "-t", f"{HOOK_LEN}",
         "-vf", f"scale={W}:{H}:flags=lanczos,fps={FPS},format=yuv420p,setsar=1",
         "-af", f"aresample=48000,aformat=channel_layouts=stereo,afade=t=out:st={HOOK_LEN - 0.03}:d=0.03",
         "-frames:v", f"{int(HOOK_LEN * FPS)}",
         "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-profile:v", "high",
         "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-movflags", "+faststart", path])
    shifted = [(a - offset, b - offset) for a, b in segs if b - offset > 0]
    return path, shifted, offset


def hook_caption_cues(segs):
    if segs is None:
        return [(t, a, b) for t, a, b in HOOK_CHUNKS]
    groups = group_segments(segs, len(HOOK_CHUNKS))
    if groups is None:
        span = (segs[0][0], min(segs[-1][1], HOOK_LEN))
        return split_by_chars(*span, [c[0] for c in HOOK_CHUNKS])
    cues = []
    for i, ((text, *_), (a, b)) in enumerate(zip(HOOK_CHUNKS, groups)):
        nxt = groups[i + 1][0] if i + 1 < len(groups) else HOOK_LEN
        cues.append((text, max(0.0, a - 0.05), min(nxt, b + 0.25, HOOK_LEN)))
    return cues


def narration_lines(files, cuts_file):
    """Return five (file, start, end) narration lines in script order."""
    if cuts_file:
        with open(cuts_file) as f:
            cuts = json.load(f)
        lines = [(c["file"], float(c["start"]), float(c["end"])) for c in cuts]
    else:
        lines = []
        for path in files:
            segs = speech_segments(path, min_silence=0.3)
            lines.extend((path, a, b) for a, b in segs)
        if len(lines) > len(BEATS):
            # Too many pieces: merge within each file at the smallest gaps.
            lines = merge_to_count(lines, len(BEATS))
    if len(lines) != len(BEATS):
        found = ", ".join(f"{os.path.basename(p)} {a:.2f}-{b:.2f}" for p, a, b in lines)
        sys.exit(f"Expected {len(BEATS)} narration lines, found {len(lines)}: {found}\n"
                 "Pass --narration-cuts with explicit [{file,start,end}, ...] in script order.")
    return lines


def merge_to_count(lines, n):
    lines = list(lines)
    while len(lines) > n:
        best = min((i for i in range(len(lines) - 1) if lines[i][0] == lines[i + 1][0]),
                   key=lambda i: lines[i + 1][1] - lines[i][2], default=None)
        if best is None:
            break
        p, a, _ = lines[best]
        lines[best:best + 2] = [(p, a, lines[best + 1][2])]
    return lines


def place_narration(lines):
    placed = []
    for i, ((path, a, b), (beat_a, beat_b, chunks)) in enumerate(zip(lines, BEATS)):
        a, b = max(0.0, a - 0.04), b + 0.08  # keep consonant attacks and word tails
        length = b - a
        start = beat_a + LEAD_IN
        limit = TOTAL - 0.25 if i == len(BEATS) - 1 else beat_b + 0.35
        if start + length > limit:
            start = max(beat_a - 0.15, limit - length)
        if start + length > (TOTAL - 0.12):
            sys.exit(f"Narration line {i + 1} is {length:.2f}s; too long for its beat ending at {beat_b}s.")
        placed.append({"line": i + 1, "file": path, "src_start": round(a, 3), "src_end": round(b, 3),
                       "start": round(start, 3), "end": round(start + length, 3)})
    for prev, cur in zip(placed, placed[1:]):
        if cur["start"] < prev["end"] + 0.1:
            sys.exit(f"Narration lines {prev['line']} and {cur['line']} overlap; trim with --narration-cuts.")
    return placed


def narration_caption_cues(placed):
    cues = []
    for i, (beat_a, beat_b, chunks) in enumerate(BEATS):
        if placed:
            a, b = placed[i]["start"], placed[i]["end"]
            hold = min(b + 0.35, placed[i + 1]["start"] if i + 1 < len(placed) else TOTAL)
        else:
            a, b = beat_a + LEAD_IN, beat_b - 0.5
            hold = b + 0.3
        parts = split_by_chars(a, b, chunks)
        parts[-1] = (parts[-1][0], parts[-1][1], hold)
        cues.extend((t, s, e, i) for t, s, e in parts)
    return cues


def duck_expr(placed):
    g = 10 ** (DUCK_DB / 20)
    ramp = 0.18
    terms = []
    for p in placed:
        a, b = p["start"] - HOOK_LEN - 0.12, p["end"] - HOOK_LEN + 0.12
        terms.append(f"clip((t-{a - ramp:.3f})/{ramp},0,1)*clip(({b + ramp:.3f}-t)/{ramp},0,1)")
    if not terms:
        return "1"
    m = terms[0]
    for t in terms[1:]:
        m = f"max({m},{t})"
    return f"1-{1 - g:.4f}*{m}"


def build(args):
    out = os.path.abspath(args.out)
    os.makedirs(out, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix="runsit-ad-")
    prod = probe(PRODUCT)
    assert abs(prod["duration"] - PRODUCT_LEN) < 0.05 and (prod["width"], prod["height"]) == (W, H), prod

    if args.preview:
        hook = os.path.join(tmp, "placeholder-hook.mp4")
        run(["-y", "-f", "lavfi", "-i", f"color=c=0x2a2f36:s={W}x{H}:r={FPS}:d={HOOK_LEN}",
             "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", f"{HOOK_LEN}",
             "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", hook])
        hook_segs, offset = None, 0.0
    else:
        hook, hook_segs, offset = prepare_hook(args.hook, out, tmp)

    placed = place_narration(narration_lines(args.narration, args.narration_cuts)) if args.narration else []
    hook_cues = hook_caption_cues(hook_segs)
    narr_cues = narration_caption_cues(placed)
    write_captions(hook_cues, narr_cues, out)

    # Audio graph: hook dialogue, ducked product audio, narration lines.
    inputs = ["-i", hook, "-i", PRODUCT]
    narr_files = sorted({p["file"] for p in placed})
    for f in narr_files:
        inputs += ["-i", f]
    parts = [
        f"[0:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:{HOOK_LEN},asetpts=N/SR/TB,"
        f"afade=t=out:st={HOOK_LEN - 0.03}:d=0.03[ha]",
        f"[1:a]aresample=48000,aformat=channel_layouts=stereo,volume='{duck_expr(placed)}':eval=frame,"
        f"adelay={int(HOOK_LEN * 1000)}:all=1[pa]",
    ]
    mix = ["[ha]", "[pa]"]
    for p in placed:
        k = 2 + narr_files.index(p["file"])
        label = f"n{p['line']}"
        parts.append(
            f"[{k}:a]atrim={p['src_start']}:{p['src_end']},asetpts=N/SR/TB,aresample=48000,"
            f"aformat=channel_layouts=stereo,highpass=f=80,afade=t=in:d=0.02,"
            f"afade=t=out:st={p['src_end'] - p['src_start'] - 0.05:.3f}:d=0.05,"
            f"adelay={int(p['start'] * 1000)}:all=1[{label}]")
        mix.append(f"[{label}]")
    parts.append(f"{''.join(mix)}amix=inputs={len(mix)}:normalize=0:duration=longest,"
                 f"apad=whole_dur={TOTAL},atrim=0:{TOTAL}[mix]")
    fonts = FONTS.replace(":", r"\:")
    ass = os.path.join(out, "captions.ass").replace(":", r"\:")
    parts.append(f"[0:v]scale={W}:{H},fps={FPS},format=yuv420p,setsar=1,trim=end_frame={int(HOOK_LEN * FPS)},setpts=N/FRAME_RATE/TB[hv];"
                 f"[1:v]fps={FPS},format=yuv420p,setsar=1,setpts=N/FRAME_RATE/TB[pv];"
                 f"[hv][pv]concat=n=2:v=1:a=0,ass='{ass}':fontsdir='{fonts}'[v]")
    graph = ";".join(parts)

    premix = os.path.join(tmp, "premix.wav")
    video = os.path.join(tmp, "video.mp4")
    # Two-pass ABR so flat product graphics still reach the requested 12-20 Mbps.
    passlog = os.path.join(tmp, "x264")
    for n, target_file in ((1, os.devnull), (2, video)):
        run(["-y", *inputs, "-filter_complex", graph, "-map", "[mix]", "-c:a", "pcm_s24le", premix,
             "-map", "[v]", "-an", "-r", f"{FPS}", "-c:v", "libx264", "-preset", "slow",
             "-b:v", "14M", "-maxrate", "20M", "-bufsize", "28M", "-profile:v", "high", "-pix_fmt", "yuv420p",
             "-g", f"{FPS * 2}", "-frames:v", f"{int(TOTAL * FPS)}", "-pass", f"{n}", "-passlogfile", passlog,
             *(["-f", "mp4"] if n == 1 else []), target_file])

    # Two-pass loudness normalisation to -14 LUFS, true peak below -1 dBTP.
    target = "I=-14:TP=-1.5:LRA=11"
    stats = run(["-i", premix, "-af", f"loudnorm={target}:print_format=json", "-f", "null", "-"], capture=True)
    m = json.loads(stats[stats.rindex("{"):stats.rindex("}") + 1])
    norm = (f"loudnorm={target}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
            f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    final = os.path.join(out, "runsit-complete-ad-30s.mp4" if not args.preview else "runsit-ad-preview.mp4")
    run(["-y", "-i", video, "-i", premix, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
         "-af", f"{norm},aresample=48000,alimiter=limit=0.84:level=false,atrim=0:{TOTAL}",
         "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-ac", "2", "-t", f"{TOTAL}",
         "-movflags", "+faststart", final])

    loud = run(["-i", final, "-af", "ebur128=peak=true", "-f", "null", "-"], capture=True)
    summary = loud[loud.rindex("Summary:"):]
    info = probe(final)
    report = {
        "output": final, "preview": args.preview, "hook_trim_offset_s": offset,
        "duration_s": info["duration"], "video": {k: info.get(k) for k in ("width", "height", "fps")},
        "audio": info["audio"], "bytes": os.path.getsize(final),
        "integrated_lufs": float(re.search(r"I:\s+(-?[\d.]+) LUFS", summary)[1]),
        "true_peak_dbtp": float(re.search(r"Peak:\s+(-?[\d.]+) dBFS", summary)[1]),
        "narration": placed,
    }
    with open(os.path.join(out, "timings.json"), "w") as f:
        json.dump({"hook_captions": hook_cues, "narration_captions": narr_cues, "narration": placed}, f, indent=2)
    with open(os.path.join(out, "report.json"), "w") as f:
        json.dump(report, f, indent=2)
    shutil.rmtree(tmp, ignore_errors=True)
    print(json.dumps(report, indent=2))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--hook", help="raw generated car-hook clip")
    ap.add_argument("--narration", nargs="*", default=[], help="narration clips in script order")
    ap.add_argument("--narration-cuts", help="JSON list of {file,start,end} for the five lines")
    ap.add_argument("--preview", action="store_true", help="placeholder hook, planned timings")
    ap.add_argument("--out", default=os.path.join(HERE, "out"))
    args = ap.parse_args()
    if not args.preview and not args.hook:
        ap.error("--hook is required unless --preview is set")
    build(args)


if __name__ == "__main__":
    main()
