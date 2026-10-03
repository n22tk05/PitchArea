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
  serverUrl = 'http://localhost:4000',
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
        err.message || 'Không thể kết nối đến máy chủ NestJS (port 4000).'
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
    <div className="w-full space-y-4">
      {/* 1. WARNING BANNER: NO SCREENSHOT IMAGES */}
      <div className="rounded border-2 border-black bg-amber-50 p-3 shadow-[2px_2px_0px_#000] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
          <span className="font-mono text-amber-950 font-bold uppercase tracking-wide">
            LƯU Ý ĐỊNH DẠNG:
          </span>
          <span className="text-neutral-700 font-sans">
            PitchArena bóc tách văn bản chuẩn mực để lập mảng số liệu Whitelist. Vui lòng{' '}
            <strong className="text-black font-semibold">không dùng ảnh chụp màn hình</strong> để chứa số liệu tài chính hay mô hình.
          </span>
        </div>
      </div>

      {/* 2. BỐ CỤC 2 CỘT: NƠI UPLOAD NẰM CẠNH DANH SÁCH 5 KHỐI ĐỀ MỤC */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* CỘT TRÁI (5 COLS): NƠI UPLOAD / THẺ FILE ĐÃ NẠP */}
        <div className="lg:col-span-5 flex flex-col justify-between">
          {!analysisResult ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`h-full min-h-[380px] cursor-pointer rounded border-2 border-dashed p-6 text-center transition-all duration-200 shadow-[3px_3px_0px_#000] flex flex-col items-center justify-center space-y-4 ${
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

              <div className="w-14 h-14 rounded bg-neutral-100 border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000]">
                {isUploading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-black" />
                ) : (
                  <Upload className="w-6 h-6" />
                )}
              </div>

              <div className="space-y-1">
                <p className="font-mono text-xs sm:text-sm text-black font-bold uppercase tracking-wider">
                  {isUploading
                    ? `ĐANG BÓC TÁCH... ${uploadProgress > 0 ? `[${uploadProgress}%]` : ''}`
                    : 'KÉO THẢ TỆP WORD (.DOCX) HOẶC BẤM ĐỂ CHỌN'}
                </p>
                <p className="font-sans text-[11px] text-neutral-500">
                  Mô tả đề tài / Slide thuyết trình Word (Tối đa 20MB)
                </p>
              </div>

              {errorMessage && (
                <div className="p-2 border border-dashed border-rose-400 bg-rose-50 text-rose-600 font-mono text-[11px] flex items-center gap-1.5 max-w-full">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="pt-2">
                <span className="font-mono text-[10px] bg-neutral-100 border border-black/30 px-2 py-1 text-neutral-600">
                  ĐỊNH DẠNG: .DOCX • KHÔNG CHỨA ẢNH
                </span>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[380px] rounded border-2 border-black bg-white p-4 shadow-[4px_4px_0px_#000] flex flex-col justify-between space-y-4">
              <div className="space-y-3.5">
                {/* Header Thẻ File */}
                <div className="flex items-center justify-between border-b-2 border-black pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-mono text-xs font-bold bg-black text-white px-2 py-0.5">
                      TÀI LIỆU HIỆN HÀNH
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="font-mono text-[11px] font-bold px-2 py-1 rounded border border-black bg-neutral-100 hover:bg-neutral-200 text-black flex items-center gap-1 active:translate-x-0.5 active:translate-y-0.5"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>[NẠP LẠI]</span>
                  </button>
                </div>

                {/* Chi tiết Tệp */}
                <div className="p-3 border-2 border-black bg-neutral-50 space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded border border-black bg-amber-400 flex items-center justify-center shrink-0 mt-0.5 shadow-[1px_1px_0px_#000]">
                      <FileText className="w-4 h-4 text-black" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4
                        className="font-mono font-bold text-xs sm:text-sm text-black truncate"
                        title={fixMojibake(analysisResult.filename)}
                      >
                        {fixMojibake(analysisResult.filename)}
                      </h4>
                      <p className="font-sans text-[11px] text-neutral-500 mt-0.5">
                        Dung lượng: {(analysisResult.fileSizeBytes / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-black/15 font-mono text-[11px]">
                    <div className="bg-white p-2 border border-black/20">
                      <span className="text-neutral-500 block text-[10px]">ĐIỂM MÙ PHÁT HIỆN:</span>
                      <span className="font-bold text-black text-xs flex items-center gap-1 mt-0.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                        {analysisResult.blindSpots.length} ĐIỂM RỦI RO
                      </span>
                    </div>
                    <div className="bg-white p-2 border border-black/20">
                      <span className="text-neutral-500 block text-[10px]">SỐ LIỆU WHITELIST:</span>
                      <span className="font-bold text-black text-xs flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        {analysisResult.entityWhitelist.length} CHỈ SỐ
                      </span>
                    </div>
                  </div>
                </div>

                <p className="font-sans text-xs text-neutral-600 leading-relaxed">
                  Tài liệu đã được bóc tách và nạp vào bộ nhớ In-Memory RAG. Kiểm tra các khối đề mục bên cạnh trước khi vào Đấu trường.
                </p>
              </div>

              {/* Nút Chuyển Tiếp Sang Bước 02 */}
              {onNext && (
                <button
                  type="button"
                  onClick={onNext}
                  className="w-full py-3 px-4 bg-black text-white font-mono font-bold text-xs border-2 border-black shadow-[3px_3px_0px_#eab308] hover:bg-neutral-800 active:translate-x-0.5 active:translate-y-0.5 flex items-center justify-center gap-2 uppercase tracking-wider"
                >
                  <span>[ TIẾN VÀO ĐẤU TRƯỜNG (BƯỚC 02) ]</span>
                  <ArrowRight className="w-4 h-4 text-amber-400" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* CỘT PHẢI (7 COLS): DANH SÁCH 5 KHỐI ĐỀ MỤC DẠNG LIST */}
        <div className="lg:col-span-7 rounded border-2 border-black bg-white p-4 shadow-[4px_4px_0px_#000] flex flex-col justify-between space-y-3">
          {/* Header List */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b-2 border-black">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold bg-black text-white px-2 py-0.5">
                5 KHỐI ĐỀ MỤC
              </span>
              <h3 className="font-headline font-black text-sm text-black uppercase tracking-tight">
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
                    className={`font-mono text-[11px] font-bold flex items-center gap-1 ${
                      isFull ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {isFull ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{found}/{total} KHỐI HOÀN TẤT</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{found}/{total} KHỐI ({total - found} THIẾU)</span>
                      </>
                    )}
                  </span>
                );
              })()
            ) : (
              <span className="font-mono text-[11px] text-neutral-500 font-bold">
                [ CHỜ NẠP TÀI LIỆU ]
              </span>
            )}
          </div>

          {/* Danh sách List Items siêu gọn */}
          <div className="space-y-2">
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
                    className={`rounded border-2 p-2.5 transition-all flex items-center justify-between gap-3 text-xs ${
                      !isResultMode
                        ? 'border-dashed border-neutral-300 bg-neutral-50/60 opacity-60'
                        : isNotFound
                        ? 'border-dashed border-rose-400 bg-rose-50/50'
                        : 'border-black bg-neutral-50 hover:bg-white shadow-[2px_2px_0px_#000]'
                    }`}
                  >
                    {/* Bên trái: Mã khối + Tiêu đề + Cảnh báo */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span
                        className={`font-mono text-[10px] font-bold px-1.5 py-0.5 border shrink-0 ${
                          !isResultMode
                            ? 'border-neutral-400 bg-neutral-200 text-neutral-600'
                            : isNotFound
                            ? 'border-rose-400 bg-rose-100 text-rose-700'
                            : 'border-black bg-black text-white'
                        }`}
                      >
                        0{idx + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`font-bold font-mono text-xs truncate ${
                              isNotFound ? 'text-neutral-600' : 'text-black'
                            }`}
                          >
                            {sec.title}
                          </span>
                          {isNotFound && (
                            <span className="text-[10px] font-mono font-bold text-rose-600 bg-rose-100/80 px-1.5 py-0.2 border border-rose-300 inline-flex items-center gap-1">
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
                            isNotFound ? 'text-rose-500 font-bold' : 'text-neutral-500'
                          }`}
                        >
                          {isNotFound
                            ? '0 TỪ • 0 KÝ TỰ'
                            : `${sec.wordCount} TỪ • ${sec.charCount} KÝ TỰ`}
                        </span>
                      ) : (
                        <span className="text-[10px] text-neutral-400">---</span>
                      )}

                      {isResultMode ? (
                        isNotFound ? (
                          <span className="font-bold text-[10px] text-rose-700 bg-rose-100 px-2 py-0.5 border border-rose-300">
                            CHƯA TÌM THẤY
                          </span>
                        ) : (
                          <span className="font-bold text-[10px] text-emerald-800 bg-emerald-100 px-2 py-0.5 border border-emerald-400">
                            ĐÃ BÓC TÁCH
                          </span>
                        )
                      ) : (
                        <span className="font-mono text-[10px] text-neutral-500 bg-neutral-100 px-2 py-0.5 border border-neutral-300">
                          CHỜ NẠP
                        </span>
                      )}
                    </div>
                  </div>
                );
              }
            )}
          </div>

          <div className="pt-2 border-t border-black/10 flex items-center justify-between text-[11px] font-mono text-neutral-500">
            <span>RAG IN-MEMORY • TỰ ĐỘNG CHUẨN HOÁ HEURISTIC</span>
            <span className="text-[10px]">CHẤP NHẬN FILE .DOCX</span>
          </div>
        </div>
      </div>
    </div>
  );
};
