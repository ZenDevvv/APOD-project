# Product

<!-- impeccable:product-schema 1 -->

> Interview substitution: the user asked for the redesign to be finished in one go with no questions, so the init interview did not run. Facts marked *(inferred)* come from the repository, the original request, and the live NASA data source, not from a confirmed answer.

## Platform

web

## Users

- Curious non-specialists who open the page to see what the universe looks like today, often on a phone in the evening or on a laptop as a moment's break. *(inferred)*
- People who want to look up the picture published on a date that matters to them (the original app's "picture of your birthday" feature) and share it. *(from code)*
- Returning visitors who browse the 30-year archive for its own sake and keep the pictures they love. *(inferred from the requested "fun and interactive" additions)*

## Product Purpose

An unofficial, image-first viewer for NASA's Astronomy Picture of the Day (APOD): one astronomy image or video every day since 16 June 1995, each with a short explanation by a professional astronomer. Success is a visitor who looks longer than they meant to, learns one thing, and comes back tomorrow or goes looking for another date. *(inferred)*

## Positioning

The official APOD page is a 1995 HTML document; this viewer gives the same archive a full-screen, explorable presentation and adds ways to play with the dates themselves: your birthday, any day, a random day, a whole month at a glance, and a guess-the-year game. *(inferred)*

## Operating Context

- Data comes from NASA's public WordPress endpoint `https://science.nasa.gov/wp-json/wp/v2/apod-basic` (no key, CORS-enabled). The legacy `api.nasa.gov/planetary/apod` endpoint the app used to call now returns a placeholder ("NASA Science" plus the NASA logo) for every date since NASA moved APOD to science.nasa.gov in September 2026, and it is due to be archived on 1 December 2026.
- Single dates are fetched as `/apod-basic/YYMMDD`; ranges use `date_from`/`date_to` in `YYMMDD` with `per_page` capped at 25; missing days return 404.
- Entries from the early years carry a placeholder `hdurl`; their real image sits in the entry's `basic_html`. Video days embed YouTube/Vimeo iframes inside `basic_html`.
- A new picture appears shortly after midnight US Eastern time.

## Capabilities and Constraints

Preserved from the original app:
- Today's picture, full screen, with a pointer-driven parallax drift.
- An information panel with title, date, explanation and credit.
- Picture of your birthday: pick a date from 1995-06-16 onward and see that day's picture, with a way back to today.
- Open the full-resolution image.

Added in this redesign *(inferred from the request)*:
- Day-by-day travel (previous and next day), any-date jump, random day.
- Shareable URLs per date.
- Video days rendered as video, not a broken image.
- A month-at-a-glance archive.
- A saved collection kept in the browser.
- A guess-the-year game played on real archive entries.
- Keyboard shortcuts.

Constraints: static front end only (React, TypeScript, Vite), no backend and no API key. Explanations and credits arrive as HTML and must be sanitized before rendering.

## Brand Commitments

- This is not an official NASA product and must not wear NASA's logo, branding, or name as its own identity. Credit NASA and each picture's credited authors as the source.
- The original app's name in the browser tab was "NASA APOD"; the redesign names itself without implying NASA authorship.

## Evidence on Hand

- The full APOD archive via the endpoint above: images, videos, titles, explanations, alt text and credits for roughly 11,400 days.
- No testimonials, user numbers or press exist. None may be invented.

## Product Principles

1. The picture leads. Interface recedes until asked for.
2. Every date is a door: any feature that lets someone reach a meaningful day is worth more than decoration.
3. Credit is part of the picture. Authors and copyright are always one step away and never truncated away.
4. Fail gracefully: a missing day, a video, an ancient GIF, or a slow network each gets a deliberate state.

## Accessibility & Inclusion

- APOD supplies alt text for most entries; use it.
- Every control is keyboard reachable, with visible focus; the parallax drift respects reduced-motion preferences.
