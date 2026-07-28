export default function HowItWorks() {
  const steps = [
    {
      number: "1",
      title: "Create Account",
      description: "Sign up and build your learner profile.",
    },
    {
      number: "2",
      title: "Join Communities",
      description: "Connect with people sharing similar interests.",
    },
    {
      number: "3",
      title: "Share & Learn",
      description: "Exchange ideas, ask questions, and grow together.",
    },
    {
      number: "4",
      title: "Achieve Your Goals",
      description: "Track your progress and reach new milestones.",
    },
  ];

  return (
    <section className="py-20 bg-[#f8f9ff]">
      <div className="max-w-4xl mx-auto text-center">

        <h2 className="text-5xl font-bold text-[#111827] mb-20">
          How It Works
        </h2>


        <div className="flex flex-col items-center gap-20">

          {steps.map((step) => (
            <div
              key={step.number}
              className="flex flex-col items-center"
            >

              {/* Number Circle */}
              <div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center mb-8">
                <span className="text-white text-3xl font-bold">
                  {step.number}
                </span>
              </div>


              {/* Text */}
              <h3 className="text-3xl font-bold text-[#111827] mb-3">
                {step.title}
              </h3>

              <p className="text-xl text-gray-700 max-w-xl">
                {step.description}
              </p>

            </div>
          ))}

        </div>

      </div>
    </section>
  );
}