"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, FileText, School,
  BookOpen, GraduationCap, CalendarDays, LogOut,
  Menu, Loader2, ChevronLeft, ShieldCheck, X, ChevronRight,
  MessageSquare,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";

type NavItem = {
  href:   string;
  label:  string;
  icon:   React.ElementType;
  roles?: string[];
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const ALL_NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Moderation",
    items: [
      { href: "/admin/questions", label: "Past Questions",       icon: FileText,      roles: ["moderator", "content_manager"] },
      { href: "/admin/answers",   label: "Answer Submissions",   icon: MessageSquare, roles: ["moderator", "content_manager"] },
      { href: "/admin/users",     label: "Users",                icon: Users,         roles: [] },
    ],
  },
  {
    label: "Site Data",
    items: [
      { href: "/admin/institutions", label: "Institutions", icon: School,        roles: ["content_manager"] },
      { href: "/admin/departments",  label: "Departments",  icon: BookOpen,      roles: ["content_manager"] },
      { href: "/admin/courses",      label: "Courses",      icon: GraduationCap, roles: ["content_manager"] },
      { href: "/admin/semesters",    label: "Semesters",    icon: CalendarDays,  roles: ["content_manager"] },
      { href: "/admin/reports",      label: "Reports",      icon: ShieldCheck },
    ],
  },
];

function buildNav(role: string | null): NavGroup[] {
  if (!role) return [];
  if (role === "super_admin") return ALL_NAV;

  return ALL_NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (!item.roles) return true;
      if (item.roles.length === 0) return false;
      return item.roles.includes(role);
    }),
  })).filter((group) => group.items.length > 0);
}

const ROLE_META: Record<string, { label: string; color: string }> = {
  moderator:       { label: "Moderator",       color: "#0EA5E9" },
  content_manager: { label: "Content Manager", color: "#8B5CF6" },
  super_admin:     { label: "Super Admin",     color: "#EF4444" },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AdminShell>{children}</AdminShell>
    </ThemeProvider>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [supabase]    = useState(() => createClient());
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [loggingOut,  setLoggingOut]  = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [adminRole,   setAdminRole]   = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function verifyAdmin() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!active) return;
        if (!session) { router.replace("/auth/login"); return; }

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("is_admin, admin_role")
          .eq("id", session.user.id)
          .single();

        if (!active) return;
        if (error || !profile?.is_admin) { router.replace("/dashboard"); return; }

        setAdminRole(profile.admin_role ?? null);
        setAuthChecked(true);
      } catch {
        if (active) router.replace("/dashboard");
      }
    }
    void verifyAdmin();
    return () => { active = false; };
  }, [supabase, router]);

  useEffect(() => {
    if (!authChecked || adminRole === "super_admin") return;
    const nav = buildNav(adminRole);
    const allAllowedHrefs = nav.flatMap((g) => g.items.map((i) => i.href));
    const allowed = allAllowedHrefs.some((href) =>
      href === "/admin" ? pathname === href : pathname.startsWith(href),
    );
    if (!allowed) router.replace("/admin");
  }, [authChecked, adminRole, pathname, router]);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [mobileOpen]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
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
      <div className="flex min-h-screen items-center justify-center"
        style={{ background: "var(--sp-bg)", color: "var(--sp-text)" }}>
        <Loader2 className="h-7 w-7 animate-spin text-red-500" />
      </div>
    );
  }

  const isActive = (href: string) =>
    href === "/admin" ? pathname === href : pathname.startsWith(`${href}/`) || pathname === href;

  const navGroups = buildNav(adminRole);
  const roleMeta  = ROLE_META[adminRole ?? ""] ?? { label: "Admin", color: "#EF4444" };

  const SidebarContent = () => (
    <div className="flex h-full flex-col"
      style={{ background: "var(--sp-bg-card)", borderRight: "1px solid var(--sp-border)" }}>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: "var(--sp-border)" }}>
        <div className="flex items-center gap-2.5">
          <Image alt="SparkL" src="/images/logo.jpg" width={30} height={30}
            className="rounded-xl object-cover shadow-md" />
          <div>
            <p className="text-sm font-black tracking-tight" style={{ color: "var(--sp-text)" }}>SparkL</p>
            <p className="flex items-center gap-1 text-[10px] font-bold"
              style={{ color: roleMeta.color }}>
              <ShieldCheck className="h-3 w-3" />
              {roleMeta.label}
            </p>
          </div>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
          className="flex h-8 w-8 items-center justify-center rounded-xl border transition hover:bg-red-500/10 lg:hidden"
          style={{ borderColor: "var(--sp-border)" }}
        >
          <X className="h-4 w-4" style={{ color: "var(--sp-text-3)" }} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1 text-[9px] font-black uppercase tracking-widest"
              style={{ color: "var(--sp-text-3)" }}>
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all"
                    style={{
                      background: active ? "rgba(239,68,68,0.10)" : "transparent",
                      color:      active ? "#EF4444"              : "var(--sp-text-2)",
                      borderLeft: active ? "3px solid #EF4444"    : "3px solid transparent",
                    }}
                  >
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-lg"
                      style={{ background: active ? "rgba(239,68,68,0.15)" : "var(--sp-ring-track)" }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    {label}
                    {active && <ChevronRight className="ml-auto h-3 w-3" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t px-4 py-4 space-y-2" style={{ borderColor: "var(--sp-border)" }}>
        <ThemeToggle expanded />

        <Link
          href="/dashboard"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all hover:border-indigo-500/30"
          style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-2)", background: "var(--sp-bg)" }}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ background: "var(--sp-ring-track)" }}>
            <ChevronLeft className="h-3.5 w-3.5 text-indigo-400" />
          </span>
          Student View
        </Link>

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all hover:border-red-500/30 hover:bg-red-500/5 disabled:opacity-50"
          style={{ borderColor: "var(--sp-border)", color: "#EF4444" }}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10">
            {loggingOut
              ? <Loader2 className="h-3.5 w-3.5 animate-spin text-red-500" />
              : <LogOut  className="h-3.5 w-3.5 text-red-500" />}
          </span>
          {loggingOut ? "Logging out…" : "Log out"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen transition-colors duration-300"
      style={{ background: "var(--sp-bg)", color: "var(--sp-text)" }}>

      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-64 lg:flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden"
        style={{ opacity: mobileOpen ? 1 : 0, pointerEvents: mobileOpen ? "auto" : "none" }}
        onClick={() => setMobileOpen(false)}
      />

      {/* Mobile drawer */}
      <aside
        id="admin-navigation"
        aria-label="Admin navigation"
        className="fixed inset-y-0 left-0 z-[81] flex w-64 flex-col shadow-2xl transition-transform duration-300 ease-out lg:hidden"
        style={{ transform: mobileOpen ? "translateX(0)" : "translateX(-100%)" }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile menu button */}
      {!mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          aria-controls="admin-navigation"
          aria-expanded={mobileOpen}
          className="fixed bottom-6 left-4 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition hover:bg-red-500 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col lg:ml-64">
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
