import { Fragment } from "react";
import type { RichNode } from "../../lib/apod";
import { formatLong } from "../../lib/dates";
import { hrefFor, linkHandler } from "../../lib/router";
import styles from "./Rich.module.css";

/** Render sanitized APOD text. Links to other APOD days open inside the app. */
export default function Rich({ nodes }: { nodes: RichNode[] }) {
  return (
    <>
      {nodes.map((node, i) => {
        if (typeof node === "string") return <Fragment key={i}>{node}</Fragment>;
        switch (node.tag) {
          case "br":
            return <br key={i} />;
          case "em":
            return <em key={i}><Rich nodes={node.children} /></em>;
          case "strong":
            return <strong key={i}><Rich nodes={node.children} /></strong>;
          case "sup":
            return <sup key={i}><Rich nodes={node.children} /></sup>;
          case "sub":
            return <sub key={i}><Rich nodes={node.children} /></sub>;
          case "a":
            if (node.date) {
              const route = { view: "day" as const, date: node.date };
              return (
                <a key={i} className={styles.issue} href={hrefFor(route)} onClick={linkHandler(route)} title={`Open the issue for ${formatLong(node.date)}`}>
                  <Rich nodes={node.children} />
                </a>
              );
            }
            return (
              <a key={i} className={styles.external} href={node.href} target="_blank" rel="noopener noreferrer">
                <Rich nodes={node.children} />
              </a>
            );
        }
      })}
    </>
  );
}
