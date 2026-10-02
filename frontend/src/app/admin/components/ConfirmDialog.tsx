"use client";

import { AlertTriangle, Loader2, X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  tone?: "danger" | "default";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  tone = "danger",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  const confirmStyles =
    tone === "danger"
      ? "bg-red-600 hover:bg-red-700"
      : "bg-blue-600 hover:bg-blue-700";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-confirm-title"
        aria-describedby="admin-confirm-description"
        className="w-full max-w-sm rounded-2xl border border-[var(--sp-border)] bg-[var(--sp-search-popup)] p-5 text-[var(--sp-text)] shadow-xl"
      >
        <div className="flex items-start justify-between">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${
              tone === "danger" ? "bg-red-500/10" : "bg-blue-500/10"
            }`}
          >
            <AlertTriangle
              size={20}
              className={
                tone === "danger" ? "text-red-500" : "text-blue-500"
              }
            />
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            aria-label="Close confirmation"
            className="rounded-md p-1 text-[var(--sp-text-2)] transition hover:bg-[var(--sp-bg-muted)] hover:text-[var(--sp-text)] disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <h2
          id="admin-confirm-title"
          className="mt-3 text-base font-semibold text-[var(--sp-text)]"
        >
          {title}
        </h2>

        <p
          id="admin-confirm-description"
          className="mt-1.5 text-sm text-[var(--sp-text-2)]"
        >
          {description}
        </p>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl border border-[var(--sp-border)] bg-[var(--sp-bg-muted)] py-2.5 text-sm font-semibold text-[var(--sp-text-2)] transition hover:border-[var(--sp-border-hover)] hover:text-[var(--sp-text)] disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold text-white transition disabled:opacity-60 ${confirmStyles}`}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
