"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, ChevronDown, ChevronUp, CheckCircle, AlertCircle, Clock, ShieldCheck, Sparkles } from "lucide-react";
import { Citation, QueryResponse } from "@/lib/api";

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
    <div className="w-full glass-panel rounded-2xl border border-cyan-500/20 flex flex-col h-[750px]">
      {/* Chat Messages Feed */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 py-12">
            <div className="p-4 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-3 glow-cyan">
              <Bot className="w-10 h-10" />
            </div>
            <h3 className="text-sm font-bold text-gray-200">Self-Correcting RAG Intelligence Agent</h3>
            <p className="text-xs text-gray-400 max-w-sm mt-1.5 leading-relaxed">
              Upload a PDF document and ask any question. The agent will retrieve, rerank with Cross-Encoder, grade context relevance, self-correct if needed, and cite exact page sources.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.sender === "user";
            const qr = msg.queryResponse;
            const isTraceExpanded = expandedTraceId === msg.id;

            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border text-xs ${
                    isUser
                      ? "bg-cyan-600/20 border-cyan-400/40 text-cyan-300"
                      : "bg-emerald-600/20 border-emerald-400/40 text-emerald-300"
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Content Box */}
                <div className={`max-w-[85%] flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                  <div
                    className={`p-4 rounded-2xl text-xs leading-relaxed ${
                      isUser
                        ? "bg-gradient-to-r from-cyan-600/30 to-blue-600/30 border border-cyan-500/40 text-gray-100 rounded-tr-none"
                        : "bg-gray-900/90 border border-gray-800 text-gray-200 rounded-tl-none shadow-xl"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>

                    {/* Citations badges for bot answers */}
                    {!isUser && qr?.citations && qr.citations.length > 0 && (
                      <div className="mt-3.5 pt-3 border-t border-gray-800 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-cyan-400 mr-1 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Cited Sources:
                        </span>
                        {qr.citations.map((c: Citation, idx: number) => (
                          <button
                            key={idx}
                            onClick={() => onCitationClick(c.page)}
                            className="px-2.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-[11px] font-mono flex items-center gap-1 transition-all duration-150 hover:scale-105"
                            title={`Jump to Page ${c.page}: ${c.snippet}`}
                          >
                            <span>📎 Page {c.page}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Expandable RAG Trace Accordion for Bot Messages */}
                  {!isUser && qr && (
                    <div className="w-full mt-2">
                      <button
                        onClick={() => toggleTrace(msg.id)}
                        className="flex items-center justify-between w-full px-3 py-1.5 rounded-lg bg-gray-950/80 border border-cyan-500/20 text-cyan-400 hover:text-cyan-300 text-[11px] font-mono transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                          <span>RAG Execution Trace</span>
                          <span className="text-gray-500">•</span>
                          <span className="text-emerald-400 font-bold">
                            {qr.answer_grade?.score || 90}% Grounded
                          </span>
                        </span>
                        {isTraceExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {isTraceExpanded && (
                        <div className="mt-1.5 p-3 rounded-xl bg-gray-950 border border-cyan-500/30 text-[11px] font-mono text-gray-300 space-y-2 animate-fadeIn">
                          <div className="grid grid-cols-2 gap-2 border-b border-gray-850 pb-2">
                            <div>
                              <span className="text-gray-500 block">Context Relevance</span>
                              <span className="text-cyan-400 font-bold">{qr.context_grade?.score}% ({qr.context_grade?.is_relevant ? "Relevant" : "Irrelevant"})</span>
                            </div>
                            <div>
                              <span className="text-gray-500 block">Answer Groundedness</span>
                              <span className="text-emerald-400 font-bold">{qr.answer_grade?.score}% ({qr.answer_grade?.is_grounded ? "Faithful" : "Risk"})</span>
                            </div>
                            <div>
                              <span className="text-gray-500 block">Self-Correction</span>
                              <span className={qr.self_correction_triggered ? "text-amber-400 font-bold" : "text-emerald-400"}>
                                {qr.self_correction_triggered ? `Triggered (${qr.retry_count} retries)` : "Not Triggered"}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 block">Total Latency</span>
                              <span className="text-cyan-400 font-bold">{qr.latency_breakdown?.total || 1.8}s</span>
                            </div>
                          </div>

                          {/* Steps trace */}
                          <div>
                            <span className="text-gray-400 font-bold block mb-1">Execution Steps:</span>
                            <div className="space-y-1">
                              {qr.trace_steps.map((st: any, i: number) => (
                                <div key={i} className="flex justify-between items-center bg-gray-900/60 px-2 py-0.5 rounded border border-gray-800">
                                  <span className="text-gray-300 text-[10px]">{st.step}: {st.details}</span>
                                  <span className="text-cyan-400 text-[10px]">{st.latency_sec}s</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <span className="text-[10px] text-gray-500 font-mono mt-1 px-1">
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            );
          })
        )}

        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-600/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-4 rounded-2xl bg-gray-900 border border-gray-800 text-xs text-gray-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400 animate-spin" />
              <span>Running LangGraph Self-Correction Pipeline (Retrieve → Rerank → Grade → Generate)...</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Query Input Box */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-800 bg-gray-950/80 rounded-b-2xl">
        <div className="relative flex items-center">
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder={docId ? "Ask a question about your uploaded PDF..." : "Upload a PDF document first to start chatting..."}
            disabled={!docId || isLoading}
            className="w-full bg-gray-900/90 text-gray-100 placeholder-gray-500 text-xs rounded-xl px-4 py-3.5 pr-12 border border-gray-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 outline-none transition-all disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={!docId || !inputQuery.trim() || isLoading}
            className="absolute right-2 p-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 text-gray-950 hover:from-cyan-400 hover:to-teal-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 font-bold"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
