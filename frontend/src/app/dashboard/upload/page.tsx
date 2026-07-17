// frontend/src/app/dashboard/upload/page.tsx
"use client";

import { useState, useCallback, useRef } from "react";
import {
  UploadCloud,
  FileText,
  X,
  ChevronDown,
  BookOpen,
  Calendar,
  Layers,
  GraduationCap,
  Building2,
  CheckCircle2,
  Loader2,
} from "lucide-react";

// TODO: replace with a real fetch to your FastAPI /departments endpoint
const MOCK_DEPARTMENTS = [
  { id: "d1", name: "Computer Science" },
  { id: "d2", name: "Electrical Engineering" },
  { id: "d3", name: "Accountancy" },
  { id: "d4", name: "Mass Communication" },
];

// TODO: replace with a real fetch to your FastAPI /courses endpoint,
// filtered by the selected department_id
const MOCK_COURSES = [
  { id: "c1", course_code: "CSC201", course_title: "Data Structures", department_id: "d1" },
  { id: "c2", course_code: "CSC205", course_title: "Computer Architecture", department_id: "d1" },
  { id: "c3", course_code: "CSC211", course_title: "Discrete Mathematics", department_id: "d1" },
  { id: "c4", course_code: "EEE201", course_title: "Circuit Theory", department_id: "d2" },
];

const LEVELS = ["ND1", "ND2", "HND1", "HND2"];
const SEMESTERS = ["First Semester", "Second Semester"];
const YEARS = ["2020/2021", "2021/2022", "2022/2023", "2023/2024", "2024/2025"];

const ACCEPTED_TYPES = [".pdf", ".jpg", ".jpeg", ".png"];
const MAX_FILE_MB = 15;

type PendingFile = {
  id: string;
  file: File;
};

type UploadStatus = "idle" | "uploading" | "success" | "error";

export default function UploadPastQuestionPage() {
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [level, setLevel] = useState("");
  const [year, setYear] = useState("");
  const [semester, setSemester] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const canSubmit =
    files.length > 0 && departmentId && courseId && level && year && semester;

  const filteredCourses = departmentId
    ? MOCK_COURSES.filter((c) => c.department_id === departmentId)
    : [];

  const addFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    setErrorMsg("");
    const next: PendingFile[] = [];

    Array.from(fileList).forEach((file) => {
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!ACCEPTED_TYPES.includes(ext)) {
        setErrorMsg(`${file.name} isn't a supported file type.`);
        return;
      }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        setErrorMsg(`${file.name} is over ${MAX_FILE_MB}MB.`);
        return;
      }
      next.push({ id: `${file.name}-${file.size}-${Date.now()}`, file });
    });

    setFiles((prev) => [...prev, ...next]);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDepartmentChange = (id: string) => {
    setDepartmentId(id);
    setCourseId(""); // reset course since it depends on department
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setStatus("uploading");
    setErrorMsg("");

    // TODO: wire this up to Phase 6 (automated text extraction upload pipeline)
    // POST multipart/form-data to your FastAPI endpoint, e.g.:
    //
    // const formData = new FormData();
    // files.forEach((f) => formData.append("files", f.file));
    // formData.append("department_id", departmentId);
    // formData.append("course_id", courseId);
    // formData.append("level", level);
    // formData.append("year", year);
    // formData.append("semester", semester);
    //
    // const res = await fetch(`${API_BASE_URL}/api/upload`, {
    //   method: "POST",
    //   headers: { Authorization: `Bearer ${token}` },
    //   body: formData,
    // });
    // if (!res.ok) throw new Error(...)

    // mock delay so the UI has something to show for now
    await new Promise((res) => setTimeout(res, 1400));

    setStatus("success");
    setFiles([]);
    setDepartmentId("");
    setCourseId("");
    setLevel("");
    setYear("");
    setSemester("");
  };

  const selectedCourse = MOCK_COURSES.find((c) => c.id === courseId);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-2 text-blue-700">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
              <BookOpen className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold tracking-wide">SPARKL</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Upload a past question
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Share a past question paper with your department. It'll be reviewed
            and made searchable for other students.
          </p>
        </div>

        {status === "success" ? (
          <SuccessCard onUploadAnother={() => setStatus("idle")} />
        ) : (
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
            {/* Dropzone */}
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Files
            </label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
                isDragging
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/50"
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={ACCEPTED_TYPES.join(",")}
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <UploadCloud className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-slate-700">
                Drag files here, or{" "}
                <span className="text-blue-600 underline underline-offset-2">
                  browse
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                PDF, JPG or PNG · up to {MAX_FILE_MB}MB each
              </p>
            </div>

            {errorMsg && (
              <p className="mt-2 text-sm text-red-600">{errorMsg}</p>
            )}

            {/* File list */}
            {files.length > 0 && (
              <ul className="mt-4 space-y-2">
                {files.map(({ id, file }) => (
                  <li
                    key={id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-blue-600" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-700">
                          {file.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {formatSize(file.size)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(id)}
                      className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                      aria-label={`Remove ${file.name}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Metadata */}
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SelectField
                label="Department"
                icon={<Building2 className="h-4 w-4" />}
                value={departmentId}
                onChange={handleDepartmentChange}
                placeholder="Select department"
                options={MOCK_DEPARTMENTS.map((d) => ({
                  value: d.id,
                  label: d.name,
                }))}
                className="sm:col-span-2"
              />
              <SelectField
                label="Course"
                icon={<BookOpen className="h-4 w-4" />}
                value={courseId}
                onChange={setCourseId}
                placeholder={
                  departmentId ? "Select course" : "Select department first"
                }
                disabled={!departmentId}
                options={filteredCourses.map((c) => ({
                  value: c.id,
                  label: `${c.course_code} — ${c.course_title}`,
                }))}
                className="sm:col-span-2"
              />
              <SelectField
                label="Level"
                icon={<GraduationCap className="h-4 w-4" />}
                value={level}
                onChange={setLevel}
                placeholder="Select level"
                options={LEVELS.map((l) => ({ value: l, label: l }))}
              />
              <SelectField
                label="Semester"
                icon={<Layers className="h-4 w-4" />}
                value={semester}
                onChange={setSemester}
                placeholder="Select semester"
                options={SEMESTERS.map((s) => ({ value: s, label: s }))}
              />
              <SelectField
                label="Academic year"
                icon={<Calendar className="h-4 w-4" />}
                value={year}
                onChange={setYear}
                placeholder="Select year"
                options={YEARS.map((y) => ({ value: y, label: y }))}
                className="sm:col-span-2"
              />
            </div>

            {/* Submit */}
            <button
              type="button"
              disabled={!canSubmit || status === "uploading"}
              onClick={handleSubmit}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              {status === "uploading" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Upload past question"
              )}
            </button>

            {selectedCourse && (
              <p className="mt-3 text-center text-xs text-slate-400">
                Uploading for {selectedCourse.course_code} · {level || "—"} ·{" "}
                {semester || "—"} · {year || "—"}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SelectField({
  label,
  icon,
  value,
  onChange,
  placeholder,
  options,
  disabled = false,
  className = "",
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          {icon}
        </span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
    </div>
  );
}

function SuccessCard({ onUploadAnother }: { onUploadAnother: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-slate-100 bg-white p-10 text-center shadow-sm">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
        <CheckCircle2 className="h-7 w-7" />
      </div>
      <h2 className="text-lg font-semibold text-slate-900">
        Upload received
      </h2>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        Your file is queued for verification. It'll appear on the course page
        once reviewed.
      </p>
      <button
        onClick={onUploadAnother}
        className="mt-6 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Upload another
      </button>
    </div>
  );
}