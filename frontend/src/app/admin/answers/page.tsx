"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Clock,
  FileText,
  MessageSquare,
  ChevronDown,
  Eye,
  ExternalLink,
  Send,
  Trash2,
  Search,
  X,
  Image as ImageIcon,
  RotateCcw,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import PdfViewer from "@/components/PdfViewer";
import ConfirmDialog from "../components/ConfirmDialog";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Submission {
  id: string;
  status: "pending" | "reviewed";
  feedback: string | null;
  extracted_text: string | null;
  extraction_quality: number | null;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
  reviewed_at: string | null;
  question_id: string;
  submitted_by: string;
  question: {
    id: string;
    title: string;
    course: { name: string } | null;
  } | null;
  submitter: {
    full_name: string | null;
    phone: string | null;
  } | null;
}

type FilterTab = "pending" | "reviewed" | "all";

const TABS: { key: FilterTab; label: string }[] = [
  { key: "pending",  label: "Pending"  },
  { key: "reviewed", label: "Reviewed" },
  { key: "all",      label: "All"      },
];

const LOW_QUALITY_THRESHOLD = 0.5;

// ── Style tokens (mirrors reports page) ───────────────────────────────────────

const secondaryText = "text-[var(--sp-text-2)]";
const greenText     = "text-emerald-700 dark:text-emerald-400";
const amberText     = "text-amber-800 dark:text-amber-400";
const redText       = "text-red-700 dark:text-red-400";
const blueText      = "text-blue-700 dark:text-blue-400";

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function fmtSize(bytes: number | null) {
  if (!bytes) return "";
  return bytes > 1_048_576
    ? `${(bytes / 1_048_576).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

function MimeIcon({ mime }: { mime: string | null }) {
  if (!mime) return <FileText className="h-4 w-4 text-slate-400" />;
  if (mime === "application/pdf") return <FileText className="h-4 w-4 text-red-500" />;
  return <ImageIcon className="h-4 w-4 text-indigo-500" />;
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className={`text-[10px] font-semibold uppercase tracking-widest ${secondaryText}`}>
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium text-[var(--sp-text)]">{value}</p>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AdminAnswersPage() {
  const [supabase] = useState(() => createClient());

  const [submissions,  setSubmissions]  = useState<Submission[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");
  const [activeTab,    setActiveTab]    = useState<FilterTab>("pending");
  const [search,       setSearch]       = useState("");

  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [fileUrls,     setFileUrls]     = useState<Record<string, string>>({});
  const [loadingFile,  setLoadingFile]  = useState<string | null>(null);

  // feedback drafts (per-card, inline — not a modal)
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({});
  const [submittingId,   setSubmittingId]   = useState<string | null>(null);

  // file viewer modal
  const [viewerUrl,     setViewerUrl]     = useState<string | null>(null);
  const [viewerIsImage, setViewerIsImage] = useState(false);
  const [viewerLoading, setViewerLoading] = useState<string | null>(null);

  // confirm dialogs
  const [deleteTarget, setDeleteTarget] = useState<Submission | null>(null);
  const [actioningId,  setActioningId]  = useState<string | null>(null);

  // ── Auth ────────────────────────────────────────────────────────────────────

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const expiringSoon = (session.expires_at ?? 0) * 1000 - Date.now() < 60_000;
    if (expiringSoon) {
      const { data } = await supabase.auth.refreshSession();
      return data.session?.access_token ?? null;
    }
    return session.access_token;
  }

  async function requireToken() {
    const t = await getToken();
    if (!t) throw new Error("Session expired. Please log in again.");
    return t;
  }

  // ── Load submissions ────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");
      try {
        const token = await requireToken();
        if (cancelled) return;

        const statusParam = activeTab === "all" ? "" : `?status_filter=${activeTab}`;
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/admin/answers${statusParam}`,
          { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal },
        );

        if (!res.ok) throw new Error("Failed to load submissions.");
        const data: Submission[] = await res.json();
        if (!cancelled) {
          setSubmissions(data);
          setExpandedId(null);
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; controller.abort(); };
  }, [activeTab]);

  // ── File URL ────────────────────────────────────────────────────────────────

  async function openViewer(sub: Submission) {
    setViewerLoading(sub.id);
    setError("");
    try {
      const token = await requireToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/answers/${sub.id}/file-url`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error("Could not load file.");
      const { url } = await res.json();
      setFileUrls(prev => ({ ...prev, [sub.id]: url }));
      setViewerUrl(url);
      setViewerIsImage(!!sub.mime_type?.startsWith("image/"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load file.");
    } finally {
      setViewerLoading(null);
    }
  }

  // ── Submit feedback ─────────────────────────────────────────────────────────

  async function submitFeedback(sub: Submission) {
    const feedback = (feedbackDrafts[sub.id] ?? "").trim();
    if (!feedback) return;

    setSubmittingId(sub.id);
    setError("");
    try {
      const token = await requireToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/answers/${sub.id}/review`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ feedback, status: "reviewed" }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail ?? "Failed to submit feedback.");
      }
      setSubmissions(prev =>
        prev.map(s =>
          s.id === sub.id
            ? { ...s, status: "reviewed", feedback, reviewed_at: new Date().toISOString() }
            : s,
        ),
      );
      setFeedbackDrafts(prev => { const n = { ...prev }; delete n[sub.id]; return n; });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmittingId(null);
    }
  }

  // ── Re-open for re-review ───────────────────────────────────────────────────

  async function reopenSubmission(sub: Submission) {
    setActioningId(sub.id);
    setError("");
    try {
      const token = await requireToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/answers/${sub.id}/review`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: "pending", feedback: null }),
        },
      );
      if (!res.ok) throw new Error("Failed to re-open submission.");
      setSubmissions(prev =>
        prev.map(s =>
          s.id === sub.id
            ? { ...s, status: "pending", feedback: null, reviewed_at: null }
            : s,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setActioningId(null);
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async function performDelete(sub: Submission) {
    setActioningId(sub.id);
    setError("");
    try {
      const token = await requireToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/answers/${sub.id}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error("Failed to delete submission.");
      setSubmissions(prev => prev.filter(s => s.id !== sub.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setActioningId(null);
      setDeleteTarget(null);
    }
  }

  // ── Filtered list ───────────────────────────────────────────────────────────

  const filtered = submissions.filter(s => {
    const q = search.trim().toLowerCase();
    return (
      !q ||
      s.question?.title?.toLowerCase().includes(q) ||
      s.question?.course?.name?.toLowerCase().includes(q) ||
      s.submitter?.full_name?.toLowerCase().includes(q) ||
      s.extracted_text?.toLowerCase().includes(q)
    );
  });

  const busy = actioningId !== null || submittingId !== null;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[var(--sp-bg)] px-4 py-8 text-[var(--sp-text)] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className={`mb-2 text-xs font-semibold uppercase tracking-widest ${blueText}`}>
              Admin
            </p>
            <h1 className="text-3xl font-extrabold">Answer Submissions</h1>
            <p className={`mt-2 text-sm ${secondaryText}`}>
              Review student solutions, give feedback, or remove submissions.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab(t => t)} // re-triggers effect
            disabled={loading}
            className={`flex shrink-0 items-center gap-2 rounded-xl border border-[var(--sp-border)] bg-[var(--sp-bg-card)] px-4 py-2 text-xs font-medium ${secondaryText} transition hover:border-[var(--sp-border-hover)] hover:text-[var(--sp-text)] disabled:opacity-50`}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              disabled={busy}
              aria-pressed={activeTab === tab.key}
              className={`rounded-full px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
                activeTab === tab.key
                  ? "bg-blue-600 text-white"
                  : `border border-[var(--sp-border)] bg-[var(--sp-bg-card)] ${secondaryText} hover:border-[var(--sp-border-hover)] hover:text-[var(--sp-text)]`
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-[var(--sp-border)] bg-[var(--sp-bg-card)] px-4 py-2.5 focus-within:border-[var(--sp-border-hover)]">
          <Search className={`h-4 w-4 shrink-0 ${secondaryText}`} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by question, course, or student name…"
            className="min-w-0 w-full bg-transparent text-sm text-[var(--sp-text)] outline-none placeholder:text-[var(--sp-text-3)]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className={`${secondaryText} transition hover:text-[var(--sp-text)]`}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3"
          >
            <AlertCircle className={`mt-0.5 h-4 w-4 shrink-0 ${redText}`} />
            <p className={`text-sm ${redText}`}>{error}</p>
          </div>
        )}

        {/* List */}
        <div className="overflow-hidden rounded-2xl border border-[var(--sp-border)] bg-[var(--sp-bg-card)]">
          {loading ? (
            <div role="status" className="flex justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              <span className="sr-only">Loading submissions…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-20 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
                <MessageSquare className={`h-5 w-5 ${blueText}`} />
              </div>
              <p className={`text-sm font-semibold ${secondaryText}`}>
                No {activeTab !== "all" ? activeTab : ""} submissions
                {search ? " matching your search" : ""}.
              </p>
            </div>
          ) : (
            <>
              <div className="border-b border-[var(--sp-border)] px-5 py-3">
                <span className={`text-xs ${secondaryText}`}>
                  {filtered.length} submission{filtered.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="divide-y divide-[var(--sp-border)]">
                {filtered.map(sub => {
                  const isPending      = sub.status === "pending";
                  const isExpanded     = expandedId === sub.id;
                  const isLowQuality   = sub.extraction_quality !== null && sub.extraction_quality < LOW_QUALITY_THRESHOLD;
                  const feedbackDraft  = feedbackDrafts[sub.id] ?? "";

                  return (
                    <div key={sub.id} className="p-5">

                      {/* Top row */}
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                            isPending ? "bg-amber-500/10" : "bg-emerald-500/10"
                          }`}
                        >
                          {isPending
                            ? <Clock className={`h-4.5 w-4.5 ${amberText}`} />
                            : <CheckCircle2 className={`h-4.5 w-4.5 ${greenText}`} />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Status pill */}
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                                isPending
                                  ? `border-amber-500/20 bg-amber-500/10 ${amberText}`
                                  : `border-emerald-500/20 bg-emerald-500/10 ${greenText}`
                              }`}
                            >
                              {isPending
                                ? <><Clock className="h-3 w-3" /> Pending</>
                                : <><CheckCircle2 className="h-3 w-3" /> Reviewed</>}
                            </span>

                            {/* File type badge */}
                            {sub.mime_type && (
                              <span className={`inline-flex items-center gap-1 rounded-full border border-[var(--sp-border)] bg-[var(--sp-bg-muted)] px-2.5 py-1 text-[11px] font-semibold ${secondaryText}`}>
                                <MimeIcon mime={sub.mime_type} />
                                {sub.mime_type === "application/pdf" ? "PDF" : "Image"}
                                {sub.file_size ? ` · ${fmtSize(sub.file_size)}` : ""}
                              </span>
                            )}
                          </div>

                          <p className="mt-1.5 truncate text-sm font-semibold text-[var(--sp-text)]">
                            {sub.question?.title ?? "Unknown question"}
                          </p>

                          <p className={`mt-0.5 text-xs ${secondaryText}`}>
                            {sub.submitter?.full_name ?? "Unknown student"}
                            {sub.question?.course?.name ? ` · ${sub.question.course.name}` : ""}
                            {" · "}
                            {fmt(sub.created_at)}
                          </p>
                        </div>

                        {/* Expand toggle */}
                        <button
                          type="button"
                          onClick={() => setExpandedId(prev => prev === sub.id ? null : sub.id)}
                          aria-expanded={isExpanded}
                          className={`flex items-center gap-1 text-xs font-medium ${secondaryText} transition-colors hover:text-[var(--sp-text)]`}
                        >
                          <ChevronDown
                            size={14}
                            className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          />
                          {isExpanded ? "Hide" : "Details"}
                        </button>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="mt-4 space-y-4 rounded-xl border border-[var(--sp-border)] bg-[var(--sp-bg)] p-4">

                          {/* Meta grid */}
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            <InfoCell label="Student"   value={sub.submitter?.full_name ?? "—"} />
                            <InfoCell label="Phone"     value={sub.submitter?.phone ?? "—"} />
                            <InfoCell label="Course"    value={sub.question?.course?.name ?? "—"} />
                            <InfoCell label="Submitted" value={fmt(sub.created_at)} />
                            {sub.reviewed_at && (
                              <InfoCell label="Reviewed" value={fmt(sub.reviewed_at)} />
                            )}
                          </div>

                          {/* Low quality warning */}
                          {isLowQuality && (
                            <div className={`flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-xs ${amberText}`}>
                              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              Scan quality was low — check the original file before reviewing.
                            </div>
                          )}

                          {/* Extracted / typed text */}
                          {sub.extracted_text && (
                            <div>
                              <p className={`mb-1.5 text-[10px] font-semibold uppercase tracking-widest ${secondaryText}`}>
                                Solution text
                              </p>
                              <div className="max-h-48 overflow-y-auto rounded-xl border border-[var(--sp-border)] bg-[var(--sp-bg-muted)] px-4 py-3 text-sm leading-relaxed text-[var(--sp-text-2)] whitespace-pre-wrap">
                                {sub.extracted_text}
                              </div>
                            </div>
                          )}

                          {/* File actions */}
                          {sub.mime_type && (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => openViewer(sub)}
                                disabled={viewerLoading === sub.id}
                                className={`flex items-center gap-1.5 rounded-lg border border-[var(--sp-border)] bg-[var(--sp-bg-muted)] px-3 py-2 text-xs font-semibold ${secondaryText} transition hover:border-[var(--sp-border-hover)] hover:text-[var(--sp-text)] disabled:opacity-50`}
                              >
                                {viewerLoading === sub.id
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <Eye className="h-3.5 w-3.5" />}
                                View file
                              </button>

                              {fileUrls[sub.id] && (
                                <a
                                  href={fileUrls[sub.id]}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`flex items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs font-semibold ${blueText} transition hover:bg-blue-500/20`}
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  Open in new tab
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Feedback panel */}
                      <div className="mt-4">
                        {sub.status === "reviewed" && sub.feedback ? (
                          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5">
                            <p className={`text-xs font-semibold ${greenText}`}>Feedback given</p>
                            <p className={`mt-1 whitespace-pre-wrap text-sm ${greenText}`}>
                              {sub.feedback}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <textarea
                              value={feedbackDraft}
                              onChange={e =>
                                setFeedbackDrafts(prev => ({ ...prev, [sub.id]: e.target.value }))
                              }
                              placeholder="Write feedback for this submission…"
                              rows={3}
                              className="w-full rounded-xl border border-[var(--sp-border)] bg-[var(--sp-bg-muted)] px-3.5 py-2.5 text-sm text-[var(--sp-text)] outline-none placeholder:text-[var(--sp-text-3)] focus:border-blue-500"
                            />
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {/* Submit feedback */}
                        {sub.status === "pending" && (
                          <button
                            type="button"
                            onClick={() => submitFeedback(sub)}
                            disabled={!feedbackDraft.trim() || submittingId === sub.id || busy}
                            className={`flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold transition hover:bg-emerald-500/20 disabled:opacity-50 ${greenText}`}
                          >
                            {submittingId === sub.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <Send className="h-3.5 w-3.5" />}
                            Submit feedback
                          </button>
                        )}

                        {/* Re-review already-reviewed submission */}
                        {sub.status === "reviewed" && (
                          <button
                            type="button"
                            onClick={() => reopenSubmission(sub)}
                            disabled={actioningId === sub.id || busy}
                            className={`flex items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs font-semibold transition hover:bg-blue-500/20 disabled:opacity-50 ${blueText}`}
                          >
                            {actioningId === sub.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <RotateCcw className="h-3.5 w-3.5" />}
                            Re-review
                          </button>
                        )}

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(sub)}
                          disabled={busy}
                          className={`flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold transition hover:bg-red-500/20 disabled:opacity-50 ${redText}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* File viewer modal */}
      {viewerUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setViewerUrl(null)}
        >
          <button
            type="button"
            onClick={() => setViewerUrl(null)}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X size={18} />
          </button>

          {viewerIsImage ? (
            <img
              src={viewerUrl}
              alt="Answer submission"
              className="max-h-full max-w-full rounded-lg"
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <div onClick={e => e.stopPropagation()}>
              <PdfViewer url={viewerUrl} />
            </div>
          )}
        </div>
      )}

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this submission?"
        description={`"${deleteTarget?.question?.title ?? "This submission"}" will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete"
        tone="danger"
        loading={actioningId === deleteTarget?.id}
        onConfirm={() => deleteTarget && performDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
