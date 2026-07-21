import { Router, Response } from 'express';
import { query } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT n.*, u.display_name AS actor_name, u.avatar_url AS actor_avatar
       FROM notifications n
       JOIN users u ON u.id = n.actor_id
       WHERE n.user_id = $1
         AND n.actor_id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = $1)
         AND n.actor_id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_id = $1)
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [req.userId]
    );
    res.json({ notifications: result.rows });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/unread-count', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    let sql = 'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND read = FALSE';
    const params: any[] = [req.userId];
    if (req.query.type) {
      sql += ' AND type = $2';
      params.push(req.query.type);
    }
    const result = await query(sql, params);
    res.json({ count: result.rows[0].count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/read', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body;
    if (ids && Array.isArray(ids) && ids.length > 0) {
      await query(
        'UPDATE notifications SET read = TRUE WHERE user_id = $1 AND id = ANY($2)',
        [req.userId, ids]
      );
    } else {
      await query('UPDATE notifications SET read = TRUE WHERE user_id = $1', [req.userId]);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
