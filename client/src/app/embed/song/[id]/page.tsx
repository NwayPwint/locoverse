'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Heart, MessageCircle } from 'lucide-react';
import api from '@/lib/api';
import { SharedSong } from '@/types';
import { sectionBorder } from '@/lib/sectionBorder';
import Link from 'next/link';

export default function EmbedSongPage() {
  const { id } = useParams() as { id: string };
  const [song, setSong] = useState<SharedSong | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api
      .get(`/shared-songs/${id}`)
      .then((r) => setSong(r.data.sharedSong))
      .catch(() => setNotFound(true));
  }, [id]);

  if (notFound || !song) {
    return <div className="p-4 text-center text-xs text-text-secondary">Song not available.</div>;
  }

  const isSection =
    song.shareScope === 'section' &&
    typeof song.sectionIndex === 'number' &&
    !!song.structure[song.sectionIndex];
  const topAudio = isSection ? null : song.audio_url;
  const anySectionAudio = song.structure.some((b) => b.recordingUrl);
  const sectionIdx = isSection ? (song.sectionIndex as number) : null;

  const renderSection = (block: { section: string; index: number; content: string; chords?: string; notes?: string; recordingUrl?: string }, key: string | number) => (
    <div key={key} className={`border-l-4 ${sectionBorder[block.section] || 'border-l-border'} pl-4 py-3`}>
      <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary mb-1">
        {block.section} {block.index + 1}
      </p>
      <p className="whitespace-pre-wrap text-sm text-text-primary">{block.content || 'No content'}</p>
      {block.chords && <p className="text-[10px] font-mono text-text-secondary mt-1">Chords: {block.chords}</p>}
      {block.notes && (
        <p className="text-[11px] italic text-text-secondary mt-1 border-l-2 border-border pl-2">Notes: {block.notes}</p>
      )}
      {block.recordingUrl && (
        <audio controls className="w-full mt-2">
          <source src={block.recordingUrl} />
        </audio>
      )}
    </div>
  );

  return (
    <div className="bg-white text-text-primary" style={{ fontFamily: 'inherit' }}>
      <div className="border border-border">
        <div className="flex items-start justify-between gap-3 p-4 border-b border-border">
          <div className="min-w-0">
            <h2 className="text-base font-heading font-bold leading-tight truncate">{song.title}</h2>
            <p className="text-[11px] font-mono uppercase tracking-[0.12em] text-text-secondary">
              by {song.author.displayName}
            </p>
          </div>
          <Link
            href={`/shared-songs/${song.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-mono uppercase tracking-[0.12em] text-accent-action hover:underline shrink-0"
          >
            Open ↗
          </Link>
        </div>

        <div className="p-4 space-y-3">
          {song.description && <p className="text-sm text-text-primary">{song.description}</p>}

          {topAudio && (
            <audio controls className="w-full">
              <source src={topAudio} />
            </audio>
          )}

          {!topAudio && !anySectionAudio && (
            <p className="text-[11px] font-mono text-text-secondary/60 italic">No audio attached.</p>
          )}

          {isSection ? (
            renderSection(song.structure[sectionIdx as number], 'section')
          ) : (
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary mb-2">Song Structure</p>
              <div className="space-y-3">
                {song.structure.length === 0 ? (
                  <p className="text-xs text-text-secondary">No structured sections</p>
                ) : (
                  song.structure.map((block, idx) => renderSection(block, idx))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-border flex items-center gap-4 text-text-secondary">
          <span className="flex items-center gap-1.5 text-sm">
            <Heart size={14} />
            {song.likeCount ?? 0}
          </span>
          <span className="flex items-center gap-1.5 text-sm">
            <MessageCircle size={14} />
            {song.commentCount ?? 0}
          </span>
          <span className="ml-auto text-[10px] font-mono">LocoVerse</span>
        </div>
      </div>
    </div>
  );
}