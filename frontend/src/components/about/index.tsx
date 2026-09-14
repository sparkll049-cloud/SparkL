"use client";

import Link from "next/link";
import { ArrowRight, Lightbulb, Users, ShieldCheck, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── DATA ────────────────────────────────────────────────────────────────────

const values = [
  {
    icon: Lightbulb,
    title: "Access for all",
    description:
      "Every student deserves quality study materials regardless of their financial situation. SparkL is free to use — always.",
  },
  {
    icon: Users,
    title: "Community first",
    description:
      "We're built on the belief that students learn better together. Every feature we ship strengthens that community.",
  },
  {
    icon: ShieldCheck,
    title: "Verified content",
    description:
      "Every past question on SparkL is reviewed before it goes live. You study with material you can actually trust.",
  },
  {
    icon: Rocket,
    title: "Built to scale",
    description:
      "We started with Yabatech. But the problem we're solving exists in every polytechnic and university in Nigeria.",
  },
];

const team = [
  {
    name: "Marvel",
    role: "Founder & Lead Engineer",
    bio: "Computer engineering student and the developer behind SparkL. Built the platform after seeing classmates struggle to find reliable past questions.",
    initials: "M",
    color: "bg-blue-500",
  },
  {
    name: "Team Member",
    role: "Product & Design",
    bio: "Focuses on making SparkL easy and intuitive — because a tool students won't use is a tool that doesn't help anyone.",
    initials: "T",
    color: "bg-emerald-500",
  },
  {
    name: "Team Member",
    role: "Community Lead",
    bio: "Manages the SparkL community, onboards new contributors, and makes sure students get the answers they need.",
    initials: "T",
    color: "bg-violet-500",
  },
];

// ─── SECTIONS ────────────────────────────────────────────────────────────────

function AboutHero() {
  return (
    <section className="relative bg-[#0A0F2C] overflow-hidden pt-24 pb-20">
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      <div className="absolute top-0 left-1/4 w-[500px] h-[300px] bg-blue-600/20 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-12">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-widest text-blue-400 mb-4 uppercase">
            Who we are
          </p>
          <h1 className="text-5xl font-extrabold leading-tight text-white md:text-6xl">
            We built the platform
            <br />
            we wished existed.
          </h1>
          <p className="mt-7 text-lg leading-8 text-slate-400 max-w-xl">
            SparkL started as a simple idea — what if every Yabatech student
            could find their department's past questions in under 30 seconds?
            That idea became a platform. The platform became a community.
          </p>
        </div>
      </div>
    </section>
  );
}

function AboutMission() {
  return (
    <section className="bg-[#0D1333] border-t border-white/10 py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <div className="grid gap-16 lg:grid-cols-2 lg:items-center">

          {/* Left: story */}
          <div>
            <h2 className="text-3xl font-extrabold text-white md:text-4xl mb-8">
              The problem we're solving
            </h2>
            <div className="space-y-5 text-slate-400 text-[15px] leading-8">
              <p>
                Every semester, thousands of Nigerian polytechnic students sit exams
                with no structured way to prepare. Past questions — the single most
                reliable study tool — are scattered across WhatsApp chats, sold in
                printout shops, or simply unavailable.
              </p>
              <p>
                Students waste hours hunting for materials that should take seconds
                to find. Those without the right connections or money to buy handouts
                are left behind before the exam even starts.
              </p>
              <p>
                SparkL fixes that. One platform, every department, all in one place —
                free.
              </p>
            </div>

            {/* Pull quote */}
            <blockquote className="mt-10 border-l-2 border-blue-500 pl-6">
              <p className="text-white font-medium text-lg leading-8">
                "We didn't build SparkL to be a startup. We built it because
                students needed it and nobody else was doing it."
              </p>
              <footer className="mt-3 text-sm text-slate-500">— Marvel, Founder</footer>
            </blockquote>
          </div>

          {/* Right: mission statement card */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10">
            <p className="text-xs font-semibold tracking-widest text-blue-400 uppercase mb-6">
              Our mission
            </p>
            <p className="text-2xl font-bold text-white leading-9 mb-8">
              Make quality exam preparation accessible to every student in Nigeria —
              regardless of their department, level, or budget.
            </p>
            <div className="grid grid-cols-2 gap-6 pt-6 border-t border-white/10">
              <div>
                <p className="text-3xl font-black text-white">2023</p>
                <p className="text-sm text-slate-500 mt-1">Year founded</p>
              </div>
              <div>
                <p className="text-3xl font-black text-white">Yabatech</p>
                <p className="text-sm text-slate-500 mt-1">Where it started</p>
              </div>
              <div>
                <p className="text-3xl font-black text-white">10K+</p>
                <p className="text-sm text-slate-500 mt-1">Students served</p>
              </div>
              <div>
                <p className="text-3xl font-black text-white">Nigeria</p>
                <p className="text-sm text-slate-500 mt-1">Where we're going</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

function AboutValues() {
  return (
    <section className="bg-[#0A0F2C] py-24 border-t border-white/10">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <h2 className="text-3xl font-extrabold text-white md:text-4xl mb-14">
          What we stand for
        </h2>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((v) => {
            const Icon = v.icon;
            return (
              <div
                key={v.title}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-6 hover:bg-white/[0.06] transition-colors duration-200"
              >
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 mb-5">
                  <Icon size={20} />
                </div>
                <h3 className="text-base font-bold text-white mb-3">{v.title}</h3>
                <p className="text-sm leading-7 text-slate-400">{v.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function AboutTeam() {
  return (
    <section className="bg-[#060B1F] py-24 border-t border-white/10">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <div className="mb-14">
          <h2 className="text-3xl font-extrabold text-white md:text-4xl">
            The people behind SparkL
          </h2>
          <p className="mt-4 text-slate-400 text-[15px] max-w-lg">
            A small team of students and builders who know exactly what
            it feels like to sit an exam underprepared.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {team.map((member) => (
            <div
              key={member.name}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-7"
            >
              {/* Avatar */}
              <div className={`h-14 w-14 rounded-xl ${member.color} flex items-center justify-center mb-6`}>
                <span className="text-white text-xl font-black">{member.initials}</span>
              </div>

              <h3 className="text-lg font-bold text-white">{member.name}</h3>
              <p className="text-xs text-blue-400 font-medium mt-1 mb-4">{member.role}</p>
              <p className="text-sm leading-7 text-slate-400">{member.bio}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AboutCTA() {
  return (
    <section className="bg-[#0D1333] border-t border-white/10 py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 px-10 py-16 text-center">
          <h2 className="text-4xl font-extrabold text-white md:text-5xl mb-6">
            Ready to study smarter?
          </h2>
          <p className="text-slate-400 text-lg max-w-lg mx-auto mb-10">
            Join thousands of Yabatech students already using SparkL to
            prepare for exams — for free.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signup">
              <Button className="group rounded-lg bg-[#2563EB] px-8 py-6 text-base font-semibold hover:bg-blue-500 transition-all duration-200 flex items-center gap-2">
                Create free account
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button
                variant="outline"
                className="rounded-lg border border-white/20 bg-white/5 px-8 py-6 text-base font-semibold text-white hover:bg-white/10 transition-all duration-200"
              >
                Get in touch
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── DEFAULT EXPORT (all sections together for easy import) ──────────────────

export { AboutHero, AboutMission, AboutValues, AboutTeam, AboutCTA };