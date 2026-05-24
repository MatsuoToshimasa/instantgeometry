(function () {
  function localProjectFileRoot() {
    if (window.location.protocol !== 'file:') return '';
    const marker = '/instantgeometry/';
    const path = window.location.pathname || '';
    const index = path.indexOf(marker);
    return index >= 0 ? path.slice(0, index + marker.length) : '';
  }

  function resolveLocalFileHref(rawHref) {
    if (!rawHref || window.location.protocol !== 'file:') return '';
    if (!rawHref.startsWith('/') || rawHref.startsWith('//')) return '';
    const root = localProjectFileRoot();
    if (!root) return '';
    const hashIndex = rawHref.search(/[?#]/);
    const pathPart = hashIndex >= 0 ? rawHref.slice(0, hashIndex) : rawHref;
    const suffix = hashIndex >= 0 ? rawHref.slice(hashIndex) : '';
    let localPath = pathPart.replace(/^\/+/, '');
    if (!localPath) localPath = 'index.html';
    else if (localPath.endsWith('/')) localPath += 'index.html';
    return 'file://' + root + localPath + suffix;
  }

  function installLocalFileNavigation() {
    if (window.location.protocol !== 'file:') return;
    document.querySelectorAll('a[href^="/"]').forEach(function (anchor) {
      const resolved = resolveLocalFileHref(anchor.getAttribute('href') || '');
      if (resolved) anchor.setAttribute('href', resolved);
    });
    document.addEventListener('click', function (event) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target && event.target.closest ? event.target.closest('a[href]') : null;
      if (!anchor) return;
      const resolved = resolveLocalFileHref(anchor.getAttribute('href') || '');
      if (!resolved) return;
      event.preventDefault();
      window.location.href = resolved;
    });
  }

  function renderTopicKatex() {
    if (!window.katex || typeof window.katex.render !== 'function') return;
    document.querySelectorAll('[data-katex-display]').forEach(function (node) {
      window.katex.render(node.getAttribute('data-katex-display') || '', node, {
        displayMode: true,
        throwOnError: false,
        output: 'html',
        strict: 'ignore'
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      installLocalFileNavigation();
      renderTopicKatex();
    });
  } else {
    installLocalFileNavigation();
    renderTopicKatex();
  }
})();
