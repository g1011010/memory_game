// Tiny WebAudio synth: soft chimes, no assets. Off until the person opts in.
let ctx: AudioContext | null = null;
let enabled = false;

export const setSound = (on: boolean) => {
  enabled = on;
  if (on && !ctx) ctx = new AudioContext();
  if (on && ctx?.state === 'suspended') void ctx.resume();
};

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];

const tone = (freq: number, at: number, dur: number, gain = 0.08) => {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(ctx.destination);
  o.start(at);
  o.stop(at + dur + 0.05);
};

export const chime = (kind: 'open' | 'release' | 'resonate' | 'tick' | 'capsule' = 'open', root = 0) => {
  if (!enabled || !ctx) return;
  const t = ctx.currentTime;
  const base = 392 * Math.pow(2, root / 12);
  const note = (i: number) => base * Math.pow(2, PENTA[i % PENTA.length] / 12);
  switch (kind) {
    case 'tick':
      tone(note(4) * 2, t, 0.12, 0.025);
      break;
    case 'open':
      tone(note(0), t, 0.9, 0.05);
      tone(note(2), t + 0.06, 0.9, 0.04);
      break;
    case 'resonate':
      [0, 2, 4, 5].forEach((n, i) => tone(note(n) * 2, t + i * 0.07, 1.2, 0.04));
      break;
    case 'release':
      [0, 1, 2, 3, 4, 5, 6].forEach((n, i) => tone(note(n), t + i * 0.09, 1.6, 0.045));
      tone(base / 2, t, 2.4, 0.05);
      break;
    case 'capsule':
      [4, 2, 0].forEach((n, i) => tone(note(n), t + i * 0.12, 1.4, 0.05));
      break;
  }
};
