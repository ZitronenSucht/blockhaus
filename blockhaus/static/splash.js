/* Startanimation nur einmal pro Sitzung (Fenster/Tab) und nicht bei „Bewegung reduzieren“ zeigen.
 * Läuft direkt nach dem Splash-Markup, bevor die Seite sichtbar wird. Ausgeblendet wird sie in app.js. */
(function () {
  var sp = document.getElementById('splash');
  if (!sp) return;
  try {
    if (sessionStorage.getItem('bh.splash') || window.matchMedia('(prefers-reduced-motion: reduce)').matches) sp.remove();
    else sessionStorage.setItem('bh.splash', '1');
  } catch (e) { /* ohne Speicher: Animation einfach zeigen */ }
})();
