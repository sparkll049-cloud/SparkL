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
  course: { name: string } | null;
  semester: { name: string } | null;
  uploader: { full_name: string | null } | null;
}

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "", label: "All" },
] as const;

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

  async function getToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

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

    if (!token) {
      setError("Session expired. Please log in again.");
      setLoading(false);
      return;
    }

    try {
      const url = new URL(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/questions`
      );
      if (activeTab) url.searchParams.set("status", activeTab);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to load past questions.");

      setQuestions(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQuestions();
  }, [activeTab]);

  async function updateStatus(id: string, status: "approved" | "pending") {
    setActioningId(id);
    setError("");

    const token = await getToken();

    if (!token) {
      setError("Session expired. Please log in again.");
      setActioningId(null);
      return;
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/questions/${id}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status }),
        }
      );

      if (!res.ok) throw new Error("Failed to update status.");

      if (activeTab && activeTab !== status) {
        setQuestions((prev) => prev.filter((q) => q.id !== id));
      } else {
        setQuestions((prev) =>
          prev.map((q) => (q.id === id ? { ...q, status } : q))
        );
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
    setError("");

    const token = await getToken();

    if (!token) {
      setError("Session expired. Please log in again.");
      setActioningId(null);
      setRejectTarget(null);
      return;
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/questions/${rejectTarget.id}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status: "rejected",
            reason: rejectReason.trim(),
          }),
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
    setError("");

    const token = await getToken();

    if (!token) {
      setError("Session expired. Please log in again.");
      setActioningId(null);
      setDeleteTarget(null);
      return;
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/questions/${id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
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
    if (selected.size === questions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(questions.map((q) => q.id)));
    }
  }

  async function performBulkApprove() {
    setBulkLoading(true);
    setError("");

    const token = await getToken();

    if (!token) {
      setError("Session expired. Please log in again.");
      setBulkLoading(false);
      setBulkConfirmOpen(false);
      return;
    }

    const ids = Array.from(selected);

    try {
      await Promise.all(
        ids.map((id) =>
          fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/admin/questions/${id}/status`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ status: "approved" }),
            }
          )
        )
      );

      if (activeTab && activeTab !== "approved") {
        setQuestions((prev) => prev.filter((q) => !selected.has(q.id)));
      } else {
        setQuestions((prev) =>
          prev.map((q) =>
            selected.has(q.id) ? { ...q, status: "approved" } : q
          )
        );
      }
      setSelected(new Set());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Some items may not have updated. Please refresh and check."
      );
    } finally {
      setBulkLoading(false);
      setBulkConfirmOpen(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Past Questions</h1>
      <p className="mt-1 text-sm text-slate-500">
        Review student uploads before they appear on the platform.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.key
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {selected.size > 0 && (
          <button
            onClick={() => setBulkConfirmOpen(true)}
            className="flex items-center gap-1.5 rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
          >
            <CheckCircle2 size={16} />
            Approve {selected.size} selected
          </button>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

      <div className="mt-6 rounded-2xl bg-white shadow-sm">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : questions.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-500">
            No {activeTab || ""} past questions found.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
              <input
                type="checkbox"
                checked={
                  selected.size === questions.length && questions.length > 0
                }
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
              <span className="text-xs font-medium text-slate-500">
                Select all
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {questions.map((q) => (
                <div key={q.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selected.has(q.id)}
                        onChange={() => toggleSelected(q.id)}
                        className="mt-3 h-4 w-4 flex-shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                      />

                      <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50">
                        <FileText size={18} className="text-blue-600" />
                      </div>

                      <div>
                        <p className="font-semibold text-slate-900">
                          {q.title}
                        </p>
                        <p className="text-sm text-slate-500">
                          {q.course?.name ?? "No course"}
                          {q.semester?.name ? ` · ${q.semester.name}` : ""}
                          {q.year ? ` · ${q.year}` : ""} · Uploaded by{" "}
                          {q.uploader?.full_name ?? "Unknown"}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {new Date(q.created_at).toLocaleDateString()}
                        </p>

                        {q.file_url && (
                          <a
                            href={q.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                          >
                            View saved file
                            <ExternalLink size={12} />
                          </a>
                        )}

                        {q.extracted_text && (
                          <button
                            onClick={() =>
                              setExpandedId(
                                expandedId === q.id ? null : q.id
                              )
                            }
                            className="mt-2 flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
                          >
                            <ChevronDown
                              size={14}
                              className={`transition-transform ${
                                expandedId === q.id ? "rotate-180" : ""
                              }`}
                            />
                            {expandedId === q.id
                              ? "Hide extracted text"
                              : "Preview extracted text"}
                          </button>
                        )}

                        {q.status === "rejected" && q.rejection_reason && (
                          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                            Reason: {q.rejection_reason}
                          </p>
                        )}
                      </div>
                    </div>

                    <StatusPill status={q.status} />
                  </div>

                  {expandedId === q.id && q.extracted_text && (
                    <div className="mt-3 max-h-64 overflow-y-auto rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                      {q.extracted_text}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {q.status !== "approved" && (
                      <button
                        onClick={() => updateStatus(q.id, "approved")}
                        disabled={actioningId === q.id}
                        className="flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-600 transition hover:bg-green-100 disabled:opacity-60"
                      >
                        <CheckCircle2 size={14} />
                        Approve
                      </button>
                    )}

                    {q.status !== "rejected" && (
                      <button
                        onClick={() => {
                          setRejectTarget(q);
                          setRejectReason("");
                        }}
                        disabled={actioningId === q.id}
                        className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-600 transition hover:bg-amber-100 disabled:opacity-60"
                      >
                        <XCircle size={14} />
                        Reject
                      </button>
                    )}

                    {q.status !== "pending" && (
                      <button
                        onClick={() => updateStatus(q.id, "pending")}
                        disabled={actioningId === q.id}
                        className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-60"
                      >
                        Reset to Pending
                      </button>
                    )}

                    <button
                      onClick={() => setDeleteTarget(q)}
                      disabled={actioningId === q.id}
                      className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-500 transition hover:bg-red-100 disabled:opacity-60"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this past question?"
        description={`"${
          deleteTarget?.title ?? ""
        }" will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete"
        tone="danger"
        loading={actioningId === deleteTarget?.id}
        onConfirm={() => deleteTarget && performDelete(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={bulkConfirmOpen}
        title={`Approve ${selected.size} question${
          selected.size !== 1 ? "s" : ""
        }?`}
        description="These will immediately become visible to students in their course pages and dashboards."
        confirmLabel="Approve All"
        tone="default"
        loading={bulkLoading}
        onConfirm={performBulkApprove}
        onCancel={() => setBulkConfirmOpen(false)}
      />

      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-base font-semibold text-slate-900">
              Reject this upload?
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Let the student know why &quot;{rejectTarget.title}&quot; was
              rejected.
            </p>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Blurry scan, wrong course, incomplete pages..."
              rows={3}
              maxLength={300}
              className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setRejectTarget(null)}
                disabled={actioningId === rejectTarget.id}
                className="flex-1 rounded-xl bg-slate-50 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={submitReject}
                disabled={!rejectReason.trim() || actioningId === rejectTarget.id}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-600 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-60"
              >
                {actioningId === rejectTarget.id && (
                  <Loader2 size={14} className="animate-spin" />
                )}
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700",
    approved: "bg-green-50 text-green-700",
    rejected: "bg-red-50 text-red-600",
  };

  return (
    <span
      className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium capitalize ${
        styles[status] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {status}
    </span>
  );
}