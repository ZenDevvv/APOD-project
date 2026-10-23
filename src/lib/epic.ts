import type { ISODate } from "./dates";
import { readJSON, writeJSON } from "./storage";

// NASA EPIC: the Earth Polychromatic Imaging Camera on NOAA's DSCOVR spacecraft,
// which photographs the whole sunlit Earth from the L1 point, roughly 1.5 million km away.
// No key needed; the API allows cross-origin reads. Images load as plain <img>.

const API = "https://epic.gsfc.nasa.gov/api/natural";
const ARCHIVE = "https://epic.gsfc.nasa.gov/archive/natural";
export const EPIC_FIRST: ISODate = "2015-06-13";

export interface EarthFrame {
  id: string;
  image: string;
  /** UTC timestamp, ISO 8601. */
  time: string;
  date: ISODate;
  lat: number;
  lon: number;
  distanceKm: number;
}

interface RawFrame {
  identifier: string;
  image: string;
  date: string; // "2026-10-20 22:08:12" UTC
  centroid_coordinates: { lat: number; lon: number };
  dscovr_j2000_position: { x: number; y: number; z: number };
}

function normalize(raw: RawFrame): EarthFrame {
  const p = raw.dscovr_j2000_position;
  return {
    id: raw.identifier,
    image: raw.image,
    time: raw.date.replace(" ", "T") + "Z",
    date: raw.date.slice(0, 10),
    lat: raw.centroid_coordinates.lat,
    lon: raw.centroid_coordinates.lon,
    distanceKm: Math.round(Math.hypot(p.x, p.y, p.z)),
  };
}

export function frameUrl(frame: EarthFrame, size: "jpg" | "thumbs" | "png" = "jpg") {
  const [y, m, d] = frame.date.split("-");
  return `${ARCHIVE}/${y}/${m}/${d}/${size}/${frame.image}.${size === "png" ? "png" : "jpg"}`;
}

async function get<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("Couldn’t reach NASA’s EPIC archive. Check your connection.");
  }
  if (!res.ok) throw new Error(`NASA’s EPIC archive answered ${res.status}.`);
  return res.json() as Promise<T>;
}

const days = new Map<ISODate, Promise<EarthFrame[]>>();
const DAY_KEY = "skypost:v1:epic:";

/** Every frame for one day, in time order. Past days are cached for good; today's for 30 minutes. */
export function getEarthDay(date: ISODate): Promise<EarthFrame[]> {
  const known = days.get(date);
  if (known) return known;
  const stored = readJSON<{ frames: EarthFrame[]; t: number } | null>(DAY_KEY + date, null);
  // Recent days can still gain frames; older days with frames never change.
  const settled = Date.now() - Date.parse(date) > 2 * 86_400_000 && !!stored?.frames.length;
  const fresh = stored && (settled || Date.now() - stored.t < 30 * 60_000);
  const job = fresh
    ? Promise.resolve(stored.frames)
    : get<RawFrame[]>(`${API}/date/${date}`).then((list) => {
        const frames = list.map(normalize).sort((a, b) => a.time.localeCompare(b.time));
        writeJSON(DAY_KEY + date, { frames, t: Date.now() });
        return frames;
      });
  days.set(date, job);
  job.catch(() => days.delete(date));
  return job;
}

let available: Promise<ISODate[]> | null = null;
const AVAILABLE_KEY = "skypost:v1:epic-available";

/** Every date with imagery (about 3,700 since June 2015), refreshed every few hours. */
export function getAvailableDays(): Promise<ISODate[]> {
  if (available) return available;
  const stored = readJSON<{ list: ISODate[]; t: number } | null>(AVAILABLE_KEY, null);
  if (stored && Date.now() - stored.t < 3 * 3600_000) {
    available = Promise.resolve(stored.list);
    return available;
  }
  available = get<ISODate[]>(`${API}/available`).then((list) => {
    const sorted = [...list].sort();
    writeJSON(AVAILABLE_KEY, { list: sorted, t: Date.now() });
    return sorted;
  });
  available.catch(() => {
    available = null;
  });
  return available;
}

/** The available day closest to a target date (ties go to the earlier day). */
export function nearestDay(list: ISODate[], target: ISODate): ISODate | undefined {
  if (!list.length) return undefined;
  let lo = 0;
  let hi = list.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  if (list[lo] === target || lo === 0) return list[lo];
  const after = list[lo] >= target ? list[lo] : undefined;
  const before = list[lo - 1];
  if (!after) return list[list.length - 1];
  const gap = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b));
  return gap(before, target) <= gap(after, target) ? before : after;
}

/** A plain-language name for the side of the planet facing the camera. */
export function facing(lon: number) {
  const l = ((lon + 540) % 360) - 180;
  if (l < -115 || l >= 150) return "the Pacific";
  if (l < -30) return "the Americas";
  if (l < -10) return "the Atlantic";
  if (l < 40) return "Africa and Europe";
  if (l < 95) return "the Indian Ocean";
  return "Asia and Australia";
}
