import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  CombatDifficulty,
  CombatDifficultyDetails,
  ArenaMode,
  JuryBossId,
  JURY_BOSS_PROFILES,
  LobbyConfig as LobbyConfigType,
  DocumentAnalysisResult,
  SessionFsmState,
  EvaluationPreset,
  EvaluationPresetDetails,
  getAvailableBossesForSections,
  BOSS_TO_SECTION_MAP,
  BusinessSectionLabel,
} from "@pitcharena/shared";
import {
  ArrowLeft,
  Flame,
  Swords,
  Coins,
  Cpu,
  ShieldAlert,
  Play,
  RotateCcw,
  Volume2,
  Clock,
  Award,
  Sliders,
  Layers,
  Zap,
} from "lucide-react";
import { useArenaSocket } from "../hooks/useArenaSocket";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { AudioWaveform } from "./AudioWaveform";
import { fixMojibake } from "./DocumentUploader";
import { RetroSelect, RetroOption } from "./RetroSelect";

interface LobbyConfigProps {
  documentData: DocumentAnalysisResult;
  onBackToUpload?: () => void;
  onStartCombat?: (config: LobbyConfigType) => void;
}

export const LobbyConfig: React.FC<LobbyConfigProps> = ({
  documentData,
  onBackToUpload,
  onStartCombat,
}) => {
  const sessionId = `session-${documentData.documentId}`;

  // Lọc danh sách Giám khảo có khối đề mục tồn tại trong tài liệu
  const availableBossIds = useMemo(() => {
    return getAvailableBossesForSections(documentData?.sections);
  }, [documentData?.sections]);

  const defaultBoss = availableBossIds[0] || JuryBossId.FINANCE_DRAGON;

  // Cấu hình ban đầu
  const [config, setConfig] = useState<LobbyConfigType>({
    mode: ArenaMode.FULL_ARENA,
    difficulty: CombatDifficulty.NORMAL,
    selectedBoss: defaultBoss,
    evaluationPreset: EvaluationPreset.SV_STARTUP,
    pitchDurationMinutes: 2,
    qaDurationMinutes: 3,
    roundDurationSeconds: 30,
    prepBufferSeconds: 3,
    enableLiveSubtitles: true,
    pedagogicalShieldFloor: 20,
  });

  // Tự động chuyển Solo Boss sang Boss khả dụng nếu boss hiện tại không tồn tại trong tài liệu
  useEffect(() => {
    if (
      availableBossIds.length > 0 &&
      config.selectedBoss &&
      !availableBossIds.includes(config.selectedBoss)
    ) {
      const fallbackBoss = availableBossIds[0];
      setConfig((prev) => ({ ...prev, selectedBoss: fallbackBoss }));
    }
  }, [availableBossIds, config.selectedBoss]);

  // WebSocket Hook
  const {
    isConnected,
    sessionState,
    timerData,
    liveTranscript,
    updateConfig,
    startCombat,
    submitTranscript,
  } = useArenaSocket(sessionId, documentData.documentId);

  // Audio Recorder Transcript Callback
  const handleTranscriptChange = useCallback(
    (text: string, isFinal: boolean, wpm?: number) => {
      submitTranscript(text, isFinal, wpm);
    },
    [submitTranscript],
  );

  // Audio Recorder Hook với VAD gap tương ứng cấp độ khó đã chọn
  const {
    isRecording,
    audioLevel,
    transcript,
    interimTranscript,
    estimatedWpm,
    isSilent,
    startRecording,
    stopRecording,
  } = useAudioRecorder({
    vadThresholdSec: CombatDifficultyDetails[config.difficulty].vadSilenceSec,
    onTranscriptChange: handleTranscriptChange,
  });

  // 1. Chuyển đổi Mode
  const handleModeChange = (mode: ArenaMode) => {
    const updated = { ...config, mode };
    setConfig(updated);
    updateConfig(updated);
  };

  // 2. Chuyển đổi Preset Thẩm định
  const handlePresetChange = (preset: EvaluationPreset) => {
    const presetInfo = EvaluationPresetDetails[preset];
    const targetBoss = availableBossIds.includes(presetInfo.targetBoss)
      ? presetInfo.targetBoss
      : (availableBossIds[0] ?? config.selectedBoss);
    const updated = {
      ...config,
      evaluationPreset: preset,
      selectedBoss:
        config.mode === ArenaMode.QUICK_COMBAT
          ? targetBoss
          : config.selectedBoss,
    };
    setConfig(updated);
    updateConfig(updated);
  };

  // 3. Chuyển đổi Độ khó
  const handleDifficultyChange = (difficulty: CombatDifficulty) => {
    const floor =
      difficulty === CombatDifficulty.EASY
        ? 30
        : difficulty === CombatDifficulty.NORMAL
          ? 20
          : 10;
    const updated = { ...config, difficulty, pedagogicalShieldFloor: floor };
    setConfig(updated);
    updateConfig(updated);
  };

  // 4. Chọn Solo Boss
  const handleBossSelect = (bossId: JuryBossId) => {
    if (!availableBossIds.includes(bossId)) return;
    const updated = {
      ...config,
      selectedBoss: bossId,
      mode: ArenaMode.QUICK_COMBAT,
    };
    setConfig(updated);
    updateConfig(updated);
  };

  // 5. Cập nhật thời gian Pitch (1 - 5 phút)
  const handlePitchDurationChange = (minutes: number) => {
    const updated = { ...config, pitchDurationMinutes: minutes };
    setConfig(updated);
    updateConfig(updated);
  };

  // 6. Cập nhật thời gian Q&A (1 - 5 phút)
  const handleQaDurationChange = (minutes: number) => {
    const updated = { ...config, qaDurationMinutes: minutes };
    setConfig(updated);
    updateConfig(updated);
  };

  // 7. Toggle Phụ đề
  const handleToggleSubtitles = () => {
    const updated = {
      ...config,
      enableLiveSubtitles: !config.enableLiveSubtitles,
    };
    setConfig(updated);
    updateConfig(updated);
  };

  const fsmState =
    timerData?.fsmState ||
    sessionState?.fsmState ||
    SessionFsmState.LOBBY_READY;
  const isCombatStarted = fsmState !== SessionFsmState.LOBBY_READY;

  const totalMinutes =
    (config.pitchDurationMinutes || 2) + (config.qaDurationMinutes || 3);

  const handleStart = () => {
    startCombat();
    if (onStartCombat) {
      onStartCombat(config);
    }
  };

  // Retro Options Data Definitions
  const modeOptions: RetroOption<ArenaMode>[] = [
    {
      value: ArenaMode.FULL_ARENA,
      label: "Hội Đồng Toàn Diện (3 Boss)",
      subLabel: "3 Giám khảo AI luân phiên phản biện theo 5 phân mục",
      badge: "3 BOSS",
      badgeColor: "bg-black text-white",
      icon: <Layers className="w-3.5 h-3.5" />,
    },
    {
      value: ArenaMode.QUICK_COMBAT,
      label: "Solo Boss 1-1 (Đối Chất)",
      subLabel: "Đối chất 1-1 trực diện, 2 Boss còn lại mờ 25%",
      badge: "SOLO",
      badgeColor: "bg-amber-400 text-black",
      icon: <Zap className="w-3.5 h-3.5 text-amber-500" />,
    },
  ];

  const presetOptions: RetroOption<EvaluationPreset>[] = [
    {
      value: EvaluationPreset.SV_STARTUP,
      label: "SV-Startup & Euréka",
      subLabel: "Bộ GD&ĐT / Thành Đoàn (Cấp thiết, Đổi mới, Khả thi)",
      badge: "PRESET 1",
      badgeColor: "bg-neutral-100 text-black",
      icon: <Award className="w-3.5 h-3.5" />,
    },
    {
      value: EvaluationPreset.SEED_ANGEL,
      label: "Seed / Angel Pitch",
      subLabel: "Quỹ Thiên Thần / Hạt Giống (Unit Economics, CAC/LTV, Moat)",
      badge: "PRESET 2",
      badgeColor: "bg-amber-100 text-amber-900",
      icon: <Coins className="w-3.5 h-3.5" />,
    },
    {
      value: EvaluationPreset.TECH_PATENT,
      label: "Tech & IP Patent",
      subLabel: "Sở Hữu Trí Tuệ & Công Nghệ Lõi (Độ sâu thuật toán, Dữ liệu)",
      badge: "PRESET 3",
      badgeColor: "bg-blue-100 text-blue-900",
      icon: <Cpu className="w-3.5 h-3.5" />,
    },
  ];

  const difficultyOptions: RetroOption<CombatDifficulty>[] = [
    {
      value: CombatDifficulty.EASY,
      label: "Tân Thủ (Easy)",
      subLabel: "VAD gap 3.5s • Phù hợp làm quen & tập dượt",
    },
    {
      value: CombatDifficulty.NORMAL,
      label: "Tiêu Chuẩn (Normal)",
      subLabel: "VAD gap 2.0s • Nhịp độ chuẩn thi đấu",
    },
    {
      value: CombatDifficulty.HARDCORE,
      label: "Khắc Nghiệt (Hardcore)",
      subLabel: "VAD gap 1.0s • Phản xạ nhanh, dồn dập",
    },
  ];

  const pitchOptions: RetroOption<number>[] = [
    { value: 1, label: "1 Phút (60 giây)" },
    {
      value: 2,
      label: "2 Phút (120 giây)",
      badge: "KHUYÊN DÙNG",
      badgeColor: "bg-amber-300 text-black",
    },
    { value: 3, label: "3 Phút (180 giây)" },
    { value: 4, label: "4 Phút (240 giây)" },
    { value: 5, label: "5 Phút (300 giây)", badge: "TỐI ĐA" },
  ];

  const qaOptions: RetroOption<number>[] = [
    { value: 1, label: "1 Phút (60 giây)" },
    { value: 2, label: "2 Phút (120 giây)" },
    {
      value: 3,
      label: "3 Phút (180 giây)",
      badge: "KHUYÊN DÙNG",
      badgeColor: "bg-amber-300 text-black",
    },
    { value: 4, label: "4 Phút (240 giây)" },
    { value: 5, label: "5 Phút (300 giây)", badge: "TỐI ĐA" },
  ];

  return (
    <div className="w-full flex flex-col gap-4 font-mono text-black">
      {/* Top Header: Đồng bộ chiều cao chuẩn Pixel */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {onBackToUpload && (
          <button
            type="button"
            onClick={onBackToUpload}
            className="h-10 px-3.5 border-2 border-black bg-white hover:bg-neutral-100 flex items-center gap-2 text-xs font-bold active:translate-x-0.5 active:translate-y-0.5 shadow-[3px_3px_0px_#000] transition-all shrink-0"
            title="Quay về Bước 01: Nạp tài liệu đề tài"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>QUAY VỀ BƯỚC 01</span>
          </button>
        )}

        <div className="h-10 border-2 border-black bg-white px-4 shadow-[3px_3px_0px_#000] flex-1 flex items-center justify-between gap-3 text-xs overflow-hidden">
          <span className="font-bold bg-black text-white px-2 py-0.5 shrink-0">
            BƯỚC 02 // SẢNH ĐẤU & VOICE LOBBY
          </span>
          <span className="text-neutral-600 truncate flex items-center gap-1.5">
            <span>TÀI LIỆU:</span>
            <strong className="text-black truncate">
              {fixMojibake(documentData.filename)}
            </strong>
          </span>
        </div>
      </div>

      {/* Main Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* ==================== CỘT TRÁI (7 COLS): CẤU HÌNH THI ĐẤU & HỘI ĐỒNG GIÁM KHẢO ==================== */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* KHỐI 1: BẢNG THIẾT LẬP DẠNG RETRO SELECT DROPDOWN (Chuẩn Monochrome Retro Pixel) */}
          <div className="border-2 border-black bg-white p-4 shadow-[3px_3px_0px_#000] flex flex-col gap-3.5 relative z-20">
            <div className="flex items-center justify-between pb-2 border-b border-black/15">
              <span className="font-bold text-xs flex items-center gap-1.5 uppercase">
                <Swords className="w-3.5 h-3.5" />
                CẤU HÌNH THI ĐẤU (MATCH SETTINGS)
              </span>
              <span className="text-[10px] text-neutral-500 font-sans">
                Tùy chỉnh luật đấu trước khi vào sàn
              </span>
            </div>

            {/* Hàng 1: Format thi đấu & Cấp độ khó (2 Retro Selects song song) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs relative z-30">
              <div>
                <label className="block text-[11px] font-bold text-neutral-700 mb-1 flex items-center gap-1">
                  <Swords className="w-3 h-3" />
                  1. FORMAT THI ĐẤU:
                </label>
                <RetroSelect<ArenaMode>
                  value={config.mode}
                  onChange={handleModeChange}
                  options={modeOptions}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-700 mb-1 flex items-center gap-1">
                  <Sliders className="w-3 h-3" />
                  2. CẤP ĐỘ KHÓ:
                </label>
                <RetroSelect<CombatDifficulty>
                  value={config.difficulty}
                  onChange={handleDifficultyChange}
                  options={difficultyOptions}
                />
              </div>
            </div>

            {/* Hàng 2: Preset Thẩm định (Retro Select toàn dòng) */}
            <div className="flex flex-col gap-1 relative z-20">
              <label className="block text-[11px] font-bold text-neutral-700 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Award className="w-3 h-3" />
                  3. PRESET THẨM ĐỊNH MỤC TIÊU:
                </span>
                <span className="text-[10px] text-neutral-500 font-sans">
                  Gợi ý trọng tâm phản biện
                </span>
              </label>
              <RetroSelect<EvaluationPreset>
                value={config.evaluationPreset || EvaluationPreset.SV_STARTUP}
                onChange={handlePresetChange}
                options={presetOptions}
              />

              {/* Dòng mô tả ngắn gọn về trọng tâm preset */}
              <div className="text-[10px] font-sans text-neutral-600 bg-neutral-50 px-2.5 py-1.5 border border-neutral-300 flex items-center gap-1.5 mt-1">
                <span className="font-bold text-black font-mono">
                  TRỌNG TÂM:
                </span>
                <span className="truncate">
                  {
                    EvaluationPresetDetails[
                      config.evaluationPreset || EvaluationPreset.SV_STARTUP
                    ].focus
                  }
                </span>
              </div>
            </div>

            {/* Hàng 3: Thời gian Pitch & Q&A (2 Retro Selects song song + Badge tổng) */}
            <div className="pt-2 border-t border-black/15 flex flex-col gap-2 relative z-10">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  4. THỜI GIAN PITCH & Q&A:
                </span>
                <span className="font-bold bg-black text-white px-2 py-0.5 text-[11px] shadow-[1px_1px_0px_#eab308]">
                  TỔNG CỘNG: {String(totalMinutes).padStart(2, "0")}:00 PHÚT
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-600 mb-1">
                    A. THỜI GIAN PITCHING:
                  </label>
                  <RetroSelect<number>
                    value={config.pitchDurationMinutes || 2}
                    onChange={handlePitchDurationChange}
                    options={pitchOptions}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-600 mb-1">
                    B. THỜI GIAN PHẢN BIỆN Q&A:
                  </label>
                  <RetroSelect<number>
                    value={config.qaDurationMinutes || 3}
                    onChange={handleQaDurationChange}
                    options={qaOptions}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* KHỐI 2: HỘI ĐỒNG GIÁM KHẢO (3 Bosses) */}
          <div className="border-2 border-black bg-white p-4 shadow-[3px_3px_0px_#000] flex flex-col gap-2.5 relative z-10">
            <div className="flex items-center justify-between pb-2 border-b border-black/20">
              <div className="flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-black" />
                <h3 className="font-bold text-xs uppercase">
                  5. THÀNH PHẦN HỘI ĐỒNG GIÁM KHẢO
                </h3>
              </div>
              <span className="text-[10px] text-neutral-500">
                {config.mode === ArenaMode.QUICK_COMBAT
                  ? "Bấm chọn 1 Solo Boss (2 Boss mờ 25%)"
                  : `Cả ${availableBossIds.length} Giám khảo khả dụng cùng tham gia`}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {Object.values(JURY_BOSS_PROFILES).map((boss) => {
                const isAvailable = availableBossIds.includes(boss.id);
                const isSoloSelected =
                  isAvailable &&
                  config.mode === ArenaMode.QUICK_COMBAT &&
                  config.selectedBoss === boss.id;
                const isDimmed =
                  isAvailable &&
                  config.mode === ArenaMode.QUICK_COMBAT &&
                  config.selectedBoss !== boss.id;
                const isFullActive =
                  isAvailable && config.mode === ArenaMode.FULL_ARENA;

                const requiredSections = BOSS_TO_SECTION_MAP[boss.id] || [];
                const missingSectionNames = requiredSections
                  .map((s) => BusinessSectionLabel[s] || s)
                  .join(", ");

                const IconComponent =
                  boss.id === JuryBossId.MARKET_SHARK
                    ? Zap
                    : boss.id === JuryBossId.TECH_SENTINEL
                    ? Cpu
                    : boss.id === JuryBossId.FINANCE_DRAGON
                    ? Coins
                    : ShieldAlert;

                return (
                  <div
                    key={boss.id}
                    onClick={() => isAvailable && handleBossSelect(boss.id)}
                    className={`border-2 p-2.5 transition-all duration-300 flex flex-col justify-between gap-1.5 relative ${
                      !isAvailable
                        ? "opacity-40 border-dashed border-neutral-400 bg-neutral-100 cursor-not-allowed filter grayscale select-none"
                        : isDimmed
                          ? "opacity-25 border-dashed border-neutral-400 bg-neutral-100 filter grayscale cursor-pointer"
                          : isSoloSelected
                            ? "border-black bg-neutral-50 shadow-[3px_3px_0px_#000] ring-2 ring-amber-400 cursor-pointer"
                            : isFullActive
                              ? "border-black bg-white shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] cursor-pointer"
                              : "border-black bg-white cursor-pointer"
                    }`}
                  >
                    {!isAvailable && (
                      <span className="absolute -top-2 right-1.5 bg-neutral-800 text-white border border-black text-[8px] font-bold px-1.5 py-0.5 tracking-wider">
                        VẮNG MẶT
                      </span>
                    )}

                    {isSoloSelected && (
                      <span className="absolute -top-2 right-1.5 bg-amber-400 text-black border border-black text-[8px] font-bold px-1 py-0.1">
                        TARGET BOSS
                      </span>
                    )}

                    {isFullActive && (
                      <span className="absolute -top-2 right-1.5 bg-emerald-100 text-emerald-800 border border-emerald-400 text-[8px] font-bold px-1 py-0.1">
                        CO-DEFENSE
                      </span>
                    )}

                    <div className="flex items-center justify-between">
                      <div
                        className={`p-1 border border-black ${
                          !isAvailable ? "bg-neutral-500" : "bg-black"
                        } text-white`}
                      >
                        <IconComponent className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[9px] font-bold border border-black px-1">
                        LV.{boss.level}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-xs truncate">
                        {boss.name}
                      </h4>
                      <p className="text-[9px] text-neutral-500 font-sans truncate">
                        {boss.title}
                      </p>
                    </div>

                    {!isAvailable ? (
                      <div className="text-[8px] text-neutral-600 font-sans pt-1 border-t border-dashed border-neutral-300">
                        <span className="font-bold uppercase tracking-wider block text-red-600">
                          Thiếu đề mục:
                        </span>
                        <span className="line-clamp-2" title={missingSectionNames}>
                          {missingSectionNames}
                        </span>
                      </div>
                    ) : isDimmed ? (
                      <div className="text-[8px] text-center font-bold text-neutral-500 uppercase tracking-widest pt-1 border-t border-dashed border-neutral-300">
                        [ MỜ 25% ]
                      </div>
                    ) : (
                      <div className="text-[8px] text-neutral-600 font-sans line-clamp-1 border-t border-black/10 pt-1">
                        {boss.domain}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ==================== CỘT PHẢI (5 COLS): KIỂM THỬ GIỌNG NÓI & NÚT BẮT ĐẦU ==================== */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Kiểm thử Micro  */}
          <div className="border-2 border-black bg-white p-4 shadow-[3px_3px_0px_#000] flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-black/20">
              <div className="flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-black" />
                <h3 className="font-bold text-xs uppercase">
                  KIỂM THỬ MICRO
                </h3>
              </div>
              <button
                type="button"
                onClick={handleToggleSubtitles}
                className="text-[10px] font-bold underline cursor-pointer hover:text-amber-600"
              >
                {config.enableLiveSubtitles ? "PHỤ ĐỀ: BẬT" : "PHỤ ĐỀ: TẮT"}
              </button>
            </div>

            <AudioWaveform
              isRecording={isRecording}
              audioLevel={audioLevel}
              estimatedWpm={estimatedWpm}
              isSilent={isSilent}
            />

            {/* Mic Toggle Button */}
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-full py-2 font-mono text-xs font-bold border-2 border-black transition-all ${
                isRecording
                  ? "bg-rose-500 text-white shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5"
                  : "bg-emerald-400 text-black shadow-[2px_2px_0px_#000] hover:bg-emerald-300 active:translate-x-0.5 active:translate-y-0.5"
              }`}
            >
              {isRecording ? "■ DỪNG MICRO TEST" : "▶ BẬT MICRO TEST GIỌNG NÓI"}
            </button>

            {/* Real-time Subtitle & Transcript Preview */}
            <div className="border border-black bg-neutral-900 text-emerald-400 p-2.5 font-mono text-[11px] min-h-[60px] flex flex-col justify-between">
              <div className="flex items-center justify-between text-[9px] text-neutral-400 border-b border-neutral-700 pb-1 mb-1">
                <span>LIVE PREVIEW (220ms STREAM)</span>
                <span>{isRecording ? "STREAMING..." : "IDLE"}</span>
              </div>
              <p className="leading-snug text-xs line-clamp-2">
                {transcript || interimTranscript || liveTranscript?.text || (
                  <span className="text-neutral-500 italic text-[11px]">
                    Bật micro và thử nói: "Xin chào hội đồng, giải pháp của
                    chúng tôi giải quyết..."
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Action Card: Khởi động Đấu trường (Chuẩn hóa vị trí & bọc khung Retro Card) */}
          <div className="border-2 border-black bg-white p-4 shadow-[3px_3px_0px_#000] flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-black/15 text-xs">
              <span className="font-bold flex items-center gap-1.5 uppercase">
                <Play className="w-3.5 h-3.5 fill-black" />
                SẴN SÀNG VÀO SÀN ĐẤU
              </span>
           
            </div>

            {/* Tóm tắt nhanh thông số đã chọn */}
            <div className="grid grid-cols-2 gap-2 text-[11px] bg-neutral-50 p-2.5 border border-black/15">
              <div>
                <span className="text-neutral-500 block text-[10px]">ĐỐI THỦ:</span>
                <strong className="text-black line-clamp-1">
                  {config.mode === ArenaMode.FULL_ARENA
                    ? "Hội đồng 3 Boss"
                    : `Solo: ${JURY_BOSS_PROFILES[config.selectedBoss]?.name || "Solo Boss"}`}
                </strong>
              </div>
              <div>
                <span className="text-neutral-500 block text-[10px]">THỜI LƯỢNG:</span>
                <strong className="text-black">
                  {config.pitchDurationMinutes} phút Pitch + {config.qaDurationMinutes} phút Q&A
                </strong>
              </div>
            </div>

            <button
              type="button"
              onClick={handleStart}
              className="w-full py-3 bg-black text-white font-mono font-bold text-xs border-2 border-black shadow-[3px_3px_0px_#eab308] hover:bg-neutral-800 active:translate-x-0.5 active:translate-y-0.5 flex items-center justify-center gap-2 tracking-wide uppercase transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span>BƯỚC VÀO PHẦN PITCHING (BƯỚC 03) →</span>
            </button>

            <p className="text-[10px] text-neutral-500 text-center font-sans">
              *Hệ thống sẽ nạp cấu hình và kích hoạt 03s đệm suy nghĩ trước khi bước vào chất vấn.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
