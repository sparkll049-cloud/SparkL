interface Props {
  completed: number;
  total: number;
}

export default function ProgressIndicator({
  completed,
  total,
}: Props) {
  const progress =
    (completed / total) * 100;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3
          className="
            text-sm
            font-semibold
            text-slate-900
          "
        >
          Profile Setup
        </h3>

        <p
          className="
            text-xs
            md:text-sm
            text-slate-500
          "
        >
          {completed} of {total} completed
        </p>
      </div>

      {/* Progress Bar */}
      <div
        className="
          h-1.5
          overflow-hidden
          rounded-full
          bg-slate-200
        "
      >
        <div
          className="
            h-full
            rounded-full
            bg-gradient-to-r
            from-[#2563EB]
            to-[#0EA5E9]
            transition-all
            duration-500
          "
          style={{
            width: `${progress}%`,
          }}
        />
      </div>
    </div>
  );
}