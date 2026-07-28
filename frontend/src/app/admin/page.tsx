"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  School,
  BookOpen,
  GraduationCap,
  FileText,
  Users,
  Layers,
  CalendarDays,
  Loader2,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";

interface OverviewData {
  stats: {
    total_users: number;
    suspended_users: number;
    total_institutions: number;
    total_departments: number;
    total_courses: number;
    total_questions: number;
    pending_questions: number;
    approved_questions: number;
    rejected_questions: number;
  };
  recent_users: {
    id: string;
    full_name: string | null;
    created_at: string;
    institution: { name: string } | null;
  }[];
  recent_questions: {
    id: string;
    title: string;
    status: string;
    created_at: string;
    course: { name: string } | null;
    uploader: { full_name: string | null } | null;
  }[];
}

export default function AdminOverviewPage() {
  const supabase = createClient();

  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("Session expired. Please log in again.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/admin/overview`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );

        if (!res.ok) throw new Error("Failed to load admin overview.");

        setData(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-slate-500">{error || "No data available."}</p>
      </div>
    );
  }

  const { stats, recent_users, recent_questions } = data;

  const total = stats.total_questions || 1; // guard div-by-zero for the pipeline bar
  const pendingPct = Math.round((stats.pending_questions / total) * 100);
  const approvedPct = Math.round((stats.approved_questions / total) * 100);
  const rejectedPct = Math.max(0, 100 - pendingPct - approvedPct);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
            Admin
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Platform-wide status across users, courses, and uploads.
          </p>
        </div>
      </div>

      {/* Priority banner — only renders when there's something to act on */}
      {stats.pending_questions > 0 && (
        <Link
          href="/admin/questions?status=pending"
          className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 transition hover:bg-amber-100"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100">
              <Clock size={16} className="text-amber-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-900">
                {stats.pending_questions} upload
                {stats.pending_questions !== 1 ? "s" : ""} waiting on review
              </p>
              <p className="text-xs text-amber-700">
                Students can't see these until an admin approves them.
              </p>
            </div>
          </div>
          <ArrowRight size={16} className="flex-shrink-0 text-amber-700" />
        </Link>
      )}

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<Users size={18} />}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          label="Users"
          value={stats.total_users}
          footnote={
            stats.suspended_users > 0
              ? `${stats.suspended_users} suspended`
              : "All active"
          }
          href="/admin/users"
        />
        <StatCard
          icon={<FileText size={18} />}
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
          label="Past Questions"
          value={stats.total_questions}
          footnote={`${stats.pending_questions} pending review`}
          href="/admin/questions"
        />
        <StatCard
          icon={<School size={18} />}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          label="Institutions"
          value={stats.total_institutions}
          footnote={`${stats.total_departments} departments`}
          href="/admin/institutions"
        />
        <StatCard
          icon={<GraduationCap size={18} />}
          iconBg="bg-orange-50"
          iconColor="text-orange-600"
          label="Courses"
          value={stats.total_courses}
          href="/admin/courses"
        />
      </div>

      {/* Moderation pipeline */}
      <div className="mt-8 rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">
            Moderation Pipeline
          </h2>
          <span className="text-xs text-slate-400">
            {stats.total_questions} total submissions
          </span>
        </div>

        {stats.total_questions === 0 ? (
          <p className="mt-4 text-sm text-slate-400">
            No past questions submitted yet.
          </p>
        ) : (
          <>
            <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              {pendingPct > 0 && (
                <div
                  className="h-full bg-amber-400"
                  style={{ width: `${pendingPct}%` }}
                />
              )}
              {approvedPct > 0 && (
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: `${approvedPct}%` }}
                />
              )}
              {rejectedPct > 0 && (
                <div
                  className="h-full bg-red-400"
                  style={{ width: `${rejectedPct}%` }}
                />
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
              <PipelineLegend
                dot="bg-amber-400"
                icon={<Clock size={12} />}
                label="Pending"
                value={stats.pending_questions}
              />
              <PipelineLegend
                dot="bg-emerald-500"
                icon={<CheckCircle2 size={12} />}
                label="Approved"
                value={stats.approved_questions}
              />
              <PipelineLegend
                dot="bg-red-400"
                icon={<XCircle size={12} />}
                label="Rejected"
                value={stats.rejected_questions}
              />
            </div>
          </>
        )}
      </div>

      {/* Manage — quick nav grid */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-slate-800">Manage</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <ManageTile icon={<School size={16} />} label="Institutions" href="/admin/institutions" />
          <ManageTile icon={<BookOpen size={16} />} label="Departments" href="/admin/departments" />
          <ManageTile icon={<GraduationCap size={16} />} label="Courses" href="/admin/courses" />
          <ManageTile icon={<Layers size={16} />} label="Levels" href="/admin/levels" />
          <ManageTile icon={<Layers size={16} />} label="Study Modes" href="/admin/study-modes" />
          <ManageTile icon={<CalendarDays size={16} />} label="Semesters" href="/admin/semesters" />
          <ManageTile icon={<FileText size={16} />} label="Past Questions" href="/admin/questions" />
          <ManageTile icon={<Users size={16} />} label="Users" href="/admin/users" />
        </div>
      </div>

      {/* Recent activity */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-800">
              Recent Sign-ups
            </h2>
            <Link
              href="/admin/users"
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              View all
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {recent_users.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-400">
                No entries yet.
              </p>
            ) : (
              recent_users.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {u.full_name ?? "Unnamed User"}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {u.institution?.name ?? "No institution set"}
                    </p>
                  </div>
                  <p className="flex-shrink-0 text-xs text-slate-400">
                    {new Date(u.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-800">
              Recent Uploads
            </h2>
            <Link
              href="/admin/questions"
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              View all
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {recent_questions.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-400">
                No entries yet.
              </p>
            ) : (
              recent_questions.map((q) => (
                <div
                  key={q.id}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {q.title}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {q.course?.name ?? "—"} · {q.uploader?.full_name ?? "Unknown"}
                    </p>
                  </div>
                  <StatusPill status={q.status} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  footnote,
  href,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: number;
  footnote?: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md"
    >
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconBg} ${iconColor}`}>
        {icon}
      </div>
      <p className="mt-4 text-2xl font-bold tabular-nums text-slate-900">
        {value.toLocaleString()}
      </p>
      <p className="text-xs text-slate-500">{label}</p>
      {footnote && (
        <p className="mt-1 text-[11px] font-medium text-slate-400 group-hover:text-slate-500">
          {footnote}
        </p>
      )}
    </Link>
  );
}

function PipelineLegend({
  dot,
  icon,
  label,
  value,
}: {
  dot: string;
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <span className="flex items-center gap-1 text-slate-500">
        {icon}
        {label}
      </span>
      <span className="font-semibold tabular-nums text-slate-800">{value}</span>
    </div>
  );
}

function ManageTile({
  icon,
  label,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-blue-200 hover:bg-blue-50/40"
    >
      <span className="text-slate-400 transition group-hover:text-blue-600">
        {icon}
      </span>
      <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">
        {label}
      </span>
    </Link>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700",
    approved: "bg-emerald-50 text-emerald-700",
    rejected: "bg-red-50 text-red-600",
  };

  return (
    <span
      className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${
        styles[status] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {status}
    </span>
  );
}