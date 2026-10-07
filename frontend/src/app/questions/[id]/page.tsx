"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, FileText, Loader2, AlertCircle,
  BookOpen, Play, Lock, Sparkles,
  Send, CheckCircle2,
  Paperclip, X, Clock, Eye, EyeOff, Crown,
  Zap, Check, RotateCcw, Trophy, ClipboardList,
} from "lucide-react";

import InlinePaperViewer from "@/components/InlinePaperViewer";
import { createClient } from "@/utils/supabase/client";

import "katex/dist/katex.min.css";
import { InlineMath, BlockMath } from "react-katex";

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
  plan: string;
}

interface Submission {
  id: string;
  status: "pending" | "reviewed";
  feedback: string | null;
  extracted_text: string | null;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
  reviewed_at: string | null;
}

const LOW_QUALITY_THRESHOLD = 0.5;

type Tab = "paper" | "submit" | "answers";

// ── Math renderer ─────────────────────────────────────────────────────────────

const MATH_SPLIT = /(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g;

function mapText(str: string, fn: (s: string) => string): string {
  return str
    .split(MATH_SPLIT)
    .map((seg, i) => (i % 2 === 1 ? seg : fn(seg)))
    .join("");
}

const LATEX_CMD =
  /(\\(?:d?frac|sqrt|sum|int|lim|times|div|cdot|pm|leq|geq|neq|approx|infty|alpha|beta|gamma|delta|theta|lambda|mu|pi|sigma|omega|log|ln|sin|cos|tan|rightarrow|to)\b(?:\{[^{}]*\})*(?:[\^_](?:\{[^{}]*\}|[A-Za-z0-9]))*)/g;

function autoWrapMath(raw: string): string {
  let t = raw
    .replace(/\\\[/g, "$$$$").replace(/\\\]/g, "$$$$")
    .replace(/\\\(/g, "$").replace(/\\\)/g, "$");
  t = mapText(t, s => s.replace(LATEX_CMD, "$$$1$$"));
  t = mapText(t, s => s.replace(/\bsqrt\(([^()]+)\)/g, (_m, a) => `$\\sqrt{${a}}$`));
  t = mapText(t, s =>
    s.replace(
      /(^|[^\w$\\{}])([A-Za-z0-9]+|\([^()]+\))((?:[\^_](?:\{[^{}]+\}|[+-]?[A-Za-z0-9]+))+)/g,
      (m, pre, base, ops) => {
        const hasCaret = ops.includes("^");
        if (!hasCaret && (base.startsWith("(") || base.length > 2)) return m;
        const fixed = ops.replace(/([\^_])([+-]?[A-Za-z0-9]+)/g, "$1{$2}");
        return `${pre}$${base}${fixed}$`;
      },
    ),
  );
  return t;
}

function MathRenderer({ content, className = "" }: { content: string | null; className?: string }) {
  const parts = useMemo(() => {
    if (!content) return [];
    return autoWrapMath(content).split(MATH_SPLIT);
  }, [content]);

  if (!content) return null;

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (!part) return null;
        if (part.startsWith("$$") && part.endsWith("$$") && part.length > 4) {
          const math = part.slice(2, -2).trim();
          if (!math) return null;
          return (
            <span key={index} className="my-2 block overflow-x-auto max-w-full">
              <BlockMath math={math} renderError={() => <span>{math}</span>} />
            </span>
          );
        }
        if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
          const math = part.slice(1, -1).trim();
          if (!math) return null;
          return <InlineMath key={index} math={math} renderError={() => <span>{math}</span>} />;
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
}

// ── Security layer ────────────────────────────────────────────────────────────

function useHardSecurity(enabled: boolean) {
  const [obscured, setObscured] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const onVisibility = () => setObscured(document.visibilityState === "hidden");
    const onBlur       = () => setObscured(true);
    const onFocus      = () => setObscured(false);

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur",  onBlur);
    window.addEventListener("focus", onFocus);

    const printStyle = document.createElement("style");
    printStyle.id = "__sp_print__";
    printStyle.textContent = `
      @media print {
        .sp-secure { filter: blur(40px) !important; opacity: 0.05 !important; }
        .sp-secure * { visibility: hidden !important; }
      }
    `;
    document.head.appendChild(printStyle);

    const onKey = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const blocked = [
        ctrl && e.key === "p",
        ctrl && e.key === "s",
        ctrl && e.key === "u",
        ctrl && e.shiftKey && (e.key === "i" || e.key === "j" || e.key === "c"),
        e.key === "PrintScreen",
        ctrl && e.shiftKey && e.key === "s",
      ];
      if (blocked.some(Boolean)) {
        e.preventDefault();
        e.stopPropagation();
        setObscured(true);
        setTimeout(() => setObscured(false), 1500);
      }
    };
    document.addEventListener("keydown", onKey, true);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur",  onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("keydown", onKey, true);
      document.getElementById("__sp_print__")?.remove();
    };
  }, [enabled]);

  return obscured;
}

interface SecureWrapProps {
  userEmail: string | null;
  children: React.ReactNode;
  enabled?: boolean;
}

function SecureWrap({ userEmail, children, enabled = true }: SecureWrapProps) {
  const obscured = useHardSecurity(enabled);

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    if (enabled) e.preventDefault();
  }, [enabled]);

  const onDragStart = useCallback((e: React.DragEvent) => {
    if (enabled) e.preventDefault();
  }, [enabled]);

  if (!enabled) return <>{children}</>;

  return (
    <div
      className="sp-secure relative"
      onContextMenu={onContextMenu}
      onDragStart={onDragStart}
      style={{
        userSelect:          "none",
        WebkitUserSelect:    "none",
        MozUserSelect:       "none" as React.CSSProperties["MozUserSelect"],
        msUserSelect:        "none" as React.CSSProperties["msUserSelect"],
        WebkitTouchCallout: "none",
      }}
    >
      {obscured && (
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-2xl"
          style={{ background: "var(--sp-bg-card)", backdropFilter: "blur(24px)" }}
        >
          <Lock className="h-8 w-8 mb-2" style={{ color: "var(--sp-text-3)" }} />
          <p className="text-sm font-bold" style={{ color: "var(--sp-text)" }}>Content hidden</p>
          <p className="text-xs mt-1" style={{ color: "var(--sp-text-3)" }}>Return to SparkL to continue</p>
        </div>
      )}

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-2xl"
        style={{ userSelect: "none" }}
      >
        {Array.from({ length: 40 }).map((_, i) => (
          <span
            key={i}
            className="absolute whitespace-nowrap font-bold"
            style={{
              top:           `${(i * 6.5) % 100}%`,
              left:          `${(i * 11.3) % 100}%`,
              transform:     "rotate(-28deg)",
              fontSize:      "9px",
              opacity:       0.055,
              color:         "var(--sp-text)",
              userSelect:    "none",
              pointerEvents: "none",
              letterSpacing: "0.04em",
            }}
          >
            SparkL · {userEmail ?? "protected"}
          </span>
        ))}
      </div>

      {children}
    </div>
  );
}

// ── AI Quiz Modal ────────────────────────────────────────────────────────────

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

// ── Types for AI quiz ────────────────────────────────────────────────────────

interface QuizQuestion {
  question_number: number;
  question_text: string;
  options: { a: string; b: string; c: string; d: string };
  correct_answer: "a" | "b" | "c" | "d";
  explanation: string;
}

interface QuizData {
  questions: QuizQuestion[];
}

// ── Loading stage sequence ────────────────────────────────────────────────────

const LOAD_STAGES = [
  { emoji: "📚", text: "Getting the room ready…" },
  { emoji: "✏️",  text: "Sharpening your pencils…" },
  { emoji: "🧠", text: "Brewing the questions…" },
  { emoji: "📋", text: "Get your pen and paper ready…" },
  { emoji: "🎯", text: "Almost there — focus up!" },
];

function QuizLoadingScreen({ stage }: { stage: number }) {
  const s = LOAD_STAGES[Math.min(stage, LOAD_STAGES.length - 1)];
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 px-8 text-center"
      style={{ background: "var(--sp-bg)" }}>
      {/* Animated ring */}
      <div className="relative h-28 w-28">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90 animate-spin"
          style={{ animationDuration: "2s" }}>
          <circle cx="50" cy="50" r="44" fill="none" strokeWidth="6"
            style={{ stroke: "var(--sp-bg-muted)" }} />
          <circle cx="50" cy="50" r="44" fill="none" strokeWidth="6"
            stroke="#6366f1" strokeLinecap="round"
            strokeDasharray="276" strokeDashoffset="210" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-4xl">
          {s.emoji}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-lg font-bold" style={{ color: "var(--sp-text)" }}>{s.text}</p>
        <p className="text-xs" style={{ color: "var(--sp-text-3)" }}>
          Preparing your personalised quiz session
        </p>
      </div>

      {/* Stage dots */}
      <div className="flex gap-2 mt-2">
        {LOAD_STAGES.map((_, i) => (
          <div key={i} className="h-1.5 w-1.5 rounded-full transition-all"
            style={{ background: i <= stage ? "#6366f1" : "var(--sp-bg-muted)",
                     width: i === stage ? "20px" : "6px" }} />
        ))}
      </div>
    </div>
  );
}

// ── Score ring ────────────────────────────────────────────────────────────────

function ScoreRing({ pct }: { pct: number }) {
  const r = 54, c = 2 * Math.PI * r;
  const color = pct >= 70 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative mx-auto h-36 w-36">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" strokeWidth="10" style={{ stroke: "var(--sp-bg-muted)" }} />
        <circle cx="64" cy="64" r={r} fill="none" strokeWidth="10" strokeLinecap="round"
          stroke={color} strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
          style={{ transition: "stroke-dashoffset 0.8s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-extrabold" style={{ color: "var(--sp-text)" }}>{pct}%</span>
        <span className="text-[11px]" style={{ color: "var(--sp-text-3)" }}>score</span>
      </div>
    </div>
  );
}

// ── Main quiz modal ───────────────────────────────────────────────────────────

function QuizModal({
  questionId,
  paperTitle,
  isPaid,
  onClose,
}: {
  questionId: string;
  paperTitle: string;
  isPaid: boolean;
  onClose: () => void;
}) {
  const supabase = createClient();

  // Loading state
  const [loadStage, setLoadStage] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [quiz, setQuiz]           = useState<QuizData | null>(null);

  // Quiz state
  const [index, setIndex]       = useState(0);
  const [picks, setPicks]       = useState<Record<number, string>>({});   // question_number → chosen option
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});  // revealed after picking
  const [finished, setFinished] = useState(false);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Fetch quiz from backend (which handles cache)
  useEffect(() => {
    let stageTimer: ReturnType<typeof setInterval>;
    let stage = 0;

    // Advance loading stage every ~800ms for UX effect
    stageTimer = setInterval(() => {
      stage = Math.min(stage + 1, LOAD_STAGES.length - 1);
      setLoadStage(stage);
    }, 800);

    async function fetchQuiz() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setLoadError("Session expired. Please refresh."); return; }

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/quiz/${questionId}`,
          { headers: { Authorization: `Bearer ${session.access_token}` } },
        );
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.detail || "Failed to load quiz. Please try again.");
        }
        const data: QuizData = await res.json();
        // Enforce free-plan limit: max 2 questions
        if (!isPaid && data.questions.length > 2) {
          data.questions = data.questions.slice(0, 2);
        }
        clearInterval(stageTimer);
        setLoadStage(LOAD_STAGES.length - 1);
        // Brief pause so last stage message shows
        setTimeout(() => setQuiz(data), 400);
      } catch (err) {
        clearInterval(stageTimer);
        setLoadError(err instanceof Error ? err.message : "Something went wrong.");
      }
    }

    fetchQuiz();
    return () => clearInterval(stageTimer);
  }, [questionId, isPaid]);

  // Keyboard: a–d to answer, arrows to navigate
  useEffect(() => {
    if (!quiz || finished) return;
    const q = quiz.questions[index];
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase() as "a" | "b" | "c" | "d";
      if (["a", "b", "c", "d"].includes(k) && !picks[q.question_number]) {
        handlePick(k);
      }
      if (e.key === "ArrowRight" && picks[q.question_number]) handleNext();
      if (e.key === "ArrowLeft" && index > 0) setIndex(i => i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quiz, index, picks, finished]);

  function handlePick(opt: string) {
    if (!quiz) return;
    const q = quiz.questions[index];
    if (picks[q.question_number]) return; // already answered
    setPicks(p => ({ ...p, [q.question_number]: opt }));
    setRevealed(r => ({ ...r, [q.question_number]: true }));
  }

  function handleNext() {
    if (!quiz) return;
    if (index === quiz.questions.length - 1) setFinished(true);
    else setIndex(i => i + 1);
  }

  function restart() {
    setIndex(0); setPicks({}); setRevealed({}); setFinished(false);
  }

  // ── Loading screen ──────────────────────────────────────────────────────────
  if (!quiz && !loadError) {
    return <QuizLoadingScreen stage={loadStage} />;
  }

  // ── Error screen ────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 px-8 text-center"
        style={{ background: "var(--sp-bg)" }}>
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-sm font-semibold" style={{ color: "var(--sp-text)" }}>{loadError}</p>
        <button onClick={onClose}
          className="rounded-xl border px-5 py-2.5 text-sm font-semibold transition"
          style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-2)", background: "var(--sp-bg-card)" }}>
          Close
        </button>
      </div>
    );
  }

  const questions   = quiz!.questions;
  const q           = questions[index];
  const picked      = picks[q.question_number];
  const isCorrect   = picked === q.correct_answer;
  const isAnswered  = !!picked;
  const isLast      = index === questions.length - 1;
  const answered    = Object.keys(picks).length;
  const correctCount = questions.filter(qq => picks[qq.question_number] === qq.correct_answer).length;
  const pct         = Math.round((correctCount / questions.length) * 100);

  function optStyle(opt: string): React.CSSProperties {
    if (!isAnswered) return {
      borderColor: "var(--sp-border)", background: "var(--sp-bg-card)", color: "var(--sp-text-2)",
    };
    if (opt === q.correct_answer)
      return { borderColor: "rgba(16,185,129,0.6)", background: "rgba(16,185,129,0.10)", color: "var(--sp-text)" };
    if (opt === picked)
      return { borderColor: "rgba(239,68,68,0.6)", background: "rgba(239,68,68,0.08)", color: "var(--sp-text)" };
    return { borderColor: "var(--sp-border)", background: "var(--sp-bg-card)", color: "var(--sp-text-2)", opacity: 0.45 };
  }

  function badgeStyle(opt: string): React.CSSProperties {
    if (isAnswered && opt === q.correct_answer) return { background: "#10b981", borderColor: "#10b981", color: "#fff" };
    if (isAnswered && opt === picked)           return { background: "#ef4444", borderColor: "#ef4444", color: "#fff" };
    return { borderColor: "var(--sp-border)", color: "var(--sp-text-3)" };
  }

  // ── Results screen ──────────────────────────────────────────────────────────
  if (finished) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--sp-bg)" }}>
        <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0"
          style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-card)" }}>
          <button onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border transition"
            style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-2)" }}>
            <X size={16} />
          </button>
          <span className="text-sm font-bold" style={{ color: "var(--sp-text)" }}>Quiz results</span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto max-w-md space-y-5">
            <div className="rounded-3xl border p-6 text-center space-y-5"
              style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
              <div className="flex items-center justify-center gap-2">
                <Trophy size={18} className="text-amber-500" />
                <p className="text-base font-bold" style={{ color: "var(--sp-text)" }}>
                  {pct >= 70 ? "Excellent! You crushed it 🔥" : pct >= 40 ? "Good effort — keep pushing" : "Let's go over these again"}
                </p>
              </div>
              <ScoreRing pct={pct} />
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Correct", v: correctCount,                           c: "#10b981" },
                  { label: "Wrong",   v: answered - correctCount,                c: "#ef4444" },
                  { label: "Total",   v: questions.length,                       c: "#6366f1" },
                ].map(s => (
                  <div key={s.label} className="rounded-2xl py-3" style={{ background: "var(--sp-bg-muted)" }}>
                    <p className="text-xl font-extrabold" style={{ color: s.c }}>{s.v}</p>
                    <p className="text-[11px]" style={{ color: "var(--sp-text-3)" }}>{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={restart}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-500 transition">
                  <RotateCcw size={14} /> Try again
                </button>
                <button onClick={onClose}
                  className="flex-1 rounded-2xl border px-5 py-3 text-sm font-semibold transition"
                  style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-2)", background: "var(--sp-bg-card)" }}>
                  Done
                </button>
              </div>
            </div>

            {/* Per-question review */}
            <p className="text-xs font-semibold px-1" style={{ color: "var(--sp-text-3)" }}>Question breakdown</p>
            {questions.map((qq, i) => {
              const userPick = picks[qq.question_number];
              const correct  = userPick === qq.correct_answer;
              return (
                <div key={i} className="rounded-2xl border p-4 space-y-2"
                  style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
                  <div className="flex items-start gap-2">
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${correct ? "bg-emerald-500" : "bg-red-500"} text-white`}>
                      {correct ? <Check size={10} strokeWidth={3} /> : <X size={10} strokeWidth={3} />}
                    </span>
                    <p className="text-sm leading-6" style={{ color: "var(--sp-text)" }}>
                      <MathRenderer content={qq.question_text} />
                    </p>
                  </div>
                  {!correct && (
                    <p className="text-xs pl-7" style={{ color: "var(--sp-text-3)" }}>
                      Your answer: <strong className="text-red-400">{userPick?.toUpperCase() ?? "—"}</strong>
                      {" · "}Correct: <strong className="text-emerald-400">{qq.correct_answer.toUpperCase()}</strong>
                    </p>
                  )}
                  <div className="rounded-xl p-3 text-xs leading-relaxed pl-7"
                    style={{ background: "var(--sp-bg-muted)", color: "var(--sp-text-2)" }}>
                    <MathRenderer content={qq.explanation} />
                  </div>
                </div>
              );
            })}

            {!isPaid && (
              <div className="rounded-3xl border p-6 text-center"
                style={{ borderColor: "rgba(99,102,241,0.25)", background: "rgba(99,102,241,0.06)" }}>
                <Lock className="h-5 w-5 text-indigo-500 mx-auto mb-2" />
                <p className="text-sm font-semibold" style={{ color: "var(--sp-text)" }}>
                  Free plan — 2 questions per quiz
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--sp-text-3)" }}>
                  Upgrade to unlock all questions and unlimited quiz attempts.
                </p>
                <Link href="/dashboard/subscribe"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 transition">
                  <Crown className="h-3.5 w-3.5" /> Unlock everything <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Active quiz screen ──────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--sp-bg)" }}>
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 shrink-0 border-b"
        style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-card)" }}>
        <button onClick={onClose} aria-label="Close quiz"
          className="flex h-9 w-9 items-center justify-center rounded-full border transition"
          style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-2)" }}>
          <X size={16} />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold" style={{ color: "var(--sp-text-2)" }}>
              Question {index + 1} of {questions.length}
            </span>
            <span className="text-[11px]" style={{ color: "var(--sp-text-3)" }}>
              {answered} answered
            </span>
          </div>
          {/* Progress bar */}
          <div className="flex gap-[3px]">
            {questions.map((qq, i) => {
              const p = picks[qq.question_number];
              const bg = p
                ? p === qq.correct_answer ? "#10b981" : "#ef4444"
                : i === index ? "#6366f1" : "var(--sp-bg-muted)";
              return (
                <div key={i} className="h-1.5 flex-1 rounded-full transition-colors"
                  style={{ background: bg, minWidth: 4 }} />
              );
            })}
          </div>
        </div>
      </div>

      {/* Question body */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="rounded-3xl border p-5 space-y-5"
            style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
            {/* Question header */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1.5 text-sm font-bold text-indigo-500">
                <Sparkles size={14} /> Q{q.question_number}
              </span>
              <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-500">
                MCQ
              </span>
            </div>

            {/* Question text */}
            <div className="text-[17px] leading-8 whitespace-pre-wrap" style={{ color: "var(--sp-text)" }}>
              <MathRenderer content={q.question_text} />
            </div>

            {/* Options */}
            <div className="space-y-2.5">
              {(["a", "b", "c", "d"] as const).map(opt => (
                <button key={opt} onClick={() => handlePick(opt)} disabled={isAnswered}
                  className="w-full flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left text-[15px] leading-6 transition-all active:scale-[0.99] disabled:cursor-default"
                  style={optStyle(opt)}>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold uppercase"
                    style={badgeStyle(opt)}>
                    {isAnswered && opt === q.correct_answer ? <Check size={14} strokeWidth={3} />
                      : isAnswered && opt === picked ? <X size={14} strokeWidth={3} />
                      : opt}
                  </span>
                  <MathRenderer content={q.options[opt]} className="flex-1 min-w-0 break-words" />
                </button>
              ))}
            </div>

            {/* Explanation — shown after answering */}
            {isAnswered && (
              <div className="rounded-2xl border p-4 space-y-1"
                style={{
                  borderColor: isCorrect ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)",
                  background:  isCorrect ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)",
                }}>
                <p className={`text-sm font-bold ${isCorrect ? "text-emerald-500" : "text-red-400"}`}>
                  {isCorrect ? "✓ Correct!" : `✗ The answer is ${q.correct_answer.toUpperCase()}`}
                </p>
                <div className="text-sm leading-6" style={{ color: "var(--sp-text-2)" }}>
                  <MathRenderer content={q.explanation} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer nav */}
      <div className="flex items-center gap-3 px-4 py-3 shrink-0 border-t"
        style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-card)" }}>
        <button onClick={() => setIndex(i => Math.max(0, i - 1))} disabled={index === 0}
          className="flex items-center gap-1.5 rounded-2xl border px-4 py-3 text-sm font-semibold transition disabled:opacity-30"
          style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-2)", background: "var(--sp-bg-card)" }}>
          <ArrowLeft size={14} /> Prev
        </button>

        <button onClick={isAnswered ? handleNext : undefined}
          disabled={!isAnswered}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-2xl px-4 py-3 text-sm font-bold transition ${
            isAnswered ? "bg-indigo-600 text-white hover:bg-indigo-500" : "border opacity-40 cursor-not-allowed"
          }`}
          style={!isAnswered ? { borderColor: "var(--sp-border)", color: "var(--sp-text-2)", background: "var(--sp-bg-card)" } : undefined}>
          {isLast ? "See results" : "Next question"} <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ── View answers section (read-only) ─────────────────────────────────────────

function ViewAnswersSection({
  questionId,
  submissions,
  loading,
  onGoSubmit,
}: {
  questionId: string;
  submissions: Submission[];
  loading: boolean;
  onGoSubmit: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="rounded-2xl border p-10 text-center"
        style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: "rgba(99,102,241,0.1)" }}>
          <ClipboardList size={22} className="text-indigo-400" />
        </div>
        <p className="text-sm font-semibold" style={{ color: "var(--sp-text)" }}>No answers submitted yet</p>
        <p className="mt-1 text-xs" style={{ color: "var(--sp-text-3)" }}>
          Submit your answers and they&apos;ll appear here with feedback.
        </p>
        <button
          onClick={onGoSubmit}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition"
        >
          <Send size={12} /> Submit answers
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold px-1" style={{ color: "var(--sp-text-3)" }}>
        Your submissions ({submissions.length})
      </p>
      {submissions.map(sub => (
        <div key={sub.id} className="rounded-2xl border p-4 space-y-3"
          style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs" style={{ color: "var(--sp-text-3)" }}>
              {new Date(sub.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
            </span>
            {sub.status === "reviewed" ? (
              <span className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold text-emerald-500"
                style={{ borderColor: "rgba(16,185,129,0.2)", background: "rgba(16,185,129,0.08)" }}>
                <CheckCircle2 size={10} /> Reviewed
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold"
                style={{ borderColor: "rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.08)", color: "#f59e0b" }}>
                <Clock size={10} /> Pending review
              </span>
            )}
          </div>
          {sub.extracted_text && (
            <div className="rounded-xl p-3 text-sm leading-relaxed whitespace-pre-wrap"
              style={{ background: "var(--sp-bg-muted)", color: "var(--sp-text-2)" }}>
              <MathRenderer content={sub.extracted_text.length > 400 ? sub.extracted_text.slice(0, 400) + "…" : sub.extracted_text} />
            </div>
          )}
          {sub.mime_type && !sub.extracted_text && (
            <div className="flex items-center gap-2 rounded-xl p-3 text-xs"
              style={{ background: "var(--sp-bg-muted)", color: "var(--sp-text-3)" }}>
              <Paperclip size={12} />
              File attached ({sub.mime_type.split("/")[1]?.toUpperCase() ?? "FILE"}
              {sub.file_size ? ` · ${(sub.file_size / 1024).toFixed(0)} KB` : ""})
            </div>
          )}
          {sub.status === "reviewed" && sub.feedback && (
            <div className="rounded-xl border p-3 space-y-1"
              style={{ borderColor: "rgba(16,185,129,0.2)", background: "rgba(16,185,129,0.05)" }}>
              <p className="text-[10px] font-semibold text-emerald-500">Feedback from SparkL</p>
              <div className="text-sm leading-6 whitespace-pre-wrap" style={{ color: "var(--sp-text-2)" }}>
                <MathRenderer content={sub.feedback} />
              </div>
            </div>
          )}
          {sub.status === "pending" && (
            <p className="text-[10px]" style={{ color: "var(--sp-text-3)" }}>
              Your submission is being reviewed. Check back soon.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Submit answers section (form only) ───────────────────────────────────────

function SubmitAnswersSection({
  questionId,
  existingCount,
  onSubmitted,
}: {
  questionId: string;
  existingCount: number;
  onSubmitted: (sub: Submission) => void;
}) {
  const supabase = createClient();
  const router   = useRouter();

  const [text, setText]           = useState("");
  const [file, setFile]           = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSubmit() {
    if (!text.trim() && !file) return;
    setSubmitting(true);
    setSubmitError("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push("/auth/login"); return; }
    try {
      const formData = new FormData();
      formData.append("question_id", questionId);
      if (text.trim()) formData.append("solution_text", text.trim());
      if (file) formData.append("file", file);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/answers/submit`,
        { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` }, body: formData },
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || "Failed to submit. Please try again.");
      }
      const newId = (await res.json()).id;
      const newSub: Submission = {
        id: newId,
        status: "pending",
        feedback: null,
        extracted_text: text.trim() || null,
        mime_type: file?.type ?? null,
        file_size: file?.size ?? null,
        created_at: new Date().toISOString(),
        reviewed_at: null,
      };
      onSubmitted(newSub);
      setText(""); setFile(null);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border p-5 space-y-4"
      style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
      <div>
        <p className="text-sm font-semibold" style={{ color: "var(--sp-text)" }}>
          {existingCount > 0 ? "Submit another answer" : "Submit your answers"}
        </p>
        <p className="mt-0.5 text-xs" style={{ color: "var(--sp-text-3)" }}>Share your worked answers for feedback.</p>
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Type your answers here…"
        rows={5}
        className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition resize-none"
        style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-muted)", color: "var(--sp-text)" }}
      />
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition"
          style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-muted)", color: "var(--sp-text-2)" }}
        >
          <Paperclip size={13} />
          {file ? "Change file" : "Attach file"}
        </button>
        {file && (
          <div className="flex items-center gap-2 rounded-xl border px-3 py-1.5"
            style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-muted)" }}>
            <span className="text-xs truncate max-w-[160px]" style={{ color: "var(--sp-text-2)" }}>{file.name}</span>
            <button onClick={() => setFile(null)}><X size={12} style={{ color: "var(--sp-text-3)" }} /></button>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={e => setFile(e.target.files?.[0] ?? null)}
        />
      </div>
      {submitError && (
        <div className="flex items-start gap-2 rounded-xl border px-3 py-2.5"
          style={{ borderColor: "rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.05)" }}>
          <AlertCircle size={13} className="mt-0.5 shrink-0 text-red-400" />
          <p className="text-xs text-red-400">{submitError}</p>
        </div>
      )}
      <button
        onClick={handleSubmit}
        disabled={(!text.trim() && !file) || submitting}
        className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        {submitting ? "Submitting…" : "Submit answers"}
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function QuestionDetailPage() {
  const supabase   = createClient();
  const router     = useRouter();
  const params     = useParams();
  const questionId = params?.id as string;

  const [data, setData]           = useState<QuestionDetail | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [processedQuestions, setProcessedQuestions] = useState<ProcessedQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading]     = useState(false);

  const [limits, setLimits] = useState<QuestionLimits>({ is_paid: false, plan: "free" });

  // Submissions — loaded once, shared between ViewAnswers and SubmitAnswers tabs
  const [submissions, setSubmissions]       = useState<Submission[]>([]);
  const [subsLoading, setSubsLoading]       = useState(true);

  const [tab, setTab]               = useState<Tab>("paper");
  const [showQuiz, setShowQuiz]     = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  // Load question detail + limits
  useEffect(() => {
    if (!questionId) return;
    async function load() {
      setLoading(true); setError("");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth/login"); return; }
      setUserEmail(session.user?.email ?? null);

      try {
        const [detailRes, limitsRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/questions/${questionId}`,
            { headers: { Authorization: `Bearer ${session.access_token}` } }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/payments/subscription/status`,
            { headers: { Authorization: `Bearer ${session.access_token}` } }),
        ]);
        if (detailRes.status === 404) throw new Error("This past question wasn't found.");
        if (!detailRes.ok) throw new Error("Failed to load this past question.");

        const detailData = await detailRes.json();
        setData(detailData);

        if (limitsRes.ok) {
          const d = await limitsRes.json();
          const plan   = (d.effective_plan ?? d.plan ?? "free").toLowerCase();
          const isPaid = d.is_paid === true || d.is_trial === true;
          setLimits({ is_paid: isPaid, plan });
        }

        setQuestionsLoading(true);
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/questions/${questionId}/processed`,
          { headers: { Authorization: `Bearer ${session.access_token}` } })
          .then(r => r.ok ? r.json() : [])
          .then(setProcessedQuestions)
          .catch(() => {})
          .finally(() => setQuestionsLoading(false));

        // Load submissions once here so both tabs share the same data
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/answers/my/${questionId}`,
          { headers: { Authorization: `Bearer ${session.access_token}` } })
          .then(r => r.ok ? r.json() : [])
          .then(setSubmissions)
          .catch(() => {})
          .finally(() => setSubsLoading(false));

      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [questionId, router, supabase.auth]);

  useEffect(() => {
    const style = document.createElement("style");
    style.id    = "sp-global-sec";
    style.textContent = `
      @media print {
        .sp-secure { filter: blur(40px) !important; opacity: 0.05 !important; }
        .sp-secure * { visibility: hidden !important; }
      }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById("sp-global-sec")?.remove(); };
  }, []);

  // Called when a new submission is made — prepend to shared list and switch to view tab
  const handleNewSubmission = useCallback((sub: Submission) => {
    setSubmissions(prev => [sub, ...prev]);
    setTab("answers");
  }, []);

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

  const isPdf        = data.mime_type?.startsWith("application/pdf");
  const isLowQuality = data.extraction_quality !== null && data.extraction_quality < LOW_QUALITY_THRESHOLD;
  const hasProcessed = processedQuestions.length > 0;
  const mcqCount     = processedQuestions.filter(q => q.question_type === "mcq").length;
  const theoryCount  = processedQuestions.filter(q => q.question_type === "theory").length;

  return (
    <>
      {showQuiz && (
        <QuizModal
          questionId={questionId}
          paperTitle={data.title}
          isPaid={limits.is_paid}
          onClose={() => setShowQuiz(false)}
        />
      )}

      <div className="min-h-screen px-4 py-8 sm:px-6 pb-28" style={{ background: "var(--sp-bg)" }}>
        <div className="mx-auto max-w-3xl">
          <Link
            href={data.course ? `/dashboard/courses/${data.course.id}` : "/dashboard"}
            className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
            style={{ color: "var(--sp-text-3)" }}>
            <ArrowLeft size={15} /> Back
          </Link>

          {/* Header card */}
          <div className="mt-4 rounded-2xl border p-5"
            style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "rgba(99,102,241,0.1)" }}>
                <FileText size={20} className="text-indigo-500" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-bold" style={{ color: "var(--sp-text)" }}>{data.title}</h1>
                <p className="mt-0.5 text-sm" style={{ color: "var(--sp-text-3)" }}>
                  {data.course?.name ?? "—"}
                  {data.semester?.name ? ` · ${data.semester.name}` : ""}
                  {data.year ? ` · ${data.year}` : ""}
                </p>
              </div>
            </div>

            {isLowQuality && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border px-3 py-2.5"
                style={{ borderColor: "rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.06)" }}>
                <AlertCircle size={13} className="mt-0.5 shrink-0" style={{ color: "#f59e0b" }} />
                <p className="text-xs" style={{ color: "#f59e0b" }}>
                  This scan quality is low — some content may be unclear.
                </p>
              </div>
            )}

            {/* Tabs */}
            <div className="mt-5 flex items-center gap-1 flex-wrap border-t pt-4"
              style={{ borderColor: "var(--sp-border)" }}>
              <TabBtn active={tab === "paper"} onClick={() => setTab("paper")}>
                <FileText size={12} /> View paper
                {!limits.is_paid && (
                  <span className="rounded-full px-1.5 py-0.5 text-[8px] font-bold"
                    style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>
                    1 Page Preview
                  </span>
                )}
              </TabBtn>

              <TabBtn active={tab === "submit"} onClick={() => setTab("submit")}>
                <Send size={12} /> Submit answers
              </TabBtn>

              <TabBtn active={tab === "answers"} onClick={() => setTab("answers")}>
                <ClipboardList size={12} /> View answers
                {submissions.length > 0 && (
                  <span className="rounded-full px-1.5 py-0.5 text-[8px] font-bold"
                    style={{ background: "rgba(99,102,241,0.15)", color: "#6366f1" }}>
                    {submissions.length}
                  </span>
                )}
              </TabBtn>

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

          {/* Tab content */}
          <div className="mt-4 space-y-4">
            {tab === "paper" && isPdf && (
              <div className="rounded-2xl border p-5 space-y-4"
                style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
                <button onClick={() => setShowPreview(v => !v)}
                  className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition w-full justify-center"
                  style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-muted)", color: "var(--sp-text-2)" }}>
                  {showPreview
                    ? <><EyeOff size={14} /> Hide paper preview</>
                    : <><Eye size={14} /> Show paper preview</>}
                </button>

                {showPreview && (
                  <SecureWrap userEmail={userEmail} enabled={limits.is_paid}>
                    <InlinePaperViewer
                      questionId={questionId}
                      isPaid={limits.is_paid}
                      userEmail={userEmail}
                      maxPages={limits.is_paid ? undefined : 1}
                    />
                  </SecureWrap>
                )}

                {!limits.is_paid && (
                  <div className="rounded-xl border p-4 text-center space-y-2 mt-4"
                    style={{ borderColor: "rgba(99,102,241,0.2)", background: "rgba(99,102,241,0.05)" }}>
                    <p className="text-xs font-semibold" style={{ color: "var(--sp-text)" }}>
                      Viewing 1-page free preview
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--sp-text-3)" }}>
                      Upgrade to Basic, Pro, or Premium to access all pages and full downloads.
                    </p>
                    <Link href="/dashboard/subscribe"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 transition">
                      <Crown className="h-3 w-3" />
                      Upgrade now
                    </Link>
                  </div>
                )}
              </div>
            )}

            {tab === "paper" && !isPdf && (
              <EmptyState
                icon={<FileText size={22} className="text-indigo-400" />}
                title="No PDF viewer available for this file"
                body="This document is not stored as a PDF file."
              />
            )}

            {tab === "submit" && (
              <SubmitAnswersSection
                questionId={questionId}
                existingCount={submissions.length}
                onSubmitted={handleNewSubmission}
              />
            )}

            {tab === "answers" && (
              <ViewAnswersSection
                questionId={questionId}
                submissions={submissions}
                loading={subsLoading}
                onGoSubmit={() => setTab("submit")}
              />
            )}
          </div>
        </div>
      </div>

      {/* Floating quiz button — always visible once paper is loaded */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 px-4 w-full max-w-xs">
        <button
          onClick={() => setShowQuiz(true)}
          className="w-full flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-2xl transition active:scale-95"
          style={{
            background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
            boxShadow:  "0 8px 32px rgba(99,102,241,0.45)",
          }}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <Play size={14} className="text-white" fill="white" />
          </div>
          <div className="text-left min-w-0 flex-1">
            <p className="text-sm font-bold text-white leading-none">Take Quiz</p>
            <p className="text-[11px] text-indigo-200 mt-0.5">
              AI-generated · interactive MCQ
            </p>
          </div>
          <Sparkles size={16} className="text-indigo-200 shrink-0" />
        </button>
      </div>
    </>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function TabBtn({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all"
      style={active
        ? { background: "#4f46e5", color: "#fff" }
        : { background: "var(--sp-bg-muted)", color: "var(--sp-text-3)" }}>
      {children}
    </button>
  );
}

function EmptyState({ icon, title, body }: {
  icon: React.ReactNode; title: string; body: string;
}) {
  return (
    <div className="rounded-2xl border p-10 text-center"
      style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
        style={{ background: "rgba(99,102,241,0.1)" }}>
        {icon}
      </div>
      <p className="text-sm font-semibold" style={{ color: "var(--sp-text)" }}>{title}</p>
      <p className="mt-1 text-xs" style={{ color: "var(--sp-text-3)" }}>{body}</p>
    </div>
  );
}
