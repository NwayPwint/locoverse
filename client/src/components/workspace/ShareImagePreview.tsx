'use client';

import { useState, useEffect } from 'react';
import { Download, Share2, Loader2, Copy, Check } from 'lucide-react';

interface ShareImagePreviewProps {
  imageUrl: string | null;
  imageBlob: Blob | null;
  songTitle: string;
  songUrl: string;
  generating: boolean;
}

export default function ShareImagePreview({ imageUrl, imageBlob, songTitle, songUrl, generating }: ShareImagePreviewProps) {
  const [preview, setPreview] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (imageUrl) {
      setPreview(imageUrl);
    } else if (imageBlob) {
      const url = URL.createObjectURL(imageBlob);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [imageUrl, imageBlob]);

  const handleDownload = async () => {
    if (!preview) return;
    const filename = `${songTitle.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'song'}_share.png`;
    try {
      const response = await fetch(preview);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      const a = document.createElement('a');
      a.href = preview;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleTwitter = () => {
    const text = encodeURIComponent(`Check out "${songTitle}" on LocoVerse! 🎵`);
    const url = encodeURIComponent(songUrl);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(songUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (generating) {
    return (
      <div className="bg-background border border-border p-6 text-center">
        <Loader2 size={24} className="animate-spin text-accent-action mx-auto mb-2" />
        <p className="text-xs font-mono text-text-secondary">Generating share image...</p>
      </div>
    );
  }

  if (!preview) return null;

  return (
    <div className="space-y-3">
      <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary">Share Preview</label>
      <div className="border border-border overflow-hidden">
        <img src={preview} alt="Share preview" className="w-full h-auto" />
      </div>
      <div className="flex gap-2">
        <button onClick={handleTwitter} className="btn-secondary !px-3 !min-h-[32px] !text-[9px] flex items-center gap-1.5 flex-1 justify-center">
          <Share2 size={12} />
          Tweet
        </button>
        <button onClick={handleDownload} className="btn-secondary !px-3 !min-h-[32px] !text-[9px] flex items-center gap-1.5 flex-1 justify-center">
          <Download size={12} />
          Save
        </button>
        <button onClick={handleCopyLink} className="btn-secondary !px-3 !min-h-[32px] !text-[9px] flex items-center gap-1.5 flex-1 justify-center">
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Link'}
        </button>
      </div>
    </div>
  );
}
