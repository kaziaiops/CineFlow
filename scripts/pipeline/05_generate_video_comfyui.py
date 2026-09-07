"""
Step 5 (AUTOMATED) — Push the approved image + motion prompt to ComfyUI's
MiniMax H3 Image-to-Video workflow (+ Lightning LoRA, 8-step turbo), poll
until done, save the render.

NOTE: MiniMaxH3ImageToVideo takes a single "prompt" input — there is no
negative-prompt node in this graph, so motion_prompt_negative from
prompts.json is generated (for your own reference / other models) but has
nowhere to go here and is not sent to ComfyUI.

Requires:
    scripts/pipeline/workflows/i2v_minimax_h3.json           (your exported workflow, API format)
    scripts/pipeline/workflows/i2v_minimax_h3.node_map.json  (see workflows/README.md)

Usage:
    python scripts/pipeline/05_generate_video_comfyui.py --shot test01 [--seed 12345]

Reads:  storage/test_pipeline/{shot}/image.png, prompts.json
Writes: storage/test_pipeline/{shot}/video_raw.mp4
"""

import argparse
import json
import random
import sys

import config
import comfyui_client as cc


NODE_MAP_PATH = config.REPO_ROOT / "scripts" / "pipeline" / "workflows" / "i2v_minimax_h3.node_map.json"


def generate_video(shot_id: str, seed: int | None) -> None:
    d = config.shot_dir(shot_id)
    image_path = d / "image.png"
    prompts_path = d / "prompts.json"
    if not image_path.exists():
        sys.exit(f"{image_path} not found — run 04_ingest_image.py first.")
    if not prompts_path.exists():
        sys.exit(f"{prompts_path} not found — run 03_generate_prompts.py first.")

    prompts = json.loads(prompts_path.read_text())
    workflow = cc.load_workflow(config.COMFYUI_I2V_WORKFLOW_PATH)
    node_map = cc.load_node_map(NODE_MAP_PATH)

    if "negative_prompt" not in node_map:
        print(
            "Note: this workflow has no negative-prompt node — "
            "motion_prompt_negative from prompts.json is not being used."
        )

    print("Uploading image to ComfyUI...")
    uploaded_name = cc.upload_file(image_path)

    values = {
        "image": uploaded_name,
        "positive_prompt": prompts["motion_prompt_positive"],
        "seed": seed if seed is not None else random.randint(0, 2**32 - 1),
        "duration": prompts["duration_sec"],
    }
    patched = cc.patch_workflow(workflow, node_map, values)

    print("Queuing I2V job...")
    prompt_id = cc.queue_prompt(patched)
    entry = cc.wait_for_completion(prompt_id)
    file_ref = cc.find_output_file(entry)

    out_path = d / "video_raw.mp4"
    cc.download_output(file_ref, out_path)

    print(f"\nUsed seed={values['seed']} — record it if you like this take.")
    print("Review the motion. If it's too subtle, re-run step 3 with a bolder --primary-motion.")
    print(f"Next: python scripts/pipeline/06_upscale_comfyui.py --shot {shot_id}")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--shot", required=True)
    p.add_argument("--seed", type=int, default=None)
    args = p.parse_args()
    generate_video(args.shot, args.seed)
