"""
Step 3 (AUTOMATED, text-only) — Assemble the image prompt and Wan 2.2 14B
motion prompt for one shot, following the locked skeletons in
character-pipeline-guide.pdf sections 5 and 6. No image API call happens here.

Usage:
    python scripts/pipeline/03_generate_prompts.py --shot test01 \
        --expression "slight satisfied smile, direct eye contact, relaxed shoulders" \
        --pose "standing confidently, one hand holding a phone, the other holding a laptop, both raised slightly, palms open" \
        --props "a phone (glowing soft blue) in the left hand and a laptop (glowing soft blue) in the right hand, both floating steady and balanced" \
        --exclude-props "" \
        --primary-prop "the phone and laptop" \
        --primary-motion "rapidly and erratically swap position between hands" \
        --secondary-element "a thin status bar above the character's head" \
        --secondary-motion "pulses brighter and dimmer" \
        --emotion-start "pleased/confident" \
        --emotion-end "mildly strained" \
        --gesture "a small shoulder shift" \
        --pacing "smooth, rhythmic, alternating, playful bounce" \
        --duration 3

Reads:  storage/test_pipeline/{shot}/voice_meta.json (for default duration)
Writes: storage/test_pipeline/{shot}/prompts.json
"""

import argparse
import json
import sys

import config


IMAGE_PROMPT_TEMPLATE = (
    "{locked_block}, standing with {expression}, {pose}, {props}, "
    "flat cream/off-white background, clean 2D vector-illustration style, "
    "centered composition, {resolution}, {aspect}"
)

MOTION_PROMPT_TEMPLATE = (
    "{primary_prop} {primary_motion}, clearly visible and "
    "energetic, not subtle. {secondary_element} visibly {secondary_motion} "
    "in a clear readable rhythm. Character's expression shifts from "
    "{emotion_start} to {emotion_end} partway through, with a {gesture} "
    "on-beat. Hair has visible subtle movement. Bold, energetic, highly "
    "visible motion throughout every element — not subtle, not static. "
    "Flat cream background static. Smooth animation, consistent character "
    "design, no distortion, no camera movement, no zoom, {duration} second "
    "duration. Pacing: {pacing}."
)


def build_prompts(args: argparse.Namespace) -> dict:
    image_prompt = IMAGE_PROMPT_TEMPLATE.format(
        locked_block=config.CHARACTER_LOCKED_BLOCK,
        expression=args.expression,
        pose=args.pose,
        props=args.props,
        resolution=config.IMAGE_RESOLUTION,
        aspect=config.IMAGE_ASPECT,
    )
    image_negative = config.STANDING_NEGATIVE_BLOCK
    if args.exclude_props:
        image_negative += f", {args.exclude_props}"

    motion_prompt_pos = MOTION_PROMPT_TEMPLATE.format(
        primary_prop=args.primary_prop or "the primary prop",
        primary_motion=args.primary_motion,
        secondary_element=args.secondary_element or "a secondary element",
        secondary_motion=args.secondary_motion,
        emotion_start=args.emotion_start,
        emotion_end=args.emotion_end,
        gesture=args.gesture,
        duration=args.duration,
        pacing=args.pacing,
    )
    motion_prompt_neg = config.MOTION_NEGATIVE_BLOCK

    return {
        "shot_id": args.shot,
        "image_prompt": image_prompt,
        "image_negative_prompt": image_negative,
        "motion_prompt_positive": motion_prompt_pos,
        "motion_prompt_negative": motion_prompt_neg,
        "duration_sec": args.duration,
    }


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--shot", required=True)
    p.add_argument("--expression", required=True, help="From the expression reference bank")
    p.add_argument("--pose", required=True, help="Hands, arms, head tilt")
    p.add_argument("--props", required=True, help="What's floating, its color, its state")
    p.add_argument("--exclude-props", default="", help="Props from a prior shot that must NOT reappear")
    p.add_argument("--primary-prop", default="", help="Name of the prop that gets the big motion")
    p.add_argument("--primary-motion", required=True)
    p.add_argument("--secondary-element", default="", help="e.g. 'the status bar', 'the glow'")
    p.add_argument("--secondary-motion", required=True, help="e.g. 'pulses brighter and dimmer'")
    p.add_argument("--emotion-start", required=True)
    p.add_argument("--emotion-end", required=True)
    p.add_argument("--gesture", required=True, help="e.g. 'head nod', 'shoulder shift'")
    p.add_argument("--pacing", required=True, help="From the pacing-by-emotion cheat sheet")
    p.add_argument("--duration", type=float, default=None, help="Seconds; defaults to voice_meta.json duration")
    args = p.parse_args()

    d = config.shot_dir(args.shot)
    if args.duration is None:
        meta_path = d / "voice_meta.json"
        if not meta_path.exists():
            sys.exit("No --duration given and voice_meta.json not found — run 01_voiceover.py first or pass --duration.")
        args.duration = round(json.loads(meta_path.read_text())["duration_sec"], 1)

    prompts = build_prompts(args)
    out_path = d / "prompts.json"
    out_path.write_text(json.dumps(prompts, indent=2))

    print(f"Wrote {out_path}\n")
    print("=== IMAGE PROMPT (copy into Nano Banana Pro) ===")
    print(prompts["image_prompt"])
    print("\n=== IMAGE NEGATIVE PROMPT ===")
    print(prompts["image_negative_prompt"])
    print("\n=== MOTION PROMPT POSITIVE (for step 5) ===")
    print(prompts["motion_prompt_positive"])
    print("\n=== MOTION PROMPT NEGATIVE ===")
    print(prompts["motion_prompt_negative"])
    print(f"\nNext: generate the image manually, then run "
          f"python scripts/pipeline/04_ingest_image.py --shot {args.shot} --file <path-to-downloaded-image>")


if __name__ == "__main__":
    main()
