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

export default function AdminWatermarkedPreview({
  questionId,
  mimeType,
  open,
  onClose,
}: Props) {
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
      setUrl(null);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          throw new Error("Your session has expired.");
        }

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/admin/questions/${questionId}/preview-url`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        const body = await response.json().catch(() => null);

        if (!response.ok || !body?.url) {
          throw new Error(
            body?.detail ?? "Preview could not be created."
          );
        }

        if (!cancelled) setUrl(body.url);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Preview could not be created."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [open, questionId]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-preview-title"
    >
      <div className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[var(--sp-border)] bg-[var(--sp-search-popup)] text-[var(--sp-text)] shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--sp-border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <Eye
              size={16}
              className="shrink-0 text-blue-500"
            />

            <div>
              <p
                id="admin-preview-title"
                className="text-sm font-semibold text-[var(--sp-text)]"
              >
                Admin review preview
              </p>
              <p className="text-[11px] text-[var(--sp-text-2)]">
                Watermarked and temporary. Original file remains private.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="shrink-0 rounded-lg p-2 text-[var(--sp-text-2)] transition hover:bg-[var(--sp-bg-muted)] hover:text-[var(--sp-text)]"
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-[60vh] overflow-auto bg-[var(--sp-bg)] p-4">
          {loading && (
            <div className="flex h-[60vh] items-center justify-center gap-2 text-sm text-[var(--sp-text-2)]">
              <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
              Creating watermarked preview…
            </div>
          )}

          {!loading && error && (
            <div className="flex h-[60vh] items-center justify-center gap-2 text-sm text-red-500">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          {!loading &&
            !error &&
            url &&
            mimeType?.startsWith("image/") && (
              <img
                src={url}
                alt="Watermarked admin preview"
                className="mx-auto max-w-full"
              />
            )}

          {!loading &&
            !error &&
            url &&
            (!mimeType || mimeType === "application/pdf") && (
              <iframe
                src={url}
                title="Watermarked admin PDF preview"
                className="h-[75vh] w-full rounded-lg bg-white"
              />
            )}
        </div>
      </div>
    </div>
  );
}
