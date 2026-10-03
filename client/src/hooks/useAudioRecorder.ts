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
      wordsCountRef.current = 0;
      lastSpokenTimestampRef.current = Date.now();

      // 1. Phân tích Sóng âm qua Web Audio API
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateMeter = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        const normalizedLevel = Math.min(100, Math.round((average / 128) * 100));
        setAudioLevel(normalizedLevel);

        // Kiểm tra VAD: Nếu có âm lượng > 15 thì đang nói, ngược lại tính thời gian im lặng
        const now = Date.now();
        if (normalizedLevel > 18) {
          lastSpokenTimestampRef.current = now;
          setIsSilent(false);
        } else {
          const silenceSec = (now - lastSpokenTimestampRef.current) / 1000;
          if (silenceSec >= vadThresholdSec) {
            setIsSilent(true);
            onVadSilenceAlert?.(silenceSec);
          }
        }

        animationFrameRef.current = requestAnimationFrame(updateMeter);
      };

      updateMeter();

      // 2. Kích hoạt Web Speech Recognition (Hỗ trợ tiếng Việt độ trễ cực thấp)
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
            setTranscript((prev) => {
              const updated = (prev + ' ' + finalPiece).trim();
              const words = updated.split(/\s+/).filter(Boolean).length;
              wordsCountRef.current = words;
              const elapsedMinutes = (Date.now() - startTimeRef.current) / 60000;
              const wpm = elapsedMinutes > 0 ? Math.round(words / elapsedMinutes) : 0;
              setEstimatedWpm(wpm);
              onTranscriptChange?.(updated, true, wpm);
              return updated;
            });
          }

          setInterimTranscript(currentInterim);
          if (currentInterim) {
            lastSpokenTimestampRef.current = Date.now();
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
