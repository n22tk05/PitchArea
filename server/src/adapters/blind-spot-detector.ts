import {
  BlindSpot,
  BusinessSectionType,
  DocumentSection,
  EntityWhitelistItem,
} from '@pitcharena/shared';

export class BlindSpotDetector {
  /**
   * Nhận diện 3 điểm mù rủi ro theo Preset 1 (Cố định chuẩn SV-Startup & Euréka)
   */
  public static detect(
    sections: DocumentSection[],
    whitelist: EntityWhitelistItem[]
  ): BlindSpot[] {
    const blindSpots: BlindSpot[] = [];

    // Tìm kiếm các dữ liệu hiện có trong các khối đề mục
    const financeSection = sections.find(
      (s) => s.type === BusinessSectionType.BUSINESS_MODEL_UNIT_ECONOMICS
    );
    const techSection = sections.find(
      (s) => s.type === BusinessSectionType.SOLUTION_PRODUCT
    );
    const moatSection = sections.find(
      (s) => s.type === BusinessSectionType.COMPETITION_MOAT
    );

    // Điểm mù 1: Unit Economics & CAC (Financial Vulnerability)
    const hasCacData = whitelist.some(
      (e) =>
        e.sectionType === BusinessSectionType.BUSINESS_MODEL_UNIT_ECONOMICS &&
        /cac|lead|khách hàng/i.test(e.contextSentence)
    );

    blindSpots.push({
      id: 'blindspot-1-unit-economics',
      domain: BusinessSectionType.BUSINESS_MODEL_UNIT_ECONOMICS,
      severity: 'HIGH',
      title: 'Giả định Chi phí Tiếp cận Khách hàng (CAC) & Biên lợi nhuận',
      description: hasCacData
        ? 'Dự án đã có số liệu chi phí nhưng mức ước tính còn tiềm ẩn rủi ro lạc quan quá mức so với thực tế ngành.'
        : 'Chưa có dữ liệu kiểm chứng thực nghiệm về CAC hoặc thời gian thu hồi vốn (Payback Period).',
      attackVector:
        'GS. Vũ Hoàng (Giám khảo Tài chính) sẽ xoáy sâu vào cơ sở thực nghiệm của giả định chi phí thu hút người dùng.',
    });

    // Điểm mù 2: Overfitting & Cỡ mẫu Thử nghiệm (Technical Vulnerability)
    blindSpots.push({
      id: 'blindspot-2-tech-validation',
      domain: BusinessSectionType.SOLUTION_PRODUCT,
      severity: 'HIGH',
      title: 'Cỡ mẫu Thử nghiệm (Dataset Size) & Nguy cơ Overfitting',
      description:
        'Độ chính xác kỹ thuật hoặc tính hiệu quả của thuật toán cần được đối chứng trên bộ dữ liệu kiểm thử độc lập ngoài môi trường phòng thí nghiệm.',
      attackVector:
        'TS. Lê Minh Trang (Giám khảo Công nghệ) sẽ chất vấn về phương pháp kiểm định chéo và khả năng khái quát hóa mô hình.',
    });

    // Điểm mù 3: Lợi thế Cạnh tranh & Đòn phản công từ Big Tech (Moat Vulnerability)
    blindSpots.push({
      id: 'blindspot-3-competitive-moat',
      domain: BusinessSectionType.COMPETITION_MOAT,
      severity: 'HIGH',
      title: 'Rào cản Phòng thủ (Moat) trước Đối thủ Lớn',
      description:
        'Nếu một đối thủ có tiềm lực vốn lớn hoặc tập đoàn công nghệ tích hợp miễn phí tính năng tương tự, dự án chưa nêu rõ vũ khí giữ chân người dùng.',
      attackVector:
        'Shark Trần Nam (Giám khảo Thị trường) sẽ dồn ép về tốc độ mở rộng thị trường và chi phí chuyển đổi (Switching Cost).',
    });

    return blindSpots;
  }
}
