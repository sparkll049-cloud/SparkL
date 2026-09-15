// frontend/src/app/dashboard/courses/[id]/page.tsx
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

function Shimmer({ className }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-md bg-white/[0.05] ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="px-5 py-6 lg:px-8 lg:py-8">
      <style>{`@keyframes shimmer { to { transform: translateX(250%); } }`}</style>
      <Shimmer className="h-4 w-24 mb-8" />
      <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-6 mb-5 space-y-4">
        <div className="flex items-center gap-4">
          <Shimmer className="h-12 w-12 rounded-xl shrink-0" />
          <div className="space-y-2 flex-1">
            <Shimmer className="h-5 w-48" />
            <Shimmer className="h-3.5 w-32" />
          </div>
          <Shimmer className="h-8 w-28 rounded-full shrink-0" />
        </div>
        <div className="flex gap-4 pt-2">
          <Shimmer className="h-3 w-20" />
          <Shimmer className="h-3 w-20" />
        </div>
      </div>
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 flex items-center gap-3">
            <Shimmer className="h-9 w-9 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <Shimmer className="h-3.5 w-2/3" />
              <Shimmer className="h-3 w-1/3" />
            </div>
            <Shimmer className="h-7 w-20 rounded-lg shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Practice mode ─────────────────────────────────────────────────────────────

function PracticeMode({
  paper,
  token,
  onExit,
}: {
  paper: Question;
  token: string;
  onExit: () => void;
}) {
  const [pqs, setPqs] = useState<ProcessedQuestion[]>([]);
  const [loadingPqs, setLoadingPqs] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [answers, setAnswers] = useState<(string | null)[]>([]);

  useState(() => {
    fetchProcessedQuestions(paper.id, token)
      .then((data) => { setPqs(data); setAnswers(new Array(data.length).fill(null)); })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoadingPqs(false));
  });

  function handleSelect(opt: string) {
    if (revealed) return;
    setSelected(opt);
  }

  function handleReveal() {
    if (!selected) return;
    setRevealed(true);
    const correct = pqs[current].correct_answer?.toLowerCase() === selected.toLowerCase();
    if (correct) setScore((s) => s + 1);
    const next = [...answers];
    next[current] = selected;
    setAnswers(next);
  }

  function handleNext() {
    if (current + 1 >= pqs.length) {
      setFinished(true);
    } else {
      setCurrent((c) => c + 1);
      setSelected(null);
      setRevealed(false);
    }
  }

  function handleRestart() {
    setCurrent(0);
    setSelected(null);
    setRevealed(false);
    setScore(0);
    setFinished(false);
    setAnswers(new Array(pqs.length).fill(null));
  }

  const opts = ["a", "b", "c", "d"] as const;
  const pct = pqs.length > 0 ? Math.round((score / pqs.length) * 100) : 0;

  return (
    <div className="px-5 py-6 lg:px-8 lg:py-8 max-w-2xl mx-auto">
      <style>{`@keyframes shimmer { to { transform: translateX(250%); } }`}</style>

      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to papers
        </button>
        {!finished && !loadingPqs && pqs.length > 0 && (
          <span className="text-xs font-semibold text-slate-500">
            {current + 1} / {pqs.length}
          </span>
        )}
      </div>

      {/* Paper title */}
      <div className="mb-6 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3 flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-200">{paper.title}</p>
          {paper.year && <p className="text-xs text-slate-600">{paper.year}</p>}
        </div>
      </div>

      {/* Loading */}
      {loadingPqs && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
          <p className="text-xs text-slate-600">Loading practice questions…</p>
        </div>
      )}

      {/* Error */}
      {loadError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
          <p className="text-sm text-red-400">{loadError}</p>
        </div>
      )}

      {/* No questions */}
      {!loadingPqs && !loadError && pqs.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center gap-3">
          <div className="h-12 w-12 rounded-full bg-violet-500/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-violet-400" />
          </div>
          <p className="text-sm font-semibold text-slate-400">No practice questions yet</p>
          <p className="text-xs text-slate-600 max-w-xs">
            This paper hasn't been processed by AI yet. Check back later.
          </p>
        </div>
      )}

      {/* Finished screen */}
      {finished && (
        <div className="flex flex-col items-center py-10 text-center gap-4">
          <div className={`flex h-20 w-20 items-center justify-center rounded-full border-4 ${
            pct >= 70
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
              : pct >= 40
              ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
              : "border-red-500/40 bg-red-500/10 text-red-400"
          }`}>
            <Trophy className="h-8 w-8" />
          </div>

          <div>
            <p className="text-3xl font-extrabold text-white">{pct}%</p>
            <p className="text-sm text-slate-500 mt-1">
              {score} of {pqs.length} correct
            </p>
          </div>

          <p className="text-sm text-slate-400 max-w-xs">
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
                <div
                  key={pq.id}
                  className={`rounded-xl border px-4 py-3 ${
                    correct
                      ? "border-emerald-500/20 bg-emerald-500/5"
                      : "border-red-500/20 bg-red-500/5"
                  }`}
                >
                  <p className="text-xs font-semibold text-slate-400 mb-1">
                    Q{pq.question_number ?? i + 1}
                  </p>
                  <p className="text-sm text-slate-300 leading-6">{pq.question_text}</p>
                  <p className={`mt-1.5 text-xs font-semibold ${correct ? "text-emerald-400" : "text-red-400"}`}>
                    {correct
                      ? `Correct — ${pq.correct_answer?.toUpperCase()}`
                      : `You chose ${userAns?.toUpperCase() ?? "nothing"} · Answer: ${pq.correct_answer?.toUpperCase()}`}
                  </p>
                  {pq.explanation && (
                    <p className="mt-1.5 text-xs text-slate-600 leading-5">{pq.explanation}</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex gap-2 mt-2">
            <button
              onClick={handleRestart}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/[0.08] transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Try again
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
          <div className="mb-5 h-1 w-full rounded-full bg-white/[0.06]">
            <div
              className="h-1 rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: `${((current) / pqs.length) * 100}%` }}
            />
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            {/* Question meta */}
            <div className="mb-4 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-violet-400">
                Q{pqs[current].question_number ?? current + 1}
              </span>
              <div className="flex items-center gap-2">
                {pqs[current].topic_tag && (
                  <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">
                    {pqs[current].topic_tag}
                  </span>
                )}
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-slate-500 capitalize">
                  {pqs[current].question_type}
                </span>
              </div>
            </div>

            {/* Question text */}
            <p className="text-base font-medium text-slate-100 leading-7 mb-5">
              {pqs[current].question_text}
            </p>

            {/* Options */}
            {pqs[current].option_a ? (
              <div className="space-y-2.5">
                {opts.map((opt) => {
                  const val = pqs[current][`option_${opt}` as keyof ProcessedQuestion] as string | null;
                  if (!val) return null;

                  const isSelected = selected === opt;
                  const isCorrect = pqs[current].correct_answer?.toLowerCase() === opt;
                  const isWrong = revealed && isSelected && !isCorrect;
                  const showCorrect = revealed && isCorrect;

                  return (
                    <button
                      key={opt}
                      onClick={() => handleSelect(opt)}
                      disabled={revealed}
                      className={`w-full flex items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all
                        ${showCorrect
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                          : isWrong
                          ? "border-red-500/40 bg-red-500/10 text-red-300"
                          : isSelected
                          ? "border-blue-500/50 bg-blue-500/10 text-slate-200"
                          : "border-white/[0.06] bg-white/[0.02] text-slate-400 hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-slate-200"
                        } disabled:cursor-default`}
                    >
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-black uppercase
                        ${showCorrect
                          ? "bg-emerald-500/20 text-emerald-400"
                          : isWrong
                          ? "bg-red-500/20 text-red-400"
                          : isSelected
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-white/[0.06] text-slate-500"
                        }`}
                      >
                        {opt}
                      </span>
                      <span className="leading-6">{val}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              /* Theory question — just show answer on reveal */
              <div className={`rounded-xl border px-4 py-3 text-sm text-slate-400 transition-all ${
                revealed ? "border-emerald-500/20 bg-emerald-500/5" : "border-white/[0.06] bg-white/[0.02]"
              }`}>
                {revealed
                  ? <p className="text-emerald-300">{pqs[current].correct_answer ?? "No answer provided."}</p>
                  : <p className="text-slate-600 italic">Select "Reveal" to see the answer.</p>
                }
              </div>
            )}

            {/* Explanation */}
            {revealed && pqs[current].explanation && (
              <div className="mt-4 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3">
                <p className="text-xs font-semibold text-slate-500 mb-1">Explanation</p>
                <p className="text-sm text-slate-400 leading-6">{pqs[current].explanation}</p>
              </div>
            )}

            {/* Action row */}
            <div className="mt-5 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
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
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const courseId = params?.id as string;

  const [toggling, setToggling] = useState(false);
  const [practiceTarget, setPracticeTarget] = useState<Question | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [expandedPaperId, setExpandedPaperId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => fetchCourseDetail(courseId, supabase, router),
    enabled: !!courseId,
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
        await supabase.from("user_courses").delete()
          .eq("user_id", user.id).eq("course_id", courseId);
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

  // Practice mode takes over the page
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
          <FileText className="h-5 w-5 text-red-400" />
        </div>
        <p className="text-sm text-slate-500">
          {error instanceof Error ? error.message : "Course not found."}
        </p>
        <Link href="/dashboard/courses" className="text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors">
          Back to courses
        </Link>
      </div>
    );
  }

  const { course, question_count, questions, is_selected } = data;
  const processedCount = questions.filter((q) => q.ai_processed).length;

  return (
    <div className="px-5 py-6 lg:px-8 lg:py-8">
      <style>{`@keyframes shimmer { to { transform: translateX(250%); } }`}</style>
      <div className="mx-auto max-w-3xl">

        {/* Back */}
        <Link
          href="/dashboard/courses"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Courses
        </Link>

        {/* Course header card */}
        <div className="mb-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-extrabold text-white leading-tight">{course.name}</h1>
                {course.department && (
                  <p className="mt-0.5 text-sm text-slate-500">{course.department.name}</p>
                )}
              </div>
            </div>

            <button
              onClick={toggleSelected}
              disabled={toggling}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all disabled:opacity-60
                ${is_selected
                  ? "border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
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
          <div className="mt-5 flex items-center gap-5 border-t border-white/[0.05] pt-4">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <FileText className="h-3.5 w-3.5" />
              {question_count} paper{question_count !== 1 ? "s" : ""}
            </div>
            {processedCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-violet-400">
                <Sparkles className="h-3.5 w-3.5" />
                {processedCount} ready to practice
              </div>
            )}
          </div>
        </div>

        {/* Papers list */}
        <div>
          <h2 className="mb-3 text-sm font-bold text-white">Past papers</h2>

          {questions.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed border-white/[0.07] px-6 py-12 text-center gap-3">
              <div className="h-11 w-11 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                <FileText className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-slate-400">No papers yet</p>
              <p className="text-xs text-slate-600 max-w-xs">
                Be the first to upload a past question for this course.
              </p>
              <Link
                href="/dashboard/upload"
                className="mt-2 flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload a paper
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {questions.map((q) => (
                <div
                  key={q.id}
                  className="rounded-xl border border-white/[0.05] bg-white/[0.02] overflow-hidden"
                >
                  {/* Paper row */}
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg
                      ${q.ai_processed ? "bg-violet-500/15 text-violet-400" : "bg-white/[0.05] text-slate-600"}`}
                    >
                      {q.ai_processed ? <Sparkles className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-200">{q.title}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        {q.year && (
                          <span className="flex items-center gap-1 text-[10px] text-slate-600">
                            <Clock className="h-2.5 w-2.5" />{q.year}
                          </span>
                        )}
                        {q.ai_processed && (
                          <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-violet-400">
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
                          <Zap className="h-3 w-3" fill="white" />
                          Practice
                        </button>
                      )}
                      <button
                        onClick={() => setExpandedPaperId(expandedPaperId === q.id ? null : q.id)}
                        className="flex items-center gap-1 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-white/[0.07] hover:text-slate-300 transition-colors"
                      >
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expandedPaperId === q.id ? "rotate-180" : ""}`} />
                        View
                      </button>
                    </div>
                  </div>

                  {/* Expanded: link to full question page */}
                  {expandedPaperId === q.id && (
                    <div className="border-t border-white/[0.04] px-4 py-3 bg-white/[0.01] flex items-center justify-between gap-3">
                      <p className="text-xs text-slate-600">
                        Uploaded {new Date(q.created_at).toLocaleDateString("en-GB", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </p>
                      <Link
                        href={`/questions/${q.id}`}
                        className="flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        Open full paper
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  )}
                </div>
              ))}

              {/* Upload CTA at bottom */}
              <Link
                href="/dashboard/upload"
                className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.07] py-3 text-xs font-medium text-slate-600 hover:border-blue-500/20 hover:text-blue-400 transition-all"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload another paper
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}