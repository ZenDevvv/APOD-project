import { useEffect, useState, type FormEvent } from "react";
import MiniStamp from "../MiniStamp/MiniStamp";
import { getDay, mapLimit, thumbOf, type Apod } from "../../lib/apod";
import { FIRST_ISSUE, MONTHS_LONG, daysInMonth, fromParts, isISODate, latestPossibleDate, parts, type ISODate } from "../../lib/dates";
import { setBirthday, useBirthday } from "../../lib/prefs";
import { hrefFor, linkHandler, navigate } from "../../lib/router";
import { useLatestDate } from "../../lib/useLatest";
import styles from "./Archive.module.css";
import own from "./BirthdaySheet.module.css";

function BirthdayPicker({ initial }: { initial?: string }) {
  const birthday = useBirthday();
  const [month, setMonth] = useState(initial ? Number(initial.slice(0, 2)) : 1);
  const [day, setDay] = useState(initial ? Number(initial.slice(3)) : 1);
  const [remember, setRemember] = useState(true);
  const maxDay = daysInMonth(2000, month); // leap year, so 29 February is allowed

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const d = Math.min(day, maxDay);
    const on = `${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (remember && birthday?.slice(5) !== on) {
      // Keep a full date for the day view: the most recent time this birthday came round.
      const latest = latestPossibleDate();
      let year = parts(latest).y;
      while (year > 1995 && (!isISODate(`${year}-${on}`) || `${year}-${on}` > latest)) year--;
      if (isISODate(`${year}-${on}`)) setBirthday(`${year}-${on}`);
    }
    navigate({ view: "birthday", on });
  };

  return (
    <form className={own.picker} onSubmit={submit}>
      <div className={own.fields}>
        <label>
          <span className="caps">Day</span>
          <select className="num" value={Math.min(day, maxDay)} onChange={(e) => setDay(Number(e.target.value))}>
            {Array.from({ length: maxDay }, (_, i) => (
              <option key={i} value={i + 1}>{i + 1}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="caps">Month</span>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS_LONG.map((name, i) => (
              <option key={name} value={i + 1}>{name}</option>
            ))}
          </select>
        </label>
      </div>
      <label className={own.remember}>
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        <span>Remember this as my birthday</span>
      </label>
      <button type="submit" className={`caps ${own.go}`}>Show every year</button>
    </form>
  );
}

/** One stamp for each of your birthdays the archive has covered. */
export default function BirthdaySheet({ on }: { on?: string }) {
  const birthday = useBirthday();
  const latestKnown = useLatestDate();
  const latest = latestKnown ?? latestPossibleDate();
  const monthDay = on ?? birthday?.slice(5);
  const [found, setFound] = useState<{ key: string; items: Map<number, Apod | null> } | null>(null);

  const years: number[] = [];
  if (monthDay) {
    for (let y = 1995; y <= parts(latest).y; y++) {
      const iso = `${y}-${monthDay}`;
      if (isISODate(iso) && iso >= FIRST_ISSUE && iso <= latest) years.push(y);
    }
  }
  const key = `${monthDay}:${years.length}`;

  useEffect(() => {
    if (!monthDay) return;
    let live = true;
    const items = new Map<number, Apod | null>();
    const list: number[] = [];
    for (let y = parts(latest).y; y >= 1995; y--) {
      const iso = `${y}-${monthDay}`;
      if (isISODate(iso) && iso >= FIRST_ISSUE && iso <= latest) list.push(y);
    }
    mapLimit(list, 4, async (y) => {
      const apod = await getDay(`${y}-${monthDay}` as ISODate).catch(() => null);
      if (!live) return;
      items.set(y, apod);
      setFound({ key: `${monthDay}:${list.length}`, items: new Map(items) });
    });
    return () => {
      live = false;
    };
  }, [monthDay, latest]);

  if (!monthDay) {
    return (
      <main className={styles.page}>
        <header className={styles.head}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>Your birthday, every year</h1>
            <p className={styles.sub}>Pick the day and month you were born. You’ll get one stamp for each birthday since June 1995.</p>
          </div>
        </header>
        <BirthdayPicker />
      </main>
    );
  }

  const [mm, dd] = monthDay.split("-").map(Number);
  const label = `${dd} ${MONTHS_LONG[mm - 1]}`;
  const items = found?.key === key ? found.items : new Map<number, Apod | null>();
  const isMine = birthday?.slice(5) === monthDay;
  const ordered = [...years].reverse();

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{label}, every year</h1>
          <p className={styles.sub}>
            {isMine ? "Your birthday" : "This day"} has come round {years.length} times since APOD began. Each stamp is the picture published that year.
          </p>
        </div>
        <details className={own.change}>
          <summary className="caps">Pick a different birthday</summary>
          <BirthdayPicker initial={monthDay} />
        </details>
      </header>

      <div className={styles.sheet}>
        <ol className={`${styles.pane} ${own.years}`}>
          {ordered.map((year) => {
            const date = fromParts(year, mm, dd);
            const apod = items.get(year);
            const state = apod ? "ready" : apod === null ? "missing" : "loading";
            const route = { view: "day" as const, date, birthday: isMine };
            const stamp = (
              <MiniStamp
                thumb={apod ? thumbOf(apod, 360) : undefined}
                mediaType={apod?.mediaType}
                value={year}
                caption={apod ? apod.title : apod === null ? "Not issued" : " "}
                state={state}
              />
            );
            return (
              <li key={year} className={styles.cell}>
                {apod ? (
                  <a className={styles.link} href={hrefFor(route)} onClick={linkHandler(route)} aria-label={`${year}: ${apod.title}`}>
                    {stamp}
                  </a>
                ) : (
                  <div className={styles.link}>{stamp}</div>
                )}
              </li>
            );
          })}
        </ol>
        <div className={styles.selvageBottom}>
          <span className={styles.registration} aria-hidden="true">
            <i /> <i /> <i /> <i />
          </span>
          <span className="caps">Skypost birthday sheet · {label}</span>
        </div>
      </div>
    </main>
  );
}
