"use client";

import React from "react";
import { CheckCircle2, Loader2, AlertTriangle, Circle } from "lucide-react";
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
      const completedCount = traceSteps.length;
      const targetIndex = defaultSteps.findIndex((s) => s.key.toLowerCase() === stepKey.toLowerCase());
      if (targetIndex === completedCount) {
        return { status: "RUNNING", details: "Processing…", latency: 0 };
      }
    }
    return { status: "WAITING", details: "", latency: 0 };
  };

  const hasActivity = traceSteps.length > 0 || isRunning;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <p className="section-label">LangGraph Trace</p>
        {isRunning && (
          <span className="badge badge-accent text-[10px] animate-pulse">Running</span>
        )}
        {!isRunning && traceSteps.length > 0 && (
          <span className="badge badge-success text-[10px]">Completed</span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        {defaultSteps.map((step, idx) => {
          const { status, details, latency } = getStepStatus(step.key);

          let icon = <Circle className="w-3.5 h-3.5 text-[#d6d3d1]" />;

          if (status === "COMPLETED") {
            icon = <CheckCircle2 className="w-3.5 h-3.5 text-[#16a34a]" />;
          } else if (status === "RUNNING") {
            icon = <Loader2 className="w-3.5 h-3.5 text-[#ea6c2a]" style={{ animation: "spin 1s linear infinite" }} />;
          } else if (status === "FAILED") {
            icon = <AlertTriangle className="w-3.5 h-3.5 text-[#d97706]" />;
          }

          const stepClass =
            status === "COMPLETED"
              ? "workflow-step completed"
              : status === "RUNNING"
              ? "workflow-step running"
              : status === "FAILED"
              ? "workflow-step failed"
              : "workflow-step waiting";

          const statusLabel =
            status === "COMPLETED" ? "COMPLETED" :
            status === "RUNNING" ? "RUNNING" :
            status === "FAILED" ? "FAILED" :
            "—";

          const statusColor =
            status === "COMPLETED" ? "text-[#16a34a]" :
            status === "RUNNING" ? "text-[#ea6c2a]" :
            status === "FAILED" ? "text-[#d97706]" :
            "text-[#d6d3d1]";

          return (
            <div key={step.key} className={stepClass}>
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-mono text-[#d6d3d1] w-3">{idx + 1}</span>
                {icon}
                <div>
                  <p className="text-[12px] font-semibold text-[#1c1917]">{step.name}</p>
                  {details && status !== "WAITING" && (
                    <p className="text-[10px] text-[#78716c] font-mono truncate max-w-[180px]">{details}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {latency > 0 && (
                  <span className="text-[10px] text-[#a8a29e] font-mono">{latency.toFixed(2)}s</span>
                )}
                {status !== "WAITING" && (
                  <span className={`text-[10px] font-semibold ${statusColor}`}>{statusLabel}</span>
                )}
              </div>
            </div>
          );
        })}

        {!hasActivity && (
          <p className="text-[11px] text-[#a8a29e] text-center py-2">
            Run a query to see the LangGraph execution trace
          </p>
        )}
      </div>
    </div>
  );
};
