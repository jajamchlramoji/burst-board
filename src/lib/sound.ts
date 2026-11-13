/**
 * Small synthesized sounds. Nothing is loaded from disk or the network; each
 * sound is a few oscillators or a burst of filtered noise, kept quiet on purpose.
 */
let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let lastTick = 0;

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function noiseBuffer(ac: AudioContext): AudioBuffer {
  if (noise) return noise;
  const len = Math.floor(ac.sampleRate * 0.8);
  noise = ac.createBuffer(1, len, ac.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return noise;
}

/** Call from a click or keypress so later sounds are allowed to play. */
export function primeAudio(): void {
  audio();
}

/** One reel row passing the payline: a soft, short wooden click. */
export function tick(): void {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  if (now - lastTick < 0.045) return;
  lastTick = now;

  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  const band = ac.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 1900 + Math.random() * 500;
  band.Q.value = 6;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.09, now + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
  src.connect(band).connect(gain).connect(ac.destination);
  src.start(now, Math.random() * 0.5, 0.05);
}

/** The reel settling on the payline: a low, muted thock. */
export function land(locked: boolean): void {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(190, now);
  osc.frequency.exponentialRampToValueAtTime(95, now + 0.12);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.22, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  osc.connect(gain).connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.2);
  if (locked) chime(ac, now + 0.06, 0.04);
}

function chime(ac: AudioContext, at: number, level: number): void {
  for (const [freq, mult] of [
    [1318.5, 1],
    [1975.5, 0.55],
    [2637, 0.25],
  ] as const) {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(level * mult, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.1);
    osc.connect(gain).connect(ac.destination);
    osc.start(at);
    osc.stop(at + 1.2);
  }
}

/** Shipped: an airy rising swoosh that resolves into a soft bell. */
export function swoosh(): void {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;

  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  const band = ac.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 1.1;
  band.frequency.setValueAtTime(350, now);
  band.frequency.exponentialRampToValueAtTime(3400, now + 0.38);
  const air = ac.createBiquadFilter();
  air.type = 'highpass';
  air.frequency.value = 180;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.32, now + 0.16);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
  const pan = ac.createStereoPanner();
  pan.pan.setValueAtTime(-0.35, now);
  pan.pan.linearRampToValueAtTime(0.35, now + 0.5);
  src.connect(band).connect(air).connect(gain).connect(pan).connect(ac.destination);
  src.start(now, 0, 0.6);

  chime(ac, now + 0.3, 0.06);
}
