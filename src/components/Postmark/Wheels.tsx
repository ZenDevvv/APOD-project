import type { CSSProperties } from "react";
import { MONTHS_SHORT, parts, type ISODate } from "../../lib/dates";
import styles from "./Postmark.module.css";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const MONTH_CAPS = MONTHS_SHORT.map((m) => m.toUpperCase());

/** One fixed cell of a canceller's date slug; the strip rolls to the new value. */
function Wheel({ items, index, delay = 0, wide }: { items: string[]; index: number; delay?: number; wide?: boolean }) {
  return (
    <span className={`${styles.cell} ${wide ? styles.wide : ""}`} aria-hidden="true">
      <span
        className={styles.strip}
        style={{ "--i": index, transitionDelay: `${delay}ms` } as CSSProperties}
      >
        {items.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </span>
    </span>
  );
}

export function Digits({ value, length, delay = 0 }: { value: number; length: number; delay?: number }) {
  const text = String(value).padStart(length, "0");
  return (
    <>
      {text.split("").map((digit, i) => (
        <Wheel key={i} items={DIGITS} index={Number(digit)} delay={delay + i * 45} />
      ))}
    </>
  );
}

export function Month({ month, delay = 0 }: { month: number; delay?: number }) {
  return <Wheel items={MONTH_CAPS} index={month - 1} delay={delay} wide />;
}

/** "22 OCT / 2026" on rolling wheels, with a plain-text twin for assistive tech. */
export function RollingDate({ date, className }: { date: ISODate; className?: string }) {
  const { y, m, d } = parts(date);
  return (
    <span className={className}>
      <span className={styles.dateLine}>
        <Digits value={d} length={2} />
        <span className={styles.gap} />
        <Month month={m} delay={90} />
      </span>
      <span className={styles.yearLine}>
        <Digits value={y} length={4} delay={150} />
      </span>
    </span>
  );
}
