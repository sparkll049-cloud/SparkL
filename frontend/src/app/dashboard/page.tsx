"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  BookOpen,
  Upload,
  FileText,
  Loader2,
  School,
  Layers,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";

interface Course {
  id: string;
  name: string;
}

interface Profile {
  full_name: string | null;
  phone: string | null;
  institution: { name: string } | null;
  department: { name: string } | null;
  level: { name: string } | null;
  study_mode: { name: string } | null;
  courses?: Course[];
}

interface PastQuestion {
  id: string;
  title: string;
  year: string | null;
  created_at: string;
  course: { name: string } | null;
}

interface DashboardData {
  profile: Profile;
  recent_questions: PastQuestion[];
  stats: {
    questions_in_courses: number;
    my_uploads: number;
  };
}

export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
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
          `${process.env.NEXT_PUBLIC_API_URL}/api/dashboard/summary`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        if (!res.ok) {
          throw new Error("Failed to load dashboard data.");
        }

        const json: DashboardData = await res.json();

        const courses = Array.isArray(json?.profile?.courses)
          ? json.profile.courses
          : [];

        if (
          !json?.profile?.institution ||
          !json?.profile?.department ||
          courses.length === 0
        ) {
          router.push("/onboarding");
          return;
        }

        setData(json);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Something went wrong."
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-slate-600">{error}</p>
        <Link
          href="/auth/login"
          className="font-semibold text-blue-600 hover:underline"
        >
          Go to Login
        </Link>
      </div>
    );
  }

  if (!data) return null;

  const profile = data.profile ?? {};
  const courses = Array.isArray(profile.courses) ? profile.courses : [];
  const questions = Array.isArray(data.recent_questions)
    ? data.recent_questions
    : [];
  const stats = data.stats ?? { questions_in_courses: 0, my_uploads: 0 };

  return (
    <div className="pb-16">
      {/* Header */}
      <div className="rounded-b-3xl bg-gradient-to-r from-blue-700 to-blue-500 px-6 py-10 text-white">
        <div className="mx-auto max-w-5xl">
          <p className="text-blue-100">Welcome back,</p>
          <h1 className="mt-1 text-3xl font-bold">
            {profile.full_name ?? "Student"}
          </h1>
        </div>
      </div>

      <div className="mx-auto -mt-6 max-w-5xl px-6">
        {/* Profile Summary Card */}
        <div className="rounded-2xl bg-white p-6 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <GraduationCap size={24} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Academic Profile
              </h2>
              <p className="text-sm text-slate-500">
                Your onboarding details
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ProfileField
              icon={<School size={18} />}
              label="Institution"
              value={profile.institution?.name}
            />
            <ProfileField
              icon={<BookOpen size={18} />}
              label="Department"
              value={profile.department?.name}
            />
            <ProfileField
              icon={<GraduationCap size={18} />}
              label="Level"
              value={profile.level?.name}
            />
            <ProfileField
              icon={<Layers size={18} />}
              label="Study Mode"
              value={profile.study_mode?.name}
            />
          </div>

          {/* Courses */}
          <div className="mt-5 border-t border-slate-100 pt-5">
            <p className="text-xs font-medium text-slate-500">
              Your Courses ({courses.length})
            </p>

            <div className="mt-2 flex flex-wrap gap-2">
              {courses.map((course) => (
                <span
                  key={course.id}
                  className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700"
                >
                  {course.name}
                </span>
              ))}
            </div>

            <Link
              href="/onboarding"
              className="mt-3 inline-block text-sm font-semibold text-blue-600 hover:underline"
            >
              Update courses
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard
            icon={<FileText size={22} className="text-blue-600" />}
            label="Past Questions Across Your Courses"
            value={stats.questions_in_courses}
          />
          <StatCard
            icon={<Upload size={22} className="text-blue-600" />}
            label="Your Uploads"
            value={stats.my_uploads}
          />
        </div>

        {/* Recent Past Questions */}
        <div className="mt-6 rounded-2xl bg-white p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              Recent Past Questions
            </h2>

            <Link
              href="/dashboard/courses"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              View all
            </Link>
          </div>

          {questions.length === 0 ? (
            <div className="mt-6 flex flex-col items-center justify-center gap-2 py-10 text-center">
              <FileText size={32} className="text-slate-300" />
              <p className="text-sm text-slate-500">
                No past questions available for your courses yet.
              </p>
              <Link
                href="/upload"
                className="mt-2 text-sm font-semibold text-blue-600 hover:underline"
              >
                Upload one
              </Link>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-slate-100">
              {questions.map((q) => (
                <div
                  key={q.id}
                  className="flex items-center justify-between py-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                      <FileText size={18} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">
                        {q.title}
                      </p>
                      <p className="text-sm text-slate-500">
                        {q.course?.name ?? "—"}
                        {q.year ? ` · ${q.year}` : ""}
                      </p>
                    </div>
                  </div>

                  <Link
                    href={`/questions/${q.id}`}
                    className="text-sm font-semibold text-blue-600 hover:underline"
                  >
                    View
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileField({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-3">
      <div className="mt-0.5 text-slate-400">{icon}</div>
      <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="text-sm font-semibold text-slate-900">
          {value ?? "Not set"}
        </p>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-white p-6 shadow-lg">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}