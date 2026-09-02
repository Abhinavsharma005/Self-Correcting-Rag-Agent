"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, FileText, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { UploadResponse } from "@/lib/api";

interface DocumentUploadProps {
  onUploadSuccess: (data: UploadResponse) => void;
  isUploading: boolean;
  setIsUploading: (val: boolean) => void;
  uploadedDocInfo?: UploadResponse | null;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({
  onUploadSuccess,
  isUploading,
  setIsUploading,
  uploadedDocInfo,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (file: File) => {
    if (!file.name.endsWith(".pdf")) {
      setError("Only PDF files are supported.");
      return;
    }
    setError(null);
    setIsUploading(true);

    try {
      const { uploadPdf } = await import("@/lib/api");
      const res = await uploadPdf(file);
      onUploadSuccess(res);
    } catch (err: any) {
      setError(err.message || "Failed to process PDF.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="w-full glass-panel rounded-2xl p-4 border border-cyan-500/20">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-cyan-400" /> Document Ingestion
        </h2>
        {uploadedDocInfo && (
          <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Ready for RAG
          </span>
        )}
      </div>

      {!uploadedDocInfo ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-300 ${
            dragActive
              ? "border-cyan-400 bg-cyan-950/40 glow-cyan"
              : "border-gray-700/70 hover:border-cyan-500/50 bg-gray-900/40 hover:bg-gray-900/60"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFiles(e.target.files[0]);
              }
            }}
          />

          {isUploading ? (
            <div className="flex flex-col items-center justify-center py-2">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-2" />
              <p className="text-sm font-semibold text-cyan-300">Ingesting PDF & Generating Vector DBs...</p>
              <p className="text-xs text-gray-400 mt-1">Chunking (5 strategies) + Local Embedding</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-2">
              <div className="p-3 rounded-full bg-cyan-500/10 text-cyan-400 mb-2 border border-cyan-500/20">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-xs font-semibold text-gray-200">
                <span className="text-cyan-400 underline">Click to browse</span> or drag & drop PDF
              </p>
              <p className="text-[11px] text-gray-400 mt-1">Supports multi-page documents</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-900/80 rounded-xl p-3.5 border border-cyan-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-gray-100 truncate">{uploadedDocInfo.filename}</p>
                <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-0.5 font-mono">
                  <span>Type: PDF</span>
                  <span>Size: {uploadedDocInfo.file_size_mb} MB</span>
                  <span className="text-cyan-400 font-bold">Pages: {uploadedDocInfo.num_pages}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 underline font-semibold px-2 py-1"
            >
              Change
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFiles(e.target.files[0]);
                }
              }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="mt-2 p-2 rounded-lg bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
