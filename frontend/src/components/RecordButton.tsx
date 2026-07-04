import { useState, useRef } from 'react';

interface Props {
  onRecordingComplete: (blob: Blob) => void;
  disabled?: boolean;
}

export default function RecordButton({ onRecordingComplete, disabled }: Props) {
  const [recording, setRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    mediaRecorder.current = mr;
    chunks.current = [];
    mr.ondataavailable = (e) => chunks.current.push(e.data);
    mr.onstop = () => {
      const blob = new Blob(chunks.current, { type: 'audio/webm' });
      onRecordingComplete(blob);
      stream.getTracks().forEach((t) => t.stop());
    };
    mr.start();
    setRecording(true);
  };

  const stop = () => {
    mediaRecorder.current?.stop();
    setRecording(false);
  };

  return (
    <button
      onClick={recording ? stop : start}
      disabled={disabled}
      style={{
        padding: '12px 24px',
        borderRadius: '50px',
        border: 'none',
        background: recording ? '#ef4444' : '#6366f1',
        color: '#fff',
        fontSize: '16px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.2s',
      }}
    >
      {recording ? '⏹ 녹음 중지' : '🎙 내가 녹음하기'}
    </button>
  );
}
