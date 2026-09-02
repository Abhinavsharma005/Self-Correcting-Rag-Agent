"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { getPdfUrl } from "@/lib/api";

interface PdfViewerProps {
  docId?: string;
  numPages?: number;
  filename?: string;
  selectedPage?: number | null;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  docId,
  numPages = 1,
  filename,
  selectedPage,
}) => {
  const [currentPage, setCurrentPage] = useState<number>(selectedPage || 1);

  React.useEffect(() => {
    if (selectedPage) {
      setCurrentPage(selectedPage);
    }
  }, [selectedPage]);

  if (!docId) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-2">
          <p className="section-label">Preview</p>
          <span className="text-[10px] text-[#a8a29e] font-mono">Page — / —</span>
        </div>
        <div className="surface-card flex flex-col items-center justify-center min-h-[200px] text-center text-[#a8a29e]">
          <FileText className="w-8 h-8 mb-2 opacity-30" />
          <p className="text-[12px] text-[#78716c]">native PDF preview</p>
          <p className="text-[11px] text-[#a8a29e] mt-0.5">awaiting index</p>
        </div>
      </div>
    );
  }

  const pdfUrl = getPdfUrl(docId);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <p className="section-label">Preview</p>
        <div className="flex items-center gap-1.5 text-[11px] text-[#57534e] font-mono">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="p-0.5 hover:text-[#ea6c2a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span>
            Page <strong className="text-[#1c1917]">{currentPage}</strong> / {numPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
            disabled={currentPage >= numPages}
            className="p-0.5 hover:text-[#ea6c2a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="surface-card overflow-hidden relative" style={{ height: 280 }}>
        {selectedPage && selectedPage !== currentPage && (
          <div className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded bg-[#ea6c2a] text-white text-[10px] font-semibold shadow">
            ↗ Page {selectedPage} cited
          </div>
        )}
        <iframe
          src={`${pdfUrl}#page=${currentPage}`}
          className="w-full h-full border-none"
          title={filename || "PDF Preview"}
        />
      </div>
    </div>
  );
};
