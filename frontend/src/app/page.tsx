import Navbar from "@/components/layout/navbar";
import HeroSection from "@/components/home/herosection";
import StatsSection from "@/components/home/statsection";
import HowItWorks from "@/components/home/howitworks";

export default function Home() {
  return (
    <>
      <Navbar />
      <HeroSection />
      <StatsSection />
      <HowItWorks />
    </>
  );
}