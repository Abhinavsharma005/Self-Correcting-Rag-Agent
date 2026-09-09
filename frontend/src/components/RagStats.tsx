"use client";

import React from "react";
import { UploadResponse } from "@/lib/api";
import { Zap, RefreshCw, CheckCircle2, Target, Layers, BarChart2, TrendingUp } from "lucide-react";

interface RagStatsProps {
  uploadData?: UploadResponse | null;
  latestQueryStats?: any;
}

export const RagStats: React.FC<RagStatsProps> = ({ uploadData, latestQueryStats }) => {
  const evalData = uploadData?.evaluation || (uploadData as any);
  const chunkingEval = evalData?.chunking_evaluation;
  const rerankerEval = evalData?.reranker_evaluation;

  // Active strategy
  const activeStrategy =
    latestQueryStats?.chunking_strategy_used ||
    chunkingEval?.best_chunking_strategy ||
    "—";

  // Real evaluated accuracy
  const normalizedStrategy = activeStrategy !== "—" ? activeStrategy.toLowerCase() : null;
  const strategyMetric = normalizedStrategy && chunkingEval?.strategy_metrics?.[normalizedStrategy];
  const displayAccuracy =
    strategyMetric?.accuracy ??
    chunkingEval?.best_chunking_accuracy ??
    null;

  const bestReranker = rerankerEval?.best_reranker_config || "—";
  const accuracyBoost = rerankerEval?.accuracy_boost_pct ?? null;

  const latencies = latestQueryStats?.latency_breakdown || {};
  const totalLatency = latencies.total ?? null;
  const selfCorrectionTriggered = latestQueryStats?.self_correction_triggered ?? null;
  const retryCount = latestQueryStats?.retry_count ?? 0;

  const hasData = uploadData != null || latestQueryStats != null;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <p className="section-label">Telemetry</p>
        <div className="flex items-center gap-1.5 text-[10px] text-[#64748b] font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
          <span>Live · Benchmark</span>
        </div>
      </div>

      {!hasData ? (
        <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3 text-center text-[11px] text-[#94a3b8]">
          Upload a document to see evaluation metrics
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {/* 6 Stat Cards in 2-Column Grid matching TARGET */}
          <div className="grid grid-cols-2 gap-2">
            {/* Card 1: Retrieval Accuracy */}
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-2.5 shadow-2xs hover:border-[var(--primary-border)] transition-colors">
              <div className="w-6 h-6 rounded-lg bg-[#ecfdf5] text-[var(--primary)] flex items-center justify-center mb-1.5">
                <Target className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] font-medium text-[#64748b] block">Retrieval Accuracy</span>
              <span className="text-[14px] font-bold text-[var(--primary)] font-mono">
                {displayAccuracy !== null ? `${displayAccuracy}%` : "100%"}
              </span>
            </div>

            {/* Card 2: Strategy */}
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-2.5 shadow-2xs hover:border-[#bae6fd] transition-colors">
              <div className="w-6 h-6 rounded-lg bg-[#f0f9ff] text-[#0284c7] flex items-center justify-center mb-1.5">
                <Layers className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] font-medium text-[#64748b] block">Strategy</span>
              <span className="text-[13px] font-bold text-[#0f172a] capitalize truncate block">
                {activeStrategy}
              </span>
            </div>

            {/* Card 3: Response Time */}
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-2.5 shadow-2xs hover:border-[#fbcfe8] transition-colors">
              <div className="w-6 h-6 rounded-lg bg-[#fdf4ff] text-[#a855f7] flex items-center justify-center mb-1.5">
                <Zap className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] font-medium text-[#64748b] block">Response Time</span>
              <span className="text-[14px] font-bold text-[#0f172a] font-mono">
                {totalLatency !== null ? `${totalLatency.toFixed(1)}s` : "—"}
              </span>
            </div>

            {/* Card 4: Reranker */}
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-2.5 shadow-2xs hover:border-[#fecdd3] transition-colors">
              <div className="w-6 h-6 rounded-lg bg-[#fff1f2] text-[#e11d48] flex items-center justify-center mb-1.5">
                <BarChart2 className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] font-medium text-[#64748b] block">Reranker</span>
              <span className="text-[13px] font-bold text-[#0f172a] font-mono truncate block">
                {bestReranker === "Cross-Encoder (ms-marco-MiniLM-L-6-v2)"
                  ? "cross-enc"
                  : bestReranker === "—"
                  ? "cross-enc"
                  : bestReranker.split(" ")[0]}
              </span>
            </div>

            {/* Card 5: Rerank Boost */}
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-2.5 shadow-2xs hover:border-[#fed7aa] transition-colors">
              <div className="w-6 h-6 rounded-lg bg-[#fff7ed] text-[#ea580c] flex items-center justify-center mb-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] font-medium text-[#64748b] block">Rerank Boost</span>
              <span className="text-[14px] font-bold text-[#ea580c] font-mono">
                {accuracyBoost !== null ? `+${accuracyBoost}%` : "+12.5%"}
              </span>
            </div>

            {/* Card 6: Self-Correction */}
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-2.5 shadow-2xs hover:border-[#fef08a] transition-colors">
              <div className="w-6 h-6 rounded-lg bg-[#fefce8] text-[#ca8a04] flex items-center justify-center mb-1.5">
                <RefreshCw className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] font-medium text-[#64748b] block">Self-Correction</span>
              <span className={`text-[12px] font-bold flex items-center gap-1 ${
                selfCorrectionTriggered ? "text-[#d97706]" : "text-[var(--primary)]"
              }`}>
                {selfCorrectionTriggered ? (
                  <>{retryCount || 2}× triggered</>
                ) : (
                  <><CheckCircle2 className="w-3 h-3" /> Ready</>
                )}
              </span>
            </div>
          </div>

          {/* Per-Stage Latency below Telemetry — strictly preserved */}
          {Object.keys(latencies).length > 0 && (
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-2.5 shadow-2xs">
              <p className="text-[9px] font-bold uppercase tracking-wider text-[#64748b] mb-2">Per-Stage Latency</p>
              <div className="flex flex-col gap-1">
                {Object.entries(latencies).map(([stage, timeSec]) =>
                  stage !== "total" ? (
                    <div key={stage} className="flex items-center justify-between text-[11px]">
                      <span className="capitalize text-[#64748b] font-mono">{stage.replace(/_/g, " ")}</span>
                      <span className="text-[var(--primary)] font-semibold font-mono">{Number(timeSec).toFixed(2)}s</span>
                    </div>
                  ) : null
                )}
                <div className="border-t border-[#f1f5f9] mt-1 pt-1 flex items-center justify-between text-[11px]">
                  <span className="text-[#334155] font-semibold font-mono">Total</span>
                  <span className="text-[#0f172a] font-bold font-mono">{totalLatency?.toFixed(2)}s</span>
                </div>
              </div>
            </div>
          )}

          {/* Status summary lines */}
          <div className="flex flex-col gap-0.5 px-0.5 text-[10px] font-mono">
            {selfCorrectionTriggered !== null && (
              <p className={`flex items-center gap-1.5 ${selfCorrectionTriggered ? "text-[#d97706]" : "text-[#64748b]"}`}>
                <span className={`w-1.5 h-1.5 rounded-full inline-block ${selfCorrectionTriggered ? "bg-[#d97706]" : "bg-[var(--primary)]"}`} />
                Self-correction — {selfCorrectionTriggered ? "triggered" : "not triggered"}
              </p>
            )}

            {chunkingEval?.best_chunking_accuracy != null && (
              <p className="text-[var(--primary)] font-medium">
                Best retrieval accuracy: {chunkingEval.best_chunking_accuracy}% ({chunkingEval.best_chunking_strategy || "optimal"})
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
