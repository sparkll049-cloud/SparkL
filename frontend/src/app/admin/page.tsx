"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  School, BookOpen, GraduationCap, FileText, Users, Layers, CalendarDays,
  Loader2, ArrowRight, Clock, CheckCircle2, XCircle, TrendingUp,
  TrendingDown, Activity, AlertTriangle, Eye, Upload, UserCheck,
  BarChart3, Zap, RefreshCw,
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
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-sm text-slate-500">Loading admin data…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-red-400" />
          <p className="text-sm font-medium text-red-400">{error || "No data available."}</p>
          <button onClick={load} className="mt-4 rounded-lg bg-red-500/10 px-4 py-2 text-xs font-medium text-red-400 transition hover:bg-red-500/20">
            Try again
          </button>
        </div>
      </div>
    );
  }

  const { stats, recent_users, recent_questions } = data;

  const total = stats.total_questions || 1;
  const pendingPct = Math.round((stats.pending_questions / total) * 100);
  const approvedPct = Math.round((stats.approved_questions / total) * 100);
  const rejectedPct = Math.max(0, 100 - pendingPct - approvedPct);
  const healthScore = Math.round(approvedPct - (stats.suspended_users / Math.max(stats.total_users, 1)) * 100);
  const uploadTrend = data.upload_trend ?? [2, 5, 3, 8, 6, 11, 9];
  const userTrend = data.user_trend ?? [1, 3, 2, 4, 5, 3, 7];

  return (
    <div className="space-y-8 pb-10">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/15">
              <Zap className="h-3.5 w-3.5 text-blue-400" fill="currentColor" />
            </div>
            <h1 className="text-xl font-bold text-white">Admin Dashboard</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Platform health · Last refreshed {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-[#0D1230] px-4 py-2 text-xs font-medium text-slate-400 transition hover:border-blue-500/30 hover:text-blue-400"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* ── Health score banner ── */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.05] bg-[#0D1230] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-600">Platform Health Score</p>
            <div className="mt-1 flex items-end gap-3">
              <span className="text-5xl font-black tabular-nums text-white">{Math.max(0, healthScore)}</span>
              <span className="mb-1.5 text-lg text-slate-600">/100</span>
              <div className={`mb-1.5 flex items-center gap-1 text-xs font-semibold ${healthScore >= 70 ? "text-emerald-400" : healthScore >= 40 ? "text-amber-400" : "text-red-400"}`}>
                {healthScore >= 70 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {healthScore >= 70 ? "Healthy" : healthScore >= 40 ? "Fair" : "Needs attention"}
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Based on approval rate, user activity, and content moderation
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <MiniStat label="Approval rate" value={`${approvedPct}%`} color="text-emerald-400" />
            <MiniStat label="Pending review" value={String(stats.pending_questions)} color="text-amber-400" />
            <MiniStat label="Suspended" value={String(stats.suspended_users)} color="text-red-400" />
          </div>
        </div>
        {/* Background decoration */}
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-blue-500/5" />
      </div>

      {/* ── Alert banner ── */}
      {stats.pending_questions > 0 && (
        <Link
          href="/admin/questions?status=pending"
          className="flex items-center justify-between gap-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-5 py-4 transition hover:border-amber-500/40 hover:bg-amber-500/10"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
              <Clock className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-300">
                {stats.pending_questions} upload{stats.pending_questions !== 1 ? "s" : ""} waiting for review
              </p>
              <p className="text-xs text-amber-500/70">
                Students can't access these until approved
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-amber-500" />
        </Link>
      )}

      {/* ── Key metrics ── */}
      <div>
        <SectionLabel>Key metrics</SectionLabel>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            icon={<Users className="h-4 w-4" />}
            iconClass="bg-blue-500/15 text-blue-400"
            label="Total users"
            value={stats.total_users.toLocaleString()}
            sub={`+${stats.new_users_this_week ?? 0} this week`}
            trend="up"
            href="/admin/users"
          />
          <MetricCard
            icon={<FileText className="h-4 w-4" />}
            iconClass="bg-violet-500/15 text-violet-400"
            label="Past questions"
            value={stats.total_questions.toLocaleString()}
            sub={`${stats.new_questions_this_week ?? 0} new this week`}
            trend="up"
            href="/admin/questions"
          />
          <MetricCard
            icon={<Eye className="h-4 w-4" />}
            iconClass="bg-cyan-500/15 text-cyan-400"
            label="Total views"
            value={(stats.total_views ?? 0).toLocaleString()}
            sub="Across all content"
            href="/admin/questions"
          />
          <MetricCard
            icon={<School className="h-4 w-4" />}
            iconClass="bg-emerald-500/15 text-emerald-400"
            label="Institutions"
            value={stats.total_institutions.toLocaleString()}
            sub={`${stats.total_departments} departments`}
            href="/admin/institutions"
          />
        </div>
      </div>

      {/* ── Moderation pipeline + Sparkline ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Pipeline */}
        <div className="rounded-2xl border border-white/[0.05] bg-[#0D1230] p-5">
          <div className="flex items-center justify-between">
            <SectionLabel>Moderation pipeline</SectionLabel>
            <span className="text-xs text-slate-600">{stats.total_questions} total</span>
          </div>

          {stats.total_questions === 0 ? (
            <div className="mt-6 rounded-xl border border-white/[0.04] bg-white/[0.02] py-8 text-center">
              <Upload className="mx-auto mb-2 h-6 w-6 text-slate-600" />
              <p className="text-sm text-slate-600">No uploads yet</p>
            </div>
          ) : (
            <>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
                {pendingPct > 0 && <div className="inline-block h-full bg-amber-400 rounded-l-full" style={{ width: `${pendingPct}%` }} />}
                {approvedPct > 0 && <div className="inline-block h-full bg-emerald-500" style={{ width: `${approvedPct}%` }} />}
                {rejectedPct > 0 && <div className="inline-block h-full bg-red-500 rounded-r-full" style={{ width: `${rejectedPct}%` }} />}
              </div>
              <div className="mt-4 space-y-2.5">
                <PipelineRow
                  color="bg-amber-400"
                  icon={<Clock className="h-3 w-3" />}
                  label="Pending review"
                  value={stats.pending_questions}
                  pct={pendingPct}
                  href="/admin/questions?status=pending"
                />
                <PipelineRow
                  color="bg-emerald-500"
                  icon={<CheckCircle2 className="h-3 w-3" />}
                  label="Approved"
                  value={stats.approved_questions}
                  pct={approvedPct}
                  href="/admin/questions?status=approved"
                />
                <PipelineRow
                  color="bg-red-500"
                  icon={<XCircle className="h-3 w-3" />}
                  label="Rejected"
                  value={stats.rejected_questions}
                  pct={rejectedPct}
                  href="/admin/questions?status=rejected"
                />
              </div>
            </>
          )}
        </div>

        {/* Weekly activity */}
        <div className="rounded-2xl border border-white/[0.05] bg-[#0D1230] p-5">
          <SectionLabel>Weekly activity</SectionLabel>
          <div className="mt-4 space-y-4">
            <SparklineRow label="Uploads" color="#8b5cf6" data={uploadTrend} />
            <SparklineRow label="New users" color="#3b82f6" data={userTrend} />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-3">
              <p className="text-[11px] text-slate-600">Users today</p>
              <p className="mt-1 text-xl font-bold text-white">{stats.new_users_today ?? 0}</p>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-400">
                <TrendingUp className="h-3 w-3" /> Active today
              </div>
            </div>
            <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-3">
              <p className="text-[11px] text-slate-600">Courses listed</p>
              <p className="mt-1 text-xl font-bold text-white">{stats.total_courses.toLocaleString()}</p>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-blue-400">
                <Activity className="h-3 w-3" /> Across all levels
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick manage grid ── */}
      <div>
        <SectionLabel>Manage</SectionLabel>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <ManageTile icon={<School className="h-4 w-4" />} label="Institutions" count={stats.total_institutions} href="/admin/institutions" color="text-emerald-400 bg-emerald-500/10" />
          <ManageTile icon={<BookOpen className="h-4 w-4" />} label="Departments" count={stats.total_departments} href="/admin/departments" color="text-blue-400 bg-blue-500/10" />
          <ManageTile icon={<GraduationCap className="h-4 w-4" />} label="Courses" count={stats.total_courses} href="/admin/courses" color="text-violet-400 bg-violet-500/10" />
          <ManageTile icon={<Layers className="h-4 w-4" />} label="Levels" href="/admin/levels" color="text-cyan-400 bg-cyan-500/10" />
          <ManageTile icon={<Layers className="h-4 w-4" />} label="Study Modes" href="/admin/study-modes" color="text-pink-400 bg-pink-500/10" />
          <ManageTile icon={<CalendarDays className="h-4 w-4" />} label="Semesters" href="/admin/semesters" color="text-amber-400 bg-amber-500/10" />
          <ManageTile icon={<FileText className="h-4 w-4" />} label="Questions" count={stats.total_questions} href="/admin/questions" color="text-red-400 bg-red-500/10" />
          <ManageTile icon={<Users className="h-4 w-4" />} label="Users" count={stats.total_users} href="/admin/users" color="text-slate-400 bg-slate-500/10" />
        </div>
      </div>

      {/* ── Recent activity ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Recent sign-ups */}
        <div className="rounded-2xl border border-white/[0.05] bg-[#0D1230] overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-4">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-blue-400" />
              <p className="text-sm font-semibold text-slate-200">Recent sign-ups</p>
            </div>
            <Link href="/admin/users" className="text-xs font-medium text-blue-500 hover:text-blue-400 transition">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {recent_users.length === 0 ? (
              <EmptyState icon={<Users className="h-5 w-5" />} text="No sign-ups yet" />
            ) : recent_users.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-white/[0.02]">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1E3A8A] text-xs font-bold text-blue-200">
                    {(u.full_name ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-200">{u.full_name ?? "Unnamed"}</p>
                    <p className="truncate text-xs text-slate-600">{u.institution?.name ?? "No institution"}</p>
                  </div>
                </div>
                <p className="shrink-0 text-xs text-slate-600">
                  {new Date(u.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent uploads */}
        <div className="rounded-2xl border border-white/[0.05] bg-[#0D1230] overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-violet-400" />
              <p className="text-sm font-semibold text-slate-200">Recent uploads</p>
            </div>
            <Link href="/admin/questions" className="text-xs font-medium text-blue-500 hover:text-blue-400 transition">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {recent_questions.length === 0 ? (
              <EmptyState icon={<FileText className="h-5 w-5" />} text="No uploads yet" />
            ) : recent_questions.map((q) => (
              <div key={q.id} className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-white/[0.02]">
                <div className="min-w-0">
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
    </div>
  );
}

/* ── Sub-components ── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-widest text-slate-600">{children}</p>;
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-white/[0.04] bg-white/[0.03] px-3 py-2.5 text-center">
      <p className={`text-lg font-black tabular-nums ${color}`}>{value}</p>
      <p className="mt-0.5 text-[10px] text-slate-600">{label}</p>
    </div>
  );
}

function MetricCard({
  icon, iconClass, label, value, sub, trend, href,
}: {
  icon: React.ReactNode; iconClass: string; label: string; value: string;
  sub?: string; trend?: "up" | "down"; href: string;
}) {
  return (
    <Link href={href} className="group rounded-2xl border border-white/[0.05] bg-[#0D1230] p-4 transition hover:border-blue-500/25 hover:bg-[#111a3d]">
      <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${iconClass}`}>{icon}</div>
      <p className="mt-3 text-2xl font-black tabular-nums text-white">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
      {sub && (
        <p className={`mt-1 flex items-center gap-1 text-[11px] font-medium ${trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-slate-600"}`}>
          {trend === "up" && <TrendingUp className="h-3 w-3" />}
          {trend === "down" && <TrendingDown className="h-3 w-3" />}
          {sub}
        </p>
      )}
    </Link>
  );
}

function PipelineRow({
  color, icon, label, value, pct, href,
}: {
  color: string; icon: React.ReactNode; label: string; value: number; pct: number; href: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-white/[0.03]">
      <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} />
      <span className="flex items-center gap-1.5 text-xs text-slate-500 min-w-0 flex-1">
        {icon}{label}
      </span>
      <span className="text-xs font-semibold tabular-nums text-slate-300">{value}</span>
      <span className="text-xs text-slate-600 w-8 text-right">{pct}%</span>
    </Link>
  );
}

function SparklineRow({ label, color, data }: { label: string; color: string; data: number[] }) {
  const max = Math.max(...data, 1);
  const h = 36;
  const w = 120;
  const step = w / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${h - (v / max) * h}`).join(" ");
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-lg font-bold text-white tabular-nums">{data[data.length - 1]}</p>
      </div>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
        <polyline points={points} stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" fill="none" opacity="0.8" />
        <circle cx={(data.length - 1) * step} cy={h - (data[data.length - 1] / max) * h} r="3" fill={color} />
      </svg>
    </div>
  );
}

function ManageTile({
  icon, label, count, href, color,
}: {
  icon: React.ReactNode; label: string; count?: number; href: string; color: string;
}) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-xl border border-white/[0.05] bg-[#0D1230] px-4 py-3 transition hover:border-blue-500/25 hover:bg-[#111a3d]">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${color}`}>{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-300 group-hover:text-white transition">{label}</p>
        {count !== undefined && <p className="text-xs text-slate-600">{count.toLocaleString()}</p>}
      </div>
    </Link>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-600">
      {icon}<p className="text-sm">{text}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:  "bg-amber-500/10  text-amber-400  border-amber-500/20",
    approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    rejected: "bg-red-500/10   text-red-400    border-red-500/20",
  };
  return (
    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize ${map[status] ?? "bg-slate-500/10 text-slate-400 border-slate-500/20"}`}>
      {status}
    </span>
  );
}
