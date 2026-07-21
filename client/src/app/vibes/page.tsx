'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Music } from 'lucide-react';
import { getSocket } from '@/lib/socket';
import api from '@/lib/api';
import { SharedSong, Post } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import PostCard from '@/components/feed/PostCard';
import PostItem from '@/components/feed/PostItem';
import LoadingOverlay from '@/components/ui/LoadingOverlay';

type FeedItem =
  | { kind: 'song'; createdAt: string; data: SharedSong }
  | { kind: 'post'; createdAt: string; data: Post };

const PAGE_SIZE = 20;

export default function FeedPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [songs, setSongs] = useState<SharedSong[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [songPage, setSongPage] = useState(1);
  const [postPage, setPostPage] = useState(1);
  const [hasMoreSongs, setHasMoreSongs] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(false);

  const [likedSongIds, setLikedSongIds] = useState<Set<string>>(new Set());
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());

  const fetchPage = useCallback(async (sPage: number, pPage: number, append: boolean) => {
    if (append) setIsLoadingMore(true);
    else setIsLoading(true);
    try {
      const [songsRes, postsRes] = await Promise.all([
        api.get(`/shared-songs?page=${sPage}&limit=${PAGE_SIZE}`),
        api.get(`/posts?page=${pPage}&limit=${PAGE_SIZE}`),
      ]);
      setSongs(prev => append ? [...prev, ...songsRes.data.sharedSongs] : songsRes.data.sharedSongs);
      setPosts(prev => append ? [...prev, ...postsRes.data.posts] : postsRes.data.posts);
      setHasMoreSongs(songsRes.data.hasMore ?? false);
      setHasMorePosts(postsRes.data.hasMore ?? false);
      setSongPage(sPage);
      setPostPage(pPage);
    } catch {
      showToast('Failed to load feed', 'error');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchPage(1, 1, false);
  }, [fetchPage]);

  useEffect(() => {
    if (!user) return;

    api
      .get('/shared-songs/liked')
      .then((r) => setLikedSongIds(new Set(r.data.likedSongIds)))
      .catch(() => {});

    api
      .get('/posts/liked')
      .then((r) => setLikedPostIds(new Set(r.data.likedPostIds)))
      .catch(() => {});

    api
      .get('/connections')
      .then((r) => {
        const ids = (r.data.connections || [])
          .map((c: { other_user?: { id: string } }) => c.other_user?.id)
          .filter(Boolean);
        setConnectedIds(new Set(ids));
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handler = (data: { songId: string; userId: string; liked: boolean; count: number }) => {
      if (data.userId !== user?.id) {
        setSongs(prev => prev.map(s =>
          s.id === data.songId ? { ...s, likeCount: data.count } : s
        ));
      }
    };
    socket.on('song_like_toggled', handler);
    return () => { socket.off('song_like_toggled', handler); };
  }, [user]);

  const items: FeedItem[] = useMemo(() => {
    const merged: FeedItem[] = [
      ...songs.map((s) => ({ kind: 'song' as const, createdAt: s.created_at, data: s })),
      ...posts.map((p) => ({ kind: 'post' as const, createdAt: p.created_at, data: p })),
    ];
    merged.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return merged;
  }, [songs, posts]);

  const hasMore = hasMoreSongs || hasMorePosts;

  return (
    <div className="min-h-screen bg-background">
      <LoadingOverlay show={isLoading} />
      <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-10">
        <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <Music size={18} className="text-accent-action" />
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-heading font-bold">Vibes</h1>
              <p className="text-xs sm:text-sm text-text-secondary">Browse songs and posts from other creators.</p>
            </div>
          </div>
        </div>

        {items.length === 0 && !isLoading ? (
          <div className="p-8 text-center text-text-secondary">Nothing shared yet.</div>
        ) : (
          <div className="space-y-6">
            {items.map((item) =>
              item.kind === 'song' ? (
                <PostCard
                  key={`song-${item.data.id}`}
                  song={item.data}
                  isLiked={likedSongIds.has(item.data.id)}
                  connectedIds={connectedIds}
                />
              ) : (
                <PostItem
                  key={`post-${item.data.id}`}
                  post={item.data}
                  isLiked={likedPostIds.has(item.data.id)}
                  connectedIds={connectedIds}
                />
              )
            )}
            {hasMore && (
              <div className="text-center pt-2">
                <button
                  onClick={() => fetchPage(songPage + 1, postPage + 1, true)}
                  disabled={isLoadingMore}
                  className="btn-secondary !px-6 !min-h-[40px] text-xs"
                >
                  {isLoadingMore ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
