(function () {
  const BETSNIPE_PROMO_VERSION = "en-v21";
  const ROOT_SELECTOR =
    "#betsnipe-promo-page-en, #betsnipe-promo-page-pt";

  function isEnglishRoute() {
    const path = (window.location.pathname || "").toLowerCase();

    return (
      path === "/en" ||
      path.startsWith("/en/")
    );
  }

  function showPage(pageRoot) {
    if (!pageRoot) return;

    pageRoot.classList.remove("bs-loading");
    pageRoot.classList.add("bs-ready");

    /*
      Fail-safe adicional.
      Mesmo que algum CSS antigo mantenha bs-loading escondido,
      a página atual fica visível.
    */
    pageRoot.style.opacity = "1";
    pageRoot.style.visibility = "visible";
  }

  function initPage(pageRoot) {
    if (!pageRoot) return;

    showPage(pageRoot);

    /*
      Numa navegação SPA, o <main> pode aparecer primeiro
      e os elementos internos serem adicionados logo depois.
      Nesse caso não marcamos a página como inicializada ainda.
    */
    const requiredMarkupReady =
      pageRoot.querySelector("#bonusGrid") &&
      pageRoot.querySelector("#bonusModal") &&
      pageRoot.querySelector("#heroCarousel");

    if (!requiredMarkupReady) {
      return;
    }

    /*
      A inicialização é controlada por ESTA instância do elemento.
      Não usamos uma flag global de versão no window porque o
      window continua vivo quando a plataforma navega via SPA.
    */
    if (
      pageRoot.dataset.betsnipePromoLoaded === "true" &&
      pageRoot.dataset.betsnipePromoVersion ===
        BETSNIPE_PROMO_VERSION
    ) {
      showPage(pageRoot);
      return;
    }

    pageRoot.dataset.betsnipePromoLoaded = "true";
    pageRoot.dataset.betsnipePromoVersion =
      BETSNIPE_PROMO_VERSION;

    const PENDING_AUTH_REDIRECT_KEY =
      "betsnipePendingAuthRedirect";

    function isPlayerLoggedIn() {
      return document.body.classList.contains(
        "wlc-body--auth-1"
      );
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

      try {
        localStorage.setItem(
          PENDING_AUTH_REDIRECT_KEY,
          url
        );
      } catch (error) {
        window.__betsnipePendingAuthRedirect = url;
      }

      try {
        sessionStorage.setItem(
          PENDING_AUTH_REDIRECT_KEY,
          url
        );
      } catch (error) {}
    }

    function getPendingAuthRedirect() {
      try {
        return (
          localStorage.getItem(
            PENDING_AUTH_REDIRECT_KEY
          ) ||
          sessionStorage.getItem(
            PENDING_AUTH_REDIRECT_KEY
          ) ||
          window.__betsnipePendingAuthRedirect ||
          ""
        );
      } catch (error) {
        return (
          window.__betsnipePendingAuthRedirect || ""
        );
      }
    }

    function clearPendingAuthRedirect() {
      try {
        localStorage.removeItem(
          PENDING_AUTH_REDIRECT_KEY
        );
      } catch (error) {}

      try {
        sessionStorage.removeItem(
          PENDING_AUTH_REDIRECT_KEY
        );
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
        const button =
          document.querySelector(selector);

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
        document.querySelectorAll(
          "button, a, [role='button']"
        )
      ).find((element) => {
        const text = normalizeButtonText(
          element.textContent
        );

        return loginTexts.includes(text);
      });

      if (loginButton) {
        loginButton.click();
        return true;
      }

      return false;
    }

    /*
      O body pode mudar para auth-1 antes de a plataforma
      terminar a request do perfil.

      Mantemos o pequeno delay para evitar race conditions.
    */
    function waitForAuthReady(
      callback,
      maxWait = 12000
    ) {
      const startedAt = Date.now();
      let callbackQueued = false;

      const check = () => {
        if (callbackQueued) return;

        const timedOut =
          Date.now() - startedAt > maxWait;

        if (isPlayerLoggedIn()) {
          callbackQueued = true;

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
      const pendingUrl =
        getPendingAuthRedirect();

      if (!pendingUrl) {
        return;
      }

      if (!isPlayerLoggedIn()) {
        return;
      }

      waitForAuthReady(() => {
        const targetUrl =
          resolveAuthActionUrl(pendingUrl);

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
        document.querySelector(
          ".modal-backdrop.is-open"
        ),
        document.querySelector(
          ".modal-backdrop[aria-hidden='false']"
        )
      ].filter(Boolean);

      possibleBonusModals.forEach(
        (modalElement) => {
          modalElement.classList.remove("is-open");
          modalElement.setAttribute(
            "aria-hidden",
            "true"
          );
        }
      );

      document.body.style.overflow = "";
    }

    function handleAuthActionClick(event) {
      const link = event.target.closest(
        ".js-auth-action"
      );

      if (
        !link ||
        !pageRoot.contains(link)
      ) {
        return;
      }

      const targetUrl =
        getAuthActionTarget(link);

      event.preventDefault();
      event.stopPropagation();

      if (isPlayerLoggedIn()) {
        clearPendingAuthRedirect();
        window.location.href = targetUrl;
        return;
      }

      savePendingAuthRedirect(targetUrl);

      closeBonusModalBeforeLogin();

      window.setTimeout(() => {
        const opened = openLoginPopup();

        if (!opened) {
          const localeMatch =
            window.location.pathname.match(
              /^\/(pt|en)(\/|$)/
            );

          const localePrefix = localeMatch
            ? `/${localeMatch[1]}`
            : "/en";

          window.location.href =
            `${localePrefix}/signup`;

          return;
        }

        waitForAuthReady(() => {
          const pendingUrl =
            getPendingAuthRedirect();

          if (!pendingUrl) {
            return;
          }

          clearPendingAuthRedirect();

          window.location.href =
            resolveAuthActionUrl(pendingUrl);
        });
      }, 120);
    }

    pageRoot.addEventListener(
      "click",
      handleAuthActionClick,
      true
    );

    redirectPendingAuthActionIfNeeded();

    const authClassObserver =
      new MutationObserver(() => {
        /*
          O observer pode continuar alguns instantes
          depois de uma navegação SPA. Só atuamos se
          esta instância ainda estiver no documento.
        */
        if (!pageRoot.isConnected) {
          authClassObserver.disconnect();
          return;
        }

        redirectPendingAuthActionIfNeeded();
      });

    authClassObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"]
    });

    const handleWindowFocus = () => {
      if (!pageRoot.isConnected) return;

      redirectPendingAuthActionIfNeeded();
    };

    window.addEventListener(
      "focus",
      handleWindowFocus
    );

    const handleVisibilityChange = () => {
      if (!pageRoot.isConnected) return;

      if (!document.hidden) {
        redirectPendingAuthActionIfNeeded();
      }
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    const filterButtons =
      pageRoot.querySelectorAll(".filter-btn");

    const bonusGrid =
      pageRoot.querySelector("#bonusGrid");

    const bonusCards = bonusGrid
      ? Array.from(
          bonusGrid.querySelectorAll(
            ".bonus-card[data-category]"
          )
        )
      : [];

    const modal =
      pageRoot.querySelector("#bonusModal");

    const modalTitle =
      pageRoot.querySelector("#modalTitle");

    const modalDescription =
      pageRoot.querySelector(
        "#modalDescription"
      );

    const modalImage =
      pageRoot.querySelector(
        ".modal-image-slot img"
      );

    const accordion =
      pageRoot.querySelector(
        "#modalAccordion"
      );

    if (!modal) return;

    const closeModalBtn =
      modal.querySelector(".modal-close");

    const revealItems =
      pageRoot.querySelectorAll(
        ".reveal-on-scroll"
      );

    if (
      "IntersectionObserver" in window
    ) {
      const revealObserver =
        new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                entry.target.classList.add(
                  "is-visible"
                );

                revealObserver.unobserve(
                  entry.target
                );
              }
            });
          },
          {
            threshold: 0.12,
            rootMargin:
              "0px 0px -40px 0px"
          }
        );

      revealItems.forEach((item) =>
        revealObserver.observe(item)
      );
    } else {
      revealItems.forEach((item) =>
        item.classList.add("is-visible")
      );
    }

    let bonusScrollResetUntil = 0;
    let bonusScrollResetTimer = null;

    function forceBonusGridStart(
      duration = 900
    ) {
      if (!bonusGrid) return;

      bonusScrollResetUntil =
        Date.now() + duration;

      bonusGrid.classList.add(
        "is-resetting-scroll"
      );

      bonusGrid.style.scrollSnapType =
        "none";

      bonusGrid.style.scrollBehavior =
        "auto";

      const reset = () => {
        bonusGrid.scrollLeft = 0;

        if (
          typeof bonusGrid.scrollTo ===
          "function"
        ) {
          bonusGrid.scrollTo({
            left: 0,
            top: 0,
            behavior: "auto"
          });
        }
      };

      reset();

      if (bonusScrollResetTimer) {
        clearInterval(
          bonusScrollResetTimer
        );
      }

      bonusScrollResetTimer =
        setInterval(() => {
          reset();

          if (
            Date.now() >
            bonusScrollResetUntil
          ) {
            clearInterval(
              bonusScrollResetTimer
            );

            bonusScrollResetTimer = null;

            reset();

            bonusGrid.style.scrollSnapType =
              "";

            bonusGrid.style.scrollBehavior =
              "";

            bonusGrid.classList.remove(
              "is-resetting-scroll"
            );
          }
        }, 16);
    }

    if (bonusGrid) {
      bonusGrid.addEventListener(
        "scroll",
        () => {
          if (
            Date.now() <=
            bonusScrollResetUntil
          ) {
            bonusGrid.scrollLeft = 0;
          }
        },
        { passive: true }
      );
    }

    function applyBonusFilter(selected) {
      if (!bonusGrid) return;

      let firstVisibleCard = null;

      bonusGrid.classList.remove(
        "is-filtered"
      );

      bonusCards.forEach((card) => {
        const categories = (
          card.dataset.category || ""
        )
          .trim()
          .split(/\s+/);

        const shouldShow =
          selected === "all" ||
          categories.includes(selected);

        card.classList.remove(
          "is-hidden",
          "is-top-bonus"
        );

        card.hidden = false;

        card.style.removeProperty(
          "display"
        );

        if (!shouldShow) {
          card.classList.add(
            "is-hidden"
          );

          card.hidden = true;

          card.style.setProperty(
            "display",
            "none",
            "important"
          );

          return;
        }

        if (!firstVisibleCard) {
          firstVisibleCard = card;
        }
      });

      if (firstVisibleCard) {
        firstVisibleCard.classList.add(
          "is-top-bonus"
        );
      }

      forceBonusGridStart(900);
    }

    filterButtons.forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          const selected =
            button.dataset.filter;

          filterButtons.forEach((btn) => {
            btn.classList.remove(
              "active"
            );
          });

          button.classList.add("active");

          applyBonusFilter(selected);
        }
      );
    });

    const activeFilterButton =
      pageRoot.querySelector(
        ".filter-btn.active"
      ) ||
      pageRoot.querySelector(
        '.filter-btn[data-filter="all"]'
      );

    if (activeFilterButton) {
      applyBonusFilter(
        activeFilterButton.dataset.filter
      );
    }

    /*
      BONUS TERMS

      Kept in JavaScript as well as in the
      HTML <template> elements.

      This prevents WordPress/template parsing
      from breaking the modal content.
    */

    function normalizeBonusTitle(text) {
      return normalizeButtonText(text)
        .replace(/[º°]/g, "o")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    }

    const BONUS_TERMS_SOURCE = {
      "1st Deposit Bonus": [
        {
          title: "Eligibility",
          content: `<ul>
<li>This offer is available to <strong>new players registered</strong> with BetSnipe.</li>
<li>Each player may receive only <strong>one Sports 1st Deposit Bonus of up to €150</strong>, linked to the <strong>1st deposit</strong>.</li>
<li>This bonus cannot be used together with other <strong>1st deposit promotions</strong>, unless expressly stated otherwise.</li>
<li>The offer is limited to <strong>one per person, address, household, IP address or device.</strong></li>
<li>Available only to players aged <strong>18 or over</strong>, in accordance with BetSnipe's <strong>Responsible Gambling</strong> policy.</li>
<li>After the <strong>qualifying deposit</strong>, the <strong>Free Bet</strong> is awarded in accordance with these rules and becomes available for selection in the <strong>bet slip.</strong></li>
</ul>`
        },

        {
          title: "Bonus Activation",
          content: `<ul>
<li>The bonus must be claimed during <strong>registration</strong> or in the <strong>“Bonuses”</strong> section, before the <strong>first deposit</strong>.</li>
<li>The <strong>minimum qualifying deposit</strong> is <strong>€10.</strong></li>
<li>Once the deposit is confirmed, the value of the <strong>Free Bet</strong> is calculated based on the amount deposited.</li>
<li>The <strong>Free Bet</strong> becomes available in the <strong>bet slip</strong>, under <strong>“Select bonus”.</strong></li>
</ul>`
        },

        {
          title:
            "Use and Wagering Requirements",
          content: `<ul>
<li>Only <strong>multiple bets</strong> with <strong>3 selections, each with minimum odds of 1.40</strong>, on <strong>Football, Basketball</strong> or <strong>Tennis</strong> markets qualify.</li>
<li>The <strong>Free Bet rollover</strong> is <strong>1x</strong>:
  <ul>
    <li>each <strong>Free Bet</strong> must be used <strong>once on a qualifying bet</strong>;</li>
    <li><strong>winnings</strong> obtained from the <strong>Free Bet</strong> are <strong>credited</strong> as <strong>real balance</strong> with an additional <strong>1x wagering requirement</strong> before they can be withdrawn.</li>
  </ul>
</li>
<li>The <strong>Free Bet</strong> works like a real-money bet where the <strong>stake amount is not returned</strong>:
  <ul>
    <li>if the bet <strong>loses</strong>, the Free Bet is lost;</li>
    <li>if the bet <strong>wins</strong>, only the <strong>profit, up to a maximum equal to the value of the Free Bet</strong>, is credited as <strong>real balance</strong> — the nominal value of the <strong>Free Bet</strong> is not returned.</li>
  </ul>
</li>
<li>The <strong>Free Bet</strong> cannot be used with <strong>full or partial Cash Out.</strong></li>
<li><strong>Voided, cancelled, refunded bets or bets with Cash Out</strong> (full or partial) <strong>do not count</strong> towards the Free Bet usage requirement.</li>
<li>Only <strong>settled bets</strong> (with a confirmed result) count towards <strong>winnings</strong> and completion of the <strong>rollover.</strong></li>
<li>The <strong>Free Bet</strong> is valid for <strong>1 day</strong> from the date it is credited; after this period, if it has not been used, it expires and is <strong>removed from the account.</strong></li>
<li><strong>Withdrawals</strong> are not permitted while the <strong>Free Bet</strong> is active and has not been used in accordance with these terms. However, the bonus may be cancelled on the terms and conditions page or automatically if a withdrawal is requested.</li>
</ul>`
        },

        {
          title: "General Terms",
          content: `<ul>
<li><strong>BetSnipe</strong> may request <strong>verification of identity, age, address or telephone contact</strong> before crediting winnings from the <strong>Bet Token</strong> or processing <strong>withdrawals.</strong></li>
<li><strong>Minimum-risk betting, arbitrage, betting on both sides of the same market, collusion between accounts</strong> or any pattern considered <strong>bonus abuse</strong> may result in the <strong>removal of the Free Bet</strong> and the <strong>voiding of winnings.</strong></li>
<li><strong>BetSnipe</strong> reserves the right to <strong>amend, suspend or cancel</strong> this promotion at any time, without prior notice, provided this does not adversely affect <strong>Free Bets already legitimately awarded.</strong></li>
<li>If, for any technical reason, the <strong>Free Bet</strong> is not automatically awarded after a <strong>qualifying deposit</strong>, you must contact <strong>customer support</strong> before you start betting with that balance.</li>
<li>In the event of a <strong>dispute</strong>, <strong>BetSnipe's decision is final and binding.</strong></li>
</ul>`
        }
      ],

      "Friday Bonus": [
        {
          title: "Eligibility",
          content: `<ul>
<li>This offer is available to players registered with BetSnipe who make a <strong>qualifying deposit on Friday</strong>, have <strong>wagered at least €40</strong> in the <strong>previous 7 days</strong>, <strong>placed 5 bets and made no withdrawal on the previous day</strong>.</li>
<li>Each player may receive this <strong>Friday Sports Deposit Bonus of up to €100</strong> only <strong>once per week</strong>, on Fridays.</li>
<li>This bonus cannot be used together with other <strong>deposit promotions</strong> applying to the same deposit, unless expressly stated otherwise.</li>
<li>The offer is limited to <strong>one per person, address, household, IP address or device, per week.</strong></li>
<li>Available only to players aged <strong>18 or over</strong>, in accordance with BetSnipe's <strong>Responsible Gambling</strong> policy.</li>
<li>After the <strong>qualifying deposit</strong>, the <strong>Free Bet</strong> is awarded in accordance with these rules and becomes available for selection in the bet slip.</li>
</ul>`
        },

        {
          title: "Bonus Activation",
          content: `<ul>
<li>The bonus must be claimed in the <strong>“Bonuses”</strong> section before making the <strong>qualifying Friday deposit</strong>.</li>
<li>The <strong>minimum qualifying deposit</strong> is <strong>€10.</strong></li>
<li>Once the deposit is confirmed, the value of the <strong>Free Bet</strong> is calculated based on the amount deposited, awarding <strong>100% up to €100.</strong></li>
<li>The <strong>Free Bet</strong> becomes available in the <strong>bet slip</strong>, under <strong>“Select bonus”.</strong></li>
</ul>`
        },

        {
          title:
            "Use and Wagering Requirements",
          content: `<ul>
<li>Only <strong>multiple bets</strong> with <strong>3 selections, each with minimum odds of 1.40</strong>, on Football, Basketball or Tennis markets qualify.</li>
<li>The <strong>Free Bet rollover</strong> is <strong>1x</strong>:
  <ul>
    <li>each <strong>Free Bet</strong> must be used <strong>once on a qualifying bet</strong>;</li>
    <li><strong>winnings</strong> obtained from the <strong>Free Bet</strong> are <strong>credited</strong> as <strong>real balance</strong> with an additional <strong>1x wagering requirement</strong> before they can be withdrawn.</li>
  </ul>
</li>
<li>The <strong>Free Bet</strong> works as a bet where the <strong>Free Bet value is not returned</strong>:
  <ul>
    <li>if the bet <strong>loses</strong>, the Free Bet is lost;</li>
    <li>if the bet <strong>wins</strong>, only the <strong>net profit, up to a maximum equal to the value of the Free Bet</strong>, is credited as <strong>real balance</strong>; the nominal value of the <strong>Free Bet</strong> is not returned.</li>
  </ul>
</li>
<li>The <strong>Free Bet</strong> cannot be used with <strong>full or partial Cash Out</strong>.</li>
<li><strong>Voided, cancelled, refunded bets or bets with Cash Out (full or partial)</strong> do not count towards the Free Bet usage requirement.</li>
<li>Only <strong>settled bets</strong> (with a confirmed result) count towards <strong>winnings</strong> and completion of the <strong>rollover.</strong></li>
<li>The <strong>Free Bet</strong> is valid for <strong>1 day</strong> from the date it is credited; after this period, if it has not been used, it expires and is <strong>removed from the account.</strong></li>
<li><strong>Withdrawals</strong> are not permitted while the <strong>Free Bet</strong> is active and has not been used in accordance with these terms.</li>
</ul>`
        },

        {
          title: "General Terms",
          content: `<ul>
<li><strong>BetSnipe</strong> may request <strong>verification of identity, age, address or telephone contact</strong> before crediting winnings from the <strong>Free Bet</strong> or processing associated <strong>withdrawals.</strong></li>
<li><strong>Minimum-risk betting, arbitrage, betting on both sides of the same market, collusion between accounts</strong> or any pattern considered <strong>bonus abuse</strong> may result in the <strong>removal of the Free Bet</strong> and the <strong>voiding of associated winnings.</strong></li>
<li><strong>BetSnipe</strong> reserves the right to <strong>amend, suspend or cancel</strong> this promotion at any time, without prior notice, provided this does not adversely affect <strong>Free Bets already legitimately awarded.</strong></li>
<li>If, for any technical reason, the <strong>Free Bet</strong> is not automatically awarded after a <strong>qualifying deposit</strong>, you must contact <strong>customer support</strong> before you start betting with that balance.</li>
<li>In the event of a <strong>dispute</strong>, <strong>BetSnipe's decision is final and binding.</strong></li>
<li>By taking part in this offer, you confirm that you have read and accepted these <strong>specific Terms and Conditions</strong>, as well as the <strong>BetSnipe General Terms and Conditions.</strong></li>
</ul>`
        }
      ],

      "1st Casino Deposit": [
        {
          title: "Eligibility",
          content: `<ul>
<li>Offer available only to new players registered with BetSnipe.</li>
<li>Each player may receive the Casino Welcome Bonus only once.</li>
<li>Limited to one account per person, address, household, IP address or device.</li>
<li>The bonus cannot be used together with other welcome promotions, unless expressly stated otherwise.</li>
<li>Available only to players aged 18 or over, in accordance with BetSnipe's Responsible Gambling Policy.</li>
</ul>`
        },

        {
          title: "Bonus Structure",
          content: `<p>The number of Free Spins awarded depends on the qualifying deposit amount:</p>
<ul>
<li><strong>€10 – €24.99</strong> → 75 Free Spins (€0.10 per spin)</li>
<li><strong>€25 – €49.99</strong> → 100 Free Spins (€0.10 per spin)</li>
<li><strong>€50 – €99.99</strong> → 150 Free Spins (€0.10 per spin)</li>
<li><strong>€100 – €200</strong> → 200 Free Spins (€0.10 per spin)</li>
</ul>
<p>BetSnipe determines the games eligible for the use of Free Spins.</p>`
        },

        {
          title: "Bonus Activation",
          content: `<ul>
<li>The bonus must be activated in the <strong>“Bonuses”</strong> section before making the deposit.</li>
<li>The Free Spins are credited automatically once the qualifying deposit is confirmed.</li>
<li>The Free Spins are valid for <strong>48 hours</strong> from the moment they are credited.</li>
<li>It is not possible to have more than one welcome bonus active at the same time.</li>
</ul>`
        },

        {
          title:
            "Use of Free Spins and Winnings",
          content: `<ul>
<li>Each Free Spin has a <strong>fixed value of €0.10.</strong></li>
<li>The Free Spins can only be used on the Startburst game.</li>
<li>The player has 2 days to use the Free Spins after they are credited.</li>
<li>Winnings obtained from Free Spins are subject to a <strong>1x wagering requirement (rollover)</strong>.</li>
<li>Once the rollover has been completed, the winnings are transferred directly to the real balance.</li>
<li>If the rollover is not completed within the validity period, the Free Spins and associated winnings will be voided.</li>
</ul>`
        },

        {
          title: "Winnings Limits",
          content: `<ul>
<li>The <strong>maximum winnings that can be converted into real balance</strong> from the Free Spins are <strong>€50.</strong></li>
<li>Any winnings above this limit are removed when the balance is converted to real money.</li>
</ul>`
        },

        {
          title:
            "Game Rules and Restrictions",
          content: `<ul>
<li>The Free Spins balance is separate from the real balance.</li>
<li>Low-risk gaming strategies, automated patterns, collusion between accounts or any form of bonus abuse may result in cancellation of the bonus and confiscation of winnings.</li>
<li>BetSnipe reserves the right to exclude specific games or providers from the promotion.</li>
</ul>`
        },

        {
          title:
            "Withdrawals and Verification",
          content: `<ul>
<li>Winnings converted into real balance can be withdrawn after the rollover has been completed.</li>
<li>BetSnipe may request identity, address or contact verification documents before processing any withdrawal.</li>
<li><strong>Withdrawals</strong> are not permitted while the <strong>bonus</strong> is active and has not been used in accordance with these terms. However, the bonus may be cancelled on the terms and conditions page or automatically if a withdrawal is requested.</li>
</ul>`
        },

        {
          title: "General Terms",
          content: `<ul>
<li>You may cancel the bonus at any time through your account, on the terms and conditions page; in that case, the Free Spins and associated winnings will be voided.</li>
<li>BetSnipe reserves the right to amend, suspend or end this promotion at any time, without prior notice.</li>
<li>In the event of a dispute, BetSnipe's decision is final and binding.</li>
<li>By activating this bonus, you confirm that you have read and accepted these Terms and Conditions, as well as the BetSnipe General Terms.</li>
</ul>`
        }
      ],

      "Wednesday Bonus": [
        {
          title: "Eligibility",
          content: `<ul>
<li>Offer available to players registered with BetSnipe who make a qualifying deposit on Wednesday.</li>
<li>Each player may receive the Wednesday Deposit Bonus once per week.</li>
<li>Limited to one account per person, address, household, IP address or device.</li>
<li>Available only to players aged 18 or over, in accordance with BetSnipe's Responsible Gambling Policy.</li>
</ul>`
        },

        {
          title:
            "Compatibility with Other Bonuses",
          content: `<ul>
<li>This bonus cannot be combined with any other promotions or offers.</li>
</ul>`
        },

        {
          title: "Eligible Deposits",
          content: `<ul>
<li><strong>Minimum deposit:</strong> €10.</li>
<li>Only deposits made in a single transaction are considered eligible.</li>
<li>The promotion is valid only on <strong>Wednesday, from 00:00 to 23:59.</strong></li>
</ul>`
        },

        {
          title: "Bonus Structure",
          content: `<p>The number of Free Spins awarded depends on the deposit amount:</p>
<ul>
<li><strong>€10 – €24.99</strong> → 40 Free Spins</li>
<li><strong>€25 – €49.99</strong> → 75 Free Spins</li>
<li><strong>€50 – €100</strong> → 120 Free Spins</li>
</ul>
<p>BetSnipe determines the games eligible for the use of Free Spins.</p>`
        },

        {
          title: "Bonus Activation",
          content: `<ul>
<li>The bonus must be activated in the “Bonuses” section before making the deposit.</li>
<li>The Free Spins are credited automatically once the qualifying deposit is confirmed.</li>
<li>To use the Free Spins, simply open the slot where they are available.</li>
</ul>`
        },

        {
          title:
            "Use of Free Spins and Winnings",
          content: `<ul>
<li>Each Free Spin has a <strong>fixed value of €0.10 per spin.</strong></li>
<li>The Free Spins can only be used on the Dead or Alive II game.</li>
<li>The Free Spins are subject to a 1x wagering requirement (rollover).</li>
<li>The player has <strong>1 day</strong> to use the Free Spins after they are credited.</li>
<li>Winnings obtained from Free Spins are paid directly into the real balance.</li>
<li>The <strong>maximum total winnings</strong> that can be converted into real balance through this promotion are <strong>€30.</strong></li>
<li>Any winnings above this limit will be removed at the time of conversion.</li>
</ul>`
        },

        {
          title:
            "Game Rules and Restrictions",
          content: `<ul>
<li>The Free Spins balance is separate from the real balance.</li>
<li>Low-risk gaming strategies, automated patterns, collusion between accounts or any form of bonus abuse may result in cancellation of the bonus and confiscation of winnings.</li>
<li>BetSnipe reserves the right to exclude specific games or providers from the promotion.</li>
</ul>`
        },

        {
          title:
            "Withdrawals and Verification",
          content: `<ul>
<li>Winnings paid into the real balance can be withdrawn in accordance with the BetSnipe General Terms.</li>
<li>BetSnipe may request identity, address or contact verification documents before processing withdrawals.</li>
</ul>`
        },

        {
          title: "General Terms",
          content: `<ul>
<li>You may cancel the bonus at any time; in that case, any unused Free Spins and associated winnings will be voided.</li>
<li>BetSnipe reserves the right to amend, suspend or end this promotion at any time, without prior notice.</li>
<li>In the event of a dispute, BetSnipe's decision is final and binding.</li>
<li>By taking part in this promotion, you confirm that you have read and accepted these Terms and Conditions, as well as the BetSnipe General Terms.</li>
</ul>`
        }
      ]
    };

    const BONUS_TERMS =
      Object.keys(
        BONUS_TERMS_SOURCE
      ).reduce((result, title) => {
        result[
          normalizeBonusTitle(title)
        ] = BONUS_TERMS_SOURCE[title];

        return result;
      }, {});

    const BONUS_TERMS_ALIASES = {
      "First Deposit Bonus":
        "1st Deposit Bonus",

      "1st Sports Deposit Bonus":
        "1st Deposit Bonus",

      "First Sports Deposit Bonus":
        "1st Deposit Bonus",

      "Sports 1st Deposit Bonus":
        "1st Deposit Bonus",

      "Sports First Deposit Bonus":
        "1st Deposit Bonus",

      "Bónus de 1º Depósito":
        "1st Deposit Bonus",

      "Friday Deposit Bonus":
        "Friday Bonus",

      "Sports Friday Bonus":
        "Friday Bonus",

      "Bónus de Sexta-feira":
        "Friday Bonus",

      "First Casino Deposit":
        "1st Casino Deposit",

      "1st Deposit Casino":
        "1st Casino Deposit",

      "Casino First Deposit":
        "1st Casino Deposit",

      "Casino 1st Deposit":
        "1st Casino Deposit",

      "Casino Welcome Bonus":
        "1st Casino Deposit",

      "1º Depósito Casino":
        "1st Casino Deposit",

      "Wednesday Deposit Bonus":
        "Wednesday Bonus",

      "Casino Wednesday Bonus":
        "Wednesday Bonus",

      "Bónus de Quarta-feira":
        "Wednesday Bonus"
    };

    Object.keys(
      BONUS_TERMS_ALIASES
    ).forEach((aliasTitle) => {
      const sourceTitle =
        BONUS_TERMS_ALIASES[aliasTitle];

      const sourceKey =
        normalizeBonusTitle(
          sourceTitle
        );

      const aliasKey =
        normalizeBonusTitle(
          aliasTitle
        );

      if (BONUS_TERMS[sourceKey]) {
        BONUS_TERMS[aliasKey] =
          BONUS_TERMS[sourceKey];
      }
    });

    function getModalSectionsFromCard(
      card
    ) {
      if (!card) return [];

      const holder =
        card.querySelector(
          ".modal-sections-template"
        );

      if (holder) {
        const sourceRoot =
          holder.tagName === "TEMPLATE" &&
          holder.content
            ? holder.content
            : holder;

        const holderSections =
          Array.from(
            sourceRoot.querySelectorAll(
              ".modal-section"
            )
          );

        if (holderSections.length) {
          return holderSections.map(
            (section, index) => ({
              title:
                section.dataset.title ||
                `Section ${index + 1}`,

              content:
                section.innerHTML.trim()
            })
          );
        }
      }

      return Array.from(
        card.querySelectorAll(
          ".modal-section"
        )
      ).map((section, index) => ({
        title:
          section.dataset.title ||
          `Section ${index + 1}`,

        content:
          section.innerHTML.trim()
      }));
    }

    function getTermsForCard(card) {
      if (!card) return [];

      const title =
        card.dataset.modalTitle || "";

      const key =
        normalizeBonusTitle(title);

      const embeddedTerms =
        BONUS_TERMS[key];

      if (
        embeddedTerms &&
        embeddedTerms.length
      ) {
        return embeddedTerms;
      }

      return getModalSectionsFromCard(
        card
      );
    }

    function buildAccordionFromCard(
      card
    ) {
      if (!accordion || !card) return;

      const sections =
        getTermsForCard(card);

      if (!sections.length) {
        accordion.innerHTML = `
          <div class="acc-item active">
            <button
              class="acc-trigger"
              type="button"
              aria-expanded="true"
            >
              <span class="acc-title">
                Promotion terms
              </span>

              <span
                class="acc-chevron"
                aria-hidden="true"
              ></span>
            </button>

            <div class="acc-content">
              <p>
                Terms for this promotion have not yet been configured.
              </p>
            </div>
          </div>
        `;

        return;
      }

      accordion.innerHTML = sections
        .map((section, index) => {
          const title =
            section.title ||
            `Section ${index + 1}`;

          const content =
            section.content || "";

          const isActive =
            index === 0;

          return `
            <div class="acc-item ${
              isActive ? "active" : ""
            }">
              <button
                class="acc-trigger"
                type="button"
                aria-expanded="${
                  isActive
                    ? "true"
                    : "false"
                }"
              >
                <span class="acc-title">
                  ${title}
                </span>

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
          card.dataset.modalTitle ||
          "Bonus Lootbox";
      }

      if (modalDescription) {
        modalDescription.textContent =
          card.dataset.modalDescription ||
          "";
      }

      buildAccordionFromCard(card);

      const cardImage =
        card.querySelector(
          ".bonus-image img, .worldcup-banner-img-desktop, .worldcup-banner-img"
        );

      if (cardImage && modalImage) {
        modalImage.src =
          cardImage.src;

        modalImage.alt =
          cardImage.alt ||
          (modalTitle
            ? modalTitle.textContent
            : "");
      }

      modal.classList.add("is-open");

      modal.setAttribute(
        "aria-hidden",
        "false"
      );

      document.body.style.overflow =
        "hidden";
    }

    function closeModal() {
      modal.classList.remove("is-open");

      modal.setAttribute(
        "aria-hidden",
        "true"
      );

      document.body.style.overflow = "";
    }

    pageRoot.addEventListener(
      "click",
      (event) => {
        const button =
          event.target.closest(
            ".open-modal"
          );

        if (
          !button ||
          !pageRoot.contains(button)
        ) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        const card =
          button.closest(
            ".bonus-card, .worldcup-banner"
          );

        openModalFromCard(card);
      },
      true
    );

    if (closeModalBtn) {
      closeModalBtn.addEventListener(
        "click",
        closeModal
      );
    }

    modal.addEventListener(
      "click",
      (event) => {
        if (event.target === modal) {
          closeModal();
        }
      }
    );

    const handleEscape = (event) => {
      if (!pageRoot.isConnected) {
        document.removeEventListener(
          "keydown",
          handleEscape
        );

        return;
      }

      if (
        event.key === "Escape" &&
        modal.classList.contains(
          "is-open"
        )
      ) {
        closeModal();
      }
    };

    document.addEventListener(
      "keydown",
      handleEscape
    );

    if (accordion) {
      accordion.addEventListener(
        "click",
        (event) => {
          const trigger =
            event.target.closest(
              ".acc-trigger"
            );

          if (!trigger) return;

          event.preventDefault();
          event.stopPropagation();

          const item =
            trigger.closest(
              ".acc-item"
            );

          if (!item) return;

          const isActive =
            item.classList.contains(
              "active"
            );

          accordion
            .querySelectorAll(
              ".acc-item"
            )
            .forEach((accItem) => {
              accItem.classList.remove(
                "active"
              );

              const accTrigger =
                accItem.querySelector(
                  ".acc-trigger"
                );

              if (accTrigger) {
                accTrigger.setAttribute(
                  "aria-expanded",
                  "false"
                );
              }
            });

          if (!isActive) {
            item.classList.add(
              "active"
            );

            trigger.setAttribute(
              "aria-expanded",
              "true"
            );
          }
        },
        true
      );
    }

    function enableHorizontalDrag(
      selector
    ) {
      pageRoot
        .querySelectorAll(selector)
        .forEach((scroller) => {
          let isDown = false;
          let startX = 0;
          let scrollLeft = 0;

          scroller.addEventListener(
            "pointerdown",
            (event) => {
              if (
                event.pointerType !==
                "mouse"
              ) {
                return;
              }

              isDown = true;

              startX =
                event.pageX -
                scroller.offsetLeft;

              scrollLeft =
                scroller.scrollLeft;

              scroller.style.cursor =
                "grabbing";
            }
          );

          scroller.addEventListener(
            "pointerleave",
            () => {
              isDown = false;

              scroller.style.cursor =
                "";
            }
          );

          scroller.addEventListener(
            "pointerup",
            () => {
              isDown = false;

              scroller.style.cursor =
                "";
            }
          );

          scroller.addEventListener(
            "pointermove",
            (event) => {
              if (!isDown) return;

              event.preventDefault();

              const x =
                event.pageX -
                scroller.offsetLeft;

              const walk =
                (x - startX) * 1.2;

              scroller.scrollLeft =
                scrollLeft - walk;
            }
          );
        });
    }

    enableHorizontalDrag(
      ".store-grid"
    );

    const carousel =
      pageRoot.querySelector(
        "#heroCarousel"
      );

    if (!carousel) return;

    const slides =
      carousel.querySelectorAll(
        ".hero-slide"
      );

    const dots =
      carousel.querySelectorAll(
        ".carousel-dot"
      );

    if (
      !slides.length ||
      !dots.length
    ) {
      return;
    }

    let currentSlide = 0;
    let carouselTimer = null;

    const carouselDelay = 5000;

    function goToSlide(index) {
      currentSlide = index;

      slides.forEach(
        (slide, slideIndex) => {
          slide.classList.toggle(
            "is-active",
            slideIndex ===
              currentSlide
          );
        }
      );

      dots.forEach(
        (dot, dotIndex) => {
          dot.classList.toggle(
            "is-active",
            dotIndex ===
              currentSlide
          );
        }
      );
    }

    function nextSlide() {
      goToSlide(
        (currentSlide + 1) %
          slides.length
      );
    }

    function stopCarousel() {
      if (carouselTimer) {
        window.clearInterval(
          carouselTimer
        );

        carouselTimer = null;
      }
    }

    function startCarousel() {
      stopCarousel();

      /*
        Não iniciamos um timer numa instância
        que já saiu do DOM.
      */
      if (!pageRoot.isConnected) {
        return;
      }

      carouselTimer =
        window.setInterval(() => {
          if (!pageRoot.isConnected) {
            stopCarousel();
            return;
          }

          nextSlide();
        }, carouselDelay);
    }

    dots.forEach((dot) => {
      dot.addEventListener(
        "click",
        () => {
          goToSlide(
            Number(
              dot.dataset.slide
            )
          );

          startCarousel();
        }
      );
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
  }

  function scanForPromoPage() {
    /*
      Muito importante quando PT e EN coexistem
      na mesma aplicação SPA.

      O observer inglês só inicializa páginas
      quando estamos realmente numa rota /en.
    */
    if (!isEnglishRoute()) {
      return;
    }

    const pageRoot =
      document.querySelector(
        ROOT_SELECTOR
      );

    if (!pageRoot) {
      return;
    }

    showPage(pageRoot);
    initPage(pageRoot);
  }

  /*
    O script fica carregado no window.

    Quando a plataforma remove a página e a
    adiciona novamente sem fazer refresh,
    este observer encontra a nova instância
    e volta a inicializá-la.
  */
  if (
    !window.__betsnipePromoEnSpaObserver
  ) {
    const startObserver = () => {
      if (
        !document.body ||
        window.__betsnipePromoEnSpaObserver
      ) {
        return;
      }

      const observer =
        new MutationObserver(() => {
          scanForPromoPage();
        });

      observer.observe(
        document.body,
        {
          childList: true,
          subtree: true
        }
      );

      window.__betsnipePromoEnSpaObserver =
        observer;
    };

    if (document.body) {
      startObserver();
    } else {
      document.addEventListener(
        "DOMContentLoaded",
        startObserver,
        { once: true }
      );
    }
  }

  /*
    Hook manual de diagnóstico.

    Na consola podes executar:
    window.__betsnipePromoEnScan()
  */
  window.__betsnipePromoEnScan =
    scanForPromoPage;

  /*
    Primeiro carregamento normal.
  */
  scanForPromoPage();
})();
