"""
Shared config + file-naming contract for the manual end-to-end pipeline test.

Every step script in this folder reads/writes inside one shot folder:
    storage/test_pipeline/{SHOT_ID}/
        voice.mp3               <- 01_voiceover.py (modes: generate / provided file)
        voice_meta.json          <- 01_voiceover.py (all modes — the authoritative shot duration)
        prompts.json             <- 03_generate_prompts.py
        image.png                <- 04_ingest_image.py (you drop the Nano Banana Pro output)
        video_raw.mp4            <- 05_generate_video_comfyui.py
        video_upscaled.mp4       <- 06_upscale_comfyui.py
        capcut_draft_result.json <- 07_build_capcut_draft.py

Run scripts from the repo root:
    python scripts/pipeline/01_voiceover.py --shot test01 --text "..."
"""

import os
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parents[2]
# Overridable so the Next.js app can point a run at a real shot's scratch
# folder (storage/projects/{projectId}/shots) instead of the manual-testing
# default. Manual CLI usage is unaffected.
PIPELINE_ROOT = Path(os.environ.get("PIPELINE_ROOT", str(REPO_ROOT / "storage" / "test_pipeline")))


def shot_dir(shot_id: str) -> Path:
    d = PIPELINE_ROOT / shot_id
    d.mkdir(parents=True, exist_ok=True)
    return d


# ---------------------------------------------------------------------------
# ElevenLabs (voiceover)
# ---------------------------------------------------------------------------

ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_NAME = "Adam"  # per the pipeline guide: engaging, bright, friendly
# Adam's public voice_id on ElevenLabs. Override with ELEVENLABS_VOICE_ID env var
# if your account maps the name to a different id.
ELEVENLABS_VOICE_ID = os.environ.get("ELEVENLABS_VOICE_ID", "pNInz6obpgDQGcFmaJgB")
ELEVENLABS_MODEL_ID = os.environ.get("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2")

# ---------------------------------------------------------------------------
# Nano Banana Pro image handoff (step 4)
# ---------------------------------------------------------------------------

# Where you save images downloaded from Nano Banana Pro. Step 4 auto-picks
# the most recently modified image here when --file is omitted.
IMAGE_DOWNLOAD_FOLDER = Path(os.environ.get("IMAGE_DOWNLOAD_FOLDER", str(REPO_ROOT / "storage" / "inbox")))

# ---------------------------------------------------------------------------
# Character-consistency prompt template (kaziai_labs pipeline guide, v1)
# Locked block + negative block are used byte-identical in every image prompt.
# Swap these two constants if/when you lock the Blindside Effect bear block instead.
# ---------------------------------------------------------------------------

CHARACTER_LOCKED_BLOCK = (
    "A young man with short tousled black hair, warm light-tan skin tone, "
    "simple minimal facial features (dot-style dark eyes, thin eyebrows, "
    "small subtle smile line, no visible nose detail), wearing a solid "
    "navy-blue hoodie with drawstrings, khaki/beige trousers, a black "
    "wristwatch on the left wrist, stylized semi-realistic 2D "
    "flat-illustration character design with soft cel-shading, rounded "
    "friendly proportions, clean vector linework, consistent modern "
    "SaaS-explainer aesthetic"
)

STANDING_NEGATIVE_BLOCK = (
    "photorealistic, 3D render, realistic skin texture, extra limbs, extra "
    "fingers, distorted hands, distorted proportions, multiple characters, "
    "cluttered background, text, watermark, blurry, low detail, "
    "inconsistent art style, harsh shadows, asymmetrical face, "
    "glossy/shiny render, changing hair style, changing hoodie color, "
    "changing face shape"
)

MOTION_NEGATIVE_BLOCK = (
    "face distortion, character drift, changing facial features, extra "
    "fingers, extra limbs, morphing hands, icons disappearing or "
    "teleporting, icons changing shape or color, background movement, "
    "camera pan, camera zoom, static/frozen elements, subtle "
    "barely-visible motion, motion blur artifacts, flickering, warping "
    "proportions, inconsistent hoodie color, inconsistent hairstyle, low "
    "quality, jittery motion, text appearing, unnatural stretching"
)

# NOTE: the pipeline guide PDF describes 1920x1080 16:9 stills. The actual
# ComfyUI I2V + upscale workflows you exported are built portrait 9:16
# (1080x1920) — confirmed as the real target. Stills should match that so
# the image isn't cropped/padded going into I2V.
IMAGE_RESOLUTION = "1080x1920"
IMAGE_ASPECT = "9:16"

# ---------------------------------------------------------------------------
# ComfyUI (I2V + upscale)
# ---------------------------------------------------------------------------

COMFYUI_BASE_URL = os.environ.get("COMFYUI_BASE_URL", "http://127.0.0.1:8188")

# Path to the exported ComfyUI workflow JSON (API format, "Save (API Format)"
# in the ComfyUI menu) for each stage. Real workflows in use:
#   I2V:     MiniMax H3 Image-to-Video (+ Lightning LoRA, 8-step turbo) —
#            NOT Wan 2.2 14B as the original pipeline guide assumed.
#   Upscale: ImageUpscaleWithModelBatched (4x-UltraSharp) -> ImageScale -> VHS_VideoCombine
COMFYUI_I2V_WORKFLOW_PATH = REPO_ROOT / "scripts" / "pipeline" / "workflows" / "i2v_minimax_h3.json"
COMFYUI_UPSCALE_WORKFLOW_PATH = REPO_ROOT / "scripts" / "pipeline" / "workflows" / "upscale.json"

# Render settings, matching the real exported workflows (portrait 9:16).
I2V_FPS = 24
UPSCALE_WIDTH = 1080
UPSCALE_HEIGHT = 1920

# ---------------------------------------------------------------------------
# VectCutAPI + local static file server (for local-file -> URL handoff)
# ---------------------------------------------------------------------------

VECTCUT_BASE_URL = os.environ.get("VECTCUT_BASE_URL", "http://127.0.0.1:9001")

# Windows CapCut draft folder — user-configurable, not hardcoded (per AGENTS.md).
CAPCUT_DRAFT_FOLDER = os.environ.get(
    "CAPCUT_DRAFT_FOLDER",
    str(Path.home() / "AppData" / "Local" / "CapCut" / "User Data" / "Projects" / "com.lveditor.draft"),
)

# Local static file server that serves PIPELINE_ROOT so VectCutAPI (which only
# accepts http(s) URLs) can fetch our locally-generated image/video files.
LOCAL_FILE_SERVER_HOST = os.environ.get("LOCAL_FILE_SERVER_HOST", "127.0.0.1")
LOCAL_FILE_SERVER_PORT = int(os.environ.get("LOCAL_FILE_SERVER_PORT", "8090"))


def local_url_for(path: Path) -> str:
    """Map a file under PIPELINE_ROOT to the http(s) URL VectCutAPI should fetch."""
    rel = path.resolve().relative_to(PIPELINE_ROOT.resolve()).as_posix()
    return f"http://{LOCAL_FILE_SERVER_HOST}:{LOCAL_FILE_SERVER_PORT}/{rel}"
