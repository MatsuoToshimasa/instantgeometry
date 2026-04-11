(async function () {
  'use strict';

  const baseTranslations = {
    ja: {
      'nav.home': 'トップ',
      'nav.draw': '図形を描く',
      'nav.problems': '問題を作る',
      'nav.functions': '関数を描く',
      'nav.about': 'このサイトについて',
      'nav.legal': 'プライバシーポリシー',
      'lang.label': '言語',
      'footer.tagline': '数学教育のための図形・問題・関数ツール',
      'footer.owner': '開発・運営：Toshimasa Matsuo',
      'auth.loggedInShort': 'ログイン中',
      'auth.loggedInPrefix': 'ログイン中: ',
      'auth.loggedInProviderPrefix': 'ログイン中 (',
      'auth.loggedOut': '未ログイン',
      'auth.account': 'アカウント',
      'auth.login': 'ログイン'
    },
    en: {
      'nav.home': 'Home',
      'nav.draw': 'Draw Shapes',
      'nav.problems': 'Create Problems',
      'nav.functions': 'Graph Functions',
      'nav.about': 'About',
      'nav.legal': 'Privacy Policy',
      'lang.label': 'Language',
      'footer.tagline': 'Geometry, worksheet, and function tools for math education',
      'footer.owner': 'Created by Toshimasa Matsuo',
      'auth.loggedInShort': 'Signed in',
      'auth.loggedInPrefix': 'Signed in: ',
      'auth.loggedInProviderPrefix': 'Signed in (',
      'auth.loggedOut': 'Signed out',
      'auth.account': 'Account',
      'auth.login': 'Log in'
    },
    zh: {
      'nav.home': '首页',
      'nav.draw': '绘制图形',
      'nav.problems': '生成题目',
      'nav.functions': '绘制函数',
      'nav.about': '关于本站',
      'nav.legal': '隐私政策',
      'lang.label': '语言',
      'footer.tagline': '面向数学教育的图形、题目与函数工具',
      'footer.owner': '开发与运营：Toshimasa Matsuo',
      'auth.loggedInShort': '已登录',
      'auth.loggedInPrefix': '已登录: ',
      'auth.loggedInProviderPrefix': '已登录 (',
      'auth.loggedOut': '未登录',
      'auth.account': '账户',
      'auth.login': '登录'
    },
    es: {
      'nav.home': 'Inicio',
      'nav.draw': 'Dibujar figuras',
      'nav.problems': 'Crear problemas',
      'nav.functions': 'Graficar funciones',
      'nav.about': 'Acerca del sitio',
      'nav.legal': 'Política de privacidad',
      'lang.label': 'Idioma',
      'footer.tagline': 'Herramientas de geometría, ejercicios y funciones para educación matemática',
      'footer.owner': 'Desarrollado por Toshimasa Matsuo',
      'auth.loggedInShort': 'Con sesión',
      'auth.loggedInPrefix': 'Con sesión: ',
      'auth.loggedInProviderPrefix': 'Con sesión (',
      'auth.loggedOut': 'Sin sesión',
      'auth.account': 'Cuenta',
      'auth.login': 'Iniciar sesión'
    }
  };

  function getPageTranslations() {
    return window.sitePageTranslations || {};
  }

  function getTranslationsFor(lang) {
    const pageTranslations = getPageTranslations();
    return Object.assign({}, (baseTranslations.ja || {}), (baseTranslations[lang] || {}), (pageTranslations.ja || {}), (pageTranslations[lang] || {}));
  }

  function getStoredLanguage() {
    try {
      return localStorage.getItem('site-language');
    } catch (e) {
      return null;
    }
  }

  function getUrlLanguage() {
    try {
      const url = new URL(window.location.href);
      const lang = url.searchParams.get('lang');
      return lang && baseTranslations[lang] ? lang : null;
    } catch (e) {
      return null;
    }
  }

  function getPreferredLanguage() {
    const fromUrl = getUrlLanguage();
    if (fromUrl) return fromUrl;
    const stored = getStoredLanguage();
    if (stored && baseTranslations[stored]) return stored;
    const htmlLang = document.documentElement.lang;
    if (htmlLang && baseTranslations[htmlLang]) return htmlLang;
    const navLang = (navigator.language || 'ja').slice(0, 2);
    return baseTranslations[navLang] ? navLang : 'ja';
  }

  function setStoredLanguage(lang) {
    try {
      localStorage.setItem('site-language', lang);
    } catch (e) {
    }
  }

  function buildLocalizedUrl(target, lang) {
    try {
      const url = new URL(target, window.location.href);
      if (url.origin !== window.location.origin) return url.toString();
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return url.toString();
      url.searchParams.set('lang', lang);
      return url.toString();
    } catch (e) {
      return target;
    }
  }

  function syncLanguageSelects(lang) {
    ['siteLangSelect', 'pageLangSelect'].forEach(function (id) {
      const select = document.getElementById(id);
      if (select) {
        select.value = lang;
      }
    });
  }

  function syncLocalizedLinks(lang) {
    document.querySelectorAll('a[href]').forEach(function (link) {
      const rawHref = link.getAttribute('href');
      if (!rawHref) return;
      if (rawHref.startsWith('#') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:') || rawHref.startsWith('javascript:')) return;
      link.href = buildLocalizedUrl(rawHref, lang);
    });
  }

  function translate(key, fallback) {
    const lang = document.documentElement.lang || 'ja';
    const dict = getTranslationsFor(lang);
    return dict[key] || fallback || key;
  }

  function applyTranslations() {
    const lang = document.documentElement.lang || 'ja';
    const dict = getTranslationsFor(lang);

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      const key = el.dataset.i18n;
      if (dict[key]) el.textContent = dict[key];
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      const key = el.dataset.i18nPlaceholder;
      if (dict[key]) el.setAttribute('placeholder', dict[key]);
    });

    syncLanguageSelects(lang);
    syncLocalizedLinks(lang);

    if (typeof window.updateAuthUI === 'function') {
      window.updateAuthUI();
    }
  }

  function updateCurrentUrlLanguage(lang) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('lang', lang);
      window.history.replaceState({}, '', url.toString());
    } catch (e) {
    }
  }

  function setLanguage(lang) {
    const next = baseTranslations[lang] ? lang : 'ja';
    document.documentElement.lang = next;
    setStoredLanguage(next);
    updateCurrentUrlLanguage(next);
    applyTranslations();
    document.dispatchEvent(new CustomEvent('site-language:changed', { detail: { lang: next } }));
  }

  window.siteI18n = {
    applyTranslations: applyTranslations,
    getLanguage: function () {
      return document.documentElement.lang || 'ja';
    },
    setLanguage: setLanguage,
    translate: translate
  };

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

  setLanguage(getPreferredLanguage());

  const langSelect = document.getElementById('siteLangSelect');
  if (langSelect) {
    langSelect.addEventListener('change', function () {
      setLanguage(langSelect.value);
    });
  }

  const pageLangSelect = document.getElementById('pageLangSelect');
  if (pageLangSelect) {
    pageLangSelect.addEventListener('change', function () {
      setLanguage(pageLangSelect.value);
    });
  }

  if (typeof window.updateAuthUI === 'function') {
    window.updateAuthUI();
  }

  document.dispatchEvent(new CustomEvent('site-components:ready'));
})();
