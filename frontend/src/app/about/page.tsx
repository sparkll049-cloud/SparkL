import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import {
  AboutHero,
  AboutMission,
  AboutValues,
  AboutPillars,
  AboutCTA,
} from "@/components/about";

export const metadata = {
  title: "About Us — SparkL",
  description:
    "SparkL is a past question and study platform built for Nigerian tertiary institution students. Learn who we are, why we built it, and where we're going.",
};

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main>
        <AboutHero />
        <AboutMission />
        <AboutValues />
        <AboutPillars />
        <AboutCTA />
      </main>
      <Footer />
    </>
  );
}