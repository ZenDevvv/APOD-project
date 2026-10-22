import { useEffect, useRef } from "react";
import styles from "./Keys.module.css";

const KEYS: [string, string][] = [
  ["← →", "Previous / next day"],
  ["T", "Today’s issue"],
  ["D", "Set the date"],
  ["B", "Your birthday"],
  ["R", "Random day"],
  ["I", "Catalogue entry"],
  ["L", "Loupe: see the picture up close"],
  ["+ − ↑↓←→", "Zoom and steer the loupe"],
  ["W", "Whole picture"],
  ["S", "Add to album"],
  ["F", "Fullscreen"],
  ["Esc", "Close"],
];

export default function Keys({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: PointerEvent) => {
      const el = e.target as HTMLElement;
      if (!ref.current?.contains(el) && !el.closest("[aria-expanded]")) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [onClose]);

  return (
    <div ref={ref} className={styles.card} role="dialog" aria-label="Keyboard shortcuts">
      <dl>
        {KEYS.map(([key, label]) => (
          <div key={key} className={styles.row}>
            <dt>
              <kbd>{key}</kbd>
            </dt>
            <dd>{label}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
