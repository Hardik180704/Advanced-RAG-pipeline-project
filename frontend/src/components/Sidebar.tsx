import { Database, Layers, ScrollText } from "lucide-react";
import { useLibrary } from "../hooks/useFileUpload";
import type { PipelineStatus } from "../types";
import { LogoBadge } from "./Logo";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">{label}</span>
      <span className="truncate font-mono text-[11px] text-zinc-300" title={value}>
        {value}
      </span>
    </div>
  );
}

export function Sidebar({
  status,
  busy,
  onClear,
}: {
  status: PipelineStatus | null;
  busy: boolean;
  onClear: () => void;
}) {
  const library = useLibrary();
  const { summary, uploading, notice, armed, inputRef, open, handleFiles, requestReset } = library;

  const disabled = uploading || busy;
  let resetLabel = "Reset library";
  if (uploading) resetLabel = "Resetting disabled";
  else if (armed) resetLabel = "Click again to confirm";

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-white/[0.06] bg-panel/80 px-5 py-6">
      <div className="flex items-center gap-3">
        <LogoBadge />
        <div>
          <h1 className="text-[15px] font-semibold tracking-tight text-zinc-50">
            M<span className="brand-gradient bg-clip-text text-transparent">emora</span>
          </h1>
          <p className="text-[11px] text-zinc-500">Memory-grounded answers</p>
        </div>
      </div>

      <div className="mt-7 space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
        <Row label="Model" value={status?.model ?? "—"} />
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
            Vector store
          </span>
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-zinc-300">
            <Database className="size-3 text-indigo-300" />
            {status?.vector_db ?? "—"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
            Reranker
          </span>
          <span className="inline-flex items-center gap-1.5 truncate font-mono text-[11px] text-zinc-300">
            <Layers className="size-3 text-fuchsia-300/80" />
            {status?.reranker !== undefined ? status.reranker.split("(")[0].trim() : "—"}
          </span>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-zinc-500">
              <ScrollText className="size-3 text-zinc-500" />
              Library
            </p>
            <p className="mt-1.5 font-mono text-[11px] text-zinc-300">
              {summary
                ? `${summary.parents} parents · ${summary.children} chunks`
                : "loading"}
            </p>
          </div>
          <button
            onClick={open}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300/30 bg-indigo-300/[0.1] px-2.5 py-1.5 text-[11px] font-medium text-indigo-200 transition hover:bg-indigo-300/[0.2] disabled:opacity-50"
          >
            {uploading ? <Layers className="size-3.5 animate-pulse" /> : <span className="font-mono">+</span>}
            {uploading ? "Ingesting" : "Add"}
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        {notice && (
          <p
            className={`mt-3 text-[11px] leading-snug ${
              notice.ok ? "text-emerald-300/90" : "text-red-300/90"
            }`}
          >
            {notice.text}
          </p>
        )}

        {summary && summary.files.length > 0 && (
          <ul className="mt-3 max-h-28 space-y-1 overflow-y-auto pr-1">
            {summary.files.map((file) => (
              <li key={file} className="truncate font-mono text-[10.5px] text-zinc-500" title={file}>
                {file}
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-[10.5px] leading-snug text-zinc-600">
          Add your own PDF, DOCX or TXT. New documents are indexed incrementally,
          no full rebuild needed.
        </p>

        <button
          onClick={requestReset}
          disabled={disabled}
          className={`mt-3 w-full rounded-xl border px-3 py-2 text-[11px] font-medium transition disabled:opacity-40 ${
            armed
              ? "animate-pulse border-red-400/50 bg-red-400/[0.12] text-red-200"
              : "border-white/[0.06] text-zinc-500 hover:border-red-400/30 hover:bg-red-400/[0.06] hover:text-red-200"
          }`}
        >
          {resetLabel}
        </button>
        <p className="mt-1.5 text-[10px] leading-snug text-zinc-700">
          Deletes the vector index and chunk store. Source files in
          data/documents are kept.
        </p>
      </div>

      <button
        onClick={onClear}
        disabled={busy}
        className="mt-4 rounded-xl border border-white/[0.06] px-4 py-2.5 text-left text-xs font-medium text-zinc-400 transition hover:border-white/10 hover:bg-white/[0.03] hover:text-zinc-200 disabled:opacity-40"
      >
        Clear conversation
      </button>

      <div className="mt-auto">
        <p className="font-mono text-[10px] tracking-wide text-zinc-700">
          FastAPI · React · Docker · Kubernetes
        </p>
      </div>
    </aside>
  );
}
