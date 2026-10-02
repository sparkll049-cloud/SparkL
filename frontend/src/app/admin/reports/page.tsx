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

const blueText = "text-blue-700 dark:text-blue-400";
const violetText = "text-violet-700 dark:text-violet-400";
const greenText = "text-emerald-700 dark:text-emerald-400";
const redText = "text-red-700 dark:text-red-400";
const amberText = "text-amber-800 dark:text-amber-400";
const secondaryText = "text-[var(--sp-text-2)]";

function ReasonPill({ reason }: { reason: string }) {
  const styles: Record<string, string> = {
    inappropriate:
      "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-400",
    spam:
      "border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-400",
    misleading:
      "border-orange-500/20 bg-orange-500/10 text-orange-800 dark:text-orange-400",
    offensive:
      "border-pink-500/20 bg-pink-500/10 text-pink-700 dark:text-pink-400",
  };

  const style =
    styles[reason] ??
    "border-[var(--sp-border)] bg-[var(--sp-bg-muted)] text-[var(--sp-text-2)]";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${style}`}
    >
      <Flag className="h-3 w-3" />
      {reason}
    </span>
  );
}

function ContentPreview({
  report,
  expanded,
  onToggle,
}: {
  report: Report;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (!report.question && !report.answer) {
    return (
      <p className={`mt-3 text-xs ${secondaryText}`}>
        This content is no longer available.
      </p>
    );
  }

  const isQuestion = !!report.question;
  const content = report.question
    ? report.question.title
    : report.answer?.content ?? "";

  const isHidden = report.question
    ? report.question.is_hidden
    : report.answer?.is_hidden ?? false;

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        {isQuestion ? (
          <HelpCircle
            className={`h-3.5 w-3.5 shrink-0 ${blueText}`}
          />
        ) : (
          <MessageSquare
            className={`h-3.5 w-3.5 shrink-0 ${violetText}`}
          />
        )}

        <span
          className={`text-xs font-semibold ${
            isQuestion ? blueText : violetText
          }`}
        >
          {isQuestion ? "Question" : "Answer"}
        </span>

        {isHidden && (
          <span
            className={`flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold ${amberText}`}
          >
            <EyeOff className="h-3 w-3" />
            Auto-hidden
          </span>
        )}

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="ml-auto flex items-center gap-1 text-xs font-medium text-[var(--sp-text-2)] transition-colors hover:text-[var(--sp-text)]"
        >
          <ChevronDown
            size={13}
            className={`transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          />
          {expanded ? "Hide" : "Preview"}
        </button>
      </div>

      {expanded && (
        <div className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-[var(--sp-border)] bg-[var(--sp-bg-muted)] p-3 text-sm leading-6 text-[var(--sp-text)]">
          {content}
        </div>
      )}
    </div>
  );
}

export default function AdminReportsPage() {
  const [supabase] = useState(() => createClient());

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<string>("pending");
  const [actioningId, setActioningId] = useState<string | null>(
    null,
  );
  const [expandedId, setExpandedId] = useState<string | null>(
    null,
  );

  const [deleteTarget, setDeleteTarget] = useState<Report | null>(
    null,
  );
  const [dismissTarget, setDismissTarget] = useState<Report | null>(
    null,
  );

  async function getToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) return null;

    const expiresAt = session.expires_at
      ? session.expires_at * 1000
      : 0;

    if (expiresAt - Date.now() < 60_000) {
      const { data: refreshed } =
        await supabase.auth.refreshSession();

      return refreshed.session?.access_token ?? null;
    }

    return session.access_token;
  }

  async function requireToken() {
    const token = await getToken();

    if (!token) {
      throw new Error("Session expired. Please log in again.");
    }

    return token;
  }

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadReports() {
      setLoading(true);
      setError("");

      try {
        const token = await requireToken();

        if (cancelled) return;

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/admin/community/reports`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          },
        );

        if (!res.ok) {
          throw new Error("Failed to load reports.");
        }

        const data: Report[] = await res.json();

        const filtered =
          activeTab === "pending"
            ? data.filter((r) => !r.is_reviewed)
            : activeTab === "reviewed"
              ? data.filter((r) => r.is_reviewed)
              : data;

        if (!cancelled) {
          setReports(filtered);
          setExpandedId(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Something went wrong.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadReports();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeTab, supabase]);

  async function performDismiss(report: Report) {
    setActioningId(report.id);
    setError("");

    try {
      const token = await requireToken();

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/community/reports/${report.id}/dismiss`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!res.ok) throw new Error("Failed to dismiss.");

      setReports((prev) =>
        activeTab === "pending"
          ? prev.filter((r) => r.id !== report.id)
          : prev.map((r) =>
              r.id === report.id
                ? { ...r, is_reviewed: true }
                : r,
            ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong.",
      );
    } finally {
      setActioningId(null);
      setDismissTarget(null);
    }
  }

  async function performUnhide(report: Report) {
    if (!report.question && !report.answer) {
      setError("This content is no longer available.");
      return;
    }

    setActioningId(report.id);
    setError("");

    const url = report.question
      ? `${process.env.NEXT_PUBLIC_API_URL}/api/admin/community/questions/${report.question.id}/unhide`
      : `${process.env.NEXT_PUBLIC_API_URL}/api/admin/community/answers/${report.answer!.id}/unhide`;

    try {
      const token = await requireToken();

      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to unhide.");

      setReports((prev) =>
        prev.map((r) => {
          if (r.id !== report.id) return r;

          if (report.question && r.question) {
            return {
              ...r,
              is_reviewed: true,
              question: { ...r.question, is_hidden: false },
            };
          }

          if (report.answer && r.answer) {
            return {
              ...r,
              is_reviewed: true,
              answer: { ...r.answer, is_hidden: false },
            };
          }

          return r;
        }),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong.",
      );
    } finally {
      setActioningId(null);
    }
  }

  async function performDelete(report: Report) {
    if (!report.question && !report.answer) {
      setError("This content is no longer available.");
      setDeleteTarget(null);
      return;
    }

    setActioningId(report.id);
    setError("");

    const url = report.question
      ? `${process.env.NEXT_PUBLIC_API_URL}/api/admin/community/questions/${report.question.id}`
      : `${process.env.NEXT_PUBLIC_API_URL}/api/admin/community/answers/${report.answer!.id}`;

    try {
      const token = await requireToken();

      const res = await fetch(url, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to delete.");

      setReports((prev) =>
        prev.filter((r) =>
          report.question
            ? r.question?.id !== report.question.id
            : r.answer?.id !== report.answer!.id,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong.",
      );
    } finally {
      setActioningId(null);
      setDeleteTarget(null);
    }
  }

  const deleteLabel = deleteTarget?.question
    ? `"${deleteTarget.question.title}"`
    : deleteTarget?.answer
      ? "This answer"
      : "This content";

  return (
    <div className="min-h-screen bg-[var(--sp-bg)] px-4 py-8 text-[var(--sp-text)] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <p
            className={`mb-2 text-xs font-semibold uppercase tracking-widest ${blueText}`}
          >
            Admin
          </p>

          <h1 className="text-3xl font-extrabold">Reports</h1>

          <p className={`mt-2 text-sm ${secondaryText}`}>
            Review flagged questions and answers. Auto-hidden
            content is marked and waiting for your action.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              type="button"
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              disabled={actioningId !== null}
              aria-pressed={activeTab === tab.key}
              className={`rounded-full px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
                activeTab === tab.key
                  ? "bg-blue-600 text-white"
                  : "border border-[var(--sp-border)] bg-[var(--sp-bg-card)] text-[var(--sp-text-2)] hover:border-[var(--sp-border-hover)] hover:text-[var(--sp-text)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3"
          >
            <AlertCircle
              className={`mt-0.5 h-4 w-4 shrink-0 ${redText}`}
            />
            <p className={`text-sm ${redText}`}>{error}</p>
          </div>
        )}

        {/* Report list */}
        <div className="overflow-hidden rounded-2xl border border-[var(--sp-border)] bg-[var(--sp-bg-card)]">
          {loading ? (
            <div
              role="status"
              className="flex justify-center py-20"
            >
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              <span className="sr-only">Loading reports…</span>
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-20 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
                <Flag className={`h-5 w-5 ${blueText}`} />
              </div>

              <p className={`text-sm font-semibold ${secondaryText}`}>
                {activeTab === "pending"
                  ? "No pending reports."
                  : activeTab === "reviewed"
                    ? "No reviewed reports."
                    : "No reports."}
              </p>

              {activeTab === "pending" && (
                <p className={`mt-1 text-xs ${secondaryText}`}>
                  No pending reports to review.
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="border-b border-[var(--sp-border)] px-5 py-3">
                <span className={`text-xs ${secondaryText}`}>
                  {reports.length} report
                  {reports.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="divide-y divide-[var(--sp-border)]">
                {reports.map((report) => {
                  const isHidden =
                    report.question?.is_hidden ||
                    report.answer?.is_hidden;

                  const hasContent =
                    !!report.question || !!report.answer;

                  const busy = actioningId !== null;

                  return (
                    <div key={report.id} className="p-5">
                      {/* Top row */}
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                            isHidden
                              ? "bg-amber-500/10"
                              : "bg-red-500/10"
                          }`}
                        >
                          <Flag
                            size={18}
                            className={
                              isHidden ? amberText : redText
                            }
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <ReasonPill reason={report.reason} />

                            {report.is_reviewed && (
                              <span
                                className={`flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold ${greenText}`}
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                Reviewed
                              </span>
                            )}
                          </div>

                          <p
                            className={`mt-1.5 text-xs ${secondaryText}`}
                          >
                            Reported by{" "}
                            <span className="font-medium text-[var(--sp-text)]">
                              {report.reporter?.full_name ?? "Unknown"}
                            </span>
                            {" · "}
                            {new Date(
                              report.created_at,
                            ).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>

                          <ContentPreview
                            report={report}
                            expanded={expandedId === report.id}
                            onToggle={() =>
                              setExpandedId((prev) =>
                                prev === report.id ? null : report.id,
                              )
                            }
                          />
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {!report.is_reviewed && (
                          <button
                            type="button"
                            onClick={() => setDismissTarget(report)}
                            disabled={busy}
                            className={`flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold transition hover:bg-emerald-500/20 disabled:opacity-50 ${greenText}`}
                          >
                            <CheckCircle2 size={13} />
                            Dismiss
                          </button>
                        )}

                        {isHidden && hasContent && (
                          <button
                            type="button"
                            onClick={() => performUnhide(report)}
                            disabled={busy}
                            className={`flex items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs font-semibold transition hover:bg-blue-500/20 disabled:opacity-50 ${blueText}`}
                          >
                            {actioningId === report.id ? (
                              <Loader2
                                size={13}
                                className="animate-spin"
                              />
                            ) : (
                              <Eye size={13} />
                            )}
                            Unhide
                          </button>
                        )}

                        {hasContent && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(report)}
                            disabled={busy}
                            className={`flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold transition hover:bg-red-500/20 disabled:opacity-50 ${redText}`}
                          >
                            <Trash2 size={13} />
                            Delete content
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete flagged content?"
        description={`${deleteLabel} will be permanently removed and all associated reports cleared. This cannot be undone.`}
        confirmLabel="Delete"
        tone="danger"
        loading={actioningId === deleteTarget?.id}
        onConfirm={() =>
          deleteTarget && performDelete(deleteTarget)
        }
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={dismissTarget !== null}
        title="Dismiss this report?"
        description="The report will be marked as reviewed. Use this when the report is unfounded."
        confirmLabel="Dismiss"
        tone="default"
        loading={actioningId === dismissTarget?.id}
        onConfirm={() =>
          dismissTarget && performDismiss(dismissTarget)
        }
        onCancel={() => setDismissTarget(null)}
      />
    </div>
  );
}
