"use client";

import React from "react";
import { GitBranch, CheckCircle2, Loader2, AlertTriangle, Circle } from "lucide-react";
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
    { name: "Query Rewrite", key: "Rewrite Query" },
    { name: "Generate", key: "Generate" },
    { name: "Grade Answer", key: "Grade Answer" },
  ];

  const getStepStatus = (stepKey: string) => {
    const found = traceSteps.find((s) => s.step.toLowerCase() === stepKey.toLowerCase());
    if (found) return { status: found.status, details: found.details, latency: found.latency_sec };

    if (isRunning) {
      // Find index of last completed step
      const completedCount = traceSteps.length;
      const targetIndex = defaultSteps.findIndex((s) => s.key.toLowerCase() === stepKey.toLowerCase());
      if (targetIndex === completedCount) {
        return { status: "RUNNING", details: "Processing node...", latency: 0 };
      }
    }
    return { status: "WAITING", details: "Waiting", latency: 0 };
  };

  return (
    <div className="w-full glass-panel rounded-2xl p-4 border border-cyan-500/20 flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-gray-800 pb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
          <GitBranch className="w-4 h-4 text-cyan-400" /> LangGraph Self-Correction Visualizer
        </h3>
        <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
          State Graph Active
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {defaultSteps.map((step, idx) => {
          const { status, details, latency } = getStepStatus(step.key);

          let icon = <Circle className="w-3.5 h-3.5 text-gray-600" />;
          let statusBadge = "bg-gray-900 text-gray-500 border-gray-800";

          if (status === "COMPLETED") {
            icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
            statusBadge = "bg-emerald-950/80 text-emerald-300 border-emerald-500/40";
          } else if (status === "RUNNING") {
            icon = <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />;
            statusBadge = "bg-cyan-950/80 text-cyan-300 border-cyan-500/40 glow-cyan";
          } else if (status === "FAILED") {
            icon = <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
            statusBadge = "bg-amber-950/80 text-amber-300 border-amber-500/40";
          }

          return (
            <div
              key={step.key}
              className={`flex items-center justify-between p-2.5 rounded-xl border transition-all duration-200 ${
                status === "RUNNING"
                  ? "bg-cyan-950/30 border-cyan-500/40"
                  : status === "COMPLETED"
                  ? "bg-gray-900/60 border-gray-800"
                  : "bg-gray-950/40 border-gray-850 opacity-60"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-mono text-gray-500 w-4">{idx + 1}.</span>
                {icon}
                <div>
                  <p className="text-xs font-semibold text-gray-200">{step.name}</p>
                  {details && status !== "WAITING" && (
                    <p className="text-[10px] text-gray-400 font-mono truncate max-w-[200px]">{details}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {latency > 0 && (
                  <span className="text-[10px] text-cyan-400 font-mono">{latency.toFixed(2)}s</span>
                )}
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${statusBadge}`}>
                  {status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
