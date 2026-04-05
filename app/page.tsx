import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-black px-5 py-12 sm:px-6 lg:px-8">
      <div className="flex w-full flex-col gap-12">
        <div className="max-w-4xl">
          <p className="mb-4 text-[11px] uppercase tracking-[0.34em] text-zinc-500">
            Standalone Workspace
          </p>
          <h1 className="mb-4 text-5xl font-semibold tracking-tight text-white sm:text-6xl">
            Build robots. Test code. Ship lessons.
          </h1>
          <p className="mb-0 max-w-2xl text-lg text-zinc-400">
            A focused workspace for assembling FTC lesson robots and running them in a clean
            browser simulator.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Link
            href="/simulator-builder"
            className="group rounded-[28px] border border-white/10 bg-[#050505] p-8 transition hover:border-white/20 hover:bg-[#090909]"
          >
            <div className="mb-8 flex items-start justify-between gap-4">
              <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">
                Builder
              </div>
              <div className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400 transition group-hover:text-white">
                Open
              </div>
            </div>
            <div className="mb-3 text-3xl font-semibold text-white">Create Lesson Drafts</div>
            <p className="mb-0 max-w-md text-zinc-400">
              Assemble robots from a reusable component library and generate clean lesson config
              data.
            </p>
          </Link>

          <Link
            href="/simulator-test"
            className="group rounded-[28px] border border-white/10 bg-[#050505] p-8 transition hover:border-white/20 hover:bg-[#090909]"
          >
            <div className="mb-8 flex items-start justify-between gap-4">
              <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">
                Simulator
              </div>
              <div className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400 transition group-hover:text-white">
                Open
              </div>
            </div>
            <div className="mb-3 text-3xl font-semibold text-white">Run The Simulator</div>
            <p className="mb-0 max-w-md text-zinc-400">
              Write Java, use the controller, and test the robot in a focused three-pane runtime.
            </p>
          </Link>
        </div>

        <div className="grid gap-4 border-t border-white/10 pt-8 text-sm text-zinc-500 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-[#050505] p-5">
            Component-based builder
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#050505] p-5">
            Shared simulator runtime
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#050505] p-5">
            Browser-based code testing
          </div>
        </div>
      </div>
    </div>
  );
}
