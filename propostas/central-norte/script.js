/* =====================================================================
   CENTRAL NORTE × MARKTIVA — Apresentação estratégica
   script.js — sem dependências externas
   ===================================================================== */
(function () {
  'use strict';

  const $  = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.prototype.slice.call((c || document).querySelectorAll(s));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const NS = 'http://www.w3.org/2000/svg';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.matchMedia('(max-width: 900px)').matches;

  /* ---------------------------------------------------------------
     1. REVEAL ON SCROLL
  --------------------------------------------------------------- */
  const revealTargets = [
    '.reveal', '.feature-list li', '.flow', '.scan',
    '.ladder li', '.serp', '.cal', '.chat', '.phone'
  ].join(',');

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });

  $$(revealTargets).forEach(el => io.observe(el));

  /* brilho que segue o cursor nos cards (desktop) */
  if (!isMobile) {
    $$('.card').forEach((card) => {
      card.addEventListener('pointermove', (ev) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', ((ev.clientX - r.left) / r.width) * 100 + '%');
        card.style.setProperty('--my', ((ev.clientY - r.top) / r.height) * 100 + '%');
      });
    });
  }

  /* ---------------------------------------------------------------
     2. NAV + RAIL
  --------------------------------------------------------------- */
  const nav = $('#nav');
  const progressBar = $('#progressBar');
  const rail = $('#rail');
  const sections = $$('[data-rail]');

  sections.forEach((sec) => {
    const a = document.createElement('a');
    a.href = '#' + sec.id;
    a.innerHTML = '<span>' + sec.dataset.rail + '</span><i></i>';
    a.setAttribute('aria-label', sec.dataset.rail);
    rail.appendChild(a);
  });
  const railLinks = $$('a', rail);

  function isDark(sec) {
    return sec.classList.contains('section--dark') ||
           sec.classList.contains('scroll-stage--dark') ||
           sec.classList.contains('closing');
  }

  function updateNav() {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const p = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
    progressBar.style.width = (p * 100) + '%';
    nav.classList.toggle('is-stuck', window.scrollY > 12);

    let activeIdx = 0;
    const line = window.innerHeight * 0.4;
    for (let i = 0; i < sections.length; i++) {
      if (sections[i].getBoundingClientRect().top <= line) activeIdx = i;
    }
    railLinks.forEach((a, i) => a.classList.toggle('is-active', i === activeIdx));

    /* a barra superior acompanha o fundo da seção que está atrás dela */
    let overDark = false;
    for (let i = 0; i < sections.length; i++) {
      const r = sections[i].getBoundingClientRect();
      if (r.top <= 34 && r.bottom > 34) { overDark = isDark(sections[i]); break; }
    }
    rail.classList.toggle('on-dark', isDark(sections[activeIdx]));
    nav.classList.toggle('on-dark', overDark);
  }

  /* ---------------------------------------------------------------
     3. HERO — arcada + aparelho em SVG
  --------------------------------------------------------------- */
  function smoothPath(pts) {
    if (pts.length < 2) return '';
    let d = 'M ' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ' C ' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ', ' +
                   c2x.toFixed(1) + ' ' + c2y.toFixed(1) + ', ' +
                   p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
    }
    return d;
  }

  (function heroArch() {
    const g = $('#heroArch');
    const wire = $('#heroWire');
    if (!g || !wire) return;

    const N = 10, pts = [], brackets = [];
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const x = 45 + t * 430;
      const y = 205 - 78 * Math.sin(Math.PI * t);
      const rot = (t - 0.5) * 58;
      const w = 26 + 12 * Math.sin(Math.PI * t);

      const tooth = document.createElementNS(NS, 'rect');
      tooth.setAttribute('class', 't');
      tooth.setAttribute('x', (-w / 2).toFixed(1));
      tooth.setAttribute('y', '-26');
      tooth.setAttribute('width', w.toFixed(1));
      tooth.setAttribute('height', '52');
      tooth.setAttribute('rx', '12');
      tooth.setAttribute('transform', 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ') rotate(' + rot.toFixed(1) + ')');
      g.appendChild(tooth);

      /* o bracket vai dentro de um <g> posicionado: a animação CSS usa
         transform no <rect> e sobrescreveria o atributo de posição. */
      const bkWrap = document.createElementNS(NS, 'g');
      bkWrap.setAttribute('transform', 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ') rotate(' + rot.toFixed(1) + ')');
      const bk = document.createElementNS(NS, 'rect');
      bk.setAttribute('class', 'b');
      bk.setAttribute('x', '-6.5'); bk.setAttribute('y', '-6.5');
      bk.setAttribute('width', '13'); bk.setAttribute('height', '13');
      bk.setAttribute('rx', '3.5');
      bkWrap.appendChild(bk);
      g.appendChild(bkWrap);
      brackets.push(bk);
      pts.push([x, y]);
    }

    wire.setAttribute('d', smoothPath(pts));
    const len = wire.getTotalLength ? wire.getTotalLength() : 900;
    wire.style.strokeDasharray = len;
    wire.style.strokeDashoffset = len;

    if (reduced) {
      brackets.forEach(b => { b.style.opacity = 1; b.style.transform = 'none'; });
      wire.style.strokeDashoffset = 0;
      return;
    }
    brackets.forEach((b, i) => setTimeout(() => b.classList.add('on'), 380 + i * 70));
    setTimeout(() => wire.classList.add('on'), 400);
  })();

  /* ---------------------------------------------------------------
     4. CANVAS — rede de partículas (hero e encerramento)
  --------------------------------------------------------------- */
  function particleField(canvas, opts) {
    if (!canvas || reduced) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const cfg = Object.assign({ color: '46,123,255', accent: '224,49,49', link: true, alpha: 0.5 }, opts);
    let w = 0, h = 0, dpr = 1, parts = [], running = false, raf = 0;

    function resize() {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, r.width); h = Math.max(1, r.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    }

    function build() {
      const density = w < 700 ? 15000 : 11000;
      const n = clamp(Math.round((w * h) / density), 14, w < 700 ? 30 : 68);
      parts = [];
      for (let i = 0; i < n; i++) {
        parts.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.24,
          vy: (Math.random() - 0.5) * 0.24 - (cfg.rise ? 0.14 : 0),
          r: Math.random() * 1.9 + 0.7,
          a: Math.random() * 0.5 + 0.25,
          hot: Math.random() < 0.12
        });
      }
    }

    function step() {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < -20) p.x = w + 20; else if (p.x > w + 20) p.x = -20;
        if (cfg.rise) { if (p.y < -20) { p.y = h + 20; p.x = Math.random() * w; } }
        else { if (p.y < -20) p.y = h + 20; else if (p.y > h + 20) p.y = -20; }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + (p.hot ? cfg.accent : cfg.color) + ',' + (p.a * cfg.alpha).toFixed(3) + ')';
        ctx.fill();

        if (cfg.link) {
          for (let j = i + 1; j < parts.length; j++) {
            const q = parts[j];
            const dx = p.x - q.x, dy = p.y - q.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < 15000) {
              ctx.beginPath();
              ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
              ctx.strokeStyle = 'rgba(' + cfg.color + ',' + ((1 - d2 / 15000) * 0.18 * cfg.alpha).toFixed(3) + ')';
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          }
        }
      }
      raf = requestAnimationFrame(step);
    }

    function start() { if (!running) { running = true; raf = requestAnimationFrame(step); } }
    function stop()  { running = false; cancelAnimationFrame(raf); }

    const vis = new IntersectionObserver((e) => { e[0].isIntersecting ? start() : stop(); }, { threshold: 0.01 });
    vis.observe(canvas);

    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 180); }, { passive: true });
    document.addEventListener('visibilitychange', () => { document.hidden ? stop() : start(); });
    resize();
  }

  particleField($('#heroCanvas'), { color: '46,123,255', accent: '224,49,49', link: true, alpha: 0.55 });
  particleField($('#closeCanvas'), { color: '143,192,255', accent: '255,140,140', link: false, alpha: 0.9, rise: true });

  /* ---------------------------------------------------------------
     5. GOOGLE — busca sendo digitada
  --------------------------------------------------------------- */
  (function serp() {
    const out = $('#serpQuery');
    const sug = $('#serpSuggest');
    if (!out) return;

    const queries = [
      'dentista zona norte londrina',
      'implante dentário londrina',
      'clínica odontológica londrina',
      'aparelho ortodôntico londrina',
      'dentista próximo a mim',
      'dentista emergência londrina',
      'tratamento odontológico londrina'
    ];
    const suggestions = ['preço', 'avaliação gratuita', 'perto de mim', 'parcelado', 'quanto custa'];

    let qi = 0, ci = 0, deleting = false, timer = null, alive = false;

    function tick() {
      const q = queries[qi];
      if (!deleting) {
        ci++;
        out.textContent = q.slice(0, ci);
        if (ci >= q.length) {
          sug.innerHTML = suggestions.slice(0, 3).map(s => '<span>' + q.split(' ')[0] + ' ' + s + '</span>').join('');
          deleting = true;
          timer = setTimeout(tick, 1900);
          return;
        }
        timer = setTimeout(tick, 55 + Math.random() * 55);
      } else {
        ci -= 2;
        if (ci <= 0) {
          ci = 0; deleting = false; qi = (qi + 1) % queries.length; sug.innerHTML = '';
          timer = setTimeout(tick, 320);
          return;
        }
        out.textContent = q.slice(0, ci);
        timer = setTimeout(tick, 26);
      }
    }

    if (reduced) { out.textContent = queries[0]; return; }

    const vis = new IntersectionObserver((e) => {
      if (e[0].isIntersecting && !alive) { alive = true; tick(); }
      else if (!e[0].isIntersecting && alive) { alive = false; clearTimeout(timer); }
    }, { threshold: 0.25 });
    vis.observe($('.serp'));
  })();

  /* ---------------------------------------------------------------
     6. CALENDÁRIO SENDO PREENCHIDO
  --------------------------------------------------------------- */
  (function calendar() {
    const grid = $('#calGrid');
    const status = $('#calStatus');
    if (!grid) return;

    const TOTAL = 35, OFFSET = 3;
    const kinds = ['reel', 'post', 'story'];
    const labels = { reel: 'R', post: 'P', story: 'S' };
    const cells = [];

    for (let i = 0; i < TOTAL; i++) {
      const c = document.createElement('i');
      grid.appendChild(c);
      cells.push(c);
    }

    const plan = [];
    for (let i = OFFSET; i < TOTAL - 2; i++) {
      const dow = i % 7;
      if (dow === 0) continue;                 /* domingo livre */
      let kind;
      if (dow === 2 || dow === 5) kind = 'reel';
      else if (dow === 4 || dow === 6) kind = 'story';
      else if (dow === 1 || dow === 3) kind = 'post';
      else kind = kinds[i % 3];
      plan.push({ i: i, kind: kind });
    }

    function fill(instant) {
      plan.forEach((p, k) => {
        const apply = () => {
          cells[p.i].classList.add('f', p.kind);
          cells[p.i].textContent = labels[p.kind];
          if (k === plan.length - 1) {
            status.textContent = 'Mês programado';
            status.classList.add('done');
          }
        };
        instant ? apply() : setTimeout(apply, 120 + k * 85);
      });
    }

    if (reduced) { fill(true); return; }
    const vis = new IntersectionObserver((e) => {
      if (e[0].isIntersecting) { fill(false); vis.disconnect(); }
    }, { threshold: 0.3 });
    vis.observe(grid);
  })();

  /* ---------------------------------------------------------------
     7. CHAT DE ATENDIMENTO
  --------------------------------------------------------------- */
  (function chat() {
    const body = $('#chatBody');
    if (!body) return;

    const script = [
      { t: 'in',  m: 'Oi, vi o anúncio de implante. Quanto custa?' },
      { t: 'out', m: 'Olá! Que bom falar com você 😊 Aqui é da Central Norte. Posso te explicar em 1 minuto como funciona?' },
      { t: 'out', m: 'O valor depende do número de dentes e do osso disponível — por isso fazemos uma avaliação com raio-x antes de passar qualquer número.' },
      { t: 'in',  m: 'E essa avaliação, como funciona?' },
      { t: 'out', m: 'É uma consulta com o especialista, aqui na zona norte. Você sai com o plano de tratamento e o valor exato, sem compromisso.' },
      { t: 'out', m: 'Tenho quinta às 14h ou sexta às 9h30. Qual fica melhor pra você?' },
      { t: 'in',  m: 'Pode ser quinta às 14h.' },
      { t: 'tag', m: '✓ Avaliação agendada' }
    ];

    function render(instant) {
      body.innerHTML = '';
      script.forEach((s, i) => {
        const add = () => {
          const el = document.createElement('div');
          el.className = 'msg msg--' + s.t;
          el.textContent = s.m;
          body.appendChild(el);
          body.scrollTop = body.scrollHeight;
        };
        instant ? add() : setTimeout(add, 220 + i * 680);
      });
    }

    if (reduced) { render(true); return; }
    const vis = new IntersectionObserver((e) => {
      if (e[0].isIntersecting) { render(false); vis.disconnect(); }
    }, { threshold: 0.35 });
    vis.observe(body);
  })();

  /* ---------------------------------------------------------------
     8. CONTADORES
  --------------------------------------------------------------- */
  (function counters() {
    const els = $$('[data-count]');
    if (!els.length) return;

    function fmt(v, el) {
      const dec = parseInt(el.dataset.decimals || '0', 10);
      const sep = el.dataset.sep === '1';
      let s;
      if (dec > 0) s = v.toFixed(dec).replace('.', ',');
      else s = sep ? Math.round(v).toLocaleString('pt-BR') : String(Math.round(v));
      return (el.dataset.prefix || '') + s + (el.dataset.suffix || '');
    }

    function run(el) {
      const target = parseFloat(el.dataset.count);
      /* data-from permite partir de um valor de ancoragem e descer até o preço */
      const from = el.dataset.from !== undefined ? parseFloat(el.dataset.from) : 0;
      if (reduced) { el.textContent = fmt(target, el); return; }
      const dur = parseFloat(el.dataset.dur || '1500');
      const delay = parseFloat(el.dataset.delay || '0');
      /* contagem regressiva a partir de uma âncora usa easeInOut: segura no valor
         inicial tempo suficiente para ser lido antes de cair. */
      const curve = el.dataset.from !== undefined ? easeInOut : easeOut;
      el.textContent = fmt(from, el);
      const t0 = performance.now() + delay;
      (function frame(now) {
        const t = clamp((now - t0) / dur, 0, 1);
        el.textContent = fmt(lerp(from, target, curve(t)), el);
        if (t < 1) requestAnimationFrame(frame);
        else el.textContent = fmt(target, el);
      })(performance.now());
    }

    const vis = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { run(e.target); vis.unobserve(e.target); }
      });
    }, { threshold: 0.5 });
    els.forEach(el => vis.observe(el));
  })();

  /* ---------------------------------------------------------------
     9. STAGE 1 — IMPLANTE (scroll driven)
  --------------------------------------------------------------- */
  const implantStage = (function () {
    const stage = $('#implante');
    if (!stage) return null;

    const original = $('#impOriginal'), root = $('#impRoot'), crownOld = $('#impCrownOrig'),
          socket = $('#impSocket'), screw = $('#impScrew'), abut = $('#impAbutment'),
          crownNew = $('#impCrownNew'), spark = $('#impSpark'),
          bar = $('#implantBar'), caption = $('#implantCaption');
    const steps = $$('#implantSteps .step');
    const names = ['Atração', 'Educação', 'Confiança', 'Avaliação', 'Conversão'];

    const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);

    function draw(p) {
      /* raiz se dissolve */
      const pRoot = easeInOut(seg(p, 0.16, 0.34));
      root.setAttribute('opacity', (1 - pRoot).toFixed(3));
      root.setAttribute('transform', 'translate(0,' + (pRoot * 26).toFixed(1) + ') scale(1,' + (1 - pRoot * 0.25).toFixed(3) + ')');

      /* coroa antiga sobe e some */
      const pCrown = easeInOut(seg(p, 0.10, 0.30));
      crownOld.setAttribute('opacity', (1 - pCrown).toFixed(3));
      crownOld.setAttribute('transform', 'translate(0,' + (-pCrown * 130).toFixed(1) + ')');
      original.setAttribute('opacity', pRoot >= 1 && pCrown >= 1 ? '0' : '1');

      /* alvéolo aberto */
      const pSock = seg(p, 0.20, 0.30) * (1 - seg(p, 0.46, 0.60));
      socket.setAttribute('opacity', (pSock * 0.95).toFixed(3));

      /* implante desce */
      const pScrew = easeInOut(seg(p, 0.34, 0.56));
      screw.setAttribute('opacity', pScrew > 0 ? '1' : '0');
      screw.setAttribute('transform', 'translate(0,' + (-(1 - pScrew) * 300).toFixed(1) + ')');

      /* pino */
      const pAb = easeInOut(seg(p, 0.56, 0.72));
      abut.setAttribute('opacity', pAb > 0 ? pAb.toFixed(3) : '0');
      abut.setAttribute('transform', 'translate(0,' + (-(1 - pAb) * 90).toFixed(1) + ')');

      /* coroa nova encaixa */
      const pNew = easeInOut(seg(p, 0.70, 0.88));
      crownNew.setAttribute('opacity', pNew > 0 ? pNew.toFixed(3) : '0');
      crownNew.setAttribute('transform', 'translate(0,' + (-(1 - pNew) * 160).toFixed(1) + ')');

      /* halo final */
      const pSpark = seg(p, 0.88, 1);
      spark.setAttribute('opacity', (pSpark * 0.85).toFixed(3));
      spark.setAttribute('transform', 'translate(160,190) scale(' + lerp(0.86, 1.06, pSpark).toFixed(3) + ') translate(-160,-190)');

      /* etapas */
      const idx = clamp(Math.floor(p * 5), 0, 4);
      steps.forEach((s, i) => s.classList.toggle('on', i <= idx));
      caption.textContent = names[idx];
      bar.style.width = (p * 100).toFixed(1) + '%';
    }

    draw(0);
    return { el: stage, draw: draw };
  })();

  /* ---------------------------------------------------------------
     10. STAGE 2 — APARELHO ORTODÔNTICO (scroll driven)
  --------------------------------------------------------------- */
  const bracesStage = (function () {
    const stage = $('#alinhamento');
    if (!stage) return null;

    const svg = $('#bracesSvg');
    const g = $('#bracesTeeth'), wire = $('#bracesWire'), bar = $('#bracesBar');

    /* em telas menores mostramos menos dentes, em escala maior */
    function setViewBox() {
      const w = window.innerWidth;
      if (w < 560)      svg.setAttribute('viewBox', '176 58 368 188');
      else if (w < 900) svg.setAttribute('viewBox', '96 60 528 184');
      else              svg.setAttribute('viewBox', '8 62 704 180');
    }
    setViewBox();
    window.addEventListener('resize', setViewBox, { passive: true });
    const items = $$('#alignList li');
    const N = 9, BASE_Y = 150, teeth = [];

    /* desalinhamentos fixos (determinísticos) */
    const offY  = [14, -12, 20, -8, 16, -16, 10, -14, 12];
    const offX  = [-6, 5, -4, 7, -5, 4, -7, 6, -3];
    const offR  = [-13, 10, -16, 9, -12, 14, -8, 11, -10];

    for (let i = 0; i < N; i++) {
      const x = 70 + i * 72;
      const w = i === 4 ? 58 : (i === 3 || i === 5 ? 56 : (i < 2 || i > 6 ? 48 : 54));
      const h = i === 4 ? 92 : (i < 2 || i > 6 ? 76 : 86);

      const grp = document.createElementNS(NS, 'g');

      const tooth = document.createElementNS(NS, 'rect');
      tooth.setAttribute('class', 'bt');
      tooth.setAttribute('x', (-w / 2).toFixed(1));
      tooth.setAttribute('y', (-h / 2).toFixed(1));
      tooth.setAttribute('width', w); tooth.setAttribute('height', h);
      tooth.setAttribute('rx', (w * 0.36).toFixed(1));
      grp.appendChild(tooth);

      const bk = document.createElementNS(NS, 'g');
      const bkBody = document.createElementNS(NS, 'rect');
      bkBody.setAttribute('class', 'bk');
      bkBody.setAttribute('x', '-11'); bkBody.setAttribute('y', '-9');
      bkBody.setAttribute('width', '22'); bkBody.setAttribute('height', '18');
      bkBody.setAttribute('rx', '5');
      const bkSlot = document.createElementNS(NS, 'rect');
      bkSlot.setAttribute('class', 'bk-slot');
      bkSlot.setAttribute('x', '-11'); bkSlot.setAttribute('y', '-2.5');
      bkSlot.setAttribute('width', '22'); bkSlot.setAttribute('height', '5');
      bkSlot.setAttribute('rx', '2.5');
      bk.appendChild(bkBody); bk.appendChild(bkSlot);
      grp.appendChild(bk);

      g.appendChild(grp);
      teeth.push({ grp: grp, bk: bk, x: x, w: w, h: h, i: i });
    }

    const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
    let wireLen = 0;

    function draw(p) {
      /* os dentes já estão em cena no primeiro quadro: a seção nunca aparece vazia */
      const pIn = lerp(0.55, 1, easeOut(seg(p, 0, 0.12)));
      const pAlign = easeInOut(seg(p, 0.6, 0.96));
      const pts = [];

      teeth.forEach((t) => {
        const i = t.i;
        const dy = offY[i] * (1 - pAlign);
        const dx = offX[i] * (1 - pAlign);
        const rot = offR[i] * (1 - pAlign);
        const x = t.x + dx;
        const y = BASE_Y + dy;

        t.grp.setAttribute('transform', 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ') rotate(' + rot.toFixed(1) + ')');
        t.grp.setAttribute('opacity', pIn.toFixed(3));

        const pBk = easeOut(seg(p, 0.22 + i * 0.018, 0.36 + i * 0.018));
        t.bk.setAttribute('opacity', pBk.toFixed(3));
        t.bk.setAttribute('transform', 'scale(' + lerp(0.3, 1, pBk).toFixed(3) + ')');

        /* âncora do fio no centro do bracket, já no espaço do SVG */
        const rad = rot * Math.PI / 180;
        pts.push([x + Math.sin(rad) * 0, y]);
      });

      wire.setAttribute('d', smoothPath(pts));
      if (!wireLen && wire.getTotalLength) wireLen = wire.getTotalLength();
      const L = wireLen || 700;
      const pWire = easeOut(seg(p, 0.42, 0.62));
      wire.style.strokeDasharray = L;
      wire.style.strokeDashoffset = (L * (1 - pWire)).toFixed(1);
      wire.setAttribute('opacity', pWire > 0 ? '1' : '0');

      items.forEach((li, i) => li.classList.toggle('on', p > 0.6 + i * 0.075));
      if (bar) bar.style.width = (p * 100).toFixed(1) + '%';
    }

    draw(0);
    return { el: stage, draw: draw };
  })();

  /* ---------------------------------------------------------------
     11. LOOP DE SCROLL
  --------------------------------------------------------------- */
  const stages = [implantStage, bracesStage].filter(Boolean);

  function stageProgress(el) {
    const rect = el.getBoundingClientRect();
    const total = el.offsetHeight - window.innerHeight;
    if (total <= 0) return rect.top <= 0 ? 1 : 0;
    return clamp(-rect.top / total, 0, 1);
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateNav();
      const vh = window.innerHeight;
      stages.forEach((s) => {
        const r = s.el.getBoundingClientRect();
        if (r.bottom > -vh && r.top < vh * 2) s.draw(stageProgress(s.el));
      });
      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();

  /* ---------------------------------------------------------------
     12. NAVEGAÇÃO PARA APRESENTAÇÃO (teclado / clicker)
  --------------------------------------------------------------- */
  (function presenter() {
    const stops = sections;

    function goTo(dir) {
      const line = 6;
      let idx = 0;
      for (let i = 0; i < stops.length; i++) {
        if (stops[i].getBoundingClientRect().top <= line) idx = i;
      }
      const next = clamp(idx + dir, 0, stops.length - 1);
      const target = stops[next];
      /* nas seções longas com sticky, avança por etapas internas */
      window.scrollTo({ top: window.scrollY + target.getBoundingClientRect().top - 2, behavior: 'smooth' });
    }

    document.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'PageDown' || e.key === 'ArrowRight') { e.preventDefault(); goTo(1); }
      else if (e.key === 'PageUp' || e.key === 'ArrowLeft') { e.preventDefault(); goTo(-1); }
      else if (e.key === 'Home') { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
      else if (e.key === 'End') { e.preventDefault(); window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); }
    });
  })();

  /* ---------------------------------------------------------------
     13. ÂNCORAS COM COMPENSAÇÃO DO HEADER
  --------------------------------------------------------------- */
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const top = window.scrollY + target.getBoundingClientRect().top - 2;
      window.scrollTo({ top: top, behavior: reduced ? 'auto' : 'smooth' });
      history.replaceState(null, '', id);
    });
  });

})();
