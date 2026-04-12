(function () {
  'use strict';

  let modalElements = null;
  let activeResolver = null;

  function normalizeCustomLabelInput(input) {
    return String(input || '').trim();
  }

  function ensureStyles() {
    if (document.getElementById('instantGeometrySharedLabelConfigStyles')) return;
    const style = document.createElement('style');
    style.id = 'instantGeometrySharedLabelConfigStyles';
    style.textContent = [
      '.ig-label-config-overlay{position:fixed;inset:0;background:rgba(15,23,42,0.28);display:flex;align-items:center;justify-content:center;z-index:20000;padding:24px;}',
      '.ig-label-config-overlay[hidden]{display:none;}',
      '.ig-label-config-modal{width:min(420px,calc(100vw - 32px));background:#fff;border:1px solid rgba(148,163,184,0.35);border-radius:18px;box-shadow:0 20px 48px rgba(15,23,42,0.18);padding:20px 20px 18px;color:#1f2937;font:14px/1.45 \"Hiragino Sans\",\"Yu Gothic\",sans-serif;}',
      '.ig-label-config-title{font-size:18px;font-weight:700;margin:0 0 14px;}',
      '.ig-label-config-field{display:flex;flex-direction:column;gap:6px;margin:0 0 12px;}',
      '.ig-label-config-label{font-size:13px;font-weight:600;color:#475569;}',
      '.ig-label-config-input{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:12px;padding:10px 12px;font:14px/1.4 inherit;color:#0f172a;background:#fff;outline:none;}',
      '.ig-label-config-input:focus{border-color:#2a5bd7;box-shadow:0 0 0 3px rgba(42,91,215,0.15);}',
      '.ig-label-config-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:16px;}',
      '.ig-label-config-button{appearance:none;border:1px solid #cbd5e1;border-radius:999px;background:#fff;color:#1f2937;padding:9px 16px;font:13px/1.2 inherit;font-weight:600;cursor:pointer;}',
      '.ig-label-config-button-primary{border-color:#2a5bd7;background:#2a5bd7;color:#fff;}'
    ].join('');
    document.head.appendChild(style);
  }

  function ensureModal() {
    if (modalElements) return modalElements;
    ensureStyles();

    const overlay = document.createElement('div');
    overlay.className = 'ig-label-config-overlay';
    overlay.hidden = true;

    const modal = document.createElement('div');
    modal.className = 'ig-label-config-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    const title = document.createElement('h2');
    title.className = 'ig-label-config-title';

    const firstField = document.createElement('label');
    firstField.className = 'ig-label-config-field';
    const firstLabel = document.createElement('span');
    firstLabel.className = 'ig-label-config-label';
    const firstInput = document.createElement('input');
    firstInput.className = 'ig-label-config-input';
    firstInput.type = 'text';
    firstField.appendChild(firstLabel);
    firstField.appendChild(firstInput);

    const secondField = document.createElement('label');
    secondField.className = 'ig-label-config-field';
    const secondLabel = document.createElement('span');
    secondLabel.className = 'ig-label-config-label';
    const secondInput = document.createElement('input');
    secondInput.className = 'ig-label-config-input';
    secondInput.type = 'text';
    secondField.appendChild(secondLabel);
    secondField.appendChild(secondInput);

    const actions = document.createElement('div');
    actions.className = 'ig-label-config-actions';
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'ig-label-config-button';
    cancelButton.textContent = 'キャンセル';
    const okButton = document.createElement('button');
    okButton.type = 'button';
    okButton.className = 'ig-label-config-button ig-label-config-button-primary';
    okButton.textContent = 'OK';
    actions.appendChild(cancelButton);
    actions.appendChild(okButton);

    modal.appendChild(title);
    modal.appendChild(firstField);
    modal.appendChild(secondField);
    modal.appendChild(actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    function close(result) {
      overlay.hidden = true;
      const resolver = activeResolver;
      activeResolver = null;
      if (resolver) resolver(result);
    }

    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) close(null);
    });
    cancelButton.addEventListener('click', function () {
      close(null);
    });
    okButton.addEventListener('click', function () {
      close({
        first: normalizeCustomLabelInput(firstInput.value),
        second: normalizeCustomLabelInput(secondInput.value)
      });
    });
    overlay.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(null);
        return;
      }
      if (event.key === 'Enter') {
        if (document.activeElement === cancelButton) return;
        event.preventDefault();
        okButton.click();
      }
    });

    modalElements = {
      overlay: overlay,
      title: title,
      firstField: firstField,
      firstLabel: firstLabel,
      firstInput: firstInput,
      secondField: secondField,
      secondLabel: secondLabel,
      secondInput: secondInput,
      okButton: okButton,
      cancelButton: cancelButton
    };
    return modalElements;
  }

  function openModal(config) {
    const elements = ensureModal();
    elements.title.textContent = String(config.title || 'ラベル設定');
    elements.firstLabel.textContent = String(config.firstLabel || '');
    elements.firstInput.value = String(config.firstValue == null ? '' : config.firstValue);
    elements.secondLabel.textContent = String(config.secondLabel || '');
    elements.secondInput.value = String(config.secondValue == null ? '' : config.secondValue);
    elements.secondField.hidden = !config.showSecond;
    elements.overlay.hidden = false;
    const focusTarget = config.focusSecond && config.showSecond ? elements.secondInput : elements.firstInput;
    window.requestAnimationFrame(function () {
      focusTarget.focus();
      focusTarget.select();
    });
    return new Promise(function (resolve) {
      activeResolver = resolve;
    });
  }

  async function promptDualSetting(config) {
    return openModal({
      title: config.title,
      firstLabel: config.firstLabel,
      firstValue: config.firstValue,
      secondLabel: config.secondLabel,
      secondValue: config.secondValue,
      showSecond: true,
      focusSecond: false
    });
  }

  async function promptSingleText(config) {
    const result = await openModal({
      title: config.title,
      firstLabel: '文字',
      firstValue: config.value,
      secondLabel: '',
      secondValue: '',
      showSecond: false,
      focusSecond: false
    });
    if (result === null) return null;
    return normalizeCustomLabelInput(result.first);
  }

  function formatAngleCustomText(text, angleMode) {
    const value = normalizeCustomLabelInput(text);
    if (!value) return '';
    return angleMode === 'degrees' ? (value + '°') : value;
  }

  window.InstantGeometrySharedLabelConfig = {
    normalizeCustomLabelInput: normalizeCustomLabelInput,
    promptDualSetting: promptDualSetting,
    promptSingleText: promptSingleText,
    formatAngleCustomText: formatAngleCustomText
  };
})();
