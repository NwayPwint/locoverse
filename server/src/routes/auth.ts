import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { body } from 'express-validator';
import { Resend } from 'resend';
import { OAuth2Client } from 'google-auth-library';
import { query } from '../config/database';
import { env } from '../config/env';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { setAuthCookie, clearAuthCookie } from '../utils/authCookie';

const router = Router();
const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);
const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = (req.body?.email as string | undefined)?.toLowerCase();
    if (email) return email;
    return ipKeyGenerator(req.ip || '');
  },
});

function issueToken(userId: string): string {
  return jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: '7d' });
}

router.post(
  '/register',
  validate([
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/[a-zA-Z]/).withMessage('Password must contain at least one letter')
      .matches(/[0-9]/).withMessage('Password must contain at least one number'),
    body('displayName').trim().isLength({ min: 1, max: 100 }).withMessage('Display name required'),
  ]),
  async (req: Request, res: Response) => {
    try {
      const { email, password, displayName } = req.body;

      const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: 'Email already registered' });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const result = await query(
        'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, email, display_name',
        [email, passwordHash, displayName]
      );

      const user = result.rows[0];
      const token = issueToken(user.id);
      setAuthCookie(res, token);

      res.status(201).json({ user: { id: user.id, email: user.email, displayName: user.display_name } });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.post(
  '/login',
  loginLimiter,
  validate([
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
  ]),
  async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      const result = await query('SELECT * FROM users WHERE email = $1', [email]);
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const user = result.rows[0];
      if (!user.password_hash) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const token = issueToken(user.id);
      setAuthCookie(res, token);

      res.json({
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          avatarUrl: user.avatar_url,
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.post(
  '/google',
  validate([body('credential').notEmpty().withMessage('Credential is required')]),
  async (req: Request, res: Response) => {
    try {
      const { credential } = req.body;

      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        return res.status(400).json({ error: 'Invalid Google credential' });
      }

      const googleId = payload.sub;
      const email = payload.email;
      const displayName = payload.name || email.split('@')[0];
      const avatarUrl = payload.picture || null;

      let userResult = await query(
        'SELECT * FROM users WHERE oauth_provider = $1 AND oauth_id = $2',
        ['google', googleId]
      );

      let user;

      if (userResult.rows.length > 0) {
        user = userResult.rows[0];
        await query(
          'UPDATE users SET display_name = $1, avatar_url = $2, updated_at = NOW() WHERE id = $3',
          [displayName, avatarUrl, user.id]
        );
      } else {
        const existingEmailUser = await query('SELECT * FROM users WHERE email = $1', [email]);

        if (existingEmailUser.rows.length > 0) {
          user = existingEmailUser.rows[0];
          await query(
            'UPDATE users SET oauth_provider = $1, oauth_id = $2, avatar_url = COALESCE($3, avatar_url), updated_at = NOW() WHERE id = $4',
            ['google', googleId, avatarUrl, user.id]
          );
        } else {
          const result = await query(
            `INSERT INTO users (email, display_name, avatar_url, oauth_provider, oauth_id)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
            [email, displayName, avatarUrl, 'google', googleId]
          );
          user = result.rows[0];
        }
      }

      const token = issueToken(user.id);
      setAuthCookie(res, token);

      res.json({
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          avatarUrl: user.avatar_url,
        },
      });
    } catch (error) {
      console.error('Google auth error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.post('/logout', (_req: Request, res: Response) => {
  clearAuthCookie(res);
  res.json({ success: true });
});

router.post(
  '/forgot-password',
  validate([body('email').isEmail().normalizeEmail().withMessage('Valid email required')]),
  async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      const userResult = await query('SELECT id, email, display_name FROM users WHERE email = $1', [email]);
      if (userResult.rows.length === 0) {
        return res.json({ message: 'If that email is registered, you will receive a password reset link.' });
      }

      const user = userResult.rows[0];
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await query(
        'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [user.id, resetToken, expiresAt]
      );

      const resetUrl = `${env.CLIENT_URL}/reset-password?token=${resetToken}`;

      if (resend) {
        await resend.emails.send({
          from: 'LocoVerse <onboarding@resend.dev>',
          to: user.email,
          subject: 'LocoVerse - Password Reset',
          html: `<p>Hi ${user.display_name},</p>
<p>Click the link below to reset your password:</p>
<p><a href="${resetUrl}">${resetUrl}</a></p>
<p>This link expires in 1 hour.</p>
<p>If you didn't request this, ignore this email.</p>`,
        });
      } else {
        console.log('Password reset link:', resetUrl);
      }

      res.json({ message: 'If that email is registered, you will receive a password reset link.' });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.post(
  '/reset-password',
  validate([
    body('token').notEmpty().withMessage('Token is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ]),
  async (req: Request, res: Response) => {
    try {
      const { token, password } = req.body;

      const tokenResult = await query(
        `SELECT * FROM password_reset_tokens 
       WHERE token = $1 AND used = FALSE AND expires_at > NOW()`,
        [token]
      );

      if (tokenResult.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      const resetRecord = tokenResult.rows[0];
      const passwordHash = await bcrypt.hash(password, 10);

      await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
        passwordHash,
        resetRecord.user_id,
      ]);

      await query('UPDATE password_reset_tokens SET used = TRUE WHERE id = $1', [resetRecord.id]);

      res.json({ message: 'Password reset successful. You can now login with your new password.' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT u.*, 
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

    const user = result.rows[0];
    res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        bio: user.bio,
        lookingFor: user.looking_for,
        skills: user.skills,
        vibes: user.vibes,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
