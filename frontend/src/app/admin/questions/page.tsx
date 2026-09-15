"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  FileText,
  CheckCircle2,
  XCircle,
  Trash2,
  ExternalLink,
  ChevronDown,
  Pencil,
  Sparkles,
  Eye,
  Clock,
  AlertCircle,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";
import ConfirmDialog from "../components/ConfirmDialog";

interface Question {
  id: string;
  title: string;
  year: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  file_url: string | null;
  extracted_text: string | null;
  rejection_reason: string | null;
  extraction_quality: number | null;
  course: { name: string } | null;
  semester: { name: string } | null;
  uploader: { full_name: string | null } | null;
  ai_processed: boolean;
}

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "", label: "All" },
] as const;

// ── Status pill ───────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; label: string; icon: React.ReactNode }> = {
    pending: {
      bg: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
      label: "Pending",
      icon: <Clock className="h-3 w-3" />,
    },
    approved: {
      bg: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
      label: "Approved",
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    rejected: {
      bg: "bg-red-500/10 text-red-400 border border-red-500/20",
      label: "Rejected",
      icon: <XCircle className="h-3 w-3" />,
    },
  };
  const s = map[status] ?? map.pending;
  return (
    <span className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.bg}`}>
      {s.icon}
      {s.label}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminQuestionsPage() {
  const supabase = createClient();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<string>("pending");
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Question | null>(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<Question | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [savingTextId, setSavingTextId] = useState<string | null>(null);
  const [textError, setTextError] = useState("");

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [processResults, setProcessResults] = useState<Record<string, number>>({});
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewQuestions, setPreviewQuestions] = useState<any[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    const isExpiringSoon = expiresAt - Date.now() < 60_000;
    if (isExpiringSoon) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      return refreshed.session?.access_token ?? null;
    }
    return session.access_token;
  }

  async function loadQuestions() {
    setLoading(true);
    setError("");
    setSelected(new Set());
    const token = await getToken();
    if (!token) { setError("Session expired."); setLoading(false); return; }

    try {
      const url = new URL(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/questions`);
      if (activeTab) url.searchParams.set("status", activeTab);
      const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to load past questions.");
      setQuestions(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadQuestions(); }, [activeTab]);

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
        }
      );
      if (!res.ok) throw new Error("Failed to update status.");
      if (activeTab && activeTab !== status) {
        setQuestions((prev) => prev.filter((q) => q.id !== id));
      } else {
        setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, status } : q)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setActioningId(null);
    }
  }

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
        }
      );
      if (!res.ok) throw new Error("Failed to reject.");
      if (activeTab && activeTab !== "rejected") {
        setQuestions((prev) => prev.filter((q) => q.id !== rejectTarget.id));
      } else {
        setQuestions((prev) =>
          prev.map((q) =>
            q.id === rejectTarget.id
              ? { ...q, status: "rejected", rejection_reason: rejectReason.trim() }
              : q
          )
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

  async function performDelete(id: string) {
    setActioningId(id);
    const token = await getToken();
    if (!token) { setActioningId(null); setDeleteTarget(null); return; }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/questions/${id}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error("Failed to delete.");
      setQuestions((prev) => prev.filter((q) => q.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setActioningId(null);
      setDeleteTarget(null);
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === questions.length) setSelected(new Set());
    else setSelected(new Set(questions.map((q) => q.id)));
  }

  async function performBulkApprove() {
    setBulkLoading(true);
    const token = await getToken();
    if (!token) { setBulkLoading(false); setBulkConfirmOpen(false); return; }
    const ids = Array.from(selected);

    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/questions/${id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ status: "approved" }),
          })
        )
      );
      if (activeTab && activeTab !== "approved") {
        setQuestions((prev) => prev.filter((q) => !selected.has(q.id)));
      } else {
        setQuestions((prev) =>
          prev.map((q) => (selected.has(q.id) ? { ...q, status: "approved" } : q))
        );
      }
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk approve failed.");
    } finally {
      setBulkLoading(false);
      setBulkConfirmOpen(false);
    }
  }

  function startEditing(q: Question) {
    setEditingId(q.id);
    setEditText(q.extracted_text ?? "");
    setTextError("");
    setExpandedId(q.id);
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
        }
      );
      if (!res.ok) throw new Error("Failed to save changes.");
      setQuestions((prev) =>
        prev.map((q) => (q.id === id ? { ...q, extracted_text: trimmed } : q))
      );
      setEditingId(null);
      setEditText("");
    } catch (err) {
      setTextError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSavingTextId(null);
    }
  }

  async function handleProcess(questionId: string) {
    setProcessingId(questionId);
    const token = await getToken();
    if (!token) { setProcessingId(null); return; }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/questions/${questionId}/process`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Processing failed.");
      setProcessResults((prev) => ({ ...prev, [questionId]: data.questions_created }));
      setQuestions((prev) =>
        prev.map((q) => (q.id === questionId ? { ...q, ai_processed: true } : q))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI processing failed.");
    } finally {
      setProcessingId(null);
    }
  }

  async function loadPreview(questionId: string) {
    if (previewId === questionId) { setPreviewId(null); return; }
    setPreviewId(questionId);
    setPreviewLoading(true);
    const token = await getToken();
    if (!token) { setPreviewLoading(false); return; }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/questions/${questionId}/processed-questions`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) setPreviewQuestions(await res.json());
    } finally {
      setPreviewLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#07091A] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-2">
            Admin
          </p>
          <h1 className="text-3xl font-extrabold text-white">Past Questions</h1>
          <p className="mt-2 text-sm text-slate-500">
            Review uploads, approve content, and run AI processing before students see it.
          </p>
        </div>

        {/* Tabs + Bulk action */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => (
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

          {selected.size > 0 && (
            <button
              onClick={() => setBulkConfirmOpen(true)}
              className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition"
            >
              <CheckCircle2 size={15} />
              Approve {selected.size} selected
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
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
                {questions.map((q) => (
                  <div key={q.id} className="p-5">

                    {/* Top row */}
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selected.has(q.id)}
                          onChange={() => toggleSelected(q.id)}
                          className="mt-1 h-4 w-4 shrink-0 rounded border-white/20 bg-white/5 accent-blue-500"
                        />

                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
                          <FileText className="h-4.5 w-4.5 text-blue-400" size={18} />
                        </div>

                        <div>
                          <p className="font-semibold text-white">{q.title}</p>
                          <p className="mt-0.5 text-sm text-slate-500">
                            {q.course?.name ?? "No course"}
                            {q.semester?.name ? ` · ${q.semester.name}` : ""}
                            {q.year ? ` · ${q.year}` : ""}
                            {" · "}
                            {q.uploader?.full_name ?? "Unknown"}
                          </p>
                          <p className="mt-1 text-xs text-slate-600">
                            {new Date(q.created_at).toLocaleDateString("en-GB", {
                              day: "numeric", month: "short", year: "numeric",
                            })}
                          </p>

                          {/* Extraction quality warning */}
                          {q.extraction_quality !== null && q.extraction_quality < 0.5 && (
                            <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-400">
                              <AlertCircle className="h-3.5 w-3.5" />
                              Low extraction quality — review text before processing
                            </div>
                          )}

                          {/* File link */}
                          {q.file_url && (
                            <button
                              onClick={async () => {
                                const token = await getToken();
                                if (!token) return;
                                const res = await fetch(
                                  `${process.env.NEXT_PUBLIC_API_URL}/api/admin/questions/${q.id}/file-url`,
                                  { headers: { Authorization: `Bearer ${token}` } }
                                );
                                if (!res.ok) return;
                                const { url } = await res.json();
                                window.open(url, "_blank");
                              }}
                              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                            >
                              View file
                              <ExternalLink size={11} />
                            </button>
                          )}

                          {/* Extracted text toggle */}
                          {q.extracted_text && editingId !== q.id && (
                            <div className="mt-2 flex items-center gap-3">
                              <button
                                onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                                className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-300 transition-colors"
                              >
                                <ChevronDown
                                  size={13}
                                  className={`transition-transform ${expandedId === q.id ? "rotate-180" : ""}`}
                                />
                                {expandedId === q.id ? "Hide text" : "Preview text"}
                              </button>
                              <button
                                onClick={() => startEditing(q)}
                                className="flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                              >
                                <Pencil size={11} />
                                Edit
                              </button>
                            </div>
                          )}

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

                      <StatusPill status={q.status} />
                    </div>

                    {/* Extracted text preview */}
                    {expandedId === q.id && q.extracted_text && editingId !== q.id && (
                      <div className="mt-4 max-h-48 overflow-y-auto rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm leading-7 text-slate-400">
                        {q.extracted_text}
                      </div>
                    )}

                    {/* Extracted text editor */}
                    {editingId === q.id && (
                      <div className="mt-4">
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={10}
                          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        />
                        {textError && (
                          <p className="mt-1.5 text-xs text-red-400">{textError}</p>
                        )}
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
                          <CheckCircle2 size={13} />
                          Approve
                        </button>
                      )}

                      {q.status !== "rejected" && (
                        <button
                          onClick={() => { setRejectTarget(q); setRejectReason(""); }}
                          disabled={actioningId === q.id}
                          className="flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-400 transition hover:bg-amber-500/20 disabled:opacity-50"
                        >
                          <XCircle size={13} />
                          Reject
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
                        <Trash2 size={13} />
                        Delete
                      </button>
                    </div>

                    {/* ── AI Processing section ── */}
                    {q.status === "approved" && (
                      <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-violet-400" />
                            <span className="text-xs font-semibold text-slate-300">
                              AI Processing
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {q.ai_processed ? (
                              <>
                                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Processed
                                  {processResults[q.id] !== undefined
                                    ? ` · ${processResults[q.id]} questions`
                                    : ""}
                                </span>

                                <button
                                  onClick={() => loadPreview(q.id)}
                                  className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.08]"
                                >
                                  <Eye size={12} />
                                  {previewId === q.id ? "Hide" : "Preview"}
                                </button>

                                <button
                                  onClick={() => handleProcess(q.id)}
                                  disabled={processingId === q.id}
                                  className="flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-1.5 text-xs font-semibold text-violet-300 transition hover:bg-violet-500/20 disabled:opacity-50"
                                >
                                  {processingId === q.id ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    <Sparkles size={12} />
                                  )}
                                  Re-run
                                </button>
                              </>
                            ) : (
                              <>
                                <span className="text-xs text-slate-600">Not yet processed</span>
                                <button
                                  onClick={() => handleProcess(q.id)}
                                  disabled={processingId === q.id || !q.extracted_text}
                                  className="flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-300 transition hover:bg-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  {processingId === q.id ? (
                                    <><Loader2 size={12} className="animate-spin" /> Processing…</>
                                  ) : (
                                    <><Sparkles size={12} /> Process with AI</>
                                  )}
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* No extracted text warning */}
                        {!q.extracted_text && (
                          <p className="mt-3 text-xs text-amber-400">
                            No extracted text — upload a cleaner scan or edit the text manually before processing.
                          </p>
                        )}

                        {/* Preview panel */}
                        {previewId === q.id && (
                          <div className="mt-4 space-y-3">
                            {previewLoading ? (
                              <div className="flex justify-center py-6">
                                <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
                              </div>
                            ) : previewQuestions.length === 0 ? (
                              <p className="text-xs text-slate-500">No processed questions found.</p>
                            ) : (
                              previewQuestions.map((pq: any, i: number) => (
                                <div
                                  key={pq.id}
                                  className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3"
                                >
                                  <div className="flex items-start justify-between gap-2 mb-2">
                                    <span className="text-xs font-semibold text-violet-400">
                                      Q{pq.question_number ?? i + 1}
                                    </span>
                                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-slate-400 capitalize">
                                      {pq.question_type}
                                    </span>
                                  </div>
                                  <p className="text-sm text-slate-300 leading-6">
                                    {pq.question_text}
                                  </p>
                                  {pq.option_a && (
                                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                                      {["a", "b", "c", "d"].map((opt) =>
                                        pq[`option_${opt}`] ? (
                                          <div
                                            key={opt}
                                            className={`rounded-lg px-2.5 py-1.5 text-xs ${
                                              pq.correct_answer?.toLowerCase() === opt
                                                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                                : "border border-white/[0.05] bg-white/[0.02] text-slate-400"
                                            }`}
                                          >
                                            <span className="font-semibold uppercase">{opt}.</span>{" "}
                                            {pq[`option_${opt}`]}
                                          </div>
                                        ) : null
                                      )}
                                    </div>
                                  )}
                                  {pq.explanation && (
                                    <p className="mt-2 text-xs text-slate-500 leading-5">
                                      <span className="font-semibold text-slate-400">Explanation:</span>{" "}
                                      {pq.explanation}
                                    </p>
                                  )}
                                  {pq.topic_tag && (
                                    <span className="mt-2 inline-block rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">
                                      {pq.topic_tag}
                                    </span>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Dialogs ── */}
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

      <ConfirmDialog
        open={bulkConfirmOpen}
        title={`Approve ${selected.size} question${selected.size !== 1 ? "s" : ""}?`}
        description="These will immediately become visible to students in their course pages and dashboards."
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
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Blurry scan, wrong course, incomplete pages..."
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