import { CombatDifficulty } from '@pitcharena/shared';

export interface PenaltyCalculationInput {
  overallScore: number;       // Q: 0 - 100
  difficulty: CombatDifficulty;
  attitudeMultiplier: number; // 0.3x (cầu thị, thừa nhận) -> 1.5x (cãi cùn, né tránh)
  streakMultiplier: number;   // 1.0 -> 1.5x nếu chuỗi thua
  currentHp: number;          // Máu hiện tại 0 - 100
  turnNumber: number;         // Lượt 1, 2, 3...
  shieldFloor?: number;       // Sàn bảo hiểm tân thủ (mặc định 20%)
}

export interface PenaltyCalculationResult {
  hpDelta: number;            // Dương là hồi máu (+), âm là trừ máu (-)
  newHp: number;
  isHeal: boolean;
  isShieldProtected: boolean;
  isRedemptionQuestion: boolean;
  explanation: string;
}

/**
 * Ma trận Phạt phi đối xứng & Kẹp sàn máu tân thủ (Phase 4)
 */
export function calculatePenalty(input: PenaltyCalculationInput): PenaltyCalculationResult {
  const {
    overallScore,
    difficulty,
    attitudeMultiplier,
    streakMultiplier,
    currentHp,
    turnNumber,
    shieldFloor = 20,
  } = input;

  // 1. Xác định sát thương cơ sở theo cấp độ khó
  const baseDamage =
    difficulty === CombatDifficulty.EASY
      ? 15
      : difficulty === CombatDifficulty.NORMAL
      ? 20
      : 25;

  let hpDelta = 0;
  let isHeal = false;
  let explanation = '';

  // 2. Tính toán biến động HP dựa trên điểm chất lượng Q
  if (overallScore >= 65) {
    // THƯỞNG HỒI MÁU (Phản biện đạt yêu cầu tốt, lập luận rõ ràng, thuyết phục)
    isHeal = true;
    const healBonus = Math.min(15, Math.max(5, Math.round((overallScore - 60) * 0.4)));
    hpDelta = healBonus;
    explanation = 'Phản biện tốt, lập luận rõ ràng và làm rõ được ý tưởng đề tài.';
  } else if (overallScore >= 50) {
    // AN TOÀN / GIỮ MÁU (Đạt chuẩn tối thiểu, tiếp thu hoặc diễn đạt tương đối)
    hpDelta = 0; // Giữ nguyên máu, không trừ oan thí sinh khi đã đạt ngưỡng trung bình khá
    explanation = 'Phản biện đạt yêu cầu cơ bản, bảo vệ thành công luận điểm.';
  } else if (overallScore >= 40) {
    // TRỪ NHẸ (Nói vấp / ngập ngừng hoặc thiếu số liệu nhưng có nỗ lực giải trình)
    hpDelta = -Math.max(3, Math.round(baseDamage * 0.25)); // Trừ rất nhẹ (3-5 HP)
    explanation = 'Thí sinh diễn đạt còn vấp váp hoặc chung chung, cần bổ sung thêm dẫn chứng cụ thể.';
  } else {
    // PHẠT NẶNG PHI ĐỐI XỨNG (Thiếu căn cứ, mâu thuẫn hoặc né tránh)
    const rawDamage = baseDamage * ((50 - Math.max(0, overallScore)) / 50);
    const calculatedDamage = Math.round(rawDamage * attitudeMultiplier * streakMultiplier);
    hpDelta = -Math.max(5, calculatedDamage);

    if (overallScore <= 25) {
      explanation = 'Thí sinh không phản hồi hoặc né tránh câu hỏi chất vấn.';
    } else if (overallScore <= 35) {
      explanation = 'Câu trả lời bị ngắt giữa chừng, diễn đạt lặp từ vòng vo hoặc thiếu hẳn căn cứ số liệu.';
    } else {
      explanation = 'Luận điểm thiếu vững chắc, chưa đủ cơ sở định lượng.';
    }
  }

  // 3. Tính máu mới trước khi xét sàn
  let candidateNewHp = Math.min(100, Math.max(0, currentHp + hpDelta));
  let isShieldProtected = false;

  // 4. Kẹp SÀN MÁU TÂN THỦ (Pedagogical Shield Floor): Trong 3 câu đầu, không để tụt dưới shieldFloor (20%)
  if (turnNumber <= 3 && candidateNewHp < shieldFloor) {
    isShieldProtected = true;
    const clampedNewHp = Math.max(currentHp > shieldFloor ? shieldFloor : currentHp, shieldFloor);
    hpDelta = clampedNewHp - currentHp;
    candidateNewHp = clampedNewHp;
  }

  // 5. Kiểm tra điều kiện Câu hỏi Phục thù Quyết định (Final Redemption Question) khi máu <= 10%
  const isRedemptionQuestion = candidateNewHp > 0 && candidateNewHp <= 10;

  return {
    hpDelta,
    newHp: candidateNewHp,
    isHeal,
    isShieldProtected,
    isRedemptionQuestion,
    explanation,
  };
}
