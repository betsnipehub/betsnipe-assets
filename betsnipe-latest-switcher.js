(function () {
  "use strict";

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

    if (os === "android") {
      iosSteps.style.setProperty("display", "none", "important");
      androidSteps.style.setProperty("display", "grid", "important");
      styleButton(iosButton, false);
      styleButton(androidButton, true);
    } else {
      iosSteps.style.setProperty("display", "grid", "important");
      androidSteps.style.setProperty("display", "none", "important");
      styleButton(iosButton, true);
      styleButton(androidButton, false);
    }
  }

  window.setBetSnipeOS = setBetSnipeOS;

  function bindBetSnipeSwitcher() {
    var page = document.getElementById("betsnipe-app-page");
    var iosButton = document.getElementById("bs-btn-ios");
    var androidButton = document.getElementById("bs-btn-android");

    if (!page || !iosButton || !androidButton) {
      return false;
    }

    iosButton.onclick = function (event) {
      event.preventDefault();
      event.stopPropagation();
      setBetSnipeOS("ios");
      return false;
    };

    androidButton.onclick = function (event) {
      event.preventDefault();
      event.stopPropagation();
      setBetSnipeOS("android");
      return false;
    };

    setBetSnipeOS("ios");
    console.log("[BetSnipe Switcher] Loaded");

    return true;
  }

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
