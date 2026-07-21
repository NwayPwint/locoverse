interface RecordingEntry {
  url: string;
  section: string;
  index: number;
}

function encodeWAV(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  const totalSamples = buffer.length;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = totalSamples * blockAlign;
  const headerSize = 44;
  const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < totalSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      const val = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, val, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export async function mixRecordings(
  recordings: RecordingEntry[],
  onProgress?: (current: number, total: number) => void,
): Promise<Blob> {
  if (recordings.length === 0) {
    throw new Error('No recordings to mix');
  }

  const ctx = new OfflineAudioContext({
    numberOfChannels: 2,
    sampleRate: 44100,
    length: 1,
  });

  const buffers: { buffer: AudioBuffer; entry: RecordingEntry }[] = [];

  for (let i = 0; i < recordings.length; i++) {
    onProgress?.(i + 1, recordings.length);
    const entry = recordings[i];
    const response = await fetch(entry.url);
    if (!response.ok) throw new Error(`Failed to fetch recording: ${entry.section} ${entry.index}`);
    const arrayBuf = await response.arrayBuffer();
    const audioBuf = await ctx.decodeAudioData(arrayBuf);
    buffers.push({ buffer: audioBuf, entry });
  }

  let totalDuration = 0;
  for (const { buffer } of buffers) {
    totalDuration += buffer.duration;
  }

  const mixCtx = new OfflineAudioContext({
    numberOfChannels: 2,
    sampleRate: 44100,
    length: Math.ceil((totalDuration + 0.5) * 44100),
  });

  let time = 0;
  for (const { buffer } of buffers) {
    const source = mixCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(mixCtx.destination);
    source.start(time);
    time += buffer.duration;
  }

  const mixed = await mixCtx.startRendering();
  return encodeWAV(mixed);
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
