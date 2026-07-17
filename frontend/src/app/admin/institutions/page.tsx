import LookupTableManager from "../components/LookupTableManager";

export default function InstitutionsAdminPage() {
  return (
    <LookupTableManager
      table="institutions"
      title="Institutions"
      description="Manage the list of tertiary institutions available on SparkL."
    />
  );
}