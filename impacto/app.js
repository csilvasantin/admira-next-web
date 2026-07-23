(function () {
  'use strict';

  const COPY = {
    es: {
      skip: 'Saltar a las historias',
      campaignTag: 'CAMPAÑA · NARRATIVA DE IMPACTO',
      heroEyebrow: 'LA TECNOLOGÍA, CONTADA DESDE LAS PERSONAS',
      heroTitle: 'Una pantalla no cambia el mundo.<br><em>Un mensaje a tiempo, sí.</em>',
      heroLede: 'La señalización digital cobra sentido cuando reduce una duda, acompaña una decisión o devuelve tiempo a alguien. Estas son historias sobre esos pequeños momentos.',
      heroCta: 'Entrar en las historias',
      heroSecondary: 'Ver cómo medimos el impacto',
      signalMessage: 'Tu camino<br>empieza aquí.',
      heroFootOne: '3 historias',
      heroFootTwo: '1 principio: ser útil',
      storiesEyebrow: 'TRES MOMENTOS · TRES VIDAS',
      storiesTitle: 'El impacto ocurre en presente.',
      storiesIntro: 'Elige una historia. No empieza con una tecnología, sino con una persona que necesita algo sencillo.',
      tabCare: 'Cuidar',
      tabCarePlace: 'Centro de salud',
      tabRetail: 'Elegir',
      tabRetailPlace: 'Comercio local',
      tabCity: 'Llegar',
      tabCityPlace: 'Movilidad urbana',
      arcBefore: 'ANTES',
      arcMoment: 'EL MOMENTO ADMIRA',
      arcAfter: 'DESPUÉS',
      principleSmall: 'NUESTRO PRINCIPIO CREATIVO',
      principleQuote: 'No mostramos pantallas.<br><em>Mostramos lo que una persona puede hacer gracias a ellas.</em>',
      frameworkEyebrow: 'DEL RELATO A LA EVIDENCIA',
      frameworkTitle: 'Impacto que se siente. Valor que se demuestra.',
      frameworkIntro: 'Cada historia conecta una necesidad humana con una señal útil y con un resultado observable. Sin vigilancia, sin ruido, sin métricas vacías.',
      pathHumanLabel: 'SEÑAL HUMANA',
      pathHumanTitle: '¿Qué necesita la persona?',
      pathHumanCopy: 'Orientarse, decidir, esperar con calma, descubrir o pedir ayuda.',
      pathHumanMetric: 'Escuchamos dudas, fricciones y tareas reales.',
      pathContextLabel: 'CONTEXTO',
      pathContextTitle: '¿Qué mensaje ayuda ahora?',
      pathContextCopy: 'Contenido relevante por lugar, momento, disponibilidad y objetivo.',
      pathContextMetric: 'Orquestación IoT sin identificar a la persona.',
      pathActionLabel: 'ACCIÓN',
      pathActionTitle: '¿Qué resulta más fácil?',
      pathActionCopy: 'Encontrar el camino, completar una tarea o tomar una decisión informada.',
      pathActionMetric: 'Medimos tiempo a la acción y finalización.',
      pathValueLabel: 'VALOR',
      pathValueTitle: '¿Qué mejora para el negocio?',
      pathValueCopy: 'Menos fricción operativa, atención más útil y experiencias consistentes.',
      pathValueMetric: 'Proof-of-play y objetivos acordados desde el piloto.',
      audienceClient: 'Soy cliente',
      audiencePartner: 'Soy partner',
      audienceEyebrow: 'CONSTRUYAMOS LA PRÓXIMA HISTORIA',
      audienceTitle: 'Empieza con un momento que hoy no funciona.',
      audienceCtaClient: 'Diseñar un piloto juntos',
      kitEyebrow: 'KIT DE CAMPAÑA',
      kitTitle: 'Una historia, muchas puertas de entrada.',
      kitFilm: 'Pieza principal',
      kitFilmCopy: 'Una persona, una fricción, un cambio.',
      kitSocial: 'Capítulos sociales',
      kitSocialCopy: 'Cuidar · Elegir · Llegar.',
      kitDemo: 'Demo conectada',
      kitDemoCopy: 'El sistema real dentro de la presentación.',
      kitCase: 'Historia de cliente',
      kitCaseCopy: 'Resultado verificado después del piloto.',
      footerLine: 'Donde las cosas se conectan a Internet con Inteligencia Artificial — y las personas siguen siendo lo primero.'
    },
    en: {
      skip: 'Skip to the stories',
      campaignTag: 'CAMPAIGN · IMPACT NARRATIVES',
      heroEyebrow: 'TECHNOLOGY, TOLD THROUGH PEOPLE',
      heroTitle: 'A screen does not change the world.<br><em>A timely message can.</em>',
      heroLede: 'Digital signage matters when it removes doubt, supports a decision or gives someone time back. These are stories about those small moments.',
      heroCta: 'Enter the stories',
      heroSecondary: 'See how we measure impact',
      signalMessage: 'Your way<br>starts here.',
      heroFootOne: '3 stories',
      heroFootTwo: '1 principle: be useful',
      storiesEyebrow: 'THREE MOMENTS · THREE LIVES',
      storiesTitle: 'Impact happens in the present.',
      storiesIntro: 'Choose a story. It does not begin with technology, but with a person who needs something simple.',
      tabCare: 'Care',
      tabCarePlace: 'Health centre',
      tabRetail: 'Choose',
      tabRetailPlace: 'Local retail',
      tabCity: 'Arrive',
      tabCityPlace: 'Urban mobility',
      arcBefore: 'BEFORE',
      arcMoment: 'THE ADMIRA MOMENT',
      arcAfter: 'AFTER',
      principleSmall: 'OUR CREATIVE PRINCIPLE',
      principleQuote: 'We do not show screens.<br><em>We show what people can do because of them.</em>',
      frameworkEyebrow: 'FROM STORY TO EVIDENCE',
      frameworkTitle: 'Impact you can feel. Value you can prove.',
      frameworkIntro: 'Each story links a human need to a useful signal and an observable outcome. No surveillance, no noise, no vanity metrics.',
      pathHumanLabel: 'HUMAN SIGNAL',
      pathHumanTitle: 'What does the person need?',
      pathHumanCopy: 'Find their way, decide, wait calmly, discover or ask for help.',
      pathHumanMetric: 'We listen for real questions, friction and tasks.',
      pathContextLabel: 'CONTEXT',
      pathContextTitle: 'What message helps now?',
      pathContextCopy: 'Relevant content based on place, time, availability and purpose.',
      pathContextMetric: 'IoT orchestration without identifying the person.',
      pathActionLabel: 'ACTION',
      pathActionTitle: 'What becomes easier?',
      pathActionCopy: 'Finding the way, completing a task or making an informed choice.',
      pathActionMetric: 'We measure time to action and completion.',
      pathValueLabel: 'VALUE',
      pathValueTitle: 'What improves for the business?',
      pathValueCopy: 'Less operational friction, more useful service and consistent experiences.',
      pathValueMetric: 'Proof of play and goals agreed from the pilot.',
      audienceClient: 'I am a client',
      audiencePartner: 'I am a partner',
      audienceEyebrow: 'LET US BUILD THE NEXT STORY',
      audienceTitle: 'Start with a moment that does not work today.',
      audienceCtaClient: 'Design a pilot together',
      kitEyebrow: 'CAMPAIGN KIT',
      kitTitle: 'One story, many ways in.',
      kitFilm: 'Hero film',
      kitFilmCopy: 'One person, one friction, one change.',
      kitSocial: 'Social chapters',
      kitSocialCopy: 'Care · Choose · Arrive.',
      kitDemo: 'Connected demo',
      kitDemoCopy: 'The real system inside the presentation.',
      kitCase: 'Client story',
      kitCaseCopy: 'Verified outcome after the pilot.',
      footerLine: 'Where things connect to the Internet with Artificial Intelligence — and people still come first.'
    }
  };

  const STORIES = {
    es: {
      care: {
        kicker: '01 · MARTA', title: 'El turno que ya no pesa.',
        lede: 'Marta no teme la consulta. Teme no oír su nombre, levantarse tarde o preguntar por tercera vez dónde debe esperar.',
        quote: '“Cuando sé qué va a pasar, vuelvo a sentir que controlo mi tiempo.”',
        before: 'Incertidumbre, preguntas repetidas y una espera que parece más larga.',
        moment: 'Una pantalla confirma turno, sala y tiempo aproximado con tipografía clara y audio opcional.',
        after: 'Marta se orienta sola. El equipo sanitario puede cuidar en vez de redirigir.',
        label: 'TURNO C12', message: 'SALA 3 →', time: '09:17', place: 'CENTRO DE SALUD · BARCELONA'
      },
      retail: {
        kicker: '02 · ÁLEX', title: 'La elección que encuentra su lugar.',
        lede: 'Álex entra buscando un regalo, no una marca. Tiene diez minutos y demasiadas opciones delante.',
        quote: '“No necesitaba más publicidad. Necesitaba una pista.”',
        before: 'Lineales saturados, información dispersa y una decisión que se aplaza.',
        moment: 'La señal muestra tres opciones disponibles, por uso y presupuesto, y señala dónde encontrarlas.',
        after: 'Álex decide con confianza. La tienda convierte información operativa en servicio.',
        label: 'PARA HOY', message: '3 IDEAS ↓', time: '18:26', place: 'COMERCIO LOCAL · SANT ANTONI'
      },
      city: {
        kicker: '03 · NORA', title: 'Llegar sin sentirse perdida.',
        lede: 'Nora visita la ciudad por primera vez. La batería del móvil se agota justo cuando cambia de línea.',
        quote: '“Una flecha comprensible también puede ser una bienvenida.”',
        before: 'Prisa, idioma desconocido y una conexión que parece más difícil de lo que es.',
        moment: 'La pantalla adapta el recorrido a la incidencia activa y ofrece lectura accesible en varios idiomas.',
        after: 'Nora llega sin pedir ayuda. La ciudad funciona como una anfitriona.',
        label: 'LÍNEA 2', message: 'ANDÉN B →', time: '20:04', place: 'MOVILIDAD URBANA · BARCELONA'
      }
    },
    en: {
      care: {
        kicker: '01 · MARTA', title: 'The wait that no longer weighs.',
        lede: 'Marta is not afraid of the appointment. She is afraid of missing her name, standing up too late or asking for the third time where to wait.',
        quote: '“When I know what happens next, I feel in control of my time again.”',
        before: 'Uncertainty, repeated questions and a wait that feels longer than it is.',
        moment: 'A screen confirms number, room and approximate time in clear type, with optional audio.',
        after: 'Marta finds her own way. The care team can care instead of redirecting.',
        label: 'NUMBER C12', message: 'ROOM 3 →', time: '09:17', place: 'HEALTH CENTRE · BARCELONA'
      },
      retail: {
        kicker: '02 · ALEX', title: 'The choice that finds its place.',
        lede: 'Alex walks in looking for a gift, not a brand. Ten minutes, too many options.',
        quote: '“I did not need more advertising. I needed a clue.”',
        before: 'Crowded shelves, scattered information and a decision put off.',
        moment: 'The signal shows three available options by use and budget, then points to their location.',
        after: 'Alex chooses with confidence. The store turns operational information into service.',
        label: 'FOR TODAY', message: '3 IDEAS ↓', time: '18:26', place: 'LOCAL RETAIL · SANT ANTONI'
      },
      city: {
        kicker: '03 · NORA', title: 'Arriving without feeling lost.',
        lede: 'Nora is visiting the city for the first time. Her phone dies just as she needs to change lines.',
        quote: '“A clear arrow can also feel like a welcome.”',
        before: 'A rush, an unfamiliar language and a connection that looks harder than it is.',
        moment: 'The screen adapts the route to the live disruption and offers accessible reading in several languages.',
        after: 'Nora arrives without asking for help. The city behaves like a host.',
        label: 'LINE 2', message: 'PLATFORM B →', time: '20:04', place: 'URBAN MOBILITY · BARCELONA'
      }
    }
  };

  const AUDIENCE = {
    es: {
      client: {
        copy: 'Cuéntanos dónde se pierde tiempo, claridad o confianza. Diseñaremos un piloto pequeño, medible y conectado a tu operación real.',
        cta: 'Diseñar un piloto juntos',
        subject: 'Narrativa de Impacto · Piloto'
      },
      partner: {
        copy: 'Unamos tu tecnología, contenido o red comercial a una experiencia útil. Definiremos juntos el papel de cada parte y una historia que podamos demostrar.',
        cta: 'Explorar una colaboración',
        subject: 'Narrativa de Impacto · Partnership'
      }
    },
    en: {
      client: {
        copy: 'Tell us where time, clarity or trust is being lost. We will design a small, measurable pilot connected to your real operation.',
        cta: 'Design a pilot together',
        subject: 'Impact Narratives · Pilot'
      },
      partner: {
        copy: 'Let us connect your technology, content or commercial network to a useful experience. We will define each role and a story we can prove together.',
        cta: 'Explore a partnership',
        subject: 'Impact Narratives · Partnership'
      }
    }
  };

  let language = localStorage.getItem('impact-language') === 'en' ? 'en' : 'es';
  let activeStory = 'care';
  let activeAudience = 'client';

  function applyLanguage() {
    document.documentElement.lang = language;
    document.querySelectorAll('[data-i18n]').forEach((element) => {
      const value = COPY[language][element.dataset.i18n];
      if (value !== undefined) element.textContent = value;
    });
    document.querySelectorAll('[data-i18n-html]').forEach((element) => {
      const value = COPY[language][element.dataset.i18nHtml];
      if (value !== undefined) element.innerHTML = value;
    });
    document.getElementById('lang-toggle').textContent = language === 'es' ? 'EN' : 'ES';
    document.title = language === 'es'
      ? 'Narrativa de Impacto · ADmiraNeXT'
      : 'Impact Narratives · ADmiraNeXT';
    renderStory();
    renderAudience();
  }

  function renderStory() {
    const story = STORIES[language][activeStory];
    const visual = document.getElementById('story-visual');
    visual.className = `story-visual scene-${activeStory}`;
    document.getElementById('story-kicker').textContent = story.kicker;
    document.getElementById('story-title').textContent = story.title;
    document.getElementById('story-lede').textContent = story.lede;
    document.getElementById('story-quote').textContent = story.quote;
    document.getElementById('arc-before').textContent = story.before;
    document.getElementById('arc-moment').textContent = story.moment;
    document.getElementById('arc-after').textContent = story.after;
    document.getElementById('visual-label').textContent = story.label;
    document.getElementById('visual-message').textContent = story.message;
    document.getElementById('scene-time').textContent = story.time;
    document.getElementById('scene-place').textContent = story.place;
  }

  function renderAudience() {
    const content = AUDIENCE[language][activeAudience];
    document.getElementById('audience-copy').textContent = content.copy;
    const cta = document.getElementById('audience-cta');
    cta.textContent = content.cta;
    cta.href = `mailto:info@admira.com?subject=${encodeURIComponent(content.subject)}`;
  }

  document.querySelectorAll('.story-tab').forEach((button) => {
    button.addEventListener('click', () => {
      activeStory = button.dataset.story;
      document.querySelectorAll('.story-tab').forEach((tab) => {
        const active = tab === button;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', String(active));
      });
      renderStory();
    });
  });

  document.querySelectorAll('[data-audience]').forEach((button) => {
    button.addEventListener('click', () => {
      activeAudience = button.dataset.audience;
      document.querySelectorAll('[data-audience]').forEach((item) => item.classList.toggle('active', item === button));
      renderAudience();
    });
  });

  document.getElementById('lang-toggle').addEventListener('click', () => {
    language = language === 'es' ? 'en' : 'es';
    localStorage.setItem('impact-language', language);
    applyLanguage();
  });

  applyLanguage();
})();
