"use client";

import React from "react";
import { Check, Loader2, ChevronRight } from "lucide-react";
import { TraceStep } from "@/lib/api";

interface WorkflowGraphProps {
  traceSteps?: TraceStep[];
  isRunning?: boolean;
}

export const WorkflowGraph: React.FC<WorkflowGraphProps> = ({ traceSteps = [], isRunning = false }) => {
  const defaultSteps: { name: string; key: string }[] = [
    { name: "Retrieve", key: "Retrieval" },
    { name: "Rerank", key: "Reranking" },
    { name: "Grade Context", key: "Grade Context" },
    { name: "Rewrite Query", key: "Rewrite Query" },
    { name: "Generate Answer", key: "Generate" },
    { name: "Self-Correction", key: "Grade Answer" },
  ];

  const getStepStatus = (stepKey: string) => {
    const found = traceSteps.find((s) => s.step.toLowerCase() === stepKey.toLowerCase());
    if (found) {
      return {
        status: found.status,
        details: found.details,
        latency: found.latency_sec,
      };
    }

    if (isRunning) {
      const completedCount = traceSteps.length;
      const targetIndex = defaultSteps.findIndex((s) => s.key.toLowerCase() === stepKey.toLowerCase());
      if (targetIndex === completedCount) {
        return { status: "RUNNING", details: "Processing…", latency: 0 };
      }
    }
    return { status: "WAITING", details: "", latency: 0 };
  };

  const totalLatency = traceSteps.reduce((acc, curr) => acc + (curr.latency_sec || 0), 0);
  const completedStepsCount = traceSteps.filter((s) => s.status === "COMPLETED").length;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <p className="section-label">RAG Trace</p>
        <div className="flex items-center gap-1 text-[10px] text-[#64748b] font-mono">
          {isRunning ? (
            <span className="badge badge-accent text-[10px] animate-pulse">Running</span>
          ) : traceSteps.length > 0 ? (
            <span className="flex items-center gap-0.5 hover:text-[var(--primary)] transition-colors">
              {defaultSteps.length} steps · {totalLatency > 0 ? `${totalLatency.toFixed(1)}s` : "completed"}
              <ChevronRight className="w-3 h-3 text-[#94a3b8]" />
            </span>
          ) : (
            <span>Ready</span>
          )}
        </div>
      </div>

      {/* Timeline List */}
      <div className="flex flex-col relative pl-1">
        {defaultSteps.map((step, idx) => {
          const { status, details, latency } = getStepStatus(step.key);
          const isLast = idx === defaultSteps.length - 1;
          const isCompleted = status === "COMPLETED";
          const isCurrentRunning = status === "RUNNING";

          return (
            <div key={step.key} className="flex items-start gap-2.5 relative pb-3 group">
              {/* Connected vertical line */}
              {!isLast && (
                <div
                  className={`absolute left-[9px] top-[18px] bottom-0 w-[2px] transition-colors duration-200 ${
                    isCompleted ? "bg-[var(--primary)]" : "bg-[#e2e8f0]"
                  }`}
                />
              )}

              {/* Step indicator circle */}
              <div className="relative z-10 shrink-0 mt-0.5">
                {isCompleted ? (
                  <div className="w-5 h-5 rounded-full bg-[var(--primary)] text-white flex items-center justify-center shadow-2xs">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                ) : isCurrentRunning ? (
                  <div className="w-5 h-5 rounded-full border-2 border-[var(--primary)] bg-white flex items-center justify-center">
                    <Loader2 className="w-3 h-3 text-[var(--primary)] animate-spin" />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-[#cbd5e1] bg-white flex items-center justify-center" />
                )}
              </div>

              {/* Step content */}
              <div className="flex-1 min-w-0 flex items-start justify-between gap-1 leading-tight">
                <div className="min-w-0 pr-1">
                  <p className={`text-[12px] font-semibold truncate ${
                    isCompleted || isCurrentRunning ? "text-[#0f172a]" : "text-[#94a3b8]"
                  }`}>
                    {step.name}
                  </p>
                  {details && status !== "WAITING" ? (
                    <p className="text-[10px] text-[#64748b] truncate max-w-[170px] mt-0.5 font-mono">
                      {details}
                    </p>
                  ) : null}
                </div>

                {/* Latency on right */}
                <span className="text-[10px] font-mono text-[#64748b] shrink-0 mt-0.5">
                  {latency > 0 ? `${latency.toFixed(2)}s` : isCompleted ? "—" : ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
