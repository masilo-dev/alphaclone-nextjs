import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';

export function validateTimezone(timezone: string): string {
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(); }
  catch { throw new Error('A valid IANA timezone is required'); }
  return timezone;
}

/** Offset timestamps are absolute; local timestamps require an explicit zone. */
export function resolveScheduleTime(value: string, timezone?: string, now = new Date()): string {
  if (timezone) validateTimezone(timezone);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$/.test(value)) {
    throw new Error('scheduled_at must be an ISO date and time');
  }
  const components = /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2})(?::([0-9]{2}))?/.exec(value)!.slice(1).map(v => Number(v || 0));
  const [y, m, d, h, min, sec = 0] = components;
  if (m < 1 || m > 12 || d < 1 || d > new Date(Date.UTC(y, m, 0)).getUTCDate() || h > 23 || min > 59 || sec > 59) throw new Error('Invalid calendar date or clock time');
  const explicitOffset = /(?:Z|[+-]\d{2}:\d{2})$/.test(value);
  if (!explicitOffset && !timezone) throw new Error('Local scheduled_at requires a timezone; or include a UTC offset');
  const date = explicitOffset ? new Date(value) : fromZonedTime(value, timezone!);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid scheduled_at');
  if (!explicitOffset) {
    const local = value.slice(0, 16);
    if (formatInTimeZone(date, timezone!, "yyyy-MM-dd'T'HH:mm") !== local) {
      throw new Error('This local time does not exist because of daylight saving; choose another time');
    }
    // An ambiguous repeated clock time must carry an offset to select the instant.
    for (const delta of [-120, -60, -30, 30, 60, 120]) {
      if (formatInTimeZone(new Date(date.getTime() + delta * 60_000), timezone!, "yyyy-MM-dd'T'HH:mm") === local) {
        throw new Error('This local time occurs twice because of daylight saving; include a UTC offset');
      }
    }
  }
  if (date.getTime() <= now.getTime()) throw new Error('scheduled_at must be in the future');
  return date.toISOString();
}

const limits = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 6]];
function fieldValues(field: string, min: number, max: number): Set<number> {
  const values = new Set<number>();
  for (const part of field.split(',')) {
    const match = /^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/.exec(part);
    if (!match) throw new Error('Invalid cron field');
    const stride = match[2] ? Number(match[2]) : 1;
    if (stride < 1 || stride > max - min + 1) throw new Error('Invalid cron interval');
    const range = match[1] === '*' ? [min, max] : match[1].split('-').map(Number);
    const start = range[0], end = range[1] ?? (match[2] ? max : start);
    if (start < min || end > max || start > end) throw new Error('Cron value is outside its range');
    for (let n = start; n <= end; n += stride) values.add(n);
  }
  return values;
}
export function parseCron(schedule: string): Set<number>[] {
  const fields = schedule.trim().split(/\s+/);
  if (fields.length !== 5) throw new Error('A five-field cron schedule is required');
  return fields.map((field, i) => fieldValues(field, limits[i][0], limits[i][1]));
}
export function nextCronRun(schedule: string, timezone: string, after = new Date()): Date {
  validateTimezone(timezone);
  const sets = parseCron(schedule);
  const fields = schedule.trim().split(/\s+/);
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, minute: '2-digit', hour: '2-digit', hourCycle: 'h23', day: '2-digit', month: '2-digit', weekday: 'short' });
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let stamp = Math.floor(after.getTime() / 60_000) * 60_000 + 60_000;
  for (let i = 0; i < 366 * 24 * 60 * 5; i++, stamp += 60_000) {
    const parts = Object.fromEntries(formatter.formatToParts(stamp).map(p => [p.type, p.value]));
    const day = sets[2].has(Number(parts.day)), weekday = sets[4].has(weekdays.indexOf(parts.weekday));
    const calendarMatch = fields[2] === '*' ? weekday : fields[4] === '*' ? day : day || weekday;
    if (sets[0].has(Number(parts.minute)) && sets[1].has(Number(parts.hour)) && sets[3].has(Number(parts.month)) && calendarMatch) return new Date(stamp);
  }
  throw new Error('No matching run within five years');
}
