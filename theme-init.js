/* Theme bootstrap — runs synchronously in <head> on every portal page so the
   saved theme is applied to the document before paint (no FOUC).

   Two themes:
     atrium  — current dark navy + gold luxury (default)
     manor   — light cream + navy + gold
   The user toggles between them via the topbar pill on the dashboard.

   Selectors in liquid.css use [data-theme="manor"] (element-agnostic),
   so the attribute can live on documentElement here and on body when the
   dashboard's applyTheme() also writes there. */
(function () {
  try {
    var saved = localStorage.getItem('theme');
    // Migration: old "manor" used to mean the dark theme. Now manor = light.
    if (saved === 'manor' && !localStorage.getItem('theme_v2')) {
      saved = 'atrium';
      localStorage.setItem('theme', 'atrium');
      localStorage.setItem('theme_v2', '1');
    }
    if (saved !== 'manor' && saved !== 'atrium') saved = 'atrium';
    document.documentElement.setAttribute('data-theme', saved);
    // Once the body exists, mirror it for any selectors still scoped to body.
    var apply = function () {
      if (document.body) document.body.setAttribute('data-theme', saved);
    };
    if (document.body) apply();
    else document.addEventListener('DOMContentLoaded', apply, { once: true });
  } catch (e) { /* noop */ }
})();
