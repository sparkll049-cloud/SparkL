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
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronDown,
  BookOpen,
  Zap,
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

interface ProcessedQuestion {
  id: string;
  question_number: number;
  question_text: string;
  question_type: "mcq" | "theory";
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  correct_answer: string | null;
  model_answer: string | null;
  explanation: string | null;
  topic_tag: string | null;
  difficulty: string | null;
  marks: number | null;
}

const LOW_QUALITY_THRESHOLD = 0.5;

function DifficultyBadge({ difficulty }: { difficulty: string | null }) {
  if (!difficulty) return null;
  const map: Record<string, string> = {
    easy: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    hard: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${map[difficulty] ?? "bg-slate-500/10 text-slate-400 border-slate-500/20"}`}>
      {difficulty}
    </span>
  );
}

function MCQQuestion({ q }: { q: ProcessedQuestion }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const options = ["a", "b", "c", "d"] as const;

  function getOptionStyle(opt: string) {
    if (!revealed && selected !== opt) {
      return "border-white/10 bg-white/[0.03] text-slate-300 hover:border-blue-500/40 hover:bg-blue-500/5";
    }
    if (!revealed && selected === opt) {
      return "border-blue-500/50 bg-blue-500/10 text-blue-300";
    }
    // revealed
    if (opt === q.correct_answer) {
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
    }
    if (selected === opt) {
      return "border-red-500/40 bg-red-500/10 text-red-300";
    }
    return "border-white/[0.05] bg-white/[0.02] text-slate-500";
  }

  return (
    <div className="space-y-3">
      {/* Options */}
      <div className="space-y-2">
        {options.map((opt) => {
          const text = q[`option_${opt}` as keyof ProcessedQuestion] as string | null;
          if (!text) return null;
          return (
            <button
              key={opt}
              onClick={() => {
                if (revealed) return;
                setSelected(opt);
              }}
              disabled={revealed}
              className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-all ${getOptionStyle(opt)}`}
            >
              <span className="font-semibold uppercase mr-2">{opt}.</span>
              {text}
            </button>
          );
        })}
      </div>

      {/* Submit / reveal */}
      {!revealed ? (
        <button
          onClick={() => setSelected(prev => { setRevealed(true); return prev; })}
          disabled={!selected}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Submit Answer
        </button>
      ) : (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2">
          <p className={`text-sm font-semibold ${selected === q.correct_answer ? "text-emerald-400" : "text-red-400"}`}>
            {selected === q.correct_answer ? "✓ Correct!" : `✗ Incorrect — correct answer is ${q.correct_answer?.toUpperCase()}`}
          </p>
          {q.explanation && (
            <p className="text-sm text-slate-400 leading-6">{q.explanation}</p>
          )}
        </div>
      )}
    </div>
  );
}

function TheoryQuestion({ q }: { q: ProcessedQuestion }) {
  const [showAnswer, setShowAnswer] = useState(false);

  return (
    <div className="space-y-3">
      <button
        onClick={() => setShowAnswer(!showAnswer)}
        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.08]"
      >
        <ChevronDown size={14} className={`transition-transform ${showAnswer ? "rotate-180" : ""}`} />
        {showAnswer ? "Hide Model Answer" : "Show Model Answer"}
      </button>

      {showAnswer && q.model_answer && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-xs font-semibold text-emerald-400 mb-2">Model Answer</p>
          <p className="text-sm text-slate-300 leading-7 whitespace-pre-wrap">{q.model_answer}</p>
        </div>
      )}
    </div>
  );
}

export default function QuestionDetailPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const questionId = params?.id as string;

  const [data, setData] = useState<QuestionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [processedQuestions, setProcessedQuestions] = useState<ProcessedQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);

  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState("");

  const [showRawText, setShowRawText] = useState(false);

  useEffect(() => {
    if (!questionId) return;

    async function load() {
      setLoading(true);
      setError("");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth/login"); return; }

      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/questions/${questionId}`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );
        if (res.status === 404) throw new Error("This past question wasn't found.");
        if (!res.ok) throw new Error("Failed to load this past question.");

        const json: QuestionDetail = await res.json();
        setData(json);

        // Load AI-processed questions
        await loadProcessedQuestions(session.access_token);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [questionId]);

  async function loadProcessedQuestions(token: string) {
    setQuestionsLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/questions/${questionId}/processed`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setProcessedQuestions(data);
      }
    } catch {
      // non-critical
    } finally {
      setQuestionsLoading(false);
    }
  }

  async function openViewer() {
    setViewerError("");
    setViewerLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push("/auth/login"); return; }

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

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-slate-500">{error || "Question not found."}</p>
        <Link href="/dashboard" className="font-semibold text-blue-500 hover:underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const isImage = data.mime_type?.startsWith("image/");
  const isLowQuality = data.extraction_quality !== null && data.extraction_quality < LOW_QUALITY_THRESHOLD;
  const hasProcessed = processedQuestions.length > 0;
  const theoryCount = processedQuestions.filter(q => q.question_type === "theory").length;
  const mcqCount = processedQuestions.filter(q => q.question_type === "mcq").length;

  return (
    <div className="min-h-screen bg-[#07091A] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl">

        {/* Back */}
        <Link
          href={data.course ? `/dashboard/courses/${data.course.id}` : "/dashboard"}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-300 transition-colors"
        >
          <ArrowLeft size={15} />
          Back
        </Link>

        {/* Header card */}
        <div className="mt-4 rounded-2xl border border-white/[0.06] bg-[#0D1230] p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
              <FileText size={20} className="text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-white">{data.title}</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                {data.course?.name ?? "—"}
                {data.semester?.name ? ` · ${data.semester.name}` : ""}
                {data.year ? ` · ${data.year}` : ""}
              </p>
            </div>
            <button
              onClick={openViewer}
              disabled={viewerLoading}
              className="ml-auto flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.08] disabled:opacity-60 transition"
            >
              {viewerLoading ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />}
              View file
            </button>
          </div>

          {viewerError && (
            <p className="mt-3 text-xs text-red-400">{viewerError}</p>
          )}

          {isLowQuality && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
              <AlertCircle size={13} className="mt-0.5 shrink-0 text-amber-400" />
              <p className="text-xs text-amber-400">
                This scan wasn't very clear — tap "View file" to check the original if anything looks off.
              </p>
            </div>
          )}

          {/* Stats row */}
          {hasProcessed && (
            <div className="mt-4 flex flex-wrap gap-3 border-t border-white/[0.05] pt-4">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Sparkles size={12} className="text-violet-400" />
                <span className="font-semibold text-violet-400">AI Processed</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <BookOpen size={12} />
                {processedQuestions.length} questions total
              </div>
              {mcqCount > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Zap size={12} className="text-blue-400" />
                  {mcqCount} MCQ
                </div>
              )}
              {theoryCount > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <FileText size={12} className="text-slate-400" />
                  {theoryCount} Theory
                </div>
              )}
            </div>
          )}
        </div>

        {/* Questions */}
        <div className="mt-6 space-y-4">
          {questionsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : hasProcessed ? (
            <>
              {processedQuestions.map((q, i) => (
                <div
                  key={q.id}
                  className="rounded-2xl border border-white/[0.06] bg-[#0D1230] p-5"
                >
                  {/* Question header */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-blue-400">
                        Q{q.question_number ?? i + 1}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${
                        q.question_type === "mcq"
                          ? "border-blue-500/20 bg-blue-500/10 text-blue-400"
                          : "border-slate-500/20 bg-slate-500/10 text-slate-400"
                      }`}>
                        {q.question_type === "mcq" ? "MCQ" : "Theory"}
                      </span>
                      <DifficultyBadge difficulty={q.difficulty} />
                      {q.topic_tag && (
                        <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-400">
                          {q.topic_tag}
                        </span>
                      )}
                      {q.marks && (
                        <span className="text-[10px] text-slate-600">{q.marks} marks</span>
                      )}
                    </div>
                  </div>

                  {/* Question text */}
                  <p className="text-sm text-slate-200 leading-7 whitespace-pre-wrap mb-4">
                    {q.question_text}
                  </p>

                  {/* MCQ or Theory interaction */}
                  {q.question_type === "mcq" ? (
                    <MCQQuestion q={q} />
                  ) : (
                    <TheoryQuestion q={q} />
                  )}
                </div>
              ))}
            </>
          ) : (
            /* Fallback — no processed questions yet */
            <div className="rounded-2xl border border-white/[0.06] bg-[#0D1230] p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText size={16} className="text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-400">Extracted Text</h2>
                <span className="ml-auto text-xs text-slate-600">
                  AI processing not yet done
                </span>
              </div>

              {data.extracted_text ? (
                <div className="space-y-1.5 text-sm leading-7 text-slate-400">
                  {data.extracted_text
                    .split(/\n+/)
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .map((line, i) => (
                      <p key={i} className={/^\(?[a-z]\)|^\(?[ivx]+\)/i.test(line) ? "ml-4" : ""}>
                        {line}
                      </p>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-slate-600">No extracted text available.</p>
              )}
            </div>
          )}
        </div>

      </div>

      {/* PDF/Image viewer modal */}
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