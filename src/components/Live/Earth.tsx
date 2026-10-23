import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowLeft, ArrowRight, Cake, CalendarDays, ExternalLink, Pause, Play } from "lucide-react";
import DateSetter from "../DateSetter/DateSetter";
import { EPIC_FIRST, facing, frameUrl, getAvailableDays, getEarthDay, nearestDay, type EarthFrame } from "../../lib/epic";
import { formatLong, isISODate, parts, type ISODate } from "../../lib/dates";
import { setBirthday, useBirthday } from "../../lib/prefs";
import { formatCoords } from "../../lib/place";
import { hrefFor, linkHandler, navigate } from "../../lib/router";
import styles from "./Earth.module.css";

const PERFS = 72;

function timeUTC(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

function timeLocal(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** A birthday in a given year (the most recent one EPIC could have photographed, by default). */
function birthdayIn(birthday: ISODate, last: ISODate, year?: number): ISODate {
  const md = birthday.slice(5);
  let y = year ?? parts(last).y;
  if (!year && `${y}-${md}` > last) y -= 1;
  const target = `${y}-${md}`;
  return isISODate(target) ? target : `${y}-${md.slice(0, 3)}28`; // 29 February in a common year
}

/** A round stamp with real perforations, printed on the souvenir sheet. */
function RoundStamp({ frame, inscription }: { frame: EarthFrame; inscription: string }) {
  const id = useId().replace(/:/g, "");
  const holes = Array.from({ length: PERFS }, (_, i) => {
    const a = (i / PERFS) * Math.PI * 2;
    return [100 + Math.cos(a) * 99, 100 + Math.sin(a) * 99];
  });
  return (
    <svg className={styles.rim} viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <path id={`${id}-ring`} d="M 100 100 m -89 0 a 89 89 0 1 1 178 0 a 89 89 0 1 1 -178 0" />
      </defs>
      <circle cx="100" cy="100" r="99" className={styles.paperDisc} />
      {holes.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.9" className={styles.hole} />
      ))}
      <circle cx="100" cy="100" r="82.5" className={styles.frameLine} />
      <text className={styles.ringText}>
        <textPath href={`#${id}-ring`} textLength="556" lengthAdjust="spacing">
          {inscription}
        </textPath>
      </text>
      <title>{frame.id}</title>
    </svg>
  );
}

export default function Earth({ date }: { date?: ISODate }) {
  const birthday = useBirthday();
  const [available, setAvailable] = useState<ISODate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<{ day: ISODate; frames: EarthFrame[] } | null>(null);
  const [pick, setPick] = useState<{ day: ISODate; i: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [picker, setPicker] = useState<null | "date" | "birthday">(null);
  const [warm, setWarm] = useState(false);
  const drag = useRef<{ x: number; moved: number } | null>(null);

  useEffect(() => {
    let live = true;
    getAvailableDays().then(
      (list) => live && setAvailable(list),
      (err: Error) => live && setError(err.message),
    );
    return () => {
      live = false;
    };
  }, []);

  const latest = available?.[available.length - 1];
  const day = available ? (date ? nearestDay(available, date) : latest) : undefined;

  useEffect(() => {
    if (!day) return;
    let live = true;
    getEarthDay(day).then(
      (frames) => live && setLoaded({ day, frames }),
      (err: Error) => live && setError(err.message),
    );
    return () => {
      live = false;
    };
  }, [day]);

  const frames = loaded && loaded.day === day ? loaded.frames : null;
  const count = frames?.length ?? 0;
  // the newest photo on the latest day, the middle of the day otherwise
  const fallback = count ? (day === latest ? count - 1 : Math.floor(count / 2)) : 0;
  const index = pick && pick.day === day ? Math.min(pick.i, count - 1) : fallback;
  const frame = frames?.[index];
  const select = (i: number) => day && count && setPick({ day, i: ((i % count) + count) % count });

  // Fetch the whole day's frames once the visitor starts spinning, so playback is smooth.
  useEffect(() => {
    if (!warm || !frames) return;
    frames.forEach((f) => {
      const img = new Image();
      img.src = frameUrl(f);
    });
  }, [warm, frames]);

  const step = useRef(select);
  useEffect(() => {
    step.current = select;
  });
  useEffect(() => {
    if (!playing || !count) return;
    const id = window.setInterval(() => step.current(index + 1), 520);
    return () => window.clearInterval(id);
  }, [playing, count, index]);

  const dayIndex = available && day ? available.indexOf(day) : -1;
  const prevDay = available && dayIndex > 0 ? available[dayIndex - 1] : undefined;
  const nextDay = available && dayIndex >= 0 && dayIndex < available.length - 1 ? available[dayIndex + 1] : undefined;
  const goDay = (d?: ISODate) => d && navigate({ view: "live", tab: "earth", date: d === latest ? undefined : d });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || picker) return;
      if ((event.target as HTMLElement).closest("input, select, textarea, button, a")) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const dir = event.key === "ArrowRight" ? 1 : -1;
        if (event.shiftKey) goDay(dir > 0 ? nextDay : prevDay);
        else {
          setWarm(true);
          setPlaying(false);
          select(index + dir);
        }
      } else if (event.key === "p" || event.key === " ") {
        event.preventDefault();
        setWarm(true);
        setPlaying((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, moved: 0 };
    setWarm(true);
    setPlaying(false);
  };
  const onPointerMove = (event: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = event.clientX - d.x;
    if (Math.abs(dx) >= 26) {
      // dragging right turns the planet the way it turns: forward in time
      select(index + (dx > 0 ? 1 : -1));
      drag.current = { x: event.clientX, moved: d.moved + 1 };
    }
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const birthdayTarget = latest && birthday ? birthdayIn(birthday, latest) : undefined;
  const showingBirthday = !!birthday && !!date && date.slice(5) === birthday.slice(5);
  const birthdayYears =
    latest && birthday
      ? Array.from({ length: parts(latest).y - 2015 + 1 }, (_, i) => 2015 + i)
          .map((y) => ({ y, d: birthdayIn(birthday, latest, y) }))
          .filter((b) => b.d >= EPIC_FIRST && b.d <= latest)
      : [];
  const snapped = !!date && !!day && date !== day;

  if (error && !frame) {
    return (
      <section className={styles.notice}>
        <h1>Couldn’t reach NASA’s EPIC camera archive.</h1>
        <p>{error}</p>
      </section>
    );
  }

  const inscription = frame
    ? `THE WHOLE EARTH · DSCOVR EPIC · ${frame.distanceKm.toLocaleString("en-GB")} KM AWAY · ${formatLong(frame.date).replace(/^\w+, /, "").toUpperCase()} · `
    : "";

  return (
    <section className={styles.sheet} aria-labelledby="earth-title">
      <header className={styles.head}>
        <h1 id="earth-title" className={styles.title}>
          {day ? (
            <>
              The whole Earth, <span className={styles.titleDate}>{formatLong(day).replace(/^\w+, /, "")}</span>
            </>
          ) : (
            "The whole Earth"
          )}
        </h1>
        <div className={styles.dayNav}>
          <button type="button" className={styles.step} onClick={() => goDay(prevDay)} disabled={!prevDay} aria-label="Earlier day with photos">
            <ArrowLeft size={16} aria-hidden="true" />
          </button>
          <button type="button" className={`caps ${styles.pickDate}`} onClick={() => setPicker(picker === "date" ? null : "date")} disabled={!available}>
            <CalendarDays size={15} aria-hidden="true" /> Choose a date
          </button>
          <button type="button" className={styles.step} onClick={() => goDay(nextDay)} disabled={!nextDay} aria-label="Later day with photos">
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
        {picker && available && day && (
          <div className={styles.popover}>
            <DateSetter
              key={picker}
              mode="date"
              initial={picker === "birthday" ? day : day}
              latest={latest!}
              birthday={birthday}
              min={EPIC_FIRST}
              title={picker === "birthday" ? "Earth on your birthday" : "Choose a day"}
              lede={
                picker === "birthday"
                  ? "Pick a recent birthday. The camera has photographed Earth most days since 13 June 2015."
                  : "Any day since 13 June 2015. Days without photos jump to the nearest day that has them."
              }
              submitLabel="Show the Earth that day"
              onSubmit={(picked, remember) => {
                if (remember || picker === "birthday") setBirthday(picked);
                setPicker(null);
                navigate({ view: "live", tab: "earth", date: picked });
              }}
              onClose={() => setPicker(null)}
            />
          </div>
        )}
      </header>

      {snapped && (
        <p className={styles.snapped}>
          No photos were taken on {formatLong(date!)}; showing the nearest day that has them.
        </p>
      )}

      <div className={styles.body}>
        <div
          className={`${styles.stamp} ${frames ? "" : styles.waiting}`}
          onPointerDown={frames ? onPointerDown : undefined}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {frame && <RoundStamp frame={frame} inscription={inscription} />}
          <div className={styles.globe}>
            {frame && (
              <img
                src={frameUrl(frame)}
                alt={`The sunlit face of the Earth on ${formatLong(frame.date)} at ${timeUTC(frame.time)} UTC, facing ${facing(frame.lon)}.`}
                draggable={false}
              />
            )}
          </div>
          {!frame && <span className={`caps ${styles.waitingText}`}>Developing the day’s photos…</span>}
        </div>

        <div className={styles.facts}>
          {frame ? (
            <>
              <p className={styles.time}>
                <span className="num">{timeUTC(frame.time)}</span> <span className={styles.zone}>UTC</span>
              </p>
              <p className={styles.local}>{timeLocal(frame.time)} your time</p>
              <dl className={styles.list}>
                <div>
                  <dt className="caps">Facing</dt>
                  <dd>
                    {facing(frame.lon)}
                    <span className={styles.sub}>centred on {formatCoords(frame.lat, frame.lon)}</span>
                  </dd>
                </div>
                <div>
                  <dt className="caps">Distance</dt>
                  <dd>{frame.distanceKm.toLocaleString("en-GB")} km from Earth</dd>
                </div>
                <div>
                  <dt className="caps">Frame</dt>
                  <dd>
                    {index + 1} of {count} that day
                  </dd>
                </div>
                <div>
                  <dt className="caps">Camera</dt>
                  <dd>EPIC, aboard NOAA’s DSCOVR at the Sun–Earth L1 point</dd>
                </div>
              </dl>
              <a className={`caps ${styles.full}`} href={frameUrl(frame, "png")} target="_blank" rel="noopener noreferrer">
                Full-resolution photo <ExternalLink size={13} aria-hidden="true" />
              </a>
              <p className={styles.credit}>Photo: NASA EPIC Team</p>
            </>
          ) : (
            <p className={styles.local}>Fetching the day’s photos from NASA’s EPIC archive…</p>
          )}
        </div>
      </div>

      {frames && frames.length > 1 && (
        <ol className={styles.strip} aria-label="The day’s photos">
          {frames.map((f, i) => (
            <li key={f.id}>
              <button
                type="button"
                className={styles.frameButton}
                aria-pressed={i === index}
                aria-label={`Photo ${i + 1}, ${timeUTC(f.time)} UTC`}
                onClick={() => {
                  setWarm(true);
                  setPlaying(false);
                  select(i);
                }}
              >
                <img src={frameUrl(f, "thumbs")} alt="" loading="lazy" draggable={false} />
                <span className="num">{timeUTC(f.time)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}

      <footer className={styles.actions}>
        <button
          type="button"
          className={`caps ${styles.primary}`}
          onClick={() => {
            setWarm(true);
            setPlaying(!playing);
          }}
          disabled={count < 2}
          aria-pressed={playing}
        >
          {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
          {playing ? "Pause" : "Play the day"}
        </button>
        <p className={styles.hint}>Drag the globe or use ← → to turn it. Shift + ← → changes the day.</p>
        {birthdayTarget ? (
          <a
            className={`caps ${styles.secondary}`}
            href={hrefFor({ view: "live", tab: "earth", date: birthdayTarget })}
            onClick={linkHandler({ view: "live", tab: "earth", date: birthdayTarget })}
          >
            <Cake size={15} aria-hidden="true" /> Earth on your birthday
          </a>
        ) : (
          <button type="button" className={`caps ${styles.secondary}`} onClick={() => setPicker("birthday")} disabled={!available}>
            <Cake size={15} aria-hidden="true" /> Earth on your birthday
          </button>
        )}
      </footer>

      {showingBirthday && birthdayYears.length > 1 && (
        <nav className={styles.years} aria-label="Your birthday in other years">
          <span className="caps">Your birthday in</span>
          {birthdayYears.map(({ y, d }) => (
            <a
              key={y}
              className="num"
              href={hrefFor({ view: "live", tab: "earth", date: d })}
              onClick={linkHandler({ view: "live", tab: "earth", date: d })}
              aria-current={d === date ? "page" : undefined}
            >
              {y}
            </a>
          ))}
        </nav>
      )}
    </section>
  );
}
