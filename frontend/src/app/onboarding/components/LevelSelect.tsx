import { ChevronDown } from "lucide-react";
import { LEVELS } from "@/lib/constants/levels";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function LevelSelect({
  value,
  onChange,
}: Props) {
  return (
    <div>
      {/* Smaller label keeps the form cleaner */}
      <label className="mb-2 block text-sm font-semibold text-slate-800">
        Level
      </label>

      {/* Needed for custom arrow positioning */}
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
            Select Level
          </option>

          {LEVELS.map((level) => (
            <option
              key={level}
              value={level}
            >
              {level}
            </option>
          ))}
        </select>

        {/* ==================================
            Custom Arrow
            Moved inward from the edge
        ================================== */}
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