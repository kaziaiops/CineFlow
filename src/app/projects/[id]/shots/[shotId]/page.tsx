import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { VoiceoverPanel } from "@/components/VoiceoverPanel";
import { PromptsPanel } from "@/components/PromptsPanel";
import { ImageIngestPanel } from "@/components/ImageIngestPanel";
import { EMPTY_PROMPT_INPUTS, type PromptInputs } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export default async function ShotPage({
  params,
}: {
  params: Promise<{ id: string; shotId: string }>;
}) {
  const { id, shotId } = await params;
  const shot = await db.shot.findUnique({
    where: { id: shotId },
    include: { project: true },
  });

  if (!shot || shot.projectId !== id) notFound();

  const [voiceRuns, voiceTakes, promptRuns, imageRuns, imageTakes] = await Promise.all([
    db.pipelineRun.findMany({ where: { shotId, step: "voiceover" }, orderBy: { startedAt: "desc" }, take: 5 }),
    db.take.findMany({ where: { shotId, kind: "voice" }, orderBy: { createdAt: "desc" } }),
    db.pipelineRun.findMany({ where: { shotId, step: "prompts" }, orderBy: { startedAt: "desc" }, take: 5 }),
    db.pipelineRun.findMany({ where: { shotId, step: "image_ingest" }, orderBy: { startedAt: "desc" }, take: 5 }),
    db.take.findMany({ where: { shotId, kind: "image" }, orderBy: { createdAt: "desc" } }),
  ]);

  let promptInputs: PromptInputs = EMPTY_PROMPT_INPUTS;
  try {
    const parsed = JSON.parse(shot.promptInputs);
    promptInputs = { ...EMPTY_PROMPT_INPUTS, ...parsed };
  } catch {
    // promptInputs was never set — fall back to empty defaults.
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-14">
      <Link
        href={`/projects/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors mb-6"
      >
        ← {shot.project.title}
      </Link>

      <div className="flex items-start gap-4 mb-10">
        <span className="index-badge h-10 w-10 text-sm mt-1">{shot.index + 1}</span>
        <div>
          <p className="eyebrow mb-1">Shot {shot.index + 1}</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--text-primary)] leading-snug">
            {shot.scriptText}
          </h1>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <VoiceoverPanel
          shotId={shot.id}
          scriptText={shot.scriptText}
          initialDurationMs={shot.durationMs}
          initialRuns={voiceRuns}
          initialTakes={voiceTakes}
        />

        <PromptsPanel
          shotId={shot.id}
          initialInputs={promptInputs}
          initialShot={shot}
          initialRuns={promptRuns}
        />

        <ImageIngestPanel
          shotId={shot.id}
          initialRuns={imageRuns}
          initialTakes={imageTakes}
        />
      </div>
    </div>
  );
}
