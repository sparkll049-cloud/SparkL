"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Send, Paperclip, X, Loader2, AlertCircle,
  CheckCircle2, Clock, Search, FileText,
  ArrowRight, ChevronRight, BookOpen,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PaperResult {
  id: string;
  title: string;
  year: number | null;
  course: { id: string; name: string } | null;
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function fmtSize(bytes: number | null) {
  if (!bytes) return "";
  return bytes > 1_048_576
    ? `${(bytes / 1_048_576).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

// ── Paper search dropdown ─────────────────────────────────────────────────────

function PaperSearch({
  onSelect,
  getToken,
}: {
  onSelect: (paper: PaperResult) => void;
  getToken: () => Promise<string | null>;
}) {
  const [query, setQuery]         = useState("");
  const [results, setResults]     = useState<PaperResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen]           = useState(false);
  const debounceRef               = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef                   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/questions/search?q=${encodeURIComponent(q)}&limit=10`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data.results ?? []);
        }
      } catch {}
      finally { setSearching(false); }
    }, 350);
  }, [query]);

  useEffect(() => {
    const h = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, []);

  return (
    <div className="relative" ref={wrapRef}>
      <div
        className="flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all"
        style={{
          borderColor: open ? "rgba(99,102,241,0.5)" : "var(--sp-border)",
          background: "var(--sp-bg-card)",
          boxShadow: open ? "0 0 0 3px rgba(99,102,241,0.10)" : "none",
        }}
      >
        <Search
          className="h-4 w-4 shrink-0 transition-colors"
          style={{ color: open ? "#6366F1" : "var(--sp-text-3)" }}
        />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search for a past question paper…"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          style={{ color: "var(--sp-text)" }}
        />
        {searching && <Loader2 className="h-4 w-4 animate-spin shrink-0 text-indigo-500" />}
        {query && !searching && (
          <button onClick={() => { setQuery(""); setResults([]); setOpen(false); }}>
            <X className="h-4 w-4" style={{ color: "var(--sp-text-3)" }} />
          </button>
        )}
      </div>

      {open && query.trim().length >= 2 && (
        <div
          className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border shadow-2xl"
          style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
        >
          {searching ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
              <span className="text-xs" style={{ color: "var(--sp-text-3)" }}>Searching…</span>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center py-8 gap-2">
              <FileText className="h-5 w-5 opacity-30" style={{ color: "var(--sp-text-3)" }} />
              <p className="text-xs" style={{ color: "var(--sp-text-3)" }}>
                No papers found for &ldquo;{query}&rdquo;
              </p>
            </div>
          ) : (
            <div className="max-h-[320px] overflow-y-auto p-2">
              {results.map(r => (
                <button
                  key={r.id}
                  onClick={() => {
                    onSelect(r);
                    setQuery("");
                    setResults([]);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-indigo-500/5"
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: "rgba(99,102,241,0.12)" }}
                  >
                    <FileText className="h-4 w-4 text-indigo-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold" style={{ color: "var(--sp-text)" }}>
                      {r.title}
                    </p>
                    <p className="text-[10px]" style={{ color: "var(--sp-text-3)" }}>
                      {r.course?.name ?? "—"}{r.year ? ` · ${r.year}` : ""}
                    </p>
                  </div>
                  <ChevronRight className="h-3 w-3 shrink-0 text-indigo-500" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Submission card ───────────────────────────────────────────────────────────

function SubmissionCard({ sub }: { sub: Submission }) {
  const isPending = sub.status === "pending";
  return (
    <div
      className="rounded-2xl border p-4 space-y-3"
      style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs" style={{ color: "var(--sp-text-3)" }}>
          {fmtDate(sub.created_at)}
        </span>
        {isPending ? (
          <span
            className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold"
            style={{
              borderColor: "rgba(245,158,11,0.25)",
              background: "rgba(245,158,11,0.08)",
              color: "#f59e0b",
            }}
          >
            <Clock className="h-2.5 w-2.5" /> Pending review
          </span>
        ) : (
          <span
            className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold text-emerald-500"
            style={{
              borderColor: "rgba(16,185,129,0.25)",
              background: "rgba(16,185,129,0.08)",
            }}
          >
            <CheckCircle2 className="h-2.5 w-2.5" /> Reviewed
          </span>
        )}
      </div>

      {sub.extracted_text && (
        <div
          className="rounded-xl p-3 text-sm leading-relaxed whitespace-pre-wrap"
          style={{ background: "var(--sp-bg-muted)", color: "var(--sp-text-2)" }}
        >
          {sub.extracted_text.length > 300
            ? sub.extracted_text.slice(0, 300) + "…"
            : sub.extracted_text}
        </div>
      )}

      {sub.mime_type && !sub.extracted_text && (
        <div
          className="flex items-center gap-2 rounded-xl p-3 text-xs"
          style={{ background: "var(--sp-bg-muted)", color: "var(--sp-text-3)" }}
        >
          <Paperclip className="h-3.5 w-3.5" />
          File attached ({sub.mime_type.split("/")[1]?.toUpperCase() ?? "FILE"}
          {sub.file_size ? ` · ${fmtSize(sub.file_size)}` : ""})
        </div>
      )}

      {!isPending && sub.feedback && (
        <div
          className="rounded-xl border p-3 space-y-1"
          style={{
            borderColor: "rgba(16,185,129,0.2)",
            background: "rgba(16,185,129,0.05)",
          }}
        >
          <p className="text-[10px] font-semibold text-emerald-500">
            Feedback from SparkL
          </p>
          <p
            className="text-sm leading-relaxed whitespace-pre-wrap"
            style={{ color: "var(--sp-text-2)" }}
          >
            {sub.feedback}
          </p>
        </div>
      )}

      {isPending && (
        <p className="text-[10px]" style={{ color: "var(--sp-text-3)" }}>
          Your submission is being reviewed. Check back soon.
        </p>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SubmitAnswersPage() {
  const supabase     = createClient();
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [selectedPaper, setSelectedPaper] = useState<PaperResult | null>(null);
  const [text, setText]                   = useState("");
  const [file, setFile]                   = useState<File | null>(null);
  const [submitting, setSubmitting]       = useState(false);
  const [submitError, setSubmitError]     = useState("");
  const [submitted, setSubmitted]         = useState(false);

  const [submissions, setSubmissions]     = useState<Submission[]>([]);
  const [subsLoading, setSubsLoading]     = useState(false);

  const [paperLoading, setPaperLoading]   = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    return session.access_token;
  }, [supabase]);

  useEffect(() => {
    const qid = searchParams.get("questionId");
    if (!qid) return;

    setPaperLoading(true);
    getToken().then(token => {
      if (!token) return;
      fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/questions/${qid}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) {
            setSelectedPaper({
              id: data.id,
              title: data.title,
              year: data.year ?? null,
              course: data.course ?? null,
            });
          }
        })
        .catch(() => {})
        .finally(() => setPaperLoading(false));
    });
  }, [searchParams, getToken]);

  useEffect(() => {
    if (!selectedPaper) { setSubmissions([]); return; }
    setSubsLoading(true);
    setSubmitted(false);
    getToken().then(token => {
      if (!token) return;
      fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/answers/my/${selectedPaper.id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
        .then(r => r.ok ? r.json() : [])
        .then(setSubmissions)
        .catch(() => {})
        .finally(() => setSubsLoading(false));
    });
  }, [selectedPaper, getToken]);

  async function handleSubmit() {
    if (!selectedPaper || (!text.trim() && !file)) return;
    setSubmitting(true);
    setSubmitError("");

    const token = await getToken();
    if (!token) { router.push("/auth/login"); return; }

    try {
      const formData = new FormData();
      formData.append("question_id", selectedPaper.id);
      if (text.trim()) formData.append("solution_text", text.trim());
      if (file) formData.append("file", file);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/answers/submit`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        },
      );

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || "Failed to submit. Please try again.");
      }

      const { id: newId } = await res.json();
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

      setSubmissions(prev => [newSub, ...prev]);
      setText("");
      setFile(null);
      setSubmitted(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = !!selectedPaper && (!!text.trim() || !!file) && !submitting;

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6" style={{ background: "var(--sp-bg)" }}>
      <div className="mx-auto max-w-2xl space-y-6">

        {/* Page header */}
        <div>
          <h1 className="text-2xl font-black" style={{ color: "var(--sp-text)" }}>
            Submit Answers
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--sp-text-3)" }}>
            Select a past question paper, write or attach your worked answers, and
            submit for feedback from the SparkL team.
          </p>
        </div>

        {/* Step 1 — Select paper */}
        <div
          className="rounded-2xl border p-5 space-y-4"
          style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-black text-white"
              style={{ background: "#6366F1" }}
            >
              1
            </div>
            <p className="text-sm font-bold" style={{ color: "var(--sp-text)" }}>
              Select a paper
            </p>
          </div>

          {paperLoading ? (
            <div className="flex items-center gap-2 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
              <span className="text-sm" style={{ color: "var(--sp-text-3)" }}>
                Loading paper…
              </span>
            </div>
          ) : selectedPaper ? (
            <div
              className="flex items-center gap-3 rounded-2xl border px-4 py-3"
              style={{
                borderColor: "rgba(99,102,241,0.4)",
                background: "rgba(99,102,241,0.06)",
              }}
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "rgba(99,102,241,0.15)" }}
              >
                <FileText className="h-4 w-4 text-indigo-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-sm font-bold"
                  style={{ color: "var(--sp-text)" }}
                >
                  {selectedPaper.title}
                </p>
                <p className="text-[11px]" style={{ color: "var(--sp-text-3)" }}>
                  {selectedPaper.course?.name ?? "—"}
                  {selectedPaper.year ? ` · ${selectedPaper.year}` : ""}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedPaper(null);
                  setSubmissions([]);
                  setSubmitted(false);
                }}
                className="shrink-0 rounded-lg p-1.5 transition hover:bg-red-500/10"
              >
                <X className="h-4 w-4" style={{ color: "var(--sp-text-3)" }} />
              </button>
            </div>
          ) : (
            <PaperSearch onSelect={setSelectedPaper} getToken={getToken} />
          )}

          {selectedPaper && (
            <Link
              href={`/questions/${selectedPaper.id}`}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-500 hover:underline"
            >
              <BookOpen className="h-3 w-3" />
              View this paper
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>

        {/* Step 2 — Write answers */}
        {selectedPaper && (
          <div
            className="rounded-2xl border p-5 space-y-4"
            style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
          >
            <div className="flex items-center gap-2">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-black text-white"
                style={{ background: "#6366F1" }}
              >
                2
              </div>
              <p className="text-sm font-bold" style={{ color: "var(--sp-text)" }}>
                {submissions.length > 0 ? "Submit another answer" : "Write your answers"}
              </p>
            </div>

            {submitted && (
              <div
                className="flex items-start gap-3 rounded-2xl border p-4"
                style={{
                  borderColor: "rgba(16,185,129,0.25)",
                  background: "rgba(16,185,129,0.07)",
                }}
              >
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-emerald-500">
                    Submitted successfully!
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--sp-text-3)" }}>
                    Your answers are being reviewed. You&apos;ll see feedback below once done.
                  </p>
                </div>
              </div>
            )}

            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Type your worked answers here…"
              rows={6}
              className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition resize-none"
              style={{
                borderColor: "var(--sp-border)",
                background: "var(--sp-bg-muted)",
                color: "var(--sp-text)",
              }}
            />

            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition"
                style={{
                  borderColor: "var(--sp-border)",
                  background: "var(--sp-bg-muted)",
                  color: "var(--sp-text-2)",
                }}
              >
                <Paperclip className="h-3.5 w-3.5" />
                {file ? "Change file" : "Attach file (image or PDF)"}
              </button>

              {file && (
                <div
                  className="flex items-center gap-2 rounded-xl border px-3 py-1.5"
                  style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-muted)" }}
                >
                  <span
                    className="truncate max-w-[180px] text-xs"
                    style={{ color: "var(--sp-text-2)" }}
                  >
                    {file.name}
                  </span>
                  <span className="text-[10px]" style={{ color: "var(--sp-text-3)" }}>
                    {fmtSize(file.size)}
                  </span>
                  <button onClick={() => setFile(null)}>
                    <X className="h-3.5 w-3.5" style={{ color: "var(--sp-text-3)" }} />
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
              <div
                className="flex items-start gap-2 rounded-xl border px-3 py-2.5"
                style={{
                  borderColor: "rgba(239,68,68,0.2)",
                  background: "rgba(239,68,68,0.05)",
                }}
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
                <p className="text-xs text-red-400">{submitError}</p>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
            >
              {submitting
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />}
              {submitting ? "Submitting…" : "Submit answers"}
            </button>
          </div>
        )}

        {/* Previous submissions */}
        {selectedPaper && (
          <div className="space-y-3">
            <p className="text-xs font-bold px-1" style={{ color: "var(--sp-text-3)" }}>
              {subsLoading
                ? "Loading your submissions…"
                : submissions.length === 0
                  ? "No previous submissions for this paper"
                  : `Your submissions (${submissions.length})`}
            </p>

            {subsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
              </div>
            ) : (
              submissions.map(sub => (
                <SubmissionCard key={sub.id} sub={sub} />
              ))
            )}
          </div>
        )}

        {/* Empty state */}
        {!selectedPaper && !paperLoading && (
          <div
            className="rounded-2xl border-2 border-dashed px-8 py-14 text-center"
            style={{ borderColor: "var(--sp-border)" }}
          >
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: "rgba(99,102,241,0.10)" }}
            >
              <Send className="h-6 w-6 text-indigo-500" />
            </div>
            <p className="text-sm font-bold" style={{ color: "var(--sp-text-2)" }}>
              Search for a paper above to get started
            </p>
            <p
              className="mt-2 max-w-[240px] mx-auto text-xs leading-relaxed"
              style={{ color: "var(--sp-text-3)" }}
            >
              Type the course name or paper title in the search box, select it,
              and submit your worked answers for feedback.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}