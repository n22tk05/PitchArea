import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { DiffAlignmentService } from './diff-alignment.service';
import { ChunkClassifierService } from './chunk-classifier.service';
import { PitchGraphSession } from './pitch-graph-session';
import { PitchGraphService } from './pitch-graph.service';
import {
  PitchGraphNodeStatus,
  PitchNodeSource,
  PitchSectionType,
} from '@pitcharena/shared';

describe('Phase 5: Single-Pass Diff Alignment & Fallback', () => {
  const classifier = new ChunkClassifierService();
  const diffService = new DiffAlignmentService();

  describe('DiffAlignmentService In-Memory Alignment', () => {
    it('should split transcript into meaningful segments and normalize punctuation', () => {
      const fullTranscript =
        'Doanh thu dự kiến 2 tỷ đồng. Chúng tôi phân phối qua 50 đại lý toàn quốc! Tính năng AI mới tự động xử lý ảnh X-quang.';

      const segments = diffService.segmentTranscript(fullTranscript);
      assert.strictEqual(segments.length, 3);
      assert.strictEqual(segments[0], 'Doanh thu dự kiến 2 tỷ đồng');
      assert.strictEqual(segments[1], 'Chúng tôi phân phối qua 50 đại lý toàn quốc');
      assert.strictEqual(segments[2], 'Tính năng AI mới tự động xử lý ảnh X-quang');
    });

    it('should detect and recover dropped chunks from fullRawTranscript in <= 400ms (FR-03, NFR-02)', async () => {
      const session = new PitchGraphSession('test-diff-recovery');

      // Giả lập Chunk 1 đã được nhận qua WebSocket stream
      session.addNode({
        id: 'node-streamed-1',
        sessionId: session.sessionId,
        sectionType: PitchSectionType.PROBLEM_MARKET,
        category: 'FINANCIAL_METRIC',
        key: 'Doanh thu',
        value: 'Doanh thu năm đầu tiên dự kiến đạt 2 tỷ đồng',
        status: PitchGraphNodeStatus.ACTIVE,
        source: PitchNodeSource.PITCH_REFINED,
        confidence: 1.0,
        sequenceId: 1,
        timestamp: Date.now(),
      });

      assert.strictEqual(session.getActiveNodes().length, 1);

      // Khi nộp bài (finalize), fullRawTranscript có 3 câu:
      // - Câu 1: Đã nhận qua stream
      // - Câu 2: Bị rớt mạng (Mô hình giá 15 triệu/tháng)
      // - Câu 3: Bị rớt mạng (Mở rộng kênh hợp tác 30 bệnh viện)
      const fullRawTranscript =
        'Doanh thu năm đầu tiên dự kiến đạt 2 tỷ đồng. ' +
        'Gói đăng ký B2B Subscription có giá 15 triệu đồng mỗi tháng. ' +
        'Chúng tôi hợp tác chiến lược với 30 bệnh viện công lập và tư nhân.';

      const result = await diffService.align(session, fullRawTranscript, classifier);

      // Đánh giá hiệu năng và phục hồi
      assert.ok(
        result.alignmentTimeMs <= DiffAlignmentService.MAX_ALIGNMENT_BUDGET_MS,
        `Alignment time ${result.alignmentTimeMs}ms must be <= ${DiffAlignmentService.MAX_ALIGNMENT_BUDGET_MS}ms`
      );
      assert.strictEqual(result.missingSegmentsRecovered, 2);
      assert.ok(result.newRefinedNodes + result.newStagingItems >= 2);

      // Câu 1 không bị duplicate, các câu 2 và 3 đã được phục hồi vào graph/staging
      const allActiveValues = session.getActiveNodes().map((n) => n.value);
      const allStagedValues = session.stagingBuffer.map((s) => s.text);
      const combinedCorpus = [...allActiveValues, ...allStagedValues].join(' ');

      assert.ok(combinedCorpus.includes('15 triệu đồng'));
      assert.ok(combinedCorpus.includes('30 bệnh viện'));
    });

    it('should run zero-mutation diff alignment when all chunks were already streamed (no packet loss)', async () => {
      const session = new PitchGraphSession('test-diff-perfect');

      session.addNode({
        id: 'node-1',
        sessionId: session.sessionId,
        sectionType: PitchSectionType.PROBLEM_MARKET,
        category: 'OTHER',
        key: 'Thị trường',
        value: 'Thị trường MedTech đạt 1.2 tỷ USD',
        status: PitchGraphNodeStatus.ACTIVE,
        source: PitchNodeSource.PITCH_REFINED,
        confidence: 1.0,
        sequenceId: 1,
        timestamp: Date.now(),
      });

      const fullRawTranscript = 'Thị trường MedTech đạt 1.2 tỷ USD';

      const result = await diffService.align(session, fullRawTranscript, classifier);

      assert.strictEqual(result.missingSegmentsRecovered, 0);
      assert.strictEqual(result.newRefinedNodes, 0);
      assert.strictEqual(result.newStagingItems, 0);
      assert.strictEqual(session.getActiveNodes().length, 1);
      assert.ok(result.alignmentTimeMs <= 50, 'Clean diff should take < 50ms');
    });

    it('should filter conversational noise in missing chunks during diff alignment', async () => {
      const session = new PitchGraphSession('test-diff-noise');

      const fullRawTranscript =
        'Kính chào quý ban giám khảo và các thầy cô ạ. ' +
        'Dạ vâng em xin cảm ơn mọi người rất nhiều.';

      const result = await diffService.align(session, fullRawTranscript, classifier);

      assert.strictEqual(result.missingSegmentsRecovered, 0);
      assert.strictEqual(session.getActiveNodes().length, 0);
      assert.strictEqual(session.stagingBuffer.length, 0);
    });
  });

  describe('Integration with PitchGraphService.finalizePitchStream', () => {
    it('should auto-align dropped whitelist items and materialize them into Section 6 on finalize', async () => {
      const service = new PitchGraphService();
      const sessionId = 'session-finalize-diff-test';

      // Khởi tạo phiên
      service.getOrCreateSession(sessionId);

      // Thí sinh chỉ stream được câu mở đầu (các câu sau bị ngắt kết nối tạm thời)
      await service.processStreamPitchChunk({
        sessionId,
        sequenceId: 1,
        text: 'Thị trường MedTech đạt quy mô 1.2 tỷ USD',
        timestamp: Date.now(),
        isFinalChunk: false,
        detectedMarkers: [],
      });

      const syncBefore = service.getGraphSyncPayload(sessionId);
      assert.strictEqual(syncBefore.hasSection6, false);
      assert.strictEqual(syncBefore.section6EntitiesCount, 0);

      // Khi nhấn Hoàn thành bài pitch, client gửi fullRawTranscript chứa câu bị rớt mạng:
      // Câu rớt mạng: "Đồng thời mở rộng kênh phân phối hợp tác chiến lược với 50 chuỗi nhà thuốc toàn quốc" (thỏa CHANNEL_PARTNER whitelist)
      const fullRawTranscript =
        'Thị trường MedTech đạt quy mô 1.2 tỷ USD. ' +
        'Đồng thời mở rộng kênh phân phối hợp tác chiến lược với 50 chuỗi nhà thuốc toàn quốc.';

      const syncAfter = await service.finalizePitchStream({
        sessionId,
        totalChunks: 2,
        fullRawTranscript,
        durationSeconds: 60,
      });

      // Diff alignment phải bù đắp được câu bị mất vào staging buffer và Section 6 phải được khai sinh!
      assert.strictEqual(syncAfter.hasSection6, true);
      assert.ok(syncAfter.section6Title);
      assert.ok(syncAfter.section6EntitiesCount >= 1);
    });
  });
});
