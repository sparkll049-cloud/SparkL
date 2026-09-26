"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, CheckCircle2, Clock3, Eye, MessageCircle,
  Send, Upload, ThumbsUp, MoreHorizontal, Flag,
  Loader2, AlertCircle, X, Check,
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
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function Avatar({
  userId, name, avatarCache, size = "md",
}: {
  userId: string | undefined;
  name: string | null | undefined;
  avatarCache: Record<string, string | null>;
  size?: "sm" | "md";
}) {
  const url = userId ? avatarCache[userId] : null;
  const dim = size === "sm" ? "h-5 w-5 text-[9px]" : "h-10 w-10 text-sm";
  if (url) {
    return (
      <img
        src={url}
        alt={name ?? ""}
        className={`${dim} shrink-0 rounded-full object-cover`}
      />
    );
  }
  return (
    <div className={`${dim} shrink-0 flex items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700`}>
      {getInitials(name)}
    </div>
  );
}

// ── Report modal ──────────────────────────────────────────────────────────────

const REPORT_REASONS = [
  "Spam or misleading",
  "Inappropriate content",
  "Off-topic",
  "Plagiarism",
  "Other",
];

function ReportModal({
  onClose, onSubmit, loading,
}: {
  onClose: () => void;
  onSubmit: (reason: string) => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-950">Report</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-4">Why are you reporting this?</p>
        <div className="space-y-2">
          {REPORT_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={`w-full rounded-xl border px-4 py-2.5 text-left text-sm font-medium transition ${
                reason === r
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <button
          onClick={() => onSubmit(reason)}
          disabled={loading}
          className="mt-5 w-full rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-50 transition"
        >
          {loading ? "Submitting…" : "Submit Report"}
        </button>
      </div>
    </div>
  );
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [avatarCache, setAvatarCache] = useState<Record<string, string | null>>({});

  const [solutionText, setSolutionText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [postError, setPostError] = useState("");
  const [votingId, setVotingId] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [reportTarget, setReportTarget] = useState<{ type: "question" | "answer"; id: string } | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  async function fetchAvatar(userId: string, token: string) {
    if (avatarCache[userId] !== undefined) return;
    try {
      const r = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/community/users/${userId}/avatar`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (r.ok) {
        const j = await r.json();
        setAvatarCache((prev) => ({ ...prev, [userId]: j.avatar_url ?? null }));
      } else {
        setAvatarCache((prev) => ({ ...prev, [userId]: null }));
      }
    } catch {
      setAvatarCache((prev) => ({ ...prev, [userId]: null }));
    }
  }

  // Load current user
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    }
    load();
  }, []);

  // Load question
  useEffect(() => {
    if (questionId.startsWith("seed-")) { setNotFound(true); setLoadingQuestion(false); return; }
    async function load() {
      setLoadingQuestion(true);
      const token = await getToken();
      if (!token) { router.push("/auth/login"); return; }
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/community/questions/${questionId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.status === 404) { setNotFound(true); setLoadingQuestion(false); return; }
      if (res.ok) {
        const q = await res.json();
        setQuestion(q);
        if (q.asker?.id) fetchAvatar(q.asker.id, token);
      }
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
      if (res.ok) {
        const data = await res.json();
        setAnswers(data);
        data.forEach((a: Answer) => {
          if (a.answerer?.id) fetchAvatar(a.answerer.id, token);
        });
      }
      setLoadingAnswers(false);
    }
    load();
  }, [questionId]);

  async function handlePostSolution() {
    if (!solutionText.trim()) return;
    setIsPosting(true);
    setPostError("");
    const token = await getToken();
    if (!token) { setPostError("Session expired."); setIsPosting(false); return; }
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/community/questions/${questionId}/answers`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ content: solutionText.trim() }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail ?? "Failed to post answer.");
      }
      const newAnswer: Answer = await res.json();
      if (currentUserId) fetchAvatar(currentUserId, token);
      setAnswers((prev) => [...prev, { ...newAnswer, voted_helpful: false }]);
      setSolutionText("");
      setSelectedFile(null);
      setQuestion((prev) => prev ? { ...prev, is_answered: true } : prev);
      showToast("Answer posted!");
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
      prev.map((a) => a.id === answerId
        ? { ...a, voted_helpful: !a.voted_helpful, helpful_count: a.helpful_count + (a.voted_helpful ? -1 : 1) }
        : a)
    );
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/community/answers/${answerId}/vote`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
    } catch {
      setAnswers((prev) =>
        prev.map((a) => a.id === answerId
          ? { ...a, voted_helpful: !a.voted_helpful, helpful_count: a.helpful_count + (a.voted_helpful ? -1 : 1) }
          : a)
      );
    } finally {
      setVotingId(null);
    }
  }

  async function acceptAnswer(answerId: string) {
    setAcceptingId(answerId);
    const token = await getToken();
    if (!token) { setAcceptingId(null); return; }
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/community/answers/${answerId}/accept`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        setAnswers((prev) =>
          prev.map((a) => ({ ...a, is_accepted: a.id === answerId }))
        );
        setQuestion((prev) => prev ? { ...prev, is_answered: true } : prev);
        showToast("Answer accepted!");
      }
    } catch {} finally {
      setAcceptingId(null);
    }
  }

  async function submitReport(reason: string) {
    if (!reportTarget) return;
    setReportLoading(true);
    const token = await getToken();
    if (!token) { setReportLoading(false); return; }
    try {
      const url = reportTarget.type === "question"
        ? `${process.env.NEXT_PUBLIC_API_URL}/api/community/questions/${reportTarget.id}/report`
        : `${process.env.NEXT_PUBLIC_API_URL}/api/community/answers/${reportTarget.id}/report`;
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason }),
      });
      setReportSuccess(true);
      setTimeout(() => { setReportTarget(null); setReportSuccess(false); }, 1500);
      showToast("Report submitted. Thank you.");
    } catch {} finally {
      setReportLoading(false);
    }
  }

  if (notFound) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-5xl px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
            <AlertCircle size={26} className="text-slate-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Question not found</h1>
          <p className="mt-2 text-slate-500">This question may have been removed or doesn't exist.</p>
          <Link href="/community" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">
            <ArrowLeft size={16} /> Back to Community
          </Link>
        </div>
      </main>
    );
  }

  if (loadingQuestion) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
      </main>
    );
  }

  if (!question) return null;

  const isMyQuestion = currentUserId && question.asker?.id === currentUserId;
  const myAvatarUrl = currentUserId ? avatarCache[currentUserId] : null;

  return (
    <main className="min-h-screen bg-slate-50">

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xl">
          <CheckCircle2 size={16} className="text-emerald-400" />
          {toast}
        </div>
      )}

      {/* Report modal */}
      {reportTarget && (
        <ReportModal
          onClose={() => setReportTarget(null)}
          onSubmit={submitReport}
          loading={reportLoading}
        />
      )}

      <div className="mx-auto max-w-5xl px-6 py-8">

        <Link href="/community" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900">
          <ArrowLeft size={17} /> Back to Community
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
            <span className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              question.is_answered ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
            }`}>
              {question.is_answered ? <><CheckCircle2 size={13} /> Answered</> : "Unanswered"}
            </span>
          </div>

          <h1 className="mt-5 text-2xl font-bold leading-9 text-slate-950 sm:text-3xl">
            {question.title}
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
            {question.description}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-5 border-t border-slate-100 pt-5 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Avatar userId={question.asker?.id} name={question.asker?.full_name} avatarCache={avatarCache} size="sm" />
              {question.asker?.full_name ?? "Anonymous"}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock3 size={14} /> Asked {timeAgo(question.created_at)}
            </span>
            <span className="flex items-center gap-1.5">
              <MessageCircle size={14} /> {answers.length} {answers.length === 1 ? "answer" : "answers"}
            </span>
            <span className="flex items-center gap-1.5">
              <Eye size={14} /> {question.views} views
            </span>
            {!isMyQuestion && (
              <button
                type="button"
                onClick={() => setReportTarget({ type: "question", id: question.id })}
                className="ml-auto inline-flex items-center gap-1.5 transition hover:text-red-500"
              >
                <Flag size={14} /> Report
              </button>
            )}
          </div>
        </article>

        {/* ── Answers ── */}
        <section className="mt-8">
          <div className="flex items-end justify-between gap-4 mb-5">
            <div>
              <h2 className="text-xl font-bold text-slate-950">Community Answers</h2>
              <p className="mt-1 text-sm text-slate-500">Solutions shared by other students.</p>
            </div>
            <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500 sm:inline-flex">
              {answers.length} {answers.length === 1 ? "answer" : "answers"}
            </span>
          </div>

          {loadingAnswers ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            </div>
          ) : answers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <MessageCircle size={28} className="mx-auto text-slate-300" />
              <h3 className="mt-4 text-sm font-semibold text-slate-800">No answers yet</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Be the first student to share a helpful explanation.
              </p>
              <a href="#answer" className="mt-5 inline-flex rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700">
                Share an Answer
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              {answers.map((answer) => {
                const isMyAnswer = currentUserId && answer.answerer?.id === currentUserId;
                const menuOpen = openMenuId === answer.id;
                return (
                  <article
                    key={answer.id}
                    className={`rounded-2xl border bg-white p-6 ${
                      answer.is_accepted ? "border-emerald-300 bg-emerald-50/30" : "border-slate-200"
                    }`}
                  >
                    {answer.is_accepted && (
                      <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 size={12} /> Accepted Answer
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <Avatar
                        userId={answer.answerer?.id}
                        name={answer.answerer?.full_name}
                        avatarCache={avatarCache}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">
                          {answer.answerer?.full_name ?? "Anonymous"}
                          {isMyAnswer && <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-500">You</span>}
                        </p>
                        <p className="text-xs text-slate-400">{timeAgo(answer.created_at)}</p>
                      </div>

                      {/* More menu */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenMenuId(menuOpen ? null : answer.id)}
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                        >
                          <MoreHorizontal size={18} />
                        </button>
                        {menuOpen && (
                          <div className="absolute right-0 top-10 z-20 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                            {isMyQuestion && !answer.is_accepted && (
                              <button
                                type="button"
                                onClick={() => { acceptAnswer(answer.id); setOpenMenuId(null); }}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                              >
                                <Check size={13} /> Accept this answer
                              </button>
                            )}
                            {!isMyAnswer && (
                              <button
                                type="button"
                                onClick={() => { setReportTarget({ type: "answer", id: answer.id }); setOpenMenuId(null); }}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50"
                              >
                                <Flag size={13} /> Report answer
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setOpenMenuId(null)}
                              className="w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-500 hover:bg-slate-50"
                            >
                              Close
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <p className="mt-5 text-sm leading-7 text-slate-600 whitespace-pre-wrap">
                      {answer.content}
                    </p>

                    <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
                      <button
                        type="button"
                        onClick={() => toggleHelpful(answer.id)}
                        disabled={votingId === answer.id || !!isMyAnswer}
                        title={isMyAnswer ? "You can't vote on your own answer" : ""}
                        className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                          answer.voted_helpful
                            ? "bg-emerald-50 text-emerald-700"
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                        }`}
                      >
                        {votingId === answer.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <ThumbsUp size={14} className={answer.voted_helpful ? "fill-emerald-500" : ""} />
                        )}
                        Helpful
                        {answer.helpful_count > 0 && (
                          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px]">
                            {answer.helpful_count}
                          </span>
                        )}
                      </button>

                      {isMyQuestion && !answer.is_accepted && (
                        <button
                          type="button"
                          onClick={() => acceptAnswer(answer.id)}
                          disabled={acceptingId === answer.id}
                          className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                        >
                          {acceptingId === answer.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Check size={14} />
                          )}
                          Accept answer
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Answer box ── */}
        <section id="answer" className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 sm:p-7">
          <div className="flex items-center gap-3 mb-5">
            {myAvatarUrl ? (
              <img src={myAvatarUrl} alt="You" className="h-9 w-9 rounded-full object-cover shrink-0" />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-[11px] font-black text-white">
                {currentUserId ? "?" : "?"}
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Share your answer</h2>
              <p className="text-sm text-slate-500">Help this student by explaining your approach.</p>
            </div>
          </div>

          <textarea
            value={solutionText}
            onChange={(e) => setSolutionText(e.target.value)}
            placeholder="Write your answer or explanation..."
            rows={6}
            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
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
                <Upload size={16} /> Attach file
              </button>
              {selectedFile && (
                <p className="mt-2 max-w-[260px] truncate text-xs text-slate-400">{selectedFile.name}</p>
              )}
            </div>
            <button
              type="button"
              onClick={handlePostSolution}
              disabled={!solutionText.trim() || isPosting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPosting ? <><Loader2 size={16} className="animate-spin" /> Posting...</> : <><Send size={16} /> Post Answer</>}
            </button>
          </div>
        </section>

      </div>
    </main>
  );
}