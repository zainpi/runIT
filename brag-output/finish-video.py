"""Bake the chosen poster into frame zero, preserving the 22-second edit."""
from pathlib import Path
import json
import subprocess

root = Path(__file__).resolve().parent
raw, final, poster = (root / name for name in ("brag.raw.mp4", "brag.mp4", "brag.jpg"))

def run(*args):
    subprocess.run(args, check=True)

def probe(path):
    return json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)
    ]))

run("ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", "1.7", "-i", str(raw),
    "-frames:v", "1", "-q:v", "2", str(poster))
run("ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(raw), "-i", str(poster),
    "-filter_complex", "[0:v][1:v]overlay=0:0:enable='eq(n,0)'[v]",
    "-map", "[v]", "-map", "0:a?", "-c:v", "libx264", "-crf", "18", "-preset", "slow",
    "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", str(final))

before, after = probe(raw), probe(final)
vb = next(s for s in before["streams"] if s["codec_type"] == "video")
va = next(s for s in after["streams"] if s["codec_type"] == "video")
aa = next(s for s in after["streams"] if s["codec_type"] == "audio")
assert (va["width"], va["height"]) == (1920, 1080)
assert va["r_frame_rate"] == "30/1"
assert int(va["nb_frames"]) == int(vb["nb_frames"]) == 660
assert abs(float(va["duration"]) - 22) < 0.01
assert aa["codec_name"] == "aac"
assert abs(float(aa["duration"]) - 22) < 0.1
assert final.stat().st_size > 100_000
verification = {
    "video": "brag.mp4", "durationSeconds": float(va["duration"]),
    "width": va["width"], "height": va["height"], "fps": 30,
    "frames": int(va["nb_frames"]), "videoCodec": va["codec_name"],
    "audioCodec": aa["codec_name"], "audioChannels": aa["channels"],
    "bytes": final.stat().st_size, "posterSourceSecond": 1.7,
    "posterBakedIntoFrameZero": True, "sourceFrameCountPreserved": True,
    "sourceAudioCopied": True,
}
(root / "verification.json").write_text(json.dumps(verification, indent=2) + "\n")
print(json.dumps(verification, indent=2))
