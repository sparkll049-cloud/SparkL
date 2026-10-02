"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

const options = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "system", icon: Monitor, label: "Auto" },
] as const;

export function ThemeToggle({
  expanded,
}: {
  expanded?: boolean;
}) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const selectedTheme = options.some(
    (option) => option.value === theme,
  )
    ? theme
    : "system";

  if (!expanded) {
    const currentIndex = options.findIndex(
      (option) => option.value === selectedTheme,
    );

    const current = options[currentIndex];
    const next = options[(currentIndex + 1) % options.length];
    const Icon = current.icon;

    return (
      <button
        type="button"
        onClick={() => setTheme(next.value)}
        title={`Switch to ${next.label} mode`}
        aria-label={`Current theme: ${current.label}. Switch to ${next.label} mode`}
        className="flex w-full items-center justify-center rounded-lg px-2 py-2.5 text-[var(--sp-text-2)] transition hover:bg-[var(--sp-bg-muted)] hover:text-[var(--sp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label="Choose theme"
      className="mx-2 mb-1 flex items-center rounded-lg border border-[var(--sp-border)] bg-[var(--sp-bg-muted)] p-0.5"
    >
      {options.map(({ value, icon: Icon, label }) => (
        <button
          type="button"
          key={value}
          onClick={() => setTheme(value)}
          title={
            value === "system"
              ? "Follow your device theme"
              : `${label} mode`
          }
          aria-pressed={selectedTheme === value}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[10px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            selectedTheme === value
              ? "bg-blue-600 text-white shadow"
              : "text-[var(--sp-text-2)] hover:bg-[var(--sp-bg-card)] hover:text-[var(--sp-text)]"
          }`}
        >
          <Icon className="h-3 w-3" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}
