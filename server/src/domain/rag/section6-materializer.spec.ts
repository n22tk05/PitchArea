import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { ChunkClassifierService } from './chunk-classifier.service';
import { Section6BuilderService } from './section6-builder.service';
import { PitchGraphSession } from './pitch-graph-session';
import { PitchGraphService } from './pitch-graph.service';
import {
  BusinessWhitelistCategory,
  PitchGraphNode,
  PitchGraphNodeStatus,
  PitchNodeSource,
  PitchSectionType,
} from '@pitcharena/shared';

describe('Phase 4: Section 6 Materializer & Business Whitelist Gate', () => {
  describe('ChunkClassifierService', () => {
    const classifier = new ChunkClassifierService();

    it('should identify and discard conversational noise, greetings, and fillers', () => {
      const noisyChunks = [
        'Kính chào quý thầy cô và ban giám khảo',
        'Em xin chào các vị giám khảo ạ',
        'Dạ vâng thì là mà em xin phép bắt đầu',
        'Ừm ờ em hơi run một chút ạ',
        'Cảm ơn ban giám khảo đã lắng nghe',
        'Alo test mic 1 2 3',
        'nghe rõ không',
      ];

      for (const text of noisyChunks) {
        assert.strictEqual(
          classifier.isConversationalNoise(text),
          true,
          `Should detect noise for: "${text}"`
        );
        const result = classifier.classifyChunk(text, []);
        assert.strictEqual(result.isNoise, true);
        assert.strictEqual(result.routing, 'DISCARDED');
      }
    });

    it('should preserve polite Vietnamese statements with business content (e.g. Dạ..., Em xin phép...)', () => {
      const politeBusinessChunks = [
        'Dạ doanh thu năm đầu đạt 5 tỷ đồng với biên lợi nhuận 30%',
        'Em xin phép trình bày về tính năng công nghệ AI đột phá mới của sản phẩm',
        'Sau đây chúng em xin bổ sung kênh phân phối 50 bệnh viện',
        'Dạ vâng mô hình kinh doanh B2B định kỳ với thị trường 1.2 tỷ USD',
      ];

      for (const text of politeBusinessChunks) {
        assert.strictEqual(
          classifier.isConversationalNoise(text),
          false,
          `Should NOT discard polite business statement: "${text}"`
        );
        const result = classifier.classifyChunk(text, []);
        assert.strictEqual(result.isNoise, false);
        assert.notStrictEqual(result.routing, 'DISCARDED');
      }
    });

    it('should classify business whitelist categories accurately', () => {
      const testCases: Array<{ text: string; expectedCategory: BusinessWhitelistCategory }> = [
        {
          text: 'Doanh thu năm đầu đạt 5 tỷ đồng với biên lợi nhuận 30%',
          expectedCategory: BusinessWhitelistCategory.FINANCIAL_METRIC,
        },
        {
          text: 'Chúng tôi mở rộng thị trường sang khu vực Đông Nam Á và thị phần nông thôn',
          expectedCategory: BusinessWhitelistCategory.MARKET_EXPANSION,
        },
        {
          text: 'Tính năng công nghệ AI module tự động hóa toàn bộ quy trình',
          expectedCategory: BusinessWhitelistCategory.NEW_FEATURE,
        },
        {
          text: 'Hợp tác với 100 nhà thuốc và bệnh viện làm kênh phân phối chính',
          expectedCategory: BusinessWhitelistCategory.CHANNEL_PARTNER,
        },
        {
          text: 'Lộ trình ra mắt phiên bản chính thức vào quý 3 năm 2027',
          expectedCategory: BusinessWhitelistCategory.TIMELINE_ROADMAP,
        },
      ];

      for (const { text, expectedCategory } of testCases) {
        const cat = classifier.classifyWhitelistCategory(text);
        assert.strictEqual(cat, expectedCategory);
      }
    });

    it('should route matching content (>= 65%) to REFINED and unmapped whitelist content (< 65%) to STAGING', () => {
      const baselineNodes: PitchGraphNode[] = [
        {
          id: 'b1',
          sessionId: 'test',
          sectionType: PitchSectionType.PROBLEM_MARKET,
          category: 'OTHER',
          key: 'Vấn đề thị trường y tế',
          value: 'Thị trường MedTech tại Việt Nam gặp khó khăn về thiết bị và chi phí tiếp cận cao cho bệnh nhân',
          status: PitchGraphNodeStatus.ACTIVE,
          source: PitchNodeSource.WORD_BASELINE,
          confidence: 1.0,
          sequenceId: 0,
          timestamp: Date.now(),
        },
      ];

      // 1. Câu nói bám sát Word baseline -> REFINED
      const refinedChunk =
        'Vấn đề thị trường y tế và chi phí tiếp cận cho bệnh nhân tại Việt Nam';
      const refinedResult = classifier.classifyChunk(refinedChunk, baselineNodes);
      assert.strictEqual(refinedResult.routing, 'REFINED');
      assert.strictEqual(refinedResult.sectionType, PitchSectionType.PROBLEM_MARKET);

      // 2. Ý tưởng mới tinh không có trong Word nhưng thuộc Whitelist -> STAGING
      const unmappedWhitelistChunk =
        'Chúng tôi bổ sung kênh phân phối qua chuỗi 50 đại lý bán lẻ toàn quốc';
      const stagingResult = classifier.classifyChunk(
        unmappedWhitelistChunk,
        baselineNodes
      );
      assert.strictEqual(stagingResult.routing, 'STAGING');
      assert.strictEqual(
        stagingResult.category,
        BusinessWhitelistCategory.CHANNEL_PARTNER
      );

      // 3. Câu nói phi kinh doanh không có trong Word -> DISCARDED
      const randomChatter = 'Hôm nay thời tiết đẹp quá chúng em đi xe buýt đến đây';
      const discardedResult = classifier.classifyChunk(randomChatter, baselineNodes);
      assert.strictEqual(discardedResult.routing, 'DISCARDED');
    });
  });

  describe('Section6BuilderService & Lifecycle Guard', () => {
    const builder = new Section6BuilderService();

    it('should NEVER materialize Section 6 while pitching is in-flight (Success Criteria 2)', async () => {
      const service = new PitchGraphService();
      const sessionId = 'session-inflight-test';

      // Stream 2 chunk mở rộng
      await service.processStreamPitchChunk({
        sessionId,
        sequenceId: 1,
        text: 'Chúng tôi bổ sung kênh bán hàng B2G và hợp tác với 30 bệnh viện công',
        timestamp: Date.now(),
        isFinalChunk: false,
        detectedMarkers: [],
      });

      const session = service.getSession(sessionId)!;
      assert.ok(session);

      // Trong lúc đang pitch: Section 6 TUYỆT ĐỐI chưa được sinh ra!
      assert.strictEqual(session.hasSection6, false);
      assert.strictEqual(session.section6Title, undefined);

      const activeNodes = session.getActiveNodes();
      const s6Nodes = activeNodes.filter(
        (n) => n.sectionType === PitchSectionType.DYNAMIC_EXPANDED_SCOPE
      );
      assert.strictEqual(s6Nodes.length, 0);

      // Staging Buffer đã ghi nhận
      assert.strictEqual(session.stagingBuffer.length, 1);
    });

    it('should materialize Section 6 dynamically on finalizePitchStream when staging items exist', async () => {
      const service = new PitchGraphService();
      const sessionId = 'session-s6-materialize';

      // 1. Thí sinh nói 2 ý tưởng mở rộng thuộc Whitelist
      await service.processStreamPitchChunk({
        sessionId,
        sequenceId: 1,
        text: 'Chúng tôi mở rộng thị trường sang Đông Nam Á và địa bàn nông thôn',
        timestamp: Date.now(),
        isFinalChunk: false,
        detectedMarkers: [],
      });

      await service.processStreamPitchChunk({
        sessionId,
        sequenceId: 2,
        text: 'Chúng tôi bổ sung mục tiêu xuất khẩu đạt quy mô thị trường 20 triệu USD',
        timestamp: Date.now() + 500,
        isFinalChunk: false,
        detectedMarkers: [],
      });

      const session = service.getSession(sessionId)!;
      assert.strictEqual(session.hasSection6, false);

      // 2. Thí sinh bấm nộp bài [HOÀN TẤT THUYẾT TRÌNH]
      const syncResult = await service.finalizePitchStream({
        sessionId,
        totalChunks: 2,
        fullRawTranscript: 'Mở rộng thị trường Đông Nam Á...',
        durationSeconds: 25,
      });

      // Sau khi finalize: Section 6 được khai sinh chính thức!
      assert.strictEqual(session.hasSection6, true);
      assert.ok(session.section6Title?.includes('Thị Trường'));
      assert.strictEqual(syncResult.hasSection6, true);
      assert.strictEqual(syncResult.section6EntitiesCount, 2);

      const s6Nodes = session
        .getActiveNodes()
        .filter((n) => n.sectionType === PitchSectionType.DYNAMIC_EXPANDED_SCOPE);
      assert.strictEqual(s6Nodes.length, 2);

      // 3. Kiểm tra tính Idempotent: Gọi lại finalize lần nữa không được nhân đôi node
      const secondCallResult = builder.materializeSection6(session, 5);
      assert.strictEqual(secondCallResult.materializedNodes.length, 2);
      const s6NodesAfter = session
        .getActiveNodes()
        .filter((n) => n.sectionType === PitchSectionType.DYNAMIC_EXPANDED_SCOPE);
      assert.strictEqual(s6NodesAfter.length, 2);
    });

    it('should keep Section 6 as ABSENT when staging buffer is empty on finalize', async () => {
      const session = new PitchGraphSession('session-empty-staging');
      const result = builder.materializeSection6(session, 5);

      assert.strictEqual(result.hasSection6, false);
      assert.strictEqual(result.section6Title, undefined);
      assert.strictEqual(result.section6EntitiesCount, 0);
      assert.strictEqual(result.isPivotDetected, false);
    });

    it('should trigger FLAG_MAJOR_PROPOSAL_PIVOT when > 80% of speech deviates from baseline Word', async () => {
      const session = new PitchGraphSession('session-pivot-test');

      // Giả lập Word baseline có 5 node
      for (let i = 1; i <= 5; i++) {
        session.addNode({
          id: `w-${i}`,
          sessionId: 'session-pivot-test',
          sectionType: PitchSectionType.PROBLEM_MARKET,
          category: 'OTHER',
          key: `Baseline ${i}`,
          value: `Mô tả Word ${i}`,
          status: PitchGraphNodeStatus.ACTIVE,
          source: PitchNodeSource.WORD_BASELINE,
          confidence: 1.0,
          sequenceId: 0,
          timestamp: Date.now(),
        });
      }

      // Thí sinh nói 4 luận điểm đều là ý tưởng mở rộng hoàn toàn mới (100% lệch Word)
      for (let i = 1; i <= 4; i++) {
        session.addStagingItem({
          sequenceId: i,
          text: `Ý tưởng đột phá mới ngoài hồ sơ ${i}`,
          timestamp: Date.now() + i * 100,
          detectedMarkers: [],
          category: BusinessWhitelistCategory.NEW_FEATURE,
        });
      }

      const result = builder.materializeSection6(session, 5);

      // Vì 4/4 (100% >= 80%) luận điểm nói là ý tưởng mới ngoài Word -> Kích hoạt Pivot Flag!
      assert.strictEqual(result.isPivotDetected, true);
      assert.strictEqual(session.isPivotDetected, true);
    });

    it('should execute materialization in under 50ms (NFR-02: <= 1.0s in-memory limit)', () => {
      const session = new PitchGraphSession('session-perf-test');
      for (let i = 1; i <= 10; i++) {
        session.addStagingItem({
          sequenceId: i,
          text: `Chỉ số tài chính mở rộng thứ ${i} với doanh thu 10 tỷ`,
          timestamp: Date.now(),
          detectedMarkers: [],
          category: BusinessWhitelistCategory.FINANCIAL_METRIC,
        });
      }

      const startTime = performance.now();
      const result = builder.materializeSection6(session, 5);
      const elapsedMs = performance.now() - startTime;

      assert.strictEqual(result.hasSection6, true);
      assert.strictEqual(result.section6EntitiesCount, 10);
      assert.ok(elapsedMs < 50, `Execution took ${elapsedMs}ms, should be < 50ms`);
    });
  });
});
