import React, { useState, useMemo } from 'react';
import { AppendixItem, JuryBossId } from '@pitcharena/shared';
import {
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Search,
  Filter,
  Layers,
  ChevronDown,
  ChevronUp,
  Coins,
  Cpu,
  Flame,
  ShieldAlert,
  Sparkles,
  FileQuestion,
} from 'lucide-react';
import { RetroSelect, RetroOption } from './RetroSelect';

interface AppendixTableProps {
  items: AppendixItem[];
}

/**
 * Làm sạch lý do: loại bỏ các thông số điểm (Q=..., Hệ số: ...x), Trừ ... HP
 */
const cleanWeaknessText = (text?: string): string => {
  if (!text) return '';
  return text
    .replace(/\s*\(Q=\d+[^)]*\)/gi, '')
    .replace(/\s*Hệ số:\s*[\d.]+x/gi, '')
    .replace(/\s*Trừ\s+(?:nhẹ\s+)?\d+\s+HP\.?/gi, '')
    .replace(/\s*Thưởng hồi phục(?:\s+\+\d+\s+HP)?!?/gi, '')
    .replace(/\s*\[KÍCH HOẠT SÀN TÂN THỦ.*?\]/gi, '')
    .replace(/\s*\[CẢNH BÁO NGUY CẤP.*?\]/gi, '')
    .replace(/\s*\[COMEBACK SURGE.*?\]/gi, '')
    .replace(/\s*\(\s*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

export const AppendixTable: React.FC<AppendixTableProps> = ({ items }) => {
  const [filterBoss, setFilterBoss] = useState<string>('ALL');
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [expandedTurns, setExpandedTurns] = useState<Record<number, boolean>>({});

  const toggleExpand = (turnIndex: number) => {
    setExpandedTurns((prev) => ({
      ...prev,
      [turnIndex]: !prev[turnIndex],
    }));
  };

  // Cấu hình danh sách option đồng bộ với RetroSelect trong LobbyConfig
  const bossFilterOptions: RetroOption<string>[] = useMemo(
    () => [
      {
        value: 'ALL',
        label: 'Tất cả Giám khảo',
        badge: 'ALL',
        badgeColor: 'bg-neutral-100 text-black',
        icon: <Layers className="w-3.5 h-3.5" />,
      },
      {
        value: JuryBossId.FINANCE_DRAGON,
        label: 'GS. Vũ Hoàng (Tài chính)',
        badge: 'TÀI CHÍNH',
        badgeColor: 'bg-amber-100 text-amber-900',
        icon: <Coins className="w-3.5 h-3.5 text-amber-600" />,
      },
      {
        value: JuryBossId.TECH_SENTINEL,
        label: 'TS. Lê Minh Trang (Công nghệ)',
        badge: 'CÔNG NGHỆ',
        badgeColor: 'bg-blue-100 text-blue-900',
        icon: <Cpu className="w-3.5 h-3.5 text-blue-600" />,
      },
      {
        value: JuryBossId.MARKET_SHARK,
        label: 'Shark Trần Nam (Thị trường)',
        badge: 'THỊ TRƯỜNG',
        badgeColor: 'bg-rose-100 text-rose-900',
        icon: <Flame className="w-3.5 h-3.5 text-rose-600" />,
      },
      {
        value: JuryBossId.RISK_STRATEGIST,
        label: 'Chuyên gia Hoàng Nam (Rủi ro)',
        badge: 'RỦI RO',
        badgeColor: 'bg-purple-100 text-purple-900',
        icon: <ShieldAlert className="w-3.5 h-3.5 text-purple-600" />,
      },
    ],
    []
  );

  const severityFilterOptions: RetroOption<string>[] = useMemo(
    () => [
      {
        value: 'ALL',
        label: 'Tất cả mức độ',
        badge: 'ALL',
        badgeColor: 'bg-neutral-100 text-black',
        icon: <Layers className="w-3.5 h-3.5" />,
      },
      {
        value: 'CRITICAL',
        label: 'Lỗ hổng nghiêm trọng',
        badge: 'CRITICAL',
        badgeColor: 'bg-rose-100 text-rose-800',
        icon: <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block border border-black shrink-0" />,
      },
      {
        value: 'WARNING',
        label: 'Cảnh báo rủi ro',
        badge: 'WARNING',
        badgeColor: 'bg-amber-100 text-amber-800',
        icon: <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block border border-black shrink-0" />,
      },
      {
        value: 'GOOD',
        label: 'Phòng thủ tốt',
        badge: 'GOOD',
        badgeColor: 'bg-emerald-100 text-emerald-800',
        icon: <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block border border-black shrink-0" />,
      },
    ],
    []
  );

  const filteredItems = items.filter((item) => {
    if (filterBoss !== 'ALL' && item.bossId !== filterBoss) {
      return false;
    }
    if (filterSeverity !== 'ALL' && item.severity !== filterSeverity) {
      return false;
    }
    if (searchKeyword.trim()) {
      const q = searchKeyword.toLowerCase();
      const matchQ = item.question.toLowerCase().includes(q);
      const matchW = item.weaknessIdentified.toLowerCase().includes(q);
      const matchP = item.slideActionProposal.toLowerCase().includes(q);
      const matchTopic = item.topic.toLowerCase().includes(q);
      if (!matchQ && !matchW && !matchP && !matchTopic) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-4 font-mono text-xs">
      {/* Thanh công cụ lọc & tìm kiếm */}
      <div className="border-2 border-black bg-white p-3 shadow-[3px_3px_0px_#000] flex flex-wrap items-center justify-between gap-3 relative z-20">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-neutral-800 font-bold">
            <Filter className="w-3.5 h-3.5" />
            <span className="text-[11px] tracking-wide">BỘ LỌC:</span>
          </div>

          {/* Lọc theo Giám khảo bằng RetroSelect */}
          <RetroSelect
            value={filterBoss}
            onChange={(val) => setFilterBoss(val)}
            options={bossFilterOptions}
            className="w-64"
          />

          {/* Lọc theo mức độ bằng RetroSelect */}
          <RetroSelect
            value={filterSeverity}
            onChange={(val) => setFilterSeverity(val)}
            options={severityFilterOptions}
            className="w-56"
          />
        </div>

        {/* Ô Tìm kiếm chuẩn hóa viền 2px & shadow arcade */}
        <div className="relative min-w-[240px] flex-1 max-w-sm">
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="Tìm kiếm câu hỏi / slide..."
            className="w-full pl-8 pr-3 py-2 bg-neutral-50 border-2 border-black text-xs font-mono shadow-[2px_2px_0px_#000] focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-400 transition-all"
          />
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-3" />
        </div>
      </div>

      {/* Bảng 3 Cột Đối Soát (Actionable Matrix) */}
      <div className="border-2 border-black bg-white shadow-[4px_4px_0px_#000] overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-black text-white border-b-2 border-black text-[11px]">
              <th className="p-3 border-r border-neutral-700 w-16 text-center">LƯỢT</th>
              <th className="p-3 border-r border-neutral-700 w-3/12">
                1. CÂU HỎI HỘI ĐỒNG & CHỦ ĐỀ
              </th>
              <th className="p-3 border-r border-neutral-700 w-4/12 text-rose-300">
                2. LỖ HỔNG BỊ BÓC TRẦN & LỖI LOGIC
              </th>
              <th className="p-3 w-4/12 text-emerald-300">
                3. ĐỀ XUẤT ĐIỀU CHỈNH SLIDE & LUẬN CỨ
              </th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-black font-sans text-xs">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-neutral-500 font-mono">
                  Không tìm thấy mục phụ lục nào phù hợp với bộ lọc hiện tại.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const isExpanded = !!expandedTurns[item.turnIndex];

                return (
                  <tr
                    key={item.turnIndex}
                    className={`hover:bg-neutral-50/70 transition-colors ${
                      item.severity === 'CRITICAL' ? 'bg-rose-50/20' : ''
                    }`}
                  >
                    {/* Cột STT Lượt */}
                    <td className="p-3 border-r border-black font-mono font-bold text-center align-top bg-neutral-50">
                      <span className="block text-sm">#{item.turnIndex}</span>
                      <span
                        className={`inline-block mt-1 px-1 py-0.5 text-[9px] font-extrabold border ${
                          item.hpImpact < 0
                            ? 'bg-rose-100 text-rose-700 border-rose-300'
                            : item.hpImpact > 0
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                            : 'bg-neutral-100 text-neutral-700 border-neutral-300'
                        }`}
                      >
                        {item.hpImpact > 0 ? `+${item.hpImpact}` : item.hpImpact} HP
                      </span>
                    </td>

                    {/* Cột 1: Câu hỏi */}
                    <td className="p-3.5 border-r border-black font-sans align-top">
                      <p className="font-bold text-black text-xs leading-relaxed">
                        "{item.question}"
                      </p>

                      {/* Nút xem câu trả lời của thí sinh */}
                      <button
                        type="button"
                        onClick={() => toggleExpand(item.turnIndex)}
                        className="mt-2 text-[10px] font-mono text-neutral-600 hover:text-black flex items-center gap-1 underline cursor-pointer"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-3 h-3" />
                            Ẩn câu trả lời thí sinh
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3 h-3" />
                            Xem câu trả lời thí sinh
                          </>
                        )}
                      </button>

                      {isExpanded && (
                        <div className="mt-2 p-2 bg-neutral-100 border border-neutral-300 text-[11px] font-sans text-neutral-700 italic">
                          <strong className="font-mono not-italic block text-[10px] text-neutral-500 mb-0.5">
                            CÂU TRẢ LỜI CỦA THÍ SINH:
                          </strong>
                          {item.candidateAnswer}
                        </div>
                      )}
                    </td>

                    {/* Cột 2: Lỗ hổng bị bóc trần */}
                    <td className="p-3.5 border-r border-black align-top bg-rose-50/30">
                      {item.fallacyType && (
                        <div className="mb-2 inline-flex items-center gap-1 px-2 py-0.5 bg-rose-600 text-white font-mono text-[10px] font-bold shadow-[1px_1px_0px_#000]">
                          <AlertTriangle className="w-3 h-3" />
                          <span>NGỤY BIỆN: {item.fallacyType}</span>
                        </div>
                      )}

                      <p className="text-neutral-800 text-xs leading-relaxed">
                        {cleanWeaknessText(item.weaknessIdentified)}
                      </p>
                    </td>

                    {/* Cột 3: Đề xuất sửa Slide & Luận cứ */}
                    <td className="p-3.5 align-top bg-emerald-50/30">
                      {item.recommendedSlideTitle && (
                        <div className="mb-2 flex items-center gap-1.5 text-emerald-800 font-mono text-[11px] font-bold">
                          <Layers className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{item.recommendedSlideTitle}</span>
                        </div>
                      )}

                      <p className="text-neutral-800 text-xs leading-relaxed">
                        {item.slideActionProposal}
                      </p>

                      {/* Khung gợi ý câu trả lời mẫu hoặc đề xuất tìm kiếm & bổ sung */}
                      {item.sampleDefenseArgument && (
                        <div
                          className={`mt-2.5 p-2.5 border-2 ${
                            item.isDocxGrounded
                              ? 'bg-blue-50/90 border-blue-600 text-blue-950'
                              : 'bg-amber-50/90 border-amber-600 text-amber-950'
                          } shadow-[2px_2px_0px_#000] text-xs font-sans`}
                        >
                          <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase mb-1">
                            {item.isDocxGrounded ? (
                              <>
                                <Sparkles className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                                <span className="text-blue-800">CÂU TRẢ LỜI MẪU (GỢI Ý TỪ TÀI LIỆU CỦA BẠN):</span>
                              </>
                            ) : (
                              <>
                                <FileQuestion className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                <span className="text-amber-800">TÀI LIỆU CHƯA CÓ DỮ LIỆU — ĐỀ XUẤT TÌM KIẾM/BỔ SUNG:</span>
                              </>
                            )}
                          </div>
                          <p className="leading-relaxed italic text-[11px]">
                            "{item.sampleDefenseArgument}"
                          </p>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
