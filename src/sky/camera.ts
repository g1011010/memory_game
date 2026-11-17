import { DAY } from '../lib/time';

/**
 * Shared camera for the Sky and the Tide (timeline). Mutable on purpose:
 * both canvases read it every animation frame, no React re-renders needed.
 */
export const cam = {
  /** Time at the horizontal center of the screen (ms). */
  t: Date.now() - 12 * DAY,
  /** Zoom: milliseconds per CSS pixel. */
  msPerPx: (30 * DAY) / 400,
  width: 400,
  height: 800,
  /** Earliest time with content. */
  minT: Date.now() - 230 * DAY,
  /** Active tween, if any. */
  tween: null as null | {
    fromT: number;
    toT: number;
    fromZ: number;
    toZ: number;
    start: number;
    dur: number;
    done?: () => void;
  },
  velocity: 0,
};

export const maxT = () => Date.now() + 2 * DAY;

export const zoomLimits = () => ({
  min: (2 * 3_600_000) / 60, // ~2 hours across 60px: very close
  max: (Date.now() + 10 * DAY - cam.minT) / Math.max(320, cam.width),
});

export const clampCam = () => {
  const { min, max } = zoomLimits();
  cam.msPerPx = Math.min(max, Math.max(min, cam.msPerPx));
  cam.t = Math.min(Math.max(cam.t, cam.minT), maxT());
};

export const reducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export const flyTo = (t: number, msPerPx = cam.msPerPx, dur = 1100, done?: () => void) => {
  cam.velocity = 0;
  if (reducedMotion()) {
    cam.t = t;
    cam.msPerPx = msPerPx;
    clampCam();
    done?.();
    return;
  }
  cam.tween = { fromT: cam.t, toT: t, fromZ: cam.msPerPx, toZ: msPerPx, start: performance.now(), dur, done };
};

export const stepTween = (now: number) => {
  const tw = cam.tween;
  if (!tw) return;
  const p = Math.min(1, (now - tw.start) / tw.dur);
  const e = ease(p);
  // Zoom in log space so it feels even.
  cam.msPerPx = Math.exp(Math.log(tw.fromZ) + (Math.log(tw.toZ) - Math.log(tw.fromZ)) * e);
  cam.t = tw.fromT + (tw.toT - tw.fromT) * e;
  if (p >= 1) {
    cam.tween = null;
    tw.done?.();
  }
};

export const timeToX = (t: number) => (t - cam.t) / cam.msPerPx + cam.width / 2;
export const xToTime = (x: number) => cam.t + (x - cam.width / 2) * cam.msPerPx;
