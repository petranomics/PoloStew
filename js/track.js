/**
 * PoloStew lightweight analytics tracker.
 *
 * Sends events to /api/track. No external services, no cookies — uses
 * sessionStorage for a per-tab session id. Designed to be tiny (~3KB),
 * fail-silent, and not block page rendering.
 *
 * Auto-fires on load:
 *   - pageview
 * Hooks itself into:
 *   - window.cart.addToCart  -> add_to_cart
 *   - clicks on .checkout-btn / [data-checkout-btn] -> checkout_start
 *
 * To track manually:
 *   window.ptrack('custom_event', { ...payload })
 */
(function () {
  'use strict';

  if (window.__ptrackInited) return;
  window.__ptrackInited = true;

  var ENDPOINT = '/api/track';
  var SESSION_KEY = 'polostew_session_id';

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'sess-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function getSessionId() {
    try {
      var id = sessionStorage.getItem(SESSION_KEY);
      if (!id) {
        id = uid();
        sessionStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch (e) {
      return uid();
    }
  }

  function send(event, extra) {
    try {
      var payload = {
        event: event,
        path: location.pathname + location.search,
        sessionId: getSessionId(),
        referrer: document.referrer || '',
        userAgent: navigator.userAgent || '',
        ts: Date.now()
      };
      if (extra && typeof extra === 'object') {
        for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) payload[k] = extra[k];
      }
      var body = JSON.stringify(payload);
      var url = ENDPOINT;
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: 'application/json' });
        if (navigator.sendBeacon(url, blob)) return;
      }
      // Fallback to fetch with keepalive
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true
      }).catch(function () {});
    } catch (e) { /* swallow */ }
  }

  window.ptrack = send;

  // Pageview on load
  function firePageview() { send('pageview'); }
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(firePageview, 0);
  } else {
    document.addEventListener('DOMContentLoaded', firePageview);
  }

  // Hook into cart.addToCart once cart is ready
  function hookCart() {
    if (!window.cart || typeof window.cart.addToCart !== 'function') return false;
    if (window.cart.__ptrackHooked) return true;
    var orig = window.cart.addToCart.bind(window.cart);
    window.cart.addToCart = function (product) {
      try {
        send('add_to_cart', {
          productId: product && product.id ? String(product.id) : '',
          value: product && product.price ? Number(product.price) : 0,
          name: product && product.name ? product.name : ''
        });
      } catch (e) {}
      return orig(product);
    };
    window.cart.__ptrackHooked = true;
    return true;
  }
  if (!hookCart()) {
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (hookCart() || tries > 25) clearInterval(iv);
    }, 200);
  }

  // Checkout button clicks (delegated)
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    while (t && t !== document.body) {
      if (t.classList && (t.classList.contains('checkout-btn') || t.hasAttribute('data-checkout-btn'))) {
        var total = 0;
        try {
          if (window.cart && typeof window.cart.getTotal === 'function') total = window.cart.getTotal();
        } catch (e) {}
        send('checkout_start', { value: total });
        return;
      }
      t = t.parentNode;
    }
  }, true);
})();
