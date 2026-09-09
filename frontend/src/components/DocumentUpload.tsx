"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, Loader2, AlertCircle, FileText } from "lucide-react";
import { UploadResponse } from "@/lib/api";

interface DocumentUploadProps {
  onUploadSuccess: (data: UploadResponse) => void;
  onUploadStart?: () => void;
  isUploading: boolean;
  setIsUploading: (val: boolean) => void;
  uploadedDocInfo?: UploadResponse | null;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({
  onUploadSuccess,
  onUploadStart,
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
    if (onUploadStart) {
      onUploadStart();
    }
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
      <div className="flex items-center justify-between mb-2">
        <p className="section-label">Current Document</p>
        {uploadedDocInfo && !isUploading && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-[11px] px-2.5 py-0.5 rounded-md border border-[#e2e8f0] bg-white text-[#475569] hover:bg-[#f8fafc] hover:border-[var(--primary-border)] font-medium transition-colors"
          >
            Change
          </button>
        )}
      </div>

      {/* Hidden file input */}
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

      {/* Upload zone or Document Card */}
      {!uploadedDocInfo || isUploading ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={`upload-zone p-4 text-center ${dragActive ? "active" : ""}`}
        >
          {isUploading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-1">
              <Loader2 className="w-6 h-6 text-[var(--primary)] animate-spin" />
              <p className="text-[13px] font-medium text-[#0f172a]">Ingesting PDF…</p>
              <p className="text-[11px] text-[#94a3b8]">Chunking (5 strategies) + embedding vectors</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-1">
              <div className="w-9 h-9 rounded-xl bg-[var(--primary-soft)] flex items-center justify-center text-[var(--primary)]">
                <UploadCloud className="w-5 h-5" />
              </div>
              <p className="text-[13px] font-medium text-[#0f172a]">
                Drop a document here
              </p>
              <p className="text-[11px] text-[#94a3b8]">PDF files supported</p>
              <button
                type="button"
                className="mt-0.5 px-3.5 py-1 bg-white border border-[#e2e8f0] rounded-lg text-[11px] font-medium text-[#475569] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all shadow-2xs"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              >
                Browse file
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Target style Current Document Card */
        <div className="surface-card p-3 rounded-xl">
          <div className="flex items-center gap-3">
            {/* Red PDF icon badge */}
            <div className="w-9 h-9 rounded-lg bg-[#ef4444] text-white flex items-center justify-center shrink-0 shadow-2xs">
              <FileText className="w-5 h-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[#0f172a] truncate leading-tight">
                {uploadedDocInfo.filename}
              </p>
              <p className="text-[11px] text-[#94a3b8] font-mono mt-0.5">
                {uploadedDocInfo.num_pages} pages · {uploadedDocInfo.file_size_mb} MB
              </p>
            </div>
          </div>

          {/* Green progress/status bar */}
          <div className="w-full bg-[#f1f5f9] h-1 rounded-full overflow-hidden mt-3">
            <div className="bg-[var(--primary)] h-full w-full rounded-full transition-all duration-300" />
          </div>
        </div>
      )}

      {error && (
        <div className="mt-2 p-2 rounded-lg bg-[#fef2f2] border border-[#fecaca] text-[#ef4444] text-[11px] flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
