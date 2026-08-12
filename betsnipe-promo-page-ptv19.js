(function () {
  const pageRoot = document.getElementById("betsnipe-promo-page-pt");
  if (!pageRoot) return;

  requestAnimationFrame(() => {
    window.setTimeout(() => {
      pageRoot.classList.remove("bs-loading");
      pageRoot.classList.add("bs-ready");
    }, 80);
  });
  
  const PENDING_AUTH_REDIRECT_KEY = "betsnipePendingAuthRedirect";

  function isPlayerLoggedIn() {
    return document.body.classList.contains("wlc-body--auth-1");
  }

  function resolveAuthActionUrl(url) {
    if (!url) return "/";

    if (/^https?:\/\//i.test(url)) {
      return url;
    }

    if (url.startsWith("/")) {
      return url;
    }

    return `/${url.replace(/^\/+/, "")}`;
  }

  function getAuthActionTarget(link) {
    return resolveAuthActionUrl(
      link.dataset.authUrl ||
      link.getAttribute("href") ||
      "/"
    );
  }

  function savePendingAuthRedirect(url) {
    if (!url) return;

    /*
      Guardamos em localStorage e sessionStorage.
      localStorage é importante porque, em alguns fluxos, a plataforma pode
      mandar o jogador para a página principal depois do login antes de voltar
      ao destino final.
    */
    try {
      localStorage.setItem(PENDING_AUTH_REDIRECT_KEY, url);
    } catch (error) {
      window.__betsnipePendingAuthRedirect = url;
    }

    try {
      sessionStorage.setItem(PENDING_AUTH_REDIRECT_KEY, url);
    } catch (error) {}
  }

  function getPendingAuthRedirect() {
    try {
      return (
        localStorage.getItem(PENDING_AUTH_REDIRECT_KEY) ||
        sessionStorage.getItem(PENDING_AUTH_REDIRECT_KEY) ||
        window.__betsnipePendingAuthRedirect ||
        ""
      );
    } catch (error) {
      return window.__betsnipePendingAuthRedirect || "";
    }
  }

  function clearPendingAuthRedirect() {
    try {
      localStorage.removeItem(PENDING_AUTH_REDIRECT_KEY);
    } catch (error) {}

    try {
      sessionStorage.removeItem(PENDING_AUTH_REDIRECT_KEY);
    } catch (error) {}

    window.__betsnipePendingAuthRedirect = "";
  }

  function normalizeButtonText(text) {
    return (text || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");
  }

  function openLoginPopup() {
    const loginButtonSelectors = [
      'button[data-wlc-element="login-button"]',
      '[data-wlc-element="login-button"]',
      'button[data-wlc-element*="login"]',
      '[data-wlc-element*="login"]',
      'button[data-testid*="login"]',
      'a[data-testid*="login"]',
      'button[class*="login"]',
      'a[class*="login"]',
      'button[href*="login"]',
      'a[href*="login"]'
    ];

    for (const selector of loginButtonSelectors) {
      const button = document.querySelector(selector);

      if (button) {
        button.click();
        return true;
      }
    }

    const loginTexts = [
      "entrar",
      "login",
      "log in",
      "sign in",
      "iniciar sessao",
      "iniciar sessão"
    ];

    const loginButton = Array.from(
      document.querySelectorAll("button, a, [role='button']")
    ).find((element) => {
      const text = normalizeButtonText(element.textContent);
      return loginTexts.includes(text);
    });

    if (loginButton) {
      loginButton.click();
      return true;
    }

    return false;
  }

  /*
    Espera até o jogador estar realmente autorizado.
    O body pode mudar para wlc-body--auth-1 antes de a plataforma terminar
    a request api/v1/profiles. Em ligações rápidas isto criava uma race condition.
  */
  function waitForAuthReady(callback, maxWait = 12000) {
    const startedAt = Date.now();
    let callbackQueued = false;

    const check = () => {
      if (callbackQueued) return;

      const timedOut = Date.now() - startedAt > maxWait;

      if (isPlayerLoggedIn()) {
        callbackQueued = true;

        /*
          Delay intencional após auth-1:
          dá tempo para a request api/v1/profiles terminar antes do redirect.
        */
        window.setTimeout(callback, 900);
        return;
      }

      if (timedOut) {
        return;
      }

      window.setTimeout(check, 250);
    };

    check();
  }

  function redirectPendingAuthActionIfNeeded() {
    const pendingUrl = getPendingAuthRedirect();

    if (!pendingUrl) {
      return;
    }

    if (!isPlayerLoggedIn()) {
      return;
    }

    waitForAuthReady(() => {
      const targetUrl = resolveAuthActionUrl(pendingUrl);

      clearPendingAuthRedirect();

      if (
        window.location.href !== targetUrl &&
        window.location.pathname !== targetUrl
      ) {
        window.location.href = targetUrl;
      }
    });
  }

  function closeBonusModalBeforeLogin() {
    const possibleBonusModals = [
      pageRoot.querySelector("#bonusModal"),
      document.querySelector("#bonusModal"),
      document.querySelector(".modal-backdrop.is-open"),
      document.querySelector(".modal-backdrop[aria-hidden='false']")
    ].filter(Boolean);

    possibleBonusModals.forEach((modalElement) => {
      modalElement.classList.remove("is-open");
      modalElement.setAttribute("aria-hidden", "true");
    });

    document.body.style.overflow = "";
  }

  function handleAuthActionClick(event) {
    const link = event.target.closest(".js-auth-action");

    if (!link || !pageRoot.contains(link)) {
      return;
    }

    const targetUrl = getAuthActionTarget(link);

    event.preventDefault();

    if (isPlayerLoggedIn()) {
      clearPendingAuthRedirect();
      window.location.href = targetUrl;
      return;
    }

    savePendingAuthRedirect(targetUrl);

    /*
      Importante:
      Se o clique veio do botão "Ativar bónus" / "Activate bonus"
      dentro do popup de bónus, fechamos primeiro esse popup.
      Assim o popup de login abre por cima e fica visível.
    */
    closeBonusModalBeforeLogin();

    window.setTimeout(() => {
      const opened = openLoginPopup();

      if (!opened) {
        const localeMatch = window.location.pathname.match(/^\/(pt|en)(\/|$)/);
        const localePrefix = localeMatch ? `/${localeMatch[1]}` : "/pt";

        window.location.href = `${localePrefix}/signup`;
        return;
      }

      waitForAuthReady(() => {
        const pendingUrl = getPendingAuthRedirect();

        if (!pendingUrl) {
          return;
        }

        clearPendingAuthRedirect();
        window.location.href = resolveAuthActionUrl(pendingUrl);
      });
    }, 120);
  }

  pageRoot.addEventListener("click", handleAuthActionClick);

  /*
    Se o login terminar sem reload, o MutationObserver apanha a mudança
    do body para wlc-body--auth-1.
    Se houver reload e o JS ainda carregar nesta página, a chamada inicial abaixo
    apanha o redirect pendente.
  */
  redirectPendingAuthActionIfNeeded();

  const authClassObserver = new MutationObserver(() => {
    redirectPendingAuthActionIfNeeded();
  });

  authClassObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["class"]
  });

  window.addEventListener("focus", redirectPendingAuthActionIfNeeded);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      redirectPendingAuthActionIfNeeded();
    }
  });

  if (pageRoot.dataset.betsnipePromoLoaded === "true") return;
  pageRoot.dataset.betsnipePromoLoaded = "true";

  const filterButtons = pageRoot.querySelectorAll(".filter-btn");
  const bonusGrid = pageRoot.querySelector("#bonusGrid");
  const bonusCards = bonusGrid
    ? Array.from(bonusGrid.querySelectorAll(".bonus-card[data-category]"))
    : [];

  const modal = pageRoot.querySelector("#bonusModal");
  const modalTitle = pageRoot.querySelector("#modalTitle");
  const modalDescription = pageRoot.querySelector("#modalDescription");
  const modalImage = pageRoot.querySelector(".modal-image-slot img");
  const accordion = pageRoot.querySelector("#modalAccordion");

  if (!modal) return;

  const closeModalBtn = modal.querySelector(".modal-close");
  const revealItems = pageRoot.querySelectorAll(".reveal-on-scroll");

  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -40px 0px"
      }
    );

    revealItems.forEach((item) => revealObserver.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  }

  let bonusScrollResetUntil = 0;
  let bonusScrollResetTimer = null;

  function forceBonusGridStart(duration = 900) {
    if (!bonusGrid) return;

    bonusScrollResetUntil = Date.now() + duration;

    bonusGrid.classList.add("is-resetting-scroll");
    bonusGrid.style.scrollSnapType = "none";
    bonusGrid.style.scrollBehavior = "auto";

    const reset = () => {
      bonusGrid.scrollLeft = 0;

      if (typeof bonusGrid.scrollTo === "function") {
        bonusGrid.scrollTo({
          left: 0,
          top: 0,
          behavior: "auto"
        });
      }
    };

    reset();

    if (bonusScrollResetTimer) {
      clearInterval(bonusScrollResetTimer);
    }

    bonusScrollResetTimer = setInterval(() => {
      reset();

      if (Date.now() > bonusScrollResetUntil) {
        clearInterval(bonusScrollResetTimer);
        bonusScrollResetTimer = null;

        reset();

        bonusGrid.style.scrollSnapType = "";
        bonusGrid.style.scrollBehavior = "";
        bonusGrid.classList.remove("is-resetting-scroll");
      }
    }, 16);
  }

  if (bonusGrid) {
    bonusGrid.addEventListener(
      "scroll",
      () => {
        if (Date.now() <= bonusScrollResetUntil) {
          bonusGrid.scrollLeft = 0;
        }
      },
      { passive: true }
    );
  }

  function applyBonusFilter(selected) {
    if (!bonusGrid) return;

    let firstVisibleCard = null;

    bonusGrid.classList.remove("is-filtered");

    bonusCards.forEach((card) => {
      const categories = (card.dataset.category || "")
        .trim()
        .split(/\s+/);

      const shouldShow =
        selected === "all" || categories.includes(selected);

      card.classList.remove("is-hidden", "is-top-bonus");
      card.hidden = false;
      card.style.removeProperty("display");

      if (!shouldShow) {
        card.classList.add("is-hidden");
        card.hidden = true;
        card.style.setProperty("display", "none", "important");
        return;
      }

      if (!firstVisibleCard) {
        firstVisibleCard = card;
      }
    });

    if (firstVisibleCard) {
      firstVisibleCard.classList.add("is-top-bonus");
    }

    forceBonusGridStart(900);
  }

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const selected = button.dataset.filter;

      filterButtons.forEach((btn) => {
        btn.classList.remove("active");
      });

      button.classList.add("active");
      applyBonusFilter(selected);
    });
  });

  const activeFilterButton =
    pageRoot.querySelector(".filter-btn.active") ||
    pageRoot.querySelector('.filter-btn[data-filter="all"]');

  if (activeFilterButton) {
    applyBonusFilter(activeFilterButton.dataset.filter);
  }

  /*
    Obtém as secções de Termos e Condições do cartão.

    Compatibilidade:
    - <template class="modal-sections-template">...</template>
    - <div class="modal-sections-template" hidden>...</div>

    A versão anterior assumia sempre que .modal-sections-template era um
    elemento <template> e acedia diretamente a .content. Quando o wrapper
    é um <div hidden>, .content não existe e os termos não são carregados.
  */
  function getModalSectionsFromCard(card) {
    if (!card) return [];

    const holder = card.querySelector(".modal-sections-template");

    if (holder) {
      const sourceRoot =
        holder.tagName === "TEMPLATE" && holder.content
          ? holder.content
          : holder;

      const holderSections = Array.from(
        sourceRoot.querySelectorAll(".modal-section")
      );

      if (holderSections.length) {
        return holderSections;
      }
    }

    /*
      Fallback adicional para o caso de o WordPress remover/alterar apenas
      o wrapper mas manter as .modal-section dentro do cartão.
    */
    return Array.from(card.querySelectorAll(".modal-section"));
  }

  function buildAccordionFromCard(card) {
    if (!accordion || !card) return;

    const sections = getModalSectionsFromCard(card);

    if (!sections.length) {
      accordion.innerHTML = `
        <div class="acc-item active">
          <button
            class="acc-trigger"
            type="button"
            aria-expanded="true"
          >
            <span class="acc-title">Termos da promoção</span>
            <span
              class="acc-chevron"
              aria-hidden="true"
            ></span>
          </button>

          <div class="acc-content">
            <p>
              Termos desta promoção ainda não foram configurados.
            </p>
          </div>
        </div>
      `;

      return;
    }

    accordion.innerHTML = sections
      .map((section, index) => {
        const title =
          section.dataset.title || `Secção ${index + 1}`;

        const content = section.innerHTML.trim();
        const isActive = index === 0;

        return `
          <div class="acc-item ${isActive ? "active" : ""}">
            <button
              class="acc-trigger"
              type="button"
              aria-expanded="${isActive ? "true" : "false"}"
            >
              <span class="acc-title">${title}</span>
              <span
                class="acc-chevron"
                aria-hidden="true"
              ></span>
            </button>

            <div class="acc-content">
              ${content}
            </div>
          </div>
        `;
      })
      .join("");
  }

  function openModalFromCard(card) {
    if (!card) return;

    if (modalTitle) {
      modalTitle.textContent =
        card.dataset.modalTitle || "Bonus Lootbox";
    }

    if (modalDescription) {
      modalDescription.textContent =
        card.dataset.modalDescription || "";
    }

    buildAccordionFromCard(card);

    const cardImage = card.querySelector(
      ".bonus-image img, .worldcup-banner-img-desktop, .worldcup-banner-img"
    );

    if (cardImage && modalImage) {
      modalImage.src = cardImage.src;
      modalImage.alt =
        cardImage.alt ||
        (modalTitle ? modalTitle.textContent : "");
    }

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  pageRoot.querySelectorAll(".open-modal").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest(
        ".bonus-card, .worldcup-banner"
      );

      openModalFromCard(card);
    });
  });

  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", closeModal);
  }

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      modal.classList.contains("is-open")
    ) {
      closeModal();
    }
  });

  if (accordion) {
    accordion.addEventListener("click", (event) => {
      const trigger = event.target.closest(".acc-trigger");

      if (!trigger) return;

      const item = trigger.closest(".acc-item");

      if (!item) return;

      const isActive =
        item.classList.contains("active");

      accordion
        .querySelectorAll(".acc-item")
        .forEach((accItem) => {
          accItem.classList.remove("active");

          const accTrigger =
            accItem.querySelector(".acc-trigger");

          if (accTrigger) {
            accTrigger.setAttribute(
              "aria-expanded",
              "false"
            );
          }
        });

      if (!isActive) {
        item.classList.add("active");
        trigger.setAttribute(
          "aria-expanded",
          "true"
        );
      }
    });
  }

  function enableHorizontalDrag(selector) {
    pageRoot
      .querySelectorAll(selector)
      .forEach((scroller) => {
        let isDown = false;
        let startX = 0;
        let scrollLeft = 0;

        scroller.addEventListener(
          "pointerdown",
          (event) => {
            if (event.pointerType !== "mouse") {
              return;
            }

            isDown = true;
            startX =
              event.pageX - scroller.offsetLeft;
            scrollLeft = scroller.scrollLeft;

            scroller.style.cursor = "grabbing";
          }
        );

        scroller.addEventListener(
          "pointerleave",
          () => {
            isDown = false;
            scroller.style.cursor = "";
          }
        );

        scroller.addEventListener(
          "pointerup",
          () => {
            isDown = false;
            scroller.style.cursor = "";
          }
        );

        scroller.addEventListener(
          "pointermove",
          (event) => {
            if (!isDown) return;

            event.preventDefault();

            const x =
              event.pageX - scroller.offsetLeft;

            const walk =
              (x - startX) * 1.2;

            scroller.scrollLeft =
              scrollLeft - walk;
          }
        );
      });
  }

  enableHorizontalDrag(".store-grid");

  const carousel =
    pageRoot.querySelector("#heroCarousel");

  if (!carousel) return;

  const slides =
    carousel.querySelectorAll(".hero-slide");

  const dots =
    carousel.querySelectorAll(".carousel-dot");

  if (!slides.length || !dots.length) {
    return;
  }

  let currentSlide = 0;
  let carouselTimer;

  const carouselDelay = 5000;

  function goToSlide(index) {
    currentSlide = index;

    slides.forEach((slide, slideIndex) => {
      slide.classList.toggle(
        "is-active",
        slideIndex === currentSlide
      );
    });

    dots.forEach((dot, dotIndex) => {
      dot.classList.toggle(
        "is-active",
        dotIndex === currentSlide
      );
    });
  }

  function nextSlide() {
    goToSlide(
      (currentSlide + 1) % slides.length
    );
  }

  function startCarousel() {
    stopCarousel();

    carouselTimer =
      window.setInterval(
        nextSlide,
        carouselDelay
      );
  }

  function stopCarousel() {
    if (carouselTimer) {
      window.clearInterval(carouselTimer);
      carouselTimer = null;
    }
  }

  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      goToSlide(
        Number(dot.dataset.slide)
      );

      startCarousel();
    });
  });

  carousel.addEventListener(
    "mouseenter",
    stopCarousel
  );

  carousel.addEventListener(
    "mouseleave",
    startCarousel
  );

  startCarousel();
})();
