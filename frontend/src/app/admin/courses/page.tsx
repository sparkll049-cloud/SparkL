import LookupTableManager from "../components/LookupTableManager";

export default function CoursesAdminPage() {
  return (
    <LookupTableManager
      table="courses"
      title="Courses"
      description="Manage courses, each linked to a department."
      extraFields={[
        {
          key: "department_id",
          label: "Department",
          type: "select",
          optionsTable: "departments",
        },
      ]}
    />
  );
}