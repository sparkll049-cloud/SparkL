interface Props {
  value: string;
}

export default function InstitutionSelect({
  value,
}: Props) {
  return (
    <div>
      {/* Smaller label for cleaner hierarchy */}
      <label className="mb-2 block text-sm font-semibold text-slate-800">
        Institution
      </label>

      <input
        value={value}
        disabled
        title={value} // Shows full text on hover
        className="
          w-full

          /* Match the other inputs */
          h-12

          rounded-2xl
          border
          border-slate-200
          bg-slate-50

          px-4

          /* Smaller text */
          text-sm
          md:text-base

          text-slate-700

          /* Prevent long names from breaking layout */
          truncate

          /* Better disabled styling */
          disabled:cursor-not-allowed
          disabled:opacity-100
        "
      />
    </div>
  );
}