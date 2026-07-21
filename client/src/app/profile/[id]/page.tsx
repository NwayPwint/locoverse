'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { Music, UserPlus, Send, Check, Disc, Pencil, Megaphone, X, Shield, Flag, MoreVertical } from 'lucide-react';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { SharedSong, Post } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import PostCard from '@/components/feed/PostCard';
import PostItem from '@/components/feed/PostItem';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import ConfirmModal from '@/components/ui/ConfirmModal';
import SongwritingGuideModal from '@/components/workspace/SongwritingGuideModal';
import ReportModal from '@/components/ui/ReportModal';

const lookingForLabels: Record<string, string> = {
  band_members: 'Band Members',
  jam_partner: 'Jam Partner',
  feedback_buddy: 'Feedback Buddy',
  exploring: 'Just Exploring',
};

export default function UserProfilePage() {
  const params = useParams();
  const userId = params.id as string;
  const { user } = useAuth();

  const [profile, setProfile] = useState<{ id: string; display_name: string; avatar_url?: string; bio?: string; skills?: { id: number; name: string; category: string }[]; vibes?: { id: number; name: string }[]; looking_for?: string; song_count?: number; post_count?: number; created_at: string } | null>(null);
  const [songs, setSongs] = useState<SharedSong[]>([]);
  const [profilePosts, setProfilePosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [profileTab, setProfileTab] = useState<'songs' | 'posts'>('songs');
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const [connectionsData, setConnectionsData] = useState<{ id: string; other_user: { id: string } }[]>([]);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [removingLoco, setRemovingLoco] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showSongGuide, setShowSongGuide] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [requestSent, setRequestSent] = useState<string | null>(null);
  const [incomingRequest, setIncomingRequest] = useState<{ id: string } | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  const isOnline = onlineUsers.has(userId);

  const isOwn = user?.id === userId;

  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const [profileRes, songsRes, postsRes] = await Promise.all([
          api.get(`/users/${userId}`),
          api.get(`/shared-songs/user/${userId}`),
          api.get(`/posts/user/${userId}`),
        ]);
        setProfile(profileRes.data.user);
        setSongs(songsRes.data.sharedSongs);
        setProfilePosts(postsRes.data.posts);
      } catch (err) {
        console.error('Failed to load profile', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [userId]);

  useEffect(() => {
    if (!user) return;

    api
      .get('/shared-songs/liked')
      .then((r) => setLikedIds(new Set(r.data.likedSongIds)))
      .catch(() => {});

    api
      .get('/posts/liked')
      .then((r) => setLikedPostIds(new Set(r.data.likedPostIds)))
      .catch(() => {});

    api
      .get('/connections')
      .then((r) => {
        const conns = r.data.connections || [];
        const ids = conns.map((c: { other_user?: { id: string } }) => c.other_user?.id).filter(Boolean);
        setConnectedIds(new Set(ids));
        setConnectionsData(conns);
      })
      .catch(() => {});

    api
      .get(`/connections/status/${userId}`)
      .then((r) => {
        const { status, connectionId } = r.data;
        if (status === 'pending_incoming') {
          setIncomingRequest({ id: connectionId });
        } else if (status === 'pending_outgoing') {
          setRequestSent(connectionId);
        }
      })
      .catch(() => {});

    api
      .get('/blocks')
      .then((r) => setBlockedIds(new Set(r.data.blockedIds)))
      .catch(() => {});
  }, [user, userId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handleAccepted = (data: { requesterId: string; receiverId: string }) => {
      if (data.requesterId === userId || data.receiverId === userId) {
        setIncomingRequest(null);
        setRequestSent(null);
        setConnectedIds(prev => new Set([...Array.from(prev), userId]));
      }
    };
    const handleRejected = (data: { requesterId: string; receiverId: string }) => {
      if (data.requesterId === userId || data.receiverId === userId) {
        setIncomingRequest(null);
        setRequestSent(null);
      }
    };
    const handleRemoved = (data: { otherUserId: string }) => {
      if (data.otherUserId === user?.id) {
        setConnectedIds(prev => { const n = new Set(prev); n.delete(userId); return n; });
      }
    };
    socket.on('connection_accepted', handleAccepted);
    socket.on('request_rejected', handleRejected);
    socket.on('connection_removed', handleRemoved);
    return () => {
      socket.off('connection_accepted', handleAccepted);
      socket.off('request_rejected', handleRejected);
      socket.off('connection_removed', handleRemoved);
    };
  }, [user, userId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handleOnline = ({ userId: id }: { userId: string }) => {
      setOnlineUsers(prev => new Set([...Array.from(prev), id]));
    };
    const handleOffline = ({ userId: id }: { userId: string }) => {
      setOnlineUsers(prev => { const n = new Set(prev); n.delete(id); return n; });
    };
    socket.on('user_online', handleOnline);
    socket.on('user_offline', handleOffline);
    return () => {
      socket.off('user_online', handleOnline);
      socket.off('user_offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!showUserMenu) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-user-menu]')) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showUserMenu]);

  const sendConnect = async () => {
    if (!user) {
      window.location.href = '/login';
      return;
    }
    setConnectLoading(true);
    try {
      const res = await api.post('/connections', { receiverId: userId });
      setRequestSent(res.data.connection.id);
    } catch {
      // ignore
    } finally {
      setConnectLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!incomingRequest) return;
    try {
      await api.put(`/connections/${incomingRequest.id}/accept`);
      setIncomingRequest(null);
      setConnectedIds(prev => new Set([...Array.from(prev), userId]));
    } catch { /* ignore */ }
  };

  const handleReject = async () => {
    if (!incomingRequest) return;
    try {
      await api.put(`/connections/${incomingRequest.id}/reject`);
      setIncomingRequest(null);
    } catch { /* ignore */ }
  };

  const handleCancelRequest = async () => {
    if (!requestSent) return;
    try {
      await api.delete(`/connections/${requestSent}`);
      setRequestSent(null);
    } catch { /* ignore */ }
  };

  const isBlocked = blockedIds.has(userId);

  const handleBlock = async () => {
    setShowBlockConfirm(false);
    try {
      await api.post('/blocks', { blockedUserId: userId });
      setBlockedIds(prev => new Set([...Array.from(prev), userId]));
      setConnectedIds(prev => { const n = new Set(prev); n.delete(userId); return n; });
      setConnectionsData(prev => prev.filter(c => c.other_user?.id !== userId));
    } catch { /* ignore */ }
  };

  const handleUnblock = async () => {
    setShowBlockConfirm(false);
    try {
      await api.delete(`/blocks/${userId}`);
      setBlockedIds(prev => { const n = new Set(prev); n.delete(userId); return n; });
    } catch { /* ignore */ }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-text-secondary text-sm font-mono">Loading profile...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-secondary text-sm font-mono mb-4">User not found</p>
          <Link href="/discover" className="btn-primary text-xs !px-5 !py-2.5 !min-h-[36px]">
            Back to Discover
          </Link>
        </div>
      </div>
    );
  }

  const isConnected = connectedIds.has(userId);
  const connectionId = connectionsData.find((c) => c.other_user?.id === userId)?.id;
  const publicCount = songs.filter((s) => s.visibility === 'public').length;

  return (
    <div className="min-h-screen bg-background">
      <LoadingOverlay />
      {/* Facebook/Instagram style header */}
      <div className="bg-white border-b border-border">
        <div className="h-32 md:h-44 bg-gradient-to-r from-accent-action/30 via-accent-warm/20 to-purple-400/30" />
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12 sm:-mt-14 pb-6">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-4 border-white bg-surface flex-shrink-0 shadow-sm relative">
              {profile.avatar_url ? (
                <Image src={profile.avatar_url} alt={profile.display_name} width={112} height={112} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-text-secondary">
                  <Disc size={40} />
                </div>
              )}
              {isOnline && (
                <span className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full border-2 border-white bg-accent-success shadow-sm" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-heading font-extrabold flex items-center gap-2">
                {profile.display_name}
                <span className={`text-[10px] font-mono font-semibold ${isOnline ? 'text-accent-success' : 'text-text-secondary/50'}`}>
                  {isOnline ? '● Online' : '○ Offline'}
                </span>
              </h1>
              {profile.looking_for && (
                <p className="text-accent-action text-sm font-mono capitalize mt-0.5">
                  {lookingForLabels[profile.looking_for] || profile.looking_for.replace('_', ' ')}
                </p>
              )}
              <div className="flex items-center gap-4 mt-2 text-xs font-mono text-text-secondary">
                <span>{songs.length} songs</span>
                <span>{profilePosts.length} posts</span>
                <span>{publicCount} public</span>
              </div>
            </div>

            <div className="sm:pb-2">
              {isOwn ? (
                <Link href="/profile" className="btn-secondary flex items-center gap-2 !px-4 !min-h-[38px] !text-[11px]">
                  <Pencil size={14} />
                  Edit Profile
                </Link>
              ) : isConnected ? (
                <div className="flex items-center gap-2">
                  <Link href="/chat" className="btn-secondary flex items-center gap-2 !px-4 !min-h-[38px] !text-[11px]">
                    <Send size={14} />
                    Message
                  </Link>
                  <button
                    onClick={() => setShowRemoveConfirm(true)}
                    disabled={removingLoco || !connectionId}
                    className="text-red-500 hover:text-red-600 text-xs font-mono font-semibold hover:underline disabled:opacity-40 transition-colors"
                  >
                    {removingLoco ? 'Removing...' : 'Remove'}
                  </button>
                </div>
              ) : incomingRequest ? (
                <div className="flex items-center gap-2">
                  <button onClick={handleAccept} className="btn-primary flex items-center gap-1 !px-3 !min-h-[38px] !text-[11px]">
                    <Check size={14} />
                    Accept
                  </button>
                  <button onClick={handleReject} className="btn-secondary flex items-center gap-1 !px-3 !min-h-[38px] !text-[11px]">
                    <X size={14} />
                    Reject
                  </button>
                </div>
              ) : requestSent ? (
                <button
                  onClick={handleCancelRequest}
                  className="btn-secondary flex items-center gap-2 !px-4 !min-h-[38px] !text-[11px] hover:bg-red-50 hover:text-red-400 hover:border-red-200 transition-all group"
                >
                  <Check size={14} className="group-hover:hidden" />
                  <X size={14} className="hidden group-hover:inline" />
                  <span className="group-hover:hidden">Loco sent</span>
                  <span className="hidden group-hover:inline">Cancel</span>
                </button>
              ) : (
                <button
                  onClick={sendConnect}
                  disabled={connectLoading}
                  className="btn-primary flex items-center gap-2 !px-4 !min-h-[38px] !text-[11px] disabled:opacity-50"
                >
                  <UserPlus size={14} />
                  {connectLoading ? 'Sending...' : 'Loco'}
                </button>
              )}

              {!isOwn && (
                <div className="relative" data-user-menu>
                  <button
                    onClick={() => setShowUserMenu((v) => !v)}
                    className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface transition-colors rounded-md"
                    title="More options"
                  >
                    <MoreVertical size={18} />
                  </button>
                  {showUserMenu && (
                    <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-border shadow-lg z-20 py-1">
                      <button
                        onClick={() => { setShowUserMenu(false); setShowReport(true); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-mono text-text-primary hover:bg-background transition-colors text-left"
                      >
                        <Flag size={14} className="text-red-400" />
                        Report user
                      </button>
                      <button
                        onClick={() => { setShowUserMenu(false); setShowBlockConfirm(true); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-mono text-text-primary hover:bg-background transition-colors text-left"
                      >
                        <Shield size={14} className={isBlocked ? 'text-accent-success' : 'text-text-secondary'} />
                        {isBlocked ? 'Unblock user' : 'Block user'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {profile.bio && (
            <p className="text-sm text-text-primary pb-6 max-w-2xl">{profile.bio}</p>
          )}

          {(profile.skills && profile.skills.length > 0 || profile.vibes && profile.vibes.length > 0) && (
            <div className="flex flex-wrap gap-2 pb-6">
              {profile.skills?.map((s: { id: number; name: string }) => (
                <span key={`sk-${s.id}`} className="tag text-[10px] py-1 px-2">{s.name}</span>
              ))}
              {profile.vibes?.map((v: { id: number; name: string }) => (
                <span key={`vb-${v.id}`} className="tag-accent text-[10px] py-1 px-2">{v.name}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Posts */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-10">
        <div className="flex items-center gap-4 mb-5">
          <button
            onClick={() => setProfileTab('songs')}
            className={`flex items-center gap-2 font-heading font-bold text-sm uppercase tracking-[0.15em] transition-colors ${
              profileTab === 'songs' ? 'text-accent-action' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Music size={16} />
            Songs
          </button>
          <button
            onClick={() => setProfileTab('posts')}
            className={`flex items-center gap-2 font-heading font-bold text-sm uppercase tracking-[0.15em] transition-colors ${
              profileTab === 'posts' ? 'text-accent-action' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Megaphone size={16} />
            Posts
          </button>
          <button
            onClick={() => setShowSongGuide(true)}
            className="ml-auto w-6 h-6 rounded-full border border-border text-text-secondary hover:text-text-primary hover:border-text-primary text-xs font-mono font-bold flex items-center justify-center transition-colors"
            title="How to use songwriting tools"
          >
            ?
          </button>
        </div>

        {profileTab === 'songs' ? (
          songs.length === 0 ? (
            <div className="bg-white border border-border p-8 text-center text-text-secondary text-sm">
              No posts to show.
            </div>
          ) : (
            <div className="space-y-6">
              {songs.map((song) => (
                <PostCard
                  key={song.id}
                  song={song}
                  isLiked={likedIds.has(song.id)}
                  connectedIds={connectedIds}
                />
              ))}
            </div>
          )
        ) : profilePosts.length === 0 ? (
          <div className="bg-white border border-border p-8 text-center text-text-secondary text-sm">
            No community posts yet.
          </div>
        ) : (
          <div className="space-y-6">
            {profilePosts.map((p) => (
              <PostItem
                key={p.id}
                post={p}
                isLiked={likedPostIds.has(p.id)}
                connectedIds={connectedIds}
                onDelete={isOwn ? (id) => setProfilePosts((prev) => prev.filter((x) => x.id !== id)) : undefined}
              />
            ))}
          </div>
        )}
      </div>
      {showSongGuide && <SongwritingGuideModal onClose={() => setShowSongGuide(false)} />}
      <ConfirmModal
        isOpen={showRemoveConfirm}
        title="Remove Loco?"
        message="Are you sure you want to remove this Loco? They will no longer be in your connections list."
        confirmLabel="Remove"
        variant="danger"
        onConfirm={async () => {
          setShowRemoveConfirm(false);
          setRemovingLoco(true);
          try {
            await api.delete(`/connections/${connectionId}`);
            setConnectedIds(prev => { const n = new Set(prev); n.delete(userId); return n; });
            setConnectionsData(prev => prev.filter(c => c.id !== connectionId));
          } catch { /* ignore */ } finally {
            setRemovingLoco(false);
          }
        }}
        onCancel={() => setShowRemoveConfirm(false)}
      />
      <ConfirmModal
        isOpen={showBlockConfirm}
        title={isBlocked ? 'Unblock user?' : 'Block user?'}
        message={isBlocked
          ? `Unblock ${profile?.display_name}? You will be able to see their profile and interact again.`
          : `Block ${profile?.display_name}? They will no longer be able to message you or see your profile, and your connection will be removed.`}
        confirmLabel={isBlocked ? 'Unblock' : 'Block'}
        variant="danger"
        onConfirm={isBlocked ? handleUnblock : handleBlock}
        onCancel={() => setShowBlockConfirm(false)}
      />
      {showReport && (
        <ReportModal
          targetType="user"
          targetId={userId}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}
