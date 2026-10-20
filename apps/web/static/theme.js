// Applies the saved theme and mode before first paint. Loaded as a classic, render-blocking
// external script so it works under `script-src 'self'` without inline code.
(() => {
  try {
    const root = document.documentElement;
    const theme = localStorage.getItem('bf-theme');
    const mode = localStorage.getItem('bf-mode');
    if (theme === 'colorful') root.setAttribute('data-theme', 'colorful');
    if (mode === 'light' || mode === 'dark' || mode === 'contrast') {
      root.setAttribute('data-mode', mode);
    }
  } catch {
    // Storage unavailable (private mode, blocked): the CSS follows the system preference.
  }
})();
