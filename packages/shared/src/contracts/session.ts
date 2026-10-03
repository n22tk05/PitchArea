import { z } from 'zod';

/**
 * 3 Cấp độ khó của Đấu trường
 */
export const CombatDifficulty = {
  EASY: 'EASY',         // Tập sự: Cho phép vấp váp, trừ máu nhẹ (-5% HP), VAD 3.0s
  NORMAL: 'NORMAL',     // Bảo vệ chính thức: Chuẩn hội đồng, trừ -10% HP, VAD 2.0s
  HARDCORE: 'HARDCORE', // Chung kết Startup: Áp lực cực độ, dồn dập, trừ -15% HP, VAD 1.5s
} as const;

export type CombatDifficulty =
  (typeof CombatDifficulty)[keyof typeof CombatDifficulty];

export const CombatDifficultyDetails: Record<
  CombatDifficulty,
  { label: string; desc: string; hpPenalty: number; vadSilenceSec: number; badgeColor: string }
> = {
  [CombatDifficulty.EASY]: {
    label: 'Tập Sự (Easy)',
    desc: 'Hội đồng ôn hòa, gợi mở câu trả lời, trừ nhẹ -5% HP',
    hpPenalty: 5,
    vadSilenceSec: 3.0,
    badgeColor: 'border-emerald-500 text-emerald-400',
  },
  [CombatDifficulty.NORMAL]: {
    label: 'Chính Thức (Normal)',
    desc: 'Chuẩn hội đồng đại học, chất vấn thực tế, phạt -10% HP',
    hpPenalty: 10,
    vadSilenceSec: 2.0,
    badgeColor: 'border-amber-500 text-amber-400',
  },
  [CombatDifficulty.HARDCORE]: {
    label: 'Chung Kết (Hardcore)',
    desc: 'Áp lực cực hạn Shark Tank, bẫy logic sâu cay, phạt -15% HP',
    hpPenalty: 15,
    vadSilenceSec: 1.5,
    badgeColor: 'border-rose-500 text-rose-400',
  },
};

/**
 * Chế độ thi đấu
 */
export const ArenaMode = {
  FULL_ARENA: 'FULL_ARENA',     // Cả 3 Giám khảo luân phiên chất vấn
  QUICK_COMBAT: 'QUICK_COMBAT', // Đấu 1-on-1 nhanh với 1 Giám khảo chỉ định (Solo Boss)
} as const;

export type ArenaMode = (typeof ArenaMode)[keyof typeof ArenaMode];

/**
 * Định danh 3 Giám khảo Solo Boss
 */
export const JuryBossId = {
  FINANCE_DRAGON: 'FINANCE_DRAGON', // GS. Vũ Hoàng
  TECH_SENTINEL: 'TECH_SENTINEL',   // TS. Lê Minh Trang
  MARKET_SHARK: 'MARKET_SHARK',     // Shark Trần Nam
} as const;

export type JuryBossId = (typeof JuryBossId)[keyof typeof JuryBossId];

export interface JuryBossProfile {
  id: JuryBossId;
  name: string;
  title: string;
  level: number;
  domain: string;
  focus: string;
  avatarIcon: string;
  signatureStyle: string;
}

export const JURY_BOSS_PROFILES: Record<JuryBossId, JuryBossProfile> = {
  [JuryBossId.FINANCE_DRAGON]: {
    id: JuryBossId.FINANCE_DRAGON,
    name: 'GS. Vũ Hoàng',
    title: 'Trưởng Ban Thẩm Định Tài Chính',
    level: 95,
    domain: 'Tài chính & Unit Economics',
    focus: 'Xoáy sâu dòng tiền, CAC, LTV, biên hòa vốn và rủi ro cạn vốn.',
    avatarIcon: 'Coins',
    signatureStyle: 'Lạnh lùng, bóc trần từng con số, không chấp nhận dự phóng vô căn cứ.',
  },
  [JuryBossId.TECH_SENTINEL]: {
    id: JuryBossId.TECH_SENTINEL,
    name: 'TS. Lê Minh Trang',
    title: 'Chuyên Gia Thẩm Định Công Nghệ',
    level: 92,
    domain: 'Kiến Trúc Kỹ Thuật & Đổi Mới AI',
    focus: 'Bóc tách độ trễ hệ thống, rủi ro ảo giác AI, rò rỉ dữ liệu và khả năng mở rộng.',
    avatarIcon: 'Cpu',
    signatureStyle: 'Kỹ tính, logic thực nghiệm, truy vấn tận gốc công nghệ lõi.',
  },
  [JuryBossId.MARKET_SHARK]: {
    id: JuryBossId.MARKET_SHARK,
    name: 'Shark Trần Nam',
    title: 'Nhà Đầu Tư Chiến Lược',
    level: 98,
    domain: 'Quy Mô Thị Trường & Rào Cản Phòng Thủ (Moat)',
    focus: 'Truy vấn Product-Market Fit, TAM/SAM/SOM và kịch bản bị Big Tech bóp nghẹt.',
    avatarIcon: 'ShieldAlert',
    signatureStyle: 'Sắc bén, nhắm thẳng tử huyệt kinh doanh, áp đảo tâm lý.',
  },
};

/**
 * Zod Schema cho Cấu hình Sảnh Đấu (Lobby Config)
 */
export const LobbyConfigSchema = z.object({
  mode: z.enum([ArenaMode.FULL_ARENA, ArenaMode.QUICK_COMBAT]),
  difficulty: z.enum([
    CombatDifficulty.EASY,
    CombatDifficulty.NORMAL,
    CombatDifficulty.HARDCORE,
  ]),
  selectedBoss: z
    .enum([
      JuryBossId.FINANCE_DRAGON,
      JuryBossId.TECH_SENTINEL,
      JuryBossId.MARKET_SHARK,
    ])
    .nullable()
    .optional(),
  roundDurationSeconds: z.number().int().min(15).max(120).default(30),
  prepBufferSeconds: z.number().int().min(0).max(15).default(7),
  enableLiveSubtitles: z.boolean().default(true),
  pedagogicalShieldFloor: z.number().min(0).max(50).default(20), // Khóa máu tối thiểu 20%
});

export type LobbyConfig = z.infer<typeof LobbyConfigSchema>;

/**
 * Trạng thái phiên đấu FSM
 */
export const SessionFsmState = {
  LOBBY_READY: 'LOBBY_READY',         // Ở sảnh chờ, chỉnh thông số
  PREP_BUFFER: 'PREP_BUFFER',         // Đệm 7s suy nghĩ
  CANDIDATE_PITCH: 'CANDIDATE_PITCH', // Sinh viên đang nói qua mic
  BOSS_QUESTIONING: 'BOSS_QUESTIONING',// Giám khảo đang chất vấn
  COMBAT_ACTIVE: 'COMBAT_ACTIVE',     // Sinh viên đối chất 30s
  TACTICAL_PAUSE: 'TACTICAL_PAUSE',   // Tạm dừng chiến thuật
  EVALUATION_REPORT: 'EVALUATION_REPORT', // Kết thúc, hiển thị phụ lục
} as const;

export type SessionFsmState =
  (typeof SessionFsmState)[keyof typeof SessionFsmState];

/**
 * Trạng thái phiên đấu thời gian thực (Arena Session State)
 */
export interface ArenaSessionState {
  sessionId: string;
  documentId: string;
  config: LobbyConfig;
  fsmState: SessionFsmState;
  currentTurn: number;
  totalTurns: number;
  activeBossId: JuryBossId;
  candidateHp: number; // 0 - 100%
  prepRemainingSeconds: number;
  turnRemainingSeconds: number;
  isPaused: boolean;
  transcriptHistory: Array<{
    sender: 'CANDIDATE' | 'BOSS';
    bossId?: JuryBossId;
    text: string;
    timestamp: string;
    penaltyApplied?: number;
  }>;
}
