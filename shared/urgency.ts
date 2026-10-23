// Urgency grows with waiting time: the longer a guest waits, the louder the card.
export type Urgency = 'calm' | 'warn' | 'late';

export const WARN_AFTER_MS = 3 * 60 * 1000;
export const LATE_AFTER_MS = 6 * 60 * 1000;

export function urgencyFor(createdAt: number, now: number): Urgency {
  const age = now - createdAt;
  if (age >= LATE_AFTER_MS) return 'late';
  if (age >= WARN_AFTER_MS) return 'warn';
  return 'calm';
}

/** "0:42", "3:05", "12:30" */
export function formatAge(createdAt: number, now: number): string {
  const s = Math.max(0, Math.floor((now - createdAt) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
