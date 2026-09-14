export default function HowItWorks() {
  const steps = [
    {
      step: "01",
      title: "Create your free account",
      description:
        "Sign up in under a minute — no payment needed. Just your school email and you're in.",
    },
    {
      step: "02",
      title: "Pick your department",
      description:
        "Select your department and level. We surface the exact past questions that match your courses.",
    },
    {
      step: "03",
      title: "Study smarter, not harder",
      description:
        "Practice real exam questions, see answers with explanations, and track what you've covered.",
    },
    {
      step: "04",
      title: "Walk into exams confident",
      description:
        "Students who use SparkL consistently report higher scores. Now it's your turn.",
    },
  ];

  return (
    <section id="how-it-works" className="bg-[#060B1F] py-24 border-t border-white/10">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">

        <div className="mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-3">
            Simple by design
          </p>
          <h2 className="text-4xl font-extrabold text-white md:text-5xl max-w-lg">
            How SparkL works
          </h2>
        </div>

        <div className="grid gap-0 md:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step.step} className="relative">
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-[calc(50%+2rem)] right-0 h-px bg-white/10" />
              )}

              <div className="pr-8">
                <div className="flex items-center gap-4 mb-5">
                  <span className="text-5xl font-black text-white/10 leading-none">
                    {step.step}
                  </span>
                  <div className="h-px flex-1 bg-white/10 md:hidden" />
                </div>

                <h3 className="text-lg font-bold text-white mb-3">
                  {step.title}
                </h3>

                <p className="text-sm leading-7 text-slate-400">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}