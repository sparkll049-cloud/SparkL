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
  TrendingUp,
  Clock,
  Plus,
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

// ── Skeleton primitives ──────────────────────────────────────────────────────

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-white/[0.06] ${className}`}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <style>{`
        @keyframes shimmer { to { transform: translateX(200%); } }
      `}</style>
      <div className="mx-auto max-w-6xl space-y-8">

        {/* Greeting */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <Shimmer className="h-3.5 w-24" />
            <Shimmer className="h-8 w-40" />
          </div>
          <Shimmer className="h-11 w-full lg:w-96 rounded-xl" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 space-y-3">
              <Shimmer className="h-8 w-8 rounded-lg" />
              <Shimmer className="h-7 w-12" />
              <Shimmer className="h-3 w-20" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Courses skeleton */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Shimmer className="h-4 w-24" />
                <Shimmer className="h-3 w-20" />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3.5 space-y-3">
                    <Shimmer className="h-8 w-8 rounded-lg" />
                    <Shimmer className="h-3.5 w-3/4" />
                    <Shimmer className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            </div>

            {/* Activity skeleton */}
            <div className="space-y-3">
              <Shimmer className="h-4 w-32" />
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] divide-y divide-white/[0.04]">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-4">
                    <Shimmer className="h-9 w-9 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Shimmer className="h-3.5 w-3/4" />
                      <Shimmer className="h-3 w-1/2" />
                    </div>
                    <Shimmer className="h-3 w-16 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right skeleton */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 space-y-4">
              <Shimmer className="h-4 w-32" />
              {[...Array(3)].map((_, i) => (
                <Shimmer key={i} className="h-3.5 w-full" />
              ))}
              <div className="flex gap-2">
                <Shimmer className="h-6 w-16 rounded-full" />
                <Shimmer className="h-6 w-20 rounded-full" />
              </div>
            </div>
            {[...Array(2)].map((_, i) => (
              <Shimmer key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function DashboardHomePage() {
  const supabase = createClient();
  const router = useRouter();
  const [query, setQuery] = useState("");

  const { data, isLoading: loading, error } = useQuery({
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

  if (loading) return <DashboardSkeleton />;

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
          <Sparkles className="h-6 w-6 text-red-400" />
        </div>
        <p className="text-slate-400 text-sm">
          {error instanceof Error ? error.message : "Couldn't load your dashboard."}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-xl bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.1] transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  const firstName = (data.profile.full_name ?? "there").split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="min-h-screen bg-[#060B1F] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-6xl">

        {/* ── Header ── */}
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm text-slate-500">{greeting}</p>
            <h1 className="mt-0.5 text-2xl font-extrabold text-white sm:text-3xl">
              {firstName} 👋
            </h1>
          </div>

          {/* Search */}
          <div className="relative w-full lg:w-96">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your courses…"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 pl-11 pr-4 text-sm text-white shadow-sm outline-none placeholder:text-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 transition"
            />
            {query.trim().length > 0 && (
              <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-[#0D1535] shadow-2xl">
                {searchResults.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-slate-500">
                    No courses match &ldquo;{query}&rdquo;
                  </p>
                ) : (
                  searchResults.map((c) => (
                    <Link
                      key={c.id}
                      href={`/dashboard/courses/${c.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.05] transition-colors"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
                        <BookOpen className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-medium text-slate-200">{c.name}</p>
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Stats strip ── */}
        <div className="mb-8 grid grid-cols-3 gap-3">
          <StatCard
            icon={<BookOpen className="h-4 w-4" />}
            label="My courses"
            value={courses.length}
            accent="blue"
          />
          <StatCard
            icon={<FileText className="h-4 w-4" />}
            label="Past questions"
            value={stats.questions_in_courses}
            accent="violet"
          />
          <StatCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="My uploads"
            value={stats.my_uploads}
            accent="emerald"
          />
        </div>

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* Left column */}
          <div className="space-y-6 lg:col-span-2">

            {/* My courses */}
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-white">My courses</h2>
                <Link
                  href="/onboarding"
                  className="flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Update
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {courses.length === 0 ? (
                <EmptyState
                  icon={<BookOpen className="h-6 w-6" />}
                  title="No courses selected yet"
                  body={`Pick your courses to see past questions for your semester.`}
                  action={{ href: "/onboarding", label: "Select courses" }}
                />
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {courses.map((course) => (
                    <Link
                      key={course.id}
                      href={`/dashboard/courses/${course.id}`}
                      className="group rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 transition-all hover:border-blue-500/40 hover:bg-white/[0.06]"
                    >
                      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400 group-hover:bg-blue-500/25 transition-colors">
                        <BookOpen className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-semibold text-slate-200 leading-snug">{course.name}</p>
                      <p className="mt-1 text-xs text-slate-600 flex items-center gap-1">
                        View questions <ChevronRight className="h-3 w-3" />
                      </p>
                    </Link>
                  ))}

                  {/* Add more tile */}
                  <Link
                    href="/onboarding"
                    className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 p-4 text-slate-600 hover:border-blue-500/30 hover:text-blue-400 transition-all"
                  >
                    <Plus className="h-5 w-5 mb-1" />
                    <span className="text-xs font-medium">Add more</span>
                  </Link>
                </div>
              )}
            </section>

            {/* Recent activity */}
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-white">Recent activity</h2>
                {recentQuestions.length > 0 && (
                  <Link
                    href="/dashboard/courses"
                    className="flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    See all <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>

              {recentQuestions.length === 0 ? (
                <EmptyState
                  icon={<Sparkles className="h-6 w-6" />}
                  title="No past questions yet"
                  body={`Be the first to upload one for ${data.profile.department?.name ?? "your department"} — it helps everyone.`}
                  action={{ href: "/dashboard/upload", label: "Upload the first one", icon: <Upload className="h-3.5 w-3.5" /> }}
                />
              ) : (
                <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03]">
                  {recentQuestions.map((q, i) => (
                    <Link
                      key={q.id}
                      href={`/questions/${q.id}`}
                      className={`flex items-center gap-4 px-5 py-4 transition hover:bg-white/[0.04] ${
                        i !== 0 ? "border-t border-white/[0.04]" : ""
                      }`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-200">{q.title}</p>
                        <p className="truncate text-xs text-slate-500 mt-0.5">
                          {q.course?.name ?? "—"}
                          {q.year ? ` · ${q.year}` : ""}
                        </p>
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-1 text-xs text-slate-600">
                        <Clock className="h-3 w-3" />
                        {new Date(q.created_at).toLocaleDateString()}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right column */}
          <div className="space-y-5">

            {/* Academic profile card */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5">
              <div className="mb-5 flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white">Academic profile</h3>
              </div>
              <div className="space-y-3.5">
                <ProfileRow icon={School} label={data.profile.institution?.name ?? "Not set"} />
                <ProfileRow icon={BookOpen} label={data.profile.department?.name ?? "Not set"} />
                <ProfileRow icon={Layers} label={data.profile.study_mode?.name ?? "Not set"} />
              </div>
              <div className="mt-4 flex gap-2">
                <span className="rounded-full bg-blue-500/15 px-2.5 py-1 text-[11px] font-semibold text-blue-400">
                  {data.profile.level?.name ?? "—"}
                </span>
                <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-slate-400">
                  {data.profile.study_mode?.name ?? "—"}
                </span>
              </div>
              <Link
                href="/dashboard/profile"
                className="mt-5 block text-center rounded-xl border border-white/10 py-2 text-xs font-semibold text-slate-400 hover:border-blue-500/40 hover:text-blue-400 transition-all"
              >
                View full profile
              </Link>
            </div>

            {/* Quick actions */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white">Quick actions</h3>

              <Link
                href="/dashboard/upload"
                className="group flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 transition-all hover:border-blue-500/40 hover:bg-white/[0.06]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white group-hover:bg-blue-500 transition-colors">
                  <Upload className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-200">Upload past question</p>
                  <p className="text-xs text-slate-500">Help your department</p>
                </div>
                <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-slate-600 group-hover:text-slate-400 transition-colors" />
              </Link>

              <Link
                href="/dashboard/courses"
                className="group flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 transition-all hover:border-blue-500/40 hover:bg-white/[0.06]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white group-hover:bg-violet-500 transition-colors">
                  <BookOpen className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-200">Browse courses</p>
                  <p className="text-xs text-slate-500">Full activity per course</p>
                </div>
                <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-slate-600 group-hover:text-slate-400 transition-colors" />
              </Link>
            </div>

            {/* Upload nudge banner */}
            {stats.my_uploads === 0 && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
                <p className="text-sm font-semibold text-emerald-400">You haven't uploaded yet</p>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Sharing past questions helps thousands of students across Nigeria.
                </p>
                <Link
                  href="/dashboard/upload"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Upload now <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: "blue" | "violet" | "emerald";
}) {
  const colors = {
    blue: "bg-blue-500/15 text-blue-400",
    violet: "bg-violet-500/15 text-violet-400",
    emerald: "bg-emerald-500/15 text-emerald-400",
  };
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${colors[accent]}`}>
        {icon}
      </div>
      <p className="text-2xl font-extrabold text-white">{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function ProfileRow({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="h-3.5 w-3.5 shrink-0 text-slate-600" />
      <span className="truncate text-xs text-slate-400">{label}</span>
    </div>
  );
}

function EmptyState({
  icon, title, body, action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action: { href: string; label: string; icon?: React.ReactNode };
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-400">
        {icon}
      </div>
      <p className="text-sm font-semibold text-slate-300">{title}</p>
      <p className="mt-1.5 max-w-xs text-xs text-slate-600 leading-relaxed">{body}</p>
      <Link
        href={action.href}
        className="mt-5 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
      >
        {action.icon}
        {action.label}
      </Link>
    </div>
  );
}