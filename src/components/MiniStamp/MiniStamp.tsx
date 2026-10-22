import { useState, type ReactNode } from "react";
import { Clapperboard } from "lucide-react";
import Perf from "../Perf/Perf";
import type { MediaType } from "../../lib/apod";
import styles from "./MiniStamp.module.css";

interface MiniStampProps {
  thumb?: string;
  alt?: string;
  mediaType?: MediaType;
  value: ReactNode;
  caption?: ReactNode;
  state?: "ready" | "loading" | "missing" | "pending";
  size?: "small" | "medium";
}

/** A thumbnail stamp: picture window, value numeral and a caption line. */
export default function MiniStamp({ thumb, alt = "", mediaType, value, caption, state = "ready", size = "small" }: MiniStampProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = state === "ready" && thumb && failed !== thumb;

  return (
    <Perf size={size} className={`${styles.stamp} ${styles[state]} ${size === "medium" ? styles.stacked : ""}`}>
      <span className={styles.window}>
        {showImage && (
          <img src={thumb} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(thumb)} />
        )}
        {state === "ready" && !showImage && (
          <span className={`caps ${styles.note}`}>{mediaType === "video" ? "Film" : "No plate"}</span>
        )}
        {state === "missing" && <span className={`caps ${styles.note}`}>Not issued</span>}
        {mediaType === "video" && state === "ready" && (
          <span className={styles.film} title="Film">
            <Clapperboard size={12} strokeWidth={2.2} aria-hidden="true" />
            <span className="visually-hidden">Film</span>
          </span>
        )}
      </span>
      <span className={styles.band}>
        <span className={`${styles.value} num`}>{value}</span>
        {caption && <span className={styles.caption}>{caption}</span>}
      </span>
    </Perf>
  );
}
