import { useMemo, useSyncExternalStore, type MouseEvent } from "react";
import { isISODate, isYearMonth, type ISODate, type YearMonth } from "./dates";

// Routes live in the query string so the app works on any static host
// without rewrite rules, and every date has a shareable link.

export type Route =
  | { view: "day"; date?: ISODate; birthday?: boolean }
  | { view: "archive"; month?: YearMonth }
  | { view: "birthday"; on?: string }
  | { view: "album" }
  | { view: "game" };

export type View = Route["view"];

const NAV_EVENT = "skypost:navigate";

function isMonthDay(value: string | null): value is string {
  return !!value && /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value);
}

export function parseRoute(search: string): Route {
  const q = new URLSearchParams(search);
  const view = q.get("view");
  if (view === "archive") {
    const m = q.get("m");
    return { view: "archive", month: isYearMonth(m) ? m : undefined };
  }
  if (view === "birthday") {
    const on = q.get("on");
    return { view: "birthday", on: isMonthDay(on) ? on : undefined };
  }
  if (view === "album") return { view: "album" };
  if (view === "game") return { view: "game" };
  const d = q.get("d");
  return { view: "day", date: isISODate(d) ? d : undefined, birthday: q.get("b") === "1" && isISODate(d) };
}

export function hrefFor(route: Route): string {
  const q = new URLSearchParams();
  switch (route.view) {
    case "day":
      if (route.date) q.set("d", route.date);
      if (route.date && route.birthday) q.set("b", "1");
      break;
    case "archive":
      q.set("view", "archive");
      if (route.month) q.set("m", route.month);
      break;
    case "birthday":
      q.set("view", "birthday");
      if (route.on) q.set("on", route.on);
      break;
    default:
      q.set("view", route.view);
  }
  const search = q.toString();
  return `${window.location.pathname}${search ? `?${search}` : ""}`;
}

export function navigate(route: Route, options: { replace?: boolean } = {}) {
  const href = hrefFor(route);
  if (href === `${window.location.pathname}${window.location.search}`) return;
  if (options.replace) window.history.replaceState(null, "", href);
  else window.history.pushState(null, "", href);
  window.dispatchEvent(new Event(NAV_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(NAV_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(NAV_EVENT, onChange);
  };
}

const getSearch = () => window.location.search;

export function useRoute(): Route {
  const search = useSyncExternalStore(subscribe, getSearch, getSearch);
  return useMemo(() => parseRoute(search), [search]);
}

/** Let plain links navigate in-app while keeping cmd/ctrl-click and middle-click working. */
export function linkHandler(route: Route) {
  return (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(route);
  };
}
