import { useEffect, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, Cake } from "lucide-react";
import MiniStamp from "../MiniStamp/MiniStamp";
import { ApodError, getRange, thumbOf, type Apod } from "../../lib/apod";
import {
  FIRST_ISSUE,
  MONTHS_LONG,
  addMonths,
  formatLong,
  latestPossibleDate,
  monthBounds,
  monthOf,
  parts,
  weekdayMon,
  addDays,
  type ISODate,
  type YearMonth,
} from "../../lib/dates";
import { hrefFor, linkHandler, navigate } from "../../lib/router";
import { useBirthday } from "../../lib/prefs";
import { useLatestDate } from "../../lib/useLatest";
import styles from "./Archive.module.css";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface Loaded {
  ym: YearMonth;
  days?: Map<ISODate, Apod | null>;
  error?: ApodError;
}

function monthName(ym: YearMonth) {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

/** A month of issues laid out as a pane of stamps. */
export default function Archive({ month }: { month?: YearMonth }) {
  const latestKnown = useLatestDate();
  const latest = latestKnown ?? latestPossibleDate();
  const birthday = useBirthday();
  const firstMonth = monthOf(FIRST_ISSUE);
  const lastMonth = monthOf(latest);
  const ym = month && month >= firstMonth && month <= lastMonth ? month : lastMonth;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    const [from, to] = monthBounds(ym);
    getRange(from, to, controller.signal).then(
      (days) => live && setLoaded({ ym, days }),
      (error: unknown) => {
        if (live && (error as Error).name !== "AbortError") {
          setLoaded({ ym, error: error instanceof ApodError ? error : new ApodError("network", String(error)) });
        }
      },
    );
    return () => {
      live = false;
      controller.abort();
    };
  }, [ym, attempt]);

  const prev = addMonths(ym, -1);
  const next = addMonths(ym, 1);
  const hasPrev = prev >= firstMonth;
  const hasNext = next <= lastMonth;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest("input, select, textarea")) return;
      if (event.key === "ArrowLeft" && hasPrev) navigate({ view: "archive", month: prev }, { replace: true });
      if (event.key === "ArrowRight" && hasNext) navigate({ view: "archive", month: next }, { replace: true });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, hasPrev, hasNext]);

  const [from, to] = monthBounds(ym);
  const days: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  const offset = weekdayMon(from);
  const current = loaded?.ym === ym ? loaded : null;
  const issued = current?.days ? [...current.days.values()].filter(Boolean).length : 0;
  const { y, m } = parts(from);
  const years = Array.from({ length: parts(latest).y - 1995 + 1 }, (_, i) => 1995 + i);

  const jump = (year: number, mon: number) => {
    let target = `${year}-${String(mon).padStart(2, "0")}`;
    if (target < firstMonth) target = firstMonth;
    if (target > lastMonth) target = lastMonth;
    navigate({ view: "archive", month: target });
  };

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{monthName(ym)}</h1>
          <p className={styles.sub}>
            {current?.days
              ? `${issued} ${issued === 1 ? "issue" : "issues"} on this sheet${from < FIRST_ISSUE ? ", from the very first on 16 June" : ""}. Choose a stamp to open its day.`
              : current?.error
                ? "This sheet couldn’t be fetched."
                : "Fetching the sheet…"}
          </p>
        </div>

        <div className={styles.controls}>
          <a
            className={`${styles.step} ${hasPrev ? "" : styles.off}`}
            href={hasPrev ? hrefFor({ view: "archive", month: prev }) : undefined}
            onClick={hasPrev ? linkHandler({ view: "archive", month: prev }) : undefined}
            aria-disabled={!hasPrev}
            aria-label={`Previous month, ${monthName(prev)}`}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>{monthName(prev)}</span>
          </a>

          <div className={styles.jump}>
            <label className="visually-hidden" htmlFor="sheet-month">Month</label>
            <select id="sheet-month" value={m} onChange={(e) => jump(y, Number(e.target.value))}>
              {MONTHS_LONG.map((name, i) => (
                <option key={name} value={i + 1}>{name}</option>
              ))}
            </select>
            <label className="visually-hidden" htmlFor="sheet-year">Year</label>
            <select id="sheet-year" className="num" value={y} onChange={(e) => jump(Number(e.target.value), m)}>
              {years.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <a
            className={`${styles.step} ${hasNext ? "" : styles.off}`}
            href={hasNext ? hrefFor({ view: "archive", month: next }) : undefined}
            onClick={hasNext ? linkHandler({ view: "archive", month: next }) : undefined}
            aria-disabled={!hasNext}
            aria-label={`Next month, ${monthName(next)}`}
          >
            <span>{monthName(next)}</span>
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
      </header>

      {current?.error ? (
        <div className={styles.error}>
          <p>{current.error.kind === "network" ? "Couldn’t reach NASA’s archive. Check your connection." : "NASA’s archive is having trouble right now."}</p>
          <button type="button" className="caps" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
        </div>
      ) : (
        <div className={styles.sheet}>
          <div className={styles.selvageTop} aria-hidden="true">
            {WEEKDAYS.map((day) => (
              <span key={day} className="caps">{day}</span>
            ))}
          </div>
          <ol className={styles.pane} style={{ "--offset": offset } as CSSProperties}>
            {days.map((date) => {
              const entry = current?.days?.get(date);
              const day = parts(date).d;
              const future = date > latest;
              const state = future ? "pending" : entry ? "ready" : entry === null ? "missing" : "loading";
              const weekday = WEEKDAYS[weekdayMon(date)];
              const stamp = (
                <MiniStamp
                  thumb={entry ? thumbOf(entry, 360) : undefined}
                  alt=""
                  mediaType={entry?.mediaType}
                  value={day}
                  caption={entry ? entry.title : future ? "Not yet issued" : entry === null ? "Not issued" : " "}
                  state={state}
                />
              );
              if (date < FIRST_ISSUE) return <li key={date} className={styles.cell} aria-hidden="true" />;
              return (
                <li key={date} className={styles.cell} data-weekday={weekday} data-future={future || undefined}>
                  {entry ? (
                    <a
                      className={styles.link}
                      href={hrefFor({ view: "day", date })}
                      onClick={linkHandler({ view: "day", date })}
                      aria-label={`${formatLong(date)}: ${entry.title}`}
                    >
                      {stamp}
                    </a>
                  ) : (
                    <div className={styles.link}>
                      {stamp}
                      <span className="visually-hidden">
                        {`${formatLong(date)}: ${future ? "not yet issued" : entry === null ? "no issue" : "loading"}`}
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          <div className={styles.selvageBottom}>
            <span className={styles.registration} aria-hidden="true">
              <i /> <i /> <i /> <i />
            </span>
            <span className="caps">
              Skypost sheet {y} · {String(m).padStart(2, "0")}
            </span>
            {birthday && (
              <a
                className={`caps ${styles.birthdayLink}`}
                href={hrefFor({ view: "birthday", on: birthday.slice(5) })}
                onClick={linkHandler({ view: "birthday", on: birthday.slice(5) })}
              >
                <Cake size={13} aria-hidden="true" /> Your birthday, every year
              </a>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
