"use client";

import { useMemo, useState } from "react";

export function useOnboarding() {
  const [institution, setInstitution] = useState(
    "Yaba College of Technology (YABATECH)"
  );

  const [department, setDepartment] = useState("");
  const [level, setLevel] = useState("");
  const [loading, setLoading] = useState(false);

  const completed = useMemo(() => {
    return (
      Number(!!department) +
      Number(!!level)
    );
  }, [department, level]);

  return {
    institution,
    department,
    level,
    loading,
    completed,
    setInstitution,
    setDepartment,
    setLevel,
    setLoading,
  };
}