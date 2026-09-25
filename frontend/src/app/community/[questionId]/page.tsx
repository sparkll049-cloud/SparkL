"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Eye,
  MessageCircle,
  Send,
  Upload,
  ThumbsUp,
  MoreHorizontal,
  Flag,
  Paperclip,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

type Question = {
  id: string;
  title: string;
  description: string;
  course_code: string | null;
  views: number;
  is_answered: boolean;
  created_at: string;
  institution: { id: string; name: string } | null;
  course: { id: string; name: string } | null;
  asker: { id: string; full_name: string } | null;
};

type Answer = {
  id: string;
  content: string;
  helpful_count: number;
  is_accepted: boolean;
  voted_helpful: boolean;
  created_at: string;
  answerer: { id: string; full_name: string } | null;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function QuestionDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const questionId = String(params.questionId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [question, setQuestion] = useState<Question | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loadingQuestion, setLoadingQuestion] = useState(true);
  const [loadingAnswers, setLoadingAnswers] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [solutionText, setSolutionText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [postError, setPostError] = useState("");
  const [votingId, setVotingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  // Load avatar + current user id
  useEffect(() => {
    async function loadAvatar() {
      const token = await getToken();
      if (!token) return;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setCurrentUserId(user.id);

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
    loadAvatar();
  }, []);

  // Load question
  useEffect(() => {
    if (questionId.startsWith("seed-")) {
      setNotFound(true);
      setLoadingQuestion(false);
      return;
    }

    async function load() {
      setLoadingQuestion(true);
      const token = await getToken();
      if (!token) { router.push("/auth/login"); return; }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/community/questions/${questionId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.status === 404) { setNotFound(true); setLoadingQuestion(false); return; }
      if (res.ok) setQuestion(await res.json());
      setLoadingQuestion(false);
    }
    load();
  }, [questionId]);

  // Load answers
  useEffect(() => {
    if (questionId.startsWith("seed-")) { setLoadingAnswers(false); return; }

    async function load() {
      setLoadingAnswers(true);
      const token = await getToken();
      if (!token) return;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/community/questions/${questionId}/answers`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.ok) setAnswers(await res.json());
      setLoadingAnswers(false);
    }
    load();
  }, [questionId]);

  async function handlePostSolution() {
    if (!solutionText.trim()) return;
    setIsPosting(true);
    setPostError("");

    const token = await getToken();
    if (!token) { setPostError("Session expired. Please log in."); setIsPosting(false); return; }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/community/questions/${questionId}/answers`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content: solutionText.trim() }),
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail ?? "Failed to post answer.");
      }

      const newAnswer: Answer = await res.json();
      setAnswers((prev) => [...prev, newAnswer]);
      setSolutionText("");
      setSelectedFile(null);
      setQuestion((prev) => prev ? { ...prev, is_answered: true } : prev);
    } catch (err) {
      setPostError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsPosting(false);
    }
  }

  async function toggleHelpful(answerId: string) {
    setVotingId(answerId);
    const token = await getToken();
    if (!token) { setVotingId(null); return; }

    setAnswers((prev) =>
      prev.map((a) =>
        a.id === answerId
          ? {
              ...a,
              voted_helpful: !a.voted_helpful,
              helpful_count: a.helpful_count + (a.voted_helpful ? -1 : 1),
            }
          : a
      )
    );

    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/community/answers/${answerId}/vote`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
    } catch {
      setAnswers((prev) =>
        prev.map((a) =>
          a.id === answerId
            ? {
                ...a,
                voted_helpful: !a.voted_helpful,
                helpful_count: a.helpful_count + (a.voted_helpful ? -1 : 1),
              }
            : a
        )
      );
    } finally {
      setVotingId(null);
    }
  }

  // ── Not found ──
  if (notFound) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-5xl px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
            <AlertCircle size={26} className="text-slate-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Question not found</h1>
          <p className="mt-2 text-slate-500">
            This question may have been removed or doesn't exist.
          </p>
          <Link
            href="/community"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <ArrowLeft size={16} />
            Back to Community
          </Link>
        </div>
      </main>
    );
  }

  // ── Loading ──
  if (loadingQuestion) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
      </main>
    );
  }

  if (!question) return null;

  const isMyQuestion = currentUserId && question.asker?.id === currentUserId;

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

        {/* ── Question ── */}
        <article className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
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
            <span
              className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                question.is_answered
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {question.is_answered ? (
                <><CheckCircle2 size={13} /> Answered</>
              ) : (
                "Unanswered"
              )}
            </span>
          </div>

          <h1 className="mt-5 text-2xl font-bold leading-9 text-slate-950 sm:text-3xl">
            {question.title}
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
            {question.description}
          </p>

          {/* Metadata */}
          <div className="mt-6 flex flex-wrap items-center gap-5 border-t border-slate-100 pt-5 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              {isMyQuestion && avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="h-5 w-5 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-600">
                  {getInitials(question.asker?.full_name)}
                </div>
              )}
              {question.asker?.full_name ?? "Anonymous"}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock3 size={14} />
              Asked {timeAgo(question.created_at)}
            </span>
            <span className="flex items-center gap-1.5">
              <MessageCircle size={14} />
              {answers.length} {answers.length === 1 ? "answer" : "answers"}
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

        {/* ── Answers ── */}
        <section className="mt-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-950">Community Answers</h2>
              <p className="mt-1 text-sm text-slate-500">
                Solutions shared by other students.
              </p>
            </div>
            <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500 sm:inline-flex">
              {answers.length} {answers.length === 1 ? "answer" : "answers"}
            </span>
          </div>

          {loadingAnswers ? (
            <div className="mt-5 flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            </div>
          ) : answers.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <MessageCircle size={28} className="mx-auto text-slate-300" />
              <h3 className="mt-4 text-sm font-semibold text-slate-800">No answers yet</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Be the first student to share a helpful explanation.
              </p>
              <a
                href="#answer"
                className="mt-5 inline-flex rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Share an Answer
              </a>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {answers.map((answer) => {
                const isMyAnswer = currentUserId && answer.answerer?.id === currentUserId;
                return (
                  <article
                    key={answer.id}
                    className={`rounded-2xl border bg-white p-6 ${
                      answer.is_accepted
                        ? "border-emerald-200 bg-emerald-50/30"
                        : "border-slate-200"
                    }`}
                  >
                    {answer.is_accepted && (
                      <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 size={12} />
                        Accepted Answer
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      {isMyAnswer && avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt="Profile"
                          className="h-10 w-10 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                          {getInitials(answer.answerer?.full_name)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">
                          {answer.answerer?.full_name ?? "Anonymous"}
                        </p>
                        <p className="text-xs text-slate-400">
                          {timeAgo(answer.created_at)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setOpenMenuId(openMenuId === answer.id ? null : answer.id)}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                    </div>

                    <p className="mt-5 text-sm leading-7 text-slate-600">
                      {answer.content}
                    </p>

                    <div className="mt-5 border-t border-slate-100 pt-4">
                      <button
                        type="button"
                        onClick={() => toggleHelpful(answer.id)}
                        disabled={votingId === answer.id}
                        className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                          answer.voted_helpful
                            ? "bg-emerald-50 text-emerald-700"
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                        }`}
                      >
                        {votingId === answer.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <ThumbsUp size={14} />
                        )}
                        Helpful
                        {answer.helpful_count > 0 && ` · ${answer.helpful_count}`}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Answer box ── */}
        <section
          id="answer"
          className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 sm:p-7"
        >
          <div className="flex items-center gap-3 mb-4">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profile"
                className="h-9 w-9 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-[11px] font-black text-white">
                ?
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Share your answer</h2>
              <p className="text-sm text-slate-500">
                Help this student by explaining how you would approach this question.
              </p>
            </div>
          </div>

          <textarea
            value={solutionText}
            onChange={(e) => setSolutionText(e.target.value)}
            placeholder="Write your answer or explanation..."
            rows={6}
            className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
          />

          {postError && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
              <AlertCircle size={14} className="shrink-0 text-red-500" />
              <p className="text-xs text-red-600">{postError}</p>
            </div>
          )}

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Upload size={16} />
                Attach file
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
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPosting ? (
                <><Loader2 size={16} className="animate-spin" /> Posting...</>
              ) : (
                <><Send size={16} /> Post Answer</>
              )}
            </button>
          </div>
        </section>

      </div>
    </main>
  );
}