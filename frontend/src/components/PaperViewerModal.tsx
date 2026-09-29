"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle, ChevronLeft, ChevronRight, Lock, Loader2, X,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type Props = {
  questionId: string;
  title: string;
  open: boolean;
  onClose: () => void;
};

const API            = process.env.NEXT_PUBLIC_API_URL;
const FREE_PAGE_LIMIT = 2;

export default function PaperViewerModal({ questionId, title, open, onClose }: Props) {
  const supabase = createClient();

  const [token, setToken]               = useState<string | null>(null);
  const [pageCount, setPageCount]       = useState(0);
  const [currentPage, setCurrentPage]   = useState(1);
  const [imgSrc, setImgSrc]             = useState<string | null>(null);
  const [loading, setLoading]           = useState(false);
  const [initLoading, setInitLoading]   = useState(false);
  const [error, setError]               = useState<"paywall" | string | null>(null);
  const prevBlobRef                     = useRef<string | null>(null);
  const touchX                          = useRef<number | null>(null);

  // ── Init ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      setCurrentPage(1);
      setImgSrc(null);
      setError(null);
      setPageCount(0);
      setToken(null);
      return;
    }
    let cancelled = false;
    setInitLoading(true);

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { if (!cancelled) setError("Session expired."); setInitLoading(false); return; }
      if (!cancelled) setToken(session.access_token);

      try {
        const res = await fetch(`${API}/api/viewer/${questionId}/page-count`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setPageCount(data.page_count ?? 1);
        }
      } catch { /* non-critical */ }
      finally { if (!cancelled) setInitLoading(false); }
    }

    init();
    return () => { cancelled = true; };
  }, [open, questionId]);

  // ── Load page ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || !token) return;
    let cancelled = false;

    setLoading(true);
    setError(null);

    if (prevBlobRef.current) {
      URL.revokeObjectURL(prevBlobRef.current);
      prevBlobRef.current = null;
    }
    setImgSrc(null);

    fetch(`${API}/api/viewer/${questionId}/page/${currentPage}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (res.status === 403) {
          const body = await res.json().catch(() => null);
          const isPaywall = body?.detail?.toLowerCase().includes("upgrade") ||
                            body?.detail?.toLowerCase().includes("plan");
          if (!cancelled) setError(isPaywall ? "paywall" : (body?.detail ?? "Access denied."));
          return;
        }
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

  // ── Keyboard ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") goNext();
      if (e.key === "ArrowLeft"  || e.key === "ArrowUp")   goPrev();
      if (e.key === "Escape")                              onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, currentPage, pageCount]);

  // ── Touch swipe ──────────────────────────────────────────────────────
  function onTouchStart(e: React.TouchEvent) { touchX.current = e.touches[0].clientX; }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(delta) > 48) { delta < 0 ? goNext() : goPrev(); }
    touchX.current = null;
  }

  function goNext() {
    if (currentPage < pageCount && error !== "paywall") setCurrentPage((p) => p + 1);
  }
  function goPrev() {
    if (currentPage > 1) setCurrentPage((p) => p - 1);
  }

  if (!open) return null;

  const showPaywall = error === "paywall";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "var(--sp-bg, #07091A)" }}
      role="dialog"
      aria-modal="true"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* ── Header ── */}
      <header
        className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3"
        style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold" style={{ color: "var(--sp-text)" }}>
            {title}
          </p>
          {!initLoading && pageCount > 0 && (
            <p className="text-[11px]" style={{ color: "var(--sp-text-3)" }}>
              Page {currentPage} of {pageCount}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-lg p-2 transition"
          style={{ color: "var(--sp-text-3)" }}
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </header>

      {/* ── Viewer ── */}
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden select-none"
        style={{ background: "var(--sp-bg)" }}
      >
        {/* Loading states */}
        {(initLoading || loading) && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
            <span className="text-sm" style={{ color: "var(--sp-text-3)" }}>
              {initLoading ? "Opening document…" : `Loading page ${currentPage}…`}
            </span>
          </div>
        )}

        {/* Error */}
        {!loading && !initLoading && error && !showPaywall && (
          <div className="flex flex-col items-center gap-3 p-8 text-center text-red-400">
            <AlertCircle size={32} />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Paywall */}
        {!loading && showPaywall && (
          <div className="flex flex-col items-center gap-5 p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10">
              <Lock className="h-8 w-8 text-blue-400" />
            </div>
            <div>
              <p className="text-lg font-bold" style={{ color: "var(--sp-text)" }}>
                Upgrade to read more
              </p>
              <p className="mt-1.5 text-sm" style={{ color: "var(--sp-text-3)" }}>
                Free accounts can preview the first {FREE_PAGE_LIMIT} pages.
                {pageCount > 0 && (
                  <> Upgrade to access all <strong>{pageCount}</strong> pages.</>
                )}
              </p>
            </div>
            <Link
              href="/pricing"
              className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Upgrade plan
            </Link>
            <button
              onClick={onClose}
              className="text-xs underline underline-offset-2 transition"
              style={{ color: "var(--sp-text-3)" }}
            >
              Back to questions
            </button>
          </div>
        )}

        {/* Page image */}
        {!loading && !initLoading && !error && imgSrc && (
          <>
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
              style={{
                userSelect: "none",
                WebkitUserSelect: "none",
                pointerEvents: "none",
              }}
            />
          </>
        )}

        {/* Arrow buttons (desktop) */}
        {pageCount > 1 && !showPaywall && (
          <>
            <button
              onClick={goPrev}
              disabled={currentPage === 1 || loading}
              aria-label="Previous page"
              className="absolute left-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70 disabled:opacity-20"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={goNext}
              disabled={currentPage === pageCount || loading}
              aria-label="Next page"
              className="absolute right-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70 disabled:opacity-20"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>

      {/* ── Footer nav ── */}
      {pageCount > 1 && !showPaywall && (
        <footer
          className="flex shrink-0 items-center justify-between gap-4 border-t px-4 py-3"
          style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
        >
          <button
            onClick={goPrev}
            disabled={currentPage === 1 || loading}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:opacity-30"
            style={{
              borderColor: "var(--sp-border)",
              background: "var(--sp-input-bg)",
              color: "var(--sp-text-2)",
            }}
          >
            <ChevronLeft size={14} /> Prev
          </button>

          {/* Dot indicator */}
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
                  aria-label={`Page ${n}`}
                  className={`h-2 rounded-full transition-all ${
                    active ? "w-5 bg-blue-400" : "w-2 hover:bg-blue-400/50"
                  }`}
                  style={active ? {} : { background: "var(--sp-border)" }}
                />
              );
            })}
          </div>

          <button
            onClick={goNext}
            disabled={currentPage === pageCount || loading}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:opacity-30"
            style={{
              borderColor: "var(--sp-border)",
              background: "var(--sp-input-bg)",
              color: "var(--sp-text-2)",
            }}
          >
            Next <ChevronRight size={14} />
          </button>
        </footer>
      )}
    </div>
  );
}