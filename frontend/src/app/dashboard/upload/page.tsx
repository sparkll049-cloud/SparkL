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
    return (
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600">
        <XCircle className="h-3 w-3" />
        Rejected
      </span>
    );
  }
  return (
    <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
      <Clock className="h-3 w-3" />
      Pending
    </span>
  );
}