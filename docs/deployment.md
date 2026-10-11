# Hướng dẫn Triển khai (Deployment Guide) - PitchArena

PitchArena bao gồm 2 thành phần độc lập:
1. **Frontend Client (`client/`):** React SPA (Vite) – Đã triển khai trên **Vercel**.
2. **Backend Server (`server/`):** NestJS API + Socket.IO WebSockets – Cần máy chủ duy trì kết nối liên tục (Persistent Server Runtime).

> [!IMPORTANT]
> **Tại sao không thể chạy Socket.IO trên Vercel Serverless?**
> Vercel hoạt động theo mô hình *Serverless Functions* (ngắt kết nối sau vài giây), trong khi Đấu trường PitchArena cần kết nối Socket.IO thời gian thực liên tục (đếm ngược FSM, đóng băng thời gian, stream âm thanh và thoại). Vì vậy, Server cần được triển khai trên nền tảng hỗ trợ WebSocket dài hạn như **Render** hoặc **Railway**.

---

## Cách 1: Triển khai Server lên Render.com (Miễn phí & Khuyên dùng)

Render hỗ trợ Web Service Node.js miễn phí với WebSocket 100%.

1. Đăng nhập vào [dashboard.render.com](https://dashboard.render.com).
2. Bấm nút **New +** > Chọn **Blueprint**.
3. Kết nối với repository GitHub: `https://github.com/n22tk05/PitchArea.git`.
4. Render sẽ tự động nhận diện file [`render.yaml`](../render.yaml) đã được cấu hình sẵn:
   - **Build Command:** `npm install && npm run build:server`
   - **Start Command:** `npm run start:server`
5. Nhập các biến môi trường (Environment Variables) trong phần cấu hình của Render:
   - `GROQ_API_KEY`: Key Groq chính của bạn
   - `GROQ_API_KEY_2`: Key Groq phụ 2
   - `GROQ_API_KEY_3`: Key Groq phụ 3
   - `GEMINI_API_KEY`: Key Google Gemini
6. Bấm **Apply**. Sau khoảng 2-3 phút, Render sẽ cấp cho bạn một domain HTTPS:
   `https://pitcharena-server.onrender.com`

---

## Cách 2: Triển khai Server lên Railway.app

1. Đăng nhập vào [railway.app](https://railway.app).
2. Chọn **New Project** > **Deploy from GitHub repo** > Chọn repo `PitchArea`.
3. Railway sẽ tự động nhận diện file [`railway.json`](../railway.json) hoặc [`Dockerfile`](../Dockerfile).
4. Trong tab **Variables**, thêm các biến:
   - `GROQ_API_KEY`
   - `GROQ_API_KEY_2`
   - `GROQ_API_KEY_3`
   - `GEMINI_API_KEY`
   - `PORT`: `4000`
5. Trong tab **Settings** > **Networking**, bấm **Generate Domain** để lấy URL server công khai:
   `https://pitcharena-server.up.railway.app`

---

## Bước kết nối: Cập nhật Environment Variables trên Vercel (Client)

Sau khi có URL của Server (ví dụ: `https://pitcharena-server.onrender.com`):

1. Vào [Vercel Dashboard](https://vercel.com/dashboard) > Chọn dự án PitchArena Client.
2. Vào **Settings** > **Environment Variables**.
3. Thêm 2 biến sau:
   - `VITE_SERVER_URL` = `https://pitcharena-server.onrender.com` (URL server vừa deploy, không có dấu `/` ở cuối)
   - `VITE_API_URL` = `https://pitcharena-server.onrender.com`
4. Vào tab **Deployments** > Bấm **Redeploy** phiên bản mới nhất để Vite nạp biến môi trường mới.

**Hoàn tất!** Giờ đây ứng dụng trên Vercel sẽ tự động kết nối trực tiếp đến Server đám mây mà không cần mở `localhost:4000` trên máy tính nữa.
