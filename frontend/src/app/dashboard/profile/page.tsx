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

export default function ProfilePage() {
  const supabase = createClient();
  const router = useRouter();

  const [data, setData] = useState<DashboardData | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
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
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

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
      <h1 className="text-2xl font-bold text-slate-900">Profile</h1>
      <p className="mt-1 text-sm text-slate-500">
        Your account and academic details.
      </p>

      {/* Identity Card */}
      <div className="mt-6 rounded-2xl bg-white p-6 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-600">
            {(profile.full_name ?? "S").charAt(0).toUpperCase()}
          </div>
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
        </div>
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

      {/* Edit link (placeholder for now) */}
      <div className="mt-6 flex justify-center">
        <Link
          href="/onboarding"
          className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline"
        >
          <Pencil size={14} />
          Edit academic details
        </Link>
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