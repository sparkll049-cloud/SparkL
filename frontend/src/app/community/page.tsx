"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import {
  Search,
  Plus,
  MessageCircle,
  Eye,
  Clock3,
  ChevronDown,
  SlidersHorizontal,
  CheckCircle2,
  Users,
  Bookmark,
  BookmarkCheck,
  MoreHorizontal,
  X,
  Loader2,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

type Question = {
  id: string;
  institution: { id: string; name: string } | null;
  course: { id: string; name: string } | null;
  course_code: string | null;
  title: string;
  description: string;
  asker: { id: string; full_name: string } | null;
  created_at: string;
  answer_count: number;
  views: number;
  is_answered: boolean;
  is_saved: boolean;
};

const SEED_QUESTIONS: Question[] = [
  {
    id: "seed-1",
    institution: { id: "", name: "University of Lagos" },
    course: { id: "", name: "Mathematics" },
    course_code: "MTH 201",
    title: "How do I solve this differential equation?",
    description: "I'm having trouble understanding the second step of this question. Can someone explain the solution?",
    asker: { id: "", full_name: "Daniel A." },
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    answer_count: 4,
    views: 28,
    is_answered: false,
    is_saved: false,
  },
  {
    id: "seed-2",
    institution: { id: "", name: "Yaba College of Technology" },
    course: { id: "", name: "Computer Science" },
    course_code: "CSC 301",
    title: "Can someone explain this recursion problem?",
    description: "I understand the basic concept but I'm confused about how the recursive function works in this example.",
    asker: { id: "", full_name: "Michael O." },
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    answer_count: 7,
    views: 51,
    is_answered: true,
    is_saved: false,
  },
  {
    id: "seed-3",
    institution: { id: "", name: "University of Ibadan" },
    course: { id: "", name: "Physics" },
    course_code: "PHY 204",
    title: "Help with this mechanics question",
    description: "I've tried solving this using the equations of motion but I'm not getting the expected answer.",
    asker: { id: "", full_name: "Sarah K." },
    created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    answer_count: 2,
    views: 34,
    is_answered: false,
    is_saved: false,
  },
  {
    id: "seed-4",
    institution: { id: "", name: "University of Nigeria, Nsukka" },
    course: { id: "", name: "Chemistry" },
    course_code: "CHM 102",
    title: "Please explain this organic chemistry question",
    description: "I need help understanding why this reaction produces this particular product.",
    asker: { id: "", full_name: "Chisom N." },
    created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    answer_count: 5,
    views: 67,
    is_answered: true,
    is_saved: false,
  },
];

const FILTERS = ["All", "Unanswered", "Answered", "Popular", "Saved"];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function CommunityPage() {
  const supabase = createClient();

  const [questions, setQuestions] = useState<Question[]>(SEED_QUESTIONS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedInstitutionId, setSelectedInstitutionId] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("Recent");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");

  const [institutions, setInstitutions] = useState<{ id: string; name: string }[]>([]);
  const [popularCourses, setPopularCourses] = useState<{ id: string; name: string; count: number }[]>([]);
  const [userInstitution, setUserInstitution] = useState<{ id: string; name: string } | null>(null);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  useEffect(() => {
    async function loadSidebar() {
      const token = await getToken();
      if (!token) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("institution_id, institution:institutions(id, name)")
          .eq("id", user.id)
          .single();

        if (profile?.institution) {
          const inst = Array.isArray(profile.institution)
            ? profile.institution[0]
            : profile.institution;
          if (inst) setUserInstitution(inst as { id: string; name: string });
        }

        const { data: profile2 } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();
        if (profile2?.full_name) setFirstName(profile2.full_name.split(" ")[0]);

        try {
          const r = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/avatar/me`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (r.ok) {
            const j = await r.json();
            if (j.avatar_url) setAvatarUrl(j.avatar_url);
          }
        } catch {}
      }

      const { data: instData } = await supabase
        .from("institutions")
        .select("id, name")
        .order("name");
      setInstitutions(instData ?? []);
    }
    loadSidebar();
  }, []);

  async function loadQuestions() {
    setLoading(true);
    setError("");
    const token = await getToken();
    if (!token) { setLoading(false); return; }

    try {
      const params = new URLSearchParams();
      if (activeFilter === "Unanswered") params.set("status", "unanswered");
      if (activeFilter === "Answered") params.set("status", "answered");
      if (activeFilter === "Popular" || sortBy === "Popular") params.set("sort", "popular");
      if (activeFilter === "Saved") params.set("saved", "true");
      if (selectedCourseId) params.set("course_id", selectedCourseId);
      if (selectedInstitutionId) params.set("institution_id", selectedInstitutionId);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/community/questions?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) throw new Error("Failed to load questions.");

      const data: Question[] = await res.json();

      if (data.length > 0) {
        setQuestions(data);
        const courseCounts: Record<string, { id: string; name: string; count: number }> = {};
        data.forEach((q) => {
          if (q.course) {
            if (!courseCounts[q.course.id]) {
              courseCounts[q.course.id] = { id: q.course.id, name: q.course.name, count: 0 };
            }
            courseCounts[q.course.id].count++;
          }
        });
        setPopularCourses(
          Object.values(courseCounts).sort((a, b) => b.count - a.count).slice(0, 5)
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQuestions();
  }, [activeFilter, sortBy, selectedCourseId, selectedInstitutionId]);

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => { loadQuestions(); }, 400);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [searchQuery]);

  async function toggleSaved(questionId: string) {
    if (questionId.startsWith("seed-")) return;
    const token = await getToken();
    if (!token) return;

    setQuestions((prev) =>
      prev.map((q) => q.id === questionId ? { ...q, is_saved: !q.is_saved } : q)
    );

    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/community/questions/${questionId}/save`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
    } catch {
      setQuestions((prev) =>
        prev.map((q) => q.id === questionId ? { ...q, is_saved: !q.is_saved } : q)
      );
    }
  }

  function clearFilters() {
    setSelectedCourseId("");
    setSelectedInstitutionId("");
    setActiveFilter("All");
  }

  const displayPopularCourses =
    popularCourses.length > 0
      ? popularCourses
      : [
          { id: "s1", name: "MTH 201", count: 124 },
          { id: "s2", name: "GST 101", count: 98 },
          { id: "s3", name: "CSC 301", count: 86 },
          { id: "s4", name: "PHY 204", count: 72 },
        ];

  return (
    <main className="min-h-screen bg-slate-50">

      {/* ── Header ── */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
                <Link href="/" className="transition hover:text-slate-900">Home</Link>
                <span>/</span>
                <span className="text-blue-600">Community</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950">Community</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Ask questions, share solutions, and learn with students across Nigerian institutions.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/community/ask"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                <Plus size={18} />
                Ask a Question
              </Link>
              <Link href="/dashboard/profile">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Profile"
                    className="h-10 w-10 rounded-xl object-cover ring-2 ring-blue-500/30 transition hover:ring-blue-500/60"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-[11px] font-black text-white shadow-md">
                    {firstName ? firstName.slice(0, 2).toUpperCase() : "?"}
                  </div>
                )}
              </Link>
            </div>
          </div>

          {/* Search */}
          <div className="mt-7 flex max-w-3xl items-center rounded-xl border border-slate-200 bg-slate-50 px-4 transition focus-within:border-blue-400 focus-within:bg-white">
            <Search size={19} className="shrink-0 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search questions, courses, topics..."
              className="w-full bg-transparent px-3 py-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── Main ── */}
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_300px]">

        {/* Feed */}
        <section className="min-w-0">

          {/* Filter tabs */}
          <div className="mb-7 flex flex-wrap items-center gap-2">
            {FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={`rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                  activeFilter === filter
                    ? "bg-slate-950 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                {filter}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={`ml-auto inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
                showFilters || selectedCourseId || selectedInstitutionId
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              <SlidersHorizontal size={16} />
              Filters
            </button>
          </div>

          {/* Filter panel */}
          {showFilters && (
            <div className="mb-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-slate-950">Refine questions</h3>
                  <p className="mt-1 text-sm text-slate-500">Narrow the feed by course or institution.</p>
                </div>
                {(selectedCourseId || selectedInstitutionId) && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    Clear filters
                  </button>
                )}
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold text-slate-500">Institution</span>
                  <select
                    value={selectedInstitutionId}
                    onChange={(e) => setSelectedInstitutionId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-700 outline-none focus:border-blue-400"
                  >
                    <option value="">All institutions</option>
                    {institutions.map((inst) => (
                      <option key={inst.id} value={inst.id}>{inst.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold text-slate-500">Course</span>
                  <select
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-700 outline-none focus:border-blue-400"
                  >
                    <option value="">All courses</option>
                    {displayPopularCourses.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          )}

          {/* Feed heading */}
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                {activeFilter === "All" ? "Recent Questions" : activeFilter}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {loading ? "Loading..." : `${questions.length} ${questions.length === 1 ? "question" : "questions"} matching your view.`}
              </p>
            </div>
            <label className="hidden items-center gap-1 text-sm font-medium text-slate-500 sm:flex">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="cursor-pointer appearance-none bg-transparent pr-5 outline-none"
              >
                <option>Recent</option>
                <option>Popular</option>
              </select>
              <ChevronDown size={16} className="-ml-5 pointer-events-none" />
            </label>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : questions.length > 0 ? (
            <div className="space-y-4">
              {questions.map((question) => {
                const isSeed = question.id.startsWith("seed-");
                const menuOpen = showMoreMenu === question.id;
                return (
                  <article
                    key={question.id}
                    className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm sm:p-6"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {question.course_code && (
                          <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            {question.course_code}
                          </span>
                        )}
                        {question.course_code && <span className="text-xs text-slate-300">•</span>}
                        <span className="text-xs font-medium text-slate-500">
                          {question.institution?.name ?? "Unknown institution"}
                        </span>
                      </div>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowMoreMenu(menuOpen ? null : question.id)}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                        >
                          <MoreHorizontal size={19} />
                        </button>
                        {menuOpen && (
                          <div className="absolute right-0 top-9 z-10 w-36 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                            {!isSeed && (
                              <button
                                type="button"
                                onClick={() => { toggleSaved(question.id); setShowMoreMenu(null); }}
                                className="w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-600 hover:bg-slate-50"
                              >
                                {question.is_saved ? "Remove save" : "Save question"}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setShowMoreMenu(null)}
                              className="w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-600 hover:bg-slate-50"
                            >
                              Report question
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {question.is_answered && (
                      <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        <CheckCircle2 size={13} />
                        Answered
                      </div>
                    )}

                    <h3 className="mt-4 text-lg font-semibold leading-7 text-slate-950 transition group-hover:text-blue-600">
                      {question.title}
                    </h3>

                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                      {question.description}
                    </p>

                    <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Users size={14} />
                        {question.asker?.full_name ?? "Anonymous"}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock3 size={14} />
                        {timeAgo(question.created_at)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MessageCircle size={14} />
                        {question.answer_count} {question.answer_count === 1 ? "answer" : "answers"}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Eye size={14} />
                        {question.views} views
                      </span>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                      <button
                        type="button"
                        onClick={() => toggleSaved(question.id)}
                        disabled={isSeed}
                        className={`rounded-lg p-2 transition ${
                          question.is_saved
                            ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                            : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        } disabled:opacity-30`}
                      >
                        {question.is_saved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
                      </button>
                      <div className="flex items-center gap-2">
                        <Link
                          href={isSeed ? "#" : `/community/${question.id}`}
                          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                        >
                          View Question
                        </Link>
                        {!question.is_answered && !isSeed && (
                          <Link
                            href={`/community/${question.id}#answer`}
                            className="hidden items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:inline-flex"
                          >
                            Answer
                          </Link>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                <Search size={21} />
              </div>
              <h3 className="mt-4 font-semibold text-slate-950">No questions found</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Try a different search term or clear your filters.
              </p>
              <button
                type="button"
                onClick={() => { setSearchQuery(""); clearFilters(); }}
                className="mt-5 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Clear search and filters
              </button>
            </div>
          )}

          <div className="mt-6 flex justify-center">
            <p className="text-xs text-slate-400">
              You&apos;re viewing the latest available questions.
            </p>
          </div>
        </section>

        {/* ── Sidebar ── */}
        <aside className="space-y-5">
          {userInstitution && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-semibold text-slate-950">Your Institution</h3>
              <p className="mt-1 text-sm leading-5 text-slate-500">Filter questions from your school.</p>
              <button
                type="button"
                onClick={() =>
                  setSelectedInstitutionId(
                    selectedInstitutionId === userInstitution.id ? "" : userInstitution.id
                  )
                }
                className={`mt-4 flex w-full items-center justify-between rounded-xl border px-3.5 py-3 text-sm font-medium transition ${
                  selectedInstitutionId === userInstitution.id
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span>{userInstitution.name}</span>
                <ChevronDown size={16} />
              </button>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-950">Popular Courses</h3>
              {selectedCourseId && (
                <button
                  type="button"
                  onClick={() => setSelectedCourseId("")}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {displayPopularCourses.map((course) => {
                const isSelected = selectedCourseId === course.id;
                return (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => setSelectedCourseId(isSelected ? "" : course.id)}
                    className={`flex w-full items-center justify-between py-3 text-left transition ${
                      isSelected ? "text-blue-700" : "text-slate-700"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium">{course.name}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{course.count} questions</p>
                    </div>
                    <span className={isSelected ? "text-blue-500" : "text-slate-300"}>→</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl bg-blue-600 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
              <MessageCircle size={20} className="text-white" />
            </div>
            <h3 className="mt-4 font-semibold text-white">Help a fellow student</h3>
            <p className="mt-2 text-sm leading-6 text-blue-100">
              Know how to solve a question? Share your solution and help another student understand it.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="font-semibold text-slate-950">Community Guidelines</h3>
            <ul className="mt-3 space-y-2 text-sm leading-5 text-slate-500">
              <li>• Be respectful to other students.</li>
              <li>• Explain your solutions clearly.</li>
              <li>• Keep discussions academic.</li>
              <li>• Don&apos;t post misleading answers.</li>
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}