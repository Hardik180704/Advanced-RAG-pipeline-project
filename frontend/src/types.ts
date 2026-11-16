export interface SourceRef {
  label: string;
  score: number | null;
  preview?: string;
}

export interface StageDoc {
  label: string;
  score: number | null;
  preview: string;
}

export interface DebugData {
  original_query?: string;
  generated_queries: string[];
  retrieved: StageDoc[];
  reranked: StageDoc[];
  final_context: StageDoc[];
}

export type PipelineStage = "idle" | "retrieving" | "answering";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  at: string;
  duration?: number;
  sources?: SourceRef[];
  debug?: DebugData;
  failed?: boolean;
}

export interface PipelineStatus {
  status: string;
  model: string;
  vector_db: string;
  reranker: string;
}

export interface IndexSummary {
  parents: number;
  children: number;
  files: string[];
}

export interface UploadResult {
  uploaded: string[];
  failed: { file: string; reason: string }[];
  added_children?: number;
  skipped_children?: number;
}

export interface AskStreamEvents {
  onStatus?: (stage: PipelineStage) => void;
  onSources?: (sources: SourceRef[]) => void;
  onToken: (token: string) => void;
  onDone: (payload: { sources: SourceRef[]; debug: DebugData }) => void;
  onError: (message: string) => void;
}
