/* ========================================================================
   pwa-init.js — registers the service worker, captures the install prompt,
   and (on iOS, where there's no programmatic install) shows a one-time
   "Add to Home Screen" hint.

   Loaded as a regular <script> on every page. Idempotent.
   ======================================================================== */

(function () {
  'use strict';

  /* ----- 1. Register the service worker (silently fails on unsupported
     browsers / file:// origins like local dev). ----- */
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js', { scope: './' })
        .then((reg) => {
          // If a new SW is waiting, activate it on next load — no UI needed
          // since the runtime cache is busted by CACHE_VERSION anyway.
          if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          reg.addEventListener('updatefound', () => {
            const sw = reg.installing;
            if (!sw) return;
            sw.addEventListener('statechange', () => {
              if (sw.state === 'installed' && navigator.serviceWorker.controller) {
                sw.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          });
        })
        .catch((err) => console.warn('[pwa] SW register failed', err));
    });
  }

  /* ----- 2. Android / Chrome / Edge install prompt. -----
     The browser fires 'beforeinstallprompt' when the PWA is installable.
     We stash it and surface our own button (so the prompt looks branded
     instead of the generic browser banner). */
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner('android');
  });

  // After successful install, hide the banner and remember.
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideInstallBanner();
    try { localStorage.setItem('pwa_installed', '1'); } catch (_) {}
  });

  /* ----- 3. iOS — there's no install prompt API. We show a one-time
     hint on Safari (not Chrome iOS, which can't install PWAs). ----- */
  function isIosSafari() {
    const ua = navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/i.test(ua);
    if (!isIos) return false;
    // Chrome iOS = "CriOS", Firefox iOS = "FxiOS" — those can't install.
    if (/CriOS|FxiOS|EdgiOS/.test(ua)) return false;
    return true;
  }
  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
  }

  // Don't show the iOS hint until the user has used the portal at least
  // once (so we're not blocking the login screen with a banner).
  function shouldShowIosHint() {
    if (isStandalone()) return false;
    try {
      if (localStorage.getItem('pwa_install_dismissed') === '1') return false;
      if (localStorage.getItem('pwa_installed') === '1') return false;
      const visits = +(localStorage.getItem('portal_visits') || 0) + 1;
      localStorage.setItem('portal_visits', String(visits));
      return visits >= 2;  // show on second visit onward
    } catch (_) { return false; }
  }

  /* ----- 4. Banner UI — small, dismissible, branded. ----- */
  function ensureBannerStyles() {
    if (document.getElementById('pwa-banner-style')) return;
    const css = `
      .pwa-banner {
        position: fixed; left: 12px; right: 12px; bottom: 16px; z-index: 9999;
        max-width: 420px; margin: 0 auto;
        background: linear-gradient(180deg, rgba(16,42,79,0.96), rgba(10,31,61,0.96));
        border: 1px solid rgba(212,184,122,0.45);
        backdrop-filter: blur(14px);
        border-radius: 14px;
        padding: 14px 16px;
        color: #f1ead8;
        font-family: 'Inter', 'Noto Sans JP', -apple-system, BlinkMacSystemFont, sans-serif;
        box-shadow: 0 22px 50px -22px rgba(0,0,0,0.6);
        display: grid;
        grid-template-columns: 40px 1fr auto;
        gap: 12px;
        align-items: center;
        animation: pwaSlideIn .3s ease-out;
      }
      @keyframes pwaSlideIn {
        from { transform: translateY(20px); opacity: 0; }
        to   { transform: translateY(0);    opacity: 1; }
      }
      .pwa-banner img.pwa-icon {
        width: 40px; height: 40px; border-radius: 9px; object-fit: cover;
      }
      .pwa-banner .pwa-text {
        font-size: 13px; line-height: 1.4;
      }
      .pwa-banner .pwa-text strong {
        display: block; color: #f1ead8; font-weight: 700; font-size: 13.5px;
        margin-bottom: 1px;
      }
      .pwa-banner .pwa-text span {
        color: #9aa8c2; font-size: 11.5px;
      }
      .pwa-banner-actions { display: flex; gap: 6px; }
      .pwa-banner button {
        background: linear-gradient(135deg, #f1ead8, #d4b87a);
        color: #0a1f3d; border: 0; border-radius: 8px;
        padding: 8px 12px; font-weight: 700; font-size: 11px;
        letter-spacing: 0.8px; text-transform: uppercase;
        cursor: pointer; font-family: inherit;
        white-space: nowrap;
      }
      .pwa-banner button.ghost {
        background: transparent; color: #9aa8c2;
        border: 1px solid rgba(255,255,255,0.18);
        padding: 7px 10px;
      }
      .pwa-ios-sheet {
        position: fixed; inset: 0; z-index: 10000;
        background: rgba(5,15,30,0.78); backdrop-filter: blur(8px);
        display: grid; place-items: end center;
        padding: 24px;
      }
      .pwa-ios-sheet .card {
        max-width: 380px; width: 100%;
        background: linear-gradient(180deg, rgba(16,42,79,0.98), rgba(10,31,61,0.98));
        border: 1px solid rgba(212,184,122,0.45);
        border-radius: 18px; padding: 22px 22px 28px;
        color: #f1ead8;
        font-family: 'Inter', 'Noto Sans JP', sans-serif;
        text-align: center;
        margin-bottom: 32px;
      }
      .pwa-ios-sheet h3 {
        font-family: 'Playfair Display', 'Noto Serif JP', serif;
        font-weight: 600; font-size: 19px; margin: 6px 0 4px;
      }
      .pwa-ios-sheet p { color: #9aa8c2; font-size: 13px; margin: 0 0 14px; line-height: 1.55; }
      .pwa-ios-sheet ol {
        text-align: left; margin: 0; padding-left: 22px;
        color: #f1ead8; font-size: 13.5px; line-height: 1.7;
      }
      .pwa-ios-sheet ol b { color: #d4b87a; font-weight: 700; }
      .pwa-ios-sheet .arrow {
        font-size: 17px; color: #d4b87a; vertical-align: -2px;
      }
      .pwa-ios-sheet .close {
        background: transparent; border: 1px solid rgba(255,255,255,0.18);
        color: #9aa8c2; border-radius: 8px;
        padding: 8px 14px; margin-top: 18px;
        font-family: inherit; font-size: 11px; letter-spacing: 1px;
        text-transform: uppercase; cursor: pointer; font-weight: 600;
      }
    `;
    const style = document.createElement('style');
    style.id = 'pwa-banner-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function showInstallBanner(kind) {
    if (isStandalone()) return;
    try {
      if (localStorage.getItem('pwa_install_dismissed') === '1') return;
    } catch (_) {}
    ensureBannerStyles();
    if (document.getElementById('pwaBanner')) return;
    const div = document.createElement('div');
    div.className = 'pwa-banner';
    div.id = 'pwaBanner';
    div.innerHTML = `
      <img class="pwa-icon" src="icon-192.png" alt="">
      <div class="pwa-text">
        <strong>Install Exceed Portal</strong>
        <span>Open faster &amp; full-screen on your phone.</span>
      </div>
      <div class="pwa-banner-actions">
        <button id="pwaInstallBtn">Install</button>
        <button class="ghost" id="pwaDismissBtn">×</button>
      </div>
    `;
    document.body.appendChild(div);
    document.getElementById('pwaInstallBtn').addEventListener('click', () => {
      if (kind === 'android' && deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(() => {
          deferredPrompt = null;
          hideInstallBanner();
        });
      } else if (kind === 'ios') {
        showIosSheet();
      }
    });
    document.getElementById('pwaDismissBtn').addEventListener('click', () => {
      try { localStorage.setItem('pwa_install_dismissed', '1'); } catch (_) {}
      hideInstallBanner();
    });
  }
  function hideInstallBanner() {
    const el = document.getElementById('pwaBanner');
    if (el) el.remove();
  }
  function showIosSheet() {
    ensureBannerStyles();
    if (document.getElementById('pwaIosSheet')) return;
    const div = document.createElement('div');
    div.className = 'pwa-ios-sheet';
    div.id = 'pwaIosSheet';
    div.innerHTML = `
      <div class="card">
        <img src="icon-192.png" alt="" style="width:54px;height:54px;border-radius:12px;">
        <h3>Install Exceed Portal</h3>
        <p>Add to your home screen for a full-screen, app-like experience.</p>
        <ol>
          <li>Tap the <b>Share</b> <span class="arrow">⎋</span> button in Safari</li>
          <li>Scroll and tap <b>Add to Home Screen</b></li>
          <li>Tap <b>Add</b> in the top-right</li>
        </ol>
        <button class="close" id="pwaIosClose">Got it</button>
      </div>
    `;
    document.body.appendChild(div);
    document.getElementById('pwaIosClose').addEventListener('click', () => {
      div.remove();
      try { localStorage.setItem('pwa_install_dismissed', '1'); } catch (_) {}
      hideInstallBanner();
    });
    div.addEventListener('click', (e) => { if (e.target === div) div.remove(); });
  }

  // iOS: show banner only after the user has visited a couple of times.
  if (isIosSafari() && shouldShowIosHint()) {
    window.addEventListener('load', () => setTimeout(() => showInstallBanner('ios'), 800));
  }
})();
