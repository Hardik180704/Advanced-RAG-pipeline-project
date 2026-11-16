import { useEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import type { ChatMessage } from "../types";
import { AssistantTurn, UserTurn } from "./ChatMessage";
import { LogoBadge } from "./Logo";
import { TypingIndicator } from "./TypingIndicator";

const SUGGESTIONS = [
  "What is the annual leave policy?",
  "How long is the refund window?",
  "Summarize the security policy.",
];

const CAPABILITIES = [
  "Multi-query rewriting",
  "Hybrid dense + BM25 retrieval",
  "RRF fusion",
  "Cross-encoder reranking",
  "Cited answers",
];

function EmptyState({ onPick }: { onPick: (question: string) => void }) {
  return (
    <div className="animate-fade flex h-full flex-col items-center justify-center gap-7 px-6 text-center">
      <div className="relative">
        <div className="absolute inset-0 scale-160 rounded-full bg-indigo-300/25 blur-3xl" />
        <div className="relative">
          <LogoBadge size="size-16" />
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          <span className="brand-gradient bg-clip-text text-transparent">Memora</span>
        </h1>
        <p className="mt-2 max-w-md text-balance text-[13.5px] leading-relaxed text-zinc-400">
          Ask your documents anything. Memora rewrites your question, searches
          meaning and keywords in parallel, fuses the results, reranks the best
          passages and answers with citations.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-2 text-[12px] text-zinc-400 transition hover:border-indigo-300/40 hover:bg-indigo-300/[0.08] hover:text-indigo-100"
          >
            {s}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-700">
        {CAPABILITIES.map((capability, i) => (
          <span key={capability} className="flex items-center gap-3">
            {i > 0 && <span aria-hidden="true">·</span>}
            {capability}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ChatWindow({
  messages,
  stage,
  onSend,
  onOpenDebug,
}: {
  messages: ChatMessage[];
  stage: "idle" | "retrieving" | "answering";
  onSend: (question: string) => void;
  onOpenDebug: (m: ChatMessage) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setPinned(distance < 80);
  };

  useEffect(() => {
    if (pinned) {
      const el = scrollRef.current;
      el?.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages, stage, pinned]);

  const last = messages[messages.length - 1];
  const showTyping = stage !== "idle" && last?.role === "assistant" && !last.content;

  return (
    <div className="relative h-full min-h-0 overflow-hidden">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto overscroll-contain"
      >
        {messages.length === 0 ? (
          <EmptyState onPick={onSend} />
        ) : (
          <div className="mx-auto w-full max-w-3xl space-y-8 px-8 pb-6 pt-8">
            {messages.map((m) => (
              <div key={m.id}>
                {m.role === "user" ? (
                  <UserTurn message={m} />
                ) : (
                  <>
                    {m === last && showTyping && <TypingIndicator stage={stage} />}
                    {(m.content || m !== last) && (
                      <AssistantTurn
                        message={m}
                        streaming={m === last && stage !== "idle"}
                        onOpenDebug={onOpenDebug}
                      />
                    )}
                    {m !== last && <div className="mt-8 h-px bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />}
                  </>
                )}
              </div>
            ))}
            <div className="h-px" />
          </div>
        )}
      </div>

      {/* Edge fades: content dissolves into the canvas at both ends */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-canvas to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10 bg-gradient-to-t from-canvas to-transparent" />

      {!pinned && messages.length > 0 && (
        <button
          onClick={() => {
            const el = scrollRef.current;
            el?.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
            setPinned(true);
          }}
          aria-label="Jump to latest"
          className="animate-fade absolute bottom-14 left-1/2 z-20 grid size-9 -translate-x-1/2 place-items-center rounded-full border border-white/10 bg-panel/95 text-zinc-300 shadow-xl shadow-black/40 backdrop-blur transition hover:border-indigo-300/40 hover:text-indigo-200"
        >
          <ArrowDown className="size-4" />
        </button>
      )}
    </div>
  );
}
