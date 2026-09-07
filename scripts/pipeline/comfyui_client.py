"""
Thin ComfyUI HTTP client shared by steps 5 (I2V) and 6 (upscale).

ComfyUI workflow JSONs are extremely specific to your node graph — this
module deliberately does NOT guess which node is "the prompt node" or "the
seed node". Each step script loads a small node-map JSON (see
scripts/pipeline/workflows/*.node_map.json) that says exactly which node id
+ input key to patch. Fill those in once per workflow, from the same
"Save (API Format)" export you already have the node IDs for.
"""

import json
import time
import uuid
from pathlib import Path
from typing import Any

import requests

import config


class ComfyUIError(RuntimeError):
    pass


def load_workflow(path: Path) -> dict:
    if not path.exists():
        raise ComfyUIError(
            f"Workflow JSON not found at {path}. Export it from ComfyUI via "
            "'Save (API Format)' and place it there."
        )
    return json.loads(path.read_text())


def load_node_map(path: Path) -> dict:
    if not path.exists():
        raise ComfyUIError(
            f"Node map not found at {path}. Create it — see "
            "scripts/pipeline/workflows/README.md for the format."
        )
    return json.loads(path.read_text())


def patch_workflow(workflow: dict, node_map: dict, values: dict) -> dict:
    """Apply {key: value} from `values` into workflow nodes per node_map.

    node_map format: {"<logical_key>": {"node": "<node id>", "input": "<input key>"}}
    values format:    {"<logical_key>": <value to set>}
    """
    wf = json.loads(json.dumps(workflow))  # deep copy
    for key, value in values.items():
        if key not in node_map:
            continue
        target = node_map[key]
        node_id = str(target["node"])
        input_key = target["input"]
        if node_id not in wf:
            raise ComfyUIError(f"Node id {node_id} (for '{key}') not found in workflow JSON.")
        wf[node_id]["inputs"][input_key] = value
    return wf


def upload_file(local_path: Path, subfolder: str = "", overwrite: bool = True) -> str:
    """Upload a file (image or video) into ComfyUI's input dir. Returns the
    filename ComfyUI now knows it by — use this in a LoadImage/LoadVideo node."""
    url = f"{config.COMFYUI_BASE_URL}/upload/image"
    with open(local_path, "rb") as f:
        files = {"image": (local_path.name, f)}
        data = {"overwrite": str(overwrite).lower()}
        if subfolder:
            data["subfolder"] = subfolder
        resp = requests.post(url, files=files, data=data, timeout=60)
    resp.raise_for_status()
    body = resp.json()
    return body["name"]


def queue_prompt(workflow: dict) -> str:
    client_id = str(uuid.uuid4())
    resp = requests.post(
        f"{config.COMFYUI_BASE_URL}/prompt",
        json={"prompt": workflow, "client_id": client_id},
        timeout=30,
    )
    if resp.status_code != 200:
        raise ComfyUIError(f"ComfyUI /prompt error {resp.status_code}: {resp.text}")
    body = resp.json()
    if "error" in body:
        raise ComfyUIError(f"ComfyUI rejected the workflow: {body['error']}")
    return body["prompt_id"]


def wait_for_completion(prompt_id: str, timeout: int = 900, poll_interval: float = 2.0) -> dict:
    print(f"Waiting for ComfyUI job {prompt_id} (polling /history every {poll_interval}s)...")
    start = time.time()
    while True:
        resp = requests.get(f"{config.COMFYUI_BASE_URL}/history/{prompt_id}", timeout=30)
        resp.raise_for_status()
        history = resp.json()
        if prompt_id in history:
            entry = history[prompt_id]
            status = entry.get("status", {})
            if status.get("completed"):
                return entry
            if status.get("status_str") == "error":
                raise ComfyUIError(f"ComfyUI job failed: {json.dumps(status, indent=2)}")
        if time.time() - start > timeout:
            raise ComfyUIError(f"Timed out after {timeout}s waiting for job {prompt_id}.")
        time.sleep(poll_interval)


def find_output_file(history_entry: dict) -> dict:
    """Scan a completed job's outputs for the first file reference (image,
    video, gif — any output key whose value is a list of {filename,...}
    dicts). Different node types (VHS_VideoCombine, core SaveVideo, etc.)
    use different key names, so this doesn't hardcode one."""
    outputs = history_entry.get("outputs", {})
    for node_id, node_output in outputs.items():
        for key, value in node_output.items():
            if isinstance(value, list) and value and isinstance(value[0], dict) and "filename" in value[0]:
                return value[0]
    raise ComfyUIError(f"No output file found in outputs: {json.dumps(outputs, indent=2)}")


def download_output(file_ref: dict, dest: Path) -> None:
    params = {
        "filename": file_ref["filename"],
        "subfolder": file_ref.get("subfolder", ""),
        "type": file_ref.get("type", "output"),
    }
    resp = requests.get(f"{config.COMFYUI_BASE_URL}/view", params=params, timeout=120)
    resp.raise_for_status()
    dest.write_bytes(resp.content)
    print(f"Downloaded {dest} ({len(resp.content)} bytes)")
