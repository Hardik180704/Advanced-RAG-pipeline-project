import type { AskStreamEvents, IndexSummary, PipelineStatus, SourceRef, UploadResult } from "./types";

/**
 * POST /api/ask/stream and parse the server-sent event response.
 *
 * The browser exposes the SSE stream as a normal ReadableStream, which we
 * split into "event:" / "data:" frames and dispatch to the caller.
 *
 * Returns an AbortController so the caller can stop generation mid-answer.
 */
export function askStream(
  question: string,
  sessionId: string,
  events: AskStreamEvents,
): AbortController {
  const controller = new AbortController();

  (async () => {
    try {
      const response = await fetch("/api/ask/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, session_id: sessionId }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const detail = await summarizeError(response);
        events.onError(detail);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          dispatch(frame, events);
          boundary = buffer.indexOf("\n\n");
        }
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        events.onError("Connection failed. Is the API running?");
      }
    }
  })();

  return controller;
}

function dispatch(frame: string, events: AskStreamEvents): void {
  let event = "message";
  let data = "";
  for (const line of frame.split("\n")) {
    if (line.startsWith("event: ")) event = line.slice(7).trim();
    if (line.startsWith("data: ")) data += line.slice(6);
  }
  if (!data) return;

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(data);
  } catch {
    return;
  }

  if (event === "status") events.onStatus?.(payload.stage as never);
  if (event === "token") events.onToken(payload.t as string);
  if (event === "sources") events.onSources?.(payload.sources as SourceRef[]);
  if (event === "done")
    events.onDone({
      sources: payload.sources as SourceRef[],
      debug: payload.debug as never,
    });
  if (event === "error") events.onError(payload.message as string);
}

async function summarizeError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return (body.detail as string) ?? `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

export async function fetchStatus(): Promise<PipelineStatus | null> {
  try {
    const response = await fetch("/api/status");
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function clearHistory(sessionId: string): Promise<void> {
  await fetch(`/api/history?session_id=${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });
}

export async function fetchDocuments(): Promise<IndexSummary | null> {
  try {
    const response = await fetch("/api/documents");
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function uploadDocuments(files: File[]): Promise<UploadResult> {
  const body = new FormData();
  for (const file of files) body.append("files", file);

  const response = await fetch("/api/documents", { method: "POST", body });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      (payload?.detail as string) ?? `Upload failed (${response.status})`,
    );
  }
  return payload as UploadResult;
}

export async function resetLibrary(): Promise<void> {
  const response = await fetch("/api/documents?confirm=true", {
    method: "DELETE",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      (payload?.detail as string) ?? `Reset failed (${response.status})`,
    );
  }
}
