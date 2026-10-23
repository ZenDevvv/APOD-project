import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Rocket } from "lucide-react";
import PlacePicker from "./PlacePicker";
import Perf from "../Perf/Perf";
import {
  auroraOutlook,
  CLEAR,
  geomagneticLatitude,
  getKp,
  getLaunches,
  getNight,
  moonPhase,
  skyVerdict,
  type KpSlot,
  type Launch,
  type Night,
} from "../../lib/tonight";
import { placeTimeZone, usePlace } from "../../lib/place";
import { useWidth } from "../../lib/useWidth";
import styles from "./Tonight.module.css";

function useNow(interval: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(id);
  }, [interval]);
  return now;
}

function useLoad<T>(load: (() => Promise<T>) | null, deps: unknown[]) {
  const [state, setState] = useState<{ key: string; value?: T; error?: string } | null>(null);
  const key = JSON.stringify(deps);
  useEffect(() => {
    if (!load) return;
    let live = true;
    load().then(
      (value) => live && setState({ key, value }),
      (err: Error) => live && setState({ key, error: err.message }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state?.key === key ? state : null;
}

const hourFormat = (timeZone: string) => (ms: number) =>
  new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone });

// ---- the night as a coil of hourly stamps ----------------------------------------------

const STARS = [
  [18, 26],
  [62, 18],
  [40, 52],
  [78, 60],
  [26, 74],
  [86, 34],
];

function NightCoil({ night, now }: { night: Night; now: number }) {
  const fmt = hourFormat(night.timezone);
  return (
    <div className={styles.coil}>
      <p className={styles.ends}>
        <span>
          <span className="caps">Sunset</span> <strong className="num">{fmt(night.sunset)}</strong>
        </span>
        <span>
          <span className="caps">Sunrise</span> <strong className="num">{fmt(night.sunrise)}</strong>
        </span>
      </p>
      <ol className={styles.hours} aria-label="Cloud cover through the night, hour by hour">
        {night.hours.map((h) => {
          const current = now >= h.time && now < h.time + 3600_000;
          const clarity = 1 - h.cloud / 100;
          return (
            <li key={h.time} className={`${styles.hour} ${current ? styles.now : ""}`}>
              <Perf size="small" flat className={styles.hourStamp}>
                <span className={styles.hourTop}>
                  <span className={`num ${styles.hourLabel}`}>{fmt(h.time).slice(0, 2)}</span>
                    </span>
                <span className={styles.sky} style={{ "--cloud": `${h.cloud}%` } as CSSProperties} aria-hidden="true">
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                    {STARS.map(([x, y], i) => (
                      <circle key={i} cx={x} cy={y} r={i % 2 ? 2.2 : 1.6} style={{ opacity: Math.max(0, clarity * 1.4 - 0.4) }} />
                    ))}
                  </svg>
                </span>
                <span className={`num ${styles.cloudValue}`}>
                  {Math.round(h.cloud)}%<span className="visually-hidden"> cloud at {fmt(h.time)}</span>
                </span>
              </Perf>
            </li>
          );
        })}
      </ol>
      <p className={styles.coilNote}>
        Cloud cover each hour. Below {CLEAR}% the sky is clear enough for stars. Forecast by Open-Meteo.
      </p>
    </div>
  );
}

// ---- Kp chart ----------------------------------------------------------------------------

const OBSERVED = "#5b43b3";
const FORECAST = "#a493e8";

const SLOT = 3 * 3600_000;

function KpChart({ slots, now, needed, timeZone }: { slots: KpSlot[]; now: number; needed?: number; timeZone: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const [plotRef, width] = useWidth<HTMLDivElement>(520);
  // fixed three-hour slots from 24 h ago to 24 h ahead; NOAA's file sometimes has gaps, which stay gaps
  const first = Math.floor((now - 24 * 3600_000) / SLOT) * SLOT;
  const byTime = new Map(slots.map((s) => [s.time, s]));
  const cells = Array.from({ length: 16 }, (_, i) => ({ time: first + i * SLOT, s: byTime.get(first + i * SLOT) }));
  const present = cells.filter((c) => c.s).map((c) => c.s!);
  if (!present.length) return null;

  const VW = Math.max(300, width);
  const every = VW < 420 ? 4 : 2;
  const VH = 190;
  const left = 26;
  const top = 14;
  const bottom = 30;
  const plotH = VH - top - bottom;
  const slot = (VW - left - 6) / cells.length;
  const barW = Math.min(24, slot - 4);
  const y = (kp: number) => top + plotH * (1 - kp / 9);
  const max = present.reduce((a, b) => (b.kp > a.kp ? b : a), present[0]);
  const maxIndex = cells.findIndex((c) => c.s === max);
  const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone });
  const fmtDay = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { weekday: "short", timeZone });
  const nowX = left + ((now - first) / SLOT) * slot;
  const bar = (x: number, kp: number) => {
    const h = Math.max(2, plotH * (kp / 9));
    const r = Math.min(4, h, barW / 2);
    const yTop = top + plotH - h;
    return `M${x} ${top + plotH} V${yTop + r} Q${x} ${yTop} ${x + r} ${yTop} H${x + barW - r} Q${x + barW} ${yTop} ${x + barW} ${yTop + r} V${top + plotH} Z`;
  };
  const tip = hover !== null ? cells[hover] : null;
  const gaps = cells.some((c) => !c.s);

  return (
    <figure className={styles.kpFigure}>
      <div className={styles.kpLegend} aria-hidden="true">
        <span>
          <i style={{ background: OBSERVED }} /> Observed
        </span>
        <span>
          <i style={{ background: FORECAST }} /> Forecast
        </span>
        {gaps && <span className={styles.kpGap}>Gaps: NOAA hasn’t published those hours yet</span>}
      </div>
      <div className={styles.kpPlot} ref={plotRef}>
        <svg viewBox={`0 0 ${VW} ${VH}`} className={styles.kpSvg} role="group" aria-label="Planetary Kp index, last 24 hours and next 24 hours">
          {[0, 3, 6, 9].map((v) => (
            <g key={v}>
              <line x1={left} x2={VW} y1={y(v)} y2={y(v)} className={styles.grid} />
              <text x={left - 8} y={y(v) + 4} className={styles.tick}>
                {v}
              </text>
            </g>
          ))}
          <line x1={left} x2={VW} y1={y(5)} y2={y(5)} className={styles.storm} />
          <text x={VW - 2} y={y(5) - 5} className={styles.refLabel}>
            Storm level (Kp 5)
          </text>
          {needed !== undefined && needed <= 9 && needed > 0 && (
            <>
              <line x1={left} x2={VW} y1={y(needed)} y2={y(needed)} className={styles.needed} />
              <text x={VW - 2} y={y(needed) - 5} className={`${styles.refLabel} ${styles.neededLabel}`}>
                Needed here (Kp {needed.toFixed(0)})
              </text>
            </>
          )}
          {cells.map(({ time, s }, i) => {
            const x = left + i * slot + (slot - barW) / 2;
            return (
              <g key={time}>
                {s ? (
                  <path d={bar(x, s.kp)} fill={s.kind === "predicted" ? FORECAST : OBSERVED} className={hover === i ? styles.barHover : undefined} />
                ) : (
                  <line x1={x + 3} x2={x + barW - 3} y1={top + plotH - 1} y2={top + plotH - 1} className={styles.gapMark} />
                )}
                <rect
                  x={left + i * slot}
                  y={top}
                  width={slot}
                  height={plotH}
                  className={styles.hit}
                  tabIndex={0}
                  role="img"
                  aria-label={
                    s
                      ? `Kp ${s.kp.toFixed(1)}, ${s.kind === "predicted" ? "forecast" : "observed"}, ${fmtDay(time)} ${fmtTime(time)}`
                      : `No data yet for ${fmtDay(time)} ${fmtTime(time)}`
                  }
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                />
                {i % every === 0 && (
                  <text x={left + i * slot + slot / 2} y={VH - 10} className={styles.xLabel}>
                    {fmtTime(time)}
                  </text>
                )}
              </g>
            );
          })}
          <text x={left + maxIndex * slot + slot / 2} y={y(max.kp) - 6} className={styles.maxLabel}>
            {max.kp.toFixed(1)}
          </text>
          {nowX > left && nowX < VW && (
            <g>
              <line x1={nowX} x2={nowX} y1={top - 6} y2={top + plotH} className={styles.nowLine} />
              <text x={nowX + 4} y={top + 2} className={styles.nowLabel}>
                now
              </text>
            </g>
          )}
        </svg>
        {tip && hover !== null && (
          <div className={styles.tooltip} style={{ left: `${((left + hover * slot + slot / 2) / VW) * 100}%` }} role="status">
            <strong className="num">{tip.s ? `Kp ${tip.s.kp.toFixed(1)}` : "No data yet"}</strong>
            <span>
              {tip.s && <i style={{ background: tip.s.kind === "predicted" ? FORECAST : OBSERVED }} />}
              {tip.s ? (tip.s.kind === "predicted" ? "Forecast" : "Observed") + " · " : ""}
              {fmtDay(tip.time)} {fmtTime(tip.time)}–{fmtTime(tip.time + SLOT)}
            </span>
          </div>
        )}
      </div>
      <details className={styles.table}>
        <summary className="caps">Kp values as a table</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Three hours from</th>
              <th scope="col">Kp</th>
              <th scope="col">Kind</th>
            </tr>
          </thead>
          <tbody>
            {cells.map(({ time, s }) => (
              <tr key={time}>
                <td>
                  {fmtDay(time)} {fmtTime(time)}
                </td>
                <td className="num">{s ? s.kp.toFixed(2) : "—"}</td>
                <td>{s ? (s.kind === "predicted" ? "Forecast" : s.kind === "estimated" ? "Estimated" : "Observed") : "Not published yet"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

// ---- next launch ---------------------------------------------------------------------

function countdown(ms: number) {
  const sign = ms >= 0 ? "T−" : "T+";
  const s = Math.floor(Math.abs(ms) / 1000);
  const d = Math.floor(s / 86400);
  const h = String(Math.floor((s % 86400) / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${sign}${d ? `${d}d ` : ""}${h}:${m}:${sec}`;
}

const PRECISION: Record<string, string> = {
  SEC: "",
  MIN: "to the minute",
  HR: "to the hour",
  DAY: "date only",
  MON: "month only",
  QTR: "quarter only",
  YR: "year only",
};

function NextLaunch({ launches, now, timeZone }: { launches: Launch[]; now: number; timeZone: string }) {
  const upcoming = launches.filter((l) => l.net > now - 30 * 60_000);
  const next = upcoming[0];
  if (!next) return <p className={styles.launchMeta}>No launches are scheduled in the feed right now.</p>;
  const when = new Date(next.net).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone });
  const exact = next.precision === "SEC" || next.precision === "MIN";
  return (
    <>
      <p className={styles.countdown} aria-live="off">
        {exact ? countdown(next.net - now) : `No earlier than ${new Date(next.net).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone })}`}
      </p>
      <h3 className={styles.launchName}>{next.mission ?? next.name}</h3>
      <p className={styles.launchMeta}>
        {next.rocket} · {next.provider}
      </p>
      <p className={styles.launchMeta}>
        {next.pad}, {next.location}
      </p>
      <p className={styles.launchMeta}>
        <span className={`caps ${styles.status}`}>{next.statusName}</span> {when}
        {PRECISION[next.precision] ? ` (${PRECISION[next.precision]})` : ""}
      </p>
      {upcoming.length > 1 && (
        <ol className={styles.after}>
          {upcoming.slice(1, 3).map((l) => (
            <li key={l.id}>
              <span className="num">
                {new Date(l.net).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone })}
              </span>
              <span>{l.mission ?? l.name}</span>
              <span className={styles.afterRocket}>{l.rocket}</span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

// ---- the tab ---------------------------------------------------------------------------

export default function Tonight() {
  const place = usePlace();
  const now = useNow(1000);
  const night = useLoad(place ? () => getNight(place.lat, place.lon) : null, [place?.lat, place?.lon]);
  const kp = useLoad(getKp, ["kp"]);
  const launches = useLoad(getLaunches, ["launches"]);

  const timeZone = night?.value?.timezone ?? (place ? placeTimeZone(place) : Intl.DateTimeFormat().resolvedOptions().timeZone);
  const magLat = place ? geomagneticLatitude(place.lat, place.lon) : undefined;

  const nightKp = useMemo(() => {
    if (!kp?.value || !night?.value) return undefined;
    const { sunset, sunrise } = night.value;
    const during = kp.value.filter((s) => s.time + 3 * 3600_000 > sunset && s.time < sunrise);
    return during.length ? Math.max(...during.map((s) => s.kp)) : undefined;
  }, [kp, night]);

  const aurora = magLat !== undefined && nightKp !== undefined ? auroraOutlook(magLat, nightKp) : undefined;
  const sky = night?.value ? skyVerdict(night.value, hourFormat(night.value.timezone)) : undefined;
  const moon = moonPhase(night?.value ? (night.value.sunset + night.value.sunrise) / 2 : now);

  const headline = place
    ? sky
      ? `${night!.value!.underway ? "Right now" : "Tonight"} in ${place.name}: ${sky}.`
      : night?.error
        ? `Tonight in ${place.name}: the forecast didn’t load.`
        : `Tonight in ${place.name}…`
    : "What will the sky do tonight?";

  const clearHours = night?.value ? night.value.hours.filter((h) => h.cloud <= CLEAR).length : 0;
  const cloudNote = night?.value && aurora && aurora.level !== "unlikely" ? (clearHours === 0 ? ", but the cloud may hide it" : ", in the clear spells") : "";
  const auroraSentence = aurora
    ? aurora.level === "likely"
      ? `Aurora likely${cloudNote}. Look ${aurora.toward}.`
      : aurora.level === "possible"
        ? `Aurora possible, low in the ${aurora.toward}${cloudNote}.`
        : "Aurora unlikely here."
    : null;

  return (
    <section className={styles.page} aria-labelledby="tonight-title">
      <header className={styles.head}>
        <h1 id="tonight-title" className={styles.headline}>
          {headline}
        </h1>
        {place && (
          <p className={styles.second}>
            {auroraSentence && <span>{auroraSentence} </span>}
            <span>
              {moon.name}, {Math.round(moon.illumination * 100)}% lit.
            </span>
          </p>
        )}
        <PlacePicker reason="Set where you are to get tonight’s cloud forecast and your aurora chances. The launch countdown works anywhere." />
      </header>

      {place && night?.value && <NightCoil night={night.value} now={now} />}
      {place && night?.error && <p className={styles.error}>{night.error}</p>}

      <div className={styles.lower}>
        <section className={styles.aurora} aria-labelledby="aurora-title">
          <h2 id="aurora-title" className={styles.blockTitle}>
            Aurora
          </h2>
          <p className={styles.blockLead}>
            {aurora && magLat !== undefined ? (
              aurora.level === "unlikely" ? (
                aurora.horizonKp > 9 ? (
                  <>Out of reach from {place!.name}: even the strongest storms (Kp 9) keep the aurora far poleward of your latitude.</>
                ) : (
                  <>
                    Not tonight. From {place!.name} it takes about <strong>Kp {Math.ceil(aurora.horizonKp)}</strong> to see it low in the{" "}
                    {aurora.toward}; tonight’s forecast peaks at <strong>Kp {nightKp!.toFixed(1)}</strong>.
                  </>
                )
              ) : (
                <>
                  Tonight’s forecast peaks at <strong>Kp {nightKp!.toFixed(1)}</strong>, enough to {aurora.level === "likely" ? "see it overhead" : "see it on the horizon"}{" "}
                  from {place!.name}. Get away from city lights and look {aurora.toward}.
                </>
              )
            ) : (
              "Geomagnetic activity on the planetary Kp scale (0 to 9). Above 5 is a storm, when aurora reaches lower latitudes."
            )}
          </p>
          {kp?.value && <KpChart slots={kp.value} now={now} needed={aurora ? aurora.horizonKp : undefined} timeZone={timeZone} />}
          {kp?.error && <p className={styles.error}>{kp.error}</p>}
          <p className={styles.source}>
            Kp from NOAA’s Space Weather Prediction Center. The aurora reading is an estimate from your geomagnetic latitude
            {magLat !== undefined ? ` (${Math.abs(magLat).toFixed(0)}° ${magLat >= 0 ? "N" : "S"})` : ""}.
          </p>
        </section>

        <section className={styles.launch} aria-labelledby="launch-title">
          <h2 id="launch-title" className={styles.launchTitle}>
            <Rocket size={16} aria-hidden="true" /> Next launch
          </h2>
          {launches?.value ? <NextLaunch launches={launches.value} now={now} timeZone={timeZone} /> : null}
          {!launches && <p className={styles.launchMeta}>Checking the launch schedule…</p>}
          {launches?.error && <p className={styles.launchMeta}>{launches.error}</p>}
          <p className={styles.launchSource}>Schedule from Launch Library 2 by The Space Devs. Times in {timeZone}.</p>
        </section>
      </div>
    </section>
  );
}
