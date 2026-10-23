import { useEffect, useId, useState } from "react";
import { LocateFixed, MapPin, Search } from "lucide-react";
import { formatCoords, locateDevice, searchPlaces, setPlace, usePlace, type PlaceResult } from "../../lib/place";
import styles from "./PlacePicker.module.css";

interface PlacePickerProps {
  /** Why the feature needs a place, in one sentence. */
  reason: string;
  tone?: "leaf" | "paper";
}

/** Choose where you're looking from: the device's location, or a searched city. */
export default function PlacePicker({ reason, tone = "leaf" }: PlacePickerProps) {
  const place = usePlace();
  const [open, setOpen] = useState(!place);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [status, setStatus] = useState<{ busy?: boolean; error?: string }>({});
  const inputId = useId();

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const t = window.setTimeout(() => {
      searchPlaces(q, controller.signal).then(
        (list) => setResults(list),
        (err: Error) => err.name !== "AbortError" && setStatus({ error: err.message }),
      );
    }, 280);
    return () => {
      window.clearTimeout(t);
      controller.abort();
    };
  }, [query]);

  const useDevice = async () => {
    setStatus({ busy: true });
    try {
      setPlace(await locateDevice());
      setStatus({});
      setOpen(false);
    } catch (err) {
      setStatus({ error: (err as Error).message });
    }
  };

  if (place && !open) {
    return (
      <p className={`${styles.summary} ${styles[tone]}`}>
        <MapPin size={15} aria-hidden="true" />
        <span>
          From <strong>{place.name}</strong>
          {place.source === "device" && <span className={styles.coords}> ({formatCoords(place.lat, place.lon)})</span>}
        </span>
        <button type="button" className="caps" onClick={() => setOpen(true)}>
          Change
        </button>
      </p>
    );
  }

  const shown = query.trim().length >= 2 ? results : [];

  return (
    <div className={`${styles.picker} ${styles[tone]}`}>
      <p className={styles.reason}>{reason}</p>
      <div className={styles.row}>
        <button type="button" className={`caps ${styles.locate}`} onClick={useDevice} disabled={status.busy}>
          <LocateFixed size={16} aria-hidden="true" />
          {status.busy ? "Finding you…" : "Use my location"}
        </button>
        <span className={styles.or}>or</span>
        <label className={styles.search} htmlFor={inputId}>
          <Search size={15} aria-hidden="true" />
          <span className="visually-hidden">Search for a city</span>
          <input
            id={inputId}
            type="search"
            placeholder="Search for a city"
            autoComplete="off"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setStatus({});
            }}
          />
        </label>
      </div>
      {status.error && (
        <p className={styles.error} role="alert">
          {status.error}
        </p>
      )}
      {shown.length > 0 && (
        <ul className={styles.results}>
          {shown.map((r) => (
            <li key={`${r.lat},${r.lon}`}>
              <button
                type="button"
                onClick={() => {
                  setPlace({ name: r.name, lat: r.lat, lon: r.lon, timezone: r.timezone, source: "search" });
                  setOpen(false);
                  setQuery("");
                }}
              >
                <strong>{r.name}</strong>
                <span>{r.detail || formatCoords(r.lat, r.lon)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.note}>Kept in this browser only. Nothing is sent anywhere except the weather and city lookups.</p>
      {place && (
        <button type="button" className={`caps ${styles.cancel}`} onClick={() => setOpen(false)}>
          Keep {place.name}
        </button>
      )}
    </div>
  );
}
