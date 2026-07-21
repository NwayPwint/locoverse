'use client';

import { useState } from 'react';
import { X, Sparkles, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { CHORD_KEY_WITH_MINOR, GENRES, MOODS } from '@/lib/chordKeys';
import { chordColor } from '@/lib/chordColors';

interface ChordHelperModalProps {
  onClose: () => void;
  onApply: (chords: string[]) => void;
}


export default function ChordHelperModal({ onClose, onApply }: ChordHelperModalProps) {
  const [key, setKey] = useState('C');
  const [genre, setGenre] = useState('pop');
  const [mood, setMood] = useState('happy');
  const [loading, setLoading] = useState(false);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [regionError, setRegionError] = useState('');

  const handleSuggest = async () => {
    setLoading(true);
    setError('');
    setRegionError('');
    setSuggested([]);
    try {
      const res = await api.post('/compositions/suggest-chords', { key, genre, mood });
      setSuggested(res.data.chords);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string; message?: string } } };
      if (axiosErr?.response?.data?.error === 'REGION_BLOCKED') {
        setRegionError(axiosErr.response.data.message || 'Region blocked');
      } else {
        setError('Failed to generate chord suggestion');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (suggested.length > 0) {
      onApply(suggested);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-white border border-border w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-sm font-heading font-bold uppercase tracking-[0.15em]">Chord Helper</h2>
          <button onClick={onClose} className="p-1 text-text-secondary hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-1.5">Key</label>
              <select
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="input-field text-sm py-2"
              >
                {CHORD_KEY_WITH_MINOR.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-1.5">Genre</label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="input-field text-sm py-2"
              >
                {GENRES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-1.5">Mood</label>
              <select
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                className="input-field text-sm py-2"
              >
                {MOODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {suggested.length > 0 && (
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-1.5">Suggested Progression</label>
              <div className="flex flex-wrap gap-1.5">
                {suggested.map((chord, i) => (
                  <span
                    key={i}
                    className={`text-xs font-mono font-bold px-2 py-1 border ${chordColor(chord)}`}
                  >
                    {chord}
                  </span>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700 font-mono">
              {error}
            </div>
          )}
          {regionError && (
            <div className="bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700 font-mono">
              {regionError}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary !px-4 !min-h-[36px] !text-[10px]">
            Cancel
          </button>
          {suggested.length > 0 && (
            <button onClick={handleApply} className="btn-primary !px-4 !min-h-[36px] !text-[10px]">
              Apply Chords
            </button>
          )}
          <button
            onClick={handleSuggest}
            disabled={loading}
            className="btn-primary !px-4 !min-h-[36px] !text-[10px] flex items-center gap-2"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {loading ? 'Thinking...' : 'Suggest'}
          </button>
        </div>
      </div>
    </div>
  );
}
