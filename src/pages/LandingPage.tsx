import React from 'react';
import LandingNav from '@/components/landing/LandingNav';
import HeroSection from '@/components/landing/HeroSection';
import ProblemSection from '@/components/landing/ProblemSection';
import SimulatorSection from '@/components/landing/SimulatorSection';
import FeaturesSection from '@/components/landing/FeaturesSection';
import SocialProofSection from '@/components/landing/SocialProofSection';
import PricingSection from '@/components/landing/PricingSection';
import FinalCTASection from '@/components/landing/FinalCTASection';
import LandingFooter from '@/components/landing/LandingFooter';

const LandingPage: React.FC = () => (
  <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
    <LandingNav />
    <HeroSection />
    <ProblemSection />
    <SimulatorSection />
    <FeaturesSection />
    <SocialProofSection />
    <PricingSection />
    <FinalCTASection />
    <LandingFooter />
  </div>
);

export default LandingPage;
