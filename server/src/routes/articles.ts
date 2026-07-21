import { Router, Response } from 'express';
import sanitizeHtml from 'sanitize-html';
import { query } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { getUserIdFromRequest } from '../utils/token';
import { getIO } from '../config/socket';

const router = Router();

const sanitizeOpts: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'a', 'code', 'pre', 'blockquote', 'img', 'hr', 'figure', 'figcaption'],
  allowedAttributes: {
    'a': ['href', 'title', 'target', 'rel'],
    'img': ['src', 'alt', 'width', 'height'],
    'code': ['class'],
    'pre': ['class'],
  },
  allowedSchemes: ['https', 'http'],
  disallowedTagsMode: 'discard',
};

const sanitize = (html: string): string => sanitizeHtml(html, sanitizeOpts);
const sanitizeText = (text: string): string => sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} });


const slugify = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200) || 'untitled';
};

const mapArticle = (row: any) => ({
  id: row.id,
  user_id: row.user_id,
  slug: row.slug,
  title: row.title,
  excerpt: row.excerpt,
  body_html: row.body_html,
  cover_image_url: row.cover_image_url,
  tags: row.tags || [],
  read_time_minutes: row.read_time_minutes,
  is_published: row.is_published,
  published_at: row.published_at,
  created_at: row.created_at,
  updated_at: row.updated_at,
  likeCount: row.like_count ?? 0,
  commentCount: row.comment_count ?? 0,
  liked: row.liked_by_user ?? false,
  author: {
    id: row.user_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
  },
});

const computeReadTime = (html: string): number => {
  const text = html.replace(/<[^>]*>/g, '').trim();
  const words = text.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
};

// List published articles (paginated, optional tag filter)
router.get('/', async (req, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;
    const tag = req.query.tag as string | undefined;

    let sql = `
      SELECT a.*, u.display_name, u.avatar_url,
        (SELECT COUNT(*) FROM article_likes l WHERE l.article_id = a.id)::int AS like_count,
        (SELECT COUNT(*) FROM article_comments c WHERE c.article_id = a.id)::int AS comment_count
      FROM articles a
      JOIN users u ON u.id = a.user_id
      WHERE a.is_published = true`;
    const params: any[] = [];

    if (tag) {
      sql += ` AND $${params.length + 1} = ANY(a.tags)`;
      params.push(tag);
    }

    sql += ` ORDER BY a.published_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    const countResult = await query(
      `SELECT COUNT(*)::int AS total FROM articles WHERE is_published = true${tag ? ' AND $1 = ANY(tags)' : ''}`,
      tag ? [tag] : []
    );

    res.json({
      articles: result.rows.map(mapArticle),
      total: countResult.rows[0].total,
      page,
      totalPages: Math.ceil(countResult.rows[0].total / limit),
    });
  } catch (error) {
    console.error('List articles error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single article by slug
router.get('/:slug', async (req, res: Response) => {
  try {
    const viewerId = getUserIdFromRequest(req);
    const result = await query(
      `SELECT a.*, u.display_name, u.avatar_url,
        (SELECT COUNT(*) FROM article_likes l WHERE l.article_id = a.id)::int AS like_count,
        (SELECT COUNT(*) FROM article_comments c WHERE c.article_id = a.id)::int AS comment_count,
        EXISTS(SELECT 1 FROM article_likes l WHERE l.article_id = a.id AND l.user_id = $2) AS liked_by_user
      FROM articles a
      JOIN users u ON u.id = a.user_id
      WHERE a.slug = $1`,
      [req.params.slug, viewerId || '']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json({ article: mapArticle(result.rows[0]) });
  } catch (error) {
    console.error('Get article error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// List articles by user (owner sees all, others see only published)
router.get('/user/:userId', async (req, res: Response) => {
  try {
    const ownerId = req.params.userId;
    const viewerId = getUserIdFromRequest(req);
    const isOwner = viewerId === ownerId;

    const result = await query(
      `SELECT a.*, u.display_name, u.avatar_url,
        (SELECT COUNT(*) FROM article_likes l WHERE l.article_id = a.id)::int AS like_count,
        (SELECT COUNT(*) FROM article_comments c WHERE c.article_id = a.id)::int AS comment_count
      FROM articles a
      JOIN users u ON u.id = a.user_id
      WHERE a.user_id = $1
        AND (a.is_published = true OR $2::boolean = true)
      ORDER BY a.created_at DESC`,
      [ownerId, isOwner]
    );

    res.json({ articles: result.rows.map(mapArticle) });
  } catch (error) {
    console.error('Get user articles error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create article (draft)
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { title = 'Untitled', excerpt = '', body_html = '', cover_image_url, tags = [] } = req.body;
    const safeTitle = sanitizeText(title).slice(0, 200);
    const safeExcerpt = sanitizeText(excerpt).slice(0, 500);
    const safeBodyHtml = sanitize(body_html).slice(0, 100000);
    let slug = slugify(req.body.slug || safeTitle);

    const existing = await query('SELECT id FROM articles WHERE slug = $1', [slug]);
    if (existing.rows.length > 0) {
      slug = slug + '-' + Math.random().toString(36).slice(2, 6);
    }

    const readTime = computeReadTime(safeBodyHtml);
    const safeTags = Array.isArray(tags) ? tags.filter((t: any) => typeof t === 'string' && t.trim()).slice(0, 10) : [];

    const result = await query(
      `INSERT INTO articles (user_id, slug, title, excerpt, body_html, cover_image_url, tags, read_time_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [req.userId, slug, safeTitle, safeExcerpt, safeBodyHtml, cover_image_url || null, safeTags, readTime]
    );

    const userResult = await query(
      'SELECT display_name, avatar_url FROM users WHERE id = $1',
      [req.userId]
    );

    const row = result.rows[0];
    res.status(201).json({
      article: {
        ...row,
        likeCount: 0,
        commentCount: 0,
        tags: row.tags || [],
        author: {
          id: req.userId,
          displayName: userResult.rows[0]?.display_name || 'Unknown',
          avatarUrl: userResult.rows[0]?.avatar_url || undefined,
        },
      },
    });
  } catch (error) {
    console.error('Create article error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update article
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query('SELECT * FROM articles WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }
    if (result.rows[0].user_id !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const current = result.rows[0];
    const title = req.body.title !== undefined ? sanitizeText(req.body.title).slice(0, 200) : current.title;
    const excerpt = req.body.excerpt !== undefined ? sanitizeText(req.body.excerpt).slice(0, 500) : current.excerpt;
    const body_html = req.body.body_html !== undefined ? sanitize(req.body.body_html).slice(0, 100000) : current.body_html;
    const cover_image_url = req.body.cover_image_url !== undefined ? req.body.cover_image_url : current.cover_image_url;
    const tags = req.body.tags !== undefined ? req.body.tags : (current.tags || []);
    const readTime = computeReadTime(body_html);
    const safeTags = Array.isArray(tags) ? tags.filter((t: any) => typeof t === 'string' && t.trim()).slice(0, 10) : [];

    const updated = await query(
      `UPDATE articles SET title = $1, excerpt = $2, body_html = $3, cover_image_url = $4,
        tags = $5, read_time_minutes = $6, updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [title, excerpt, body_html, cover_image_url, safeTags, readTime, req.params.id]
    );

    const userResult = await query('SELECT display_name, avatar_url FROM users WHERE id = $1', [req.userId]);
    const row = updated.rows[0];
    res.json({
      article: {
        ...row,
        likeCount: current.like_count ?? 0,
        commentCount: current.comment_count ?? 0,
        tags: row.tags || [],
        author: {
          id: req.userId,
          displayName: userResult.rows[0]?.display_name || 'Unknown',
          avatarUrl: userResult.rows[0]?.avatar_url || undefined,
        },
      },
    });
  } catch (error) {
    console.error('Update article error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete article
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query('SELECT * FROM articles WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }
    if (result.rows[0].user_id !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await query('DELETE FROM articles WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete article error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Toggle publish
router.post('/:id/publish', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query('SELECT * FROM articles WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }
    if (result.rows[0].user_id !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const current = result.rows[0];
    const newStatus = !current.is_published;

    await query(
      `UPDATE articles SET is_published = $1, published_at = CASE WHEN $1 = true AND published_at IS NULL THEN NOW() ELSE published_at END,
        updated_at = NOW() WHERE id = $2`,
      [newStatus, req.params.id]
    );

    res.json({ is_published: newStatus });
  } catch (error) {
    console.error('Toggle publish error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Toggle like
router.post('/:id/like', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const articleId = req.params.id;
    const existing = await query(
      'SELECT id FROM article_likes WHERE article_id = $1 AND user_id = $2',
      [articleId, req.userId]
    );

    if (existing.rows.length > 0) {
      await query('DELETE FROM article_likes WHERE article_id = $1 AND user_id = $2', [articleId, req.userId]);
      return res.json({ liked: false });
    }

    await query('INSERT INTO article_likes (article_id, user_id) VALUES ($1, $2)', [articleId, req.userId]);

    try {
      const articleResult = await query('SELECT user_id, title FROM articles WHERE id = $1', [articleId]);
      const ownerId = articleResult.rows[0]?.user_id;
      if (ownerId && ownerId !== req.userId) {
        const actorResult = await query('SELECT display_name, avatar_url FROM users WHERE id = $1', [req.userId]);
        const actorName = actorResult.rows[0]?.display_name || 'Someone';
        const actorAvatar = actorResult.rows[0]?.avatar_url || null;
        const notifResult = await query(
          `INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id)
           VALUES ($1, $2, 'article_liked', 'article', $3) RETURNING *`,
          [ownerId, req.userId, articleId]
        );
        const io = getIO();
        io.to(ownerId).emit('new_notification', {
          id: notifResult.rows[0].id,
          type: 'article_liked',
          actorName,
          actorAvatar,
          entityTitle: articleResult.rows[0]?.title || 'an article',
          createdAt: notifResult.rows[0].created_at,
        });
      }
    } catch (err) {
      console.error('Failed to notify article owner for like:', err);
    }

    return res.status(201).json({ liked: true });
  } catch (error) {
    console.error('Toggle article like error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get likers
router.get('/:id/likes', async (req, res: Response) => {
  try {
    const result = await query(
      `SELECT u.id, u.display_name, u.avatar_url
       FROM article_likes l
       JOIN users u ON u.id = l.user_id
       WHERE l.article_id = $1
       ORDER BY l.created_at DESC`,
      [req.params.id]
    );
    res.json({ likers: result.rows });
  } catch (error) {
    console.error('Get article likers error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get comments
router.get('/:id/comments', async (req, res: Response) => {
  try {
    const result = await query(
      `SELECT c.*, u.display_name, u.avatar_url
       FROM article_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.article_id = $1
       ORDER BY c.created_at ASC`,
      [req.params.id]
    );
    res.json({ comments: result.rows });
  } catch (error) {
    console.error('Get article comments error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add comment
router.post('/:id/comments', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const content = sanitizeText((req.body.content || '').trim()).slice(0, 2000);
    if (!content) {
      return res.status(400).json({ error: 'Comment required' });
    }

    const insert = await query(
      `INSERT INTO article_comments (article_id, user_id, content)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, req.userId, content]
    );

    const result = await query(
      `SELECT c.*, u.display_name, u.avatar_url
       FROM article_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.id = $1`,
      [insert.rows[0].id]
    );

    try {
      const articleResult = await query('SELECT user_id, title FROM articles WHERE id = $1', [req.params.id]);
      const ownerId = articleResult.rows[0]?.user_id;
      if (ownerId && ownerId !== req.userId) {
        const actorResult = await query('SELECT display_name, avatar_url FROM users WHERE id = $1', [req.userId]);
        const actorName = actorResult.rows[0]?.display_name || 'Someone';
        const actorAvatar = actorResult.rows[0]?.avatar_url || null;
        const notifResult = await query(
          `INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id)
           VALUES ($1, $2, 'article_commented', 'article', $3) RETURNING *`,
          [ownerId, req.userId, req.params.id]
        );
        const io = getIO();
        io.to(ownerId).emit('new_notification', {
          id: notifResult.rows[0].id,
          type: 'article_commented',
          actorName,
          actorAvatar,
          entityTitle: articleResult.rows[0]?.title || 'an article',
          createdAt: notifResult.rows[0].created_at,
        });
      }
    } catch (err) {
      console.error('Failed to notify article owner for comment:', err);
    }

    res.status(201).json({ comment: result.rows[0] });
  } catch (error) {
    console.error('Add article comment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete comment
router.delete('/:id/comments/:commentId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const commentResult = await query('SELECT * FROM article_comments WHERE id = $1', [req.params.commentId]);
    if (commentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const comment = commentResult.rows[0];
    const articleResult = await query('SELECT user_id FROM articles WHERE id = $1', [comment.article_id]);
    const isAuthor = articleResult.rows[0]?.user_id === req.userId;

    if (comment.user_id !== req.userId && !isAuthor) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await query('DELETE FROM article_comments WHERE id = $1', [req.params.commentId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete article comment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
