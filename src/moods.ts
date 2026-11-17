import type { MoodKey } from './types';

export interface Mood {
  key: MoodKey;
  label: string;
  glyph: string;
  /** Hue in degrees for HSL. */
  hue: number;
  sat: number;
  light: number;
  words: string;
  /** Chart step: validated for CVD separation on the dark surface (see docs). */
  chart: string;
}

// Order matters: it's the order around the mood dial and the vertical bands in the sky.
export const MOODS: Mood[] = [
  { key: 'joyful', chart: '#b47d0e', label: 'Joyful', glyph: '☀', hue: 45, sat: 100, light: 66, words: 'delight · excitement' },
  { key: 'grateful', chart: '#ca5620', label: 'Grateful', glyph: '✿', hue: 28, sat: 100, light: 64, words: 'thankful · content' },
  { key: 'restless', chart: '#f9320b', label: 'Restless', glyph: '✺', hue: 6, sat: 92, light: 64, words: 'anxious · unsettled' },
  { key: 'tender', chart: '#c31947', label: 'Tender', glyph: '♡', hue: 340, sat: 90, light: 74, words: 'love · affection' },
  { key: 'nostalgic', chart: '#ac42f6', label: 'Nostalgic', glyph: '☾', hue: 270, sat: 80, light: 76, words: 'wistful · remembering' },
  { key: 'heavy', chart: '#658dee', label: 'Heavy', glyph: '☂', hue: 232, sat: 75, light: 68, words: 'sad · tired · grieving' },
  { key: 'curious', chart: '#199fd5', label: 'Curious', glyph: '✧', hue: 190, sat: 100, light: 62, words: 'wonder · anticipation' },
  { key: 'calm', chart: '#16ad7d', label: 'Calm', glyph: '〰', hue: 165, sat: 70, light: 62, words: 'peaceful · still' },
];

export const MOOD: Record<MoodKey, Mood> = Object.fromEntries(MOODS.map((m) => [m.key, m])) as Record<
  MoodKey,
  Mood
>;

export const moodIndex = (k: MoodKey) => MOODS.findIndex((m) => m.key === k);

export const moodColor = (k: MoodKey, alpha = 1, lightShift = 0) => {
  const m = MOOD[k];
  return `hsla(${m.hue}, ${m.sat}%, ${Math.min(96, m.light + lightShift)}%, ${alpha})`;
};

/**
 * Stacking order for charts. Interleaves warm and cool so neighbours stay
 * distinguishable (validated: adjacent CVD ΔE ≥ 10.6, normal ΔE ≥ 25.6 on #0b0d1f).
 */
export const CHART_ORDER: MoodKey[] = ['joyful', 'curious', 'restless', 'heavy', 'grateful', 'calm', 'tender', 'nostalgic'];
