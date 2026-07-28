import OnboardingForm from "./components/OnboardingForm";
import Image from "next/image";

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-[#F8FAFC]">
      <div
        className="
          mx-auto
          max-w-[1400px]
          grid
          min-h-screen
          lg:grid-cols-2
        "
      >
        {/* LEFT PANEL */}
        <div
          className="
            hidden
            lg:flex
            flex-col
            justify-between
            bg-[#2563EB]
            px-14
            py-14
            text-white
          "
        >
          {/* Hero Section */}
          <div>
            <div className="flex items-start justify-between gap-8">
              <div>
                <h1 className="text-5xl font-bold leading-[1.1]">
                  Learn.
                  <br />
                  Connect.
                  <br />
                  Grow.
                </h1>
              </div>

              <div className="mt-4">
                <Image
                  src="/images/rocket.png"
                  alt="SparkL Logo"
                  width={50}
                  height={50}
                />
              </div>
            </div>

            <p
              className="
                mt-6
                max-w-md
                text-base
                text-blue-100
              "
            >
              Let's get to know your academic profile so we can personalize
              your experience and help you discover relevant past questions.
            </p>
          </div>

          {/* Features */}
          <div className="space-y-5">
            <div className="flex gap-4">
              <div className="mt-1">
                {/* Shield Icon */}
              </div>

              <div>
                <h3 className="text-lg font-semibold">
                  Secure & Reliable
                </h3>
                <p className="text-blue-100 text-sm">
                  Your data is protected with enterprise-grade security.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="mt-1">
                {/* Community Icon */}
              </div>

              <div>
                <h3 className="text-lg font-semibold">
                  Community Driven
                </h3>
                <p className="text-blue-100 text-sm">
                  Connect with students and collaborate together.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="mt-1">
                {/* Graduation Icon */}
              </div>

              <div>
                <h3 className="text-lg font-semibold">
                  Learn Without Limits
                </h3>
                <p className="text-blue-100 text-sm">
                  Access past questions and study resources anytime.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div
          className="
            flex
            items-center
            justify-center
            px-6
            py-10
            lg:px-10
          "
        >
          <OnboardingForm />
        </div>
      </div>
    </main>
  );
}