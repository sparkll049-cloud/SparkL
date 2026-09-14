export default function StatsSection() {
  const stats = [
    { value: "10K+", label: "Active Students", sub: "and growing every week" },
    { value: "3K+", label: "Past Questions", sub: "verified and organized" },
    { value: "50+", label: "Departments", sub: "across Yabatech" },
    { value: "98%", label: "Pass Rate", sub: "among active users" },
  ];

  return (
    <section className="bg-[#0D1333] border-t border-white/10">
      <div className="mx-auto max-w-7xl px-6 lg:px-12 py-16">
        <div className="grid grid-cols-2 gap-px md:grid-cols-4 bg-white/10 rounded-2xl overflow-hidden">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-[#0D1333] px-8 py-10 text-center"
            >
              <p className="text-4xl font-extrabold text-white">{stat.value}</p>
              <p className="mt-2 text-sm font-semibold text-blue-400">{stat.label}</p>
              <p className="mt-1 text-xs text-slate-500">{stat.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}