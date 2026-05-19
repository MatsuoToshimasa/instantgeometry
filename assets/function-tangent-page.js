(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const config = Object.assign({
    kind: 'quartic',
    title: '関数と接線',
    statusText: '関数と接線を描画します。',
    saveBase: 'function-tangent',
    params: ['a', 'b', 'c', 'd', 'e', 't'],
    defaults: { a: 0.01, b: 0, c: -1, d: 0, e: 0, t: 2 },
    tickLabelInterval: 2,
    showDerivative: false
  }, window.InstantGeometryTangentConfig || {});

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
    e: document.getElementById('axisE'),
    t: document.getElementById('tangentT')
  };
  const activeParams = Array.isArray(config.params) ? config.params : ['a', 'b', 't'];

  if (!stage || activeParams.some(function (key) { return !inputs[key]; })) return;

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
    tickLabelInterval: config.tickLabelInterval || 2,
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

  function setStatus(message, isError) {
    if (!statusBox) return;
    statusBox.textContent = message;
    statusBox.classList.toggle('error', Boolean(isError));
  }

  function parseNumber(key) {
    const input = inputs[key];
    const label = key === 't' ? '接点のx座標 t' : (config.labels && config.labels[key]) || key;
    const text = String(input.value || '').trim();
    if (!/^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$/.test(text)) {
      throw new Error(label + ' は数値で入力してください。');
    }
    return Number(text);
  }

  function readParams() {
    const values = Object.assign({ a: 1, b: 0, c: 0, d: 0, e: 0, t: 0 }, config.defaults || {});
    activeParams.forEach(function (key) {
      values[key] = parseNumber(key);
    });
    if ((config.kind === 'quartic' || config.kind === 'derivative-quartic') && Math.abs(values.a) < 1e-10) {
      throw new Error('係数 a は0以外の数値で入力してください。');
    }
    if (config.kind === 'exp-ae-bx' && Math.abs(values.a) < 1e-10) {
      throw new Error('係数 a は0以外の数値で入力してください。');
    }
    if (config.kind === 'log-shifted-tangent') {
      if (values.b <= 0 || Math.abs(values.b - 1) < 1e-10) throw new Error('底 b は0より大きく、1以外の数値で入力してください。');
      if (values.t <= values.c) throw new Error('接点のx座標 t は移動 p より大きい数値で入力してください。');
    }
    return values;
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
        state: state,
        plot: plot,
        svg: svg,
        sx: sx,
        sy: sy,
        stage: stage,
        drawText: drawText
      });
      return;
    }
    for (let x = Math.ceil(plot.xMin); x <= Math.floor(plot.xMax); x += 1) {
      stage.appendChild(svg('line', { x1: sx(x), y1: sy(plot.yMin), x2: sx(x), y2: sy(plot.yMax), class: 'function-grid-minor' }));
    }
    for (let y = Math.ceil(plot.yMin); y <= Math.floor(plot.yMax); y += 1) {
      stage.appendChild(svg('line', { x1: sx(plot.xMin), y1: sy(y), x2: sx(plot.xMax), y2: sy(y), class: 'function-grid-minor' }));
    }
    stage.appendChild(svg('line', { x1: sx(plot.xMin), y1: sy(0), x2: sx(plot.xMax), y2: sy(0), class: 'function-axis' }));
    stage.appendChild(svg('line', { x1: sx(0), y1: sy(plot.yMin), x2: sx(0), y2: sy(plot.yMax), class: 'function-axis' }));
  }

  function term(terms, value, body) {
    if (Math.abs(value) < 1e-10) return;
    const abs = Math.abs(value);
    const coeff = body && Math.abs(abs - 1) < 1e-10 ? '' : formatNumber(abs);
    const text = coeff + body;
    if (!terms.length) terms.push(value < 0 ? '-' + text : text);
    else terms.push((value < 0 ? ' - ' : ' + ') + text);
  }

  function quarticFormula(v) {
    const terms = [];
    term(terms, v.a, 'x⁴');
    term(terms, v.b, 'x³');
    term(terms, v.c, 'x²');
    term(terms, v.d, 'x');
    term(terms, v.e, '');
    return 'y = ' + (terms.length ? terms.join('') : '0');
  }

  function derivativeFormula(v) {
    const terms = [];
    term(terms, 4 * v.a, 'x³');
    term(terms, 3 * v.b, 'x²');
    term(terms, 2 * v.c, 'x');
    term(terms, v.d, '');
    return "y' = " + (terms.length ? terms.join('') : '0');
  }

  function formula(v) {
    if (config.kind === 'exp-ae-bx') return 'y = ' + formatNumber(v.a) + 'e^(' + formatNumber(v.b) + 'x)';
    if (config.kind === 'log-shifted-tangent') {
      const coef = Math.abs(v.a - 1) < 1e-10 ? '' : (Math.abs(v.a + 1) < 1e-10 ? '-' : formatNumber(v.a));
      const inner = Math.abs(v.c) < 1e-10 ? 'x' : 'x' + (v.c > 0 ? ' - ' + formatNumber(v.c) : ' + ' + formatNumber(Math.abs(v.c)));
      return 'y = ' + coef + 'log_' + formatNumber(v.b) + '(' + inner + ')' + signed(v.d);
    }
    return quarticFormula(v);
  }

  function valueAt(x, v) {
    if (config.kind === 'exp-ae-bx') return v.a * Math.exp(v.b * x);
    if (config.kind === 'log-shifted-tangent') {
      const inner = x - v.c;
      if (inner <= 0) return NaN;
      return v.a * (Math.log(inner) / Math.log(v.b)) + v.d;
    }
    return v.a * x * x * x * x + v.b * x * x * x + v.c * x * x + v.d * x + v.e;
  }

  function derivativeAt(x, v) {
    if (config.kind === 'exp-ae-bx') return v.a * v.b * Math.exp(v.b * x);
    if (config.kind === 'log-shifted-tangent') return v.a / ((x - v.c) * Math.log(v.b));
    return 4 * v.a * x * x * x + 3 * v.b * x * x + 2 * v.c * x + v.d;
  }

  function derivativeValueAt(x, v) {
    return derivativeAt(x, v);
  }

  function visibleSegments(v, fn) {
    const segments = [];
    let points = [];
    const steps = 1200;
    for (let i = 0; i <= steps; i += 1) {
      const x = plot.xMin + (plot.xMax - plot.xMin) * (i / steps);
      const y = fn(x, v);
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

  function drawSegments(segments, className, stroke) {
    segments.forEach(function (points) {
      const path = svg('path', { d: pathFromPoints(points), class: className });
      if (stroke) path.style.stroke = stroke;
      stage.appendChild(path);
    });
  }

  function visibleLineEndpoints(slope, intercept) {
    if (Math.abs(slope) < 1e-10) return [point(plot.xMin, intercept), point(plot.xMax, intercept)];
    const candidates = [
      { x: plot.xMin, y: slope * plot.xMin + intercept },
      { x: plot.xMax, y: slope * plot.xMax + intercept },
      { y: plot.yMin, x: (plot.yMin - intercept) / slope },
      { y: plot.yMax, x: (plot.yMax - intercept) / slope }
    ].filter(function (p) {
      return p.x >= plot.xMin - 1e-9 && p.x <= plot.xMax + 1e-9 && p.y >= plot.yMin - 1e-9 && p.y <= plot.yMax + 1e-9;
    });
    const unique = [];
    candidates.forEach(function (p) {
      if (!unique.some(function (q) { return Math.abs(q.x - p.x) < 1e-7 && Math.abs(q.y - p.y) < 1e-7; })) unique.push(p);
    });
    if (unique.length < 2) return [point(plot.xMin, slope * plot.xMin + intercept), point(plot.xMax, slope * plot.xMax + intercept)];
    return [point(unique[0].x, unique[0].y), point(unique[1].x, unique[1].y)];
  }

  function lineFormula(slope, intercept) {
    const terms = [];
    term(terms, slope, 'x');
    term(terms, intercept, '');
    return 'y = ' + (terms.length ? terms.join('') : '0');
  }

  function drawGraph(v, updateStatus) {
    if (config.kind === 'log-shifted-tangent' && v.c > plot.xMin && v.c < plot.xMax) {
      const asymptote = svg('line', { x1: sx(v.c), y1: sy(plot.yMin), x2: sx(v.c), y2: sy(plot.yMax), class: 'function-line is-dashed' });
      asymptote.style.stroke = '#8fa5da';
      asymptote.style.strokeWidth = '3';
      stage.appendChild(asymptote);
    }

    const segments = visibleSegments(v, valueAt);
    drawSegments(segments, 'function-curve');
    const best = segments.reduce(function (current, segment) { return segment.length > current.length ? segment : current; }, []);
    if (best.length) {
      const anchor = best[Math.min(best.length - 1, Math.max(0, Math.floor(best.length * 0.76)))];
      drawText(formula(v), Math.min(plot.right - 260, Math.max(plot.left + 16, anchor.x + 18)), Math.min(plot.bottom - 22, Math.max(plot.top + 34, anchor.y - 20)), 'muted');
    }

    if (config.showDerivative) {
      const derivativeSegments = visibleSegments(v, derivativeValueAt);
      drawSegments(derivativeSegments, 'function-curve', '#8e44ad');
      const derivativeBest = derivativeSegments.reduce(function (current, segment) { return segment.length > current.length ? segment : current; }, []);
      if (derivativeBest.length) {
        const anchor = derivativeBest[Math.min(derivativeBest.length - 1, Math.max(0, Math.floor(derivativeBest.length * 0.35)))];
        drawText(derivativeFormula(v), Math.min(plot.right - 260, Math.max(plot.left + 16, anchor.x + 18)), Math.min(plot.bottom - 22, Math.max(plot.top + 34, anchor.y - 20)), 'muted');
      }
    }

    const touchY = valueAt(v.t, v);
    const slope = derivativeAt(v.t, v);
    const intercept = touchY - slope * v.t;
    const endpoints = visibleLineEndpoints(slope, intercept);
    const tangent = svg('line', { x1: endpoints[0].x, y1: endpoints[0].y, x2: endpoints[1].x, y2: endpoints[1].y, class: 'function-line' });
    tangent.style.stroke = '#2e7d32';
    stage.appendChild(tangent);
    drawText(lineFormula(slope, intercept), Math.min(plot.right - 240, Math.max(plot.left + 16, endpoints[1].x - 130)), Math.min(plot.bottom - 22, Math.max(plot.top + 34, endpoints[1].y - 18)), 'muted');
    const touch = point(v.t, touchY);
    if (touch.ux >= plot.xMin && touch.ux <= plot.xMax && touch.uy >= plot.yMin && touch.uy <= plot.yMax) {
      stage.appendChild(svg('circle', { cx: touch.x, cy: touch.y, r: 7, class: 'function-point' }));
      drawText('T', touch.x + 15, touch.y - 12, '');
    }
    if (updateStatus !== false) setStatus('x = ' + formatNumber(v.t) + ' で接する接線: ' + lineFormula(slope, intercept), false);
  }

  function render() {
    if (window.InstantGeometryFunctionViewSettings) window.InstantGeometryFunctionViewSettings.applyViewRange(state, plot);
    clear(stage);
    drawGrid();
    try {
      drawGraph(readParams(), true);
    } catch (error) {
      setStatus(error.message, true);
      drawGraph(Object.assign({ a: 1, b: 0, c: 0, d: 0, e: 0, t: 0 }, config.defaults || {}), false);
    }
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
