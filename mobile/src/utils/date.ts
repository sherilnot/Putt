// All meal dates belong to the mess's calendar, so format them in its time zone rather than
// the phone's (a customer in Perth must still see Monday's meals on Monday).
export const MESS_TIME_ZONE = 'Australia/Sydney';

const DAY_MS = 86400000;

export const fmtDate = (d: string | number | Date, opts: Intl.DateTimeFormatOptions) =>
  new Date(d).toLocaleDateString('en-AU', { timeZone: MESS_TIME_ZONE, ...opts });

/** Day of the month in the mess's time zone, e.g. "9". */
export const dayOfMonth = (d: string | number | Date) => fmtDate(d, { day: 'numeric' });

/** Midday on the i-th day after `weekStart` (midday so DST shifts can't change the date). */
export const addDays = (weekStart: string | Date, i: number) => new Date(new Date(weekStart).getTime() + i * DAY_MS + DAY_MS / 2);

/** "YYYY-MM-DD" for today (+ offset days) in the mess's time zone, for API date filters. */
export const messISODate = (offsetDays = 0) => messISODateOf(new Date(Date.now() + offsetDays * DAY_MS));

/** Grouping key for a calendar day in the mess's time zone. */
export const messDayKey = (d: string | Date) => messISODateOf(d);
export const messISODateOf = (d: string | Date) => {
  // Built from parts so the result doesn't depend on how a locale orders dates
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-AU', { timeZone: MESS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date(d))
      .map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};
