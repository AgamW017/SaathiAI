"use client";

import Navbar from '../components/Navbar';
import Hero from '../components/sections/Hero';
import ScrollingWorkers from '../components/ui/ScrollingWorkers';
import CrisisStrip from '../components/sections/CrisisStrip';
import BreakpointsSection from '../components/sections/BreakpointsSection';
import SolutionSection from '../components/sections/SolutionSection';
import FunnelSection from '../components/sections/FunnelSection';
import TechStackSection from '../components/sections/TechStackSection';
import ImpactSection from '../components/sections/ImpactSection';
import QuoteSection from '../components/sections/QuoteSection';
import LanguageShowcase from '../components/sections/LanguageShowcase';
import FinalCTA from '../components/sections/FinalCTA';
import WorkingIntelligenceSection from '../components/sections/WorkingIntelligenceSection';
import Footer from '../components/sections/Footer';

export default function Page() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        {/* Full-width infinite marquee — placed immediately below the Hero */}
        <ScrollingWorkers />
        <CrisisStrip />
        <BreakpointsSection />
        <SolutionSection />
        <FunnelSection />
        <TechStackSection />
        <WorkingIntelligenceSection />
        <ImpactSection />
        <QuoteSection />
        <LanguageShowcase />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}

