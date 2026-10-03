"use client";

import { useEffect, useState, type ReactNode } from "react";
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
  avatar_url: string | null;
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
  | { type: "revoke"; user: UserRow }
  | null;

const ADMIN_ROLES = [
  { value: "moderator",        label: "Moderator",        desc: "Can approve/reject uploads"          },
  { value: "content_manager",  label: "Content Manager",  desc: "Can manage courses & institutions"   },
  { value: "super_admin",      label: "Super Admin",      desc: "Full admin access"                   },
];

const SUBSCRIPTION_PLANS = [
  { value: "basic",   label: "Basic",   desc: "₦2,000/sem · Limited AI chats, 3 uploads/day"  },
  { value: "pro",     label: "Pro",     desc: "₦3,500/sem · Unlimited uploads & chats"         },
  { value: "premium", label: "Premium", desc: "₦5,000/sem · Everything incl. YouTube/link study" },
];

const MASK = "••••••••";

const panel         = "border border-[var(--sp-border)] bg-[var(--sp-bg-card)]";
const mutedPanel    = "border border-[var(--sp-border)] bg-[var(--sp-bg-muted)]";
const secondaryText = "text-[var(--sp-text-2)]";
const neutralButton =
  "rounded-xl border border-[var(--sp-border)] bg-[var(--sp-bg-muted)] text-[var(--sp-text-2)] " +
  "transition hover:border-[var(--sp-border-hover)] hover:text-[var(--sp-text)] disabled:opacity-50";

const blueText   = "text-blue-700 dark:text-blue-400";
const greenText  = "text-emerald-700 dark:text-emerald-400";
const redText    = "text-red-700 dark:text-red-400";
const amberText  = "text-amber-800 dark:text-amber-400";
const indigoText = "text-indigo-700 dark:text-indigo-400";

function mask(value: string | null | undefined, revealed: boolean): string {
  if (!value) return "—";
  return revealed ? value : MASK;
}

/** Roles this admin is allowed to assign (can't assign above themselves). */
function assignableRoles(myRole: string | null): typeof ADMIN_ROLES {
  if (myRole === "super_admin") return ADMIN_ROLES;
  // moderator / content_manager can only assign moderator
  return ADMIN_ROLES.filter((r) => r.value === "moderator");
}

/** Avatar circle shared between the row summary and the expanded header. */
function UserAvatar({
  user,
  size = "md",
}: {
  user: UserRow;
  size?: "sm" | "md";
}) {
  const dim   = size === "sm" ? "h-9 w-9 text-sm" : "h-11 w-11 text-base";
  const letter = (user.full_name ?? "?").charAt(0).toUpperCase();

  const bg = user.suspended
    ? "bg-red-500/15"
    : user.is_admin
      ? "bg-blue-500/20"
      : "bg-blue-500/10";

  const color = user.suspended
    ? redText
    : blueText;

  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={user.full_name ?? "User avatar"}
        className={`${dim} shrink-0 rounded-full object-cover ring-2 ${
          user.suspended ? "ring-red-500/30" : "ring-indigo-500/20"
        }`}
      />
    );
  }

  return (
    <span
      className={`${dim} flex shrink-0 items-center justify-center rounded-full font-bold ${bg} ${color}`}
    >
      {letter}
    </span>
  );
}

export default function AdminUsersPage() {
  const [supabase] = useState(() => createClient());

  // The current admin's own role — fetched once on mount.
  const [myRole, setMyRole] = useState<string | null>(null);

  const [users,    setUsers]    = useState<UserRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState<"all" | "admin" | "suspended" | "active">("all");

  const [actioningId,  setActioningId]  = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [revealedIds,  setRevealedIds]  = useState<Set<string>>(new Set());
  const [rolePickerId, setRolePickerId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState("moderator");

  const [grantPickerId, setGrantPickerId] = useState<string | null>(null);
  const [selectedPlan,  setSelectedPlan]  = useState("pro");
  const [grantNote,     setGrantNote]     = useState("");
  const [grantingId,    setGrantingId]    = useState<string | null>(null);
  const [grantSuccess,  setGrantSuccess]  = useState<string | null>(null);

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

  async function requireToken() {
    const token = await getToken();
    if (!token) throw new Error("Session expired. Please log in again.");
    return token;
  }

  // Fetch the current admin's own role from Supabase profiles.
  useEffect(() => {
    async function fetchMyRole() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("profiles")
        .select("admin_role")
        .eq("id", session.user.id)
        .single();
      setMyRole(data?.admin_role ?? null);
    }
    void fetchMyRole();
  }, [supabase]);

  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      const token = await requireToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/users`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error("Failed to load users.");
      const json = await res.json();
      const normalized: UserRow[] = (Array.isArray(json) ? json : []).map((u) => ({
        ...u,
        avatar_url: u.avatar_url ?? null,
        courses: Array.isArray(u.courses) ? u.courses : [],
      }));
      setUsers(normalized);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadUsers(); }, []);

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
      expandedId === id ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function confirmSuspend(user: UserRow) {
    setActioningId(user.id);
    setError("");
    try {
      const token = await requireToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/users/${user.id}/suspend`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ suspended: !user.suspended }),
        },
      );
      if (!res.ok) throw new Error("Failed to update suspension.");
      setUsers((prev) =>
        prev.map((u) => u.id === user.id ? { ...u, suspended: !u.suspended } : u),
      );
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
    try {
      const token = await requireToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/users/${user.id}/admin`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ is_admin: !user.is_admin, admin_role: !user.is_admin ? role : null }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(typeof body?.detail === "string" ? body.detail : "Failed to update admin access.");
      }
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? { ...u, is_admin: !u.is_admin, admin_role: !u.is_admin ? role : null }
            : u,
        ),
      );
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
    try {
      const token = await requireToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/users/${user.id}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
      );
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
    try {
      const token = await requireToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/payments/admin/grant`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ user_id: user.id, plan: selectedPlan, note: grantNote || "Manual grant by admin" }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(typeof body?.detail === "string" ? body.detail : "Failed to grant subscription.");
      }
      const result = await res.json();
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? { ...u, subscription_plan: selectedPlan, subscription_expires_at: result.expires_at }
            : u,
        ),
      );
      const planLabel = SUBSCRIPTION_PLANS.find((p) => p.value === selectedPlan)?.label;
      setGrantSuccess(`${planLabel} plan granted successfully!`);
      setGrantPickerId(null);
      setGrantNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setGrantingId(null);
    }
  }

  async function confirmRevoke(user: UserRow) {
    setActioningId(user.id);
    setGrantSuccess(null);
    setError("");
    try {
      const token = await requireToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/payments/admin/revoke`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ user_id: user.id, note: "Subscription revoked by admin" }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(typeof body?.detail === "string" ? body.detail : "Failed to remove subscription.");
      }
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, subscription_plan: "free", subscription_expires_at: null } : u,
        ),
      );
      setGrantSuccess("Subscription removed. User is back on the free plan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setActioningId(null);
      setPendingAction(null);
    }
  }

  const filtered = users.filter((u) => {
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      u.full_name?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.institution?.name?.toLowerCase().includes(q) ||
      u.courses.some((c) => c.name.toLowerCase().includes(q));
    const matchFilter =
      filter === "all" ||
      (filter === "admin"     && u.is_admin) ||
      (filter === "suspended" && u.suspended) ||
      (filter === "active"    && !u.suspended && !u.is_admin);
    return matchSearch && matchFilter;
  });

  const counts = {
    all:       users.length,
    admin:     users.filter((u) => u.is_admin).length,
    suspended: users.filter((u) => u.suspended).length,
    active:    users.filter((u) => !u.suspended && !u.is_admin).length,
  };

  const isSuperAdmin      = myRole === "super_admin";
  const canGrantAdmin     = myRole !== null; // any admin can make moderators
  const canGrantPaidPlan  = isSuperAdmin;    // only super_admin can grant/revoke subscriptions
  const canDelete         = isSuperAdmin;    // only super_admin can delete accounts
  const canSuspend        = myRole !== null; // any admin can suspend
  const roles             = assignableRoles(myRole);

  return (
    <div className="space-y-6 pb-10 text-[var(--sp-text)]">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className={`h-5 w-5 ${blueText}`} />
            <h1 className="text-xl font-bold">Users</h1>
          </div>
          <p className={`mt-1 text-sm ${secondaryText}`}>
            Manage accounts, roles, and access. Tap a user to view details.
          </p>
        </div>
        <button
          type="button"
          onClick={loadUsers}
          disabled={loading}
          className={`flex shrink-0 items-center gap-2 px-4 py-2 text-xs font-medium ${neutralButton}`}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Success banner */}
      {grantSuccess && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-5 py-4"
        >
          <div className="flex items-center gap-3">
            <Sparkles className={`h-4 w-4 shrink-0 ${greenText}`} />
            <p className={`text-sm font-semibold ${greenText}`}>{grantSuccess}</p>
          </div>
          <button
            type="button"
            onClick={() => setGrantSuccess(null)}
            aria-label="Dismiss"
            className={`rounded-lg p-1 ${greenText}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {(["all", "active", "admin", "suspended"] as const).map((f) => (
          <button
            type="button"
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`flex items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-semibold capitalize transition ${
              filter === f
                ? `border-blue-500/30 bg-blue-500/15 ${blueText}`
                : `${panel} ${secondaryText} hover:border-[var(--sp-border-hover)] hover:text-[var(--sp-text)]`
            }`}
          >
            {f}
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                filter === f ? `bg-blue-500/20 ${blueText}` : `bg-[var(--sp-bg-muted)] ${secondaryText}`
              }`}
            >
              {counts[f]}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div
        className={`flex items-center gap-3 rounded-xl px-4 py-2.5 focus-within:border-[var(--sp-border-hover)] ${panel}`}
      >
        <Search className={`h-4 w-4 shrink-0 ${secondaryText}`} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone, email, institution…"
          aria-label="Search users"
          className="min-w-0 w-full bg-transparent text-sm text-[var(--sp-text)] outline-none placeholder:text-[var(--sp-text-3)]"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label="Clear search"
            className="text-[var(--sp-text-2)] transition hover:text-[var(--sp-text)]"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className={`flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm ${redText}`}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* User list */}
      <div className={`overflow-hidden rounded-2xl ${panel}`}>
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            <p className={`text-sm ${secondaryText}`}>Loading users…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className={`flex flex-col items-center justify-center gap-2 py-20 ${secondaryText}`}>
            <Users className="h-6 w-6" />
            <p className="text-sm">No users found.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--sp-border)]">
            {filtered.map((user) => {
              const isExpanded  = expandedId === user.id;
              const isRevealed  = revealedIds.has(user.id);
              const isActioning = actioningId === user.id;
              const isGranting  = grantingId === user.id;
              const hasPaidPlan = !!user.subscription_plan && user.subscription_plan !== "free";
              const roleLabel   = ADMIN_ROLES.find((r) => r.value === user.admin_role)?.label ?? user.admin_role;

              return (
                <div key={user.id}>
                  {/* Row summary */}
                  <button
                    type="button"
                    className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-[var(--sp-bg-muted)]"
                    onClick={() => toggleExpand(user.id)}
                    aria-expanded={isExpanded}
                  >
                    <UserAvatar user={user} size="sm" />

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--sp-text)]">
                          {user.full_name ?? "Unnamed User"}
                        </span>
                        {user.is_admin && (
                          <span className={`rounded-full border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold ${blueText}`}>
                            {roleLabel ?? "Admin"}
                          </span>
                        )}
                        {user.suspended && (
                          <span className={`rounded-full border border-red-500/25 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold ${redText}`}>
                            Suspended
                          </span>
                        )}
                        {hasPaidPlan && (
                          <span className={`rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold capitalize ${greenText}`}>
                            {user.subscription_plan}
                          </span>
                        )}
                      </span>
                      <span className={`mt-0.5 block text-xs ${secondaryText}`}>
                        {isRevealed ? (user.institution?.name ?? "No institution") : MASK}
                        {" · "}
                        {isRevealed ? (user.phone ?? "No phone") : MASK}
                      </span>
                    </span>

                    <span className="flex shrink-0 items-center gap-3">
                      <span className={`hidden text-xs sm:block ${secondaryText}`}>
                        {new Date(user.created_at).toLocaleDateString("en-GB", {
                          day: "numeric", month: "short", year: "2-digit",
                        })}
                      </span>
                      {isExpanded
                        ? <ChevronUp className={`h-4 w-4 ${secondaryText}`} />
                        : <ChevronDown className={`h-4 w-4 ${secondaryText}`} />}
                    </span>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="space-y-5 border-t border-[var(--sp-border)] bg-[var(--sp-bg)] px-5 py-5">
                      {/* Profile header with avatar */}
                      <div className="flex items-center gap-4">
                        <UserAvatar user={user} size="md" />
                        <div className="min-w-0">
                          <p className="font-bold text-[var(--sp-text)] truncate">
                            {user.full_name ?? "Unnamed User"}
                          </p>
                          {user.email && (
                            <p className={`text-xs truncate ${secondaryText}`}>{user.email}</p>
                          )}
                          {user.is_admin && (
                            <span className={`mt-1 inline-block rounded-full border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold ${blueText}`}>
                              {roleLabel ?? "Admin"}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleReveal(user.id)}
                          className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium ${neutralButton}`}
                        >
                          {isRevealed
                            ? <><EyeOff className="h-3.5 w-3.5" />Hide info</>
                            : <><Eye    className="h-3.5 w-3.5" />Reveal info</>}
                        </button>
                      </div>

                      {/* Info grid */}
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <InfoCell icon={<Phone       className="h-3.5 w-3.5" />} label="Phone"       value={mask(user.phone, isRevealed)} />
                        <InfoCell icon={<MapPin      className="h-3.5 w-3.5" />} label="Institution" value={mask(user.institution?.name, isRevealed)} />
                        <InfoCell icon={<BookOpen    className="h-3.5 w-3.5" />} label="Department"  value={mask(user.department?.name, isRevealed)} />
                        <InfoCell icon={<GraduationCap className="h-3.5 w-3.5" />} label="Level"    value={isRevealed ? (user.level?.name ?? "—") : MASK} />
                        <InfoCell icon={<Calendar    className="h-3.5 w-3.5" />} label="Joined"      value={new Date(user.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} />
                        <InfoCell icon={<Activity    className="h-3.5 w-3.5" />} label="Last active" value={user.last_active_at ? new Date(user.last_active_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"} />
                      </div>

                      {/* Courses */}
                      <div>
                        <p className={`mb-2 text-[10px] font-semibold uppercase tracking-widest ${secondaryText}`}>
                          Enrolled courses
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {user.courses.length === 0 ? (
                            <span className={`text-xs ${secondaryText}`}>No courses enrolled</span>
                          ) : (
                            user.courses.map((c) => (
                              <span key={c.id} className={`rounded-lg px-2.5 py-1 text-xs ${mutedPanel} ${secondaryText}`}>
                                {isRevealed ? c.name : MASK}
                              </span>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-2">
                        <StatCell label="Uploads"         value={user.total_uploads ?? 0}          color="text-violet-700 dark:text-violet-400" />
                        <StatCell label="Views generated" value={user.total_views ?? 0}            color="text-cyan-700 dark:text-cyan-400" />
                        <StatCell label="Subscription"    value={isRevealed ? (user.subscription_plan ?? "Free") : MASK} color={hasPaidPlan ? greenText : secondaryText} small />
                      </div>

                      {/* Subscription expiry */}
                      {isRevealed && hasPaidPlan && user.subscription_expires_at && (
                        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-4 py-3">
                          <CreditCard className={`h-4 w-4 shrink-0 ${greenText}`} />
                          <p className={`text-xs ${greenText}`}>
                            Subscription active · expires{" "}
                            <span className="font-semibold">
                              {new Date(user.subscription_expires_at).toLocaleDateString("en-GB", {
                                day: "numeric", month: "long", year: "numeric",
                              })}
                            </span>
                          </p>
                        </div>
                      )}

                      {/* Grant subscription picker (super_admin only) */}
                      {canGrantPaidPlan && grantPickerId === user.id && (
                        <div className="space-y-3 rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.04] p-4">
                          <p className={`text-xs font-semibold ${secondaryText}`}>Grant subscription plan</p>
                          <div className="space-y-1.5">
                            {SUBSCRIPTION_PLANS.map((p) => (
                              <label
                                key={p.value}
                                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition ${
                                  selectedPlan === p.value
                                    ? "border-indigo-500/40 bg-indigo-500/10"
                                    : "border-[var(--sp-border)] bg-[var(--sp-bg-card)] hover:border-[var(--sp-border-hover)]"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`plan-${user.id}`}
                                  value={p.value}
                                  checked={selectedPlan === p.value}
                                  disabled={isGranting}
                                  onChange={() => setSelectedPlan(p.value)}
                                  className="mt-0.5 accent-indigo-500"
                                />
                                <div>
                                  <p className="text-xs font-semibold text-[var(--sp-text)]">{p.label}</p>
                                  <p className={`text-[11px] ${secondaryText}`}>{p.desc}</p>
                                </div>
                              </label>
                            ))}
                          </div>
                          <input
                            value={grantNote}
                            onChange={(e) => setGrantNote(e.target.value)}
                            disabled={isGranting}
                            placeholder="Note (optional) e.g. Payvessel was down"
                            aria-label="Subscription grant note"
                            className="w-full rounded-xl border border-[var(--sp-border)] bg-[var(--sp-input-bg)] px-3 py-2 text-xs text-[var(--sp-text)] outline-none placeholder:text-[var(--sp-text-3)] focus:border-indigo-500/40"
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => grantSubscription(user)}
                              disabled={isGranting}
                              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
                            >
                              {isGranting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                              {isGranting ? "Granting…" : "Grant access"}
                            </button>
                            <button
                              type="button"
                              disabled={isGranting}
                              onClick={() => { setGrantPickerId(null); setGrantNote(""); }}
                              className={`px-4 py-2 text-xs font-medium ${neutralButton}`}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {/* Grant subscription — super_admin only */}
                        {canGrantPaidPlan && grantPickerId !== user.id && (
                          <button
                            type="button"
                            onClick={() => { setGrantPickerId(user.id); setSelectedPlan("pro"); setGrantNote(""); }}
                            disabled={isActioning || isGranting}
                            className={`flex items-center gap-2 rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-2.5 text-xs font-semibold transition hover:bg-indigo-500/20 disabled:opacity-50 ${indigoText}`}
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            Grant subscription
                          </button>
                        )}

                        {/* Remove subscription — super_admin only */}
                        {canGrantPaidPlan && hasPaidPlan && (
                          <button
                            type="button"
                            onClick={() => setPendingAction({ type: "revoke", user })}
                            disabled={isActioning || isGranting}
                            className={`flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-xs font-semibold transition hover:bg-amber-500/20 disabled:opacity-50 ${amberText}`}
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            Remove subscription
                          </button>
                        )}

                        {/* Admin toggle / role picker */}
                        {canGrantAdmin && (
                          user.is_admin ? (
                            // Only super_admin can revoke any admin; others can only revoke moderators they granted
                            (isSuperAdmin || user.admin_role === "moderator") && (
                              <button
                                type="button"
                                onClick={() => setPendingAction({ type: "admin", user, role: user.admin_role ?? "moderator" })}
                                disabled={isActioning || isGranting}
                                className={`flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2.5 text-xs font-semibold transition hover:bg-blue-500/20 disabled:opacity-50 ${blueText}`}
                              >
                                <ShieldOff className="h-3.5 w-3.5" />
                                Remove admin
                              </button>
                            )
                          ) : rolePickerId === user.id ? (
                            <div className={`flex w-full flex-col gap-2 rounded-2xl p-4 ${panel}`}>
                              <p className={`mb-1 text-xs font-semibold ${secondaryText}`}>Select admin role</p>
                              <div className="space-y-1.5">
                                {roles.map((r) => (
                                  <label
                                    key={r.value}
                                    className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition ${
                                      selectedRole === r.value
                                        ? "border-blue-500/40 bg-blue-500/10"
                                        : "border-[var(--sp-border)] bg-[var(--sp-bg-muted)] hover:border-[var(--sp-border-hover)]"
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name={`role-${user.id}`}
                                      value={r.value}
                                      checked={selectedRole === r.value}
                                      disabled={isActioning || isGranting}
                                      onChange={() => setSelectedRole(r.value)}
                                      className="mt-0.5 accent-blue-500"
                                    />
                                    <div>
                                      <p className="text-xs font-semibold text-[var(--sp-text)]">{r.label}</p>
                                      <p className={`text-[11px] ${secondaryText}`}>{r.desc}</p>
                                    </div>
                                  </label>
                                ))}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  disabled={isActioning || isGranting}
                                  onClick={() => setPendingAction({ type: "admin", user, role: selectedRole })}
                                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
                                >
                                  <Shield className="h-3.5 w-3.5" />
                                  Confirm role
                                </button>
                                <button
                                  type="button"
                                  disabled={isActioning}
                                  onClick={() => setRolePickerId(null)}
                                  className={`px-4 py-2 text-xs font-medium ${neutralButton}`}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => { setRolePickerId(user.id); setSelectedRole(roles[0]?.value ?? "moderator"); }}
                              disabled={isActioning || isGranting}
                              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold ${neutralButton}`}
                            >
                              <Shield className="h-3.5 w-3.5" />
                              Make admin
                            </button>
                          )
                        )}

                        {/* Suspend / unsuspend */}
                        {canSuspend && (
                          <button
                            type="button"
                            onClick={() => setPendingAction({ type: "suspend", user })}
                            disabled={isActioning || isGranting}
                            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold transition disabled:opacity-50 ${
                              user.suspended
                                ? `border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 ${greenText}`
                                : `border-red-500/20 bg-red-500/10 hover:bg-red-500/20 ${redText}`
                            }`}
                          >
                            {user.suspended
                              ? <><UserCheck className="h-3.5 w-3.5" />Unsuspend</>
                              : <><UserX    className="h-3.5 w-3.5" />Suspend</>}
                          </button>
                        )}

                        {/* Delete — super_admin only */}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setPendingAction({ type: "delete", user })}
                            disabled={isActioning || isGranting}
                            className={`flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-xs font-semibold transition hover:border-red-500/30 hover:bg-red-500/10 disabled:opacity-50 ${redText}`}
                          >
                            {isActioning
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <X       className="h-3.5 w-3.5" />}
                            Delete account
                          </button>
                        )}
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
        title={
          pendingAction?.type === "admin" && pendingAction.user.is_admin
            ? "Remove admin access?"
            : `Make admin as ${ADMIN_ROLES.find((r) => r.value === (pendingAction?.type === "admin" ? pendingAction.role : ""))?.label ?? ""}?`
        }
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
        open={pendingAction?.type === "revoke"}
        title="Remove this subscription?"
        description={
          pendingAction?.type === "revoke"
            ? `${pendingAction.user.full_name ?? "This user"} will lose their ${pendingAction.user.subscription_plan} plan immediately and go back to free.`
            : ""
        }
        confirmLabel="Remove subscription"
        tone="danger"
        loading={actioningId === (pendingAction?.type === "revoke" ? pendingAction.user.id : "")}
        onConfirm={() => pendingAction?.type === "revoke" && confirmRevoke(pendingAction.user)}
        onCancel={() => setPendingAction(null)}
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

function InfoCell({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className={`min-w-0 rounded-xl px-3 py-2.5 ${panel}`}>
      <div className={`mb-1 flex items-center gap-1.5 ${secondaryText}`}>
        {icon}
        <p className="text-[10px] font-semibold uppercase tracking-wider">{label}</p>
      </div>
      <p className="truncate text-xs font-medium text-[var(--sp-text)]" title={value}>{value}</p>
    </div>
  );
}

function StatCell({ label, value, color, small }: { label: string; value: number | string; color: string; small?: boolean }) {
  return (
    <div className={`min-w-0 rounded-xl px-3 py-2.5 text-center ${panel}`}>
      <p className={`break-words font-black tabular-nums ${small ? "text-sm" : "text-xl"} ${color}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      <p className={`mt-0.5 text-[10px] ${secondaryText}`}>{label}</p>
    </div>
  );
}