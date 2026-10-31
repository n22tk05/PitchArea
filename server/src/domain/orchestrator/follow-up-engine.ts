import { Injectable, Logger } from '@nestjs/common';
import { JuryBossId, TopicDefinition, BusinessSectionType } from '@pitcharena/shared';

export interface FollowUpDecision {
  action: 'NEW_QUESTION' | 'FOLLOW_UP_DEEP' | 'COACHING_PIVOT';
  topic: string;
  topicId?: string;
  followUpCount: number;
  reason: string;
  suggestedBossId: JuryBossId;
}

export interface CandidateAnswerEvaluation {
  isVague: boolean;
  isDefensive: boolean;
  hasNumbers: boolean;
  wordCount: number;
}

@Injectable()
export class FollowUpEngine {
  private readonly logger = new Logger(FollowUpEngine.name);

  /**
   * Đánh giá sơ bộ câu trả lời của thí sinh (Heuristic Evaluation)
   */
  public evaluateCandidateSpeech(speech: string): CandidateAnswerEvaluation {
    const trimmed = speech.trim();
    const words = trimmed.split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    // Kiểm tra có chứa số liệu hay không
    const hasNumbers = /\d+/.test(trimmed);

    // Dấu hiệu trả lời lảng tránh/chung chung: quá ngắn (< 15 từ) hoặc chứa từ ngữ do dự
    const vagueKeywords = [
      'chưa tính',
      'chưa rõ',
      'đang tìm hiểu',
      'chắc là',
      'có lẽ',
      'khoảng khoảng',
      'tùy thuộc',
      'chưa có số liệu',
    ];
    const isVague =
      wordCount < 15 ||
      vagueKeywords.some((kw) => trimmed.toLowerCase().includes(kw)) ||
      (!hasNumbers && wordCount < 30);

    const isDefensive =
      trimmed.toLowerCase().includes('nhưng mà') ||
      trimmed.toLowerCase().includes('không đồng ý');

    return {
      isVague,
      isDefensive,
      hasNumbers,
      wordCount,
    };
  }

  /**
   * NGÂN HÀNG 32 CHỦ ĐỀ CHUYÊN MÔN CÓ CẤU TRÚC (TOPIC REGISTRY)
   * 8 chủ đề độc lập cho mỗi Giám khảo gắn liền với mục tiêu khảo sát của đề án
   */
  public static readonly TOPIC_REGISTRY: Record<JuryBossId, TopicDefinition[]> = {
    [JuryBossId.MARKET_SHARK]: [
      {
        id: 'mkt_old_habit',
        name: 'So sánh với cách làm truyền thống & Rào cản thay đổi thói quen người dùng',
        focus: 'Người dùng hiện tại giải quyết vấn đề bằng cách nào, tại sao phải đổi sang sản phẩm này?',
        sectionTarget: BusinessSectionType.PROBLEM_MARKET,
      },
      {
        id: 'mkt_real_interviews',
        name: 'Khảo sát thực địa ngoài đời thực & Bằng chứng phỏng vấn sâu',
        focus: 'Số lượng người thật ngoài đời đã gặp trực tiếp, trích dẫn phản hồi thực tế',
        sectionTarget: BusinessSectionType.PROBLEM_MARKET,
      },
      {
        id: 'mkt_first_paying_users',
        name: 'Bằng chứng khách hàng đầu tiên sẵn sàng trả tiền trong 30 ngày',
        focus: 'Ai là người đầu tiên trả tiền, có cam kết LOI/đặt trước hay chỉ nói trên giấy?',
        sectionTarget: BusinessSectionType.BUSINESS_MODEL_UNIT_ECONOMICS,
      },
      {
        id: 'mkt_customer_acquisition',
        name: 'Chi phí tìm khách hàng (CAC) & Kênh tiếp cận 100 người dùng đầu tiên',
        focus: 'Cách tiếp cận người dùng ban đầu không tốn ngân sách marketing',
        sectionTarget: BusinessSectionType.SOCIAL_IMPACT_ROADMAP,
      },
      {
        id: 'mkt_retention_urgency',
        name: 'Mức độ cấp bách của nỗi đau & Lý do khách hàng không rời bỏ sản phẩm',
        focus: 'Tần suất sử dụng hàng ngày và giá trị không thể thay thế',
        sectionTarget: BusinessSectionType.PROBLEM_MARKET,
      },
      {
        id: 'mkt_target_segment',
        name: 'Cơ sở lựa chọn phân khúc khách hàng ngách ban đầu',
        focus: 'Tại sao chọn nhóm khách hàng này thay vì nhóm khác dễ hơn?',
        sectionTarget: BusinessSectionType.PROBLEM_MARKET,
      },
      {
        id: 'mkt_competitive_alternatives',
        name: 'Điểm khác biệt cốt lõi so với các giải pháp và công cụ hiện có trên thị trường',
        focus: 'Khách hàng dùng công cụ miễn phí có sẵn thì nhóm thuyết phục ra sao?',
        sectionTarget: BusinessSectionType.COMPETITION_MOAT,
      },
      {
        id: 'mkt_expansion_friction',
        name: 'Hành trình trải nghiệm thực tế từ tiếp cận đến sử dụng thành thạo',
        focus: 'Khó khăn khi mở rộng sang tệp khách hàng ngoài trường học/địa phương',
        sectionTarget: BusinessSectionType.SOCIAL_IMPACT_ROADMAP,
      },
    ],
    [JuryBossId.TECH_SENTINEL]: [
      {
        id: 'tech_data_flow',
        name: 'Logic hoạt động & Luồng xử lý dữ liệu chi tiết (Input -> Xử lý logic -> Output)',
        focus: 'Các bước xử lý kỹ thuật diễn ra như thế nào từ đầu đến cuối',
        sectionTarget: BusinessSectionType.SOLUTION_PRODUCT,
      },
      {
        id: 'tech_core_vs_api',
        name: 'Cơ chế thuật toán cốt lõi & Tính tự chủ công nghệ vs Gọi API bên ngoài',
        focus: 'Đâu là phần nhóm tự phát triển, đâu là phần mượn từ API có sẵn',
        sectionTarget: BusinessSectionType.SOLUTION_PRODUCT,
      },
      {
        id: 'tech_offline_fallback',
        name: 'Kiến trúc dự phòng ngoại lệ & Bộ đệm Offline khi mất kết nối mạng',
        focus: 'Ứng dụng xử lý ra sao khi mạng chập chờn hoặc API đối tác sập',
        sectionTarget: BusinessSectionType.SOLUTION_PRODUCT,
      },
      {
        id: 'tech_edge_case_handling',
        name: 'Xử lý dữ liệu rác, nhiễu môi trường & Ngoại lệ người dùng thao tác sai',
        focus: 'Khả năng chịu lỗi khi camera mờ, mạng yếu, dữ liệu đầu vào không hợp lệ',
        sectionTarget: BusinessSectionType.SOLUTION_PRODUCT,
      },
      {
        id: 'tech_empirical_metrics',
        name: 'Số lượng mẫu kiểm nghiệm thực tế & Thông số độ chính xác, độ trễ phản hồi',
        focus: 'Kết quả đo lường thực nghiệm: độ trễ dưới 220ms, tải RAM, độ chính xác',
        sectionTarget: BusinessSectionType.SOLUTION_PRODUCT,
      },
      {
        id: 'tech_scalability_load',
        name: 'Kiến trúc hệ thống & Khả năng mở rộng khi lượng truy cập tăng đột biến',
        focus: 'Khả năng chịu tải máy chủ khi có 500-1000 người dùng cùng lúc',
        sectionTarget: BusinessSectionType.SOLUTION_PRODUCT,
      },
      {
        id: 'tech_security_privacy',
        name: 'Kiểm thử an toàn thông tin, bảo mật dữ liệu nhạy cảm & Phân quyền hệ thống',
        focus: 'Cơ chế mã hóa và bảo vệ an toàn thông tin cá nhân',
        sectionTarget: BusinessSectionType.SOLUTION_PRODUCT,
      },
      {
        id: 'tech_hardware_integration',
        name: 'Khả năng tích hợp vào hệ thống/thiết bị sẵn có & Yêu cầu hạ tầng triển khai',
        focus: 'Ứng dụng có chạy mượt trên các dòng điện thoại/máy tính đời cũ không?',
        sectionTarget: BusinessSectionType.SOLUTION_PRODUCT,
      },
    ],
    [JuryBossId.FINANCE_DRAGON]: [
      {
        id: 'fin_mvp_budget',
        name: 'Kế hoạch tài chính triển khai giai đoạn đầu & Chi phí hoàn thiện MVP',
        focus: 'Số tiền tối thiểu để ra mắt bản chạy thật lấy từ đâu: túi cá nhân, lab hay tài trợ?',
        sectionTarget: BusinessSectionType.BUSINESS_MODEL_UNIT_ECONOMICS,
      },
      {
        id: 'fin_monthly_opex',
        name: 'Chi phí vận hành hệ thống hàng tháng & Khả năng tự duy trì của dự án',
        focus: 'Chi phí tối thiểu mỗi tháng để duy trì dự án hoạt động ổn định',
        sectionTarget: BusinessSectionType.BUSINESS_MODEL_UNIT_ECONOMICS,
      },
      {
        id: 'fin_break_even_volume',
        name: 'Điểm hòa vốn thực tế & Mốc sản lượng khách hàng trả phí tối thiểu',
        focus: 'Cần bao nhiêu người dùng trả tiền để doanh thu tự bù toàn bộ chi phí hàng tháng',
        sectionTarget: BusinessSectionType.BUSINESS_MODEL_UNIT_ECONOMICS,
      },
      {
        id: 'fin_unit_pricing',
        name: 'Cơ sở xác định giá bán & Giá trị kinh tế cụ thể mang lại so với chi phí',
        focus: 'Tại sao đưa ra mức giá này, người dùng tiết kiệm được bao nhiêu tiền?',
        sectionTarget: BusinessSectionType.BUSINESS_MODEL_UNIT_ECONOMICS,
      },
      {
        id: 'fin_bootstrap_runway',
        name: 'Kế hoạch sinh tồn tự lực 6 tháng đầu khi chưa có doanh thu đột biến',
        focus: 'Quỹ dự phòng và phương án cắt giảm chi phí tối đa để không chết yểu',
        sectionTarget: BusinessSectionType.BUSINESS_MODEL_UNIT_ECONOMICS,
      },
      {
        id: 'fin_revenue_streams',
        name: 'Tính khả thi của mô hình doanh thu & Cấu trúc các dòng tiền thu phí',
        focus: 'Thu phí một lần, định kỳ hay chia sẻ doanh thu với đối tác?',
        sectionTarget: BusinessSectionType.BUSINESS_MODEL_UNIT_ECONOMICS,
      },
      {
        id: 'fin_capital_efficiency',
        name: 'Định mức chi tiêu nguồn vốn & Hiệu quả sử dụng kinh phí đầu tư/tài trợ',
        focus: 'Tiền thưởng 30-50 triệu sẽ được phân bổ vào các hạng mục nào?',
        sectionTarget: BusinessSectionType.BUSINESS_MODEL_UNIT_ECONOMICS,
      },
      {
        id: 'fin_financial_risk_hedge',
        name: 'Kịch bản ứng phó rủi ro khi chi phí API/Máy chủ tăng vượt dự tính',
        focus: 'Phương án chuyển đổi sang mô hình chi phí thấp hơn nếu API bên ngoài tăng giá',
        sectionTarget: BusinessSectionType.BUSINESS_MODEL_UNIT_ECONOMICS,
      },
    ],
    [JuryBossId.RISK_STRATEGIST]: [
      {
        id: 'risk_defense_moat',
        name: 'Rào cản phòng thủ: Điểm khác biệt ngăn đối thủ lớn sao chép giải pháp',
        focus: 'Điểm khác biệt độc quyền về dữ liệu bản địa, trải nghiệm hoặc mối quan hệ',
        sectionTarget: BusinessSectionType.COMPETITION_MOAT,
      },
      {
        id: 'risk_graduation_cliff',
        name: 'Năng lực cam kết đường dài của đội ngũ sau khi tốt nghiệp ra trường',
        focus: 'Ai sẽ tiếp tục làm dự án khi đi làm công ty, cơ chế phân chia quyền lợi',
        sectionTarget: BusinessSectionType.SOCIAL_IMPACT_ROADMAP,
      },
      {
        id: 'risk_ip_copyright',
        name: 'Rủi ro pháp lý, bản quyền sở hữu trí tuệ & Đạo đức dữ liệu người dùng',
        focus: 'Kế hoạch đăng ký nhãn hiệu, bản quyền phần mềm và tránh vi phạm bản quyền',
        sectionTarget: BusinessSectionType.COMPETITION_MOAT,
      },
      {
        id: 'risk_pilot_roadmap',
        name: 'Lộ trình triển khai 6-12 tháng & Các mốc kiểm chứng thực địa quan trọng',
        focus: 'Danh sách các trường học, bệnh viện, doanh nghiệp đã đồng ý cho thử nghiệm pilot',
        sectionTarget: BusinessSectionType.SOCIAL_IMPACT_ROADMAP,
      },
      {
        id: 'risk_competitive_comparison',
        name: 'So sánh thế mạnh cạnh tranh trực diện và điểm yếu chí mạng của dự án',
        focus: 'Điểm yếu nhất của dự án khi so với đối thủ đầu ngành là gì?',
        sectionTarget: BusinessSectionType.COMPETITION_MOAT,
      },
      {
        id: 'risk_market_shifts',
        name: 'Kế hoạch chuyển hướng (Pivot) và ứng phó biến động thị trường tiêu cực',
        focus: 'Kịch bản dự phòng nếu tệp khách hàng ban đầu từ chối sử dụng',
        sectionTarget: BusinessSectionType.SOCIAL_IMPACT_ROADMAP,
      },
      {
        id: 'risk_legal_compliance',
        name: 'Hành lang pháp lý chuyên ngành & Giấy phép điều kiện cần thiết',
        focus: 'Dự án có cần xin giấy phép giáo dục, y tế, an toàn thông tin hay không?',
        sectionTarget: BusinessSectionType.COMPETITION_MOAT,
      },
      {
        id: 'risk_team_skill_gaps',
        name: 'Cơ cấu đội ngũ sáng lập & Kế hoạch bổ sung các năng lực còn thiếu',
        focus: 'Nhóm thiếu mảng kinh doanh hay kỹ thuật, tìm cố vấn hỗ trợ ra sao?',
        sectionTarget: BusinessSectionType.SOCIAL_IMPACT_ROADMAP,
      },
    ],
  };

  /**
   * CHỦ ĐỀ THỬ THÁCH NGHỊCH ĐẢO (STRESS-TEST INVERSION)
   * Kích hoạt khi toàn bộ 8 chủ đề chính của một Boss đã bị sử dụng hết trong phiên
   */
  public static readonly STRESS_TEST_TOPICS: Record<JuryBossId, TopicDefinition[]> = {
    [JuryBossId.MARKET_SHARK]: [
      {
        id: 'mkt_stress_pricing_war',
        name: 'Thử thách nghịch đảo: Đối thủ lớn tung tính năng tương tự và miễn phí hoàn toàn',
        focus: 'Kịch bản sống sót khi gã khổng lồ sao chép tính năng và tặng không cho người dùng',
        sectionTarget: BusinessSectionType.COMPETITION_MOAT,
      },
      {
        id: 'mkt_stress_churn_crisis',
        name: 'Thử thách nghịch đảo: 80% người dùng dùng thử từ chối quay lại sau tuần đầu tiên',
        focus: 'Kịch bản đối phó với hiện tượng tỷ lệ giữ chân rớt thảm hại ngoài thực tế',
        sectionTarget: BusinessSectionType.PROBLEM_MARKET,
      },
    ],
    [JuryBossId.TECH_SENTINEL]: [
      {
        id: 'tech_stress_total_outage',
        name: 'Thử thách nghịch đảo: Toàn bộ API bên thứ ba mất kết nối trong 24 giờ liên tục',
        focus: 'Kịch bản sinh tồn kỹ thuật khi hạ tầng đám mây sập hoàn toàn',
        sectionTarget: BusinessSectionType.SOLUTION_PRODUCT,
      },
      {
        id: 'tech_stress_corrupted_data',
        name: 'Thử thách nghịch đảo: 100% dữ liệu đầu vào bị rác, mờ và nhiễm mã độc',
        focus: 'Kịch bản phòng ngự dữ liệu cực đoan trước các cuộc tấn công phá hoại',
        sectionTarget: BusinessSectionType.SOLUTION_PRODUCT,
      },
    ],
    [JuryBossId.FINANCE_DRAGON]: [
      {
        id: 'fin_stress_zero_budget',
        name: 'Thử thách nghịch đảo: Nguồn tài trợ bị cắt giảm và dự án phải sinh tồn với 0 đồng ngân sách',
        focus: 'Kịch bản vận hành không dùng tiền khi mọi nguồn hỗ trợ bên ngoài bị rút sạch',
        sectionTarget: BusinessSectionType.BUSINESS_MODEL_UNIT_ECONOMICS,
      },
      {
        id: 'fin_stress_cost_spike',
        name: 'Thử thách nghịch đảo: Chi phí máy chủ và API tăng đột biến gấp 5 lần dự toán',
        focus: 'Phương án tái cấu trúc kinh tế đơn vị khi chi phí hạ tầng leo thang không kiểm soát',
        sectionTarget: BusinessSectionType.BUSINESS_MODEL_UNIT_ECONOMICS,
      },
    ],
    [JuryBossId.RISK_STRATEGIST]: [
      {
        id: 'risk_stress_clone_assault',
        name: 'Thử thách nghịch đảo: Công ty công nghệ đầu ngành sao chép toàn bộ mã nguồn và tính năng',
        focus: 'Vũ khí phòng ngự độc quyền cuối cùng để bảo vệ sự tồn tại của dự án',
        sectionTarget: BusinessSectionType.COMPETITION_MOAT,
      },
      {
        id: 'risk_stress_team_disband',
        name: 'Thử thách nghịch đảo: 2 thành viên kỹ thuật chủ chốt rời nhóm ngay sau khi ra trường',
        focus: 'Kế hoạch chuyển giao công nghệ và bảo toàn tài sản trí tuệ khi nhân sự cốt lõi biến động',
        sectionTarget: BusinessSectionType.SOCIAL_IMPACT_ROADMAP,
      },
    ],
  };

  /**
   * Bảng ánh xạ chuỗi tên chủ đề phục vụ backward compatibility
   */
  public static readonly BOSS_TOPICS: Record<JuryBossId, string[]> = {
    [JuryBossId.MARKET_SHARK]: FollowUpEngine.TOPIC_REGISTRY[JuryBossId.MARKET_SHARK].map((t) => t.name),
    [JuryBossId.TECH_SENTINEL]: FollowUpEngine.TOPIC_REGISTRY[JuryBossId.TECH_SENTINEL].map((t) => t.name),
    [JuryBossId.FINANCE_DRAGON]: FollowUpEngine.TOPIC_REGISTRY[JuryBossId.FINANCE_DRAGON].map((t) => t.name),
    [JuryBossId.RISK_STRATEGIST]: FollowUpEngine.TOPIC_REGISTRY[JuryBossId.RISK_STRATEGIST].map((t) => t.name),
  };

  /**
   * Lấy định nghĩa chủ đề chi tiết từ Topic ID hoặc Topic Name
   */
  public getTopicDefinition(topicIdOrName: string): TopicDefinition | undefined {
    for (const bossId of Object.values(JuryBossId)) {
      const list = FollowUpEngine.TOPIC_REGISTRY[bossId] || [];
      const match = list.find((t) => t.id === topicIdOrName || t.name === topicIdOrName);
      if (match) return match;
      const stressList = FollowUpEngine.STRESS_TEST_TOPICS[bossId] || [];
      const stressMatch = stressList.find((t) => t.id === topicIdOrName || t.name === topicIdOrName);
      if (stressMatch) return stressMatch;
    }
    return undefined;
  }

  /**
   * Lấy chủ đề mặc định phù hợp với chuyên môn của từng Giám khảo
   */
  public getDefaultTopicForBoss(bossId: JuryBossId): string {
    const topics = FollowUpEngine.TOPIC_REGISTRY[bossId];
    return topics && topics.length > 0 ? topics[0].name : 'Định hướng phát triển dự án';
  }

  /**
   * Lấy định nghĩa chủ đề mặc định của Boss
   */
  public getDefaultTopicDefinition(bossId: JuryBossId): TopicDefinition {
    const topics = FollowUpEngine.TOPIC_REGISTRY[bossId];
    return (
      topics && topics.length > 0
        ? topics[0]
        : {
            id: `${bossId.toLowerCase()}_default`,
            name: 'Định hướng phát triển dự án',
            focus: 'Định hướng phát triển và triển khai dự án thực tế',
          }
    );
  }

  /**
   * CHỌN CHỦ ĐỀ VỚI BỘ LỌC CUMULATIVE TOPIC BURN-DOWN:
   * Lọc bỏ 100% các chủ đề đã từng sử dụng trong suốt phiên đấu (usedTopicIds)
   */
  public getTopicForBoss(
    bossId: JuryBossId,
    usedTopicIds: string[] = []
  ): { topic: string; topicId: string; definition: TopicDefinition } {
    const allTopics = FollowUpEngine.TOPIC_REGISTRY[bossId] || [];

    // Lọc bỏ tất cả chủ đề có id hoặc name nằm trong danh sách đã đốt cháy
    const candidates = allTopics.filter(
      (t) => !usedTopicIds.includes(t.id) && !usedTopicIds.includes(t.name)
    );

    if (candidates.length > 0) {
      const randomIndex = Math.floor(Math.random() * candidates.length);
      const chosen = candidates[randomIndex];
      return { topic: chosen.name, topicId: chosen.id, definition: chosen };
    }

    // Nếu cả 8 chủ đề chính của Boss đã dùng hết: Kích hoạt Stress-Test Inversion
    const stressCandidates = (FollowUpEngine.STRESS_TEST_TOPICS[bossId] || []).filter(
      (t) => !usedTopicIds.includes(t.id) && !usedTopicIds.includes(t.name)
    );

    if (stressCandidates.length > 0) {
      const randomIndex = Math.floor(Math.random() * stressCandidates.length);
      const chosen = stressCandidates[randomIndex];
      this.logger.warn(
        `[FollowUpEngine] ⚠️ Đã cạn kiệt 8 chủ đề chính của [${bossId}]. Kích hoạt chủ đề thử thách nghịch đảo: "${chosen.name}" (${chosen.id})`
      );
      return { topic: chosen.name, topicId: chosen.id, definition: chosen };
    }

    // Trường hợp cực đoan (đấu hơn 10 lượt solo cùng 1 boss): xoay vòng lại chủ đề đầu tiên
    const fallback = allTopics[0] || this.getDefaultTopicDefinition(bossId);
    return { topic: fallback.name, topicId: fallback.id, definition: fallback };
  }

  /**
   * Lấy ngẫu nhiên một chủ đề đa dạng phù hợp chuyên môn của Giám khảo (Backward-Compatible String Method)
   */
  public getRandomTopicForBoss(
    bossId: JuryBossId,
    excludeTopicOrUsedIds?: string | string[]
  ): string {
    const used = Array.isArray(excludeTopicOrUsedIds)
      ? excludeTopicOrUsedIds
      : excludeTopicOrUsedIds
      ? [excludeTopicOrUsedIds]
      : [];
    return this.getTopicForBoss(bossId, used).topic;
  }

  /**
   * Luân chuyển chủ đề cho Giám khảo tiếp theo, tôn trọng danh sách chủ đề đã cháy
   */
  public rotateTopicForBoss(
    bossId: JuryBossId,
    usedTopicIds: string[] = []
  ): { topic: string; topicId: string } {
    const result = this.getTopicForBoss(bossId, usedTopicIds);
    return { topic: result.topic, topicId: result.topicId };
  }

  /**
   * Quyết định bước tiếp theo: Đào sâu thêm lần 2 hay Chuyển sang Coaching Pivot (Strike 2)
   * Tích hợp cơ chế Cumulative Topic Burn-down với mảng usedTopicIds
   */
  public decideNextMove(
    currentFollowUpCount: number,
    currentTopic: string,
    evaluation: CandidateAnswerEvaluation,
    currentBossId: JuryBossId,
    availableBossIds?: JuryBossId[],
    isCurrentCoachingPivot = false,
    mode?: string,
    usedTopicIds: string[] = []
  ): FollowUpDecision {
    // Luôn luân phiên đổi Giám khảo qua từng lượt để mô phỏng chân thực Hội đồng chấm thi
    const nextBoss = this.rotateBoss(currentBossId, availableBossIds);
    const nextTopicResult = this.rotateTopicForBoss(nextBoss, usedTopicIds);

    // Nếu thí sinh 2 lần liên tiếp bị đuối lý ở cùng một mảng (Coaching Pivot):
    if (isCurrentCoachingPivot || currentFollowUpCount >= 2) {
      this.logger.log(
        `[FollowUpEngine] Completed coaching/follow-up cycle. Rotating to new boss: ${nextBoss} with topic: "${nextTopicResult.topic}" (${nextTopicResult.topicId})`
      );
      return {
        action: 'NEW_QUESTION',
        topic: nextTopicResult.topic,
        topicId: nextTopicResult.topicId,
        followUpCount: 0,
        reason: 'Đã hoàn thành vòng gợi ý sư phạm. Chuyển sang Giám khảo tiếp theo trong Hội đồng.',
        suggestedBossId: nextBoss,
      };
    }

    // Nếu chỉ có đúng 1 Boss (ví dụ chế độ Solo/Quick Combat hoặc chỉ có 1 đề mục)
    // thì mới bới sâu cùng 1 Boss
    if (availableBossIds && availableBossIds.length === 1) {
      if (evaluation.isVague) {
        if (currentFollowUpCount === 0) {
          return {
            action: 'FOLLOW_UP_DEEP',
            topic: currentTopic,
            followUpCount: 1,
            reason: 'Thí sinh trả lời còn chung chung, thiếu số liệu định lượng.',
            suggestedBossId: currentBossId,
          };
        } else if (currentFollowUpCount === 1) {
          return {
            action: 'COACHING_PIVOT',
            topic: currentTopic,
            followUpCount: 2,
            reason: 'Thí sinh 2 lần liên tiếp gặp khó khăn ở cùng chủ đề. Chuyển sang gợi ý sư phạm.',
            suggestedBossId: currentBossId,
          };
        }
      }
    }

    // MẶC ĐỊNH HỘI ĐỒNG (FULL ARENA):
    // Sau mỗi câu trả lời của thí sinh, Giám khảo tiếp theo sẽ tiếp quản micro để hỏi theo chuyên môn riêng!
    this.logger.log(
      `[FollowUpEngine] Hội đồng chuyển micro từ [${currentBossId}] sang [${nextBoss}] (Chủ đề mới: "${nextTopicResult.topic}" [ID: ${nextTopicResult.topicId}] | Đã dùng: ${usedTopicIds.length} chủ đề)`
    );

    return {
      action: 'NEW_QUESTION',
      topic: nextTopicResult.topic,
      topicId: nextTopicResult.topicId,
      followUpCount: 0,
      reason: 'Chuyển lượt cho Giám khảo tiếp theo trong Hội đồng chất vấn.',
      suggestedBossId: nextBoss,
    };
  }

  private rotateBoss(currentBossId: JuryBossId, availableBossIds?: JuryBossId[]): JuryBossId {
    const allowed =
      availableBossIds && availableBossIds.length > 0
        ? availableBossIds
        : Object.values(JuryBossId);

    if (allowed.length === 1) {
      return allowed[0];
    }

    const currentIndex = allowed.indexOf(currentBossId);
    if (currentIndex === -1) {
      return allowed[0];
    }
    const nextIndex = (currentIndex + 1) % allowed.length;
    return allowed[nextIndex];
  }
}
