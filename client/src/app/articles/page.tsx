'use client';

import { useState, useEffect } from 'react';
import { BookOpen } from 'lucide-react';
import api from '@/lib/api';
import { Article } from '@/types';
import ArticleCard from '@/components/articles/ArticleCard';

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [tag, setTag] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const fetchArticles = async () => {
      setLoading(true);
      try {
        const params: Record<string, string | number> = { page, limit: 12 };
        if (tag) params.tag = tag;
        const res = await api.get('/articles', { params });
        setArticles(res.data.articles);
        setTotalPages(res.data.totalPages || 1);
      } catch (err) {
        console.error('Failed to load articles', err);
      } finally {
        setLoading(false);
      }
    };
    fetchArticles();
  }, [tag, page]);

  const allTags = Array.from(new Set(articles.flatMap(a => a.tags)));

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-10">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen size={22} className="text-accent-action" />
          <h1 className="text-xl md:text-2xl font-heading font-extrabold">Articles</h1>
        </div>
        <p className="text-sm text-text-secondary mb-8 max-w-xl">Music knowledge, tips, and tutorials from the LocoVerse community.</p>

        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => { setTag(''); setPage(1); }}
              className={`text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 border transition-colors ${!tag ? 'bg-accent-action text-white border-accent-action' : 'border-border text-text-secondary hover:text-text-primary'}`}
            >
              All
            </button>
            {allTags.map((t) => (
              <button
                key={t}
                onClick={() => { setTag(t); setPage(1); }}
                className={`text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 border transition-colors ${tag === t ? 'bg-accent-action text-white border-accent-action' : 'border-border text-text-secondary hover:text-text-primary'}`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="bg-white border border-border p-5 animate-pulse">
                <div className="h-4 bg-border rounded w-3/4 mb-3" />
                <div className="h-3 bg-border rounded w-full mb-2" />
                <div className="h-3 bg-border rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="bg-white border border-border p-10 text-center">
            <BookOpen size={32} className="mx-auto text-text-secondary/30 mb-3" />
            <p className="text-sm font-mono text-text-secondary">No articles yet{tag ? ` tagged "${tag}"` : ''}.</p>
            <p className="text-xs text-text-secondary mt-1">Be the first to share your music knowledge!</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {articles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-secondary !px-3 !min-h-[32px] !text-[10px] disabled:opacity-30"
                >
                  Previous
                </button>
                <span className="text-[10px] font-mono text-text-secondary self-center px-3">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="btn-secondary !px-3 !min-h-[32px] !text-[10px] disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
