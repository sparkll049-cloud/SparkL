"use client";

import { useEffect, useRef, useState } from "react";
import {
  FileText, Image as ImageIcon, Type, Upload, X, Send,
  Sparkles, BookOpen, Zap, AlignLeft, Loader2, RotateCcw, Trash2,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

// ── Types ──────────────────────────────────────────────────────────────────────

type Mode       = "chat" | "quiz" | "summary" | "explain";
type SourceType = "pdf" | "docx" | "image" | "text";

interface Message {
  role:    "user" | "assistant";
  content: string;
}

interface Session {
  id:          string;
  title:       string;
  source_type: SourceType;
  created_at:  string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const MODES: { id: Mode; label: string; icon: React.ReactNode; hint: string }[] = [
  { id: "chat",    label: "Chat",    icon: <Sparkles size={13} />,  hint: "Ask anything about your notes" },
  { id: "quiz",    label: "Quiz me", icon: <Zap size={13} />,       hint: "Generate practice questions" },
  { id: "summary", label: "Summary", icon: <AlignLeft size={13} />, hint: "Key points at a glance" },
  { id: "explain", label: "Explain", icon: <BookOpen size={13} />,  hint: "Break it down simply" },
];

const ACCEPTED = ".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg,.webp";

// ── Helpers ────────────────────────────────────────────────────────────────────

function sourceIcon(type: SourceType) {
  if (type === "pdf" || type === "docx") return <FileText size={13} className="text-indigo-400" />;
  if (type === "image")                  return <ImageIcon size={13} className="text-violet-400" />;
  return <Type size={13} className="text-slate-400" />;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

// ── Bubble ─────────────────────────────────────────────────────────────────────

function Bubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-7 whitespace-pre-wrap ${
          isUser ? "rounded-br-sm" : "rounded-bl-sm"
        }`}
        style={
          isUser
            ? { background: "var(--sp-indigo)", color: "#fff" }
            : { background: "var(--sp-bg-card)", color: "var(--sp-text)", border: "1px solid var(--sp-border)" }
        }
      >
        {msg.content}
      </div>
    </div>
  );
}

// ── Upload zone ────────────────────────────────────────────────────────────────

function UploadZone({
  file, onFile, onClear,
}: { file: File | null; onFile: (f: File) => void; onClear: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  }

  if (file) {
    return (
      <div
        className="flex items-center gap-3 rounded-xl border px-4 py-3"
        style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10">
          <FileText size={16} className="text-indigo-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate" style={{ color: "var(--sp-text)" }}>{file.name}</p>
          <p className="text-xs" style={{ color: "var(--sp-text-3)" }}>{(file.size / 1024).toFixed(0)} KB</p>
        </div>
        <button
          onClick={onClear}
          className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-red-500/10"
          style={{ color: "var(--sp-text-3)" }}
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDrop={onDrop}
      onDragOver={e => e.preventDefault()}
      className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed py-8 transition hover:border-indigo-500/40"
      style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-muted)" }}
    >
      <Upload size={20} className="text-indigo-400" />
      <p className="text-sm font-medium" style={{ color: "var(--sp-text-2)" }}>Drop your notes here</p>
      <p className="text-xs" style={{ color: "var(--sp-text-3)" }}>PDF, DOCX, image, or plain text · max 10 MB</p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function CramPage() {
  const supabase = createClient();

  const [sessions,        setSessions]        = useState<Session[]>([]);
  const [activeSession,   setActiveSession]   = useState<Session | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  const [file,         setFile]         = useState<File | null>(null);
  const [textContent,  setTextContent]  = useState("");
  const [inputMode,    setInputMode]    = useState<"file" | "text">("file");
  const [sessionTitle, setSessionTitle] = useState("");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input,    setInput]    = useState("");
  const [mode,     setMode]     = useState<Mode>("chat");
  const [sending,  setSending]  = useState(false);
  const [starting, setStarting] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadSessions(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function getToken(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not logged in");
    return session.access_token;
  }

  async function loadSessions() {
    setSessionsLoading(true);
    try {
      const token = await getToken();
      const res   = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/study/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setSessions(await res.json());
    } catch { /* non-critical */ } finally {
      setSessionsLoading(false);
    }
  }

  async function startSession() {
    if (!file && !textContent.trim()) return;
    if (!sessionTitle.trim()) return;

    setStarting(true);
    try {
      const token = await getToken();

      const sourceType: SourceType =
        inputMode === "text"            ? "text"
        : file?.type.startsWith("image/") ? "image"
        : file?.name.endsWith(".docx")    ? "docx"
        : "pdf";

      // Single session creation — bug fix: removed duplicate fetch
      const fd = new FormData();
      fd.append("title",       sessionTitle);
      fd.append("source_type", sourceType);

      const sessionRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/study/session`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}` },
        body:    fd,
      });

      if (!sessionRes.ok) throw new Error("Failed to create session");
      const session: Session = await sessionRes.json();

      setActiveSession(session);
      setSessions(s => [session, ...s]);

      // Clear messages first so history sent on first message is empty
      setMessages([]);

      await sendMessage(
        "Hello! I've shared my notes — please confirm you can see them.",
        session,
        [],   // empty history — fresh session
        true,
      );

    } catch (e) {
      alert(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setStarting(false);
    }
  }

  async function sendMessage(
    text:        string,
    session:     Session | null = activeSession,
    msgHistory:  Message[]     = messages,
    attachFile:  boolean       = false,
  ) {
    if (!text.trim() || !session) return;
    setSending(true);

    const userMsg: Message = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");

    try {
      const token = await getToken();
      const fd    = new FormData();

      fd.append("message", text);
      fd.append("mode",    mode);
      fd.append("history", JSON.stringify(msgHistory.slice(-12)));

      if (attachFile && file)        fd.append("file",         file);
      if (attachFile && textContent) fd.append("text_content", textContent);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/study/chat`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}` },
        body:    fd,
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ?? "Failed to get response");
      }

      // Stream
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

    } catch (e) {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: `Sorry, something went wrong: ${e instanceof Error ? e.message : "Unknown error"}` },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function deleteSession(id: string) {
    try {
      const token = await getToken();
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/study/sessions/${id}`, {
        method:  "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setSessions(s => s.filter(x => x.id !== id));
      if (activeSession?.id === id) {
        setActiveSession(null);
        setMessages([]);
      }
    } catch { /* non-critical */ }
  }

  function resetToNew() {
    setActiveSession(null);
    setMessages([]);
    setFile(null);
    setTextContent("");
    setSessionTitle("");
    setMode("chat");
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: "var(--sp-bg)" }}>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--sp-text)" }}>
              SparkL Cram ⚡
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--sp-text-3)" }}>
              Upload your notes — chat, quiz, summarise
            </p>
          </div>
          {activeSession && (
            <button
              onClick={resetToNew}
              className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition"
              style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)", background: "var(--sp-bg-muted)" }}
            >
              <RotateCcw size={12} /> New session
            </button>
          )}
        </div>

        {activeSession ? (
          <div className="flex flex-col gap-4">

            {/* Session info bar */}
            <div
              className="flex items-center gap-2 rounded-xl border px-4 py-2.5"
              style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
            >
              {sourceIcon(activeSession.source_type)}
              <span className="text-sm font-medium flex-1 truncate" style={{ color: "var(--sp-text-2)" }}>
                {activeSession.title}
              </span>
              <span
                className="text-[10px] rounded-full border px-2 py-0.5 font-medium"
                style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)" }}
              >
                {activeSession.source_type.toUpperCase()}
              </span>
            </div>

            {/* Mode selector */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {MODES.map(m => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  title={m.hint}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                    mode === m.id ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-400" : ""
                  }`}
                  style={mode !== m.id ? {
                    borderColor: "var(--sp-border)",
                    color: "var(--sp-text-3)",
                    background: "var(--sp-bg-muted)",
                  } : {}}
                >
                  {m.icon}{m.label}
                </button>
              ))}
            </div>

            {/* Messages */}
            <div
              className="rounded-2xl border p-4 min-h-[400px] max-h-[520px] overflow-y-auto"
              style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
            >
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-64 gap-3">
                  <Sparkles size={24} className="text-indigo-400" />
                  <p className="text-sm" style={{ color: "var(--sp-text-3)" }}>
                    Ask me anything about your notes
                  </p>
                </div>
              )}
              {messages.map((m, i) => <Bubble key={i} msg={m} />)}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div
              className="flex items-end gap-2 rounded-2xl border p-3"
              style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
            >
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(input);
                  }
                }}
                placeholder={
                  mode === "quiz"    ? "Press send to generate quiz questions…" :
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
                // Fix: quiz/summary enabled even with empty input
                disabled={sending || (mode === "chat" || mode === "explain" ? !input.trim() : false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              </button>
            </div>
          </div>

        ) : (

          /* New session setup */
          <div className="flex flex-col gap-5">

            {/* Title */}
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--sp-text-3)" }}>
                Session name
              </label>
              <input
                value={sessionTitle}
                onChange={e => setSessionTitle(e.target.value)}
                placeholder="e.g. Data Structures Week 3 Notes"
                className="w-full rounded-xl border px-4 py-3 text-sm bg-transparent outline-none"
                style={{ borderColor: "var(--sp-border)", color: "var(--sp-text)", background: "var(--sp-bg-card)" }}
              />
            </div>

            {/* Input mode toggle */}
            <div className="flex items-center gap-2">
              {(["file", "text"] as const).map(im => (
                <button
                  key={im}
                  onClick={() => setInputMode(im)}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    inputMode === im ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-400" : ""
                  }`}
                  style={inputMode !== im ? {
                    borderColor: "var(--sp-border)",
                    color: "var(--sp-text-3)",
                    background: "var(--sp-bg-muted)",
                  } : {}}
                >
                  {im === "file" ? <><Upload size={12} /> Upload file</> : <><Type size={12} /> Paste text</>}
                </button>
              ))}
            </div>

            {inputMode === "file" ? (
              <UploadZone file={file} onFile={setFile} onClear={() => setFile(null)} />
            ) : (
              <textarea
                value={textContent}
                onChange={e => setTextContent(e.target.value)}
                placeholder="Paste your notes here…"
                rows={8}
                className="w-full rounded-xl border px-4 py-3 text-sm bg-transparent resize-none outline-none leading-7"
                style={{ borderColor: "var(--sp-border)", color: "var(--sp-text)", background: "var(--sp-bg-card)" }}
              />
            )}

            {/* Start button */}
            <button
              onClick={startSession}
              disabled={starting || (!file && !textContent.trim()) || !sessionTitle.trim()}
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {starting
                ? <><Loader2 size={15} className="animate-spin" /> Starting…</>
                : <><Sparkles size={15} /> Start cramming</>
              }
            </button>

            {/* Past sessions */}
            {sessions.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-3" style={{ color: "var(--sp-text-3)" }}>
                  Recent sessions
                </p>
                <div className="space-y-2">
                  {sessions.map(s => (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition hover:border-indigo-500/30"
                      style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
                      onClick={() => { setActiveSession(s); setMessages([]); }}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10">
                        {sourceIcon(s.source_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--sp-text)" }}>{s.title}</p>
                        <p className="text-[10px]" style={{ color: "var(--sp-text-3)" }}>
                          {formatTime(s.created_at)} · {s.source_type.toUpperCase()}
                        </p>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); deleteSession(s.id); }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-red-500/10 hover:text-red-500"
                        style={{ color: "var(--sp-text-3)" }}
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