# CineFlow

Full-pipeline automation for AI video production — script to voiceover, generation prompts, image-to-video, upscale, and CapCut draft assembly, tracked end-to-end in one app.

I built this to run my own AI video pipeline. Every project used to mean juggling folders of takes, prompts, and drafts by hand across separate tools; CineFlow wraps that pipeline in a Next.js app with a real data model, so a multi-shot project stays queryable and auditable instead of managed by convention.

## How it's built

A thin Node.js/Next.js layer wraps a set of unmodified Python pipeline scripts (`scripts/pipeline/`) using a copy-in/copy-out pattern — each script runs exactly as it would from the CLI, reading/writing a shot's working folder. The app doesn't reimplement pipeline logic; it invokes the scripts and records what happened.

Every invocation is tracked as a `PipelineRun` record (step, status, log, timing) tied to a `Shot`, which itself belongs to a `Project` and holds ordered `Take`s (the individual generation attempts — image, video, upscale — per shot). That data model is what lets the app show real status per shot instead of guessing from file timestamps.

```
Project
  └─ Shot (ordered, one per script beat)
       ├─ Take   (image / video / upscale attempts, one marked selected)
       └─ PipelineRun  (voiceover → prompts → image_ingest → i2v → upscale → capcut_draft)
```

Pipeline steps integrate with:
- **ComfyUI**, self-hosted locally, for image-to-video generation and upscaling (currently wired to a MiniMax H3 I2V workflow)
- **ElevenLabs** for voiceover generation
- **VectCutAPI**, a self-hosted HTTP service (separate project) for CapCut draft assembly

## Status

The backend pipeline — voiceover, prompt generation, image ingest, I2V generation, upscale, and CapCut draft assembly — runs end-to-end and is verified against real production shots (see `scripts/pipeline/README.md` for the manual CLI walkthrough). The Shot/Take UI on top of it is actively being built out. This is a working tool I use in my own production, not a finished product.

## Stack

Next.js · Prisma · SQLite · Node.js · Python · ComfyUI · VectCutAPI

## Setup

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev
```

The Python pipeline scripts have their own setup — see [`scripts/pipeline/README.md`](scripts/pipeline/README.md).
