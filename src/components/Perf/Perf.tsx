import type { CSSProperties, ElementType, ReactNode } from "react";
import styles from "./Perf.module.css";

interface PerfProps {
  children?: ReactNode;
  size?: "small" | "medium" | "large";
  flat?: boolean;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
}

/** A piece of perforated stamp paper. */
export default function Perf({ children, size = "large", flat, as: Tag = "div", className, style }: PerfProps) {
  return (
    <Tag className={[styles.perf, styles[size], flat && styles.flat, className].filter(Boolean).join(" ")} style={style}>
      {children}
    </Tag>
  );
}
