import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { PitchGraphSession } from './pitch-graph-session';
import { PitchGraphService } from './pitch-graph.service';
import {
  PitchGraphNodeStatus,
  PitchNodeSource,
  PitchSectionType,
  RetractionMarkerType,
  PitchGraphEdgeType,
} from '@pitcharena/shared';

describe('Phase 3: Server In-Memory Graph & Promise Queue', () => {
  describe('PitchGraphSession', () => {
    it('should maintain FIFO execution order via enqueueMutation (triệt tiêu race condition)', async () => {
      const session = new PitchGraphSession('test-session-1');
      const executionOrder: number[] = [];

      // Giả lập 3 tác vụ không đồng bộ với thời gian hoàn thành ngẫu nhiên
      const p1 = session.enqueueMutation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        executionOrder.push(1);
      });

      const p2 = session.enqueueMutation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        executionOrder.push(2);
      });

      const p3 = session.enqueueMutation(async () => {
        executionOrder.push(3);
      });

      await Promise.all([p1, p2, p3]);

      // Thứ tự thực thi bắt buộc phải là 1 -> 2 -> 3 dù p2/p3 có thời gian sleep ngắn hơn
      assert.deepStrictEqual(executionOrder, [1, 2, 3]);
    });

    it('should isolate errors in queue so subsequent mutations still execute', async () => {
      const session = new PitchGraphSession('test-session-err-iso');
      const results: string[] = [];

      // Mutation 1 ném lỗi
      const p1 = session.enqueueMutation(async () => {
        throw new Error('Mutation 1 failed intentionally');
      }).catch((err) => {
        results.push(`caught: ${err.message}`);
      });

      // Mutation 2 vẫn phải được thực thi bình thường
      const p2 = session.enqueueMutation(async () => {
        results.push('mutation 2 succeeded');
      });

      await Promise.all([p1, p2]);

      assert.strictEqual(results.length, 2);
      assert.strictEqual(results[0], 'caught: Mutation 1 failed intentionally');
      assert.strictEqual(results[1], 'mutation 2 succeeded');
    });

    it('should resolve timestamp collision by sequenceId in findMostRecentActiveNode', () => {
      const session = new PitchGraphSession('test-session-collision');
      const now = 1700000000000;

      session.addNode({
        id: 'node-seq-1',
        sessionId: 'test-session-collision',
        sectionType: PitchSectionType.PROBLEM_MARKET,
        category: 'OTHER',
        key: 'Điểm 1',
        value: 'Nội dung điểm 1',
        status: PitchGraphNodeStatus.ACTIVE,
        source: PitchNodeSource.PITCH_REFINED,
        confidence: 1.0,
        sequenceId: 1,
        timestamp: now,
      });

      session.addNode({
        id: 'node-seq-2',
        sessionId: 'test-session-collision',
        sectionType: PitchSectionType.PROBLEM_MARKET,
        category: 'OTHER',
        key: 'Điểm 2',
        value: 'Nội dung điểm 2',
        status: PitchGraphNodeStatus.ACTIVE,
        source: PitchNodeSource.PITCH_REFINED,
        confidence: 1.0,
        sequenceId: 2,
        timestamp: now, // Trùng timestamp chính xác
      });

      const mostRecent = session.findMostRecentActiveNode();
      assert.ok(mostRecent);
      assert.strictEqual(mostRecent.id, 'node-seq-2');
      assert.strictEqual(mostRecent.sequenceId, 2);
    });

    it('should manage nodes, edges and tombstone updates', () => {
      const session = new PitchGraphSession('test-session-2');

      session.addNode({
        id: 'node-1',
        sessionId: 'test-session-2',
        sectionType: PitchSectionType.PROBLEM_MARKET,
        category: 'OTHER',
        key: 'Doanh thu',
        value: '3 triệu đồng',
        status: PitchGraphNodeStatus.ACTIVE,
        source: PitchNodeSource.PITCH_REFINED,
        confidence: 1.0,
        sequenceId: 1,
        timestamp: Date.now(),
      });

      assert.strictEqual(session.getActiveNodes().length, 1);

      // Đánh dấu SUPERSEDED
      session.updateNodeStatus('node-1', PitchGraphNodeStatus.SUPERSEDED, 'node-2');
      assert.strictEqual(session.getActiveNodes().length, 0);

      const node1 = session.getNode('node-1');
      assert.strictEqual(node1?.status, PitchGraphNodeStatus.SUPERSEDED);
      assert.strictEqual(node1?.supersededById, 'node-2');
    });

    it('should clear all nodes, edges and memory on clear()', () => {
      const session = new PitchGraphSession('test-session-3');
      session.addNode({
        id: 'node-temp',
        sessionId: 'test-session-3',
        sectionType: PitchSectionType.SOLUTION_PRODUCT,
        category: 'OTHER',
        key: 'Feature',
        value: 'AI model',
        status: PitchGraphNodeStatus.ACTIVE,
        source: PitchNodeSource.PITCH_REFINED,
        confidence: 1.0,
        sequenceId: 1,
        timestamp: Date.now(),
      });

      session.addEdge({
        sourceNodeId: 'node-temp',
        targetNodeId: 'node-other',
        edgeType: PitchGraphEdgeType.CLARIFIES,
        timestamp: Date.now(),
      });

      session.addStagingItem({
        sequenceId: 1,
        text: 'AI model',
        timestamp: Date.now(),
        detectedMarkers: [],
      });

      assert.strictEqual(session.nodes.size, 1);
      assert.strictEqual(session.edges.length, 1);
      assert.strictEqual(session.stagingBuffer.length, 1);

      session.clear();

      assert.strictEqual(session.nodes.size, 0);
      assert.strictEqual(session.edges.length, 0);
      assert.strictEqual(session.stagingBuffer.length, 0);
    });
  });

  describe('PitchGraphService Tombstone Engine', () => {
    it('should mark old node as SUPERSEDED and link via REPLACES edge on OVERWRITE_DIRECT', async () => {
      const service = new PitchGraphService();
      const sessionId = 'session-tombstone-test';

      // 1. Thí sinh nói câu đầu: "Doanh thu dự kiến 3 triệu"
      await service.processStreamPitchChunk({
        sessionId,
        sequenceId: 1,
        text: 'Doanh thu dự kiến 3 triệu',
        timestamp: Date.now(),
        isFinalChunk: false,
        detectedMarkers: [],
      });

      const session = service.getSession(sessionId)!;
      assert.ok(session);
      assert.strictEqual(session.getActiveNodes().length, 1);
      const originalNode = session.getActiveNodes()[0];
      assert.strictEqual(originalNode.status, PitchGraphNodeStatus.ACTIVE);

      // 2. Thí sinh đính chính: "à không, chính xác là 3.5 triệu"
      await service.processStreamPitchChunk({
        sessionId,
        sequenceId: 2,
        text: 'à không chính xác là 3.5 triệu',
        timestamp: Date.now() + 1000,
        isFinalChunk: false,
        detectedMarkers: [RetractionMarkerType.OVERWRITE_DIRECT],
      });

      // Node gốc phải chuyển sang SUPERSEDED
      const updatedOriginal = session.getNode(originalNode.id);
      assert.strictEqual(updatedOriginal?.status, PitchGraphNodeStatus.SUPERSEDED);

      // Node mới phải là ACTIVE
      const activeNodes = session.getActiveNodes();
      assert.strictEqual(activeNodes.length, 1);
      const newNode = activeNodes[0];
      assert.strictEqual(newNode.status, PitchGraphNodeStatus.ACTIVE);
      assert.strictEqual(newNode.value, 'à không chính xác là 3.5 triệu');
      assert.strictEqual(updatedOriginal?.supersededById, newNode.id);

      // Cạnh REPLACES phải được tạo
      assert.strictEqual(session.edges.length, 1);
      assert.strictEqual(session.edges[0].edgeType, PitchGraphEdgeType.REPLACES);
      assert.strictEqual(session.edges[0].sourceNodeId, newNode.id);
      assert.strictEqual(session.edges[0].targetNodeId, originalNode.id);
    });

    it('should mark node as RETRACTED on CANCELLATION', async () => {
      const service = new PitchGraphService();
      const sessionId = 'session-cancellation-test';

      // 1. Nói ý tưởng
      await service.processStreamPitchChunk({
        sessionId,
        sequenceId: 1,
        text: 'Tính năng tự động xuất báo cáo PDF',
        timestamp: Date.now(),
        isFinalChunk: false,
        detectedMarkers: [],
      });

      const session = service.getSession(sessionId)!;
      assert.strictEqual(session.getActiveNodes().length, 1);

      // 2. Hủy bỏ
      await service.processStreamPitchChunk({
        sessionId,
        sequenceId: 2,
        text: 'thôi bỏ đi tính năng này chưa tính tới',
        timestamp: Date.now() + 1000,
        isFinalChunk: false,
        detectedMarkers: [RetractionMarkerType.CANCELLATION],
      });

      // Node trước đó phải đổi thành RETRACTED
      assert.strictEqual(session.getActiveNodes().length, 0);
      const allNodes = Array.from(session.nodes.values());
      const retractedNode = allNodes.find((n) => n.status === PitchGraphNodeStatus.RETRACTED);
      assert.ok(retractedNode);
    });

    it('should retain both nodes as ACTIVE and create CLARIFIES edge on ELABORATION', async () => {
      const service = new PitchGraphService();
      const sessionId = 'session-elaboration-test';

      // 1. Nói ý tưởng ban đầu
      await service.processStreamPitchChunk({
        sessionId,
        sequenceId: 1,
        text: 'Chúng tôi áp dụng mô hình B2B',
        timestamp: Date.now(),
        isFinalChunk: false,
        detectedMarkers: [],
      });

      const session = service.getSession(sessionId)!;
      assert.strictEqual(session.getActiveNodes().length, 1);
      const originalNode = session.getActiveNodes()[0];

      // 2. Làm rõ thêm: "cụ thể là bán gói SaaS cho các phòng khám nha khoa"
      await service.processStreamPitchChunk({
        sessionId,
        sequenceId: 2,
        text: 'cụ thể là bán gói SaaS cho các phòng khám nha khoa',
        timestamp: Date.now() + 1000,
        isFinalChunk: false,
        detectedMarkers: [RetractionMarkerType.ELABORATION],
      });

      // Cả 2 node đều phải ACTIVE
      const activeNodes = session.getActiveNodes();
      assert.strictEqual(activeNodes.length, 2);

      // Cạnh CLARIFIES được thiết lập
      const clarifiesEdge = session.edges.find((e) => e.edgeType === PitchGraphEdgeType.CLARIFIES);
      assert.ok(clarifiesEdge);
      assert.strictEqual(clarifiesEdge.targetNodeId, originalNode.id);

      // Staging buffer được ghi nhận
      assert.strictEqual(session.stagingBuffer.length, 2);
    });

    it('should finalize pitch stream and return sync payload', async () => {
      const service = new PitchGraphService();
      const sessionId = 'session-finalize-test';

      await service.processStreamPitchChunk({
        sessionId,
        sequenceId: 1,
        text: 'Thị trường MedTech đạt 1.2 tỷ USD',
        timestamp: Date.now(),
        isFinalChunk: false,
        detectedMarkers: [],
      });

      const sync = await service.finalizePitchStream({
        sessionId,
        totalChunks: 1,
        fullRawTranscript: 'Thị trường MedTech đạt 1.2 tỷ USD',
        durationSeconds: 12,
      });

      assert.strictEqual(sync.sessionId, sessionId);
      assert.strictEqual(sync.activeNodesCount, 1);

      const session = service.getSession(sessionId)!;
      assert.strictEqual(session.isFinalized, true);
      assert.strictEqual(session.durationSeconds, 12);
    });

    it('should completely free memory on removeSession', () => {
      const service = new PitchGraphService();
      const sessionId = 'session-leak-test';

      service.getOrCreateSession(sessionId);
      assert.ok(service.getSession(sessionId));

      service.removeSession(sessionId);
      assert.strictEqual(service.getSession(sessionId), undefined);
    });
  });
});
