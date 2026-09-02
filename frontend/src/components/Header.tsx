"use client";

import React from "react";
import { Brain, Trash2, FileCheck } from "lucide-react";

interface HeaderProps {
  onClearChat: () => void;
  hasMessages: boolean;
  activeDocName?: string;
}

export const Header: React.FC<HeaderProps> = ({ onClearChat, hasMessages, activeDocName }) => {
  return (
    <header className="w-full bg-white border-b border-[#e5ddd4] px-5 py-3 flex items-center justify-between sticky top-0 z-50 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#ea6c2a] flex items-center justify-center text-white">
          <Brain className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[15px] font-semibold text-[#1c1917] tracking-tight">
              Self-Correcting RAG Agent
            </h1>
            <span className="badge badge-accent text-[10px]">
              Ollama llama3.2 · Local &amp; Free
            </span>
          </div>
          <p className="text-[11px] text-[#a8a29e] mt-0 flex items-center gap-1.5">
            <span>LangGraph</span>
            <span className="opacity-40">·</span>
            <span>Cross-Encoder Reranking</span>
            <span className="opacity-40">·</span>
            <span>Multi-Chunking Eval</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {activeDocName && (
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#f0fdf4] border border-[#bbf7d0] text-[#16a34a] text-[11px] font-medium">
            <FileCheck className="w-3.5 h-3.5" />
            <span className="truncate max-w-[160px] font-mono">{activeDocName}</span>
          </div>
        )}

        {hasMessages && (
          <button
            onClick={onClearChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-[#fef2f2] border border-[#e5ddd4] hover:border-[#fecaca] text-[#78716c] hover:text-[#dc2626] text-[11px] font-medium transition-all duration-150"
            title="Clear Conversation"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Chat</span>
          </button>
        )}
      </div>
    </header>
  );
};
