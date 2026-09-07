r"""
Step 1 — Get this shot's voiceover and its authoritative duration, from
whichever source you actually have. Every downstream step (03, 05, 07)
reads the duration from voice_meta.json written here, so no matter which
mode you use, the rest of the pipeline sees one consistent number.

Exactly one of --text / --audio-file / --duration is required.

Mode 1 — generate via ElevenLabs (needs ELEVENLABS_API_KEY):
    python scripts/pipeline/01_voiceover.py --shot test01 \
        --text "Stop multitasking. It's costing you more than you think."

Mode 2 — you already have a voiceover file (any format ffprobe reads):
    python scripts/pipeline/01_voiceover.py --shot test01 \
        --audio-file "C:\path\to\voiceover.wav"

Mode 3 — no audio yet, you already marked the timing manually (e.g. in CapCut):
    python scripts/pipeline/01_voiceover.py --shot test01 --duration 4

Writes:
    storage/test_pipeline/{shot}/voice.mp3        (modes 1 and 2 only)
    storage/test_pipeline/{shot}/voice_meta.json  (all modes — duration_sec, duration_ms, source)
"""

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

import requests

import config


def ffprobe_duration_sec(path: Path) -> float:
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                str(path),
            ],
            capture_output=True, text=True, check=True,
        )
    except FileNotFoundError:
        sys.exit("ffprobe not found on PATH. Install FFmpeg (which includes ffprobe) and try again.")
    except subprocess.CalledProcessError as e:
        sys.exit(f"ffprobe failed on {path}: {e.stderr.strip()}")

    output = result.stdout.strip()
    if not output:
        sys.exit(f"ffprobe returned no duration for {path}. Is it a valid audio/video file?")
    return float(output)


def write_meta(shot_dir: Path, duration_sec: float, source: str, extra: dict) -> None:
    meta = {
        "shot_id": shot_dir.name,
        "duration_sec": round(duration_sec, 3),
        "duration_ms": round(duration_sec * 1000),
        "source": source,
        **extra,
    }
    out_path = shot_dir / "voice_meta.json"
    out_path.write_text(json.dumps(meta, indent=2))
    print(f"Duration: {meta['duration_sec']}s ({meta['duration_ms']}ms), source={source}")
    print(f"Wrote {out_path}")


def mode_generate(shot_id: str, text: str) -> None:
    if not config.ELEVENLABS_API_KEY:
        sys.exit("ELEVENLABS_API_KEY is not set. Set it and re-run.")

    d = config.shot_dir(shot_id)
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{config.ELEVENLABS_VOICE_ID}"
    headers = {
        "xi-api-key": config.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }
    payload = {
        "text": text,
        "model_id": config.ELEVENLABS_MODEL_ID,
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }

    print(f"Requesting TTS from ElevenLabs (voice={config.ELEVENLABS_VOICE_NAME})...")
    resp = requests.post(url, headers=headers, json=payload, timeout=60)
    if resp.status_code != 200:
        sys.exit(f"ElevenLabs error {resp.status_code}: {resp.text}")

    voice_path = d / "voice.mp3"
    voice_path.write_bytes(resp.content)
    print(f"Wrote {voice_path} ({len(resp.content)} bytes)")

    duration_sec = ffprobe_duration_sec(voice_path)
    write_meta(d, duration_sec, source="elevenlabs", extra={"text": text})


def mode_provided_file(shot_id: str, audio_file: Path) -> None:
    if not audio_file.exists():
        sys.exit(f"{audio_file} does not exist.")

    d = config.shot_dir(shot_id)
    voice_path = d / "voice.mp3"
    if audio_file.suffix.lower() == ".mp3":
        shutil.copyfile(audio_file, voice_path)
    else:
        # Keep it simple and honest: re-encode to mp3 via ffmpeg so
        # downstream steps only ever deal with one audio format.
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-i", str(audio_file), "-codec:a", "libmp3lame", "-qscale:a", "2", str(voice_path)],
                capture_output=True, text=True, check=True,
            )
        except FileNotFoundError:
            sys.exit("ffmpeg not found on PATH. Install FFmpeg and try again.")
        except subprocess.CalledProcessError as e:
            sys.exit(f"ffmpeg failed converting {audio_file} to mp3: {e.stderr.strip()}")

    print(f"Wrote {voice_path} (from {audio_file})")
    duration_sec = ffprobe_duration_sec(voice_path)
    write_meta(d, duration_sec, source="provided_file", extra={"original_file": str(audio_file)})


def mode_manual_duration(shot_id: str, duration: float) -> None:
    d = config.shot_dir(shot_id)
    print("No audio file for this mode — voice.mp3 not written. "
          "Drop the real voiceover into this shot folder later if needed.")
    write_meta(d, duration, source="manual", extra={})


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--shot", required=True)
    p.add_argument("--text", help="Generate via ElevenLabs from this script text")
    p.add_argument("--audio-file", help="Path to a voiceover file you already have")
    p.add_argument("--duration", type=float, help="Seconds, if you have no audio yet (e.g. marked manually in CapCut)")
    args = p.parse_args()

    modes_given = [bool(args.text), bool(args.audio_file), args.duration is not None]
    if sum(modes_given) != 1:
        sys.exit("Pass exactly one of --text, --audio-file, or --duration.")

    if args.text:
        mode_generate(args.shot, args.text)
    elif args.audio_file:
        mode_provided_file(args.shot, Path(args.audio_file))
    else:
        mode_manual_duration(args.shot, args.duration)

    print(f"\nNext: python scripts/pipeline/03_generate_prompts.py --shot {args.shot} ...")


if __name__ == "__main__":
    main()
