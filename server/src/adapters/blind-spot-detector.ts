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

    // Điểm mù 1: Bài toán Chi phí Tiếp cận Khách hàng & Biên lợi nhuận
    const hasCacData = whitelist.some(
      (e) =>
        e.sectionType === BusinessSectionType.BUSINESS_MODEL_UNIT_ECONOMICS &&
        /cac|lead|khách hàng/i.test(e.contextSentence)
    );

    blindSpots.push({
      id: 'blindspot-1-unit-economics',
      domain: BusinessSectionType.BUSINESS_MODEL_UNIT_ECONOMICS,
      severity: 'HIGH',
      title: 'Chi phí Tìm kiếm Khách hàng & Lợi nhuận Thực tế',
      description: hasCacData
        ? 'Dự án đã có số liệu chi phí nhưng mức ước tính còn tiềm ẩn rủi ro lạc quan quá mức so với thực tế.'
        : 'Chưa có số liệu thực tế về chi phí để có một khách hàng mới hoặc thời gian thu hồi vốn.',
      attackVector:
        'GS. Vũ Hoàng (Giám khảo Tài chính) sẽ xoáy sâu vào cơ sở thực tế của chi phí thu hút người dùng.',
    });

    // Điểm mù 2: Cỡ mẫu Thử nghiệm & Độ Ổn định Kỹ thuật
    blindSpots.push({
      id: 'blindspot-2-tech-validation',
      domain: BusinessSectionType.SOLUTION_PRODUCT,
      severity: 'HIGH',
      title: 'Cỡ mẫu Thử nghiệm & Độ Ổn định Kỹ thuật',
      description:
        'Độ chính xác kỹ thuật hoặc tính hiệu quả của thuật toán cần được đối chứng trên bộ dữ liệu kiểm thử độc lập ngoài môi trường phòng thí nghiệm.',
      attackVector:
        'TS. Lê Minh Trang (Giám khảo Công nghệ) sẽ chất vấn về phương pháp kiểm tra thực nghiệm và độ tin cậy của mô hình.',
    });

    // Điểm mù 3: Lợi thế Cạnh tranh trước Đối thủ Lớn
    blindSpots.push({
      id: 'blindspot-3-competitive-moat',
      domain: BusinessSectionType.COMPETITION_MOAT,
      severity: 'HIGH',
      title: 'Lợi thế Cạnh tranh & Điểm Khác biệt Trước Đối thủ Lớn',
      description:
        'Nếu một đối thủ có tiềm lực vốn lớn hoặc công ty lớn làm tính năng tương tự, dự án chưa nêu rõ điểm khác biệt để giữ chân người dùng.',
      attackVector:
        'Shark Trần Nam (Giám khảo Thị trường) sẽ dồn ép về lý do khách hàng chọn bạn thay vì dùng giải pháp có sẵn của các bên lớn.',
    });

    return blindSpots;
  }
}
