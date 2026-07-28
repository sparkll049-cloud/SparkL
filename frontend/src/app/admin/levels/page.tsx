import LookupTableManager from "../components/LookupTableManager";

export default function LevelsAdminPage() {
  return (
    <LookupTableManager
      table="levels"
      title="Levels"
      description="Manage academic levels (e.g. ND1, ND2, HND1, HND2)."
    />
  );
}