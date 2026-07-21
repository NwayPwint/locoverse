'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Heart, MessageCircle, Trash2, Music, ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import api from '@/lib/api';
import { SharedSong, SongComment } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { timeAgo } from '@/lib/utils';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import LikersList from '@/components/feed/LikersList';
import { chordColor } from '@/lib/chordColors';


export default function SharedSongPage() {
  const params = useParams();
  const { user } = useAuth();
  const [song, setSong] = useState<SharedSong | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  const [comments, setComments] = useState<SongComment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentSending, setCommentSending] = useState(false);

  const allChords = song?.structure
    ?.flatMap((s) => (s.chords || '').split(/\s+/).filter(Boolean))
    ?.filter((v, i, a) => a.indexOf(v) === i) || [];

  useEffect(() => {
    if (!params.id) return;
    const fetchSong = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/shared-songs/${params.id}`);
        setSong(res.data.sharedSong);
        setLikeCount(res.data.sharedSong.likeCount ?? 0);
      } catch {
        setError('Song not found');
      } finally {
        setLoading(false);
      }
    };
    fetchSong();
  }, [params.id]);

  useEffect(() => {
    (async () => {
      if (!user || !params.id) return;
      try {
        const res = await api.get('/shared-songs/liked');
        if (res.data.likedSongIds?.includes(params.id)) setLiked(true);
      } catch {}
    })();
  }, [user, params.id]);

  const toggleLike = async () => {
    if (!user) { window.location.href = '/login'; return; }
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((c) => c + (wasLiked ? -1 : 1));
    try { await api.post(`/shared-songs/${params.id}/like`); }
    catch { setLiked(wasLiked); setLikeCount((c) => c + (wasLiked ? 1 : -1)); }
  };

  const toggleComments = async () => {
    if (showComments) { setShowComments(false); return; }
    setShowComments(true);
    if (comments.length > 0) return;
    setCommentsLoading(true);
    try {
      const res = await api.get(`/shared-songs/${params.id}/comments`);
      setComments(res.data.comments);
    } catch {}
    setCommentsLoading(false);
  };

  const addComment = async () => {
    if (!user || !commentText.trim()) return;
    setCommentSending(true);
    try {
      const res = await api.post(`/shared-songs/${params.id}/comments`, { content: commentText.trim() });
      setComments((prev) => [...prev, res.data.comment]);
      setCommentText('');
    } catch {}
    setCommentSending(false);
  };

  const deleteComment = async (commentId: string) => {
    try {
      await api.delete(`/shared-songs/${params.id}/comments/${commentId}`);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {}
  };

  if (loading) return <LoadingOverlay />;

  if (error || !song) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Music size={48} className="mx-auto text-text-secondary/20 mb-4" />
          <p className="text-sm font-mono text-text-secondary mb-6">{error || 'Song not found'}</p>
          <Link href="/vibes" className="btn-primary !px-4 !min-h-[36px] !text-[10px]">
            Browse Songs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-10">
        <Link href="/vibes" className="inline-flex items-center gap-1.5 text-[11px] font-mono text-text-secondary hover:text-accent-action transition-all duration-200 mb-6">
          <ArrowLeft size={14} />
          Back to Vibes
        </Link>

        {/* Share Image */}
        {song.shareImageUrl && (
          <div className="border border-border bg-surface shadow-sm overflow-hidden mb-6">
            <Image src={song.shareImageUrl} alt={song.title} width={1200} height={630} className="w-full h-auto" unoptimized />
          </div>
        )}

        {/* Title & Author */}
        <div className="mb-6">
          <h1 className="text-3xl font-heading font-bold text-text-primary mb-3">{song.title}</h1>
          <div className="flex items-center gap-3">
            <Link href={`/profile/${song.author.id}`} className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-border bg-surface transition-all duration-200 group-hover:border-accent-action">
                {song.author.avatarUrl ? (
                  <Image src={song.author.avatarUrl} alt={song.author.displayName} width={32} height={32} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs font-mono text-text-secondary">
                    {song.author.displayName?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <span className="text-sm font-mono text-text-secondary group-hover:text-accent-action transition-all duration-200">{song.author.displayName}</span>
            </Link>
            <span className="text-[10px] font-mono text-text-secondary/40">&middot;</span>
            <span className="text-[10px] font-mono text-text-secondary/50">{timeAgo(song.created_at)}</span>
          </div>
          {song.bpm && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[9px] font-mono text-text-secondary/60 border border-border px-1.5 py-0.5">{song.bpm} BPM</span>
              {song.timeSignature && (
                <span className="text-[9px] font-mono text-text-secondary/60 border border-border px-1.5 py-0.5">{song.timeSignature}</span>
              )}
            </div>
          )}
        </div>

        {/* Description */}
        {song.description && (
          <p className="text-sm font-mono text-text-secondary mb-6 leading-relaxed">{song.description}</p>
        )}

        {/* Chords */}
        {allChords.length > 0 && (
          <div className="mb-6">
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-2">Chords</p>
            <div className="flex flex-wrap gap-1.5">
              {allChords.map((chord, i) => (
                <span key={i} className={`text-[11px] font-mono font-bold px-2.5 py-1 border ${chordColor(chord)}`}>
                  {chord}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Lyrics */}
        {song.lyrics && (
          <div className="mb-6">
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-2">Lyrics</p>
            <div className="p-4 border border-border bg-surface shadow-sm">
              <p className="text-[13px] font-mono leading-relaxed text-text-primary whitespace-pre-wrap">{song.lyrics}</p>
            </div>
          </div>
        )}

        {/* Sections Breakdown */}
        {song.structure && song.structure.length > 0 && (
          <div className="mb-6">
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-3">Sections</p>
            <div className="space-y-3">
              {song.structure.map((block, idx) => (
                <div key={idx} className="p-3 border border-border bg-surface shadow-sm border-l-4 border-l-accent-action">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-accent-action mb-2">
                    {block.section} {block.index + 1}
                  </p>
                  {(block.chords || '').split(/\s+/).filter(Boolean).length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {block.chords!.split(/\s+/).filter(Boolean).map((ch, ci) => (
                        <span key={ci} className={`text-[9px] font-mono font-bold px-1.5 py-0.5 border ${chordColor(ch)}`}>{ch}</span>
                      ))}
                    </div>
                  )}
                  {block.content && <p className="text-[12px] font-mono leading-relaxed text-text-primary whitespace-pre-wrap">{block.content}</p>}
                  {block.recordingUrl && (
                    <div className="mt-2 pt-2 border-t border-border/50">
                      <audio controls className="w-full h-8" src={block.recordingUrl}>
                        Your browser does not support the audio element.
                      </audio>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Like & Comment Actions */}
        <div className="border-t border-border pt-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <button onClick={toggleLike} className={`transition-all duration-200 ${liked ? 'text-accent-warm' : 'text-text-secondary hover:text-accent-warm'}`}>
                <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
              </button>
              <LikersList entityId={song.id} entityType="shared_song" count={likeCount} trigger={
                <span className={`text-sm cursor-pointer transition-all duration-200 ${liked ? 'text-accent-warm' : 'text-text-secondary hover:text-accent-warm'}`}>
                  {likeCount}
                </span>
              } />
            </div>
            <button onClick={toggleComments} className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent-action transition-all duration-200">
              <MessageCircle size={18} />
              <span>{song.commentCount ?? 0}</span>
            </button>
          </div>
        </div>

        {/* Comments Section */}
        {showComments && (
          <div className="border-t border-border pt-4 mb-6">
            {commentsLoading ? (
              <p className="text-xs font-mono text-text-secondary/50">Loading comments...</p>
            ) : (
              <div className="space-y-4">
                {comments.length === 0 ? (
                  <p className="text-xs font-mono text-text-secondary/50">No comments yet.</p>
                ) : (
                  comments.map((c, idx) => (
                    <div key={c.id}>
                      <div className="flex gap-3">
                        <Link href={`/profile/${c.user_id}`}>
                          <div className="w-7 h-7 rounded-full overflow-hidden border border-border bg-surface flex-shrink-0 transition-all duration-200 hover:border-accent-action">
                            {c.avatar_url ? (
                              <Image src={c.avatar_url} alt={c.display_name} width={28} height={28} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[9px] font-mono text-text-secondary">{c.display_name?.charAt(0).toUpperCase()}</div>
                            )}
                          </div>
                        </Link>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Link href={`/profile/${c.user_id}`} className="text-[12px] font-heading font-bold text-text-primary hover:text-accent-action transition-all duration-200">{c.display_name}</Link>
                            <span className="text-[9px] font-mono text-text-secondary/50">{timeAgo(c.created_at)}</span>
                            {(user?.id === c.user_id || user?.id === song.author.id) && (
                              <button onClick={() => deleteComment(c.id)} className="ml-auto p-0.5 text-text-secondary/30 hover:text-red-500 transition-all duration-200">
                                <Trash2 size={10} />
                              </button>
                            )}
                          </div>
                          <p className="text-[12px] font-mono text-text-primary mt-0.5">{c.content}</p>
                        </div>
                      </div>
                      {idx < comments.length - 1 && <div className="border-t border-border/50 mt-4" />}
                    </div>
                  ))
                )}
              </div>
            )}
            {user ? (
              <div className="flex items-center gap-2 mt-4">
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addComment(); } }}
                  placeholder="Write a comment..."
                  className="flex-1 text-[12px] font-mono border border-border bg-surface px-3 py-2 text-text-primary placeholder:text-text-secondary/30 outline-none transition-all duration-200 focus:border-accent-action"
                />
                <button
                  onClick={addComment}
                  disabled={!commentText.trim() || commentSending}
                  className="text-[10px] font-mono text-accent-action hover:text-accent-action/80 disabled:text-text-secondary/30 transition-all duration-200"
                >
                  {commentSending ? '...' : 'Post'}
                </button>
              </div>
            ) : (
              <Link href="/login" className="text-[11px] font-mono text-accent-action hover:text-accent-action/80 mt-3 inline-block transition-all duration-200">Log in to comment</Link>
            )}
          </div>
        )}

        {/* CTA */}
        <div className="border-t border-border pt-6 text-center">
          <Link href="/register" className="btn-primary !px-6 !min-h-[40px] !text-[11px]">
            Create Your Own Song on LocoVerse
          </Link>
        </div>
      </div>
    </div>
  );
}
