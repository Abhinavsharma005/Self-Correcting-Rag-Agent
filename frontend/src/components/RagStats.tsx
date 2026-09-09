"use client";

import React from "react";
import { UploadResponse } from "@/lib/api";
import { Zap, RefreshCw, CheckCircle2 } from "lucide-react";

interface RagStatsProps {
  uploadData?: UploadResponse | null;
  latestQueryStats?: any;
}

export const RagStats: React.FC<RagStatsProps> = ({ uploadData, latestQueryStats }) => {
  const evalData = uploadData?.evaluation || (uploadData as any);
  const chunkingEval = evalData?.chunking_evaluation;
  const rerankerEval = evalData?.reranker_evaluation;

  // Active strategy: use the strategy executed in the live query if available;
  // otherwise use the best evaluated chunking strategy from benchmark.
  const activeStrategy =
    latestQueryStats?.chunking_strategy_used ||
    chunkingEval?.best_chunking_strategy ||
    "—";

  // Real evaluated accuracy: look up the specific chunking strategy's accuracy
  // in strategy_metrics, falling back to best_chunking_accuracy, never hardcoding 100%.
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
      <div className="flex items-center justify-between mb-2">
        <p className="section-label">Telemetry</p>
        {hasData && (
          <span className="text-[10px] text-[#a8a29e] font-mono">live · benchmark</span>
        )}
      </div>

      {!hasData ? (
        <div className="surface-secondary p-4 text-center text-[11px] text-[#a8a29e]">
          Upload a document to see evaluation metrics
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Row 1: Strategy + Retrieval Accuracy */}
          <div className="grid grid-cols-2 gap-2">
            <div className="stat-cell">
              <span className="stat-label">Strategy</span>
              <span className="stat-value capitalize">{activeStrategy}</span>
            </div>
            <div className="stat-cell">
              <span className="stat-label">Retrieval Accuracy</span>
              <span className="stat-value accent">
                {displayAccuracy !== null ? `${displayAccuracy}%` : "—"}
              </span>
            </div>
          </div>

          {/* Row 2: Response Latency + Reranker */}
          <div className="grid grid-cols-2 gap-2">
            <div className="stat-cell">
              <span className="stat-label flex items-center gap-1">
                <Zap className="w-3 h-3" /> Response
              </span>
              <span className="stat-value">
                {totalLatency !== null ? `${totalLatency.toFixed(1)}s` : "—"}
              </span>
            </div>
            <div className="stat-cell">
              <span className="stat-label">Reranker</span>
              <span className="stat-value text-[12px] font-mono">
                {bestReranker === "Cross-Encoder (ms-marco-MiniLM-L-6-v2)"
                  ? "cross-enc"
                  : bestReranker === "—"
                  ? "—"
                  : bestReranker.split(" ")[0]}
              </span>
            </div>
          </div>

          {/* Row 3: Accuracy boost + self-correction */}
          {(accuracyBoost !== null || selfCorrectionTriggered !== null) && (
            <div className="grid grid-cols-2 gap-2">
              {accuracyBoost !== null && (
                <div className="stat-cell">
                  <span className="stat-label">Rerank Boost</span>
                  <span className="stat-value accent">+{accuracyBoost}%</span>
                </div>
              )}
              {selfCorrectionTriggered !== null && (
                <div className="stat-cell">
                  <span className="stat-label flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Self-Corr.
                  </span>
                  <span className={`text-[12px] font-semibold flex items-center gap-1 ${selfCorrectionTriggered ? "text-[#d97706]" : "text-[#16a34a]"}`}>
                    {selfCorrectionTriggered ? (
                      <>{retryCount}× triggered</>
                    ) : (
                      <><CheckCircle2 className="w-3.5 h-3.5" /> Not triggered</>
                    )}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Latency breakdown */}
          {Object.keys(latencies).length > 0 && (
            <div className="surface-secondary p-2.5 mt-0.5">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#a8a29e] mb-1.5">Per-Stage Latency</p>
              <div className="flex flex-col gap-1">
                {Object.entries(latencies).map(([stage, timeSec]) =>
                  stage !== "total" ? (
                    <div key={stage} className="flex items-center justify-between text-[11px]">
                      <span className="capitalize text-[#78716c] font-mono">{stage.replace(/_/g, " ")}</span>
                      <span className="text-[#ea6c2a] font-semibold font-mono">{Number(timeSec).toFixed(2)}s</span>
                    </div>
                  ) : null
                )}
                <div className="border-t border-[#ede8e1] mt-1 pt-1 flex items-center justify-between text-[11px]">
                  <span className="text-[#57534e] font-semibold font-mono">Total</span>
                  <span className="text-[#1c1917] font-bold font-mono">{totalLatency?.toFixed(2)}s</span>
                </div>
              </div>
            </div>
          )}

          {/* Self-correction status line */}
          {selfCorrectionTriggered !== null && (
            <p className={`text-[11px] font-medium flex items-center gap-1.5 px-1 ${selfCorrectionTriggered ? "text-[#d97706]" : "text-[#78716c]"}`}>
              <span className={`w-1.5 h-1.5 rounded-full inline-block ${selfCorrectionTriggered ? "bg-[#d97706]" : "bg-[#a8a29e]"}`} />
              Self-correction — {selfCorrectionTriggered ? "triggered" : "not triggered"}
            </p>
          )}

          {chunkingEval?.best_chunking_accuracy != null && (
            <p className="text-[11px] text-[#ea6c2a] font-medium px-1">
              Best retrieval accuracy: {chunkingEval.best_chunking_accuracy}% ({chunkingEval.best_chunking_strategy || "optimal"})
            </p>
          )}
        </div>
      )}
    </div>
  );
};
