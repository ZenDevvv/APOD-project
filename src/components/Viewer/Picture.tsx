import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { ExternalLink, Play, Search } from "lucide-react";
import { displayBox, imageAt, type Apod } from "../../lib/apod";
import type { Fit } from "../../lib/prefs";
import styles from "./Picture.module.css";

interface PictureProps {
  apod: Apod;
  fit: Fit;
  loupe: boolean;
  onSwipe?: (step: 1 | -1) => void;
}

interface Layer {
  id: string;
  src: string;
  alt: string;
  loaded: boolean;
  failed: boolean;
}

const LENS = 260;
const media = (query: string) => typeof window !== "undefined" && window.matchMedia(query).matches;

function withAutoplay(src: string) {
  try {
    const url = new URL(src);
    url.searchParams.set("autoplay", "1");
    if (/youtube/.test(url.hostname)) url.searchParams.set("rel", "0");
    return url.href;
  } catch {
    return src;
  }
}

/** Average colour of a tiny copy of the picture, used as the mat behind "whole picture" mode. */
function useMatte(apod: Apod) {
  const [matte, setMatte] = useState<{ date: string; color: string } | null>(null);
  useEffect(() => {
    if (!apod.image?.resizable) return;
    let live = true;
    const probe = new Image();
    probe.crossOrigin = "anonymous";
    probe.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 12;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(probe, 0, 0, 12, 12);
        const data = ctx.getImageData(0, 0, 12, 12).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let y = 0; y < 12; y++) {
          for (let x = 0; x < 12; x++) {
            if (x > 0 && x < 11 && y > 0 && y < 11) continue; // edges only
            const i = (y * 12 + x) * 4;
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            n++;
          }
        }
        // keep it dark enough to frame the picture rather than compete with it
        const k = Math.min(1, 46 / Math.max(1, (r + g + b) / (3 * n)));
        const c = (v: number) => Math.round((v / n) * k);
        if (live) setMatte({ date: apod.date, color: `rgb(${c(r)} ${c(g)} ${c(b)})` });
      } catch {
        /* tainted canvas: keep the default mat */
      }
    };
    probe.src = imageAt(apod.image, 48);
    return () => {
      live = false;
    };
  }, [apod]);
  return matte?.date === apod.date ? matte.color : undefined;
}

export default function Picture({ apod, fit, loupe, onSwipe }: PictureProps) {
  const box = useMemo(() => displayBox(), []);
  const src = apod.image ? imageAt(apod.image, box) : undefined;
  const isVideo = apod.mediaType === "video" && !!apod.video;
  const matte = useMatte(apod);

  // Cross-fade: the previous plate stays up until the next one has loaded.
  const [layers, setLayers] = useState<Layer[]>([]);
  const top = layers[layers.length - 1];
  if (src && top?.src !== src) {
    setLayers((prev) => [
      ...prev.filter((l) => l.loaded && !l.failed).slice(-1),
      { id: apod.date, src, alt: apod.alt, loaded: false, failed: false },
    ]);
  } else if (!src && layers.length) {
    setLayers([]);
  }

  const [playing, setPlaying] = useState<string | null>(null);
  const isPlaying = isVideo && (playing === apod.date || !apod.image);

  const windowRef = useRef<HTMLDivElement>(null);
  const driftRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const plates = useRef(new Map<string, HTMLImageElement>());
  const [zoom, setZoom] = useState(3);
  const lastPoint = useRef<{ x: number; y: number; touch: boolean } | null>(null);
  const swipe = useRef<{ x: number; y: number; t: number } | null>(null);

  // Full-resolution copy for the loupe, fetched only when the loupe is in hand.
  const hdSrc = apod.image ? (apod.image.resizable ? imageAt(apod.image, 4096) : apod.image.full) : undefined;
  const [hdReady, setHdReady] = useState<string | null>(null);
  useEffect(() => {
    if (!loupe || !hdSrc) return;
    let live = true;
    const img = new Image();
    img.onload = () => live && setHdReady(hdSrc);
    img.src = hdSrc;
    return () => {
      live = false;
    };
  }, [loupe, hdSrc]);
  const lensSrc = hdReady === hdSrc ? hdSrc : src;

  // Parallax drift, kept from the first version of the app: the plate follows the pointer.
  const drift = !loupe && !isPlaying && !media("(prefers-reduced-motion: reduce)") && media("(pointer: fine)");
  useEffect(() => {
    const el = driftRef.current;
    if (!el) return;
    if (!drift) {
      el.style.transform = "";
      return;
    }
    let target = { x: 0, y: 0 };
    let now = { x: 0, y: 0 };
    let frame = 0;
    const tick = () => {
      now = { x: now.x + (target.x - now.x) * 0.075, y: now.y + (target.y - now.y) * 0.075 };
      el.style.transform = `translate3d(${now.x.toFixed(2)}px, ${now.y.toFixed(2)}px, 0) scale(1.06)`;
      frame = Math.abs(target.x - now.x) + Math.abs(target.y - now.y) > 0.05 ? requestAnimationFrame(tick) : 0;
    };
    const onMove = (event: PointerEvent) => {
      target = {
        x: (event.clientX - window.innerWidth / 2) * 0.025,
        y: (event.clientY - window.innerHeight / 2) * 0.025,
      };
      if (!frame) frame = requestAnimationFrame(tick);
    };
    el.style.transform = "scale(1.06)";
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, [drift]);

  const frontPlate = () => {
    const front = [...layers].reverse().find((l) => l.loaded && !l.failed);
    return front ? plates.current.get(front.src) : undefined;
  };

  const placeLens = (clientX: number, clientY: number, touch: boolean, magnification = zoom) => {
    const lens = lensRef.current;
    const img = frontPlate();
    const win = windowRef.current;
    if (!lens || !img || !win || !img.naturalWidth) return;
    lastPoint.current = { x: clientX, y: clientY, touch };
    const rect = img.getBoundingClientRect();
    const fitScale = (fit === "cover" ? Math.max : Math.min)(rect.width / img.naturalWidth, rect.height / img.naturalHeight);
    const w = img.naturalWidth * fitScale;
    const h = img.naturalHeight * fitScale;
    const u = (clientX - (rect.left + (rect.width - w) / 2)) / w;
    const v = (clientY - (rect.top + (rect.height - h) / 2)) / h;
    const outside = u < 0 || u > 1 || v < 0 || v > 1;
    lens.dataset.visible = outside ? "false" : "true";
    if (outside) return;
    const zw = w * magnification;
    const zh = h * magnification;
    const r = LENS / 2;
    const frame = win.getBoundingClientRect();
    const lift = touch ? r + 36 : 0;
    lens.style.transform = `translate3d(${clientX - frame.left - r}px, ${clientY - frame.top - r - lift}px, 0)`;
    lens.style.backgroundSize = `${zw}px ${zh}px`;
    lens.style.backgroundPosition = `${-(u * zw - r)}px ${-(v * zh - r)}px`;
  };

  // Wheel changes magnification; it must be a non-passive listener to stop the page scrolling.
  useEffect(() => {
    const win = windowRef.current;
    if (!win || !loupe) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const next = Math.min(10, Math.max(1.5, zoom * (1 - event.deltaY * 0.0015)));
      setZoom(next);
      const p = lastPoint.current;
      if (p) placeLens(p.x, p.y, p.touch, next);
    };
    win.addEventListener("wheel", onWheel, { passive: false });
    return () => win.removeEventListener("wheel", onWheel);
  });

  const onPointerDown = (event: ReactPointerEvent) => {
    if (loupe) {
      placeLens(event.clientX, event.clientY, event.pointerType !== "mouse");
      return;
    }
    if (event.pointerType !== "mouse") swipe.current = { x: event.clientX, y: event.clientY, t: Date.now() };
  };
  const onPointerMove = (event: ReactPointerEvent) => {
    if (loupe && (event.pointerType === "mouse" || event.buttons)) placeLens(event.clientX, event.clientY, event.pointerType !== "mouse");
  };
  const onPointerUp = (event: ReactPointerEvent) => {
    if (loupe && event.pointerType !== "mouse" && lensRef.current) lensRef.current.dataset.visible = "false";
    const start = swipe.current;
    swipe.current = null;
    if (!start || loupe || !onSwipe) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > 64 && Math.abs(dy) < 60 && Date.now() - start.t < 700) onSwipe(dx < 0 ? 1 : -1);
  };

  const failed = !!top?.failed && !layers.some((l) => l.loaded && !l.failed);

  return (
    <div
      ref={windowRef}
      className={`${styles.window} ${loupe ? styles.loupeMode : ""}`}
      style={{ "--matte": matte } as CSSProperties}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (swipe.current = null)}
      onPointerLeave={() => {
        if (lensRef.current) lensRef.current.dataset.visible = "false";
      }}
    >
      <div ref={driftRef} className={styles.drift}>
        {layers.map((layer) => (
          <img
            key={layer.src}
            ref={(el) => {
              if (el) plates.current.set(layer.src, el);
              else plates.current.delete(layer.src);
            }}
            className={`${styles.plate} ${fit === "contain" ? styles.contain : ""}`}
            data-loaded={layer.loaded && !layer.failed}
            src={layer.src}
            alt={layer.alt}
            decoding="async"
            fetchPriority="high"
            draggable={false}
            onLoad={() => {
              setLayers((prev) => prev.map((l) => (l.src === layer.src ? { ...l, loaded: true } : l)));
            }}
            onError={() => setLayers((prev) => prev.map((l) => (l.src === layer.src ? { ...l, failed: true } : l)))}
            onTransitionEnd={() => {
              if (layer === top && layer.loaded) setLayers((prev) => prev.filter((l) => l === prev[prev.length - 1]));
            }}
          />
        ))}
      </div>

      {top && !top.loaded && !top.failed && (
        <span className={`caps ${styles.developing}`} role="status">
          Inking the plate…
        </span>
      )}

      {failed && apod.image && (
        <div className={styles.notice}>
          <p>The picture for this day didn’t load.</p>
          <a className="caps" href={apod.image.full} target="_blank" rel="noopener noreferrer">
            Open the file directly <ExternalLink size={13} aria-hidden="true" />
          </a>
        </div>
      )}

      {isVideo && !isPlaying && (
        <button type="button" className={styles.play} onClick={() => setPlaying(apod.date)}>
          <span className={styles.playDisc} aria-hidden="true">
            <Play size={26} strokeWidth={2} fill="currentColor" />
          </span>
          <span className="caps">Play this film</span>
        </button>
      )}

      {isPlaying && apod.video && (
        <div className={styles.film}>
          {apod.video.kind === "file" ? (
            <video src={apod.video.src} controls autoPlay playsInline poster={src} />
          ) : (
            <iframe
              src={apod.image ? withAutoplay(apod.video.src) : apod.video.src}
              title={apod.title}
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              allowFullScreen
            />
          )}
        </div>
      )}

      {!apod.image && !apod.video && (
        <div className={styles.notice}>
          <p>
            {apod.mediaType === "other"
              ? "This issue’s media can’t be shown here. It may still open on NASA Science."
              : "NASA’s archive has no picture file for this day. The text survives in the catalogue entry."}
          </p>
          <a className="caps" href={apod.permalink} target="_blank" rel="noopener noreferrer">
            Open it on NASA Science <ExternalLink size={13} aria-hidden="true" />
          </a>
        </div>
      )}

      {loupe && lensSrc && (
        <div
          ref={lensRef}
          className={styles.lens}
          data-visible="false"
          style={{ backgroundImage: `url("${lensSrc}")`, width: LENS, height: LENS }}
          aria-hidden="true"
        >
          <span className={`caps ${styles.lensLabel}`}>
            {hdReady === hdSrc ? (
              <>
                <Search size={11} strokeWidth={2.4} /> {zoom.toFixed(1)}×
              </>
            ) : (
              "Fetching detail…"
            )}
          </span>
        </div>
      )}
    </div>
  );
}
