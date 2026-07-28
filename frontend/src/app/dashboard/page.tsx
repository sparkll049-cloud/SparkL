// frontend/src/app/dashboard/page.tsx
"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  BookOpen,
  Upload,
  FileText,
  School,
  GraduationCap,
  Layers,
  ChevronRight,
  Sparkles,
  Loader2,
  ArrowRight,
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

interface RecentQuestion {
  id: string;
  title: string;
  year: number | null;
  created_at: string;
  course: { name: string } | null;
}

interface DashboardData {
  profile: Profile;
  recent_questions: RecentQuestion[];
  stats: {
    questions_in_courses: number;
    my_uploads: number;
  };
}

async function fetchDashboardSummary(
  supabase: ReturnType<typeof createClient>,
  router: ReturnType<typeof useRouter>
): Promise<DashboardData> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    router.push("/auth/login");
    // Throwing keeps React Query in a clean error/loading state rather
    // than resolving with undefined while the redirect happens.
    throw new Error("No session");
  }

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/dashboard/summary`,
    {
      headers: { Authorization: `Bearer ${session.access_token}` },
    }
  );

  if (!res.ok) throw new Error("Failed to load dashboard.");

  return res.json();
}

export default function DashboardHomePage() {
  const supabase = createClient();
  const router = useRouter();

  const [query, setQuery] = useState("");

  const {
    data,
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => fetchDashboardSummary(supabase, router),
  });

  const courses = data?.profile.courses ?? [];
  const recentQuestions = data?.recent_questions ?? [];
  const stats = data?.stats ?? { questions_in_courses: 0, my_uploads: 0 };

  const searchResults = useMemo(() => {
    if (query.trim().length === 0) return [];
    return courses
      .filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 6);
  }, [query, courses]);

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
        <p className="text-slate-600">
          {error instanceof Error ? error.message : "Couldn't load your dashboard."}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="font-semibold text-blue-600 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  const firstName = (data.profile.full_name ?? "there").split(" ")[0];

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-6xl">
        {/* Greeting + search */}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm text-slate-400">Welcome back</p>
            <h1 className="mt-0.5 text-2xl font-bold text-slate-900 sm:text-3xl">
              {firstName} 👋
            </h1>
          </div>

          <div className="relative w-full lg:w-96">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your courses"
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-700 shadow-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            {query.trim().length > 0 && (
              <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-100 bg-white shadow-xl">
                {searchResults.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-slate-400">
                    No courses match "{query}"
                  </p>
                ) : (
                  searchResults.map((c) => (
                    <Link
                      key={c.id}
                      href={`/dashboard/courses/${c.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                        <BookOpen className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-medium text-slate-800">{c.name}</p>
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Stats strip */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <StatCard icon={<BookOpen className="h-4 w-4" />} label="My courses" value={courses.length} />
          <StatCard icon={<FileText className="h-4 w-4" />} label="Past questions" value={stats.questions_in_courses} />
          <StatCard icon={<Upload className="h-4 w-4" />} label="My uploads" value={stats.my_uploads} tone="highlight" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left: main content */}
          <div className="space-y-6 lg:col-span-2">
            {/* My courses */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">My courses</h2>
                <Link
                  href="/onboarding"
                  className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                >
                  Update courses
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {courses.length === 0 ? (
                <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-500">
                    <BookOpen className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">
                    You haven't selected any courses yet
                  </p>
                  <p className="mt-1 max-w-xs text-xs text-slate-400">
                    Pick your courses to see past questions relevant to your semester.
                  </p>
                  <Link
                    href="/onboarding"
                    className="mt-4 flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    Select courses
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {courses.map((course) => (
                    <Link
                      key={course.id}
                      href={`/dashboard/courses/${course.id}`}
                      className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm transition-all hover:border-blue-200 hover:shadow-md"
                    >
                      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                        <BookOpen className="h-3.5 w-3.5" />
                      </div>
                      <p className="text-sm font-semibold text-slate-800">{course.name}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Activity */}
            <div>
              <h2 className="mb-3 text-base font-semibold text-slate-900">Recent activity</h2>
              {recentQuestions.length === 0 ? (
                <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-500">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">
                    No past questions here yet
                  </p>
                  <p className="mt-1 max-w-xs text-xs text-slate-400">
                    Be the first to upload one for your courses — it helps
                    everyone else in {data.profile.department?.name ?? "your department"} too.
                  </p>
                  <Link
                    href="/dashboard/upload"
                    className="mt-4 flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Upload the first one
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white shadow-sm">
                  {recentQuestions.map((q) => (
                    <Link
                      key={q.id}
                      href={`/questions/${q.id}`}
                      className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-slate-50"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {q.title}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {q.course?.name ?? "—"}
                          {q.year ? ` · ${q.year}` : ""}
                        </p>
                      </div>
                      <p className="flex-shrink-0 text-xs text-slate-400">
                        {new Date(q.created_at).toLocaleDateString()}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: profile + quick actions */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-slate-900">Academic profile</h3>
              </div>
              <div className="space-y-3 text-sm">
                <ProfileRow icon={School} label={data.profile.institution?.name ?? "Not set"} />
                <ProfileRow icon={BookOpen} label={data.profile.department?.name ?? "Not set"} />
                <div className="flex gap-2">
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                    {data.profile.level?.name ?? "—"}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                    {data.profile.study_mode?.name ?? "—"}
                  </span>
                </div>
              </div>
              <Link
                href="/dashboard/profile"
                className="mt-4 block text-center text-xs font-medium text-blue-600 hover:underline"
              >
                View full profile
              </Link>
            </div>

            <div className="space-y-3">
              <h2 className="text-base font-semibold text-slate-900">Quick actions</h2>
              <Link
                href="/dashboard/upload"
                className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:border-blue-200 hover:shadow-md"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                  <Upload className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">Upload a past question</p>
                  <p className="truncate text-xs text-slate-500">Help your department</p>
                </div>
                <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-slate-300" />
              </Link>
              <Link
                href="/dashboard/courses"
                className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:border-blue-200 hover:shadow-md"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">Browse my courses</p>
                  <p className="truncate text-xs text-slate-500">Full activity per course</p>
                </div>
                <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-slate-300" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon, label, value, tone = "default",
}: { icon: React.ReactNode; label: string; value: number; tone?: "default" | "highlight" }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${
        tone === "highlight" ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
      }`}>
        {icon}
      </div>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function ProfileRow({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 text-slate-700">
      <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      <span className="truncate text-xs">{label}</span>
    </div>
  );
          }
