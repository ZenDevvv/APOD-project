# Skypost

**Live: [zendevvv.github.io/APOD-project](https://zendevvv.github.io/APOD-project/)**

NASA's Astronomy Picture of the Day, presented as a stamp collection. Every day since 16 June 1995 has its own
picture of the universe; Skypost prints each one as a perforated stamp and lets you re-set the postmark to any
date you like.

## What it does

- **Today's issue**, full screen, with the original app's pointer-driven parallax drift.
- **Day by day**: previous and next day (arrow keys or swipe), any date on the postmark's date wheels, a random day.
- **Your birthday**: the picture published on your birthday, with a way back to today, and a sheet of your
  birthday in every year since 1995.
- **Catalogue entry**: title, date, credit and the astronomer's explanation. Links to other APOD days open
  inside the app.
- **Loupe**: a magnifier that reads the full-resolution file under the pointer (scroll to change power).
- **Whole picture**: switch between filling the stamp and showing the uncropped image.
- **Films**: video days play in place instead of showing a broken image.
- **Archive**: any month laid out as a pane of stamps, from June 1995 to now.
- **Album**: keep the stamps you love. They're stored in your browser.
- **Smudged postmark**: a five-round game where you guess the year each picture was published.
- **Share**: every day has its own link (`?d=YYYY-MM-DD`).

Keyboard: `←` `→` travel, `T` today, `D` date, `B` birthday, `R` random, `I` catalogue, `L` loupe,
`W` whole picture, `S` album, `F` fullscreen, `Esc` close.

## Data source

In September 2026 NASA moved APOD to [science.nasa.gov/apod](https://science.nasa.gov/apod/). The legacy
`api.nasa.gov/planetary/apod` endpoint this app used to call now returns a placeholder ("NASA Science" and the NASA
logo) for every date, and is due to be archived on 1 December 2026.

Skypost reads NASA's replacement endpoint, `https://science.nasa.gov/wp-json/wp/v2/apod-basic`, which needs **no
API key** and allows cross-origin requests:

| Request | Use |
| --- | --- |
| `/apod-basic?per_page=1` | the latest issue |
| `/apod-basic/YYMMDD` | one day (404 when no picture was published) |
| `/apod-basic?date_from=YYMMDD&date_to=YYMMDD&per_page=25&page=N` | a month (25 per page at most) |

Some older records carry a placeholder `hdurl`; Skypost recovers their pictures from the record's `basic_html`, and
video days from its embedded player. Responses are cached in memory and `localStorage`. `src/lib/apod.ts` has the
details.

The `VITE_API_KEY` variable is no longer used.

## Development

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # type-check and build to dist/
npm run lint
```

Every push to `main` builds and deploys to GitHub Pages through `.github/workflows/deploy.yml`.

Built with React 19, TypeScript and Vite. Fonts are self-hosted (Archivo and Literata via Fontsource) and icons come
from Lucide.

## Design tooling

The repo ships the [Impeccable](https://github.com/pbakaus/impeccable) design skill for Claude Code in `.claude/`.
`PRODUCT.md` holds the product context, `DESIGN.md` the visual system, and `.impeccable/surfaces/` the direction for
the main surface. The engine binary isn't committed; the launcher downloads it on first use.

## Credits

Pictures and explanations come from NASA's [Astronomy Picture of the Day](https://science.nasa.gov/apod/) and remain
credited to their authors, as shown with each picture. Skypost is an unofficial viewer, not a NASA product.
