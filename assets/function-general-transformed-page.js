(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const config = Object.assign({
    kind: 'exp-base',
    title: '関数グラフ',
    formulaName: '',
    statusText: 'パラメータを入力すると、関数グラフを描画します。',
    saveBase: 'function-general-transformed',
    params: ['a'],
    defaults: { a: 2, b: 2, c: 0, d: 0, e: 0 },
    tickLabelInterval: 2
  }, window.InstantGeometryGeneralTransformedConfig || {});
  const activeParams = Array.isArray(config.params) ? config.params : ['a'];

  const stage = document.getElementById('stage');
  const statusBox = document.getElementById('statusBox');
  const sheetBackdrop = document.getElementById('sheetBackdrop');
  const editSheet = document.getElementById('editSheet');
  const saveSheet = document.getElementById('saveSheet');
  const sheetTitle = document.getElementById('sheetTitle');
  const sheetBody = document.getElementById('sheetBody');
  const captureRoot = document.getElementById('captureRoot');
  const inputs = {
    a: document.getElementById('axisA'),
    b: document.getElementById('axisB'),
    c: document.getElementById('axisC'),
    d: document.getElementById('axisD'),
    e: document.getElementById('axisE')
  };

  if (!stage) return;
  if (activeParams.some(function (key) { return !inputs[key]; })) return;

  const plot = {
    left: 86,
    right: 914,
    top: 86,
    bottom: 914,
    xMin: -10,
    xMax: 10,
    yMin: -10,
    yMax: 10
  };

  const state = {
    tickLabelInterval: config.tickLabelInterval,
    viewCenterX: 0,
    viewCenterY: 0,
    viewWidth: 20,
    viewHeight: 20
  };

  function svg(tag, attrs) {
    const node = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (key) {
      node.setAttribute(key, attrs[key]);
    });
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function setStatus(message, isError) {
    if (!statusBox) return;
    statusBox.textContent = message;
    statusBox.classList.toggle('error', Boolean(isError));
  }

  function parseNumber(key, label) {
    const input = inputs[key];
    if (!input) return Number(config.defaults[key] || 0);
    const text = String(input.value || '').trim();
    if (!/^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$/.test(text)) {
      throw new Error(label + ' は数値で入力してください。');
    }
    return Number(text);
  }

  function readParams() {
    const values = Object.assign({ a: 1, b: 0, c: 0, d: 0, e: 0 }, config.defaults || {});
    activeParams.forEach(function (key) {
      values[key] = parseNumber(key, key);
    });
    if (config.kind === 'exp-base' && values.a <= 0) throw new Error('底 a は0より大きい数値で入力してください。');
    if (config.kind === 'log-shifted' && (values.b <= 0 || Math.abs(values.b - 1) < 1e-10)) {
      throw new Error('底 b は0より大きく、1以外の数値で入力してください。');
    }
    return values;
  }

  function formatNumber(value) {
    if (!Number.isFinite(value)) return '';
    if (Math.abs(value) < 1e-10) return '0';
    const rounded = Math.round(value * 1000) / 1000;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, '').replace(/\.$/, '');
  }

  function signed(value) {
    if (Math.abs(value) < 1e-10) return '';
    return (value > 0 ? ' + ' : ' - ') + formatNumber(Math.abs(value));
  }

  function sx(x) {
    return plot.left + (x - plot.xMin) / (plot.xMax - plot.xMin) * (plot.right - plot.left);
  }

  function sy(y) {
    return plot.top + (plot.yMax - y) / (plot.yMax - plot.yMin) * (plot.bottom - plot.top);
  }

  function point(x, y) {
    return { x: sx(x), y: sy(y), ux: x, uy: y };
  }

  function drawText(text, x, y, klass) {
    const label = svg('text', { x: x, y: y, class: 'function-label' + (klass ? ' ' + klass : '') });
    label.textContent = text;
    stage.appendChild(label);
  }

  function drawGrid() {
    if (window.InstantGeometryFunctionViewSettings && window.InstantGeometryFunctionViewSettings.drawGrid) {
      window.InstantGeometryFunctionViewSettings.drawGrid({
        stage: stage,
        plot: plot,
        svg: svg,
        sx: sx,
        sy: sy,
        drawText: drawText,
        state: state
      });
      return;
    }
    for (let x = Math.ceil(plot.xMin); x <= Math.floor(plot.xMax); x += 1) {
      stage.appendChild(svg('line', { x1: sx(x), y1: sy(plot.yMin), x2: sx(x), y2: sy(plot.yMax), class: 'grid-line' }));
    }
    for (let y = Math.ceil(plot.yMin); y <= Math.floor(plot.yMax); y += 1) {
      stage.appendChild(svg('line', { x1: sx(plot.xMin), y1: sy(y), x2: sx(plot.xMax), y2: sy(y), class: 'grid-line' }));
    }
  }

  function formula(v) {
    if (config.kind === 'exp-natural') return 'y = eˣ';
    if (config.kind === 'exp-base') return 'y = ' + formatNumber(v.a) + 'ˣ';
    if (config.kind === 'log-shifted') {
      const coef = Math.abs(v.a - 1) < 1e-10 ? '' : (Math.abs(v.a + 1) < 1e-10 ? '-' : formatNumber(v.a));
      const inner = Math.abs(v.c) < 1e-10 ? 'x' : 'x' + (v.c > 0 ? ' - ' + formatNumber(v.c) : ' + ' + formatNumber(Math.abs(v.c)));
      return 'y = ' + coef + 'log_' + formatNumber(v.b) + '(' + inner + ')' + signed(v.d);
    }
    if (config.kind === 'abs-linear') {
      const ax = Math.abs(v.a - 1) < 1e-10 ? 'x' : (Math.abs(v.a + 1) < 1e-10 ? '-x' : formatNumber(v.a) + 'x');
      return 'y = |' + ax + signed(v.b) + '|';
    }
    if (config.kind === 'reciprocal') {
      const numerator = Math.abs(v.a - 1) < 1e-10 ? '1' : formatNumber(v.a);
      const denom = Math.abs(v.b) < 1e-10 ? 'x' : 'x' + (v.b > 0 ? ' - ' + formatNumber(v.b) : ' + ' + formatNumber(Math.abs(v.b)));
      return 'y = ' + numerator + '/(' + denom + ')' + signed(v.c);
    }
    if (config.kind === 'cubic') {
      const terms = [];
      if (Math.abs(v.a) > 1e-10) terms.push((Math.abs(v.a - 1) < 1e-10 ? '' : (Math.abs(v.a + 1) < 1e-10 ? '-' : formatNumber(v.a))) + 'x^3');
      if (Math.abs(v.b) > 1e-10) terms.push((v.b > 0 && terms.length ? '+ ' : '') + (Math.abs(v.b - 1) < 1e-10 ? '' : (Math.abs(v.b + 1) < 1e-10 ? '-' : formatNumber(v.b))) + 'x^2');
      if (Math.abs(v.c) > 1e-10) terms.push((v.c > 0 && terms.length ? '+ ' : '') + (Math.abs(v.c - 1) < 1e-10 ? '' : (Math.abs(v.c + 1) < 1e-10 ? '-' : formatNumber(v.c))) + 'x');
      if (Math.abs(v.d) > 1e-10) terms.push((v.d > 0 && terms.length ? '+ ' : '') + formatNumber(v.d));
      return 'y = ' + (terms.length ? terms.join(' ') : '0');
    }
    if (config.kind === 'quartic') {
      const terms = [];
      if (Math.abs(v.a) > 1e-10) terms.push((Math.abs(v.a - 1) < 1e-10 ? '' : (Math.abs(v.a + 1) < 1e-10 ? '-' : formatNumber(v.a))) + 'x^4');
      if (Math.abs(v.b) > 1e-10) terms.push((v.b > 0 && terms.length ? '+ ' : '') + (Math.abs(v.b - 1) < 1e-10 ? '' : (Math.abs(v.b + 1) < 1e-10 ? '-' : formatNumber(v.b))) + 'x^3');
      if (Math.abs(v.c) > 1e-10) terms.push((v.c > 0 && terms.length ? '+ ' : '') + (Math.abs(v.c - 1) < 1e-10 ? '' : (Math.abs(v.c + 1) < 1e-10 ? '-' : formatNumber(v.c))) + 'x^2');
      if (Math.abs(v.d) > 1e-10) terms.push((v.d > 0 && terms.length ? '+ ' : '') + (Math.abs(v.d - 1) < 1e-10 ? '' : (Math.abs(v.d + 1) < 1e-10 ? '-' : formatNumber(v.d))) + 'x');
      if (Math.abs(v.e) > 1e-10) terms.push((v.e > 0 && terms.length ? '+ ' : '') + formatNumber(v.e));
      return 'y = ' + (terms.length ? terms.join(' ') : '0');
    }
    return config.title;
  }

  function valueAt(x, v) {
    if (config.kind === 'exp-natural') return Math.exp(x);
    if (config.kind === 'exp-base') return Math.pow(v.a, x);
    if (config.kind === 'log-shifted') {
      const inner = x - v.c;
      if (inner <= 0) return NaN;
      return v.a * (Math.log(inner) / Math.log(v.b)) + v.d;
    }
    if (config.kind === 'abs-linear') return Math.abs(v.a * x + v.b);
    if (config.kind === 'reciprocal') {
      const denom = x - v.b;
      if (Math.abs(denom) < 1e-10) return NaN;
      return v.a / denom + v.c;
    }
    if (config.kind === 'cubic') return v.a * x * x * x + v.b * x * x + v.c * x + v.d;
    if (config.kind === 'quartic') return v.a * x * x * x * x + v.b * x * x * x + v.c * x * x + v.d * x + v.e;
    return NaN;
  }

  function visibleSegments(v) {
    const segments = [];
    let points = [];
    const steps = 1200;
    for (let i = 0; i <= steps; i += 1) {
      const x = plot.xMin + (plot.xMax - plot.xMin) * (i / steps);
      const y = valueAt(x, v);
      if (!Number.isFinite(y) || y < plot.yMin - 1e-9 || y > plot.yMax + 1e-9) {
        if (points.length > 1) segments.push(points);
        points = [];
      } else {
        points.push(point(x, y));
      }
    }
    if (points.length > 1) segments.push(points);
    return segments;
  }

  function pathFromPoints(points) {
    return points.map(function (p, index) {
      return (index === 0 ? 'M ' : 'L ') + p.x + ' ' + p.y;
    }).join(' ');
  }

  function drawVerticalAsymptote(x) {
    if (x <= plot.xMin || x >= plot.xMax) return;
    const line = svg('line', {
      x1: sx(x),
      y1: sy(plot.yMin),
      x2: sx(x),
      y2: sy(plot.yMax),
      class: 'function-line is-dashed'
    });
    line.style.stroke = '#8fa5da';
    line.style.strokeWidth = '3';
    stage.appendChild(line);
  }

  function drawGraph(v) {
    if (config.kind === 'log-shifted') drawVerticalAsymptote(v.c);
    if (config.kind === 'reciprocal') {
      drawVerticalAsymptote(v.b);
      if (v.c > plot.yMin && v.c < plot.yMax) {
        const horizontal = svg('line', {
          x1: sx(plot.xMin),
          y1: sy(v.c),
          x2: sx(plot.xMax),
          y2: sy(v.c),
          class: 'function-line is-dashed'
        });
        horizontal.style.stroke = '#8fa5da';
        horizontal.style.strokeWidth = '3';
        stage.appendChild(horizontal);
      }
    }

    const segments = visibleSegments(v);
    segments.forEach(function (points) {
      const d = pathFromPoints(points);
      stage.appendChild(svg('path', { d: d, class: 'function-curve' }));
      stage.appendChild(svg('path', { d: d, class: 'function-curve-hit' }));
    });

    const best = segments.reduce(function (current, segment) {
      return segment.length > current.length ? segment : current;
    }, []);
    if (best.length) {
      const anchor = best[Math.min(best.length - 1, Math.max(0, Math.floor(best.length * 0.76)))];
      drawText(formula(v), Math.min(plot.right - 240, Math.max(plot.left + 16, anchor.x + 18)), Math.min(plot.bottom - 22, Math.max(plot.top + 34, anchor.y - 20)), 'muted');
    }
  }

  function render() {
    if (window.InstantGeometryFunctionViewSettings) window.InstantGeometryFunctionViewSettings.applyViewRange(state, plot);
    clear(stage);
    drawGrid();
    let values;
    try {
      values = readParams();
      setStatus(config.statusText, false);
    } catch (error) {
      setStatus(error.message, true);
      values = Object.assign({ a: 1, b: 0, c: 0, d: 0, e: 0 }, config.defaults || {});
    }
    drawGraph(values);
  }

  function closeSheets() {
    if (editSheet) editSheet.classList.remove('open');
    if (saveSheet) saveSheet.classList.remove('open');
    if (sheetBackdrop) sheetBackdrop.classList.remove('open');
  }

  function buildNumberField(label, value, step) {
    const wrap = document.createElement('label');
    wrap.className = 'sheet-field';
    const text = document.createElement('span');
    text.textContent = label;
    const input = document.createElement('input');
    input.type = 'number';
    input.step = step || '1';
    input.value = value;
    wrap.appendChild(text);
    wrap.appendChild(input);
    return { wrap: wrap, input: input };
  }

  function openSettingsSheet() {
    if (!editSheet || !sheetBody || !sheetTitle) return;
    if (window.InstantGeometryFunctionViewSettings) {
      window.InstantGeometryFunctionViewSettings.openSettings({
        state: state,
        sheetTitle: sheetTitle,
        sheetBody: sheetBody,
        editSheet: editSheet,
        sheetBackdrop: sheetBackdrop,
        closeSheets: closeSheets,
        render: render,
        buildNumberField: buildNumberField
      });
    }
  }

  function openSaveSheet() {
    if (!saveSheet || !sheetBackdrop) return;
    saveSheet.classList.add('open');
    saveSheet.setAttribute('aria-hidden', 'false');
    sheetBackdrop.classList.add('open');
  }

  function captureCanvas(backgroundColor) {
    if (!window.html2canvas) return Promise.reject(new Error('保存に失敗しました。'));
    return window.html2canvas(captureRoot, { backgroundColor: backgroundColor, scale: 2 });
  }

  function saveImage(format) {
    const transparent = format === 'transparent';
    return captureCanvas(transparent ? null : '#ffffff').then(function (canvas) {
      const link = document.createElement('a');
      link.download = transparent ? config.saveBase + '-transparent.png' : config.saveBase + '.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  }

  function savePdf() {
    if (!window.jspdf || !window.jspdf.jsPDF) return Promise.reject(new Error('PDF保存に失敗しました。'));
    return captureCanvas('#ffffff').then(function (canvas) {
      const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
      const pdf = new window.jspdf.jsPDF({ orientation: orientation, unit: 'pt', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const scale = Math.min((pageW - margin * 2) / canvas.width, (pageH - margin * 2) / canvas.height);
      const drawW = canvas.width * scale;
      const drawH = canvas.height * scale;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pageW - drawW) / 2, (pageH - drawH) / 2, drawW, drawH);
      pdf.save(config.saveBase + '.pdf');
    });
  }

  function saveWithQuota(format) {
    const runner = window.InstantGeometrySaveQuota && window.InstantGeometrySaveQuota.runWithQuota
      ? window.InstantGeometrySaveQuota.runWithQuota
      : function (fn) { return fn(); };
    const task = function () { return format === 'pdf' ? savePdf() : saveImage(format); };
    return runner(task).then(function () {
      closeSheets();
      setStatus('保存しました。', false);
    }).catch(function (error) {
      setStatus(error.message || '保存に失敗しました。', true);
    });
  }

  activeParams.forEach(function (key) {
    if (inputs[key]) inputs[key].addEventListener('input', render);
  });
  const backButton = document.getElementById('backBtn');
  if (backButton) backButton.addEventListener('click', function () { window.location.href = '../../'; });
  const settingsButton = document.getElementById('settingsBtn');
  if (settingsButton) settingsButton.addEventListener('click', openSettingsSheet);
  const saveButton = document.getElementById('saveBtn');
  if (window.InstantGeometrySaveQuota && saveButton) window.InstantGeometrySaveQuota.createIndicator({ target: saveButton });
  if (saveButton) saveButton.addEventListener('click', openSaveSheet);
  const sheetClose = document.getElementById('sheetClose');
  if (sheetClose) sheetClose.addEventListener('click', closeSheets);
  const saveSheetClose = document.getElementById('saveSheetClose');
  if (saveSheetClose) saveSheetClose.addEventListener('click', closeSheets);
  if (sheetBackdrop) sheetBackdrop.addEventListener('click', closeSheets);
  const savePngButton = document.getElementById('savePngBtn');
  if (savePngButton) savePngButton.addEventListener('click', function () { saveWithQuota('png'); });
  const saveTransparentButton = document.getElementById('saveTransparentBtn');
  if (saveTransparentButton) saveTransparentButton.addEventListener('click', function () { saveWithQuota('transparent'); });
  const savePdfButton = document.getElementById('savePdfBtn');
  if (savePdfButton) savePdfButton.addEventListener('click', function () { saveWithQuota('pdf'); });

  render();
})();
