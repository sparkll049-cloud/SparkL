"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  School,
  BookOpen,
  GraduationCap,
  FileText,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  UserX,
  Loader2,
  ArrowUpRight,
  AlertTriangle,
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
          {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }
        );

        if (!res.ok) throw new Error("Failed to load admin overview.");

        setData(await res.json());
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Something went wrong."
        );
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
        <p className="text-slate-500">{error || "No data available."}</p>
      </div>
    );
  }

  const { stats, recent_users, recent_questions } = data;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Admin Overview</h1>
      <p className="mt-1 text-sm text-slate-500">
        A snapshot of everything happening on SparkL.
      </p>

      {/* Pending moderation alert */}
      {stats.pending_questions > 0 && (
        <Link
          href="/admin/questions?status=pending"
          className="mt-6 flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 p-4 transition hover:bg-amber-100"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-amber-600" />
            <p className="text-sm font-medium text-amber-800">
              {stats.pending_questions} past question
              {stats.pending_questions !== 1 ? "s" : ""} waiting for review
            </p>
          </div>
          <ArrowUpRight size={18} className="text-amber-600" />
        </Link>
      )}

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<Users size={20} className="text-blue-600" />}
          label="Total Users"
          value={stats.total_users}
          sub={
            stats.suspended_users > 0
              ? `${stats.suspended_users} suspended`
              : undefined
          }
          href="/admin/users"
        />
        <StatCard
          icon={<FileText size={20} className="text-blue-600" />}
          label="Past Questions"
          value={stats.total_questions}
          sub={`${stats.pending_questions} pending`}
          href="/admin/questions"
        />
        <StatCard
          icon={<School size={20} className="text-blue-600" />}
          label="Institutions"
          value={stats.total_institutions}
          href="/admin/institutions"
        />
        <StatCard
          icon={<GraduationCap size={20} className="text-blue-600" />}
          label="Courses"
          value={stats.total_courses}
          href="/admin/courses"
        />
      </div>

      {/* Moderation breakdown */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MiniStat
          icon={<Clock size={18} className="text-amber-600" />}
          label="Pending"
          value={stats.pending_questions}
          tone="amber"
        />
        <MiniStat
          icon={<CheckCircle2 size={18} className="text-green-600" />}
          label="Approved"
          value={stats.approved_questions}
          tone="green"
        />
        <MiniStat
          icon={<XCircle size={18} className="text-red-500" />}
          label="Rejected"
          value={stats.rejected_questions}
          tone="red"
        />
      </div>

      {/* Quick management links */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-slate-700">
          Manage Site Data
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <QuickLink
            icon={<School size={20} className="text-blue-600" />}
            label="Institutions"
            href="/admin/institutions"
          />
          <QuickLink
            icon={<BookOpen size={20} className="text-blue-600" />}
            label="Departments"
            href="/admin/departments"
          />
          <QuickLink
            icon={<GraduationCap size={20} className="text-blue-600" />}
            label="Courses"
            href="/admin/courses"
          />
          <QuickLink
            icon={<FileText size={20} className="text-blue-600" />}
            label="Past Questions"
            href="/admin/questions"
          />
          <QuickLink
            icon={<Users size={20} className="text-blue-600" />}
            label="Users"
            href="/admin/users"
          />
          <QuickLink
            icon={<UserX size={20} className="text-blue-600" />}
            label="Levels & Study Modes"
            href="/admin/levels"
          />
        </div>
      </div>

      {/* Recent activity */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              Recent Sign-ups
            </h2>
            <Link
              href="/admin/users"
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              View all
            </Link>
          </div>

          {recent_users.length === 0 ? (
            <p className="mt-6 py-6 text-center text-sm text-slate-400">
              No users yet.
            </p>
          ) : (
            <div className="mt-3 divide-y divide-slate-100">
              {recent_users.map((u) => (
                <div key={u.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {u.full_name ?? "Unnamed User"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {u.institution?.name ?? "No institution set"}
                    </p>
                  </div>
                  <p className="text-xs text-slate-400">
                    {new Date(u.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              Recent Uploads
            </h2>
            <Link
              href="/admin/questions"
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              View all
            </Link>
          </div>

          {recent_questions.length === 0 ? (
            <p className="mt-6 py-6 text-center text-sm text-slate-400">
              No uploads yet.
            </p>
          ) : (
            <div className="mt-3 divide-y divide-slate-100">
              {recent_questions.map((q) => (
                <div key={q.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {q.title}
                    </p>
                    <p className="text-xs text-slate-500">
                      {q.course?.name ?? "—"} · {q.uploader?.full_name ?? "Unknown"}
                    </p>
                  </div>
                  <StatusPill status={q.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub?: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
        {icon}
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
      {sub && <p className="mt-1 text-xs font-medium text-amber-600">{sub}</p>}
    </Link>
  );
}

function MiniStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "amber" | "green" | "red";
}) {
  const bg =
    tone === "amber"
      ? "bg-amber-50"
      : tone === "green"
      ? "bg-green-50"
      : "bg-red-50";

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
      <div className={`flex h-9 w-9 items-center justify-center rounded-full ${bg}`}>
        {icon}
      </div>
      <div>
        <p className="text-lg font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function QuickLink({
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
      className="flex items-center justify-between rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
          {icon}
        </div>
        <p className="font-semibold text-slate-900">{label}</p>
      </div>
      <ArrowUpRight size={18} className="text-slate-400" />
    </Link>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700",
    approved: "bg-green-50 text-green-700",
    rejected: "bg-red-50 text-red-600",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
        styles[status] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {status}
    </span>
  );
}