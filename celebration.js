// Deal Alert celebration overlay — drum-roll, photo reveal, amount count-up, confetti.
// Usage:  triggerCelebration({ closers: [{name, photo}], property, propertyType, amount, currency, leadSource, message })

(function () {
  'use strict';

  const ROOT_ID = 'celebration-root';

  function $el(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    for (const k in attrs) {
      if (k === 'class') el.className = attrs[k];
      else if (k === 'style') el.style.cssText = attrs[k];
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), attrs[k]);
      else el.setAttribute(k, attrs[k]);
    }
    (Array.isArray(children) ? children : [children]).forEach(c => {
      if (c == null) return;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }

  function injectStyles() {
    if (document.getElementById('celebration-styles')) return;
    const s = document.createElement('style');
    s.id = 'celebration-styles';
    s.textContent = `
      .celeb-backdrop {
        position: fixed; inset: 0;
        background: radial-gradient(ellipse at center, rgba(80,8,8,0.92), rgba(8,12,28,0.97));
        z-index: 9999;
        display: grid; place-items: center;
        opacity: 0;
        transition: opacity .35s ease;
        overflow: hidden;
        font-family: 'Inter', 'Noto Sans JP', system-ui, sans-serif;
        color: #fff;
      }
      .celeb-backdrop.show { opacity: 1; }
      .celeb-backdrop.flash::before {
        content: ''; position: absolute; inset: 0;
        background: rgba(255, 60, 60, 0.18);
        animation: celeb-flash 0.6s ease-in-out 4;
        pointer-events: none;
      }
      @keyframes celeb-flash {
        0%, 100% { opacity: 0; }
        50% { opacity: 1; }
      }
      .celeb-stage {
        position: relative;
        width: min(900px, 92vw);
        max-height: 92vh;
        text-align: center;
        z-index: 2;
      }
      .celeb-sirens {
        font-size: clamp(28px, 5vw, 52px);
        margin-bottom: 12px;
        letter-spacing: 18px;
        animation: celeb-bounce 0.6s ease-in-out infinite alternate;
      }
      @keyframes celeb-bounce {
        from { transform: translateY(-6px) rotate(-3deg); }
        to   { transform: translateY(6px)  rotate(3deg); }
      }
      .celeb-headline {
        font-family: 'Playfair Display', 'Noto Serif JP', serif;
        font-weight: 800;
        font-size: clamp(48px, 9vw, 110px);
        letter-spacing: 6px;
        background: linear-gradient(135deg, #fff5d6 0%, #ffd166 30%, #ff7a59 60%, #ffd166 90%);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        margin: 0 0 8px;
        line-height: 1;
        text-shadow: 0 0 60px rgba(255,209,102,0.4);
        opacity: 0;
        transform: scale(0.6) rotate(-4deg);
        animation: celeb-drop .8s cubic-bezier(.34,1.56,.64,1) .3s forwards, celeb-shake 0.4s ease-in-out 1.2s 2;
      }
      @keyframes celeb-drop {
        to { opacity: 1; transform: scale(1) rotate(0); }
      }
      @keyframes celeb-shake {
        0%, 100% { transform: translateX(0) rotate(0); }
        25% { transform: translateX(-12px) rotate(-1deg); }
        75% { transform: translateX(12px) rotate(1deg); }
      }
      .celeb-drumroll {
        margin: 22px auto 28px;
        font-size: clamp(20px, 3vw, 30px);
        letter-spacing: 4px;
        font-weight: 700;
        opacity: 0;
        animation: celeb-fade-in 0.4s ease 1.6s forwards, celeb-fade-out 0.4s ease 3.4s forwards;
      }
      .celeb-drumroll .drum-emoji { display: inline-block; animation: celeb-drumroll 0.18s steps(2) infinite; }
      .celeb-drumroll .drum-emoji:nth-child(2) { animation-delay: 0.06s; }
      .celeb-drumroll .drum-emoji:nth-child(3) { animation-delay: 0.12s; }
      @keyframes celeb-drumroll {
        from { transform: rotate(-12deg) scale(1); }
        to   { transform: rotate(12deg)  scale(1.15); }
      }
      @keyframes celeb-fade-in  { to { opacity: 1; } }
      @keyframes celeb-fade-out { to { opacity: 0; transform: scale(0.85); } }

      .celeb-reveal {
        opacity: 0;
        animation: celeb-fade-in 0.6s ease 3.4s forwards;
      }
      .celeb-photos {
        display: flex; align-items: flex-end; justify-content: center;
        gap: clamp(12px, 3vw, 36px);
        margin-bottom: 22px;
        flex-wrap: wrap;
      }
      .celeb-photo {
        position: relative;
        width: clamp(110px, 16vw, 180px);
        height: clamp(140px, 20vw, 220px);
        opacity: 0;
        transform: translateY(40px) scale(0.7);
      }
      .celeb-photo:nth-child(odd)  { animation: celeb-photo-in-l 0.7s cubic-bezier(.34,1.56,.64,1) 3.6s forwards; }
      .celeb-photo:nth-child(even) { animation: celeb-photo-in-r 0.7s cubic-bezier(.34,1.56,.64,1) 3.8s forwards; }
      @keyframes celeb-photo-in-l { from { opacity: 0; transform: translateX(-200px) translateY(40px) rotate(-12deg); } to { opacity: 1; transform: translateX(0) translateY(0) rotate(0); } }
      @keyframes celeb-photo-in-r { from { opacity: 0; transform: translateX(200px) translateY(40px) rotate(12deg); }  to { opacity: 1; transform: translateX(0) translateY(0) rotate(0); } }
      .celeb-photo img {
        width: 100%; height: 100%;
        object-fit: contain; object-position: bottom center;
        filter: drop-shadow(0 14px 30px rgba(0,0,0,.7)) drop-shadow(0 0 30px rgba(255,209,102,.4));
      }
      .celeb-photo-fallback {
        width: 100%; height: 100%;
        border-radius: 50%;
        background: linear-gradient(135deg, #ffd166, #d4b87a);
        display: grid; place-items: center;
        color: #051428;
        font-family: 'Playfair Display', serif;
        font-size: clamp(40px, 6vw, 64px);
        font-weight: 700;
      }

      .celeb-names {
        font-family: 'Playfair Display', 'Noto Serif JP', serif;
        font-size: clamp(28px, 4vw, 46px);
        font-weight: 700;
        margin: 0 0 18px;
        background: linear-gradient(90deg, #fff5d6, #ffd166, #fff5d6);
        -webkit-background-clip: text; background-clip: text;
        color: transparent;
        letter-spacing: 1px;
      }
      .celeb-amount {
        font-family: ui-monospace, 'SF Mono', monospace;
        font-size: clamp(40px, 8vw, 84px);
        font-weight: 800;
        color: #ffd166;
        text-shadow: 0 0 28px rgba(255,209,102,.7), 0 4px 12px rgba(0,0,0,.6);
        letter-spacing: 2px;
        margin-bottom: 14px;
        font-feature-settings: "tnum" 1;
      }
      .celeb-property {
        font-size: clamp(15px, 2vw, 19px);
        color: #f1ead8;
        margin-bottom: 8px;
        opacity: 0.92;
      }
      .celeb-property strong { color: #fff; font-weight: 700; }
      .celeb-source {
        font-size: 11px;
        letter-spacing: 3px;
        text-transform: uppercase;
        color: rgba(255,209,102,0.7);
        margin-bottom: 22px;
      }
      .celeb-message {
        font-style: italic;
        color: #f1ead8;
        font-size: clamp(14px, 2vw, 18px);
        line-height: 1.5;
        margin: 18px auto 0;
        max-width: 640px;
        opacity: 0.9;
      }
      .celeb-trophy { font-size: clamp(36px, 5vw, 60px); margin-bottom: 12px; letter-spacing: 8px; }
      .celeb-close {
        position: absolute;
        top: 18px; right: 18px;
        width: 44px; height: 44px;
        border-radius: 50%;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.2);
        color: #fff;
        font-size: 22px;
        cursor: pointer;
        z-index: 10;
        backdrop-filter: blur(8px);
        opacity: 0;
        animation: celeb-fade-in .3s ease 6s forwards;
      }
      .celeb-close:hover { background: rgba(255,255,255,0.15); }

      /* Confetti */
      .celeb-confetti { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 1; }
      .confetti-piece {
        position: absolute;
        top: -10vh;
        width: 10px; height: 16px;
        will-change: transform;
      }
      @keyframes confetti-fall {
        0%   { transform: translateY(-10vh) rotate(0); opacity: 1; }
        100% { transform: translateY(110vh) rotate(720deg); opacity: 0.7; }
      }
    `;
    document.head.appendChild(s);
  }

  function fmtAmount(n, currency = 'AED') {
    const num = Number(n) || 0;
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(num % 1_000_000 ? 2 : 0).replace(/\.?0+$/, '') + 'M ' + currency;
    if (num >= 1_000)     return (num / 1_000).toFixed(num % 1_000 ? 1 : 0).replace(/\.?0+$/, '') + 'k ' + currency;
    return num.toLocaleString() + ' ' + currency;
  }

  function countUp(el, target, currency, durationMs) {
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = Math.round(target * eased);
      el.textContent = fmtAmount(cur, currency);
      if (t < 1) requestAnimationFrame(tick);
      else el.textContent = fmtAmount(target, currency);
    };
    requestAnimationFrame(tick);
  }

  function spawnConfetti(parent, count = 90) {
    const colors = ['#ffd166', '#ff7a59', '#5cc98f', '#7aa7ff', '#ffffff', '#d4b87a', '#ff8fb1'];
    for (let i = 0; i < count; i++) {
      const p = $el('div', { class: 'confetti-piece' });
      p.style.background = colors[i % colors.length];
      p.style.left = Math.random() * 100 + '%';
      p.style.transform = `rotate(${Math.random() * 360}deg)`;
      const dur = 3 + Math.random() * 3;
      const delay = Math.random() * 4;
      p.style.animation = `confetti-fall ${dur}s linear ${delay}s infinite`;
      if (Math.random() > 0.5) p.style.borderRadius = '50%';
      parent.appendChild(p);
    }
  }

  function close() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    root.classList.remove('show');
    setTimeout(() => root.remove(), 400);
  }

  function trigger(data) {
    injectStyles();

    // Remove any previous instance
    document.getElementById(ROOT_ID)?.remove();

    const closers = (data.closers || []).filter(c => c && c.name);
    const amount = Number(data.amount) || 0;
    const currency = data.currency || 'AED';
    const property = data.property || '';
    const propertyType = data.propertyType || '';
    const leadSource = data.leadSource || '';
    const message = data.message || '';

    const photosHtml = closers.map(c => {
      const init = (c.name || '').split(/\s+/).slice(0,2).map(s => s[0]).join('').toUpperCase() || '?';
      const photoEl = $el('div', { class: 'celeb-photo' });
      if (c.photo) {
        const img = $el('img', { src: c.photo, alt: c.name, onerror: function() { this.replaceWith(makeFallback(init)); } });
        photoEl.appendChild(img);
      } else {
        photoEl.appendChild(makeFallback(init));
      }
      return photoEl;
    });

    function makeFallback(text) {
      return $el('div', { class: 'celeb-photo-fallback' }, [text]);
    }

    const namesText = closers.length === 0
      ? 'TEAM EXCEED'
      : closers.length === 1
        ? closers[0].name
        : closers.length === 2
          ? `${closers[0].name} & ${closers[1].name}`
          : closers.slice(0, -1).map(c => c.name).join(', ') + ' & ' + closers[closers.length - 1].name;

    const root = $el('div', { class: 'celeb-backdrop flash', id: ROOT_ID, onclick: function(e) { if (e.target === this) close(); } });

    const confettiLayer = $el('div', { class: 'celeb-confetti' });
    root.appendChild(confettiLayer);

    const closeBtn = $el('button', { class: 'celeb-close', 'aria-label': 'Close', onclick: close }, ['×']);
    root.appendChild(closeBtn);

    const stage = $el('div', { class: 'celeb-stage' });

    stage.appendChild($el('div', { class: 'celeb-sirens' }, ['🚨 🚨 🚨']));
    stage.appendChild($el('h1', { class: 'celeb-headline' }, ['DEAL ALERT']));

    const drum = $el('div', { class: 'celeb-drumroll' }, [
      $el('span', { class: 'drum-emoji' }, ['🥁']),
      $el('span', { class: 'drum-emoji' }, ['🥁']),
      $el('span', { class: 'drum-emoji' }, ['🥁']),
      ' STAND BY '
    ]);
    stage.appendChild(drum);

    const reveal = $el('div', { class: 'celeb-reveal' });
    const photoRow = $el('div', { class: 'celeb-photos' });
    photosHtml.forEach(p => photoRow.appendChild(p));
    reveal.appendChild(photoRow);
    reveal.appendChild($el('div', { class: 'celeb-trophy' }, ['🏆 🎉 🌹 ⭐ ❤']));
    reveal.appendChild($el('div', { class: 'celeb-names' }, [namesText]));

    const amountEl = $el('div', { class: 'celeb-amount' }, ['0 ' + currency]);
    reveal.appendChild(amountEl);

    if (property || propertyType) {
      const detail = $el('div', { class: 'celeb-property' });
      detail.innerHTML = `Closing on <strong>${propertyType ? propertyType + ' — ' : ''}${property}</strong>`;
      reveal.appendChild(detail);
    }
    if (leadSource) {
      reveal.appendChild($el('div', { class: 'celeb-source' }, ['Lead source · ' + leadSource]));
    }
    if (message) {
      reveal.appendChild($el('div', { class: 'celeb-message' }, [message]));
    }

    stage.appendChild(reveal);
    root.appendChild(stage);
    document.body.appendChild(root);

    // Animate in
    requestAnimationFrame(() => root.classList.add('show'));
    spawnConfetti(confettiLayer);

    // Count up amount after photo reveal animation completes (~5s)
    setTimeout(() => countUp(amountEl, amount, currency, 1400), 5000);

    // Close on Escape
    const onKey = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);
  }

  window.triggerCelebration = trigger;
  window.closeCelebration = close;
})();
