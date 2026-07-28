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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${
              tone === "danger" ? "bg-red-50" : "bg-blue-50"
            }`}
          >
            <AlertTriangle
              size={20}
              className={tone === "danger" ? "text-red-500" : "text-blue-600"}
            />
          </div>
          <button
            onClick={onCancel}
            disabled={loading}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <h2 className="mt-3 text-base font-semibold text-slate-900">
          {title}
        </h2>
        <p className="mt-1.5 text-sm text-slate-500">{description}</p>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl bg-slate-50 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
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