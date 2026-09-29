"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Eye, Loader2, Play, ShieldCheck } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import AdminWatermarkedPreview from "@/components/AdminWatermarkedPreview";

type Props = {
  paperId: string;
  mimeType?: string | null;
};

type Question = {
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

export default function QuestionReviewPanel({ paperId, mimeType }: Props) {
  const supabase = createClient();
  const [items, setItems] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function request(path: string, init?: RequestInit) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Your admin session has expired.");
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        ...(init?.headers ?? {}),
      },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.detail ?? "Request failed.");
    return body;
  }

  async function loadQuestions() {
    setLoading(true);
    setError("");
    try {
      const data = await request(`/api/admin/questions/${paperId}/processed-questions`);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load questions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperId]);

  async function processWithGemini() {
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await request(`/api/admin/questions/${paperId}/process`, { method: "POST" });
      await loadQuestions();
      setNotice("Questions generated with Gemini.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gemini processing failed.");
    } finally {
      setWorking(false);
    }
  }

  async function verifyAll() {
    setWorking(true);
    setError("");
    try {
      await request(`/api/admin/questions/${paperId}/verify-all`, { method: "POST" });
      setItems((current) => current.map((item) => ({ ...item, is_verified: true })));
      setNotice("All generated questions marked as verified.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button onClick={() => setPreviewOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-400 hover:bg-blue-500/20">
            <Eye size={13} /> Preview watermarked file
          </button>
          <button onClick={processWithGemini} disabled={working} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-400 hover:bg-violet-500/20 disabled:opacity-50">
            {working ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} Generate with Gemini
          </button>
        </div>
        {items.length > 0 && <button onClick={verifyAll} disabled={working} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50"><ShieldCheck size={13} /> Verify all</button>}
      </div>

      {error && <p className="flex items-start gap-1.5 text-xs text-red-400"><AlertCircle size={14} className="mt-0.5 shrink-0" />{error}</p>}
      {notice && <p className="flex items-start gap-1.5 text-xs text-emerald-400"><CheckCircle2 size={14} className="mt-0.5 shrink-0" />{notice}</p>}

      {loading && <div className="flex items-center gap-2 py-5 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" /> Loading generated questions…</div>}
      {!loading && !error && items.length === 0 && <p className="py-5 text-xs text-slate-500">No generated questions yet. Click Generate with Gemini after checking the extracted text.</p>}

      {!loading && items.length > 0 && <div className="space-y-3">
        {items.map((item) => <article key={item.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-violet-400">Question {item.question_number}</span>
            <span className="flex items-center gap-1 text-[10px] uppercase text-slate-500">{item.question_type}{item.is_verified && <CheckCircle2 size={12} className="text-emerald-400" />}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-200">{item.question_text}</p>
          {item.question_type === "mcq" && <div className="mt-3 grid gap-2 sm:grid-cols-2">{(["a", "b", "c", "d"] as const).map((letter) => { const value = item[`option_${letter}`]; return value ? <div key={letter} className="rounded-lg border border-white/[0.06] px-3 py-2 text-xs text-slate-400"><b className="mr-1 uppercase">{letter}.</b>{value}</div> : null; })}</div>}
          {item.model_answer && <details className="mt-3"><summary className="cursor-pointer text-xs font-semibold text-emerald-400">Model answer</summary><p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate-400">{item.model_answer}</p></details>}
          {item.explanation && <p className="mt-3 text-xs leading-5 text-slate-500">{item.explanation}</p>}
        </article>)}
      </div>}

      <AdminWatermarkedPreview questionId={paperId} mimeType={mimeType} open={previewOpen} onClose={() => setPreviewOpen(false)} />
    </div>
  );
}