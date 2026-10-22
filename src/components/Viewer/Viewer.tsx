import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  BookOpen,
  Cake,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  Expand,
  ExternalLink,
  Frame,
  Search,
  Share2,
  Shrink,
  Shuffle,
  Stamp as StampIcon,
  X,
} from "lucide-react";
import Perf from "../Perf/Perf";
import Postmark from "../Postmark/Postmark";
import { Digits } from "../Postmark/Wheels";
import Picture from "./Picture";
import Catalogue from "../Catalogue/Catalogue";
import DateSetter from "../DateSetter/DateSetter";
import { toast } from "../Toast/toast";
import { displayBox, findIssue, getDay, imageAt, thumbOf, type Apod } from "../../lib/apod";
import {
  FIRST_ISSUE,
  addDays,
  MONTHS_SHORT,
  formatDayMonth,
  formatLong,
  formatShort,
  latestPossibleDate,
  randomDate,
  secondsToNextIssue,
  type ISODate,
} from "../../lib/dates";
import { album, setBirthday, setFit, useAlbum, useBirthday, useFit } from "../../lib/prefs";
import { hrefFor, linkHandler, navigate } from "../../lib/router";
import { useIssue } from "../../lib/useIssue";
import { useLatestDate } from "../../lib/useLatest";
import styles from "./Viewer.module.css";

type Panel = null | "catalogue" | "date" | "birthday" | "more";

// ---- small shared hooks ---------------------------------------------------------------

function useCountdown(active: boolean) {
  const [seconds, setSeconds] = useState(() => secondsToNextIssue());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setSeconds(secondsToNextIssue()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
}

const subscribeFullscreen = (cb: () => void) => {
  document.addEventListener("fullscreenchange", cb);
  return () => document.removeEventListener("fullscreenchange", cb);
};
const useFullscreen = () =>
  useSyncExternalStore(subscribeFullscreen, () => !!document.fullscreenElement, () => false);

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
  else document.documentElement.requestFullscreen?.().catch(() => toast("Fullscreen isn’t available in this browser."));
}

function preload(apod: Apod | null) {
  if (!apod?.image) return;
  const img = new Image();
  img.decoding = "async";
  img.src = imageAt(apod.image, displayBox());
}

// ---- viewer -------------------------------------------------------------------------

export default function Viewer({ date, birthday: birthdayRoute }: { date?: ISODate; birthday?: boolean }) {
  const issue = useIssue(date);
  const latest = useLatestDate();
  const fit = useFit();
  const stamps = useAlbum();
  const birthday = useBirthday();
  const fullscreen = useFullscreen();

  // Keep the previous stamp on the leaf while the next one is fetched.
  const [shown, setShown] = useState<Apod | null>(null);
  if (issue.status === "ready" && issue.apod !== shown) setShown(issue.apod);
  const apod = issue.status === "ready" ? issue.apod : shown;
  const pending = issue.status === "loading" && !!shown;

  const [panel, setPanel] = useState<Panel>(null);
  const [loupe, setLoupe] = useState(false);
  const [busy, setBusy] = useState<null | "prev" | "next" | "random">(null);

  const current = apod?.date ?? date;
  const latestKnown = latest ?? latestPossibleDate();
  const isLatest = !!apod && apod.date === latest;
  const countdown = useCountdown(isLatest);
  const saved = !!apod && stamps.some((s) => s.date === apod.date);
  const isBirthday = !!birthdayRoute && !!apod;

  // Warm the neighbouring days so travelling feels instant.
  useEffect(() => {
    if (issue.status !== "ready") return;
    const d = issue.apod.date;
    const t = window.setTimeout(() => {
      getDay(addDays(d, -1)).then(preload, () => undefined);
      if (d < latestPossibleDate()) getDay(addDays(d, 1)).then(preload, () => undefined);
    }, 600);
    return () => window.clearTimeout(t);
  }, [issue.status, issue.apod]);

  const travel = useCallback(
    async (step: 1 | -1) => {
      if (!current || busy) return;
      if (step === 1 && current >= latestKnown) return;
      if (step === -1 && current <= FIRST_ISSUE) return;
      setBusy(step === 1 ? "next" : "prev");
      try {
        const found = await findIssue(addDays(current, step), step);
        if (found) navigate({ view: "day", date: found.date === latest ? undefined : found.date });
        else toast(step === 1 ? "That’s the newest issue." : "That’s the very first issue.");
      } catch {
        toast("Couldn’t reach NASA’s archive. Try again in a moment.");
      } finally {
        setBusy(null);
      }
    },
    [current, busy, latestKnown, latest],
  );

  const random = useCallback(async () => {
    if (busy) return;
    setBusy("random");
    setPanel(null);
    try {
      const found = await findIssue(randomDate(FIRST_ISSUE, latestKnown), 1);
      if (found) navigate({ view: "day", date: found.date });
    } catch {
      toast("Couldn’t reach NASA’s archive. Try again in a moment.");
    } finally {
      setBusy(null);
    }
  }, [busy, latestKnown]);

  const toggleAlbum = useCallback(() => {
    if (!apod) return;
    if (album.has(apod.date)) {
      const stamp = stamps.find((s) => s.date === apod.date);
      album.remove(apod.date);
      toast("Taken out of your album.", stamp ? { label: "Undo", run: () => album.restore(stamp) } : undefined);
    } else {
      album.add({ date: apod.date, title: apod.title, thumb: thumbOf(apod), mediaType: apod.mediaType });
      toast("Hinged into your album.", { label: "Open album", run: () => navigate({ view: "album" }) });
    }
  }, [apod, stamps]);

  const share = useCallback(async () => {
    if (!apod) return;
    const url = new URL(hrefFor({ view: "day", date: apod.date }), window.location.origin).href;
    const data = { title: `${apod.title} · ${formatShort(apod.date)}`, url };
    if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share(data);
        return;
      } catch {
        /* dismissed; fall through to copying */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast("Link to this day copied.");
    } catch {
      toast(url);
    }
  }, [apod]);

  const closePanel = useCallback(() => setPanel(null), []);

  const submitDate = (picked: ISODate, rememberBirthday: boolean) => {
    if (rememberBirthday) setBirthday(picked);
    setPanel(null);
    navigate({ view: "day", date: picked, birthday: rememberBirthday });
  };

  // Keyboard: arrows travel, letters open tools.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (target.closest("input, select, textarea, [contenteditable='true']")) return;
      if (panel === "date" || panel === "birthday") return;
      const key = event.key;
      const act: Record<string, () => void> = {
        ArrowLeft: () => travel(-1),
        ArrowRight: () => travel(1),
        j: () => travel(-1),
        k: () => travel(1),
        t: () => navigate({ view: "day" }),
        r: () => random(),
        d: () => setPanel("date"),
        b: () => setPanel("birthday"),
        i: () => setPanel((p) => (p === "catalogue" ? null : "catalogue")),
        l: () => apod?.image && apod.mediaType !== "video" && setLoupe((v) => !v),
        w: () => setFit(fit === "cover" ? "contain" : "cover"),
        s: () => toggleAlbum(),
        f: () => toggleFullscreen(),
        Escape: () => {
          if (panel) setPanel(null);
          else if (loupe) setLoupe(false);
        },
      };
      const run = act[key] ?? act[key.toLowerCase()];
      if (run) {
        event.preventDefault();
        run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [travel, random, toggleAlbum, panel, loupe, fit, apod]);

  // ---- states without a stamp ---------------------------------------------------------

  const stageNotice = (() => {
    if (issue.status === "missing") {
      return (
        <div className={styles.notice}>
          {date && <Postmark date={date} className={styles.noticeMark} top="NOT ISSUED" />}
          <h1 className={styles.noticeTitle}>No picture was issued on {date ? formatLong(date) : "this day"}.</h1>
          <p>APOD skipped a few days in its first years, and a day that hasn’t happened yet has no picture.</p>
          <div className={styles.noticeActions}>
            <button type="button" className="caps" onClick={() => travel(-1)}>
              <ChevronLeft size={15} aria-hidden="true" /> Earlier issue
            </button>
            <button type="button" className="caps" onClick={() => navigate({ view: "day" })}>
              Today’s issue
            </button>
          </div>
        </div>
      );
    }
    if (issue.status === "error" && !shown) {
      return (
        <div className={styles.notice}>
          <Postmark date={null} smudged className={styles.noticeMark} top="RETURN TO SENDER" />
          <h1 className={styles.noticeTitle}>Couldn’t reach NASA’s archive.</h1>
          <p>
            {issue.error.kind === "network"
              ? "Check your connection, then try again."
              : "The archive is having trouble right now. It usually recovers within a few minutes."}
          </p>
          <div className={styles.noticeActions}>
            <button type="button" className="caps" onClick={issue.retry}>
              Try again
            </button>
          </div>
        </div>
      );
    }
    return null;
  })();

  const canPrev = !!current && current > FIRST_ISSUE;
  const canNext = !!current && current < latestKnown;
  const prevLabel = current ? formatShort(addDays(current, -1)) : "";
  const nextLabel = current ? formatShort(addDays(current, 1)) : "";

  const tools = apod && (
    <>
      <button type="button" className={styles.tool} aria-pressed={panel === "catalogue"} onClick={() => setPanel(panel === "catalogue" ? null : "catalogue")} title="Catalogue entry (I)">
        <BookOpen size={16} aria-hidden="true" />
        <span>Catalogue</span>
      </button>
      <button type="button" className={styles.tool} aria-pressed={loupe} onClick={() => setLoupe(!loupe)} disabled={!apod.image || apod.mediaType === "video"} title="Loupe (L)">
        <Search size={16} aria-hidden="true" />
        <span>Loupe</span>
      </button>
      <button type="button" className={styles.tool} aria-pressed={fit === "contain"} onClick={() => setFit(fit === "cover" ? "contain" : "cover")} disabled={!apod.image} title="Whole picture (W)">
        <Frame size={16} aria-hidden="true" />
        <span>Whole picture</span>
      </button>
      <button type="button" className={`${styles.tool} ${saved ? styles.saved : ""}`} aria-pressed={saved} onClick={toggleAlbum} title="Album (S)">
        <StampIcon size={16} aria-hidden="true" />
        <span>{saved ? "In album" : "Album"}</span>
      </button>
      <button type="button" className={styles.tool} onClick={share} title="Share">
        <Share2 size={16} aria-hidden="true" />
        <span>Share</span>
      </button>
      {apod.image && apod.mediaType !== "video" && (
        <a className={styles.tool} href={apod.image.full} target="_blank" rel="noopener noreferrer" title="Open the full-resolution file">
          <ExternalLink size={16} aria-hidden="true" />
          <span>Full resolution</span>
        </a>
      )}
      <button type="button" className={styles.tool} aria-pressed={fullscreen} onClick={toggleFullscreen} title="Fullscreen (F)">
        {fullscreen ? <Shrink size={16} aria-hidden="true" /> : <Expand size={16} aria-hidden="true" />}
        <span>{fullscreen ? "Exit fullscreen" : "Fullscreen"}</span>
      </button>
    </>
  );

  const travelTools = (
    <>
      <button type="button" className={styles.tool} aria-pressed={panel === "date"} onClick={() => setPanel(panel === "date" ? null : "date")} title="Set the date (D)">
        <CalendarDays size={16} aria-hidden="true" />
        <span>Set date</span>
      </button>
      <button type="button" className={styles.tool} onClick={random} aria-busy={busy === "random"} title="Random day (R)">
        <Shuffle size={16} aria-hidden="true" />
        <span>{busy === "random" ? "Drawing…" : "Random day"}</span>
      </button>
      <button type="button" className={styles.tool} aria-pressed={panel === "birthday"} onClick={() => setPanel(panel === "birthday" ? null : "birthday")} title="Your birthday (B)">
        <Cake size={16} aria-hidden="true" />
        <span>Birthday</span>
      </button>
    </>
  );

  return (
    <main className={`${styles.viewer} ${panel === "catalogue" ? styles.withCatalogue : ""}`}>
      <div className={styles.stage}>
        <button type="button" className={`${styles.gutter} ${styles.prev}`} onClick={() => travel(-1)} disabled={!canPrev} aria-label={`Previous day, ${prevLabel}`} title="Previous day (←)">
          <ChevronLeft size={22} aria-hidden="true" className={busy === "prev" ? styles.working : ""} />
          <span className="caps">{prevLabel || "Previous"}</span>
        </button>

        <div className={styles.stampSlot}>
          {stageNotice ?? (
            <Perf className={`${styles.stamp} ${pending ? styles.pending : ""}`}>
              {apod ? (
                <Picture apod={apod} fit={fit} loupe={loupe} onSwipe={travel} />
              ) : (
                <div className={styles.blank}>
                  <span className="caps">{date ? `Fetching ${formatShort(date)}…` : "Fetching today’s issue…"}</span>
                </div>
              )}

              <div className={styles.band}>
                <div className={styles.words}>
                  <h1 className={styles.title}>{apod?.title ?? " "}</h1>
                  <p className={styles.inscription}>
                    <span className="caps">
                      {isBirthday ? "Astronomy picture of your birthday" : "Astronomy Picture of the Day"}
                    </span>
                    {apod?.creditText && (
                      <span className={styles.credit}>
                        {!/^\W*(image |video |illustration )?credit/i.test(apod.creditText) && <span className={styles.creditLabel}>Credit </span>}
                        {apod.creditText}
                      </span>
                    )}
                  </p>
                  {isBirthday && apod && (
                    <p className={styles.birthdayRow}>
                      <a className="caps" href={hrefFor({ view: "day" })} onClick={linkHandler({ view: "day" })}>
                        Go back to today’s picture
                      </a>
                      <a className="caps" href={hrefFor({ view: "birthday", on: apod.date.slice(5) })} onClick={linkHandler({ view: "birthday", on: apod.date.slice(5) })}>
                        {formatDayMonth(apod.date)} in every year
                      </a>
                    </p>
                  )}
                </div>
                {apod && (
                  <p className={styles.denomination} aria-hidden="true">
                    <span className="num">
                      <Digits value={Number(apod.date.slice(8))} length={2} />
                    </span>
                    <span className="caps">{MONTHS_SHORT[Number(apod.date.slice(5, 7)) - 1]}</span>
                  </p>
                )}
                {(apod || date) && (
                  <svg className={styles.bars} viewBox="0 0 280 56" preserveAspectRatio="none" aria-hidden="true">
                    {[8, 20, 32, 44].map((y) => (
                      <path key={y} d={`M0 ${y} C 23 ${y - 6}, 47 ${y - 6}, 70 ${y} S 117 ${y + 6}, 140 ${y} S 187 ${y - 6}, 210 ${y} S 257 ${y + 6}, 280 ${y}`} />
                    ))}
                  </svg>
                )}
                {(apod || date) && (
                  <Postmark
                    className={styles.postmark}
                    date={apod?.date ?? date ?? null}
                    top={isLatest ? "TODAY’S ISSUE" : "SKYPOST ARCHIVE"}
                    onClick={() => setPanel(panel === "date" ? null : "date")}
                    label={`Postmarked ${formatLong((apod?.date ?? date)!)}. Choose another date`}
                  />
                )}
              </div>
            </Perf>
          )}

          {(panel === "date" || panel === "birthday") && current && (
            <div className={styles.popover}>
              <DateSetter
                key={panel}
                mode={panel}
                initial={current}
                latest={latestKnown}
                birthday={birthday}
                onSubmit={submitDate}
                onRandom={random}
                onClose={closePanel}
              />
            </div>
          )}
        </div>

        <button type="button" className={`${styles.gutter} ${styles.next}`} onClick={() => travel(1)} disabled={!canNext} aria-label={canNext ? `Next day, ${nextLabel}` : "Next day (this is the newest issue)"} title="Next day (→)">
          <ChevronRight size={22} aria-hidden="true" className={busy === "next" ? styles.working : ""} />
          <span className="caps">{canNext ? nextLabel : isLatest ? `Next due in ${countdown}` : "Next"}</span>
        </button>

        {panel === "catalogue" && apod && (
          <div className={styles.catalogue}>
            <Catalogue apod={apod} latest={latest} countdown={countdown} onClose={closePanel} onBirthday={() => setPanel("birthday")} />
          </div>
        )}
      </div>

      <nav className={styles.toolbar} aria-label="Viewer tools">
        <div className={styles.group}>{travelTools}</div>
        <div className={styles.group}>{tools}</div>
      </nav>

      {/* phones: travel and the most used tools in one row, the rest behind More */}
      <nav className={styles.dock} aria-label="Viewer tools">
        <button type="button" className={styles.dockTool} onClick={() => travel(-1)} disabled={!canPrev}>
          <ChevronLeft size={20} aria-hidden="true" />
          <span>Earlier</span>
        </button>
        <button type="button" className={styles.dockTool} aria-pressed={panel === "date"} onClick={() => setPanel(panel === "date" ? null : "date")}>
          <CalendarDays size={20} aria-hidden="true" />
          <span>Date</span>
        </button>
        <button type="button" className={styles.dockTool} aria-pressed={panel === "catalogue"} onClick={() => setPanel(panel === "catalogue" ? null : "catalogue")} disabled={!apod}>
          <BookOpen size={20} aria-hidden="true" />
          <span>Catalogue</span>
        </button>
        <button type="button" className={`${styles.dockTool} ${saved ? styles.saved : ""}`} aria-pressed={saved} onClick={toggleAlbum} disabled={!apod}>
          <StampIcon size={20} aria-hidden="true" />
          <span>{saved ? "Saved" : "Album"}</span>
        </button>
        <button type="button" className={styles.dockTool} aria-pressed={panel === "more"} onClick={() => setPanel(panel === "more" ? null : "more")}>
          <Ellipsis size={20} aria-hidden="true" />
          <span>More</span>
        </button>
        <button type="button" className={styles.dockTool} onClick={() => travel(1)} disabled={!canNext}>
          <ChevronRight size={20} aria-hidden="true" />
          <span>Later</span>
        </button>
      </nav>

      {panel === "more" && (
        <div className={styles.moreSheet} role="dialog" aria-label="More tools">
          <div className={styles.moreHead}>
            <span className="caps">More tools</span>
            <button type="button" className={styles.moreClose} onClick={closePanel} aria-label="Close">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <div className={styles.moreGrid} onClick={(e) => (e.target as HTMLElement).closest("button, a") && !(e.target as HTMLElement).closest("[aria-pressed]") && setPanel(null)}>
            {travelTools}
            {tools}
          </div>
        </div>
      )}
    </main>
  );
}
