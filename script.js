const translations = window.AdmiraNextTranslations;
const counters = document.querySelectorAll("[data-count]");
const contactForm = document.querySelector(".contact-form");
const formNote = document.querySelector(".form-note");
const currentPage = window.location.pathname.split("/").pop() || "index.html";
const storedLanguage = localStorage.getItem("admira-next-language");
const requestedLanguage = new URLSearchParams(window.location.search).get("lang");
const initialLanguage = translations[requestedLanguage]
  ? requestedLanguage
  : translations[storedLanguage]
    ? storedLanguage
    : "es";

const setText = (selector, value, index = 0) => {
  const node = document.querySelectorAll(selector)[index];

  if (node && value !== undefined) {
    node.textContent = value;
  }
};

const setPlaceholder = (selector, value) => {
  const node = document.querySelector(selector);

  if (node && value !== undefined) {
    node.setAttribute("placeholder", value);
  }
};

const setLabelText = (selector, value, index = 0) => {
  const node = document.querySelectorAll(selector)[index];

  if (!node || value === undefined) {
    return;
  }

  const textNode = Array.from(node.childNodes).find((child) => child.nodeType === Node.TEXT_NODE);

  if (textNode) {
    textNode.textContent = `${value}\n            `;
  }
};

const setAlt = (selector, value, index = 0) => {
  const node = document.querySelectorAll(selector)[index];

  if (node && value !== undefined) {
    node.setAttribute("alt", value);
  }
};

const addArcadeDecor = () => {
  if (document.querySelector(".arcade-robot")) {
    return;
  }

  const mainStage = document.querySelector(".hero, .page-hero, .contact-page");

  if (mainStage) {
    const hud = document.createElement("div");
    hud.className = "arcade-hud";
    hud.setAttribute("aria-hidden", "true");
    hud.innerHTML = `
      <span>1UP</span>
      <strong>ADMIRA</strong>
      <span>STAGE 01</span>
      <span class="hud-bar"><i></i></span>
    `;
    mainStage.append(hud);

    const robot = document.createElement("div");
    robot.className = "arcade-robot arcade-robot-main";
    robot.setAttribute("aria-hidden", "true");
    robot.innerHTML = `
      <span class="antenna"></span>
      <span class="head"><i></i><i></i></span>
      <span class="torso"><i></i><i></i><i></i></span>
      <span class="legs"></span>
    `;
    mainStage.append(robot);

    const floor = document.createElement("div");
    floor.className = "arcade-floor";
    floor.setAttribute("aria-hidden", "true");
    mainStage.append(floor);
  }

  document.querySelectorAll(".service-grid article, .route-grid a, .case-list article, .rental-card").forEach((card, index) => {
    const mini = document.createElement("span");
    mini.className = `mini-bot mini-bot-${(index % 3) + 1}`;
    mini.setAttribute("aria-hidden", "true");
    card.append(mini);
  });
};

const addIntroGate = () => {
  const forceIntro = new URLSearchParams(window.location.search).get("intro") === "1";

  if (!forceIntro && sessionStorage.getItem("admira-next-intro-seen") === "true") {
    return;
  }

  const intro = document.createElement("section");
  intro.className = "intro-gate";
  intro.setAttribute("aria-label", "Admira Next arcade intro");
  intro.innerHTML = `
    <div class="intro-noise" aria-hidden="true"></div>
    <div class="intro-robot" aria-hidden="true">
      <span class="antenna"></span>
      <span class="head"><i></i><i></i></span>
      <span class="torso"><i></i><i></i><i></i></span>
      <span class="legs"></span>
    </div>
    <div class="intro-panel">
      <img class="intro-logo" src="./assets/admira-next-logo.svg" alt="Admira Next" />
      <p class="intro-lab">ADMIRA NEXT / RaaS BOOT SEQUENCE</p>
      <h2>ROBOT SIGNAL ONLINE</h2>
      <div class="intro-clock" aria-hidden="true">
        <span data-intro-minutes>00</span><i>:</i><span data-intro-seconds>00</span><i>:</i><span data-intro-frames>00</span>
      </div>
      <p class="intro-status">[signal. found. robots. awake. operations. ready.]</p>
      <button class="intro-enter" type="button">:: CLICK TO ENTER ::</button>
      <p class="intro-speed">HOLD FOR SPEED</p>
    </div>
  `;

  document.body.prepend(intro);
  document.body.classList.add("is-intro-active");

  const startedAt = performance.now();
  const closeIntro = () => {
    sessionStorage.setItem("admira-next-intro-seen", "true");
    intro.classList.add("is-leaving");
    document.body.classList.remove("is-intro-active");
    window.setTimeout(() => intro.remove(), 520);
  };

  const tick = (now) => {
    if (!document.body.contains(intro)) {
      return;
    }

    const elapsed = Math.floor((now - startedAt) / 1000);
    const frames = Math.floor(((now - startedAt) % 1000) / 10);
    setText("[data-intro-minutes]", String(Math.floor(elapsed / 60)).padStart(2, "0"));
    setText("[data-intro-seconds]", String(elapsed % 60).padStart(2, "0"));
    setText("[data-intro-frames]", String(frames).padStart(2, "0"));
    requestAnimationFrame(tick);
  };

  intro.querySelector(".intro-enter")?.addEventListener("click", closeIntro);
  intro.addEventListener("pointerdown", () => intro.classList.add("is-speeding"));
  intro.addEventListener("pointerup", () => intro.classList.remove("is-speeding"));
  intro.addEventListener("pointerleave", () => intro.classList.remove("is-speeding"));
  intro.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === "Escape" || event.key === " ") {
      closeIntro();
    }
  });
  intro.tabIndex = -1;
  intro.focus({ preventScroll: true });
  requestAnimationFrame(tick);
};

const pageTranslators = {
  "index.html": (page) => {
    setText(".hero .eyebrow", page.eyebrow);
    setText(".hero h1", page.h1);
    setText(".hero-copy", page.heroCopy);
    setText(".hero-actions .button", page.primary, 0);
    setText(".hero-actions .button", page.secondary, 1);
    setText(".hero-panel span", page.panel1Label, 0);
    setText(".hero-panel strong", page.panel1Value, 0);
    setText(".hero-panel span", page.panel2Label, 1);
    setText(".hero-panel strong", page.panel2Value, 1);
    setText(".hero-panel span", page.panel3Label, 2);
    setText(".hero-panel strong", page.panel3Value, 2);
    setText(".intro .eyebrow", page.introEyebrow);
    setText(".intro h2", page.introTitle);
    setText(".intro > p", page.introCopy);
    setText(".route-grid h3", page.route1Title, 0);
    setText(".route-grid p", page.route1Copy, 0);
    setText(".route-grid h3", page.route4Title, 1);
    setText(".route-grid p", page.route4Copy, 1);
    setText(".route-grid h3", page.route2Title, 2);
    setText(".route-grid p", page.route2Copy, 2);
    setText(".route-grid h3", page.route3Title, 3);
    setText(".route-grid p", page.route3Copy, 3);
    setText(".metrics span", page.metric1, 0);
    setText(".metrics span", page.metric2, 1);
    setText(".metrics span", page.metric3, 2);
  },
  "alquiler.html": (page) => {
    setText(".page-hero .eyebrow", page.eyebrow);
    setText(".page-hero h1", page.h1);
    setText(".page-hero p:last-child", page.heroCopy);
    setText(".rental-scenarios .eyebrow", page.scenariosEyebrow);
    [
      page.scenario1,
      page.scenario2,
      page.scenario3,
      page.scenario4,
      page.scenario5,
      page.scenario6,
      page.scenario7,
      page.scenario8,
    ].forEach((text, index) => setText(".scenario-grid span", text, index));
    setText(".rental-catalog-head .eyebrow", page.catalogEyebrow);
    setText(".rental-catalog-head h2", page.catalogTitle);
    setText(".rental-filters button", page.filterAll, 0);
    setText(".rental-filters button", page.filterHumanoid, 1);
    setText(".rental-filters button", page.filterQuadruped, 2);
    setText(".rental-filters button", page.filterService, 3);

    document.querySelectorAll(".rental-card").forEach((card, cardIndex) => {
      const rentalCard = page.rentalCards?.[cardIndex];
      const price = card.dataset.price || "";
      const unit = card.dataset.unit === "3mo" ? page.perThreeMonths || "/ 3 meses" : page.perDay;

      if (rentalCard) {
        setText(".rental-card .rental-type", rentalCard.type, cardIndex);
        setText(".rental-card h3", rentalCard.title, cardIndex);
        setText(".rental-card p", rentalCard.copy, cardIndex);
        setAlt(".rental-card .rental-photo", rentalCard.title, cardIndex);
        rentalCard.bullets?.forEach((bullet, bulletIndex) => {
          const bulletNode = card.querySelectorAll("li")[bulletIndex];
          if (bulletNode) {
            bulletNode.textContent = bullet;
          }
        });
      }

      setText(".rental-card .rental-price strong", `${page.from} ${price}€`, cardIndex);
      setText(".rental-card .rental-price span", unit, cardIndex);
      setText(".rental-card .rental-select", card.classList.contains("is-selected") ? page.selectedButton : page.addButton, cardIndex);
    });

    setText(".rental-quote .eyebrow", page.quoteEyebrow);
    setText(".rental-quote h2", page.quoteTitle);
    setText(".rental-quote > p", page.quoteCopy);
    setLabelText(".rental-quote label", page.start, 0);
    setLabelText(".rental-quote label", page.end, 1);
    setLabelText(".rental-quote label", page.country, 2);
    setText(".quote-lines span", page.selectedRobots, 0);
    setText(".quote-lines span", page.dailyEstimate, 1);
    setText(".quote-selected li", page.empty, 0);
    setText(".rental-quote .button", page.availability);
    updateRentalQuote();
  },
  "servicios.html": (page) => {
    setText(".page-hero .eyebrow", page.eyebrow);
    setText(".page-hero h1", page.h1);
    setText(".page-hero p:last-child", page.heroCopy);
    setText(".service-grid h3", page.card1Title, 0);
    setText(".service-grid p", page.card1Copy, 0);
    setText(".service-grid h3", page.card2Title, 1);
    setText(".service-grid p", page.card2Copy, 1);
    setText(".service-grid h3", page.card3Title, 2);
    setText(".service-grid p", page.card3Copy, 2);
    setText(".split-section .eyebrow", page.processEyebrow);
    setText(".split-section h2", page.processTitle);
    setText(".process-list strong", page.step1Title, 0);
    setText(".process-list p", page.step1Copy, 0);
    setText(".process-list strong", page.step2Title, 1);
    setText(".process-list p", page.step2Copy, 1);
    setText(".process-list strong", page.step3Title, 2);
    setText(".process-list p", page.step3Copy, 2);
  },
  "plataforma.html": (page) => {
    setText(".page-hero .eyebrow", page.eyebrow);
    setText(".page-hero h1", page.h1);
    setText(".page-hero p:last-child", page.heroCopy);
    setText(".platform-copy .eyebrow", page.platformEyebrow);
    setText(".platform-copy h2", page.platformTitle);
    setText(".platform-copy p:not(.eyebrow)", page.platformCopy);
    setText(".check-list li", page.bullet1, 0);
    setText(".check-list li", page.bullet2, 1);
    setText(".check-list li", page.bullet3, 2);
    setText(".dash-header span", page.dashTitle);
    setText(".dash-header strong", page.dashLive);
    setText(".dash-stats span", page.stat1Label, 0);
    setText(".dash-stats span", page.stat2Label, 1);
    setText(".dash-stats span", page.stat3Label, 2);
  },
  "casos.html": (page) => {
    setText(".page-hero .eyebrow", page.eyebrow);
    setText(".page-hero h1", page.h1);
    setText(".page-hero p:last-child", page.heroCopy);
    setText(".case-list h3", page.case1Title, 0);
    setText(".case-list p", page.case1Copy, 0);
    setText(".case-list h3", page.case2Title, 1);
    setText(".case-list p", page.case2Copy, 1);
    setText(".case-list h3", page.case3Title, 2);
    setText(".case-list p", page.case3Copy, 2);
    setAlt(".case-list img", page.case1Alt, 0);
    setAlt(".case-list img", page.case2Alt, 1);
    setAlt(".case-list img", page.case3Alt, 2);
  },
  "contacto.html": (page) => {
    setText(".contact .eyebrow", page.eyebrow);
    setText(".contact h1", page.h1);
    setText(".contact > div > p:last-child", page.heroCopy);
  },
};

const createLanguageSwitcher = (language) => {
  const header = document.querySelector(".site-header");

  if (!header || header.querySelector(".language-switcher")) {
    return;
  }

  const switcher = document.createElement("div");
  switcher.className = "language-switcher";
  switcher.setAttribute("aria-label", "Language selector");

  Object.entries(translations).forEach(([code, copy]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = copy.label;
    button.dataset.language = code;
    button.setAttribute("aria-label", copy.name);

    if (code === language) {
      button.classList.add("is-active");
      button.setAttribute("aria-current", "true");
    }

    button.addEventListener("click", () => applyLanguage(code));
    switcher.append(button);
  });

  header.append(switcher);
};

const applyLanguage = (language) => {
  const languagePack = translations[language] || translations.es;
  const common = languagePack.common;
  const page = languagePack.pages[currentPage] || languagePack.pages["index.html"];

  localStorage.setItem("admira-next-language", language);
  document.documentElement.lang = language;
  document.title = page.title;
  document.querySelector("meta[name='description']")?.setAttribute("content", page.description);

  setText(".brand span:last-child", common.brand);
  setText(".nav-links a", common.navServices, 0);
  setText(".nav-links a", common.navRental, 1);
  setText(".nav-links a", common.navPlatform, 2);
  setText(".nav-links a", common.navCases, 3);
  setText(".nav-links a", common.navContact, 4);
  setText(".header-cta", common.pilot);
  setText(".site-footer span", common.brand, 0);
  setText(".site-footer span", common.footer, 1);
  setLabelText(".contact-form label", common.formName, 0);
  setLabelText(".contact-form label", common.formEmail, 1);
  setLabelText(".contact-form label", common.formMessage, 2);
  setPlaceholder(".contact-form input[name='name']", common.formNamePlaceholder);
  setPlaceholder(".contact-form input[name='email']", common.formEmailPlaceholder);
  setPlaceholder(".contact-form textarea[name='message']", common.formMessagePlaceholder);
  setText(".contact-form button", common.formButton);

  pageTranslators[currentPage]?.(page);
  createLanguageSwitcher(language);

  document.querySelectorAll(".language-switcher button").forEach((button) => {
    const isActive = button.dataset.language === language;
    button.classList.toggle("is-active", isActive);
    button.toggleAttribute("aria-current", isActive);
  });
};

document.querySelectorAll(".nav-links a").forEach((link) => {
  const linkPage = link.getAttribute("href")?.replace("./", "");

  if (linkPage === currentPage) {
    link.classList.add("is-active");
  }
});

const animateCounter = (node) => {
  const target = Number(node.dataset.count);
  const duration = 900;
  const start = performance.now();

  const tick = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    node.textContent = Math.round(target * eased).toString();

    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  };

  requestAnimationFrame(tick);
};

if (counters.length) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || entry.target.dataset.done) {
          return;
        }

        entry.target.dataset.done = "true";
        animateCounter(entry.target);
      });
    },
    { threshold: 0.6 },
  );

  counters.forEach((counter) => observer.observe(counter));
}

const rentalCards = document.querySelectorAll(".rental-card");
const rentalFilters = document.querySelectorAll("[data-rental-filter]");
const selectedRental = new Set();

function getCurrentPageCopy() {
  const language = localStorage.getItem("admira-next-language") || initialLanguage;
  return translations[language]?.pages[currentPage] || translations.es.pages[currentPage] || {};
}

function updateRentalQuote() {
  if (!rentalCards.length) {
    return;
  }

  const page = getCurrentPageCopy();
  const selectedList = document.querySelector("[data-rental-selected]");
  const countNode = document.querySelector("[data-rental-count]");
  const totalNode = document.querySelector("[data-rental-total]");
  const selectedCards = [...rentalCards].filter((card) => selectedRental.has(card.dataset.name || ""));
  const total = selectedCards.reduce((sum, card) => sum + Number(card.dataset.price || 0), 0);

  if (countNode) {
    countNode.textContent = String(selectedCards.length);
  }

  if (totalNode) {
    totalNode.textContent = `${total.toLocaleString("es-ES")}€`;
  }

  if (selectedList) {
    selectedList.innerHTML = selectedCards.length
      ? selectedCards
          .map((card) => `<li>${card.dataset.name} · ${card.dataset.price}€${card.dataset.unit === "3mo" ? " / 3mo" : ""}</li>`)
          .join("")
      : `<li>${page.empty || "Selecciona robots del catálogo."}</li>`;
  }

  rentalCards.forEach((card) => {
    const button = card.querySelector(".rental-select");
    const isSelected = selectedRental.has(card.dataset.name || "");
    card.classList.toggle("is-selected", isSelected);

    if (button) {
      button.textContent = isSelected ? page.selectedButton || "Añadido" : page.addButton || "Añadir al briefing";
    }
  });
}

rentalFilters.forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.rentalFilter || "all";
    rentalFilters.forEach((filterButton) => filterButton.classList.toggle("is-active", filterButton === button));
    rentalCards.forEach((card) => {
      card.hidden = filter !== "all" && card.dataset.category !== filter;
    });
  });
});

rentalCards.forEach((card) => {
  card.querySelector(".rental-select")?.addEventListener("click", () => {
    const name = card.dataset.name || "";

    if (selectedRental.has(name)) {
      selectedRental.delete(name);
    } else {
      selectedRental.add(name);
    }

    updateRentalQuote();
  });
});

contactForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const data = new FormData(contactForm);
  const name = String(data.get("name") || "").trim();
  const email = String(data.get("email") || "").trim();
  const common = translations[localStorage.getItem("admira-next-language") || "es"].common;

  if (!name || !email) {
    formNote.textContent = common.formMissing;
    return;
  }

  formNote.textContent = common.formOk;
  contactForm.reset();
});

applyLanguage(initialLanguage);
addArcadeDecor();
addIntroGate();
