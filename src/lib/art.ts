import { mulberry32 } from '../data/seed';

// Generates soft, photographic-feeling abstract scenes for seeded memories,
// so the prototype has imagery without shipping or hot-linking photos.
const cache = new Map<string, string>();

export const artUrl = (hues: [number, number], seed: number, w = 720, h = 540): string => {
  const key = `${hues.join(',')}:${seed}:${w}x${h}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const r = mulberry32(seed);
  const [a, b] = hues;
  const kind = Math.floor(r() * 3); // 0: horizon, 1: water, 2: window bokeh

  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, `hsl(${b}, 45%, ${18 + r() * 14}%)`);
  sky.addColorStop(0.55, `hsl(${(a + b) / 2}, 60%, ${45 + r() * 15}%)`);
  sky.addColorStop(1, `hsl(${a}, 75%, ${62 + r() * 12}%)`);
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);

  // Sun / moon glow
  const sx = w * (0.2 + r() * 0.6);
  const sy = h * (0.35 + r() * 0.25);
  const sr = h * (0.08 + r() * 0.1);
  const sun = g.createRadialGradient(sx, sy, 0, sx, sy, sr * 5);
  sun.addColorStop(0, `hsla(${a}, 100%, 92%, 0.95)`);
  sun.addColorStop(0.18, `hsla(${a}, 100%, 80%, 0.6)`);
  sun.addColorStop(1, `hsla(${a}, 100%, 70%, 0)`);
  g.fillStyle = sun;
  g.fillRect(0, 0, w, h);

  if (kind === 2) {
    for (let i = 0; i < 38; i++) {
      const x = r() * w;
      const y = r() * h;
      const rad = 10 + r() * 50;
      const bg = g.createRadialGradient(x, y, 0, x, y, rad);
      const hue = r() < 0.5 ? a : b;
      bg.addColorStop(0, `hsla(${hue}, 90%, 80%, ${0.15 + r() * 0.35})`);
      bg.addColorStop(1, `hsla(${hue}, 90%, 70%, 0)`);
      g.fillStyle = bg;
      g.beginPath();
      g.arc(x, y, rad, 0, Math.PI * 2);
      g.fill();
    }
  } else {
    // Layered hills / waves
    const layers = 3 + Math.floor(r() * 2);
    for (let l = 0; l < layers; l++) {
      const base = h * (0.55 + (l / layers) * 0.4);
      const amp = h * (kind === 1 ? 0.01 : 0.06) * (1 + r());
      const freq = 1 + r() * 3;
      const phase = r() * 10;
      g.beginPath();
      g.moveTo(0, h);
      for (let x = 0; x <= w; x += 8) {
        const y = base + Math.sin((x / w) * Math.PI * freq + phase) * amp + Math.sin((x / w) * 17 + phase) * amp * 0.25;
        g.lineTo(x, y);
      }
      g.lineTo(w, h);
      g.closePath();
      g.fillStyle = `hsla(${b}, 40%, ${30 - l * 7}%, ${kind === 1 ? 0.55 : 0.85})`;
      g.fill();
      if (kind === 1) {
        // light glitter on water
        for (let i = 0; i < 60; i++) {
          g.fillStyle = `hsla(${a}, 100%, 85%, ${r() * 0.5})`;
          g.fillRect(sx + (r() - 0.5) * w * 0.35, base + r() * (h - base) * 0.6, 2 + r() * 14, 1.5);
        }
      }
    }
  }

  // Film grain + vignette for a photographic feel
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 18;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  const v = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.9);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.45)');
  g.fillStyle = v;
  g.fillRect(0, 0, w, h);

  const url = c.toDataURL('image/jpeg', 0.82);
  cache.set(key, url);
  return url;
};
