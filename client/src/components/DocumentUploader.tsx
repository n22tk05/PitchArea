import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  DocumentAnalysisResult,
  BusinessSectionLabel,
} from '@pitcharena/shared';
import { uploadDocumentApi } from '../api';

interface DocumentUploaderProps {
  onAnalysisComplete?: (result: DocumentAnalysisResult) => void;
  serverUrl?: string;
}

export const DocumentUploader: React.FC<DocumentUploaderProps> = ({
  onAnalysisComplete,
  serverUrl = 'http://localhost:4000',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [analysisResult, setAnalysisResult] =
    useState<DocumentAnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (selectedFile: File) => {
    setErrorMessage(null);
    if (!selectedFile.name.toLowerCase().endsWith('.docx')) {
      setErrorMessage('Định dạng tệp không hợp lệ! Vui lòng chỉ nạp tệp Word (.docx).');
      return;
    }
    if (selectedFile.size > 20 * 1024 * 1024) {
      setErrorMessage('Dung lượng tệp vượt quá 20MB.');
      return;
    }

    uploadAndParse(selectedFile);
  };

  const uploadAndParse = async (fileToUpload: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    setErrorMessage(null);

    try {
      const data = await uploadDocumentApi(fileToUpload, {
        serverUrl,
        onProgress: (percent) => setUploadProgress(percent),
      });
      setAnalysisResult(data);
      if (onAnalysisComplete) {
        onAnalysisComplete(data);
      }
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Không thể kết nối đến máy chủ NestJS (port 4000).'
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* 1. WARNING BANNER: NO SCREENSHOT IMAGES */}
      <div className="rounded-lg border-2 border-black bg-amber-50 p-4 arcade-shadow-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <h4 className="font-mono font-bold text-amber-900 uppercase tracking-wide">
              HƯỚNG DẪN ĐỊNH DẠNG TÀI LIỆU DÀNH CHO THÍ SINH
            </h4>
            <p className="text-neutral-700 leading-relaxed font-sans">
              PitchArena sử dụng động cơ bóc tách văn bản chuẩn mực để lập mảng số liệu
              đối soát (<strong className="text-black font-semibold">Whitelist</strong>) và loại bỏ hoàn toàn các hình ảnh thô.
              Vui lòng <strong className="text-black font-semibold">không sử dụng ảnh chụp màn hình</strong> để chứa số liệu tài chính hay mô hình kỹ thuật. Hãy gõ số liệu trực tiếp bằng văn bản để tránh bị Hội đồng AI trừ điểm oan.
            </p>
          </div>
        </div>
      </div>

      {/* 2. DROPZONE AREA */}
      {!analysisResult && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-all duration-200 arcade-shadow ${
            isDragging
              ? 'border-black bg-neutral-100 scale-[1.01]'
              : 'border-black bg-white hover:bg-neutral-50'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".docx"
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-14 h-14 rounded bg-surface-container-high border-2 border-black flex items-center justify-center text-black arcade-shadow-sm">
              {isUploading ? (
                <Loader2 className="w-6 h-6 animate-spin text-black" />
              ) : (
                <Upload className="w-6 h-6" />
              )}
            </div>

            <div>
              <p className="font-mono text-sm text-black font-bold uppercase tracking-wider">
                {isUploading
                  ? `ĐANG TẢI VÀ BÓC TÁCH TÀI LIỆU QUA AXIOS... ${uploadProgress > 0 ? `[${uploadProgress}%]` : ''}`
                  : 'KÉO THẢ TỆP WORD (.DOCX) HOẶC BẤM ĐỂ CHỌN TỆP'}
              </p>
              <p className="font-sans text-xs text-neutral-500 mt-1">
                Tiếp nhận tệp mô tả đề tài / Slide thuyết trình Word (Tối đa 20MB)
              </p>
            </div>

            {errorMessage && (
              <p className="font-mono text-xs text-red-600 font-bold mt-2">
                ⚠️ {errorMessage}
              </p>
            )}
          </div>
        </div>
      )}

      {/* 3. PARSED RESULTS & 5-SECTION SUMMARY + 3 BLIND SPOTS */}
      {analysisResult && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="rounded-lg border-2 border-black bg-white p-4 flex flex-wrap items-center justify-between gap-4 arcade-shadow">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              <div>
                <h3 className="font-mono text-sm font-bold text-black uppercase">
                  BÓC TÁCH THÀNH CÔNG: {analysisResult.filename}
                </h3>
                <p className="font-sans text-xs text-neutral-600 mt-0.5">
                  Dung lượng: {(analysisResult.fileSizeBytes / 1024).toFixed(1)} KB • Trích xuất được {analysisResult.entityWhitelist.length} số liệu Whitelist
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setAnalysisResult(null);
              }}
              className="font-mono text-xs font-bold px-3 py-1.5 rounded border-2 border-black bg-surface-container hover:bg-surface-container-high text-black arcade-shadow-hover transition-all inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>[NẠP TỆP KHÁC]</span>
            </button>
          </div>

          {/* Ready to Battle CTA */}
          <div className="pt-2 flex justify-end">
            <button className="flex items-center gap-2 px-6 py-3 rounded bg-black hover:bg-neutral-800 text-white font-mono text-xs font-bold uppercase tracking-wider border-2 border-black arcade-shadow arcade-shadow-hover transition-all">
              <span>[ &gt; TIẾN VÀO ĐẤU TRƯỜNG ]</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
