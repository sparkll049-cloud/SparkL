import Navbar from "@/components/layout/navbar";
import HeroSection from "@/components/home/herosection";
import StatsSection from "@/components/home/statsection";
import HowItWorks from "@/components/home/howitworks";
import TrendingTopics from "@/components/home/trendingtopics";
import Testimonial from "@/components/home/testimonial";
import WhyChooseUs from "@/components/home/whychooseus";

export default function Home() {
  return (
    <>
      <Navbar />
      <HeroSection />
      <StatsSection />
      <HowItWorks />
      <TrendingTopics />
      <Testimonial />
      <WhyChooseUs />
    </>
  );
}