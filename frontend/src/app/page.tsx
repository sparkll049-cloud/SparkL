import Navbar from "@/components/layout/navbar";
import HeroSection from "@/components/home/herosection";
import StatsSection from "@/components/home/statsection";
import WhyChooseUs from "@/components/home/whychooseus";

export default function Home() {
  return (
    <>
      <Navbar />
      <HeroSection />
      <StatsSection />
      <WhyChooseUs />
    </>
  );
}