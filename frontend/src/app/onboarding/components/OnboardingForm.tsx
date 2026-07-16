"use client";

import { Loader2, GraduationCap } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import ProgressIndicator from "./ProgressIndicator";
import InstitutionSelect from "./InstitutionSelect";
import DepartmentSelect from "./DepartmentSelect";
import LevelSelect from "./LevelSelect";

import { useOnboarding } from "../hooks/useOnboarding";

export default function OnboardingForm() {
  const router = useRouter();

  const {
    institution,
    department,
    level,
    loading,
    completed,
    setDepartment,
    setLevel,
    setLoading,
  } = useOnboarding();

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setLoading(true);

    try {
      await new Promise((resolve) =>
        setTimeout(resolve, 1500)
      );

      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="
        relative
        w-full
        max-w-[620px]

        /* Smaller card */
        rounded-[30px]

        bg-white

        /* Reduced padding */
        p-5
        md:p-7

        shadow-xl
      "
    >
      {/* ===================================================
          SPARKL LOGO
          Replaces the HandHelping icon
      =================================================== */}
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

      {/* Reduced spacing */}
      <div className="space-y-6">
        <ProgressIndicator
          completed={completed}
          total={2}
        />

        {/* ===================================================
            HEADING SECTION
        =================================================== */}
        <div>
          <div className="flex items-center gap-3">
            <h1
              className="
                text-2xl
                md:text-3xl
                font-bold
              "
            >
              Welcome to Sparkl
            </h1>

            {/* Graduation Icon */}
            <GraduationCap
              size={40}
              className="text-[#2563EB]"
            />
          </div>

          <p className="mt-2 text-sm text-slate-500">
            Complete your profile to personalize
            your experience.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          <InstitutionSelect
            value={institution}
          />

          <DepartmentSelect
            value={department}
            onChange={setDepartment}
          />

          <LevelSelect
            value={level}
            onChange={setLevel}
          />

          <button
            type="submit"
            disabled={
              !department ||
              !level ||
              loading
            }
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

              /* Slightly shorter button */
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

            {loading
              ? "Completing Setup..."
              : "Complete Setup"}
          </button>
        </form>
      </div>
    </div>
  );
}