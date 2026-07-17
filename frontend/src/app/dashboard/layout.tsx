"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  BookOpen,
  Upload,
  User,
  LogOut,
  Menu,
  X,
} from "lucide-react";

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
              disabled={loggingOut}
              className="
                flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium
                text-red-500 transition hover:bg-red-50
                disabled:opacity-60
              "
            >
              <LogOut size={20} />
              {loggingOut ? "Logging out..." : "Log Out"}
            </button>
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
  );
}