// <photo-gallery> — a generic, reusable wrapper for a set of slotted photo
// rows. It owns only: (1) the overall column layout of its rows, (2)
// dispatching a `photo-select` event when a photo is clicked, and (3) fading
// items in as they scroll into view.
//
// Everything about how a row/item actually looks (.gallery-block,
// .gallery-row-group, .gallery-item, .gallery-item img) stays in the page's
// global css/styles.css and keeps targeting those same classes on the
// slotted (light-DOM) children — `::slotted()` can only style a slotted
// element itself, never its descendants, so that CSS can't move in here.
//
// The host's own styling (css/photo-gallery.css) is loaded via <link> rather
// than an inline <style>, because the site's CSP has no 'unsafe-inline' for
// style-src — an inline <style> injected via innerHTML gets silently
// blocked by the browser even inside a shadow root.
class PhotoGallery extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <link rel="stylesheet" href="css/photo-gallery.css">
      <slot></slot>
    `;
    this._observedItems = new WeakSet();
  }

  connectedCallback() {
    this.addEventListener('click', this._onClick);
    const slot = this.shadowRoot.querySelector('slot');
    slot.addEventListener('slotchange', this._onSlotChange);
    this._onSlotChange();
  }

  disconnectedCallback() {
    this.removeEventListener('click', this._onClick);
  }

  _onClick = (e) => {
    const item = e.target.closest('.gallery-item');
    if (!item || !this.contains(item)) return;
    const index = this._items().indexOf(item);
    this.dispatchEvent(
      new CustomEvent('photo-select', {
        bubbles: true,
        composed: true,
        detail: { index },
      })
    );
  };

  _onSlotChange = () => {
    this._items().forEach((item) => {
      if (this._observedItems.has(item)) return;
      this._observedItems.add(item);
      this._observeFadeIn(item);
    });
  };

  _items() {
    return Array.from(this.querySelectorAll('.gallery-item'));
  }

  _observeFadeIn(item) {
    if (!('IntersectionObserver' in window)) {
      item.classList.add('is-visible');
      return;
    }
    if (!this._io) {
      this._io = new IntersectionObserver(
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
    }
    this._io.observe(item);
  }
}

customElements.define('photo-gallery', PhotoGallery);
