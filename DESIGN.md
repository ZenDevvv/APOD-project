---
name: Skypost
description: NASA's Astronomy Picture of the Day as a stamp collection, one perforated issue per day since 1995.
colors:
  cancellation-violet: "#3d2a7a"
  cancellation-violet-soft: "#6c5bb3"
  registered-red: "#c4323f"
  registered-red-light: "#ef6b74"
  stockbook-black: "#0b0d12"
  stockbook-raised: "#12151d"
  stockbook-rule: "#232836"
  leaf-ink: "#e9e7e1"
  leaf-ink-muted: "#aeadb8"
  leaf-ink-faint: "#7f7e8c"
  stamp-paper: "#f1f0ec"
  stamp-paper-shade: "#e3e1db"
  stamp-paper-rule: "#cfccc4"
  printing-ink: "#1d1a2b"
  printing-ink-muted: "#4b4761"
  printing-ink-faint: "#6a6680"
  focus-on-leaf: "#b9aaf5"
typography:
  display:
    fontFamily: "Archivo Variable, Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(34px, 2rem + 2.4vw, 68px)"
    fontWeight: 760
    lineHeight: 0.98
    letterSpacing: "-0.025em"
    fontVariation: "'wdth' 110"
  headline:
    fontFamily: "Archivo Variable, Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(22px, 1.25rem + 0.9vw, 36px)"
    fontWeight: 720
    lineHeight: 1.04
    letterSpacing: "-0.014em"
    fontVariation: "'wdth' 88"
  title:
    fontFamily: "Archivo Variable, Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.15
    fontVariation: "'wdth' 92"
  numeral:
    fontFamily: "Archivo Variable, Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "64px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "'tnum', 'lnum'"
    fontVariation: "'wdth' 72"
  body:
    fontFamily: "Literata Variable, Literata, Georgia, serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.68
  label:
    fontFamily: "Archivo Variable, Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "11.5px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.09em"
    fontVariation: "'wdth' 112"
rounded:
  cut: "1px"
  slug: "2px"
  disc: "50%"
spacing:
  xs: "6px"
  sm: "10px"
  md: "14px"
  lg: "22px"
  bar: "56px"
  gutter: "clamp(12px, 2vw, 28px)"
components:
  button-on-leaf:
    backgroundColor: "{colors.stamp-paper}"
    textColor: "{colors.printing-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.slug}"
    padding: "0 20px"
    height: "50px"
  button-on-paper:
    backgroundColor: "{colors.printing-ink}"
    textColor: "{colors.stamp-paper}"
    typography: "{typography.label}"
    rounded: "{rounded.slug}"
    padding: "0 16px"
    height: "46px"
  button-on-paper-hover:
    backgroundColor: "{colors.cancellation-violet}"
    textColor: "{colors.stamp-paper}"
  tool-tab:
    backgroundColor: "transparent"
    textColor: "{colors.leaf-ink-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.slug}"
    padding: "0 10px"
    height: "38px"
  tool-tab-hover:
    backgroundColor: "{colors.stockbook-raised}"
    textColor: "{colors.leaf-ink}"
  date-slug:
    backgroundColor: "{colors.printing-ink}"
    textColor: "{colors.stamp-paper}"
    typography: "{typography.numeral}"
    rounded: "{rounded.slug}"
    height: "54px"
  stamp:
    backgroundColor: "{colors.stamp-paper}"
    textColor: "{colors.printing-ink}"
    padding: "18px"
---

# Design System: Skypost

## Overview

**Creative North Star: "The Daily Issue"**

Every day of the APOD archive is a stamp issued on its date, and the whole site is the collection that holds them. The picture is always the face of a stamp. It sits on white stamp paper with real perforation teeth, it's lettered in small engraved capitals, and it's struck with a circular postmark in cancellation ink. Around the stamps is the matte blue-black leaf of a stockbook, where the tools live as labelled tabs.

The picture leads and everything else stays small and exact. Lettering is either engraved caps (labels, inscriptions, tabs) or a compact grotesk headline, and long reading moves to a book serif. Colour belongs to the photographs. The interface keeps to paper, leaf and two inks. Motion is one gesture, the postmark striking when a day arrives, with the date wheels rolling digit by digit inside fixed cells.

**Key Characteristics:**
- Pictures framed as perforated stamps at every scale, from the full viewport to a calendar sheet of 31.
- Two grounds: the stockbook-black leaf and stamp paper. Text on each uses its own ink family.
- Cancellation violet and registered red are the only inks.
- Engraved caps on every control. Every tool has a written label, never an icon alone.
- One authored motion: the postmark strike plus its rolling date wheels.

## Colors

The palette is restrained: two grounds, two ink families and two cancellation inks. The photographs carry all the colour.

### Primary
- **Cancellation Violet** (#3d2a7a): the postmark, the cancellation bars, in-app links to other APOD days, the hover state of ink buttons, and the focus ring on paper. A softer pull (#6c5bb3) tints text selection.

### Secondary
- **Registered Red** (#c4323f): the active mark. It underlines the current nav item and pressed tools, fills the game's year-slider handle, and serves as the checkbox accent. On the leaf, the lighter pull (#ef6b74) colours saved-state icons and list markers.

### Neutral
- **Stockbook Black** (#0b0d12): the page ground, a matte blue-black leaf with a faint grain. Raised strips (#12151d) mark hover, and rules (#232836) mark borders on the leaf.
- **Leaf Ink** (#e9e7e1, muted #aeadb8, faint #7f7e8c): text on the leaf. Muted is the resting state for tabs and tools, faint is for metadata.
- **Stamp Paper** (#f1f0ec): stamps, the catalogue entry, the date setter, toasts and sheet selvage. Shade (#e3e1db) marks hover and unissued stamps, and rule (#cfccc4) marks dividers on paper.
- **Printing Ink** (#1d1a2b, muted #4b4761, faint #6a6680): text on paper.

### Named Rules
**The Two Grounds Rule.** Text sits either on the leaf, in leaf ink, or on paper, in printing ink. Never set grey text on a photograph. When copy has to sit on a picture, give it a paper tablet.

**The Ink Budget Rule.** Violet and red are the only saturated colours the interface prints. Each marks a state (postmarked, active or saved) and never decorates.

## Typography

**Display Font:** Archivo Variable (with Helvetica Neue, Arial)
**Body Font:** Literata Variable (with Georgia)

**Character:** Archivo's width axis does the work of a stamp printer's type case. It runs expanded for engraved caps, condensed for postmark numerals and normal for headlines. Literata carries the astronomers' explanations at reading size.

### Hierarchy
- **Display** (760, clamp(34px, 2rem + 2.4vw, 68px), 0.98, width 110): page titles on the leaf, such as the archive month, "Your album" and the game title.
- **Headline** (720, clamp(22px, 1.25rem + 0.9vw, 36px), 1.04, width 88): the picture's title on a stamp's inscription band, clamped to two lines.
- **Title** (700, 22px, 1.15, width 92): panel headings such as "Re-set the postmark" and the catalogue title, which sets larger at up to 34px.
- **Numeral** (800, 64px, width 72, tabular figures): the stamp's denomination. The same condensed numerals set the postmark date and the game's year readout.
- **Body** (400, 17px, 1.68): explanations, held to about 64ch.
- **Label** (600, 11.5px, 0.09em tracking, uppercase, width 112): engraved caps for tabs, tools, inscriptions and fact labels. Nothing functional goes below 11px.

### Named Rules
**The Engraved Caps Rule.** Every control is named in engraved caps. An icon may sit beside the label but never replaces it. On phones the dock shortens the label rather than dropping it.

**The Tabular Date Rule.** Dates and years always set in tabular lining figures, so a rolling date wheel never changes width.

## Layout

The day view is one stamp filling the viewport below a 56px top bar. On desktop there's a 60px travel gutter on each side (previous and next day, labelled vertically) and a single row of labelled tools beneath. The picture window takes about 85% of the stamp's height, and the inscription band below holds the title, the inscription and the credit, then the denomination and postmark on the right. With the catalogue open, a 470px paper column (at most 36vw) joins the grid and the stamp narrows instead of being covered. Below 1060px the catalogue becomes an overlay, and below 720px the gutters and toolbar give way to a six-item dock fixed to the bottom of the screen.

Archive and birthday views lay stamps out as a sheet: a paper selvage around a gap-free grid, seven columns for a calendar month, falling to four and then three on narrow screens, and auto-fill for the birthday sheet. The album is a stockbook leaf of fixed 300px rows with glassine strips running edge to edge. Spacing steps through 6, 10, 14 and 22px, and page gutters scale with the viewport.

## Elevation & Depth

Depth is physical and quiet. Paper lifts off the leaf with one soft drop shadow and nothing else glows. Stamp shadows sit on a separate layer behind the perforated paper, so moving content (parallax, the loupe) never repaints the mask.

### Shadow Vocabulary
- **Stamp lift** (`box-shadow: 0 1px 2px rgb(0 0 0 / 0.45), 0 14px 36px -14px rgb(0 0 0 / 0.75)`): every stamp, full-size or mini.
- **Sheet lift** (`box-shadow: 0 1px 2px rgb(0 0 0 / 0.4), 0 30px 60px -30px rgb(0 0 0 / 0.9)`): archive sheets and the album leaf.
- **Panel lift** (`box-shadow: 0 2px 4px rgb(0 0 0 / 0.35), 0 28px 60px -18px rgb(0 0 0 / 0.85)`): the date setter. Keyboard help and toasts use lighter single-layer versions of the same shadow.

### Named Rules
**The Physical Objects Rule.** Only physical objects cast shadows: stamps, sheets, the album page and paper panels. Interface chrome on the leaf (tabs, the dock, selects) separates by tone (#12151d) and rules (#232836), never by shadow or blur.

## Shapes

Corners are cut, not rounded: 1–3px on paper, slugs and buttons. Perforations are the only curved edge on a rectangle: radial holes (6px radius at an 18px pitch on the full stamp, 3.5px at 11px on mini stamps) that tile with a "round" repeat so every edge ends on a whole tooth. Circles appear only where the real object is round: the postmark, the loupe lens, the play disc and the album count.

## Components

### Buttons
- **Shape:** cut corners (2px).
- **On the leaf:** stamp paper with printing-ink engraved caps, 50px tall.
- **On paper:** printing ink with paper-coloured caps, 46px tall. On hover it turns cancellation violet.
- **Secondary:** a 1px rule outline in the ground's own ink family, which fills with the raised or shade tone on hover.

### Tool tabs
- **Style:** transparent, muted leaf ink, an icon (16px, Lucide) plus engraved caps, 38px tall.
- **State:** hover raises to #12151d with full leaf ink. Pressed tools (loupe, whole picture, catalogue, album) take a 2px registered-red underline. Saved state colours the stamp icon red.

### Inputs / Fields
- **Date slugs:** native selects drawn as flat printing-ink slugs with paper numerals (54px tall), flanked by step chevrons. On hover the slug turns violet.
- **Year slider:** a native range input whose track is a perforated paper strip and whose thumb is a red disc ringed in paper.
- **Focus:** a 2px outline, #b9aaf5 on the leaf and cancellation violet on paper, offset by 3px.

### Navigation
- **Top bar:** the wordmark in expanded caps (14px, 0.24em tracking) beside a tilted perforated logomark. Section links are engraved caps, and the current page gets a registered-red underline. "Today" is current only on today's issue.
- **Phones:** the wordmark hides, the section links tighten, and viewer travel moves to the bottom dock.

### Stamp (signature)
The perforated paper frame. Its picture window has a 1px ink frame line. The inscription band holds the title, the "Astronomy Picture of the Day" inscription and a one-line credit imprint, plus the denomination numeral, cancellation bars and postmark on desktop. Mini stamps repeat the anatomy at sheet scale (day numeral plus a two-line caption), and the album's medium stamps stack the date above the caption.

### Postmark (signature)
A circular date stamp: an outer ring and an inner ring, ring text on circular paths, and a two-line date on rolling wheels. It's printed in cancellation violet with a multiply blend through a shared SVG ink filter. When a day arrives it strikes once (scale 1.16 to 1 with a blur clearing, 520ms, exponential ease-out). It is also the date control. The smudged variant hides the date for the game.

### Loupe (signature)
A 260px circular lens with a 3px paper ring. It reads the full-resolution file (up to 4096px) under the pointer at 1.5–10× power, set by the scroll wheel, with the power shown on a paper tag.

## Do's and Don'ts

### Do:
- **Do** frame every APOD picture as a perforated stamp on stamp paper (#f1f0ec), at any scale.
- **Do** name every control in engraved caps (Archivo, 600, 11.5px, 0.09em, width 112).
- **Do** keep the strike as the only arrival motion, and render marks already struck under reduced motion.
- **Do** credit each picture's authors in the inscription band and in full in the catalogue entry.
- **Do** keep the date in tabular figures in fixed cells, so date wheels roll without reflowing.

### Don't:
- **Don't** set text directly on a photograph. Use the inscription band or a paper tablet.
- **Don't** use glows, glass, gradients or starfield particles for "space". The photographs are the space.
- **Don't** imitate metal or plastic with CSS bevels. Slugs and rims stay flat ink or flat paper.
- **Don't** wear NASA's logo or branding. Skypost is an unofficial viewer and credits NASA as the source.
- **Don't** put a label or kicker above a heading. Progress and status lines go below the content they describe.
