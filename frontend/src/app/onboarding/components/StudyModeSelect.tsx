import FormSelect from "./FormSelect";

interface Option {
  id: string;
  name: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
}

export default function StudyModeSelect({
  value,
  onChange,
  options,
}: Props) {
  return (
    <FormSelect
      label="Study Mode"
      value={value}
      onChange={onChange}
      options={options}
      placeholder="Select Full-time or Part-time"
    />
  );
}