"use client";

import { useEffect, useState } from "react";
import {
  Loader2, Shield, ShieldOff, UserX, UserCheck, Search,
  ChevronDown, ChevronUp, Eye, EyeOff, Activity, CreditCard,
  Calendar, MapPin, BookOpen, Phone, AlertTriangle, RefreshCw,
  Users, GraduationCap, X, Sparkles,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import ConfirmDialog from "../components/ConfirmDialog";

interface Course { id: string; name: string; }

interface UserRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  is_admin: boolean;
  admin_role: string | null;
  suspended: boolean;
  created_at: string;
  institution: { name: string } | null;
  department: { name: string } | null;
  courses: Course[];
  level: { name: string } | null;
  study_mode: { name: string } | null;
  subscription_plan: string | null;
  subscription_expires_at: string | null;
  total_uploads: number;
  total_views: number;
  last_active_at: string | null;
}

type PendingAction =
  | { type: "suspend"; user: UserRow }
  | { type: "admin"; user: UserRow; role: string }
  | { type: "delete"; user: UserRow }
  | null;

const ADMIN_ROLES = [
  { value: "moderator", label: "Moderator", desc: "Can approve/reject uploads" },
  { value: "content_manager", label: "Content Manager", desc: "Can manage courses & institutions" },
  { value: "super_admin", label: "Super Admin", desc: "Full admin access" },
];

const SUBSCRIPTION_PLANS = [
  { value: "basic", label: "Basic", desc: "₦500/month · 10 downloads/day" },
  { value: "pro", label: "Pro", desc: "₦1,000/month · 50 downloads/day" },
  { value: "premium", label: "Premium", desc: "₦2,000/month · Unlimited downloads" },
];

const MASK = "••••••••";

function mask(value: string | null | undefined, revealed: boolean): string {
  if (!value) return "—";
  return revealed ? value : MASK;
}

export default function AdminUsersPage() {
  const supabase = createClient();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "admin" | "suspended" | "active">("all");
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [rolePickerId, setRolePickerId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("moderator");

  // ── Grant subscription state ──
  const [grantPickerId, setGrantPickerId] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string>("pro");
  const [grantNote, setGrantNote] = useState<string>("");
  const [grantingId, setGrantingId] = useState<string | null>(null);
  const [grantSuccess, setGrantSuccess] = useState<string | null>(null);

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const isExpiringSoon = (session.expires_at ?? 0) * 1000 - Date.now() < 60_000;
    if (isExpiringSoon) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      return refreshed.session?.access_token ?? null;
    }
    return session.access_token;
  }

  async function loadUsers() {
    setLoading(true);
    setError("");
    const token = await getToken();
    if (!token) { setError("Session expired. Please log in again."); setLoading(false); return; }
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load users.");
      const json = await res.json();
      const normalized: UserRow[] = (Array.isArray(json) ? json : []).map((u) => ({
        ...u,
        courses: Array.isArray(u.courses) ? u.courses : [],
      }));
      setUsers(normalized);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadUsers(); }, []);

  function toggleReveal(id: string) {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (expandedId === id) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  async function confirmSuspend(user: UserRow) {
    setActioningId(user.id);
    setError("");
    const token = await getToken();
    if (!token) { setError("Session expired."); setActioningId(null); setPendingAction(null); return; }
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/users/${user.id}/suspend`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ suspended: !user.suspended }),
      });
      if (!res.ok) throw new Error("Failed to update suspension.");
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, suspended: !u.suspended } : u));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setActioningId(null);
      setPendingAction(null);
    }
  }

  async function confirmAdminToggle(user: UserRow, role: string) {
    setActioningId(user.id);
    setError("");
    const token = await getToken();
    if (!token) { setError("Session expired."); setActioningId(null); setPendingAction(null); return; }
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/users/${user.id}/admin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_admin: !user.is_admin, admin_role: !user.is_admin ? role : null }),
      });
      if (!res.ok) { const body = await res.json().catch(() => null); throw new Error(body?.detail ?? "Failed."); }
      setUsers((prev) => prev.map((u) =>
        u.id === user.id ? { ...u, is_admin: !u.is_admin, admin_role: !u.is_admin ? role : null } : u
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setActioningId(null);
      setPendingAction(null);
      setRolePickerId(null);
    }
  }

  async function confirmDelete(user: UserRow) {
    setActioningId(user.id);
    setError("");
    const token = await getToken();
    if (!token) { setError("Session expired."); setActioningId(null); setPendingAction(null); return; }
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/users/${user.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete user.");
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      if (expandedId === user.id) setExpandedId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setActioningId(null);
      setPendingAction(null);
    }
  }

  async function grantSubscription(user: UserRow) {
    setGrantingId(user.id);
    setGrantSuccess(null);
    setError("");
    const token = await getToken();
    if (!token) { setError("Session expired."); setGrantingId(null); return; }
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/payments/admin/grant`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          user_id: user.id,
          plan: selectedPlan,
          note: grantNote || "Manual grant by admin",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail ?? "Failed to grant subscription.");
      }
      const result = await res.json();
      // Update user in list
      setUsers((prev) => prev.map((u) =>
        u.id === user.id
          ? { ...u, subscription_plan: selectedPlan, subscription_expires_at: result.expires_at }
          : u
      ));
      setGrantSuccess(`${SUBSCRIPTION_PLANS.find(p => p.value === selectedPlan)?.label} plan granted successfully!`);
      setGrantPickerId(null);
      setGrantNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setGrantingId(null);
    }
  }

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch =
      u.full_name?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.institution?.name?.toLowerCase().includes(q) ||
      u.courses.some((c) => c.name.toLowerCase().includes(q));
    const matchFilter =
      filter === "all" ||
      (filter === "admin" && u.is_admin) ||
      (filter === "suspended" && u.suspended) ||
      (filter === "active" && !u.suspended && !u.is_admin);
    return matchSearch && matchFilter;
  });

  const counts = {
    all: users.length,
    admin: users.filter((u) => u.is_admin).length,
    suspended: users.filter((u) => u.suspended).length,
    active: users.filter((u) => !u.suspended && !u.is_admin).length,
  };

  return (
    <div className="space-y-6 pb-10">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-400" />
            <h1 className="text-xl font-bold text-white">Users</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Manage accounts, roles, and access. Tap a user to view details.
          </p>
        </div>
        <button
          onClick={loadUsers}
          className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-[#0D1230] px-4 py-2 text-xs font-medium text-slate-400 transition hover:border-blue-500/30 hover:text-blue-400"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Grant success banner */}
      {grantSuccess && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-5 py-4">
          <div className="flex items-center gap-3">
            <Sparkles className="h-4 w-4 shrink-0 text-emerald-400" />
            <p className="text-sm font-semibold text-emerald-300">{grantSuccess}</p>
          </div>
          <button onClick={() => setGrantSuccess(null)}>
            <X className="h-4 w-4 text-emerald-500" />
          </button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {(["all", "active", "admin", "suspended"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold capitalize transition
              ${filter === f
                ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                : "border border-white/[0.05] bg-[#0D1230] text-slate-500 hover:text-slate-300"
              }`}
          >
            {f}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${filter === f ? "bg-blue-500/20 text-blue-300" : "bg-white/[0.05] text-slate-600"}`}>
              {counts[f]}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#0D1230] px-4 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-slate-600" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone, email, institution…"
          className="w-full bg-transparent text-sm text-slate-200 placeholder:text-slate-600 outline-none"
        />
        {search && (
          <button onClick={() => setSearch("")}>
            <X className="h-4 w-4 text-slate-600 hover:text-slate-400 transition" />
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* User list */}
      <div className="rounded-2xl border border-white/[0.05] bg-[#0D1230] overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            <p className="text-sm text-slate-600">Loading users…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-slate-600">
            <Users className="h-6 w-6" />
            <p className="text-sm">No users found.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {filtered.map((user) => {
              const isExpanded = expandedId === user.id;
              const isRevealed = revealedIds.has(user.id);
              const isActioning = actioningId === user.id;
              const isGranting = grantingId === user.id;
              const roleLabel = ADMIN_ROLES.find((r) => r.value === user.admin_role)?.label ?? user.admin_role;

              return (
                <div key={user.id} className="transition-colors hover:bg-white/[0.01]">

                  {/* Row summary */}
                  <div
                    className="flex cursor-pointer items-center gap-4 px-5 py-4"
                    onClick={() => toggleExpand(user.id)}
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold
                      ${user.suspended ? "bg-red-500/15 text-red-400" : user.is_admin ? "bg-blue-500/20 text-blue-300" : "bg-[#1E3A8A] text-blue-200"}`}>
                      {(user.full_name ?? "?").charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-200">
                          {user.full_name ?? "Unnamed User"}
                        </p>
                        {user.is_admin && (
                          <span className="rounded-full border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                            {roleLabel ?? "Admin"}
                          </span>
                        )}
                        {user.suspended && (
                          <span className="rounded-full border border-red-500/25 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-400">
                            Suspended
                          </span>
                        )}
                        {user.subscription_plan && user.subscription_plan !== "free" && (
                          <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 capitalize">
                            {user.subscription_plan}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {isRevealed ? (user.institution?.name ?? "No institution") : MASK}
                        {" · "}
                        {isRevealed ? (user.phone ?? "No phone") : MASK}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <p className="hidden text-xs text-slate-600 sm:block">
                        {new Date(user.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}
                      </p>
                      {isExpanded
                        ? <ChevronUp className="h-4 w-4 text-slate-500" />
                        : <ChevronDown className="h-4 w-4 text-slate-500" />
                      }
                    </div>
                  </div>

                  {/* Expanded detail panel */}
                  {isExpanded && (
                    <div className="border-t border-white/[0.04] bg-[#07091A] px-5 py-5 space-y-5">

                      {/* Reveal toggle */}
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-600">
                          Student profile
                        </p>
                        <button
                          onClick={() => toggleReveal(user.id)}
                          className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:border-blue-500/30 hover:text-blue-400"
                        >
                          {isRevealed
                            ? <><EyeOff className="h-3.5 w-3.5" /> Hide info</>
                            : <><Eye className="h-3.5 w-3.5" /> Reveal info</>
                          }
                        </button>
                      </div>

                      {/* Info grid */}
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <InfoCell icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={mask(user.phone, isRevealed)} />
                        <InfoCell icon={<MapPin className="h-3.5 w-3.5" />} label="Institution" value={mask(user.institution?.name, isRevealed)} />
                        <InfoCell icon={<BookOpen className="h-3.5 w-3.5" />} label="Department" value={mask(user.department?.name, isRevealed)} />
                        <InfoCell icon={<GraduationCap className="h-3.5 w-3.5" />} label="Level" value={isRevealed ? (user.level?.name ?? "—") : MASK} />
                        <InfoCell icon={<Calendar className="h-3.5 w-3.5" />} label="Joined" value={new Date(user.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} />
                        <InfoCell icon={<Activity className="h-3.5 w-3.5" />} label="Last active" value={user.last_active_at ? new Date(user.last_active_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"} />
                      </div>

                      {/* Courses */}
                      <div>
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">Enrolled courses</p>
                        <div className="flex flex-wrap gap-1.5">
                          {user.courses.length === 0
                            ? <span className="text-xs text-slate-600">No courses enrolled</span>
                            : user.courses.map((c) => (
                              <span key={c.id} className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-xs text-slate-400">
                                {isRevealed ? c.name : MASK}
                              </span>
                            ))
                          }
                        </div>
                      </div>

                      {/* Activity stats */}
                      <div className="grid grid-cols-3 gap-2">
                        <StatCell label="Uploads" value={user.total_uploads ?? 0} color="text-violet-400" />
                        <StatCell label="Views generated" value={user.total_views ?? 0} color="text-cyan-400" />
                        <StatCell
                          label="Subscription"
                          value={isRevealed ? (user.subscription_plan ?? "Free") : MASK}
                          color={user.subscription_plan && user.subscription_plan !== "free" ? "text-emerald-400" : "text-slate-500"}
                          small
                        />
                      </div>

                      {/* Subscription expiry */}
                      {isRevealed && user.subscription_expires_at && (
                        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-4 py-3">
                          <CreditCard className="h-4 w-4 shrink-0 text-emerald-400" />
                          <p className="text-xs text-emerald-300">
                            Subscription active · expires{" "}
                            <span className="font-semibold">
                              {new Date(user.subscription_expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                            </span>
                          </p>
                        </div>
                      )}

                      {/* ── Grant subscription picker ── */}
                      {grantPickerId === user.id ? (
                        <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.04] p-4 space-y-3">
                          <p className="text-xs font-semibold text-slate-400">Grant subscription plan</p>

                          {/* Plan selector */}
                          <div className="space-y-1.5">
                            {SUBSCRIPTION_PLANS.map((p) => (
                              <label key={p.value} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition
                                ${selectedPlan === p.value ? "border-indigo-500/40 bg-indigo-500/10" : "border-white/[0.05] bg-white/[0.02] hover:border-white/10"}`}>
                                <input
                                  type="radio"
                                  name={`plan-${user.id}`}
                                  value={p.value}
                                  checked={selectedPlan === p.value}
                                  onChange={() => setSelectedPlan(p.value)}
                                  className="mt-0.5 accent-indigo-500"
                                />
                                <div>
                                  <p className="text-xs font-semibold text-slate-200">{p.label}</p>
                                  <p className="text-[11px] text-slate-600">{p.desc}</p>
                                </div>
                              </label>
                            ))}
                          </div>

                          {/* Note */}
                          <input
                            value={grantNote}
                            onChange={(e) => setGrantNote(e.target.value)}
                            placeholder="Note (optional) e.g. Payvessel was down"
                            className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-slate-300 placeholder:text-slate-600 outline-none focus:border-indigo-500/40"
                          />

                          {/* Actions */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => grantSubscription(user)}
                              disabled={isGranting}
                              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
                            >
                              {isGranting
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Sparkles className="h-3.5 w-3.5" />
                              }
                              {isGranting ? "Granting…" : "Grant access"}
                            </button>
                            <button
                              onClick={() => { setGrantPickerId(null); setGrantNote(""); }}
                              className="rounded-xl border border-white/[0.06] px-4 py-2 text-xs font-medium text-slate-500 transition hover:text-slate-300"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-2 pt-1">

                        {/* Grant subscription button */}
                        {grantPickerId !== user.id && (
                          <button
                            onClick={() => { setGrantPickerId(user.id); setSelectedPlan("pro"); setGrantNote(""); }}
                            disabled={isActioning || isGranting}
                            className="flex items-center gap-2 rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-2.5 text-xs font-semibold text-indigo-400 transition hover:bg-indigo-500/20 disabled:opacity-50"
                          >
                            <Sparkles className="h-3.5 w-3.5" /> Grant subscription
                          </button>
                        )}

                        {/* Admin role picker or remove admin */}
                        {user.is_admin ? (
                          <button
                            onClick={() => setPendingAction({ type: "admin", user, role: user.admin_role ?? "moderator" })}
                            disabled={isActioning}
                            className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2.5 text-xs font-semibold text-blue-400 transition hover:bg-blue-500/20 disabled:opacity-50"
                          >
                            <ShieldOff className="h-3.5 w-3.5" /> Remove admin
                          </button>
                        ) : rolePickerId === user.id ? (
                          <div className="flex flex-col gap-2 rounded-2xl border border-blue-500/20 bg-[#0D1230] p-4 w-full">
                            <p className="text-xs font-semibold text-slate-400 mb-1">Select admin role</p>
                            <div className="space-y-1.5">
                              {ADMIN_ROLES.map((r) => (
                                <label key={r.value} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition
                                  ${selectedRole === r.value ? "border-blue-500/40 bg-blue-500/10" : "border-white/[0.05] bg-white/[0.02] hover:border-white/10"}`}>
                                  <input
                                    type="radio"
                                    name={`role-${user.id}`}
                                    value={r.value}
                                    checked={selectedRole === r.value}
                                    onChange={() => setSelectedRole(r.value)}
                                    className="mt-0.5 accent-blue-500"
                                  />
                                  <div>
                                    <p className="text-xs font-semibold text-slate-200">{r.label}</p>
                                    <p className="text-[11px] text-slate-600">{r.desc}</p>
                                  </div>
                                </label>
                              ))}
                            </div>
                            <div className="flex gap-2 mt-1">
                              <button
                                onClick={() => setPendingAction({ type: "admin", user, role: selectedRole })}
                                className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-500"
                              >
                                <Shield className="h-3.5 w-3.5" /> Confirm role
                              </button>
                              <button
                                onClick={() => setRolePickerId(null)}
                                className="rounded-xl border border-white/[0.06] px-4 py-2 text-xs font-medium text-slate-500 transition hover:text-slate-300"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setRolePickerId(user.id); setSelectedRole("moderator"); }}
                            disabled={isActioning}
                            className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-xs font-semibold text-slate-400 transition hover:border-blue-500/30 hover:text-blue-400 disabled:opacity-50"
                          >
                            <Shield className="h-3.5 w-3.5" /> Make admin
                          </button>
                        )}

                        {/* Suspend */}
                        <button
                          onClick={() => setPendingAction({ type: "suspend", user })}
                          disabled={isActioning}
                          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition disabled:opacity-50
                            ${user.suspended
                              ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                              : "border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                            }`}
                        >
                          {user.suspended
                            ? <><UserCheck className="h-3.5 w-3.5" /> Unsuspend</>
                            : <><UserX className="h-3.5 w-3.5" /> Suspend</>
                          }
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => setPendingAction({ type: "delete", user })}
                          disabled={isActioning}
                          className="flex items-center gap-2 rounded-xl border border-red-500/10 bg-red-500/5 px-4 py-2.5 text-xs font-semibold text-red-500/70 transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                        >
                          {isActioning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                          Delete account
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={pendingAction?.type === "suspend"}
        title={pendingAction?.type === "suspend" && pendingAction.user.suspended ? "Unsuspend this user?" : "Suspend this user?"}
        description={
          pendingAction?.type === "suspend"
            ? pendingAction.user.suspended
              ? `${pendingAction.user.full_name ?? "This user"} will regain access immediately.`
              : `${pendingAction.user.full_name ?? "This user"} will lose access immediately. You can undo this later.`
            : ""
        }
        confirmLabel={pendingAction?.type === "suspend" && pendingAction.user.suspended ? "Unsuspend" : "Suspend"}
        tone={pendingAction?.type === "suspend" && pendingAction.user.suspended ? "default" : "danger"}
        loading={actioningId === (pendingAction?.user.id ?? "")}
        onConfirm={() => pendingAction?.type === "suspend" && confirmSuspend(pendingAction.user)}
        onCancel={() => setPendingAction(null)}
      />

      <ConfirmDialog
        open={pendingAction?.type === "admin"}
        title={pendingAction?.type === "admin" && pendingAction.user.is_admin ? "Remove admin access?" : `Make admin as ${ADMIN_ROLES.find((r) => r.value === (pendingAction?.type === "admin" ? pendingAction.role : ""))?.label ?? ""}?`}
        description={
          pendingAction?.type === "admin"
            ? pendingAction.user.is_admin
              ? `${pendingAction.user.full_name ?? "This user"} will lose admin access immediately.`
              : `${pendingAction.user.full_name ?? "This user"} will be granted ${ADMIN_ROLES.find((r) => r.value === pendingAction.role)?.label} access.`
            : ""
        }
        confirmLabel={pendingAction?.type === "admin" && pendingAction.user.is_admin ? "Remove Admin" : "Confirm"}
        tone={pendingAction?.type === "admin" && pendingAction.user.is_admin ? "danger" : "default"}
        loading={actioningId === (pendingAction?.user.id ?? "")}
        onConfirm={() => pendingAction?.type === "admin" && confirmAdminToggle(pendingAction.user, pendingAction.role)}
        onCancel={() => { setPendingAction(null); setRolePickerId(null); }}
      />

      <ConfirmDialog
        open={pendingAction?.type === "delete"}
        title="Delete this account?"
        description={`This permanently deletes ${pendingAction?.type === "delete" ? (pendingAction.user.full_name ?? "this user") : ""}'s account and all their data. This cannot be undone.`}
        confirmLabel="Delete permanently"
        tone="danger"
        loading={actioningId === (pendingAction?.type === "delete" ? pendingAction.user.id : "")}
        onConfirm={() => pendingAction?.type === "delete" && confirmDelete(pendingAction.user)}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}

function InfoCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-slate-600 mb-1">
        {icon}
        <p className="text-[10px] font-semibold uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-xs font-medium text-slate-300 truncate">{value}</p>
    </div>
  );
}

function StatCell({ label, value, color, small }: { label: string; value: number | string; color: string; small?: boolean }) {
  return (
    <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] px-3 py-2.5 text-center">
      <p className={`font-black tabular-nums ${small ? "text-sm" : "text-xl"} ${color}`}>{typeof value === "number" ? value.toLocaleString() : value}</p>
      <p className="mt-0.5 text-[10px] text-slate-600">{label}</p>
    </div>
  );
}