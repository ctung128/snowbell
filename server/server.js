require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const PORT = process.env.PORT || 3001;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:5500';
const CONTACT_TO_EMAIL = process.env.CONTACT_TO_EMAIL;
// Resend's sandbox sender — swap for an address on your own verified domain
// once you have one (see https://resend.com/docs/dashboard/domains/introduction).
const CONTACT_FROM_EMAIL = process.env.CONTACT_FROM_EMAIL || 'onboarding@resend.dev';
const RESEND_API_KEY = process.env.RESEND_API_KEY;

if (!CONTACT_TO_EMAIL) {
  console.warn('[warn] CONTACT_TO_EMAIL is not set — inquiries have nowhere to be delivered.');
}
if (!RESEND_API_KEY) {
  console.warn('[warn] RESEND_API_KEY is not set — inquiries cannot be delivered.');
}

const app = express();

// Needed for correct client IPs (and therefore correct rate limiting) behind
// a reverse proxy such as Render/Railway/Fly.io/Nginx.
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: ALLOWED_ORIGIN,
    methods: ['POST'],
  })
);
// Small body limit: this endpoint only ever needs a short contact form payload.
app.use(express.json({ limit: '10kb' }));

const contactLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

// Strips CR/LF so form input can never inject extra headers/body into the outgoing email.
function stripHeaderInjection(value) {
  return String(value).replace(/[\r\n]+/g, ' ').trim();
}

const ALLOWED_SUBJECTS = ['Portrait', 'Family', 'Graduation', 'Other'];

const contactValidators = [
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Name is required.'),
  body('email').trim().isEmail().normalizeEmail().withMessage('A valid email is required.'),
  body('subject').trim().isIn(ALLOWED_SUBJECTS).withMessage('Invalid session type.'),
  body('message').trim().isLength({ min: 1, max: 2000 }).withMessage('Message is required.'),
  // Honeypot: real visitors never see or fill this field.
  body('website').custom((value) => !value).withMessage('Spam detected.'),
];

// Sends via Resend's HTTPS API rather than raw SMTP. Some hosts (Render's
// free/starter tiers included) block outbound SMTP ports as an anti-spam
// measure — confirmed here by a request that hung the full connection
// timeout with no response, even to a verified, directly-pinned IPv4
// address. Sending over plain HTTPS sidesteps that entirely.
async function sendContactEmail({ name, email, subject, message }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: CONTACT_FROM_EMAIL,
      to: CONTACT_TO_EMAIL,
      reply_to: email,
      subject: `[Snow Bell Photo] New inquiry — ${subject}`,
      text: `Name: ${name}\nEmail: ${email}\nSession type: ${subject}\n\n${message}`,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Resend API responded ${res.status}: ${detail}`);
  }
}

app.post('/api/contact', contactLimiter, contactValidators, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Honeypot failures are rejected silently as generic errors — no need to
    // tell a bot exactly why it was caught.
    return res.status(400).json({ error: 'Please check your form and try again.' });
  }

  const name = stripHeaderInjection(req.body.name);
  const email = stripHeaderInjection(req.body.email);
  const subject = stripHeaderInjection(req.body.subject);
  const message = String(req.body.message).slice(0, 2000);

  if (!CONTACT_TO_EMAIL || !RESEND_API_KEY) {
    return res.status(500).json({ error: 'Contact form is not configured yet.' });
  }

  try {
    await sendContactEmail({ name, email, subject, message });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Failed to send contact email:', err.message);
    return res.status(500).json({ error: 'Could not send your message. Please try again later.' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Centralized error handler — never leak stack traces or internals to the client.
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || err.statusCode;
  // Pass through well-known client-error statuses (e.g. 413 payload too large,
  // 400 malformed JSON) with a generic message; anything else collapses to 500.
  if (status && status >= 400 && status < 500) {
    return res.status(status).json({ error: 'Invalid request.' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Snow Bell Photo contact API listening on port ${PORT}`);
});
