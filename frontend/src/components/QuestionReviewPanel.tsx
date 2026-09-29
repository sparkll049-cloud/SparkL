"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Play,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import AdminWatermarkedPreview from "@/components/AdminWatermarkedPreview";

type Paper = {
  id: string;
  title: string;
  year: string | null;
  status: "pending" | "approved" | "rejected";
  processing_status: string | null;
  extraction_quality: number | null;
  mime_type: string | null;
  created_at: string;
  rejection_reason: string | null;
  ai_processed?: boolean;
  course?: { name: string } | null;
  semester?: { name: string } | null;
  uploader?: { full_name: string | null } | null;
};

type ProcessedQuestion = {
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
  is_verified?: boolean;
};

const API = process.env.NEXT_PUBLIC_API_URL;

export default function QuestionReviewPanel() {
  const supabase = createClient();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [selected, setSelected] = useState<Paper | null>(null);
  const [items, setItems] = useState<ProcessedQuestion[]>([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  async function token() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Your session has expired. Please sign in again.");
    return session.access_token;
  }

  async function api(path: string, init?: RequestInit) {
    const accessToken = await token();
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(init?.headers ?? {}),
      },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.detail ?? "Request failed.");
    return body;
  }

  async function loadPapers(nextFilter = filter) {
    setLoading(true);
    setError("");
    try {
      const data = await api(`/api/admin/questions?status=${encodeURIComponent(nextFilter)}`);
      setPapers(Array.isArray(data) ? data : []);
      if (selected) {
        const refreshed = (data as Paper[]).find((paper) => paper.id === selected.id);
        if (refreshed) setSelected(refreshed);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load papers.");
    } finally {
      setLoading(false);
    }
  }

  async function loadQuestions(paper: Paper) {
    setSelected(paper);
    setError("");
    try {
      const data = await api(`/api/admin/questions/${paper.id}/processed-questions`);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : "Could not load generated questions.");
    }
  }

  useEffect(() => {
    loadPapers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function processWithGemini() {
    if (!selected) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await api(`/api/admin/questions/${selected.id}/process`, { method: "POST" });
      await loadQuestions(selected);
      setNotice("Questions generated successfully with Gemini.");
      await loadPapers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Question processing failed.");
    } finally {
      setWorking(false);
    }
  }

  async function updateStatus(status: "approved" | "rejected") {
    if (!selected) return;
    if (status === "rejected" && !rejectReason.trim()) {
      setError("Enter a rejection reason first.");
      return;
    }
    setWorking(true);
    setError("");
    try {
      await api(`/api/admin/questions/${selected.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          reason: status === "rejected" ? rejectReason.trim() : null,
        }),
      });
      setNotice(status === "approved" ? "Paper approved." : "Paper rejected.");
      setSelected(null);
      setItems([]);
      await loadPapers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status update failed.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[330px_1fr]">
      <aside className="rounded-2xl border p-4" style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold" style={{ color: "var(--sp-text)" }}>Past-question review</h2>
            <p className="text-xs" style={{ color: "var(--sp-text-3)" }}>Admin verification queue</p>
          </div>
          <button onClick={() => loadPapers()} className="rounded-lg p-2 hover:bg-indigo-500/10" title="Refresh">
            <RefreshCw size={15} className="text-indigo-500" />
          </button>
        </div>

        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className="mb-4 w-full rounded-lg border px-3 py-2 text-sm"
          style={{ background: "var(--sp-input-bg)", borderColor: "var(--sp-border)", color: "var(--sp-text)" }}
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>

        {loading && <div className="flex items-center gap-2 py-8 text-sm" style={{ color: "var(--sp-text-3)" }}><Loader2 size={16} className="animate-spin" /> Loading…</div>}
        {!loading && papers.length === 0 && <p className="py-8 text-center text-sm" style={{ color: "var(--sp-text-3)" }}>No papers in this queue.</p>}
        {!loading && papers.length > 0 && (
          <div className="space-y-2">
            {papers.map((paper) => (
              <button
                key={paper.id}
                onClick={() => loadQuestions(paper)}
                className="w-full rounded-xl border p-3 text-left transition hover:border-indigo-500/50"
                style={{
                  background: selected?.id === paper.id ? "rgba(99,102,241,0.08)" : "var(--sp-bg-muted)",
                  borderColor: selected?.id === paper.id ? "rgba(99,102,241,0.5)" : "var(--sp-border)",
                }}
              >
                <p className="truncate text-sm font-semibold" style={{ color: "var(--sp-text)" }}>{paper.title}</p>
                <p className="mt-1 text-[11px]" style={{ color: "var(--sp-text-3)" }}>
                  {paper.course?.name ?? "No course"}{paper.year ? ` · ${paper.year}` : ""}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-indigo-500">{paper.status}</p>
              </button>
            ))}
          </div>
        )}
      </aside>

      <main className="min-w-0">
        {error && <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</div>}
        {notice && <div className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-400"><CheckCircle2 size={16} className="mt-0.5 shrink-0" />{notice}</div>}

        {!selected ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center" style={{ borderColor: "var(--sp-border)" }}>
            <FileText size={28} className="mb-3 text-indigo-400" />
            <p className="text-sm font-semibold" style={{ color: "var(--sp-text)" }}>Select a paper to review</p>
            <p className="mt-1 text-xs" style={{ color: "var(--sp-text-3)" }}>The original will only be available through a watermarked admin preview.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <section className="rounded-2xl border p-5" style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-lg font-bold" style={{ color: "var(--sp-text)" }}>{selected.title}</h1>
                  <p className="mt-1 text-sm" style={{ color: "var(--sp-text-3)" }}>{selected.course?.name ?? "—"}{selected.year ? ` · ${selected.year}` : ""}</p>
                </div>
                <button onClick={() => setPreviewOpen(true)} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
                  Preview watermarked original
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button disabled={working} onClick={processWithGemini} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-50" style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-2)" }}>
                  <Play size={13} /> Generate questions with Gemini
                </button>
                {selected.status === "pending" && <button disabled={working} onClick={() => updateStatus("approved")} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><CheckCircle2 size={13} /> Approve</button>}
              </div>

              {selected.status === "pending" && (
                <div className="mt-4 flex gap-2">
                  <input value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Reason if rejecting" className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-xs" style={{ background: "var(--sp-input-bg)", borderColor: "var(--sp-border)", color: "var(--sp-text)" }} />
                  <button disabled={working} onClick={() => updateStatus("rejected")} className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-400 disabled:opacity-50"><XCircle size={13} /> Reject</button>
                </div>
              )}
            </section>

            <section className="rounded-2xl border p-5" style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
              <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-bold" style={{ color: "var(--sp-text)" }}>Generated questions</h2><span className="text-xs" style={{ color: "var(--sp-text-3)" }}>{items.length} items</span></div>
              {items.length === 0 ? <p className="py-8 text-center text-sm" style={{ color: "var(--sp-text-3)" }}>No generated questions yet.</p> : <div className="space-y-3">{items.map((item) => <article key={item.id} className="rounded-xl border p-4" style={{ borderColor: "var(--sp-border)" }}><div className="mb-2 flex items-center justify-between"><span className="text-xs font-bold text-indigo-500">Question {item.question_number}</span><span className="text-[10px] uppercase" style={{ color: "var(--sp-text-3)" }}>{item.question_type}</span></div><p className="whitespace-pre-wrap text-sm leading-6" style={{ color: "var(--sp-text)" }}>{item.question_text}</p>{item.question_type === "mcq" && <div className="mt-3 grid gap-2 sm:grid-cols-2">{(["a", "b", "c", "d"] as const).map((letter) => { const value = item[`option_${letter}`]; return value ? <div key={letter} className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-2)" }}><b className="mr-1 uppercase">{letter}.</b>{value}</div> : null; })}</div>}</article>)}</div>}
            </section>
          </div>
        )}
      </main>

      {selected && <AdminWatermarkedPreview questionId={selected.id} mimeType={selected.mime_type} open={previewOpen} onClose={() => setPreviewOpen(false)} />}
    </div>
  );
}