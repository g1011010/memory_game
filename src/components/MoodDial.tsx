import { useRef } from 'react';
import type { MoodKey } from '../types';
import { MOODS, MOOD } from '../moods';
import { chime } from '../lib/sound';

const SIZE = 300;
const R = 128;
const C = SIZE / 2;

/** Circular mood picker: angle chooses the mood, distance from center sets intensity. */
export function MoodDial({
  mood,
  intensity,
  onChange,
}: {
  mood: MoodKey | null;
  intensity: number;
  onChange: (m: MoodKey, i: number) => void;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const lastMood = useRef<MoodKey | null>(mood);
  const seg = (Math.PI * 2) / MOODS.length;

  const update = (clientX: number, clientY: number) => {
    const r = ref.current!.getBoundingClientRect();
    const scale = SIZE / r.width;
    const x = (clientX - r.left) * scale - C;
    const y = (clientY - r.top) * scale - C;
    let a = Math.atan2(y, x) + Math.PI / 2; // 0 at top
    if (a < 0) a += Math.PI * 2;
    const idx = Math.round(a / seg) % MOODS.length;
    const dist = Math.min(1, Math.hypot(x, y) / R);
    const next = MOODS[idx].key;
    if (next !== lastMood.current) {
      chime('tick', idx * 2);
      lastMood.current = next;
    }
    onChange(next, Math.max(0.15, dist));
  };

  const sel = mood ? MOOD[mood] : null;
  const selIdx = mood ? MOODS.findIndex((m) => m.key === mood) : -1;
  const handleA = selIdx * seg - Math.PI / 2;
  const hr = intensity * R;

  return (
    <div className="dial-wrap">
      <svg
        ref={ref}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="dial"
        role="radiogroup"
        aria-label="Mood"
        onPointerDown={(e) => {
          dragging.current = true;
          (e.target as Element).setPointerCapture?.(e.pointerId);
          update(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => dragging.current && update(e.clientX, e.clientY)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        <defs>
          {MOODS.map((m) => (
            <radialGradient key={m.key} id={`dg-${m.key}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={`hsl(${m.hue} ${m.sat}% ${m.light}%)`} stopOpacity="0.0" />
              <stop offset="100%" stopColor={`hsl(${m.hue} ${m.sat}% ${m.light}%)`} stopOpacity="0.55" />
            </radialGradient>
          ))}
          <radialGradient id="dial-center">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
            <stop offset="30%" stopColor={sel ? `hsl(${sel.hue} ${sel.sat}% ${sel.light}%)` : '#8890c0'} stopOpacity="0.8" />
            <stop offset="100%" stopColor={sel ? `hsl(${sel.hue} ${sel.sat}% ${sel.light}%)` : '#8890c0'} stopOpacity="0" />
          </radialGradient>
        </defs>

        {MOODS.map((m, i) => {
          const a0 = i * seg - seg / 2 - Math.PI / 2;
          const a1 = a0 + seg;
          const p0 = [C + Math.cos(a0) * R, C + Math.sin(a0) * R];
          const p1 = [C + Math.cos(a1) * R, C + Math.sin(a1) * R];
          const on = m.key === mood;
          return (
            <path
              key={m.key}
              d={`M${C},${C} L${p0[0]},${p0[1]} A${R},${R} 0 0 1 ${p1[0]},${p1[1]} Z`}
              fill={`url(#dg-${m.key})`}
              opacity={mood && !on ? 0.35 : 1}
              stroke="rgba(255,255,255,0.06)"
              style={{ transition: 'opacity .3s' }}
            />
          );
        })}

        {[0.33, 0.66, 1].map((k) => (
          <circle key={k} cx={C} cy={C} r={R * k} fill="none" stroke="rgba(255,255,255,0.07)" />
        ))}

        <circle cx={C} cy={C} r={18 + intensity * 30} fill="url(#dial-center)" style={{ transition: 'r .15s' }} />

        {sel && (
          <g>
            <line x1={C} y1={C} x2={C + Math.cos(handleA) * hr} y2={C + Math.sin(handleA) * hr} stroke="rgba(255,255,255,0.35)" />
            <circle
              cx={C + Math.cos(handleA) * hr}
              cy={C + Math.sin(handleA) * hr}
              r={11}
              fill={`hsl(${sel.hue} ${sel.sat}% ${sel.light}%)`}
              stroke="#fff"
              strokeWidth={2}
              className="dial-handle"
            />
          </g>
        )}
      </svg>

      {MOODS.map((m, i) => {
        const a = i * seg - Math.PI / 2;
        const rr = 46; // % from center for labels
        return (
          <button
            key={m.key}
            role="radio"
            aria-checked={m.key === mood}
            className={`dial-label${m.key === mood ? ' on' : ''}`}
            style={{
              left: `${50 + Math.cos(a) * rr}%`,
              top: `${50 + Math.sin(a) * rr}%`,
              ['--h' as string]: m.hue,
            }}
            onClick={() => {
              chime('tick', i * 2);
              onChange(m.key, intensity || 0.6);
            }}
          >
            <span className="g">{m.glyph}</span>
            {m.label}
          </button>
        );
      })}

      <p className="dial-caption" aria-live="polite">
        {sel ? (
          <>
            <strong style={{ color: `hsl(${sel.hue} ${sel.sat}% ${sel.light}%)` }}>
              {intensity > 0.75 ? 'Deeply ' : intensity < 0.35 ? 'A little ' : ''}
              {sel.label.toLowerCase()}
            </strong>{' '}
            · {sel.words}
          </>
        ) : (
          'Touch the color that feels closest. Further out means stronger.'
        )}
      </p>
    </div>
  );
}
