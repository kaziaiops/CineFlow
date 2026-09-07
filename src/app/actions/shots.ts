"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  runVoiceoverStep,
  runPromptsStep,
  runImageIngestStep,
  type VoiceoverParams,
  type PromptInputs,
} from "@/lib/pipeline";

// Rule-based parser: one Shot per non-empty, non-whitespace-only line.
// Matches the original spec ("auto-creates all Shot records, one shot per
// line/beat"). Lines are trimmed; blank lines are dropped, not preserved
// as empty shots.
function parseScriptIntoLines(script: string): string[] {
  return script
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export async function importScript(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const script = String(formData.get("script") ?? "");
  if (!projectId || !script.trim()) return;

  const lines = parseScriptIntoLines(script);

  await db.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: projectId },
      data: { script },
    });

    // Re-importing replaces the shot breakdown wholesale — simplest
    // consistent behavior until a "re-import merges" flow is worth building.
    await tx.shot.deleteMany({ where: { projectId } });

    await tx.shot.createMany({
      data: lines.map((line, index) => ({
        projectId,
        index,
        scriptText: line,
        caption: line,
      })),
    });
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function triggerVoiceover(shotId: string, params: VoiceoverParams) {
  await runVoiceoverStep(shotId, params);
}

export async function getVoiceoverState(shotId: string) {
  const [shot, runs, takes] = await Promise.all([
    db.shot.findUnique({ where: { id: shotId } }),
    db.pipelineRun.findMany({
      where: { shotId, step: "voiceover" },
      orderBy: { startedAt: "desc" },
      take: 5,
    }),
    db.take.findMany({
      where: { shotId, kind: "voice" },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { shot, runs, takes };
}

export async function triggerPrompts(shotId: string, inputs: PromptInputs) {
  await runPromptsStep(shotId, inputs);
}

export async function getPromptsState(shotId: string) {
  const [shot, runs] = await Promise.all([
    db.shot.findUnique({ where: { id: shotId } }),
    db.pipelineRun.findMany({
      where: { shotId, step: "prompts" },
      orderBy: { startedAt: "desc" },
      take: 5,
    }),
  ]);
  return { shot, runs };
}

export async function triggerImageIngest(shotId: string, file?: string) {
  await runImageIngestStep(shotId, file);
}

export async function getImageIngestState(shotId: string) {
  const [shot, runs, takes] = await Promise.all([
    db.shot.findUnique({ where: { id: shotId } }),
    db.pipelineRun.findMany({
      where: { shotId, step: "image_ingest" },
      orderBy: { startedAt: "desc" },
      take: 5,
    }),
    db.take.findMany({
      where: { shotId, kind: "image" },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { shot, runs, takes };
}
