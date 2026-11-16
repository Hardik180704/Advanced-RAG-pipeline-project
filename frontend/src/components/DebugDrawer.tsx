import { Search, SlidersHorizontal, X } from "lucide-react";
import type { ChatMessage, StageDoc } from "../types";

function StepRow({ doc }: { doc: StageDoc }) {
  return (
    <li className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate font-mono text-[11px] text-zinc-300" title={doc.label}>
          {doc.label}
        </span>
        {doc.score !== null && doc.score !== undefined && (
          <span
            className={`shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[10px] ${
              doc.score >= 0
                ? "bg-emerald-400/10 text-emerald-300"
                : "bg-zinc-400/10 text-zinc-400"
            }`}
          >
            {doc.score.toFixed(2)}
          </span>
        )}
      </div>
      <p className="mt-2 line-clamp-3 text-[11.5px] leading-relaxed text-zinc-500">
        {doc.preview}
      </p>
    </li>
  );
}

function Step({
  icon,
  title,
  docs,
}: {
  icon: React.ReactNode;
  title: string;
  docs: StageDoc[];
}) {
  return (
    <section className="mt-6">
      <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {icon}
        {title}
        <span className="ml-auto font-mono text-[10px] normal-case text-zinc-700">
          {docs.length}
        </span>
      </h3>
      <ul className="space-y-2">
        {docs.map((doc, i) => (
          <StepRow key={`${title}-${i}`} doc={doc} />
        ))}
      </ul>
    </section>
  );
}

export function DebugDrawer({
  message,
  onClose,
}: {
  message: ChatMessage | null;
  onClose: () => void;
}) {
  const debug = message?.debug;

  return (
    <div
      className={`fixed inset-0 z-50 transition ${
        message ? "pointer-events-auto" : "pointer-events-none"
      }`}
      aria-hidden={!message}
    >
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          message ? "opacity-100" : "opacity-0"
        }`}
      />
      <aside
        className={`absolute right-0 top-0 flex h-full w-[410px] max-w-[92vw] flex-col border-l border-white/[0.08] bg-panel shadow-2xl transition-transform duration-300 ease-out ${
          message ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Pipeline trace</h2>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              What Memora did to answer this question
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close debug panel"
            className="grid size-8 place-items-center rounded-lg border border-white/[0.06] text-zinc-400 transition hover:bg-white/[0.04] hover:text-zinc-200"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {debug && (
            <>
              {debug.generated_queries.length > 0 && (
                <section className="mt-2">
                  <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    <Search className="size-3.5" />
                    Generated queries
                    <span className="ml-auto font-mono text-[10px] normal-case text-zinc-700">
                      {debug.generated_queries.length}
                    </span>
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {debug.generated_queries.map((query, i) => (
                      <span
                        key={i}
                        className="rounded-lg border border-indigo-300/25 bg-indigo-300/[0.08] px-2 py-1 text-[11px] text-indigo-200"
                      >
                        {query}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              <Step
                icon={<SlidersHorizontal className="size-3.5" />}
                title="Retrieved (RRF fused)"
                docs={debug.retrieved}
              />
              <Step
                icon={<SlidersHorizontal className="size-3.5" />}
                title="Reranked"
                docs={debug.reranked}
              />
              <Step
                icon={<SlidersHorizontal className="size-3.5" />}
                title="Final context"
                docs={debug.final_context}
              />
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
