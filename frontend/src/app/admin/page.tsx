
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  School, BookOpen, GraduationCap, FileText, Users, Layers, CalendarDays,
  Loader2, ArrowRight, Clock, CheckCircle2, XCircle, TrendingUp,
  TrendingDown, Activity, AlertTriangle, Eye, Upload, UserCheck,
  BarChart3, Zap, RefreshCw, ShieldAlert,
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

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ data, color, height = 40 }: { data: number[]; color: string; height?: number }) {
  const w = 140;
  const max = Math.max(...data, 1);
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => `${i * step},${height - (v / max) * (height - 4)}`).join(" ");
  const last = data[data.length - 1];
  const cx = (data.length - 1) * step;
  const cy = height - (last / max) * (height - 4);
  return (
    <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} fill="none">
      <polyline points={pts} stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.6" />
      <circle cx={cx} cy={cy} r="3.5" fill={color} />
    </svg>
  );
}

// ── Status pill ───────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending:  "bg-amber-400/10 text-amber-400 ring-1 ring-amber-400/25",
    approved: "bg-emerald-400/10 text-emerald-400 ring-1 ring-emerald-400/25",
    rejected: "bg-red-400/10 text-red-400 ring-1 ring-red-400/25",
  };
  return (
    <span className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize ${styles[status] ?? "bg-slate-400/10 text-slate-400"}`}>
      {status}
    </span>
  );
}

// ── Avatar initials ───────────────────────────────────────────────────────────

function Avatar({ name, size = 8 }: { name: string; size?: number }) {
  const colors = ["#2B6FEB", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444"];
  const idx = name.charCodeAt(0) % colors.length;
  return (
    <div
      className={`flex h-${size} w-${size} shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white`}
      style={{ background: colors[idx] }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminOverviewPage() {
  const supabase = createClient();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState(new Date());

  async function load() {
    setLoading(true);
    setError("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError("Session expired."); setLoading(false); return; }
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/overview`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error("Failed to load overview.");
      setData(await res.json());
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          <p className="text-xs text-slate-600">Loading…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="max-w-xs rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 h-7 w-7 text-red-400" />
          <p className="text-sm font-medium text-red-300">{error || "No data."}</p>
          <button onClick={load} className="mt-4 rounded-lg bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { stats, recent_users, recent_questions } = data;
  const uploadTrend = data.upload_trend?.length ? data.upload_trend : [2, 5, 3, 8, 6, 11, 9];
  const userTrend   = data.user_trend?.length   ? data.user_trend   : [1, 3, 2, 4, 5, 3, 7];

  const total       = Math.max(stats.total_questions, 1);
  const approvedPct = Math.round((stats.approved_questions / total) * 100);
  const pendingPct  = Math.round((stats.pending_questions / total) * 100);
  const rejectedPct = Math.max(0, 100 - approvedPct - pendingPct);

  return (
    <div className="space-y-6 pb-12" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── Page header ── */}
      <div className="flex items-center justify-between gap-4 pb-2 border-b border-white/[0.05]">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">Overview</h1>
          <p className="mt-0.5 text-xs text-slate-600">
            Refreshed at {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:border-white/15 transition disabled:opacity-40"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>

      {/* ── Pending alert ── */}
      {stats.pending_questions > 0 && (
        <Link
          href="/admin/questions?status=pending"
          className="flex items-center justify-between gap-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 hover:bg-amber-500/10 transition"
        >
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
            <p className="text-sm font-semibold text-amber-300">
              {stats.pending_questions} upload{stats.pending_questions !== 1 ? "s" : ""} awaiting review
            </p>
            <span className="hidden sm:inline text-xs text-amber-600">— students can't see these until approved</span>
          </div>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        </Link>
      )}

      {/* ── Stat row ── */}
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
          delta={`${stats.total_departments} dept${stats.total_departments !== 1 ? "s" : ""}`}
          accent="#10B981"
          href="/admin/institutions"
        />
      </div>

      {/* ── Mid row: pipeline + activity ── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">

        {/* Moderation pipeline — 3 cols */}
        <div className="lg:col-span-3 rounded-xl border border-white/[0.06] bg-[#0C1428] p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-slate-200">Moderation pipeline</p>
            <span className="text-xs text-slate-600">{stats.total_questions} total</span>
          </div>

          {stats.total_questions === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <Upload className="h-5 w-5 text-slate-700" />
              <p className="text-xs text-slate-600">No uploads yet</p>
            </div>
          ) : (
            <>
              {/* Stacked bar */}
              <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
                <div className="h-full bg-amber-400 transition-all" style={{ width: `${pendingPct}%` }} />
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${approvedPct}%` }} />
                <div className="h-full bg-red-500 transition-all"   style={{ width: `${rejectedPct}%` }} />
              </div>

              {/* Rows */}
              <div className="mt-5 space-y-1">
                <PipelineRow
                  icon={<Clock className="h-3.5 w-3.5" />}
                  label="Pending review"
                  value={stats.pending_questions}
                  pct={pendingPct}
                  dotColor="bg-amber-400"
                  textColor="text-amber-400"
                  href="/admin/questions?status=pending"
                />
                <PipelineRow
                  icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                  label="Approved"
                  value={stats.approved_questions}
                  pct={approvedPct}
                  dotColor="bg-emerald-500"
                  textColor="text-emerald-400"
                  href="/admin/questions?status=approved"
                />
                <PipelineRow
                  icon={<XCircle className="h-3.5 w-3.5" />}
                  label="Rejected"
                  value={stats.rejected_questions}
                  pct={rejectedPct}
                  dotColor="bg-red-500"
                  textColor="text-red-400"
                  href="/admin/questions?status=rejected"
                />
              </div>

              {/* Approval rate callout */}
              <div className="mt-5 rounded-lg bg-emerald-500/[0.07] border border-emerald-500/15 px-4 py-3 flex items-center justify-between">
                <p className="text-xs text-slate-500">Approval rate</p>
                <p className="text-xl font-black tabular-nums text-emerald-400">{approvedPct}%</p>
              </div>
            </>
          )}
        </div>

        {/* Weekly activity — 2 cols */}
        <div className="lg:col-span-2 rounded-xl border border-white/[0.06] bg-[#0C1428] p-5 flex flex-col gap-5">
          <p className="text-sm font-semibold text-slate-200">This week</p>

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

          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/[0.05]">
            <MiniStat label="Today's signups" value={String(stats.new_users_today ?? 0)} />
            <MiniStat label="Courses" value={String(stats.total_courses)} />
          </div>
        </div>
      </div>

      {/* ── Recent activity ── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">

        {/* Recent sign-ups */}
        <div className="rounded-xl border border-white/[0.06] bg-[#0C1428] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.05]">
            <div className="flex items-center gap-2 text-slate-300">
              <UserCheck className="h-3.5 w-3.5 text-blue-400" />
              <p className="text-sm font-semibold">Recent sign-ups</p>
            </div>
            <Link href="/admin/users" className="text-xs font-medium text-blue-500 hover:text-blue-400 transition">
              All users →
            </Link>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {recent_users.length === 0 ? (
              <EmptyRow icon={<Users className="h-4 w-4" />} text="No sign-ups yet" />
            ) : recent_users.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition">
                <Avatar name={u.full_name ?? "?"} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-200">{u.full_name ?? "Unnamed"}</p>
                  <p className="truncate text-xs text-slate-600">{u.institution?.name ?? "No institution"}</p>
                </div>
                <p className="shrink-0 text-xs text-slate-700">
                  {new Date(u.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent uploads */}
        <div className="rounded-xl border border-white/[0.06] bg-[#0C1428] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.05]">
            <div className="flex items-center gap-2 text-slate-300">
              <FileText className="h-3.5 w-3.5 text-violet-400" />
              <p className="text-sm font-semibold">Recent uploads</p>
            </div>
            <Link href="/admin/questions" className="text-xs font-medium text-blue-500 hover:text-blue-400 transition">
              All uploads →
            </Link>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {recent_questions.length === 0 ? (
              <EmptyRow icon={<FileText className="h-4 w-4" />} text="No uploads yet" />
            ) : recent_questions.map((q) => (
              <div key={q.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-200">{q.title}</p>
                  <p className="truncate text-xs text-slate-600">
                    {q.course?.name ?? "—"} · {q.uploader?.full_name ?? "Unknown"}
                  </p>
                </div>
                <StatusPill status={q.status} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Manage shortcuts ── */}
      <div>
        <p className="mb-3 text-xs font-semibold text-slate-600">Quick access</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <ManageTile icon={<School className="h-3.5 w-3.5" />}        label="Institutions" count={stats.total_institutions}  href="/admin/institutions"  color="#10B981" />
          <ManageTile icon={<BookOpen className="h-3.5 w-3.5" />}      label="Departments"  count={stats.total_departments}   href="/admin/departments"   color="#2B6FEB" />
          <ManageTile icon={<GraduationCap className="h-3.5 w-3.5" />} label="Courses"      count={stats.total_courses}       href="/admin/courses"       color="#8B5CF6" />
          <ManageTile icon={<Layers className="h-3.5 w-3.5" />}        label="Levels"                                         href="/admin/levels"        color="#06B6D4" />
          <ManageTile icon={<Layers className="h-3.5 w-3.5" />}        label="Study Modes"                                    href="/admin/study-modes"   color="#EC4899" />
          <ManageTile icon={<CalendarDays className="h-3.5 w-3.5" />}  label="Semesters"                                      href="/admin/semesters"     color="#F59E0B" />
          <ManageTile icon={<FileText className="h-3.5 w-3.5" />}      label="Questions"    count={stats.total_questions}     href="/admin/questions"     color="#EF4444" />
          <ManageTile icon={<Users className="h-3.5 w-3.5" />}         label="Users"        count={stats.total_users}         href="/admin/users"         color="#94A3B8" />
        </div>
      </div>

    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────────────── */

function StatCard({
  label, value, delta, deltaUp, accent, href, sparkData,
}: {
  label: string; value: number; delta?: string; deltaUp?: boolean;
  accent: string; href: string; sparkData?: number[];
}) {
  return (
    <Link
      href={href}
      className="group relative rounded-xl border border-white/[0.06] bg-[#0C1428] p-4 overflow-hidden hover:border-white/[0.12] transition block"
    >
      {/* Left accent stripe */}
      <div className="absolute inset-y-0 left-0 w-0.5 rounded-l-xl" style={{ background: accent }} />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-slate-600 mb-1">{label}</p>
          <p className="text-3xl font-black tabular-nums text-white leading-none">{value.toLocaleString()}</p>
          {delta && (
            <p className={`mt-1.5 flex items-center gap-1 text-[11px] font-medium ${deltaUp ? "text-emerald-400" : "text-slate-600"}`}>
              {deltaUp && <TrendingUp className="h-3 w-3" />}
              {delta}
            </p>
          )}
        </div>
        {sparkData && <Sparkline data={sparkData} color={accent} height={36} />}
      </div>
    </Link>
  );
}

function PipelineRow({
  icon, label, value, pct, dotColor, textColor, href,
}: {
  icon: React.ReactNode; label: string; value: number; pct: number;
  dotColor: string; textColor: string; href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-white/[0.03] transition"
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`} />
      <span className={`flex items-center gap-1.5 text-xs flex-1 min-w-0 ${textColor}`}>
        {icon}
        <span className="text-slate-500">{label}</span>
      </span>
      <span className="text-sm font-bold tabular-nums text-slate-200">{value}</span>
      <span className="w-8 text-right text-xs text-slate-700">{pct}%</span>
    </Link>
  );
}

function ActivityRow({ label, value, color, data }: { label: string; value: number; color: string; data: number[] }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-xs text-slate-600">{label}</p>
        <p className="text-2xl font-black tabular-nums text-white">{value}</p>
      </div>
      <Sparkline data={data} color={color} height={38} />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] px-3 py-2.5">
      <p className="text-[11px] text-slate-600">{label}</p>
      <p className="mt-0.5 text-lg font-black tabular-nums text-white">{value}</p>
    </div>
  );
}

function ManageTile({
  icon, label, count, href, color,
}: {
  icon: React.ReactNode; label: string; count?: number; href: string; color: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#0C1428] px-3.5 py-3 hover:border-white/[0.12] hover:bg-white/[0.03] transition"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: `${color}18`, color }}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-300">{label}</p>
        {count !== undefined && <p className="text-xs text-slate-700">{count.toLocaleString()}</p>}
      </div>
    </Link>
  );
}

function EmptyRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-slate-700">
      {icon}
      <p className="text-xs">{text}</p>
    </div>
  );
}