import {
  BusinessSectionType,
  DocumentSection,
  ProjectFoundationFacts,
} from '@pitcharena/shared';

export class FoundationFactsExtractor {
  /**
   * Trích xuất 4 Dữ kiện nền tảng định vị dự án từ nội dung Markdown và các Section
   */
  public static extract(
    markdown: string,
    sections: DocumentSection[]
  ): ProjectFoundationFacts {
    const textLower = markdown.toLowerCase();

    // 1. Nhóm 1: Xác định Khách hàng mục tiêu (Target Customer)
    let targetCustomerType: ProjectFoundationFacts['targetCustomerType'] = 'UNKNOWN';
    let targetCustomerSummary = 'Chưa xác định rõ đối tượng trả tiền';
    let isCustomerExplicit = false;

    if (
      /\b(b2g|g2c|chính quyền|nhà nước|cơ quan nhà nước|bệnh viện công|trường học công|ủy ban)\b/i.test(
        textLower
      )
    ) {
      targetCustomerType = 'B2G_G2C';
      targetCustomerSummary = 'Khối công, cơ quan chính quyền hoặc trường học / bệnh viện (B2G/G2C)';
      isCustomerExplicit = true;
    } else if (
      /\b(b2b|doanh nghiệp|công ty|khách hàng b2b|nhà hàng|khách sạn|đại lý|nhà thuốc|doanh nghiệp vừa và nhỏ|sme)\b/i.test(
        textLower
      )
    ) {
      targetCustomerType = 'B2B';
      targetCustomerSummary = 'Doanh nghiệp, tổ chức hoặc hộ kinh doanh (B2B)';
      isCustomerExplicit = true;
    } else if (
      /\b(b2c|người dùng cuối|sinh viên|học sinh|người tiêu dùng|cá nhân|khách hàng cá nhân|phụ huynh)\b/i.test(
        textLower
      )
    ) {
      targetCustomerType = 'B2C';
      targetCustomerSummary = 'Người dùng cá nhân hoặc học sinh / sinh viên (B2C)';
      isCustomerExplicit = true;
    }

    // 2. Nhóm 2: Xác định Loại hình sản phẩm & Giai đoạn thực tế
    let productType: ProjectFoundationFacts['productType'] = 'SOFTWARE_APP';
    if (
      /\b(mô hình ai|thuật toán ai|llm|hệ thống ai|deep learning|computer vision|trí tuệ nhân tạo)\b/i.test(
        textLower
      )
    ) {
      productType = 'AI_SYSTEM';
    } else if (
      /\b(thiết bị|phần cứng|iot|cảm biến|vi điều khiển|arduino|esp32|máy móc|robot)\b/i.test(
        textLower
      )
    ) {
      productType = 'HARDWARE_IOT';
    } else if (
      /\b(sản phẩm vật lý|dịch vụ ăn uống|du lịch|thủ công mỹ nghệ|nông sản|trà|thảo dược)\b/i.test(
        textLower
      )
    ) {
      productType = 'PHYSICAL_SERVICE';
    }

    let productStage: ProjectFoundationFacts['productStage'] = 'IDEA_RESEARCH';
    let isStageExplicit = false;

    if (
      /\b(thương mại hóa|đang bán|doanh thu đạt|khách hàng hiện tại|đang vận hành|triển khai thực tế)\b/i.test(
        textLower
      )
    ) {
      productStage = 'MARKET_READY';
      isStageExplicit = true;
    } else if (
      /\b(mvp|bản thử nghiệm|mẫu thử hoạt động|prototype|chạy thử nghiệm|đã thử nghiệm với)\b/i.test(
        textLower
      )
    ) {
      productStage = 'WORKING_MVP';
      isStageExplicit = true;
    } else if (
      /\b(trong phòng lab|thí nghiệm|mô phỏng|mô hình hóa|nghiên cứu thực nghiệm)\b/i.test(
        textLower
      )
    ) {
      productStage = 'LAB_PROTOTYPE';
      isStageExplicit = true;
    }

    // 3. Nhóm 3: Xác định Mô hình kinh doanh & Dòng tiền (Revenue Model)
    let revenueModelType: ProjectFoundationFacts['revenueModelType'] = 'UNKNOWN';
    let revenueModelSummary = 'Chưa nêu rõ mô hình thu tiền hoặc giá bán';
    let isRevenueModelExplicit = false;

    const financeSec = sections.find(
      (s) => s.type === BusinessSectionType.BUSINESS_MODEL_UNIT_ECONOMICS
    );
    const financeText = (financeSec?.content || textLower).toLowerCase();

    if (
      /\b(thuê bao|subscription|hàng tháng|định kỳ|theo tháng|theo năm|gói dịch vụ)\b/i.test(
        financeText
      )
    ) {
      revenueModelType = 'SUBSCRIPTION';
      revenueModelSummary = 'Thu phí định kỳ theo tháng/năm (Subscription SaaS)';
      isRevenueModelExplicit = true;
    } else if (
      /\b(hoa hồng|phí giao dịch|chiết khấu|take rate|% trên mỗi đơn|trung gian kết nối)\b/i.test(
        financeText
      )
    ) {
      revenueModelType = 'COMMISSION_FEE';
      revenueModelSummary = 'Thu phí hoa hồng hoặc % trên mỗi giao dịch (Marketplace / Platform)';
      isRevenueModelExplicit = true;
    } else if (
      /\b(miễn phí|quảng cáo|quảng cáo trong app|ads|freemium)\b/i.test(
        financeText
      )
    ) {
      revenueModelType = 'FREEMIUM_ADS';
      revenueModelSummary = 'Miễn phí cho người dùng, thu tiền từ quảng cáo hoặc dịch vụ nâng cao';
      isRevenueModelExplicit = true;
    } else if (
      /\b(giá bán|mua đứt|bán theo sản phẩm|đơn giá|bán lẻ|bán sỉ|chi phí mỗi gói)\b/i.test(
        financeText
      )
    ) {
      revenueModelType = 'ONE_TIME_SALE';
      revenueModelSummary = 'Bán đứt sản phẩm theo từng đơn hàng / giấy phép';
      isRevenueModelExplicit = true;
    }

    // 4. Nhóm 4: Lợi thế cạnh tranh & Lộ trình (Moat & Roadmap)
    const moatSec = sections.find(
      (s) => s.type === BusinessSectionType.COMPETITION_MOAT
    );
    const hasIdentifiedMoat =
      (moatSec && moatSec.charCount > 100) ||
      /\b(độc quyền|bằng sáng chế|bí quyết|dữ liệu riêng|lợi thế cạnh tranh|rào cản)\b/i.test(
        textLower
      );

    const moatSummary = hasIdentifiedMoat
      ? 'Đã đề cập đến rào cản độc quyền / bí quyết riêng nhưng cần chứng minh thực tế'
      : 'Chưa có rào cản độc quyền rõ ràng, dễ bị đối thủ nhiều tiền sao chép';

    const hasExecutionRoadmap = /\b(lộ trình|quý 1|quý 2|quý 3|tháng 1|tháng 2|giai đoạn 1|giai đoạn 2|cột mốc|kế hoạch 6 tháng|kế hoạch 1 năm)\b/i.test(
      textLower
    );

    return {
      targetCustomerType,
      targetCustomerSummary,
      isCustomerExplicit,
      productType,
      productStage,
      isStageExplicit,
      revenueModelType,
      revenueModelSummary,
      isRevenueModelExplicit,
      hasIdentifiedMoat,
      moatSummary,
      hasExecutionRoadmap,
    };
  }
}
