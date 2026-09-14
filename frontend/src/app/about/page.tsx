import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import AboutHero from "@/components/about/about-hero";
import AboutMission from "@/components/about/about-mission";
import AboutTeam from "@/components/about/about-team";
import AboutValues from "@/components/about/about-values";
import AboutCTA from "@/components/about/about-cta";

export const metadata = {
  title: "About Us — SparkL",
  description:
    "SparkL is a past question and study platform built for Nigerian polytechnic students. Learn who we are, why we built it, and where we're going.",
};

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main>
        <AboutHero />
        <AboutMission />
        <AboutValues />
        <AboutTeam />
        <AboutCTA />
      </main>
      <Footer />
    </>
  );
}