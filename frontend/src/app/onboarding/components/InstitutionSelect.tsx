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

export default function InstitutionSelect({
  value,
  onChange,
  options,
}: Props) {
  return (
    <FormSelect
      label="Institution"
      value={value}
      onChange={onChange}
      options={options}
      placeholder="Select Institution"
      disabled={options.length <= 1}
    />
  );
}