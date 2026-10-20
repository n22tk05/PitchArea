import { z } from 'zod';

/**
 * =========================================================================
 * PHASE 1 (SPRINT 2): REAL-TIME STREAMING PITCH GRAPHRAG CONTRACTS & SCHEMAS
 * =========================================================================
 */

/**
 * Danh sách Marker bẻ lái / đính chính phân loại theo 3 mức độ (FR-02)
 */
export const RetractionMarkerType = {
  OVERWRITE_DIRECT: 'OVERWRITE_DIRECT', // "À không", "Nhầm", "Chính xác là", "Đính chính lại"
  CANCELLATION: 'CANCELLATION',         // "Thôi bỏ đi", "Bỏ qua phần này", "Chưa tính tới"
  ELABORATION: 'ELABORATION',           // "Ý tôi là", "Nói cách khác", "Để nói rõ hơn"
} as const;

export type RetractionMarkerType =
  (typeof RetractionMarkerType)[keyof typeof RetractionMarkerType];

export const RetractionMarkerTypeSchema = z.nativeEnum(RetractionMarkerType);

/**
 * C2S: Stream Chunk lời nói của thí sinh theo nhịp thở (FR-01)
 */
export const StreamPitchChunkSchema = z.object({
  sessionId: z.string().min(1),
  sequenceId: z.number().int().nonnegative(),
  timestamp: z.number(),
  text: z.string().min(1),
  isFinalChunk: z.boolean().default(false),
  detectedMarkers: z.array(RetractionMarkerTypeSchema).default([]),
});

export type StreamPitchChunkDto = z.infer<typeof StreamPitchChunkSchema>;

/**
 * C2S: Khóa bài thuyết trình và kích hoạt Single-Pass Diff Alignment (FR-03 & FR-05)
 */
export const FinalizePitchStreamSchema = z.object({
  sessionId: z.string().min(1),
  totalChunks: z.number().int().nonnegative(),
  fullRawTranscript: z.string(),
  durationSeconds: z.number().nonnegative(),
});

export type FinalizePitchStreamDto = z.infer<typeof FinalizePitchStreamSchema>;

/**
 * Trạng thái của Node trên đồ thị tri thức In-Memory (AD-1)
 */
export const PitchGraphNodeStatus = {
  ACTIVE: 'ACTIVE',         // Đang có hiệu lực, Boss AI được phép query
  SUPERSEDED: 'SUPERSEDED', // Đã bị đè bởi phát ngôn sửa sai tiếp theo
  RETRACTED: 'RETRACTED',   // Thí sinh chủ động hủy bỏ ý tưởng
} as const;

export type PitchGraphNodeStatus =
  (typeof PitchGraphNodeStatus)[keyof typeof PitchGraphNodeStatus];

export const PitchGraphNodeStatusSchema = z.nativeEnum(PitchGraphNodeStatus);

/**
 * Nguồn gốc thực thể trên đồ thị
 */
export const PitchNodeSource = {
  WORD_BASELINE: 'WORD_BASELINE',   // Trích xuất từ file Word gốc
  PITCH_REFINED: 'PITCH_REFINED',   // Thí sinh nói bổ sung đè lên 5 section cũ
  PITCH_EXPANDED: 'PITCH_EXPANDED', // Ý tưởng mở rộng mới tinh (Khối 6)
} as const;

export type PitchNodeSource =
  (typeof PitchNodeSource)[keyof typeof PitchNodeSource];

export const PitchNodeSourceSchema = z.nativeEnum(PitchNodeSource);

/**
 * Phân loại đề mục đồ thị (5 Section cốt lõi + Khối 6 Phát sinh)
 */
export const PitchSectionType = {
  PROBLEM_MARKET: 'PROBLEM_MARKET',
  SOLUTION_PRODUCT: 'SOLUTION_PRODUCT',
  BUSINESS_MODEL_UNIT_ECONOMICS: 'BUSINESS_MODEL_UNIT_ECONOMICS',
  COMPETITION_MOAT: 'COMPETITION_MOAT',
  SOCIAL_IMPACT_ROADMAP: 'SOCIAL_IMPACT_ROADMAP',
  DYNAMIC_EXPANDED_SCOPE: 'DYNAMIC_EXPANDED_SCOPE', // Khối 6
} as const;

export type PitchSectionType =
  (typeof PitchSectionType)[keyof typeof PitchSectionType];

export const PitchSectionTypeSchema = z.nativeEnum(PitchSectionType);

/**
 * Phân loại danh mục Business Whitelist cho Khối 6 và Refined Layer (FR-04)
 */
export const BusinessWhitelistCategory = {
  MARKET_EXPANSION: 'MARKET_EXPANSION',   // Thị trường/Địa bàn/Quốc gia mới
  NEW_FEATURE: 'NEW_FEATURE',             // Tính năng/Công nghệ mới
  CHANNEL_PARTNER: 'CHANNEL_PARTNER',     // Kênh bán/Đối tác chiến lược
  FINANCIAL_METRIC: 'FINANCIAL_METRIC',   // Số liệu doanh thu, định giá, hòa vốn
  TIMELINE_ROADMAP: 'TIMELINE_ROADMAP',   // Mốc thời gian ra mắt, lộ trình
} as const;

export type BusinessWhitelistCategory =
  (typeof BusinessWhitelistCategory)[keyof typeof BusinessWhitelistCategory];

export const BusinessWhitelistCategorySchema = z.nativeEnum(BusinessWhitelistCategory);

/**
 * Cấu trúc một Node trong đồ thị In-Memory GraphRAG (AD-1)
 */
export const PitchGraphNodeSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().min(1),
  sectionType: PitchSectionTypeSchema,
  category: BusinessWhitelistCategorySchema.or(z.literal('OTHER')),
  key: z.string().min(1),
  value: z.string().min(1),
  status: PitchGraphNodeStatusSchema,
  source: PitchNodeSourceSchema,
  confidence: z.number().min(0).max(1).default(1.0),
  sequenceId: z.number().int().nonnegative(),
  timestamp: z.number(),
  supersededById: z.string().uuid().optional(),
  originalSentence: z.string().optional(),
});

export type PitchGraphNode = z.infer<typeof PitchGraphNodeSchema>;

/**
 * Cạnh quan hệ đồ thị giữa các thực thể (Adjacency Edge)
 */
export const PitchGraphEdgeType = {
  REPLACES: 'REPLACES',     // Node mới đè lên Node cũ (Tombstone)
  CLARIFIES: 'CLARIFIES',   // Node mới làm rõ cho Node cũ
  EXTENDS: 'EXTENDS',       // Node mới mở rộng phạm vi của Node cũ
  CONTRADICTS: 'CONTRADICTS'// Node mới mâu thuẫn trực tiếp với bản Word
} as const;

export type PitchGraphEdgeType =
  (typeof PitchGraphEdgeType)[keyof typeof PitchGraphEdgeType];

export const PitchGraphEdgeTypeSchema = z.nativeEnum(PitchGraphEdgeType);

export const PitchGraphEdgeSchema = z.object({
  sourceNodeId: z.string().uuid(),
  targetNodeId: z.string().uuid(),
  edgeType: PitchGraphEdgeTypeSchema,
  timestamp: z.number(),
});

export type PitchGraphEdge = z.infer<typeof PitchGraphEdgeSchema>;

/**
 * S2C: Đồng bộ trạng thái đồ thị và Khối thứ 6 về Client (FR-05 & UX-DR3)
 */
export const PitchGraphSyncSchema = z.object({
  sessionId: z.string().min(1),
  activeNodesCount: z.number().int().nonnegative(),
  refinedNodesCount: z.number().int().nonnegative(),
  hasSection6: z.boolean(),
  section6Title: z.string().optional(),
  section6EntitiesCount: z.number().int().nonnegative().default(0),
  isPivotDetected: z.boolean().default(false), // Cờ FLAG_MAJOR_PROPOSAL_PIVOT (> 80% lệch Word)
  timestamp: z.number(),
});

export type PitchGraphSyncDto = z.infer<typeof PitchGraphSyncSchema>;

// Aliases duy trì tính nhất quán với quy ước C2S*Payload và S2C*Payload trong monorepo
export type C2SStreamPitchChunkPayload = StreamPitchChunkDto;
export type C2SFinalizePitchStreamPayload = FinalizePitchStreamDto;
export type S2CPitchGraphSyncPayload = PitchGraphSyncDto;

