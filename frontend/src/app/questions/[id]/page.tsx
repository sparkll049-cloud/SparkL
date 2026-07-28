"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, FileText, Loader2, AlertCircle, Eye, X } from "lucide-react";

import { createClient } from "@/utils/supabase/client";
import PdfViewer from "@/components/PdfViewer";

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

  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState("");

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

  async function openViewer() {
    setViewerError("");
    setViewerLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/auth/login");
      return;
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/questions/${questionId}/file-url`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );

      if (!res.ok) throw new Error("Couldn't open the file.");

      const json: { url: string } = await res.json();
      setViewerUrl(json.url);
    } catch (err) {
      setViewerError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setViewerLoading(false);
    }
  }

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
  const isImage = data.mime_type?.startsWith("image/");

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
          <button
            onClick={openViewer}
            disabled={viewerLoading}
            className="ml-auto flex shrink-0 items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {viewerLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Eye size={14} />
            )}
            View file
          </button>
        </div>

        {viewerError && (
          <p className="mt-3 text-xs text-red-500">{viewerError}</p>
        )}

        {isLowQuality && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>
              This scan wasn't very clear, so the text below may have small
              errors — tap "View file" above to check the original if
              anything looks off.
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

      {/* In-app viewer modal — deliberately not a direct <a href> link
          or native <iframe> (which would hand control to the browser's
          own PDF viewer, complete with its own download button). Images
          render directly with right-click/drag disabled; PDFs render
          page-by-page onto <canvas> via PdfViewer. This cannot stop
          screenshots, only make link-sharing and save-as harder. */}
      {viewerUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setViewerUrl(null)}
        >
          <button
            onClick={() => setViewerUrl(null)}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X size={18} />
          </button>

          {isImage ? (
            <img
              src={viewerUrl}
              alt={data.title}
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              className="max-h-full max-w-full select-none rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div onClick={(e) => e.stopPropagation()}>
              <PdfViewer url={viewerUrl} />
            </div>
          )}
        </div>
      )}
    </div>
  );
        }
