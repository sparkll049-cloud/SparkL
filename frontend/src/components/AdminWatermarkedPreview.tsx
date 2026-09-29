"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Eye, Loader2, X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

type Props = {
  questionId: string;
  mimeType?: string | null;
  open: boolean;
  onClose: () => void;
};

/** Admin-only preview. The API returns a watermarked derivative, never the raw B2 object. */
export default function AdminWatermarkedPreview({ questionId, mimeType, open, onClose }: Props) {
  const supabase = createClient();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setUrl(null);
      setError("");
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (!cancelled) setError("Your session has expired.");
        setLoading(false);
        return;
      }
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/admin/questions/${questionId}/preview-url`,
          { headers: { Authorization: `Bearer ${session.access_token}` } },
        );
        const body = await response.json().catch(() => null);
        if (!response.ok || !body?.url) throw new Error(body?.detail ?? "Preview could not be created.");
        if (!cancelled) setUrl(body.url);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Preview could not be created.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [open, questionId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0D1230]">
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2 text-white">
            <Eye size={16} className="text-blue-400" />
            <div>
              <p className="text-sm font-semibold">Admin review preview</p>
              <p className="text-[11px] text-slate-400">Watermarked and temporary — original file remains private</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Close preview">
            <X size={18} />
          </button>
        </header>

        <div className="min-h-[60vh] overflow-auto bg-slate-900 p-4">
          {loading && <div className="flex h-[60vh] items-center justify-center gap-2 text-sm text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /> Creating watermarked preview…</div>}
          {!loading && error && <div className="flex h-[60vh] items-center justify-center gap-2 text-sm text-red-400"><AlertCircle size={16} /> {error}</div>}
          {!loading && !error && url && mimeType?.startsWith("image/") && <img src={url} alt="Watermarked admin preview" className="mx-auto max-w-full" />}
          {!loading && !error && url && (!mimeType || mimeType === "application/pdf") && <iframe src={url} title="Watermarked admin PDF preview" className="h-[75vh] w-full rounded-lg bg-white" />}
        </div>
      </div>
    </div>
  );
}