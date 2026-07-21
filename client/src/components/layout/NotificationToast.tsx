'use client';

import { useEffect, useState, useRef } from 'react';
import { Bell, X } from 'lucide-react';
import { getSocket } from '@/lib/socket';

interface Toast {
  id: string;
  message: string;
}

export default function NotificationToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const cleanupRef = useRef<(() => void) | null>(null);

  const attachListener = () => {
    const socket = getSocket();
    if (!socket) return false;

    cleanupRef.current?.();
    cleanupRef.current = null;

    const handler = (data: { id: string; type: string; actorName: string; entityTitle: string }) => {
      let message = '';
      if (data.type === 'song_shared') message = `${data.actorName} shared a song: ${data.entityTitle}`;
      else if (data.type === 'post_created') message = `${data.actorName} posted: ${data.entityTitle}`;
      else if (data.type === 'post_liked') message = `${data.actorName} liked your post: ${data.entityTitle}`;
      else if (data.type === 'song_liked') message = `${data.actorName} liked your song: ${data.entityTitle}`;

      else message = 'New notification';

      const toast: Toast = { id: data.id, message };
      setToasts(prev => [...prev.slice(-4), toast]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, 5000);
    };

    socket.on('new_notification', handler);
    cleanupRef.current = () => { socket.off('new_notification', handler); };
    return true;
  };

  useEffect(() => {
    if (attachListener()) return;

    const interval = setInterval(() => {
      attachListener();
    }, 500);

    return () => {
      clearInterval(interval);
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="bg-white border border-border shadow-lg px-4 py-3 flex items-center gap-3 animate-[slideIn_0.2s_ease-out] pointer-events-auto max-w-xs"
        >
          <Bell size={14} className="text-accent-action flex-shrink-0" />
          <p className="text-xs font-mono text-text-primary flex-1 truncate">{toast.message}</p>
          <button
            onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
            className="p-0.5 text-text-secondary/40 hover:text-text-secondary"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
