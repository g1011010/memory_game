import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Memory, MemoryExtras, MemoryMedia, MoodKey, Precision } from '../types';
import { MOOD, moodColor } from '../moods';
import { MoodDial } from './MoodDial';
import { MediaView } from './MemoryCard';
import { ALL_SPARKS, todaysSpark, type Spark } from '../data/sparks';
import { clearDraft, loadDraft, myAuthorKey, saveDraft, saveName, savedName } from '../lib/store';
import { chime } from '../lib/sound';
import { reducedMotion } from '../sky/camera';
import { partOfDay } from '../lib/time';

interface Draft {
  thought: string;
  mood: MoodKey | null;
  intensity: number;
  placeLabel: string;
  lat?: number;
  lng?: number;
  precision: Precision;
  extras: MemoryExtras;
  name: string;
  anonymous: boolean;
  visibility: 'public' | 'private';
  sparkId?: string;
}

const STEPS = ['thought', 'mood', 'media', 'place', 'extras', 'name', 'release'] as const;
type Step = (typeof STEPS)[number];
const STEP_TITLE: Record<Step, string> = {
  thought: 'What is the moment?',
  mood: 'How does it feel?',
  media: 'Add what you see',
  place: 'Where are you?',
  extras: 'A few more details',
  name: 'How should it be signed?',
  release: 'Ready to let it go?',
};

const MAX_VIDEO = 10;
const PRECISION: { key: Precision; label: string; decimals: number | null }[] = [
  { key: 'exact', label: 'Exact spot', decimals: 3 },
  { key: 'neighborhood', label: 'Neighborhood', decimals: 2 },
  { key: 'city', label: 'City', decimals: 1 },
  { key: 'country', label: 'Country', decimals: 0 },
  { key: 'nowhere', label: 'Nowhere', decimals: null },
];
const WEATHER = ['☀ sunny', '⛅ mixed', '☁ cloudy', '🌧 rain', '❄ snow', '🌫 fog', '🌬 windy', '🌙 clear night'];

/** Re-encode an image: downsizes it and drops EXIF metadata (incl. GPS). */
const processImage = async (file: File): Promise<Blob> => {
  const bmp = await createImageBitmap(file);
  const max = 1600;
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', 0.86));
};

const fuzz = (v: number, decimals: number) => Math.round(v * 10 ** decimals) / 10 ** decimals;

export function CatchFlow({
  echoOf,
  onClose,
  onRelease,
}: {
  echoOf?: Memory;
  onClose: () => void;
  onRelease: (m: Memory) => void;
}) {
  const initial = useMemo<Draft>(() => {
    const d = !echoOf ? loadDraft<Draft>() : null;
    return (
      d ?? {
        thought: '',
        mood: null,
        intensity: 0.6,
        placeLabel: '',
        precision: 'neighborhood',
        extras: {},
        name: savedName(),
        anonymous: false,
        visibility: 'public',
        sparkId: echoOf ? undefined : todaysSpark().id,
      }
    );
  }, [echoOf]);

  const [d, setD] = useState<Draft>(initial);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [media, setMedia] = useState<MemoryMedia | null>(null);
  const [videoDur, setVideoDur] = useState(0);
  const [mediaErr, setMediaErr] = useState('');
  const [geoState, setGeoState] = useState<'idle' | 'asking' | 'ok' | 'denied'>('idle');
  const [releasing, setReleasing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const rm = reducedMotion();

  const spark: Spark | undefined = ALL_SPARKS.find((s) => s.id === d.sparkId);
  const cur = STEPS[step];
  const up = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));

  useEffect(() => {
    if (!echoOf) saveDraft(d);
  }, [d, echoOf]);

  useEffect(() => {
    if (cur === 'thought') setTimeout(() => textRef.current?.focus(), 350);
  }, [cur]);

  const canNext = cur !== 'thought' || d.thought.trim().length > 0;
  const go = (delta: number) => {
    const n = step + delta;
    if (n < 0) return onClose();
    if (n >= STEPS.length) return;
    if (delta > 0 && !canNext) return;
    setDir(delta);
    chime('tick', n);
    setStep(n);
  };

  const shuffleSpark = () => {
    const others = ALL_SPARKS.filter((s) => s.id !== d.sparkId);
    up({ sparkId: others[Math.floor(Math.random() * others.length)].id });
  };

  const pickFile = async (f: File | undefined) => {
    setMediaErr('');
    if (!f) return;
    if (f.size > 80 * 1024 * 1024) {
      setMediaErr('That file is a bit large. Try something under 80 MB.');
      return;
    }
    if (f.type.startsWith('image/')) {
      try {
        const blob = await processImage(f);
        setMedia({ kind: 'image', blob, url: URL.createObjectURL(blob) });
      } catch {
        setMediaErr('Could not read that image.');
      }
    } else if (f.type.startsWith('video/')) {
      const url = URL.createObjectURL(f);
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.src = url;
      v.onloadedmetadata = () => {
        const dur = v.duration || 0;
        setVideoDur(dur);
        setMedia({ kind: 'video', blob: f, url, start: 0, end: Math.min(dur, MAX_VIDEO) });
      };
      v.onerror = () => setMediaErr('Could not read that video.');
    } else {
      setMediaErr('Images or short videos only.');
    }
  };

  const useLocation = () => {
    if (!('geolocation' in navigator)) return setGeoState('denied');
    setGeoState('asking');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoState('ok');
        const p = PRECISION.find((x) => x.key === d.precision) ?? PRECISION[1];
        const dec = p.decimals ?? 2;
        const lat = fuzz(pos.coords.latitude, dec);
        const lng = fuzz(pos.coords.longitude, dec);
        up({
          lat,
          lng,
          precision: p.key === 'nowhere' ? 'neighborhood' : p.key,
          placeLabel: d.placeLabel || `Near ${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(1)}°${lng >= 0 ? 'E' : 'W'}`,
        });
      },
      () => setGeoState('denied'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  };

  const setPrecision = (p: Precision) => {
    const dec = PRECISION.find((x) => x.key === p)?.decimals;
    up({
      precision: p,
      lat: d.lat != null && dec != null ? fuzz(d.lat, dec) : p === 'nowhere' ? undefined : d.lat,
      lng: d.lng != null && dec != null ? fuzz(d.lng, dec) : p === 'nowhere' ? undefined : d.lng,
    });
  };

  const build = (): Memory => {
    const name = d.anonymous ? 'Anonymous' : d.name.trim() || 'Someone';
    return {
      id: `me-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      displayName: name,
      anonymous: d.anonymous,
      thought: d.thought.trim(),
      mood: d.mood ?? 'calm',
      intensity: d.mood ? d.intensity : 0.5,
      createdAt: Date.now(),
      location:
        d.precision !== 'nowhere' && d.placeLabel.trim()
          ? { label: d.placeLabel.trim(), lat: d.lat, lng: d.lng, precision: d.precision }
          : undefined,
      media: media ?? undefined,
      extras: Object.keys(d.extras).length ? d.extras : undefined,
      sparkId: d.sparkId,
      echoOf: echoOf?.id,
      authorKey: myAuthorKey,
      resonance: 0,
      mine: true,
      visibility: d.visibility,
    };
  };

  const release = () => {
    if (releasing) return;
    setReleasing(true);
    if (!d.anonymous && d.name.trim()) saveName(d.name.trim());
    chime('release', d.mood ? (MOOD[d.mood].hue / 30) | 0 : 0);
    const m = build();
    if (!echoOf) clearDraft();
    setTimeout(() => onRelease(m), rm ? 50 : 900);
  };

  // The seed: a small light that grows with your words and takes on your mood.
  const seedHue = d.mood ? MOOD[d.mood].hue : 230;
  const seedSize = 26 + Math.min(1, d.thought.length / 200) * 26 + (media ? 10 : 0) + (d.mood ? d.intensity * 14 : 0);
  const preview = useMemo(() => (cur === 'release' ? build() : null), [cur, d, media]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.div
      className="catch"
      style={{ ['--h' as string]: seedHue, ['--mood' as string]: d.mood ? moodColor(d.mood) : 'hsl(230 60% 75%)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.4 } }}
      role="dialog"
      aria-modal="true"
      aria-label="Catch a moment"
    >
      <div className="catch-aurora" />
      <header className="catch-head">
        <button className="ghost" onClick={() => go(-1)}>
          {step === 0 ? 'Cancel' : '‹ Back'}
        </button>
        <div className="dots" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <span key={s} className={`dot${i === step ? ' on' : i < step ? ' done' : ''}`} />
          ))}
        </div>
        <button className="ghost" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>

      <motion.div
        className={`seed${releasing ? ' go' : ''}`}
        animate={
          releasing && !rm
            ? { y: -window.innerHeight * 0.6, scale: 0.3, opacity: 0 }
            : { width: seedSize, height: seedSize }
        }
        transition={releasing ? { duration: 0.9, ease: [0.5, 0, 0.75, 0] } : { type: 'spring', stiffness: 120, damping: 14 }}
        aria-hidden
      />

      <div className="catch-stage">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.section
            key={cur}
            className={`catch-step step-${cur}`}
            initial={rm ? { opacity: 0 } : { opacity: 0, x: dir * 40, filter: 'blur(6px)' }}
            animate={releasing && !rm ? { opacity: 0, scale: 0.6, y: -120 } : { opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={rm ? { opacity: 0 } : { opacity: 0, x: dir * -40, filter: 'blur(6px)' }}
            transition={{ duration: 0.38, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <h2 className="step-title">
              {echoOf && cur === 'thought' ? `Echo ${echoOf.displayName}` : STEP_TITLE[cur]}
            </h2>

            {cur === 'thought' && (
              <>
                {echoOf ? (
                  <p className="step-sub">
                    Replying to “{echoOf.thought}”. Your light will be joined to theirs by a thread.
                  </p>
                ) : spark ? (
                  <p className="step-sub">
                    Today’s spark: <em>{spark.prompt}</em>{' '}
                    <button className="link" onClick={shuffleSpark}>
                      another
                    </button>{' '}
                    ·{' '}
                    <button className="link" onClick={() => up({ sparkId: undefined })}>
                      write freely
                    </button>
                  </p>
                ) : (
                  <p className="step-sub">
                    Anything at all: a thought, a quote, something you saw.{' '}
                    <button className="link" onClick={shuffleSpark}>
                      give me a spark
                    </button>
                  </p>
                )}
                <textarea
                  ref={textRef}
                  className="thought-input"
                  value={d.thought}
                  maxLength={280}
                  placeholder={echoOf ? 'This reminds me of…' : spark?.prompt ?? 'Right now…'}
                  onChange={(e) => up({ thought: e.target.value })}
                  rows={5}
                />
                <div className="count">
                  {d.thought.length}/280 · {partOfDay(Date.now())}
                </div>
              </>
            )}

            {cur === 'mood' && <MoodDial mood={d.mood} intensity={d.intensity} onChange={(mood, intensity) => up({ mood, intensity })} />}

            {cur === 'media' && (
              <div className="media-step">
                {media ? (
                  <>
                    <MediaView media={media} mood={d.mood ?? 'calm'} compact />
                    {media.kind === 'video' && videoDur > MAX_VIDEO && (
                      <label className="trim">
                        <span>
                          Choose your {MAX_VIDEO} seconds · from {media.start?.toFixed(1)}s
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={Math.max(0, videoDur - MAX_VIDEO)}
                          step={0.1}
                          value={media.start ?? 0}
                          onChange={(e) => {
                            const s = parseFloat(e.target.value);
                            setMedia({ ...media, start: s, end: s + MAX_VIDEO });
                          }}
                        />
                      </label>
                    )}
                    <div className="row">
                      <button className="ghost" onClick={() => fileRef.current?.click()}>
                        Replace
                      </button>
                      <button className="ghost" onClick={() => setMedia(null)}>
                        Remove
                      </button>
                    </div>
                  </>
                ) : (
                  <button className="drop" onClick={() => fileRef.current?.click()}>
                    <span className="big">◎</span>
                    <span>Take or choose a photo, or a clip up to {MAX_VIDEO} seconds</span>
                    <small>Location data hidden in photos is removed.</small>
                  </button>
                )}
                {mediaErr && <p className="err">{mediaErr}</p>}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,video/*"
                  hidden
                  onChange={(e) => {
                    void pickFile(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </div>
            )}

            {cur === 'place' && (
              <div className="place-step">
                <button className="primary-soft" onClick={useLocation} disabled={geoState === 'asking'}>
                  {geoState === 'asking' ? 'Finding you…' : geoState === 'ok' ? '✓ Found you (blurred)' : '📍 Use where I am'}
                </button>
                {geoState === 'denied' && <p className="hint">No problem. Just type a place name, or skip.</p>}
                <input
                  className="text-input"
                  value={d.placeLabel}
                  placeholder="Name this place, e.g. “Grandma’s kitchen, Porto”"
                  onChange={(e) => up({ placeLabel: e.target.value })}
                  maxLength={60}
                />
                <div className="label-sm">How precisely should others see it?</div>
                <div className="chips choose">
                  {PRECISION.map((p) => (
                    <button key={p.key} className={`chip${d.precision === p.key ? ' on' : ''}`} onClick={() => setPrecision(p.key)}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <p className="hint">
                  We blur your location to the level you choose. Exact coordinates are never shown to anyone else.
                </p>
              </div>
            )}

            {cur === 'extras' && (
              <div className="extras-step">
                <div className="label-sm">The weather</div>
                <div className="chips choose">
                  {WEATHER.map((w) => (
                    <button
                      key={w}
                      className={`chip${d.extras.weather === w ? ' on' : ''}`}
                      onClick={() => up({ extras: { ...d.extras, weather: d.extras.weather === w ? undefined : w } })}
                    >
                      {w}
                    </button>
                  ))}
                </div>
                <div className="label-sm">Who are you with?</div>
                <div className="chips choose">
                  {(
                    [
                      ['alone', 'Alone'],
                      ['one', 'With someone'],
                      ['many', 'With many'],
                    ] as const
                  ).map(([k, l]) => (
                    <button
                      key={k}
                      className={`chip${d.extras.company === k ? ' on' : ''}`}
                      onClick={() => up({ extras: { ...d.extras, company: d.extras.company === k ? undefined : k } })}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <div className="label-sm">What are you listening to?</div>
                <input
                  className="text-input"
                  value={d.extras.song ?? ''}
                  placeholder="A song, the rain, silence…"
                  maxLength={60}
                  onChange={(e) => up({ extras: { ...d.extras, song: e.target.value || undefined } })}
                />
                <div className="label-sm">One word for it</div>
                <input
                  className="text-input"
                  value={d.extras.tag ?? ''}
                  placeholder="beginnings"
                  maxLength={24}
                  onChange={(e) => up({ extras: { ...d.extras, tag: e.target.value.replace(/\s+/g, '').replace(/^#/, '') || undefined } })}
                />
              </div>
            )}

            {cur === 'name' && (
              <div className="name-step">
                <input
                  className="text-input big"
                  value={d.anonymous ? '' : d.name}
                  disabled={d.anonymous}
                  placeholder={d.anonymous ? 'Anonymous' : 'Your first name'}
                  maxLength={32}
                  onChange={(e) => up({ name: e.target.value })}
                />
                <label className="toggle">
                  <input type="checkbox" checked={d.anonymous} onChange={(e) => up({ anonymous: e.target.checked })} />
                  <span className="sw" />
                  Sign it anonymously
                </label>
                <div className="label-sm">Who can see it?</div>
                <div className="vis">
                  <button className={`vis-opt${d.visibility === 'public' ? ' on' : ''}`} onClick={() => up({ visibility: 'public' })}>
                    <strong>✦ The public sky</strong>
                    <span>Anyone wandering can find it.</span>
                  </button>
                  <button className={`vis-opt${d.visibility === 'private' ? ' on' : ''}`} onClick={() => up({ visibility: 'private' })}>
                    <strong>☾ Only me</strong>
                    <span>A private light, visible in your own trail.</span>
                  </button>
                </div>
              </div>
            )}

            {cur === 'release' && preview && (
              <div className="release-step">
                <div className="preview-card" style={{ ['--mood' as string]: moodColor(preview.mood) }}>
                  {preview.media && <MediaView media={preview.media} mood={preview.mood} compact />}
                  <blockquote className="thought small">{preview.thought}</blockquote>
                  <div className="byline">
                    <span className="who">— {preview.displayName}</span>
                  </div>
                  <div className="chips">
                    <span className="chip mood-chip">
                      {MOOD[preview.mood].glyph} {MOOD[preview.mood].label}
                    </span>
                    {preview.location && <span className="chip">📍 {preview.location.label}</span>}
                    {preview.visibility === 'private' && <span className="chip">only you</span>}
                  </div>
                </div>
                {!d.mood && <p className="hint">No mood chosen, so it will glow a calm teal.</p>}
              </div>
            )}
          </motion.section>
        </AnimatePresence>
      </div>

      <footer className="catch-foot">
        {cur === 'release' ? (
          <button className="release-btn" onClick={release} disabled={releasing}>
            <span>{releasing ? 'Releasing…' : 'Release into the sky'}</span>
          </button>
        ) : (
          <>
            {cur !== 'thought' && (
              <button className="ghost" onClick={() => go(1)}>
                Skip
              </button>
            )}
            <button className="next-btn" onClick={() => go(1)} disabled={!canNext}>
              Continue
            </button>
          </>
        )}
      </footer>
    </motion.div>
  );
}
