let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function midiToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

const NOTE_MAP: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3,
  E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8,
  Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};

function noteToMidi(noteName: string): number {
  const match = noteName.match(/^([A-G][#b]?)(\d)$/);
  if (!match) return 60;
  const octave = parseInt(match[2]);
  return (octave + 1) * 12 + (NOTE_MAP[match[1]] || 0);
}

function rootToMidi(root: string, octave = 4): number {
  return (octave + 1) * 12 + (NOTE_MAP[root] || 0);
}

function parseChord(chordName: string): number[] {
  const match = chordName.match(/^([A-G][#b]?)(.*)$/);
  if (!match) return [];
  const root = match[1];
  const suffix = match[2].toLowerCase().replace(/[^a-z0-9+]/g, '');
  const rootMidi = rootToMidi(root, 3);

  let intervals: number[];
  if (!suffix || suffix === 'maj') intervals = [0, 4, 7];
  else if (suffix === 'm' || suffix === 'min') intervals = [0, 3, 7];
  else if (suffix === 'dim') intervals = [0, 3, 6];
  else if (suffix === 'aug' || suffix === '+') intervals = [0, 4, 8];
  else if (suffix === '7') intervals = [0, 4, 7, 10];
  else if (suffix === 'maj7' || suffix === 'δ7' || suffix === 'ma7') intervals = [0, 4, 7, 11];
  else if (suffix === 'm7' || suffix === 'min7') intervals = [0, 3, 7, 10];
  else if (suffix === 'dim7') intervals = [0, 3, 6, 9];
  else if (suffix === 'm7b5' || suffix === 'ø') intervals = [0, 3, 6, 10];
  else if (suffix === 'sus2') intervals = [0, 2, 7];
  else if (suffix === 'sus4') intervals = [0, 5, 7];
  else if (suffix === '6') intervals = [0, 4, 7, 9];
  else if (suffix === 'm6') intervals = [0, 3, 7, 9];
  else if (suffix === '9') intervals = [0, 4, 7, 10, 14];
  else intervals = [0, 4, 7];

  return intervals.map(i => rootMidi + i);
}


export function playChord(chordName: string, duration = 2) {
  const notes = parseChord(chordName);
  if (notes.length === 0) return;
  const ctx = getCtx();
  const now = ctx.currentTime;
  notes.forEach((midi, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const t = now + i * 0.025;
    osc.frequency.setValueAtTime(midiToFreq(midi), t);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(now + duration);
  });
}

export function stopAll() {
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
  }
}

export function playMidi(midi: number, duration = 0.6) {
  const ctx = getCtx();
  const freq = midiToFreq(midi);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

// --- ABC notation player (oscillator-based, no SoundFont) ---

interface AbcEvent {
  midi: number;
  duration: number; // in seconds
}

const ABC_PITCH_MAP: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

function parseAbc(abc: string): AbcEvent[] {
  const events: AbcEvent[] = [];
  const tokens = abc.replace(/\|/g, ' ').trim().split(/\s+/).filter(Boolean);
  const beatDuration = 0.5; // seconds per beat at 120 BPM

  for (const token of tokens) {
    let i = 0;
    let sharp = 0;
    let flat = 0;
    let octave = 4;
    let length = 1; // in beats (1 = quarter note)

    // accidentals
    while (i < token.length && (token[i] === '^' || token[i] === '_')) {
      if (token[i] === '^') sharp++;
      else flat++;
      i++;
    }

    // note letter
    if (i >= token.length) continue;
    const letter = token[i];
    if (letter === 'z' || letter === 'Z') {
      // rest
      i++;
      let numStr = '';
      while (i < token.length && /\d/.test(token[i])) { numStr += token[i]; i++; }
      if (numStr) length = 4 / parseInt(numStr); // C2 = half (2 beats), C4 = quarter (1), C8 = eighth (0.5)
      events.push({ midi: -1, duration: beatDuration * length });
      continue;
    }
    if (!ABC_PITCH_MAP.hasOwnProperty(letter)) continue;
    const isLowercase = letter === letter.toLowerCase();
    const semitone = ABC_PITCH_MAP[letter.toUpperCase()];
    i++;

    if (isLowercase) octave = 5;

    // comma (down octave) or apostrophe (up octave)
    while (i < token.length && token[i] === ',') { octave--; i++; }
    while (i < token.length && token[i] === '\'') { octave++; i++; }

    // note length
    let numStr = '';
    while (i < token.length && /\d/.test(token[i])) { numStr += token[i]; i++; }
    if (numStr) length = 4 / parseInt(numStr);

    const midi = (octave + 1) * 12 + semitone + sharp - flat;
    events.push({ midi, duration: beatDuration * length });
  }

  return events;
}

export function playAbc(abc: string, bpm = 120): { stop: () => void } {
  const events = parseAbc(abc);
  if (events.length === 0) return { stop: () => {} };

  const ctx = getCtx();
  const ctxNow = ctx.currentTime;
  const activeOscs: OscillatorNode[] = [];
  let offset = 0;

  for (const ev of events) {
    const start = ctxNow + offset;
    const dur = ev.duration * (60 / bpm) / 0.5; // scale by bpm relative to 120

    if (ev.midi >= 0) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(midiToFreq(ev.midi), start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur - 0.01);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur);
      activeOscs.push(osc);
    }

    offset += dur;
  }

  return {
    stop: () => {
      activeOscs.forEach(o => { try { o.stop(); } catch {} });
      activeOscs.length = 0;
    },
  };
}
