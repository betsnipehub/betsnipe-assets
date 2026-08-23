/*!
 * BetSnipe - PWA install capture
 * v1.0.0
 *
 * Tiny companion to betsnipe-app-v3.js. Load it from a <script> tag at the TOP
 * of the app-page HTML block, above all the markup:
 *
 *   <script src=".../betsnipe-pwa-capture.js?v=1"></script>
 *
 * Chromium fires `beforeinstallprompt` once per page load, and only while
 * nothing has consumed it. This file exists purely to have that listener in
 * place as early as the CMS allows - it is ~1KB, so it lands well before the
 * main script finishes fetching and parsing, and it still works if the main
 * file is slow or blocked by an ad blocker.
 *
 * It writes the same globals the main script reads (`window.__bsBIP`), and
 * whichever runs first wins; the other becomes a no-op. Loading this is
 * optional - the main script captures the event too, just later.
 *
 * Note this cannot beat the CMS itself: the app-page block is injected around
 * 1s into the page load, so nothing loaded from inside it can catch an event
 * that fired earlier. To close that gap the file has to load site wide.
 */
(function () {
  "use strict";

  if (window.__bsBIPBound) return;
  window.__bsBIPBound = true;

  window.__bsCaptureLoaded = true;
  window.__bsBIP = window.__bsBIP || null;

  window.addEventListener("beforeinstallprompt", function (event) {
    // Suppress Chrome's mini-infobar; the app page drives the UI itself.
    event.preventDefault();
    window.__bsBIP = event;

    // Its arrival proves the app is not installed - drop a stale flag.
    try {
      window.localStorage.removeItem("bs_pwa_installed");
    } catch (e) {}

    try {
      window.dispatchEvent(new CustomEvent("bs:installable"));
    } catch (e) {}
  });

  window.addEventListener("appinstalled", function () {
    window.__bsBIP = null;

    try {
      window.localStorage.setItem("bs_pwa_installed", "1");
      window.dispatchEvent(new CustomEvent("bs:installed"));
    } catch (e) {}
  });
})();
