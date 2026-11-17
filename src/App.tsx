import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Memory, MoodKey } from './types';
import { MOOD } from './moods';
import { Sky, type Lens, type SkyHandle } from './sky/Sky';
import { cam, flyTo } from './sky/camera';
import { Tide } from './components/Tide';
import { MemoryCard } from './components/MemoryCard';
import { CatchFlow } from './components/CatchFlow';
import { Weather } from './components/Weather';
import {
  addMemory,
  deleteMemory,
  introSeen,
  loadStore,
  markIntroSeen,
  resonanceOf,
  resonate,
  saveSoundPref,
  simulatedResonance,
  soundPref,
  takeLastVisit,
  useStore,
} from './lib/store';
import { todaysSpark } from './data/sparks';
import { relativeTime, DAY } from './lib/time';
import { chime, setSound } from './lib/sound';

interface Selected {
  id: string;
  origin: { x: number; y: number };
}

interface Away {
  gained: number;
  lights: number;
  brightest?: Memory;
  since: number;
}

const center = () => ({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

export default function App() {
  const ready = useStore((s) => s.ready);
  const memories = useStore((s) => s.memories);
  const resonated = useStore((s) => s.resonated);
  const sky = useRef<SkyHandle>(null);

  const [selected, setSelected] = useState<Selected | null>(null);
  const [hover, setHover] = useState<{ m: Memory; x: number; y: number } | null>(null);
  const [catching, setCatching] = useState<{ echoOf?: Memory } | null>(null);
  const [weather, setWeather] = useState(false);
  const [list, setList] = useState(false);
  const [lens, setLens] = useState<Lens>('mood');
  const [moodFilter, setMoodFilter] = useState<MoodKey | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sound, setSoundState] = useState(soundPref());
  const [intro, setIntro] = useState(!introSeen());
  const [away, setAway] = useState<Away | null>(null);
  const [firstHint, setFirstHint] = useState(false);
  const toastTimer = useRef(0);
  // Read the deep link once, before the URL-sync effect can clear it.
  const [deepLink] = useState(() => location.hash.match(/^#\/m\/(.+)$/)?.[1]);

  const spark = useMemo(() => todaysSpark(), []);
  const byId = useMemo(() => new Map(memories.map((m) => [m.id, m])), [memories]);
  const selectedMemory = selected ? byId.get(selected.id) : undefined;
  const mineCount = useMemo(() => memories.filter((m) => m.mine).length, [memories]);

  const say = useCallback((msg: string, ms = 3800) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), ms);
  }, []);

  const resOf = useCallback((m: Memory) => resonanceOf(m, resonated), [resonated]);

  // ---------- boot ----------
  useEffect(() => {
    void loadStore();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const last = takeLastVisit();
    const mine = memories.filter((m) => m.mine && m.visibility === 'public');
    if (last && Date.now() - last > 20 * 60_000 && mine.length) {
      let gained = 0;
      let brightest: Memory | undefined;
      let best = -1;
      for (const m of mine) {
        const before = simulatedResonance(m, Math.max(last, m.createdAt));
        const nowR = simulatedResonance(m);
        gained += Math.max(0, nowR - before);
        if (nowR > best) {
          best = nowR;
          brightest = m;
        }
      }
      if (gained > 0) setAway({ gained, lights: mine.length, brightest, since: last });
    }
    // Deep link: #/m/<id>
    if (deepLink) {
      const id = decodeURIComponent(deepLink);
      if (memories.some((m) => m.id === id)) {
        setIntro(false);
        markIntroSeen();
        setTimeout(() => openById(id), 300);
      }
    }
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setSound(sound), [sound]);

  // Keep the URL in sync with the open memory (shareable).
  const syncedOnce = useRef(false);
  useEffect(() => {
    if (!syncedOnce.current) {
      syncedOnce.current = true;
      if (deepLink) return;
    }
    const want = selected ? `#/m/${encodeURIComponent(selected.id)}` : '';
    if (location.hash !== want) history.replaceState(null, '', want || location.pathname + location.search);
  }, [selected]);

  // ---------- actions ----------
  const openById = (id: string) => {
    sky.current?.focus(id, () => {
      const p = sky.current?.screenPos(id) ?? center();
      chime('open', (MOOD[byIdRef.current.get(id)?.mood ?? 'calm'].hue / 30) | 0);
      setSelected({ id, origin: p });
    });
  };
  const byIdRef = useRef(byId);
  byIdRef.current = byId;

  const enter = () => {
    markIntroSeen();
    setIntro(false);
    const curated = memories.find((m) => m.thought.startsWith('I finally understood why my dad')) ?? memories[0];
    setTimeout(() => openById(curated.id), 700);
    setFirstHint(true);
  };

  const onSelect = (m: Memory, x: number, y: number) => {
    setHover(null);
    chime('open', (MOOD[m.mood].hue / 30) | 0);
    setSelected({ id: m.id, origin: { x, y } });
  };

  const closeCard = () => {
    setSelected(null);
    if (firstHint) {
      setFirstHint(false);
      setTimeout(() => say('Drag to travel through time · pinch to zoom · tap any light', 5200), 500);
    }
  };

  const navigate = (m: Memory) => {
    setSelected((s) => (s ? { ...s, id: m.id } : s));
    sky.current?.focus(m.id, () => {
      const p = sky.current?.screenPos(m.id);
      if (p) setSelected((s) => (s && s.id === m.id ? { ...s, origin: p } : s));
    });
  };

  const onResonate = (m: Memory) => {
    if (resonate(m.id)) {
      sky.current?.pulse(m.id);
      say(`Your warmth reached ${m.anonymous ? 'them' : m.displayName}. Their light grows brighter.`);
    }
  };

  const onShare = async (m: Memory) => {
    const url = `${location.origin}${location.pathname}#/m/${encodeURIComponent(m.id)}`;
    const text = `“${m.thought}” — ${m.displayName}, on Afterglow`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'A memory on Afterglow', text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      say('Link copied. It opens right at this light.');
    } catch {
      /* cancelled */
    }
  };

  const onRelease = (m: Memory) => {
    addMemory(m);
    setCatching(null);
    setSelected(null);
    setMoodFilter(null);
    if (m.visibility === 'private') setLens('me');
    setTimeout(() => {
      sky.current?.release(m.id, () => {
        say(
          m.visibility === 'private'
            ? 'Kept safe in your own trail. Only you can see it.'
            : 'It’s up there now. Come back later and see how it glows.',
          5200,
        );
      });
    }, 80);
  };

  const startCatch = (echoOf?: Memory) => {
    setSelected(null);
    setWeather(false);
    setList(false);
    setCatching({ echoOf });
  };

  const toggleSound = () => {
    const v = !sound;
    setSoundState(v);
    saveSoundPref(v);
    setSound(v);
    if (v) chime('open');
  };

  const toggleLens = (l: Lens) => {
    setLens(l);
    if (l === 'me' && mineCount === 0) say('Your trail is still empty. Catch your first moment ✦');
    if (l === 'me' && mineCount > 0) {
      const mine = memories.filter((m) => m.mine).sort((a, b) => a.createdAt - b.createdAt);
      const span = Math.max(14 * DAY, mine[mine.length - 1].createdAt - mine[0].createdAt);
      flyTo((mine[0].createdAt + mine[mine.length - 1].createdAt) / 2, (span * 1.4) / cam.width, 1200);
    }
  };

  const overlayOpen = !!(selected || catching || weather || list || intro);
  useEffect(() => {
    if (weather || list || catching) setToast(null);
  }, [weather, list, catching]);

  return (
    <div className={`app${overlayOpen ? ' overlay-open' : ''}`}>
      <Sky
        ref={sky}
        memories={memories}
        resonanceOf={resOf}
        lens={lens}
        moodFilter={moodFilter}
        selectedId={selected?.id ?? null}
        onSelect={onSelect}
        onHover={setHover}
        onMoodLabel={(k) => setMoodFilter((f) => (f === k ? null : k))}
      />

      {/* ---------- top bar ---------- */}
      <header className="topbar">
        <div className="brand">
          <span className="brand-dot" />
          afterglow
        </div>
        <div className="top-actions">
          <div className="seg" role="group" aria-label="Lens">
            <button className={lens === 'mood' ? 'on' : ''} onClick={() => toggleLens('mood')} aria-pressed={lens === 'mood'}>
              Everyone
            </button>
            <button className={lens === 'me' ? 'on' : ''} onClick={() => toggleLens('me')} aria-pressed={lens === 'me'}>
              My trail
            </button>
          </div>
          <button className="icon-btn" onClick={() => setWeather(true)} aria-label="Mood weather" title="Mood weather">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" /></svg>
          </button>
          <button className="icon-btn" onClick={() => setList(true)} aria-label="List view" title="List view">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden><path d="M5 7h14M5 12h14M5 17h9" /></svg>
          </button>
          <button className="icon-btn" onClick={toggleSound} aria-label={sound ? 'Sound off' : 'Sound on'} title="Sound" aria-pressed={sound}>
            {sound ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden><path d="M4 10v4h3l5 4V6L7 10z" fill="currentColor" /><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden><path d="M4 10v4h3l5 4V6L7 10z" fill="currentColor" /><path d="M16 9.5l5 5M21 9.5l-5 5" /></svg>
            )}
          </button>
        </div>
      </header>

      {moodFilter && (
        <button className="filter-pill" onClick={() => setMoodFilter(null)} style={{ ['--h' as string]: MOOD[moodFilter].hue }}>
          {MOOD[moodFilter].glyph} Only {MOOD[moodFilter].label.toLowerCase()} <span>×</span>
        </button>
      )}

      {/* ---------- hover preview (pointer devices) ---------- */}
      <AnimatePresence>
        {hover && !overlayOpen && (
          <motion.div
            key={hover.m.id}
            className="hover-tip"
            style={{
              left: Math.min(window.innerWidth - 150, Math.max(150, hover.x)),
              top: hover.y < 220 ? hover.y + 26 : hover.y - 26,
              ['--h' as string]: MOOD[hover.m.mood].hue,
            }}
            data-below={hover.y < 220}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <span className="q">“{hover.m.thought.length > 70 ? hover.m.thought.slice(0, 68) + '…' : hover.m.thought}”</span>
            <span className="meta">
              {MOOD[hover.m.mood].glyph} {hover.m.displayName}
              {hover.m.location ? ` · ${hover.m.location.label}` : ''} · {relativeTime(hover.m.createdAt)}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------- bottom: spark, tide, catch ---------- */}
      <div className="bottom">
        <button className="spark" onClick={() => startCatch()}>
          <span className="spark-k">Today’s spark</span>
          <span className="spark-q">{spark.prompt}</span>
        </button>
        <Tide memories={memories} onNow={() => sky.current?.toNow()} />
        <button className="catch-btn" onClick={() => startCatch()}>
          <span className="catch-orb" />
          Catch a moment
        </button>
      </div>

      {/* ---------- overlays ---------- */}
      <AnimatePresence>
        {selected && selectedMemory && (
          <MemoryCard
            key="card"
            memory={selectedMemory}
            origin={selected.origin}
            all={memories}
            resonated={resonated.has(selectedMemory.id)}
            onClose={closeCard}
            onNavigate={navigate}
            onResonate={onResonate}
            onEcho={(m) => startCatch(m)}
            onDelete={(m) => {
              setSelected(null);
              deleteMemory(m.id);
              say('Let go. The light has faded from the sky.');
            }}
            onShare={onShare}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {catching && <CatchFlow key="catch" echoOf={catching.echoOf} onClose={() => setCatching(null)} onRelease={onRelease} />}
      </AnimatePresence>

      <AnimatePresence>{weather && <Weather key="w" memories={memories} onClose={() => setWeather(false)} />}</AnimatePresence>

      <AnimatePresence>
        {list && (
          <ListView
            key="list"
            memories={memories}
            lens={lens}
            moodFilter={moodFilter}
            onClose={() => setList(false)}
            onOpen={(m) => {
              setList(false);
              setSelected({ id: m.id, origin: center() });
              sky.current?.focus(m.id);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {away && !intro && !selected && !catching && (
          <motion.div
            className="away"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ delay: 0.8, type: 'spring', stiffness: 120, damping: 18 }}
            role="status"
          >
            <div className="away-k">While you were away · {relativeTime(away.since)}</div>
            <div className="away-t">
              Your {away.lights === 1 ? 'light' : `${away.lights} lights`} moved <strong>{away.gained}</strong> more{' '}
              {away.gained === 1 ? 'person' : 'people'}.
            </div>
            <div className="row">
              {away.brightest && (
                <button
                  className="primary-soft"
                  onClick={() => {
                    const id = away.brightest!.id;
                    setAway(null);
                    openById(id);
                  }}
                >
                  Show me
                </button>
              )}
              <button className="ghost" onClick={() => setAway(null)}>
                Later
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {intro && (
          <motion.div className="intro" initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 1.2 } }}>
            <motion.div
              className="intro-inner"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 1.4, ease: [0.2, 0.7, 0.2, 1] }}
            >
              <div className="intro-orb" />
              <h1>afterglow</h1>
              <p>These are moments people chose to keep.</p>
              <p className="dim">Wander. When you’re ready, add yours.</p>
              <button className="enter" onClick={enter}>
                Enter the sky
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            className="toast"
            role="status"
            initial={{ opacity: 0, y: 16, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 8, x: '-50%' }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ListView({
  memories,
  lens,
  moodFilter,
  onClose,
  onOpen,
}: {
  memories: Memory[];
  lens: Lens;
  moodFilter: MoodKey | null;
  onClose: () => void;
  onOpen: (m: Memory) => void;
}) {
  const items = memories
    .filter((m) => (lens === 'me' ? m.mine : m.visibility === 'public' || m.mine))
    .filter((m) => !moodFilter || m.mood === moodFilter)
    .sort((a, b) => b.createdAt - a.createdAt);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <motion.div
      className="list-layer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="All memories as a list"
    >
      <header className="weather-head">
        <h2>
          {lens === 'me' ? 'My trail' : 'All memories'}
          {moodFilter ? ` · ${MOOD[moodFilter].label}` : ''} <small>{items.length}</small>
        </h2>
        <button className="ghost" onClick={onClose} aria-label="Close list">
          ×
        </button>
      </header>
      <ul className="list">
        {items.map((m) => (
          <li key={m.id}>
            <button className="list-item" onClick={() => onOpen(m)} style={{ ['--h' as string]: MOOD[m.mood].hue }}>
              <span className="dot" aria-hidden />
              <span className="li-body">
                <span className="li-q">{m.thought}</span>
                <span className="li-meta">
                  {MOOD[m.mood].glyph} {MOOD[m.mood].label} · {m.displayName}
                  {m.location ? ` · ${m.location.label}` : ''} · {relativeTime(m.createdAt)}
                  {m.media ? (m.media.kind === 'video' ? ' · ▶ clip' : ' · ◻ photo') : ''}
                </span>
              </span>
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="empty">Nothing here yet.</li>}
      </ul>
    </motion.div>
  );
}
