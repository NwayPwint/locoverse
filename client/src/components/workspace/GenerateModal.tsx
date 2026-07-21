'use client';

import { useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import api from '@/lib/api';

interface GenerateModalProps {
  onClose: () => void;
  onGenerated: (data: { lyrics: string; structure: { section: string; index: number; content: string; chords: string }[] }) => void;
}

const sectionTypes = ['verse', 'chorus', 'bridge', 'intro', 'outro'];

export default function GenerateModal({ onClose, onGenerated }: GenerateModalProps) {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('pop');
  const [language, setLanguage] = useState('English');
  const [sections, setSections] = useState(['verse', 'chorus', 'verse', 'chorus', 'bridge', 'chorus']);
  const [loading, setLoading] = useState(false);
  const [regionError, setRegionError] = useState('');

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setRegionError('');
    try {
      const res = await api.post('/compositions/generate-lyrics', { prompt, style, language, structure: sections });
      onGenerated(res.data);
      onClose();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string; message?: string } } };
      if (axiosErr?.response?.data?.error === 'REGION_BLOCKED') {
        setRegionError(axiosErr.response.data.message || 'Region blocked');
      } else {
        console.error('Failed to generate lyrics');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center">
      <div className="bg-white border border-border w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-sm font-heading font-bold uppercase tracking-[0.15em]">Generate Lyrics</h2>
          <button onClick={onClose} className="p-1 text-text-secondary hover:text-text-primary">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-1.5">Theme / Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. A sad breakup song about long distance..."
              className="input-field resize-none text-sm py-3"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-1.5">Style</label>
            <select value={style} onChange={(e) => setStyle(e.target.value)} className="input-field text-sm py-3">
              {['pop', 'rock', 'hip-hop', 'r&b', 'country', 'folk', 'electronic', 'jazz', 'indie', 'metal'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-1.5">Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className="input-field text-sm py-3">
              <option value="English">English</option>
              <option value="Burmese (မြန်မာ)">Burmese (မြန်မာ)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-1.5">Structure</label>
            <div className="flex flex-wrap gap-2">
              {sections.map((section, i) => (
                <div key={i} className="flex items-center gap-1">
                  <select
                    value={section}
                    onChange={(e) => {
                      const next = [...sections];
                      next[i] = e.target.value;
                      setSections(next);
                    }}
                    className="text-[10px] font-mono border border-border bg-white px-2 py-1.5 text-text-primary"
                  >
                    {sectionTypes.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                  {sections.length > 1 && (
                    <button onClick={() => setSections(prev => prev.filter((_, j) => j !== i))} className="p-0.5 text-red-400 hover:text-red-500">
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setSections(prev => [...prev, 'verse'])}
                className="text-[10px] font-mono border border-dashed border-border px-2 py-1.5 text-text-secondary hover:text-accent-action hover:border-accent-action transition-colors"
              >
                + Add section
              </button>
            </div>
          </div>
          {regionError && (
            <div className="bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700 font-mono">
              {regionError}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary !px-4 !min-h-[36px] !text-[10px]">Cancel</button>
          <button onClick={handleGenerate} disabled={loading || !prompt.trim()} className="btn-primary !px-4 !min-h-[36px] !text-[10px] flex items-center gap-2">
            <Sparkles size={14} />
            {loading ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}
