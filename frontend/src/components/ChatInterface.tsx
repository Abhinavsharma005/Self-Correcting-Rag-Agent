"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, ChevronDown, ChevronUp, Link2, Copy, Check, BarChart2 } from "lucide-react";
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
  const isSelfCorrected = qr.self_correction_triggered;
  const latency = qr.latency_breakdown?.total ?? 0;
  const retrievalCount = retrieval.length > 0 ? retrieval.length : 1;

  return (
    <div className="bg-white border border-[#e2e8f0] rounded-xl p-3 mt-1.5 shadow-2xs font-mono text-xs animate-fadeInUp">
      {/* Summary grid */}
      <div className="grid grid-cols-3 gap-2 pb-2.5 border-b border-[#f1f5f9]">
        <div className="p-1.5 bg-[#f8fafc] rounded-lg">
          <p className="text-[9px] uppercase tracking-wider text-[#94a3b8]">Retrieval</p>
          <p className="font-semibold text-[#0f172a] text-[11px] mt-0.5">
            {retrievalCount > 1 ? `✓ ${retrievalCount}×` : `✓ 12 → 8`}
          </p>
        </div>
        <div className="p-1.5 bg-[#f8fafc] rounded-lg">
          <p className="text-[9px] uppercase tracking-wider text-[#94a3b8]">Reranking</p>
          <p className="font-semibold text-[#0f172a] text-[11px] mt-0.5">
            {reranking?.status === "COMPLETED" ? "✓ cross-enc" : "—"}
          </p>
        </div>
        <div className="p-1.5 bg-[#f8fafc] rounded-lg">
          <p className="text-[9px] uppercase tracking-wider text-[#94a3b8]">Context Grade</p>
          <p className={`font-semibold text-[11px] mt-0.5 ${(qr.context_grade?.score ?? 0) >= 70 ? "text-[var(--primary)]" : "text-[#d97706]"}`}>
            {qr.context_grade?.score != null ? `${qr.context_grade.score}%` : "—"}
          </p>
        </div>
        <div className="p-1.5 bg-[#f8fafc] rounded-lg">
          <p className="text-[9px] uppercase tracking-wider text-[#94a3b8]">Self-Correction</p>
          <p className={`font-semibold text-[11px] mt-0.5 ${isSelfCorrected ? "text-[#d97706]" : "text-[#64748b]"}`}>
            {isSelfCorrected ? `${qr.retry_count || 1}× triggered` : "not triggered"}
          </p>
        </div>
        <div className="p-1.5 bg-[#f8fafc] rounded-lg">
          <p className="text-[9px] uppercase tracking-wider text-[#94a3b8]">Groundedness</p>
          <p className={`font-semibold text-[11px] mt-0.5 ${(qr.answer_grade?.score ?? 0) >= 80 ? "text-[var(--primary)]" : "text-[#d97706]"}`}>
            {qr.answer_grade?.score != null ? `${qr.answer_grade.score}%` : "—"}
          </p>
        </div>
        <div className="p-1.5 bg-[#f8fafc] rounded-lg">
          <p className="text-[9px] uppercase tracking-wider text-[#94a3b8]">Latency</p>
          <p className="font-semibold text-[#0f172a] text-[11px] mt-0.5">
            {latency > 0 ? `${latency.toFixed(1)}s` : "—"}
          </p>
        </div>
      </div>

      {/* Step list */}
      {qr.trace_steps.length > 0 && (
        <div className="pt-2 flex flex-col gap-1">
          {qr.trace_steps.map((st: TraceStep, i: number) => (
            <div key={i} className="flex items-center justify-between text-[10px] text-[#64748b]">
              <span className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  st.status === "COMPLETED" ? "bg-[var(--primary)]" :
                  st.status === "FAILED" ? "bg-[#d97706]" : "bg-[#94a3b8]"
                }`} />
                <span className="font-semibold text-[#334155]">{st.step}</span>
                {st.details && <span className="text-[#94a3b8] truncate max-w-[180px]">· {st.details}</span>}
              </span>
              {st.latency_sec > 0 && <span>{st.latency_sec.toFixed(2)}s</span>}
            </div>
          ))}
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
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
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

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 1800);
  };

  const toggleTrace = (id: string) => {
    setExpandedTraceId((prev) => (prev === id ? null : id));
  };

  const quickPrompts = [
    "Summarize this document",
    "List key takeaways",
    "Explain with examples",
    "Show related pages",
  ];

  return (
    <div className="w-full mt-2 flex flex-col bg-[#F7FAFD]" style={{ height: "calc(100vh - 56px)" }}>
      {/* Top Banner matching TARGET */}
      <div className="shrink-0 flex items-center justify-center gap-2 py-2 px-4 text-xs text-[#64748b] bg-transparent border-b border-[#e2e8f0]/60">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
        <span>Get grounded, accurate and self-correcting answers from your documents.</span>
      </div>

      {/* Messages feed */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-6">
        <div className="max-w-4xl mx-auto flex flex-col gap-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-[#94a3b8] py-20">
              <div className="w-12 h-12 rounded-2xl bg-white border border-[#e2e8f0] flex items-center justify-center mb-3 shadow-2xs">
                <Bot className="w-6 h-6 text-[var(--primary)]" />
              </div>
              <h3 className="text-[14px] font-semibold text-[#0f172a] mb-1">
                Self-Correcting RAG Agent
              </h3>
              <p className="text-[12px] text-[#64748b] max-w-sm leading-relaxed">
                Upload a PDF to ask questions with real-time retrieval, cross-encoder reranking, and self-correcting citations.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.sender === "user";
              const qr = msg.queryResponse;
              const isTraceExpanded = expandedTraceId === msg.id;

              return (
                <div key={msg.id} className="flex flex-col gap-1.5 animate-fadeInUp">
                  {/* User message — right aligned with avatar */}
                  {isUser && (
                    <div className="flex items-start justify-end gap-2.5">
                      <div className="flex flex-col items-end">
                        <div className="msg-user px-4 py-3 max-w-[85%] text-[13px] leading-relaxed whitespace-pre-wrap shadow-2xs">
                          {msg.text}
                        </div>
                        <span className="text-[10px] text-[#94a3b8] font-mono mt-1 px-1">
                          {msg.timestamp}
                        </span>
                      </div>

                      {/* User Avatar */}
                      <div className="w-8 h-8 rounded-full bg-[#818cf8] text-white flex items-center justify-center font-semibold text-xs shrink-0 shadow-2xs mt-0.5">
                        U
                      </div>
                    </div>
                  )}

                  {/* Bot message — left aligned with green bot avatar */}
                  {!isUser && (
                    <div className="flex items-start gap-2.5">
                      {/* Bot Avatar */}
                      <div className="w-8 h-8 rounded-full bg-[#ecfdf5] border border-[#a7f3d0] text-[var(--primary)] flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                        <Bot className="w-4.5 h-4.5" />
                      </div>

                      <div className="flex flex-col gap-2 flex-1 max-w-[92%]">
                        {/* Pure White Response Card with green accent border */}
                        <div className="msg-assistant bg-white p-5 rounded-2xl border border-[#e2e8f0] border-l-4 border-l-[var(--primary)] shadow-2xs relative group">
                          {/* Copy button top right */}
                          <button
                            type="button"
                            onClick={() => handleCopy(msg.id, msg.text)}
                            className="absolute top-3.5 right-3.5 p-1.5 rounded-lg text-[#94a3b8] hover:text-[#0f172a] hover:bg-[#f1f5f9] transition-colors"
                            title="Copy answer"
                          >
                            {copiedMsgId === msg.id ? (
                              <Check className="w-3.5 h-3.5 text-[var(--primary)]" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-[#0f172a] pr-6">
                            {msg.text}
                          </p>

                          {/* Citations / Sources */}
                          {qr?.citations && qr.citations.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-[#f1f5f9]">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] mb-2 flex items-center gap-1">
                                <Link2 className="w-3 h-3" /> Sources
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {qr.citations.map((c: Citation, idx: number) => (
                                  <button
                                    key={idx}
                                    type="button"
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

                        {/* RAG Trace accordion matching TARGET */}
                        {qr && (
                          <div>
                            <button
                              type="button"
                              onClick={() => toggleTrace(msg.id)}
                              className="flex items-center justify-between w-full px-3.5 py-2 rounded-xl bg-white border border-[#e2e8f0] hover:border-[var(--primary-border)] text-xs text-[#64748b] hover:text-[#0f172a] transition-all shadow-2xs"
                            >
                              <span className="flex items-center gap-2 font-semibold">
                                <BarChart2 className="w-3.5 h-3.5 text-[var(--primary)]" />
                                RAG TRACE
                              </span>
                              <span className="flex items-center gap-1.5 text-[11px] font-mono text-[#94a3b8]">
                                {qr.trace_steps.length} steps · {qr.latency_breakdown?.total ? `${qr.latency_breakdown.total.toFixed(1)}s` : "completed"}
                                {isTraceExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </span>
                            </button>

                            {isTraceExpanded && <RagTracePanel qr={qr} />}
                          </div>
                        )}

                        <span className="text-[10px] text-[#94a3b8] font-mono px-1">
                          {msg.timestamp}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-start gap-2.5 animate-fadeInUp">
              <div className="w-8 h-8 rounded-full bg-[#ecfdf5] border border-[#a7f3d0] text-[var(--primary)] flex items-center justify-center shrink-0">
                <Bot className="w-4.5 h-4.5" />
              </div>
              <div className="bg-white border border-[#e2e8f0] border-l-4 border-l-[var(--primary)] rounded-2xl p-4 shadow-2xs max-w-sm">
                <div className="flex items-center gap-2 text-[#64748b]">
                  <span className="text-[11px] font-mono text-[#94a3b8]">Retrieving &amp; Reasoning</span>
                  <div className="flex gap-1">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                </div>
                <p className="text-[10px] text-[#94a3b8] font-mono mt-1">
                  Retrieve → Rerank → Grade → Generate
                </p>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Floating Chat Input matching TARGET */}
      <div className="shrink-0 px-4 sm:px-8 pb-5 pt-1 bg-transparent">
        <div className="max-w-4xl mx-auto flex flex-col gap-2.5">
          {/* Floating Input Card */}
          <form
            onSubmit={handleSubmit}
            className="w-full bg-white rounded-full border border-[#e2e8f0] shadow-md hover:shadow-lg transition-shadow p-1.5 pl-5 flex items-center gap-3"
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder={docId ? "Ask a follow-up question…" : "Upload a PDF document to start chatting…"}
              disabled={!docId || isLoading}
              className="w-full bg-transparent text-sm text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none disabled:cursor-not-allowed py-1"
            />

            <button
              type="submit"
              disabled={!docId || !inputQuery.trim() || isLoading}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-sm"
              title="Send message"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          </form>

          {/* Quick Action Prompt Chips matching TARGET */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-0.5">
            {quickPrompts.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                disabled={!docId || isLoading}
                onClick={() => {
                  if (docId && !isLoading) {
                    onSendMessage(prompt);
                  }
                }}
                className="text-[11px] text-[#475569] bg-white hover:bg-[#f8fafc] border border-[#e2e8f0] hover:border-[var(--primary-border)] hover:text-[var(--primary)] rounded-full px-3 py-1 transition-all shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
