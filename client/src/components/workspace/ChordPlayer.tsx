'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Play, Pause, Square } from 'lucide-react';
import { playChord, stopAll } from '@/lib/audio';
import { chordColor } from '@/lib/chordColors';

interface ChordPlayerProps {
  chords: string[];
}


export default function ChordPlayer({ chords }: ChordPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [bpm, setBpm] = useState(80);
  const beatsPerChord = 4;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    const ms = (60000 / bpm) * beatsPerChord;
    intervalRef.current = setInterval(() => {
      setCurrentIndex(prev => {
        const next = prev + 1;
        if (next >= chords.length) return 0;
        return next;
      });
    }, ms);
  }, [bpm, chords.length, clearTimer]);

  const play = useCallback(() => {
    if (chords.length === 0) return;
    stopAll();
    setIsPlaying(true);
    playChord(chords[currentIndex], (60000 / bpm) * beatsPerChord / 1000 + 0.5);
    startTimer();
  }, [chords, currentIndex, bpm, startTimer]);

  const pause = useCallback(() => {
    setIsPlaying(false);
    clearTimer();
  }, [clearTimer]);

  const stop = useCallback(() => {
    setIsPlaying(false);
    setCurrentIndex(0);
    clearTimer();
    stopAll();
  }, [clearTimer]);

  // Play chord when index changes during playback
  useEffect(() => {
    if (isPlaying && chords.length > 0) {
      stopAll();
      playChord(chords[currentIndex], (60000 / bpm) * beatsPerChord / 1000 + 0.5);
    }
  }, [currentIndex, isPlaying, bpm, chords]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { clearTimer(); stopAll(); };
  }, [clearTimer]);

  if (chords.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {chords.map((chord, i) => (
          <button
            key={i}
            onClick={() => { playChord(chord); if (!isPlaying) { setCurrentIndex(i); } }}
            className={`
              text-[10px] font-mono font-bold px-1.5 py-0.5 border transition-all
              ${currentIndex === i && isPlaying
                ? `${chordColor(chord)} ring-2 ring-accent-action scale-110`
                : chordColor(chord)
              }
              ${!isPlaying ? 'cursor-pointer hover:scale-105' : ''}
            `}
          >
            {chord}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        {isPlaying ? (
          <button onClick={pause} className="p-1 text-accent-action hover:text-accent-action/80 transition-colors">
            <Pause size={14} />
          </button>
        ) : (
          <button onClick={play} className="p-1 text-accent-action hover:text-accent-action/80 transition-colors">
            <Play size={14} />
          </button>
        )}
        <button onClick={stop} className="p-1 text-red-400 hover:text-red-500 transition-colors">
          <Square size={12} />
        </button>

        <div className="flex items-center gap-1.5 ml-2">
          <label className="text-[9px] font-mono uppercase tracking-wider text-text-secondary/50">BPM</label>
          <input
            type="number"
            value={bpm}
            onChange={(e) => setBpm(Math.max(30, Math.min(240, parseInt(e.target.value) || 80)))}
            className="w-12 text-[10px] font-mono border border-border bg-white px-1.5 py-0.5 text-text-primary text-center outline-none"
            min={30}
            max={240}
          />
        </div>

        <span className="text-[9px] font-mono text-text-secondary/40">
          {currentIndex + 1}/{chords.length}
        </span>
      </div>
    </div>
  );
}
