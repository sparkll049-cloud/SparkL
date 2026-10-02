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
  BookOpen,
  GraduationCap,
  CalendarDays,
  LogOut,
  Menu,
  Loader2,
  ChevronLeft,
  ShieldCheck,
  X,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";

const navGroups = [
  {
    label: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    ],
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
      { href: "/admin/semesters", label: "Semesters", icon: CalendarDays },
      { href: "/admin/reports", label: "Reports", icon: ShieldCheck },
    ],
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <AdminShell>{children}</AdminShell>
    </ThemeProvider>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let active = true;

    async function verifyAdmin() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!active) return;

        if (!session) {
          router.replace("/auth/login");
          return;
        }

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", session.user.id)
          .single();

        if (!active) return;

        if (error || !profile?.is_admin) {
          router.replace("/dashboard");
          return;
        }

        setAuthChecked(true);
      } catch {
        if (active) router.replace("/dashboard");
      }
    }

    void verifyAdmin();

    return () => {
      active = false;
    };
  }, [supabase, router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen]);

  async function handleLogout() {
    setLoggingOut(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (!error) router.push("/auth/login");
    } finally {
      setLoggingOut(false);
    }
  }

  if (!authChecked) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{
          background: "var(--sp-bg)",
          color: "var(--sp-text)",
        }}
      >
        <Loader2
          className="h-7 w-7 animate-spin text-blue-500"
          aria-label="Checking admin access"
        />
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen transition-colors duration-300"
      style={{
        background: "var(--sp-bg)",
        color: "var(--sp-text)",
      }}
    >
      {/* Sidebar */}
      <aside
        id="admin-navigation"
        aria-label="Admin navigation"
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col
          border-r transition-transform duration-200 lg:translate-x-0
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{
          background: "var(--sp-search-popup)",
          borderColor: "var(--sp-border)",
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-3 border-b px-5 py-4"
          style={{ borderColor: "var(--sp-border)" }}
        >
          <Image
            src="/images/logo.jpg"
            alt="SparkL"
            width={30}
            height={30}
            className="rounded-lg object-contain"
          />

          <div>
            <p
              className="text-sm font-black tracking-tight"
              style={{ color: "var(--sp-text)" }}
            >
              SparkL
            </p>
            <p className="flex items-center gap-1 text-[10px] font-medium text-blue-500">
              <ShieldCheck className="h-3 w-3" />
              Admin Panel
            </p>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
            className="ml-auto rounded-lg p-2 text-[var(--sp-text-2)] transition hover:bg-[var(--sp-bg-muted)] lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p
                className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: "var(--sp-text-2)" }}
              >
                {group.label}
              </p>

              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== "/admin" &&
                      pathname.startsWith(`${item.href}/`));

                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
                        ${
                          active
                            ? "bg-blue-500/10 text-blue-500"
                            : "text-[var(--sp-text-2)] hover:bg-[var(--sp-bg-muted)] hover:text-[var(--sp-text)]"
                        }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom actions */}
        <div
          className="space-y-0.5 border-t p-3"
          style={{ borderColor: "var(--sp-border)" }}
        >
          <ThemeToggle expanded />

          <Link
            href="/dashboard"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--sp-text-2)] transition hover:bg-[var(--sp-bg-muted)] hover:text-[var(--sp-text)]"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" />
            Student View
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--sp-text-2)] transition hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
          >
            {loggingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4 shrink-0" />
            )}
            {loggingOut ? "Logging out…" : "Log out"}
          </button>
        </div>
      </aside>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 h-full w-full bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile menu button */}
      {!mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          aria-controls="admin-navigation"
          aria-expanded={mobileOpen}
          className="fixed bottom-6 left-4 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition hover:bg-blue-500 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col lg:ml-60">
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}