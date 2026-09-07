"use client";

import { useEffect, useRef, useState } from "react";
import type { PipelineRun, Shot } from "@prisma/client";
import { triggerPrompts, getPromptsState } from "@/app/actions/shots";
import { StatusBadge } from "@/components/StatusBadge";
import type { PromptInputs } from "@/lib/pipeline";

const FIELDS: { key: keyof PromptInputs; label: string; placeholder: string; wide?: boolean }[] = [
  { key: "expression", label: "Expression", placeholder: "slight satisfied smile, direct eye contact, relaxed shoulders", wide: true },
  { key: "pose", label: "Pose / gesture", placeholder: "standing confidently, one hand holding a phone, the other a laptop", wide: true },
  { key: "props", label: "Props (image)", placeholder: "a phone (glowing soft blue) in the left hand, a laptop in the right", wide: true },
  { key: "excludeProps", label: "Exclude props", placeholder: "props from a prior shot that must NOT reappear" },
  { key: "primaryProp", label: "Primary prop (motion)", placeholder: "the phone and laptop" },
  { key: "primaryMotion", label: "Primary motion", placeholder: "rapidly and erratically swap position between hands" },
  { key: "secondaryElement", label: "Secondary element", placeholder: "a thin status bar above the character's head" },
  { key: "secondaryMotion", label: "Secondary motion", placeholder: "pulses brighter and dimmer" },
  { key: "emotionStart", label: "Emotion (start)", placeholder: "pleased/confident" },
  { key: "emotionEnd", label: "Emotion (end)", placeholder: "mildly strained" },
  { key: "gesture", label: "Gesture (on-beat)", placeholder: "shoulder shift" },
  { key: "pacing", label: "Pacing", placeholder: "smooth, rhythmic, alternating, playful bounce" },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  return (
    <button
      type="button"
      className="btn-ghost text-xs"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function PromptsPanel({
  shotId,
  initialInputs,
  initialShot,
  initialRuns,
}: {
  shotId: string;
  initialInputs: PromptInputs;
  initialShot: Shot;
  initialRuns: PipelineRun[];
}) {
  const [inputs, setInputs] = useState<PromptInputs>(initialInputs);
  const [shot, setShot] = useState(initialShot);
  const [runs, setRuns] = useState(initialRuns);
  const [triggering, setTriggering] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestRun = runs[0];
  const isRunning = latestRun?.status === "running" || latestRun?.status === "queued";

  useEffect(() => {
    if (!isRunning) return;
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const state = await getPromptsState(shotId);
      setRuns(state.runs);
      if (state.shot) setShot(state.shot);
      const latest = state.runs[0];
      if (!latest || (latest.status !== "running" && latest.status !== "queued")) {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    }, 2000);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [isRunning, shotId]);

  async function handleTrigger() {
    setTriggering(true);
    try {
      await triggerPrompts(shotId, inputs);
      const state = await getPromptsState(shotId);
      setRuns(state.runs);
      if (state.shot) setShot(state.shot);
    } finally {
      setTriggering(false);
    }
  }

  const busy = triggering || isRunning;

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="eyebrow">Step 3 — Prompts</p>
        <div className="flex items-center gap-2.5">
          {latestRun && <StatusBadge status={latestRun.status} />}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map((f) => (
          <div key={f.key} className={f.wide ? "col-span-2" : ""}>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              {f.label}
            </label>
            <input
              className="input w-full"
              placeholder={f.placeholder}
              value={inputs[f.key]}
              onChange={(e) => setInputs((prev) => ({ ...prev, [f.key]: e.target.value }))}
              disabled={busy}
            />
          </div>
        ))}
      </div>

      <button onClick={handleTrigger} disabled={busy} className="btn-primary mt-5">
        {busy ? "Generating…" : "Generate prompts"}
      </button>

      {latestRun?.status === "failed" && latestRun.error && (
        <pre className="mt-3 text-xs text-[var(--status-failed)] whitespace-pre-wrap rounded-lg bg-black/30 p-3 border border-[var(--status-failed-border)]">
          {latestRun.error}
        </pre>
      )}

      {shot.imagePrompt && (
        <div className="mt-6 flex flex-col gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="eyebrow">Image prompt</p>
              <CopyButton text={shot.imagePrompt} />
            </div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed rounded-lg bg-black/20 border border-[var(--border)] p-3">
              {shot.imagePrompt}
            </p>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="eyebrow">Image negative prompt</p>
              <CopyButton text={shot.imageNegativePrompt} />
            </div>
            <p className="text-sm text-[var(--text-tertiary)] leading-relaxed rounded-lg bg-black/20 border border-[var(--border)] p-3">
              {shot.imageNegativePrompt}
            </p>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="eyebrow">Motion prompt (positive)</p>
              <CopyButton text={shot.motionPromptPos} />
            </div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed rounded-lg bg-black/20 border border-[var(--border)] p-3">
              {shot.motionPromptPos}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
