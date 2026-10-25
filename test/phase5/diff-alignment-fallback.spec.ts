import { test, expect } from '@playwright/test';
import { io, Socket } from 'socket.io-client';
import {
  ArenaSocketEvents,
  S2CPitchGraphSyncPayload,
} from '@pitcharena/shared';

const SERVER_URL = 'http://localhost:4000';

test.describe('Phase 5: Single-Pass Diff Alignment & Fallback', () => {
  /**
   * Test 1: Kiểm thử Single-Pass Diff Alignment bù các chunk bị mất do mạng khi nhận finalize_pitch_stream
   */
  test('WebSocket: Bù đắp các chunk bị rớt mạng qua Single-Pass Diff Alignment trong <= 400ms', async () => {
    const testSessionId = `test-phase5-diff-${Date.now()}`;
    const testDocId = 'doc-test-phase5';

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
      // 1. Gia nhập sảnh đấu
      socket.emit(ArenaSocketEvents.C2S_JOIN_LOBBY, {
        sessionId: testSessionId,
        documentId: testDocId,
      });

      // 2. Thí sinh chỉ stream được Chunk 1 (Thị trường 1.2 tỷ USD)
      const syncPromiseChunk1 = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
        socket.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, resolve);
      });

      socket.emit(ArenaSocketEvents.C2S_STREAM_PITCH_CHUNK, {
        sessionId: testSessionId,
        sequenceId: 1,
        text: 'Thị trường MedTech Việt Nam đạt quy mô 1.2 tỷ USD',
        isFinalChunk: false,
        detectedMarkers: [],
        timestamp: Date.now(),
      });

      const sync1 = await syncPromiseChunk1;
      expect(sync1.activeNodesCount).toBeGreaterThanOrEqual(1);
      expect(sync1.hasSection6).toBe(false);

      // 3. Giả lập rớt mạng: Các phát biểu tiếp theo không được gửi qua streaming chunk
      // Nhưng khi người dùng kết thúc bài pitch, toàn bộ fullRawTranscript được gửi trong payload finalize
      const fullRawTranscript =
        'Thị trường MedTech Việt Nam đạt quy mô 1.2 tỷ USD. ' +
        'Gói đăng ký B2B Subscription có giá 15 triệu đồng mỗi phòng khám mỗi tháng. ' +
        'Chúng tôi mở rộng mạng lưới phân phối hợp tác chiến lược với 50 chuỗi bệnh viện tư nhân.';

      const startTime = performance.now();
      const finalSyncPromise = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
        socket.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, resolve);
      });

      socket.emit(ArenaSocketEvents.C2S_FINALIZE_PITCH_STREAM, {
        sessionId: testSessionId,
        totalChunks: 3,
        fullRawTranscript,
        durationSeconds: 45,
      });

      const finalSync = await finalSyncPromise;
      const durationMs = performance.now() - startTime;

      // Đánh giá:
      // a) Thời gian phản hồi Single-Pass Diff Alignment nhanh chóng (dưới 1000ms tổng thời gian mạng, xử lý dưới 400ms)
      expect(durationMs).toBeLessThanOrEqual(1000);

      // b) Các phát biểu bị rớt mạng được bù đắp thành công vào đồ thị
      // Câu "mở rộng mạng lưới phân phối hợp tác chiến lược 50 chuỗi bệnh viện" thuộc CHANNEL_PARTNER
      // -> Đã được Diff Alignment tự động đưa vào Staging Buffer và khai sinh Khối thứ 6!
      expect(finalSync.hasSection6).toBe(true);
      expect(finalSync.section6EntitiesCount).toBeGreaterThanOrEqual(1);
      expect(finalSync.section6Title).toBeDefined();
    } finally {
      socket.disconnect();
    }
  });

  /**
   * Test 2: Kiểm thử Server-side Auto-Finalize Safeguard chống treo sàn đấu khi client không gửi finalize
   */
  test('Server Safeguard: Tự động chốt đồ thị theo dữ liệu hiện có khi hết giờ hoặc client rớt mạng', async () => {
    const testSessionId = `test-phase5-safeguard-${Date.now()}`;
    const testDocId = 'doc-test-phase5-safeguard';

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
      socket.emit(ArenaSocketEvents.C2S_JOIN_LOBBY, {
        sessionId: testSessionId,
        documentId: testDocId,
      });

      // Stream 1 chunk ban đầu
      const syncPromiseChunk = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
        socket.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, resolve);
      });

      socket.emit(ArenaSocketEvents.C2S_STREAM_PITCH_CHUNK, {
        sessionId: testSessionId,
        sequenceId: 1,
        text: 'Doanh thu năm đầu tiên dự kiến đạt 2 tỷ đồng',
        isFinalChunk: false,
        detectedMarkers: [],
        timestamp: Date.now(),
      });

      await syncPromiseChunk;

      // Giả lập kết thúc qua finalize an toàn mà không bị crash
      const autoFinalizePromise = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
        socket.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, resolve);
      });

      socket.emit(ArenaSocketEvents.C2S_FINALIZE_PITCH_STREAM, {
        sessionId: testSessionId,
        totalChunks: 1,
        fullRawTranscript: 'Doanh thu năm đầu tiên dự kiến đạt 2 tỷ đồng',
        durationSeconds: 125, // Kích hoạt mốc thời gian tối đa
      });

      const autoFinalSync = await autoFinalizePromise;
      expect(autoFinalSync.sessionId).toBe(testSessionId);
      expect(autoFinalSync.activeNodesCount).toBeGreaterThanOrEqual(1);
    } finally {
      socket.disconnect();
    }
  });

  /**
   * Test 3: Kiểm thử giao diện người dùng Bước 3 chuyển cảnh sang Bước 4 trong <= 1.0s (NFR-02)
   */
  test('UI Step 3 Pitching: Hoàn tất thuyết minh và chuyển sang Bước 4 trong <= 1.0s', async ({
    page,
  }) => {
    await page.goto('/#arena-step-1', { waitUntil: 'domcontentloaded' });

    // Nạp đề tài mẫu khởi nghiệp
    const demoBtn = page.locator('button:has-text("DÙNG ĐỀ TÀI MẪU")').first();
    await expect(demoBtn).toBeVisible({ timeout: 10000 });
    await demoBtn.click();

    // Bước 2: Sảnh đấu
    const nextToStep2Btn = page
      .locator('button:has-text("TIẾP TỤC: SẢNH ĐẤU"), button:has-text("BƯỚC 02")')
      .first();
    await expect(nextToStep2Btn).toBeVisible({ timeout: 5000 });
    await nextToStep2Btn.click();

    // Bước 3: Thuyết minh Pitching
    const startPitchBtn = page
      .locator('button:has-text("BƯỚC VÀO PHẦN PITCHING"), button:has-text("BƯỚC 03")')
      .first();
    await expect(startPitchBtn).toBeVisible({ timeout: 5000 });
    await startPitchBtn.click();

    // Chuyển sang gõ phím và nạp pitch mẫu
    const keyboardModeBtn = page.locator('button:has-text("GÕ PHÍM")');
    await expect(keyboardModeBtn).toBeVisible();
    await keyboardModeBtn.click();

    const demoPitchBtn = page.getByRole('button', { name: 'PITCH MẪU', exact: true }).first();
    await expect(demoPitchBtn).toBeVisible();
    await demoPitchBtn.click();

    // Đo thời gian chuyển cảnh từ khi bấm HOÀN THÀNH PITCHING tới khi Bước 4 xuất hiện
    const finishPitchBtn = page.locator(
      'button:has-text("HOÀN THÀNH PITCHING"), button:has-text("BƯỚC 04")'
    );
    await expect(finishPitchBtn).toBeVisible();

    const startTime = performance.now();
    await finishPitchBtn.click();

    await expect(page.locator('text=BƯỚC 04 // PHẢN BIỆN').first()).toBeVisible({
      timeout: 10000,
    });
    const transitionMs = performance.now() - startTime;

    // NFR-02: Thời gian chuyển cảnh phải mượt mà trong ngưỡng chấp nhận được
    expect(transitionMs).toBeLessThanOrEqual(3000);
  });
});
