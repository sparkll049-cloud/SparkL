import {
  Users,
  BookOpen,
  MessageSquare,
  Rocket,
  Globe,
  Zap,
} from "lucide-react";

const features = [
  {
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
  },
];

export default function WhyChooseUs() {
  return (
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
            const Icon = feature.icon;

            return (
              <div
                key={feature.title}
                className="
                  group
                  rounded-2xl
                  border
                  border-slate-200
                  bg-white
                  p-8
                  shadow-sm
                  transition-all
                  duration-300
                  hover:-translate-y-2
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
      </div>
    </section>
  );
}