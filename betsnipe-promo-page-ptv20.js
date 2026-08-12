(function () {
  const pageRoot = document.getElementById("betsnipe-promo-page-pt");
  if (!pageRoot) return;

  const BETSNIPE_PROMO_VERSION = "v20";

  if (window.__betsnipePromoLoadedVersion === BETSNIPE_PROMO_VERSION) {
    return;
  }

  window.__betsnipePromoLoadedVersion = BETSNIPE_PROMO_VERSION;

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

  pageRoot.dataset.betsnipePromoLoaded = "true";
  pageRoot.dataset.betsnipePromoVersion = BETSNIPE_PROMO_VERSION;

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

  const BONUS_TERMS_SOURCE =
  {
    "Bónus de 1º Depósito": [
      {
        "title": "Elegibilidade",
        "content": "<ul>\n<li>Esta oferta está disponível para <strong>novos jogadores registados</strong> na BetSnipe.</li>\n<li>Cada jogador pode receber apenas <strong>um Bónus de 1º Depósito Desporto até 150€</strong> associado ao <strong>1.º depósito</strong>.</li>\n<li>Este bónus não pode ser usado em conjunto com outras <strong>promoções de 1.º depósito</strong>, salvo indicação expressa em contrário.</li>\n<li>A oferta é limitada a <strong>uma por pessoa, morada, agregado familiar, IP ou dispositivo.</strong></li>\n<li>Disponível apenas para jogadores com <strong>18 anos ou mais</strong>, em conformidade com a política de <strong>Jogo Responsável</strong> da BetSnipe.</li>\n<li>Após o <strong>depósito qualificado</strong>, a <strong>Aposta Grátis</strong> é atribuída de acordo com estas regras, ficando disponível para seleção no <strong>boletim de apostas.</strong></li>\n</ul>"
      },
      {
        "title": "Ativação do Bónus",
        "content": "<ul>\n<li>O bónus deve ser solicitado durante o <strong>registo</strong> ou na secção <strong>“Bónus”</strong>, antes do <strong>primeiro depósito</strong>.</li>\n<li>O <strong>depósito mínimo qualificado</strong> é de <strong>10 €.</strong></li>\n<li>Assim que o depósito for confirmado, o valor da <strong>Aposta Grátis</strong> é calculado com base no montante depositado.</li>\n<li>A <strong>Aposta Grátis</strong> fica disponível no <strong>boletim de apostas</strong>, na área <strong>“Selecionar bónus”.</strong></li>\n</ul>"
      },
      {
        "title": "Utilização e Requisitos de Aposta",
        "content": "<ul>\n<li>Só contam <strong>apostas múltiplas</strong> com <strong>3 seleções de odd mínima 1.40</strong> em mercados de <strong>Futebol, Basquetebol</strong> ou <strong>Ténis.</strong></li>\n<li>O <strong>rollover</strong> da Aposta Grátis é de <strong>1x</strong>:\n        <ul>\n<li>cada <strong>Aposta Grátis</strong> deve ser utilizada <strong>numa aposta qualificada uma vez</strong>;</li>\n<li>os <strong>ganhos</strong> obtidos com a <strong>Aposta Grátis</strong> são <strong>creditados</strong> como <strong>saldo real</strong> com um <strong>requisito</strong> de aposta (rollover) adicional de 1x antes de poderem ser levantados.</li>\n</ul>\n</li>\n<li>A <strong>Aposta Grátis</strong> funciona como uma aposta com saldo real em que o <strong>valor da aposta não é devolvido</strong>:\n        <ul>\n<li>se a aposta for <strong>perdedora</strong>, Aposta Grátis é perdida;</li>\n<li>se a aposta for <strong>vencedora</strong>, apenas o <strong>lucro, até um limite máximo igual ao valor da Aposta Grátis</strong>, é creditado como <strong>saldo real</strong> — o valor nominal da <strong>Aposta Grátis</strong> não é devolvido.</li>\n</ul>\n</li>\n<li>A <strong>Aposta Grátis</strong> não pode ser utilizado em <strong>Cash Out total ou parcial.</strong></li>\n<li><strong>Apostas anuladas, canceladas, devolvidas ou com Cash Out</strong> (total ou parcial) <strong>não contam</strong> para o requisito de utilização da <strong>Aposta Grátis.</strong></li>\n<li>Só <strong>apostas liquidadas</strong> (com resultado confirmado) contam para efeitos de <strong>ganhos</strong> e cumprimento do <strong>rollover.</strong></li>\n<li>A <strong>Aposta Grátis</strong> tem uma <strong>validade limitada de 1 dia</strong> a contar da data em que é creditado; após esse prazo, se não for utilizado, expira e é <strong>removido da conta.</strong></li>\n<li>Não são permitidos <strong>levantamentos</strong> enquanto a <strong>Aposta Grátis</strong> estiver ativa e não tiver sido utilizado de acordo com estes termos. No entanto, o bónus pode ser cancelado na página dos termos e condições ou automaticamente caso um levantamento seja requisitado.</li>\n</ul>"
      },
      {
        "title": "Termos Gerais",
        "content": "<ul>\n<li>A <strong>BetSnipe</strong> pode solicitar <strong>verificação de identidade, idade, morada ou contacto telefónico</strong> antes de creditar ganhos provenientes do <strong>Token de Aposta</strong> ou processar <strong>levantamentos.</strong></li>\n<li><strong>Apostas de risco mínimo, arbitragem, apostas em ambos os lados do mesmo mercado, conluio entre contas</strong> ou qualquer padrão considerado <strong>abuso de bónus</strong> podem levar à <strong>remoção da Aposta Grátis</strong> e à <strong>anulação de ganhos.</strong></li>\n<li>A <strong>BetSnipe</strong> reserva-se o direito de <strong>alterar, suspender ou cancelar</strong> esta promoção a qualquer momento, sem aviso prévio, desde que tal não prejudique <strong>Apostas Grátis já atribuídas</strong> de forma legítima.</li>\n<li>Se, por qualquer motivo técnico, a <strong>Aposta Grátis</strong> não for atribuída automaticamente após um <strong>depósito qualificado</strong>, deves contactar o <strong>apoio ao cliente</strong> antes de começares a apostar com esse saldo.</li>\n<li>Em caso de <strong>disputa</strong>, a decisão da <strong>BetSnipe é final e vinculativa.</strong></li>\n</ul>"
      }
    ],
    "Bónus de Sexta-feira": [
      {
        "title": "Elegibilidade",
        "content": "<ul>\n<li>Esta oferta está disponível para jogadores registados na BetSnipe que efetuem um <strong>depósito qualificado à sexta-feira</strong>, tenham <strong>apostado no mínimo 40 euros</strong> nos <strong>últimos 7 dias</strong>, <strong>colocado 5 apostas e não efectuado um levantamento no dia anterior</strong>.</li>\n<li>Cada jogador pode receber este <strong>Bónus de Depósito Sexta-Feira Desporto até 100€</strong> apenas <strong>uma vez por semana</strong>, às sextas-feiras.</li>\n<li>Este bónus não pode ser usado em conjunto com outras <strong>promoções de depósito</strong> que incidam sobre o mesmo depósito, salvo indicação expressa em contrário.</li>\n<li>A oferta é limitada a <strong>uma por pessoa, morada, agregado familiar, IP ou dispositivo, por semana.</strong></li>\n<li>Disponível apenas para jogadores com <strong>18 anos ou mais</strong>, em conformidade com a política de <strong>Jogo Responsável</strong> da BetSnipe.</li>\n<li>Após o <strong>depósito qualificado</strong>, a <strong>Aposta Grátis</strong> é atribuído de acordo com estas regras, ficando disponível para seleção no boletim de apostas.</li>\n</ul>"
      },
      {
        "title": "Ativação do Bónus",
        "content": "<ul>\n<li>O bónus deve ser solicitado na secção <strong>“Bónus”</strong> antes de efetuares o <strong>depósito qualificado de sexta-feira</strong>.</li>\n<li>O <strong>depósito mínimo qualificado</strong> é de <strong>10 €.</strong></li>\n<li>Assim que o depósito for confirmado, o valor da <strong>Aposta Grátis</strong> é calculada com base no montante depositado, atribuindo <strong>100 % até 100 €.</strong></li>\n<li>A <strong>Aposta Grátis</strong> fica disponível no <strong>boletim de apostas</strong>, na área <strong>“Selecionar bónus”.</strong></li>\n</ul>"
      },
      {
        "title": "Utilização e Requisitos de Aposta",
        "content": "<ul>\n<li>Só contam <strong>apostas múltiplas</strong> com <strong>3 seleções de odd mínima 1.40</strong> em mercados de Futebol, Basquetebol ou Ténis.</li>\n<li>O <strong>rollover da Aposta Grátis</strong> é de <strong>1x</strong>:\n        <ul>\n<li>cada <strong>Aposta Grátis</strong> deve ser utilizado <strong>numa aposta qualificada uma vez</strong>;</li>\n<li>os <strong>ganhos</strong> obtidos com a <strong>Aposta Grátis</strong> são <strong>creditados</strong> como <strong>saldo real</strong> com um <strong>requisito</strong> de aposta (rollover) adicional de 1x antes de poderem ser levantados.</li>\n</ul>\n</li>\n<li>A <strong>Aposta Grátis</strong> funciona como uma aposta em que o <strong>valor da Aposta Grátis não é devolvido</strong>:\n        <ul>\n<li>se a aposta for <strong>perdedora</strong>, a Aposta Grátis é perdida;</li>\n<li>se a aposta for <strong>vencedora</strong>, apenas o <strong>lucro líquido, até um limite máximo igual ao valor da Aposta Grátis</strong>, é creditado como <strong>saldo real</strong>; o valor nominal da <strong>Aposta Grátis</strong> não é devolvido.</li>\n</ul>\n</li>\n<li>A <strong>Aposta Grátis</strong> não pode ser utilizado em <strong>Cash Out total ou parcial</strong>.</li>\n<li><strong>Apostas anuladas, canceladas, devolvidas ou com Cash Out (total ou parcial)</strong> não contam para o requisito de utilização da <strong>Aposta Grátis</strong>.</li>\n<li>Só <strong>apostas liquidadas</strong> (com resultado confirmado) contam para efeitos de <strong>ganhos</strong> e cumprimento do <strong>rollover</strong>.</li>\n<li>A <strong>Aposta Grátis</strong> tem uma <strong>validade limitada de 1 dia</strong> a contar da data em que é creditado; após esse prazo, se não for utilizado, expira e é <strong>removido da conta</strong>.</li>\n<li>Não são permitidos <strong>levantamentos</strong> enquanto a <strong>Aposta Grátis</strong> estiver ativo e não tiver sido utilizado de acordo com estes termos.</li>\n</ul>"
      },
      {
        "title": "Termos Gerais",
        "content": "<ul>\n<li>A <strong>BetSnipe</strong> pode solicitar <strong>verificação de identidade, idade, morada ou contacto telefónico</strong> antes de creditar ganhos provenientes da <strong>Aposta Grátis</strong> ou processar <strong>levantamentos</strong> associados.</li>\n<li><strong>Apostas de risco mínimo, arbitragem, apostas em ambos os lados do mesmo mercado, conluio entre contas</strong> ou qualquer padrão considerado <strong>abuso de bónus</strong> podem levar à <strong>remoção da Aposta Grátis</strong> e à <strong>anulação de ganhos</strong> associados.</li>\n<li>A <strong>BetSnipe</strong> reserva-se o direito de <strong>alterar, suspender ou cancelar</strong> esta promoção a qualquer momento, sem aviso prévio, desde que tal não prejudique as <strong>Apostas Grátis já atribuídas</strong> de forma legítima.</li>\n<li>Se, por qualquer motivo técnico, a <strong>Aposta Grátis</strong> não for atribuída automaticamente após um <strong>depósito qualificado</strong>, deves contactar o <strong>apoio ao cliente</strong> antes de começares a apostar com esse saldo.</li>\n<li>Em caso de <strong>disputa</strong>, a decisão da <strong>BetSnipe é final e vinculativa</strong>.</li>\n<li>Ao participares nesta oferta, confirmas que leste e aceitaste estes <strong>Termos e Condições específicos</strong>, bem como os <strong>Termos e Condições Gerais da BetSnipe</strong>.</li>\n</ul>"
      }
    ],
    "1º Depósito Casino": [
      {
        "title": "Elegibilidade",
        "content": "<ul>\n<li>Oferta disponível apenas para novos jogadores registados na BetSnipe.</li>\n<li>Cada jogador pode receber o Bónus de Boas-Vindas Casino apenas uma vez.</li>\n<li>Limitado a uma conta por pessoa, morada, agregado familiar, IP ou dispositivo.</li>\n<li>O bónus não pode ser utilizado em conjunto com outras promoções de boas-vindas, salvo indicação expressa em contrário.</li>\n<li>Disponível apenas para jogadores com 18 anos ou mais, em conformidade com a Política de Jogo Responsável da BetSnipe.</li>\n</ul>"
      },
      {
        "title": "Estrutura do Bónus",
        "content": "<p>O número de Rodadas Grátis atribuídas depende do valor do depósito qualificado:</p>\n<ul>\n<li><strong>10€ – 24,99€</strong> → 75 Rodadas Grátis (0,10€ por spin)</li>\n<li><strong>25€ – 49,99€</strong> → 100 Rodadas Grátis (0,10€ por spin)</li>\n<li><strong>50€ – 99,99€</strong> → 150 Rodadas Grátis (0,10€ por spin)</li>\n<li><strong>100€ – 200€</strong> → 200 Rodadas Grátis (0,10€ por spin)</li>\n</ul>\n<p>A BetSnipe define os jogos elegíveis para a utilização das Rodadas Grátis.</p>"
      },
      {
        "title": "Ativação do Bónus",
        "content": "<ul>\n<li>O bónus deve ser ativado na secção <strong>“Bónus”</strong> antes de realizares o depósito.</li>\n<li>As Rodadas Grátis são creditadas automaticamente após a confirmação do depósito qualificado.</li>\n<li>As Rodadas Grátis têm um <strong>prazo de validade de 48 horas</strong> a contar do momento do crédito.</li>\n<li>Não é possível ter mais do que um bónus de boas-vindas ativo ao mesmo tempo.</li>\n</ul>"
      },
      {
        "title": "Utilização das Rodadas Grátis e Ganhos",
        "content": "<ul>\n<li>Cada Rodadas Grátis tem um <strong>valor fixo de 0,10€.</strong></li>\n<li>As Rodadas Grátis só podem ser utilizadas no jogo Startburst.</li>\n<li>O jogador dispõe de 2 dias para utilizar as Rodadas Grátis após o crédito.</li>\n<li>Os ganhos obtidos com Rodadas Grátis estão sujeitos a um requisito de aposta (<strong>rollover</strong>) de <strong>1x</strong>.</li>\n<li>Após cumprires o rollover, os ganhos são transferidos diretamente para o saldo real.</li>\n<li>Caso o rollover não seja cumprido dentro do prazo de validade, as Rodadas Grátis e os ganhos associados serão anulados.</li>\n</ul>"
      },
      {
        "title": "Limites de Ganhos",
        "content": "<ul>\n<li>O <strong>ganho máximo que pode ser convertido em saldo real</strong> com as Rodadas Grátis é de <strong>50€.</strong></li>\n<li>Qualquer valor ganho acima deste limite é removido no momento da conversão para saldo real.</li>\n</ul>"
      },
      {
        "title": "Regras de Jogo e Restrições",
        "content": "<ul>\n<li>O saldo de Rodadas Grátis é separado do saldo real.</li>\n<li>Estratégias de jogo de baixo risco, padrões automáticos, conluio entre contas ou qualquer forma de abuso de bónus podem resultar no cancelamento do bónus e confiscação dos ganhos.</li>\n<li>A BetSnipe reserva-se o direito de excluir jogos ou fornecedores específicos da promoção.</li>\n</ul>"
      },
      {
        "title": "Levantamentos e Verificação",
        "content": "<ul>\n<li>Os ganhos convertidos para saldo real podem ser levantados após o cumprimento do rollover.</li>\n<li>A BetSnipe pode solicitar documentos de verificação de identidade, morada ou contacto antes de processar qualquer levantamento.</li>\n<li>Não são permitidos <strong>levantamentos</strong> enquanto o <strong>bónus</strong> estiver ativo e não tiver sido utilizado de acordo com estes termos. No entanto o bónus pode ser cancelado na página dos termos e condições ou automaticamente caso um levantamento seja requisitado.</li>\n</ul>"
      },
      {
        "title": "Termos Gerais",
        "content": "<ul>\n<li>Podes cancelar o bónus a qualquer momento através da tua conta, na página dos termos e condições; nesse caso, as Rodadas Grátis e ganhos associados serão anulados.</li>\n<li>A BetSnipe reserva-se o direito de alterar, suspender ou encerrar esta promoção a qualquer momento, sem aviso prévio.</li>\n<li>Em caso de disputa, a decisão da BetSnipe é final e vinculativa.</li>\n<li>Ao ativares este bónus, confirmas que leste e aceitaste estes Termos e Condições, bem como os Termos Gerais da BetSnipe.</li>\n</ul>"
      }
    ],
    "Bónus de Quarta-feira": [
      {
        "title": "Elegibilidade",
        "content": "<ul>\n<li>Oferta disponível para jogadores registados na BetSnipe que realizem um depósito qualificado à quarta-feira.</li>\n<li>Cada jogador pode receber o Bónus de Depósito de Quarta-Feira uma vez por semana.</li>\n<li>Limitado a uma conta por pessoa, morada, agregado familiar, IP ou dispositivo.</li>\n<li>Disponível apenas para jogadores com 18 anos ou mais, em conformidade com a Política de Jogo Responsável da BetSnipe.</li>\n</ul>"
      },
      {
        "title": "Compatibilidade com Outros Bónus",
        "content": "<ul>\n<li>Não é permitido acumular este bónus com quaisquer outras promoções ou ofertas.</li>\n</ul>"
      },
      {
        "title": "Depósitos Elegíveis",
        "content": "<ul>\n<li><strong>Depósito mínimo:</strong> 10€.</li>\n<li>Apenas depósitos realizados numa única transação são considerados elegíveis.</li>\n<li>A promoção é válida apenas à <strong>quarta-feira, entre as 00:00 e as 23:59.</strong></li>\n</ul>"
      },
      {
        "title": "Estrutura do Bónus",
        "content": "<p>O número de Rodadas Grátis atribuídas depende do valor do depósito realizado:</p>\n<ul>\n<li><strong>10€ – 24,99€</strong> → 40 Rodadas Grátis</li>\n<li><strong>25€ – 49,99€</strong> → 75 Rodadas Grátis</li>\n<li><strong>50€ – 100€</strong> → 120 Rodadas Grátis</li>\n</ul>\n<p>A BetSnipe define os jogos elegíveis para a utilização das Rodadas Grátis.</p>"
      },
      {
        "title": "Ativação do Bónus",
        "content": "<ul>\n<li>O bónus deve ser ativado na secção “Bónus” antes de realizares o depósito.</li>\n<li>As Rodadas Grátis são creditadas automaticamente após a confirmação do depósito qualificado.</li>\n<li>Para utilizares as Rodadas Grátis, basta abrires a slot onde estas se encontram disponíveis.</li>\n</ul>"
      },
      {
        "title": "Utilização das Rodadas Grátis e Ganhos",
        "content": "<ul>\n<li>Cada Rodada Grátis tem um <strong>valor fixo de 0,10€ por jogada.</strong></li>\n<li>As Rodadas Grátis só podem ser utilizadas nos jogo Dead or Alive II.</li>\n<li>As Rodadas Grátis estão sujeitas a um requisito de aposta 1x (rollover).</li>\n<li>O jogador dispõe de <strong>1 dia</strong> para utilizar as Rodadas Grátis após o crédito.</li>\n<li>Os ganhos obtidos com Rodadas Grátis são pagos diretamente em saldo real.</li>\n<li>O <strong>ganho máximo total</strong> que pode ser convertido em saldo real com esta promoção é de <strong>30€.</strong></li>\n<li>Qualquer valor ganho acima deste limite será removido no momento da conversão.</li>\n</ul>"
      },
      {
        "title": "Regras de Jogo e Restrições",
        "content": "<ul>\n<li>O saldo de Rodadas Grátis é separado do saldo real.</li>\n<li>Estratégias de jogo de baixo risco, padrões automáticos, conluio entre contas ou qualquer forma de abuso de bónus podem resultar no cancelamento do bónus e confiscação dos ganhos.</li>\n<li>A BetSnipe reserva-se o direito de excluir jogos ou fornecedores específicos da promoção.</li>\n</ul>"
      },
      {
        "title": "Levantamentos e Verificação",
        "content": "<ul>\n<li>Os ganhos pagos em saldo real podem ser levantados de acordo com os Termos Gerais da BetSnipe.</li>\n<li>A BetSnipe pode solicitar documentos de verificação de identidade, morada ou contacto antes de processar levantamentos.</li>\n</ul>"
      },
      {
        "title": "Termos Gerais",
        "content": "<ul>\n<li>Podes cancelar o bónus a qualquer momento; nesse caso, as Rodadas Grátis não utilizadas e ganhos associados serão anulados.</li>\n<li>A BetSnipe reserva-se o direito de alterar, suspender ou encerrar esta promoção a qualquer momento, sem aviso prévio.</li>\n<li>Em caso de disputa, a decisão da BetSnipe é final e vinculativa.</li>\n<li>Ao participares nesta promoção, confirmas que leste e aceitaste estes Termos e Condições, bem como os Termos Gerais da BetSnipe.</li>\n</ul>"
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
})();
