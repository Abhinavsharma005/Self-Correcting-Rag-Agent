"use client";

import React, { useState } from "react";
import { Header } from "@/components/Header";
import { DocumentUpload } from "@/components/DocumentUpload";
import { PdfViewer } from "@/components/PdfViewer";
import { RagStats } from "@/components/RagStats";
import { WorkflowGraph } from "@/components/WorkflowGraph";
import { ChatInterface, Message } from "@/components/ChatInterface";
import { UploadResponse, sendQuery } from "@/lib/api";

export default function Home() {
  const [uploadData, setUploadData] = useState<UploadResponse | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingQuery, setIsLoadingQuery] = useState<boolean>(false);
  const [selectedCitationPage, setSelectedCitationPage] = useState<number | null>(null);
  const [latestQueryStats, setLatestQueryStats] = useState<any>(null);

  const handleUploadSuccess = (data: UploadResponse) => {
    setUploadData(data);
    setSelectedCitationPage(1);
    setMessages([
      {
        id: "init-welcome",
        sender: "bot",
        text: `PDF "${data.filename}" successfully uploaded and indexed across 5 chunking strategies (${data.total_chunks} total chunks). Ask any question to start!`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  const handleClearChat = () => {
    setMessages([]);
    setSelectedCitationPage(null);
    setLatestQueryStats(null);
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
    setIsLoadingQuery(true);

    try {
      const res = await sendQuery(
        uploadData.doc_id,
        query,
        uploadData.evaluation?.chunking_evaluation?.best_chunking_strategy || "fixed",
        true
      );

      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: res.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        queryResponse: res,
      };

      setMessages((prev) => [...prev, botMsg]);
      setLatestQueryStats(res);

      if (res.citations && res.citations.length > 0) {
        setSelectedCitationPage(res.citations[0].page);
      }
    } catch (err: any) {
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

          {/* LangGraph Trace: only show while query is running */}
          {isLoadingQuery && (
            <WorkflowGraph
              traceSteps={latestQueryStats?.trace_steps || []}
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
              isUploading={isUploading}
              setIsUploading={setIsUploading}
              uploadedDocInfo={uploadData}
            />
          </div>

          {/* MOBILE Chat */}
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
