"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  BookOpen,
  School,
  Layers,
  Upload,
  Loader2,
  Mail,
  Phone,
  Pencil,
  Check,
  X,
  LogOut,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";

interface Course {
  id: string;
  name: string;
}

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
  stats: {
    questions_in_courses: number;
    my_uploads: number;
  };
}

const phoneValid = (phone: string) =>
  phone === "" || /^(\+234|0)?[789][01]\d{8}$/.test(phone);

export default function ProfilePage() {
  const supabase = createClient();
  const router = useRouter();

  const [data, setData] = useState<DashboardData | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Inline identity edit
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [identityError, setIdentityError] = useState("");
  const [identitySuccess, setIdentitySuccess] = useState(false);

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/auth/login");
      return;
    }

    setEmail(session.user.email ?? null);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/dashboard/summary`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );

      if (!res.ok) throw new Error("Failed to load profile.");

      const json: DashboardData = await res.json();
      setData(json);
      setFullName(json.profile?.full_name ?? "");
      setPhone(json.profile?.phone ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function startEditingIdentity() {
    setFullName(data?.profile?.full_name ?? "");
    setPhone(data?.profile?.phone ?? "");
    setIdentityError("");
    setIdentitySuccess(false);
    setEditingIdentity(true);
  }

  async function saveIdentity() {
    setIdentityError("");

    if (!fullName.trim()) {
      setIdentityError("Full name can't be empty.");
      return;
    }

    if (!phoneValid(phone)) {
      setIdentityError("Enter a valid Nigerian phone number.");
      return;
    }

    setSavingIdentity(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setIdentityError("Session expired. Please log in again.");
      setSavingIdentity(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    setSavingIdentity(false);

    if (updateError) {
      setIdentityError(updateError.message);
      return;
    }

    setData((prev) =>
      prev
        ? {
            ...prev,
            profile: {
              ...prev.profile,
              full_name: fullName.trim(),
              phone: phone.trim() || null,
            },
          }
        : prev
    );

    setEditingIdentity(false);
    setIdentitySuccess(true);
    setTimeout(() => setIdentitySuccess(false), 3000);
  }

  const newPasswordValid = newPassword.length >= 8;
  const passwordsMatch = newPassword === confirmPassword && confirmPassword !== "";

  async function savePassword() {
    setPasswordError("");

    if (!newPasswordValid) {
      setPasswordError("Password must be at least 8 characters.");
      return;
    }

    if (!passwordsMatch) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setSavingPassword(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setSavingPassword(false);

    if (updateError) {
      setPasswordError(updateError.message);
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    setShowPasswordForm(false);
    setPasswordSuccess(true);
    setTimeout(() => setPasswordSuccess(false), 3000);
  }

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-slate-600">{error || "Profile not found."}</p>
        <Link href="/dashboard" className="font-semibold text-blue-600 hover:underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const profile = data.profile ?? {};
  const courses = Array.isArray(profile.courses) ? profile.courses : [];
  const stats = data.stats ?? { questions_in_courses: 0, my_uploads: 0 };

  return (
    <div className="mx-auto max-w-3xl px-6 pb-16 pt-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Profile</h1>
          <p className="mt-1 text-sm text-slate-500">
            Your account and academic details.
          </p>
        </div>

        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex items-center gap-1.5 rounded-xl bg-red-50 px-3.5 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-60"
        >
          {signingOut ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <LogOut size={15} />
          )}
          Sign out
        </button>
      </div>

      {/* Identity Card */}
      <div className="mt-6 rounded-2xl bg-white p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-600">
              {(profile.full_name ?? "S").charAt(0).toUpperCase()}
            </div>

            {!editingIdentity ? (
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {profile.full_name ?? "Student"}
                </h2>
                {email && (
                  <p className="flex items-center gap-1.5 text-sm text-slate-500">
                    <Mail size={14} />
                    {email}
                  </p>
                )}
                {profile.phone && (
                  <p className="flex items-center gap-1.5 text-sm text-slate-500">
                    <Phone size={14} />
                    {profile.phone}
                  </p>
                )}
              </div>
            ) : (
              <div className="w-full space-y-2">
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full name"
                  maxLength={100}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone number"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                {email && (
                  <p className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Mail size={12} />
                    {email} (email can't be changed here)
                  </p>
                )}
              </div>
            )}
          </div>

          {!editingIdentity ? (
            <button
              onClick={startEditingIdentity}
              className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50"
            >
              <Pencil size={13} />
              Edit
            </button>
          ) : (
            <div className="flex shrink-0 gap-1.5">
              <button
                onClick={() => setEditingIdentity(false)}
                disabled={savingIdentity}
                className="rounded-lg bg-slate-50 p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-60"
              >
                <X size={15} />
              </button>
              <button
                onClick={saveIdentity}
                disabled={savingIdentity}
                className="rounded-lg bg-blue-600 p-2 text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {savingIdentity ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Check size={15} />
                )}
              </button>
            </div>
          )}
        </div>

        {identityError && (
          <p className="mt-3 text-sm text-red-500">{identityError}</p>
        )}
        {identitySuccess && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-emerald-600">
            <CheckCircle2 size={14} />
            Profile updated.
          </p>
        )}
      </div>

      {/* Academic Details */}
      <div className="mt-6 rounded-2xl bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-slate-900">
          Academic Details
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ProfileField
            icon={<School size={18} />}
            label="Institution"
            value={profile.institution?.name}
          />
          <ProfileField
            icon={<BookOpen size={18} />}
            label="Department"
            value={profile.department?.name}
          />
          <ProfileField
            icon={<GraduationCap size={18} />}
            label="Level"
            value={profile.level?.name}
          />
          <ProfileField
            icon={<Layers size={18} />}
            label="Study Mode"
            value={profile.study_mode?.name}
          />
        </div>

        <div className="mt-4">
          <Link
            href="/onboarding"
            className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline"
          >
            <Pencil size={14} />
            Edit academic details
          </Link>
        </div>
      </div>

      {/* Courses */}
      <div className="mt-6 rounded-2xl bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Your Courses ({courses.length})
          </h2>
        </div>

        {courses.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">
            No courses selected yet.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {courses.map((course) => (
              <span
                key={course.id}
                className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700"
              >
                {course.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Activity */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-4 rounded-2xl bg-white p-6 shadow-lg">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
            <Upload size={22} className="text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">
              {stats.my_uploads}
            </p>
            <p className="text-sm text-slate-500">Your Uploads</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl bg-white p-6 shadow-lg">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
            <BookOpen size={22} className="text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">
              {stats.questions_in_courses}
            </p>
            <p className="text-sm text-slate-500">
              Past Questions Across Your Courses
            </p>
          </div>
        </div>
      </div>

      {/* Account Security */}
      <div className="mt-6 rounded-2xl bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <KeyRound size={18} className="text-slate-400" />
            Password
          </h2>

          {!showPasswordForm && (
            <button
              onClick={() => {
                setShowPasswordForm(true);
                setPasswordError("");
              }}
              className="text-sm font-semibold text-blue-600 hover:underline"
            >
              Change password
            </button>
          )}
        </div>

        {showPasswordForm && (
          <div className="mt-4 space-y-3">
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-10 text-sm outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <input
              type={showNewPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />

            {passwordError && (
              <p className="text-sm text-red-500">{passwordError}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowPasswordForm(false);
                  setNewPassword("");
                  setConfirmPassword("");
                  setPasswordError("");
                }}
                disabled={savingPassword}
                className="flex-1 rounded-lg bg-slate-50 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={savePassword}
                disabled={savingPassword || !newPassword || !confirmPassword}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {savingPassword && (
                  <Loader2 size={14} className="animate-spin" />
                )}
                Update password
              </button>
            </div>
          </div>
        )}

        {passwordSuccess && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-emerald-600">
            <CheckCircle2 size={14} />
            Password updated successfully.
          </p>
        )}
      </div>
    </div>
  );
}

function ProfileField({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-3">
      <div className="mt-0.5 text-slate-400">{icon}</div>
      <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="text-sm font-semibold text-slate-900">
          {value ?? "Not set"}
        </p>
      </div>
    </div>
  );
}