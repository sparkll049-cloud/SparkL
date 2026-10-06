"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X, Plus, Check, Loader2 } from "lucide-react";

interface Option {
  id: string;
  name: string;
  department?: string;
  institution?: string;
}

interface Props {
  value: string[];
  onChange: (value: string[]) => void;
  options: Option[];           // courses from selected department
  searchResults: Option[];     // courses from cross-dept search
  searchLoading: boolean;
  onSearch: (q: string) => void;
  disabled?: boolean;
}

export default function CourseMultiSelect({
  value,
  onChange,
  options,
  searchResults,
  searchLoading,
  onSearch,
  disabled,
}: Props) {
  const [query,       setQuery]       = useState("");
  const [showSearch,  setShowSearch]  = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  function addFromSearch(course: Option) {
    if (!value.includes(course.id)) onChange([...value, course.id]);
  }

  function remove(id: string) {
    onChange(value.filter((v) => v !== id));
  }

  function handleSearchInput(q: string) {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSearch(q), 350);
  }

  // All known courses — dept list + search results merged
  const allKnown: Option[] = [
    ...options,
    ...searchResults.filter((s) => !options.some((o) => o.id === s.id)),
  ];

  const selectedCourses = value
    .map((id) => allKnown.find((c) => c.id === id))
    .filter(Boolean) as Option[];

  // Dept courses filtered by inline query if not in search mode
  const deptFiltered = options.filter((o) =>
    !query || o.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-semibold text-slate-800">
          Courses
          {value.length > 0 && (
            <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
              {value.length} selected
            </span>
          )}
        </label>
        <button
          type="button"
          onClick={() => { setShowSearch((p) => !p); setQuery(""); onSearch(""); }}
          className="flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
        >
          <Search className="h-3 w-3" />
          Search all departments
        </button>
      </div>

      {/* Selected chips */}
      {selectedCourses.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {selectedCourses.map((c) => (
            <span
              key={c.id}
              className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800"
            >
              {c.name}
              <button
                type="button"
                onClick={() => remove(c.id)}
                className="rounded-full hover:bg-blue-200 transition p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Cross-department search panel */}
      {showSearch && (
        <div className="mb-3 rounded-2xl border border-blue-200 bg-blue-50/50 p-3">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="Search any course across all departments…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-700 outline-none focus:border-blue-400"
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(""); onSearch(""); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {searchLoading && (
            <div className="flex items-center gap-2 py-3 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
            </div>
          )}

          {!searchLoading && query && searchResults.length === 0 && (
            <p className="py-3 text-xs text-slate-400">No courses found for &ldquo;{query}&rdquo;</p>
          )}

          {!searchLoading && searchResults.length > 0 && (
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {searchResults.map((c) => {
                const selected = value.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selected ? remove(c.id) : addFromSearch(c)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition ${
                      selected ? "bg-blue-100" : "hover:bg-white"
                    }`}
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                      selected ? "border-blue-600 bg-blue-600" : "border-slate-300"
                    }`}>
                      {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">{c.name}</span>
                      {(c.department || c.institution) && (
                        <span className="block truncate text-[10px] text-slate-400">
                          {[c.department, c.institution].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </span>
                    {!selected && <Plus className="h-3.5 w-3.5 shrink-0 text-blue-500" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Department courses list */}
      <div className={`rounded-2xl border border-slate-200 bg-white p-3 ${disabled ? "opacity-60" : ""}`}>
        {disabled ? (
          <p className="px-1 py-2 text-sm text-slate-400">Select a department first</p>
        ) : options.length === 0 ? (
          <p className="px-1 py-2 text-sm text-slate-400">No courses available for this department</p>
        ) : (
          <>
            {/* Inline filter when search panel is closed */}
            {!showSearch && (
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-300" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter department courses…"
                  className="w-full rounded-lg border border-slate-100 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-600 outline-none focus:border-blue-300"
                />
              </div>
            )}
            <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
              {deptFiltered.length === 0 ? (
                <p className="px-1 py-2 text-xs text-slate-400">No matches</p>
              ) : (
                deptFiltered.map((opt) => (
                  <label
                    key={opt.id}
                    className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={value.includes(opt.id)}
                      onChange={() => toggle(opt.id)}
                      disabled={disabled}
                      className="h-4 w-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
                    />
                    <span className="text-sm text-slate-700">{opt.name}</span>
                  </label>
                ))
              )}
            </div>
          </>
        )}
      </div>

      <p className="mt-1.5 text-[11px] text-slate-400">
        You can add courses from any department using &ldquo;Search all departments&rdquo; above.
      </p>
    </div>
  );
}