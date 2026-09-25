"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Lock,
  ZoomIn,
  ZoomOut,
  X,
} from "lucide-react";
import Link from "next/link";
import {v zzx  createClient } from "@/utils/supabase/client";

interface SecureViewerProps {
  questionId: string;
  onClose: () => void;
  isPaid: boolean;
}

export default function SecureViewer({
  questionId,
  onClose,
  isPaid,
}: SecureViewerProps) {
  const supabase = createClient();

  const [pageCount, setPageCount]   = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [imgSrc, setImgSrc]         = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [zoom, setZoom]             = useState(1);

  // Free users can only see first 2 pages
  const maxPage = isPaid ? pageCount : Math.min(pageCount, 2);

  // ── Fetch page count on mount ────────────────────────────────────────
  useEffect(() => {
    async function fetchPageCount() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/viewer/${questionId}/page-count`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );
        if (res.ok) {
          const data = await res.json();
          setPageCount(data.page_count ?? 1);
        }
      } catch { /* non-critical */ }
    }
    fetchPageCount();
  }, [questionId]);

  // ── Fetch a page image ───────────────────────────────────────────────
  const fetchPage = useCallback(async (page: number) => {
    setLoading(true);
    setError("");
    setImgSrc(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError("Session expired."); setLoading(false); return; }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/viewer/${questionId}/page/${page}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );

      if (res.status === 403) {
        setError("upgrade");
        setLoading(false);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? "Failed to load page.");
      }

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      setImgSrc(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [questionId]);

  // Load page 1 on mount, reload when currentPage changes
  useEffect(() => {
    fetchPage(currentPage);
    // Revoke old blob URL on cleanup
    return () => { if (imgSrc) URL.revokeObjectURL(imgSrc); };
  }, [currentPage]);

  function prev() {
    if (currentPage > 1) setCurrentPage(p => p - 1);
  }

  function next() {
    if (currentPage < maxPage) setCurrentPage(p => p + 1);
  }

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft")  prev();
      if (e.key === "Escape")     onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentPage, maxPage]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
      style={{ fontFamily: "system-ui, sans-serif" }}
    >
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] bg-[#0C1428] px-4 py-3">
        {/* Page indicator */}
        <div className="flex items-center gap-3">
          <button
            onClick={prev}
            disabled={currentPage <= 1 || loading}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-400 hover:text-white disabled:opacity-30 transition"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <span className="text-sm font-medium text-slate-300 tabular-nums">
            {pageCount > 0
              ? `Page ${currentPage} of ${pageCount}`
              : `Page ${currentPage}`}
          </span>

          <button
            onClick={next}
            disabled={currentPage >= maxPage || loading}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-400 hover:text-white disabled:opacity-30 transition"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-400 hover:text-white transition"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="text-xs font-medium text-slate-500 w-10 text-center tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(z => Math.min(3, z + 0.25))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-400 hover:text-white transition"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-400 hover:text-red-400 transition"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Page area ── */}
      <div className="flex flex-1 items-start justify-center overflow-auto p-4">
        {loading && (
          <div className="flex flex-col items-center gap-3 mt-24">
            <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
            <p className="text-xs text-slate-600">Loading page…</p>
          </div>
        )}

        {!loading && error === "upgrade" && (
          <div className="mt-24 max-w-xs rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.06] p-8 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15">
              <Lock className="h-4 w-4 text-indigo-400" />
            </div>
            <p className="text-sm font-semibold text-white">Pages 3+ are locked</p>
            <p className="mt-1 text-xs text-slate-500">
              Upgrade to view the full document
            </p>
            <Link
              href="/dashboard/subscribe"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 transition"
              onClick={onClose}
            >
              Upgrade plan
            </Link>
          </div>
        )}

        {!loading && error && error !== "upgrade" && (
          <div className="mt-24 flex flex-col items-center gap-3 text-center">
            <AlertCircle className="h-6 w-6 text-red-400" />
            <p className="text-sm text-slate-500">{error}</p>
            <button
              onClick={() => fetchPage(currentPage)}
              className="text-xs font-semibold text-blue-500 hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && imgSrc && (
          <div
            style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
            className="transition-transform duration-150"
          >
            <img
              src={imgSrc}
              alt={`Page ${currentPage}`}
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              className="max-w-full select-none rounded-lg shadow-2xl"
              style={{
                maxWidth: "min(860px, 100%)",
                userSelect: "none",
                WebkitUserSelect: "none",
              }}
            />
          </div>
        )}
      </div>

      {/* ── Bottom nav (mobile-friendly) ── */}
      {pageCount > 1 && (
        <div className="border-t border-white/[0.07] bg-[#0C1428] px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={prev}
              disabled={currentPage <= 1 || loading}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-400 hover:text-white disabled:opacity-30 transition"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>

            {/* Page dots — show up to 7 */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(pageCount, 7) }, (_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`h-2 rounded-full transition-all ${
                      p === currentPage
                        ? "w-5 bg-blue-500"
                        : p > maxPage
                        ? "w-2 bg-white/10"
                        : "w-2 bg-white/20 hover:bg-white/40"
                    }`}
                  />
                );
              })}
              {pageCount > 7 && (
                <span className="text-xs text-slate-700 ml-1">…</span>
              )}
            </div>

            <button
              onClick={next}
              disabled={currentPage >= maxPage || loading}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-400 hover:text-white disabled:opacity-30 transition"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
