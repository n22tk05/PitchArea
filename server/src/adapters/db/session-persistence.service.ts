import { Injectable, Logger } from '@nestjs/common';
import { AppendixReport, ArenaSessionState } from '@pitcharena/shared';

@Injectable()
export class SessionPersistenceService {
  private readonly logger = new Logger(SessionPersistenceService.name);

  // In-memory store cho phiên đấu trường và báo cáo tổng kết
  private readonly sessionHistory = new Map<string, ArenaSessionState>();
  private readonly reports = new Map<string, AppendixReport>();

  /**
   * Lưu trữ phiên đấu trường khi hoàn tất
   */
  public saveSession(session: ArenaSessionState) {
    this.sessionHistory.set(session.sessionId, JSON.parse(JSON.stringify(session)));
    this.logger.log(
      `[SessionPersistence] Đã lưu trữ phiên đấu [${session.sessionId}]. Tổng số phiên đã lưu: ${this.sessionHistory.size}`
    );
  }

  /**
   * Lưu trữ Báo cáo Phụ lục Hành động
   */
  public saveReport(sessionId: string, report: AppendixReport) {
    this.reports.set(sessionId, report);
    this.logger.log(`[SessionPersistence] Đã lưu trữ Báo cáo Phụ lục cho Session [${sessionId}]`);
  }

  /**
   * Lấy Báo cáo theo sessionId
   */
  public getReport(sessionId: string): AppendixReport | undefined {
    return this.reports.get(sessionId);
  }

  /**
   * Lấy Phiên đấu theo sessionId
   */
  public getSession(sessionId: string): ArenaSessionState | undefined {
    return this.sessionHistory.get(sessionId);
  }

  /**
   * Lấy toàn bộ danh sách báo cáo
   */
  public getAllReports(): AppendixReport[] {
    return Array.from(this.reports.values());
  }
}
