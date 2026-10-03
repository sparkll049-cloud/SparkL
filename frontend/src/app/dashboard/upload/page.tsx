"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Upload as UploadIcon, FileText, Loader2, CheckCircle2,
  XCircle, Clock, AlertCircle, CloudUpload, RotateCcw,
  ChevronRight, BookOpen, Sparkles, PartyPopper,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Option { id: string; name: string; }
type ProcessingStatus = "uploaded" | "extracting" | "ready" | "failed";

interface MyUpload {
  id: string; title: string; year: string | null;
  status: "pending" | "approved" | "rejected";
  processing_status?: ProcessingStatus;
  created_at: string; rejection_reason: string | null;
  extraction_quality: number | null;
  course: { name: string } | null;
  semester: { name: string } | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MIN_YEAR      = 1990;
const LOW_QUALITY   = 0.5;
const POLL_MS       = 10_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1920;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
        else { width = Math.round((width * MAX) / height); height = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (!blob) { resolve(file); return; }
        resolve(blob.size < file.size
          ? new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" })
          : file);
      }, "image/jpeg", 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

function isValidYear(y: string, cur: number) {
  if (!y) return true;
  return /^\d{4}$/.test(y) && +y >= MIN_YEAR && +y <= cur + 1;
}

function fmtBytes(b: number) {
  return b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(2)} MB`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SelectField({ label, value, onChange, disabled, placeholder, options, required }: {
  label: string; value: string; onChange: (v: string) => void;
  disabled?: boolean; placeholder: string; options: Option[]; required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold" style={{ color: "var(--sp-text-2)" }}>
        {label}{required && <span className="ml-0.5 text-blue-400">*</span>}
      </label>
      <select
        value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
        className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-40 appearance-none"
        style={{ background: "var(--sp-input-bg)", borderColor: "var(--sp-border)", color: "var(--sp-text)" }}
      >
        <option value="" disabled style={{ background: "var(--sp-search-popup)" }}>{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id} style={{ background: "var(--sp-search-popup)" }}>{o.name}</option>
        ))}
      </select>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map = {
    approved: { bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: <CheckCircle2 className="h-3 w-3" />, label: "Approved" },
    rejected: { bg: "bg-red-500/10 text-red-400 border-red-500/20",             icon: <XCircle className="h-3 w-3" />,       label: "Rejected" },
    pending:  { bg: "bg-amber-500/10 text-amber-400 border-amber-500/20",        icon: <Clock className="h-3 w-3" />,          label: "Pending"  },
  };
  const s = map[status as keyof typeof map] ?? map.pending;
  return (
    <span className={`flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${s.bg}`}>
      {s.icon}{s.label}
    </span>
  );
}

function ProcessingRow({ status, retrying, onRetry }: {
  status?: ProcessingStatus; retrying: boolean; onRetry: () => void;
}) {
  if (!status || status === "ready") return null;
  if (status === "failed") return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5">
      <p className="flex items-center gap-2 text-xs text-red-400">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />We couldn&apos;t process this file.
      </p>
      <button onClick={onRetry} disabled={retrying}
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-red-500/30 px-2.5 py-1 text-[11px] font-semibold text-red-400 transition hover:bg-red-500/10 disabled:opacity-50">
        {retrying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
        Retry
      </button>
    </div>
  );
  return (
    <p className="mt-3 flex items-center gap-2 text-xs" style={{ color: "var(--sp-text-3)" }}>
      <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
      {status === "extracting" ? "Processing your paper…" : "Queued for processing"}
    </p>
  );
}

// ── Success screen ────────────────────────────────────────────────────────────

function SuccessScreen({
  uploadedTitle,
  totalUploads,
  onUploadAnother,
}: {
  uploadedTitle: string;
  totalUploads: number;
  onUploadAnother: () => void;
}) {
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
      {/* Top accent bar */}
      <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-500" />

      <div className="px-6 py-10 flex flex-col items-center text-center">
        {/* Icon */}
        <div className="relative mb-5">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>
          <span className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-base">
            🎉
          </span>
        </div>

        <h2 className="text-2xl font-black" style={{ color: "var(--sp-text)" }}>
          Thank you for contributing!
        </h2>
        <p className="mt-2 text-sm leading-relaxed max-w-sm" style={{ color: "var(--sp-text-3)" }}>
          Your paper <span className="font-semibold" style={{ color: "var(--sp-text-2)" }}>
            &ldquo;{uploadedTitle}&rdquo;
          </span> has been submitted. Our team will review it shortly and make it available to students once approved.
        </p>

        {/* Steps */}
        <div className="mt-7 w-full max-w-sm space-y-3 text-left">
          {[
            { step: "1", label: "Submitted",         sub: "Your paper is in our review queue",       done: true  },
            { step: "2", label: "Under review",       sub: "Our team checks content and quality",     done: false },
            { step: "3", label: "Live on SparkL",     sub: "Students can access and practise with it", done: false },
          ].map(({ step, label, sub, done }) => (
            <div key={step} className="flex items-start gap-3">
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black"
                style={{
                  background: done ? "rgba(16,185,129,0.15)" : "var(--sp-ring-track, rgba(148,163,184,0.1))",
                  color: done ? "#10b981" : "var(--sp-text-3)",
                }}
              >
                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : step}
              </div>
              <div className="min-w-0 pt-0.5">
                <p className="text-sm font-bold" style={{ color: done ? "#10b981" : "var(--sp-text-2)" }}>{label}</p>
                <p className="text-xs" style={{ color: "var(--sp-text-3)" }}>{sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* XP nudge */}
        <div
          className="mt-7 w-full max-w-sm rounded-2xl border px-4 py-3 flex items-center gap-3"
          style={{ borderColor: "rgba(99,102,241,0.2)", background: "rgba(99,102,241,0.06)" }}
        >
          <Sparkles className="h-4 w-4 shrink-0 text-indigo-400" />
          <p className="text-xs leading-relaxed text-left" style={{ color: "var(--sp-text-2)" }}>
            You&apos;ll earn <span className="font-black text-indigo-400">+50 XP</span> once your upload is approved. Keep contributing to level up!
          </p>
        </div>

        {/* Actions */}
        <div className="mt-7 flex w-full max-w-sm flex-col gap-3">
          <button
            onClick={onUploadAnother}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white transition hover:bg-blue-500"
          >
            <UploadIcon className="h-4 w-4" /> Upload another paper
          </button>
          <Link
            href="/dashboard"
            className="flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition hover:border-indigo-500/40 hover:text-indigo-500"
            style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-2)" }}
          >
            Back to dashboard
          </Link>
        </div>

        <p className="mt-5 text-[11px]" style={{ color: "var(--sp-text-3)" }}>
          You have <span className="font-bold" style={{ color: "var(--sp-text-2)" }}>{totalUploads}</span> total upload{totalUploads !== 1 ? "s" : ""} — view them below.
        </p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function UploadPage() {
  const supabase = createClient();
  const router   = useRouter();
  const fileRef  = useRef<HTMLInputElement>(null);

  const [institutions, setInstitutions] = useState<Option[]>([]);
  const [departments,  setDepartments]  = useState<Option[]>([]);
  const [levels,       setLevels]       = useState<Option[]>([]);
  const [courses,      setCourses]      = useState<Option[]>([]);
  const [semesters,    setSemesters]    = useState<Option[]>([]);
  const [myUploads,    setMyUploads]    = useState<MyUpload[]>([]);

  const [title,         setTitle]         = useState("");
  const [year,          setYear]          = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [departmentId,  setDepartmentId]  = useState("");
  const [levelId,       setLevelId]       = useState("");
  const [courseId,      setCourseId]      = useState("");
  const [semesterId,    setSemesterId]    = useState("");

  const [file,           setFile]           = useState<File | null>(null);
  const [compressedFile, setCompressedFile] = useState<File | null>(null);
  const [compressing,    setCompressing]    = useState(false);
  const [fileError,      setFileError]      = useState("");
  const [dragOver,       setDragOver]       = useState(false);

  const [declarationChecked, setDeclarationChecked] = useState(false);
  const [fetching,   setFetching]   = useState(true);
  const [loadingDep, setLoadingDep] = useState(false);
  const [loadingCou, setLoadingCou] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");

  // Success state — stores title of what was just uploaded
  const [successTitle, setSuccessTitle] = useState<string | null>(null);

  const [retryingId, setRetryingId] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const apiBase     = process.env.NEXT_PUBLIC_API_URL;

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth/login"); return; }
      const [{ data: inst }, { data: lev }, { data: sem }] = await Promise.all([
        supabase.from("institutions").select("id, name").order("name"),
        supabase.from("levels").select("id, name").order("name"),
        supabase.from("semesters").select("id, name").order("name"),
      ]);
      setInstitutions(inst ?? []);
      setLevels(lev ?? []);
      setSemesters(sem ?? []);
      await loadMyUploads(session.access_token);
      setFetching(false);
    }
    init();
  }, []);

  useEffect(() => {
    setDepartmentId(""); setDepartments([]); setCourseId(""); setCourses([]);
    if (!institutionId) return;
    setLoadingDep(true);
    supabase.from("departments").select("id, name").eq("institution_id", institutionId).order("name")
      .then(({ data }) => { setDepartments(data ?? []); setLoadingDep(false); });
  }, [institutionId]);

  useEffect(() => {
    setCourseId(""); setCourses([]);
    if (!departmentId) return;
    setLoadingCou(true);
    supabase.from("courses").select("id, name").eq("department_id", departmentId).order("name")
      .then(({ data }) => { setCourses(data ?? []); setLoadingCou(false); });
  }, [departmentId]);

  useEffect(() => {
    const active = myUploads.some(
      u => u.processing_status === "uploaded" || u.processing_status === "extracting"
    );
    if (!active) return;
    const t = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) loadMyUploads(session.access_token);
    }, POLL_MS);
    return () => clearInterval(t);
  }, [myUploads]);

  async function loadMyUploads(tok: string) {
    try {
      const res = await fetch(`${apiBase}/api/upload/mine`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (res.status === 401) { router.push("/auth/login"); return; }
      if (res.ok) setMyUploads(await res.json());
    } catch { /* non-critical */ }
  }

  async function handleRetry(id: string) {
    setRetryingId(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${apiBase}/api/upload/${id}/retry`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) await loadMyUploads(session.access_token);
    } catch { /* non-critical */ }
    finally { setRetryingId(null); }
  }

  function validateFile(f: File): boolean {
    setFileError("");
    if (!ALLOWED_TYPES.includes(f.type)) { setFileError("Only PDF, JPG, and PNG files are allowed."); return false; }
    if (f.size > MAX_FILE_SIZE) { setFileError("File too large — max size is 20MB."); return false; }
    return true;
  }

  async function processFile(f: File) {
    setFile(f); setCompressedFile(null);
    if (f.type === "application/pdf") { setCompressedFile(f); return; }
    setCompressing(true);
    try { setCompressedFile(await compressImage(f)); }
    catch { setCompressedFile(f); }
    finally { setCompressing(false); }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) { setFile(null); setCompressedFile(null); return; }
    if (validateFile(f)) processFile(f);
    else { setFile(null); setCompressedFile(null); }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (validateFile(f)) processFile(f);
    else { setFile(null); setCompressedFile(null); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (!compressedFile) { setError("Please choose a file."); return; }
    if (!declarationChecked) { setError("Please confirm the upload declaration."); return; }
    if (year && !isValidYear(year, currentYear)) {
      setError(`Year must be between ${MIN_YEAR} and ${currentYear + 1}.`); return;
    }
    if (!courseId) { setError("Please select a course."); return; }

    setSubmitting(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSubmitting(false); router.push("/auth/login"); return; }

    try {
      const fd = new FormData();
      fd.append("title", title);
      if (year)       fd.append("year",        year);
      fd.append("course_id",            courseId);
      if (semesterId) fd.append("semester_id", semesterId);
      if (levelId)    fd.append("level_id",    levelId);
      fd.append("declaration_accepted", "true");
      fd.append("file",                 compressedFile);

      const res = await fetch(`${apiBase}/api/upload`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body:    fd,
      });
      if (res.status === 401) { router.push("/auth/login"); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail ?? "Upload failed.");
      }

      const submittedTitle = title; // capture before reset
      resetForm();
      await loadMyUploads(session.access_token);
      setSuccessTitle(submittedTitle); // show success screen

    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setTitle(""); setYear(""); setInstitutionId(""); setDepartmentId("");
    setLevelId(""); setCourseId(""); setSemesterId("");
    setFile(null); setCompressedFile(null);
    setDeclarationChecked(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  const savedBytes = file && compressedFile && compressedFile.size < file.size
    ? file.size - compressedFile.size : 0;

  const formValid =
    title.trim() &&
    compressedFile && !fileError && !compressing &&
    declarationChecked &&
    isValidYear(year, currentYear) &&
    !!courseId;

  if (fetching) return (
    <div className="flex min-h-[60vh] items-center justify-center" style={{ background: "var(--sp-bg)" }}>
      <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
    </div>
  );

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-10 transition-colors" style={{ background: "var(--sp-bg)" }}>
      <div className="mx-auto max-w-2xl">

        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-2">Contribute</p>
          <h1 className="text-3xl font-extrabold" style={{ color: "var(--sp-text)" }}>Upload a past question</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--sp-text-3)" }}>
            Reviewed by our team before students can access it.
          </p>
        </div>

        {/* ── Success screen or form ── */}
        {successTitle ? (
          <SuccessScreen
            uploadedTitle={successTitle}
            totalUploads={myUploads.length}
            onUploadAnother={() => setSuccessTitle(null)}
          />
        ) : (
          <form onSubmit={handleSubmit}
            className="rounded-2xl border p-6 space-y-5 transition-colors"
            style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>

            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold" style={{ color: "var(--sp-text-2)" }}>
                Title <span className="text-blue-400">*</span>
              </label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150}
                placeholder="e.g. CSC 301 — First Semester 2023"
                className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                style={{ background: "var(--sp-input-bg)", borderColor: "var(--sp-border)", color: "var(--sp-text)" }} />
            </div>

            {/* Institution + Department */}
            <div className="grid grid-cols-2 gap-4">
              <SelectField label="Institution" value={institutionId} onChange={setInstitutionId}
                disabled={institutions.length === 0} placeholder="Select institution" options={institutions} />
              <SelectField label="Department" value={departmentId} onChange={setDepartmentId}
                disabled={!institutionId || loadingDep}
                placeholder={loadingDep ? "Loading…" : "Select department"} options={departments} />
            </div>

            {/* Level + Course */}
            <div className="grid grid-cols-2 gap-4">
              <SelectField label="Level" value={levelId} onChange={setLevelId}
                disabled={levels.length === 0} placeholder="Select level" options={levels} />
              <SelectField label="Course" value={courseId} onChange={setCourseId}
                disabled={!departmentId || loadingCou}
                placeholder={loadingCou ? "Loading…" : "Select course"}
                options={courses} required />
            </div>

            {/* Semester + Year */}
            <div className="grid grid-cols-2 gap-4">
              <SelectField label="Semester" value={semesterId} onChange={setSemesterId}
                placeholder="Not specified" options={semesters} />
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold" style={{ color: "var(--sp-text-2)" }}>Year</label>
                <input value={year}
                  onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="e.g. 2023" inputMode="numeric" maxLength={4}
                  className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  style={{ background: "var(--sp-input-bg)", borderColor: "var(--sp-border)", color: "var(--sp-text)" }} />
                {year && !isValidYear(year, currentYear) && (
                  <p className="text-xs text-red-400">Enter a year between {MIN_YEAR} and {currentYear + 1}.</p>
                )}
              </div>
            </div>

            {/* File drop zone */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold" style={{ color: "var(--sp-text-2)" }}>
                File <span className="text-blue-400">*</span>
              </label>
              <label
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all ${
                  dragOver ? "border-blue-500 bg-blue-500/10"
                  : file    ? "border-emerald-500/40 bg-emerald-500/5"
                  :           "hover:border-blue-500/40 hover:bg-blue-500/5"
                }`}
                style={!dragOver && !file ? { borderColor: "var(--sp-border)" } : {}}>
                {compressing ? (
                  <><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-400" /></div>
                    <div><p className="text-sm font-semibold" style={{ color: "var(--sp-text-2)" }}>Compressing image…</p></div>
                  </>
                ) : file ? (
                  <><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" /></div>
                    <div>
                      <p className="text-sm font-semibold text-emerald-400">{compressedFile?.name ?? file.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--sp-text-3)" }}>
                        {fmtBytes(compressedFile?.size ?? file.size)}
                        {savedBytes > 0 && <span className="ml-1.5 text-emerald-400 font-medium">(saved {fmtBytes(savedBytes)})</span>}
                        {" · tap to change"}
                      </p>
                    </div>
                  </>
                ) : (
                  <><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10">
                    <CloudUpload className="h-5 w-5 text-blue-400" /></div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--sp-text-2)" }}>Drop your file here, or tap to browse</p>
                      <p className="text-xs mt-1" style={{ color: "var(--sp-text-3)" }}>PDF, JPG, PNG — max 20MB</p>
                    </div>
                  </>
                )}
                <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange} className="hidden" />
              </label>
              {fileError && (
                <p className="flex items-center gap-1.5 text-xs text-red-400">
                  <AlertCircle className="h-3.5 w-3.5" />{fileError}
                </p>
              )}
            </div>

            {/* Declaration */}
            <div className="rounded-xl border p-4 space-y-3"
              style={{ background: "var(--sp-bg-muted)", borderColor: "var(--sp-border)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--sp-text-3)" }}>
                Upload declaration
              </p>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={declarationChecked}
                  onChange={(e) => setDeclarationChecked(e.target.checked)}
                  className="mt-0.5 shrink-0 rounded accent-blue-500" />
                <span className="text-sm leading-relaxed" style={{ color: "var(--sp-text-2)" }}>
                  I confirm I have the right to share this material and have not included confidential
                  or unlawfully obtained content. I understand SparkL may review, watermark, or remove
                  this upload per the{" "}
                  <Link href="/content-guidelines" target="_blank"
                    className="text-blue-400 hover:text-blue-300 underline underline-offset-2 font-medium">
                    Content Guidelines
                  </Link>{" "}and{" "}
                  <Link href="/terms" target="_blank"
                    className="text-blue-400 hover:text-blue-300 underline underline-offset-2 font-medium">
                    Terms of Service
                  </Link>.
                </span>
              </label>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <button type="submit" disabled={!formValid || submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40">
              {submitting
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
                : <><UploadIcon className="h-4 w-4" /> Submit for review</>
              }
            </button>
          </form>
        )}

        {/* My Uploads */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold" style={{ color: "var(--sp-text)" }}>My uploads</h2>
            <span className="text-xs" style={{ color: "var(--sp-text-3)" }}>{myUploads.length} total</span>
          </div>

          {myUploads.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed px-6 py-12 text-center"
              style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-card)" }}>
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
                <FileText className="h-5 w-5 text-blue-400" />
              </div>
              <p className="text-sm font-semibold" style={{ color: "var(--sp-text-2)" }}>No uploads yet</p>
              <p className="text-xs mt-1" style={{ color: "var(--sp-text-3)" }}>
                Your submissions will appear here after you upload.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border overflow-hidden transition-colors"
              style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
              {myUploads.map((u, i) => (
                <div key={u.id}
                  className={`p-4 ${i !== myUploads.length - 1 ? "border-b" : ""}`}
                  style={i !== myUploads.length - 1 ? { borderColor: "var(--sp-border)" } : {}}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                        <FileText className="h-4 w-4 text-blue-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold" style={{ color: "var(--sp-text)" }}>{u.title}</p>
                        <p className="truncate text-xs mt-0.5" style={{ color: "var(--sp-text-3)" }}>
                          {u.course?.name ?? "—"}
                          {u.semester?.name ? ` · ${u.semester.name}` : ""}
                          {u.year ? ` · ${u.year}` : ""}
                          {" · "}
                          {new Date(u.created_at).toLocaleDateString("en-GB", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                    <StatusPill status={u.status} />
                  </div>
                  {u.status !== "rejected" && (
                    <ProcessingRow status={u.processing_status}
                      retrying={retryingId === u.id} onRetry={() => handleRetry(u.id)} />
                  )}
                  {u.status === "rejected" && u.rejection_reason && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5">
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                      <p className="text-xs text-red-400">
                        <span className="font-semibold">Rejected:</span> {u.rejection_reason}
                      </p>
                    </div>
                  )}
                  {u.extraction_quality !== null && u.extraction_quality < LOW_QUALITY && u.status !== "rejected" && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                      <p className="text-xs text-amber-400">Text extraction was unclear. An admin may request a clearer scan.</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
