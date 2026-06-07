import './index.css';
import Navbar from './components/Navbar.jsx';
import Hero from './components/sections/Hero.jsx';
import CrisisStrip from './components/sections/CrisisStrip.jsx';
import BreakpointsSection from './components/sections/BreakpointsSection.jsx';
import SolutionSection from './components/sections/SolutionSection.jsx';
import FunnelSection from './components/sections/FunnelSection.jsx';
import TechStackSection from './components/sections/TechStackSection.jsx';
import ImpactSection from './components/sections/ImpactSection.jsx';
import QuoteSection from './components/sections/QuoteSection.jsx';
import FinalCTA from './components/sections/FinalCTA.jsx';
import Footer from './components/sections/Footer.jsx';

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <CrisisStrip />
        <BreakpointsSection />
        <SolutionSection />
        <FunnelSection />
        <TechStackSection />
        <ImpactSection />
        <QuoteSection />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
