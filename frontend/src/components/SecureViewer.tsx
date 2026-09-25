
"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ChevronLeft, ChevronRight, Loader2, AlertCircle, Lock, ZoomIn, ZoomOut, X,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

interface SecureViewerProps {
  questionId: string;
  onClose: () => void;
  isPaid: boolean;
  inline?: boolean;   // true = embedded in page; false/undefined = fullscreen modal
}

export default function SecureViewer({
  questionId, onClose, isPaid, inline = false,
}: SecureViewerProps) {
  const supabase = createClient();

  const [pageCount, setPageCount]     = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [imgSrc, setImgSrc]           = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [zoom, setZoom]               = useState(1);

  const maxPage = isPaid ? pageCount : Math.min(pageCount, 2);

  // ── Page count ────────────────────────────────────────────────────────
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

  // ── Fetch page image ──────────────────────────────────────────────────
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
      if (res.status === 403) { setError("upgrade"); setLoading(false); return; }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ?? "Failed to load page.");
      }
      const blob = await res.blob();
      setImgSrc(URL.createObjectURL(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [questionId]);

  useEffect(() => {
    fetchPage(currentPage);
    return () => { if (imgSrc) URL.revokeObjectURL(imgSrc); };
  }, [currentPage]);

  function prev() { if (currentPage > 1) setCurrentPage(p => p - 1); }
  function next() { if (currentPage < maxPage) setCurrentPage(p => p + 1); }

  // Keyboard nav — only in modal mode
  useEffect(() => {
    if (inline) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft")  prev();
      if (e.key === "Escape")     onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentPage, maxPage, inline]);

  // ── Toolbar (shared between inline and modal) ─────────────────────────
  const toolbar = (
    <div
      className="flex items-center justify-between gap-3 px-4 py-3 border-b"
      style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
    >
      {/* Page nav */}
      <div className="flex items-center gap-2">
        <button
          onClick={prev}
          disabled={currentPage <= 1 || loading}
          className="flex h-8 w-8 items-center justify-center rounded-lg border transition disabled:opacity-30"
          style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)" }}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium tabular-nums" style={{ color: "var(--sp-text-2)" }}>
          {pageCount > 0 ? `${currentPage} / ${pageCount}` : currentPage}
        </span>
        <button
          onClick={next}
          disabled={currentPage >= maxPage || loading}
          className="flex h-8 w-8 items-center justify-center rounded-lg border transition disabled:opacity-30"
          style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)" }}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Zoom */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
          className="flex h-8 w-8 items-center justify-center rounded-lg border transition"
          style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)" }}
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <span className="text-xs font-medium tabular-nums w-10 text-center" style={{ color: "var(--sp-text-3)" }}>
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom(z => Math.min(3, z + 0.25))}
          className="flex h-8 w-8 items-center justify-center rounded-lg border transition"
          style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)" }}
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Close — modal only */}
      {!inline && (
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg border transition hover:text-red-500"
          style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)" }}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  // ── Page area ─────────────────────────────────────────────────────────
  const pageArea = (
    <div
      className="flex items-start justify-center overflow-auto p-4"
      style={{
        background: "var(--sp-bg)",
        minHeight: inline ? "520px" : undefined,
        flex: 1,
      }}
    >
      {loading && (
        <div className="flex flex-col items-center gap-3 mt-16">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          <p className="text-xs" style={{ color: "var(--sp-text-3)" }}>Loading page…</p>
        </div>
      )}

      {!loading && error === "upgrade" && (
        <div className="mt-16 max-w-xs rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.06] p-8 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15">
            <Lock className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="text-sm font-semibold" style={{ color: "var(--sp-text)" }}>
            Pages 3+ are locked
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--sp-text-3)" }}>
            Upgrade to view the full document
          </p>
          <Link
            href="/dashboard/subscribe"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 transition"
          >
            Upgrade plan
          </Link>
        </div>
      )}

      {!loading && error && error !== "upgrade" && (
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <AlertCircle className="h-6 w-6 text-red-500" />
          <p className="text-sm" style={{ color: "var(--sp-text-3)" }}>{error}</p>
          <button
            onClick={() => fetchPage(currentPage)}
            className="text-xs font-semibold text-indigo-500 hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && imgSrc && (
        <div style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
          className="transition-transform duration-150">
          <img
            src={imgSrc}
            alt={`Page ${currentPage}`}
            draggable={false}
            onContextMenu={e => e.preventDefault()}
            className="select-none rounded-lg shadow-lg"
            style={{
              maxWidth: "min(860px, 100%)",
              userSelect: "none",
              WebkitUserSelect: "none",
              pointerEvents: "none",   // prevents long-press save on mobile
            }}
          />
        </div>
      )}
    </div>
  );

  // ── Bottom nav ────────────────────────────────────────────────────────
  const bottomNav = pageCount > 1 ? (
    <div
      className="border-t px-4 py-3 flex items-center justify-between gap-2"
      style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
    >
      <button
        onClick={prev}
        disabled={currentPage <= 1 || loading}
        className="flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-medium transition disabled:opacity-30"
        style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)" }}
      >
        <ChevronLeft className="h-4 w-4" /> Previous
      </button>

      {/* Dot indicators */}
      <div className="flex items-center gap-1">
        {Array.from({ length: Math.min(pageCount, 7) }, (_, i) => {
          const p = i + 1;
          return (
            <button
              key={p}
              onClick={() => setCurrentPage(p)}
              className={`h-2 rounded-full transition-all ${
                p === currentPage ? "w-5 bg-indigo-500"
                : p > maxPage ? "w-2 opacity-20"
                : "w-2 opacity-40 hover:opacity-70"
              }`}
              style={{ background: p === currentPage ? undefined : "var(--sp-text-3)" }}
            />
          );
        })}
        {pageCount > 7 && (
          <span className="text-xs ml-1" style={{ color: "var(--sp-text-3)" }}>…</span>
        )}
      </div>

      <button
        onClick={next}
        disabled={currentPage >= maxPage || loading}
        className="flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-medium transition disabled:opacity-30"
        style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)" }}
      >
        Next <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  ) : null;

  // ── Inline mode — renders inside the page ─────────────────────────────
  if (inline) {
    return (
      <div className="flex flex-col rounded-2xl overflow-hidden border"
        style={{ borderColor: "var(--sp-border)" }}>
        {toolbar}
        {pageArea}
        {bottomNav}
      </div>
    );
  }

  // ── Modal mode — fullscreen overlay ───────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--sp-bg)" }}>
      {toolbar}
      {pageArea}
      {bottomNav}
    </div>
  );
}