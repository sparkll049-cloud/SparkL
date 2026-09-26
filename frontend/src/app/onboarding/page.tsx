import OnboardingForm from "./components/OnboardingForm";
import Image from "next/image";
import {
  ShieldCheck,
  Users,
  GraduationCap,
  ArrowRight,
} from "lucide-react";

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto grid min-h-screen max-w-[1440px] lg:grid-cols-[0.9fr_1.1fr]">
        {/* LEFT PANEL */}
        <section className="relative hidden overflow-hidden bg-blue-600 text-white lg:flex">
          {/* Background decoration */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-32 top-1/4 h-80 w-80 rounded-full bg-blue-500 blur-3xl" />

            <div className="absolute -right-24 bottom-10 h-72 w-72 rounded-full bg-blue-700/60 blur-3xl" />

            <div className="absolute right-16 top-16 h-32 w-32 rounded-full border border-white/10" />

            <div className="absolute right-24 top-24 h-16 w-16 rounded-full border border-white/10" />
          </div>

          <div className="relative flex w-full flex-col justify-between px-10 py-10 xl:px-14 xl:py-12">
            {/* Brand / Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
                  <Image
                    src="/images/logo.jpg"
                    alt="SparkL"
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-xl object-cover"
                  />
                </div>

                <span className="text-lg font-extrabold tracking-tight">
                  SparkL
                </span>
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                <Image
                  src="/images/rocket.png"
                  alt=""
                  width={22}
                  height={22}
                  className="object-contain"
                />
              </div>
            </div>

            {/* Main Content */}
            <div className="my-auto max-w-xl py-12">
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-blue-100">
                Welcome to SparkL
              </p>

              <h1 className="text-5xl font-black leading-[0.98] tracking-[-0.045em] xl:text-6xl">
                Learn smarter.
                <br />
                Connect better.
                <br />
                <span className="text-blue-100">Grow together.</span>
              </h1>

              <p className="mt-6 max-w-lg text-[15px] leading-7 text-blue-100 xl:text-base">
                Tell us a little about your academic journey so we can make
                your SparkL experience more relevant from the start.
              </p>

              {/* Feature list */}
              <div className="mt-8 space-y-3">
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.07] px-4 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                    <ShieldCheck className="h-4 w-4 text-white" />
                  </div>

                  <div>
                    <p className="text-sm font-bold">Secure & reliable</p>
                    <p className="mt-0.5 text-xs text-blue-100">
                      Your academic information stays protected.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.07] px-4 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                    <Users className="h-4 w-4 text-white" />
                  </div>

                  <div>
                    <p className="text-sm font-bold">Student community</p>
                    <p className="mt-0.5 text-xs text-blue-100">
                      Learn and exchange knowledge with other students.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.07] px-4 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                    <GraduationCap className="h-4 w-4 text-white" />
                  </div>

                  <div>
                    <p className="text-sm font-bold">Built for students</p>
                    <p className="mt-0.5 text-xs text-blue-100">
                      Find resources that support your academic journey.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom */}
            <div className="flex items-center justify-between border-t border-white/10 pt-5">
              <p className="text-xs text-blue-100/70">
                Your academic journey starts here.
              </p>

              <ArrowRight className="h-4 w-4 text-blue-100/70" />
            </div>
          </div>
        </section>

        {/* RIGHT PANEL */}
        <section className="flex min-h-screen items-center justify-center bg-white px-5 py-8 sm:px-8 lg:min-h-screen lg:px-10 xl:px-14">
          <div className="w-full max-w-[560px]">
            <OnboardingForm />
          </div>
        </section>
      </div>
    </main>
  );
}