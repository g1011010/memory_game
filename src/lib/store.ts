import { useSyncExternalStore } from 'react';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import type { Memory } from '../types';
import { seedMemories } from '../data/seed';

// ---------- safe localStorage ----------
const ls = {
  get<T>(k: string, fallback: T): T {
    try {
      const v = localStorage.getItem(k);
      return v == null ? fallback : (JSON.parse(v) as T);
    } catch {
      return fallback;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* storage unavailable: degrade silently */
    }
  },
};
export { ls };

const K = {
  resonated: 'ag.resonated',
  author: 'ag.author',
  name: 'ag.name',
  lastVisit: 'ag.lastVisit',
  intro: 'ag.introSeen',
  sound: 'ag.sound',
  draft: 'ag.draft',
};
const IDB_KEY = 'ag.memories.v1';

// ---------- identity (local only in the prototype) ----------
export const myAuthorKey = (() => {
  let k = ls.get<string | null>(K.author, null);
  if (!k) {
    k = `me-${Math.random().toString(36).slice(2, 10)}`;
    ls.set(K.author, k);
  }
  return k;
})();

export const savedName = () => ls.get<string>(K.name, '');
export const saveName = (n: string) => ls.set(K.name, n);

// ---------- state ----------
interface State {
  ready: boolean;
  memories: Memory[];
  resonated: Set<string>;
}

let state: State = {
  ready: false,
  memories: seedMemories(),
  resonated: new Set(ls.get<string[]>(K.resonated, [])),
};
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const setState = (p: Partial<State>) => {
  state = { ...state, ...p };
  emit();
};

export const useStore = <T,>(sel: (s: State) => T): T =>
  useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => sel(state),
  );
export const getState = () => state;

// ---------- persistence of the person's own memories ----------
type Stored = Omit<Memory, 'media'> & { media?: Omit<NonNullable<Memory['media']>, 'url'> };

const hydrate = (s: Stored): Memory => ({
  ...s,
  mine: true,
  media: s.media
    ? { ...s.media, url: s.media.blob ? URL.createObjectURL(s.media.blob) : '' }
    : undefined,
});

const persist = async () => {
  const mine: Stored[] = state.memories
    .filter((m) => m.mine)
    .map((m) => {
      const { media, ...rest } = m;
      if (!media) return rest;
      const { url: _url, ...mediaRest } = media;
      return { ...rest, media: mediaRest };
    });
  try {
    await idbSet(IDB_KEY, mine);
  } catch {
    /* private mode etc. */
  }
};

export const loadStore = async () => {
  let mine: Memory[] = [];
  try {
    const stored = (await idbGet<Stored[]>(IDB_KEY)) ?? [];
    mine = stored.map(hydrate);
  } catch {
    mine = [];
  }
  setState({ ready: true, memories: [...seedMemories(), ...mine] });
};

export const addMemory = (m: Memory) => {
  setState({ memories: [...state.memories, m] });
  void persist();
};

export const deleteMemory = (id: string) => {
  setState({ memories: state.memories.filter((m) => m.id !== id) });
  void persist();
};

export const resonate = (id: string) => {
  if (state.resonated.has(id)) return false;
  const next = new Set(state.resonated);
  next.add(id);
  ls.set(K.resonated, [...next]);
  setState({ resonated: next });
  return true;
};

// ---------- derived ----------
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
};

/**
 * In the prototype nobody else is online, so resonance on your own memories is
 * simulated: it grows gently with age. Phase 2 replaces this with real data.
 */
export const simulatedResonance = (m: Memory, now = Date.now()) => {
  if (!m.mine || m.visibility === 'private') return 0;
  const hours = Math.max(0, (now - m.createdAt) / 3_600_000);
  return Math.floor((2.2 + hash(m.id) * 2.5) * Math.log2(1 + hours));
};

export const resonanceOf = (m: Memory, resonated: Set<string>, now = Date.now()) =>
  m.resonance + simulatedResonance(m, now) + (resonated.has(m.id) ? 1 : 0);

// ---------- visits ----------
export const takeLastVisit = () => {
  const last = ls.get<number | null>(K.lastVisit, null);
  ls.set(K.lastVisit, Date.now());
  return last;
};
export const introSeen = () => ls.get<boolean>(K.intro, false);
export const markIntroSeen = () => ls.set(K.intro, true);
export const soundPref = () => ls.get<boolean>(K.sound, false);
export const saveSoundPref = (v: boolean) => ls.set(K.sound, v);
export const loadDraft = <T,>() => ls.get<T | null>(K.draft, null);
export const saveDraft = (d: unknown) => ls.set(K.draft, d);
export const clearDraft = () => ls.set(K.draft, null);
