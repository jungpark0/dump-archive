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

## Dev servers

Named in `../.claude/launch.json`, never started by hand:

| name | what | port |
| --- | --- | --- |
| `static` | the vanilla sandbox | 8815 |
| `archive-web` | this app | 3100 |
| `sanity` | the Studio in `../archive-site` | 3333 |

## Content lives in Sanity

Project `eg4pfiee`, dataset `production`, read straight from the CDN by the
browser — no API route, no rebuild needed when content changes. A new photo
goes in through the Studio and appears on the next page load.

Bulk edits are one-off scripts in `../archive-site/scripts/`, run with:

```bash
npx sanity exec scripts/<name>.mjs --with-user-token
```

They authenticate through `getCliClient()`, which uses the Sanity CLI's own
login. There is no token in this repo and none is needed.

## Conventions the code relies on

- **An empty `note` is deliberate**, not unfinished. The popup prints
  `Just the photo.` in its place. Roughly 22 of 55 photos are in that state.
- **A missing `where` or `when` prints `-`**, matching the 055 log list.
- **Series titles hyphenate their counter**: `Receipt-1`, `Asian Squat-9`.
  `Manhole, 359` is not a series — that number is part of the name.
- **Titles stay at or under ~21 characters** so the TITLE column never wraps.
- The visit trail marks only the most recent photo. Anything that marks every
  row eventually marks nothing.

## The one rule about new features

The intro says the archive takes everything in and groups nothing. It already
carries sorting, a trail, zoom and a gravity drop — about as much structure as
that claim survives. Grouping, tags, filters or series navigation would make
the first line a lie. Weigh a new feature against that sentence before building
it.
