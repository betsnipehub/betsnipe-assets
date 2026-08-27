(function () {
  const BETSNIPE_PROMO_VERSION = "v21";
  const ROOT_SELECTOR = "#betsnipe-promo-page-pt";

  function showPage(pageRoot) {
    if (!pageRoot) return;

    pageRoot.classList.remove("bs-loading");
    pageRoot.classList.add("bs-ready");
  }

  function initPage(pageRoot) {
    if (!pageRoot) return;

    // Garante visibilidade em carregamento normal e em navegacao interna/SPA.
    showPage(pageRoot);

    // Se a SPA ainda estiver a montar os filhos do <main>, esperamos pela
    // proxima mutacao em vez de marcar a pagina como inicializada cedo demais.
    const requiredMarkupReady =
      pageRoot.querySelector("#bonusGrid") &&
      pageRoot.querySelector("#bonusModal") &&
      pageRoot.querySelector("#heroCarousel");

    if (!requiredMarkupReady) {
      return;
    }

    // Cada nova instancia do <main> e inicializada uma vez.
    // Nao usamos uma flag global de versao, porque o window sobrevive na SPA.
    if (
      pageRoot.dataset.betsnipePromoLoaded === "true" &&
      pageRoot.dataset.betsnipePromoVersion === BETSNIPE_PROMO_VERSION
    ) {
      return;
    }

    pageRoot.dataset.betsnipePromoLoaded = "true";
    pageRoot.dataset.betsnipePromoVersion = BETSNIPE_PROMO_VERSION;

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
      event.stopPropagation();

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

    pageRoot.addEventListener("click", handleAuthActionClick, true);

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
      TERMOS DOS BÓNUS

      Os quatro bónus atuais ficam também definidos no JavaScript. Isto evita
      depender do comportamento do WordPress com <template> e garante que o
      modal recebe os termos mesmo que o markup oculto seja removido/alterado.

      Para promoções futuras, continuamos a aceitar as secções presentes no DOM
      através de .modal-sections-template / .modal-section.
    */
    function normalizeBonusTitle(text) {
      return normalizeButtonText(text)
        .replace(/[º°]/g, "o")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    }

    const BONUS_TERMS_SOURCE = {
      "Bónus de 1º Depósito": [
        {
          title: "Elegibilidade",
          content: `<ul>
<li>Esta oferta está disponível para <strong>novos jogadores registados</strong> na BetSnipe.</li>
<li>Cada jogador pode receber apenas <strong>um Bónus de 1º Depósito Desporto até 150€</strong> associado ao <strong>1.º depósito</strong>.</li>
<li>Este bónus não pode ser usado em conjunto com outras <strong>promoções de 1.º depósito</strong>, salvo indicação expressa em contrário.</li>
<li>A oferta é limitada a <strong>uma por pessoa, morada, agregado familiar, IP ou dispositivo.</strong></li>
<li>Disponível apenas para jogadores com <strong>18 anos ou mais</strong>, em conformidade com a política de <strong>Jogo Responsável</strong> da BetSnipe.</li>
<li>Após o <strong>depósito qualificado</strong>, a <strong>Aposta Grátis</strong> é atribuída de acordo com estas regras, ficando disponível para seleção no <strong>boletim de apostas.</strong></li>
</ul>`
        },
        {
          title: "Ativação do Bónus",
          content: `<ul>
<li>O bónus deve ser solicitado durante o <strong>registo</strong> ou na secção <strong>“Bónus”</strong>, antes do <strong>primeiro depósito</strong>.</li>
<li>O <strong>depósito mínimo qualificado</strong> é de <strong>10 €.</strong></li>
<li>Assim que o depósito for confirmado, o valor da <strong>Aposta Grátis</strong> é calculado com base no montante depositado.</li>
<li>A <strong>Aposta Grátis</strong> fica disponível no <strong>boletim de apostas</strong>, na área <strong>“Selecionar bónus”.</strong></li>
</ul>`
        },
        {
          title: "Utilização e Requisitos de Aposta",
          content: `<ul>
<li>Só contam <strong>apostas múltiplas</strong> com <strong>3 seleções de odd mínima 1.40</strong> em mercados de <strong>Futebol, Basquetebol</strong> ou <strong>Ténis.</strong></li>
<li>O <strong>rollover</strong> da Aposta Grátis é de <strong>1x</strong>:
<ul>
<li>cada <strong>Aposta Grátis</strong> deve ser utilizada <strong>numa aposta qualificada uma vez</strong>;</li>
<li>os <strong>ganhos</strong> obtidos com a <strong>Aposta Grátis</strong> são <strong>creditados</strong> como <strong>saldo real</strong> com um <strong>requisito</strong> de aposta (rollover) adicional de 1x antes de poderem ser levantados.</li>
</ul>
</li>
<li>A <strong>Aposta Grátis</strong> funciona como uma aposta com saldo real em que o <strong>valor da aposta não é devolvido</strong>:
<ul>
<li>se a aposta for <strong>perdedora</strong>, Aposta Grátis é perdida;</li>
<li>se a aposta for <strong>vencedora</strong>, apenas o <strong>lucro, até um limite máximo igual ao valor da Aposta Grátis</strong>, é creditado como <strong>saldo real</strong> — o valor nominal da <strong>Aposta Grátis</strong> não é devolvido.</li>
</ul>
</li>
<li>A <strong>Aposta Grátis</strong> não pode ser utilizado em <strong>Cash Out total ou parcial.</strong></li>
<li><strong>Apostas anuladas, canceladas, devolvidas ou com Cash Out</strong> (total ou parcial) <strong>não contam</strong> para o requisito de utilização da <strong>Aposta Grátis.</strong></li>
<li>Só <strong>apostas liquidadas</strong> contam para efeitos de <strong>ganhos</strong> e cumprimento do <strong>rollover.</strong></li>
<li>A <strong>Aposta Grátis</strong> tem uma <strong>validade limitada de 1 dia</strong>.</li>
<li>Não são permitidos <strong>levantamentos</strong> enquanto a <strong>Aposta Grátis</strong> estiver ativa e não tiver sido utilizada de acordo com estes termos.</li>
</ul>`
        },
        {
          title: "Termos Gerais",
          content: `<ul>
<li>A <strong>BetSnipe</strong> pode solicitar <strong>verificação de identidade, idade, morada ou contacto telefónico</strong> antes de creditar ganhos ou processar levantamentos.</li>
<li><strong>Apostas de risco mínimo, arbitragem, apostas em ambos os lados do mesmo mercado, conluio entre contas</strong> ou qualquer padrão considerado <strong>abuso de bónus</strong> podem levar à remoção da Aposta Grátis e à anulação de ganhos.</li>
<li>A <strong>BetSnipe</strong> reserva-se o direito de alterar, suspender ou cancelar esta promoção.</li>
<li>Em caso de <strong>disputa</strong>, a decisão da <strong>BetSnipe é final e vinculativa.</strong></li>
</ul>`
        }
      ],

      "Bónus de Sexta-feira": [
        {
          title: "Elegibilidade",
          content: `<ul>
<li>Esta oferta está disponível para jogadores registados na BetSnipe que efetuem um <strong>depósito qualificado à sexta-feira</strong>, tenham <strong>apostado no mínimo 40 euros</strong> nos <strong>últimos 7 dias</strong>, <strong>colocado 5 apostas e não efectuado um levantamento no dia anterior</strong>.</li>
<li>Cada jogador pode receber este bónus apenas uma vez por semana.</li>
<li>A oferta é limitada a uma por pessoa, morada, agregado familiar, IP ou dispositivo, por semana.</li>
<li>Disponível apenas para jogadores com 18 anos ou mais.</li>
</ul>`
        },
        {
          title: "Ativação do Bónus",
          content: `<ul>
<li>O bónus deve ser solicitado na secção <strong>“Bónus”</strong> antes do depósito qualificado.</li>
<li>O <strong>depósito mínimo qualificado</strong> é de <strong>10 €.</strong></li>
<li>É atribuída uma <strong>Aposta Grátis de 100% até 100 €.</strong></li>
<li>A Aposta Grátis fica disponível no boletim de apostas.</li>
</ul>`
        },
        {
          title: "Utilização e Requisitos de Aposta",
          content: `<ul>
<li>Só contam <strong>apostas múltiplas</strong> com <strong>3 seleções de odd mínima 1.40</strong>.</li>
<li>O rollover da Aposta Grátis é de <strong>1x</strong>.</li>
<li>Os ganhos ficam sujeitos a rollover adicional de 1x.</li>
<li>A Aposta Grátis não pode ser utilizada em Cash Out.</li>
<li>A validade da Aposta Grátis é de <strong>1 dia</strong>.</li>
</ul>`
        },
        {
          title: "Termos Gerais",
          content: `<ul>
<li>A BetSnipe pode solicitar verificação de identidade.</li>
<li>Abuso de bónus pode resultar em remoção do bónus e anulação de ganhos.</li>
<li>A BetSnipe reserva-se o direito de alterar, suspender ou cancelar esta promoção.</li>
</ul>`
        }
      ],

      "1º Depósito Casino": [
        {
          title: "Elegibilidade",
          content: `<ul>
<li>Oferta disponível apenas para novos jogadores registados na BetSnipe.</li>
<li>Cada jogador pode receber o Bónus de Boas-Vindas Casino apenas uma vez.</li>
<li>Limitado a uma conta por pessoa, morada, agregado familiar, IP ou dispositivo.</li>
<li>Disponível apenas para jogadores com 18 anos ou mais.</li>
</ul>`
        },
        {
          title: "Estrutura do Bónus",
          content: `<p>O número de Rodadas Grátis depende do valor do depósito:</p>
<ul>
<li><strong>10€ – 24,99€</strong> → 75 Rodadas Grátis</li>
<li><strong>25€ – 49,99€</strong> → 100 Rodadas Grátis</li>
<li><strong>50€ – 99,99€</strong> → 150 Rodadas Grátis</li>
<li><strong>100€ – 200€</strong> → 200 Rodadas Grátis</li>
</ul>`
        },
        {
          title: "Ativação do Bónus",
          content: `<ul>
<li>O bónus deve ser ativado na secção <strong>“Bónus”</strong> antes de realizares o depósito.</li>
<li>As Rodadas Grátis são creditadas automaticamente.</li>
<li>As Rodadas Grátis têm validade de <strong>48 horas</strong>.</li>
</ul>`
        },
        {
          title: "Utilização das Rodadas Grátis e Ganhos",
          content: `<ul>
<li>Cada Rodada Grátis tem um valor fixo de <strong>0,10€.</strong></li>
<li>As Rodadas Grátis só podem ser utilizadas no jogo Starburst.</li>
<li>Os ganhos estão sujeitos a rollover de <strong>1x</strong>.</li>
<li>Após cumprires o rollover, os ganhos passam para saldo real.</li>
</ul>`
        },
        {
          title: "Limites de Ganhos",
          content: `<ul>
<li>O ganho máximo que pode ser convertido em saldo real é de <strong>50€.</strong></li>
</ul>`
        },
        {
          title: "Regras de Jogo e Restrições",
          content: `<ul>
<li>O saldo de Rodadas Grátis é separado do saldo real.</li>
<li>Abuso de bónus pode resultar no cancelamento do bónus e confiscação dos ganhos.</li>
</ul>`
        },
        {
          title: "Levantamentos e Verificação",
          content: `<ul>
<li>Os ganhos convertidos para saldo real podem ser levantados após o cumprimento do rollover.</li>
<li>A BetSnipe pode solicitar documentos de verificação.</li>
</ul>`
        },
        {
          title: "Termos Gerais",
          content: `<ul>
<li>Podes cancelar o bónus a qualquer momento.</li>
<li>A BetSnipe reserva-se o direito de alterar, suspender ou encerrar esta promoção.</li>
<li>Em caso de disputa, a decisão da BetSnipe é final e vinculativa.</li>
</ul>`
        }
      ],

      "Bónus de Quarta-feira": [
        {
          title: "Elegibilidade",
          content: `<ul>
<li>Oferta disponível para jogadores registados na BetSnipe que realizem um depósito qualificado à quarta-feira.</li>
<li>Cada jogador pode receber o bónus uma vez por semana.</li>
<li>Disponível apenas para jogadores com 18 anos ou mais.</li>
</ul>`
        },
        {
          title: "Compatibilidade com Outros Bónus",
          content: `<ul>
<li>Não é permitido acumular este bónus com outras promoções.</li>
</ul>`
        },
        {
          title: "Depósitos Elegíveis",
          content: `<ul>
<li><strong>Depósito mínimo:</strong> 10€.</li>
<li>Apenas depósitos numa única transação.</li>
<li>Promoção válida à quarta-feira entre as 00:00 e as 23:59.</li>
</ul>`
        },
        {
          title: "Estrutura do Bónus",
          content: `<ul>
<li><strong>10€ – 24,99€</strong> → 40 Rodadas Grátis</li>
<li><strong>25€ – 49,99€</strong> → 75 Rodadas Grátis</li>
<li><strong>50€ – 100€</strong> → 120 Rodadas Grátis</li>
</ul>`
        },
        {
          title: "Ativação do Bónus",
          content: `<ul>
<li>O bónus deve ser ativado na secção “Bónus” antes do depósito.</li>
<li>As Rodadas Grátis são creditadas automaticamente.</li>
</ul>`
        },
        {
          title: "Utilização das Rodadas Grátis e Ganhos",
          content: `<ul>
<li>Cada Rodada Grátis tem valor de <strong>0,10€.</strong></li>
<li>As Rodadas Grátis são utilizadas no jogo Dead or Alive II.</li>
<li>Estão sujeitas a rollover de 1x.</li>
<li>O jogador dispõe de <strong>1 dia</strong> para as utilizar.</li>
<li>O ganho máximo convertido em saldo real é de <strong>30€.</strong></li>
</ul>`
        },
        {
          title: "Regras de Jogo e Restrições",
          content: `<ul>
<li>O saldo de Rodadas Grátis é separado do saldo real.</li>
<li>Abuso de bónus pode resultar no cancelamento do bónus.</li>
</ul>`
        },
        {
          title: "Levantamentos e Verificação",
          content: `<ul>
<li>Os ganhos pagos em saldo real podem ser levantados de acordo com os Termos Gerais da BetSnipe.</li>
<li>A BetSnipe pode solicitar documentos de verificação.</li>
</ul>`
        },
        {
          title: "Termos Gerais",
          content: `<ul>
<li>Podes cancelar o bónus a qualquer momento.</li>
<li>A BetSnipe reserva-se o direito de alterar, suspender ou encerrar esta promoção.</li>
<li>Em caso de disputa, a decisão da BetSnipe é final e vinculativa.</li>
</ul>`
        }
      ]
    };

    const BONUS_TERMS = Object.keys(BONUS_TERMS_SOURCE).reduce(
      (result, title) => {
        result[normalizeBonusTitle(title)] = BONUS_TERMS_SOURCE[title];
        return result;
      },
      {}
    );

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
          return holderSections.map((section, index) => ({
            title: section.dataset.title || `Secção ${index + 1}`,
            content: section.innerHTML.trim()
          }));
        }
      }

      return Array.from(card.querySelectorAll(".modal-section")).map(
        (section, index) => ({
          title: section.dataset.title || `Secção ${index + 1}`,
          content: section.innerHTML.trim()
        })
      );
    }

    function getTermsForCard(card) {
      if (!card) return [];

      const title = card.dataset.modalTitle || "";
      const key = normalizeBonusTitle(title);
      const embeddedTerms = BONUS_TERMS[key];

      if (embeddedTerms && embeddedTerms.length) {
        return embeddedTerms;
      }

      return getModalSectionsFromCard(card);
    }

    function buildAccordionFromCard(card) {
      if (!accordion || !card) return;

      const sections = getTermsForCard(card);

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
          const title = section.title || `Secção ${index + 1}`;
          const content = section.content || "";
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

    pageRoot.addEventListener(
      "click",
      (event) => {
        const button = event.target.closest(".open-modal");

        if (!button || !pageRoot.contains(button)) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        const card = button.closest(
          ".bonus-card, .worldcup-banner"
        );

        openModalFromCard(card);
      },
      true
    );

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
      accordion.addEventListener(
        "click",
        (event) => {
          const trigger = event.target.closest(".acc-trigger");

          if (!trigger) return;

          event.preventDefault();
          event.stopPropagation();

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
        },
        true
      );
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
  }

  function scanForPromoPage() {
    const pageRoot = document.querySelector(ROOT_SELECTOR);

    if (pageRoot) {
      initPage(pageRoot);
    }
  }

  /*
    A plataforma pode trocar o conteudo sem recarregar o documento.
    Este observer fica vivo e inicializa qualquer nova instancia da pagina.
  */
  if (!window.__betsnipePromoSpaObserver) {
    const startObserver = () => {
      if (!document.body || window.__betsnipePromoSpaObserver) return;

      const observer = new MutationObserver(() => {
        scanForPromoPage();
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      window.__betsnipePromoSpaObserver = observer;
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

  // Hook opcional para verificacao manual.
  window.__betsnipePromoScan = scanForPromoPage;

  // Primeiro carregamento.
  scanForPromoPage();
})();
