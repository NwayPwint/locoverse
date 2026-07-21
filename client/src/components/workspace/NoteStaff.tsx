'use client';

import { useRef, useEffect, useState } from 'react';
import { Play, Square } from 'lucide-react';
import ABCJS from 'abcjs';
import { playAbc } from '@/lib/audio';

interface NoteStaffProps {
  abc: string;
}

export default function NoteStaff({ abc }: NoteStaffProps) {
  const staffRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!staffRef.current || !abc.trim()) return;
    try {
      ABCJS.renderAbc(staffRef.current, abc, {
        responsive: 'resize',
        staffwidth: 600,
        paddingleft: 0,
        paddingright: 0,
        paddingtop: 10,
        paddingbottom: 10,
      });
    } catch {
      // invalid ABC — silently ignore
    }
  }, [abc]);

  useEffect(() => {
    return () => { stopRef.current?.(); };
  }, []);

  const handlePlay = () => {
    if (playing) {
      stopRef.current?.();
      stopRef.current = null;
      setPlaying(false);
      return;
    }

    if (!abc.trim()) return;

    const { stop } = playAbc(abc);
    stopRef.current = stop;
    setPlaying(true);

    // auto-reset when playback ends
    const events = abc.replace(/\|/g, ' ').trim().split(/\s+/).filter(Boolean);
    const totalBeats = events.reduce((sum, t) => {
      let len = 1;
      const numMatch = t.match(/\d+$/);
      if (numMatch) len = 4 / parseInt(numMatch[0]);
      return sum + len;
    }, 0);
    const durationMs = (totalBeats * 0.5 / 1) * 1000; // approx at 120 BPM
    setTimeout(() => {
      setPlaying(false);
      stopRef.current = null;
    }, durationMs);
  };

  if (!abc.trim()) return null;

  return (
    <div className="space-y-1">
      <div
        ref={staffRef}
        className="overflow-x-auto bg-white border border-border rounded-none"
        style={{ minHeight: 60 }}
      />
      <div className="flex items-center gap-2">
        <button
          onClick={handlePlay}
          disabled={!abc.trim()}
          className="p-1 text-accent-action hover:text-accent-action/80 disabled:text-text-secondary/30 transition-colors"
          title={playing ? 'Stop' : 'Play melody'}
        >
          {playing ? <Square size={14} /> : <Play size={14} />}
        </button>
        <span className="text-[7px] font-mono text-text-secondary/30">
          {playing ? 'Playing...' : 'Preview melody'}
        </span>
      </div>
    </div>
  );
}
