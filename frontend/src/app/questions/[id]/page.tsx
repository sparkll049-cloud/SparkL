"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, FileText, Loader2, AlertCircle,
  BookOpen, Zap, Play, RotateCcw, Lock, Sparkles,
  ChevronDown, Send, CheckCircle2,
  Paperclip, X, Clock, Eye, EyeOff, Crown,
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
  plan: string; // free | basic | pro | premium
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

type Tab = "view" | "read" | "practice" | "submit";


// ══════════════════════════════════════════════════════════════════════════════
// ── Anti-screenshot overlay ───────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function useAntiCapture(enabled: boolean) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    function onVisibility() {
      setHidden(document.visibilityState === "hidden");
    }
    function onBlur()  { setHidden(true);  }
    function onFocus() { setHidden(false); }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur",  onBlur);
    window.addEventListener("focus", onFocus);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur",  onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled]);

  return hidden;
}

interface ProtectedWrapProps {
  userEmail: string | null;
  children: React.ReactNode;
  enabled?: boolean;
}

function ProtectedWrap({ userEmail, children, enabled = true }: ProtectedWrapProps) {
  const hidden = useAntiCapture(enabled);

  if (!enabled) return <>{children}</>;

  return (
    <div className="relative select-none">
      {hidden && (
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-2xl"
          style={{ background: "var(--sp-bg-card)", backdropFilter: "blur(20px)" }}
        >
          <Lock className="h-8 w-8 text-indigo-500 mb-2" />
          <p className="text-sm font-bold" style={{ color: "var(--sp-text)" }}>
            Content hidden
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--sp-text-3)" }}>
            Return to SparkL to continue reading
          </p>
        </div>
      )}

      <div
        className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-2xl"
        aria-hidden
        style={{ userSelect: "none" }}
      >
        {Array.from({ length: 30 }).map((_, i) => (
          <span
            key={i}
            className="absolute text-[10px] font-bold opacity-[0.07] whitespace-nowrap"
            style={{
              top:       `${(i * 7) % 100}%`,
              left:      `${(i * 13) % 100}%`,
              transform: "rotate(-30deg)",
              color:     "var(--sp-text)",
              userSelect: "none",
              pointerEvents: "none",
            }}
          >
            SparkL · {userEmail ?? "protected"}
          </span>
        ))}
      </div>

      <div style={{ userSelect: "none", WebkitUserSelect: "none" }}>
        {children}
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// ── Extracted text (Read) tab ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function ExtractedTextView({
  text,
  isPaid,
  userEmail,
}: {
  text: string;
  isPaid: boolean;
  userEmail: string | null;
}) {
  const lines    = text.split("\n").filter(l => l.trim());
  const visible  = isPaid ? lines : lines.slice(0, FREE_TEXT_LINES);
  const hidden   = lines.length - visible.length;
  const isGated  = !isPaid && hidden > 0;

  return (
    <div className="space-y-3">
      <ProtectedWrap userEmail={userEmail} enabled={isPaid}>
        <div
          className="rounded-2xl border p-5 space-y-3"
          style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
        >
          <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: "var(--sp-border)" }}>
            <FileText size={14} className="text-indigo-400" />
            <p className="text-xs font-bold" style={{ color: "var(--sp-text-2)" }}>
              Extracted paper text
            </p>
            {!isPaid && (
              <span className="ml-auto rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-500">
                Preview only — {FREE_TEXT_LINES} lines
              </span>
            )}
          </div>

          <div className="space-y-2">
            {visible.map((line, i) => (
              <p
                key={i}
                className="text-sm leading-7 whitespace-pre-wrap"
                style={{ color: "var(--sp-text-2)" }}
              >
                {line}
              </p>
            ))}
          </div>

          {isGated && (
            <div
              className="relative -mt-10 pt-10"
              style={{
                background: "linear-gradient(to bottom, transparent, var(--sp-bg-card) 70%)",
              }}
            />
          )}
        </div>
      </ProtectedWrap>

      {isGated && (
        <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.06] p-6 text-center">
          <div className="flex justify-center mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15">
              <Crown className="h-4 w-4 text-indigo-500" />
            </div>
          </div>
          <p className="text-sm font-semibold" style={{ color: "var(--sp-text)" }}>
            {hidden} more line{hidden !== 1 ? "s" : ""} hidden
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--sp-text-3)" }}>
            Upgrade to Basic, Pro or Premium to read the full extracted text
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
// ── Practice components ───────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

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
        <div
          className="rounded-xl border p-4 space-y-1.5 mt-1"
          style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-muted)" }}
        >
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

function PracticeQuestion({ q, index }: { q: ProcessedQuestion; index: number }) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
    >
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
      {q.question_type === "mcq" ? <PracticeMCQ q={q} /> : <PracticeTheory q={q} />}
    </div>
  );
}

function GateBanner({ hiddenCount, type }: { hiddenCount: number; type: "practice" | "preview" }) {
  return (
    <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.06] p-6 text-center">
      <div className="flex justify-center mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15">
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
          { headers: { Authorization: `Bearer ${session.access_token}` } }
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
        { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` }, body: formData }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || "Failed to submit. Please try again.");
      }

      // ── FIX: resolve JSON before entering setState ──
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
          {submissions.map((sub) => (
            <div key={sub.id} className="rounded-2xl border p-4 space-y-3"
              style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs" style={{ color: "var(--sp-text-3)" }}>
                  {new Date(sub.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                </span>
                {sub.status === "reviewed" ? (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[10px] font-semibold text-emerald-500">
                    <CheckCircle2 size={10} /> Reviewed
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-[10px] font-semibold text-amber-500">
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
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-1">
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

      <div className="rounded-2xl border p-5 space-y-4"
        style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--sp-text)" }}>
            {submissions.length > 0 ? "Submit another solution" : "Submit your solution"}
          </p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--sp-text-3)" }}>
            Have answers or worked solutions? Share them here for feedback.
          </p>
        </div>

        <textarea
          value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Type your solution or answers here…" rows={5}
          className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition resize-none"
          style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-muted)", color: "var(--sp-text)" }}
        />

        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition"
            style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-muted)", color: "var(--sp-text-2)" }}>
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
          <input ref={fileRef} type="file" accept="image/*,application/pdf"
            className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>

        {submitError && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2.5">
            <AlertCircle size={13} className="mt-0.5 shrink-0 text-red-400" />
            <p className="text-xs text-red-400">{submitError}</p>
          </div>
        )}

        <button onClick={handleSubmit} disabled={(!text.trim() && !file) || submitting}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 transition disabled:opacity-40 disabled:cursor-not-allowed">
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

  const [data, setData]       = useState<QuestionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [processedQuestions, setProcessedQuestions] = useState<ProcessedQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading]     = useState(false);

  const [limits, setLimits] = useState<QuestionLimits>({
    is_paid: false, plan: "free", read_mode_percent: 100, practice_mode_max: null,
  });

  const [tab, setTab] = useState<Tab>("view");
  const [showPreview, setShowPreview] = useState(false);

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
          const plan = (d.effective_plan ?? d.plan ?? "free").toLowerCase();
          const isPaid = d.is_paid === true || d.is_trial === true;
          setLimits({
            is_paid: isPaid,
            plan,
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

  useEffect(() => {
    const style = document.createElement("style");
    style.id    = "sp-anticap";
    style.textContent = `
      .sp-protected { user-select: none; -webkit-user-select: none; }
      @media print { .sp-protected { filter: blur(20px) !important; } }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById("sp-anticap")?.remove(); };
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
  const hasText      = !!(data.extracted_text?.trim());

  const practiceCap      = FREE_PRACTICE_CAP;
  const visibleQuestions = !limits.is_paid
    ? processedQuestions.slice(0, practiceCap)
    : processedQuestions;
  const hiddenCount = processedQuestions.length - visibleQuestions.length;
  const isGated     = !limits.is_paid && hiddenCount > 0;

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6" style={{ background: "var(--sp-bg)" }}>
      <div className="mx-auto max-w-3xl">

        <Link
          href={data.course ? `/dashboard/courses/${data.course.id}` : "/dashboard"}
          className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
          style={{ color: "var(--sp-text-3)" }}
        >
          <ArrowLeft size={15} /> Back
        </Link>

        <div className="mt-4 rounded-2xl border p-5"
          style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10">
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
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
              <AlertCircle size={13} className="mt-0.5 shrink-0 text-amber-500" />
              <p className="text-xs text-amber-500">
                This scan quality is low — some content may be unclear.
              </p>
            </div>
          )}

          <div className="mt-5 flex items-center gap-1 flex-wrap border-t pt-4"
            style={{ borderColor: "var(--sp-border)" }}>

            {isPdf && (
              <button
                onClick={() => setTab("view")}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                  tab === "view" ? "bg-indigo-600 text-white" : ""
                }`}
                style={tab !== "view" ? { color: "var(--sp-text-3)", background: "var(--sp-bg-muted)" } : {}}
              >
                <FileText size={12} /> View paper
              </button>
            )}

            {hasText && (
              <button
                onClick={() => setTab("read")}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                  tab === "read" ? "bg-indigo-600 text-white" : ""
                }`}
                style={tab !== "read" ? { color: "var(--sp-text-3)", background: "var(--sp-bg-muted)" } : {}}
              >
                <BookOpen size={12} /> Read text
                {!limits.is_paid && (
                  <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[8px] font-bold text-amber-400">
                    Preview
                  </span>
                )}
              </button>
            )}

            {questionsLoading ? (
              <div className="flex items-center gap-1.5 px-3.5 py-2">
                <Loader2 size={12} className="animate-spin text-indigo-400" />
                <span className="text-xs" style={{ color: "var(--sp-text-3)" }}>Loading…</span>
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

            <button
              onClick={() => setTab("submit")}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                tab === "submit" ? "bg-indigo-600 text-white" : ""
              }`}
              style={tab !== "submit" ? { color: "var(--sp-text-3)", background: "var(--sp-bg-muted)" } : {}}
            >
              <Send size={12} /> Submit solution
            </button>

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

        <div className="mt-4 space-y-4">

          {tab === "view" && isPdf && (
            <div className="space-y-3">
              {limits.is_paid ? (
                <div className="rounded-2xl border p-5"
                  style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
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
                    <ProtectedWrap userEmail={userEmail} enabled>
                      <div className="sp-protected">
                        <InlinePaperViewer
                          questionId={questionId}
                          isPaid={limits.is_paid}
                          userEmail={userEmail}
                        />
                      </div>
                    </ProtectedWrap>
                  )}
                </div>
              ) : (
                <GateBanner hiddenCount={0} type="preview" />
              )}
            </div>
          )}

          {tab === "view" && !isPdf && (
            <div className="rounded-2xl border p-8 text-center"
              style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
              <FileText size={24} className="mx-auto mb-3 text-indigo-400" />
              <p className="text-sm font-semibold" style={{ color: "var(--sp-text)" }}>
                No viewer for this file type
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--sp-text-3)" }}>
                Switch to Read or Practice to access the content.
              </p>
            </div>
          )}

          {tab === "read" && hasText && (
            <ExtractedTextView
              text={data.extracted_text!}
              isPaid={limits.is_paid}
              userEmail={userEmail}
            />
          )}

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

                  <ProtectedWrap userEmail={userEmail} enabled>
                    <div className="sp-protected space-y-4">
                      {visibleQuestions.map((q, i) => (
                        <PracticeQuestion key={q.id} q={q} index={i} />
                      ))}
                    </div>
                  </ProtectedWrap>

                  {isGated && <GateBanner hiddenCount={hiddenCount} type="practice" />}
                </>
              ) : (
                <div className="rounded-2xl border p-10 text-center"
                  style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
                  <Sparkles size={24} className="mx-auto mb-3 text-violet-400" />
                  <p className="text-sm font-semibold" style={{ color: "var(--sp-text)" }}>
                    Practice questions not ready yet
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--sp-text-3)" }}>
                    Our team are currently processing this paper. Check back shortly.
                  </p>
                </div>
              )}
            </div>
          )}

          {tab === "submit" && (
            <SubmitSolutionSection questionId={questionId} />
          )}

        </div>
      </div>
    </div>
  );
}
