"use client";

import { useCallback, useEffect, useState } from "react";
import {
  X, ChevronLeft, ChevronRight, Loader2, Lock,
  AlertCircle, Sparkles, ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

interface Props {
  questionId: string;
  title: string;
  open: boolean;
  onClose: () => void;
}

interface PageMeta {
  total_pages: number;
  viewable_pages: number;
  is_paid: boolean;
}

export default function PaperViewerModal({ questionId, title, open, onClose }: Props) {
  const supabase = createClient();

  const [token, setToken]         = useState<string | null>(null);
  const [meta, setMeta]           = useState<PageMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [imgSrc, setImgSrc]           = useState<string | null>(null);
  const [imgLoading, setImgLoading]   = useState(false);
  const [imgError, setImgError]       = useState("");

  // ── Get auth token once ───────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? null);
    });
  }, [open]);

  // ── Load page count when modal opens ─────────────────────────────────────
  useEffect(() => {
    if (!open || !token) return;
    setCurrentPage(1);
    setMeta(null);
    setMetaError("");
    setMetaLoading(true);

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/questions/${questionId}/page-count`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error("Could not load paper info.");
        return r.json();
      })
      .then(setMeta)
      .catch((e) => setMetaError(e.message))
      .finally(() => setMetaLoading(false));
  }, [open, token, questionId]);

  // ── Fetch a page image as a blob URL ─────────────────────────────────────
  const loadPage = useCallback(
    async (page: number) => {
      if (!token) return;
      setImgLoading(true);
      setImgError("");

      // Revoke previous blob URL to free memory
      setImgSrc((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return null;
      });

      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/questions/${questionId}/page/${page}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (res.status === 403) {
          // Hit the free-tier wall — show gate instead of error
          setImgSrc("__gated__");
          return;
        }
        if (!res.ok) throw new Error("Could not load this page.");

        const blob = await res.blob();
        setImgSrc(URL.createObjectURL(blob));
      } catch (e) {
        setImgError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setImgLoading(false);
      }
    },
    [token, questionId]
  );

  // ── Load page whenever currentPage changes ────────────────────────────────
  useEffect(() => {
    if (!open || !meta) return;
    loadPage(currentPage);
  }, [open, meta, currentPage]);

  // ── Cleanup blob on unmount/close ─────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      setImgSrc((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return null;
      });
      setMeta(null);
      setMetaError("");
      setImgError("");
    }
  }, [open]);

  if (!open) return null;

  const canGoPrev = currentPage > 1;
  const canGoNext = meta ? currentPage < meta.viewable_pages : false;
  const isGated   = imgSrc === "__gated__";
  const lockedCount = meta ? meta.total_pages - meta.viewable_pages : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative flex w-full max-w-3xl flex-col rounded-2xl border overflow-hidden"
        style={{
          background: "var(--sp-bg-card)",
          borderColor: "var(--sp-border)",
          maxHeight: "90vh",
        }}
      >
        {/* ── Header ── */}
        <div
          className="flex shrink-0 items-center justify-between gap-3 border-b px-5 py-4"
          style={{ borderColor: "var(--sp-border)" }}
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold" style={{ color: "var(--sp-text)" }}>
              {title}
            </p>
            {meta && (
              <p className="mt-0.5 text-xs" style={{ color: "var(--sp-text-3)" }}>
                Page {currentPage} of {meta.viewable_pages}
                {!meta.is_paid && meta.total_pages > meta.viewable_pages && (
                  <span className="ml-1.5 text-indigo-400">
                    · {meta.total_pages - meta.viewable_pages} pages locked
                  </span>
                )}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition"
            style={{ color: "var(--sp-text-3)", background: "var(--sp-bg-muted)" }}
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Page viewer ── */}
        <div
          className="flex flex-1 items-center justify-center overflow-y-auto px-4 py-6"
          style={{ minHeight: 0, background: "var(--sp-bg)" }}
        >
          {metaLoading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
              <p className="text-sm" style={{ color: "var(--sp-text-3)" }}>Loading paper…</p>
            </div>
          ) : metaError ? (
            <div className="flex flex-col items-center gap-3 text-center px-6">
              <AlertCircle className="h-6 w-6 text-red-400" />
              <p className="text-sm text-red-400">{metaError}</p>
            </div>
          ) : isGated ? (
            /* ── Free-tier gate ── */
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.06] p-8 text-center max-w-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/15">
                <Lock className="h-5 w-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--sp-text)" }}>
                  {lockedCount} page{lockedCount !== 1 ? "s" : ""} locked
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--sp-text-3)" }}>
                  Free accounts can read the first {2} pages.
                </p>
              </div>
              <Link
                href="/dashboard/subscribe"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 transition"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Unlock all pages
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : imgLoading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
              <p className="text-sm" style={{ color: "var(--sp-text-3)" }}>Loading page {currentPage}…</p>
            </div>
          ) : imgError ? (
            <div className="flex flex-col items-center gap-3 text-center px-6">
              <AlertCircle className="h-6 w-6 text-red-400" />
              <p className="text-sm text-red-400">{imgError}</p>
              <button
                onClick={() => loadPage(currentPage)}
                className="text-xs font-semibold text-indigo-400 hover:underline"
              >
                Try again
              </button>
            </div>
          ) : imgSrc ? (
            /* ── The page image — right-click is UX friction, not real protection ── */
            /* Real protection: the server never sends the original file */
            <img
              src={imgSrc}
              alt={`Page ${currentPage}`}
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              className="max-w-full rounded-lg shadow-xl select-none"
              style={{ maxHeight: "65vh", objectFit: "contain" }}
            />
          ) : null}
        </div>

        {/* ── Navigation ── */}
        {meta && !metaLoading && !metaError && (
          <div
            className="shrink-0 flex items-center justify-between border-t px-5 py-3"
            style={{ borderColor: "var(--sp-border)" }}
          >
            <button
              onClick={() => setCurrentPage((p) => p - 1)}
              disabled={!canGoPrev || imgLoading}
              className="flex items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-semibold transition disabled:opacity-30"
              style={{
                borderColor: "var(--sp-border)",
                background: "var(--sp-bg-muted)",
                color: "var(--sp-text-2)",
              }}
            >
              <ChevronLeft size={14} /> Previous
            </button>

            {/* Page dots — max 7 shown */}
            <div className="flex items-center gap-1.5">
              {Array.from({ length: Math.min(meta.viewable_pages, 7) }, (_, i) => {
                const page = i + 1;
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className="h-2 w-2 rounded-full transition-all"
                    style={{
                      background:
                        page === currentPage
                          ? "var(--sp-indigo, #6366f1)"
                          : "var(--sp-border)",
                      transform: page === currentPage ? "scale(1.4)" : "scale(1)",
                    }}
                  />
                );
              })}
              {meta.viewable_pages > 7 && (
                <span className="text-[10px]" style={{ color: "var(--sp-text-3)" }}>
                  …{meta.viewable_pages - 7} more
                </span>
              )}
            </div>

            <button
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={!canGoNext || imgLoading}
              className="flex items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-semibold transition disabled:opacity-30"
              style={{
                borderColor: "var(--sp-border)",
                background: "var(--sp-bg-muted)",
                color: "var(--sp-text-2)",
              }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}