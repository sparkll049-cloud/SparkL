"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  GraduationCap, BookOpen, School, Layers, Upload,
  Loader2, Mail, Phone, Pencil, Check, X, LogOut,
  KeyRound, Eye, EyeOff, CheckCircle2,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

interface Course { id: string; name: string; }
interface Profile {
  full_name: string | null; phone: string | null;
  institution: { name: string } | null; department: { name: string } | null;
  level: { name: string } | null; study_mode: { name: string } | null;
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
  setEmail: (email: string | null) => void
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

function ProfileField({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null; }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border p-3 transition-colors"
      style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-muted)" }}>
      <div className="mt-0.5" style={{ color: "var(--sp-text-3)" }}>{icon}</div>
      <div>
        <p className="text-xs font-medium" style={{ color: "var(--sp-text-3)" }}>{label}</p>
        <p className="text-sm font-semibold" style={{ color: "var(--sp-text)" }}>{value ?? "Not set"}</p>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const supabase = createClient();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState<string | null>(null);

  const { data, isLoading: loading, error } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => fetchDashboardSummary(supabase, router, setEmail),
  });

  const [editingIdentity, setEditingIdentity] = useState(false);
  const [fullName, setFullName]               = useState("");
  const [phone, setPhone]                     = useState("");
  const [savingIdentity, setSavingIdentity]   = useState(false);
  const [identityError, setIdentityError]     = useState("");
  const [identitySuccess, setIdentitySuccess] = useState(false);

  const [showPasswordForm,  setShowPasswordForm]  = useState(false);
  const [newPassword,       setNewPassword]       = useState("");
  const [confirmPassword,   setConfirmPassword]   = useState("");
  const [showNewPassword,   setShowNewPassword]   = useState(false);
  const [savingPassword,    setSavingPassword]    = useState(false);
  const [passwordError,     setPasswordError]     = useState("");
  const [passwordSuccess,   setPasswordSuccess]   = useState(false);
  const [signingOut,        setSigningOut]        = useState(false);

  useEffect(() => {
    if (data?.profile) { setFullName(data.profile.full_name ?? ""); setPhone(data.profile.phone ?? ""); }
  }, [data]);

  function startEditingIdentity() {
    setFullName(data?.profile?.full_name ?? ""); setPhone(data?.profile?.phone ?? "");
    setIdentityError(""); setIdentitySuccess(false); setEditingIdentity(true);
  }

  async function saveIdentity() {
    setIdentityError("");
    if (!fullName.trim()) { setIdentityError("Full name can't be empty."); return; }
    if (!phoneValid(phone)) { setIdentityError("Enter a valid Nigerian phone number."); return; }
    setSavingIdentity(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setIdentityError("Session expired."); setSavingIdentity(false); return; }
    const { error: updateError } = await supabase.from("profiles")
      .update({ full_name: fullName.trim(), phone: phone.trim() || null, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    setSavingIdentity(false);
    if (updateError) { setIdentityError(updateError.message); return; }
    queryClient.setQueryData(["dashboard-summary"], (prev: DashboardData | undefined) =>
      prev ? { ...prev, profile: { ...prev.profile, full_name: fullName.trim(), phone: phone.trim() || null } } : prev
    );
    setEditingIdentity(false); setIdentitySuccess(true);
    setTimeout(() => setIdentitySuccess(false), 3000);
  }

  async function savePassword() {
    setPasswordError("");
    if (newPassword.length < 8) { setPasswordError("Password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setPasswordError("Passwords do not match."); return; }
    setSavingPassword(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (updateError) { setPasswordError(updateError.message); return; }
    setNewPassword(""); setConfirmPassword(""); setShowPasswordForm(false);
    setPasswordSuccess(true); setTimeout(() => setPasswordSuccess(false), 3000);
  }

  async function handleSignOut() {
    setSigningOut(true); await supabase.auth.signOut(); router.push("/auth/login");
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500 transition";
  const inputStyle = { background: "var(--sp-input-bg)", borderColor: "var(--sp-border)", color: "var(--sp-text)" };

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
        <p style={{ color: "var(--sp-text-3)" }}>{error instanceof Error ? error.message : "Profile not found."}</p>
        <Link href="/dashboard" className="font-semibold text-blue-400 hover:underline">Back to Dashboard</Link>
      </div>
    );
  }

  const profile = data.profile ?? {};
  const courses = Array.isArray(profile.courses) ? profile.courses : [];
  const stats = data.stats ?? { questions_in_courses: 0, my_uploads: 0 };

  return (
    <div className="min-h-screen px-6 pb-16 pt-8 transition-colors" style={{ background: "var(--sp-bg)" }}>
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--sp-text)" }}>Profile</h1>
            <p className="mt-1 text-sm" style={{ color: "var(--sp-text-3)" }}>Your account and academic details.</p>
          </div>
          <button onClick={handleSignOut} disabled={signingOut}
            className="flex items-center gap-1.5 rounded-xl bg-red-500/10 border border-red-500/20 px-3.5 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-500/20 disabled:opacity-60">
            {signingOut ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />}
            Sign out
          </button>
        </div>

        {/* Identity Card */}
        <div className="mt-6 rounded-2xl border p-6 transition-colors"
          style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-xl font-bold text-blue-400">
                {(profile.full_name ?? "S").charAt(0).toUpperCase()}
              </div>

              {!editingIdentity ? (
                <div>
                  <h2 className="text-lg font-semibold" style={{ color: "var(--sp-text)" }}>{profile.full_name ?? "Student"}</h2>
                  {email && (
                    <p className="flex items-center gap-1.5 text-sm" style={{ color: "var(--sp-text-3)" }}>
                      <Mail size={14} />{email}
                    </p>
                  )}
                  {profile.phone && (
                    <p className="flex items-center gap-1.5 text-sm" style={{ color: "var(--sp-text-3)" }}>
                      <Phone size={14} />{profile.phone}
                    </p>
                  )}
                </div>
              ) : (
                <div className="w-full space-y-2">
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)}
                    placeholder="Full name" maxLength={100} className={inputClass} style={inputStyle} />
                  <input value={phone} onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone number" className={inputClass} style={inputStyle} />
                  {email && (
                    <p className="flex items-center gap-1.5 text-xs" style={{ color: "var(--sp-text-3)" }}>
                      <Mail size={12} />{email} (email can't be changed here)
                    </p>
                  )}
                </div>
              )}
            </div>

            {!editingIdentity ? (
              <button onClick={startEditingIdentity}
                className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-blue-400 hover:bg-blue-500/10 transition">
                <Pencil size={13} />Edit
              </button>
            ) : (
              <div className="flex shrink-0 gap-1.5">
                <button onClick={() => setEditingIdentity(false)} disabled={savingIdentity}
                  className="rounded-lg p-2 transition hover:bg-white/[0.05] disabled:opacity-60"
                  style={{ color: "var(--sp-text-3)" }}>
                  <X size={15} />
                </button>
                <button onClick={saveIdentity} disabled={savingIdentity}
                  className="rounded-lg bg-blue-600 p-2 text-white hover:bg-blue-500 transition disabled:opacity-60">
                  {savingIdentity ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                </button>
              </div>
            )}
          </div>
          {identityError && <p className="mt-3 text-sm text-red-400">{identityError}</p>}
          {identitySuccess && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-emerald-400">
              <CheckCircle2 size={14} />Profile updated.
            </p>
          )}
        </div>

        {/* Academic Details */}
        <div className="mt-6 rounded-2xl border p-6 transition-colors"
          style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
          <h2 className="text-lg font-semibold" style={{ color: "var(--sp-text)" }}>Academic Details</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ProfileField icon={<School size={18} />} label="Institution" value={profile.institution?.name} />
            <ProfileField icon={<BookOpen size={18} />} label="Department" value={profile.department?.name} />
            <ProfileField icon={<GraduationCap size={18} />} label="Level" value={profile.level?.name} />
            <ProfileField icon={<Layers size={18} />} label="Study Mode" value={profile.study_mode?.name} />
          </div>
          <div className="mt-4">
            <Link href="/onboarding" className="flex items-center gap-1.5 text-sm font-semibold text-blue-400 hover:underline">
              <Pencil size={14} />Edit academic details
            </Link>
          </div>
        </div>

        {/* Courses */}
        <div className="mt-6 rounded-2xl border p-6 transition-colors"
          style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
          <h2 className="text-lg font-semibold" style={{ color: "var(--sp-text)" }}>Your Courses ({courses.length})</h2>
          {courses.length === 0 ? (
            <p className="mt-3 text-sm" style={{ color: "var(--sp-text-3)" }}>No courses selected yet.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {courses.map((course) => (
                <span key={course.id} className="rounded-full bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 text-sm font-medium text-blue-400">
                  {course.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Activity stats */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            { icon: <Upload size={22} className="text-blue-400" />, value: stats.my_uploads, label: "Your Uploads" },
            { icon: <BookOpen size={22} className="text-blue-400" />, value: stats.questions_in_courses, label: "Past Questions Across Your Courses" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-4 rounded-2xl border p-6 transition-colors"
              style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">{item.icon}</div>
              <div>
                <p className="text-2xl font-bold" style={{ color: "var(--sp-text)" }}>{item.value}</p>
                <p className="text-sm" style={{ color: "var(--sp-text-3)" }}>{item.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Password */}
        <div className="mt-6 rounded-2xl border p-6 transition-colors"
          style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold" style={{ color: "var(--sp-text)" }}>
              <KeyRound size={18} style={{ color: "var(--sp-text-3)" }} />Password
            </h2>
            {!showPasswordForm && (
              <button onClick={() => { setShowPasswordForm(true); setPasswordError(""); }}
                className="text-sm font-semibold text-blue-400 hover:underline">
                Change password
              </button>
            )}
          </div>

          {showPasswordForm && (
            <div className="mt-4 space-y-3">
              <div className="relative">
                <input type={showNewPassword ? "text" : "password"} value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)} placeholder="New password"
                  className={`${inputClass} pr-10`} style={inputStyle} />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--sp-text-3)" }}>
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <input type={showNewPassword ? "text" : "password"} value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password"
                className={inputClass} style={inputStyle} />
              {passwordError && <p className="text-sm text-red-400">{passwordError}</p>}
              <div className="flex gap-2">
                <button onClick={() => { setShowPasswordForm(false); setNewPassword(""); setConfirmPassword(""); setPasswordError(""); }}
                  disabled={savingPassword}
                  className="flex-1 rounded-lg border py-2 text-sm font-semibold transition disabled:opacity-60"
                  style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-2)", background: "var(--sp-bg-muted)" }}>
                  Cancel
                </button>
                <button onClick={savePassword} disabled={savingPassword || !newPassword || !confirmPassword}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition disabled:opacity-60">
                  {savingPassword && <Loader2 size={14} className="animate-spin" />}
                  Update password
                </button>
              </div>
            </div>
          )}
          {passwordSuccess && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-emerald-400">
              <CheckCircle2 size={14} />Password updated successfully.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}