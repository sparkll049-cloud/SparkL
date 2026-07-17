import LookupTableManager from "../components/LookupTableManager";

export default function DepartmentsAdminPage() {
  return (
    <LookupTableManager
      table="departments"
      title="Departments"
      description="Manage departments, each linked to an institution."
      extraFields={[
        {
          key: "institution_id",
          label: "Institution",
          type: "select",
          optionsTable: "institutions",
        },
      ]}
    />
  );
}