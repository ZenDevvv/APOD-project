// All date maths runs on ISO calendar strings (YYYY-MM-DD) in UTC, so a
// visitor's time zone can never shift an APOD issue onto the wrong day.

export type ISODate = string;

export const FIRST_ISSUE: ISODate = "1995-06-16";

const MS_DAY = 86_400_000;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function parts(iso: ISODate) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

export function fromParts(y: number, m: number, d: number): ISODate {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== "string") return false;
  const match = ISO_RE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

function toUTC(iso: ISODate) {
  const { y, m, d } = parts(iso);
  return Date.UTC(y, m - 1, d);
}

function fromUTC(ms: number): ISODate {
  const date = new Date(ms);
  return fromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function addDays(iso: ISODate, days: number): ISODate {
  return fromUTC(toUTC(iso) + days * MS_DAY);
}

export function daysBetween(a: ISODate, b: ISODate) {
  return Math.round((toUTC(b) - toUTC(a)) / MS_DAY);
}

export function daysInMonth(y: number, m: number) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Monday-based weekday, 0 = Monday … 6 = Sunday. */
export function weekdayMon(iso: ISODate) {
  return (new Date(toUTC(iso)).getUTCDay() + 6) % 7;
}

export function clampDate(iso: ISODate, min: ISODate, max: ISODate): ISODate {
  if (iso < min) return min;
  if (iso > max) return max;
  return iso;
}

/** NASA's endpoint addresses a day as YYMMDD. */
export function toYYMMDD(iso: ISODate) {
  return iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10);
}

export function randomDate(min: ISODate, max: ISODate): ISODate {
  const span = daysBetween(min, max);
  return addDays(min, Math.floor(Math.random() * (span + 1)));
}

/** Issue number counted in calendar days from the first APOD. */
export function dayNumber(iso: ISODate) {
  return daysBetween(FIRST_ISSUE, iso) + 1;
}

// ---- months -----------------------------------------------------------------

export type YearMonth = string; // YYYY-MM

export function monthOf(iso: ISODate): YearMonth {
  return iso.slice(0, 7);
}

export function isYearMonth(value: unknown): value is YearMonth {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function addMonths(ym: YearMonth, n: number): YearMonth {
  const [y, m] = ym.split("-").map(Number);
  const index = y * 12 + (m - 1) + n;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export function monthBounds(ym: YearMonth): [ISODate, ISODate] {
  const [y, m] = ym.split("-").map(Number);
  return [fromParts(y, m, 1), fromParts(y, m, daysInMonth(y, m))];
}

// ---- formatting ---------------------------------------------------------------

const longFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function formatLong(iso: ISODate) {
  return longFormat.format(new Date(toUTC(iso)));
}

export function formatShort(iso: ISODate) {
  const { y, m, d } = parts(iso);
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

export function formatDayMonth(iso: ISODate) {
  const { m, d } = parts(iso);
  return `${d} ${MONTHS_LONG[m - 1]}`;
}

// ---- publication clock --------------------------------------------------------

const easternParts = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Today's date and wall-clock seconds in US Eastern time, where APOD is published. */
export function easternNow(now = new Date()) {
  const p = Object.fromEntries(
    easternParts.formatToParts(now).map((part) => [part.type, part.value]),
  );
  return {
    date: `${p.year}-${p.month}-${p.day}` as ISODate,
    seconds: Number(p.hour) * 3600 + Number(p.minute) * 60 + Number(p.second),
  };
}

/** Seconds until the next issue is due (new pictures post a few minutes after midnight Eastern). */
export function secondsToNextIssue(now = new Date()) {
  const { seconds } = easternNow(now);
  const postDelay = 5 * 60;
  const due = seconds < postDelay ? postDelay : 24 * 3600 + postDelay;
  return due - seconds;
}

/** The latest date a picture could exist for. */
export function latestPossibleDate(now = new Date()): ISODate {
  return easternNow(now).date;
}
