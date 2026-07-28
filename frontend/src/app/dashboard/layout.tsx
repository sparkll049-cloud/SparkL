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
} from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { createClient } from "@/utils/supabase/client";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/courses", label: "My Courses", icon: BookOpen },
  { href: "/dashboard/upload", label: "Upload", icon: Upload },
  { href: "/dashboard/profile", label: "Profile", icon: User },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  // Created once per layout mount (not per render) so cached data
  // survives navigation between dashboard pages.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userInfo, setUserInfo] = useState<{
    name: string | null;
    email: string | null;
  }>({ name: null, email: null });

  useEffect(() => {
    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      setUserInfo({ name: null, email: session.user.email ?? null });

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", session.user.id)
        .single();

      setUserInfo((prev) => ({ ...prev, name: profile?.full_name ?? null }));

      try {
        // Reuses the same admin-only endpoint your admin overview page
        // already calls. If this user isn't an admin, the backend should
        // reject it (401/403), which is our real signal — not a guessed
        // column name.
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/admin/overview`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );

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

  return (
    <QueryClientProvider client={queryClient}>
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
            <span className="font-bold text-slate-900">SparkL</span>
          </div>

          <button onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? (
              <X size={24} className="text-slate-700" />
            ) : (
              <Menu size={24} className="text-slate-700" />
            )}
          </button>
        </div>

        <div className="mx-auto flex max-w-[1400px]">
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
                {/* Logo (desktop) */}
                <Link
                  href="/dashboard"
                  className="mb-8 hidden items-center gap-2 lg:flex"
                >
                  <Image
                    src="/images/logo.jpg"
                    alt="SparkL"
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                  <span className="text-lg font-bold text-slate-900">
                    SparkL
                  </span>
                </Link>

                <p className="mb-2 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Menu
                </p>

                <nav className="space-y-1">
                  {navItems.map((item) => {
                    const active =
                      pathname === item.href ||
                      (item.href !== "/dashboard" &&
                        pathname?.startsWith(item.href));

                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`
                          relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium
                          transition
                          ${
                            active
                              ? "bg-blue-50 text-blue-600"
                              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                          }
                        `}
                      >
                        {active && (
                          <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-blue-600" />
                        )}
                        <Icon size={20} />
                        {item.label}
                      </Link>
                    );
                  })}

                  {isAdmin && (
                    <>
                      <div className="my-3 border-t border-slate-100" />
                      <p className="mb-2 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Administration
                      </p>
                      <Link
                        href="/admin"
                        onClick={() => setMobileOpen(false)}
                        className={`
                          relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium
                          transition
                          ${
                            pathname?.startsWith("/admin")
                              ? "bg-blue-50 text-blue-600"
                              : "text-blue-600 hover:bg-blue-50"
                          }
                        `}
                      >
                        {pathname?.startsWith("/admin") && (
                          <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-blue-600" />
                        )}
                        <ShieldCheck size={20} />
                        Admin
                      </Link>
                    </>
                  )}
                </nav>
              </div>

              {/* User card + logout */}
              <div className="space-y-2 border-t border-slate-100 pt-4">
                <Link
                  href="/dashboard/profile"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-slate-50"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">
                    {initial}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {userInfo.name ?? "Student"}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {userInfo.email ?? ""}
                    </p>
                  </div>
                </Link>

                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="
                    flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium
                    text-red-500 transition hover:bg-red-50
                    disabled:opacity-60
                  "
                >
                  {loggingOut ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <LogOut size={20} />
                  )}
                  {loggingOut ? "Logging out..." : "Log Out"}
                </button>
              </div>
            </div>
          </aside>

          {/* Overlay for mobile when sidebar open */}
          {mobileOpen && (
            <div
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-30 bg-black/30 lg:hidden"
            />
          )}

          {/* Main content */}
          <main className="min-h-screen flex-1">{children}</main>
        </div>
      </div>
    </QueryClientProvider>
  );
}
