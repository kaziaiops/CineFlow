# ComfyUI workflow files (not checked in)

This folder holds two things per workflow, neither of which ships with the
repo because they're specific to your ComfyUI node graph:

1. `<name>.json` — the workflow itself, exported via ComfyUI's menu:
   **Save (API Format)** (not the regular "Save", which exports the UI
   graph, not the API-callable one).

2. `<name>.node_map.json` — tells `comfyui_client.patch_workflow()` which
   node id + input key to write each pipeline value into. Look up the node
   ids from the same JSON you just exported (open it in a text editor —
   each top-level key is a node id, `class_type` tells you what it is,
   `_meta.title` is whatever you renamed it to in the ComfyUI UI).

## Files in use

- `i2v_minimax_h3.json` + `i2v_minimax_h3.node_map.json` — used by
  `05_generate_video_comfyui.py`. Real graph: MiniMax H3 Image-to-Video
  (+ Lightning LoRA, 8-step turbo). Node map:
  ```json
  {
    "image": { "node": "114", "input": "image" },
    "positive_prompt": { "node": "105:104", "input": "prompt" },
    "seed": { "node": "105:15", "input": "noise_seed" },
    "duration": { "node": "105:111", "input": "value" }
  }
  ```
  No negative-prompt node exists in this graph — `MiniMaxH3ImageToVideo`
  only takes `prompt`. `motion_prompt_negative` from `prompts.json` is kept
  for reference but not sent to ComfyUI here.

- `upscale.json` + `upscale.node_map.json` — used by
  `06_upscale_comfyui.py`. Real graph:
  `VHS_LoadVideo -> ImageUpscaleWithModelBatched (4x-UltraSharp) -> ImageScale -> VHS_VideoCombine`.
  ```json
  {
    "video": { "node": "11", "input": "video" },
    "width": { "node": "5", "input": "width" },
    "height": { "node": "5", "input": "height" }
  }
  ```

Both workflows are built **portrait 9:16** (1080x1920) — the upscale
`ImageScale` node's defaults are already `width: 1080, height: 1920`.
`config.py`'s `IMAGE_RESOLUTION` / `IMAGE_ASPECT` / `UPSCALE_WIDTH` /
`UPSCALE_HEIGHT` match this, not the 16:9 the original pipeline guide PDF
described.

Only include keys your workflow actually needs patched — the scripts skip
any logical key not present in the map. If a key the script tries to patch
IS in the map but points at a node id that doesn't exist in the workflow
JSON, you'll get a clear error naming the missing node id.
