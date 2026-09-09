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

The frontend posts to the API at the URL hardcoded in `CONTACT_ENDPOINT` (`js/main.js:76`) — update it if the API runs on a different host/port, and keep it in sync with `ALLOWED_ORIGIN` in `server/.env` (CORS is locked to a single origin).

## Architecture

Single-page static site + a small standalone Express API; the two only talk to each other over one HTTP endpoint (`POST /api/contact`) and have no shared code or types.

**Frontend (`index.html` / `css/styles.css` / `js/main.js`)** — all interactivity lives in one IIFE in `js/main.js`, structured around a data-driven gallery:
- `SESSIONS` (top of `js/main.js`) is the source of truth for the gallery: an ordered array of `{ key, label, tag, images }`, where each image has a `ratio` (width ÷ height). `renderGallery()` builds one horizontally-scrolling row per session and sizes each photo by `calc(var(--row-h) * ratio)` — fixed height, natural width — so nothing is ever stretched or cropped.
- `key`/`label` (per-session, e.g. `amrita`/`Amrita`) and `tag` (shared across sessions, `solo` or `family`) are separate concerns: `key` drives the category-panel quick-jump and gallery block identity; `tag` drives the Solo/Family filter. Multiple sessions can share a `tag` (Amrita, Jocelyn, and Steven are all `solo`).
- `GALLERY_IMAGES` is a flattened, order-preserving view of `SESSIONS` used to index the lightbox (`openLightbox(index)` / `stepLightbox(delta)`), so gallery DOM order and lightbox navigation order must stay derived from the same source.
- Adding a session requires a `SESSIONS` entry in `main.js` plus a `.category-item` button (`data-target` = the session's `key`) inside `#categoryPanel` in `index.html`, and a `--cat-color` rule in `css/styles.css` for `.category-item[data-target="..."]`. Only add a `.filter-btn` in `#filterOptions` if the session introduces a new `tag` — the two existing tags (`solo`/`family`) already have buttons.
- The category panel (fixed bottom-left) scroll-jumps to a session's gallery block via `data-category` (`renderGallery()` sets `block.dataset.category` to the session `key`); the filter toggle shows/hides gallery blocks by `data-tag` (`block.dataset.tag`) instead — the two mechanisms are intentionally decoupled.
- The contact form does client-side checks only for UX; `server/server.js` is the actual validation boundary. Its subject options (`index.html`'s `#subject` `<select>`) must stay in sync with `ALLOWED_SUBJECTS` in `server/server.js`.

**API (`server/server.js`)** — single-file Express app, one route (`POST /api/contact`), defense-in-depth is the point of nearly every line: `express-validator` on all fields, a honeypot field (`website`, must be empty), `express-rate-limit` (5 req / 10 min / IP), CORS locked to `ALLOWED_ORIGIN`, `helmet` security headers, 10kb body cap, and CR/LF stripping on fields before they're interpolated into the outgoing email (header-injection prevention). When touching this file, preserve these rather than simplifying them away, and keep error responses generic (no stack traces / internals to the client — see the centralized error handler at the bottom of the file).

`assets/hero.png` and `assets/section1–4.png` are layout references (screenshots of the inspiration site), not used by the site itself.
