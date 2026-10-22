import { useCallback, useEffect, useState } from "react";
import { ApodError, getDay, getLatest, peekDay, type Apod } from "./apod";
import type { ISODate } from "./dates";

export type IssueState =
  | { status: "loading"; apod?: undefined; error?: undefined }
  | { status: "ready"; apod: Apod; error?: undefined }
  | { status: "missing"; apod?: undefined; error?: undefined }
  | { status: "error"; apod?: undefined; error: ApodError };

interface Settled {
  key: string;
  apod?: Apod | null;
  error?: ApodError;
}

/** Load one day's issue (or the latest when no date is given). */
export function useIssue(date?: ISODate) {
  const key = date ?? "latest";
  const [settled, setSettled] = useState<Settled | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    (date ? getDay(date) : getLatest()).then(
      (apod) => live && setSettled({ key, apod }),
      (error: unknown) => {
        if (!live) return;
        setSettled({ key, error: error instanceof ApodError ? error : new ApodError("network", String(error)) });
      },
    );
    return () => {
      live = false;
    };
  }, [key, date, attempt]);

  const retry = useCallback(() => {
    setSettled(null);
    setAttempt((n) => n + 1);
  }, []);

  let state: IssueState;
  const current = settled?.key === key ? settled : null;
  const peeked = !current && date ? peekDay(date) : undefined;
  if (current?.error) state = { status: "error", error: current.error };
  else if (current) state = current.apod ? { status: "ready", apod: current.apod } : { status: "missing" };
  else if (peeked) state = { status: "ready", apod: peeked };
  else if (peeked === null) state = { status: "missing" };
  else state = { status: "loading" };

  return { ...state, retry };
}
