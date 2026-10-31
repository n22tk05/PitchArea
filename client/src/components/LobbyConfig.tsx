import React, { useState, useEffect, useMemo } from "react";
import {
  CombatDifficulty,
  ArenaMode,
  JuryBossId,
  JURY_BOSS_PROFILES,
  LobbyConfig as LobbyConfigType,
  DocumentAnalysisResult,
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
  Clock,
  Award,
  Sliders,
  Layers,
  Zap,
  Mic,
  Volume2,
} from "lucide-react";
import { useArenaSocket } from "../hooks/useArenaSocket";
import { fixMojibake } from "./DocumentUploader";
import { RetroSelect, RetroOption } from "./RetroSelect";
import { GlobalMicModal } from "./GlobalMicModal";

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
  const [isMicModalOpen, setIsMicModalOpen] = useState<boolean>(false);
  const [isCustomDuration, setIsCustomDuration] = useState<boolean>(false);

  // Lọc danh sách Giám khảo có khối đề mục tương ứng trong hồ sơ
  const availableBossIds = useMemo(() => {
    return getAvailableBossesForSections(documentData?.sections);
  }, [documentData?.sections]);

  const defaultBoss = availableBossIds[0] || JuryBossId.FINANCE_DRAGON;

  // Cấu hình trận đấu
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
  const { updateConfig, startCombat } = useArenaSocket(
    sessionId,
    documentData.documentId,
  );

  const handleModeChange = (mode: ArenaMode) => {
    const updated = { ...config, mode };
    setConfig(updated);
    updateConfig(updated);
  };

  const handlePresetChange = (preset: EvaluationPreset) => {
    const presetInfo = EvaluationPresetDetails[preset];
    const targetBoss = availableBossIds.includes(presetInfo.targetBoss)
      ? presetInfo.targetBoss
      : (availableBossIds[0] ?? config.selectedBoss);
    const updated = {
      ...config,
      evaluationPreset: preset,
      selectedBoss:
        config.mode === ArenaMode.QUICK_COMBAT ? targetBoss : config.selectedBoss,
    };
    setConfig(updated);
    updateConfig(updated);
  };

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

  const handlePitchDurationChange = (minutes: number) => {
    const updated = { ...config, pitchDurationMinutes: minutes };
    setConfig(updated);
    updateConfig(updated);
  };

  const handleQaDurationChange = (minutes: number) => {
    const updated = { ...config, qaDurationMinutes: minutes };
    setConfig(updated);
    updateConfig(updated);
  };

  const totalMinutes =
    (config.pitchDurationMinutes || 2) + (config.qaDurationMinutes || 3);

  const handleStart = () => {
    startCombat();
    if (onStartCombat) {
      onStartCombat(config);
    }
  };

  // Options definitions
  const modeOptions: RetroOption<ArenaMode>[] = [
    {
      value: ArenaMode.FULL_ARENA,
      label: "Hội Đồng Toàn Diện",
      subLabel: "4 Giám khảo AI luân phiên phản biện theo 5 phân mục",
      badge: "CHUẨN",
      badgeColor: "bg-[#FEF3C7] text-[#92400E]",
      icon: <Layers className="w-3.5 h-3.5" />,
    },
    {
      value: ArenaMode.QUICK_COMBAT,
      label: "Solo Boss 1-1 (Đối Chất)",
      subLabel: "Đối chất 1-1 trực diện, 2 Boss còn lại mờ 25%",
      badge: "SOLO",
      badgeColor: "bg-amber-100 text-amber-900",
      icon: <Zap className="w-3.5 h-3.5 text-amber-600" />,
    },
  ];

  const presetOptions: RetroOption<EvaluationPreset>[] = [
    {
      value: EvaluationPreset.SV_STARTUP,
      label: EvaluationPresetDetails[EvaluationPreset.SV_STARTUP].label,
      subLabel: EvaluationPresetDetails[EvaluationPreset.SV_STARTUP].desc,
      badge: "PRESET 1",
      badgeColor: "bg-[#FEF3C7] text-[#92400E]",
      icon: <Award className="w-3.5 h-3.5" />,
    },
    {
      value: EvaluationPreset.SEED_ANGEL,
      label: EvaluationPresetDetails[EvaluationPreset.SEED_ANGEL].label,
      subLabel: EvaluationPresetDetails[EvaluationPreset.SEED_ANGEL].desc,
      badge: "PRESET 2",
      badgeColor: "bg-amber-100 text-amber-900",
      icon: <Coins className="w-3.5 h-3.5" />,
    },
    {
      value: EvaluationPreset.TECH_PATENT,
      label: EvaluationPresetDetails[EvaluationPreset.TECH_PATENT].label,
      subLabel: EvaluationPresetDetails[EvaluationPreset.TECH_PATENT].desc,
      badge: "PRESET 3",
      badgeColor: "bg-cyan-100 text-cyan-900",
      icon: <Cpu className="w-3.5 h-3.5" />,
    },
  ];

  const difficultyOptions: RetroOption<CombatDifficulty>[] = [
    {
      value: CombatDifficulty.EASY,
      label: "Tân Thủ (Easy)",
      subLabel: "VAD gap 3.5s • Thoải mái tập dượt",
    },
    {
      value: CombatDifficulty.NORMAL,
      label: "Tiêu Chuẩn (Normal)",
      subLabel: "VAD gap 2.0s • Nhịp thi đấu chuẩn",
    },
    {
      value: CombatDifficulty.HARDCORE,
      label: "Khắc Nghiệt (Hardcore)",
      subLabel: "VAD gap 1.0s • Phản xạ nhanh dồn dập",
    },
  ];

  const durationOptions: RetroOption<string>[] = [
    {
      value: "2-3",
      label: "2p Pitch • 3p Q&A",
      subLabel: "Tổng 5 phút • Tiêu chuẩn thi đấu",
      badge: "5 PHÚT",
      badgeColor: "bg-[#FEF3C7] text-[#92400E]",
      icon: <Clock className="w-3.5 h-3.5" />,
    },
    {
      value: "1-2",
      label: "1p Pitch • 2p Q&A",
      subLabel: "Tổng 3 phút • Thuyết minh nhanh",
      badge: "3 PHÚT",
      badgeColor: "bg-amber-100 text-amber-900",
      icon: <Clock className="w-3.5 h-3.5" />,
    },
    {
      value: "2-2",
      label: "2p Pitch • 2p Q&A",
      subLabel: "Tổng 4 phút • Tinh gọn cân bằng",
      badge: "4 PHÚT",
      badgeColor: "bg-amber-100 text-amber-900",
      icon: <Clock className="w-3.5 h-3.5" />,
    },
    {
      value: "3-3",
      label: "3p Pitch • 3p Q&A",
      subLabel: "Tổng 6 phút • Tranh biện mở rộng",
      badge: "6 PHÚT",
      badgeColor: "bg-cyan-100 text-cyan-900",
      icon: <Clock className="w-3.5 h-3.5" />,
    },
    {
      value: "5-5",
      label: "5p Pitch • 5p Q&A",
      subLabel: "Tổng 10 phút • Đánh giá chuyên sâu",
      badge: "10 PHÚT",
      badgeColor: "bg-purple-100 text-purple-900",
      icon: <Clock className="w-3.5 h-3.5" />,
    },
  ];

  const currentDurationKey = `${config.pitchDurationMinutes || 2}-${config.qaDurationMinutes || 3}`;

  const handleDurationPresetChange = (presetKey: string) => {
    const [pStr, qStr] = presetKey.split("-");
    const pitch = Number(pStr) || 2;
    const qa = Number(qStr) || 3;
    const updated = {
      ...config,
      pitchDurationMinutes: pitch,
      qaDurationMinutes: qa,
    };
    setConfig(updated);
    updateConfig(updated);
  };

  return (
    <div className="w-full flex flex-col gap-6 font-sans text-[#1C1917]">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {onBackToUpload && (
          <button
            type="button"
            onClick={onBackToUpload}
            className="h-10 px-4 border border-[#D97706]/35 bg-[#FFFFFF] hover:bg-[#FEF3C7] text-[#92400E] hover:text-[#B45309] flex items-center gap-2 text-xs font-bold active:translate-x-0.5 shadow-xs transition-all shrink-0 rounded-xl cursor-pointer"
            title="Quay về Bước 01: Nạp tài liệu đề tài"
          >
            <ArrowLeft className="w-4 h-4 text-[#D97706]" />
            <span>QUAY VỀ BƯỚC 01</span>
          </button>
        )}

        <div className="flex flex-wrap items-center gap-3 ml-auto">
          {/* Step Pill with SẢNH ĐẤU & VOICE LOBBY (Required by tests) */}
          <div className="h-10 border border-[#D97706]/30 bg-[#FFFFFF] px-3.5 shadow-xs flex items-center gap-2 text-xs rounded-xl">
            <span className="font-pixel text-[9px] font-bold bg-[#FEF3C7] text-[#92400E] px-2.5 py-1 rounded-full border border-[#F59E0B]/50 shrink-0">
              BƯỚC 02 // SẢNH ĐẤU & VOICE LOBBY
            </span>
            <span className="text-[#78716C] font-mono text-xs hidden md:inline">HỒ SƠ:</span>
            <strong className="text-[#1C1917] max-w-[150px] sm:max-w-xs truncate font-mono text-xs font-bold">
              {fixMojibake(documentData.filename)}
            </strong>
          </div>

          {/* Global Mic Modal Trigger */}
          <button
            type="button"
            onClick={() => setIsMicModalOpen(true)}
            className="h-10 px-4 border border-[#F59E0B]/60 bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#92400E] font-headline text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-all active:translate-x-0.5"
            title="Bật/Tắt và kiểm tra Microphone qua cửa sổ Voice Lab"
          >
            <Mic className="w-3.5 h-3.5 text-[#B45309]" />
            <span>KIỂM THỬ MICRO</span>
          </button>
        </div>
      </div>

      {/* Main Container: Clean Structured Rows */}
      <div className="flex flex-col gap-6">
        {/* ROW 1: CẤU HÌNH THI ĐẤU (MATCH SETTINGS) */}
        <div className="p-6 sm:p-7 rounded-2xl bg-[#FFFFFF] border border-[#D97706]/30 shadow-xs flex flex-col gap-5 relative z-20">
          {/* Section Header with Line Break and Polished Typography */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#D97706]/20">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FEF3C7] border border-[#D97706]/35 flex items-center justify-center text-[#B45309] shrink-0 mt-0.5">
                <Swords className="w-5 h-5 text-[#D97706]" />
              </div>
              <div className="flex flex-col">
                <h3 className="font-headline font-black text-base sm:text-lg text-[#1C1917] tracking-tight uppercase leading-snug">
                  CẤU HÌNH THI ĐẤU
                </h3>
                <span className="font-mono text-xs font-bold text-[#B45309] tracking-wider uppercase">
                  (MATCH SETTINGS)
                </span>
              </div>
            </div>
            <p className="text-xs text-[#57534E] font-sans sm:text-right max-w-sm">
              Tùy chỉnh thể thức thi đấu, cấp độ khó và thời lượng tranh biện trước khi bước vào đấu trường
            </p>
          </div>

          {/* HÀNG 1: 3 CỘT THỂ THỨC, CẤP ĐỘ, TRỌNG TÂM */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
            {/* 1. Format */}
            <div>
              <label className="block text-xs font-headline font-bold text-[#1C1917] mb-1.5 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#B45309]" />
                <span>1. Thể Thức Thi Đấu:</span>
              </label>
              <RetroSelect<ArenaMode>
                value={config.mode}
                onChange={handleModeChange}
                options={modeOptions}
              />
            </div>

            {/* 2. Cấp độ khó */}
            <div>
              <label className="block text-xs font-headline font-bold text-[#1C1917] mb-1.5 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[#B45309]" />
                <span>2. Cấp Độ Khó:</span>
              </label>
              <RetroSelect<CombatDifficulty>
                value={config.difficulty}
                onChange={handleDifficultyChange}
                options={difficultyOptions}
              />
            </div>

            {/* 3. Preset Thẩm định */}
            <div>
              <label className="block text-xs font-headline font-bold text-[#1C1917] mb-1.5 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-[#B45309]" />
                <span>3. Trọng Tâm Thẩm Định:</span>
              </label>
              <RetroSelect<EvaluationPreset>
                value={config.evaluationPreset || EvaluationPreset.SV_STARTUP}
                onChange={handlePresetChange}
                options={presetOptions}
              />
            </div>
          </div>

          {/* HÀNG 2: 4. THỜI LƯỢNG TRANH BIỆN (DÒNG DƯỚI RIÊNG BIỆT - TÙY CHỌN THỜI GIAN) */}
          <div className="pt-4 border-t border-[#D97706]/20 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#B45309]" />
                <span className="text-xs font-headline font-bold text-[#1C1917]">
                  4. Thời Lượng (Pitch / Q&A):
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-[#92400E] bg-[#FEF3C7] px-3 py-1 rounded-full border border-[#F59E0B]/50 shadow-xs flex items-center gap-1.5">
                  <span>TỔNG THỜI GIAN:</span>
                  <strong className="text-sm text-[#1C1917]">
                    {String(totalMinutes).padStart(2, "0")}:00 PHÚT
                  </strong>
                </span>
              </div>
            </div>

            {/* Khung điều khiển thời lượng 2 khối trực quan */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Khối A: Pitching Duration */}
              <div className="p-4 bg-[#FAF8F5] border border-[#D97706]/25 rounded-2xl flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]" />
                    <span className="font-headline font-bold text-xs text-[#1C1917]">
                      A. THUYẾT MINH PITCHING:
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-[#B45309] bg-[#FFFFFF] px-2.5 py-1 rounded-lg border border-[#D97706]/20 shadow-xs">
                    {config.pitchDurationMinutes} Phút ({config.pitchDurationMinutes * 60}s)
                  </span>
                </div>

                {/* Stepper + Mốc phút */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePitchDurationChange(Math.max(1, (config.pitchDurationMinutes || 2) - 1))}
                    className="w-8 h-8 rounded-xl bg-[#FFFFFF] hover:bg-[#FEF3C7] text-[#92400E] border border-[#D97706]/30 font-bold text-sm flex items-center justify-center transition-all cursor-pointer shadow-xs active:translate-x-0.5 shrink-0"
                    title="Giảm 1 phút"
                  >
                    -
                  </button>

                  <div className="grid grid-cols-5 gap-1.5 flex-1">
                    {[1, 2, 3, 4, 5].map((m) => {
                      const isSelected = config.pitchDurationMinutes === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => handlePitchDurationChange(m)}
                          className={`py-1.5 rounded-xl font-headline text-xs font-bold transition-all flex flex-col items-center justify-center cursor-pointer ${
                            isSelected
                              ? "bg-[#B45309] text-white shadow-xs scale-102 ring-2 ring-[#B45309]/30"
                              : "bg-[#FFFFFF] text-[#57534E] hover:text-[#1C1917] border border-[#D97706]/20 hover:bg-[#FEF3C7]"
                          }`}
                        >
                          <span>{m}p</span>
                          <span className={`text-[8px] font-mono leading-none ${isSelected ? "text-[#FEF3C7]" : "text-[#78716C]"}`}>
                            {m === 2 ? "Chuẩn" : `${m * 60}s`}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => handlePitchDurationChange(Math.min(10, (config.pitchDurationMinutes || 2) + 1))}
                    className="w-8 h-8 rounded-xl bg-[#FFFFFF] hover:bg-[#FEF3C7] text-[#92400E] border border-[#D97706]/30 font-bold text-sm flex items-center justify-center transition-all cursor-pointer shadow-xs active:translate-x-0.5 shrink-0"
                    title="Tăng 1 phút"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Khối B: Q&A Combat Duration */}
              <div className="p-4 bg-[#FAF8F5] border border-[#D97706]/25 rounded-2xl flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#B45309]" />
                    <span className="font-headline font-bold text-xs text-[#1C1917]">
                      B. CHẤT VẤN PHẢN BIỆN (Q&A):
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-[#B45309] bg-[#FFFFFF] px-2.5 py-1 rounded-lg border border-[#D97706]/20 shadow-xs">
                    {config.qaDurationMinutes} Phút ({config.qaDurationMinutes * 60}s)
                  </span>
                </div>

                {/* Stepper + Mốc phút */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleQaDurationChange(Math.max(1, (config.qaDurationMinutes || 3) - 1))}
                    className="w-8 h-8 rounded-xl bg-[#FFFFFF] hover:bg-[#FEF3C7] text-[#92400E] border border-[#D97706]/30 font-bold text-sm flex items-center justify-center transition-all cursor-pointer shadow-xs active:translate-x-0.5 shrink-0"
                    title="Giảm 1 phút"
                  >
                    -
                  </button>

                  <div className="grid grid-cols-5 gap-1.5 flex-1">
                    {[1, 2, 3, 5, 8].map((m) => {
                      const isSelected = config.qaDurationMinutes === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => handleQaDurationChange(m)}
                          className={`py-1.5 rounded-xl font-headline text-xs font-bold transition-all flex flex-col items-center justify-center cursor-pointer ${
                            isSelected
                              ? "bg-[#B45309] text-white shadow-xs scale-102 ring-2 ring-[#B45309]/30"
                              : "bg-[#FFFFFF] text-[#57534E] hover:text-[#1C1917] border border-[#D97706]/20 hover:bg-[#FEF3C7]"
                          }`}
                        >
                          <span>{m}p</span>
                          <span className={`text-[8px] font-mono leading-none ${isSelected ? "text-[#FEF3C7]" : "text-[#78716C]"}`}>
                            {m === 3 ? "Chuẩn" : `${m * 60}s`}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleQaDurationChange(Math.min(15, (config.qaDurationMinutes || 3) + 1))}
                    className="w-8 h-8 rounded-xl bg-[#FFFFFF] hover:bg-[#FEF3C7] text-[#92400E] border border-[#D97706]/30 font-bold text-sm flex items-center justify-center transition-all cursor-pointer shadow-xs active:translate-x-0.5 shrink-0"
                    title="Tăng 1 phút"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ROW 2: HỘI ĐỒNG GIÁM KHẢO (4 BOSS ROSTER) */}
        <div className="p-6 sm:p-7 rounded-2xl bg-[#FFFFFF] border border-[#D97706]/30 shadow-xs flex flex-col gap-5 relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#D97706]/20">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FEF3C7] border border-[#D97706]/35 flex items-center justify-center text-[#B45309] shrink-0 mt-0.5">
                <Flame className="w-5 h-5 text-[#D97706]" />
              </div>
              <div className="flex flex-col">
                <h3 className="font-headline font-black text-base sm:text-lg text-[#1C1917] tracking-tight uppercase leading-snug">
                  HỘI ĐỒNG GIÁM KHẢO AI
                </h3>
                <span className="font-mono text-xs font-bold text-[#B45309] tracking-wider uppercase">
                  (JURY BOSS ROSTER)
                </span>
              </div>
            </div>
            <p className="text-xs text-[#57534E] font-sans sm:text-right max-w-sm">
              {config.mode === ArenaMode.QUICK_COMBAT
                ? "Bấm vào 1 Giám khảo để chọn mục tiêu đối chất Solo 1-1"
                : `${availableBossIds.length} Giám khảo luân phiên tham gia phản biện theo phân mục`}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  className={`border p-4 rounded-2xl transition-all duration-200 flex flex-col justify-between gap-3 relative ${
                    !isAvailable
                      ? "opacity-40 border-dashed border-[#D97706]/30 bg-[#FAF8F5] cursor-not-allowed filter grayscale select-none"
                      : isDimmed
                        ? "opacity-30 border-dashed border-[#D97706]/30 bg-[#FAF8F5] filter grayscale cursor-pointer"
                        : isSoloSelected
                          ? "border-2 border-[#D97706] bg-[#FEF3C7]/40 shadow-sm ring-2 ring-[#D97706]/30 cursor-pointer"
                          : isFullActive
                            ? "border-[#D97706]/35 bg-[#FAF8F5] shadow-xs hover:border-[#B45309] cursor-pointer"
                            : "border-[#D97706]/25 bg-[#FAF8F5] cursor-pointer"
                  }`}
                >
                  {/* Status Badge */}
                  {!isAvailable && (
                    <span className="absolute -top-2 right-2 bg-[#FAF8F5] text-[#78716C] border border-[#D97706]/30 text-[8px] font-pixel font-bold px-2 py-0.5 rounded-full shadow-xs">
                      VẮNG MẶT
                    </span>
                  )}
                  {isSoloSelected && (
                    <span className="absolute -top-2 right-2 bg-[#D97706] text-white border border-[#D97706] text-[8px] font-pixel font-bold px-2 py-0.5 rounded-full shadow-xs">
                      TARGET BOSS
                    </span>
                  )}
                  {isFullActive && (
                    <span className="absolute -top-2 right-2 bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B]/50 text-[8px] font-pixel font-bold px-2 py-0.5 rounded-full shadow-xs">
                      THAM CHIẾN
                    </span>
                  )}

                  <div className="flex items-center justify-between">
                    <div
                      className={`p-2 rounded-xl border ${
                        !isAvailable
                          ? "border-[#D97706]/20 bg-[#FFFFFF] text-[#78716C]"
                          : "border-[#D97706]/35 bg-[#FFFFFF] text-[#B45309]"
                      }`}
                    >
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-mono font-bold border border-[#F59E0B]/50 px-2 py-0.5 rounded-full text-[#92400E] bg-[#FEF3C7]">
                      LV.{boss.level}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-headline font-bold text-sm text-[#1C1917] truncate">
                      {boss.name}
                    </h4>
                    <p className="text-xs text-[#78716C] font-sans truncate mt-0.5">
                      {boss.title}
                    </p>
                  </div>

                  {!isAvailable ? (
                    <div className="text-[10px] text-rose-700 font-sans pt-1 border-t border-dashed border-rose-200 truncate">
                      Thiếu: {missingSectionNames}
                    </div>
                  ) : (
                    <div className="text-xs text-[#57534E] font-sans line-clamp-1 border-t border-[#D97706]/15 pt-2">
                      {boss.domain}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ROW 3: BẢNG SẴN SÀNG & TIẾN VÀO ĐẤU TRƯỜNG */}
        <div className="p-6 sm:p-7 rounded-2xl bg-[#FFFFFF] border-2 border-[#D97706]/35 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-5 relative z-10">
          <div className="flex flex-col gap-2.5 w-full lg:w-auto">
            <div className="flex items-center gap-2">
              <span className="font-headline font-black text-sm sm:text-base text-[#1C1917] flex items-center gap-2 uppercase tracking-wide">
                <Play className="w-4 h-4 fill-[#D97706] text-[#D97706]" />
                SẴN SÀNG VÀO SÀN ĐẤU
              </span>
            </div>

            {/* Quick Summary Chips */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 px-3.5 py-2 bg-[#FAF8F5] border border-[#D97706]/25 rounded-xl">
                <span className="text-[#78716C] font-mono text-[10px] font-bold">ĐỐI THỦ:</span>
                <strong className="text-[#1C1917] font-headline text-xs font-bold">
                  {config.mode === ArenaMode.FULL_ARENA
                    ? "Hội đồng 4 Boss"
                    : `Solo: ${JURY_BOSS_PROFILES[config.selectedBoss]?.name || "Solo Boss"}`}
                </strong>
              </div>

              <div className="flex items-center gap-1.5 px-3.5 py-2 bg-[#FAF8F5] border border-[#D97706]/25 rounded-xl">
                <span className="text-[#78716C] font-mono text-[10px] font-bold">THỜI LƯỢNG:</span>
                <strong className="text-[#B45309] font-mono text-xs font-bold">
                  {config.pitchDurationMinutes}p Pitch + {config.qaDurationMinutes}p Q&A ({totalMinutes}p)
                </strong>
              </div>

              {/* Quick Mic Checker inside Action Bar */}
              <button
                type="button"
                onClick={() => setIsMicModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#FEF3C7] hover:bg-[#FDE68A] border border-[#F59E0B]/50 rounded-xl text-[#92400E] font-headline text-xs font-bold cursor-pointer transition-all active:translate-x-0.5"
              >
                <Volume2 className="w-4 h-4 text-[#B45309]" />
                <span>MICRO: SẴN SÀNG (BẤM ĐỂ TEST)</span>
              </button>
            </div>
          </div>

          {/* Primary Launch Action Button */}
          <button
            type="button"
            onClick={handleStart}
            className="w-full lg:w-auto px-8 py-4 bg-[#B45309] hover:bg-[#92400E] text-[#FFFFFF] font-headline font-black text-sm rounded-xl shadow-xs active:translate-x-0.5 flex items-center justify-center gap-2.5 tracking-wide uppercase transition-all cursor-pointer shrink-0"
          >
            <Play className="w-4 h-4 fill-[#FFFFFF] text-[#FFFFFF]" />
            <span>BƯỚC VÀO PHẦN PITCHING (BƯỚC 03) →</span>
          </button>
        </div>
      </div>

      {/* Global Microphone Modal */}
      <GlobalMicModal
        isOpen={isMicModalOpen}
        onClose={() => setIsMicModalOpen(false)}
      />
    </div>
  );
};
