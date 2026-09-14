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
  ArrowRight,
  TrendingUp,
  Clock,
  Plus,
  Flame,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

interface Course { id: string; name: string; }
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
  id: string; title: string; year: number | null;
  created_at: string; course: { name: string } | null;
}
interface DashboardData {
  profile: Profile;
  recent_questions: RecentQuestion[];
  stats: { questions_in_courses: number; my_uploads: number };
}

async function fetchDashboardSummary(
  supabase: ReturnType<typeof createClient>,
  router: ReturnType<typeof useRouter>
): Promise<DashboardData> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { router.push("/auth/login"); throw new Error("No session"); }
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/dashboard/summary`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!res.ok) throw new Error("Failed to load dashboard.");
  return res.json();
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function Shimmer({ className }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-md bg-white/[0.05] ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
    </div>
  );
}

function Skeleton() {
  return (
    <div className="px-5 py-6 lg:px-8 lg:py-8">
      <style>{`@keyframes shimmer { to { transform: translateX(250%); } }`}</style>
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Shimmer className="h-3 w-20" />
            <Shimmer className="h-7 w-36" />
            <Shimmer className="h-3 w-48 mt-1" />
          </div>
          <Shimmer className="h-9 w-64 rounded-lg" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 space-y-3">
              <Shimmer className="h-7 w-7 rounded-lg" />
              <Shimmer className="h-6 w-10" />
              <Shimmer className="h-2.5 w-16" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-5">
            <div className="space-y-3">
              <div className="flex justify-between"><Shimmer className="h-3.5 w-20" /><Shimmer className="h-3 w-14" /></div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 space-y-2.5">
                    <Shimmer className="h-7 w-7 rounded-lg" />
                    <Shimmer className="h-3 w-full" />
                    <Shimmer className="h-2.5 w-2/3" />
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <Shimmer className="h-3.5 w-28" />
              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02]">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className={`flex items-center gap-3 px-4 py-3.5 ${i > 0 ? "border-t border-white/[0.04]" : ""}`}>
                    <Shimmer className="h-8 w-8 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-1.5"><Shimmer className="h-3 w-3/4" /><Shimmer className="h-2.5 w-1/2" /></div>
                    <Shimmer className="h-2.5 w-14 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 space-y-3">
              <Shimmer className="h-3.5 w-28" />
              {[...Array(3)].map((_, i) => <Shimmer key={i} className="h-3 w-full" />)}
              <div className="flex gap-2"><Shimmer className="h-5 w-14 rounded-full" /><Shimmer className="h-5 w-18 rounded-full" /></div>
            </div>
            <Shimmer className="h-16 w-full rounded-xl" />
            <Shimmer className="h-16 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardHomePage() {
  const supabase = createClient();
  const router = useRouter();
  const [query, setQuery] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => fetchDashboardSummary(supabase, router),
  });

  const courses = data?.profile.courses ?? [];
  const recentQuestions = data?.recent_questions ?? [];
  const stats = data?.stats ?? { questions_in_courses: 0, my_uploads: 0 };

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    return courses.filter(c => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6);
  }, [query, courses]);

  if (isLoading) return <Skeleton />;

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center px-6">
        <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-red-400" />
        </div>
        <p className="text-sm text-slate-500">{error instanceof Error ? error.message : "Couldn't load your dashboard."}</p>
        <button onClick={() => window.location.reload()} className="rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.05] transition">
          Try again
        </button>
      </div>
    );
  }

  const firstName = (data.profile.full_name ?? "there").split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const subline = data.profile.department?.name
    ? `${data.profile.department.name} · ${data.profile.institution?.name ?? ""}`
    : "Set up your profile to get started";

  return (
    <div className="px-5 py-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-5xl">

        {/* ── Header ── */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium text-slate-600">{greeting}</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">{firstName} 👋</h1>
            <p className="mt-1 text-xs text-slate-600 truncate max-w-xs">{subline}</p>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search courses…"
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] py-2 pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-500/60 focus:bg-white/[0.06] transition"
            />
            {query.trim() && (
              <div className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-white/[0.08] bg-[#0D1230] shadow-2xl">
                {searchResults.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-slate-500">No match for &ldquo;{query}&rdquo;</p>
                ) : (
                  searchResults.map((c) => (
                    <Link key={c.id} href={`/dashboard/courses/${c.id}`}
                      className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/[0.05] transition-colors"
                      onClick={() => setQuery("")}
                    >
                      <BookOpen className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                      <span className="text-xs font-medium text-slate-200">{c.name}</span>
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="mb-7 grid grid-cols-3 gap-3">
          {[
            { icon: <BookOpen className="h-3.5 w-3.5" />, label: "Courses", value: courses.length, color: "text-blue-400 bg-blue-500/10" },
            { icon: <FileText className="h-3.5 w-3.5" />, label: "Past questions", value: stats.questions_in_courses, color: "text-violet-400 bg-violet-500/10" },
            { icon: <TrendingUp className="h-3.5 w-3.5" />, label: "My uploads", value: stats.my_uploads, color: "text-emerald-400 bg-emerald-500/10" },
          ].map(({ icon, label, value, color }) => (
            <div key={label} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4">
              <div className={`mb-3 inline-flex h-7 w-7 items-center justify-center rounded-lg ${color}`}>{icon}</div>
              <p className="text-xl font-black text-white tabular-nums">{value}</p>
              <p className="mt-0.5 text-[11px] text-slate-600">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Body grid ── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

          {/* Left */}
          <div className="space-y-5 lg:col-span-2">

            {/* Courses */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-white">My courses</h2>
                <Link href="/onboarding" className="flex items-center gap-0.5 text-[11px] font-medium text-slate-500 hover:text-blue-400 transition-colors">
                  Manage <ChevronRight className="h-3 w-3" />
                </Link>
              </div>

              {courses.length === 0 ? (
                <Empty
                  icon={<BookOpen className="h-5 w-5" />}
                  title="No courses yet"
                  body="Select your courses to unlock past questions for your semester."
                  cta={{ href: "/onboarding", label: "Choose courses" }}
                />
              ) : (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {courses.map((course) => (
                    <Link
                      key={course.id}
                      href={`/dashboard/courses/${course.id}`}
                      className="group rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 transition-all hover:border-blue-500/25 hover:bg-[#111C3E]"
                    >
                      <div className="mb-2.5 flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                        <BookOpen className="h-3.5 w-3.5" />
                      </div>
                      <p className="text-xs font-semibold text-slate-200 leading-snug">{course.name}</p>
                      <p className="mt-1.5 flex items-center gap-0.5 text-[10px] text-slate-600 group-hover:text-slate-500 transition-colors">
                        Open <ChevronRight className="h-2.5 w-2.5" />
                      </p>
                    </Link>
                  ))}
                  <Link
                    href="/onboarding"
                    className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/[0.06] p-4 text-slate-700 hover:border-blue-500/20 hover:text-slate-500 transition-all"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="text-[10px] font-medium">Add</span>
                  </Link>
                </div>
              )}
            </section>

            {/* Activity */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-white">Recent activity</h2>
                {recentQuestions.length > 0 && (
                  <Link href="/dashboard/courses" className="flex items-center gap-0.5 text-[11px] font-medium text-slate-500 hover:text-blue-400 transition-colors">
                    All <ChevronRight className="h-3 w-3" />
                  </Link>
                )}
              </div>

              {recentQuestions.length === 0 ? (
                <Empty
                  icon={<Sparkles className="h-5 w-5" />}
                  title="Nothing uploaded yet"
                  body={`Be the first to share a past question for ${data.profile.department?.name ?? "your department"}.`}
                  cta={{ href: "/dashboard/upload", label: "Upload one", icon: <Upload className="h-3 w-3" /> }}
                />
              ) : (
                <div className="overflow-hidden rounded-xl border border-white/[0.05] bg-white/[0.02]">
                  {recentQuestions.map((q, i) => (
                    <Link
                      key={q.id}
                      href={`/questions/${q.id}`}
                      className={`flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.03] ${i > 0 ? "border-t border-white/[0.04]" : ""}`}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
                        <FileText className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-200">{q.title}</p>
                        <p className="truncate text-[10px] text-slate-600 mt-0.5">
                          {q.course?.name ?? "—"}{q.year ? ` · ${q.year}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 text-[10px] text-slate-700">
                        <Clock className="h-2.5 w-2.5" />
                        {new Date(q.created_at).toLocaleDateString()}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right */}
          <div className="space-y-4">

            {/* Profile card */}
            <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4">
              <div className="mb-4 flex items-center gap-2">
                <GraduationCap className="h-3.5 w-3.5 text-blue-400" />
                <h3 className="text-xs font-bold text-white">Academic profile</h3>
              </div>
              <div className="space-y-2.5">
                <PRow icon={School} label={data.profile.institution?.name ?? "Not set"} />
                <PRow icon={BookOpen} label={data.profile.department?.name ?? "Not set"} />
                <PRow icon={Layers} label={data.profile.study_mode?.name ?? "Not set"} />
              </div>
              <div className="mt-3.5 flex flex-wrap gap-1.5">
                <Badge color="blue">{data.profile.level?.name ?? "—"}</Badge>
                <Badge color="slate">{data.profile.study_mode?.name ?? "—"}</Badge>
              </div>
              <Link
                href="/dashboard/profile"
                className="mt-4 flex items-center justify-center gap-1 rounded-lg border border-white/[0.07] py-2 text-[11px] font-semibold text-slate-500 hover:border-blue-500/30 hover:text-blue-400 transition-all"
              >
                Full profile <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            {/* Quick actions */}
            <div className="space-y-2">
              <QuickAction href="/dashboard/upload" icon={<Upload className="h-3.5 w-3.5" />} color="bg-blue-600 group-hover:bg-blue-500" label="Upload past question" sub="Help your department" />
              <QuickAction href="/dashboard/courses" icon={<BookOpen className="h-3.5 w-3.5" />} color="bg-[#1E1B4B] group-hover:bg-[#312E81]" label="Browse courses" sub="See all past questions" />
            </div>

            {/* Upload nudge */}
            {stats.my_uploads === 0 && (
              <div className="rounded-xl border border-orange-500/20 bg-orange-500/[0.05] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Flame className="h-3.5 w-3.5 text-orange-400" />
                  <p className="text-xs font-bold text-orange-300">First upload unlocks your streak</p>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Contribute a past question — you'll be helping every student in your department.
                </p>
                <Link href="/dashboard/upload" className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-orange-400 hover:text-orange-300 transition-colors">
                  Upload now <ArrowRight className="h-3 w-3" />
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

function PRow({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3 w-3 shrink-0 text-slate-700" />
      <span className="truncate text-[11px] text-slate-500">{label}</span>
    </div>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: "blue" | "slate" }) {
  const cls = color === "blue"
    ? "bg-blue-500/10 text-blue-400"
    : "bg-white/[0.05] text-slate-500";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{children}</span>;
}

function QuickAction({ href, icon, color, label, sub }: {
  href: string; icon: React.ReactNode; color: string; label: string; sub: string;
}) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3.5 transition-all hover:border-white/10 hover:bg-white/[0.04]">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white transition-colors ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-200">{label}</p>
        <p className="text-[10px] text-slate-600">{sub}</p>
      </div>
      <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-700 group-hover:text-slate-500 transition-colors" />
    </Link>
  );
}

function Empty({ icon, title, body, cta }: {
  icon: React.ReactNode; title: string; body: string;
  cta: { href: string; label: string; icon?: React.ReactNode };
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-white/[0.07] px-6 py-10 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 text-blue-400">{icon}</div>
      <p className="text-xs font-semibold text-slate-300">{title}</p>
      <p className="mt-1 max-w-[220px] text-[11px] text-slate-600 leading-relaxed">{body}</p>
      <Link href={cta.href} className="mt-4 flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-[11px] font-semibold text-white hover:bg-blue-500 transition-colors">
        {cta.icon}{cta.label}
      </Link>
    </div>
  );
}