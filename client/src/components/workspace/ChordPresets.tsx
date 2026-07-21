'use client';

import { useState } from 'react';
import { chordPresets } from '@/lib/chordPresets';

interface ChordPresetsProps {
  onSelect: (chords: string[]) => void;
}

export default function ChordPresets({ onSelect }: ChordPresetsProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-[9px] font-mono uppercase tracking-wider text-text-secondary/50 hover:text-accent-action transition-colors"
      >
        {expanded ? '− Presets' : '+ Presets'}
      </button>

      {expanded && (
        <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-3 gap-1">
          {chordPresets.map((preset) => (
            <button
              key={preset.name}
              onClick={() => onSelect(preset.chords)}
              className="text-left border border-border bg-white px-2 py-1.5 hover:bg-accent-action/5 hover:border-accent-action/30 transition-colors group"
            >
              <p className="text-[10px] font-heading font-bold text-text-primary">{preset.name}</p>
              <p className="text-[8px] font-mono text-text-secondary/50">{preset.description}</p>
              <p className="text-[8px] font-mono text-text-secondary/30 mt-0.5">{preset.chords.join(' · ')}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
