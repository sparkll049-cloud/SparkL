"use client";

/**
 * InlinePaperViewer — clean flat PDF viewer + maximum security
 * ─────────────────────────────────────────────────────────────
 * Visual: white paper card, top toolbar (page X of Y, prev/next),
 *         plain background — matches pastqhub style.
 *
 * Security layers (ALL preserved + extras added):
 *  1. Canvas pixel rendering — no <img> src, no recoverable DOM image
 *  2. Diagonal watermark baked INTO canvas pixels (not CSS overlay)
 *  3. Tile-based delivery — no full page ever sent over the wire
 *  4. Blob URLs — revoked immediately after draw, never stable hrefs
 *  5. pointerEvents:none on canvas — Android Share/save can't latch
 *  6. contextmenu blocked globally
 *  7. dragstart blocked globally
 *  8. PrintScreen / F12 / Ctrl+P / Ctrl+S / Ctrl+U / DevTools keys blocked
 *  9. window.print() replaced with no-op
 * 10. @media print { body hidden } injected via <style>
 * 11. visibilitychange → blur canvas when tab hidden
 * 12. DevTools size-change detection → blur canvas
 * 13. CSS: -webkit-user-select none, touch-action none on container
 * 14. MutationObserver watches for canvas removal/replacement attacks
 * 15. Short-lived token — viewer re-fetches session before every page
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Loader2, AlertCircle, Lock, Sparkles, ArrowRight,
  ChevronLeft, ChevronRight, Crown,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

// ── Grid config — must match backend ────────────────────────────────────────
const TILE_ROWS  = 3;
const TILE_COLS  = 3;
const TILE_COUNT = TILE_ROWS * TILE_COLS;

const CANVAS_WIDTH  = 794;
const CANVAS_HEIGHT = 1123;

interface Props {
  questionId: string;
  isPaid:     boolean;
  userEmail:  string | null;
  maxPages?:  number;
}

interface PageMeta {
  total_pages:    number;
  viewable_pages: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function blurCanvas(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.save();
  ctx.filter = "blur(18px)";
  ctx.drawImage(canvas, 0, 0);
  ctx.restore();
  ctx.filter = "none";

  // Grey veil
  ctx.fillStyle = "rgba(15,15,15,0.72)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Lock icon text
  ctx.fillStyle = "#ffffff";
  ctx.font      = "bold 15px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("🔒  Return to SparkL to continue", canvas.width / 2, canvas.height / 2);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function InlinePaperViewer({ questionId, isPaid, userEmail, maxPages }: Props) {
  const supabase     = createClient();
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [token, setToken]             = useState<string | null>(null);
  const [meta,  setMeta]              = useState<PageMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError,   setMetaError]   = useState("");

  const [currentPage,  setCurrentPage]  = useState(1);
  const [loading,      setLoading]      = useState(false);
  const [loadError,    setLoadError]    = useState("");
  const [isGated,      setIsGated]      = useState(false);
  const [tilesLoaded,  setTilesLoaded]  = useState(0);
  const [obscured,     setObscured]     = useState(false);

  // ── Auth token ─────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? null);
    });
  }, []);

  // ── Page meta ───────────────────────────────────────────────────────────
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

  // ── Watermark (baked into pixels) ──────────────────────────────────────
  const paintWatermark = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const label1 = "SparkL · sparkl.com.ng";
    const label2 = userEmail ? userEmail.slice(0, 42) : "sparkl.com.ng";

    ctx.save();
    ctx.globalAlpha = 0.11;
    ctx.font        = "bold 13px system-ui, sans-serif";
    ctx.fillStyle   = "#6366f1";
    ctx.textAlign   = "center";

    ctx.translate(w / 2, h / 2);
    ctx.rotate(-Math.PI / 6);
    ctx.translate(-w / 2, -h / 2);

    const step = 180;
    for (let x = -w; x < w * 2; x += step) {
      for (let y = -h; y < h * 2; y += step) {
        ctx.fillText(label1, x, y);
        ctx.fillText(label2, x, y + 18);
      }
    }
    ctx.restore();
  }, [userEmail]);

  // ── Page renderer ───────────────────────────────────────────────────────
  const renderPage = useCallback(async (page: number) => {
    if (!canvasRef.current) return;

    // Refresh token before every page load
    const { data: { session } } = await supabase.auth.getSession();
    const tok = session?.access_token ?? token;
    if (!tok) return;

    setLoading(true);
    setLoadError("");
    setIsGated(false);
    setObscured(false);
    setTilesLoaded(0);

    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");
    if (!ctx) return;

    // Clear + light bg
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f8f8f8";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const tileW = canvas.width  / TILE_COLS;
    const tileH = canvas.height / TILE_ROWS;

    const coords: [number, number][] = [];
    for (let r = 0; r < TILE_ROWS; r++)
      for (let c = 0; c < TILE_COLS; c++)
        coords.push([r, c]);

    let gated = false, anyError = false, landed = 0;

    await Promise.all(
      coords.map(async ([r, c]) => {
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/questions/${questionId}/page/${page}/tile/${r}/${c}`,
            { headers: { Authorization: `Bearer ${tok}` } }
          );

          if (res.status === 403) { gated = true; return; }
          if (!res.ok)            { anyError = true; return; }

          const blob   = await res.blob();
          const imgUrl = URL.createObjectURL(blob);

          await new Promise<void>(resolve => {
            const img  = new Image();
            img.onload = () => {
              ctx.drawImage(img, c * tileW, r * tileH, tileW, tileH);
              URL.revokeObjectURL(imgUrl);
              landed += 1;
              setTilesLoaded(landed);
              if (landed === TILE_COUNT) {
                paintWatermark(ctx, canvas.width, canvas.height);
              }
              resolve();
            };
            img.onerror = () => { URL.revokeObjectURL(imgUrl); anyError = true; resolve(); };
            img.src     = imgUrl;
          });
        } catch { anyError = true; }
      })
    );

    if (gated)             setIsGated(true);
    if (anyError && !gated) setLoadError("Some tiles failed to load. Try again.");
    setLoading(false);
  }, [token, questionId, paintWatermark, supabase.auth]);

  useEffect(() => {
    if (meta) renderPage(currentPage);
  }, [meta, currentPage]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Security: visibility + devtools detection ───────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;

    // 1. Tab hidden → blur
    const onVis = () => {
      if (document.visibilityState === "hidden" && canvas && !loading) {
        setObscured(true);
        blurCanvas(canvas);
      } else if (document.visibilityState === "visible") {
        setObscured(false);
        if (meta) renderPage(currentPage);
      }
    };

    // 2. Window blur (alt-tab, mobile home) → blur
    const onBlur  = () => { if (canvas && !loading) { setObscured(true); blurCanvas(canvas); } };
    const onFocus = () => { if (obscured) { setObscured(false); if (meta) renderPage(currentPage); } };

    // 3. DevTools size heuristic
    let devToolsTimer: ReturnType<typeof setInterval>;
    const checkDevTools = () => {
      const threshold = 160;
      if (
        window.outerWidth  - window.innerWidth  > threshold ||
        window.outerHeight - window.innerHeight > threshold
      ) {
        if (canvas && !loading) { setObscured(true); blurCanvas(canvas); }
      }
    };
    devToolsTimer = setInterval(checkDevTools, 1500);

    // 4. Keyboard blocks
    const blockKeys = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const sh   = e.shiftKey;
      if (
        e.key === "PrintScreen" ||
        e.key === "F12"         ||
        (ctrl && e.key === "p") ||
        (ctrl && e.key === "s") ||
        (ctrl && e.key === "u") ||
        (ctrl && sh && "sijck".includes(e.key.toLowerCase())) ||
        (e.metaKey && sh && "345s".includes(e.key))
      ) { e.preventDefault(); e.stopPropagation(); }
    };

    // 5. No context menu / drag
    const noCtx  = (e: MouseEvent) => e.preventDefault();
    const noDrag = (e: DragEvent)  => e.preventDefault();

    // 6. Silence window.print
    const origPrint = window.print;
    window.print    = () => {};

    // 7. Print CSS
    const style = document.createElement("style");
    style.id    = "__sp_np__";
    style.textContent = `
      @media print {
        body > * { display: none !important; }
        #__sp_viewer__ { display: none !important; }
      }
      #__sp_viewer__ canvas {
        -webkit-user-select: none;
        user-select: none;
        touch-action: none;
        -webkit-touch-callout: none;
      }
    `;
    document.head.appendChild(style);

    // 8. MutationObserver — detect canvas tampering
    const observer = new MutationObserver(() => {
      if (canvasRef.current && !document.contains(canvasRef.current)) {
        // Canvas was removed from DOM — re-add blur state
        setObscured(true);
      }
    });
    if (containerRef.current) {
      observer.observe(containerRef.current, { childList: true, subtree: true });
    }

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur",        onBlur);
    window.addEventListener("focus",       onFocus);
    document.addEventListener("keydown",   blockKeys, true);
    document.addEventListener("contextmenu", noCtx,  true);
    document.addEventListener("dragstart", noDrag,   true);

    return () => {
      clearInterval(devToolsTimer);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur",        onBlur);
      window.removeEventListener("focus",       onFocus);
      document.removeEventListener("keydown",   blockKeys, true);
      document.removeEventListener("contextmenu", noCtx,  true);
      document.removeEventListener("dragstart", noDrag,   true);
      window.print = origPrint;
      document.getElementById("__sp_np__")?.remove();
      observer.disconnect();
    };
  }, [loading, meta, currentPage, obscured, renderPage]);

  // ── Derived ─────────────────────────────────────────────────────────────
  const effectiveViewable = meta
    ? maxPages !== undefined ? Math.min(meta.viewable_pages, maxPages) : meta.viewable_pages
    : 0;

  const canGoPrev   = currentPage > 1;
  const canGoNext   = currentPage < effectiveViewable;
  const lockedCount = meta ? meta.total_pages - effectiveViewable : 0;
  const progress    = Math.round((tilesLoaded / TILE_COUNT) * 100);

  // ── UI ───────────────────────────────────────────────────────────────────
  if (metaLoading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-indigo-500"/>
    </div>
  );

  if (metaError) return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <AlertCircle className="h-5 w-5 text-red-400"/>
      <p className="text-sm text-red-400">{metaError}</p>
    </div>
  );

  return (
    <div id="__sp_viewer__" ref={containerRef} className="flex flex-col gap-0 select-none">

      {/* ── Top toolbar (pastqhub style) ── */}
      <div
        className="flex items-center justify-between rounded-t-2xl border border-b-0 px-4 py-2.5"
        style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
      >
        {/* Prev */}
        <button
          onClick={() => setCurrentPage(p => p - 1)}
          disabled={!canGoPrev || loading}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-30"
          style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-muted)", color: "var(--sp-text-2)" }}
        >
          <ChevronLeft size={13}/> Prev
        </button>

        {/* Page counter */}
        <div className="flex items-center gap-2">
          {loading && (
            <div className="h-1 w-20 overflow-hidden rounded-full" style={{ background: "var(--sp-border)" }}>
              <div className="h-full rounded-full bg-indigo-500 transition-all duration-200"
                style={{ width: `${progress}%` }}/>
            </div>
          )}
          <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--sp-text-2)" }}>
            Page {currentPage} of {effectiveViewable}
            {!isPaid && lockedCount > 0 && (
              <span className="ml-2 font-normal" style={{ color: "var(--sp-text-3)" }}>
                · {lockedCount} locked
              </span>
            )}
          </span>
        </div>

        {/* Next */}
        <button
          onClick={() => setCurrentPage(p => p + 1)}
          disabled={!canGoNext || loading}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-30"
          style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-muted)", color: "var(--sp-text-2)" }}
        >
          Next <ChevronRight size={13}/>
        </button>
      </div>

      {/* ── Canvas card (flat white paper look) ── */}
      <div
        className="relative w-full overflow-hidden rounded-b-2xl border"
        style={{
          background:   "#ffffff",
          borderColor:  "var(--sp-border)",
          minHeight:    380,
          boxShadow:    "0 2px 16px rgba(0,0,0,0.07)",
        }}
      >
        {/* Canvas — always mounted */}
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full"
          style={{
            display:              isGated ? "none" : "block",
            userSelect:           "none",
            WebkitUserSelect:     "none",
            pointerEvents:        "none",
            touchAction:          "none",
            WebkitTouchCallout:   "none",
          } as React.CSSProperties}
          onContextMenu={e => e.preventDefault()}
        />

        {/* Loading overlay */}
        {loading && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3"
            style={{ background: "rgba(255,255,255,0.92)" }}
          >
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500"/>
            <p className="text-xs" style={{ color: "var(--sp-text-3)" }}>
              Loading page {currentPage}… {tilesLoaded}/{TILE_COUNT} tiles
            </p>
          </div>
        )}

        {/* Gated overlay */}
        {isGated && (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 p-10 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10">
              <Lock className="h-5 w-5 text-indigo-500"/>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--sp-text)" }}>
                {lockedCount} page{lockedCount !== 1 ? "s" : ""} locked
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--sp-text-3)" }}>
                Free accounts get a 1-page preview.
              </p>
            </div>
            <Link href="/dashboard/subscribe"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 transition">
              <Crown className="h-3.5 w-3.5"/>
              Unlock all pages
              <ArrowRight className="h-3.5 w-3.5"/>
            </Link>
          </div>
        )}

        {/* Load error */}
        {loadError && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <AlertCircle className="h-5 w-5 text-red-400"/>
            <p className="text-sm text-red-400">{loadError}</p>
            <button onClick={() => renderPage(currentPage)}
              className="text-xs font-semibold text-indigo-400 hover:underline">
              Try again
            </button>
          </div>
        )}

        {/* Obscured overlay (tab hidden / devtools) */}
        {obscured && !loading && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-b-2xl"
            style={{ background: "var(--sp-bg-card)", backdropFilter: "blur(24px)" }}
          >
            <Lock className="h-7 w-7" style={{ color: "var(--sp-text-3)" }}/>
            <p className="text-sm font-bold" style={{ color: "var(--sp-text)" }}>Content hidden</p>
            <p className="text-xs" style={{ color: "var(--sp-text-3)" }}>Return to SparkL to continue</p>
          </div>
        )}
      </div>

      {/* ── Dot page indicators (below card) ── */}
      {meta && effectiveViewable > 1 && !isGated && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {Array.from({ length: Math.min(effectiveViewable, 8) }, (_, i) => {
            const pg = i + 1;
            return (
              <button key={pg} onClick={() => !loading && setCurrentPage(pg)}
                className="rounded-full transition-all"
                style={{
                  width:      pg === currentPage ? "20px" : "7px",
                  height:     "7px",
                  background: pg === currentPage ? "#6366f1" : "var(--sp-border)",
                }}
              />
            );
          })}
          {effectiveViewable > 8 && (
            <span className="text-[10px]" style={{ color: "var(--sp-text-3)" }}>
              +{effectiveViewable - 8} more
            </span>
          )}
        </div>
      )}

      {/* ── Upgrade nudge (free users) ── */}
      {!isPaid && lockedCount > 0 && !isGated && (
        <div className="mt-3 rounded-xl border px-4 py-3 text-center"
          style={{ borderColor: "rgba(99,102,241,0.2)", background: "rgba(99,102,241,0.05)" }}>
          <p className="text-xs font-semibold" style={{ color: "var(--sp-text)" }}>
            Viewing 1-page free preview
          </p>
          <p className="mt-0.5 text-[11px]" style={{ color: "var(--sp-text-3)" }}>
            Upgrade to access all {meta?.total_pages} pages and download.
          </p>
          <Link href="/dashboard/subscribe"
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 transition">
            <Sparkles className="h-3 w-3"/> Upgrade now
          </Link>
        </div>
      )}
    </div>
  );
}
