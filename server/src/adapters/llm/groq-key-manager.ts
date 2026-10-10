import { Logger } from '@nestjs/common';

/**
 * Quản lý xoay vòng (Round-Robin) và Fallback nhiều Groq API Keys
 * Giúp tránh rate limit (429 / RPM / TPM) bằng cách phân tải đều và tự động thử key tiếp theo khi có sự cố.
 */
export class GroqKeyManager {
  private static readonly logger = new Logger('GroqKeyManager');
  private static roundRobinCounter = 0;

  /**
   * Lấy danh sách tất cả các Groq API Keys hợp lệ từ biến môi trường
   */
  public static getAllKeys(): string[] {
    const candidateKeys = [
      process.env.GROQ_API_KEY,
      process.env.GROQ_API_KEY_2,
      process.env.GROQ_API_KEY_3,
      process.env.GROQ_API_KEY_4,
      process.env.GROQ_API_KEY_5,
    ];

    // Quét thêm nếu có các key GROQ_API_KEY_* khác trong process.env
    for (const [k, v] of Object.entries(process.env)) {
      if (k.startsWith('GROQ_API_KEY') && v && typeof v === 'string') {
        if (!candidateKeys.includes(v)) {
          candidateKeys.push(v);
        }
      }
    }

    const uniqueKeys: string[] = [];
    for (const key of candidateKeys) {
      if (key && key.trim() && !uniqueKeys.includes(key.trim())) {
        uniqueKeys.push(key.trim());
      }
    }

    return uniqueKeys;
  }

  /**
   * Trả về danh sách keys đã xoay vòng (Round-Robin)
   * Giúp phân bổ đều request giữa GROQ_API_KEY, GROQ_API_KEY_2, GROQ_API_KEY_3...
   */
  public static getRotatedKeys(): string[] {
    const keys = this.getAllKeys();
    if (keys.length === 0) return [];

    const startIndex = this.roundRobinCounter % keys.length;
    this.roundRobinCounter = (this.roundRobinCounter + 1) % keys.length;

    const rotated: string[] = [];
    for (let i = 0; i < keys.length; i++) {
      rotated.push(keys[(startIndex + i) % keys.length]);
    }
    return rotated;
  }

  /**
   * Ẩn bớt ký tự API Key khi ghi log để đảm bảo an toàn
   */
  public static maskKey(key: string): string {
    if (!key || key.length <= 10) return '***';
    return `${key.slice(0, 7)}...${key.slice(-4)}`;
  }
}
