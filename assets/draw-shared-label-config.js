(function () {
  'use strict';

  function normalizeCustomLabelInput(input) {
    return String(input || '').trim();
  }

  function promptDualSetting(config) {
    const message = [
      String(config.title || 'ラベル設定'),
      '1行目: ' + String(config.firstLabel || ''),
      '2行目: ' + String(config.secondLabel || '')
    ].join('\n');
    const initialValue = String(config.firstValue == null ? '' : config.firstValue) + '\n' +
      String(config.secondValue == null ? '' : config.secondValue);
    const response = window.prompt(message, initialValue);
    if (response === null) return null;
    const lines = String(response).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const first = String(lines.shift() || '').trim();
    const second = normalizeCustomLabelInput(lines.join('\n'));
    return { first: first, second: second };
  }

  function promptSingleText(config) {
    const response = window.prompt(
      String(config.title || 'ラベル設定'),
      String(config.value == null ? '' : config.value)
    );
    if (response === null) return null;
    return normalizeCustomLabelInput(response);
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
