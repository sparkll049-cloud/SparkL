import { ChevronDown } from "lucide-react";
import { DEPARTMENTS } from "@/lib/constants/departments";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function DepartmentSelect({
  value,
  onChange,
}: Props) {
  return (
    <div>
      {/* Smaller label for better hierarchy */}
      <label className="mb-2 block text-sm font-semibold text-slate-800">
        Department
      </label>

      {/* Relative allows us to position our custom arrow */}
      <div className="relative">
        <select
          value={value}
          onChange={(e) =>
            onChange(e.target.value)
          }
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

            /* Hide browser arrow */
            appearance-none
          "
        >
          <option value="">
            Select Department
          </option>

          {DEPARTMENTS.map((dept) => (
            <option
              key={dept}
              value={dept}
            >
              {dept}
            </option>
          ))}
        </select>

        {/* ===================================
            Custom Arrow
            Positioned further inside
        =================================== */}
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