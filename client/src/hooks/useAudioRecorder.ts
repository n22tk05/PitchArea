import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseAudioRecorderOptions {
  onTranscriptChange?: (text: string, isFinal: boolean, wpm?: number) => void;
  onVadSilenceAlert?: (silenceDurationSec: number) => void;
  vadThresholdSec?: number;
}

export function useAudioRecorder({
  onTranscriptChange,
  onVadSilenceAlert,
  vadThresholdSec = 2.0,
}: UseAudioRecorderOptions = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0); // 0 - 100
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
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

  // Bắt đầu thu âm và kích hoạt Web Speech API
  const startRecording = useCallback(async () => {
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

      // 2. Kích hoạt Web Speech Recognition (Tính WPM thời gian thực cả trên Interim lẫn Final)
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'vi-VN';

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
            finalTranscriptRef.current = (
              finalTranscriptRef.current + ' ' + finalPiece
            ).trim();
            setTranscript(finalTranscriptRef.current);
          }

          setInterimTranscript(currentInterim);

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

        recognition.onerror = () => {
          // Xử lý lỗi ngầm không làm đứt mạch
        };

        recognition.start();
        recognitionRef.current = recognition;
      }
    } catch (err) {
      setHasMicPermission(false);
      setIsRecording(false);
    }
  }, [onTranscriptChange, onVadSilenceAlert, vadThresholdSec]);

  // Dừng thu âm
  const stopRecording = useCallback(() => {
    setIsRecording(false);
    setAudioLevel(0);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignored
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  return {
    isRecording,
    audioLevel,
    transcript,
    interimTranscript,
    hasMicPermission,
    estimatedWpm,
    isSilent,
    startRecording,
    stopRecording,
  };
}
