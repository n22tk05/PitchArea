import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  DocumentAnalysisResult,
  LobbyConfig as LobbyConfigType,
  EvaluationPreset,
  EvaluationPresetDetails,
  JURY_BOSS_PROFILES,
  RetractionMarkerType,
} from '@pitcharena/shared';
import {
  Mic,
  MicOff,
  Clock,
  Play,
  Pause,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  Volume2,
  Flame,
  AlertTriangle,
  Keyboard,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { useArenaSocket } from '../../hooks/useArenaSocket';

interface Step3PitchingProps {
  documentData: DocumentAnalysisResult | null;
  lobbyConfig?: LobbyConfigType | null;
  arenaSocket?: ReturnType<typeof useArenaSocket>;
  onBack: () => void;
  onNext: (pitchTranscript?: string) => void;
}

export const Step3Pitching: React.FC<Step3PitchingProps> = ({
  documentData,
  lobbyConfig,
  arenaSocket,
  onBack,
  onNext,
}) => {
  // 1. Cấu hình thời gian Pitch (mặc định 2 phút nếu không truyền)
  const pitchMinutes = lobbyConfig?.pitchDurationMinutes || 2;
  const initialTotalSeconds = pitchMinutes * 60;

  // 2. State đồng hồ đếm ngược
  const [remainingSeconds, setRemainingSeconds] = useState(initialTotalSeconds);
  const [isTimerRunning, setIsTimerRunning] = useState(true);

  // 3. Chế độ nhập liệu: Voice qua Micro hoặc Gõ văn bản trực tiếp
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
  const [manualText, setManualText] = useState('');

  // 4. Audio Recorder Hook cho Pitching với Streaming RAG Chunks
  const chunksSentCountRef = useRef(0);

  const handlePitchChunk = useCallback(
    (chunk: {
      sequenceId: number;
      text: string;
      isFinalChunk: boolean;
      detectedMarkers: RetractionMarkerType[];
      timestamp: number;
    }) => {
      chunksSentCountRef.current += 1;
      arenaSocket?.streamPitchChunk(chunk);
    },
    [arenaSocket]
  );

  const {
    isRecording,
    audioLevel,
    transcript,
    interimTranscript,
    speechError,
    estimatedWpm,
    startRecording,
    stopRecording,
    flushRemainingBuffer,
    setManualTranscript,
  } = useAudioRecorder({
    onPitchChunk: handlePitchChunk,
  });

  // Khởi động mic thu âm khi mount
  useEffect(() => {
    startRecording();
    return () => {
      stopRecording();
    };
  }, [startRecording, stopRecording]);

  // Tự động đồng bộ giọng nói sang ô gõ phím khi đang ở chế độ Voice
  useEffect(() => {
    if (transcript && inputMode === 'voice') {
      setManualText(transcript);
    }
  }, [transcript, inputMode]);

  // Bộ đếm lùi thời gian
  useEffect(() => {
    if (!isTimerRunning) return;

    if (remainingSeconds <= 0) {
      setIsTimerRunning(false);
      return;
    }

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          setIsTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isTimerRunning, remainingSeconds]);

  // Định dạng hiển thị phút:giây (MM:SS)
  const formattedTime = useMemo(() => {
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [remainingSeconds]);

  // % Tiến độ thời gian
  const timeProgressPercent = useMemo(() => {
    return Math.max(0, Math.min(100, Math.round((remainingSeconds / initialTotalSeconds) * 100)));
  }, [remainingSeconds, initialTotalSeconds]);

  // Tag đánh giá nhịp độ tốc độ nói gọn gàng: [ NÓI CHẬM ] | [ CHUẨN ] | [ NÓI NHANH ]
  const pacingTag = useMemo(() => {
    if (estimatedWpm === 0) {
      return {
        text: 'CHỜ PHÁT ÂM',
        color: 'bg-[#FAF8F5] text-[#78716C] border-[#D97706]/30',
      };
    }
    if (estimatedWpm < 110) {
      return {
        text: 'NÓI CHẬM',
        color: 'bg-amber-100 text-amber-900 border-amber-300 shadow-xs',
      };
    }
    if (estimatedWpm <= 165) {
      return {
        text: 'CHUẨN',
        color: 'bg-emerald-100 text-emerald-900 border-emerald-300 shadow-xs',
      };
    }
    return {
      text: 'NÓI NHANH',
      color: 'bg-rose-100 text-rose-900 border-rose-300 shadow-xs',
    };
  }, [estimatedWpm]);

  // Toàn bộ lời thoại (kết hợp cả Voice và Manual Text)
  const fullText = useMemo(() => {
    if (inputMode === 'text') {
      return manualText.trim();
    }
    const voiceText = (transcript + ' ' + interimTranscript).trim();
    return voiceText || manualText.trim();
  }, [inputMode, manualText, transcript, interimTranscript]);

  // Kích thước từ cho mỗi batch 2 dòng (khoảng 18 từ là vừa vặn 2 dòng văn bản monospace, không scroll)
  const BATCH_WORDS = 18;

  const currentBatch = useMemo(() => {
    const activeText = inputMode === 'text' ? manualText : transcript;
    const finalWords = activeText.trim() ? activeText.trim().split(/\s+/) : [];
    const interimWords = inputMode === 'voice' && interimTranscript.trim() ? interimTranscript.trim().split(/\s+/) : [];
    const totalWordsCount = finalWords.length + interimWords.length;

    if (totalWordsCount === 0) {
      return { finalPart: '', interimPart: '', batchNumber: 1 };
    }

    // Xác định index bắt đầu của batch 2 dòng hiện tại
    const batchIndex = Math.floor((totalWordsCount - 1) / BATCH_WORDS);
    const startWordIdx = batchIndex * BATCH_WORDS;

    // Lấy các từ thuộc batch hiện tại
    let finalPart = '';
    let interimPart = '';

    if (finalWords.length > startWordIdx) {
      finalPart = finalWords.slice(startWordIdx).join(' ');
      interimPart = interimWords.join(' ');
    } else {
      const interimStartIdx = startWordIdx - finalWords.length;
      interimPart = interimWords.slice(interimStartIdx).join(' ');
    }

    return {
      finalPart,
      interimPart,
      batchNumber: batchIndex + 1,
    };
  }, [transcript, interimTranscript, manualText, inputMode]);

  // Điều khiển đồng hồ
  const handleToggleTimer = () => {
    setIsTimerRunning(!isTimerRunning);
  };

  const handleResetTimer = () => {
    setRemainingSeconds(initialTotalSeconds);
    setIsTimerRunning(true);
  };

  // Bật/tắt Micro
  const handleToggleRecord = () => {
    if (isRecording) {
      stopRecording();
    } else {
      setInputMode('voice');
      startRecording();
    }
  };

  // Người dùng gõ phím trực tiếp
  const handleManualTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setManualText(val);
    setManualTranscript(val);
  };

  // Nạp nhanh bài Pitch mẫu từ hồ sơ đề tài
  const handleFillDemoPitch = () => {
    const demoText =
      documentData?.sections?.length
        ? documentData.sections.map((s) => s.content).join(' ')
        : 'Kính chào Hội đồng Giám khảo. Chúng tôi xin giới thiệu giải pháp ứng dụng công nghệ chuyên sâu giải quyết triệt để bài toán thị trường. Mô hình kinh doanh B2B định kỳ với quy mô thị trường 1.2 tỷ USD, dự kiến hòa vốn sau 8 tháng vận hành.';
    setManualText(demoText);
    setManualTranscript(demoText);
    setInputMode('text');
    if (isRecording) {
      stopRecording();
    }
  };

  // Hoàn tất bài thuyết trình để sang vòng chất vấn
  const handleFinishPitch = () => {
    // Ép xả nốt các từ còn tồn trong buffer trước khi chốt
    flushRemainingBuffer();
    stopRecording();
    const durationSeconds = initialTotalSeconds - remainingSeconds;
    arenaSocket?.finalizePitchStream(
      chunksSentCountRef.current || 1,
      fullText || 'Thí sinh đã hoàn thành phần thuyết minh đề tài.',
      durationSeconds > 0 ? durationSeconds : 1
    );
    onNext(fullText);
  };

  // Thông tin Preset & Boss được cấu hình
  const presetKey = lobbyConfig?.evaluationPreset || EvaluationPreset.SV_STARTUP;
  const presetInfo = EvaluationPresetDetails[presetKey];
  const targetBossId = lobbyConfig?.selectedBoss;
  const targetBoss = targetBossId ? JURY_BOSS_PROFILES[targetBossId] : null;

  return (
    <div className="flex flex-col justify-between gap-3.5 sm:gap-4 font-mono text-[#1C1917] animate-fadeIn w-full">
      {/* ==================== TOP BAR: ĐIỀU HƯỚNG & THÔNG TIN ==================== */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="h-9 px-3.5 border border-[#D97706]/35 bg-[#FFFFFF] hover:bg-[#FEF3C7] text-[#92400E] hover:text-[#B45309] flex items-center gap-2 text-xs font-bold active:translate-x-0.5 shadow-xs transition-all shrink-0 cursor-pointer rounded-xl"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-[#D97706]" />
          <span>QUAY VỀ BƯỚC 02 (SẢNH ĐẤU)</span>
        </button>

        <div className="h-9 border border-[#D97706]/30 bg-[#FFFFFF] px-3.5 shadow-xs flex-1 flex items-center justify-between gap-3 text-xs overflow-hidden rounded-xl">
          <div className="flex items-center gap-2.5">
            <span className="font-pixel text-[9px] bg-[#FEF3C7] text-[#92400E] px-2.5 py-0.5 rounded-full border border-[#F59E0B]/50 font-bold">
              BƯỚC 03 // THUYẾT MINH PITCHING
            </span>
            <span className="text-[#78716C] hidden sm:inline text-xs font-mono">
              ĐỀ TÀI: <strong className="text-[#1C1917] font-bold">{documentData?.filename || 'Đề tài Startup AI'}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#78716C] font-sans hidden md:inline font-bold">HỘI ĐỒNG:</span>
            <span className="font-pixel text-[9px] text-[#B45309] border border-[#D97706]/30 bg-[#FAF8F5] px-2.5 py-0.5 rounded-lg font-bold">
              {targetBoss ? targetBoss.name : presetInfo?.name || 'SV-Startup'}
            </span>
          </div>
        </div>
      </div>

      {/* ==================== CẢNH BÁO MICRO NẾU CÓ LỖI ==================== */}
      {speechError && (
        <div className="border border-amber-300 bg-[#FEF3C7] p-3 shadow-xs text-amber-900 text-xs flex flex-wrap items-center justify-between gap-2.5 shrink-0 rounded-xl">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#D97706] shrink-0" />
            <span>
              <strong>LƯU Ý MICRO:</strong> {speechError}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setInputMode('voice');
                startRecording();
              }}
              className="px-2.5 py-1 bg-[#FFFFFF] text-[#92400E] border border-[#F59E0B]/60 font-bold text-[11px] hover:bg-[#FDE68A] active:translate-x-0.5 rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>THỬ LẠI MICRO</span>
            </button>
            <button
              type="button"
              onClick={handleFillDemoPitch}
              className="px-2.5 py-1 bg-[#B45309] text-white font-bold text-[11px] hover:bg-[#92400E] active:translate-x-0.5 rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-amber-300" />
              <span>DÙNG PITCH MẪU</span>
            </button>
            <button
              type="button"
              onClick={() => setInputMode('text')}
              className="px-2.5 py-1 bg-[#FFFFFF] text-[#1C1917] border border-[#D97706]/30 font-bold text-[11px] hover:bg-[#FAF8F5] active:translate-x-0.5 rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <Keyboard className="w-3 h-3" />
              <span>GÕ BÀN PHÍM</span>
            </button>
          </div>
        </div>
      )}

      {/* ==================== BỐ CỤC 2 CỘT NGANG ==================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 lg:gap-5 w-full items-stretch">
        {/* ==================== CỘT 1 (8 COLS): THỜI GIAN THUYẾT MINH ==================== */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col justify-between p-4 sm:p-5 rounded-2xl bg-[#FFFFFF] border border-[#D97706]/30 shadow-xs gap-3">
          {/* Tiêu đề đồng hồ & Trạng thái chạy */}
          <div className="w-full flex items-center justify-between text-xs pb-2.5 border-b border-[#D97706]/20 shrink-0">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-[#FEF3C7] text-[#B45309] border border-[#D97706]/35">
                <Clock className="w-3.5 h-3.5" />
              </span>
              <span className="font-headline uppercase tracking-wider text-xs sm:text-sm text-[#1C1917] font-bold">
                THỜI GIAN TRÌNH BÀY
              </span>
            </div>

            <span
              className={`px-2.5 py-0.5 rounded-full border text-[9px] sm:text-[10px] font-pixel font-bold tracking-wide ${
                remainingSeconds === 0
                  ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                  : isTimerRunning
                  ? 'bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]/50'
                  : 'bg-[#FAF8F5] text-amber-800 border-amber-300'
              }`}
            >
              {remainingSeconds === 0 ? '● HẾT GIỜ PITCH' : isTimerRunning ? '● ĐANG ĐẾM LÙI' : '❚❚ TẠM DỪNG'}
            </span>
          </div>

          {/* MÀN HÌNH ĐỒNG HỒ LCD */}
          <div
            className={`w-full flex-1 min-h-[110px] sm:min-h-[135px] py-3 sm:py-4 px-4 rounded-xl border-2 flex flex-col items-center justify-center transition-colors relative overflow-hidden shadow-inner ${
              remainingSeconds <= 15 && remainingSeconds > 0
                ? 'bg-rose-50 text-rose-800 border-rose-400 animate-pulse'
                : remainingSeconds === 0
                ? 'bg-rose-50 text-rose-800 border-rose-300'
                : 'bg-[#FAF8F5] text-[#1C1917] border-[#D97706]/35'
            }`}
          >
            {/* SỐ ĐỒNG HỒ KHỔ LỚN */}
            <div className="relative z-10 font-headline text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black tracking-widest select-none text-center leading-none text-[#1C1917]">
              {formattedTime}
            </div>

            <div className="relative z-10 text-[11px] font-mono text-[#78716C] mt-2 flex items-center gap-3 font-bold">
              <span>TỔNG: {pitchMinutes} PHÚT</span>
              <span>•</span>
              <span className="text-[#B45309]">CÒN LẠI: {timeProgressPercent}%</span>
            </div>
          </div>

          {/* Thanh tiến trình */}
          <div className="w-full bg-[#FAF8F5] border border-[#D97706]/20 h-2 rounded-full overflow-hidden shrink-0">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                remainingSeconds <= 15
                  ? 'bg-rose-500'
                  : remainingSeconds <= 40
                  ? 'bg-amber-500'
                  : 'bg-gradient-to-r from-[#D97706] to-[#B45309]'
              }`}
              style={{ width: `${timeProgressPercent}%` }}
            />
          </div>

          {/* Các nút điều khiển đồng hồ: Tạm dừng / Tiếp tục & Đặt lại */}
          <div className="flex items-center gap-2.5 w-full shrink-0">
            <button
              type="button"
              onClick={handleToggleTimer}
              className="flex-1 py-2.5 px-3 border border-[#D97706]/35 rounded-xl text-xs font-pixel font-bold bg-[#FAF8F5] hover:bg-[#FEF3C7] text-[#1C1917] flex items-center justify-center gap-2 active:translate-x-0.5 shadow-xs transition-all cursor-pointer"
            >
              {isTimerRunning ? <Pause className="w-3.5 h-3.5 text-[#D97706]" /> : <Play className="w-3.5 h-3.5 fill-[#D97706] text-[#D97706]" />}
              <span>{isTimerRunning ? 'TẠM DỪNG ĐỒNG HỒ' : 'TIẾP TỤC ĐẾM LÙI'}</span>
            </button>

            <button
              type="button"
              onClick={handleResetTimer}
              className="py-2.5 px-3.5 border border-[#D97706]/35 rounded-xl text-xs font-pixel font-bold bg-[#FAF8F5] hover:bg-[#FEF3C7] text-[#1C1917] flex items-center justify-center gap-1.5 active:translate-x-0.5 shadow-xs transition-all cursor-pointer"
              title="Đặt lại từ đầu"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#D97706]" />
              <span>ĐẶT LẠI</span>
            </button>
          </div>
        </div>

        {/* ==================== CỘT 2 (4 COLS): LỜI THOẠI ĐANG NÓI ==================== */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-3.5 justify-between">
          {/* PHẦN 1: LỜI THOẠI ĐANG NÓI / GÕ PHÍM */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#FFFFFF] border border-[#D97706]/30 shadow-xs flex flex-col justify-between gap-3 flex-1 min-h-0 relative">
            {/* Header: Tiêu đề, Tag Nhịp độ, Nút Mic & Nút Chế độ */}
            <div className="flex flex-col gap-2 pb-2.5 border-b border-[#D97706]/20 text-xs shrink-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-[#D97706]" />
                  <span className="font-headline font-bold uppercase tracking-wider text-xs text-[#1C1917]">
                    LỜI THOẠI PITCH:
                  </span>
                </div>

                {/* Chuyển đổi tab: NÓI MICRO vs GÕ BÀN PHÍM */}
                <div className="flex items-center border border-[#D97706]/25 p-0.5 bg-[#FAF8F5] rounded-lg text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode('voice');
                      if (!isRecording) startRecording();
                    }}
                    className={`px-2.5 py-1 font-headline text-xs font-bold flex items-center gap-1 transition-all cursor-pointer rounded-md ${
                      inputMode === 'voice' ? 'bg-[#B45309] text-white shadow-xs' : 'text-[#78716C] hover:text-[#1C1917]'
                    }`}
                  >
                    <Mic className="w-3 h-3" />
                    <span>NÓI MICRO</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode('text');
                      if (isRecording) stopRecording();
                    }}
                    className={`px-2.5 py-1 font-headline text-xs font-bold flex items-center gap-1 transition-all cursor-pointer rounded-md ${
                      inputMode === 'text' ? 'bg-[#B45309] text-white shadow-xs' : 'text-[#78716C] hover:text-[#1C1917]'
                    }`}
                  >
                    <Keyboard className="w-3 h-3" />
                    <span>GÕ PHÍM</span>
                  </button>
                </div>
              </div>

              {/* Dòng điều khiển phụ: Nhịp độ & Nạp nhanh Pitch mẫu */}
              <div className="flex items-center justify-between gap-2">
                {/* Tag nhịp độ nói */}
                <div className="flex items-center gap-1.5">
                  <span className={`px-2 py-0.5 border text-[9px] font-mono font-bold tracking-wide rounded-full ${pacingTag.color}`}>
                    {pacingTag.text}
                  </span>
                  {estimatedWpm > 0 && (
                    <span className="text-[10px] font-mono text-[#78716C] font-bold">
                      {estimatedWpm} từ/p
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Nút nạp nhanh bài Pitch mẫu */}
                  <button
                    type="button"
                    onClick={handleFillDemoPitch}
                    className="px-2.5 py-0.5 border border-[#D97706]/35 bg-[#FAF8F5] hover:bg-[#FEF3C7] text-[#92400E] text-[11px] font-headline font-bold flex items-center gap-1 active:translate-x-0.5 transition-all cursor-pointer rounded-lg shadow-xs"
                    title="Nạp bài thuyết trình mẫu từ hồ sơ đề tài"
                  >
                    <Sparkles className="w-3 h-3 text-[#D97706]" />
                    <span>PITCH MẪU</span>
                  </button>
                </div>
              </div>
            </div>

            {/* BẢNG ĐIỀU KHIỂN & TRẠNG THÁI MICROPHONE TRỰC QUAN */}
            <div
              className={`p-2.5 rounded-xl border transition-all duration-200 flex items-center justify-between gap-2 shrink-0 ${
                isRecording
                  ? 'bg-emerald-50/80 border-emerald-400 shadow-xs ring-1 ring-emerald-300/40'
                  : 'bg-[#FAF8F5] border-[#D97706]/25'
              }`}
            >
              {/* Bên trái: Trạng thái tức thời & Thanh âm lượng */}
              <div className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-headline font-bold transition-all ${
                    isRecording
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs'
                      : 'bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B]/50'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full transition-all ${
                      isRecording ? 'bg-emerald-500 animate-pulse ring-2 ring-emerald-300' : 'bg-stone-400'
                    }`}
                  />
                  <span>{isRecording ? '● MICRO: BẬT' : '○ MICRO: TẮT'}</span>
                </div>

                {/* Sóng âm thanh năng lượng */}
                {isRecording && (
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-[#FFFFFF] border border-emerald-200 rounded-lg shadow-xs">
                    <div className="flex items-end gap-0.5 h-3">
                      {[1, 2, 3, 4, 5].map((bar) => (
                        <span
                          key={bar}
                          className={`w-1 rounded-full transition-all duration-75 ${
                            (audioLevel / 100) * 5 >= bar ? 'bg-emerald-500' : 'bg-stone-200'
                          }`}
                          style={{ height: `${bar * 2.4}px` }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Bên phải: Nút Bật/Tắt Micro to, nổi bật */}
              <button
                type="button"
                onClick={handleToggleRecord}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-headline font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer active:translate-x-0.5 shrink-0 ${
                  isRecording
                    ? 'bg-rose-600 hover:bg-rose-700 text-white border border-rose-500 shadow-sm'
                    : 'bg-[#B45309] hover:bg-[#92400E] text-white border border-[#B45309]'
                }`}
              >
                {isRecording ? (
                  <>
                    <MicOff className="w-3.5 h-3.5 text-white" />
                    <span>TẮT MICRO</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-3.5 h-3.5 text-white" />
                    <span>BẬT MICRO</span>
                  </>
                )}
              </button>
            </div>

            {/* Nội dung */}
            {inputMode === 'text' ? (
              <div className="relative w-full flex-1 min-h-[65px] max-h-[105px] flex flex-col">
                <textarea
                  value={manualText}
                  onChange={handleManualTextChange}
                  placeholder="Gõ hoặc dán nội dung bài thuyết minh Pitch của bạn vào đây (hệ thống sẽ tự động phân tích đồ thị cho vòng chất vấn)..."
                  className="w-full h-full p-2.5 bg-[#FAF8F5] border border-[#D97706]/25 rounded-xl text-[#1C1917] font-mono text-xs leading-relaxed resize-none focus:outline-none focus:border-[#B45309] placeholder:text-[#A8A29E]"
                />
              </div>
            ) : (
              <div
                onClick={() => setInputMode('text')}
                className="relative w-full flex-1 min-h-[65px] max-h-[105px] bg-[#FAF8F5] border border-[#D97706]/25 rounded-xl px-3 py-2 text-[#1C1917] font-mono text-xs leading-relaxed overflow-hidden flex items-start select-none cursor-text"
                title="Bấm vào để chuyển sang chế độ gõ phím / chỉnh sửa"
              >
                {fullText ? (
                  <div className="relative z-10 w-full max-h-[90px] overflow-y-auto leading-relaxed pr-1 font-mono text-xs">
                    {transcript && (
                      <span className="text-[#1C1917]">
                        {transcript}{' '}
                      </span>
                    )}
                    {interimTranscript && (
                      <span className="text-[#B45309] underline decoration-dotted font-bold animate-pulse">
                        {interimTranscript}
                      </span>
                    )}
                  </div>
                ) : !isRecording ? (
                  <div className="relative z-10 text-[#92400E] text-[11px] font-headline font-semibold flex items-center gap-1.5 my-auto bg-[#FEF3C7] p-2 rounded-lg border border-[#F59E0B]/50 w-full">
                    <MicOff className="w-3.5 h-3.5 text-[#B45309] shrink-0" />
                    <span>Micro đang tắt. Bấm nút [BẬT MICRO] ở trên để nói hoặc chuyển sang [GÕ PHÍM].</span>
                  </div>
                ) : (
                  <div className="relative z-10 text-emerald-800 text-[11px] font-headline font-semibold flex items-center gap-1.5 my-auto">
                    <Mic className="w-3.5 h-3.5 text-emerald-600 animate-pulse shrink-0" />
                    <span>Đang lắng nghe... Nói vào micro hoặc bấm [GÕ PHÍM] / [PITCH MẪU].</span>
                  </div>
                )}
              </div>
            )}

            {/* Footer của khung lời thoại */}
            <div className="text-[10px] text-[#78716C] font-sans flex items-center justify-between pt-1.5 shrink-0 border-t border-[#D97706]/15">
              <span className="truncate max-w-[220px]">
                {inputMode === 'text'
                  ? `* Đang ở chế độ gõ phím (${fullText.split(/\s+/).filter(Boolean).length} từ). Bấm [NÓI MICRO] để bật mic.`
                  : '* Tự động chuyển batch 2 dòng mới khi nói tiếp. Bấm vào khung để chỉnh sửa.'}
              </span>
              {fullText && (
                <span className="font-mono text-[#B45309] font-bold text-[10px] shrink-0">
                  {inputMode === 'voice' ? `BATCH #${String(currentBatch.batchNumber).padStart(2, '0')}` : `${fullText.length} ký tự`}
                </span>
              )}
            </div>
          </div>

          {/* PHẦN 2: SẴN SÀNG ĐỐI MẶT HỘI ĐỒNG PHẢN BIỆN */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-[#FFFFFF] border border-[#D97706]/30 shadow-xs flex flex-col gap-2.5 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#FEF3C7] text-[#B45309] border border-[#D97706]/35 flex items-center justify-center shrink-0 shadow-xs">
                <Flame className="w-4 h-4 fill-[#B45309]" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-headline font-bold text-xs uppercase tracking-wide text-[#1C1917] truncate">
                  SẴN SÀNG ĐỐI MẶT HỘI ĐỒNG PHẢN BIỆN
                </span>
                <span className="text-[10px] font-sans text-[#78716C] truncate">
                  Kết thúc bài thuyết trình để bước vào phòng chất vấn đối đầu giám khảo AI.
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleFinishPitch}
              className="w-full py-2.5 sm:py-3 bg-[#B45309] hover:bg-[#92400E] text-white rounded-xl shadow-xs font-pixel font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all active:translate-x-0.5"
            >
              <span>HOÀN THÀNH PITCHING → BƯỚC 04: CHẤT VẤN</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
