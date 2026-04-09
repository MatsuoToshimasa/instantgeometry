(async function () {
  'use strict';

  async function injectHtml(targetId, url) {
    const el = document.getElementById(targetId);
    if (!el) return;

    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) throw new Error(url);
      el.innerHTML = await res.text();
    } catch (e) {
      console.error('Failed to load component:', url, e);
    }
  }

  await injectHtml('site-header', '/assets/header.html');
  await injectHtml('site-footer', '/assets/footer.html');

  if (typeof window.updateAuthUI === 'function') {
    window.updateAuthUI();
  }

  document.dispatchEvent(new CustomEvent('site-components:ready'));
})();
