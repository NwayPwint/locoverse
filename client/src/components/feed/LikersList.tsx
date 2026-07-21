'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Heart } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import api from '@/lib/api';
import type { Liker } from '@/types';

interface LikersListProps {
  entityId: string;
  entityType: 'shared_song' | 'post';
  count: number;
  trigger: React.ReactNode;
}

export default function LikersList({ entityId, entityType, count, trigger }: LikersListProps) {
  const [open, setOpen] = useState(false);
  const [likers, setLikers] = useState<Liker[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const endpoint = entityType === 'shared_song' ? `/shared-songs/${entityId}/likes` : `/posts/${entityId}/likes`;
    api.get(endpoint).then((res) => {
      setLikers(res.data.likers);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [open, entityId, entityType]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative inline-flex">
      <button onClick={() => setOpen(!open)} className="focus:outline-none">
        {trigger}
      </button>
      {open && (
        <div ref={ref} className="absolute bottom-full left-0 mb-2 w-64 bg-white border border-border shadow-lg z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Heart size={12} className="text-accent-warm" />
              <span className="text-[9px] font-mono uppercase tracking-wider text-text-secondary">{count} {count === 1 ? 'like' : 'likes'}</span>
            </div>
            <button onClick={() => setOpen(false)} className="p-0.5 text-text-secondary/40 hover:text-text-secondary">
              <X size={12} />
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-4 text-center text-[10px] font-mono text-text-secondary/50">Loading...</div>
            ) : likers.length === 0 ? (
              <div className="px-3 py-4 text-center text-[10px] font-mono text-text-secondary/50">No likes yet</div>
            ) : (
              likers.map((liker) => (
                <Link
                  key={liker.id}
                  href={`/profile/${liker.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 hover:bg-surface-hover transition-colors border-b border-border last:border-b-0"
                >
                  <div className="w-7 h-7 rounded-full overflow-hidden border border-border bg-surface flex-shrink-0">
                    {liker.avatar_url ? (
                      <Image src={liker.avatar_url} alt={liker.display_name} width={28} height={28} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-text-secondary text-[10px] font-mono">
                        {liker.display_name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-text-primary truncate">{liker.display_name}</span>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
