import { useEffect, useMemo, useState } from "react";
import { geoCircle, geoContains, geoEquirectangular, geoGraticule10, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import world from "world-atlas/countries-110m.json";
import PlacePicker from "./PlacePicker";
import { compass, getOrbit, groundTrack, passesOver, stationAt, subsolarPoint, type Orbit, type Pass } from "../../lib/iss";
import { formatCoords, placeTimeZone, usePlace } from "../../lib/place";
import { useWidth } from "../../lib/useWidth";
import styles from "./Iss.module.css";

// ---- the chart (static parts computed once) -------------------------------------------

const W = 1000;
const H = 500;
const projection = geoEquirectangular().fitSize([W, H], { type: "Sphere" });
const path = geoPath(projection);

const topo = world as unknown as Topology<{ countries: GeometryCollection<{ name: string }>; land: GeometryCollection }>;
const countries = (feature(topo, topo.objects.countries) as FeatureCollection<Geometry, { name: string }>).features;
const landPath = path(feature(topo, topo.objects.land)) ?? "";
const graticulePath = path(geoGraticule10()) ?? "";
const equatorPath = path({ type: "LineString", coordinates: [[-180, 0], [-90, 0], [0, 0], [90, 0], [180, 0]] }) ?? "";

/** The ISS is in sight above the horizon from anywhere within about 20° of arc of the point below it. */
const FOOTPRINT_DEG = 20.3;

function overWhat(lon: number, lat: number) {
  const country = countries.find((c: Feature<Geometry, { name: string }>) => geoContains(c, [lon, lat]));
  if (country) return country.properties.name;
  if (lat <= -60) return "the Southern Ocean";
  if (lat >= 66) return "the Arctic Ocean";
  if ((lon >= -100 && lon < -70 && lat > 8 && lat < 32) || (lon >= -70 && lon < 20)) return "the Atlantic";
  if (lon >= 20 && lon < 120 && lat < 25) return "the Indian Ocean";
  return "the Pacific";
}

function useNow(interval: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(id);
  }, [interval]);
  return now;
}

function Chart({ orbit, now, observer }: { orbit: Orbit; now: number; observer?: { lat: number; lon: number; name: string } }) {
  const [boxRef, width] = useWidth<HTMLDivElement>(900);
  // SVG units per screen pixel, so markers and labels keep their size on any screen
  const k = W / Math.max(280, width);
  const minute = Math.floor(now / 60_000);
  const { past, future, night } = useMemo(() => {
    const at = new Date(minute * 60_000);
    const sun = subsolarPoint(at);
    return {
      past: groundTrack(orbit, new Date(at.getTime() - 45 * 60_000), 45),
      future: groundTrack(orbit, at, 95),
      night: path(geoCircle().center([sun[0] + 180, -sun[1]]).radius(90)()) ?? "",
    };
  }, [orbit, minute]);

  const state = stationAt(orbit, new Date(now));
  if (!state) return null;
  const [x, y] = projection([state.lon, state.lat]) ?? [0, 0];
  const footprint = path(geoCircle().center([state.lon, state.lat]).radius(FOOTPRINT_DEG)()) ?? "";
  const line = (coords: [number, number][]) => path({ type: "LineString", coordinates: coords }) ?? "";
  const you = observer ? projection([observer.lon, observer.lat]) : null;
  const utc = new Date(now).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

  return (
    <div ref={boxRef}>
    <svg className={styles.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`World map: the ISS is over ${overWhat(state.lon, state.lat)}.`}>
      <rect width={W} height={H} className={styles.ocean} />
      <path d={graticulePath} className={styles.graticule} />
      <path d={equatorPath} className={styles.equator} />
      <path d={landPath} className={styles.land} />
      <path d={night} className={styles.night} />
      <path d={footprint} className={styles.footprint} />

      {past.map((run, i) => (
        <path key={`p${i}`} d={line(run)} className={styles.past} />
      ))}
      {/* the coming orbit, drawn as a cancellation: one line and two finer ones beside it */}
      <g className={styles.track}>
        {future.map((run, i) => (
          <g key={`f${i}`}>
            <path d={line(run)} className={styles.trackMain} />
            <path d={line(run)} className={styles.trackFine} transform="translate(0 -6)" />
            <path d={line(run)} className={styles.trackFine} transform="translate(0 6)" />
          </g>
        ))}
      </g>

      {you && observer && (
        <g className={styles.you} transform={`translate(${you[0]} ${you[1]}) scale(${k})`}>
          <circle r="6.5" className={styles.youRing} />
          <circle r="4.5" className={styles.youDot} />
          <text x="10" y="4.5" className={styles.youLabel}>
            {observer.name}
          </text>
        </g>
      )}

      <g className={styles.station} transform={`translate(${x} ${y}) scale(${k * 1.1})`}>
        <g className={styles.postmark} transform="rotate(-8)">
          <circle r="27" className={styles.pmOuter} />
          <circle r="19" className={styles.pmInner} />
          <text y="-2" className={styles.pmName}>
            ISS
          </text>
          <text y="9" className={styles.pmTime}>
            {utc}
          </text>
        </g>
        <circle r="3.2" className={styles.stationDot} />
      </g>
    </svg>
    </div>
  );
}

function PassRow({ pass, timeZone, now }: { pass: Pass; timeZone: string; now: number }) {
  const day = pass.start.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone });
  const time = pass.start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone });
  const minutes = Math.max(1, Math.round((pass.end.getTime() - pass.start.getTime()) / 60_000));
  const inMin = Math.round((pass.start.getTime() - now) / 60_000);
  const soon = inMin < 60 ? `in ${Math.max(0, inMin)} min` : inMin < 24 * 60 ? `in ${Math.round(inMin / 60)} h` : null;
  return (
    <li className={`${styles.pass} ${pass.visible ? styles.visible : ""}`}>
      <span className={styles.passWhen}>
        <strong className="num">{time}</strong> {day}
      </span>
      <span
        className={`caps ${styles.badge}`}
        title={pass.visible ? "The station is sunlit while your sky is dark" : "It passes in daylight, or while in Earth’s shadow"}
      >
        {pass.visible ? "Visible" : "Not visible"}
      </span>
      <span className={styles.passHow}>
        {soon ? `${soon} · ` : ""}
        {minutes} min · {compass(pass.startAzimuth)} → {compass(pass.endAzimuth)} · up to {Math.round(pass.maxElevation)}°
      </span>
    </li>
  );
}

export default function Iss() {
  const place = usePlace();
  const [orbit, setOrbit] = useState<Orbit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const now = useNow(1000);

  useEffect(() => {
    let live = true;
    getOrbit().then(
      (o) => live && setOrbit(o),
      (err: Error) => live && setError(err.message),
    );
    return () => {
      live = false;
    };
  }, []);

  const bucket = Math.floor(now / 300_000);
  const allPasses = useMemo(
    () => (orbit && place ? passesOver(orbit, place.lat, place.lon, new Date(bucket * 300_000)) : []),
    [orbit, place, bucket],
  );
  const passes = allPasses.filter((p) => p.end.getTime() > now);

  const state = orbit ? stationAt(orbit, new Date(now)) : null;
  const timeZone = place ? placeTimeZone(place) : undefined;
  const nextVisible = passes.find((p) => p.visible);
  const ageHours = orbit ? Math.max(0, Math.round((now - orbit.fetchedAt) / 3600_000)) : 0;

  if (error && !orbit) {
    return (
      <section className={styles.notice}>
        <h1>Couldn’t fetch the station’s orbit.</h1>
        <p>{error}</p>
      </section>
    );
  }

  return (
    <section className={styles.layout} aria-labelledby="iss-title">
      <div className={styles.chartWrap}>
        {orbit ? (
          <Chart orbit={orbit} now={now} observer={place ? { lat: place.lat, lon: place.lon, name: place.name } : undefined} />
        ) : (
          <div className={`${styles.chart} ${styles.chartWaiting}`}>
            <span className="caps">Plotting the orbit…</span>
          </div>
        )}
        <p className={styles.legend}>
          <span className={styles.keyTrack} aria-hidden="true" /> Next 95 minutes
          <span className={styles.keyPast} aria-hidden="true" /> Last 45 minutes
          <span className={styles.keyFoot} aria-hidden="true" /> In sight from inside this ring
          <span className={styles.keyNight} aria-hidden="true" /> Night side
        </p>
      </div>

      <aside className={styles.slip}>
        <h1 id="iss-title" className={styles.title}>
          The International Space Station
        </h1>
        {state ? (
          <dl className={styles.telemetry}>
            <div className={styles.over}>
              <dt className="caps">Over</dt>
              <dd>
                {overWhat(state.lon, state.lat)}
                <span className={styles.sub}>{formatCoords(state.lat, state.lon)}</span>
              </dd>
            </div>
            <div>
              <dt className="caps">Altitude</dt>
              <dd className="num">{Math.round(state.altitudeKm).toLocaleString("en-GB")} km</dd>
            </div>
            <div>
              <dt className="caps">Speed</dt>
              <dd className="num">{Math.round(state.speedKmh).toLocaleString("en-GB")} km/h</dd>
            </div>
            <div className={styles.light}>
              <dt className="caps">Light</dt>
              <dd>{state.sunlit ? "In sunlight" : "In Earth’s shadow"}</dd>
            </div>
          </dl>
        ) : (
          <p className={styles.sub}>Fetching the orbit…</p>
        )}

        <div className={styles.passes}>
          <h2 className={styles.passTitle}>{place ? `Passes over ${place.name}` : "When does it pass over you?"}</h2>
          {place && orbit && (
            <>
              <p className={styles.lead}>
                {nextVisible ? (
                  <>
                    Look <strong>{compass(nextVisible.startAzimuth)}</strong> at{" "}
                    <strong className="num">
                      {nextVisible.start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone })}
                    </strong>{" "}
                    {nextVisible.start.toLocaleDateString("en-GB", { weekday: "long", timeZone })}: a bright, steady dot crossing the sky
                    in about {Math.max(1, Math.round((nextVisible.end.getTime() - nextVisible.start.getTime()) / 60_000))} minutes.
                  </>
                ) : passes.length ? (
                  "No visible passes in the next three days. It goes over in daylight, or while it’s in Earth’s shadow."
                ) : Math.abs(place.lat) > 58 ? (
                  `The station’s orbit is tilted 51.6° to the equator, so from ${Math.abs(place.lat).toFixed(0)}° ${place.lat >= 0 ? "north" : "south"} it stays low on the ${place.lat >= 0 ? "southern" : "northern"} horizon and never climbs high enough to list.`
                ) : (
                  "It doesn’t climb high over this place in the next three days."
                )}
              </p>
              {passes.length > 0 && (
                <ol className={styles.passList}>
                  {passes.slice(0, 4).map((p) => (
                    <PassRow key={p.start.getTime()} pass={p} timeZone={timeZone!} now={now} />
                  ))}
                </ol>
              )}
            </>
          )}
          <PlacePicker tone="paper" reason="Set where you are to see when the station flies over and whether you can spot it." />
        </div>

        <p className={styles.source}>
          Computed in your browser from {orbit?.source ?? "CelesTrak"} orbit data
          {orbit ? ` fetched ${ageHours ? `${ageHours} h` : "just now"} ago` : ""}. Times shown in{" "}
          {timeZone ?? "your time zone"}.
        </p>
      </aside>
    </section>
  );
}
