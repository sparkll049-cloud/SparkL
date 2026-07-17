import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HeroSection() {
  return (
    <section className="bg-[#F4F6FA]">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <div className="grid min-h-[520px] items-center gap-16 py-4 lg:grid-cols-2">

          {/* Left */}
          <div className="text-center lg:text-left">
            <h1 className="text-5xl font-bold leading-tight text-slate-950 md:text-6xl lg:text-7xl">
              Learn{" "}
              <span className="text-blue-600">
                Together
              </span>
              <br />
              Grow Together
            </h1>

            <p className="mx-auto mt-8 max-w-xl text-lg leading-9 text-gray-600 lg:mx-0">
              Join students, learners, and professionals sharing
              knowledge, opportunities, resources, and meaningful
              discussions.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center lg:justify-start">
              <Link href="/auth/signup">
                <Button
                  className="
                    w-full
                    rounded-xl
                    bg-blue-600
                    px-8
                    py-7
                    text-base
                    hover:bg-blue-700
                    transition-all
                    duration-300
                    hover:scale-105
                    sm:w-auto
                  "
                >
                  Get Started
                </Button>
              </Link>

              <Link href="#community">
                <Button
                  variant="outline"
                  className="
                    w-full
                    rounded-xl
                    border-2
                    border-blue-600
                    px-8
                    py-7
                    text-base
                    text-blue-600
                    hover:bg-blue-50
                    transition-all
                    duration-300
                    hover:scale-105
                    sm:w-auto
                  "
                >
                  Explore Community
                </Button>
              </Link>
            </div>
          </div>

          {/* Right */}
          <div className="flex justify-center">
            <div className="overflow-hidden border-t-[6px] border-black bg-white shadow-lg">
              <Image
                src="/images/hero-illustration.jpg"
                alt="Students learning together"
                width={560}
                height={400}
                priority
                className="h-auto w-full max-w-[560px]"
              />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}