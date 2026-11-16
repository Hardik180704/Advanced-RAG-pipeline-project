export function TypingIndicator({ stage }: { stage: string }) {
  return (
    <div className="animate-fade flex items-center gap-3 pl-1 pt-1">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 animate-bounce rounded-full bg-indigo-300/80"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
      <span className="text-[11.5px] text-zinc-500">
        {stage === "retrieving" ? "Searching your documents" : "Composing the answer"}
      </span>
    </div>
  );
}
