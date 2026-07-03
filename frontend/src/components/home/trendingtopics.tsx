"use client";

import {
  Laptop,
  Wrench,
  Briefcase,
  Megaphone,
  FlaskConical,
  BookOpen,
} from "lucide-react";


const topics = [
  {
    icon: Laptop,
    title: "Computer Science",
    description:
      "Practice past questions from programming, software, and computer-related courses.",
    questions: "500+ past questions",
  },

  {
    icon: Wrench,
    title: "Engineering",
    description:
      "Prepare with previous exams from engineering courses and technical subjects.",
    questions: "800+ past questions",
  },

  {
    icon: Briefcase,
    title: "Business Courses",
    description:
      "Access past questions for accounting, management, and business-related courses.",
    questions: "600+ past questions",
  },

  {
    icon: Megaphone,
    title: "Mass Communication",
    description:
      "Study previous exams and improve your understanding of communication courses.",
    questions: "400+ past questions",
  },

  {
    icon: FlaskConical,
    title: "Science & Technology",
    description:
      "Practice questions from science, technology, and applied science courses.",
    questions: "700+ past questions",
  },

  {
    icon: BookOpen,
    title: "General Courses",
    description:
      "Find GST, entrepreneurship, and other common institution courses.",
    questions: "300+ past questions",
  },
];


export default function TrendingTopics() {

  return (

    <section className="bg-white py-20 md:py-24">

      <div className="mx-auto max-w-7xl px-6 lg:px-12">


        {/* Heading */}

        <div className="mx-auto max-w-3xl text-center">

          <h2 className="text-3xl font-bold text-slate-900 md:text-5xl">

            Explore{" "}
            <span className="text-blue-600">
              Courses
            </span>

          </h2>


          <p className="mt-5 text-lg text-slate-600">

            Find past questions and study materials
            from your department and prepare smarter.

          </p>


        </div>



        {/* Cards */}

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">


          {topics.map((topic) => {

            const Icon = topic.icon;


            return (

              <div

                key={topic.title}

                className="
                  group
                  rounded-2xl
                  border
                  border-slate-200
                  bg-white
                  p-7
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
                    transition-all
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

                  {topic.title}

                </h3>



                <p className="mt-3 leading-7 text-slate-600">

                  {topic.description}

                </p>



                <p className="mt-5 text-sm font-medium text-blue-600">

                  {topic.questions}

                </p>


              </div>

            );

          })}


        </div>


      </div>

    </section>

  );

}