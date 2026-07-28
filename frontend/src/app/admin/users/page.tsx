"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  Shield,
  ShieldOff,
  UserX,
  UserCheck,
  Search,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";
import ConfirmDialog from "../components/ConfirmDialog";

interface Course {
  id: string;
  name: string;
}

interface UserRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  is_admin: boolean;
  suspended: boolean;
  created_at: string;
  institution: { name: string } | null;
  department: { name: string } | null;
  courses: Course[];
  level: { name: string } | null;
}

type PendingAction =
  | { type: "suspend"; user: UserRow }
  | { type: "admin"; user: UserRow }
  | null;

export default function AdminUsersPage() {
  const supabase = createClient();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  async function getToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) return null;

    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    const isExpiringSoon = expiresAt - Date.now() < 60_000;

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

    if (!token) {
      setError("Session expired. Please log in again.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/users`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) throw new Error("Failed to load users.");

      const json = await res.json();
      const normalized: UserRow[] = (Array.isArray(json) ? json : []).map(
        (u) => ({ ...u, courses: Array.isArray(u.courses) ? u.courses : [] })
      );
      setUsers(normalized);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function confirmSuspend(user: UserRow) {
    setActioningId(user.id);
    setError("");

    const token = await getToken();

    if (!token) {
      setError("Session expired. Please log in again.");
      setActioningId(null);
      setPendingAction(null);
      return;
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/users/${user.id}/suspend`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ suspended: !user.suspended }),
        }
      );

      if (!res.ok) throw new Error("Failed to update suspension status.");

      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, suspended: !u.suspended } : u
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setActioningId(null);
      setPendingAction(null);
    }
  }

  async function confirmAdminToggle(user: UserRow) {
    setActioningId(user.id);
    setError("");

    const token = await getToken();

    if (!token) {
      setError("Session expired. Please log in again.");
      setActioningId(null);
      setPendingAction(null);
      return;
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/users/${user.id}/admin`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ is_admin: !user.is_admin }),
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail ?? "Failed to update admin status.");
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, is_admin: !u.is_admin } : u
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setActioningId(null);
      setPendingAction(null);
    }
  }

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q) ||
      u.institution?.name?.toLowerCase().includes(q) ||
      u.courses.some((c) => c.name.toLowerCase().includes(q))
    );
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Users</h1>
      <p className="mt-1 text-sm text-slate-500">
        Manage student accounts, admin access, and suspensions.
      </p>

      <div className="mt-6 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
        <Search size={18} className="text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone, institution, or course..."
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

      <div className="mt-6 rounded-2xl bg-white shadow-sm">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-500">
            No users found.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((user) => (
              <div
                key={user.id}
                className="flex flex-wrap items-center justify-between gap-4 p-5"
              >
                <div className="min-w-[220px] flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900">
                      {user.full_name ?? "Unnamed User"}
                    </p>
                    {user.is_admin && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                        Admin
                      </span>
                    )}
                    {user.suspended && (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-500">
                        Suspended
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">
                    {user.phone ?? "No phone"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {user.institution?.name ?? "No institution"} ·{" "}
                    {user.department?.name ?? "No department"} ·{" "}
                    {user.level?.name ?? "No level"}
                  </p>

                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {user.courses.length === 0 ? (
                      <span className="text-xs text-slate-400">
                        No courses
                      </span>
                    ) : (
                      user.courses.map((c) => (
                        <span
                          key={c.id}
                          className="rounded-full bg-slate-50 px-2 py-0.5 text-xs text-slate-600"
                        >
                          {c.name}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setPendingAction({ type: "admin", user })}
                    disabled={actioningId === user.id}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition disabled:opacity-60 ${
                      user.is_admin
                        ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
                        : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {user.is_admin ? (
                      <>
                        <ShieldOff size={14} />
                        Remove Admin
                      </>
                    ) : (
                      <>
                        <Shield size={14} />
                        Make Admin
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setPendingAction({ type: "suspend", user })}
                    disabled={actioningId === user.id}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition disabled:opacity-60 ${
                      user.suspended
                        ? "bg-green-50 text-green-600 hover:bg-green-100"
                        : "bg-red-50 text-red-500 hover:bg-red-100"
                    }`}
                  >
                    {user.suspended ? (
                      <>
                        <UserCheck size={14} />
                        Unsuspend
                      </>
                    ) : (
                      <>
                        <UserX size={14} />
                        Suspend
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingAction?.type === "suspend"}
        title={
          pendingAction?.type === "suspend" && pendingAction.user.suspended
            ? "Unsuspend this user?"
            : "Suspend this user?"
        }
        description={
          pendingAction?.type === "suspend"
            ? pendingAction.user.suspended
              ? `${
                  pendingAction.user.full_name ?? "This user"
                } will regain access to their account immediately.`
              : `${
                  pendingAction.user.full_name ?? "This user"
                } will lose access to their account immediately. You can unsuspend them later.`
            : ""
        }
        confirmLabel={
          pendingAction?.type === "suspend" && pendingAction.user.suspended
            ? "Unsuspend"
            : "Suspend"
        }
        tone={
          pendingAction?.type === "suspend" && pendingAction.user.suspended
            ? "default"
            : "danger"
        }
        loading={actioningId === (pendingAction?.user.id ?? "")}
        onConfirm={() =>
          pendingAction?.type === "suspend" &&
          confirmSuspend(pendingAction.user)
        }
        onCancel={() => setPendingAction(null)}
      />

      <ConfirmDialog
        open={pendingAction?.type === "admin"}
        title={
          pendingAction?.type === "admin" && pendingAction.user.is_admin
            ? "Remove admin access?"
            : "Grant admin access?"
        }
        description={
          pendingAction?.type === "admin"
            ? pendingAction.user.is_admin
              ? `${
                  pendingAction.user.full_name ?? "This user"
                } will lose access to the admin panel immediately.`
              : `${
                  pendingAction.user.full_name ?? "This user"
                } will gain full admin access, including managing other users.`
            : ""
        }
        confirmLabel={
          pendingAction?.type === "admin" && pendingAction.user.is_admin
            ? "Remove Admin"
            : "Make Admin"
        }
        tone={
          pendingAction?.type === "admin" && pendingAction.user.is_admin
            ? "danger"
            : "default"
        }
        loading={actioningId === (pendingAction?.user.id ?? "")}
        onConfirm={() =>
          pendingAction?.type === "admin" &&
          confirmAdminToggle(pendingAction.user)
        }
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}