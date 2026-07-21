'use client';

import Link from 'next/link';
import { Clock, Heart, MessageCircle, Pencil } from 'lucide-react';
import { Article } from '@/types';
import { timeAgo } from '@/lib/utils';

interface ArticleCardProps {
  article: Article;
  onEdit?: (article: Article) => void;
}

export default function ArticleCard({ article, onEdit }: ArticleCardProps) {
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

  const inner = (
    <>
      {article.cover_image_url && (
        <div className="aspect-[3/1] overflow-hidden">
          <img
            src={article.cover_image_url}
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
        </div>
      )}
      <div className="p-5">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          {article.tags.length > 0 && article.tags.map((tag) => (
            <span key={tag} className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 bg-accent-action/10 text-accent-action border border-accent-action/20">
              {tag}
            </span>
          ))}
          {!article.is_published && (
            <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200">
              Draft
            </span>
          )}
        </div>
        <h3 className="text-base font-heading font-bold group-hover:text-accent-action transition-colors mb-1 line-clamp-2">{article.title}</h3>
        {article.excerpt && (
          <p className="text-xs text-text-secondary leading-relaxed mb-3 line-clamp-2">{article.excerpt}</p>
        )}
        <div className="flex items-center gap-3 text-[10px] font-mono text-text-secondary flex-wrap">
          <span className="flex items-center gap-1">
            <img
              src={article.author.avatarUrl || `https://ui-avatars.com/api/?name=${article.author.displayName}&background=1a1a2e&color=fff&size=24`}
              alt=""
              className="w-4 h-4 rounded-full object-cover"
            />
            {article.author.displayName}
          </span>
          <span className="flex items-center gap-1"><Clock size={11} />{article.read_time_minutes} min read</span>
          <span>{timeAgo(article.published_at || article.created_at)}</span>
          {article.likeCount !== undefined && (
            <span className="flex items-center gap-1"><Heart size={11} />{article.likeCount}</span>
          )}
          {article.commentCount !== undefined && (
            <span className="flex items-center gap-1"><MessageCircle size={11} />{article.commentCount}</span>
          )}
        </div>
      </div>
    </>
  );

  if (onEdit) {
    return (
      <div
        onClick={() => onEdit(article)}
        className="relative block bg-white border border-border hover:border-text-secondary/30 transition-colors group cursor-pointer"
      >
        {inner}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider px-2 py-1 bg-accent-action text-white">
            <Pencil size={10} />
            Edit
          </span>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={`/articles/${article.slug}`}
      className="block bg-white border border-border hover:border-text-secondary/30 transition-colors group"
    >
      {inner}
    </Link>
  );
}
