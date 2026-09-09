# Snow Bell Photo (雪玲) — Portfolio Site

A single-page photography portfolio (plain HTML/CSS/JS, no build step) with a small,
security-hardened Node/Express API that powers the contact form.

## Structure

```
index.html          Site markup
css/styles.css       All styling
js/main.js           Gallery data + all interactivity (menu, filter, lightbox, form)
assets/photos/       Web-optimized copies of the studio's real photos + logo.png
server/              Contact-form API (Express)
```

`assets/hero.png`, `assets/section1.png`–`section4.png` are layout *references* only
(screenshots of the inspiration site) — they are not used by the site and can be deleted
once you're happy with the build.

## Running the frontend locally

No build step needed. From the project root:

```bash
npx serve .
```

Open the printed local URL. (Any static file server works — `python3 -m http.server`, the
VS Code "Live Server" extension, etc.)

## Running the contact-form API locally

```bash
cd server
npm install
cp .env.example .env
# edit .env with a real Resend API key and where inquiries should be delivered
npm start
```

The frontend posts to `http://localhost:3001/api/contact` (see `CONTACT_ENDPOINT` in
`js/main.js`) — update that constant if you run the API on a different host/port.

### Email delivery (Resend)

Inquiries are sent via [Resend](https://resend.com)'s HTTPS API rather than raw SMTP —
some hosts (Render's free/starter tiers included) block outbound SMTP ports as an
anti-spam measure, which HTTPS sidesteps entirely. Sign up for a free Resend account
(100 emails/day, 3,000/month — plenty for a contact form), grab an API key, and put it
in `server/.env` as `RESEND_API_KEY`. Never commit `.env` — it's already git-ignored.

Without a verified domain, `CONTACT_FROM_EMAIL` defaults to Resend's sandbox sender
(`onboarding@resend.dev`); swap it for an address on your own domain once you've
[verified one](https://resend.com/docs/dashboard/domains/introduction) with Resend.

## Security measures already built in (contact API)

- Server-side validation of every field (`express-validator`) — the client-side checks in
  `main.js` are a UX nicety, not the real defense.
- Rate limiting: 5 requests / 10 minutes per IP (`express-rate-limit`).
- Hidden honeypot field (`website`) — real users never see it; bots that fill every field
  get silently rejected.
- CORS locked to a single allowed origin (`ALLOWED_ORIGIN` in `.env`), not `*`.
- Security headers via `helmet` (CSP, `X-Content-Type-Options`, etc.).
- Request body capped at 10kb to blunt oversized-payload abuse.
- CR/LF stripped from all fields before they're used in the outgoing email, preventing
  email header injection.
- Secrets (the Resend API key) only ever live in environment variables, never in the
  frontend bundle or git history.
- Generic error responses — no stack traces or internals sent to the client.

Before going live, also run `npm audit` in `server/` and keep dependencies patched.

## Deploying

- **Frontend**: any static host — Netlify, Vercel, GitHub Pages, Cloudflare Pages.
- **API**: any small Node host with HTTPS — Render, Railway, Fly.io. Set the environment
  variables from `.env.example` in the host's dashboard (never in code). Update
  `ALLOWED_ORIGIN` to the frontend's real deployed URL, and `CONTACT_ENDPOINT` in
  `js/main.js` to the API's real deployed URL.

## Customizing

- **Branding/copy**: studio name, tagline, and about/contact text live directly in
  `index.html` — search for "Snow Bell Photo" and the `about-text` paragraph.
- **Gallery photos/sessions**: edit `SESSIONS` at the top of `js/main.js`. The gallery
  renders one horizontally-scrolling carousel row per entry in `SESSIONS` (currently
  Amrita / Family / Jocelyn / Steven), in the order listed, with every image in its
  filename order and no visible heading above the row. Each image needs a `ratio`
  (width ÷ height) — the row renders it at that exact aspect ratio (fixed height, natural
  width), so photos are never stretched or cropped into the wrong shape. Get the `ratio`
  wrong (e.g. using a landscape ratio for a portrait photo) and the crop will be badly off.
  Each session also needs a `tag` (`solo` or `family`) that drives the Solo/Family filter
  in the bottom-left FILTER panel — multiple sessions can share a tag (Amrita, Jocelyn,
  and Steven are all tagged `solo`). To add a session, add an object with a `key`,
  `label`, `tag`, and `images` array; `label` is only used for accessibility text (image
  `alt` and the lightbox caption). If the session introduces a new tag, also add a
  `.filter-btn` (with `data-filter` set to that tag) inside `#filterOptions` in
  `index.html`.
