import axios, { AxiosInstance, AxiosError } from 'axios';

// Lấy Base URL từ Vite Environment Variables (hoặc fallback mặc định NestJS localhost:4000)
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

/**
 * Axios Client instance dùng chung cho toàn bộ ứng dụng PitchArena
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    Accept: 'application/json',
  },
});

// Response interceptor để chuẩn hóa dữ liệu trả về và bắt lỗi tập trung
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string }>) => {
    const customMessage =
      error.response?.data?.message ||
      error.message ||
      'Không thể kết nối đến máy chủ NestJS.';
    return Promise.reject(new Error(customMessage));
  }
);
