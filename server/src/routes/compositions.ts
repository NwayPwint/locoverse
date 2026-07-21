import { Router, Response } from 'express';
import multer from 'multer';
import { Readable } from 'stream';
import { query } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { env } from '../config/env';

import { GoogleGenerativeAI } from '@google/generative-ai';
import cloudinary from '../config/cloudinary';

const router = Router();

const VALID_TIME_SIGNATURES = ['2/4', '3/4', '4/4', '5/4', '6/8', '7/8'];
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function mapComposition(row: any) {
  return {
    ...row,
    timeSignature: row.time_signature,
    time_signature: undefined,
  };
}

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM compositions WHERE user_id = $1 ORDER BY updated_at DESC`,
      [req.userId]
    );
    res.json({ compositions: result.rows.map(mapComposition) });
  } catch (error) {
    console.error('Get compositions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM compositions WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Composition not found' });
    }
    res.json({ composition: mapComposition(result.rows[0]) });
  } catch (error) {
    console.error('Get composition error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { title, lyrics, structure, bpm, timeSignature } = req.body;
    const safeTitle = String(title || 'Untitled').slice(0, 200);
    const safeLyrics = String(lyrics || '').slice(0, 50000);
    const safeStructure = Array.isArray(structure) ? structure.slice(0, 50) : [];
    const safeBpm = typeof bpm === 'number' ? Math.max(30, Math.min(300, Math.round(bpm))) : 120;
    
    const safeTimeSignature = VALID_TIME_SIGNATURES.includes(timeSignature) ? timeSignature : '4/4';

    const result = await query(
      'INSERT INTO compositions (user_id, title, lyrics, structure, bpm, time_signature) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.userId, safeTitle, safeLyrics, JSON.stringify(safeStructure), safeBpm, safeTimeSignature]
    );
    res.status(201).json({ composition: mapComposition(result.rows[0]) });
  } catch (error) {
    console.error('Create composition error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { title, lyrics, structure, bpm, timeSignature } = req.body;
    const safeTitle = title !== undefined ? String(title).slice(0, 200) : null;
    const safeLyrics = lyrics !== undefined ? String(lyrics).slice(0, 50000) : null;
    const safeStructure = structure !== undefined && Array.isArray(structure) ? structure.slice(0, 50) : null;
    const safeBpm = bpm !== undefined && typeof bpm === 'number' ? Math.max(30, Math.min(300, Math.round(bpm))) : null;
    
    const safeTimeSignature = timeSignature !== undefined && VALID_TIME_SIGNATURES.includes(timeSignature) ? timeSignature : null;

    const result = await query(
      `UPDATE compositions SET title = COALESCE($1, title), lyrics = COALESCE($2, lyrics), structure = COALESCE($3, structure), bpm = COALESCE($4, bpm), time_signature = COALESCE($5, time_signature), updated_at = NOW()
       WHERE id = $6 AND user_id = $7 RETURNING *`,
      [safeTitle, safeLyrics, safeStructure ? JSON.stringify(safeStructure) : null, safeBpm, safeTimeSignature, req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Composition not found' });
    }

    res.json({ composition: mapComposition(result.rows[0]) });
  } catch (error) {
    console.error('Update composition error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/delete-audio', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { publicId } = req.body;
    if (!publicId) {
      return res.status(400).json({ error: 'No publicId provided' });
    }

    const owned = await query(
      `SELECT id FROM compositions WHERE user_id = $1 AND structure @> $2::jsonb LIMIT 1`,
      [req.userId, JSON.stringify([{ recordingPublicId: publicId }])]
    );
    if (owned.rows.length === 0) {
      return res.status(403).json({ error: 'You do not own this audio' });
    }

    await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
    console.log('Deleted audio from Cloudinary:', publicId);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete audio error:', error);
    res.status(500).json({ error: 'Delete failed' });
  }
});

async function deleteCompositionRecordings(structure: any[]) {
  if (!Array.isArray(structure)) return;
  for (const item of structure) {
    if (item.recordingPublicId) {
      try {
        await cloudinary.uploader.destroy(item.recordingPublicId, { resource_type: 'video' });
        console.log('Deleted recording from Cloudinary:', item.recordingPublicId);
      } catch (err) {
        console.error('Failed to delete recording:', item.recordingPublicId, err);
      }
    }
  }
}

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await query('SELECT structure FROM compositions WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Composition not found' });
    }
    await deleteCompositionRecordings(existing.rows[0].structure);
    await query('DELETE FROM compositions WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete composition error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/upload-audio', authMiddleware, upload.single('audio'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const allowedMimes = ['audio/wav', 'audio/wave', 'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/mp4', 'audio/m4a', 'audio/webm', 'image/png'];
    if (!allowedMimes.includes(req.file.mimetype)) {
      return res.status(400).json({ error: 'Invalid file type. Allowed: wav, mp3, ogg, m4a, webm, png' });
    }

    const resourceType = req.file!.mimetype.startsWith('audio/') ? 'video' : 'raw';

    const result = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'locoverse/recordings', resource_type: resourceType },
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

    console.log('Upload audio OK:', result.secure_url);
    res.json({ url: result.secure_url, publicId: result.public_id });
  } catch (error) {
    console.error('Upload audio error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

router.post('/suggest-chords', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { key, genre, mood } = req.body;
    if (!key || !genre || !mood) {
      return res.status(400).json({ error: 'key, genre, and mood are required' });
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
      },
      systemInstruction: 'You are a music theory expert and songwriter. Generate chord progressions that sound great for the given style. Return ONLY valid JSON: { "chords": ["Chord1", "Chord2", ...] }. Use standard chord notation (e.g. Am, F, C, G, Dm7). Return 4 to 8 chords.',
    });

    const result = await model.generateContent(
      `Suggest a chord progression in the key of ${key}. Genre: ${genre}. Mood: ${mood}. Return 4-8 chords that work well together.`
    );
    const text = result.response.text();
    const parsed = JSON.parse(text);

    if (!Array.isArray(parsed.chords)) {
      return res.status(500).json({ error: 'Invalid AI response format' });
    }

    res.json({ chords: parsed.chords });
  } catch (error: any) {
    const msg = error?.message || '';
    if (msg.includes('User location is not supported')) {
      return res.status(400).json({
        error: 'REGION_BLOCKED',
        message: 'AI generation is not available in your region. Please use a VPN and try again.',
      });
    }
    console.error('Suggest chords error:', error);
    res.status(500).json({ error: 'AI generation failed' });
  }
});

router.post('/generate-lyrics', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { prompt, style = 'pop', language = 'English', structure = ['verse', 'chorus', 'verse', 'chorus', 'bridge', 'chorus'] } = req.body;

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
      },
      systemInstruction: 'You are a professional songwriter and lyricist. Write original, creative song lyrics based on the user\'s prompt. Return ONLY valid JSON with a "structure" array where each item has "section" (verse, chorus, bridge, intro, outro) and "content" (the lyrics for that section). Make the lyrics feel authentic and well-structured.',
    });

    const result = await model.generateContent(`Write song lyrics in "${language}". Style: "${style}". Structure: ${structure.join(', ')}. Theme/prompt: ${prompt}`);
    const text = result.response.text();
    const generated = JSON.parse(text);
    const fullLyrics = generated.structure?.map((s: any) => s.content).join('\n\n') || '';

    res.json({
      lyrics: fullLyrics,
      structure: generated.structure || [],
    });
  } catch (error: any) {
    const msg = error?.message || '';
    if (msg.includes('User location is not supported')) {
      return res.status(400).json({
        error: 'REGION_BLOCKED',
        message: 'AI generation is not available in your region. Please use a VPN and try again.',
      });
    }
    console.error('Generate lyrics error:', error);
    res.status(500).json({ error: 'AI generation failed' });
  }
});

export default router;
