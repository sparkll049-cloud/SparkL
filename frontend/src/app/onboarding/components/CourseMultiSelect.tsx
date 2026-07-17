interface Option {
  id: string;
  name: string;
}

interface Props {
  value: string[];
  onChange: (value: string[]) => void;
  options: Option[];
  disabled?: boolean;
}

export default function CourseMultiSelect({
  value,
  onChange,
  options,
  disabled,
}: Props) {
  function toggle(id: string) {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  }

  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-800">
        Courses
      </label>

      <div
        className={`rounded-2xl border border-slate-200 bg-white p-3 ${
          disabled ? "opacity-60" : ""
        }`}
      >
        {disabled ? (
          <p className="px-1 py-2 text-sm text-slate-400">
            Select a department first
          </p>
        ) : options.length === 0 ? (
          <p className="px-1 py-2 text-sm text-slate-400">
            No courses available
          </p>
        ) : (
          <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
            {options.map((opt) => (
              <label
                key={opt.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={value.includes(opt.id)}
                  onChange={() => toggle(opt.id)}
                  disabled={disabled}
                  className="h-4 w-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
                />
                <span className="text-sm text-slate-700">{opt.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {value.length > 0 && (
        <p className="mt-1 text-xs text-slate-500">
          {value.length} course{value.length !== 1 ? "s" : ""} selected
        </p>
      )}
    </div>
  );
}