import { Router, Response } from 'express';
import { query } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/blocks — block a user
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { blockedUserId } = req.body;
    if (!blockedUserId) return res.status(400).json({ error: 'blockedUserId required' });
    if (blockedUserId === req.userId) return res.status(400).json({ error: 'Cannot block yourself' });

    const existing = await query('SELECT id FROM users WHERE id = $1', [blockedUserId]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    await query(
      'INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.userId, blockedUserId]
    );

    // Remove any existing connection
    await query(
      "DELETE FROM connections WHERE ((requester_id = $1 AND receiver_id = $2) OR (requester_id = $2 AND receiver_id = $1))",
      [req.userId, blockedUserId]
    );

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/blocks/:blockedUserId — unblock a user
router.delete('/:blockedUserId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { blockedUserId } = req.params;
    await query(
      'DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2',
      [req.userId, blockedUserId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/blocks — list blocked user IDs
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT blocked_id FROM blocks WHERE blocker_id = $1',
      [req.userId]
    );
    res.json({ blockedIds: result.rows.map((r: { blocked_id: string }) => r.blocked_id) });
  } catch (error) {
    console.error('Get blocks error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/blocks/reports — submit a report
router.post('/reports', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { targetType, targetId, reason } = req.body;
    if (!targetType || !targetId || !reason) {
      return res.status(400).json({ error: 'targetType, targetId, and reason required' });
    }

    const validTypes = ['user', 'post', 'shared_song', 'message'];
    if (!validTypes.includes(targetType)) {
      return res.status(400).json({ error: `targetType must be one of: ${validTypes.join(', ')}` });
    }

    if (targetType === 'user' && targetId === req.userId) {
      return res.status(400).json({ error: 'Cannot report yourself' });
    }

    await query(
      'INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES ($1, $2, $3, $4)',
      [req.userId, targetType, targetId, reason]
    );

    console.log(`[REPORT] ${req.userId} reported ${targetType} ${targetId}: ${reason}`);

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Submit report error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
