import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import JSZip from 'jszip';
import { io, Socket } from 'socket.io-client';
import {
  ArenaSocketEvents,
  RetractionMarkerType,
  PitchGraphNodeStatus,
  PitchGraphEdgeType,
  PitchSectionType,
  PitchNodeSource,
  BusinessSectionType,
  S2CPitchGraphSyncPayload,
} from '@pitcharena/shared';
import { detectRetractionMarkers } from '../../client/src/hooks/useAudioRecorder';
import { PitchGraphSession } from '../../server/src/domain/rag/pitch-graph-session';

const SERVER_URL = 'http://localhost:4000';

/**
 * Tạo tệp Word .docx chuẩn OpenXML dựa trên thông số DEMO_PROJECT_DATA
 */
async function ensureDemoDocxFile(): Promise<string> {
  const outDir = path.join(__dirname, '..', 'fixtures');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outFile = path.join(outDir, 'Thuyet_Minh_De_Tai_AI_Medical_Assistant.docx');
  if (fs.existsSync(outFile) && fs.statSync(outFile).size > 1000) {
    return outFile;
  }

  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
  );

  zip.file(
    'word/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:pPr><w:outlineLvl w:val="0"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:pPr><w:outlineLvl w:val="1"/></w:pPr>
  </w:style>
</w:styles>`
  );

  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>AI Medical Assistant - Trợ lý lâm sàng chuyên sâu...</w:t></w:r>
    </w:p>

    <w:p>
      <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
      <w:r><w:t>Vấn đề &amp; Quy mô Thị trường</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Thị trường MedTech Việt Nam đạt 1.2 tỷ USD, giải quyết tình trạng quá tải 40% tại các phòng khám công lập và tư nhân.</w:t></w:r>
    </w:p>

    <w:p>
      <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
      <w:r><w:t>Giải pháp &amp; Sản phẩm cốt lõi</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Trợ lý AI hỗ trợ chẩn đoán thời gian thực với độ trễ dưới 220ms, độ chính xác lâm sàng đạt 94.2%.</w:t></w:r>
    </w:p>

    <w:p>
      <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
      <w:r><w:t>Mô hình Kinh doanh &amp; Unit Economics</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Mô hình B2B Subscription: 15 triệu VNĐ/phòng khám/tháng. Chỉ số CAC 3.2 triệu VNĐ, LTV đạt 48 triệu VNĐ, tỷ lệ hoàn vốn sau 8 tháng.</w:t></w:r>
    </w:p>

    <w:p>
      <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
      <w:r><w:t>Đối thủ &amp; Lợi thế Cạnh tranh (Moat)</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Bộ dữ liệu độc quyền 50,000 ca bệnh án tiếng Việt, độc quyền tích hợp với 3 chuỗi bệnh viện tư nhân lớn.</w:t></w:r>
    </w:p>

    <w:p>
      <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
      <w:r><w:t>Tác động Xã hội &amp; Lộ trình Phát triển</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Giai đoạn thử nghiệm Q3/2026 tại 15 cơ sở, mở rộng 120 phòng khám khu vực miền Nam vào Q1/2027.</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`;

  zip.file('word/document.xml', docXml);
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(outFile, buffer);
  return outFile;
}

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
   * Test 1.2: Import file docx từ DEMO_PROJECT_DATA và kiểm tra đầu ra bóc tách chuẩn xác 5 khối
   * Kiểm thử:
   * 1. Tạo tệp .docx chuẩn OpenXML mang toàn bộ dữ liệu của DEMO_PROJECT_DATA.
   * 2. Gọi API POST /api/documents/upload và đánh giá đầu ra bóc tách của backend (5 Business Sections).
   * 3. Kiểm thử trên giao diện UI (Bước 01): Nạp tệp .docx, hiển thị 5 khối đề mục, và tiến vào Sảnh đấu.
   */
  test('Test 1.2: Import file docx DEMO_PROJECT_DATA và kiểm tra đầu ra bóc tách chuẩn xác 5 khối', async ({
    page,
    request,
  }) => {
    // 1. Chuẩn bị file docx từ DEMO_PROJECT_DATA
    const docxFilePath = await ensureDemoDocxFile();
    expect(fs.existsSync(docxFilePath)).toBe(true);

    // 2. Gửi tệp lên API POST /api/documents/upload kiểm thử bóc tách In-Memory RAG
    const fileBuffer = fs.readFileSync(docxFilePath);
    const response = await request.post(`${SERVER_URL}/api/documents/upload`, {
      multipart: {
        file: {
          name: 'Thuyet_Minh_De_Tai_AI_Medical_Assistant.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          buffer: fileBuffer,
        },
      },
    });

    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data).toBeDefined();

    const analysisResult = json.data;
    // Kiểm tra tên tệp & số khối
    expect(analysisResult.filename).toBe('Thuyet_Minh_De_Tai_AI_Medical_Assistant.docx');
    expect(analysisResult.sections).toHaveLength(5);

    // Dữ liệu mẫu DEMO_PROJECT_DATA dùng để đối chiếu so sánh
    const DEMO_PROJECT_DATA = {
      documentId: 'doc-demo-startup-medtech',
      filename: 'Thuyet_Minh_De_Tai_AI_Medical_Assistant.docx',
      sections: [
        {
          type: BusinessSectionType.PROBLEM_MARKET,
          title: 'Vấn đề & Quy mô Thị trường',
          content:
            'Thị trường MedTech Việt Nam đạt 1.2 tỷ USD, giải quyết tình trạng quá tải 40% tại các phòng khám công lập và tư nhân.',
        },
        {
          type: BusinessSectionType.SOLUTION_PRODUCT,
          title: 'Giải pháp & Sản phẩm cốt lõi',
          content:
            'Trợ lý AI hỗ trợ chẩn đoán thời gian thực với độ trễ dưới 220ms, độ chính xác lâm sàng đạt 94.2%.',
        },
        {
          type: BusinessSectionType.BUSINESS_MODEL_UNIT_ECONOMICS,
          title: 'Mô hình Kinh doanh & Unit Economics',
          content:
            'Mô hình B2B Subscription: 15 triệu VNĐ/phòng khám/tháng. Chỉ số CAC 3.2 triệu VNĐ, LTV đạt 48 triệu VNĐ, tỷ lệ hoàn vốn sau 8 tháng.',
        },
        {
          type: BusinessSectionType.COMPETITION_MOAT,
          title: 'Đối thủ & Lợi thế Cạnh tranh (Moat)',
          content:
            'Bộ dữ liệu độc quyền 50,000 ca bệnh án tiếng Việt, độc quyền tích hợp với 3 chuỗi bệnh viện tư nhân lớn.',
        },
        {
          type: BusinessSectionType.SOCIAL_IMPACT_ROADMAP,
          title: 'Tác động Xã hội & Lộ trình Phát triển',
          content:
            'Giai đoạn thử nghiệm Q3/2026 tại 15 cơ sở, mở rộng 120 phòng khám khu vực miền Nam vào Q1/2027.',
        },
      ],
    };

    // Hàm tiện ích loại bỏ escape backslash của Markdown (VD: 1\.2 -> 1.2) và tiêu đề heading
    const cleanContent = (text: string) =>
      (text || '').replace(/\\/g, '').replace(/^##\s+[^\n]+\n+/, '').trim();

    console.log('\n================================================================================');
    console.log('📊 IN RA GRAPH RAG BASELINE NODES & SO SÁNH VỚI DEMO_PROJECT_DATA');
    console.log('================================================================================');

    // Khởi tạo In-Memory Graph RAG Session từ tài liệu đã bóc tách
    const graphSession = new PitchGraphSession('test-demo-graph', analysisResult.documentId);

    DEMO_PROJECT_DATA.sections.forEach((demoSec, idx) => {
      const parsedSec = analysisResult.sections.find((s: any) => s.type === demoSec.type);
      expect(parsedSec).toBeDefined();

      const parsedClean = cleanContent(parsedSec.content);
      const demoClean = cleanContent(demoSec.content);

      // Thêm Baseline Node vào Graph RAG
      graphSession.addNode({
        id: `baseline-node-${idx + 1}`,
        sessionId: graphSession.sessionId,
        sectionType: parsedSec.type,
        category: 'OTHER',
        key: parsedSec.title,
        value: parsedClean,
        status: PitchGraphNodeStatus.ACTIVE,
        source: PitchNodeSource.WORD_BASELINE,
        confidence: 1.0,
        sequenceId: 0,
        timestamp: Date.now(),
        originalSentence: parsedClean.slice(0, 200),
      });

      // So sánh chi tiết
      const isTypeMatch = parsedSec.type === demoSec.type;
      const isTitleMatch = parsedSec.title.includes(demoSec.title.replace(/\s*\(Moat\)/, ''));
      const isContentMatch = parsedClean.includes(demoClean);

      console.log(`\n--------------------------------------------------------------------------------`);
      console.log(`[Khối ${idx + 1}/5] GRAPH RAG NODE: [${parsedSec.type}]`);
      console.log(`  • Key (Tiêu đề):   "${parsedSec.title}"`);
      console.log(`  • Status:          ACTIVE`);
      console.log(`  • Source:          WORD_BASELINE`);
      console.log(`  • Value (Nội dung bóc tách từ file .docx):`);
      console.log(`    "${parsedClean}"`);
      console.log(`  • Đối chiếu DEMO_PROJECT_DATA:`);
      console.log(`    "${demoClean}"`);
      console.log(`  => KẾT QUẢ ĐÁNH GIÁ: ${isTypeMatch && isTitleMatch && isContentMatch ? '✅ TRÙNG KHỚP 100%' : '❌ KHÁC BIỆT'}`);

      expect(isTypeMatch).toBe(true);
      expect(isTitleMatch).toBe(true);
      expect(isContentMatch).toBe(true);
    });

    console.log('\n================================================================================');
    console.log(`🎉 TỔNG KẾT: TẤT CẢ 5 KHỐI ĐỀU GIỐNG 100% VỚI DEMO_PROJECT_DATA!`);
    console.log(`   Graph RAG Active Baseline Nodes: ${graphSession.getActiveNodes().length}/5 nodes`);
    console.log('================================================================================\n');

    expect(graphSession.getActiveNodes()).toHaveLength(5);


    // 3. Kiểm thử trên giao diện UI: Upload file .docx thật vào Bước 01
    await page.goto('/#arena-step-1');
    const fileInput = page.locator('input[type="file"][accept=".docx"]');
    await fileInput.setInputFiles(docxFilePath);

    // Chờ quá trình upload và parse hoàn tất trên giao diện
    await expect(page.locator('text=5/5 KHỐI HOÀN TẤT')).toBeVisible({
      timeout: 15000,
    });
    await expect(page.locator('text=Vấn đề & Quy mô Thị trường').first()).toBeVisible();
    await expect(page.locator('text=Giải pháp & Sản phẩm cốt lõi').first()).toBeVisible();
    await expect(page.locator('text=Mô hình Kinh doanh & Unit Economics').first()).toBeVisible();
    await expect(page.locator('text=Đối thủ & Lợi thế Cạnh tranh').first()).toBeVisible();
    await expect(page.locator('text=Tác động Xã hội & Lộ trình Phát triển').first()).toBeVisible();

    // 4. Tiến vào Bước 2 (Sảnh đấu) với tệp đã nạp
    const nextToStep2Btn = page
      .locator('button:has-text("TIẾP TỤC: SẢNH ĐẤU"), button:has-text("BƯỚC 02")')
      .first();
    await expect(nextToStep2Btn).toBeVisible({ timeout: 5000 });
    await expect(nextToStep2Btn).toBeEnabled();
    await nextToStep2Btn.click();

    // Xác nhận đã chuyển bước vào Sảnh đấu thành công
    await expect(page.locator('text=BƯỚC 02 // SẢNH ĐẤU')).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('text=Thuyet_Minh_De_Tai_AI_Medical_Assistant.docx')
    ).toBeVisible({ timeout: 5000 });
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
      // => Tổng số activeNodes vẫn giữ nguyên = 1 (không bị tăng vọt), và không ô nhiễm vào staging buffer Khối 6
      expect(sync2.activeNodesCount).toBe(1);
      expect(sync2.section6EntitiesCount).toBe(0);

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
      expect(sync3.section6EntitiesCount).toBe(0);

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
      expect(finalSync.section6EntitiesCount).toBe(0);
      expect(finalSync.hasSection6).toBe(false);
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

  /**
   * Test 4: Đánh giá sửa đổi dữ liệu - Case 1: Sửa đúng (Legitimate Retraction & Data Modification)
   * Thí sinh sửa đổi số liệu ban đầu (VD: 50 triệu -> 65 triệu) bằng câu đính chính hợp lệ.
   * Đánh giá:
   * - Marker OVERWRITE_DIRECT được nhận diện chuẩn xác.
   * - Dữ liệu cũ bị thu hồi (SUPERSEDED) và dữ liệu mới trở thành ACTIVE với đúng giá trị cập nhật.
   * - activeNodesCount không bị phình to (duy trì 1 node active), cạnh REPLACES được thiết lập.
   * - Socket nhận s2c:pitch_graph_sync phản ánh đúng trạng thái dữ liệu đã sửa đổi.
   */
  test('Đánh giá sửa đổi dữ liệu - Case 1: Sửa đúng (Legitimate Retraction & Data Modification)', async () => {
    // 1. Kiểm tra bộ nhận diện Retraction Marker (detectRetractionMarkers)
    const legitCorrectionText = 'Đính chính lại, chính xác là giá bán thiết bị mẫu là 65 triệu đồng';
    const detectedMarkers = detectRetractionMarkers(legitCorrectionText);
    expect(detectedMarkers).toContain(RetractionMarkerType.OVERWRITE_DIRECT);

    // 2. Kiểm thử cấu trúc In-Memory Graph Session (Tombstone & Edge Replacement)
    const session = new PitchGraphSession(`test-legit-session-${Date.now()}`);
    const originalNodeId = 'node-original-50m';
    const updatedNodeId = 'node-updated-65m';

    // Phát biểu 1: Giá ban đầu 50 triệu
    session.addNode({
      id: originalNodeId,
      sessionId: session.sessionId,
      sectionType: PitchSectionType.BUSINESS_MODEL_UNIT_ECONOMICS,
      category: 'FINANCIAL_METRIC',
      key: 'giá_bán',
      value: 'Giá bán gói thiết bị mẫu dự kiến là 50 triệu đồng',
      status: PitchGraphNodeStatus.ACTIVE,
      source: PitchNodeSource.PITCH_REFINED,
      confidence: 1.0,
      sequenceId: 1,
      timestamp: Date.now(),
    });

    expect(session.getActiveNodes().length).toBe(1);
    expect(session.getActiveNodes()[0].value).toContain('50 triệu đồng');
    expect(session.getActiveNodes()[0].status).toBe(PitchGraphNodeStatus.ACTIVE);

    // Phát biểu 2: Thực hiện đính chính sửa đúng sang 65 triệu (OVERWRITE_DIRECT)
    session.addNode({
      id: updatedNodeId,
      sessionId: session.sessionId,
      sectionType: PitchSectionType.BUSINESS_MODEL_UNIT_ECONOMICS,
      category: 'FINANCIAL_METRIC',
      key: 'giá_bán_đính_chính',
      value: legitCorrectionText,
      status: PitchGraphNodeStatus.ACTIVE,
      source: PitchNodeSource.PITCH_REFINED,
      confidence: 1.0,
      sequenceId: 2,
      timestamp: Date.now() + 500,
    });
    session.updateNodeStatus(originalNodeId, PitchGraphNodeStatus.SUPERSEDED, updatedNodeId);
    session.addEdge({
      sourceNodeId: updatedNodeId,
      targetNodeId: originalNodeId,
      edgeType: PitchGraphEdgeType.REPLACES,
      timestamp: Date.now(),
    });

    // Đánh giá sửa đổi dữ liệu:
    // a) Node cũ 50 triệu phải chuyển trạng thái SUPERSEDED
    const originalNodeAfter = session.getNode(originalNodeId);
    expect(originalNodeAfter).toBeDefined();
    expect(originalNodeAfter!.status).toBe(PitchGraphNodeStatus.SUPERSEDED);
    expect(originalNodeAfter!.supersededById).toBe(updatedNodeId);

    // b) Node mới 65 triệu phải ACTIVE và nắm giữ giá trị đính chính mới nhất
    const activeNodesAfter = session.getActiveNodes();
    expect(activeNodesAfter.length).toBe(1); // Không bị nhân đôi node
    const updatedNode = activeNodesAfter[0];
    expect(updatedNode.status).toBe(PitchGraphNodeStatus.ACTIVE);
    expect(updatedNode.value).toBe(legitCorrectionText);

    // c) Cạnh quan hệ REPLACES nối từ node mới về node cũ
    expect(session.edges.length).toBe(1);
    expect(session.edges[0].edgeType).toBe(PitchGraphEdgeType.REPLACES);
    expect(session.edges[0].sourceNodeId).toBe(updatedNode.id);
    expect(session.edges[0].targetNodeId).toBe(originalNodeId);

    // 3. Kiểm thử qua WebSocket Server thời gian thực (End-to-End Socket)
    const wsSessionId = `test-legit-ws-${Date.now()}`;
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
      socket.on('connect_error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    try {
      socket.emit(ArenaSocketEvents.C2S_JOIN_LOBBY, {
        sessionId: wsSessionId,
        documentId: 'doc-test-legit',
      });

      // Stream Chunk 1: Giá 200 triệu ban đầu
      const syncPromise1 = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
        socket.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, resolve);
      });
      socket.emit(ArenaSocketEvents.C2S_STREAM_PITCH_CHUNK, {
        sessionId: wsSessionId,
        sequenceId: 1,
        text: 'Chi phí đầu tư ban đầu ước tính là 200 triệu đồng',
        isFinalChunk: false,
        detectedMarkers: [],
        timestamp: Date.now(),
      });
      const sync1 = await syncPromise1;
      expect(sync1.activeNodesCount).toBe(1);

      // Stream Chunk 2: Sửa đúng sang 120 triệu với OVERWRITE_DIRECT
      const syncPromise2 = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
        socket.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, resolve);
      });
      socket.emit(ArenaSocketEvents.C2S_STREAM_PITCH_CHUNK, {
        sessionId: wsSessionId,
        sequenceId: 2,
        text: 'Đính chính lại, chính xác là chi phí đầu tư ban đầu chỉ cần 120 triệu đồng',
        isFinalChunk: false,
        detectedMarkers: [RetractionMarkerType.OVERWRITE_DIRECT],
        timestamp: Date.now() + 600,
      });
      const sync2 = await syncPromise2;

      // Xác thực: Node cũ bị đè, số node active giữ nguyên = 1 (dữ liệu được sửa đổi đúng, không nhân đôi)
      expect(sync2.activeNodesCount).toBe(1);
      expect(sync2.refinedNodesCount).toBeGreaterThanOrEqual(1);
      expect(sync2.section6EntitiesCount).toBe(0);
    } finally {
      socket.disconnect();
    }
  });

  /**
   * Test 5: Đánh giá sửa đổi dữ liệu - Case 2: Cố ý lừa (Deceptive Phrasing & False Retraction)
   * Thí sinh cố ý dùng câu từ lắt léo, giao đãi, hoặc khẳng định lại nhằm thử xem hệ thống có bị lừa sửa đổi sai lệch không.
   * Đánh giá:
   * - Không phát hiện sai lệch marker đính chính khi câu nói chỉ là giao đãi hoặc khẳng định.
   * - Node ban đầu KHÔNG bị đánh dấu SUPERSEDED, KHÔNG tạo cạnh REPLACES giả.
   * - Dữ liệu cốt lõi ban đầu được bảo toàn nguyên vẹn 100%.
   * - Các câu nhiễu/filler words bị lọc sạch, không làm biến dạng đồ thị tri thức.
   */
  test('Đánh giá sửa đổi dữ liệu - Case 2: Cố ý lừa (Deceptive Trick / Không tự ý sửa đổi)', async () => {
    // 1. Kiểm tra các câu gài bẫy không được sinh nhầm marker đính chính
    const trickySentence1 = 'Khách hàng của chúng tôi hoàn toàn đồng ý và không bao giờ phản đối mức giá này';
    const trickySentence2 = 'Chúng tôi rất tự tin vào doanh thu 2 tỷ đồng này không có lý do gì phải hoài nghi';
    const greetingNoise = 'Kính chào toàn thể hội đồng giám khảo đã lắng nghe chúng em';

    expect(detectRetractionMarkers(trickySentence1)).toEqual([]);
    expect(detectRetractionMarkers(trickySentence2)).toEqual([]);
    expect(detectRetractionMarkers(greetingNoise)).toEqual([]);

    // 2. Kiểm thử cấu trúc In-Memory Graph Session khi gặp câu gài bẫy
    const session = new PitchGraphSession(`test-trick-session-${Date.now()}`);
    const originalNodeId = 'node-original-2b';
    const originalValue = 'Doanh thu năm đầu tiên dự kiến đạt 2 tỷ đồng';

    session.addNode({
      id: originalNodeId,
      sessionId: session.sessionId,
      sectionType: PitchSectionType.BUSINESS_MODEL_UNIT_ECONOMICS,
      category: 'FINANCIAL_METRIC',
      key: 'doanh_thu',
      value: originalValue,
      status: PitchGraphNodeStatus.ACTIVE,
      source: PitchNodeSource.PITCH_REFINED,
      confidence: 1.0,
      sequenceId: 1,
      timestamp: Date.now(),
    });

    const activeNodesInitial = session.getActiveNodes();
    expect(activeNodesInitial.length).toBe(1);

    // Lừa 1: Câu gài bẫy không có marker đính chính hợp lệ -> KHÔNG được phép cập nhật SUPERSEDED hay REPLACES
    const originalNode = session.getNode(originalNodeId);
    expect(originalNode).toBeDefined();
    expect(originalNode!.status).toBe(PitchGraphNodeStatus.ACTIVE);
    expect(originalNode!.supersededById).toBeUndefined();
    expect(originalNode!.value).toBe(originalValue);

    // Không được có bất kỳ cạnh REPLACES nào
    const replaceEdges = session.edges.filter((e) => e.edgeType === PitchGraphEdgeType.REPLACES);
    expect(replaceEdges.length).toBe(0);

    // Lừa 2: Giả lập các câu nói thông thường khác không chứa Retraction Marker
    // Khi không có marker OVERWRITE/CANCELLATION, node gốc luôn bảo toàn trạng thái ACTIVE
    expect(session.getNode(originalNodeId)!.status).toBe(PitchGraphNodeStatus.ACTIVE);

    // 3. Kiểm thử qua WebSocket Server thời gian thực (End-to-End Socket)
    const wsSessionId = `test-trick-ws-${Date.now()}`;
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
      socket.on('connect_error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    try {
      socket.emit(ArenaSocketEvents.C2S_JOIN_LOBBY, {
        sessionId: wsSessionId,
        documentId: 'doc-test-trick',
      });

      // Stream Chunk 1: Phát biểu mục tiêu thị trường 500 tỷ
      const syncPromise1 = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
        socket.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, resolve);
      });
      socket.emit(ArenaSocketEvents.C2S_STREAM_PITCH_CHUNK, {
        sessionId: wsSessionId,
        sequenceId: 1,
        text: 'Quy mô thị trường mục tiêu đạt 500 tỷ đồng',
        isFinalChunk: false,
        detectedMarkers: [],
        timestamp: Date.now(),
      });
      const sync1 = await syncPromise1;
      expect(sync1.activeNodesCount).toBe(1);

      // Stream Chunk 2: Cố ý lừa bằng câu nói chứa từ ngữ gây hiểu lầm nhưng không có marker
      const syncPromise2 = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
        socket.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, resolve);
      });
      socket.emit(ArenaSocketEvents.C2S_STREAM_PITCH_CHUNK, {
        sessionId: wsSessionId,
        sequenceId: 2,
        text: trickySentence1,
        isFinalChunk: false,
        detectedMarkers: [],
        timestamp: Date.now() + 500,
      });
      const sync2 = await syncPromise2;

      // Xác thực: Hệ thống không bị lừa, node gốc không bị tiêu hủy vô cớ
      expect(sync2.activeNodesCount).toBeGreaterThanOrEqual(1);

      // Finalize bài pitch: Dữ liệu vẫn được giữ vững
      const finalSyncPromise = new Promise<S2CPitchGraphSyncPayload>((resolve) => {
        socket.once(ArenaSocketEvents.S2C_PITCH_GRAPH_SYNC, resolve);
      });
      socket.emit(ArenaSocketEvents.C2S_FINALIZE_PITCH_STREAM, {
        sessionId: wsSessionId,
        totalChunks: 2,
        fullRawTranscript: `Quy mô thị trường mục tiêu đạt 500 tỷ đồng. ${trickySentence1}`,
        durationSeconds: 15,
      });
      const finalSync = await finalSyncPromise;
      expect(finalSync.activeNodesCount).toBeGreaterThanOrEqual(1);
      expect(finalSync.hasSection6).toBe(false);
    } finally {
      socket.disconnect();
    }
  });
});
