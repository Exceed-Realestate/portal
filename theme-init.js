/* Theme bootstrap — runs synchronously in <head> on every portal page so the
   saved theme is applied to the document before paint (no FOUC).

   Three themes:
     atrium  — dark navy + gold luxury hospitality (default)
     manor   — light cream + navy + gold day-mode
     nexus   — data / command-center mode (cool surfaces, glow accents)
   The user cycles through them via the topbar pill on the dashboard. */
(function () {
  var VALID = ['atrium', 'manor', 'nexus'];
  try {
    var saved = localStorage.getItem('theme');
    // Migration: old "manor" used to mean the dark theme. Now manor = light.
    if (saved === 'manor' && !localStorage.getItem('theme_v2')) {
      saved = 'atrium';
      localStorage.setItem('theme', 'atrium');
      localStorage.setItem('theme_v2', '1');
    }
    if (VALID.indexOf(saved) === -1) saved = 'atrium';
    document.documentElement.setAttribute('data-theme', saved);
    // Once the body exists, mirror it for any selectors still scoped to body.
    var apply = function () {
      if (document.body) document.body.setAttribute('data-theme', saved);
    };
    if (document.body) apply();
    else document.addEventListener('DOMContentLoaded', apply, { once: true });
  } catch (e) { /* noop */ }
})();
