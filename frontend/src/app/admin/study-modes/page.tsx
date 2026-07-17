import LookupTableManager from "../components/LookupTableManager";

export default function StudyModesAdminPage() {
  return (
    <LookupTableManager
      table="study_modes"
      title="Study Modes"
      description="Manage study modes (e.g. Full-time, Part-time)."
    />
  );
}