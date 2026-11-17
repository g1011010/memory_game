const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const relativeTime = (t: number, now = Date.now()) => {
  const d = now - t;
  if (d < MIN) return 'just now';
  if (d < HOUR) return `${Math.floor(d / MIN)} min ago`;
  if (d < DAY) return `${Math.floor(d / HOUR)} h ago`;
  const days = Math.floor(d / DAY);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${days < 14 ? '' : 's'} ago`;
  if (days < 365) return `${Math.floor(days / 30)} month${days < 60 ? '' : 's'} ago`;
  const y = Math.floor(days / 365);
  return `${y} year${y > 1 ? 's' : ''} ago`;
};

export const exactTime = (t: number) =>
  new Date(t).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

export const partOfDay = (t: number) => {
  const h = new Date(t).getHours();
  if (h < 5) return 'deep night';
  if (h < 9) return 'early morning';
  if (h < 12) return 'morning';
  if (h < 14) return 'midday';
  if (h < 18) return 'afternoon';
  if (h < 21) return 'evening';
  return 'night';
};

export { MIN, HOUR, DAY };
