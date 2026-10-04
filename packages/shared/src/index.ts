import { z } from 'zod';

/**
 * =========================================================================
 * PHASE 1: DOCUMENT ANALYSIS & IN-MEMORY RAG SCHEMAS
 * =========================================================================
 */

/**
 * 5 Khối Đề mục Chuyên môn (Section-Aware Chunking)
 */
export const BusinessSectionType = {
  PROBLEM_MARKET: 'PROBLEM_MARKET',
  SOLUTION_PRODUCT: 'SOLUTION_PRODUCT',
  BUSINESS_MODEL_UNIT_ECONOMICS: 'BUSINESS_MODEL_UNIT_ECONOMICS',
  COMPETITION_MOAT: 'COMPETITION_MOAT',
  SOCIAL_IMPACT_ROADMAP: 'SOCIAL_IMPACT_ROADMAP',
} as const;

export type BusinessSectionType =
  (typeof BusinessSectionType)[keyof typeof BusinessSectionType];

export const BusinessSectionLabel: Record<BusinessSectionType, string> = {
  PROBLEM_MARKET: 'Vấn đề & Quy mô Thị trường',
  SOLUTION_PRODUCT: 'Giải pháp & Sản phẩm cốt lõi',
  BUSINESS_MODEL_UNIT_ECONOMICS: 'Mô hình Kinh doanh & Unit Economics',
  COMPETITION_MOAT: 'Đối thủ & Lợi thế Cạnh tranh (Moat)',
  SOCIAL_IMPACT_ROADMAP: 'Tác động Xã hội & Lộ trình Phát triển',
};

/**
 * Cấu trúc một phân đoạn nội dung
 */
export interface DocumentSection {
  id: string;
  type: BusinessSectionType;
  title: string;
  content: string;
  charCount: number;
  wordCount: number;
}

/**
 * Phần tử trong mảng Whitelist Số liệu / Thực thể
 */
export interface EntityWhitelistItem {
  id: string;
  rawText: string;
  category: 'PERCENTAGE' | 'CURRENCY' | 'METRIC' | 'DATE_TIMELINE' | 'ENTITY_NAME';
  value: string;
  contextSentence: string;
  sectionType: BusinessSectionType;
}

/**
 * Điểm mù rủi ro (Blind Spot) nhận diện theo Preset 1
 */
export interface BlindSpot {
  id: string;
  domain: BusinessSectionType;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  attackVector: string; // Hướng chất vấn dự kiến của Hội đồng giám khảo
}

/**
 * Kết quả phân tích toàn diện file Word .docx
 */
export interface DocumentAnalysisResult {
  documentId: string;
  filename: string;
  fileSizeBytes: number;
  markdownContent: string;
  sections: DocumentSection[];
  entityWhitelist: EntityWhitelistItem[];
  blindSpots: BlindSpot[];
  processedAt: string;
}

/**
 * Zod Schema cho API Upload Document Response
 */
export const UploadDocumentResponseSchema = z.object({
  success: z.boolean(),
  data: z.custom<DocumentAnalysisResult>(),
  message: z.string().optional(),
});

export type UploadDocumentResponse = z.infer<typeof UploadDocumentResponseSchema>;

/**
 * =========================================================================
 * PHASE 2: ARENA LOBBY, REALTIME VOICE & SESSION CONTRACTS
 * =========================================================================
 */

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
 * 3 Presets Thẩm Định Tiêu Biểu
 */
export const EvaluationPreset = {
  SV_STARTUP: 'SV_STARTUP',
  SEED_ANGEL: 'SEED_ANGEL',
  TECH_PATENT: 'TECH_PATENT',
} as const;

export type EvaluationPreset =
  (typeof EvaluationPreset)[keyof typeof EvaluationPreset];

export const EvaluationPresetDetails: Record<
  EvaluationPreset,
  {
    id: EvaluationPreset;
    name: string;
    sub: string;
    focus: string;
    targetBoss: JuryBossId;
  }
> = {
  [EvaluationPreset.SV_STARTUP]: {
    id: EvaluationPreset.SV_STARTUP,
    name: 'SV-Startup & Euréka',
    sub: 'Bộ GD&ĐT / Thành Đoàn',
    focus: 'Tính cấp thiết, đổi mới sáng tạo, tính khả thi & giải quyết nỗi đau thực tiễn.',
    targetBoss: JuryBossId.MARKET_SHARK,
  },
  [EvaluationPreset.SEED_ANGEL]: {
    id: EvaluationPreset.SEED_ANGEL,
    name: 'Seed / Angel Pitch',
    sub: 'Quỹ Thiên Thần / Vòng Hạt Giống',
    focus: 'Unit Economics, chỉ số CAC/LTV, lộ trình hoàn vốn & rào cản phòng thủ (Moat).',
    targetBoss: JuryBossId.FINANCE_DRAGON,
  },
  [EvaluationPreset.TECH_PATENT]: {
    id: EvaluationPreset.TECH_PATENT,
    name: 'Tech & IP Patent',
    sub: 'Sở Hữu Trí Tuệ & Công Nghệ Lõi',
    focus: 'Độ sâu thuật toán, kiến trúc kỹ thuật, độ trễ và độc quyền dữ liệu nghiên cứu.',
    targetBoss: JuryBossId.TECH_SENTINEL,
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
  pitchDurationMinutes: z.number().min(1).max(5).default(2).optional(),
  qaDurationMinutes: z.number().min(1).max(5).default(3).optional(),
  evaluationPreset: z
    .enum([
      EvaluationPreset.SV_STARTUP,
      EvaluationPreset.SEED_ANGEL,
      EvaluationPreset.TECH_PATENT,
    ])
    .default(EvaluationPreset.SV_STARTUP)
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

/**
 * =========================================================================
 * PHASE 2: WEBSOCKET EVENT CONSTANTS & PAYLOAD SCHEMAS
 * =========================================================================
 */

/**
 * Danh sách Tên sự kiện WebSocket chuẩn hóa hai đầu C2S & S2C
 */
export const ArenaSocketEvents = {
  // Client to Server (C2S)
  C2S_JOIN_LOBBY: 'c2s:join_lobby',
  C2S_UPDATE_CONFIG: 'c2s:update_config',
  C2S_START_COMBAT: 'c2s:start_combat',
  C2S_SKIP_PREP: 'c2s:skip_prep',
  C2S_TOGGLE_PAUSE: 'c2s:toggle_pause',
  C2S_AUDIO_STREAM_DATA: 'c2s:audio_stream_data',
  C2S_SUBMIT_TRANSCRIPT: 'c2s:submit_transcript',

  // Server to Client (S2C)
  S2C_SESSION_SYNC: 's2c:session_sync',
  S2C_TIMER_TICK: 's2c:timer_tick',
  S2C_LIVE_TRANSCRIPT: 's2c:live_transcript',
  S2C_VAD_ALERT: 's2c:vad_alert',
  S2C_BOSS_STATEMENT: 's2c:boss_statement',
  S2C_COMBAT_RESULT: 's2c:combat_result',
  S2C_ERROR: 's2c:error',
} as const;

export type ArenaSocketEvents =
  (typeof ArenaSocketEvents)[keyof typeof ArenaSocketEvents];

/**
 * Zod Schemas cho các gói tin C2S
 */
export const C2SJoinLobbyPayloadSchema = z.object({
  sessionId: z.string(),
  documentId: z.string(),
});
export type C2SJoinLobbyPayload = z.infer<typeof C2SJoinLobbyPayloadSchema>;

export const C2SUpdateConfigPayloadSchema = z.object({
  sessionId: z.string(),
  config: LobbyConfigSchema,
});
export type C2SUpdateConfigPayload = z.infer<typeof C2SUpdateConfigPayloadSchema>;

export const C2SSubmitTranscriptPayloadSchema = z.object({
  sessionId: z.string(),
  text: z.string(),
  isFinal: z.boolean().default(false),
  estimatedWpm: z.number().optional(),
});
export type C2SSubmitTranscriptPayload = z.infer<
  typeof C2SSubmitTranscriptPayloadSchema
>;

export const C2SSessionActionPayloadSchema = z.object({
  sessionId: z.string(),
});
export type C2SSessionActionPayload = z.infer<
  typeof C2SSessionActionPayloadSchema
>;

/**
 * Payloads cho các gói tin S2C
 */
export interface S2CTimerTickPayload {
  fsmState: SessionFsmState;
  prepRemainingSeconds: number;
  turnRemainingSeconds: number;
  isPaused: boolean;
}

export interface S2CLiveTranscriptPayload {
  sender: 'CANDIDATE' | 'BOSS';
  text: string;
  isFinal: boolean;
  timestamp: string;
}

export interface S2CVadAlertPayload {
  silenceSeconds: number;
  thresholdSeconds: number;
  warningText: string;
}
