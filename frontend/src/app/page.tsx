"use client";

import React, { useState, useRef } from "react";
import { Header } from "@/components/Header";
import { DocumentUpload } from "@/components/DocumentUpload";
import { PdfViewer } from "@/components/PdfViewer";
import { RagStats } from "@/components/RagStats";
import { WorkflowGraph } from "@/components/WorkflowGraph";
import { ChatInterface, Message } from "@/components/ChatInterface";
import { TraceStep, UploadResponse, sendQuery, startNewSession } from "@/lib/api";

// Fixed execution order for progressive animation
const STEP_ORDER = [
  "Retrieval",
  "Reranking",
  "Grade Context",
  "Rewrite Query",
  "Generate",
  "Grade Answer",
];

// Average per-step duration (ms) used to pace the live reveal animation.
// These are only used during execution — final real latencies replace them.
const STEP_PACE_MS: Record<string, number> = {
  Retrieval: 800,
  Reranking: 2000,
  "Grade Context": 1500,
  "Rewrite Query": 1200,
  Generate: 4000,
  "Grade Answer": 1200,
};

export default function Home() {
  const [uploadData, setUploadData] = useState<UploadResponse | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingQuery, setIsLoadingQuery] = useState<boolean>(false);
  const [selectedCitationPage, setSelectedCitationPage] = useState<number | null>(null);
  const [latestQueryStats, setLatestQueryStats] = useState<any>(null);

  // Live trace steps — separate from the final query stats so we can
  // reset them immediately on every new query and animate step by step.
  const [liveTraceSteps, setLiveTraceSteps] = useState<TraceStep[]>([]);

  // Ref to cancel any in-progress animation timers when a new query starts
  const stepTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Cancel all pending step-reveal timers
  const cancelStepTimers = () => {
    stepTimersRef.current.forEach((t) => clearTimeout(t));
    stepTimersRef.current = [];
  };

  // Start the live step-reveal animation.
  // While the backend is processing, we progressively show each step as
  // RUNNING then COMPLETED using estimated pacing. When the real response
  // arrives, we replace everything with actual trace data + latencies.
  const startLiveTrace = () => {
    cancelStepTimers();
    setLiveTraceSteps([]); // reset — all steps go grey immediately

    let cumulativeMs = 0;
    const stepsToAnimate = STEP_ORDER.slice(0, 5); // animate up to Generate; Grade Answer comes with result

    stepsToAnimate.forEach((stepKey, idx) => {
      const pace = STEP_PACE_MS[stepKey] ?? 1500;

      // Mark step as RUNNING
      const runningTimer = setTimeout(() => {
        const runningStep: TraceStep = {
          step: stepKey,
          status: "RUNNING",
          latency_sec: 0,
          details: "Processing…",
        };
        setLiveTraceSteps((prev) => {
          // Replace existing entry for this step if any, otherwise append
          const filtered = prev.filter((s) => s.step !== stepKey);
          return [...filtered, runningStep];
        });
      }, cumulativeMs);

      // Mark step as COMPLETED (estimated)
      const completedTimer = setTimeout(() => {
        const completedStep: TraceStep = {
          step: stepKey,
          status: "COMPLETED",
          latency_sec: 0, // will be replaced by real latency from response
          details: "",
        };
        setLiveTraceSteps((prev) => {
          const filtered = prev.filter((s) => s.step !== stepKey);
          return [...filtered, completedStep];
        });
      }, cumulativeMs + pace);

      stepTimersRef.current.push(runningTimer, completedTimer);
      cumulativeMs += pace + 100;
    });
  };

  // Immediately clear old document, chat, and telemetry when a new upload starts
  const handleUploadStart = () => {
    cancelStepTimers();
    setUploadData(null);
    setMessages([]);
    setSelectedCitationPage(null);
    setLatestQueryStats(null);
    setLiveTraceSteps([]);
  };

  const handleUploadSuccess = (data: UploadResponse) => {
    setUploadData(data);
    setSelectedCitationPage(1);
    setLiveTraceSteps([]); // clean slate for trace
    setMessages([
      {
        id: "init-welcome",
        sender: "bot",
        text: `PDF "${data.filename}" successfully uploaded and indexed across 5 chunking strategies (${data.total_chunks} total chunks). Ask any question to start!`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  const handleClearChat = async () => {
    cancelStepTimers();
    setMessages([]);
    setSelectedCitationPage(null);
    setLatestQueryStats(null);
    setLiveTraceSteps([]);
    if (uploadData?.doc_id) {
      try {
        await startNewSession(uploadData.doc_id);
      } catch {
        // Ignore session cleanup failure
      }
    }
  };

  const handleSendMessage = async (query: string) => {
    if (!uploadData?.doc_id) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);

    // Reset trace immediately before starting new query — all steps go grey
    setLiveTraceSteps([]);
    setLatestQueryStats(null);
    setIsLoadingQuery(true);

    // Start live step-by-step animation during backend execution
    startLiveTrace();

    try {
      const preferredStrategy = uploadData.evaluation?.chunking_evaluation?.best_chunking_strategy;
      const res = await sendQuery(
        uploadData.doc_id,
        query,
        preferredStrategy || undefined,
        true
      );

      // Cancel estimated timers — real data has arrived
      cancelStepTimers();

      // Replace animated trace with the actual trace steps from the backend
      setLiveTraceSteps(res.trace_steps || []);
      setLatestQueryStats(res);

      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: res.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        queryResponse: res,
      };

      setMessages((prev) => [...prev, botMsg]);

      if (res.citations && res.citations.length > 0) {
        setSelectedCitationPage(res.citations[0].page);
      }
    } catch (err: any) {
      cancelStepTimers();
      setLiveTraceSteps([]);
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        sender: "bot",
        text: `Error: ${err.message || "Unknown backend error"}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoadingQuery(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f6f2] flex flex-col">
      <Header
        onClearChat={handleClearChat}
        hasMessages={messages.length > 0}
        activeDocName={uploadData?.filename}
      />

      <main className="flex-1 flex overflow-hidden" style={{ height: "calc(100vh - 56px)" }}>
        {/* LEFT SIDEBAR */}
        <aside className="w-[340px] shrink-0 border-r border-[#e5ddd4] bg-white overflow-y-auto p-4 flex flex-col gap-5 hidden lg:flex">
          <DocumentUpload
            onUploadSuccess={handleUploadSuccess}
            onUploadStart={handleUploadStart}
            isUploading={isUploading}
            setIsUploading={setIsUploading}
            uploadedDocInfo={uploadData}
          />

          <PdfViewer
            docId={uploadData?.doc_id}
            numPages={uploadData?.num_pages}
            filename={uploadData?.filename}
            selectedPage={selectedCitationPage}
          />

          {/* LangGraph Trace: visible whenever a document is active.
              Live trace steps update in real-time during and after each query. */}
          {uploadData && (
            <WorkflowGraph
              traceSteps={liveTraceSteps}
              isRunning={isLoadingQuery}
            />
          )}

          <RagStats
            uploadData={uploadData}
            latestQueryStats={latestQueryStats}
          />
        </aside>

        {/* MOBILE: Upload row above chat */}
        <div className="lg:hidden w-full flex flex-col">
          <div className="p-4 border-b border-[#e5ddd4] bg-white">
            <DocumentUpload
              onUploadSuccess={handleUploadSuccess}
              onUploadStart={handleUploadStart}
              isUploading={isUploading}
              setIsUploading={setIsUploading}
              uploadedDocInfo={uploadData}
            />
          </div>

          <div className="flex-1 overflow-hidden">
            <ChatInterface
              messages={messages}
              onSendMessage={handleSendMessage}
              isLoading={isLoadingQuery}
              onCitationClick={(page) => setSelectedCitationPage(page)}
              docId={uploadData?.doc_id}
            />
          </div>
        </div>

        {/* MAIN CHAT — desktop */}
        <div className="hidden lg:flex flex-1 overflow-hidden">
          <ChatInterface
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoadingQuery}
            onCitationClick={(page) => setSelectedCitationPage(page)}
            docId={uploadData?.doc_id}
          />
        </div>
      </main>
    </div>
  );
}
