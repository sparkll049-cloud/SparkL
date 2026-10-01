
"use client";

import { useEffect, useState } from "react";
import {
  Loader2, FileText, CheckCircle2, XCircle, ChevronDown,
  AlertCircle, Sparkles, Clock, BookOpen, Eye,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Section {
  id: string;
  start_page: number;
  end_page: number;
  processing_status: string;
  processing_error: string | null;
  extraction_quality: number | null;
  extracted_text: string | null;
  course: { id: string; name: string } | null;
}

interface SourceDoc {
  id: string;
  status: string;
  mime_type: string;
  file_size: number;
  page_count: number | null;
  created_at: string;
  uploader: { full_name: string | null } | null;
  section_count: number;
  sections?: Section[];
}

const API = process.env.NEXT_PUBLIC_API_URL;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBytes(b: number) {
  return b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;
}

async function getToken(supabase: ReturnType<typeof createClient>) {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

// ── Status pills ──────────────────────────────────────────────────────────────

function DocStatusPill({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string; icon: React.ReactNode }> = {
    approved: { cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: <CheckCircle2 className="h-3 w-3" />, label: "Approved" },
    rejected: { cls: "bg-red-500/10 text-red-400 border-red-500/20",             icon: <XCircle className="h-3 w-3" />,       label: "Rejected" },
    pending:  { cls: "bg-amber-500/10 text-amber-400 border-amber-500/20",        icon: <Clock className="h-3 w-3" />,          label: "Pending"  },
  };
  const s = map[status] ?? map.pending;
  return (
    <span className={`flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${s.cls}`}>
      {s.icon}{s.label}
    </span>
  );
}

function SectionStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ready:    "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    approved: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    failed:   "bg-red-500/10 text-red-400 border-red-500/20",
    pending:  "bg-slate-500/10 text-slate-400 border-slate-500/20",
    rejected: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${map[status] ?? map.pending}`}>
      {status}
    </span>
  );
}

// ── Section row ───────────────────────────────────────────────────────────────

function SectionRow({
  sec, docId, token,
  onApprove, onReject, onProcess, actioning,
}: {
  sec: Section; docId: string; token: string;
  onApprove: (id: string) => void;
  onReject:  (id: string) => void;
  onProcess: (id: string) => void;
  actioning: string | null;
}) {
  const [expanded,    setExpanded]    = useState(false);
  const [editingText, setEditingText] = useState(false);
  const [editVal,     setEditVal]     = useState(sec.extracted_text ?? "");
  const [saving,      setSaving]      = useState(false);
  const [saveErr,     setSaveErr]     = useState("");
  const [previewPage, setPreviewPage] = useState<number | null>(null);
  const [previewUrl,  setPreviewUrl]  = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  async function saveText() {
    setSaveErr(""); setSaving(true);
    try {
      const res = await fetch(`${API}/api/admin/sections/${sec.id}/text`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ extracted_text: editVal }),
      });
      if (!res.ok) throw new Error((await res.json()).detail ?? "Save failed.");
      setEditingText(false);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Save failed.");
    } finally { setSaving(false); }
  }

  async function loadPreview(page: number) {
    setPreviewPage(page); setPreviewLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/sections/${sec.id}/page/${page}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        setPreviewUrl(URL.createObjectURL(blob));
      }
    } catch { /* non-critical */ }
    finally { setPreviewLoading(false); }
  }

  return (
    <div className="rounded-xl border p-4 space-y-3"
      style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.08)" }}>

      {/* Section header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-blue-400 shrink-0" />
            <p className="text-sm font-semibold text-white">
              {sec.course?.name ?? "Unknown course"}
            </p>
            <SectionStatusBadge status={sec.processing_status} />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Pages {sec.start_page}–{sec.end_page}
            {sec.extraction_quality !== null
              ? ` · Quality: ${(sec.extraction_quality * 100).toFixed(0)}%`
              : ""}
          </p>
          {sec.processing_status === "failed" && sec.processing_error && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-red-400">
              <AlertCircle className="h-3 w-3 shrink-0" />{sec.processing_error}
            </p>
          )}
        </div>

        {/* Preview first page */}
        <button
          onClick={() => loadPreview(sec.start_page)}
          className="flex items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/10 px-2.5 py-1.5 text-xs font-semibold text-blue-400 transition hover:bg-blue-500/20"
        >
          <Eye className="h-3.5 w-3.5" /> Preview
        </button>
      </div>

      {/* Page preview */}
      {previewPage && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-slate-500">Page {previewPage}</p>
          {previewLoading
            ? <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
            : previewUrl
              ? <img src={previewUrl} alt={`Page ${previewPage}`}
                  className="max-h-64 w-auto rounded-lg object-contain shadow-lg" />
              : <p className="text-xs text-red-400">Couldn&apos;t load preview.</p>
          }
          {/* Navigate pages within section */}
          <div className="flex items-center gap-2">
            {previewPage > sec.start_page && (
              <button onClick={() => loadPreview(previewPage - 1)}
                className="text-xs text-blue-400 hover:text-blue-300">← Prev</button>
            )}
            {previewPage < sec.end_page && (
              <button onClick={() => loadPreview(previewPage + 1)}
                className="text-xs text-blue-400 hover:text-blue-300">Next →</button>
            )}
          </div>
        </div>
      )}

      {/* Extracted text */}
      {sec.extracted_text && !editingText && (
        <div>
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-300 transition"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
            {expanded ? "Hide text" : "Preview extracted text"}
          </button>
          {expanded && (
            <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs leading-6 text-slate-400">
              {sec.extracted_text}
            </div>
          )}
          <button
            onClick={() => { setEditVal(sec.extracted_text ?? ""); setEditingText(true); setExpanded(true); }}
            className="mt-2 text-xs font-medium text-blue-400 hover:text-blue-300 transition"
          >
            Edit text
          </button>
        </div>
      )}

      {/* Text editor */}
      {editingText && (
        <div className="space-y-2">
          <textarea
            value={editVal} onChange={e => setEditVal(e.target.value)} rows={8}
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
          {saveErr && <p className="text-xs text-red-400">{saveErr}</p>}
          <div className="flex gap-2">
            <button onClick={saveText} disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60">
              {saving && <Loader2 className="h-3 w-3 animate-spin" />} Save
            </button>
            <button onClick={() => setEditingText(false)} disabled={saving}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-400 transition hover:bg-white/[0.08] disabled:opacity-60">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Low quality warning */}
      {sec.extraction_quality !== null && sec.extraction_quality < 0.5 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          <p className="text-xs text-amber-400">Low extraction quality — review before approving.</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          onClick={() => onProcess(sec.id)}
          disabled={actioning === sec.id || !sec.extracted_text}
          className="flex items-center gap-1.5 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-400 transition hover:bg-violet-500/20 disabled:opacity-50"
        >
          {actioning === sec.id
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <Sparkles className="h-3 w-3" />
          }
          Generate questions
        </button>

        {sec.processing_status !== "approved" && (
          <button
            onClick={() => onApprove(sec.id)}
            disabled={actioning === sec.id}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-50"
          >
            <CheckCircle2 className="h-3 w-3" /> Approve
          </button>
        )}

        {sec.processing_status !== "rejected" && (
          <button
            onClick={() => onReject(sec.id)}
            disabled={actioning === sec.id}
            className="flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
          >
            <XCircle className="h-3 w-3" /> Reject
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminSourceDocumentsPage() {
  const supabase = createClient();
  const router   = useRouter();

  const [docs,      setDocs]      = useState<SourceDoc[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [expanded,  setExpanded]  = useState<Set<string>>(new Set());
  const [actioning, setActioning] = useState<string | null>(null);
  const [token,     setToken]     = useState("");
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth/login"); return; }
      setToken(session.access_token);
      await fetchDocs(session.access_token);
      setLoading(false);
    }
    load();
  }, []);

  async function fetchDocs(tok: string) {
    try {
      const res = await fetch(`${API}/api/admin/source-documents`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (!res.ok) throw new Error("Failed to load source documents.");
      setDocs(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  async function toggleExpand(docId: string) {
    const next = new Set(expanded);
    if (next.has(docId)) {
      next.delete(docId);
      setExpanded(next);
      return;
    }
    // Load sections if not already loaded
    const doc = docs.find(d => d.id === docId);
    if (!doc?.sections) {
      try {
        const res = await fetch(`${API}/api/admin/source-documents/${docId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const full = await res.json();
          setDocs(prev => prev.map(d => d.id === docId ? { ...d, sections: full.sections } : d));
        }
      } catch { /* non-critical */ }
    }
    next.add(docId);
    setExpanded(next);
  }

  async function approveDoc(docId: string) {
    setActioning(docId);
    try {
      await fetch(`${API}/api/admin/source-documents/${docId}/status`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ status: "approved" }),
      });
      setDocs(prev => prev.map(d => d.id === docId ? { ...d, status: "approved" } : d));
    } catch { /* non-critical */ }
    finally { setActioning(null); }
  }

  async function approveSection(sectionId: string) {
    setActioning(sectionId);
    try {
      await fetch(`${API}/api/admin/sections/${sectionId}/status`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ status: "approved" }),
      });
      setDocs(prev => prev.map(d => ({
        ...d,
        sections: d.sections?.map(s =>
          s.id === sectionId ? { ...s, processing_status: "approved" } : s
        ),
      })));
    } catch { /* non-critical */ }
    finally { setActioning(null); }
  }

  async function submitRejectSection() {
    if (!rejectTarget || !rejectReason.trim()) return;
    setActioning(rejectTarget);
    try {
      await fetch(`${API}/api/admin/sections/${rejectTarget}/status`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ status: "rejected", reason: rejectReason.trim() }),
      });
      setDocs(prev => prev.map(d => ({
        ...d,
        sections: d.sections?.map(s =>
          s.id === rejectTarget
            ? { ...s, processing_status: "rejected", processing_error: rejectReason.trim() }
            : s
        ),
      })));
    } catch { /* non-critical */ }
    finally { setActioning(null); setRejectTarget(null); setRejectReason(""); }
  }

  async function processSection(sectionId: string) {
    setActioning(sectionId);
    try {
      const res = await fetch(`${API}/api/admin/sections/${sectionId}/process`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.detail ?? "Processing failed.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Processing failed.");
    } finally { setActioning(null); }
  }

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center bg-[#07091A]">
      <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#07091A] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-2">Admin</p>
          <h1 className="text-3xl font-extrabold text-white">Multi-Course Documents</h1>
          <p className="mt-2 text-sm text-slate-500">
            PDFs uploaded with multiple courses. Review sections, correct text, then approve.
          </p>
        </div>

        {error && (
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
            <button onClick={() => setError("")} className="ml-auto text-slate-500 hover:text-slate-300 text-xs">✕</button>
          </div>
        )}

        <div className="rounded-2xl border border-white/[0.06] bg-[#0D1230] overflow-hidden">
          {docs.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
                <FileText className="h-5 w-5 text-blue-400" />
              </div>
              <p className="text-sm font-semibold text-slate-400">No multi-course documents yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {docs.map(doc => (
                <div key={doc.id} className="p-5">

                  {/* Document header */}
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
                        <FileText className="h-4.5 w-4.5 text-blue-400" size={18} />
                      </div>
                      <div>
                        <p className="font-semibold text-white">
                          {doc.uploader?.full_name ?? "Unknown uploader"}
                        </p>
                        <p className="mt-0.5 text-sm text-slate-500">
                          {doc.page_count ?? "?"} pages · {fmtBytes(doc.file_size)} · {doc.section_count} course{doc.section_count !== 1 ? "s" : ""}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          {new Date(doc.created_at).toLocaleDateString("en-GB", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                    <DocStatusPill status={doc.status} />
                  </div>

                  {/* Document-level actions */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {doc.status !== "approved" && (
                      <button
                        onClick={() => approveDoc(doc.id)}
                        disabled={actioning === doc.id}
                        className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-50"
                      >
                        {actioning === doc.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <CheckCircle2 className="h-3 w-3" />
                        }
                        Approve document
                      </button>
                    )}
                    <button
                      onClick={() => toggleExpand(doc.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-400 transition hover:bg-white/[0.08]"
                    >
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded.has(doc.id) ? "rotate-180" : ""}`} />
                      {expanded.has(doc.id) ? "Hide sections" : "Review sections"}
                    </button>
                  </div>

                  {/* Sections */}
                  {expanded.has(doc.id) && (
                    <div className="mt-4 space-y-3">
                      {!doc.sections ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                        </div>
                      ) : doc.sections.length === 0 ? (
                        <p className="text-xs text-slate-500">No sections mapped yet.</p>
                      ) : (
                        doc.sections.map(sec => (
                          <SectionRow
                            key={sec.id}
                            sec={sec} docId={doc.id} token={token}
                            onApprove={approveSection}
                            onReject={(id) => { setRejectTarget(id); setRejectReason(""); }}
                            onProcess={processSection}
                            actioning={actioning}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Reject section modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#0D1230] p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-white">Reject this section?</h2>
            <p className="mt-1 text-sm text-slate-400">Give a reason so the uploader knows what to fix.</p>
            <textarea
              value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Wrong course, blurry pages..."
              rows={3} maxLength={300}
              className="mt-4 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
            <div className="mt-4 flex gap-2">
              <button onClick={() => setRejectTarget(null)} disabled={actioning === rejectTarget}
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.08] disabled:opacity-60">
                Cancel
              </button>
              <button onClick={submitRejectSection}
                disabled={!rejectReason.trim() || actioning === rejectTarget}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-60">
                {actioning === rejectTarget && <Loader2 className="h-4 w-4 animate-spin" />}
                Reject section
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}