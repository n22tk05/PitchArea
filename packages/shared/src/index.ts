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
  isDetected?: boolean;
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
 * PHASE 2 & 3: ARENA SESSION, FSM, CONTRACTS & WEBSOCKET EVENTS
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
 * Ánh xạ giữa Giám khảo và các Khối đề mục chuyên môn phụ trách
 */
export const BOSS_TO_SECTION_MAP: Record<JuryBossId, BusinessSectionType[]> = {
  [JuryBossId.FINANCE_DRAGON]: [BusinessSectionType.BUSINESS_MODEL_UNIT_ECONOMICS],
  [JuryBossId.TECH_SENTINEL]: [BusinessSectionType.SOLUTION_PRODUCT],
  [JuryBossId.MARKET_SHARK]: [
    BusinessSectionType.PROBLEM_MARKET,
    BusinessSectionType.COMPETITION_MOAT,
    BusinessSectionType.SOCIAL_IMPACT_ROADMAP,
  ],
};

/**
 * Hàm kiểm tra các Giám khảo khả dụng dựa trên danh sách các khối đề mục có trong tài liệu
 */
export function getAvailableBossesForSections(sections?: DocumentSection[]): JuryBossId[] {
  if (!sections || sections.length === 0) {
    return Object.values(JuryBossId);
  }

  // Khối được coi là tồn tại nếu isDetected = true hoặc charCount > 20 và không phải chuỗi placeholder
  const existingSectionTypes = new Set(
    sections
      .filter((s) => {
        if (s.isDetected !== undefined) return s.isDetected;
        return (
          s.charCount > 20 &&
          !s.content.includes('Chưa phát hiện nội dung rõ ràng cho mục')
        );
      })
      .map((s) => s.type)
  );

  const matched = Object.values(JuryBossId).filter((bossId) => {
    const requiredSections = BOSS_TO_SECTION_MAP[bossId];
    return requiredSections.some((secType) => existingSectionTypes.has(secType));
  });

  return matched.length > 0 ? matched : [JuryBossId.FINANCE_DRAGON];
}

/**
 * 3 Bộ tiêu chuẩn thẩm định dự án (Evaluation Presets)
 */
export const EvaluationPreset = {
  SV_STARTUP: 'SV_STARTUP',   // SV-Startup & Euréka
  SEED_ANGEL: 'SEED_ANGEL',   // Seed / Angel Pitch
  TECH_PATENT: 'TECH_PATENT', // Tech & IP Patent
} as const;

export type EvaluationPreset =
  (typeof EvaluationPreset)[keyof typeof EvaluationPreset];

export const EvaluationPresetDetails: Record<
  EvaluationPreset,
  { name: string; label: string; desc: string; focus: string; targetBoss: JuryBossId; badgeColor: string }
> = {
  [EvaluationPreset.SV_STARTUP]: {
    name: 'SV-Startup & Euréka',
    label: 'SV-Startup & Euréka',
    desc: 'Bộ GD&ĐT / Thành Đoàn (Cấp thiết, Đổi mới, Khả thi)',
    focus: 'Tính cấp thiết, tính đổi mới sáng tạo và mức độ khả thi thực tế',
    targetBoss: JuryBossId.FINANCE_DRAGON,
    badgeColor: 'bg-neutral-100 text-black',
  },
  [EvaluationPreset.SEED_ANGEL]: {
    name: 'Seed / Angel Pitch',
    label: 'Seed / Angel Pitch',
    desc: 'Quỹ Thiên Thần / Hạt Giống (Unit Economics, CAC/LTV, Moat)',
    focus: 'Unit Economics, CAC, LTV, Biên lợi nhuận và Rào cản phòng thủ (Moat)',
    targetBoss: JuryBossId.MARKET_SHARK,
    badgeColor: 'bg-amber-100 text-amber-900',
  },
  [EvaluationPreset.TECH_PATENT]: {
    name: 'Tech & IP Patent',
    label: 'Tech & IP Patent',
    desc: 'Sở Hữu Trí Tuệ & Công Nghệ Lõi (Độ sâu thuật toán, Dữ liệu)',
    focus: 'Kiến trúc kỹ thuật, độ sâu thuật toán, an toàn dữ liệu và bằng sáng chế',
    targetBoss: JuryBossId.TECH_SENTINEL,
    badgeColor: 'bg-blue-100 text-blue-900',
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
  evaluationPreset: z
    .enum([
      EvaluationPreset.SV_STARTUP,
      EvaluationPreset.SEED_ANGEL,
      EvaluationPreset.TECH_PATENT,
    ])
    .optional(),
  pitchDurationMinutes: z.number().int().min(1).max(10).default(2).optional(),
  qaDurationMinutes: z.number().int().min(1).max(10).default(3).optional(),
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
  BOSS_QUESTIONING: 'BOSS_QUESTIONING',// Giám khảo đang chất vấn (stream câu hỏi)
  COMBAT_ACTIVE: 'COMBAT_ACTIVE',     // Sinh viên đối chất 30s
  TACTICAL_PAUSE: 'TACTICAL_PAUSE',   // Tạm dừng chiến thuật
  TIME_FREEZE: 'TIME_FREEZE',         // Đóng băng thời gian
  COACHING_PIVOT: 'COACHING_PIVOT',   // Giám khảo chuyển hướng gợi mở ở Strike 2
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
  availableBossIds?: JuryBossId[];
  candidateHp: number; // 0 - 100%
  prepRemainingSeconds: number;
  turnRemainingSeconds: number;
  isPaused: boolean;
  isTimeFrozen?: boolean;
  activeQuestion?: string;
  isStreamingQuestion?: boolean;
  followUpCount?: number;
  currentTopic?: string;
  isCoachingPivot?: boolean;
  lastVerdict?: VerdictResult;
  streak?: {
    count: number;
    type: 'WIN' | 'LOSE' | 'NEUTRAL';
  };
  transcriptHistory: Array<{
    sender: 'CANDIDATE' | 'BOSS' | 'PROSECUTOR' | 'DEFENDER' | 'ARBITER';
    bossId?: JuryBossId;
    agentName?: string;
    text: string;
    timestamp: string;
    penaltyApplied?: number;
    isCoachingPivot?: boolean;
    score?: number;
  }>;
}

/**
 * Đánh giá chi tiết của Hội đồng MAD Chamber
 */
export interface VerdictScore {
  directness: number;          // D: 0 - 100 (Đúng trọng tâm câu hỏi)
  factualBacking: number;      // F: 0 - 100 (Có căn cứ tài liệu / số liệu thực tế)
  intellectualHonesty: number; // H: 0 - 100 (Thẳng thắn, không ngụy biện)
  overallScore: number;        // Q: Điểm tổng hợp 0 - 100
}

/**
 * Phán quyết cuối cùng của Hội đồng trọng tài (Arbiter)
 */
export interface VerdictResult {
  turnIndex: number;
  bossId: JuryBossId;
  topic: string;
  score: VerdictScore;
  hpDelta: number;             // Máu thay đổi (+ hồi, - trừ)
  isHeal: boolean;
  reason: string;              // Tóm tắt lý do phán quyết
  attitudeMultiplier: number;  // 0.3x (cầu thị) -> 1.5x (cãi cùn)
  streakCount: number;         // Chuỗi thắng/thua hiện tại
  isShieldProtected: boolean;  // Có được sàn tân thủ 20% bảo vệ không
  isRedemptionQuestion?: boolean; // Kích hoạt khi máu <= 10%
  prosecutorArgument?: string; // Góc nhìn công tố viên (bắt bẻ)
  defenderArgument?: string;   // Góc nhìn bào chữa (suy đoán vô tội)
}

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
  C2S_REQUEST_NEXT_QUESTION: 'c2s:request_next_question',
  C2S_SUBMIT_DEFENSE: 'c2s:submit_defense',

  // Server to Client (S2C)
  S2C_SESSION_SYNC: 's2c:session_sync',
  S2C_TIMER_TICK: 's2c:timer_tick',
  S2C_LIVE_TRANSCRIPT: 's2c:live_transcript',
  S2C_VAD_ALERT: 's2c:vad_alert',
  S2C_BOSS_STATEMENT: 's2c:boss_statement',
  S2C_BOSS_STREAM_CHUNK: 's2c:boss_stream_chunk',
  S2C_TIME_FREEZE: 's2c:time_freeze',
  S2C_COACHING_ALERT: 's2c:coaching_alert',
  S2C_VERDICT_ANNOUNCED: 's2c:verdict_announced',
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

export const C2SSubmitDefensePayloadSchema = z.object({
  sessionId: z.string(),
  defenseText: z.string(),
});
export type C2SSubmitDefensePayload = z.infer<
  typeof C2SSubmitDefensePayloadSchema
>;

export const C2SRequestNextQuestionPayloadSchema = z.object({
  sessionId: z.string(),
});
export type C2SRequestNextQuestionPayload = z.infer<
  typeof C2SRequestNextQuestionPayloadSchema
>;

/**
 * Payloads cho các gói tin S2C
 */
export interface S2CTimerTickPayload {
  fsmState: SessionFsmState;
  prepRemainingSeconds: number;
  turnRemainingSeconds: number;
  isPaused: boolean;
  isTimeFrozen?: boolean;
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

export interface S2CBossStreamChunkPayload {
  bossId: string;
  chunk: string;
  accumulatedText: string;
  isComplete: boolean;
  isCoachingPivot?: boolean;
  topic?: string;
}

export interface S2CTimeFreezePayload {
  isFrozen: boolean;
  reason: 'BOSS_STREAMING' | 'CANDIDATE_SUBMIT' | 'TACTICAL_PAUSE' | 'RESUMED';
}

export interface S2CCoachingAlertPayload {
  bossId: string;
  strikeCount: number;
  message: string;
  topic: string;
}

export interface S2CVerdictAnnouncedPayload {
  verdict: VerdictResult;
  candidateHp: number;
}

