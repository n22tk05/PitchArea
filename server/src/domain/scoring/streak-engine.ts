export interface StreakState {
  type: 'WIN' | 'LOSE' | 'NEUTRAL';
  count: number;
}

export interface StreakUpdateResult {
  streak: StreakState;
  streakMultiplier: number;  // Nhân vào sát thương nếu Lose Streak, hoặc tăng hồi máu nếu Win Streak
  isComebackSurge: boolean;  // Lật ngược tình thế từ chuỗi thua sang cú ăn điểm lớn
  bonusHp: number;           // Thưởng máu bổ sung cho Comeback Surge
}

/**
 * Động cơ Quản lý Chuỗi Thắng/Thua (Streak Engine)
 */
export class StreakEngine {
  private streak: StreakState = { type: 'NEUTRAL', count: 0 };

  constructor(initialStreak?: StreakState) {
    if (initialStreak) {
      this.streak = { ...initialStreak };
    }
  }

  public getStreak(): StreakState {
    return { ...this.streak };
  }

  /**
   * Cập nhật chuỗi sau khi có điểm chất lượng Q
   */
  public update(overallScore: number): StreakUpdateResult {
    let isComebackSurge = false;
    let bonusHp = 0;
    const prevType = this.streak.type;
    const prevCount = this.streak.count;

    if (overallScore >= 70) {
      // THẮNG (Phản biện tốt)
      if (prevType === 'LOSE' && prevCount >= 2 && overallScore >= 75) {
        // COMEBACK SURGE: Đang thua dồn dập mà bật lại xuất sắc
        isComebackSurge = true;
        bonusHp = 10;
      }

      if (prevType === 'WIN') {
        this.streak.count += 1;
      } else {
        this.streak.type = 'WIN';
        this.streak.count = 1;
      }
    } else if (overallScore < 50) {
      // THUA (Phản biện yếu / cãi cùn)
      if (prevType === 'LOSE') {
        this.streak.count += 1;
      } else {
        this.streak.type = 'LOSE';
        this.streak.count = 1;
      }
    } else {
      // TRUNG TÍNH
      this.streak.type = 'NEUTRAL';
      this.streak.count = 0;
    }

    // Tính hệ số streakMultiplier
    let streakMultiplier = 1.0;
    if (this.streak.type === 'LOSE') {
      // Chuỗi thua càng dài phạt càng nặng (1.0 -> 1.25 -> 1.5 max)
      streakMultiplier = Math.min(1.5, 1.0 + (this.streak.count - 1) * 0.25);
    } else if (this.streak.type === 'WIN') {
      // Chuỗi thắng: tăng cường độ hồi phục
      streakMultiplier = Math.min(1.4, 1.0 + (this.streak.count - 1) * 0.2);
    }

    return {
      streak: { ...this.streak },
      streakMultiplier,
      isComebackSurge,
      bonusHp,
    };
  }
}
