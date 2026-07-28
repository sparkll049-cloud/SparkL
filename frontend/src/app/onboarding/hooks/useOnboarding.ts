"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";

interface Option {
  id: string;
  name: string;
}

export function useOnboarding() {
  const supabase = createClient();

  const [institutions, setInstitutions] = useState<Option[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [courses, setCourses] = useState<Option[]>([]);
  const [levels, setLevels] = useState<Option[]>([]);
  const [studyModes, setStudyModes] = useState<Option[]>([]);
  const [semesters, setSemesters] = useState<Option[]>([]);

  const [institutionId, setInstitutionId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [levelId, setLevelId] = useState("");
  const [studyModeId, setStudyModeId] = useState("");
  const [semesterId, setSemesterId] = useState("");

  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadInitialData() {
      setFetching(true);

      const [
        { data: institutionsData },
        { data: levelsData },
        { data: studyModesData },
        { data: semestersData },
      ] = await Promise.all([
        supabase.from("institutions").select("id, name").order("name"),
        supabase.from("levels").select("id, name").order("sort_order"),
        supabase.from("study_modes").select("id, name").order("name"),
        supabase.from("semesters").select("id, name").order("name"),
      ]);

      setInstitutions(institutionsData ?? []);
      setLevels(levelsData ?? []);
      setStudyModes(studyModesData ?? []);
      setSemesters(semestersData ?? []);

      if (institutionsData && institutionsData.length === 1) {
        setInstitutionId(institutionsData[0].id);
      }

      setFetching(false);
    }

    loadInitialData();
  }, []);

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

  useEffect(() => {
    if (!departmentId) {
      setCourses([]);
      setCourseIds([]);
      return;
    }

    async function loadCourses() {
      const { data } = await supabase
        .from("courses")
        .select("id, name")
        .eq("department_id", departmentId)
        .order("name");

      setCourses(data ?? []);
      setCourseIds([]);
    }

    loadCourses();
  }, [departmentId]);

  const completed = useMemo(() => {
    return (
      Number(!!departmentId) +
      Number(courseIds.length > 0) +
      Number(!!levelId) +
      Number(!!studyModeId) +
      Number(!!semesterId)
    );
  }, [departmentId, courseIds, levelId, studyModeId, semesterId]);

  async function submitOnboarding() {
    setError("");
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You must be logged in to complete onboarding.");
        return false;
      }

      const { error: upsertError } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: user.user_metadata?.full_name ?? null,
        phone: user.user_metadata?.phone ?? null,
        institution_id: institutionId,
        department_id: departmentId,
        level_id: levelId,
        study_mode_id: studyModeId,
        semester_id: semesterId,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      });

      if (upsertError) {
        setError(upsertError.message);
        return false;
      }

      const { error: deleteError } = await supabase
        .from("user_courses")
        .delete()
        .eq("user_id", user.id);

      if (deleteError) {
        setError(deleteError.message);
        return false;
      }

      if (courseIds.length > 0) {
        const { error: insertError } = await supabase
          .from("user_courses")
          .insert(courseIds.map((course_id) => ({ user_id: user.id, course_id })));

        if (insertError) {
          setError(insertError.message);
          return false;
        }
      }

      return true;
    } finally {
      setLoading(false);
    }
  }

  return {
    institutions,
    departments,
    courses,
    levels,
    studyModes,
    semesters,
    institutionId,
    departmentId,
    courseIds,
    levelId,
    studyModeId,
    semesterId,
    setInstitutionId,
    setDepartmentId,
    setCourseIds,
    setLevelId,
    setStudyModeId,
    setSemesterId,
    fetching,
    loading,
    error,
    completed,
    submitOnboarding,
  };
}