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
        color: 'bg-neutral-200 text-neutral-600 border-neutral-400',
      };
    }
    if (estimatedWpm < 110) {
      return {
        text: 'NÓI CHẬM',
        color: 'bg-amber-400 text-black border-black shadow-[1px_1px_0px_#000]',
      };
    }
    if (estimatedWpm <= 165) {
      return {
        text: 'CHUẨN',
        color: 'bg-emerald-400 text-black border-black shadow-[1px_1px_0px_#000]',
      };
    }
    return {
      text: 'NÓI NHANH',
      color: 'bg-rose-500 text-white border-black shadow-[1px_1px_0px_#000]',
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
    <div className="h-[calc(100vh-8rem)] min-h-[580px] flex flex-col justify-between gap-4 font-mono text-black animate-fadeIn w-full">
      {/* ==================== TOP BAR: ĐIỀU HƯỚNG & THÔNG TIN ==================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="h-9 px-3 border-2 border-black bg-white hover:bg-neutral-100 flex items-center gap-2 text-xs font-bold active:translate-x-0.5 active:translate-y-0.5 shadow-[2px_2px_0px_#000] transition-all shrink-0 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>QUAY VỀ BƯỚC 02 (SẢNH ĐẤU)</span>
        </button>

        <div className="h-9 border-2 border-black bg-white px-3.5 shadow-[2px_2px_0px_#000] flex-1 flex items-center justify-between gap-3 text-xs overflow-hidden">
          <div className="flex items-center gap-2">
            <span className="font-bold bg-amber-400 text-black px-1.5 py-0.5 text-[10px] border border-black">
              BƯỚC 03 // THUYẾT MINH PITCHING
            </span>
            <span className="text-neutral-600 hidden sm:inline text-[11px]">
              ĐỀ TÀI: <strong className="text-black">{documentData?.filename || 'Đề tài Startup AI'}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-neutral-500 font-sans hidden md:inline">HỘI ĐỒNG:</span>
            <span className="font-bold text-black border border-black/20 bg-neutral-100 px-1.5 py-0.5 text-[10px]">
              {targetBoss ? targetBoss.name : presetInfo?.name || 'SV-Startup'}
            </span>
          </div>
        </div>
      </div>

      {/* ==================== CẢNH BÁO MICRO NẾU CÓ LỖI ==================== */}
      {speechError && (
        <div className="border-2 border-amber-500 bg-amber-50 p-3 shadow-[3px_3px_0px_#000] text-amber-900 text-xs flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 animate-bounce" />
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
              className="px-2.5 py-1 bg-amber-400 text-black border-2 border-black font-bold text-[11px] hover:bg-amber-300 active:translate-x-0.5 active:translate-y-0.5 shadow-[1px_1px_0px_#000] flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>THỬ LẠI MICRO</span>
            </button>
            <button
              type="button"
              onClick={handleFillDemoPitch}
              className="px-2.5 py-1 bg-black text-white border-2 border-black font-bold text-[11px] hover:bg-neutral-800 active:translate-x-0.5 active:translate-y-0.5 shadow-[1px_1px_0px_#000] flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>DÙNG PITCH MẪU</span>
            </button>
            <button
              type="button"
              onClick={() => setInputMode('text')}
              className="px-2.5 py-1 bg-white text-black border-2 border-black font-bold text-[11px] hover:bg-neutral-100 active:translate-x-0.5 active:translate-y-0.5 shadow-[1px_1px_0px_#000] flex items-center gap-1 cursor-pointer"
            >
              <Keyboard className="w-3 h-3" />
              <span>GÕ BÀN PHÍM</span>
            </button>
          </div>
        </div>
      )}

      {/* ==================== BỐ CỤC 2 CỘT NGANG (VỪA KHÍT CHIỀU CAO MÀN HÌNH) ==================== */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 ">
        {/* ==================== CỘT 1 (7 COLS): THỜI GIAN THUYẾT MINH (COUNTDOWN TIMER) ==================== */}
        <div className="lg:col-span-8 flex flex-col justify-between border-2 border-black bg-white p-5 shadow-[4px_4px_0px_#000] gap-3 h-full">
          {/* Tiêu đề đồng hồ & Trạng thái chạy */}
          <div className="w-full flex items-center justify-between text-xs pb-2 border-b-2 border-black/15 shrink-0">
            <div className="flex items-center gap-2">
              <span className="p-1 bg-black text-white">
                <Clock className="w-3.5 h-3.5" />
              </span>
              <span className="font-black uppercase tracking-wider text-xs sm:text-sm">
                THỜI GIAN TRÌNH BÀY
              </span>
            </div>

            <span
              className={`px-2 py-0.5 border-2 border-black text-[11px] font-black tracking-wide ${
                remainingSeconds === 0
                  ? 'bg-rose-500 text-white animate-pulse'
                  : isTimerRunning
                  ? 'bg-emerald-400 text-black'
                  : 'bg-amber-300 text-black'
              }`}
            >
              {remainingSeconds === 0 ? '● HẾT GIỜ PITCH' : isTimerRunning ? '● ĐANG ĐẾM LÙI' : '❚❚ TẠM DỪNG'}
            </span>
          </div>

          {/* MÀN HÌNH ĐỒNG HỒ LCD ARCADE TO NHẤT (CO GIÃN CHIỀU CAO FLEX-1) */}
          <div
            className={`w-full flex-1 min-h-0 py-4 px-4 border-2 border-black flex flex-col items-center justify-center transition-colors relative overflow-hidden shadow-[inset_0_0_15px_rgba(0,0,0,0.6)] ${
              remainingSeconds <= 15 && remainingSeconds > 0
                ? 'bg-rose-950 text-rose-400 border-rose-600 animate-pulse'
                : remainingSeconds === 0
                ? 'bg-neutral-900 text-rose-500'
                : 'bg-neutral-950 text-emerald-400'
            }`}
          >
            {/* CRT Scanline */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.35)_50%)] bg-[length:100%_4px] pointer-events-none opacity-40" />

            {/* SỐ ĐỒNG HỒ KHỔ LỚN TO NHẤT */}
            <div className="relative z-10 font-mono text-6xl sm:text-7xl lg:text-8xl xl:text-9xl font-black tracking-widest drop-shadow-[0_2px_10px_rgba(52,211,153,0.3)] select-none text-center leading-none">
              {formattedTime}
            </div>

            <div className="relative z-10 text-[11px] font-mono text-neutral-400 mt-2 flex items-center gap-3">
              <span>TỔNG: {pitchMinutes} PHÚT</span>
              <span>•</span>
              <span>CÒN LẠI: {timeProgressPercent}%</span>
            </div>
          </div>

          {/* Thanh tiến trình Pixel */}
          <div className="w-full bg-neutral-200 border-2 border-black h-2.5 overflow-hidden shrink-0">
            <div
              className={`h-full transition-all duration-500 ${
                remainingSeconds <= 15
                  ? 'bg-rose-500'
                  : remainingSeconds <= 40
                  ? 'bg-amber-400'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${timeProgressPercent}%` }}
            />
          </div>

          {/* Các nút điều khiển đồng hồ: Tạm dừng / Tiếp tục & Đặt lại */}
          <div className="flex items-center gap-3 w-full shrink-0">
            <button
              type="button"
              onClick={handleToggleTimer}
              className="flex-1 py-2 px-3 border-2 border-black text-xs font-black bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center gap-2 active:translate-x-0.5 active:translate-y-0.5 shadow-[2px_2px_0px_#000] cursor-pointer"
            >
              {isTimerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-black" />}
              <span>{isTimerRunning ? 'TẠM DỪNG ĐỒNG HỒ' : 'TIẾP TỤC ĐẾM LÙI'}</span>
            </button>

            <button
              type="button"
              onClick={handleResetTimer}
              className="py-2 px-3 border-2 border-black text-xs font-black bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center gap-1.5 active:translate-x-0.5 active:translate-y-0.5 shadow-[2px_2px_0px_#000] cursor-pointer"
              title="Đặt lại từ đầu"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>ĐẶT LẠI</span>
            </button>
          </div>
        </div>

        {/* ==================== CỘT 2 (4 COLS): LỜI THOẠI ĐANG NÓI & SẴN SÀNG ĐỐI MẶT ==================== */}
        <div className="lg:col-span-4 flex flex-col gap-4 ">
          {/* PHẦN 1: LỜI THOẠI ĐANG NÓI / GÕ PHÍM + TAG NHỊP ĐỘ + ĐIỀU KHIỂN */}
          <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_#000] flex flex-col justify-between gap-3 flex-1 min-h-0">
            {/* Header: Tiêu đề, Tag Nhịp độ, Nút Mic & Nút Chế độ */}
            <div className="flex flex-col gap-2 pb-2 border-b border-black/15 text-xs shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-black" />
                  <span className="font-black uppercase tracking-wider text-xs">
                    LỜI THOẠI PITCH:
                  </span>
                </div>

                {/* Chuyển đổi tab: NÓI MICRO vs GÕ BÀN PHÍM */}
                <div className="flex items-center border border-black p-0.5 bg-neutral-100 text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode('voice');
                      if (!isRecording) startRecording();
                    }}
                    className={`px-2 py-0.5 font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      inputMode === 'voice' ? 'bg-black text-white shadow-[1px_1px_0px_#000]' : 'text-neutral-600 hover:text-black'
                    }`}
                  >
                    <Mic className="w-3 h-3" />
                    <span>NÓI MICRO</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('text')}
                    className={`px-2 py-0.5 font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      inputMode === 'text' ? 'bg-black text-white shadow-[1px_1px_0px_#000]' : 'text-neutral-600 hover:text-black'
                    }`}
                  >
                    <Keyboard className="w-3 h-3" />
                    <span>GÕ PHÍM</span>
                  </button>
                </div>
              </div>

              {/* Dòng điều khiển phụ: Tag Nhịp độ, Sóng âm, Bật/Tắt Mic, Nạp Demo */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                {/* Tag nhịp độ nói: CHẬM / CHUẨN / NHANH */}
                <div className="flex items-center gap-1.5">
                  <span className={`px-1.5 py-0.5 border text-[10px] font-black tracking-wide ${pacingTag.color}`}>
                    {pacingTag.text}
                  </span>

                  {/* Sóng âm Audio Wave động phản hồi âm thanh thực tế */}
                  {isRecording && (
                    <div className="flex items-end gap-0.5 h-3.5 px-1 bg-neutral-900 border border-black" title={`Âm lượng: ${audioLevel}%`}>
                      <span className="w-1 bg-emerald-400 rounded-xs transition-all duration-75" style={{ height: `${Math.max(3, (audioLevel / 100) * 12)}px` }} />
                      <span className="w-1 bg-emerald-400 rounded-xs transition-all duration-75" style={{ height: `${Math.max(4, (audioLevel / 100) * 14)}px` }} />
                      <span className="w-1 bg-emerald-400 rounded-xs transition-all duration-75" style={{ height: `${Math.max(2, (audioLevel / 100) * 10)}px` }} />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Nút nạp nhanh bài Pitch mẫu */}
                  <button
                    type="button"
                    onClick={handleFillDemoPitch}
                    className="px-2 py-0.5 border border-black bg-neutral-100 hover:bg-amber-300 text-[10px] font-bold flex items-center gap-1 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer shadow-[1px_1px_0px_#000]"
                    title="Nạp bài thuyết trình mẫu từ hồ sơ đề tài"
                  >
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    <span className="hidden sm:inline">PITCH MẪU</span>
                  </button>

                  {/* Nút bật/tắt Micro */}
                  <button
                    type="button"
                    onClick={handleToggleRecord}
                    className={`px-2 py-0.5 border-2 border-black text-[10px] font-bold flex items-center gap-1 shadow-[1px_1px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer ${
                      isRecording ? 'bg-rose-500 text-white animate-pulse' : 'bg-emerald-400 text-black hover:bg-emerald-300'
                    }`}
                  >
                    {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    <span>{isRecording ? 'DỪNG MIC' : 'BẬT MIC'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Nội dung: Hiển thị 2 dòng LCD hoặc Textarea gõ phím tùy chế độ */}
            {inputMode === 'text' ? (
              <div className="relative w-full flex-1 min-h-[90px] flex flex-col">
                <textarea
                  value={manualText}
                  onChange={handleManualTextChange}
                  placeholder="Gõ hoặc dán nội dung bài thuyết minh Pitch của bạn vào đây (hệ thống sẽ tự động phân tích đồ thị cho vòng chất vấn)..."
                  className="w-full flex-1 p-2.5 bg-neutral-950 border-2 border-black text-emerald-400 font-mono text-xs leading-5 resize-none focus:outline-none focus:border-amber-400 shadow-[inset_0_0_10px_rgba(0,0,0,0.8)] placeholder:text-neutral-600"
                />
              </div>
            ) : (
              <div
                onClick={() => setInputMode('text')}
                className="relative w-full flex-1 min-h-[75px] max-h-[140px] bg-neutral-950 border-2 border-black px-3.5 py-2 text-emerald-400 font-mono text-xs sm:text-sm leading-6 overflow-hidden flex items-start select-none cursor-text"
                title="Bấm vào để chuyển sang chế độ gõ phím / chỉnh sửa"
              >
                {/* CRT scanline mỏng */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.3)_50%)] bg-[length:100%_4px] pointer-events-none opacity-25" />

                {fullText ? (
                  <div className="relative z-10 w-full max-h-[120px] overflow-y-auto leading-6 pr-1 font-mono">
                    {transcript && (
                      <span className="text-emerald-300">
                        {transcript}{' '}
                      </span>
                    )}
                    {interimTranscript && (
                      <span className="text-amber-300 underline decoration-dotted font-bold animate-pulse">
                        {interimTranscript}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="relative z-10 text-neutral-500 text-xs italic flex items-center gap-2 my-auto">
                    <Mic className="w-3.5 h-3.5 text-neutral-400 animate-pulse" />
                    <span>Đang lắng nghe... Nói vào micro hoặc bấm [GÕ PHÍM] / [PITCH MẪU].</span>
                  </div>
                )}
              </div>
            )}

            {/* Footer của khung lời thoại */}
            <div className="text-[10px] text-neutral-500 font-sans flex items-center justify-between pt-1 shrink-0 border-t border-black/10">
              <span className="text-neutral-600">
                {inputMode === 'text'
                  ? `* Đang ở chế độ gõ phím (${fullText.split(/\s+/).filter(Boolean).length} từ). Bấm [NÓI MICRO] để bật mic.`
                  : '* Tự động chuyển batch 2 dòng mới khi nói tiếp. Bấm vào khung để chỉnh sửa.'}
              </span>
              {fullText && (
                <span className="font-mono text-neutral-700 font-bold">
                  {inputMode === 'voice' ? `BATCH #${String(currentBatch.batchNumber).padStart(2, '0')}` : `${fullText.length} ký tự`}
                </span>
              )}
            </div>
          </div>

          {/* PHẦN 2: SẴN SÀNG ĐỐI MẶT HỘI ĐỒNG PHẢN BIỆN (NÚT HOÀN TẤT) */}
          <div className="border-2 border-black bg-neutral-900 text-white p-4 shadow-[4px_4px_0px_#000] flex flex-col gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-amber-400 text-black flex items-center justify-center border-2 border-black shrink-0">
                <Flame className="w-4 h-4 fill-black" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-xs uppercase tracking-wide text-amber-300">
                  SẴN SÀNG ĐỐI MẶT HỘI ĐỒNG PHẢN BIỆN
                </span>
                <span className="text-[10px] font-sans text-neutral-400">
                  Kết thúc bài thuyết trình để bước vào phòng chất vấn đối đầu giám khảo AI.
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleFinishPitch}
              className="w-full py-3 bg-amber-400 text-black font-mono font-black text-xs border-2 border-black shadow-[3px_3px_0px_#fff] hover:bg-amber-300 active:translate-x-0.5 active:translate-y-0.5 flex items-center justify-center gap-2 uppercase tracking-wider transition-all cursor-pointer"
            >
              <span>HOÀN THÀNH PITCHING → BƯỚC 04: CHẤT VẤN</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
