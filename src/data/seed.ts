import type { Memory, MoodKey } from '../types';
import { sparkForDate } from './sparks';

// Deterministic PRNG so the seeded sky is the same on every visit.
export const mulberry32 = (a: number) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

type Seed = [MoodKey, string];

const THOUGHTS: Seed[] = [
  ['joyful', 'The bus driver waited for me. Ran the last ten meters laughing like a kid.'],
  ['joyful', 'First swim of the year. The water was freezing and I screamed and it was perfect.'],
  ['joyful', 'My daughter read a whole page out loud without stopping. She looked up like she had invented reading.'],
  ['joyful', 'Got the job. Sat in the car for ten minutes just grinning at the steering wheel.'],
  ['joyful', 'Someone was playing piano in the train station and a stranger started singing. Half the hall joined in.'],
  ['joyful', 'We danced in the kitchen while the pasta boiled over. Worth it.'],
  ['joyful', 'The first tomato from the balcony. Tiny, lopsided, best thing I have eaten all year.'],
  ['joyful', 'My grandmother learned to send voice messages. She sends me forty a day now.'],
  ['joyful', 'Snow on the first day of the holidays. The whole street came outside.'],
  ['joyful', 'Finished my first 10k. Last place in my age group and I could not care less.'],
  ['joyful', 'The dog met the ocean for the first time and barked at every single wave.'],
  ['joyful', 'Our band played a real gig. Eleven people came. Eleven!'],
  ['joyful', 'Fixed the bike myself. Grease up to my elbows. Felt like a wizard.'],
  ['joyful', 'A kid on the tram waved at me for six stops straight.'],
  ['grateful', 'My neighbor left soup on my doorstep when she heard I was sick. No note. Just soup.'],
  ['grateful', 'Thankful for the friend who calls just to say nothing in particular.'],
  ['grateful', 'The nurse held my hand during the scan and told me about her cats. I will never forget her.'],
  ['grateful', 'Morning coffee on the steps, sun on my face. That is the whole entry.'],
  ['grateful', 'My dad and I finally talked. Really talked. Twenty years late, still on time.'],
  ['grateful', 'Two years sober today. Bought myself flowers.'],
  ['grateful', 'The library is warm and free and full of people being quiet together.'],
  ['grateful', 'My body carried me up the mountain. I forget to thank it.'],
  ['grateful', 'Someone paid for my groceries when my card failed. I will pass it on.'],
  ['grateful', 'Old friends, long table, nobody looked at their phone for three hours.'],
  ['grateful', 'The power came back on after four days. I cried at a light bulb.'],
  ['grateful', 'Lucky to have a mother who still sends postcards from her own town.'],
  ['grateful', 'My students wrote me letters on my last day. I read them on the beach.'],
  ['calm', 'Rain on the skylight. Book on my chest. Did not move for an hour.'],
  ['calm', 'Fog over the lake at 6am. Only the sound of oars.'],
  ['calm', 'Folded laundry still warm from the dryer. Simple, good.'],
  ['calm', 'Sat on a bench and watched the pigeons organize their whole society.'],
  ['calm', 'Night shift is over. The city is blue and empty and it all belongs to me for a moment.'],
  ['calm', 'Planted bulbs I will not see until spring. A small promise to my future self.'],
  ['calm', 'The cat chose my lap. I cancelled my plans.'],
  ['calm', 'Long train ride, no signal, a window full of fields. I forgot to be anxious.'],
  ['calm', 'Washing dishes by hand after a dinner party. The house humming with leftover laughter.'],
  ['calm', 'Breathing slower than I have in months. The therapist said that is enough for today.'],
  ['calm', 'Watched the tide come all the way in. Nothing else.'],
  ['calm', 'The smell of the first fire in the fireplace this year.'],
  ['calm', 'Swimming laps in an empty pool at dawn. Counting, then not counting.'],
  ['tender', 'My son fell asleep holding my finger like he did when he was a baby. He is nine.'],
  ['tender', 'She still saves me the crispy corner of the lasagna. Twenty-two years.'],
  ['tender', 'Found my grandfather\'s handwriting in an old recipe book. "More salt than you think."'],
  ['tender', 'He learned sign language for my sister\'s wedding. Everyone cried.'],
  ['tender', 'My best friend braided my hair before the interview, like at school.'],
  ['tender', 'Holding my newborn niece. She smells like bread and the future.'],
  ['tender', 'Old couple on the bench, sharing one pair of earbuds.'],
  ['tender', 'Wrote a letter to my mom that I will give her on her birthday. I have rewritten it five times.'],
  ['tender', 'My partner warmed my side of the bed before I came home.'],
  ['tender', 'The kids made breakfast. Mostly sugar. Entirely love.'],
  ['tender', 'Walked my dad to the clinic, his arm through mine. We used to do this the other way around.'],
  ['tender', 'A stranger helped my grandmother across the ice and then they talked for twenty minutes.'],
  ['nostalgic', 'Heard the song from our road trip in a supermarket and had to stand very still.'],
  ['nostalgic', 'Visited my old school. The hallways are so much smaller than my memory of them.'],
  ['nostalgic', 'Emptied my childhood bedroom. Kept the glow-in-the-dark stars.'],
  ['nostalgic', 'The bakery on the corner still smells exactly the same. I am thirty-four and seven at once.'],
  ['nostalgic', 'Found an old voicemail from my aunt. Played it three times.'],
  ['nostalgic', 'Ten years since I moved to this city with one suitcase.'],
  ['nostalgic', 'My first apartment is a coffee shop now. I ordered something where my bed used to be.'],
  ['nostalgic', 'Late summer light through the trees. It always feels like the end of something.'],
  ['nostalgic', 'Played the board game from our childhood with my brother. Still cheats. Still lose.'],
  ['nostalgic', 'The last day at the old house. Measured the doorframe one more time.'],
  ['nostalgic', 'Reading letters we wrote in high school. We were so certain about everything.'],
  ['nostalgic', 'Cherry season again. Mom always made us spit the pits off the balcony.'],
  ['nostalgic', 'I finally understood why my dad used to just sit on the porch.'],
  ['curious', 'Saw a bioluminescent bay tonight. Every stroke of my hand made stars.'],
  ['curious', 'Started learning Japanese at 61. My teacher is 19. We are both nervous.'],
  ['curious', 'Why do I only think clearly in the shower? Researching. For science.'],
  ['curious', 'Moving to a country where I do not know a single person. Terrified, mostly excited.'],
  ['curious', 'Took apart the old radio just to see. Did not put it back together. Learned so much.'],
  ['curious', 'The telescope arrived. Saturn has rings. I knew that, but now I KNOW that.'],
  ['curious', 'Asked a stranger what book she was reading. Now I have a new favorite author.'],
  ['curious', 'Tried a new route home and found a whole park I never knew existed.'],
  ['curious', 'What if I just said yes to everything this month? Day 3.'],
  ['curious', 'Watched ants carry a leaf ten times their size up a wall for twenty minutes.'],
  ['curious', 'First day of art class. I cannot draw. I drew anyway.'],
  ['curious', 'Night market, a language I do not speak, pointed at things and loved them all.'],
  ['curious', 'Wondering what this place looked like a hundred years ago, standing in the same spot.'],
  ['heavy', 'First birthday without her. I baked her cake anyway.'],
  ['heavy', 'The house is too quiet since the dog died. I still listen for his tags.'],
  ['heavy', 'Tired in a way sleep does not fix.'],
  ['heavy', 'We said goodbye at the airport. I will not see him for a year.'],
  ['heavy', 'Lost the job today. Sitting in the park pretending it is lunch break.'],
  ['heavy', 'Visited the hospital again. The vending machine and I are on a first-name basis.'],
  ['heavy', 'Some days the grief is a wave, some days it is just weather.'],
  ['heavy', 'My friend moved away and I did not realise she was my whole routine.'],
  ['heavy', 'Rain all week. Not sad exactly. Just grey inside, too.'],
  ['heavy', 'Cleaning out my mother\'s closet. Her perfume is still in every sweater.'],
  ['heavy', 'Saying no to things I love because I have nothing left. Learning that is okay.'],
  ['restless', 'Cannot sleep. The whole future is sitting on my chest.'],
  ['restless', 'Waiting for test results. Every phone buzz is a small earthquake.'],
  ['restless', 'Everyone seems to know where they are going except me.'],
  ['restless', 'Quit my job this morning. No plan yet. Heart racing in a good-bad way.'],
  ['restless', 'Angry at the news, angry at myself for refreshing it.'],
  ['restless', 'The city feels too small lately. I keep looking at train timetables.'],
  ['restless', 'Thirty tabs open. In my browser and in my brain.'],
  ['restless', 'Moving day is in three days and I have packed one box. It has cables in it.'],
  ['restless', 'Exam tomorrow. I have read the same paragraph eleven times.'],
  ['restless', 'Want to change everything and nothing at the same time.'],
  ['calm', 'Snow muffling the whole city. Even the traffic is whispering.'],
  ['grateful', 'The baker gave me yesterday\'s bread for free and winked. Small kindness, whole day changed.'],
  ['curious', 'Learned that octopuses dream. Thinking about it all day.'],
  ['joyful', 'My parents renewed their vows in the garden. Dad forgot his lines. Mom finished them for him.'],
  ['tender', 'We named the star after her. It is not official. It does not need to be.'],
  ['nostalgic', 'Found a film camera with an undeveloped roll. Afraid and excited to see what we were.'],
  ['heavy', 'The anniversary always sneaks up on me. Sat with it today instead of running.'],
  ['calm', 'Tea, rain, a cello on the radio. The afternoon stretched out like a cat.'],
  ['joyful', 'Spontaneous road trip with no destination. Ended up at a sunflower field at golden hour.'],
  ['grateful', 'Recovered enough to walk around the block. The block has never looked this beautiful.'],
  ['curious', 'The aurora was supposed to be invisible this far south. It was not.'],
  ['restless', 'First night in the new flat. Every sound is a stranger.'],
  ['tender', 'Teaching my dad to video call so he can see the baby every day.'],
  ['nostalgic', 'My hometown has a new bridge. I liked the old ferry.'],
];

const NAMES = [
  'Mara', 'Jonas', 'Aiko', 'Léa', 'Samuel', 'Priya', 'Tomás', 'Nadia', 'Eli', 'Ingrid', 'Kofi', 'Yuna',
  'Rafael', 'Sofia', 'Omar', 'Hana', 'Lucas', 'Amara', 'Finn', 'Zeynep', 'Mateo', 'Ava', 'Kenji', 'Noor',
  'Elena', 'Ravi', 'Chloe', 'Bruno', 'Lina', 'Arjun', 'Freya', 'Diego',
];

const PLACES: [string, number, number][] = [
  ['Near Lisbon, Portugal', 38.72, -9.14],
  ['Near Asheville, NC', 35.6, -82.55],
  ['Kyoto, Japan', 35.01, 135.77],
  ['Near Berlin, Germany', 52.52, 13.4],
  ['Mexico City', 19.43, -99.13],
  ['Near Accra, Ghana', 5.6, -0.19],
  ['Melbourne, Australia', -37.81, 144.96],
  ['Near Montréal, Canada', 45.5, -73.57],
  ['Istanbul, Türkiye', 41.01, 28.97],
  ['Near Bergen, Norway', 60.39, 5.32],
  ['Buenos Aires, Argentina', -34.6, -58.38],
  ['Near Pune, India', 18.52, 73.86],
  ['Seoul, South Korea', 37.57, 126.98],
  ['Near Edinburgh, Scotland', 55.95, -3.19],
  ['Cape Town, South Africa', -33.92, 18.42],
  ['Near Portland, OR', 45.52, -122.68],
  ['Marseille, France', 43.3, 5.37],
  ['Near Reykjavík, Iceland', 64.15, -21.94],
  ['São Paulo, Brazil', -23.55, -46.63],
  ['Near Kraków, Poland', 50.06, 19.94],
];

const WEATHER = ['☀ 24°C, clear', '☁ 12°C, overcast', '🌧 9°C, light rain', '❄ -2°C, snow', '🌫 7°C, fog', '⛅ 18°C, breezy'];
const SONGS = ['"Holocene" · Bon Iver', '"Harvest Moon" · Neil Young', '"Clair de Lune" · Debussy', '"Dreams" · Fleetwood Mac', '"Pink + White" · Frank Ocean', '"Retrograde" · James Blake', '"Here Comes the Sun" · The Beatles', '"Nuvole Bianche" · Einaudi'];

const DAY = 86_400_000;

let cache: Memory[] | null = null;

export const seedMemories = (now = Date.now()): Memory[] => {
  if (cache) return cache;
  const rand = mulberry32(20261117);
  const out: Memory[] = [];
  // A small cast of recurring authors so constellations appear.
  const authors = NAMES.map((n, i) => ({ name: n, key: `seed-${i}`, home: PLACES[i % PLACES.length] }));
  const span = 220 * DAY;

  THOUGHTS.forEach(([mood, thought], i) => {
    // Skew toward recent: more lights near "now".
    const r = rand();
    const age = Math.pow(r, 1.7) * span + rand() * DAY;
    let createdAt = now - age;
    // A handful of very fresh memories so the sky shimmers on arrival.
    if (i % 17 === 0) createdAt = now - rand() * DAY * 0.9;
    const author = authors[Math.floor(rand() * authors.length)];
    const anonymous = rand() < 0.12;
    const hasPlace = rand() < 0.82;
    const place = rand() < 0.7 ? author.home : PLACES[Math.floor(rand() * PLACES.length)];
    const hasArt = rand() < 0.45;
    const h1 = (Math.floor(rand() * 360) + 0) % 360;
    out.push({
      id: `seed-${i}`,
      displayName: anonymous ? 'Anonymous' : author.name,
      anonymous,
      thought,
      mood,
      intensity: 0.35 + rand() * 0.65,
      createdAt,
      location: hasPlace
        ? { label: place[0], lat: place[1], lng: place[2], precision: 'city' }
        : undefined,
      media: hasArt
        ? { kind: 'image', url: '', art: { hues: [h1, (h1 + 30 + rand() * 120) % 360], seed: Math.floor(rand() * 1e9) } }
        : undefined,
      extras: {
        weather: rand() < 0.5 ? WEATHER[Math.floor(rand() * WEATHER.length)] : undefined,
        song: rand() < 0.25 ? SONGS[Math.floor(rand() * SONGS.length)] : undefined,
        company: rand() < 0.4 ? (['alone', 'one', 'many'] as const)[Math.floor(rand() * 3)] : undefined,
      },
      sparkId: rand() < 0.4 ? sparkForDate(createdAt).id : undefined,
      authorKey: author.key,
      resonance: Math.floor(Math.pow(rand(), 2.2) * 140),
      visibility: 'public',
    });
  });

  // A few echoes: link memories with the same mood that are close in time.
  const sorted = [...out].sort((a, b) => a.createdAt - b.createdAt);
  for (let i = 5; i < sorted.length; i += 9) {
    const m = sorted[i];
    const parent = sorted.slice(Math.max(0, i - 8), i).reverse().find((p) => p.mood === m.mood && p.authorKey !== m.authorKey);
    if (parent) m.echoOf = parent.id;
  }

  cache = out;
  return out;
};
