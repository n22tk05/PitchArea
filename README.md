# PITCH·ARENA STUDIO // ĐẤU TRƯỜNG PHẢN BIỆN GIẢ LẬP

> **AI REALTIME VOICE DEFENSE SIMULATOR**  
> Tôi Luyện Bản Lĩnh Đối Chất Trước Giờ G Hội Đồng. Mô phỏng áp lực phòng thi thật qua đối thoại giọng nói 220ms với 3 Giám khảo AI Solo Bosses. Bóc tách lỗ hổng đề tài, bắt bẫy ngụy biện và bảo vệ bởi sàn máu tân thủ 20%.

---

## 🕹️ Tổng Quan Dự Án

**PITCH·ARENA** là nền tảng đấu trường phản biện giả lập dành cho sinh viên và các nhà sáng lập khởi nghiệp chuẩn bị bảo vệ đề tài trước Hội đồng Giám khảo. 

Hệ thống kết hợp công nghệ **In-Memory RAG** bóc tách tài liệu thông minh (loại bỏ hình ảnh rác, trích xuất số liệu Whitelist bằng Vercel AI SDK) và mô hình **Solo Boss Q&A** đối thoại giọng nói trực tiếp độ trễ thấp 220ms.

### 🎨 Phong Cách Thiết Kế: *Monochrome Retro Pixel Engine*
- **Bảng màu đơn sắc Brutalist**: Tương phản cao Đen - Trắng (`#000000` / `#FFFFFF`), tối giản, dứt khoát.
- **Bóng cơ học Arcade**: `arcade-shadow` (4px 4px 0px), hiệu ứng nhấn nút tactile máy thùng game cổ điển (`active:translate-x-1 active:translate-y-1`).
- **Màn hình CRT & Scanline**: Lớp phủ mờ CRT overlay, con trỏ console `▶` chớp tắt, đèn beacon radar phát xung `animate-ping`.
- **Hiệu ứng Periodic Glitch 2 Giây**: Chữ tiêu đề chính `PITCH·ARENA` giật quang phổ Chromatic Aberration (`cyan / magenta`) định kỳ chuẩn vi mạch retro.

---

## ⚡ Quy Trình 4 Giai Đoạn Khép Kín

Dự án mô phỏng toàn diện chu trình 4 bước của một buổi bảo vệ đề tài thực tế:

```
[ BƯỚC 01 ] ────────► [ BƯỚC 02 ] ────────► [ BƯỚC 03 ] ────────► [ BƯỚC 04 ]
Nạp Dữ Liệu          Thuyết Trình        Phản Biện Đối Chất      Tổng Hợp Báo Cáo
In-Memory RAG       Streaming STT 220ms   3 Solo Bosses Q&A     Phụ Lục 3 Cột & Tái Đấu
```

### 1. Bước 01: Nạp Dữ Liệu & In-Memory RAG
- Tiếp nhận tệp thuyết minh đề tài Microsoft Word (`.docx`, tối đa 20MB).
- Tự động bóc tách **5 khối kinh doanh trọng yếu**:
  1. *Executive Summary & Problem Statement* (Tổng quan & Vấn đề)
  2. *Market Opportunity & Target Customer* (Quy mô thị trường & Khách hàng mục tiêu)
  3. *Product Architecture & Tech Innovation* (Kiến trúc sản phẩm & Đổi mới công nghệ)
  4. *Business Model & Unit Economics* (Mô hình kinh doanh, CAC, LTV, Biên lợi nhuận)
  5. *Execution Roadmap & Financial Projections* (Lộ trình triển khai & Dự phóng tài chính)
- Tự động nhận diện **3 điểm mù rủi ro** trước hội đồng.
- Bóc tách số liệu vào bảng **Entity Whitelist** bằng **Vercel AI SDK (`ai` + `@ai-sdk/google`)** thay thế regex cứng.

### 2. Bước 02: Thuyết Trình Đề Tài (Pitching Stage)
- Trình bày trực tiếp qua micro với streaming Speech-to-Text (STT) độ trễ 220ms.
- Phụ đề hiển thị thời gian thực (Live Transcript Stream) và đối soát trực tiếp với dữ liệu đã nạp.
- Đồng hồ đếm ngược 03:00 - 05:00 kiểm soát thời gian pitching chuẩn quốc tế.

### 3. Bước 03: Phản Biện Đối Chất (Combat Arena)
- Cơ chế **Solo Boss Q&A**: Mỗi thời điểm chỉ một giám khảo chất vấn dồn dập:
  - **GS. Vũ Hoàng** *(Finance Dragon - LV.95)*: Khắc tinh dòng tiền, xoáy sâu CAC, LTV, biên hòa vốn.
  - **TS. Lê Minh Trang** *(AI Sentinel - LV.92)*: Truy vấn kiến trúc Tech, ảo giác dữ liệu Hallucination, rò rỉ API.
  - **Shark Trần Nam** *(Market Shark - LV.98)*: Bắt bẻ rào cản phòng thủ Moat, Product-Market Fit, TAM/SAM/SOM.
- **Quy tắc sinh tử**:
  - Đồng hồ áp lực **30 giây/lượt** trả lời.
  - **Voice Activity Detection (VAD)**: Ngập ngừng quá **2.0 giây** sẽ bị Hội đồng ngắt lời phản công.
  - Phạt trừ **-15% Máu (HP)** khi trả lời vòng vo hoặc dính bẫy ngụy biện logic.

### 4. Bước 04: Tổng Hợp & Đánh Giá (Diagnostic Appendix Report)
- **Sàn máu tân thủ 20% (Pedagogical Shield)**: Khóa máu tối thiểu ở mức 20% HP, sinh viên không bị loại giữa chừng để lắng nghe trọn vẹn góp ý.
- **Báo cáo Phụ lục Chẩn đoán 3 Cột**:
  - *Cột 1*: Tuyên bố của bạn trong bài nói.
  - *Cột 2*: Số liệu thực tế trong tài liệu & thị trường (Fact-check).
  - *Cột 3*: Phán quyết của Hội đồng & Đề xuất khắc phục lỗ hổng.
- Mở khóa nút **Tái đấu tức thì** để tiếp tục tôi luyện bản lĩnh.

---

## 🛠️ Kiến Trúc Kỹ Thuật (Tech Stack)

Dự án được cấu trúc theo mô hình **Monorepo (npm workspaces)**:

```
TS/
├── packages/
│   └── shared/               # Thư viện dùng chung TypeScript models & Zod schemas
├── server/                   # Backend API NestJS 10 & Vercel AI SDK
├── client/                   # Frontend SPA React 18, Vite, Tailwind CSS, Lucide
└── package.json              # Root workspace orchestrator
```

### Backend (`server/`)
- **Framework**: [NestJS 10](https://nestjs.com/) (Module, Controller, Service architecture).
- **RAG & Document Processing**: [Mammoth.js](https://github.com/mwilliamson/mammoth.js) (bóc tách clean text từ `.docx`, tự động lọc bỏ ảnh chụp màn hình).
- **Entity Extraction**: [Vercel AI SDK](https://sdk.vercel.ai/) (`ai`, `@ai-sdk/google`) tích hợp mô hình Google Gemini 2.0 / 1.5 Flash.
- **File Upload**: Multer (In-memory storage buffer, không lưu disk, bảo mật 100%).
- **Validation**: Zod + class-validator.

### Frontend (`client/`)
- **Framework**: [React 18](https://react.dev/) + [Vite 5](https://vitejs.dev/).
- **Styling**: [Tailwind CSS 3](https://tailwindcss.com/) + Custom Retro Keyframes (`index.css`).
- **Icons**: [Lucide React](https://lucide.dev/).
- **Networking**: Axios Client tích hợp Base URL từ biến môi trường.

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Dự Án

### 1. Yêu Cầu Môi Trường
- **Node.js**: Phiên bản `>= 18.x`
- **npm**: Phiên bản `>= 9.x`

### 2. Cài Đặt Dependencies
Từ thư mục gốc dự án:
```bash
npm install
```

### 3. Cấu Hình Biến Môi Trường (.env)

#### Backend (`server/.env`):
Tạo file `server/.env` với nội dung:
```env
PORT=4000
GEMINI_API_KEY=your_google_gemini_api_key_here
```
*(Nếu chưa có API Key Gemini, bạn có thể lấy miễn phí tại [Google AI Studio](https://aistudio.google.com/)).*

#### Frontend (`client/.env`):
Tạo file `client/.env` với nội dung:
```env
VITE_API_URL=http://localhost:4000
```

### 4. Khởi Chạy Ứng Dụng

#### Cách 1: Chạy song song cả Server và Client (Khuyên dùng)
```bash
npm run dev
```

#### Cách 2: Chạy riêng từng workspace
- **Chạy NestJS Backend** (Port 4000):
  ```bash
  npm run start:dev --workspace=pitcharena-server
  ```
- **Chạy Vite Frontend** (Port 5173):
  ```bash
  npm run dev --workspace=pitcharena-client
  ```

Mở trình duyệt truy cập: `http://localhost:5173` để trải nghiệm đấu trường phản biện!

---

## 📋 API Endpoints Chính

| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `POST` | `/api/documents/analyze` | Upload tệp `.docx` (multipart/form-data), chạy In-Memory RAG trích xuất 5 khối đề mục, 3 điểm mù và bảng Whitelist |
| `GET` | `/api/documents/health` | Kiểm tra tình trạng hoạt động của NestJS RAG Engine |

---

## 📜 Giấy Phép & Bản Quyền

Dự án được xây dựng phục vụ nghiên cứu và hỗ trợ sinh viên tôi luyện kỹ năng bảo vệ đề tài trước hội đồng.  
**© 2026 PITCH·ARENA STUDIO — UNIVERSITY EDITION.**
