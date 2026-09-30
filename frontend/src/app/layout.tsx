import type { Metadata } from "next";
import "./globals.css";

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
    icon: "/images/logo.png",
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
      <body className="antialiased">{children}</body>
    </html>
  );
}
