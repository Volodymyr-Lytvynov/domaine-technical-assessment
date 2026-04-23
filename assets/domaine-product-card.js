/**
 * <domaine-product-card>
 *
 * Vanilla custom element backing the Domaine product card. Server-rendered
 * Liquid provides the initial HTML; this element takes over on the client to
 * swap imagery, pricing, and the sale badge when a swatch is selected without
 * triggering a page load. The hover crossfade between primary and secondary
 * images is handled entirely in CSS (group-hover opacity) for performance.
 *
 * Data contract (the `data-product` attribute):
 *   {
 *     id: number,
 *     url: string,
 *     variants: Array<{
 *       id: number,
 *       url: string,
 *       available: boolean,
 *       price: number,               // in cents
 *       compare_at_price: number|null,
 *       option1: string|null,
 *       option2: string|null,
 *       option3: string|null,
 *       featured_image: string|null,
 *       hover_image: string|null
 *     }>
 *   }
 */
(function () {
  'use strict';

  /**
   * Formats a Shopify price (in cents) using the storefront currency format
   * exposed on window.Shopify.currency. Falls back to USD with two decimals so
   * this element keeps working in design mode / preview contexts where that
   * global may not be populated yet.
   *
   * @param {number} cents
   * @returns {string}
   */
  function formatMoney(cents) {
    if (typeof cents !== 'number') return '';
    const amount = (cents / 100).toFixed(2);
    const code =
      (window.Shopify && window.Shopify.currency && window.Shopify.currency.active) || 'USD';

    try {
      return new Intl.NumberFormat(document.documentElement.lang || 'en-US', {
        style: 'currency',
        currency: code,
      }).format(cents / 100);
    } catch (_err) {
      return `$${amount}`;
    }
  }

  /**
   * Swaps the `src` on an `<img>` without a visible flash by pre-decoding the
   * replacement. Falls back to a direct assignment if `decode()` rejects.
   *
   * @param {HTMLImageElement | null | undefined} img
   * @param {string | null} nextSrc
   */
  function swapImage(img, nextSrc) {
    if (!img) return;
    if (!nextSrc) {
      img.removeAttribute('src');
      img.classList.add('dm-hidden');
      return;
    }
    if (img.getAttribute('src') === nextSrc) return;

    img.classList.remove('dm-hidden');
    const preload = new Image();
    preload.src = nextSrc;
    const assign = () => {
      img.src = nextSrc;
    };
    if (typeof preload.decode === 'function') {
      preload.decode().then(assign).catch(assign);
    } else {
      preload.onload = assign;
      preload.onerror = assign;
    }
  }

  class DomaineProductCard extends HTMLElement {
    constructor() {
      super();
      /** @type {null | ReturnType<DomaineProductCard["parseProduct"]>} */
      this.product = null;
    }

    connectedCallback() {
      this.product = this.parseProduct();
      if (!this.product) return;

      this.primaryImage = /** @type {HTMLImageElement | null} */ (
        this.querySelector('[data-primary-image]')
      );
      this.hoverImage = /** @type {HTMLImageElement | null} */ (
        this.querySelector('[data-hover-image]')
      );
      this.priceWrapper = /** @type {HTMLElement | null} */ (
        this.querySelector('[data-price-wrapper]')
      );
      this.saleBadge = /** @type {HTMLElement | null} */ (
        this.querySelector('[data-sale-badge]')
      );
      this.cardLink = /** @type {HTMLAnchorElement | null} */ (
        this.querySelector('[data-card-link]')
      );
      this.titleLink = /** @type {HTMLAnchorElement | null} */ (
        this.querySelector('[data-title-link]')
      );
      this.swatchGroup = /** @type {HTMLElement | null} */ (
        this.querySelector('[data-swatches]')
      );

      this.onSwatchClick = this.onSwatchClick.bind(this);
      if (this.swatchGroup) {
        this.swatchGroup.addEventListener('click', this.onSwatchClick);
      }
    }

    disconnectedCallback() {
      if (this.swatchGroup) {
        this.swatchGroup.removeEventListener('click', this.onSwatchClick);
      }
    }

    /**
     * Parses the embedded product JSON. Returns null when the payload is
     * missing or malformed so the element degrades gracefully to the static
     * server-rendered markup.
     */
    parseProduct() {
      const raw = this.getAttribute('data-product');
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch (_err) {
        return null;
      }
    }

    /**
     * @param {Event} event
     */
    onSwatchClick(event) {
      const target = event.target instanceof Element ? event.target.closest('[data-swatch]') : null;
      if (!(target instanceof HTMLElement)) return;

      const variantId = Number(target.dataset.variantId);
      if (!variantId || !this.product) return;

      const variant = this.product.variants.find(
        (/** @type {{ id: number }} */ v) => v.id === variantId
      );
      if (!variant) return;

      this.selectSwatch(target);
      this.applyVariant(variant);
    }

    /**
     * Marks the clicked swatch as aria-checked and clears the flag on siblings.
     *
     * @param {HTMLElement} selected
     */
    selectSwatch(selected) {
      if (!this.swatchGroup) return;
      const all = this.swatchGroup.querySelectorAll('[data-swatch]');
      all.forEach((node) => {
        const isSelected = node === selected;
        node.setAttribute('aria-checked', String(isSelected));
        node.classList.toggle('dm-ring-1', isSelected);
        node.classList.toggle('dm-ring-ink', isSelected);
      });
    }

    /**
     * Applies a variant's data to the card: imagery, pricing, sale badge,
     * availability, and the product URL used by the image/title links.
     *
     * @param {{
     *   id: number,
     *   url: string,
     *   available: boolean,
     *   price: number,
     *   compare_at_price: number|null,
     *   featured_image: string|null,
     *   hover_image: string|null,
     * }} variant
     */
    applyVariant(variant) {
      swapImage(this.primaryImage, variant.featured_image);
      swapImage(this.hoverImage, variant.hover_image || variant.featured_image);

      if (this.cardLink) this.cardLink.href = variant.url;
      if (this.titleLink) this.titleLink.href = variant.url;

      this.renderPrice(variant);
      this.renderSaleBadge(variant);
    }

    /**
     * @param {{ price: number, compare_at_price: number|null, available: boolean }} variant
     */
    renderPrice(variant) {
      if (!this.priceWrapper) return;
      const onSale =
        variant.compare_at_price != null && variant.compare_at_price > variant.price;

      const parts = ['<div class="dm-flex dm-items-center dm-gap-2 dm-text-sm">'];

      if (onSale && variant.compare_at_price != null) {
        parts.push(
          `<span class="dm-text-ink dm-line-through">${formatMoney(variant.compare_at_price)}</span>`,
          `<span class="dm-text-sale">${formatMoney(variant.price)}</span>`
        );
      } else {
        parts.push(`<span class="dm-text-ink">${formatMoney(variant.price)}</span>`);
      }

      if (!variant.available) {
        parts.push('<span class="dm-text-ink/60">Sold out</span>');
      }

      parts.push('</div>');
      this.priceWrapper.innerHTML = parts.join('');
    }

    /**
     * @param {{ price: number, compare_at_price: number|null }} variant
     */
    renderSaleBadge(variant) {
      if (!this.saleBadge) return;
      const onSale =
        variant.compare_at_price != null && variant.compare_at_price > variant.price;
      this.saleBadge.classList.toggle('dm-hidden', !onSale);
    }
  }

  if (!customElements.get('domaine-product-card')) {
    customElements.define('domaine-product-card', DomaineProductCard);
  }
})();
