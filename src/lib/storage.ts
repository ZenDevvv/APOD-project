// Browser storage can be missing, full, or blocked (private windows, previews).
// Every read and write goes through here so the app keeps working without it.

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

/** Clear storage written by the pre-2.0 app ("NASA-YYYY-MM-DD", "NASA-bday") and outdated issue caches. */
export function dropLegacyKeys() {
  try {
    const legacy: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && (/^NASA-/.test(key) || /^skypost:v[12]:(day:|days$|latest$)/.test(key))) legacy.push(key);
    }
    legacy.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    /* storage unavailable */
  }
}
