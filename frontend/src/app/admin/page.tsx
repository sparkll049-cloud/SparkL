
"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
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
  TrendingUp,
  AlertTriangle,
  Upload,
  UserCheck,
  RefreshCw,
  ShieldAlert,
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
    new_users_today: number;
    new_users_this_week: number;
    new_questions_this_week: number;
    total_views: number;
    approval_rate: number;
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
  upload_trend: number[];
  user_trend: number[];
}

const panel =
  "rounded-xl border border-[var(--sp-border)] bg-[var(--sp-bg-card)]";

const primaryText = "text-[var(--sp-text)]";
const secondaryText = "text-[var(--sp-text-2)]";

const interactivePanel =
  `${panel} transition hover:border-[var(--sp-border-hover)]`;

function Sparkline({
  data,
  color,
  height = 40,
}: {
  data: number[];
  color: string;
  height?: number;
}) {
  if (data.length === 0) return null;

  const width = 140;
  const padding = 4;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  const max = Math.max(...data, 1);

  const points = data.map((value, index) => ({
    x:
      data.length === 1
        ? width / 2
        : padding + (index / (data.length - 1)) * plotWidth,
    y: height - padding - (value / max) * plotHeight,
  }));

  const last = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      className="max-w-full shrink"
      aria-hidden="true"
    >
      {points.length > 1 && (
        <polyline
          points={points.map(({ x, y }) => `${x},${y}`).join(" ")}
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.6"
        />
      )}
      <circle cx={last.x} cy={last.y} r="3.5" fill={color} />
    </svg>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-500/10 ring-amber-500/25",
    approved: "bg-emerald-500/10 ring-emerald-500/25",
    rejected: "bg-red-500/10 ring-red-500/25",
  };

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize ring-1 ${primaryText} ${
        styles[status] ??
        "bg-[var(--sp-bg-muted)] ring-[var(--sp-border)]"
      }`}
    >
      {status}
    </span>
  );
}

function Avatar({ name, size = 8 }: { name: string; size?: number }) {
  const displayName = name.trim() || "?";
  const colors = ["#2B6FEB", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444"];
  const index = displayName.charCodeAt(0) % colors.length;

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
      style={{
        background: colors[index],
        width: `${size * 0.25}rem`,
        height: `${size * 0.25}rem`,
      }}
    >
      {displayName.charAt(0).toUpperCase()}
    </div>
  );
}

export default function AdminOverviewPage() {
  const [supabase] = useState(() => createClient());
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) throw new Error("Session expired.");

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/overview`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      );

      if (!res.ok) throw new Error("Failed to load overview.");

      const overview: OverviewData = await res.json();
      setData(overview);
      setLastRefresh(new Date());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          <p className={`text-xs ${secondaryText}`}>Loading…</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="max-w-xs rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 h-7 w-7 text-red-500" />
          <p className={`text-sm font-medium ${primaryText}`}>
            {error || "No data."}
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className={`mt-4 rounded-lg bg-red-500/10 px-4 py-2 text-xs font-semibold transition hover:bg-red-500/20 ${primaryText}`}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { stats, recent_users, recent_questions } = data;

  const uploadTrend = data.upload_trend ?? [];
  const userTrend = data.user_trend ?? [];

  const total = Math.max(stats.total_questions, 1);
  const approvedPct = Math.round(
    (stats.approved_questions / total) * 100,
  );
  const pendingPct = Math.round(
    (stats.pending_questions / total) * 100,
  );
  const rejectedPct = Math.round(
    (stats.rejected_questions / total) * 100,
  );

  return (
    <div className={`space-y-6 pb-12 ${primaryText}`}>
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 border-b border-[var(--sp-border)] pb-2">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Overview</h1>
          <p className={`mt-0.5 text-xs ${secondaryText}`}>
            {lastRefresh
              ? `Refreshed at ${lastRefresh.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : "Loading overview"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-[var(--sp-border)] bg-[var(--sp-bg-muted)] px-3 py-1.5 text-xs font-medium text-[var(--sp-text-2)] transition hover:border-[var(--sp-border-hover)] hover:text-[var(--sp-text)] disabled:opacity-40"
        >
          <RefreshCw
            className={`h-3 w-3 ${loading ? "animate-spin" : ""}`}
          />
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm"
        >
          {error} Showing the last loaded overview.
        </div>
      )}

      {/* Pending alert */}
      {stats.pending_questions > 0 && (
        <Link
          href="/admin/questions?status=pending"
          className="flex items-center justify-between gap-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 transition hover:bg-amber-500/10"
        >
          <div className="flex min-w-0 items-center gap-3">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
            <div>
              <p className="text-sm font-semibold">
                {stats.pending_questions} upload
                {stats.pending_questions !== 1 ? "s" : ""} awaiting review
              </p>
              <p className={`mt-0.5 hidden text-xs sm:block ${secondaryText}`}>
                Students cannot see these until approved.
              </p>
            </div>
          </div>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        </Link>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total users"
          value={stats.total_users}
          delta={`+${stats.new_users_this_week ?? 0} this week`}
          deltaUp
          accent="#2B6FEB"
          href="/admin/users"
          sparkData={userTrend}
        />
        <StatCard
          label="Past questions"
          value={stats.total_questions}
          delta={`${stats.new_questions_this_week ?? 0} new this week`}
          deltaUp
          accent="#8B5CF6"
          href="/admin/questions"
          sparkData={uploadTrend}
        />
        <StatCard
          label="Total views"
          value={stats.total_views ?? 0}
          delta="All time"
          accent="#06B6D4"
          href="/admin/questions"
        />
        <StatCard
          label="Institutions"
          value={stats.total_institutions}
          delta={`${stats.total_departments} dept${
            stats.total_departments !== 1 ? "s" : ""
          }`}
          accent="#10B981"
          href="/admin/institutions"
        />
      </div>

      {/* Moderation and weekly activity */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
        <div className={`${panel} p-5 lg:col-span-3`}>
          <div className="mb-4 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Moderation pipeline</p>
            <span className={`text-xs ${secondaryText}`}>
              {stats.total_questions} total
            </span>
          </div>

          {stats.total_questions === 0 ? (
            <EmptyRow
              icon={<Upload className="h-5 w-5" />}
              text="No uploads yet"
            />
          ) : (
            <>
              <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--sp-ring-track)]">
                <div
                  className="h-full bg-amber-400 transition-all"
                  style={{
                    width: `${(stats.pending_questions / total) * 100}%`,
                  }}
                />
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{
                    width: `${(stats.approved_questions / total) * 100}%`,
                  }}
                />
                <div
                  className="h-full bg-red-500 transition-all"
                  style={{
                    width: `${(stats.rejected_questions / total) * 100}%`,
                  }}
                />
              </div>

              <div className="mt-5 space-y-1">
                <PipelineRow
                  icon={<Clock className="h-3.5 w-3.5" />}
                  label="Pending review"
                  value={stats.pending_questions}
                  pct={pendingPct}
                  dotColor="bg-amber-400"
                  textColor="text-amber-500"
                  href="/admin/questions?status=pending"
                />
                <PipelineRow
                  icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                  label="Approved"
                  value={stats.approved_questions}
                  pct={approvedPct}
                  dotColor="bg-emerald-500"
                  textColor="text-emerald-500"
                  href="/admin/questions?status=approved"
                />
                <PipelineRow
                  icon={<XCircle className="h-3.5 w-3.5" />}
                  label="Rejected"
                  value={stats.rejected_questions}
                  pct={rejectedPct}
                  dotColor="bg-red-500"
                  textColor="text-red-500"
                  href="/admin/questions?status=rejected"
                />
              </div>

              <div className="mt-5 flex items-center justify-between rounded-lg border border-emerald-500/15 bg-emerald-500/[0.07] px-4 py-3">
                <p className={`text-xs ${secondaryText}`}>Approval rate</p>
                <p className="text-xl font-black tabular-nums">
                  {approvedPct}%
                </p>
              </div>
            </>
          )}
        </div>

        <div className={`${panel} flex flex-col gap-5 p-5 lg:col-span-2`}>
          <p className="text-sm font-semibold">This week</p>

          <div className="flex-1 space-y-5">
            <ActivityRow
              label="Uploads"
              value={stats.new_questions_this_week ?? 0}
              color="#8B5CF6"
              data={uploadTrend}
            />
            <ActivityRow
              label="New users"
              value={stats.new_users_this_week ?? 0}
              color="#2B6FEB"
              data={userTrend}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-[var(--sp-border)] pt-3">
            <MiniStat
              label="Today's signups"
              value={String(stats.new_users_today ?? 0)}
            />
            <MiniStat label="Courses" value={String(stats.total_courses)} />
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className={`${panel} overflow-hidden`}>
          <div className="flex items-center justify-between gap-2 border-b border-[var(--sp-border)] px-5 py-3.5">
            <div className="flex items-center gap-2">
              <UserCheck className="h-3.5 w-3.5 text-blue-500" />
              <p className="text-sm font-semibold">Recent sign-ups</p>
            </div>
            <Link
              href="/admin/users"
              className="text-xs font-medium text-blue-500 hover:underline"
            >
              All users →
            </Link>
          </div>

          <div className="divide-y divide-[var(--sp-border)]">
            {recent_users.length === 0 ? (
              <EmptyRow
                icon={<Users className="h-4 w-4" />}
                text="No sign-ups yet"
              />
            ) : (
              recent_users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 px-5 py-3 transition hover:bg-[var(--sp-bg-muted)]"
                >
                  <Avatar name={user.full_name ?? "?"} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {user.full_name || "Unnamed"}
                    </p>
                    <p className={`truncate text-xs ${secondaryText}`}>
                      {user.institution?.name ?? "No institution"}
                    </p>
                  </div>
                  <p className={`shrink-0 text-xs ${secondaryText}`}>
                    {new Date(user.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={`${panel} overflow-hidden`}>
          <div className="flex items-center justify-between gap-2 border-b border-[var(--sp-border)] px-5 py-3.5">
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-violet-500" />
              <p className="text-sm font-semibold">Recent uploads</p>
            </div>
            <Link
              href="/admin/questions"
              className="text-xs font-medium text-blue-500 hover:underline"
            >
              All uploads →
            </Link>
          </div>

          <div className="divide-y divide-[var(--sp-border)]">
            {recent_questions.length === 0 ? (
              <EmptyRow
                icon={<FileText className="h-4 w-4" />}
                text="No uploads yet"
              />
            ) : (
              recent_questions.map((question) => (
                <div
                  key={question.id}
                  className="flex items-center gap-3 px-5 py-3 transition hover:bg-[var(--sp-bg-muted)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {question.title}
                    </p>
                    <p className={`truncate text-xs ${secondaryText}`}>
                      {question.course?.name ?? "—"} ·{" "}
                      {question.uploader?.full_name ?? "Unknown"}
                    </p>
                  </div>
                  <StatusPill status={question.status} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Management shortcuts */}
      <div>
        <p className={`mb-3 text-xs font-semibold ${secondaryText}`}>
          Quick access
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <ManageTile
            icon={<School className="h-3.5 w-3.5" />}
            label="Institutions"
            count={stats.total_institutions}
            href="/admin/institutions"
            color="#10B981"
          />
          <ManageTile
            icon={<BookOpen className="h-3.5 w-3.5" />}
            label="Departments"
            count={stats.total_departments}
            href="/admin/departments"
            color="#2B6FEB"
          />
          <ManageTile
            icon={<GraduationCap className="h-3.5 w-3.5" />}
            label="Courses"
            count={stats.total_courses}
            href="/admin/courses"
            color="#8B5CF6"
          />
          <ManageTile
            icon={<Layers className="h-3.5 w-3.5" />}
            label="Levels"
            href="/admin/levels"
            color="#06B6D4"
          />
          <ManageTile
            icon={<Layers className="h-3.5 w-3.5" />}
            label="Study Modes"
            href="/admin/study-modes"
            color="#EC4899"
          />
          <ManageTile
            icon={<CalendarDays className="h-3.5 w-3.5" />}
            label="Semesters"
            href="/admin/semesters"
            color="#F59E0B"
          />
          <ManageTile
            icon={<FileText className="h-3.5 w-3.5" />}
            label="Questions"
            count={stats.total_questions}
            href="/admin/questions"
            color="#EF4444"
          />
          <ManageTile
            icon={<Users className="h-3.5 w-3.5" />}
            label="Users"
            count={stats.total_users}
            href="/admin/users"
            color="#94A3B8"
          />
        </div>
      </div>
    </div>
  );
}

/* Sub-components */

function StatCard({
  label,
  value,
  delta,
  deltaUp,
  accent,
  href,
  sparkData,
}: {
  label: string;
  value: number;
  delta?: string;
  deltaUp?: boolean;
  accent: string;
  href: string;
  sparkData?: number[];
}) {
  return (
    <Link
      href={href}
      className={`${interactivePanel} group relative block overflow-hidden p-4`}
group relative block overflow-hidden p-4`}
    >
      <div
        className="absolute inset-y-0 left-0 w-0.5 rounded-l-xl"
        style={{ background: accent }}
      />

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`mb-1 text-xs ${secondaryText}`}>{label}</p>
          <p className={`text-3xl font-black leading-none tabular-nums ${primaryText}`}>
            {value.toLocaleString()}
          </p>
          {delta && (
            <p
              className={`mt-1.5 flex items-center gap-1 text-[11px] font-medium ${secondaryText}`}
            >
              {deltaUp && (
                <TrendingUp className="h-3 w-3 shrink-0 text-emerald-500" />
              )}
              {delta}
            </p>
          )}
        </div>
        {sparkData && (
          <Sparkline data={sparkData} color={accent} height={36} />
        )}
      </div>
    </Link>
  );
}

function PipelineRow({
  icon,
  label,
  value,
  pct,
  dotColor,
  textColor,
  href,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  pct: number;
  dotColor: string;
  textColor: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-[var(--sp-bg-muted)]"
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`} />
      <span
        className={`flex min-w-0 flex-1 items-center gap-1.5 text-xs ${textColor}`}
      >
        {icon}
        <span className={secondaryText}>{label}</span>
      </span>
      <span className={`text-sm font-bold tabular-nums ${primaryText}`}>
        {value}
      </span>
      <span className={`w-8 text-right text-xs ${secondaryText}`}>
        {pct}%
      </span>
    </Link>
  );
}

function ActivityRow({
  label,
  value,
  color,
  data,
}: {
  label: string;
  value: number;
  color: string;
  data: number[];
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className={`text-xs ${secondaryText}`}>{label}</p>
        <p className={`text-2xl font-black tabular-nums ${primaryText}`}>
          {value}
        </p>
      </div>
      <Sparkline data={data} color={color} height={38} />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--sp-border)] bg-[var(--sp-bg-muted)] px-3 py-2.5">
      <p className={`text-[11px] ${secondaryText}`}>{label}</p>
      <p className={`mt-0.5 text-lg font-black tabular-nums ${primaryText}`}>
        {value}
      </p>
    </div>
  );
}

function ManageTile({
  icon,
  label,
  count,
  href,
  color,
}: {
  icon: ReactNode;
  label: string;
  count?: number;
  href: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className={`${interactivePanel} flex items-center gap-3 px-3.5 py-3 hover:bg-[var(--sp-bg-muted)]`}
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `${color}18`, color }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className={`truncate text-sm font-medium ${primaryText}`}>
          {label}
        </p>
        {count !== undefined && (
          <p className={`text-xs ${secondaryText}`}>
            {count.toLocaleString()}
          </p>
        )}
      </div>
    </Link>
  );
}

function EmptyRow({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className={`flex flex-col items-center gap-2 py-10 ${secondaryText}`}>
      {icon}
      <p className="text-xs">{text}</p>
    </div>
  );
    }
  
