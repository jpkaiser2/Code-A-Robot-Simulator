import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.18),_transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.14),_transparent_30%),linear-gradient(180deg,_#020617,_#0f172a_48%,_#111827)] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm uppercase tracking-[0.34em] text-orange-300/80">
            Standalone Workspace
          </p>
          <h1 className="mb-4 text-5xl font-semibold tracking-tight text-white">
            Build FTC lesson robots and simulate them in one dedicated app
          </h1>
          <p className="mb-0 text-lg text-slate-300">
            This project was extracted into its own self-contained Next.js app so you can keep
            growing the teacher builder and simulator without Code-A-Robot baggage.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Link
            href="/simulator-builder"
            className="rounded-[28px] border border-orange-400/20 bg-orange-500/10 p-8 transition hover:border-orange-300/40 hover:bg-orange-500/15"
          >
            <div className="mb-3 text-sm uppercase tracking-[0.24em] text-orange-200/80">
              Teacher Builder
            </div>
            <div className="mb-3 text-3xl font-semibold text-white">Create Robot Lesson Drafts</div>
            <p className="mb-0 text-slate-200">
              Assemble robots from a component library, import custom parts, and generate lesson
              JSON drafts.
            </p>
          </Link>

          <Link
            href="/simulator-test"
            className="rounded-[28px] border border-cyan-400/20 bg-cyan-500/10 p-8 transition hover:border-cyan-300/40 hover:bg-cyan-500/15"
          >
            <div className="mb-3 text-sm uppercase tracking-[0.24em] text-cyan-200/80">
              Simulator
            </div>
            <div className="mb-3 text-3xl font-semibold text-white">Run The Current MVP</div>
            <p className="mb-0 text-slate-200">
              Open the standalone simulator runtime and builder-backed Java harness in the new app.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
