import { z } from 'zod';

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
