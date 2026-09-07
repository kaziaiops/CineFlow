"use client";

import { useEffect, useRef, useState } from "react";
import type { PipelineRun, Take } from "@prisma/client";
import { triggerImageIngest, getImageIngestState } from "@/app/actions/shots";
import { StatusBadge } from "@/components/StatusBadge";

export function ImageIngestPanel({
  shotId,
  initialRuns,
  initialTakes,
}: {
  shotId: string;
  initialRuns: PipelineRun[];
  initialTakes: Take[];
}) {
  const [file, setFile] = useState("");
  const [runs, setRuns] = useState(initialRuns);
  const [takes, setTakes] = useState(initialTakes);
  const [triggering, setTriggering] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestRun = runs[0];
  const isRunning = latestRun?.status === "running" || latestRun?.status === "queued";

  useEffect(() => {
    if (!isRunning) return;
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const state = await getImageIngestState(shotId);
      setRuns(state.runs);
      setTakes(state.takes);
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
      await triggerImageIngest(shotId, file || undefined);
      const state = await getImageIngestState(shotId);
      setRuns(state.runs);
      setTakes(state.takes);
    } finally {
      setTriggering(false);
    }
  }

  const busy = triggering || isRunning;

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="eyebrow">Step 4 — Image ingest</p>
        {latestRun && <StatusBadge status={latestRun.status} />}
      </div>

      <p className="text-sm text-[var(--text-tertiary)] leading-relaxed mb-3">
        Generate the image manually in Nano Banana Pro using the prompt
        above, download it, then ingest it here. Leave the path blank to
        auto-pick the most recently downloaded image.
      </p>

      <input
        className="input w-full"
        placeholder={"Leave blank to auto-pick from the download folder"}
        value={file}
        onChange={(e) => setFile(e.target.value)}
        disabled={busy}
      />

      <button onClick={handleTrigger} disabled={busy} className="btn-primary mt-4">
        {busy ? "Ingesting…" : "Ingest image"}
      </button>

      {latestRun?.status === "failed" && latestRun.error && (
        <pre className="mt-3 text-xs text-[var(--status-failed)] whitespace-pre-wrap rounded-lg bg-black/30 p-3 border border-[var(--status-failed-border)]">
          {latestRun.error}
        </pre>
      )}

      {takes.length > 0 && (
        <div className="mt-6">
          <p className="eyebrow mb-2">Takes</p>
          <div className="grid grid-cols-3 gap-3">
            {takes.map((t) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={t.id}
                src={`/api/media/${t.filePath}`}
                alt="Ingested take"
                className="w-full aspect-[9/16] object-cover rounded-lg border border-[var(--border)]"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
