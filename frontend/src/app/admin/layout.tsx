"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  School,
  BookOpen,
  GraduationCap,
  Layers,
  FileText,
  Users,
  LogOut,
  Menu,
  X,
  Loader2,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";

const navItems = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/institutions", label: "Institutions", icon: School },
  { href: "/admin/departments", label: "Departments", icon: BookOpen },
  { href: "/admin/courses", label: "Courses", icon: GraduationCap },
  { href: "/admin/levels", label: "Levels", icon: Layers },
  { href: "/admin/study-modes", label: "Study Modes", icon: Layers },
  { href: "/admin/questions", label: "Past Questions", icon: FileText },
  { href: "/admin/users", label: "Users", icon: Users },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    async function checkAdmin() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (!profile?.is_admin) {
        router.push("/dashboard");
        return;
      }

      setAuthorized(true);
      setChecking(false);
    }

    checkAdmin();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!authorized) return null;

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
          <span className="font-bold text-slate-900">SparkL Admin</span>
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
            fixed inset-y-0 left-0 z-40 w-64 transform border-r border-slate-200
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
                  <p className="text-lg font-bold leading-tight text-slate-900">
                    SparkL
                  </p>
                  <p className="text-xs font-medium text-blue-600">Admin</p>
                </div>
              </Link>

              <nav className="space-y-1">
                {navItems.map((item) => {
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
                        flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium
                        transition
                        ${
                          active
                            ? "bg-blue-50 text-blue-600"
                            : "text-slate-600 hover:bg-slate-50"
                        }
                      `}
                    >
                      <Icon size={20} />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <button
              onClick={handleLogout}
              className="
                flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium
                text-red-500 transition hover:bg-red-50
              "
            >
              <LogOut size={20} />
              Log Out
            </button>
          </div>
        </aside>

        {mobileOpen && (
          <div
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          />
        )}

        <main className="min-h-screen flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}