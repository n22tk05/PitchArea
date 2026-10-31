import React, { useState, useEffect } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  X,
  CheckCircle2,
  AlertCircle,
  Radio,
  Sliders,
  Sparkles,
} from "lucide-react";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { AudioWaveform } from "./AudioWaveform";

interface GlobalMicModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalMicModal: React.FC<GlobalMicModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [testTranscript, setTestTranscript] = useState<string>("");

  const {
    isRecording,
    audioLevel,
    transcript,
    interimTranscript,
    hasMicPermission,
    estimatedWpm,
    isSilent,
    startRecording,
    stopRecording,
    resetTranscript,
  } = useAudioRecorder({
    vadThresholdSec: 2.0,
    onTranscriptChange: (text) => {
      setTestTranscript(text);
    },
  });

  // Tự động dừng ghi âm test khi đóng modal
  useEffect(() => {
    if (!isOpen && isRecording) {
      stopRecording();
    }
  }, [isOpen, isRecording, stopRecording]);

  // Phím Escape đóng modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentDisplay =
    testTranscript ||
    transcript ||
    interimTranscript ||
    (isRecording
      ? "Đang lắng nghe... Hãy thử nói: 'Kính thưa Hội đồng Giám khảo, dự án của chúng tôi...'"
      : "Bấm nút [BẬT MICRO] bên dưới để kiểm tra khả năng thu âm và nhận diện giọng nói.");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn font-mono">
      {/* Modal Container */}
      <div
        className="w-full max-w-xl bg-[#FFFFFF] border-2 border-[#D97706]/40 rounded-3xl shadow-2xl p-6 sm:p-7 flex flex-col gap-5 text-[#1C1917] relative animate-scaleUp overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-[radial-gradient(ellipse_at_center,rgba(217,119,6,0.12),transparent_70%)] pointer-events-none -z-0" />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#D97706]/20 relative z-10">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-pixel text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B]/50 uppercase tracking-wider">
                VOICE LAB // GLOBAL CONTROL
              </span>
              <span
                className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isRecording
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : "bg-stone-100 text-stone-600 border border-stone-200"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isRecording ? "bg-emerald-500 animate-pulse" : "bg-stone-400"
                  }`}
                />
                {isRecording ? "MICRO ĐANG BẬT" : "MICRO ĐANG TẮT"}
              </span>
            </div>
            <h3 className="font-headline font-black text-lg text-[#1C1917] tracking-tight flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-[#B45309]" />
              THIẾT LẬP & KIỂM THỬ MICROPHONE
            </h3>
            <p className="font-sans text-xs text-[#57534E]">
              Kiểm tra thiết bị thu âm, độ nhạy âm lượng và khả năng nhận diện tiếng Việt trước khi vào sàn đấu.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[#FAF8F5] hover:bg-[#FEF3C7] text-[#78716C] hover:text-[#92400E] border border-[#D97706]/25 flex items-center justify-center transition-all cursor-pointer shrink-0"
            title="Đóng modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Indicators Bar */}
        <div className="grid grid-cols-3 gap-2.5 text-xs">
          <div className="p-3 bg-[#FAF8F5] border border-[#D97706]/20 rounded-xl flex flex-col gap-1">
            <span className="text-[9px] font-pixel text-[#78716C] uppercase font-bold">QUYỀN TRUY CẬP:</span>
            <div className="flex items-center gap-1.5 font-bold text-xs">
              {hasMicPermission ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Đã Cho Phép</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-amber-700">Chờ Cấp Quyền</span>
                </>
              )}
            </div>
          </div>

          <div className="p-3 bg-[#FAF8F5] border border-[#D97706]/20 rounded-xl flex flex-col gap-1">
            <span className="text-[9px] font-pixel text-[#78716C] uppercase font-bold">ĐỘ TRỄ STREAM:</span>
            <div className="flex items-center gap-1.5 font-bold text-xs text-[#B45309]">
              <Radio className="w-3.5 h-3.5 text-[#D97706]" />
              <span>~220ms (Chuẩn VAD)</span>
            </div>
          </div>

          <div className="p-3 bg-[#FAF8F5] border border-[#D97706]/20 rounded-xl flex flex-col gap-1">
            <span className="text-[9px] font-pixel text-[#78716C] uppercase font-bold">TỐC ĐỘ NÓI (WPM):</span>
            <div className="flex items-center gap-1.5 font-bold text-xs text-[#1C1917]">
              <Sliders className="w-3.5 h-3.5 text-[#B45309]" />
              <span>{estimatedWpm > 0 ? `${estimatedWpm} từ/phút` : "-- WPM"}</span>
            </div>
          </div>
        </div>

        {/* Audio Visualizer & Waveform */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-pixel text-[#78716C] font-bold px-1">
            <span>SÓNG ÂM THANH (AUDIO SPECTRUM)</span>
            <span className={isRecording ? "text-[#B45309]" : ""}>
              {isRecording ? `LEVEL: ${Math.round(audioLevel * 100)}%` : "STANDBY"}
            </span>
          </div>
          <AudioWaveform
            isRecording={isRecording}
            audioLevel={audioLevel}
            estimatedWpm={estimatedWpm}
            isSilent={isSilent}
          />
        </div>

        {/* Live Speech Recognition Box */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[10px] font-pixel text-[#78716C] font-bold px-1">
            <span>NHẬN DIỆN THỬ NGHIỆM THỜI GIAN THỰC</span>
            {testTranscript && (
              <button
                type="button"
                onClick={() => {
                  setTestTranscript("");
                  resetTranscript();
                }}
                className="text-[#92400E] hover:underline cursor-pointer"
              >
                [ XÓA TEST ]
              </button>
            )}
          </div>
          <div className="p-4 bg-[#FAF8F5] border border-[#D97706]/25 rounded-2xl min-h-[85px] max-h-[120px] overflow-y-auto flex items-center">
            <p
              className={`text-xs font-mono leading-relaxed ${
                testTranscript || transcript
                  ? "text-[#1C1917] font-semibold"
                  : "text-[#78716C] italic"
              }`}
            >
              {currentDisplay}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-3 border-t border-[#D97706]/20 flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            className={`w-full sm:flex-1 py-3.5 font-pixel text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
              isRecording
                ? "bg-rose-600 hover:bg-rose-700 text-white border border-rose-500 active:translate-x-0.5"
                : "bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#92400E] border border-[#F59E0B]/60 active:translate-x-0.5"
            }`}
          >
            {isRecording ? (
              <>
                <MicOff className="w-4 h-4 text-white" />
                <span>TẮT MICRO TEST</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 text-[#92400E]" />
                <span>BẬT MICRO VÀ BẮT ĐẦU NÓI THỬ</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-3.5 bg-[#B45309] hover:bg-[#92400E] text-white font-pixel text-xs font-bold rounded-xl shadow-xs active:translate-x-0.5 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4 text-white" />
            <span>ĐÃ SẴN SÀNG // ĐÓNG</span>
          </button>
        </div>
      </div>
    </div>
  );
};
