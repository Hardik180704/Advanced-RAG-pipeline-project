import { useEffect, useRef, useState } from "react";
import { ArrowUp, Square } from "lucide-react";

export function MessageInput({
  busy,
  className = "",
  onSend,
  onStop,
}: {
  busy: boolean;
  className?: string;
  onSend: (question: string) => void;
  onStop: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");
  const canSend = !busy && value.trim().length > 0;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const submit = () => {
    const el = ref.current;
    if (!canSend) {
      el?.focus();
      return;
    }
    const question = value.trim();
    setValue("");
    el!.value = "";
    el!.focus();
    onSend(question);
  };

  return (
    <div className={`mx-auto w-full max-w-3xl px-6 pb-5 ${className}`}>
      <div className="relative rounded-2xl p-px">
        <div
          className={`pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-300 ${
            canSend || busy
              ? "opacity-100 bg-gradient-to-r from-indigo-300/45 via-violet-300/40 to-fuchsia-300/35"
              : "opacity-60 bg-white/[0.07]"
          }`}
        />
        <div className="relative flex items-end gap-2 rounded-2xl bg-panel p-2 shadow-2xl shadow-black/50">
          <textarea
            ref={ref}
            rows={1}
            value={value}
            maxLength={1000}
            placeholder={busy ? "Memora is thinking…" : "Ask your documents anything"}
            className="max-h-40 flex-1 resize-none bg-transparent px-3 py-2.5 text-[13.5px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          {busy ? (
            <button
              onClick={onStop}
              aria-label="Stop generating"
              title="Stop generating"
              className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-zinc-300 transition hover:bg-white/[0.09]"
            >
              <Square className="size-3.5 fill-current" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!canSend}
              aria-label="Send"
              title="Send (Enter)"
              className={`grid size-9 shrink-0 place-items-center rounded-xl transition active:scale-95 ${
                canSend
                  ? "brand-gradient text-[#312e81] shadow-lg shadow-indigo-300/25 hover:opacity-90"
                  : "bg-white/[0.05] text-zinc-600"
              }`}
            >
              <ArrowUp className="size-4" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 flex items-center justify-center gap-2 text-center text-[10.5px] text-zinc-700">
        <span>Enter to send · Shift+Enter for a new line</span>
        <span aria-hidden="true">·</span>
        <span>citations link to their sources</span>
      </p>
    </div>
  );
}
