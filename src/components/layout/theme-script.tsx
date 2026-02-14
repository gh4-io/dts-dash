/**
 * Inline script injected into <head> to prevent FOUC.
 * Reads theme-preset from localStorage and applies the class
 * before first paint. next-themes handles the dark/light class.
 */
export function ThemeScript() {
  const script = `
(function() {
  try {
    var preset = localStorage.getItem('theme-preset') || 'neutral';
    var accent = localStorage.getItem('accent-color');
    document.documentElement.classList.add('theme-' + preset);
    if (accent) {
      document.documentElement.style.setProperty('--accent', accent);
      document.documentElement.style.setProperty('--ring', accent);
    }
  } catch(e) {}
})();
`.trim();

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
