"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { name: "Features", href: "#features" },
    { name: "Community", href: "#community" },
    { name: "Resources", href: "#resources" },
    { name: "About", href: "#about" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur border-b border-gray-100">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-12">
        
        {/* Logo */}
        <Link href="/" className="flex items-center">
  <Image
    src="/images/logo.jpg"
    alt="SparkL"
    width={60}
    height={60}
    priority
    className="object-contain"
  />
</Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-10 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className="
                relative
                font-medium
                text-slate-700
                transition-colors
                hover:text-blue-600
                after:absolute
                after:left-0
                after:-bottom-1
                after:h-[2px]
                after:w-0
                after:bg-blue-600
                after:transition-all
                hover:after:w-full
              "
            >
              {link.name}
            </Link>
          ))}
        </nav>

        {/* Desktop Button */}
        <div className="hidden md:block">
          <Button
            className="
              rounded-xl
              bg-blue-600
              px-6
              py-5
              text-base
              font-medium
              hover:bg-blue-700
              transition-all
              duration-300
              hover:scale-105
            "
          >
            Sign In
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="md:hidden"
          aria-label="Toggle Menu"
        >
          {isOpen ? (
            <X size={28} />
          ) : (
            <Menu size={28} />
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white">
          <div className="flex flex-col px-6 py-4 space-y-4">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="
                  text-slate-700
                  font-medium
                  py-2
                  hover:text-blue-600
                "
              >
                {link.name}
              </Link>
            ))}

            <Button className="mt-2 w-full rounded-lg bg-blue-600 py-5 text-base font-medium hover:bg-blue-700">
              Sign In
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}