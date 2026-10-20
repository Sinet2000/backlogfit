// Applies the saved theme and mode before first paint. Loaded as a classic, render-blocking
// external script so it works under `script-src 'self'` without inline code.
(() => {
  try {
    const root = document.documentElement;
    const read = (key, legacy) => localStorage.getItem(key) ?? localStorage.getItem(legacy);
    const theme = read('bf:theme', 'bf-theme');
    const mode = read('bf:mode', 'bf-mode');
    if (theme === 'colorful') root.setAttribute('data-theme', 'colorful');
    if (mode === 'light' || mode === 'dark' || mode === 'contrast') {
      root.setAttribute('data-mode', mode);
    }
  } catch {}
})();
