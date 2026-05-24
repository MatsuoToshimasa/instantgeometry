(function () {
  'use strict';

  function getCurrentLanguage() {
    try {
      const url = new URL(window.location.href);
      const lang = url.searchParams.get('lang');
      if (lang) return lang;
    } catch (e) {
    }

    if (window.siteI18n && typeof window.siteI18n.getLanguage === 'function') {
      return window.siteI18n.getLanguage();
    }

    try {
      return localStorage.getItem('site-language') || document.documentElement.lang || 'ja';
    } catch (e) {
      return document.documentElement.lang || 'ja';
    }
  }

  function isHttpUrl(url) {
    return url.protocol === 'http:' || url.protocol === 'https:';
  }

  function sanitizeRedirect(rawValue, fallback) {
    const safeFallback = fallback || '/account/';
    const raw = String(rawValue || '').trim();
    if (!raw) return safeFallback;

    try {
      const url = new URL(raw, window.location.origin);
      if (!isHttpUrl(url)) return safeFallback;
      if (url.origin !== window.location.origin) return safeFallback;
      if (url.pathname.startsWith('/auth/callback')) return safeFallback;
      return url.pathname + url.search + url.hash;
    } catch (e) {
      return safeFallback;
    }
  }

  function redirectWithLanguage(target) {
    const safeTarget = sanitizeRedirect(target, '/account/');
    const lang = getCurrentLanguage();
    if (!lang) return safeTarget;

    try {
      const url = new URL(safeTarget, window.location.origin);
      if (!url.searchParams.get('lang')) {
        url.searchParams.set('lang', lang);
      }
      return url.pathname + url.search + url.hash;
    } catch (e) {
      return safeTarget;
    }
  }

  function getRedirectFromSearch(fallback) {
    try {
      const params = new URLSearchParams(window.location.search);
      return sanitizeRedirect(params.get('redirect') || params.get('next'), fallback || '/account/');
    } catch (e) {
      return fallback || '/account/';
    }
  }

  function buildLoginUrl(target) {
    return '/login/?redirect=' + encodeURIComponent(redirectWithLanguage(target || window.location.pathname + window.location.search));
  }

  function buildCallbackUrl(target) {
    return window.location.origin + '/auth/callback/?redirect=' + encodeURIComponent(redirectWithLanguage(target || '/account/'));
  }

  function getAuthErrorFromUrl() {
    const values = [];

    try {
      const search = new URLSearchParams(window.location.search);
      values.push(search.get('error_description'), search.get('error'));
    } catch (e) {
    }

    try {
      const hashText = window.location.hash ? window.location.hash.slice(1) : '';
      const hash = new URLSearchParams(hashText);
      values.push(hash.get('error_description'), hash.get('error'));
    } catch (e) {
    }

    return values.find(function (value) {
      return value && String(value).trim();
    }) || '';
  }

  window.InstantGeometryAuth = {
    buildCallbackUrl: buildCallbackUrl,
    buildLoginUrl: buildLoginUrl,
    getAuthErrorFromUrl: getAuthErrorFromUrl,
    getRedirectFromSearch: getRedirectFromSearch,
    redirectWithLanguage: redirectWithLanguage,
    sanitizeRedirect: sanitizeRedirect
  };
})();
