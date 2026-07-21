'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Heart, MessageCircle, Clock, BookOpen, Trash2 } from 'lucide-react';
import DOMPurify from 'isomorphic-dompurify';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Article, ArticleComment } from '@/types';
import { timeAgo } from '@/lib/utils';

export default function ArticleDetailPage() {
  const params = useParams();
  const { user } = useAuth();
  const slug = params.slug as string;

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [comments, setComments] = useState<ArticleComment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [commenting, setCommenting] = useState(false);

  const safeBodyHtml = useMemo(() => {
    if (!article?.body_html) return '';
    return DOMPurify.sanitize(article.body_html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'a', 'code', 'pre', 'blockquote', 'img', 'hr', 'figure', 'figcaption'],
      ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'src', 'alt', 'width', 'height', 'class'],
    });
  }, [article?.body_html]);


  useEffect(() => {
    const fetch = async () => {
      try {
        const articleRes = await api.get(`/articles/${slug}`);
        setArticle(articleRes.data.article);
        setLiked(articleRes.data.article.liked ?? false);
      } catch (err) {
        console.error('Failed to load article', err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [slug, user]);

  const handleLike = async () => {
    if (!user || !article) return;
    try {
      const res = await api.post(`/articles/${article.id}/like`);
      setLiked(res.data.liked);
      setArticle(prev => prev ? { ...prev, likeCount: (prev.likeCount || 0) + (res.data.liked ? 1 : -1) } : prev);
    } catch (err) {
      console.error('Like failed', err);
    }
  };

  const loadComments = async () => {
    if (!article) return;
    try {
      const res = await api.get(`/articles/${article.id}/comments`);
      setComments(res.data.comments);
    } catch (err) {
      console.error('Failed to load comments', err);
    }
  };

  const toggleComments = () => {
    const next = !showComments;
    setShowComments(next);
    if (next && comments.length === 0) loadComments();
  };

  const handleComment = async () => {
    if (!user || !article || !commentInput.trim()) return;
    setCommenting(true);
    try {
      const res = await api.post(`/articles/${article.id}/comments`, { content: commentInput });
      setComments(prev => [...prev, res.data.comment]);
      setCommentInput('');
      setArticle(prev => prev ? { ...prev, commentCount: (prev.commentCount || 0) + 1 } : prev);
    } catch (err) {
      console.error('Comment failed', err);
    } finally {
      setCommenting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!article) return;
    try {
      await api.delete(`/articles/${article.id}/comments/${commentId}`);
      setComments(prev => prev.filter(c => c.id !== commentId));
      setArticle(prev => prev ? { ...prev, commentCount: Math.max(0, (prev.commentCount || 0) - 1) } : prev);
    } catch (err) {
      console.error('Delete comment failed', err);
    }
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <BookOpen size={32} className="mx-auto text-text-secondary/30 mb-3 animate-pulse" />
          <p className="text-xs font-mono text-text-secondary">Loading article...</p>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <BookOpen size={32} className="mx-auto text-text-secondary/30 mb-3" />
          <p className="text-sm font-mono text-text-secondary">Article not found.</p>
          <Link href="/articles" className="text-accent-action text-xs font-mono underline mt-2 inline-block">Browse articles</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-10">
        <Link href="/articles" className="inline-flex items-center gap-1.5 text-[10px] font-mono text-text-secondary hover:text-accent-action mb-6 transition-colors">
          <ArrowLeft size={13} /> Back to Articles
        </Link>

        <article>
          {article.cover_image_url && (
            <div className="aspect-[2/1] overflow-hidden mb-6">
              <img src={article.cover_image_url} alt={article.title} className="w-full h-full object-cover" />
            </div>
          )}

          <div className="flex flex-wrap gap-1.5 mb-3">
            {article.tags.map((tag) => (
              <Link key={tag} href={`/articles?tag=${tag}`} className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 bg-accent-action/10 text-accent-action border border-accent-action/20 hover:bg-accent-action/20 transition-colors">
                {tag}
              </Link>
            ))}
          </div>

          <h1 className="text-xl md:text-3xl font-heading font-extrabold mb-3">{article.title}</h1>

          <div className="flex items-center gap-3 text-[10px] font-mono text-text-secondary mb-6 flex-wrap">
            <span className="flex items-center gap-1.5">
              <img
                src={article.author.avatarUrl || `https://ui-avatars.com/api/?name=${article.author.displayName}&background=1a1a2e&color=fff&size=24`}
                alt=""
                className="w-5 h-5 rounded-full object-cover"
              />
              <Link href={`/profile/${article.author.id}`} className="hover:text-accent-action transition-colors">
                {article.author.displayName}
              </Link>
            </span>
            <span className="flex items-center gap-1"><Clock size={12} />{article.read_time_minutes} min read</span>
            <span>{timeAgo(article.published_at || article.created_at)}</span>
          </div>

          {article.excerpt && (
            <p className="text-sm text-text-secondary italic mb-6 border-l-2 border-border pl-4">{article.excerpt}</p>
          )}

          <div
            className="prose prose-sm max-w-none text-text-primary leading-relaxed [&_h2]:text-base [&_h2]:font-heading [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-3 [&_h3]:text-sm [&_h3]:font-heading [&_h3]:font-bold [&_h3]:mt-5 [&_h3]:mb-2 [&_p]:mb-3 [&_ul]:mb-3 [&_ol]:mb-3 [&_code]:text-[11px] [&_code]:bg-border/50 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_pre]:bg-background [&_pre]:border [&_pre]:border-border [&_pre]:p-3 [&_pre]:text-[11px] [&_pre]:font-mono [&_pre]:overflow-x-auto [&_blockquote]:border-l-2 [&_blockquote]:border-accent-action [&_blockquote]:pl-4 [&_blockquote]:text-text-secondary [&_blockquote]:italic [&_li]:text-sm [&_li]:leading-relaxed"
            dangerouslySetInnerHTML={{ __html: safeBodyHtml }}
          />
        </article>

        <div className="flex items-center gap-4 mt-8 pt-6 border-t border-border">
          {user && (
            <button onClick={handleLike} className={`flex items-center gap-1.5 text-xs font-mono transition-colors ${liked ? 'text-accent-warm' : 'text-text-secondary hover:text-accent-warm'}`}>
              <Heart size={14} fill={liked ? 'currentColor' : 'none'} />
              {article.likeCount || 0}
            </button>
          )}
          <button onClick={toggleComments} className="flex items-center gap-1.5 text-xs font-mono text-text-secondary hover:text-accent-action transition-colors">
            <MessageCircle size={14} />
            {article.commentCount || 0}
          </button>
        </div>

        {showComments && (
          <div className="mt-6 border border-border bg-white">
            {user && (
              <div className="flex items-center gap-2 p-4 border-b border-border">
                <input
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleComment()}
                  className="flex-1 text-xs font-mono border border-border bg-background px-3 py-2 outline-none placeholder:text-text-secondary/50"
                  placeholder="Write a comment..."
                />
                <button onClick={handleComment} disabled={commenting || !commentInput.trim()} className="btn-primary !px-3 !min-h-[32px] !text-[9px]">
                  {commenting ? 'Posting...' : 'Post'}
                </button>
              </div>
            )}
            {comments.length === 0 ? (
              <p className="p-4 text-[10px] font-mono text-text-secondary text-center">No comments yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {comments.map((comment) => (
                  <div key={comment.id} className="px-4 py-3 flex gap-3">
                    <img
                      src={comment.avatar_url || `https://ui-avatars.com/api/?name=${comment.display_name}&background=1a1a2e&color=fff&size=24`}
                      alt=""
                      className="w-6 h-6 rounded-full object-cover shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-mono font-bold text-text-primary">{comment.display_name}</span>
                        <span className="text-[9px] font-mono text-text-secondary">{timeAgo(comment.created_at)}</span>
                      </div>
                      <p className="text-xs text-text-secondary leading-relaxed">{comment.content}</p>
                    </div>
                    {(user?.id === comment.user_id || user?.id === article.author.id) && (
                      <button onClick={() => handleDeleteComment(comment.id)} className="shrink-0 p-1 text-text-secondary hover:text-red-500 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
