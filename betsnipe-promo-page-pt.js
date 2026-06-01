(function () {
  const pageRoot = document.getElementById("betsnipe-promo-page-pt");
  if (!pageRoot) return;

  const filterButtons = pageRoot.querySelectorAll(".filter-btn");
  const bonusGrid = pageRoot.querySelector("#bonusGrid");
  const bonusCards = bonusGrid
  ? Array.from(bonusGrid.querySelectorAll(".bonus-card[data-category]"))
  : [];
  const modal = pageRoot.querySelector("#bonusModal");
  const modalTitle = pageRoot.querySelector("#modalTitle");
  const modalDescription = pageRoot.querySelector("#modalDescription");
  const rewardOne = pageRoot.querySelector("#rewardOne");
  const rewardTwo = pageRoot.querySelector("#rewardTwo");
  const rewardThree = pageRoot.querySelector("#rewardThree");
  const modalImage = pageRoot.querySelector('.modal-image-slot img');

  if (!modal) return;

  const closeModalBtn = modal.querySelector(".modal-close");
  const accordion = pageRoot.querySelector("#modalAccordion");

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

  function applyBonusFilter(selected) {
  if (!bonusGrid) return;

  let firstVisibleCard = null;

  bonusGrid.classList.toggle("is-filtered", selected !== "all");

  bonusCards.forEach((card) => {
    const categories = (card.dataset.category || "").split(" ");
    const shouldShow = selected === "all" || categories.includes(selected);

    card.classList.toggle("is-hidden", !shouldShow);
    card.style.display = shouldShow ? "" : "none";

    card.classList.remove("featured");

    if (shouldShow && !firstVisibleCard) {
      firstVisibleCard = card;
    }
  });

  if (firstVisibleCard) {
    firstVisibleCard.classList.add("featured");
  }
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

  function openModalFromCard(card) {
  modalTitle.textContent = card.dataset.modalTitle || 'Bonus Lootbox';
  modalDescription.textContent = card.dataset.modalDescription || '';

  rewardOne.textContent = card.dataset.modalReward1 || 'Texto genérico para inserir os termos principais da promoção. Use este espaço para explicar período de validade, regras gerais, limite de utilização, condições da oferta e observações importantes.';
  rewardTwo.textContent = card.dataset.modalReward2 || 'Texto genérico para inserir as condições de elegibilidade. Use este espaço para informar quem pode participar, valor mínimo de depósito, métodos de pagamento válidos e restrições aplicáveis.';
  rewardThree.textContent = card.dataset.modalReward3 || 'Texto genérico para inserir os requisitos de aposta. Use este espaço para explicar rollover, odds mínimas, jogos elegíveis, prazo para cumprir os requisitos e limites de levantamento.';

  const cardImage = card.querySelector('.bonus-image img');
  if (cardImage && modalImage) {
    modalImage.src = cardImage.src;
    modalImage.alt = cardImage.alt || modalTitle.textContent;
  }

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
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

  accordion.addEventListener('click', (event) => {
  const trigger = event.target.closest('.acc-trigger');
  if (!trigger) return;

  const item = trigger.closest('.acc-item');
  const isActive = item.classList.contains('active');

  accordion.querySelectorAll('.acc-item').forEach((accItem) => {
    accItem.classList.remove('active');

    const accTrigger = accItem.querySelector('.acc-trigger');
    if (accTrigger) {
      accTrigger.setAttribute('aria-expanded', 'false');
    }
  });

  if (!isActive) {
    item.classList.add('active');
    trigger.setAttribute('aria-expanded', 'true');
  }
});

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

      scroller.addEventListener(
        "wheel",
        (event) => {
          if (window.innerWidth > 680) return;
          if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

          event.preventDefault();
          scroller.scrollLeft += event.deltaY;
        },
        { passive: false }
      );
    });
  }

  enableHorizontalDrag(".bonus-grid, .store-grid");

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

  console.log("[BetSnipe Promo PT] Loaded");
})();
