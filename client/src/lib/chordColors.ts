export const chordColors: Record<string, string> = {
  C: 'bg-red-100 text-red-700 border-red-200',
  D: 'bg-orange-100 text-orange-700 border-orange-200',
  E: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  F: 'bg-green-100 text-green-700 border-green-200',
  G: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  A: 'bg-blue-100 text-blue-700 border-blue-200',
  B: 'bg-purple-100 text-purple-700 border-purple-200',
};

export function chordColor(chord: string): string {
  const root = chord.replace(/[#bmM0-9]/g, '').charAt(0).toUpperCase();
  return chordColors[root] || 'bg-gray-100 text-gray-700 border-gray-200';
}