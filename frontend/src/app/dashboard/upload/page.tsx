"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Upload as UploadIcon, FileText, Loader2, CheckCircle2,
  XCircle, Clock, AlertCircle, CloudUpload,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

interface Option { id: string; name: string; }
interface MyUpload {
  id: string; title: string; year: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string; rejection_reason: string | null;
  extraction_quality: number | null;
  course: { name: string } | null;
  semester: { name: string } | null;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MIN_YEAR = 1990;
const LOW_QUALITY_THRESHOLD = 0.5;

// ── Image compression ─────────────────────────────────────────────────────────

async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const MAX_DIMENSION = 1920;
      let { width, height } = img;

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          // Only use compressed version if it's actually smaller
          if (blob.size < file.size) {
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
          } else {
            resolve(file);
          }
        },
        "image/jpeg",
        0.82 // quality — good balance between size and readability for scanned docs
      );
    };

    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidYear(y: string, currentYear: number) {
  if (!y) return true;
  return /^\d{4}$/.test(y) && Number(y) >= MIN_YEAR && Number(y) <= currentYear + 1;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-40 appearance-none"
        style={{
          background: "var(--sp-input-bg)",
          borderColor: "var(--sp-border)",
          color: "var(--sp-text)",
        }}
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

// ── Main component ────────────────────────────────────────────────────────────

export default function UploadPage() {
  const supabase = createClient();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [institutions, setInstitutions] = useState<Option[]>([]);
  const [departments,  setDepartments]  = useState<Option[]>([]);
  const [levels,       setLevels]       = useState<Option[]>([]);
  const [courses,      setCourses]      = useState<Option[]>([]);
  const [semesters,    setSemesters]    = useState<Option[]>([]);
  const [myUploads,    setMyUploads]    = useState<MyUpload[]>([]);

  const [title, setTitle]                 = useState("");
  const [year, setYear]                   = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [departmentId, setDepartmentId]   = useState("");
  const [levelId, setLevelId]             = useState("");
  const [courseId, setCourseId]           = useState("");
  const [semesterId, setSemesterId]       = useState("");
  const [file, setFile]                   = useState<File | null>(null);
  const [compressedFile, setCompressedFile] = useState<File | null>(null);
  const [compressing, setCompressing]     = useState(false);

  const [fetching,           setFetching]           = useState(true);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [loadingCourses,     setLoadingCourses]     = useState(false);
  const [submitting,         setSubmitting]         = useState(false);
  const [dragOver,           setDragOver]           = useState(false);
  const [error,              setError]              = useState("");
  const [success,            setSuccess]            = useState(false);
  const [fileError,          setFileError]          = useState("");

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    async function loadInitial() {
      setFetching(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth/login"); return; }
      const [{ data: instData }, { data: levData }, { data: semData }] = await Promise.all([
        supabase.from("institutions").select("id, name").order("name"),
        supabase.from("levels").select("id, name").order("name"),
        supabase.from("semesters").select("id, name").order("name"),
      ]);
      setInstitutions(instData ?? []);
      setLevels(levData ?? []);
      setSemesters(semData ?? []);
      await loadMyUploads(session.access_token);
      setFetching(false);
    }
    loadInitial();
  }, []);

  useEffect(() => {
    setDepartmentId(""); setDepartments([]); setCourseId(""); setCourses([]);
    if (!institutionId) return;
    setLoadingDepartments(true);
    supabase.from("departments").select("id, name").eq("institution_id", institutionId).order("name")
      .then(({ data }) => { setDepartments(data ?? []); setLoadingDepartments(false); });
  }, [institutionId]);

  useEffect(() => {
    setCourseId(""); setCourses([]);
    if (!departmentId) return;
    setLoadingCourses(true);
    supabase.from("courses").select("id, name").eq("department_id", departmentId).order("name")
      .then(({ data }) => { setCourses(data ?? []); setLoadingCourses(false); });
  }, [departmentId]);

  async function loadMyUploads(token: string) {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { router.push("/auth/login"); return; }
      if (res.ok) setMyUploads(await res.json());
    } catch { /* non-critical */ }
  }

  function validateFile(selected: File): boolean {
    setFileError("");
    if (!ALLOWED_TYPES.includes(selected.type)) {
      setFileError("Only PDF, JPG, and PNG files are allowed.");
      return false;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setFileError("File too large — max size is 20MB.");
      return false;
    }
    return true;
  }

  async function processFile(selected: File) {
    setFile(selected);
    setCompressedFile(null);

    // Only compress images — PDFs are passed through as-is
    if (selected.type === "application/pdf") {
      setCompressedFile(selected);
      return;
    }

    setCompressing(true);
    try {
      const compressed = await compressImage(selected);
      setCompressedFile(compressed);
    } catch {
      setCompressedFile(selected); // fallback to original
    } finally {
      setCompressing(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    if (!selected) { setFile(null); setCompressedFile(null); return; }
    if (validateFile(selected)) processFile(selected);
    else { setFile(null); setCompressedFile(null); }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) return;
    if (validateFile(dropped)) processFile(dropped);
    else { setFile(null); setCompressedFile(null); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setSuccess(false);
    if (!compressedFile) { setError("Please choose a file."); return; }
    if (year && !isValidYear(year, currentYear)) {
      setError(`Year must be between ${MIN_YEAR} and ${currentYear + 1}.`);
      return;
    }
    setSubmitting(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSubmitting(false); router.push("/auth/login"); return; }

    const formData = new FormData();
    formData.append("title", title);
    if (year) formData.append("year", year);
    formData.append("course_id", courseId);
    if (semesterId) formData.append("semester_id", semesterId);
    formData.append("file", compressedFile);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
      if (res.status === 401) { setSubmitting(false); router.push("/auth/login"); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail ?? "Upload failed.");
      }
      setSuccess(true);
      setTitle(""); setYear(""); setInstitutionId(""); setDepartmentId("");
      setLevelId(""); setCourseId(""); setSemesterId("");
      setFile(null); setCompressedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadMyUploads(session.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  const formValid = title.trim() && courseId && compressedFile && !fileError &&
    !compressing && isValidYear(year, currentYear);

  const savedBytes = file && compressedFile && compressedFile.size < file.size
    ? file.size - compressedFile.size
    : 0;

  if (fetching) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" style={{ background: "var(--sp-bg)" }}>
        <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-10 transition-colors" style={{ background: "var(--sp-bg)" }}>
      <div className="mx-auto max-w-2xl">

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-2">Contribute</p>
          <h1 className="text-3xl font-extrabold" style={{ color: "var(--sp-text)" }}>Upload a past question</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--sp-text-3)" }}>
            Reviewed by our team before students can access it. You earn points when it's approved.
          </p>
        </div>

        {institutions.length === 0 && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p className="text-sm text-amber-300">No institutions are set up yet. Check back once your school has been added.</p>
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border p-6 space-y-5 transition-colors"
          style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold" style={{ color: "var(--sp-text-2)" }}>
              Title <span className="text-blue-400">*</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={150}
              placeholder="e.g. CSC 301 — First Semester 2023"
              className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              style={{ background: "var(--sp-input-bg)", borderColor: "var(--sp-border)", color: "var(--sp-text)" }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Institution" value={institutionId} onChange={setInstitutionId}
              disabled={institutions.length === 0} placeholder="Select institution" options={institutions} />
            <SelectField label="Department" value={departmentId} onChange={setDepartmentId}
              disabled={!institutionId || loadingDepartments}
              placeholder={loadingDepartments ? "Loading…" : "Select department"} options={departments} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Level" value={levelId} onChange={setLevelId}
              disabled={levels.length === 0} placeholder="Select level" options={levels} />
            <SelectField label="Course" value={courseId} onChange={setCourseId}
              disabled={!departmentId || loadingCourses}
              placeholder={loadingCourses ? "Loading…" : "Select course"} options={courses} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Semester" value={semesterId} onChange={setSemesterId}
              placeholder="Not specified" options={semesters} />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold" style={{ color: "var(--sp-text-2)" }}>Year</label>
              <input
                value={year}
                onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="e.g. 2023"
                inputMode="numeric"
                maxLength={4}
                className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                style={{ background: "var(--sp-input-bg)", borderColor: "var(--sp-border)", color: "var(--sp-text)" }}
              />
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
                :           "border-white/10 hover:border-blue-500/40 hover:bg-blue-500/5"
              }`}
              style={!dragOver && !file ? { borderColor: "var(--sp-border)" } : {}}
            >
              {compressing ? (
                <>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--sp-text-2)" }}>Compressing image…</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--sp-text-3)" }}>Optimising for faster upload</p>
                  </div>
                </>
              ) : file ? (
                <>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-400">{compressedFile?.name ?? file.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--sp-text-3)" }}>
                      {formatBytes(compressedFile?.size ?? file.size)}
                      {savedBytes > 0 && (
                        <span className="ml-1.5 text-emerald-400 font-medium">
                          (saved {formatBytes(savedBytes)})
                        </span>
                      )}
                      {" · tap to change"}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10">
                    <CloudUpload className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--sp-text-2)" }}>
                      Drop your file here, or tap to browse
                    </p>
                    <p className="text-xs mt-1" style={{ color: "var(--sp-text-3)" }}>
                      PDF, JPG, PNG — max 20MB · images auto-compressed
                    </p>
                  </div>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            {fileError && (
              <p className="flex items-center gap-1.5 text-xs text-red-400">
                <AlertCircle className="h-3.5 w-3.5" />{fileError}
              </p>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <p className="text-sm text-emerald-400">
                Uploaded — pending admin review. You'll be notified when it's approved.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={!formValid || submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
              : <><UploadIcon className="h-4 w-4" /> Submit for review</>
            }
          </button>

          <p className="text-center text-xs" style={{ color: "var(--sp-text-3)" }}>
            We extract text from your file to make it searchable. Images are compressed automatically before upload.
          </p>
        </form>

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
                  style={i !== myUploads.length - 1 ? { borderColor: "var(--sp-border)" } : {}}
                >
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

                  {u.status === "rejected" && u.rejection_reason && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5">
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                      <p className="text-xs text-red-400">
                        <span className="font-semibold">Rejected:</span> {u.rejection_reason}
                      </p>
                    </div>
                  )}

                  {u.extraction_quality !== null && u.extraction_quality < LOW_QUALITY_THRESHOLD && u.status !== "rejected" && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                      <p className="text-xs text-amber-400">
                        Text extraction was unclear. An admin may request a clearer scan.
                      </p>
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