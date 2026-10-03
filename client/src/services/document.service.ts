import { uploadDocumentApi, UploadOptions } from '../api';
import { DocumentAnalysisResult } from '@pitcharena/shared';

/**
 * Service tầng nghiệp vụ - sử dụng Axios Document API
 */
export async function uploadDocument(
  file: File,
  serverUrl?: string,
  onProgress?: (percent: number) => void
): Promise<DocumentAnalysisResult> {
  const options: UploadOptions = {
    serverUrl,
    onProgress,
  };
  return uploadDocumentApi(file, options);
}
