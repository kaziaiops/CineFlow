import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { db } from "./db";

const REPO_ROOT = process.cwd();
const SCRIPTS_DIR = path.join(REPO_ROOT, "scripts", "pipeline");
const VENV_PYTHON = path.join(SCRIPTS_DIR, "venv", "Scripts", "python.exe");
export const STORAGE_ROOT = path.join(REPO_ROOT, "storage");

export function projectShotsRoot(projectId: string) {
  return path.join(STORAGE_ROOT, "projects", projectId, "shots");
}

export function shotScratchDir(projectId: string, shotId: string) {
  return path.join(projectShotsRoot(projectId), shotId);
}

export function shotTakesDir(projectId: string, shotId: string) {
  return path.join(shotScratchDir(projectId, shotId), "takes");
}

// Storage-root-relative path, forward-slashed, for Take.filePath / the media route.
function relativeToStorage(absolutePath: string): string {
  return path.relative(STORAGE_ROOT, absolutePath).split(path.sep).join("/");
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

type RunResult = { code: number; stdout: string; stderr: string };

function runPythonScript(
  scriptName: string,
  args: string[],
  env: Record<string, string>
): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(VENV_PYTHON, [scriptName, ...args], {
      cwd: SCRIPTS_DIR,
      env: { ...process.env, ...env },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
    child.on("error", (err) =>
      resolve({ code: -1, stdout, stderr: stderr + "\n" + String(err) })
    );
  });
}

async function finishRun(
  runId: string,
  status: "done" | "failed",
  log: string,
  error = ""
) {
  await db.pipelineRun.update({
    where: { id: runId },
    data: { status, log, error, finishedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Voiceover (step 1 — three modes, see 01_voiceover.py)
// ---------------------------------------------------------------------------

export type VoiceoverParams =
  | { mode: "text"; text: string }
  | { mode: "audioFile"; audioFile: string }
  | { mode: "duration"; duration: number };

/**
 * Kicks off the voiceover step and returns immediately with the new
 * PipelineRun's id — the actual script run + copy-out happens in a detached
 * promise so the caller (a Server Action) doesn't block on it. The client
 * polls getVoiceoverState() to watch the run finish.
 */
export async function runVoiceoverStep(
  shotId: string,
  params: VoiceoverParams
): Promise<string> {
  const shot = await db.shot.findUniqueOrThrow({ where: { id: shotId } });
  const run = await db.pipelineRun.create({
    data: { shotId, step: "voiceover", status: "running" },
  });

  void (async () => {
    try {
      const scratchDir = shotScratchDir(shot.projectId, shotId);
      await fs.mkdir(scratchDir, { recursive: true });

      const args = ["--shot", shotId];
      if (params.mode === "text") args.push("--text", params.text);
      else if (params.mode === "audioFile") args.push("--audio-file", params.audioFile);
      else args.push("--duration", String(params.duration));

      const env = { PIPELINE_ROOT: projectShotsRoot(shot.projectId) };
      const result = await runPythonScript("01_voiceover.py", args, env);
      const log = result.stdout + (result.stderr ? "\n--- stderr ---\n" + result.stderr : "");

      if (result.code !== 0) {
        await finishRun(run.id, "failed", log, `Script exited with code ${result.code}`);
        return;
      }

      const metaPath = path.join(scratchDir, "voice_meta.json");
      const meta = JSON.parse(await fs.readFile(metaPath, "utf-8")) as {
        duration_sec: number;
        duration_ms: number;
        source: string;
      };
      await db.shot.update({ where: { id: shotId }, data: { durationMs: meta.duration_ms } });

      // "duration" mode produces no audio file — nothing to copy into a Take.
      const voicePath = path.join(scratchDir, "voice.mp3");
      if (await fileExists(voicePath)) {
        const takesDir = shotTakesDir(shot.projectId, shotId);
        await fs.mkdir(takesDir, { recursive: true });
        const takeId = randomUUID();
        const destPath = path.join(takesDir, `${takeId}.mp3`);
        await fs.copyFile(voicePath, destPath);
        await db.take.create({
          data: {
            id: takeId,
            shotId,
            kind: "voice",
            filePath: relativeToStorage(destPath),
            mimeType: "audio/mpeg",
            sourceMeta: JSON.stringify(meta),
          },
        });
      }

      await finishRun(run.id, "done", log);
    } catch (err) {
      await finishRun(run.id, "failed", "", err instanceof Error ? err.message : String(err));
    }
  })();

  return run.id;
}

// ---------------------------------------------------------------------------
// Prompts (step 3 — text-only, see 03_generate_prompts.py)
// ---------------------------------------------------------------------------

export type PromptInputs = {
  expression: string;
  pose: string;
  props: string;
  excludeProps: string;
  primaryProp: string;
  primaryMotion: string;
  secondaryElement: string;
  secondaryMotion: string;
  emotionStart: string;
  emotionEnd: string;
  gesture: string;
  pacing: string;
};

export const EMPTY_PROMPT_INPUTS: PromptInputs = {
  expression: "",
  pose: "",
  props: "",
  excludeProps: "",
  primaryProp: "",
  primaryMotion: "",
  secondaryElement: "",
  secondaryMotion: "",
  emotionStart: "",
  emotionEnd: "",
  gesture: "",
  pacing: "",
};

type PromptsJson = {
  image_prompt: string;
  image_negative_prompt: string;
  motion_prompt_positive: string;
  motion_prompt_negative: string;
  duration_sec: number;
};

/** Same fire-and-forget pattern as runVoiceoverStep — see its docstring. */
export async function runPromptsStep(
  shotId: string,
  inputs: PromptInputs
): Promise<string> {
  const shot = await db.shot.findUniqueOrThrow({ where: { id: shotId } });
  const run = await db.pipelineRun.create({
    data: { shotId, step: "prompts", status: "running" },
  });

  void (async () => {
    try {
      const scratchDir = shotScratchDir(shot.projectId, shotId);
      await fs.mkdir(scratchDir, { recursive: true });

      const args = [
        "--shot", shotId,
        "--expression", inputs.expression,
        "--pose", inputs.pose,
        "--props", inputs.props,
        "--exclude-props", inputs.excludeProps,
        "--primary-prop", inputs.primaryProp,
        "--primary-motion", inputs.primaryMotion,
        "--secondary-element", inputs.secondaryElement,
        "--secondary-motion", inputs.secondaryMotion,
        "--emotion-start", inputs.emotionStart,
        "--emotion-end", inputs.emotionEnd,
        "--gesture", inputs.gesture,
        "--pacing", inputs.pacing,
        "--duration", String(shot.durationMs / 1000),
      ];

      const env = { PIPELINE_ROOT: projectShotsRoot(shot.projectId) };
      const result = await runPythonScript("03_generate_prompts.py", args, env);
      const log = result.stdout + (result.stderr ? "\n--- stderr ---\n" + result.stderr : "");

      if (result.code !== 0) {
        await finishRun(run.id, "failed", log, `Script exited with code ${result.code}`);
        return;
      }

      const promptsPath = path.join(scratchDir, "prompts.json");
      const prompts = JSON.parse(await fs.readFile(promptsPath, "utf-8")) as PromptsJson;

      await db.shot.update({
        where: { id: shotId },
        data: {
          promptInputs: JSON.stringify(inputs),
          imagePrompt: prompts.image_prompt,
          imageNegativePrompt: prompts.image_negative_prompt,
          motionPromptPos: prompts.motion_prompt_positive,
          motionPromptNeg: prompts.motion_prompt_negative,
        },
      });

      await finishRun(run.id, "done", log);
    } catch (err) {
      await finishRun(run.id, "failed", "", err instanceof Error ? err.message : String(err));
    }
  })();

  return run.id;
}

// ---------------------------------------------------------------------------
// Image ingest (step 4 — manual handoff, see 04_ingest_image.py)
// ---------------------------------------------------------------------------

/** Same fire-and-forget pattern as runVoiceoverStep — see its docstring. */
export async function runImageIngestStep(
  shotId: string,
  file?: string
): Promise<string> {
  const shot = await db.shot.findUniqueOrThrow({ where: { id: shotId } });
  const run = await db.pipelineRun.create({
    data: { shotId, step: "image_ingest", status: "running" },
  });

  void (async () => {
    try {
      const scratchDir = shotScratchDir(shot.projectId, shotId);
      await fs.mkdir(scratchDir, { recursive: true });

      const args = ["--shot", shotId];
      if (file && file.trim()) args.push("--file", file.trim());

      const env = { PIPELINE_ROOT: projectShotsRoot(shot.projectId) };
      const result = await runPythonScript("04_ingest_image.py", args, env);
      const log = result.stdout + (result.stderr ? "\n--- stderr ---\n" + result.stderr : "");

      if (result.code !== 0) {
        await finishRun(run.id, "failed", log, `Script exited with code ${result.code}`);
        return;
      }

      const imagePath = path.join(scratchDir, "image.png");
      const takesDir = shotTakesDir(shot.projectId, shotId);
      await fs.mkdir(takesDir, { recursive: true });
      const takeId = randomUUID();
      const destPath = path.join(takesDir, `${takeId}.png`);
      await fs.copyFile(imagePath, destPath);
      await db.take.create({
        data: {
          id: takeId,
          shotId,
          kind: "image",
          filePath: relativeToStorage(destPath),
          mimeType: "image/png",
        },
      });

      await db.shot.update({ where: { id: shotId }, data: { status: "image_ready" } });

      await finishRun(run.id, "done", log);
    } catch (err) {
      await finishRun(run.id, "failed", "", err instanceof Error ? err.message : String(err));
    }
  })();

  return run.id;
}
