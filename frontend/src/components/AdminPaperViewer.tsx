"use client";

import {
  useEffect,
  useRef,
  useState,
  type TouchEvent,
} from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  X,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

type Props = {
  questionId: string;
  open: boolean;
  onClose: () => void;
};

const API = process.env.NEXT_PUBLIC_API_URL;

export default function AdminPaperViewer({
  questionId,
  open,
  onClose,
}: Props) {
  const [supabase] = useState(() => createClient());
  const [auth, setAuth] = useState<{
    questionId: string;
    token: string;
  } | null>(null);

  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [countLoading, setCountLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  const touchX = useRef<number | null>(null);

  useEffect(() => {
    setAuth(null);
    setCurrentPage(1);
    setImgSrc(null);
    setError("");
    setPageCount(0);
    setLoading(false);
    setCountLoading(false);
  }, [open, questionId]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const controller = new AbortController();

    async function init() {
      setCountLoading(true);
      setError("");

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (cancelled) return;

        if (!session) {
          setAuth(null);
          setError("Session expired. Please log in again.");
          return;
        }

        setAuth({
          questionId,
          token: session.access_token,
        });

        try {
          const res = await fetch(
            `${API}/api/admin/questions/${questionId}/preview-page-count`,
            {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
              signal: controller.signal,
            },
          );

          if (res.ok) {
            const body = await res.json();
            const count = Number(body.page_count ?? 1);

            if (!cancelled) {
              setPageCount(
                Number.isFinite(count) && count > 0
                  ? Math.floor(count)
                  : 1,
              );
            }
          }
        } catch {
          // The first page can still load if the count request fails.
        }
      } catch {
        if (!cancelled) {
          setError("Could not load your session. Please try again.");
        }
      } finally {
        if (!cancelled) setCountLoading(false);
      }
    }

    void init();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open, questionId, retry, supabase]);

  useEffect(() => {
    if (!open || !auth || auth.questionId !== questionId) return;

    let cancelled = false;
    let objectUrl: string | null = null;
    const controller = new AbortController();

    setLoading(true);
    setError("");
    setImgSrc(null);

    async function loadPage() {
      try {
        const res = await fetch(
          `${API}/api/admin/questions/${questionId}/preview-page/${currentPage}`,
          {
            headers: {
              Authorization: `Bearer ${auth!.token}`,
            },
            signal: controller.signal,
          },
        );

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          const message =
            typeof body?.detail === "string"
              ? body.detail
              : `Could not load page ${currentPage}.`;

          throw new Error(message);
        }

        const blob = await res.blob();

        if (cancelled) return;

        objectUrl = URL.createObjectURL(blob);
        setImgSrc(objectUrl);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Network error. Could not load the page.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPage();

    return () => {
      cancelled = true;
      controller.abort();

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [open, auth, questionId, currentPage, retry]);

  useEffect(() => {
    if (!open) return;

    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      const target = e.target;

      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }

      if (loading || countLoading) return;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setCurrentPage((page) =>
          page < pageCount ? page + 1 : page,
        );
      }

      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setCurrentPage((page) => Math.max(1, page - 1));
      }
    }

    window.addEventListener("keydown", handler);

    return () => window.removeEventListener("keydown", handler);
  }, [open, pageCount, loading, countLoading, onClose]);

  function goNext() {
    if (loading || countLoading) return;

    setCurrentPage((page) =>
      page < pageCount ? page + 1 : page,
    );
  }

  function goPrev() {
    if (loading || countLoading) return;

    setCurrentPage((page) => Math.max(1, page - 1));
  }

  function onTouchStart(e: TouchEvent<HTMLDivElement>) {
    touchX.current = e.touches[0]?.clientX ?? null;
  }

  function onTouchEnd(e: TouchEvent<HTMLDivElement>) {
    const endX = e.changedTouches[0]?.clientX;

    if (touchX.current === null || endX === undefined) return;

    const delta = endX - touchX.current;
    touchX.current = null;

    if (Math.abs(delta) > 48) {
      if (delta < 0) goNext();
      else goPrev();
    }
  }

  if (!open) return null;

  const busy = loading || countLoading;

  const navigationClass =
    "flex items-center gap-1.5 rounded-lg border " +
    "border-[var(--sp-border)] bg-[var(--sp-bg-muted)] " +
    "px-3 py-2 text-xs font-semibold text-[var(--sp-text-2)] " +
    "transition hover:border-[var(--sp-border-hover)] " +
    "hover:text-[var(--sp-text)] disabled:opacity-30";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[var(--sp-bg)] text-[var(--sp-text)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-paper-preview-title"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--sp-border)] bg-[var(--sp-search-popup)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Eye size={16} className="shrink-0 text-blue-500" />

          <div className="min-w-0">
            <p
              id="admin-paper-preview-title"
              className="text-sm font-semibold text-[var(--sp-text)]"
            >
              Admin review preview
            </p>

            <p className="text-[11px] text-[var(--sp-text-2)]">
              Watermarked · original file remains private
              {pageCount > 0 &&
                ` · page ${currentPage} of ${pageCount}`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg p-2 text-[var(--sp-text-2)] transition hover:bg-[var(--sp-bg-muted)] hover:text-[var(--sp-text)]"
          aria-label="Close preview"
        >
          <X size={18} />
        </button>
      </header>

      <div
        className="relative flex min-h-0 flex-1 select-none items-center justify-center overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {busy && (
          <div
            className="flex flex-col items-center gap-3 text-[var(--sp-text-2)]"
            role="status"
          >
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />

            <span className="text-sm">
              {countLoading
                ? "Loading document…"
                : `Rendering page ${currentPage}…`}
            </span>
          </div>
        )}

        {!busy && error && (
          <div
            className="flex flex-col items-center gap-3 p-8 text-center"
            role="alert"
          >
            <AlertCircle size={32} className="text-red-500" />
            <p className="text-sm text-[var(--sp-text)]">{error}</p>

            <button
              type="button"
              onClick={() => setRetry((value) => value + 1)}
              className="text-xs font-semibold text-blue-500 hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {!busy && !error && imgSrc && (
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

        {pageCount > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              disabled={currentPage === 1 || busy}
              className="absolute left-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80 disabled:opacity-20"
              aria-label="Previous page"
            >
              <ChevronLeft size={20} />
            </button>

            <button
              type="button"
              onClick={goNext}
              disabled={currentPage >= pageCount || busy}
              className="absolute right-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80 disabled:opacity-20"
              aria-label="Next page"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>

      {pageCount > 1 && (
        <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-[var(--sp-border)] bg-[var(--sp-search-popup)] px-4 py-3">
          <button
            type="button"
            onClick={goPrev}
            disabled={currentPage === 1 || busy}
            className={navigationClass}
          >
            <ChevronLeft size={14} />
            Prev
          </button>

          <div className="flex max-w-[55%] flex-wrap items-center justify-center gap-1.5 overflow-hidden">
            {Array.from(
              { length: Math.min(pageCount, 11) },
              (_, i) => {
                const n =
                  pageCount <= 11
                    ? i + 1
                    : Math.round((i / 10) * (pageCount - 1)) + 1;

                const active = n === currentPage;

                return (
                  <button
                    type="button"
                    key={n}
                    onClick={() => setCurrentPage(n)}
                    disabled={busy}
                    className={`h-2 rounded-full transition-all disabled:opacity-30 ${
                      active
                        ? "w-5 bg-blue-500"
                        : "w-2 bg-[var(--sp-text-3)] hover:bg-[var(--sp-text-2)]"
                    }`}
                    aria-label={`Go to page ${n}`}
                    aria-current={active ? "page" : undefined}
                  />
                );
              },
            )}
          </div>

          <button
            type="button"
            onClick={goNext}
            disabled={currentPage >= pageCount || busy}
            className={navigationClass}
          >
            Next
            <ChevronRight size={14} />
          </button>
        </footer>
      )}
    </div>
  );
            }
