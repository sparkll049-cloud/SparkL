import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, CheckCircle2, Users, GraduationCap } from "lucide-react";
import OnboardingForm from "./components/OnboardingForm";

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto grid min-h-screen max-w-[1600px] lg:grid-cols-2">
        {/* LEFT PANEL */}
        <section className="relative hidden overflow-hidden bg-blue-600 lg:flex lg:flex-col lg:justify-between">
          {/* Background decoration */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />

            <div className="absolute -bottom-40 -left-32 h-[32rem] w-[32rem] rounded-full bg-blue-900/20 blur-3xl" />

            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage:
                  "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
                backgroundSize: "56px 56px",
              }}
            />
          </div>

          {/* Top */}
          <div className="relative z-10 p-10 xl:p-12">
            <Link
              href="/auth"
              className="group inline-flex items-center gap-2 text-sm font-medium text-blue-100 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" />
              Back to authentication
            </Link>

            <Link href="/" className="mt-8 inline-flex items-center">
              <Image
                src="/images/logo-white.png"
                alt="SparkL"
                width={130}
                height={48}
                priority
                className="h-auto w-auto"
              />
            </Link>
          </div>

          {/* Main content */}
          <div className="relative z-10 px-10 pb-10 xl:px-12">
            <div className="max-w-xl">
              <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-blue-100">
                Personalize your experience
              </span>

              <h1 className="mt-5 text-5xl font-black leading-[1.02] tracking-[-0.045em] text-white xl:text-6xl">
                Learn.
                <br />
                Connect.
                <br />
                Grow.
              </h1>

              <p className="mt-6 max-w-lg text-base leading-7 text-blue-100 xl:text-lg xl:leading-8">
                Tell us a little about your academic journey so SparkL can
                connect you with relevant courses, questions, and resources.
              </p>
            </div>

            {/* Benefits */}
            <div className="mt-10 grid max-w-xl gap-3">
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/10 px-4 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <CheckCircle2 className="h-4 w-4 text-white" />
                </div>

                <div>
                  <p className="text-sm font-bold text-white">
                    Personalized resources
                  </p>
                  <p className="mt-0.5 text-xs text-blue-100">
                    Find questions relevant to your academic path.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/10 px-4 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Users className="h-4 w-4 text-white" />
                </div>

                <div>
                  <p className="text-sm font-bold text-white">
                    Student community
                  </p>
                  <p className="mt-0.5 text-xs text-blue-100">
                    Learn alongside students from different institutions.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/10 px-4 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <GraduationCap className="h-4 w-4 text-white" />
                </div>

                <div>
                  <p className="text-sm font-bold text-white">
                    Built for students
                  </p>
                  <p className="mt-0.5 text-xs text-blue-100">
                    A focused academic experience from the start.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT PANEL */}
        <section className="relative flex min-h-screen items-start justify-center bg-[#f8f9ff] px-5 py-6 sm:px-8 lg:min-h-screen lg:items-center lg:px-10 lg:py-8">
          <div className="w-full max-w-2xl">
            {/* Mobile top bar */}
            <div className="mb-6 flex items-center justify-between lg:hidden">
              <Link
                href="/auth"
                className="group inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition-colors hover:text-blue-600"
              >
                <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" />
                Back
              </Link>

              <Link href="/">
                <Image
                  src="/images/logo.jpg"
                  alt="SparkL"
                  width={48}
                  height={48}
                  priority
                  className="h-10 w-10 rounded-xl object-contain"
                />
              </Link>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.3)] sm:p-7 lg:p-8">
              <OnboardingForm />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}