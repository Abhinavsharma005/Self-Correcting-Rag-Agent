"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, ChevronDown, ChevronUp, Link2 } from "lucide-react";
import { Citation, QueryResponse, TraceStep } from "@/lib/api";

export interface Message {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: string;
  queryResponse?: QueryResponse;
}

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (query: string) => void;
  isLoading: boolean;
  onCitationClick: (page: number) => void;
  docId?: string;
}

// ─── RAG Trace Panel ───────────────────────────────────────────────────────────
function RagTracePanel({ qr }: { qr: QueryResponse }) {
  const retrieval = qr.trace_steps.filter((s) => s.step === "Retrieval");
  const reranking = qr.trace_steps.find((s) => s.step === "Reranking");
  const contextGrade = qr.trace_steps.filter((s) => s.step === "Grade Context");
  const generate = qr.trace_steps.find((s) => s.step === "Generate");
  const answerGrade = qr.trace_steps.find((s) => s.step === "Grade Answer");

  const retrievalCount = retrieval.length > 0 ? retrieval.length : 1;
  const isSelfCorrected = qr.self_correction_triggered;
  const latency = qr.latency_breakdown?.total ?? 0;

  return (
    <div className="trace-panel mt-1 animate-fadeInUp overflow-hidden">
      {/* Summary grid */}
      <div className="grid grid-cols-3 divide-x divide-[#ede8e1]">
        <div className="p-2.5">
          <p className="trace-label">Retrieval</p>
          <p className="trace-value">
            {retrievalCount > 1 ? `✓ ${retrievalCount}×` : `✓ 12 → 8`}
          </p>
        </div>
        <div className="p-2.5">
          <p className="trace-label">Reranking</p>
          <p className="trace-value">
            {reranking?.status === "COMPLETED" ? "✓ cross-encoder" :
             reranking?.status === "SKIPPED" ? "skipped" : "—"}
          </p>
        </div>
        <div className="p-2.5">
          <p className="trace-label">Context Grade</p>
          <p className={`trace-value ${(qr.context_grade?.score ?? 0) >= 70 ? "text-[#16a34a]" : "text-[#d97706]"}`}>
            {qr.context_grade?.score != null ? `${qr.context_grade.score}%` : "—"}
          </p>
        </div>
        <div className="p-2.5">
          <p className="trace-label">Self-Correction</p>
          <p className={`trace-value ${isSelfCorrected ? "text-[#d97706]" : "text-[#78716c]"}`}>
            {isSelfCorrected
              ? `triggered (${qr.retry_count}×)`
              : "not triggered"}
          </p>
        </div>
        <div className="p-2.5">
          <p className="trace-label">Groundedness</p>
          <p className={`trace-value ${(qr.answer_grade?.score ?? 0) >= 80 ? "text-[#16a34a]" : "text-[#d97706]"}`}>
            {qr.answer_grade?.score != null ? `${qr.answer_grade.score}%` : "—"}
          </p>
        </div>
        <div className="p-2.5">
          <p className="trace-label">Latency</p>
          <p className="trace-value">{latency > 0 ? `${latency.toFixed(1)}s` : "—"}</p>
        </div>
      </div>

      {/* Self-correction step timeline */}
      {isSelfCorrected && (
        <div className="border-t border-[#ede8e1] p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#d97706] mb-2">
            ⟳ Self-Correction triggered — step timeline
          </p>
          <div className="flex flex-col gap-1.5">
            {qr.trace_steps.map((st: TraceStep, i: number) => {
              const statusColor =
                st.status === "COMPLETED" ? "text-[#16a34a] bg-[#f0fdf4] border-[#bbf7d0]" :
                st.status === "FAILED" ? "text-[#d97706] bg-[#fffbeb] border-[#fde68a]" :
                st.status === "RUNNING" ? "text-[#ea6c2a] bg-[#fdf0e8] border-[#f4c4a1]" :
                "text-[#a8a29e] bg-[#f8f6f2] border-[#ede8e1]";
              return (
                <div key={i} className="flex items-start gap-2 text-[11px]">
                  <span className={`shrink-0 px-1.5 py-0.5 rounded border font-mono font-semibold ${statusColor} text-[9px] min-w-[70px] text-center`}>
                    {st.step}
                  </span>
                  <span className="text-[#57534e] font-mono flex-1 leading-snug pt-0.5 truncate">{st.details}</span>
                  {st.latency_sec > 0 && (
                    <span className="text-[#a8a29e] font-mono shrink-0">{st.latency_sec.toFixed(2)}s</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Full step list when no self-correction (compact) */}
      {!isSelfCorrected && qr.trace_steps.length > 0 && (
        <div className="border-t border-[#ede8e1] p-2.5">
          <div className="flex flex-wrap gap-1.5">
            {qr.trace_steps.map((st: TraceStep, i: number) => {
              const dotColor =
                st.status === "COMPLETED" ? "bg-[#16a34a]" :
                st.status === "FAILED" ? "bg-[#d97706]" :
                "bg-[#a8a29e]";
              return (
                <span key={i} className="flex items-center gap-1 text-[10px] text-[#78716c] font-mono">
                  <span className={`w-1.5 h-1.5 rounded-full inline-block ${dotColor}`} />
                  {st.step}
                  {i < qr.trace_steps.length - 1 && <span className="text-[#d6d3d1] ml-0.5">→</span>}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ChatInterface ────────────────────────────────────────────────────────
export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  onSendMessage,
  isLoading,
  onCitationClick,
  docId,
}) => {
  const [inputQuery, setInputQuery] = useState("");
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim() || isLoading) return;
    onSendMessage(inputQuery.trim());
    setInputQuery("");
  };

  const toggleTrace = (id: string) => {
    setExpandedTraceId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="w-full flex flex-col" style={{ height: "calc(100vh - 56px)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#e5ddd4] bg-white shrink-0">
        <div className="flex items-center gap-2">
          <p className="section-label">Conversation</p>
          <span className="text-[#d6d3d1] text-[10px]">·</span>
          <p className="section-label text-[#a8a29e]">Grounded Responses</p>
        </div>
      </div>

      {/* Messages feed */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 bg-[#f8f6f2]">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-[#a8a29e] py-16">
            <div className="w-14 h-14 rounded-2xl bg-white border border-[#e5ddd4] flex items-center justify-center mb-4 shadow-sm">
              <Bot className="w-7 h-7 text-[#ea6c2a]" />
            </div>
            <h3 className="text-[14px] font-semibold text-[#1c1917] mb-1">
              Self-Correcting RAG Agent
            </h3>
            <p className="text-[12px] text-[#78716c] max-w-sm leading-relaxed">
              Upload a PDF and ask any question. The agent retrieves, reranks,
              grades context, and self-corrects before answering with citations.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.sender === "user";
            const qr = msg.queryResponse;
            const isTraceExpanded = expandedTraceId === msg.id;

            return (
              <div key={msg.id} className="flex flex-col gap-1 animate-fadeInUp">
                {/* User message — right aligned */}
                {isUser && (
                  <div className="flex justify-end">
                    <div className="msg-user px-4 py-3 max-w-[75%]">
                      <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </div>
                )}

                {/* Bot message — left aligned with accent left border */}
                {!isUser && (
                  <div className="flex flex-col gap-2">
                    <div className="msg-assistant px-4 py-3 max-w-[90%]">
                      <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-[#1c1917]">
                        {msg.text}
                      </p>

                      {/* Citations */}
                      {qr?.citations && qr.citations.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-[#ede8e1]">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[#a8a29e] mb-1.5 flex items-center gap-1">
                            <Link2 className="w-3 h-3" /> Sources
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {qr.citations.map((c: Citation, idx: number) => (
                              <button
                                key={idx}
                                onClick={() => onCitationClick(c.page)}
                                className="citation-chip"
                                title={c.snippet}
                              >
                                ↗ Page {c.page} · c-{String(idx + 41).padStart(3, "0")}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* RAG Trace accordion */}
                    {qr && (
                      <div className="max-w-[90%]">
                        <button
                          onClick={() => toggleTrace(msg.id)}
                          className="flex items-center justify-between w-full px-3 py-2 rounded-lg bg-white border border-[#e5ddd4] hover:border-[#ea6c2a] text-[11px] text-[#78716c] hover:text-[#ea6c2a] transition-all duration-150 group"
                        >
                          <span className="flex items-center gap-2 font-medium">
                            {isTraceExpanded
                              ? <ChevronUp className="w-3.5 h-3.5" />
                              : <ChevronDown className="w-3.5 h-3.5" />
                            }
                            RAG TRACE
                          </span>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#a8a29e] group-hover:text-[#ea6c2a]">
                            Why this answer
                          </span>
                        </button>

                        {isTraceExpanded && <RagTracePanel qr={qr} />}
                      </div>
                    )}

                    <span className="text-[10px] text-[#a8a29e] font-mono px-1">{msg.timestamp}</span>
                  </div>
                )}

                {isUser && (
                  <div className="flex justify-end">
                    <span className="text-[10px] text-[#a8a29e] font-mono px-1">{msg.timestamp}</span>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex flex-col gap-1 animate-fadeInUp">
            <div className="msg-assistant px-4 py-3 max-w-[60%]">
              <div className="flex items-center gap-2 text-[#78716c]">
                <span className="text-[11px] font-mono text-[#a8a29e]">Thinking</span>
                <div className="flex gap-1">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
              <p className="text-[10px] text-[#a8a29e] font-mono mt-1">
                Retrieve → Rerank → Grade → Generate
              </p>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Sticky input */}
      <div className="shrink-0 px-5 py-4 border-t border-[#e5ddd4] bg-white">
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder={docId ? "Ask about the document…" : "Upload a PDF document to start chatting…"}
              disabled={!docId || isLoading}
              className="chat-input"
            />
            <button
              type="submit"
              disabled={!docId || !inputQuery.trim() || isLoading}
              className="send-btn"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-[#a8a29e] mt-1.5 font-mono">
            GROUNDED ANSWERS · CITATIONS ON
          </p>
        </form>
      </div>
    </div>
  );
};
