'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { X, Disc, Send } from 'lucide-react';
import { Composition } from '@/types';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

interface Connection {
  other_user: {
    id: string;
    display_name: string;
    avatar_url?: string;
  };
}

interface Props {
  composition: Composition;
  onClose: () => void;
}

function buildSongContent(comp: Composition): string {
  const lines: string[] = [];
  lines.push(`🎵 ${comp.title}`);
  lines.push('');

  for (const item of comp.structure) {
    const label = item.section.charAt(0).toUpperCase() + item.section.slice(1);
    lines.push(`— ${label} —`);
    if (item.chords) lines.push(`♪ ${item.chords}`);
    if (item.content) lines.push(item.content);
    if (item.notes) lines.push(`📋 ${item.notes}`);
    lines.push('');
  }

  return lines.join('\n').trim();
}

export default function ShareToChatModal({ composition, onClose }: Props) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    api.get('/connections').then(res => {
      setConnections(res.data.connections);
    }).catch(() => {});
  }, []);

  const handleShare = async (receiverId: string) => {
    setSending(receiverId);
    const content = buildSongContent(composition);
    const socket = getSocket();

    try {
      await api.post('/messages', { receiverId, content });
      if (socket && user) {
        socket.emit('send_message', { senderId: user.id, receiverId, content });
      }

      const recordings = composition.structure.filter(s => s.recordingUrl);
      for (const item of recordings) {
        const label = item.section.charAt(0).toUpperCase() + item.section.slice(1);
        const audioContent = `🎵 ${composition.title} — ${label}`;
        await api.post('/messages', {
          receiverId,
          content: audioContent,
          attachmentUrl: item.recordingUrl,
          attachmentType: 'audio/mpeg',
          attachmentName: `${composition.title} - ${label}.mp3`,
        });
        if (socket && user) {
          socket.emit('send_message', { senderId: user.id, receiverId, content: audioContent });
        }
      }

      onClose();
      router.push(`/chat?user=${receiverId}`);
    } catch {
      showToast('Failed to share song in chat', 'error');
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center">
      <div className="bg-white border border-border w-full max-w-sm mx-4">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-heading font-bold text-sm">Share to Chat</h3>
            <p className="text-[10px] font-mono text-text-secondary mt-0.5 truncate max-w-[240px]">{composition.title}</p>
          </div>
          <button onClick={onClose} className="p-1 text-text-secondary hover:text-text-primary">
            <X size={18} />
          </button>
        </div>
        {connections.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-text-secondary text-xs font-mono">No Locos yet</p>
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            {connections.map(c => (
              <button
                key={c.other_user.id}
                onClick={() => handleShare(c.other_user.id)}
                disabled={sending !== null}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-background transition-colors text-left border-b border-border last:border-b-0 disabled:opacity-50"
              >
                <div className="w-9 h-9 rounded-full overflow-hidden border border-border bg-surface flex-shrink-0">
                  {c.other_user.avatar_url ? (
                    <Image src={c.other_user.avatar_url} alt={c.other_user.display_name} width={36} height={36} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-text-secondary">
                      <Disc size={16} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-heading font-bold text-sm truncate">{c.other_user.display_name}</p>
                </div>
                {sending === c.other_user.id ? (
                  <span className="text-[10px] font-mono text-accent-action">Sending...</span>
                ) : (
                  <Send size={14} className="text-text-secondary flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
