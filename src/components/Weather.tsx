import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import type { Memory, MoodKey } from '../types';
import { CHART_ORDER, MOOD, MOODS } from '../moods';
import { DAY } from '../lib/time';

const STOP = new Set(
  'the a an and or but if of to in on at for with my me i is it was are be been this that so just like all as by from have has had not no we our you your they them their he she his her its up out about what when then than there here one too very more into over after before still day today like im it\'s i\'m could would can will did do got get every only some even really back down off again been am who how much mostly around cannot anyway where went want feel felt know made make same why while which first last other never always thing things through until without because being those these were said time year years still each between'.split(
    /\s+/,
  ),
);

const words = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^\p{L}\s']/gu, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter((w) => w.length > 3 && !STOP.has(w));

const pct = (x: number) => `${Math.round(x * 100)}%`;

function MoodBars({ counts, label }: { counts: Record<MoodKey, number>; label: string }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const rows = MOODS.map((m) => ({ m, v: counts[m.key] })).sort((a, b) => b.v - a.v);
  const max = Math.max(1, ...rows.map((r) => r.v));
  return (
    <div className="bars" role="table" aria-label={label}>
      {rows.map(({ m, v }) => (
        <div className="bar-row" role="row" key={m.key} title={`${m.label}: ${v} memories (${pct(v / total)})`}>
          <span className="bar-label" role="cell">
            <span aria-hidden>{m.glyph}</span> {m.label}
          </span>
          <span className="bar-track" role="cell">
            <span className="bar-fill" style={{ width: `${(v / max) * 100}%`, background: m.chart }} />
          </span>
          <span className="bar-val" role="cell">
            {pct(v / total)}
          </span>
        </div>
      ))}
    </div>
  );
}

interface Bucket {
  t: number;
  label: string;
  counts: Record<MoodKey, number>;
  total: number;
}

function MoodTide({ buckets }: { buckets: Bucket[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const W = 640;
  const H = 200;
  const padL = 8;
  const padR = 8;
  const padT = 8;
  const padB = 22;
  const iw = W - padL - padR;
  const ih = H - padT - padB;
  const n = buckets.length;
  const x = (i: number) => padL + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);

  // 100% stacked shares
  const stacks = useMemo(() => {
    const out: Record<MoodKey, { y0: number; y1: number }[]> = {} as never;
    for (const k of CHART_ORDER) out[k] = [];
    buckets.forEach((b) => {
      let acc = 0;
      for (const k of CHART_ORDER) {
        const share = b.total ? b.counts[k] / b.total : 1 / CHART_ORDER.length;
        out[k].push({ y0: acc, y1: acc + share });
        acc += share;
      }
    });
    return out;
  }, [buckets]);

  const y = (v: number) => padT + (1 - v) * ih;
  // Smooth curve segments after the first point (horizontal-tangent cubic).
  const segs = (pts: [number, number][]) => {
    let d = '';
    for (let i = 1; i < pts.length; i++) {
      const [px, py] = pts[i];
      const [qx, qy] = pts[i - 1];
      const mx = (px + qx) / 2;
      d += `C${mx},${qy} ${mx},${py} ${px},${py}`;
    }
    return d;
  };

  const area = (k: MoodKey) => {
    const s = stacks[k];
    const top = s.map((v, i) => [x(i), y(v.y1)] as [number, number]);
    const bot = s.map((v, i) => [x(i), y(v.y0)] as [number, number]).reverse();
    return `M${top[0][0]},${top[0][1]}${segs(top)}L${bot[0][0]},${bot[0][1]}${segs(bot)}Z`;
  };

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - padL) / iw) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  const hb = hover != null ? buckets[hover] : null;

  return (
    <div className="tide-chart">
      <div className="legend" aria-label="Legend">
        {CHART_ORDER.map((k) => (
          <span key={k} className="lg">
            <span className="sw" style={{ background: MOOD[k].chart }} />
            {MOOD[k].label}
          </span>
        ))}
        <button className="link table-toggle" onClick={() => setTable((t) => !t)}>
          {table ? 'chart view' : 'table view'}
        </button>
      </div>

      {table ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                {CHART_ORDER.map((k) => (
                  <th key={k}>{MOOD[k].label}</th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((b) => (
                <tr key={b.t}>
                  <td>{b.label}</td>
                  {CHART_ORDER.map((k) => (
                    <td key={k}>{b.counts[k]}</td>
                  ))}
                  <td>{b.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="chart-box">
          <svg viewBox={`0 0 ${W} ${H}`} className="tide-svg" role="img" aria-label="Share of each mood per month">
            {CHART_ORDER.map((k) => (
              <path key={k} d={area(k)} fill={MOOD[k].chart} stroke="#0b0d1f" strokeWidth={2} strokeLinejoin="round" opacity={0.92} />
            ))}
            {buckets.map((b, i) =>
              i % Math.ceil(n / 7) === 0 || i === n - 1 ? (
                <text key={b.t} x={x(i)} y={H - 6} className="axis" textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>
                  {b.label}
                </text>
              ) : null,
            )}
            {hover != null && <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + ih} stroke="rgba(255,255,255,0.85)" strokeWidth={1} />}
            <rect
              x={0}
              y={0}
              width={W}
              height={H}
              fill="transparent"
              onPointerMove={onMove}
              onPointerDown={onMove}
              onPointerLeave={() => setHover(null)}
            />
          </svg>
          {hb && hover != null && (
            <div className="tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
              <div className="tip-h">
                {hb.label} · {hb.total} memories
              </div>
              {[...CHART_ORDER].reverse().map((k) => (
                <div key={k} className="tip-row">
                  <span className="key" style={{ background: MOOD[k].chart }} />
                  <strong>{hb.total ? pct(hb.counts[k] / hb.total) : '–'}</strong>
                  <span>{MOOD[k].label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Weather({ memories, onClose }: { memories: Memory[]; onClose: () => void }) {
  const now = Date.now();
  const pub = memories.filter((m) => m.visibility === 'public');

  const zero = () => Object.fromEntries(MOODS.map((m) => [m.key, 0])) as Record<MoodKey, number>;

  const week = useMemo(() => {
    const c = zero();
    pub.filter((m) => now - m.createdAt < 7 * DAY).forEach((m) => (c[m.mood] += 1));
    return c;
  }, [memories]); // eslint-disable-line react-hooks/exhaustive-deps

  const mine = useMemo(() => {
    const c = zero();
    memories.filter((m) => m.mine).forEach((m) => (c[m.mood] += 1));
    return c;
  }, [memories]); // eslint-disable-line react-hooks/exhaustive-deps
  const mineTotal = Object.values(mine).reduce((a, b) => a + b, 0);

  const buckets = useMemo<Bucket[]>(() => {
    const out: Bucket[] = [];
    const d = new Date(now);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() - 12);
    for (let i = 0; i < 13; i++) {
      const a = d.getTime();
      const label = d.toLocaleString(undefined, { month: 'short' }) + (d.getMonth() === 0 ? ` ’${String(d.getFullYear()).slice(2)}` : '');
      d.setMonth(d.getMonth() + 1);
      const b = d.getTime();
      const counts = zero();
      let total = 0;
      pub.forEach((m) => {
        if (m.createdAt >= a && m.createdAt < b) {
          counts[m.mood] += 1;
          total += 1;
        }
      });
      out.push({ t: a, label, counts, total });
    }
    return out;
  }, [memories]); // eslint-disable-line react-hooks/exhaustive-deps

  const rising = useMemo(() => {
    const recent = new Map<string, number>();
    const all = new Map<string, number>();
    pub.forEach((m) => {
      const ws = new Set(words(m.thought));
      ws.forEach((w) => {
        all.set(w, (all.get(w) ?? 0) + 1);
        if (now - m.createdAt < 45 * DAY) recent.set(w, (recent.get(w) ?? 0) + 1);
      });
    });
    return [...recent.entries()]
      .map(([w, c]) => ({ w, c, s: c / Math.sqrt(all.get(w) ?? 1) }))
      .sort((a, b) => b.s - a.s || b.c - a.c)
      .slice(0, 14);
  }, [memories]); // eslint-disable-line react-hooks/exhaustive-deps

  const weekTotal = Object.values(week).reduce((a, b) => a + b, 0);
  const ranked = MOODS.map((m) => ({ m, v: week[m.key] })).sort((a, b) => b.v - a.v);
  const top = ranked[0];
  const second = ranked[1];
  const prevMonth = buckets[buckets.length - 2];
  const thisMonth = buckets[buckets.length - 1];
  const delta = (k: MoodKey) =>
    (thisMonth.total ? thisMonth.counts[k] / thisMonth.total : 0) - (prevMonth.total ? prevMonth.counts[k] / prevMonth.total : 0);
  const risingMood = MOODS.map((m) => ({ m, d: delta(m.key) })).sort((a, b) => b.d - a.d)[0];

  // Aurora: today's sky as a gradient made from the week's mood mix.
  let acc = 0;
  const stops = ranked
    .filter((r) => r.v > 0)
    .map((r) => {
      const a = acc;
      acc += r.v / (weekTotal || 1);
      return `hsl(${r.m.hue} ${r.m.sat}% ${r.m.light - 8}%) ${Math.round(((a + acc) / 2) * 100)}%`;
    });

  return (
    <motion.div className="weather-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.section
        className="weather"
        role="dialog"
        aria-modal="true"
        aria-label="Mood weather"
        initial={{ y: '-100%' }}
        animate={{ y: 0 }}
        exit={{ y: '-100%' }}
        transition={{ type: 'spring', stiffness: 140, damping: 22 }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="weather-head">
          <h2>Mood weather</h2>
          <button className="ghost" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="aurora-hero" style={{ background: stops.length > 1 ? `linear-gradient(100deg, ${stops.join(', ')})` : undefined }}>
          <div className="aurora-veil" />
          <p className="forecast">
            {weekTotal === 0 ? (
              'A quiet sky this week. Be the first light.'
            ) : (
              <>
                This week the sky is mostly <strong>{top.m.label.toLowerCase()}</strong>
                {second.v > 0 && (
                  <>
                    , with a streak of <strong>{second.m.label.toLowerCase()}</strong>
                  </>
                )}
                .{' '}
                {risingMood.d > 0.04 && (
                  <>
                    {risingMood.m.label} is rising: up {pct(risingMood.d)} on last month.
                  </>
                )}
              </>
            )}
          </p>
          <span className="forecast-sub">{weekTotal} memories caught in the last 7 days</span>
        </div>

        <div className="weather-grid">
          <div className="panel">
            <h3>This week’s mix</h3>
            <MoodBars counts={week} label="Mood mix this week" />
          </div>

          <div className="panel wide">
            <h3>The mood tide · last 13 months</h3>
            <p className="panel-sub">Share of each mood among memories caught each month. Hover or touch for details.</p>
            <MoodTide buckets={buckets} />
          </div>

          <div className="panel">
            <h3>Rising words</h3>
            <div className="words">
              {rising.map((r, i) => (
                <span key={r.w} className="word" style={{ fontSize: `${Math.max(0.8, 1.35 - i * 0.04)}rem`, opacity: Math.max(0.55, 1 - i * 0.03) }}>
                  {r.w}
                </span>
              ))}
            </div>
          </div>

          <div className="panel">
            <h3>Your weather</h3>
            {mineTotal === 0 ? (
              <p className="panel-sub">Catch a few moments and your own mood pattern will appear here. Only you can see it.</p>
            ) : (
              <>
                <p className="panel-sub">
                  {mineTotal} {mineTotal === 1 ? 'memory' : 'memories'} in your trail. Only you can see this.
                </p>
                <MoodBars counts={mine} label="Your moods" />
              </>
            )}
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}
