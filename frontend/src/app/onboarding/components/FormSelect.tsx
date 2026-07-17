import { ChevronDown } from "lucide-react";

interface Option {
  id: string;
  name: string;
}

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder: string;
  disabled?: boolean;
}

export default function FormSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: Props) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-800">
        {label}
      </label>

      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="
            w-full
            h-12
            rounded-2xl
            border
            border-slate-200
            bg-white
            px-4
            pr-12
            text-sm
            md:text-base
            outline-none
            focus:border-[#2563EB]
            focus:ring-2
            focus:ring-blue-100
            transition
            appearance-none
            disabled:cursor-not-allowed
            disabled:bg-slate-50
            disabled:opacity-70
          "
        >
          <option value="">{placeholder}</option>

          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.name}
            </option>
          ))}
        </select>

        <ChevronDown
          size={18}
          className="
            pointer-events-none
            absolute
            right-5
            top-1/2
            -translate-y-1/2
            text-slate-500
          "
        />
      </div>
    </div>
  );
}