import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";
import { useChat } from "./hooks/useChat";
import { Sidebar } from "./components/Sidebar";
import { ChatWindow } from "./components/ChatWindow";
import { MessageInput } from "./components/MessageInput";
import { DebugDrawer } from "./components/DebugDrawer";
import type { ChatMessage } from "./types";

export default function App() {
  const { messages, stage, status, busy, send, stop, reset, refreshStatus } = useChat();
  const [debugMessage, setDebugMessage] = useState<ChatMessage | null>(null);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar status={status} busy={busy} onClear={reset} />

      <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between border-b border-white/[0.05] px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/50" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[12px] font-medium text-zinc-400">
              {status ? "Pipeline ready" : "Connecting"}
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 font-mono text-[10.5px] text-zinc-500">
            <FlaskConical className="size-3 text-indigo-300" />
            rewrite · hybrid · rrf · rerank
          </span>
        </header>

        <div className="min-h-0 flex-1">
          <ChatWindow
            messages={messages}
            stage={stage}
            onSend={send}
            onOpenDebug={setDebugMessage}
          />
        </div>

        <MessageInput className="shrink-0" busy={busy} onSend={send} onStop={stop} />
      </main>

      <DebugDrawer message={debugMessage} onClose={() => setDebugMessage(null)} />
    </div>
  );
}
