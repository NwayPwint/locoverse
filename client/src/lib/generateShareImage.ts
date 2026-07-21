const WIDTH = 1200;
const HEIGHT = 630;

const chordColors: Record<string, string> = {
  C: '#fecaca', D: '#fed7aa', E: '#fef08a', F: '#bbf7d0',
  G: '#a7f3d0', A: '#bfdbfe', B: '#ddd6fe',
};

function chordBg(chord: string): string {
  const root = chord.replace(/[#bmM0-9]/g, '').charAt(0).toUpperCase();
  return chordColors[root] || '#e5e7eb';
}

function chordFg(chord: string): string {
  const root = chord.replace(/[#bmM0-9]/g, '').charAt(0).toUpperCase();
  const map: Record<string, string> = {
    C: '#991b1b', D: '#9a3412', E: '#854d0e', F: '#166534',
    G: '#065f46', A: '#1e40af', B: '#5b21b6',
  };
  return map[root] || '#374151';
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function generateShareImage(
  title: string,
  authorName: string,
  lyrics: string,
  chords: string[],
): Promise<Blob> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    grad.addColorStop(0, '#1a1028');
    grad.addColorStop(0.5, '#2d1b3d');
    grad.addColorStop(1, '#0f0f1a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(
        Math.random() * WIDTH,
        Math.random() * HEIGHT,
        40 + Math.random() * 80,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = `rgba(127, 36, 71, ${0.04 + Math.random() * 0.06})`;
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(60, 60, WIDTH - 120, HEIGHT - 120);
    ctx.strokeStyle = 'rgba(127, 36, 71, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(60, 60, WIDTH - 120, HEIGHT - 120);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'center';
    const titleLines = wrapText(ctx, title || 'Untitled', WIDTH - 200);
    const titleY = 140;
    titleLines.forEach((line, i) => {
      ctx.fillText(line, WIDTH / 2, titleY + i * 64);
    });

    ctx.fillStyle = '#c4b5d4';
    ctx.font = '24px sans-serif';
    ctx.fillText(`by ${authorName}`, WIDTH / 2, titleY + titleLines.length * 64 + 20);

    if (chords.length > 0) {
      const chipH = 36;
      const chipPad = 12;
      ctx.font = 'bold 18px monospace';
      const chipWidths = chords.map((c) => ctx.measureText(c).width + chipPad * 2);
      const totalChipsW = chipWidths.reduce((a, b) => a + b, 0) + (chords.length - 1) * 8;
      let cx = (WIDTH - totalChipsW) / 2;
      const cy = titleY + titleLines.length * 64 + 60;

      chords.slice(0, 12).forEach((chord, i) => {
        const w = chipWidths[i];
        ctx.fillStyle = chordBg(chord);
        ctx.beginPath();
        ctx.roundRect(cx, cy, w, chipH, 4);
        ctx.fill();
        ctx.fillStyle = chordFg(chord);
        ctx.textAlign = 'center';
        ctx.fillText(chord, cx + w / 2, cy + 24);
        cx += w + 8;
      });
    }

    if (lyrics) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      const excerpt = lyrics.length > 200 ? lyrics.slice(0, 200) + '...' : lyrics;
      const lyricLines = wrapText(ctx, excerpt, WIDTH - 240);
      const maxLines = 5;
      const startY = HEIGHT - 160;
      lyricLines.slice(0, maxLines).forEach((line, i) => {
        ctx.fillText(line, WIDTH / 2, startY + i * 28);
      });
    }

    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('LocoVerse', WIDTH - 80, HEIGHT - 80);

    canvas.toBlob((blob) => {
      resolve(blob!);
    }, 'image/png');
  });
}
