export interface ChordPreset {
  name: string;
  description: string;
  chords: string[];
  key: 'major' | 'minor' | 'blues' | 'other';
}

export const chordPresets: ChordPreset[] = [
  { name: 'Pop', description: 'I - V - vi - IV', chords: ['C', 'G', 'Am', 'F'], key: 'major' },
  { name: 'Rock', description: 'I - IV - V', chords: ['C', 'F', 'G'], key: 'major' },
  { name: 'Sad', description: 'vi - IV - I - V', chords: ['Am', 'F', 'C', 'G'], key: 'minor' },
  { name: '50s', description: 'I - vi - IV - V', chords: ['C', 'Am', 'F', 'G'], key: 'major' },
  { name: 'Hero', description: 'V - vi - IV - I', chords: ['G', 'Am', 'F', 'C'], key: 'major' },
  { name: 'Warm', description: 'I - V - ii - IV', chords: ['C', 'G', 'Dm', 'F'], key: 'major' },
  { name: 'Minor Rock', description: 'i - VII - VI - V', chords: ['Am', 'G', 'F', 'E'], key: 'minor' },
  { name: 'Minor Pop', description: 'i - iv - VII - VI', chords: ['Am', 'Dm', 'G', 'F'], key: 'minor' },
  { name: 'Moody', description: 'iv - i - VII - VI', chords: ['Dm', 'Am', 'G', 'F'], key: 'minor' },
  { name: '12-Bar Blues', description: 'I - I - I - I - IV - IV - I - I - V - IV - I - V',
    chords: ['C7', 'C7', 'C7', 'C7', 'F7', 'F7', 'C7', 'C7', 'G7', 'F7', 'C7', 'G7'], key: 'blues' },
  { name: 'Doo-Wop', description: 'I - vi - ii - V', chords: ['C', 'Am', 'Dm', 'G'], key: 'major' },
  { name: 'Folk', description: 'I - V - vi - ii', chords: ['C', 'G', 'Am', 'Dm'], key: 'major' },
  { name: 'Dream Pop', description: 'I - III - IV - V', chords: ['C', 'E', 'F', 'G'], key: 'major' },
  { name: 'Neo Soul', description: 'ii - V - I - IV', chords: ['Dm', 'G', 'C', 'F'], key: 'major' },
  { name: 'Emo', description: 'VI - VII - i - VII', chords: ['F', 'G', 'Am', 'G'], key: 'minor' },
];
