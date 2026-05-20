(function () {
  'use strict';

  const STORAGE_KEY = 'instantGeometryDrawSettings';
  const DEFAULTS = {
    distanceUnit: 'none',
    angleUnit: 'degrees',
    piMode: 'symbol',
    decimalPlaces: 2
  };
  const DISTANCE_UNITS = ['none', 'cm', 'm', 'km'];
  const ANGLE_UNITS = ['degrees', 'radians'];
  const PI_MODES = ['decimal', 'symbol'];
  const PI_APPROXIMATION = 3.14;

  let settings = readSettings();
  let observer = null;
  let pending = false;
  const customSections = [];

  function readSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return normalizeSettings(saved);
    } catch (_) {
      return Object.assign({}, DEFAULTS);
    }
  }

  function normalizeSettings(value) {
    const next = Object.assign({}, DEFAULTS, value || {});
    if (DISTANCE_UNITS.indexOf(next.distanceUnit) === -1) next.distanceUnit = DEFAULTS.distanceUnit;
    if (ANGLE_UNITS.indexOf(next.angleUnit) === -1) next.angleUnit = DEFAULTS.angleUnit;
    if (PI_MODES.indexOf(next.piMode) === -1) next.piMode = DEFAULTS.piMode;
    next.decimalPlaces = clampDecimalPlaces(next.decimalPlaces);
    return next;
  }

  function clampDecimalPlaces(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return DEFAULTS.decimalPlaces;
    return Math.max(0, Math.min(6, Math.round(parsed)));
  }

  function writeSettings(next) {
    settings = normalizeSettings(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (_) {}
    applyLabels();
    document.dispatchEvent(new CustomEvent('instant-geometry-settings:changed', { detail: getSettings() }));
  }

  function getSettings() {
    return Object.assign({}, settings);
  }

  function areaUnit() {
    if (settings.distanceUnit === 'none') return '';
    return settings.distanceUnit + '²';
  }

  function isDrawPage() {
    return /(^|\/)draw(?:\/|$)/.test(window.location.pathname);
  }

  function getLabelKind(node) {
    const kind = node.dataset && (node.dataset.kind || node.dataset.type || node.dataset.labelKind);
    if (kind) return kind;
    const attrKind = node.getAttribute && (node.getAttribute('data-kind') || node.getAttribute('data-label-kind') || node.getAttribute('data-type'));
    if (attrKind) return attrKind;
    if (node.classList) {
      if (node.classList.contains('segment-label') || node.classList.contains('measure-label')) return 'segment';
      if (node.classList.contains('angle-label')) return 'angle';
      if (node.classList.contains('arc-label')) return 'arc';
      if (node.classList.contains('area-label')) return 'area';
    }
    return '';
  }

  function hasUnit(text) {
    return /(km²|cm²|m²|km|cm|m|°|rad)$/.test(String(text || '').trim());
  }

  function withUnit(text, unit) {
    const raw = String(text || '').trim();
    if (!raw || !unit || hasUnit(raw)) return raw;
    return raw + unit;
  }

  function currentDistanceUnit() {
    return settings.distanceUnit === 'none' ? '' : settings.distanceUnit;
  }

  function distanceUnitIndex(options) {
    const list = Array.isArray(options) ? options : [];
    const unit = currentDistanceUnit();
    const index = list.indexOf(unit);
    return index >= 0 ? index : 0;
  }

  function currentAngleMode() {
    return settings.angleUnit === 'radians' ? 'radians' : 'degrees';
  }

  function formatNumber(value) {
    const digits = clampDecimalPlaces(settings.decimalPlaces);
    const factor = Math.pow(10, digits);
    const rounded = Math.round(value * factor) / factor;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '');
  }

  function formatPiRadians(degrees) {
    if (settings.piMode === 'decimal') return formatNumber(degrees * PI_APPROXIMATION / 180);
    const ratio = degrees / 180;
    for (let denominator = 1; denominator <= 24; denominator += 1) {
      const numerator = Math.round(ratio * denominator);
      if (Math.abs(ratio - numerator / denominator) > 1e-8) continue;
      if (numerator === 0) return '0';
      if (denominator === 1) return numerator === 1 ? 'π' : numerator + 'π';
      return (numerator === 1 ? 'π' : numerator + 'π') + '/' + denominator;
    }
    return formatNumber(degrees * Math.PI / 180);
  }

  function parseNumericAngle(text) {
    const raw = String(text || '').trim();
    const match = /^(-?[0-9]+(?:\.[0-9]+)?)\s*°?$/.exec(raw);
    return match ? Number(match[1]) : null;
  }

  function stripKnownUnit(text) {
    return String(text || '').trim().replace(/\s*(km²|cm²|m²|km|cm|m|°|rad)$/g, '');
  }

  function formatAngle(text) {
    const raw = String(text || '').trim();
    if (!raw) return raw;
    const degrees = parseNumericAngle(raw);
    if (degrees === null || !Number.isFinite(degrees)) return raw;
    return settings.angleUnit === 'degrees' ? formatNumber(degrees) + '°' : formatPiRadians(degrees);
  }

  function formatPiText(text) {
    const raw = String(text || '').trim();
    if (!raw || !/π/.test(raw)) return raw;
    if (settings.piMode === 'symbol') return raw;
    return raw.replace(/(?:(-?[0-9]+(?:\.[0-9]+)?)?)π(?:\/([1-9][0-9]*))?/g, function (_, coefficient, denominator) {
      const multiplier = coefficient === '' || coefficient == null ? 1 : Number(coefficient);
      const divisor = denominator ? Number(denominator) : 1;
      if (!Number.isFinite(multiplier) || !Number.isFinite(divisor) || divisor === 0) return _;
      return formatNumber(multiplier * PI_APPROXIMATION / divisor);
    });
  }

  function formatByKind(raw, kind) {
    const source = stripKnownUnit(raw);
    if (kind === 'segment' || kind === 'side' || kind === 'measure' || kind === 'arc') {
      return withUnit(formatPiText(source), settings.distanceUnit === 'none' ? '' : settings.distanceUnit);
    }
    if (kind === 'area') return withUnit(formatPiText(source), areaUnit());
    if (kind === 'angle' || kind === 'extraAngle') return formatAngle(raw);
    return formatPiText(raw);
  }

  function setNodeText(node, text) {
    if (node instanceof SVGTextElement) {
      node.textContent = text;
      return;
    }
    const kind = getLabelKind(node);
    const renderTarget = node.tagName && String(node.tagName).toLowerCase() === 'foreignobject'
      ? (node.querySelector('[xmlns="http://www.w3.org/1999/xhtml"], .draw-katex-label, .triangle-katex-label') || node.firstElementChild || node)
      : node;
    if (window.InstantGeometrySharedLabels && typeof window.InstantGeometrySharedLabels.renderKatexLabelContent === 'function') {
      renderTarget.innerHTML = '';
      if (window.InstantGeometrySharedLabels.renderKatexLabelContent(renderTarget, text, kind)) return;
    }
    if (window.InstantGeometrySharedLabels && typeof window.InstantGeometrySharedLabels.toMathLikeHtml === 'function') {
      renderTarget.innerHTML = window.InstantGeometrySharedLabels.toMathLikeHtml(text);
      return;
    }
    renderTarget.textContent = text;
  }

  function rememberRaw(node) {
    if (!node.dataset) return '';
    if (node.dataset.igRawLabel == null) {
      node.dataset.igRawLabel = String(node.textContent || '').trim();
    }
    return node.dataset.igRawLabel;
  }

  function applyLabels() {
    if (!isDrawPage() || !document.body) return;
    const nodes = document.querySelectorAll([
      'text[data-kind]',
      'text[data-label-kind]',
      'text.segment-label',
      'text.measure-label',
      'text.angle-label',
      'text.arc-label',
      'text.area-label',
      'foreignObject[data-kind]',
      'foreignObject[data-label-kind]',
      '.floating-label[data-type]',
      '.floating-label[data-kind]',
      '.floating-label[data-label-kind]'
    ].join(','));
    nodes.forEach(function (node) {
      const kind = getLabelKind(node);
      if (!kind || kind === 'point') return;
      const raw = rememberRaw(node);
      const formatted = formatByKind(raw, kind);
      if (String(node.textContent || '').trim() !== formatted) {
        setNodeText(node, formatted);
      }
    });
  }

  function scheduleApply() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      applyLabels();
    });
  }

  function ensureStyles() {
    if (document.getElementById('instantGeometryDrawSettingsStyles')) return;
    const style = document.createElement('style');
    style.id = 'instantGeometryDrawSettingsStyles';
    style.textContent = [
      '.ig-settings-btn{display:inline-grid;place-items:center;width:42px;min-width:42px;height:42px;padding:0;border:1px solid #cfd7ea;border-radius:13px;background:linear-gradient(180deg,#ffffff 0%,#f6f8ff 100%);color:#24304d;font:700 18px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer;box-shadow:0 1px 0 rgba(255,255,255,.9) inset,0 2px 8px rgba(36,71,168,.08);}',
      '.ig-settings-btn:hover{border-color:#9fb3ea;color:#1f3d94;background:linear-gradient(180deg,#ffffff 0%,#eef3ff 100%);}',
      '.ig-settings-topbar-slot{display:flex;align-items:center;gap:8px;}',
      '.ig-settings-floating-btn{position:absolute;top:6px;left:calc(50% + 86px);z-index:24;}',
      '.ig-settings-overlay{position:fixed;inset:0;z-index:30000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(15,23,42,.28);}',
      '.ig-settings-overlay[hidden]{display:none;}',
      '.ig-settings-modal{width:min(430px,calc(100vw - 32px));box-sizing:border-box;background:#fff;border:1px solid rgba(148,163,184,.35);border-radius:18px;box-shadow:0 20px 48px rgba(15,23,42,.18);padding:20px;color:#172033;font:14px/1.45 -apple-system,BlinkMacSystemFont,"Hiragino Sans","Yu Gothic",sans-serif;}',
      '.ig-settings-modal h2{margin:0 0 16px;font-size:18px;line-height:1.25;}',
      '.ig-settings-group{display:grid;gap:8px;margin:0 0 16px;}',
      '.ig-settings-label{font-weight:700;color:#334155;}',
      '.ig-settings-hint{margin:0;color:#64748b;font-size:12px;line-height:1.45;}',
      '.ig-settings-select{width:100%;min-height:40px;border:1px solid #cbd5e1;border-radius:12px;background:#fff;color:#24304d;padding:0 12px;font:700 14px/1.2 inherit;}',
      '.ig-settings-options{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;}',
      '.ig-settings-options.two{grid-template-columns:repeat(2,minmax(0,1fr));}',
      '.ig-settings-option{position:relative;}',
      '.ig-settings-option input{position:absolute;opacity:0;pointer-events:none;}',
      '.ig-settings-option span{display:flex;align-items:center;justify-content:center;min-height:38px;border:1px solid #cbd5e1;border-radius:12px;background:#fff;color:#24304d;font-weight:700;}',
      '.ig-settings-option input:checked + span{border-color:#2a5bd7;background:#eef4ff;color:#1f3d94;box-shadow:0 0 0 3px rgba(42,91,215,.12);}',
      '.ig-settings-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px;}',
      '.ig-settings-action{appearance:none;border:1px solid #cbd5e1;border-radius:999px;background:#fff;color:#1f2937;padding:9px 16px;font:700 13px/1.2 inherit;cursor:pointer;}',
      '.ig-settings-action.primary{border-color:#2a5bd7;background:#2a5bd7;color:#fff;}',
      '@media(max-width:560px){.ig-settings-btn{width:38px;min-width:38px;height:38px}.ig-settings-options{grid-template-columns:repeat(2,minmax(0,1fr));}.ig-settings-floating-btn{left:calc(50% + 78px);}}'
    ].join('');
    document.head.appendChild(style);
  }

  function createSettingsButton() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ig-settings-btn';
    button.setAttribute('aria-label', '設定');
    button.title = '設定';
    button.textContent = '⚙';
    button.addEventListener('click', openModal);
    return button;
  }

  function injectButton() {
    if (!isDrawPage() || document.querySelector('.ig-settings-btn')) return;
    ensureStyles();
    const topbarBack = document.getElementById('backBtn');
    if (topbarBack && topbarBack.parentElement) {
      const slot = document.createElement('div');
      slot.className = 'ig-settings-topbar-slot';
      topbarBack.parentElement.insertBefore(slot, topbarBack);
      slot.appendChild(topbarBack);
      slot.appendChild(createSettingsButton());
      return;
    }
    const pageBack = document.getElementById('pageBackBtn');
    if (pageBack && pageBack.parentElement) {
      const button = createSettingsButton();
      button.className += ' ig-settings-floating-btn';
      pageBack.parentElement.appendChild(button);
    }
  }

  function radio(name, value, label, checked) {
    return '<label class="ig-settings-option"><input type="radio" name="' + name + '" value="' + value + '"' + (checked ? ' checked' : '') + '><span>' + label + '</span></label>';
  }

  function ensureModal() {
    let overlay = document.getElementById('instantGeometryDrawSettingsOverlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'instantGeometryDrawSettingsOverlay';
    overlay.className = 'ig-settings-overlay';
    overlay.hidden = true;
    overlay.innerHTML =
      '<section class="ig-settings-modal" role="dialog" aria-modal="true" aria-labelledby="igSettingsTitle">' +
        '<h2 id="igSettingsTitle">設定</h2>' +
        '<div class="ig-settings-group">' +
          '<div class="ig-settings-label">距離単位</div>' +
          '<div class="ig-settings-options" data-setting="distanceUnit"></div>' +
        '</div>' +
        '<div class="ig-settings-group">' +
          '<div class="ig-settings-label">角度単位</div>' +
          '<div class="ig-settings-options two" data-setting="angleUnit"></div>' +
        '</div>' +
        '<div class="ig-settings-group">' +
          '<div class="ig-settings-label">円周率</div>' +
          '<div class="ig-settings-options two" data-setting="piMode"></div>' +
        '</div>' +
        '<div class="ig-settings-group">' +
          '<label class="ig-settings-label" for="igSettingsDecimalPlaces">小数設定</label>' +
          '<select class="ig-settings-select" id="igSettingsDecimalPlaces" data-setting="decimalPlaces"></select>' +
          '<p class="ig-settings-hint">数値（小数）を選んだラベルや、小数表示が必要な値に使う桁数です。</p>' +
        '</div>' +
        '<div data-setting="custom"></div>' +
        '<div class="ig-settings-actions">' +
          '<button class="ig-settings-action" type="button" data-action="cancel">キャンセル</button>' +
          '<button class="ig-settings-action primary" type="button" data-action="save">OK</button>' +
        '</div>' +
      '</section>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay || event.target.dataset.action === 'cancel') overlay.hidden = true;
      if (event.target.dataset.action === 'save') {
        const distance = overlay.querySelector('input[name="distanceUnit"]:checked');
        const angle = overlay.querySelector('input[name="angleUnit"]:checked');
        const pi = overlay.querySelector('input[name="piMode"]:checked');
        const decimalPlaces = overlay.querySelector('[data-setting="decimalPlaces"]');
        customSections.forEach(function (section) {
          if (section && typeof section.save === 'function') section.save(overlay);
        });
        writeSettings({
          distanceUnit: distance ? distance.value : settings.distanceUnit,
          angleUnit: angle ? angle.value : settings.angleUnit,
          piMode: pi ? pi.value : settings.piMode,
          decimalPlaces: decimalPlaces ? decimalPlaces.value : settings.decimalPlaces
        });
        overlay.hidden = true;
      }
    });
    overlay.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') overlay.hidden = true;
    });
    return overlay;
  }

  function openModal() {
    ensureStyles();
    const overlay = ensureModal();
    overlay.querySelector('[data-setting="distanceUnit"]').innerHTML = [
      radio('distanceUnit', 'none', 'なし', settings.distanceUnit === 'none'),
      radio('distanceUnit', 'cm', 'cm', settings.distanceUnit === 'cm'),
      radio('distanceUnit', 'm', 'm', settings.distanceUnit === 'm'),
      radio('distanceUnit', 'km', 'km', settings.distanceUnit === 'km')
    ].join('');
    overlay.querySelector('[data-setting="angleUnit"]').innerHTML = [
      radio('angleUnit', 'degrees', '度数法', settings.angleUnit === 'degrees'),
      radio('angleUnit', 'radians', '弧度法', settings.angleUnit === 'radians')
    ].join('');
    overlay.querySelector('[data-setting="piMode"]').innerHTML = [
      radio('piMode', 'decimal', '3.14', settings.piMode === 'decimal'),
      radio('piMode', 'symbol', 'π', settings.piMode === 'symbol')
    ].join('');
    overlay.querySelector('[data-setting="decimalPlaces"]').innerHTML = [
      ['0', '整数'],
      ['1', '小数第1位'],
      ['2', '小数第2位'],
      ['3', '小数第3位'],
      ['4', '小数第4位'],
      ['5', '小数第5位'],
      ['6', '小数第6位']
    ].map(function (entry) {
      return '<option value="' + entry[0] + '"' + (Number(entry[0]) === settings.decimalPlaces ? ' selected' : '') + '>' + entry[1] + '</option>';
    }).join('');
    const customRoot = overlay.querySelector('[data-setting="custom"]');
    customRoot.innerHTML = customSections.map(function (section) {
      return section && typeof section.render === 'function' ? section.render(settings) : '';
    }).join('');
    overlay.hidden = false;
    const checked = overlay.querySelector('input:checked');
    if (checked) checked.focus();
  }

  function init() {
    if (!isDrawPage() || !document.body) return;
    injectButton();
    applyLabels();
    if (!observer) {
      observer = new MutationObserver(scheduleApply);
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  }

  window.InstantGeometryDrawSettings = {
    get: getSettings,
    set: writeSettings,
    addSection: function (id, section) {
      if (!id || !section) return;
      for (let i = customSections.length - 1; i >= 0; i -= 1) {
        if (customSections[i].id === id) customSections.splice(i, 1);
      }
      customSections.push(Object.assign({ id: id }, section));
    },
    apply: applyLabels,
    formatNumber: formatNumber,
    formatByKind: formatByKind,
    formatAngle: formatAngle,
    formatAngleDegrees: function (degrees) { return formatAngle(formatNumber(degrees) + '°'); },
    formatLength: function (text) { return withUnit(stripKnownUnit(formatPiText(text)), currentDistanceUnit()); },
    formatArea: function (text) { return withUnit(stripKnownUnit(formatPiText(text)), areaUnit()); },
    getDistanceUnit: currentDistanceUnit,
    getDistanceUnitIndex: distanceUnitIndex,
    getAngleMode: currentAngleMode,
    getDecimalPlaces: function () { return clampDecimalPlaces(settings.decimalPlaces); },
    hasGlobalDecimalPlaces: true
  };

  document.dispatchEvent(new CustomEvent('instant-geometry-draw-settings:ready'));

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
