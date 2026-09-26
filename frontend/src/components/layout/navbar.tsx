"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, ArrowRight } from "lucide-react";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { name: "Features", href: "#features" },
    { name: "Pricing", href: "/dashboard/subscribe" },
    { name: "Community", href: "/community" },
    { name: "Resources", href: "#resources" },
    { name: "About", href: "/about" },
  ];

  const closeMenu = () => setIsOpen(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
        {/* Logo */}
        <Link
          href="/"
          onClick={closeMenu}
          className="group flex items-center"
          aria-label="SparkL home"
        >
          <Image
            src="/images/logo.jpg"
            alt="SparkL"
            width={58}
            height={58}
            priority
            className="h-12 w-auto object-contain transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </Link>

        {/* Desktop Navigation */}
        <nav
          className="hidden items-center gap-8 md:flex"
          aria-label="Main navigation"
        >
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className="group relative py-2 text-[14px] font-medium text-slate-600 transition-colors duration-200 hover:text-blue-600"
            >
              {link.name}

              <span className="absolute bottom-0 left-0 h-[2px] w-0 rounded-full bg-blue-600 transition-all duration-300 group-hover:w-full" />
            </Link>
          ))}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/auth"
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:bg-slate-50 hover:text-blue-600"
          >
            Sign In
          </Link>

          <Link
            href="/auth"
            className="group inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md hover:shadow-blue-600/20"
          >
            Get Started
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition-colors hover:bg-slate-50 md:hidden"
          aria-label={isOpen ? "Close menu" : "Open menu"}
          aria-expanded={isOpen}
        >
          {isOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden border-t border-slate-100 bg-white md:hidden"
          >
            <motion.nav
              initial={{ y: -8 }}
              animate={{ y: 0 }}
              exit={{ y: -8 }}
              transition={{ duration: 0.2 }}
              className="mx-auto flex max-w-7xl flex-col px-5 py-5 sm:px-8"
              aria-label="Mobile navigation"
            >
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={closeMenu}
                  className="border-b border-slate-100 py-4 text-[15px] font-medium text-slate-700 transition-colors hover:text-blue-600"
                >
                  {link.name}
                </Link>
              ))}

              <div className="mt-5 grid grid-cols-2 gap-3">
                <Link
                  href="/auth"
                  onClick={closeMenu}
                  className="flex items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Sign In
                </Link>

                <Link
                  href="/auth"
                  onClick={closeMenu}
                  className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}