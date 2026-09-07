type StatusStyle = {
  color: string;
  bg: string;
  border: string;
  pulse?: boolean;
};

// Exact semantic palette: pending (neutral), running (neon blue, pulsing),
// done (neon teal), failed (neon red-pink). Everything else maps onto the
// closest of these four so new pipeline states stay visually consistent.
const STATUS_STYLES: Record<string, StatusStyle> = {
  pending: { color: "var(--status-pending)", bg: "var(--status-pending-bg)", border: "var(--status-pending-border)" },
  queued: { color: "var(--status-pending)", bg: "var(--status-pending-bg)", border: "var(--status-pending-border)" },
  draft: { color: "var(--status-pending)", bg: "var(--status-pending-bg)", border: "var(--status-pending-border)" },

  running: { color: "var(--status-running)", bg: "var(--status-running-bg)", border: "var(--status-running-border)", pulse: true },
  in_progress: { color: "var(--status-running)", bg: "var(--status-running-bg)", border: "var(--status-running-border)", pulse: true },
  image_ready: { color: "var(--status-running)", bg: "var(--status-running-bg)", border: "var(--status-running-border)" },
  video_ready: { color: "var(--status-running)", bg: "var(--status-running-bg)", border: "var(--status-running-border)" },
  upscaled: { color: "var(--status-running)", bg: "var(--status-running-bg)", border: "var(--status-running-border)" },

  done: { color: "var(--status-done)", bg: "var(--status-done-bg)", border: "var(--status-done-border)" },

  failed: { color: "var(--status-failed)", bg: "var(--status-failed-bg)", border: "var(--status-failed-border)" },

  archived: { color: "var(--text-tertiary)", bg: "rgba(91,100,120,0.12)", border: "rgba(91,100,120,0.3)" },
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  return (
    <span
      className="badge"
      style={{ background: style.bg, border: `1px solid ${style.border}`, color: style.color }}
    >
      <span
        className={`inline-flex h-1.5 w-1.5 rounded-full ${style.pulse ? "status-pulse" : ""}`}
        style={{ background: style.color }}
      />
      {status.replace(/_/g, " ")}
    </span>
  );
}
