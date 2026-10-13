@AGENTS.md

# DUMP-ARCHIVE

A personal photo archive. Deployed at https://dump-archive.vercel.app — Vercel
builds on every push to `main`.

## Two copies of the same site

The site exists twice, and the plain one comes first:

- `../` (the parent folder, not in git) — `index.html`, `style.css`,
  `script.js`, `reset.css`. Vanilla, no build step. Changes are made and
  approved here.
- `archive-web/` (this repo) — the Next.js version that actually ships.
  `app/page.js` mirrors `script.js`, `app/globals.css` mirrors `style.css`.

Work in the sandbox, get it looking right, then port. Porting in the other
direction has never happened.

### Keeping the two in sync

`style.css` is the source of truth. `globals.css` is that file with the reset
appended, so regenerate it rather than editing it:

```bash
n=$(grep -n "reset.css (loaded after style.css" app/globals.css | cut -d: -f1) && \
  { cat ../style.css; tail -n +$((n-1)) app/globals.css; } > app/globals.css.new && \
  mv app/globals.css.new app/globals.css
```

`page.js` has to be ported by hand, and it is not a literal copy:

- The full-size image width is computed inside `loadPhotos()`, not at module
  scope — `window` does not exist during SSR.
- Every listener the effect adds must be removed in its teardown, so named
  functions are used where `script.js` uses inline ones.
- The physics array is `bodies` in `page.js` and `items` in `script.js`;
  `items` is already taken there.
- Matter is a global in the sandbox (`loadMatter()`); here it is
  `(await import("matter-js")).default`, carried around as `state.Matter`.
- `script.js` is top-level with 4-space steps and single quotes; `page.js` sits
  inside one effect at 4 spaces with 2-space steps and double quotes.
- The sandbox's top-level names (`buildReceipt`, `receiptId`, `originalItems`,
  `pile`) are reachable from a test page; nothing is here. Scripted checks
  that need to call into the code run against the sandbox.

## Dev servers

Named in `../.claude/launch.json`, never started by hand:

| name | what | port |
| --- | --- | --- |
| `static` | the vanilla sandbox | 8815 |
| `archive-web` | this app | 3100 |
| `sanity` | the Studio in `../archive-site` | 3333 |

## The receipt

RECEIPT (bottom right) lays the list over the page as a till receipt, and
PRINT, or Cmd+P at any time, prints exactly that and nothing else.

- It is one inline SVG, `viewBox="0 0 384 H"`: a unit is one dot of a 203dpi
  thermal head, so 384 units print as the 48mm a 58mm roll takes. The columns
  and the row pitch in `buildReceipt()` are baselines read off the Illustrator
  original (`../PDF/무제-1.pdf`); what goes where down the page has since moved
  on from it (below). A single SVG is what keeps it identical in every browser
  and on one page; an HTML layout scaled with `zoom` or `transform` drifted and
  was split across pages.
- The photo is drawn as rectangles, one per run of black dots (`dotsOf()`), not
  as a bitmap. Browsers and PDF viewers resample bitmaps into grey.
- Only photos in the 3:4 upright are printed: the last one looked at if it has
  that shape, any one that has otherwise. The remaining photos never appear.
- No two photos give the same receipt. The three prints start level with the
  photo's own row, which a star marks, and run down the left from there: at the
  top for 001, past the end of the list for 058, which makes that receipt half
  as long again. Its date and place go under the prints, wrapped to their
  width.
- Under the list, in its column: the count and LAST DUMP, then the photo's
  note (`Just the photo.` when there is none), as a till puts the total under
  the items and its one line under that.
- Whichever column ends lower, the address and the © close it at the bottom
  left and the minute it was printed at the bottom right, rewritten on
  `beforeprint`.
- Lines are wrapped by counting, not measuring: a letter is 6.516 units and a
  space 4.357 as this type is set. Change the size or spacing in `.receipt
  text` and those two numbers have to be measured again, or lines run off the
  paper.
- The star stands the same distance from DUMP-ARCHIVE at the top as from the
  title in its row.
- On screen it is fitted to the window's height from 768px wide, never under
  0.7 of its size nor over it (`--receipt-h` is set by the script); below that
  width it takes the width and scrolls under a white strip holding PRINT and
  CLOSE. On paper: `@page { margin: 0 }`, 48mm wide, crop marks made of borders
  because backgrounds are not printed.

Adding a photo makes every receipt 15 units longer. Nothing else needs changing.

## The first screen

On the first load only, fourteen photos pop in at the bottom of the intro
(`layPile()`), tossed the way the dump's words turn into photos. They can be
dragged, fade out as soon as the intro closes or the dump starts, and do not
come back (`clearPile()` leaves a marker in `pile`).

## Layers

| z-index | what |
| --- | --- |
| 200 | receipt overlay |
| 110 | footer text (© and LAST DUMP), `pointer-events: none` |
| 100 | photo popup |
| 95 | RECEIPT button |
| 94 | the footer's white strip (`body::after`) |
| 90 | header |
| 80 | hover thumbnail |
| 50–60 | dumped words and photos, the first-screen pile |

The footer is split in three on purpose. Its text stays sharp in front of the
popup; the strip and RECEIPT sit behind the popup so that its blur fades over
them as it does over the header. RECEIPT is a sibling of the footer, not a
child, for the same reason: a child could not go behind the popup alone.

## Content lives in Sanity

Project `eg4pfiee`, dataset `production`, read straight from the CDN by the
browser — no API route, no rebuild needed when content changes. A new photo
goes in through the Studio and appears on the next page load.

### Adding a photo

The site reads only from Sanity, but `../img/` keeps a local copy of every photo
under its number, so a new one goes to both:

- `../img/full/NNN.jpg` — long side 1800px, quality 90. This is the file that
  is uploaded to Sanity.
- `../img/thumb/NNN.jpg` — long side 700px.

Make both from the original with its EXIF orientation applied and the EXIF
itself dropped (the originals carry GPS); keep the ICC profile. Read `when` from
the original's capture date before dropping it. The original is not kept.

Bulk edits are one-off scripts in `../archive-site/scripts/`, run with:

```bash
npx sanity exec scripts/<name>.mjs --with-user-token
```

They authenticate through `getCliClient()`, which uses the Sanity CLI's own
login. There is no token in this repo and none is needed.

## Conventions the code relies on

- **An empty `note` is deliberate**, not unfinished. The popup prints
  `Just the photo.` in its place. Roughly 22 of 58 photos are in that state.
- **A missing `where` or `when` prints `-`**, matching the log list.
- **A new photo takes the next free number**, whatever its date. Numbers record
  the order photos were added; 001–055 happen to run by date because they were
  imported together. Never renumber to slot a photo in by date.
- **Series titles hyphenate their counter**: `Receipt-1`, `Asian Squat-9`.
  `Manhole, 359` is not a series — that number is part of the name.
- **Titles stay at or under ~21 characters** so the TITLE column never wraps.
- Opened rows are not marked. A visit trail was tried and removed: it only
  dimmed the list.
- A note keeps the line breaks and spacing it was typed with
  (`white-space: pre-wrap`). A long one makes the popup's top row taller, and
  ZOOM is withheld when that leaves less than 10% to gain, so keep notes short.
- Everything on the site is in English. Fragment Mono has no Hangul.
- On a phone one tap opens a photo. A first tap that only previewed the row was
  tried and taken out. The hover thumbnail is for a real pointer only.
- Opening the intro or INDEX scrolls to the top, stepped by hand (`toTop()`): a
  browser's own smooth scroll is dropped when the page changes height under it.

## The one rule about new features

The intro says the archive takes everything in and groups nothing. It already
carries sorting, zoom, a gravity drop and a receipt — about as much structure as
that claim survives. Grouping, tags, filters or series navigation would make
the first line a lie. Weigh a new feature against that sentence before building
it.
