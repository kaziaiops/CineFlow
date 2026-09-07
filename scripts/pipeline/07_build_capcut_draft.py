"""
Step 7 (AUTOMATED) — Build a CapCut draft for this one shot via VectCutAPI:
    - starts a local static file server over storage/test_pipeline (so
      VectCutAPI, which only accepts http(s) URLs, can fetch the
      locally-generated upscaled video)
    - add_video: places the upscaled clip on the main video track
    - add_text: adds the shot's caption/line as a text overlay
    - save_draft: writes the CapCut draft folder (draft_folder from config,
      user-configurable via CAPCUT_DRAFT_FOLDER env var)

VectCutAPI must already be running locally (python capcut_server.py, default
port 9001 — see config.VECTCUT_BASE_URL).

Usage:
    python scripts/pipeline/07_build_capcut_draft.py --shot test01 --caption "Stop multitasking."

Reads:  storage/test_pipeline/{shot}/video_upscaled.mp4, voice_meta.json
Writes: storage/test_pipeline/{shot}/capcut_draft_result.json
        a new dfd_* draft folder copied into config.CAPCUT_DRAFT_FOLDER
"""

import argparse
import functools
import http.server
import json
import shutil
import sys
import threading
from pathlib import Path

import requests

import config


# ---------------------------------------------------------------------------
# Local static file server — serves storage/test_pipeline/ so VectCutAPI can
# fetch our local files via http://127.0.0.1:PORT/{shot}/video_upscaled.mp4
# ---------------------------------------------------------------------------

def start_file_server() -> http.server.ThreadingHTTPServer:
    handler = functools.partial(
        http.server.SimpleHTTPRequestHandler, directory=str(config.PIPELINE_ROOT)
    )
    server = http.server.ThreadingHTTPServer(
        (config.LOCAL_FILE_SERVER_HOST, config.LOCAL_FILE_SERVER_PORT), handler
    )
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    print(
        f"Local file server up at http://{config.LOCAL_FILE_SERVER_HOST}:"
        f"{config.LOCAL_FILE_SERVER_PORT} (serving {config.PIPELINE_ROOT})"
    )
    return server


# ---------------------------------------------------------------------------
# VectCutAPI client — wire format confirmed against sun-guannan/VectCutAPI
# example.py (add_video, add_text, save_draft). Response shape is always
# {"success": bool, "output": ..., "error": ...} — "output" is present as ""
# even on failure, so success must be checked explicitly, not just presence
# of the "output" key.
# ---------------------------------------------------------------------------

def vc_request(endpoint: str, data: dict) -> dict:
    url = f"{config.VECTCUT_BASE_URL}/{endpoint}"
    resp = requests.post(url, json=data, timeout=60)
    resp.raise_for_status()
    body = resp.json()
    if not body.get("success"):
        raise RuntimeError(f"VectCutAPI {endpoint} failed: {body.get('error') or body}")
    return body


def add_video(video_url: str, duration_sec: float, draft_id: str | None) -> dict:
    data = {
        "video_url": video_url,
        "width": config.UPSCALE_WIDTH,
        "height": config.UPSCALE_HEIGHT,
        "start": 0,
        "end": duration_sec,
        "target_start": 0,
        "track_name": "main_video_track",
    }
    if draft_id:
        data["draft_id"] = draft_id
    return vc_request("add_video", data)


def add_text(caption: str, duration_sec: float, draft_id: str, font: str) -> dict:
    data = {
        "draft_folder": config.CAPCUT_DRAFT_FOLDER,
        "text": caption,
        "draft_id": draft_id,
        "start": 0,
        "end": duration_sec,
        "font": font,
        "font_color": "#FFFFFF",
        # NOTE: this is CapCut's internal size unit, not pixels — their own
        # default is 8.0 and example captions use ~15-30. The earlier 44.0
        # was 3-5x too large, which is what actually pushed the text off
        # frame (both directions), not just the transform_y value.
        "font_size": 15.0,
        "track_name": "main_caption",
        "transform_x": 0,
        # -1 = bottom edge, 0 = center. -0.6 sits in the lower third and
        # stays on-screen now that font_size is sane; tune further once
        # you're picking a final look.
        "transform_y": -0.6,
    }
    return vc_request("add_text", data)


def save_draft(draft_id: str) -> dict:
    return vc_request("save_draft", {"draft_id": draft_id, "draft_folder": config.CAPCUT_DRAFT_FOLDER})


# ---------------------------------------------------------------------------

def build_draft(shot_id: str, caption: str, font: str) -> None:
    d = config.shot_dir(shot_id)
    video_path = d / "video_upscaled.mp4"
    if not video_path.exists():
        sys.exit(f"{video_path} not found — run 06_upscale_comfyui.py first.")

    duration_sec = None
    meta_path = d / "voice_meta.json"
    if meta_path.exists():
        duration_sec = json.loads(meta_path.read_text())["duration_sec"]
    else:
        sys.exit("voice_meta.json not found — run 01_voiceover.py first (needed for clip length).")

    server = start_file_server()
    try:
        video_url = config.local_url_for(video_path)
        print(f"Serving clip at {video_url}")

        print("add_video...")
        video_result = add_video(video_url, duration_sec, draft_id=None)
        draft_id = video_result["output"]["draft_id"]
        print(f"  draft_id = {draft_id}")

        if caption:
            print("add_text...")
            add_text(caption, duration_sec, draft_id, font)

        print("save_draft...")
        save_result = save_draft(draft_id)
        print(f"  {save_result}")

        out_path = d / "capcut_draft_result.json"
        out_path.write_text(json.dumps(save_result, indent=2))
        print(f"\nWrote {out_path}")
        print(
            f"Draft should now be in {config.CAPCUT_DRAFT_FOLDER} — "
            "open CapCut and check the project list."
        )
    finally:
        server.shutdown()


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--shot", required=True)
    p.add_argument("--caption", default="", help="Text overlay for this shot; omit to skip add_text")
    p.add_argument(
        "--font",
        default="SourceHanSansCN_Regular",
        help="Must match a Font_type attribute name in VectCutAPI's pyJianYingDraft/metadata/font_meta.py "
             "(underscores, no spaces — e.g. SourceHanSansCN_Regular), not an arbitrary system font name.",
    )
    args = p.parse_args()
    build_draft(args.shot, args.caption, args.font)
