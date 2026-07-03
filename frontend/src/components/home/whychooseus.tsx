<<<<<<< HEAD
import {
  Users,
  BookOpen,
  MessageSquare,
  Rocket,
  Globe,
  Zap,
=======
"use client";

import {
  BookOpen,
  Search,
  TrendingUp,
  Smartphone,
>>>>>>> 3727fcbdbf79b6d7c89c2b5ed5566c87d7a5890e
} from "lucide-react";

const features = [
  {
<<<<<<< HEAD
    icon: Users,
    title: "Collaborative Learning",
    description:
      "Connect with students, professionals, and learners to grow together through shared knowledge.",
  },
  {
    icon: BookOpen,
    title: "Resource Sharing",
    description:
      "Access and share notes, guides, opportunities, and educational materials in one place.",
  },
  {
    icon: MessageSquare,
    title: "Meaningful Discussions",
    description:
      "Engage in productive conversations that inspire learning and problem-solving.",
  },
  {
    icon: Rocket,
    title: "Career Opportunities",
    description:
      "Discover internships, scholarships, jobs, and opportunities shared by the community.",
  },
  {
    icon: Globe,
    title: "Diverse Community",
    description:
      "Learn from people with different experiences, backgrounds, and perspectives.",
  },
  {
    icon: Zap,
    title: "Real-Time Engagement",
    description:
      "Stay updated with trending discussions, resources, and community activities.",
=======
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
>>>>>>> 3727fcbdbf79b6d7c89c2b5ed5566c87d7a5890e
  },
];

export default function WhyChooseUs() {
  return (
<<<<<<< HEAD
    <section
      id="features"
      className="bg-[#F8FAFC] py-20 md:py-24"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        
        {/* Heading */}
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold text-slate-900 md:text-5xl">
            Why Choose{" "}
            <span className="text-blue-600">
              SparkL
            </span>
            ?
          </h2>

          <p className="mt-5 text-lg text-slate-600">
            Everything you need to learn, connect,
            collaborate, and grow with a thriving
            community of learners.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
=======
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
>>>>>>> 3727fcbdbf79b6d7c89c2b5ed5566c87d7a5890e
            const Icon = feature.icon;

            return (
              <div
<<<<<<< HEAD
                key={feature.title}
                className="
                  group
                  rounded-2xl
=======
                key={index}
                className="
                  group
                  rounded-3xl
>>>>>>> 3727fcbdbf79b6d7c89c2b5ed5566c87d7a5890e
                  border
                  border-slate-200
                  bg-white
                  p-8
                  shadow-sm
                  transition-all
                  duration-300
                  hover:-translate-y-2
<<<<<<< HEAD
                  hover:shadow-xl
                "
              >
                <div
                  className="
                    flex
                    h-14
                    w-14
                    items-center
                    justify-center
                    rounded-xl
                    bg-blue-100
                    transition-colors
                    duration-300
                    group-hover:bg-blue-600
                  "
                >
                  <Icon
                    size={28}
                    className="
                      text-blue-600
                      transition-colors
                      duration-300
                      group-hover:text-white
                    "
                  />
                </div>

                <h3 className="mt-6 text-xl font-semibold text-slate-900">
                  {feature.title}
                </h3>

                <p className="mt-3 leading-7 text-slate-600">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
=======
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

>>>>>>> 3727fcbdbf79b6d7c89c2b5ed5566c87d7a5890e
      </div>
    </section>
  );
}