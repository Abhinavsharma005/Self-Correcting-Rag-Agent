const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export interface Citation {
  page: number;
  source: string;
  snippet: string;
}

export interface TraceStep {
  step: string;
  status: "COMPLETED" | "RUNNING" | "FAILED" | "SKIPPED" | "WAITING";
  latency_sec: number;
  details: string;
}

export interface QueryResponse {
  doc_id: string;
  query: string;
  chunking_strategy_used: string;
  answer: string;
  citations: Citation[];
  context_grade: {
    score: number;
    is_relevant: boolean;
    reasoning: string;
  };
  answer_grade: {
    score: number;
    is_grounded: boolean;
    reasoning: string;
  };
  self_correction_triggered: boolean;
  retry_count: number;
  trace_steps: TraceStep[];
  latency_breakdown: Record<string, number>;
}

export interface UploadResponse {
  doc_id: string;
  filename: string;
  file_size_mb: number;
  num_pages: number;
  total_chunks: number;
  chunk_stats: Record<string, { num_chunks: number; avg_chunk_len: number; indexing_latency_sec: number }>;
  evaluation: any;
}

export interface StatsResponse {
  document: {
    doc_id?: string;
    filename?: string;
    num_pages?: number;
    file_size_mb?: number;
  };
  evaluation: any;
}

export async function uploadPdf(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(err.detail || "Upload failed");
  }
  return res.json();
}

export async function sendQuery(
  docId: string,
  query: string,
  chunkingStrategy?: string,
  useReranker: boolean = true
): Promise<QueryResponse> {
  const res = await fetch(`${API_BASE}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      doc_id: docId,
      query,
      chunking_strategy: chunkingStrategy,
      use_reranker: useReranker,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Query failed" }));
    throw new Error(err.detail || "Query failed");
  }
  return res.json();
}

export async function fetchStats(docId?: string): Promise<StatsResponse> {
  const url = docId ? `${API_BASE}/stats/${docId}` : `${API_BASE}/stats`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

export function getPdfUrl(docId: string): string {
  return `${API_BASE}/document/${docId}`;
}
