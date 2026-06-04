(function () {
  const pageRoot = document.getElementById("betsnipe-promo-page-pt");
  if (!pageRoot) return;

function isPlayerLoggedIn() {
  return document.body.classList.contains("wlc-body--auth-1");
}

function resolveAuthRedirectUrl(url) {
  if (!url) return "/pt/signup";

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (url.startsWith("/")) {
    return url;
  }

  return `/${url.replace(/^\/+/, "")}`;
}

function handleAuthRedirectClick(event) {
  const link = event.target.closest(".js-auth-redirect");

  if (!link || !pageRoot.contains(link)) {
    return;
  }

  event.preventDefault();

  const targetUrl = isPlayerLoggedIn()
    ? link.dataset.authUrl
    : link.dataset.guestUrl;

  window.location.href = resolveAuthRedirectUrl(targetUrl);
}

pageRoot.addEventListener("click", handleAuthRedirectClick);

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
      const categories = (card.dataset.category || "").trim().split(/\s+/);
      const shouldShow = selected === "all" || categories.includes(selected);

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

      filterButtons.forEach((btn) => btn.classList.remove("active"));
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

  function buildAccordionFromCard(card) {
    if (!accordion) return;

    const template = card.querySelector(".modal-sections-template");
    const sections = template
      ? Array.from(template.content.querySelectorAll(".modal-section"))
      : [];

    if (!sections.length) {
      accordion.innerHTML = `
        <div class="acc-item active">
          <button class="acc-trigger" type="button" aria-expanded="true">
            <span class="acc-title">Termos da promoção</span>
            <span class="acc-chevron" aria-hidden="true"></span>
          </button>
          <div class="acc-content">
            <p>Termos desta promoção ainda não foram configurados.</p>
          </div>
        </div>
      `;
      return;
    }

    accordion.innerHTML = sections
      .map((section, index) => {
        const title = section.dataset.title || `Secção ${index + 1}`;
        const content = section.innerHTML.trim();
        const isActive = index === 0;

        return `
          <div class="acc-item ${isActive ? "active" : ""}">
            <button class="acc-trigger" type="button" aria-expanded="${isActive ? "true" : "false"}">
              <span class="acc-title">${title}</span>
              <span class="acc-chevron" aria-hidden="true"></span>
            </button>
            <div class="acc-content">${content}</div>
          </div>
        `;
      })
      .join("");
  }

  function openModalFromCard(card) {
    if (!card) return;

    modalTitle.textContent = card.dataset.modalTitle || "Bonus Lootbox";
    modalDescription.textContent = card.dataset.modalDescription || "";

    buildAccordionFromCard(card);

    const cardImage = card.querySelector(".bonus-image img");

    if (cardImage && modalImage) {
      modalImage.src = cardImage.src;
      modalImage.alt = cardImage.alt || modalTitle.textContent;
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
      const card = button.closest(".bonus-card");
      openModalFromCard(card);
    });
  });

  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", closeModal);
  }

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("is-open")) {
      closeModal();
    }
  });

  if (accordion) {
    accordion.addEventListener("click", (event) => {
      const trigger = event.target.closest(".acc-trigger");
      if (!trigger) return;

      const item = trigger.closest(".acc-item");
      const isActive = item.classList.contains("active");

      accordion.querySelectorAll(".acc-item").forEach((accItem) => {
        accItem.classList.remove("active");

        const accTrigger = accItem.querySelector(".acc-trigger");
        if (accTrigger) {
          accTrigger.setAttribute("aria-expanded", "false");
        }
      });

      if (!isActive) {
        item.classList.add("active");
        trigger.setAttribute("aria-expanded", "true");
      }
    });
  }

  function enableHorizontalDrag(selector) {
    pageRoot.querySelectorAll(selector).forEach((scroller) => {
      let isDown = false;
      let startX = 0;
      let scrollLeft = 0;

      scroller.addEventListener("pointerdown", (event) => {
        if (event.pointerType !== "mouse") return;

        isDown = true;
        startX = event.pageX - scroller.offsetLeft;
        scrollLeft = scroller.scrollLeft;
        scroller.style.cursor = "grabbing";
      });

      scroller.addEventListener("pointerleave", () => {
        isDown = false;
        scroller.style.cursor = "";
      });

      scroller.addEventListener("pointerup", () => {
        isDown = false;
        scroller.style.cursor = "";
      });

      scroller.addEventListener("pointermove", (event) => {
        if (!isDown) return;

        event.preventDefault();

        const x = event.pageX - scroller.offsetLeft;
        const walk = (x - startX) * 1.2;
        scroller.scrollLeft = scrollLeft - walk;
      });
    });
  }

  enableHorizontalDrag(".store-grid");

  const carousel = pageRoot.querySelector("#heroCarousel");
  if (!carousel) return;

  const slides = carousel.querySelectorAll(".hero-slide");
  const dots = carousel.querySelectorAll(".carousel-dot");

  if (!slides.length || !dots.length) return;

  let currentSlide = 0;
  let carouselTimer;
  const carouselDelay = 5000;

  function goToSlide(index) {
    currentSlide = index;

    slides.forEach((slide, slideIndex) => {
      slide.classList.toggle("is-active", slideIndex === currentSlide);
    });

    dots.forEach((dot, dotIndex) => {
      dot.classList.toggle("is-active", dotIndex === currentSlide);
    });
  }

  function nextSlide() {
    goToSlide((currentSlide + 1) % slides.length);
  }

  function startCarousel() {
    stopCarousel();
    carouselTimer = window.setInterval(nextSlide, carouselDelay);
  }

  function stopCarousel() {
    if (carouselTimer) {
      window.clearInterval(carouselTimer);
      carouselTimer = null;
    }
  }

  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      goToSlide(Number(dot.dataset.slide));
      startCarousel();
    });
  });

  carousel.addEventListener("mouseenter", stopCarousel);
  carousel.addEventListener("mouseleave", startCarousel);

  startCarousel();
})();
