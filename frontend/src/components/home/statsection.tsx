export default function StatsSection() {
  const stats = [
    {
      value: "10K+",
      label: "Active Learners",
    },
    {
      value: "500+",
      label: "Resources Shared",
    },
    {
      value: "1K+",
      label: "Discussions",
    },
    {
      value: "50+",
      label: "Communities",
    },
  ];

  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm transition hover:shadow-md"
            >
              <h3 className="text-4xl font-bold text-blue-600">
                {stat.value}
              </h3>

              <p className="mt-3 text-gray-600">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}