"use client";

import React, { useState } from "react";
import { Eye, ChevronLeft, ChevronRight, Bookmark } from "lucide-react";
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
      <div className="w-full glass-panel rounded-2xl p-6 border border-gray-800 flex flex-col items-center justify-center min-h-[260px] text-center text-gray-500">
        <Eye className="w-8 h-8 mb-2 opacity-40 text-cyan-400" />
        <p className="text-xs font-semibold text-gray-400">PDF Preview Unavailable</p>
        <p className="text-[11px] text-gray-500 mt-1">Upload a PDF document above to activate live preview</p>
      </div>
    );
  }

  const pdfUrl = getPdfUrl(docId);

  return (
    <div className="w-full glass-panel rounded-2xl p-4 border border-cyan-500/20 flex flex-col h-[380px]">
      <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">
            PDF Document Preview
          </h3>
        </div>

        <div className="flex items-center gap-2 bg-gray-900/90 px-2.5 py-1 rounded-lg border border-gray-700/60 text-xs text-gray-300 font-mono">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="hover:text-cyan-400 disabled:opacity-30"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span>
            Page <strong className="text-cyan-400">{currentPage}</strong> of {numPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
            disabled={currentPage >= numPages}
            className="hover:text-cyan-400 disabled:opacity-30"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 w-full rounded-xl overflow-hidden bg-gray-950 border border-gray-850">
        {selectedPage && (
          <div className="absolute top-2 right-2 z-10 px-2.5 py-1 rounded-md bg-cyan-500/90 text-gray-950 font-bold text-[11px] shadow-lg animate-bounce">
            Highlighted Page {selectedPage}
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
