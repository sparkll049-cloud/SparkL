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

export default function LevelSelect({
  value,
  onChange,
  options,
}: Props) {
  return (
    <FormSelect
      label="Level"
      value={value}
      onChange={onChange}
      options={options}
      placeholder="Select Level"
    />
  );
}