import {
  degreesLat,
  degreesLong,
  degreesToRadians,
  ecfToLookAngles,
  eciToEcf,
  eciToGeodetic,
  gstime,
  jday,
  json2satrec,
  propagate,
  shadowFraction,
  sunPos,
  twoline2satrec,
  type OMMJsonObject,
  type SatRec,
} from "./satellite";
import { readJSON, writeJSON } from "./storage";

// The ISS is computed in the browser from its published orbit (CelesTrak, with
// wheretheiss.at as a fallback source), so the live position, the ground track and
// pass predictions need one small download every few hours rather than constant polling.

const CELESTRAK = "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=json";
const WHERETHEISS = "https://api.wheretheiss.at/v1/satellites/25544/tles";
const ORBIT_KEY = "skypost:v1:iss-orbit";
const ORBIT_TTL = 4 * 3600_000;
const AU_KM = 149_597_870.7;

type Stored = { kind: "omm"; omm: OMMJsonObject; t: number } | { kind: "tle"; line1: string; line2: string; t: number };

export interface Orbit {
  satrec: SatRec;
  /** When the orbit elements were fetched. */
  fetchedAt: number;
  source: "CelesTrak" | "wheretheiss.at";
}

function toOrbit(stored: Stored): Orbit {
  return stored.kind === "omm"
    ? { satrec: json2satrec(stored.omm), fetchedAt: stored.t, source: "CelesTrak" }
    : { satrec: twoline2satrec(stored.line1, stored.line2), fetchedAt: stored.t, source: "wheretheiss.at" };
}

let orbitJob: Promise<Orbit> | null = null;

export function getOrbit(): Promise<Orbit> {
  if (orbitJob) return orbitJob;
  const cached = readJSON<Stored | null>(ORBIT_KEY, null);
  if (cached && Date.now() - cached.t < ORBIT_TTL) {
    orbitJob = Promise.resolve(toOrbit(cached));
    return orbitJob;
  }
  orbitJob = (async () => {
    let stored: Stored | null = null;
    try {
      const res = await fetch(CELESTRAK);
      const list = res.ok ? ((await res.json()) as OMMJsonObject[]) : [];
      if (list[0]) stored = { kind: "omm", omm: list[0], t: Date.now() };
    } catch {
      /* try the fallback */
    }
    if (!stored) {
      try {
        const res = await fetch(WHERETHEISS);
        const tle = res.ok ? ((await res.json()) as { line1: string; line2: string }) : null;
        if (tle?.line1) stored = { kind: "tle", line1: tle.line1, line2: tle.line2, t: Date.now() };
      } catch {
        /* handled below */
      }
    }
    if (!stored) {
      if (cached) return toOrbit(cached); // stale elements still place the station within a few hundred km
      throw new Error("Couldn’t fetch the station’s orbit. Check your connection.");
    }
    writeJSON(ORBIT_KEY, stored);
    return toOrbit(stored);
  })();
  orbitJob.catch(() => {
    orbitJob = null;
  });
  return orbitJob;
}

export interface StationState {
  lat: number;
  lon: number;
  altitudeKm: number;
  speedKmh: number;
  sunlit: boolean;
}

function sunEci(date: Date) {
  const { rsun } = sunPos(jday(date));
  return rsun;
}

export function stationAt(orbit: Orbit, date: Date): StationState | null {
  const pv = propagate(orbit.satrec, date);
  if (!pv) return null;
  const gd = eciToGeodetic(pv.position, gstime(date));
  const v = pv.velocity;
  return {
    lat: degreesLat(gd.latitude),
    lon: degreesLong(gd.longitude),
    altitudeKm: gd.height,
    // inertial speed, the figure usually quoted for the station
    speedKmh: Math.hypot(v.x, v.y, v.z) * 3600,
    sunlit: shadowFraction(sunEci(date), pv.position) < 0.5,
  };
}

/** Ground track as [lon, lat] runs, split where the track crosses the antimeridian. */
export function groundTrack(orbit: Orbit, from: Date, minutes: number, stepSeconds = 30): [number, number][][] {
  const runs: [number, number][][] = [[]];
  let prevLon: number | null = null;
  for (let s = 0; s <= minutes * 60; s += stepSeconds) {
    const state = stationAt(orbit, new Date(from.getTime() + s * 1000));
    if (!state) continue;
    if (prevLon !== null && Math.abs(state.lon - prevLon) > 180) runs.push([]);
    runs[runs.length - 1].push([state.lon, state.lat]);
    prevLon = state.lon;
  }
  return runs.filter((r) => r.length > 1);
}

/** Where the Sun is overhead: the centre of the day side of the planet. */
export function subsolarPoint(date: Date): [number, number] {
  const r = sunEci(date);
  const gd = eciToGeodetic({ x: r.x * AU_KM, y: r.y * AU_KM, z: r.z * AU_KM }, gstime(date));
  return [degreesLong(gd.longitude), degreesLat(gd.latitude)];
}

export interface Pass {
  start: Date;
  peak: Date;
  end: Date;
  maxElevation: number;
  startAzimuth: number;
  endAzimuth: number;
  /** Station sunlit while the observer's sky is dark: it shows as a bright moving star. */
  visible: boolean;
}

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
export const compass = (deg: number) => COMPASS[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];

/** Passes over an observer with a peak at least `minPeak` degrees up, within the next `hours`. */
export function passesOver(orbit: Orbit, lat: number, lon: number, from = new Date(), hours = 72, minPeak = 10): Pass[] {
  const observer = { latitude: degreesToRadians(lat), longitude: degreesToRadians(lon), height: 0.05 };
  const step = 20_000;
  const passes: Pass[] = [];
  let current: { start: Date; peak: Date; max: number; startAz: number; visible: boolean; lastAz: number } | null = null;

  for (let t = from.getTime(); t <= from.getTime() + hours * 3600_000; t += step) {
    const date = new Date(t);
    const pv = propagate(orbit.satrec, date);
    if (!pv) continue;
    const gmst = gstime(date);
    const look = ecfToLookAngles(observer, eciToEcf(pv.position, gmst));
    const elevation = (look.elevation * 180) / Math.PI;
    const azimuth = (look.azimuth * 180) / Math.PI;

    if (elevation > 0) {
      if (!current) current = { start: date, peak: date, max: elevation, startAz: azimuth, visible: false, lastAz: azimuth };
      if (elevation > current.max) {
        current.max = elevation;
        current.peak = date;
      }
      current.lastAz = azimuth;
      if (!current.visible && elevation > 10) {
        const sun = sunEci(date);
        const sunLook = ecfToLookAngles(observer, eciToEcf({ x: sun.x * AU_KM, y: sun.y * AU_KM, z: sun.z * AU_KM }, gmst));
        const darkSky = (sunLook.elevation * 180) / Math.PI < -6;
        if (darkSky && shadowFraction(sun, pv.position) < 0.5) current.visible = true;
      }
    } else if (current) {
      if (current.max >= minPeak) {
        passes.push({
          start: current.start,
          peak: current.peak,
          end: date,
          maxElevation: current.max,
          startAzimuth: current.startAz,
          endAzimuth: current.lastAz,
          visible: current.visible,
        });
      }
      current = null;
    }
  }
  return passes;
}
