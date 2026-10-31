import React from 'react';
import {
  Layers,
  Mic,
  Heart,
  Shield,
  Swords,
} from 'lucide-react';

interface WeaponItem {
  id: string;
  serial: string;
  tier: string;
  badgeBg: string;
  epithet: string;
  title: string;
  systemName: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
}

export const Subsystems: React.FC = () => {
  const weapons: WeaponItem[] = [
    {
      id: 'rag',
      serial: '#WPN-01',
      tier: 'TIER S+ MYTHIC',
      badgeBg: 'bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]/50',
      epithet: 'Thiên Lý Nhãn Dữ Liệu',
      title: 'Bóc Tách 5 Khối Chuyên Môn',
      systemName: 'NestJS In-Memory RAG Engine',
      desc: 'Tự động loại bỏ ảnh chụp màn hình rác, bóc tách trực tiếp số liệu vào bảng Whitelist để đối soát chính xác câu trả lời.',
      icon: Layers,
      accentColor: 'text-[#B45309]',
    },
    {
      id: 'vad',
      serial: '#WPN-02',
      tier: 'TIER S+ SENSOR',
      badgeBg: 'bg-cyan-100 text-cyan-800 border-cyan-300',
      epithet: 'Linh Thính Độc Âm',
      title: 'Phản Hồi Nhanh',
      systemName: 'Voice & VAD Engine',
      desc: 'Nhận diện giọng nói STT qua WebRTC. Bắt khoảng lặng ngập ngừng 2.0s để Boss Giám khảo can thiệp khi thí sinh lúng túng.',
      icon: Mic,
      accentColor: 'text-cyan-700',
    },
    {
      id: 'hp',
      serial: '#WPN-03',
      tier: 'TIER SS BATTLE',
      badgeBg: 'bg-rose-100 text-rose-800 border-rose-300',
      epithet: 'Huyết Lôi Trảm',
      title: 'Thanh Máu Đối Kháng',
      systemName: 'Combat HP & Conviction Engine',
      desc: 'Phạt trừ -15% máu khi thí sinh viện dẫn sai số liệu hoặc ngụy biện, kèm âm thanh retro và hiệu ứng giật nảy màn hình.',
      icon: Heart,
      accentColor: 'text-rose-700',
    },
    {
      id: 'shield',
      serial: '#WPN-04',
      tier: 'TIER S+ AEGIS',
      badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      epithet: 'Kim Cang Hộ Mệnh',
      title: 'Sàn Máu Bảo Vệ 20%',
      systemName: 'Pedagogical Shield & Strike 2 Freeze',
      desc: 'Khi sinh lực chạm ngưỡng nguy hiểm 20%, hệ thống tự động khóa trừ máu và chuyển sang hướng dẫn sư phạm gợi ý.',
      icon: Shield,
      accentColor: 'text-emerald-700',
    },
  ];

  return (
    <section id="subsystems" className="w-full py-20 bg-[#F7F5F0] border-t border-[#D97706]/20 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 flex flex-col gap-10 relative z-10">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b border-[#D97706]/20">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FEF3C7] border border-[#F59E0B]/50 mb-3 shadow-xs">
              <Swords className="w-3.5 h-3.5 text-[#D97706]" />
              <span className="font-pixel text-[10px] text-[#92400E] uppercase tracking-wider font-bold">
                BINH KHÍ PHỔ // TACTICAL WEAPON ARSENAL
              </span>
            </div>
            <h2 className="font-headline text-2xl md:text-4xl font-black text-[#1C1917] uppercase tracking-tight">
              4 Vũ Khí Công Nghệ Cốt Lõi
            </h2>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="px-4 py-2 rounded-xl bg-[#FAF8F5] border border-[#D97706]/30 shadow-xs flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono text-xs font-bold text-[#1C1917]">
                KHO VŨ KHÍ: 4/4 SẴN SÀNG CHIẾN ĐẤU
              </span>
            </div>
          </div>
        </div>

        {/* 4 TACTICAL WEAPON RPG CARDS (BINH KHÍ PHỔ DECK) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {weapons.map((w) => {
            const Icon = w.icon;

            return (
              <div
                key={w.id}
                className="flex flex-col justify-between rounded-2xl bg-[#FFFFFF] border border-[#D97706]/25 hover:border-[#B45309] hover:shadow-[0_16px_36px_rgba(217,119,6,0.14)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden shadow-sm p-6"
              >
                {/* Decorative Top Accent Notch */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#D97706]/40" />

                <div className="flex flex-col gap-4">
                  {/* Card Serial & Tier Header */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="font-mono text-[10px] font-black text-[#78716C] tracking-widest">
                      {w.serial}
                    </span>
                    <span className={`font-pixel text-[8px] px-2 py-0.5 rounded uppercase border font-black tracking-wide ${w.badgeBg}`}>
                      {w.tier}
                    </span>
                  </div>

                  {/* Weapon Epithet & Avatar Ring */}
                  <div className="flex items-center gap-3.5 pt-1">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border bg-[#FAF8F5] border-[#D97706]/30 shadow-xs">
                      <Icon className={`w-6 h-6 ${w.accentColor}`} />
                    </div>
                    <div>
                      <span className="font-pixel text-[9px] text-[#B45309] uppercase block font-bold">
                        {w.epithet}
                      </span>
                      <h3 className="font-headline text-lg font-black text-[#1C1917] leading-tight">
                        {w.title}
                      </h3>
                    </div>
                  </div>

                  {/* Subsystem Name Tag */}
                  <div className="font-mono text-[10px] font-bold text-[#78716C] uppercase bg-[#FAF8F5] px-2.5 py-1.5 rounded-md border border-[#D97706]/15">
                    {w.systemName}
                  </div>

                  {/* Description */}
                  <p className="font-sans text-xs text-[#57534E] leading-relaxed">
                    {w.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
