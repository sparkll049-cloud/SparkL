"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search, BookOpen, Upload, FileText, GraduationCap,
  ChevronRight, ArrowRight, Clock, Plus,
  Zap, Users, TrendingUp, AlertCircle,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import Image from "next/image";
import { PaymentGatewayWidget } from "@/components/PaymentGatewayWidget";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Course { id: string; name: string; code?: string; }
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
  views?: number;
}
interface DashboardData {
  profile: Profile;
  recent_questions: RecentQuestion[];
  stats: { questions_in_courses: number; my_uploads: number; total_views?: number };
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

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Bone({ className }: { className?: string }) {
  return <div className={`rounded-lg bg-white/[0.04] animate-pulse ${className}`} />;
}

function Skeleton() {
  return (
    <div className="min-h-screen px-4 py-6 lg:px-8 lg:py-8" style={{ background: "var(--sp-bg)" }}>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <Bone className="h-6 w-32" />
          <Bone className="h-9 w-52 rounded-xl" />
        </div>
        <Bone className="h-28 rounded-2xl" />
        <div className="grid grid-cols-3 gap-3">
          <Bone className="h-16 rounded-2xl" />
          <Bone className="h-16 rounded-2xl" />
          <Bone className="h-16 rounded-2xl" />
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-3">
            <Bone className="h-4 w-20" />
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {[...Array(5)].map((_, i) => <Bone key={i} className="h-24 rounded-2xl" />)}
            </div>
          </div>
          <div className="space-y-3">
            <Bone className="h-36 rounded-2xl" />
            <Bone className="h-24 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Course accent palette ─────────────────────────────────────────────────────

const ACCENTS = [
  { text: "text-indigo-400", border: "rgba(99,102,241,0.2)",  bg: "rgba(99,102,241,0.07)"  },
  { text: "text-teal-400",   border: "rgba(20,184,166,0.2)",  bg: "rgba(20,184,166,0.07)"  },
  { text: "text-violet-400", border: "rgba(139,92,246,0.2)",  bg: "rgba(139,92,246,0.07)"  },
  { text: "text-sky-400",    border: "rgba(14,165,233,0.2)",  bg: "rgba(14,165,233,0.07)"  },
  { text: "text-rose-400",   border: "rgba(244,63,94,0.2)",   bg: "rgba(244,63,94,0.07)"   },
  { text: "text-amber-400",  border: "rgba(245,158,11,0.2)",  bg: "rgba(245,158,11,0.07)"  },
];

// ── Course card ───────────────────────────────────────────────────────────────

function CourseCard({ course, index }: { course: Course; index: number }) {
  const a = ACCENTS[index % ACCENTS.length];
  const initials = course.name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Link
      href={`/dashboard/courses/${course.id}`}
      className="group flex flex-col rounded-2xl border p-4 transition-colors duration-150 hover:bg-white/[0.03]"
      style={{ background: a.bg, borderColor: a.border }}
    >
      <span className={`mb-3 text-lg font-black leading-none ${a.text}`}>{initials}</span>
      <p className={`flex-1 text-xs font-semibold leading-snug ${a.text}`} style={{ opacity: 0.85 }}>
        {course.name}
      </p>
      {course.code && (
        <p className={`mt-1.5 font-mono text-[10px] font-bold ${a.text} opacity-50`}>{course.code}</p>
      )}
      <div className={`mt-3 flex items-center gap-1 text-[10px] font-medium ${a.text} opacity-0 group-hover:opacity-70 transition-opacity`}>
        Open <ChevronRight className="h-2.5 w-2.5" />
      </div>
    </Link>
  );
}

// ── Stat pill ─────────────────────────────────────────────────────────────────

function StatPill({
  icon, label, value,
}: {
  icon: React.ReactNode; label: string; value: number | string;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl border px-4 py-3.5"
      style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-card)" }}
    >
      <div className="shrink-0 opacity-60">{icon}</div>
      <div>
        <p className="text-lg font-black tabular-nums leading-none" style={{ color: "var(--sp-text)" }}>
          {value}
        </p>
        <p className="mt-0.5 text-[10px] font-medium" style={{ color: "var(--sp-text-3)" }}>{label}</p>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({
  icon, title, body, cta,
}: {
  icon: React.ReactNode; title: string; body: string;
  cta: { href: string; label: string };
}) {
  return (
    <div
      className="flex flex-col items-center rounded-2xl border border-dashed px-6 py-10 text-center"
      style={{ borderColor: "var(--sp-border)" }}
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
        {icon}
      </div>
      <p className="text-xs font-bold" style={{ color: "var(--sp-text-2)" }}>{title}</p>
      <p className="mt-1.5 max-w-[200px] text-[11px] leading-relaxed" style={{ color: "var(--sp-text-3)" }}>
        {body}
      </p>
      <Link
        href={cta.href}
        className="mt-5 rounded-xl bg-indigo-600 px-4 py-2 text-[11px] font-bold text-white hover:bg-indigo-500 transition-colors"
      >
        {cta.label}
      </Link>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardHomePage() {
  const supabase = createClient();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => fetchDashboardSummary(supabase, router),
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setQuery("");
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const courses = data?.profile.courses ?? [];
  const recentQuestions = data?.recent_questions ?? [];
  const stats = data?.stats ?? { questions_in_courses: 0, my_uploads: 0, total_views: 0 };

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    return courses
      .filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 6);
  }, [query, courses]);

  if (isLoading) return <Skeleton />;

  if (error || !data) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center"
        style={{ background: "var(--sp-bg)" }}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10">
          <AlertCircle className="h-5 w-5 text-red-400" />
        </div>
        <p className="text-sm font-semibold" style={{ color: "var(--sp-text-2)" }}>
          {error instanceof Error ? error.message : "Couldn't load your dashboard."}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-xl border px-5 py-2.5 text-xs font-bold transition hover:border-indigo-500/40 hover:text-indigo-400"
          style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)" }}
        >
          Try again
        </button>
      </div>
    );
  }

  const firstName = (data.profile.full_name ?? "there").split(" ")[0];
  const hour = new Date().getHours();
  const greeting =
    hour < 5 ? "Up late" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="min-h-screen transition-colors duration-300" style={{ background: "var(--sp-bg)" }}>

      {/* ── Topbar ── */}
      <header
        className="sticky top-0 z-30 border-b backdrop-blur-md transition-colors"
        style={{ background: "var(--sp-header-bg)", borderColor: "var(--sp-border)" }}
      >
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 lg:px-8">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <Image src="/images/logo.jpg" alt="SparkL" width={26} height={26} className="rounded-lg object-cover" />
            <span className="text-sm font-black tracking-tight" style={{ color: "var(--sp-text)" }}>SparkL</span>
          </Link>

          {/* Search */}
          <div className="relative w-52 lg:w-64" ref={searchRef}>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
              style={{ color: "var(--sp-text-3)" }}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search courses…"
              className="w-full rounded-xl border py-2 pl-9 pr-3 text-xs outline-none transition focus:border-indigo-500/50"
              style={{
                background: "var(--sp-input-bg)",
                borderColor: "var(--sp-border)",
                color: "var(--sp-text)",
              }}
            />
            {query.trim() && (
              <div
                className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border shadow-2xl"
                style={{ background: "var(--sp-search-popup)", borderColor: "var(--sp-border)" }}
              >
                {searchResults.length === 0 ? (
                  <p className="px-4 py-3 text-xs" style={{ color: "var(--sp-text-3)" }}>
                    No match for &ldquo;{query}&rdquo;
                  </p>
                ) : (
                  searchResults.map((c, i) => {
                    const a = ACCENTS[i % ACCENTS.length];
                    return (
                      <Link
                        key={c.id}
                        href={`/dashboard/courses/${c.id}`}
                        className="flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-indigo-500/5"
                        onClick={() => setQuery("")}
                      >
                        <div className={`h-1.5 w-1.5 rounded-full ${a.text} bg-current`} />
                        <span className="text-xs font-medium" style={{ color: "var(--sp-text-2)" }}>
                          {c.name}
                        </span>
                      </Link>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Avatar */}
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/15 text-[11px] font-black text-indigo-400">
            {firstName.slice(0, 2).toUpperCase()}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 lg:px-8 lg:py-8">

        {/* ── Greeting ── */}
        <div
          className="mb-5 rounded-2xl border p-5 sm:p-6"
          style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
        >
          <p className="text-xs font-medium" style={{ color: "var(--sp-text-3)" }}>{greeting}</p>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight sm:text-3xl" style={{ color: "var(--sp-text)" }}>
            {firstName}
          </h1>
          {(data.profile.department?.name || data.profile.institution?.name) && (
            <p className="mt-2 text-xs" style={{ color: "var(--sp-text-3)" }}>
              {[
                data.profile.department?.name,
                data.profile.institution?.name,
                data.profile.level?.name,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>

        {/* ── Stats row ── */}
        <div className="mb-6 grid grid-cols-3 gap-2.5">
          <StatPill
            icon={<BookOpen className="h-4 w-4 text-indigo-400" />}
            label="Courses"
            value={courses.length}
          />
          <StatPill
            icon={<FileText className="h-4 w-4 text-violet-400" />}
            label="Past questions"
            value={stats.questions_in_courses}
          />
          <StatPill
            icon={<TrendingUp className="h-4 w-4 text-teal-400" />}
            label="My uploads"
            value={stats.my_uploads}
          />
        </div>

        {/* ── Body grid ── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

          {/* ── Left: courses + recent ── */}
          <div className="space-y-6 lg:col-span-2">

            {/* Courses */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold" style={{ color: "var(--sp-text)" }}>Your courses</h2>
                <Link
                  href="/onboarding"
                  className="flex items-center gap-0.5 text-[11px] font-medium text-indigo-400/60 hover:text-indigo-400 transition-colors"
                >
                  Manage <ChevronRight className="h-3 w-3" />
                </Link>
              </div>

              {courses.length === 0 ? (
                <EmptyState
                  icon={<BookOpen className="h-5 w-5" />}
                  title="No courses yet"
                  body="Choose your courses to unlock past questions for your semester."
                  cta={{ href: "/onboarding", label: "Choose courses" }}
                />
              ) : (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {courses.map((course, i) => (
                    <CourseCard key={course.id} course={course} index={i} />
                  ))}
                  <Link
                    href="/onboarding"
                    className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed p-4 transition-colors hover:border-indigo-500/25 hover:bg-white/[0.02]"
                    style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)" }}
                  >
                    <Plus className="h-4 w-4" />
                    <span className="text-[10px] font-semibold">Add course</span>
                  </Link>
                </div>
              )}
            </section>

            {/* Recent uploads */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold" style={{ color: "var(--sp-text)" }}>Recent uploads</h2>
                {recentQuestions.length > 0 && (
                  <Link
                    href="/dashboard/courses"
                    className="flex items-center gap-0.5 text-[11px] font-medium text-indigo-400/60 hover:text-indigo-400 transition-colors"
                  >
                    See all <ChevronRight className="h-3 w-3" />
                  </Link>
                )}
              </div>

              {recentQuestions.length === 0 ? (
                <EmptyState
                  icon={<FileText className="h-5 w-5" />}
                  title="Nothing here yet"
                  body={`Be the first to share a past question for ${data.profile.department?.name ?? "your department"}.`}
                  cta={{ href: "/dashboard/upload", label: "Upload now" }}
                />
              ) : (
                <div
                  className="overflow-hidden rounded-2xl border"
                  style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
                >
                  {recentQuestions.map((q, i) => (
                    <Link
                      key={q.id}
                      href={`/questions/${q.id}`}
                      className={`group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-indigo-500/[0.04] ${
                        i > 0 ? "border-t" : ""
                      }`}
                      style={i > 0 ? { borderColor: "var(--sp-border)" } : {}}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400 group-hover:bg-violet-500/15 transition-colors">
                        <FileText className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold" style={{ color: "var(--sp-text-2)" }}>
                          {q.title}
                        </p>
                        <p className="truncate text-[10px] mt-0.5" style={{ color: "var(--sp-text-3)" }}>
                          {q.course?.name ?? "—"}{q.year ? ` · ${q.year}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <div className="flex items-center gap-1 text-[10px]" style={{ color: "var(--sp-text-3)" }}>
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(q.created_at).toLocaleDateString("en-NG", {
                            day: "numeric",
                            month: "short",
                          })}
                        </div>
                        {q.views != null && (
                          <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--sp-text-3)" }}>
                            <Users className="h-2.5 w-2.5" />
                            {q.views}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* ── Right sidebar ── */}
          <div className="space-y-4">

            {/* Upload CTA */}
            <Link
              href="/dashboard/upload"
              className="group flex items-center gap-3 rounded-2xl border p-4 transition-colors"
              style={{
                background: "rgba(99,102,241,0.07)",
                borderColor: "rgba(99,102,241,0.18)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(99,102,241,0.35)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(99,102,241,0.18)")}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white group-hover:bg-indigo-500 transition-colors">
                <Upload className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold" style={{ color: "var(--sp-text)" }}>Upload a past question</p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--sp-text-3)" }}>
                  Help your department, grow the archive
                </p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>

            {/* Payment widget */}
            <PaymentGatewayWidget />

            {/* Profile summary */}
            <div
              className="rounded-2xl border p-4"
              style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
            >
              <div className="mb-3 flex items-center gap-2">
                <GraduationCap className="h-3.5 w-3.5 text-indigo-400" />
                <h3 className="text-xs font-bold" style={{ color: "var(--sp-text)" }}>Your profile</h3>
              </div>
              <div className="space-y-1.5">
                {[
                  data.profile.institution?.name,
                  data.profile.department?.name,
                  data.profile.level?.name,
                ]
                  .filter(Boolean)
                  .map((val) => (
                    <p key={val} className="truncate text-[11px]" style={{ color: "var(--sp-text-3)" }}>
                      {val}
                    </p>
                  ))}
              </div>
              <Link
                href="/dashboard/profile"
                className="mt-4 flex items-center justify-center gap-1 rounded-xl border py-2 text-[11px] font-semibold transition-colors hover:border-indigo-500/30 hover:text-indigo-400"
                style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)" }}
              >
                Edit profile <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            {/* Quick links */}
            <div
              className="overflow-hidden rounded-2xl border"
              style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
            >
              {[
                { href: "/dashboard/courses", icon: <BookOpen className="h-3.5 w-3.5" />, label: "Browse all courses" },
                { href: "/dashboard/upload",  icon: <Zap className="h-3.5 w-3.5" />,      label: "My uploads" },
              ].map((item, i) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-indigo-500/[0.04] ${
                    i > 0 ? "border-t" : ""
                  }`}
                  style={i > 0 ? { borderColor: "var(--sp-border)" } : {}}
                >
                  <span style={{ color: "var(--sp-text-3)" }}>{item.icon}</span>
                  <span className="flex-1 text-xs font-medium" style={{ color: "var(--sp-text-2)" }}>
                    {item.label}
                  </span>
                  <ChevronRight
                    className="h-3 w-3 text-indigo-400/30 group-hover:text-indigo-400 transition-colors"
                  />
                </Link>
              ))}
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
