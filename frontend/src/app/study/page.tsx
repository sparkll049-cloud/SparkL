"use client";

import { useEffect, useRef, useState } from "react";
import {
  FileText, Image as ImageIcon, Type, Upload, X, Send,
  Sparkles, BookOpen, Zap, AlignLeft, Loader2, RotateCcw,
  Trash2, Crown, Lock, AlertTriangle, Link as LinkIcon,
  CheckCircle2, XCircle, Trophy,
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
  { id: "chat",    label: "Chat",    icon: <Sparkles size={13} />,  hint: "Ask anything about your notes" },
  { id: "quiz",    label: "Quiz me", icon: <Zap size={13} />,       hint: "Generate practice questions" },
  { id: "summary", label: "Summary", icon: <AlignLeft size={13} />, hint: "Key points at a glance" },
  { id: "explain", label: "Explain", icon: <BookOpen size={13} />,  hint: "Break it down simply" },
];

const ACCEPTED = ".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg,.webp";

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
      if (part.startsWith("*") && part.endsWith("*")) return <em key={`${si}-${i}`}>{part.slice(1, -1)}</em>;
      if (part.startsWith("`") && part.endsWith("`")) return <code key={`${si}-${i}`} className="rounded px-1 py-0.5 text-xs font-mono" style={{ background: "var(--sp-bg-muted)" }}>{part.slice(1, -1)}</code>;
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

  function handleSubmit() {
    let correct = 0;
    quiz.questions.forEach((q, i) => {
      if (q.type === "mcq" && answers[i] === q.answer) correct++;
    });
    setScore(correct);
    setSubmitted(true);
  }

  const mcqCount = quiz.questions.filter(q => q.type === "mcq").length;

  return (
    <div
      className="rounded-2xl border mt-2 overflow-hidden"
      style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-muted)" }}
      >
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-indigo-400" fill="currentColor" />
          <span className="text-sm font-bold" style={{ color: "var(--sp-text)" }}>
            Practice Quiz
          </span>
          <span
            className="text-[10px] rounded-full px-2 py-0.5 font-semibold"
            style={{ background: "var(--sp-bg-card)", color: "var(--sp-text-3)", border: "1px solid var(--sp-border)" }}
          >
            {quiz.questions.length} questions
          </span>
        </div>
        {submitted && (
          <div className="flex items-center gap-1.5">
            <Trophy size={13} className="text-yellow-400" />
            <span className="text-sm font-bold text-yellow-400">
              {score}/{mcqCount}
            </span>
          </div>
        )}
      </div>

      {/* Questions */}
      <div className="p-4 space-y-5">
        {quiz.questions.map((q, i) => {
          const userAnswer  = q.type === "mcq" ? answers[i] : theories[i];
          const isCorrect   = q.type === "mcq" && submitted && answers[i] === q.answer;
          const isWrong     = q.type === "mcq" && submitted && answers[i] && answers[i] !== q.answer;

          return (
            <div key={i} className="space-y-2">
              {/* Question */}
              <div className="flex gap-2">
                <span
                  className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold mt-0.5"
                  style={{ background: "var(--sp-bg-muted)", color: "var(--sp-text-3)" }}
                >
                  {i + 1}
                </span>
                <p className="text-sm font-semibold leading-6" style={{ color: "var(--sp-text)" }}>
                  {q.question}
                  <span
                    className="ml-2 text-[9px] font-bold rounded-full px-1.5 py-0.5 uppercase"
                    style={{
                      background: q.type === "mcq" ? "rgba(99,102,241,0.1)" : "rgba(16,185,129,0.1)",
                      color:      q.type === "mcq" ? "var(--sp-indigo)" : "#10b981",
                    }}
                  >
                    {q.type === "mcq" ? "MCQ" : "Theory"}
                  </span>
                </p>
              </div>

              {/* MCQ options */}
              {q.type === "mcq" && q.options && (
                <div className="ml-7 space-y-1.5">
                  {q.options.map((opt) => {
                    const isSelected = answers[i] === opt;
                    const isAnswer   = opt === q.answer;
                    let bg    = "var(--sp-bg-muted)";
                    let border = "var(--sp-border)";
                    let color  = "var(--sp-text-2)";

                    if (submitted) {
                      if (isAnswer)                        { bg = "rgba(16,185,129,0.1)"; border = "rgba(16,185,129,0.4)"; color = "#10b981"; }
                      else if (isSelected && !isAnswer)    { bg = "rgba(239,68,68,0.08)"; border = "rgba(239,68,68,0.3)"; color = "#ef4444"; }
                    } else if (isSelected) {
                      bg = "rgba(99,102,241,0.1)"; border = "rgba(99,102,241,0.4)"; color = "#818cf8";
                    }

                    return (
                      <button
                        key={opt}
                        onClick={() => !submitted && setAnswers(a => ({ ...a, [i]: opt }))}
                        disabled={submitted}
                        className="w-full text-left rounded-xl px-3 py-2 text-xs font-medium transition-all"
                        style={{ background: bg, border: `1px solid ${border}`, color }}
                      >
                        <span className="flex items-center gap-2">
                          {submitted && isAnswer   && <CheckCircle2 size={12} className="shrink-0 text-emerald-400" />}
                          {submitted && isSelected && !isAnswer && <XCircle size={12} className="shrink-0 text-red-400" />}
                          {(!submitted || (!isAnswer && !isSelected)) && (
                            <span
                              className="shrink-0 h-4 w-4 rounded-full border flex items-center justify-center"
                              style={{ borderColor: isSelected ? "#818cf8" : "var(--sp-border)" }}
                            >
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

              {/* Theory answer box */}
              {q.type === "theory" && (
                <div className="ml-7">
                  <textarea
                    value={theories[i] ?? ""}
                    onChange={e => !submitted && setTheories(t => ({ ...t, [i]: e.target.value }))}
                    disabled={submitted}
                    placeholder="Type your answer here…"
                    rows={3}
                    className="w-full rounded-xl border px-3 py-2 text-xs bg-transparent resize-none outline-none leading-6"
                    style={{ borderColor: "var(--sp-border)", color: "var(--sp-text)", background: "var(--sp-bg-muted)" }}
                  />
                </div>
              )}

              {/* Explanation (after submit) */}
              {submitted && (
                <div
                  className="ml-7 rounded-xl px-3 py-2.5"
                  style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}
                >
                  {q.type === "mcq" ? (
                    <>
                      <p className="text-[10px] font-bold text-indigo-400 mb-0.5">
                        {isCorrect ? "✓ Correct!" : isWrong ? "✗ Incorrect" : "Answer"}
                      </p>
                      <p className="text-xs" style={{ color: "var(--sp-text-2)" }}>
                        <span className="font-semibold text-emerald-400">Correct: </span>{q.answer}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-[10px] font-bold text-indigo-400 mb-0.5">Model Answer</p>
                      <p className="text-xs" style={{ color: "var(--sp-text-2)" }}>{q.answer}</p>
                    </>
                  )}
                  <p className="text-xs mt-1.5 italic" style={{ color: "var(--sp-text-3)" }}>
                    {q.explanation}
                  </p>
                </div>
              )}
            </div>
          );
        })}

        {/* Submit / Result */}
        {!submitted ? (
          <button
            onClick={handleSubmit}
            className="w-full rounded-xl py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition"
          >
            Submit Answers
          </button>
        ) : (
          <div
            className="rounded-xl px-4 py-3 text-center"
            style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)" }}
          >
            <p className="text-sm font-black text-emerald-400">
              {score === mcqCount ? "🎉 Perfect score!" : score >= mcqCount / 2 ? "👏 Good job!" : "📚 Keep studying!"}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--sp-text-3)" }}>
              You got {score} out of {mcqCount} MCQs correct
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function sourceIcon(type: SourceType) {
  if (type === "url")                    return <LinkIcon size={13} className="text-blue-400" />;
  if (type === "pdf" || type === "docx") return <FileText size={13} className="text-indigo-400" />;
  if (type === "image")                  return <ImageIcon size={13} className="text-violet-400" />;
  return <Type size={13} className="text-slate-400" />;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

function friendlyError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  if (/rate.?limit|too.?many|429|quota/i.test(raw)) return "The AI is on cooldown. Please wait a moment and try again.";
  if (/timeout|timed.?out|network|fetch/i.test(raw)) return "Network hiccup — check your connection and retry.";
  if (/5[0-9]{2}/.test(raw) || /server/i.test(raw)) return "The server had an issue. Hang on and retry.";
  if (/unauthori[sz]ed|401|403/i.test(raw)) return "Session expired — please refresh the page.";
  return raw || "Something went wrong. Please try again.";
}

// ── Bubble ─────────────────────────────────────────────────────────────────────

function Bubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";

  if (msg.quiz) {
    return (
      <div className="flex justify-start mb-3 flex-col">
        <div
          className="max-w-[95%] rounded-2xl rounded-bl-sm px-4 py-3"
          style={{ background: "var(--sp-bg-card)", border: "1px solid var(--sp-border)" }}
        >
          <p className="text-xs text-indigo-400 font-semibold mb-1">Here's your practice quiz ⚡</p>
        </div>
        <div className="max-w-[95%]">
          <QuizCard quiz={msg.quiz} />
        </div>
      </div>
    );
  }

  if (msg.isError) {
    return (
      <div className="flex justify-start mb-3">
        <div className="max-w-[88%] rounded-2xl rounded-bl-sm px-4 py-3 flex items-start gap-2" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
          <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-bold text-red-400 mb-0.5">Couldn't get a response</p>
            <p className="text-sm leading-6" style={{ color: "var(--sp-text-2)" }}>{msg.content}</p>
            <p className="text-[11px] mt-1.5" style={{ color: "var(--sp-text-3)" }}>The AI may be on cooldown — wait a moment and try again.</p>
          </div>
        </div>
      </div>
    );
  }

  // Skip __QUIZ__: messages (stored in DB, not shown as text)
  if (msg.content.startsWith("__QUIZ__:")) return null;
  // Skip "[Quiz requested]" user messages
  if (msg.content === "[Quiz requested]") return null;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[88%] rounded-2xl px-4 py-3 ${isUser ? "rounded-br-sm" : "rounded-bl-sm"}`}
        style={isUser ? { background: "var(--sp-indigo)", color: "#fff" } : { background: "var(--sp-bg-card)", border: "1px solid var(--sp-border)" }}
      >
        {isUser ? <p className="text-sm leading-7 text-white">{msg.content}</p> : <MarkdownContent text={msg.content} />}
      </div>
    </div>
  );
}

// ── Upload zone ────────────────────────────────────────────────────────────────

function UploadZone({ file, onFile, onClear }: { file: File | null; onFile: (f: File) => void; onClear: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-xl border px-4 py-3" style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10"><FileText size={16} className="text-indigo-400" /></div>
        <div className="min-w-0 flex-1"><p className="text-sm font-medium truncate" style={{ color: "var(--sp-text)" }}>{file.name}</p><p className="text-xs" style={{ color: "var(--sp-text-3)" }}>{(file.size / 1024).toFixed(0)} KB</p></div>
        <button onClick={onClear} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-red-500/10" style={{ color: "var(--sp-text-3)" }}><X size={14} /></button>
      </div>
    );
  }
  return (
    <div onClick={() => inputRef.current?.click()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f); }} onDragOver={e => e.preventDefault()} className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed py-8 transition hover:border-indigo-500/40" style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-muted)" }}>
      <Upload size={20} className="text-indigo-400" />
      <p className="text-sm font-medium" style={{ color: "var(--sp-text-2)" }}>Drop your notes here</p>
      <p className="text-xs" style={{ color: "var(--sp-text-3)" }}>PDF, DOCX, image, or plain text · max 10 MB</p>
      <input ref={inputRef} type="file" accept={ACCEPTED} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
    </div>
  );
}

// ── Free gate ──────────────────────────────────────────────────────────────────

function FreeGate() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-5">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30"><Zap size={28} className="text-white" fill="white" /></div>
      <div><h2 className="text-xl font-black" style={{ color: "var(--sp-text)" }}>SparkL Cram ⚡</h2><p className="text-sm mt-1" style={{ color: "var(--sp-text-3)" }}>AI-powered study assistant</p></div>
      <div className="w-full max-w-sm rounded-2xl border p-5 space-y-3" style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
        {[
          { icon: "✓", text: "Chat with your notes",       tier: "Pro",     premium: false },
          { icon: "✓", text: "Summarise any document",     tier: "Pro",     premium: false },
          { icon: "✓", text: "AI explanations",            tier: "Pro",     premium: false },
          { icon: "✓", text: "YouTube & URL support",      tier: "Pro",     premium: false },
          { icon: "★", text: "Interactive quiz mode",      tier: "Premium", premium: true  },
          { icon: "★", text: "Unlimited sessions",         tier: "Premium", premium: true  },
        ].map((f, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className={`text-sm font-bold ${f.premium ? "text-yellow-400" : "text-emerald-400"}`}>{f.icon}</span>
            <span className="text-sm flex-1 text-left" style={{ color: "var(--sp-text-2)" }}>{f.text}</span>
            <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${f.premium ? "bg-yellow-500/10 text-yellow-500" : "bg-indigo-500/10 text-indigo-400"}`}>{f.tier}</span>
          </div>
        ))}
      </div>
      <Link href="/dashboard/subscribe" className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-500 transition-all hover:-translate-y-0.5">
        <Crown size={15} className="text-yellow-300" fill="currentColor" />Upgrade to access Cram
      </Link>
      <p className="text-xs" style={{ color: "var(--sp-text-3)" }}>Pro from ₦1,000/mo · Premium from ₦2,000/mo</p>
    </div>
  );
}

function BetaBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="flex items-start gap-3 rounded-xl border px-4 py-3" style={{ background: "rgba(245,158,11,0.07)", borderColor: "rgba(245,158,11,0.25)" }}>
      <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-amber-400">SparkL Cram is in Beta ✦</p>
        <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: "var(--sp-text-3)" }}>AI can make mistakes — always verify answers with your lecturer or textbook.</p>
      </div>
      <button onClick={() => setDismissed(true)} style={{ color: "var(--sp-text-3)" }}><X size={13} /></button>
    </div>
  );
}

function SessionLimitBanner({ used, max }: { used: number; max: number }) {
  const remaining = max - used;
  if (remaining > 1) return null;
  return (
    <div className="flex items-center gap-3 rounded-xl border px-4 py-3" style={{ background: "rgba(99,102,241,0.06)", borderColor: "rgba(99,102,241,0.25)" }}>
      <Crown size={13} className="text-indigo-400 shrink-0" />
      <p className="text-xs flex-1" style={{ color: "var(--sp-text-2)" }}>
        {remaining === 0 ? "You've used all Pro sessions." : `${remaining} session left on Pro.`}{" "}
        <Link href="/dashboard/subscribe" className="text-indigo-400 font-bold hover:underline">Upgrade to Premium →</Link>
      </p>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function CramPage() {
  const supabase = createClient();

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

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadKaTeX(); }, []);
  useEffect(() => { loadLimitsAndSessions(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function getToken(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
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
        // Re-hydrate quiz messages from DB
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
      (inputMode === "file"  && file) ||
      (inputMode === "text"  && textContent.trim()) ||
      (inputMode === "url"   && urlInput.trim());

    if (!hasContent || !sessionTitle.trim()) return;

    setStarting(true);
    try {
      const token = await getToken();

      let sourceType: SourceType = "text";
      if (inputMode === "url") {
        sourceType = "url";
      } else if (inputMode === "file" && file) {
        sourceType = file.type.startsWith("image/") ? "image"
                   : file.name.endsWith(".docx")    ? "docx"
                   : "pdf";
      }

      const fd = new FormData();
      fd.append("title",       sessionTitle);
      fd.append("source_type", sourceType);
      if (inputMode === "file" && file)          fd.append("file",         file);
      if (inputMode === "text" && textContent)   fd.append("text_content", textContent);
      if (inputMode === "url"  && urlInput)      fd.append("source_url",   urlInput.trim());

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

    // Quiz mode — don't add a user bubble, handle separately
    if (mode === "quiz") {
      setMessages(prev => [...prev, { role: "user", content: "Generate a quiz for me ⚡" }]);
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

    // Normal streaming message
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

  if (limitsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--sp-bg)" }}>
        <Loader2 size={24} className="animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!limits?.cram_access) {
    return <div className="min-h-screen" style={{ background: "var(--sp-bg)" }}><div className="mx-auto max-w-lg px-4 py-6"><FreeGate /></div></div>;
  }

  const isPro             = limits.plan === "pro";
  const isPremium         = limits.plan === "premium" || limits.plan === "trial";
  const sessionsLeft      = limits.cram_max_sessions !== null ? limits.cram_max_sessions - limits.sessions_used : null;
  const sessionCapReached = sessionsLeft !== null && sessionsLeft <= 0;

  const hasContent =
    (inputMode === "file" && !!file) ||
    (inputMode === "text" && !!textContent.trim()) ||
    (inputMode === "url"  && !!urlInput.trim());

  return (
    <div className="min-h-screen" style={{ background: "var(--sp-bg)" }}>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black" style={{ color: "var(--sp-text)" }}>SparkL Cram ⚡</h1>
              <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold text-amber-400 border-amber-400/30 bg-amber-400/10">Beta</span>
              {isPremium && <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold text-yellow-400 border-yellow-400/30 bg-yellow-400/10 flex items-center gap-1"><Crown size={9} fill="currentColor" /> Premium</span>}
              {isPro     && <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold text-indigo-400 border-indigo-400/30 bg-indigo-400/10">Pro</span>}
            </div>
            <p className="text-xs mt-0.5" style={{ color: "var(--sp-text-3)" }}>Upload notes, paste text, or drop a YouTube/web link</p>
          </div>
          {activeSession && (
            <button onClick={resetToNew} className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition" style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)", background: "var(--sp-bg-muted)" }}>
              <RotateCcw size={12} /> New session
            </button>
          )}
        </div>

        <div className="mb-4"><BetaBanner /></div>

        {isPro && limits.cram_max_sessions && (
          <div className="mb-4"><SessionLimitBanner used={limits.sessions_used} max={limits.cram_max_sessions} /></div>
        )}

        {activeSession ? (
          <div className="flex flex-col gap-4">

            {/* Session bar */}
            <div className="flex items-center gap-2 rounded-xl border px-4 py-2.5" style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
              {sourceIcon(activeSession.source_type)}
              <span className="text-sm font-medium flex-1 truncate" style={{ color: "var(--sp-text-2)" }}>{activeSession.title}</span>
              <span className="text-[10px] rounded-full border px-2 py-0.5 font-medium" style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)" }}>{activeSession.source_type.toUpperCase()}</span>
            </div>

            {/* Mode selector */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {MODES.map(m => {
                const allowed  = limits.cram_modes.includes(m.id);
                const isActive = mode === m.id;
                return (
                  <button key={m.id} onClick={() => allowed && setMode(m.id)} title={allowed ? m.hint : "Upgrade to Premium for Quiz mode"}
                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${isActive ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-400" : ""} ${!allowed ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                    style={!isActive ? { borderColor: "var(--sp-border)", color: "var(--sp-text-3)", background: "var(--sp-bg-muted)" } : {}}
                  >
                    {m.icon}{m.label}{!allowed && <Lock size={10} className="ml-0.5" />}
                  </button>
                );
              })}
            </div>

            {/* Messages */}
            <div className="rounded-2xl border p-4 min-h-[400px] max-h-[520px] overflow-y-auto" style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
              {historyLoading ? (
                <div className="flex items-center justify-center h-64 gap-2"><Loader2 size={18} className="animate-spin text-indigo-400" /><p className="text-sm" style={{ color: "var(--sp-text-3)" }}>Loading chat history…</p></div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 gap-3"><Sparkles size={24} className="text-indigo-400" /><p className="text-sm" style={{ color: "var(--sp-text-3)" }}>Ask me anything about your notes</p></div>
              ) : (
                messages.map((m, i) => <Bubble key={i} msg={m} />)
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="flex items-end gap-2 rounded-2xl border p-3" style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                placeholder={
                  mode === "quiz"    ? "Press send to generate an interactive quiz…" :
                  mode === "summary" ? "Press send to get a summary…" :
                  mode === "explain" ? "What topic should I explain?" :
                  "Ask something about your notes…"
                }
                rows={2}
                className="flex-1 resize-none bg-transparent text-sm outline-none leading-6"
                style={{ color: "var(--sp-text)", caretColor: "var(--sp-indigo)" }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={sending || ((mode === "chat" || mode === "explain") && !input.trim())}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              </button>
            </div>
          </div>

        ) : (
          <div className="flex flex-col gap-5">

            {sessionCapReached ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border p-6 text-center" style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
                <Lock size={24} className="text-indigo-400" />
                <div>
                  <p className="text-sm font-bold" style={{ color: "var(--sp-text)" }}>Session limit reached</p>
                  <p className="text-xs mt-1" style={{ color: "var(--sp-text-3)" }}>Pro plan includes 3 Cram sessions. Upgrade to Premium for unlimited.</p>
                </div>
                <Link href="/dashboard/subscribe" className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white hover:bg-indigo-500 transition">
                  <Crown size={13} className="text-yellow-300" fill="currentColor" /> Upgrade to Premium
                </Link>
              </div>
            ) : (
              <>
                {/* Session title */}
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--sp-text-3)" }}>Session name</label>
                  <input value={sessionTitle} onChange={e => setSessionTitle(e.target.value)} placeholder="e.g. Data Structures Week 3 Notes"
                    className="w-full rounded-xl border px-4 py-3 text-sm bg-transparent outline-none"
                    style={{ borderColor: "var(--sp-border)", color: "var(--sp-text)", background: "var(--sp-bg-card)" }}
                  />
                </div>

                {/* Input mode tabs */}
                <div className="flex items-center gap-2">
                  {(["file", "text", "url"] as const).map(im => (
                    <button key={im} onClick={() => setInputMode(im)}
                      className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${inputMode === im ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-400" : ""}`}
                      style={inputMode !== im ? { borderColor: "var(--sp-border)", color: "var(--sp-text-3)", background: "var(--sp-bg-muted)" } : {}}
                    >
                      {im === "file" ? <><Upload size={12} /> Upload file</>
                       : im === "text" ? <><Type size={12} /> Paste text</>
                       : <><LinkIcon size={12} /> YouTube / URL</>}
                    </button>
                  ))}
                </div>

                {/* Input area */}
                {inputMode === "file" && (
                  <UploadZone file={file} onFile={setFile} onClear={() => setFile(null)} />
                )}

                {inputMode === "text" && (
                  <textarea value={textContent} onChange={e => setTextContent(e.target.value)} placeholder="Paste your notes here…" rows={8}
                    className="w-full rounded-xl border px-4 py-3 text-sm bg-transparent resize-none outline-none leading-7"
                    style={{ borderColor: "var(--sp-border)", color: "var(--sp-text)", background: "var(--sp-bg-card)" }}
                  />
                )}

                {inputMode === "url" && (
                  <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-card)" }}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <LinkIcon size={16} className="text-indigo-400 shrink-0" />
                      <input
                        value={urlInput}
                        onChange={e => setUrlInput(e.target.value)}
                        placeholder="https://youtube.com/watch?v=... or any web URL"
                        className="flex-1 bg-transparent text-sm outline-none"
                        style={{ color: "var(--sp-text)" }}
                      />
                      {urlInput && <button onClick={() => setUrlInput("")} style={{ color: "var(--sp-text-3)" }}><X size={14} /></button>}
                    </div>
                    <div className="px-4 pb-3">
                      <p className="text-[11px]" style={{ color: "var(--sp-text-3)" }}>
                        ✓ YouTube videos &nbsp;·&nbsp; ✓ Web articles &nbsp;·&nbsp; ✓ Lecture slides online &nbsp;·&nbsp; ✓ Wikipedia pages
                      </p>
                    </div>
                  </div>
                )}

                {isPro && limits.cram_max_sessions && (
                  <p className="text-xs text-center" style={{ color: "var(--sp-text-3)" }}>
                    {sessionsLeft} of {limits.cram_max_sessions} sessions remaining on Pro
                  </p>
                )}

                <button onClick={startSession} disabled={starting || !hasContent || !sessionTitle.trim()}
                  className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {starting ? <><Loader2 size={15} className="animate-spin" /> Starting…</> : <><Sparkles size={15} /> Start cramming</>}
                </button>
              </>
            )}

            {/* Past sessions */}
            {sessions.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-3" style={{ color: "var(--sp-text-3)" }}>Recent sessions</p>
                <div className="space-y-2">
                  {sessions.map(s => (
                    <div key={s.id} className="flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition hover:border-indigo-500/30"
                      style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }} onClick={() => openSession(s)}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10">{sourceIcon(s.source_type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--sp-text)" }}>{s.title}</p>
                        <p className="text-[10px]" style={{ color: "var(--sp-text-3)" }}>{formatTime(s.created_at)} · {s.source_type.toUpperCase()}</p>
                      </div>
                      <button onClick={e => { e.stopPropagation(); deleteSession(s.id); }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-red-500/10 hover:text-red-500" style={{ color: "var(--sp-text-3)" }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}