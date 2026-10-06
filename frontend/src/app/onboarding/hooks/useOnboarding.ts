"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";

interface Option {
  id: string;
  name: string;
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

  // Cross-department course search
  const [courseSearch,        setCourseSearch]        = useState("");
  const [searchResults,       setSearchResults]       = useState<Option[]>([]);
  const [searchLoading,       setSearchLoading]       = useState(false);

  const [fetching, setFetching] = useState(true);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  // ── Initial data load ──────────────────────────────────────────────────────
  useEffect(() => {
    async function loadInitialData() {
      setFetching(true);
      const [
        { data: institutionsData },
        { data: levelsData },
        { data: studyModesData },
      ] = await Promise.all([
        supabase.from("institutions").select("id, name").order("name"),
        supabase.from("levels").select("id, name").order("sort_order"),
        supabase.from("study_modes").select("id, name").order("name"),
      ]);

      setInstitutions(institutionsData ?? []);
      setLevels(levelsData ?? []);
      setStudyModes(studyModesData ?? []);

      if (institutionsData?.length === 1) {
        setInstitutionId(institutionsData[0].id);
      }
      setFetching(false);
    }
    loadInitialData();
  }, []);

  // ── Load departments when institution changes ──────────────────────────────
  useEffect(() => {
    if (!institutionId) {
      setDepartments([]);
      setDepartmentId("");
      return;
    }
    async function loadDepartments() {
      const { data } = await supabase
        .from("departments")
        .select("id, name")
        .eq("institution_id", institutionId)
        .order("name");
      setDepartments(data ?? []);
      setDepartmentId("");
    }
    loadDepartments();
  }, [institutionId]);

  // ── Load courses for selected department ───────────────────────────────────
  useEffect(() => {
    if (!departmentId) {
      setCourses([]);
      return;
    }
    async function loadCourses() {
      // Load courses directly in this department
      const { data: directCourses } = await supabase
        .from("courses")
        .select("id, name")
        .eq("department_id", departmentId)
        .order("name");

      // Also load courses linked via course_departments junction
      const { data: linkedRows } = await supabase
        .from("course_departments")
        .select("course_id, courses(id, name)")
        .eq("department_id", departmentId);

      const linked: Option[] = (linkedRows ?? [])
        .map((r: any) => r.courses)
        .filter(Boolean)
        .map((c: any) => ({ id: c.id, name: c.name }));

      // Merge, deduplicate by id
      const all = [...(directCourses ?? []), ...linked];
      const seen = new Set<string>();
      const deduped = all.filter((c) => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });

      deduped.sort((a, b) => a.name.localeCompare(b.name));
      setCourses(deduped);
    }
    loadCourses();
  }, [departmentId]);

  // ── Cross-department course search ─────────────────────────────────────────
  const searchCourses = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const { data } = await supabase
        .from("courses")
        .select(`
          id,
          name,
          departments(name),
          institutions(name)
        `)
        .ilike("name", `%${trimmed}%`)
        .order("name")
        .limit(30);

      const results: Option[] = (data ?? []).map((c: any) => ({
        id:          c.id,
        name:        c.name,
        department:  c.departments?.name ?? undefined,
        institution: c.institutions?.name ?? undefined,
      }));
      setSearchResults(results);
    } finally {
      setSearchLoading(false);
    }
  }, [supabase]);

  // ── Progress ───────────────────────────────────────────────────────────────
  const completed = useMemo(() => (
    Number(!!departmentId) +
    Number(courseIds.length > 0) +
    Number(!!levelId) +
    Number(!!studyModeId)
  ), [departmentId, courseIds, levelId, studyModeId]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function submitOnboarding() {
    setError("");
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("You must be logged in to complete onboarding."); return false; }

      const { error: upsertError } = await supabase.from("profiles").upsert({
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
      if (upsertError) { setError(upsertError.message); return false; }

      // Replace user_courses
      const { error: deleteError } = await supabase
        .from("user_courses").delete().eq("user_id", user.id);
      if (deleteError) { setError(deleteError.message); return false; }

      if (courseIds.length > 0) {
        const { error: insertError } = await supabase
          .from("user_courses")
          .insert(courseIds.map((course_id) => ({ user_id: user.id, course_id })));
        if (insertError) { setError(insertError.message); return false; }
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
    courseSearch, setCourseSearch,
    searchResults, searchLoading, searchCourses,
    fetching, loading, error, completed,
    submitOnboarding,
  };
}