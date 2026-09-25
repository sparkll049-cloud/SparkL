"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  BookOpen, FileText, ArrowLeft, Plus, Check, Loader2,
  Clock, Upload, Sparkles, ChevronRight, Trophy, Target,
  RotateCcw, ChevronDown, ExternalLink, Zap,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Question {
  id: string;
  title: string;
  year: string | null;
  created_at: string;
  ai_processed: boolean;
}

interface ProcessedQuestion {
  id: string;
  question_number: number | null;
  question_text: string;
  question_type: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  correct_answer: string | null;
  explanation: string | null;
  topic_tag: string | null;
}

interface CourseDetail {
  course: { id: string; name: string; department: { id: string; name: string } | null };
  question_count: number;
  questions: Question[];
  is_selected: boolean;
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function fetchCourseDetail(
  courseId: string,
  supabase: ReturnType<typeof createClient>,
  router: ReturnType<typeof useRouter>
): Promise<CourseDetail> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { router.push("/auth/login"); throw new Error("No session"); }
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/courses/${courseId}`,
    { headers: { Authorization: `Bearer ${session.access_token}` } }
  );
  if (!res.ok) throw new Error("Failed to load course.");
  return res.json();
}

async function fetchProcessedQuestions(
  paperId: string,
  token: string
): Promise<ProcessedQuestion[]> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/questions/${paperId}/processed-questions`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error("Failed to load practice questions.");
  return res.json();
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="px-5 py-6 lg:px-8 lg:py-8">
      <div className="sp-bone h-4 w-24 mb-8 rounded-md" />
      <div className="rounded-2xl border p-6 mb-5 space-y-4" style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
        <div className="flex items-center gap-4">
          <div className="sp-bone h-12 w-12 rounded-xl shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="sp-bone h-5 w-48 rounded-md" />
            <div className="sp-bone h-3.5 w-32 rounded-md" />
          </div>
          <div className="sp-bone h-8 w-28 rounded-full shrink-0" />
        </div>
        <div className="flex gap-4 pt-2">
          <div className="sp-bone h-3 w-20 rounded-md" />
          <div className="sp-bone h-3 w-20 rounded-md" />
        </div>
      </div>
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border p-4 flex items-center gap-3" style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
            <div className="sp-bone h-9 w-9 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="sp-bone h-3.5 w-2/3 rounded-md" />
              <div className="sp-bone h-3 w-1/3 rounded-md" />
            </div>
            <div className="sp-bone h-7 w-20 rounded-lg shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Practice mode ─────────────────────────────────────────────────────────────

function PracticeMode({
  paper, token, onExit,
}: {
  paper: Question; token: string; onExit: () => void;
}) {
  const [pqs, setPqs]           = useState<ProcessedQuestion[]>([]);
  const [loadingPqs, setLoadingPqs] = useState(true);
  const [loadError, setLoadError]   = useState("");
  const [current, setCurrent]   = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore]       = useState(0);
  const [finished, setFinished] = useState(false);
  const [answers, setAnswers]   = useState<(string | null)[]>([]);

  useState(() => {
    fetchProcessedQuestions(paper.id, token)
      .then((data) => { setPqs(data); setAnswers(new Array(data.length).fill(null)); })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoadingPqs(false));
  });

  function handleSelect(opt: string) { if (!revealed) setSelected(opt); }

  function handleReveal() {
    if (!selected) return;
    setRevealed(true);
    if (pqs[current].correct_answer?.toLowerCase() === selected.toLowerCase())
      setScore((s) => s + 1);
    const next = [...answers];
    next[current] = selected;
    setAnswers(next);
  }

  function handleNext() {
    if (current + 1 >= pqs.length) setFinished(true);
    else { setCurrent((c) => c + 1); setSelected(null); setRevealed(false); }
  }

  function handleRestart() {
    setCurrent(0); setSelected(null); setRevealed(false);
    setScore(0); setFinished(false);
    setAnswers(new Array(pqs.length).fill(null));
  }

  const opts = ["a", "b", "c", "d"] as const;
  const pct  = pqs.length > 0 ? Math.round((score / pqs.length) * 100) : 0;

  return (
    <div className="px-5 py-6 lg:px-8 lg:py-8 max-w-2xl mx-auto">
      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 text-sm font-medium transition-colors"
          style={{ color: "var(--sp-text-3)" }}
        >
          <ArrowLeft className="h-4 w-4" /> Back to papers
        </button>
        {!finished && !loadingPqs && pqs.length > 0 && (
          <span className="text-xs font-semibold" style={{ color: "var(--sp-text-3)" }}>
            {current + 1} / {pqs.length}
          </span>
        )}
      </div>

      {/* Paper title */}
      <div className="mb-6 rounded-xl border px-4 py-3 flex items-center gap-3"
        style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-500">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold" style={{ color: "var(--sp-text)" }}>{paper.title}</p>
          {paper.year && <p className="text-xs" style={{ color: "var(--sp-text-3)" }}>{paper.year}</p>}
        </div>
      </div>

      {/* Loading */}
      {loadingPqs && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
          <p className="text-xs" style={{ color: "var(--sp-text-3)" }}>Loading practice questions…</p>
        </div>
      )}

      {/* Error */}
      {loadError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
          <p className="text-sm text-red-500">{loadError}</p>
        </div>
      )}

      {/* No questions */}
      {!loadingPqs && !loadError && pqs.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center gap-3">
          <div className="h-12 w-12 rounded-full bg-violet-500/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-violet-500" />
          </div>
          <p className="text-sm font-semibold" style={{ color: "var(--sp-text-2)" }}>No practice questions yet</p>
          <p className="text-xs max-w-xs" style={{ color: "var(--sp-text-3)" }}>
            This paper hasn't been processed by AI yet. Check back later.
          </p>
        </div>
      )}

      {/* Finished screen */}
      {finished && (
        <div className="flex flex-col items-center py-10 text-center gap-4">
          <div className={`flex h-20 w-20 items-center justify-center rounded-full border-4 ${
            pct >= 70
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
              : pct >= 40
              ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-500"
              : "border-red-500/40 bg-red-500/10 text-red-500"
          }`}>
            <Trophy className="h-8 w-8" />
          </div>
          <div>
            <p className="text-3xl font-extrabold" style={{ color: "var(--sp-text)" }}>{pct}%</p>
            <p className="text-sm mt-1" style={{ color: "var(--sp-text-3)" }}>{score} of {pqs.length} correct</p>
          </div>
          <p className="text-sm max-w-xs" style={{ color: "var(--sp-text-2)" }}>
            {pct >= 70
              ? "Great work! You're solid on this paper."
              : pct >= 40
              ? "Not bad — a second pass will help cement it."
              : "Keep at it. Reviewing the explanations helps most."}
          </p>

          {/* Per-question review */}
          <div className="w-full mt-4 space-y-2 text-left">
            {pqs.map((pq, i) => {
              const userAns = answers[i];
              const correct = pq.correct_answer?.toLowerCase() === userAns?.toLowerCase();
              return (
                <div key={pq.id} className={`rounded-xl border px-4 py-3 ${
                  correct ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"
                }`}>
                  <p className="text-xs font-semibold mb-1" style={{ color: "var(--sp-text-3)" }}>
                    Q{pq.question_number ?? i + 1}
                  </p>
                  <p className="text-sm leading-6" style={{ color: "var(--sp-text)" }}>{pq.question_text}</p>
                  <p className={`mt-1.5 text-xs font-semibold ${correct ? "text-emerald-500" : "text-red-500"}`}>
                    {correct
                      ? `Correct — ${pq.correct_answer?.toUpperCase()}`
                      : `You chose ${userAns?.toUpperCase() ?? "nothing"} · Answer: ${pq.correct_answer?.toUpperCase()}`}
                  </p>
                  {pq.explanation && (
                    <p className="mt-1.5 text-xs leading-5" style={{ color: "var(--sp-text-3)" }}>{pq.explanation}</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex gap-2 mt-2">
            <button
              onClick={handleRestart}
              className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors"
              style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-2)", background: "var(--sp-bg-card)" }}
            >
              <RotateCcw className="h-4 w-4" /> Try again
            </button>
            <button
              onClick={onExit}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
            >
              Back to papers
            </button>
          </div>
        </div>
      )}

      {/* Question card */}
      {!loadingPqs && !loadError && !finished && pqs.length > 0 && (
        <div>
          {/* Progress bar */}
          <div className="mb-5 h-1 w-full rounded-full" style={{ background: "var(--sp-ring-track)" }}>
            <div
              className="h-1 rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: `${(current / pqs.length) * 100}%` }}
            />
          </div>

          <div className="rounded-2xl border p-5" style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
            {/* Question meta */}
            <div className="mb-4 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-violet-500">
                Q{pqs[current].question_number ?? current + 1}
              </span>
              <div className="flex items-center gap-2">
                {pqs[current].topic_tag && (
                  <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-500">
                    {pqs[current].topic_tag}
                  </span>
                )}
                <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize"
                  style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)", background: "var(--sp-bg-muted)" }}>
                  {pqs[current].question_type}
                </span>
              </div>
            </div>

            {/* Question text */}
            <p className="text-base font-medium leading-7 mb-5" style={{ color: "var(--sp-text)" }}>
              {pqs[current].question_text}
            </p>

            {/* Options */}
            {pqs[current].option_a ? (
              <div className="space-y-2.5">
                {opts.map((opt) => {
                  const val = pqs[current][`option_${opt}` as keyof ProcessedQuestion] as string | null;
                  if (!val) return null;
                  const isSelected  = selected === opt;
                  const isCorrect   = pqs[current].correct_answer?.toLowerCase() === opt;
                  const isWrong     = revealed && isSelected && !isCorrect;
                  const showCorrect = revealed && isCorrect;

                  return (
                    <button
                      key={opt}
                      onClick={() => handleSelect(opt)}
                      disabled={revealed}
                      className={`w-full flex items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all disabled:cursor-default
                        ${showCorrect
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                          : isWrong
                          ? "border-red-500/40 bg-red-500/10 text-red-600"
                          : isSelected
                          ? "border-blue-500/50 bg-blue-500/10 text-blue-600"
                          : ""
                        }`}
                      style={!showCorrect && !isWrong && !isSelected ? {
                        borderColor: "var(--sp-border)",
                        background: "var(--sp-bg-muted)",
                        color: "var(--sp-text-2)",
                      } : {}}
                    >
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-black uppercase
                        ${showCorrect
                          ? "bg-emerald-500/20 text-emerald-600"
                          : isWrong
                          ? "bg-red-500/20 text-red-600"
                          : isSelected
                          ? "bg-blue-500/20 text-blue-600"
                          : ""
                        }`}
                        style={!showCorrect && !isWrong && !isSelected ? {
                          background: "var(--sp-bone)",
                          color: "var(--sp-text-3)",
                        } : {}}
                      >
                        {opt}
                      </span>
                      <span className="leading-6">{val}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className={`rounded-xl border px-4 py-3 text-sm transition-all ${
                revealed ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-600" : ""
              }`}
                style={!revealed ? { borderColor: "var(--sp-border)", background: "var(--sp-bg-muted)", color: "var(--sp-text-3)" } : {}}
              >
                {revealed
                  ? pqs[current].correct_answer ?? "No answer provided."
                  : <span className="italic">Select "Reveal" to see the answer.</span>
                }
              </div>
            )}

            {/* Explanation */}
            {revealed && pqs[current].explanation && (
              <div className="mt-4 rounded-xl border px-4 py-3"
                style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-muted)" }}>
                <p className="text-xs font-semibold mb-1" style={{ color: "var(--sp-text-3)" }}>Explanation</p>
                <p className="text-sm leading-6" style={{ color: "var(--sp-text-2)" }}>{pqs[current].explanation}</p>
              </div>
            )}

            {/* Action row */}
            <div className="mt-5 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--sp-text-3)" }}>
                <Target className="h-3.5 w-3.5" />
                {score} correct so far
              </div>
              {!revealed ? (
                <button
                  onClick={handleReveal}
                  disabled={!selected && !!pqs[current].option_a}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {pqs[current].option_a ? "Check answer" : "Reveal"}
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
                >
                  {current + 1 >= pqs.length ? "See results" : "Next"}
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CourseDetailPage() {
  const supabase     = createClient();
  const router       = useRouter();
  const params       = useParams();
  const queryClient  = useQueryClient();
  const courseId     = params?.id as string;

  const [toggling, setToggling]             = useState(false);
  const [practiceTarget, setPracticeTarget] = useState<Question | null>(null);
  const [token, setToken]                   = useState<string | null>(null);
  const [expandedPaperId, setExpandedPaperId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["course", courseId],
    queryFn:  () => fetchCourseDetail(courseId, supabase, router),
    enabled:  !!courseId,
  });

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  async function startPractice(paper: Question) {
    const t = await getToken();
    if (!t) return;
    setToken(t);
    setPracticeTarget(paper);
  }

  async function toggleSelected() {
    if (!data) return;
    setToggling(true);
    const nextSelected = !data.is_selected;
    queryClient.setQueryData(["course", courseId], { ...data, is_selected: nextSelected });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (data.is_selected) {
        await supabase.from("user_courses").delete().eq("user_id", user.id).eq("course_id", courseId);
      } else {
        await supabase.from("user_courses").insert({ user_id: user.id, course_id: courseId });
      }
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    } catch {
      queryClient.setQueryData(["course", courseId], data);
    } finally {
      setToggling(false);
    }
  }

  if (practiceTarget && token) {
    return (
      <PracticeMode
        paper={practiceTarget}
        token={token}
        onExit={() => { setPracticeTarget(null); setToken(null); }}
      />
    );
  }

  if (isLoading) return <PageSkeleton />;

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
          <FileText className="h-5 w-5 text-red-500" />
        </div>
        <p className="text-sm" style={{ color: "var(--sp-text-3)" }}>
          {error instanceof Error ? error.message : "Course not found."}
        </p>
        <Link href="/dashboard/courses"
          className="text-sm font-semibold text-blue-500 hover:text-blue-400 transition-colors">
          Back to courses
        </Link>
      </div>
    );
  }

  const { course, question_count, questions, is_selected } = data;
  const processedCount = questions.filter((q) => q.ai_processed).length;

  return (
    <div className="px-5 py-6 lg:px-8 lg:py-8" style={{ background: "var(--sp-bg)", minHeight: "100vh" }}>
      <div className="mx-auto max-w-3xl">

        {/* Back */}
        <Link
          href="/dashboard/courses"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
          style={{ color: "var(--sp-text-3)" }}
        >
          <ArrowLeft className="h-4 w-4" /> Courses
        </Link>

        {/* Course header card */}
        <div className="mb-5 rounded-2xl border p-5"
          style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-500">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-extrabold leading-tight" style={{ color: "var(--sp-text)" }}>
                  {course.name}
                </h1>
                {course.department && (
                  <p className="mt-0.5 text-sm" style={{ color: "var(--sp-text-3)" }}>
                    {course.department.name}
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={toggleSelected}
              disabled={toggling}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all disabled:opacity-60
                ${is_selected
                  ? "border border-blue-500/30 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20"
                  : "bg-blue-600 text-white hover:bg-blue-500"
                }`}
            >
              {toggling
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : is_selected
                ? <Check className="h-3.5 w-3.5" />
                : <Plus className="h-3.5 w-3.5" />
              }
              {is_selected ? "In my courses" : "Add to my courses"}
            </button>
          </div>

          {/* Stats row */}
          <div className="mt-5 flex items-center gap-5 border-t pt-4" style={{ borderColor: "var(--sp-border)" }}>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--sp-text-3)" }}>
              <FileText className="h-3.5 w-3.5" />
              {question_count} paper{question_count !== 1 ? "s" : ""}
            </div>
            {processedCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-violet-500">
                <Sparkles className="h-3.5 w-3.5" />
                {processedCount} ready to practice
              </div>
            )}
          </div>
        </div>

        {/* Papers list */}
        <div>
          <h2 className="mb-3 text-sm font-bold" style={{ color: "var(--sp-text)" }}>Past papers</h2>

          {questions.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-12 text-center gap-3"
              style={{ borderColor: "var(--sp-border)" }}>
              <div className="h-11 w-11 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                <FileText className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold" style={{ color: "var(--sp-text-2)" }}>No papers yet</p>
              <p className="text-xs max-w-xs" style={{ color: "var(--sp-text-3)" }}>
                Be the first to upload a past question for this course.
              </p>
              <Link
                href="/dashboard/upload"
                className="mt-2 flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
              >
                <Upload className="h-3.5 w-3.5" /> Upload a paper
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {questions.map((q) => (
                <div
                  key={q.id}
                  className="rounded-xl border overflow-hidden"
                  style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
                >
                  {/* Paper row */}
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg
                      ${q.ai_processed ? "bg-violet-500/15 text-violet-500" : "bg-blue-500/10 text-blue-400"}`}>
                      {q.ai_processed ? <Sparkles className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold" style={{ color: "var(--sp-text)" }}>
                        {q.title}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2">
                        {q.year && (
                          <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--sp-text-3)" }}>
                            <Clock className="h-2.5 w-2.5" />{q.year}
                          </span>
                        )}
                        {q.ai_processed && (
                          <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-violet-500">
                            Practice ready
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {q.ai_processed && (
                        <button
                          onClick={() => startPractice(q)}
                          className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 transition-colors"
                        >
                          <Zap className="h-3 w-3" fill="white" /> Practice
                        </button>
                      )}
                      <button
                        onClick={() => setExpandedPaperId(expandedPaperId === q.id ? null : q.id)}
                        className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
                        style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)", background: "var(--sp-bg-muted)" }}
                      >
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expandedPaperId === q.id ? "rotate-180" : ""}`} />
                        View
                      </button>
                    </div>
                  </div>

                  {/* Expanded */}
                  {expandedPaperId === q.id && (
                    <div className="border-t px-4 py-3 flex items-center justify-between gap-3"
                      style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-muted)" }}>
                      <p className="text-xs" style={{ color: "var(--sp-text-3)" }}>
                        Uploaded {new Date(q.created_at).toLocaleDateString("en-GB", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </p>
                      <Link
                        href={`/questions/${q.id}`}
                        className="flex items-center gap-1 text-xs font-semibold text-blue-500 hover:text-blue-400 transition-colors"
                      >
                        Open full paper <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  )}
                </div>
              ))}

              {/* Upload CTA */}
              <Link
                href="/dashboard/upload"
                className="flex items-center justify-center gap-2 rounded-xl border border-dashed py-3 text-xs font-medium transition-all hover:text-blue-500"
                style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)" }}
              >
                <Upload className="h-3.5 w-3.5" /> Upload another paper
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
