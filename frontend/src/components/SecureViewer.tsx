"use client";

import { useEffect, useState } from "react";
import { AlertCircle, FileText, Loader2, Lock } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

type ProcessedQuestion = {
  id: string;
  question_number: number;
  question_text: string;
  question_type: "mcq" | "theory";
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  marks: number | null;
};

type Props = {
  questionId: string;
  onClose?: () => void;
  isPaid?: boolean;
  inline?: boolean;
};

/**
 * Student-safe viewer.
 *
 * It deliberately does not call /file-url and never loads an original PDF into
 * iframe/embed/object. Students receive structured processed questions only.
 */
export default function SecureViewer({ questionId, inline = false }: Props) {
  const supabase = createClient();
  const [items, setItems] = useState<ProcessedQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (!cancelled) setError("Please sign in to view this paper.");
        setLoading(false);
        return;
      }
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/questions/${questionId}/processed`,
          { headers: { Authorization: `Bearer ${session.access_token}` } },
        );
        if (!response.ok) throw new Error("Questions are not available yet.");
        const result = await response.json();
        if (!cancelled) setItems(Array.isArray(result) ? result : []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load questions.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [questionId]);

  return (
    <section className={inline ? "bg-[var(--sp-bg-card)]" : "rounded-2xl border bg-[var(--sp-bg-card)]"}>
      <div className="flex items-center gap-2 border-b px-5 py-4" style={{ borderColor: "var(--sp-border)" }}>
        <FileText size={16} className="text-indigo-500" />
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--sp-text)" }}>Questions</p>
          <p className="text-[11px]" style={{ color: "var(--sp-text-3)" }}>
            Structured view — original document access is restricted
          </p>
        </div>
        <Lock size={13} className="ml-auto text-indigo-400" />
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 px-5 py-16 text-sm" style={{ color: "var(--sp-text-3)" }}>
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" /> Loading questions…
        </div>
      )}

      {!loading && error && (
        <div className="flex items-start gap-2 px-5 py-10 text-sm text-amber-500">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="px-5 py-12 text-center text-sm" style={{ color: "var(--sp-text-3)" }}>
          Structured questions are not ready yet. Please check again later.
        </p>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="space-y-4 p-5">
          {items.map((item) => (
            <article key={item.id} className="rounded-xl border p-4" style={{ borderColor: "var(--sp-border)" }}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-indigo-500">Question {item.question_number}</span>
                {item.marks != null && <span className="text-[11px]" style={{ color: "var(--sp-text-3)" }}>{item.marks} marks</span>}
              </div>
              <p className="whitespace-pre-wrap text-sm leading-7" style={{ color: "var(--sp-text)" }}>{item.question_text}</p>
              {item.question_type === "mcq" && (
                <div className="mt-3 space-y-2">
                  {(["a", "b", "c", "d"] as const).map((letter) => {
                    const value = item[`option_${letter}`];
                    if (!value) return null;
                    return (
                      <div key={letter} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-2)" }}>
                        <b className="mr-2 uppercase">{letter}.</b>{value}
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );