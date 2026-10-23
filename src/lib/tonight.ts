import { readJSON, writeJSON } from "./storage";

// "Can I see the sky tonight?" from three free sources:
// Open-Meteo (cloud cover, sunset and sunrise), NOAA SWPC (planetary Kp index) and
// Launch Library 2 by The Space Devs (upcoming launches). None needs a key.

async function getJSON<T>(url: string, what: string, unreachable?: string, attempt = 0): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error(unreachable ?? `Couldn’t reach ${what}. Check your connection.`);
  }
  if (res.status === 429) throw new Error(`${what} is rate-limiting requests. Try again in a few minutes.`);
  if (!res.ok) throw new Error(`${what} answered ${res.status}.`);
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    // feeds are sometimes caught mid-rewrite and arrive truncated: try once more
    if (attempt === 0) {
      await new Promise((r) => setTimeout(r, 1500));
      return getJSON<T>(url, what, unreachable, 1);
    }
    throw new Error(`${what} sent an incomplete file. It usually fixes itself within a minute.`);
  }
}

/** Cache a fetch in localStorage for `ttl` milliseconds. */
async function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const hit = readJSON<{ v: T; t: number } | null>(key, null);
  if (hit && Date.now() - hit.t < ttl) return hit.v;
  try {
    const v = await load();
    writeJSON(key, { v, t: Date.now() });
    return v;
  } catch (err) {
    if (hit) return hit.v; // stale beats nothing
    throw err;
  }
}

// ---- the night's sky ------------------------------------------------------------------

export interface NightHour {
  /** Unix ms at the start of the hour. */
  time: number;
  cloud: number;
}

export interface Night {
  sunset: number;
  sunrise: number;
  hours: NightHour[];
  timezone: string;
  /** True when the night is already under way. */
  underway: boolean;
}

interface MeteoResponse {
  timezone: string;
  hourly: { time: number[]; cloud_cover: (number | null)[] };
  daily: { time: number[]; sunrise: (number | null)[]; sunset: (number | null)[] };
}

export async function getNight(lat: number, lon: number, now = Date.now()): Promise<Night> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}` +
    `&hourly=cloud_cover&daily=sunrise,sunset&timezone=auto&timeformat=unixtime&past_days=1&forecast_days=3`;
  const data = await cached(`skypost:v1:meteo:${lat.toFixed(2)},${lon.toFixed(2)}`, 30 * 60_000, () =>
    getJSON<MeteoResponse>(url, "Open-Meteo"),
  );

  const sec = (v: number | null | undefined) => (v ? v * 1000 : null);
  const sunrise = data.daily.sunrise.map(sec);
  const sunset = data.daily.sunset.map(sec);
  // daily[0] is yesterday, [1] today, [2] tomorrow
  let start: number | null;
  let end: number | null;
  if (sunrise[1] && now < sunrise[1]) {
    start = sunset[0];
    end = sunrise[1];
  } else {
    start = sunset[1];
    end = sunrise[2];
  }
  // polar day or night: fall back to 18:00–06:00 local
  if (!start || !end) {
    const midnight = data.daily.time[2] * 1000;
    start = midnight - 6 * 3600_000;
    end = midnight + 6 * 3600_000;
  }

  const hours: NightHour[] = [];
  data.hourly.time.forEach((t, i) => {
    const ms = t * 1000;
    const cloud = data.hourly.cloud_cover[i];
    if (cloud === null || cloud === undefined) return;
    if (ms + 3600_000 > start! && ms < end!) hours.push({ time: ms, cloud });
  });

  return { sunset: start, sunrise: end, hours, timezone: data.timezone, underway: now >= start };
}

export const CLEAR = 30;
export const CLOUDY = 70;

/** A short plain-language reading of the night's cloud. */
export function skyVerdict(night: Night, formatHour: (ms: number) => string) {
  const hours = night.hours;
  if (!hours.length) return "no cloud forecast for this night";
  const clear = hours.filter((h) => h.cloud <= CLEAR).length;
  if (clear === hours.length) return "clear all night";
  if (clear / hours.length >= 0.75) return "mostly clear all night";
  if (clear === 0) return hours.every((h) => h.cloud >= CLOUDY) ? "cloudy all night" : "patchy cloud all night";

  // the longest clear run
  let best = { from: 0, len: 0 };
  let run = { from: 0, len: 0 };
  hours.forEach((h, i) => {
    if (h.cloud <= CLEAR) {
      run = run.len ? { from: run.from, len: run.len + 1 } : { from: i, len: 1 };
      if (run.len > best.len) best = run;
    } else {
      run = { from: i + 1, len: 0 };
    }
  });
  const from = hours[best.from].time;
  const until = best.from + best.len >= hours.length ? null : hours[best.from + best.len].time;
  if (best.from === 0) return until ? `clear until ${formatHour(until)}` : "clear all night";
  return until ? `clear from ${formatHour(from)} to ${formatHour(until)}` : `clear from ${formatHour(from)}`;
}

// ---- the Moon (computed, no request) ---------------------------------------------------

const SYNODIC = 29.530588853;
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

export function moonPhase(at = Date.now()) {
  const age = ((((at - KNOWN_NEW_MOON) / 86_400_000) % SYNODIC) + SYNODIC) % SYNODIC;
  const illumination = (1 - Math.cos((2 * Math.PI * age) / SYNODIC)) / 2;
  const names = ["New moon", "Waxing crescent", "First quarter", "Waxing gibbous", "Full moon", "Waning gibbous", "Last quarter", "Waning crescent"];
  const name = names[Math.floor(((age / SYNODIC) * 8 + 0.5) % 8)];
  return { age, illumination, name };
}

// ---- aurora ------------------------------------------------------------------------------

export interface KpSlot {
  time: number;
  kp: number;
  kind: "observed" | "estimated" | "predicted";
}

export async function getKp(): Promise<KpSlot[]> {
  const rows = await cached("skypost:v1:kp", 20 * 60_000, () =>
    getJSON<{ time_tag: string; kp: number; observed: string }[]>(
      "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json",
      "NOAA’s Space Weather Prediction Center",
    ),
  );
  return rows
    .filter((r) => typeof r.kp === "number")
    .map((r) => ({
      time: Date.parse(r.time_tag + "Z"),
      kp: r.kp,
      kind: r.observed === "observed" ? "observed" : r.observed === "estimated" ? "estimated" : "predicted",
    }));
}

/** Geomagnetic latitude from a tilted-dipole model (pole near 80.8° N, 72.7° W). */
export function geomagneticLatitude(lat: number, lon: number) {
  const rad = Math.PI / 180;
  const poleLat = 80.8 * rad;
  const poleLon = -72.7 * rad;
  const s = Math.sin(lat * rad) * Math.sin(poleLat) + Math.cos(lat * rad) * Math.cos(poleLat) * Math.cos(lon * rad - poleLon);
  return Math.asin(s) / rad;
}

/**
 * A rough reading of the aurora chance, after NOAA's Kp-to-latitude guide: aurora can be
 * seen low on the poleward horizon down to about 66.5° − 2·Kp geomagnetic latitude, and
 * high in the sky some 5° poleward of that.
 */
export function auroraOutlook(magLat: number, kp: number) {
  const m = Math.abs(magLat);
  const horizon = 66.5 - 2 * kp;
  const horizonKp = Math.max(0, (66.5 - m) / 2);
  const toward = magLat >= 0 ? "north" : "south";
  if (m >= horizon + 5) return { level: "likely" as const, toward, horizonKp };
  if (m >= horizon) return { level: "possible" as const, toward, horizonKp };
  return { level: "unlikely" as const, toward, horizonKp };
}

// ---- launches ----------------------------------------------------------------------------

export interface Launch {
  id: string;
  name: string;
  mission?: string;
  missionType?: string;
  orbit?: string;
  provider: string;
  rocket: string;
  pad: string;
  location: string;
  net: number;
  precision: string;
  status: string;
  statusName: string;
  image?: string;
}

interface RawLaunch {
  id: string;
  name: string;
  net: string;
  net_precision?: { abbrev?: string; name?: string } | null;
  status: { abbrev: string; name: string };
  launch_service_provider: { name: string };
  rocket: { configuration: { name: string; full_name?: string } };
  mission: { name: string; type?: string; orbit?: { name?: string } | null } | null;
  pad: { name: string; location: { name: string } };
  image?: { thumbnail_url?: string; image_url?: string } | null;
}

export async function getLaunches(): Promise<Launch[]> {
  const data = await cached("skypost:v1:launches", 10 * 60_000, () =>
    getJSON<{ results: RawLaunch[] }>(
      "https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=6&mode=normal&hide_recent_previous=true",
      "Launch Library",
      "The launch schedule isn’t answering right now. Its free service allows a limited number of requests an hour; try again shortly.",
    ),
  );
  return data.results.map((r) => ({
    id: r.id,
    name: r.name,
    mission: r.mission?.name,
    missionType: r.mission?.type,
    orbit: r.mission?.orbit?.name ?? undefined,
    provider: r.launch_service_provider.name,
    rocket: r.rocket.configuration.full_name || r.rocket.configuration.name,
    pad: r.pad.name,
    location: r.pad.location.name,
    net: Date.parse(r.net),
    precision: r.net_precision?.abbrev ?? "SEC",
    status: r.status.abbrev,
    statusName: r.status.name,
    image: r.image?.thumbnail_url ?? undefined,
  }));
}
