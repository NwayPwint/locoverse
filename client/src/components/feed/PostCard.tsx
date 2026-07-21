'use client';

import { useState, useEffect } from 'react';
import { Heart, MessageCircle, UserPlus, Send, Trash2, Check, ChevronDown, ChevronUp } from 'lucide-react';
import api from '@/lib/api';
import { timeAgo } from '@/lib/utils';
import { sectionBorder } from '@/lib/sectionBorder';
import { SharedSong, SongComment } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import LikersList from './LikersList';


interface PostCardProps {
  song: SharedSong;
  isLiked?: boolean;
  connectedIds?: Set<string>;
}

export default function PostCard({ song, isLiked = false, connectedIds = new Set() }: PostCardProps) {
  const { user } = useAuth();

  const [liked, setLiked] = useState(isLiked);
  const [likeCount, setLikeCount] = useState(song.likeCount ?? 0);
  const [commentCount, setCommentCount] = useState(song.commentCount ?? 0);

  useEffect(() => {
    setLikeCount(song.likeCount ?? 0);
  }, [song.likeCount]);

  useEffect(() => {
    setLiked(isLiked);
  }, [isLiked]);
  const [expanded, setExpanded] = useState(false);

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<SongComment[]>([]);
  const [commentInput, setCommentInput] = useState('');

  const [requestSent, setRequestSent] = useState(false);

  const toggleLike = async () => {
    if (!user) {
      window.location.href = '/login';
      return;
    }

    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((c) => c + (wasLiked ? -1 : 1));

    try {
      await api.post(`/shared-songs/${song.id}/like`);
    } catch {
      setLiked(wasLiked);
      setLikeCount((c) => c + (wasLiked ? 1 : -1));
    }
  };

  const toggleComments = async () => {
    const open = !commentsOpen;
    setCommentsOpen(open);

    if (open && comments.length === 0) {
      try {
        const res = await api.get(`/shared-songs/${song.id}/comments`);
        setComments(res.data.comments);
      } catch {
        setCommentsOpen(false);
      }
    }
  };

  const submitComment = async () => {
    if (!user) {
      window.location.href = '/login';
      return;
    }

    const content = commentInput.trim();
    if (!content) return;

    try {
      const res = await api.post(`/shared-songs/${song.id}/comments`, { content });
      const comment: SongComment = res.data.comment;
      setComments((prev) => [...prev, comment]);
      setCommentInput('');
      setCommentCount((c) => c + 1);
    } catch {
      // ignore
    }
  };

  const deleteComment = async (comment: SongComment) => {
    try {
      await api.delete(`/shared-songs/${song.id}/comments/${comment.id}`);
      setComments((prev) => prev.filter((c) => c.id !== comment.id));
      setCommentCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  };

  const sendContact = async () => {
    if (!user) {
      window.location.href = '/login';
      return;
    }

    try {
      await api.post('/connections', { receiverId: song.author.id });
      setRequestSent(true);
    } catch {
      // ignore
    }
  };

  const isOwn = user?.id === song.author.id;
  const isConnected = connectedIds.has(song.author.id);

  const renderSection = (block: { section: string; index: number; content: string; chords?: string; notes?: string; recordingUrl?: string }, key: string | number) => (
    <div key={key} className={`border-l-4 ${sectionBorder[block.section] || 'border-l-border'} pl-4 py-3`}>
      <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary mb-1">
        {block.section} {block.index + 1}
      </p>
      <p className="whitespace-pre-wrap text-sm text-text-primary">{block.content || 'No content'}</p>
      {block.chords && (
        <p className="text-[10px] font-mono text-text-secondary mt-1">Chords: {block.chords}</p>
      )}
      {block.notes && (
        <p className="text-[11px] italic text-text-secondary mt-1 border-l-2 border-border pl-2">Notes: {block.notes}</p>
      )}
      {block.recordingUrl && (
        <audio controls className="w-full mt-2 h-8">
          <source src={block.recordingUrl} />
          Your browser does not support the audio element.
        </audio>
      )}
    </div>
  );

  const isSection =
    song.shareScope === 'section' &&
    typeof song.sectionIndex === 'number' &&
    !!song.structure[song.sectionIndex];
  const anySectionAudio = song.structure.some((b) => b.recordingUrl);
  const sectionIdx = isSection ? (song.sectionIndex as number) : null;

  return (
    <div className="bg-white border border-border">
      <div className="p-3 sm:p-5 border-b border-border space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Link href={`/profile/${song.author.id}`} className="flex items-center gap-2 sm:gap-2.5 group">
            {song.author.avatarUrl ? (
              <img
                src={song.author.avatarUrl}
                alt={song.author.displayName}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-border"
              />
            ) : (
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-accent-action/10 flex items-center justify-center text-accent-action text-[10px] font-bold uppercase">
                {song.author.displayName.charAt(0)}
              </div>
            )}
            <p className="text-[10px] sm:text-xs font-mono uppercase tracking-[0.12em] text-text-secondary group-hover:text-accent-action transition-colors">
              {song.author.displayName}
            </p>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-text-secondary shrink-0">
            <span>{timeAgo(song.created_at)}</span>
            <span className="text-[9px] font-mono">
              {song.visibility === 'public' ? 'Public' : 'Locos only'}
              {isSection ? ' · 1 section' : ''}
            </span>
          </div>
        </div>
        <h2 className="text-sm sm:text-base font-heading font-bold leading-tight group-hover:text-accent-action transition-colors">
          {song.title}
        </h2>
      </div>

      <div className="p-3 sm:p-5 space-y-3 sm:space-y-4">
        {song.description && <p className="text-sm text-text-primary">{song.description}</p>}

        {!anySectionAudio && (
          <p className="text-[11px] font-mono text-text-secondary/60 italic">No audio attached.</p>
        )}

        {isSection ? (
          renderSection(song.structure[sectionIdx as number], 'section')
        ) : (
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary mb-2">Song Structure</p>
            <div className="space-y-3">
              {song.structure.length === 0 ? (
                <p className="text-xs text-text-secondary">No structured sections</p>
              ) : (
                (expanded ? song.structure : song.structure.slice(0, 1)).map((block, idx) => renderSection(block, idx))
              )}
            </div>
            {song.structure.length > 1 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 mt-3 text-[11px] font-mono text-accent-action hover:text-accent-action/80 transition-colors"
              >
                {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {expanded ? 'Show less' : `See all ${song.structure.length} sections`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Action bar: Like / Comment / Contact */}
      <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-t border-border flex items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleLike}
            className={`text-sm transition-colors ${
              liked ? 'text-accent-warm' : 'text-text-secondary hover:text-accent-warm'
            }`}
          >
            <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
          </button>
          <LikersList entityId={song.id} entityType="shared_song" count={likeCount} trigger={
            <span className={`text-sm cursor-pointer transition-colors ${liked ? 'text-accent-warm' : 'text-text-secondary hover:text-accent-warm'}`}>
              {likeCount}
            </span>
          } />
        </div>

        <button
          onClick={toggleComments}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent-action transition-colors"
        >
          <MessageCircle size={16} />
          <span>{commentCount}</span>
        </button>

        {user && !isOwn && (
          <div className="ml-auto flex items-center gap-2">
            {isConnected ? (
              <Link
                href={`/chat?user=${song.author.id}`}
                className="btn-secondary flex items-center gap-1.5 !px-3 !min-h-[32px] !text-[11px]"
              >
                <Send size={14} />
                Message
              </Link>
            ) : requestSent ? (
              <span className="btn-secondary flex items-center gap-1.5 !px-3 !min-h-[32px] !text-[11px] opacity-70 cursor-default">
                <Check size={14} />
                Request sent
              </span>
            ) : (
              <button
                onClick={sendContact}
                className="btn-secondary flex items-center gap-1.5 !px-3 !min-h-[32px] !text-[11px]"
              >
                <UserPlus size={14} />
                Contact
              </button>
            )}
          </div>
        )}
      </div>

      {/* Comments */}
      {commentsOpen && (
        <div className="px-3 sm:px-5 pb-3 sm:pb-5 border-t border-border space-y-3 sm:space-y-4">
          <div className="flex items-center gap-2 pt-4">
            <input
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitComment();
              }}
              placeholder={user ? 'Add a comment...' : 'Log in to comment'}
              disabled={!user}
              className="input-field flex-1 !min-h-[36px] text-sm py-2"
            />
            <button
              onClick={submitComment}
              disabled={!user || !commentInput.trim()}
              className="btn-primary !px-4 !min-h-[36px] !text-[11px] disabled:opacity-40"
            >
              Post
            </button>
          </div>

          <div className="space-y-3">
            {comments.length === 0 ? (
              <p className="text-xs text-text-secondary">No comments yet.</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-border bg-surface flex-shrink-0">
                    {c.avatar_url ? (
                      <img src={c.avatar_url} alt={c.display_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-text-secondary text-[10px] font-bold uppercase">
                        {c.display_name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-heading font-bold">{c.display_name}</span>
                      <span className="text-[10px] font-mono text-text-secondary">
                        {new Date(c.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-text-primary whitespace-pre-wrap">{c.content}</p>
                  </div>
                  {user && (c.user_id === user.id || isOwn) && (
                    <button
                      onClick={() => deleteComment(c)}
                      className="text-text-secondary hover:text-red-400 p-1 transition-colors"
                      title="Delete comment"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

    </div>
  );
}
