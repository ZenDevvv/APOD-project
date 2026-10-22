import { lazy, Suspense, useEffect } from "react";
import TopBar from "./components/TopBar/TopBar";
import Viewer from "./components/Viewer/Viewer";
import Toaster from "./components/Toast/Toast";
import { useRoute } from "./lib/router";
import { formatShort } from "./lib/dates";

const Archive = lazy(() => import("./components/Archive/Archive"));
const BirthdaySheet = lazy(() => import("./components/Archive/BirthdaySheet"));
const Album = lazy(() => import("./components/Album/Album"));
const Game = lazy(() => import("./components/Game/Game"));

const TITLES = {
  archive: "Archive",
  birthday: "Every year on your birthday",
  album: "Your album",
  game: "Smudged postmark",
} as const;

/** Shared SVG filter that roughens anything printed in cancellation ink. */
function InkFilter() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <filter id="skypost-ink" x="-6%" y="-6%" width="112%" height="112%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="11" result="grain" />
        <feDisplacementMap in="SourceGraphic" in2="grain" scale="1.2" xChannelSelector="R" yChannelSelector="G" result="rough" />
        <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="4" result="blot" />
        <feColorMatrix in="blot" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  3.2 0 0 0 -0.55" result="coverage" />
        <feComposite in="rough" in2="coverage" operator="in" />
      </filter>
    </svg>
  );
}

export default function App() {
  const route = useRoute();

  useEffect(() => {
    const base = "Skypost · Astronomy Picture of the Day";
    if (route.view === "day") document.title = route.date ? `${formatShort(route.date)} · Skypost` : base;
    else document.title = `${TITLES[route.view]} · Skypost`;
  }, [route]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route.view]);

  return (
    <>
      <InkFilter />
      <TopBar view={route.view} dated={route.view === "day" && !!route.date} />
      <Suspense fallback={<div style={{ minHeight: "80svh" }} />}>
        {route.view === "day" && <Viewer date={route.date} birthday={route.birthday} />}
        {route.view === "archive" && <Archive month={route.month} />}
        {route.view === "birthday" && <BirthdaySheet on={route.on} />}
        {route.view === "album" && <Album />}
        {route.view === "game" && <Game />}
      </Suspense>
      <Toaster />
    </>
  );
}
