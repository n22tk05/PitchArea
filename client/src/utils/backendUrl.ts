/**
 * Hàm lấy URL máy chủ backend thông minh:
 * 1. Ưu tiên biến môi trường VITE_SERVER_URL / VITE_API_URL nếu được cấu hình
 * 2. Nếu không có biến môi trường, tự động lấy hostname từ trình duyệt hiện tại (window.location.hostname):
 *    - Nếu truy cập từ http://192.168.1.5:3000 -> sẽ kết nối tới http://192.168.1.5:4000
 *    - Nếu truy cập từ domain/IP public -> sẽ kết nối tới IP/domain đó cổng 4000
 *    - Nếu truy cập từ localhost -> sẽ kết nối tới localhost:4000
 */
export function getBackendUrl(): string {
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL;
  }
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined' && window.location) {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const hostname = window.location.hostname || 'localhost';
    return `${protocol}//${hostname}:4000`;
  }
  return 'http://localhost:4000';
}
