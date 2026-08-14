"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Loader2,
  CheckCircle2,
  Clock,
  Eye,
  X,
  AlertCircle,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";
import PdfViewer from "@/components/PdfViewer";

interface AnswerSubmission {
  id: string;
  question_id: string;
  submitted_by: string;
  status: "pending" | "reviewed";
  feedback: string | null;
  created_at: string;
  reviewed_at: string | null;
  extracted_text: string | null;
  extraction_quality: number | null;
  mime_type: string;
  question: { title: string } | null;
  student: { full_name: string } | null;
}

const LOW_QUALITY_THRESHOLD = 0.5;

type FilterTab = "pending" | "reviewed" | "all";

export default function AdminAnswersPage() {
  const supabase = createClient();
  const router = useRouter();

  const [submissions, setSubmissions] = useState<AnswerSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<FilterTab>("pending");

  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState<string | null>(null);
  const [viewerIsImage, setViewerIsImage] = useState(false);

  useEffect(() => {
    load();
  }, [tab]);

  async function load() {
    setLoading(true);
    setError("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/auth/login");
      return;
    }

    try {
      const statusParam = tab === "all" ? "" : `?status_filter=${tab}`;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/answers${statusParam}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );

      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      if (res.status === 403) throw new Error("Admin access required.");
      if (!res.ok) throw new Error("Failed to load submissions.");

      setSubmissions(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function submitReview(answerId: string) {
    const feedback = (feedbackDrafts[answerId] ?? "").trim();
    if (!feedback) return;

    setSubmittingId(answerId);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/auth/login");
      return;
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/answers/${answerId}/review`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ feedback }),
        }
      );

      if (!res.ok) throw new Error("Failed to submit review.");

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmittingId(null);
    }
  }

  async function openViewer(answerId: string, mimeType: string) {
    setViewerLoading(answerId);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/auth/login");
      return;
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/answers/${answerId}/file-url`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );

      if (!res.ok) throw new Error("Couldn't open the file.");

      const json: { url: string } = await res.json();
      setViewerUrl(json.url);
      setViewerIsImage(mimeType?.startsWith("image/"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setViewerLoading(null);
    }
  }

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "pending", label: "Pending" },
    { key: "reviewed", label: "Reviewed" },
    { key: "all", label: "All" },
  ];

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold text-slate-900">Answer Submissions</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review student-submitted answers and leave feedback.
        </p>

        <div className="mt-5 flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                tab === t.key
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-600">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : submissions.length === 0 ? (
          <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-500">
              <FileText className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-slate-700">
              No {tab !== "all" ? tab : ""} submissions.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {submissions.map((sub) => {
              const isLowQuality =
                sub.extraction_quality !== null &&
                sub.extraction_quality < LOW_QUALITY_THRESHOLD;

              return (
                <div
                  key={sub.id}
                  className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {sub.question?.title ?? "Untitled question"}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {sub.student?.full_name ?? "Unknown student"} ·{" "}
                        {new Date(sub.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {sub.status === "reviewed" ? (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" />
                          Reviewed
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                          <Clock className="h-3 w-3" />
                          Pending
                        </span>
                      )}

                      <button
                        onClick={() => openViewer(sub.id, sub.mime_type)}
                        disabled={viewerLoading === sub.id}
                        className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                      >
                        {viewerLoading === sub.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Eye size={14} />
                        )}
                        View file
                      </button>
                    </div>
                  </div>

                  {isLowQuality && (
                    <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
                      <AlertCircle size={14} className="mt-0.5 shrink-0" />
                      This scan wasn't very clear — check the original file
                      before reviewing.
                    </div>
                  )}

                  {sub.extracted_text && (
                    <div className="mt-3 rounded-xl bg-slate-50 p-3.5 text-sm leading-relaxed text-slate-700">
                      <p className="whitespace-pre-wrap">{sub.extracted_text}</p>
                    </div>
                  )}

                  {sub.status === "reviewed" ? (
                    <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3.5">
                      <p className="text-xs font-semibold text-emerald-800">
                        Your feedback
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-emerald-900">
                        {sub.feedback}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <textarea
                        value={feedbackDrafts[sub.id] ?? ""}
                        onChange={(e) =>
                          setFeedbackDrafts((prev) => ({
                            ...prev,
                            [sub.id]: e.target.value,
                          }))
                        }
                        placeholder="Write feedback for this submission..."
                        rows={3}
                        className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                      <button
                        onClick={() => submitReview(sub.id)}
                        disabled={
                          !(feedbackDrafts[sub.id] ?? "").trim() ||
                          submittingId === sub.id
                        }
                        className="mt-2 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                      >
                        {submittingId === sub.id && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        )}
                        Submit Feedback
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {viewerUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setViewerUrl(null)}
        >
          <button
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
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div onClick={(e) => e.stopPropagation()}>
              <PdfViewer url={viewerUrl} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
