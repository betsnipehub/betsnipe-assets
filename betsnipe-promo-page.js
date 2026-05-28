(function () {
  const pageRoot = document.getElementById("betsnipe-promo-page");
  if (!pageRoot) return;

  const filterButtons = pageRoot.querySelectorAll(".filter-btn");
  const bonusGrid = pageRoot.querySelector("#bonusGrid");
  const bonusCards = pageRoot.querySelectorAll(".bonus-card[data-category]");
  const modal = pageRoot.querySelector("#bonusModal");
  const modalTitle = pageRoot.querySelector("#modalTitle");
  const modalDescription = pageRoot.querySelector("#modalDescription");
  const rewardOne = pageRoot.querySelector("#rewardOne");
  const rewardTwo = pageRoot.querySelector("#rewardTwo");
  const rewardThree = pageRoot.querySelector("#rewardThree");
  const closeModalBtn = modal.querySelector(".modal-close");
  const accordion = pageRoot.querySelector("#modalAccordion");

  // Animações suaves no scroll
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

  // Filtro de bónus
  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const selected = button.dataset.filter;

      filterButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      if (bonusGrid) {
        bonusGrid.classList.toggle("is-filtered", selected !== "all");
        bonusGrid.scrollTo({ left: 0, behavior: "smooth" });
      }

      bonusCards.forEach((card) => {
        const categories = card.dataset.category.split(" ");
        const shouldShow = selected === "all" || categories.includes(selected);
        card.classList.toggle("is-hidden", !shouldShow);
      });
    });
  });

  // Modal único dinâmico
  function openModalFromCard(card) {
    modalTitle.textContent = card.dataset.modalTitle || "Bonus Lootbox";
    modalDescription.textContent = card.dataset.modalDescription || "";
    rewardOne.textContent =
      card.dataset.modalReward1 ||
      "Generic text for the main promotion terms. Use this area to explain the validity period, general rules, usage limits, offer conditions, and important notes.";
    rewardTwo.textContent =
      card.dataset.modalReward2 ||
      "Generic text for eligibility conditions. Use this area to explain who can participate, minimum deposit amount, valid payment methods, and applicable restrictions.";
    rewardThree.textContent =
      card.dataset.modalReward3 ||
      "Generic text for wagering requirements. Use this area to explain rollover, minimum odds, eligible games, deadlines to meet requirements, and withdrawal limits.";

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

  closeModalBtn.addEventListener("click", closeModal);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("is-open")) {
      closeModal();
    }
  });

  accordion.addEventListener("click", (event) => {
    const trigger = event.target.closest(".acc-trigger");
    if (!trigger) return;

    const item = trigger.closest(".acc-item");
    const isActive = item.classList.contains("active");

    accordion.querySelectorAll(".acc-item").forEach((accItem) => {
      accItem.classList.remove("active");
      accItem.querySelector(".acc-trigger span:last-child").textContent = "⌄";
    });

    if (!isActive) {
      item.classList.add("active");
      trigger.querySelector("span:last-child").textContent = "⌃";
    }
  });

  // Scroll horizontal assistido para carrosséis mobile
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

  // Carrossel automático: troca a cada 5 segundos, pausa ao passar o mouse e aceita clique nos dots.
  const carousel = pageRoot.querySelector("#heroCarousel");
  if (!carousel) return;

  const slides = carousel.querySelectorAll(".hero-slide");
  const dots = carousel.querySelectorAll(".carousel-dot");
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
    if (carouselTimer) window.clearInterval(carouselTimer);
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
