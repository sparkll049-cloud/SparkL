const testimonials = [
  {
    name: "Esther Bright",
    course: "ND2 Computer Science, YABATECH",
    review:
      "SparkL helped me practice with past questions before my exams. It made studying easier because I could focus on the right materials.",
    avatar: "EB",
  },
  {
    name: "Sarah Emmanuel",
    course: "HND1 Accountancy, YABATECH",
    review:
      "Finding past questions used to be stressful. SparkL gives me everything I need in one place.",
    avatar: "SE",
  },
  {
    name: "David Okafor",
    course: "ND1 Electrical Engineering, YABATECH",
    review:
      "The organized courses and resources helped me prepare better and feel more confident going into exams.",
    avatar: "DO",
  },
];

export default function Testimonials() {
  return (
    <section className="bg-white py-20 px-6">
      <div className="max-w-6xl mx-auto">

        {/* Heading */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
            Trusted by Students
          </h2>

          <p className="mt-4 text-gray-600">
            See how students use SparkL to prepare smarter with past questions
            and academic resources.
          </p>
        </div>


        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          {testimonials.map((student, index) => (
            <div
              key={index}
              className="
                bg-gray-50 
                rounded-2xl 
                p-6 
                border 
                border-gray-100
                hover:shadow-lg
                hover:-translate-y-1
                transition-all
                duration-300
              "
            >

              {/* Review */}
              <p className="text-gray-700 leading-relaxed">
                "{student.review}"
              </p>


              {/* Student */}
              <div className="flex items-center gap-4 mt-6">

                <div
                  className="
                    w-12 
                    h-12 
                    rounded-full 
                    bg-blue-600 
                    text-white 
                    flex 
                    items-center 
                    justify-center
                    font-semibold
                  "
                >
                  {student.avatar}
                </div>


                <div>
                  <h3 className="font-semibold text-gray-900">
                    {student.name}
                  </h3>

                  <p className="text-sm text-gray-500">
                    {student.course}
                  </p>
                </div>

              </div>

            </div>
          ))}

        </div>

      </div>
    </section>
  );
}