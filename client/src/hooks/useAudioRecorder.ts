import { useState, useEffect, useRef, useCallback } from 'react';
import { RetractionMarkerType } from '@pitcharena/shared';

export interface UseAudioRecorderOptions {
  onTranscriptChange?: (text: string, isFinal: boolean, wpm?: number) => void;
  onVadSilenceAlert?: (silenceDurationSec: number) => void;
  vadThresholdSec?: number;
  /**
   * Callback phát tín hiệu chunk âm thanh theo nhịp thở (FR-01, FR-02)
   */
  onPitchChunk?: (payload: {
    sequenceId: number;
    text: string;
    isFinalChunk: boolean;
    detectedMarkers: RetractionMarkerType[];
    timestamp: number;
  }) => void;
}

// Regex quét các marker đính chính theo 3 nhóm phân loại (FR-02)
const RETRACTION_PATTERNS: Array<{ regex: RegExp; type: RetractionMarkerType }> = [
  {
    // Direct Overwrite: "à không", "nhầm", "chính xác là", "đính chính lại"
    regex: /(?:à\s*không|nhầm\s*(?:rồi)?|chính\s*xác\s*l(?:à|a)|đính\s*chính\s*lại)/i,
    type: RetractionMarkerType.OVERWRITE_DIRECT,
  },
  {
    // Cancellation: "thôi bỏ đi", "bỏ qua phần này", "chưa tính tới"
    regex: /(?:thôi\s*bỏ\s*đi|bỏ\s*qua\s*(?:phần\s*này|cái\s*này)?|chưa\s*tính\s*tới)/i,
    type: RetractionMarkerType.CANCELLATION,
  },
  {
    // Elaboration: "ý tôi là", "nói cách khác", "để nói rõ hơn"
    regex: /(?:ý\s*tôi\s*l(?:à|a)|nói\s*cách\s*khác|để\s*nói\s*rõ\s*hơn)/i,
    type: RetractionMarkerType.ELABORATION,
  },
];

export function detectRetractionMarkers(text: string): RetractionMarkerType[] {
  const detected: RetractionMarkerType[] = [];
  for (const { regex, type } of RETRACTION_PATTERNS) {
    if (regex.test(text) && !detected.includes(type)) {
      detected.push(type);
    }
  }
  return detected;
}

export function useAudioRecorder({
  onTranscriptChange,
  onVadSilenceAlert,
  vadThresholdSec = 2.0,
  onPitchChunk,
}: UseAudioRecorderOptions = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0); // 0 - 100
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [estimatedWpm, setEstimatedWpm] = useState(0);
  const [isSilent, setIsSilent] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);

  const lastSpokenTimestampRef = useRef<number>(Date.now());
  const wordsCountRef = useRef<number>(0);
  const startTimeRef = useRef<number>(Date.now());
  const speechStartTimestampRef = useRef<number | null>(null);
  const wordSamplesRef = useRef<{ timestamp: number; wordCount: number }[]>([]);
  const lastWpmRef = useRef<number>(0);
  const finalTranscriptRef = useRef<string>('');
  const isRecordingRef = useRef<boolean>(false);

  // Streaming Pitch Segmenter Refs (FR-01, FR-02)
  const sequenceIdRef = useRef<number>(0);
  const chunkBufferRef = useRef<string>('');
  const chunkWordCountRef = useRef<number>(0);
  const chunkStartTimeRef = useRef<number>(Date.now());
  const pauseTimerRef = useRef<any>(null);
  const interimCommitTimerRef = useRef<any>(null);
  const pendingInterimRef = useRef<string>('');
  const onPitchChunkRef = useRef(onPitchChunk);
  onPitchChunkRef.current = onPitchChunk;

  // Hàm phát chunk an toàn lên tầng socket
  const emitCurrentChunk = useCallback((isFinalChunk = false) => {
    const rawText = chunkBufferRef.current.trim();
    if (!rawText) return;

    // Minimum Gate: Không gửi chunk < 4 từ (hoặc < 15 ký tự) trừ khi là chunk chốt nộp bài
    const words = rawText.split(/\s+/).filter(Boolean);
    if (!isFinalChunk && words.length < 4 && rawText.length < 15) {
      return;
    }

    const detectedMarkers = detectRetractionMarkers(rawText);
    const seq = sequenceIdRef.current++;

    onPitchChunkRef.current?.({
      sequenceId: seq,
      text: rawText,
      isFinalChunk,
      detectedMarkers,
      timestamp: Date.now(),
    });

    // Reset buffer cho chu kỳ tiếp theo
    chunkBufferRef.current = '';
    chunkWordCountRef.current = 0;
    chunkStartTimeRef.current = Date.now();
  }, []);

  // Xả sạch buffer dứt điểm khi người dùng bấm [KẾT THÚC THUYẾT TRÌNH]
  const flushRemainingBuffer = useCallback(() => {
    if (interimCommitTimerRef.current) {
      clearTimeout(interimCommitTimerRef.current);
      interimCommitTimerRef.current = null;
    }
    if (pendingInterimRef.current.trim()) {
      const textToCommit = pendingInterimRef.current.trim();
      finalTranscriptRef.current = (
        finalTranscriptRef.current + ' ' + textToCommit
      ).trim();
      setTranscript(finalTranscriptRef.current);
      setInterimTranscript('');
      pendingInterimRef.current = '';
      chunkBufferRef.current = (chunkBufferRef.current + ' ' + textToCommit).trim();
    }
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
    emitCurrentChunk(true);
  }, [emitCurrentChunk]);

  // Bộ lập lịch phân đoạn Hybrid (Pausing Gate 1.0s + Hard Ceiling 25 từ / 6s)
  const scheduleChunkSegmentation = useCallback((newText: string) => {
    if (!newText.trim()) return;

    chunkBufferRef.current = (chunkBufferRef.current + ' ' + newText).trim();
    const words = chunkBufferRef.current.split(/\s+/).filter(Boolean);
    chunkWordCountRef.current = words.length;

    const now = Date.now();
    const durationSinceChunkStart = (now - chunkStartTimeRef.current) / 1000;

    // 1. Hard Ceiling Gate: nếu chạm >= 25 từ hoặc nói liên tục >= 6.0s mà không ngắt
    if (chunkWordCountRef.current >= 25 || durationSinceChunkStart >= 6.0) {
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current);
        pauseTimerRef.current = null;
      }
      emitCurrentChunk(false);
      return;
    }

    // 2. Pausing Gate: Hủy timer cũ, đặt timer khoảng lặng 1.0s
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
    }

    pauseTimerRef.current = setTimeout(() => {
      // Khi không có từ mới trong 1.0s và buffer >= 4 từ -> phát chunk
      if (chunkWordCountRef.current >= 4 || chunkBufferRef.current.length >= 15) {
        emitCurrentChunk(false);
      }
    }, 1000);
  }, [emitCurrentChunk]);

  // Bắt đầu thu âm và kích hoạt Web Speech API
  const startRecording = useCallback(async () => {
    // 0. Dọn sạch phiên thu âm trước nếu còn tồn đọng
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    isRecordingRef.current = true;
    setSpeechError(null);

    // Kiểm tra bảo mật trình duyệt: getUserMedia chỉ chạy trên HTTPS hoặc localhost
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
      const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      const msg = !isHttps && !isLocal
        ? 'Trình duyệt chặn Micro vì trang web không chạy qua HTTPS. Hãy truy cập qua HTTPS hoặc dùng localhost.'
        : 'Trình duyệt của bạn không hỗ trợ thu âm micro (navigator.mediaDevices.getUserMedia).';
      console.warn('[useAudioRecorder]', msg);
      setSpeechError(msg);
      setHasMicPermission(false);
      setIsRecording(false);
      isRecordingRef.current = false;
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      setHasMicPermission(true);
      setIsRecording(true);
      setTranscript('');
      setInterimTranscript('');
      startTimeRef.current = Date.now();
      speechStartTimestampRef.current = null;
      wordsCountRef.current = 0;
      wordSamplesRef.current = [];
      lastWpmRef.current = 0;
      finalTranscriptRef.current = '';
      setEstimatedWpm(0);
      setIsSilent(false);
      lastSpokenTimestampRef.current = Date.now();

      // 1. Phân tích Sóng âm qua Web Audio API (Tối ưu độ nhạy cho dải giọng nói con người)
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256; // 128 bins với độ phân giải tần số tốt hơn cho giọng nói
      analyser.smoothingTimeConstant = 0.35; // Phản hồi nhanh tức thì thay vì trễ 0.8
      source.connect(analyser);
      analyserRef.current = analyser;

      const freqData = new Uint8Array(analyser.frequencyBinCount);

      const updateMeter = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(freqData);

        // Tập trung đo năng lượng dải tần số giọng người (vocal band: ~100Hz - 4000Hz, bins 1-24)
        let vocalSum = 0;
        let peak = 0;
        const vocalBins = Math.min(24, freqData.length);
        for (let i = 1; i < vocalBins; i++) {
          const val = freqData[i];
          vocalSum += val;
          if (val > peak) peak = val;
        }
        const vocalAvg = vocalBins > 1 ? vocalSum / (vocalBins - 1) : 0;

        // Khuếch đại phi tuyến tính để phản hồi nhạy với giọng nói thông thường
        const normalizedLevel = Math.min(
          100,
          Math.round((vocalAvg / 60) * 80 + (peak / 255) * 20)
        );
        setAudioLevel(normalizedLevel);

        // Kiểm tra VAD: Nếu âm lượng vocal > 10% thì xác nhận đang phát âm
        const now = Date.now();
        if (normalizedLevel > 10) {
          lastSpokenTimestampRef.current = now;
          setIsSilent(false);
        } else {
          const silenceSec = (now - lastSpokenTimestampRef.current) / 1000;
          if (silenceSec >= vadThresholdSec) {
            setIsSilent(true);
            onVadSilenceAlert?.(silenceSec);
          }

          // Giảm dần (Decay) WPM khi người dùng im lặng hoặc ngắt nghỉ quá 1.8 giây
          if (silenceSec >= 1.8 && lastWpmRef.current > 0) {
            const decayFactor = 0.96; // Giảm nhẹ mỗi frame kiểm tra
            const decayedWpm = Math.max(0, Math.round(lastWpmRef.current * decayFactor));
            if (decayedWpm < lastWpmRef.current) {
              lastWpmRef.current = decayedWpm;
              setEstimatedWpm(decayedWpm);
            }
          }
        }

        animationFrameRef.current = requestAnimationFrame(updateMeter);
      };

      updateMeter();

      // 2. Kích hoạt Web Speech Recognition với cơ chế Tự hồi sinh Instance mới khi ngắt quãng
      const startSpeechRecognition = () => {
        if (!isRecordingRef.current) return;

        const SpeechRecognition =
          (window as any).SpeechRecognition ||
          (window as any).webkitSpeechRecognition;

        if (!SpeechRecognition) {
          const msg =
            'Trình duyệt không hỗ trợ Web Speech API (nhận diện giọng nói). Khuyến nghị dùng Google Chrome hoặc Edge, hoặc dùng tab GÕ PHÍM.';
          console.warn('[useAudioRecorder]', msg);
          setSpeechError(msg);
          return;
        }

        // Hủy instance cũ an toàn nếu còn dính listener
        if (recognitionRef.current) {
          try {
            recognitionRef.current.onend = null;
            recognitionRef.current.onerror = null;
            recognitionRef.current.onresult = null;
            recognitionRef.current.abort();
          } catch {}
          recognitionRef.current = null;
        }

        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'vi-VN';
          recognition.maxAlternatives = 1;

          recognition.onstart = () => {
            console.log('[SpeechRecognition] Active & listening in vi-VN... ');
          };

          recognition.onresult = (event: any) => {
            let currentInterim = '';
            let finalPiece = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
              const part = event.results[i][0].transcript;
              if (event.results[i].isFinal) {
                finalPiece += part;
              } else {
                currentInterim += part;
              }
            }

            if (finalPiece) {
              if (interimCommitTimerRef.current) {
                clearTimeout(interimCommitTimerRef.current);
                interimCommitTimerRef.current = null;
              }
              const trimmedFinal = finalPiece.trim();
              pendingInterimRef.current = '';
              // Tránh trùng lặp nếu debounce timer 0.5s vừa tự động chốt đoạn này trước đó
              if (!finalTranscriptRef.current.endsWith(trimmedFinal)) {
                finalTranscriptRef.current = (
                  finalTranscriptRef.current + ' ' + trimmedFinal
                ).trim();
                setTranscript(finalTranscriptRef.current);
                // Kích hoạt phân đoạn streaming cho đoạn câu hoàn tất
                scheduleChunkSegmentation(trimmedFinal);
              }
            }

            setInterimTranscript(currentInterim);
            pendingInterimRef.current = currentInterim;

            // Lexical VAD Debounce: Không cần chờ dB = 0, nếu sau 0.5s không có từ mới sinh ra -> Tự động chốt chữ VÀNG thành chữ XANH
            if (currentInterim.trim()) {
              if (interimCommitTimerRef.current) {
                clearTimeout(interimCommitTimerRef.current);
              }
              interimCommitTimerRef.current = setTimeout(() => {
                const textToCommit = pendingInterimRef.current.trim();
                if (textToCommit) {
                  finalTranscriptRef.current = (
                    finalTranscriptRef.current + ' ' + textToCommit
                  ).trim();
                  setTranscript(finalTranscriptRef.current);
                  setInterimTranscript('');
                  pendingInterimRef.current = '';
                  scheduleChunkSegmentation(textToCommit);
                }
              }, 500);
            }

            const fullCurrentText = (
              finalTranscriptRef.current + ' ' + currentInterim
            ).trim();
            const currentWords = fullCurrentText
              ? fullCurrentText.split(/\s+/).filter(Boolean).length
              : 0;
            wordsCountRef.current = currentWords;

            // Cập nhật số từ và thời gian nói
            const now = Date.now();
            if (currentWords > 0) {
              lastSpokenTimestampRef.current = now;
              setIsSilent(false);

              if (speechStartTimestampRef.current === null) {
                speechStartTimestampRef.current = now;
              }

              // Ghi nhận mẫu từ để tính tốc độ nói qua Rolling Window (lưu giữ 6 giây gần nhất)
              wordSamplesRef.current.push({
                timestamp: now,
                wordCount: currentWords,
              });
              wordSamplesRef.current = wordSamplesRef.current.filter(
                (s) => now - s.timestamp <= 8000
              );

              const totalSpeechSec = (now - speechStartTimestampRef.current) / 1000;
              let calculatedWpm = lastWpmRef.current;

              // Chỉ tính WPM sau ít nhất 2 giây để tránh hiện tượng spike khi Web Speech API xả cụm từ đầu tiên
              if (totalSpeechSec >= 2.0) {
                const oldestSample = wordSamplesRef.current[0];
                const windowSec = (now - oldestSample.timestamp) / 1000;
                const wordsInWindow = currentWords - oldestSample.wordCount;

                // Tốc độ bình quân từ lúc bắt đầu nói
                const cumulativeWpm = (currentWords / totalSpeechSec) * 60;

                if (windowSec >= 2.5) {
                  // Tốc độ trong cửa sổ trượt 3 - 6 giây
                  const windowWpm = (wordsInWindow / windowSec) * 60;
                  // Kết hợp 35% cửa sổ trượt + 65% bình quân lũy kế để ổn định, không bị vọt ảo
                  calculatedWpm = Math.round(0.35 * windowWpm + 0.65 * cumulativeWpm);
                } else {
                  calculatedWpm = Math.round(cumulativeWpm);
                }

                // Kẹp trong giới hạn tự nhiên của thuyết trình tiếng Việt [0 - 240 WPM]
                calculatedWpm = Math.min(240, Math.max(0, calculatedWpm));
                lastWpmRef.current = calculatedWpm;
                setEstimatedWpm(calculatedWpm);
              } else if (totalSpeechSec > 0.5) {
                // Trong 2 giây đầu: Ước lượng thận trọng
                const earlyWpm = Math.min(130, Math.round((currentWords / totalSpeechSec) * 60));
                lastWpmRef.current = earlyWpm;
                setEstimatedWpm(earlyWpm);
              }

              onTranscriptChange?.(
                finalPiece ? finalTranscriptRef.current : fullCurrentText,
                Boolean(finalPiece),
                calculatedWpm
              );
            } else if (currentInterim) {
              lastSpokenTimestampRef.current = now;
              setIsSilent(false);
              onTranscriptChange?.(currentInterim, false);
            }
          };

          recognition.onerror = (event: any) => {
            // Bỏ qua các lỗi vô hại như 'no-speech' hoặc 'aborted' khi ngắt nghỉ tự nhiên
            if (event.error === 'no-speech' || event.error === 'aborted') {
              return;
            }
            console.warn('[SpeechRecognition] error:', event.error);
            if (event.error === 'not-allowed') {
              setSpeechError('Quyền micro bị từ chối. Hãy cho phép micro trong cài đặt trang web (biểu tượng ổ khóa).');
              setHasMicPermission(false);
            } else if (event.error === 'network') {
              setSpeechError('Không kết nối được dịch vụ nhận diện giọng nói (Google Speech bị chặn hoặc lỗi mạng). Hãy dùng tab Gõ Phím.');
            } else if (event.error === 'audio-capture') {
              setSpeechError('Không tìm thấy thiết bị micro hoặc micro đang bị ứng dụng khác chiếm dụng.');
            } else {
              setSpeechError(`Lỗi nhận diện âm thanh (${event.error}).`);
            }
          };

          // Khi Web Speech API tự ngắt (do hết buffer, ngắt nghỉ câu): Khởi tạo instance mới lập tức nếu đang thu
          recognition.onend = () => {
            if (isRecordingRef.current) {
              setTimeout(() => {
                if (isRecordingRef.current) {
                  startSpeechRecognition();
                }
              }, 80);
            }
          };

          recognition.start();
          recognitionRef.current = recognition;
        } catch (err) {
          console.warn('[SpeechRecognition] Failed to start recognition instance:', err);
        }
      };

      startSpeechRecognition();
    } catch (err: any) {
      console.error('[useAudioRecorder] getUserMedia error:', err);
      setHasMicPermission(false);
      setIsRecording(false);
      isRecordingRef.current = false;
      const errMsg =
        err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
          ? 'Quyền truy cập micro bị chặn. Vui lòng bấm biểu tượng ổ khóa/camera trên thanh địa chỉ để BẬT MICRO.'
          : err?.message || 'Không thể kết nối với thiết bị Microphone.';
      setSpeechError(errMsg);
    }
  }, [onTranscriptChange, onVadSilenceAlert, vadThresholdSec]);

  // Cập nhật transcript thủ công (ví dụ gõ phím hoặc dán văn bản pitch)
  const setManualTranscript = useCallback(
    (text: string) => {
      finalTranscriptRef.current = text;
      setTranscript(text);
      setInterimTranscript('');
      const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
      wordsCountRef.current = words;
      scheduleChunkSegmentation(text);
    },
    [scheduleChunkSegmentation]
  );

  // Dừng thu âm
  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    setIsRecording(false);
    setAudioLevel(0);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch {
        // Ignored
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      try {
        rec.stop();
      } catch {
        // Ignored
      }
    }
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
    if (interimCommitTimerRef.current) {
      clearTimeout(interimCommitTimerRef.current);
      interimCommitTimerRef.current = null;
    }
  }, []);

  // Xóa sạch dữ liệu transcript và bộ đệm lời nói để chuẩn bị cho câu hỏi mới
  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    finalTranscriptRef.current = '';
    pendingInterimRef.current = '';
    wordsCountRef.current = 0;
    wordSamplesRef.current = [];
    lastWpmRef.current = 0;
    speechStartTimestampRef.current = null;
    setEstimatedWpm(0);
    sequenceIdRef.current = 0;
    chunkBufferRef.current = '';
    chunkWordCountRef.current = 0;
    chunkStartTimeRef.current = Date.now();
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
    if (interimCommitTimerRef.current) {
      clearTimeout(interimCommitTimerRef.current);
      interimCommitTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopRecording();
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current);
        pauseTimerRef.current = null;
      }
    };
  }, [stopRecording]);

  return {
    isRecording,
    audioLevel,
    transcript,
    interimTranscript,
    hasMicPermission,
    speechError,
    estimatedWpm,
    isSilent,
    startRecording,
    stopRecording,
    resetTranscript,
    flushRemainingBuffer,
    setManualTranscript,
  };
}
