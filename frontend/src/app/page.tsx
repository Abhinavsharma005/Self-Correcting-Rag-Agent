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

    const userMsgId = `user-${Date.now()}`;
    const userMsg: Message = {
      id: userMsgId,
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
        text: `Error processing query: ${err.message || "Unknown backend error"}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoadingQuery(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-gray-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-gray-950">
      <Header
        onClearChat={handleClearChat}
        hasMessages={messages.length > 0}
        activeDocName={uploadData?.filename}
      />

      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Controls, Upload, Preview, Graph & Stats */}
        <div className="lg:col-span-5 flex flex-col gap-5">
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

          <WorkflowGraph
            traceSteps={latestQueryStats?.trace_steps || []}
            isRunning={isLoadingQuery}
          />

          <RagStats
            uploadData={uploadData}
            latestQueryStats={latestQueryStats}
          />
        </div>

        {/* RIGHT COLUMN: Interactive Chatbot Interface */}
        <div className="lg:col-span-7 flex flex-col">
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
