import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
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
const LENS_PHONE = 190;
const MIN_ZOOM = 1.5;
const DEFAULT_ZOOM = 4;
const MAX_ZOOM = 10;
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
  const lensSize = media("(max-width: 720px)") ? LENS_PHONE : LENS;
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
  const driftPos = useRef({ x: 0, y: 0 });
  const lastPoint = useRef<{ x: number; y: number; touch: boolean } | null>(null);
  const chosenZoom = useRef<number | null>(null);
  const swipe = useRef<{ x: number; y: number; t: number } | null>(null);
  const [power, setPower] = useState<{ value: number; atLimit: boolean } | null>(null);

  // The hint explains the loupe each time it is picked up, until the visitor starts looking around.
  const [explored, setExplored] = useState(false);
  const [loupeSeen, setLoupeSeen] = useState(loupe);
  if (loupe !== loupeSeen) {
    setLoupeSeen(loupe);
    setExplored(false);
  }
  const markExplored = () => {
    if (!explored) setExplored(true);
  };

  // Full-resolution copy for the loupe, fetched only when the loupe is in hand.
  const hdSrc = apod.image ? (apod.image.resizable ? imageAt(apod.image, 4096) : apod.image.full) : undefined;
  const [hd, setHd] = useState<{ src: string; width: number } | null>(null);
  useEffect(() => {
    if (!loupe || !hdSrc) return;
    let live = true;
    const img = new Image();
    img.onload = () => live && setHd({ src: hdSrc, width: img.naturalWidth });
    img.src = hdSrc;
    return () => {
      live = false;
    };
  }, [loupe, hdSrc]);
  const hdLoaded = !!hd && hd.src === hdSrc;
  const lensSrc = hdLoaded ? hdSrc : src;

  // Parallax drift, kept from the first version of the app: the plate follows the pointer.
  // When the loupe is in hand the plate freezes where it is, so nothing jumps.
  const drift = !loupe && !isPlaying && !media("(prefers-reduced-motion: reduce)") && media("(pointer: fine)");
  useEffect(() => {
    const el = driftRef.current;
    if (!el || !drift) return;
    let target = { ...driftPos.current };
    let frame = 0;
    const apply = () => {
      const p = driftPos.current;
      el.style.transform = `translate3d(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px, 0) scale(1.06)`;
    };
    const tick = () => {
      const p = driftPos.current;
      driftPos.current = { x: p.x + (target.x - p.x) * 0.075, y: p.y + (target.y - p.y) * 0.075 };
      apply();
      const q = driftPos.current;
      frame = Math.abs(target.x - q.x) + Math.abs(target.y - q.y) > 0.05 ? requestAnimationFrame(tick) : 0;
    };
    const onMove = (event: PointerEvent) => {
      target = {
        x: (event.clientX - window.innerWidth / 2) * 0.025,
        y: (event.clientY - window.innerHeight / 2) * 0.025,
      };
      if (!frame) frame = requestAnimationFrame(tick);
    };
    apply();
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, [drift]);

  const front = [...layers].reverse().find((l) => l.loaded && !l.failed);

  /**
   * Put the lens over a point of the picture. Magnification is relative to the picture as shown,
   * and never goes past the detail the file actually holds.
   */
  const placeLens = (clientX: number, clientY: number, touch: boolean, requested?: number) => {
    const lens = lensRef.current;
    const img = front ? plates.current.get(front.src) : undefined;
    const win = windowRef.current;
    if (!lens || !img || !win || !img.naturalWidth) return;
    const rect = img.getBoundingClientRect();
    const fitScale = (fit === "cover" ? Math.max : Math.min)(rect.width / img.naturalWidth, rect.height / img.naturalHeight);
    const w = img.naturalWidth * fitScale;
    const h = img.naturalHeight * fitScale;
    const left = rect.left + (rect.width - w) / 2;
    const top = rect.top + (rect.height - h) / 2;
    const frame = win.getBoundingClientRect();
    // keep the point on the visible part of the picture
    const x = Math.min(Math.max(clientX, Math.max(left, frame.left)), Math.min(left + w, frame.right));
    const y = Math.min(Math.max(clientY, Math.max(top, frame.top)), Math.min(top + h, frame.bottom));
    lastPoint.current = { x, y, touch };

    const native = hdLoaded && hd ? hd.width : img.naturalWidth;
    const limit = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, native / w));
    const want = requested ?? chosenZoom.current ?? Math.min(DEFAULT_ZOOM, limit);
    const z = Math.min(Math.max(MIN_ZOOM, want), limit);
    if (requested !== undefined) chosenZoom.current = z;
    const next = { value: Math.round(z * 10) / 10, atLimit: z >= limit - 0.05 };
    if (!power || power.value !== next.value || power.atLimit !== next.atLimit) setPower(next);

    const u = (x - left) / w;
    const v = (y - top) / h;
    const zw = w * z;
    const zh = h * z;
    const r = lensSize / 2;
    const lift = touch ? r + 36 : 0;
    lens.dataset.visible = "true";
    lens.style.transform = `translate3d(${x - frame.left - r}px, ${y - frame.top - r - lift}px, 0)`;
    lens.style.backgroundSize = `${zw}px ${zh}px`;
    lens.style.backgroundPosition = `${-(u * zw - r)}px ${-(v * zh - r)}px`;
  };

  // A new picture or a fresh pick-up starts from the centre at the default power.
  useEffect(() => {
    lastPoint.current = null;
    chosenZoom.current = null;
  }, [apod.date, loupe]);

  // Show the lens the moment the loupe is picked up (centred), and refresh it when the full-detail copy lands.
  const showLens = useEffectEvent(() => {
    const win = windowRef.current;
    if (!win) return;
    const p = lastPoint.current;
    if (p) return placeLens(p.x, p.y, p.touch);
    const r = win.getBoundingClientRect();
    placeLens(r.left + r.width / 2, r.top + r.height / 2, false);
  });
  useEffect(() => {
    if (loupe) showLens();
  }, [loupe, lensSrc, front?.src]);

  // Keyboard: arrows steer the lens (Shift for bigger steps), + and - change power.
  const onLoupeKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if ((event.target as HTMLElement).closest("input, select, textarea")) return;
    const p = lastPoint.current;
    if (!p) return;
    const step = event.shiftKey ? 90 : 30;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (moves[event.key]) {
      event.preventDefault();
      markExplored();
      placeLens(p.x + moves[event.key][0], p.y + moves[event.key][1], false);
    } else if (event.key === "+" || event.key === "=" || event.key === "-" || event.key === "_") {
      event.preventDefault();
      markExplored();
      const current = power?.value ?? DEFAULT_ZOOM;
      placeLens(p.x, p.y, p.touch, event.key === "-" || event.key === "_" ? current / 1.25 : current * 1.25);
    }
  });
  useEffect(() => {
    if (!loupe) return;
    const onKey = (event: KeyboardEvent) => onLoupeKey(event);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loupe]);

  // Wheel changes magnification; it must be a non-passive listener to stop the page scrolling.
  const onLoupeWheel = useEffectEvent((event: WheelEvent) => {
    event.preventDefault();
    markExplored();
    const p = lastPoint.current;
    if (p) placeLens(p.x, p.y, p.touch, (power?.value ?? DEFAULT_ZOOM) * (1 - event.deltaY * 0.0015));
  });
  useEffect(() => {
    const win = windowRef.current;
    if (!win || !loupe) return;
    const onWheel = (event: WheelEvent) => onLoupeWheel(event);
    win.addEventListener("wheel", onWheel, { passive: false });
    return () => win.removeEventListener("wheel", onWheel);
  }, [loupe]);

  const onPointerDown = (event: ReactPointerEvent) => {
    if (loupe) {
      markExplored();
      placeLens(event.clientX, event.clientY, event.pointerType !== "mouse");
      return;
    }
    if (event.pointerType !== "mouse") swipe.current = { x: event.clientX, y: event.clientY, t: Date.now() };
  };
  const onPointerMove = (event: ReactPointerEvent) => {
    if (!loupe || (event.pointerType !== "mouse" && !event.buttons)) return;
    markExplored();
    placeLens(event.clientX, event.clientY, event.pointerType !== "mouse");
  };
  const onPointerUp = (event: ReactPointerEvent) => {
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
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse" && lensRef.current) lensRef.current.dataset.visible = "false";
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
          style={{ backgroundImage: `url("${lensSrc}")`, width: lensSize, height: lensSize }}
          aria-hidden="true"
        >
          <span className={`caps ${styles.lensLabel}`}>
            <Search size={11} strokeWidth={2.4} />
            {!hdLoaded ? (
              "Fetching full detail…"
            ) : (
              <>
                {power ? `${power.value.toFixed(1)}×` : ""}
                <span className={styles.lensNote}>{power?.atLimit ? " · full detail" : " · scroll to zoom"}</span>
              </>
            )}
          </span>
        </div>
      )}

      {loupe && apod.image && (
        <div className={styles.hint} data-explored={explored} role="status">
          <Search size={16} aria-hidden="true" />
          <p>
            <strong>Loupe.</strong>{" "}
            <span className={styles.hintFine}>
              Move over the picture to see it up close. Scroll or press <kbd>+</kbd> <kbd>−</kbd> to zoom, arrow keys
              to steer, <kbd>Esc</kbd> to put it away.
            </span>
            <span className={styles.hintTouch}>Drag across the picture to see it up close.</span>
          </p>
        </div>
      )}
    </div>
  );
}
