# Afterglow

A shared night sky of memories. Every moment someone keeps becomes a light: its color is the mood, its brightness is how much it moved people, and its position is when it happened. Wander through time, open lights to read them, resonate, echo, and release your own.

This is the **Phase 1 feel prototype**. It is mobile-first and runs entirely in the browser, with no backend. The design is in [`docs/DESIGN_PROPOSAL.md`](docs/DESIGN_PROPOSAL.md).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
```

## Where things are

| Path | What |
|---|---|
| `src/sky/` | The Sky canvas renderer, gestures and shared camera |
| `src/components/Tide.tsx` | Timeline scrubber |
| `src/components/MemoryCard.tsx` | Reading a memory (bloom, resonate, echo, share) |
| `src/components/CatchFlow.tsx`, `MoodDial.tsx` | Creating a memory |
| `src/components/Weather.tsx` | Mood weather / trends |
| `src/lib/store.ts` | State, IndexedDB/localStorage persistence |
| `src/data/` | Seed memories and daily sparks |

Your memories stay in your browser (IndexedDB). Resonance on your own memories is simulated in this prototype so you can feel the "come back later" loop.
