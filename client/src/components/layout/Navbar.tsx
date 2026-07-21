'use client';

import Link from 'next/link';
import Image from 'next/image';
import { LogOut, User, Search, Compass, Headphones, PlusCircle, MessageCircle, Music } from 'lucide-react';
import NotificationBell from './NotificationBell';
import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Button from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';

const MOBILE_TABS = [
  { href: '/discover', label: 'Discover', icon: Compass },
  { href: '/vibes', label: 'Vibes', icon: Headphones },
  { href: '/creator-hub', label: 'Create', icon: PlusCircle, isCreate: true },
  { href: '/chat', label: 'Chat', icon: MessageCircle, hasBadge: true },
  { href: '/profile', label: 'Profile', icon: User, isProfile: true },
];

export default function Navbar() {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const { user, logout, isLoading } = useAuth();
  const pathname = usePathname();
  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; display_name: string; avatar_url?: string }[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const searchTimer = useRef<NodeJS.Timeout | null>(null);
  const [chatUnread, setChatUnread] = useState(0);

  const fetchChatUnread = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get('/messages/conversations/list');
      const total = res.data.conversations.reduce((sum: number, c: { unreadCount?: number }) => sum + (c.unreadCount || 0), 0);
      setChatUnread(total);
    } catch { /* ignore */ }
  }, [user]);

  useEffect(() => { fetchChatUnread(); }, [fetchChatUnread, pathname]);

  useEffect(() => {
    const handler = () => fetchChatUnread();
    window.addEventListener('messages-read', handler);
    return () => window.removeEventListener('messages-read', handler);
  }, [fetchChatUnread]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = () => {
      if (pathname !== '/chat') {
        setChatUnread(prev => prev + 1);
      }
    };
    socket.on('receive_message', handler);
    return () => { socket.off('receive_message', handler); };
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!showSearch || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await api.get(`/users?search=${encodeURIComponent(searchQuery.trim())}`);
        setSearchResults(res.data.users || []);
      } catch {
        setSearchResults([]);
      }
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery, showSearch]);

  return (
    <>
      {/* Top Navbar */}
      <nav className="bg-white border-b border-border px-3 md:px-6 py-2.5 md:py-4 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-1.5 md:gap-2">
            <Image src="/logo.svg" alt="LocoVerse" width={40} height={40} className="w-7 h-7 md:w-10 md:h-10" />
            <span className="text-base md:text-xl font-heading font-bold">
              <span className="text-text-primary">Loco</span><span className="text-accent-action">Verse</span>
            </span>
          </Link>

          {/* Desktop */}
          <div className="hidden md:flex items-center gap-5">
            {!isLoading && (
              user ? (
                <>
                  <Link href="/discover" className={`font-mono text-xs uppercase tracking-[0.15em] transition-colors duration-200 pb-1 border-b-2 ${pathname === '/discover' ? 'text-accent-action font-semibold border-accent-action' : 'text-text-secondary border-transparent hover:text-accent-action'}`}>
                    Discover
                  </Link>
                  <Link href="/vibes" className={`font-mono text-xs uppercase tracking-[0.15em] transition-colors duration-200 pb-1 border-b-2 ${pathname === '/vibes' ? 'text-accent-action font-semibold border-accent-action' : 'text-text-secondary border-transparent hover:text-accent-action'}`}>
                    Vibes
                  </Link>
                  <Link href="/articles" className={`font-mono text-xs uppercase tracking-[0.15em] transition-colors duration-200 pb-1 border-b-2 ${pathname.startsWith('/articles') ? 'text-accent-action font-semibold border-accent-action' : 'text-text-secondary border-transparent hover:text-accent-action'}`}>
                    Articles
                  </Link>

                  {/* Search */}
                  <div className="relative" ref={searchRef}>
                    <button
                      onClick={() => setShowSearch(!showSearch)}
                      className="p-2 text-text-secondary hover:text-accent-action transition-colors"
                      title="Search users"
                    >
                      <Search size={16} />
                    </button>
                    {showSearch && (
                      <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-border shadow-lg">
                        <div className="p-2 border-b border-border">
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search users..."
                            className="w-full text-xs px-3 py-2 border border-border outline-none focus:border-accent-action transition-colors font-mono"
                            autoFocus
                          />
                        </div>
                        {searchResults.length > 0 ? (
                          <div className="max-h-64 overflow-y-auto">
                            {searchResults.map((u) => (
                              <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 border-b border-border last:border-b-0 hover:bg-surface-hover transition-colors">
                                <Link
                                  href={`/profile/${u.id}`}
                                  onClick={() => { setShowSearch(false); setSearchQuery(''); }}
                                  className="flex items-center gap-3 flex-1 min-w-0"
                                >
                                  <div className="w-7 h-7 rounded-full overflow-hidden border border-border bg-surface flex-shrink-0">
                                    {u.avatar_url ? (
                                      <Image src={u.avatar_url} alt={u.display_name} width={28} height={28} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-text-secondary text-[9px] font-mono font-bold">
                                        {(u.display_name?.charAt(0) ?? '?').toUpperCase()}
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-xs font-heading font-semibold truncate">{u.display_name}</span>
                                </Link>
                              </div>
                            ))}
                          </div>
                        ) : searchQuery.trim() ? (
                          <div className="px-3 py-6 text-center text-text-secondary text-xs font-mono">No users found</div>
                        ) : (
                          <div className="px-3 py-6 text-center text-text-secondary text-xs font-mono">Type to search</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Chat */}
                  <Link href="/chat" className="relative p-2 text-text-secondary hover:text-accent-action transition-colors">
                    <MessageCircle size={18} />
                    {chatUnread > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center bg-accent-warm text-white text-[8px] font-mono font-bold">
                        {chatUnread > 9 ? '9+' : chatUnread}
                      </span>
                    )}
                  </Link>

                  <NotificationBell />

                  {/* Profile */}
                  <div className="relative" ref={profileRef}>
                    <button
                      onClick={() => setShowProfileMenu(!showProfileMenu)}
                      className="flex flex-col items-center gap-0.5 ml-2 hover:opacity-80 transition-opacity"
                    >
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-border bg-surface flex-shrink-0">
                        {user.avatarUrl ? (
                          <Image src={user.avatarUrl} alt={user.displayName} width={32} height={32} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-text-secondary text-xs font-mono font-bold">
                            {(user.displayName?.charAt(0) ?? '?').toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] font-heading font-semibold text-text-primary max-w-[80px] truncate">{user.displayName ?? 'User'}</span>
                    </button>

                    {showProfileMenu && (
                      <div className="absolute right-0 top-full mt-2 w-44 bg-white border border-border shadow-lg z-50">
                        <Link
                          href="/profile"
                          onClick={() => setShowProfileMenu(false)}
                          className="flex items-center gap-2 px-4 py-2.5 text-xs font-heading font-semibold text-text-primary hover:bg-surface transition-colors"
                        >
                          <User size={14} />
                          Profile
                        </Link>
                        <Link
                          href="/creator-hub"
                          onClick={() => setShowProfileMenu(false)}
                          className="flex items-center gap-2 px-4 py-2.5 text-xs font-heading font-semibold text-text-primary hover:bg-surface transition-colors"
                        >
                          <Music size={14} />
                          Creator Hub
                        </Link>
                        <hr className="border-border" />
                        <button
                          onClick={() => { logout(); setShowProfileMenu(false); }}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-heading font-semibold text-text-secondary hover:bg-surface transition-colors"
                        >
                          <LogOut size={14} />
                          Sign Out
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Link href="/login" className="font-mono text-xs uppercase tracking-[0.15em] text-text-secondary hover:text-accent-action transition-colors duration-200">
                    Login
                  </Link>
                  <Link href="/register">
                    <Button variant="primary" size="sm">Sign Up</Button>
                  </Link>
                </>
              )
            )}
          </div>

          {/* Mobile: logo only (bottom bar handles the rest) */}
          <div className="md:hidden flex items-center gap-2">
            {user && <NotificationBell />}
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Tab Bar */}
      {user && !isLoading && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border safe-area-pb">
          <div className="flex items-center justify-around h-14">
            {MOBILE_TABS.map((tab) => {
              const isActive = tab.isProfile
                ? pathname === '/profile' || pathname.startsWith('/profile/')
                : tab.href === '/chat'
                  ? pathname === '/chat'
                  : pathname === tab.href || pathname.startsWith(tab.href + '/');
              const Icon = tab.icon;

              if (tab.isCreate) {
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className="flex flex-col items-center justify-center -mt-3"
                  >
                    <div className="w-11 h-11 rounded-full bg-accent-action flex items-center justify-center shadow-md">
                      <PlusCircle size={22} className="text-white" />
                    </div>
                    <span className="text-[9px] font-mono mt-0.5 text-text-secondary">{tab.label}</span>
                  </Link>
                );
              }

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className="flex flex-col items-center justify-center py-1 relative"
                >
                  <div className="relative">
                    <Icon
                      size={20}
                      className={isActive ? 'text-accent-action' : 'text-text-secondary'}
                      strokeWidth={isActive ? 2.5 : 1.8}
                    />
                    {tab.hasBadge && chatUnread > 0 && (
                      <span className="absolute -top-1.5 -right-2 w-4 h-4 flex items-center justify-center bg-accent-warm text-white text-[8px] font-mono font-bold rounded-full">
                        {chatUnread > 9 ? '9+' : chatUnread}
                      </span>
                    )}
                  </div>
                  <span className={`text-[9px] font-mono mt-0.5 ${isActive ? 'text-accent-action font-semibold' : 'text-text-secondary'}`}>
                    {tab.label}
                  </span>
                  {isActive && (
                    <div className="absolute -top-0.5 w-5 h-0.5 bg-accent-action rounded-full" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
