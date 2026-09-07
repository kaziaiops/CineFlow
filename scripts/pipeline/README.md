# Manual end-to-end pipeline test scripts

Standalone Python scripts, one per pipeline stage, so you can run each step
by hand and verify the output before moving to the next. These are NOT part
of the Next.js app yet — this is for proving the pipeline works with one
test shot. Naming/paths match what the app's `Take` model will expect later.

## Setup

```bash
cd scripts/pipeline
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
```

Also requires **FFmpeg** (`ffprobe`/`ffmpeg` on PATH) — used by step 1 to read/convert audio duration.

Set env vars (or put them in your shell profile):

```bash
set ELEVENLABS_API_KEY=your-key-here
```

Optional overrides (defaults shown):

```
COMFYUI_BASE_URL=http://127.0.0.1:8188
VECTCUT_BASE_URL=http://127.0.0.1:9001
CAPCUT_DRAFT_FOLDER=C:\Users\<you>\AppData\Local\CapCut\User Data\Projects\com.lveditor.draft
LOCAL_FILE_SERVER_PORT=8090
```

## File handoff contract

Every step reads/writes inside one folder:

```
storage/test_pipeline/{shot_id}/
    voice.mp3               step 1 (only written in --text / --audio-file modes)
    voice_meta.json          step 1 (duration_sec, duration_ms, source — always written)
    prompts.json             step 3 (image + motion prompts)
    image.png                step 4 (you drop in the Nano Banana Pro output)
    video_raw.mp4             step 5 (ComfyUI I2V, MiniMax H3, portrait)
    video_upscaled.mp4        step 6 (ComfyUI upscale, 1080x1920)
    capcut_draft_result.json  step 7 (VectCutAPI save_draft response)
```

## Run order

Step 1 has three modes — use whichever matches what you actually have; every
downstream step reads the same `voice_meta.json` regardless of which one you
used:

```bash
# Mode 1 — generate via ElevenLabs (needs ELEVENLABS_API_KEY)
python 01_voiceover.py --shot test01 --text "Stop multitasking. It's costing you more than you think."

# Mode 2 — you already have a voiceover file (any format ffprobe reads)
python 01_voiceover.py --shot test01 --audio-file "C:\path\to\voiceover.wav"

# Mode 3 — no audio yet, timing already marked manually (e.g. in CapCut)
python 01_voiceover.py --shot test01 --duration 4
```

```bash
python 03_generate_prompts.py --shot test01 \
    --expression "slight satisfied smile, direct eye contact, relaxed shoulders" \
    --pose "standing confidently, one hand holding a phone, the other a laptop, both raised slightly" \
    --props "a phone (glowing soft blue) in the left hand, a laptop (glowing soft blue) in the right hand" \
    --primary-prop "the phone and laptop" \
    --primary-motion "rapidly and erratically swap position between hands" \
    --secondary-element "a thin status bar above the character's head" \
    --secondary-motion "pulses brighter and dimmer" \
    --emotion-start "pleased/confident" \
    --emotion-end "mildly strained" \
    --gesture "shoulder shift" \
    --pacing "smooth, rhythmic, alternating, playful bounce"

# --- manual step ---
# Copy the printed IMAGE PROMPT + IMAGE NEGATIVE PROMPT into Nano Banana Pro,
# generate, download the result into storage/inbox (or wherever IMAGE_DOWNLOAD_FOLDER points).

python 04_ingest_image.py --shot test01
# Auto-picks the most recently modified image in IMAGE_DOWNLOAD_FOLDER (default storage/inbox).
# Or pass --file "C:\path\to\actual-filename.png" to point at a specific one.

# Uses scripts/pipeline/workflows/i2v_minimax_h3.json + .node_map.json — see workflows/README.md
python 05_generate_video_comfyui.py --shot test01

# Requires scripts/pipeline/workflows/upscale.json + .node_map.json
python 06_upscale_comfyui.py --shot test01

# Requires VectCutAPI running (python capcut_server.py in the VectCutAPI repo)
python 07_build_capcut_draft.py --shot test01 --caption "Stop multitasking."
```

After step 7, open CapCut and confirm the draft appears with the clip and
caption at the right timing.

## What's still a placeholder

- `ELEVENLABS_VOICE_ID` defaults to Adam's public id; override via env var
  if your account resolves "Adam" to something else.
- The character block in `config.py` is the kaziai_labs "young man"
  template from `character-pipeline-guide.pdf`, not the Blindside Effect
  bear block — swap `CHARACTER_LOCKED_BLOCK` / `STANDING_NEGATIVE_BLOCK`
  when you lock the bear wording.
- VectCutAPI's exact response shape for `save_draft` (whether it copies the
  draft into `CAPCUT_DRAFT_FOLDER` itself or just writes a local `dfd_*`
  folder you must copy over) hasn't been verified against a live run yet —
  check the printed result after step 7 and adjust `07_build_capcut_draft.py`
  if it needs a manual copy step.

## Real workflows in use (confirmed from your exports)

- **I2V**: MiniMax H3 Image-to-Video + Lightning LoRA (8-step turbo) — not
  Wan 2.2 14B as the original pipeline guide assumed.
- **Aspect**: portrait 9:16 (1080x1920) throughout — not the 16:9 the
  pipeline guide PDF described. `config.py` now reflects this.
- **No negative motion prompt**: `MiniMaxH3ImageToVideo` has one `prompt`
  input only; `motion_prompt_negative` is generated in `prompts.json` for
  your reference but isn't sent to ComfyUI in step 5.
