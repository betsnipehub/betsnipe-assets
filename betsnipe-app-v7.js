/*!
 * BetSnipe - App page controller
 * v3.0.0
 *
 *  1. OS switcher (iOS / Android) + mobile carousel   [carried over from v2]
 *  2. PWA install: platform detection + install popup + native browser prompt
 *
 * The origin already ships everything a PWA needs, so no Angular changes are
 * required:
 *   manifest : /favicon/site.webmanifest  (scope "/", display "fullscreen")
 *   worker   : /ngsw-worker.js            (scope "/", registered on mobile)
 * Because of that, Chromium fires `beforeinstallprompt` and we can call the
 * real native install dialog. iOS has no such API, so it gets guided steps.
 *
 * WHERE TO LOAD THIS
 * Preferably once, site wide, in <head> (defer is fine):
 *
 *   <script defer src=".../betsnipe-app-v3.js?v=2"></script>
 *
 * Chromium fires `beforeinstallprompt` once per page load, and only while no
 * listener has consumed it. The whole site is one Angular app, so a visitor
 * who lands on the homepage and then routes to /app has already passed that
 * moment - a script tag that only exists inside the app-page block never sees
 * the event, and those visitors drop to manual steps instead of the one-tap
 * installer. Loading site wide fixes that.
 *
 * It is safe on every page: nothing renders and no popup is scheduled until
 * the #betsnipe-app-page block is present, it leaves no permanent timers, and
 * it re-binds itself when the SPA routes into the app page later on.
 *
 * Loading it from the app-page block instead still works - only the Android
 * one-tap path degrades.
 */
(function () {
  "use strict";

  var VERSION = "7.0.0";

  /* ------------------------------------------------------------------ *
   * 0. Re-entry guard
   *    The CMS re-inserts this <script> on every SPA navigation to the
   *    app page, which re-executes the file. Re-bind instead of stacking
   *    duplicate listeners, timers and overlays.
   * ------------------------------------------------------------------ */
  if (window.__betsnipeApp && window.__betsnipeApp.version === VERSION) {
    window.__betsnipeApp.boot();
    return;
  }

  /* ------------------------------------------------------------------ *
   * 1. beforeinstallprompt capture
   *    Registered before anything else in this file. Chromium fires the
   *    event once per page load, and only while nothing has consumed it,
   *    so the listener has to exist before the event arrives. The same
   *    globals are written by the optional <head> stub, whichever runs
   *    first wins and the other is a no-op.
   * ------------------------------------------------------------------ */
  // The WLC platform registers its OWN beforeinstallprompt listener in an
  // inline <head> script and parks the event on `window.pwaPrompt`:
  //
  //   window.addEventListener("beforeinstallprompt", function (e) {
  //     e.preventDefault(); window.pwaPrompt = e;
  //   });
  //
  // That runs during head parsing - earlier than anything we can load - and on
  // every real page load site wide. So it is both the most reliable source of
  // the event and the reason the soft-navigation problem solves itself: the
  // event is captured on the landing page and `window.pwaPrompt` lives for the
  // whole document, which in a SPA means it is still in hand at /app.
  function getPrompt() {
    return window.__bsBIP || window.pwaPrompt || null;
  }

  function setPrompt(event) {
    window.__bsBIP = event || null;

    // A prompt can only be used once. Clear the platform's copy too, or we
    // would hand a spent event back on the next call.
    if (!event) {
      try {
        window.pwaPrompt = null;
      } catch (e) {}
    }
  }

  function promptSource() {
    if (window.__bsBIP) return "own-listener";
    if (window.pwaPrompt) return "platform (window.pwaPrompt)";
    return "none";
  }

  // Our own listener may never fire - if the platform's inline listener got
  // there first, or if the event fired before this file loaded. Nothing would
  // then tell the auto-show that an install is possible, so it would wait
  // forever. Poll for a prompt from any source and announce it once.
  var announcedInstallable = false;

  function announceInstallable() {
    if (announcedInstallable) return false;
    if (!getPrompt()) return false;

    announcedInstallable = true;

    try {
      window.dispatchEvent(new CustomEvent("bs:installable"));
    } catch (e) {}

    return true;
  }

  function watchForPrompt() {
    if (announceInstallable()) return;

    var tries = 0;
    var timer = setInterval(function () {
      tries++;

      if (announceInstallable() || tries > 60) clearInterval(timer);
    }, 300);
  }

  if (!window.__bsBIPBound) {
    window.__bsBIPBound = true;

    window.addEventListener("beforeinstallprompt", function (event) {
      // Suppress Chrome's own mini-infobar; we drive the UI ourselves.
      event.preventDefault();
      setPrompt(event);

      // Chromium never fires this for an installed app, so its arrival proves
      // the app is gone - clear a stale flag left by an earlier install.
      store.remove(KEY_INSTALLED);

      announcedInstallable = true;

      try {
        window.dispatchEvent(new CustomEvent("bs:installable"));
      } catch (e) {}
    });

    window.addEventListener("appinstalled", function () {
      setPrompt(null);
      store.set(KEY_INSTALLED, "1");
      try {
        window.dispatchEvent(new CustomEvent("bs:installed"));
      } catch (e) {}
    });
  }

  /* ------------------------------------------------------------------ *
   * 2. Storage
   * ------------------------------------------------------------------ */
  var KEY_SNOOZE = "bs_pwa_snooze_until";
  var KEY_INSTALLED = "bs_pwa_installed";

  var store = {
    get: function (key) {
      try {
        return window.localStorage.getItem(key);
      } catch (e) {
        return null;
      }
    },
    set: function (key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch (e) {}
    },
    remove: function (key) {
      try {
        window.localStorage.removeItem(key);
      } catch (e) {}
    }
  };

  var KEY_RELOAD_ATTEMPT = "bs_pwa_reload_attempt";

  var session = {
    get: function (key) {
      try {
        return window.sessionStorage.getItem(key);
      } catch (e) {
        return null;
      }
    },
    set: function (key, value) {
      try {
        window.sessionStorage.setItem(key, value);
      } catch (e) {}
    }
  };

  /* ------------------------------------------------------------------ *
   * 3. Environment detection
   * ------------------------------------------------------------------ */
  var UA = navigator.userAgent || "";

  var env = {};

  // The decisive signal, checked before any UA sniffing: only Chromium exposes
  // the install API, and it exposes it on desktop as well as Android. If this
  // is true the browser can install natively and is definitively NOT iOS.
  env.canInstallNatively = "onbeforeinstallprompt" in window;

  // iPadOS 13+ reports a desktop Mac UA, so fall back to the touch count - but
  // only for browsers without the install API. Some Macs report
  // maxTouchPoints > 1, which used to make desktop Chrome look like an iPad
  // and served it Safari "Add to Home Screen" steps it could never use.
  env.ios =
    !env.canInstallNatively &&
    (/iPad|iPhone|iPod/.test(UA) ||
      (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1));
  env.android = /Android/i.test(UA);
  env.mobile = env.ios || env.android || /Mobile|Tablet/i.test(UA);

  // Social / messenger webviews cannot install anything at all.
  env.inAppBrowser =
    /FBAN|FBAV|FB_IAB|Instagram|Messenger|Line\/|Twitter|TikTok|Pinterest|Snapchat|WhatsApp|MicroMessenger|GSA\//i.test(
      UA
    ) || (env.android && /;\s*wv\)/i.test(UA));

  // On iOS only Safari has a dependable "Add to Home Screen" flow.
  env.iosSafari =
    env.ios &&
    !env.inAppBrowser &&
    !/CriOS|FxiOS|EdgiOS|OPiOS|OPT\//i.test(UA);

  function isInstalled() {
    // The manifest declares display:fullscreen, so an installed launch
    // reports fullscreen rather than standalone. Check every app-like mode.
    var modes = ["standalone", "fullscreen", "minimal-ui", "window-controls-overlay"];

    try {
      // A plain browser tab is never an installed launch. Checked first so
      // that a visitor who simply pressed F11 is not mistaken for one.
      if (window.matchMedia("(display-mode: browser)").matches) return false;

      if (navigator.standalone === true) return true;

      for (var i = 0; i < modes.length; i++) {
        if (window.matchMedia("(display-mode: " + modes[i] + ")").matches) {
          return true;
        }
      }
    } catch (e) {}

    return (document.referrer || "").indexOf("android-app://") === 0;
  }

  function resolveMode() {
    if (isInstalled()) return "installed";
    if (env.inAppBrowser) return "inapp";
    if (getPrompt()) return "native";

    // We installed it ourselves earlier in this browser. display-mode cannot
    // see that from a normal tab, so trust the flag we wrote at the time.
    if (store.get(KEY_INSTALLED) === "1") return "installed";

    // Chromium with no event yet: either it has not arrived or the app is
    // already installed (Chromium does not fire it for an installed app).
    // Either way, showing "Add to Home Screen" steps would be wrong, so the
    // auto-popup waits instead of guessing.
    if (env.canInstallNatively) return "pending";

    if (env.ios) return env.iosSafari ? "ios" : "ios-other";
    if (env.android) return "android-manual";
    return "desktop";
  }

  // True when this page was reached by client-side routing rather than a real
  // document load. The platform's own "DESCARREGAR A APLICACAO" menu banner is
  // an <a wlc-link="app.pwa"> with no href, so it routes - which means Chromium
  // fired `beforeinstallprompt` back on the page the visitor started from,
  // where none of our scripts existed yet. The event is gone and cannot be
  // re-requested; only a real page load produces another one.
  function arrivedViaSoftNav() {
    try {
      var nav = performance.getEntriesByType("navigation")[0];

      if (!nav || !nav.name) return false;

      return new URL(nav.name).pathname !== location.pathname;
    } catch (e) {
      return false;
    }
  }

  // Reload once to get a fresh page load, and with it a fresh install event.
  // Guarded three ways so it can never loop: only after a soft navigation
  // (a reload makes that false), only once per session per path, and never
  // when the app is already installed.
  function recoverEventByReload() {
    if (!env.canInstallNatively) return false;
    if (getPrompt()) return false;
    if (isInstalled() || store.get(KEY_INSTALLED) === "1") return false;
    if (!arrivedViaSoftNav()) return false;
    if (session.get(KEY_RELOAD_ATTEMPT) === location.pathname) return false;

    session.set(KEY_RELOAD_ATTEMPT, location.pathname);
    log("soft navigation lost the install event - reloading once to recover");

    location.reload();

    return true;
  }

  // What to show when the visitor asks *explicitly* via the CTA. "pending" is
  // not a sheet, so fall back to something actionable for the platform.
  function ctaMode() {
    var mode = resolveMode();

    if (mode !== "pending") return mode;

    return env.android ? "android-manual" : "desktop";
  }

  /* ------------------------------------------------------------------ *
   * 4. Copy
   * ------------------------------------------------------------------ */
  // Resolved on every render, not once at load. This file loads site wide, so
  // the locale at script-execution time is the landing page's, not the one the
  // visitor is looking at after the SPA has routed them somewhere else.
  function localeKey() {
    var match = location.pathname.match(/^\/([a-z]{2})(?:\/|$)/i);
    var lang = (match && match[1]) || document.documentElement.lang || "en";

    return lang.slice(0, 2).toLowerCase() === "pt" ? "pt" : "en";
  }

  var COPY = {
    en: {
      ctaLabel: "Install the app",
      close: "Close",
      copied: "Link copied",
      brandSub: "Sports & Casino",
      installing: "Opening installer...",
      modes: {
        native: {
          title: "Install the BetSnipe app",
          body: "Add BetSnipe to your home screen and open Sports & Casino in one tap.",
          primary: "Install app",
          secondary: "Not now"
        },
        ios: {
          title: "Add BetSnipe to your Home Screen",
          body: "Three quick steps in Safari:",
          steps: [
            'Tap the Share icon in the Safari toolbar.',
            'Scroll and choose "Add to Home Screen".',
            'Tap "Add" to finish.'
          ],
          primary: "Got it",
          secondary: "See full guide"
        },
        "ios-other": {
          title: "Open in Safari to install",
          body: "Adding BetSnipe to your Home Screen works from Safari. Open this page there and the Share menu will offer it.",
          primary: "Copy link",
          secondary: "Not now"
        },
        inapp: {
          title: "Open in your browser",
          body: "You are browsing inside another app, which cannot install web apps. Open this page in Chrome or Safari to continue.",
          primary: "Copy link",
          secondary: "Not now"
        },
        "android-manual": {
          title: "Add BetSnipe to your Home Screen",
          body: "Three quick steps in your browser:",
          steps: [
            "Tap the menu button in your browser.",
            'Choose "Install app" or "Add to Home screen".',
            "Confirm to finish."
          ],
          primary: "Got it",
          secondary: "See full guide"
        },
        desktop: {
          title: "Install the BetSnipe app",
          body: "Your browser can install it directly: look for the install icon in the address bar, or open the browser menu and choose \"Install BetSnipe\".",
          primary: "Got it",
          secondary: "Not now"
        },
        installed: {
          title: "The app is already installed",
          body: "BetSnipe is on your home screen. Open it any time straight from the app icon.",
          primary: "Close"
        },
        success: {
          title: "App installed",
          body: "BetSnipe is now on your home screen. Open it any time straight from the app icon.",
          primary: "Done"
        }
      }
    },
    pt: {
      ctaLabel: "Instalar a app",
      close: "Fechar",
      copied: "Link copiado",
      brandSub: "Desporto e Casino",
      installing: "A abrir o instalador...",
      modes: {
        native: {
          title: "Instala a app BetSnipe",
          body: "Adiciona a BetSnipe ao ecrã principal e abre Desporto e Casino em 1 toque.",
          primary: "Instalar app",
          secondary: "Agora não"
        },
        ios: {
          title: "Adiciona a BetSnipe ao ecrã principal",
          body: "Três passos rápidos no Safari:",
          steps: [
            "Toca no ícone Partilhar na barra do Safari.",
            'Desliza e escolhe "Adicionar ao ecrã principal".',
            'Toca em "Adicionar" para finalizar.'
          ],
          primary: "Entendi",
          secondary: "Ver guia completo"
        },
        "ios-other": {
          title: "Abre no Safari para instalar",
          body: "Adicionar a BetSnipe ao ecrã principal funciona no Safari. Abre esta página no Safari e o menu Partilhar mostra a opção.",
          primary: "Copiar link",
          secondary: "Agora não"
        },
        inapp: {
          title: "Abre no teu navegador",
          body: "Estás a navegar dentro de outra app, que não permite instalar web apps. Abre esta página no Chrome ou Safari para continuar.",
          primary: "Copiar link",
          secondary: "Agora não"
        },
        "android-manual": {
          title: "Adiciona a BetSnipe ao ecrã principal",
          body: "Três passos rápidos no teu navegador:",
          steps: [
            "Toca no botão de menu do navegador.",
            'Escolhe "Instalar app" ou "Adicionar ao ecrã principal".',
            "Confirma para finalizar."
          ],
          primary: "Entendi",
          secondary: "Ver guia completo"
        },
        desktop: {
          title: "Instala a app BetSnipe",
          body: "O teu navegador pode instalar diretamente: procura o ícone de instalação na barra de endereço, ou abre o menu do navegador e escolhe \"Instalar BetSnipe\".",
          primary: "Entendi",
          secondary: "Agora não"
        },
        installed: {
          title: "A app já está instalada",
          body: "A BetSnipe está no teu ecrã principal. Abre a qualquer momento pelo ícone da app.",
          primary: "Fechar"
        },
        success: {
          title: "App instalada",
          body: "A BetSnipe está agora no teu ecrã principal. Abre a qualquer momento pelo ícone da app.",
          primary: "Concluído"
        }
      }
    }
  };

  var A11Y_COPY = {
    en: { prev: "Previous step", next: "Next step", nav: "Installation steps" },
    pt: { prev: "Passo anterior", next: "Próximo passo", nav: "Passos de instalação" }
  };

  // T and A11Y always hold the copy for the current URL. refreshLocale() runs
  // at the top of everything that renders text.
  var T = COPY[localeKey()];
  var A11Y = A11Y_COPY[localeKey()];

  function refreshLocale() {
    var key = localeKey();

    T = COPY[key];
    A11Y = A11Y_COPY[key];

    return key;
  }

  /* ------------------------------------------------------------------ *
   * 5. Shared constants
   * ------------------------------------------------------------------ */
  var BRAND = "#fe3f48";
  var MUTED = "#64748b";
  var APP_ICON = "/favicon/web-app-manifest-192x192.png";
  var Z = 2147483000;

  var AUTO_DELAY_STEPS = 2600;      // browsers that can only be shown steps
  var AUTO_DELAY_AFTER_EVENT = 600; // settle time once the install event lands
  var SOFT_NAV_RECOVERY_DELAY = 1200; // then reload to recover a lost event
  var NATIVE_EVENT_WAIT = 10000;    // after this, assume already installed
  var SNOOZE_DAYS = 7;
  var SNOOZE_DAYS_AFTER_DECLINE = 1;

  // Show the drawer on every visit unless the app is already installed.
  var RESPECT_SNOOZE = false;

  var DEBUG =
    /[?&]bsdebug=1/.test(location.search) ||
    store.get("bs_pwa_debug") === "1";

  function log() {
    if (!DEBUG) return;
    try {
      console.log.apply(
        console,
        ["[BetSnipe PWA]"].concat(Array.prototype.slice.call(arguments))
      );
    } catch (e) {}
  }

  /* ================================================================== *
   * PART A - OS switcher + mobile carousel
   * ================================================================== */

  var currentOS = "ios";
  var carouselIndex = { ios: 0, android: 0 };

  function isMobileViewport() {
    return window.matchMedia("(max-width: 768px)").matches;
  }

  function getActiveSteps() {
    return document.getElementById(
      currentOS === "android" ? "bs-steps-android" : "bs-steps-ios"
    );
  }

  function getCards(steps) {
    return steps
      ? Array.prototype.slice.call(steps.querySelectorAll("article"))
      : [];
  }

  function styleButton(button, active) {
    if (!button) return;

    button.style.setProperty("border", "0", "important");
    button.style.setProperty("cursor", "pointer", "important");
    button.style.setProperty("padding", "8px 24px", "important");
    button.style.setProperty("border-radius", "12px", "important");
    button.style.setProperty("font-family", "inherit", "important");
    button.style.setProperty("font-weight", "500", "important");
    button.style.setProperty("font-size", "16px", "important");
    button.style.setProperty("transition", "all .2s ease", "important");

    if (active) {
      button.style.setProperty("background", BRAND, "important");
      button.style.setProperty("color", "#ffffff", "important");
      button.style.setProperty(
        "box-shadow",
        "0 4px 3px rgba(0,0,0,0.10),0 2px 2px rgba(0,0,0,0.10)",
        "important"
      );
    } else {
      button.style.setProperty("background", "transparent", "important");
      button.style.setProperty("color", MUTED, "important");
      button.style.setProperty("box-shadow", "none", "important");
    }
  }

  function getArrowSvg(direction) {
    var path =
      direction === "left"
        ? "M11.75 4.5L6.25 10L11.75 15.5"
        : "M8.25 4.5L13.75 10L8.25 15.5";

    return (
      '<svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true" style="display:block;">' +
      '<path d="' +
      path +
      '" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path></svg>'
    );
  }

  function createCarouselControls() {
    refreshLocale();

    if (document.getElementById("bs-carousel-controls")) return;

    var target =
      document.getElementById("bs-steps-android") ||
      document.getElementById("bs-steps-ios");

    if (!target || !target.parentNode) return;

    target.parentNode.style.position = "relative";

    var controls = document.createElement("div");
    controls.id = "bs-carousel-controls";
    controls.setAttribute("aria-label", A11Y.nav);
    controls.style.cssText = [
      "display:none",
      "position:absolute",
      "left:0",
      "right:0",
      "top:50%",
      "transform:translateY(-50%)",
      "justify-content:space-between",
      "align-items:center",
      "padding:0 10px",
      "pointer-events:none",
      "z-index:5"
    ].join(";");

    var arrowCss = [
      "width:44px",
      "height:44px",
      "border-radius:999px",
      "border:0",
      "background:#e5e7eb",
      "color:#6b7280",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "cursor:pointer",
      "box-shadow:0 4px 12px rgba(0,0,0,.10)",
      "pointer-events:auto",
      "transition:all .2s ease"
    ].join(";");

    var prev = document.createElement("button");
    prev.id = "bs-carousel-prev";
    prev.type = "button";
    prev.setAttribute("aria-label", A11Y.prev);
    prev.innerHTML = getArrowSvg("left");
    prev.style.cssText = arrowCss;

    var next = document.createElement("button");
    next.id = "bs-carousel-next";
    next.type = "button";
    next.setAttribute("aria-label", A11Y.next);
    next.innerHTML = getArrowSvg("right");
    next.style.cssText = arrowCss;

    prev.addEventListener("click", function () {
      moveCarousel(-1);
    });

    next.addEventListener("click", function () {
      moveCarousel(1);
    });

    controls.appendChild(prev);
    controls.appendChild(next);

    target.parentNode.insertBefore(controls, target.nextSibling);
  }

  function positionCarouselControls() {
    var controls = document.getElementById("bs-carousel-controls");
    var steps = getActiveSteps();

    if (!controls || !steps || !isMobileViewport()) return;

    controls.style.top = steps.offsetTop + steps.offsetHeight / 2 + "px";
  }

  function updateCarouselControls() {
    var controls = document.getElementById("bs-carousel-controls");
    var prev = document.getElementById("bs-carousel-prev");
    var next = document.getElementById("bs-carousel-next");
    var steps = getActiveSteps();
    var cards = getCards(steps);

    if (!controls || !prev || !next || !steps || !cards.length) return;

    if (!isMobileViewport()) {
      controls.style.display = "none";
      return;
    }

    controls.style.display = "flex";
    positionCarouselControls();

    prev.style.opacity = carouselIndex[currentOS] === 0 ? ".45" : "1";
    next.style.opacity =
      carouselIndex[currentOS] === cards.length - 1 ? ".45" : "1";
  }

  // Keep the arrow state honest when the user swipes the strip by hand.
  function bindCarouselScrollSync(steps) {
    if (!steps || steps.__bsScrollBound) return;
    steps.__bsScrollBound = true;

    var timer = null;

    steps.addEventListener(
      "scroll",
      function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          var cards = getCards(steps);
          if (!cards.length || !isMobileViewport()) return;

          var center = steps.scrollLeft + steps.clientWidth / 2;
          var closest = 0;
          var best = Infinity;

          for (var i = 0; i < cards.length; i++) {
            var cardCenter = cards[i].offsetLeft + cards[i].clientWidth / 2;
            var distance = Math.abs(cardCenter - center);

            if (distance < best) {
              best = distance;
              closest = i;
            }
          }

          var os = steps.id === "bs-steps-android" ? "android" : "ios";

          if (carouselIndex[os] !== closest) {
            carouselIndex[os] = closest;
            updateCarouselControls();
          }
        }, 120);
      },
      { passive: true }
    );
  }

  function applyCarouselLayout() {
    var allSteps = [
      document.getElementById("bs-steps-ios"),
      document.getElementById("bs-steps-android")
    ];

    allSteps.forEach(function (steps) {
      if (!steps) return;

      var os = steps.id === "bs-steps-android" ? "android" : "ios";
      var cards = getCards(steps);

      if (os !== currentOS) {
        steps.style.setProperty("display", "none", "important");
        return;
      }

      if (isMobileViewport()) {
        steps.style.setProperty("display", "flex", "important");
        steps.style.setProperty("overflow-x", "auto", "important");
        steps.style.setProperty("scroll-snap-type", "x mandatory", "important");
        steps.style.setProperty("scroll-behavior", "smooth", "important");
        steps.style.setProperty("-webkit-overflow-scrolling", "touch", "important");
        steps.style.setProperty("gap", "18px", "important");
        steps.style.setProperty("padding", "0 28px 12px", "important");

        cards.forEach(function (card) {
          card.style.setProperty("flex", "0 0 84%", "important");
          card.style.setProperty("max-width", "84%", "important");
          card.style.setProperty("scroll-snap-align", "center", "important");
        });

        bindCarouselScrollSync(steps);
        scrollToCarouselIndex(false);
      } else {
        steps.style.setProperty("display", "grid", "important");
        steps.style.removeProperty("overflow-x");
        steps.style.removeProperty("scroll-snap-type");
        steps.style.removeProperty("scroll-behavior");
        steps.style.removeProperty("-webkit-overflow-scrolling");
        steps.style.removeProperty("padding");

        if (os === "android") {
          steps.style.setProperty(
            "grid-template-columns",
            "repeat(auto-fit,minmax(min(100%,240px),1fr))",
            "important"
          );
          steps.style.setProperty("gap", "20px", "important");
        } else {
          steps.style.setProperty(
            "grid-template-columns",
            "repeat(auto-fit,minmax(min(100%,260px),1fr))",
            "important"
          );
          steps.style.setProperty("gap", "28px", "important");
        }

        cards.forEach(function (card) {
          card.style.removeProperty("flex");
          card.style.removeProperty("max-width");
          card.style.removeProperty("scroll-snap-align");
        });
      }
    });

    updateCarouselControls();
  }

  function scrollToCarouselIndex(smooth) {
    var steps = getActiveSteps();
    var cards = getCards(steps);
    var index = carouselIndex[currentOS];

    if (!steps || !cards.length || !cards[index] || !isMobileViewport()) return;

    var card = cards[index];
    var left = card.offsetLeft - (steps.clientWidth - card.clientWidth) / 2;

    steps.scrollTo({
      left: Math.max(0, left),
      behavior: smooth ? "smooth" : "auto"
    });

    updateCarouselControls();
  }

  function moveCarousel(direction) {
    var cards = getCards(getActiveSteps());

    if (!cards.length) return;

    carouselIndex[currentOS] = Math.max(
      0,
      Math.min(cards.length - 1, carouselIndex[currentOS] + direction)
    );

    scrollToCarouselIndex(true);
  }

  function setBetSnipeOS(os) {
    var iosSteps = document.getElementById("bs-steps-ios");
    var androidSteps = document.getElementById("bs-steps-android");
    var iosButton = document.getElementById("bs-btn-ios");
    var androidButton = document.getElementById("bs-btn-android");

    if (!iosSteps || !androidSteps || !iosButton || !androidButton) {
      log("switcher: missing elements");
      return;
    }

    currentOS = os === "android" ? "android" : "ios";

    styleButton(iosButton, currentOS === "ios");
    styleButton(androidButton, currentOS === "android");
    iosButton.setAttribute("aria-selected", String(currentOS === "ios"));
    androidButton.setAttribute("aria-selected", String(currentOS === "android"));

    applyCarouselLayout();
  }

  function scrollToGuide() {
    var anchor = document.getElementById("bs-btn-ios");
    var section = anchor && anchor.closest ? anchor.closest("section") : null;

    (section || anchor || document.getElementById("betsnipe-app-page"))
      .scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ================================================================== *
   * PART B - PWA install popup
   * ================================================================== */

  var sheetState = { root: null, lastFocus: null, mode: null };

  function shareIconSvg() {
    return (
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="display:block;">' +
      '<path d="M12 3v12M12 3l-3.5 3.5M12 3l3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>' +
      '<path d="M5 12v7.5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5V12" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>' +
      "</svg>"
    );
  }

  function closeIconSvg() {
    return (
      '<svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true" style="display:block;">' +
      '<path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>'
    );
  }

  function stepRow(number, text) {
    return (
      '<li style="display:flex;align-items:flex-start;gap:12px;margin:0;padding:0;list-style:none;">' +
      '<span style="flex:0 0 24px;width:24px;height:24px;border-radius:8px;background:' +
      BRAND +
      ';color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;line-height:1;">' +
      number +
      "</span>" +
      '<span style="flex:1;min-width:0;font-size:15px;line-height:1.45;color:#0b0b0d;">' +
      text +
      "</span></li>"
    );
  }

  function buildSheet(mode) {
    refreshLocale();

    var copy = T.modes[mode] || T.modes.native;

    var overlay = document.createElement("div");
    overlay.id = "bs-install-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", copy.title);
    overlay.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:" + Z,
      "display:flex",
      "align-items:flex-end",
      "justify-content:center",
      "background:rgba(11,11,13,.55)",
      "-webkit-backdrop-filter:blur(4px)",
      "backdrop-filter:blur(4px)",
      "opacity:0",
      "transition:opacity .22s ease",
      "font-family:'Noto Sans',Arial,Helvetica,sans-serif",
      "-webkit-font-smoothing:antialiased"
    ].join(";");

    var sheet = document.createElement("div");
    sheet.style.cssText = [
      "position:relative",
      "width:100%",
      "max-width:460px",
      "margin:0 auto",
      "background:#fff",
      "color:#0b0b0d",
      "border-radius:28px 28px 0 0",
      "box-shadow:0 -8px 40px rgba(0,0,0,.28)",
      "padding:26px 22px calc(22px + env(safe-area-inset-bottom,0px))",
      "transform:translateY(16px)",
      "transition:transform .26s cubic-bezier(.22,1,.36,1)",
      "max-height:88vh",
      "overflow-y:auto",
      "box-sizing:border-box"
    ].join(";");

    var stepsHtml = "";

    if (copy.steps && copy.steps.length) {
      var rows = "";

      for (var i = 0; i < copy.steps.length; i++) {
        rows += stepRow(i + 1, copy.steps[i]);
      }

      stepsHtml =
        '<ul style="margin:18px 0 0;padding:0;display:flex;flex-direction:column;gap:14px;">' +
        rows +
        "</ul>";
    }

    // Safari's share control is the one thing users hunt for; show it.
    var hintHtml =
      mode === "ios"
        ? '<div style="margin-top:18px;display:flex;align-items:center;gap:10px;background:#f8f9fa;border:1px solid rgba(0,0,0,.06);border-radius:14px;padding:12px 14px;color:' +
          MUTED +
          ';font-size:13px;line-height:1.4;">' +
          '<span style="flex:0 0 auto;color:#007aff;">' +
          shareIconSvg() +
          "</span><span>" +
          (localeKey() === "pt"
            ? "Este é o ícone Partilhar do Safari."
            : "This is the Safari Share icon.") +
          "</span></div>"
        : "";

    var secondaryHtml = copy.secondary
      ? '<button type="button" data-bs-role="secondary" style="border:0;background:transparent;cursor:pointer;font-family:inherit;font-size:15px;font-weight:500;color:' +
        MUTED +
        ';padding:12px 8px;width:100%;">' +
        copy.secondary +
        "</button>"
      : "";

    sheet.innerHTML =
      '<button type="button" data-bs-role="close" aria-label="' +
      T.close +
      '" style="position:absolute;top:16px;right:16px;width:32px;height:32px;border:0;border-radius:999px;background:#f1f2f4;color:' +
      MUTED +
      ';display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;">' +
      closeIconSvg() +
      "</button>" +
      '<div style="display:flex;align-items:center;gap:14px;padding-right:40px;">' +
      '<img data-bs-role="icon" src="' +
      APP_ICON +
      '" alt="" width="56" height="56" style="display:block;width:56px;height:56px;border-radius:14px;border:1px solid rgba(0,0,0,.06);flex:0 0 auto;">' +
      '<div style="min-width:0;">' +
      '<div style="font-size:17px;font-weight:600;line-height:1.2;">BetSnipe</div>' +
      '<div style="font-size:13px;color:' +
      MUTED +
      ';line-height:1.3;margin-top:2px;">' +
      T.brandSub +
      "</div></div></div>" +
      '<h3 style="margin:22px 0 0;padding:0;font-size:21px;font-weight:600;line-height:1.25;letter-spacing:-.3px;">' +
      copy.title +
      "</h3>" +
      '<p style="margin:10px 0 0;padding:0;font-size:15px;line-height:1.55;color:' +
      MUTED +
      ';">' +
      copy.body +
      "</p>" +
      stepsHtml +
      hintHtml +
      '<button type="button" data-bs-role="primary" style="margin-top:22px;width:100%;border:0;cursor:pointer;font-family:inherit;font-size:17px;font-weight:600;color:#fff;background:' +
      BRAND +
      ";border-radius:16px;padding:16px 20px;box-shadow:0 6px 18px rgba(254,63,72,.32);transition:transform .15s ease,box-shadow .15s ease;\">" +
      copy.primary +
      "</button>" +
      secondaryHtml;

    overlay.appendChild(sheet);

    // A missing icon should collapse quietly rather than render a broken image.
    var icon = sheet.querySelector('[data-bs-role="icon"]');

    if (icon) {
      icon.addEventListener("error", function () {
        icon.style.display = "none";
      });
    }

    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) dismiss(SNOOZE_DAYS);
    });

    sheet
      .querySelector('[data-bs-role="close"]')
      .addEventListener("click", function () {
        dismiss(SNOOZE_DAYS);
      });

    sheet
      .querySelector('[data-bs-role="primary"]')
      .addEventListener("click", function () {
        onPrimary(mode, this);
      });

    var secondary = sheet.querySelector('[data-bs-role="secondary"]');

    if (secondary) {
      secondary.addEventListener("click", function () {
        if (mode === "ios" || mode === "android-manual") {
          closeSheet();
          setBetSnipeOS(env.android ? "android" : "ios");
          scrollToGuide();
          return;
        }

        dismiss(SNOOZE_DAYS);
      });
    }

    return { overlay: overlay, sheet: sheet };
  }

  function openSheet(mode) {
    closeSheet(true);

    var built = buildSheet(mode);

    sheetState.root = built.overlay;
    sheetState.mode = mode;
    sheetState.lastFocus = document.activeElement;

    document.body.appendChild(built.overlay);

    // Force a reflow so the entry transition actually runs.
    void built.overlay.offsetHeight;
    built.overlay.style.opacity = "1";
    built.sheet.style.transform = "translateY(0)";

    var primary = built.sheet.querySelector('[data-bs-role="primary"]');
    if (primary) primary.focus({ preventScroll: true });

    document.addEventListener("keydown", onKeydown, true);
    startSheetWatcher();
    log("sheet open", mode);
  }

  function closeSheet(immediate) {
    document.removeEventListener("keydown", onKeydown, true);

    var root = sheetState.root;

    sheetState.root = null;
    sheetState.mode = null;

    if (!root) return;

    var restore = sheetState.lastFocus;
    sheetState.lastFocus = null;

    var remove = function () {
      if (root.parentNode) root.parentNode.removeChild(root);
      if (restore && restore.focus) {
        try {
          restore.focus({ preventScroll: true });
        } catch (e) {}
      }
    };

    if (immediate) {
      remove();
      return;
    }

    root.style.opacity = "0";
    if (root.firstChild) root.firstChild.style.transform = "translateY(16px)";
    setTimeout(remove, 240);
  }

  function onKeydown(event) {
    if (event.key === "Escape" || event.keyCode === 27) {
      event.stopPropagation();
      dismiss(SNOOZE_DAYS);
    }
  }

  function dismiss(days) {
    snooze(days);
    closeSheet();
  }

  function snooze(days) {
    store.set(KEY_SNOOZE, String(Date.now() + days * 86400000));
  }

  function toast(message) {
    var node = document.createElement("div");

    node.textContent = message;
    node.style.cssText = [
      "position:fixed",
      "left:50%",
      "bottom:calc(28px + env(safe-area-inset-bottom,0px))",
      "transform:translateX(-50%) translateY(8px)",
      "z-index:" + (Z + 1),
      "background:#0b0b0d",
      "color:#fff",
      "font-family:'Noto Sans',Arial,Helvetica,sans-serif",
      "font-size:14px",
      "padding:12px 18px",
      "border-radius:999px",
      "box-shadow:0 8px 24px rgba(0,0,0,.28)",
      "opacity:0",
      "transition:opacity .2s ease,transform .2s ease",
      "pointer-events:none"
    ].join(";");

    document.body.appendChild(node);
    void node.offsetHeight;
    node.style.opacity = "1";
    node.style.transform = "translateX(-50%) translateY(0)";

    setTimeout(function () {
      node.style.opacity = "0";
      setTimeout(function () {
        if (node.parentNode) node.parentNode.removeChild(node);
      }, 240);
    }, 2200);
  }

  function copyLink() {
    var url = location.origin + location.pathname;

    var fallback = function () {
      var input = document.createElement("input");

      input.value = url;
      input.setAttribute("readonly", "readonly");
      input.style.cssText = "position:fixed;top:-1000px;opacity:0;";
      document.body.appendChild(input);
      input.select();
      input.setSelectionRange(0, url.length);

      try {
        document.execCommand("copy");
      } catch (e) {}

      document.body.removeChild(input);
      toast(T.copied);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        toast(T.copied);
      }, fallback);
      return;
    }

    fallback();
  }

  function onPrimary(mode, button) {
    if (mode === "native") {
      nativeInstall(button);
      return;
    }

    if (mode === "ios-other" || mode === "inapp") {
      copyLink();
      return;
    }

    if (mode === "ios" || mode === "android-manual" || mode === "desktop") {
      // "Got it" - park the popup and leave the on-page guide in place.
      snooze(SNOOZE_DAYS);
      closeSheet();
      setBetSnipeOS(env.android ? "android" : "ios");
      return;
    }

    closeSheet();
  }

  function nativeInstall(button) {
    var deferred = getPrompt();

    if (!deferred) {
      // The event was consumed or never arrived - fall back to steps.
      openSheet(ctaMode());
      return;
    }

    // prompt() must be called synchronously inside the click handler,
    // otherwise the user-gesture token is already spent.
    var choice;

    try {
      choice = deferred.prompt();
    } catch (e) {
      log("prompt() threw", e);
      setPrompt(null);
      openSheet(env.android ? "android-manual" : "ios");
      return;
    }

    // The button may be the hero CTA rather than one inside a drawer that is
    // about to close, so remember its state and put it back afterwards.
    var restore = null;

    if (button) {
      restore = {
        text: button.textContent,
        disabled: button.disabled,
        opacity: button.style.opacity
      };

      button.disabled = true;
      button.style.opacity = ".7";
      button.textContent = T.installing;
    }

    // A single beforeinstallprompt event can only be used once.
    setPrompt(null);

    Promise.resolve(choice || deferred.userChoice)
      .then(function (result) {
        var outcome = (result && result.outcome) || "dismissed";

        log("userChoice", outcome);

        if (restore) {
          button.textContent = restore.text;
          button.disabled = restore.disabled;
          button.style.opacity = restore.opacity;
        }

        if (outcome === "accepted") {
          store.set(KEY_INSTALLED, "1");
          openSheet("success");
          return;
        }

        snooze(SNOOZE_DAYS_AFTER_DECLINE);
        closeSheet();
      })
      .catch(function (error) {
        log("userChoice failed", error);

        if (restore) {
          button.textContent = restore.text;
          button.disabled = restore.disabled;
          button.style.opacity = restore.opacity;
        }

        closeSheet();
      });
  }

  /* ------------------------------------------------------------------ *
   * CTA buttons + auto popup
   * ------------------------------------------------------------------ */
  function bindCtas() {
    refreshLocale();

    var nodes = document.querySelectorAll("[data-bs-install]");

    Array.prototype.forEach.call(nodes, function (node) {
      if (node.__bsBound) return;
      node.__bsBound = true;

      if (!node.textContent.trim()) node.textContent = T.ctaLabel;

      node.addEventListener("click", function (event) {
        event.preventDefault();

        // If the native installer is available, skip our drawer entirely and
        // raise the OS dialog. prompt() has to be called synchronously inside
        // this handler - the user-gesture token does not survive a hop through
        // the drawer, which is why this cannot just be a shortcut button.
        if (resolveMode() === "native") {
          nativeInstall(node);
          return;
        }

        openSheet(ctaMode());
      });
    });

    return nodes.length;
  }

  function autoShowEligible() {
    if (isInstalled()) return false;
    if (store.get(KEY_INSTALLED) === "1") return false;

    // Product decision: show the drawer on every visit unless the app is
    // already installed. Flip RESPECT_SNOOZE to true to honour the 7-day
    // snooze that "Not now" still records.
    if (RESPECT_SNOOZE) {
      var until = parseInt(store.get(KEY_SNOOZE) || "0", 10);

      if (until && Date.now() < until) return false;
    }

    return true;
  }

  var autoScheduled = false;

  function scheduleAutoShow() {
    if (autoScheduled) return;
    autoScheduled = true;

    if (!autoShowEligible()) {
      log("auto: suppressed - already installed");
      return;
    }

    var done = false;

    var show = function show(why) {
      if (done) return;
      if (sheetState.root) return;
      if (!autoShowEligible()) return;

      // Deferred until the tab is in front. Re-enter through show() so the
      // guards above run again rather than popping over something else.
      if (document.hidden) {
        document.addEventListener(
          "visibilitychange",
          function () {
            show(why);
          },
          { once: true }
        );
        return;
      }

      var mode = resolveMode();

      // Still waiting on the install event - do not fall back to steps.
      if (mode === "pending") return;

      done = true;
      log("auto: showing", why, mode);
      openSheet(mode);
    };

    // Chromium can install natively, so the install event decides what we
    // show. Wait for it however long it takes rather than guessing: on this
    // site the app-page script only loads ~1s into the page, and the event
    // has been observed arriving after that.
    if (env.canInstallNatively) {
      // The prompt is often already in hand by the time the app block exists -
      // the platform captures it in <head> on page load, and the visitor may
      // only route to /app much later. Waiting for an event that has already
      // been and gone would leave the drawer hidden forever.
      if (getPrompt()) {
        setTimeout(function () {
          show("already-captured");
        }, AUTO_DELAY_AFTER_EVENT);
      }

      window.addEventListener(
        "bs:installable",
        function () {
          setTimeout(function () {
            show("installable");
          }, AUTO_DELAY_AFTER_EVENT);
        },
        { once: true }
      );

      // Arrived by client-side routing with no event? It fired on the previous
      // page and is unrecoverable in this document. Reload once to get a new
      // one - this is the difference between the native installer and nothing
      // at all for everyone who comes in through the site menu.
      setTimeout(function () {
        if (done || getPrompt()) return;
        if (recoverEventByReload()) return;
      }, SOFT_NAV_RECOVERY_DELAY);

      // If it still never arrives, the app is almost certainly already
      // installed - Chromium does not fire the event for an installed app.
      // Staying quiet is the right call: serving manual steps to someone who
      // already has the app is the exact thing we are trying to avoid. The
      // hero CTA is still there for anyone who wants it.
      setTimeout(function () {
        if (done || getPrompt()) return;

        log(
          "auto: no install event after " +
            NATIVE_EVENT_WAIT +
            "ms - assuming already installed, staying quiet"
        );
      }, NATIVE_EVENT_WAIT);

      return;
    }

    // iOS Safari, iOS third-party browsers, social webviews: guided steps are
    // the only route that exists, so show them promptly.
    setTimeout(function () {
      show("timeout");
    }, AUTO_DELAY_STEPS);
  }

  window.addEventListener("bs:installed", function () {
    if (sheetState.root && sheetState.mode !== "success") openSheet("success");
  });

  // The event can arrive after we have already fallen back to manual steps -
  // the app-page script tag is injected around 1s into the page, so we do not
  // get to choose whether we are listening in time. If a manual sheet is open
  // when it lands, swap it for the real installer rather than making the
  // visitor follow instructions they no longer need.
  window.addEventListener("bs:installable", function () {
    if (!sheetState.root) return;
    if (sheetState.mode === "native" || sheetState.mode === "success") return;
    if (sheetState.mode === "installed") return;
    if (!getPrompt()) return;

    log("late install event: upgrading", sheetState.mode, "-> native");
    openSheet("native");
  });

  /* ------------------------------------------------------------------ *
   * On-screen debug panel  (?bsdebug=1)
   *
   * Phones and emulators give you no console, so the facts log() writes are
   * rendered on the page instead. It only observes: the drawer behaves exactly
   * as it would for a real visitor.
   * ------------------------------------------------------------------ */
  var panelEvents = [];

  function panelLog(line) {
    panelEvents.push(Math.round(performance.now()) + "ms  " + line);

    if (panelEvents.length > 8) panelEvents.shift();
  }

  window.addEventListener("bs:installable", function () {
    panelLog("beforeinstallprompt CAPTURED");
  });

  window.addEventListener("bs:installed", function () {
    panelLog("appinstalled");
  });

  function displayMode() {
    var modes = ["standalone", "fullscreen", "minimal-ui", "browser"];

    for (var i = 0; i < modes.length; i++) {
      try {
        if (window.matchMedia("(display-mode: " + modes[i] + ")").matches) {
          return modes[i];
        }
      } catch (e) {}
    }

    return "?";
  }

  function panelRow(label, value, good) {
    var colour = good === true ? "#4ade80" : good === false ? "#f87171" : "#e5e7eb";

    return (
      '<div style="display:flex;gap:8px;justify-content:space-between;">' +
      '<span style="color:#9ca3af;">' + label + '</span>' +
      '<span style="color:' + colour + ';text-align:right;word-break:break-all;">' +
      value +
      '</span></div>'
    );
  }

  function refreshPanel() {
    var box = document.getElementById("bs-debug-panel");

    if (!box) return;

    var mode = resolveMode();
    var captured = !!getPrompt();

    box.querySelector("[data-bs-panel-body]").innerHTML =
      panelRow("version", VERSION) +
      panelRow("locale", localeKey()) +
      panelRow("canInstallNatively", String(env.canInstallNatively), env.canInstallNatively) +
      panelRow("android / ios", env.android + " / " + env.ios) +
      panelRow("inAppBrowser", String(env.inAppBrowser), !env.inAppBrowser) +
      panelRow("display-mode", displayMode()) +
      panelRow("installed", String(isInstalled())) +
      panelRow("installedFlag", String(store.get(KEY_INSTALLED))) +
      panelRow("softNav", String(arrivedViaSoftNav())) +
      panelRow("reloadAttempted", String(session.get(KEY_RELOAD_ATTEMPT))) +
      panelRow("promptCaptured", String(captured), captured) +
      panelRow("promptSource", promptSource()) +
      panelRow("MODE", mode, mode === "native") +
      panelRow("sheet open", sheetState.mode || "-") +
      '<div style="margin-top:6px;padding-top:6px;border-top:1px solid #374151;color:#9ca3af;">events</div>' +
      (panelEvents.length
        ? panelEvents
            .map(function (e) {
              return '<div style="color:#e5e7eb;">' + e + '</div>';
            })
            .join("")
        : '<div style="color:#6b7280;">none yet</div>');
  }

  function openDebugPanel() {
    if (document.getElementById("bs-debug-panel")) return;

    var box = document.createElement("div");
    var btn =
      'font:11px monospace;margin-left:4px;padding:3px 7px;border:0;border-radius:5px;background:#374151;color:#fff;';

    box.id = "bs-debug-panel";
    box.style.cssText = [
      "position:fixed",
      "left:6px",
      "right:6px",
      "top:6px",
      "z-index:" + (Z + 2),
      "background:rgba(17,24,39,.96)",
      "color:#e5e7eb",
      "font:11px/1.45 ui-monospace,Menlo,Consolas,monospace",
      "padding:10px 12px",
      "border-radius:10px",
      "box-shadow:0 8px 24px rgba(0,0,0,.4)",
      "max-height:62vh",
      "overflow:auto",
      "-webkit-user-select:text",
      "user-select:text"
    ].join(";");

    box.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
      '<b style="color:#fe3f48;">BetSnipe PWA debug</b><span>' +
      '<button data-bs-panel="force" style="' + btn + '">drawer</button>' +
      '<button data-bs-panel="reset" style="' + btn + '">reset</button>' +
      '<button data-bs-panel="close" style="' + btn + '">x</button>' +
      '</span></div><div data-bs-panel-body></div>';

    document.body.appendChild(box);

    box.addEventListener("click", function (event) {
      var action = event.target.getAttribute("data-bs-panel");

      if (!action) return;

      if (action === "close") {
        box.parentNode.removeChild(box);
      } else if (action === "force") {
        openSheet(ctaMode());
      } else if (action === "reset") {
        store.remove(KEY_SNOOZE);
        store.remove(KEY_INSTALLED);

        try {
          window.sessionStorage.removeItem(KEY_RELOAD_ATTEMPT);
        } catch (e) {}

        panelLog("state reset - reload to re-test");
      }
    });

    refreshPanel();
    setInterval(refreshPanel, 500);
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */
  var resizeTimer = null;

  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(applyCarouselLayout, 150);
  });

  // The app page is a route inside an Angular SPA. If the visitor navigates
  // away, tear the popup down instead of leaving it floating over the app.
  // Runs only while a sheet is actually open - this file loads on every page,
  // so it must not leave a permanent timer behind.
  var sheetWatcher = null;

  function startSheetWatcher() {
    if (sheetWatcher) return;
    if (!document.getElementById("betsnipe-app-page")) return;

    sheetWatcher = setInterval(function () {
      if (!sheetState.root) {
        clearInterval(sheetWatcher);
        sheetWatcher = null;
        return;
      }

      if (document.getElementById("betsnipe-app-page")) return;

      log("page left, closing sheet");
      closeSheet(true);
    }, 1000);
  }

  function bindPage() {
    var page = document.getElementById("betsnipe-app-page");
    var iosButton = document.getElementById("bs-btn-ios");
    var androidButton = document.getElementById("bs-btn-android");

    if (!page || !iosButton || !androidButton) return false;

    boundPage = page;

    createCarouselControls();

    iosButton.onclick = function (event) {
      event.preventDefault();
      event.stopPropagation();
      carouselIndex.ios = 0;
      setBetSnipeOS("ios");
      return false;
    };

    androidButton.onclick = function (event) {
      event.preventDefault();
      event.stopPropagation();
      carouselIndex.android = 0;
      setBetSnipeOS("android");
      return false;
    };

    // Open on the tab that matches the visitor's device.
    setBetSnipeOS(env.android ? "android" : "ios");

    bindCtas();
    scheduleAutoShow();

    log("bound", {
      version: VERSION,
      locale: localeKey(),
      mode: resolveMode(),
      env: env
    });

    return true;
  }

  var boundPage = null;
  var burstTimer = null;
  var routeHooked = false;

  function tryBind() {
    var page = document.getElementById("betsnipe-app-page");

    if (!page) {
      boundPage = null;
      return false;
    }

    // Already wired to this exact element - nothing to redo.
    if (page === boundPage) return true;

    return bindPage();
  }

  // The CMS injects the block asynchronously, so the element is rarely there
  // on the first look. Poll in short bursts after load and after every route
  // change rather than once for a fixed window: this file may be loaded
  // site-wide in <head>, where the visitor can reach /app minutes later.
  function bindBurst(duration) {
    clearInterval(burstTimer);

    if (tryBind()) return;

    var deadline = Date.now() + (duration || 10000);

    burstTimer = setInterval(function () {
      if (tryBind() || Date.now() > deadline) clearInterval(burstTimer);
    }, 250);
  }

  function hookRouteChanges() {
    if (routeHooked) return;
    routeHooked = true;

    var onRouteChange = function () {
      bindBurst(10000);
    };

    window.addEventListener("popstate", onRouteChange);
    window.addEventListener("hashchange", onRouteChange);

    // Angular routes with the History API, which fires no event of its own.
    ["pushState", "replaceState"].forEach(function (method) {
      var original = history[method];

      if (typeof original !== "function") return;

      history[method] = function () {
        var result = original.apply(this, arguments);

        try {
          onRouteChange();
        } catch (e) {}

        return result;
      };
    });
  }

  function boot() {
    if (/[?&]bsreset=1/.test(location.search)) {
      store.remove(KEY_SNOOZE);
      store.remove(KEY_INSTALLED);
      log("state reset");
    }

    if (DEBUG) {
      if (document.body) {
        openDebugPanel();
      } else {
        document.addEventListener("DOMContentLoaded", openDebugPanel);
      }
    }

    watchForPrompt();
    hookRouteChanges();
    bindBurst(10000);
  }

  window.__betsnipeApp = {
    version: VERSION,
    boot: boot,
    open: function (mode) {
      openSheet(mode || resolveMode());
    },
    close: closeSheet,
    install: function () {
      nativeInstall(null);
    },
    setOS: setBetSnipeOS,
    panel: openDebugPanel,
    debug: function () {
      return {
        version: VERSION,
        locale: localeKey(),
        env: env,
        mode: resolveMode(),
        installed: isInstalled(),
        promptCaptured: !!getPrompt(),
        promptSource: promptSource(),
        snoozeUntil: store.get(KEY_SNOOZE),
        installedFlag: store.get(KEY_INSTALLED),
        softNav: arrivedViaSoftNav(),
        reloadAttempted: session.get(KEY_RELOAD_ATTEMPT)
      };
    }
  };

  // Back-compat with the v2 globals.
  window.setBetSnipeOS = setBetSnipeOS;
  window.moveBetSnipeCarousel = moveCarousel;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
