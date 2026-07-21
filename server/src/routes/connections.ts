import { Router, Response } from 'express';
import { query } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { getIO } from '../config/socket';

const router = Router();

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { receiverId } = req.body;

    if (req.userId === receiverId) {
      return res.status(400).json({ error: 'Cannot connect with yourself' });
    }

    const existing = await query(
      'SELECT id FROM connections WHERE (requester_id = $1 AND receiver_id = $2) OR (requester_id = $2 AND receiver_id = $1)',
      [req.userId, receiverId]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Connection already exists' });
    }

    const result = await query(
      'INSERT INTO connections (requester_id, receiver_id) VALUES ($1, $2) RETURNING *',
      [req.userId, receiverId]
    );

    const userResult = await query(
      'SELECT id, display_name, avatar_url FROM users WHERE id = $1',
      [req.userId]
    );
    const io = getIO();
    io.to(receiverId).emit('new_loco_request', {
      id: result.rows[0].id,
      requester_id: req.userId,
      display_name: userResult.rows[0].display_name,
      avatar_url: userResult.rows[0].avatar_url,
    });

    // Also create a notification for the receiver
    const notifResult = await query(
      `INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id)
       VALUES ($1, $2, 'loco_request', 'connection', $3) RETURNING *`,
      [receiverId, req.userId, result.rows[0].id]
    );

    io.to(receiverId).emit('new_notification', {
      id: notifResult.rows[0].id,
      type: 'loco_request',
      actorName: userResult.rows[0].display_name,
      actorAvatar: userResult.rows[0].avatar_url,
      entityTitle: 'New Loco request',
      createdAt: notifResult.rows[0].created_at,
    });

    res.status(201).json({ connection: result.rows[0] });
  } catch (error) {
    console.error('Create connection error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id/accept', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'UPDATE connections SET status = $1, updated_at = NOW() WHERE id = $2 AND receiver_id = $3 RETURNING *',
      ['accepted', req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const conn = result.rows[0];
    const io = getIO();

    // Mark original request notification as read for the accepting user
    await query(
      `UPDATE notifications SET read = TRUE
       WHERE user_id = $1 AND actor_id = $2 AND type = 'loco_request' AND entity_id = $3`,
      [req.userId, conn.requester_id, conn.id]
    );

    // Notify the requester that their request was accepted
    const notifResult = await query(
      `INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id)
       VALUES ($1, $2, 'loco_accepted', 'connection', $3) RETURNING *`,
      [conn.requester_id, req.userId, conn.id]
    );

    const actorResult = await query(
      'SELECT display_name, avatar_url FROM users WHERE id = $1',
      [req.userId]
    );

    io.to(conn.requester_id).emit('new_notification', {
      id: notifResult.rows[0].id,
      type: 'loco_accepted',
      actorName: actorResult.rows[0]?.display_name || 'Someone',
      actorAvatar: actorResult.rows[0]?.avatar_url || null,
      entityTitle: 'Loco request accepted',
      createdAt: notifResult.rows[0].created_at,
    });

    io.to(conn.requester_id).to(conn.receiver_id).emit('connection_accepted', {
      connectionId: conn.id,
      requesterId: conn.requester_id,
      receiverId: conn.receiver_id,
    });

    res.json({ connection: conn });
  } catch (error) {
    console.error('Accept connection error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id/reject', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'DELETE FROM connections WHERE id = $1 AND receiver_id = $2 RETURNING *',
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const conn = result.rows[0];
    const io = getIO();

    // Mark the request notification as read since the user acted on it
    await query(
      `UPDATE notifications SET read = TRUE
       WHERE user_id = $1 AND actor_id = $2 AND type = 'loco_request' AND entity_id = $3`,
      [req.userId, conn.requester_id, conn.id]
    );

    io.to(conn.requester_id).to(conn.receiver_id).emit('request_rejected', {
      connectionId: conn.id,
      requesterId: conn.requester_id,
      receiverId: conn.receiver_id,
    });

    res.json({ connection: conn });
  } catch (error) {
    console.error('Reject connection error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT c.*,
        CASE 
          WHEN c.requester_id = $1 THEN json_build_object('id', u2.id, 'display_name', u2.display_name, 'avatar_url', u2.avatar_url)
          ELSE json_build_object('id', u1.id, 'display_name', u1.display_name, 'avatar_url', u1.avatar_url)
        END as other_user
      FROM connections c
      JOIN users u1 ON c.requester_id = u1.id
      JOIN users u2 ON c.receiver_id = u2.id
      WHERE (c.requester_id = $1 OR c.receiver_id = $1) AND c.status = 'accepted'
      ORDER BY c.updated_at DESC`,
      [req.userId]
    );

    res.json({ connections: result.rows });
  } catch (error) {
    console.error('Get connections error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/requests', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT c.*,
        json_build_object('id', u.id, 'display_name', u.display_name, 'avatar_url', u.avatar_url) as requester
      FROM connections c
      JOIN users u ON c.requester_id = u.id
      WHERE c.receiver_id = $1 AND c.status = 'pending'
      ORDER BY c.created_at DESC`,
      [req.userId]
    );

    res.json({ requests: result.rows });
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/status/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId: otherUserId } = req.params;
    const result = await query(
      `SELECT status, requester_id, id FROM connections
       WHERE (requester_id = $1 AND receiver_id = $2)
          OR (requester_id = $2 AND receiver_id = $1)`,
      [req.userId, otherUserId]
    );

    if (result.rows.length === 0) return res.json({ status: 'none' });

    const row = result.rows[0];
    if (row.status === 'accepted') return res.json({ status: 'accepted' });

    const isOutgoing = row.requester_id === req.userId;
    return res.json({
      status: isOutgoing ? 'pending_outgoing' : 'pending_incoming',
      connectionId: row.id,
    });
  } catch (error) {
    console.error('Connection status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/sent', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT id, receiver_id FROM connections WHERE requester_id = $1 AND status = $2',
      [req.userId, 'pending']
    );
    res.json({ sent: result.rows });
  } catch (error) {
    console.error('Get sent requests error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'DELETE FROM connections WHERE id = $1 AND (requester_id = $2 OR receiver_id = $2) RETURNING *',
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const conn = result.rows[0];
    const io = getIO();
    io.to(conn.requester_id).to(conn.receiver_id).emit('connection_removed', {
      connectionId: conn.id,
      removedBy: req.userId,
      otherUserId: req.userId === conn.requester_id ? conn.receiver_id : conn.requester_id,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete connection error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
