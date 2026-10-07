"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  BookOpen, FileText, ArrowLeft, Plus, Check, Loader2, Clock, Upload,
  Sparkles, ChevronRight, Trophy, Target, RotateCcw, ChevronDown,
  ExternalLink, Zap,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Question {
  id: string; title: string; year: string | null; created_at: string; ai_processed: boolean;
}
interface ProcessedQuestion {
  id: string; question_number: number | null; question_text: string; question_type: string;
  option_a: string | null; option_b: string | null; option_c: string | null; option_d: string | null;
  correct_answer: string | null; explanation: string | null; topic_tag: string | null;
}
interface CourseDetail {
  course: { id: string; name: string; department: { id: string; name: string } | null };
  question_count: number;
  questions: Question[];
  is_selected: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function splitCourseName(name: string): { code: string | null; title: string } {
  const m = name.match(/^\s*([A-Za-z]{2,5})\s?-?\s?(\d{2,4}[A-Za-z]?)\s*[-:–—]?\s*(.*)$/);
  if (!m) return { code: null, title: name };
  return { code: `${m[1].toUpperCase()} ${m[2]}`, title: m[3].trim() || name };
}

async function fetchCourseDetail(
  courseId: string,
  supabase: ReturnType<typeof createClient>,
  router: ReturnType<typeof useRouter>,
): Promise<CourseDetail> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { router.push("/auth/login"); throw new Error("No session"); }
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/courses/${courseId}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!res.ok) throw new Error("Failed to load course.");
  return res.json();
}

async function fetchProcessedQuestions(paperId: string, token: string): Promise<ProcessedQuestion[]> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/questions/${paperId}/processed-questions`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error("Failed to load practice questions.");
  return res.json();
}

function PageSkeleton() {
  return (
    <div className="px-5 py-6 lg:px-8 lg:py-8">
      <div className="sp-bone mb-8 h-4 w-24 rounded-md" />
      <div className="mb-5 space-y-4 rounded-2xl border p-6" style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
        <div className="flex items-center gap-4">
          <div className="sp-bone h-12 w-12 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="sp-bone h-5 w-48 rounded-md" />
            <div className="sp-bone h-3.5 w-32 rounded-md" />
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => <div key={i} className="sp-bone h-16 rounded-xl" />)}
      </div>
    </div>
  );
}

// ── Practice mode ─────────────────────────────────────────────────────────────

function PracticeMode({ paper, token, onExit }: { paper: Question; token: string; onExit: () => void }) {
  const [pqs, setPqs]         = useState<ProcessedQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<(string | null)[]>([]);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchProcessedQuestions(paper.id, token)
      .then(d => { if (alive) { setPqs(d); setAnswers(new Array(d.length).fill(null)); } })
      .catch(e => alive && setLoadError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [paper.id, token]);

  const isMcq = (pq: ProcessedQuestion) => !!pq.option_a;
  const isRight = (pq: ProcessedQuestion, ans: string | null) =>
    !!ans && pq.correct_answer?.toLowerCase() === ans.toLowerCase();

  // Score is derived from answers, so restart / review can never drift out of sync.
  const score = useMemo(
    () => pqs.reduce((s, pq, i) => s + (isMcq(pq) && isRight(pq, answers[i]) ? 1 : 0), 0),
    [pqs, answers],
  );
  const scorable = pqs.filter(isMcq).length;
  const pct = scorable > 0 ? Math.round((score / scorable) * 100) : 0;

  function reveal() {
    const pq = pqs[current];
    if (isMcq(pq) && !selected) return;
    setRevealed(true);
    if (isMcq(pq)) setAnswers(a => a.map((v, i) => (i === current ? selected : v)));
  }
  function next() {
    if (current + 1 >= pqs.length) setFinished(true);
    else { setCurrent(c => c + 1); setSelected(null); setRevealed(false); }
  }
  function restart() {
    setCurrent(0); setSelected(null); setRevealed(false); setFinished(false);
    setAnswers(new Array(pqs.length).fill(null));
  }

  const pq = pqs[current];
  const opts = ["a", "b", "c", "d"] as const;
  const card = { background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" };

  return (
    <div className="mx-auto max-w-2xl px-5 py-6 lg:px-8 lg:py-8">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={onExit} className="flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--sp-text-3)" }}>
          <ArrowLeft className="h-4 w-4" /> Back to papers
        </button>
        {!finished && !loading && pqs.length > 0 && (
          <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--sp-text-3)" }}>
            {current + 1} / {pqs.length}
          </span>
        )}
      </div>

      <div className="mb-5 flex items-center gap-3 rounded-xl border px-4 py-3" style={card}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-500">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold" style={{ color: "var(--sp-text)" }}>{paper.title}</p>
          {paper.year && <p className="text-xs" style={{ color: "var(--sp-text-3)" }}>{paper.year}</p>}
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center gap-3 py-20">
          <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
          <p className="text-xs" style={{ color: "var(--sp-text-3)" }}>Loading practice questions…</p>
        </div>
      )}

      {loadError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
          <p className="text-sm text-red-500">{loadError}</p>
        </div>
      )}

      {!loading && !loadError && pqs.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/10">
            <Sparkles className="h-5 w-5 text-violet-500" />
          </div>
          <p className="text-sm font-semibold" style={{ color: "var(--sp-text-2)" }}>No practice questions yet</p>
          <p className="max-w-xs text-xs" style={{ color: "var(--sp-text-3)" }}>
            This paper is still being processed. Check back later.
          </p>
        </div>
      )}

      {finished && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <div className={`flex h-20 w-20 items-center justify-center rounded-full border-4 ${
            pct >= 70 ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
            : pct >= 40 ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-500"
            : "border-red-500/40 bg-red-500/10 text-red-500"}`}>
            <Trophy className="h-8 w-8" />
          </div>
          <div>
            <p className="text-3xl font-extrabold" style={{ color: "var(--sp-text)" }}>{pct}%</p>
            <p className="mt-1 text-sm" style={{ color: "var(--sp-text-3)" }}>{score} of {scorable} correct</p>
          </div>
          <p className="max-w-xs text-sm" style={{ color: "var(--sp-text-2)" }}>
            {pct >= 70 ? "Strong result. You know this paper well."
              : pct >= 40 ? "Decent start. Go through the explanations and try again."
              : "Read the explanations below, then retry. That is where most of the gain is."}
          </p>

          <div className="mt-2 w-full space-y-2 text-left">
            {pqs.map((q, i) => {
              const mcq = isMcq(q);
              const ok = mcq && isRight(q, answers[i]);
              const tone = !mcq ? "" : ok ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5";
              return (
                <div key={q.id} className={`rounded-xl border px-4 py-3 ${tone}`}
                  style={!mcq ? { borderColor: "var(--sp-border)", background: "var(--sp-bg-card)" } : undefined}>
                  <p className="mb-1 text-xs font-semibold" style={{ color: "var(--sp-text-3)" }}>Q{q.question_number ?? i + 1}</p>
                  <p className="text-sm leading-6" style={{ color: "var(--sp-text)" }}>{q.question_text}</p>
                  {mcq && (
                    <p className={`mt-1.5 text-xs font-semibold ${ok ? "text-emerald-500" : "text-red-500"}`}>
                      {ok ? `Correct: ${q.correct_answer?.toUpperCase()}`
                        : `You chose ${answers[i]?.toUpperCase() ?? "nothing"} · Answer: ${q.correct_answer?.toUpperCase()}`}
                    </p>
                  )}
                  {!mcq && q.correct_answer && (
                    <p className="mt-1.5 text-xs" style={{ color: "var(--sp-text-2)" }}>Answer: {q.correct_answer}</p>
                  )}
                  {q.explanation && (
                    <p className="mt-1.5 text-xs leading-5" style={{ color: "var(--sp-text-3)" }}>{q.explanation}</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-2 flex gap-2">
            <button onClick={restart} className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold"
              style={{ ...card, color: "var(--sp-text-2)" }}>
              <RotateCcw className="h-4 w-4" /> Try again
            </button>
            <button onClick={onExit} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500">
              Back to papers
            </button>
          </div>
        </div>
      )}

      {!loading && !loadError && !finished && pq && (
        <div>
          <div className="mb-5 h-1 w-full rounded-full" style={{ background: "var(--sp-ring-track)" }}>
            <div className="h-1 rounded-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${((current + (revealed ? 1 : 0)) / pqs.length) * 100}%` }} />
          </div>

          <div className="rounded-2xl border p-5" style={card}>
            <div className="mb-4 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-violet-500">Q{pq.question_number ?? current + 1}</span>
              <div className="flex items-center gap-2">
                {pq.topic_tag && (
                  <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-500">
                    {pq.topic_tag}
                  </span>
                )}
                <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize"
                  style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)", background: "var(--sp-bg-muted)" }}>
                  {pq.question_type}
                </span>
              </div>
            </div>

            <p className="mb-5 text-base font-medium leading-7" style={{ color: "var(--sp-text)" }}>{pq.question_text}</p>

            {isMcq(pq) ? (
              <div className="space-y-2.5">
                {opts.map(opt => {
                  const val = pq[`option_${opt}` as keyof ProcessedQuestion] as string | null;
                  if (!val) return null;
                  const isSel = selected === opt;
                  const isCorrect = pq.correct_answer?.toLowerCase() === opt;
                  const wrong = revealed && isSel && !isCorrect;
                  const right = revealed && isCorrect;
                  const plain = !right && !wrong && !isSel;
                  return (
                    <button key={opt} onClick={() => !revealed && setSelected(opt)} disabled={revealed}
                      aria-pressed={isSel}
                      className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all disabled:cursor-default ${
                        right ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                        : wrong ? "border-red-500/40 bg-red-500/10 text-red-600"
                        : isSel ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-600" : ""}`}
                      style={plain ? { borderColor: "var(--sp-border)", background: "var(--sp-bg-muted)", color: "var(--sp-text-2)" } : undefined}>
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-black uppercase ${
                        right ? "bg-emerald-500/20" : wrong ? "bg-red-500/20" : isSel ? "bg-indigo-500/20" : ""}`}
                        style={plain ? { background: "var(--sp-bone)", color: "var(--sp-text-3)" } : undefined}>
                        {opt}
                      </span>
                      <span className="leading-6">{val}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className={`rounded-xl border px-4 py-3 text-sm ${revealed ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-600" : ""}`}
                style={!revealed ? { borderColor: "var(--sp-border)", background: "var(--sp-bg-muted)", color: "var(--sp-text-3)" } : undefined}>
                {revealed ? pq.correct_answer ?? "No answer provided." : <span className="italic">Think it through, then tap Show answer.</span>}
              </div>
            )}

            {revealed && pq.explanation && (
              <div className="mt-4 rounded-xl border px-4 py-3" style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-muted)" }}>
                <p className="mb-1 text-xs font-semibold" style={{ color: "var(--sp-text-3)" }}>Explanation</p>
                <p className="text-sm leading-6" style={{ color: "var(--sp-text-2)" }}>{pq.explanation}</p>
              </div>
            )}

            <div className="mt-5 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--sp-text-3)" }}>
                <Target className="h-3.5 w-3.5" /> {score} correct so far
              </div>
              {!revealed ? (
                <button onClick={reveal} disabled={isMcq(pq) && !selected}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40">
                  {isMcq(pq) ? "Check answer" : "Show answer"}
                </button>
              ) : (
                <button onClick={next}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500">
                  {current + 1 >= pqs.length ? "See results" : "Next"} <ChevronRight className="h-4 w-4" />
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
  const supabase    = createClient();
  const router      = useRouter();
  const params      = useParams();
  const queryClient = useQueryClient();
  const courseId    = params?.id as string;

  const [toggling, setToggling] = useState(false);
  const [practiceTarget, setPracticeTarget] = useState<Question | null>(null);
  const [token, setToken]       = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [onlyPractice, setOnlyPractice] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => fetchCourseDetail(courseId, supabase, router),
    enabled: !!courseId,
  });

  async function startPractice(paper: Question) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push("/auth/login"); return; }
    setToken(session.access_token);
    setPracticeTarget(paper);
  }

  async function toggleSelected() {
    if (!data) return;
    const previous = data;
    setToggling(true);
    queryClient.setQueryData(["course", courseId], { ...data, is_selected: !data.is_selected });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");
      const { error: dbError } = data.is_selected
        ? await supabase.from("user_courses").delete().eq("user_id", user.id).eq("course_id", courseId)
        : await supabase.from("user_courses").insert({ user_id: user.id, course_id: courseId });
      if (dbError) throw dbError;
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    } catch {
      queryClient.setQueryData(["course", courseId], previous); // roll back the optimistic update
    } finally {
      setToggling(false);
    }
  }

  const papers = useMemo(() => {
    const list = [...(data?.questions ?? [])].sort((a, b) =>
      (Number(b.year) || 0) - (Number(a.year) || 0) ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return onlyPractice ? list.filter(q => q.ai_processed) : list;
  }, [data, onlyPractice]);

  if (practiceTarget && token) {
    return <PracticeMode paper={practiceTarget} token={token} onExit={() => { setPracticeTarget(null); setToken(null); }} />;
  }
  if (isLoading) return <PageSkeleton />;

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
          <FileText className="h-5 w-5 text-red-500" />
        </div>
        <p className="text-sm" style={{ color: "var(--sp-text-3)" }}>
          {error instanceof Error ? error.message : "Course not found."}
        </p>
        <Link href="/dashboard/courses" className="text-sm font-semibold text-indigo-500 hover:text-indigo-400">
          Back to courses
        </Link>
      </div>
    );
  }

  const { course, question_count, questions, is_selected } = data;
  const processedCount = questions.filter(q => q.ai_processed).length;
  const { code, title } = splitCourseName(course.name);

  return (
    <div className="px-5 py-6 lg:px-8 lg:py-8" style={{ background: "var(--sp-bg)", minHeight: "100vh" }}>
      <div className="mx-auto max-w-3xl">
        <Link href="/dashboard/courses" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium"
          style={{ color: "var(--sp-text-3)" }}>
          <ArrowLeft className="h-4 w-4" /> Courses
        </Link>

        <div className="mb-5 rounded-2xl border p-5" style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-500">
                <BookOpen className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                {code && <p className="text-[11px] font-black text-indigo-500">{code}</p>}
                <h1 className="text-lg font-extrabold leading-tight" style={{ color: "var(--sp-text)" }}>{title}</h1>
                {course.department && (
                  <p className="mt-0.5 text-sm" style={{ color: "var(--sp-text-3)" }}>{course.department.name}</p>
                )}
              </div>
            </div>
            <button onClick={toggleSelected} disabled={toggling}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all disabled:opacity-60 ${
                is_selected ? "border border-indigo-500/30 bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20"
                : "bg-indigo-600 text-white hover:bg-indigo-500"}`}>
              {toggling ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : is_selected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {is_selected ? "In my courses" : "Add to my courses"}
            </button>
          </div>

          <div className="mt-5 flex items-center gap-5 border-t pt-4" style={{ borderColor: "var(--sp-border)" }}>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--sp-text-3)" }}>
              <FileText className="h-3.5 w-3.5" /> {question_count} paper{question_count !== 1 ? "s" : ""}
            </div>
            {processedCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-violet-500">
                <Sparkles className="h-3.5 w-3.5" /> {processedCount} ready to practice
              </div>
            )}
          </div>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold" style={{ color: "var(--sp-text)" }}>Past papers</h2>
          {processedCount > 0 && processedCount < questions.length && (
            <button onClick={() => setOnlyPractice(v => !v)} aria-pressed={onlyPractice}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                onlyPractice ? "border-violet-500/40 bg-violet-500/10 text-violet-500" : ""}`}
              style={!onlyPractice ? { borderColor: "var(--sp-border)", color: "var(--sp-text-3)" } : undefined}>
              Practice ready only
            </button>
          )}
        </div>

        {questions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center"
            style={{ borderColor: "var(--sp-border)" }}>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-500">
              <FileText className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold" style={{ color: "var(--sp-text-2)" }}>No papers yet</p>
            <p className="max-w-xs text-xs" style={{ color: "var(--sp-text-3)" }}>
              Upload the first past question for this course.
            </p>
            <Link href="/dashboard/upload"
              className="mt-2 flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500">
              <Upload className="h-3.5 w-3.5" /> Upload a paper
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5">
            {papers.map(q => (
              <div key={q.id} className="overflow-hidden rounded-xl border"
                style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    q.ai_processed ? "bg-violet-500/15 text-violet-500" : "bg-indigo-500/10 text-indigo-400"}`}>
                    {q.ai_processed ? <Sparkles className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold" style={{ color: "var(--sp-text)" }}>{q.title}</p>
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
                  <div className="flex shrink-0 items-center gap-2">
                    {q.ai_processed && (
                      <button onClick={() => startPractice(q)}
                        className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500">
                        <Zap className="h-3 w-3" fill="white" /> Practice
                      </button>
                    )}
                    <button onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                      aria-expanded={expandedId === q.id}
                      className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium"
                      style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)", background: "var(--sp-bg-muted)" }}>
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expandedId === q.id ? "rotate-180" : ""}`} />
                      View
                    </button>
                  </div>
                </div>

                {expandedId === q.id && (
                  <div className="flex items-center justify-between gap-3 border-t px-4 py-3"
                    style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-muted)" }}>
                    <p className="text-xs" style={{ color: "var(--sp-text-3)" }}>
                      Uploaded {new Date(q.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                    <Link href={`/questions/${q.id}`}
                      className="flex items-center gap-1 text-xs font-semibold text-indigo-500 hover:text-indigo-400">
                      Open full past question<ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </div>
            ))}

            <Link href="/dashboard/upload"
              className="flex items-center justify-center gap-2 rounded-xl border border-dashed py-3 text-xs font-medium transition-all hover:text-indigo-500"
              style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)" }}>
              <Upload className="h-3.5 w-3.5" /> Upload another paper
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
