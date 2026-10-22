import { useSyncExternalStore } from "react";
import { isISODate, type ISODate } from "./dates";
import { readJSON, removeKey, writeJSON } from "./storage";
import type { MediaType } from "./apod";

// Small persistent stores (album, birthday, viewing preferences) shared
// across components and kept in sync between tabs.

function createStore<T>(key: string, initial: () => T) {
  let value = initial();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  window.addEventListener("storage", (event) => {
    if (event.key !== key) return;
    value = readJSON<T>(key, initial());
    emit();
  });

  return {
    get: () => value,
    set(next: T) {
      value = next;
      if (next === null || next === undefined) removeKey(key);
      else writeJSON(key, next);
      emit();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function useStore<T>(store: { get: () => T; subscribe: (l: () => void) => () => void }) {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

// ---- album -------------------------------------------------------------------------

export interface AlbumStamp {
  date: ISODate;
  title: string;
  thumb?: string;
  mediaType: MediaType;
  addedAt: number;
}

const ALBUM_KEY = "skypost:v1:album";
const albumStore = createStore<AlbumStamp[]>(ALBUM_KEY, () => {
  const list = readJSON<AlbumStamp[]>(ALBUM_KEY, []);
  return Array.isArray(list) ? list.filter((s) => s && isISODate(s.date)) : [];
});

export const album = {
  has: (date: ISODate) => albumStore.get().some((s) => s.date === date),
  add(stamp: Omit<AlbumStamp, "addedAt">) {
    if (album.has(stamp.date)) return;
    albumStore.set([{ ...stamp, addedAt: Date.now() }, ...albumStore.get()]);
  },
  remove(date: ISODate) {
    albumStore.set(albumStore.get().filter((s) => s.date !== date));
  },
  restore(stamp: AlbumStamp) {
    if (album.has(stamp.date)) return;
    albumStore.set([stamp, ...albumStore.get()].sort((a, b) => b.addedAt - a.addedAt));
  },
};

export const useAlbum = () => useStore(albumStore);

// ---- birthday -------------------------------------------------------------------

const BIRTHDAY_KEY = "skypost:v1:birthday";

function legacyBirthday(): ISODate | null {
  // The first version of the app kept the birthday picture under "NASA-bday".
  const legacy = readJSON<{ date?: string } | null>("NASA-bday", null);
  return legacy && isISODate(legacy.date) ? legacy.date : null;
}

const birthdayStore = createStore<ISODate | null>(BIRTHDAY_KEY, () => {
  const stored = readJSON<string | null>(BIRTHDAY_KEY, null);
  if (isISODate(stored)) return stored;
  const legacy = legacyBirthday();
  if (legacy) writeJSON(BIRTHDAY_KEY, legacy);
  return legacy;
});

export const setBirthday = (date: ISODate | null) => birthdayStore.set(date);
export const useBirthday = () => useStore(birthdayStore);

// ---- viewing preferences ---------------------------------------------------------

export type Fit = "cover" | "contain";
const FIT_KEY = "skypost:v1:fit";
const fitStore = createStore<Fit>(FIT_KEY, () => (readJSON<string>(FIT_KEY, "cover") === "contain" ? "contain" : "cover"));

export const setFit = (fit: Fit) => fitStore.set(fit);
export const useFit = () => useStore(fitStore);

// ---- game record --------------------------------------------------------------------

const BEST_KEY = "skypost:v1:game-best";
const bestStore = createStore<number>(BEST_KEY, () => Number(readJSON<number>(BEST_KEY, 0)) || 0);

export const recordScore = (score: number) => {
  if (score > bestStore.get()) bestStore.set(score);
};
export const useBestScore = () => useStore(bestStore);
