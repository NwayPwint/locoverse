'use client';

import { useState } from 'react';
import { X, GripVertical, Plus, Headphones, Music, Sparkles, KeyboardMusic } from 'lucide-react';
import { playChord } from '@/lib/audio';
import ChordPlayer from './ChordPlayer';
import ChordPresets from './ChordPresets';
import ChordHelperModal from './ChordHelperModal';
import VoiceRecorder from './VoiceRecorder';
import NoteStaff from './NoteStaff';
import PianoRoll from './PianoRoll';
import { chordColor } from '@/lib/chordColors';

interface StructureItem {
  section: 'verse' | 'chorus' | 'bridge' | 'intro' | 'outro';
  index: number;
  content: string;
  chords?: string;
  recordingUrl?: string;
  recordingPublicId?: string;
  notes?: string;
  bars?: number;
}

interface StructureBlockProps {
  item: StructureItem;
  onChange: (content: string) => void;
  onChordsChange?: (chords: string) => void;
  onRecordingChange?: (url: string | undefined, publicId?: string) => void;
  onNotesChange?: (notes: string) => void;
  onBarsChange?: (bars: number) => void;
  onRemove: () => void;
}

const sectionColors: Record<string, string> = {
  verse: 'border-l-accent-action',
  chorus: 'border-l-accent-warm',
  bridge: 'border-l-purple-400',
  intro: 'border-l-blue-400',
  outro: 'border-l-gray-400',
};


export default function StructureBlock({ item, onChange, onChordsChange, onRecordingChange, onNotesChange, onBarsChange, onRemove }: StructureBlockProps) {
  const [showChordInput, setShowChordInput] = useState(false);
  const [chordBuffer, setChordBuffer] = useState('');
  const [showProgression, setShowProgression] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showChordHelper, setShowChordHelper] = useState(false);
  const [showPianoRoll, setShowPianoRoll] = useState(false);

  const chords = (item.chords || '').split(/\s+/).filter(Boolean);

  const addChord = () => {
    const trimmed = chordBuffer.trim();
    if (!trimmed) return;
    const next = chords.concat(trimmed.split(/\s+/)).join(' ');
    onChordsChange?.(next);
    setChordBuffer('');
    setShowChordInput(false);
  };

  const handlePreset = (presetChords: string[]) => {
    onChordsChange?.(presetChords.join(' '));
    setShowChordInput(false);
  };

  return (
    <div className={`border-l-4 ${sectionColors[item.section] || 'border-l-border'} pl-3 sm:pl-4 py-2`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <GripVertical size={14} className="text-text-secondary/30 hidden sm:block" />
          <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-text-secondary">{item.section} {item.index + 1}</span>
          <span className="text-[8px] font-mono text-text-secondary/40 flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            </svg>
            <input
              type="number"
              min={1}
              max={999}
              value={item.bars ?? 8}
              onChange={(e) => onBarsChange?.(Math.max(1, Number(e.target.value)))}
              className="w-6 text-[8px] font-mono bg-transparent border-none outline-none text-text-secondary/60 p-0 text-center"
            />
          </span>
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1">
          <VoiceRecorder
            existingUrl={item.recordingUrl}
            existingPublicId={item.recordingPublicId}
            onSave={(url, publicId) => onRecordingChange?.(url, publicId)}
            onDelete={() => onRecordingChange?.(undefined)}
          />
          <button
            onClick={() => setShowNotes(!showNotes)}
            className={`p-1 transition-colors flex items-center gap-1 ${showNotes ? 'text-accent-action' : 'text-text-secondary/40 hover:text-text-secondary'}`}
            title={showNotes ? 'Hide notation' : 'Show sheet music notation'}
          >
            <Music size={14} />
            <span className="hidden sm:inline text-[9px] font-mono">{showNotes ? 'Hide' : 'Notes'}</span>
          </button>
          <button
            onClick={() => setShowProgression(!showProgression)}
            className={`p-1 transition-colors flex items-center gap-1 ${showProgression ? 'text-accent-action' : 'text-text-secondary/40 hover:text-text-secondary'}`}
            title={showProgression ? 'Hide progression player' : 'Play chord progression'}
          >
            <Headphones size={14} />
            <span className="hidden sm:inline text-[9px] font-mono">{showProgression ? 'Hide' : 'Chords'}</span>
          </button>
          <button onClick={onRemove} className="p-0.5 text-red-400 hover:text-red-500">
            <X size={14} />
          </button>
        </div>
      </div>

      {chords.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {chords.map((chord, i) => (
            <button
              key={i}
              onClick={() => playChord(chord)}
              className={`text-[10px] font-mono font-bold px-1.5 py-0.5 border cursor-pointer hover:scale-105 active:scale-95 transition-transform ${chordColor(chord)}`}
              title={`Play ${chord}`}
            >
              {chord}
            </button>
          ))}
          <button
            onClick={() => setShowChordInput(true)}
            className="text-[10px] font-mono text-text-secondary hover:text-accent-action px-1"
          >
            <Plus size={12} />
          </button>
        </div>
      )}

      {chords.length === 0 && !showChordInput && (
        <div className="flex items-center gap-2 sm:gap-3 mb-2">
          <button
            onClick={() => setShowChordInput(true)}
            className="text-[9px] font-mono uppercase tracking-wider text-text-secondary/40 hover:text-accent-action transition-colors"
          >
            + Chords
          </button>
          <button
            onClick={() => setShowChordHelper(true)}
            className="text-[9px] font-mono uppercase tracking-wider text-text-secondary/40 hover:text-accent-action transition-colors flex items-center gap-1"
          >
            <Sparkles size={10} />
            AI Suggest
          </button>
        </div>
      )}

      {showChordInput && (
        <div className="mb-2 space-y-2">
          <div className="flex items-center gap-1">
            <input
              value={chordBuffer}
              onChange={(e) => setChordBuffer(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChord(); } }}
              placeholder="e.g. Am F G C"
              className="w-full max-w-[144px] text-[10px] font-mono border border-border bg-white px-2 py-1 text-text-primary placeholder:text-text-secondary/30 outline-none"
              autoFocus
            />
            <button onClick={addChord} className="text-[10px] font-mono text-accent-action hover:text-accent-action/80 px-1">
              Add
            </button>
            <button onClick={() => { setShowChordInput(false); setChordBuffer(''); }} className="text-[10px] font-mono text-text-secondary/50 hover:text-text-secondary px-1">
              Cancel
            </button>
          </div>
          <ChordPresets onSelect={handlePreset} />
        </div>
      )}

      <textarea
        value={item.content}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent border-none outline-none resize-none text-sm leading-relaxed text-text-primary placeholder:text-text-secondary/30 font-mono"
        rows={4}
        placeholder={`Write your ${item.section} lyrics here...`}
      />

      {showNotes && (
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPianoRoll(true)}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono text-accent-action border border-accent-action hover:bg-accent-action/10 transition-colors"
            >
              <KeyboardMusic size={12} />
              Open Piano Roll
            </button>
            <span className="text-[7px] font-mono text-text-secondary/30">— or type ABC directly:</span>
          </div>
          <textarea
            value={item.notes || ''}
            onChange={(e) => onNotesChange?.(e.target.value)}
            className="w-full bg-background border border-border resize-none text-[10px] font-mono leading-relaxed text-text-primary placeholder:text-text-secondary/30 outline-none px-2 py-1.5"
            rows={2}
            placeholder={`e.g. C D E F | G A B c |`}
          />
          <NoteStaff abc={item.notes || ''} />
          <p className="text-[7px] font-mono text-text-secondary/30">ABC notation: pitch (C D E F G A B), note length (C2=half, C4=quarter, C8=eighth), rest (z), bar (|)</p>
          {showPianoRoll && (
            <PianoRoll
              bars={item.bars ?? 8}
              beatsPerBar={4}
              initialNotes={item.notes || ''}
              onSave={(abc) => { onNotesChange?.(abc); setShowPianoRoll(false); }}
              onClose={() => setShowPianoRoll(false)}
            />
          )}
        </div>
      )}

      {showProgression && chords.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <ChordPlayer chords={chords} />
        </div>
      )}

      {showChordHelper && (
        <ChordHelperModal
          onClose={() => setShowChordHelper(false)}
          onApply={(chords) => onChordsChange?.(chords.join(' '))}
        />
      )}
    </div>
  );
}
