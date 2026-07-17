// frontend/src/app/dashboard/courses/[id]/page.tsx
"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  Download,
  Calendar,
  Layers,
  CheckCircle2,
  Clock,
  XCircle,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  BadgeCheck,
} from "lucide-react";

// TODO: replace with a fetch of the course by id from Supabase
const MOCK_COURSE_DETAILS: Record<
  string,
  { course_code: string; course_title: string; department: string; level: string }
> = {
  c1: { course_code: "CSC201", course_title: "Data Structures", department: "Computer Science", level: "ND1" },
  c2: { course_code: "CSC205", course_title: "Computer Architecture", department: "Computer Science", level: "ND1" },
  c3: { course_code: "CSC211", course_title: "Discrete Mathematics", department: "Computer Science", level: "ND1" },
  c4: { course_code: "CSC221", course_title: "Object Oriented Programming", department: "Computer Science", level: "ND1" },
  c5: { course_code: "GNS201", course_title: "Use of English II", department: "Computer Science", level: "ND1" },
  c6: { course_code: "EEE201", course_title: "Circuit Theory", department: "Electrical Engineering", level: "HND1" },
  c7: { course_code: "ACT101", course_title: "Financial Accounting", department: "Accountancy", level: "ND1" },
  c8: { course_code: "MAC201", course_title: "Mass Comm Theory", department: "Mass Communication", level: "ND1" },
};

type QuestionStatus = "pending" | "verified" | "rejected";

type PastQuestion = {
  id: string;
  course_id: string;
  file_name: string;
  year: string;
  semester: string;
  uploaded_by: string;
  status: QuestionStatus;
  created_at: string;
  solution_count: number;
  has_verified_solution: boolean;
};

// TODO: replace with a fetch of past_questions where course_id = params.id
// and status = 'verified' (students shouldn't see pending/rejected uploads
// from others — that view belongs to admin)
const MOCK_QUESTIONS: PastQuestion[] = [
  {
    id: "q1",
    course_id: "c1",
    file_name: "csc201_2023_exam.pdf",
    year: "2023/2024",
    semester: "First Semester",
    uploaded_by: "Tunde Bakare",
    status: "verified",
    created_at: "2026-07-10",
    solution_count: 3,
    has_verified_solution: true,
  },
  {
    id: "q2",
    course_id: "c1",
    file_name: "csc201_2022_exam.pdf",
    year: "2022/2023",
    semester: "Second Semester",
    uploaded_by: "Chioma Okafor",
    status: "verified",
    created_at: "2026-06-15",
    solution_count: 1,
    has_verified_solution: false,
  },
  {
    id: "q3",
    course_id: "c1",
    file_name: "csc201_2021_exam.pdf",
    year: "2021/2022",
    semester: "First Semester",
    uploaded_by: "Ijeoma Nwachukwu",
    status: "pending",
    created_at: "2026-07-12",
    solution_count: 0,
    has_verified_solution: false,
  },
  {
    id: "q4",
    course_id: "c1",
    file_name: "csc201_2020_exam.jpg",
    year: "2020/2021",
    semester: "Second Semester",
    uploaded_by: "Femi Adeyemi",
    status: "verified",
    created_at: "2026-05-02",
    solution_count: 5,
    has_verified_solution: true,
  },
];

const ALL_YEARS = ["2020/2021", "2021/2022", "2022/2023", "2023/2024"];
const ALL_SEMESTERS = ["First Semester", "Second Semester"];

export default function CourseDetailPage() {
  const params = useParams();
  const courseId = params?.id as string;

  const course = MOCK_COURSE_DETAILS[courseId];
  const [yearFilter, setYearFilter] = useState("all");
  const [semesterFilter, setSemesterFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const questions = useMemo(() => {
    return MOCK_QUESTIONS.filter((q) => {
      if (q.course_id !== courseId) return false;
      if (q.status === "rejected") return false; // never show rejected uploads to students
      if (yearFilter !== "all" && q.year !== yearFilter) return false;
      if (semesterFilter !== "all" && q.semester !== semesterFilter) return false;
      return true;
    });
  }, [courseId, yearFilter, semesterFilter]);

  const verifiedCount = questions.filter((q) => q.status === "verified").length;
  const totalSolutions = questions.reduce((sum, q) => sum + q.solution_count, 0);

  if (!course) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="text-center">
          <p className="text-sm text-slate-500">Course not found.</p>
          <Link
            href="/dashboard/courses"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to my courses
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <Image
            src="/images/logo.jpg"
            alt="SparkL"
            width={44}
            height={44}
            priority
            className="mb-4 object-contain"
          />

          <Link
            href="/dashboard/courses"
            className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-blue-600"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            My courses
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {course.course_code}
              </h1>
              <p className="text-sm text-slate-500">{course.course_title}</p>
              <p className="mt-1 text-xs text-slate-400">
                {course.department} · {course.level}
              </p>
            </div>
            <Link
              href="/dashboard/upload"
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <FileText className="h-3.5 w-3.5" />
              Upload for this course
            </Link>
          </div>

          {/* Quick stats */}
          <div className="mt-4 flex gap-3">
            <div className="rounded-xl border border-slate-100 bg-white px-4 py-2.5 shadow-sm">
              <p className="text-lg font-bold text-slate-900">{verifiedCount}</p>
              <p className="text-[11px] text-slate-400">Past questions</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-white px-4 py-2.5 shadow-sm">
              <p className="text-lg font-bold text-slate-900">{totalSolutions}</p>
              <p className="text-[11px] text-slate-400">Solutions</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-2">
          <FilterSelect
            value={yearFilter}
            onChange={setYearFilter}
            icon={<Calendar className="h-3.5 w-3.5" />}
            allLabel="All years"
            options={ALL_YEARS}
          />
          <FilterSelect
            value={semesterFilter}
            onChange={setSemesterFilter}
            icon={<Layers className="h-3.5 w-3.5" />}
            allLabel="All semesters"
            options={ALL_SEMESTERS}
          />
        </div>

        {/* Questions list */}
        <div className="space-y-3">
          {questions.length === 0 && (
            <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
              <p className="text-sm text-slate-500">
                No past questions match these filters yet.
              </p>
              <Link
                href="/dashboard/upload"
                className="mt-2 inline-block text-sm font-medium text-blue-600 hover:underline"
              >
                Be the first to upload one
              </Link>
            </div>
          )}

          {questions.map((q) => {
            const isExpanded = expandedId === q.id;
            return (
              <div
                key={q.id}
                className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : q.id)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {q.year} · {q.semester}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        uploaded by {q.uploaded_by}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <QuestionStatusBadge status={q.status} />
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50 px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        // TODO: link to the actual stored file URL
                        className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download / view
                      </button>
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <MessageSquare className="h-3.5 w-3.5" />
                        {q.solution_count} solution{q.solution_count !== 1 ? "s" : ""}
                        {q.has_verified_solution && (
                          <span className="ml-1 flex items-center gap-1 text-green-600">
                            <BadgeCheck className="h-3.5 w-3.5" />
                            verified
                          </span>
                        )}
                      </span>
                    </div>

                    {q.status === "pending" && (
                      <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-600">
                        <Clock className="h-3.5 w-3.5" />
                        This upload is still awaiting review — extracted text
                        and solutions won't show until it's verified.
                      </p>
                    )}

                    {q.status === "verified" && q.solution_count > 0 && (
                      <div className="mt-3">
                        <button className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline">
                          <ThumbsUp className="h-3.5 w-3.5" />
                          View solutions
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  icon,
  allLabel,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  icon: React.ReactNode;
  allLabel: string;
  options: string[];
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
        {icon}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-7 text-xs font-medium text-slate-600 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      >
        <option value="all">{allLabel}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

function QuestionStatusBadge({ status }: { status: QuestionStatus }) {
  const map = {
    pending: { cls: "bg-amber-100 text-amber-700", icon: Clock, label: "Pending" },
    verified: { cls: "bg-green-100 text-green-700", icon: CheckCircle2, label: "Verified" },
    rejected: { cls: "bg-red-100 text-red-700", icon: XCircle, label: "Rejected" },
  };
  const { cls, icon: Icon, label } = map[status];
  return (
    <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${cls}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}