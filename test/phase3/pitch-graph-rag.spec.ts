import { test, expect } from '@playwright/test';
import { io, Socket } from 'socket.io-client';
import {
  ArenaSocketEvents,
  RetractionMarkerType,
  PitchGraphNodeStatus,
  PitchGraphEdgeType,
  S2CPitchGraphSyncPayload,
} from '@pitcharena/shared';

const SERVER_URL = 'http://localhost:4000';

test.describe('Phase 3: Real-time Streaming Pitch GraphRAG & Step 3 Pitching', () => {
  /**
   * Test 1: Kiểm thử toàn diện giao diện Bước 3 (Teleprompter, Chuyển chế độ, Nạp Pitch mẫu)
   */
  test('UI Step 3 Pitching: Điều hướng, chuyển chế độ Voice/Keyboard, nạp Pitch mẫu và hoàn tất', async ({
    page,
  }) => {
    // 1. Mở trang Arena
    await page.goto('/#arena-step-1');

    // 2. Nạp đề tài mẫu khởi nghiệp
    const demoBtn = page.locator('button:has-text("DÙNG ĐỀ TÀI MẪU")').first();
    await expect(demoBtn).toBeVisible({ timeout: 10000 });
    await demoBtn.click();

    // 3. Tiến vào Bước 2 (Sảnh đấu)
    const nextToStep2Btn = page
      .locator('button:has-text("TIẾP TỤC: SẢNH ĐẤU"), button:has-text("BƯỚC 02")')
      .first();
    await expect(nextToStep2Btn).toBeVisible({ timeout: 5000 });
    await nextToStep2Btn.click();

    // 4. Bước vào Bước 3: Thuyết minh Pitching
    const startPitchBtn = page
      .locator('button:has-text("BƯỚC VÀO PHẦN PITCHING"), button:has-text("BƯỚC 03")')
      .first();
    await expect(startPitchBtn).toBeVisible({ timeout: 5000 });
    await startPitchBtn.click();

    // 5. Kiểm tra các thành phần cốt lõi của Bước 3
    // - Tiêu đề Bước 3
    await expect(page.locator('text=THUYẾT MINH PITCHING')).toBeVisible({ timeout: 5000 });

    // - Đồng hồ đếm ngược và nhịp độ nói
    await expect(page.locator('text=THỜI GIAN TRÌNH BÀY')).toBeVisible();

    // - Nút chuyển chế độ Gõ phím
    const keyboardModeBtn = page.locator('button:has-text("GÕ PHÍM")');
    await expect(keyboardModeBtn).toBeVisible();
    await keyboardModeBtn.click();

    // - Khung Textarea nhập phím phải xuất hiện
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();

    // - Nút Nạp bài Pitch mẫu
    const demoPitchBtn = page.getByRole('button', { name: 'PITCH MẪU', exact: true }).first();
    await expect(demoPitchBtn).toBeVisible();
    await demoPitchBtn.click();

    // Kiểm tra textarea đã nhận nội dung
    const textValue = await textarea.inputValue();
    expect(textValue.length).toBeGreaterThan(20);

    // - Kiểm tra hiển thị số lượng ký tự / từ ở footer
    await expect(page.locator('text=ký tự')).toBeVisible();

    // 6. Hoàn thành bài Pitch để chuyển sang Bước 4 (Chất vấn)
    const finishPitchBtn = page.locator(
      'button:has-text("HOÀN THÀNH PITCHING"), button:has-text("BƯỚC 04")'
    );
    await expect(finishPitchBtn).toBeVisible();
    await finishPitchBtn.click();

    // Xác nhận đã vào Bước 4: Đấu trường Phản biện Combat
    await expect(
      page.locator('text=BƯỚC 04 // PHẢN BIỆN').first()
    ).toBeVisible({ timeout: 10000 });
  });

  /**
   * Test 2: Kiểm thử WebSocket Server In-Memory Graph & Tombstone Mutation Engine (Phase 3 Core)
   */
  test('WebSocket Graph Engine: Gửi stream chunk, xử lý Tombstone (OVERWRITE/CLARIFIES) và nhận s2c:pitch_graph_sync', async () => {
    const testSessionId = `test-phase3-${Date.now()}`;
    const testDocId = 'doc-test-phase3';

    // Khởi tạo kết nối Socket.IO tới NestJS Gateway
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

      // 2. Stream chunk 1: Phát biểu ý tưởng ban đầu
      const syncPromise1 = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
        socket.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, (data) => {
          resolve(data);
        });
      });

      socket.emit(ArenaSocketEvents.C2S_STREAM_PITCH_CHUNK, {
        sessionId: testSessionId,
        sequenceId: 1,
        text: 'Doanh thu năm đầu tiên dự kiến đạt 2 tỷ đồng',
        isFinalChunk: false,
        detectedMarkers: [],
        timestamp: Date.now(),
      });

      const sync1 = await syncPromise1;
      expect(sync1.sessionId).toBe(testSessionId);
      expect(sync1.activeNodesCount).toBeGreaterThanOrEqual(1);

      // 3. Stream chunk 2: Đính chính ghi đè (OVERWRITE_DIRECT -> SUPERSEDED + REPLACES edge)
      const syncPromise2 = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
        socket.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, (data) => {
          resolve(data);
        });
      });

      socket.emit(ArenaSocketEvents.C2S_STREAM_PITCH_CHUNK, {
        sessionId: testSessionId,
        sequenceId: 2,
        text: 'À không, chính xác doanh thu năm đầu là 3.5 tỷ đồng',
        isFinalChunk: false,
        detectedMarkers: [RetractionMarkerType.OVERWRITE_DIRECT],
        timestamp: Date.now() + 500,
      });

      const sync2 = await syncPromise2;
      expect(sync2.sessionId).toBe(testSessionId);
      // Khi có OVERWRITE_DIRECT: Node cũ bị SUPERSEDED và node mới ACTIVE
      // => Tổng số activeNodes vẫn giữ nguyên = 1 (không bị tăng vọt), và staging buffer tăng lên 2
      expect(sync2.activeNodesCount).toBe(1);
      expect(sync2.section6EntitiesCount).toBe(2);

      // 4. Stream chunk 3: Làm rõ (ELABORATION -> cả 2 node đều ACTIVE)
      const syncPromise3 = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
        socket.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, (data) => {
          resolve(data);
        });
      });

      socket.emit(ArenaSocketEvents.C2S_STREAM_PITCH_CHUNK, {
        sessionId: testSessionId,
        sequenceId: 3,
        text: 'Cụ thể chúng tôi phân phối qua 50 đại lý bán lẻ toàn quốc',
        isFinalChunk: false,
        detectedMarkers: [RetractionMarkerType.ELABORATION],
        timestamp: Date.now() + 1000,
      });

      const sync3 = await syncPromise3;
      // Khi có ELABORATION: Cả node gốc và node làm rõ đều ACTIVE => activeNodesCount tăng lên 2
      expect(sync3.activeNodesCount).toBe(2);
      expect(sync3.section6EntitiesCount).toBe(3);

      // 5. Kết thúc stream phát biểu (c2s:finalize_pitch_stream)
      const finalSyncPromise = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
        socket.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, (data) => {
          resolve(data);
        });
      });

      socket.emit(ArenaSocketEvents.C2S_FINALIZE_PITCH_STREAM, {
        sessionId: testSessionId,
        totalChunks: 3,
        fullRawTranscript:
          'Doanh thu năm đầu tiên dự kiến đạt 2 tỷ đồng À không, chính xác doanh thu năm đầu là 3.5 tỷ đồng Cụ thể chúng tôi phân phối qua 50 đại lý bán lẻ toàn quốc',
        durationSeconds: 30,
      });

      const finalSync = await finalSyncPromise;
      expect(finalSync.sessionId).toBe(testSessionId);
      expect(finalSync.activeNodesCount).toBeGreaterThanOrEqual(2);
      expect(finalSync.section6EntitiesCount).toBe(3);
    } finally {
      socket.disconnect();
    }
  });

  /**
   * Test 3: Kiểm thử tương tác Micro và chuyển đổi mượt mà sang chế độ Gõ phím
   */
  test('UI Mic Controls & Chế độ Gõ phím: Bật/Tắt Micro và nhập phím', async ({ page }) => {
    await page.goto('/#arena-step-1');

    // Nạp đề tài mẫu để vào nhanh
    const demoBtn = page.locator('button:has-text("DÙNG ĐỀ TÀI MẪU")').first();
    await demoBtn.click();

    const nextToStep2Btn = page
      .locator('button:has-text("TIẾP TỤC: SẢNH ĐẤU"), button:has-text("BƯỚC 02")')
      .first();
    await nextToStep2Btn.click();

    const startPitchBtn = page
      .locator('button:has-text("BƯỚC VÀO PHẦN PITCHING"), button:has-text("BƯỚC 03")')
      .first();
    await startPitchBtn.click();

    // Tìm nút Micro (BẬT MIC / DỪNG MIC)
    const micToggleBtn = page.locator('button:has-text("BẬT MIC"), button:has-text("DỪNG MIC")');
    await expect(micToggleBtn).toBeVisible({ timeout: 5000 });
    await expect(micToggleBtn).toBeEnabled();

    // Chuyển sang gõ phím
    const keyboardBtn = page.locator('button:has-text("GÕ PHÍM")').first();
    await keyboardBtn.click();

    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();
    await textarea.fill('Thuyết trình thử nghiệm bằng phím');
    await expect(textarea).toHaveValue('Thuyết trình thử nghiệm bằng phím');
  });
});
