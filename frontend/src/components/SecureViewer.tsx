"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  ChevronLeft, ChevronRight, Loader2, AlertCircle, Lock, ZoomIn, ZoomOut, X,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SecureViewerProps {
  questionId: string;
  onClose:    () => void;
  isPaid:     boolean;
  inline?:    boolean; // true = embedded in page; false/undefined = fullscreen modal
}

// ── Canvas page renderer with watermark ───────────────────────────────────────

interface SecurePageProps {
  blobUrl: string;
  zoom:    number;
  onDrawn: () => void; // called after canvas draw so caller can revoke the blob
}

function SecurePage({ blobUrl, zoom, onDrawn }: SecurePageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!blobUrl || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();

    img.onload = () => {
      // Size canvas to image
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;

      // Draw the page
      ctx.drawImage(img, 0, 0);

      // ── Watermark layer ──────────────────────────────────────────────
      // Tiled diagonal "SparkL" text across the full page
      ctx.save();
      ctx.globalAlpha   = 0.09;          // very faint — visible but not intrusive
      ctx.fillStyle     = "#6366f1";     // indigo to match brand
      ctx.font          = `bold ${Math.max(28, canvas.width * 0.035)}px Inter, sans-serif`;
      ctx.textAlign     = "center";

      const tileW = canvas.width  * 0.38;
      const tileH = canvas.height * 0.18;

      // Rotate around centre and tile
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(-Math.PI / 7); // ~26°

      const cols = Math.ceil(canvas.width  / tileW) + 2;
      const rows = Math.ceil(canvas.height / tileH) + 2;

      for (let row = -rows; row <= rows; row++) {
        for (let col = -cols; col <= cols; col++) {
          const x = col * tileW;
          const y = row * tileH;
          ctx.fillText("SparkL", x, y);
        }
      }
      ctx.restore();

      // ── "Property of SparkL" footer stamp ───────────────────────────
      ctx.save();
      ctx.globalAlpha = 0.13;
      ctx.fillStyle   = "#6366f1";
      ctx.font        = `${Math.max(14, canvas.width * 0.016)}px Inter, sans-serif`;
      ctx.textAlign   = "right";
      ctx.fillText(
        "Property of SparkL · sparkl.app",
        canvas.width - 16,
        canvas.height - 14,
      );
      ctx.restore();

      // Blob no longer needed — revoke to remove from memory & network cache
      onDrawn();
    };

    img.onerror = () => {
      onDrawn(); // still revoke on error
    };

    img.src = blobUrl;
  }, [blobUrl]);

  return (
    <canvas
      ref={canvasRef}
      onContextMenu={e => e.preventDefault()}
      onDragStart={e => e.preventDefault()}
      style={{
        transform:           `scale(${zoom})`,
        transformOrigin:     "top center",
        maxWidth:            "min(860px, 100%)",
        display:             "block",
        userSelect:          "none",
        WebkitUserSelect:    "none",
        borderRadius:        "8px",
        boxShadow:           "0 4px 24px rgba(0,0,0,0.18)",
        // Canvas blocks right-click save natively — this is the key defence
      }}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SecureViewer({
  questionId,
  onClose,
  isPaid,
  inline = false,
}: SecureViewerProps) {
  const supabase = createClient();

  const [pageCount,    setPageCount]    = useState(0);
  const [currentPage,  setCurrentPage]  = useState(1);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");
  const [zoom,         setZoom]         = useState(1);

  // Blob URL lives in a ref — not in React state so it never appears
  // in React DevTools or gets serialised anywhere.
  const blobUrlRef  = useRef<string | null>(null);
  // Bump this to force SecurePage to re-render with the new blobUrl
  const [drawKey,   setDrawKey]         = useState(0);

  const maxPage = isPaid ? pageCount : Math.min(pageCount, 2);

  // ── Block devtools shortcuts ──────────────────────────────────────────
  useEffect(() => {
    function block(e: KeyboardEvent) {
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && ["I", "J", "C", "K"].includes(e.key.toUpperCase())) ||
        (e.ctrlKey && ["u", "U", "s", "S", "p", "P"].includes(e.key))
      ) {
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", block);
    return () => window.removeEventListener("keydown", block);
  }, []);

  // ── Block right-click everywhere inside the viewer ────────────────────
  useEffect(() => {
    function blockCtx(e: MouseEvent) { e.preventDefault(); }
    document.addEventListener("contextmenu", blockCtx);
    return () => document.removeEventListener("contextmenu", blockCtx);
  }, []);

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
          const d = await res.json();
          setPageCount(d.page_count ?? 1);
        }
      } catch { /* non-critical */ }
    }
    fetchPageCount();
  }, [questionId]);

  // ── Fetch page as blob → store in ref (never in visible state) ────────
  const fetchPage = useCallback(async (page: number) => {
    setLoading(true);
    setError("");

    // Revoke previous blob if still around
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

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
      // Store blob URL in ref — invisible to React DevTools
      blobUrlRef.current = URL.createObjectURL(blob);
      // Trigger SecurePage to draw by bumping the key
      setDrawKey(k => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [questionId]);

  useEffect(() => {
    fetchPage(currentPage);
  }, [currentPage, fetchPage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  // Called by SecurePage after it has drawn to canvas — blob no longer needed
  function handleDrawn() {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }

  function prev() { if (currentPage > 1) setCurrentPage(p => p - 1); }
  function next() { if (currentPage < maxPage) setCurrentPage(p => p + 1); }

  // Keyboard nav — modal only
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

  // ── Toolbar ───────────────────────────────────────────────────────────
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
        <span
          className="text-xs font-medium tabular-nums w-10 text-center"
          style={{ color: "var(--sp-text-3)" }}
        >
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
        minHeight:  inline ? "520px" : undefined,
        flex:       1,
        // Extra drag-prevention on the container
        userSelect:       "none",
        WebkitUserSelect: "none",
      }}
      onDragStart={e => e.preventDefault()}
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

      {/* Canvas renderer — blob URL lives only in the ref, never in DOM/state */}
      {!loading && !error && blobUrlRef.current && (
        <SecurePage
          key={drawKey}
          blobUrl={blobUrlRef.current}
          zoom={zoom}
          onDrawn={handleDrawn}
        />
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
                p === currentPage
                  ? "w-5 bg-indigo-500"
                  : p > maxPage
                  ? "w-2 opacity-20"
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

  // ── Inline mode ───────────────────────────────────────────────────────
  if (inline) {
    return (
      <div
        className="flex flex-col rounded-2xl overflow-hidden border"
        style={{ borderColor: "var(--sp-border)" }}
      >
        {toolbar}
        {pageArea}
        {bottomNav}
      </div>
    );
  }

  // ── Modal / fullscreen mode ───────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--sp-bg)" }}>
      {toolbar}
      {pageArea}
      {bottomNav}
    </div>
  );
}
