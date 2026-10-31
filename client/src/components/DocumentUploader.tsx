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
import { DocumentAnalysisResult } from '@pitcharena/shared';
import { uploadDocumentApi } from '../api';
import { getBackendUrl } from '../utils/backendUrl';

export function fixMojibake(str: string): string {
  if (!str) return '';
  if (!/[ÃÄá»â]/.test(str)) {
    return str;
  }
  try {
    return decodeURIComponent(escape(str));
  } catch {
    return str;
  }
}

export const DEFAULT_PREVIEW_SECTIONS = [
  { id: 'sec-1', title: 'Giá trị cốt lõi & Vấn đề giải quyết', type: 'CORE_VALUE' },
  { id: 'sec-2', title: 'Khách hàng mục tiêu & Quy mô thị trường', type: 'TARGET_MARKET' },
  { id: 'sec-3', title: 'Mô hình kinh doanh & Doanh thu', type: 'BUSINESS_MODEL' },
  { id: 'sec-4', title: 'Giải pháp công nghệ & Hàng rào cạnh tranh', type: 'TECH_MOAT' },
  { id: 'sec-5', title: 'Kế hoạch tài chính & Dự phóng vốn', type: 'FINANCIAL_PLAN' },
];

interface DocumentUploaderProps {
  value?: DocumentAnalysisResult | null;
  onAnalysisComplete?: (result: DocumentAnalysisResult) => void;
  onNext?: () => void;
  onReset?: () => void;
  serverUrl?: string;
}

export const DocumentUploader: React.FC<DocumentUploaderProps> = ({
  value,
  onAnalysisComplete,
  onNext,
  onReset,
  serverUrl = getBackendUrl(),
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [internalResult, setInternalResult] =
    useState<DocumentAnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dữ liệu hiển thị ưu tiên từ props (value) nếu có, fallback về internalResult
  const analysisResult = value !== undefined ? value : internalResult;

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

      // Ưu tiên tên tệp gốc từ trình duyệt (luôn chuẩn UTF-8), kết hợp giải mã mojibake nếu có
      const sanitizedFilename = fileToUpload.name || fixMojibake(data.filename);
      const safeData: DocumentAnalysisResult = {
        ...data,
        filename: sanitizedFilename,
      };

      setInternalResult(safeData);
      if (onAnalysisComplete) {
        onAnalysisComplete(safeData);
      }
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Không thể kết nối đến máy chủ PitchArena.'
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleReset = () => {
    setInternalResult(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (onReset) {
      onReset();
    }
  };

  return (
    <div className="w-full space-y-5">
      {/* 1. WARNING BANNER: NO SCREENSHOT IMAGES */}
      <div className="rounded-xl border border-[#F59E0B]/40 bg-[#FEF3C7]/60 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-[#D97706] shrink-0" />
          <span className="font-mono text-[#92400E] font-bold uppercase tracking-wide">
            LƯU Ý ĐỊNH DẠNG:
          </span>
          <span className="text-[#57534E] font-sans">
            PitchArena bóc tách văn bản chuẩn mực để lập mảng số liệu Whitelist. Vui lòng{' '}
            <strong className="text-[#1C1917] font-semibold">không dùng ảnh chụp màn hình</strong> để chứa số liệu tài chính hay mô hình.
          </span>
        </div>
      </div>

      {/* 2. BỐ CỤC 2 CỘT: NƠI UPLOAD NẰM CẠNH DANH SÁCH 5 KHỐI ĐỀ MỤC */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* CỘT TRÁI (4 COLS): NƠI UPLOAD / THẺ FILE ĐÃ NẠP */}
        <div className="lg:col-span-5 flex flex-col justify-between">
          {!analysisResult ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`h-full min-h-[380px] cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-200 shadow-xs flex flex-col items-center justify-center space-y-4 ${
                isDragging
                  ? 'border-[#B45309] bg-[#FEF3C7]/40 scale-[1.01]'
                  : 'border-[#D97706]/40 bg-[#FAF8F5] hover:border-[#B45309] hover:bg-[#FFFFFF]'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".docx"
                className="hidden"
              />

              <div className="w-14 h-14 rounded-xl bg-[#FFFFFF] border border-[#D97706]/40 flex items-center justify-center text-[#B45309] shadow-xs group-hover:scale-105 transition-all">
                {isUploading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-[#B45309]" />
                ) : (
                  <Upload className="w-6 h-6" />
                )}
              </div>

              <div className="space-y-1.5">
                <p className="font-headline text-sm text-[#1C1917] font-bold uppercase tracking-wider">
                  {isUploading
                    ? `ĐANG BÓC TÁCH... ${uploadProgress > 0 ? `[${uploadProgress}%]` : ''}`
                    : 'KÉO THẢ TỆP WORD (.DOCX) HOẶC BẤM ĐỂ CHỌN'}
                </p>
                <p className="font-sans text-xs text-[#78716C]">
                  Mô tả đề tài / Slide thuyết trình Word (Tối đa 20MB)
                </p>
              </div>

              {errorMessage && (
                <div className="p-3 border border-rose-300 bg-rose-50 text-rose-800 font-mono text-xs flex items-center gap-2 max-w-full rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="pt-2">
                <span className="font-pixel text-[9px] bg-[#FEF3C7] border border-[#F59E0B]/50 px-3 py-1 text-[#92400E] font-bold rounded-full shadow-xs">
                  ĐỊNH DẠNG: .DOCX • KHÔNG CHỨA ẢNH
                </span>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[380px] rounded-2xl bg-[#FFFFFF] p-6 border border-[#D97706]/30 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                {/* Header Thẻ File */}
                <div className="flex items-center justify-between border-b border-[#D97706]/20 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-pixel text-[10px] font-bold bg-[#FEF3C7] text-[#92400E] px-2.5 py-1 rounded-full border border-[#F59E0B]/50">
                      TÀI LIỆU HIỆN HÀNH
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="font-pixel text-[10px] font-bold px-3 py-1.5 rounded-lg border border-[#D97706]/35 bg-[#FAF8F5] hover:bg-[#FEF3C7] text-[#92400E] hover:text-[#B45309] flex items-center gap-1.5 active:translate-x-0.5 transition-all cursor-pointer shadow-xs"
                  >
                    <RefreshCw className="w-3 h-3 text-[#D97706]" />
                    <span>[NẠP LẠI]</span>
                  </button>
                </div>

                {/* Chi tiết Tệp */}
                <div className="p-4 border border-[#D97706]/20 bg-[#FAF8F5] rounded-xl space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg border border-[#D97706]/35 bg-[#FFFFFF] flex items-center justify-center shrink-0 text-[#B45309] shadow-xs">
                      <FileText className="w-5 h-5 text-[#B45309]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4
                        className="font-headline font-bold text-sm text-[#1C1917] truncate"
                        title={fixMojibake(analysisResult.filename)}
                      >
                        {fixMojibake(analysisResult.filename)}
                      </h4>
                      <p className="font-sans text-xs text-[#78716C] mt-0.5">
                        Dung lượng: {(analysisResult.fileSizeBytes / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 pt-2.5 border-t border-[#D97706]/15 font-mono text-xs">
                    <div className="bg-[#FFFFFF] p-2.5 border border-[#D97706]/20 rounded-lg">
                      <span className="text-[#78716C] block font-pixel text-[8px] font-bold uppercase">ĐIỂM MÙ PHÁT HIỆN:</span>
                      <span className="font-bold text-amber-700 font-pixel text-[10px] flex items-center gap-1 mt-0.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                        {analysisResult.blindSpots.length} ĐIỂM RỦI RO
                      </span>
                    </div>
                    <div className="bg-[#FFFFFF] p-2.5 border border-[#D97706]/20 rounded-lg">
                      <span className="text-[#78716C] block font-pixel text-[8px] font-bold uppercase">SỐ LIỆU WHITELIST:</span>
                      <span className="font-bold text-emerald-700 font-pixel text-[10px] flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        {analysisResult.entityWhitelist.length} CHỈ SỐ
                      </span>
                    </div>
                  </div>
                </div>

                <p className="font-sans text-xs text-[#57534E] leading-relaxed">
                  Tài liệu đã được bóc tách và nạp vào bộ nhớ In-Memory RAG. Kiểm tra các khối đề mục bên cạnh trước khi vào Đấu trường.
                </p>
              </div>

              {/* Nút Chuyển Tiếp Sang Bước 02 */}
              {onNext && (
                <button
                  type="button"
                  onClick={onNext}
                  className="w-full py-3 px-4 bg-[#B45309] hover:bg-[#92400E] text-[#FFFFFF] font-pixel font-bold text-xs rounded-xl shadow-xs active:translate-x-0.5 active:translate-y-0.5 flex items-center justify-center gap-2 uppercase tracking-wider transition-all cursor-pointer"
                >
                  <span>[ TIẾN VÀO ĐẤU TRƯỜNG (BƯỚC 02) ]</span>
                  <ArrowRight className="w-4 h-4 text-[#FFFFFF]" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* CỘT PHẢI (7 COLS): DANH SÁCH 5 KHỐI ĐỀ MỤC DẠNG LIST */}
        <div className="lg:col-span-7 rounded-2xl bg-[#FFFFFF] p-6 border border-[#D97706]/30 shadow-xs flex flex-col justify-between space-y-4">
          {/* Header List */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#D97706]/20">
            <div className="flex items-center gap-2.5">
              <span className="font-pixel text-[10px] font-bold bg-[#FEF3C7] text-[#92400E] px-2.5 py-1 rounded-full border border-[#F59E0B]/50 shadow-xs">
                5 KHỐI ĐỀ MỤC
              </span>
              <h3 className="font-headline font-black text-sm text-[#1C1917] uppercase tracking-tight">
                TRỌNG YẾU TỪ TÀI LIỆU
              </h3>
            </div>

            {analysisResult ? (
              (() => {
                const total = analysisResult.sections.length;
                const found = analysisResult.sections.filter(
                  (s) => s.charCount > 0 && !s.content.startsWith('(Chưa')
                ).length;
                const isFull = found === total;

                return (
                  <span
                    className={`font-pixel text-[10px] font-bold flex items-center gap-1.5 ${
                      isFull ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {isFull ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{found}/{total} KHỐI HOÀN TẤT</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>{found}/{total} KHỐI ({total - found} THIẾU)</span>
                      </>
                    )}
                  </span>
                );
              })()
            ) : (
              <span className="font-pixel text-[10px] text-[#78716C] font-bold">
                [ CHỜ NẠP TÀI LIỆU ]
              </span>
            )}
          </div>

          {/* Danh sách List Items siêu gọn */}
          <div className="space-y-2.5">
            {(analysisResult ? analysisResult.sections : DEFAULT_PREVIEW_SECTIONS).map(
              (sec: any, idx: number) => {
                const isResultMode = !!analysisResult;
                const isNotFound =
                  isResultMode &&
                  (!sec.content ||
                    sec.charCount === 0 ||
                    sec.content.startsWith('(Chưa'));

                return (
                  <div
                    key={sec.id || idx}
                    className={`rounded-xl border p-3.5 transition-all flex items-center justify-between gap-3 text-xs ${
                      !isResultMode
                        ? 'border-dashed border-[#D97706]/30 bg-[#FAF8F5]/60'
                        : isNotFound
                        ? 'border-dashed border-rose-300 bg-rose-50/70'
                        : 'border-[#D97706]/25 bg-[#FAF8F5] hover:border-[#D97706] shadow-xs'
                    }`}
                  >
                    {/* Bên trái: Mã khối + Tiêu đề + Cảnh báo */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span
                        className={`font-pixel text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                          !isResultMode
                            ? 'border-[#D97706]/25 bg-[#FFFFFF] text-[#78716C]'
                            : isNotFound
                            ? 'border-rose-300 bg-rose-100 text-rose-800'
                            : 'border-[#F59E0B]/50 bg-[#FEF3C7] text-[#92400E]'
                        }`}
                      >
                        0{idx + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`font-bold font-mono text-xs truncate ${
                              isNotFound ? 'text-[#78716C]' : 'text-[#1C1917]'
                            }`}
                          >
                            {sec.title}
                          </span>
                          {isNotFound && (
                            <span className="text-[10px] font-mono font-bold text-rose-700 bg-rose-100 px-2 py-0.5 border border-rose-300 rounded-md inline-flex items-center gap-1">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              Chưa tìm thấy nội dung
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bên phải: Số từ/ký tự + Badge trạng thái */}
                    <div className="flex items-center gap-3 shrink-0 font-mono text-[11px]">
                      {isResultMode ? (
                        <span
                          className={`text-[10px] ${
                            isNotFound ? 'text-rose-600 font-bold' : 'text-[#78716C]'
                          }`}
                        >
                          {isNotFound
                            ? '0 TỪ • 0 KÝ TỰ'
                            : `${sec.wordCount} TỪ • ${sec.charCount} KÝ TỰ`}
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#A8A29E]">---</span>
                      )}

                      {isResultMode ? (
                        isNotFound ? (
                          <span className="font-pixel text-[9px] text-rose-700 bg-rose-100 px-2.5 py-1 border border-rose-300 rounded-full font-bold">
                            CHƯA TÌM THẤY
                          </span>
                        ) : (
                          <span className="font-pixel text-[9px] text-emerald-800 bg-emerald-100 px-2.5 py-1 border border-emerald-300 rounded-full font-bold shadow-xs">
                            ĐÃ BÓC TÁCH
                          </span>
                        )
                      ) : (
                        <span className="font-pixel text-[9px] text-[#78716C] bg-[#FAF8F5] px-2.5 py-1 border border-[#D97706]/20 rounded-full font-bold">
                          CHỜ NẠP
                        </span>
                      )}
                    </div>
                  </div>
                );
              }
            )}
          </div>

          <div className="pt-3 border-t border-[#D97706]/20 flex items-center justify-between text-[11px] font-mono text-[#78716C]">
            <span>RAG IN-MEMORY • TỰ ĐỘNG CHUẨN HOÁ HEURISTIC</span>
            <span className="text-[10px] font-bold text-[#B45309]">CHẤP NHẬN FILE .DOCX</span>
          </div>
        </div>
      </div>
    </div>
  );
};
