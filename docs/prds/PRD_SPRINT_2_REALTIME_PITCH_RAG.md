# PRD SPRINT 2 (1 TUẦN): REALTIME STREAMING PITCH RAG & ROBUST VOICE GROUNDING

| Thông Tin | Chi Tiết |
| :--- | :--- |
| **Dự Án** | PITCH·ARENA STUDIO |
| **Sprint / Phiên Bản** | Sprint 2 (Tuần 3) • Phase 2 Extension |
| **Thời Gian Thực Hiện** | 1 Tuần (7 Ngày) |
| **Vai Trò Phụ Trách** | John (Product Manager) & Amelia (Lead Dev) |
| **Trạng Thái** | **DRAFT / READY FOR ARCHITECTURE** |

---

## 1. TỔNG QUAN & BỐI CẢNH (Executive Summary)

### 1.1. Bối cảnh
Ở Sprint 1 (Phase 1 - Phase 5), PITCH·ARENA đã hoàn thành bộ khung nền tảng: bóc tách tài liệu Word `.docx` In-Memory, đấu trường WebSocket với 4 Boss Giám khảo, thanh máu HP, phân xử MAD Chamber và báo cáo phụ lục. 

Tuy nhiên, trong quá trình thử nghiệm thực chiến, tồn tại **3 điểm nghẽn trải nghiệm chí tử**:
1. **RAG chỉ là tài liệu chết trên giấy:** Bước 3 (Pitching), thí sinh thuyết trình 2-5 phút rất nhiều ý tưởng mới, số liệu thực tế ngoài đời, nhưng hệ thống không thu thập được. Sang Bước 4, Giám khảo chỉ hỏi theo file Word và coi những gì thí sinh vừa nói là "vô căn cứ".
2. **Độ ổn định của Micro/Voice khi deploy:** Trình duyệt siết chặt chính sách bảo mật Micro qua mạng/HTTPS, dễ dẫn đến mất từ cuối câu hoặc ngắt kết nối STT.
3. **Độ bám sát đề án chưa sắc sảo:** Câu chất vấn của Boss đôi lúc còn chung chung, chưa trích dẫn được chính xác con số hoặc mục đối nghịch giữa bài nói và tài liệu.

### 1.2. Tuyên ngôn mục tiêu Sprint 2 (Sprint Goal)
> *"Biến bài thuyết trình bằng giọng nói ở Bước 3 thành nguồn tri thức sống động nạp tức thời vào RAG, tối ưu hóa độ nhạy Micro/VAD chống nuốt chữ, và nâng cấp Giám khảo AI đối soát chéo từng số liệu giữa Lời Nói và Đề Án Word."*

---

## 2. CHÂN DUNG NGƯỜI DÙNG & TÌNH HUỐNG SỬ DỤNG (User Personas & Scenarios)

### 2.1. Thí sinh khởi nghiệp (Student Pitcher)
- **Tình huống:** Thí sinh nộp file Word cách đây 1 tháng (số liệu cũ: 50 người dùng thử). Trong 2 phút Pitching ở Bước 3, thí sinh cập nhật: *"Thưa hội đồng, tuần vừa rồi nhóm đã nâng số lượng người dùng lên 250 người và có doanh thu đầu tiên là 3 triệu đồng"*.
- **Kỳ vọng:** Hệ thống thu thập ngay số liệu mới này. Khi sang Bước 4, Boss Shark Nam ghi nhận con số 250 người dùng và truy vấn sâu vào doanh thu 3 triệu đồng, thay vì trừ điểm thí sinh vì "bịa số liệu ngoài file Word".

### 2.2. Hội đồng Giám khảo AI (Jury Bosses)
- **Kỳ vọng:** Có đầy đủ 2 nguồn căn cứ song song: `Căn cứ Hồ sơ Word` vs `Căn cứ Thuyết trình thực tế`. Bóc trần được các điểm mâu thuẫn (nói trên slide/mic một đằng, viết trong đề án một nẻo).

---

## 3. CÁC TÍNH NĂNG CỐT LÕI CẦN ĐẠT ĐƯỢC (Core Requirements)

### FR-01: Realtime Streaming Pitch Ingestion (Người dùng Pitch tới đâu, RAG thu tới đó)
- **P0 (Must-have):**
  - Trong Bước 3 (Pitching), khi Web Speech API trả về các đoạn text (`interimTranscript` và `finalPiece`), client stream liên tục các chunk này lên server qua WebSocket event `c2s:stream_pitch_chunk`.
  - Server sử dụng cơ chế **Rolling Window Buffer (Cửa sổ trượt 30-45s)** để nhóm các câu thành các phân đoạn ý nghĩa.
  - Tự động gắn nhãn phân đoạn theo 5 khối đề mục (`PITCH_PROBLEM`, `PITCH_SOLUTION`, `PITCH_BUSINESS_MODEL`, `PITCH_TECH_MOAT`, `PITCH_ROADMAP`).
- **P1 (Should-have):**
  - Hiển thị trực quan cho thí sinh: Tag phản hồi số từ và số liệu đã thu nạp thành công (ví dụ: `Đã nạp 320 từ thuyết trình • 2 thực thể mới`).

### FR-02: Instant Entity & Metric Sniffer (Bắt nóng số liệu & cập nhật Whitelist)
- **P0 (Must-have):**
  - Hệ thống chạy bộ quét thực thể nhanh (Regex + Fuzzy Match) trên dòng lời nói của thí sinh để nhận diện: Phần trăm (`%`), Tiền tệ (`VNĐ`, `$`), Số lượng (`users`, `khách hàng`, `tháng/năm`).
  - Tự động bổ sung các số liệu này vào **Bảng Whitelist mở rộng (`dynamicPitchWhitelist`)**.
  - Các số liệu này được bảo vệ trong phiên đấu, giúp Arbiter không phạt trừ máu oan khi thí sinh trả lời ở Bước 4 dựa trên số liệu họ đã công bố trong bài Pitch.

### FR-03: Combined Knowledge RAG Engine (Đối soát chéo Word vs Lời Nói)
- **P0 (Must-have):**
  - Kết thúc Bước 3, toàn bộ transcript bài Pitch được đóng gói thành một tài liệu bổ trợ chính thức: `CandidatePitchTranscriptDoc`.
  - Cập nhật prompt của 4 Boss Giám khảo và Arbiter: Nạp cả 2 khối context:
    1. `[CĂN CỨ TÀI LIỆU WORD ĐÃ NỘP]`
    2. `[CĂN CỨ THUYẾT MINH THỰC TẾ VỪA NÓI]`
  - Giám khảo có khả năng đặt câu hỏi đối chiếu: *"Trong bài thuyết trình vừa rồi bạn có nói X, nhưng trong mục Y của đề án lại viết Z, bạn giải thích thế nào về sự chênh lệch này?"*.

### FR-04: Robust Voice Engine & VAD Precision (Cải thiện Micro & Giọng Nói)
- **P0 (Must-have):**
  - **Chống nuốt chữ cuối:** Gom trọn cả `interimTranscript` cuối cùng hợp nhất với `finalTranscript` khi hết giờ hoặc khi người dùng bấm dừng mic.
  - **Tự động phục hồi Web Speech:** Tự động lắng nghe sự kiện `onend` và khởi động lại SpeechRecognition mượt mà nếu trình duyệt tự ngắt sau khoảng lặng.
  - **VAD ngữ nghĩa:** Khi phát hiện các từ nối bỏ lửng (`và là...`, `bởi vì...`, `tuy nhiên...`), VAD tự động cộng thêm đệm 0.8s để tránh ngắt lời oan khi thí sinh đang lấy hơi.
- **P1 (Should-have):**
  - Cảnh báo rõ ràng và thân thiện nếu trình duyệt chặn quyền truy cập Micro trên môi trường không an toàn (non-HTTPS).

---

## 4. PHẠM VI KHÔNG LÀM TRONG SPRINT NÀY (Out of Scope / Non-Goals)
- Không làm tính năng phòng thi nhiều người (Multiplayer / Mentor Dashboard).
- Không làm tính năng đọc trực tiếp file slide `.pptx` nhúng hình ảnh phức tạp.
- Không thay đổi thiết kế giao diện chủ đạo (Vẫn giữ vững phong cách Monochrome Retro Pixel).

---

## 5. TIÊU CHÍ NGHIỆM THU & THÀNH CÔNG (Acceptance Criteria & Metrics)

| Chỉ Số | Mục Tiêu Nghiệm Thu |
| :--- | :--- |
| **Độ trễ Streaming RAG** | Dữ liệu lời nói từ lúc phát âm đến khi nạp vào bộ nhớ server $\le 500\text{ms}$. |
| **Tỷ lệ nhận diện số liệu mới** | Bắt được $\ge 90\%$ các số liệu tiền tệ, phần trăm, số lượng người dùng được phát âm rõ ràng trong bài Pitch. |
| **Khả năng chất vấn đối soát** | Ít nhất 1 trong 3 câu hỏi đầu tiên của Boss ở Bước 4 trích dẫn trực tiếp được một chi tiết thí sinh vừa thuyết minh ở Bước 3. |
| **Tỷ lệ mất chữ cuối câu** | Giảm tỷ lệ nuốt chữ/mất chữ khi hết giờ xuống $\le 2\%$. |
| **Chất lượng mã nguồn** | Không có lỗi biên dịch TypeScript (`npx tsc --noEmit` pass 100%), tuyệt đối không chạy lệnh build. |

---

## 6. LỘ TRÌNH TRIỂN KHAI 7 NGÀY (Sprint 2 Schedule)

- **Ngày 1 - 2:** Thiết kế Kiến trúc (`bmad-architecture`) & Định nghĩa WebSocket Events cho Streaming Pitch Chunks (`packages/shared`).
- **Ngày 3 - 4:** Xây dựng Streaming Ingestion Buffer & Entity Sniffer trên NestJS Backend (`server`).
- **Ngày 5:** Nâng cấp Audio Recorder Hook trên React Client (chống nuốt chữ, VAD ngữ nghĩa) & Tích hợp hiển thị Tag tiến độ thu thập.
- **Ngày 6:** Cập nhật Prompt Templates cho Boss & Arbiter đối soát chéo Word vs Pitch.
- **Ngày 7:** Kiểm thử đối soát kịch bản thực tế, rà soát Type safety và chốt bàn giao.
