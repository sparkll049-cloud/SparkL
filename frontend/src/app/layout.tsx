import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SparkL - Learn Together, Grow Together",
  description: "Join students, learners, and professionals sharing knowledge.",
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
      </body>
    </html>
  );
}