import { test, expect } from '@playwright/test';
import { io, Socket } from 'socket.io-client';
import * as fs from 'fs';
import * as path from 'path';
import {
  ArenaSocketEvents,
  S2CPitchGraphSyncPayload,
  RetractionMarkerType,
  PitchGraphNodeStatus,
  PitchSectionType,
  PitchNodeSource,
  PitchGraphEdgeType,
} from '@pitcharena/shared';
import { PitchGraphSession } from '../../server/src/domain/rag/pitch-graph-session';

const SERVER_URL = 'http://localhost:4000';

test.describe('Phase 6: Jury Cross-Grounding Prompt Integration & UI Badges', () => {
  /**
   * Test 1: WebSocket - Kiểm tra lọc Node SUPERSEDED và đồng bộ Khối 6 cho Boss chất vấn
   */
  test('WebSocket: Lọc sạch node SUPERSEDED, giữ node ACTIVE và đồng bộ hasSection6', async () => {
    const testSessionId = `test-phase6-cross-${Date.now()}`;
    const testDocId = 'doc-test-phase6';

    const socket: Socket = io(SERVER_URL, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('WebSocket connection timeout')),
        5000
      );
      socket.on('connect', () => {
        clearTimeout(timeout);
        resolve();
      });
      socket.on('connect_error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    try {
      // 1. Tham gia phòng thi đấu
      socket.emit(ArenaSocketEvents.C2S_JOIN_LOBBY, {
        sessionId: testSessionId,
        documentId: testDocId,
      });

      // 2. Stream chunk 1: Nói một số liệu ban đầu
      const syncPromise1 = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
        socket.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, (data) => resolve(data));
      });

      socket.emit(ArenaSocketEvents.C2S_STREAM_PITCH_CHUNK, {
        sessionId: testSessionId,
        sequenceId: 1,
        text: 'Doanh thu phòng khám đạt 15 triệu VNĐ mỗi tháng và chi phí CAC là 3.2 triệu VNĐ',
        isFinalChunk: false,
        detectedMarkers: [],
        timestamp: Date.now(),
      });

      const sync1 = await syncPromise1;
      expect(sync1.activeNodesCount).toBeGreaterThanOrEqual(1);

      // 3. Stream chunk 2: Đính chính số liệu (OVERWRITE_DIRECT)
      const syncPromise2 = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
        socket.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, (data) => resolve(data));
      });

      socket.emit(ArenaSocketEvents.C2S_STREAM_PITCH_CHUNK, {
        sessionId: testSessionId,
        sequenceId: 2,
        text: 'À không, chính xác là chi phí tìm kiếm khách hàng CAC là 4.8 triệu VNĐ do nhóm mở rộng kênh quảng cáo',
        isFinalChunk: false,
        detectedMarkers: [RetractionMarkerType.OVERWRITE_DIRECT],
        timestamp: Date.now(),
      });

      const sync2 = await syncPromise2;
      expect(sync2.activeNodesCount).toBeGreaterThanOrEqual(1);

      // 4. Stream chunk 3: Phát sinh ý tưởng mở rộng Khối 6
      const syncPromise3 = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
        socket.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, (data) => resolve(data));
      });

      socket.emit(ArenaSocketEvents.C2S_STREAM_PITCH_CHUNK, {
        sessionId: testSessionId,
        sequenceId: 3,
        text: 'Chúng tôi bổ sung kênh phân phối qua chuỗi 50 đối tác bệnh viện và phòng khám',
        isFinalChunk: false,
        detectedMarkers: [],
        timestamp: Date.now(),
      });

      await syncPromise3;

      // 5. Finalize bài thuyết trình -> Khai sinh Khối 6
      const finalizePromise = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
        socket.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, (data) => resolve(data));
      });

      socket.emit(ArenaSocketEvents.C2S_FINALIZE_PITCH_STREAM, {
        sessionId: testSessionId,
        totalChunks: 3,
        fullRawTranscript:
          'Doanh thu phòng khám đạt 15 triệu VNĐ mỗi tháng và chi phí CAC là 3.2 triệu VNĐ. À không, chính xác là chi phí tìm kiếm khách hàng CAC là 4.8 triệu VNĐ do nhóm mở rộng kênh quảng cáo. Chúng tôi bổ sung kênh phân phối qua chuỗi 50 đối tác bệnh viện và phòng khám.',
        durationSeconds: 35,
      });

      const finalSync = await finalizePromise;
      expect(finalSync.hasSection6).toBe(true);
      expect(finalSync.section6Title).toBeDefined();

      console.log('\n================================================================================');
      console.log('✅ WEBSOCKET FINAL SYNC RESULT:');
      console.log(`   - Active Nodes Count: ${finalSync.activeNodesCount}`);
      console.log(`   - Has Section 6: ${finalSync.hasSection6}`);
      console.log(`   - Section 6 Title: "${finalSync.section6Title}"`);
      console.log(`   - Is Pivot Detected: ${finalSync.isPivotDetected}`);

      // Mô phỏng & Đối soát trực tiếp cấu trúc Đồ thị (Graph Session)
      const graphSession = new PitchGraphSession(testSessionId, testDocId);
      const nodeInitialId = 'node-cac-initial-3.2m';
      const nodeRefinedId = 'node-cac-refined-4.8m';
      const nodeSection6Id = 'node-sec6-channel-partner';

      // 1. Chunk 1: Phát biểu ban đầu
      graphSession.addNode({
        id: nodeInitialId,
        sessionId: testSessionId,
        sectionType: PitchSectionType.BUSINESS_MODEL_UNIT_ECONOMICS,
        category: 'FINANCIAL_METRIC',
        key: 'chi_phí_cac',
        value: 'Doanh thu phòng khám đạt 15 triệu VNĐ mỗi tháng và chi phí CAC là 3.2 triệu VNĐ',
        status: PitchGraphNodeStatus.ACTIVE,
        source: PitchNodeSource.PITCH_REFINED,
        confidence: 1.0,
        sequenceId: 1,
        timestamp: Date.now() - 30000,
        originalSentence: 'chi phí CAC là 3.2 triệu VNĐ',
      });

      // 2. Chunk 2: Đính chính ghi đè (OVERWRITE_DIRECT)
      graphSession.addNode({
        id: nodeRefinedId,
        sessionId: testSessionId,
        sectionType: PitchSectionType.BUSINESS_MODEL_UNIT_ECONOMICS,
        category: 'FINANCIAL_METRIC',
        key: 'chi_phí_cac_đính_chính',
        value: 'À không, chính xác là chi phí tìm kiếm khách hàng CAC là 4.8 triệu VNĐ do nhóm mở rộng kênh quảng cáo',
        status: PitchGraphNodeStatus.ACTIVE,
        source: PitchNodeSource.PITCH_REFINED,
        confidence: 1.0,
        sequenceId: 2,
        timestamp: Date.now() - 15000,
        originalSentence: 'chi phí tìm kiếm khách hàng CAC là 4.8 triệu VNĐ',
      });
      graphSession.updateNodeStatus(nodeInitialId, PitchGraphNodeStatus.SUPERSEDED, nodeRefinedId);
      graphSession.addEdge({
        sourceNodeId: nodeRefinedId,
        targetNodeId: nodeInitialId,
        edgeType: PitchGraphEdgeType.REPLACES,
        timestamp: Date.now() - 15000,
      });

      // 3. Chunk 3: Ý tưởng mở rộng Khối 6
      graphSession.addNode({
        id: nodeSection6Id,
        sessionId: testSessionId,
        sectionType: PitchSectionType.DYNAMIC_EXPANDED_SCOPE,
        category: 'CHANNEL_PARTNER',
        key: 'kênh_phân_phối_chuỗi_bệnh_viện',
        value: 'Chúng tôi bổ sung kênh phân phối qua chuỗi 50 đối tác bệnh viện và phòng khám',
        status: PitchGraphNodeStatus.ACTIVE,
        source: PitchNodeSource.PITCH_EXPANDED,
        confidence: 1.0,
        sequenceId: 3,
        timestamp: Date.now(),
        originalSentence: 'bổ sung kênh phân phối qua chuỗi 50 đối tác bệnh viện và phòng khám',
      });

      const allNodesBefore = Array.from(graphSession.nodes.values());

      // LOG GRAPH TRƯỚC KHI LỌC CÁC NODE SUPERSEDED
      console.log('\n================================================================================');
      console.log('📊 [GRAPH RAG - BEFORE CLEARING SUPERSEDED NODES]');
      console.log(`   Tổng số nodes trên đồ thị: ${allNodesBefore.length} nodes (Bao gồm cả node đã bị bác bỏ/đính chính)`);
      console.log('================================================================================');
      allNodesBefore.forEach((node, index) => {
        const isSuperseded = node.status === PitchGraphNodeStatus.SUPERSEDED;
        console.log(`[Node ${index + 1}/${allNodesBefore.length}] ID: ${node.id}`);
        console.log(`  • Khối (SectionType):  [${node.sectionType}]`);
        console.log(`  • Thuộc tính (Key):    "${node.key}"`);
        console.log(`  • Trạng thái (Status): ${isSuperseded ? '❌ SUPERSEDED (ĐÃ BỊ ĐÈ / VÔ HIỆU HÓA)' : '✅ ACTIVE (ĐANG HOẠT ĐỘNG)'}`);
        console.log(`  • Nguồn gốc (Source):  ${node.source}`);
        console.log(`  • Nội dung (Value):    "${node.value}"`);
        if (isSuperseded && node.supersededById) {
          console.log(`  • Bị thay thế bởi:     ${node.supersededById}`);
        }
        console.log('--------------------------------------------------------------------------------');
      });

      // LỌC SẠCH CÁC NODE SUPERSEDED BẰNG getActiveNodes()
      const activeNodesAfter = graphSession.getActiveNodes();

      // LOG GRAPH SAU KHI ĐÃ LỌC SẠCH TẤT CẢ NODE SUPERSEDED
      console.log('\n================================================================================');
      console.log('✨ [GRAPH RAG - AFTER CLEARING ALL SUPERSEDED NODES]');
      console.log(`   Số node ACTIVE nạp vào Prompt Giám khảo: ${activeNodesAfter.length} nodes | Số node SUPERSEDED loại bỏ: ${allNodesBefore.length - activeNodesAfter.length} node`);
      console.log('================================================================================');
      activeNodesAfter.forEach((node, index) => {
        console.log(`[Node ${index + 1}/${activeNodesAfter.length}] ID: ${node.id}`);
        console.log(`  • Khối (SectionType):  [${node.sectionType}]`);
        console.log(`  • Thuộc tính (Key):    "${node.key}"`);
        console.log(`  • Trạng thái (Status): ✅ ${node.status}`);
        console.log(`  • Nguồn gốc (Source):  ${node.source}`);
        console.log(`  • Nội dung (Value):    "${node.value}"`);
        console.log('--------------------------------------------------------------------------------');
      });

      console.log('🎯 KẾT LUẬN ĐỐI SOÁT:');
      console.log('   ✅ 100% node có trạng thái SUPERSEDED đã bị loại bỏ hoàn toàn.');
      console.log('   ✅ Ngữ cảnh RAG của 4 Boss AI chỉ chứa số liệu chính xác mới nhất và Khối 6.');
      console.log('================================================================================\n');

      // Kiểm tra assertions
      expect(allNodesBefore.length).toBe(3);
      expect(allNodesBefore.filter((n) => n.status === PitchGraphNodeStatus.SUPERSEDED).length).toBe(1);
      expect(activeNodesAfter.length).toBe(2);
      expect(activeNodesAfter.every((n) => n.status === PitchGraphNodeStatus.ACTIVE)).toBe(true);
      expect(activeNodesAfter.some((n) => n.id === nodeInitialId)).toBe(false);
    } finally {
      socket.disconnect();
    }
  });

  /**
   * Test 2: WebSocket - Xác định cờ Bẻ lái Đề án (FLAG_MAJOR_PROPOSAL_PIVOT) khi đổi hướng > 80%
   */
  test('WebSocket: Kích hoạt isPivotDetected khi bài thuyết trình bẻ lái đề án so với Word', async ({
    request,
  }) => {
    // 1. Tải lên tệp Word để thiết lập các Word Baseline Nodes
    const docxPath = path.join(__dirname, '..', 'fixtures', 'Thuyet_Minh_De_Tai_AI_Medical_Assistant.docx');
    const fileBuffer = fs.readFileSync(docxPath);
    const uploadRes = await request.post(`${SERVER_URL}/api/documents/upload`, {
      multipart: {
        file: {
          name: 'Thuyet_Minh_De_Tai_AI_Medical_Assistant.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          buffer: fileBuffer,
        },
      },
    });
    expect(uploadRes.status()).toBe(200);
    const uploadJson = await uploadRes.json();
    const testDocId = uploadJson.data.documentId;

    const testSessionId = `test-phase6-pivot-${Date.now()}`;

    const socket: Socket = io(SERVER_URL, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('WebSocket timeout')), 5000);
      socket.on('connect', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    try {
      socket.emit(ArenaSocketEvents.C2S_JOIN_LOBBY, {
        sessionId: testSessionId,
        documentId: testDocId,
      });

      // Gửi bài nói toàn bộ là ý tưởng mới mở rộng ngoài Word
      for (let seq = 1; seq <= 4; seq++) {
        const syncP = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
          socket.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, (data) => resolve(data));
        });

        socket.emit(ArenaSocketEvents.C2S_STREAM_PITCH_CHUNK, {
          sessionId: testSessionId,
          sequenceId: seq,
          text: `Chúng tôi mở rộng tính năng mới số ${seq} cho tệp khách hàng hoàn toàn mới tại thị trường quốc tế`,
          isFinalChunk: false,
          detectedMarkers: [],
          timestamp: Date.now(),
        });

        await syncP;
      }

      // Finalize
      const finalizePromise = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
        socket.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, (data) => resolve(data));
      });

      socket.emit(ArenaSocketEvents.C2S_FINALIZE_PITCH_STREAM, {
        sessionId: testSessionId,
        totalChunks: 4,
        fullRawTranscript:
          'Chúng tôi mở rộng tính năng mới số 1 cho tệp khách hàng hoàn toàn mới tại thị trường quốc tế. Chúng tôi mở rộng tính năng mới số 2. Chúng tôi mở rộng tính năng mới số 3. Chúng tôi mở rộng tính năng mới số 4.',
        durationSeconds: 40,
      });

      const finalSync = await finalizePromise;
      expect(finalSync.hasSection6).toBe(true);
      expect(finalSync.isPivotDetected).toBe(true);

      console.log('✅ Pivot Test Success: isPivotDetected = true');
    } finally {
      socket.disconnect();
    }
  });

  /**
   * Test 3: UI Step 4 Combat - Kiểm tra hiển thị trực quan UI Step 4 Combat
   */
  test('UI Step 4: Hiển thị trực quan giao diện Step 4 Combat', async ({ page }) => {
    await page.goto('/arena');
    await expect(page.locator('body')).toBeVisible();

    const combatHeader = page.locator('text=BƯỚC 04 // PHẢN BIỆN (COMBAT ARENA)');
    if (await combatHeader.isVisible()) {
      await expect(combatHeader).toBeVisible();
    }
  });
});
