"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  Loader2,
  AlertCircle,
  Eye,
  X,
  Upload as UploadIcon,
  CheckCircle2,
  Clock,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";
import PdfViewer from "@/components/PdfViewer";

interface QuestionDetail {
  id: string;
  title: string;
  year: string | null;
  status: string;
  extracted_text: string | null;
  extraction_quality: number | null;
  mime_type: string;
  created_at: string;
  course: { id: string; name: string } | null;
  semester: { id: string; name: string } | null;
}

interface FormattedLine {
  text: string;
  indent: boolean;
}

interface AnswerSubmission {
  id: string;
  status: "pending" | "reviewed";
  feedback: string | null;
  created_at: string;
  reviewed_at: string | null;
  extraction_quality: number | null;
}

const LOW_QUALITY_THRESHOLD = 0.5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];

// Preserves the document's own line breaks and structure instead of
// re-grouping text into arbitrary sentence blocks. Lines that look like
// sub-parts (a), (b), i), ii), etc. get a light indent so nested
// question structure stays visually clear.
function formatExtractedText(text: string): FormattedLine[] {
  const subPartPattern = /^\(?[a-z]\)|^\(?[ivx]+\)/i;

  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({
      text: line,
      indent: subPartPattern.test(line),
    }));
}

export default function QuestionDetailPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const questionId = params?.id as string;
  const answerFileInputRef = useRef<HTMLInputElement>(null);

  const [data, setData] = useState<QuestionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState("");

  const [myAnswers, setMyAnswers] = useState<AnswerSubmission[]>([]);
  const [answerFile, setAnswerFile] = useState<File | null>(null);
  const [answerFileError, setAnswerFileError] = useState("");
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [answerError, setAnswerError] = useState("");
  const [answerSuccess, setAnswerSuccess] = useState(false);

  useEffect(() => {
    if (!questionId) return;

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
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/questions/${questionId}`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );

        if (res.status === 404) throw new Error("This past question wasn't found.");
        if (!res.ok) throw new Error("Failed to load this past question.");

        const json: QuestionDetail = await res.json();
        setData(json);

        await loadMyAnswers(session.access_token);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [questionId]);

  async function loadMyAnswers(token: string) {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/answers/mine/${questionId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) setMyAnswers(await res.json());
    } catch {
      // Non-critical — history is secondary to the rest of the page
    }
  }

  async function openViewer() {
    setViewerError("");
    setViewerLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/auth/login");
      return;
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/questions/${questionId}/file-url`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );

      if (!res.ok) throw new Error("Couldn't open the file.");

      const json: { url: string } = await res.json();
      setViewerUrl(json.url);
    } catch (err) {
      setViewerError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setViewerLoading(false);
    }
  }

  function handleAnswerFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setAnswerFileError("");
    const selected = e.target.files?.[0] ?? null;

    if (!selected) {
      setAnswerFile(null);
      return;
    }

    if (!ALLOWED_TYPES.includes(selected.type)) {
      setAnswerFileError("Only PDF, JPG, and PNG files are allowed.");
      setAnswerFile(null);
      return;
    }

    if (selected.size > MAX_FILE_SIZE) {
      setAnswerFileError("File is too large. Maximum size is 10MB.");
      setAnswerFile(null);
      return;
    }

    setAnswerFile(selected);
  }

  async function handleSubmitAnswer(e: React.FormEvent) {
    e.preventDefault();
    setAnswerError("");
    setAnswerSuccess(false);

    if (!answerFile) {
      setAnswerError("Please choose a file to submit.");
      return;
    }

    setSubmittingAnswer(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setSubmittingAnswer(false);
      router.push("/auth/login");
      return;
    }

    const formData = new FormData();
    formData.append("question_id", questionId);
    formData.append("file", answerFile);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/answers`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        }
      );

      if (res.status === 401) {
        setSubmittingAnswer(false);
        router.push("/auth/login");
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail ?? "Submission failed. Please try again.");
      }

      setAnswerSuccess(true);
      setAnswerFile(null);
      if (answerFileInputRef.current) answerFileInputRef.current.value = "";

      await loadMyAnswers(session.access_token);
    } catch (err) {
      setAnswerError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmittingAnswer(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-slate-600">{error || "Question not found."}</p>
        <Link href="/dashboard" className="font-semibold text-blue-600 hover:underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const lines = data.extracted_text ? formatExtractedText(data.extracted_text) : [];
  const isLowQuality =
    data.extraction_quality !== null && data.extraction_quality < LOW_QUALITY_THRESHOLD;
  const isImage = data.mime_type?.startsWith("image/");

  return (
    <div className="mx-auto max-w-3xl px-6 pb-16 pt-8">
      <Link
        href={data.course ? `/dashboard/courses/${data.course.id}` : "/dashboard"}
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={16} />
        Back
      </Link>

      <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
            <FileText size={20} />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900">{data.title}</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {data.course?.name ?? "—"}
              {data.semester?.name ? ` · ${data.semester.name}` : ""}
              {data.year ? ` · ${data.year}` : ""}
            </p>
          </div>
          <button
            onClick={openViewer}
            disabled={viewerLoading}
            className="ml-auto flex shrink-0 items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {viewerLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Eye size={14} />
            )}
            View file
          </button>
        </div>

        {viewerError && (
          <p className="mt-3 text-xs text-red-500">{viewerError}</p>
        )}

        {isLowQuality && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>
              This scan wasn't very clear, so the text below may have small
              errors — tap "View file" above to check the original if
              anything looks off.
            </span>
          </div>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-slate-900">Extracted Text</h2>

        {lines.length === 0 ? (
          <p className="text-sm text-slate-400">No extracted text available for this file.</p>
        ) : (
          <div className="space-y-2 text-[15px] leading-relaxed text-slate-700">
            {lines.map((line, i) => (
              <p
                key={i}
                className={`whitespace-pre-wrap ${line.indent ? "ml-4" : ""}`}
              >
                {line.text}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Submit an answer */}
      <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-base font-semibold text-slate-900">Submit Your Answer</h2>
        <p className="mb-4 text-sm text-slate-500">
          Upload a photo or scan of your written answer — an admin will
          review it and leave feedback.
        </p>

        <form onSubmit={handleSubmitAnswer} className="space-y-4">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-4 py-8 text-center transition hover:border-blue-300 hover:bg-blue-50/40">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <UploadIcon className="h-4 w-4" />
            </div>
            <span className="text-sm text-slate-500">
              {answerFile ? answerFile.name : "Click to choose a PDF, JPG, or PNG (max 10MB)"}
            </span>
            <input
              ref={answerFileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleAnswerFileChange}
              className="hidden"
            />
          </label>
          {answerFileError && (
            <p className="text-sm text-red-500">{answerFileError}</p>
          )}

          {answerError && <p className="text-sm text-red-500">{answerError}</p>}
          {answerSuccess && (
            <p className="flex items-center gap-1.5 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              Submitted — pending admin review.
            </p>
          )}

          <button
            type="submit"
            disabled={!answerFile || !!answerFileError || submittingAnswer}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {submittingAnswer && <Loader2 className="h-4 w-4 animate-spin" />}
            {submittingAnswer ? "Submitting..." : "Submit Answer"}
          </button>
        </form>

        {myAnswers.length > 0 && (
          <div className="mt-6 border-t border-slate-100 pt-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">
              Your Submissions
            </h3>
            <div className="space-y-3">
              {myAnswers.map((a) => (
                <div
                  key={a.id}
                  className="rounded-xl border border-slate-100 bg-slate-50 p-3.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-500">
                      {new Date(a.created_at).toLocaleDateString()}
                    </span>
                    {a.status === "reviewed" ? (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" />
                        Reviewed
                      </span>
                    ) : (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                        <Clock className="h-3 w-3" />
                        Pending
                      </span>
                    )}
                  </div>
                  {a.status === "reviewed" && a.feedback && (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                      {a.feedback}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* In-app viewer modal — deliberately not a direct <a href> link
          or native <iframe> (which would hand control to the browser's
          own PDF viewer, complete with its own download button). Images
          render directly with right-click/drag disabled; PDFs render
          page-by-page onto <canvas> via PdfViewer. This cannot stop
          screenshots, only make link-sharing and save-as harder. */}
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

          {isImage ? (
            <img
              src={viewerUrl}
              alt={data.title}
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              className="max-h-full max-w-full select-none rounded-lg"
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
