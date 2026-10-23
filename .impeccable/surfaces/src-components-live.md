---
version: 1
slug: "src-components-live"
primary_target: "src/components/Live"
related_targets: []
---

# Surface: Live (Earth · ISS · Tonight)

Mode: Experience (Earth), Operate (ISS, Tonight). Three tabs inside one "Live" section of the existing Skypost world; each tab has its own layout, all inheriting DESIGN.md (stockbook leaf, stamp paper, cancellation inks, engraved caps, postmark strike).

Audience and job: the same curious visitors; Earth shows the whole planet from DSCOVR/EPIC on any day since June 2015 (including their birthday); ISS shows where the station is now and when it passes over them; Tonight answers "can I see the sky tonight?" (clouds, aurora chance, next launch).

Pinned by the user (approved wireframes, no concept roll): Earth = souvenir sheet with a round perforated stamp holding the Earth disc, metadata beside it, the day's frames as a strip, play/drag to spin, birthday jump. ISS = airmail route chart: full-width world map on paper, orbit track drawn as cancellation waves, ISS as a live postmark, day/night terminator, narrow dispatch slip with telemetry and next passes, location opt-in. Tonight = one verdict sentence, then a night timeline from sunset to sunrise printed as a coil of hourly stamps whose sky darkens or greys with cloud cover, then aurora (Kp chart + verdict for the place's geomagnetic latitude) and next-launch countdown.

Constraints: static site, no API keys; location only on request (device or city search); every API cached within its free limits (Launch Library 15/h). Truth: aurora and visibility are estimates and say so; no invented data.
