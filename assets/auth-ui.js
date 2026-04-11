(function () {
  'use strict';

  function getRedirectTarget() {
    const currentPath = window.location.pathname || '/';
    const currentSearch = window.location.search || '';
    return currentPath + currentSearch;
  }

  function getProviderLabel(session) {
    const provider =
      session?.user?.app_metadata?.provider ||
      session?.user?.identities?.[0]?.provider ||
      '';

    if (provider === 'google') return 'Google';
    if (provider === 'email') return 'Email';
    return provider || '不明';
  }

  function t(key, fallback) {
    if (window.siteI18n && typeof window.siteI18n.translate === 'function') {
      return window.siteI18n.translate(key, fallback);
    }
    return fallback;
  }

  function getAuthDisplayMode() {
    return document.body?.dataset?.authDisplay || 'default';
  }

  function updateAuthStatusArea(session) {
    const statusEl = document.getElementById('authStatus');
    if (!statusEl) return;

    const displayMode = getAuthDisplayMode();

    if (session) {
      const email = session.user?.email || '';
      const provider = getProviderLabel(session);
      if (displayMode === 'compact') {
        statusEl.textContent = t('auth.loggedInShort', 'ログイン中');
      } else {
        statusEl.textContent = email ? t('auth.loggedInPrefix', 'ログイン中: ') + email : t('auth.loggedInProviderPrefix', 'ログイン中 (') + provider + ')';
      }
      statusEl.dataset.authState = 'logged-in';
    } else {
      statusEl.textContent = t('auth.loggedOut', '未ログイン');
      statusEl.dataset.authState = 'logged-out';
    }
  }

  function updateLoginButtonArea(session) {
    const btn = document.getElementById('loginBtn');
    if (!btn) return;

    if (session) {
      btn.textContent = t('auth.account', 'アカウント');
      btn.href = '/account/';
    } else {
      btn.textContent = t('auth.login', 'ログイン');
      btn.href = '/login/?redirect=' + encodeURIComponent(getRedirectTarget());
    }
  }

  async function updateAuthUI() {
    if (typeof supabaseClient === 'undefined') return;

    try {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) return;

      const session = data.session || null;
      updateLoginButtonArea(session);
      updateAuthStatusArea(session);
    } catch (e) {
    }
  }

  window.updateAuthUI = updateAuthUI;

  if (typeof supabaseClient !== 'undefined' && supabaseClient.auth && supabaseClient.auth.onAuthStateChange) {
    supabaseClient.auth.onAuthStateChange(function () {
      updateAuthUI();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateAuthUI);
  } else {
    updateAuthUI();
  }
})();
