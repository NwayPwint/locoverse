'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell } from 'lucide-react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getSocket } from '@/lib/socket';
import api from '@/lib/api';

interface Notification {
  id: string;
  type: string;
  actor_name: string;
  actor_avatar?: string;
  entity_type: string;
  entity_id: string;
  read: boolean;
  created_at: string;
}

export default function NotificationBell({ onNotificationsRead }: { onNotificationsRead?: () => void }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchUnread = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get('/notifications/unread-count');
      setUnreadCount(res.data.count);
    } catch { /* ignore */ }
  }, [user]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications);
    } catch { /* ignore */ }
  }, [user]);

  useEffect(() => { fetchUnread(); }, [fetchUnread, pathname]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewNotification = (data: { id: string; type: string; actorName: string; actorAvatar?: string; entityTitle: string; createdAt?: string }) => {
      setUnreadCount(prev => prev + 1);
      setNotifications(prev => [{
        id: data.id,
        type: data.type,
        actor_name: data.actorName,
        actor_avatar: data.actorAvatar,
        entity_type: data.type === 'song_shared' || data.type === 'song_liked' ? 'shared_song' : data.type === 'loco_accepted' || data.type === 'loco_request' ? 'connection' : 'post',
        entity_id: '',
        read: false,
        created_at: data.createdAt || new Date().toISOString(),
      }, ...prev]);
    };

    const handleConnectionEvent = () => fetchUnread();
    socket.on('new_notification', handleNewNotification);
    socket.on('connection_accepted', handleConnectionEvent);
    socket.on('request_rejected', handleConnectionEvent);
    return () => {
      socket.off('new_notification', handleNewNotification);
      socket.off('connection_accepted', handleConnectionEvent);
      socket.off('request_rejected', handleConnectionEvent);
    };
  }, [fetchUnread]);

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpen = async () => {
    setOpen(!open);
    if (!open && unreadCount > 0) {
      try {
        await api.put('/notifications/read');
        setUnreadCount(0);
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        onNotificationsRead?.();
      } catch { /* ignore */ }
    }
  };

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
  };

  const getNotificationText = (n: Notification) => {
    if (n.type === 'song_shared') return 'shared a song on Vibes';
    if (n.type === 'song_liked') return 'liked your song';
    if (n.type === 'post_created') return 'posted on Vibes';
    if (n.type === 'post_liked') return 'liked your post';
    if (n.type === 'song_commented') return 'commented on your song';
    if (n.type === 'post_commented') return 'commented on your post';
    if (n.type === 'article_liked') return 'liked your article';
    if (n.type === 'article_commented') return 'commented on your article';
    if (n.type === 'loco_accepted') return 'accepted your Loco request';
    if (n.type === 'loco_request') return 'sent you a Loco request';

    return 'did something';
  };

  const getNotificationLink = (n: Notification) => {
    if (n.entity_type === 'shared_song') return '/vibes';
    if (n.entity_type === 'post') return '/vibes';
    if (n.entity_type === 'article') return '/articles';
    if (n.entity_type === 'connection') return '/discover';
    return '/vibes';
  };

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative p-2 text-text-secondary hover:text-accent-action transition-colors"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center bg-accent-action text-white text-[8px] font-mono font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-border shadow-lg z-50">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <p className="text-xs font-heading font-bold uppercase tracking-[0.15em]">Notifications</p>
            {unreadCount > 0 && (
              <button
                onClick={async () => {
                  await api.put('/notifications/read');
                  setUnreadCount(0);
                  setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                  onNotificationsRead?.();
                }}
                className="text-[10px] font-mono text-accent-action hover:text-accent-action/80"
              >
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell size={24} className="mx-auto text-text-secondary/20 mb-2" />
              <p className="text-text-secondary text-xs font-mono">No notifications yet</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {notifications.map(n => (
                <a
                  key={n.id}
                  href={getNotificationLink(n)}
                  onClick={() => setOpen(false)}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-border last:border-b-0 transition-colors hover:bg-surface-hover ${
                    !n.read ? 'bg-accent-action/5' : ''
                  }`}
                >
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-border bg-surface flex-shrink-0">
                    {n.actor_avatar ? (
                      <Image src={n.actor_avatar} alt={n.actor_name} width={32} height={32} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-text-secondary text-xs font-mono">
                        {n.actor_name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-relaxed">
                      <span className="font-heading font-bold">{n.actor_name}</span>{' '}
                      <span className="text-text-secondary">{getNotificationText(n)}</span>
                    </p>
                    <p className="text-[10px] font-mono text-text-secondary/50 mt-0.5">{formatTime(n.created_at)}</p>
                  </div>
                  {!n.read && (
                    <span className="w-2 h-2 bg-accent-action rounded-full flex-shrink-0 mt-1.5" />
                  )}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
