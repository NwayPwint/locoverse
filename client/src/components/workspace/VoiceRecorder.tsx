'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, Play, Trash2, Loader2 } from 'lucide-react';
import api from '@/lib/api';

interface VoiceRecorderProps {
  existingUrl?: string;
  existingPublicId?: string;
  onSave: (url: string, publicId: string) => void;
  onDelete: () => void;
}

interface AudioDevice {
  deviceId: string;
  label: string;
}

export default function VoiceRecorder({ existingUrl, existingPublicId, onSave, onDelete }: VoiceRecorderProps) {
  const [state, setState] = useState<'idle' | 'recording' | 'uploading' | 'playing'>('idle');
  const [error, setError] = useState('');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [showDevicePicker, setShowDevicePicker] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const levelRafRef = useRef<number>(0);

  const hasRecording = !!existingUrl;

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cleanupAudioCtx = useCallback(() => {
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
  }, []);

  const enumerateDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const inputs = all
        .filter(d => d.kind === 'audioinput')
        .map(d => ({ deviceId: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0, 8)}` }));
      setDevices(inputs);
      if (!selectedDevice && inputs.length > 0) {
        setSelectedDevice(inputs[0].deviceId);
      }
    } catch {
      // enumerateDevices requires permission first
    }
  }, [selectedDevice]);

  useEffect(() => {
    return () => {
      clearTimer();
      cleanupStream();
      cleanupAudioCtx();
      cancelAnimationFrame(levelRafRef.current);
    };
  }, [clearTimer, cleanupStream, cleanupAudioCtx]);

  const startRecording = async (deviceId?: string) => {
    setError('');
    setShowDevicePicker(false);
    try {
      const constraints: MediaStreamConstraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const audioTracks = stream.getAudioTracks();
      console.log('Mic tracks:', audioTracks.map(t => ({ label: t.label, enabled: t.enabled, muted: t.muted, settings: t.getSettings() })));
      if (audioTracks.length === 0 || !audioTracks[0].enabled) {
        setError('No active microphone');
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      const actualTrack = audioTracks[0];
      const actualSettings = actualTrack.getSettings();
      console.log('Actual mic:', actualTrack.label, 'deviceId:', actualSettings.deviceId);

      if (actualSettings.sampleRate && actualSettings.sampleRate < 1000) {
        console.warn('Mic sample rate suspiciously low:', actualSettings.sampleRate);
      }

      streamRef.current = stream;
      chunks.current = [];

      // Update device list now that we have permission
      await enumerateDevices();
      if (actualSettings.deviceId) {
        setSelectedDevice(actualSettings.deviceId);
      }

      cancelAnimationFrame(levelRafRef.current);
      cleanupAudioCtx();
      const audioCtx = new AudioContext();
      await audioCtx.resume();
      audioCtxRef.current = audioCtx;
      console.log('AudioContext state:', audioCtx.state);
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      console.log('Analyser connected, bins:', dataArray.length);

      let frameCount = 0;
      let hasInput = false;
      const updateLevel = () => {
        analyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] - 128) / 128;
          sum += v * v;
        }
        const level = Math.round(Math.sqrt(sum / dataArray.length) * 100);
        if (level > 1) hasInput = true;
        if (frameCount < 10) console.log('Mic frame', frameCount, ':', level, 'raw[0..4]:', dataArray.slice(0, 5));
        frameCount++;
        setMicLevel(level);
        levelRafRef.current = requestAnimationFrame(updateLevel);
      };
      levelRafRef.current = requestAnimationFrame(updateLevel);

      const recorder = new MediaRecorder(stream);
      mediaRecorder.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };

      recorder.onstop = async () => {
        clearTimer();
        cancelAnimationFrame(levelRafRef.current);
        setMicLevel(0);
        cleanupAudioCtx();
        cleanupStream();
        const mimeType = mediaRecorder.current?.mimeType || 'audio/webm';
        const blob = new Blob(chunks.current, { type: mimeType });
        console.log('Recording blob:', { size: blob.size, type: blob.type, chunks: chunks.current.length, hasInput });
        setState('uploading');

        try {
          const ext = mimeType.includes('mp4') ? 'm4a' : 'webm';
          const formData = new FormData();
          formData.append('audio', blob, `recording.${ext}`);
          const res = await api.post('/compositions/upload-audio', formData);
          console.log('Upload OK:', res.data.url, res.data.publicId);
          onSave(res.data.url, res.data.publicId);
          setState('idle');
        } catch {
          setError('Upload failed');
          setState('idle');
        }
      };

      recorder.onerror = () => {
        clearTimer();
        cancelAnimationFrame(levelRafRef.current);
        setMicLevel(0);
        cleanupAudioCtx();
        cleanupStream();
        setError('Recording failed');
        setState('idle');
      };

      recorder.start();
      setRecordingSeconds(0);
      clearTimer();
      timerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
      setState('recording');
    } catch (err) {
      console.error('Mic error:', err);
      setError('Microphone access denied');
    }
  };

  const stopRecording = () => {
    clearTimer();
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
    }
  };

  const playRecording = async () => {
    if (!existingUrl || !audioRef.current) return;
    const audio = audioRef.current;
    audio.volume = 1;
    audio.currentTime = 0;
    try {
      await audio.play();
      setState('playing');
    } catch (err) {
      console.error('Playback error:', err);
      setError('Playback failed');
      setState('idle');
    }
  };

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setState('idle');
  };

  const handleDelete = async () => {
    stopPlayback();
    setState('idle');
    if (existingPublicId) {
      try {
        await api.post('/compositions/delete-audio', { publicId: existingPublicId });
      } catch (err) {
        console.error('Failed to delete from Cloudinary:', err);
      }
    }
    onDelete();
  };

  const handleMicClick = async () => {
    if (devices.length === 0) {
      await enumerateDevices();
    }
    if (devices.length <= 1) {
      startRecording();
    } else {
      setShowDevicePicker(!showDevicePicker);
    }
  };

  return (
    <div className="flex items-center gap-1 relative">
      {existingUrl && (
        <audio
          ref={audioRef}
          src={existingUrl}
          onEnded={() => setState('idle')}
          onError={(e) => { console.error('Audio error:', e); setError('Playback failed'); setState('idle'); }}
          preload="auto"
        />
      )}

      {/* Device picker dropdown */}
      {showDevicePicker && state === 'idle' && (
        <div className="absolute bottom-full left-0 mb-1 bg-white border border-border shadow-lg z-50 min-w-[200px]">
          <div className="p-1.5 text-[7px] font-mono uppercase tracking-wider text-text-secondary/50 border-b border-border">
            Select microphone
          </div>
          {devices.map(d => (
            <button
              key={d.deviceId}
              onClick={() => {
                setSelectedDevice(d.deviceId);
                setShowDevicePicker(false);
                startRecording(d.deviceId);
              }}
              className={`w-full text-left px-2 py-1.5 text-[9px] font-mono hover:bg-accent-action/5 transition-colors flex items-center gap-2 ${
                d.deviceId === selectedDevice ? 'text-accent-action bg-accent-action/5' : 'text-text-primary'
              }`}
            >
              <Mic size={10} />
              <span className="truncate">{d.label}</span>
              {d.deviceId === selectedDevice && <span className="ml-auto text-accent-action">●</span>}
            </button>
          ))}
        </div>
      )}

      {state === 'uploading' ? (
        <Loader2 size={14} className="animate-spin text-text-secondary/40" />
      ) : state === 'recording' ? (
        <button onClick={stopRecording} className="p-1 text-red-500 hover:text-red-600 animate-pulse" title="Stop recording">
          <Square size={14} />
        </button>
      ) : (
        <button
          onClick={handleMicClick}
          disabled={state === 'playing'}
          className={`p-1 transition-colors flex items-center gap-1 ${state === 'playing' ? 'text-text-secondary/30' : hasRecording ? 'text-accent-action hover:text-red-500' : 'text-text-secondary/40 hover:text-red-500'}`}
          title={hasRecording ? 'Re-record' : 'Record vocal/melody'}
        >
          <Mic size={14} />
          <span className="hidden sm:inline text-[9px] font-mono">{hasRecording ? 'Re-record' : 'Record'}</span>
        </button>
      )}

      {hasRecording && state !== 'uploading' && (
        <>
          {state === 'playing' ? (
            <button onClick={stopPlayback} className="p-1 text-accent-action hover:text-accent-action/80" title="Stop playback">
              <Square size={12} />
            </button>
          ) : (
            <button onClick={playRecording} className="p-1 text-accent-action hover:text-accent-action/80" title="Play recording">
              <Play size={12} />
            </button>
          )}
          <button onClick={handleDelete} className="p-1 text-text-secondary/30 hover:text-red-500" title="Delete recording">
            <Trash2 size={12} />
          </button>
        </>
      )}

      {state === 'recording' && (
        <span className="text-[7px] font-mono text-red-500 uppercase flex items-center gap-1.5">
          <span className="w-1 h-1 bg-red-500 rounded-full animate-pulse" />
          {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, '0')}
          <span className="inline-flex items-end gap-[1px] h-3" title={`Level: ${micLevel}%`}>
            {[...Array(5)].map((_, i) => (
              <span
                key={i}
                className="w-[2px] rounded-sm transition-all duration-75"
                style={{
                  height: `${Math.max(2, (i + 1) * 6)}px`,
                  backgroundColor: micLevel > (i + 1) * 15 ? '#ef4444' : '#e2dde6',
                }}
              />
            ))}
          </span>
          {micLevel < 2 && <span className="text-[6px] text-yellow-500">no input?</span>}
        </span>
      )}

      {error && <span className="text-[7px] font-mono text-red-500">{error}</span>}
    </div>
  );
}
