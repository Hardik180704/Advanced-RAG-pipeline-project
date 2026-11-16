import { useCallback, useRef, useState } from "react";
import { askStream, clearHistory, fetchStatus } from "../api";
import type { ChatMessage, PipelineStage, PipelineStatus, SourceRef } from "../types";

const SESSION_KEY = "memora-session";

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function now(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function loadSessionId(): string {
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const fresh = newId();
  localStorage.setItem(SESSION_KEY, fresh);
  return fresh;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [stage, setStage] = useState<PipelineStage>("idle");
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const sessionIdRef = useRef<string>(loadSessionId());
  const abortRef = useRef<AbortController | null>(null);

  const busy = stage !== "idle";

  const refreshStatus = useCallback(async () => {
    setStatus(await fetchStatus());
  }, []);

  const send = useCallback(
    (question: string) => {
      if (!question.trim() || busy) return;

      const startedAt = performance.now();
      const userMessage: ChatMessage = {
        id: newId(),
        role: "user",
        content: question.trim(),
        at: now(),
      };
      const assistantId = newId();
      const assistantPlaceholder: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        at: now(),
      };

      setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
      setStage("retrieving");

      const patch = (update: Partial<ChatMessage>) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, ...update } : m)),
        );

      abortRef.current = askStream(question.trim(), sessionIdRef.current, {
        onStatus: (next) => setStage(next),
        onToken: (token) =>
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + token } : m,
            ),
          ),
        onSources: (sources: SourceRef[]) => patch({ sources }),
        onDone: (payload) => {
          patch({
            sources: payload.sources,
            debug: payload.debug,
            duration: (performance.now() - startedAt) / 1000,
          });
          setStage("idle");
        },
        onError: (message) => {
          patch({ content: message, failed: true });
          setStage("idle");
        },
      });
    },
    [busy],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setStage("idle");
  }, []);

  const reset = useCallback(async () => {
    abortRef.current?.abort();
    await clearHistory(sessionIdRef.current);
    setMessages([]);
    setStage("idle");
  }, []);

  return { messages, stage, status, busy, send, stop, reset, refreshStatus };
}
