import FormSelect from "./FormSelect";

interface Option {
  id: string;
  name: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  disabled?: boolean;
}

export default function CourseSelect({
  value,
  onChange,
  options,
  disabled,
}: Props) {
  return (
    <FormSelect
      label="Course"
      value={value}
      onChange={onChange}
      options={options}
      placeholder="Select Course"
      disabled={disabled}
    />
  );
}