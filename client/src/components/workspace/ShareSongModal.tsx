'use client';

import { useState, useCallback } from 'react';
import { X, Share2, Copy, Check } from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { SharedSong, Composition } from '@/types';
import { generateShareImage } from '@/lib/generateShareImage';
import ShareImagePreview from './ShareImagePreview';

interface ShareSongModalProps {
  composition?: Composition | null;
  onClose: () => void;
  onShared: (sharedSong: SharedSong) => void;
}

export default function ShareSongModal({ composition, onClose, onShared }: ShareSongModalProps) {
  const { showToast } = useToast();
  const [title, setTitle] = useState(composition?.title || 'Untitled');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'connections-only'>('public');
  const [shareScope, setShareScope] = useState<'whole' | 'section'>('whole');
  const [sectionIndex, setSectionIndex] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [sharedSong, setSharedSong] = useState<SharedSong | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  const allChords = composition?.structure
    ?.flatMap((s) => (s.chords || '').split(/\s+/).filter(Boolean))
    ?.filter((v, i, a) => a.indexOf(v) === i) || [];

  const firstLyrics = composition?.structure?.find((s) => s.content)?.content || composition?.lyrics || '';

  const doGenerateImage = useCallback(async (authorName: string) => {
    setGeneratingImage(true);
    try {
      const blob = await generateShareImage(title, authorName, firstLyrics, allChords);
      setImageBlob(blob);
      return blob;
    } catch (err) {
      console.error('Image generation failed:', err);
      showToast('Image generation failed', 'error');
      return null;
    } finally {
      setGeneratingImage(false);
    }
  }, [title, firstLyrics, allChords]);

  const uploadImage = async (blob: Blob): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'share_image.png');
      const res = await api.post('/compositions/upload-audio', formData);
      return res.data.url;
    } catch {
      return null;
    }
  };

  const handleShare = async () => {
    if (!composition) return;
    setLoading(true);
    setError('');

    try {
      const res = await api.post('/shared-songs', {
        compositionId: composition.id,
        title,
        description,
        visibility,
        shareScope,
        sectionIndex: shareScope === 'section' ? sectionIndex : null,
      });
      const song: SharedSong = res.data.sharedSong;

      const userRes = await api.get('/users/me');
      const authorName = userRes.data.user?.displayName || 'Artist';

      const blob = await doGenerateImage(authorName);
      if (blob) {
        const imageUrl = await uploadImage(blob);
        if (imageUrl) {
          await api.put(`/shared-songs/${song.id}`, { shareImageUrl: imageUrl });
          song.shareImageUrl = imageUrl;
          setImageBlob(blob);
        }
      }

      setSharedSong(song);
      onShared(song);
    } catch (err) {
      console.error('Failed to share song', err);
      setError('Unable to share song. Please try again.');
      showToast('Failed to share song', 'error');
    } finally {
      setLoading(false);
    }
  };

  const songUrl = sharedSong ? `${typeof window !== 'undefined' ? window.location.origin : ''}/shared-songs/${sharedSong.id}` : '';
  const embedCode = sharedSong ? `<iframe src="${typeof window !== 'undefined' ? window.location.origin : ''}/embed/song/${sharedSong.id}" width="400" height="500" frameborder="0" style="border:none;"></iframe>` : '';

  const handleCopyEmbed = async () => {
    await navigator.clipboard.writeText(embedCode);
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 2000);
  };

  if (sharedSong) {
    return (
      <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center">
        <div className="bg-white border border-border w-full max-w-lg mx-4">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Share2 size={18} className="text-accent-action" />
              <h2 className="text-sm font-heading font-bold uppercase tracking-[0.15em]">Song Shared!</h2>
            </div>
            <button onClick={onClose} className="p-1 text-text-secondary hover:text-text-primary">
              <X size={18} />
            </button>
          </div>
          <div className="p-6 space-y-4">
            <ShareImagePreview
              imageUrl={sharedSong.shareImageUrl || null}
              imageBlob={imageBlob}
              songTitle={title}
              songUrl={songUrl}
              generating={generatingImage}
            />
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-1.5">Embed Code</label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={embedCode}
                  className="flex-1 text-[9px] font-mono border border-border bg-background px-2 py-1.5 text-text-secondary outline-none"
                />
                <button onClick={handleCopyEmbed} className="btn-secondary !px-2 !min-h-[28px] !text-[9px] flex items-center gap-1">
                  {copiedEmbed ? <Check size={10} /> : <Copy size={10} />}
                  {copiedEmbed ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-border flex justify-end">
            <button onClick={onClose} className="btn-primary !px-4 !min-h-[36px] !text-[10px]">Done</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center">
      <div className="bg-white border border-border w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Share2 size={18} className="text-accent-action" />
            <h2 className="text-sm font-heading font-bold uppercase tracking-[0.15em]">Share Your Song</h2>
          </div>
          <button onClick={onClose} className="p-1 text-text-secondary hover:text-text-primary">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-1.5">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-field text-sm py-3 w-full"
              placeholder="Song title"
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-field resize-none text-sm py-3 w-full"
              rows={3}
              placeholder="Describe the mood, inspiration, or what makes this song special."
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-1.5">Share</label>
            <select
              value={shareScope}
              onChange={(e) => setShareScope(e.target.value as 'whole' | 'section')}
              className="input-field text-sm py-3 w-full"
            >
              <option value="whole">Whole song</option>
              <option value="section">One section</option>
            </select>
          </div>
          {shareScope === 'section' && composition?.structure && composition.structure.length > 0 && (
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-1.5">Section</label>
              <select
                value={sectionIndex}
                onChange={(e) => setSectionIndex(Number(e.target.value))}
                className="input-field text-sm py-3 w-full"
              >
                {composition.structure.map((block, idx) => (
                  <option key={idx} value={idx}>
                    {block.section} {block.index + 1}{block.recordingUrl ? ' - audio' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-1.5">Visibility</label>
            <select value={visibility} onChange={(e) => setVisibility(e.target.value as 'public' | 'connections-only')} className="input-field text-sm py-3 w-full">
              <option value="public">Public</option>
              <option value="connections-only">Locos only</option>
            </select>
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700 font-mono">
              {error}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary !px-4 !min-h-[36px] !text-[10px]">Cancel</button>
          <button onClick={handleShare} disabled={loading} className="btn-primary !px-4 !min-h-[36px] !text-[10px] flex items-center gap-2">
            {loading ? 'Sharing...' : 'Share Song'}
          </button>
        </div>
      </div>
    </div>
  );
}
