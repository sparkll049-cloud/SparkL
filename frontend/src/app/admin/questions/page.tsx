"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2, FileText, CheckCircle2, XCircle, Trash2,
  ExternalLink, ChevronDown, Pencil, Sparkles, Clock,
  AlertCircle, Play, RefreshCw,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import ConfirmDialog from "../components/ConfirmDialog";
import QuestionReviewPanel from "@/components/QuestionReviewPanel";
import AdminPaperViewer from "@/components/AdminPaperViewer";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Question {
  id: string;
  title: string;
  year: string | null;
  status: "pending" | "approved" | "rejected";
  processing_status?: "uploaded" | "extracting" | "ready" | "failed";
  processing_error?: string | null;
  created_at: string;
  mime_type: string | null;
  // extracted_text is NOT in list response — fetched on demand
  rejection_reason: string | null;
  extraction_quality: number | null;
  course: { name: string } | null;
  semester: { name: string } | null;
  uploader: { full_name: string | null } | null;
  ai_processed: boolean;
}

interface QuestionWithText extends Question {
  extracted_text: string | null;
}

const TABS = [
  { key: "pending",  label: "Pending"  },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "",         label: "All"      },
] as const;

const PANEL_THEME = {
  "--sp-input-bg": "rgba(255,255,255,0.04)",
  "--sp-border":   "rgba(255,255,255,0.10)",
  "--sp-bg-card":  "rgba(255,255,255,0.02)",
  "--sp-text":     "#e2e8f0",
  "--sp-text-2":   "#cbd5e1",
  "--sp-text-3":   "#64748b",
} as React.CSSProperties;

// ── Error boundary for QuestionReviewPanel ────────────────────────────────────

import React from "react";

class ReviewPanelBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 mt-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          <p className="text-xs text-red-400">
            Failed to load review panel. {this.state.message}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, message: "" })}
            className="ml-auto text-xs text-slate-500 hover:text-slate-300"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Status pill ───────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; label: string; icon: React.ReactNode }> = {
    pending:  { bg: "bg-amber-500/10 text-amber-400 border border-amber-500/20",       label: "Pending",  icon: <Clock        className="h-3 w-3" /> },
    approved: { bg: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20", label: "Approved", icon: <CheckCircle2 className="h-3 w-3" /> },
    rejected: { bg: "bg-red-500/10 text-red-400 border border-red-500/20",             label: "Rejected", icon: <XCircle      className="h-3 w-3" /> },
  };
  const s = map[status] ?? map.pending;
  return (
    <span className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.bg}`}>
      {s.icon}{s.label}
    </span>
  );
}

// ── Processing badge ──────────────────────────────────────────────────────────

function ProcessingBadge({
  s, errorMsg, retryError, onProcess, processing,
}: {
  s?: string;
  errorMsg?: string | null;
  retryError?: string | null;
  onProcess: () => void;
  processing: boolean;
}) {
  if (!s || s === "ready") return null;

  if (s === "failed") return (
    <div className="mt-2 space-y-1.5">
      <p className="flex items-center gap-1.5 text-xs text-red-400">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        Processing failed{errorMsg ? `: ${errorMsg}` : ""}
      </p>
      {retryError && (
        <p className="flex items-center gap-1.5 text-xs text-red-300">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {retryError}
        </p>
      )}
      <button
        onClick={onProcess}
        disabled={processing}
        className="flex items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-400 transition hover:bg-blue-500/20 disabled:opacity-50"
      >
        {processing ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
        {processing ? "Processing…" : "Process now"}
      </button>
    </div>
  );

  if (s === "extracting") return (
    <p className="mt-2 flex items-center gap-1.5 text-xs text-blue-400">
      <Loader2 className="h-3 w-3 animate-spin" />
      Extracting text…
    </p>
  );

  return (
    <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
      <Loader2 className="h-3 w-3 animate-spin" />
      Processing…
    </p>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminQuestionsPage() {
  const supabase = createClient();

  const [questions,   setQuestions]   = useState<Question[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [activeTab,   setActiveTab]   = useState<string>("pending");
  const [actioningId, setActioningId] = useState<string | null>(null);

  // Expanded extracted text (loaded on demand)
  const [expandedId,    setExpandedId]    = useState<string | null>(null);
  const [expandedText,  setExpandedText]  = useState<Record<string, string | null>>({});
  const [expandLoading, setExpandLoading] = useState<string | null>(null);

  const [reviewId,  setReviewId]  = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Per-question processing state
  const [processingMap, setProcessingMap] = useState<
    Record<string, { active: boolean; error: string | null }>
  >({});

  // Polling refs — keyed by question id
  const pollRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  // Confirm dialogs
  const [deleteTarget,    setDeleteTarget]    = useState<Question | null>(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [rejectTarget,    setRejectTarget]    = useState<Question | null>(null);
  const [rejectReason,    setRejectReason]    = useState("");

  // Inline text editing
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [editText,     setEditText]     = useState("");
  const [savingTextId, setSavingTextId] = useState<string | null>(null);
  const [textError,    setTextError]    = useState("");

  // ── Token helper ─────────────────────────────────────────────────────────

  const getToken = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const expiresAt      = session.expires_at ? session.expires_at * 1000 : 0;
    const isExpiringSoon = expiresAt - Date.now() < 60_000;
    if (isExpiringSoon) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      return refreshed.session?.access_token ?? null;
    }
    return session.access_token;
  }, [supabase]);

  // ── Poll helpers — defined before loadQuestions ───────────────────────────

  const stopPolling = useCallback((id: string) => {
    if (pollRefs.current[id]) {
      clearInterval(pollRefs.current[id]);
      delete pollRefs.current[id];
    }
  }, []);

  const startPolling = useCallback((id: string) => {
    if (pollRefs.current[id]) return; // already polling

    const interval = setInterval(async () => {
      const token = await getToken();
      if (!token) { stopPolling(id); return; }

      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/admin/questions/${id}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) return;
        const updated: Question = await res.json();

        setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...updated } : q));

        if (updated.processing_status === "ready" || updated.processing_status === "failed") {
          stopPolling(id);
          setProcessingMap(prev => ({
            ...prev,
            [id]: {
              active: false,
              error: updated.processing_status === "failed"
                ? (updated.processing_error ?? "Unknown error")
                : null,
            },
          }));
        }
      } catch {
        // swallow — retries on next tick
      }
    }, 3000);

    pollRefs.current[id] = interval;
  }, [getToken, stopPolling]);

  // ── Clean up polls when tab changes or component unmounts ─────────────────

  useEffect(() => {
    // Stop polling questions that are no longer in the list
    return () => {
      Object.keys(pollRefs.current).forEach(stopPolling);
    };
  }, [stopPolling]);

  useEffect(() => {
    // When activeTab changes, stop all existing polls (new list will restart relevant ones)
    Object.keys(pollRefs.current).forEach(stopPolling);
  }, [activeTab, stopPolling]);

  // ── Load questions ────────────────────────────────────────────────────────

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setError("");
    setSelected(new Set());
    setExpandedId(null);
    setExpandedText({});
    setReviewId(null);
    setEditingId(null);

    const token = await getToken();
    if (!token) { setError("Session expired."); setLoading(false); return; }

    try {
      const url = new URL(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/questions`);
      if (activeTab) url.searchParams.set("status", activeTab);
      const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to load past questions.");
      const data: Question[] = await res.json();
      setQuestions(data);

      // Auto-start polling for in-progress items
      for (const q of data) {
        if (q.processing_status === "uploaded" || q.processing_status === "extracting") {
          startPolling(q.id);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [activeTab, getToken, startPolling]);

  useEffect(() => { loadQuestions(); }, [loadQuestions]);

  // ── Expand extracted text (lazy load) ────────────────────────────────────

  async function toggleExpand(q: Question) {
    if (editingId === q.id) return;

    if (expandedId === q.id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(q.id);

    // Already fetched
    if (expandedText[q.id] !== undefined) return;

    setExpandLoading(q.id);
    const token = await getToken();
    if (!token) { setExpandLoading(null); return; }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/questions/${q.id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error("Failed to load text.");
      const detail = await res.json();
      setExpandedText(prev => ({ ...prev, [q.id]: detail.extracted_text ?? null }));
    } catch {
      setExpandedText(prev => ({ ...prev, [q.id]: null }));
    } finally {
      setExpandLoading(null);
    }
  }

  // ── Start editing (also lazy-loads text if needed) ────────────────────────

  async function startEditing(q: Question) {
    setExpandedId(q.id);
    setTextError("");

    // Use cached text if available
    if (expandedText[q.id] !== undefined) {
      setEditText(expandedText[q.id] ?? "");
      setEditingId(q.id);
      return;
    }

    setExpandLoading(q.id);
    const token = await getToken();
    if (!token) { setExpandLoading(null); return; }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/questions/${q.id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error("Failed to load text.");
      const detail = await res.json();
      const text = detail.extracted_text ?? "";
      setExpandedText(prev => ({ ...prev, [q.id]: text }));
      setEditText(text);
    } catch {
      setTextError("Could not load extracted text.");
      setExpandedText(prev => ({ ...prev, [q.id]: null }));
    } finally {
      setExpandLoading(null);
      setEditingId(q.id);
    }
  }

  function cancelEditing() {
    setEditingId(null);
    setEditText("");
    setTextError("");
  }

  async function saveExtractedText(id: string) {
    const trimmed = editText.trim();
    if (!trimmed) { setTextError("Extracted text cannot be empty."); return; }
    setSavingTextId(id);
    const token = await getToken();
    if (!token) { setSavingTextId(null); return; }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/questions/${id}/text`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ extracted_text: trimmed }),
        },
      );
      if (!res.ok) throw new Error("Failed to save changes.");
      // Update the cached expanded text
      setExpandedText(prev => ({ ...prev, [id]: trimmed }));
      setEditingId(null);
      setEditText("");
    } catch (err) {
      setTextError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSavingTextId(null);
    }
  }

  // ── Trigger GitHub Actions processing ─────────────────────────────────────

  async function triggerProcessing(id: string) {
    setProcessingMap(prev => ({ ...prev, [id]: { active: true, error: null } }));

    const token = await getToken();
    if (!token) {
      setProcessingMap(prev => ({ ...prev, [id]: { active: false, error: "Session expired." } }));
      return;
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/questions/${id}/retry`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } },
      );

      if (!res.ok) {
        let msg = "Could not start processing.";
        try {
          const body = await res.json();
          msg = body.detail ?? body.message ?? body.error ?? msg;
        } catch {
          try { msg = (await res.text()) || msg; } catch { /* ignore */ }
        }
        setProcessingMap(prev => ({ ...prev, [id]: { active: false, error: msg } }));
        return;
      }

      setQuestions(prev =>
        prev.map(q =>
          q.id === id ? { ...q, processing_status: "uploaded" as const, processing_error: null } : q,
        ),
      );
      setProcessingMap(prev => ({ ...prev, [id]: { active: true, error: null } }));
      startPolling(id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unexpected error.";
      setProcessingMap(prev => ({ ...prev, [id]: { active: false, error: msg } }));
    }
  }

  // ── Status update ─────────────────────────────────────────────────────────

  async function updateStatus(id: string, status: "approved" | "pending") {
    setActioningId(id);
    const token = await getToken();
    if (!token) { setError("Session expired."); setActioningId(null); return; }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/questions/${id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ status }),
        },
      );
      if (!res.ok) throw new Error("Failed to update status.");
      if (activeTab && activeTab !== status) {
        setQuestions(prev => prev.filter(q => q.id !== id));
      } else {
        setQuestions(prev => prev.map(q => q.id === id ? { ...q, status } : q));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setActioningId(null);
    }
  }

  // ── Reject ────────────────────────────────────────────────────────────────

  async function submitReject() {
    if (!rejectTarget || !rejectReason.trim()) return;
    setActioningId(rejectTarget.id);
    const token = await getToken();
    if (!token) { setActioningId(null); setRejectTarget(null); return; }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/questions/${rejectTarget.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ status: "rejected", reason: rejectReason.trim() }),
        },
      );
      if (!res.ok) throw new Error("Failed to reject.");
      if (activeTab && activeTab !== "rejected") {
        setQuestions(prev => prev.filter(q => q.id !== rejectTarget.id));
      } else {
        setQuestions(prev =>
          prev.map(q =>
            q.id === rejectTarget.id
              ? { ...q, status: "rejected" as const, rejection_reason: rejectReason.trim() }
              : q,
          ),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setActioningId(null);
      setRejectTarget(null);
      setRejectReason("");
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function performDelete(id: string) {
    setActioningId(id);
    stopPolling(id);
    const token = await getToken();
    if (!token) { setActioningId(null); setDeleteTarget(null); return; }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/questions/${id}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error("Failed to delete.");
      setQuestions(prev => prev.filter(q => q.id !== id));
      // Clean up any cached text for deleted item
      setExpandedText(prev => { const n = { ...prev }; delete n[id]; return n; });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setActioningId(null);
      setDeleteTarget(null);
    }
  }

  // ── Selection helpers ─────────────────────────────────────────────────────

  function toggleSelected(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === questions.length) setSelected(new Set());
    else setSelected(new Set(questions.map(q => q.id)));
  }

  // ── Bulk approve ──────────────────────────────────────────────────────────

  async function performBulkApprove() {
    setBulkLoading(true);
    const token = await getToken();
    if (!token) { setBulkLoading(false); setBulkConfirmOpen(false); return; }
    const ids = Array.from(selected);

    try {
      const results = await Promise.all(
        ids.map(async id => {
          try {
            const res = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/api/admin/questions/${id}/status`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ status: "approved" }),
              },
            );
            return { id, ok: res.ok };
          } catch {
            return { id, ok: false };
          }
        }),
      );

      const okIds  = new Set(results.filter(r => r.ok).map(r => r.id));
      const failed = results.length - okIds.size;

      if (activeTab && activeTab !== "approved") {
        setQuestions(prev => prev.filter(q => !okIds.has(q.id)));
      } else {
        setQuestions(prev =>
          prev.map(q => okIds.has(q.id) ? { ...q, status: "approved" as const } : q),
        );
      }
      setSelected(new Set(results.filter(r => !r.ok).map(r => r.id)));
      if (failed > 0) setError(`${failed} paper${failed !== 1 ? "s" : ""} could not be approved.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk approve failed.");
    } finally {
      setBulkLoading(false);
      setBulkConfirmOpen(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#07091A] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl">

        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-2">Admin</p>
          <h1 className="text-3xl font-extrabold text-white">Past Questions</h1>
          <p className="mt-2 text-sm text-slate-500">
            Review uploads, check AI-generated questions, then approve before students see them.
          </p>
        </div>

        {/* Tabs + bulk action */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  activeTab === tab.key
                    ? "bg-blue-600 text-white"
                    : "border border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <button
                onClick={() => setBulkConfirmOpen(true)}
                className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition"
              >
                <CheckCircle2 size={15} />
                Approve {selected.size} selected
              </button>
            )}
            <button
              onClick={loadQuestions}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-400 hover:bg-white/[0.08] transition disabled:opacity-50"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
            <button
              onClick={() => setError("")}
              className="ml-auto text-slate-500 hover:text-slate-300 text-xs"
            >✕</button>
          </div>
        )}

        {/* Question list */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#0D1230] overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : questions.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
                <FileText className="h-5 w-5 text-blue-400" />
              </div>
              <p className="text-sm font-semibold text-slate-400">
                No {activeTab || ""} past questions found.
              </p>
            </div>
          ) : (
            <>
              {/* Select all row */}
              <div className="flex items-center gap-3 border-b border-white/[0.05] px-5 py-3">
                <input
                  type="checkbox"
                  checked={selected.size === questions.length && questions.length > 0}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-white/20 bg-white/5 accent-blue-500"
                />
                <span className="text-xs font-medium text-slate-500">Select all</span>
                <span className="ml-auto text-xs text-slate-600">{questions.length} papers</span>
              </div>

              <div className="divide-y divide-white/[0.05]">
                {questions.map(q => {
                  const pState             = processingMap[q.id];
                  const isProcessingActive = pState?.active === true
                    || q.processing_status === "extracting"
                    || q.processing_status === "uploaded";
                  const retryError         = pState?.error ?? null;
                  const isExpanded         = expandedId === q.id;
                  const cachedText         = expandedText[q.id];
                  const isLoadingText      = expandLoading === q.id;

                  return (
                    <div key={q.id} className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">

                        {/* Left: checkbox + icon + metadata */}
                        <div className="flex items-start gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={selected.has(q.id)}
                            onChange={() => toggleSelected(q.id)}
                            className="mt-1 h-4 w-4 shrink-0 rounded border-white/20 bg-white/5 accent-blue-500"
                          />
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
                            <FileText className="h-4.5 w-4.5 text-blue-400" size={18} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-white truncate">{q.title}</p>
                            <p className="mt-0.5 text-sm text-slate-500">
                              {q.course?.name ?? "No course"}
                              {q.semester?.name ? ` · ${q.semester.name}` : ""}
                              {q.year ? ` · ${q.year}` : ""}
                              {" · "}{q.uploader?.full_name ?? "Unknown"}
                            </p>
                            <p className="mt-1 text-xs text-slate-600">
                              {new Date(q.created_at).toLocaleDateString("en-GB", {
                                day: "numeric", month: "short", year: "numeric",
                              })}
                            </p>

                            {/* Processing badge */}
                            <ProcessingBadge
                              s={q.processing_status}
                              errorMsg={q.processing_error}
                              retryError={retryError}
                              onProcess={() => triggerProcessing(q.id)}
                              processing={isProcessingActive}
                            />

                            {/* Generate questions button (ready but not AI processed) */}
                            {q.processing_status === "ready" && !q.ai_processed && (
                              <div className="mt-2">
                                <button
                                  onClick={() => triggerProcessing(q.id)}
                                  disabled={isProcessingActive}
                                  className="flex items-center gap-1.5 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-400 transition hover:bg-violet-500/20 disabled:opacity-50"
                                >
                                  {isProcessingActive
                                    ? <Loader2 size={12} className="animate-spin" />
                                    : <Sparkles size={12} />}
                                  {isProcessingActive ? "Generating…" : "Generate questions"}
                                </button>
                              </div>
                            )}

                            {/* Low quality warning */}
                            {q.extraction_quality !== null && q.extraction_quality < 0.5 && (
                              <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-400">
                                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                Low extraction quality — review text before approving
                              </div>
                            )}

                            {/* Preview watermarked file */}
                            <button
                              onClick={() => setPreviewId(q.id)}
                              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                            >
                              Preview watermarked file <ExternalLink size={11} />
                            </button>

                            {/* Expand / Edit text controls */}
                            {editingId !== q.id && (
                              <div className="mt-2 flex items-center gap-3">
                                <button
                                  onClick={() => toggleExpand(q)}
                                  disabled={isLoadingText}
                                  className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-50"
                                >
                                  {isLoadingText
                                    ? <Loader2 size={12} className="animate-spin" />
                                    : <ChevronDown
                                        size={13}
                                        className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                      />}
                                  {isExpanded ? "Hide text" : "Preview text"}
                                </button>
                                <button
                                  onClick={() => startEditing(q)}
                                  disabled={isLoadingText}
                                  className="flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
                                >
                                  <Pencil size={11} /> Edit
                                </button>
                              </div>
                            )}

                            {/* Rejection reason */}
                            {q.status === "rejected" && q.rejection_reason && (
                              <div className="mt-2 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
                                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                                <p className="text-xs text-red-400">
                                  <span className="font-semibold">Rejected:</span> {q.rejection_reason}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right: status pill */}
                        <StatusPill status={q.status} />
                      </div>

                      {/* Expanded extracted text (lazy loaded) */}
                      {isExpanded && editingId !== q.id && (
                        <div className="mt-4">
                          {isLoadingText ? (
                            <div className="flex items-center gap-2 py-4 text-xs text-slate-500">
                              <Loader2 size={13} className="animate-spin" /> Loading extracted text…
                            </div>
                          ) : cachedText ? (
                            <div className="max-h-48 overflow-y-auto rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm leading-7 text-slate-400">
                              {cachedText}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500 italic">No extracted text available.</p>
                          )}
                        </div>
                      )}

                      {/* Inline text editor */}
                      {editingId === q.id && (
                        <div className="mt-4">
                          <textarea
                            value={editText}
                            onChange={e => setEditText(e.target.value)}
                            rows={10}
                            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                          />
                          {textError && (
                            <p className="mt-1.5 text-xs text-red-400">{textError}</p>
                          )}
                          <p className="mt-1.5 text-[11px] text-slate-600">
                            After saving, tap &quot;Generate questions&quot; to rebuild from the updated text.
                          </p>
                          <div className="mt-2 flex gap-2">
                            <button
                              onClick={() => saveExtractedText(q.id)}
                              disabled={savingTextId === q.id}
                              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
                            >
                              {savingTextId === q.id && <Loader2 size={13} className="animate-spin" />}
                              Save changes
                            </button>
                            <button
                              onClick={cancelEditing}
                              disabled={savingTextId === q.id}
                              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-400 transition hover:bg-white/[0.08] disabled:opacity-60"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {q.status !== "approved" && (
                          <button
                            onClick={() => updateStatus(q.id, "approved")}
                            disabled={actioningId === q.id}
                            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-50"
                          >
                            <CheckCircle2 size={13} /> Approve
                          </button>
                        )}
                        {q.status !== "rejected" && (
                          <button
                            onClick={() => { setRejectTarget(q); setRejectReason(""); }}
                            disabled={actioningId === q.id}
                            className="flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-400 transition hover:bg-amber-500/20 disabled:opacity-50"
                          >
                            <XCircle size={13} /> Reject
                          </button>
                        )}
                        {q.status !== "pending" && (
                          <button
                            onClick={() => updateStatus(q.id, "pending")}
                            disabled={actioningId === q.id}
                            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-400 transition hover:bg-white/[0.08] disabled:opacity-50"
                          >
                            Reset to Pending
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteTarget(q)}
                          disabled={actioningId === q.id}
                          className="flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>

                      {/* Review questions panel */}
                      {q.status !== "rejected" && (
                        <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                          <button
                            onClick={() => setReviewId(reviewId === q.id ? null : q.id)}
                            className="flex w-full items-center justify-between gap-3 text-left"
                          >
                            <span className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                              <Sparkles className="h-4 w-4 text-violet-400" />
                              Review questions
                            </span>
                            <span className="flex items-center gap-2 text-xs text-slate-500">
                              {q.ai_processed ? "AI drafts ready" : "No questions yet"}
                              <ChevronDown
                                size={14}
                                className={`transition-transform ${reviewId === q.id ? "rotate-180" : ""}`}
                              />
                            </span>
                          </button>

                          {reviewId === q.id && (
                            <div className="mt-4" style={PANEL_THEME}>
                              <ReviewPanelBoundary>
                                <QuestionReviewPanel paperId={q.id} />
                              </ReviewPanelBoundary>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Admin paper viewer modal */}
      {previewId && (
        <AdminPaperViewer
          questionId={previewId}
          open={true}
          onClose={() => setPreviewId(null)}
        />
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this past question?"
        description={`"${deleteTarget?.title ?? ""}" will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete"
        tone="danger"
        loading={actioningId === deleteTarget?.id}
        onConfirm={() => deleteTarget && performDelete(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Bulk approve confirm */}
      <ConfirmDialog
        open={bulkConfirmOpen}
        title={`Approve ${selected.size} question${selected.size !== 1 ? "s" : ""}?`}
        description="These will immediately become visible to students."
        confirmLabel="Approve All"
        tone="default"
        loading={bulkLoading}
        onConfirm={performBulkApprove}
        onCancel={() => setBulkConfirmOpen(false)}
      />

      {/* Reject modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#0D1230] p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-white">Reject this upload?</h2>
            <p className="mt-1 text-sm text-slate-400">
              Let the student know why &quot;{rejectTarget.title}&quot; was rejected.
            </p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Blurry scan, wrong course, incomplete pages…"
              rows={3}
              maxLength={300}
              className="mt-4 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setRejectTarget(null)}
                disabled={actioningId === rejectTarget.id}
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.08] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={submitReject}
                disabled={!rejectReason.trim() || actioningId === rejectTarget.id}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-600 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:opacity-60"
              >
                {actioningId === rejectTarget.id && <Loader2 size={14} className="animate-spin" />}
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}