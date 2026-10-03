import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";
import CookieConsent from "@/components/CookieConsent";

export const metadata: Metadata = {
  title: "SparkL - Learn Together, Grow Together",
  description: "Join students, learners, and professionals sharing knowledge.",
  keywords: [
    "past questions",
    "Nigeria",
    "YABATECH",
    "Yaba College of Technology",
    "exam practice",
    "polytechnic past questions",
    "university past questions",
    "JAMB",
    "WAEC",
    "student resources",
  ],
  icons: {
    icon: [
      { url: "/images/logo.png" },
      { url: "/favicon.ico" },
    ],
    shortcut: "/images/logo.png",
    apple: "/images/logo.png",
  },
  openGraph: {
    title: "SparkL - Learn Together, Grow Together",
    description: "Join students, learners, and professionals sharing knowledge.",
    type: "website",
    locale: "en_NG",
    images: ["/images/logo.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="antialiased">
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
