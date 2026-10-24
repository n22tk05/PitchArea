import { test, expect } from '@playwright/test';
import { io, Socket } from 'socket.io-client';
import {
  ArenaSocketEvents,
  S2CPitchGraphSyncPayload,
} from '@pitcharena/shared';

const SERVER_URL = 'http://localhost:4000';

test.describe('Phase 4: Section 6 Materializer & Business Whitelist Gate', () => {
  /**
   * Test 1: Kiểm thử luồng WebSocket Phân luồng Whitelist & Khai sinh Khối 6 khi finalize
   */
  test('WebSocket: Lọc câu chào hỏi, đưa mở rộng vào Staging, và CHỈ khai sinh Khối 6 khi finalize', async () => {
    const testSessionId = `test-phase4-${Date.now()}`;
    const testDocId = 'doc-test-phase4';

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
      // 1. Gia nhập phòng thi đấu
      socket.emit(ArenaSocketEvents.C2S_JOIN_LOBBY, {
        sessionId: testSessionId,
        documentId: testDocId,
      });

      // 2. Thí sinh nói câu chào hỏi (Noise) -> Hệ thống phải loại bỏ, không tăng node hay staging
      const syncPromiseNoise = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
        socket.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, (data) => {
          resolve(data);
        });
      });

      socket.emit(ArenaSocketEvents.C2S_STREAM_PITCH_CHUNK, {
        sessionId: testSessionId,
        sequenceId: 1,
        text: 'Kính chào quý thầy cô và ban giám khảo em xin phép bắt đầu bài thuyết trình',
        isFinalChunk: false,
        detectedMarkers: [],
        timestamp: Date.now(),
      });

      const syncNoise = await syncPromiseNoise;
      expect(syncNoise.activeNodesCount).toBe(0);
      expect(syncNoise.section6EntitiesCount).toBe(0);
      expect(syncNoise.hasSection6).toBe(false);

      // 3. Thí sinh nói ý tưởng cốt lõi bám đề án -> Ghi vào Refined Node
      const syncPromiseRefined = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
        socket.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, (data) => {
          resolve(data);
        });
      });

      socket.emit(ArenaSocketEvents.C2S_STREAM_PITCH_CHUNK, {
        sessionId: testSessionId,
        sequenceId: 2,
        text: 'Vấn đề cốt lõi của thị trường y tế là chi phí thiết bị chẩn đoán quá đắt đỏ',
        isFinalChunk: false,
        detectedMarkers: [],
        timestamp: Date.now() + 500,
      });

      const syncRefined = await syncPromiseRefined;
      expect(syncRefined.activeNodesCount).toBe(1);
      expect(syncRefined.hasSection6).toBe(false);
      expect(syncRefined.section6EntitiesCount).toBe(0);

      // 4. Thí sinh phát biểu ý tưởng mở rộng (Whitelist: CHANNEL_PARTNER) -> Ghi vào Staging Buffer
      // QUAN TRỌNG: hasSection6 VẪN PHẢI LÀ FALSE (chưa nộp bài thì không được sinh Khối 6)
      const syncPromiseStaging = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
        socket.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, (data) => {
          resolve(data);
        });
      });

      socket.emit(ArenaSocketEvents.C2S_STREAM_PITCH_CHUNK, {
        sessionId: testSessionId,
        sequenceId: 3,
        text: 'Chúng tôi bổ sung kênh phân phối qua chuỗi 50 đối tác bệnh viện và phòng khám',
        isFinalChunk: false,
        detectedMarkers: [],
        timestamp: Date.now() + 1000,
      });

      const syncStaging = await syncPromiseStaging;
      expect(syncStaging.hasSection6).toBe(false);
      expect(syncStaging.section6EntitiesCount).toBe(1);

      // 5. Thí sinh bấm nộp bài [HOÀN TẤT BÀI NÓI] -> Kích hoạt finalize và KHAI SINH KHỐI 6
      const syncPromiseFinal = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
        socket.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, (data) => {
          resolve(data);
        });
      });

      socket.emit(ArenaSocketEvents.C2S_FINALIZE_PITCH_STREAM, {
        sessionId: testSessionId,
        totalChunks: 3,
        fullRawTranscript:
          'Kính chào quý thầy cô... Vấn đề cốt lõi của thị trường... Chúng tôi bổ sung kênh phân phối...',
        durationSeconds: 45,
      });

      const syncFinal = await syncPromiseFinal;
      // Khối 6 chính thức được khai sinh!
      expect(syncFinal.hasSection6).toBe(true);
      expect(syncFinal.section6Title).toBeDefined();
      expect(syncFinal.section6Title).toContain('Đối Tác');
      expect(syncFinal.section6EntitiesCount).toBe(1);
      // activeNodesCount tăng thêm 1 từ Khối 6 (1 refined + 1 khối 6 = 2)
      expect(syncFinal.activeNodesCount).toBe(2);
    } finally {
      socket.disconnect();
    }
  });

  /**
   * Test 2: Kiểm thử UI Step 3 nộp bài hoàn tất thuyết minh và chuyển bước
   */
  test('UI Step 3 Pitching: Hoàn tất thuyết minh và chuyển sang Bước 4', async ({
    page,
  }) => {
    await page.goto('/#arena-step-1');

    // 1. Nạp đề tài mẫu
    const demoBtn = page.locator('button:has-text("DÙNG ĐỀ TÀI MẪU")').first();
    await demoBtn.click();

    // 2. Vào Bước 2 Lobby
    const nextToStep2Btn = page
      .locator('button:has-text("TIẾP TỤC: SẢNH ĐẤU"), button:has-text("BƯỚC 02")')
      .first();
    await nextToStep2Btn.click();

    // 3. Vào Bước 3 Pitching
    const startPitchBtn = page
      .locator('button:has-text("BƯỚC VÀO PHẦN PITCHING"), button:has-text("BƯỚC 03")')
      .first();
    await startPitchBtn.click();

    await expect(page.locator('text=THUYẾT MINH PITCHING')).toBeVisible({ timeout: 5000 });

    // 4. Chuyển sang gõ phím và nạp bài Pitch mẫu
    const keyboardBtn = page.locator('button:has-text("GÕ PHÍM")').first();
    await keyboardBtn.click();

    const demoPitchBtn = page
      .getByRole('button', { name: 'PITCH MẪU', exact: true })
      .first();
    await demoPitchBtn.click();

    // 5. Bấm kết thúc bài nói để kích hoạt finalize
    const finishBtn = page.locator(
      'button:has-text("HOÀN THÀNH PITCHING"), button:has-text("BƯỚC 04")'
    );
    await expect(finishBtn).toBeVisible();
    await finishBtn.click();

    // Xác nhận đã vào Bước 4 Combat
    await expect(
      page.locator('text=BƯỚC 04 // PHẢN BIỆN').first()
    ).toBeVisible({ timeout: 10000 });
  });
});
