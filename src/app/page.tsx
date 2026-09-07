import Link from "next/link";
import { db } from "@/lib/db";
import { createProject, deleteProject } from "./actions/projects";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function Home() {
  const projects = await db.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { shots: true } } },
  });

  return (
    <div className="mx-auto max-w-4xl px-6 py-14">
      <div className="mb-10">
        <p className="eyebrow mb-2">Local production pipeline</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
          Projects
        </h1>
        <p className="text-[15px] text-[var(--text-tertiary)] mt-2 max-w-md">
          One project per video. Each project owns a script and its shot
          breakdown.
        </p>
      </div>

      <form action={createProject} className="card mb-12 flex gap-3 p-3">
        <input
          name="title"
          required
          placeholder="New project title (e.g. Why Your Brain Lies to You)"
          className="input flex-1"
        />
        <button type="submit" className="btn-primary shrink-0">
          Create project
        </button>
      </form>

      {projects.length === 0 ? (
        <div className="card border-dashed p-14 text-center">
          <p className="text-[var(--text-secondary)] font-medium">No projects yet</p>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">
            Create your first one above to get started.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {projects.map((p, i) => (
            <li
              key={p.id}
              className="list-card stagger-in flex items-center gap-4 px-5 py-4"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span className="index-badge h-10 w-10 text-sm">
                {p.title.trim().charAt(0).toUpperCase() || "?"}
              </span>
              <Link href={`/projects/${p.id}`} className="flex-1 min-w-0">
                <div className="font-display text-[18px] font-semibold text-[var(--text-primary)] truncate tracking-tight">
                  {p.title}
                </div>
                <div className="flex items-center gap-2.5 mt-2 meta-text">
                  <StatusBadge status={p.status} />
                  <span>
                    {p._count.shots} shot{p._count.shots === 1 ? "" : "s"}
                  </span>
                  <span className="text-[var(--text-tertiary)]">·</span>
                  <span>
                    updated{" "}
                    {new Date(p.updatedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </Link>
              <form action={deleteProject}>
                <input type="hidden" name="id" value={p.id} />
                <button
                  type="submit"
                  className="btn-ghost"
                  aria-label={`Delete ${p.title}`}
                >
                  Delete
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
