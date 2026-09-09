(() => {
  'use strict';

  // ---------- Photo data ----------
  // Paths point at assets/photos/. Ratios (width/height) drive the justified gallery layout.

  // The gallery is grouped into one carousel row per photoshoot session,
  // rendered in this order. Every image in a session appears, in filename
  // order — each row scrolls horizontally rather than wrapping/stretching,
  // so every photo keeps its true aspect ratio (no cropped faces).
  // `tag` drives the Solo/Family filter (independent of the per-session
  // grouping/labels above), so multiple sessions can share a filter tag.
  const SESSIONS = [
    {
      key: 'amrita',
      label: 'Amrita',
      tag: 'solo',
      images: [
        { src: 'assets/photos/amrita1.JPG', ratio: 0.666 },
        { src: 'assets/photos/amrita2.JPG', ratio: 1.501 },
        { src: 'assets/photos/amrita3.JPG', ratio: 0.666 },
        { src: 'assets/photos/amrita4.JPG', ratio: 0.666 },
        { src: 'assets/photos/amrita5.JPG', ratio: 0.667 },
      ],
    },
    {
      key: 'family',
      label: 'Family',
      tag: 'family',
      images: [
        { src: 'assets/photos/family1.JPG', ratio: 0.667 },
        { src: 'assets/photos/family2.JPG', ratio: 1.5 },
        { src: 'assets/photos/family3.JPG', ratio: 0.667 },
        { src: 'assets/photos/family4.JPG', ratio: 0.667 },
        { src: 'assets/photos/family5.JPG', ratio: 1.5 },
        { src: 'assets/photos/family6.JPG', ratio: 0.667 },
        { src: 'assets/photos/family7.JPG', ratio: 1.5 },
      ],
    },
    {
      key: 'jocelyn',
      label: 'Jocelyn',
      tag: 'solo',
      images: [
        { src: 'assets/photos/jocelyn1.jpg', ratio: 1.5 },
        { src: 'assets/photos/jocelyn2.jpg', ratio: 0.667 },
        { src: 'assets/photos/jocelyn3.jpg', ratio: 0.667 },
        { src: 'assets/photos/jocelyn4.jpg', ratio: 1.5 },
      ],
    },
    {
      key: 'steven',
      label: 'Steven',
      tag: 'solo',
      images: [
        { src: 'assets/photos/steven1.jpg', ratio: 1.5 },
        { src: 'assets/photos/steven2.jpg', ratio: 0.667 },
        { src: 'assets/photos/steven3.jpg', ratio: 1.5 },
      ],
    },
  ];

  // Flat view of every gallery image in display order — drives the lightbox.
  const GALLERY_IMAGES = SESSIONS.flatMap(({ key, images }) =>
    images.map((img) => ({ ...img, category: key }))
  );

  const SESSION_LABELS = Object.fromEntries(SESSIONS.map(({ key, label }) => [key, label]));

  // TODO: replace with the real deployed API origin (must be HTTPS) once the
  // contact-form API is hosted — keep this in sync with connect-src in vercel.json.
  const CONTACT_ENDPOINT = ['localhost', '127.0.0.1'].includes(location.hostname)
    ? 'http://localhost:3001/api/contact'
    : 'https://snowbell-photo.onrender.com/api/contact';

  // ---------- Helpers ----------
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  // ---------- Render: Gallery (grouped by photoshoot session) ----------
  let galleryItemEls = [];
  let galleryBlockEls = [];

  function renderGallery() {
    const grid = $('#galleryGrid');
    galleryItemEls = [];
    galleryBlockEls = [];
    let flatIndex = 0;

    SESSIONS.forEach(({ label, tag, images }) => {
      const block = document.createElement('div');
      block.className = 'gallery-block';
      block.dataset.tag = tag;

      const rowGroup = document.createElement('div');
      rowGroup.className = 'gallery-row-group';

      images.forEach(({ src, ratio }) => {
        const index = flatIndex++;
        const div = document.createElement('div');
        div.className = 'gallery-item';
        // Fixed row height + width from the image's own ratio — no flex-grow
        // stretching, so every photo keeps its true aspect ratio (never
        // distorted into a crop that cuts off faces).
        div.style.width = `calc(var(--row-h) * ${ratio})`;

        const img = document.createElement('img');
        img.src = src;
        img.alt = `Snow Bell Photo — ${label} session`;
        img.loading = 'lazy';

        div.appendChild(img);
        div.addEventListener('click', () => openLightbox(index));
        rowGroup.appendChild(div);
        galleryItemEls.push(div);
      });

      block.appendChild(rowGroup);
      grid.appendChild(block);
      galleryBlockEls.push(block);
    });

    observeFadeIn();
  }

  function observeFadeIn() {
    if (!('IntersectionObserver' in window)) {
      galleryItemEls.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            obs.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -5% 0px', threshold: 0.05 }
    );
    galleryItemEls.forEach((el) => io.observe(el));
  }

  // ---------- Menu overlay ----------
  function initMenu() {
    const toggle = $('#menuToggle');
    const menu = $('#siteMenu');
    let lastFocused = null;

    function openMenu() {
      lastFocused = document.activeElement;
      menu.classList.add('is-open');
      menu.setAttribute('aria-hidden', 'false');
      toggle.setAttribute('aria-expanded', 'true');
      $('a', menu)?.focus();
      document.body.style.overflow = 'hidden';
    }

    function closeMenu() {
      menu.classList.remove('is-open');
      menu.setAttribute('aria-hidden', 'true');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      if (lastFocused) lastFocused.focus();
    }

    toggle.addEventListener('click', () => {
      const isOpen = menu.classList.contains('is-open');
      isOpen ? closeMenu() : openMenu();
    });

    $$('a[data-menu-link]', menu).forEach((a) => {
      a.addEventListener('click', closeMenu);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) closeMenu();
    });

    // simple focus trap
    menu.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const focusables = $$('a', menu);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  // ---------- Header height sync ----------
  // Keeps --header-h equal to the fixed header's real rendered height, so
  // the gallery's top padding always clears it exactly (see .work in
  // styles.css), even as logo/text sizing changes across breakpoints.
  function syncHeaderHeight() {
    const header = $('.site-header');
    const setHeight = () => {
      document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`);
    };
    setHeight();
    window.addEventListener('resize', setHeight);
  }

  // ---------- Scroll progress ----------
  function initScrollProgress() {
    const bar = $('#scrollProgress');
    function update() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      bar.style.width = `${Math.min(pct, 100)}%`;
    }
    document.addEventListener('scroll', update, { passive: true });
    update();
  }

  // ---------- Filter ----------
  function initFilter() {
    const toggleBtn = $('#filterToggle');
    const options = $('#filterOptions');

    toggleBtn.addEventListener('click', () => {
      const isOpen = !options.hidden;
      options.hidden = isOpen;
      toggleBtn.setAttribute('aria-expanded', String(!isOpen));
    });

    $$('.filter-btn', options).forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('.filter-btn', options).forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        const filter = btn.dataset.filter;
        galleryBlockEls.forEach((block) => {
          const match = filter === 'all' || block.dataset.tag === filter;
          block.classList.toggle('is-hidden', !match);
        });
      });
    });
  }

  // ---------- Lightbox ----------
  let currentLightboxIndex = 0;

  function initLightbox() {
    $('#lightboxClose').addEventListener('click', closeLightbox);
    $('#lightboxPrev').addEventListener('click', () => stepLightbox(-1));
    $('#lightboxNext').addEventListener('click', () => stepLightbox(1));

    $('#lightbox').addEventListener('click', (e) => {
      if (e.target.id === 'lightbox') closeLightbox();
    });

    document.addEventListener('keydown', (e) => {
      const lb = $('#lightbox');
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') stepLightbox(-1);
      if (e.key === 'ArrowRight') stepLightbox(1);
    });
  }

  function openLightbox(index) {
    currentLightboxIndex = index;
    updateLightboxImage();
    const lb = $('#lightbox');
    lb.classList.add('is-open');
    lb.setAttribute('aria-hidden', 'false');
  }

  function closeLightbox() {
    const lb = $('#lightbox');
    lb.classList.remove('is-open');
    lb.setAttribute('aria-hidden', 'true');
  }

  function stepLightbox(delta) {
    currentLightboxIndex =
      (currentLightboxIndex + delta + GALLERY_IMAGES.length) % GALLERY_IMAGES.length;
    updateLightboxImage();
  }

  function updateLightboxImage() {
    const { src, category } = GALLERY_IMAGES[currentLightboxIndex];
    const label = SESSION_LABELS[category];
    const img = $('#lightboxImg');
    img.src = src;
    img.alt = `Snow Bell Photo — ${label} session, enlarged`;
    $('#lightboxCaption').textContent = label;
  }

  // ---------- Contact form ----------
  function initContactForm() {
    const form = $('#contactForm');
    const status = $('#formStatus');
    const submitBtn = $('#submitBtn');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      status.textContent = '';
      status.className = 'form-status';

      const data = {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        subject: form.subject.value,
        message: form.message.value.trim(),
        website: form.website.value, // honeypot — must stay empty
      };

      if (!data.name || !data.email || !data.subject || !data.message) {
        setStatus('Please fill in all fields.', true);
        return;
      }
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(data.email)) {
        setStatus('Please enter a valid email address.', true);
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';

      try {
        const res = await fetch(CONTACT_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        if (res.ok) {
          setStatus('Thanks — your inquiry has been sent. We’ll be in touch soon.', false);
          form.reset();
        } else if (res.status === 429) {
          setStatus('Too many requests — please try again in a few minutes.', true);
        } else {
          const body = await res.json().catch(() => ({}));
          setStatus(body.error || 'Something went wrong. Please try again.', true);
        }
      } catch (err) {
        setStatus('Network error — please check your connection and try again.', true);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Inquiry';
      }
    });

    function setStatus(msg, isError) {
      status.textContent = msg;
      status.classList.add(isError ? 'is-error' : 'is-success');
    }
  }

  // ---------- Init ----------
  document.addEventListener('DOMContentLoaded', () => {
    renderGallery();
    initMenu();
    syncHeaderHeight();
    initScrollProgress();
    initFilter();
    initLightbox();
    initContactForm();
    $('#year').textContent = new Date().getFullYear();
  });
})();
