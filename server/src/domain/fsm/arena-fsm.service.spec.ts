import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { Logger } from '@nestjs/common';
import {
  JuryBossId,
  SessionFsmState,
  BusinessSectionType,
  BusinessSectionLabel,
} from '@pitcharena/shared';
import { ArenaFsmService } from './arena-fsm.service';

describe('ArenaFsmService - Judge Question Basis Logging & Pedagogical Shield', () => {
  it('phải log đúng căn cứ đề mục khi chuyển trạng thái sang BOSS_QUESTIONING với Market Shark', () => {
    const service = new ArenaFsmService();
    const logs: string[] = [];
    const originalLog = Logger.prototype.log;
    Logger.prototype.log = function (message: any) {
      logs.push(String(message));
    };

    try {
      const session = service.getOrCreateSession('session-test-1', 'doc-1', [JuryBossId.MARKET_SHARK]);
      session.activeBossId = JuryBossId.MARKET_SHARK;
      session.currentTopic = 'Quy mô thị trường & Nỗi đau khách hàng';

      service.transitionState('session-test-1', SessionFsmState.BOSS_QUESTIONING);

      const allLogs = logs.join('\n');
      assert.ok(allLogs.includes('GIÁM KHẢO CHẤT VẤN - CĂN CỨ ĐỀ MỤC TÀI LIỆU'));
      assert.ok(allLogs.includes('Shark Trần Nam'));
      assert.ok(allLogs.includes('Vấn đề & Thị Trường'));
      assert.ok(allLogs.includes(`[${BusinessSectionType.PROBLEM_MARKET}] ${BusinessSectionLabel.PROBLEM_MARKET}`));
      assert.ok(allLogs.includes('Quy mô thị trường & Nỗi đau khách hàng'));
    } finally {
      Logger.prototype.log = originalLog;
    }
  });

  it('phải log đúng căn cứ cho Tech Sentinel, Finance Dragon và Risk Strategist', () => {
    const service = new ArenaFsmService();
    const logs: string[] = [];
    const originalLog = Logger.prototype.log;
    Logger.prototype.log = function (message: any) {
      logs.push(String(message));
    };

    try {
      const session = service.getOrCreateSession('session-test-2', 'doc-2');

      // 1. Tech Sentinel
      session.activeBossId = JuryBossId.TECH_SENTINEL;
      service.logJudgeQuestionBasis(session);
      let lastLog = logs[logs.length - 1];
      assert.ok(lastLog.includes('TS. Lê Minh Trang'));
      assert.ok(lastLog.includes(`[${BusinessSectionType.SOLUTION_PRODUCT}] ${BusinessSectionLabel.SOLUTION_PRODUCT}`));

      // 2. Finance Dragon
      session.activeBossId = JuryBossId.FINANCE_DRAGON;
      service.logJudgeQuestionBasis(session);
      lastLog = logs[logs.length - 1];
      assert.ok(lastLog.includes('GS. Vũ Hoàng'));
      assert.ok(lastLog.includes(`[${BusinessSectionType.BUSINESS_MODEL_UNIT_ECONOMICS}] ${BusinessSectionLabel.BUSINESS_MODEL_UNIT_ECONOMICS}`));

      // 3. Risk Strategist (phụ trách 2 đề mục Moat & Roadmap)
      session.activeBossId = JuryBossId.RISK_STRATEGIST;
      service.logJudgeQuestionBasis(session);
      lastLog = logs[logs.length - 1];
      assert.ok(lastLog.includes('ThS. Đặng Mai Lan'));
      assert.ok(lastLog.includes(`[${BusinessSectionType.COMPETITION_MOAT}] ${BusinessSectionLabel.COMPETITION_MOAT}`));
      assert.ok(lastLog.includes(`[${BusinessSectionType.SOCIAL_IMPACT_ROADMAP}] ${BusinessSectionLabel.SOCIAL_IMPACT_ROADMAP}`));
    } finally {
      Logger.prototype.log = originalLog;
    }
  });

  it('phải ưu tiên hiển thị tiêu đề đề mục thực tế trích xuất từ tài liệu Word và câu hỏi khi hoàn tất', () => {
    const service = new ArenaFsmService();
    const logs: string[] = [];
    const originalLog = Logger.prototype.log;
    Logger.prototype.log = function (message: any) {
      logs.push(String(message));
    };

    try {
      const session = service.getOrCreateSession('session-test-3', 'doc-3', [JuryBossId.FINANCE_DRAGON]);
      session.activeBossId = JuryBossId.FINANCE_DRAGON;

      service.setActiveQuestion(
        'session-test-3',
        'Chi phí tìm kiếm khách hàng CAC 3.2 triệu VNĐ được tính toán dựa trên kênh quảng cáo nào?',
        'Chỉ số CAC & LTV',
        ['[BUSINESS_MODEL_UNIT_ECONOMICS] Mục 3: Mô hình Kinh doanh & Unit Economics thực tế']
      );

      const lastLog = logs[logs.length - 1];
      assert.ok(lastLog.includes('Mục 3: Mô hình Kinh doanh & Unit Economics thực tế'));
      assert.ok(lastLog.includes('Chỉ số CAC & LTV'));
      assert.ok(lastLog.includes('Chi phí tìm kiếm khách hàng CAC 3.2 triệu VNĐ được tính toán dựa trên kênh quảng cáo nào?'));
    } finally {
      Logger.prototype.log = originalLog;
    }
  });

  it('phải giữ khiên sàn 20% trong 3 lượt đầu và phá khiên từ lượt 4 trở đi', () => {
    const service = new ArenaFsmService();
    const session = service.getOrCreateSession('session-test-shield', 'doc-shield');
    session.candidateHp = 30;

    // Lượt 1: Trừ 25 HP -> Có khiên tân thủ bảo vệ, không tụt dưới 20%
    session.currentTurn = 1;
    let newHp = service.deductHp('session-test-shield', 25);
    assert.strictEqual(newHp, 20, 'Lượt 1 phải giữ sàn 20%');
    assert.strictEqual(session.candidateHp, 20);

    // Lượt 2: Trừ thêm 10 HP -> Vẫn ở lượt 2, sàn 20% tiếp tục giữ vững
    session.currentTurn = 2;
    newHp = service.deductHp('session-test-shield', 10);
    assert.strictEqual(newHp, 20, 'Lượt 2 phải giữ sàn 20%');

    // Lượt 3: Trừ thêm 5 HP -> Vẫn ở lượt 3, sàn 20% giữ vững
    session.currentTurn = 3;
    newHp = service.deductHp('session-test-shield', 5);
    assert.strictEqual(newHp, 20, 'Lượt 3 phải giữ sàn 20%');

    // Lượt 4: Khiên tân thủ hết hiệu lực (ĐÃ VỠ) -> Trừ 12 HP, máu phải tụt xuống 8% (kích hoạt Redemption Zone)
    session.currentTurn = 4;
    newHp = service.deductHp('session-test-shield', 12);
    assert.strictEqual(newHp, 8, 'Lượt 4 khiên đã vỡ, máu phải tụt xuống dưới 20% (8%)');
    assert.strictEqual(session.candidateHp, 8);

    // Lượt 5: Trừ thêm 10 HP -> Máu chạm đáy 0% (Knockout)
    session.currentTurn = 5;
    newHp = service.deductHp('session-test-shield', 10);
    assert.strictEqual(newHp, 0, 'Lượt 5 cạn máu về 0%');
    assert.strictEqual(session.candidateHp, 0);
  });
});
