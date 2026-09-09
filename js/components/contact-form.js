// <contact-form endpoint="https://..."> — a generic, reusable contact form.
// Session-type options are declared as light-DOM <option slot="subjects">
// children (kept in sync with server.js's ALLOWED_SUBJECTS, same as the
// plain <select> did before this was componentized) and cloned into this
// component's own shadow-owned <select> in JS, rather than relying on
// native <select> support for slotted <option>s — that isn't reliably
// rendered across browsers (Safari/Firefox in particular), so this avoids a
// silent, hard-to-notice cross-browser bug in the subject dropdown.
class ContactForm extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host { display: block; }

        .field {
          margin-bottom: 1.25rem;
          display: flex;
          flex-direction: column;
        }

        label {
          font-size: 0.75rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 0.4rem;
          color: var(--color-muted);
        }

        input,
        select,
        textarea {
          font-family: var(--font-sans);
          font-size: 1rem;
          padding: 0.65rem 0.75rem;
          border: 1px solid var(--color-border);
          background: #fff;
          border-radius: 2px;
        }

        input:focus,
        select:focus,
        textarea:focus {
          outline: 2px solid var(--color-accent);
          outline-offset: 1px;
        }

        .honeypot {
          position: absolute;
          left: -9999px;
          width: 1px;
          height: 1px;
          overflow: hidden;
        }

        .submit-btn {
          width: 100%;
          padding: 0.9rem;
          background: var(--color-text);
          color: #fff;
          border: none;
          font-family: var(--font-sans);
          font-size: 0.85rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          cursor: pointer;
          transition: opacity 0.2s ease;
        }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .form-status {
          margin-top: 1rem;
          font-size: 0.85rem;
          min-height: 1.2em;
        }

        .form-status.is-error { color: #c0392b; }
        .form-status.is-success { color: #1e8a5f; }
      </style>

      <slot name="subjects" hidden></slot>

      <form novalidate>
        <div class="honeypot" aria-hidden="true">
          <label for="website">Website</label>
          <input type="text" id="website" name="website" tabindex="-1" autocomplete="off">
        </div>

        <div class="field">
          <label for="name">Name</label>
          <input type="text" id="name" name="name" required maxlength="100" autocomplete="name">
        </div>

        <div class="field">
          <label for="email">Email</label>
          <input type="email" id="email" name="email" required maxlength="150" autocomplete="email">
        </div>

        <div class="field">
          <label for="subject">Session type</label>
          <select id="subject" name="subject" required>
            <option value="">Select one</option>
          </select>
        </div>

        <div class="field">
          <label for="message">Message</label>
          <textarea id="message" name="message" rows="5" required maxlength="2000"></textarea>
        </div>

        <button type="submit" class="submit-btn">Send Inquiry</button>
        <p class="form-status" role="status" aria-live="polite"></p>
      </form>
    `;
  }

  connectedCallback() {
    this._populateSubjects();
    this._form = this.shadowRoot.querySelector('form');
    this._submitBtn = this.shadowRoot.querySelector('.submit-btn');
    this._status = this.shadowRoot.querySelector('.form-status');
    this._form.addEventListener('submit', this._onSubmit);
  }

  disconnectedCallback() {
    this._form?.removeEventListener('submit', this._onSubmit);
  }

  _populateSubjects() {
    const select = this.shadowRoot.querySelector('#subject');
    this.querySelectorAll('option[slot="subjects"]').forEach((opt) => {
      select.appendChild(opt.cloneNode(true));
    });
  }

  _setStatus(msg, isError) {
    this._status.textContent = msg;
    this._status.className = `form-status ${isError ? 'is-error' : 'is-success'}`;
  }

  _onSubmit = async (e) => {
    e.preventDefault();
    this._status.textContent = '';
    this._status.className = 'form-status';

    const form = this._form;
    const data = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      subject: form.subject.value,
      message: form.message.value.trim(),
      website: form.website.value, // honeypot — must stay empty
    };

    if (!data.name || !data.email || !data.subject || !data.message) {
      this._setStatus('Please fill in all fields.', true);
      return;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(data.email)) {
      this._setStatus('Please enter a valid email address.', true);
      return;
    }

    this._submitBtn.disabled = true;
    this._submitBtn.textContent = 'Sending…';

    try {
      const res = await fetch(this.getAttribute('endpoint'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        this._setStatus('Thanks — your inquiry has been sent. We’ll be in touch soon.', false);
        form.reset();
      } else if (res.status === 429) {
        this._setStatus('Too many requests — please try again in a few minutes.', true);
      } else {
        const body = await res.json().catch(() => ({}));
        this._setStatus(body.error || 'Something went wrong. Please try again.', true);
      }
    } catch (err) {
      this._setStatus('Network error — please check your connection and try again.', true);
    } finally {
      this._submitBtn.disabled = false;
      this._submitBtn.textContent = 'Send Inquiry';
    }
  };
}

customElements.define('contact-form', ContactForm);
