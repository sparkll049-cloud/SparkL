"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle, ChevronLeft, ChevronRight, Eye, Loader2, X,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

type Props = {
  questionId: string;
  open: boolean;
  onClose: () => void;
};

const API = process.env.NEXT_PUBLIC_API_URL;

export default function AdminPaperViewer({ questionId, open, onClose }: Props) {
  const supabase = createClient();
  const [token, setToken]           = useState<string | null>(null);
  const [pageCount, setPageCount]   = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [imgSrc, setImgSrc]         = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);
  const [countLoading, setCountLoading] = useState(false);
  const [error, setError]           = useState("");
  const prevBlobRef                 = useRef<string | null>(null);

  // ── Init: get token + page count ────────────────────────────────────
  useEffect(() => {
    if (!open) {
      setCurrentPage(1);
      setImgSrc(null);
      setError("");
      setPageCount(0);
      return;
    }
    let cancelled = false;

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Session expired."); return; }
      if (!cancelled) setToken(session.access_token);

      setCountLoading(true);
      try {
        const res = await fetch(`${API}/api/admin/questions/${questionId}/preview-page-count`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setPageCount(data.page_count ?? 1);
        }
      } catch { /* will show 0/0 but pages still load */ }
      finally { if (!cancelled) setCountLoading(false); }
    }

    init();
    return () => { cancelled = true; };
  }, [open, questionId]);

  // ── Load page image whenever currentPage or token changes ───────────
  useEffect(() => {
    if (!open || !token) return;
    let cancelled = false;

    setLoading(true);
    setError("");

    // Revoke old blob URL to free memory
    if (prevBlobRef.current) {
      URL.revokeObjectURL(prevBlobRef.current);
      prevBlobRef.current = null;
    }
    setImgSrc(null);

    fetch(`${API}/api/admin/questions/${questionId}/preview-page/${currentPage}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          if (!cancelled) setError(body?.detail ?? `Could not load page ${currentPage}.`);
          return;
        }
        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        prevBlobRef.current = url;
        if (!cancelled) setImgSrc(url);
      })
      .catch(() => { if (!cancelled) setError("Network error — could not load page."); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [open, token, questionId, currentPage]);

  // ── Keyboard nav ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown")  goNext();
      if (e.key === "ArrowLeft"  || e.key === "ArrowUp")    goPrev();
      if (e.key === "Escape")                               onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, currentPage, pageCount]);

  // ── Touch swipe ──────────────────────────────────────────────────────
  const touchX = useRef<number | null>(null);
  function onTouchStart(e: React.TouchEvent) { touchX.current = e.touches[0].clientX; }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(delta) > 48) { delta < 0 ? goNext() : goPrev(); }
    touchX.current = null;
  }

  function goNext() { if (currentPage < pageCount) setCurrentPage((p) => p + 1); }
  function goPrev() { if (currentPage > 1)          setCurrentPage((p) => p - 1); }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#07091A]"
      role="dialog"
      aria-modal="true"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* ── Header ── */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#0D1230] px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Eye size={16} className="shrink-0 text-blue-400" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Admin review preview</p>
            <p className="text-[11px] text-slate-500">
              Watermarked · original file remains private
              {pageCount > 0 && ` · page ${currentPage} of ${pageCount}`}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white transition"
          aria-label="Close preview"
        >
          <X size={18} />
        </button>
      </header>

      {/* ── Page area ── */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden select-none">

        {(loading || countLoading) && (
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
            <span className="text-sm text-slate-400">
              {countLoading ? "Loading document…" : `Rendering page ${currentPage}…`}
            </span>
          </div>
        )}

        {!loading && !countLoading && error && (
          <div className="flex flex-col items-center gap-3 text-red-400 p-8 text-center">
            <AlertCircle size={32} />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && imgSrc && (
          <>
            {/* Invisible capture-prevention overlay */}
            <div
              className="absolute inset-0 z-10"
              onContextMenu={(e) => e.preventDefault()}
            />
            <img
              src={imgSrc}
              alt={`Page ${currentPage}`}
              className="max-h-full max-w-full object-contain"
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              style={{ userSelect: "none", WebkitUserSelect: "none", pointerEvents: "none" }}
            />
          </>
        )}

        {/* Prev / Next arrows */}
        {pageCount > 1 && (
          <>
            <button
              onClick={goPrev}
              disabled={currentPage === 1 || loading}
              className="absolute left-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80 disabled:opacity-20"
              aria-label="Previous page"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={goNext}
              disabled={currentPage === pageCount || loading}
              className="absolute right-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80 disabled:opacity-20"
              aria-label="Next page"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>

      {/* ── Footer nav ── */}
      {pageCount > 1 && (
        <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-white/10 bg-[#0D1230] px-4 py-3">
          <button
            onClick={goPrev}
            disabled={currentPage === 1 || loading}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.08] disabled:opacity-30"
          >
            <ChevronLeft size={14} /> Prev
          </button>

          {/* Dot strip */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 overflow-hidden max-w-[55%]">
            {Array.from({ length: Math.min(pageCount, 11) }, (_, i) => {
              const n = pageCount <= 11
                ? i + 1
                : Math.round((i / 10) * (pageCount - 1)) + 1;
              const active = n === currentPage;
              return (
                <button
                  key={i}
                  onClick={() => setCurrentPage(n)}
                  className={`h-2 rounded-full transition-all ${
                    active ? "w-5 bg-blue-400" : "w-2 bg-white/20 hover:bg-white/50"
                  }`}
                  aria-label={`Go to page ${n}`}
                />
              );
            })}
          </div>

          <button
            onClick={goNext}
            disabled={currentPage === pageCount || loading}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.08] disabled:opacity-30"
          >
            Next <ChevronRight size={14} />
          </button>
        </footer>
      )}
    </div>
  );
}