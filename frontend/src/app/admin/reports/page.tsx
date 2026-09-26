"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  Flag,
  AlertCircle,
  Trash2,
  CheckCircle2,
  Eye,
  EyeOff,
  MessageSquare,
  HelpCircle,
  ChevronDown,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import ConfirmDialog from "../components/ConfirmDialog";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReportedQuestion {
  id: string;
  title: string;
  is_hidden: boolean;
}

interface ReportedAnswer {
  id: string;
  content: string;
  is_hidden: boolean;
}

interface Report {
  id: string;
  reason: string;
  created_at: string;
  is_reviewed: boolean;
  reporter: { id: string; full_name: string | null } | null;
  question: ReportedQuestion | null;
  answer: ReportedAnswer | null;
}

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "reviewed", label: "Reviewed" },
  { key: "", label: "All" },
] as const;

// ── Reason pill ───────────────────────────────────────────────────────────────

function ReasonPill({ reason }: { reason: string }) {
  const map: Record<string, string> = {
    inappropriate: "bg-red-500/10 text-red-400 border border-red-500/20",
    spam:          "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    misleading:    "bg-orange-500/10 text-orange-400 border border-orange-500/20",
    offensive:     "bg-pink-500/10 text-pink-400 border border-pink-500/20",
  };
  const cls = map[reason] ?? "bg-slate-500/10 text-slate-400 border border-slate-500/20";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${cls}`}>
      <Flag className="h-3 w-3" />
      {reason}
    </span>
  );
}

// ── Content preview ───────────────────────────────────────────────────────────

function ContentPreview({ report, expanded, onToggle }: {
  report: Report;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isQuestion = !!report.question;
  const content = isQuestion ? report.question!.title : report.answer!.content;
  const isHidden = isQuestion ? report.question!.is_hidden : report.answer!.is_hidden;

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2">
        {isQuestion ? (
          <HelpCircle className="h-3.5 w-3.5 shrink-0 text-blue-400" />
        ) : (
          <MessageSquare className="h-3.5 w-3.5 shrink-0 text-violet-400" />
        )}
        <span className={`text-xs font-semibold ${isQuestion ? "text-blue-400" : "text-violet-400"}`}>
          {isQuestion ? "Question" : "Answer"}
        </span>

        {isHidden && (
          <span className="flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
            <EyeOff className="h-3 w-3" />
            Auto-hidden
          </span>
        )}

        <button
          onClick={onToggle}
          className="ml-auto flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-300 transition-colors"
        >
          <ChevronDown
            size={13}
            className={`transition-transform ${expanded ? "rotate-180" : ""}`}
          />
          {expanded ? "Hide" : "Preview"}
        </button>
      </div>

      {expanded && (
        <div className="mt-2 max-h-32 overflow-y-auto rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-sm leading-6 text-slate-400">
          {content}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminReportsPage() {
  const supabase = createClient();

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<string>("pending");
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Report | null>(null);
  const [dismissTarget, setDismissTarget] = useState<Report | null>(null);

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    if (expiresAt - Date.now() < 60_000) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      return refreshed.session?.access_token ?? null;
    }
    return session.access_token;
  }

  async function loadReports() {
    setLoading(true);
    setError("");
    const token = await getToken();
    if (!token) { setError("Session expired."); setLoading(false); return; }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/community/reports`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error("Failed to load reports.");
      const data: Report[] = await res.json();

      const filtered =
        activeTab === "pending"
          ? data.filter((r) => !r.is_reviewed)
          : activeTab === "reviewed"
          ? data.filter((r) => r.is_reviewed)
          : data;

      setReports(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadReports(); }, [activeTab]);

  // ── Dismiss ───────────────────────────────────────────────────────────────

  async function performDismiss(report: Report) {
    setActioningId(report.id);
    const token = await getToken();
    if (!token) { setActioningId(null); setDismissTarget(null); return; }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/community/reports/${report.id}/dismiss`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error("Failed to dismiss.");
      setReports((prev) =>
        activeTab === "pending"
          ? prev.filter((r) => r.id !== report.id)
          : prev.map((r) => r.id === report.id ? { ...r, is_reviewed: true } : r)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setActioningId(null);
      setDismissTarget(null);
    }
  }

  // ── Unhide ────────────────────────────────────────────────────────────────

  async function performUnhide(report: Report) {
    setActioningId(report.id);
    const token = await getToken();
    if (!token) { setActioningId(null); return; }

    const isQuestion = !!report.question;
    const url = isQuestion
      ? `${process.env.NEXT_PUBLIC_API_URL}/api/admin/community/questions/${report.question!.id}/unhide`
      : `${process.env.NEXT_PUBLIC_API_URL}/api/admin/community/answers/${report.answer!.id}/unhide`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to unhide.");

      setReports((prev) =>
        prev.map((r) => {
          if (r.id !== report.id) return r;
          if (isQuestion && r.question) {
            return { ...r, is_reviewed: true, question: { ...r.question, is_hidden: false } };
          }
          if (!isQuestion && r.answer) {
            return { ...r, is_reviewed: true, answer: { ...r.answer, is_hidden: false } };
          }
          return r;
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setActioningId(null);
    }
  }

  // ── Delete content ────────────────────────────────────────────────────────

  async function performDelete(report: Report) {
    setActioningId(report.id);
    const token = await getToken();
    if (!token) { setActioningId(null); setDeleteTarget(null); return; }

    const isQuestion = !!report.question;
    const url = isQuestion
      ? `${process.env.NEXT_PUBLIC_API_URL}/api/admin/community/questions/${report.question!.id}`
      : `${process.env.NEXT_PUBLIC_API_URL}/api/admin/community/answers/${report.answer!.id}`;

    try {
      const res = await fetch(url, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete.");
      // Remove all reports tied to this content
      setReports((prev) =>
        prev.filter((r) => {
          if (isQuestion) return r.question?.id !== report.question!.id;
          return r.answer?.id !== report.answer!.id;
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setActioningId(null);
      setDeleteTarget(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const deleteLabel = deleteTarget?.question
    ? `"${deleteTarget.question.title}"`
    : deleteTarget?.answer
    ? `this answer`
    : "";

  return (
    <div className="min-h-screen bg-[#07091A] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-2">
            Admin
          </p>
          <h1 className="text-3xl font-extrabold text-white">Reports</h1>
          <p className="mt-2 text-sm text-slate-500">
            Review flagged questions and answers. Auto-hidden content is marked and waiting for your action.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
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

        {/* Error */}
        {error && (
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Report list */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#0D1230] overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
                <Flag className="h-5 w-5 text-blue-400" />
              </div>
              <p className="text-sm font-semibold text-slate-400">
                No {activeTab === "pending" ? "pending" : activeTab === "reviewed" ? "reviewed" : ""} reports.
              </p>
              {activeTab === "pending" && (
                <p className="mt-1 text-xs text-slate-600">Community is clean — nothing flagged yet.</p>
              )}
            </div>
          ) : (
            <>
              <div className="border-b border-white/[0.05] px-5 py-3">
                <span className="text-xs text-slate-600">{reports.length} report{reports.length !== 1 ? "s" : ""}</span>
              </div>

              <div className="divide-y divide-white/[0.05]">
                {reports.map((report) => {
                  const isHidden = report.question?.is_hidden || report.answer?.is_hidden;

                  return (
                    <div key={report.id} className="p-5">

                      {/* Top row */}
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                            isHidden ? "bg-amber-500/10" : "bg-red-500/10"
                          }`}>
                            <Flag className={`h-4.5 w-4.5 ${isHidden ? "text-amber-400" : "text-red-400"}`} size={18} />
                          </div>

                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <ReasonPill reason={report.reason} />
                              {report.is_reviewed && (
                                <span className="flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Reviewed
                                </span>
                              )}
                            </div>

                            <p className="mt-1.5 text-xs text-slate-500">
                              Reported by{" "}
                              <span className="font-medium text-slate-400">
                                {report.reporter?.full_name ?? "Unknown"}
                              </span>
                              {" · "}
                              {new Date(report.created_at).toLocaleDateString("en-GB", {
                                day: "numeric", month: "short", year: "numeric",
                              })}
                            </p>

                            {/* Content preview */}
                            <ContentPreview
                              report={report}
                              expanded={expandedId === report.id}
                              onToggle={() =>
                                setExpandedId(expandedId === report.id ? null : report.id)
                              }
                            />
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {!report.is_reviewed && (
                          <button
                            onClick={() => setDismissTarget(report)}
                            disabled={actioningId === report.id}
                            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-50"
                          >
                            <CheckCircle2 size={13} />
                            Dismiss
                          </button>
                        )}

                        {isHidden && (
                          <button
                            onClick={() => performUnhide(report)}
                            disabled={actioningId === report.id}
                            className="flex items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-400 transition hover:bg-blue-500/20 disabled:opacity-50"
                          >
                            {actioningId === report.id ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Eye size={13} />
                            )}
                            Unhide
                          </button>
                        )}

                        <button
                          onClick={() => setDeleteTarget(report)}
                          disabled={actioningId === report.id}
                          className="flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
                        >
                          <Trash2 size={13} />
                          Delete content
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

      {/* ── Dialogs ── */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete flagged content?"
        description={`${deleteLabel} will be permanently removed and all associated reports cleared. This cannot be undone.`}
        confirmLabel="Delete"
        tone="danger"
        loading={actioningId === deleteTarget?.id}
        onConfirm={() => deleteTarget && performDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={dismissTarget !== null}
        title="Dismiss this report?"
        description="The content will stay visible. Use this when the report is unfounded."
        confirmLabel="Dismiss"
        tone="default"
        loading={actioningId === dismissTarget?.id}
        onConfirm={() => dismissTarget && performDismiss(dismissTarget)}
        onCancel={() => setDismissTarget(null)}
      />
    </div>
  );
}