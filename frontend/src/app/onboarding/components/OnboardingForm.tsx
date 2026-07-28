"use client";

import { Loader2, GraduationCap } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import ProgressIndicator from "./ProgressIndicator";
import InstitutionSelect from "./InstitutionSelect";
import DepartmentSelect from "./DepartmentSelect";
import CourseMultiSelect from "./CourseMultiSelect";
import LevelSelect from "./LevelSelect";
import StudyModeSelect from "./StudyModeSelect";
import SemesterSelect from "./SemesterSelect";

import { useOnboarding } from "../hooks/useOnboarding";

export default function OnboardingForm() {
  const router = useRouter();

  const {
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
  } = useOnboarding();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const success = await submitOnboarding();

    if (success) {
      router.push("/dashboard");
    }
  }

  const formValid =
    institutionId &&
    departmentId &&
    courseIds.length > 0 &&
    levelId &&
    studyModeId &&
    semesterId;

  return (
    <div
      className="
        relative
        w-full
        max-w-[620px]
        rounded-[30px]
        bg-white
        p-5
        md:p-7
        shadow-xl
      "
    >
      <div
        className="
          absolute
          -top-7
          left-1/2
          flex
          h-15
          w-15
          -translate-x-1/2
          items-center
          justify-center
          rounded-full
          bg-white
          shadow-lg
          border
          border-slate-100
        "
      >
        <Image
          src="/images/logo.jpg"
          alt="SparkL Logo"
          width={27}
          height={27}
        />
      </div>

      <div className="space-y-6">
        <ProgressIndicator completed={completed} total={5} />

        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold">
              Welcome to Sparkl
            </h1>

            <GraduationCap size={40} className="text-[#2563EB]" />
          </div>

          <p className="mt-2 text-sm text-slate-500">
            Complete your profile to personalize your experience.
          </p>
        </div>

        {fetching ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-[#2563EB]" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <InstitutionSelect
              value={institutionId}
              onChange={setInstitutionId}
              options={institutions}
            />

            <DepartmentSelect
              value={departmentId}
              onChange={setDepartmentId}
              options={departments}
              disabled={!institutionId}
            />

            <CourseMultiSelect
              value={courseIds}
              onChange={setCourseIds}
              options={courses}
              disabled={!departmentId}
            />

            <LevelSelect
              value={levelId}
              onChange={setLevelId}
              options={levels}
            />

            <StudyModeSelect
              value={studyModeId}
              onChange={setStudyModeId}
              options={studyModes}
            />

            <SemesterSelect
              value={semesterId}
              onChange={setSemesterId}
              options={semesters}
            />

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <button
              type="submit"
              disabled={!formValid || loading}
              className="
                flex
                w-full
                items-center
                justify-center
                gap-3
                rounded-full
                bg-gradient-to-r
                from-[#1D4ED8]
                to-[#0EA5E9]
                py-3
                text-sm
                md:text-base
                font-semibold
                text-white
                transition
                hover:opacity-90
                disabled:opacity-60
              "
            >
              {loading && (
                <Loader2 className="h-5 w-5 animate-spin" />
              )}

              {loading ? "Completing Setup..." : "Complete Setup"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}