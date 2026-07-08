import { Hero } from "@/components/landing/hero";
import { FeaturesGrid } from "@/components/landing/features-grid";
import { HowItWorks } from "@/components/landing/how-it-works";
import { CtaSection } from "@/components/landing/cta-section";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <FeaturesGrid />
      <HowItWorks />
      <CtaSection />
    </>
  );
}
