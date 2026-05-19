(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const stage = document.getElementById('stage');
  const axisA = document.getElementById('axisA');
  const axisB = document.getElementById('axisB');
  const statusBox = document.getElementById('statusBox');
  const sheetBackdrop = document.getElementById('sheetBackdrop');
  const editSheet = document.getElementById('editSheet');
  const saveSheet = document.getElementById('saveSheet');
  const sheetTitle = document.getElementById('sheetTitle');
  const sheetBody = document.getElementById('sheetBody');
  const captureRoot = document.getElementById('captureRoot');

  if (!stage || !axisA || !axisB) return;

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
    pointInputs: { O: '', P: '', Q: '' },
    sideInputs: { f: ' ' },
    sideKinds: { f: 'plain' },
    sideArcVisible: { f: false },
    angleInputs: { theta: '' },
    angleKinds: { theta: 'hidden' },
    areaValue: '',
    areaColor: '#2a5bd7',
    tickLabelInterval: 1,
    xTickLabelMode: 'pi',
    viewCenterX: 0,
    viewCenterY: 0,
    viewWidth: 20,
    viewHeight: 20,
    labelOffsets: {}
  };

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

  let moveMode = null;
  let moveDrag = null;
  let currentLabelBases = {};

  const RATIO_LABEL_PREFIX = 'ratio:';
  const RATIO_LABEL_HINT = '比の値は「マーク,数値」の形式で入力します。例: s,5 / t,4.4 / r,5/3\ns: 四角で囲む\nt: 三角で囲む\nr: 丸で囲む';

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

  function parseAxisA() {
    const text = String(axisA.value || '').trim();
    if (!/^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$/.test(text)) {
      throw new Error('m は数値で入力してください。');
    }
    const value = Number(text);
    if (Math.abs(value) < 1e-10) throw new Error('m は0以外の数値で入力してください。');
    return value;
  }

  function parseAxisB() {
    const text = String(axisB.value || '').trim();
    if (!/^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$/.test(text)) {
      throw new Error('n は数値で入力してください。');
    }
    const value = Number(text);
    if (Math.abs(value) < 1e-10) throw new Error('n は0以外の数値で入力してください。');
    return value;
  }

  function formatNumber(value) {
    if (!Number.isFinite(value)) return '';
    if (Math.abs(value) < 1e-10) return '0';
    const rounded = Math.round(value * 1000) / 1000;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, '').replace(/\.$/, '');
  }

  function angleText(value) {
    if (Math.abs(value - 1) < 1e-10) return 'x';
    if (Math.abs(value + 1) < 1e-10) return '-x';
    return formatNumber(value) + 'x';
  }

  function formula(m, n) {
    return 'y = sin(' + angleText(m) + ')cos(' + angleText(n) + ')';
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
    if (hasNumericMode && (value === ' ' || value === '0')) return 'numeric';
    return 'text';
  }

  function labelFromValue(value, numericText) {
    if (value === '') return '';
    if (value === ' ' || value === '0') return numericText || '';
    if (isRatioLabelValue(value)) return String(value);
    return String(value || '');
  }

  function setStatus(message, isError) {
    statusBox.textContent = message;
    statusBox.classList.toggle('error', Boolean(isError));
  }

  function hexToRgba(hex, alpha) {
    const match = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!match) return 'rgba(42,91,215,' + alpha + ')';
    const raw = match[1];
    return 'rgba(' + parseInt(raw.slice(0, 2), 16) + ',' + parseInt(raw.slice(2, 4), 16) + ',' + parseInt(raw.slice(4, 6), 16) + ',' + alpha + ')';
  }

  function parseAxisASafe() {
    try {
      return parseAxisA();
    } catch (error) {
      return 1;
    }
  }

  function parseAxisBSafe() {
    try {
      return parseAxisB();
    } catch (error) {
      return 2;
    }
  }

  function visibleAreaValue(a, p1, p2) {
    const x1 = p1.ux;
    const x2 = p2.ux;
    return Math.abs(a * (x2 * x2 - x1 * x1) / 2);
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

  function labelKey(kind, id) {
    return kind + ':' + id;
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
    return moveMode && moveMode.kind === kind && moveMode.id === id;
  }

  function updateMoveModeUi() {
    const active = Boolean(moveMode);
    document.body.classList.toggle('label-move-active', active);
    if (captureRoot) captureRoot.classList.toggle('label-move-active', active);
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

  function pathFromPoints(points) {
    if (!points.length) return '';
    return points.map(function (p, index) {
      return (index === 0 ? 'M ' : 'L ') + p.x + ' ' + p.y;
    }).join(' ');
  }

  function quadraticPoint(p, control, q, t) {
    return {
      x: (1 - t) * (1 - t) * p.x + 2 * (1 - t) * t * control.x + t * t * q.x,
      y: (1 - t) * (1 - t) * p.y + 2 * (1 - t) * t * control.y + t * t * q.y
    };
  }

  function sideArcGeometry(p, q, center, labelPoint) {
    const mx = (p.x + q.x) / 2;
    const my = (p.y + q.y) / 2;
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    const toCenterX = center.x - mx;
    const toCenterY = center.y - my;
    if (nx * toCenterX + ny * toCenterY > 0) {
      nx *= -1;
      ny *= -1;
    }
    const arcHeight = Math.max(26, len * 0.13);
    const fallback = { x: mx + nx * arcHeight, y: my + ny * arcHeight };
    const desired = labelPoint || fallback;
    return {
      control: { x: desired.x * 2 - mx, y: desired.y * 2 - my },
      gapHalf: 0.14
    };
  }

  function quadraticPathSegment(p, control, q, start, end, steps) {
    const points = [];
    const count = steps || 24;
    for (let i = 0; i <= count; i += 1) {
      const t = start + (end - start) * (i / count);
      points.push(quadraticPoint(p, control, q, t));
    }
    return pathFromPoints(points);
  }

  function drawSegmentKind(kind, p1, p2) {
    if (!kind || kind === 'plain' || kind === 'dashed') return;
    if (window.InstantGeometryMobileAngleOrnaments && window.InstantGeometryMobileAngleOrnaments.drawSegmentKind(stage, kind, p1, p2, svg, { color: '#2a5bd7' })) return;
    const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy) || 1;
    const tx = dx / len;
    const ty = dy / len;
    const nx = -ty;
    const ny = tx;
    function markLine(cx, cy, half) {
      stage.appendChild(svg('line', {
        x1: cx - nx * half,
        y1: cy - ny * half,
        x2: cx + nx * half,
        y2: cy + ny * half,
        class: 'function-segment-mark'
      }));
    }
    if (kind === 'circle') {
      stage.appendChild(svg('circle', { cx: mid.x, cy: mid.y, r: 10, class: 'function-segment-mark' }));
    } else if (kind === 'single') {
      markLine(mid.x, mid.y, 14);
    } else if (kind === 'double') {
      markLine(mid.x - tx * 10, mid.y - ty * 10, 14);
      markLine(mid.x + tx * 10, mid.y + ty * 10, 14);
    } else if (kind === 'cross') {
      markLine(mid.x, mid.y, 14);
      stage.appendChild(svg('line', {
        x1: mid.x - tx * 12,
        y1: mid.y - ty * 12,
        x2: mid.x + tx * 12,
        y2: mid.y + ty * 12,
        class: 'function-segment-mark'
      }));
    }
  }

  function createTextLabel(text, attrs) {
    const parsed = isRatioLabelValue(text) ? parseRatioLabelInput(String(text).slice(RATIO_LABEL_PREFIX.length)) : null;
    if (!parsed) {
      const textNode = svg('text', attrs);
      textNode.textContent = text;
      return textNode;
    }
    const x = Number(attrs.x) || 0;
    const y = Number(attrs.y) || 0;
    const fontSize = 26;
    const textWidth = Math.max(fontSize * 0.7, parsed.value.length * fontSize * 0.62);
    const height = fontSize * 1.16;
    const width = parsed.mark === 't'
      ? Math.max(textWidth + fontSize * 0.8, height * 1.25)
      : Math.max(textWidth + fontSize * 0.55, height);
    const group = svg('g', { class: attrs.class });
    if (parsed.mark === 'r') {
      group.appendChild(svg('ellipse', { cx: x, cy: y, rx: width / 2, ry: height / 2, fill: '#ffffff', stroke: '#1f2430', 'stroke-width': 2 }));
    } else if (parsed.mark === 't') {
      group.appendChild(svg('polygon', {
        points: [x + ',' + (y - height * 0.72), (x - width / 2) + ',' + (y + height * 0.48), (x + width / 2) + ',' + (y + height * 0.48)].join(' '),
        fill: '#ffffff',
        stroke: '#1f2430',
        'stroke-width': 2,
        'stroke-linejoin': 'round'
      }));
    } else {
      group.appendChild(svg('rect', { x: x - width / 2, y: y - height / 2, width: width, height: height, fill: '#ffffff', stroke: '#1f2430', 'stroke-width': 2 }));
    }
    const textNode = svg('text', Object.assign({}, attrs, { 'text-anchor': 'middle', 'dominant-baseline': 'middle' }));
    textNode.textContent = parsed.value;
    group.appendChild(textNode);
    return group;
  }

  function attachLabelHit(element, kind, id) {
    element.setAttribute('data-label-target', 'true');
    if (isMoveTarget(kind, id)) element.classList.add('label-move-target');
    element.addEventListener('pointerdown', function (event) {
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
  }

  function drawText(text, x, y, className, onClick, target) {
    const pos = target ? getLabelPosition(target.kind, target.id, { x: x, y: y }) : { x: x, y: y };
    const node = createTextLabel(text, { x: pos.x, y: pos.y, class: 'function-label ' + (className || '') });
    if (onClick) {
      node.addEventListener('click', function (event) {
        event.stopPropagation();
        if (moveMode) return;
        onClick();
      });
    }
    if (target) attachLabelHit(node, target.kind, target.id);
    stage.appendChild(node);
    return node;
  }

  function drawSideLabelArc(p, q, centerPoint, labelPoint) {
    const geom = sideArcGeometry(p, q, centerPoint, labelPoint);
    stage.appendChild(svg('path', {
      d: quadraticPathSegment(p, geom.control, q, 0, 0.5 - geom.gapHalf, 20),
      fill: 'none',
      stroke: '#2a5bd7',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-dasharray': '6 5'
    }));
    stage.appendChild(svg('path', {
      d: quadraticPathSegment(p, geom.control, q, 0.5 + geom.gapHalf, 1, 20),
      fill: 'none',
      stroke: '#2a5bd7',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-dasharray': '6 5'
    }));
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
    const group = svg('g', {});
    const tickLabelInterval = Number(state.tickLabelInterval) || 0;
    for (let x = plot.xMin; x <= plot.xMax; x += 1) {
      const px = sx(x);
      group.appendChild(svg('line', {
        x1: px, y1: plot.top, x2: px, y2: plot.bottom,
        class: x === 0 || x % 5 === 0 ? 'function-grid-major' : 'function-grid-minor'
      }));
      if (tickLabelInterval > 0 && x !== 0 && x % tickLabelInterval === 0) {
        const label = svg('text', { x: px - 12, y: sy(0) + 28, class: 'function-tick-label' });
        label.textContent = String(x);
        group.appendChild(label);
      }
    }
    for (let y = plot.yMin; y <= plot.yMax; y += 1) {
      const py = sy(y);
      group.appendChild(svg('line', {
        x1: plot.left, y1: py, x2: plot.right, y2: py,
        class: y === 0 || y % 5 === 0 ? 'function-grid-major' : 'function-grid-minor'
      }));
      if (tickLabelInterval > 0 && y !== 0 && y % tickLabelInterval === 0) {
        const label = svg('text', { x: sx(0) + 15, y: py + 7, class: 'function-tick-label' });
        label.textContent = String(y);
        group.appendChild(label);
      }
    }
    group.appendChild(svg('line', { x1: plot.left, y1: sy(0), x2: plot.right, y2: sy(0), class: 'function-axis' }));
    group.appendChild(svg('line', { x1: sx(0), y1: plot.top, x2: sx(0), y2: plot.bottom, class: 'function-axis' }));
    stage.appendChild(group);
    drawText('x', plot.right + 14, sy(0) + 8, 'muted');
    drawText('y', sx(0) + 12, plot.top - 14, 'muted');
  }

  function visibleLineEndpoints(a) {
    if (Math.abs(a) < 1e-10) return [point(plot.xMin, 0), point(plot.xMax, 0)];

    const candidates = [
      { x: plot.xMin, y: a * plot.xMin },
      { x: plot.xMax, y: a * plot.xMax },
      { y: plot.yMin, x: plot.yMin / a },
      { y: plot.yMax, x: plot.yMax / a }
    ].filter(function (p) {
      return p.x >= plot.xMin - 1e-9 && p.x <= plot.xMax + 1e-9 && p.y >= plot.yMin - 1e-9 && p.y <= plot.yMax + 1e-9;
    });

    const unique = [];
    candidates.forEach(function (p) {
      if (!unique.some(function (q) { return Math.abs(q.x - p.x) < 1e-7 && Math.abs(q.y - p.y) < 1e-7; })) {
        unique.push(p);
      }
    });
    if (unique.length < 2) return [point(plot.xMin, a * plot.xMin), point(plot.xMax, a * plot.xMax)];
    return [point(unique[0].x, unique[0].y), point(unique[1].x, unique[1].y)];
  }

  function visibleSinePoints(m, n) {
    const points = [];
    const steps = 720;
    for (let i = 0; i <= steps; i += 1) {
      const x = plot.xMin + (plot.xMax - plot.xMin) * (i / steps);
      const y = Math.sin(m * x) * Math.cos(n * x);
      points.push(point(x, y));
    }
    return points;
  }

  function pathFromPlotPoints(points) {
    return points.map(function (p, index) {
      return (index === 0 ? 'M ' : 'L ') + p.x + ' ' + p.y;
    }).join(' ');
  }

  function drawArea(a, p1, p2) {
    if (state.areaValue === '') return;
    const zeroY = sy(0);
    const polygon = svg('polygon', {
      points: [
        formatNumber(p1.x) + ',' + formatNumber(zeroY),
        formatNumber(p1.x) + ',' + formatNumber(p1.y),
        formatNumber(p2.x) + ',' + formatNumber(p2.y),
        formatNumber(p2.x) + ',' + formatNumber(zeroY)
      ].join(' '),
      class: 'function-area'
    });
    polygon.style.fill = hexToRgba(state.areaColor || '#2a5bd7', 0.12);
    polygon.style.stroke = hexToRgba(state.areaColor || '#2a5bd7', 0.35);
    polygon.addEventListener('click', function () {
      if (!moveMode) openAreaSheet();
    });
    stage.appendChild(polygon);
    if (Math.abs(a) > 1e-10) {
      const label = labelFromValue(state.areaValue, formatNumber(visibleAreaValue(a, p1, p2)));
      if (label) drawText(label, (p1.x + p2.x) / 2 - 12, (p1.y + p2.y + zeroY + zeroY) / 4, 'muted', openAreaSheet, { kind: 'area', id: 'main' });
    }
  }

  function drawLineGraph(p1, p2) {
    const kind = state.sideKinds.f || 'plain';
    const klass = 'function-line' + (kind === 'dashed' ? ' is-dashed' : '');
    const line = svg('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, class: klass });
    stage.appendChild(line);
    drawSegmentKind(kind, p1, p2);
    const hit = svg('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, class: 'function-line-hit' });
    hit.addEventListener('click', function () {
      if (!moveMode) openLineSheet();
    });
    stage.appendChild(hit);
    const label = labelFromValue(state.sideInputs.f, formula(parseAxisASafe(), parseAxisBSafe()));
    if (label) {
      const base = { x: p2.x - 46, y: p2.y + (p2.y < 150 ? 42 : -18) };
      const pos = getLabelPosition('side', 'f', base);
      if (state.sideArcVisible.f !== false) drawSideLabelArc(p1, p2, point(0, 0), pos);
      drawText(label, base.x, base.y, 'muted', openLineSheet, { kind: 'side', id: 'f' });
    }
  }

  function drawCurveGraph(a, b) {
    const points = visibleSinePoints(a, b);
    const d = pathFromPlotPoints(points);
    const curve = svg('path', { d: d, class: 'function-curve' });
    stage.appendChild(curve);
    const hit = svg('path', { d: d, class: 'function-curve-hit' });
    hit.addEventListener('click', function () {
      if (!moveMode) openLineSheet();
    });
    stage.appendChild(hit);
    const label = labelFromValue(state.sideInputs.f, formula(parseAxisASafe(), parseAxisBSafe()));
    if (label) {
      const anchor = points[Math.min(points.length - 1, Math.max(0, Math.floor(points.length * 0.78)))];
      const base = {
        x: Math.min(plot.right - 120, Math.max(plot.left + 16, anchor.x + 18)),
        y: Math.min(plot.bottom - 22, Math.max(plot.top + 34, anchor.y - 20))
      };
      drawText(label, base.x, base.y, 'muted', openLineSheet, { kind: 'side', id: 'f' });
    }
  }

  function drawPoint(id, p) {
    const hidden = !state.pointInputs[id];
    const dot = svg('circle', { cx: p.x, cy: p.y, r: 7, class: 'function-point' + (hidden ? ' is-transparent' : '') });
    dot.addEventListener('click', function () { if (!moveMode) openPointSheet(id); });
    stage.appendChild(dot);
    const hit = svg('circle', { cx: p.x, cy: p.y, r: 25, class: 'function-point-hit' + (hidden ? ' is-transparent' : '') });
    hit.addEventListener('click', function () { if (!moveMode) openPointSheet(id); });
    stage.appendChild(hit);
    const label = labelFromValue(state.pointInputs[id], '');
    if (label) drawText(label, p.x + 15, p.y - 12, '', function () { openPointSheet(id); }, { kind: 'point', id: id });
  }

  function drawAngle(a) {
    if (state.angleInputs.theta === '' || state.angleKinds.theta === 'hidden' || Math.abs(a) < 1e-10) return;
    const origin = point(0, 0);
    const theta = Math.atan(a);
    const radius = 82;
    const start = { x: origin.x + radius, y: origin.y };
    const end = { x: origin.x + Math.cos(-theta) * radius, y: origin.y + Math.sin(-theta) * radius };
    const sweep = theta < 0 ? 1 : 0;
    const d = 'M ' + start.x + ' ' + start.y + ' A ' + radius + ' ' + radius + ' 0 0 ' + sweep + ' ' + end.x + ' ' + end.y;
    stage.appendChild(svg('path', { d: d, class: 'function-angle' }));
    const hit = svg('path', { d: d, class: 'function-angle-hit' });
    hit.addEventListener('click', function () {
      if (!moveMode) openAngleSheet();
    });
    stage.appendChild(hit);
    if (state.angleKinds.theta === 'right') {
      const size = 34;
      stage.appendChild(svg('path', {
        d: 'M ' + (origin.x + size) + ' ' + origin.y + ' L ' + (origin.x + size) + ' ' + (origin.y - size) + ' L ' + origin.x + ' ' + (origin.y - size),
        class: 'function-angle'
      }));
    }
    const label = labelFromValue(state.angleInputs.theta, formatNumber(Math.abs(theta * 180 / Math.PI)) + '°');
    if (label) drawText(label, origin.x + 96, origin.y - 18, 'muted', openAngleSheet, { kind: 'angle', id: 'theta' });
  }

  function render() {
    if (window.InstantGeometryFunctionViewSettings) window.InstantGeometryFunctionViewSettings.applyViewRange(state, plot);
    clear(stage);
    currentLabelBases = {};
    drawGrid();
    let a;
    let b;
    try {
      a = parseAxisA();
      b = parseAxisB();
      setStatus('パラメータ m と n を入力すると、y = sin(mx)cos(nx) を描画します。', false);
    } catch (error) {
      setStatus(error.message, true);
      a = 1;
      b = 2;
    }
    drawCurveGraph(a, b);
  }

  function openSheet(title) {
    sheetTitle.textContent = title;
    sheetBody.innerHTML = '';
    editSheet.classList.add('open');
    editSheet.setAttribute('aria-hidden', 'false');
    sheetBackdrop.classList.add('open');
  }

  function closeSheets() {
    editSheet.classList.remove('open');
    editSheet.setAttribute('aria-hidden', 'true');
    saveSheet.classList.remove('open');
    saveSheet.setAttribute('aria-hidden', 'true');
    sheetBackdrop.classList.remove('open');
  }

  function openSheetForTarget(kind, id) {
    if (kind === 'point') openPointSheet(id);
    if (kind === 'side') openLineSheet();
    if (kind === 'area') openAreaSheet();
    if (kind === 'angle') openAngleSheet();
  }

  function finishMoveMode(restoreOffset) {
    if (!moveMode) return;
    const previous = moveMode;
    if (restoreOffset) {
      if (!state.labelOffsets[previous.kind]) state.labelOffsets[previous.kind] = {};
      state.labelOffsets[previous.kind][previous.id] = previous.originalOffset;
    }
    moveMode = null;
    moveDrag = null;
    updateMoveModeUi();
    render();
    openSheetForTarget(previous.kind, previous.id);
  }

  function enterMoveMode(kind, id) {
    const key = labelKey(kind, id);
    if (!currentLabelBases[key]) {
      setStatus('ラベルを表示してから移動してください。', true);
      openSheetForTarget(kind, id);
      return;
    }
    const originalOffset = getLabelOffset(kind, id);
    moveMode = {
      kind: kind,
      id: id,
      originalOffset: { x: originalOffset.x, y: originalOffset.y }
    };
    closeSheets();
    updateMoveModeUi();
    render();
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
      if (option.value === value) node.selected = true;
      select.appendChild(node);
    });
    field.appendChild(label);
    field.appendChild(select);
    return { field: field, select: select };
  }

  function buildCheckbox(labelText, checked) {
    const field = document.createElement('div');
    field.className = 'sheet-field';
    const label = document.createElement('label');
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = Boolean(checked);
    input.style.minHeight = '20px';
    input.style.width = '20px';
    input.style.justifySelf = 'start';
    field.appendChild(label);
    field.appendChild(input);
    return { field: field, input: input };
  }

  function buildLabelEditor(labelText, value, hasNumericMode) {
    const field = document.createElement('div');
    field.className = 'sheet-field';
    const label = document.createElement('label');
    label.textContent = labelText;
    const mode = document.createElement('select');
    [
      { value: 'hidden', label: '非表示' },
      hasNumericMode ? { value: 'numeric', label: '数値' } : null,
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
    input.value = getDisplayMode(value, hasNumericMode) === 'text' ? String(value || '') : getRatioLabelInput(value);
    input.setAttribute('inputmode', 'text');
    input.autocapitalize = 'none';
    input.autocomplete = 'off';
    input.spellcheck = false;
    function sync() {
      const editable = mode.value === 'text' || mode.value === 'ratio';
      input.disabled = !editable;
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
    const field = document.createElement('div');
    field.className = 'sheet-field';
    const label = document.createElement('label');
    label.textContent = labelText;
    const picker = document.createElement('div');
    picker.className = 'color-swatch-picker';
    const colors = [
      ['白', '#ffffff'], ['赤', '#e53935'], ['青', '#2a5bd7'], ['緑', '#2e7d32'],
      ['黄', '#f2c94c'], ['紫', '#8e44ad'], ['桃', '#ff66a3'], ['茶', '#8b5a2b'], ['灰', '#8a94a6'], ['黒', '#111827']
    ];
    const result = { field: field, value: value || '#2a5bd7' };
    colors.forEach(function (entry) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'color-swatch' + (entry[1] === result.value ? ' is-selected' : '');
      button.dataset.color = entry[1];
      button.style.background = entry[1];
      button.textContent = entry[0];
      button.setAttribute('aria-label', entry[0]);
      button.addEventListener('click', function () {
        result.value = entry[1];
        picker.querySelectorAll('.color-swatch').forEach(function (node) { node.classList.remove('is-selected'); });
        button.classList.add('is-selected');
      });
      picker.appendChild(button);
    });
    field.appendChild(label);
    field.appendChild(picker);
    return result;
  }

  function applyLabelValue(kind, id, editor, kindValue, arcVisibleValue, colorValue) {
    const mode = editor.mode.value;
    const text = String(editor.input.value || '');
    function labelValue() {
      if (mode === 'hidden') return '';
      if (mode === 'numeric') return ' ';
      if (mode === 'ratio') {
        const ratio = parseRatioLabelInput(text);
        if (!ratio) throw new Error('比の値は「r,5」「t,4.4」「s,5/3」の形式で入力してください。');
        return RATIO_LABEL_PREFIX + ratio.source;
      }
      return text || '';
    }
    if (kind === 'point') {
      state.pointInputs[id] = mode === 'text' ? text : '';
      return;
    }
    if (kind === 'side') {
      if (kindValue) state.sideKinds.f = kindValue;
      if (arcVisibleValue !== null) state.sideArcVisible.f = Boolean(arcVisibleValue);
      state.sideInputs.f = labelValue();
      if (mode === 'hidden') state.sideArcVisible.f = false;
      return;
    }
    if (kind === 'angle') {
      if (kindValue) state.angleKinds.theta = kindValue;
      state.angleInputs.theta = labelValue();
      return;
    }
    if (kind === 'area') {
      if (colorValue) state.areaColor = colorValue;
      state.areaValue = labelValue();
    }
  }

  function renderCommonSheet(config) {
    openSheet(config.title);
    let kindSelect = null;
    let arcCheckbox = null;
    let colorPalette = null;
    if (config.segmentKinds) {
      const built = buildSelect('種類', config.kindValue || 'plain', [
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
      const checkbox = buildCheckbox('弧を表示', config.arcVisible !== false);
      arcCheckbox = checkbox.input;
      sheetBody.appendChild(checkbox.field);
    } else if (config.angleKinds) {
      if (window.InstantGeometryMobileAngleOrnaments && window.InstantGeometryMobileAngleOrnaments.appendAngleKindSelect) {
        kindSelect = window.InstantGeometryMobileAngleOrnaments.appendAngleKindSelect(sheetBody, buildSelect, config.kindValue || 'plain', config.angleValue);
      } else {
        const built = buildSelect('種類', config.kindValue || 'plain', [
          { value: 'plain', label: '通常' },
          { value: 'right', label: '直角' },
          { value: 'hidden', label: '非表示' }
        ]);
        kindSelect = built.select;
        sheetBody.appendChild(built.field);
      }
    }

    const editor = buildLabelEditor('ラベル', config.value, config.hasNumericMode);
    sheetBody.appendChild(editor.field);
    if (config.color) {
      colorPalette = buildColorPalette('色', state.areaColor || '#2a5bd7');
      sheetBody.appendChild(colorPalette.field);
    }
    const hintNode = document.createElement('p');
    hintNode.className = 'sheet-hint';
    hintNode.textContent = config.hint;
    sheetBody.appendChild(hintNode);
    const actions = document.createElement('div');
    actions.className = 'sheet-actions has-move';
    const cancel = document.createElement('button');
    cancel.className = 'btn';
    cancel.type = 'button';
    cancel.textContent = 'キャンセル';
    cancel.addEventListener('click', closeSheets);
    const move = document.createElement('button');
    move.className = 'btn action-secondary';
    move.type = 'button';
    move.textContent = '移動';
    move.addEventListener('click', function () {
      try {
        applyLabelValue(
          config.kind,
          config.id,
          editor,
          kindSelect ? kindSelect.value : null,
          arcCheckbox ? arcCheckbox.checked : null,
          colorPalette ? colorPalette.value : null
        );
        render();
        enterMoveMode(config.kind, config.id);
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
        applyLabelValue(
          config.kind,
          config.id,
          editor,
          kindSelect ? kindSelect.value : null,
          arcCheckbox ? arcCheckbox.checked : null,
          colorPalette ? colorPalette.value : null
        );
        closeSheets();
        render();
      } catch (error) {
        setStatus(error.message || '入力を確認してください。', true);
      }
    });
    actions.appendChild(cancel);
    actions.appendChild(move);
    actions.appendChild(save);
    sheetBody.appendChild(actions);
  }

  function openSettingsSheet() {
    if (window.InstantGeometryFunctionViewSettings) {
      window.InstantGeometryFunctionViewSettings.openSettings({
        state: state,
        plot: plot,
        sheetBody: sheetBody,
        openSheet: openSheet,
        closeSheets: closeSheets,
        buildSelect: buildSelect,
        render: render,
        setStatus: setStatus
      });
      return;
    }
    openSheet('設定');
    const tickSelect = buildSelect('座標の数字', String(state.tickLabelInterval || 0), [
      { value: '1', label: '1刻み' },
      { value: '2', label: '2刻み' },
      { value: '5', label: '5刻み' },
      { value: '0', label: '非表示' }
    ]);
    sheetBody.appendChild(tickSelect.field);

    const hintNode = document.createElement('p');
    hintNode.className = 'sheet-hint';
    hintNode.textContent = '座標軸に表示する数字の間隔を変更できます。グリッド線は1刻みのまま表示します。';
    sheetBody.appendChild(hintNode);

    const actions = document.createElement('div');
    actions.className = 'sheet-actions';
    const cancel = document.createElement('button');
    cancel.className = 'btn';
    cancel.type = 'button';
    cancel.textContent = 'キャンセル';
    cancel.addEventListener('click', closeSheets);
    const save = document.createElement('button');
    save.className = 'btn action-primary';
    save.type = 'button';
    save.textContent = '保存';
    save.addEventListener('click', function () {
      state.tickLabelInterval = Number(tickSelect.select.value) || 0;
      closeSheets();
      render();
    });
    actions.appendChild(cancel);
    actions.appendChild(save);
    sheetBody.appendChild(actions);
  }

  function openPointSheet(id) {
    renderCommonSheet({
      kind: 'point',
      id: id,
      title: '点 ' + id,
      value: state.pointInputs[id] || '',
      hasNumericMode: false,
      hint: '非表示または自由入力を選べます。自由入力では数字や記号も文字として表示します。'
    });
  }

  function openLineSheet() {
    renderCommonSheet({
      kind: 'side',
      id: 'f',
      title: '二次曲線',
      value: state.sideInputs.f || '',
      hasNumericMode: true,
      segmentKinds: false,
      kindValue: state.sideKinds.f || 'plain',
      arcVisible: state.sideArcVisible.f !== false,
      hint: '非表示、数値、比の値、自由入力を選べます。\n' + RATIO_LABEL_HINT
    });
  }

  function openAreaSheet() {
    renderCommonSheet({
      kind: 'area',
      id: 'main',
      title: '面積',
      value: state.areaValue || '',
      hasNumericMode: true,
      color: true,
      hint: '非表示、数値、比の値、自由入力を選べます。\n' + RATIO_LABEL_HINT
    });
  }

  function openAngleSheet() {
    renderCommonSheet({
      kind: 'angle',
      id: 'theta',
      title: '角',
      value: state.angleInputs.theta || '',
      hasNumericMode: true,
      angleKinds: true,
      kindValue: state.angleKinds.theta || 'plain',
      angleValue: 0,
      hint: '非表示、数値、比の値、自由入力を選べます。\n' + RATIO_LABEL_HINT
    });
  }

  function openSaveSheet() {
    if (moveMode) return;
    saveSheet.classList.add('open');
    saveSheet.setAttribute('aria-hidden', 'false');
    sheetBackdrop.classList.add('open');
  }

  function captureCanvas(backgroundColor) {
    if (!window.html2canvas) return Promise.reject(new Error('保存に失敗しました。'));
    return window.html2canvas(document.getElementById('captureRoot'), { backgroundColor: backgroundColor, scale: 2 });
  }

  function saveImage(format) {
    const transparent = format === 'transparent';
    return captureCanvas(transparent ? null : '#ffffff').then(function (canvas) {
      const link = document.createElement('a');
      link.download = transparent ? 'function-trig-orthogonality-1-transparent.png' : 'function-trig-orthogonality-1.png';
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
      pdf.save('function-trig-orthogonality-1.pdf');
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

  function reset() {
    axisA.value = '1';
    axisB.value = '2';
    state.pointInputs = { O: '', P: '', Q: '' };
    state.sideInputs = { f: ' ' };
    state.sideKinds = { f: 'plain' };
    state.sideArcVisible = { f: false };
    state.angleInputs = { theta: '' };
    state.angleKinds = { theta: 'hidden' };
    state.areaValue = '';
    state.areaColor = '#2a5bd7';
    state.tickLabelInterval = 1;
    if (window.InstantGeometryFunctionViewSettings) window.InstantGeometryFunctionViewSettings.resetState(state);
    state.labelOffsets = {};
    moveMode = null;
    moveDrag = null;
    updateMoveModeUi();
    closeSheets();
    render();
  }

  axisA.addEventListener('input', render);
  axisB.addEventListener('input', render);
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
  const resetButton = document.getElementById('resetBtn');
  if (resetButton) resetButton.addEventListener('click', reset);
  sheetBackdrop.addEventListener('click', closeSheets);
  moveCancelBtn.addEventListener('click', function () {
    finishMoveMode(true);
  });
  moveDoneBtn.addEventListener('click', function () {
    finishMoveMode(false);
  });
  window.addEventListener('pointermove', function (event) {
    if (!moveDrag) return;
    event.preventDefault();
    const p = pointerToSvgPoint(event);
    const offset = ensureLabelOffset(moveDrag.kind, moveDrag.id);
    offset.x = moveDrag.startOffset.x + (p.x - moveDrag.startPoint.x);
    offset.y = moveDrag.startOffset.y + (p.y - moveDrag.startPoint.y);
    render();
  }, { passive: false });
  window.addEventListener('pointerup', function () {
    moveDrag = null;
  });
  window.addEventListener('pointercancel', function () {
    moveDrag = null;
  });

  render();
})();
