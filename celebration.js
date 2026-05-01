// Deal Alert celebration — v2 split-screen, no emoji, 3D depth, recordable.
// Usage: triggerCelebration({ closers: [{name, photo}], property, propertyType, amount, currency, leadSource, message })

(function () {
  'use strict';

  const ROOT_ID = 'celebration-root';

  function $el(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    for (const k in attrs) {
      if (k === 'class') el.className = attrs[k];
      else if (k === 'style') el.style.cssText = attrs[k];
      else if (k === 'html') el.innerHTML = attrs[k];
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
        z-index: 9999;
        font-family: 'Inter', 'Noto Sans JP', system-ui, sans-serif;
        color: #fff;
        opacity: 0;
        transition: opacity .35s ease;
        overflow: hidden;
        background:
          radial-gradient(ellipse 80% 60% at 30% 50%, rgba(80,8,8,0.85), transparent 60%),
          radial-gradient(ellipse 80% 60% at 80% 60%, rgba(212,184,122,0.30), transparent 60%),
          linear-gradient(135deg, #1a0a0a 0%, #08101e 50%, #1a0a0a 100%);
      }
      .celeb-backdrop.show { opacity: 1; }

      /* SCAN-LINE BG ENERGY */
      .celeb-backdrop::before {
        content: ''; position: absolute; inset: 0;
        background: repeating-linear-gradient(180deg, rgba(255,255,255,0.02) 0 2px, transparent 2px 6px);
        mix-blend-mode: overlay;
        pointer-events: none;
      }
      /* PULSING RED ALERT FLASH */
      .celeb-backdrop::after {
        content: ''; position: absolute; inset: 0;
        background: radial-gradient(ellipse at center, rgba(255,40,40,0.25), transparent 70%);
        opacity: 0;
        animation: celeb-pulse 1s ease-in-out 3;
        pointer-events: none;
      }
      @keyframes celeb-pulse {
        0%, 100% { opacity: 0; }
        50%      { opacity: 1; }
      }

      /* SPLIT STAGE — 2 columns */
      .celeb-stage {
        position: relative;
        width: 100%; height: 100%;
        display: grid;
        grid-template-columns: 1fr 1fr;
        align-items: center;
        z-index: 2;
        padding: 4vw;
        gap: 4vw;
      }
      @media (max-width: 760px) {
        .celeb-stage { grid-template-columns: 1fr; padding: 4vw 6vw; gap: 3vh; }
      }

      /* LEFT: text column */
      .celeb-left {
        position: relative;
        z-index: 3;
        opacity: 0;
        transform: translateX(-40px);
        animation: celeb-slide-l .8s cubic-bezier(.34,1.56,.64,1) 1.6s forwards;
      }
      @keyframes celeb-slide-l { to { opacity: 1; transform: translateX(0); } }

      .celeb-eyebrow {
        display: inline-flex; align-items: center; gap: 14px;
        font-family: 'Inter', sans-serif;
        font-size: clamp(11px, 1.4vw, 14px);
        font-weight: 800;
        letter-spacing: 8px;
        color: #ff5a4a;
        margin-bottom: 16px;
        text-transform: uppercase;
      }
      .celeb-eyebrow .dot {
        width: 10px; height: 10px;
        border-radius: 50%;
        background: #ff3344;
        box-shadow: 0 0 14px #ff3344, 0 0 28px #ff3344;
        animation: celeb-blink 0.6s ease-in-out infinite alternate;
      }
      @keyframes celeb-blink {
        from { opacity: 0.3; transform: scale(.8); }
        to   { opacity: 1;   transform: scale(1.1); }
      }

      .celeb-headline {
        font-family: 'Playfair Display', 'Noto Serif JP', serif;
        font-weight: 800;
        font-size: clamp(54px, 7.5vw, 110px);
        line-height: 0.95;
        letter-spacing: -1px;
        margin: 0 0 22px;
        background: linear-gradient(135deg, #fff5d6 0%, #ffd166 30%, #ff7a59 60%, #ffd166 90%);
        -webkit-background-clip: text; background-clip: text;
        color: transparent;
        text-shadow: 0 0 80px rgba(255,209,102,0.3);
        opacity: 0;
        transform: scale(0.7) rotateX(-30deg);
        transform-origin: bottom center;
        animation: celeb-headline-in .9s cubic-bezier(.34,1.56,.64,1) .35s forwards;
      }
      @keyframes celeb-headline-in {
        to { opacity: 1; transform: scale(1) rotateX(0); }
      }

      .celeb-drumroll {
        font-family: ui-monospace, 'SF Mono', monospace;
        font-size: clamp(13px, 1.8vw, 18px);
        letter-spacing: 5px;
        color: #ffd166;
        margin-bottom: 26px;
        opacity: 0;
        animation: celeb-fade-in .4s ease 1.2s forwards, celeb-fade-out .4s ease 3s forwards;
      }
      .celeb-drumroll .bar {
        display: inline-block;
        width: clamp(120px, 18vw, 220px);
        height: 4px;
        background: rgba(255,209,102,0.15);
        border-radius: 2px;
        overflow: hidden;
        vertical-align: middle;
        margin-left: 14px;
      }
      .celeb-drumroll .bar::after {
        content: '';
        display: block;
        height: 100%;
        background: linear-gradient(90deg, #ffd166, #ff7a59);
        animation: celeb-drumbar 1.5s ease-in-out forwards;
        animation-delay: 1.3s;
      }
      @keyframes celeb-drumbar { from { width: 0; } to { width: 100%; } }
      @keyframes celeb-fade-in  { to { opacity: 1; } }
      @keyframes celeb-fade-out { to { opacity: 0; transform: translateY(-8px); } }

      .celeb-names {
        font-family: 'Playfair Display', 'Noto Serif JP', serif;
        font-size: clamp(28px, 4vw, 52px);
        font-weight: 700;
        margin: 0 0 14px;
        color: #fff;
        letter-spacing: -0.5px;
        line-height: 1.1;
        text-shadow: 0 4px 18px rgba(0,0,0,.6);
      }

      /* AMOUNT — neon-green-to-gold cash gradient with 3D depth */
      .celeb-amount-wrap {
        position: relative;
        margin-bottom: 20px;
      }
      .celeb-amount {
        font-family: 'Playfair Display', 'Noto Serif JP', serif;
        font-size: clamp(54px, 8.5vw, 116px);
        font-weight: 900;
        line-height: 0.95;
        letter-spacing: -2px;
        background: linear-gradient(135deg, #5cf08a 0%, #5cc98f 25%, #ffd166 60%, #ff9a40 100%);
        -webkit-background-clip: text; background-clip: text;
        color: transparent;
        text-shadow:
          0 0 40px rgba(92,240,138,0.4),
          0 0 80px rgba(255,209,102,0.3);
        font-variant-numeric: tabular-nums;
        position: relative;
        display: inline-block;
        filter: drop-shadow(0 12px 24px rgba(0,0,0,.5));
      }
      /* 3D layered shadow stack */
      .celeb-amount::before {
        content: attr(data-text);
        position: absolute; left: 4px; top: 4px;
        background: linear-gradient(135deg, rgba(0,0,0,0.4), rgba(0,0,0,0.1));
        -webkit-background-clip: text; background-clip: text;
        color: transparent;
        z-index: -1;
      }
      .celeb-amount::after {
        content: attr(data-text);
        position: absolute; left: 8px; top: 8px;
        background: linear-gradient(135deg, rgba(0,0,0,0.25), rgba(0,0,0,0));
        -webkit-background-clip: text; background-clip: text;
        color: transparent;
        z-index: -2;
      }

      /* Floating $ particles around the amount */
      .celeb-cash-burst {
        position: absolute; inset: -20px;
        pointer-events: none;
      }
      .cash-particle {
        position: absolute;
        font-family: ui-monospace, monospace;
        font-weight: 900;
        font-size: clamp(20px, 2.5vw, 32px);
        color: #5cf08a;
        text-shadow: 0 0 12px #5cf08a;
        opacity: 0;
        animation: cash-float 2.4s ease-out forwards;
      }
      @keyframes cash-float {
        0%   { transform: translateY(40px) rotate(-15deg) scale(0.4); opacity: 0; }
        20%  { opacity: 1; }
        100% { transform: translateY(-200px) rotate(20deg) scale(1.2); opacity: 0; }
      }

      .celeb-meta { display: flex; flex-direction: column; gap: 6px; margin-bottom: 24px; }
      .celeb-meta .label {
        font-size: 10px; letter-spacing: 3px; text-transform: uppercase;
        color: rgba(255,255,255,0.5);
        font-weight: 700;
      }
      .celeb-meta .value {
        font-size: clamp(14px, 1.6vw, 18px);
        color: #fff;
        line-height: 1.4;
        font-weight: 500;
      }
      .celeb-meta .value strong { color: #ffd166; font-weight: 700; }

      .celeb-actions {
        display: flex; gap: 10px; flex-wrap: wrap;
        margin-top: 24px;
        opacity: 0;
        animation: celeb-fade-in .35s ease 5.8s forwards;
      }
      .celeb-btn {
        display: inline-flex; align-items: center; gap: 8px;
        padding: 12px 20px;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.18);
        color: #fff;
        border-radius: 10px;
        cursor: pointer;
        font-family: inherit;
        font-size: 12px;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        font-weight: 700;
        backdrop-filter: blur(10px);
        transition: all .15s;
      }
      .celeb-btn:hover { background: rgba(255,255,255,0.16); transform: translateY(-1px); }
      .celeb-btn svg { width: 14px; height: 14px; }
      .celeb-btn.primary {
        background: linear-gradient(135deg, #ffd166, #ff7a59);
        color: #1a0a0a;
        border-color: #ffd166;
      }
      .celeb-btn.primary:hover { box-shadow: 0 12px 28px -8px rgba(255,209,102,.6); }

      /* RIGHT: photo column with 3D depth */
      .celeb-right {
        position: relative;
        height: 100%;
        display: grid; place-items: center end;
        z-index: 2;
        opacity: 0;
        transform: translateX(60px) scale(0.85);
        animation: celeb-photo-in 1s cubic-bezier(.34,1.56,.64,1) 1.0s forwards;
      }
      @keyframes celeb-photo-in {
        to { opacity: 1; transform: translateX(0) scale(1); }
      }
      @media (max-width: 760px) { .celeb-right { place-items: center; min-height: 40vh; } }

      .celeb-photo-frame {
        position: relative;
        width: clamp(280px, 42vw, 560px);
        height: clamp(360px, 70vh, 720px);
        max-height: 84vh;
        perspective: 1200px;
      }
      .celeb-photo-inner {
        position: absolute; inset: 0;
        transform: rotateY(-7deg) rotateX(2deg);
        transform-style: preserve-3d;
        transition: transform .4s ease;
      }
      .celeb-photo-inner img {
        width: 100%; height: 100%;
        object-fit: contain;
        object-position: bottom center;
        filter:
          drop-shadow(0 30px 50px rgba(0,0,0,.7))
          drop-shadow(0 0 60px rgba(255,209,102,0.4))
          drop-shadow(0 0 100px rgba(255,209,102,0.25));
      }
      .celeb-photo-fallback {
        width: 100%; height: 100%;
        background: linear-gradient(135deg, #ffd166, #d4b87a, #8a6a30);
        clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
        display: grid; place-items: center;
        color: #1a0a0a;
        font-family: 'Playfair Display', serif;
        font-size: clamp(80px, 14vw, 200px);
        font-weight: 800;
        filter: drop-shadow(0 30px 50px rgba(0,0,0,.7)) drop-shadow(0 0 60px rgba(255,209,102,0.4));
      }

      /* Glow ring behind photo */
      .celeb-photo-glow {
        position: absolute;
        inset: 5%;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(255,209,102,0.4) 0%, rgba(255,107,107,0.2) 40%, transparent 70%);
        filter: blur(40px);
        z-index: 0;
        animation: celeb-glow-pulse 3s ease-in-out infinite;
      }
      @keyframes celeb-glow-pulse {
        0%, 100% { opacity: 0.7; transform: scale(1); }
        50%      { opacity: 1;   transform: scale(1.08); }
      }

      /* Trophy badge floating top right */
      .celeb-badge {
        position: absolute;
        top: 8%; right: -2%;
        display: flex; flex-direction: column; align-items: center;
        background: linear-gradient(135deg, #ffd166, #ff7a59);
        color: #1a0a0a;
        padding: 16px 12px;
        border-radius: 12px;
        font-family: 'Playfair Display', serif;
        text-align: center;
        box-shadow: 0 16px 32px -10px rgba(255,209,102,.5);
        z-index: 4;
        opacity: 0;
        transform: scale(0) rotate(-20deg);
        animation: celeb-badge-in .8s cubic-bezier(.34,1.56,.64,1) 4.5s forwards;
      }
      @keyframes celeb-badge-in {
        to { opacity: 1; transform: scale(1) rotate(8deg); }
      }
      .celeb-badge .top { font-size: 9px; letter-spacing: 2px; font-weight: 800; }
      .celeb-badge .big { font-size: 22px; font-weight: 800; line-height: 1; margin-top: 2px; }

      /* CLOSE */
      .celeb-close {
        position: absolute;
        top: 18px; right: 18px;
        width: 44px; height: 44px;
        border-radius: 50%;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.2);
        color: #fff;
        font-size: 24px; line-height: 1;
        cursor: pointer;
        z-index: 10;
        backdrop-filter: blur(8px);
        opacity: 0;
        animation: celeb-fade-in .3s ease 5.8s forwards;
      }
      .celeb-close:hover { background: rgba(255,255,255,0.15); }

      /* CONFETTI */
      .celeb-confetti { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 1; }
      .confetti-piece {
        position: absolute; top: -12vh;
        width: 12px; height: 18px;
        will-change: transform;
      }
      @keyframes confetti-fall {
        0%   { transform: translateY(-12vh) rotate(0); opacity: 1; }
        100% { transform: translateY(115vh) rotate(720deg); opacity: 0.5; }
      }

      /* RECORDING INDICATOR */
      .celeb-recording {
        position: absolute;
        top: 18px; left: 18px;
        background: rgba(255,40,40,0.85);
        color: #fff;
        font-family: ui-monospace, monospace;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 2px;
        padding: 6px 12px;
        border-radius: 999px;
        display: none;
        align-items: center;
        gap: 8px;
        z-index: 11;
      }
      .celeb-recording.active { display: inline-flex; }
      .celeb-recording .rec-dot {
        width: 8px; height: 8px;
        border-radius: 50%;
        background: #fff;
        animation: celeb-blink .8s ease-in-out infinite alternate;
      }
    `;
    document.head.appendChild(s);
  }

  function fmtAmount(n, currency = 'AED') {
    const num = Number(n) || 0;
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(num % 1_000_000 ? 2 : 0).replace(/\.?0+$/, '') + 'M';
    if (num >= 1_000)     return (num / 1_000).toFixed(num % 1_000 ? 1 : 0).replace(/\.?0+$/, '') + 'K';
    return num.toLocaleString();
  }

  function countUp(el, target, currency, durationMs) {
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = Math.round(target * eased);
      const txt = fmtAmount(cur, currency) + ' ' + currency;
      el.textContent = txt;
      el.setAttribute('data-text', txt);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function spawnCashParticles(parent) {
    const symbols = ['$', '$', '$', '€', '£', '¥', '✦', '◆'];
    let i = 0;
    const id = setInterval(() => {
      if (i++ > 18) { clearInterval(id); return; }
      const p = $el('div', { class: 'cash-particle' });
      p.textContent = symbols[Math.floor(Math.random() * symbols.length)];
      p.style.left = Math.random() * 100 + '%';
      p.style.bottom = '0';
      p.style.animationDelay = (Math.random() * 0.4) + 's';
      parent.appendChild(p);
      setTimeout(() => p.remove(), 3000);
    }, 100);
  }

  function spawnConfetti(parent, count = 110) {
    const colors = ['#ffd166', '#ff7a59', '#5cf08a', '#7aa7ff', '#ffffff', '#d4b87a', '#ff8fb1'];
    for (let i = 0; i < count; i++) {
      const p = $el('div', { class: 'confetti-piece' });
      p.style.background = colors[i % colors.length];
      p.style.left = Math.random() * 100 + '%';
      p.style.transform = `rotate(${Math.random() * 360}deg)`;
      const dur = 3 + Math.random() * 4;
      const delay = Math.random() * 5;
      p.style.animation = `confetti-fall ${dur}s linear ${delay}s infinite`;
      if (Math.random() > 0.55) p.style.borderRadius = '50%';
      if (Math.random() > 0.7)  { p.style.width = '6px'; p.style.height = '6px'; }
      parent.appendChild(p);
    }
  }

  function close() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    root.classList.remove('show');
    setTimeout(() => root.remove(), 400);
  }

  // ============ AUDIO — drum roll synthesised via Web Audio API ============
  let _audioCtx = null;
  function getAudioCtx() {
    if (_audioCtx) return _audioCtx;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      _audioCtx = new Ctx();
    } catch (e) { return null; }
    return _audioCtx;
  }
  function playSnareHit(ctx, time, vol) {
    // Filtered white-noise burst — quick decay = snare-ish "tap"
    const len = Math.floor(ctx.sampleRate * 0.05);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    src.connect(hp).connect(g).connect(ctx.destination);
    src.start(time); src.stop(time + 0.05);
  }
  function playCymbalCrash(ctx, time) {
    const len = Math.floor(ctx.sampleRate * 1.6);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-3 * i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 4000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 1.6);
    src.connect(hp).connect(g).connect(ctx.destination);
    src.start(time);
  }
  function playKickThump(ctx, time) {
    // Sine sweep from 120Hz → 30Hz for a deep kick
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, time);
    osc.frequency.exponentialRampToValueAtTime(30, time + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.6, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
    osc.connect(g).connect(ctx.destination);
    osc.start(time); osc.stop(time + 0.3);
  }
  function playFanfare(ctx, time) {
    // Brief major chord stab on the reveal
    const freqs = [523.25, 659.26, 783.99, 1046.50]; // C5 E5 G5 C6
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(0.12, time + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.6);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 4000;
      osc.connect(lp).connect(g).connect(ctx.destination);
      osc.start(time + i * 0.05);
      osc.stop(time + 0.7);
    });
  }
  function playDrumRoll(durationMs, startDelayMs) {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const startAt = ctx.currentTime + (startDelayMs / 1000);
    const totalSec = durationMs / 1000;
    const hits = 36;
    for (let i = 0; i < hits; i++) {
      const t = startAt + (i / hits) * totalSec;
      // Volume ramps from quiet to loud
      const vol = 0.08 + (i / hits) * 0.45;
      playSnareHit(ctx, t, vol);
    }
    // Big finish: kick + cymbal crash + fanfare chord at the end of the roll
    const climax = startAt + totalSec;
    playKickThump(ctx, climax);
    playCymbalCrash(ctx, climax);
    playFanfare(ctx, climax + 0.08);
  }

  // Screen-recording — uses getDisplayMedia (user picks tab/screen, ~10s capture)
  async function recordCelebration() {
    if (!navigator.mediaDevices?.getDisplayMedia || !window.MediaRecorder) {
      alert('Screen recording is not supported in this browser. Try Chrome/Edge/Brave.');
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30, displaySurface: 'browser' },
        audio: true
      });
    } catch (e) {
      // User cancelled or denied
      return;
    }
    const recIndicator = document.querySelector('.celeb-recording');
    if (recIndicator) recIndicator.classList.add('active');

    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9'
                : MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8'
                : 'video/webm';
    const chunks = [];
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunks, { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deal-alert-${Date.now()}.webm`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (recIndicator) recIndicator.classList.remove('active');
    };
    rec.start();
    // Stream ended early (user clicked Stop sharing) → finalise
    stream.getVideoTracks()[0].addEventListener('ended', () => { if (rec.state !== 'inactive') rec.stop(); });
    // Auto-stop after 11s (covers full celebration + a tail)
    setTimeout(() => { if (rec.state !== 'inactive') rec.stop(); }, 11000);
  }

  function trigger(data) {
    injectStyles();
    document.getElementById(ROOT_ID)?.remove();

    const closers = (data.closers || []).filter(c => c && c.name);
    const amount = Number(data.amount) || 0;
    const currency = data.currency || 'AED';
    const property = data.property || '';
    const propertyType = data.propertyType || '';
    const leadSource = data.leadSource || '';
    const message = data.message || '';

    const namesText = closers.length === 0
      ? 'TEAM EXCEED'
      : closers.length === 1
        ? closers[0].name
        : closers.length === 2
          ? `${closers[0].name} & ${closers[1].name}`
          : closers.slice(0, -1).map(c => c.name).join(', ') + ' & ' + closers[closers.length - 1].name;

    // Build the right column — main subject is the FIRST closer's photo (largest impact).
    const heroCloser = closers[0] || { name: '?' };
    const init = (heroCloser.name || '').split(/\s+/).slice(0,2).map(s => s[0]).join('').toUpperCase() || '?';

    // Root
    const root = $el('div', { class: 'celeb-backdrop', id: ROOT_ID, onclick: function(e) { if (e.target === this) close(); } });
    root.appendChild($el('div', { class: 'celeb-confetti' }));
    root.appendChild($el('div', { class: 'celeb-recording' }, [$el('div', { class: 'rec-dot' }), 'REC']));
    root.appendChild($el('button', { class: 'celeb-close', 'aria-label': 'Close', onclick: close }, ['×']));

    // Stage with two columns
    const stage = $el('div', { class: 'celeb-stage' });

    // LEFT COLUMN — text content
    const left = $el('div', { class: 'celeb-left' });
    left.appendChild($el('div', { class: 'celeb-eyebrow' }, [$el('span', { class: 'dot' }), 'DEAL ALERT']));
    left.appendChild($el('h1', { class: 'celeb-headline' }, ['CLOSED.']));

    const drum = $el('div', { class: 'celeb-drumroll' }, ['DRUMROLL', $el('span', { class: 'bar' })]);
    left.appendChild(drum);

    left.appendChild($el('div', { class: 'celeb-names' }, [namesText]));

    const amountWrap = $el('div', { class: 'celeb-amount-wrap' });
    const amountEl = $el('div', { class: 'celeb-amount', 'data-text': '0 ' + currency }, ['0 ' + currency]);
    amountWrap.appendChild(amountEl);
    const cashBurst = $el('div', { class: 'celeb-cash-burst' });
    amountWrap.appendChild(cashBurst);
    left.appendChild(amountWrap);

    if (property || propertyType) {
      const meta = $el('div', { class: 'celeb-meta' });
      meta.appendChild($el('div', { class: 'label' }, ['Closing on']));
      const v = $el('div', { class: 'value' });
      v.innerHTML = `${propertyType ? '<strong>' + propertyType + '</strong> · ' : ''}${property}`;
      meta.appendChild(v);
      left.appendChild(meta);
    }
    if (leadSource) {
      const meta = $el('div', { class: 'celeb-meta' });
      meta.appendChild($el('div', { class: 'label' }, ['Lead source']));
      meta.appendChild($el('div', { class: 'value' }, [leadSource]));
      left.appendChild(meta);
    }
    if (message) {
      const meta = $el('div', { class: 'celeb-meta' });
      meta.appendChild($el('div', { class: 'value', style: 'opacity:0.85;font-style:italic' }, [message]));
      left.appendChild(meta);
    }

    // Action buttons
    const actions = $el('div', { class: 'celeb-actions' });
    const recBtn = $el('button', {
      class: 'celeb-btn primary', onclick: recordCelebration
    }, [
      $el('span', { html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>' }),
      'Record Video'
    ]);
    const replayBtn = $el('button', {
      class: 'celeb-btn', onclick: () => { close(); setTimeout(() => trigger(data), 450); }
    }, [
      $el('span', { html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>' }),
      'Replay'
    ]);
    actions.appendChild(recBtn);
    actions.appendChild(replayBtn);
    left.appendChild(actions);

    stage.appendChild(left);

    // RIGHT COLUMN — hero photo
    const right = $el('div', { class: 'celeb-right' });
    const frame = $el('div', { class: 'celeb-photo-frame' });
    frame.appendChild($el('div', { class: 'celeb-photo-glow' }));
    const inner = $el('div', { class: 'celeb-photo-inner' });
    if (heroCloser.photo) {
      const img = $el('img', {
        src: heroCloser.photo,
        alt: heroCloser.name,
        onerror: function() {
          const fb = $el('div', { class: 'celeb-photo-fallback' }, [init]);
          this.replaceWith(fb);
        }
      });
      inner.appendChild(img);
    } else {
      inner.appendChild($el('div', { class: 'celeb-photo-fallback' }, [init]));
    }
    frame.appendChild(inner);

    // Trophy badge
    const badge = $el('div', { class: 'celeb-badge' });
    badge.appendChild($el('div', { class: 'top' }, ['DEAL VALUE']));
    badge.appendChild($el('div', { class: 'big' }, [fmtAmount(amount, currency) + ' ' + currency]));
    frame.appendChild(badge);

    right.appendChild(frame);
    stage.appendChild(right);
    root.appendChild(stage);
    document.body.appendChild(root);

    requestAnimationFrame(() => root.classList.add('show'));
    spawnConfetti(root.querySelector('.celeb-confetti'));

    // Drumroll timing: 1.2s start, 1.5s bar, 0.3s settle = 3.0s total → reveal amount around 3.4s
    setTimeout(() => {
      countUp(amountEl, amount, currency, 1800);
      spawnCashParticles(cashBurst);
    }, 3400);

    // Subtle hover-tilt for photo (interactive 3D feel)
    const inner3d = inner;
    frame.addEventListener('mousemove', e => {
      const r = frame.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      inner3d.style.transform = `rotateY(${-7 + x * 8}deg) rotateX(${2 - y * 6}deg)`;
    });
    frame.addEventListener('mouseleave', () => { inner3d.style.transform = ''; });

    // Esc to close
    const onKey = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);
  }

  window.triggerCelebration = trigger;
  window.closeCelebration = close;
  window.recordCelebration = recordCelebration;
})();
