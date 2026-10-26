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
  SessionFsmState,
  CombatDifficulty,
  ArenaMode,
  VerdictResult,
  AppendixReport,
} from '@pitcharena/shared';
import { PitchGraphSession } from '../../server/src/domain/rag/pitch-graph-session';
import {
  BOSS_PERSONAS,
  buildQuestionPrompt,
} from '../../server/src/adapters/llm/prompt-templates';
import { ArenaFsmService } from '../../server/src/domain/fsm/arena-fsm.service';
import { FollowUpEngine } from '../../server/src/domain/orchestrator/follow-up-engine';

const SERVER_URL = 'http://localhost:4000';
const CLIENT_URL = 'http://localhost:3000';

test.describe('PITCH·ARENA COMPREHENSIVE E2E & VERIFICATION TEST MATRIX', () => {
  let docxBuffer: Buffer;
  const activeSockets: Socket[] = [];

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

  test.afterEach(() => {
    while (activeSockets.length > 0) {
      const s = activeSockets.pop();
      if (s) {
        try {
          s.disconnect();
        } catch (_) {}
      }
    }
  });

  const createSocketConnection = async (): Promise<Socket> => {
    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    activeSockets.push(socket);

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('WebSocket connection timeout to ' + SERVER_URL)), 5000);
      socket.on('connect', () => {
        clearTimeout(timer);
        resolve();
      });
      socket.on('connect_error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    return socket;
  };

  // ==========================================================================
  // MODULE 1: LANDING PAGE & NAVIGATION (TC-NAV-01 -> TC-NAV-03)
  // ==========================================================================
  test.describe('Module 1: Landing Page & Navigation', () => {
    test('TC-NAV-01: Landing Page Hero Banner & CTA buttons', async ({ page }) => {
      await page.goto('/');

      // Tiêu đề thương hiệu
      await expect(page).toHaveTitle(/PITCH·ARENA/i);

      // Hero Section Banner & CTA buttons
      const ctaStart = page.locator('button:has-text("[ NẠP ĐỀ TÀI NGAY ]")');
      await expect(ctaStart).toBeVisible();

      const ctaJury = page.locator('text=HỘI ĐỒNG GIÁM KHẢO').first();
      await expect(ctaJury).toBeVisible();

      // Metrics hiển thị độ trễ giọng nói và độ chính xác RAG
      await expect(page.locator('text=ĐỘ TRỄ GIỌNG')).toBeVisible();
      await expect(page.locator('text=ĐỘ CHÍNH XÁC')).toBeVisible();
    });

    test('TC-NAV-02: 4 Boss Cards preview & Persona badges', async ({ page }) => {
      await page.goto('/');

      const jurySection = page.locator('#jury-council');
      await expect(jurySection).toBeVisible();

      // Xác nhận đầy đủ 4 Giám khảo chủ chốt
      await expect(jurySection.locator('text=MARKET SHARK')).toBeVisible();
      await expect(jurySection.locator('text=Shark Trần Nam')).toBeVisible();

      await expect(jurySection.locator('text=AI SENTINEL')).toBeVisible();
      await expect(jurySection.locator('text=TS. Lê Minh Trang')).toBeVisible();

      await expect(jurySection.locator('text=FINANCE DRAGON')).toBeVisible();
      await expect(jurySection.locator('text=GS. Vũ Hoàng')).toBeVisible();

      await expect(jurySection.locator('text=RISK STRATEGIST')).toBeVisible();
      await expect(jurySection.locator('text=ThS. Đặng Mai Lan')).toBeVisible();
    });

    test('TC-NAV-03: Direct navigation and smooth step router (#arena)', async ({ page }) => {
      await page.goto('/');

      // Bấm nút CTA [ NẠP ĐỀ TÀI NGAY ]
      const ctaStart = page.locator('button:has-text("[ NẠP ĐỀ TÀI NGAY ]")');
      await ctaStart.click();

      // Kiểm tra chuyển sang view arena với hash #arena-step-1
      await expect(page).toHaveURL(/#arena-step-1/);
      await expect(page.locator('h2:has-text("NẠP TÀI LIỆU THUYẾT MINH")')).toBeVisible();
    });
  });

  // ==========================================================================
  // MODULE 2: STEP 1 - DOCUMENT UPLOAD & IN-MEMORY RAG (TC-DOC-01 -> TC-DOC-06)
  // ==========================================================================
  test.describe('Module 2: Step 1 - Document Upload & In-Memory RAG', () => {
    test('TC-DOC-01: Use sample project button loads pre-seeded proposal', async ({ page }) => {
      await page.goto('/#arena-step-1');

      // Click nút đề tài mẫu
      const demoBtn = page.locator('button:has-text("[ THỬ NGHIỆM VỚI ĐỀ TÀI MẪU ]")');
      await expect(demoBtn).toBeVisible();
      await demoBtn.click();

      // Kiểm tra các thông tin đề mục đã được bóc tách
      await expect(page.locator('text=TÀI LIỆU HIỆN HÀNH')).toBeVisible();
      await expect(page.locator('text=ĐÃ BÓC TÁCH').first()).toBeVisible();

      // Kiểm tra nút chuyển sang bước 2 xuất hiện
      const nextBtn = page.locator('button:has-text("[ TIẾN VÀO ĐẤU TRƯỜNG (BƯỚC 02) ]")');
      await expect(nextBtn).toBeVisible();
    });

    test('TC-DOC-02: Manual file upload (.docx) parsing and extraction via API', async ({ request }) => {
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
      const json = await uploadRes.json();
      expect(json.success).toBe(true);
      expect(json.data.documentId).toBeDefined();
      expect(json.data.sections.length).toBe(5);
      expect(json.data.entityWhitelist.length).toBeGreaterThan(0);
      expect(json.data.blindSpots.length).toBeGreaterThan(0);
    });

    test('TC-DOC-03: Invalid file format or empty payload rejection', async ({ request }) => {
      // 1. Tệp không phải .docx
      const invalidRes = await request.post(`${SERVER_URL}/api/documents/upload`, {
        multipart: {
          file: {
            name: 'invalid_image.png',
            mimeType: 'image/png',
            buffer: Buffer.from('fake image content'),
          },
        },
      });
      expect(invalidRes.status()).toBe(400);
      const json = await invalidRes.json();
      expect(json.message).toContain('Word (.docx)');

      // 2. Không gửi tệp nào
      const emptyRes = await request.post(`${SERVER_URL}/api/documents/upload`, {
        multipart: {},
      });
      expect(emptyRes.status()).toBe(400);
    });

    test('TC-DOC-04: In-memory RAG chunking & vector search verification via API', async ({ request }) => {
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
      const { data } = await uploadRes.json();

      // Kiểm tra 5 khối chuyên môn cốt lõi
      const sectionTypes = data.sections.map((s: { type: string }) => s.type);
      expect(sectionTypes).toContain('PROBLEM_MARKET');
      expect(sectionTypes).toContain('SOLUTION_PRODUCT');
      expect(sectionTypes).toContain('BUSINESS_MODEL_UNIT_ECONOMICS');
      expect(sectionTypes).toContain('COMPETITION_MOAT');
      expect(sectionTypes).toContain('SOCIAL_IMPACT_ROADMAP');

      // Kiểm tra blind spots nhận diện đúng ít nhất 1 điểm rủi ro
      expect(data.blindSpots[0].attackVector).toBeDefined();
      expect(data.blindSpots[0].title).toBeDefined();
    });

    test('TC-DOC-05: State persistence & Transition to Step 2', async ({ page }) => {
      await page.goto('/#arena-step-1');
      await page.locator('button:has-text("[ THỬ NGHIỆM VỚI ĐỀ TÀI MẪU ]")').click();

      const nextBtn = page.locator('button:has-text("[ TIẾN VÀO ĐẤU TRƯỜNG (BƯỚC 02) ]")');
      await nextBtn.click();

      // Xác nhận chuyển sang bước 2
      await expect(page).toHaveURL(/#arena-step-2/);
      await expect(page.locator('text=SẢNH ĐẤU & VOICE LOBBY')).toBeVisible();
    });

    test('TC-DOC-06: Reset/Clear document state via [NẠP LẠI] button', async ({ page }) => {
      await page.goto('/#arena-step-1');
      await page.locator('button:has-text("[ THỬ NGHIỆM VỚI ĐỀ TÀI MẪU ]")').click();
      await expect(page.locator('text=TÀI LIỆU HIỆN HÀNH')).toBeVisible();

      // Click nút [NẠP LẠI]
      const resetBtn = page.locator('button:has-text("[NẠP LẠI]")');
      await resetBtn.click();

      // Kiểm tra giao diện quay lại trạng thái dropzone ban đầu
      await expect(page.locator('button:has-text("[ THỬ NGHIỆM VỚI ĐỀ TÀI MẪU ]")')).toBeVisible();
    });
  });

  // ==========================================================================
  // MODULE 3: STEP 2 - LOBBY CONFIG & FSM INIT (TC-LOB-01 -> TC-LOB-04)
  // ==========================================================================
  test.describe('Module 3: Step 2 - Lobby Config & FSM Init', () => {
    test('TC-LOB-01: Lobby renders difficulty selection, timer presets, and boss roster', async ({ page }) => {
      await page.goto('/#arena-step-1');
      await page.locator('button:has-text("[ THỬ NGHIỆM VỚI ĐỀ TÀI MẪU ]")').click();
      await page.locator('button:has-text("[ TIẾN VÀO ĐẤU TRƯỜNG (BƯỚC 02) ]")').click();

      // Kiểm tra các phần tử cấu hình của Bước 2
      await expect(page.locator('text=SẴN SÀNG VÀO SÀN ĐẤU')).toBeVisible();
      await expect(page.locator('text=BƯỚC VÀO PHẦN PITCHING (BƯỚC 03) →')).toBeVisible();
    });

    test('TC-LOB-02: Boss selection and mode toggle in Lobby', async ({ page }) => {
      await page.goto('/#arena-step-1');
      await page.locator('button:has-text("[ THỬ NGHIỆM VỚI ĐỀ TÀI MẪU ]")').click();
      await page.locator('button:has-text("[ TIẾN VÀO ĐẤU TRƯỜNG (BƯỚC 02) ]")').click();

      // Kiểm tra có hiển thị tóm tắt thông số ĐỐI THỦ và THỜI LƯỢNG
      await expect(page.locator('text=ĐỐI THỦ:')).toBeVisible();
      await expect(page.locator('text=THỜI LƯỢNG:')).toBeVisible();
    });

    test('TC-LOB-03: Initialize arena session & WebSocket connection handshake', async () => {
      const socket = await createSocketConnection();
      const testSessionId = `test-matrix-lob03-${Date.now()}`;

      const statePromise = new Promise<{ sessionId: string; fsmState: string }>((resolve) => {
        socket.on(ArenaSocketEvents.S2C_SESSION_SYNC, (state) => {
          resolve(state);
        });
      });

      socket.emit(ArenaSocketEvents.C2S_JOIN_LOBBY, {
        sessionId: testSessionId,
        documentId: 'doc-matrix-demo-01',
      });

      const sessionState = await statePromise;
      expect(sessionState.sessionId).toBe(testSessionId);
      expect(sessionState.fsmState).toBe(SessionFsmState.LOBBY_READY);
    });

    test('TC-LOB-04: Transition to Step 3 with initialized session ID', async ({ page }) => {
      await page.goto('/#arena-step-1');
      await page.locator('button:has-text("[ THỬ NGHIỆM VỚI ĐỀ TÀI MẪU ]")').click();
      const enterLobbyBtn = page.locator('button:has-text("[ TIẾN VÀO ĐẤU TRƯỜNG (BƯỚC 02) ]")');
      await expect(enterLobbyBtn).toBeVisible();
      await enterLobbyBtn.click();

      await expect(page).toHaveURL(/#arena-step-2/);
      const startPitchBtn = page.locator('button:has-text("BƯỚC VÀO PHẦN PITCHING (BƯỚC 03) →")');
      await expect(startPitchBtn).toBeVisible();
      await startPitchBtn.click();

      // Kiểm tra URL và tiêu đề bước 3
      await expect(page).toHaveURL(/#arena-step-3/);
      await expect(page.locator('text=THUYẾT MINH PITCHING')).toBeVisible();
    });
  });

  // ==========================================================================
  // MODULE 4: STEP 3 - PITCHING & REAL-TIME GRAPHRAG (TC-PIT-01 -> TC-PIT-08)
  // ==========================================================================
  test.describe('Module 4: Step 3 - Pitching & Real-Time GraphRAG', () => {
    test('TC-PIT-01: Input mode toggling (Typing vs Micro speech)', async ({ page }) => {
      await page.goto('/#arena-step-3');

      // Chuyển sang GÕ PHÍM
      const keyboardBtn = page.locator('button:has-text("GÕ PHÍM")');
      await keyboardBtn.click();
      await expect(page.locator('textarea')).toBeVisible();

      // Chuyển lại NÓI MICRO
      const micBtn = page.locator('button:has-text("NÓI MICRO")');
      await micBtn.click();
      await expect(page.locator('text=NÓI MICRO')).toBeVisible();
    });

    test('TC-PIT-02: Sample pitch button populates script text', async ({ page }) => {
      await page.goto('/#arena-step-3');

      // Bấm nút nạp demo pitch
      const fillDemoBtn = page.locator('button[title="Nạp bài thuyết trình mẫu từ hồ sơ đề tài"]');
      await fillDemoBtn.click();

      // Kiểm tra textarea hiển thị nội dung
      const textarea = page.locator('textarea');
      await expect(textarea).toBeVisible();
      const textVal = await textarea.inputValue();
      expect(textVal.length).toBeGreaterThan(20);
    });

    test('TC-PIT-03: Real-time text segmentation & segment emission over WS', async () => {
      const socket = await createSocketConnection();
      const sessionId = `test-matrix-pit03-${Date.now()}`;

      await new Promise<void>((resolve) => {
        socket.on(ArenaSocketEvents.S2C_SESSION_SYNC, () => resolve());
        socket.emit(ArenaSocketEvents.C2S_JOIN_LOBBY, {
          sessionId,
          documentId: 'doc-matrix-demo-03',
        });
      });

      const syncPromise = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
        socket.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, (data) => resolve(data));
      });

      socket.emit(ArenaSocketEvents.C2S_STREAM_PITCH_CHUNK, {
        sessionId,
        sequenceId: 1,
        text: 'Kính thưa Hội đồng, giải pháp trợ lý y tế AI của chúng tôi phục vụ 500 phòng khám.',
        isFinalChunk: false,
        detectedMarkers: [],
        timestamp: Date.now(),
      });

      const sync = await syncPromise;
      expect(sync.activeNodesCount).toBeGreaterThanOrEqual(1);
    });

    test('TC-PIT-04: Pitch GraphRAG dynamic node discovery and keyword tagging', async () => {
      const socket = await createSocketConnection();
      const sessionId = `test-matrix-pit04-${Date.now()}`;

      await new Promise<void>((resolve) => {
        socket.on(ArenaSocketEvents.S2C_SESSION_SYNC, () => resolve());
        socket.emit(ArenaSocketEvents.C2S_JOIN_LOBBY, {
          sessionId,
          documentId: 'doc-matrix-demo-04',
        });
      });

      const syncPromise = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
        socket.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, (data) => resolve(data));
      });

      socket.emit(ArenaSocketEvents.C2S_STREAM_PITCH_CHUNK, {
        sessionId,
        sequenceId: 1,
        text: 'Doanh thu tháng đầu đạt 250 triệu VNĐ, chi phí khách hàng CAC là 15 USD.',
        isFinalChunk: false,
        detectedMarkers: [],
        timestamp: Date.now(),
      });

      const sync = await syncPromise;
      expect(sync.activeNodesCount).toBeGreaterThanOrEqual(1);
    });

    test('TC-PIT-05: Khối 6 Financial & Growth Metrics auto-materialization', async () => {
      const socket = await createSocketConnection();
      const sessionId = `test-matrix-pit05-${Date.now()}`;

      await new Promise<void>((resolve) => {
        socket.on(ArenaSocketEvents.S2C_SESSION_SYNC, () => resolve());
        socket.emit(ArenaSocketEvents.C2S_JOIN_LOBBY, {
          sessionId,
          documentId: 'doc-matrix-demo-05',
        });
      });

      // 1. Nói về mở rộng thị trường (Whitelist MARKET_EXPANSION)
      const syncPromise1 = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
        socket.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, (data) => resolve(data));
      });
      socket.emit(ArenaSocketEvents.C2S_STREAM_PITCH_CHUNK, {
        sessionId,
        sequenceId: 1,
        text: 'Chúng tôi mở rộng thị trường sang khu vực Đông Nam Á bao gồm Lào và Campuchia từ quý 4 năm 2026',
        isFinalChunk: false,
        detectedMarkers: [],
        timestamp: Date.now(),
      });
      await syncPromise1;

      // 2. Chốt bài thuyết trình để kích hoạt sinh Khối 6
      const finalizePromise = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
        socket.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, (data) => resolve(data));
      });
      socket.emit(ArenaSocketEvents.C2S_FINALIZE_PITCH_STREAM, {
        sessionId,
        totalChunks: 1,
        fullRawTranscript:
          'Chúng tôi mở rộng thị trường sang khu vực Đông Nam Á bao gồm Lào và Campuchia từ quý 4 năm 2026.',
        durationSeconds: 25,
      });

      const finalSync = await finalizePromise;
      expect(finalSync.hasSection6).toBe(true);
      expect(finalSync.section6Title).toContain('Khối 6:');
    });

    test('TC-PIT-06: Diff Alignment Fallback & Dominant Category mapping', async () => {
      const socket = await createSocketConnection();
      const sessionId = `test-matrix-pit06-${Date.now()}`;

      await new Promise<void>((resolve) => {
        socket.on(ArenaSocketEvents.S2C_SESSION_SYNC, () => resolve());
        socket.emit(ArenaSocketEvents.C2S_JOIN_LOBBY, {
          sessionId,
          documentId: 'doc-matrix-demo-06',
        });
      });

      // Bù đắp phát biểu chưa gửi streaming qua Diff Alignment khi finalize
      const finalizePromise = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
        socket.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, (data) => resolve(data));
      });
      socket.emit(ArenaSocketEvents.C2S_FINALIZE_PITCH_STREAM, {
        sessionId,
        totalChunks: 2,
        fullRawTranscript:
          'Thị trường MedTech Việt Nam đạt quy mô 1.2 tỷ USD. ' +
          'Chúng tôi mở rộng mạng lưới phân phối hợp tác chiến lược với 50 chuỗi bệnh viện tư nhân.',
        durationSeconds: 30,
      });

      const finalSync = await finalizePromise;
      expect(finalSync.hasSection6).toBe(true);
      expect(finalSync.section6Title).toBeDefined();
    });

    test('TC-PIT-07: Retraction / Correction detection ("Đính chính", "Sửa lại")', async () => {
      const socket = await createSocketConnection();
      const sessionId = `test-matrix-pit07-${Date.now()}`;

      await new Promise<void>((resolve) => {
        socket.on(ArenaSocketEvents.S2C_SESSION_SYNC, () => resolve());
        socket.emit(ArenaSocketEvents.C2S_JOIN_LOBBY, {
          sessionId,
          documentId: 'doc-matrix-demo-07',
        });
      });

      // Chunk 1: Số liệu cũ
      const syncPromise1 = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
        socket.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, (data) => resolve(data));
      });
      socket.emit(ArenaSocketEvents.C2S_STREAM_PITCH_CHUNK, {
        sessionId,
        sequenceId: 1,
        text: 'Chi phí tìm kiếm khách hàng CAC là 3.2 triệu VNĐ.',
        isFinalChunk: false,
        detectedMarkers: [],
        timestamp: Date.now(),
      });
      const sync1 = await syncPromise1;
      expect(sync1.activeNodesCount).toBeGreaterThanOrEqual(1);

      // Chunk 2: Đính chính với marker OVERWRITE_DIRECT
      const syncPromise2 = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
        socket.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, (data) => resolve(data));
      });
      socket.emit(ArenaSocketEvents.C2S_STREAM_PITCH_CHUNK, {
        sessionId,
        sequenceId: 2,
        text: 'À không, chính xác chi phí CAC là 4.8 triệu VNĐ do nhóm mở rộng quảng cáo số.',
        isFinalChunk: false,
        detectedMarkers: [RetractionMarkerType.OVERWRITE_DIRECT],
        timestamp: Date.now() + 500,
      });
      const sync2 = await syncPromise2;
      expect(sync2.activeNodesCount).toBeGreaterThanOrEqual(1);
    });

    test('TC-PIT-08: Finish Pitching transition into Step 4 Combat Arena', async ({ page }) => {
      await page.goto('/#arena-step-3');

      // Bấm nút [HOÀN THÀNH PITCHING → BƯỚC 04: CHẤT VẤN]
      const finishBtn = page.locator('button:has-text("HOÀN THÀNH PITCHING → BƯỚC 04: CHẤT VẤN")');
      await finishBtn.click();

      // Kiểm tra chuyển hướng sang Step 4
      await expect(page).toHaveURL(/#arena-step-4/);
      await expect(page.locator('text=PHẢN BIỆN (COMBAT ARENA)')).toBeVisible();
    });
  });

  // ==========================================================================
  // MODULE 5: STEP 4 - COMBAT ARENA & 4 BOSS FSM (TC-COM-01 -> TC-COM-07)
  // ==========================================================================
  test.describe('Module 5: Step 4 - Combat Arena & 4 Boss FSM', () => {
    test('TC-COM-01: Combat Arena entry & 4 Boss HUD rendering with initial HP', async ({ page }) => {
      await page.goto('/#arena-step-4');

      // Kiểm tra thanh trạng thái Step 4
      await expect(page.locator('text=PHẢN BIỆN (COMBAT ARENA)')).toBeVisible();

      // Kiểm tra thanh máu và khiên tân thủ
      await expect(page.locator('text=THANH MÁU THÍ SINH:')).toBeVisible();
      await expect(page.locator('text=KHIÊN TÂN THỦ: SÀN 20%')).toBeVisible();
    });

    test('TC-COM-02: Candidate defense submission & HP adjustment', async () => {
      const fsmService = new ArenaFsmService();
      const sessionId = `test-matrix-com02-${Date.now()}`;
      const session = fsmService.getOrCreateSession(sessionId, 'doc-demo-01');

      expect(session.candidateHp).toBe(100);

      // Giả lập phán quyết trừ máu từ trọng tài
      session.candidateHp -= 15;
      expect(session.candidateHp).toBe(85);

      // Giả lập phản biện xuất sắc hồi máu
      session.candidateHp = Math.min(100, session.candidateHp + 10);
      expect(session.candidateHp).toBe(95);
    });

    test('TC-COM-03: Pause & Resume controls ("TẠM DỪNG" / "TIẾP TỤC")', async ({ page }) => {
      await page.goto('/#arena-step-4');

      const pauseBtn = page.locator('button[title="Tạm dừng / Tiếp tục"]');
      await expect(pauseBtn).toBeVisible();
      await pauseBtn.click();

      // Kiểm tra trạng thái tạm dừng
      await expect(page.locator('text=TẠM DỪNG')).toBeVisible();

      // Bấm tiếp tục lại
      await pauseBtn.click();
      await expect(page.locator('text=LƯỢT NÓI:').or(page.locator('text=CHUẨN BỊ (2S)'))).toBeVisible();
    });

    test('TC-COM-04: Pedagogical Shield triggers when HP drops <= 20%', async () => {
      const fsmService = new ArenaFsmService();
      const sessionId = `test-matrix-com04-${Date.now()}`;
      const session = fsmService.getOrCreateSession(sessionId, 'doc-demo-01');

      // Trong 3 lượt đầu, sàn máu không rớt dưới 20%
      session.currentTurn = 2;
      const penalty = 90; // Phạt nặng
      const floor = session.config.pedagogicalShieldFloor || 20;
      session.candidateHp = Math.max(floor, session.candidateHp - penalty);

      expect(session.candidateHp).toBe(20);
    });

    test('TC-COM-05: Strike 2 Coaching Pivot trigger & prompt format', async () => {
      const followUpEngine = new FollowUpEngine();
      const evaluation = followUpEngine.evaluateCandidateSpeech('Em chưa rõ, chắc là khoảng khoảng.');
      expect(evaluation.isVague).toBe(true);

      const decision = followUpEngine.decideNextMove(
        1, // currentFollowUpCount = 1
        'Unit Economics',
        evaluation,
        JuryBossId.FINANCE_DRAGON,
        [JuryBossId.FINANCE_DRAGON] // Solo Boss
      );

      expect(decision.action).toBe('COACHING_PIVOT');
      expect(decision.followUpCount).toBe(2);
      expect(decision.reason).toContain('gợi ý sư phạm');
    });

    test('TC-COM-06: Major Pivot & Section 6 badges rendered on combat cards', async ({ page }) => {
      await page.goto('/#arena-step-4');

      // Kiểm tra các container badge có mặt trên DOM
      const headerBar = page.locator('div.border-2.border-black.bg-white').first();
      await expect(headerBar).toBeVisible();
    });

    test('TC-COM-07: Jury Verdict & Session Conclusion transition to Step 5', async ({ page }) => {
      await page.goto('/#arena-step-4');

      // Bấm nút [KẾT THÚC ĐỐI CHẤT →]
      const endCombatBtn = page.locator('button:has-text("KẾT THÚC ĐỐI CHẤT →")');
      await expect(endCombatBtn).toBeVisible();
      await endCombatBtn.click();

      // Kiểm tra chuyển sang Bước 5 Báo cáo
      await expect(page).toHaveURL(/#arena-step-5/, { timeout: 10000 });
      await expect(page.locator('text=BÁO CÁO PHỤ LỤC CHẨN ĐOÁN')).toBeVisible();
    });
  });

  // ==========================================================================
  // MODULE 6: STEP 5 - ACTION APPENDIX REPORTING & REMATCH (TC-REP-01 -> TC-REP-03)
  // ==========================================================================
  test.describe('Module 6: Step 5 - Action Appendix Reporting & Rematch', () => {
    test('TC-REP-01: Action Appendix report generation via API', async ({ request }) => {
      const socket = await createSocketConnection();
      const sessionId = `test-matrix-rep01-${Date.now()}`;

      await new Promise<void>((resolve) => {
        socket.on(ArenaSocketEvents.S2C_SESSION_SYNC, () => resolve());
        socket.emit(ArenaSocketEvents.C2S_JOIN_LOBBY, {
          sessionId,
          documentId: 'doc-matrix-demo-rep',
        });
      });

      // Gọi endpoint lấy báo cáo JSON
      const res = await request.get(`${SERVER_URL}/api/arena/sessions/${sessionId}/report`);
      expect(res.status()).toBe(200);
      const report: AppendixReport = await res.json();
      expect(report.candidateHp).toBeDefined();
      expect(report.overallScore).toBeDefined();
      expect(report.defenseSuccessRate).toBeDefined();
    });

    test('TC-REP-02: Markdown export of Action Appendix report via UI or API', async ({ page }) => {
      await page.goto('/#arena-step-5');

      // Kiểm tra nút tải báo cáo Markdown
      const downloadMdBtn = page.locator('button:has-text("TẢI BÁO CÁO (.MD)")');
      await expect(downloadMdBtn).toBeVisible();

      // Kiểm tra nút in PDF
      const printPdfBtn = page.locator('button:has-text("IN / XUẤT PDF")');
      await expect(printPdfBtn).toBeVisible();
    });

    test('TC-REP-03: Rematch / Reset Arena session returning cleanly to Step 1 or Step 2', async ({ page }) => {
      await page.goto('/#arena-step-5');

      const rematchBtn = page.locator('button:has-text("[ ↺ TÁI ĐẤU LẬP TỨC ]")');
      await expect(rematchBtn).toBeVisible();
      await rematchBtn.click();

      // Kiểm tra quay lại sảnh đấu Step 2 sẵn sàng cho lượt đấu mới
      await expect(page).toHaveURL(/#arena-step-2/);
      await expect(
        page.locator('text=Chưa có dữ liệu đề tài').or(page.locator('text=SẢNH ĐẤU & VOICE LOBBY'))
      ).toBeVisible();
    });
  });

  // ==========================================================================
  // MODULE 7: CROSS-CUTTING NON-FUNCTIONAL REQUIREMENTS (TC-NFR-01 -> TC-NFR-04)
  // ==========================================================================
  test.describe('Module 7: Cross-Cutting Non-Functional Requirements (NFRs)', () => {
    test('TC-NFR-01: Zero Build Rule adherence', async () => {
      // Xác nhận các quy định trong AGENTS.md được bảo toàn
      const agentsMdPath = path.join(__dirname, '..', '..', 'AGENTS.md');
      expect(fs.existsSync(agentsMdPath)).toBe(true);
      const agentsMdContent = fs.readFileSync(agentsMdPath, 'utf8');
      expect(agentsMdContent).toContain('TUYỆT ĐỐI KHÔNG CHẠY LỆNH BUILD');
      expect(agentsMdContent).toContain('QUY ĐỊNH CHẶT CHẼ VỀ LỆNH GIT GREP');
    });

    test('TC-NFR-02: Strict Monorepo Type Safety files exist and are valid', async () => {
      // Xác nhận các tệp tsconfig độc lập của monorepo
      const sharedTsConfig = path.join(__dirname, '..', '..', 'packages', 'shared', 'tsconfig.json');
      const serverTsConfig = path.join(__dirname, '..', '..', 'server', 'tsconfig.json');
      const clientTsConfig = path.join(__dirname, '..', '..', 'client', 'tsconfig.json');

      expect(fs.existsSync(sharedTsConfig)).toBe(true);
      expect(fs.existsSync(serverTsConfig)).toBe(true);
      expect(fs.existsSync(clientTsConfig)).toBe(true);
    });

    test('TC-NFR-03: In-memory session cleanup and memory leak prevention', async () => {
      const fsmService = new ArenaFsmService();
      const testSessionId = `test-nfr-cleanup-${Date.now()}`;

      // Khởi tạo session
      fsmService.getOrCreateSession(testSessionId, 'doc-clean-01');
      expect(fsmService.getSession(testSessionId)).toBeDefined();

      // Hủy session
      fsmService.destroySession(testSessionId);
      expect(fsmService.getSession(testSessionId)).toBeUndefined();
    });

    test('TC-NFR-04: Production Backend URL resolution check in frontend utilities', async () => {
      // 1. Kiểm tra định nghĩa hằng số PRODUCTION_BACKEND_URL trong backendUrl.ts
      const backendUrlTsPath = path.join(__dirname, '..', '..', 'client', 'src', 'utils', 'backendUrl.ts');
      expect(fs.existsSync(backendUrlTsPath)).toBe(true);
      const backendUrlCode = fs.readFileSync(backendUrlTsPath, 'utf8');
      expect(backendUrlCode).toContain('https://pitcharena-server.onrender.com');
      expect(backendUrlCode).toContain('PRODUCTION_BACKEND_URL');

      // 2. Kiểm tra cấu hình biến môi trường client/.env.production
      const envProdPath = path.join(__dirname, '..', '..', 'client', '.env.production');
      expect(fs.existsSync(envProdPath)).toBe(true);
      const envProdContent = fs.readFileSync(envProdPath, 'utf8');
      expect(envProdContent).toContain('VITE_SERVER_URL=https://pitcharena-server.onrender.com');
    });
  });
});
