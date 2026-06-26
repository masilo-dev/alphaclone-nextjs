import { addDays, addWeeks, nextDay, parseISO, startOfDay, type Day } from 'date-fns';

const WEEKDAYS: Record<string, Day> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/** Parse ISO dates and common natural-language due dates for task inserts. */
export function parseFlexibleDueDate(input: unknown): string | null {
  if (input == null || input === '') return null;
  if (typeof input !== 'string') return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  const iso = parseISO(trimmed);
  if (!Number.isNaN(iso.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return iso.toISOString();
  }

  const today = startOfDay(new Date());
  const lower = trimmed.toLowerCase();

  if (lower === 'today') return today.toISOString();
  if (lower === 'tomorrow') return addDays(today, 1).toISOString();

  const inDays = lower.match(/^in\s+(\d+)\s+days?$/);
  if (inDays) return addDays(today, Number(inDays[1])).toISOString();

  const inWeeks = lower.match(/^in\s+(\d+)\s+weeks?$/);
  if (inWeeks) return addWeeks(today, Number(inWeeks[1])).toISOString();

  const nextWeekday = lower.match(/^(?:next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/);
  if (nextWeekday) {
    const day = WEEKDAYS[nextWeekday[1]];
    let target = nextDay(today, day);
    if (target.getTime() <= today.getTime()) {
      target = addDays(target, 7);
    }
    return target.toISOString();
  }

  const absolute = Date.parse(trimmed);
  if (!Number.isNaN(absolute)) {
    return new Date(absolute).toISOString();
  }

  return null;
}
