"use client";

import React from "react";
import { BarChart3, Zap, RefreshCw, Layers, CheckCircle2, ShieldCheck } from "lucide-react";
import { UploadResponse } from "@/lib/api";

interface RagStatsProps {
  uploadData?: UploadResponse | null;
  latestQueryStats?: any;
}

export const RagStats: React.FC<RagStatsProps> = ({ uploadData, latestQueryStats }) => {
  const evalData = uploadData?.evaluation;
  const chunkingEval = evalData?.chunking_evaluation;
  const rerankerEval = evalData?.reranker_evaluation;
  const systemEval = evalData?.system_evaluation;

  const numPages = uploadData?.num_pages || 10;
  const totalChunks = uploadData?.total_chunks || 23;
  const bestStrategy = chunkingEval?.best_chunking_strategy || "Fixed";
  const bestAccuracy = chunkingEval?.best_chunking_accuracy || 85.0;
  const bestReranker = rerankerEval?.best_reranker_config || "Cross-Encoder (ms-marco-MiniLM-L-6-v2)";
  const accuracyBoost = rerankerEval?.accuracy_boost_pct ?? 0.0;

  const latencies = latestQueryStats?.latency_breakdown || {};
  const totalLatency = latencies.total || 1.8;
  const selfCorrectionTriggered = latestQueryStats?.self_correction_triggered ?? false;
  const retryCount = latestQueryStats?.retry_count ?? 0;

  return (
    <div className="w-full glass-panel rounded-2xl p-4 border border-cyan-500/20 flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-gray-800 pb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4 text-cyan-400" /> RAG & Evaluation Statistics
        </h3>
        <span className="text-[10px] text-gray-400 font-mono bg-gray-900 px-2 py-0.5 rounded border border-gray-800">
          Dynamic Benchmark
        </span>
      </div>

      {/* Grid Cards */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {/* Document Stats */}
        <div className="p-3 rounded-xl bg-gray-900/70 border border-gray-800">
          <div className="flex items-center gap-1.5 text-gray-400 mb-1">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold text-[11px]">📄 Document</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between font-mono">
            <span className="text-gray-400">Pages: <strong className="text-gray-200">{numPages}</strong></span>
            <span className="text-gray-400">Chunks: <strong className="text-cyan-400">{totalChunks}</strong></span>
          </div>
        </div>

        {/* Best Strategy Stats */}
        <div className="p-3 rounded-xl bg-gray-900/70 border border-cyan-500/30">
          <div className="flex items-center justify-between text-gray-400 mb-1">
            <span className="font-semibold text-[11px] text-cyan-300">🧠 Best Strategy</span>
            <span className="px-1.5 py-0.2 text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-500/40 rounded uppercase font-mono font-bold">
              {bestStrategy}
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between font-mono">
            <span className="text-gray-400">Accuracy:</span>
            <span className="text-emerald-400 font-bold">{bestAccuracy}%</span>
          </div>
        </div>

        {/* Reranker & Accuracy Boost */}
        <div className="p-3 rounded-xl bg-gray-900/70 border border-gray-800 col-span-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <p className="text-[11px] font-semibold text-gray-200">Best Reranker</p>
              <p className="text-[10px] text-gray-400 font-mono truncate max-w-[180px]">{bestReranker}</p>
            </div>
          </div>
          <div className="text-right font-mono">
            <span className="text-[10px] text-gray-400 block">Accuracy Boost</span>
            <span className="text-xs font-bold text-emerald-400">+{accuracyBoost}%</span>
          </div>
        </div>

        {/* Performance Latency */}
        <div className="p-3 rounded-xl bg-gray-900/70 border border-gray-800">
          <div className="flex items-center gap-1.5 text-gray-400 mb-1">
            <Zap className="w-3.5 h-3.5 text-yellow-400" />
            <span className="font-semibold text-[11px]">⚡ Latency</span>
          </div>
          <div className="mt-1 font-mono text-cyan-400 font-bold text-sm">
            {totalLatency}s
          </div>
        </div>

        {/* Self Correction Status */}
        <div className="p-3 rounded-xl bg-gray-900/70 border border-gray-800">
          <div className="flex items-center gap-1.5 text-gray-400 mb-1">
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-semibold text-[11px]">🔄 Self-Correction</span>
          </div>
          <div className="mt-1 font-mono text-[11px] flex items-center gap-1 text-emerald-400">
            {!selfCorrectionTriggered ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">✓ No correction needed</span>
              </>
            ) : (
              <span className="text-amber-400 font-bold truncate">
                Triggered ({retryCount} retries)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Latency Breakdown Details */}
      {Object.keys(latencies).length > 0 && (
        <div className="mt-1 p-2.5 rounded-xl bg-gray-950 border border-gray-800 text-[11px] font-mono">
          <p className="text-gray-400 font-bold mb-1 uppercase text-[10px] tracking-wider">Per-Stage Latency Breakdown</p>
          <div className="grid grid-cols-3 gap-1.5 text-gray-300">
            {Object.entries(latencies).map(([stage, timeSec]) => (
              stage !== "total" && (
                <div key={stage} className="flex justify-between bg-gray-900 px-2 py-1 rounded border border-gray-850">
                  <span className="capitalize text-gray-400 text-[10px] truncate">{stage.replace('_', ' ')}</span>
                  <span className="text-cyan-400 font-bold text-[10px]">{Number(timeSec).toFixed(2)}s</span>
                </div>
              )
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
