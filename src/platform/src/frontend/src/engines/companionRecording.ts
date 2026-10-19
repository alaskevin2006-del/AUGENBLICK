export function pcmWav(samples: Float32Array, sampleRate: number): string {
  const bytes = new Uint8Array(44 + samples.length * 2), view = new DataView(bytes.buffer);
  const text = (at: number, value: string) => [...value].forEach((char, i) => bytes[at + i] = char.charCodeAt(0));
  text(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, samples.length * 2, true);
  samples.forEach((value, i) => view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, value)) * 32767), true));
  let binary = ''; for (let start = 0; start < bytes.length; start += 8192) binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
  return btoa(binary);
}

/** Local capture only; no browser speech-recognition or hosted API. */
export async function capture(referenceMs: number, onProgress: (remaining: number, speaking: boolean) => void, onDone: (answer: string) => void, onError: () => void, signal?: AbortSignal): Promise<() => void> {
  const stream = await navigator.mediaDevices.getUserMedia({audio: {channelCount: 1, echoCancellation: true, noiseSuppression: true}});
  if (signal?.aborted) {stream.getTracks().forEach(track => track.stop()); throw new Error('Recording cancelled');}
  let context: AudioContext;
  const abortBeforeResume = () => {stream.getTracks().forEach(track => track.stop()); if (context) void context.close();};
  signal?.addEventListener('abort', abortBeforeResume, {once: true});
  try { context = new AudioContext({ sampleRate: 16000 }); await context.resume(); }
  catch (error) {abortBeforeResume(); throw error; }
  finally {signal?.removeEventListener('abort', abortBeforeResume);}
  if (signal?.aborted) {stream.getTracks().forEach(track => track.stop()); void context.close(); throw new Error('Recording cancelled');}
  const source = context.createMediaStreamSource(stream), processor = context.createScriptProcessor(1024, 1, 1), silent = context.createGain();
  silent.gain.value = 0; source.connect(processor); processor.connect(silent); silent.connect(context.destination);
  const started = performance.now(), maxMs = Math.min(30000, referenceMs * 1.5);
  let onset: number | null = null, stopped = false, count = 0;
  const chunks: Float32Array[] = [];
  const cleanup = () => { if (stopped) return; stopped = true; signal?.removeEventListener('abort', cleanup); clearInterval(timer); processor.onaudioprocess = null; source.disconnect(); processor.disconnect(); silent.disconnect(); stream.getTracks().forEach(track => track.stop()); void context.close(); };
  const finish = () => {
    if (stopped) return;
    cleanup();
    if (!count) { onDone(JSON.stringify({noResponse: true})); return; }
    const samples = new Float32Array(count); let offset = 0;
    chunks.forEach(chunk => { samples.set(chunk, offset); offset += chunk.length; });
    onDone(JSON.stringify({audio: pcmWav(samples, context.sampleRate)}));
  };
  const timer = window.setInterval(() => {
    const now = performance.now(), remaining = onset === null ? 3000 - (now - started) : maxMs - (now - onset);
    onProgress(Math.max(0, remaining / 1000), onset !== null);
    if (remaining <= 0) finish();
  }, 50);
  processor.onaudioprocess = event => {
    if (stopped) return;
    const input = event.inputBuffer.getChannelData(0), rms = Math.sqrt(input.reduce((total, n) => total + n * n, 0) / input.length);
    if (onset === null && rms > .012) onset = performance.now();
    if (onset !== null) {
      const remaining = Math.floor(maxMs / 1000 * context.sampleRate) - count;
      if (remaining <= 0) { finish(); return; }
      const chunk = input.slice(0, remaining); chunks.push(chunk); count += chunk.length;
    }
  };
  stream.getAudioTracks().forEach(track => track.addEventListener('ended', () => { if (!stopped) { cleanup(); onError(); } }));
  signal?.addEventListener('abort', cleanup, {once: true});
  return cleanup;
}
