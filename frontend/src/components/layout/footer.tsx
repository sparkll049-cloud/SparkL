import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";

const footerLinks = [
  {
    heading: "Quick Links",
    links: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Pricing", href: "/dashboard/subscribe" },
      { label: "Community", href: "/community" },
      { label: "Courses", href: "/dashboard/courses" },
    ],
  },
  {
    heading: "Platform",
    links: [
      { label: "Past Questions", href: "/questions" },
      { label: "Upload", href: "/dashboard/upload" },
      { label: "My Profile", href: "/dashboard/profile" },
      { label: "Get Started", href: "/auth" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About Us", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
  },
];

const TwitterIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
    <path d="M18.9 2H22l-7.2 8.3L23.3 22H16.9l-5-6.5L6 22H2.9l7.7-8.8L1 2h6.6l4.5 5.9L18.9 2zm-1.1 18h1.7L7.3 4H5.5l12.3 16z" />
  </svg>
);

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
  </svg>
);

const LinkedInIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

const socialLinks = [
  { label: "Twitter/X",  href: "#", icon: <TwitterIcon /> },
  { label: "Instagram",  href: "#", icon: <InstagramIcon /> },
  { label: "LinkedIn",   href: "#", icon: <LinkedInIcon /> },
];

export default function Footer() {
  return (
    <footer className="border-t border-slate-800/70 bg-[#060B1F]">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-5 lg:gap-10">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link
              href="/"
              className="group inline-flex items-center gap-3"
              aria-label="SparkL home"
            >
              <Image
                src="/images/logo.jpg"
                alt="SparkL"
                width={42}
                height={42}
                className="h-10 w-10 rounded-xl object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
              <span className="text-lg font-extrabold tracking-[-0.02em] text-white">
                SparkL
              </span>
            </Link>

            <p className="mt-5 max-w-sm text-sm leading-7 text-slate-400">
              The academic platform built for Nigerian students. Find past
              questions, get academic support, and learn together.
            </p>

            {/* Social Links */}
            <div className="mt-7 flex items-center gap-3">
              {socialLinks.map(({ icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-400 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-500/30 hover:bg-blue-600 hover:text-white"
                >
                  {icon}
                </a>
              ))}
            </div>
          </div>

          {/* Footer Link Columns */}
          {footerLinks.map((column) => (
            <div key={column.heading}>
              <h3 className="mb-5 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                {column.heading}
              </h3>
              <ul className="space-y-3.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="group inline-flex items-center gap-1 text-sm text-slate-400 transition-colors duration-200 hover:text-white"
                    >
                      {link.label}
                      {link.label === "Pricing" && (
                        <ArrowUpRight className="h-3 w-3 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="mt-14 flex flex-col gap-4 border-t border-white/10 pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} SparkL. All rights reserved.
          </p>
          <p className="text-xs text-slate-600">
            Built for students, by students.
          </p>
        </div>
      </div>
    </footer>
  );
}