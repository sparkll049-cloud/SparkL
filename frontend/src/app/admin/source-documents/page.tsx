"use client";

import { useEffect, useRef, useState } from "react";
import {
  Loader2, FileText, CheckCircle2, XCircle, ChevronDown,
  AlertCircle, Sparkles, Clock, BookOpen, Eye, Trash2,
  ShieldCheck, MoreVertical, RefreshCw,
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
  return b < 1024 * 1024
    ? `${(b / 1024).toFixed(0)} KB`
    : `${(b / 1024 / 1024).toFixed(1)} MB`;
}

async function getToken(supabase: ReturnType<typeof createClient>) {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

// ── Confirm dialog ────────────────────────────────────────────────────────────

function ConfirmDialog({
  title, body, confirmLabel = "Confirm", danger = false,
  loading = false, onConfirm, onCancel,
}: {
  title: string; body: string; confirmLabel?: string;
  danger?: boolean; loading?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl border p-6 shadow-2xl"
        style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
      >
        <div className="mb-1 flex items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: danger ? "rgba(239,68,68,0.12)" : "rgba(99,102,241,0.12)" }}
          >
            {danger
              ? <Trash2 className="h-4 w-4 text-red-400" />
              : <ShieldCheck className="h-4 w-4 text-indigo-400" />
            }
          </div>
          <h2 className="text-sm font-black" style={{ color: "var(--sp-text)" }}>{title}</h2>
        </div>
        <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--sp-text-3)" }}>{body}</p>
        <div className="mt-5 flex gap-2.5">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl border py-2.5 text-xs font-bold transition hover:opacity-80 disabled:opacity-50"
            style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)", background: "var(--sp-input-bg)" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ background: danger ? "#EF4444" : "#6366F1" }}
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Status pills ──────────────────────────────────────────────────────────────

function DocStatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; border: string; icon: React.ReactNode; label: string }> = {
    approved: {
      bg: "rgba(16,185,129,0.10)", color: "#10B981", border: "rgba(16,185,129,0.25)",
      icon: <CheckCircle2 className="h-3 w-3" />, label: "Approved",
    },
    rejected: {
      bg: "rgba(239,68,68,0.10)", color: "#EF4444", border: "rgba(239,68,68,0.25)",
      icon: <XCircle className="h-3 w-3" />, label: "Rejected",
    },
    pending: {
      bg: "rgba(245,158,11,0.10)", color: "#F59E0B", border: "rgba(245,158,11,0.25)",
      icon: <Clock className="h-3 w-3" />, label: "Pending",
    },
  };
  const s = map[status] ?? map.pending;
  return (
    <span
      className="flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold"
      style={{ background: s.bg, color: s.color, borderColor: s.border }}
    >
      {s.icon}{s.label}
    </span>
  );
}

function SectionStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    ready:    { bg: "rgba(16,185,129,0.10)",  color: "#10B981", border: "rgba(16,185,129,0.25)"  },
    approved: { bg: "rgba(14,165,233,0.10)",  color: "#0EA5E9", border: "rgba(14,165,233,0.25)"  },
    failed:   { bg: "rgba(239,68,68,0.10)",   color: "#EF4444", border: "rgba(239,68,68,0.25)"   },
    pending:  { bg: "rgba(100,116,139,0.10)", color: "#94A3B8", border: "rgba(100,116,139,0.25)" },
    rejected: { bg: "rgba(239,68,68,0.10)",   color: "#EF4444", border: "rgba(239,68,68,0.25)"   },
  };
  const s = map[status] ?? map.pending;
  return (
    <span
      className="rounded-full border px-2 py-0.5 text-[10px] font-bold"
      style={{ background: s.bg, color: s.color, borderColor: s.border }}
    >
      {status}
    </span>
  );
}

// ── Section row ───────────────────────────────────────────────────────────────

function SectionRow({
  sec, docId, token,
  onApprove, onReject, onProcess, onDelete, actioning,
}: {
  sec: Section; docId: string; token: string;
  onApprove: (id: string) => void;
  onReject:  (id: string) => void;
  onProcess: (id: string) => void;
  onDelete:  (id: string) => void;
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

  const busy = actioning === sec.id;

  return (
    <div
      className="rounded-2xl border p-4 space-y-3 transition-all"
      style={{ background: "var(--sp-input-bg)", borderColor: "var(--sp-border)" }}
    >
      {/* Section header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 shrink-0" style={{ color: "#0EA5E9" }} />
            <p className="text-sm font-bold" style={{ color: "var(--sp-text)" }}>
              {sec.course?.name ?? "Unknown course"}
            </p>
            <SectionStatusBadge status={sec.processing_status} />
          </div>
          <p className="mt-1 text-[11px]" style={{ color: "var(--sp-text-3)" }}>
            Pages {sec.start_page}–{sec.end_page}
            {sec.extraction_quality !== null
              ? ` · Quality: ${(sec.extraction_quality * 100).toFixed(0)}%`
              : ""}
          </p>
          {sec.processing_status === "failed" && sec.processing_error && (
            <p className="mt-1 flex items-center gap-1.5 text-[11px]" style={{ color: "#EF4444" }}>
              <AlertCircle className="h-3 w-3 shrink-0" />{sec.processing_error}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => loadPreview(sec.start_page)}
            className="flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold transition hover:opacity-80"
            style={{ background: "rgba(14,165,233,0.10)", borderColor: "rgba(14,165,233,0.25)", color: "#0EA5E9" }}
          >
            <Eye className="h-3.5 w-3.5" /> Preview
          </button>
          <button
            onClick={() => onDelete(sec.id)}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold transition hover:opacity-80 disabled:opacity-40"
            style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.20)", color: "#EF4444" }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Page preview */}
      {previewPage && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-[11px]" style={{ color: "var(--sp-text-3)" }}>Page {previewPage}</p>
          {previewLoading
            ? <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#0EA5E9" }} />
            : previewUrl
              ? <img src={previewUrl} alt={`Page ${previewPage}`}
                  className="max-h-64 w-auto rounded-xl object-contain shadow-lg" />
              : <p className="text-[11px]" style={{ color: "#EF4444" }}>Couldn&apos;t load preview.</p>
          }
          <div className="flex items-center gap-3">
            {previewPage > sec.start_page && (
              <button
                onClick={() => loadPreview(previewPage - 1)}
                className="text-[11px] font-bold transition hover:opacity-70"
                style={{ color: "#0EA5E9" }}
              >← Prev</button>
            )}
            {previewPage < sec.end_page && (
              <button
                onClick={() => loadPreview(previewPage + 1)}
                className="text-[11px] font-bold transition hover:opacity-70"
                style={{ color: "#0EA5E9" }}
              >Next →</button>
            )}
          </div>
        </div>
      )}

      {/* Extracted text */}
      {sec.extracted_text && !editingText && (
        <div>
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1 text-[11px] font-bold transition hover:opacity-70"
            style={{ color: "var(--sp-text-3)" }}
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
            {expanded ? "Hide text" : "Preview extracted text"}
          </button>
          {expanded && (
            <div
              className="mt-2 max-h-40 overflow-y-auto rounded-xl border p-3 text-[11px] leading-6"
              style={{ background: "var(--sp-bg)", borderColor: "var(--sp-border)", color: "var(--sp-text-2)" }}
            >
              {sec.extracted_text}
            </div>
          )}
          <button
            onClick={() => { setEditVal(sec.extracted_text ?? ""); setEditingText(true); setExpanded(true); }}
            className="mt-2 text-[11px] font-bold transition hover:opacity-70"
            style={{ color: "#6366F1" }}
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
            className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition"
            style={{
              background: "var(--sp-bg)", borderColor: "var(--sp-border)",
              color: "var(--sp-text)",
            }}
          />
          {saveErr && <p className="text-[11px]" style={{ color: "#EF4444" }}>{saveErr}</p>}
          <div className="flex gap-2">
            <button
              onClick={saveText} disabled={saving}
              className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[11px] font-bold text-white transition hover:opacity-90 disabled:opacity-60"
              style={{ background: "#6366F1" }}
            >
              {saving && <Loader2 className="h-3 w-3 animate-spin" />} Save
            </button>
            <button
              onClick={() => setEditingText(false)} disabled={saving}
              className="rounded-xl border px-3.5 py-2 text-[11px] font-bold transition hover:opacity-70 disabled:opacity-60"
              style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)", background: "var(--sp-input-bg)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Low quality warning */}
      {sec.extraction_quality !== null && sec.extraction_quality < 0.5 && (
        <div
          className="flex items-center gap-2 rounded-xl border px-3 py-2"
          style={{ background: "rgba(245,158,11,0.07)", borderColor: "rgba(245,158,11,0.22)" }}
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          <p className="text-[11px] font-medium text-amber-400">
            Low extraction quality — review before approving.
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          onClick={() => onProcess(sec.id)}
          disabled={busy || !sec.extracted_text}
          className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-bold transition hover:opacity-80 disabled:opacity-40"
          style={{ background: "rgba(139,92,246,0.10)", borderColor: "rgba(139,92,246,0.25)", color: "#8B5CF6" }}
        >
          {busy
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <Sparkles className="h-3 w-3" />
          }
          Generate questions
        </button>

        {sec.processing_status !== "approved" && (
          <button
            onClick={() => onApprove(sec.id)}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-bold transition hover:opacity-80 disabled:opacity-40"
            style={{ background: "rgba(16,185,129,0.10)", borderColor: "rgba(16,185,129,0.25)", color: "#10B981" }}
          >
            <CheckCircle2 className="h-3 w-3" /> Approve
          </button>
        )}

        {sec.processing_status !== "rejected" && (
          <button
            onClick={() => onReject(sec.id)}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-bold transition hover:opacity-80 disabled:opacity-40"
            style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.20)", color: "#EF4444" }}
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
  const [refreshing, setRefreshing] = useState(false);
  const [error,     setError]     = useState("");
  const [expanded,  setExpanded]  = useState<Set<string>>(new Set());
  const [actioning, setActioning] = useState<string | null>(null);
  // Keep token in a ref so it's always current regardless of render timing
  const tokenRef = useRef("");
  // Keep a stable string version for passing to child components
  const [token, setToken] = useState("");

  // Reject section modal state
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Delete confirm state  — "doc:<id>" | "sec:<id>"
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Always fetch a fresh token from Supabase before any API call
  async function getAuthToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push("/auth/login"); return null; }
    tokenRef.current = session.access_token;
    setToken(session.access_token);
    return session.access_token;
  }

  useEffect(() => {
    async function load() {
      const tok = await getAuthToken();
      if (!tok) return;
      await fetchDocs(tok);
      setLoading(false);
    }
    load();
  }, []);

  async function fetchDocs(tok?: string) {
    const authTok = tok ?? await getAuthToken();
    if (!authTok) return;
    try {
      const res = await fetch(`${API}/api/admin/source-documents`, {
        headers: { Authorization: `Bearer ${authTok}` },
      });
      if (!res.ok) throw new Error(`Failed to load source documents. (${res.status})`);
      setDocs(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    setError("");
    await fetchDocs();
    setRefreshing(false);
  }

  async function toggleExpand(docId: string) {
    const next = new Set(expanded);
    if (next.has(docId)) { next.delete(docId); setExpanded(next); return; }
    const doc = docs.find(d => d.id === docId);
    if (!doc?.sections) {
      try {
        const tok = await getAuthToken();
        if (!tok) return;
        const res = await fetch(`${API}/api/admin/source-documents/${docId}`, {
          headers: { Authorization: `Bearer ${tok}` },
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
    const tok = await getAuthToken(); if (!tok) return;
    setActioning(docId);
    try {
      await fetch(`${API}/api/admin/source-documents/${docId}/status`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body:    JSON.stringify({ status: "approved" }),
      });
      setDocs(prev => prev.map(d => d.id === docId ? { ...d, status: "approved" } : d));
    } catch { /* non-critical */ }
    finally { setActioning(null); }
  }

  // ── Delete document ─────────────────────────────────────────────────────────
  async function deleteDoc(docId: string) {
    const tok = await getAuthToken(); if (!tok) return;
    setActioning(docId);
    try {
      const res = await fetch(`${API}/api/admin/source-documents/${docId}`, {
        method:  "DELETE",
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (!res.ok) throw new Error((await res.json()).detail ?? "Delete failed.");
      setDocs(prev => prev.filter(d => d.id !== docId));
      setExpanded(prev => { const n = new Set(prev); n.delete(docId); return n; });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    } finally { setActioning(null); setDeleteTarget(null); }
  }

  // ── Delete section ──────────────────────────────────────────────────────────
  async function deleteSection(sectionId: string) {
    const tok = await getAuthToken(); if (!tok) return;
    setActioning(sectionId);
    try {
      const res = await fetch(`${API}/api/admin/sections/${sectionId}`, {
        method:  "DELETE",
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (!res.ok) throw new Error((await res.json()).detail ?? "Delete failed.");
      setDocs(prev => prev.map(d => ({
        ...d,
        sections: d.sections?.filter(s => s.id !== sectionId),
        section_count: d.sections
          ? d.sections.filter(s => s.id !== sectionId).length
          : d.section_count,
      })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Section delete failed.");
    } finally { setActioning(null); setDeleteTarget(null); }
  }

  async function approveSection(sectionId: string) {
    const tok = await getAuthToken(); if (!tok) return;
    setActioning(sectionId);
    try {
      await fetch(`${API}/api/admin/sections/${sectionId}/status`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
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
    const tok = await getAuthToken(); if (!tok) return;
    setActioning(rejectTarget);
    try {
      await fetch(`${API}/api/admin/sections/${rejectTarget}/status`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
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
    const tok = await getAuthToken(); if (!tok) return;
    setActioning(sectionId);
    try {
      const res = await fetch(`${API}/api/admin/sections/${sectionId}/process`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.detail ?? "Processing failed.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Processing failed.");
    } finally { setActioning(null); }
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const counts = {
    total:    docs.length,
    approved: docs.filter(d => d.status === "approved").length,
    pending:  docs.filter(d => d.status === "pending").length,
  };

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center" style={{ background: "var(--sp-bg)" }}>
      <Loader2 className="h-7 w-7 animate-spin" style={{ color: "#6366F1" }} />
    </div>
  );

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-10" style={{ background: "var(--sp-bg)" }}>
      <div className="mx-auto max-w-5xl">

        {/* ── Header ── */}
        <div className="mb-8">
          <p className="mb-2 text-[11px] font-black uppercase tracking-widest" style={{ color: "#6366F1" }}>
            Admin
          </p>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight" style={{ color: "var(--sp-text)" }}>
                Multi-Course Documents
              </h1>
              <p className="mt-1 text-xs" style={{ color: "var(--sp-text-3)" }}>
                PDFs uploaded with multiple courses. Review sections, correct text, then approve.
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold transition hover:opacity-80 disabled:opacity-60"
              style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)", color: "var(--sp-text-3)" }}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {/* ── Summary stat tiles ── */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          {[
            { label: "Total docs",  value: counts.total,    color: "#6366F1" },
            { label: "Approved",    value: counts.approved, color: "#10B981" },
            { label: "Pending",     value: counts.pending,  color: "#F59E0B" },
          ].map(s => (
            <div
              key={s.label}
              className="rounded-2xl border p-4"
              style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
            >
              <p className="text-2xl font-black tabular-nums" style={{ color: s.color }}>{s.value}</p>
              <p className="mt-0.5 text-[11px]" style={{ color: "var(--sp-text-3)" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div
            className="mb-5 flex items-start gap-2.5 rounded-2xl border px-4 py-3"
            style={{ background: "rgba(239,68,68,0.07)", borderColor: "rgba(239,68,68,0.22)" }}
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
            <button
              onClick={() => setError("")}
              className="ml-auto text-xs transition hover:opacity-70"
              style={{ color: "var(--sp-text-3)" }}
            >✕</button>
          </div>
        )}

        {/* ── Documents list ── */}
        <div
          className="overflow-hidden rounded-2xl border"
          style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
        >
          {docs.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <div
                className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{ background: "rgba(99,102,241,0.10)" }}
              >
                <FileText className="h-5 w-5" style={{ color: "#6366F1" }} />
              </div>
              <p className="text-sm font-bold" style={{ color: "var(--sp-text-2)" }}>
                No multi-course documents yet.
              </p>
            </div>
          ) : (
            <div style={{ borderColor: "var(--sp-border)" }} className="divide-y">
              {docs.map(doc => (
                <div key={doc.id} className="p-5">

                  {/* ── Document header ── */}
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
                        style={{ background: "rgba(99,102,241,0.12)" }}
                      >
                        <FileText className="h-4.5 w-4.5" style={{ color: "#6366F1" }} size={18} />
                      </div>
                      <div>
                        <p className="font-black" style={{ color: "var(--sp-text)" }}>
                          {doc.uploader?.full_name ?? "Unknown uploader"}
                        </p>
                        <p className="mt-0.5 text-xs" style={{ color: "var(--sp-text-3)" }}>
                          {doc.page_count ?? "?"} pages · {fmtBytes(doc.file_size)} · {doc.section_count} course{doc.section_count !== 1 ? "s" : ""}
                        </p>
                        <p className="mt-0.5 text-[11px]" style={{ color: "var(--sp-text-3)" }}>
                          {new Date(doc.created_at).toLocaleDateString("en-GB", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                    <DocStatusPill status={doc.status} />
                  </div>

                  {/* ── Document-level actions ── */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {doc.status !== "approved" && (
                      <button
                        onClick={() => approveDoc(doc.id)}
                        disabled={actioning === doc.id}
                        className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold transition hover:opacity-80 disabled:opacity-50"
                        style={{ background: "rgba(16,185,129,0.10)", borderColor: "rgba(16,185,129,0.25)", color: "#10B981" }}
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
                      className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold transition hover:opacity-80"
                      style={{ background: "var(--sp-input-bg)", borderColor: "var(--sp-border)", color: "var(--sp-text-3)" }}
                    >
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded.has(doc.id) ? "rotate-180" : ""}`} />
                      {expanded.has(doc.id) ? "Hide sections" : "Review sections"}
                    </button>

                    {/* Delete document */}
                    <button
                      onClick={() => setDeleteTarget(`doc:${doc.id}`)}
                      disabled={actioning === doc.id}
                      className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold transition hover:opacity-80 disabled:opacity-40"
                      style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.20)", color: "#EF4444" }}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>

                  {/* ── Sections ── */}
                  {expanded.has(doc.id) && (
                    <div className="mt-4 space-y-3">
                      {!doc.sections ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#6366F1" }} />
                        </div>
                      ) : doc.sections.length === 0 ? (
                        <p className="text-xs" style={{ color: "var(--sp-text-3)" }}>No sections mapped yet.</p>
                      ) : (
                        doc.sections.map(sec => (
                          <SectionRow
                            key={sec.id}
                            sec={sec} docId={doc.id} token={token}
                            onApprove={approveSection}
                            onReject={(id) => { setRejectTarget(id); setRejectReason(""); }}
                            onProcess={processSection}
                            onDelete={(id) => setDeleteTarget(`sec:${id}`)}
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

      {/* ── Reject section modal ── */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl border p-6 shadow-2xl"
            style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
          >
            <h2 className="text-sm font-black" style={{ color: "var(--sp-text)" }}>Reject this section?</h2>
            <p className="mt-1 text-xs" style={{ color: "var(--sp-text-3)" }}>
              Give a reason so the uploader knows what to fix.
            </p>
            <textarea
              value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Wrong course, blurry pages..."
              rows={3} maxLength={300}
              className="mt-4 w-full rounded-xl border px-4 py-3 text-sm outline-none transition"
              style={{
                background: "var(--sp-input-bg)", borderColor: "var(--sp-border)",
                color: "var(--sp-text)",
              }}
            />
            <div className="mt-4 flex gap-2.5">
              <button
                onClick={() => setRejectTarget(null)}
                disabled={actioning === rejectTarget}
                className="flex-1 rounded-xl border py-2.5 text-xs font-bold transition hover:opacity-80 disabled:opacity-60"
                style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)", background: "var(--sp-input-bg)" }}
              >
                Cancel
              </button>
              <button
                onClick={submitRejectSection}
                disabled={!rejectReason.trim() || actioning === rejectTarget}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black text-white transition hover:opacity-90 disabled:opacity-60"
                style={{ background: "#EF4444" }}
              >
                {actioning === rejectTarget && <Loader2 className="h-4 w-4 animate-spin" />}
                Reject section
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm dialog ── */}
      {deleteTarget && (() => {
        const isDoc = deleteTarget.startsWith("doc:");
        const id    = deleteTarget.slice(4);
        return (
          <ConfirmDialog
            danger
            title={isDoc ? "Delete document?" : "Delete section?"}
            body={
              isDoc
                ? "This will permanently delete the document and all its sections. This cannot be undone."
                : "This will permanently delete the section and any generated questions. This cannot be undone."
            }
            confirmLabel={isDoc ? "Delete document" : "Delete section"}
            loading={actioning === id}
            onCancel={() => setDeleteTarget(null)}
            onConfirm={() => isDoc ? deleteDoc(id) : deleteSection(id)}
          />
        );
      })()}
    </div>
  );
}
