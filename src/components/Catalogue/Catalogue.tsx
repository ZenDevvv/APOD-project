import { useEffect, useId, useRef } from "react";
import { ArrowRight, ExternalLink, X } from "lucide-react";
import Rich from "../Rich/Rich";
import type { Apod } from "../../lib/apod";
import { addDays, dayNumber, formatLong, type ISODate } from "../../lib/dates";
import { hrefFor, linkHandler } from "../../lib/router";
import styles from "./Catalogue.module.css";

interface CatalogueProps {
  apod: Apod;
  latest?: ISODate;
  countdown?: string;
  onClose: () => void;
  onBirthday: () => void;
}

const MEDIUM = { image: "Picture", video: "Film", other: "Other media" } as const;

/** The stamp's catalogue entry: everything the original sidebar showed, and more. */
export default function Catalogue({ apod, latest, countdown, onClose, onBirthday }: CatalogueProps) {
  const headingId = useId();
  const ref = useRef<HTMLElement>(null);
  const next = addDays(apod.date, 1);
  const nextRoute = { view: "day" as const, date: next };
  const isLatest = latest === apod.date;

  useEffect(() => {
    ref.current?.focus();
  }, [apod.date]);

  return (
    <aside ref={ref} className={styles.sheet} aria-labelledby={headingId} tabIndex={-1}>
      <div className={styles.top}>
        <button type="button" className={`caps ${styles.close}`} onClick={onClose}>
          Close <X size={15} aria-hidden="true" />
        </button>
      </div>

      <h2 id={headingId} className={styles.title}>
        {apod.title}
      </h2>

      <dl className={styles.facts}>
        <div>
          <dt className="caps">Published</dt>
          <dd>{formatLong(apod.date)}</dd>
        </div>
        <div>
          <dt className="caps">Issue</dt>
          <dd>Day {dayNumber(apod.date).toLocaleString("en-GB")} since 16 June 1995</dd>
        </div>
        <div>
          <dt className="caps">Medium</dt>
          <dd>{MEDIUM[apod.mediaType]}</dd>
        </div>
        {apod.credit.length > 0 && (
          <div className={styles.full}>
            <dt className="caps">Credit &amp; copyright</dt>
            <dd>
              <Rich nodes={apod.credit} />
            </dd>
          </div>
        )}
      </dl>

      <div className={styles.explanation}>
        <Rich nodes={apod.explanation} />
      </div>

      {apod.teaser && (
        <p className={styles.teaser}>
          <span className="caps">Tomorrow’s picture</span>{" "}
          {isLatest ? (
            <>
              <span className={styles.teaserText}>{apod.teaser}</span>
              {countdown && <span className={styles.countdown}> · due in {countdown}</span>}
            </>
          ) : (
            <a className={styles.teaserLink} href={hrefFor(nextRoute)} onClick={linkHandler(nextRoute)}>
              {apod.teaser} <ArrowRight size={14} aria-hidden="true" />
            </a>
          )}
        </p>
      )}

      <div className={styles.links}>
        <a className="caps" href={apod.permalink} target="_blank" rel="noopener noreferrer">
          Read it on NASA Science <ExternalLink size={13} aria-hidden="true" />
        </a>
        {apod.image && apod.mediaType !== "video" && (
          <a className="caps" href={apod.image.full} target="_blank" rel="noopener noreferrer">
            Full-resolution file <ExternalLink size={13} aria-hidden="true" />
          </a>
        )}
      </div>

      <div className={styles.birthday}>
        <p>Want to know the astronomy picture of your birthday?</p>
        <button type="button" className="caps" onClick={onBirthday}>
          Find your birthday picture
        </button>
      </div>

      <p className={styles.small}>
        Picture and text from NASA’s Astronomy Picture of the Day at science.nasa.gov/apod, credited to their authors
        above. Skypost is an unofficial viewer, not a NASA product.
      </p>
    </aside>
  );
}
