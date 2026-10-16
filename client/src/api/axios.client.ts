import axios, { AxiosInstance, AxiosError } from 'axios';
import { getBackendUrl } from '../utils/backendUrl';

// Lấy Base URL tự động theo hostname của người dùng (hoặc biến môi trường VITE_API_URL)
const BASE_URL = getBackendUrl();

/**
 * Axios Client instance dùng chung cho toàn bộ ứng dụng PitchArena
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
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
