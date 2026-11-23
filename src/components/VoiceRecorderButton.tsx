import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Square } from 'lucide-react';
import { transcribeAudio } from '../services/api';

interface VoiceRecorderButtonProps {
  onTranscript: (text: string) => void;
  onError?: (msg: string) => void;
  compact?: boolean;
  label?: string;
}

export const VoiceRecorderButton: React.FC<VoiceRecorderButtonProps> = ({
  onTranscript,
  onError,
  compact = false,
  label = 'Speak',
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!isRecording) {
      setSeconds(0);
      return;
    }
    const timer = window.setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isRecording]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      onError?.('Microphone access is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const preferredMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType: preferredMime });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        setIsRecording(false);
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        const baseMime = preferredMime.split(';')[0] || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: baseMime });
        if (blob.size < 200) {
          onError?.('Recording was too short. Hold or speak for at least a second.');
          return;
        }

        setIsTranscribing(true);
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = typeof reader.result === 'string' ? reader.result : '';
              const commaIndex = result.indexOf(',');
              resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
            };
            reader.onerror = () => reject(new Error('Failed to read recorded audio.'));
            reader.readAsDataURL(blob);
          });

          const { transcript } = await transcribeAudio(base64, baseMime);
          if (transcript) {
            onTranscript(transcript);
          } else {
            onError?.('No speech was detected in the recording.');
          }
        } catch (err) {
          onError?.(err instanceof Error ? err.message : 'Audio transcription failed.');
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      onError?.(
        err instanceof Error
          ? `Microphone permission needed: ${err.message}`
          : 'Could not access microphone.'
      );
    }
  };

  const formattedTime = `0:${String(seconds).padStart(2, '0')}`;

  if (isTranscribing) {
    return (
      <button
        type="button"
        disabled
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#E4E7E2] bg-[#EEF1EC] text-[#52605A] text-xs font-medium whitespace-nowrap shrink-0 cursor-wait ${
          compact ? 'px-2.5 py-2 min-h-[38px]' : 'px-3.5 py-2 min-h-[40px]'
        }`}
        aria-label="Transcribing audio"
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1B6B4A]" />
        {!compact && <span>Transcribing...</span>}
      </button>
    );
  }

  if (isRecording) {
    return (
      <button
        type="button"
        onClick={stopRecording}
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#B91C1C] text-white text-xs font-medium hover:bg-[#991B1B] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B91C1C] ${
          compact ? 'px-2.5 py-2 min-h-[38px]' : 'px-3.5 py-2 min-h-[40px]'
        }`}
        title="Stop recording and transcribe"
      >
        <Square className="w-3 h-3 fill-current" />
        <span className="font-mono tabular-nums">{formattedTime}</span>
        {!compact && <span>Stop</span>}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={startRecording}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#D4DBD1] bg-white text-[#13201B] text-xs font-medium hover:bg-[#F1F4EF] hover:border-[#1B6B4A]/40 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B6B4A] ${
        compact ? 'px-2.5 py-2 min-h-[38px]' : 'px-3.5 py-2 min-h-[40px]'
      }`}
      title="Record voice note (transcribed with Gemini)"
      aria-label={label}
    >
      <Mic className="w-3.5 h-3.5 text-[#1B6B4A]" />
      {!compact && <span>{label}</span>}
    </button>
  );
};
