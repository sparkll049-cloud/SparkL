
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, FileText, Loader2, AlertCircle,
  BookOpen, Zap, Play, RotateCcw, Lock, Sparkles,
  ChevronDown, Eye,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";
import SecureViewer from "@/components/SecureViewer";

// ── Types ─────────────────────────────────────────────────────────────────────

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
const FREE_PRACTICE_CAP     = 5;

// ── Tab type ──────────────────────────────────────────────────────────────────
type Tab = "view" | "practice";

// ── Practice: MCQ ─────────────────────────────────────────────────────────────
function PracticeMCQ({ q }: { q: ProcessedQuestion }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  function style(opt: string) {
    if (!revealed && selected !== opt)
      return { borderColor: "var(--sp-border)", background: "var(--sp-bg-muted)", color: "var(--sp-text-2)" };
    if (!revealed && selected === opt)
      return { borderColor: "rgba(99,102,241,0.5)", background: "rgba(99,102,241,0.08)", color: "var(--sp-text)" };
    if (opt === q.correct_answer)
      return { borderColor: "rgba(16,185,129,0.4)", background: "rgba(16,185,129,0.08)", color: "#10b981" };
    if (selected === opt)
      return { borderColor: "rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.08)", color: "#ef4444" };
    return { borderColor: "var(--sp-border)", background: "var(--sp-bg-muted)", color: "var(--sp-text-3)" };
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
            className="w-full rounded-xl border px-4 py-3 text-left text-sm transition-all disabled:cursor-default"
            style={style(opt)}
          >
            <span className="font-bold uppercase mr-2">{opt}.</span>{text}
          </button>
        );
      })}

      {!revealed ? (
        <button
          onClick={() => setRevealed(true)}
          disabled={!selected}
          className="mt-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Submit answer
        </button>
      ) : (
        <div className="rounded-xl border p-4 space-y-1.5 mt-1"
          style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-muted)" }}>
          <p className={`text-sm font-semibold ${selected === q.correct_answer ? "text-emerald-500" : "text-red-500"}`}>
            {selected === q.correct_answer
              ? "✓ Correct!"
              : `✗ Incorrect — answer is ${q.correct_answer?.toUpperCase()}`}
          </p>
          {q.explanation && (
            <p className="text-sm leading-6" style={{ color: "var(--sp-text-3)" }}>{q.explanation}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Practice: Theory ──────────────────────────────────────────────────────────
function PracticeTheory({ q }: { q: ProcessedQuestion }) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-3">
      <button
        onClick={() => setShow(!show)}
        className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition"
        style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-muted)", color: "var(--sp-text-2)" }}
      >
        <ChevronDown size={14} className={`transition-transform ${show ? "rotate-180" : ""}`} />
        {show ? "Hide model answer" : "Show model answer"}
      </button>
      {show && q.model_answer && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-xs font-semibold text-emerald-500 mb-2">Model Answer</p>
          <p className="text-sm leading-7 whitespace-pre-wrap" style={{ color: "var(--sp-text-2)" }}>
            {q.model_answer}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Practice: Question card ────────────────────────────────────────────────────
function PracticeQuestion({ q, index }: { q: ProcessedQuestion; index: number }) {
  return (
    <div className="rounded-2xl border p-5"
      style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-xs font-bold text-indigo-500">
          Question {q.question_number ?? index + 1}
        </span>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
          q.question_type === "mcq"
            ? "border-blue-500/20 bg-blue-500/10 text-blue-500"
            : "border-slate-500/20 bg-slate-500/10 text-slate-500"
        }`}>
          {q.question_type === "mcq" ? "MCQ" : "Theory"}
        </span>
        {q.topic_tag && (
          <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-500">
            {q.topic_tag}
          </span>
        )}
        {q.marks && (
          <span className="ml-auto text-[10px]" style={{ color: "var(--sp-text-3)" }}>
            {q.marks} marks
          </span>
        )}
      </div>
      <p className="text-sm leading-7 whitespace-pre-wrap mb-4" style={{ color: "var(--sp-text)" }}>
        {q.question_text}
      </p>
      {q.question_type === "mcq"
        ? <PracticeMCQ q={q} />
        : <PracticeTheory q={q} />
      }
    </div>
  );
}

// ── Gate banner ───────────────────────────────────────────────────────────────
function GateBanner({ hiddenCount }: { hiddenCount: number }) {
  return (
    <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.06] p-6 text-center">
      <div className="flex justify-center mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15">
          <Lock className="h-4 w-4 text-indigo-500" />
        </div>
      </div>
      <p className="text-sm font-semibold" style={{ color: "var(--sp-text)" }}>
        {hiddenCount} more question{hiddenCount !== 1 ? "s" : ""} locked
      </p>
      <p className="mt-1 text-xs" style={{ color: "var(--sp-text-3)" }}>
        Free plan limits practice to {FREE_PRACTICE_CAP} questions
      </p>
      <Link
        href="/dashboard/subscribe"
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 transition"
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

  const [data, setData]       = useState<QuestionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  const [processedQuestions, setProcessedQuestions] = useState<ProcessedQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading]     = useState(false);

  const [limits, setLimits] = useState<QuestionLimits>({
    is_paid: true, read_mode_percent: 100, practice_mode_max: null,
  });

  // Default tab is "view" — SecureViewer shown first
  const [tab, setTab] = useState<Tab>("view");

  useEffect(() => {
    if (!questionId) return;
    async function load() {
      setLoading(true);
      setError("");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth/login"); return; }
      try {
        const [detailRes, limitsRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/questions/${questionId}`,
            { headers: { Authorization: `Bearer ${session.access_token}` } }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/payments/subscription/status`,
            { headers: { Authorization: `Bearer ${session.access_token}` } }),
        ]);
        if (detailRes.status === 404) throw new Error("This past question wasn't found.");
        if (!detailRes.ok) throw new Error("Failed to load this past question.");
        setData(await detailRes.json());
        if (limitsRes.ok) {
          const d = await limitsRes.json();
          setLimits({
            is_paid: d.is_paid ?? false,
            read_mode_percent: d.read_mode_percent ?? 100,
            practice_mode_max: d.practice_mode_max ?? null,
          });
        }
        // Load practice questions in background
        setQuestionsLoading(true);
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/questions/${questionId}/processed`,
          { headers: { Authorization: `Bearer ${session.access_token}` } })
          .then(r => r.ok ? r.json() : [])
          .then(setProcessedQuestions)
          .catch(() => {})
          .finally(() => setQuestionsLoading(false));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [questionId]);

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
    </div>
  );

  if (error || !data) return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm" style={{ color: "var(--sp-text-3)" }}>{error || "Question not found."}</p>
      <Link href="/dashboard" className="text-sm font-semibold text-indigo-500 hover:underline">
        Back to Dashboard
      </Link>
    </div>
  );

  const isPdf         = data.mime_type?.startsWith("application/pdf");
  const isLowQuality  = data.extraction_quality !== null && data.extraction_quality < LOW_QUALITY_THRESHOLD;
  const hasProcessed  = processedQuestions.length > 0;
  const mcqCount      = processedQuestions.filter(q => q.question_type === "mcq").length;
  const theoryCount   = processedQuestions.filter(q => q.question_type === "theory").length;

  const visibleQuestions = !limits.is_paid
    ? processedQuestions.slice(0, FREE_PRACTICE_CAP)
    : processedQuestions;
  const hiddenCount = processedQuestions.length - visibleQuestions.length;
  const isGated     = !limits.is_paid && hiddenCount > 0;

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6" style={{ background: "var(--sp-bg)" }}>
      <div className="mx-auto max-w-3xl">

        {/* Back */}
        <Link
          href={data.course ? `/dashboard/courses/${data.course.id}` : "/dashboard"}
          className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
          style={{ color: "var(--sp-text-3)" }}
        >
          <ArrowLeft size={15} /> Back
        </Link>

        {/* Header */}
        <div className="mt-4 rounded-2xl border p-5"
          style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10">
              <FileText size={20} className="text-indigo-500" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold" style={{ color: "var(--sp-text)" }}>
                {data.title}
              </h1>
              <p className="mt-0.5 text-sm" style={{ color: "var(--sp-text-3)" }}>
                {data.course?.name ?? "—"}
                {data.semester?.name ? ` · ${data.semester.name}` : ""}
                {data.year ? ` · ${data.year}` : ""}
              </p>
            </div>
          </div>

          {isLowQuality && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
              <AlertCircle size={13} className="mt-0.5 shrink-0 text-amber-500" />
              <p className="text-xs text-amber-500">
                This scan quality is low — some content may be unclear.
              </p>
            </div>
          )}

          {/* ── Tabs ── */}
          <div className="mt-5 flex items-center gap-1 border-t pt-4"
            style={{ borderColor: "var(--sp-border)" }}>

            {/* View tab — always shown for PDFs */}
            {isPdf && (
              <button
                onClick={() => setTab("view")}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                  tab === "view" ? "bg-indigo-600 text-white" : ""
                }`}
                style={tab !== "view" ? { color: "var(--sp-text-3)", background: "var(--sp-bg-muted)" } : {}}
              >
                <Eye size={12} /> View paper
              </button>
            )}

            {/* Practice tab — shown only when AI has processed the paper */}
            {questionsLoading ? (
              <div className="flex items-center gap-1.5 px-3.5 py-2">
                <Loader2 size={12} className="animate-spin text-indigo-400" />
                <span className="text-xs" style={{ color: "var(--sp-text-3)" }}>Loading practice…</span>
              </div>
            ) : hasProcessed ? (
              <button
                onClick={() => setTab("practice")}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                  tab === "practice" ? "bg-indigo-600 text-white" : ""
                }`}
                style={tab !== "practice" ? { color: "var(--sp-text-3)", background: "var(--sp-bg-muted)" } : {}}
              >
                <Play size={12} /> Practice
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                  tab === "practice" ? "bg-white/20 text-white" : "bg-indigo-500/15 text-indigo-500"
                }`}>
                  {processedQuestions.length}
                </span>
              </button>
            ) : null}

            {/* Stats */}
            {hasProcessed && (
              <div className="ml-auto flex items-center gap-3">
                {mcqCount > 0 && (
                  <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--sp-text-3)" }}>
                    <Zap size={10} className="text-blue-500" />{mcqCount} MCQ
                  </span>
                )}
                {theoryCount > 0 && (
                  <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--sp-text-3)" }}>
                    <BookOpen size={10} />{theoryCount} Theory
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Tab content ── */}
        <div className="mt-4">

          {/* VIEW tab — SecureViewer embedded inline */}
          {tab === "view" && isPdf && (
            <div className="rounded-2xl border overflow-hidden"
              style={{ borderColor: "var(--sp-border)" }}>
              <SecureViewer
                questionId={questionId}
                onClose={() => {}}   // no close — it's inline, not a modal
                isPaid={limits.is_paid}
                inline                // new prop — removes the fixed/fullscreen wrapper
              />
            </div>
          )}

          {/* No PDF fallback */}
          {tab === "view" && !isPdf && (
            <div className="rounded-2xl border p-8 text-center"
              style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
              <FileText size={24} className="mx-auto mb-3 text-indigo-400" />
              <p className="text-sm font-semibold" style={{ color: "var(--sp-text)" }}>
                No PDF viewer for this file type
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--sp-text-3)" }}>
                Switch to Practice to interact with extracted questions.
              </p>
            </div>
          )}

          {/* PRACTICE tab */}
          {tab === "practice" && (
            <div className="space-y-4">
              {hasProcessed ? (
                <>
                  <div className="flex items-center justify-between px-1">
                    <p className="text-xs font-semibold" style={{ color: "var(--sp-text-3)" }}>
                      {visibleQuestions.length} question{visibleQuestions.length !== 1 ? "s" : ""}
                      {!limits.is_paid ? ` (free limit: ${FREE_PRACTICE_CAP})` : ""}
                    </p>
                    <button
                      onClick={() => setTab("view")}
                      className="flex items-center gap-1 text-xs font-semibold transition"
                      style={{ color: "var(--sp-text-3)" }}
                    >
                      <RotateCcw size={11} /> Back to paper
                    </button>
                  </div>
                  {visibleQuestions.map((q, i) => (
                    <PracticeQuestion key={q.id} q={q} index={i} />
                  ))}
                  {isGated && <GateBanner hiddenCount={hiddenCount} />}
                </>
              ) : (
                <div className="rounded-2xl border p-10 text-center"
                  style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
                  <Sparkles size={24} className="mx-auto mb-3 text-violet-400" />
                  <p className="text-sm font-semibold" style={{ color: "var(--sp-text)" }}>
                    Practice questions not ready yet
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--sp-text-3)" }}>
                    AI is processing this paper. Check back shortly.
                  </p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}