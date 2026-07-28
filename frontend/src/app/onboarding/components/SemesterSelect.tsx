interface Option {
  id: string;
  name: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
}

export default function SemesterSelect({ value, onChange, options }: Props) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-800">
        Semester
      </label>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:border-[#2563EB] focus:outline-none"
      >
        <option value="" disabled>
          Select semester
        </option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.name}
          </option>
        ))}
      </select>
    </div>
  );
}