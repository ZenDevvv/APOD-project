import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Copy, Eye, RotateCcw } from "lucide-react";
import Perf from "../Perf/Perf";
import Postmark from "../Postmark/Postmark";
import MiniStamp from "../MiniStamp/MiniStamp";
import { Digits } from "../Postmark/Wheels";
import { toast } from "../Toast/toast";
import { displayBox, getDay, getLatest, imageAt, thumbOf, type Apod } from "../../lib/apod";
import { FIRST_ISSUE, formatLong, latestPossibleDate, parts, randomDate, type ISODate } from "../../lib/dates";
import { recordScore, useBestScore } from "../../lib/prefs";
import { hrefFor, linkHandler } from "../../lib/router";
import styles from "./Game.module.css";

const ROUNDS = 5;
const MAX_POINTS = 1000;
const HINT_KEEP = 2 / 3;

interface Round {
  apod: Apod;
  guess?: number;
  hint: boolean;
  points?: number;
}

type Phase = "intro" | "loading" | "guessing" | "revealed" | "done" | "error";

function pointsFor(diff: number, hint: boolean) {
  return Math.round(MAX_POINTS * Math.exp(-diff / 3.2) * (hint ? HINT_KEEP : 1));
}

function yearOf(apod: Apod) {
  return parts(apod.date).y;
}

function preloadImage(apod: Apod) {
  return new Promise<void>((resolve) => {
    if (!apod.image) return resolve();
    const img = new Image();
    img.onload = img.onerror = () => resolve();
    img.src = imageAt(apod.image, displayBox());
  });
}

/** Draw a random archive issue that has a picture to look at. */
async function draw(latest: ISODate, taken: Set<ISODate>): Promise<Apod> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const apod = await getDay(randomDate(FIRST_ISSUE, latest)).catch(() => null);
    if (apod?.image && !taken.has(apod.date)) {
      taken.add(apod.date);
      await preloadImage(apod);
      return apod;
    }
  }
  throw new Error("Couldn’t draw a stamp from the archive.");
}

function verdictLine(score: number) {
  const share = score / (ROUNDS * MAX_POINTS);
  if (share >= 0.85) return "You read postmarks like a philatelist with a loupe.";
  if (share >= 0.6) return "A sharp eye for the archive. A few of those smudges fooled you.";
  if (share >= 0.35) return "Not bad. The sky looks much the same in 1998 and 2018; the cameras don’t.";
  return "The smudges won this round. Try looking at the image quality and the subject’s era.";
}

export default function Game() {
  const best = useBestScore();
  const [phase, setPhase] = useState<Phase>("intro");
  const [rounds, setRounds] = useState<Round[]>([]);
  const [guess, setGuess] = useState(2010);
  const [cover, setCover] = useState<Apod | null>(null);
  const [latest, setLatest] = useState<ISODate>(() => latestPossibleDate());
  const taken = useRef(new Set<ISODate>());
  const upcoming = useRef<Promise<Apod> | null>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const guessInput = useRef<HTMLInputElement>(null);

  const round = rounds[rounds.length - 1];
  const index = rounds.length;
  const total = rounds.reduce((sum, r) => sum + (r.points ?? 0), 0);
  const maxYear = parts(latest).y;

  useEffect(() => {
    let live = true;
    getLatest().then(
      (apod) => {
        if (!live) return;
        setLatest(apod.date);
        setCover(apod);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);

  const queueNext = useCallback(() => {
    upcoming.current = draw(latest, taken.current);
    upcoming.current.catch(() => undefined);
  }, [latest]);

  const deal = useCallback(async () => {
    setPhase("loading");
    try {
      const apod = await (upcoming.current ?? draw(latest, taken.current));
      upcoming.current = null;
      setRounds((prev) => [...prev, { apod, hint: false }]);
      setGuess(Math.round((1995 + parts(latest).y) / 2));
      setPhase("guessing");
    } catch {
      upcoming.current = null;
      setPhase("error");
    }
  }, [latest]);

  const start = () => {
    taken.current = new Set();
    upcoming.current = null;
    setRounds([]);
    deal().then(() => queueNext());
  };

  const submit = () => {
    if (!round || phase !== "guessing") return;
    const diff = Math.abs(guess - yearOf(round.apod));
    const points = pointsFor(diff, round.hint);
    setRounds((prev) => prev.map((r, i) => (i === prev.length - 1 ? { ...r, guess, points } : r)));
    setPhase("revealed");
    if (index < ROUNDS) queueNext();
  };

  const advance = () => {
    if (index >= ROUNDS) {
      recordScore(total);
      setPhase("done");
    } else {
      deal();
    }
  };

  useEffect(() => {
    if (phase === "revealed") nextButton.current?.focus();
    if (phase === "guessing") guessInput.current?.focus();
  }, [phase]);

  const copyResult = async () => {
    const lines = [
      `Skypost · Smudged postmark: ${total.toLocaleString("en-GB")} / ${(ROUNDS * MAX_POINTS).toLocaleString("en-GB")}`,
      ...rounds.map((r, i) => `${i + 1}. issued ${yearOf(r.apod)}, guessed ${r.guess} (+${r.points})`),
      window.location.origin + hrefFor({ view: "game" }),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast("Result copied. Paste it anywhere.");
    } catch {
      toast("Couldn’t copy. Your browser blocked the clipboard.");
    }
  };

  // ---- intro -------------------------------------------------------------------------

  if (phase === "intro" || phase === "error" || (phase === "loading" && !round)) {
    return (
      <main className={styles.page}>
        <section className={styles.intro}>
          <Perf className={styles.coverStamp}>
            <div className={styles.coverWindow}>
              {cover?.image && <img src={imageAt(cover.image, 1280)} alt="" />}
            </div>
            <div className={styles.coverBand}>
              <span className={styles.coverHidden} aria-hidden="true">Title hidden</span>
              <Postmark date={null} smudged className={styles.coverMark} />
            </div>
          </Perf>
          <div className={styles.introText}>
            <h1 className={styles.title}>Smudged postmark</h1>
            <p className={styles.lede}>
              Five stamps drawn at random from thirty years of the archive. Their postmarks have smudged. Look at each
              picture and guess the year it was issued.
            </p>
            <ul className={styles.rules}>
              <li>The right year scores 1,000 points. Every year off costs you more.</li>
              <li>Stuck? Reveal the title, and keep two thirds of the points.</li>
            </ul>
            {phase === "error" && (
              <p className={styles.error} role="alert">
                Couldn’t draw stamps from NASA’s archive. Check your connection and try again.
              </p>
            )}
            <button type="button" className={`caps ${styles.primary}`} onClick={start} disabled={phase === "loading"}>
              {phase === "loading" ? "Drawing stamps…" : phase === "error" ? "Try again" : "Start a round of five"}
              {phase !== "loading" && <ArrowRight size={16} aria-hidden="true" />}
            </button>
            {best > 0 && (
              <p className={styles.best}>
                Your best so far: <strong className="num">{best.toLocaleString("en-GB")}</strong> of {(ROUNDS * MAX_POINTS).toLocaleString("en-GB")}.
              </p>
            )}
          </div>
        </section>
      </main>
    );
  }

  // ---- final sheet ----------------------------------------------------------------

  if (phase === "done") {
    return (
      <main className={styles.page}>
        <section className={styles.done}>
          <h1 className={styles.title}>
            You scored <span className="num">{total.toLocaleString("en-GB")}</span> of {(ROUNDS * MAX_POINTS).toLocaleString("en-GB")}.
          </h1>
          <p className={styles.lede}>
            {verdictLine(total)}
            {total >= best && total > 0 ? " That’s your best yet." : ""}
          </p>
          <ol className={styles.results}>
            {rounds.map((r) => {
              const actual = yearOf(r.apod);
              return (
                <li key={r.apod.date}>
                  <a className={styles.resultLink} href={hrefFor({ view: "day", date: r.apod.date })} onClick={linkHandler({ view: "day", date: r.apod.date })}>
                    <MiniStamp thumb={thumbOf(r.apod, 360)} mediaType={r.apod.mediaType} value={actual} caption={r.apod.title} />
                  </a>
                  <p className={styles.resultLine}>
                    <span>Guessed <strong className="num">{r.guess}</strong></span>
                    <span className="num">+{r.points}</span>
                  </p>
                </li>
              );
            })}
          </ol>
          <div className={styles.actions}>
            <button type="button" className={`caps ${styles.primary}`} onClick={start}>
              <RotateCcw size={16} aria-hidden="true" /> Play again
            </button>
            <button type="button" className={`caps ${styles.secondary}`} onClick={copyResult}>
              <Copy size={15} aria-hidden="true" /> Copy result
            </button>
          </div>
        </section>
      </main>
    );
  }

  // ---- a round -----------------------------------------------------------------------

  const revealed = phase === "revealed" && round?.guess !== undefined;
  const actual = round ? yearOf(round.apod) : 0;
  const off = revealed ? Math.abs((round.guess ?? 0) - actual) : 0;
  const ticks = [1995, 2000, 2005, 2010, 2015, 2020, 2025].filter((y) => y <= maxYear);

  return (
    <main className={styles.page}>
      <section className={styles.board}>
        <Perf className={`${styles.stamp} ${phase === "loading" ? styles.dealing : ""}`}>
          <div className={styles.window}>
            {round?.apod.image && <img key={round.apod.date} src={imageAt(round.apod.image, displayBox())} alt={revealed || round.hint ? round.apod.alt : "The picture to date"} />}
          </div>
          <div className={styles.band}>
            <div className={styles.words}>
              {revealed || round?.hint ? (
                <p className={styles.stampTitle}>{round?.apod.title}</p>
              ) : (
                <p className={styles.stampTitleHidden}>Title hidden</p>
              )}
              <p className={`caps ${styles.inscription}`}>{revealed ? formatLong(round.apod.date) : "Astronomy Picture of the Day"}</p>
            </div>
            <Postmark date={revealed ? round.apod.date : null} smudged={!revealed} className={styles.mark} />
          </div>
        </Perf>

        <div className={styles.panel}>
          {!revealed ? (
            <form
              className={styles.guessForm}
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <label className={styles.question} htmlFor="year-guess">
                Which year was this issued?
              </label>
              <output className={`${styles.readout} num`} htmlFor="year-guess" aria-live="off">
                <Digits value={guess} length={4} />
              </output>
              <input
                ref={guessInput}
                id="year-guess"
                className={styles.range}
                type="range"
                min={1995}
                max={maxYear}
                step={1}
                value={guess}
                onChange={(e) => setGuess(Number(e.target.value))}
                disabled={phase !== "guessing"}
                aria-valuetext={String(guess)}
              />
              <div className={styles.ticks} aria-hidden="true">
                {ticks.map((y) => (
                  <span key={y} style={{ left: `${((y - 1995) / (maxYear - 1995)) * 100}%` }} className="num">
                    {y}
                  </span>
                ))}
              </div>
              <div className={styles.actions}>
                <button type="submit" className={`caps ${styles.primary}`} disabled={phase !== "guessing"}>
                  {phase === "loading" ? "Drawing the next stamp…" : `Postmark it ${guess}`}
                </button>
                <button
                  type="button"
                  className={`caps ${styles.secondary}`}
                  onClick={() => setRounds((prev) => prev.map((r, i) => (i === prev.length - 1 ? { ...r, hint: true } : r)))}
                  disabled={!round || round.hint || phase !== "guessing"}
                >
                  <Eye size={15} aria-hidden="true" /> {round?.hint ? "Title revealed" : "Reveal title"}
                </button>
              </div>
            </form>
          ) : (
            <div className={styles.verdict}>
              <div className={styles.split}>
                <div className={styles.half}>
                  <span className="caps">Your guess</span>
                  <strong className="num">{round.guess}</strong>
                </div>
                <div className={`${styles.half} ${styles.truth}`}>
                  <span className="caps">Issued</span>
                  <strong className="num">{actual}</strong>
                </div>
              </div>
              <p className={styles.outcome} role="status">
                {off === 0 ? "Spot on." : `${off} ${off === 1 ? "year" : "years"} off.`}{" "}
                <strong className="num">+{round.points}</strong> points{round.hint ? " (title hint used)" : ""}.
              </p>
              <button ref={nextButton} type="button" className={`caps ${styles.primary}`} onClick={advance}>
                {index >= ROUNDS ? "See your score" : "Next stamp"} <ArrowRight size={16} aria-hidden="true" />
              </button>
              <a className={styles.openDay} href={hrefFor({ view: "day", date: round.apod.date })} onClick={linkHandler({ view: "day", date: round.apod.date })}>
                Read about this picture
              </a>
            </div>
          )}

          <p className={`caps ${styles.progress}`} aria-live="polite">
            Stamp {index} of {ROUNDS} · <span className="num">{total.toLocaleString("en-GB")}</span> points
          </p>
        </div>
      </section>
    </main>
  );
}
