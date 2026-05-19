(function () {
  'use strict';

  var GUEST_LIMIT = 3;
  var FREE_LIMIT = 6;
  var SUPABASE_URL = 'https://cydnnjsrvictwunzlvjc.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5ZG5uanNydmljdHd1bnpsdmpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNTgwNzcsImV4cCI6MjA5MDgzNDA3N30.WQaeTyUuz_gJQj6g6kEfdXSr9RbwjIMklAX9eOJwPww';
  var supabasePromise = null;
  var indicators = [];

  function getJSTDateString() {
    var now = new Date();
    var jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return jst.toISOString().slice(0, 10);
  }

  function guestKey() {
    return 'ig_guest_save_count_' + getJSTDateString();
  }

  function getGuestCount() {
    try {
      return parseInt(localStorage.getItem(guestKey()) || '0', 10) || 0;
    } catch (error) {
      return 0;
    }
  }

  function incrementGuestCount() {
    try {
      localStorage.setItem(guestKey(), String(getGuestCount() + 1));
    } catch (error) {
    }
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src="' + src + '"]');
      if (existing && window.supabase) {
        resolve();
        return;
      }
      var script = existing || document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      if (!existing) document.head.appendChild(script);
    });
  }

  async function getSupabaseClient() {
    if (typeof supabaseClient !== 'undefined') return supabaseClient;
    if (window.InstantGeometryQuotaSupabaseClient) return window.InstantGeometryQuotaSupabaseClient;
    if (!supabasePromise) {
      supabasePromise = loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2').then(function () {
        window.InstantGeometryQuotaSupabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: {
            autoRefreshToken: true,
            detectSessionInUrl: true,
            flowType: 'pkce',
            persistSession: true
          }
        });
        return window.InstantGeometryQuotaSupabaseClient;
      });
    }
    return supabasePromise;
  }

  async function getSession() {
    try {
      var client = await getSupabaseClient();
      var result = await client.auth.getSession();
      return result && result.data ? result.data.session : null;
    } catch (error) {
      return null;
    }
  }

  async function isProUser(client, userId) {
    var result = await client
      .from('profiles')
      .select('is_pro')
      .eq('user_id', userId)
      .maybeSingle();
    if (result.error) throw result.error;
    return !!(result.data && result.data.is_pro === true);
  }

  async function getTodayCount(client, userId) {
    var result = await client
      .from('daily_downloads')
      .select('download_count')
      .eq('user_id', userId)
      .eq('date_jst', getJSTDateString())
      .maybeSingle();
    if (result.error) throw result.error;
    return result.data ? (result.data.download_count || 0) : 0;
  }

  async function incrementTodayCount(client, userId) {
    var today = getJSTDateString();
    var result = await client
      .from('daily_downloads')
      .select('id, download_count')
      .eq('user_id', userId)
      .eq('date_jst', today)
      .maybeSingle();
    if (result.error) throw result.error;

    if (!result.data) {
      var insertResult = await client
        .from('daily_downloads')
        .insert({ user_id: userId, date_jst: today, download_count: 1 });
      if (insertResult.error) throw insertResult.error;
      return 1;
    }

    var next = (result.data.download_count || 0) + 1;
    var updateResult = await client
      .from('daily_downloads')
      .update({ download_count: next })
      .eq('id', result.data.id);
    if (updateResult.error) throw updateResult.error;
    return next;
  }

  async function getQuotaState() {
    var session = await getSession();
    if (!session) {
      return { kind: 'guest', limit: GUEST_LIMIT, count: getGuestCount(), remaining: Math.max(0, GUEST_LIMIT - getGuestCount()) };
    }

    var client = await getSupabaseClient();
    if (await isProUser(client, session.user.id)) {
      return { kind: 'pro', limit: Infinity, count: 0, remaining: Infinity };
    }

    var count = await getTodayCount(client, session.user.id);
    return { kind: 'free', limit: FREE_LIMIT, count: count, remaining: Math.max(0, FREE_LIMIT - count), session: session, client: client };
  }

  function formatState(state) {
    if (!state) return '残り保存回数 --';
    if (state.kind === 'pro') return '残り保存回数 無制限';
    return '残り保存回数 ' + state.remaining + '回';
  }

  function getUpgradeUrl() {
    var url = new URL('https://www.instantgeometry.com/upgrade/');
    url.searchParams.set('lang', 'ja');
    return url.toString();
  }

  async function refreshIndicators() {
    var state = null;
    try {
      state = await getQuotaState();
    } catch (error) {
    }
    indicators.forEach(function (el) {
      el.textContent = formatState(state);
      el.setAttribute('data-quota-kind', state ? state.kind : 'unknown');
    });
  }

  function createIndicator(options) {
    var target = options && options.target;
    if (!target || !target.parentNode) return null;
    var saveSheetTitle = document.querySelector('#saveSheet .sheet-title');
    var host = saveSheetTitle || target.parentNode;

    var el = document.createElement('span');
    el.className = 'save-quota-indicator';
    el.textContent = '残り保存回数 --';
    el.setAttribute('aria-live', 'polite');
    if (saveSheetTitle) {
      el.classList.add('save-quota-in-sheet-title');
      host.appendChild(el);
    } else {
      host.insertBefore(el, target);
    }
    indicators.push(el);
    refreshIndicators();
    return el;
  }

  async function ensureCanSave() {
    var state = await getQuotaState();
    if (state.kind !== 'pro' && state.remaining <= 0) {
      window.location.href = getUpgradeUrl();
      var error = new Error('保存回数の上限に達しました。支援プラン案内ページへ移動します。');
      error.quotaExceeded = true;
      error.redirecting = true;
      throw error;
    }
    return state;
  }

  async function recordSave(state) {
    if (state && state.kind === 'pro') return;
    if (!state || state.kind === 'guest') {
      incrementGuestCount();
      await refreshIndicators();
      return;
    }
    await incrementTodayCount(state.client, state.session.user.id);
    await refreshIndicators();
  }

  async function runWithQuota(saveFn) {
    var state = await ensureCanSave();
    var result = await saveFn();
    await recordSave(state);
    return result;
  }

  function installStyles() {
    if (document.getElementById('saveQuotaStyles')) return;
    var style = document.createElement('style');
    style.id = 'saveQuotaStyles';
    style.textContent = [
      '.save-quota-indicator{display:inline-flex;align-items:center;justify-content:center;min-height:30px;padding:0 8px;border:1px solid rgba(216,221,234,.9);border-radius:12px;background:rgba(255,255,255,.82);color:#4b5568;font-size:11px;font-weight:800;line-height:1.2;white-space:nowrap;box-shadow:0 6px 16px rgba(27,39,94,.08)}',
      '.save-quota-in-sheet-title{margin-left:8px;vertical-align:middle}',
      '.button-row .save-quota-indicator,.tool-row .save-quota-indicator{margin-right:2px}',
      '@media (max-width:420px){.save-quota-in-sheet-title{font-size:10px;padding:0 6px}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  installStyles();

  window.InstantGeometrySaveQuota = {
    createIndicator: createIndicator,
    refreshIndicators: refreshIndicators,
    runWithQuota: runWithQuota
  };
})();
