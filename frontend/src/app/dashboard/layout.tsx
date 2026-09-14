"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  BookOpen,
  Upload,
  User,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  Loader2,
  Zap,
} from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/courses", label: "My Courses", icon: BookOpen },
  { href: "/dashboard/upload", label: "Upload", icon: Upload },
  { href: "/dashboard/profile", label: "Profile", icon: User },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: { staleTime: 30_000, gcTime: 5 * 60_000, refetchOnWindowFocus: false },
      },
    })
  );

  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userInfo, setUserInfo] = useState<{ name: string | null; email: string | null }>({
    name: null,
    email: null,
  });

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserInfo({ name: null, email: session.user.email ?? null });

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", session.user.id)
        .single();

      setUserInfo((prev) => ({ ...prev, name: profile?.full_name ?? null }));

      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/overview`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        setIsAdmin(res.ok);
      } catch {
        setIsAdmin(false);
      }
    }
    init();
  }, [supabase]);

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  const initial = (userInfo.name ?? userInfo.email ?? "S").charAt(0).toUpperCase();

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 ${!mobile && !sidebarExpanded ? "justify-center px-0" : ""}`}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#2563EB]">
          <Zap className="h-4 w-4 text-white" fill="white" />
        </div>
        {(mobile || sidebarExpanded) && (
          <span className="text-base font-black tracking-tight text-white">SparkL</span>
        )}
      </div>

      {/* Nav */}
      <nav className="mt-2 flex-1 space-y-0.5 px-2">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              title={!mobile && !sidebarExpanded ? item.label : undefined}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150
                ${!mobile && !sidebarExpanded ? "justify-center px-2.5" : ""}
                ${active
                  ? "bg-[#2563EB]/15 text-[#60A5FA]"
                  : "text-[#64748B] hover:bg-white/[0.05] hover:text-slate-200"
                }`}
            >
              <Icon className={`h-[18px] w-[18px] shrink-0 transition-colors ${active ? "text-[#60A5FA]" : "text-[#475569] group-hover:text-slate-300"}`} />
              {(mobile || sidebarExpanded) && item.label}
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <div className="my-3 mx-1 border-t border-white/[0.06]" />
            <Link
              href="/admin"
              onClick={() => setMobileOpen(false)}
              title={!mobile && !sidebarExpanded ? "Admin" : undefined}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all
                ${!mobile && !sidebarExpanded ? "justify-center px-2.5" : ""}
                ${pathname?.startsWith("/admin")
                  ? "bg-[#2563EB]/15 text-[#60A5FA]"
                  : "text-[#3B82F6] hover:bg-[#2563EB]/10"
                }`}
            >
              <ShieldCheck className="h-[18px] w-[18px] shrink-0" />
              {(mobile || sidebarExpanded) && "Admin"}
            </Link>
          </>
        )}
      </nav>

      {/* User section */}
      <div className={`border-t border-white/[0.06] p-2 space-y-0.5 ${!mobile && !sidebarExpanded ? "px-2" : ""}`}>
        <Link
          href="/dashboard/profile"
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-white/[0.05]
            ${!mobile && !sidebarExpanded ? "justify-center px-2" : ""}`}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1E3A8A] text-xs font-bold text-blue-200">
            {initial}
          </div>
          {(mobile || sidebarExpanded) && (
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-200">{userInfo.name ?? "Student"}</p>
              <p className="truncate text-[10px] text-slate-500">{userInfo.email ?? ""}</p>
            </div>
          )}
        </Link>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          title={!mobile && !sidebarExpanded ? "Log out" : undefined}
          className={`flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium text-[#64748B] transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50
            ${!mobile && !sidebarExpanded ? "justify-center px-2" : ""}`}
        >
          {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4 shrink-0" />}
          {(mobile || sidebarExpanded) && (loggingOut ? "Logging out…" : "Log out")}
        </button>
      </div>
    </div>
  );

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen bg-[#07091A]">

        {/* ── Desktop sidebar (icon-only, expands on hover) ── */}
        <aside
          onMouseEnter={() => setSidebarExpanded(true)}
          onMouseLeave={() => setSidebarExpanded(false)}
          className={`
            hidden lg:flex flex-col fixed inset-y-0 left-0 z-30
            border-r border-white/[0.05] bg-[#0D1230]
            transition-all duration-200 ease-out
            ${sidebarExpanded ? "w-52" : "w-14"}
          `}
        >
          <SidebarContent />
        </aside>

        {/* ── Mobile floating menu button ── */}
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed bottom-6 left-4 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-[#2563EB] shadow-lg transition hover:bg-blue-500 lg:hidden"
        >
          <Menu className="h-5 w-5 text-white" />
        </button>

        {/* ── Mobile drawer ── */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <aside className="absolute inset-y-0 left-0 w-60 border-r border-white/[0.06] bg-[#0D1230]">
              <SidebarContent mobile />
            </aside>
          </div>
        )}

        {/* ── Main area ── */}
        <div className={`flex flex-1 flex-col transition-all duration-200 ${sidebarExpanded ? "lg:ml-52" : "lg:ml-14"}`}>
          <main className="flex-1">{children}</main>
        </div>

      </div>
    </QueryClientProvider>
  );
}