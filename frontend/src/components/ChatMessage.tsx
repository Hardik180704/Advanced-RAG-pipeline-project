import { useState } from "react";
import { Check, Copy, FlaskConical, FileText } from "lucide-react";
import type { ChatMessage } from "../types";
import { Markdown } from "./Markdown";
import { LogoBadge } from "./Logo";

/** Turn "[1] ... [2]" citations inside answer text into small chips. */
function withCitations(content: string) {
  return content.split(/(\[\d+\])/g).map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/);
    return match ? (
      <span
        key={i}
        title={`Source ${match[1]}`}
        className="mx-0.5 inline-grid size-[18px] translate-y-[3px] cursor-default place-items-center rounded-md border border-indigo-300/35 bg-indigo-300/10 align-baseline font-mono text-[10px] text-indigo-200"
      >
        {match[1]}
      </span>
    ) : part ? (
      <Markdown key={i} text={part} />
    ) : null;
  });
}

function formatDuration(seconds: number): string {
  return seconds < 10 ? `${seconds.toFixed(1)}s` : `${Math.round(seconds)}s`;
}

export function UserTurn({ message }: { message: ChatMessage }) {
  return (
    <div className="animate-rise flex flex-col items-end gap-1">
      <div className="max-w-[78%] rounded-2xl rounded-br-md bg-gradient-to-br from-indigo-200 via-violet-200 to-fuchsia-200 px-4 py-3 text-[13.5px] leading-relaxed text-[#312e81] shadow-lg shadow-indigo-300/20 ring-1 ring-white/40">
        {message.content}
      </div>
      <span className="pr-1 font-mono text-[10px] text-zinc-600">{message.at}</span>
    </div>
  );
}

export function AssistantTurn({
  message,
  streaming,
  onOpenDebug,
}: {
  message: ChatMessage;
  streaming: boolean;
  onOpenDebug: (m: ChatMessage) => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const citations = Array.from(
    message.content.matchAll(/\[(\d+)\]/g),
    (m) => Number(m[1]),
  ).filter((n, i, arr) => arr.indexOf(n) === i);
  const showSources = citations.length > 0 && (message.sources?.length ?? 0) > 0;

  return (
    <div className="animate-rise group flex items-start gap-3">
      <div className="mt-0.5 shrink-0">
        <LogoBadge size="size-7" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 font-mono text-[10px] tracking-wide text-zinc-600">
          <span>Memora</span>
          <span aria-hidden="true" className="text-zinc-700">·</span>
          <span>{message.at}</span>
          {message.duration !== undefined && (
            <>
              <span aria-hidden="true" className="text-zinc-700">·</span>
              <span>{formatDuration(message.duration)}</span>
            </>
          )}
        </div>

        <div
          className={`mt-2 text-[13.5px] leading-relaxed ${
            message.failed ? "text-red-300" : "text-zinc-200"
          }`}
        >
          {withCitations(message.content)}
          {streaming && (
            <span className="animate-caret ml-0.5 inline-block h-3.5 w-[7px] rounded-[2px] bg-indigo-300 align-baseline" />
          )}
        </div>

        {showSources && message.debug && (
          <p className="mt-2 font-mono text-[10px] tracking-wide text-zinc-600">
            Answered from {message.sources!.length} chunk
            {message.sources!.length === 1 ? "" : "s"} · {message.debug.generated_queries.length}{" "}
            quer{message.debug.generated_queries.length === 1 ? "y" : "ies"}
          </p>
        )}

        {showSources && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {citations.map((n) => {
              const source = message.sources![n - 1];
              if (!source) return null;
              return (
                <span
                  key={n}
                  title={source.preview}
                  className="inline-flex cursor-default items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2 py-1 font-mono text-[10.5px] text-zinc-400 transition hover:border-indigo-300/40 hover:text-zinc-200"
                >
                  <FileText className="size-3 text-indigo-300/70" />
                  {source.label}
                </span>
              );
            })}
          </div>
        )}

        <div className="mt-1.5 flex items-center gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
          {message.content && (
            <button
              onClick={copy}
              aria-label="Copy answer"
              title="Copy answer"
              className="inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-[11px] font-medium text-zinc-600 transition hover:bg-white/[0.05] hover:text-zinc-300"
            >
              {copied ? (
                <Check className="size-3 text-emerald-400" />
              ) : (
                <Copy className="size-3" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          )}
          {message.debug && (
            <button
              onClick={() => onOpenDebug(message)}
              className="inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-[11px] font-medium text-zinc-600 transition hover:bg-white/[0.05] hover:text-indigo-300"
            >
              <FlaskConical className="size-3.5" />
              Debug trace
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
