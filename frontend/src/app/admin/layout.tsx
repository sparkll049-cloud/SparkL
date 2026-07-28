"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  FileText,
  School,
  BookOpen,
  GraduationCap,
  Layers,
  CalendarDays,
  LogOut,
  Menu,
  X,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";

const navGroups = [
  {
    label: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Moderation",
    items: [
      { href: "/admin/questions", label: "Past Questions", icon: FileText },
      { href: "/admin/users", label: "Users", icon: Users },
    ],
  },
  {
    label: "Site Data",
    items: [
      { href: "/admin/institutions", label: "Institutions", icon: School },
      { href: "/admin/departments", label: "Departments", icon: BookOpen },
      { href: "/admin/courses", label: "Courses", icon: GraduationCap },
      { href: "/admin/levels", label: "Levels", icon: Layers },
      { href: "/admin/study-modes", label: "Study Modes", icon: Layers },
      { href: "/admin/semesters", label: "Semesters", icon: CalendarDays },
    ],
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <Image
            src="/images/logo.jpg"
            alt="SparkL"
            width={28}
            height={28}
            className="rounded-full"
          />
          <span className="font-bold text-slate-900">Admin</span>
        </div>

        <button onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? (
            <X size={24} className="text-slate-700" />
          ) : (
            <Menu size={24} className="text-slate-700" />
          )}
        </button>
      </div>

      <div className="mx-auto flex max-w-[1500px]">
        {/* Sidebar */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-40 w-64 transform overflow-y-auto border-r border-slate-200
            bg-white transition-transform duration-200 ease-in-out
            lg:static lg:translate-x-0
            ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          `}
        >
          <div className="flex h-full flex-col justify-between p-5">
            <div>
              <Link
                href="/admin"
                className="mb-8 hidden items-center gap-2 lg:flex"
              >
                <Image
                  src="/images/logo.jpg"
                  alt="SparkL"
                  width={32}
                  height={32}
                  className="rounded-full"
                />
                <div>
                  <span className="block text-lg font-bold leading-tight text-slate-900">
                    SparkL
                  </span>
                  <span className="block text-xs font-medium text-slate-400">
                    Admin Panel
                  </span>
                </div>
              </Link>

              <nav className="space-y-5">
                {navGroups.map((group) => (
                  <div key={group.label}>
                    <p className="px-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {group.label}
                    </p>
                    <div className="mt-2 space-y-1">
                      {group.items.map((item) => {
                        const active =
                          pathname === item.href ||
                          (item.href !== "/admin" &&
                            pathname?.startsWith(item.href));

                        const Icon = item.icon;

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className={`
                              flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium
                              transition
                              ${
                                active
                                  ? "bg-blue-50 text-blue-600"
                                  : "text-slate-600 hover:bg-slate-50"
                              }
                            `}
                          >
                            <Icon size={18} />
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>
            </div>

            <div className="space-y-1">
              <Link
                href="/dashboard"
                className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50"
              >
                <LayoutDashboard size={18} />
                Back to Student View
              </Link>

              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-60"
              >
                <LogOut size={18} />
                {loggingOut ? "Logging out..." : "Log Out"}
              </button>
            </div>
          </div>
        </aside>

        {mobileOpen && (
          <div
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          />
        )}

        <main className="min-h-screen flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}