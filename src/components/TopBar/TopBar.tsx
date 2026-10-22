import { useState } from "react";
import { Keyboard } from "lucide-react";
import Keys from "../Keys/Keys";
import { hrefFor, linkHandler, type Route, type View } from "../../lib/router";
import { useAlbum } from "../../lib/prefs";
import styles from "./TopBar.module.css";

const NAV: { view: View; label: string; route: Route }[] = [
  { view: "day", label: "Today", route: { view: "day" } },
  { view: "archive", label: "Archive", route: { view: "archive" } },
  { view: "album", label: "Album", route: { view: "album" } },
  { view: "game", label: "Game", route: { view: "game" } },
];

function Logomark() {
  return (
    <svg className={styles.mark} viewBox="0 0 28 32" aria-hidden="true">
      <defs>
        <mask id="logo-perf">
          <rect width="28" height="32" fill="#fff" />
          {Array.from({ length: 6 }, (_, i) => (
            <g key={i} fill="#000">
              <circle cx={2 + i * 4.8} cy="0" r="1.6" />
              <circle cx={2 + i * 4.8} cy="32" r="1.6" />
            </g>
          ))}
          {Array.from({ length: 7 }, (_, i) => (
            <g key={`v${i}`} fill="#000">
              <circle cx="0" cy={2 + i * 4.7} r="1.6" />
              <circle cx="28" cy={2 + i * 4.7} r="1.6" />
            </g>
          ))}
        </mask>
      </defs>
      <rect width="28" height="32" fill="var(--paper)" mask="url(#logo-perf)" />
      <rect x="4" y="4" width="20" height="17" fill="#141826" />
      <circle cx="17.5" cy="10" r="2.2" fill="var(--paper)" />
      <circle cx="9" cy="15" r="0.9" fill="var(--paper)" />
      <circle cx="12" cy="8" r="0.6" fill="var(--paper)" />
      <rect x="4" y="24" width="13" height="2" fill="var(--ink)" />
    </svg>
  );
}

export default function TopBar({ view, dated }: { view: View; dated?: boolean }) {
  const stamps = useAlbum();
  const [keys, setKeys] = useState(false);
  const active = view === "birthday" ? "archive" : view === "day" && dated ? null : view;

  return (
    <header className={styles.bar}>
      <a className={styles.brand} href={hrefFor({ view: "day" })} onClick={linkHandler({ view: "day" })}>
        <Logomark />
        <span className={styles.word}>Skypost</span>
      </a>

      <nav className={styles.nav} aria-label="Sections">
        {NAV.map((item) => (
          <a
            key={item.view}
            className={styles.link}
            href={hrefFor(item.route)}
            onClick={linkHandler(item.route)}
            aria-current={active === item.view ? "page" : undefined}
          >
            {item.label}
            {item.view === "album" && stamps.length > 0 && <span className={`${styles.count} num`}>{stamps.length}</span>}
          </a>
        ))}
      </nav>

      <div className={styles.end}>
        <button type="button" className={styles.keys} aria-expanded={keys} onClick={() => setKeys(!keys)}>
          <Keyboard size={16} aria-hidden="true" />
          <span>Keys</span>
        </button>
        {keys && <Keys onClose={() => setKeys(false)} />}
      </div>
    </header>
  );
}
