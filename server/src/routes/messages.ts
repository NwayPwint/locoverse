import { Router, Response } from 'express';
import multer from 'multer';
import { Readable } from 'stream';
import { query } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { getIO } from '../config/socket';
import cloudinary from '../config/cloudinary';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router = Router();

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'application/pdf'];

router.post('/upload', authMiddleware, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    if (!ALLOWED_TYPES.includes(req.file.mimetype)) {
      return res.status(400).json({ error: 'File type not allowed' });
    }

    const result = await new Promise<any>((resolve, reject) => {
      const resourceType = req.file!.mimetype.startsWith('audio/')
        ? 'video'
        : req.file!.mimetype.startsWith('image/')
          ? 'image'
          : 'raw';
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'locoverse', resource_type: resourceType },
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        }
      );
      const readable = new Readable();
      readable.push(req.file!.buffer);
      readable.push(null);
      readable.pipe(uploadStream);
    });

    res.json({
      url: result.secure_url,
      type: req.file.mimetype,
      name: req.file.originalname,
      publicId: result.public_id,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

router.get('/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { page = '1', limit = '50' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const blocked = await query(
      `SELECT 1 FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)`,
      [req.userId, req.params.userId]
    );
    if (blocked.rows.length > 0) {
      return res.status(403).json({ error: 'Cannot view messages with this user' });
    }

    const result = await query(
      `SELECT m.*,
        reply.content as reply_to_preview,
        reply.sender_id as reply_to_sender_id,
        fwd.content as forwarded_from_preview,
        fwd.sender_id as forwarded_from_sender_id
      FROM messages m
      LEFT JOIN messages reply ON m.reply_to_id = reply.id
      LEFT JOIN messages fwd ON m.forwarded_from_id = fwd.id
      WHERE ((m.sender_id = $1 AND m.receiver_id = $2) OR (m.sender_id = $2 AND m.receiver_id = $1))
      AND NOT ((m.sender_id = $1 AND m.deleted_for_sender) OR (m.receiver_id = $1 AND m.deleted_for_receiver))
      ORDER BY m.created_at DESC
      LIMIT $3 OFFSET $4`,
      [req.userId, req.params.userId, parseInt(limit as string), offset]
    );

    res.json({ messages: result.rows.reverse(), hasMore: result.rows.length === parseInt(limit as string) });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { receiverId, content, replyToId, attachmentUrl, attachmentType, attachmentName, attachmentPublicId } = req.body;
    if (!receiverId) return res.status(400).json({ error: 'receiverId required' });

    const safeContent = content ? String(content).slice(0, 5000) : '';
    if (!safeContent && !attachmentUrl) {
      return res.status(400).json({ error: 'Message content or attachment required' });
    }

    const blocked = await query(
      `SELECT 1 FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)`,
      [req.userId, receiverId]
    );
    if (blocked.rows.length > 0) {
      return res.status(403).json({ error: 'Cannot message this user' });
    }

    const connection = await query(
      `SELECT id FROM connections 
      WHERE ((requester_id = $1 AND receiver_id = $2) OR (requester_id = $2 AND receiver_id = $1))
      AND status = 'accepted'`,
      [req.userId, receiverId]
    );

    if (connection.rows.length === 0) {
      return res.status(403).json({ error: 'Must be connected to send messages' });
    }

    const result = await query(
      'INSERT INTO messages (sender_id, receiver_id, content, reply_to_id, attachment_url, attachment_type, attachment_name, attachment_public_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [req.userId, receiverId, safeContent, replyToId || null, attachmentUrl || null, attachmentType || null, attachmentName || null, attachmentPublicId || null]
    );

    const io = getIO();
    io.to(req.userId!).to(receiverId!).emit('receive_message', {
      ...result.rows[0],
      senderId: req.userId,
      receiverId,
      timestamp: result.rows[0].created_at,
    });

    res.status(201).json({ message: result.rows[0] });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/read', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { senderId } = req.body;

    await query(
      'UPDATE messages SET read = true WHERE sender_id = $1 AND receiver_id = $2 AND read = false',
      [senderId, req.userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id/edit', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { content } = req.body;

    const result = await query(
      `UPDATE messages SET content = $1, edited_at = NOW()
       WHERE id = $2 AND sender_id = $3 AND deleted_at IS NULL
       RETURNING *`,
      [content, req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found or not editable' });
    }

    const msg = result.rows[0];
    const io = getIO();
    io.to(msg.sender_id).to(msg.receiver_id).emit('message_edited', { messageId: msg.id, content: msg.content, editedAt: msg.edited_at });

    res.json({ message: msg });
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const scope = (req.query.scope as string) || 'me';

    const message = await query('SELECT * FROM messages WHERE id = $1', [req.params.id]);
    if (message.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const msg = message.rows[0];
    const isSender = msg.sender_id === req.userId;
    const isReceiver = msg.receiver_id === req.userId;

    if (!isSender && !isReceiver) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (scope === 'everyone' && !isSender) {
      return res.status(403).json({ error: 'Only the sender can delete for everyone' });
    }

    if (msg.attachment_public_id) {
      const resourceType = msg.attachment_type?.startsWith('audio/') ? 'video' : 'image';
      cloudinary.uploader.destroy(msg.attachment_public_id, { resource_type: resourceType }).catch(() => {});
    }

    if (scope === 'everyone') {
      await query('UPDATE messages SET deleted_at = NOW() WHERE id = $1', [req.params.id]);
      const io = getIO();
      io.to(msg.sender_id).to(msg.receiver_id).emit('message_deleted', { messageId: req.params.id });
    } else if (isSender) {
      await query('UPDATE messages SET deleted_for_sender = TRUE WHERE id = $1', [req.params.id]);
    } else {
      await query('UPDATE messages SET deleted_for_receiver = TRUE WHERE id = $1', [req.params.id]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/forward', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { messageId, receiverId } = req.body;
    if (!receiverId) return res.status(400).json({ error: 'receiverId required' });

    const original = await query(
      'SELECT * FROM messages WHERE id = $1 AND deleted_at IS NULL',
      [messageId]
    );

    if (original.rows.length === 0) {
      return res.status(404).json({ error: 'Original message not found' });
    }

    const connection = await query(
      `SELECT id FROM connections 
       WHERE ((requester_id = $1 AND receiver_id = $2) OR (requester_id = $2 AND receiver_id = $1))
       AND status = 'accepted'`,
      [req.userId, receiverId]
    );

    if (connection.rows.length === 0) {
      return res.status(403).json({ error: 'Must be connected to forward messages' });
    }

    const result = await query(
      'INSERT INTO messages (sender_id, receiver_id, content, forwarded_from_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.userId, receiverId, original.rows[0].content, messageId]
    );

    const io = getIO();
    io.to(req.userId!).to(receiverId!).emit('receive_message', {
      ...result.rows[0],
      senderId: req.userId!,
      receiverId: receiverId!,
      timestamp: result.rows[0].created_at,
    });

    res.status(201).json({ message: result.rows[0] });
  } catch (error) {
    console.error('Forward message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/conversations/list', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT
        m.other_user_id,
        m.last_message,
        m.last_message_at,
        COALESCE(uc.unread, 0) as unread_count
      FROM (
        SELECT DISTINCT ON (other_user_id)
          CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END as other_user_id,
          CASE 
            WHEN deleted_at IS NOT NULL THEN 'Deleted message'
            WHEN sender_id = $1 AND deleted_for_sender THEN 'Deleted message'
            WHEN receiver_id = $1 AND deleted_for_receiver THEN 'Deleted message'
            ELSE content 
          END as last_message,
          created_at as last_message_at
        FROM messages
        WHERE (sender_id = $1 OR receiver_id = $1)
          AND CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END NOT IN (
            SELECT blocked_id FROM blocks WHERE blocker_id = $1
          )
          AND CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END NOT IN (
            SELECT blocker_id FROM blocks WHERE blocked_id = $1
          )
        ORDER BY other_user_id, created_at DESC
      ) m
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int as unread
        FROM messages
        WHERE receiver_id = $1 AND read = false
          AND CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END = m.other_user_id
      ) uc ON true
      ORDER BY m.last_message_at DESC`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.json({ conversations: [] });
    }

    const userIds = result.rows.map(r => r.other_user_id);
    const usersResult = await query(
      'SELECT id, display_name, avatar_url FROM users WHERE id = ANY($1::uuid[])',
      [userIds]
    );
    const userMap = new Map(usersResult.rows.map(u => [u.id, u]));

    const conversations = result.rows.map(row => ({
      user: userMap.get(row.other_user_id) || null,
      lastMessage: row.last_message,
      lastMessageAt: row.last_message_at,
      unreadCount: row.unread_count,
    }));

    res.json({ conversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
