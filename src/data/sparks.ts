export interface Spark {
  id: string;
  prompt: string;
}

const PROMPTS = [
  'What did you almost not notice today?',
  'What sound will you remember from this week?',
  'Who made today a little lighter?',
  'What are you carrying right now?',
  'What would you tell yourself a year ago?',
  'Where did your mind wander this morning?',
  'What small thing felt like a gift?',
  'What are you waiting for?',
  'What smell took you somewhere else?',
  'What did you learn the hard way recently?',
  'What does the light look like where you are?',
  'What are you proud of that no one saw?',
  'What would you like to remember about this season?',
  'What made you laugh unexpectedly?',
  'What are you letting go of?',
  'What did your hands make or fix today?',
  'Which conversation is still echoing in you?',
  'What is changing faster than you expected?',
  'What place feels like home right now?',
  'What did you see on your way somewhere?',
  'What surprised you about yourself?',
  'What do you want more of?',
  'What is the view from your window right now?',
  'What did you eat that tasted like a memory?',
  'What are you curious about lately?',
  'What would you put in a time capsule tonight?',
  'Who are you missing?',
  'What felt brave today?',
  'What made you slow down?',
  'What is one true sentence about today?',
];

export const ALL_SPARKS: Spark[] = PROMPTS.map((prompt, i) => ({ id: `s${i}`, prompt }));

const DAY = 86_400_000;

export const sparkForDate = (t: number): Spark => {
  const d = new Date(t);
  const dayIndex = Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / DAY);
  return ALL_SPARKS[((dayIndex % ALL_SPARKS.length) + ALL_SPARKS.length) % ALL_SPARKS.length];
};

export const todaysSpark = () => sparkForDate(Date.now());

export const sparkById = (id?: string) => ALL_SPARKS.find((s) => s.id === id);
