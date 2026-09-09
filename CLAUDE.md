# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Frontend** (no build step — plain HTML/CSS/JS):
```bash
npx serve .
```
Any static file server works (`python3 -m http.server`, VS Code Live Server, etc.).

**Contact-form API** (`server/`):
```bash
cd server
npm install
cp .env.example .env   # fill in real SMTP credentials + delivery address
npm start               # or `npm run dev` for auto-restart on change
```
There is no lint/test tooling configured in either the frontend or `server/`.

The frontend posts to the API at the URL `js/main.js` sets as the `endpoint` attribute on `<contact-form>` (see `CONTACT_ENDPOINT` near the top of the file) — update it if the API runs on a different host/port, and keep it in sync with `ALLOWED_ORIGIN` in `server/.env` (CORS is locked to a single origin) and with `connect-src` in `vercel.json`.

## Architecture

Single-page static site + a small standalone Express API; the two only talk to each other over one HTTP endpoint (`POST /api/contact`) and have no shared code or types.

**Frontend (`index.html` / `css/styles.css` / `js/main.js` / `js/components/`)** — `js/main.js` owns page data and orchestration; the gallery and contact form are native Web Components (Custom Elements + Shadow DOM + `<slot>`, no build step needed) in `js/components/`:
- `SESSIONS` (top of `js/main.js`) is the source of truth for the gallery: an ordered array of `{ key, label, tag, images }`, where each image has a `ratio` (width ÷ height). `renderGallery()` builds the same `.gallery-block > .gallery-row-group > .gallery-item > img` markup as before and appends it into `<photo-gallery>` (`js/components/photo-gallery.js`), sizing each photo by `calc(var(--row-h) * ratio)` — fixed height, natural width — so nothing is ever stretched or cropped. Get an image's `ratio` wrong (e.g. landscape when the file is actually portrait) and `object-fit: cover` will crop it hard, since the box is sized for the wrong aspect.
- `<photo-gallery>` only owns the row-column layout (`:host`), fade-in-on-scroll, and dispatching a `photo-select` event on click — it does **not** own `.gallery-block`/`.gallery-row-group`/`.gallery-item` styling. Those classes stay on slotted (light-DOM) elements and are styled by the global `css/styles.css`, because `::slotted()` can only style a slotted element itself, never its descendants — a shadow-root `<style>` in this component physically cannot reach `.gallery-item img` nested inside a slotted `.gallery-block`. Don't try to move that CSS into the component.
- `label` is retained per session only for accessibility/lightbox text (`img.alt`, the lightbox caption via `SESSION_LABELS`) — there's no visible label in the gallery itself.
- `tag` (`solo` or `family`) drives the `#filterOptions` Solo/Family/All filter — `initFilter()` shows/hides each `.gallery-block` (queried through the `<photo-gallery>` host) by matching `block.dataset.tag`. Multiple sessions can share a `tag` (Amrita, Jocelyn, and Steven are all `solo`); add a new `.filter-btn` in `index.html` only if a session introduces a new tag.
- `GALLERY_IMAGES` is a flattened, order-preserving view of `SESSIONS` used to index the lightbox (`openLightbox(index)` / `stepLightbox(delta)`), driven by the `index` in `<photo-gallery>`'s `photo-select` event detail — so gallery DOM order and lightbox navigation order must stay derived from the same source.
- The `.filter-panel` (fixed bottom-left, `index.html`) holds only the FILTER toggle now — there is no per-session quick-jump UI.
- `.site-header` is `position: fixed` with no hardcoded height, so `syncHeaderHeight()` (`js/main.js`) measures its real `offsetHeight` on load/resize and writes it to the `--header-h` CSS variable; `.work`'s `padding-top: var(--header-h)` (`css/styles.css`) uses that to clear the header exactly, at any breakpoint or font-load-induced size change.
- `<contact-form>` (`js/components/contact-form.js`) owns the entire form: markup, validation, submit-to-API, and status messaging, all inside its shadow DOM (unlike the gallery, these fields aren't slotted, so their CSS lives in the component's own `<style>`, not `css/styles.css`). Client-side checks are only for UX; `server/server.js` is the actual validation boundary. Session-type options are declared as `<option slot="subjects">` children of `<contact-form>` in `index.html` and must stay in sync with `ALLOWED_SUBJECTS` in `server/server.js` — the component reads them via `querySelectorAll('option[slot="subjects"]')` and clones them into its own shadow-owned `<select>` rather than relying on native cross-shadow `<select>` slotting, which isn't reliably supported across browsers (Safari/Firefox don't render it).

**API (`server/server.js`)** — single-file Express app, one route (`POST /api/contact`), defense-in-depth is the point of nearly every line: `express-validator` on all fields, a honeypot field (`website`, must be empty), `express-rate-limit` (5 req / 10 min / IP), CORS locked to `ALLOWED_ORIGIN`, `helmet` security headers, 10kb body cap, and CR/LF stripping on fields before they're interpolated into the outgoing email (header-injection prevention). When touching this file, preserve these rather than simplifying them away, and keep error responses generic (no stack traces / internals to the client — see the centralized error handler at the bottom of the file).

`assets/hero.png` and `assets/section1–4.png` are layout references (screenshots of the inspiration site), not used by the site itself.

## Conventions

When a UI pattern repeats (e.g. the photo gallery, the contact form) or clearly will, componentize it into its own reusable module with a clear props/slot-style interface, rather than inlining copies of similar markup/logic in multiple places. Keep the no-build-step constraint in mind — this still means plain JS (e.g. small functions/classes that render into a container element or native Web Components), not introducing a framework or bundler.
