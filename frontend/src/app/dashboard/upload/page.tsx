"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Upload as UploadIcon,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";

interface Option {
  id: string;
  name: string;
}

interface MyUpload {
  id: string;
  title: string;
  year: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  rejection_reason: string | null;
  extraction_quality: number | null;
  course: { name: string } | null;
  semester: { name: string } | null;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB, mirrors backend limit
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MIN_YEAR = 1990;
const LOW_QUALITY_THRESHOLD = 0.5;

function isValidYear(y: string, currentYear: number) {
  if (!y) return true; // optional field
  return /^\d{4}$/.test(y) && Number(y) >= MIN_YEAR && Number(y) <= currentYear + 1;
}

export default function UploadPage() {
  const supabase = createClient();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [institutions, setInstitutions] = useState<Option[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [levels, setLevels] = useState<Option[]>([]); // global, informational only — no relationship to courses
  const [courses, setCourses] = useState<Option[]>([]);
  const [semesters, setSemesters] = useState<Option[]>([]);
  const [myUploads, setMyUploads] = useState<MyUpload[]>([]);

  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [fetching, setFetching] = useState(true);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [fileError, setFileError] = useState("");

  const currentYear = new Date().getFullYear();

  // ---- Initial load: institutions + levels (global) + semesters + upload history ----
  useEffect(() => {
    async function loadInitial() {
      setFetching(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/auth/login");
        return;
      }

      const [
        { data: institutionsData },
        { data: levelsData },
        { data: semestersData },
      ] = await Promise.all([
        supabase.from("institutions").select("id, name").order("name"),
        supabase.from("levels").select("id, name").order("name"),
        supabase.from("semesters").select("id, name").order("name"),
      ]);

      setInstitutions(institutionsData ?? []);
      setLevels(levelsData ?? []);
      setSemesters(semestersData ?? []);

      await loadMyUploads(session.access_token);
      setFetching(false);
    }

    loadInitial();
  }, []);

  // ---- Cascade: institution -> departments ----
  useEffect(() => {
    setDepartmentId("");
    setDepartments([]);
    setCourseId("");
    setCourses([]);

    if (!institutionId) return;

    async function loadDepartments() {
      setLoadingDepartments(true);
      const { data } = await supabase
        .from("departments")
        .select("id, name")
        .eq("institution_id", institutionId)
        .order("name");
      setDepartments(data ?? []);
      setLoadingDepartments(false);
    }

    loadDepartments();
  }, [institutionId]);

  // ---- Cascade: department -> courses ----
  // Courses only have department_id in the real schema. There is no level_id
  // column on courses, so Level cannot and does not filter this query — it's
  // kept purely as an informational/profile field.
  useEffect(() => {
    setCourseId("");
    setCourses([]);

    if (!departmentId) return;

    async function loadCourses() {
      setLoadingCourses(true);
      const { data } = await supabase
        .from("courses")
        .select("id, name")
        .eq("department_id", departmentId)
        .order("name");
      setCourses(data ?? []);
      setLoadingCourses(false);
    }

    loadCourses();
  }, [departmentId]);

  async function loadMyUploads(token: string) {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/upload/mine`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }

      if (res.ok) setMyUploads(await res.json());
    } catch {
      // Non-critical — the upload history is secondary to the form itself
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError("");
    const selected = e.target.files?.[0] ?? null;

    if (!selected) {
      setFile(null);
      return;
    }

    if (!ALLOWED_TYPES.includes(selected.type)) {
      setFileError("Only PDF, JPG, and PNG files are allowed.");
      setFile(null);
      return;
    }

    if (selected.size > MAX_FILE_SIZE) {
      setFileError("File is too large. Maximum size is 10MB.");
      setFile(null);
      return;
    }

    setFile(selected);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!file) {
      setError("Please choose a file to upload.");
      return;
    }

    if (year && !isValidYear(year, currentYear)) {
      setError(`Year must be a 4-digit number between ${MIN_YEAR} and ${currentYear + 1}.`);
      return;
    }

    setSubmitting(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setSubmitting(false);
      router.push("/auth/login");
      return;
    }

    const formData = new FormData();
    formData.append("title", title);
    if (year) formData.append("year", year);
    formData.append("course_id", courseId);
    if (semesterId) formData.append("semester_id", semesterId);
    formData.append("file", file);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/upload`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        }
      );

      if (res.status === 401) {
        setSubmitting(false);
        router.push("/auth/login");
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail ?? "Upload failed. Please try again.");
      }

      setSuccess(true);
      setTitle("");
      setYear("");
      setInstitutionId("");
      setDepartmentId("");
      setLevelId("");
      setCourseId("");
      setSemesterId("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      await loadMyUploads(session.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  const formValid =
    title.trim() && courseId && file && !fileError && isValidYear(year, currentYear);

  if (fetching) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
            <UploadIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Upload Past Question</h1>
            <p className="text-sm text-slate-500">
              It'll be reviewed by an admin before it appears to other students.
            </p>
          </div>
        </div>

        {institutions.length === 0 && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-4">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-sm text-amber-800">
              No institutions are set up yet. Check back once your school has
              been added to the platform.
            </p>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"
        >
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={150}
              placeholder="e.g. CSC 301 - First Semester Exam"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Institution
              </label>
              <select
                value={institutionId}
                onChange={(e) => setInstitutionId(e.target.value)}
                disabled={institutions.length === 0}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
              >
                <option value="" disabled>
                  Select institution
                </option>
                {institutions.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Department
              </label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                disabled={!institutionId || loadingDepartments}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
              >
                <option value="" disabled>
                  {loadingDepartments ? "Loading..." : "Select department"}
                </option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Level <span className="font-normal text-slate-400">(for reference)</span>
              </label>
              <select
                value={levelId}
                onChange={(e) => setLevelId(e.target.value)}
                disabled={levels.length === 0}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
              >
                <option value="" disabled>
                  Select level
                </option>
                {levels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Course
              </label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                disabled={!departmentId || loadingCourses}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
              >
                <option value="" disabled>
                  {loadingCourses ? "Loading..." : "Select course"}
                </option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Semester
              </label>
              <select
                value={semesterId}
                onChange={(e) => setSemesterId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Not specified</option>
                {semesters.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Year
              </label>
              <input
                value={year}
                onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="e.g. 2023"
                inputMode="numeric"
                maxLength={4}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              {year && !isValidYear(year, currentYear) && (
                <p className="mt-1.5 text-xs text-red-500">
                  Enter a year between {MIN_YEAR} and {currentYear + 1}.
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              File
            </label>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-4 py-8 text-center transition hover:border-blue-300 hover:bg-blue-50/40">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <UploadIcon className="h-4 w-4" />
              </div>
              <span className="text-sm text-slate-500">
                {file ? file.name : "Click to choose a PDF, JPG, or PNG (max 10MB)"}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            {fileError && (
              <p className="mt-1.5 text-sm text-red-500">{fileError}</p>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
          {success && (
            <p className="flex items-center gap-1.5 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              Uploaded — pending admin approval.
            </p>
          )}

          <button
            type="submit"
            disabled={!formValid || submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Uploading..." : "Upload"}
          </button>
        </form>

        {/* My Uploads history */}
        <div className="mt-8">
          <h2 className="mb-3 text-base font-semibold text-slate-900">My Uploads</h2>

          {myUploads.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-500">
                <FileText className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-slate-700">
                You haven't uploaded anything yet
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
              <div className="divide-y divide-slate-100">
                {myUploads.map((u) => (
                  <div key={u.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {u.title}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {u.course?.name ?? "—"}
                            {u.semester?.name ? ` · ${u.semester.name}` : ""}
                            {u.year ? ` · ${u.year}` : ""}
                          </p>
                        </div>
                      </div>
                      <UploadStatusPill status={u.status} />
                    </div>

                    {u.status === "rejected" && u.rejection_reason && (
                      <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                        Reason: {u.rejection_reason}
                      </p>
                    )}

                    {u.extraction_quality !== null &&
                      u.extraction_quality < LOW_QUALITY_THRESHOLD &&
                      u.status !== "rejected" && (
                        <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          Text extraction looks unclear on this file — it's
                          still under review, an admin may reach out if the
                          scan needs retaking.
                        </p>
                      )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UploadStatusPill({ status }: { status: string }) {
  if (status === "approved") {
    return (
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        Approved
      </span>
    );
  }
  if (status === "rejected") {
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Upload as UploadIcon,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  CloudUpload,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

interface Option { id: string; name: string; }

interface MyUpload {
  id: string;
  title: string;
  year: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  rejection_reason: string | null;
  extraction_quality: number | null;
  course: { name: string } | null;
  semester: { name: string } | null;
}

const MAX_FILE_SIZE       = 20 * 1024 * 1024;
const ALLOWED_TYPES       = ["application/pdf", "image/jpeg", "image/png"];
const MIN_YEAR            = 1990;
const LOW_QUALITY_THRESHOLD = 0.5;

function isValidYear(y: string, currentYear: number) {
  if (!y) return true;
  return /^\d{4}$/.test(y) && Number(y) >= MIN_YEAR && Number(y) <= currentYear + 1;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SelectField({
  label,
  value,
  onChange,
  disabled,
  placeholder,
  options,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder: string;
  options: Option[];
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-400">
        {label}
        {required && <span className="ml-0.5 text-blue-400">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-200 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-40 appearance-none"
      >
        <option value="" disabled className="bg-[#0D1230]">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id} className="bg-[#0D1230]">{o.name}</option>
        ))}
      </select>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map = {
    approved: { bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: <CheckCircle2 className="h-3 w-3" />, label: "Approved" },
    rejected: { bg: "bg-red-500/10 text-red-400 border-red-500/20",             icon: <XCircle className="h-3 w-3" />,       label: "Rejected" },
    pending:  { bg: "bg-amber-500/10 text-amber-400 border-amber-500/20",        icon: <Clock className="h-3 w-3" />,          label: "Pending" },
  };
  const s = map[status as keyof typeof map] ?? map.pending;
  return (
    <span className={`flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${s.bg}`}>
      {s.icon}{s.label}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function UploadPage() {
  const supabase    = createClient();
  const router      = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const [file,          setFile]          = useState<File | null>(null);

  const [fetching,           setFetching]           = useState(true);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [loadingCourses,     setLoadingCourses]     = useState(false);
  const [submitting,         setSubmitting]         = useState(false);
  const [dragOver,           setDragOver]           = useState(false);

  const [error,     setError]     = useState("");
  const [success,   setSuccess]   = useState(false);
  const [fileError, setFileError] = useState("");

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    async function loadInitial() {
      setFetching(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth/login"); return; }

      const [
        { data: instData },
        { data: levData },
        { data: semData },
      ] = await Promise.all([
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
    setDepartmentId(""); setDepartments([]);
    setCourseId("");     setCourses([]);
    if (!institutionId) return;
    setLoadingDepartments(true);
    supabase.from("departments").select("id, name")
      .eq("institution_id", institutionId).order("name")
      .then(({ data }) => { setDepartments(data ?? []); setLoadingDepartments(false); });
  }, [institutionId]);

  useEffect(() => {
    setCourseId(""); setCourses([]);
    if (!departmentId) return;
    setLoadingCourses(true);
    supabase.from("courses").select("id, name")
      .eq("department_id", departmentId).order("name")
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    if (!selected) { setFile(null); return; }
    if (validateFile(selected)) setFile(selected);
    else setFile(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) return;
    if (validateFile(dropped)) setFile(dropped);
    else setFile(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess(false);
    if (!file)  { setError("Please choose a file."); return; }
    if (year && !isValidYear(year, currentYear)) {
      setError(`Year must be between ${MIN_YEAR} and ${currentYear + 1}.`);
      return;
    }
    setSubmitting(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSubmitting(false); router.push("/auth/login"); return; }

    const formData = new FormData();
    formData.append("title", title);
    if (year)       formData.append("year", year);
    formData.append("course_id", courseId);
    if (semesterId) formData.append("semester_id", semesterId);
    formData.append("file", file);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
      if (res.status === 401) { setSubmitting(false); router.push("/auth/login"); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail ?? "Upload failed. Please try again.");
      }
      setSuccess(true);
      setTitle(""); setYear(""); setInstitutionId(""); setDepartmentId("");
      setLevelId(""); setCourseId(""); setSemesterId(""); setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadMyUploads(session.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  const formValid = title.trim() && courseId && file && !fileError && isValidYear(year, currentYear);

  if (fetching) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07091A] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-2xl">

        {/* ── Header ── */}
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-2">
            Contribute
          </p>
          <h1 className="text-3xl font-extrabold text-white">
            Upload a past question
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Reviewed by our team before students can access it.
            You earn points when it's approved.
          </p>
        </div>

        {/* ── No institutions warning ── */}
        {institutions.length === 0 && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p className="text-sm text-amber-300">
              No institutions are set up yet. Check back once your school has been added.
            </p>
          </div>
        )}

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} className="rounded-2xl border border-white/[0.06] bg-[#0D1230] p-6 space-y-5">

          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400">
              Title <span className="text-blue-400">*</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={150}
              placeholder="e.g. CSC 301 — First Semester 2023"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-600 transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Institution + Department */}
          <div className="grid grid-cols-2 gap-4">
            <SelectField
              label="Institution"
              value={institutionId}
              onChange={setInstitutionId}
              disabled={institutions.length === 0}
              placeholder="Select institution"
              options={institutions}
            />
            <SelectField
              label="Department"
              value={departmentId}
              onChange={setDepartmentId}
              disabled={!institutionId || loadingDepartments}
              placeholder={loadingDepartments ? "Loading…" : "Select department"}
              options={departments}
            />
          </div>

          {/* Level + Course */}
          <div className="grid grid-cols-2 gap-4">
            <SelectField
              label="Level"
              value={levelId}
              onChange={setLevelId}
              disabled={levels.length === 0}
              placeholder="Select level"
              options={levels}
            />
            <SelectField
              label="Course"
              value={courseId}
              onChange={setCourseId}
              disabled={!departmentId || loadingCourses}
              placeholder={loadingCourses ? "Loading…" : "Select course"}
              options={courses}
              required
            />
          </div>

          {/* Semester + Year */}
          <div className="grid grid-cols-2 gap-4">
            <SelectField
              label="Semester"
              value={semesterId}
              onChange={setSemesterId}
              placeholder="Not specified"
              options={semesters}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400">Year</label>
              <input
                value={year}
                onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="e.g. 2023"
                inputMode="numeric"
                maxLength={4}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-600 transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
              {year && !isValidYear(year, currentYear) && (
                <p className="text-xs text-red-400">
                  Enter a year between {MIN_YEAR} and {currentYear + 1}.
                </p>
              )}
            </div>
          </div>

          {/* File drop zone */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400">
              File <span className="text-blue-400">*</span>
            </label>
            <label
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all ${
                dragOver
                  ? "border-blue-500 bg-blue-500/10"
                  : file
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : "border-white/10 bg-white/[0.02] hover:border-blue-500/40 hover:bg-blue-500/5"
              }`}
            >
              {file ? (
                <>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-400">{file.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {(file.size / 1024 / 1024).toFixed(2)} MB — tap to change
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10">
                    <CloudUpload className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-300">
                      Drop your file here, or tap to browse
                    </p>
                    <p className="text-xs text-slate-600 mt-1">PDF, JPG, PNG — max 20MB</p>
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

          {/* Errors / success */}
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

          {/* Submit */}
          <button
            type="submit"
            disabled={!formValid || submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading — extracting text…</>
              : <><UploadIcon className="h-4 w-4" /> Submit for review</>
            }
          </button>

          <p className="text-center text-xs text-slate-600">
            We extract text from your file to make it searchable. Blurry or
            unreadable files will be flagged before submission.
          </p>
        </form>

        {/* ── My Uploads ── */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-white">My uploads</h2>
            <span className="text-xs text-slate-600">{myUploads.length} total</span>
          </div>

          {myUploads.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
                <FileText className="h-5 w-5 text-blue-400" />
              </div>
              <p className="text-sm font-semibold text-slate-400">No uploads yet</p>
              <p className="text-xs text-slate-600 mt-1">
                Your submissions will appear here after you upload.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.06] bg-[#0D1230] overflow-hidden">
              {myUploads.map((u, i) => (
                <div
                  key={u.id}
                  className={`p-4 ${i !== myUploads.length - 1 ? "border-b border-white/[0.05]" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                        <FileText className="h-4 w-4 text-blue-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-200">
                          {u.title}
                        </p>
                        <p className="truncate text-xs text-slate-500 mt-0.5">
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

                  {u.extraction_quality !== null &&
                    u.extraction_quality < LOW_QUALITY_THRESHOLD &&
                    u.status !== "rejected" && (
                      <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                        <p className="text-xs text-amber-400">
                          Text extraction was unclear on this file. An admin may
                          request a clearer scan.
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