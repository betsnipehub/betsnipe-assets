(function () {
  "use strict";

  var currentOS = "ios";
  var carouselIndex = { ios: 0, android: 0 };

  function isMobile() {
    return window.matchMedia("(max-width: 768px)").matches;
  }

  function getActiveSteps() {
    return document.getElementById(
      currentOS === "android" ? "bs-steps-android" : "bs-steps-ios"
    );
  }

  function getCards(steps) {
    return steps ? Array.prototype.slice.call(steps.querySelectorAll("article")) : [];
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
      button.style.setProperty("background", "#fe3f48", "important");
      button.style.setProperty("color", "#ffffff", "important");
      button.style.setProperty(
        "box-shadow",
        "0 4px 3px rgba(0,0,0,0.10),0 2px 2px rgba(0,0,0,0.10)",
        "important"
      );
    } else {
      button.style.setProperty("background", "transparent", "important");
      button.style.setProperty("color", "#64748b", "important");
      button.style.setProperty("box-shadow", "none", "important");
    }
  }

  function getArrowSvg(direction) {
    if (direction === "left") {
      return '<svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true" style="display:block;"><path d="M11.75 4.5L6.25 10L11.75 15.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
    }
    return '<svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true" style="display:block;"><path d="M8.25 4.5L13.75 10L8.25 15.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
  }

  function createCarouselControls() {
    if (document.getElementById("bs-carousel-controls")) return;

    var androidSteps = document.getElementById("bs-steps-android");
    var iosSteps = document.getElementById("bs-steps-ios");
    var target = androidSteps || iosSteps;

    if (!target || !target.parentNode) return;

    target.parentNode.style.position = "relative";

    var controls = document.createElement("div");
    controls.id = "bs-carousel-controls";
    controls.setAttribute("aria-label", "Navegação dos passos de instalação");
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

    var prev = document.createElement("button");
    prev.id = "bs-carousel-prev";
    prev.type = "button";
    prev.setAttribute("aria-label", "Passo anterior");
    prev.innerHTML = getArrowSvg("left");
    prev.style.cssText = [
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

    var next = document.createElement("button");
    next.id = "bs-carousel-next";
    next.type = "button";
    next.setAttribute("aria-label", "Próximo passo");
    next.innerHTML = getArrowSvg("right");
    next.style.cssText = prev.style.cssText;

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

    if (!controls || !steps || !isMobile()) return;

    var top = steps.offsetTop + steps.offsetHeight / 2;
    controls.style.top = top + "px";
  }

  function updateCarouselControls() {
    var controls = document.getElementById("bs-carousel-controls");
    var prev = document.getElementById("bs-carousel-prev");
    var next = document.getElementById("bs-carousel-next");
    var steps = getActiveSteps();
    var cards = getCards(steps);

    if (!controls || !prev || !next || !steps || !cards.length) return;

    if (!isMobile()) {
      controls.style.display = "none";
      return;
    }

    controls.style.display = "flex";
    positionCarouselControls();

    prev.style.opacity = carouselIndex[currentOS] === 0 ? ".45" : "1";
    next.style.opacity = carouselIndex[currentOS] === cards.length - 1 ? ".45" : "1";
  }

  function applyCarouselLayout() {
    var iosSteps = document.getElementById("bs-steps-ios");
    var androidSteps = document.getElementById("bs-steps-android");
    var allSteps = [iosSteps, androidSteps];

    allSteps.forEach(function (steps) {
      if (!steps) return;

      var os = steps.id === "bs-steps-android" ? "android" : "ios";
      var cards = getCards(steps);
      var active = os === currentOS;

      if (!active) {
        steps.style.setProperty("display", "none", "important");
        return;
      }

      if (isMobile()) {
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

    if (!steps || !cards.length || !cards[index] || !isMobile()) return;

    var card = cards[index];
    var left = card.offsetLeft - (steps.clientWidth - card.clientWidth) / 2;

    steps.scrollTo({
      left: Math.max(0, left),
      behavior: smooth ? "smooth" : "auto"
    });

    updateCarouselControls();
  }

  function moveCarousel(direction) {
    var steps = getActiveSteps();
    var cards = getCards(steps);

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
      console.log("[BetSnipe Switcher] Missing elements", {
        iosSteps: iosSteps,
        androidSteps: androidSteps,
        iosButton: iosButton,
        androidButton: androidButton
      });
      return;
    }

    currentOS = os === "android" ? "android" : "ios";

    styleButton(iosButton, currentOS === "ios");
    styleButton(androidButton, currentOS === "android");

    applyCarouselLayout();
  }

  function bindBetSnipeSwitcher() {
    var page = document.getElementById("betsnipe-app-page");
    var iosButton = document.getElementById("bs-btn-ios");
    var androidButton = document.getElementById("bs-btn-android");

    if (!page || !iosButton || !androidButton) return false;

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

    setBetSnipeOS("ios");

    window.setBetSnipeOS = setBetSnipeOS;
    window.moveBetSnipeCarousel = moveCarousel;

    console.log("[BetSnipe Switcher + Mobile Carousel] Loaded");

    return true;
  }

  var resizeTimer = null;

  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      applyCarouselLayout();
    }, 150);
  });

  function init() {
    var tries = 0;

    var timer = setInterval(function () {
      tries++;

      if (bindBetSnipeSwitcher() || tries >= 60) {
        clearInterval(timer);
      }
    }, 250);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
