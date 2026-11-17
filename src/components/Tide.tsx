import { useEffect, useRef } from 'react';
import type { Memory } from '../types';
import { MOOD } from '../moods';
import { cam, clampCam, maxT } from '../sky/camera';
import { DAY } from '../lib/time';

/**
 * The Tide: a compact timeline of the whole sky. Its density ribbon shows the
 * moods over time; the bright window is what you're looking at. Drag to travel.
 */
export function Tide({ memories, onNow }: { memories: Memory[]; onNow: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const memRef = useRef(memories);
  memRef.current = memories;

  useEffect(() => {
    const c = ref.current!;
    const g = c.getContext('2d')!;
    let raf = 0;
    let dpr = 1;
    let W = 0;
    let H = 0;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = c.clientWidth;
      H = c.clientHeight;
      c.width = W * dpr;
      c.height = H * dpr;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(c);

    const range = () => ({ a: cam.minT, b: maxT() });
    const tx = (t: number) => {
      const { a, b } = range();
      return ((t - a) / (b - a)) * W;
    };

    const draw = () => {
      raf = requestAnimationFrame(draw);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      const mid = H * 0.55;

      // Ribbon: each memory a soft vertical tick in its mood color.
      g.globalCompositeOperation = 'lighter';
      for (const m of memRef.current) {
        if (m.visibility === 'private') continue;
        const x = tx(m.createdAt);
        const mo = MOOD[m.mood];
        const h = 5 + m.intensity * 9;
        g.fillStyle = `hsla(${mo.hue}, ${mo.sat}%, ${mo.light}%, 0.45)`;
        g.fillRect(x - 0.75, mid - h / 2, 1.5, h);
      }
      g.globalCompositeOperation = 'source-over';

      // Month labels
      g.font = '500 10px Inter, system-ui, sans-serif';
      g.fillStyle = 'rgba(210,215,255,0.45)';
      g.textBaseline = 'top';
      const { a, b } = range();
      const d = new Date(a);
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      let lastX = -999;
      while (d.getTime() < b) {
        d.setMonth(d.getMonth() + 1);
        const x = tx(d.getTime());
        if (x - lastX > 34 && x < W - 30) {
          const label = d.getMonth() === 0 ? String(d.getFullYear()) : d.toLocaleString(undefined, { month: 'short' });
          g.fillText(label, x + 3, 2);
          g.fillRect(x, 0, 1, 6);
          lastX = x;
        }
      }

      // Viewport window
      const half = (cam.width / 2) * cam.msPerPx;
      const x0 = Math.max(0, tx(cam.t - half));
      const x1 = Math.min(W, tx(cam.t + half));
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.strokeStyle = 'rgba(255,255,255,0.55)';
      g.lineWidth = 1;
      const ww = Math.max(4, x1 - x0);
      g.beginPath();
      g.roundRect(x0, mid - 12, ww, 24, 6);
      g.fill();
      g.stroke();

      // "now" marker
      const nx = tx(Date.now());
      g.fillStyle = 'rgba(255,230,180,0.9)';
      g.beginPath();
      g.arc(nx, mid, 2.5, 0, Math.PI * 2);
      g.fill();
    };
    raf = requestAnimationFrame(draw);

    let dragging = false;
    const setFromX = (clientX: number) => {
      const r = c.getBoundingClientRect();
      const { a, b } = range();
      cam.tween = null;
      cam.velocity = 0;
      cam.t = a + ((clientX - r.left) / r.width) * (b - a);
      clampCam();
    };
    const down = (e: PointerEvent) => {
      dragging = true;
      c.setPointerCapture(e.pointerId);
      setFromX(e.clientX);
    };
    const move = (e: PointerEvent) => dragging && setFromX(e.clientX);
    const up = () => (dragging = false);
    c.addEventListener('pointerdown', down);
    c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      c.removeEventListener('pointerdown', down);
      c.removeEventListener('pointermove', move);
      c.removeEventListener('pointerup', up);
      c.removeEventListener('pointercancel', up);
    };
  }, []);

  const step = (dir: number) => {
    cam.tween = null;
    cam.t += dir * Math.max(DAY, cam.width * cam.msPerPx * 0.5);
    clampCam();
  };

  return (
    <div className="tide">
      <button className="tide-step" onClick={() => step(-1)} aria-label="Earlier">
        ‹
      </button>
      <canvas
        ref={ref}
        className="tide-canvas"
        role="slider"
        aria-label="Timeline. Drag to travel through time."
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={50}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') step(-1);
          if (e.key === 'ArrowRight') step(1);
        }}
      />
      <button className="tide-step" onClick={() => step(1)} aria-label="Later">
        ›
      </button>
      <button className="tide-now" onClick={onNow}>
        now
      </button>
    </div>
  );
}
