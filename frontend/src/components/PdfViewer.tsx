"use client";

import { useEffect, useRef, useState } from "react";

interface PdfViewerProps {
  url: string;
}

export default function PdfViewer({ url }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function render() {
      setLoading(true);
      setError("");

      try {
        // Loaded dynamically (client-only) since pdfjs-dist relies on
        // browser APIs that don't exist during Next.js server rendering.
        const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf");
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

        const pdf = await pdfjsLib.getDocument(url).promise;

        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = "";

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.4 });

          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = "100%";
          canvas.style.height = "auto";
          canvas.style.display = "block";
          canvas.style.marginBottom = "12px";
          canvas.style.borderRadius = "8px";
          // No native right-click "save image as" on the rendered canvas.
          canvas.oncontextmenu = (e) => e.preventDefault();

          const context = canvas.getContext("2d");
          if (!context) continue;

          await page.render({ canvasContext: context, viewport }).promise;

          if (cancelled) return;
          containerRef.current.appendChild(canvas);
        }
      } catch {
        if (!cancelled) setError("Couldn't load this file.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    render();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div
      className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-2"
      onContextMenu={(e) => e.preventDefault()}
    >
      {loading && (
        <p className="py-10 text-center text-sm text-slate-400">Loading file…</p>
      )}
      {error && <p className="py-10 text-center text-sm text-red-500">{error}</p>}
      <div ref={containerRef} />
    </div>
  );
}
