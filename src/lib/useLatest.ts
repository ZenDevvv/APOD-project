import { useEffect, useState } from "react";
import { getLatest } from "./apod";
import type { ISODate } from "./dates";

/** Date of the newest published issue, once known. */
export function useLatestDate() {
  const [latest, setLatest] = useState<ISODate | undefined>();
  useEffect(() => {
    let live = true;
    getLatest().then(
      (apod) => live && setLatest(apod.date),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);
  return latest;
}
