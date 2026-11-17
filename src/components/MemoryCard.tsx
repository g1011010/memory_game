import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Memory } from '../types';
import { MOOD, moodColor } from '../moods';
import { artUrl } from '../lib/art';
import { exactTime, partOfDay, relativeTime } from '../lib/time';
import { sparkById } from '../data/sparks';
import { chime } from '../lib/sound';
import { reducedMotion } from '../sky/camera';

interface Props {
  memory: Memory;
  origin: { x: number; y: number };
  all: Memory[];
  resonated: boolean;
  onClose: () => void;
  onNavigate: (m: Memory) => void;
  onResonate: (m: Memory) => void;
  onEcho: (m: Memory) => void;
  onDelete: (m: Memory) => void;
  onShare: (m: Memory) => void;
}

export function MediaView({ media, mood, compact }: { media: NonNullable<Memory['media']>; mood: Memory['mood']; compact?: boolean }) {
  const vref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const src = media.art ? artUrl(media.art.hues, media.art.seed) : media.url;

  useEffect(() => {
    const v = vref.current;
    if (!v) return;
    const s = media.start ?? 0;
    const e = media.end ?? Infinity;
    const onTime = () => {
      if (v.currentTime >= e || v.currentTime < s - 0.25) v.currentTime = s;
    };
    v.currentTime = s;
    v.addEventListener('timeupdate', onTime);
    return () => v.removeEventListener('timeupdate', onTime);
  }, [media]);

  if (!src) return null;
  return (
    <div className={`media${compact ? ' compact' : ''}`} style={{ ['--glow' as string]: moodColor(mood, 0.45) }}>
      {media.kind === 'video' ? (
        <>
          <video ref={vref} src={src} autoPlay loop muted={muted} playsInline />
          <button className="media-sound" onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Play sound' : 'Mute'}>
            {muted ? '🔇' : '🔊'}
          </button>
        </>
      ) : (
        <img src={src} alt="" className={reducedMotion() ? '' : 'kenburns'} draggable={false} />
      )}
    </div>
  );
}

function ResonateButton({ done, onDone, hue }: { done: boolean; onDone: () => void; hue: number }) {
  const [p, setP] = useState(0);
  const raf = useRef(0);
  const start = useRef(0);

  const begin = () => {
    if (done) return;
    start.current = performance.now();
    chime('tick');
    const tick = () => {
      const q = Math.min(1, (performance.now() - start.current) / 650);
      setP(q);
      if (q >= 1) {
        onDone();
        setP(0);
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };
  const cancel = () => {
    cancelAnimationFrame(raf.current);
    setP(0);
  };

  return (
    <button
      className={`act resonate${done ? ' done' : ''}`}
      style={{ ['--h' as string]: hue, ['--p' as string]: p }}
      onPointerDown={begin}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !done) {
          e.preventDefault();
          onDone();
        }
      }}
      aria-label={done ? 'You resonated with this' : 'Resonate: press and hold'}
      aria-pressed={done}
    >
      <span className="ring" />
      <span className="ico">✦</span>
      <span>{done ? 'Resonated' : p > 0 ? 'Hold…' : 'Resonate'}</span>
    </button>
  );
}

export function MemoryCard(props: Props) {
  const { memory: m, all } = props;
  const mood = MOOD[m.mood];

  const { prev, next, echoes, parent } = useMemo(() => {
    const trail = all
      .filter((x) => x.authorKey === m.authorKey && (x.visibility === 'public' || x.mine))
      .sort((a, b) => a.createdAt - b.createdAt);
    const i = trail.findIndex((x) => x.id === m.id);
    return {
      prev: i > 0 ? trail[i - 1] : undefined,
      next: i >= 0 && i < trail.length - 1 ? trail[i + 1] : undefined,
      echoes: all.filter((x) => x.echoOf === m.id),
      parent: m.echoOf ? all.find((x) => x.id === m.echoOf) : undefined,
    };
  }, [all, m]);

  const [dir, setDir] = useState(0);
  const go = (to: Memory | undefined, d: number) => {
    if (!to) return;
    setDir(d);
    chime('tick');
    props.onNavigate(to);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
      if (e.key === 'ArrowLeft') go(prev, -1);
      if (e.key === 'ArrowRight') go(next, 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 110 && Math.abs(info.offset.x) < 80) props.onClose();
    else if (info.offset.x < -80) go(next, 1);
    else if (info.offset.x > 80) go(prev, -1);
  };

  const cx = typeof window !== 'undefined' ? window.innerWidth / 2 : 0;
  const cy = typeof window !== 'undefined' ? window.innerHeight / 2 : 0;
  const rm = reducedMotion();
  const from = rm
    ? { opacity: 0 }
    : { opacity: 0, scale: 0.08, x: props.origin.x - cx, y: props.origin.y - cy, filter: 'blur(8px)' };

  const spark = sparkById(m.sparkId);
  const companyLabel = { alone: 'alone', one: 'with someone', many: 'with many' } as const;

  return (
    <motion.div
      className="card-layer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35, delay: 0.1 } }}
      onClick={props.onClose}
    >
      <motion.article
        className="card"
        role="dialog"
        aria-modal="true"
        aria-label={`Memory by ${m.displayName}`}
        style={{ ['--h' as string]: mood.hue, ['--mood' as string]: moodColor(m.mood), ['--mood-soft' as string]: moodColor(m.mood, 0.16) }}
        initial={from}
        animate={{ opacity: 1, scale: 1, x: 0, y: 0, filter: 'blur(0px)' }}
        exit={from}
        transition={{ type: 'spring', stiffness: 170, damping: 22, mass: 0.9 }}
        drag={!rm}
        dragSnapToOrigin
        dragElastic={0.35}
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        onDragEnd={onDragEnd}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="card-close" onClick={props.onClose} aria-label="Close">
          ×
        </button>
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={m.id}
            className="card-body"
            custom={dir}
            initial={rm ? { opacity: 0 } : { opacity: 0, x: dir * 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={rm ? { opacity: 0 } : { opacity: 0, x: dir * -60 }}
            transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
          >
            {m.media && <MediaView media={m.media} mood={m.mood} />}

            {parent && (
              <button className="echo-of" onClick={() => go(parent, -1)}>
                ↩ echoing {parent.displayName}: “{parent.thought.slice(0, 48)}
                {parent.thought.length > 48 ? '…' : ''}”
              </button>
            )}

            <blockquote className="thought">{m.thought}</blockquote>

            <div className="byline">
              <span className="who">— {m.displayName}</span>
              {m.mine && <span className="pill mine">you</span>}
              {m.visibility === 'private' && <span className="pill">only you</span>}
            </div>

            <div className="chips">
              <span className="chip mood-chip">
                <span aria-hidden>{mood.glyph}</span> {mood.label}
                <span className="intensity" style={{ ['--i' as string]: m.intensity }} aria-label={`intensity ${Math.round(m.intensity * 100)}%`} />
              </span>
              <span className="chip" title={exactTime(m.createdAt)}>
                🕰 {relativeTime(m.createdAt)} · {partOfDay(m.createdAt)}
              </span>
              {m.location && m.location.precision !== 'nowhere' && <span className="chip">📍 {m.location.label}</span>}
              {m.extras?.weather && <span className="chip">{m.extras.weather}</span>}
              {m.extras?.song && <span className="chip">🎵 {m.extras.song}</span>}
              {m.extras?.company && <span className="chip">👥 {companyLabel[m.extras.company]}</span>}
              {m.extras?.tag && <span className="chip">#{m.extras.tag}</span>}
            </div>

            {spark && <p className="spark-line">answering the spark: “{spark.prompt}”</p>}

            {echoes.length > 0 && (
              <div className="echoes">
                <div className="echoes-h">{echoes.length === 1 ? '1 echo' : `${echoes.length} echoes`}</div>
                {echoes.slice(0, 3).map((e) => (
                  <button key={e.id} className="echo" onClick={() => go(e, 1)} style={{ ['--h' as string]: MOOD[e.mood].hue }}>
                    <span className="dot" /> {e.thought.slice(0, 70)}
                    {e.thought.length > 70 ? '…' : ''} <em>— {e.displayName}</em>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="actions">
          {m.mine ? (
            <span className="own-note">Your light. It glows brighter as people resonate.</span>
          ) : (
            <ResonateButton
              done={props.resonated}
              hue={mood.hue}
              onDone={() => {
                chime('resonate', (mood.hue / 30) | 0);
                props.onResonate(m);
              }}
            />
          )}
          <button className="act" onClick={() => props.onEcho(m)}>
            <span className="ico">↩</span>
            <span>Echo</span>
          </button>
          <button className="act" onClick={() => props.onShare(m)}>
            <span className="ico">⤴</span>
            <span>Share</span>
          </button>
          {m.mine && (
            <button
              className="act subtle"
              onClick={() => {
                if (confirm('Let this memory go? It will be removed from the sky.')) props.onDelete(m);
              }}
            >
              <span className="ico">⌫</span>
              <span>Remove</span>
            </button>
          )}
        </div>

        <nav className="trail-nav" aria-label="Along this constellation">
          <button onClick={() => go(prev, -1)} disabled={!prev}>
            ‹ earlier
          </button>
          <span>{m.anonymous ? 'their' : `${m.displayName}’s`} constellation</span>
          <button onClick={() => go(next, 1)} disabled={!next}>
            later ›
          </button>
        </nav>
      </motion.article>
    </motion.div>
  );
}
