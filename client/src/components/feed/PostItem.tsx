'use client';

import { useState } from 'react';
import { Heart, MessageCircle, UserPlus, Send, Trash2, Check, Pencil, X } from 'lucide-react';
import api from '@/lib/api';
import { timeAgo } from '@/lib/utils';
import { Post, PostComment } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import LikersList from './LikersList';

const POST_CATEGORY_LABELS: Record<string, string> = {
  collab: 'Collaboration',
  forsale: 'For Sale',
  looking: 'Looking For',
  other: 'Other',
};

const CATEGORY_STYLES: Record<string, string> = {
  collab: 'bg-accent-action/10 text-accent-action',
  forsale: 'bg-purple-400/10 text-purple-500',
  looking: 'bg-accent-warm/10 text-accent-warm',
  other: 'bg-surface text-text-secondary',
};

interface PostItemProps {
  post: Post;
  isLiked?: boolean;
  connectedIds?: Set<string>;
  onDelete?: (id: string) => void;
  onEdit?: (updated: Post) => void;
}

export default function PostItem({ post, isLiked = false, connectedIds = new Set(), onDelete, onEdit }: PostItemProps) {
  const { user } = useAuth();

  const [liked, setLiked] = useState(isLiked);
  const [likeCount, setLikeCount] = useState(post.likeCount ?? 0);
  const [commentCount, setCommentCount] = useState(post.commentCount ?? 0);

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentInput, setCommentInput] = useState('');

  const [requestSent, setRequestSent] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ category: post.category, title: post.title, content: post.content, visibility: post.visibility });
  const [editSaving, setEditSaving] = useState(false);

  const toggleLike = async () => {
    if (!user) {
      window.location.href = '/login';
      return;
    }

    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((c) => c + (wasLiked ? -1 : 1));

    try {
      await api.post(`/posts/${post.id}/like`);
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
        const res = await api.get(`/posts/${post.id}/comments`);
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
      const res = await api.post(`/posts/${post.id}/comments`, { content });
      setComments((prev) => [...prev, res.data.comment]);
      setCommentInput('');
      setCommentCount((c) => c + 1);
    } catch {
      // ignore
    }
  };

  const deleteComment = async (comment: PostComment) => {
    try {
      await api.delete(`/posts/${post.id}/comments/${comment.id}`);
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
      await api.post('/connections', { receiverId: author.id });
      setRequestSent(true);
    } catch {
      // ignore
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this post?')) return;
    try {
      await api.delete(`/posts/${post.id}`);
      onDelete?.(post.id);
    } catch {
      // ignore
    }
  };

  const handleSaveEdit = async () => {
    setEditSaving(true);
    try {
      const res = await api.put(`/posts/${post.id}`, editForm);
      const updated = res.data.post;
      onEdit?.(updated);
      setEditing(false);
    } catch {
      // ignore
    } finally {
      setEditSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditForm({ category: post.category, title: post.title, content: post.content, visibility: post.visibility });
    setEditing(false);
  };

  const author = post.author || { id: post.user_id, displayName: 'Unknown', avatarUrl: undefined };
  const isOwn = user?.id === author.id;
  const isConnected = connectedIds.has(author.id);
  const categoryLabel = POST_CATEGORY_LABELS[post.category] || 'Other';

  return (
    <div className="bg-white border border-border">
      <div className="p-3 sm:p-5 border-b border-border space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Link href={`/profile/${author.id}`} className="flex items-center gap-2 sm:gap-2.5 group">
            {author.avatarUrl ? (
              <img src={author.avatarUrl} alt={author.displayName} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-border" />
            ) : (
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-accent-action/10 flex items-center justify-center text-accent-action text-[10px] font-bold uppercase">
                {author.displayName.charAt(0)}
              </div>
            )}
            <p className="text-[10px] sm:text-xs font-mono uppercase tracking-[0.12em] text-text-secondary group-hover:text-accent-action transition-colors">
              {author.displayName}
            </p>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-text-secondary shrink-0">
            <span>{timeAgo(post.created_at)}</span>
            <span className="text-[9px] font-mono">
              {post.visibility === 'public' ? 'Public' : 'Locos only'}
            </span>
          </div>
        </div>
        {editing ? (
          <input
            value={editForm.title}
            onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
            className="input-field !py-1.5 text-sm font-heading font-bold"
          />
        ) : (
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-heading font-bold leading-tight group-hover:text-accent-action transition-colors">
              {post.title}
            </h2>
            <span className={`text-[9px] sm:text-[10px] font-mono uppercase tracking-[0.12em] px-1.5 sm:px-2 py-0.5 ${CATEGORY_STYLES[post.category] || CATEGORY_STYLES.other}`}>
              {categoryLabel}
            </span>
          </div>
        )}
      </div>

      <div className="p-3 sm:p-5">
        {editing ? (
          <textarea
            value={editForm.content}
            onChange={(e) => setEditForm((f) => ({ ...f, content: e.target.value }))}
            rows={4}
            className="input-field resize-none"
          />
        ) : post.content ? (
          <p className="text-sm text-text-primary whitespace-pre-wrap">{post.content}</p>
        ) : (
          <p className="text-sm text-text-secondary italic">No details provided.</p>
        )}
      </div>

      <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-t border-border flex items-center gap-3 sm:gap-4">
        {editing ? (
          <>
            <select
              value={editForm.category}
              onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value as Post['category'] }))}
              className="input-field !min-h-[32px] !text-[11px] w-auto"
            >
              <option value="collab">Collaboration</option>
              <option value="forsale">For Sale</option>
              <option value="looking">Looking For</option>
              <option value="other">Other</option>
            </select>
            <select
              value={editForm.visibility}
              onChange={(e) => setEditForm((f) => ({ ...f, visibility: e.target.value as Post['visibility'] }))}
              className="input-field !min-h-[32px] !text-[11px] w-auto"
            >
              <option value="public">Public</option>
              <option value="connections-only">Locos only</option>
            </select>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={handleCancelEdit} className="btn-secondary !px-3 !min-h-[32px] !text-[11px] flex items-center gap-1.5">
                <X size={14} />
                Cancel
              </button>
              <button onClick={handleSaveEdit} disabled={editSaving} className="btn-primary !px-3 !min-h-[32px] !text-[11px] flex items-center gap-1.5 disabled:opacity-40">
                <Check size={14} />
                {editSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleLike}
                className={`text-sm transition-colors ${
                  liked ? 'text-accent-warm' : 'text-text-secondary hover:text-accent-warm'
                }`}
              >
                <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
              </button>
              <LikersList entityId={post.id} entityType="post" count={likeCount} trigger={
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

            <div className="ml-auto flex items-center gap-2">
              {user && !isOwn && (
                isConnected ? (
                  <Link href={`/chat?user=${post.author.id}`} className="btn-secondary flex items-center gap-1.5 !px-3 !min-h-[32px] !text-[11px]">
                    <Send size={14} />
                    Message
                  </Link>
                ) : requestSent ? (
                  <span className="btn-secondary flex items-center gap-1.5 !px-3 !min-h-[32px] !text-[11px] opacity-70 cursor-default">
                    <Check size={14} />
                    Request sent
                  </span>
                ) : (
                  <button onClick={sendContact} className="btn-secondary flex items-center gap-1.5 !px-3 !min-h-[32px] !text-[11px]">
                    <UserPlus size={14} />
                    Contact
                  </button>
                )
              )}

              {isOwn && onDelete && (
                <>
                  <button onClick={() => setEditing(true)} className="text-text-secondary hover:text-accent-action p-1 transition-colors" title="Edit post">
                    <Pencil size={16} />
                  </button>
                  <button onClick={handleDelete} className="text-text-secondary hover:text-red-400 p-1 transition-colors" title="Delete post">
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {commentsOpen && (
        <div className="px-3 sm:px-5 pb-3 sm:pb-5 border-t border-border space-y-3 sm:space-y-4">
          <div className="flex items-center gap-2 pt-4">
            <input
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitComment(); }}
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
                    <button onClick={() => deleteComment(c)} className="text-text-secondary hover:text-red-400 p-1 transition-colors" title="Delete comment">
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
