/**
 * URL máy chủ backend chính thức trên môi trường Production (Render)
 */
export const PRODUCTION_BACKEND_URL = 'https://pitcharena-server.onrender.com';

/**
 * Hàm lấy URL máy chủ backend thông minh:
 * 1. Trên môi trường Production (import.meta.env.PROD hoặc truy cập từ domain public):
 *    - Tự động trỏ về https://pitcharena-server.onrender.com
 * 2. Ưu tiên biến môi trường VITE_SERVER_URL / VITE_API_URL nếu được cấu hình riêng
 * 3. Trên môi trường Development cục bộ (localhost / IP mạng LAN nội bộ):
 *    - Tự động trỏ về máy chủ NestJS cục bộ (cổng 4000)
 */
export function getBackendUrl(): string {
  // 1. Môi trường Production
  if (import.meta.env.PROD) {
    const envUrl = import.meta.env.VITE_SERVER_URL || import.meta.env.VITE_API_URL;
    if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
      return envUrl.replace(/\/+$/, '');
    }
    return PRODUCTION_BACKEND_URL;
  }

  // 2. Môi trường Development: Ưu tiên cấu hình biến môi trường nếu có
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL.replace(/\/+$/, '');
  }
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, '');
  }

  // 3. Fallback theo hostname của trình duyệt
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname || 'localhost';
    const isLocalhost =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.endsWith('.local');

    // Nếu chạy từ domain public (không phải localhost/LAN), tự động dùng Production Backend
    if (!isLocalhost) {
      return PRODUCTION_BACKEND_URL;
    }

    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    return `${protocol}//${hostname}:4000`;
  }

  return 'http://localhost:4000';
}

