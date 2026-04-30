/* =====================================================================
   Liquid Glass FX
   Tracks cursor across glass surfaces and updates CSS custom properties
   --mx, --my (lens highlight position) and --rx, --ry (3D tilt angle).
   Auto-binds to common glass selectors. Add the .glass-3d class to
   anything else you want to participate.
   ===================================================================== */

(function () {
  if (typeof window === 'undefined') return;

  // Respect users who prefer less motion
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  const SELECTOR = [
    '.glass-3d',
    '.login-btn',
    '.tool-card:not(.disabled)',
    '.btn',
    '.btn-primary',
    '.register-toggle',
    '.icon-btn',
    '.modal'
  ].join(', ');

  // Tilt strength (max degrees). Smaller for buttons, larger for cards.
  function tiltStrength(el) {
    if (el.classList.contains('login-btn') || el.classList.contains('tool-card')) return 7;
    if (el.classList.contains('modal')) return 3;
    return 4;
  }

  function bind(el) {
    if (el._glassBound) return;
    el._glassBound = true;

    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const cx = x - r.width / 2;
      const cy = y - r.height / 2;
      const t = tiltStrength(el);
      const ry = (cx / (r.width / 2)) * t;
      const rx = -(cy / (r.height / 2)) * t;
      el.style.setProperty('--mx', x + 'px');
      el.style.setProperty('--my', y + 'px');
      el.style.setProperty('--rx', rx.toFixed(2) + 'deg');
      el.style.setProperty('--ry', ry.toFixed(2) + 'deg');
    };

    const onLeave = () => {
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
      // Drift the highlight off-screen so it fades cleanly
      el.style.setProperty('--mx', '50%');
      el.style.setProperty('--my', '-50%');
    };

    el.addEventListener('mousemove', onMove, { passive: true });
    el.addEventListener('mouseleave', onLeave);
    el.addEventListener('mouseenter', onMove);
  }

  function bindAll(root = document) {
    root.querySelectorAll(SELECTOR).forEach(bind);
  }

  // Initial pass + observe future additions
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => bindAll());
  } else {
    bindAll();
  }

  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        if (n.matches && n.matches(SELECTOR)) bind(n);
        if (n.querySelectorAll) bindAll(n);
      });
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
