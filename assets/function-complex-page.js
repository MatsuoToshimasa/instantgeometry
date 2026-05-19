(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const core = window.InstantGeometryComplexCore;
  const config = window.InstantGeometryComplexConfig || {};
  const stage = document.getElementById('stage');
  const statusBox = document.getElementById('statusBox');
  const sheetBackdrop = document.getElementById('sheetBackdrop');
  const editSheet = document.getElementById('editSheet');
  const saveSheet = document.getElementById('saveSheet');
  const sheetTitle = document.getElementById('sheetTitle');
  const sheetBody = document.getElementById('sheetBody');
  const bottomBar = document.getElementById('bottomBar');
  const readout = document.getElementById('readout');
  const captureRoot = document.getElementById('captureRoot');

  if (!stage || !core || !config.kind) return;

  const plot = { left: 86, right: 914, top: 86, bottom: 914 };
  const palette = ['#2a5bd7', '#e25555', '#2e7d32', '#8e44ad', '#d97706', '#111827'];
  const state = {
    viewCenterRe: Number(config.viewCenterRe) || 0,
    viewCenterIm: Number(config.viewCenterIm) || 0,
    viewWidth: Number(config.viewWidth) || 14,
    viewHeight: Number(config.viewHeight) || 14,
    tickLabelInterval: Number.isFinite(Number(config.tickLabelInterval)) ? Number(config.tickLabelInterval) : 2,
    values: {},
    targets: {},
    labelOffsets: {}
  };

  let moveMode = null;
  let moveDrag = null;
  let currentLabelBases = {};

  const moveToolbar = document.createElement('div');
  moveToolbar.className = 'move-toolbar';
  moveToolbar.setAttribute('aria-hidden', 'true');
  const moveCancelBtn = button('キャンセル', 'btn');
  const moveDoneBtn = button('完了', 'btn action-primary');
  moveToolbar.appendChild(moveCancelBtn);
  moveToolbar.appendChild(moveDoneBtn);
  document.body.appendChild(moveToolbar);

  function svg(tag, attrs) {
    const node = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (key) {
      node.setAttribute(key, attrs[key]);
    });
    return node;
  }

  function button(text, className) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = className || 'btn';
    node.textContent = text;
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function setStatus(message, isError) {
    statusBox.textContent = message || '';
    statusBox.classList.toggle('error', Boolean(isError));
  }

  function parseNumberText(text, label) {
    const raw = String(text || '').trim();
    if (!/^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$/.test(raw)) {
      throw new Error(label + 'は数値で入力してください。');
    }
    return Number(raw);
  }

  function fmt(value) {
    return core.numberText(value);
  }

  function initValues() {
    (config.variables || []).forEach(function (variable) {
      if (variable.type === 'real') {
        state.values[variable.id] = Number(variable.value) || 0;
      } else {
        state.values[variable.id] = {
          re: Number(variable.re) || 0,
          im: Number(variable.im) || 0
        };
      }
    });
  }

  function initTargets() {
    (config.targets || []).forEach(function (target) {
      state.targets[target.key] = {
        key: target.key,
        type: target.type,
        title: target.title,
        defaultLabel: target.defaultLabel || '',
        labelMode: target.labelMode || 'auto',
        customLabel: target.customLabel || '',
        color: target.color || '#2a5bd7'
      };
    });
  }

  function applyViewRange() {
    plot.xMin = state.viewCenterRe - state.viewWidth / 2;
    plot.xMax = state.viewCenterRe + state.viewWidth / 2;
    plot.yMin = state.viewCenterIm - state.viewHeight / 2;
    plot.yMax = state.viewCenterIm + state.viewHeight / 2;
  }

  function sx(re) {
    return plot.left + (re - plot.xMin) / (plot.xMax - plot.xMin) * (plot.right - plot.left);
  }

  function sy(im) {
    return plot.top + (plot.yMax - im) / (plot.yMax - plot.yMin) * (plot.bottom - plot.top);
  }

  function toPoint(z) {
    return { x: sx(z.re), y: sy(z.im), re: z.re, im: z.im };
  }

  function buildInputs() {
    clear(bottomBar);
    const variables = config.variables || [];
    bottomBar.className = 'bottom-bar ' + (variables.length > 1 ? 'four-fields' : 'two-fields');
    variables.forEach(function (variable) {
      if (variable.type === 'real') {
        const realField = inputField(variable.label || variable.id, variable.id, state.values[variable.id]);
        bottomBar.appendChild(realField.field);
        realField.input.addEventListener('input', render);
        return;
      }
      const reField = inputField(variable.reLabel || variable.id + ' 実部', variable.id + 'Re', state.values[variable.id].re);
      const imField = inputField(variable.imLabel || variable.id + ' 虚部', variable.id + 'Im', state.values[variable.id].im);
      bottomBar.appendChild(reField.field);
      bottomBar.appendChild(imField.field);
      reField.input.addEventListener('input', render);
      imField.input.addEventListener('input', render);
    });
  }

  function inputField(labelText, id, value) {
    const field = document.createElement('div');
    field.className = 'field';
    const label = document.createElement('div');
    label.className = 'field-label';
    label.textContent = labelText;
    const input = document.createElement('input');
    input.className = 'field-input';
    input.id = id;
    input.type = 'text';
    input.inputMode = 'decimal';
    input.value = fmt(value);
    field.appendChild(label);
    field.appendChild(input);
    return { field: field, input: input };
  }

  function readValues() {
    (config.variables || []).forEach(function (variable) {
      if (variable.type === 'real') {
        state.values[variable.id] = parseNumberText(document.getElementById(variable.id).value, variable.label || variable.id);
      } else {
        state.values[variable.id] = {
          re: parseNumberText(document.getElementById(variable.id + 'Re').value, variable.reLabel || variable.id + 'の実部'),
          im: parseNumberText(document.getElementById(variable.id + 'Im').value, variable.imLabel || variable.id + 'の虚部')
        };
      }
    });
  }

  function target(key) {
    return state.targets[key] || {
      key: key,
      type: 'label',
      title: key,
      defaultLabel: key,
      labelMode: 'auto',
      customLabel: '',
      color: '#2a5bd7'
    };
  }

  function targetLabel(key, fallback) {
    const item = target(key);
    if (item.labelMode === 'hidden') return '';
    if (item.labelMode === 'custom') return item.customLabel;
    return item.defaultLabel || fallback || '';
  }

  function labelOffset(key) {
    if (!state.labelOffsets[key]) state.labelOffsets[key] = { x: 0, y: 0 };
    return state.labelOffsets[key];
  }

  function positionedLabel(key, base) {
    currentLabelBases[key] = { x: base.x, y: base.y };
    const offset = labelOffset(key);
    return { x: base.x + offset.x, y: base.y + offset.y };
  }

  function isMoving(key) {
    return moveMode && moveMode.key === key;
  }

  function addClick(node, key) {
    node.addEventListener('click', function (event) {
      event.stopPropagation();
      if (!moveMode) openTargetSheet(key);
    });
    return node;
  }

  function drawText(text, x, y, className, key) {
    if (!text) return null;
    const pos = positionedLabel(key, { x: x, y: y });
    const node = svg('text', {
      x: pos.x,
      y: pos.y,
      class: 'complex-label ' + (className || '') + (isMoving(key) ? ' label-move-target' : '')
    });
    node.textContent = text;
    if (key) addClick(node, key);
    if (isMoving(key)) {
      node.addEventListener('pointerdown', function (event) {
        event.preventDefault();
        moveDrag = {
          key: key,
          startPoint: pointerToSvgPoint(event),
          startOffset: Object.assign({}, labelOffset(key))
        };
      });
    }
    stage.appendChild(node);
    return node;
  }

  function drawPoint(key, z, label, dx, dy) {
    const item = target(key);
    const p = toPoint(z);
    addClick(svgAppend('circle', { cx: p.x, cy: p.y, r: 10, class: 'complex-point', fill: item.color }), key);
    addClick(svgAppend('circle', { cx: p.x, cy: p.y, r: 22, class: 'complex-point-hit' }), key);
    drawText(targetLabel(key, label), p.x + (dx || 16), p.y + (dy || -14), '', key);
  }

  function svgAppend(tag, attrs) {
    const node = svg(tag, attrs);
    stage.appendChild(node);
    return node;
  }

  function path(points) {
    return points.map(function (p, index) {
      return (index ? 'L ' : 'M ') + p.x + ' ' + p.y;
    }).join(' ');
  }

  function drawLinePath(key, points, className, color, dashed) {
    const attrs = { d: path(points), class: className || 'complex-segment', stroke: color || target(key).color };
    if (dashed) attrs['stroke-dasharray'] = '14 12';
    addClick(svgAppend('path', attrs), key);
    addClick(svgAppend('path', { d: attrs.d, class: 'complex-line-hit' }), key);
  }

  function drawComplexPolyline(key, values, color, dashed) {
    const rangeLimit = Math.max(Math.abs(plot.xMin), Math.abs(plot.xMax), Math.abs(plot.yMin), Math.abs(plot.yMax)) * 4;
    let points = [];
    values.forEach(function (z) {
      if (!Number.isFinite(z.re) || !Number.isFinite(z.im) || Math.abs(z.re) > rangeLimit || Math.abs(z.im) > rangeLimit) {
        if (points.length > 1) drawLinePath(key, points, 'complex-segment', color || target(key).color, dashed);
        points = [];
        return;
      }
      const p = toPoint(z);
      if (points.length) {
        const last = points[points.length - 1];
        const jump = Math.hypot(p.x - last.x, p.y - last.y);
        if (jump > 260) {
          if (points.length > 1) drawLinePath(key, points, 'complex-segment', color || target(key).color, dashed);
          points = [];
        }
      }
      points.push(p);
    });
    if (points.length > 1) drawLinePath(key, points, 'complex-segment', color || target(key).color, dashed);
  }

  function drawInfiniteLine(key, normal, c, color, dashed) {
    const a = normal.re;
    const b = normal.im;
    const points = [];
    if (Math.abs(b) > 1e-10) {
      points.push({ re: plot.xMin, im: (c - a * plot.xMin) / b });
      points.push({ re: plot.xMax, im: (c - a * plot.xMax) / b });
    } else if (Math.abs(a) > 1e-10) {
      const x = c / a;
      points.push({ re: x, im: plot.yMin });
      points.push({ re: x, im: plot.yMax });
    }
    drawComplexPolyline(key, points, color, dashed);
  }

  function drawTransformGrid(transform, key, color) {
    for (let v = -3; v <= 3; v += 1) {
      const horizontal = [];
      const vertical = [];
      for (let i = -80; i <= 80; i += 1) {
        const t = i / 10;
        horizontal.push(transform({ re: t, im: v }));
        vertical.push(transform({ re: v, im: t }));
      }
      drawComplexPolyline(key, horizontal, color || target(key).color, v === 0);
      drawComplexPolyline(key, vertical, color || target(key).color, v === 0);
    }
  }

  function rootsOf(z, n) {
    const count = Math.max(1, Math.round(n));
    const r = Math.pow(core.abs(z), 1 / count);
    const theta = core.arg(z);
    const roots = [];
    for (let k = 0; k < count; k += 1) roots.push(core.fromPolar(r, (theta + 2 * Math.PI * k) / count));
    return roots;
  }

  function drawVector(key, from, to, color, dashed) {
    const p = toPoint(from);
    const q = toPoint(to);
    const attrs = { x1: p.x, y1: p.y, x2: q.x, y2: q.y, class: 'complex-vector', stroke: color || target(key).color, 'marker-end': 'url(#complexArrow)' };
    if (dashed) attrs['stroke-dasharray'] = '14 12';
    addClick(svgAppend('line', attrs), key);
    addClick(svgAppend('line', { x1: p.x, y1: p.y, x2: q.x, y2: q.y, class: 'complex-line-hit' }), key);
  }

  function drawCircle(key, center, radius, color) {
    const c = toPoint(center);
    const rx = Math.abs(sx(center.re + radius) - sx(center.re));
    const ry = Math.abs(sy(center.im + radius) - sy(center.im));
    addClick(svgAppend('ellipse', { cx: c.x, cy: c.y, rx: rx, ry: ry, class: 'complex-circle', stroke: color || target(key).color }), key);
    addClick(svgAppend('ellipse', { cx: c.x, cy: c.y, rx: rx, ry: ry, class: 'complex-circle-hit' }), key);
  }

  function drawAngle(key, radius, start, end) {
    const startPoint = { re: Math.cos(start) * radius, im: Math.sin(start) * radius };
    const endPoint = { re: Math.cos(end) * radius, im: Math.sin(end) * radius };
    const p = toPoint(startPoint);
    const q = toPoint(endPoint);
    const sweep = normalizeSweep(end - start);
    const largeArc = Math.abs(sweep) > Math.PI ? 1 : 0;
    const cmd = 'M ' + p.x + ' ' + p.y + ' A ' + Math.abs(sx(radius) - sx(0)) + ' ' + Math.abs(sy(radius) - sy(0)) + ' 0 ' + largeArc + ' ' + (sweep >= 0 ? 0 : 1) + ' ' + q.x + ' ' + q.y;
    addClick(svgAppend('path', { d: cmd, class: 'complex-angle', stroke: target(key).color }), key);
    addClick(svgAppend('path', { d: cmd, class: 'complex-angle-hit' }), key);
  }

  function normalizeSweep(value) {
    let v = value;
    while (v > Math.PI * 2) v -= Math.PI * 2;
    while (v < -Math.PI * 2) v += Math.PI * 2;
    return v;
  }

  function drawGrid() {
    const tickLabelInterval = Number(state.tickLabelInterval) || 0;
    const startX = Math.ceil(plot.xMin);
    const endX = Math.floor(plot.xMax);
    const startY = Math.ceil(plot.yMin);
    const endY = Math.floor(plot.yMax);
    const hasRealAxis = plot.yMin <= 0 && plot.yMax >= 0;
    const hasImagAxis = plot.xMin <= 0 && plot.xMax >= 0;

    for (let x = startX; x <= endX; x += 1) {
      const px = sx(x);
      svgAppend('line', { x1: px, y1: plot.top, x2: px, y2: plot.bottom, class: x === 0 || x % 5 === 0 ? 'complex-grid-major' : 'complex-grid-minor' });
      if (hasRealAxis && tickLabelInterval > 0 && x !== 0 && x % tickLabelInterval === 0) {
        const label = svgAppend('text', { x: px - 12, y: sy(0) + 28, class: 'complex-tick-label' });
        label.textContent = String(x);
      }
    }
    for (let y = startY; y <= endY; y += 1) {
      const py = sy(y);
      svgAppend('line', { x1: plot.left, y1: py, x2: plot.right, y2: py, class: y === 0 || y % 5 === 0 ? 'complex-grid-major' : 'complex-grid-minor' });
      if (hasImagAxis && tickLabelInterval > 0 && y !== 0 && y % tickLabelInterval === 0) {
        const label = svgAppend('text', { x: sx(0) + 15, y: py + 7, class: 'complex-tick-label' });
        label.textContent = String(y);
      }
    }
    if (hasRealAxis) svgAppend('line', { x1: plot.left, y1: sy(0), x2: plot.right, y2: sy(0), class: 'complex-axis' });
    if (hasImagAxis) svgAppend('line', { x1: sx(0), y1: plot.top, x2: sx(0), y2: plot.bottom, class: 'complex-axis' });
    if (hasRealAxis) {
      const re = svgAppend('text', { x: plot.right + 14, y: sy(0) + 8, class: 'complex-axis-label' });
      re.textContent = 'Re';
    }
    if (hasImagAxis) {
      const im = svgAppend('text', { x: sx(0) + 12, y: plot.top - 14, class: 'complex-axis-label' });
      im.textContent = 'Im';
    }
  }

  function drawDefs() {
    const defs = svgAppend('defs', {});
    const marker = svg('marker', { id: 'complexArrow', markerWidth: 12, markerHeight: 12, refX: 10, refY: 6, orient: 'auto', markerUnits: 'strokeWidth' });
    marker.appendChild(svg('path', { d: 'M 0 0 L 12 6 L 0 12 z', class: 'complex-arrow' }));
    defs.appendChild(marker);
  }

  function drawScene() {
    const O = { re: 0, im: 0 };
    if (config.kind === 'point') {
      const z = state.values.z;
      drawVector('vectorOz', O, z);
      drawPoint('pointZ', z, 'z');
      drawAngle('angleZ', Math.min(2.1, core.abs(z) * 0.45 || 1), 0, core.arg(z));
      drawText(targetLabel('vectorOz', 'Oz'), (sx(z.re / 2) + sx(0)) / 2 + 8, (sy(z.im / 2) + sy(0)) / 2 - 10, 'muted', 'vectorOz');
      setReadout(['z = ' + core.complexText(z), '|z| = ' + fmt(core.abs(z)), 'arg z = ' + fmt(core.deg(core.arg(z))) + '°']);
      setStatus('z = ' + core.complexText(z) + '、' + core.polarText(z), false);
    } else if (config.kind === 'two-points') {
      const z = state.values.z;
      const w = state.values.w;
      drawLinePath('segmentZw', [toPoint(z), toPoint(w)], 'complex-segment');
      drawVector('diffVector', w, z, target('diffVector').color, true);
      drawPoint('pointZ', z, 'z');
      drawPoint('pointW', w, 'w', 16, 26);
      drawText(targetLabel('segmentZw', 'zw'), (sx(z.re) + sx(w.re)) / 2 + 10, (sy(z.im) + sy(w.im)) / 2 - 12, 'muted', 'segmentZw');
      const diff = core.sub(z, w);
      setReadout(['z = ' + core.complexText(z), 'w = ' + core.complexText(w), 'z - w = ' + core.complexText(diff)]);
      setStatus('線分 zw と差ベクトル z - w = ' + core.complexText(diff) + ' を表示しています。', false);
    } else if (config.kind === 'conjugate') {
      const z = state.values.z;
      const c = core.conjugate(z);
      drawCircle('modCircle', O, core.abs(z), target('modCircle').color);
      drawLinePath('symmetry', [toPoint(z), toPoint(c)], 'complex-helper', target('symmetry').color, true);
      drawVector('vectorOz', O, z);
      drawVector('vectorConj', O, c, target('vectorConj').color);
      drawPoint('pointZ', z, 'z');
      drawPoint('pointConj', c, 'conj(z)', 16, 26);
      setReadout(['z = ' + core.complexText(z), 'conj(z) = ' + core.complexText(c), '|z| = ' + fmt(core.abs(z))]);
      setStatus('conj(z) は実軸に関する z の対称点です。', false);
    } else if (config.kind === 'addition') {
      const z = state.values.z;
      const w = state.values.w;
      const sum = core.add(z, w);
      const polygon = svgAppend('polygon', { points: [toPoint(O), toPoint(z), toPoint(sum), toPoint(w)].map(function (p) { return p.x + ',' + p.y; }).join(' '), class: 'complex-fill', fill: 'rgba(42,91,215,.10)' });
      addClick(polygon, 'parallelogram');
      drawVector('vectorZ', O, z);
      drawVector('vectorW', O, w, target('vectorW').color);
      drawVector('vectorSum', O, sum, target('vectorSum').color);
      drawLinePath('parallelogram', [toPoint(z), toPoint(sum), toPoint(w)], 'complex-helper', target('parallelogram').color, true);
      drawPoint('pointZ', z, 'z');
      drawPoint('pointW', w, 'w', 16, 26);
      drawPoint('pointSum', sum, 'z+w');
      setReadout(['z = ' + core.complexText(z), 'w = ' + core.complexText(w), 'z + w = ' + core.complexText(sum)]);
      setStatus('平行四辺形の対角線として z + w を表示しています。', false);
    } else if (config.kind === 'multiplication') {
      const z = state.values.z;
      const w = state.values.w;
      const product = core.mul(z, w);
      drawCircle('modZCircle', O, core.abs(z), target('modZCircle').color);
      drawVector('vectorZ', O, z);
      drawVector('vectorW', O, w, target('vectorW').color);
      drawVector('vectorProduct', O, product, target('vectorProduct').color);
      drawAngle('angleZ', 1.6, 0, core.arg(z));
      drawAngle('angleW', 2.15, core.arg(z), core.arg(z) + core.arg(w));
      drawPoint('pointZ', z, 'z');
      drawPoint('pointW', w, 'w', 16, 26);
      drawPoint('pointProduct', product, 'zw');
      setReadout(['zw = ' + core.complexText(product), '|zw| = ' + fmt(core.abs(product)), 'arg zw = ' + fmt(core.deg(core.arg(product))) + '°']);
      setStatus('|zw| = |z||w| = ' + fmt(core.abs(z)) + '×' + fmt(core.abs(w)) + '、arg(zw) = arg z + arg w を表示しています。', false);
    } else if (config.kind === 'polar-form') {
      const r = state.values.r;
      const theta = state.values.theta * Math.PI / 180;
      const z = core.fromPolar(r, theta);
      drawCircle('modCircle', O, Math.abs(r), target('modCircle').color);
      drawVector('vectorZ', O, z);
      drawAngle('angleZ', Math.min(2.2, Math.abs(r) * 0.45 || 1), 0, theta);
      drawPoint('pointZ', z, 'z');
      setReadout(['z = ' + core.complexText(z), 'r = ' + fmt(r), 'θ = ' + fmt(state.values.theta) + '°']);
      setStatus('z = r(cosθ + i sinθ) を点として表示しています。', false);
    } else if (config.kind === 'modulus-argument') {
      const z = state.values.z;
      drawCircle('modCircle', O, core.abs(z), target('modCircle').color);
      drawVector('vectorZ', O, z);
      drawAngle('angleZ', Math.min(2.2, core.abs(z) * 0.45 || 1), 0, core.arg(z));
      drawPoint('pointZ', z, 'z');
      setReadout(['z = ' + core.complexText(z), '|z| = ' + fmt(core.abs(z)), 'arg z = ' + fmt(core.deg(core.arg(z))) + '°']);
      setStatus('絶対値は原点からの距離、偏角は実軸からの角度です。', false);
    } else if (config.kind === 'de-moivre') {
      const z = state.values.z;
      const n = Math.round(state.values.n);
      if (n < 1 || Math.abs(state.values.n - n) > 1e-10) throw new Error('指数 n は正の整数で入力してください。');
      const zn = core.powInt(z, n);
      drawCircle('modCircle', O, core.abs(z), target('modCircle').color);
      drawVector('vectorZ', O, z);
      drawVector('vectorZn', O, zn, target('vectorZn').color);
      drawAngle('angleZ', 1.5, 0, core.arg(z));
      drawAngle('angleZn', 2.1, 0, core.arg(zn));
      drawPoint('pointZ', z, 'z');
      drawPoint('pointZn', zn, 'z^' + n);
      setReadout(['z^' + n + ' = ' + core.complexText(zn), '|z|^' + n + ' = ' + fmt(Math.pow(core.abs(z), n)), 'arg z^' + n + ' = ' + fmt(core.deg(core.arg(z)) * n) + '°']);
      setStatus('z^n では絶対値が n 乗され、偏角が n 倍されます。', false);
    } else if (config.kind === 'roots') {
      const z = state.values.z;
      const n = Math.round(state.values.n);
      if (n < 1 || Math.abs(state.values.n - n) > 1e-10) throw new Error('次数 n は正の整数で入力してください。');
      const roots = rootsOf(z, n);
      drawCircle('rootCircle', O, roots.length ? core.abs(roots[0]) : 0, target('rootCircle').color);
      drawVector('vectorZ', O, z, target('vectorZ').color, true);
      drawPoint('pointZ', z, 'w');
      roots.forEach(function (root, index) {
        drawVector('root' + index, O, root, target('root').color);
        drawPoint('root' + index, root, 'z' + index);
      });
      setReadout(['w = ' + core.complexText(z), 'n = ' + n, '根は円周上に等間隔に並びます。']);
      setStatus('z^n = w の n 個の解を表示しています。', false);
    } else if (config.kind === 'inverse') {
      const z = state.values.z;
      const inv = core.inverse(z);
      if (!Number.isFinite(inv.re)) throw new Error('z = 0 では 1/z は定義できません。');
      drawCircle('unitCircle', O, 1, target('unitCircle').color);
      drawVector('vectorZ', O, z);
      drawVector('vectorInv', O, inv, target('vectorInv').color);
      drawPoint('pointZ', z, 'z');
      drawPoint('pointInv', inv, '1/z');
      setReadout(['z = ' + core.complexText(z), '1/z = ' + core.complexText(inv), '|1/z| = ' + fmt(core.abs(inv))]);
      setStatus('1/z は絶対値の逆数と偏角の符号反転として表示できます。', false);
    } else if (config.kind === 'division') {
      const z = state.values.z;
      const w = state.values.w;
      const q = core.div(z, w);
      if (!Number.isFinite(q.re)) throw new Error('w = 0 では z/w は定義できません。');
      drawVector('vectorZ', O, z);
      drawVector('vectorW', O, w, target('vectorW').color);
      drawVector('vectorQuotient', O, q, target('vectorQuotient').color);
      drawPoint('pointZ', z, 'z');
      drawPoint('pointW', w, 'w', 16, 26);
      drawPoint('pointQuotient', q, 'z/w');
      setReadout(['z/w = ' + core.complexText(q), '|z/w| = ' + fmt(core.abs(z) / core.abs(w)), 'arg(z/w) = arg z - arg w']);
      setStatus('割り算は倍率の比と偏角の差として表示できます。', false);
    } else if (config.kind === 'euler') {
      const thetaDeg = state.values.theta;
      const theta = thetaDeg * Math.PI / 180;
      const z = core.fromPolar(1, theta);
      drawCircle('unitCircle', O, 1, target('unitCircle').color);
      drawVector('vectorZ', O, z);
      drawAngle('angleTheta', 0.7, 0, theta);
      drawPoint('pointZ', z, 'e^{iθ}');
      setReadout(['e^{iθ} = ' + core.complexText(z), 'cosθ = ' + fmt(z.re), 'sinθ = ' + fmt(z.im)]);
      setStatus('e^{iθ} = cosθ + i sinθ を単位円上の点として表示しています。', false);
    } else if (config.kind === 'circle-locus') {
      const c = state.values.c;
      const r = state.values.r;
      if (r <= 0) throw new Error('半径 r は0より大きい数値で入力してください。');
      drawCircle('circle', c, r, target('circle').color);
      drawPoint('center', c, 'a');
      setReadout(['|z - a| = ' + fmt(r), 'a = ' + core.complexText(c)]);
      setStatus('中心 a、半径 r の円 |z - a| = r を表示しています。', false);
    } else if (config.kind === 'line-locus') {
      const alpha = state.values.alpha;
      const c = state.values.c;
      drawInfiniteLine('line', alpha, c, target('line').color);
      setReadout(['Re(αz) = c', 'α = ' + core.complexText(alpha), 'c = ' + fmt(c)]);
      setStatus('Re(αz) = c で表される直線を表示しています。', false);
    } else if (config.kind === 'apollonius') {
      const a = state.values.a;
      const b = state.values.b;
      const k = state.values.k;
      if (k <= 0) throw new Error('比 k は0より大きい数値で入力してください。');
      if (Math.abs(k - 1) < 1e-10) {
        drawInfiniteLine('circle', core.sub(b, a), (core.abs(b) * core.abs(b) - core.abs(a) * core.abs(a)) / 2, target('circle').color);
      } else {
        const kk = k * k;
        const center = core.scale(core.sub(a, core.scale(b, kk)), 1 / (1 - kk));
        const radius = k * core.abs(core.sub(a, b)) / Math.abs(1 - kk);
        drawCircle('circle', center, radius, target('circle').color);
      }
      drawPoint('pointA', a, 'a');
      drawPoint('pointB', b, 'b', 16, 26);
      setReadout(['|z-a| / |z-b| = ' + fmt(k), 'a = ' + core.complexText(a), 'b = ' + core.complexText(b)]);
      setStatus('2点からの距離比が一定になる軌跡を表示しています。', false);
    } else if (config.kind === 'perpendicular-bisector') {
      const a = state.values.a;
      const b = state.values.b;
      drawLinePath('segmentAB', [toPoint(a), toPoint(b)], 'complex-helper', target('segmentAB').color, true);
      drawInfiniteLine('bisector', core.sub(b, a), (core.abs(b) * core.abs(b) - core.abs(a) * core.abs(a)) / 2, target('bisector').color);
      drawPoint('pointA', a, 'a');
      drawPoint('pointB', b, 'b', 16, 26);
      setReadout(['|z-a| = |z-b|', 'a = ' + core.complexText(a), 'b = ' + core.complexText(b)]);
      setStatus('2点 a, b から等距離にある点の軌跡、垂直二等分線を表示しています。', false);
    } else if (config.kind === 'affine-transform') {
      const a = state.values.a;
      const b = state.values.b;
      const z = state.values.z;
      const w = core.add(core.mul(a, z), b);
      drawTransformGrid(function (p) { return core.add(core.mul(a, p), b); }, 'gridImage', target('gridImage').color);
      drawVector('vectorZ', O, z);
      drawVector('vectorW', O, w, target('vectorW').color);
      drawPoint('pointZ', z, 'z');
      drawPoint('pointW', w, 'az+b');
      setReadout(['w = az + b = ' + core.complexText(w), 'a = ' + core.complexText(a), 'b = ' + core.complexText(b)]);
      setStatus('w = az + b による回転・拡大縮小・平行移動を表示しています。', false);
    } else if (config.kind === 'inversion-transform') {
      const z = state.values.z;
      const w = core.inverse(z);
      if (!Number.isFinite(w.re)) throw new Error('z = 0 では 1/z は定義できません。');
      drawCircle('unitCircle', O, 1, target('unitCircle').color);
      drawTransformGrid(core.inverse, 'gridImage', target('gridImage').color);
      drawVector('vectorZ', O, z);
      drawVector('vectorW', O, w, target('vectorW').color);
      drawPoint('pointZ', z, 'z');
      drawPoint('pointW', w, '1/z');
      setReadout(['w = 1/z = ' + core.complexText(w)]);
      setStatus('反転 w = 1/z による格子の移り方を表示しています。', false);
    } else if (config.kind === 'mobius-transform') {
      const a = state.values.a;
      const b = state.values.b;
      const c = state.values.c;
      const d = state.values.d;
      const z = state.values.z;
      function mobius(p) { return core.div(core.add(core.mul(a, p), b), core.add(core.mul(c, p), d)); }
      const w = mobius(z);
      if (!Number.isFinite(w.re)) throw new Error('cz + d = 0 では定義できません。');
      drawTransformGrid(mobius, 'gridImage', target('gridImage').color);
      drawVector('vectorZ', O, z);
      drawVector('vectorW', O, w, target('vectorW').color);
      drawPoint('pointZ', z, 'z');
      drawPoint('pointW', w, 'w');
      setReadout(['w = (az+b)/(cz+d)', 'w = ' + core.complexText(w)]);
      setStatus('一次分数変換による格子の移り方を表示しています。', false);
    } else if (config.kind === 'joukowski') {
      const z = state.values.z;
      const a = state.values.a;
      function joukowski(p) {
        return core.add(p, core.scale(core.inverse(p), a * a));
      }
      const w = joukowski(z);
      if (!Number.isFinite(w.re)) throw new Error('z = 0 ではジューコフスキー変換は定義できません。');
      drawCircle('unitCircle', O, Math.abs(a), target('unitCircle').color);
      drawTransformGrid(joukowski, 'gridImage', target('gridImage').color);
      drawVector('vectorZ', O, z);
      drawVector('vectorW', O, w, target('vectorW').color);
      drawPoint('pointZ', z, 'z');
      drawPoint('pointW', w, 'w');
      setReadout(['w = z + a²/z', 'w = ' + core.complexText(w)]);
      setStatus('ジューコフスキー変換 w = z + a²/z を表示しています。', false);
    }
  }

  function setReadout(items) {
    clear(readout);
    items.forEach(function (text) {
      const node = document.createElement('div');
      node.className = 'complex-readout-item';
      node.textContent = text;
      readout.appendChild(node);
    });
  }

  function render() {
    try {
      currentLabelBases = {};
      readValues();
      applyViewRange();
      clear(stage);
      drawDefs();
      drawGrid();
      drawScene();
    } catch (error) {
      setStatus(error.message || '入力を確認してください。', true);
    }
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

  function buildColorPicker(value) {
    const field = document.createElement('div');
    field.className = 'sheet-field';
    const label = document.createElement('label');
    label.textContent = '色';
    const wrap = document.createElement('div');
    wrap.className = 'color-swatch-picker';
    let current = value;
    palette.forEach(function (color) {
      const swatch = button('', 'color-swatch' + (color === value ? ' is-selected' : ''));
      swatch.style.background = color;
      swatch.dataset.color = color;
      swatch.addEventListener('click', function () {
        current = color;
        Array.from(wrap.children).forEach(function (child) { child.classList.remove('is-selected'); });
        swatch.classList.add('is-selected');
      });
      wrap.appendChild(swatch);
    });
    field.appendChild(label);
    field.appendChild(wrap);
    return { field: field, value: function () { return current; } };
  }

  function openTargetSheet(key) {
    const item = target(key);
    openSheet(item.title || key);
    const labelMode = buildSelect('ラベル表示', item.labelMode, [
      { value: 'auto', label: '標準' },
      { value: 'custom', label: '自由入力' },
      { value: 'hidden', label: '非表示' }
    ]);
    const textInput = buildTextInput('自由入力', item.customLabel || '');
    const colorPicker = buildColorPicker(item.color);
    sheetBody.appendChild(labelMode.field);
    sheetBody.appendChild(textInput.field);
    sheetBody.appendChild(colorPicker.field);

    const hint = document.createElement('p');
    hint.className = 'sheet-hint';
    hint.textContent = '点・ベクトル・線分・角・円は、ラベル表示、自由入力、色、ラベル位置を変更できます。';
    sheetBody.appendChild(hint);

    const actions = document.createElement('div');
    actions.className = 'sheet-actions has-move';
    const cancel = button('キャンセル', 'btn');
    const move = button('移動', 'btn action-secondary');
    const save = button('保存', 'btn action-primary');
    cancel.addEventListener('click', closeSheets);
    move.addEventListener('click', function () {
      item.labelMode = labelMode.select.value;
      item.customLabel = textInput.input.value;
      item.color = colorPicker.value();
      startMoveMode(key);
    });
    save.addEventListener('click', function () {
      item.labelMode = labelMode.select.value;
      item.customLabel = textInput.input.value;
      item.color = colorPicker.value();
      closeSheets();
      render();
    });
    actions.appendChild(cancel);
    actions.appendChild(move);
    actions.appendChild(save);
    sheetBody.appendChild(actions);
  }

  function openSettingsSheet() {
    openSheet('設定');
    const centerRe = buildTextInput('中心の実部', fmt(state.viewCenterRe));
    const centerIm = buildTextInput('中心の虚部', fmt(state.viewCenterIm));
    const width = buildTextInput('横幅', fmt(state.viewWidth));
    const height = buildTextInput('縦幅', fmt(state.viewHeight));
    const tick = buildSelect('座標数字', String(state.tickLabelInterval), [
      { value: '1', label: '1刻み' },
      { value: '2', label: '2刻み' },
      { value: '5', label: '5刻み' },
      { value: '0', label: '非表示' }
    ]);
    sheetBody.appendChild(centerRe.field);
    sheetBody.appendChild(centerIm.field);
    sheetBody.appendChild(width.field);
    sheetBody.appendChild(height.field);
    sheetBody.appendChild(tick.field);
    const actions = document.createElement('div');
    actions.className = 'sheet-actions';
    const cancel = button('キャンセル', 'btn');
    const save = button('保存', 'btn action-primary');
    cancel.addEventListener('click', closeSheets);
    save.addEventListener('click', function () {
      try {
        state.viewCenterRe = parseNumberText(centerRe.input.value, '中心の実部');
        state.viewCenterIm = parseNumberText(centerIm.input.value, '中心の虚部');
        state.viewWidth = parseNumberText(width.input.value, '横幅');
        state.viewHeight = parseNumberText(height.input.value, '縦幅');
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

  function startMoveMode(key) {
    closeSheets();
    moveMode = { key: key };
    updateMoveUi();
    render();
  }

  function finishMoveMode(cancel) {
    if (cancel && moveMode) state.labelOffsets[moveMode.key] = { x: 0, y: 0 };
    moveMode = null;
    moveDrag = null;
    updateMoveUi();
    render();
  }

  function updateMoveUi() {
    const active = Boolean(moveMode);
    document.body.classList.toggle('label-move-active', active);
    captureRoot.classList.toggle('label-move-active', active);
    moveToolbar.classList.toggle('open', active);
    moveToolbar.setAttribute('aria-hidden', active ? 'false' : 'true');
  }

  function pointerToSvgPoint(event) {
    const matrix = stage.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const svgPoint = stage.createSVGPoint();
    svgPoint.x = event.clientX;
    svgPoint.y = event.clientY;
    const transformed = svgPoint.matrixTransform(matrix.inverse());
    return { x: transformed.x, y: transformed.y };
  }

  function openSaveSheet() {
    if (moveMode) return;
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
      link.download = transparent ? config.slug + '-transparent.png' : config.slug + '.png';
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
      pdf.save(config.slug + '.pdf');
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

  function bind() {
    document.getElementById('backBtn').addEventListener('click', function () {
      window.location.href = '../../';
    });
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
    moveCancelBtn.addEventListener('click', function () { finishMoveMode(true); });
    moveDoneBtn.addEventListener('click', function () { finishMoveMode(false); });
    window.addEventListener('pointermove', function (event) {
      if (!moveDrag) return;
      event.preventDefault();
      const p = pointerToSvgPoint(event);
      const offset = labelOffset(moveDrag.key);
      offset.x = moveDrag.startOffset.x + (p.x - moveDrag.startPoint.x);
      offset.y = moveDrag.startOffset.y + (p.y - moveDrag.startPoint.y);
      render();
    }, { passive: false });
    window.addEventListener('pointerup', function () { moveDrag = null; });
    window.addEventListener('pointercancel', function () { moveDrag = null; });
  }

  initValues();
  initTargets();
  buildInputs();
  bind();
  render();
})();
