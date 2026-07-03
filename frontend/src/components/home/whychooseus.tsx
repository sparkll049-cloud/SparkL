"use client";

import {
  BookOpen,
  Search,
  TrendingUp,
  Smartphone,
} from "lucide-react";

const features = [
  {
    icon: BookOpen,
    title: "Verified Past Questions",
    description:
      "Access carefully organized past examination questions from your department and courses to prepare with confidence.",
  },
  {
    icon: Search,
    title: "Easy Course Discovery",
    description:
      "Find past questions by institution, department, level and course without wasting time searching.",
  },
  {
    icon: TrendingUp,
    title: "Study Smarter",
    description:
      "Focus on the right materials and build confidence with resources designed to improve your exam preparation.",
  },
  {
    icon: Smartphone,
    title: "Learn Anywhere",
    description:
      "Study on your phone, tablet or laptop anytime, whether you're on campus or at home.",
  },
];

export default function WhyChooseUs() {
  return (
    <section className="bg-slate-50 py-24">
      <div className="max-w-7xl mx-auto px-6">

        {/* Heading */}
        <div className="max-w-3xl mx-auto text-center">

          <span className="inline-flex items-center rounded-full bg-blue-100 px-4 py-1.5 text-sm font-medium text-blue-700">
            Why SparkL?
          </span>

          <h2 className="mt-6 text-4xl md:text-5xl font-bold text-slate-900 leading-tight">
            Everything You Need to Prepare for Your Exams
          </h2>

          <p className="mt-6 text-lg text-slate-600 leading-8">
            SparkL helps students prepare smarter by providing organized
            past questions, course materials, and an easy way to
            discover academic resources—all in one place.
          </p>

        </div>

        {/* Cards */}
        <div className="mt-20 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">

          {features.map((feature, index) => {
            const Icon = feature.icon;

            return (
              <div
                key={index}
                className="
                  group
                  rounded-3xl
                  border
                  border-slate-200
                  bg-white
                  p-8
                  shadow-sm
                  transition-all
                  duration-300
                  hover:-translate-y-2
                  hover:border-blue-200
                  hover:shadow-xl
                "
              >
                {/* Icon */}
                <div
                  className="
                    flex
                    h-16
                    w-16
                    items-center
                    justify-center
                    rounded-2xl
                    bg-blue-100
                    text-blue-600
                    transition-all
                    duration-300
                    group-hover:bg-blue-600
                    group-hover:text-white
                  "
                >
                  <Icon className="h-8 w-8" />
                </div>

                {/* Title */}
                <h3 className="mt-8 text-xl font-semibold text-slate-900">
                  {feature.title}
                </h3>

                {/* Description */}
                <p className="mt-4 text-slate-600 leading-7">
                  {feature.description}
                </p>

              </div>
            );
          })}

        </div>

      </div>
    </section>
  );
}