import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { ProjectWorkflow } from './components/ProjectWorkflow';
import { JuryCouncil } from './components/JuryCouncil';
import { Subsystems } from './components/Subsystems';
import { Footer } from './components/Footer';
import { DocumentAnalysisResult } from '@pitcharena/shared';

export default function App() {
  const [analysisResult, setAnalysisResult] =
    useState<DocumentAnalysisResult | null>(null);

  const scrollToWorkflow = () => {
    const el = document.getElementById('uploader');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-surface font-sans selection:bg-black selection:text-white">
      {/* Subtle CRT Overlay */}
      <div className="fixed inset-0 crt-overlay z-40 pointer-events-none" />

      {/* Main Page Layout */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar onStartClick={scrollToWorkflow} />
        
        <main className="flex-1">
          <HeroSection onExploreClick={scrollToWorkflow} />

          {/* 3-Step Project Workflow Section with integrated Uploader */}
          <ProjectWorkflow
            onAnalysisComplete={(res) => setAnalysisResult(res)}
          />

          <JuryCouncil />
          <Subsystems />
        </main>

        <Footer />
      </div>
    </div>
  );
}
