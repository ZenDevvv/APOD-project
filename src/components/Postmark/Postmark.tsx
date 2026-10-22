import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { formatLong, type ISODate } from "../../lib/dates";
import { RollingDate } from "./Wheels";
import styles from "./Postmark.module.css";

interface PostmarkProps {
  date: ISODate | null;
  /** Smudged postmarks hide the date (used by the guessing game). */
  smudged?: boolean;
  top?: string;
  bottom?: string;
  className?: string;
  onClick?: () => void;
  label?: string;
  children?: ReactNode;
}

const reduceMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A circular date stamp, struck in cancellation ink. */
export default function Postmark({
  date,
  smudged,
  top = "SKYPOST ARCHIVE",
  bottom = "SINCE 1995",
  className,
  onClick,
  label,
}: PostmarkProps) {
  const id = useId().replace(/:/g, "");
  const ref = useRef<HTMLElement>(null);

  // The one authored motion: the canceller strikes when a new day arrives.
  useEffect(() => {
    const el = ref.current;
    if (!el || reduceMotion()) return;
    el.animate(
      [
        { transform: "scale(1.16)", opacity: 0.35, filter: "blur(1.4px)" },
        { transform: "scale(0.985)", opacity: 1, filter: "blur(0)", offset: 0.55 },
        { transform: "scale(1)", opacity: 1, filter: "blur(0)" },
      ],
      { duration: 520, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
    );
  }, [date, smudged]);

  const face = (
    <>
      <svg className={styles.rings} viewBox="0 0 200 200" aria-hidden="true">
        <defs>
          <path id={`${id}-top`} d="M 26 100 A 74 74 0 0 1 174 100" />
          <path id={`${id}-bottom`} d="M 22 100 A 78 78 0 0 0 178 100" />
        </defs>
        <circle cx="100" cy="100" r="95" fill="none" stroke="currentColor" strokeWidth="3.4" />
        <circle cx="100" cy="100" r="58" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <text className={styles.ringText} textAnchor="middle">
          <textPath href={`#${id}-top`} startOffset="50%">
            {top}
          </textPath>
        </text>
        <text className={styles.ringText} textAnchor="middle" dominantBaseline="hanging">
          <textPath href={`#${id}-bottom`} startOffset="50%">
            {bottom}
          </textPath>
        </text>
        <g fill="currentColor">
          <path d="M 18 100 l 4 -2.6 l 4 2.6 l -4 2.6 z" />
          <path d="M 174 100 l 4 -2.6 l 4 2.6 l -4 2.6 z" />
        </g>
      </svg>
      <span className={styles.center}>
        {date && !smudged ? (
          <RollingDate date={date} className={styles.date} />
        ) : (
          <span className={`${styles.date} ${styles.unknown}`} aria-hidden="true">
            <span className={styles.dateLine}>?? ???</span>
            <span className={styles.yearLine}>19?? · 20??</span>
          </span>
        )}
      </span>
    </>
  );

  const classes = [styles.postmark, smudged && styles.smudged, onClick && styles.interactive, className]
    .filter(Boolean)
    .join(" ");
  const spoken = label ?? (date && !smudged ? `Postmarked ${formatLong(date)}` : "Smudged postmark");

  if (onClick) {
    return (
      <button ref={ref as RefObject<HTMLButtonElement>} type="button" className={classes} onClick={onClick} aria-label={spoken}>
        {face}
      </button>
    );
  }
  return (
    <div ref={ref as RefObject<HTMLDivElement>} className={classes} role="img" aria-label={spoken}>
      {face}
    </div>
  );
}
