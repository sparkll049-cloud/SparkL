"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  FileText,
  School,
  report,
  BookOpen,
  GraduationCap,
  Layers,
  CalendarDays,
  LogOut,
  Menu,
  Loader2,
  ChevronLeft,
  ShieldCheck,
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
      { href: "/admin/reports", label: "Levels", icon: report },
      { href: "/admin/semesters", label: "Semesters", icon: CalendarDays },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let active = true;
    async function verifyAdmin() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/auth/login"); return; }
      const { data: profile, error } = await supabase
        .from("profiles").select("is_admin").eq("id", session.user.id).single();
      if (error || !profile?.is_admin) { router.replace("/dashboard"); return; }
      if (active) setAuthChecked(true);
    }
    verifyAdmin();
    return () => { active = false; };
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07091A]">
        <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#07091A]">

      {/* ── Sidebar ── */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 flex w-60 flex-col
        border-r border-white/[0.05] bg-[#0D1230]
        transition-transform duration-200
        lg:translate-x-0
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-white/[0.05] px-5 py-4">
          <Image src="/images/logo.jpg" alt="SparkL" width={30} height={30} className="rounded-lg object-contain" />
          <div>
            <p className="text-sm font-black tracking-tight text-white">SparkL</p>
            <p className="flex items-center gap-1 text-[10px] font-medium text-blue-400">
              <ShieldCheck className="h-3 w-3" /> Admin Panel
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href || (item.href !== "/admin" && pathname?.startsWith(item.href));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all
                        ${active
                          ? "bg-[#2563EB]/15 text-[#60A5FA]"
                          : "text-[#64748B] hover:bg-white/[0.05] hover:text-slate-200"
                        }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-[#60A5FA]" : "text-[#475569]"}`} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="border-t border-white/[0.05] p-3 space-y-0.5">
          <Link
            href="/dashboard"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-white/[0.05] hover:text-slate-300"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" />
            Student View
          </Link>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
          >
            {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4 shrink-0" />}
            {loggingOut ? "Logging out…" : "Log out"}
          </button>
        </div>
      </aside>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed bottom-6 left-4 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-[#2563EB] shadow-lg transition hover:bg-blue-500 lg:hidden"
      >
        <Menu className="h-5 w-5 text-white" />
      </button>

      {/* Main */}
      <div className="flex flex-1 flex-col lg:ml-60">
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
