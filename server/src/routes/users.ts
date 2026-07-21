import { Router, Request, Response } from 'express';
import multer from 'multer';
import { Readable } from 'stream';
import { body } from 'express-validator';
import { query } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import cloudinary from '../config/cloudinary';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { skills, vibes, looking_for, search, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let queryText = `
      SELECT u.id, u.display_name, u.avatar_url, u.bio, u.looking_for, u.created_at,
        (SELECT COUNT(*)::int FROM shared_songs ss WHERE ss.user_id = u.id) AS song_count,
        (SELECT COUNT(*)::int FROM posts p WHERE p.user_id = u.id) AS post_count,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', s.id, 'name', s.name, 'category', s.category)) FILTER (WHERE s.id IS NOT NULL), '[]') as skills,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', v.id, 'name', v.name)) FILTER (WHERE v.id IS NOT NULL), '[]') as vibes
      FROM users u
      LEFT JOIN user_skills us ON u.id = us.user_id
      LEFT JOIN skills s ON us.skill_id = s.id
      LEFT JOIN user_vibes uv ON u.id = uv.user_id
      LEFT JOIN vibes v ON uv.vibe_id = v.id
      WHERE u.id != $1
        AND u.id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = $1)
        AND u.id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_id = $1)
    `;
    const params: unknown[] = [req.userId];
    let paramIndex = 2;

    if (skills && Array.isArray(skills)) {
      queryText += ` AND EXISTS (SELECT 1 FROM user_skills us2 JOIN skills s2 ON us2.skill_id = s2.id WHERE us2.user_id = u.id AND s2.name = ANY($${paramIndex}))`;
      params.push(skills);
      paramIndex++;
    }

    if (vibes && Array.isArray(vibes)) {
      queryText += ` AND EXISTS (SELECT 1 FROM user_vibes uv2 JOIN vibes v2 ON uv2.vibe_id = v2.id WHERE uv2.user_id = u.id AND v2.name = ANY($${paramIndex}))`;
      params.push(vibes);
      paramIndex++;
    }

    if (looking_for) {
      queryText += ` AND u.looking_for = $${paramIndex}`;
      params.push(looking_for);
      paramIndex++;
    }

    if (search) {
      queryText += ` AND (u.display_name ILIKE $${paramIndex} OR u.bio ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    queryText += ` GROUP BY u.id ORDER BY u.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit as string), offset);

    const limitNum = parseInt(limit as string);
    const result = await query(queryText, params);

    res.json({
      users: result.rows,
      hasMore: result.rows.length === limitNum,
      page: parseInt(page as string),
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.display_name, u.avatar_url, u.bio, u.looking_for,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', s.id, 'name', s.name, 'category', s.category)) FILTER (WHERE s.id IS NOT NULL), '[]') as skills,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', v.id, 'name', v.name)) FILTER (WHERE v.id IS NOT NULL), '[]') as vibes
      FROM users u
      LEFT JOIN user_skills us ON u.id = us.user_id
      LEFT JOIN skills s ON us.skill_id = s.id
      LEFT JOIN user_vibes uv ON u.id = uv.user_id
      LEFT JOIN vibes v ON uv.vibe_id = v.id
      WHERE u.id = $1
      GROUP BY u.id`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const row = result.rows[0];
    res.json({
      user: {
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        bio: row.bio,
        lookingFor: row.looking_for,
        skills: row.skills,
        vibes: row.vibes,
      },
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT u.id, u.display_name, u.avatar_url, u.bio, u.looking_for,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', s.id, 'name', s.name, 'category', s.category)) FILTER (WHERE s.id IS NOT NULL), '[]') as skills,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', v.id, 'name', v.name)) FILTER (WHERE v.id IS NOT NULL), '[]') as vibes
      FROM users u
      LEFT JOIN user_skills us ON u.id = us.user_id
      LEFT JOIN skills s ON us.skill_id = s.id
      LEFT JOIN user_vibes uv ON u.id = uv.user_id
      LEFT JOIN vibes v ON uv.vibe_id = v.id
      WHERE u.id = $1
      GROUP BY u.id`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put(
  '/me',
  authMiddleware,
  validate([
    body('displayName').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Display name must be 1-100 characters'),
    body('bio').optional().isLength({ max: 500 }).withMessage('Bio must be under 500 characters'),
    body('lookingFor').optional({ values: 'falsy' }).isIn(['band_members', 'jam_partner', 'feedback_buddy', 'exploring']),
  ]),
  async (req: AuthRequest, res: Response) => {
  try {
    const { displayName, bio, lookingFor } = req.body;

    const result = await query(
      `UPDATE users SET 
        display_name = COALESCE($1, display_name),
        bio = COALESCE($2, bio),
        looking_for = COALESCE($3, looking_for),
        updated_at = NOW()
      WHERE id = $4
      RETURNING id, email, display_name, avatar_url, bio, looking_for`,
      [displayName, bio, lookingFor, req.userId]
    );

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
  }
);

router.post('/me/avatar', authMiddleware, upload.single('avatar'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image provided' });
    }
    if (!AVATAR_TYPES.includes(req.file.mimetype)) {
      return res.status(400).json({ error: 'Only JPEG, PNG, GIF, or WebP images are allowed' });
    }

    const result = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'locoverse/avatars', resource_type: 'image', transformation: [{ width: 400, height: 400, crop: 'fill' }] },
        (err, uploadResult) => {
          if (err) reject(err);
          else resolve(uploadResult);
        }
      );
      const readable = new Readable();
      readable.push(req.file!.buffer);
      readable.push(null);
      readable.pipe(uploadStream);
    });

    const avatarUrl = result.secure_url;
    const updated = await query(
      'UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, display_name, avatar_url, bio, looking_for',
      [avatarUrl, req.userId]
    );

    res.json({ user: updated.rows[0], avatarUrl });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ error: 'Avatar upload failed' });
  }
});

router.put('/me/skills', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { skillIds } = req.body;

    await query('DELETE FROM user_skills WHERE user_id = $1', [req.userId]);

    if (skillIds && skillIds.length > 0) {
      const values = skillIds.map((id: number, index: number) => `($1, $${index + 2})`).join(',');
      await query(`INSERT INTO user_skills (user_id, skill_id) VALUES ${values}`, [req.userId, ...skillIds]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update skills error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/me/vibes', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { vibeIds } = req.body;

    await query('DELETE FROM user_vibes WHERE user_id = $1', [req.userId]);

    if (vibeIds && vibeIds.length > 0) {
      const values = vibeIds.map((id: number, index: number) => `($1, $${index + 2})`).join(',');
      await query(`INSERT INTO user_vibes (user_id, vibe_id) VALUES ${values}`, [req.userId, ...vibeIds]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update vibes error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id/activity', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT type, title, created_at, entity_id FROM (
        SELECT 'song' AS type, ss.title, ss.created_at, ss.id::text AS entity_id
        FROM shared_songs ss WHERE ss.user_id = $1 AND ss.visibility = 'public'
        UNION ALL
        SELECT 'post' AS type, p.title, p.created_at, p.id::text AS entity_id
        FROM posts p WHERE p.user_id = $1 AND p.visibility = 'public'
        UNION ALL
        SELECT 'article' AS type, a.title, a.created_at, a.id::text AS entity_id
        FROM articles a WHERE a.user_id = $1 AND a.is_published = true
      ) AS activity
      ORDER BY created_at DESC
      LIMIT 20`,
      [id]
    );
    res.json({ activity: result.rows });
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
