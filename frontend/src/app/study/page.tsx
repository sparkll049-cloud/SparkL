"use client";

import { useEffect, useRef, useState } from "react";
import {
  FileText, Image as ImageIcon, Type, Upload, X, Send,
  Sparkles, BookOpen, Zap, AlignLeft, Loader2, RotateCcw,
  Trash2, Crown, Lock, AlertTriangle, Link as LinkIcon,
  CheckCircle2, XCircle, Trophy, ArrowLeft, ChevronRight,
  Clock, Plus, Flame,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────────

type Mode       = "chat" | "quiz" | "summary" | "explain";
type SourceType = "pdf" | "docx" | "image" | "text" | "url";
type Plan       = "free" | "trial" | "pro" | "premium";

interface Message {
  role:    "user" | "assistant";
  content: string;
  isError?: boolean;
  quiz?:   QuizData;
}

interface QuizQuestion {
  type:        "mcq" | "theory";
  question:    string;
  options?:    string[];
  answer:      string;
  explanation: string;
}

interface QuizData {
  questions: QuizQuestion[];
}

interface Session {
  id:          string;
  title:       string;
  source_type: SourceType;
  created_at:  string;
}

interface CramLimits {
  plan:              Plan;
  cram_access:       boolean;
  cram_max_sessions: number | null;
  cram_modes:        Mode[];
  sessions_used:     number;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const MODES: { id: Mode; label: string; icon: React.ReactNode; hint: string }[] = [
  { id: "chat",    label: "Chat",    icon: <Sparkles size={12} />,  hint: "Ask anything about your notes" },
  { id: "summary", label: "Summary", icon: <AlignLeft size={12} />, hint: "Key points at a glance" },
  { id: "explain", label: "Explain", icon: <BookOpen size={12} />,  hint: "Break it down simply" },
  { id: "quiz",    label: "Quiz me", icon: <Zap size={12} />,       hint: "Generate practice questions" },
];

const ACCEPTED = ".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg,.webp";

const SOURCE_COLORS: Record<SourceType, string> = {
  pdf:   "text-red-400 bg-red-400/10",
  docx:  "text-blue-400 bg-blue-400/10",
  image: "text-violet-400 bg-violet-400/10",
  text:  "text-slate-400 bg-slate-400/10",
  url:   "text-emerald-400 bg-emerald-400/10",
};

// ── KaTeX ──────────────────────────────────────────────────────────────────────

let katexLoadPromise: Promise<void> | null = null;
function loadKaTeX(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as any).__katexReady) return Promise.resolve();
  if (katexLoadPromise) return katexLoadPromise;
  katexLoadPromise = new Promise((resolve) => {
    if (!document.getElementById("katex-css")) {
      const link = document.createElement("link");
      link.id = "katex-css"; link.rel = "stylesheet";
      link.href = "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css";
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js";
    script.onload = () => { (window as any).__katexReady = true; resolve(); };
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
  return katexLoadPromise;
}

function MathSpan({ tex, display }: { tex: string; display: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [ready, setReady] = useState((window as any).__katexReady ?? false);
  useEffect(() => { if (!ready) loadKaTeX().then(() => setReady(true)); }, [ready]);
  useEffect(() => {
    if (!ready || !ref.current) return;
    try { (window as any).katex.render(tex, ref.current, { throwOnError: false, displayMode: display }); }
    catch { if (ref.current) ref.current.textContent = tex; }
  }, [tex, display, ready]);
  if (!ready) return <span style={{ fontFamily: "monospace", fontSize: "0.8em", color: "var(--sp-text-3)", background: "var(--sp-bg-muted)", borderRadius: 4, padding: "1px 4px" }}>{tex}</span>;
  return <span ref={ref} style={display ? { display: "block", overflowX: "auto", margin: "8px 0", textAlign: "center" } : { display: "inline" }} />;
}

// ── Markdown ───────────────────────────────────────────────────────────────────

function splitInlineMath(text: string) {
  const re = /\\\((.+?)\\\)|\$([^$\n]+?)\$/g;
  const parts: Array<{ type: "text" | "inlineMath"; value: string }> = [];
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: "text", value: text.slice(last, m.index) });
    parts.push({ type: "inlineMath", value: m[1] ?? m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts;
}

function inlineFormat(text: string): React.ReactNode {
  return splitInlineMath(text).map((seg, si) => {
    if (seg.type === "inlineMath") return <MathSpan key={si} tex={seg.value} display={false} />;
    return seg.value.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) return <strong key={`${si}-${i}`}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("*")  && part.endsWith("*"))  return <em key={`${si}-${i}`}>{part.slice(1, -1)}</em>;
      if (part.startsWith("`")  && part.endsWith("`"))  return <code key={`${si}-${i}`} className="rounded px-1 py-0.5 text-xs font-mono" style={{ background: "var(--sp-bg-muted)" }}>{part.slice(1, -1)}</code>;
      return part;
    });
  });
}

function MarkdownContent({ text }: { text: string }) {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "\\[") {
      const mathLines: string[] = []; i++;
      while (i < lines.length && lines[i].trim() !== "\\]") { mathLines.push(lines[i]); i++; }
      i++;
      nodes.push(<div key={`m${i}`} style={{ overflowX: "auto", margin: "8px 0" }}><MathSpan tex={mathLines.join("\n")} display={true} /></div>);
      continue;
    }
    if (line.trim() === "$$") {
      const mathLines: string[] = []; i++;
      while (i < lines.length && lines[i].trim() !== "$$") { mathLines.push(lines[i]); i++; }
      i++;
      nodes.push(<div key={`m2${i}`} style={{ overflowX: "auto", margin: "8px 0" }}><MathSpan tex={mathLines.join("\n")} display={true} /></div>);
      continue;
    }
    const singleDollar = line.trim().match(/^\$\$(.+)\$\$$/);
    if (singleDollar) { nodes.push(<div key={`m3${i}`} style={{ overflowX: "auto", margin: "8px 0" }}><MathSpan tex={singleDollar[1]} display={true} /></div>); i++; continue; }
    const hm = line.match(/^(#{1,4})\s+(.+)/);
    if (hm) {
      const sizes = ["text-base font-bold mt-3 mb-1", "text-sm font-bold mt-2 mb-1", "text-sm font-semibold mt-2", "text-xs font-semibold mt-1"];
      nodes.push(<p key={i} className={sizes[hm[1].length - 1]} style={{ color: "var(--sp-text)" }}>{inlineFormat(hm[2])}</p>);
      i++; continue;
    }
    if (line.includes("|") && lines[i + 1]?.match(/^\|?[\s-]+\|/)) {
      const headers = line.split("|").map(h => h.trim()).filter(Boolean); i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|")) { rows.push(lines[i].split("|").map(c => c.trim()).filter(Boolean)); i++; }
      nodes.push(<div key={`t${i}`} className="my-2 overflow-x-auto rounded-xl border" style={{ borderColor: "var(--sp-border)" }}><table className="w-full text-xs"><thead><tr style={{ background: "var(--sp-bg-muted)" }}>{headers.map((h, hi) => <th key={hi} className="px-3 py-2 text-left font-semibold" style={{ color: "var(--sp-text-2)" }}>{inlineFormat(h)}</th>)}</tr></thead><tbody>{rows.map((row, ri) => <tr key={ri} style={{ borderTop: "1px solid var(--sp-border)" }}>{row.map((cell, ci) => <td key={ci} className="px-3 py-2" style={{ color: "var(--sp-text)" }}>{inlineFormat(cell)}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }
    if (line.match(/^---+$/)) { nodes.push(<hr key={i} className="my-2" style={{ borderColor: "var(--sp-border)" }} />); i++; continue; }
    if (line.match(/^[-*]\s+/)) { nodes.push(<div key={i} className="flex gap-2 my-0.5"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" /><p className="text-sm leading-7" style={{ color: "var(--sp-text)" }}>{inlineFormat(line.replace(/^[-*]\s+/, ""))}</p></div>); i++; continue; }
    const nm = line.match(/^(\d+)\.\s+(.+)/);
    if (nm) { nodes.push(<div key={i} className="flex gap-2 my-0.5"><span className="text-xs font-bold mt-1.5 text-indigo-400 shrink-0 w-4">{nm[1]}.</span><p className="text-sm leading-7" style={{ color: "var(--sp-text)" }}>{inlineFormat(nm[2])}</p></div>); i++; continue; }
    if (!line.trim()) { nodes.push(<div key={i} className="h-1.5" />); i++; continue; }
    nodes.push(<p key={i} className="text-sm leading-7" style={{ color: "var(--sp-text)" }}>{inlineFormat(line)}</p>);
    i++;
  }
  return <div className="space-y-0.5">{nodes}</div>;
}

// ── Quiz Card ──────────────────────────────────────────────────────────────────

function QuizCard({ quiz }: { quiz: QuizData }) {
  const [answers,   setAnswers]   = useState<Record<number, string>>({});
  const [theories,  setTheories]  = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score,     setScore]     = useState(0);

  const mcqCount = quiz.questions.filter(q => q.type === "mcq").length;

  function handleSubmit() {
    let correct = 0;
    quiz.questions.forEach((q, i) => {
      if (q.type === "mcq" && answers[i] === q.answer) correct++;
    });
    setScore(correct);
    setSubmitted(true);
  }

  const pct = submitted && mcqCount > 0 ? Math.round((score / mcqCount) * 100) : 0;

  return (
    <div className="rounded-2xl border overflow-hidden mt-2" style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--sp-border)", background: "linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.05) 100%)" }}>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/15">
            <Zap size={13} className="text-indigo-400" fill="currentColor" />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: "var(--sp-text)" }}>Practice Quiz</p>
            <p className="text-[10px]" style={{ color: "var(--sp-text-3)" }}>{quiz.questions.length} questions · {mcqCount} MCQ · {quiz.questions.length - mcqCount} theory</p>
          </div>
        </div>
        {submitted && (
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-sm font-black text-yellow-400 flex items-center gap-1"><Trophy size={12} /> {score}/{mcqCount}</p>
              <p className="text-[10px]" style={{ color: "var(--sp-text-3)" }}>{pct}% correct</p>
            </div>
          </div>
        )}
      </div>

      {/* Questions */}
      <div className="p-4 space-y-6">
        {quiz.questions.map((q, i) => {
          const isCorrect = q.type === "mcq" && submitted && answers[i] === q.answer;
          const isWrong   = q.type === "mcq" && submitted && !!answers[i] && answers[i] !== q.answer;

          return (
            <div key={i} className="space-y-2.5">
              <div className="flex gap-2.5">
                <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black mt-0.5" style={{ background: "var(--sp-bg-muted)", color: "var(--sp-text-3)", border: "1px solid var(--sp-border)" }}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <p className="text-sm font-semibold leading-6 flex-1" style={{ color: "var(--sp-text)" }}>{q.question}</p>
                    <span className={`text-[9px] font-bold rounded-full px-2 py-0.5 shrink-0 mt-1 ${q.type === "mcq" ? "bg-indigo-500/10 text-indigo-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                      {q.type === "mcq" ? "MCQ" : "THEORY"}
                    </span>
                  </div>
                </div>
              </div>

              {q.type === "mcq" && q.options && (
                <div className="ml-7 space-y-1.5">
                  {q.options.map((opt) => {
                    const isSelected = answers[i] === opt;
                    const isAnswer   = opt === q.answer;
                    let bg = "var(--sp-bg-muted)", border = "var(--sp-border)", color = "var(--sp-text-2)";
                    if (submitted) {
                      if (isAnswer)                     { bg = "rgba(16,185,129,0.08)"; border = "rgba(16,185,129,0.35)"; color = "#10b981"; }
                      else if (isSelected && !isAnswer) { bg = "rgba(239,68,68,0.06)";  border = "rgba(239,68,68,0.3)";   color = "#ef4444"; }
                    } else if (isSelected) {
                      bg = "rgba(99,102,241,0.1)"; border = "rgba(99,102,241,0.4)"; color = "#818cf8";
                    }
                    return (
                      <button key={opt} onClick={() => !submitted && setAnswers(a => ({ ...a, [i]: opt }))} disabled={submitted}
                        className="w-full text-left rounded-xl px-3 py-2 text-xs font-medium transition-all active:scale-[0.98]"
                        style={{ background: bg, border: `1px solid ${border}`, color }}
                      >
                        <span className="flex items-center gap-2">
                          {submitted && isAnswer   && <CheckCircle2 size={12} className="shrink-0 text-emerald-400" />}
                          {submitted && isSelected && !isAnswer && <XCircle size={12} className="shrink-0 text-red-400" />}
                          {(!submitted || (!isAnswer && !isSelected)) && (
                            <span className="shrink-0 h-4 w-4 rounded-full border flex items-center justify-center" style={{ borderColor: isSelected ? "#818cf8" : "var(--sp-border)" }}>
                              {isSelected && <span className="h-2 w-2 rounded-full bg-indigo-400" />}
                            </span>
                          )}
                          {opt}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {q.type === "theory" && (
                <div className="ml-7">
                  <textarea value={theories[i] ?? ""} onChange={e => !submitted && setTheories(t => ({ ...t, [i]: e.target.value }))}
                    disabled={submitted} placeholder="Write your answer here…" rows={3}
                    className="w-full rounded-xl border px-3 py-2.5 text-xs bg-transparent resize-none outline-none leading-6"
                    style={{ borderColor: "var(--sp-border)", color: "var(--sp-text)", background: "var(--sp-bg-muted)" }}
                  />
                </div>
              )}

              {submitted && (
                <div className="ml-7 rounded-xl px-3 py-2.5 space-y-1" style={{ background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.15)" }}>
                  {q.type === "mcq" ? (
                    <>
                      <p className={`text-[10px] font-black ${isCorrect ? "text-emerald-400" : isWrong ? "text-red-400" : "text-indigo-400"}`}>
                        {isCorrect ? "✓ Correct!" : isWrong ? "✗ Incorrect" : "✓ Correct answer"}
                      </p>
                      {!isCorrect && <p className="text-xs" style={{ color: "var(--sp-text-2)" }}><span className="font-semibold text-emerald-400">Answer: </span>{q.answer}</p>}
                    </>
                  ) : (
                    <>
                      <p className="text-[10px] font-black text-indigo-400">Model Answer</p>
                      <p className="text-xs" style={{ color: "var(--sp-text-2)" }}>{q.answer}</p>
                    </>
                  )}
                  <p className="text-xs italic" style={{ color: "var(--sp-text-3)" }}>{q.explanation}</p>
                </div>
              )}
            </div>
          );
        })}

        {!submitted ? (
          <button onClick={handleSubmit} className="w-full rounded-xl py-3 text-sm font-bold text-white transition-all active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)", boxShadow: "0 4px 15px rgba(99,102,241,0.3)" }}>
            Submit Answers
          </button>
        ) : (
          <div className="rounded-xl px-4 py-4 text-center space-y-1" style={{ background: pct === 100 ? "rgba(16,185,129,0.06)" : pct >= 60 ? "rgba(245,158,11,0.06)" : "rgba(239,68,68,0.06)", border: `1px solid ${pct === 100 ? "rgba(16,185,129,0.2)" : pct >= 60 ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.2)"}` }}>
            <p className="text-base font-black" style={{ color: pct === 100 ? "#10b981" : pct >= 60 ? "#f59e0b" : "#ef4444" }}>
              {pct === 100 ? "🎉 Perfect score!" : pct >= 60 ? "👏 Good job!" : "📚 Keep studying!"}
            </p>
            <p className="text-xs" style={{ color: "var(--sp-text-3)" }}>{score} of {mcqCount} MCQs correct · {pct}%</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function SourceIcon({ type, size = 13 }: { type: SourceType; size?: number }) {
  if (type === "url")                    return <LinkIcon size={size} />;
  if (type === "pdf" || type === "docx") return <FileText size={size} />;
  if (type === "image")                  return <ImageIcon size={size} />;
  return <Type size={size} />;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7)  return `${diffDays}d ago`;
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

function friendlyError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  if (/rate.?limit|too.?many|429|quota/i.test(raw)) return "The AI is on cooldown. Please wait a moment and try again.";
  if (/timeout|timed.?out|network|fetch/i.test(raw)) return "Network hiccup — check your connection and retry.";
  if (/5[0-9]{2}/.test(raw) || /server/i.test(raw)) return "The server had an issue. Hang on and retry.";
  if (/unauthori[sz]ed|401|403/i.test(raw)) return "Session expired — please refresh the page.";
  return raw || "Something went wrong. Please try again.";
}

// ── Message Bubble ─────────────────────────────────────────────────────────────

function Bubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";

  if (msg.quiz) {
    return (
      <div className="flex justify-start mb-4 flex-col gap-1">
        <div className="flex items-center gap-2 px-1">
          <div className="h-6 w-6 rounded-full flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}>
            <Zap size={11} className="text-white" fill="white" />
          </div>
          <p className="text-xs font-semibold text-indigo-400">SparkL Cram</p>
        </div>
        <div className="max-w-[96%] ml-8"><QuizCard quiz={msg.quiz} /></div>
      </div>
    );
  }

  if (msg.isError) {
    return (
      <div className="flex justify-start mb-4 gap-2">
        <div className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(239,68,68,0.1)" }}>
          <AlertTriangle size={11} className="text-red-400" />
        </div>
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3 space-y-1" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <p className="text-xs font-bold text-red-400">Couldn't get a response</p>
          <p className="text-sm leading-6" style={{ color: "var(--sp-text-2)" }}>{msg.content}</p>
        </div>
      </div>
    );
  }

  if (msg.content.startsWith("__QUIZ__:") || msg.content === "[Quiz requested]") return null;

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm px-4 py-3" style={{ background: "linear-gradient(135deg, #4f46e5 0%, #5b21b6 100%)" }}>
          <p className="text-sm leading-7 text-white">{msg.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mb-4 gap-2">
      <div className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}>
        <Sparkles size={11} className="text-white" />
      </div>
      <div className="max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3" style={{ background: "var(--sp-bg-card)", border: "1px solid var(--sp-border)" }}>
        <MarkdownContent text={msg.content} />
      </div>
    </div>
  );
}

// ── Upload Zone ────────────────────────────────────────────────────────────────

function UploadZone({ file, onFile, onClear }: { file: File | null; onFile: (f: File) => void; onClear: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border px-4 py-3.5" style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10"><FileText size={18} className="text-indigo-400" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate" style={{ color: "var(--sp-text)" }}>{file.name}</p>
          <p className="text-xs" style={{ color: "var(--sp-text-3)" }}>{(file.size / 1024).toFixed(0)} KB · Ready to upload</p>
        </div>
        <button onClick={onClear} className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-red-500/10" style={{ color: "var(--sp-text-3)" }}><X size={14} /></button>
      </div>
    );
  }
  return (
    <div onClick={() => inputRef.current?.click()}
      onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
      onDragOver={e => e.preventDefault()}
      className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed py-10 transition-all hover:border-indigo-500/40 hover:bg-indigo-500/[0.02] active:scale-[0.99]"
      style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-muted)" }}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10"><Upload size={20} className="text-indigo-400" /></div>
      <div className="text-center">
        <p className="text-sm font-semibold" style={{ color: "var(--sp-text-2)" }}>Drop your file here or tap to browse</p>
        <p className="text-xs mt-1" style={{ color: "var(--sp-text-3)" }}>PDF, DOCX, image, or plain text · max 10 MB</p>
      </div>
      <input ref={inputRef} type="file" accept={ACCEPTED} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
    </div>
  );
}

// ── Free Gate ──────────────────────────────────────────────────────────────────

function FreeGate() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center gap-6">
      <div className="relative">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl shadow-2xl" style={{ background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)", boxShadow: "0 20px 40px rgba(99,102,241,0.35)" }}>
          <Zap size={32} className="text-white" fill="white" />
        </div>
        <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-yellow-400 flex items-center justify-center">
          <Crown size={11} className="text-yellow-900" fill="currentColor" />
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-black" style={{ color: "var(--sp-text)" }}>SparkL Cram ⚡</h2>
        <p className="text-sm mt-1.5" style={{ color: "var(--sp-text-3)" }}>Your AI-powered study assistant</p>
      </div>

      <div className="w-full max-w-sm rounded-2xl border overflow-hidden" style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
        <div className="px-5 py-3 border-b" style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-muted)" }}>
          <p className="text-xs font-bold" style={{ color: "var(--sp-text-3)" }}>WHAT YOU GET</p>
        </div>
        <div className="p-5 space-y-3">
          {[
            { icon: "✓", text: "Chat with your notes",    tier: "Pro",     gold: false },
            { icon: "✓", text: "AI summaries",             tier: "Pro",     gold: false },
            { icon: "✓", text: "Concept explanations",     tier: "Pro",     gold: false },
            { icon: "✓", text: "YouTube & URL support",    tier: "Pro",     gold: false },
            { icon: "★", text: "Interactive quiz mode",   tier: "Premium", gold: true  },
            { icon: "★", text: "Unlimited sessions",      tier: "Premium", gold: true  },
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className={`text-sm font-bold shrink-0 ${f.gold ? "text-yellow-400" : "text-emerald-400"}`}>{f.icon}</span>
              <span className="text-sm flex-1 text-left" style={{ color: "var(--sp-text-2)" }}>{f.text}</span>
              <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0 ${f.gold ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20" : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"}`}>{f.tier}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="w-full max-w-sm space-y-3">
        <Link href="/dashboard/subscribe" className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black text-white transition-all hover:-translate-y-0.5 active:scale-[0.98] w-full"
          style={{ background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)", boxShadow: "0 8px 25px rgba(99,102,241,0.35)" }}>
          <Crown size={15} className="text-yellow-300" fill="currentColor" />
          Upgrade to access Cram
          <ChevronRight size={14} />
        </Link>
        <p className="text-xs" style={{ color: "var(--sp-text-3)" }}>Pro from ₦1,000/mo · Premium from ₦2,000/mo</p>
      </div>
    </div>
  );
}

// ── Session Card ───────────────────────────────────────────────────────────────

function SessionCard({ session, onOpen, onDelete }: { session: Session; onOpen: () => void; onDelete: (e: React.MouseEvent) => void }) {
  const colorClass = SOURCE_COLORS[session.source_type] ?? "text-slate-400 bg-slate-400/10";
  return (
    <div onClick={onOpen} className="group flex items-center gap-3 rounded-2xl border px-4 py-3.5 cursor-pointer transition-all hover:border-indigo-500/30 active:scale-[0.99]"
      style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${colorClass}`}>
        <SourceIcon type={session.source_type} size={15} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: "var(--sp-text)" }}>{session.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <Clock size={10} style={{ color: "var(--sp-text-3)" }} />
          <p className="text-[10px]" style={{ color: "var(--sp-text-3)" }}>{formatTime(session.created_at)}</p>
          <span className="text-[10px] font-bold rounded-full px-1.5 py-0.5" style={{ background: "var(--sp-bg-muted)", color: "var(--sp-text-3)" }}>{session.source_type.toUpperCase()}</span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={onDelete} className="flex h-7 w-7 items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition hover:bg-red-500/10 hover:text-red-400" style={{ color: "var(--sp-text-3)" }}>
          <Trash2 size={12} />
        </button>
        <ChevronRight size={14} className="text-indigo-400" />
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function CramPage() {
  const supabaseClient = createClient();

  const [limits,         setLimits]         = useState<CramLimits | null>(null);
  const [limitsLoading,  setLimitsLoading]  = useState(true);
  const [sessions,       setSessions]       = useState<Session[]>([]);
  const [activeSession,  setActiveSession]  = useState<Session | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [file,         setFile]         = useState<File | null>(null);
  const [textContent,  setTextContent]  = useState("");
  const [urlInput,     setUrlInput]     = useState("");
  const [inputMode,    setInputMode]    = useState<"file" | "text" | "url">("file");
  const [sessionTitle, setSessionTitle] = useState("");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input,    setInput]    = useState("");
  const [mode,     setMode]     = useState<Mode>("chat");
  const [sending,  setSending]  = useState(false);
  const [starting, setStarting] = useState(false);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { loadKaTeX(); }, []);
  useEffect(() => { loadLimitsAndSessions(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function getToken(): Promise<string> {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) throw new Error("Not logged in");
    return session.access_token;
  }

  async function loadLimitsAndSessions() {
    setLimitsLoading(true);
    try {
      const token = await getToken();
      const [limitsRes, sessionsRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/study/limits`,   { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/study/sessions`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (limitsRes.ok)   setLimits(await limitsRes.json());
      if (sessionsRes.ok) setSessions(await sessionsRes.json());
    } catch { }
    finally { setLimitsLoading(false); }
  }

  async function openSession(session: Session) {
    setActiveSession(session);
    setMessages([]);
    setHistoryLoading(true);
    try {
      const token = await getToken();
      const res   = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/study/sessions/${session.id}/messages`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const history: Array<{ role: string; content: string }> = await res.json();
        const hydrated: Message[] = history.map(m => {
          if (m.role === "assistant" && m.content.startsWith("__QUIZ__:")) {
            try {
              const quizData = JSON.parse(m.content.replace("__QUIZ__:", ""));
              return { role: "assistant", content: "", quiz: quizData };
            } catch { return { role: m.role as "user" | "assistant", content: m.content }; }
          }
          return { role: m.role as "user" | "assistant", content: m.content };
        });
        setMessages(hydrated);
      }
    } catch { }
    finally { setHistoryLoading(false); }
  }

  async function startSession() {
    const hasContent =
      (inputMode === "file" && !!file) ||
      (inputMode === "text" && !!textContent.trim()) ||
      (inputMode === "url"  && !!urlInput.trim());

    if (!hasContent || !sessionTitle.trim()) return;
    setStarting(true);

    try {
      const token = await getToken();
      let sourceType: SourceType = "text";
      if (inputMode === "url") {
        sourceType = "url";
      } else if (inputMode === "file" && file) {
        sourceType = file.type.startsWith("image/") ? "image" : file.name.endsWith(".docx") ? "docx" : "pdf";
      }

      const fd = new FormData();
      fd.append("title",       sessionTitle);
      fd.append("source_type", sourceType);
      if (inputMode === "file" && file)        fd.append("file",         file);
      if (inputMode === "text" && textContent) fd.append("text_content", textContent);
      if (inputMode === "url"  && urlInput)    fd.append("source_url",   urlInput.trim());

      const sessionRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/study/session`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
      });

      if (!sessionRes.ok) {
        const d = await sessionRes.json().catch(() => ({}));
        throw new Error(d.detail ?? "Failed to create session");
      }

      const session: Session = await sessionRes.json();
      setActiveSession(session);
      setSessions(s => [session, ...s]);
      setMessages([]);
      setLimits(prev => prev ? { ...prev, sessions_used: prev.sessions_used + 1 } : prev);

      const greeting =
        sourceType === "url"
          ? `I've linked this resource: ${urlInput.trim()} — please confirm you can read it and give me a quick summary.`
          : "Hello! I've uploaded my notes — please confirm you can see them and give me a quick summary of what's covered.";

      await sendMessage(greeting, session, [], sourceType === "image" ? file : undefined);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setStarting(false);
    }
  }

  async function sendMessage(
    text:       string,
    session:    Session | null = activeSession,
    msgHistory: Message[]     = messages,
    imageFile?: File | null,
  ) {
    if ((!text.trim() && mode !== "quiz") || !session) return;
    setSending(true);

    if (mode === "quiz") {
      setMessages(prev => [...prev, { role: "user", content: "Generate a practice quiz ⚡" }]);
      setInput("");
      try {
        const token = await getToken();
        const fd    = new FormData();
        fd.append("session_id", session.id);
        fd.append("message",    "Generate quiz");
        fd.append("mode",       "quiz");
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/study/chat`, {
          method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.detail ?? `Server error ${res.status}`);
        }
        const data = await res.json();
        if (data.type === "quiz" && data.data) {
          setMessages(prev => [...prev, { role: "assistant", content: "", quiz: data.data }]);
        } else {
          throw new Error("Invalid quiz response");
        }
      } catch (e) {
        setMessages(prev => [...prev, { role: "assistant", content: friendlyError(e), isError: true }]);
      } finally {
        setSending(false);
      }
      return;
    }

    const userMsg: Message = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");

    try {
      const token = await getToken();
      const fd    = new FormData();
      fd.append("session_id", session.id);
      fd.append("message",    text);
      fd.append("mode",       mode);
      if (imageFile) fd.append("file", imageFile);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/study/chat`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ?? `Server error ${res.status}`);
      }

      const reader  = res.body!.getReader();
      const decoder = new TextDecoder();
      let   aiText  = "";

      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        aiText += decoder.decode(value, { stream: true });
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: aiText };
          return updated;
        });
      }

      if (!aiText.trim()) {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: "No response received. Please try again.", isError: true };
          return updated;
        });
      }
    } catch (e) {
      setMessages(prev => {
        const updated = [...prev];
        const last    = updated[updated.length - 1];
        const errMsg: Message = { role: "assistant", content: friendlyError(e), isError: true };
        if (last?.role === "assistant" && !last.content && !last.isError) updated[updated.length - 1] = errMsg;
        else updated.push(errMsg);
        return updated;
      });
    } finally {
      setSending(false);
    }
  }

  async function deleteSession(id: string) {
    try {
      const token = await getToken();
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/study/sessions/${id}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      setSessions(s => s.filter(x => x.id !== id));
      if (activeSession?.id === id) { setActiveSession(null); setMessages([]); }
    } catch { }
  }

  function resetToNew() {
    setActiveSession(null); setMessages([]); setFile(null);
    setTextContent(""); setUrlInput(""); setSessionTitle(""); setMode("chat");
  }

  // ── Loading state ────────────────────────────────────────────────────────────

  if (limitsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center flex-col gap-3" style={{ background: "var(--sp-bg)" }}>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}>
          <Zap size={20} className="text-white" fill="white" />
        </div>
        <Loader2 size={20} className="animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!limits?.cram_access) {
    return (
      <div className="min-h-screen" style={{ background: "var(--sp-bg)" }}>
        {/* Nav */}
        <div className="sticky top-0 z-10 border-b px-4 py-3 flex items-center gap-3" style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg)" }}>
          <Link href="/dashboard" className="flex h-8 w-8 items-center justify-center rounded-xl transition hover:bg-indigo-500/10" style={{ color: "var(--sp-text-3)" }}>
            <ArrowLeft size={16} />
          </Link>
          <p className="text-sm font-bold" style={{ color: "var(--sp-text)" }}>SparkL Cram</p>
        </div>
        <div className="mx-auto max-w-lg px-4 py-4"><FreeGate /></div>
      </div>
    );
  }

  const isPro              = limits.plan === "pro";
  const isPremium          = limits.plan === "premium" || limits.plan === "trial";
  const sessionsLeft       = limits.cram_max_sessions !== null ? limits.cram_max_sessions - limits.sessions_used : null;
  const sessionCapReached  = sessionsLeft !== null && sessionsLeft <= 0;
  const hasContent =
    (inputMode === "file" && !!file) ||
    (inputMode === "text" && !!textContent.trim()) ||
    (inputMode === "url"  && !!urlInput.trim());

  // ── Active session view ──────────────────────────────────────────────────────

  if (activeSession) {
    return (
      <div className="flex flex-col min-h-screen" style={{ background: "var(--sp-bg)" }}>

        {/* Top nav */}
        <div className="sticky top-0 z-20 border-b px-4 py-3 flex items-center gap-3" style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg)", backdropFilter: "blur(12px)" }}>
          <button onClick={resetToNew} className="flex h-8 w-8 items-center justify-center rounded-xl transition hover:bg-indigo-500/10 shrink-0" style={{ color: "var(--sp-text-3)" }}>
            <ArrowLeft size={16} />
          </button>

          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${SOURCE_COLORS[activeSession.source_type]}`}>
            <SourceIcon type={activeSession.source_type} size={13} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate" style={{ color: "var(--sp-text)" }}>{activeSession.title}</p>
          </div>

          <Link href="/dashboard" className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition hover:bg-indigo-500/10 shrink-0" style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)" }}>
            Dashboard
          </Link>
        </div>

        {/* Mode selector */}
        <div className="border-b px-4 py-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar" style={{ borderColor: "var(--sp-border)" }}>
          {MODES.map(m => {
            const allowed  = limits.cram_modes.includes(m.id);
            const isActive = mode === m.id;
            return (
              <button key={m.id} onClick={() => allowed && setMode(m.id)} title={allowed ? m.hint : "Upgrade to Premium for Quiz mode"}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${!allowed ? "opacity-35 cursor-not-allowed" : "cursor-pointer active:scale-95"}`}
                style={isActive
                  ? { background: "rgba(99,102,241,0.12)", borderColor: "rgba(99,102,241,0.4)", color: "#818cf8" }
                  : { borderColor: "var(--sp-border)", color: "var(--sp-text-3)", background: "transparent" }
                }
              >
                {m.icon}{m.label}
                {!allowed && <Lock size={9} />}
              </button>
            );
          })}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {historyLoading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Loader2 size={20} className="animate-spin text-indigo-400" />
              <p className="text-xs" style={{ color: "var(--sp-text-3)" }}>Loading chat history…</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div className="h-12 w-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(99,102,241,0.1)" }}>
                <Sparkles size={20} className="text-indigo-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold" style={{ color: "var(--sp-text-2)" }}>Ready to help you study</p>
                <p className="text-xs mt-1" style={{ color: "var(--sp-text-3)" }}>Ask a question, request a summary, or tap Quiz me</p>
              </div>
            </div>
          ) : (
            <>
              {messages.map((m, i) => <Bubble key={i} msg={m} />)}
              {sending && (
                <div className="flex justify-start mb-4 gap-2">
                  <div className="h-6 w-6 rounded-full flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}>
                    <Sparkles size={11} className="text-white" />
                  </div>
                  <div className="rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1" style={{ background: "var(--sp-bg-card)", border: "1px solid var(--sp-border)" }}>
                    {[0, 150, 300].map(d => (
                      <span key={d} className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div className="border-t px-4 py-3" style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg)" }}>
          <div className="flex items-end gap-2 rounded-2xl border px-4 py-2.5" style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
              placeholder={
                mode === "quiz"    ? "Tap send to generate an interactive quiz ⚡" :
                mode === "summary" ? "Tap send for a summary of your notes…" :
                mode === "explain" ? "What concept should I explain?" :
                "Ask about your notes…"
              }
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm outline-none leading-6"
              style={{ color: "var(--sp-text)", caretColor: "#4f46e5", maxHeight: "120px" }}
              onInput={e => {
                const t = e.currentTarget;
                t.style.height = "auto";
                t.style.height = Math.min(t.scrollHeight, 120) + "px";
              }}
            />
            <button onClick={() => sendMessage(input)} disabled={sending || ((mode === "chat" || mode === "explain") && !input.trim())}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white transition-all active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}>
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
          <p className="text-[10px] text-center mt-2" style={{ color: "var(--sp-text-3)" }}>SparkL Cram can make mistakes — verify with your textbook</p>
        </div>
      </div>
    );
  }

  // ── New session / home view ──────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: "var(--sp-bg)" }}>

      {/* Top nav */}
      <div className="sticky top-0 z-20 border-b px-4 py-3 flex items-center gap-3" style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg)", backdropFilter: "blur(12px)" }}>
        <Link href="/dashboard" className="flex h-8 w-8 items-center justify-center rounded-xl transition hover:bg-indigo-500/10" style={{ color: "var(--sp-text-3)" }}>
          <ArrowLeft size={16} />
        </Link>
        <div className="flex items-center gap-2 flex-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl" style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}>
            <Zap size={13} className="text-white" fill="white" />
          </div>
          <p className="text-sm font-black" style={{ color: "var(--sp-text)" }}>SparkL Cram</p>
          <span className="rounded-full border px-2 py-0.5 text-[9px] font-bold text-amber-400 border-amber-400/30 bg-amber-400/10">BETA</span>
          {isPremium && <span className="rounded-full border px-2 py-0.5 text-[9px] font-bold text-yellow-400 border-yellow-400/30 bg-yellow-400/10 flex items-center gap-0.5"><Crown size={8} fill="currentColor" /> Premium</span>}
          {isPro     && <span className="rounded-full border px-2 py-0.5 text-[9px] font-bold text-indigo-400 border-indigo-400/30 bg-indigo-400/10">Pro</span>}
        </div>
        <Link href="/dashboard" className="text-xs font-semibold transition hover:text-indigo-400" style={{ color: "var(--sp-text-3)" }}>Dashboard</Link>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">

        {/* Stats bar */}
        {isPro && limits.cram_max_sessions && (
          <div className="flex items-center gap-3 rounded-2xl border px-4 py-3" style={{ background: "var(--sp-bg-card)", borderColor: sessionsLeft === 0 ? "rgba(239,68,68,0.3)" : "var(--sp-border)" }}>
            <Flame size={14} className={sessionsLeft === 0 ? "text-red-400" : "text-orange-400"} />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold" style={{ color: "var(--sp-text-2)" }}>
                  {sessionsLeft === 0 ? "Session limit reached" : `${sessionsLeft} session${sessionsLeft === 1 ? "" : "s"} remaining`}
                </p>
                <p className="text-[10px]" style={{ color: "var(--sp-text-3)" }}>{limits.sessions_used}/{limits.cram_max_sessions} used</p>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--sp-bg-muted)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${(limits.sessions_used / limits.cram_max_sessions!) * 100}%`, background: sessionsLeft === 0 ? "#ef4444" : "linear-gradient(90deg, #4f46e5, #7c3aed)" }} />
              </div>
            </div>
            {sessionsLeft !== null && sessionsLeft <= 1 && (
              <Link href="/dashboard/subscribe" className="flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-500 transition shrink-0">
                <Crown size={10} className="text-yellow-300" fill="currentColor" />Upgrade
              </Link>
            )}
          </div>
        )}

        {sessionCapReached ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border p-8 text-center" style={{ background: "var(--sp-bg-card)", borderColor: "rgba(239,68,68,0.2)" }}>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10"><Lock size={22} className="text-red-400" /></div>
            <div>
              <p className="text-base font-black" style={{ color: "var(--sp-text)" }}>Session limit reached</p>
              <p className="text-sm mt-1" style={{ color: "var(--sp-text-3)" }}>Pro plan includes 3 Cram sessions. Upgrade to Premium for unlimited sessions.</p>
            </div>
            <Link href="/dashboard/subscribe" className="flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-black text-white transition hover:-translate-y-0.5"
              style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)", boxShadow: "0 8px 20px rgba(99,102,241,0.3)" }}>
              <Crown size={14} className="text-yellow-300" fill="currentColor" /> Upgrade to Premium
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
            {/* Card header */}
            <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: "var(--sp-border)", background: "linear-gradient(135deg, rgba(99,102,241,0.05) 0%, rgba(139,92,246,0.03) 100%)" }}>
              <div className="flex items-center gap-2 mb-0.5">
                <Plus size={14} className="text-indigo-400" />
                <p className="text-sm font-black" style={{ color: "var(--sp-text)" }}>New session</p>
              </div>
              <p className="text-xs" style={{ color: "var(--sp-text-3)" }}>Upload notes, paste text, or link a YouTube video / article</p>
            </div>

            <div className="p-5 space-y-5">
              {/* Session title */}
              <div>
                <label className="text-[11px] font-bold mb-2 block uppercase tracking-wide" style={{ color: "var(--sp-text-3)" }}>Session name</label>
                <input value={sessionTitle} onChange={e => setSessionTitle(e.target.value)}
                  placeholder="e.g. Data Structures — Week 3 Notes"
                  className="w-full rounded-2xl border px-4 py-3 text-sm bg-transparent outline-none transition focus:border-indigo-500/50"
                  style={{ borderColor: "var(--sp-border)", color: "var(--sp-text)", background: "var(--sp-bg-muted)" }}
                />
              </div>

              {/* Input mode tabs */}
              <div>
                <label className="text-[11px] font-bold mb-2 block uppercase tracking-wide" style={{ color: "var(--sp-text-3)" }}>Content source</label>
                <div className="flex items-center gap-2 p-1 rounded-2xl" style={{ background: "var(--sp-bg-muted)" }}>
                  {(["file", "text", "url"] as const).map(im => (
                    <button key={im} onClick={() => setInputMode(im)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all"
                      style={inputMode === im
                        ? { background: "var(--sp-bg-card)", color: "var(--sp-text)", boxShadow: "0 1px 4px rgba(0,0,0,0.15)", border: "1px solid var(--sp-border)" }
                        : { color: "var(--sp-text-3)" }
                      }
                    >
                      {im === "file" ? <><Upload size={11} />File</> : im === "text" ? <><Type size={11} />Text</> : <><LinkIcon size={11} />URL</>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input area */}
              {inputMode === "file" && <UploadZone file={file} onFile={setFile} onClear={() => setFile(null)} />}

              {inputMode === "text" && (
                <textarea value={textContent} onChange={e => setTextContent(e.target.value)} placeholder="Paste your lecture notes, reading, or any study material here…" rows={7}
                  className="w-full rounded-2xl border px-4 py-3.5 text-sm bg-transparent resize-none outline-none leading-7 transition focus:border-indigo-500/50"
                  style={{ borderColor: "var(--sp-border)", color: "var(--sp-text)", background: "var(--sp-bg-muted)" }}
                />
              )}

              {inputMode === "url" && (
                <div className="rounded-2xl border overflow-hidden transition focus-within:border-indigo-500/50" style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-muted)" }}>
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <LinkIcon size={15} className="text-indigo-400 shrink-0" />
                    <input value={urlInput} onChange={e => setUrlInput(e.target.value)}
                      placeholder="https://youtube.com/watch?v=... or any article URL"
                      className="flex-1 bg-transparent text-sm outline-none"
                      style={{ color: "var(--sp-text)" }}
                    />
                    {urlInput && <button onClick={() => setUrlInput("")} style={{ color: "var(--sp-text-3)" }}><X size={14} /></button>}
                  </div>
                  <div className="px-4 pb-3 flex items-center gap-3 flex-wrap">
                    {["YouTube videos", "Web articles", "Lecture slides", "Wikipedia"].map(tag => (
                      <span key={tag} className="text-[10px] rounded-full px-2 py-0.5 font-medium" style={{ background: "var(--sp-bg-card)", color: "var(--sp-text-3)", border: "1px solid var(--sp-border)" }}>✓ {tag}</span>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={startSession} disabled={starting || !hasContent || !sessionTitle.trim()}
                className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black text-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: starting || !hasContent || !sessionTitle.trim() ? "var(--sp-bg-muted)" : "linear-gradient(135deg, #4f46e5, #7c3aed)", boxShadow: (!starting && hasContent && sessionTitle.trim()) ? "0 8px 20px rgba(99,102,241,0.3)" : "none" }}
              >
                {starting
                  ? <><Loader2 size={15} className="animate-spin" /> Starting session…</>
                  : <><Sparkles size={15} /> Start cramming</>
                }
              </button>
            </div>
          </div>
        )}

        {/* Past sessions */}
        {sessions.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--sp-text-3)" }}>Recent sessions</p>
              <p className="text-[10px]" style={{ color: "var(--sp-text-3)" }}>{sessions.length} total</p>
            </div>
            <div className="space-y-2">
              {sessions.map(s => (
                <SessionCard key={s.id} session={s}
                  onOpen={() => openSession(s)}
                  onDelete={e => { e.stopPropagation(); deleteSession(s.id); }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
