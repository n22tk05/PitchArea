import {
  DocumentAnalysisResult,
  BusinessSectionType,
} from '@pitcharena/shared';

// Dữ liệu mẫu đề tài khởi nghiệp MedTech AI để thử nghiệm tức thì
export const DEMO_PROJECT_DATA: DocumentAnalysisResult = {
  documentId: 'doc-demo-startup-medtech',
  filename: 'Thuyet_Minh_De_Tai_AI_Medical_Assistant.docx',
  fileSizeBytes: 2450000,
  markdownContent: '# AI Medical Assistant - Trợ lý lâm sàng chuyên sâu...',
  sections: [
    {
      id: 'sec-1-problem',
      type: BusinessSectionType.PROBLEM_MARKET,
      title: 'Vấn đề & Quy mô Thị trường',
      content:
        'Thị trường MedTech Việt Nam đạt 1.2 tỷ USD, giải quyết tình trạng quá tải 40% tại các phòng khám công lập và tư nhân.',
      charCount: 110,
      wordCount: 22,
    },
    {
      id: 'sec-2-solution',
      type: BusinessSectionType.SOLUTION_PRODUCT,
      title: 'Giải pháp & Sản phẩm cốt lõi',
      content:
        'Trợ lý AI hỗ trợ chẩn đoán thời gian thực với độ trễ dưới 220ms, độ chính xác lâm sàng đạt 94.2%.',
      charCount: 99,
      wordCount: 18,
    },
    {
      id: 'sec-3-business',
      type: BusinessSectionType.BUSINESS_MODEL_UNIT_ECONOMICS,
      title: 'Mô hình Kinh doanh & Unit Economics',
      content:
        'Mô hình B2B Subscription: 15 triệu VNĐ/phòng khám/tháng. Chỉ số CAC 3.2 triệu VNĐ, LTV đạt 48 triệu VNĐ, tỷ lệ hoàn vốn sau 8 tháng.',
      charCount: 135,
      wordCount: 24,
    },
    {
      id: 'sec-4-moat',
      type: BusinessSectionType.COMPETITION_MOAT,
      title: 'Đối thủ & Lợi thế Cạnh tranh (Moat)',
      content:
        'Bộ dữ liệu độc quyền 50,000 ca bệnh án tiếng Việt, độc quyền tích hợp với 3 chuỗi bệnh viện tư nhân lớn.',
      charCount: 108,
      wordCount: 20,
    },
    {
      id: 'sec-5-roadmap',
      type: BusinessSectionType.SOCIAL_IMPACT_ROADMAP,
      title: 'Tác động Xã hội & Lộ trình Phát triển',
      content:
        'Giai đoạn thử nghiệm Q3/2026 tại 15 cơ sở, mở rộng 120 phòng khám khu vực miền Nam vào Q1/2027.',
      charCount: 98,
      wordCount: 18,
    },
  ],
  entityWhitelist: [
    {
      id: 'ent-1',
      rawText: '1.2 tỷ USD',
      category: 'CURRENCY',
      value: '1.2B USD',
      contextSentence: 'Thị trường MedTech đạt 1.2 tỷ USD.',
      sectionType: BusinessSectionType.PROBLEM_MARKET,
    },
    {
      id: 'ent-2',
      rawText: 'CAC 3.2 triệu VNĐ, LTV 48 triệu VNĐ',
      category: 'METRIC',
      value: 'CAC 3.2M, LTV 48M',
      contextSentence: 'Chỉ số CAC 3.2 triệu, LTV đạt 48 triệu.',
      sectionType: BusinessSectionType.BUSINESS_MODEL_UNIT_ECONOMICS,
    },
  ],
  blindSpots: [
    {
      id: 'bs-1',
      domain: BusinessSectionType.BUSINESS_MODEL_UNIT_ECONOMICS,
      severity: 'HIGH',
      title: 'Rủi ro suy kiệt dòng tiền do chi phí API LLM',
      description:
        'Chưa tính toán chi phí token suy luận tăng theo quy mô lượt khám, có thể đẩy biên lợi nhuận xuống dưới mức hòa vốn.',
      attackVector:
        'GS. Vũ Hoàng sẽ xoáy sâu vào chi phí biến đổi trên từng lượt truy vấn y khoa.',
    },
    {
      id: 'bs-2',
      domain: BusinessSectionType.COMPETITION_MOAT,
      severity: 'MEDIUM',
      title: 'Rào cản phòng thủ trước các tập đoàn phần mềm HIS',
      description:
        'Các nhà cung cấp phần mềm bệnh viện hiện tại có thể tích hợp AI wrapper miễn phí để đè bẹp giải pháp.',
      attackVector:
        'Shark Trần Nam sẽ chất vấn kế hoạch giữ chân khách hàng khi đối thủ giảm giá 0 đồng.',
    },
  ],
  processedAt: new Date().toISOString(),
};
