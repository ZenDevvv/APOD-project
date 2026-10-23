import { lazy, Suspense, useEffect } from "react";
import { Earth as EarthIcon, MoonStar, Satellite } from "lucide-react";
import { hrefFor, linkHandler, LIVE_TABS, type LiveTab } from "../../lib/router";
import { readJSON, writeJSON } from "../../lib/storage";
import type { ISODate } from "../../lib/dates";
import styles from "./Live.module.css";

const Earth = lazy(() => import("./Earth"));
const Iss = lazy(() => import("./Iss"));
const Tonight = lazy(() => import("./Tonight"));

const TAB_KEY = "skypost:v1:live-tab";

const TABS: { tab: LiveTab; label: string; note: string; Icon: typeof EarthIcon }[] = [
  { tab: "earth", label: "Earth", note: "The whole planet, from 1.5 million km", Icon: EarthIcon },
  { tab: "iss", label: "ISS", note: "Where the space station is right now", Icon: Satellite },
  { tab: "tonight", label: "Tonight", note: "Clouds, aurora and the next launch", Icon: MoonStar },
];

/** Live sky: three tabs, each with its own layout, inside the same album. */
export default function Live({ tab, date }: { tab?: LiveTab; date?: ISODate }) {
  const remembered = readJSON<string | null>(TAB_KEY, null);
  const active: LiveTab = tab ?? (LIVE_TABS.includes(remembered as LiveTab) ? (remembered as LiveTab) : "earth");

  useEffect(() => {
    writeJSON(TAB_KEY, active);
  }, [active]);

  return (
    <main className={styles.page}>
      <nav className={styles.tabs} aria-label="Live sky">
        {TABS.map(({ tab: t, label, note, Icon }) => {
          const route = { view: "live" as const, tab: t };
          return (
            <a
              key={t}
              className={styles.tab}
              href={hrefFor(route)}
              onClick={linkHandler(route)}
              aria-current={active === t ? "page" : undefined}
            >
              <Icon size={18} aria-hidden="true" />
              <span className={styles.tabText}>
                <span className="caps">{label}</span>
                <span className={styles.note}>{note}</span>
              </span>
            </a>
          );
        })}
      </nav>

      <Suspense fallback={<div className={styles.loading} />}>
        {active === "earth" && <Earth date={date} />}
        {active === "iss" && <Iss />}
        {active === "tonight" && <Tonight />}
      </Suspense>
    </main>
  );
}
