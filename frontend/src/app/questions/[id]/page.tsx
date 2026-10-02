"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, FileText, Loader2, AlertCircle,
  BookOpen, Play, Lock, Sparkles,
  Send, CheckCircle2,
  Paperclip, X, Clock, Eye, EyeOff, Crown,
  ChevronDown, Zap, RotateCcw,
} from "lucide-react";

import InlinePaperViewer from "@/components/InlinePaperViewer";
import { createClient } from "@/utils/supabase/client";

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
  read_mode_percent: number;
  practice_mode_max: number | null;
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
const FREE_PRACTICE_CAP     = 5;
const FREE_TEXT_LINES       = 10;

type Tab = "text" | "paper" | "submit" | "practice";


// ══════════════════════════════════════════════════════════════════════════════
// ── SECURITY LAYER ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/**
 * useHardSecurity — aggressive multi-vector content protection.
 *
 * Vectors covered:
 *   1. Visibility / blur events  → hides content when tab loses focus
 *   2. Print stylesheet          → blurs all protected content
 *   3. CSS user-select: none     → blocks text selection / copy
 *   4. context-menu block        → disables right-click on protected zones
 *   5. keyboard shortcut block   → PrintScreen, Ctrl+P, Ctrl+S, Ctrl+U,
 *                                   Ctrl+Shift+I/J/C (devtools)
 *   6. Drag-start block          → prevents drag-to-copy
 *   7. Tiled email watermark     → visible deterrent + attribution
 *
 * What can NOT be blocked in a browser:
 *   - OS-level screenshot tools (Print Screen key at OS level,
 *     macOS Cmd+Shift+3/4, phone button combos).
 *   - Screen recording software running outside the browser.
 * The watermark ensures attribution even if a screenshot is taken.
 */
function useHardSecurity(enabled: boolean) {
  const [obscured, setObscured] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    // ── 1. Visibility / blur ──────────────────────────────────────────────
    const onVisibility = () => setObscured(document.visibilityState === "hidden");
    const onBlur       = () => setObscured(true);
    const onFocus      = () => setObscured(false);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur",  onBlur);
    window.addEventListener("focus", onFocus);

    // ── 2. Print stylesheet ───────────────────────────────────────────────
    const printStyle = document.createElement("style");
    printStyle.id = "__sp_print__";
    printStyle.textContent = `
      @media print {
        .sp-secure { filter: blur(40px) !important; opacity: 0.05 !important; }
        .sp-secure * { visibility: hidden !important; }
      }
    `;
    document.head.appendChild(printStyle);

    // ── 5. Keyboard shortcuts ─────────────────────────────────────────────
    const onKey = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const blocked = [
        ctrl && e.key === "p",           // print
        ctrl && e.key === "s",           // save page
        ctrl && e.key === "u",           // view source
        ctrl && e.shiftKey && (e.key === "i" || e.key === "j" || e.key === "c"),
        e.key === "PrintScreen",
        ctrl && e.shiftKey && e.key === "s", // Windows snip shortcut
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

  // ── 4. Context-menu block ─────────────────────────────────────────────
  const onContextMenu = useCallback((e: React.MouseEvent) => {
    if (enabled) e.preventDefault();
  }, [enabled]);

  // ── 6. Drag-start block ───────────────────────────────────────────────
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
        // ── 3. user-select block ──────────────────────────────────────
        userSelect:          "none",
        WebkitUserSelect:    "none",
        MozUserSelect:       "none" as React.CSSProperties["MozUserSelect"],
        msUserSelect:        "none" as React.CSSProperties["msUserSelect"],
        WebkitTouchCallout: "none",
      }}
    >
      {/* Obscure overlay — shown when focus is lost */}
      {obscured && (
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-2xl"
          style={{ background: "var(--sp-bg-card)", backdropFilter: "blur(24px)" }}
        >
          <Lock className="h-8 w-8 mb-2" style={{ color: "var(--sp-text-3)" }} />
          <p className="text-sm font-bold" style={{ color: "var(--sp-text)" }}>
            Content hidden
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--sp-text-3)" }}>
            Return to SparkL to continue
          </p>
        </div>
      )}

      {/* ── 7. Tiled watermark ────────────────────────────────────────── */}
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


// ══════════════════════════════════════════════════════════════════════════════
// ── Extracted text (hero) ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function ExtractedTextHero({
  text,
  isPaid,
  userEmail,
}: {
  text: string;
  isPaid: boolean;
  userEmail: string | null;
}) {
  const lines   = text.split("\n").filter(l => l.trim());
  const visible = isPaid ? lines : lines.slice(0, FREE_TEXT_LINES);
  const hidden  = lines.length - visible.length;
  const isGated = !isPaid && hidden > 0;

  return (
    <div className="space-y-3">
      <SecureWrap userEmail={userEmail} enabled={isPaid}>
        <div
          className="rounded-2xl border"
          style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
        >
          {/* Header strip */}
          <div
            className="flex items-center gap-2 px-5 py-3.5 border-b"
            style={{ borderColor: "var(--sp-border)" }}
          >
            <FileText size={14} style={{ color: "var(--sp-text-3)" }} />
            <span className="text-xs font-semibold" style={{ color: "var(--sp-text-3)" }}>
              Extracted paper text
            </span>
            {!isPaid && (
              <span
                className="ml-auto rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  borderColor: "rgba(245,158,11,0.3)",
                  background:  "rgba(245,158,11,0.08)",
                  color:       "var(--sp-amber, #f59e0b)",
                }}
              >
                Preview · {FREE_TEXT_LINES} lines
              </span>
            )}
          </div>

          {/* Body */}
          <div className="px-5 py-5 space-y-0 relative">
            {visible.map((line, i) => {
              // Detect section headers (short, ends with colon or all-caps-ish)
              const isHeader = line.length < 80 && /^[A-Z\d]/.test(line) &&
                (line.endsWith(":") || /^[A-Z\s\d]{4,}$/.test(line));

              return (
                <p
                  key={i}
                  className={`leading-7 whitespace-pre-wrap ${
                    isHeader
                      ? "text-sm font-semibold pt-4 first:pt-0 pb-1"
                      : "text-sm"
                  }`}
                  style={{
                    color: isHeader ? "var(--sp-text)" : "var(--sp-text-2)",
                  }}
                >
                  {line}
                </p>
              );
            })}

            {/* Fade-out for gated content */}
            {isGated && (
              <div
                className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
                style={{
                  background: "linear-gradient(to bottom, transparent, var(--sp-bg-card))",
                }}
              />
            )}
          </div>
        </div>
      </SecureWrap>

      {/* Gate banner */}
      {isGated && (
        <div
          className="rounded-2xl border p-6 text-center"
          style={{
            borderColor: "rgba(99,102,241,0.2)",
            background:  "rgba(99,102,241,0.05)",
          }}
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl mx-auto mb-3"
            style={{ background: "rgba(99,102,241,0.12)" }}
          >
            <Crown className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="text-sm font-semibold" style={{ color: "var(--sp-text)" }}>
            {hidden} more line{hidden !== 1 ? "s" : ""} hidden
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--sp-text-3)" }}>
            Upgrade to Basic, Pro or Premium to read the full text
          </p>
          <Link
            href="/dashboard/subscribe"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 transition"
          >
            <Crown className="h-3.5 w-3.5" />
            Unlock full text
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// ── Practice modal (quiz) ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function PracticeMCQ({ q }: { q: ProcessedQuestion }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  function style(opt: string): React.CSSProperties {
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
      {(["a","b","c","d"] as const).map(opt => {
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
        <div
          className="rounded-xl border p-4 space-y-1.5 mt-1"
          style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-muted)" }}
        >
          <p className={`text-sm font-semibold ${selected === q.correct_answer ? "text-emerald-500" : "text-red-500"}`}>
            {selected === q.correct_answer ? "✓ Correct!" : `✗ Incorrect — answer is ${q.correct_answer?.toUpperCase()}`}
          </p>
          {q.explanation && (
            <p className="text-sm leading-6" style={{ color: "var(--sp-text-3)" }}>{q.explanation}</p>
          )}
        </div>
      )}
    </div>
  );
}

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
        <div
          className="rounded-xl border p-4"
          style={{ borderColor: "rgba(16,185,129,0.2)", background: "rgba(16,185,129,0.05)" }}
        >
          <p className="text-[10px] font-semibold text-emerald-500 mb-2">Model Answer</p>
          <p className="text-sm leading-7 whitespace-pre-wrap" style={{ color: "var(--sp-text-2)" }}>
            {q.model_answer}
          </p>
        </div>
      )}
    </div>
  );
}

function PracticeModal({
  questions,
  isPaid,
  userEmail,
  onClose,
}: {
  questions: ProcessedQuestion[];
  isPaid: boolean;
  userEmail: string | null;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const visible   = !isPaid ? questions.slice(0, FREE_PRACTICE_CAP) : questions;
  const hidden    = questions.length - visible.length;
  const isGated   = !isPaid && hidden > 0;
  const q         = visible[index];
  const mcqCount  = visible.filter(q => q.question_type === "mcq").length;
  const theoryCount = visible.filter(q => q.question_type === "theory").length;

  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "var(--sp-bg)" }}
    >
      {/* Modal header */}
      <div
        className="flex items-center gap-3 px-4 py-3.5 border-b shrink-0"
        style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-card)" }}
      >
        <button
          onClick={onClose}
          className="flex items-center justify-center h-8 w-8 rounded-lg transition"
          style={{ background: "var(--sp-bg-muted)", color: "var(--sp-text-2)" }}
        >
          <X size={15} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold" style={{ color: "var(--sp-text)" }}>
            Practice Quiz
          </p>
          <p className="text-[10px]" style={{ color: "var(--sp-text-3)" }}>
            {visible.length} question{visible.length !== 1 ? "s" : ""}
            {mcqCount > 0 && ` · ${mcqCount} MCQ`}
            {theoryCount > 0 && ` · ${theoryCount} Theory`}
          </p>
        </div>
        {/* Progress */}
        <span className="text-xs font-semibold shrink-0" style={{ color: "var(--sp-text-3)" }}>
          {index + 1} / {visible.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 shrink-0" style={{ background: "var(--sp-bg-muted)" }}>
        <div
          className="h-full bg-indigo-500 transition-all duration-300"
          style={{ width: `${((index + 1) / visible.length) * 100}%` }}
        />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
        {q && (
          <SecureWrap userEmail={userEmail} enabled={isPaid}>
            <div
              className="rounded-2xl border p-5"
              style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
            >
              {/* Question meta */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <span className="text-xs font-bold text-indigo-500">
                  Question {q.question_number ?? index + 1}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                    q.question_type === "mcq"
                      ? "border-blue-500/20 bg-blue-500/10 text-blue-500"
                      : "border-slate-500/20 bg-slate-500/10 text-slate-500"
                  }`}
                >
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

              {q.question_type === "mcq" ? <PracticeMCQ q={q} /> : <PracticeTheory q={q} />}
            </div>
          </SecureWrap>
        )}

        {/* Gate banner */}
        {isGated && index === visible.length - 1 && (
          <div
            className="rounded-2xl border p-6 text-center"
            style={{ borderColor: "rgba(99,102,241,0.2)", background: "rgba(99,102,241,0.05)" }}
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl mx-auto mb-3"
              style={{ background: "rgba(99,102,241,0.12)" }}
            >
              <Lock className="h-4 w-4 text-indigo-500" />
            </div>
            <p className="text-sm font-semibold" style={{ color: "var(--sp-text)" }}>
              {hidden} more question{hidden !== 1 ? "s" : ""} locked
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--sp-text-3)" }}>
              Free plan limits practice to {FREE_PRACTICE_CAP} questions
            </p>
            <Link
              href="/dashboard/subscribe"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 transition"
            >
              <Crown className="h-3.5 w-3.5" />
              Unlock all questions
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </div>

      {/* Navigation footer */}
      <div
        className="flex items-center gap-3 px-4 py-3.5 border-t shrink-0"
        style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-card)" }}
      >
        <button
          onClick={() => setIndex(i => Math.max(0, i - 1))}
          disabled={index === 0}
          className="flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-xs font-semibold transition disabled:opacity-30"
          style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-muted)", color: "var(--sp-text-2)" }}
        >
          <ArrowLeft size={13} /> Prev
        </button>

        <div className="flex-1 flex justify-center gap-1.5 overflow-hidden">
          {visible.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className="h-1.5 rounded-full transition-all shrink-0"
              style={{
                width:      i === index ? "20px" : "6px",
                background: i === index ? "var(--sp-indigo, #6366f1)" : "var(--sp-border)",
              }}
            />
          ))}
        </div>

        <button
          onClick={() => setIndex(i => Math.min(visible.length - 1, i + 1))}
          disabled={index === visible.length - 1}
          className="flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-xs font-semibold transition disabled:opacity-30"
          style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-muted)", color: "var(--sp-text-2)" }}
        >
          Next <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// ── Submit solution section ───────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function SubmitSolutionSection({ questionId }: { questionId: string }) {
  const supabase = createClient();
  const router   = useRouter();

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [text, setText]               = useState("");
  const [file, setFile]               = useState<File | null>(null);
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      setSubsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/answers/my/${questionId}`,
          { headers: { Authorization: `Bearer ${session.access_token}` } },
        );
        if (res.ok) setSubmissions(await res.json());
      } finally {
        setSubsLoading(false);
      }
    }
    load();
  }, [questionId]);

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
      const newSub = await res.json();
      setSubmissions(prev => [{
        id: newSub.id,
        status: "pending",
        feedback: null,
        extracted_text: text.trim() || null,
        mime_type: file?.type ?? null,
        file_size: file?.size ?? null,
        created_at: new Date().toISOString(),
        reviewed_at: null,
      }, ...prev]);
      setText("");
      setFile(null);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {subsLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
        </div>
      ) : submissions.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold px-1" style={{ color: "var(--sp-text-3)" }}>
            Your submissions ({submissions.length})
          </p>
          {submissions.map(sub => (
            <div
              key={sub.id}
              className="rounded-2xl border p-4 space-y-3"
              style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
            >
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
                  {sub.extracted_text.length > 400 ? sub.extracted_text.slice(0, 400) + "…" : sub.extracted_text}
                </div>
              )}
              {sub.mime_type && !sub.extracted_text && (
                <div className="flex items-center gap-2 rounded-xl p-3 text-xs"
                  style={{ background: "var(--sp-bg-muted)", color: "var(--sp-text-3)" }}>
                  <Paperclip size={12} />
                  File attached ({sub.mime_type.split("/")[1].toUpperCase()}
                  {sub.file_size ? ` · ${(sub.file_size / 1024).toFixed(0)} KB` : ""})
                </div>
              )}
              {sub.status === "reviewed" && sub.feedback && (
                <div className="rounded-xl border p-3 space-y-1"
                  style={{ borderColor: "rgba(16,185,129,0.2)", background: "rgba(16,185,129,0.05)" }}>
                  <p className="text-[10px] font-semibold text-emerald-500">Feedback from SparkL</p>
                  <p className="text-sm leading-6 whitespace-pre-wrap" style={{ color: "var(--sp-text-2)" }}>
                    {sub.feedback}
                  </p>
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
      )}

      <div
        className="rounded-2xl border p-5 space-y-4"
        style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
      >
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--sp-text)" }}>
            {submissions.length > 0 ? "Submit another solution" : "Submit your solution"}
          </p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--sp-text-3)" }}>
            Share your worked answers for feedback.
          </p>
        </div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Type your solution here…"
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
              <button onClick={() => setFile(null)}>
                <X size={12} style={{ color: "var(--sp-text-3)" }} />
              </button>
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
          {submitting ? "Submitting…" : "Submit solution"}
        </button>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

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

  const [limits, setLimits] = useState<QuestionLimits>({
    is_paid: false, plan: "free", read_mode_percent: 100, practice_mode_max: null,
  });

  const [tab, setTab]               = useState<Tab>("text");
  const [showPractice, setShowPractice] = useState(false);
  const [showPreview, setShowPreview]   = useState(false);

  // ── Data load ──────────────────────────────────────────────────────────────
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
        setData(await detailRes.json());

        if (limitsRes.ok) {
          const d = await limitsRes.json();
          const plan   = (d.effective_plan ?? d.plan ?? "free").toLowerCase();
          const isPaid = d.is_paid === true || d.is_trial === true;
          setLimits({
            is_paid: isPaid, plan,
            read_mode_percent: d.read_mode_percent ?? 100,
            practice_mode_max: d.practice_mode_max ?? null,
          });
        }

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

  // ── Global print/copy block ────────────────────────────────────────────────
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

  // ── Guards ─────────────────────────────────────────────────────────────────
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
  const hasText      = !!(data.extracted_text?.trim());
  const hasProcessed = processedQuestions.length > 0;
  const mcqCount     = processedQuestions.filter(q => q.question_type === "mcq").length;
  const theoryCount  = processedQuestions.filter(q => q.question_type === "theory").length;

  return (
    <>
      {/* ── Practice full-screen modal ─────────────────────────────────── */}
      {showPractice && hasProcessed && (
        <PracticeModal
          questions={processedQuestions}
          isPaid={limits.is_paid}
          userEmail={userEmail}
          onClose={() => setShowPractice(false)}
        />
      )}

      <div
        className="min-h-screen px-4 py-8 sm:px-6 pb-28"
        style={{ background: "var(--sp-bg)" }}
      >
        <div className="mx-auto max-w-3xl">

          {/* Back link */}
          <Link
            href={data.course ? `/dashboard/courses/${data.course.id}` : "/dashboard"}
            className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
            style={{ color: "var(--sp-text-3)" }}
          >
            <ArrowLeft size={15} /> Back
          </Link>

          {/* ── Paper header card ──────────────────────────────────────── */}
          <div
            className="mt-4 rounded-2xl border p-5"
            style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
          >
            <div className="flex items-start gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "rgba(99,102,241,0.1)" }}
              >
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
              <div
                className="mt-4 flex items-start gap-2 rounded-xl border px-3 py-2.5"
                style={{ borderColor: "rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.06)" }}
              >
                <AlertCircle size={13} className="mt-0.5 shrink-0" style={{ color: "#f59e0b" }} />
                <p className="text-xs" style={{ color: "#f59e0b" }}>
                  This scan quality is low — some content may be unclear.
                </p>
              </div>
            )}

            {/* ── Tab bar ─────────────────────────────────────────────── */}
            <div
              className="mt-5 flex items-center gap-1 flex-wrap border-t pt-4"
              style={{ borderColor: "var(--sp-border)" }}
            >
              {hasText && (
                <TabBtn active={tab === "text"} onClick={() => setTab("text")}>
                  <BookOpen size={12} /> Read text
                  {!limits.is_paid && (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[8px] font-bold"
                      style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}
                    >
                      Preview
                    </span>
                  )}
                </TabBtn>
              )}

              {isPdf && (
                <TabBtn active={tab === "paper"} onClick={() => setTab("paper")}>
                  <FileText size={12} /> View paper
                  {!limits.is_paid && (
                    <Lock size={10} style={{ color: "var(--sp-text-3)" }} />
                  )}
                </TabBtn>
              )}

              <TabBtn active={tab === "submit"} onClick={() => setTab("submit")}>
                <Send size={12} /> Submit solution
              </TabBtn>

              {/* Question type stats — right aligned */}
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

          {/* ── Tab content ────────────────────────────────────────────── */}
          <div className="mt-4 space-y-4">

            {/* TEXT TAB — hero */}
            {tab === "text" && (
              hasText ? (
                <ExtractedTextHero
                  text={data.extracted_text!}
                  isPaid={limits.is_paid}
                  userEmail={userEmail}
                />
              ) : (
                <EmptyState
                  icon={<BookOpen size={22} className="text-indigo-400" />}
                  title="No extracted text yet"
                  body="Our team is still processing this paper. Check back shortly."
                />
              )
            )}

            {/* PAPER TAB */}
            {tab === "paper" && isPdf && (
              <div
                className="rounded-2xl border p-5"
                style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
              >
                {limits.is_paid ? (
                  <>
                    <button
                      onClick={() => setShowPreview(v => !v)}
                      className="flex items-center gap-2 mb-4 rounded-xl border px-4 py-2.5 text-sm font-semibold transition w-full justify-center"
                      style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-muted)", color: "var(--sp-text-2)" }}
                    >
                      {showPreview
                        ? <><EyeOff size={14} /> Hide paper preview</>
                        : <><Eye size={14} /> Show paper preview</>}
                    </button>
                    {showPreview && (
                      <SecureWrap userEmail={userEmail} enabled>
                        <InlinePaperViewer
                          questionId={questionId}
                          isPaid={limits.is_paid}
                          userEmail={userEmail}
                        />
                      </SecureWrap>
                    )}
                  </>
                ) : (
                  <GateBanner type="preview" hiddenCount={0} />
                )}
              </div>
            )}

            {tab === "paper" && !isPdf && (
              <EmptyState
                icon={<FileText size={22} className="text-indigo-400" />}
                title="No viewer for this file type"
                body="Switch to Read text to access the content."
              />
            )}

            {/* SUBMIT TAB */}
            {tab === "submit" && (
              <SubmitSolutionSection questionId={questionId} />
            )}

          </div>
        </div>
      </div>

      {/* ── Floating Practice Bubble ──────────────────────────────────── */}
      {(hasProcessed || questionsLoading) && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 px-4 w-full max-w-xs">
          {questionsLoading ? (
            <div
              className="flex items-center gap-3 rounded-2xl border px-5 py-3.5 shadow-xl backdrop-blur-sm"
              style={{
                background:   "var(--sp-bg-card)",
                borderColor:  "var(--sp-border)",
              }}
            >
              <Loader2 size={16} className="animate-spin text-indigo-500 shrink-0" />
              <span className="text-sm font-medium" style={{ color: "var(--sp-text-2)" }}>
                Loading questions…
              </span>
            </div>
          ) : (
            <button
              onClick={() => setShowPractice(true)}
              className="w-full flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-2xl transition active:scale-95"
              style={{
                background:  "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                boxShadow:   "0 8px 32px rgba(99,102,241,0.45)",
              }}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/20">
                <Play size={14} className="text-white" fill="white" />
              </div>
              <div className="text-left min-w-0 flex-1">
                <p className="text-sm font-bold text-white leading-none">
                  Take Quiz
                </p>
                <p className="text-[11px] text-indigo-200 mt-0.5">
                  {processedQuestions.length} question{processedQuestions.length !== 1 ? "s" : ""}
                  {mcqCount > 0 && ` · ${mcqCount} MCQ`}
                  {theoryCount > 0 && ` · ${theoryCount} Theory`}
                </p>
              </div>
              <Sparkles size={16} className="text-indigo-200 shrink-0" />
            </button>
          )}
        </div>
      )}
    </>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────────

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all"
      style={
        active
          ? { background: "#4f46e5", color: "#fff" }
          : { background: "var(--sp-bg-muted)", color: "var(--sp-text-3)" }
      }
    >
      {children}
    </button>
  );
}

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div
      className="rounded-2xl border p-10 text-center"
      style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
    >
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
        style={{ background: "rgba(99,102,241,0.1)" }}>
        {icon}
      </div>
      <p className="text-sm font-semibold" style={{ color: "var(--sp-text)" }}>{title}</p>
      <p className="mt-1 text-xs" style={{ color: "var(--sp-text-3)" }}>{body}</p>
    </div>
  );
}

function GateBanner({ hiddenCount, type }: { hiddenCount: number; type: "practice" | "preview" }) {
  return (
    <div className="rounded-2xl border p-6 text-center"
      style={{ borderColor: "rgba(99,102,241,0.2)", background: "rgba(99,102,241,0.05)" }}>
      <div className="flex justify-center mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: "rgba(99,102,241,0.12)" }}>
          <Lock className="h-4 w-4 text-indigo-500" />
        </div>
      </div>
      <p className="text-sm font-semibold" style={{ color: "var(--sp-text)" }}>
        {type === "practice"
          ? `${hiddenCount} more question${hiddenCount !== 1 ? "s" : ""} locked`
          : "Paper preview locked"}
      </p>
      <p className="mt-1 text-xs" style={{ color: "var(--sp-text-3)" }}>
        {type === "practice"
          ? `Free plan limits practice to ${FREE_PRACTICE_CAP} questions`
          : "Upgrade to view and download the original paper"}
      </p>
      <Link
        href="/dashboard/subscribe"
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 transition"
      >
        <Crown className="h-3.5 w-3.5" />
        Unlock — Basic, Pro or Premium
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
