"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, FileText, Loader2, AlertCircle, Download } from "lucide-react";

import { createClient } from "@/utils/supabase/client";

interface QuestionDetail {
  id: string;
  title: string;
  year: string | null;
  status: string;
  extracted_text: string | null;
  extraction_quality: number | null;
  file_url: string;
  mime_type: string;
  created_at: string;
  course: { id: string; name: string } | null;
  semester: { id: string; name: string } | null;
}

const LOW_QUALITY_THRESHOLD = 0.5;

// Splits extracted text into paragraphs on blank lines, and further
// breaks up long unbroken blocks into sentence groups so raw OCR/PDF
// dumps aren't shown as one giant wall of text.
function formatExtractedText(text: string): string[] {
  const rawParagraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const paragraphs: string[] = [];
  for (const para of rawParagraphs) {
    if (para.length <= 400) {
      paragraphs.push(para);
      continue;
    }
    // Long block with no natural breaks — split on sentence boundaries
    // in groups of ~3 to keep it readable.
    const sentences = para.split(/(?<=[.?!])\s+/);
    for (let i = 0; i < sentences.length; i += 3) {
      paragraphs.push(sentences.slice(i, i + 3).join(" "));
    }
  }
  return paragraphs;
}

export default function QuestionDetailPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const questionId = params?.id as string;

  const [data, setData] = useState<QuestionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!questionId) return;

    async function load() {
      setLoading(true);
      setError("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/auth/login");
        return;
      }

      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/questions/${questionId}`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );

        if (res.status === 404) throw new Error("This past question wasn't found.");
        if (!res.ok) throw new Error("Failed to load this past question.");

        const json: QuestionDetail = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [questionId]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-slate-600">{error || "Question not found."}</p>
        <Link href="/dashboard" className="font-semibold text-blue-600 hover:underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const paragraphs = data.extracted_text ? formatExtractedText(data.extracted_text) : [];
  const isLowQuality =
    data.extraction_quality !== null && data.extraction_quality < LOW_QUALITY_THRESHOLD;

  return (
    <div className="mx-auto max-w-3xl px-6 pb-16 pt-8">
      <Link
        href={data.course ? `/dashboard/courses/${data.course.id}` : "/dashboard"}
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={16} />
        Back
      </Link>

      <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
            <FileText size={20} />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900">{data.title}</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {data.course?.name ?? "—"}
              {data.semester?.name ? ` · ${data.semester.name}` : ""}
              {data.year ? ` · ${data.year}` : ""}
            </p>
          </div>
          <a
            href={data.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex shrink-0 items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
          >
            <Download size={14} />
            Original file
          </a>
        </div>

        {isLowQuality && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>
              This scan wasn't very clear, so the text below may have small
              errors — check the original file above if anything looks off.
            </span>
          </div>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-slate-900">Extracted Text</h2>

        {paragraphs.length === 0 ? (
          <p className="text-sm text-slate-400">No extracted text available for this file.</p>
        ) : (
          <div className="space-y-4 text-[15px] leading-relaxed text-slate-700">
            {paragraphs.map((para, i) => (
              <p key={i} className="whitespace-pre-wrap">
                {para}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}