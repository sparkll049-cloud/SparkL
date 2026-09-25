"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  Loader2,
  AlertCircle,
  Eye,
  ChevronDown,
  BookOpen,
  Zap,
  Play,
  RotateCcw,
  Lock,
  Sparkles,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";
import SecureViewer from "@/components/SecureViewer";

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

interface QuestionLimits {
  is_paid: boolean;
  read_mode_percent: number;
  practice_mode_max: number | null;
}

const LOW_QUALITY_THRESHOLD = 0.5;
const FREE_READ_CAP         = 10;
const FREE_PRACTICE_CAP     = 5;

// ── Read mode: single question (no interaction) ───────────────────────────────
function ReadQuestion({ q, index }: { q: ProcessedQuestion; index: number }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0D1230] p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-bold text-blue-400">
          Question {q.question_number ?? index + 1}
        </span>
        {q.marks && (
          <span className="text-[10px] text-slate-600 ml-auto">{q.marks} marks</span>
        )}
      </div>
      <p className="text-sm text-slate-200 leading-7 whitespace-pre-wrap">
        {q.question_text}
      </p>
      {q.question_type === "mcq" && (
        <div className="mt-4 space-y-2">
          {(["a", "b", "c", "d"] as const).map((opt) => {
            const text = q[`option_${opt}` as keyof ProcessedQuestion] as string | null;
            if (!text) return null;
            return (
              <div
                key={opt}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-sm text-slate-400"
              >
                <span className="font-semibold uppercase mr-2 text-slate-500">{opt}.</span>
                {text}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Practice mode: MCQ with interaction ──────────────────────────────────────
function PracticeMCQ({ q }: { q: ProcessedQuestion }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  function getOptionStyle(opt: string) {
    if (!revealed && selected !== opt)
      return "border-white/10 bg-white/[0.03] text-slate-300 hover:border-blue-500/40 hover:bg-blue-500/5";
    if (!revealed && selected === opt)
      return "border-blue-500/50 bg-blue-500/10 text-blue-300";
    if (opt === q.correct_answer)
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
    if (selected === opt)
      return "border-red-500/40 bg-red-500/10 text-red-300";
    return "border-white/[0.05] bg-white/[0.02] text-slate-500";
  }

  return (
    <div className="space-y-2">
      {(["a", "b", "c", "d"] as const).map((opt) => {
        const text = q[`option_${opt}` as keyof ProcessedQuestion] as string | null;
        if (!text) return null;
        return (
          <button
            key={opt}
            onClick={() => { if (!revealed) setSelected(opt); }}
            disabled={revealed}
            className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-all ${getOptionStyle(opt)}`}
          >
            <span className="font-semibold uppercase mr-2">{opt}.</span>
            {text}
          </button>
        );
      })}
      {!revealed ? (
        <button
          onClick={() => setRevealed(true)}
          disabled={!selected}
          className="mt-1 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Submit Answer
        </button>
      ) : (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2 mt-1">
          <p className={`text-sm font-semibold ${selected === q.correct_answer ? "text-emerald-400" : "text-red-400"}`}>
            {selected === q.correct_answer
              ? "✓ Correct!"
              : `✗ Incorrect — correct answer is ${q.correct_answer?.toUpperCase()}`}
          </p>
          {q.explanation && (
            <p className="text-sm text-slate-400 leading-6">{q.explanation}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Practice mode: Theory with model answer toggle ───────────────────────────
function PracticeTheory({ q }: { q: ProcessedQuestion }) {
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

// ── Practice mode: full question card ────────────────────────────────────────
function PracticeQuestion({ q, index }: { q: ProcessedQuestion; index: number }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0D1230] p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-bold text-blue-400">
          Question {q.question_number ?? index + 1}
        </span>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
          q.question_type === "mcq"
            ? "border-blue-500/20 bg-blue-500/10 text-blue-400"
            : "border-slate-500/20 bg-slate-500/10 text-slate-400"
        }`}>
          {q.question_type === "mcq" ? "MCQ" : "Theory"}
        </span>
        {q.topic_tag && (
          <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-400">
            {q.topic_tag}
          </span>
        )}
        {q.marks && (
          <span className="text-[10px] text-slate-600 ml-auto">{q.marks} marks</span>
        )}
      </div>
      <p className="text-sm text-slate-200 leading-7 whitespace-pre-wrap mb-4">
        {q.question_text}
      </p>
      {q.question_type === "mcq"
        ? <PracticeMCQ q={q} />
        : <PracticeTheory q={q} />
      }
    </div>
  );
}

// ── Free gate banner ──────────────────────────────────────────────────────────
function FreeGateBanner({ hiddenCount, mode }: { hiddenCount: number; mode: "read" | "practice" }) {
  return (
    <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.06] p-6 text-center">
      <div className="flex justify-center mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15">
          <Lock className="h-4 w-4 text-indigo-400" />
        </div>
      </div>
      <p className="text-sm font-semibold text-white">
        {hiddenCount} more question{hiddenCount !== 1 ? "s" : ""} locked
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {mode === "read"
          ? `Free plan shows only the first ${FREE_READ_CAP} questions`
          : `Free plan limits practice to ${FREE_PRACTICE_CAP} questions`}
      </p>
      <Link
        href="/dashboard/subscribe"
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 transition-colors"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Unlock all questions
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function QuestionDetailPage() {
  const supabase   = createClient();
  const router     = useRouter();
  const params     = useParams();
  const questionId = params?.id as string;

  const [data, setData]         = useState<QuestionDetail | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  const [processedQuestions, setProcessedQuestions] = useState<ProcessedQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading]     = useState(false);

  const [limits, setLimits] = useState<QuestionLimits>({
    is_paid:            true,
    read_mode_percent:  100,
    practice_mode_max:  null,
  });

  const [mode, setMode]             = useState<"read" | "practice">("read");
  const [viewerOpen, setViewerOpen] = useState(false);   // ← replaces viewerUrl

  useEffect(() => {
    if (!questionId) return;
    async function load() {
      setLoading(true);
      setError("");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth/login"); return; }

      try {
        const [detailRes, limitsRes] = await Promise.all([
          fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/questions/${questionId}`,
            { headers: { Authorization: `Bearer ${session.access_token}` } }
          ),
          fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/payments/subscription/status`,
            { headers: { Authorization: `Bearer ${session.access_token}` } }
          ),
        ]);

        if (detailRes.status === 404) throw new Error("This past question wasn't found.");
        if (!detailRes.ok)            throw new Error("Failed to load this past question.");
        setData(await detailRes.json());

        if (limitsRes.ok) {
          const d = await limitsRes.json();
          setLimits({
            is_paid:            d.is_paid            ?? false,
            read_mode_percent:  d.read_mode_percent  ?? 100,
            practice_mode_max:  d.practice_mode_max  ?? null,
          });
        }

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
      if (res.ok) setProcessedQuestions(await res.json());
    } catch { /* non-critical */ }
    finally { setQuestionsLoading(false); }
  }

  // ── Loading / error states ──────────────────────────────────────────
  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
    </div>
  );

  if (error || !data) return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-slate-500">{error || "Question not found."}</p>
      <Link href="/dashboard" className="font-semibold text-blue-500 hover:underline">
        Back to Dashboard
      </Link>
    </div>
  );

  const isLowQuality  = data.extraction_quality !== null && data.extraction_quality < LOW_QUALITY_THRESHOLD;
  const hasProcessed  = processedQuestions.length > 0;
  const mcqCount      = processedQuestions.filter(q => q.question_type === "mcq").length;
  const theoryCount   = processedQuestions.filter(q => q.question_type === "theory").length;
  const isPdf         = data.mime_type?.startsWith("application/pdf");

  const visibleQuestions = !limits.is_paid
    ? mode === "practice"
      ? processedQuestions.slice(0, FREE_PRACTICE_CAP)
      : processedQuestions.slice(0, FREE_READ_CAP)
    : processedQuestions;

  const hiddenCount = processedQuestions.length - visibleQuestions.length;
  const isGated     = !limits.is_paid && hiddenCount > 0;

  return (
    <div className="min-h-screen bg-[#07091A] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl">

        {/* Back */}
        <Link
          href={data.course ? `/dashboard/courses/${data.course.id}` : "/dashboard"}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-300 transition-colors"
        >
          <ArrowLeft size={15} /> Back
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

            {/* View file button — only for PDFs */}
            {isPdf && (
              <button
                onClick={() => setViewerOpen(true)}
                className="ml-auto flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.08] transition"
              >
                <Eye size={13} />
                View file
              </button>
            )}
          </div>

          {isLowQuality && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
              <AlertCircle size={13} className="mt-0.5 shrink-0 text-amber-400" />
              <p className="text-xs text-amber-400">
                This scan wasn't very clear — tap "View file" to check the original.
              </p>
            </div>
          )}

          {/* Stats + mode switcher */}
          {hasProcessed && (
            <div className="mt-4 border-t border-white/[0.05] pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <BookOpen size={12} />
                    {processedQuestions.length} questions
                    {!limits.is_paid && (
                      <span className="text-slate-600">
                        · {mode === "read" ? FREE_READ_CAP : FREE_PRACTICE_CAP} visible
                      </span>
                    )}
                  </div>
                  {mcqCount > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Zap size={12} className="text-blue-400" />
                      {mcqCount} MCQ
                    </div>
                  )}
                  {theoryCount > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <FileText size={12} />
                      {theoryCount} Theory
                    </div>
                  )}
                </div>

                {mode === "read" ? (
                  <button
                    onClick={() => setMode("practice")}
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-500"
                  >
                    <Play size={13} /> Start Practice
                  </button>
                ) : (
                  <button
                    onClick={() => setMode("read")}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.08]"
                  >
                    <RotateCcw size={13} /> Back to Reading
                  </button>
                )}
              </div>

              <p className="mt-2 text-xs text-slate-600">
                {mode === "read"
                  ? "Reading mode — answers hidden. Tap Start Practice to test yourself."
                  : "Practice mode — answer each question and check your score."}
              </p>
            </div>
          )}
        </div>

        {/* Question list */}
        <div className="mt-6 space-y-4">
          {questionsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : hasProcessed ? (
            <>
              {mode === "read"
                ? visibleQuestions.map((q, i) => <ReadQuestion key={q.id} q={q} index={i} />)
                : visibleQuestions.map((q, i) => <PracticeQuestion key={q.id} q={q} index={i} />)
              }
              {isGated && <FreeGateBanner hiddenCount={hiddenCount} mode={mode} />}
            </>
          ) : (
            /* No processed questions yet — open the secure PDF viewer */
            <div className="rounded-2xl border border-white/[0.06] bg-[#0D1230] p-8 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10">
                <FileText size={20} className="text-blue-400" />
              </div>
              <p className="text-sm font-semibold text-white">View the original document</p>
              <p className="mt-1 text-xs text-slate-500">
                Practice questions are being prepared. Read the original paper below.
              </p>
              <button
                onClick={() => setViewerOpen(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition"
              >
                <Eye size={14} /> Open document
              </button>
            </div>
          )}
        </div>

      </div>

      {/* ── Secure viewer — full screen, no raw PDF URL ── */}
      {viewerOpen && (
        <SecureViewer
          questionId={questionId}
          onClose={() => setViewerOpen(false)}
          isPaid={limits.is_paid}
        />
      )}
    </div>
  );
}
