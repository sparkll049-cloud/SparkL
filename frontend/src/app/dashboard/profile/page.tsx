"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  GraduationCap, BookOpen, School, Layers, Upload,
  Loader2, Mail, Phone, Pencil, Check, X, LogOut,
  KeyRound, Eye, EyeOff, CheckCircle2, Crown, Sparkles,
  ShieldCheck, Zap, Calendar, Camera,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Course { id: string; name: string; }
interface Profile {
  full_name: string | null;
  phone: string | null;
  institution: { name: string } | null;
  department: { name: string } | null;
  level: { name: string } | null;
  study_mode: { name: string } | null;
  courses?: Course[];
}
interface DashboardData {
  profile: Profile;
  stats: { questions_in_courses: number; my_uploads: number; };
}

const phoneValid = (phone: string) =>
  phone === "" || /^(\+234|0)?[789][01]\d{8}$/.test(phone);

async function fetchDashboardSummary(
  supabase: ReturnType<typeof createClient>,
  router: ReturnType<typeof useRouter>,
  setEmail: (e: string | null) => void
): Promise<DashboardData> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { router.push("/auth/login"); throw new Error("No session"); }
  setEmail(session.user.email ?? null);
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/dashboard/summary`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!res.ok) throw new Error("Failed to load profile.");
  return res.json();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ProfileField({
  icon, label, value,
}: {
  icon: React.ReactNode; label: string; value?: string | null;
}) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl border p-3 transition-colors"
      style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-muted)" }}
    >
      <div className="mt-0.5" style={{ color: "var(--sp-text-3)" }}>{icon}</div>
      <div>
        <p className="text-xs font-medium" style={{ color: "var(--sp-text-3)" }}>{label}</p>
        <p className="text-sm font-semibold" style={{ color: "var(--sp-text)" }}>{value ?? "Not set"}</p>
      </div>
    </div>
  );
}

// ── Plan metadata ─────────────────────────────────────────────────────────────

type PlanKey = "free" | "trial" | "basic" | "pro" | "premium";

const PLAN_META: Record<PlanKey, {
  label: string; color: string; bg: string; border: string; icon: React.ReactNode;
}> = {
  free:    { label: "Free",    color: "text-slate-400",  bg: "bg-slate-500/10",  border: "border-slate-500/20",  icon: <ShieldCheck size={15} /> },
  trial:   { label: "Trial",   color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/20",  icon: <Zap size={15} /> },
  basic:   { label: "Basic",   color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20",   icon: <Sparkles size={15} /> },
  pro:     { label: "Pro",     color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20", icon: <Crown size={15} /> },
  premium: { label: "Premium", color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20", icon: <Crown size={15} /> },
};

function getPlanMeta(plan: string) {
  return PLAN_META[(plan as PlanKey)] ?? PLAN_META.free;
}

function formatExpiry(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
  } catch { return "—"; }
}

function formatDownloads(val: number | null | undefined, isPaid: boolean): string {
  if (val === null || val === undefined) return isPaid ? "Unlimited" : "None";
  if (val === 0) return "None";
  return String(val);
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const supabase     = createClient();
  const router       = useRouter();
  const queryClient  = useQueryClient();
  const [email, setEmail] = useState<string | null>(null);

  // ── Dashboard data ──────────────────────────────────────────────────────────
  const { data, isLoading: loading, error } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => fetchDashboardSummary(supabase, router, setEmail),
  });

  // ── Subscription ────────────────────────────────────────────────────────────
  const [sub, setSub] = useState<{
    plan: string; effective_plan: string; is_paid: boolean; is_trial: boolean;
    expires_at: string | null; read_mode_percent: number;
    practice_mode_max: number | null; downloads_per_day: number | null;
  } | null>(null);
  const [subLoading, setSubLoading] = useState(true);

  useEffect(() => {
    async function loadSub() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/payments/subscription/status`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );
        if (res.ok) {
          const raw = await res.json();
          setSub({
            plan:               raw.plan ?? "free",
            effective_plan:     raw.effective_plan ?? raw.plan ?? "free",
            is_paid:            raw.is_paid === true,
            is_trial:           raw.is_trial === true,
            expires_at:         raw.expires_at ?? null,
            read_mode_percent:  typeof raw.read_mode_percent === "number" ? raw.read_mode_percent : 100,
            practice_mode_max:  raw.practice_mode_max ?? null,
            downloads_per_day:  raw.downloads_per_day ?? null,
          });
        }
      } catch (e) {
        console.error("[loadSub error]", e);
      } finally {
        setSubLoading(false);
      }
    }
    loadSub();
  }, []);

  // ── Avatar ──────────────────────────────────────────────────────────────────
  const [avatarUrl,       setAvatarUrl]       = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError,     setAvatarError]     = useState("");

  useEffect(() => {
    async function loadAvatar() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/avatar/me`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );
        if (res.ok) {
          const json = await res.json();
          if (json.avatar_url) setAvatarUrl(json.avatar_url);
        }
      } catch { /* silent */ }
    }
    loadAvatar();
  }, []);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("Image must be under 5 MB.");
      return;
    }
    setUploadingAvatar(true);
    setAvatarError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated.");
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/avatar`,
        { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` }, body: form }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "Upload failed.");
      }
      const json = await res.json();
      setAvatarUrl(json.avatar_url);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  }

  // ── Identity editing ────────────────────────────────────────────────────────
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [fullName,        setFullName]        = useState("");
  const [phone,           setPhone]           = useState("");
  const [savingIdentity,  setSavingIdentity]  = useState(false);
  const [identityError,   setIdentityError]   = useState("");
  const [identitySuccess, setIdentitySuccess] = useState(false);

  // ── Password ────────────────────────────────────────────────────────────────
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword,  setCurrentPassword]  = useState("");
  const [newPassword,      setNewPassword]      = useState("");
  const [confirmPassword,  setConfirmPassword]  = useState("");
  const [showCurrentPw,    setShowCurrentPw]    = useState(false);
  const [showNewPw,        setShowNewPw]        = useState(false);
  const [savingPassword,   setSavingPassword]   = useState(false);
  const [passwordError,    setPasswordError]    = useState("");
  const [passwordSuccess,  setPasswordSuccess]  = useState(false);

  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (data?.profile) {
      setFullName(data.profile.full_name ?? "");
      setPhone(data.profile.phone ?? "");
    }
  }, [data]);

  function startEditingIdentity() {
    setFullName(data?.profile?.full_name ?? "");
    setPhone(data?.profile?.phone ?? "");
    setIdentityError("");
    setIdentitySuccess(false);
    setEditingIdentity(true);
  }

  async function saveIdentity() {
    setIdentityError("");
    if (!fullName.trim()) { setIdentityError("Full name can't be empty."); return; }
    if (!phoneValid(phone)) { setIdentityError("Enter a valid Nigerian phone number."); return; }
    setSavingIdentity(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setIdentityError("Session expired."); setSavingIdentity(false); return; }
    const { error: updateError } = await supabase.from("profiles").update({
      full_name:  fullName.trim(),
      phone:      phone.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq("id", user.id);
    setSavingIdentity(false);
    if (updateError) { setIdentityError(updateError.message); return; }
    queryClient.setQueryData(["dashboard-summary"], (prev: DashboardData | undefined) =>
      prev ? { ...prev, profile: { ...prev.profile, full_name: fullName.trim(), phone: phone.trim() || null } } : prev
    );
    setEditingIdentity(false);
    setIdentitySuccess(true);
    setTimeout(() => setIdentitySuccess(false), 3000);
  }

  async function savePassword() {
    setPasswordError("");
    if (!currentPassword) { setPasswordError("Enter your current password first."); return; }
    if (newPassword.length < 8) { setPasswordError("New password must be at least 8 characters."); return; }
    if (newPassword === currentPassword) { setPasswordError("New password must differ from current."); return; }
    if (newPassword !== confirmPassword) { setPasswordError("Passwords do not match."); return; }
    setSavingPassword(true);
    if (email) {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
      if (signInErr) { setPasswordError("Current password is incorrect."); setSavingPassword(false); return; }
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (updateError) { setPasswordError(updateError.message); return; }
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    setShowPasswordForm(false);
    setPasswordSuccess(true);
    setTimeout(() => setPasswordSuccess(false), 4000);
  }

  function cancelPassword() {
    setShowPasswordForm(false);
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    setPasswordError("");
  }

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500 transition";
  const inputStyle = { background: "var(--sp-input-bg)", borderColor: "var(--sp-border)", color: "var(--sp-text)" };

  // ── Loading / error ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" style={{ background: "var(--sp-bg)" }}>
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center" style={{ background: "var(--sp-bg)" }}>
        <p style={{ color: "var(--sp-text-3)" }}>
          {error instanceof Error ? error.message : "Profile not found."}
        </p>
        <Link href="/dashboard" className="font-semibold text-blue-400 hover:underline">Back to Dashboard</Link>
      </div>
    );
  }

  const profile       = data.profile ?? {};
  const courses       = Array.isArray(profile.courses) ? profile.courses : [];
  const stats         = data.stats ?? { questions_in_courses: 0, my_uploads: 0 };
  const effectivePlan = sub?.effective_plan ?? sub?.plan ?? "free";
  const isPaid        = sub?.is_paid === true;
  const planMeta      = getPlanMeta(effectivePlan);
  const initials      = (profile.full_name ?? "S").charAt(0).toUpperCase();

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen px-4 pb-16 pt-8 sm:px-6 transition-colors" style={{ background: "var(--sp-bg)" }}>
      <div className="mx-auto max-w-3xl">

        {/* ── Page header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--sp-text)" }}>Profile</h1>
            <p className="mt-1 text-sm" style={{ color: "var(--sp-text-3)" }}>
              Your account and academic details.
            </p>
          </div>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-500/20 disabled:opacity-60"
          >
            {signingOut ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />}
            Sign out
          </button>
        </div>

        {/* ── Subscription card ── */}
        <div
          className="mt-6 rounded-2xl border p-5 transition-colors"
          style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${planMeta.bg} ${planMeta.border}`}>
                <span className={planMeta.color}>{planMeta.icon}</span>
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: "var(--sp-text-3)" }}>Current plan</p>
                {subLoading
                  ? <Loader2 size={14} className="mt-1 animate-spin text-slate-500" />
                  : <p className={`text-lg font-bold ${planMeta.color}`}>{planMeta.label}</p>
                }
              </div>
            </div>
            {!isPaid && (
              <Link
                href="/dashboard/subscribe"
                className="flex shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
              >
                <Crown size={13} /> Upgrade
              </Link>
            )}
          </div>

          {!subLoading && sub && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Read access",     value: sub.read_mode_percent === 100 ? "Full" : `${sub.read_mode_percent}%` },
                { label: "Practice limit",  value: sub.practice_mode_max == null ? "Unlimited" : `${sub.practice_mode_max} questions` },
                { label: "Downloads/day",   value: formatDownloads(sub.downloads_per_day, isPaid) },
                {
                  label: isPaid && sub.expires_at ? "Expires" : "Renewal",
                  value: isPaid && sub.expires_at ? formatExpiry(sub.expires_at) : "—",
                  icon:  isPaid && sub.expires_at ? <Calendar size={11} className="mt-0.5 shrink-0" /> : null,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border px-3 py-2.5"
                  style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-muted)" }}
                >
                  <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--sp-text-3)" }}>
                    {item.label}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold" style={{ color: "var(--sp-text)" }}>
                    {item.icon}{item.value}
                  </p>
                </div>
              ))}
            </div>
          )}

          {!subLoading && !isPaid && (
            <p className="mt-3 text-xs" style={{ color: "var(--sp-text-3)" }}>
              Free plan: 10 questions read · 5 practice questions · no downloads
            </p>
          )}
        </div>

        {/* ── Identity card ── */}
        <div
          className="mt-6 rounded-2xl border p-6 transition-colors"
          style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">

              {/* Avatar with upload button */}
              <div className="relative shrink-0">
                <div className="h-16 w-16 overflow-hidden rounded-full bg-blue-500/15 ring-2 ring-blue-500/20">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xl font-bold text-blue-400">
                      {initials}
                    </div>
                  )}
                </div>

                {/* Camera overlay */}
                <label
                  htmlFor="avatar-upload"
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-blue-600 text-white shadow-lg ring-2 ring-[var(--sp-bg-card)] transition hover:bg-blue-500"
                  title="Change photo"
                >
                  {uploadingAvatar
                    ? <Loader2 size={12} className="animate-spin" />
                    : <Camera size={12} />
                  }
                </label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={handleAvatarChange}
                  disabled={uploadingAvatar}
                />
              </div>

              {/* Name / email / phone */}
              {!editingIdentity ? (
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold" style={{ color: "var(--sp-text)" }}>
                    {profile.full_name ?? "Student"}
                  </h2>
                  {email && (
                    <p className="flex items-center gap-1.5 text-sm" style={{ color: "var(--sp-text-3)" }}>
                      <Mail size={14} className="shrink-0" />
                      <span className="truncate">{email}</span>
                    </p>
                  )}
                  {profile.phone && (
                    <p className="flex items-center gap-1.5 text-sm" style={{ color: "var(--sp-text-3)" }}>
                      <Phone size={14} className="shrink-0" />{profile.phone}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex-1 space-y-2">
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Full name"
                    maxLength={100}
                    className={inputClass}
                    style={inputStyle}
                  />
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone number (e.g. 08012345678)"
                    className={inputClass}
                    style={inputStyle}
                  />
                  {email && (
                    <p className="flex items-center gap-1.5 text-xs" style={{ color: "var(--sp-text-3)" }}>
                      <Mail size={12} />{email} (can't be changed here)
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Edit / save controls */}
            {!editingIdentity ? (
              <button
                onClick={startEditingIdentity}
                className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-blue-400 transition hover:bg-blue-500/10"
              >
                <Pencil size={13} /> Edit
              </button>
            ) : (
              <div className="flex shrink-0 gap-1.5">
                <button
                  onClick={() => setEditingIdentity(false)}
                  disabled={savingIdentity}
                  className="rounded-lg p-2 transition hover:bg-white/[0.05] disabled:opacity-60"
                  style={{ color: "var(--sp-text-3)" }}
                >
                  <X size={15} />
                </button>
                <button
                  onClick={saveIdentity}
                  disabled={savingIdentity}
                  className="rounded-lg bg-blue-600 p-2 text-white transition hover:bg-blue-500 disabled:opacity-60"
                >
                  {savingIdentity ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                </button>
              </div>
            )}
          </div>

          {/* Feedback */}
          {avatarError && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-red-400">
              <X size={12} />{avatarError}
            </p>
          )}
          {identityError && <p className="mt-3 text-sm text-red-400">{identityError}</p>}
          {identitySuccess && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-emerald-400">
              <CheckCircle2 size={14} /> Profile updated.
            </p>
          )}
        </div>

        {/* ── Academic details ── */}
        <div
          className="mt-6 rounded-2xl border p-6 transition-colors"
          style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
        >
          <h2 className="text-lg font-semibold" style={{ color: "var(--sp-text)" }}>Academic Details</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ProfileField icon={<School size={18} />}        label="Institution" value={profile.institution?.name} />
            <ProfileField icon={<BookOpen size={18} />}      label="Department"  value={profile.department?.name} />
            <ProfileField icon={<GraduationCap size={18} />} label="Level"       value={profile.level?.name} />
            <ProfileField icon={<Layers size={18} />}        label="Study Mode"  value={profile.study_mode?.name} />
          </div>
          <div className="mt-4">
            <Link
              href="/onboarding"
              className="flex items-center gap-1.5 text-sm font-semibold text-blue-400 hover:underline"
            >
              <Pencil size={14} /> Edit academic details
            </Link>
          </div>
        </div>

        {/* ── Courses ── */}
        <div
          className="mt-6 rounded-2xl border p-6 transition-colors"
          style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
        >
          <h2 className="text-lg font-semibold" style={{ color: "var(--sp-text)" }}>
            Your Courses ({courses.length})
          </h2>
          {courses.length === 0 ? (
            <p className="mt-3 text-sm" style={{ color: "var(--sp-text-3)" }}>No courses selected yet.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {courses.map((course) => (
                <span
                  key={course.id}
                  className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-sm font-medium text-blue-400"
                >
                  {course.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Activity stats ── */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            { icon: <Upload size={22} className="text-blue-400" />,  value: stats.my_uploads,             label: "Your Uploads" },
            { icon: <BookOpen size={22} className="text-blue-400" />, value: stats.questions_in_courses, label: "Past Questions Across Your Courses" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-4 rounded-2xl border p-6 transition-colors"
              style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
                {item.icon}
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: "var(--sp-text)" }}>{item.value}</p>
                <p className="text-sm" style={{ color: "var(--sp-text-3)" }}>{item.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Password ── */}
        <div
          className="mt-6 rounded-2xl border p-6 transition-colors"
          style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
        >
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold" style={{ color: "var(--sp-text)" }}>
              <KeyRound size={18} style={{ color: "var(--sp-text-3)" }} />
              Password
            </h2>
            {!showPasswordForm && (
              <button
                onClick={() => { setShowPasswordForm(true); setPasswordError(""); }}
                className="text-sm font-semibold text-blue-400 hover:underline"
              >
                Change password
              </button>
            )}
          </div>

          {showPasswordForm && (
            <div className="mt-4 space-y-3">

              {/* Current password */}
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: "var(--sp-text-3)" }}>
                  Current password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPw ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    className={`${inputClass} pr-10`}
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--sp-text-3)" }}
                  >
                    {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: "var(--sp-text-3)" }}>
                  New password
                </label>
                <div className="relative">
                  <input
                    type={showNewPw ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className={`${inputClass} pr-10`}
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--sp-text-3)" }}
                  >
                    {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm */}
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: "var(--sp-text-3)" }}>
                  Confirm new password
                </label>
                <input
                  type={showNewPw ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className={inputClass}
                  style={inputStyle}
                />
              </div>

              {passwordError && <p className="text-sm text-red-400">{passwordError}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={cancelPassword}
                  disabled={savingPassword}
                  className="flex-1 rounded-lg border py-2 text-sm font-semibold transition disabled:opacity-60"
                  style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-2)", background: "var(--sp-bg-muted)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={savePassword}
                  disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
                >
                  {savingPassword && <Loader2 size={14} className="animate-spin" />}
                  Update password
                </button>
              </div>
            </div>
          )}

          {passwordSuccess && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-emerald-400">
              <CheckCircle2 size={14} /> Password updated successfully.
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
