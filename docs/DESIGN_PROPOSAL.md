# Afterglow: Design Proposal

> *A living sky of the moments people choose to keep.*

Status: **Approved, Phase 1 built.** See §14 for the decisions taken and what the Phase 1 prototype contains.

---

## 1. Concept

Afterglow is a shared night sky. **Every memory someone adds becomes a light in that sky.** You wander it like a game world, open lights to read what people were thinking, and release your own moment into it.

What makes it a game-like *experience* and not a feed:

| Feed apps | Afterglow |
|---|---|
| Infinite vertical scroll | One explorable space (the Sky) that you drift through |
| Likes and follower counts | *Resonance*: memories glow brighter when they move people |
| Posts go stale | Memories **age visibly** (they cool, drift, and settle into constellations) and can be **revisited, answered, and re-opened** later |
| Engagement through outrage | Engagement through ritual: a daily spark, time capsules, anniversaries, "then and now" |

**Design pillars**

1. **One place.** Everything starts from, and returns to, the Sky. No navigation maze. Features open as layers over it and close back into it.
2. **Every action has a payoff moment.** Opening, posting, resonating and returning each come with a small piece of choreography (sound, motion, light).
3. **Slow and warm, not loud.** It should feel calm and meaningful. No red badges and no counts that create anxiety.
4. **Time is the main mechanic.** The product gets more valuable the longer you use it: your trail grows, capsules unlock, and the collective mood shifts.

---

## 2. The Main Page: "The Sky"

The single home screen. It is full-bleed, dark, and alive.

```
┌──────────────────────────────────────────────────────────────┐
│  afterglow                    ◐ Mood weather      ○ You     │
│                                                              │
│        ·      ✦                 ·        ·                   │
│   ·         ·     ✧  ·    ✦            ·      ✧              │
│        ✦        ·        ·   ✦   ·             ·             │
│   ·        ✧  ·    ·  ✦          ·    ✦   ·                  │
│       ·          ✦ ─── ✦ ─── ✧        ·          ·          │
│   ✧       ·   ·    (a constellation)       ✦                 │
│        ·        ✦          ·      ·    ·         ✧           │
│                                                              │
│   "Today's spark:  What did you almost not notice today?"    │
│                                                              │
│  ◄━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━●━━━► now       │
│   2025        spring        summer         autumn            │
│                                      ( ✦ Catch a moment )    │
└──────────────────────────────────────────────────────────────┘
```

### 2.1 Visual language of a memory-light

Each light encodes its data, so the sky itself is a visualization:

| Property | Encodes |
|---|---|
| **Hue** | Mood chosen by the author (see §5) |
| **Brightness / bloom** | Resonance from other people (logarithmic, so a quiet memory is never invisible) |
| **Size** | Richness: thought only < with image < with video |
| **Twinkle / pulse** | Freshness. Memories from the last 24 h shimmer, then settle over days |
| **Position (x)** | Time, aligned with the timeline scrubber |
| **Position (y)** | Soft clustering by mood or theme (embedding-based) so similar feelings float near each other |
| **Ring** | One of *your* memories, or one you have resonated with |
| **Lines** | Constellations: memories linked by the same author, the same spark, or a reply ("echo") |

### 2.2 Interactions on the Sky

- **Drift:** drag or pan to move, pinch or scroll to zoom. Ambient parallax on mouse move or device tilt.
- **Hover / long-press:** a light swells and shows a one-line preview ("*'The bakery still smells the same'*, Lisbon, 3 days ago").
- **Tap:** the light **blooms** into a Memory Card (§3). The sky dims and blurs behind it.
- **Timeline scrubber (the Tide):** drag back through time and the sky rearranges, showing what the world was feeling then. Snap points mark notable days.
- **Lenses** (small toggles, top right). They re-color and re-arrange the *same* sky:
  - **Mood:** default, hue by mood.
  - **Place:** lights glide onto a dark, minimal globe or map, by (fuzzed) location.
  - **Me:** everything except your own trail fades out, so your personal constellation stands out.
  - **Sparks:** clustered by daily prompt.
- **Shooting stars:** occasionally a fresh memory streaks in live as someone posts it. Tap it to catch it.

### 2.3 Empty / first-visit state

No login wall. The sky fades in from black over about 2 s, then **one** memory drifts to the center and opens by itself: a curated, beautiful example. One line of copy:

> *"These are moments people chose to keep. Wander. When you're ready, add yours."*

The first visit has to make someone feel something within about 10 seconds.

---

## 3. Memory Card (reading)

A card that unfolds from the light it came from. The animation starts at the light's position, so the user never loses their place.

```
        ┌──────────────────────────────────────┐
        │  ▶ [ 6-second clip / photo, looping ]│
        │                                      │
        │  "I finally understood why my dad    │
        │   used to just sit on the porch."    │
        │                                      │
        │  — Mara                              │
        │  🌅 Nostalgic · tender                │
        │  📍 Near Asheville, NC   🕰 Oct 3, 2026 · 6:41 pm │
        │  ☁ 14°C, light rain   🎵 "Holocene"  │
        │                                      │
        │  ✦ Resonate      ↩ Echo      ⟳ Then & now (2) │
        └──────────────────────────────────────┘
          ‹ prev in constellation   next ›
```

- **Media first.** The video autoplays muted and loops (≤ 10 s); tap for sound. Photos get a subtle Ken Burns drift.
- **Ambient metadata** is shown as small, poetic chips, not form fields. Relative time is shown first ("3 days ago"), with the exact timestamp on hover.
- **Actions** (no public counts by default, see §8):
  - **✦ Resonate:** a press-and-hold of about 600 ms. The card warms, particles fly *back into the sky*, and the light visibly brightens. One per person per memory. It is deliberate, not a reflexive tap.
  - **↩ Echo:** reply with your own short memory. It becomes a new light linked to this one by a thread of light.
  - **⟳ Then & now:** if the author has revisited this memory later, the versions sit side by side (§6.3).
- **Swipe left / right** walks along the constellation; **swipe down** or tap outside closes the card, and it collapses back into its light.

---

## 4. "Catch a moment" (creating)

The most important workflow. It should feel like a ritual, not a form. It is a full-screen, step-by-step flow, with each step on its own screen. Every step except the thought can be skipped.

| # | Step | UX detail |
|---|---|---|
| 0 | **Invitation** | The button pulses gently. Tapping it pulls the sky inward and an empty, unlit "seed" light appears in the center. |
| 1 | **The thought** *(required)* | A large serif text field, and the daily spark as placeholder text (it can be swapped for another spark). Max 280 characters. The seed light grows faintly as you type. |
| 2 | **Mood** | A **mood dial**: a circular color wheel with 8 named moods (§5) plus intensity (distance from the center). The seed takes on that color live, and the background aurora shifts. |
| 3 | **Image / clip** | Camera or upload. Video is trimmed in-app to ≤ 10 s with a simple scrubber. Faces are not auto-detected or tagged. EXIF data is stripped. |
| 4 | **Place** *(optional)* | "Use where I am" uses the browser's geolocation, then **automatically blurs it to roughly city or neighborhood level**. A precision slider lets the author choose *Exact spot / Neighborhood / City / Country / Nowhere*. The default is neighborhood. |
| 5 | **Extras** *(optional, one screen of chips)* | Weather (auto-fetched), what you're listening to, who you're with ("alone / with someone / with many"), a tag, and **"Seal as a time capsule"** (§6.2). |
| 6 | **Name** | Display name, pre-filled. Toggle for *Anonymous*. Visibility: *Public sky / Only me (private journal) / Capsule*. |
| 7 | **Release** | A preview card, then the **Release** button. The card folds into the seed, the seed lifts off with a soft chime, arcs into the sky and settles into its place. The camera follows it and then pulls out to show it among everyone else's. Final copy: *"It's up there now. Come back and see how it glows."* |

Drafts autosave locally, so closing the flow never loses work.

---

## 5. Moods and the "Mood Weather"

### 5.1 Mood palette (8 moods + intensity)

| Mood | Hue | Example feelings |
|---|---|---|
| Joyful | warm gold | delight, excitement |
| Grateful | amber | thankful, content |
| Calm | soft teal | peaceful, still |
| Tender | rose | love, affection |
| Nostalgic | lavender | wistful, remembering |
| Curious | electric cyan | wonder, anticipation |
| Heavy | deep indigo | sad, tired, grieving |
| Restless | ember red | anxious, angry, unsettled |

The author picks the mood, and the system never overrides it. A lightweight text-sentiment model can *suggest* a mood as a pre-selected hint, which the author can change with one tap.

### 5.2 Mood weather (trends)

Opened from the **◐** button. It slides down over the sky like a weather report.

- **Today's sky:** a single aurora gradient made of the mix of moods in the last 24 h, with one sentence: *"The world is mostly Calm today, with a rising streak of Restless in Europe."*
- **Mood tide:** a stream graph of moods over weeks and months. Scrubbing it scrubs the sky too.
- **Mood map:** a choropleth of the dominant mood by region (only regions with at least *k* memories, for privacy).
- **Rising words:** words and themes trending in thoughts this week, shown as a slow-drifting word cloud.
- **Your weather** (only visible to you): your own mood over time, and gentle observations such as *"You've caught 4 Grateful moments this month, more than any month before."* There are no diagnoses and no judgement.

---

## 6. Coming back: time as the core mechanic

These are the reasons to return. Each one ties directly to time passing and none of them depend on guilt.

### 6.1 Your Trail (personal constellation)
Every memory you add connects to your previous one, so you draw a constellation over the months. Zoomed out on the **Me** lens, it is a picture of your life drawn in light. You can name your constellation, and you can export it as a poster image or share card.

### 6.2 Time capsules
Seal a memory to open on a date: *1 month / 1 year / 5 years / custom*, and either *for me* or *for the public sky*. Until then it appears as a dim, locked orb that pulses slightly as the date nears. When it opens, there is an email or push notification, and a dedicated **opening ceremony** animation in which the orb cracks into light. Then you are prompted: *"What would you tell yourself back then?"*, and your answer creates a linked Then & Now pair.

### 6.3 Then & Now / Anniversaries
- "On this day" resurfacing: *"One year ago tonight, you wrote…"*, with a one-tap **Revisit** button that starts the Catch flow with the old memory shown alongside.
- When you post near the same place, or answer the same spark again, Afterglow offers to link the two memories.
- Revisited memories show both versions on one card, side by side, with a slider between *then* and *now*.

### 6.4 Daily spark
One shared prompt per day for everyone (curated, and occasionally community-voted). Answering it lights up that day's spark cluster. The game element here is a gentle **streak** shown as a growing ring of lights around your avatar. A missed day leaves a dim gap, never a reset to zero and never a loss message.

### 6.5 "While you were away"
On return, before the sky settles, a short (skippable) fly-through:
- *"Your memory from Tuesday has resonated with 12 people."* The camera flies to it and it glows.
- *"2 people echoed your thought."*
- *"A capsule opens in 3 days."*
- The sky then settles into its new state, visibly changed since your last visit.

### 6.6 Collections and milestones (light-touch achievements)
Quiet discoveries, never pushed in your face: *First light*, *Seven sparks*, *Seasons* (posted in all four), *Wanderer* (memories from 3+ places), *Echo chamber* (a thread of 5 echoes). They appear as tiny glyphs in your constellation.

---

## 7. Sharing

- **Share card:** any memory renders to an attractive vertical image or short video (light, quote, mood color, place, date) sized for stories, with a link back to that exact light in the sky.
- **Deep links:** `/m/{id}` opens the sky already zoomed into that light, mid-bloom. Recipients land *inside* the experience, not on a static page.
- **Invite to a constellation:** a private shared constellation for a couple, family or friend group (a joint trail and joint capsules). Phase 2.

---

## 8. Trust, safety and privacy

This kind of product lives or dies on feeling safe.

- **Location is fuzzed by default**, on the server, to the chosen precision (geohash truncation). The exact coordinates are never stored unless *Exact* is chosen, and even then they are only shown publicly at neighborhood precision.
- **No public counts by default.** Resonance shows only as brightness. Authors can see their own numbers privately.
- **Anonymous posting** is always available. Accounts are required to post (to reduce abuse) but not to browse.
- **Moderation pipeline:** automatic text, image and video classification on upload, then queue → publish. Report button on every card. Rate limits for new accounts.
- **Heavy moods:** if a memory signals crisis language, it is held back from the public sky, and the author is gently shown support resources. It is never shamed and never auto-published.
- **Media:** EXIF stripped, video ≤ 10 s / ≤ 20 MB, images resized, all transcoded server-side.
- **Ownership:** delete anything at any time, export all your data (JSON + media zip).

---

## 9. Accessibility and performance

- **List mode:** a fully accessible chronological list of memory cards as an alternative to the canvas, toggleable and screen-reader-friendly. The canvas mirrors focus into it.
- **`prefers-reduced-motion`:** cross-fades replace blooms and flights, and there is no parallax or twinkle.
- Every mood color is paired with an icon and name, so color is never the only signal.
- **Performance budget:** 60 fps with about 5,000 lights on a mid-range phone (WebGL instanced points, with levels of detail). Lights beyond view are loaded in time and space tiles. First paint < 1.5 s using a static, pre-rendered sky image that cross-fades to the live canvas.
- **Sound** (soft chimes, ambient pad) is off until the user opts in, with one global toggle.

---

## 10. Data model (initial)

```ts
Memory {
  id: string
  authorId: string | null          // null = anonymous display (author still known to moderation)
  displayName: string
  thought: string                  // ≤ 280 chars, required
  mood: MoodKey                    // 'joyful' | 'grateful' | 'calm' | 'tender' | 'nostalgic' | 'curious' | 'heavy' | 'restless'
  moodIntensity: number            // 0..1
  createdAt: timestamp             // server time
  capturedAt: timestamp            // when the moment happened (may be earlier)
  timezone: string
  location?: { geohash: string, precision: 'exact'|'neighborhood'|'city'|'country', label: string }
  media?: { kind: 'image'|'video', url: string, posterUrl: string, width, height, durationMs? }
  extras?: { weather?: {tempC, condition}, song?: {title, artist}, company?: 'alone'|'one'|'many', tags?: string[] }
  sparkId?: string                 // daily prompt answered
  echoOf?: string                  // memory this replies to
  revisitOf?: string               // earlier memory this is a "now" for
  visibility: 'public' | 'private' | 'capsule'
  capsule?: { opensAt: timestamp, audience: 'self'|'public', opened: boolean }
  resonanceCount: number           // private to author; drives brightness
  embedding?: vector               // for mood/theme clustering on the y-axis
  moderation: 'pending' | 'approved' | 'held' | 'removed'
}

User      { id, displayName, constellationName?, streak, joinedAt, settings }
Resonance { memoryId, userId, createdAt }            // unique (memoryId, userId)
Spark     { id, date, prompt }
Milestone { userId, key, earnedAt }
```

---

## 11. Proposed tech stack

| Layer | Choice | Why |
|---|---|---|
| App | **Next.js (App Router) + TypeScript** | SSR for share links and SEO, API routes, one deployable unit |
| Sky rendering | **PixiJS (WebGL)** with instanced sprites and custom glow shaders; **d3-scale / d3-zoom** for the time axis and pan/zoom | Handles thousands of animated lights smoothly. Lighter than three.js for 2.5D |
| UI motion | **Framer Motion** for card blooms and flows; **Howler.js** for sound | Shared-layout animations make the light-to-card transitions possible |
| Styling | Tailwind CSS + CSS variables for mood tokens | Fast iteration, consistent theming |
| Backend | **Supabase**: Postgres + PostGIS + pgvector, Auth, Storage, Realtime | Geo queries, embeddings, live "shooting stars", auth (magic link / OAuth) in one service |
| Media | Client-side compress and trim (ffmpeg.wasm for video, canvas for images) → Storage → server transcode | Keeps uploads small and quick |
| Jobs | Scheduled functions for capsule openings, daily spark, mood-weather aggregates | |
| Notifications | Email (Resend) + Web Push | Capsules, anniversaries, echoes |

**Prototype path:** Phase 1 can run entirely client-side with seeded mock data and `localStorage`, so the UX can be validated before any backend exists.

---

## 12. Phased roadmap

| Phase | Scope | Goal |
|---|---|---|
| **1. Feel prototype** | The Sky (mood lens, pan/zoom, timeline), Memory Card bloom, the Catch-a-moment flow with the release animation, around 300 seeded memories, local storage only | Prove the *feeling*. Test with 5 to 10 people |
| **2. Real & shared** | Supabase backend, auth, media upload, fuzzed location, resonate and echo, moderation v1, share cards and deep links | Public alpha |
| **3. Time mechanics** | Daily spark + streak ring, time capsules + opening ceremony, "On this day", Then & Now, "While you were away" | Retention |
| **4. Mood weather** | Trends panel, mood map, rising words, personal weather, Place lens (globe) | Collective insight |
| **5. Together** | Shared private constellations, poster export, sound design pass, milestones | Depth and virality |

---

## 13. Open questions (resolved, see §14)

1. **Name & tone:** is "Afterglow" and the night-sky metaphor right? Alternatives considered: *Tidepool* (memories as creatures in water), *Driftwood*, *Field of Lanterns*.
2. **"Optical location":** I read this as **optional location**. If you meant something else (for example, visual or scene recognition from the photo), tell me.
3. **Accounts:** require sign-in to post (recommended), or allow fully anonymous posting?
4. **Public numbers:** keep resonance counts hidden (recommended), or show them?
5. **Phase 1 scope:** start with the client-only feel prototype (recommended), or go straight to a real backend?
6. **Platform priority:** mobile-first web (recommended), desktop-first, or equal weight?

---

## 14. Decisions (Nov 2026)

| # | Question | Decision |
|---|---|---|
| 1 | Name & tone | **Afterglow**, night-sky metaphor |
| 2 | "Optical location" | **Optional** location, blurred by default |
| 3 | Accounts | Phase 1: none (local only). Phase 2: **sign-in required to post, Anonymous display always available, browsing open**. Revisit after alpha. |
| 4 | Public counts | **Hidden.** Resonance shows only as brightness. Authors see their own numbers privately. Revisit after alpha. |
| 5 | Phase 1 scope | Client-only feel prototype |
| 6 | Platform | Mobile-first web |

### What Phase 1 contains

- **The Sky** on a 2D canvas (no PixiJS yet; it handles the prototype's volume with headroom). Includes mood bands, glow encoding, constellations, echo threads, pan, pinch, wheel and inertia, the shooting star and an aurora that follows the moods in view.
- **The Tide** timeline with a mood ribbon, scrubbing and a "now" button.
- **Lenses:** Everyone / My trail, plus a tap-to-isolate mood rail.
- **Memory Card:** bloom from the light, swipe along the constellation, hold-to-resonate, Echo, Share (deep link `#/m/<id>`) and Remove (own memories).
- **Catch a moment:** all 7 steps (thought, mood dial, photo or clip with a 10 s window, blurred place, extras, signature and visibility, release flight). Drafts autosave.
- **Mood weather:** a forecast sentence, this week's mix, the 13-month mood tide (with a table view), rising words and "your weather".
- **"While you were away"** on return, intro on first visit, optional sound (WebAudio), a list view for accessibility, and `prefers-reduced-motion` support.
- **Storage:** your memories live in IndexedDB (media included) and resonances in localStorage. Images are re-encoded client-side, which strips EXIF.
- **Seed content:** about 115 hand-written memories with generated imagery.
- **Simulated (prototype only):** resonance on *your own* memories grows gently over time so the return loop can be felt. Phase 2 replaces this with real data.

### Chart colors
The sky uses the luminous mood hues in `src/moods.ts`. Charts use a separate, validated `chart` step per mood and the stacking order `CHART_ORDER` (warm and cool interleaved). This passes the lightness-band, chroma, CVD (adjacent ΔE ≥ 10.6) and normal-vision (ΔE ≥ 25.6) checks against the `#0b0d1f` surface. Every chart also has text labels and a legend, and the tide chart has a table view.
