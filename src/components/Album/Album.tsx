import { useState } from "react";
import { X } from "lucide-react";
import MiniStamp from "../MiniStamp/MiniStamp";
import { toast } from "../Toast/toast";
import { formatLong, formatShort } from "../../lib/dates";
import { album, useAlbum } from "../../lib/prefs";
import { hrefFor, linkHandler } from "../../lib/router";
import styles from "./Album.module.css";

type Order = "added" | "issued";

/** The stockbook: every stamp you hinged in, held under glassine strips. */
export default function Album() {
  const stamps = useAlbum();
  const [order, setOrder] = useState<Order>("added");
  const sorted = [...stamps].sort((a, b) => (order === "added" ? b.addedAt - a.addedAt : b.date.localeCompare(a.date)));

  const remove = (date: string) => {
    const stamp = stamps.find((s) => s.date === date);
    album.remove(date);
    toast("Taken out of your album.", stamp ? { label: "Undo", run: () => album.restore(stamp) } : undefined);
  };

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Your album</h1>
          <p className={styles.sub}>
            {stamps.length
              ? `${stamps.length} ${stamps.length === 1 ? "stamp" : "stamps"}, kept in this browser.`
              : "Stamps you keep are stored in this browser."}
          </p>
        </div>
        {stamps.length > 1 && (
          <div className={styles.order} role="group" aria-label="Order stamps by">
            <button type="button" aria-pressed={order === "added"} onClick={() => setOrder("added")}>
              Recently added
            </button>
            <button type="button" aria-pressed={order === "issued"} onClick={() => setOrder("issued")}>
              Date issued
            </button>
          </div>
        )}
      </header>

      <div className={styles.leaf}>
        {stamps.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptySlot} aria-hidden="true" />
            <div className={styles.emptyText}>
              <h2>Nothing hinged in yet.</h2>
              <p>
                Open any day and choose <strong>Album</strong> (or press <kbd>S</kbd>) to keep its stamp here.
              </p>
              <div className={styles.emptyLinks}>
                <a className="caps" href={hrefFor({ view: "day" })} onClick={linkHandler({ view: "day" })}>
                  Today’s issue
                </a>
                <a className="caps" href={hrefFor({ view: "archive" })} onClick={linkHandler({ view: "archive" })}>
                  Browse this month
                </a>
              </div>
            </div>
          </div>
        ) : (
          <ol className={styles.grid}>
            {sorted.map((stamp) => (
              <li key={stamp.date} className={styles.item}>
                <a
                  className={styles.link}
                  href={hrefFor({ view: "day", date: stamp.date })}
                  onClick={linkHandler({ view: "day", date: stamp.date })}
                  aria-label={`${formatLong(stamp.date)}: ${stamp.title}`}
                >
                  <MiniStamp thumb={stamp.thumb} mediaType={stamp.mediaType} value={formatShort(stamp.date)} caption={stamp.title} size="medium" />
                </a>
                <button type="button" className={styles.remove} onClick={() => remove(stamp.date)} aria-label={`Remove ${stamp.title} from your album`}>
                  <X size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </main>
  );
}
