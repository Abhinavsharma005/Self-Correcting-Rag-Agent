"use client";

import React from "react";
import { Cpu, Trash2, ShieldCheck, Sparkles } from "lucide-react";

interface HeaderProps {
  onClearChat: () => void;
  hasMessages: boolean;
  activeDocName?: string;
}

export const Header: React.FC<HeaderProps> = ({ onClearChat, hasMessages, activeDocName }) => {
  return (
    <header className="w-full glass-panel border-b border-cyan-500/20 px-6 py-3.5 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/40 text-cyan-400 glow-cyan">
          <Cpu className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent tracking-tight">
              Self-Correcting RAG Agent
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-cyan-950/80 text-cyan-400 border border-cyan-500/30 rounded-full flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Gemini 3.6 Flash
            </span>
          </div>
          <p className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
            <span>LangGraph Agent</span> • <span>Cross-Encoder Reranking</span> • <span>Multi-Chunking Eval</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {activeDocName && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-900/80 border border-emerald-500/30 text-emerald-400 text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="font-mono truncate max-w-[180px]">{activeDocName}</span>
          </div>
        )}

        {hasMessages && (
          <button
            onClick={onClearChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs transition-colors duration-200"
            title="Clear Chat Conversation"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Chat</span>
          </button>
        )}
      </div>
    </header>
  );
};
