 "use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
} from "lucide-react";

type Question = {
  id: number;
  institution: string;
  course: string;
  title: string;
  description: string;
  author: string;
  time: string;
  answers: number;
  views: number;
  answered: boolean;
};

const questions: Question[] = [
  {
    id: 1,
    institution: "University of Lagos",
    course: "MTH 201",
    title: "How do I solve this differential equation?",
    description:
      "I'm having trouble understanding the second step of this question. Can someone explain the solution?",
    author: "Daniel A.",
    time: "2h ago",
    answers: 4,
    views: 28,
    answered: false,
  },
  {
    id: 2,
    institution: "Yaba College of Technology",
    course: "CSC 301",
    title: "Can someone explain this recursion problem?",
    description:
      "I understand the basic concept but I'm confused about how the recursive function works in this example.",
    author: "Michael O.",
    time: "4h ago",
    answers: 7,
    views: 51,
    answered: true,
  },
  {
    id: 3,
    institution: "University of Ibadan",
    course: "PHY 204",
    title: "Help with this mechanics question",
    description:
      "I've tried solving this using the equations of motion but I'm not getting the expected answer.",
    author: "Sarah K.",
    time: "6h ago",
    answers: 2,
    views: 34,
    answered: false,
  },
  {
    id: 4,
    institution: "University of Nigeria, Nsukka",
    course: "CHM 102",
    title: "Please explain this organic chemistry question",
    description:
      "I need help understanding why this reaction produces this particular product.",
    author: "Chisom N.",
    time: "8h ago",
    answers: 5,
    views: 67,
    answered: true,
  },
];

const filters = ["All", "Unanswered", "Answered", "Popular", "Following"];

const popularCourses = [
  { name: "MTH 201", questions: 124 },
  { name: "GST 101", questions: 98 },
  { name: "CSC 301", questions: 86 },
  { name: "PHY 204", questions: 72 },
];

export default function CommunityPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [savedQuestions, setSavedQuestions] = useState<number[]>([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedInstitution, setSelectedInstitution] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState("Recent");

  const filteredQuestions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    let result = questions.filter((question) => {
      const matchesSearch =
        !query ||
        [
          question.title,
          question.description,
          question.course,
          question.institution,
          question.author,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesCourse =
        !selectedCourse || question.course === selectedCourse;

      const matchesInstitution =
        !selectedInstitution ||
        question.institution === selectedInstitution;

      let matchesFilter = true;

      if (activeFilter === "Unanswered") matchesFilter = !question.answered;
      if (activeFilter === "Answered") matchesFilter = question.answered;
      if (activeFilter === "Popular")
        matchesFilter = question.views >= 50;
      if (activeFilter === "Following")
        matchesFilter = savedQuestions.includes(question.id);

      return (
        matchesSearch &&
        matchesCourse &&
        matchesInstitution &&
        matchesFilter
      );
    });

    if (sortBy === "Popular") {
      result = [...result].sort((a, b) => b.views - a.views);
    }

    return result;
  }, [
    activeFilter,
    savedQuestions,
    searchQuery,
    selectedCourse,
    selectedInstitution,
    sortBy,
  ]);

  const toggleSaved = (questionId: number) => {
    setSavedQuestions((current) =>
      current.includes(questionId)
        ? current.filter((id) => id !== questionId)
        : [...current, questionId]
    );
  };

  const clearFilters = () => {
    setSelectedCourse("");
    setSelectedInstitution("");
    setActiveFilter("All");
  };

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Community header */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
                <Link href="/" className="transition hover:text-slate-900">
                  Home
                </Link>
                <span>/</span>
                <span className="text-blue-600">Community</span>
              </div>

              <h1 className="text-3xl text-blue font-bold tracking-tight text-slate-950">
                Community
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Ask questions, share solutions, and learn with students across
                Nigerian institutions.
              </p>
            </div>

            <Link
              href="/community/ask"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <Plus size={18} />
              Ask a Question
            </Link>
          </div>

          {/* Search */}
          <div className="mt-7 flex max-w-3xl items-center rounded-xl border border-slate-200 bg-slate-50 px-4 transition focus-within:border-emerald-400 focus-within:bg-white">
            <Search size={19} className="shrink-0 text-slate-400" />

            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search questions, courses, topics..."
              aria-label="Search community questions"
              className="w-full bg-transparent px-3 py-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />

            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Main content */}
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Question feed */}
        <section className="min-w-0">
          {/* Filters */}
          <div className="mb-7 flex flex-wrap items-center gap-2">
            {filters.map((filter) => {
              const isActive = activeFilter === filter;

              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setActiveFilter(filter)}
                  className={`rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? "bg-slate-950 text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {filter}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setShowFilters((current) => !current)}
              aria-expanded={showFilters}
              className={`ml-auto inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
                showFilters ||
                selectedCourse ||
                selectedInstitution
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              <SlidersHorizontal size={16} />
              Filters
            </button>
          </div>

          {showFilters && (
            <div className="mb-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-slate-950">
                    Refine questions
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Narrow the feed by course or institution.
                  </p>
                </div>

                {(selectedCourse || selectedInstitution) && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                  >
                    Clear filters
                  </button>
                )}
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Course
                  </span>
                  <select
                    value={selectedCourse}
                    onChange={(event) => setSelectedCourse(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-700 outline-none focus:border-emerald-400"
                  >
                    <option value="">All courses</option>
                    {popularCourses.map((course) => (
                      <option key={course.name} value={course.name}>
                        {course.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Institution
                  </span>
                  <select
                    value={selectedInstitution}
                    onChange={(event) =>
                      setSelectedInstitution(event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-700 outline-none focus:border-emerald-400"
                  >
                    <option value="">All institutions</option>
                    {Array.from(
                      new Set(questions.map((question) => question.institution))
                    ).map((institution) => (
                      <option key={institution} value={institution}>
                        {institution}
                      </option>
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
                {filteredQuestions.length}{" "}
                {filteredQuestions.length === 1 ? "question" : "questions"}{" "}
                matching your view.
              </p>
            </div>

            <label className="hidden items-center gap-1 text-sm font-medium text-slate-500 sm:flex">
              <span className="sr-only">Sort questions</span>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="cursor-pointer appearance-none bg-transparent pr-5 outline-none"
              >
                <option>Recent</option>
                <option>Popular</option>
              </select>
              <ChevronDown size={16} className="-ml-5 pointer-events-none" />
            </label>
          </div>

          {/* Questions */}
          {filteredQuestions.length > 0 ? (
            <div className="space-y-4">
              {filteredQuestions.map((question) => {
                const isSaved = savedQuestions.includes(question.id);
                const menuOpen = showMoreMenu === question.id;

                return (
                  <article
                    key={question.id}
                    className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm sm:p-6"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          {question.course}
                        </span>

                        <span className="text-xs text-slate-300">•</span>

                        <span className="text-xs font-medium text-slate-500">
                          {question.institution}
                        </span>
                      </div>

                      <div className="relative">
                        <button
                          type="button"
                          aria-label={`More options for ${question.title}`}
                          aria-expanded={menuOpen}
                          onClick={() =>
                            setShowMoreMenu(menuOpen ? null : question.id)
                          }
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                        >
                          <MoreHorizontal size={19} />
                        </button>

                        {menuOpen && (
                          <div className="absolute right-0 top-9 z-10 w-36 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                            <button
                              type="button"
                              onClick={() => {
                                toggleSaved(question.id);
                                setShowMoreMenu(null);
                              }}
                              className="w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-600 hover:bg-slate-50"
                            >
                              {isSaved ? "Remove save" : "Save question"}
                            </button>
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

                    {question.answered && (
                      <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        <CheckCircle2 size={13} />
                        Answered
                      </div>
                    )}

                    <h3 className="mt-4 text-lg font-semibold leading-7 text-slate-950 transition group-hover:text-emerald-700">
                      {question.title}
                    </h3>

                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                      {question.description}
                    </p>

                    <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Users size={14} />
                        {question.author}
                      </span>

                      <span className="flex items-center gap-1.5">
                        <Clock3 size={14} />
                        {question.time}
                      </span>

                      <span className="flex items-center gap-1.5">
                        <MessageCircle size={14} />
                        {question.answers} answers
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
                        aria-label={
                          isSaved ? "Remove saved question" : "Save question"
                        }
                        aria-pressed={isSaved}
                        className={`rounded-lg p-2 transition ${
                          isSaved
                            ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                            : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        }`}
                      >
                        {isSaved ? (
                          <BookmarkCheck size={18} />
                        ) : (
                          <Bookmark size={18} />
                        )}
                      </button>

                      <div className="flex items-center gap-2">
                        <Link
                          href={`/community/${question.id}`}
                          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                        >
                          View Question
                        </Link>

                        {!question.answered && (
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

              <h3 className="mt-4 font-semibold text-slate-950">
                No questions found
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Try a different search term or clear your filters to see more
                questions.
              </p>

              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  clearFilters();
                }}
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

        {/* Sidebar */}
        <aside className="space-y-5">
          {/* Institution */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="font-semibold text-slate-950">Your Institution</h3>

            <p className="mt-1 text-sm leading-5 text-slate-500">
              Personalize your community feed.
            </p>

            <button
              type="button"
              onClick={() =>
                setSelectedInstitution(
                  selectedInstitution === "University of Lagos"
                    ? ""
                    : "University of Lagos"
                )
              }
              className={`mt-4 flex w-full items-center justify-between rounded-xl border px-3.5 py-3 text-sm font-medium transition ${
                selectedInstitution === "University of Lagos"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <span>University of Lagos</span>
              <ChevronDown size={16} />
            </button>
          </div>

          {/* Popular courses */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-950">
                Popular Courses
              </h3>

              <button
                type="button"
                onClick={() => setSelectedCourse("")}
                className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
              >
                Clear
              </button>
            </div>

            <div className="mt-4 divide-y divide-slate-100">
              {popularCourses.map((course) => {
                const isSelected = selectedCourse === course.name;

                return (
                  <button
                    key={course.name}
                    type="button"
                    onClick={() =>
                      setSelectedCourse(isSelected ? "" : course.name)
                    }
                    className={`flex w-full items-center justify-between py-3 text-left transition ${
                      isSelected ? "text-emerald-700" : "text-slate-700"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium">{course.name}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {course.questions} questions
                      </p>
                    </div>

                    <span
                      className={
                        isSelected ? "text-emerald-500" : "text-slate-300"
                      }
                    >
                      →
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Community message */}
          <div className="rounded-2xl bg-blue-600 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
              <MessageCircle size={20} className="text-white" />
            </div>

            <h3 className="mt-4 font-semibold text-white">
              Help a fellow student
            </h3>

            <p className="mt-2 text-sm leading-6 text-white-50">
              Know how to solve a question? Share your solution and help
              another student understand it.
            </p>
          </div>

          {/* Guidelines */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="font-semibold text-slate-950">
              Community Guidelines
            </h3>

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
