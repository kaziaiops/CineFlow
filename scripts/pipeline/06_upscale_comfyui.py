"""
Step 6 (AUTOMATED) — Push the approved low-res clip through the ComfyUI
upscale workflow (768x432 -> 1920x1080).

Requires:
    scripts/pipeline/workflows/upscale.json
    scripts/pipeline/workflows/upscale.node_map.json (see workflows/README.md)

Usage:
    python scripts/pipeline/06_upscale_comfyui.py --shot test01

Reads:  storage/test_pipeline/{shot}/video_raw.mp4
Writes: storage/test_pipeline/{shot}/video_upscaled.mp4
"""

import argparse
import sys

import config
import comfyui_client as cc


NODE_MAP_PATH = config.REPO_ROOT / "scripts" / "pipeline" / "workflows" / "upscale.node_map.json"


def upscale_video(shot_id: str) -> None:
    d = config.shot_dir(shot_id)
    video_path = d / "video_raw.mp4"
    if not video_path.exists():
        sys.exit(f"{video_path} not found — run 05_generate_video_comfyui.py first.")

    workflow = cc.load_workflow(config.COMFYUI_UPSCALE_WORKFLOW_PATH)
    node_map = cc.load_node_map(NODE_MAP_PATH)

    print("Uploading low-res video to ComfyUI...")
    uploaded_name = cc.upload_file(video_path)

    values = {
        "video": uploaded_name,
        "width": config.UPSCALE_WIDTH,
        "height": config.UPSCALE_HEIGHT,
    }
    patched = cc.patch_workflow(workflow, node_map, values)

    print("Queuing upscale job...")
    prompt_id = cc.queue_prompt(patched)
    entry = cc.wait_for_completion(prompt_id)
    file_ref = cc.find_output_file(entry)

    out_path = d / "video_upscaled.mp4"
    cc.download_output(file_ref, out_path)

    print(f"Next: python scripts/pipeline/07_build_capcut_draft.py --shot {shot_id}")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--shot", required=True)
    args = p.parse_args()
    upscale_video(args.shot)
