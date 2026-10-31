import React, { useState, useEffect } from 'react';
import {
  Play,
  Shield,
  Zap,
  Activity,
  Clock,
  Mic,
  TrendingUp,
  Cpu,
  Flame,
  ShieldAlert,
  Snowflake,
  Volume2,
  Sparkles,
  Award,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';

interface HeroSectionProps {
  onExploreClick?: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onExploreClick }) => {
  // 1. Countdown timer from 18s down to 00:00
  const [countdown, setCountdown] = useState<number>(18);
  const [isTimeFrozen, setIsTimeFrozen] = useState<boolean>(false);

  useEffect(() => {
    if (isTimeFrozen) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 18));
    }, 1000);
    return () => clearInterval(timer);
  }, [isTimeFrozen]);

  const formattedCountdown = `00:${String(countdown).padStart(2, '0')}`;

  // 2. 4 Boss Roster
  const bosses = [
    {
      id: 'market',
      name: 'Shark Trần Nam',
      role: 'MARKET SHARK',
      level: 'LV.98',
      icon: TrendingUp,
      accentColor: 'text-amber-700',
      badgeBg: 'bg-amber-100 border-amber-300 text-amber-800',
      question:
        'Trong Slide 4, bạn công bố CAC là $12 nhưng LTV dự phóng tận $480. Mô hình hòa vốn của bạn dựa trên cơ sở nào?',
    },
    {
      id: 'tech',
      name: 'TS. Lê Minh Trang',
      role: 'AI SENTINEL',
      level: 'LV.92',
      icon: Cpu,
      accentColor: 'text-cyan-700',
      badgeBg: 'bg-cyan-100 border-cyan-300 text-cyan-800',
      question:
        'Kiến trúc In-Memory RAG của bạn sử dụng thuật toán Vector nào và cơ chế xử lý khi mô hình AI hallucination là gì?',
    },
    {
      id: 'finance',
      name: 'GS. Vũ Hoàng',
      role: 'FINANCE DRAGON',
      level: 'LV.95',
      icon: Flame,
      accentColor: 'text-orange-700',
      badgeBg: 'bg-orange-100 border-orange-300 text-orange-800',
      question:
        'Dòng tiền âm trong 12 tháng đầu sẽ được bù đắp từ đâu nếu tỷ lệ burn rate tăng 25% do chi phí hạ tầng GPU?',
    },
    {
      id: 'risk',
      name: 'ThS. Đặng Mai Lan',
      role: 'RISK STRATEGIST',
      level: 'LV.94',
      icon: ShieldAlert,
      accentColor: 'text-purple-700',
      badgeBg: 'bg-purple-100 border-purple-300 text-purple-800',
      question:
        'Kế hoạch dự phòng tuân thủ bảo mật dữ liệu và bảo hộ quyền sở hữu trí tuệ đã có cam kết pháp lý ràng buộc chưa?',
    },
  ];

  const [selectedBossIndex, setSelectedBossIndex] = useState<number>(0);
  const currentBoss = bosses[selectedBossIndex];

  // 3. Typewriter effect for selected Boss question
  const [displayedText, setDisplayedText] = useState<string>('');

  useEffect(() => {
    let index = 0;
    let timer: NodeJS.Timeout;
    setDisplayedText('');

    const streamNextChar = () => {
      index++;
      setDisplayedText(currentBoss.question.slice(0, index));

      if (index < currentBoss.question.length) {
        const currentChar = currentBoss.question[index - 1];
        const delay = currentChar === ',' || currentChar === '.' ? 220 : 65;
        timer = setTimeout(streamNextChar, delay);
      } else {
        timer = setTimeout(() => {
          setDisplayedText('');
          index = 0;
          timer = setTimeout(streamNextChar, 500);
        }, 6000);
      }
    };

    timer = setTimeout(streamNextChar, 350);
    return () => clearTimeout(timer);
  }, [selectedBossIndex]);

  // 4. Animated ellipsis for VAD status
  const [dotCount, setDotCount] = useState<number>(3);
  useEffect(() => {
    const dotTimer = setInterval(() => {
      setDotCount((prev) => (prev % 3) + 1);
    }, 450);
    return () => clearInterval(dotTimer);
  }, []);

  // 5. Glitch Number Scrambler for Quick Metrics
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
    <section className="relative w-full max-w-7xl mx-auto px-6 pt-12 pb-16">
      {/* 1. Centered Hero Header (Warm Bronze Game Palette) */}
      <div className="text-center max-w-4xl mx-auto flex flex-col items-center gap-5 mb-12">
        {/* Live Voxel Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#FEF3C7] border border-[#F59E0B]/50 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-[#D97706] animate-pulse" />
          <span className="font-pixel text-[10px] text-[#92400E] uppercase tracking-wider font-bold">
            LIVE VOXEL ARENA // GEMINI 2.5 FLASH AUDIO STREAMING
          </span>
        </div>

        {/* Main Headline */}
        <h1 className="font-headline text-4xl sm:text-6xl lg:text-7xl text-[#1C1917] tracking-tight font-black uppercase leading-tight drop-shadow-sm">
          <span className="glitch-loop inline-block">PITCH ARENA</span>
        </h1>

        {/* Sub-headline */}
        <h2 className="font-headline text-xl sm:text-2xl lg:text-3xl text-[#44403C] tracking-tight leading-snug font-bold max-w-3xl">
          Tôi Luyện Đối Chất <span className="text-[#B45309] underline decoration-[#D97706]/40 decoration-4 underline-offset-4">Trước Hội Đồng Giám Khảo</span>.
        </h2>

        {/* Description */}
        <p className="font-sans text-sm sm:text-base text-[#57534E] leading-relaxed max-w-2xl">
          Mô phỏng áp lực phòng thi thật với 4 vị giám khảo. Bóc tách lỗ hổng đề tài, bắt bẫy ngụy biện và tổng hợp nội dung quá trình đối chất trong môi trường Obsidian thời gian thực.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <button
            type="button"
            onClick={onExploreClick}
            className="group inline-flex items-center gap-2 bg-[#D97706] hover:bg-[#B45309] text-white font-bold font-pixel text-xs px-7 py-3.5 rounded-xl uppercase tracking-wider shadow-[0_4px_16px_rgba(217,119,6,0.35)] hover:shadow-[0_6px_22px_rgba(217,119,6,0.45)] active:translate-y-0.5 transition-all duration-150 select-none cursor-pointer"
          >
            <Play className="w-4 h-4 text-white fill-white group-hover:scale-110 transition-transform duration-200" />
            <span>[ NẠP ĐỀ TÀI NGAY ]</span>
          </button>

          <a
            href="#jury-council"
            className="inline-flex items-center gap-2 bg-[#FFFFFF] hover:bg-[#F5EFEB] text-[#1C1917] hover:text-[#B45309] border border-[#D97706]/35 font-mono text-xs px-6 py-3.5 rounded-xl uppercase tracking-wider shadow-sm transition-all font-bold"
          >
            <Shield className="w-4 h-4 text-[#B45309]" />
            <span>HỘI ĐỒNG GIÁM KHẢO</span>
          </a>
        </div>

        {/* Telemetry Metric Badges */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <div
            onMouseEnter={() =>
              triggerGlitch('latency', '220 ms', ['184 ms', '248 ms', '219 ms'])
            }
            className="group px-4 py-2 rounded-lg bg-[#FFFFFF] border border-[#D97706]/25 hover:border-[#D97706] transition-all cursor-pointer flex items-center gap-2 shadow-xs"
          >
            <Clock className="w-3.5 h-3.5 text-[#B45309] group-hover:scale-110 transition-transform" />
            <span className="font-mono text-[11px] text-[#78716C] group-hover:text-[#1C1917] uppercase font-bold">
              ĐỘ TRỄ GIỌNG:
            </span>
            <span
              className={`font-mono text-xs text-[#B45309] font-bold ${
                activeGlitchKey === 'latency' ? 'glitch-text' : ''
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
            className="group px-4 py-2 rounded-lg bg-[#FFFFFF] border border-[#D97706]/25 hover:border-[#D97706] transition-all cursor-pointer flex items-center gap-2 shadow-xs"
          >
            <Zap className="w-3.5 h-3.5 text-[#B45309] group-hover:scale-110 transition-transform" />
            <span className="font-mono text-[11px] text-[#78716C] group-hover:text-[#1C1917] uppercase font-bold">
              ĐỘ CHÍNH XÁC:
            </span>
            <span
              className={`font-mono text-xs text-[#B45309] font-bold ${
                activeGlitchKey === 'accuracy' ? 'glitch-text' : ''
              }`}
            >
              {glitchValues.accuracy}
            </span>
          </div>

          <div
            onMouseEnter={() =>
              triggerGlitch('floor', '20% HP', ['18% HP', '24% HP', '19% HP'])
            }
            className="group px-4 py-2 rounded-lg bg-[#FFFFFF] border border-[#D97706]/25 hover:border-[#D97706] transition-all cursor-pointer flex items-center gap-2 shadow-xs"
          >
            <Shield className="w-3.5 h-3.5 text-[#B45309] group-hover:scale-110 transition-transform" />
            <span className="font-mono text-[11px] text-[#78716C] group-hover:text-[#1C1917] uppercase font-bold">
              SÀN BẢO HIỂM:
            </span>
            <span
              className={`font-mono text-xs text-[#B45309] font-bold ${
                activeGlitchKey === 'floor' ? 'glitch-text' : ''
              }`}
            >
              {glitchValues.floor}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Seamless Monolithic Horizontal Deck (Các thẻ nằm sáp nhau hoàn toàn qua divide-x) */}
      <div className="w-full bg-[#FFFFFF] border border-[#D97706]/30 rounded-2xl shadow-[0_12px_48px_rgba(217,119,6,0.08)] overflow-hidden flex flex-col xl:flex-row divide-y xl:divide-y-0 xl:divide-x divide-[#D97706]/20">
        
        {/* KHỐI TRÁI: CARD LỚN TRỌNG TÂM (~38% Width) - SÂN KHẤU CHẤT VẤN BOSS */}
        <div className="w-full xl:w-5/12 bg-[#FAF8F5] p-5 md:p-6 flex flex-col justify-between gap-5 relative">
          {/* Header Bar của Boss Arena */}
          <div className="flex items-center justify-between pb-3 border-b border-[#D97706]/20">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#D97706] animate-pulse" />
              <span className="font-pixel text-xs text-[#92400E] uppercase font-bold">
                ARENA STAGE // CHỌN BOSS CHẤT VẤN
              </span>
            </div>

            {/* Countdown Badge */}
            <div
              className={`px-2.5 py-1 rounded font-mono text-xs font-bold flex items-center gap-1.5 ${
                isTimeFrozen
                  ? 'bg-cyan-100 border border-cyan-400 text-cyan-800 shadow-xs'
                  : 'bg-[#FEF3C7] border border-[#F59E0B]/50 text-[#92400E]'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{isTimeFrozen ? 'FROZEN 00:30' : formattedCountdown}</span>
            </div>
          </div>

          {/* 4 Boss Selection Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {bosses.map((b, idx) => {
              const isSelected = selectedBossIndex === idx;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedBossIndex(idx)}
                  className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                    isSelected
                      ? 'bg-[#FFFFFF] border-[#D97706] shadow-sm ring-1 ring-[#D97706]'
                      : 'bg-[#F5EFEB] border-[#D97706]/20 hover:border-[#D97706]/50 text-[#78716C]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-pixel text-[8px] uppercase tracking-wider text-[#78716C]">
                      {b.role}
                    </span>
                    <span className={`font-pixel text-[8px] font-bold ${b.accentColor}`}>
                      {b.level}
                    </span>
                  </div>
                  <span
                    className={`font-headline text-xs font-bold truncate ${
                      isSelected ? 'text-[#1C1917]' : 'text-[#57534E]'
                    }`}
                  >
                    {b.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Typewriter Interrogation Terminal */}
          <div className="relative bg-[#FFFFFF] border border-[#D97706]/30 rounded-xl p-4 min-h-[110px] flex flex-col justify-center shadow-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-pixel text-[9px] text-[#B45309] uppercase tracking-wider flex items-center gap-1.5 font-bold">
                <Volume2 className="w-3.5 h-3.5 text-[#D97706]" />
                [ {currentBoss.name} ĐANG CHẤT VẤN ]
              </span>
              <span className="font-mono text-[9px] text-[#78716C] font-bold">220MS VAD</span>
            </div>
            <p className="font-sans text-sm md:text-base text-[#1C1917] italic leading-relaxed">
              "{displayedText}
              <span className="inline-block animate-pulse font-mono font-bold text-[#D97706] not-italic ml-0.5 text-lg">
                _
              </span>
              "
            </p>
          </div>

          {/* Telemetry Bar của Card Lớn */}
          <div className="flex items-center justify-between pt-2 border-t border-[#D97706]/20 text-xs font-mono">
            <div className="flex items-center gap-2 text-[#1C1917]">
              <span className="text-[#D97706] font-bold">▶</span>
              <span className="font-bold text-[11px]">VAD: DEFENDING</span>
              <span className="text-[#D97706] font-bold tracking-widest">
                {'.'.repeat(dotCount)}
              </span>
            </div>

            <div className="flex items-center gap-2 font-pixel text-[9px] text-[#78716C]">
              <span>HP 80%</span>
              <span className="w-16 h-2 bg-neutral-200 rounded-sm overflow-hidden flex">
                <div className="h-full bg-gradient-to-r from-emerald-600 to-[#D97706] w-4/5" />
              </span>
            </div>
          </div>
        </div>

        {/* KHỐI PHẢI: DÀN 4 CARD NHỎ NẰM NGANG SÁP VÁCH NHAU (~62% Width) */}
        <div className="w-full xl:w-7/12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#D97706]/20 bg-[#FFFFFF]">
          
          {/* Card Nhỏ 1: Bản Lĩnh Đối Soát Số Liệu */}
          <div className="p-5 flex flex-col justify-between gap-3 hover:bg-[#FAF8F5] transition-colors group">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-amber-100 text-[#92400E] font-pixel text-[8px] font-bold uppercase border border-amber-300">
                  THU HOẠCH 01
                </span>
                <Award className="w-3.5 h-3.5 text-[#D97706]" />
              </div>
              <h3 className="font-headline text-sm font-bold text-[#1C1917] group-hover:text-[#B45309] transition-colors leading-snug">
                Bản Lĩnh Đối Soát Số Liệu
              </h3>
              <p className="font-sans text-xs text-[#57534E] leading-relaxed">
                Bóc tách chi phí CAC $12 vs LTV $480 trực tiếp từ Slide 4, đối soát 99.4% không bị bẫy ngụy biện.
              </p>
            </div>
            <div className="pt-2 border-t border-[#D97706]/15 font-mono text-[10px] text-[#B45309] font-bold flex items-center justify-between">
              <span>+150 XP</span>
              <span className="font-pixel text-[8px] text-[#78716C]">DATA CORE</span>
            </div>
          </div>

          {/* Card Nhỏ 2: Kiểm Soát Nhịp Nói 135 WPM */}
          <div className="p-5 flex flex-col justify-between gap-3 hover:bg-[#FAF8F5] transition-colors group">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-pixel text-[8px] font-bold uppercase border border-emerald-300">
                  THU HOẠCH 02
                </span>
                <Mic className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <h3 className="font-headline text-sm font-bold text-[#1C1917] group-hover:text-emerald-700 transition-colors leading-snug">
                Kiểm Soát Nhịp Nói 135 WPM
              </h3>
              <p className="font-sans text-xs text-[#57534E] leading-relaxed">
                Streaming WebRTC bắt khoảng lặng &gt; 2.0s. Luyện phản xạ nói lưu loát, tự tin trước hội đồng.
              </p>
            </div>
            <div className="pt-2 border-t border-[#D97706]/15 font-mono text-[10px] text-emerald-700 font-bold flex items-center justify-between">
              <span>135 WPM</span>
              <span className="font-pixel text-[8px] text-[#78716C]">VOICE STT</span>
            </div>
          </div>

          {/* Card Nhỏ 3: Phao Cứu Sinh Strike 2 */}
          <div className="p-5 flex flex-col justify-between gap-3 hover:bg-[#FAF8F5] transition-colors group">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-cyan-100 text-cyan-800 font-pixel text-[8px] font-bold uppercase border border-cyan-300">
                  THU HOẠCH 03
                </span>
                <Snowflake className="w-3.5 h-3.5 text-cyan-600" />
              </div>
              <h3 className="font-headline text-sm font-bold text-[#1C1917] group-hover:text-cyan-700 transition-colors leading-snug">
                Phao Cứu Sinh Strike 2
              </h3>
              <p className="font-sans text-xs text-[#57534E] leading-relaxed">
                Bấm quyền đóng băng 30s để hội ý khi lúng túng, chuyển sang chế độ sư phạm gợi ý gỡ điểm.
              </p>

              {/* Interactive Freeze Button */}
              <button
                type="button"
                onClick={() => setIsTimeFrozen(!isTimeFrozen)}
                className={`mt-1 py-1 px-2 rounded font-pixel text-[8px] font-bold uppercase transition-all flex items-center justify-center gap-1 border cursor-pointer ${
                  isTimeFrozen
                    ? 'bg-cyan-600 text-white border-cyan-700 shadow-xs'
                    : 'bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]/50 hover:bg-[#FDE68A]'
                }`}
              >
                <Snowflake className={`w-3 h-3 ${isTimeFrozen ? 'animate-spin' : ''}`} />
                <span>{isTimeFrozen ? 'ĐÃ ĐÓNG BĂNG 30S' : 'THỬ ĐÓNG BĂNG 30S'}</span>
              </button>
            </div>

            <div className="pt-2 border-t border-[#D97706]/15 font-mono text-[10px] text-cyan-700 font-bold flex items-center justify-between">
              <span>PANIC 30S</span>
              <span className="font-pixel text-[8px] text-[#78716C]">LIFELINE</span>
            </div>
          </div>

          {/* Card Nhỏ 4: Báo Cáo Đối Chất 3 Cột */}
          <div className="p-5 flex flex-col justify-between gap-3 hover:bg-[#FAF8F5] transition-colors group">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-pixel text-[8px] font-bold uppercase border border-purple-300">
                  THU HOẠCH 04
                </span>
                <BookOpen className="w-3.5 h-3.5 text-purple-600" />
              </div>
              <h3 className="font-headline text-sm font-bold text-[#1C1917] group-hover:text-purple-700 transition-colors leading-snug">
                Báo Cáo Đối Chất 3 Cột
              </h3>
              <p className="font-sans text-xs text-[#57534E] leading-relaxed">
                Xuất bản đồ vá lỗ hổng luận điểm đối chiếu nguồn RAG chi tiết để tái đấu đạt điểm A+.
              </p>
            </div>
            <div className="pt-2 border-t border-[#D97706]/15 font-mono text-[10px] text-purple-700 font-bold flex items-center justify-between">
              <span>DIAGNOSTIC</span>
              <span className="font-pixel text-[8px] text-[#78716C]">MATRIX</span>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
