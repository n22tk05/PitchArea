import React, { useState, useMemo } from 'react';
import { AppendixItem, JuryBossId } from '@pitcharena/shared';
import {
  AlertTriangle,
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
  Target,
  Copy,
  Check,
  XCircle,
  CheckCircle2,
  ListOrdered,
  Rocket,
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

/**
 * Ý đồ thẩm định cốt lõi của Giám khảo (Jury Intent Fallback)
 */
const getJuryIntentFallback = (bossId: JuryBossId, topic?: string): string => {
  switch (bossId) {
    case JuryBossId.FINANCE_DRAGON:
      return 'Thẩm định tính tự chủ dòng tiền, cơ cấu chi phí vận hành (OpEx) và điểm hòa vốn thực tế trước khi cạn kiệt ngân sách.';
    case JuryBossId.TECH_SENTINEL:
      return 'Thẩm định tính khả thi kỹ thuật, độ trễ và cơ chế dự phòng ngoại lệ khi mạng sập hoặc API bên thứ ba mất kết nối.';
    case JuryBossId.MARKET_SHARK:
      return 'Thẩm định bằng chứng nhu cầu thực tế và mức độ sẵn sàng chi trả của khách hàng mục tiêu, bóc trần khảo sát thái độ ảo.';
    case JuryBossId.RISK_STRATEGIST:
      return 'Thẩm định rào cản phòng thủ (Moat), rủi ro pháp lý/sở hữu trí tuệ và tính kỷ luật trong lộ trình triển khai của đội ngũ.';
    default:
      return 'Thẩm định tính thực tế, căn cứ số liệu và tính bền vững của mô hình đề xuất.';
  }
};

/**
 * Bộ 3 khối cấu trúc Slide phụ lục bắt buộc (Slide Skeleton Fallback)
 */
const getSlideStructureBulletsFallback = (bossId: JuryBossId, slideTitle?: string): string[] => {
  switch (bossId) {
    case JuryBossId.FINANCE_DRAGON:
      return [
        'Khối 1: Bảng phân bổ chi phí cố định (API + Máy chủ + Vận hành) theo từng tháng.',
        'Khối 2: Biểu đồ điểm hòa vốn (Break-even): Mốc số lượng khách hàng trả phí cần đạt.',
        'Khối 3: Nguồn vốn dự phòng & Kế hoạch duy trì tối thiểu 6 tháng khi chưa có lãi.',
      ];
    case JuryBossId.TECH_SENTINEL:
      return [
        'Khối 1: Sơ đồ luồng dữ liệu 2 tầng: Xử lý Cloud Stream & Bộ đệm Offline cục bộ.',
        'Khối 2: Thông số thực nghiệm: Độ trễ P95 (<220ms), tải RAM và giới hạn chịu lỗi.',
        'Khối 3: Ma trận xử lý ngoại lệ: Trải nghiệm thông báo thân thiện khi mất kết nối.',
      ];
    case JuryBossId.MARKET_SHARK:
      return [
        'Khối 1: Dữ liệu phỏng vấn sâu 10-15 khách hàng & Trích dẫn trực tiếp về nỗi đau.',
        'Khối 2: Bằng chứng cam kết chi trả thực tế (Thư quan tâm LOI / Đơn đặt trước pilot).',
        'Khối 3: Phân tích chi phí tìm khách (CAC) và kênh tiếp cận 100 người dùng đầu tiên.',
      ];
    case JuryBossId.RISK_STRATEGIST:
      return [
        'Khối 1: Ma trận so sánh tính năng và rào cản phòng thủ (Moat) trước đối thủ lớn.',
        'Khối 2: Kế hoạch pháp lý, bản quyền sở hữu trí tuệ và bảo vệ dữ liệu người dùng.',
        'Khối 3: Lộ trình 6 tháng với cột mốc định lượng (KPI) và phân công trách nhiệm.',
      ];
    default:
      return [
        'Khối 1: Luận cứ bổ sung số liệu minh chứng từ tài liệu đề án.',
        'Khối 2: Sơ đồ hoặc biểu đồ trực quan hóa giải pháp.',
        'Khối 3: Lộ trình và chỉ số đo lường hiệu quả cụ thể.',
      ];
  }
};

/**
 * 3 bước hành động cụ thể cần làm tiếp theo trong 48h (48H Action Steps Fallback)
 */
const getActionStepsFallback = (bossId: JuryBossId, isDocxGrounded?: boolean): string[] => {
  switch (bossId) {
    case JuryBossId.FINANCE_DRAGON:
      return [
        'Bước 1 (Tính chi phí OpEx): Lập bảng Excel dự toán chi phí cố định tối thiểu (API, Server, Domain, Vận hành) theo từng tháng trong 6 tháng đầu.',
        'Bước 2 (Tính điểm hòa vốn): Tính toán số lượng khách hàng trả phí tối thiểu cần đạt để doanh thu tự bù đắp toàn bộ chi phí vận hành hàng tháng.',
        'Bước 3 (Đóng gói Slide F1): Lập bảng chi phí vs doanh thu và vẽ biểu đồ điểm hòa vốn đưa vào Slide Phụ lục F1 sẵn sàng phản biện.',
      ];
    case JuryBossId.TECH_SENTINEL:
      return [
        'Bước 1 (Thiết kế luồng dự phòng): Vẽ sơ đồ khối kiến trúc 2 tầng (Primary Cloud Flow & Local Fallback Cache) xử lý tình huống mất kết nối mạng.',
        'Bước 2 (Đo lường thông số): Chạy thử nghiệm đo lường độ trễ phản hồi (P95 < 220ms), tải RAM và tỷ lệ thành công của API để có số liệu thực nghiệm.',
        'Bước 3 (Đóng gói Slide T2): Đưa sơ đồ kiến trúc dự phòng và bảng kết quả đo lường độ trễ thực tế vào Slide Phụ lục T2.',
      ];
    case JuryBossId.MARKET_SHARK:
      return [
        'Bước 1 (Xác thực thực tế): Phỏng vấn sâu 10 - 15 khách hàng mục tiêu để ghi nhận nỗi đau thực tế và mức độ sẵn sàng chi trả thay vì khảo sát lý thuyết.',
        'Bước 2 (Lấy cam kết thử nghiệm): Ký kết hoặc xin tối thiểu 3 Thư xác nhận quan tâm (LOI / Pilot Agreement) có điều khoản trả phí thử nghiệm danh nghĩa.',
        'Bước 3 (Đóng gói Slide M1): Đưa hình ảnh phỏng vấn, logo đối tác pilot và tỷ lệ chuyển đổi thực tế vào Slide Phụ lục M1.',
      ];
    case JuryBossId.RISK_STRATEGIST:
      return [
        'Bước 1 (Lập ma trận cạnh tranh): Tạo bảng so sánh 3 cột giữa dự án của bạn và 2 đối thủ lớn nhất, chọn ra đúng 2 tính năng vượt trội không thể sao chép.',
        'Bước 2 (Khóa pháp lý & Lộ trình): Xác lập kế hoạch đăng ký sở hữu trí tuệ/bản quyền và phân rã 3 mốc KPI định lượng cho đội ngũ trong 6 tháng tới.',
        'Bước 3 (Đóng gói Slide R3): Đưa bảng ma trận tính năng (đánh dấu tick xanh cho lợi thế cốt lõi) và lộ trình phát triển vào Slide Phụ lục R3.',
      ];
    default:
      return [
        'Bước 1 (Bổ sung số liệu): Thu thập dữ liệu thực tế và tính toán chỉ số định lượng còn thiếu.',
        'Bước 2 (Kiểm chứng luận điểm): Đối chiếu số liệu với mục tiêu của đề án để bảo đảm tính nhất quán.',
        'Bước 3 (Cập nhật Slide Phụ lục): Vẽ sơ đồ/bảng số liệu trực quan đưa vào slide phụ lục tương ứng.',
      ];
  }
};

/**
 * Kịch bản lời nói chuẩn mực dự phòng theo từng Giám khảo (Founder Dialogue Fallback)
 */
const getBossDialogueFallback = (bossId?: JuryBossId): string => {
  switch (bossId) {
    case JuryBossId.FINANCE_DRAGON:
      return 'Thưa Thầy/Cô, trong 6 tháng đầu chưa có doanh thu đột biến, dự án áp dụng chiến lược sinh tồn tự lực (Bootstrapping Runway) với chi phí vận hành tối thiểu 5 triệu/tháng cho API và máy chủ. Đội ngũ đã trích lập quỹ dự phòng 30 triệu bảo đảm duy trì 6 tháng độc lập, không phụ thuộc vào các nguồn tài trợ chưa cam kết bên ngoài.';
    case JuryBossId.TECH_SENTINEL:
      return 'Thưa Thầy/Cô, khi mạng chập chờn hoặc API bên thứ ba mất kết nối, hệ thống kích hoạt cơ chế 2 tầng: bộ đệm Local Cache tại thiết bị đầu cuối xử lý phản hồi tức thì dưới 5ms, sau đó âm thầm tự động đồng bộ dữ liệu ngay khi mạng khôi phục, giúp người dùng không bao giờ gặp lỗi đứt gãy màn hình.';
    case JuryBossId.MARKET_SHARK:
      return 'Thưa Ban giám khảo, theo kết quả triển khai thử nghiệm trên nhóm người dùng mục tiêu ban đầu, nhóm đã ghi nhận các khách hàng chấp nhận trả phí danh nghĩa để tiếp tục sử dụng dịch vụ, chứng minh tính khả thi chuyển đổi thương mại.';
    case JuryBossId.RISK_STRATEGIST:
      return 'Thưa Thầy/Cô, điểm khác biệt cốt lõi của giải pháp nằm ở khả năng tối ưu hóa trải nghiệm bản địa và chi phí tiếp cận rẻ hơn 60% so với đối thủ ngoại. Nhóm đã lượng hóa ma trận so sánh 3 tính năng vượt trội cùng lộ trình 6 tháng tại Slide Phụ lục R3 để Hội đồng thẩm định.';
    default:
      return 'Thưa Ban giám khảo, nhóm xin tiếp thu góp ý của Hội đồng và đã chuẩn bị các căn cứ số liệu, biểu đồ minh chứng cụ thể trong Slide phụ lục tương ứng để giải trình chi tiết.';
  }
};

/**
 * Làm sạch câu trả lời chuẩn mực: loại bỏ mọi tiêu đề meta, lời dẫn đề xuất và trả về 100% lời nói của nhà sáng lập
 */
const cleanWinningDialogue = (text?: string, bossId?: JuryBossId): string => {
  if (!text) return getBossDialogueFallback(bossId);
  let cleaned = text.trim();

  // Nếu chứa đoạn trích dẫn có ngoặc kép "Thưa Thầy/Cô...", ưu tiên bóc tách nội dung bên trong
  const quoteMatch = cleaned.match(/"([^"]+)"/s);
  if (quoteMatch && quoteMatch[1] && quoteMatch[1].length > 15) {
    return quoteMatch[1].trim();
  }

  // Nếu chứa chỉ dấu như "CÂU TRẢ LỜI MẪU...:", chỉ lấy phần sau đó
  const markerMatch = cleaned.match(/(?:CÂU TRẢ LỜI MẪU[^:]*:\s*)([\s\S]+)$/i);
  if (markerMatch && markerMatch[1]) {
    cleaned = markerMatch[1].trim();
  }

  // Loại bỏ ngoặc kép bao ngoài nếu có
  cleaned = cleaned.replace(/^["'“”]+|["'“”]+$/g, '').trim();

  // Loại bỏ lời dẫn giải meta nếu có Thưa Thầy/Cô hoặc Thưa Ban giám khảo ở giữa
  const thucThayCoIdx = cleaned.indexOf('Thưa Thầy/Cô');
  if (thucThayCoIdx > 0) {
    cleaned = cleaned.slice(thucThayCoIdx).trim();
  }
  const thucBanGiamKhaoIdx = cleaned.indexOf('Thưa Ban giám khảo');
  if (thucBanGiamKhaoIdx > 0) {
    cleaned = cleaned.slice(thucBanGiamKhaoIdx).trim();
  }

  // Nếu chuỗi vẫn chứa định dạng meta cũ của reviewer ("Trong file Word...", "Đề xuất bạn...") thì dùng lời thoại chuẩn
  if (
    cleaned.startsWith('Trong file Word') ||
    cleaned.startsWith('Trong tài liệu') ||
    cleaned.includes('Đề xuất bạn:') ||
    cleaned.includes('Đề xuất nhóm')
  ) {
    return getBossDialogueFallback(bossId);
  }

  return cleaned;
};

export const AppendixTable: React.FC<AppendixTableProps> = ({ items }) => {
  const [filterBoss, setFilterBoss] = useState<string>('ALL');
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [expandedTurns, setExpandedTurns] = useState<Record<number, boolean>>({});
  const [copiedTurn, setCopiedTurn] = useState<number | null>(null);

  const toggleExpand = (turnIndex: number) => {
    setExpandedTurns((prev) => ({
      ...prev,
      [turnIndex]: !prev[turnIndex],
    }));
  };

  const handleCopyWinningResponse = (turnIndex: number, text: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedTurn(turnIndex);
    setTimeout(() => {
      setCopiedTurn((curr) => (curr === turnIndex ? null : curr));
    }, 2000);
  };

  // Cấu hình danh sách option đồng bộ với RetroSelect trong LobbyConfig
  const bossFilterOptions: RetroOption<string>[] = useMemo(
    () => [
      {
        value: 'ALL',
        label: 'Tất cả Giám khảo',
        badge: 'ALL',
        badgeColor: 'bg-[#FEF3C7] text-[#92400E]',
        icon: <Layers className="w-3.5 h-3.5 text-[#B45309]" />,
      },
      {
        value: JuryBossId.FINANCE_DRAGON,
        label: 'GS. Vũ Hoàng (Tài chính)',
        badge: 'TÀI CHÍNH',
        badgeColor: 'bg-amber-100 text-amber-900',
        icon: <Coins className="w-3.5 h-3.5 text-[#D97706]" />,
      },
      {
        value: JuryBossId.TECH_SENTINEL,
        label: 'TS. Lê Minh Trang (Công nghệ)',
        badge: 'CÔNG NGHỆ',
        badgeColor: 'bg-emerald-100 text-emerald-900',
        icon: <Cpu className="w-3.5 h-3.5 text-emerald-600" />,
      },
      {
        value: JuryBossId.MARKET_SHARK,
        label: 'Shark Trần Nam (Thị trường)',
        badge: 'THỊ TRƯỜNG',
        badgeColor: 'bg-cyan-100 text-cyan-900',
        icon: <Flame className="w-3.5 h-3.5 text-cyan-600" />,
      },
      {
        value: JuryBossId.RISK_STRATEGIST,
        label: 'ThS. Đặng Mai Lan (Rủi ro)',
        badge: 'RỦI RO',
        badgeColor: 'bg-rose-100 text-rose-900',
        icon: <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />,
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
        badgeColor: 'bg-[#FEF3C7] text-[#92400E]',
        icon: <Layers className="w-3.5 h-3.5 text-[#B45309]" />,
      },
      {
        value: 'CRITICAL',
        label: 'Lỗ hổng nghiêm trọng',
        badge: 'CRITICAL',
        badgeColor: 'bg-rose-100 text-rose-800',
        icon: <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block shrink-0" />,
      },
      {
        value: 'WARNING',
        label: 'Cảnh báo rủi ro',
        badge: 'WARNING',
        badgeColor: 'bg-amber-100 text-amber-800',
        icon: <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block shrink-0" />,
      },
      {
        value: 'GOOD',
        label: 'Phòng thủ tốt',
        badge: 'GOOD',
        badgeColor: 'bg-emerald-100 text-emerald-800',
        icon: <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block shrink-0" />,
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
      const matchIntent = (item.juryIntent || '').toLowerCase().includes(q);
      if (!matchQ && !matchW && !matchP && !matchTopic && !matchIntent) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-5 font-mono text-xs text-[#1C1917]">
      {/* Thanh công cụ lọc & tìm kiếm */}
      <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#D97706]/30 shadow-xs flex flex-wrap items-center justify-between gap-4 relative z-20">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-[#B45309] font-bold font-headline">
            <Filter className="w-4 h-4 text-[#D97706]" />
            <span className="text-xs uppercase tracking-wide">BỘ LỌC:</span>
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

        {/* Ô Tìm kiếm */}
        <div className="relative min-w-[240px] flex-1 max-w-sm">
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="Tìm kiếm câu hỏi / ý đồ / slide..."
            className="w-full pl-9 pr-4 py-2 bg-[#FAF8F5] border border-[#D97706]/30 rounded-xl text-xs font-mono text-[#1C1917] placeholder-[#A8A29E] focus:outline-none focus:border-[#B45309] transition-all"
          />
          <Search className="w-4 h-4 text-[#78716C] absolute left-3 top-2.5" />
        </div>
      </div>

      {/* Bảng 3 Cột Đối Soát (Actionable Matrix) */}
      <div className="overflow-x-auto border border-[#D97706]/30 rounded-2xl bg-[#FFFFFF] shadow-xs">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-[#FAF8F5] text-[#1C1917] border-b border-[#D97706]/20 text-xs font-headline font-bold">
              <th className="p-3.5 border-r border-[#D97706]/15 w-16 text-center">LƯỢT</th>
              <th className="p-3.5 border-r border-[#D97706]/15 w-4/12">
                1. CÂU HỎI HỘI ĐỒNG & Ý ĐỒ THẨM ĐỊNH
              </th>
              <th className="p-3.5 border-r border-[#D97706]/15 w-3/12 text-rose-800">
                2. LỖ HỔNG BỊ BÓC TRẦN & ĐIỂM GÃY LOGIC
              </th>
              <th className="p-3.5 w-5/12 text-emerald-800">
                3. ĐỀ XUẤT ĐIỀU CHỈNH SLIDE & LUẬN CỨ CHUẨN MỰC
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D97706]/15 font-sans text-xs">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-[#78716C] font-mono">
                  Không tìm thấy mục phụ lục nào phù hợp với bộ lọc hiện tại.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const isExpanded = !!expandedTurns[item.turnIndex];
                const juryIntent = item.juryIntent || getJuryIntentFallback(item.bossId, item.topic);
                const slideBullets =
                  item.slideStructureBullets && item.slideStructureBullets.length > 0
                    ? item.slideStructureBullets
                    : getSlideStructureBulletsFallback(item.bossId, item.recommendedSlideTitle);
                const actionSteps =
                  item.actionSteps && item.actionSteps.length > 0
                    ? item.actionSteps
                    : getActionStepsFallback(item.bossId, item.isDocxGrounded);
                const rawWinningResponse = item.winningResponse || item.sampleDefenseArgument || '';
                const cleanWinning = cleanWinningDialogue(rawWinningResponse, item.bossId);
                const isCopied = copiedTurn === item.turnIndex;

                return (
                  <tr
                    key={item.turnIndex}
                    className={`hover:bg-[#FAF8F5]/80 transition-colors ${
                      item.severity === 'CRITICAL' ? 'bg-rose-50/30' : ''
                    }`}
                  >
                    {/* Cột STT Lượt */}
                    <td className="p-3.5 border-r border-[#D97706]/15 font-mono font-bold text-center align-top bg-[#FAF8F5]/50">
                      <span className="block text-sm font-headline text-[#1C1917]">#{item.turnIndex}</span>
                      <span
                        className={`inline-block mt-1 px-1.5 py-0.5 text-[9px] font-pixel font-bold border rounded-full ${
                          item.hpImpact < 0
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : item.hpImpact > 0
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-[#FAF8F5] text-[#78716C] border-[#D97706]/20'
                        }`}
                      >
                        {item.hpImpact > 0 ? `+${item.hpImpact}` : item.hpImpact} HP
                      </span>
                    </td>

                    {/* Cột 1: Câu hỏi & Ý đồ thẩm định (Jury Intent) */}
                    <td className="p-4 border-r border-[#D97706]/15 font-sans align-top space-y-2.5">
                      {/* Badge Giám khảo & Chủ đề */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-pixel text-[9px] px-2 py-0.5 rounded-md bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B]/40 font-bold">
                          {item.bossName}
                        </span>
                        <span className="font-mono text-[10px] text-[#78716C] font-semibold">
                          • {item.topic}
                        </span>
                      </div>

                      {/* Câu hỏi của Hội Đồng */}
                      <p className="font-bold text-[#1C1917] text-xs leading-relaxed bg-[#FAF8F5] p-2.5 rounded-xl border border-[#D97706]/20">
                        "{item.question}"
                      </p>

                      {/* KHUNG Ý ĐỒ THẨM ĐỊNH (JURY INTENT) */}
                      <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-300/70 text-amber-950 shadow-xs space-y-1">
                        <div className="flex items-center gap-1.5 font-headline text-[10px] font-bold uppercase tracking-wider text-[#B45309]">
                          <Target className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
                          <span>Ý ĐỒ THẨM ĐỊNH CỦA GIÁM KHẢO (JURY INTENT):</span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-[#78350F] italic">
                          {juryIntent}
                        </p>
                      </div>

                      {/* Nút xem câu trả lời của thí sinh */}
                      <div>
                        <button
                          type="button"
                          onClick={() => toggleExpand(item.turnIndex)}
                          className="text-[11px] font-mono font-bold text-[#B45309] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-3.5 h-3.5" />
                              <span>Ẩn câu trả lời thí sinh</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3.5 h-3.5" />
                              <span>Xem câu trả lời thí sinh</span>
                            </>
                          )}
                        </button>

                        {isExpanded && (
                          <div className="mt-2 p-2.5 bg-[#FAF8F5] border border-[#D97706]/25 rounded-xl text-xs font-sans text-[#57534E] italic">
                            <strong className="font-headline not-italic block text-[10px] text-[#B45309] mb-1 tracking-wider uppercase font-bold">
                              CÂU TRẢ LỜI CỦA THÍ SINH:
                            </strong>
                            "{item.candidateAnswer}"
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Cột 2: Lỗ hổng bị bóc trần & Điểm gãy logic */}
                    <td className="p-4 border-r border-[#D97706]/15 align-top bg-rose-50/20 space-y-2.5">
                      {item.fallacyType && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 rounded-full font-pixel text-[9px] font-bold shadow-xs">
                          <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                          <span>NGỤY BIỆN: {item.fallacyType}</span>
                        </div>
                      )}

                      <div className="space-y-1">
                        <span className="font-headline text-[10px] uppercase font-bold text-[#991B1B] block tracking-wide">
                          ĐIỂM GÃY LUẬN ĐIỂM:
                        </span>
                        <p className="text-[#57534E] text-xs leading-relaxed bg-[#FFFFFF] p-2.5 rounded-xl border border-rose-200">
                          {cleanWeaknessText(item.weaknessIdentified)}
                        </p>
                      </div>

                      {/* Trạng thái mức độ */}
                      <div className="pt-1">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${
                            item.severity === 'CRITICAL'
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : item.severity === 'WARNING'
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          }`}
                        >
                          {item.severity === 'CRITICAL'
                            ? '● LỖ HỔNG CHÍ MẠNG'
                            : item.severity === 'WARNING'
                            ? '▲ CẢNH BÁO RỦI RO'
                            : '✔ PHÒNG THỦ VỮNG CHẮC'}
                        </span>
                      </div>
                    </td>

                    {/* Cột 3: Đề xuất sửa Slide, Cấu trúc 3 khối & Luận cứ chuẩn mực */}
                    <td className="p-4 align-top bg-emerald-50/20 space-y-3">
                      {/* Tiêu đề Slide phụ lục */}
                      {item.recommendedSlideTitle && (
                        <div className="flex items-center gap-1.5 text-emerald-900 font-headline text-xs font-bold bg-emerald-100/70 border border-emerald-300 px-2.5 py-1 rounded-lg">
                          <Layers className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                          <span className="truncate">{item.recommendedSlideTitle}</span>
                        </div>
                      )}

                      {/* Hành động sửa Slide */}
                      <p className="text-[#1C1917] text-xs leading-relaxed">
                        {item.slideActionProposal}
                      </p>

                      {/* 📐 CẤU TRÚC 3 KHỐI BẮT BUỘC TRÊN SLIDE (SLIDE SKELETON) */}
                      <div className="p-2.5 rounded-xl bg-[#FFFFFF] border border-emerald-200 shadow-xs space-y-1.5">
                        <div className="flex items-center gap-1.5 font-headline text-[10px] font-bold uppercase tracking-wider text-emerald-900">
                          <ListOrdered className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>CẤU TRÚC 3 KHỐI CẦN VẼ LÊN SLIDE PHỤ LỤC:</span>
                        </div>
                        <ul className="space-y-1 pl-1 text-[11px] text-[#44403C] font-sans">
                          {slideBullets.map((bullet, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                              <span className="leading-snug">{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* 🚀 3 BƯỚC HÀNH ĐỘNG CỤ THỂ TRONG 48H (48H ACTION ROADMAP) */}
                      <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-300/80 shadow-xs space-y-1.5">
                        <div className="flex items-center gap-1.5 font-headline text-[10px] font-bold uppercase tracking-wider text-[#92400E]">
                          <Rocket className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
                          <span>3 BƯỚC HÀNH ĐỘNG CỤ THỂ TRONG 48H:</span>
                        </div>
                        <div className="space-y-1 pl-1 text-[11px] text-[#78350F] font-sans">
                          {actionSteps.map((step, idx) => (
                            <div key={idx} className="flex items-start gap-1.5 leading-snug">
                              <span className="font-pixel text-[9px] font-bold px-1.5 py-0.2 bg-[#FEF3C7] text-[#92400E] border border-amber-300 rounded shrink-0 mt-0.5">
                                #{idx + 1}
                              </span>
                              <span className="text-[#78350F]">{step}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* ⚖️ BẢNG SO SÁNH TRỰC QUAN (DIFF VIEW) */}
                      <div className="space-y-2 pt-1 border-t border-emerald-200/60">
                        {/* ❌ Cách bạn đã nói */}
                        <div className="p-2 rounded-lg bg-rose-50/80 border border-rose-200 text-rose-900 space-y-0.5">
                          <div className="flex items-center gap-1 text-[10px] font-headline font-bold uppercase text-rose-700">
                            <XCircle className="w-3 h-3 text-rose-600 shrink-0" />
                            <span>CÁCH BẠN ĐÃ NÓI TRÊN SÀN (GÂY MẤT MÁU):</span>
                          </div>
                          <p className="text-[11px] font-sans italic text-rose-950 line-clamp-2">
                            "{item.candidateAnswer || 'Thí sinh không phản hồi hoặc phản hồi quá ngắn.'}"
                          </p>
                        </div>

                        {/* ✅ Cách chuyên gia trả lời (Winning Response) */}
                        {cleanWinning && (
                          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 space-y-1.5 shadow-xs">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 text-[10px] font-headline font-bold uppercase text-emerald-800">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>CÂU TRẢ LỜI CHUẨN MỰC (LẤY LẠI ĐIỂM):</span>
                              </div>

                              {/* Nút Sao Chép Luận Cứ Mẫu */}
                              <button
                                type="button"
                                onClick={() => handleCopyWinningResponse(item.turnIndex, cleanWinning)}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:translate-x-0.5 ${
                                  isCopied
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-[#FFFFFF] text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                                }`}
                                title="Sao chép câu trả lời mẫu vào clipboard"
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="w-3 h-3 text-white" />
                                    <span>ĐÃ SAO CHÉP!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3 text-emerald-700" />
                                    <span>SAO CHÉP</span>
                                  </>
                                )}
                              </button>
                            </div>

                            <p className="text-[11px] font-sans leading-relaxed text-emerald-950 bg-[#FFFFFF] p-2 rounded-lg border border-emerald-200">
                              "{cleanWinning}"
                            </p>
                          </div>
                        )}
                      </div>
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
