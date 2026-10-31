import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { ProjectWorkflow } from './components/ProjectWorkflow';
import { JuryCouncil } from './components/JuryCouncil';
import { Subsystems } from './components/Subsystems';
import { Footer } from './components/Footer';
import { ArenaPage } from './pages/ArenaPage';

const getInitialView = (): 'landing' | 'arena' => {
  if (typeof window !== 'undefined' && window.location.hash.startsWith('#arena')) {
    return 'arena';
  }
  return 'landing';
};

const getInitialStep = (): 1 | 2 | 3 | 4 | 5 => {
  if (typeof window !== 'undefined') {
    const stepMatch = window.location.hash.match(/#arena-step-(\d)/);
    if (stepMatch) return Number(stepMatch[1]) as 1 | 2 | 3 | 4 | 5;
  }
  return 1;
};

export default function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'arena'>(getInitialView);
  const [arenaStep, setArenaStep] = useState<1 | 2 | 3 | 4 | 5>(getInitialStep);

  // Đồng bộ hash URL để hỗ trợ nút Back/Forward của trình duyệt và reload trang
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#arena')) {
        const stepMatch = hash.match(/#arena-step-(\d)/);
        const step = stepMatch ? (Number(stepMatch[1]) as 1 | 2 | 3 | 4 | 5) : 1;
        setArenaStep(step);
        setCurrentView('arena');
      } else {
        setCurrentView('landing');
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const openArena = (step: 1 | 2 | 3 | 4 | 5 = 1) => {
    setArenaStep(step);
    setCurrentView('arena');
    window.location.hash = `#arena-step-${step}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeArena = () => {
    setCurrentView('landing');
    window.location.hash = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background text-on-surface font-sans selection:bg-black selection:text-white">
      {/* Subtle CRT Overlay */}
      <div className="fixed inset-0 crt-overlay z-40 pointer-events-none" />

      {currentView === 'arena' ? (
        /* TRANG ĐẤU TRƯỜNG CHUYÊN BIỆT (DEDICATED 4-STEP ARENA PAGE) */
        <ArenaPage initialStep={arenaStep} onBackToHome={closeArena} />
      ) : (
        /* TRANG CHỦ SHOWCASE (LANDING PAGE) */
        <div className="relative z-10 flex flex-col min-h-screen bg-[#F7F5F0] text-[#1C1917]">
          <Navbar onStartClick={() => openArena(1)} />

          <main className="flex-1">
            <HeroSection onExploreClick={() => openArena(1)} />

            {/* Quy trình 4 bước: Bấm vào bất kỳ bước nào sẽ mở đúng bước đó trên trang Đấu trường */}
            <ProjectWorkflow onStepClick={(step) => openArena(step)} />

            <JuryCouncil />
            <Subsystems />
          </main>

          <Footer />
        </div>
      )}
    </div>
  );
}
