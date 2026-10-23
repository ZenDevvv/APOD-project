import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ChevronDown, ChevronUp, Shuffle, X } from "lucide-react";
import {
  FIRST_ISSUE,
  MONTHS_LONG,
  clampDate,
  daysInMonth,
  formatLong,
  fromParts,
  parts,
  type ISODate,
} from "../../lib/dates";
import styles from "./DateSetter.module.css";

interface DateSetterProps {
  mode: "date" | "birthday";
  initial: ISODate;
  latest: ISODate;
  birthday: ISODate | null;
  onSubmit: (date: ISODate, rememberBirthday: boolean) => void;
  onRandom?: () => void;
  onClose: () => void;
  /** Earliest pickable date; APOD's first issue by default. */
  min?: ISODate;
  title?: string;
  lede?: string;
  submitLabel?: string;
}

function Wheel({
  label,
  value,
  options,
  onChange,
  wide,
}: {
  label: string;
  value: number;
  options: { value: number; label: string; disabled?: boolean }[];
  onChange: (value: number) => void;
  wide?: boolean;
}) {
  const id = useId();
  const index = options.findIndex((o) => o.value === value);
  const step = (dir: 1 | -1) => {
    for (let i = index + dir; i >= 0 && i < options.length; i += dir) {
      if (!options[i].disabled) return onChange(options[i].value);
    }
  };
  const canStep = (dir: 1 | -1) => options.some((o, i) => (dir > 0 ? i > index : i < index) && !o.disabled);
  return (
    <div className={`${styles.wheel} ${wide ? styles.wideWheel : ""}`}>
      <label className={`caps ${styles.wheelLabel}`} htmlFor={id}>
        {label}
      </label>
      <button type="button" className={styles.step} onClick={() => step(-1)} disabled={!canStep(-1)} aria-label={`Earlier ${label.toLowerCase()}`}>
        <ChevronUp size={16} strokeWidth={2.4} aria-hidden="true" />
      </button>
      <select id={id} className={`${styles.slug} num`} value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <button type="button" className={styles.step} onClick={() => step(1)} disabled={!canStep(1)} aria-label={`Later ${label.toLowerCase()}`}>
        <ChevronDown size={16} strokeWidth={2.4} aria-hidden="true" />
      </button>
    </div>
  );
}

/** The canceller: three date slugs you set before striking a new postmark. */
export default function DateSetter({
  mode,
  initial,
  latest,
  birthday,
  onSubmit,
  onRandom,
  onClose,
  min: minDate = FIRST_ISSUE,
  title,
  lede,
  submitLabel,
}: DateSetterProps) {
  const start = mode === "birthday" && birthday ? clampDate(birthday, minDate, latest) : clampDate(initial, minDate, latest);
  const [date, setDate] = useState(start);
  const [remember, setRemember] = useState(mode === "birthday");
  const panelRef = useRef<HTMLFormElement>(null);
  const headingId = useId();

  const { y, m, d } = parts(date);
  const min = parts(minDate);
  const max = parts(latest);

  const set = (ny: number, nm: number, nd: number) => {
    const day = Math.min(nd, daysInMonth(ny, nm));
    setDate(clampDate(fromParts(ny, nm, day), minDate, latest));
  };

  useEffect(() => {
    panelRef.current?.querySelector("select")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const years = Array.from({ length: max.y - min.y + 1 }, (_, i) => ({ value: min.y + i, label: String(min.y + i) }));
  const months = MONTHS_LONG.map((name, i) => ({
    value: i + 1,
    label: name.slice(0, 3).toUpperCase(),
    disabled: (y === min.y && i + 1 < min.m) || (y === max.y && i + 1 > max.m),
  }));
  const days = Array.from({ length: daysInMonth(y, m) }, (_, i) => ({
    value: i + 1,
    label: String(i + 1).padStart(2, "0"),
    disabled: fromParts(y, m, i + 1) < minDate || fromParts(y, m, i + 1) > latest,
  }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(date, remember);
  };

  const isBirthday = mode === "birthday";

  return (
    <form ref={panelRef} className={styles.panel} onSubmit={submit} role="dialog" aria-labelledby={headingId}>
      <div className={styles.head}>
        <h2 id={headingId} className={styles.title}>
          {title ?? (isBirthday ? "The picture from your birthday" : "Re-set the postmark")}
        </h2>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <p className={styles.lede}>
        {lede ??
          (isBirthday
            ? "Pick your birthday and see the astronomy picture published that day. Born before June 1995? Pick any birthday since."
            : `Any day from 16 June 1995 to ${formatLong(latest).replace(/^\w+, /, "")}.`)}
      </p>

      <div className={styles.slugs}>
        <Wheel label="Day" value={d} options={days} onChange={(v) => set(y, m, v)} />
        <Wheel label="Month" value={m} options={months} onChange={(v) => set(y, v, d)} wide />
        <Wheel label="Year" value={y} options={years} onChange={(v) => set(v, m, d)} wide />
      </div>

      <p className={`${styles.readout}`} aria-live="polite">
        {formatLong(date)}
      </p>

      <label className={styles.remember}>
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        <span>This is my birthday</span>
      </label>

      <div className={styles.actions}>
        <button type="submit" className={`caps ${styles.primary}`}>
          {submitLabel ?? (isBirthday ? "Show my birthday picture" : "Postmark this date")}
        </button>
        {onRandom && (
          <button type="button" className={`caps ${styles.secondary}`} onClick={onRandom}>
            <Shuffle size={14} aria-hidden="true" /> Random day
          </button>
        )}
      </div>
    </form>
  );
}
