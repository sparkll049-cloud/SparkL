import {
  Laptop,
  Wrench,
  Briefcase,
  Megaphone,
  FlaskConical,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

const topics = [
  {
    icon: Laptop,
    title: "Computer Science",
    description: "Programming, software engineering, and computer-related courses.",
    questions: "500+ questions",
    color: "bg-blue-500/10 text-blue-400",
    border: "hover:border-blue-500/50",
  },
  {
    icon: Wrench,
    title: "Engineering",
    description: "Technical subjects and engineering fundamentals.",
    questions: "800+ questions",
    color: "bg-emerald-500/10 text-emerald-400",
    border: "hover:border-emerald-500/50",
  },
  {
    icon: Briefcase,
    title: "Business Courses",
    description: "Accounting, management, and business administration.",
    questions: "600+ questions",
    color: "bg-violet-500/10 text-violet-400",
    border: "hover:border-violet-500/50",
  },
  {
    icon: Megaphone,
    title: "Mass Communication",
    description: "Media studies, journalism, and communication courses.",
    questions: "400+ questions",
    color: "bg-pink-500/10 text-pink-400",
    border: "hover:border-pink-500/50",
  },
  {
    icon: FlaskConical,
    title: "Science & Technology",
    description: "Applied sciences and technology foundations.",
    questions: "700+ questions",
    color: "bg-amber-500/10 text-amber-400",
    border: "hover:border-amber-500/50",
  },
  {
    icon: BookOpen,
    title: "General Studies",
    description: "GST, entrepreneurship, and cross-departmental courses.",
    questions: "300+ questions",
    color: "bg-cyan-500/10 text-cyan-400",
    border: "hover:border-cyan-500/50",
  },
];

export default function TrendingTopics() {
  return (
    <section id="courses" className="bg-[#0A0F2C] py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-14">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-3">
              What We Cover
            </p>
            <h2 className="text-4xl font-extrabold text-white md:text-5xl">
              Your Department,<br />Your Questions
            </h2>
          </div>
          <Link
            href="/dashboard/courses"
            className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors whitespace-nowrap"
          >
            View all courses <ArrowRight size={16} />
          </Link>
        </div>

        {/* Cards */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map((topic) => {
            const Icon = topic.icon;
            return (
              <div
                key={topic.title}
                className={`group relative rounded-xl border border-white/10 bg-white/[0.03] p-6 transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.06] ${topic.border} cursor-pointer`}
              >
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-lg ${topic.color} mb-5`}>
                  <Icon size={22} />
                </div>

                <h3 className="text-lg font-semibold text-white mb-2">
                  {topic.title}
                </h3>

                <p className="text-sm leading-6 text-slate-400 mb-5">
                  {topic.description}
                </p>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 bg-white/5 rounded-full px-3 py-1">
                    {topic.questions}
                  </span>
                  <ArrowRight
                    size={16}
                    className="text-slate-600 group-hover:text-white group-hover:translate-x-1 transition-all"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}