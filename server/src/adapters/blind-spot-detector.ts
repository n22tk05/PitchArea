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

    // Điểm mù 1: Vấn đề & Khảo sát thị trường thực tế (Shark Trần Nam)
    blindSpots.push({
      id: 'blindspot-1-problem-market',
      domain: BusinessSectionType.PROBLEM_MARKET,
      severity: 'HIGH',
      title: 'Xác Thực Nhu Cầu & Khảo Sát Người Dùng Thực Tế',
      description:
        'Cần có bằng chứng phỏng vấn sâu hoặc thử nghiệm trực tiếp chứng minh khách hàng thực sự đau đớn và sẵn sàng chi tiền giải quyết vấn đề.',
      attackVector:
        'Shark Trần Nam (Giám khảo Thị trường) sẽ chất vấn tính thực chất của các số liệu khảo sát và nhu cầu thực của khách hàng.',
    });

    // Điểm mù 2: Cỡ mẫu Thử nghiệm & Độ Ổn định Kỹ thuật (TS. Lê Minh Trang)
    blindSpots.push({
      id: 'blindspot-2-tech-validation',
      domain: BusinessSectionType.SOLUTION_PRODUCT,
      severity: 'HIGH',
      title: 'Cỡ Mẫu Thử Nghiệm & Độ Ổn Định Sản Phẩm',
      description:
        'Độ chính xác kỹ thuật, độ trễ và tính ổn định của MVP cần được kiểm chứng trên người dùng thật ngoài môi trường thử nghiệm.',
      attackVector:
        'TS. Lê Minh Trang (Giám khảo Công nghệ) sẽ chất vấn về kiến trúc MVP, độ trễ phản hồi và phương pháp thử nghiệm.',
    });

    // Điểm mù 3: Chi phí Sản xuất, Giá bán & Dòng tiền Duy trì (GS. Vũ Hoàng)
    const hasCacData = whitelist.some(
      (e) =>
        e.sectionType === BusinessSectionType.BUSINESS_MODEL_UNIT_ECONOMICS &&
        /cac|lead|khách hàng/i.test(e.contextSentence)
    );

    blindSpots.push({
      id: 'blindspot-3-unit-economics',
      domain: BusinessSectionType.BUSINESS_MODEL_UNIT_ECONOMICS,
      severity: 'HIGH',
      title: 'Giá Bán, Biên Lợi Nhuận & Dòng Tiền Hòa Vốn',
      description: hasCacData
        ? 'Dự án đã có số liệu chi phí nhưng mức ước tính còn tiềm ẩn rủi ro lạc quan quá mức so với thực tế.'
        : 'Chưa có số liệu thực tế về chi phí để có một khách hàng mới hoặc thời gian thu hồi vốn.',
      attackVector:
        'GS. Vũ Hoàng (Giám khảo Tài chính) sẽ xoáy sâu vào bài toán lời/lỗ trên từng sản phẩm và nguồn vốn duy trì đội ngũ.',
    });

    // Điểm mù 4: Rào cản Cạnh tranh & Lộ trình Sống sót (ThS. Đặng Mai Lan)
    blindSpots.push({
      id: 'blindspot-4-risk-roadmap',
      domain: BusinessSectionType.COMPETITION_MOAT,
      severity: 'HIGH',
      title: 'Rủi Ro Cạnh Tranh Trước Đối Thủ Lớn & Lộ Trình Sống Sót',
      description:
        'Nếu đối thủ lớn hoặc công ty nhiều vốn làm tính năng tương tự, dự án chưa nêu rõ vũ khí độc quyền để giữ chân khách hàng dài hạn.',
      attackVector:
        'ThS. Đặng Mai Lan (Giám khảo Rủi ro & Chiến lược) sẽ chất vấn kịch bản phòng thủ và tính khả thi của lộ trình 6-12 tháng tới.',
    });

    return blindSpots;
  }
}
