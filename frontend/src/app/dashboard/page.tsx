// frontend/src/app/dashboard/page.tsx
"use client";

import { useState, useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Home,
  BookOpen,
  UploadCloud,
  User,
  LogOut,
  Menu,
  X,
  FileText,
  TrendingUp,
  Clock,
  ChevronRight,
  Search,
  MessageSquare,
  Flame,
  Sparkles,
  ArrowRight,
} from "lucide-react";

// TODO: replace with the logged-in student's real session data
const CURRENT_STUDENT = {
  full_name: "Ijeoma Nwachukwu",
  department: "Computer Science",
  level: "ND1",
};

// TODO: replace with a fetch of the student's selected courses + counts,
// joined from course_selection + past_questions
const MY_COURSES = [
  { id: "c1", course_code: "CSC201", course_title: "Data Structures", question_count: 14, new_this_week: 2 },
  { id: "c2", course_code: "CSC205", course_title: "Computer Architecture", question_count: 8, new_this_week: 0 },
  { id: "c3", course_code: "CSC211", course_title: "Discrete Mathematics", question_count: 21, new_this_week: 3 },
  { id: "c4", course_code: "CSC221", course_title: "Object Oriented Programming", question_count: 6, new_this_week: 0 },
  { id: "c5", course_code: "GNS201", course_title: "Use of English II", question_count: 3, new_this_week: 1 },
];

// TODO: replace with a fetch across all courses, for search
const ALL_COURSES = [
  ...MY_COURSES,
  { id: "c6", course_code: "EEE201", course_title: "Circuit Theory", question_count: 11, new_this_week: 0 },
  { id: "c7", course_code: "ACT101", course_title: "Financial Accounting", question_count: 9, new_this_week: 0 },
  { id: "c8", course_code: "MAC201", course_title: "Mass Comm Theory", question_count: 5, new_this_week: 0 },
];

// TODO: replace with actual recently-added past questions across the
// student's selected courses, most recent first
const RECENT_UPLOADS = [
  { id: "p1", course_id: "c1", course_code: "CSC201", year: "2023/2024", semester: "First Semester", uploaded_by: "Tunde B." },
  { id: "p2", course_id: "c3", course_code: "CSC211", year: "2022/2023", semester: "Second Semester", uploaded_by: "Femi A." },
  { id: "p3", course_id: "c2", course_code: "CSC205", year: "2023/2024", semester: "First Semester", uploaded_by: "Ijeoma N." },
  { id: "p4", course_id: "c5", course_code: "GNS201", year: "2021/2022", semester: "Second Semester", uploaded_by: "Chioma O." },
];

// TODO: replace with courses trending across the student's department
// (most uploads/views in the last 7 days) that they haven't selected
const TRENDING_IN_DEPT = [
  { id: "c6a", course_code: "CSC231", course_title: "Systems Analysis and Design", upload_count: 6 },
  { id: "c6b", course_code: "CSC241", course_title: "Web Technologies", upload_count: 4 },
];

// TODO: replace with the last course the student actually viewed
// (store in localStorage or a lightweight `last_viewed` table)
const LAST_VIEWED_COURSE = MY_COURSES[0];

const NAV_ITEMS = [
  { label: "Home", href: "/dashboard", icon: Home, active: true },
  { label: "My Courses", href: "/dashboard/courses", icon: BookOpen },
  { label: "Upload", href: "/dashboard/upload", icon: UploadCloud },
  { label: "Profile", href: "/dashboard/profile", icon: User },
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardHomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalQuestions = MY_COURSES.reduce((sum, c) => sum + c.question_count, 0);
  const newThisWeek = MY_COURSES.reduce((sum, c) => sum + c.new_this_week, 0);

  const searchResults = useMemo(() => {
    if (query.trim().length === 0) return [];
    return ALL_COURSES.filter(
      (c) =>
        c.course_code.toLowerCase().includes(query.toLowerCase()) ||
        c.course_title.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 6);
  }, [query]);

  const handleSearchBlur = () => {
    blurTimeout.current = setTimeout(() => setSearchFocused(false), 150);
  };
  const handleSearchFocus = () => {
    if (blurTimeout.current) clearTimeout(blurTimeout.current);
    setSearchFocused(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      {/* ---------------- Desktop sidebar ---------------- */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-100 bg-white lg:flex lg:flex-col">
        <div className="border-b border-slate-100 px-6 py-5">
          <Image src="/images/logo.jpg" alt="SparkL" width={60} height={60} priority className="object-contain" />
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) => (
            <SidebarLink key={item.label} {...item} />
          ))}
        </nav>
        <div className="border-t border-slate-100 p-3">
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-red-600">
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </aside>

      {/* ---------------- Mobile top bar ---------------- */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3 lg:hidden">
        <Image src="/images/logo.jpg" alt="SparkL" width={40} height={40} priority className="object-contain" />
        <button onClick={() => setMenuOpen(true)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* ---------------- Mobile drawer ---------------- */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-72 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <Image src="/images/logo.jpg" alt="SparkL" width={40} height={40} priority className="object-contain" />
              <button onClick={() => setMenuOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-1 px-3 py-4">
              {NAV_ITEMS.map((item) => (
                <SidebarLink key={item.label} {...item} onClick={() => setMenuOpen(false)} />
              ))}
            </nav>
            <div className="border-t border-slate-100 p-3">
              <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-red-600">
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Main content ---------------- */}
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl">
          {/* Greeting + search */}
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm text-slate-400">
                {getGreeting()}, {CURRENT_STUDENT.department} · {CURRENT_STUDENT.level}
              </p>
              <h1 className="mt-0.5 text-2xl font-bold text-slate-900 sm:text-3xl">
                {CURRENT_STUDENT.full_name.split(" ")[0]} 👋
              </h1>
            </div>

            {/* Search */}
            <div className="relative w-full lg:w-96">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={handleSearchFocus}
                onBlur={handleSearchBlur}
                placeholder="Search a course, e.g. CSC201"
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-700 shadow-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              {searchFocused && query.trim().length > 0 && (
                <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-100 bg-white shadow-xl">
                  {searchResults.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-slate-400">No courses match "{query}"</p>
                  ) : (
                    searchResults.map((c) => (
                      <Link key={c.id} href={`/dashboard/courses/${c.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                            <BookOpen className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-800">{c.course_code}</p>
                            <p className="text-xs text-slate-400">{c.course_title}</p>
                          </div>
                        </div>
                        <span className="text-xs text-slate-400">{c.question_count} papers</span>
                      </Link>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon={<BookOpen className="h-4 w-4" />} label="My courses" value={MY_COURSES.length} />
            <StatCard icon={<FileText className="h-4 w-4" />} label="Past questions" value={totalQuestions} />
            <StatCard icon={<Sparkles className="h-4 w-4" />} label="New this week" value={newThisWeek} tone="highlight" />
            <StatCard icon={<MessageSquare className="h-4 w-4" />} label="Solutions to explore" value={32} />
          </div>

          {/* Continue where you left off */}
          <Link
            href={`/dashboard/courses/${LAST_VIEWED_COURSE.id}`}
            className="mb-6 flex items-center justify-between gap-4 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 text-white transition-transform hover:scale-[1.01]"
          >
            <div className="min-w-0">
              <p className="text-xs font-medium text-blue-100">Continue where you left off</p>
              <p className="mt-1 truncate text-lg font-semibold">
                {LAST_VIEWED_COURSE.course_code} — {LAST_VIEWED_COURSE.course_title}
              </p>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0" />
          </Link>

          {/* Two column layout */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left: courses + recent uploads */}
            <div className="space-y-6 lg:col-span-2">
              {/* My courses */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-900">My courses</h2>
                  <Link href="/dashboard/courses" className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
                    View all
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {MY_COURSES.map((course) => (
                    <Link
                      key={course.id}
                      href={`/dashboard/courses/${course.id}`}
                      className="group relative rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:border-blue-200 hover:shadow-md"
                    >
                      {course.new_this_week > 0 && (
                        <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          <Flame className="h-2.5 w-2.5" />+{course.new_this_week}
                        </span>
                      )}
                      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                        <BookOpen className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-semibold text-slate-800">{course.course_code}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{course.course_title}</p>
                      <div className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-600">
                        <FileText className="h-3.5 w-3.5" />
                        {course.question_count} past questions
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Recently added */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <h2 className="text-base font-semibold text-slate-900">Recently added</h2>
                </div>
                <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                  <div className="divide-y divide-slate-100">
                    {RECENT_UPLOADS.map((item) => (
                      <Link
                        key={item.id}
                        href={`/dashboard/courses/${item.course_id}`}
                        className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 sm:px-5"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800">
                              {item.course_code} · {item.year}
                            </p>
                            <p className="truncate text-xs text-slate-400">
                              {item.semester} · added by {item.uploaded_by}
                            </p>
                          </div>
                        </div>
                        <Clock className="h-4 w-4 shrink-0 text-slate-300" />
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: quick actions + trending */}
            <div className="space-y-6">
              {/* Quick actions */}
              <div className="space-y-3">
                <h2 className="text-base font-semibold text-slate-900">Quick actions</h2>
                <Link
                  href="/dashboard/upload"
                  className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:border-blue-200 hover:shadow-md"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                    <UploadCloud className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">Upload a past question</p>
                    <p className="truncate text-xs text-slate-500">Help someone in your department</p>
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
                    <p className="text-sm font-semibold text-slate-800">View all my courses</p>
                    <p className="truncate text-xs text-slate-500">Full activity per course</p>
                  </div>
                  <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-slate-300" />
                </Link>
              </div>

              {/* Trending in department */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Flame className="h-4 w-4 text-amber-500" />
                  <h2 className="text-base font-semibold text-slate-900">Trending in {CURRENT_STUDENT.department}</h2>
                </div>
                <div className="space-y-2">
                  {TRENDING_IN_DEPT.map((course) => (
                    <div
                      key={course.id}
                      className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">{course.course_code}</p>
                        <p className="truncate text-xs text-slate-400">{course.course_title}</p>
                      </div>
                      <span className="ml-2 shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-600">
                        {course.upload_count} new
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  Not in your course list — add it during course selection to track it here.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function SidebarLink({
  label, href, icon: Icon, active, onClick,
}: { label: string; href: string; icon: React.ElementType; active?: boolean; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
        active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
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