import React, { useState, useEffect } from 'react';
import { Play, Shield, Zap, Activity, Clock } from 'lucide-react';

interface HeroSectionProps {
  onExploreClick?: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onExploreClick }) => {
  // 1. Countdown timer from 18s down to 00:00 (loops smoothly)
  const [countdown, setCountdown] = useState<number>(18);
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 18));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format mm:ss (e.g., 00:18)
  const formattedCountdown = `00:${String(countdown).padStart(2, '0')}`;

  // 2. Typewriter / Streaming terminal effect for Boss question (Natural, steady pace)
  const fullQuestion =
    'Trong Slide 4, bạn công bố CAC là $12 nhưng LTV dự phóng tận $480. Mô hình hòa vốn của bạn dựa trên cơ sở nào?';
  const [displayedText, setDisplayedText] = useState<string>('');

  useEffect(() => {
    let index = 0;
    let timer: NodeJS.Timeout;

    const streamNextChar = () => {
      index++;
      setDisplayedText(fullQuestion.slice(0, index));

      if (index < fullQuestion.length) {
        const currentChar = fullQuestion[index - 1];
        // Nhịp nghỉ nhẹ tự nhiên khi gặp dấu phẩy hoặc dấu chấm (250ms), chữ thường là 75ms
        const delay = currentChar === ',' || currentChar === '.' ? 250 : 75;
        timer = setTimeout(streamNextChar, delay);
      } else {
        // Khi gõ xong, dừng lại nhấp nháy con trỏ thong thả 5.5 giây để đọc trọn vẹn
        timer = setTimeout(() => {
          setDisplayedText('');
          index = 0;
          timer = setTimeout(streamNextChar, 600);
        }, 5500);
      }
    };

    // Bắt đầu sau khi load 500ms
    timer = setTimeout(streamNextChar, 500);

    return () => clearTimeout(timer);
  }, []);

  // 3. Animated ellipsis for VAD status (... jumping dots)
  const [dotCount, setDotCount] = useState<number>(3);
  useEffect(() => {
    const dotTimer = setInterval(() => {
      setDotCount((prev) => (prev % 3) + 1);
    }, 450);
    return () => clearInterval(dotTimer);
  }, []);

  // 4. Glitch Number Scrambler for Quick Metrics
  const [glitchValues, setGlitchValues] = useState<{ [key: string]: string }>({
    latency: '220 ms',
    accuracy: '99.4% RAG',
    floor: '20% HP',
  });
  const [activeGlitchKey, setActiveGlitchKey] = useState<string | null>(null);

  const triggerGlitch = (
    key: 'latency' | 'accuracy' | 'floor',
    original: string,
    scrambleFrames: string[]
  ) => {
    setActiveGlitchKey(key);
    let step = 0;
    const interval = setInterval(() => {
      if (step < scrambleFrames.length) {
        setGlitchValues((prev) => ({ ...prev, [key]: scrambleFrames[step] }));
        step++;
      } else {
        setGlitchValues((prev) => ({ ...prev, [key]: original }));
        setActiveGlitchKey(null);
        clearInterval(interval);
      }
    }, 60);
  };

  return (
    <section className="relative w-full max-w-7xl mx-auto px-6 pt-10 pb-8">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-10">
        {/* Left Typography */}
        <div className="w-full lg:w-6/12 flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            {/* Heading 1: PITCH·ARENA with Glitch Effect */}
            <h1 className="font-headline text-4xl sm:text-5xl lg:text-6xl text-black tracking-tight font-black uppercase leading-none">
              <span className="glitch-loop inline-block">PITCH ARENA</span>
            </h1>

            {/* Sub-heading */}
            <h2 className="font-headline text-xl sm:text-2xl text-black tracking-tight leading-snug font-bold">
              Tôi Luyện Bản Lĩnh Đối Chất Trước Giờ G Hội Đồng.
            </h2>
          </div>

          <p className="font-sans text-sm text-neutral-700 leading-relaxed">
            Mô phỏng áp lực phòng thi thật với 3 vị giám khảo. Bóc tách lỗ hổng đề tài, bắt bẫy ngụy biện và tổng hợp nội dung quá trình đối chất.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-1">
            <a
              href="#uploader"
              className="group inline-flex items-center gap-2 bg-black text-white font-bold font-mono text-xs px-6 py-3 rounded uppercase tracking-wider border-2 border-black arcade-shadow hover:arcade-shadow hover:bg-neutral-900 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150 select-none"
            >
              <Play className="w-4 h-4 text-amber-400 fill-amber-400 animate-pulse group-hover:translate-x-1 group-hover:scale-110 transition-all duration-200" />
              <span>[ NẠP ĐỀ TÀI NGAY ]</span>
            </a>
            <a
              href="#jury-council"
              className="inline-flex items-center gap-2 bg-white hover:bg-neutral-100 active:translate-y-0.5 active:translate-x-0.5 text-black border-2 border-black font-mono text-xs px-5 py-3 rounded uppercase tracking-wider arcade-shadow transition-all font-bold"
            >
              <Shield className="w-4 h-4" />
              <span>HỘI ĐỒNG GIÁM KHẢO</span>
            </a>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div
              onMouseEnter={() =>
                triggerGlitch('latency', '220 ms', ['184 ms', '248 ms', '219 ms'])
              }
              className="group relative bg-white hover:bg-black text-black hover:text-white border-2 border-black hover:border-white p-3 rounded arcade-shadow-sm hover:arcade-shadow hover:-translate-y-1.5 hover:scale-105 hover:-rotate-2 hover:z-20 transition-all duration-200 cursor-pointer select-none"
            >
              <span className="font-mono text-[10px] text-neutral-500 group-hover:text-neutral-300 uppercase block font-bold flex items-center gap-1 transition-colors duration-200">
                <Clock className="w-3 h-3 text-neutral-700 group-hover:text-white group-hover:scale-110 transition-all duration-200" /> ĐỘ TRỄ GIỌNG
              </span>
              <span
                className={`font-mono text-sm text-black group-hover:text-white font-bold group-hover:tracking-wider transition-all duration-200 block ${
                  activeGlitchKey === 'latency' ? 'glitch-text text-amber-300' : ''
                }`}
              >
                {glitchValues.latency}
              </span>
            </div>

            <div
              onMouseEnter={() =>
                triggerGlitch('accuracy', '99.4% RAG', [
                  '97.8% RAG',
                  '99.9% RAG',
                  '98.5% RAG',
                ])
              }
              className="group relative bg-white hover:bg-black text-black hover:text-white border-2 border-black hover:border-white p-3 rounded arcade-shadow-sm hover:arcade-shadow hover:-translate-y-1.5 hover:scale-105 hover:-rotate-2 hover:z-20 transition-all duration-200 cursor-pointer select-none"
            >
              <span className="font-mono text-[10px] text-neutral-500 group-hover:text-neutral-300 uppercase block font-bold flex items-center gap-1 transition-colors duration-200">
                <Zap className="w-3 h-3 text-neutral-700 group-hover:text-white group-hover:scale-110 transition-all duration-200" /> ĐỘ CHÍNH XÁC
              </span>
              <span
                className={`font-mono text-sm text-black group-hover:text-white font-bold group-hover:tracking-wider transition-all duration-200 block ${
                  activeGlitchKey === 'accuracy' ? 'glitch-text text-amber-300' : ''
                }`}
              >
                {glitchValues.accuracy}
              </span>
            </div>

            <div
              onMouseEnter={() =>
                triggerGlitch('floor', '20% HP', ['18% HP', '24% HP', '19% HP'])
              }
              className="group relative bg-white hover:bg-black text-black hover:text-white border-2 border-black hover:border-white p-3 rounded arcade-shadow-sm hover:arcade-shadow hover:-translate-y-1.5 hover:scale-105 hover:-rotate-2 hover:z-20 transition-all duration-200 cursor-pointer select-none"
            >
              <span className="font-mono text-[10px] text-neutral-500 group-hover:text-neutral-300 uppercase block font-bold flex items-center gap-1 transition-colors duration-200">
                <Shield className="w-3 h-3 text-neutral-700 group-hover:text-white group-hover:scale-110 transition-all duration-200" /> SÀN BẢO HIỂM
              </span>
              <span
                className={`font-mono text-sm text-black group-hover:text-white font-bold group-hover:tracking-wider transition-all duration-200 block ${
                  activeGlitchKey === 'floor' ? 'glitch-text text-amber-300' : ''
                }`}
              >
                {glitchValues.floor}
              </span>
            </div>
          </div>
        </div>

        {/* Right Teaser Arena */}
        <div className="w-full lg:w-6/12 flex flex-col">
          <div className="bg-surface-container-low border-2 border-black rounded-xl p-4 arcade-shadow flex flex-col gap-3">
            <div className="flex items-center justify-between bg-white px-3 py-2 rounded border border-black/20">
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-black">
                <span>ARENA_VIEWPORT</span>
              </div>
            </div>

            <div className="relative w-full aspect-video bg-neutral-900 rounded overflow-hidden border-2 border-black p-4 flex flex-col justify-between">
              {/* HUD top bar */}
              <div className="flex items-center justify-between font-mono text-xs">
                {/* Green Health Bar */}
                <div className="bg-white px-2.5 py-1 rounded border border-black text-black font-bold flex items-center gap-2">
                  <span className="font-mono text-[10px] tracking-tight text-neutral-700">HP</span>
                  <div className="w-16 md:w-20 h-2.5 bg-neutral-200 border border-black rounded-sm overflow-hidden p-[1px] flex">
                    <div
                      className="h-full bg-emerald-500 rounded-sm shadow-sm transition-all duration-300"
                      style={{ width: '80%' }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-emerald-800 font-bold">80%</span>
                </div>

                <div className="bg-white px-2.5 py-1 rounded border border-black text-black font-bold">
                  BOSS: GS. VŨ HOÀNG
                </div>

                {/* Countdown Timer (e.g. 00:18) */}
                <div className="bg-white px-2.5 py-1 rounded border border-black text-black font-bold font-mono tracking-wider">
                  {formattedCountdown}
                </div>
              </div>

              {/* Interrogation box with Typewriter Streaming Effect */}
              <div className="my-auto bg-black/85 border border-neutral-700 p-4 rounded text-center max-w-sm mx-auto shadow-inner min-h-[96px] flex flex-col justify-center">
                <span className="font-mono text-[10px] text-neutral-400 uppercase font-bold tracking-widest block mb-1">
                  [SOLO BOSS CHẤT VẤN]
                </span>
                <p className="font-sans text-xs md:text-sm text-white italic leading-relaxed">
                  "{displayedText}
                  <span className="inline-block animate-pulse font-mono font-bold text-amber-400 not-italic ml-0.5 text-base">_</span>"
                </p>
              </div>

              {/* Bottom status with animated jumping dots */}
              <div className="flex items-center justify-between bg-white/95 px-3 py-1.5 rounded border border-black/20 font-mono text-[11px] font-bold">
                <span className="text-black flex items-center gap-1.5">
                  <span className="text-emerald-600 animate-pulse font-bold">▶</span>
                  <span>VAD: CANDIDATE DEFENDING</span>
                  <span className="inline-block w-4 text-left font-mono font-bold text-black tracking-widest">
                    {'.'.repeat(dotCount)}
                  </span>
                </span>
                <span className="text-neutral-500">220ms LATENCY</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-neutral-600 font-mono text-[10px] font-bold px-1">
              <span>CONTROLLER: WEB AUDIO SYNTHESIZER</span>
              <span className="text-black">100% IN-MEMORY RAG</span>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

