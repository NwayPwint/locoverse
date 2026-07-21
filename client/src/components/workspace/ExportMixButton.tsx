'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { mixRecordings, triggerDownload } from '@/lib/mixExport';
import { CompositionStructureItem } from '@/types';

interface ExportMixButtonProps {
  structure: CompositionStructureItem[];
  title: string;
}

export default function ExportMixButton({ structure, title }: ExportMixButtonProps) {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState('');

  const recordings = structure
    .filter((item) => item.recordingUrl)
    .map((item) => ({
      url: item.recordingUrl!,
      section: item.section,
      index: item.index,
    }));

  const hasRecordings = recordings.length > 0;

  const handleExport = async () => {
    if (!hasRecordings || exporting) return;
    setExporting(true);
    setProgress('');
    try {
      const blob = await mixRecordings(recordings, (current, total) => {
        setProgress(`${current}/${total}`);
      });
      const safeName = title.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'song';
      triggerDownload(blob, `${safeName}_mix.wav`);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
      setProgress('');
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={!hasRecordings || exporting}
      className="btn-secondary !px-2 sm:!px-3 !min-h-[32px] !text-[9px] flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
      title={!hasRecordings ? 'No recordings to export' : 'Export mix as WAV'}
    >
      {exporting ? (
        <Loader2 size={12} className="animate-spin" />
      ) : (
        <Download size={12} />
      )}
      <span className="hidden sm:inline">{exporting ? progress || 'Mixing...' : 'Export Mix'}</span>
    </button>
  );
}
