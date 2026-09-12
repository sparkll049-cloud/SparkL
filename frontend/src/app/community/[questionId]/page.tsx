"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Eye,
  MessageCircle,
  Send,
  Upload,
  User,
  ThumbsUp,
  MoreHorizontal,
  Flag,
  Paperclip,
} from "lucide-react";

type Solution = {
  id: string;
  initials: string;
  name: string;
  institution: string;
  time: string;
  content: string;
  helpful: boolean;
  helpfulCount: number;
};

const questionData = {
  "1": {
    courseCode: "MTH 201",
    institution: "University of Lagos",
    title: "How do I solve this differential equation?",
    description:
      "I'm having trouble understanding the second step of this question. Can someone explain the solution and show me how to approach similar problems?",
    author: "Daniel A.",
    time: "2 hours ago",
    views: 28,
    answered: true,
  },
  "2": {
    courseCode: "CSC 301",
    institution: "Yaba College of Technology",
    title: "Can someone explain this data structure question?",
    description:
      "I understand the basic concept, but I'm confused about how the algorithm works in this particular example.",
    author: "Michael E.",
    time: "4 hours ago",
    views: 41,
    answered: true,
  },
  "3": {
    courseCode: "PHY 204",
    institution: "University of Ibadan",
    title: "Help with this mechanics problem",
    description:
      "I'm struggling with the second part of this problem. I'd appreciate a step-by-step explanation.",
    author: "Sarah K.",
    time: "6 hours ago",
    views: 19,
    answered: false,
  },
};

const initialSolutions: Solution[] = [
  {
    id: "solution-1",
    initials: "JO",
    name: "John O.",
    institution: "University of Lagos",
    time: "1 hour ago",
    content:
      "First, separate the variables and integrate both sides. The important part is to identify the correct integrating factor before simplifying the equation.",
    helpful: true,
    helpfulCount: 8,
  },
];

export default function QuestionDetailsPage() {
  const params = useParams();
  const questionId = String(params.questionId);

  const question =
    questionData[questionId as keyof typeof questionData] ??
    questionData["1"];

  const [solutions, setSolutions] = useState(initialSolutions);
  const [solutionText, setSolutionText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [isHelpful, setIsHelpful] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
  };

  const handlePostSolution = async () => {
    if (!solutionText.trim()) return;

    setIsPosting(true);

    // Backend integration will replace this later.
    await new Promise((resolve) => setTimeout(resolve, 700));

    const newSolution: Solution = {
      id: `solution-${Date.now()}`,
      initials: "YO",
      name: "You",
      institution: "Your Institution",
      time: "Just now",
      content: solutionText.trim(),
      helpful: false,
      helpfulCount: 0,
    };

    setSolutions((current) => [newSolution, ...current]);
    setSolutionText("");
    setSelectedFile(null);
    setIsPosting(false);
  };

  const toggleHelpful = (solutionId: string) => {
    setIsHelpful((current) => ({
      ...current,
      [solutionId]: !current[solutionId],
    }));
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Back */}
        <Link
          href="/community"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft size={17} />
          Back to Community
        </Link>

        {/* Question */}
        <article className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          {/* Course + Status */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              {question.courseCode}
            </span>

            <span className="text-xs text-slate-300">•</span>

            <span className="text-xs font-medium text-slate-500">
              {question.institution}
            </span>

            <span
              className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                question.answered
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {question.answered ? (
                <>
                  <CheckCircle2 size={13} />
                  Answered
                </>
              ) : (
                "Unanswered"
              )}
            </span>
          </div>

          {/* Title */}
          <h1 className="mt-5 text-2xl font-bold leading-9 text-slate-950 sm:text-3xl">
            {question.title}
          </h1>

          {/* Description */}
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
            {question.description}
          </p>

          {/* Question attachment */}
          <div className="mt-6 flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50">
            <div className="text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm">
                <Paperclip size={19} />
              </div>

              <p className="mt-3 text-sm font-medium text-slate-500">
                Question attachment
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Question image or document will appear here
              </p>
            </div>
          </div>

          {/* Metadata */}
          <div className="mt-6 flex flex-wrap items-center gap-5 border-t border-slate-100 pt-5 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <User size={14} />
              {question.author}
            </span>

            <span className="flex items-center gap-1.5">
              <Clock3 size={14} />
              Asked {question.time}
            </span>

            <span className="flex items-center gap-1.5">
              <MessageCircle size={14} />
              {solutions.length}{" "}
              {solutions.length === 1 ? "answer" : "answers"}
            </span>

            <span className="flex items-center gap-1.5">
              <Eye size={14} />
              {question.views} views
            </span>

            <button
              type="button"
              className="ml-auto inline-flex items-center gap-1.5 transition hover:text-slate-700"
            >
              <Flag size={14} />
              Report
            </button>
          </div>
        </article>

        {/* Solutions */}
        <section className="mt-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-950">
                Community Solutions
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Solutions shared by other students.
              </p>
            </div>

            <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500 sm:inline-flex">
              {solutions.length}{" "}
              {solutions.length === 1 ? "solution" : "solutions"}
            </span>
          </div>

          {solutions.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <MessageCircle
                size={28}
                className="mx-auto text-slate-300"
              />

              <h3 className="mt-4 text-sm font-semibold text-slate-800">
                No solutions yet
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Be the first student to share a helpful explanation.
              </p>

              <Link
                href="#answer"
                className="mt-5 inline-flex rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                Share a Solution
              </Link>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {solutions.map((solution) => {
                const markedHelpful =
                  isHelpful[solution.id] ?? solution.helpful;

                return (
                  <article
                    key={solution.id}
                    className="rounded-2xl border border-slate-200 bg-white p-6"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
                        {solution.initials}
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          {solution.name}
                        </p>

                        <p className="truncate text-xs text-slate-400">
                          {solution.institution} · {solution.time}
                        </p>
                      </div>

                      <button
                        type="button"
                        className="ml-auto rounded-lg p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                        aria-label="More options"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                    </div>

                    <p className="mt-5 text-sm leading-7 text-slate-600">
                      {solution.content}
                    </p>

                    <div className="mt-5 flex items-center border-t border-slate-100 pt-4">
                      <button
                        type="button"
                        onClick={() => toggleHelpful(solution.id)}
                        className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                          markedHelpful
                            ? "bg-emerald-50 text-emerald-700"
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                        }`}
                      >
                        <ThumbsUp size={15} />
                        Helpful
                        {solution.helpfulCount > 0 &&
                          ` · ${solution.helpfulCount}`}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Answer box */}
        <section
          id="answer"
          className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 sm:p-7"
        >
          <h2 className="text-lg font-semibold text-slate-950">
            Share your solution
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Help this student by explaining how you solved the question.
          </p>

          <textarea
            value={solutionText}
            onChange={(event) => setSolutionText(event.target.value)}
            placeholder="Write your solution or explanation..."
            className="mt-5 min-h-[160px] w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
          />

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx"
                onChange={handleFileChange}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Upload size={16} />
                Upload Solution
              </button>

              {selectedFile && (
                <p className="mt-2 max-w-[260px] truncate text-xs text-slate-400">
                  {selectedFile.name}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handlePostSolution}
              disabled={!solutionText.trim() || isPosting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={16} />
              {isPosting ? "Posting..." : "Post Solution"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}