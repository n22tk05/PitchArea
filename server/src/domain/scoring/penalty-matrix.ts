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
  if (overallScore >= 75) {
    // THƯỞNG HỒI MÁU (Phản biện xuất sắc, có số liệu thuyết phục)
    isHeal = true;
    const healBonus = Math.min(15, Math.max(5, Math.round((overallScore - 70) * 0.35)));
    hpDelta = healBonus;
    explanation = `Phản biện xuất sắc (Q=${overallScore}). Thưởng hồi phục +${hpDelta} HP!`;
  } else if (overallScore >= 55) {
    // AN TOÀN / TRỪ RẤT NHẸ (Đạt chuẩn tối thiểu)
    hpDelta = -Math.round(baseDamage * 0.25);
    explanation = `Phản biện đạt yêu cầu nhưng còn chung chung (Q=${overallScore}). Trừ nhẹ ${Math.abs(hpDelta)} HP.`;
  } else {
    // PHẠT NẶNG PHI ĐỐI XỨNG (Thiếu căn cứ, mâu thuẫn hoặc né tránh)
    const rawDamage = baseDamage * ((65 - Math.max(0, overallScore)) / 65);
    const calculatedDamage = Math.round(rawDamage * attitudeMultiplier * streakMultiplier);
    hpDelta = -Math.max(5, calculatedDamage);

    explanation = `Luận điểm thiếu vững chắc (Q=${overallScore}, Hệ số: ${attitudeMultiplier}x). Trừ ${Math.abs(hpDelta)} HP.`;
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
    explanation += ` [KÍCH HOẠT SÀN TÂN THỦ 20%: Chặn tử vong sớm]`;
  }

  // 5. Kiểm tra điều kiện Câu hỏi Phục thù Quyết định (Final Redemption Question) khi máu <= 10%
  const isRedemptionQuestion = candidateNewHp > 0 && candidateNewHp <= 10;
  if (isRedemptionQuestion) {
    explanation += ` [CẢNH BÁO NGUY CẤP: Kích hoạt Lượt Phục thù Quyết định!]`;
  }

  return {
    hpDelta,
    newHp: candidateNewHp,
    isHeal,
    isShieldProtected,
    isRedemptionQuestion,
    explanation,
  };
}
