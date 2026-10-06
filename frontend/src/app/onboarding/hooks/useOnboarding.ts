"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";

interface Option {
  id: string;
  name: string;
}

interface SearchOption extends Option {
  department?: string;
  institution?: string;
}

export function useOnboarding() {
  const supabase = createClient();

  const [institutions, setInstitutions] = useState<Option[]>([]);
  const [departments,  setDepartments]  = useState<Option[]>([]);
  const [courses,      setCourses]      = useState<Option[]>([]);
  const [levels,       setLevels]       = useState<Option[]>([]);
  const [studyModes,   setStudyModes]   = useState<Option[]>([]);

  const [institutionId, setInstitutionId] = useState("");
  const [departmentId,  setDepartmentId]  = useState("");
  const [courseIds,     setCourseIds]     = useState<string[]>([]);
  const [levelId,       setLevelId]       = useState("");
  const [studyModeId,   setStudyModeId]   = useState("");

  // cross-dept search
  const [searchResults, setSearchResults] = useState<SearchOption[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [fetching, setFetching] = useState(true);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  // ── initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setFetching(true);
      const [
        { data: inst },
        { data: lvl },
        { data: sm },
      ] = await Promise.all([
        supabase.from("institutions").select("id, name").order("name"),
        supabase.from("levels").select("id, name").order("sort_order"),
        supabase.from("study_modes").select("id, name").order("name"),
      ]);
      setInstitutions(inst ?? []);
      setLevels(lvl ?? []);
      setStudyModes(sm ?? []);
      if (inst && inst.length === 1) setInstitutionId(inst[0].id);
      setFetching(false);
    }
    load();
  }, []);

  // ── departments when institution changes ────────────────────────────────────
  useEffect(() => {
    if (!institutionId) { setDepartments([]); setDepartmentId(""); return; }
    supabase
      .from("departments")
      .select("id, name")
      .eq("institution_id", institutionId)
      .order("name")
      .then(({ data }) => { setDepartments(data ?? []); setDepartmentId(""); });
  }, [institutionId]);

  // ── dept courses when department changes ────────────────────────────────────
  useEffect(() => {
    if (!departmentId) { setCourses([]); setCourseIds([]); return; }
    supabase
      .from("courses")
      .select("id, name")
      .eq("department_id", departmentId)
      .order("name")
      .then(({ data }) => { setCourses(data ?? []); setCourseIds([]); });
  }, [departmentId]);

  // ── cross-dept course search via API ────────────────────────────────────────
  const searchCourses = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/courses/search?q=${encodeURIComponent(q)}&limit=20`,
        { headers: { Authorization: `Bearer ${session.access_token}` } },
      );
      if (res.ok) {
        const json = await res.json();
        setSearchResults(json.courses ?? []);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [supabase]);

  // ── progress ────────────────────────────────────────────────────────────────
  const completed = useMemo(() =>
    Number(!!departmentId) +
    Number(courseIds.length > 0) +
    Number(!!levelId) +
    Number(!!studyModeId),
  [departmentId, courseIds, levelId, studyModeId]);

  // ── submit ──────────────────────────────────────────────────────────────────
  async function submitOnboarding() {
    setError("");
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("You must be logged in."); return false; }

      const { error: upsertErr } = await supabase.from("profiles").upsert({
        id:                   user.id,
        full_name:            user.user_metadata?.full_name ?? null,
        phone:                user.user_metadata?.phone ?? null,
        institution_id:       institutionId,
        department_id:        departmentId,
        level_id:             levelId,
        study_mode_id:        studyModeId,
        onboarding_completed: true,
        updated_at:           new Date().toISOString(),
      });
      if (upsertErr) { setError(upsertErr.message); return false; }

      const { error: delErr } = await supabase
        .from("user_courses").delete().eq("user_id", user.id);
      if (delErr) { setError(delErr.message); return false; }

      if (courseIds.length > 0) {
        const { error: insErr } = await supabase
          .from("user_courses")
          .insert(courseIds.map(course_id => ({ user_id: user.id, course_id })));
        if (insErr) { setError(insErr.message); return false; }
      }

      return true;
    } finally {
      setLoading(false);
    }
  }

  return {
    institutions, departments, courses, levels, studyModes,
    institutionId, departmentId, courseIds, levelId, studyModeId,
    setInstitutionId, setDepartmentId, setCourseIds, setLevelId, setStudyModeId,
    searchResults, searchLoading, searchCourses,
    fetching, loading, error, completed,
    submitOnboarding,
  };
}