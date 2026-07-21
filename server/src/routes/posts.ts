import { Router, Response } from 'express';
import { query } from '../config/database';
import { getUserIdFromRequest } from '../utils/token';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { getIO } from '../config/socket';

const router = Router();

const CATEGORIES = ['collab', 'forsale', 'looking', 'other'];
const getViewerId = (req: { headers: { authorization?: string }; cookies?: Record<string, string> }): string | undefined => {
  return getUserIdFromRequest(req as any);
};

const mapPost = (row: any) => ({
  id: row.id,
  user_id: row.user_id,
  category: row.category,
  title: row.title,
  content: row.content,
  visibility: row.visibility,
  created_at: row.created_at,
  updated_at: row.updated_at,
  likeCount: row.like_count,
  commentCount: row.comment_count,
  author: {
    id: row.user_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
  },
});

// List all posts visible to the viewer (public to everyone, connection-only to connections/owner)
router.get('/', async (req, res: Response) => {
  try {
    const viewerId = getUserIdFromRequest(req);
    const limit = Number(req.query.limit) || 20;
    const page = Number(req.query.page) || 1;
    const offset = (page - 1) * limit;

    const blockFilter = viewerId
      ? `AND p.user_id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = $1)
         AND p.user_id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_id = $1)`
      : '';

    const result = await query(
      `SELECT p.*, u.display_name, u.avatar_url,
         (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id)::int AS like_count,
         (SELECT COUNT(*) FROM post_comments c WHERE c.post_id = p.id)::int AS comment_count
       FROM posts p
       JOIN users u ON u.id = p.user_id
       WHERE (
         p.visibility = 'public'
         OR (
           p.visibility = 'connections-only'
           AND (
             p.user_id = $1
             OR EXISTS (
               SELECT 1 FROM connections conn
               WHERE ((conn.requester_id = $1 AND conn.receiver_id = p.user_id)
                      OR (conn.requester_id = p.user_id AND conn.receiver_id = $1))
               AND conn.status = 'accepted'
             )
           )
         )
       )
       ${blockFilter}
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3`,
      [viewerId || null, limit, offset]
    );

    res.json({
      posts: result.rows.map(mapPost),
      hasMore: result.rows.length === limit,
      page,
    });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/liked', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query('SELECT post_id FROM post_likes WHERE user_id = $1', [req.userId]);
    res.json({ likedPostIds: result.rows.map((r: any) => r.post_id) });
  } catch (error) {
    console.error('Get liked posts error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Posts by a specific user (visibility filtered for the viewer)
router.get('/user/:userId', async (req, res: Response) => {
  try {
    const ownerId = req.params.userId;
    const viewerId = getUserIdFromRequest(req);

    const result = await query(
      `SELECT p.*, u.display_name, u.avatar_url,
         (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id)::int AS like_count,
         (SELECT COUNT(*) FROM post_comments c WHERE c.post_id = p.id)::int AS comment_count
       FROM posts p
       JOIN users u ON u.id = p.user_id
       WHERE p.user_id = $1
         AND (
           p.visibility = 'public'
           OR (
              p.visibility = 'connections-only'
              AND $2::uuid IS NOT NULL
              AND (
               p.user_id = $2
               OR EXISTS (
                 SELECT 1 FROM connections conn
                 WHERE ((conn.requester_id = $2 AND conn.receiver_id = p.user_id)
                        OR (conn.requester_id = p.user_id AND conn.receiver_id = $2))
                 AND conn.status = 'accepted'
               )
             )
           )
         )
       ORDER BY p.created_at DESC`,
      [ownerId, viewerId || null]
    );

    res.json({ posts: result.rows.map(mapPost) });
  } catch (error) {
    console.error('Get user posts error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { category = 'other', title = 'Untitled', content = '', visibility = 'public' } = req.body;
    const safeCategory = CATEGORIES.includes(category) ? category : 'other';
    const safeVisibility = visibility === 'connections-only' ? 'connections-only' : 'public';
    const safeTitle = String(title || 'Untitled').slice(0, 200);
    const safeContent = String(content || '').slice(0, 10000);

    const result = await query(
      `INSERT INTO posts (user_id, category, title, content, visibility)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.userId, safeCategory, safeTitle, safeContent, safeVisibility]
    );

    const userResult = await query(
      'SELECT display_name, avatar_url FROM users WHERE id = $1',
      [req.userId]
    );
    const row = result.rows[0];

    // Notify connections
    try {
      const connections = await query(
        `SELECT CASE WHEN requester_id = $1 THEN receiver_id ELSE requester_id END AS connection_id
         FROM connections
         WHERE (requester_id = $1 OR receiver_id = $1) AND status = 'accepted'`,
        [req.userId]
      );
      const io = getIO();
      const actorName = userResult.rows[0]?.display_name || 'Someone';
      const actorAvatar = userResult.rows[0]?.avatar_url || null;
      for (const conn of connections.rows) {
        const notifResult = await query(
          `INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id)
           VALUES ($1, $2, 'post_created', 'post', $3) RETURNING *`,
          [conn.connection_id, req.userId, row.id]
        );
        io.to(conn.connection_id).emit('new_notification', {
          id: notifResult.rows[0].id,
          type: 'post_created',
          actorName,
          actorAvatar,
          entityTitle: title || 'Untitled',
          createdAt: notifResult.rows[0].created_at,
        });
      }
    } catch (err) {
      console.error('Failed to notify connections for post:', err);
    }

    res.status(201).json({
      post: {
        ...row,
        likeCount: 0,
        commentCount: 0,
        author: {
          id: req.userId,
          displayName: userResult.rows[0]?.display_name || 'Unknown',
          avatarUrl: userResult.rows[0]?.avatar_url || undefined,
        },
      },
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/like', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const postId = req.params.id;
    const existing = await query(
      'SELECT id FROM post_likes WHERE post_id = $1 AND user_id = $2',
      [postId, req.userId]
    );

    if (existing.rows.length > 0) {
      await query('DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2', [postId, req.userId]);
      return res.json({ liked: false });
    }

    await query('INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)', [postId, req.userId]);

    try {
      const postResult = await query('SELECT user_id, title FROM posts WHERE id = $1', [postId]);
      const postOwnerId = postResult.rows[0]?.user_id;
      if (postOwnerId && postOwnerId !== req.userId) {
        const actorResult = await query('SELECT display_name, avatar_url FROM users WHERE id = $1', [req.userId]);
        const actorName = actorResult.rows[0]?.display_name || 'Someone';
        const actorAvatar = actorResult.rows[0]?.avatar_url || null;
        const notifResult = await query(
          `INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id)
           VALUES ($1, $2, 'post_liked', 'post', $3) RETURNING *`,
          [postOwnerId, req.userId, postId]
        );
        const io = getIO();
        io.to(postOwnerId).emit('new_notification', {
          id: notifResult.rows[0].id,
          type: 'post_liked',
          actorName,
          actorAvatar,
          entityTitle: postResult.rows[0]?.title || 'a post',
          createdAt: notifResult.rows[0].created_at,
        });
      }
    } catch (err) {
      console.error('Failed to notify post owner for like:', err);
    }

    return res.status(201).json({ liked: true });
  } catch (error) {
    console.error('Toggle post like error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id/likes', async (req, res: Response) => {
  try {
    const result = await query(
      `SELECT u.id, u.display_name, u.avatar_url
       FROM post_likes l
       JOIN users u ON u.id = l.user_id
       WHERE l.post_id = $1
       ORDER BY l.created_at DESC`,
      [req.params.id]
    );
    res.json({ likers: result.rows });
  } catch (error) {
    console.error('Get post likers error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id/comments', async (req, res: Response) => {
  try {
    const result = await query(
      `SELECT c.*, u.display_name, u.avatar_url
       FROM post_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.post_id = $1
       ORDER BY c.created_at ASC`,
      [req.params.id]
    );
    res.json({ comments: result.rows });
  } catch (error) {
    console.error('Get post comments error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/comments', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const content = String(req.body.content || '').trim().slice(0, 2000);
    if (!content) {
      return res.status(400).json({ error: 'Comment required' });
    }

    const insert = await query(
      `INSERT INTO post_comments (post_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.params.id, req.userId, content]
    );

    const result = await query(
      `SELECT c.*, u.display_name, u.avatar_url
       FROM post_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.id = $1`,
      [insert.rows[0].id]
    );

    // Notify post owner
    try {
      const postResult = await query('SELECT user_id, title FROM posts WHERE id = $1', [req.params.id]);
      const ownerId = postResult.rows[0]?.user_id;
      if (ownerId && ownerId !== req.userId) {
        const actorResult = await query('SELECT display_name, avatar_url FROM users WHERE id = $1', [req.userId]);
        const actorName = actorResult.rows[0]?.display_name || 'Someone';
        const actorAvatar = actorResult.rows[0]?.avatar_url || null;
        const notifResult = await query(
          `INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id)
           VALUES ($1, $2, 'post_commented', 'post', $3) RETURNING *`,
          [ownerId, req.userId, req.params.id]
        );
        const io = getIO();
        io.to(ownerId).emit('new_notification', {
          id: notifResult.rows[0].id,
          type: 'post_commented',
          actorName,
          actorAvatar,
          entityTitle: postResult.rows[0]?.title || 'a post',
          createdAt: notifResult.rows[0].created_at,
        });
      }
    } catch (err) {
      console.error('Failed to notify post owner for comment:', err);
    }

    res.status(201).json({ comment: result.rows[0] });
  } catch (error) {
    console.error('Add post comment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id/comments/:commentId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const commentResult = await query('SELECT * FROM post_comments WHERE id = $1', [req.params.commentId]);
    if (commentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const comment = commentResult.rows[0];
    const postResult = await query('SELECT user_id FROM posts WHERE id = $1', [comment.post_id]);
    const isAuthor = postResult.rows[0]?.user_id === req.userId;

    if (comment.user_id !== req.userId && !isAuthor) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await query('DELETE FROM post_comments WHERE id = $1', [req.params.commentId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete post comment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    if (result.rows[0].user_id !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { category, title, content, visibility } = req.body;
    const safeCategory = category && CATEGORIES.includes(category) ? category : result.rows[0].category;
    const safeTitle = title !== undefined ? title : result.rows[0].title;
    const safeContent = content !== undefined ? content : result.rows[0].content;
    const safeVisibility = visibility === 'connections-only' || visibility === 'public' ? visibility : result.rows[0].visibility;

    const updated = await query(
      `UPDATE posts SET category = $1, title = $2, content = $3, visibility = $4, updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [safeCategory, safeTitle, safeContent, safeVisibility, req.params.id]
    );

    const row = updated.rows[0];
    res.json({
      post: {
        id: row.id,
        user_id: row.user_id,
        category: row.category,
        title: row.title,
        content: row.content,
        visibility: row.visibility,
        created_at: row.created_at,
        updated_at: row.updated_at,
        likeCount: result.rows[0].like_count ?? 0,
        commentCount: result.rows[0].comment_count ?? 0,
        author: {
          id: row.user_id,
          displayName: result.rows[0].display_name,
          avatarUrl: result.rows[0].avatar_url,
        },
      },
    });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    if (result.rows[0].user_id !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await query('DELETE FROM posts WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
