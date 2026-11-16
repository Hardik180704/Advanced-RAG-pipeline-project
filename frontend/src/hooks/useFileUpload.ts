import { useCallback, useEffect, useRef, useState } from "react";
import { fetchDocuments, resetLibrary, uploadDocuments } from "../api";
import type { IndexSummary } from "../types";

export interface UploadNotice {
  ok: boolean;
  text: string;
}

/**
 * Owns the document-library state: the index summary, upload progress, the
 * result notice, and the two-step destructive reset (first click arms the
 * button with a 4 s fuse, second click wipes the index).
 */
export function useLibrary() {
  const [summary, setSummary] = useState<IndexSummary | null>(null);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<UploadNotice | null>(null);
  const [armed, setArmed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const armTimer = useRef<number | undefined>(undefined);

  const refresh = useCallback(async () => {
    setSummary(await fetchDocuments());
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 30000);
    return () => window.clearInterval(id);
  }, [refresh]);

  useEffect(() => () => window.clearTimeout(armTimer.current), []);

  const open = useCallback(() => inputRef.current?.click(), []);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || uploading) return;
      setUploading(true);
      setNotice(null);
      try {
        const result = await uploadDocuments(Array.from(files));
        const added = result.added_children ?? 0;
        const skipped = result.skipped_children ?? 0;
        const parts = [`+${added} chunk${added === 1 ? "" : "s"} indexed`];
        if (skipped > 0) parts.push(`${skipped} duplicate${skipped === 1 ? "" : "s"} skipped`);
        if (result.failed.length > 0) parts.push(`${result.failed.length} rejected`);
        setNotice({ ok: true, text: parts.join(" · ") });
        await refresh();
      } catch (error) {
        setNotice({ ok: false, text: (error as Error).message });
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [refresh, uploading],
  );

  const disarm = useCallback(() => {
    setArmed(false);
    window.clearTimeout(armTimer.current);
  }, []);

  const requestReset = useCallback(async () => {
    if (!armed) {
      setArmed(true);
      armTimer.current = window.setTimeout(() => setArmed(false), 4000);
      return;
    }

    disarm();
    try {
      await resetLibrary();
      await refresh();
      setNotice({
        ok: true,
        text: "Library cleared. Uploaded source files are kept on disk.",
      });
    } catch (error) {
      setNotice({ ok: false, text: (error as Error).message });
    }
  }, [armed, disarm, refresh]);

  return { summary, uploading, notice, armed, inputRef, open, handleFiles, requestReset };
}

export type Library = ReturnType<typeof useLibrary>;
