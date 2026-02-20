/**
 * Inline script injected into <head> to prevent FOUC.
 * Reads theme-preset and color mode from localStorage, falling back to
 * system-level appearance defaults from server.config.yml.
 *
 * Also injects window.__APPEARANCE_DEFAULTS__ for client-side stores.
 */

interface ThemeScriptProps {
  systemPreset: string;
  systemColorMode: "light" | "dark" | "system";
}

export function ThemeScript({ systemPreset, systemColorMode }: ThemeScriptProps) {
  const payload = JSON.stringify({
    defaultColorMode: systemColorMode,
    defaultThemePreset: systemPreset,
  });

  const script = `
(function() {
  try {
    window.__APPEARANCE_DEFAULTS__=${payload};

    // ── Theme preset (FOUC prevention) ──
    var preset = localStorage.getItem('theme-preset') || ${JSON.stringify(systemPreset)};
    document.documentElement.classList.add('theme-' + preset);

    var accent = localStorage.getItem('accent-color');
    if (accent) {
      document.documentElement.style.setProperty('--accent', accent);
      document.documentElement.style.setProperty('--ring', accent);
    }

    // ── Color mode (FOUC prevention) ──
    // next-themes stores the user's choice under the 'theme' key.
    // If not present, apply the system default before next-themes hydrates.
    var storedTheme = localStorage.getItem('theme');
    if (!storedTheme) {
      var mode = ${JSON.stringify(systemColorMode)};
      if (mode === 'system') {
        mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      document.documentElement.classList.add(mode);
    }
  } catch(e) {}
})();
`.trim();

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
