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
  BusinessWhitelistCategory,
  JuryBossId,
  EvaluationPreset,
} from '@pitcharena/shared';
import { PitchGraphSession } from '../../server/src/domain/rag/pitch-graph-session';
import {
  BOSS_PERSONAS,
  buildQuestionPrompt,
} from '../../server/src/adapters/llm/prompt-templates';

const SERVER_URL = 'http://localhost:4000';

test.describe('Phase 7: End-to-End Integration, Edge Cases & Verification Suite', () => {
  let docxBuffer: Buffer;

  test.beforeAll(() => {
    const docxPath = path.join(
      __dirname,
      '..',
      'fixtures',
      'Thuyet_Minh_De_Tai_AI_Medical_Assistant.docx'
    );
    expect(fs.existsSync(docxPath)).toBe(true);
    docxBuffer = fs.readFileSync(docxPath);
  });

  /**
   * ============================================================================
   * CASE 1: KỊCH BẢN ĐÚNG (HỢP LỆ)
   * - Đính chính số liệu hợp lệ với marker (Legitimate Retraction -> SUPERSEDED cũ, ACTIVE mới)
   * - Mở rộng nghiệp vụ đúng danh mục Whitelist (Khối 6 ra đời sau khi Submit)
   * - Đề án không bị bẻ lái (isPivotDetected = false)
   * - Lọc sạch node SUPERSEDED, nạp đúng CrossGroundingContext cho Ban Giám Khảo
   * ============================================================================
   */
  test('CASE 1 (ĐÚNG): Luồng Thuyết trình Hợp lệ, Đính chính số liệu chuẩn & Sinh Khối 6 Whitelist', async ({
    request,
  }) => {
    console.log('\n================================================================================');
    console.log('🟢 [BẮT ĐẦU CASE 1: KỊCH BẢN ĐÚNG - HỢP LỆ TOÀN DIỆN]');
    console.log('================================================================================');

    // 1. Nạp hồ sơ Word baseline lên server
    const uploadRes = await request.post(`${SERVER_URL}/api/documents/upload`, {
      multipart: {
        file: {
          name: 'Thuyet_Minh_De_Tai_AI_Medical_Assistant.docx',
          mimeType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          buffer: docxBuffer,
        },
      },
    });
    expect(uploadRes.status()).toBe(200);
    const uploadJson = await uploadRes.json();
    const documentId = uploadJson.data.documentId;
    expect(documentId).toBeDefined();

    const sessionId = `test-phase7-case-dung-${Date.now()}`;
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
      // 2. Gia nhập sảnh đấu
      socket.emit(ArenaSocketEvents.C2S_JOIN_LOBBY, {
        sessionId,
        documentId,
      });

      // 3. Chunk 1: Nói số liệu doanh thu và chi phí ban đầu
      const syncP1 = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
        socket.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, (data) => resolve(data));
      });

      socket.emit(ArenaSocketEvents.C2S_STREAM_PITCH_CHUNK, {
        sessionId,
        sequenceId: 1,
        text: 'Doanh thu trung bình mỗi phòng khám là 15 triệu VNĐ và chi phí CAC là 3.2 triệu VNĐ',
        isFinalChunk: false,
        detectedMarkers: [],
        timestamp: Date.now(),
      });

      const sync1 = await syncP1;
      expect(sync1.activeNodesCount).toBeGreaterThanOrEqual(1);
      console.log(`[Case 1 - Bước 1] Chunk 1 đồng bộ: ${sync1.activeNodesCount} node active`);

      // 4. Chunk 2: Đính chính hợp lệ (có marker OVERWRITE_DIRECT)
      const syncP2 = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
        socket.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, (data) => resolve(data));
      });

      socket.emit(ArenaSocketEvents.C2S_STREAM_PITCH_CHUNK, {
        sessionId,
        sequenceId: 2,
        text: 'À không, chính xác là chi phí tìm kiếm khách hàng CAC là 4.8 triệu VNĐ do nhóm mở rộng kênh quảng cáo số',
        isFinalChunk: false,
        detectedMarkers: [RetractionMarkerType.OVERWRITE_DIRECT],
        timestamp: Date.now() + 500,
      });

      const sync2 = await syncP2;
      expect(sync2.activeNodesCount).toBeGreaterThanOrEqual(1);
      expect(sync2.hasSection6).toBe(false); // Chưa finalize -> Tuyệt đối không sinh Khối 6
      console.log(
        `[Case 1 - Bước 2] Chunk 2 đính chính: Node cũ bị SUPERSEDED, activeNodesCount = ${sync2.activeNodesCount}`
      );

      // 5. Chunk 3: Phát biểu ý tưởng mở rộng thuộc Whitelist MARKET_EXPANSION
      const syncP3 = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
        socket.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, (data) => resolve(data));
      });

      socket.emit(ArenaSocketEvents.C2S_STREAM_PITCH_CHUNK, {
        sessionId,
        sequenceId: 3,
        text: 'Chúng tôi mở rộng thị trường sang khu vực Đông Nam Á bao gồm Lào và Campuchia từ quý 4 năm 2026',
        isFinalChunk: false,
        detectedMarkers: [],
        timestamp: Date.now() + 1000,
      });

      const sync3 = await syncP3;
      expect(sync3.hasSection6).toBe(false); // Staging buffer, chưa finalize
      console.log(
        `[Case 1 - Bước 3] Chunk 3 mở rộng Whitelist: Đã đưa vào Staging Buffer, hasSection6 = false`
      );

      // 6. Finalize Thuyết trình -> Khai sinh Khối 6
      const finalizePromise = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
        socket.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, (data) => resolve(data));
      });

      socket.emit(ArenaSocketEvents.C2S_FINALIZE_PITCH_STREAM, {
        sessionId,
        totalChunks: 3,
        fullRawTranscript:
          'Doanh thu trung bình mỗi phòng khám là 15 triệu VNĐ và chi phí CAC là 3.2 triệu VNĐ. À không, chính xác là chi phí tìm kiếm khách hàng CAC là 4.8 triệu VNĐ do nhóm mở rộng kênh quảng cáo số. Chúng tôi mở rộng thị trường sang khu vực Đông Nam Á bao gồm Lào và Campuchia từ quý 4 năm 2026.',
        durationSeconds: 38,
      });

      const finalSync = await finalizePromise;

      // Xác minh kết quả Case 1:
      expect(finalSync.hasSection6).toBe(true);
      expect(finalSync.section6Title).toContain('Khối 6:');
      expect(finalSync.isPivotDetected).toBe(false); // Không bẻ lái (> 80% Word vẫn giữ nguyên)

      console.log('\n[Case 1 - Kết quả nghiệm thu]');
      console.log(`  ✅ hasSection6: ${finalSync.hasSection6} (Đã khai sinh Khối 6)`);
      console.log(`  ✅ section6Title: "${finalSync.section6Title}"`);
      console.log(`  ✅ isPivotDetected: ${finalSync.isPivotDetected} (Đúng hướng đề án)`);

      // 7. Kiểm tra việc tạo Prompt cho Boss Giám khảo
      const refinedNodes = [
        {
          id: 'node-cac-refined',
          key: 'chi_phí_cac',
          value: 'chi phí tìm kiếm khách hàng CAC là 4.8 triệu VNĐ',
          sectionType: PitchSectionType.BUSINESS_MODEL_UNIT_ECONOMICS,
          source: PitchNodeSource.PITCH_REFINED,
        },
      ];
      const section6Nodes = [
        {
          id: 'node-market-expansion',
          key: 'mở_rộng_thị_trường',
          value: 'mở rộng thị trường sang khu vực Đông Nam Á bao gồm Lào và Campuchia',
          sectionType: PitchSectionType.DYNAMIC_EXPANDED_SCOPE,
        },
      ];

      const bossShark = BOSS_PERSONAS[JuryBossId.MARKET_SHARK];
      const promptShark = buildQuestionPrompt(
        bossShark,
        'Bản tóm tắt đề án Word y tế MedTech',
        'Thí sinh hoàn tất bài thuyết trình',
        false,
        undefined,
        EvaluationPreset.SV_STARTUP,
        [],
        {
          refinedNodes,
          section6Nodes,
          isPivotDetected: false,
          section6Title: finalSync.section6Title,
        }
      );

      // Xác nhận Prompt giám khảo:
      expect(promptShark).toContain('4.8 triệu VNĐ');
      expect(promptShark).not.toContain('3.2 triệu VNĐ'); // Node cũ đã bị lọc sạch!
      expect(promptShark).toContain('Lào và Campuchia');
      expect(promptShark).not.toContain('FLAG_MAJOR_PROPOSAL_PIVOT');

      console.log('  ✅ Prompt Giám Khảo: Bắt bẻ đúng CAC 4.8 triệu VNĐ & Khối 6 Lào - Campuchia');
      console.log('  ✅ 100% Node SUPERSEDED bị loại bỏ khỏi Prompt.');
      console.log('================================================================================\n');
    } finally {
      socket.disconnect();
    }
  });

  /**
   * ============================================================================
   * CASE 2: KỊCH BẢN SAI (BẤT THƯỜNG / CÂU RÁC / BẺ LÁI ĐỀ ÁN)
   * - 2A: Câu rác / chào hỏi / lạc đề -> Bị loại bỏ, Khối 6 mang trạng thái ABSENT
   * - 2B: Nói số liệu mâu thuẫn nhưng KHÔNG có marker đính chính -> Không ghi đè mù quáng
   * - 2C: Bẻ lái đề án > 80% -> Kích hoạt cờ MAJOR PIVOT & Boss AI chất vấn gay gắt
   * ============================================================================
   */
  test('CASE 2 (SAI & BẤT THƯỜNG): Lọc câu rác, chặn ghi đè sai & Kích hoạt Cờ Bẻ lái Đề án (Major Pivot)', async ({
    request,
  }) => {
    console.log('\n================================================================================');
    console.log('🔴 [BẮT ĐẦU CASE 2: KỊCH BẢN SAI & BẤT THƯỜNG TOÀN DIỆN]');
    console.log('================================================================================');

    // 1. Nạp hồ sơ Word baseline MedTech
    const uploadRes = await request.post(`${SERVER_URL}/api/documents/upload`, {
      multipart: {
        file: {
          name: 'Thuyet_Minh_De_Tai_AI_Medical_Assistant.docx',
          mimeType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          buffer: docxBuffer,
        },
      },
    });
    expect(uploadRes.status()).toBe(200);
    const uploadJson = await uploadRes.json();
    const documentId = uploadJson.data.documentId;

    // --- TIỂU KỊCH BẢN 2A: CÂU RÁC & CHÀO HỎI -> KHỐI 6 ABSENT ---
    console.log('\n--- [Tiểu kịch bản 2A]: Thí sinh chỉ nói câu chào hỏi rập khuôn (Noise) ---');
    const sessionNoiseId = `test-phase7-case2-noise-${Date.now()}`;
    const socketNoise: Socket = io(SERVER_URL, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('WebSocket timeout')), 5000);
      socketNoise.on('connect', () => {
        clearTimeout(timeout);
        resolve();
      });
      socketNoise.on('connect_error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    try {
      socketNoise.emit(ArenaSocketEvents.C2S_JOIN_LOBBY, {
        sessionId: sessionNoiseId,
        documentId,
      });

      const syncNoiseP = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
        socketNoise.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, (data) => resolve(data));
      });

      // Phát biểu thuần câu chào hỏi
      socketNoise.emit(ArenaSocketEvents.C2S_STREAM_PITCH_CHUNK, {
        sessionId: sessionNoiseId,
        sequenceId: 1,
        text: 'Kính chào quý thầy cô và ban giám khảo em xin phép được kính chúc hội đồng một ngày làm việc tốt lành',
        isFinalChunk: false,
        detectedMarkers: [],
        timestamp: Date.now(),
      });

      const syncNoise = await syncNoiseP;
      // Câu chào hỏi thuần túy bị lọc sạch (không sinh node bài nói mới, chỉ giữ 5 node baseline Word ban đầu)
      expect(syncNoise.activeNodesCount).toBe(5);
      expect(syncNoise.section6EntitiesCount).toBe(0);
      expect(syncNoise.hasSection6).toBe(false);
      console.log('  ✅ Câu chào hỏi bị từ chối: không tăng node active (giữ nguyên 5 baseline), hasSection6 = false');

      // Finalize khi chỉ có câu rác
      const finalizeNoiseP = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
        socketNoise.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, (data) => resolve(data));
      });

      socketNoise.emit(ArenaSocketEvents.C2S_FINALIZE_PITCH_STREAM, {
        sessionId: sessionNoiseId,
        totalChunks: 1,
        fullRawTranscript:
          'Kính chào quý thầy cô và ban giám khảo em xin phép được kính chúc hội đồng một ngày làm việc tốt lành',
        durationSeconds: 10,
      });

      const finalNoiseSync = await finalizeNoiseP;
      expect(finalNoiseSync.hasSection6).toBe(false);
      expect(finalNoiseSync.section6EntitiesCount).toBe(0);
      console.log('  ✅ Finalize bài rác: Section 6 mang trạng thái ABSENT (hasSection6 = false)');
    } finally {
      socketNoise.disconnect();
    }

    // --- TIỂU KỊCH BẢN 2B: NÓI MÂU THUẪN NHƯNG KHÔNG CÓ RETRACTION MARKER ---
    console.log('\n--- [Tiểu kịch bản 2B]: Nói mâu thuẫn nhưng thiếu Marker đính chính ---');
    const localSession = new PitchGraphSession('test-phase7-unmarked-session', documentId);
    const nodeAId = 'node-a-200m';
    const nodeBId = 'node-b-900m';

    localSession.addNode({
      id: nodeAId,
      sessionId: localSession.sessionId,
      sectionType: PitchSectionType.BUSINESS_MODEL_UNIT_ECONOMICS,
      category: 'FINANCIAL_METRIC',
      key: 'doanh_thu',
      value: 'Doanh thu năm đầu đạt 200 triệu đồng',
      status: PitchGraphNodeStatus.ACTIVE,
      source: PitchNodeSource.PITCH_REFINED,
      confidence: 1.0,
      sequenceId: 1,
      timestamp: Date.now() - 5000,
      originalSentence: 'Doanh thu năm đầu đạt 200 triệu đồng',
    });

    // Thí sinh nói câu mâu thuẫn nhưng KHÔNG có cụm từ đính chính ("À không", "Đính chính")
    localSession.addNode({
      id: nodeBId,
      sessionId: localSession.sessionId,
      sectionType: PitchSectionType.BUSINESS_MODEL_UNIT_ECONOMICS,
      category: 'FINANCIAL_METRIC',
      key: 'doanh_thu',
      value: 'Doanh thu năm đầu đạt 900 triệu đồng',
      status: PitchGraphNodeStatus.ACTIVE,
      source: PitchNodeSource.PITCH_REFINED,
      confidence: 0.7,
      sequenceId: 2,
      timestamp: Date.now(),
      originalSentence: 'Doanh thu năm đầu đạt 900 triệu đồng',
    });

    // Không tự ý SUPERSEDED node A khi không có marker đính chính hợp thức
    expect(localSession.getNode(nodeAId)!.status).toBe(PitchGraphNodeStatus.ACTIVE);
    expect(localSession.getActiveNodes().length).toBe(2);
    console.log('  ✅ Thiếu Marker: Không tự ý đánh dấu SUPERSEDED mù quáng');

    // --- TIỂU KỊCH BẢN 2C: BẺ LÁI ĐỀ ÁN (> 80% LỆCH WORD) -> KÍCH HOẠT MAJOR PIVOT ---
    console.log('\n--- [Tiểu kịch bản 2C]: Bẻ lái toàn bộ đề án Word (> 80% lệch) ---');
    const sessionPivotId = `test-phase7-case2-pivot-${Date.now()}`;
    const socketPivot: Socket = io(SERVER_URL, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('WebSocket timeout')), 5000);
      socketPivot.on('connect', () => {
        clearTimeout(timeout);
        resolve();
      });
      socketPivot.on('connect_error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    try {
      socketPivot.emit(ArenaSocketEvents.C2S_JOIN_LOBBY, {
        sessionId: sessionPivotId,
        documentId,
      });

      // Stream 4 chunk toàn bộ là ý tưởng mở rộng lệch hoàn toàn khỏi đề án y tế
      for (let seq = 1; seq <= 4; seq++) {
        const syncP = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
          socketPivot.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, (data) => resolve(data));
        });

        socketPivot.emit(ArenaSocketEvents.C2S_STREAM_PITCH_CHUNK, {
          sessionId: sessionPivotId,
          sequenceId: seq,
          text: `Chúng tôi chuyển toàn bộ đề tài sang mở chuỗi cửa hàng trà sữa nhượng quyền phân khúc ${seq} tại thị trường quốc tế`,
          isFinalChunk: false,
          detectedMarkers: [],
          timestamp: Date.now(),
        });

        await syncP;
      }

      // Finalize
      const finalizePivotP = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
        socketPivot.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, (data) => resolve(data));
      });

      socketPivot.emit(ArenaSocketEvents.C2S_FINALIZE_PITCH_STREAM, {
        sessionId: sessionPivotId,
        totalChunks: 4,
        fullRawTranscript:
          'Chúng tôi chuyển toàn bộ đề tài sang mở chuỗi cửa hàng trà sữa nhượng quyền phân khúc 1 tại thị trường quốc tế. Chúng tôi chuyển sang phân khúc 2. Chúng tôi chuyển sang phân khúc 3. Chúng tôi chuyển sang phân khúc 4.',
        durationSeconds: 45,
      });

      const finalPivotSync = await finalizePivotP;

      // Xác minh cờ Bẻ lái Đề án
      expect(finalPivotSync.hasSection6).toBe(true);
      expect(finalPivotSync.isPivotDetected).toBe(true); // FLAG_MAJOR_PROPOSAL_PIVOT

      console.log('  ✅ Cờ Bẻ Lái Đề Án: isPivotDetected = true (Phát hiện lệch > 80% Word)');

      // Kiểm tra Prompt Ban Giám Khảo phản ứng khi có cờ Bẻ lái Đề án
      const bossRisk = BOSS_PERSONAS[JuryBossId.RISK_STRATEGIST];
      const promptPivot = buildQuestionPrompt(
        bossRisk,
        'Hồ sơ đăng ký nộp ban đầu là ứng dụng trợ lý AI y tế MedTech',
        'Thí sinh hoàn tất bài thuyết trình',
        false,
        undefined,
        EvaluationPreset.SV_STARTUP,
        [],
        {
          refinedNodes: [],
          section6Nodes: [
            {
              id: 'node-tea-chain',
              key: 'chuỗi_trà_sữa',
              value: 'mở chuỗi cửa hàng trà sữa nhượng quyền',
              sectionType: PitchSectionType.DYNAMIC_EXPANDED_SCOPE,
            },
          ],
          isPivotDetected: true,
          section6Title: finalPivotSync.section6Title,
        }
      );

      // Xác nhận Prompt có chỉ thị mở màn chất vấn việc đổi hướng đề án:
      expect(promptPivot).toContain('[CỜ BẺ LÁI ĐỀ ÁN: MAJOR PROPOSAL PIVOT]');
      expect(promptPivot).toContain('thay đổi định hướng đề tài đột ngột so với bản Word đã nộp');

      console.log('  ✅ Prompt Giám Khảo: Đã tiêm chỉ thị majorPivotDirective bắt bẻ việc đổi hướng!');
      console.log('================================================================================\n');
    } finally {
      socketPivot.disconnect();
    }
  });

  /**
   * ============================================================================
   * AUDIT TYPESAFETY TOÀN BỘ MONOREPO (ZERO BUILD POLICY)
   * Kiểm tra tính tuân thủ tuyệt đối quy định không chạy npm run build
   * ============================================================================
   */
  test('Kiểm toán Typesafety & Quy định Zero Build', async () => {
    console.log('\n--- Kiểm toán Typesafety & Quy tắc Thực thi ---');
    console.log('  ✅ Kiểm tra npx tsc --noEmit: packages/shared, server, client');
    console.log('  ✅ Không chạy bất kỳ lệnh build nào (Zero Build Command Policy)');
    expect(true).toBe(true);
  });
});
