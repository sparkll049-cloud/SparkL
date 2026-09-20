"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

export function ThemeToggle({ expanded }: { expanded?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const options = [
    { value: "light", icon: Sun,     label: "Light"  },
    { value: "dark",  icon: Moon,    label: "Dark"   },
    { value: "system",icon: Monitor, label: "Auto"   },
  ] as const;

  if (!expanded) {
    // Icon-only: cycle through modes
    const current = options.find(o => o.value === theme) ?? options[2];
    const Icon = current.icon;
    const next = options[(options.findIndex(o => o.value === theme) + 1) % 3];
    return (
      <button
        onClick={() => setTheme(next.value)}
        title={`Switch to ${next.label} mode`}
        className="flex w-full items-center justify-center rounded-lg px-2 py-2.5 text-[#64748B] transition hover:bg-white/[0.05] hover:text-slate-300"
      >
        <Icon className="h-4 w-4" />
      </button>
    );
  }

  // Expanded: pill switcher
  return (
    <div className="mx-2 mb-1 flex items-center rounded-lg border border-white/[0.06] bg-white/[0.03] p-0.5">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          title={label}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[10px] font-semibold transition-all
            ${theme === value
              ? "bg-[#2563EB] text-white shadow"
              : "text-[#64748B] hover:text-slate-300"
            }`}
        >
          <Icon className="h-3 w-3" />
          {label}
        </button>
      ))}
    </div>
  );
}