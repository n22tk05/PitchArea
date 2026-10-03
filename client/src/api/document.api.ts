import { apiClient } from './axios.client';
import { DocumentAnalysisResult } from '@pitcharena/shared';

export interface UploadDocumentApiResponse {
  success: boolean;
  message?: string;
  data: DocumentAnalysisResult;
}

export interface UploadOptions {
  onProgress?: (progressPercent: number) => void;
  serverUrl?: string;
}

/**
 * Gọi API bóc tách tài liệu Word (.docx) qua Axios POST /api/documents/upload
 */
export async function uploadDocumentApi(
  file: File,
  options?: UploadOptions
): Promise<DocumentAnalysisResult> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post<UploadDocumentApiResponse>(
    '/api/documents/upload',
    formData,
    {
      baseURL: options?.serverUrl,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && options?.onProgress) {
          const percent = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          options.onProgress(percent);
        }
      },
    }
  );

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message || 'Lỗi bóc tách tài liệu từ NestJS server.');
  }

  return response.data.data;
}

/**
 * Kiểm tra trạng thái máy chủ NestJS
 */
export async function checkServerHealthApi(): Promise<{ status: string }> {
  const response = await apiClient.get<{ status: string }>('/api/documents/health');
  return response.data;
}
