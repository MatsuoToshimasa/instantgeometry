(function () {
  'use strict';

  let activeDecimalPlaces = 2;

  function clampDecimalPlaces(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 2;
    return Math.max(0, Math.min(6, Math.round(parsed)));
  }

  function setActiveDecimalPlaces(value) {
    activeDecimalPlaces = clampDecimalPlaces(value);
    return activeDecimalPlaces;
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createSvg(tag, attrs) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (attrs[key] !== null && attrs[key] !== undefined) {
        node.setAttribute(key, String(attrs[key]));
      }
    });
    return node;
  }

  function fitStageViewBox(stage) {
    const nodes = Array.from(stage.querySelectorAll('path,line,polyline,polygon,rect,circle,ellipse,text,foreignObject'));
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    function isTransparentPaint(value) {
      const text = String(value || '').trim().toLowerCase();
      return text === '' || text === 'none' || text === 'transparent' || text === 'rgba(0, 0, 0, 0)' || text === 'rgba(0,0,0,0)';
    }
    nodes.forEach(function (node) {
      if (node.classList.contains('hit-target')) return;
      const styles = window.getComputedStyle(node);
      if (styles.display === 'none' || styles.visibility === 'hidden' || styles.opacity === '0') return;
      if (node.tagName.toLowerCase() !== 'text' && isTransparentPaint(styles.fill) && isTransparentPaint(styles.stroke)) return;
      let box;
      try {
        box = node.getBBox();
      } catch (error) {
        return;
      }
      if (!Number.isFinite(box.x) || !Number.isFinite(box.y)) return;
      minX = Math.min(minX, box.x);
      minY = Math.min(minY, box.y);
      maxX = Math.max(maxX, box.x + box.width);
      maxY = Math.max(maxY, box.y + box.height);
    });
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      stage.setAttribute('viewBox', '0 0 1000 1000');
      return;
    }
    const pad = 58;
    const x = minX - pad;
    const y = minY - pad;
    const width = Math.max(1, maxX - minX + pad * 2);
    const height = Math.max(1, maxY - minY + pad * 2);
    stage.setAttribute('viewBox', [
      Math.round(x * 1000) / 1000,
      Math.round(y * 1000) / 1000,
      Math.round(width * 1000) / 1000,
      Math.round(height * 1000) / 1000
    ].join(' '));
  }

  function parseNumericExpression(value, name) {
    const source = String(value || '').trim();
    if (!source) throw new Error(name + ' には 0 より大きい数を入力してください。');
    const text = source.replace(/\s+/g, '');
    let index = 0;

    function peek() { return text[index] || ''; }
    function consume(char) {
      if (peek() === char) {
        index += 1;
        return true;
      }
      return false;
    }
    function startsFactor() {
      const char = peek();
      return char === '('
        || char === '√'
        || char === 'π'
        || /[0-9.]/.test(char)
        || text.slice(index, index + 2).toLowerCase() === 'pi'
        || text.slice(index, index + 4).toLowerCase() === 'sqrt';
    }
    function parseNumber() {
      const start = index;
      while (/[0-9.]/.test(peek())) index += 1;
      const raw = text.slice(start, index);
      if (!raw || raw === '.' || (raw.match(/\./g) || []).length > 1) throw new Error(name + ' の入力式を確認してください。');
      return Number(raw);
    }
    function parseFactor() {
      if (consume('+')) return parseFactor();
      if (consume('-')) return -parseFactor();
      if (consume('√')) return Math.sqrt(parseFactor());
      if (text.slice(index, index + 4).toLowerCase() === 'sqrt') {
        index += 4;
        return Math.sqrt(parseFactor());
      }
      if (text.slice(index, index + 2).toLowerCase() === 'pi') {
        index += 2;
        return Math.PI;
      }
      if (consume('π')) return Math.PI;
      if (consume('(')) {
        const value = parseExpression();
        if (!consume(')')) throw new Error(name + ' の入力式を確認してください。');
        return value;
      }
      return parseNumber();
    }
    function parseTerm() {
      let value = parseFactor();
      while (true) {
        if (consume('*')) value *= parseFactor();
        else if (consume('/')) value /= parseFactor();
        else if (startsFactor()) value *= parseFactor();
        else break;
      }
      return value;
    }
    function parseExpression() {
      let value = parseTerm();
      while (true) {
        if (consume('+')) value += parseTerm();
        else if (consume('-')) value -= parseTerm();
        else break;
      }
      return value;
    }

    const result = parseExpression();
    if (index !== text.length || !Number.isFinite(result)) throw new Error(name + ' の入力式を確認してください。');
    return result;
  }

  function parsePositiveNumber(value, name) {
    const parsed = parseNumericExpression(value, name);
    if (!(parsed > 0)) {
      throw new Error(name + ' には 0 より大きい数を入力してください。');
    }
    return parsed;
  }

  function parseAngleDegrees(value) {
    const angle = parseNumericExpression(value, '角度');
    if (!(angle > 0 && angle < 360)) {
      throw new Error('角度は 0° より大きく 360° 未満にしてください。');
    }
    return angle;
  }

  function parseInscribedAngleDegrees(value) {
    const text = String(value || '').trim();
    if (!/^[0-9]+$/.test(text)) {
      throw new Error('円周角には整数を入力してください。');
    }
    const angle = Number(text);
    if (!(angle >= 0 && angle <= 180)) {
      throw new Error('円周角は 0° 以上 180° 以下の整数にしてください。');
    }
    return angle;
  }

  function formatNumber(value) {
    const digits = activeDecimalPlaces;
    const factor = Math.pow(10, digits);
    const rounded = Math.round(value * factor) / factor;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '');
  }

  function stripOuterParens(value) {
    let text = String(value || '').trim();
    while (text[0] === '(' && text[text.length - 1] === ')') {
      let depth = 0;
      let wraps = true;
      for (let i = 0; i < text.length; i += 1) {
        if (text[i] === '(') depth += 1;
        else if (text[i] === ')') depth -= 1;
        if (depth === 0 && i < text.length - 1) {
          wraps = false;
          break;
        }
      }
      if (!wraps) break;
      text = text.slice(1, -1).trim();
    }
    return text;
  }

  function findTopLevelSlash(value) {
    const text = String(value || '');
    let depth = 0;
    for (let i = 0; i < text.length; i += 1) {
      if (text[i] === '(') depth += 1;
      else if (text[i] === ')') depth = Math.max(0, depth - 1);
      else if (text[i] === '/' && depth === 0) return i;
    }
    return -1;
  }

  function escapeLatexText(text) {
    return String(text || '').replace(/([\\{}_$&#%])/g, '\\$1');
  }

  function hasMathSyntax(text) {
    return /[\/√π°*_^()]|sqrt|pi|acos|arccos/i.test(String(text || ''));
  }

  function labelTextToLatex(text, kind) {
    const raw = String(text || '').trim().replace(/\s+/g, '');
    if ((kind === 'point' || kind === 'area' || kind === 'extraArea') && !hasMathSyntax(raw) && /[^0-9.]/.test(raw)) {
      return '\\text{' + escapeLatexText(raw) + '}';
    }
    const suffixMatch = raw.match(/^(.*?)(°|cm²|m²|km²|cm|m|km)$/);
    const core = suffixMatch ? suffixMatch[1] : raw;
    const suffix = suffixMatch ? suffixMatch[2] : '';

    function convert(input) {
      let value = stripOuterParens(String(input || '').trim());
      const slash = findTopLevelSlash(value);
      if (slash > 0 && slash < value.length - 1) {
        return '\\frac{' + convert(value.slice(0, slash)) + '}{' + convert(value.slice(slash + 1)) + '}';
      }
      value = value
        .replace(/arccos\(([^()]+)\)/ig, function (_, argument) {
          return '\\arccos\\left(' + convert(argument) + '\\right)';
        })
        .replace(/acos\(([^()]+)\)/ig, function (_, argument) {
          return '\\arccos\\left(' + convert(argument) + '\\right)';
        })
        .replace(/pi/ig, 'π')
        .replace(/sqrt\(([^()]+)\)/ig, '√($1)')
        .replace(/√\(([^()]+)\)/g, function (_, radicand) {
          return '\\sqrt{' + convert(radicand) + '}';
        })
        .replace(/(\d*)√([0-9A-Za-zπ]+)/g, function (_, coefficient, radicand) {
          return (coefficient || '') + '\\sqrt{' + convert(radicand) + '}';
        })
        .replace(/π/g, '\\pi')
        .replace(/\*/g, '\\cdot ');
      return value;
    }

    let latex = convert(core);
    if (suffix === '°') latex += '^{\\circ}';
    else if (suffix) latex += '\\,\\mathrm{' + suffix.replace('²', '^2') + '}';
    return latex;
  }

  function measureKatexLabel(latex, fontSize, color) {
    const measure = document.createElement('div');
    measure.className = 'triangle-katex-label triangle-katex-measure';
    measure.style.fontSize = fontSize + 'px';
    measure.style.color = color;
    try {
      window.katex.render(latex, measure, {
        throwOnError: false,
        output: 'html',
        strict: 'ignore'
      });
    } catch (_) {
      return null;
    }
    document.body.appendChild(measure);
    const rect = measure.getBoundingClientRect();
    measure.remove();
    if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0) return null;
    return {
      width: Math.ceil(rect.width) + Math.ceil(fontSize * 0.28),
      height: Math.ceil(rect.height) + Math.ceil(fontSize * 0.20)
    };
  }

  function gcd(a, b) {
    let x = Math.abs(Math.round(a));
    let y = Math.abs(Math.round(b));
    while (y) {
      const t = y;
      y = x % y;
      x = t;
    }
    return x || 1;
  }

  function formatSimplifiedRoot(radicand) {
    if (!Number.isFinite(radicand) || radicand < 0) return null;
    const rounded = Math.round(radicand);
    if (Math.abs(radicand - rounded) > 1e-10) return null;
    if (rounded === 0) return '0';
    const root = Math.sqrt(rounded);
    if (Number.isInteger(root)) return String(root);
    let outside = 1;
    let inside = rounded;
    for (let factor = Math.floor(Math.sqrt(inside)); factor >= 2; factor -= 1) {
      const square = factor * factor;
      if (inside % square === 0) {
        outside *= factor;
        inside /= square;
        factor = Math.floor(Math.sqrt(inside)) + 1;
      }
    }
    return (outside === 1 ? '' : String(outside)) + '√' + inside;
  }

  function formatPythagoreanHypotenuse(legA, legB) {
    const roundedA = Math.round(legA * 1000000) / 1000000;
    const roundedB = Math.round(legB * 1000000) / 1000000;
    if (Number.isInteger(roundedA) && Number.isInteger(roundedB)) {
      return formatSimplifiedRoot(roundedA * roundedA + roundedB * roundedB);
    }
    return formatNumber(Math.hypot(legA, legB));
  }

  function componentToHex(value) {
    return Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0');
  }

  function hslToHex(h, s, l) {
    const hue = ((h % 360) + 360) % 360;
    const sat = Math.max(0, Math.min(100, s)) / 100;
    const light = Math.max(0, Math.min(100, l)) / 100;
    const chroma = (1 - Math.abs(2 * light - 1)) * sat;
    const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
    const m = light - chroma / 2;
    let r = 0;
    let g = 0;
    let b = 0;
    if (hue < 60) { r = chroma; g = x; }
    else if (hue < 120) { r = x; g = chroma; }
    else if (hue < 180) { g = chroma; b = x; }
    else if (hue < 240) { g = x; b = chroma; }
    else if (hue < 300) { r = x; b = chroma; }
    else { r = chroma; b = x; }
    return '#' + componentToHex((r + m) * 255) + componentToHex((g + m) * 255) + componentToHex((b + m) * 255);
  }

  function hexToHsl(hex) {
    const text = String(hex || '').trim();
    const match = /^#?([0-9a-f]{6})$/i.exec(text);
    if (!match) return { h: 137, s: 44, l: 26 };
    const raw = match[1];
    const r = parseInt(raw.slice(0, 2), 16) / 255;
    const g = parseInt(raw.slice(2, 4), 16) / 255;
    const b = parseInt(raw.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    let h = 0;
    if (delta) {
      if (max === r) h = 60 * (((g - b) / delta) % 6);
      else if (max === g) h = 60 * ((b - r) / delta + 2);
      else h = 60 * ((r - g) / delta + 4);
    }
    const l = (max + min) / 2;
    const s = delta ? delta / (1 - Math.abs(2 * l - 1)) : 0;
    return { h: (h + 360) % 360, s: s * 100, l: l * 100 };
  }

  function hexToRgba(hex, alpha) {
    const text = String(hex || '').trim();
    const match = /^#?([0-9a-f]{6})$/i.exec(text);
    if (!match) return 'rgba(42,91,215,' + alpha + ')';
    const raw = match[1];
    return 'rgba(' + parseInt(raw.slice(0, 2), 16) + ',' + parseInt(raw.slice(2, 4), 16) + ',' + parseInt(raw.slice(4, 6), 16) + ',' + alpha + ')';
  }

  function areaLabelColor(hex) {
    const hsl = hexToHsl(hex || '#2a5bd7');
    if (hsl.s < 8) return hsl.l > 50 ? '#4b5563' : '#111827';
    return hslToHex(hsl.h, Math.max(42, hsl.s), 26);
  }

  function formatAngle(value) {
    return formatNumber(value) + '°';
  }

  function textForLabel(input, geometryValue, formatter, exactLabel, rawLabel) {
    const text = String(input || '');
    if (!text) return '';
    if (isRatioLabelValue(text)) return text;
    if (isRawNumericLabelValue(text) && rawLabel) return rawLabel;
    if (isDecimalNumericLabelValue(text)) return (formatter || formatNumber)(geometryValue);
    if (isNumericLabelValue(text)) return exactLabel || (formatter || formatNumber)(geometryValue);
    if (isRawNumericLabelValue(text)) return exactLabel || (formatter || formatNumber)(geometryValue);
    return text;
  }

  function buildTextInput(labelText, value, options) {
    const field = document.createElement('div');
    field.className = 'sheet-field';
    const label = document.createElement('label');
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = options && options.inputMode ? options.inputMode : 'text';
    input.value = value || '';
    if (options && options.readonly) input.setAttribute('readonly', 'readonly');
    field.appendChild(label);
    field.appendChild(input);
    return { field: field, input: input };
  }

  function buildSelect(labelText, value, options) {
    if (window.InstantGeometryDrawLabelEngine && typeof window.InstantGeometryDrawLabelEngine.buildSelect === 'function') {
      return window.InstantGeometryDrawLabelEngine.buildSelect(labelText, value, options);
    }
    const field = document.createElement('div');
    field.className = 'sheet-field';
    const label = document.createElement('label');
    label.textContent = labelText;
    const select = document.createElement('select');
    options.forEach(function (option) {
      const node = document.createElement('option');
      node.value = option.value;
      node.textContent = option.label;
      if (option.value === value) node.selected = true;
      select.appendChild(node);
    });
    field.appendChild(label);
    field.appendChild(select);
    return { field: field, select: select };
  }

  function buildDecimalPlacesSelect(value) {
    return buildSelect('小数表示', String(clampDecimalPlaces(value)), [
      { value: '0', label: '整数' },
      { value: '1', label: '小数第1位' },
      { value: '2', label: '小数第2位' },
      { value: '3', label: '小数第3位' },
      { value: '4', label: '小数第4位' },
      { value: '5', label: '小数第5位' },
      { value: '6', label: '小数第6位' }
    ]);
  }

  function buildRangeField(labelText, value, min, max, step, formatValue) {
    if (window.InstantGeometryDrawLabelEngine && typeof window.InstantGeometryDrawLabelEngine.buildRangeField === 'function') {
      return window.InstantGeometryDrawLabelEngine.buildRangeField(labelText, value, min, max, step, formatValue);
    }
    const field = document.createElement('div');
    field.className = 'sheet-field range-field';
    const label = document.createElement('label');
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    const output = document.createElement('output');
    function sync() {
      output.textContent = formatValue ? formatValue(input.value) : input.value;
    }
    input.addEventListener('input', sync);
    field.appendChild(label);
    field.appendChild(input);
    field.appendChild(output);
    sync();
    return { field: field, input: input };
  }

  function buildCheckbox(labelText, checked) {
    if (window.InstantGeometryDrawLabelEngine && typeof window.InstantGeometryDrawLabelEngine.buildCheckbox === 'function') {
      return window.InstantGeometryDrawLabelEngine.buildCheckbox(labelText, checked);
    }
    const field = document.createElement('label');
    field.className = 'sheet-field checkbox-field';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!checked;
    const span = document.createElement('span');
    span.textContent = labelText;
    field.appendChild(input);
    field.appendChild(span);
    return { field: field, input: input };
  }

  function normalizeFreeLabel(value) {
    return String(value || '');
  }

  function isNumericLabelValue(value) {
    return value === ' ' || value === '0';
  }

  const RATIO_LABEL_PREFIX = 'ratio:';
  const RAW_NUMERIC_LABEL_VALUE = 'raw:';
  const DECIMAL_NUMERIC_LABEL_VALUE = 'decimal:';
  const RATIO_LABEL_HINT = '比の値は「マーク,数値」の形式で入力します。例: s,5 / t,4.4 / r,5/3\ns: 四角で囲む\nt: 三角で囲む\nr: 丸で囲む';

  function isRawNumericLabelValue(value) {
    return value === RAW_NUMERIC_LABEL_VALUE;
  }

  function isDecimalNumericLabelValue(value) {
    return value === DECIMAL_NUMERIC_LABEL_VALUE;
  }

  function parseRatioLabelInput(value) {
    const text = String(value || '').trim();
    const parts = text.split(',');
    if (parts.length !== 2) return null;
    const mark = parts[0].trim().toLowerCase();
    const number = parts[1].trim();
    const decimalPattern = /^(?:[1-9][0-9]*(?:\.[0-9]+)?|0\.[0-9]*[1-9][0-9]*)$/;
    const fractionPattern = /^[1-9][0-9]*\/[1-9][0-9]*$/;
    if (!/^[rts]$/.test(mark)) return null;
    if (!decimalPattern.test(number) && !fractionPattern.test(number)) return null;
    return { mark: mark, value: number, source: mark + ',' + number };
  }

  function isRatioLabelValue(value) {
    return String(value || '').indexOf(RATIO_LABEL_PREFIX) === 0 && Boolean(parseRatioLabelInput(String(value).slice(RATIO_LABEL_PREFIX.length)));
  }

  function getRatioLabelInput(value) {
    return isRatioLabelValue(value) ? String(value).slice(RATIO_LABEL_PREFIX.length) : '';
  }

  function getDisplayMode(value, hasNumericMode) {
    if (value === '') return 'hidden';
    if (hasNumericMode && isRatioLabelValue(value)) return 'ratio';
    if (hasNumericMode && isRawNumericLabelValue(value)) return 'numeric';
    if (hasNumericMode && isDecimalNumericLabelValue(value)) return 'numericDecimal';
    if (hasNumericMode && isNumericLabelValue(value)) return 'numeric';
    return 'text';
  }

  function buildLabelEditor(labelText, value, hasNumericMode) {
    if (window.InstantGeometryDrawLabelEngine && typeof window.InstantGeometryDrawLabelEngine.buildLabelEditor === 'function') {
      return window.InstantGeometryDrawLabelEngine.buildLabelEditor(labelText, value, hasNumericMode);
    }
    const field = document.createElement('div');
    field.className = 'sheet-field';
    const label = document.createElement('label');
    label.textContent = labelText;
    const mode = document.createElement('select');
    [
      { value: 'hidden', label: '非表示' },
      hasNumericMode ? { value: 'numeric', label: '数値（自動）' } : null,
      hasNumericMode ? { value: 'ratio', label: '比の値' } : null,
      { value: 'text', label: '自由入力' }
    ].filter(Boolean).forEach(function (option) {
      const node = document.createElement('option');
      node.value = option.value;
      node.textContent = option.label;
      if (option.value === getDisplayMode(value, hasNumericMode)) node.selected = true;
      mode.appendChild(node);
    });
    const input = document.createElement('input');
    input.type = 'text';
    input.value = getDisplayMode(value, hasNumericMode) === 'text'
      ? normalizeFreeLabel(value)
      : getRatioLabelInput(value);
    input.setAttribute('inputmode', 'text');
    input.autocapitalize = 'none';
    input.autocomplete = 'off';
    input.spellcheck = false;
    function sync() {
      const isEditable = mode.value === 'text' || mode.value === 'ratio';
      input.disabled = !isEditable;
      input.placeholder = mode.value === 'ratio' ? '例: s,5 / t,4.4 / r,5/3' : '';
    }
    mode.addEventListener('change', sync);
    field.appendChild(label);
    field.appendChild(mode);
    field.appendChild(input);
    sync();
    return { field: field, mode: mode, input: input };
  }

  function buildColorPalette(labelText, value) {
    if (window.InstantGeometryDrawLabelEngine && typeof window.InstantGeometryDrawLabelEngine.buildColorPalette === 'function') {
      return window.InstantGeometryDrawLabelEngine.buildColorPalette(labelText, value);
    }
    const field = document.createElement('div');
    field.className = 'sheet-field';
    const label = document.createElement('label');
    label.textContent = labelText;
    const picker = document.createElement('div');
    picker.className = 'color-swatch-picker';
    const colors = [
      ['白', '#ffffff'],
      ['赤', '#e53935'],
      ['青', '#2a5bd7'],
      ['緑', '#2e7d32'],
      ['黄', '#f2c94c'],
      ['紫', '#8e44ad'],
      ['桃', '#ff66a3'],
      ['茶', '#8b5a2b'],
      ['灰', '#8a94a6'],
      ['黒', '#111827']
    ];
    let selected = value || '#2a5bd7';
    colors.forEach(function (entry) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'color-swatch';
      button.dataset.color = entry[1];
      button.style.background = entry[1];
      button.textContent = entry[0];
      button.setAttribute('aria-label', entry[0]);
      button.classList.toggle('is-selected', selected.toLowerCase() === entry[1].toLowerCase());
      button.addEventListener('click', function () {
        selected = entry[1];
        Array.from(picker.children).forEach(function (child) {
          child.classList.toggle('is-selected', child.dataset.color.toLowerCase() === selected.toLowerCase());
        });
      });
      picker.appendChild(button);
    });
    field.appendChild(label);
    field.appendChild(picker);
    return {
      field: field,
      get value() {
        return selected;
      }
    };
  }

  function fitGeometry(rx, ry) {
    const width = 1000;
    const height = 1000;
    const paddingX = 140;
    const paddingTop = 190;
    const paddingBottom = 130;
    const scale = Math.min((width - paddingX * 2) / (rx * 2), (height - paddingTop - paddingBottom) / (ry * 2));
    return {
      cx: width / 2,
      cy: paddingTop + (height - paddingTop - paddingBottom) / 2,
      scale: scale
    };
  }

  function pointOnEllipse(layout, rx, ry, theta) {
    return {
      x: layout.cx + rx * Math.cos(theta) * layout.scale,
      y: layout.cy - ry * Math.sin(theta) * layout.scale
    };
  }

  function linePath(points) {
    return points.map(function (p, index) {
      return (index === 0 ? 'M ' : 'L ') + p.x + ' ' + p.y;
    }).join(' ');
  }

  function dropFirst(list) {
    return list.slice(1);
  }

  function sectorPath(layout, rx, ry, theta) {
    const count = Math.max(18, Math.ceil(theta / (Math.PI * 2) * 96));
    const points = [{ x: layout.cx, y: layout.cy }, pointOnEllipse(layout, rx, ry, 0)];
    for (let i = 1; i <= count; i += 1) {
      points.push(pointOnEllipse(layout, rx, ry, theta * (i / count)));
    }
    return linePath(points) + ' Z';
  }

  function ellipseArcPoints(layout, rx, ry, theta) {
    const count = Math.max(18, Math.ceil(theta / (Math.PI * 2) * 96));
    const points = [];
    for (let i = 0; i <= count; i += 1) {
      points.push(pointOnEllipse(layout, rx, ry, theta * (i / count)));
    }
    return points;
  }

  function arcPath(layout, rx, ry, theta) {
    return linePath(ellipseArcPoints(layout, rx, ry, theta));
  }

  function ellipseArcLength(rx, ry, theta) {
    const count = Math.max(48, Math.ceil(Math.abs(theta) / (Math.PI * 2) * 240));
    let length = 0;
    let previous = { x: rx, y: 0 };
    for (let i = 1; i <= count; i += 1) {
      const angle = theta * (i / count);
      const point = { x: rx * Math.cos(angle), y: ry * Math.sin(angle) };
      length += Math.hypot(point.x - previous.x, point.y - previous.y);
      previous = point;
    }
    return length;
  }

  function circleArcPath(cx, cy, radius, startAngle, sweepAngle) {
    return linePath(circleArcPoints(cx, cy, radius, startAngle, sweepAngle));
  }

  function circleArcPoints(cx, cy, radius, startAngle, sweepAngle) {
    const count = Math.max(18, Math.ceil(Math.abs(sweepAngle) / (Math.PI * 2) * 120));
    const points = [];
    for (let i = 0; i <= count; i += 1) {
      const angle = startAngle + sweepAngle * (i / count);
      points.push({
        x: cx + radius * Math.cos(angle),
        y: cy - radius * Math.sin(angle)
      });
    }
    return points;
  }

  function screenCircleAngle(center, point) {
    return Math.atan2(center.y - point.y, point.x - center.x);
  }

  function semicircleArcThroughSide(P, Q, sidePoint) {
    const center = midpoint(P, Q);
    const radius = Math.hypot(Q.x - P.x, Q.y - P.y) / 2;
    const start = screenCircleAngle(center, P);
    function midFor(sweep) {
      const angle = start + sweep / 2;
      return {
        x: center.x + radius * Math.cos(angle),
        y: center.y - radius * Math.sin(angle)
      };
    }
    const positiveMid = midFor(Math.PI);
    const negativeMid = midFor(-Math.PI);
    const positiveDistance = Math.hypot(positiveMid.x - sidePoint.x, positiveMid.y - sidePoint.y);
    const negativeDistance = Math.hypot(negativeMid.x - sidePoint.x, negativeMid.y - sidePoint.y);
    const sweep = positiveDistance <= negativeDistance ? Math.PI : -Math.PI;
    return circleArcPoints(center.x, center.y, radius, start, sweep);
  }

  function splitArcAtPoint(points, point) {
    let bestIndex = 0;
    let bestDistance = Infinity;
    points.forEach(function (p, index) {
      const distance = Math.hypot(p.x - point.x, p.y - point.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    return {
      before: points.slice(0, bestIndex + 1),
      after: points.slice(bestIndex)
    };
  }

  function circleArcBetweenPoints(center, radius, start, end) {
    const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
    const endAngle = Math.atan2(end.y - center.y, end.x - center.x);
    let sweep = endAngle - startAngle;
    while (sweep <= -Math.PI) sweep += Math.PI * 2;
    while (sweep > Math.PI) sweep -= Math.PI * 2;
    const count = Math.max(18, Math.ceil(Math.abs(sweep) / (Math.PI * 2) * 120));
    const points = [];
    for (let i = 0; i <= count; i += 1) {
      const angle = startAngle + sweep * (i / count);
      points.push({
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle)
      });
    }
    return points;
  }

  function semicircleArcPoints(P, Q, sidePoint) {
    const cx = (P.x + Q.x) / 2;
    const cy = (P.y + Q.y) / 2;
    const radius = Math.hypot(Q.x - P.x, Q.y - P.y) / 2;
    const start = Math.atan2(cy - P.y, P.x - cx);
    function midpointFor(sweep) {
      const angle = start + sweep / 2;
      return {
        x: cx + radius * Math.cos(angle),
        y: cy - radius * Math.sin(angle)
      };
    }
    const positiveMid = midpointFor(Math.PI);
    const negativeMid = midpointFor(-Math.PI);
    const positiveDistance = Math.hypot(positiveMid.x - sidePoint.x, positiveMid.y - sidePoint.y);
    const negativeDistance = Math.hypot(negativeMid.x - sidePoint.x, negativeMid.y - sidePoint.y);
    return circleArcPoints(cx, cy, radius, start, positiveDistance <= negativeDistance ? Math.PI : -Math.PI);
  }

  function reflectPointAcrossLine(point, lineStart, lineEnd) {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lengthSquared = dx * dx + dy * dy || 1;
    const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSquared;
    const foot = {
      x: lineStart.x + dx * t,
      y: lineStart.y + dy * t
    };
    return {
      x: foot.x * 2 - point.x,
      y: foot.y * 2 - point.y
    };
  }

  function angleArcPath(vertex, first, second, radius) {
    return linePath(angleArcPoints(vertex, first, second, radius));
  }

  function angleArcPoints(vertex, first, second, radius) {
    const a1 = Math.atan2(first.y - vertex.y, first.x - vertex.x);
    const a2 = Math.atan2(second.y - vertex.y, second.x - vertex.x);
    let delta = a2 - a1;
    while (delta <= -Math.PI) delta += Math.PI * 2;
    while (delta > Math.PI) delta -= Math.PI * 2;
    const count = Math.max(16, Math.ceil(Math.abs(delta) / Math.PI * 40));
    const points = [];
    for (let i = 0; i <= count; i += 1) {
      const angle = a1 + delta * (i / count);
      points.push({
        x: vertex.x + radius * Math.cos(angle),
        y: vertex.y + radius * Math.sin(angle)
      });
    }
    return points;
  }

  function angleValue(first, vertex, second) {
    const v1 = { x: first.x - vertex.x, y: first.y - vertex.y };
    const v2 = { x: second.x - vertex.x, y: second.y - vertex.y };
    const len1 = Math.hypot(v1.x, v1.y) || 1;
    const len2 = Math.hypot(v2.x, v2.y) || 1;
    const dot = Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / (len1 * len2)));
    return Math.acos(dot) * 180 / Math.PI;
  }

  function angleLabelPoint(vertex, first, second, distance) {
    const v1 = { x: first.x - vertex.x, y: first.y - vertex.y };
    const v2 = { x: second.x - vertex.x, y: second.y - vertex.y };
    const len1 = Math.hypot(v1.x, v1.y) || 1;
    const len2 = Math.hypot(v2.x, v2.y) || 1;
    let x = v1.x / len1 + v2.x / len2;
    let y = v1.y / len1 + v2.y / len2;
    const len = Math.hypot(x, y) || 1;
    return { x: vertex.x + x / len * distance, y: vertex.y + y / len * distance };
  }

  function midpoint(P, Q) {
    return { x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 };
  }

  function lineIntersection(P1, P2, Q1, Q2) {
    const a1 = P2.y - P1.y;
    const b1 = P1.x - P2.x;
    const c1 = a1 * P1.x + b1 * P1.y;
    const a2 = Q2.y - Q1.y;
    const b2 = Q1.x - Q2.x;
    const c2 = a2 * Q1.x + b2 * Q1.y;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1e-9) return midpoint(P1, Q1);
    return {
      x: (b2 * c1 - b1 * c2) / det,
      y: (a1 * c2 - a2 * c1) / det
    };
  }

  function rayCircleIntersectionsFromLeft(distance, halfAngle) {
    const cos = Math.cos(halfAngle);
    const sin = Math.sin(halfAngle);
    const b = -2 * distance * cos;
    const c = distance * distance - 1;
    const discriminant = Math.max(0, b * b - 4 * c);
    const near = (-b - Math.sqrt(discriminant)) / 2;
    const far = (-b + Math.sqrt(discriminant)) / 2;
    return {
      near: { x: -distance + near * cos, y: near * sin },
      far: { x: -distance + far * cos, y: far * sin }
    };
  }

  function secantApplicationBed(distance, halfAngle) {
    const upper = rayCircleIntersectionsFromLeft(distance, halfAngle);
    const lower = rayCircleIntersectionsFromLeft(distance, -halfAngle);
    const E = lineIntersection(upper.near, lower.far, upper.far, lower.near);
    return angleValue(upper.far, E, lower.far);
  }

  function solveSecantDistance(angleApc, angleBed) {
    const halfAngle = angleApc * Math.PI / 360;
    const maxDistance = 1 / Math.sin(halfAngle);
    let low = 1 + 1e-9;
    let high = maxDistance * (1 - 1e-9);
    for (let i = 0; i < 56; i += 1) {
      const mid = (low + high) / 2;
      if (secantApplicationBed(mid, halfAngle) < angleBed) low = mid;
      else high = mid;
    }
    return (low + high) / 2;
  }

  function sideArcGeometry(P, Q, center, labelPoint) {
    const mid = midpoint(P, Q);
    const dx = Q.x - P.x;
    const dy = Q.y - P.y;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    const toCenterX = center.x - mid.x;
    const toCenterY = center.y - mid.y;
    if (nx * toCenterX + ny * toCenterY > 0) {
      nx *= -1;
      ny *= -1;
    }
    const defaultCenter = { x: mid.x + nx * Math.max(26, len * 0.12), y: mid.y + ny * Math.max(26, len * 0.12) };
    const desired = labelPoint || defaultCenter;
    return { control: { x: desired.x * 2 - mid.x, y: desired.y * 2 - mid.y }, gapHalf: 0.14 };
  }

  function quadraticPoint(P, control, Q, t) {
    return {
      x: (1 - t) * (1 - t) * P.x + 2 * (1 - t) * t * control.x + t * t * Q.x,
      y: (1 - t) * (1 - t) * P.y + 2 * (1 - t) * t * control.y + t * t * Q.y
    };
  }

  function quadraticPathSegment(P, control, Q, start, end, steps) {
    const points = [];
    const count = steps || 24;
    for (let i = 0; i <= count; i += 1) {
      const t = start + (end - start) * (i / count);
      points.push(quadraticPoint(P, control, Q, t));
    }
    return linePath(points);
  }

  function drawSideKind(stage, kind, P, Q) {
    if (!kind || kind === 'plain') return;
    if (window.InstantGeometryMobileAngleOrnaments && window.InstantGeometryMobileAngleOrnaments.drawSegmentKind(stage, kind, P, Q, createSvg)) return;
    const mid = midpoint(P, Q);
    const dx = Q.x - P.x;
    const dy = Q.y - P.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const tx = dx / len;
    const ty = dy / len;
    const stroke = '#2a5bd7';
    const addLine = function (cx, cy, half) {
      stage.appendChild(createSvg('line', {
        x1: cx - nx * half,
        y1: cy - ny * half,
        x2: cx + nx * half,
        y2: cy + ny * half,
        stroke: stroke,
        'stroke-width': 3,
        'stroke-linecap': 'round'
      }));
    };
    if (kind === 'circle') {
      stage.appendChild(createSvg('circle', { cx: mid.x, cy: mid.y, r: 8, fill: 'none', stroke: stroke, 'stroke-width': 3 }));
    } else if (kind === 'single') {
      addLine(mid.x, mid.y, 12);
    } else if (kind === 'double') {
      addLine(mid.x - tx * 9, mid.y - ty * 9, 12);
      addLine(mid.x + tx * 9, mid.y + ty * 9, 12);
    } else if (kind === 'cross') {
      addLine(mid.x, mid.y, 12);
      stage.appendChild(createSvg('line', {
        x1: mid.x - tx * 9,
        y1: mid.y - ty * 9,
        x2: mid.x + tx * 9,
        y2: mid.y + ty * 9,
        stroke: stroke,
        'stroke-width': 3,
        'stroke-linecap': 'round'
      }));
    } else if (kind === 'triangle') {
      const p1 = { x: mid.x + tx * 12, y: mid.y + ty * 12 };
      const p2 = { x: mid.x - tx * 8 + nx * 7, y: mid.y - ty * 8 + ny * 7 };
      const p3 = { x: mid.x - tx * 8 - nx * 7, y: mid.y - ty * 8 - ny * 7 };
      stage.appendChild(createSvg('polygon', {
        points: [p1, p2, p3].map(function (p) { return p.x + ',' + p.y; }).join(' '),
        fill: stroke,
        stroke: stroke,
        'stroke-width': 1.5
      }));
    }
  }

  function drawCurveKind(stage, kind, points) {
    if (!kind || kind === 'plain' || !points || points.length < 2) return;
    const midIndex = Math.floor(points.length / 2);
    const mid = points[midIndex];
    const before = points[Math.max(0, midIndex - 1)];
    const after = points[Math.min(points.length - 1, midIndex + 1)];
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const len = Math.hypot(dx, dy) || 1;
    const tx = dx / len;
    const ty = dy / len;
    const nx = -ty;
    const ny = tx;
    const stroke = '#2a5bd7';
    const addNormalLine = function (cx, cy, half) {
      stage.appendChild(createSvg('line', {
        x1: cx - nx * half,
        y1: cy - ny * half,
        x2: cx + nx * half,
        y2: cy + ny * half,
        stroke: stroke,
        'stroke-width': 3,
        'stroke-linecap': 'round'
      }));
    };
    if (kind === 'circle') {
      stage.appendChild(createSvg('circle', { cx: mid.x, cy: mid.y, r: 8, fill: 'none', stroke: stroke, 'stroke-width': 3 }));
    } else if (kind === 'single') {
      addNormalLine(mid.x, mid.y, 12);
    } else if (kind === 'double') {
      addNormalLine(mid.x - tx * 9, mid.y - ty * 9, 12);
      addNormalLine(mid.x + tx * 9, mid.y + ty * 9, 12);
    } else if (kind === 'cross') {
      addNormalLine(mid.x, mid.y, 12);
      stage.appendChild(createSvg('line', {
        x1: mid.x - tx * 9,
        y1: mid.y - ty * 9,
        x2: mid.x + tx * 9,
        y2: mid.y + ty * 9,
        stroke: stroke,
        'stroke-width': 3,
        'stroke-linecap': 'round'
      }));
    } else if (kind === 'triangle') {
      const p1 = { x: mid.x + tx * 12, y: mid.y + ty * 12 };
      const p2 = { x: mid.x - tx * 8 + nx * 7, y: mid.y - ty * 8 + ny * 7 };
      const p3 = { x: mid.x - tx * 8 - nx * 7, y: mid.y - ty * 8 - ny * 7 };
      stage.appendChild(createSvg('polygon', {
        points: [p1, p2, p3].map(function (p) { return p.x + ',' + p.y; }).join(' '),
        fill: stroke,
        stroke: stroke,
        'stroke-width': 1.5
      }));
    }
  }

  function downloadBlob(blob, filename) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  }

  function createPage(config) {
    const stage = document.getElementById('stage');
    const captureRoot = document.getElementById('captureRoot');
    const statusBox = document.getElementById('statusBox');
    const backBtn = document.getElementById('backBtn');
    const saveBtn = document.getElementById('saveBtn');
    const sheetBackdrop = document.getElementById('sheetBackdrop');
    const editSheet = document.getElementById('editSheet');
    const sheetTitle = document.getElementById('sheetTitle');
    const sheetBody = document.getElementById('sheetBody');
    const sheetClose = document.getElementById('sheetClose');
    const saveSheet = document.getElementById('saveSheet');
    const saveSheetClose = document.getElementById('saveSheetClose');
    const savePngBtn = document.getElementById('savePngBtn');
    const saveTransparentBtn = document.getElementById('saveTransparentBtn');
    const savePdfBtn = document.getElementById('savePdfBtn');
    const moveToolbar = document.createElement('div');
    moveToolbar.className = 'move-toolbar';
    moveToolbar.setAttribute('aria-hidden', 'true');
    const moveCancelBtn = document.createElement('button');
    moveCancelBtn.className = 'btn';
    moveCancelBtn.type = 'button';
    moveCancelBtn.textContent = 'キャンセル';
    const moveDoneBtn = document.createElement('button');
    moveDoneBtn.className = 'btn action-primary';
    moveDoneBtn.type = 'button';
    moveDoneBtn.textContent = '完了';
    moveToolbar.appendChild(moveCancelBtn);
    moveToolbar.appendChild(moveDoneBtn);
    document.body.appendChild(moveToolbar);
    const controlInputs = {};
    Object.keys(config.controlInputIds || {}).forEach(function (key) {
      controlInputs[key] = document.getElementById(config.controlInputIds[key]);
    });

    const state = deepClone(config.initialState);
    state.areaColor = state.areaColor || '#2a5bd7';
    const showArea = config.showArea !== false;
    state.extraAreaInputs = state.extraAreaInputs || {};
    state.extraAreaColors = state.extraAreaColors || {};
    state.measureColors = state.measureColors || {};
    state.labelScales = state.labelScales || {};
    state.rawControlInputs = {};
    state.decimalPlaces = clampDecimalPlaces(state.decimalPlaces);
    setActiveDecimalPlaces(state.decimalPlaces);
    state.measureKinds = state.measureKinds || {};
    state.measureArcVisible = state.measureArcVisible || {};
    state.labelOffsets = state.labelOffsets || {};
    Object.keys(state.measures || {}).forEach(function (id) {
      if (!state.measureKinds[id]) state.measureKinds[id] = 'plain';
      if (!Object.prototype.hasOwnProperty.call(state.measureArcVisible, id)) state.measureArcVisible[id] = true;
    });
    state.angleKinds = state.angleKinds || {};
    Object.keys(state.angleInputs || {}).forEach(function (id) {
      if (!state.angleKinds[id]) state.angleKinds[id] = 'plain';
    });
    let currentGeometry = null;
    let moveMode = null;
    let moveDrag = null;
    let currentLabelBases = {};
    const labelMoveEnabled = config.enableLabelMoveMode !== false;
    const LabelEngine = window.InstantGeometryDrawLabelEngine || window.InstantGeometryTriangleLabelEngine || null;
    let labelController = null;

    function labelKey(kind, id) {
      return kind + ':' + id;
    }

    function getLabelScale(kind, id) {
      const key = labelKey(kind, id);
      const value = Number(state.labelScales[key]);
      return Number.isFinite(value) && value > 0 ? value : 1;
    }

    function setLabelScale(kind, id, value) {
      const scale = Math.max(0.1, Math.min(4, Number(value) || 1));
      state.labelScales[labelKey(kind, id)] = scale;
    }

    function isArcMeasure(id) {
      if (window.InstantGeometryLabelTaxonomy && typeof window.InstantGeometryLabelTaxonomy.normalizeLabelTarget === 'function') {
        return window.InstantGeometryLabelTaxonomy.normalizeLabelTarget('measure', id, { shape: config.shape }).kind === 'arc';
      }
      if (window.InstantGeometryLabelTaxonomy && typeof window.InstantGeometryLabelTaxonomy.normalize === 'function') {
        return window.InstantGeometryLabelTaxonomy.normalize({ kind: 'measure', id: id }, { shape: config.shape }).kind === 'arc';
      }
      return /^arc/.test(String(id || '')) || id === 'l';
    }

    function normalizeLabelTarget(kind, id) {
      if (window.InstantGeometryLabelTaxonomy && typeof window.InstantGeometryLabelTaxonomy.normalizeLabelTarget === 'function') {
        return window.InstantGeometryLabelTaxonomy.normalizeLabelTarget(kind, id, { shape: config.shape });
      }
      if (window.InstantGeometryLabelTaxonomy && typeof window.InstantGeometryLabelTaxonomy.normalize === 'function') {
        return window.InstantGeometryLabelTaxonomy.normalize({ kind: kind, id: id }, { shape: config.shape });
      }
      return {
        kind: kind === 'measure' && isArcMeasure(id) ? 'arc' : (kind === 'measure' ? 'segment' : kind),
        id: id,
        originalKind: kind,
        originalId: id,
        canonical: true
      };
    }

    function distanceToSegment(point, a, b) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lengthSq = dx * dx + dy * dy;
      if (!lengthSq) return Math.hypot(point.x - a.x, point.y - a.y);
      const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq));
      return Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t));
    }

    function distanceToPolyline(point, points) {
      let minDistance = Infinity;
      for (let i = 1; i < points.length; i += 1) {
        minDistance = Math.min(minDistance, distanceToSegment(point, points[i - 1], points[i]));
      }
      return minDistance;
    }

    function arcMeasureAtPoint(point) {
      if (!currentGeometry || !Object.prototype.hasOwnProperty.call(state.measures || {}, 'arcAB')) return null;
      if (currentGeometry.shape !== 'sector' && currentGeometry.shape !== 'ellipse-sector') return null;
      const layout = fitGeometry(currentGeometry.radiusX, currentGeometry.radiusY);
      const arcPoints = ellipseArcPoints(layout, currentGeometry.radiusX, currentGeometry.radiusY, currentGeometry.angleRadians);
      return distanceToPolyline(point, arcPoints) <= 72 ? 'arcAB' : null;
    }

    function ensureLabelOffset(kind, id) {
      if (!state.labelOffsets[kind]) state.labelOffsets[kind] = {};
      if (!state.labelOffsets[kind][id]) state.labelOffsets[kind][id] = { x: 0, y: 0 };
      return state.labelOffsets[kind][id];
    }

    function getLabelOffset(kind, id) {
      return state.labelOffsets[kind] && state.labelOffsets[kind][id]
        ? state.labelOffsets[kind][id]
        : { x: 0, y: 0 };
    }

    function getLabelPosition(kind, id, basePosition) {
      currentLabelBases[labelKey(kind, id)] = { x: basePosition.x, y: basePosition.y };
      const offset = getLabelOffset(kind, id);
      return { x: basePosition.x + offset.x, y: basePosition.y + offset.y };
    }

    function isMoveTarget(kind, id) {
      return moveMode && moveMode.kind === kind && moveMode.payload && moveMode.payload.id === id;
    }

    function updateMoveModeUi() {
      const active = Boolean(moveMode);
      document.body.classList.toggle('label-move-active', active);
      captureRoot.classList.toggle('label-move-active', active);
      moveToolbar.classList.toggle('open', active);
      moveToolbar.setAttribute('aria-hidden', active ? 'false' : 'true');
    }

    function pointerToSvgPoint(event) {
      const matrix = stage.getScreenCTM();
      if (!matrix) return { x: 0, y: 0 };
      const point = stage.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const transformed = point.matrixTransform(matrix.inverse());
      return { x: transformed.x, y: transformed.y };
    }

    function setStatus(message, isError) {
      statusBox.textContent = message;
      statusBox.classList.toggle('error', !!isError);
    }

    function areaFill(alpha) {
      return hexToRgba(state.areaColor || '#2a5bd7', alpha);
    }

    function areaShapeFill(alpha) {
      return showArea ? areaFill(alpha) : 'none';
    }

    function circlePointId(index) {
      if (index < 26) return String.fromCharCode(65 + index);
      return 'P' + (index + 1);
    }

    function ensureCirclePointLabels(count) {
      if (!Object.prototype.hasOwnProperty.call(state.pointInputs, 'O')) state.pointInputs.O = 'O';
      for (let i = 0; i < count; i += 1) {
        const id = circlePointId(i);
        if (!Object.prototype.hasOwnProperty.call(state.pointInputs, id)) state.pointInputs[id] = id;
      }
    }

    if (window.InstantGeometrySaveQuota) {
      window.InstantGeometrySaveQuota.createIndicator({ target: saveBtn });
    }

    function closeSheets() {
      editSheet.classList.remove('open');
      editSheet.setAttribute('aria-hidden', 'true');
      saveSheet.classList.remove('open');
      saveSheet.setAttribute('aria-hidden', 'true');
      sheetBackdrop.classList.remove('open');
      sheetBody.innerHTML = '';
    }

    function finishMoveMode(restoreOffset) {
      if (!moveMode) return;
      const previous = moveMode;
      if (restoreOffset) {
        if (!state.labelOffsets[previous.kind]) state.labelOffsets[previous.kind] = {};
        state.labelOffsets[previous.kind][previous.payload.id] = previous.originalOffset;
      }
      moveMode = null;
      moveDrag = null;
      updateMoveModeUi();
      render();
      openSheet('edit', previous.payload);
    }

    function enterMoveMode(payload) {
      const key = labelKey(payload.kind, payload.id);
      if (!currentLabelBases[key]) {
        setStatus('ラベルを表示してから移動してください。', true);
        openSheet('edit', payload);
        return;
      }
      const originalOffset = getLabelOffset(payload.kind, payload.id);
      moveMode = {
        kind: payload.kind,
        payload: { kind: payload.kind, id: payload.id },
        originalOffset: { x: originalOffset.x, y: originalOffset.y }
      };
      closeSheets();
      updateMoveModeUi();
      render();
    }

    function getControllerLabelValue(kind, id) {
      if (kind === 'point') return String((state.pointInputs && state.pointInputs[id]) || '');
      if (kind === 'measure') return String(state.measureInputs[id] || '');
      if (kind === 'angle') return String(state.angleInputs[id] || '');
      if (kind === 'area') return String(state.areaInput || '');
      if (kind === 'extraArea') return String(state.extraAreaInputs[id] || '');
      return '';
    }

    function setControllerLabelValue(kind, id, value) {
      const text = String(value || '');
      if (kind === 'point') {
        state.pointInputs[id] = text;
      } else if (kind === 'measure') {
        state.measureInputs[id] = text;
        if (!text) state.measureArcVisible[id] = false;
      } else if (kind === 'angle') {
        state.angleInputs[id] = text;
      } else if (kind === 'area') {
        state.areaInput = text;
      } else if (kind === 'extraArea') {
        state.extraAreaInputs[id] = text;
      }
    }

    function buildControllerSegmentKindSelect(kind, id, buildSelectFn) {
      return buildSelectFn('線分マーク', state.measureKinds[id] || 'plain', [
        { value: 'plain', label: '通常' },
        { value: 'circle', label: '丸付き' },
        { value: 'single', label: '一本線付き' },
        { value: 'double', label: '二重線付き' },
        { value: 'cross', label: '交差付き' },
        { value: 'triangle', label: '三角付き' },
        { value: 'parallel', label: '平行矢印付き' },
        { value: 'parallel-reverse', label: '平行矢印付き（逆向き）' },
        { value: 'parallel-single', label: '平行＋一本線付き' },
        { value: 'parallel-single-reverse', label: '平行＋一本線付き（逆向き）' },
        { value: 'parallel-double', label: '平行＋二重線付き' },
        { value: 'parallel-double-reverse', label: '平行＋二重線付き（逆向き）' }
      ]);
    }

    function buildControllerAngleKindSelect(kind, id, buildSelectFn, body) {
      const currentAngleValue = currentGeometry && currentGeometry.angles ? currentGeometry.angles[id] : null;
      if (window.InstantGeometryMobileAngleOrnaments) {
        return window.InstantGeometryMobileAngleOrnaments.appendAngleKindSelect(
          body,
          buildSelectFn,
          state.angleKinds[id] || 'plain',
          currentAngleValue
        );
      }
      const built = buildSelectFn('角マーク', state.angleKinds[id] || 'plain', [
        { value: 'hidden', label: '非表示' },
        { value: 'plain', label: '角弧のみ' }
      ]);
      body.appendChild(built.field);
      return built.select;
    }

    function setControllerKind(kind, id, value) {
      if (kind === 'measure') state.measureKinds[id] = value;
      else if (kind === 'angle') state.angleKinds[id] = value;
    }

    function controllerTargetIsSegment(kind, id) {
      return normalizeLabelTarget(kind, id).kind === 'segment';
    }

    if (LabelEngine && typeof LabelEngine.createController === 'function') {
      labelController = LabelEngine.createController({
        enabledLabels: true,
        taxonomyContext: { shape: config.shape },
        sheetTitle: sheetTitle,
        sheetBody: sheetBody,
        editSheet: editSheet,
        sheetBackdrop: sheetBackdrop,
        closeSheets: closeSheets,
        render: render,
        labelMoveEnabled: labelMoveEnabled,
        onMove: function (kind, id) {
          enterMoveMode({ kind: kind, id: id });
        },
        onError: function (error) {
          setStatus(error.message || '入力を確認してください。', true);
        },
        getModalSpec: function (kind, id, modalType) {
          return LabelEngine.getStandardModalSpec(modalType);
        },
        getLabelValue: getControllerLabelValue,
        setLabelValue: setControllerLabelValue,
        getLabelScale: getLabelScale,
        setLabelScale: setLabelScale,
        hasGuideField: function (kind, id) {
          return kind === 'measure' && controllerTargetIsSegment(kind, id);
        },
        getGuideVisible: function (kind, id) {
          return kind === 'measure' ? state.measureArcVisible[id] !== false : false;
        },
        setGuideVisible: function (kind, id, value) {
          if (kind === 'measure') state.measureArcVisible[id] = value;
        },
        buildSegmentKindSelect: buildControllerSegmentKindSelect,
        buildAngleKindSelect: buildControllerAngleKindSelect,
        setKind: setControllerKind,
        hasColorField: function (kind) {
          return kind === 'measure' || kind === 'area' || kind === 'extraArea';
        },
        getColor: function (kind, id) {
          if (kind === 'measure') return state.measureColors[id] || '#2a5bd7';
          if (kind === 'extraArea') return state.extraAreaColors[id] || state.areaColor || '#2a5bd7';
          return state.areaColor || '#2a5bd7';
        },
        setColor: function (kind, id, value) {
          if (!value) return;
          if (kind === 'measure') state.measureColors[id] = value;
          else if (kind === 'extraArea') state.extraAreaColors[id] = value;
          else if (kind === 'area') state.areaColor = value;
        }
      });
    }

    function openSheet(kind, payload) {
      closeSheets();
      if (kind === 'save') {
        saveSheet.classList.add('open');
        saveSheet.setAttribute('aria-hidden', 'false');
      } else if (labelController) {
        labelController.openEditSheet(payload.kind, payload.id);
      } else {
        renderEditSheet(payload);
        editSheet.classList.add('open');
        editSheet.setAttribute('aria-hidden', 'false');
      }
      sheetBackdrop.classList.add('open');
    }

    function readGeometry() {
      if (config.shape === 'ellipse') {
        const radiusX = parsePositiveNumber(controlInputs.radiusX.value, '半径1');
        const radiusY = parsePositiveNumber(controlInputs.radiusY.value, '半径2');
        return {
          shape: 'ellipse',
          radiusX: radiusX,
          radiusY: radiusY,
          area: Math.PI * radiusX * radiusY,
          measures: { a: radiusX, b: radiusY }
        };
      }
      if (config.shape === 'sector') {
        const radius = parsePositiveNumber(controlInputs.radius.value, '半径');
        const angleDegrees = parseAngleDegrees(controlInputs.angle.value);
        const angleRadians = angleDegrees * Math.PI / 180;
        return {
          shape: 'sector',
          radiusX: radius,
          radiusY: radius,
          angleDegrees: angleDegrees,
          angleRadians: angleRadians,
          area: 0.5 * radius * radius * angleRadians,
          arcLength: radius * angleRadians,
          measures: { r: radius, arcAB: radius * angleRadians },
          angles: { AOB: angleDegrees }
        };
      }
      if (config.shape === 'ellipse-sector') {
        const radiusX = parsePositiveNumber(controlInputs.radiusX.value, '横半径');
        const radiusY = parsePositiveNumber(controlInputs.radiusY.value, '縦半径');
        const angleDegrees = parseAngleDegrees(controlInputs.angle.value);
        const angleRadians = angleDegrees * Math.PI / 180;
        const arcLength = ellipseArcLength(radiusX, radiusY, angleRadians);
        return {
          shape: 'ellipse-sector',
          radiusX: radiusX,
          radiusY: radiusY,
          angleDegrees: angleDegrees,
          angleRadians: angleRadians,
          area: 0.5 * radiusX * radiusY * angleRadians,
          arcLength: arcLength,
          measures: { a: radiusX, b: radiusY, arcAB: arcLength },
          angles: { AOB: angleDegrees }
        };
      }
      if (config.shape === 'quarter-two-semicircles') {
        const radius = parsePositiveNumber(controlInputs.radius.value, '半径');
        const angleDegrees = 90;
        const angleRadians = Math.PI / 2;
        const semicircleArcLength = Math.PI * radius / 2;
        return {
          shape: 'quarter-two-semicircles',
          radiusX: radius,
          radiusY: radius,
          angleDegrees: angleDegrees,
          angleRadians: angleRadians,
          area: 0.25 * Math.PI * radius * radius,
          arcLength: radius * angleRadians,
          measures: { OA: radius, OB: radius, arcOA: semicircleArcLength, arcOB: semicircleArcLength, arcAB: radius * angleRadians },
          angles: { AOB: angleDegrees }
        };
      }
      if (config.shape === 'semicircle-and-circle') {
        const radius = parsePositiveNumber(controlInputs.radius.value, 'OA');
        return {
          shape: 'semicircle-and-circle',
          radiusX: radius,
          radiusY: radius,
          radius: radius,
          area: Math.PI * radius * radius / 2,
          measures: {
            OA: radius,
            OB: radius,
            OC: radius,
            AB: radius * 2
          },
          angles: { COA: 90 }
        };
      }
      if (config.shape === 'area-add-subtract-3') {
        const ab = parsePositiveNumber(controlInputs.ab.value, 'AB');
        const angleText = String(controlInputs.angle.value || '').trim();
        if (!/^[0-9]+(?:\.[0-9]+)?$/.test(angleText)) {
          throw new Error('回転角には数値を入力してください。');
        }
        const angleDegrees = Number(angleText);
        if (!(angleDegrees >= 0 && angleDegrees <= 90)) {
          throw new Error('回転角は 0° 以上 90° 以下にしてください。');
        }
        const angleRadians = angleDegrees * Math.PI / 180;
        return {
          shape: 'area-add-subtract-3',
          radiusX: ab * 0.62,
          radiusY: ab * 0.44,
          AB: ab,
          angleDegrees: angleDegrees,
          angleRadians: angleRadians,
          area: Math.PI * ab * ab / 8,
          measures: { AB: ab, angle: angleDegrees }
        };
      }
      if (config.shape === 'area-add-subtract-4') {
        const radius = parsePositiveNumber(controlInputs.radius.value, '半径');
        const shift = parsePositiveNumber(controlInputs.shift.value, "AA'");
        if (shift > radius) {
          throw new Error("AA' は円Oの半径以下にしてください。");
        }
        return {
          shape: 'area-add-subtract-4',
          radiusX: radius + shift / 2,
          radiusY: radius,
          radius: radius,
          shift: shift,
          area: Math.PI * radius * radius,
          measures: { r: radius, shift: shift }
        };
      }
      if (config.shape === 'baumkuchen-1') {
        const radius = parsePositiveNumber(controlInputs.radius.value, 'r');
        const diff = parsePositiveNumber(controlInputs.diff.value, 'a');
        const middleRadius = radius + diff / 2;
        return {
          shape: 'baumkuchen-1',
          radiusX: radius + diff,
          radiusY: radius + diff,
          radius: radius,
          diff: diff,
          middleRadius: middleRadius,
          area: Math.PI * ((radius + diff) * (radius + diff) - radius * radius),
          measures: {
            r: radius,
            a: diff,
            l: Math.PI * 2 * middleRadius
          }
        };
      }
      if (config.shape === 'sal-2') {
        const ab = parsePositiveNumber(controlInputs.ab.value, 'AB');
        const bc = parsePositiveNumber(controlInputs.bc.value, 'BC');
        const diff = parsePositiveNumber(controlInputs.diff.value, 'a');
        return {
          shape: 'sal-2',
          radiusX: ab / 2 + diff,
          radiusY: bc / 2 + diff,
          AB: ab,
          BC: bc,
          diff: diff,
          area: ab * bc,
          measures: {
            AB: ab,
            BC: bc,
            a: diff
          }
        };
      }
      if (config.shape === 'sal-3') {
        const ab = parsePositiveNumber(controlInputs.ab.value, 'AB');
        const bc = parsePositiveNumber(controlInputs.bc.value, 'BC');
        const ca = parsePositiveNumber(controlInputs.ca.value, 'CA');
        const diff = parsePositiveNumber(controlInputs.diff.value, 'a');
        function validateTriangle(x, y, z, prefix) {
          if (x + y <= z || y + z <= x || z + x <= y) {
            throw new Error(prefix + ' の3辺が三角形の条件を満たしていません。');
          }
        }
        function centeredTriangle(x, y, z) {
          const ax = (x * x + y * y - z * z) / (2 * y);
          const ay = Math.sqrt(Math.max(0, x * x - ax * ax));
          const raw = [
            { x: ax, y: -ay },
            { x: 0, y: 0 },
            { x: y, y: 0 }
          ];
          const centroid = {
            x: (raw[0].x + raw[1].x + raw[2].x) / 3,
            y: (raw[0].y + raw[1].y + raw[2].y) / 3
          };
          return raw.map(function (point) {
            return { x: point.x - centroid.x, y: point.y - centroid.y };
          });
        }
        function triangleBounds(points) {
          return points.reduce(function (acc, point) {
            return {
              x: Math.max(acc.x, Math.abs(point.x)),
              y: Math.max(acc.y, Math.abs(point.y))
            };
          }, { x: 0, y: 0 });
        }
        function distanceFromOriginToLine(p, q) {
          const dx = q.x - p.x;
          const dy = q.y - p.y;
          return Math.abs(dx * p.y - dy * p.x) / (Math.hypot(dx, dy) || 1);
        }
        function footOfPerpendicular(point, lineA, lineB) {
          const dx = lineB.x - lineA.x;
          const dy = lineB.y - lineA.y;
          const lengthSq = dx * dx + dy * dy || 1;
          const t = ((point.x - lineA.x) * dx + (point.y - lineA.y) * dy) / lengthSq;
          return { x: lineA.x + dx * t, y: lineA.y + dy * t };
        }
        function distance(p, q) {
          return Math.hypot(q.x - p.x, q.y - p.y);
        }
        validateTriangle(ab, bc, ca, 'ABC');
        const centered = centeredTriangle(ab, bc, ca);
        const sideDistance = distanceFromOriginToLine(centered[0], centered[2]);
        const bigScale = 1 + diff / sideDistance;
        const J = {
          x: (centered[1].x + centered[2].x) / 2,
          y: (centered[1].y + centered[2].y) / 2
        };
        const K = footOfPerpendicular(
          J,
          { x: centered[1].x * bigScale, y: centered[1].y * bigScale },
          { x: centered[2].x * bigScale, y: centered[2].y * bigScale }
        );
        const bounds = triangleBounds(centered.map(function (point) {
          return { x: point.x * bigScale, y: point.y * bigScale };
        }));
        return {
          shape: 'sal-3',
          radiusX: bounds.x,
          radiusY: bounds.y,
          AB: ab,
          BC: bc,
          CA: ca,
          diff: diff,
          bigScale: bigScale,
          area: Math.sqrt(Math.max(0, ((ab + bc + ca) / 2) * (((ab + bc + ca) / 2) - ab) * (((ab + bc + ca) / 2) - bc) * (((ab + bc + ca) / 2) - ca))),
          measures: {
            AB: ab,
            BC: bc,
            CA: ca,
            MN: diff,
            DE: ab * (1 + bigScale) / 2,
            EF: bc * (1 + bigScale) / 2,
            FD: ca * (1 + bigScale) / 2,
            GH: ab * bigScale,
            HI: bc * bigScale,
            IG: ca * bigScale,
            JK: distance(J, K)
          }
        };
      }
      if (config.shape === 'right-triangle-semicircles') {
        const ab = parsePositiveNumber(controlInputs.ab.value, 'AB');
        const ac = parsePositiveNumber(controlInputs.ac.value, 'AC');
        const bc = Math.hypot(ab, ac);
        const height = ab * ac / bc;
        return {
          shape: 'right-triangle-semicircles',
          radiusX: bc / 2,
          radiusY: height + Math.max(ab, ac) / 2,
          AB: ab,
          AC: ac,
          BC: bc,
          height: height,
          area: ab * ac / 2,
          measures: {
            AB: ab,
            AC: ac,
            BC: bc,
            arcAB: Math.PI * ab / 2,
            arcAC: Math.PI * ac / 2,
            arcBC: Math.PI * bc / 2
          },
          measureDisplay: {
            BC: formatPythagoreanHypotenuse(ab, ac)
          },
          angles: { BAC: 90 }
        };
      }
      if (config.shape === 'taijitu') {
        const ao = parsePositiveNumber(controlInputs.ao.value, 'AO');
        return {
          shape: 'taijitu',
          radiusX: ao,
          radiusY: ao,
          AO: ao,
          area: Math.PI * ao * ao,
          measures: { AO: ao }
        };
      }
      if (config.shape === 'square-corner-sectors') {
        const side = parsePositiveNumber(controlInputs.side.value, '1辺');
        return {
          shape: 'square-corner-sectors',
          radiusX: side,
          radiusY: side,
          side: side,
          area: side * side,
          measures: { AB: side, BC: side, CD: side, DA: side }
        };
      }
      if (config.shape === 'square-quarter-sector-3') {
        const side = parsePositiveNumber(controlInputs.side.value, 'AB');
        return {
          shape: 'square-quarter-sector-3',
          radiusX: side,
          radiusY: side,
          side: side,
          area: side * side,
          measures: { AB: side }
        };
      }
      if (config.shape === 'square-quarter-sector-4') {
        const side = parsePositiveNumber(controlInputs.side.value, 'AB');
        return {
          shape: 'square-quarter-sector-4',
          radiusX: side,
          radiusY: side,
          side: side,
          area: side * side,
          measures: { AB: side }
        };
      }
      if (config.shape === 'square-circle-1') {
        const side = parsePositiveNumber(controlInputs.side.value, 'AB');
        return {
          shape: 'square-circle-1',
          radiusX: side,
          radiusY: side,
          side: side,
          area: side * side,
          measures: { AB: side }
        };
      }
      if (config.shape === 'square-circle-2') {
        const side = parsePositiveNumber(controlInputs.side.value, 'AB');
        return {
          shape: 'square-circle-2',
          radiusX: side,
          radiusY: side,
          side: side,
          area: side * side,
          measures: { AB: side }
        };
      }
      if (config.shape === 'square-semicircle-1') {
        const side = parsePositiveNumber(controlInputs.side.value, 'AB');
        return {
          shape: 'square-semicircle-1',
          radiusX: side,
          radiusY: side,
          side: side,
          area: side * side,
          measures: { AB: side }
        };
      }
      if (config.shape === 'square-semicircle-2') {
        const side = parsePositiveNumber(controlInputs.side.value, 'AB');
        return {
          shape: 'square-semicircle-2',
          radiusX: side,
          radiusY: side,
          side: side,
          area: side * side,
          measures: { AB: side }
        };
      }
      if (config.shape === 'square-quarter-sector') {
        const side = parsePositiveNumber(controlInputs.side.value, 'AB');
        const bp = parsePositiveNumber(controlInputs.bp.value, 'BP');
        if (bp >= side) {
          throw new Error('BP は AB より小さくしてください。');
        }
        const dx = side - bp;
        const dy = -side;
        const a = dx * dx + dy * dy;
        const b = 2 * bp * dx;
        const c = bp * bp - side * side;
        const t = (-b + Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a);
        const ex = bp + dx * t;
        const ey = dy * t;
        const thetaE = Math.atan2(ey, ex);
        return {
          shape: 'square-quarter-sector',
          radiusX: side,
          radiusY: side,
          side: side,
          bp: bp,
          area: side * side,
          measures: {
            AB: side,
            BP: bp,
            PC: side - bp,
            PE: Math.hypot(ex - bp, ey),
            ED: Math.hypot(side - ex, -side - ey),
            CD: side,
            DA: side,
            arcCE: side * Math.abs(thetaE),
            arcEA: side * (Math.PI / 2 - Math.abs(thetaE))
          }
        };
      }
      if (config.shape === 'inscribed-center-angle') {
        const angleDegrees = parseInscribedAngleDegrees(controlInputs.angle.value);
        const angleRadians = angleDegrees * Math.PI / 180;
        return {
          shape: 'inscribed-center-angle',
          radiusX: 5,
          radiusY: 5,
          angleDegrees: angleDegrees,
          angleRadians: angleRadians,
          centralAngleDegrees: angleDegrees * 2,
          centralAngleRadians: angleRadians * 2,
          area: Math.PI * 25,
          measures: {},
          angles: { ACB: angleDegrees, AOB: angleDegrees * 2, CAO: angleDegrees / 2, CBO: angleDegrees / 2 }
        };
      }
      if (config.shape === 'two-inscribed-angles') {
        const angleACB = parseInscribedAngleDegrees(controlInputs.angleACB.value);
        const angleCAD = parseInscribedAngleDegrees(controlInputs.angleCAD.value);
        if (!(angleACB > 0 && angleACB < 90 && angleCAD > 0 && angleCAD < 90)) {
          throw new Error('角 ACB と角 CAD は 0° より大きく 90° 未満の整数にしてください。');
        }
        return {
          shape: 'two-inscribed-angles',
          radiusX: 5,
          radiusY: 5,
          angleACB: angleACB,
          angleCAD: angleCAD,
          area: Math.PI * 25,
          measures: {},
          angles: { ACB: angleACB, ADB: angleACB, CAD: angleCAD, CBD: angleCAD }
        };
      }
      if (config.shape === 'inscribed-angle-application-1') {
        const angleBed = parseAngleDegrees(controlInputs.angleBED.value);
        const angleApc = parseAngleDegrees(controlInputs.angleAPC.value);
        if (!(angleApc > 0 && angleApc < angleBed && angleBed < 180)) {
          throw new Error('角 BED は角 APC より大きく、180° 未満にしてください。');
        }
        const distance = solveSecantDistance(angleApc, angleBed);
        return {
          shape: 'inscribed-angle-application-1',
          radiusX: 5,
          radiusY: 5,
          angleBED: angleBed,
          angleAPC: angleApc,
          secantDistance: distance,
          area: Math.PI * 25,
          measures: {},
          angles: {
            BED: angleBed,
            APC: angleApc
          }
        };
      }
      if (config.shape === 'inscribed-angle-application-2') {
        const angleApb = parseAngleDegrees(controlInputs.angleAPB.value);
        const anglePac = parseAngleDegrees(controlInputs.anglePAC.value);
        const minPac = (180 - angleApb) / 2;
        if (!(angleApb > 0 && angleApb < 150 && anglePac > minPac && anglePac < 180)) {
          throw new Error('角 APB は 0° より大きく 150° 未満、角 PAC は (180° - 角 APB) / 2 より大きく 180° 未満にしてください。');
        }
        const tangentDistance = 5 / Math.sin(angleApb * Math.PI / 360);
        return {
          shape: 'inscribed-angle-application-2',
          radiusX: Math.max(5, tangentDistance),
          radiusY: 5,
          angleAPB: angleApb,
          anglePAC: anglePac,
          area: Math.PI * 25,
          measures: {},
          angles: {
            APB: angleApb,
            ACB: 0,
            PAC: anglePac,
            ABC: 0,
            CBP: 0
          }
        };
      }
      if (config.shape === 'inscribed-angle-application-3') {
        const angleDec = parseAngleDegrees(controlInputs.angleDEC.value);
        const angleBac = parseAngleDegrees(controlInputs.angleA.value);
        if (!(angleDec > 0 && angleBac > 0 && angleDec + angleBac < 90)) {
          throw new Error('角 DEC と角 BAC は 0° より大きく、和が 90° 未満になるようにしてください。');
        }
        return {
          shape: 'inscribed-angle-application-3',
          radiusX: 5,
          radiusY: 5,
          angleDEC: angleDec,
          angleBAC: angleBac,
          angleBOD: (angleDec + angleBac) * 2,
          area: Math.PI * 25,
          measures: {},
          angles: {
            DEC: angleDec,
            BAC: angleBac,
            BOD: (angleDec + angleBac) * 2
          }
        };
      }
      if (config.shape === 'inscribed-angle-application-5') {
        const angleDec = parseAngleDegrees(controlInputs.angleDEC.value);
        const angleBac = parseAngleDegrees(controlInputs.angleA.value);
        if (!(angleDec > 0 && angleBac > 0 && angleDec + angleBac < 90)) {
          throw new Error('角 DEC と角 BAC は 0° より大きく、和が 90° 未満になるようにしてください。');
        }
        return {
          shape: 'inscribed-angle-application-5',
          radiusX: 5,
          radiusY: 5,
          angleDEC: angleDec,
          angleBAC: angleBac,
          area: Math.PI * 25,
          measures: {},
          angles: {
            DEC: angleDec,
            BAC: angleBac,
            BFD: angleDec + angleBac
          }
        };
      }
      if (config.shape === 'inscribed-angle-application-4') {
        const angleOac = parseAngleDegrees(controlInputs.angleOAC.value);
        const angleObc = parseAngleDegrees(controlInputs.angleOBC.value);
        if (!(angleOac > 0 && angleObc > angleOac && angleObc < 90)) {
          throw new Error('角 OAC は 0° より大きく、角 OBC は角 OAC より大きく 90° 未満にしてください。');
        }
        return {
          shape: 'inscribed-angle-application-4',
          radiusX: 5,
          radiusY: 5,
          angleOAC: angleOac,
          angleOBC: angleObc,
          area: Math.PI * 25,
          measures: {},
          angles: {
            OAC: angleOac,
            OBC: angleObc,
            BOA: 2 * (angleObc - angleOac),
            BCA: 180 - angleOac - angleObc
          }
        };
      }
      if (config.shape === 'tangent-theorem') {
        const angleA = parseInscribedAngleDegrees(controlInputs.angleA.value);
        const angleB = parseInscribedAngleDegrees(controlInputs.angleB.value);
        if (!(angleA > 0 && angleB > 0 && angleA + angleB < 180)) {
          throw new Error('角 BAC と角 ABC は 0° より大きく、合計が 180° 未満になるようにしてください。');
        }
        return {
          shape: 'tangent-theorem',
          radiusX: 5,
          radiusY: 5,
          angleA: angleA,
          angleB: angleB,
          angleC: 180 - angleA - angleB,
          area: Math.PI * 25,
          measures: {},
          angles: {
            BAC: angleA,
            ABC: angleB,
            QCB: angleA,
            ACP: angleB
          }
        };
      }
      if (config.shape === 'circle-n-points') {
        const text = String(controlInputs.count.value || '').trim();
        if (!/^[1-9][0-9]*$/.test(text)) {
          throw new Error('n には自然数を入力してください。');
        }
        const count = Number(text);
        if (count > 36) {
          throw new Error('n は 36 以下にしてください。');
        }
        ensureCirclePointLabels(count);
        return {
          shape: 'circle-n-points',
          radiusX: 5,
          radiusY: 5,
          count: count,
          pointIds: Array.from({ length: count }, function (_, index) { return circlePointId(index); }),
          area: Math.PI * 25,
          measures: {}
        };
      }
      if (config.shape === 'two-circles') {
        const radiusO = parsePositiveNumber(controlInputs.radiusO.value, '円Oの半径');
        const radiusOp = parsePositiveNumber(controlInputs.radiusOp.value, "円O'の半径");
        const centerDistance = parsePositiveNumber(controlInputs.centerDistance.value, "OO'");
        return {
          shape: 'two-circles',
          radiusX: (radiusO + centerDistance + radiusOp) / 2,
          radiusY: Math.max(radiusO, radiusOp),
          radiusO: radiusO,
          radiusOp: radiusOp,
          centerDistance: centerDistance,
          area: Math.PI * radiusO * radiusO + Math.PI * radiusOp * radiusOp,
          measures: { rO: radiusO, rOp: radiusOp, OO: centerDistance }
        };
      }
      const radius = parsePositiveNumber(controlInputs.radius.value, '半径');
      return {
        shape: 'circle',
        radiusX: radius,
        radiusY: radius,
        area: Math.PI * radius * radius,
        measures: { r: radius }
      };
    }

    function syncStateFromGeometry(geometry) {
      Object.keys(geometry.measures).forEach(function (id) {
        state.measures[id] = geometry.measures[id];
      });
      if (geometry.angles) {
        state.angles = state.angles || {};
        Object.keys(geometry.angles).forEach(function (id) {
          state.angles[id] = geometry.angles[id];
        });
      }
    }

    function screenPoints(layout) {
      const cx = layout.cx;
      const cy = layout.cy;
      const rx = currentGeometry.radiusX * layout.scale;
      const ry = currentGeometry.radiusY * layout.scale;
      const theta = currentGeometry.angleRadians || 0;
      const B = pointOnEllipse(layout, currentGeometry.radiusX, currentGeometry.radiusY, theta);
      if (currentGeometry.shape === 'inscribed-center-angle') {
        const alpha = currentGeometry.angleRadians;
        return {
          O: { x: cx, y: cy },
          A: pointOnEllipse(layout, currentGeometry.radiusX, currentGeometry.radiusY, (Math.PI * 3 / 2) - alpha),
          B: pointOnEllipse(layout, currentGeometry.radiusX, currentGeometry.radiusY, (Math.PI * 3 / 2) + alpha),
          C: pointOnEllipse(layout, currentGeometry.radiusX, currentGeometry.radiusY, Math.PI / 2)
        };
      }
      if (currentGeometry.shape === 'two-inscribed-angles') {
        const acb = currentGeometry.angleACB * Math.PI / 180;
        const cad = currentGeometry.angleCAD * Math.PI / 180;
        return {
          O: { x: cx, y: cy },
          A: pointOnEllipse(layout, currentGeometry.radiusX, currentGeometry.radiusY, Math.PI * 3 / 2 - acb),
          B: pointOnEllipse(layout, currentGeometry.radiusX, currentGeometry.radiusY, Math.PI * 3 / 2 + acb),
          C: pointOnEllipse(layout, currentGeometry.radiusX, currentGeometry.radiusY, Math.PI / 2 + cad),
          D: pointOnEllipse(layout, currentGeometry.radiusX, currentGeometry.radiusY, Math.PI / 2 - cad)
        };
      }
      if (currentGeometry.shape === 'inscribed-angle-application-1') {
        const scale = currentGeometry.radiusX * layout.scale;
        const halfAngle = currentGeometry.angleAPC * Math.PI / 360;
        const upper = rayCircleIntersectionsFromLeft(currentGeometry.secantDistance, halfAngle);
        const lower = rayCircleIntersectionsFromLeft(currentGeometry.secantDistance, -halfAngle);
        function fitUnit(point) {
          return { x: cx + point.x * scale, y: cy - point.y * scale };
        }
        const A = fitUnit(upper.near);
        const B = fitUnit(upper.far);
        const C = fitUnit(lower.near);
        const D = fitUnit(lower.far);
        const P = fitUnit({ x: -currentGeometry.secantDistance, y: 0 });
        return {
          O: { x: cx, y: cy },
          P: P,
          A: A,
          B: B,
          C: C,
          D: D,
          E: lineIntersection(A, D, B, C)
        };
      }
      if (currentGeometry.shape === 'inscribed-angle-application-2') {
        const r = 5;
        const angle = currentGeometry.angleAPB * Math.PI / 180;
        const d = r / Math.sin(angle / 2);
        const tangentX = -r * r / d;
        const tangentY = Math.sqrt(Math.max(0, r * r - tangentX * tangentX));
        const angleA = Math.atan2(tangentY, tangentX);
        const angleC = angleA + currentGeometry.anglePAC * Math.PI / 90 - Math.PI * 2;
        const fitUnit = function (point) {
          return {
            x: cx + point.x * layout.scale,
            y: cy - point.y * layout.scale
          };
        };
        return {
          O: { x: cx, y: cy },
          P: fitUnit({ x: -d, y: 0 }),
          A: fitUnit({ x: tangentX, y: tangentY }),
          B: fitUnit({ x: tangentX, y: -tangentY }),
          C: pointOnEllipse(layout, currentGeometry.radiusY, currentGeometry.radiusY, angleC)
        };
      }
      if (currentGeometry.shape === 'inscribed-angle-application-3') {
        const dec = currentGeometry.angleDEC * Math.PI / 180;
        const bac = currentGeometry.angleBAC * Math.PI / 180;
        const B = Math.PI * 7 / 6;
        const A = Math.PI * 2 / 3;
        const E = Math.PI / 3;
        const C = B + bac * 2;
        const D = C + dec * 2;
        return {
          O: { x: cx, y: cy },
          B: pointOnEllipse(layout, currentGeometry.radiusX, currentGeometry.radiusY, B),
          A: pointOnEllipse(layout, currentGeometry.radiusX, currentGeometry.radiusY, A),
          E: pointOnEllipse(layout, currentGeometry.radiusX, currentGeometry.radiusY, E),
          D: pointOnEllipse(layout, currentGeometry.radiusX, currentGeometry.radiusY, D),
          C: pointOnEllipse(layout, currentGeometry.radiusX, currentGeometry.radiusY, C)
        };
      }
      if (currentGeometry.shape === 'inscribed-angle-application-5') {
        const dec = currentGeometry.angleDEC * Math.PI / 180;
        const bac = currentGeometry.angleBAC * Math.PI / 180;
        const B = Math.PI * 7 / 6;
        const A = Math.PI * 2 / 3;
        const F = Math.PI / 2;
        const E = Math.PI / 3;
        const C = B + bac * 2;
        const D = C + dec * 2;
        return {
          O: { x: cx, y: cy },
          B: pointOnEllipse(layout, currentGeometry.radiusX, currentGeometry.radiusY, B),
          A: pointOnEllipse(layout, currentGeometry.radiusX, currentGeometry.radiusY, A),
          F: pointOnEllipse(layout, currentGeometry.radiusX, currentGeometry.radiusY, F),
          E: pointOnEllipse(layout, currentGeometry.radiusX, currentGeometry.radiusY, E),
          D: pointOnEllipse(layout, currentGeometry.radiusX, currentGeometry.radiusY, D),
          C: pointOnEllipse(layout, currentGeometry.radiusX, currentGeometry.radiusY, C)
        };
      }
      if (currentGeometry.shape === 'inscribed-angle-application-4') {
        const angleA = currentGeometry.angleOAC * Math.PI / 180;
        const angleB = currentGeometry.angleOBC * Math.PI / 180;
        const a = Math.PI - angleA * 2;
        const b = Math.PI - angleB * 2;
        return {
          O: { x: cx, y: cy },
          A: pointOnEllipse(layout, currentGeometry.radiusX, currentGeometry.radiusY, a),
          B: pointOnEllipse(layout, currentGeometry.radiusX, currentGeometry.radiusY, b),
          C: pointOnEllipse(layout, currentGeometry.radiusX, currentGeometry.radiusY, 0)
        };
      }
      if (currentGeometry.shape === 'tangent-theorem') {
        const cAngle = Math.PI * 3 / 2;
        const radius = currentGeometry.radiusX * layout.scale;
        const C = pointOnEllipse(layout, currentGeometry.radiusX, currentGeometry.radiusY, cAngle);
        return {
          O: { x: cx, y: cy },
          A: pointOnEllipse(layout, currentGeometry.radiusX, currentGeometry.radiusY, cAngle - currentGeometry.angleB * Math.PI / 90),
          B: pointOnEllipse(layout, currentGeometry.radiusX, currentGeometry.radiusY, cAngle + currentGeometry.angleA * Math.PI / 90),
          C: C,
          P: { x: cx - radius * 1.26, y: C.y },
          Q: { x: cx + radius * 1.26, y: C.y }
        };
      }
      if (currentGeometry.shape === 'circle-n-points') {
        const points = { O: { x: cx, y: cy } };
        currentGeometry.pointIds.forEach(function (id, index) {
          const angle = -Math.PI / 2 + Math.PI * 2 * index / currentGeometry.count;
          points[id] = pointOnEllipse(layout, currentGeometry.radiusX, currentGeometry.radiusY, angle);
        });
        return points;
      }
      if (currentGeometry.shape === 'two-circles') {
        const scale = layout.scale;
        const totalWidth = currentGeometry.radiusO + currentGeometry.centerDistance + currentGeometry.radiusOp;
        const O = { x: cx + (-totalWidth / 2 + currentGeometry.radiusO) * scale, y: cy };
        const Op = { x: O.x + currentGeometry.centerDistance * scale, y: cy };
        return {
          O: O,
          Op: Op,
          A: { x: O.x - currentGeometry.radiusO * scale, y: cy },
          B: { x: Op.x + currentGeometry.radiusOp * scale, y: cy },
          rO: { x1: O.x - currentGeometry.radiusO * scale, y1: cy, x2: O.x, y2: cy },
          rOp: { x1: Op.x, y1: cy, x2: Op.x + currentGeometry.radiusOp * scale, y2: cy },
          OO: { x1: O.x, y1: cy, x2: Op.x, y2: cy }
        };
      }
      if (currentGeometry.shape === 'quarter-two-semicircles') {
        return {
          O: { x: cx, y: cy },
          A: { x: cx + rx, y: cy },
          B: { x: cx, y: cy - ry },
          C: { x: cx + rx / 2, y: cy - ry / 2 }
        };
      }
      if (currentGeometry.shape === 'semicircle-and-circle') {
        const radius = currentGeometry.radius * layout.scale;
        const O = { x: cx, y: cy };
        return {
          O: O,
          A: { x: cx - radius, y: cy },
          B: { x: cx + radius, y: cy },
          C: { x: cx, y: cy - radius },
          M: { x: cx, y: cy - radius / 2 },
          OA: { x1: cx - radius, y1: cy, x2: cx, y2: cy },
          OB: { x1: cx, y1: cy, x2: cx + radius, y2: cy },
          OC: { x1: cx, y1: cy, x2: cx, y2: cy - radius },
          AB: { x1: cx - radius, y1: cy, x2: cx + radius, y2: cy }
        };
      }
      if (currentGeometry.shape === 'area-add-subtract-3') {
        const length = currentGeometry.AB * layout.scale;
        const angle = currentGeometry.angleRadians;
        const A = { x: cx - length * 0.47, y: cy + length * 0.18 };
        const B = { x: A.x + length, y: A.y };
        const Bp = { x: A.x + length * Math.cos(angle), y: A.y - length * Math.sin(angle) };
        const C = { x: A.x + length * Math.cos(angle) * Math.cos(angle), y: A.y - length * Math.sin(angle) * Math.cos(angle) };
        const D = { x: A.x + length * Math.cos(angle / 2) * Math.cos(angle / 2), y: A.y - length * Math.sin(angle) / 2 };
        return {
          O: { x: (A.x + B.x) / 2, y: A.y },
          A: A,
          B: B,
          Bp: Bp,
          C: C,
          D: D,
          AB: { x1: A.x, y1: A.y, x2: B.x, y2: B.y }
        };
      }
      if (currentGeometry.shape === 'area-add-subtract-4') {
        const radius = currentGeometry.radius * layout.scale;
        const shift = currentGeometry.shift * layout.scale;
        const O = { x: cx - shift / 2, y: cy };
        const Op = { x: cx + shift / 2, y: cy };
        const h = Math.sqrt(Math.max(0, radius * radius - (shift / 2) * (shift / 2)));
        return {
          O: O,
          Op: Op,
          A: { x: O.x, y: O.y - radius },
          B: { x: O.x, y: O.y + radius },
          Ap: { x: Op.x, y: Op.y - radius },
          Bp: { x: Op.x, y: Op.y + radius },
          ITop: { x: cx, y: cy - h },
          IBottom: { x: cx, y: cy + h },
          r: { x1: O.x, y1: O.y, x2: O.x + radius, y2: O.y },
          shift: { x1: O.x, y1: O.y - radius, x2: Op.x, y2: Op.y - radius }
        };
      }
      if (currentGeometry.shape === 'baumkuchen-1') {
        const smallRadius = currentGeometry.radius * layout.scale;
        const middleRadius = currentGeometry.middleRadius * layout.scale;
        const bigRadius = (currentGeometry.radius + currentGeometry.diff) * layout.scale;
        return {
          O: { x: cx, y: cy },
          A: { x: cx + smallRadius, y: cy },
          M: { x: cx + middleRadius, y: cy },
          B: { x: cx + bigRadius, y: cy },
          r: { x1: cx, y1: cy, x2: cx + smallRadius, y2: cy },
          a: { x1: cx + smallRadius, y1: cy, x2: cx + bigRadius, y2: cy }
        };
      }
      if (currentGeometry.shape === 'sal-2') {
        const smallW = currentGeometry.AB * layout.scale;
        const smallH = currentGeometry.BC * layout.scale;
        const midW = (currentGeometry.AB + currentGeometry.diff) * layout.scale;
        const midH = (currentGeometry.BC + currentGeometry.diff) * layout.scale;
        const bigW = (currentGeometry.AB + currentGeometry.diff * 2) * layout.scale;
        const bigH = (currentGeometry.BC + currentGeometry.diff * 2) * layout.scale;
        function rectPoints(width, height, ids) {
          const left = cx - width / 2;
          const right = cx + width / 2;
          const top = cy - height / 2;
          const bottom = cy + height / 2;
          const result = {};
          result[ids[0]] = { x: left, y: top };
          result[ids[1]] = { x: left, y: bottom };
          result[ids[2]] = { x: right, y: bottom };
          result[ids[3]] = { x: right, y: top };
          return result;
        }
        const small = rectPoints(smallW, smallH, ['A', 'B', 'C', 'D']);
        const mid = rectPoints(midW, midH, ['E', 'F', 'G', 'H']);
        const big = rectPoints(bigW, bigH, ['I', 'J', 'K', 'L']);
        return Object.assign({
          O: { x: cx, y: cy },
          AB: { x1: small.A.x, y1: small.A.y, x2: small.B.x, y2: small.B.y },
          BC: { x1: small.B.x, y1: small.B.y, x2: small.C.x, y2: small.C.y },
          a: { x1: small.C.x, y1: cy, x2: big.K.x, y2: cy }
        }, small, mid, big);
      }
      if (currentGeometry.shape === 'sal-3') {
        function centeredTriangle(ab, bc, ca) {
          const ax = (ab * ab + bc * bc - ca * ca) / (2 * bc);
          const ay = Math.sqrt(Math.max(0, ab * ab - ax * ax));
          const raw = [
            { x: ax, y: -ay },
            { x: 0, y: 0 },
            { x: bc, y: 0 }
          ];
          const centroid = {
            x: (raw[0].x + raw[1].x + raw[2].x) / 3,
            y: (raw[0].y + raw[1].y + raw[2].y) / 3
          };
          return raw.map(function (point) {
            return { x: point.x - centroid.x, y: point.y - centroid.y };
          });
        }
        function trianglePoints(centered, scaleFactor, ids) {
          const result = {};
          ids.forEach(function (id, index) {
            result[id] = {
              x: cx + centered[index].x * scaleFactor * layout.scale,
              y: cy + centered[index].y * scaleFactor * layout.scale
            };
          });
          return result;
        }
        function footOfPerpendicular(point, lineA, lineB) {
          const dx = lineB.x - lineA.x;
          const dy = lineB.y - lineA.y;
          const lengthSq = dx * dx + dy * dy || 1;
          const t = ((point.x - lineA.x) * dx + (point.y - lineA.y) * dy) / lengthSq;
          return { x: lineA.x + dx * t, y: lineA.y + dy * t };
        }
        const centered = centeredTriangle(currentGeometry.AB, currentGeometry.BC, currentGeometry.CA);
        const small = trianglePoints(centered, 1, ['A', 'B', 'C']);
        const mid = trianglePoints(centered, (1 + currentGeometry.bigScale) / 2, ['D', 'E', 'F']);
        const big = trianglePoints(centered, currentGeometry.bigScale, ['G', 'H', 'I']);
        const M = {
          x: (small.A.x + small.C.x) / 2,
          y: (small.A.y + small.C.y) / 2
        };
        const N = footOfPerpendicular(M, big.G, big.I);
        const J = {
          x: (small.B.x + small.C.x) / 2,
          y: (small.B.y + small.C.y) / 2
        };
        const K = footOfPerpendicular(J, big.H, big.I);
        return Object.assign({
          O: { x: cx, y: cy },
          M: M,
          N: N,
          J: J,
          K: K,
          AB: { x1: small.A.x, y1: small.A.y, x2: small.B.x, y2: small.B.y },
          BC: { x1: small.B.x, y1: small.B.y, x2: small.C.x, y2: small.C.y },
          CA: { x1: small.C.x, y1: small.C.y, x2: small.A.x, y2: small.A.y },
          MN: { x1: M.x, y1: M.y, x2: N.x, y2: N.y },
          JK: { x1: J.x, y1: J.y, x2: K.x, y2: K.y },
          DE: { x1: mid.D.x, y1: mid.D.y, x2: mid.E.x, y2: mid.E.y },
          EF: { x1: mid.E.x, y1: mid.E.y, x2: mid.F.x, y2: mid.F.y },
          FD: { x1: mid.F.x, y1: mid.F.y, x2: mid.D.x, y2: mid.D.y },
          GH: { x1: big.G.x, y1: big.G.y, x2: big.H.x, y2: big.H.y },
          HI: { x1: big.H.x, y1: big.H.y, x2: big.I.x, y2: big.I.y },
          IG: { x1: big.I.x, y1: big.I.y, x2: big.G.x, y2: big.G.y }
        }, small, mid, big);
      }
      if (currentGeometry.shape === 'right-triangle-semicircles') {
        const ab = currentGeometry.AB;
        const ac = currentGeometry.AC;
        const bc = currentGeometry.BC;
        const height = currentGeometry.height;
        const scale = layout.scale;
        const centerY = cy + currentGeometry.radiusY * scale * 0.18;
        const B = { x: cx - bc * scale / 2, y: centerY };
        const C = { x: cx + bc * scale / 2, y: centerY };
        const A = {
          x: B.x + (ab * ab / bc) * scale,
          y: centerY - height * scale
        };
        return {
          A: A,
          B: B,
          C: C,
          O: { x: cx, y: centerY },
          AB: { x1: A.x, y1: A.y, x2: B.x, y2: B.y },
          AC: { x1: A.x, y1: A.y, x2: C.x, y2: C.y },
          BC: { x1: B.x, y1: B.y, x2: C.x, y2: C.y }
        };
      }
      if (currentGeometry.shape === 'taijitu') {
        const radius = currentGeometry.AO * layout.scale;
        const O = { x: cx, y: cy };
        return {
          O: O,
          A: { x: cx - radius, y: cy },
          B: { x: cx + radius, y: cy },
          AO: { x1: cx - radius, y1: cy, x2: cx, y2: cy }
        };
      }
      if (currentGeometry.shape === 'square-corner-sectors') {
        return {
          O: { x: cx, y: cy },
          A: { x: cx - rx / 2, y: cy - ry / 2 },
          B: { x: cx + rx / 2, y: cy - ry / 2 },
          C: { x: cx + rx / 2, y: cy + ry / 2 },
          D: { x: cx - rx / 2, y: cy + ry / 2 },
          AB: { x1: cx - rx / 2, y1: cy - ry / 2, x2: cx + rx / 2, y2: cy - ry / 2 },
          BC: { x1: cx + rx / 2, y1: cy - ry / 2, x2: cx + rx / 2, y2: cy + ry / 2 },
          CD: { x1: cx + rx / 2, y1: cy + ry / 2, x2: cx - rx / 2, y2: cy + ry / 2 },
          DA: { x1: cx - rx / 2, y1: cy + ry / 2, x2: cx - rx / 2, y2: cy - ry / 2 }
        };
      }
      if (currentGeometry.shape === 'square-quarter-sector-3' || currentGeometry.shape === 'square-quarter-sector-4' || currentGeometry.shape === 'square-circle-1' || currentGeometry.shape === 'square-circle-2' || currentGeometry.shape === 'square-semicircle-1' || currentGeometry.shape === 'square-semicircle-2') {
        const left = cx - rx / 2;
        const right = cx + rx / 2;
        const top = cy - ry / 2;
        const bottom = cy + ry / 2;
        const points = {
          O: { x: cx, y: cy },
          A: { x: left, y: top },
          B: { x: right, y: top },
          C: { x: right, y: bottom },
          D: { x: left, y: bottom },
          AB: { x1: left, y1: top, x2: right, y2: top }
        };
        if (currentGeometry.shape === 'square-quarter-sector-3') {
          points.P = { x: cx, y: top };
          points.Q = { x: right, y: cy };
          points.R = { x: cx, y: bottom };
          points.S = { x: left, y: cy };
        }
        if (currentGeometry.shape === 'square-circle-2') {
          points.O1 = { x: (left + cx) / 2, y: (top + cy) / 2 };
          points.O2 = { x: (cx + right) / 2, y: (top + cy) / 2 };
          points.O3 = { x: (cx + right) / 2, y: (cy + bottom) / 2 };
          points.O4 = { x: (left + cx) / 2, y: (cy + bottom) / 2 };
        }
        return points;
      }
      if (currentGeometry.shape === 'square-quarter-sector') {
        const sidePx = currentGeometry.side * layout.scale;
        const bpPx = currentGeometry.bp * layout.scale;
        const left = cx - rx / 2;
        const top = cy - ry / 2;
        const bottom = cy + ry / 2;
        return {
          O: { x: cx, y: cy },
          A: { x: left, y: top },
          B: { x: left, y: bottom },
          C: { x: left + sidePx, y: bottom },
          D: { x: left + sidePx, y: top },
          P: { x: left + bpPx, y: bottom },
          AB: { x1: left, y1: top, x2: left, y2: bottom },
          BP: { x1: left, y1: bottom, x2: left + bpPx, y2: bottom }
        };
      }
      return {
        O: { x: cx, y: cy },
        A: { x: cx + rx, y: cy },
        B: B,
        r: { x1: cx, y1: cy, x2: cx + rx, y2: cy },
        a: { x1: cx, y1: cy, x2: cx + rx, y2: cy },
        b: { x1: cx, y1: cy, x2: cx, y2: cy - ry }
      };
    }

    function createLabelNode(label, attrs) {
      const parsed = isRatioLabelValue(label) ? parseRatioLabelInput(String(label).slice(RATIO_LABEL_PREFIX.length)) : null;
      if (!parsed) {
        if (window.InstantGeometrySharedLabels && typeof window.InstantGeometrySharedLabels.createSvgKatexLabel === 'function') {
          const katexNode = window.InstantGeometrySharedLabels.createSvgKatexLabel({
            createSvg: createSvg,
            text: label,
            attrs: attrs,
            kind: attrs['data-label-kind'] || attrs['data-kind'],
            id: attrs['data-label-id'] || attrs['data-id']
          });
          if (katexNode) return katexNode;
        }
        if (window.InstantGeometrySvgLabels && window.InstantGeometrySvgLabels.parseMathLayout && /[\/√_^]|sqrt|pi|π|\\/.test(String(label || ''))) {
          const x = Number(attrs.x) || 0;
          const y = Number(attrs.y) || 0;
          const fontSize = Number(attrs['font-size']) || 42;
          const color = attrs.fill || '#1f2430';
          const layout = window.InstantGeometrySvgLabels.parseMathLayout(stage, String(label), fontSize);
          layout.node.querySelectorAll('.function-rich-label-text').forEach(function (node) {
            node.setAttribute('fill', color);
            node.setAttribute('stroke', '#ffffff');
            node.setAttribute('stroke-width', '7');
            node.setAttribute('stroke-linejoin', 'round');
            node.setAttribute('paint-order', 'stroke');
            node.setAttribute('font-weight', '900');
          });
          layout.node.querySelectorAll('.function-rich-fraction-rule,.function-rich-sqrt-rule,.function-rich-vector-arrow,.function-rich-matrix-bracket').forEach(function (node) {
            node.setAttribute('fill', 'none');
            node.setAttribute('stroke', color);
            node.setAttribute('stroke-width', node.classList.contains('function-rich-sqrt-rule') ? '3.2' : '2.2');
            node.setAttribute('stroke-linecap', 'round');
            node.setAttribute('stroke-linejoin', 'round');
          });
          const group = createSvg('g', {
            class: attrs.class,
            transform: 'translate(' + x + ' ' + y + ')',
            fill: color,
            'data-kind': attrs['data-kind'],
            'data-id': attrs['data-id']
          });
          group.appendChild(layout.node);
          return group;
        }
        const textNode = createSvg('text', attrs);
        textNode.textContent = label;
        return textNode;
      }
      const x = Number(attrs.x) || 0;
      const y = Number(attrs.y) || 0;
      const fontSize = Number(attrs['font-size']) || 42;
      const textWidth = Math.max(fontSize * 0.7, parsed.value.length * fontSize * 0.62);
      const height = fontSize * 1.16;
      const width = parsed.mark === 't'
        ? Math.max(textWidth + fontSize * 0.8, height * 1.25)
        : Math.max(textWidth + fontSize * 0.55, height);
      const group = createSvg('g', {
        class: attrs.class,
        'data-kind': attrs['data-kind'],
        'data-id': attrs['data-id']
      });
      const stroke = '#687086';
      if (parsed.mark === 'r') {
        group.appendChild(createSvg('ellipse', { cx: x, cy: y, rx: width / 2, ry: height / 2, fill: '#ffffff', stroke: stroke, 'stroke-width': 2.3 }));
      } else if (parsed.mark === 't') {
        group.appendChild(createSvg('polygon', {
          points: [x + ',' + (y - height * 0.72), (x - width / 2) + ',' + (y + height * 0.48), (x + width / 2) + ',' + (y + height * 0.48)].join(' '),
          fill: '#ffffff',
          stroke: stroke,
          'stroke-width': 2.3,
          'stroke-linejoin': 'round'
        }));
      } else {
        group.appendChild(createSvg('rect', { x: x - width / 2, y: y - height / 2, width: width, height: height, rx: 5, ry: 5, fill: '#ffffff', stroke: stroke, 'stroke-width': 2.3 }));
      }
      const textNode = createSvg('text', Object.assign({}, attrs, { class: null, 'data-kind': null, 'data-id': null }));
      textNode.textContent = parsed.value;
      group.appendChild(textNode);
      return group;
    }

    function appendText(kind, id, text, x, y, className) {
      if (!text) return;
      const fill = kind === 'area'
        ? areaLabelColor(state.areaColor || '#2a5bd7')
        : (kind === 'measure' ? state.measureColors[id] || '#2a5bd7' : null);
      const pos = getLabelPosition(kind, id, { x: x, y: y });
      const fontSize = Math.round(42 * getLabelScale(kind, id));
      const node = createLabelNode(text, {
        x: pos.x,
        y: pos.y,
        fill: fill,
        class: 'shape-label ' + (className || ''),
        style: 'font-size:' + fontSize + 'px' + (fill ? ';fill:' + fill : ''),
        'font-size': fontSize,
        'data-label-kind': kind,
        'data-label-id': id,
        'data-kind': kind,
        'data-id': id
      });
      if (isMoveTarget(kind, id)) node.classList.add('label-move-target');
      node.addEventListener('pointerdown', function (event) {
        if (!isMoveTarget(kind, id)) return;
        event.preventDefault();
        event.stopPropagation();
        const startPoint = pointerToSvgPoint(event);
        const offset = ensureLabelOffset(kind, id);
        moveDrag = {
          kind: kind,
          id: id,
          startPoint: startPoint,
          startOffset: { x: offset.x, y: offset.y }
        };
      });
      stage.appendChild(node);
    }

    function appendHit(kind, id, node) {
      node.setAttribute('class', (node.getAttribute('class') || '') + ' hit-target');
      node.setAttribute('data-kind', kind);
      node.setAttribute('data-id', id);
      node.addEventListener('click', function (event) {
        if (moveMode) return;
        event.preventDefault();
        event.stopPropagation();
        if (kind === 'area' || kind === 'extraArea') {
          const arcMeasure = arcMeasureAtPoint(pointerToSvgPoint(event));
          if (arcMeasure) {
            openSheet('edit', { kind: 'measure', id: arcMeasure });
            return;
          }
        }
        openSheet('edit', { kind: kind, id: id });
      });
      stage.appendChild(node);
    }

    function appendExtraArea(area) {
      const color = state.extraAreaColors[area.id] || area.color || state.areaColor || '#2a5bd7';
      stage.appendChild(createSvg('path', {
        d: area.path,
        fill: hexToRgba(color, 0.1),
        stroke: 'none',
        'fill-rule': area.fillRule || null
      }));
      appendHit('extraArea', area.id, createSvg('path', {
        d: area.path,
        fill: 'rgba(0,0,0,0.001)',
        stroke: 'none',
        'fill-rule': area.fillRule || null
      }));
    }

    function polygonCentroid(points) {
      if (!points || points.length < 3) return null;
      let twiceArea = 0;
      let cx = 0;
      let cy = 0;
      for (let i = 0; i < points.length; i += 1) {
        const p = points[i];
        const q = points[(i + 1) % points.length];
        const cross = p.x * q.y - q.x * p.y;
        twiceArea += cross;
        cx += (p.x + q.x) * cross;
        cy += (p.y + q.y) * cross;
      }
      if (Math.abs(twiceArea) < 0.001) return null;
      return { x: cx / (3 * twiceArea), y: cy / (3 * twiceArea) };
    }

    function distanceToSegment(point, start, end) {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const lengthSquared = dx * dx + dy * dy;
      if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
      const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
      return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t));
    }

    function minDistanceToPolygon(point, points) {
      if (!points || points.length < 2) return 0;
      let min = Infinity;
      for (let i = 0; i < points.length; i += 1) {
        min = Math.min(min, distanceToSegment(point, points[i], points[(i + 1) % points.length]));
      }
      return Number.isFinite(min) ? min : 0;
    }

    function fittedAreaLabel(area, label) {
      const point = polygonCentroid(area.points) || area.labelPoint;
      const distance = minDistanceToPolygon(point, area.points);
      const textLength = String(label || '').length || 1;
      const widthFactor = Math.max(1.05, textLength * 0.64);
      const fontSize = Math.max(14, Math.min(48, Math.floor((distance * 1.82) / widthFactor)));
      return {
        x: point.x,
        y: point.y,
        fontSize: fontSize
      };
    }

    function renderFittedAreaLabel(kind, id, label, points, color, maxFontSize) {
      if (!label || !points || points.length < 3) return;
      const area = { points: points, labelPoint: polygonCentroid(points) };
      const fitted = fittedAreaLabel(area, label);
      const pos = getLabelPosition(kind, id, fitted);
      const fontSize = Math.min(maxFontSize || 54, fitted.fontSize);
      const fill = areaLabelColor(color || '#2a5bd7');
      const node = createLabelNode(label, {
        x: pos.x,
        y: pos.y,
        fill: fill,
        class: 'shape-label area-label',
        style: 'font-size:' + fontSize + 'px;fill:' + fill,
        'font-size': fontSize,
        'data-label-kind': kind,
        'data-label-id': id,
        'data-kind': kind,
        'data-id': id
      });
      if (isMoveTarget(kind, id)) node.classList.add('label-move-target');
      node.addEventListener('pointerdown', function (event) {
        if (!isMoveTarget(kind, id)) return;
        event.preventDefault();
        event.stopPropagation();
        const startPoint = pointerToSvgPoint(event);
        const offset = ensureLabelOffset(kind, id);
        moveDrag = {
          kind: kind,
          id: id,
          startPoint: startPoint,
          startOffset: { x: offset.x, y: offset.y }
        };
      });
      stage.appendChild(node);
    }

    function extraAreaLabel(area) {
      const raw = String(state.extraAreaInputs[area.id] || '');
      if (!raw) return '';
      if (isRatioLabelValue(raw)) return raw;
      if ((isNumericLabelValue(raw) || isRawNumericLabelValue(raw) || isDecimalNumericLabelValue(raw)) && area.value !== undefined) return formatNumber(area.value);
      return raw;
    }

    function renderExtraAreaLabel(area) {
      const label = extraAreaLabel(area);
      if (!label) return;
      const color = state.extraAreaColors[area.id] || area.color || state.areaColor || '#2a5bd7';
      renderFittedAreaLabel('extraArea', area.id, label, area.points, color, 54);
    }

    function drawAngleDecoration(id, path, arc, vertex, angleValue, edgePoints) {
      let kind = state.angleKinds[id] || 'plain';
      if (window.InstantGeometryMobileAngleOrnaments) {
        const normalized = window.InstantGeometryMobileAngleOrnaments.normalizeAngleKind(kind, angleValue);
        if (normalized !== kind) {
          kind = normalized;
          state.angleKinds[id] = normalized;
        }
      }
      if (kind !== 'hidden' && kind !== 'right') {
        stage.appendChild(createSvg('path', { d: path, class: 'angle-arc' }));
      }
      appendHit('angle', id, createSvg('path', { d: path, class: 'hit-arc' }));
      if (window.InstantGeometryMobileAngleOrnaments) {
        const ornamentCenter = arc[Math.floor(arc.length / 2)] || vertex;
        window.InstantGeometryMobileAngleOrnaments.drawAngleKind(stage, kind, arc, vertex, ornamentCenter, createSvg, edgePoints || {});
      }
    }

    function measureLine(id, points) {
      const source = points[id];
      if (source && Number.isFinite(source.x1)) {
        return {
          P: { x: source.x1, y: source.y1 },
          Q: { x: source.x2, y: source.y2 }
        };
      }
      return null;
    }

    function appendMeasureHit(id, line) {
      appendHit('measure', id, createSvg('line', {
        x1: line.P.x,
        y1: line.P.y,
        x2: line.Q.x,
        y2: line.Q.y,
        class: 'hit-line'
      }));
    }

    function appendMeasureLabel(id, line, labelPoint, points) {
      const rawInput = state.rawControlInputs[id] || state.rawControlInputs[String(id).toLowerCase()];
      const text = textForLabel(
        state.measureInputs[id],
        currentGeometry.measures[id],
        null,
        currentGeometry.measureDisplay && currentGeometry.measureDisplay[id],
        rawInput
      );
      if (!text) return;
      if (state.measureArcVisible[id] !== false) {
        const geom = sideArcGeometry(line.P, line.Q, points.O, labelPoint);
        stage.appendChild(createSvg('path', {
          d: quadraticPathSegment(line.P, geom.control, line.Q, 0, 0.5 - geom.gapHalf),
          class: 'label-arc'
        }));
        stage.appendChild(createSvg('path', {
          d: quadraticPathSegment(line.P, geom.control, line.Q, 0.5 + geom.gapHalf, 1),
          class: 'label-arc'
        }));
      }
      appendText('measure', id, text, labelPoint.x, labelPoint.y, 'measure-label');
    }

    function renderPointLabels(points) {
      const labels = state.pointInputs || {};
      if (currentGeometry && currentGeometry.shape === 'square-corner-sectors') {
        appendText('point', 'A', labels.A, points.A.x - 30, points.A.y - 28, '');
        appendText('point', 'B', labels.B, points.B.x + 30, points.B.y - 28, '');
        appendText('point', 'C', labels.C, points.C.x + 30, points.C.y + 28, '');
        appendText('point', 'D', labels.D, points.D.x - 30, points.D.y + 28, '');
        return;
      }
      if (currentGeometry && currentGeometry.shape === 'square-quarter-sector-3') {
        return;
      }
      if (currentGeometry && currentGeometry.shape === 'square-quarter-sector-4') {
        appendText('point', 'A', labels.A, points.A.x - 30, points.A.y - 28, '');
        appendText('point', 'B', labels.B, points.B.x + 30, points.B.y - 28, '');
        appendText('point', 'C', labels.C, points.C.x + 30, points.C.y + 28, '');
        appendText('point', 'D', labels.D, points.D.x - 30, points.D.y + 28, '');
        return;
      }
      if (currentGeometry && currentGeometry.shape === 'square-circle-1') {
        appendText('point', 'A', labels.A, points.A.x - 30, points.A.y - 28, '');
        appendText('point', 'B', labels.B, points.B.x + 30, points.B.y - 28, '');
        appendText('point', 'C', labels.C, points.C.x + 30, points.C.y + 28, '');
        appendText('point', 'D', labels.D, points.D.x - 30, points.D.y + 28, '');
        appendText('point', 'O', labels.O, points.O.x + 34, points.O.y - 30, '');
        return;
      }
      if (currentGeometry && currentGeometry.shape === 'square-circle-2') {
        return;
      }
      if (currentGeometry && currentGeometry.shape === 'square-semicircle-1') {
        appendText('point', 'A', labels.A, points.A.x - 30, points.A.y - 28, '');
        appendText('point', 'B', labels.B, points.B.x + 30, points.B.y - 28, '');
        appendText('point', 'C', labels.C, points.C.x + 30, points.C.y + 28, '');
        appendText('point', 'D', labels.D, points.D.x - 30, points.D.y + 28, '');
        appendText('point', 'O', labels.O, points.O.x + 34, points.O.y - 30, '');
        return;
      }
      if (currentGeometry && currentGeometry.shape === 'square-semicircle-2') {
        appendText('point', 'A', labels.A, points.A.x - 30, points.A.y - 28, '');
        appendText('point', 'B', labels.B, points.B.x + 30, points.B.y - 28, '');
        appendText('point', 'C', labels.C, points.C.x + 30, points.C.y + 28, '');
        appendText('point', 'D', labels.D, points.D.x - 30, points.D.y + 28, '');
        appendText('point', 'O', labels.O, points.O.x + 34, points.O.y - 30, '');
        return;
      }
      if (currentGeometry && currentGeometry.shape === 'square-quarter-sector') {
        appendText('point', 'A', labels.A, points.A.x - 30, points.A.y - 28, '');
        appendText('point', 'B', labels.B, points.B.x - 30, points.B.y + 28, '');
        appendText('point', 'C', labels.C, points.C.x + 30, points.C.y + 28, '');
        appendText('point', 'D', labels.D, points.D.x + 30, points.D.y - 28, '');
        appendText('point', 'P', labels.P, points.P.x, points.P.y + 34, '');
        if (points.E) appendText('point', 'E', labels.E, points.E.x + 28, points.E.y - 24, '');
        return;
      }
      if (currentGeometry && currentGeometry.shape === 'circle-n-points') {
        appendText('point', 'O', labels.O, points.O.x - 52, points.O.y - 32, '');
        const radius = currentGeometry.radiusX * fitGeometry(currentGeometry.radiusX, currentGeometry.radiusY).scale;
        currentGeometry.pointIds.forEach(function (id) {
          if (!points[id]) return;
          const dx = points[id].x - points.O.x;
          const dy = points[id].y - points.O.y;
          const length = Math.hypot(dx, dy) || 1;
          const offset = Math.min(42, radius * 0.11);
          appendText('point', id, labels[id], points[id].x + dx / length * offset, points[id].y + dy / length * offset, '');
        });
        return;
      }
      if (currentGeometry && currentGeometry.shape === 'two-circles') {
        appendText('point', 'O', labels.O, points.O.x - 38, points.O.y + 36, '');
        appendText('point', 'Op', labels.Op, points.Op.x + 42, points.Op.y + 36, '');
        return;
      }
      if (currentGeometry && currentGeometry.shape === 'inscribed-angle-application-1') {
        appendText('point', 'O', labels.O, points.O.x + 34, points.O.y - 30, '');
        appendText('point', 'P', labels.P, points.P.x - 30, points.P.y + 24, '');
        appendText('point', 'A', labels.A, points.A.x + 28, points.A.y + 24, '');
        appendText('point', 'B', labels.B, points.B.x + 28, points.B.y - 22, '');
        appendText('point', 'C', labels.C, points.C.x + 28, points.C.y - 24, '');
        appendText('point', 'D', labels.D, points.D.x + 28, points.D.y - 24, '');
        appendText('point', 'E', labels.E, points.E.x - 30, points.E.y - 26, '');
        return;
      }
      if (currentGeometry && currentGeometry.shape === 'inscribed-angle-application-2') {
        appendText('point', 'O', labels.O, points.O.x + 28, points.O.y - 28, '');
        appendText('point', 'P', labels.P, points.P.x - 32, points.P.y + 28, '');
        appendText('point', 'A', labels.A, points.A.x - 26, points.A.y - 28, '');
        appendText('point', 'B', labels.B, points.B.x - 26, points.B.y + 34, '');
        appendText('point', 'C', labels.C, points.C.x + 34, points.C.y + 6, '');
        return;
      }
      if (currentGeometry && currentGeometry.shape === 'inscribed-angle-application-3') {
        appendText('point', 'O', labels.O, points.O.x - 4, points.O.y - 32, '');
        appendText('point', 'B', labels.B, points.B.x - 34, points.B.y + 8, '');
        appendText('point', 'A', labels.A, points.A.x - 26, points.A.y - 30, '');
        appendText('point', 'E', labels.E, points.E.x + 26, points.E.y - 30, '');
        appendText('point', 'D', labels.D, points.D.x + 34, points.D.y + 8, '');
        appendText('point', 'C', labels.C, points.C.x + 18, points.C.y + 36, '');
        return;
      }
      if (currentGeometry && currentGeometry.shape === 'inscribed-angle-application-5') {
        appendText('point', 'O', labels.O, points.O.x - 4, points.O.y - 32, '');
        appendText('point', 'B', labels.B, points.B.x - 34, points.B.y + 8, '');
        appendText('point', 'A', labels.A, points.A.x - 26, points.A.y - 30, '');
        appendText('point', 'F', labels.F, points.F.x, points.F.y - 36, '');
        appendText('point', 'E', labels.E, points.E.x + 26, points.E.y - 30, '');
        appendText('point', 'D', labels.D, points.D.x + 34, points.D.y + 8, '');
        appendText('point', 'C', labels.C, points.C.x + 18, points.C.y + 36, '');
        return;
      }
      if (currentGeometry && currentGeometry.shape === 'inscribed-angle-application-4') {
        appendText('point', 'O', labels.O, points.O.x - 10, points.O.y - 32, '');
        appendText('point', 'A', labels.A, points.A.x - 26, points.A.y - 30, '');
        appendText('point', 'B', labels.B, points.B.x - 26, points.B.y + 34, '');
        appendText('point', 'C', labels.C, points.C.x + 34, points.C.y + 6, '');
        return;
      }
      appendText('point', 'O', labels.O, points.O.x - 52, points.O.y - 32, '');
      if (points.A && Object.prototype.hasOwnProperty.call(labels, 'A')) {
        appendText('point', 'A', labels.A, points.A.x + 28, points.A.y + 20, '');
      }
      if (points.B && Object.prototype.hasOwnProperty.call(labels, 'B')) {
        appendText('point', 'B', labels.B, points.B.x + 28, points.B.y - 20, '');
      }
      if (points.C && Object.prototype.hasOwnProperty.call(labels, 'C')) {
        const offset = currentGeometry && currentGeometry.shape === 'quarter-two-semicircles'
          ? { x: 30, y: -10 }
          : { x: 28, y: -28 };
        appendText('point', 'C', labels.C, points.C.x + offset.x, points.C.y + offset.y, '');
      }
      if (points.D && Object.prototype.hasOwnProperty.call(labels, 'D')) {
        appendText('point', 'D', labels.D, points.D.x + 28, points.D.y - 28, '');
      }
      if (points.P && Object.prototype.hasOwnProperty.call(labels, 'P')) {
        appendText('point', 'P', labels.P, points.P.x - 28, points.P.y + 22, '');
      }
      if (points.Q && Object.prototype.hasOwnProperty.call(labels, 'Q')) {
        appendText('point', 'Q', labels.Q, points.Q.x + 28, points.Q.y + 22, '');
      }
    }

    function renderTwoCircles(layout, points) {
      const radiusO = currentGeometry.radiusO * layout.scale;
      const radiusOp = currentGeometry.radiusOp * layout.scale;
      stage.appendChild(createSvg('circle', {
        cx: points.O.x,
        cy: points.O.y,
        r: radiusO,
        fill: areaShapeFill(0.08),
        class: 'shape-fill'
      }));
      stage.appendChild(createSvg('circle', {
        cx: points.Op.x,
        cy: points.Op.y,
        r: radiusOp,
        fill: areaShapeFill(0.05),
        class: 'shape-fill'
      }));
      if (showArea) {
        appendHit('area', 'main', createSvg('path', {
          d: [
            'M', points.O.x - radiusO, points.O.y,
            'a', radiusO, radiusO, 0, 1, 0, radiusO * 2, 0,
            'a', radiusO, radiusO, 0, 1, 0, -radiusO * 2, 0,
            'M', points.Op.x - radiusOp, points.Op.y,
            'a', radiusOp, radiusOp, 0, 1, 0, radiusOp * 2, 0,
            'a', radiusOp, radiusOp, 0, 1, 0, -radiusOp * 2, 0
          ].join(' ')
        }));
      }

      ['rO', 'rOp', 'OO'].forEach(function (id) {
        const line = measureLine(id, points);
        stage.appendChild(createSvg('line', { x1: line.P.x, y1: line.P.y, x2: line.Q.x, y2: line.Q.y, class: 'axis-line' }));
        appendMeasureHit(id, line);
        drawSideKind(stage, state.measureKinds[id], line.P, line.Q);
      });
      appendMeasureLabel('rO', measureLine('rO', points), { x: (points.rO.x1 + points.rO.x2) / 2, y: points.rO.y1 + 34 }, points);
      appendMeasureLabel('rOp', measureLine('rOp', points), { x: (points.rOp.x1 + points.rOp.x2) / 2, y: points.rOp.y1 + 34 }, points);
      appendMeasureLabel('OO', measureLine('OO', points), { x: (points.OO.x1 + points.OO.x2) / 2, y: points.OO.y1 - 42 }, points);

      ['O', 'Op', 'A', 'B'].forEach(function (id) {
        if (!points[id]) return;
        stage.appendChild(createSvg('circle', {
          cx: points[id].x,
          cy: points[id].y,
          r: id === 'O' || id === 'Op' ? 8 : 7,
          class: id === 'O' || id === 'Op' ? 'center-point' : 'curve-point'
        }));
      });
      appendHit('point', 'O', createSvg('circle', { cx: points.O.x, cy: points.O.y, r: 30 }));
      appendHit('point', 'Op', createSvg('circle', { cx: points.Op.x, cy: points.Op.y, r: 30 }));
      renderPointLabels(points);
      if (showArea) {
        const labelY = points.O.y - Math.max(radiusO, radiusOp) - 52;
        appendText('area', 'main', textForLabel(state.areaInput, currentGeometry.area), (points.O.x + points.Op.x) / 2, labelY, 'area-label');
      }
    }

    function renderFullConic(layout, points, rx, ry) {
      stage.appendChild(createSvg('ellipse', {
        cx: layout.cx,
        cy: layout.cy,
        rx: rx,
        ry: ry,
        fill: areaShapeFill(0.08),
        class: 'shape-fill'
      }));
      if (showArea) {
        appendHit('area', 'main', createSvg('ellipse', {
          cx: layout.cx,
          cy: layout.cy,
          rx: rx,
          ry: ry
        }));
      }

      if (currentGeometry.shape === 'ellipse') {
        const aLine = measureLine('a', points);
        const bLine = measureLine('b', points);
        stage.appendChild(createSvg('line', { x1: aLine.P.x, y1: aLine.P.y, x2: aLine.Q.x, y2: aLine.Q.y, class: 'axis-line' }));
        stage.appendChild(createSvg('line', { x1: bLine.P.x, y1: bLine.P.y, x2: bLine.Q.x, y2: bLine.Q.y, class: 'axis-line' }));
        appendMeasureHit('a', aLine);
        appendMeasureHit('b', bLine);
        drawSideKind(stage, state.measureKinds.a, aLine.P, aLine.Q);
        drawSideKind(stage, state.measureKinds.b, bLine.P, bLine.Q);
        appendMeasureLabel('a', aLine, { x: (aLine.P.x + aLine.Q.x) / 2, y: aLine.P.y + 34 }, points);
        appendMeasureLabel('b', bLine, { x: bLine.Q.x - 34, y: (bLine.P.y + bLine.Q.y) / 2 }, points);
      } else {
        const rLine = measureLine('r', points);
        stage.appendChild(createSvg('line', { x1: rLine.P.x, y1: rLine.P.y, x2: rLine.Q.x, y2: rLine.Q.y, class: 'axis-line' }));
        appendMeasureHit('r', rLine);
        drawSideKind(stage, state.measureKinds.r, rLine.P, rLine.Q);
        appendMeasureLabel('r', rLine, { x: (rLine.P.x + rLine.Q.x) / 2, y: rLine.P.y + 34 }, points);
      }

      stage.appendChild(createSvg('circle', { cx: points.O.x, cy: points.O.y, r: 8, class: 'center-point' }));
      if (currentGeometry.shape === 'ellipse') {
        stage.appendChild(createSvg('circle', { cx: points.A.x, cy: points.A.y, r: 8, class: 'curve-point' }));
        stage.appendChild(createSvg('circle', { cx: points.b.x2, cy: points.b.y2, r: 8, class: 'curve-point' }));
      } else {
        stage.appendChild(createSvg('circle', { cx: points.A.x, cy: points.A.y, r: 8, class: 'curve-point' }));
      }
      appendHit('point', 'O', createSvg('circle', { cx: points.O.x, cy: points.O.y, r: 30 }));
      renderPointLabels(points);
      if (showArea) {
        renderFittedAreaLabel(
          'area',
          'main',
          textForLabel(state.areaInput, currentGeometry.area),
          ellipseArcPoints(layout, currentGeometry.radiusX, currentGeometry.radiusY, Math.PI * 2),
          state.areaColor || '#2a5bd7',
          58
        );
      }
    }

    function renderSector(layout, points) {
      const theta = currentGeometry.angleRadians;
      const path = sectorPath(layout, currentGeometry.radiusX, currentGeometry.radiusY, theta);
      const arcPoints = ellipseArcPoints(layout, currentGeometry.radiusX, currentGeometry.radiusY, theta);
      const arc = linePath(arcPoints);
      const angleRadius = Math.min(currentGeometry.radiusX, currentGeometry.radiusY) * layout.scale * 0.24;
      const angleArc = circleArcPoints(layout.cx, layout.cy, angleRadius, 0, theta);
      const anglePath = linePath(angleArc);
      const half = theta / 2;
      const halfPoint = pointOnEllipse(layout, currentGeometry.radiusX * 0.52, currentGeometry.radiusY * 0.52, half);
      const anglePoint = pointOnEllipse(layout, currentGeometry.radiusX * 0.22, currentGeometry.radiusY * 0.22, half);
      const arcLabelPoint = pointOnEllipse(layout, currentGeometry.radiusX * 1.03, currentGeometry.radiusY * 1.03, half);
      const measureKey = currentGeometry.shape === 'sector' ? 'r' : 'a';

      stage.appendChild(createSvg('path', { d: path, fill: areaShapeFill(0.08), class: 'sector-fill' }));
      if (showArea) appendHit('area', 'main', createSvg('path', { d: path }));
      stage.appendChild(createSvg('line', { x1: points.O.x, y1: points.O.y, x2: points.A.x, y2: points.A.y, class: 'axis-line' }));
      stage.appendChild(createSvg('line', { x1: points.O.x, y1: points.O.y, x2: points.B.x, y2: points.B.y, class: 'axis-line' }));
      if (currentGeometry.shape === 'ellipse-sector') {
        stage.appendChild(createSvg('line', { x1: points.b.x1, y1: points.b.y1, x2: points.b.x2, y2: points.b.y2, class: 'axis-line' }));
      }
      stage.appendChild(createSvg('path', { d: arc, class: 'arc-line' }));
      drawCurveKind(stage, state.measureKinds.arcAB, arcPoints);
      drawAngleDecoration('AOB', anglePath, angleArc, points.O, currentGeometry.angleDegrees, { p1: points.A, p2: points.B });

      appendHit('point', 'O', createSvg('circle', { cx: points.O.x, cy: points.O.y, r: 30 }));
      appendHit('point', 'A', createSvg('circle', { cx: points.A.x, cy: points.A.y, r: 30 }));
      appendHit('point', 'B', createSvg('circle', { cx: points.B.x, cy: points.B.y, r: 30 }));
      const primaryLine = { P: points.O, Q: points.A };
      appendMeasureHit(measureKey, primaryLine);
      drawSideKind(stage, state.measureKinds[measureKey], primaryLine.P, primaryLine.Q);
      if (currentGeometry.shape === 'ellipse-sector') {
        const bLineForHit = measureLine('b', points);
        appendMeasureHit('b', bLineForHit);
        drawSideKind(stage, state.measureKinds.b, bLineForHit.P, bLineForHit.Q);
      }
      appendHit('measure', 'arcAB', createSvg('path', { d: arc, class: 'hit-measure-arc' }));

      ['O', 'A', 'B'].forEach(function (id) {
        stage.appendChild(createSvg('circle', {
          cx: points[id].x,
          cy: points[id].y,
          r: 8,
          class: id === 'O' ? 'center-point' : 'curve-point'
        }));
      });
      renderPointLabels(points);
      appendMeasureLabel(measureKey, primaryLine, { x: (points.O.x + points.A.x) / 2, y: points.O.y + 34 }, points);
      if (currentGeometry.shape === 'ellipse-sector') {
        const bLine = measureLine('b', points);
        appendMeasureLabel('b', bLine, { x: points.O.x - 34, y: points.O.y - currentGeometry.radiusY * layout.scale / 2 }, points);
      }
      appendText('measure', 'arcAB', textForLabel(state.measureInputs.arcAB, currentGeometry.measures.arcAB || '', formatNumber), arcLabelPoint.x, arcLabelPoint.y, 'arc-label');
      appendText('angle', 'AOB', textForLabel(state.angleInputs.AOB, currentGeometry.angleDegrees, formatAngle), anglePoint.x, anglePoint.y, 'angle-label');
      if (showArea) {
        renderFittedAreaLabel('area', 'main', textForLabel(state.areaInput, currentGeometry.area), [points.O, points.A].concat(arcPoints).concat([points.B]), state.areaColor || '#2a5bd7', 58);
      }
    }

    function renderQuarterTwoSemicircles(layout, points) {
      const theta = currentGeometry.angleRadians;
      const path = sectorPath(layout, currentGeometry.radiusX, currentGeometry.radiusY, theta);
      const arcPoints = ellipseArcPoints(layout, currentGeometry.radiusX, currentGeometry.radiusY, theta);
      const arc = linePath(arcPoints);
      const angleRadius = currentGeometry.radiusX * layout.scale * 0.22;
      const angleArc = circleArcPoints(layout.cx, layout.cy, angleRadius, 0, theta);
      const anglePath = linePath(angleArc);
      const halfPoint = pointOnEllipse(layout, currentGeometry.radiusX * 0.54, currentGeometry.radiusY * 0.54, theta / 2);
      const anglePoint = pointOnEllipse(layout, currentGeometry.radiusX * 0.18, currentGeometry.radiusY * 0.18, theta / 2);
      const arcLabelPoint = pointOnEllipse(layout, currentGeometry.radiusX * 1.05, currentGeometry.radiusY * 1.05, theta / 2);
      const oaArcPoints = semicircleArcPoints(points.O, points.A, points.B);
      const obArcPoints = semicircleArcPoints(points.O, points.B, points.A);
      const oaSemicircle = linePath(oaArcPoints);
      const obSemicircle = linePath(obArcPoints);
      const oaLine = { P: points.O, Q: points.A };
      const obLine = { P: points.O, Q: points.B };
      const oaArcLabelPoint = oaArcPoints[Math.floor(oaArcPoints.length / 2)] || midpoint(points.O, points.A);
      const obArcLabelPoint = obArcPoints[Math.floor(obArcPoints.length / 2)] || midpoint(points.O, points.B);
      const oaMidIndex = Math.floor(oaArcPoints.length / 2);
      const obMidIndex = Math.floor(obArcPoints.length / 2);
      const oaFirst = oaArcPoints.slice(0, oaMidIndex + 1);
      const oaSecond = oaArcPoints.slice(oaMidIndex);
      const obFirst = obArcPoints.slice(0, obMidIndex + 1);
      const obSecond = obArcPoints.slice(obMidIndex);
      const radius = currentGeometry.radiusX;
      const lensArea = radius * radius * (Math.PI / 8 - 1 / 4);
      const crescentArea = Math.PI * radius * radius / 8 - lensArea;
      const outerArcBA = arcPoints.slice().reverse();
      const leftCrescentPoints = [points.O, points.B].concat(obSecond.slice().reverse()).concat(oaFirst.slice().reverse());
      const centerLensPoints = oaFirst.concat(obFirst.slice().reverse());
      const lowerCrescentPoints = [points.O, points.A].concat(oaSecond.slice().reverse()).concat(obFirst.slice().reverse());
      const outerRegionPoints = obSecond.concat(outerArcBA).concat(oaSecond.slice().reverse());
      currentGeometry.extraAreas = [
        {
          id: 'left-crescent',
          name: '左半月',
          path: linePath(leftCrescentPoints) + ' Z',
          points: leftCrescentPoints,
          labelPoint: { x: points.O.x + radius * layout.scale * 0.16, y: points.O.y - radius * layout.scale * 0.52 },
          value: crescentArea
        },
        {
          id: 'center-lens',
          name: '中央レンズ',
          path: linePath(centerLensPoints) + ' Z',
          points: centerLensPoints,
          labelPoint: { x: points.C.x - radius * layout.scale * 0.09, y: points.C.y + radius * layout.scale * 0.09 },
          value: lensArea
        },
        {
          id: 'lower-crescent',
          name: '下半月',
          path: linePath(lowerCrescentPoints) + ' Z',
          points: lowerCrescentPoints,
          labelPoint: { x: points.O.x + radius * layout.scale * 0.52, y: points.O.y - radius * layout.scale * 0.16 },
          value: crescentArea
        },
        {
          id: 'outer-region',
          name: '外側領域',
          path: linePath(outerRegionPoints) + ' Z',
          points: outerRegionPoints,
          labelPoint: { x: points.O.x + radius * layout.scale * 0.68, y: points.O.y - radius * layout.scale * 0.68 },
          value: lensArea
        }
      ];

      stage.appendChild(createSvg('path', { d: path, fill: areaShapeFill(0.08), class: 'sector-fill' }));
      if (showArea) appendHit('area', 'main', createSvg('path', { d: path }));
      currentGeometry.extraAreas.forEach(appendExtraArea);
      stage.appendChild(createSvg('line', { x1: points.O.x, y1: points.O.y, x2: points.A.x, y2: points.A.y, class: 'axis-line' }));
      stage.appendChild(createSvg('line', { x1: points.O.x, y1: points.O.y, x2: points.B.x, y2: points.B.y, class: 'axis-line' }));
      stage.appendChild(createSvg('path', { d: arc, class: 'arc-line' }));
      stage.appendChild(createSvg('path', { d: oaSemicircle, class: 'semicircle-line' }));
      stage.appendChild(createSvg('path', { d: obSemicircle, class: 'semicircle-line' }));
      drawAngleDecoration('AOB', anglePath, angleArc, points.O, currentGeometry.angleDegrees, { p1: points.A, p2: points.B });

      appendHit('point', 'O', createSvg('circle', { cx: points.O.x, cy: points.O.y, r: 30 }));
      appendHit('point', 'A', createSvg('circle', { cx: points.A.x, cy: points.A.y, r: 30 }));
      appendHit('point', 'B', createSvg('circle', { cx: points.B.x, cy: points.B.y, r: 30 }));
      appendHit('point', 'C', createSvg('circle', { cx: points.C.x, cy: points.C.y, r: 30 }));
      appendMeasureHit('OA', oaLine);
      appendMeasureHit('OB', obLine);
      appendHit('measure', 'arcOA', createSvg('path', { d: oaSemicircle, class: 'hit-measure-arc' }));
      appendHit('measure', 'arcOB', createSvg('path', { d: obSemicircle, class: 'hit-measure-arc' }));
      drawSideKind(stage, state.measureKinds.OA, oaLine.P, oaLine.Q);
      drawSideKind(stage, state.measureKinds.OB, obLine.P, obLine.Q);
      appendHit('measure', 'arcAB', createSvg('path', { d: arc, class: 'hit-measure-arc' }));

      ['O', 'A', 'B', 'C'].forEach(function (id) {
        stage.appendChild(createSvg('circle', {
          cx: points[id].x,
          cy: points[id].y,
          r: 8,
          class: id === 'O' ? 'center-point' : 'curve-point'
        }));
      });
      drawCurveKind(stage, state.measureKinds.arcAB, arcPoints);
      drawCurveKind(stage, state.measureKinds.arcOA, oaArcPoints);
      drawCurveKind(stage, state.measureKinds.arcOB, obArcPoints);
      renderPointLabels(points);
      appendMeasureLabel('OA', oaLine, { x: (points.O.x + points.A.x) / 2, y: points.O.y + 34 }, points);
      appendMeasureLabel('OB', obLine, { x: points.O.x - 34, y: (points.O.y + points.B.y) / 2 }, points);
      appendMeasureLabel('arcOA', oaLine, { x: oaArcLabelPoint.x, y: oaArcLabelPoint.y + 34 }, points);
      appendMeasureLabel('arcOB', obLine, { x: obArcLabelPoint.x + 34, y: obArcLabelPoint.y }, points);
      appendText('measure', 'arcAB', textForLabel(state.measureInputs.arcAB, currentGeometry.measures.arcAB, formatNumber), arcLabelPoint.x, arcLabelPoint.y, 'arc-label');
      appendText('angle', 'AOB', textForLabel(state.angleInputs.AOB, currentGeometry.angleDegrees, formatAngle), anglePoint.x, anglePoint.y, 'angle-label');
      if (showArea) renderFittedAreaLabel('area', 'main', textForLabel(state.areaInput, currentGeometry.area), [points.O, points.A].concat(arcPoints).concat([points.B]), state.areaColor || '#2a5bd7', 58);
      currentGeometry.extraAreas.forEach(renderExtraAreaLabel);
    }

    function renderSemicircleAndCircle(layout, points) {
      const radius = currentGeometry.radius * layout.scale;
      const smallRadius = radius / 2;
      const smallCenter = points.M;
      const largeLeftArc = circleArcPoints(points.O.x, points.O.y, radius, Math.PI, -Math.PI / 2);
      const largeRightArc = circleArcPoints(points.O.x, points.O.y, radius, Math.PI / 2, -Math.PI / 2);
      const largeArc = largeLeftArc.concat(dropFirst(largeRightArc));
      const smallCircle = circleArcPoints(smallCenter.x, smallCenter.y, smallRadius, 0, Math.PI * 2);
      const smallLeftArc = circleArcPoints(smallCenter.x, smallCenter.y, smallRadius, Math.PI / 2, Math.PI);
      const smallRightArc = circleArcPoints(smallCenter.x, smallCenter.y, smallRadius, Math.PI * 3 / 2, Math.PI);
      const leftRegion = [points.O, points.A].concat(dropFirst(largeLeftArc)).concat(dropFirst(smallLeftArc));
      const rightRegion = [points.O].concat(dropFirst(smallRightArc)).concat(dropFirst(largeRightArc)).concat([points.B]);
      const centerRegion = smallCircle;
      const sideArea = Math.PI * currentGeometry.radius * currentGeometry.radius / 8;
      const circleArea = Math.PI * currentGeometry.radius * currentGeometry.radius / 4;
      const angleArc = circleArcPoints(points.O.x, points.O.y, radius * 0.2, Math.PI / 2, Math.PI / 2);
      const anglePath = linePath(angleArc);
      const anglePoint = angleLabelPoint(points.O, points.C, points.A, radius * 0.3);

      currentGeometry.extraAreas = [
        {
          id: 'left-region',
          name: '左の領域',
          color: '#2a5bd7',
          path: linePath(leftRegion) + ' Z',
          points: leftRegion,
          value: sideArea
        },
        {
          id: 'center-circle',
          name: '中央の円',
          color: '#ffffff',
          path: linePath(centerRegion) + ' Z',
          points: centerRegion,
          value: circleArea
        },
        {
          id: 'right-region',
          name: '右の領域',
          color: '#2a5bd7',
          path: linePath(rightRegion) + ' Z',
          points: rightRegion,
          value: sideArea
        }
      ];

      currentGeometry.extraAreas.forEach(appendExtraArea);
      stage.appendChild(createSvg('path', { d: linePath(largeArc), class: 'arc-line' }));
      stage.appendChild(createSvg('path', { d: linePath(smallCircle) + ' Z', class: 'semicircle-line' }));
      stage.appendChild(createSvg('line', {
        x1: points.A.x,
        y1: points.A.y,
        x2: points.B.x,
        y2: points.B.y,
        class: 'axis-line'
      }));
      stage.appendChild(createSvg('line', {
        x1: points.O.x,
        y1: points.O.y,
        x2: points.C.x,
        y2: points.C.y,
        class: 'axis-line dashed-semicircle-line'
      }));
      drawAngleDecoration('COA', anglePath, angleArc, points.O, 90, { p1: points.C, p2: points.A });

      appendHit('point', 'A', createSvg('circle', { cx: points.A.x, cy: points.A.y, r: 30 }));
      appendHit('point', 'B', createSvg('circle', { cx: points.B.x, cy: points.B.y, r: 30 }));
      appendHit('point', 'C', createSvg('circle', { cx: points.C.x, cy: points.C.y, r: 30 }));
      appendHit('point', 'O', createSvg('circle', { cx: points.O.x, cy: points.O.y, r: 30 }));
      appendMeasureHit('OA', { P: points.O, Q: points.A });
      appendMeasureHit('OB', { P: points.O, Q: points.B });
      appendMeasureHit('OC', { P: points.O, Q: points.C });
      appendMeasureHit('AB', { P: points.A, Q: points.B });
      drawSideKind(stage, state.measureKinds.OA, points.O, points.A);
      drawSideKind(stage, state.measureKinds.OB, points.O, points.B);
      drawSideKind(stage, state.measureKinds.OC, points.O, points.C);
      drawSideKind(stage, state.measureKinds.AB, points.A, points.B);

      ['A', 'B', 'C', 'O'].forEach(function (id) {
        stage.appendChild(createSvg('circle', {
          cx: points[id].x,
          cy: points[id].y,
          r: 8,
          class: id === 'O' ? 'center-point' : 'curve-point'
        }));
      });
      renderPointLabels(points);
      appendMeasureLabel('OA', { P: points.O, Q: points.A }, { x: (points.A.x + points.O.x) / 2, y: points.O.y + 34 }, points);
      appendMeasureLabel('OB', { P: points.O, Q: points.B }, { x: (points.O.x + points.B.x) / 2, y: points.O.y + 34 }, points);
      appendMeasureLabel('OC', { P: points.O, Q: points.C }, { x: points.O.x + 36, y: (points.O.y + points.C.y) / 2 }, points);
      appendMeasureLabel('AB', { P: points.A, Q: points.B }, { x: points.O.x, y: points.O.y + 68 }, points);
      appendText('angle', 'COA', textForLabel(state.angleInputs.COA, 90, formatAngle), anglePoint.x, anglePoint.y, 'angle-label');
      currentGeometry.extraAreas.forEach(renderExtraAreaLabel);
    }

    function renderAreaAddSubtract3(layout, points) {
      const color = '#2a5bd7';
      const length = currentGeometry.AB * layout.scale;
      const radius = length / 2;
      const angle = currentGeometry.angleRadians;
      const pCenter = midpoint(points.A, points.B);
      const qCenter = midpoint(points.A, points.Bp);
      const qSide = {
        x: qCenter.x - radius * Math.sin(angle),
        y: qCenter.y - radius * Math.cos(angle)
      };
      const pArc = semicircleArcThroughSide(points.A, points.B, { x: pCenter.x, y: pCenter.y - radius });
      const qArc = semicircleArcThroughSide(points.A, points.Bp, qSide);
      const pAtC = splitArcAtPoint(pArc, points.C);
      const bbArc = circleArcPoints(points.A.x, points.A.y, length, 0, angle);

      function makePath(pathPoints) {
        return linePath(pathPoints) + ' Z';
      }

      function areaValue(pathPoints) {
        let sum = 0;
        for (let i = 0; i < pathPoints.length; i += 1) {
          const p = pathPoints[i];
          const q = pathPoints[(i + 1) % pathPoints.length];
          sum += p.x * q.y - q.x * p.y;
        }
        return Math.abs(sum) / 2 / (layout.scale * layout.scale);
      }

      function region(id, name, fillColor, pathPoints) {
        return {
          id: id,
          name: name,
          color: fillColor,
          path: makePath(pathPoints),
          points: pathPoints,
          value: areaValue(pathPoints)
        };
      }

      const abc = [points.A, points.B].concat(pAtC.after.slice().reverse()).concat([points.C]);
      const bpca = [points.C, points.Bp].concat(qArc.slice().reverse()).concat(pAtC.before);
      const bbpc = bbArc.concat([points.C]).concat(pAtC.after);
      const ac = [points.A, points.C].concat(pAtC.before.slice().reverse());

      currentGeometry.extraAreas = [
        region('abc-white', 'ABC', '#ffffff', abc),
        region('acd-blue', "B'CA", color, bpca),
        region('cbp-blue', "BB'C", color, bbpc),
        region('outer-white', 'AC', '#ffffff', ac)
      ];

      currentGeometry.extraAreas.forEach(appendExtraArea);
      stage.appendChild(createSvg('line', {
        x1: points.A.x,
        y1: points.A.y,
        x2: points.B.x,
        y2: points.B.y,
        class: 'axis-line'
      }));
      stage.appendChild(createSvg('path', {
        d: linePath(pArc),
        class: 'semicircle-line'
      }));
      stage.appendChild(createSvg('line', {
        x1: points.A.x,
        y1: points.A.y,
        x2: points.Bp.x,
        y2: points.Bp.y,
        class: 'axis-line dashed-semicircle-line'
      }));
      stage.appendChild(createSvg('path', {
        d: linePath(qArc),
        class: 'semicircle-line dashed-semicircle-line'
      }));
      stage.appendChild(createSvg('path', {
        d: linePath(bbArc),
        class: 'arc-line'
      }));

      appendHit('measure', 'AB', createSvg('line', {
        x1: points.A.x,
        y1: points.A.y,
        x2: points.B.x,
        y2: points.B.y,
        class: 'hit-line'
      }));
      drawSideKind(stage, state.measureKinds.AB, points.A, points.B);

      ['A', 'B', 'Bp', 'C'].forEach(function (id) {
        const point = points[id];
        appendHit('point', id, createSvg('circle', { cx: point.x, cy: point.y, r: 30 }));
        stage.appendChild(createSvg('circle', {
          cx: point.x,
          cy: point.y,
          r: 8,
          class: 'curve-point'
        }));
      });

      const abLine = { P: points.A, Q: points.B };
      appendMeasureLabel('AB', abLine, { x: (points.A.x + points.B.x) / 2, y: points.A.y + 42 }, points);
      const labels = state.pointInputs || {};
      appendText('point', 'A', labels.A, points.A.x - 34, points.A.y + 30, '');
      appendText('point', 'B', labels.B, points.B.x + 34, points.B.y + 30, '');
      appendText('point', 'Bp', labels.Bp, points.Bp.x + 44, points.Bp.y - 8, '');
      appendText('point', 'C', labels.C, points.C.x - 30, points.C.y - 30, '');
      currentGeometry.extraAreas.forEach(renderExtraAreaLabel);
    }

    function renderAreaAddSubtract4(layout, points) {
      const color = '#2a5bd7';
      const radius = currentGeometry.radius * layout.scale;
      const shift = currentGeometry.shift * layout.scale;
      const alpha = Math.acos(Math.max(-1, Math.min(1, shift / (2 * radius))));
      const beta = Math.PI - alpha;

      function arc(center, start, sweep) {
        return circleArcPoints(center.x, center.y, radius, start, sweep);
      }
      function closed(list) {
        return linePath(list) + ' Z';
      }
      function areaValue(list) {
        let sum = 0;
        for (let i = 0; i < list.length; i += 1) {
          const p = list[i];
          const q = list[(i + 1) % list.length];
          sum += p.x * q.y - q.x * p.y;
        }
        return Math.abs(sum) / 2 / (layout.scale * layout.scale);
      }
      function region(id, name, fillColor, list) {
        return {
          id: id,
          name: name,
          color: fillColor,
          path: closed(list),
          points: list,
          value: areaValue(list)
        };
      }

      const oTopRight = arc(points.O, alpha, Math.PI / 2 - alpha);
      const opTopLeft = arc(points.Op, Math.PI / 2, beta - Math.PI / 2);
      const oBottomRight = arc(points.O, -alpha, alpha - Math.PI / 2);
      const opBottomLeft = arc(points.Op, -Math.PI / 2, -beta + Math.PI / 2);
      const oLeft = arc(points.O, alpha, Math.PI * 2 - alpha * 2);
      const oRight = arc(points.O, alpha, -alpha * 2);
      const opLeft = arc(points.Op, -beta, -(Math.PI * 2 - beta * 2));
      const opRight = arc(points.Op, beta, -beta * 2);

      const top = [points.A, points.Ap].concat(opTopLeft).concat(oTopRight.slice().reverse());
      const bottom = [points.B, points.Bp].concat(opBottomLeft).concat(oBottomRight.slice().reverse());
      const left = oLeft.concat(opLeft);
      const lens = oRight.concat(opLeft);
      const right = opRight.concat(oRight.slice().reverse());

      currentGeometry.extraAreas = [
        region('top', '上側領域', color, top),
        region('bottom', '下側領域', color, bottom),
        region('left', '円O側', color, left),
        region('lens', "円O'内1", '#ffffff', lens),
        region('right', "円O'内2", '#ffffff', right)
      ];

      currentGeometry.extraAreas.forEach(appendExtraArea);
      stage.appendChild(createSvg('circle', {
        cx: points.O.x,
        cy: points.O.y,
        r: radius,
        fill: 'none',
        class: 'semicircle-line'
      }));
      stage.appendChild(createSvg('circle', {
        cx: points.Op.x,
        cy: points.Op.y,
        r: radius,
        fill: 'none',
        class: 'semicircle-line dashed-semicircle-line'
      }));
      stage.appendChild(createSvg('line', {
        x1: points.A.x,
        y1: points.A.y,
        x2: points.Ap.x,
        y2: points.Ap.y,
        class: 'axis-line dashed-semicircle-line'
      }));
      stage.appendChild(createSvg('line', {
        x1: points.B.x,
        y1: points.B.y,
        x2: points.Bp.x,
        y2: points.Bp.y,
        class: 'axis-line dashed-semicircle-line'
      }));
      stage.appendChild(createSvg('line', {
        x1: points.O.x,
        y1: points.O.y,
        x2: points.O.x + radius,
        y2: points.O.y,
        class: 'axis-line'
      }));

      appendHit('measure', 'r', createSvg('line', {
        x1: points.O.x,
        y1: points.O.y,
        x2: points.O.x + radius,
        y2: points.O.y,
        class: 'hit-line'
      }));
      appendHit('measure', 'shift', createSvg('line', {
        x1: points.A.x,
        y1: points.A.y,
        x2: points.Ap.x,
        y2: points.Ap.y,
        class: 'hit-line shift-hit-line'
      }));
      drawSideKind(stage, state.measureKinds.r, points.O, { x: points.O.x + radius, y: points.O.y });
      drawSideKind(stage, state.measureKinds.shift, points.A, points.Ap);

      ['O', 'A', 'B', 'Ap', 'Bp'].forEach(function (id) {
        const point = points[id];
        appendHit('point', id, createSvg('circle', { cx: point.x, cy: point.y, r: 30 }));
        stage.appendChild(createSvg('circle', {
          cx: point.x,
          cy: point.y,
          r: id === 'O' ? 7 : 8,
          class: id === 'O' ? 'center-point' : 'curve-point'
        }));
      });

      appendMeasureLabel('r', { P: points.O, Q: { x: points.O.x + radius, y: points.O.y } }, { x: points.O.x + radius / 2, y: points.O.y + 42 }, points);
      appendMeasureLabel('shift', { P: points.A, Q: points.Ap }, { x: (points.A.x + points.Ap.x) / 2, y: points.A.y - 42 }, points);
      const labels = state.pointInputs || {};
      appendText('point', 'O', labels.O, points.O.x - 34, points.O.y + 36, '');
      appendText('point', 'A', labels.A, points.A.x - 32, points.A.y - 28, '');
      appendText('point', 'B', labels.B, points.B.x - 32, points.B.y + 28, '');
      appendText('point', 'Ap', labels.Ap, points.Ap.x + 34, points.Ap.y - 28, '');
      appendText('point', 'Bp', labels.Bp, points.Bp.x + 34, points.Bp.y + 28, '');
      currentGeometry.extraAreas.forEach(renderExtraAreaLabel);
    }

    function renderBaumkuchen1(layout, points) {
      const smallRadius = currentGeometry.radius * layout.scale;
      const middleRadius = currentGeometry.middleRadius * layout.scale;
      const bigRadius = (currentGeometry.radius + currentGeometry.diff) * layout.scale;
      const middleCirclePoints = circleArcPoints(points.O.x, points.O.y, middleRadius, 0, Math.PI * 2);
      const smallCirclePoints = circleArcPoints(points.O.x, points.O.y, smallRadius, 0, Math.PI * 2);
      const smallCirclePath = [
        'M', points.O.x - smallRadius, points.O.y,
        'a', smallRadius, smallRadius, 0, 1, 0, smallRadius * 2, 0,
        'a', smallRadius, smallRadius, 0, 1, 0, -smallRadius * 2, 0
      ].join(' ');
      const lLabelPoint = { x: points.O.x, y: points.O.y - middleRadius - 38 };
      const rLine = measureLine('r', points);
      const aLine = measureLine('a', points);
      currentGeometry.extraAreas = [{
        id: 'small-circle',
        name: '小さい円',
        path: smallCirclePath,
        points: smallCirclePoints,
        value: Math.PI * currentGeometry.radius * currentGeometry.radius
      }];

      if (showArea) {
        stage.appendChild(createSvg('path', {
          d: [
            'M', points.O.x - bigRadius, points.O.y,
            'a', bigRadius, bigRadius, 0, 1, 0, bigRadius * 2, 0,
            'a', bigRadius, bigRadius, 0, 1, 0, -bigRadius * 2, 0,
            'M', points.O.x - smallRadius, points.O.y,
            'a', smallRadius, smallRadius, 0, 1, 1, smallRadius * 2, 0,
            'a', smallRadius, smallRadius, 0, 1, 1, -smallRadius * 2, 0
          ].join(' '),
          fill: areaShapeFill(0.08),
          class: 'shape-fill'
        }));
        appendHit('area', 'main', createSvg('path', {
          d: [
            'M', points.O.x - bigRadius, points.O.y,
            'a', bigRadius, bigRadius, 0, 1, 0, bigRadius * 2, 0,
            'a', bigRadius, bigRadius, 0, 1, 0, -bigRadius * 2, 0,
            'M', points.O.x - smallRadius, points.O.y,
            'a', smallRadius, smallRadius, 0, 1, 1, smallRadius * 2, 0,
            'a', smallRadius, smallRadius, 0, 1, 1, -smallRadius * 2, 0
          ].join(' ')
        }));
      }

      stage.appendChild(createSvg('path', {
        d: smallCirclePath,
        fill: hexToRgba(state.extraAreaColors['small-circle'] || '#ffffff', 0.1),
        stroke: 'none'
      }));
      stage.appendChild(createSvg('circle', {
        cx: points.O.x,
        cy: points.O.y,
        r: bigRadius,
        fill: 'none',
        class: 'semicircle-line'
      }));
      stage.appendChild(createSvg('circle', {
        cx: points.O.x,
        cy: points.O.y,
        r: smallRadius,
        fill: 'none',
        class: 'semicircle-line'
      }));
      stage.appendChild(createSvg('circle', {
        cx: points.O.x,
        cy: points.O.y,
        r: middleRadius,
        fill: 'none',
        class: 'semicircle-line dashed-semicircle-line'
      }));
      stage.appendChild(createSvg('line', {
        x1: rLine.P.x,
        y1: rLine.P.y,
        x2: aLine.Q.x,
        y2: aLine.Q.y,
        class: 'axis-line'
      }));

      appendMeasureHit('r', rLine);
      appendMeasureHit('a', aLine);
      appendHit('extraArea', 'small-circle', createSvg('path', {
        d: smallCirclePath,
        fill: 'rgba(0,0,0,0.001)',
        stroke: 'none'
      }));
      appendHit('measure', 'l', createSvg('circle', {
        cx: points.O.x,
        cy: points.O.y,
        r: middleRadius,
        class: 'hit-measure-arc',
        fill: 'none',
        stroke: 'rgba(0,0,0,0.001)',
        'stroke-width': 18
      }));
      drawSideKind(stage, state.measureKinds.r, rLine.P, rLine.Q);
      drawSideKind(stage, state.measureKinds.a, aLine.P, aLine.Q);
      drawCurveKind(stage, state.measureKinds.l, middleCirclePoints);

      ['O', 'A', 'M', 'B'].forEach(function (id) {
        const point = points[id];
        stage.appendChild(createSvg('circle', {
          cx: point.x,
          cy: point.y,
          r: id === 'O' ? 7 : 8,
          class: id === 'O' ? 'center-point' : 'curve-point'
        }));
      });
      appendHit('point', 'O', createSvg('circle', { cx: points.O.x, cy: points.O.y, r: 30 }));
      appendHit('point', 'A', createSvg('circle', { cx: points.A.x, cy: points.A.y, r: 30 }));
      appendHit('point', 'B', createSvg('circle', { cx: points.B.x, cy: points.B.y, r: 30 }));

      appendMeasureLabel('r', rLine, { x: (rLine.P.x + rLine.Q.x) / 2, y: rLine.P.y + 42 }, points);
      appendMeasureLabel('a', aLine, { x: (aLine.P.x + aLine.Q.x) / 2, y: aLine.P.y + 42 }, points);
      appendText('measure', 'l', textForLabel(state.measureInputs.l, currentGeometry.measures.l, formatNumber), lLabelPoint.x, lLabelPoint.y, 'arc-label');

      const labels = state.pointInputs || {};
      appendText('point', 'O', labels.O, points.O.x - 32, points.O.y - 32, '');
      appendText('point', 'A', labels.A, points.A.x, points.A.y + 38, '');
      appendText('point', 'B', labels.B, points.B.x + 34, points.B.y + 30, '');
      if (showArea) {
        appendText('area', 'main', textForLabel(state.areaInput, currentGeometry.area), points.O.x, points.O.y + bigRadius * 0.58, 'area-label');
      }
      currentGeometry.extraAreas.forEach(renderExtraAreaLabel);
    }

    function renderSal2(layout, points) {
      const smallIds = ['A', 'B', 'C', 'D'];
      const midIds = ['E', 'F', 'G', 'H'];
      const bigIds = ['I', 'J', 'K', 'L'];
      function polygonPoints(ids) {
        return ids.map(function (id) { return points[id].x + ',' + points[id].y; }).join(' ');
      }
      function centerOf(ids) {
        const sum = ids.reduce(function (acc, id) {
          acc.x += points[id].x;
          acc.y += points[id].y;
          return acc;
        }, { x: 0, y: 0 });
        return { x: sum.x / ids.length, y: sum.y / ids.length };
      }

      stage.appendChild(createSvg('polygon', {
        points: polygonPoints(bigIds),
        fill: 'none',
        class: 'semicircle-line'
      }));
      stage.appendChild(createSvg('polygon', {
        points: polygonPoints(midIds),
        fill: 'none',
        class: 'semicircle-line dashed-semicircle-line'
      }));
      stage.appendChild(createSvg('polygon', {
        points: polygonPoints(smallIds),
        fill: 'none',
        class: 'semicircle-line'
      }));

      const abLine = measureLine('AB', points);
      const bcLine = measureLine('BC', points);
      const aLine = measureLine('a', points);
      [
        ['AB', abLine],
        ['BC', bcLine],
        ['a', aLine]
      ].forEach(function (entry) {
        appendMeasureHit(entry[0], entry[1]);
        drawSideKind(stage, state.measureKinds[entry[0]], entry[1].P, entry[1].Q);
      });

      appendMeasureLabel('AB', abLine, { x: points.A.x - 44, y: (points.A.y + points.B.y) / 2 }, points);
      appendMeasureLabel('BC', bcLine, { x: (points.B.x + points.C.x) / 2, y: points.B.y + 42 }, points);
      appendMeasureLabel('a', aLine, { x: (aLine.P.x + aLine.Q.x) / 2, y: aLine.P.y + 42 }, points);

      smallIds.concat(midIds, bigIds).forEach(function (id) {
        appendHit('point', id, createSvg('circle', { cx: points[id].x, cy: points[id].y, r: 28 }));
      });
      const labels = state.pointInputs || {};
      const centers = {
        small: centerOf(smallIds),
        mid: centerOf(midIds),
        big: centerOf(bigIds)
      };
      smallIds.concat(midIds, bigIds).forEach(function (id) {
        if (!labels[id]) return;
        const group = smallIds.indexOf(id) !== -1 ? centers.small : (midIds.indexOf(id) !== -1 ? centers.mid : centers.big);
        const dx = points[id].x - group.x;
        const dy = points[id].y - group.y;
        const length = Math.hypot(dx, dy) || 1;
        appendText('point', id, labels[id], points[id].x + dx / length * 34, points[id].y + dy / length * 34, '');
        stage.appendChild(createSvg('circle', { cx: points[id].x, cy: points[id].y, r: 7, class: 'curve-point' }));
      });
    }

    function renderSal3(layout, points) {
      const smallIds = ['A', 'B', 'C'];
      const midIds = ['D', 'E', 'F'];
      const bigIds = ['G', 'H', 'I'];
      function polygonPoints(ids) {
        return ids.map(function (id) { return points[id].x + ',' + points[id].y; }).join(' ');
      }
      function centerOf(ids) {
        const sum = ids.reduce(function (acc, id) {
          acc.x += points[id].x;
          acc.y += points[id].y;
          return acc;
        }, { x: 0, y: 0 });
        return { x: sum.x / ids.length, y: sum.y / ids.length };
      }
      function labelPointForLine(line, center, distance) {
        const mid = midpoint(line.P, line.Q);
        const dx = center.x - mid.x;
        const dy = center.y - mid.y;
        const length = Math.hypot(dx, dy) || 1;
        return { x: mid.x + dx / length * distance, y: mid.y + dy / length * distance };
      }
      const areaPolygon = createSvg('polygon', {
        points: polygonPoints(smallIds),
        fill: hexToRgba(state.areaColor || '#2a5bd7', 0.1),
        stroke: 'none'
      });
      stage.appendChild(areaPolygon);
      stage.appendChild(createSvg('polygon', {
        points: polygonPoints(bigIds),
        fill: 'none',
        class: 'semicircle-line'
      }));
      stage.appendChild(createSvg('polygon', {
        points: polygonPoints(midIds),
        fill: 'none',
        class: 'semicircle-line dashed-semicircle-line'
      }));
      stage.appendChild(createSvg('polygon', {
        points: polygonPoints(smallIds),
        fill: 'none',
        class: 'semicircle-line'
      }));

      const center = centerOf(smallIds);
      const abLine = measureLine('AB', points);
      const bcLine = measureLine('BC', points);
      const caLine = measureLine('CA', points);
      const mnLine = measureLine('MN', points);
      const hiddenSideIds = ['DE', 'EF', 'FD', 'GH', 'HI', 'IG', 'JK'];
      const hiddenSideCenters = {
        DE: centerOf(midIds),
        EF: centerOf(midIds),
        FD: centerOf(midIds),
        GH: centerOf(bigIds),
        HI: centerOf(bigIds),
        IG: centerOf(bigIds),
        JK: center
      };
      stage.appendChild(createSvg('line', {
        x1: mnLine.P.x,
        y1: mnLine.P.y,
        x2: mnLine.Q.x,
        y2: mnLine.Q.y,
        class: 'axis-line dashed-semicircle-line'
      }));
      [
        ['AB', abLine],
        ['BC', bcLine],
        ['CA', caLine]
      ].forEach(function (entry) {
        appendMeasureHit(entry[0], entry[1]);
        drawSideKind(stage, state.measureKinds[entry[0]], entry[1].P, entry[1].Q);
      });
      appendHit('area', 'ABC', createSvg('polygon', { points: polygonPoints(smallIds) }));

      appendMeasureLabel('AB', abLine, labelPointForLine(abLine, center, 44), points);
      appendMeasureLabel('BC', bcLine, labelPointForLine(bcLine, center, 44), points);
      appendMeasureLabel('CA', caLine, labelPointForLine(caLine, center, 44), points);
      appendMeasureLabel('MN', mnLine, labelPointForLine(mnLine, center, 92), points);
      hiddenSideIds.forEach(function (id) {
        const line = measureLine(id, points);
        appendMeasureLabel(id, line, labelPointForLine(line, hiddenSideCenters[id], 44), points);
      });

      smallIds.concat(midIds, bigIds).forEach(function (id) {
        appendHit('point', id, createSvg('circle', { cx: points[id].x, cy: points[id].y, r: 28 }));
      });
      hiddenSideIds.forEach(function (id) {
        appendMeasureHit(id, measureLine(id, points));
      });
      ['M', 'N', 'J', 'K'].forEach(function (id) {
        appendHit('point', id, createSvg('circle', { cx: points[id].x, cy: points[id].y, r: 18 }));
      });
      appendHit('measure', 'MN', createSvg('line', {
        x1: mnLine.P.x,
        y1: mnLine.P.y,
        x2: mnLine.Q.x,
        y2: mnLine.Q.y,
        class: 'hit-line strong-hit-line'
      }));
      const labels = state.pointInputs || {};
      const centers = {
        small: centerOf(smallIds),
        mid: centerOf(midIds),
        big: centerOf(bigIds)
      };
      smallIds.concat(midIds, bigIds, ['M', 'N', 'J', 'K']).forEach(function (id) {
        if (!labels[id]) return;
        const group = smallIds.indexOf(id) !== -1 || id === 'M' || id === 'J' ? centers.small : (midIds.indexOf(id) !== -1 ? centers.mid : centers.big);
        const dx = points[id].x - group.x;
        const dy = points[id].y - group.y;
        const length = Math.hypot(dx, dy) || 1;
        appendText('point', id, labels[id], points[id].x + dx / length * 34, points[id].y + dy / length * 34, '');
        stage.appendChild(createSvg('circle', { cx: points[id].x, cy: points[id].y, r: 7, class: 'curve-point' }));
      });
    }

    function renderRightTriangleSemicircles(layout, points) {
      const ab = currentGeometry.AB;
      const ac = currentGeometry.AC;
      const bc = currentGeometry.BC;
      const scale = layout.scale;
      const radiusBC = bc * scale / 2;
      const centerBC = midpoint(points.B, points.C);
      const bigArc = semicircleArcPoints(points.B, points.C, points.A);
      const splitBig = splitArcAtPoint(bigArc, points.A);
      const bigBA = splitBig.before;
      const bigAC = splitBig.after;
      const abOutsidePoint = reflectPointAcrossLine(points.C, points.A, points.B);
      const acOutsidePoint = reflectPointAcrossLine(points.B, points.A, points.C);
      const smallAB = semicircleArcPoints(points.B, points.A, abOutsidePoint);
      const smallAC = semicircleArcPoints(points.A, points.C, acOutsidePoint);

      function closed(list) {
        return linePath(list) + ' Z';
      }
      function areaValue(list) {
        let sum = 0;
        for (let i = 0; i < list.length; i += 1) {
          const p = list[i];
          const q = list[(i + 1) % list.length];
          sum += p.x * q.y - q.x * p.y;
        }
        return Math.abs(sum) / 2 / (scale * scale);
      }
      function region(id, name, color, list) {
        return {
          id: id,
          name: name,
          color: color,
          path: closed(list),
          points: list,
          value: areaValue(list)
        };
      }

      const leftInner = [points.B, points.A].concat(bigBA.slice().reverse());
      const rightInner = [points.A, points.C].concat(bigAC.slice().reverse());
      const triangle = [points.A, points.B, points.C];
      const leftLune = bigBA.concat(smallAB.slice().reverse());
      const rightLune = bigAC.concat(smallAC.slice().reverse());

      currentGeometry.extraAreas = [
        region('left-lune', '左ルーン', '#f97316', leftLune),
        region('left-inner', '左内側', '#22c55e', leftInner),
        region('triangle-abc', '三角形ABC', '#ffffff', triangle),
        region('right-inner', '右内側', '#06b6d4', rightInner),
        region('right-lune', '右ルーン', '#ec4899', rightLune)
      ];

      currentGeometry.extraAreas.forEach(appendExtraArea);
      stage.appendChild(createSvg('path', { d: linePath(bigArc), class: 'arc-line' }));
      stage.appendChild(createSvg('path', { d: linePath(smallAB), class: 'semicircle-line' }));
      stage.appendChild(createSvg('path', { d: linePath(smallAC), class: 'semicircle-line' }));
      stage.appendChild(createSvg('line', { x1: points.A.x, y1: points.A.y, x2: points.B.x, y2: points.B.y, class: 'axis-line' }));
      stage.appendChild(createSvg('line', { x1: points.A.x, y1: points.A.y, x2: points.C.x, y2: points.C.y, class: 'axis-line' }));
      stage.appendChild(createSvg('line', { x1: points.B.x, y1: points.B.y, x2: points.C.x, y2: points.C.y, class: 'axis-line' }));

      [['AB', 'A', 'B'], ['AC', 'A', 'C'], ['BC', 'B', 'C']].forEach(function (entry) {
        appendMeasureHit(entry[0], { P: points[entry[1]], Q: points[entry[2]] });
        drawSideKind(stage, state.measureKinds[entry[0]], points[entry[1]], points[entry[2]]);
      });
      appendHit('measure', 'arcAB', createSvg('path', { d: linePath(smallAB), class: 'hit-measure-arc' }));
      appendHit('measure', 'arcAC', createSvg('path', { d: linePath(smallAC), class: 'hit-measure-arc' }));
      appendHit('measure', 'arcBC', createSvg('path', { d: linePath(bigArc), class: 'hit-measure-arc' }));
      drawCurveKind(stage, state.measureKinds.arcAB, smallAB);
      drawCurveKind(stage, state.measureKinds.arcAC, smallAC);
      drawCurveKind(stage, state.measureKinds.arcBC, bigArc);

      const angleRadius = Math.min(ab, ac) * scale * 0.18;
      const angleArc = angleArcPoints(points.A, points.B, points.C, angleRadius);
      drawAngleDecoration('BAC', linePath(angleArc), angleArc, points.A, 90, { p1: points.B, p2: points.C });

      ['A', 'B', 'C'].forEach(function (id) {
        appendHit('point', id, createSvg('circle', { cx: points[id].x, cy: points[id].y, r: 30 }));
        stage.appendChild(createSvg('circle', {
          cx: points[id].x,
          cy: points[id].y,
          r: 8,
          class: 'curve-point'
        }));
      });

      function innerSideLabelPoint(P, Q, insidePoint) {
        const mid = midpoint(P, Q);
        const dx = insidePoint.x - mid.x;
        const dy = insidePoint.y - mid.y;
        const length = Math.hypot(dx, dy) || 1;
        const offset = Math.min(52, Math.max(34, Math.min(ab, ac) * scale * 0.15));
        return {
          x: mid.x + dx / length * offset,
          y: mid.y + dy / length * offset
        };
      }

      const labels = state.pointInputs || {};
      appendText('point', 'A', labels.A, points.A.x, points.A.y - 38, '');
      appendText('point', 'B', labels.B, points.B.x - 34, points.B.y + 34, '');
      appendText('point', 'C', labels.C, points.C.x + 34, points.C.y + 34, '');
      appendMeasureLabel('AB', { P: points.A, Q: points.B }, innerSideLabelPoint(points.A, points.B, points.C), points);
      appendMeasureLabel('AC', { P: points.A, Q: points.C }, innerSideLabelPoint(points.A, points.C, points.B), points);
      appendMeasureLabel('BC', { P: points.B, Q: points.C }, { x: centerBC.x, y: centerBC.y + 42 }, points);
      appendText('measure', 'arcAB', textForLabel(state.measureInputs.arcAB, currentGeometry.measures.arcAB, formatNumber), smallAB[Math.floor(smallAB.length / 2)].x - 18, smallAB[Math.floor(smallAB.length / 2)].y - 18, 'arc-label');
      appendText('measure', 'arcAC', textForLabel(state.measureInputs.arcAC, currentGeometry.measures.arcAC, formatNumber), smallAC[Math.floor(smallAC.length / 2)].x + 18, smallAC[Math.floor(smallAC.length / 2)].y - 18, 'arc-label');
      appendText('measure', 'arcBC', textForLabel(state.measureInputs.arcBC, currentGeometry.measures.arcBC, formatNumber), points.A.x, points.A.y + radiusBC * 0.16, 'arc-label');
      appendText('angle', 'BAC', textForLabel(state.angleInputs.BAC, 90, formatAngle), points.A.x, points.A.y + angleRadius * 1.18, 'angle-label');
      currentGeometry.extraAreas.forEach(renderExtraAreaLabel);
    }

    function renderTaijitu(layout, points) {
      const color = '#2a5bd7';
      const radius = currentGeometry.AO * layout.scale;
      const smallRadius = radius / 2;
      const leftCenter = midpoint(points.A, points.O);
      const rightCenter = midpoint(points.O, points.B);

      const bigTop = circleArcPoints(points.O.x, points.O.y, radius, Math.PI, -Math.PI);
      const bigBottom = circleArcPoints(points.O.x, points.O.y, radius, 0, -Math.PI);
      const smallTop = circleArcPoints(leftCenter.x, leftCenter.y, smallRadius, Math.PI, -Math.PI);
      const smallBottom = circleArcPoints(rightCenter.x, rightCenter.y, smallRadius, Math.PI, Math.PI);

      function closed(list) {
        return linePath(list) + ' Z';
      }
      function areaValue(list) {
        let sum = 0;
        for (let i = 0; i < list.length; i += 1) {
          const p = list[i];
          const q = list[(i + 1) % list.length];
          sum += p.x * q.y - q.x * p.y;
        }
        return Math.abs(sum) / 2 / (layout.scale * layout.scale);
      }
      function region(id, name, fillColor, list) {
        return {
          id: id,
          name: name,
          color: fillColor,
          path: closed(list),
          points: list,
          value: areaValue(list)
        };
      }

      const aoUpper = [points.A, points.O].concat(smallTop.slice().reverse());
      const upperOuter = bigTop.concat([points.O]).concat(smallTop.slice().reverse());
      const boLower = [points.O, points.B].concat(smallBottom.slice().reverse());
      const lowerOuter = bigBottom.concat([points.A, points.O]).concat(smallBottom);

      currentGeometry.extraAreas = [
        region('ao-upper', 'AO上側', color, aoUpper),
        region('upper-outer', '上側外部', '#ffffff', upperOuter),
        region('bo-lower', 'BO下側', '#ffffff', boLower),
        region('lower-outer', '下側外部', color, lowerOuter)
      ];

      currentGeometry.extraAreas.forEach(appendExtraArea);
      stage.appendChild(createSvg('circle', {
        cx: points.O.x,
        cy: points.O.y,
        r: radius,
        fill: 'none',
        class: 'semicircle-line'
      }));
      stage.appendChild(createSvg('line', {
        x1: points.A.x,
        y1: points.A.y,
        x2: points.B.x,
        y2: points.B.y,
        class: 'axis-line'
      }));
      stage.appendChild(createSvg('path', {
        d: linePath(smallTop),
        class: 'semicircle-line dashed-semicircle-line'
      }));
      stage.appendChild(createSvg('path', {
        d: linePath(smallBottom),
        class: 'semicircle-line dashed-semicircle-line'
      }));

      appendHit('measure', 'AO', createSvg('line', {
        x1: points.A.x,
        y1: points.A.y,
        x2: points.O.x,
        y2: points.O.y,
        class: 'hit-line shift-hit-line'
      }));
      drawSideKind(stage, state.measureKinds.AO, points.A, points.O);

      ['A', 'O', 'B'].forEach(function (id) {
        const point = points[id];
        appendHit('point', id, createSvg('circle', { cx: point.x, cy: point.y, r: 30 }));
        stage.appendChild(createSvg('circle', {
          cx: point.x,
          cy: point.y,
          r: id === 'O' ? 7 : 8,
          class: id === 'O' ? 'center-point' : 'curve-point'
        }));
      });

      appendMeasureLabel('AO', { P: points.A, Q: points.O }, { x: (points.A.x + points.O.x) / 2, y: points.A.y + 42 }, points);
      const labels = state.pointInputs || {};
      appendText('point', 'A', labels.A, points.A.x - 34, points.A.y + 30, '');
      appendText('point', 'O', labels.O, points.O.x, points.O.y + 42, '');
      appendText('point', 'B', labels.B, points.B.x + 34, points.B.y + 30, '');
      currentGeometry.extraAreas.forEach(renderExtraAreaLabel);
    }

    function renderSquareCornerSectors(layout, points) {
      const sidePx = currentGeometry.side * layout.scale;
      const q = 1 - Math.sqrt(3) / 2;
      const r = Math.sqrt(3) / 2;
      const P = {
        top: { x: points.A.x + sidePx * 0.5, y: points.A.y + sidePx * q },
        right: { x: points.A.x + sidePx * r, y: points.A.y + sidePx * 0.5 },
        bottom: { x: points.A.x + sidePx * 0.5, y: points.A.y + sidePx * r },
        left: { x: points.A.x + sidePx * q, y: points.A.y + sidePx * 0.5 }
      };
      const centers = { A: points.A, B: points.B, C: points.C, D: points.D };
      function arc(centerId, from, to) {
        return circleArcBetweenPoints(centers[centerId], sidePx, from, to);
      }
      function dropFirst(list) { return list.slice(1); }
      function reverse(list) { return list.slice().reverse(); }
      function closed(pointsList) { return linePath(pointsList) + ' Z'; }
      function areaValue(pointsList) {
        let sum = 0;
        for (let i = 0; i < pointsList.length; i += 1) {
          const p = pointsList[i];
          const next = pointsList[(i + 1) % pointsList.length];
          sum += p.x * next.y - next.x * p.y;
        }
        return Math.abs(sum) / 2 / (layout.scale * layout.scale);
      }
      function region(id, name, color, pointsList) {
        return {
          id: id,
          name: name,
          color: color,
          path: closed(pointsList),
          points: pointsList,
          value: areaValue(pointsList)
        };
      }

      const top = [points.A, points.B].concat(dropFirst(arc('C', points.B, P.top))).concat(dropFirst(arc('D', P.top, points.A)));
      const right = [points.B, points.C].concat(dropFirst(arc('D', points.C, P.right))).concat(dropFirst(arc('A', P.right, points.B)));
      const bottom = [points.C, points.D].concat(dropFirst(arc('A', points.D, P.bottom))).concat(dropFirst(arc('B', P.bottom, points.C)));
      const left = [points.D, points.A].concat(dropFirst(arc('B', points.A, P.left))).concat(dropFirst(arc('C', P.left, points.D)));
      const cornerA = arc('D', points.A, P.top).concat(dropFirst(arc('C', P.top, P.left))).concat(dropFirst(arc('B', P.left, points.A)));
      const cornerB = arc('A', points.B, P.right).concat(dropFirst(arc('D', P.right, P.top))).concat(dropFirst(arc('C', P.top, points.B)));
      const cornerC = arc('D', points.C, P.right).concat(dropFirst(arc('A', P.right, P.bottom))).concat(dropFirst(arc('B', P.bottom, points.C)));
      const cornerD = arc('C', points.D, P.left).concat(dropFirst(arc('B', P.left, P.bottom))).concat(dropFirst(arc('A', P.bottom, points.D)));
      const center = arc('D', P.top, P.right).concat(dropFirst(arc('A', P.right, P.bottom))).concat(dropFirst(arc('B', P.bottom, P.left))).concat(dropFirst(arc('C', P.left, P.top)));

      currentGeometry.extraAreas = [
        region('top', '上部領域', '#2a5bd7', top),
        region('right', '右部領域', '#2e7d32', right),
        region('bottom', '下部領域', '#8e44ad', bottom),
        region('left', '左部領域', '#8b5a2b', left),
        region('corner-a', 'A側領域', '#e53935', cornerA),
        region('corner-b', 'B側領域', '#f2c94c', cornerB),
        region('corner-c', 'C側領域', '#ff66a3', cornerC),
        region('corner-d', 'D側領域', '#8a94a6', cornerD),
        region('center', '中央領域', '#111827', center)
      ];

      currentGeometry.extraAreas.forEach(appendExtraArea);
      stage.appendChild(createSvg('polygon', {
        points: [points.A, points.B, points.C, points.D].map(function (p) { return p.x + ',' + p.y; }).join(' '),
        fill: 'none',
        class: 'square-sector-outline'
      }));
      [
        arc('A', points.B, points.D),
        arc('B', points.A, points.C),
        arc('C', points.B, points.D),
        arc('D', points.A, points.C)
      ].forEach(function (arcPoints) {
        stage.appendChild(createSvg('path', { d: linePath(arcPoints), class: 'arc-line square-sector-arc' }));
      });
      [['AB', 'A', 'B'], ['BC', 'B', 'C'], ['CD', 'C', 'D'], ['DA', 'D', 'A']].forEach(function (entry) {
        appendMeasureHit(entry[0], { P: points[entry[1]], Q: points[entry[2]] });
      });
      [
        ['AB', 'A', 'B', { x: (points.A.x + points.B.x) / 2, y: points.A.y - 42 }],
        ['BC', 'B', 'C', { x: points.B.x + 42, y: (points.B.y + points.C.y) / 2 }],
        ['CD', 'C', 'D', { x: (points.C.x + points.D.x) / 2, y: points.C.y + 42 }],
        ['DA', 'D', 'A', { x: points.D.x - 42, y: (points.D.y + points.A.y) / 2 }]
      ].forEach(function (entry) {
        appendMeasureLabel(entry[0], { P: points[entry[1]], Q: points[entry[2]] }, entry[3], points);
      });
      ['A', 'B', 'C', 'D'].forEach(function (id) {
        appendHit('point', id, createSvg('circle', { cx: points[id].x, cy: points[id].y, r: 30 }));
        if ((state.pointInputs && state.pointInputs[id])) {
          stage.appendChild(createSvg('circle', { cx: points[id].x, cy: points[id].y, r: 8, fill: '#1f2430' }));
        }
      });
      renderPointLabels(points);
      currentGeometry.extraAreas.forEach(renderExtraAreaLabel);
    }

    function renderSquareQuarterSector3(layout, points) {
      const sidePx = currentGeometry.side * layout.scale;
      const radius = sidePx / 2;
      const arcB = circleArcBetweenPoints(points.B, radius, points.P, points.Q);
      const arcC = circleArcBetweenPoints(points.C, radius, points.Q, points.R);
      const arcD = circleArcBetweenPoints(points.D, radius, points.R, points.S);
      const arcA = circleArcBetweenPoints(points.A, radius, points.S, points.P);

      function closed(pointsList) { return linePath(pointsList) + ' Z'; }
      function areaValue(pointsList) {
        let sum = 0;
        for (let i = 0; i < pointsList.length; i += 1) {
          const p = pointsList[i];
          const next = pointsList[(i + 1) % pointsList.length];
          sum += p.x * next.y - next.x * p.y;
        }
        return Math.abs(sum) / 2 / (layout.scale * layout.scale);
      }
      function region(id, name, color, pointsList) {
        return {
          id: id,
          name: name,
          color: color,
          path: closed(pointsList),
          points: pointsList,
          value: areaValue(pointsList)
        };
      }

      const sectorB = [points.B, points.P].concat(dropFirst(arcB));
      const sectorC = [points.C, points.Q].concat(dropFirst(arcC));
      const sectorD = [points.D, points.R].concat(dropFirst(arcD));
      const sectorA = [points.A, points.S].concat(dropFirst(arcA));
      const center = arcB
        .concat(dropFirst(arcC))
        .concat(dropFirst(arcD))
        .concat(dropFirst(arcA));

      currentGeometry.extraAreas = [
        region('sector-a', 'A側扇形', '#e53935', sectorA),
        region('sector-b', 'B側扇形', '#2a5bd7', sectorB),
        region('sector-c', 'C側扇形', '#2e7d32', sectorC),
        region('sector-d', 'D側扇形', '#8e44ad', sectorD),
        region('center', '中央領域', '#111827', center)
      ];

      currentGeometry.extraAreas.forEach(appendExtraArea);
      stage.appendChild(createSvg('polygon', {
        points: [points.A, points.B, points.C, points.D].map(function (point) { return point.x + ',' + point.y; }).join(' '),
        fill: 'none',
        class: 'square-sector-outline'
      }));
      [arcB, arcC, arcD, arcA].forEach(function (arcPoints) {
        stage.appendChild(createSvg('path', { d: linePath(arcPoints), class: 'arc-line square-sector-arc' }));
      });

      appendMeasureHit('AB', { P: points.A, Q: points.B });
      drawSideKind(stage, state.measureKinds.AB, points.A, points.B);
      appendMeasureLabel('AB', { P: points.A, Q: points.B }, { x: (points.A.x + points.B.x) / 2, y: points.A.y - 42 }, points);

      ['A', 'B', 'C', 'D', 'P', 'Q', 'R', 'S'].forEach(function (id) {
        stage.appendChild(createSvg('circle', {
          cx: points[id].x,
          cy: points[id].y,
          r: ['P', 'Q', 'R', 'S'].indexOf(id) !== -1 ? 7 : 8,
          fill: '#1f2430'
        }));
        appendHit('point', id, createSvg('circle', { cx: points[id].x, cy: points[id].y, r: 30 }));
      });

      renderPointLabels(points);
      currentGeometry.extraAreas.forEach(renderExtraAreaLabel);
    }

    function renderSquareQuarterSector4(layout, points) {
      const sidePx = currentGeometry.side * layout.scale;
      const arcA = circleArcBetweenPoints(points.A, sidePx, points.B, points.D);
      const arcC = circleArcBetweenPoints(points.C, sidePx, points.B, points.D);

      function closed(pointsList) { return linePath(pointsList) + ' Z'; }
      function areaValue(pointsList) {
        let sum = 0;
        for (let i = 0; i < pointsList.length; i += 1) {
          const p = pointsList[i];
          const next = pointsList[(i + 1) % pointsList.length];
          sum += p.x * next.y - next.x * p.y;
        }
        return Math.abs(sum) / 2 / (layout.scale * layout.scale);
      }
      function region(id, name, color, pointsList) {
        return {
          id: id,
          name: name,
          color: color,
          path: closed(pointsList),
          points: pointsList,
          value: areaValue(pointsList)
        };
      }

      const reversedArcA = arcA.slice().reverse();
      const reversedArcC = arcC.slice().reverse();
      const areaA = [points.A, points.B].concat(dropFirst(arcC), [points.A]);
      const areaC = [points.C, points.D].concat(dropFirst(reversedArcA), [points.C]);
      const center = arcA.concat(dropFirst(reversedArcC));

      currentGeometry.extraAreas = [
        region('a-side', 'A側領域', '#2a5bd7', areaA),
        region('center', '中央領域', '#111827', center),
        region('c-side', 'C側領域', '#e53935', areaC)
      ];

      currentGeometry.extraAreas.forEach(appendExtraArea);
      stage.appendChild(createSvg('polygon', {
        points: [points.A, points.B, points.C, points.D].map(function (point) { return point.x + ',' + point.y; }).join(' '),
        fill: 'none',
        class: 'square-sector-outline'
      }));
      [arcA, arcC].forEach(function (arcPoints) {
        stage.appendChild(createSvg('path', { d: linePath(arcPoints), class: 'arc-line square-sector-arc' }));
      });

      appendMeasureHit('AB', { P: points.A, Q: points.B });
      drawSideKind(stage, state.measureKinds.AB, points.A, points.B);
      appendMeasureLabel('AB', { P: points.A, Q: points.B }, { x: (points.A.x + points.B.x) / 2, y: points.A.y - 42 }, points);

      ['A', 'B', 'C', 'D'].forEach(function (id) {
        stage.appendChild(createSvg('circle', {
          cx: points[id].x,
          cy: points[id].y,
          r: 8,
          fill: '#1f2430'
        }));
        appendHit('point', id, createSvg('circle', { cx: points[id].x, cy: points[id].y, r: 30 }));
      });

      renderPointLabels(points);
      currentGeometry.extraAreas.forEach(renderExtraAreaLabel);
    }

    function renderSquareCircle1(layout, points) {
      const sidePx = currentGeometry.side * layout.scale;
      const radius = sidePx / 2;
      const topRightArc = circleArcPoints(points.O.x, points.O.y, radius, Math.PI / 2, -Math.PI / 2);
      const bottomRightArc = circleArcPoints(points.O.x, points.O.y, radius, 0, -Math.PI / 2);
      const bottomLeftArc = circleArcPoints(points.O.x, points.O.y, radius, -Math.PI / 2, -Math.PI / 2);
      const topLeftArc = circleArcPoints(points.O.x, points.O.y, radius, Math.PI, -Math.PI / 2);
      const circlePoints = circleArcPoints(points.O.x, points.O.y, radius, 0, Math.PI * 2);

      function closed(pointsList) { return linePath(pointsList) + ' Z'; }
      function areaValue(pointsList) {
        let sum = 0;
        for (let i = 0; i < pointsList.length; i += 1) {
          const p = pointsList[i];
          const next = pointsList[(i + 1) % pointsList.length];
          sum += p.x * next.y - next.x * p.y;
        }
        return Math.abs(sum) / 2 / (layout.scale * layout.scale);
      }
      function region(id, name, color, pointsList) {
        return {
          id: id,
          name: name,
          color: color,
          path: closed(pointsList),
          points: pointsList,
          value: areaValue(pointsList)
        };
      }

      currentGeometry.extraAreas = [
        region('top-left', '左上領域', '#2a5bd7', [points.A].concat(topLeftArc, [points.A])),
        region('top-right', '右上領域', '#2e7d32', [points.B].concat(topRightArc, [points.B])),
        region('bottom-right', '右下領域', '#e53935', [points.C].concat(bottomRightArc, [points.C])),
        region('bottom-left', '左下領域', '#8e44ad', [points.D].concat(bottomLeftArc, [points.D])),
        region('center', '円O', '#111827', circlePoints)
      ];

      currentGeometry.extraAreas.forEach(appendExtraArea);
      stage.appendChild(createSvg('polygon', {
        points: [points.A, points.B, points.C, points.D].map(function (point) { return point.x + ',' + point.y; }).join(' '),
        fill: 'none',
        class: 'square-sector-outline'
      }));
      stage.appendChild(createSvg('path', {
        d: linePath(circlePoints) + ' Z',
        fill: 'none',
        class: 'arc-line square-sector-arc'
      }));

      appendMeasureHit('AB', { P: points.A, Q: points.B });
      drawSideKind(stage, state.measureKinds.AB, points.A, points.B);
      appendMeasureLabel('AB', { P: points.A, Q: points.B }, { x: (points.A.x + points.B.x) / 2, y: points.A.y - 42 }, points);

      ['A', 'B', 'C', 'D', 'O'].forEach(function (id) {
        stage.appendChild(createSvg('circle', {
          cx: points[id].x,
          cy: points[id].y,
          r: id === 'O' ? 7 : 8,
          fill: '#1f2430'
        }));
        appendHit('point', id, createSvg('circle', { cx: points[id].x, cy: points[id].y, r: 30 }));
      });

      renderPointLabels(points);
      currentGeometry.extraAreas.forEach(renderExtraAreaLabel);
    }

    function renderSquareCircle2(layout, points) {
      const sidePx = currentGeometry.side * layout.scale;
      const radius = sidePx / 4;
      const left = points.A.x;
      const right = points.B.x;
      const top = points.A.y;
      const bottom = points.C.y;
      const p = {
        o1Top: { x: points.O1.x, y: top },
        o1Right: { x: points.O1.x + radius, y: points.O1.y },
        o1Bottom: { x: points.O1.x, y: points.O1.y + radius },
        o1Left: { x: left, y: points.O1.y },
        o2Top: { x: points.O2.x, y: top },
        o2Right: { x: right, y: points.O2.y },
        o2Bottom: { x: points.O2.x, y: points.O2.y + radius },
        o2Left: { x: points.O2.x - radius, y: points.O2.y },
        o3Top: { x: points.O3.x, y: points.O3.y - radius },
        o3Right: { x: right, y: points.O3.y },
        o3Bottom: { x: points.O3.x, y: bottom },
        o3Left: { x: points.O3.x - radius, y: points.O3.y },
        o4Top: { x: points.O4.x, y: points.O4.y - radius },
        o4Right: { x: points.O4.x + radius, y: points.O4.y },
        o4Bottom: { x: points.O4.x, y: bottom },
        o4Left: { x: left, y: points.O4.y }
      };
      const centers = [
        { id: 'circle-1', name: '左上の円', color: '#ffffff', pointId: 'O1' },
        { id: 'circle-2', name: '右上の円', color: '#ffffff', pointId: 'O2' },
        { id: 'circle-3', name: '右下の円', color: '#ffffff', pointId: 'O3' },
        { id: 'circle-4', name: '左下の円', color: '#ffffff', pointId: 'O4' }
      ];

      function dropFirst(list) { return list.slice(1); }
      function closed(pointsList) { return linePath(pointsList) + ' Z'; }
      function areaValue(pointsList) {
        let sum = 0;
        for (let i = 0; i < pointsList.length; i += 1) {
          const p = pointsList[i];
          const next = pointsList[(i + 1) % pointsList.length];
          sum += p.x * next.y - next.x * p.y;
        }
        return Math.abs(sum) / 2 / (layout.scale * layout.scale);
      }
      function circleRegion(item) {
        const center = points[item.pointId];
        const circlePoints = circleArcPoints(center.x, center.y, radius, 0, Math.PI * 2);
        return {
          id: item.id,
          name: item.name,
          color: item.color,
          path: closed(circlePoints),
          points: circlePoints,
          value: Math.PI * Math.pow(currentGeometry.side / 4, 2)
        };
      }
      function region(id, name, color, pointsList) {
        return {
          id: id,
          name: name,
          color: color,
          path: closed(pointsList),
          points: pointsList,
          value: areaValue(pointsList)
        };
      }

      const circleAreas = centers.map(circleRegion);
      const green = '#2e7d32';
      const yellow = '#f2c94c';
      const red = '#e53935';
      currentGeometry.extraAreas = [
        region('outside-top-left', '左上', green, [points.A].concat(circleArcPoints(points.O1.x, points.O1.y, radius, Math.PI / 2, Math.PI / 2), [points.A])),
        region('outside-top-right', '右上', green, [points.B].concat(circleArcPoints(points.O2.x, points.O2.y, radius, Math.PI / 2, -Math.PI / 2), [points.B])),
        region('outside-bottom-right', '右下', green, [points.C].concat(circleArcPoints(points.O3.x, points.O3.y, radius, -Math.PI / 2, Math.PI / 2), [points.C])),
        region('outside-bottom-left', '左下', green, [points.D].concat(circleArcPoints(points.O4.x, points.O4.y, radius, Math.PI, Math.PI / 2), [points.D])),
        region('outside-top', '上', yellow, [p.o1Top, p.o2Top]
          .concat(dropFirst(circleArcPoints(points.O2.x, points.O2.y, radius, Math.PI / 2, Math.PI / 2)))
          .concat(dropFirst(circleArcPoints(points.O1.x, points.O1.y, radius, 0, Math.PI / 2)))),
        region('outside-right', '右', yellow, [p.o2Right, p.o3Right]
          .concat(dropFirst(circleArcPoints(points.O3.x, points.O3.y, radius, 0, Math.PI / 2)))
          .concat(dropFirst(circleArcPoints(points.O2.x, points.O2.y, radius, -Math.PI / 2, Math.PI / 2)))),
        region('outside-bottom', '下', yellow, [p.o3Bottom, p.o4Bottom]
          .concat(dropFirst(circleArcPoints(points.O4.x, points.O4.y, radius, -Math.PI / 2, Math.PI / 2)))
          .concat(dropFirst(circleArcPoints(points.O3.x, points.O3.y, radius, Math.PI, Math.PI / 2)))),
        region('outside-left', '左', yellow, [p.o4Left, p.o1Left]
          .concat(dropFirst(circleArcPoints(points.O1.x, points.O1.y, radius, Math.PI, Math.PI / 2)))
          .concat(dropFirst(circleArcPoints(points.O4.x, points.O4.y, radius, Math.PI / 2, Math.PI / 2)))),
        region('outside-center', '中心', red, circleArcPoints(points.O2.x, points.O2.y, radius, Math.PI, Math.PI / 2)
          .concat(dropFirst(circleArcPoints(points.O3.x, points.O3.y, radius, Math.PI / 2, Math.PI / 2)))
          .concat(dropFirst(circleArcPoints(points.O4.x, points.O4.y, radius, 0, Math.PI / 2)))
          .concat(dropFirst(circleArcPoints(points.O1.x, points.O1.y, radius, -Math.PI / 2, Math.PI / 2))))
      ].concat(circleAreas);

      currentGeometry.extraAreas.forEach(appendExtraArea);
      stage.appendChild(createSvg('polygon', {
        points: [points.A, points.B, points.C, points.D].map(function (point) { return point.x + ',' + point.y; }).join(' '),
        fill: 'none',
        class: 'square-sector-outline'
      }));
      circleAreas.forEach(function (area) {
        stage.appendChild(createSvg('path', {
          d: area.path,
          fill: 'none',
          class: 'arc-line square-sector-arc'
        }));
      });

      appendMeasureHit('AB', { P: points.A, Q: points.B });
      drawSideKind(stage, state.measureKinds.AB, points.A, points.B);
      appendMeasureLabel('AB', { P: points.A, Q: points.B }, { x: (points.A.x + points.B.x) / 2, y: points.A.y - 42 }, points);

      renderPointLabels(points);
      currentGeometry.extraAreas.forEach(renderExtraAreaLabel);
    }

    function renderSquareSemicircle1(layout, points) {
      const sidePx = currentGeometry.side * layout.scale;
      const radius = sidePx / 2;
      const topCenter = { x: (points.A.x + points.B.x) / 2, y: points.A.y };
      const bottomCenter = { x: (points.D.x + points.C.x) / 2, y: points.D.y };
      const topArc = circleArcPoints(topCenter.x, topCenter.y, radius, Math.PI, Math.PI);
      const bottomArc = circleArcPoints(bottomCenter.x, bottomCenter.y, radius, 0, Math.PI);

      function dropFirst(list) { return list.slice(1); }
      function closed(pointsList) { return linePath(pointsList) + ' Z'; }
      function areaValue(pointsList) {
        let sum = 0;
        for (let i = 0; i < pointsList.length; i += 1) {
          const p = pointsList[i];
          const next = pointsList[(i + 1) % pointsList.length];
          sum += p.x * next.y - next.x * p.y;
        }
        return Math.abs(sum) / 2 / (layout.scale * layout.scale);
      }
      function region(id, name, color, pointsList) {
        return {
          id: id,
          name: name,
          color: color,
          path: closed(pointsList),
          points: pointsList,
          value: areaValue(pointsList)
        };
      }

      const middleIndex = Math.floor(topArc.length / 2);
      const topLeftArc = topArc.slice(0, middleIndex + 1);
      const topRightArc = topArc.slice(middleIndex);
      const bottomRightArc = bottomArc.slice(0, middleIndex + 1);
      const bottomLeftArc = bottomArc.slice(middleIndex);
      const leftArea = [points.A].concat(dropFirst(topLeftArc), dropFirst(bottomLeftArc), [points.D, points.A]);
      const rightArea = [points.B, points.C].concat(dropFirst(bottomRightArc), dropFirst(topRightArc), [points.B]);
      currentGeometry.extraAreas = [
        region('top-semicircle', 'ABの半円', '#2a5bd7', [points.A, points.B].concat(dropFirst(topArc.slice().reverse()), [points.A])),
        region('bottom-semicircle', 'CDの半円', '#e53935', [points.C, points.D].concat(dropFirst(bottomArc.slice().reverse()), [points.C])),
        region('left-outside', '左の領域', '#2e7d32', leftArea),
        region('right-outside', '右の領域', '#f2c94c', rightArea)
      ];

      currentGeometry.extraAreas.forEach(appendExtraArea);
      stage.appendChild(createSvg('polygon', {
        points: [points.A, points.B, points.C, points.D].map(function (point) { return point.x + ',' + point.y; }).join(' '),
        fill: 'none',
        class: 'square-sector-outline'
      }));
      [topArc, bottomArc].forEach(function (arcPoints) {
        stage.appendChild(createSvg('path', { d: linePath(arcPoints), class: 'arc-line square-sector-arc' }));
      });

      appendMeasureHit('AB', { P: points.A, Q: points.B });
      drawSideKind(stage, state.measureKinds.AB, points.A, points.B);
      appendMeasureLabel('AB', { P: points.A, Q: points.B }, { x: (points.A.x + points.B.x) / 2, y: points.A.y - 42 }, points);

      ['A', 'B', 'C', 'D', 'O'].forEach(function (id) {
        stage.appendChild(createSvg('circle', {
          cx: points[id].x,
          cy: points[id].y,
          r: id === 'O' ? 7 : 8,
          fill: '#1f2430'
        }));
        appendHit('point', id, createSvg('circle', { cx: points[id].x, cy: points[id].y, r: 30 }));
      });

      renderPointLabels(points);
      currentGeometry.extraAreas.forEach(renderExtraAreaLabel);
    }

    function renderSquareSemicircle2(layout, points) {
      const sidePx = currentGeometry.side * layout.scale;
      const radius = sidePx / 2;
      const leftCenter = { x: points.A.x, y: (points.A.y + points.D.y) / 2 };
      const topCenter = { x: (points.A.x + points.B.x) / 2, y: points.A.y };
      const arcAD = circleArcPoints(leftCenter.x, leftCenter.y, radius, Math.PI / 2, -Math.PI);
      const arcAB = circleArcPoints(topCenter.x, topCenter.y, radius, Math.PI, Math.PI);

      function dropFirst(list) { return list.slice(1); }
      function closed(pointsList) { return linePath(pointsList) + ' Z'; }
      function areaValue(pointsList) {
        let sum = 0;
        for (let i = 0; i < pointsList.length; i += 1) {
          const p = pointsList[i];
          const next = pointsList[(i + 1) % pointsList.length];
          sum += p.x * next.y - next.x * p.y;
        }
        return Math.abs(sum) / 2 / (layout.scale * layout.scale);
      }
      function region(id, name, color, pointsList) {
        return {
          id: id,
          name: name,
          color: color,
          path: closed(pointsList),
          points: pointsList,
          value: areaValue(pointsList)
        };
      }

      const middleIndex = Math.floor(arcAD.length / 2);
      const adTop = arcAD.slice(0, middleIndex + 1);
      const adBottom = arcAD.slice(middleIndex);
      const abLeft = arcAB.slice(0, middleIndex + 1);
      const abRight = arcAB.slice(middleIndex);
      const overlap = adTop.concat(dropFirst(abLeft.slice().reverse()));
      const adOnly = [points.D, points.A].concat(dropFirst(abLeft), dropFirst(adBottom));
      const abOnly = [points.A, points.B].concat(dropFirst(abRight.slice().reverse()), dropFirst(adTop.slice().reverse()));
      const outside = [points.B, points.C, points.D].concat(dropFirst(adBottom.slice().reverse()), dropFirst(abRight));

      currentGeometry.extraAreas = [
        region('overlap', '重なり', '#e53935', overlap),
        region('ad-semicircle', 'ADの半円', '#2e7d32', adOnly),
        region('ab-semicircle', 'ABの半円', '#2a5bd7', abOnly),
        region('outside', '外側', '#f2c94c', outside)
      ];

      currentGeometry.extraAreas.forEach(appendExtraArea);
      stage.appendChild(createSvg('polygon', {
        points: [points.A, points.B, points.C, points.D].map(function (point) { return point.x + ',' + point.y; }).join(' '),
        fill: 'none',
        class: 'square-sector-outline'
      }));
      [arcAD, arcAB].forEach(function (arcPoints) {
        stage.appendChild(createSvg('path', { d: linePath(arcPoints), class: 'arc-line square-sector-arc' }));
      });

      appendMeasureHit('AB', { P: points.A, Q: points.B });
      drawSideKind(stage, state.measureKinds.AB, points.A, points.B);
      appendMeasureLabel('AB', { P: points.A, Q: points.B }, { x: (points.A.x + points.B.x) / 2, y: points.A.y - 42 }, points);

      ['A', 'B', 'C', 'D', 'O'].forEach(function (id) {
        stage.appendChild(createSvg('circle', {
          cx: points[id].x,
          cy: points[id].y,
          r: id === 'O' ? 7 : 8,
          fill: '#1f2430'
        }));
        appendHit('point', id, createSvg('circle', { cx: points[id].x, cy: points[id].y, r: 30 }));
      });

      renderPointLabels(points);
      currentGeometry.extraAreas.forEach(renderExtraAreaLabel);
    }

    function renderSquareQuarterSector(layout, points) {
      const sidePx = currentGeometry.side * layout.scale;
      const P = points.P;
      const D = points.D;
      const B = points.B;
      const dx = D.x - P.x;
      const dy = D.y - P.y;
      const fx = P.x - B.x;
      const fy = P.y - B.y;
      const a = dx * dx + dy * dy;
      const b = 2 * (fx * dx + fy * dy);
      const c = fx * fx + fy * fy - sidePx * sidePx;
      const discriminant = Math.max(0, b * b - 4 * a * c);
      const t = (-b + Math.sqrt(discriminant)) / (2 * a);
      const E = { x: P.x + dx * t, y: P.y + dy * t };
      points.E = E;
      const arcAE = circleArcBetweenPoints(B, sidePx, points.A, E);
      const arcEC = circleArcBetweenPoints(B, sidePx, E, points.C);
      const arcEA = circleArcBetweenPoints(B, sidePx, E, points.A);
      const arcCE = circleArcBetweenPoints(B, sidePx, points.C, E);
      function dropFirst(list) { return list.slice(1); }
      function closed(pointsList) { return linePath(pointsList) + ' Z'; }
      function areaValue(pointsList) {
        let sum = 0;
        for (let i = 0; i < pointsList.length; i += 1) {
          const p = pointsList[i];
          const next = pointsList[(i + 1) % pointsList.length];
          sum += p.x * next.y - next.x * p.y;
        }
        return Math.abs(sum) / 2 / (layout.scale * layout.scale);
      }
      function region(id, name, color, pointsList) {
        return {
          id: id,
          name: name,
          color: color,
          path: closed(pointsList),
          points: pointsList,
          value: areaValue(pointsList)
        };
      }

      const lowerLeft = [B, points.A].concat(dropFirst(arcAE)).concat([P]);
      const lowerRight = [P, E].concat(dropFirst(arcEC)).concat([points.C]);
      const upperLeft = [points.A, D, E].concat(dropFirst(arcEA));
      const upperRight = [D, points.C].concat(dropFirst(arcCE)).concat([E]);
      currentGeometry.extraAreas = [
        region('sector-left', '扇形左側領域', '#2a5bd7', lowerLeft),
        region('sector-right', '扇形右側領域', '#2e7d32', lowerRight),
        region('outside-left', '弧の外側左領域', '#8e44ad', upperLeft),
        region('outside-right', '弧の外側右領域', '#e53935', upperRight)
      ];

      currentGeometry.extraAreas.forEach(appendExtraArea);
      stage.appendChild(createSvg('polygon', {
        points: [points.A, points.B, points.C, points.D].map(function (point) { return point.x + ',' + point.y; }).join(' '),
        fill: 'none',
        class: 'square-sector-outline'
      }));
      stage.appendChild(createSvg('path', { d: linePath(arcAE.concat(dropFirst(arcEC))), class: 'arc-line square-sector-arc' }));
      stage.appendChild(createSvg('line', { x1: points.P.x, y1: points.P.y, x2: points.D.x, y2: points.D.y, class: 'axis-line' }));
      stage.appendChild(createSvg('line', { x1: points.A.x, y1: points.A.y, x2: points.B.x, y2: points.B.y, class: 'axis-line' }));
      stage.appendChild(createSvg('line', { x1: points.B.x, y1: points.B.y, x2: points.C.x, y2: points.C.y, class: 'axis-line' }));

      [['AB', 'A', 'B'], ['BP', 'B', 'P'], ['PC', 'P', 'C'], ['PE', 'P', 'E'], ['ED', 'E', 'D'], ['CD', 'C', 'D'], ['DA', 'D', 'A']].forEach(function (entry) {
        appendMeasureHit(entry[0], { P: points[entry[1]], Q: points[entry[2]] });
        drawSideKind(stage, state.measureKinds[entry[0]], points[entry[1]], points[entry[2]]);
      });
      appendHit('measure', 'arcCE', createSvg('path', { d: linePath(arcCE), class: 'hit-measure-arc' }));
      appendHit('measure', 'arcEA', createSvg('path', { d: linePath(arcEA), class: 'hit-measure-arc' }));
      drawCurveKind(stage, state.measureKinds.arcCE, arcCE);
      drawCurveKind(stage, state.measureKinds.arcEA, arcEA);
      appendMeasureLabel('AB', { P: points.A, Q: points.B }, { x: points.A.x - 44, y: (points.A.y + points.B.y) / 2 }, points);
      appendMeasureLabel('BP', { P: points.B, Q: points.P }, { x: (points.B.x + points.P.x) / 2, y: points.B.y + 42 }, points);
      appendMeasureLabel('PC', { P: points.P, Q: points.C }, { x: (points.P.x + points.C.x) / 2, y: points.C.y + 42 }, points);
      appendMeasureLabel('PE', { P: points.P, Q: points.E }, { x: (points.P.x + points.E.x) / 2 + 26, y: (points.P.y + points.E.y) / 2 + 12 }, points);
      appendMeasureLabel('ED', { P: points.E, Q: points.D }, { x: (points.E.x + points.D.x) / 2 + 26, y: (points.E.y + points.D.y) / 2 - 12 }, points);
      appendMeasureLabel('CD', { P: points.C, Q: points.D }, { x: points.C.x + 44, y: (points.C.y + points.D.y) / 2 }, points);
      appendMeasureLabel('DA', { P: points.D, Q: points.A }, { x: (points.D.x + points.A.x) / 2, y: points.D.y - 42 }, points);
      appendText('measure', 'arcCE', textForLabel(state.measureInputs.arcCE, currentGeometry.measures.arcCE), (E.x + points.C.x) / 2 + 34, (E.y + points.C.y) / 2 + 16, 'measure-label');
      appendText('measure', 'arcEA', textForLabel(state.measureInputs.arcEA, currentGeometry.measures.arcEA), (E.x + points.A.x) / 2 - 34, (E.y + points.A.y) / 2 - 16, 'measure-label');

      ['A', 'B', 'C', 'D', 'P', 'E'].forEach(function (id) {
        stage.appendChild(createSvg('circle', {
          cx: points[id].x,
          cy: points[id].y,
          r: id === 'P' || id === 'E' ? 7 : 8,
          fill: '#1f2430'
        }));
        appendHit('point', id, createSvg('circle', { cx: points[id].x, cy: points[id].y, r: 30 }));
      });
      renderPointLabels(points);
      currentGeometry.extraAreas.forEach(renderExtraAreaLabel);
    }

    function renderInscribedCenterAngle(layout, points) {
      const radius = currentGeometry.radiusX * layout.scale;
      const alpha = currentGeometry.angleRadians;
      const startAngle = (Math.PI * 3 / 2) - alpha;
      const centralSweep = currentGeometry.centralAngleRadians;
      const centerAngleRadius = radius * 0.22;
      const inscribedAngleRadius = radius * 0.16;
      const baseAngleRadius = radius * 0.13;
      const centerArcPoints = circleArcPoints(points.O.x, points.O.y, centerAngleRadius, startAngle, centralSweep);
      const inscribedArcPoints = angleArcPoints(points.C, points.A, points.B, inscribedAngleRadius);
      const caoArcPoints = angleArcPoints(points.A, points.C, points.O, baseAngleRadius);
      const cboArcPoints = angleArcPoints(points.B, points.C, points.O, baseAngleRadius);
      const centerArc = linePath(centerArcPoints);
      const inscribedArc = linePath(inscribedArcPoints);
      const caoArc = linePath(caoArcPoints);
      const cboArc = linePath(cboArcPoints);
      const centerLabelAngle = startAngle + centralSweep / 2;
      const centerLabelPoint = {
        x: points.O.x + radius * 0.32 * Math.cos(centerLabelAngle),
        y: points.O.y - radius * 0.32 * Math.sin(centerLabelAngle)
      };
      const inscribedLabelPoint = {
        x: points.C.x,
        y: points.C.y + radius * 0.22
      };
      const caoLabelPoint = angleLabelPoint(points.A, points.C, points.O, radius * 0.24);
      const cboLabelPoint = angleLabelPoint(points.B, points.C, points.O, radius * 0.24);

      stage.appendChild(createSvg('ellipse', {
        cx: layout.cx,
        cy: layout.cy,
        rx: radius,
        ry: radius,
        fill: areaShapeFill(0.08),
        class: 'shape-fill'
      }));
      if (showArea) {
        appendHit('area', 'main', createSvg('ellipse', {
          cx: layout.cx,
          cy: layout.cy,
          rx: radius,
          ry: radius
        }));
      }

      [['A', points.A], ['B', points.B]].forEach(function (entry) {
        stage.appendChild(createSvg('line', { x1: points.O.x, y1: points.O.y, x2: entry[1].x, y2: entry[1].y, class: 'axis-line' }));
      });
      stage.appendChild(createSvg('line', { x1: points.C.x, y1: points.C.y, x2: points.A.x, y2: points.A.y, class: 'axis-line chord-line' }));
      stage.appendChild(createSvg('line', { x1: points.C.x, y1: points.C.y, x2: points.B.x, y2: points.B.y, class: 'axis-line chord-line' }));
      drawAngleDecoration('AOB', centerArc, centerArcPoints, points.O, currentGeometry.angles.AOB, { p1: points.A, p2: points.B });
      drawAngleDecoration('ACB', inscribedArc, inscribedArcPoints, points.C, currentGeometry.angles.ACB, { p1: points.A, p2: points.B });
      drawAngleDecoration('CAO', caoArc, caoArcPoints, points.A, currentGeometry.angles.CAO, { p1: points.C, p2: points.O });
      drawAngleDecoration('CBO', cboArc, cboArcPoints, points.B, currentGeometry.angles.CBO, { p1: points.C, p2: points.O });

      appendHit('point', 'O', createSvg('circle', { cx: points.O.x, cy: points.O.y, r: 30 }));
      ['A', 'B', 'C'].forEach(function (id) {
        appendHit('point', id, createSvg('circle', { cx: points[id].x, cy: points[id].y, r: 30 }));
      });
      ['A', 'B', 'C', 'O'].forEach(function (id) {
        const point = points[id];
        stage.appendChild(createSvg('circle', {
          cx: point.x,
          cy: point.y,
          r: 8,
          class: id === 'O' ? 'center-point' : '',
          fill: id === 'O' ? null : '#1f2430'
        }));
      });
      renderPointLabels(points);
      appendText('angle', 'ACB', textForLabel(state.angleInputs.ACB, currentGeometry.angles.ACB, formatAngle), inscribedLabelPoint.x, inscribedLabelPoint.y, 'angle-label');
      appendText('angle', 'AOB', textForLabel(state.angleInputs.AOB, currentGeometry.angles.AOB, formatAngle), centerLabelPoint.x, centerLabelPoint.y, 'angle-label');
      appendText('angle', 'CAO', textForLabel(state.angleInputs.CAO, currentGeometry.angles.CAO, formatAngle), caoLabelPoint.x, caoLabelPoint.y, 'angle-label');
      appendText('angle', 'CBO', textForLabel(state.angleInputs.CBO, currentGeometry.angles.CBO, formatAngle), cboLabelPoint.x, cboLabelPoint.y, 'angle-label');
    }

    function renderTwoInscribedAngles(layout, points) {
      const radius = currentGeometry.radiusX * layout.scale;
      const chords = [
        ['AC', 'A', 'C'],
        ['BC', 'B', 'C'],
        ['AD', 'A', 'D'],
        ['BD', 'B', 'D']
      ];
      const angles = {
        ACB: ['A', 'C', 'B'],
        ADB: ['A', 'D', 'B'],
        CAD: ['C', 'A', 'D'],
        CBD: ['C', 'B', 'D']
      };

      Object.keys(angles).forEach(function (id) {
        const ids = angles[id];
        currentGeometry.angles[id] = angleValue(points[ids[0]], points[ids[1]], points[ids[2]]);
      });

      stage.appendChild(createSvg('ellipse', {
        cx: layout.cx,
        cy: layout.cy,
        rx: radius,
        ry: radius,
        fill: areaShapeFill(0.08),
        class: 'shape-fill'
      }));
      if (showArea) {
        appendHit('area', 'main', createSvg('ellipse', {
          cx: layout.cx,
          cy: layout.cy,
          rx: radius,
          ry: radius
        }));
      }

      chords.forEach(function (entry) {
        const P = points[entry[1]];
        const Q = points[entry[2]];
        stage.appendChild(createSvg('line', { x1: P.x, y1: P.y, x2: Q.x, y2: Q.y, class: 'axis-line chord-line' }));
      });

      Object.keys(angles).forEach(function (id) {
        const ids = angles[id];
        const vertex = points[ids[1]];
        const arc = angleArcPoints(vertex, points[ids[0]], points[ids[2]], radius * 0.14);
        drawAngleDecoration(id, linePath(arc), arc, vertex, currentGeometry.angles[id], { p1: points[ids[0]], p2: points[ids[2]] });
      });

      ['A', 'B', 'C', 'D'].forEach(function (id) {
        appendHit('point', id, createSvg('circle', { cx: points[id].x, cy: points[id].y, r: 30 }));
        stage.appendChild(createSvg('circle', {
          cx: points[id].x,
          cy: points[id].y,
          r: 8,
          fill: '#1f2430'
        }));
      });

      renderPointLabels(points);
      Object.keys(angles).forEach(function (id) {
        const ids = angles[id];
        const labelPoint = angleLabelPoint(points[ids[1]], points[ids[0]], points[ids[2]], radius * 0.25);
        appendText('angle', id, textForLabel(state.angleInputs[id], currentGeometry.angles[id], formatAngle), labelPoint.x, labelPoint.y, 'angle-label');
      });
    }

    function renderInscribedAngleApplication1(layout, points) {
      const radius = currentGeometry.radiusX * layout.scale;
      const angles = {
        BED: ['B', 'E', 'D'],
        APC: ['A', 'P', 'C'],
        PAC: ['P', 'A', 'C'],
        ACA: ['A', 'C', 'A'],
        PAE: ['P', 'A', 'E'],
        PCE: ['P', 'C', 'E'],
        AEC: ['A', 'E', 'C'],
        ECD: ['E', 'C', 'D'],
        EAB: ['E', 'A', 'B'],
        ABE: ['A', 'B', 'E'],
        CDE: ['C', 'D', 'E']
      };
      const pageAngleArcRadius = radius * 0.13;

      Object.keys(angles).forEach(function (id) {
        const ids = angles[id];
        currentGeometry.angles[id] = angleValue(points[ids[0]], points[ids[1]], points[ids[2]]);
      });

      stage.appendChild(createSvg('ellipse', {
        cx: points.O.x,
        cy: points.O.y,
        rx: radius,
        ry: radius,
        fill: areaShapeFill(0.08),
        class: 'shape-fill'
      }));
      if (showArea) {
        appendHit('area', 'main', createSvg('ellipse', {
          cx: points.O.x,
          cy: points.O.y,
          rx: radius,
          ry: radius
        }));
      }

      [
        ['secant', 'P', 'B'],
        ['secant', 'P', 'D'],
        ['chord', 'A', 'D'],
        ['chord', 'B', 'C']
      ].forEach(function (entry) {
        const P = points[entry[1]];
        const Q = points[entry[2]];
        stage.appendChild(createSvg('line', {
          x1: P.x,
          y1: P.y,
          x2: Q.x,
          y2: Q.y,
          class: entry[0] === 'secant' ? 'axis-line' : 'axis-line chord-line'
        }));
      });

      Object.keys(angles).forEach(function (id) {
        const ids = angles[id];
        const vertex = points[ids[1]];
        const arc = angleArcPoints(vertex, points[ids[0]], points[ids[2]], pageAngleArcRadius);
        drawAngleDecoration(id, linePath(arc), arc, vertex, currentGeometry.angles[id], { p1: points[ids[0]], p2: points[ids[2]] });
      });

      ['O', 'P', 'A', 'B', 'C', 'D', 'E'].forEach(function (id) {
        appendHit('point', id, createSvg('circle', { cx: points[id].x, cy: points[id].y, r: 30 }));
        stage.appendChild(createSvg('circle', {
          cx: points[id].x,
          cy: points[id].y,
          r: id === 'O' || id === 'P' || id === 'E' ? 7 : 8,
          class: id === 'O' ? 'center-point' : '',
          fill: id === 'O' ? null : (id === 'P' || id === 'E' ? '#b42318' : '#1f2430')
        }));
      });

      renderPointLabels(points);
      Object.keys(angles).forEach(function (id) {
        const ids = angles[id];
        const customLabelPoints = {
          PAC: { x: points.A.x - radius * 0.35, y: points.A.y + radius * 0.10 },
          ACA: { x: points.C.x - radius * 0.24, y: points.C.y - radius * 0.08 },
          PAE: { x: points.A.x + radius * 0.23, y: points.A.y + radius * 0.18 },
          PCE: { x: points.C.x + radius * 0.25, y: points.C.y - radius * 0.03 },
          AEC: { x: points.E.x - radius * 0.22, y: points.E.y + radius * 0.17 },
          ECD: { x: points.C.x + radius * 0.17, y: points.C.y + radius * 0.17 },
          EAB: { x: points.A.x + radius * 0.19, y: points.A.y - radius * 0.09 },
          ABE: { x: points.B.x - radius * 0.17, y: points.B.y + radius * 0.08 },
          CDE: { x: points.D.x - radius * 0.17, y: points.D.y - radius * 0.08 }
        };
        const labelDistance = {
          BED: 0.23,
          APC: 0.29,
          PAC: 0.22,
          ACA: 0.20,
          PAE: 0.28,
          PCE: 0.27,
          AEC: 0.20,
          ECD: 0.24,
          EAB: 0.25,
          ABE: 0.23,
          CDE: 0.23
        }[id] || 0.23;
        const labelPoint = customLabelPoints[id] || angleLabelPoint(points[ids[1]], points[ids[0]], points[ids[2]], radius * labelDistance);
        appendText('angle', id, textForLabel(state.angleInputs[id], currentGeometry.angles[id], formatAngle), labelPoint.x, labelPoint.y, id === 'BED' || id === 'APC' || id === 'PAE' || id === 'PCE' ? 'angle-label' : 'angle-label compact-angle-label');
      });
    }

    function renderInscribedAngleApplication2(layout, points) {
      const radius = currentGeometry.radiusY * layout.scale;
      const angles = {
        APB: ['A', 'P', 'B'],
        ACB: ['A', 'C', 'B'],
        PAC: ['P', 'A', 'C'],
        ABC: ['A', 'B', 'C'],
        CBP: ['C', 'B', 'P']
      };

      Object.keys(angles).forEach(function (id) {
        const ids = angles[id];
        currentGeometry.angles[id] = angleValue(points[ids[0]], points[ids[1]], points[ids[2]]);
      });

      stage.appendChild(createSvg('ellipse', {
        cx: layout.cx,
        cy: layout.cy,
        rx: radius,
        ry: radius,
        fill: areaShapeFill(0.06),
        class: 'shape-fill'
      }));
      if (showArea) {
        appendHit('area', 'main', createSvg('ellipse', {
          cx: layout.cx,
          cy: layout.cy,
          rx: radius,
          ry: radius
        }));
      }

      [
        ['A', 'P'],
        ['B', 'P'],
        ['A', 'C'],
        ['B', 'C']
      ].forEach(function (entry) {
        stage.appendChild(createSvg('line', {
          x1: points[entry[0]].x,
          y1: points[entry[0]].y,
          x2: points[entry[1]].x,
          y2: points[entry[1]].y,
          class: 'axis-line chord-line'
        }));
      });

      Object.keys(angles).forEach(function (id) {
        const ids = angles[id];
        const vertex = points[ids[1]];
        const pageAngleArcRadius = radius * 0.16;
        const arc = angleArcPoints(vertex, points[ids[0]], points[ids[2]], pageAngleArcRadius);
        drawAngleDecoration(id, linePath(arc), arc, vertex, currentGeometry.angles[id], { p1: points[ids[0]], p2: points[ids[2]] });
      });

      ['O', 'P', 'A', 'B', 'C'].forEach(function (id) {
        appendHit('point', id, createSvg('circle', { cx: points[id].x, cy: points[id].y, r: 30 }));
        stage.appendChild(createSvg('circle', {
          cx: points[id].x,
          cy: points[id].y,
          r: id === 'O' ? 7 : 8,
          class: id === 'O' ? 'center-point' : '',
          fill: id === 'O' ? null : '#1f2430'
        }));
      });

      renderPointLabels(points);
      Object.keys(angles).forEach(function (id) {
        const ids = angles[id];
        const labelDistance = { APB: 0.27, ACB: 0.31, PAC: 0.25, ABC: 0.23, CBP: 0.25 }[id] || 0.25;
        const labelPoint = angleLabelPoint(points[ids[1]], points[ids[0]], points[ids[2]], radius * labelDistance);
        appendText('angle', id, textForLabel(state.angleInputs[id], currentGeometry.angles[id], formatAngle), labelPoint.x, labelPoint.y, id === 'APB' || id === 'PAC' ? 'angle-label' : 'angle-label compact-angle-label');
      });
    }

    function renderInscribedAngleApplication3(layout, points) {
      const radius = currentGeometry.radiusX * layout.scale;
      const angles = {
        DEC: ['D', 'E', 'C'],
        BAC: ['B', 'A', 'C'],
        BOD: ['B', 'O', 'D']
      };

      Object.keys(angles).forEach(function (id) {
        const ids = angles[id];
        currentGeometry.angles[id] = angleValue(points[ids[0]], points[ids[1]], points[ids[2]]);
      });

      stage.appendChild(createSvg('ellipse', {
        cx: layout.cx,
        cy: layout.cy,
        rx: radius,
        ry: radius,
        fill: areaShapeFill(0.06),
        class: 'shape-fill'
      }));
      if (showArea) {
        appendHit('area', 'main', createSvg('ellipse', {
          cx: layout.cx,
          cy: layout.cy,
          rx: radius,
          ry: radius
        }));
      }

      [
        ['O', 'B'],
        ['O', 'D'],
        ['B', 'A'],
        ['A', 'C'],
        ['C', 'E'],
        ['E', 'D']
      ].forEach(function (entry) {
        stage.appendChild(createSvg('line', {
          x1: points[entry[0]].x,
          y1: points[entry[0]].y,
          x2: points[entry[1]].x,
          y2: points[entry[1]].y,
          class: 'axis-line chord-line'
        }));
      });

      Object.keys(angles).forEach(function (id) {
        const ids = angles[id];
        const vertex = points[ids[1]];
        const arcRadius = id === 'BOD' ? radius * 0.22 : radius * (id === 'DEC' ? 0.16 : 0.15);
        const arc = angleArcPoints(vertex, points[ids[0]], points[ids[2]], arcRadius);
        drawAngleDecoration(id, linePath(arc), arc, vertex, currentGeometry.angles[id], { p1: points[ids[0]], p2: points[ids[2]] });
      });

      ['O', 'A', 'B', 'C', 'D', 'E'].forEach(function (id) {
        appendHit('point', id, createSvg('circle', { cx: points[id].x, cy: points[id].y, r: 30 }));
        stage.appendChild(createSvg('circle', {
          cx: points[id].x,
          cy: points[id].y,
          r: id === 'O' ? 7 : 8,
          class: id === 'O' ? 'center-point' : '',
          fill: id === 'O' ? null : '#1f2430'
        }));
      });

      renderPointLabels(points);
      Object.keys(angles).forEach(function (id) {
        const ids = angles[id];
        const labelDistance = { DEC: 0.25, BAC: 0.23, BOD: 0.32 }[id] || 0.24;
        const labelPoint = angleLabelPoint(points[ids[1]], points[ids[0]], points[ids[2]], radius * labelDistance);
        appendText('angle', id, textForLabel(state.angleInputs[id], currentGeometry.angles[id], formatAngle), labelPoint.x, labelPoint.y, id === 'BOD' ? 'angle-label compact-angle-label' : 'angle-label');
      });
    }

    function renderInscribedAngleApplication5(layout, points) {
      const radius = currentGeometry.radiusX * layout.scale;
      const angles = {
        DEC: ['D', 'E', 'C'],
        BAC: ['B', 'A', 'C'],
        BFD: ['B', 'F', 'D']
      };

      Object.keys(angles).forEach(function (id) {
        const ids = angles[id];
        currentGeometry.angles[id] = angleValue(points[ids[0]], points[ids[1]], points[ids[2]]);
      });

      stage.appendChild(createSvg('ellipse', {
        cx: layout.cx,
        cy: layout.cy,
        rx: radius,
        ry: radius,
        fill: areaShapeFill(0.06),
        class: 'shape-fill'
      }));
      if (showArea) {
        appendHit('area', 'main', createSvg('ellipse', {
          cx: layout.cx,
          cy: layout.cy,
          rx: radius,
          ry: radius
        }));
      }

      [
        ['A', 'B'],
        ['B', 'F'],
        ['F', 'D'],
        ['D', 'E'],
        ['E', 'C'],
        ['C', 'A']
      ].forEach(function (entry) {
        stage.appendChild(createSvg('line', {
          x1: points[entry[0]].x,
          y1: points[entry[0]].y,
          x2: points[entry[1]].x,
          y2: points[entry[1]].y,
          class: 'axis-line chord-line'
        }));
      });

      Object.keys(angles).forEach(function (id) {
        const ids = angles[id];
        const vertex = points[ids[1]];
        const arcRadius = id === 'BFD' ? radius * 0.17 : radius * (id === 'DEC' ? 0.16 : 0.15);
        const arc = angleArcPoints(vertex, points[ids[0]], points[ids[2]], arcRadius);
        drawAngleDecoration(id, linePath(arc), arc, vertex, currentGeometry.angles[id], { p1: points[ids[0]], p2: points[ids[2]] });
      });

      ['O', 'A', 'B', 'C', 'D', 'E', 'F'].forEach(function (id) {
        appendHit('point', id, createSvg('circle', { cx: points[id].x, cy: points[id].y, r: 30 }));
        stage.appendChild(createSvg('circle', {
          cx: points[id].x,
          cy: points[id].y,
          r: id === 'O' ? 7 : 8,
          class: id === 'O' ? 'center-point' : '',
          fill: id === 'O' ? null : '#1f2430'
        }));
      });

      renderPointLabels(points);
      Object.keys(angles).forEach(function (id) {
        const ids = angles[id];
        const labelDistance = { DEC: 0.25, BAC: 0.23, BFD: 0.28 }[id] || 0.24;
        const labelPoint = angleLabelPoint(points[ids[1]], points[ids[0]], points[ids[2]], radius * labelDistance);
        appendText('angle', id, textForLabel(state.angleInputs[id], currentGeometry.angles[id], formatAngle), labelPoint.x, labelPoint.y, id === 'BFD' ? 'angle-label compact-angle-label' : 'angle-label');
      });
    }

    function renderInscribedAngleApplication4(layout, points) {
      const radius = currentGeometry.radiusX * layout.scale;
      const angles = {
        OAC: ['O', 'A', 'C'],
        OBC: ['O', 'B', 'C'],
        BOA: ['B', 'O', 'A'],
        BCA: ['B', 'C', 'A']
      };

      Object.keys(angles).forEach(function (id) {
        const ids = angles[id];
        currentGeometry.angles[id] = angleValue(points[ids[0]], points[ids[1]], points[ids[2]]);
      });

      stage.appendChild(createSvg('ellipse', {
        cx: layout.cx,
        cy: layout.cy,
        rx: radius,
        ry: radius,
        fill: areaShapeFill(0.06),
        class: 'shape-fill'
      }));
      if (showArea) {
        appendHit('area', 'main', createSvg('ellipse', {
          cx: layout.cx,
          cy: layout.cy,
          rx: radius,
          ry: radius
        }));
      }

      [
        ['O', 'A'],
        ['O', 'B'],
        ['A', 'C'],
        ['B', 'C']
      ].forEach(function (entry) {
        stage.appendChild(createSvg('line', {
          x1: points[entry[0]].x,
          y1: points[entry[0]].y,
          x2: points[entry[1]].x,
          y2: points[entry[1]].y,
          class: 'axis-line chord-line'
        }));
      });

      Object.keys(angles).forEach(function (id) {
        const ids = angles[id];
        const vertex = points[ids[1]];
        const pageAngleArcRadius = radius * 0.15;
        const arc = angleArcPoints(vertex, points[ids[0]], points[ids[2]], pageAngleArcRadius);
        drawAngleDecoration(id, linePath(arc), arc, vertex, currentGeometry.angles[id], { p1: points[ids[0]], p2: points[ids[2]] });
      });

      ['O', 'A', 'B', 'C'].forEach(function (id) {
        appendHit('point', id, createSvg('circle', { cx: points[id].x, cy: points[id].y, r: 30 }));
        stage.appendChild(createSvg('circle', {
          cx: points[id].x,
          cy: points[id].y,
          r: id === 'O' ? 7 : 8,
          class: id === 'O' ? 'center-point' : '',
          fill: id === 'O' ? null : '#1f2430'
        }));
      });

      renderPointLabels(points);
      Object.keys(angles).forEach(function (id) {
        const ids = angles[id];
        const labelDistance = { OAC: 0.23, OBC: 0.23, BOA: 0.29, BCA: 0.26 }[id] || 0.24;
        const labelPoint = angleLabelPoint(points[ids[1]], points[ids[0]], points[ids[2]], radius * labelDistance);
        appendText('angle', id, textForLabel(state.angleInputs[id], currentGeometry.angles[id], formatAngle), labelPoint.x, labelPoint.y, id === 'BOA' || id === 'BCA' ? 'angle-label compact-angle-label' : 'angle-label');
      });
    }

    function renderCircleNPoints(layout, points) {
      const radius = currentGeometry.radiusX * layout.scale;
      stage.appendChild(createSvg('ellipse', {
        cx: layout.cx,
        cy: layout.cy,
        rx: radius,
        ry: radius,
        fill: 'none',
        class: 'shape-fill'
      }));

      appendHit('point', 'O', createSvg('circle', { cx: points.O.x, cy: points.O.y, r: 30 }));
      stage.appendChild(createSvg('circle', {
        cx: points.O.x,
        cy: points.O.y,
        r: 8,
        class: 'center-point'
      }));

      currentGeometry.pointIds.forEach(function (id) {
        const point = points[id];
        appendHit('point', id, createSvg('circle', { cx: point.x, cy: point.y, r: 30 }));
        stage.appendChild(createSvg('circle', {
          cx: point.x,
          cy: point.y,
          r: 8,
          fill: '#1f2430'
        }));
      });

      renderPointLabels(points);
    }

    function renderTangentTheorem(layout, points) {
      const radius = currentGeometry.radiusX * layout.scale;
      const trianglePath = linePath([points.A, points.B, points.C]) + ' Z';
      const angles = {
        BAC: ['B', 'A', 'C'],
        ABC: ['A', 'B', 'C'],
        QCB: ['Q', 'C', 'B'],
        ACP: ['A', 'C', 'P']
      };

      stage.appendChild(createSvg('ellipse', {
        cx: layout.cx,
        cy: layout.cy,
        rx: radius,
        ry: radius,
        fill: areaShapeFill(0.08),
        class: 'shape-fill'
      }));
      if (showArea) {
        appendHit('area', 'main', createSvg('ellipse', {
          cx: layout.cx,
          cy: layout.cy,
          rx: radius,
          ry: radius
        }));
      }

      if (showArea) {
        stage.appendChild(createSvg('polygon', { points: [points.A, points.B, points.C].map(function (p) { return p.x + ',' + p.y; }).join(' '), fill: 'rgba(42,91,215,.02)', stroke: 'none' }));
      }
      [['AB', 'A', 'B'], ['BC', 'B', 'C'], ['CA', 'C', 'A']].forEach(function (entry) {
        stage.appendChild(createSvg('line', { x1: points[entry[1]].x, y1: points[entry[1]].y, x2: points[entry[2]].x, y2: points[entry[2]].y, class: 'axis-line chord-line' }));
      });
      stage.appendChild(createSvg('line', { x1: points.P.x, y1: points.P.y, x2: points.Q.x, y2: points.Q.y, class: 'axis-line tangent-line' }));
      if (showArea) appendHit('area', 'ABC', createSvg('path', { d: trianglePath }));

      Object.keys(angles).forEach(function (id) {
        const ids = angles[id];
        const vertex = points[ids[1]];
        const arc = angleArcPoints(vertex, points[ids[0]], points[ids[2]], radius * (id === 'BAC' || id === 'ABC' ? 0.13 : 0.16));
        drawAngleDecoration(id, linePath(arc), arc, vertex, currentGeometry.angles[id], { p1: points[ids[0]], p2: points[ids[2]] });
      });

      ['A', 'B', 'C', 'P', 'Q'].forEach(function (id) {
        appendHit('point', id, createSvg('circle', { cx: points[id].x, cy: points[id].y, r: 30 }));
        stage.appendChild(createSvg('circle', {
          cx: points[id].x,
          cy: points[id].y,
          r: id === 'P' || id === 'Q' ? 6 : 8,
          fill: '#1f2430'
        }));
      });

      renderPointLabels(points);
      Object.keys(angles).forEach(function (id) {
        const ids = angles[id];
        const labelPoint = angleLabelPoint(points[ids[1]], points[ids[0]], points[ids[2]], radius * (id === 'BAC' || id === 'ABC' ? 0.23 : 0.28));
        appendText('angle', id, textForLabel(state.angleInputs[id], currentGeometry.angles[id], formatAngle), labelPoint.x, labelPoint.y, 'angle-label');
      });
    }

    function render() {
      try {
        setActiveDecimalPlaces(state.decimalPlaces);
        currentLabelBases = {};
        Object.keys(controlInputs).forEach(function (key) {
          state.rawControlInputs[key] = String(controlInputs[key].value || '').trim();
        });
        currentGeometry = readGeometry();
        syncStateFromGeometry(currentGeometry);
        stage.innerHTML = '';
        const layout = fitGeometry(currentGeometry.radiusX, currentGeometry.radiusY);
        const points = screenPoints(layout);
        const rx = currentGeometry.radiusX * layout.scale;
        const ry = currentGeometry.radiusY * layout.scale;

        if (currentGeometry.shape === 'inscribed-center-angle') {
          renderInscribedCenterAngle(layout, points);
        } else if (currentGeometry.shape === 'two-inscribed-angles') {
          renderTwoInscribedAngles(layout, points);
        } else if (currentGeometry.shape === 'inscribed-angle-application-1') {
          renderInscribedAngleApplication1(layout, points);
        } else if (currentGeometry.shape === 'inscribed-angle-application-2') {
          renderInscribedAngleApplication2(layout, points);
        } else if (currentGeometry.shape === 'inscribed-angle-application-3') {
          renderInscribedAngleApplication3(layout, points);
        } else if (currentGeometry.shape === 'inscribed-angle-application-5') {
          renderInscribedAngleApplication5(layout, points);
        } else if (currentGeometry.shape === 'inscribed-angle-application-4') {
          renderInscribedAngleApplication4(layout, points);
        } else if (currentGeometry.shape === 'tangent-theorem') {
          renderTangentTheorem(layout, points);
        } else if (currentGeometry.shape === 'quarter-two-semicircles') {
          renderQuarterTwoSemicircles(layout, points);
        } else if (currentGeometry.shape === 'semicircle-and-circle') {
          renderSemicircleAndCircle(layout, points);
        } else if (currentGeometry.shape === 'area-add-subtract-3') {
          renderAreaAddSubtract3(layout, points);
        } else if (currentGeometry.shape === 'area-add-subtract-4') {
          renderAreaAddSubtract4(layout, points);
        } else if (currentGeometry.shape === 'baumkuchen-1') {
          renderBaumkuchen1(layout, points);
        } else if (currentGeometry.shape === 'sal-2') {
          renderSal2(layout, points);
        } else if (currentGeometry.shape === 'sal-3') {
          renderSal3(layout, points);
        } else if (currentGeometry.shape === 'right-triangle-semicircles') {
          renderRightTriangleSemicircles(layout, points);
        } else if (currentGeometry.shape === 'taijitu') {
          renderTaijitu(layout, points);
        } else if (currentGeometry.shape === 'square-corner-sectors') {
          renderSquareCornerSectors(layout, points);
        } else if (currentGeometry.shape === 'square-quarter-sector-3') {
          renderSquareQuarterSector3(layout, points);
        } else if (currentGeometry.shape === 'square-quarter-sector-4') {
          renderSquareQuarterSector4(layout, points);
        } else if (currentGeometry.shape === 'square-circle-1') {
          renderSquareCircle1(layout, points);
        } else if (currentGeometry.shape === 'square-circle-2') {
          renderSquareCircle2(layout, points);
        } else if (currentGeometry.shape === 'square-semicircle-1') {
          renderSquareSemicircle1(layout, points);
        } else if (currentGeometry.shape === 'square-semicircle-2') {
          renderSquareSemicircle2(layout, points);
        } else if (currentGeometry.shape === 'square-quarter-sector') {
          renderSquareQuarterSector(layout, points);
        } else if (currentGeometry.shape === 'circle-n-points') {
          renderCircleNPoints(layout, points);
        } else if (currentGeometry.shape === 'two-circles') {
          renderTwoCircles(layout, points);
        } else if (currentGeometry.shape === 'sector' || currentGeometry.shape === 'ellipse-sector') {
          renderSector(layout, points);
        } else {
          renderFullConic(layout, points, rx, ry);
        }

        fitStageViewBox(stage);
        setStatus(config.readyMessage || '入力をもとに図形を描画しています。', false);
      } catch (error) {
        stage.innerHTML = '';
        stage.setAttribute('viewBox', '0 0 1000 1000');
        currentGeometry = null;
        setStatus(error.message || '入力を確認してください。', true);
      }
    }

    function measureLabel(id) {
      if (id === 'OA') return '線分 OA';
      if (id === 'OB') return '線分 OB';
      if (id === 'OC') return '線分 OC';
      if (id === 'arcAB') return '弧 AB';
      if (id === 'arcOA') return '弧 OA';
      if (id === 'arcOB') return '弧 OB';
      if (id === 'AB') return '線分 AB';
      if (id === 'BP') return '線分 BP';
      if (id === 'PC') return '線分 PC';
      if (id === 'PE') return '線分 PE';
      if (id === 'ED') return '線分 ED';
      if (id === 'DE') return '線分 DE';
      if (id === 'EF') return '線分 EF';
      if (id === 'FD') return '線分 FD';
      if (id === 'GH') return '線分 GH';
      if (id === 'HI') return '線分 HI';
      if (id === 'IG') return '線分 IG';
      if (id === 'JK') return '線分 JK';
      if (id === 'AC') return '線分 AC';
      if (id === 'CA') return '線分 CA';
      if (id === 'MN') return 'a';
      if (id === 'arcAC') return '弧 AC';
      if (id === 'arcBC') return '弧 BC';
      if (id === 'arcCE') return '弧 CE';
      if (id === 'arcEA') return '弧 EA';
      if (id === 'l') return '円周 l';
      if (id === 'AO') return '線分 AO';
      if (id === 'BC') return '線分 BC';
      if (id === 'CD') return '線分 CD';
      if (id === 'DA') return '線分 DA';
      if (id === 'rO') return '円Oの半径';
      if (id === 'rOp') return "円O'の半径";
      if (id === 'OO') return "線分 OO'";
      if (id === 'r') return config.shape === 'sector' ? '線分 OA' : (config.shape === 'baumkuchen-1' ? 'r' : '半径');
      if (id === 'a') return config.shape === 'baumkuchen-1' || config.shape === 'sal-2' || config.shape === 'sal-3' ? 'a' : (config.shape === 'ellipse-sector' ? '線分 OA' : '半径1');
      if (id === 'shift') return "AA'";
      return config.shape === 'ellipse-sector' ? '線分 OB' : '半径2';
    }

    function extraAreaById(id) {
      if (!currentGeometry || !currentGeometry.extraAreas) return null;
      return currentGeometry.extraAreas.find(function (area) { return area.id === id; }) || null;
    }

    function updateMeasureControl(id, value) {
      if (id === 'r' && controlInputs.radius) controlInputs.radius.value = String(value);
      if (id === 'a' && controlInputs.diff) controlInputs.diff.value = String(value);
      if (id === 'MN' && controlInputs.diff) controlInputs.diff.value = String(value);
      if ((id === 'OA' || id === 'OB') && controlInputs.radius) controlInputs.radius.value = String(value);
      if (id === 'OC' && controlInputs.radius) controlInputs.radius.value = String(value);
      if (id === 'AB' && controlInputs.radius && currentGeometry && currentGeometry.shape === 'semicircle-and-circle') controlInputs.radius.value = String(value / 2);
      if (id === 'AO' && controlInputs.ao) controlInputs.ao.value = String(value);
      if (id === 'AB' && controlInputs.ab) controlInputs.ab.value = String(value);
      if (id === 'BC' && controlInputs.bc) controlInputs.bc.value = String(value);
      if (id === 'CA' && controlInputs.ca) controlInputs.ca.value = String(value);
      if (id === 'AB' && controlInputs.side) controlInputs.side.value = String(value);
      if (id === 'BP' && controlInputs.bp) controlInputs.bp.value = String(value);
      if (id === 'PC' && controlInputs.bp && currentGeometry && currentGeometry.side) controlInputs.bp.value = String(currentGeometry.side - value);
      if ((id === 'CD' || id === 'DA') && controlInputs.side) controlInputs.side.value = String(value);
      if (id === 'AC' && controlInputs.ac) controlInputs.ac.value = String(value);
      if (id === 'rO' && controlInputs.radiusO) controlInputs.radiusO.value = String(value);
      if (id === 'rOp' && controlInputs.radiusOp) controlInputs.radiusOp.value = String(value);
      if (id === 'OO' && controlInputs.centerDistance) controlInputs.centerDistance.value = String(value);
      if (id === 'arcAB' && controlInputs.radius && currentGeometry && currentGeometry.angleRadians) controlInputs.radius.value = String(value / currentGeometry.angleRadians);
      if (id === 'arcAB' && controlInputs.ab && currentGeometry && currentGeometry.shape === 'right-triangle-semicircles') controlInputs.ab.value = String(value * 2 / Math.PI);
      if (id === 'arcAC' && controlInputs.ac && currentGeometry && currentGeometry.shape === 'right-triangle-semicircles') controlInputs.ac.value = String(value * 2 / Math.PI);
      if ((id === 'arcOA' || id === 'arcOB') && controlInputs.radius) controlInputs.radius.value = String(value * 2 / Math.PI);
      if (id === 'a' && controlInputs.radiusX) controlInputs.radiusX.value = String(value);
      if (id === 'b' && controlInputs.radiusY) controlInputs.radiusY.value = String(value);
    }

    function updateAngleControl(id, value) {
      if (controlInputs.angle) controlInputs.angle.value = String(value);
      if (id === 'BAC' && controlInputs.angleA) controlInputs.angleA.value = String(value);
      if (id === 'ABC' && controlInputs.angleB) controlInputs.angleB.value = String(value);
      if (id === 'ACB' && controlInputs.angleACB) controlInputs.angleACB.value = String(value);
      if (id === 'CAD' && controlInputs.angleCAD) controlInputs.angleCAD.value = String(value);
      if (id === 'BED' && controlInputs.angleBED) controlInputs.angleBED.value = String(value);
      if (id === 'APC' && controlInputs.angleAPC) controlInputs.angleAPC.value = String(value);
      if (id === 'DEC' && controlInputs.angleDEC) controlInputs.angleDEC.value = String(value);
    }

    function renderEditSheet(payload) {
      sheetBody.innerHTML = '';
      const kind = payload.kind;
      const id = payload.id;
      const normalizedTarget = normalizeLabelTarget(kind, id);
      const modalKind = normalizedTarget.kind;
      let title = '設定';
      let labelValue = '';
      let numericValue = null;
      let numericReadonly = true;
      let numericLabel = '数値';
      let numericFormatter = formatNumber;
      let kindSelect = null;
      let arcCheckbox = null;
      let colorPalette = null;
      let labelSizeBuilt = null;

      if (kind === 'point') {
        title = '点 ' + id;
        labelValue = (state.pointInputs && state.pointInputs[id]) || '';
      } else if (kind === 'measure') {
        title = measureLabel(id);
        labelValue = state.measureInputs[id] || '';
        numericValue = modalKind === 'arc' ? null : state.measures[id];
        numericReadonly = false;
      } else if (kind === 'angle') {
        title = '角 ' + id;
        labelValue = state.angleInputs[id] || '';
        numericValue = currentGeometry && currentGeometry.angles ? currentGeometry.angles[id] : 0;
        numericReadonly = (config.shape === 'inscribed-center-angle' && id !== 'ACB') || (config.shape === 'two-inscribed-angles' && id !== 'ACB' && id !== 'CAD') || (config.shape === 'inscribed-angle-application-1' && id !== 'BED' && id !== 'APC') || (config.shape === 'inscribed-angle-application-2' && id !== 'APB' && id !== 'PAC') || (config.shape === 'inscribed-angle-application-3' && id !== 'DEC' && id !== 'BAC') || (config.shape === 'inscribed-angle-application-5' && id !== 'DEC' && id !== 'BAC') || (config.shape === 'inscribed-angle-application-4' && id !== 'OAC' && id !== 'OBC') || (config.shape === 'tangent-theorem' && id !== 'BAC' && id !== 'ABC');
        numericLabel = '角度';
        numericFormatter = formatAngle;
      } else if (kind === 'area') {
        title = '面積';
        labelValue = state.areaInput || '';
        numericValue = currentGeometry ? currentGeometry.area : 0;
      } else if (kind === 'extraArea') {
        const area = extraAreaById(id);
        title = area ? area.name : '面積';
        labelValue = state.extraAreaInputs[id] || '';
        numericValue = area ? area.value : 0;
      }
      if (kind === 'measure' && modalKind === 'arc' && window.InstantGeometryDrawLabelEngine && typeof window.InstantGeometryDrawLabelEngine.getStandardModalSpec === 'function') {
        const spec = window.InstantGeometryDrawLabelEngine.getStandardModalSpec('arc');
        title = spec.title;
      } else if (kind === 'measure' && modalKind === 'segment' && window.InstantGeometryDrawLabelEngine && typeof window.InstantGeometryDrawLabelEngine.getStandardModalSpec === 'function') {
        const spec = window.InstantGeometryDrawLabelEngine.getStandardModalSpec('segment');
        title = spec.title;
      }
      sheetTitle.textContent = title;

      if (kind === 'measure' && modalKind === 'segment') {
        const built = buildSelect('線分マーク', state.measureKinds[id] || 'plain', [
          { value: 'plain', label: '通常' },
          { value: 'circle', label: '丸付き' },
          { value: 'single', label: '一本線付き' },
          { value: 'double', label: '二重線付き' },
          { value: 'cross', label: '交差付き' },
          { value: 'triangle', label: '三角付き' },
          { value: 'parallel', label: '平行矢印付き' },
          { value: 'parallel-reverse', label: '平行矢印付き（逆向き）' },
          { value: 'parallel-single', label: '平行＋一本線付き' },
          { value: 'parallel-single-reverse', label: '平行＋一本線付き（逆向き）' },
          { value: 'parallel-double', label: '平行＋二重線付き' },
          { value: 'parallel-double-reverse', label: '平行＋二重線付き（逆向き）' }
        ]);
        kindSelect = built.select;
        sheetBody.appendChild(built.field);

        const checkboxBuilt = buildCheckbox('ガイドを表示', state.measureArcVisible[id] !== false);
        arcCheckbox = checkboxBuilt.input;
        sheetBody.appendChild(checkboxBuilt.field);
      }
      if (kind === 'angle' && window.InstantGeometryMobileAngleOrnaments) {
        kindSelect = window.InstantGeometryMobileAngleOrnaments.appendAngleKindSelect(
          sheetBody,
          buildSelect,
          state.angleKinds[id] || 'plain',
          numericValue
        );
      }

      const labelBuilt = buildLabelEditor('ラベル', labelValue, kind !== 'point');
      sheetBody.appendChild(labelBuilt.field);
      if (kind === 'measure' || kind === 'angle' || kind === 'area' || kind === 'extraArea') {
        labelSizeBuilt = buildRangeField(
          'ラベルサイズ',
          Math.round(getLabelScale(kind, id) * 100),
          10,
          400,
          10,
          function (scaleValue) { return scaleValue + '%'; }
        );
        sheetBody.appendChild(labelSizeBuilt.field);
      }
      if (kind === 'area' || kind === 'extraArea') {
        const currentColor = kind === 'extraArea'
          ? (state.extraAreaColors[id] || state.areaColor || '#2a5bd7')
          : (state.areaColor || '#2a5bd7');
        colorPalette = buildColorPalette('色', currentColor);
        sheetBody.appendChild(colorPalette.field);
      } else if (kind === 'measure') {
        colorPalette = buildColorPalette('色', state.measureColors[id] || '#2a5bd7');
        sheetBody.appendChild(colorPalette.field);
      }
      if (numericValue !== null && kind !== 'angle' && kind !== 'measure') {
        const numericBuilt = buildTextInput(numericLabel, numericValue === '' ? '' : numericFormatter(numericValue), { inputMode: 'decimal', readonly: numericReadonly });
        sheetBody.appendChild(numericBuilt.field);
        payload.numericInput = numericBuilt.input;
      }

      const hint = document.createElement('p');
      hint.className = 'sheet-hint';
      hint.textContent = kind === 'point'
        ? '非表示または自由入力を選べます。自由入力では数字や記号も文字として表示します。'
        : kind === 'measure'
          ? (modalKind === 'arc'
            ? '弧ラベルです。非表示、数値、比の値、自由入力を選べます。\n' + RATIO_LABEL_HINT
            : '半径は線分ラベルとして扱います。非表示、数値、比の値、自由入力を選べます。\n' + RATIO_LABEL_HINT)
          : '非表示、数値、比の値、自由入力を選べます。\n' + RATIO_LABEL_HINT;
      sheetBody.appendChild(hint);

      const actions = document.createElement('div');
      actions.className = 'sheet-actions';
      if (labelMoveEnabled) actions.classList.add('has-move');
      const cancel = document.createElement('button');
      cancel.className = 'btn';
      cancel.type = 'button';
      cancel.textContent = 'キャンセル';
      cancel.addEventListener('click', closeSheets);
      function applyCurrentValue() {
        if (labelSizeBuilt) setLabelScale(kind, id, Number(labelSizeBuilt.input.value) / 100);
        if (kind === 'point') {
          state.pointInputs[id] = labelBuilt.mode.value === 'text' ? normalizeFreeLabel(labelBuilt.input.value) : '';
        } else if (kind === 'measure') {
          if (colorPalette) state.measureColors[id] = colorPalette.value;
          if (kindSelect) state.measureKinds[id] = kindSelect.value;
          if (arcCheckbox) state.measureArcVisible[id] = !!arcCheckbox.checked;
          if (labelBuilt.mode.value === 'hidden') {
            state.measureInputs[id] = '';
          } else if (labelBuilt.mode.value === 'numeric') {
            state.measureInputs[id] = ' ';
          } else if (labelBuilt.mode.value === 'numericDecimal') {
            state.measureInputs[id] = DECIMAL_NUMERIC_LABEL_VALUE;
          } else if (labelBuilt.mode.value === 'numericRaw') {
            state.measureInputs[id] = RAW_NUMERIC_LABEL_VALUE;
          } else if (labelBuilt.mode.value === 'ratio') {
            const ratio = parseRatioLabelInput(labelBuilt.input.value);
            if (!ratio) throw new Error('比の値は「r,5」「t,4.4」「s,5/3」の形式で入力してください。');
            state.measureInputs[id] = RATIO_LABEL_PREFIX + ratio.source;
          } else {
            state.measureInputs[id] = normalizeFreeLabel(labelBuilt.input.value);
          }
          if (labelBuilt.mode.value === 'hidden') state.measureArcVisible[id] = false;
          if (payload.numericInput && !payload.numericInput.hasAttribute('readonly')) {
            const value = parsePositiveNumber(payload.numericInput.value, measureLabel(id));
            updateMeasureControl(id, value);
          }
        } else if (kind === 'angle') {
          if (kindSelect) state.angleKinds[id] = kindSelect.value;
          if (labelBuilt.mode.value === 'hidden') {
            state.angleInputs[id] = '';
          } else if (labelBuilt.mode.value === 'numeric') {
            state.angleInputs[id] = ' ';
          } else if (labelBuilt.mode.value === 'numericDecimal') {
            state.angleInputs[id] = DECIMAL_NUMERIC_LABEL_VALUE;
          } else if (labelBuilt.mode.value === 'numericRaw') {
            state.angleInputs[id] = RAW_NUMERIC_LABEL_VALUE;
          } else if (labelBuilt.mode.value === 'ratio') {
            const ratio = parseRatioLabelInput(labelBuilt.input.value);
            if (!ratio) throw new Error('比の値は「r,5」「t,4.4」「s,5/3」の形式で入力してください。');
            state.angleInputs[id] = RATIO_LABEL_PREFIX + ratio.source;
          } else {
            state.angleInputs[id] = normalizeFreeLabel(labelBuilt.input.value);
          }
          if (payload.numericInput && !payload.numericInput.hasAttribute('readonly')) {
            const value = config.shape === 'inscribed-center-angle' || config.shape === 'two-inscribed-angles'
              ? parseInscribedAngleDegrees(String(payload.numericInput.value).replace('°', ''))
              : parseAngleDegrees(String(payload.numericInput.value).replace('°', ''));
            updateAngleControl(id, value);
          }
        } else if (kind === 'area') {
          if (colorPalette) state.areaColor = colorPalette.value;
          if (labelBuilt.mode.value === 'hidden') {
            state.areaInput = '';
          } else if (labelBuilt.mode.value === 'numeric') {
            state.areaInput = ' ';
          } else if (labelBuilt.mode.value === 'numericDecimal') {
            state.areaInput = DECIMAL_NUMERIC_LABEL_VALUE;
          } else if (labelBuilt.mode.value === 'numericRaw') {
            state.areaInput = RAW_NUMERIC_LABEL_VALUE;
          } else if (labelBuilt.mode.value === 'ratio') {
            const ratio = parseRatioLabelInput(labelBuilt.input.value);
            if (!ratio) throw new Error('比の値は「r,5」「t,4.4」「s,5/3」の形式で入力してください。');
            state.areaInput = RATIO_LABEL_PREFIX + ratio.source;
          } else {
            state.areaInput = normalizeFreeLabel(labelBuilt.input.value);
          }
        } else if (kind === 'extraArea') {
          if (colorPalette) state.extraAreaColors[id] = colorPalette.value;
          if (labelBuilt.mode.value === 'hidden') {
            state.extraAreaInputs[id] = '';
          } else if (labelBuilt.mode.value === 'numeric') {
            state.extraAreaInputs[id] = ' ';
          } else if (labelBuilt.mode.value === 'numericDecimal') {
            state.extraAreaInputs[id] = DECIMAL_NUMERIC_LABEL_VALUE;
          } else if (labelBuilt.mode.value === 'numericRaw') {
            state.extraAreaInputs[id] = RAW_NUMERIC_LABEL_VALUE;
          } else if (labelBuilt.mode.value === 'ratio') {
            const ratio = parseRatioLabelInput(labelBuilt.input.value);
            if (!ratio) throw new Error('比の値は「r,5」「t,4.4」「s,5/3」の形式で入力してください。');
            state.extraAreaInputs[id] = RATIO_LABEL_PREFIX + ratio.source;
          } else {
            state.extraAreaInputs[id] = normalizeFreeLabel(labelBuilt.input.value);
          }
        }
      }
      const move = document.createElement('button');
      move.className = 'btn action-secondary';
      move.type = 'button';
      move.textContent = '移動';
      move.addEventListener('click', function () {
        try {
          applyCurrentValue();
          render();
          enterMoveMode({ kind: kind, id: id });
        } catch (error) {
          setStatus(error.message || '入力を確認してください。', true);
        }
      });
      const save = document.createElement('button');
      save.className = 'btn action-primary';
      save.type = 'button';
      save.textContent = '保存';
      save.addEventListener('click', function () {
        try {
          applyCurrentValue();
          closeSheets();
          render();
        } catch (error) {
          setStatus(error.message || '入力を確認してください。', true);
        }
      });
      actions.appendChild(cancel);
      if (labelMoveEnabled) actions.appendChild(move);
      actions.appendChild(save);
      sheetBody.appendChild(actions);
    }

    async function saveAs(format) {
      if (!window.html2canvas) throw new Error('保存機能の読み込みが完了していません。');
      const backgroundColor = format === 'transparent' ? null : '#fbfcff';
      const canvas = await window.html2canvas(captureRoot, { backgroundColor: backgroundColor, scale: 2 });
      if (format === 'png' || format === 'transparent') {
        canvas.toBlob(function (blob) {
          if (!blob) return;
          downloadBlob(blob, format === 'transparent' ? config.fileBase + '-transparent.png' : config.fileBase + '.png');
        }, 'image/png');
        return;
      }
      const jsPDF = window.jspdf && window.jspdf.jsPDF;
      if (!jsPDF) throw new Error('PDF保存機能の読み込みが完了していません。');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 32;
      const imageWidth = pageWidth - margin * 2;
      const imageHeight = canvas.height * imageWidth / canvas.width;
      const y = Math.max(margin, (pageHeight - imageHeight) / 2);
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, y, imageWidth, imageHeight);
      pdf.save(config.fileBase + '.pdf');
    }

    async function saveWithQuota(format) {
      if (!window.InstantGeometrySaveQuota) {
        await saveAs(format);
        return;
      }
      await window.InstantGeometrySaveQuota.runWithQuota(function () {
        return saveAs(format);
      });
    }

    Object.keys(controlInputs).forEach(function (key) {
      controlInputs[key].addEventListener('input', render);
    });
    stage.addEventListener('click', function (event) {
      if (moveMode) return;
      const arcMeasure = arcMeasureAtPoint(pointerToSvgPoint(event));
      if (arcMeasure) {
        openSheet('edit', { kind: 'measure', id: arcMeasure });
        return;
      }
      const hitStack = typeof document.elementsFromPoint === 'function'
        ? document.elementsFromPoint(event.clientX, event.clientY)
        : [];
      let target = null;
      for (let i = 0; i < hitStack.length; i += 1) {
        const candidate = hitStack[i].closest && hitStack[i].closest('[data-kind][data-id]');
        if (!candidate) continue;
        if (candidate.getAttribute('data-kind') !== 'area' && candidate.getAttribute('data-kind') !== 'extraArea') {
          target = candidate;
          break;
        }
        if (!target) target = candidate;
      }
      if (!target) target = event.target.closest('[data-kind][data-id]');
      if (!target) {
        if (currentGeometry && currentGeometry.shape === 'baumkuchen-1') {
          const point = pointerToSvgPoint(event);
          const layout = fitGeometry(currentGeometry.radiusX, currentGeometry.radiusY);
          const points = screenPoints(layout);
          const smallRadius = currentGeometry.radius * layout.scale;
          if (Math.hypot(point.x - points.O.x, point.y - points.O.y) <= smallRadius) {
            openSheet('edit', { kind: 'extraArea', id: 'small-circle' });
          }
        }
        return;
      }
      openSheet('edit', { kind: target.getAttribute('data-kind'), id: target.getAttribute('data-id') });
    });
    backBtn.addEventListener('click', function () {
      if (window.history.length > 1) window.history.back();
    });
    saveBtn.addEventListener('click', function () { if (!moveMode) openSheet('save'); });
    moveCancelBtn.addEventListener('click', function () { finishMoveMode(true); });
    moveDoneBtn.addEventListener('click', function () { finishMoveMode(false); });
    window.addEventListener('pointermove', function (event) {
      if (!moveDrag) return;
      event.preventDefault();
      const point = pointerToSvgPoint(event);
      const offset = ensureLabelOffset(moveDrag.kind, moveDrag.id);
      offset.x = moveDrag.startOffset.x + (point.x - moveDrag.startPoint.x);
      offset.y = moveDrag.startOffset.y + (point.y - moveDrag.startPoint.y);
      render();
    }, { passive: false });
    window.addEventListener('pointerup', function () { moveDrag = null; });
    window.addEventListener('pointercancel', function () { moveDrag = null; });
    sheetBackdrop.addEventListener('click', function () { if (!moveMode) closeSheets(); });
    sheetClose.addEventListener('click', closeSheets);
    saveSheetClose.addEventListener('click', closeSheets);
    savePngBtn.addEventListener('click', async function () {
      try { await saveWithQuota('png'); closeSheets(); } catch (error) { setStatus(error.message || '保存に失敗しました。', true); }
    });
    saveTransparentBtn.addEventListener('click', async function () {
      try { await saveWithQuota('transparent'); closeSheets(); } catch (error) { setStatus(error.message || '保存に失敗しました。', true); }
    });
    savePdfBtn.addEventListener('click', async function () {
      try { await saveWithQuota('pdf'); closeSheets(); } catch (error) { setStatus(error.message || '保存に失敗しました。', true); }
    });

    render();
  }

  window.InstantGeometryConicMobile = {
    createPage: createPage,
    parsePositiveNumber: parsePositiveNumber,
    parseAngleDegrees: parseAngleDegrees,
    formatNumber: formatNumber
  };
})();
