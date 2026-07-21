'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Play, Square, X, RotateCcw, RadioReceiver, Circle } from 'lucide-react';
import { playAbc, playMidi } from '@/lib/audio';
import { useMidiInput } from '@/lib/useMidiInput';

interface PianoRollProps {
  bars: number;
  beatsPerBar: number;
  initialNotes: string;
  onSave: (abc: string) => void;
  onClose: () => void;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NATURAL_PITCHES = new Set([0, 2, 4, 5, 7, 9, 11]);
const NOTE_LENGTHS = [
  { label: '1/8', beats: 0.5, gridClass: '' },
  { label: '1/4', beats: 1, gridClass: '' },
  { label: '1/2', beats: 2, gridClass: '' },
  { label: '1', beats: 4, gridClass: '' },
] as const;

function midiToNote(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const pc = midi % 12;
  return `${NOTE_NAMES[pc]}${octave}`;
}

function midiToAbcPitch(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const pc = midi % 12;
  const letter = NOTE_NAMES[pc][0];
  const accidental = NOTE_NAMES[pc].length > 1 ? (NOTE_NAMES[pc][1] === '#' ? '^' : '_') : '';

  if (octave === 4) return accidental + letter;
  if (octave === 5) return accidental + letter.toLowerCase();
  if (octave === 3) return accidental + letter + ',';
  if (octave === 2) return accidental + letter + ',,';
  if (octave === 6) return accidental + letter.toLowerCase() + "'";
  return accidental + letter;
}

function isNatural(midi: number): boolean {
  return NATURAL_PITCHES.has(midi % 12);
}

export default function PianoRoll({ bars, beatsPerBar, initialNotes, onSave, onClose }: PianoRollProps) {
  const totalBeats = bars * beatsPerBar;
  const [noteLengthIdx, setNoteLengthIdx] = useState(1);
  const [notes, setNotes] = useState<Set<string>>(() => new Set());
  const [playing, setPlaying] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const rowContainerRef = useRef<HTMLDivElement>(null);

  const [midiRecording, setMidiRecording] = useState(false);
  const [midiCursor, setMidiCursor] = useState(0);
  const midiState = useMidiInput(midiRecording ? (ev) => {
    const step = Math.min(midiCursor, steps - 1);
    if (step < 0) return;
    const key = `${ev.midi}:${step}`;
    setNotes(prev => {
      const next = new Set(prev);
      if (!next.has(key)) {
        next.add(key);
        playMidi(ev.midi, 0.3);
      }
      return next;
    });
    setMidiCursor(prev => Math.min(prev + 1, steps - 1));
  } : undefined);

  const noteLength = NOTE_LENGTHS[noteLengthIdx].beats;
  const steps = Math.round(totalBeats / noteLength);

  useEffect(() => {
    return () => { stopRef.current?.(); };
  }, []);

  useEffect(() => {
    if (!initialNotes.trim()) return;
    const events = parseAbcWithBeats(initialNotes);
    const newSet = new Set<string>();
    for (const ev of events) {
      if (ev.midi < 0) continue;
      const step = Math.round(ev.beat / noteLength);
      newSet.add(`${ev.midi}:${step}`);
    }
    setNotes(newSet);
  }, [initialNotes, noteLength]);

  const handlePlay = useCallback(() => {
    if (playing) {
      stopRef.current?.();
      stopRef.current = null;
      setPlaying(false);
      return;
    }

    const abc = gridToAbc(notes, noteLength, bars, beatsPerBar);
    if (!abc.trim()) return;

    const { stop } = playAbc(abc, 120);
    stopRef.current = stop;
    setPlaying(true);

    const totalBeats2 = Array.from(notes).reduce((max, key) => {
      const step = parseInt(key.split(':')[1]);
      return Math.max(max, step);
    }, 0) * noteLength + 2;
    const durationMs = (totalBeats2 / 4) * 2000;
    setTimeout(() => {
      setPlaying(false);
      stopRef.current = null;
    }, durationMs);
  }, [notes, noteLength, bars, beatsPerBar, playing]);

  const toggleNote = useCallback((midi: number, step: number) => {
    const key = `${midi}:${step}`;
    setNotes(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        playMidi(midi, 0.3);
      }
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    if (playing) {
      stopRef.current?.();
      stopRef.current = null;
      setPlaying(false);
    }
    setNotes(new Set());
  }, [playing]);

  const handleApply = useCallback(() => {
    const abc = gridToAbc(notes, noteLength, bars, beatsPerBar);
    onSave(abc);
  }, [notes, noteLength, bars, beatsPerBar, onSave]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (rowContainerRef.current) {
      rowContainerRef.current.scrollTop += e.deltaY;
    }
  }, []);

  const visibleMidis: number[] = [];
  for (let m = 48; m <= 84; m++) {
    visibleMidis.push(m);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-background border border-border shadow-2xl max-w-[900px] w-full mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <h3 className="text-xs font-mono uppercase tracking-wider text-text-secondary">Piano Roll</h3>
          <button onClick={onClose} className="p-1 text-text-secondary/50 hover:text-text-secondary">
            <X size={14} />
          </button>
        </div>

        <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-background/50">
          <span className="text-[8px] font-mono text-text-secondary/50 uppercase tracking-wider">Note</span>
          <div className="flex gap-0.5">
            {NOTE_LENGTHS.map((len, idx) => (
              <button
                key={len.label}
                onClick={() => setNoteLengthIdx(idx)}
                className={`px-2 py-0.5 text-[10px] font-mono border transition-colors ${
                  idx === noteLengthIdx
                    ? 'bg-accent-action text-white border-accent-action'
                    : 'text-text-secondary/60 border-border hover:text-text-secondary hover:border-text-secondary/30'
                }`}
              >
                {len.label}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMidiRecording(prev => !prev)}
              className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono border transition-colors ${
                midiRecording
                  ? 'bg-red-500 text-white border-red-500 animate-pulse'
                  : 'text-text-secondary/60 border-border hover:text-text-secondary hover:border-text-secondary/30'
              }`}
              title={midiState.connected ? 'MIDI connected — click to record' : 'No MIDI device detected'}
            >
              {midiRecording ? <Circle size={10} fill="white" /> : <RadioReceiver size={10} />}
              {midiRecording ? `Rec ${midiCursor + 1}/${steps}` : 'MIDI'}
            </button>
            {midiState.connected && (
              <span className="text-[7px] font-mono text-green-600 hidden sm:inline" title={midiState.deviceName || ''}>
                ●
              </span>
            )}
            <button
              onClick={handlePlay}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono text-accent-action border border-accent-action hover:bg-accent-action/10 transition-colors"
            >
              {playing ? <Square size={10} /> : <Play size={10} />}
              {playing ? 'Stop' : 'Play'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex" ref={gridRef}>
          <div className="flex-shrink-0 border-r border-border bg-background/30">
            <div className="h-[28px]" />
            <div
              ref={rowContainerRef}
              className="overflow-y-auto"
              style={{ maxHeight: '60vh' }}
            >
              {visibleMidis.map(midi => (
                <div
                  key={midi}
                  className="flex items-center justify-end h-[22px] px-1.5 border-b border-border/30"
                  style={{ backgroundColor: isNatural(midi) ? 'transparent' : 'rgba(0,0,0,0.08)' }}
                >
                  <span className={`text-[8px] font-mono leading-none ${
                    isNatural(midi) ? 'text-text-secondary/50' : 'text-text-secondary/30'
                  }`}>
                    {midiToNote(midi)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-auto" onWheel={handleWheel}>
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${steps}, 20px)`,
                gridTemplateRows: `repeat(${visibleMidis.length}, 22px)`,
                width: steps * 20,
              }}
            >
              {visibleMidis.map(midi =>
                Array.from({ length: steps }, (_, step) => {
                  const key = `${midi}:${step}`;
                  const isOn = notes.has(key);
                  const isBarStart = (step * noteLength) % beatsPerBar === 0;
                  const isCursor = midiRecording && step === midiCursor;
                  return (
                    <button
                      key={`${midi}-${step}`}
                      onClick={() => toggleNote(midi, step)}
                      className={`border-r border-b transition-colors ${
                        isBarStart ? 'border-l-2 border-l-border/60' : 'border-r-border/20'
                      } ${
                        isCursor && !isOn ? 'bg-accent-action/15' : ''
                      } ${
                        isOn
                          ? 'bg-accent-action/80 hover:bg-accent-action text-white'
                          : isNatural(midi)
                            ? 'bg-background hover:bg-accent-action/5'
                            : 'bg-black/10 hover:bg-accent-action/10'
                      }`}
                      style={{ width: 20, height: 22 }}
                      title={`${midiToNote(midi)} at step ${step + 1}`}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-background/50">
          <button
            onClick={clearAll}
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono text-red-400 hover:text-red-500 transition-colors"
          >
            <RotateCcw size={10} />
            Clear
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1 text-[10px] font-mono text-text-secondary/60 hover:text-text-secondary border border-border transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-3 py-1 text-[10px] font-mono text-white bg-accent-action hover:bg-accent-action/80 transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function parseAbcWithBeats(abc: string): { midi: number; beat: number }[] {
  const events: { midi: number; beat: number }[] = [];
  const tokens = abc.replace(/\|/g, ' ').trim().split(/\s+/).filter(Boolean);
  let beat = 0;

  const ABC_PITCH_MAP: Record<string, number> = {
    C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
  };

  for (const token of tokens) {
    let i = 0;
    let sharp = 0;
    let flat = 0;
    let octave = 4;
    let length = 1;

    while (i < token.length && (token[i] === '^' || token[i] === '_')) {
      if (token[i] === '^') sharp++;
      else flat++;
      i++;
    }

    if (i >= token.length) continue;
    const letter = token[i];
    if (letter === 'z' || letter === 'Z') {
      i++;
      let numStr = '';
      while (i < token.length && /\d/.test(token[i])) { numStr += token[i]; i++; }
      if (numStr) length = 4 / parseInt(numStr);
      beat += length;
      continue;
    }

    if (!(letter.toUpperCase() in ABC_PITCH_MAP)) continue;
    const isLowercase = letter === letter.toLowerCase();
    const semitone = ABC_PITCH_MAP[letter.toUpperCase()];
    i++;

    if (isLowercase) octave = 5;

    while (i < token.length && token[i] === ',') { octave--; i++; }
    while (i < token.length && token[i] === '\'') { octave++; i++; }

    let numStr = '';
    while (i < token.length && /\d/.test(token[i])) { numStr += token[i]; i++; }
    if (numStr) length = 4 / parseInt(numStr);

    const midi = (octave + 1) * 12 + semitone + sharp - flat;
    events.push({ midi, beat });
    beat += length;
  }

  return events;
}

function gridToAbc(
  notes: Set<string>,
  noteLength: number,
  bars: number,
  beatsPerBar: number
): string {
  if (notes.size === 0) return '';

  const entries: { midi: number; step: number }[] = [];
  notes.forEach((key) => {
    const [midiStr, stepStr] = key.split(':');
    entries.push({ midi: parseInt(midiStr), step: parseInt(stepStr) });
  });

  entries.sort((a, b) => a.step - b.step || a.midi - b.midi);

  const beatToNotes = new Map<number, number[]>();
  for (const { midi, step } of entries) {
    const beat = step * noteLength;
    const existing = beatToNotes.get(beat) || [];
    existing.push(midi);
    beatToNotes.set(beat, existing);
  }

  const totalBeats = bars * beatsPerBar;
  const abcTokens: string[] = [];

  for (let b = 0; b < totalBeats; b += noteLength) {
    const midis = beatToNotes.get(b) || [];
    if (midis.length > 0) {
      for (const midi of midis) {
        const pitch = midiToAbcPitch(midi);
        const lengthSuffix = noteLength === 1 ? '' : (noteLength >= 1 ? `${Math.round(4 / noteLength)}` : `/${Math.round(1 / noteLength)}`);
        abcTokens.push(`${pitch}${lengthSuffix}`);
      }
    } else {
      abcTokens.push('z');
    }

    if ((b + noteLength) % beatsPerBar === 0) {
      abcTokens.push('|');
    }
  }

  return abcTokens.join(' ');
}
