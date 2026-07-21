'use client';

import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getSocket } from '@/lib/socket';
import api from '@/lib/api';

export default function FloatingChatButton() {
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuth();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);

  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

  const fetchUnread = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get('/messages/conversations/list');
      const total = res.data.conversations.reduce((sum: number, c: { unreadCount?: number }) => sum + (c.unreadCount || 0), 0);
      setUnreadCount(total);
    } catch { /* ignore */ }
  }, [user]);

  useEffect(() => { fetchUnread(); }, [fetchUnread, pathname]);

  useEffect(() => {
    const handler = () => fetchUnread();
    window.addEventListener('messages-read', handler);
    return () => window.removeEventListener('messages-read', handler);
  }, [fetchUnread]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = () => {
      if (pathnameRef.current !== '/chat') {
        setUnreadCount(prev => prev + 1);
      }
    };
    socket.on('receive_message', handler);
    return () => { socket.off('receive_message', handler); };
  }, []);

  if (!user) return null;

  return (
    <Link
      href="/chat"
      className="hidden fixed bottom-6 right-6 z-50 w-14 h-14 items-center justify-center bg-accent-action text-white rounded-full shadow-lg hover:bg-accent-action/90 transition-all duration-200"
      title="Chat"
    >
      <MessageCircle size={22} />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center bg-accent-warm text-white text-[9px] font-mono font-bold rounded-full">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  );
}