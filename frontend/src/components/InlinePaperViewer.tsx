"use client";

/**
 * InlinePaperViewer — canvas tile renderer
 * ─────────────────────────────────────────
 * Drop this file anywhere in your components/ folder and import it in
 * QuestionDetailPage in place of the old InlinePaperViewer.
 *
 * How it works:
 *  1. Fetches page meta (total_pages, viewable_pages) from /page-count
 *  2. For each page, fires TILE_ROWS × TILE_COLS parallel fetch calls to
 *     /page/{page}/tile/{row}/{col}
 *  3. Stitches tiles onto a <canvas> as they arrive (progressive render)
 *  4. Bakes a diagonal watermark (brand + user email) into the canvas pixels
 *     AFTER stitching — it's part of the image data, not a CSS overlay
 *
 * Why canvas beats <img>:
 *  - Android Share → Long Screenshot captures the DOM; canvas pixel data is
 *    not a recoverable image from the DOM tree
 *  - The source tile URLs are short-lived blob: URLs, never stable hrefs
 *  - No single full-page image is ever delivered over the wire
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Loader2, AlertCircle, Lock, Sparkles, ArrowRight,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

// ── Grid config — must match backend TILE_ROWS / TILE_COLS ───────────────────
const TILE_ROWS = 3;
const TILE_COLS = 3;
const TILE_COUNT = TILE_ROWS * TILE_COLS;

// Canvas dimensions — backend tiles are cropped proportionally,
// so we size the canvas to a standard A4-ish aspect ratio.
// Actual pixel values don't matter much; tiles fill it proportionally.
const CANVAS_WIDTH  = 794;   // ~A4 at 96dpi
const CANVAS_HEIGHT = 1123;

interface Props {
  questionId: string;
  isPaid: boolean;
  userEmail: string | null;
  maxPages?: number;
}

interface PageMeta {
  total_pages: number;
  viewable_pages: number;
}

export default function InlinePaperViewer({ questionId, isPaid, userEmail, maxPages }: Props) {
  const supabase    = createClient();
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [token, setToken]             = useState<string | null>(null);
  const [meta, setMeta]               = useState<PageMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError]     = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading]         = useState(false);
  const [loadError, setLoadError]     = useState("");
  const [isGated, setIsGated]         = useState(false);
  // How many tiles have landed so far (for progress indicator)
  const [tilesLoaded, setTilesLoaded] = useState(0);

  // ── Get auth token ──────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? null);
    });
  }, []);

  // ── Fetch page count ────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    setMetaLoading(true);
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/questions/${questionId}/page-count`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => { if (!r.ok) throw new Error("Could not load paper."); return r.json(); })
      .then(setMeta)
      .catch(e => setMetaError(e.message))
      .finally(() => setMetaLoading(false));
  }, [token, questionId]);

  // ── Watermark painter ───────────────────────────────────────────────────
  const paintWatermark = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const line1 = "SparkL · sparkl.com.ng";
    const line2 = userEmail ? userEmail.slice(0, 42) : "sparkl.com.ng";

    ctx.save();
    ctx.globalAlpha = 0.13;
    ctx.font        = "bold 14px system-ui, sans-serif";
    ctx.fillStyle   = "#6366f1";
    ctx.textAlign   = "center";

    // Rotate canvas context -30° around centre and tile the text
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-Math.PI / 6);
    ctx.translate(-w / 2, -h / 2);

    const step = 190;
    for (let x = -w; x < w * 2; x += step) {
      for (let y = -h; y < h * 2; y += step) {
        ctx.fillText(line1, x, y);
        ctx.fillText(line2, x, y + 20);
      }
    }
    ctx.restore();
  }, [userEmail]);

  // ── Render one page via parallel tile fetches ───────────────────────────
  const renderPage = useCallback(async (page: number) => {
    if (!token || !canvasRef.current) return;

    setLoading(true);
    setLoadError("");
    setIsGated(false);
    setTilesLoaded(0);

    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas immediately so user sees it reset
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Light background while loading
    ctx.fillStyle = "var(--sp-bg, #0f0f0f)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const tileW = canvas.width  / TILE_COLS;
    const tileH = canvas.height / TILE_ROWS;

    // Build all (row, col) pairs
    const coords: [number, number][] = [];
    for (let r = 0; r < TILE_ROWS; r++)
      for (let c = 0; c < TILE_COLS; c++)
        coords.push([r, c]);

    // Fire all tile fetches in parallel
    let gated    = false;
    let anyError = false;

    await Promise.all(
      coords.map(async ([r, c]) => {
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/questions/${questionId}/page/${page}/tile/${r}/${c}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (res.status === 403) {
            gated = true;
            return;
          }
          if (!res.ok) {
            anyError = true;
            return;
          }

          const blob   = await res.blob();
          const imgUrl = URL.createObjectURL(blob);

          // Draw tile as soon as it arrives
          await new Promise<void>((resolve) => {
            const img    = new Image();
            img.onload   = () => {
              ctx.drawImage(img, c * tileW, r * tileH, tileW, tileH);
              URL.revokeObjectURL(imgUrl);
              setTilesLoaded(prev => {
                const next = prev + 1;
                // Bake watermark once all tiles are in
                if (next === TILE_COUNT) {
                  paintWatermark(ctx, canvas.width, canvas.height);
                }
                return next;
              });
              resolve();
            };
            img.onerror  = () => { URL.revokeObjectURL(imgUrl); anyError = true; resolve(); };
            img.src      = imgUrl;
          });
        } catch {
          anyError = true;
        }
      })
    );

    if (gated)    setIsGated(true);
    if (anyError && !gated) setLoadError("Some tiles failed to load. Try again.");
    setLoading(false);
  }, [token, questionId, paintWatermark]);

  // Re-render when page changes
  useEffect(() => {
    if (meta) renderPage(currentPage);
  }, [meta, currentPage]);

  // ── Block all capture vectors ───────────────────────────────────────────
  useEffect(() => {
    const blockKeys = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const sh   = e.shiftKey;
      if (
        e.key === "PrintScreen" || e.key === "F12"        ||
        (ctrl && e.key === "p")  || (ctrl && e.key === "s") ||
        (ctrl && sh && "sijcku".includes(e.key.toLowerCase())) ||
        (e.metaKey && sh && "345".includes(e.key))
      ) { e.preventDefault(); e.stopPropagation(); }
    };
    const noCtx  = (e: MouseEvent) => e.preventDefault();
    const noDrag = (e: DragEvent)  => e.preventDefault();
    const origPrint = window.print;
    window.print    = () => {};

    const style = document.createElement("style");
    style.id    = "__sp_np__";
    style.textContent = `
      @media print { body > * { display:none!important } }
      #__sp_canvas__ { -webkit-user-select:none; user-select:none; }
    `;
    document.head.appendChild(style);

    document.addEventListener("keydown",     blockKeys, true);
    document.addEventListener("contextmenu", noCtx,     true);
    document.addEventListener("dragstart",   noDrag,    true);

    return () => {
      document.removeEventListener("keydown",     blockKeys, true);
      document.removeEventListener("contextmenu", noCtx,     true);
      document.removeEventListener("dragstart",   noDrag,    true);
      window.print = origPrint;
      document.getElementById("__sp_np__")?.remove();
    };
  }, []);

  // ── Derived state ───────────────────────────────────────────────────────
  const effectiveViewablePages = meta
    ? maxPages !== undefined
      ? Math.min(meta.viewable_pages, maxPages)
      : meta.viewable_pages
    : 0;

  const canGoPrev   = currentPage > 1;
  const canGoNext   = currentPage < effectiveViewablePages;
  const lockedCount = meta ? meta.total_pages - effectiveViewablePages : 0;
  const progress    = TILE_COUNT > 0 ? Math.round((tilesLoaded / TILE_COUNT) * 100) : 0;

  // ── Render ──────────────────────────────────────────────────────────────
  if (metaLoading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
    </div>
  );

  if (metaError) return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <AlertCircle className="h-6 w-6 text-red-400" />
      <p className="text-sm text-red-400">{metaError}</p>
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-4">

      {/* ── Canvas area ── */}
      <div
        ref={containerRef}
        id="__sp_canvas__"
        className="relative w-full rounded-2xl overflow-hidden"
        style={{ background: "var(--sp-bg, #0f0f0f)", minHeight: 320 }}
      >
        {/* The canvas — always mounted so context is ready */}
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full rounded-2xl"
          style={{
            display: isGated ? "none" : "block",
            userSelect: "none",
            WebkitUserSelect: "none",
            // pointerEvents none so Android Share/save hooks can't latch on
            pointerEvents: "none",
          }}
          onContextMenu={e => e.preventDefault()}
        />

        {/* Loading overlay — shows tile progress */}
        {loading && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl"
            style={{ background: "var(--sp-bg, #0f0f0f)" }}
          >
            <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
            <div className="flex flex-col items-center gap-1.5">
              <p className="text-sm" style={{ color: "var(--sp-text-3, #888)" }}>
                Loading page {currentPage}…
              </p>
              {/* Tile progress bar */}
              <div
                className="h-1 w-32 rounded-full overflow-hidden"
                style={{ background: "var(--sp-border, #333)" }}
              >
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[10px]" style={{ color: "var(--sp-text-3, #666)" }}>
                {tilesLoaded}/{TILE_COUNT} tiles
              </p>
            </div>
          </div>
        )}

        {/* Gated overlay */}
        {isGated && (
          <div
            className="flex flex-col items-center gap-4 p-10 text-center"
            style={{ minHeight: 320 }}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/15">
              <Lock className="h-5 w-5 text-indigo-500" />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--sp-text, #fff)" }}>
                {lockedCount} page{lockedCount !== 1 ? "s" : ""} locked
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--sp-text-3, #888)" }}>
                Free accounts can read the first 2 pages.
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
        )}

        {/* Load error */}
        {loadError && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
            <AlertCircle className="h-6 w-6 text-red-400" />
            <p className="text-sm text-red-400">{loadError}</p>
            <button
              onClick={() => renderPage(currentPage)}
              className="text-xs font-semibold text-indigo-400 hover:underline"
            >
              Try again
            </button>
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      {meta && !isGated && (
        <div className="flex w-full items-center justify-between">
          <button
            onClick={() => setCurrentPage(p => p - 1)}
            disabled={!canGoPrev || loading}
            className="flex items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-semibold transition disabled:opacity-30"
            style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-muted)", color: "var(--sp-text-2)" }}
          >
            <ChevronLeft size={14} /> Previous
          </button>

          {/* Dot indicators */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: Math.min(effectiveViewablePages, 7) }, (_, i) => {
              const page = i + 1;
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  disabled={loading}
                  className="h-2 w-2 rounded-full transition-all disabled:opacity-40"
                  style={{
                    background: page === currentPage ? "#6366f1" : "var(--sp-border)",
                    transform:  page === currentPage ? "scale(1.4)" : "scale(1)",
                  }}
                />
              );
            })}
            {effectiveViewablePages > 7 && (
              <span className="text-[10px]" style={{ color: "var(--sp-text-3)" }}>
                …{effectiveViewablePages - 7} more
              </span>
            )}
          </div>

          <button
            onClick={() => setCurrentPage(p => p + 1)}
            disabled={!canGoNext || loading}
            className="flex items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-semibold transition disabled:opacity-30"
            style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-muted)", color: "var(--sp-text-2)" }}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Page counter */}
      {meta && (
        <p className="text-[10px]" style={{ color: "var(--sp-text-3)" }}>
          Page {currentPage} of {effectiveViewablePages}
          {!isPaid && meta.total_pages > effectiveViewablePages && (
            <span className="ml-1.5 text-indigo-400">
              · {meta.total_pages - effectiveViewablePages} pages locked
            </span>
          )}
        </p>
      )}
    </div>
  );
}
