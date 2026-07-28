import Link from "next/link";
import Image from "next/image";

const footerLinks = [
  {
    heading: "Platform",
    links: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "My Courses", href: "/dashboard/courses" },
      { label: "Upload", href: "/dashboard/upload" },
      { label: "Profile", href: "/dashboard/profile" },
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
  {
    heading: "Get Started",
    links: [
      { label: "Sign Up", href: "/auth/signup" },
      { label: "Log In", href: "/auth/login" },
      { label: "Explore Community", href: "#community" },
    ],
  },
];

const socialLinks = [
  {
    label: "Facebook",
    href: "#",
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12z" />
      </svg>
    ),
  },
  {
    label: "Twitter",
    href: "#",
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M18.9 2H22l-7.2 8.3L23.3 22H16.9l-5-6.5L6 22H2.9l7.7-8.8L1 2h6.6l4.5 5.9L18.9 2zm-1.1 18h1.7L7.3 4H5.5l12.3 16z" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    href: "#",
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M12 2c2.7 0 3.1 0 4.1.1 1.1 0 1.8.2 2.3.4a4.6 4.6 0 0 1 1.7 1.1 4.6 4.6 0 0 1 1.1 1.7c.2.5.4 1.2.4 2.3.1 1 .1 1.4.1 4.1s0 3.1-.1 4.1c0 1.1-.2 1.8-.4 2.3a4.6 4.6 0 0 1-1.1 1.7 4.6 4.6 0 0 1-1.7 1.1c-.5.2-1.2.4-2.3.4-1 .1-1.4.1-4.1.1s-3.1 0-4.1-.1c-1.1 0-1.8-.2-2.3-.4a4.6 4.6 0 0 1-1.7-1.1 4.6 4.6 0 0 1-1.1-1.7c-.2-.5-.4-1.2-.4-2.3C2 15.1 2 14.7 2 12s0-3.1.1-4.1c0-1.1.2-1.8.4-2.3a4.6 4.6 0 0 1 1.1-1.7 4.6 4.6 0 0 1 1.7-1.1c.5-.2 1.2-.4 2.3-.4C8.9 2 9.3 2 12 2zm0 1.8c-2.7 0-3 0-4 .1-.9 0-1.4.2-1.7.3-.4.2-.7.3-1 .6-.3.3-.5.6-.6 1-.1.3-.3.8-.3 1.7-.1 1-.1 1.3-.1 4s0 3 .1 4c0 .9.2 1.4.3 1.7.2.4.3.7.6 1 .3.3.6.5 1 .6.3.1.8.3 1.7.3 1 .1 1.3.1 4 .1s3 0 4-.1c.9 0 1.4-.2 1.7-.3.4-.2.7-.3 1-.6.3-.3.5-.6.6-1 .1-.3.3-.8.3-1.7.1-1 .1-1.3.1-4s0-3-.1-4c0-.9-.2-1.4-.3-1.7a2.8 2.8 0 0 0-.6-1 2.8 2.8 0 0 0-1-.6c-.3-.1-.8-.3-1.7-.3-1-.1-1.3-.1-4-.1zm0 3.5a4.7 4.7 0 1 1 0 9.4 4.7 4.7 0 0 1 0-9.4zm0 1.8a2.9 2.9 0 1 0 0 5.8 2.9 2.9 0 0 0 0-5.8zm5.9-2a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0z" />
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    href: "#",
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M20.4 20.4h-3.5v-5.6c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9v5.7H9.4V9h3.4v1.6h.1a3.7 3.7 0 0 1 3.3-1.8c3.5 0 4.2 2.3 4.2 5.4v6.2zM5.3 7.4a2 2 0 1 1 0-4 2 2 0 0 1 0 4zM7 20.4H3.5V9H7v11.4z" />
      </svg>
    ),
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-14 lg:px-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/images/logo.jpg"
                alt="SparkL"
                width={32}
                height={32}
                className="rounded-full"
              />
              <span className="text-lg font-bold text-slate-900">SparkL</span>
            </Link>

            <p className="mt-4 max-w-xs text-sm leading-6 text-slate-500">
              Join students, learners, and professionals sharing knowledge,
              opportunities, resources, and meaningful discussions.
            </p>

            <div className="mt-6 flex gap-3">
              {socialLinks.map(({ svg, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-blue-50 hover:text-blue-600"
                >
                  {svg}
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {footerLinks.map((col) => (
            <div key={col.heading}>
              <h3 className="text-sm font-semibold text-slate-900">
                {col.heading}
              </h3>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-500 transition hover:text-blue-600"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-100 pt-6 sm:flex-row">
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} SparkL. All rights reserved.
          </p>
          <p className="text-xs text-slate-400">
            Built for students, by students.
          </p>
        </div>
      </div>
    </footer>
  );
}