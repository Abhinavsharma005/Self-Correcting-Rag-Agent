"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, FileText, CheckCircle2, Loader2, AlertCircle, RefreshCw } from "lucide-react";
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
    <div className="w-full">
      <p className="section-label mb-2">Source Document</p>

      {/* Hidden file input — always present */}
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

      {/* Upload zone or Uploaded doc card */}
      {!uploadedDocInfo ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`upload-zone p-5 text-center ${dragActive ? "active" : ""}`}
        >
          {isUploading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-1">
              <Loader2 className="w-6 h-6 text-[#ea6c2a] animate-spin" />
              <p className="text-[13px] font-medium text-[#1c1917]">Ingesting PDF…</p>
              <p className="text-[11px] text-[#a8a29e]">Chunking (5 strategies) + embedding vectors</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-1">
              <div className="w-10 h-10 rounded-xl bg-[#fdf0e8] flex items-center justify-center text-[#ea6c2a]">
                <UploadCloud className="w-5 h-5" />
              </div>
              <p className="text-[13px] font-medium text-[#1c1917]">
                Drop a document here
              </p>
              <p className="text-[11px] text-[#a8a29e]">PDF, DOCX, Markdown</p>
              <button
                type="button"
                className="mt-1 px-4 py-1.5 bg-white border border-[#e5ddd4] rounded-lg text-[12px] font-medium text-[#57534e] hover:border-[#ea6c2a] hover:text-[#ea6c2a] transition-all"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              >
                Browse file
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="surface-card p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-lg bg-[#fdf0e8] flex items-center justify-center text-[#ea6c2a] shrink-0 text-xs font-bold">
              PDF
            </div>
            <div className="overflow-hidden">
              <p className="text-[13px] font-semibold text-[#1c1917] truncate">{uploadedDocInfo.filename}</p>
              <div className="flex items-center gap-2 text-[11px] text-[#a8a29e] mt-0.5 font-mono">
                <span>application/pdf</span>
                <span className="opacity-40">·</span>
                <span>{uploadedDocInfo.file_size_mb} MB</span>
                <span className="opacity-40">·</span>
                <span className="text-[#ea6c2a] font-semibold">{uploadedDocInfo.num_pages} pages</span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <CheckCircle2 className="w-3 h-3 text-[#16a34a]" />
                <span className="text-[10px] text-[#16a34a] font-medium">Indexed & ready for RAG</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 p-1.5 rounded-lg hover:bg-[#f1ede7] text-[#a8a29e] hover:text-[#57534e] transition-colors"
            title="Replace document"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="mt-2 p-2.5 rounded-lg bg-[#fef2f2] border border-[#fecaca] text-[#dc2626] text-[11px] flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
