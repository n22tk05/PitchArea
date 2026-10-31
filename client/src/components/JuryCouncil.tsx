import React, { useState } from 'react';
import {
  Flame,
  Cpu,
  TrendingUp,
  Users,
  ShieldAlert,
  Sparkles,
  Volume2,
  Sword,
  Target,
  AlertTriangle,
  Award,
  ChevronRight,
} from 'lucide-react';

export const JuryCouncil: React.FC = () => {
  const [activeBossIndex, setActiveBossIndex] = useState<number>(0);

  const councilData = [
    {
      id: 'market-shark',
      personaTag: 'MARKET SHARK',
      name: 'Shark Trần Nam',
      level: 'LV.98',
      role: '1. Vấn đề & Thị trường',
      focus: 'TRỌNG TÂM: NHU CẦU THỰC',
      group: 'NHÓM 1',
      icon: TrendingUp,
      themeColor: 'amber',
      accentText: 'text-amber-700',
      badgeBg: 'bg-amber-100 text-[#92400E] border-amber-300',
      cardBorder: 'border-amber-400/40 hover:border-amber-500',
      activeRing: 'ring-2 ring-amber-500',
      stats: { rigor: 98, speed: '220ms', penalty: '-15% HP' },
      desc: 'Truy vấn nỗi đau thực tế của khách hàng, cơ sở khảo sát người dùng, và bằng chứng khách hàng sẵn sàng chi tiền.',
      signatureAttack:
        '“Bạn nói thị trường 10 tỷ đô, nhưng tuần rồi bạn chốt được bao nhiêu đơn hàng trả tiền thực tế?”',
      survivalTip:
        'Chuẩn bị sẵn số liệu khảo sát tối thiểu 100 khách hàng và bằng chứng sẵn sàng trả phí (Letter of Intent).',
    },
    {
      id: 'ai-sentinel',
      personaTag: 'AI SENTINEL',
      name: 'TS. Lê Minh Trang',
      level: 'LV.92',
      role: '2. Sản phẩm & Công nghệ',
      focus: 'TRỌNG TÂM: TECH CORE',
      group: 'NHÓM 2',
      icon: Cpu,
      themeColor: 'cyan',
      accentText: 'text-cyan-700',
      badgeBg: 'bg-cyan-100 text-cyan-800 border-cyan-300',
      cardBorder: 'border-cyan-400/40 hover:border-cyan-500',
      activeRing: 'ring-2 ring-cyan-500',
      stats: { rigor: 92, speed: '180ms', penalty: '-15% HP' },
      desc: 'Soi xét kiến trúc MVP, độ trễ phản hồi, tính độc quyền công nghệ lõi và cơ chế xử lý khi mô hình AI trả lời sai.',
      signatureAttack:
        '“Nếu OpenAI hoặc Google cập nhật mô hình mới vào ngày mai, giải pháp của bạn có bị biến thành vô nghĩa không?”',
      survivalTip:
        'Nhấn mạnh vào dữ liệu ngách độc quyền và thuật toán tiền xử lý Vector Chunking chuyên biệt không thể thay thế.',
    },
    {
      id: 'finance-dragon',
      personaTag: 'FINANCE DRAGON',
      name: 'GS. Vũ Hoàng',
      level: 'LV.95',
      role: '3. Mô hình KD & Tài chính',
      focus: 'TRỌNG TÂM: LÃI/LỖ & DÒNG TIỀN',
      group: 'NHÓM 3',
      icon: Flame,
      themeColor: 'orange',
      accentText: 'text-orange-700',
      badgeBg: 'bg-orange-100 text-orange-800 border-orange-300',
      cardBorder: 'border-orange-400/40 hover:border-orange-500',
      activeRing: 'ring-2 ring-orange-500',
      stats: { rigor: 95, speed: '250ms', penalty: '-20% HP' },
      desc: 'Bóc tách chi phí sản xuất, giá bán thực tế, lãi trên từng sản phẩm, điểm hòa vốn và nguồn vốn duy trì đội ngũ.',
      signatureAttack:
        '“Với chi phí hạ tầng máy chủ GPU đắt đỏ như hiện nay, biên lợi nhuận gộp của bạn lấy đâu ra 70% như đã vẽ?”',
      survivalTip:
        'Nêu rõ cơ chế tối ưu token caching và mô hình chi phí biến đổi (unit economics) bám sát thực tế thị trường.',
    },
    {
      id: 'risk-strategist',
      personaTag: 'RISK STRATEGIST',
      name: 'ThS. Đặng Mai Lan',
      level: 'LV.94',
      role: '4. Rủi ro & Kế hoạch tương lai',
      focus: 'TRỌNG TÂM: PHÒNG THỦ & ROADMAP',
      group: 'NHÓM 4',
      icon: ShieldAlert,
      themeColor: 'purple',
      accentText: 'text-purple-700',
      badgeBg: 'bg-purple-100 text-purple-800 border-purple-300',
      cardBorder: 'border-purple-400/40 hover:border-purple-500',
      activeRing: 'ring-2 ring-purple-500',
      stats: { rigor: 94, speed: '200ms', penalty: '-15% HP' },
      desc: 'Bắt bẻ kịch bản bị đối thủ lớn sao chép, rào cản phòng thủ dài hạn, và tính khả thi của lộ trình triển khai 6-12 tháng.',
      signatureAttack:
        '“Nếu đối thủ hàng đầu tung sản phẩm miễn phí đè bẹp bạn trong tuần tới, hàng rào bảo vệ khách hàng của bạn ở đâu?”',
      survivalTip:
        'Làm rõ hiệu ứng mạng lưới (network effect), chi phí chuyển đổi của người dùng và rào cản tích hợp sâu vào quy trình.',
    },
  ];

  const currentBoss = councilData[activeBossIndex];

  return (
    <section id="jury-council" className="w-full bg-[#F7F5F0] py-18 border-t border-[#D97706]/20 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 flex flex-col gap-10 relative z-10">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FEF3C7] border border-[#F59E0B]/50 mb-2 shadow-xs">
              <Users className="w-3.5 h-3.5 text-[#D97706]" />
              <span className="font-pixel text-[10px] text-[#92400E] uppercase tracking-wider font-bold">
                THE COUNCIL ARCHITECTURE // 4 AI BOSSES
              </span>
            </div>
            <h2 className="font-headline text-2xl md:text-4xl font-black text-[#1C1917] uppercase tracking-tight">
              Hội Đồng 4 Trụ Cột Thẩm Định Khắc Nghiệt
            </h2>
          </div>
          <p className="font-sans text-xs md:text-sm text-[#57534E] max-w-md leading-relaxed">
            Mỗi Giám khảo phụ trách độc lập 1 trong 4 nhóm câu hỏi then chốt: Thị trường, Công nghệ, Tài chính, và Rủi ro dài hạn. Bấm vào từng thẻ để soi chiến thuật vượt ải!
          </p>
        </div>

        {/* 1. SÂN KHẤU HỒ SƠ CHIẾN THUẬT TƯƠNG TÁC (INTERACTIVE DOSSIER SPOTLIGHT) */}
        <div className="w-full bg-[#FFFFFF] border border-[#D97706]/35 rounded-2xl shadow-[0_12px_44px_rgba(217,119,6,0.08)] p-6 md:p-8 flex flex-col lg:flex-row gap-6 items-stretch justify-between relative overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-[radial-gradient(ellipse_at_top_right,rgba(217,119,6,0.06),transparent_70%)] pointer-events-none" />

          {/* Left Column: Boss Identity & Interrogation Terminal */}
          <div className="w-full lg:w-7/12 flex flex-col justify-between gap-5">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className={`px-2.5 py-1 rounded-md font-pixel text-[10px] font-bold uppercase border ${currentBoss.badgeBg}`}>
                  CHIẾN LƯỢC // {currentBoss.group}
                </span>
                <span className="px-2.5 py-1 rounded-md bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B]/50 font-pixel text-[10px] font-bold">
                  {currentBoss.level} BOSS CẤP CAO
                </span>
                <span className="font-mono text-xs text-[#78716C] font-bold">
                  // {currentBoss.role}
                </span>
              </div>

              <h3 className="font-headline text-2xl md:text-3xl font-black text-[#1C1917] tracking-tight">
                Chiến Thuật Thẩm Định & Vượt Ải
              </h3>
              <p className="font-sans text-xs md:text-sm text-[#57534E] mt-2 leading-relaxed">
                {currentBoss.desc}
              </p>
            </div>

            {/* Signature Attack Terminal */}
            <div className="bg-[#FAF8F5] border border-[#D97706]/25 rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between mb-1.5 font-pixel text-[9px] text-[#B45309] font-bold">
                <span className="flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-[#D97706]" />
                  ĐÒN CHẤT VẤN 'BẺ GÃY LUẬN ĐIỂM' ĐẶC TRƯNG:
                </span>
                <span className="font-mono text-[#78716C]">SÁT PHẠT 98%</span>
              </div>
              <p className="font-sans text-sm text-[#1C1917] font-semibold italic leading-relaxed">
                {currentBoss.signatureAttack}
              </p>
            </div>

            {/* Tactical Survival Tip */}
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50/80 border border-amber-200 text-xs text-[#78350F]">
              <Target className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Mẹo Sống Sót: </strong>
                <span>{currentBoss.survivalTip}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Combat Stats Matrix & Action Card */}
          <div className="w-full lg:w-5/12 bg-[#FAF8F5] border border-[#D97706]/20 rounded-xl p-5 flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-[#D97706]/20 font-pixel text-[10px] text-[#92400E] font-bold">
                <span>CHỈ SỐ THẨM ĐỊNH (COMBAT MATRIX)</span>
                <span>{currentBoss.group}</span>
              </div>

              <div className="space-y-3 mt-4">
                <div>
                  <div className="flex justify-between text-xs font-mono font-bold mb-1">
                    <span className="text-[#57534E]">ĐỘ KHẮT KHE TRUY VẤN:</span>
                    <span className="text-[#B45309]">{currentBoss.stats.rigor}%</span>
                  </div>
                  <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-[#D97706] rounded-full transition-all duration-300"
                      style={{ width: `${currentBoss.stats.rigor}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-2.5 rounded-lg bg-[#FFFFFF] border border-[#D97706]/20">
                    <span className="font-pixel text-[8px] text-[#78716C] block uppercase font-bold">
                      TỐC ĐỘ PHẢN XẠ VAD
                    </span>
                    <span className="font-mono text-base font-black text-[#1C1917]">
                      {currentBoss.stats.speed}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#FFFFFF] border border-[#D97706]/20">
                    <span className="font-pixel text-[8px] text-[#78716C] block uppercase font-bold">
                      HỆ SỐ TRỪ MÁU NGỤY BIỆN
                    </span>
                    <span className="font-mono text-base font-black text-rose-600">
                      {currentBoss.stats.penalty}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#D97706]/20 flex items-center justify-between text-xs font-mono font-bold">
              <span className="text-[#78716C]">{currentBoss.focus}</span>
              <span className="text-[#D97706] flex items-center gap-1 font-pixel text-[9px]">
                <span>SẴN SÀNG CHẤT VẤN</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </div>

        {/* 2. DÀN 4 THẺ BÀI CHIẾN THUẬT (HETEROGENEOUS 4 BOSS CARDS - KHÔNG BỊ MỘT MÀU) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {councilData.map((item, index) => {
            const Icon = item.icon;
            const isSelected = activeBossIndex === index;

            return (
              <div
                key={item.id}
                onClick={() => setActiveBossIndex(index)}
                className={`group cursor-pointer select-none rounded-2xl border p-5 flex flex-col justify-between gap-4 transition-all duration-200 shadow-sm ${
                  isSelected
                    ? `bg-[#FFFFFF] ${item.cardBorder} shadow-[0_8px_24px_rgba(217,119,6,0.12)] -translate-y-1 ${item.activeRing}`
                    : `bg-[#FFFFFF]/90 border-[#D97706]/25 hover:border-[#D97706]/60 hover:bg-[#FFFFFF]`
                }`}
              >
                <div>
                  {/* Top Bar với thẻ level & icon riêng */}
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded font-pixel text-[8px] font-bold uppercase border ${item.badgeBg}`}>
                      {item.personaTag}
                    </span>
                    <span className="font-pixel text-[9px] px-1.5 py-0.5 rounded border border-[#D97706]/30 bg-[#FEF3C7] text-[#92400E] font-bold">
                      {item.level}
                    </span>
                  </div>

                  {/* Tên Boss & Chức Danh */}
                  <div className="flex items-center gap-2.5 mt-3">
                    <div className="w-9 h-9 rounded-lg bg-[#FAF8F5] border border-[#D97706]/30 flex items-center justify-center shrink-0">
                      <Icon className={`w-4 h-4 ${item.accentText}`} />
                    </div>
                    <div>
                      <h3 className="font-headline text-base font-black text-[#1C1917] group-hover:text-[#B45309] transition-colors leading-tight">
                        {item.name}
                      </h3>
                      <span className={`font-mono text-[10px] font-bold block ${item.accentText}`}>
                        {item.role}
                      </span>
                    </div>
                  </div>

                  <p className="font-sans text-xs text-[#57534E] mt-3 leading-relaxed line-clamp-3">
                    {item.desc}
                  </p>
                </div>

                {/* Footer với nút chọn đối chất */}
                <div className="pt-3 border-t border-[#D97706]/15 flex items-center justify-between font-mono text-[10px] font-bold">
                  <span className="text-[#78716C]">{item.group}</span>
                  <span className={`font-pixel text-[9px] flex items-center gap-1 ${
                    isSelected ? 'text-[#B45309]' : 'text-[#78716C] group-hover:text-[#B45309]'
                  }`}>
                    <span>{isSelected ? 'ĐANG CHỌN' : 'XEM CHIẾN THUẬT'}</span>
                    <span>→</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
