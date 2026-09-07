"use client";

import { useEffect, useRef, useState } from "react";
import type { PipelineRun, Take } from "@prisma/client";
import { triggerVoiceover, getVoiceoverState } from "@/app/actions/shots";
import { StatusBadge } from "@/components/StatusBadge";

type Mode = "duration" | "text" | "audioFile";

const MODE_LABEL: Record<Mode, string> = {
  duration: "Manual duration",
  text: "Generate (ElevenLabs)",
  audioFile: "Existing file",
};

export function VoiceoverPanel({
  shotId,
  scriptText,
  initialDurationMs,
  initialRuns,
  initialTakes,
}: {
  shotId: string;
  scriptText: string;
  initialDurationMs: number;
  initialRuns: PipelineRun[];
  initialTakes: Take[];
}) {
  const [mode, setMode] = useState<Mode>("duration");
  const [text, setText] = useState(scriptText);
  const [audioFile, setAudioFile] = useState("");
  const [duration, setDuration] = useState(String(initialDurationMs / 1000));

  const [runs, setRuns] = useState(initialRuns);
  const [takes, setTakes] = useState(initialTakes);
  const [durationMs, setDurationMs] = useState(initialDurationMs);
  const [triggering, setTriggering] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const latestRun = runs[0];
  const isRunning = latestRun?.status === "running" || latestRun?.status === "queued";

  useEffect(() => {
    if (!isRunning) return;
    if (pollRef.current) return;

    pollRef.current = setInterval(async () => {
      const state = await getVoiceoverState(shotId);
      setRuns(state.runs);
      setTakes(state.takes);
      if (state.shot) setDurationMs(state.shot.durationMs);

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
      if (mode === "text") {
        await triggerVoiceover(shotId, { mode: "text", text });
      } else if (mode === "audioFile") {
        await triggerVoiceover(shotId, { mode: "audioFile", audioFile });
      } else {
        await triggerVoiceover(shotId, { mode: "duration", duration: parseFloat(duration) || 0 });
      }
      const state = await getVoiceoverState(shotId);
      setRuns(state.runs);
      setTakes(state.takes);
      if (state.shot) setDurationMs(state.shot.durationMs);
    } finally {
      setTriggering(false);
    }
  }

  const busy = triggering || isRunning;

  return (
    <div className="card p-6">
      <p className="eyebrow mb-3">Step 1 — Voiceover</p>

      <div className="flex gap-2 mb-4">
        {(["duration", "text", "audioFile"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={mode === m ? "btn-secondary" : "btn-ghost"}
            disabled={busy}
          >
            {MODE_LABEL[m]}
          </button>
        ))}
      </div>

      {mode === "text" && (
        <textarea
          className="input w-full font-mono leading-relaxed"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
        />
      )}
      {mode === "audioFile" && (
        <input
          className="input w-full"
          placeholder={"C:\\path\\to\\voiceover.wav"}
          value={audioFile}
          onChange={(e) => setAudioFile(e.target.value)}
          disabled={busy}
        />
      )}
      {mode === "duration" && (
        <input
          className="input w-32"
          type="number"
          step="0.1"
          min="0"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          disabled={busy}
        />
      )}

      <div className="flex items-center gap-3 mt-4">
        <button onClick={handleTrigger} disabled={busy} className="btn-primary">
          {busy ? "Running…" : "Run voiceover step"}
        </button>
        {latestRun && <StatusBadge status={latestRun.status} />}
        <span className="meta-text">{(durationMs / 1000).toFixed(1)}s</span>
      </div>

      {latestRun?.status === "failed" && latestRun.error && (
        <pre className="mt-3 text-xs text-[var(--status-failed)] whitespace-pre-wrap rounded-lg bg-black/30 p-3 border border-[var(--status-failed-border)]">
          {latestRun.error}
        </pre>
      )}

      {takes.length > 0 && (
        <div className="mt-6">
          <p className="eyebrow mb-2">Takes</p>
          <ul className="flex flex-col gap-2.5">
            {takes.map((t) => (
              <li key={t.id} className="flex items-center gap-3">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <audio controls src={`/api/media/${t.filePath}`} className="h-9 flex-1" />
                <span className="meta-text shrink-0">
                  {new Date(t.createdAt).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
