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

  document.querySelectorAll(".service-grid article, .route-grid a, .case-list article").forEach((card, index) => {
    const mini = document.createElement("span");
    mini.className = `mini-bot mini-bot-${(index % 3) + 1}`;
    mini.setAttribute("aria-hidden", "true");
    card.append(mini);
  });
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
    setText(".route-grid h3", page.route2Title, 1);
    setText(".route-grid p", page.route2Copy, 1);
    setText(".route-grid h3", page.route3Title, 2);
    setText(".route-grid p", page.route3Copy, 2);
    setText(".metrics span", page.metric1, 0);
    setText(".metrics span", page.metric2, 1);
    setText(".metrics span", page.metric3, 2);
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
  setText(".nav-links a", common.navPlatform, 1);
  setText(".nav-links a", common.navCases, 2);
  setText(".nav-links a", common.navContact, 3);
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

addArcadeDecor();
applyLanguage(initialLanguage);
