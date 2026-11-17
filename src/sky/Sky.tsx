import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { Memory, MoodKey } from '../types';
import { MOODS, MOOD, moodIndex } from '../moods';
import { cam, clampCam, flyTo, reducedMotion, stepTween, timeToX, xToTime, zoomLimits } from './camera';
import { mulberry32 } from '../data/seed';
import { DAY } from '../lib/time';

export type Lens = 'mood' | 'me';

export interface SkyHandle {
  /** Fly to a memory and play its arrival (used after "Release"). */
  release: (id: string, onLanded?: () => void) => void;
  /** Burst + brighten (used after "Resonate"). */
  pulse: (id: string) => void;
  /** Fly camera to a memory. */
  focus: (id: string, done?: () => void) => void;
  /** Screen position of a memory, if laid out. */
  screenPos: (id: string) => { x: number; y: number } | null;
  /** Jump camera to now. */
  toNow: () => void;
}

interface Props {
  memories: Memory[];
  resonanceOf: (m: Memory) => number;
  lens: Lens;
  moodFilter: MoodKey | null;
  selectedId: string | null;
  hidden?: boolean;
  onSelect: (m: Memory, x: number, y: number) => void;
  onHover: (h: { m: Memory; x: number; y: number } | null) => void;
  onMoodLabel: (k: MoodKey) => void;
}

interface Laid {
  m: Memory;
  yNorm: number;
  phase: number;
  speed: number;
  core: number;
  bright: number;
  x: number;
  y: number;
  alpha: number;
  visible: boolean;
}

interface Fx {
  kind: 'ring' | 'arrive' | 'implode';
  id: string;
  start: number;
  dur: number;
  fromX?: number;
  fromY?: number;
}

const SKY_TOP = 86;
const SKY_BOTTOM = 196; // reserved for spark + tide + button
const HIT_R = 24;

const gaussian = (r: () => number) => {
  const u = Math.max(1e-6, r());
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const hashStr = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

// Pre-rendered glow sprites per mood (drawn additively).
const makeSprite = (hue: number, sat: number, light: number) => {
  const c = document.createElement('canvas');
  const S = 128;
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, `hsla(${hue}, ${sat}%, ${Math.min(95, light + 22)}%, 1)`);
  gr.addColorStop(0.12, `hsla(${hue}, ${sat}%, ${light}%, 0.75)`);
  gr.addColorStop(0.35, `hsla(${hue}, ${sat}%, ${light - 8}%, 0.22)`);
  gr.addColorStop(1, `hsla(${hue}, ${sat}%, ${light - 10}%, 0)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, S, S);
  return c;
};

const makeCore = () => {
  const c = document.createElement('canvas');
  const S = 32;
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.4, 'rgba(255,255,255,0.85)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, S, S);
  return c;
};

export const Sky = forwardRef<SkyHandle, Props>(function Sky(props, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const laidRef = useRef<Map<string, Laid>>(new Map());
  const fxRef = useRef<Fx[]>([]);
  const hiddenUntil = useRef<Map<string, number>>(new Map());

  // ---------- layout (recomputed when memories change) ----------
  useEffect(() => {
    const map = new Map<string, Laid>();
    const prev = laidRef.current;
    for (const m of props.memories) {
      const r = mulberry32(hashStr(m.id));
      const band = moodIndex(m.mood);
      const yNorm = Math.min(0.98, Math.max(0.02, (band + 0.5 + gaussian(r) * 0.26) / MOODS.length));
      const richness = m.media ? (m.media.kind === 'video' ? 1.2 : 0.65) : 0;
      const p = prev.get(m.id);
      map.set(m.id, {
        m,
        yNorm,
        phase: r() * Math.PI * 2,
        speed: 0.6 + r() * 1.6,
        core: 1.7 + richness + m.intensity * 1.0,
        bright: 0.5,
        x: p?.x ?? 0,
        y: p?.y ?? 0,
        alpha: p?.alpha ?? 0,
        visible: false,
      });
    }
    laidRef.current = map;
    const earliest = Math.min(...props.memories.map((m) => m.createdAt));
    if (Number.isFinite(earliest)) cam.minT = earliest - 3 * DAY;
  }, [props.memories]);

  // ---------- imperative API ----------
  useImperativeHandle(ref, () => ({
    release(id, onLanded) {
      const l = laidRef.current.get(id);
      if (!l) return;
      const z = Math.min(cam.msPerPx, (10 * DAY) / cam.width);
      hiddenUntil.current.set(id, Infinity);
      flyTo(l.m.createdAt - cam.width * 0.08 * z, z, 900, () => {
        const now = performance.now();
        const dur = reducedMotion() ? 10 : 1700;
        hiddenUntil.current.set(id, now + dur);
        fxRef.current.push({ kind: 'arrive', id, start: now, dur, fromX: cam.width / 2, fromY: cam.height * 0.62 });
        fxRef.current.push({ kind: 'ring', id, start: now + dur, dur: 1400 });
        window.setTimeout(() => onLanded?.(), dur + 200);
      });
    },
    pulse(id) {
      const now = performance.now();
      fxRef.current.push({ kind: 'implode', id, start: now, dur: 900 });
      fxRef.current.push({ kind: 'ring', id, start: now + 700, dur: 1300 });
    },
    focus(id, done) {
      const l = laidRef.current.get(id);
      if (!l) return done?.();
      const z = Math.min(Math.max(cam.msPerPx, (24 * DAY) / cam.width), (45 * DAY) / cam.width);
      flyTo(l.m.createdAt, z, 1000, done);
    },
    screenPos(id) {
      const l = laidRef.current.get(id);
      return l ? { x: l.x, y: l.y } : null;
    },
    toNow() {
      flyTo(Date.now() - (cam.width * cam.msPerPx) / 2 + 40 * cam.msPerPx, cam.msPerPx, 900);
    },
  }));

  // ---------- render loop + input ----------
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const sprites = Object.fromEntries(MOODS.map((m) => [m.key, makeSprite(m.hue, m.sat, m.light)])) as Record<
      MoodKey,
      HTMLCanvasElement
    >;
    const core = makeCore();
    const rm = reducedMotion();

    // Background dust: decorative stars that parallax slowly.
    const dr = mulberry32(7);
    const dust = Array.from({ length: 260 }, () => ({
      x: dr(),
      y: dr(),
      s: dr() * 1.1 + 0.2,
      a: dr() * 0.5 + 0.1,
      p: dr() * 10,
      depth: 0.02 + dr() * 0.08,
    }));

    let dpr = 1;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      cam.width = w;
      cam.height = h;
      clampCam();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Mood mix of what's in view, smoothed, drives the aurora.
    const mix = Object.fromEntries(MOODS.map((m) => [m.key, 1 / MOODS.length])) as Record<MoodKey, number>;

    let meteor: null | { x: number; y: number; vx: number; vy: number; life: number } = null;
    let nextMeteor = performance.now() + 9000;

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(64, now - last);
      last = now;
      const P = propsRef.current;
      if (P.hidden) return;

      stepTween(now);
      if (!cam.tween && Math.abs(cam.velocity) > 0.01) {
        cam.t += cam.velocity * dt * cam.msPerPx;
        cam.velocity *= Math.pow(0.92, dt / 16);
        clampCam();
      }

      const W = cam.width;
      const H = cam.height;
      const top = SKY_TOP;
      const bandH = Math.max(120, H - SKY_TOP - SKY_BOTTOM);
      const sec = now / 1000;
      const wall = Date.now();

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#04050d');
      bg.addColorStop(0.6, '#070a1c');
      bg.addColorStop(1, '#0b0e24');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // ---- layout pass ----
      const laid = laidRef.current;
      const counts = Object.fromEntries(MOODS.map((m) => [m.key, 0.2])) as Record<MoodKey, number>;
      let total = 1.6;
      for (const l of laid.values()) {
        const m = l.m;
        l.x = timeToX(m.createdAt);
        const drift = rm ? 0 : Math.sin(sec * 0.25 * l.speed + l.phase) * 3;
        l.y = top + l.yNorm * bandH + drift;
        l.visible = l.x > -60 && l.x < W + 60;
        const R = P.resonanceOf(m);
        l.bright = 0.4 + 0.6 * Math.min(1, Math.log1p(R) / Math.log(160));
        let target = 1;
        if (m.visibility === 'private' && P.lens !== 'me') target = 0;
        if (P.lens === 'me' && !m.mine) target = 0.07;
        if (P.moodFilter && m.mood !== P.moodFilter) target = Math.min(target, 0.08);
        l.alpha += (target - l.alpha) * Math.min(1, dt / 220);
        if (l.visible && target > 0.5) {
          counts[m.mood] += 1;
          total += 1;
        }
      }
      for (const k of Object.keys(mix) as MoodKey[]) mix[k] += (counts[k] / total - mix[k]) * Math.min(1, dt / 900);

      // ---- dust ----
      for (const d of dust) {
        const px = (((d.x * W - (cam.t / cam.msPerPx) * d.depth * 0.02) % W) + W) % W;
        const tw = rm ? 1 : 0.6 + 0.4 * Math.sin(sec * 1.3 + d.p);
        ctx.fillStyle = `rgba(200,210,255,${d.a * tw})`;
        ctx.fillRect(px, d.y * H, d.s, d.s);
      }

      // ---- aurora (mood weather of what's in view) ----
      ctx.globalCompositeOperation = 'lighter';
      let acc = 0;
      MOODS.forEach((mo, i) => {
        const w = mix[mo.key];
        const cx = (acc + w / 2) * W + (rm ? 0 : Math.sin(sec * 0.07 + i) * W * 0.06);
        acc += w;
        const rx = Math.max(80, w * W * 1.4);
        const g = ctx.createRadialGradient(cx, -20, 0, cx, -20, rx + 140);
        g.addColorStop(0, `hsla(${mo.hue}, ${mo.sat}%, ${mo.light - 10}%, ${0.1 + w * 0.5})`);
        g.addColorStop(1, `hsla(${mo.hue}, ${mo.sat}%, ${mo.light - 10}%, 0)`);
        ctx.fillStyle = g;
        ctx.fillRect(cx - rx - 140, 0, (rx + 140) * 2, H * 0.6);
      });

      // ---- faint band nebulae, so position reads as mood ----
      MOODS.forEach((mo, i) => {
        const cy = top + ((i + 0.5) / MOODS.length) * bandH;
        const isF = P.moodFilter === mo.key;
        const g = ctx.createLinearGradient(0, cy - bandH / MOODS.length, 0, cy + bandH / MOODS.length);
        const a = isF ? 0.08 : 0.025;
        g.addColorStop(0, `hsla(${mo.hue}, 80%, 50%, 0)`);
        g.addColorStop(0.5, `hsla(${mo.hue}, 80%, 50%, ${a})`);
        g.addColorStop(1, `hsla(${mo.hue}, 80%, 50%, 0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, cy - bandH / MOODS.length, W, (bandH / MOODS.length) * 2);
      });

      // ---- constellations ----
      ctx.globalCompositeOperation = 'lighter';
      const byAuthor = new Map<string, Laid[]>();
      for (const l of laid.values()) {
        if (l.alpha < 0.05) continue;
        const arr = byAuthor.get(l.m.authorKey) ?? [];
        arr.push(l);
        byAuthor.set(l.m.authorKey, arr);
      }
      const selAuthor = P.selectedId ? laid.get(P.selectedId)?.m.authorKey : undefined;
      ctx.lineWidth = 1;
      for (const [author, arr] of byAuthor) {
        if (arr.length < 2) continue;
        arr.sort((a, b) => a.m.createdAt - b.m.createdAt);
        const strong = author === selAuthor || (P.lens === 'me' && arr[0].m.mine);
        for (let i = 1; i < arr.length; i++) {
          const a = arr[i - 1];
          const b = arr[i];
          if (!a.visible && !b.visible) continue;
          if (!strong && b.m.createdAt - a.m.createdAt > 45 * DAY) continue;
          if (hiddenUntil.current.has(a.m.id) || hiddenUntil.current.has(b.m.id)) continue;
          const al = Math.min(a.alpha, b.alpha) * (strong ? 0.55 : 0.12);
          const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
          g.addColorStop(0, `hsla(${MOOD[a.m.mood].hue}, 80%, 75%, ${al})`);
          g.addColorStop(1, `hsla(${MOOD[b.m.mood].hue}, 80%, 75%, ${al})`);
          ctx.strokeStyle = g;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      // Echo threads (replies), dashed
      ctx.setLineDash([2, 5]);
      for (const l of laid.values()) {
        if (!l.m.echoOf || l.alpha < 0.05) continue;
        const p = laid.get(l.m.echoOf);
        if (!p || (!p.visible && !l.visible)) continue;
        const strong = P.selectedId === l.m.id || P.selectedId === p.m.id;
        ctx.strokeStyle = `hsla(${MOOD[l.m.mood].hue}, 80%, 80%, ${Math.min(l.alpha, p.alpha) * (strong ? 0.6 : 0.16)})`;
        ctx.beginPath();
        const mx = (l.x + p.x) / 2;
        const my = Math.min(l.y, p.y) - 30;
        ctx.moveTo(p.x, p.y);
        ctx.quadraticCurveTo(mx, my, l.x, l.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // ---- stars ----
      const zoomIn = Math.min(1.6, Math.max(0.7, Math.pow((30 * DAY) / W / cam.msPerPx, 0.18)));
      for (const l of laid.values()) {
        if (!l.visible || l.alpha < 0.01) continue;
        const hu = hiddenUntil.current.get(l.m.id);
        if (hu !== undefined) {
          if (now < hu) continue;
          hiddenUntil.current.delete(l.m.id);
        }
        const age = wall - l.m.createdAt;
        const fresh = age < DAY;
        const tw = rm ? 1 : 0.82 + 0.18 * Math.sin(sec * l.speed * 1.7 + l.phase);
        const pulse = fresh && !rm ? 1 + 0.35 * (0.5 + 0.5 * Math.sin(sec * 3 + l.phase)) : 1;
        const sel = P.selectedId === l.m.id;
        const c = l.core * zoomIn * pulse * (sel ? 1.4 : 1);
        const glow = c * (5 + 7 * l.bright) * (sel ? 1.3 : 1);
        ctx.globalAlpha = l.alpha * l.bright * tw;
        ctx.drawImage(sprites[l.m.mood], l.x - glow, l.y - glow, glow * 2, glow * 2);
        ctx.globalAlpha = l.alpha * (0.75 + 0.25 * tw);
        ctx.drawImage(core, l.x - c * 1.6, l.y - c * 1.6, c * 3.2, c * 3.2);

        if (fresh && !rm) {
          const rp = ((sec * 0.5 + l.phase) % 1 + 1) % 1;
          ctx.globalAlpha = l.alpha * (1 - rp) * 0.5;
          ctx.strokeStyle = `hsla(${MOOD[l.m.mood].hue}, 90%, 80%, 1)`;
          ctx.beginPath();
          ctx.arc(l.x, l.y, c * 2 + rp * 22, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (l.m.mine || sel) {
          ctx.globalAlpha = l.alpha * (sel ? 0.9 : 0.45);
          ctx.strokeStyle = sel ? 'rgba(255,255,255,1)' : `hsla(${MOOD[l.m.mood].hue}, 90%, 85%, 1)`;
          ctx.beginPath();
          ctx.arc(l.x, l.y, c * 3.4 + 3, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // ---- effects ----
      fxRef.current = fxRef.current.filter((f) => now < f.start + f.dur);
      for (const f of fxRef.current) {
        const l = laid.get(f.id);
        if (!l || now < f.start) continue;
        const p = (now - f.start) / f.dur;
        const hue = MOOD[l.m.mood].hue;
        if (f.kind === 'ring') {
          for (let k = 0; k < 3; k++) {
            const q = Math.max(0, p - k * 0.12);
            ctx.globalAlpha = (1 - q) * 0.7;
            ctx.strokeStyle = `hsla(${hue}, 95%, 82%, 1)`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(l.x, l.y, 6 + q * 70, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.lineWidth = 1;
          const flash = Math.max(0, 1 - p * 2.5);
          if (flash > 0) {
            ctx.globalAlpha = flash;
            const s = 80;
            ctx.drawImage(sprites[l.m.mood], l.x - s, l.y - s, s * 2, s * 2);
          }
        } else if (f.kind === 'arrive') {
          const e = 1 - Math.pow(1 - p, 3);
          const fx = f.fromX!;
          const fy = f.fromY!;
          const cx = (fx + l.x) / 2;
          const cy = Math.min(fy, l.y) - 140;
          const pt = (u: number) => ({
            x: (1 - u) * (1 - u) * fx + 2 * (1 - u) * u * cx + u * u * l.x,
            y: (1 - u) * (1 - u) * fy + 2 * (1 - u) * u * cy + u * u * l.y,
          });
          for (let k = 14; k >= 0; k--) {
            const u = Math.max(0, e - k * 0.025);
            const q = pt(u);
            const s = (18 - k) * 1.6 + 4;
            ctx.globalAlpha = (1 - k / 15) * 0.6;
            ctx.drawImage(sprites[l.m.mood], q.x - s, q.y - s, s * 2, s * 2);
          }
          const q = pt(e);
          ctx.globalAlpha = 1;
          ctx.drawImage(core, q.x - 7, q.y - 7, 14, 14);
        } else if (f.kind === 'implode') {
          // Particles drifting in from all around, into the star.
          const r = mulberry32(hashStr(f.id) + Math.floor(f.start));
          for (let k = 0; k < 28; k++) {
            const ang = r() * Math.PI * 2;
            const dist = 60 + r() * 120;
            const d = dist * (1 - Math.pow(p, 0.8));
            const s = 2 + r() * 3;
            ctx.globalAlpha = Math.sin(p * Math.PI) * 0.9;
            ctx.drawImage(sprites[l.m.mood], l.x + Math.cos(ang) * d - s * 3, l.y + Math.sin(ang) * d - s * 3, s * 6, s * 6);
          }
        }
      }
      ctx.globalAlpha = 1;

      // ---- the occasional shooting star ----
      if (!rm) {
        if (!meteor && now > nextMeteor) {
          meteor = { x: W * (0.2 + Math.random() * 0.8), y: H * Math.random() * 0.3, vx: -0.9, vy: 0.35, life: 0 };
          nextMeteor = now + 14000 + Math.random() * 20000;
        }
        if (meteor) {
          meteor.life += dt;
          meteor.x += meteor.vx * dt;
          meteor.y += meteor.vy * dt;
          const a = Math.sin(Math.min(1, meteor.life / 900) * Math.PI);
          const g = ctx.createLinearGradient(meteor.x, meteor.y, meteor.x - meteor.vx * 120, meteor.y - meteor.vy * 120);
          g.addColorStop(0, `rgba(255,255,255,${a * 0.9})`);
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.strokeStyle = g;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(meteor.x, meteor.y);
          ctx.lineTo(meteor.x - meteor.vx * 120, meteor.y - meteor.vy * 120);
          ctx.stroke();
          ctx.lineWidth = 1;
          if (meteor.life > 900) meteor = null;
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    };
    raf = requestAnimationFrame(frame);

    // ---------- input ----------
    const pointers = new Map<number, { x: number; y: number }>();
    let downAt: { x: number; y: number; t: number } | null = null;
    let moved = 0;
    let pinchDist = 0;
    let lastMoveT = 0;
    let lastDx = 0;

    const pick = (x: number, y: number): Laid | null => {
      let best: Laid | null = null;
      let bd = HIT_R * HIT_R;
      for (const l of laidRef.current.values()) {
        if (!l.visible || l.alpha < 0.5) continue;
        const dx = l.x - x;
        const dy = l.y - y;
        const d = dx * dx + dy * dy;
        if (d < bd) {
          bd = d;
          best = l;
        }
      }
      return best;
    };

    const local = (e: PointerEvent | WheelEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      const p = local(e);
      pointers.set(e.pointerId, p);
      cam.tween = null;
      cam.velocity = 0;
      if (pointers.size === 1) {
        downAt = { ...p, t: performance.now() };
        moved = 0;
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
        downAt = null;
      }
    };

    const onMove = (e: PointerEvent) => {
      const p = local(e);
      if (!pointers.has(e.pointerId)) {
        if (e.pointerType === 'mouse') {
          const hit = pick(p.x, p.y);
          canvas.style.cursor = hit ? 'pointer' : 'grab';
          propsRef.current.onHover(hit ? { m: hit.m, x: hit.x, y: hit.y } : null);
        }
        return;
      }
      const prev = pointers.get(e.pointerId)!;
      pointers.set(e.pointerId, p);
      if (pointers.size === 1) {
        const dx = p.x - prev.x;
        moved += Math.abs(dx) + Math.abs(p.y - prev.y);
        cam.t -= dx * cam.msPerPx;
        clampCam();
        const tNow = performance.now();
        const dtm = Math.max(1, tNow - lastMoveT);
        lastDx = -dx / dtm;
        lastMoveT = tNow;
        if (moved > 6) propsRef.current.onHover(null);
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = (a.x + b.x) / 2;
        if (pinchDist > 0) zoomAt(mid, pinchDist / d);
        pinchDist = d;
        moved += 10;
      }
    };

    const onUp = (e: PointerEvent) => {
      const p = local(e);
      pointers.delete(e.pointerId);
      if (pointers.size === 0 && downAt) {
        if (moved < 8) {
          const hit = pick(p.x, p.y);
          if (hit) propsRef.current.onSelect(hit.m, hit.x, hit.y);
        } else if (performance.now() - lastMoveT < 60 && !rm) {
          cam.velocity = lastDx * 16;
        }
        downAt = null;
      }
      if (pointers.size < 2) pinchDist = 0;
    };

    const zoomAt = (x: number, factor: number) => {
      const tAt = xToTime(x);
      const { min, max } = zoomLimits();
      cam.msPerPx = Math.min(max, Math.max(min, cam.msPerPx * factor));
      cam.t = tAt - (x - cam.width / 2) * cam.msPerPx;
      clampCam();
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cam.tween = null;
      cam.velocity = 0;
      const p = local(e);
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && !e.ctrlKey) {
        cam.t += e.deltaX * cam.msPerPx;
        clampCam();
      } else {
        zoomAt(p.x, Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
      }
    };

    const onLeave = () => propsRef.current.onHover(null);

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="sky-canvas"
        aria-label="The sky of memories. Drag to travel through time, pinch or scroll to zoom, tap a light to open it. Use list view for an accessible version."
        role="img"
      />
      <div className="mood-rail" aria-label="Filter by mood">
        {MOODS.map((m) => (
          <button
            key={m.key}
            className={`mood-rail-btn${props.moodFilter === m.key ? ' on' : ''}`}
            style={{ ['--h' as string]: m.hue, top: `calc(${SKY_TOP}px + (100% - ${SKY_TOP + SKY_BOTTOM}px) * ${(MOODS.indexOf(m) + 0.5) / MOODS.length})` }}
            onClick={() => props.onMoodLabel(m.key)}
            aria-pressed={props.moodFilter === m.key}
            title={`${m.label}: ${m.words}`}
          >
            <span className="g">{m.glyph}</span>
            <span className="l">{m.label}</span>
          </button>
        ))}
      </div>
    </>
  );
});
