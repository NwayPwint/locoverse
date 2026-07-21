import { Router, Response } from 'express';
import { query } from '../config/database';
import { env } from '../config/env';

const router = Router();

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

router.get('/song/:id', async (req, res: Response) => {
  try {
    const result = await query(
      `SELECT ss.*, u.display_name, u.avatar_url
       FROM shared_songs ss
       JOIN users u ON u.id = ss.user_id
       WHERE ss.id = $1 AND ss.visibility = 'public'`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send('<html><body style="font-family:sans-serif;text-align:center;padding:60px;color:#666;">Song not found</body></html>');
    }

    const row = result.rows[0];
    const title = escapeHtml(row.title || 'Untitled');
    const author = escapeHtml(row.display_name || 'Artist');
    const description = escapeHtml(row.description || '');
    const lyrics = escapeHtml(row.lyrics || '');
    const structure = (row.structure || []) as any[];
    const chords = structure
      .flatMap((s: any) => (s.chords || '').split(/\s+/).filter(Boolean))
      .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);
    const audioUrl = row.audio_url || '';
    const bpm = row.bpm || '';
    const timeSignature = row.time_signature || '';

    const chordColors: Record<string, string> = {
      C: '#fecaca', D: '#fed7aa', E: '#fef08a', F: '#bbf7d0',
      G: '#a7f3d0', A: '#bfdbfe', B: '#ddd6fe',
    };

    const chordHtml = chords.slice(0, 12).map((c: string) => {
      const root = c.replace(/[#bmM0-9]/g, '').charAt(0).toUpperCase();
      const bg = chordColors[root] || '#e5e7eb';
      return `<span style="display:inline-block;background:${bg};color:#1a1028;font-family:monospace;font-weight:bold;font-size:12px;padding:2px 8px;margin:2px;border-radius:3px;">${escapeHtml(c)}</span>`;
    }).join('');

    const sectionsHtml = structure.map((s: any) => {
      const sectionTitle = escapeHtml(`${s.section} ${(s.index || 0) + 1}`);
      const content = escapeHtml(s.content || '');
      const sectionChords = (s.chords || '').split(/\s+/).filter(Boolean);
      const scHtml = sectionChords.map((c: string) => {
        const root = c.replace(/[#bmM0-9]/g, '').charAt(0).toUpperCase();
        const bg = chordColors[root] || '#e5e7eb';
        return `<span style="display:inline-block;background:${bg};color:#1a1028;font-family:monospace;font-weight:bold;font-size:11px;padding:1px 6px;margin:1px;border-radius:2px;">${escapeHtml(c)}</span>`;
      }).join(' ');

      return `
        <div style="margin-bottom:16px;">
          <div style="font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:0.1em;color:#777696;margin-bottom:4px;">${sectionTitle}</div>
          ${scHtml ? `<div style="margin-bottom:6px;">${scHtml}</div>` : ''}
          <div style="font-size:13px;line-height:1.6;color:#e2dde6;white-space:pre-wrap;">${content}</div>
        </div>`;
    }).join('');

    const baseUrl = env.CLIENT_URL.replace(/\/$/, '');
    const songUrl = `${baseUrl}/shared-songs/${row.id}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - LocoVerse</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f0f1a;
      color: #e2dde6;
      min-height: 100vh;
    }
    .header {
      padding: 20px 24px;
      border-bottom: 1px solid #2a2a3d;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .header img { width: 32px; height: 32px; border-radius: 50%; }
    .header .brand { font-size: 14px; font-weight: bold; color: #7F2447; }
    .content { padding: 24px; max-width: 600px; margin: 0 auto; }
    .title { font-size: 24px; font-weight: bold; margin-bottom: 4px; }
    .author { font-size: 14px; color: #777696; margin-bottom: 16px; }
    .chips { margin-bottom: 16px; }
    .lyrics {
      font-size: 14px;
      line-height: 1.8;
      color: #c4b5d4;
      white-space: pre-wrap;
      margin-bottom: 24px;
    }
    .cta {
      display: block;
      text-align: center;
      padding: 14px;
      background: #7F2447;
      color: white;
      text-decoration: none;
      font-weight: bold;
      font-size: 14px;
      border-radius: 4px;
      margin-top: 24px;
    }
    .cta:hover { background: #6a1e3a; }
  </style>
</head>
<body>
  <div class="header">
    <span class="brand">LocoVerse</span>
  </div>
  <div class="content">
    <div class="title">${title}</div>
    <div class="author">by ${author}</div>
    ${bpm ? `<div style="font-size:11px;color:#777696;margin-bottom:12px;display:flex;gap:8px;"><span style="border:1px solid #2a2a3d;padding:2px 8px;">${escapeHtml(bpm.toString())} BPM</span>${timeSignature ? `<span style="border:1px solid #2a2a3d;padding:2px 8px;">${escapeHtml(timeSignature)}</span>` : ''}</div>` : ''}
    ${chordHtml ? `<div class="chips">${chordHtml}</div>` : ''}
    ${description ? `<p style="font-size:13px;color:#777696;margin-bottom:16px;">${description}</p>` : ''}
    ${lyrics ? `<div class="lyrics">${lyrics}</div>` : ''}
    ${sectionsHtml}
    <a class="cta" href="${songUrl}" target="_blank" rel="noopener">View on LocoVerse</a>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Embed error:', error);
    res.status(500).send('<html><body style="font-family:sans-serif;text-align:center;padding:60px;color:#666;">Something went wrong</body></html>');
  }
});

export default router;
