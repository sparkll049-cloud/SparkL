import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users, BookOpen, Star } from "lucide-react";

export default function HeroSection() {
  return (
    <section className="relative bg-[#0A0F2C] overflow-hidden">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-12 pt-24 pb-20">
        <div className="max-w-3xl">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-sm text-blue-300 mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] animate-pulse" />
            Nigeria's #1 Past Question Platform for Polytechnic Students
          </div>

          {/* Headline */}
          <h1 className="text-5xl font-extrabold leading-[1.1] tracking-tight text-white md:text-6xl lg:text-7xl">
            Stop Failing Exams.
            <br />
            <span className="text-[#2563EB]">Start Passing</span>{" "}
            <span className="text-[#10B981]">Them.</span>
          </h1>

          <p className="mt-7 max-w-xl text-lg leading-8 text-slate-400">
            SparkL gives Yabatech students instant access to verified past questions,
            department resources, and a study community — all in one place.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link href="/auth/signup">
              <Button className="group w-full sm:w-auto rounded-lg bg-[#2563EB] px-7 py-6 text-base font-semibold hover:bg-blue-500 transition-all duration-200 flex items-center gap-2">
                Start Studying Free
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="#courses">
              <Button
                variant="outline"
                className="w-full sm:w-auto rounded-lg border border-white/20 bg-white/5 px-7 py-6 text-base font-semibold text-white hover:bg-white/10 transition-all duration-200"
              >
                Browse Courses
              </Button>
            </Link>
          </div>

          {/* Trust row */}
          <div className="mt-14 flex flex-wrap items-center gap-8">
            <div className="flex items-center gap-2 text-slate-400">
              <Users size={18} className="text-[#10B981]" />
              <span className="text-sm">10,000+ active students</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <BookOpen size={18} className="text-[#10B981]" />
              <span className="text-sm">3,000+ past questions</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <Star size={18} className="text-[#10B981]" />
              <span className="text-sm">Trusted by students since 2023</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}