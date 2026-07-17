"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  User,
  Mail,
  Phone,
  Building2,
  GraduationCap,
  Pencil,
  Save,
  X,
  LogOut,
  Loader2,
} from "lucide-react";

// TODO: replace with the logged-in student's real profile row from Supabase
const INITIAL_PROFILE = {
  full_name: "Ijeoma Nwachukwu",
  email: "ijeoma.n@yabatech.edu.ng",
  phone_num: "0803 456 7890",
  institution: "Yabatech",
  department: "Computer Science",
  program_type: "ND",
  level: "ND1",
  created_at: "June 2, 2026",
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState(INITIAL_PROFILE);
  const [draft, setDraft] = useState(INITIAL_PROFILE);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const initials = profile.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const startEditing = () => {
    setDraft(profile);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setDraft(profile);
    setIsEditing(false);
  };

  const saveProfile = async () => {
    setSaving(true);

    // TODO: PATCH /api/profile with { full_name, phone_num }
    // only full_name and phone_num should be editable here — institution,
    // department, program_type, and level are set at registration and
    // shouldn't change without an admin's involvement
    await new Promise((res) => setTimeout(res, 900));

    setProfile(draft);
    setSaving(false);
    setIsEditing(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-6">
          <Image
            src="/images/logo.jpg"
            alt="SparkL"
            width={50}
            height={50}
            priority
            className="mb-3 object-contain"
          />
          <h1 className="text-2xl font-bold text-slate-900">Your profile</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your personal details.
          </p>
        </div>

        {/* Profile card */}
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
          {/* Avatar + name */}
          <div className="flex items-center gap-4 border-b border-slate-100 p-6">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0">
              {isEditing ? (
                <input
                  value={draft.full_name}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, full_name: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-base font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              ) : (
                <p className="truncate text-lg font-semibold text-slate-900">
                  {profile.full_name}
                </p>
              )}
              <p className="text-xs text-slate-400">
                Member since {profile.created_at}
              </p>
            </div>
          </div>

          {/* Fields */}
          <div className="space-y-4 p-6">
            <ProfileField
              icon={<Mail className="h-4 w-4" />}
              label="Email"
              value={profile.email}
              editable={false}
            />
            <ProfileField
              icon={<Phone className="h-4 w-4" />}
              label="Phone number"
              value={isEditing ? draft.phone_num : profile.phone_num}
              editable={isEditing}
              onChange={(v) => setDraft((d) => ({ ...d, phone_num: v }))}
            />
            <ProfileField
              icon={<Building2 className="h-4 w-4" />}
              label="Institution"
              value={profile.institution}
              editable={false}
            />
            <ProfileField
              icon={<GraduationCap className="h-4 w-4" />}
              label="Department"
              value={profile.department}
              editable={false}
            />
            <div className="grid grid-cols-2 gap-4">
              <ProfileField
                icon={<User className="h-4 w-4" />}
                label="Program"
                value={profile.program_type}
                editable={false}
              />
              <ProfileField
                icon={<User className="h-4 w-4" />}
                label="Level"
                value={profile.level}
                editable={false}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
            {isEditing ? (
              <div className="flex w-full gap-2">
                <button
                  onClick={cancelEditing}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
                <button
                  onClick={saveProfile}
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            ) : (
              <button
                onClick={startEditing}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                <Pencil className="h-4 w-4" />
                Edit profile
              </button>
            )}
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={() => {
            // TODO: call your Supabase signOut() then redirect
            router.push("/login");
          }}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-red-100 py-3 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </div>
    </div>
  );
}

function ProfileField({
  icon,
  label,
  value,
  editable,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  editable: boolean;
  onChange?: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
        {icon}
        {label}
      </label>
      {editable ? (
        <input
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      ) : (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {value}
        </p>
      )}
    </div>
  );
}