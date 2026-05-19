(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const config = window.InstantGeometryLinearAlgebraConfig || {};
  const stage = document.getElementById('stage');
  const statusBox = document.getElementById('statusBox');
  const bottomBar = document.getElementById('bottomBar');
  const readout = document.getElementById('readout');
  const sheetBackdrop = document.getElementById('sheetBackdrop');
  const editSheet = document.getElementById('editSheet');
  const saveSheet = document.getElementById('saveSheet');
  const sheetTitle = document.getElementById('sheetTitle');
  const sheetBody = document.getElementById('sheetBody');
  const captureRoot = document.getElementById('captureRoot');
  const playbar = document.getElementById('playbar');
  const playBtn = document.getElementById('playBtn');
  const resetBtn = document.getElementById('resetBtn');
  const tSlider = document.getElementById('tSlider');

  if (!stage || !config.mapType) return;

  const plot = { left: 86, right: 914, top: 86, bottom: 914 };
  const state = {
    values: {},
    viewMode: config.defaultViewMode || 'overlay',
    viewCenterX: Number(config.viewCenterX) || 0,
    viewCenterY: Number(config.viewCenterY) || 0,
    viewWidth: Number(config.viewWidth) || 14,
    viewHeight: Number(config.viewHeight) || 14,
    tickLabelInterval: Number.isFinite(Number(config.tickLabelInterval)) ? Number(config.tickLabelInterval) : 2,
    t: 1
  };
  let timer = null;

  function svg(tag, attrs) {
    const node = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (key) { node.setAttribute(key, attrs[key]); });
    return node;
  }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }
  function fmt(v) {
    if (!Number.isFinite(v)) return '';
    if (Math.abs(v) < 1e-10) return '0';
    const r = Math.round(v * 1000) / 1000;
    return Number.isInteger(r) ? String(r) : String(r).replace(/0+$/, '').replace(/\.$/, '');
  }
  function setStatus(text, isError) {
    if (!statusBox) return;
    statusBox.textContent = text || '';
    statusBox.classList.toggle('error', Boolean(isError));
  }
  function parseNumber(text, label) {
    const raw = String(text || '').trim();
    if (!/^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$/.test(raw)) throw new Error(label + 'は数値で入力してください。');
    return Number(raw);
  }
  function applyView() {
    plot.xMin = state.viewCenterX - state.viewWidth / 2;
    plot.xMax = state.viewCenterX + state.viewWidth / 2;
    plot.yMin = state.viewCenterY - state.viewHeight / 2;
    plot.yMax = state.viewCenterY + state.viewHeight / 2;
  }
  function sx(x) { return plot.left + (x - plot.xMin) / (plot.xMax - plot.xMin) * (plot.right - plot.left); }
  function sy(y) { return plot.top + (plot.yMax - y) / (plot.yMax - plot.yMin) * (plot.bottom - plot.top); }
  function point(v) { return { x: sx(v.x), y: sy(v.y), vx: v.x, vy: v.y }; }
  function append(tag, attrs) { const node = svg(tag, attrs); stage.appendChild(node); return node; }
  function v(x, y) { return { x: x, y: y }; }
  function add(a, b) { return v(a.x + b.x, a.y + b.y); }
  function sub(a, b) { return v(a.x - b.x, a.y - b.y); }
  function scale(a, k) { return v(a.x * k, a.y * k); }
  function dot(a, b) { return a.x * b.x + a.y * b.y; }
  function mat(A, p) { return v(A.a * p.x + A.b * p.y, A.c * p.x + A.d * p.y); }
  function det(A) { return A.a * A.d - A.b * A.c; }

  function buildInputs() {
    clear(bottomBar);
    const fields = config.fields || [];
    bottomBar.className = 'bottom-bar ' + (fields.length > 4 ? 'six-fields' : fields.length > 2 ? 'four-fields' : 'two-fields');
    fields.forEach(function (field) {
      state.values[field.id] = Number(field.value) || 0;
      const wrap = document.createElement('div');
      wrap.className = 'field';
      const label = document.createElement('div');
      label.className = 'field-label';
      label.textContent = field.label;
      const input = document.createElement('input');
      input.className = 'field-input';
      input.id = field.id;
      input.type = 'text';
      input.inputMode = 'decimal';
      input.value = fmt(state.values[field.id]);
      input.addEventListener('input', render);
      wrap.appendChild(label);
      wrap.appendChild(input);
      bottomBar.appendChild(wrap);
    });
  }
  function readValues() {
    (config.fields || []).forEach(function (field) {
      state.values[field.id] = parseNumber(document.getElementById(field.id).value, field.label);
    });
  }
  function drawDefs() {
    const defs = append('defs', {});
    const marker = svg('marker', { id: 'laArrow', markerWidth: 10, markerHeight: 10, refX: 8.5, refY: 5, orient: 'auto', markerUnits: 'userSpaceOnUse' });
    marker.appendChild(svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: 'context-stroke' }));
    defs.appendChild(marker);
  }
  function drawGrid(bounds) {
    const left = bounds ? bounds.left : plot.left;
    const right = bounds ? bounds.right : plot.right;
    const top = bounds ? bounds.top : plot.top;
    const bottom = bounds ? bounds.bottom : plot.bottom;
    for (let x = Math.ceil(plot.xMin); x <= Math.floor(plot.xMax); x += 1) {
      const px = sx(x);
      if (px < left || px > right) continue;
      append('line', { x1: px, y1: top, x2: px, y2: bottom, class: x === 0 || x % 5 === 0 ? 'la-grid-major' : 'la-grid-minor' });
      if (plot.yMin <= 0 && plot.yMax >= 0 && state.tickLabelInterval > 0 && x !== 0 && x % state.tickLabelInterval === 0) {
        const t = append('text', { x: px - 12, y: sy(0) + 28, class: 'la-tick-label' }); t.textContent = String(x);
      }
    }
    for (let y = Math.ceil(plot.yMin); y <= Math.floor(plot.yMax); y += 1) {
      const py = sy(y);
      if (py < top || py > bottom) continue;
      append('line', { x1: left, y1: py, x2: right, y2: py, class: y === 0 || y % 5 === 0 ? 'la-grid-major' : 'la-grid-minor' });
      if (plot.xMin <= 0 && plot.xMax >= 0 && state.tickLabelInterval > 0 && y !== 0 && y % state.tickLabelInterval === 0) {
        const t = append('text', { x: sx(0) + 15, y: py + 7, class: 'la-tick-label' }); t.textContent = String(y);
      }
    }
    if (plot.yMin <= 0 && plot.yMax >= 0) append('line', { x1: left, y1: sy(0), x2: right, y2: sy(0), class: 'la-axis' });
    if (plot.xMin <= 0 && plot.xMax >= 0) append('line', { x1: sx(0), y1: top, x2: sx(0), y2: bottom, class: 'la-axis' });
  }
  function drawText(text, x, y, cls) {
    const n = append('text', { x: x, y: y, class: 'la-label ' + (cls || '') });
    n.textContent = text;
    return n;
  }
  function drawVector(from, to, color, label) {
    const p = point(from);
    const q = point(to);
    append('line', { x1: p.x, y1: p.y, x2: q.x, y2: q.y, class: 'la-vector', stroke: color || '#2a5bd7' });
    if (label) drawText(label, q.x + 12, q.y - 12);
  }
  function drawPoint(p, color, label) {
    const q = point(p);
    append('circle', { cx: q.x, cy: q.y, r: 8, class: 'la-point', fill: color || '#e25555' });
    if (label) drawText(label, q.x + 12, q.y - 12);
  }
  function drawLineThrough(base, dir, color, dashed) {
    const candidates = [];
    if (Math.abs(dir.x) > 1e-10) {
      candidates.push(add(base, scale(dir, (plot.xMin - base.x) / dir.x)));
      candidates.push(add(base, scale(dir, (plot.xMax - base.x) / dir.x)));
    }
    if (Math.abs(dir.y) > 1e-10) {
      candidates.push(add(base, scale(dir, (plot.yMin - base.y) / dir.y)));
      candidates.push(add(base, scale(dir, (plot.yMax - base.y) / dir.y)));
    }
    const inside = candidates.filter(function (p) {
      return p.x >= plot.xMin - 1e-8 && p.x <= plot.xMax + 1e-8 && p.y >= plot.yMin - 1e-8 && p.y <= plot.yMax + 1e-8;
    });
    if (inside.length < 2) return;
    const a = point(inside[0]);
    const b = point(inside[1]);
    append('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'la-line' + (dashed ? ' dashed' : ''), stroke: color || '#2a5bd7' });
  }
  function setReadout(items) {
    clear(readout);
    items.forEach(function (text) {
      const n = document.createElement('div');
      n.className = 'linear-algebra-readout-item';
      n.textContent = text;
      readout.appendChild(n);
    });
  }

  function drawVector2() {
    const a = v(state.values.x, state.values.y);
    drawGrid();
    drawVector(v(0, 0), a, '#2a5bd7', 'v');
    drawPoint(a, '#e25555', '(' + fmt(a.x) + ', ' + fmt(a.y) + ')');
    drawLineThrough(a, v(1, 0), '#8fa5da', true);
    drawLineThrough(a, v(0, 1), '#8fa5da', true);
    setReadout(['v = (' + fmt(a.x) + ', ' + fmt(a.y) + ')', '|v| = ' + fmt(Math.hypot(a.x, a.y)), 'arg v = ' + fmt(Math.atan2(a.y, a.x) * 180 / Math.PI) + '°']);
    setStatus('R² の対象として、平面ベクトル v を表示しています。');
  }
  function functionalValue() {
    const n = v(state.values.a, state.values.b);
    const p = v(state.values.px, state.values.py);
    return { n: n, p: p, value: dot(n, p) };
  }
  function drawFunctionalSplit() {
    const data = functionalValue();
    drawGrid();
    for (let c = -12; c <= 12; c += 2) drawLineThrough(scale(data.n, c / Math.max(1e-10, dot(data.n, data.n))), v(-data.n.y, data.n.x), '#d7deec', false);
    drawLineThrough(scale(data.n, data.value / Math.max(1e-10, dot(data.n, data.n))), v(-data.n.y, data.n.x), '#2a5bd7', false);
    drawVector(v(0, 0), data.n, '#2e7d32', '∇f');
    drawPoint(data.p, '#e25555', 'P');
    drawOutputMeter(data.value);
  }
  function drawFunctionalColor() {
    const data = functionalValue();
    const cols = 18;
    const rows = 18;
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        const x0 = plot.xMin + (plot.xMax - plot.xMin) * i / cols;
        const x1 = plot.xMin + (plot.xMax - plot.xMin) * (i + 1) / cols;
        const y0 = plot.yMin + (plot.yMax - plot.yMin) * j / rows;
        const y1 = plot.yMin + (plot.yMax - plot.yMin) * (j + 1) / rows;
        const value = data.n.x * ((x0 + x1) / 2) + data.n.y * ((y0 + y1) / 2);
        const alpha = Math.min(0.28, Math.abs(value) / 24);
        const fill = value >= 0 ? 'rgba(42,91,215,' + alpha + ')' : 'rgba(226,85,85,' + alpha + ')';
        append('rect', { x: sx(x0), y: sy(y1), width: sx(x1) - sx(x0), height: sy(y0) - sy(y1), fill: fill });
      }
    }
    drawGrid();
    for (let c = -12; c <= 12; c += 2) drawLineThrough(scale(data.n, c / Math.max(1e-10, dot(data.n, data.n))), v(-data.n.y, data.n.x), '#8fa5da', true);
    drawVector(v(0, 0), data.n, '#2e7d32', '∇f');
    drawPoint(data.p, '#e25555', 'P');
  }
  function iso(x, y, z) {
    return { x: 500 + (x - y) * 34, y: 560 + (x + y) * 16 - z * 22 };
  }
  function drawFunctionalSurface() {
    const data = functionalValue();
    append('rect', { x: 80, y: 80, width: 840, height: 840, fill: '#fbfcff' });
    for (let x = -5; x <= 5; x += 1) {
      const pts = [];
      for (let y = -5; y <= 5; y += 1) pts.push(iso(x, y, data.n.x * x + data.n.y * y));
      append('path', { d: pts.map(function (p, i) { return (i ? 'L ' : 'M ') + p.x + ' ' + p.y; }).join(' '), class: 'la-line', stroke: '#8fa5da' });
    }
    for (let y = -5; y <= 5; y += 1) {
      const pts = [];
      for (let x = -5; x <= 5; x += 1) pts.push(iso(x, y, data.n.x * x + data.n.y * y));
      append('path', { d: pts.map(function (p, i) { return (i ? 'L ' : 'M ') + p.x + ' ' + p.y; }).join(' '), class: 'la-line', stroke: '#cbd5e1' });
    }
    const pp = iso(data.p.x, data.p.y, data.value);
    append('circle', { cx: pp.x, cy: pp.y, r: 8, class: 'la-point', fill: '#e25555' });
    drawText('P, f(P)', pp.x + 12, pp.y - 12);
    drawText('z = ax + by', 112, 128, 'muted');
  }
  function drawOutputMeter(value) {
    const x = 760, y = 165, w = 92, h = 650;
    append('rect', { x: x, y: y, width: w, height: h, rx: 12, class: 'la-output-panel' });
    append('line', { x1: x + w / 2, y1: y + 35, x2: x + w / 2, y2: y + h - 35, class: 'la-axis' });
    const clamped = Math.max(-12, Math.min(12, value));
    const py = y + h / 2 - clamped / 24 * (h - 80);
    append('circle', { cx: x + w / 2, cy: py, r: 10, class: 'la-point', fill: value >= 0 ? '#2a5bd7' : '#e25555' });
    drawText('f(P)', x - 2, y + 24, 'muted');
    drawText(fmt(value), x - 10, py - 18);
  }
  function drawFunctional() {
    if (state.viewMode === 'surface3d') drawFunctionalSurface();
    else if (state.viewMode === 'color') drawFunctionalColor();
    else drawFunctionalSplit();
    const data = functionalValue();
    setReadout(['f(x,y) = ' + fmt(data.n.x) + 'x + ' + fmt(data.n.y) + 'y', 'P = (' + fmt(data.p.x) + ', ' + fmt(data.p.y) + ')', 'f(P) = ' + fmt(data.value)]);
    setStatus('R² → R の線形汎関数を ' + viewModeLabel() + ' で表示しています。');
  }
  function transformData() {
    const A = { a: state.values.a, b: state.values.b, c: state.values.c, d: state.values.d };
    const p = v(state.values.x, state.values.y);
    return { A: A, p: p, image: mat(A, p) };
  }
  function drawTransformedGrid(A, t, bounds) {
    const mix = { a: 1 + (A.a - 1) * t, b: A.b * t, c: A.c * t, d: 1 + (A.d - 1) * t };
    for (let k = -6; k <= 6; k += 1) {
      const h = [], vv = [];
      for (let i = -60; i <= 60; i += 1) {
        const s = i / 10;
        h.push(point(mat(mix, v(s, k))));
        vv.push(point(mat(mix, v(k, s))));
      }
      append('path', { d: h.map(function (p, idx) { return (idx ? 'L ' : 'M ') + p.x + ' ' + p.y; }).join(' '), class: 'la-line', stroke: bounds ? '#2a5bd7' : '#8fa5da' });
      append('path', { d: vv.map(function (p, idx) { return (idx ? 'L ' : 'M ') + p.x + ' ' + p.y; }).join(' '), class: 'la-line', stroke: bounds ? '#2a5bd7' : '#8fa5da' });
    }
    return mix;
  }
  function drawUnitSquare(A, t) {
    const mix = { a: 1 + (A.a - 1) * t, b: A.b * t, c: A.c * t, d: 1 + (A.d - 1) * t };
    const pts = [v(0, 0), mat(mix, v(1, 0)), mat(mix, v(1, 1)), mat(mix, v(0, 1))].map(point);
    append('polygon', { points: pts.map(function (p) { return p.x + ',' + p.y; }).join(' '), class: 'la-fill-blue' });
  }
  function drawTransformOverlay() {
    const data = transformData();
    drawGrid();
    drawTransformedGrid(data.A, state.viewMode === 'animated' ? state.t : 1);
    drawUnitSquare(data.A, state.viewMode === 'animated' ? state.t : 1);
    const current = state.viewMode === 'animated' ? add(scale(data.p, 1 - state.t), scale(data.image, state.t)) : data.image;
    drawVector(v(0, 0), data.p, '#e25555', 'v');
    drawVector(v(0, 0), current, '#2a5bd7', state.viewMode === 'animated' ? 'Tₜv' : 'Av');
  }
  function drawTransformSplit() {
    const data = transformData();
    append('rect', { x: 72, y: 86, width: 392, height: 828, fill: '#fbfcff', stroke: '#d9dce7', 'stroke-width': 2 });
    append('rect', { x: 536, y: 86, width: 392, height: 828, fill: '#fbfcff', stroke: '#d9dce7', 'stroke-width': 2 });
    const originalPlot = Object.assign({}, plot);
    plot.left = 92; plot.right = 444; drawGrid({ left: 92, right: 444, top: 106, bottom: 894 }); drawVector(v(0, 0), data.p, '#e25555', 'v');
    plot.left = 556; plot.right = 908; drawGrid({ left: 556, right: 908, top: 106, bottom: 894 }); drawTransformedGrid(data.A, 1); drawVector(v(0, 0), data.image, '#2a5bd7', 'Av');
    Object.assign(plot, originalPlot);
    drawText('入力 R²', 108, 130, 'muted');
    drawText('出力 R²', 572, 130, 'muted');
  }
  function drawTransform() {
    const data = transformData();
    if (state.viewMode === 'split') drawTransformSplit();
    else drawTransformOverlay();
    setReadout(['A = [[' + fmt(data.A.a) + ', ' + fmt(data.A.b) + '], [' + fmt(data.A.c) + ', ' + fmt(data.A.d) + ']]', 'Av = (' + fmt(data.image.x) + ', ' + fmt(data.image.y) + ')', 'det A = ' + fmt(det(data.A))]);
    setStatus('R² → R² の一次変換を ' + viewModeLabel() + ' で表示しています。');
  }
  function viewModeLabel() {
    const labels = { split: '分割表示', color: '色表示', surface3d: '3D表示', overlay: '重ね表示', animated: 'アニメーション表示' };
    return labels[state.viewMode] || state.viewMode;
  }
  function render() {
    try {
      readValues();
      applyView();
      clear(stage);
      drawDefs();
      if (playbar) playbar.hidden = !(config.mapType === 'r2-to-r2' && state.viewMode === 'animated');
      if (config.mapType === 'r2-object') drawVector2();
      if (config.mapType === 'r2-to-r') drawFunctional();
      if (config.mapType === 'r2-to-r2') drawTransform();
    } catch (error) {
      setStatus(error.message || '入力を確認してください。', true);
    }
  }
  function buildTextInput(labelText, value) {
    const field = document.createElement('div');
    field.className = 'sheet-field';
    const label = document.createElement('label');
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = value || '';
    field.appendChild(label);
    field.appendChild(input);
    return { field: field, input: input };
  }
  function buildSelect(labelText, value, options) {
    const field = document.createElement('div');
    field.className = 'sheet-field';
    const label = document.createElement('label');
    label.textContent = labelText;
    const select = document.createElement('select');
    options.forEach(function (option) {
      const node = document.createElement('option');
      node.value = option.value;
      node.textContent = option.label;
      select.appendChild(node);
    });
    select.value = value;
    field.appendChild(label);
    field.appendChild(select);
    return { field: field, select: select };
  }
  function openSheet(title) {
    sheetTitle.textContent = title;
    clear(sheetBody);
    editSheet.classList.add('open');
    editSheet.setAttribute('aria-hidden', 'false');
    saveSheet.classList.remove('open');
    sheetBackdrop.classList.add('open');
  }
  function closeSheets() {
    editSheet.classList.remove('open');
    saveSheet.classList.remove('open');
    editSheet.setAttribute('aria-hidden', 'true');
    saveSheet.setAttribute('aria-hidden', 'true');
    sheetBackdrop.classList.remove('open');
  }
  function viewModeOptions() {
    if (config.mapType === 'r2-to-r') return [
      { value: 'split', label: '入力平面 + 出力メーター' },
      { value: 'color', label: '入力平面 + 色' },
      { value: 'surface3d', label: '3Dグラフ' }
    ];
    if (config.mapType === 'r2-to-r2') return [
      { value: 'overlay', label: '重ね表示' },
      { value: 'split', label: '左右分割' },
      { value: 'animated', label: 'アニメーション' }
    ];
    return null;
  }
  function openSettingsSheet() {
    openSheet('設定');
    const modeOptions = viewModeOptions();
    let mode = null;
    if (modeOptions) {
      mode = buildSelect('表示方式', state.viewMode, modeOptions);
      sheetBody.appendChild(mode.field);
    }
    const centerX = buildTextInput('中心のx座標', fmt(state.viewCenterX));
    const centerY = buildTextInput('中心のy座標', fmt(state.viewCenterY));
    const width = buildTextInput('横幅', fmt(state.viewWidth));
    const height = buildTextInput('縦幅', fmt(state.viewHeight));
    const tick = buildSelect('座標数字', String(state.tickLabelInterval), [
      { value: '1', label: '1刻み' },
      { value: '2', label: '2刻み' },
      { value: '5', label: '5刻み' },
      { value: '0', label: '非表示' }
    ]);
    [centerX, centerY, width, height].forEach(function (item) { sheetBody.appendChild(item.field); });
    sheetBody.appendChild(tick.field);
    const actions = document.createElement('div');
    actions.className = 'sheet-actions';
    const cancel = document.createElement('button');
    cancel.className = 'btn'; cancel.type = 'button'; cancel.textContent = 'キャンセル';
    const save = document.createElement('button');
    save.className = 'btn action-primary'; save.type = 'button'; save.textContent = '保存';
    cancel.addEventListener('click', closeSheets);
    save.addEventListener('click', function () {
      try {
        if (mode) state.viewMode = mode.select.value;
        state.viewCenterX = parseNumber(centerX.input.value, '中心のx座標');
        state.viewCenterY = parseNumber(centerY.input.value, '中心のy座標');
        state.viewWidth = parseNumber(width.input.value, '横幅');
        state.viewHeight = parseNumber(height.input.value, '縦幅');
        if (state.viewWidth <= 0 || state.viewHeight <= 0) throw new Error('横幅と縦幅は0より大きい数値で入力してください。');
        state.tickLabelInterval = Number(tick.select.value) || 0;
        closeSheets();
        render();
      } catch (error) {
        setStatus(error.message || '入力を確認してください。', true);
      }
    });
    actions.appendChild(cancel);
    actions.appendChild(save);
    sheetBody.appendChild(actions);
  }
  function openSaveSheet() {
    saveSheet.classList.add('open');
    saveSheet.setAttribute('aria-hidden', 'false');
    sheetBackdrop.classList.add('open');
  }
  function captureCanvas(backgroundColor) {
    if (!window.html2canvas) return Promise.reject(new Error('保存に失敗しました。'));
    return window.html2canvas(captureRoot, { backgroundColor: backgroundColor, scale: 2 });
  }
  function saveImage(format) {
    return captureCanvas(format === 'transparent' ? null : '#ffffff').then(function (canvas) {
      const link = document.createElement('a');
      link.download = format === 'transparent' ? config.slug + '-transparent.png' : config.slug + '.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  }
  function savePdf() {
    if (!window.jspdf || !window.jspdf.jsPDF) return Promise.reject(new Error('PDF保存に失敗しました。'));
    return captureCanvas('#ffffff').then(function (canvas) {
      const pdf = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const scale = Math.min((pageW - 48) / canvas.width, (pageH - 48) / canvas.height);
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pageW - canvas.width * scale) / 2, 24, canvas.width * scale, canvas.height * scale);
      pdf.save(config.slug + '.pdf');
    });
  }
  function saveWithQuota(format) {
    const runner = window.InstantGeometrySaveQuota && window.InstantGeometrySaveQuota.runWithQuota ? window.InstantGeometrySaveQuota.runWithQuota : function (fn) { return fn(); };
    return runner(function () { return format === 'pdf' ? savePdf() : saveImage(format); }).then(closeSheets).catch(function (error) {
      setStatus(error.message || '保存に失敗しました。', true);
    });
  }
  function togglePlay() {
    if (timer) {
      clearInterval(timer); timer = null; playBtn.textContent = '再生'; return;
    }
    playBtn.textContent = '停止';
    timer = setInterval(function () {
      state.t += 0.015;
      if (state.t > 1) state.t = 0;
      tSlider.value = String(state.t);
      render();
    }, 33);
  }
  function bind() {
    document.getElementById('backBtn').addEventListener('click', function () { window.location.href = '../../'; });
    document.getElementById('settingsBtn').addEventListener('click', openSettingsSheet);
    const saveButton = document.getElementById('saveBtn');
    if (window.InstantGeometrySaveQuota && saveButton) window.InstantGeometrySaveQuota.createIndicator({ target: saveButton });
    saveButton.addEventListener('click', openSaveSheet);
    document.getElementById('sheetClose').addEventListener('click', closeSheets);
    document.getElementById('saveSheetClose').addEventListener('click', closeSheets);
    document.getElementById('savePngBtn').addEventListener('click', function () { saveWithQuota('png'); });
    document.getElementById('saveTransparentBtn').addEventListener('click', function () { saveWithQuota('transparent'); });
    document.getElementById('savePdfBtn').addEventListener('click', function () { saveWithQuota('pdf'); });
    sheetBackdrop.addEventListener('click', closeSheets);
    if (playBtn) playBtn.addEventListener('click', togglePlay);
    if (resetBtn) resetBtn.addEventListener('click', function () { state.t = 0; tSlider.value = '0'; render(); });
    if (tSlider) tSlider.addEventListener('input', function () { state.t = Number(tSlider.value) || 0; render(); });
  }

  buildInputs();
  bind();
  render();
})();
