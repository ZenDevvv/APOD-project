import { useSyncExternalStore } from "react";
import { readJSON, removeKey, writeJSON } from "./storage";

// Where the visitor is looking from. Asked for only when a feature needs it,
// either from the device or by searching a city, and kept in this browser.

export interface Place {
  name: string;
  lat: number;
  lon: number;
  /** IANA time zone when known (city search), otherwise the browser's. */
  timezone?: string;
  source: "device" | "search";
}

const KEY = "skypost:v1:place";
let current: Place | null = (() => {
  const stored = readJSON<Place | null>(KEY, null);
  return stored && Number.isFinite(stored.lat) && Number.isFinite(stored.lon) ? stored : null;
})();
const listeners = new Set<() => void>();

export function setPlace(place: Place | null) {
  current = place;
  if (place) writeJSON(KEY, place);
  else removeKey(KEY);
  listeners.forEach((l) => l());
}

export function usePlace() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => null,
  );
}

export function formatCoords(lat: number, lon: number) {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(1)}° ${ns}, ${Math.abs(lon).toFixed(1)}° ${ew}`;
}

export function placeTimeZone(place: Place) {
  return place.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Ask the browser for the device position. Rejects with a message fit to show. */
export function locateDevice(): Promise<Place> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("This browser can’t share a location. Search for a city instead."));
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          name: "Your location",
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          source: "device",
        }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? "Location is blocked for this site. Search for a city instead."
              : "Couldn’t get a location fix. Search for a city instead.",
          ),
        ),
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 30 * 60_000 },
    );
  });
}

export interface PlaceResult extends Place {
  detail: string;
}

/** City search through Open-Meteo's free geocoding API. */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`,
    { signal },
  );
  if (!res.ok) throw new Error("City search isn’t answering right now.");
  const data = (await res.json()) as {
    results?: { name: string; latitude: number; longitude: number; timezone?: string; admin1?: string; country?: string }[];
  };
  return (data.results ?? []).map((r) => ({
    name: r.name,
    lat: r.latitude,
    lon: r.longitude,
    timezone: r.timezone,
    source: "search" as const,
    detail: [r.admin1, r.country].filter(Boolean).join(", "),
  }));
}
