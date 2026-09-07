import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { importScript } from "@/app/actions/shots";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await db.project.findUnique({
    where: { id },
    include: { shots: { orderBy: { index: "asc" } } },
  });

  if (!project) notFound();

  return (
    <div className="mx-auto max-w-4xl px-6 py-14">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors mb-6"
      >
        ← Projects
      </Link>

      <div className="mb-10">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
          {project.title}
        </h1>
        <div className="flex items-center gap-2.5 mt-3 meta-text">
          <StatusBadge status={project.status} />
          <span>
            {project.shots.length} shot{project.shots.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {project.shots.length === 0 ? (
        <form action={importScript} className="card p-6">
          <input type="hidden" name="projectId" value={project.id} />
          <p className="eyebrow mb-1">Step 1</p>
          <label className="block text-[15px] font-medium text-[var(--text-primary)] mb-3">
            Paste the full script
          </label>
          <textarea
            name="script"
            required
            rows={14}
            placeholder={"One line per shot/beat.\ne.g.\nYou think you can multitask.\nBut every switch costs you focus.\n..."}
            className="input w-full font-mono leading-relaxed"
          />
          <p className="text-sm text-[var(--text-tertiary)] mt-3 leading-relaxed">
            Each non-empty line becomes one shot, in order. You can re-import
            later to replace the breakdown — but that will delete any takes
            already generated for the current shots, so use it before you
            start generating, not after.
          </p>
          <button type="submit" className="btn-primary mt-4">
            Import script
          </button>
        </form>
      ) : (
        <div>
          <details className="card mb-6 p-5 text-sm group">
            <summary className="cursor-pointer text-[var(--text-secondary)] font-medium marker:content-none flex items-center gap-2">
              <span className="text-[var(--text-tertiary)] transition-transform group-open:rotate-90">
                ▸
              </span>
              Re-import script (replaces all shots below)
            </summary>
            <form action={importScript} className="mt-4">
              <input type="hidden" name="projectId" value={project.id} />
              <textarea
                name="script"
                required
                rows={10}
                defaultValue={project.script}
                className="input w-full font-mono leading-relaxed"
              />
              <button type="submit" className="btn-danger mt-4">
                Replace shots
              </button>
            </form>
          </details>

          <ul className="flex flex-col gap-3">
            {project.shots.map((shot, i) => (
              <li key={shot.id}>
                <Link
                  href={`/projects/${project.id}/shots/${shot.id}`}
                  className="list-card stagger-in flex items-start gap-4 px-5 py-4"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <span className="index-badge h-9 w-9 mt-0.5">{shot.index + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-[18px] font-semibold text-[var(--text-primary)] leading-snug tracking-tight">
                      {shot.scriptText}
                    </p>
                    <div className="flex items-center gap-2.5 mt-2.5 meta-text">
                      <StatusBadge status={shot.status} />
                      <span className="capitalize">{shot.kind}</span>
                      <span className="text-[var(--text-tertiary)]">·</span>
                      <span>{(shot.durationMs / 1000).toFixed(1)}s</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
