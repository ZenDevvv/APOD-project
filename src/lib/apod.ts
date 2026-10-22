import {
  FIRST_ISSUE,
  addDays,
  isISODate,
  latestPossibleDate,
  MONTHS_LONG,
  toYYMMDD,
  type ISODate,
} from "./dates";
import { readJSON, removeKey, writeJSON } from "./storage";

/**
 * NASA moved APOD to science.nasa.gov in September 2026. The legacy
 * api.nasa.gov/planetary/apod endpoint now answers every date with a
 * placeholder, so the archive is read from the WordPress endpoint that
 * replaced it. It needs no key and allows cross-origin reads.
 */
const API = "https://science.nasa.gov/wp-json/wp/v2/apod-basic";
const PAGE_SIZE = 25; // the endpoint caps per_page at 25

// ---- types ------------------------------------------------------------------------

export type RichNode =
  | string
  | { tag: "br" }
  | { tag: "em" | "strong" | "sup" | "sub"; children: RichNode[] }
  | { tag: "a"; href: string; date?: ISODate; children: RichNode[] };

export type MediaType = "image" | "video" | "other";

export interface ApodImage {
  /** Base URL; resizable through NASA's image service when `resizable`. */
  base: string;
  /** The largest file NASA links to. */
  full: string;
  resizable: boolean;
  width?: number;
  height?: number;
}

export interface ApodVideo {
  kind: "youtube" | "vimeo" | "file" | "embed";
  src: string;
}

export interface Apod {
  date: ISODate;
  title: string;
  alt: string;
  mediaType: MediaType;
  explanation: RichNode[];
  /** "Tomorrow's picture" teaser line, when the editors wrote one. */
  teaser?: string;
  credit: RichNode[];
  creditText: string;
  image?: ApodImage;
  video?: ApodVideo;
  permalink: string;
}

interface RawApod {
  date: string;
  title: string;
  media_type: string;
  explanation?: string;
  credit?: string;
  copyright?: string;
  alt?: string;
  url?: string;
  permalink?: string;
  hdurl?: string;
  basic_html?: string;
}

export class ApodError extends Error {
  kind: "network" | "server";
  constructor(kind: "network" | "server", message: string) {
    super(message);
    this.kind = kind;
  }
}

// ---- image URLs ---------------------------------------------------------------------

/** URL for a copy no larger than `box` px on its long side (never upscaled). */
export function imageAt(image: ApodImage, box: number): string {
  if (!image.resizable) return image.base;
  const { width, height } = image;
  if (width && height && Math.max(width, height) <= box) {
    return `${image.base}?w=${width}&h=${height}&fit=clip`;
  }
  return `${image.base}?w=${box}&h=${box}&fit=clip`;
}

/** Long-side pixel budget for a full-viewport picture on this screen. */
export function displayBox() {
  if (typeof window === "undefined") return 2048;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const longest = Math.max(window.innerWidth, window.innerHeight) * dpr;
  return Math.min(3072, Math.max(1024, Math.ceil(longest / 512) * 512));
}

export function thumbOf(apod: Pick<Apod, "image">, box = 480): string | undefined {
  return apod.image ? imageAt(apod.image, box) : undefined;
}

// ---- sanitizing -----------------------------------------------------------------

const MONTH_INDEX = Object.fromEntries(MONTHS_LONG.map((name, i) => [name.toLowerCase(), i + 1]));

/** Recognise links that point at another APOD day, old site or new. */
export function apodDateFromUrl(href: string): ISODate | undefined {
  let match = /apod-(\d{4})-([a-z]+)-(\d{1,2})(?:[-/?#]|$)/i.exec(href);
  if (match) {
    const month = MONTH_INDEX[match[2].toLowerCase()];
    const iso = month ? `${match[1]}-${String(month).padStart(2, "0")}-${match[3].padStart(2, "0")}` : "";
    if (isISODate(iso) && iso >= FIRST_ISSUE) return iso;
  }
  match = /(?:^|\/)ap(\d{2})(\d{2})(\d{2})\.html/i.exec(href);
  if (match) {
    const yy = Number(match[1]);
    const iso = `${yy >= 95 ? 1900 + yy : 2000 + yy}-${match[2]}-${match[3]}`;
    if (isISODate(iso) && iso >= FIRST_ISSUE) return iso;
  }
  return undefined;
}

function safeHref(raw: string | null): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw.trim(), "https://apod.nasa.gov/apod/");
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

const DROP = new Set(["script", "style", "iframe", "img", "video", "audio", "object", "embed", "noscript", "svg", "form", "input", "button"]);

function walk(node: Node): RichNode[] {
  const out: RichNode[] = [];
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = (child.textContent ?? "").replace(/\s+/g, " ");
      if (!text) return;
      const last = out[out.length - 1];
      if (typeof last === "string") out[out.length - 1] = last + text;
      else out.push(text);
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const el = child as Element;
    const tag = el.tagName.toLowerCase();
    if (DROP.has(tag)) return;
    if (tag === "br") {
      out.push({ tag: "br" });
      return;
    }
    const children = walk(el);
    if (!children.some((c) => typeof c !== "string" || c.trim())) return;
    if (tag === "a") {
      const href = safeHref(el.getAttribute("href"));
      if (href) out.push({ tag: "a", href, date: apodDateFromUrl(href), children });
      else out.push(...children);
    } else if (tag === "em" || tag === "i") {
      out.push({ tag: "em", children });
    } else if (tag === "strong" || tag === "b") {
      out.push({ tag: "strong", children });
    } else if (tag === "sup" || tag === "sub") {
      out.push({ tag, children });
    } else {
      out.push(...children);
    }
  });
  return out;
}

function parseHTML(html: string) {
  return new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, "text/html");
}

function trimRich(nodes: RichNode[]): RichNode[] {
  const list = [...nodes];
  const isBlank = (n: RichNode) => (typeof n === "string" ? !n.trim() : n.tag === "br");
  while (list.length && isBlank(list[0])) list.shift();
  while (list.length && isBlank(list[list.length - 1])) list.pop();
  if (typeof list[0] === "string") list[0] = list[0].trimStart();
  const end = list.length - 1;
  if (typeof list[end] === "string") list[end] = (list[end] as string).trimEnd();
  return list;
}

export function richText(nodes: RichNode[]): string {
  return nodes
    .map((n) => (typeof n === "string" ? n : n.tag === "br" ? " " : richText(n.children)))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function splitExplanation(html: string) {
  let body = html.replace(/^\s*<(strong|b)>\s*Explanation:?\s*<\/\1>\s*/i, "");
  let teaser: string | undefined;
  const tomorrow = /(?:\s|<br\s*\/?>|<\/?p>|<\/?center>)*<(strong|b)>\s*Tomorrow(?:'|’|&#8217;|&rsquo;|&#039;)?s picture:?\s*<\/\1>([\s\S]*)$/i.exec(body);
  if (tomorrow) {
    body = body.slice(0, tomorrow.index);
    const text = (parseHTML(tomorrow[2]).body.textContent ?? "").replace(/\s+/g, " ").trim();
    if (text) teaser = text;
  }
  return { body, teaser };
}

function stripCreditLabel(html: string) {
  return html
    // Only a bare "Credit:" / "Image Credit & Copyright:" label goes; anything more specific (a licence) stays.
    .replace(/^\s*(?:<(em|strong|b|i)>\s*)?(?:Image\s+|Video\s+|Illustration\s+)?Credits?(?:\s*(?:&amp;|&|and)\s*(?:<a[^>]*>)?\s*Copyright\s*(?:<\/a>)?)?\s*:\s*(?:<\/\1>)?\s*/i, "")
    .replace(/<(strong|b|em|i)>\s*<\/\1>/gi, "");
}

// ---- normalising ------------------------------------------------------------------

const PLACEHOLDER = /news-thumbnail|nasa-logo/i;
const IMAGE_FILE = /\.(jpe?g|png|gif|webp|tiff?|bmp|avif)(?:[?#]|$)/i;

function stripQuery(url: string) {
  return url.split("?")[0];
}

function https(url: string) {
  return url.startsWith("//") ? `https:${url}` : url;
}

function videoFrom(src: string): ApodVideo {
  const url = https(src);
  if (/youtube(?:-nocookie)?\.com|youtu\.be/i.test(url)) return { kind: "youtube", src: url };
  if (/vimeo\.com/i.test(url)) return { kind: "vimeo", src: url };
  if (/\.(mp4|webm|mov|ogv)(?:[?#]|$)/i.test(url)) return { kind: "file", src: url };
  return { kind: "embed", src: url };
}

function normalize(raw: RawApod): Apod {
  const page = raw.basic_html ? parseHTML(raw.basic_html) : undefined;
  const img = page?.querySelector("img");
  const imgSrc = safeHref(img?.getAttribute("src") ?? null);
  const linked = safeHref(img?.closest("a")?.getAttribute("href") ?? null);
  const iframe = page?.querySelector("iframe")?.getAttribute("src");
  const videoFile =
    page?.querySelector("video source")?.getAttribute("src") ?? page?.querySelector("video")?.getAttribute("src");

  const hd = raw.hdurl && !PLACEHOLDER.test(raw.hdurl) ? raw.hdurl : undefined;

  let image: ApodImage | undefined;
  const base = hd ? stripQuery(hd) : imgSrc && IMAGE_FILE.test(imgSrc) ? imgSrc : undefined;
  if (base) {
    const params = hd ? new URL(hd).searchParams : undefined;
    const width = Number(params?.get("w")) || undefined;
    const height = Number(params?.get("h")) || undefined;
    image = {
      base,
      full: linked && IMAGE_FILE.test(linked) ? stripQuery(linked) : base,
      resizable: base.includes("/dynamicimage/"),
      width,
      height,
    };
  }

  let mediaType: MediaType = raw.media_type === "video" ? "video" : raw.media_type === "image" ? "image" : "other";
  let video: ApodVideo | undefined;
  if (iframe || videoFile) video = videoFrom((videoFile ?? iframe)!);
  if (mediaType === "video" && !video && image) mediaType = "image";
  if (mediaType !== "video" && !image && video) mediaType = "video";

  // Video days without a still: YouTube publishes one for every video.
  const youtubeId = video?.kind === "youtube" ? /\/embed\/([\w-]{6,})/.exec(video.src)?.[1] : undefined;
  if (!image && youtubeId) {
    const poster = `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
    image = { base: poster, full: poster, resizable: false };
  }

  const { body, teaser } = splitExplanation(raw.explanation ?? "");
  const credit = trimRich(walk(parseHTML(stripCreditLabel(raw.credit || raw.copyright || "")).body));

  // A few migrated titles still carry the old page title's "APOD: 2011 May 26 – " prefix.
  const title = (parseHTML(raw.title).body.textContent ?? raw.title)
    .replace(/^\s*APOD:\s*\d{4}\s+[A-Za-z]+\s+\d{1,2}\s*[-–—]\s*/, "")
    .trim();
  const rawAlt = (raw.alt ?? "").trim();
  const alt = rawAlt && !/^see explanation/i.test(rawAlt) ? rawAlt : title;

  return {
    date: raw.date,
    title,
    alt,
    mediaType,
    explanation: trimRich(walk(parseHTML(body).body)),
    teaser,
    credit,
    creditText: richText(credit),
    image,
    video,
    permalink: raw.permalink || raw.url || "https://science.nasa.gov/apod/",
  };
}

// ---- cache ----------------------------------------------------------------------

const DAY_PREFIX = "skypost:v3:day:";
const DAY_INDEX = "skypost:v3:days";
const MAX_STORED_DAYS = 160;
const MISSING_TTL = 6 * 3600_000;

interface StoredDay {
  v: Apod | null;
  t: number;
}

const memory = new Map<ISODate, Apod | null>();
const inflight = new Map<ISODate, Promise<Apod | null>>();

function remember(date: ISODate, value: Apod | null) {
  memory.set(date, value);
  const index = readJSON<ISODate[]>(DAY_INDEX, []).filter((d) => d !== date);
  index.push(date);
  while (index.length > MAX_STORED_DAYS) removeKey(DAY_PREFIX + index.shift());
  writeJSON(DAY_PREFIX + date, { v: value, t: Date.now() } satisfies StoredDay);
  writeJSON(DAY_INDEX, index);
}

function recall(date: ISODate): Apod | null | undefined {
  if (memory.has(date)) return memory.get(date);
  const stored = readJSON<StoredDay | null>(DAY_PREFIX + date, null);
  if (!stored) return undefined;
  if (stored.v === null && Date.now() - stored.t > MISSING_TTL) return undefined;
  memory.set(date, stored.v);
  return stored.v;
}

/** Synchronous peek at a day already fetched this session or stored earlier. */
export function peekDay(date: ISODate): Apod | null | undefined {
  return recall(date);
}

async function request(url: string, signal?: AbortSignal) {
  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApodError("network", "Couldn't reach NASA's archive.");
  }
  if (res.status === 404) return { res, data: null };
  if (!res.ok) throw new ApodError("server", `NASA's archive answered ${res.status}.`);
  return { res, data: (await res.json()) as unknown };
}

/** One day's issue, or null when no picture was published that day. */
export function getDay(date: ISODate): Promise<Apod | null> {
  if (date < FIRST_ISSUE || date > latestPossibleDate()) return Promise.resolve(null);
  const known = recall(date);
  if (known !== undefined) return Promise.resolve(known);
  const pending = inflight.get(date);
  if (pending) return pending;
  const job = request(`${API}/${toYYMMDD(date)}`)
    .then(({ data }) => {
      const apod = data ? normalize(data as RawApod) : null;
      remember(date, apod);
      return apod;
    })
    .finally(() => inflight.delete(date));
  inflight.set(date, job);
  return job;
}

const LATEST_KEY = "skypost:v3:latest";
const LATEST_TTL = 10 * 60_000;
let latestJob: Promise<Apod> | null = null;
let latestAt = 0;

/** The most recently published issue. */
export function getLatest(): Promise<Apod> {
  if (latestJob && Date.now() - latestAt < LATEST_TTL) return latestJob;
  const stored = readJSON<{ date: ISODate; t: number } | null>(LATEST_KEY, null);
  if (stored && Date.now() - stored.t < LATEST_TTL) {
    const cached = recall(stored.date);
    if (cached) {
      latestAt = stored.t;
      latestJob = Promise.resolve(cached);
      return latestJob;
    }
  }
  latestAt = Date.now();
  latestJob = request(`${API}?per_page=1`).then(({ data }) => {
    const first = Array.isArray(data) ? (data[0] as RawApod | undefined) : undefined;
    if (!first) throw new ApodError("server", "NASA's archive returned no issues.");
    const apod = normalize(first);
    remember(apod.date, apod);
    writeJSON(LATEST_KEY, { date: apod.date, t: Date.now() });
    return apod;
  });
  latestJob.catch(() => {
    latestJob = null;
  });
  return latestJob;
}

/** Every issue between two dates (inclusive), keyed by date. Days with no issue map to null. */
export async function getRange(from: ISODate, to: ISODate, signal?: AbortSignal): Promise<Map<ISODate, Apod | null>> {
  const latest = latestPossibleDate();
  const end = to > latest ? latest : to;
  const start = from < FIRST_ISSUE ? FIRST_ISSUE : from;
  const result = new Map<ISODate, Apod | null>();
  if (start > end) return result;

  const dates: ISODate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) dates.push(d);

  const missing = dates.filter((d) => recall(d) === undefined);
  if (missing.length) {
    const lo = missing[0];
    const hi = missing[missing.length - 1];
    const url = (page: number) =>
      `${API}?date_from=${toYYMMDD(lo)}&date_to=${toYYMMDD(hi)}&per_page=${PAGE_SIZE}&page=${page}`;
    const first = await request(url(1), signal);
    const pages = Number(first.res.headers.get("X-WP-TotalPages")) || 1;
    const rest = await Promise.all(
      Array.from({ length: Math.max(0, pages - 1) }, (_, i) => request(url(i + 2), signal)),
    );
    const found = new Set<ISODate>();
    for (const { data } of [first, ...rest]) {
      if (!Array.isArray(data)) continue;
      for (const raw of data as RawApod[]) {
        const apod = normalize(raw);
        found.add(apod.date);
        remember(apod.date, apod);
      }
    }
    // Only call a day "not issued" once it is safely in the past.
    for (const d of missing) if (!found.has(d) && d < latest) remember(d, null);
  }

  for (const d of dates) {
    const value = recall(d);
    if (value !== undefined) result.set(d, value);
  }
  return result;
}

/** Walk from a date in one direction until a published issue turns up. */
export async function findIssue(from: ISODate, step: 1 | -1, limit = 10): Promise<Apod | null> {
  const latest = latestPossibleDate();
  let date = from;
  for (let i = 0; i < limit; i++) {
    if (date < FIRST_ISSUE || date > latest) return null;
    const apod = await getDay(date);
    if (apod) return apod;
    date = addDays(date, step);
  }
  return null;
}

/** Run async jobs with a small concurrency cap, so the archive is asked politely. */
export async function mapLimit<T, R>(items: T[], limit: number, job: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await job(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}
