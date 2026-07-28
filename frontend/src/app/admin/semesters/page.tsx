import LookupTableManager from "../components/LookupTableManager";

export default function SemestersAdminPage() {
  return (
    <LookupTableManager
      table="semesters"
      title="Semesters"
      description="Manage semesters (e.g. First Semester, Second Semester)."
    />
  );
}