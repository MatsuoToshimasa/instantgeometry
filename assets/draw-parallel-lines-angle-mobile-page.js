(function () {
  'use strict';

  const POINT_IDS = ['P', 'Q', 'R', 'S', 'A', 'B', 'M'];
  const SEGMENTS = {
    PQ: ['P', 'Q'],
    RS: ['R', 'S'],
    AM: ['A', 'M'],
    BM: ['B', 'M']
  };
  const ANGLES = {
    QAM: ['Q', 'A', 'M'],
    AMB: ['A', 'M', 'B'],
    SBM: ['S', 'B', 'M']
  };

  const stage = document.getElementById('stage');
  const statusBox = document.getElementById('statusBox');
  const theta1Input = document.getElementById('theta1Input');
  const theta2Input = document.getElementById('theta2Input');
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
  const captureRoot = document.getElementById('captureRoot');

  const state = {
    points: { P: 'P', Q: 'Q', R: 'R', S: 'S', A: 'A', B: 'B', M: 'M' },
    pointVisible: { P: false, Q: false, R: false, S: false, A: false, B: false, M: false },
    segmentInputs: { PQ: '', RS: '', AM: '', BM: '' },
    segmentKinds: { PQ: 'plain', RS: 'plain', AM: 'plain', BM: 'plain' },
    segmentArcVisible: { PQ: true, RS: true, AM: true, BM: true },
    angleInputs: { QAM: ' ', AMB: ' ', SBM: ' ' },
    angleKinds: { QAM: 'plain', AMB: 'plain', SBM: 'plain' }
  };
  state.labelScales = state.labelScales || {};
  state.labelColors = state.labelColors || {};
  state.labelOffsets = state.labelOffsets || {};
  state.angleArcScales = state.angleArcScales || {};
  Object.keys(ANGLES).forEach(function (id) {
    if (!state.angleArcScales[id]) state.angleArcScales[id] = 1;
  });

  let geometry = null;
  let view = null;

  const LabelEngine = window.InstantGeometryDrawLabelEngine || window.InstantGeometryTriangleLabelEngine || null;
  let labelController = null;
  let moveMode = null;
  let moveDrag = null;
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

  function labelKey(kind, id) {
    return kind + ':' + id;
  }

  function getLabelScale(kind, id) {
    const value = Number(state.labelScales[labelKey(kind, id)]);
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  function setLabelScale(kind, id, value) {
    state.labelScales[labelKey(kind, id)] = Math.max(0.1, Math.min(4, Number(value) || 1));
  }

  function defaultLabelColor(kind, fallback) {
    if (kind === 'point') return '#1f2430';
    if (kind === 'segment') return '#2a5bd7';
    if (kind === 'angle') return '#687086';
    return fallback || '#1f2430';
  }

  function getLabelColor(kind, id, fallback) {
    return state.labelColors[labelKey(kind, id)] || defaultLabelColor(kind, fallback);
  }

  function setLabelColor(kind, id, value) {
    state.labelColors[labelKey(kind, id)] = value || defaultLabelColor(kind);
  }

  function getAngleArcScale(kind, id) {
    if (kind !== 'angle') return 1;
    const value = Number(state.angleArcScales[id]);
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  function setAngleArcScale(kind, id, value) {
    if (kind !== 'angle') return;
    state.angleArcScales[id] = Math.max(0.3, Math.min(3, Number(value) || 1));
  }

  function getLabelOffset(kind, id) {
    return state.labelOffsets[labelKey(kind, id)] || { x: 0, y: 0 };
  }

  function setLabelOffset(kind, id, value) {
    state.labelOffsets[labelKey(kind, id)] = {
      x: Number(value && value.x) || 0,
      y: Number(value && value.y) || 0
    };
  }

  function isMoveTarget(kind, id) {
    return Boolean(moveMode && moveMode.kind === kind && moveMode.id === id);
  }

  function stagePointFromEvent(event) {
    const rect = stage.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / (rect.width || 1)) * 1000,
      y: ((event.clientY - rect.top) / (rect.height || 1)) * 1000
    };
  }

  function updateMoveModeUi() {
    const active = Boolean(moveMode);
    document.body.classList.toggle('label-move-active', active);
    captureRoot.classList.toggle('label-move-active', active);
    moveToolbar.classList.toggle('open', active);
    moveToolbar.setAttribute('aria-hidden', active ? 'false' : 'true');
  }

  function enterMoveMode(kind, id) {
    const originalOffset = getLabelOffset(kind, id);
    moveMode = {
      kind: kind,
      id: id,
      originalOffset: { x: originalOffset.x, y: originalOffset.y }
    };
    closeSheets();
    updateMoveModeUi();
    setStatus('ラベルをドラッグして位置を調整してください。', false);
    render();
  }

  function finishMoveMode(restoreOffset) {
    if (!moveMode) return;
    const previous = moveMode;
    if (restoreOffset) setLabelOffset(previous.kind, previous.id, previous.originalOffset);
    moveMode = null;
    moveDrag = null;
    updateMoveModeUi();
    render();
    if (!restoreOffset && labelController) labelController.openEditSheet(previous.kind, previous.id);
  }

  function attachMoveTarget(node, kind, id) {
    if (!isMoveTarget(kind, id)) return;
    node.classList.add('label-move-target');
    node.addEventListener('pointerdown', function (event) {
      event.preventDefault();
      event.stopPropagation();
      const point = stagePointFromEvent(event);
      const offset = getLabelOffset(kind, id);
      moveDrag = {
        kind: kind,
        id: id,
        start: point,
        offset: { x: offset.x, y: offset.y }
      };
      if (node.setPointerCapture) node.setPointerCapture(event.pointerId);
    });
  }

  function scaledFontSize(kind, id, baseSize) {
    return Math.max(8, Math.round(Number(baseSize) * getLabelScale(kind, id)));
  }

  function getControllerLabelValue(kind, id) {
    if (kind === 'point') return state.pointVisible[id] ? (state.points[id] || '') : '';
    if (kind === 'segment') return state.segmentInputs[id] || '';
    if (kind === 'angle') return state.angleInputs[id] || '';
    return '';
  }

  function setControllerLabelValue(kind, id, value) {
    const normalizedValue = value === LabelEngine.DECIMAL_NUMERIC_LABEL_VALUE ? ' ' : value;
    if (kind === 'point') {
      state.pointVisible[id] = normalizedValue !== '';
      state.points[id] = normalizedValue || '';
      return;
    }
    if (kind === 'segment') {
      state.segmentInputs[id] = normalizedValue || '';
      if (normalizedValue === '') state.segmentArcVisible[id] = false;
      return;
    }
    if (kind === 'angle') {
      state.angleInputs[id] = normalizedValue || '';
    }
  }

  function buildControllerSegmentKindSelect(kind, id, buildSelectFn) {
    return buildSelectFn('線分マーク', state.segmentKinds[id] || 'plain', [
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
    return window.InstantGeometryMobileAngleOrnaments.appendAngleKindSelect(
      body,
      buildSelectFn,
      state.angleKinds[id] || 'plain',
      geometry ? geometry.angles[id] : null
    );
  }

  if (LabelEngine && typeof LabelEngine.createController === 'function') {
    labelController = LabelEngine.createController({
      enabledLabels: { point: true, segment: true, angle: true },
      sheetTitle: sheetTitle,
      sheetBody: sheetBody,
      editSheet: editSheet,
      sheetBackdrop: sheetBackdrop,
      closeSheets: closeSheets,
      render: render,
      onError: function (error) {
        setStatus(error.message || '入力を確認してください。', true);
      },
      getModalSpec: function (kind, id, modalType) {
        return LabelEngine.getStandardModalSpec(modalType);
      },
      onMove: function (kind, id) {
        enterMoveMode(kind, id);
      },
      getTitle: function (kind, id) {
        return kind === 'point' ? '点ラベル' : kind === 'segment' ? '線分ラベル' : '角ラベル';
      },
      getLabelValue: getControllerLabelValue,
      setLabelValue: setControllerLabelValue,
      getLabelScale: getLabelScale,
      setLabelScale: setLabelScale,
      getAngleArcScale: getAngleArcScale,
      setAngleArcScale: setAngleArcScale,
      getColor: getLabelColor,
      setColor: setLabelColor,
      hasGuideField: function (kind) {
        return kind === 'segment';
      },
      getGuideVisible: function (kind, id) {
        return kind === 'segment' ? state.segmentArcVisible[id] !== false : false;
      },
      setGuideVisible: function (kind, id, value) {
        if (kind === 'segment') state.segmentArcVisible[id] = Boolean(value);
      },
      buildSegmentKindSelect: buildControllerSegmentKindSelect,
      buildAngleKindSelect: buildControllerAngleKindSelect,
      setKind: function (kind, id, value) {
        if (kind === 'segment') state.segmentKinds[id] = value;
        else if (kind === 'angle') state.angleKinds[id] = value;
      },
      hasColorField: function () {
        return true;
      }
    });
  }


  if (window.InstantGeometrySaveQuota) {
    window.InstantGeometrySaveQuota.createIndicator({ target: saveBtn });
  }

  function setStatus(message, isError) {
    statusBox.textContent = message;
    statusBox.classList.toggle('error', Boolean(isError));
  }

  function createSvg(tag, attrs) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (attrs[key] !== null && attrs[key] !== undefined) node.setAttribute(key, String(attrs[key]));
    });
    return node;
  }

  function parseAngle(input, name) {
    const text = String(input || '').trim();
    if (!/^[1-9][0-9]*$/.test(text)) throw new Error(name + ' は整数で入力してください。');
    const value = Number(text);
    if (!(value > 0 && value < 180)) throw new Error(name + ' は 0° より大きく 180° 未満で入力してください。');
    return value;
  }

  function formatNumber(value) {
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  }

  function midpoint(P, Q) {
    return { x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 };
  }

  function normalizeFreeLabel(value) {
    return String(value || '');
  }

  function isNumericLabelValue(value) {
    return value === ' ' || value === '0';
  }

  const RATIO_LABEL_PREFIX = 'ratio:';
  const RATIO_LABEL_HINT = '例: a,b または 3,2';

  function parseRatioLabelInput(value) {
    const source = String(value || '').trim();
    if (!source) return null;
    const parts = source.split(/[,:：]/).map(function (part) { return part.trim(); }).filter(Boolean);
    if (parts.length !== 2) throw new Error('比の値は「a,b」の形で入力してください。');
    return { left: parts[0], right: parts[1], source: parts[0] + ',' + parts[1] };
  }

  function isRatioLabelValue(value) {
    return String(value || '').indexOf(RATIO_LABEL_PREFIX) === 0;
  }

  function getRatioLabelInput(value) {
    return String(value || '').slice(RATIO_LABEL_PREFIX.length);
  }

  function getDisplayMode(value, hasNumericMode) {
    if (value === '') return 'hidden';
    if (isRatioLabelValue(value)) return 'ratio';
    if (hasNumericMode && isNumericLabelValue(value)) return 'numeric';
    return 'text';
  }

  function angleValue(a, b, c) {
    const v1 = { x: a.x - b.x, y: a.y - b.y };
    const v2 = { x: c.x - b.x, y: c.y - b.y };
    const len1 = Math.hypot(v1.x, v1.y) || 1;
    const len2 = Math.hypot(v2.x, v2.y) || 1;
    const dot = Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / (len1 * len2)));
    return Math.acos(dot) * 180 / Math.PI;
  }

  function computeGeometry() {
    const theta1 = parseAngle(theta1Input.value, '∠QAM');
    const theta2 = parseAngle(theta2Input.value, '∠SBM');
    const lineLength = 10;
    const upperY = 2.2;
    const lowerY = -2.2;
    const leftX = -lineLength / 2;
    const A = { x: -1, y: upperY };
    const B = { x: 0.8, y: lowerY };
    const dirA = { x: Math.cos(theta1 * Math.PI / 180), y: -Math.sin(theta1 * Math.PI / 180) };
    const dirB = { x: Math.cos(theta2 * Math.PI / 180), y: Math.sin(theta2 * Math.PI / 180) };
    const denominator = dirA.x * dirB.y - dirA.y * dirB.x;
    if (Math.abs(denominator) < 1e-9) throw new Error('AM と BM が交わりません。');
    const diff = { x: B.x - A.x, y: B.y - A.y };
    const t = (diff.x * dirB.y - diff.y * dirB.x) / denominator;
    const u = (diff.x * dirA.y - diff.y * dirA.x) / denominator;
    if (!(t > 0 && u > 0)) throw new Error('指定した角では、M が平行線の間にできません。');
    const M = { x: A.x + dirA.x * t, y: A.y + dirA.y * t };
    if (!(M.y < upperY && M.y > lowerY)) throw new Error('指定した角では、M が平行線の間にできません。');
    const points = {
      P: { x: leftX, y: upperY },
      Q: { x: lineLength / 2, y: upperY },
      R: { x: leftX, y: lowerY },
      S: { x: lineLength / 2, y: lowerY },
      A: A,
      B: B,
      M: M
    };
    return {
      points: points,
      angles: {
        QAM: theta1,
        AMB: angleValue(A, M, B),
        SBM: theta2
      }
    };
  }

  function getBounds(points) {
    const values = Object.keys(points).map(function (id) { return points[id]; });
    const xs = values.map(function (p) { return p.x; });
    const ys = values.map(function (p) { return p.y; });
    return {
      minX: Math.min.apply(null, xs),
      maxX: Math.max.apply(null, xs),
      minY: Math.min.apply(null, ys),
      maxY: Math.max.apply(null, ys)
    };
  }

  function computeView(points) {
    const bounds = getBounds(points);
    const width = Math.max(1, bounds.maxX - bounds.minX);
    const height = Math.max(1, bounds.maxY - bounds.minY);
    const padding = Math.max(width, height) * 0.22;
    const size = Math.max(width, height) + padding * 2;
    return {
      x: bounds.minX - (size - width) / 2,
      y: bounds.minY - (size - height) / 2,
      size: size,
      width: size,
      height: size
    };
  }

  function fitPoint(point) {
    return {
      x: ((point.x - view.x) / view.size) * 1000,
      y: ((point.y - view.y) / view.size) * 1000
    };
  }

  function pointAwayFrom(center, point, distance) {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const length = Math.hypot(dx, dy) || 1;
    return { x: point.x + dx / length * distance, y: point.y + dy / length * distance };
  }

  function arcPoints(vertex, p1, p2, radius) {
    const a1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
    const a2 = Math.atan2(p2.y - vertex.y, p2.x - vertex.x);
    let delta = a2 - a1;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    const points = [];
    for (let i = 0; i <= 22; i += 1) {
      const angle = a1 + delta * (i / 22);
      points.push({ x: vertex.x + Math.cos(angle) * radius, y: vertex.y + Math.sin(angle) * radius });
    }
    return points;
  }

  function pathFromPoints(points) {
    return points.map(function (point, index) {
      return (index === 0 ? 'M ' : 'L ') + formatNumber(point.x) + ' ' + formatNumber(point.y);
    }).join(' ');
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
    return pathFromPoints(points);
  }

  function normalOffset(P, Q, toward, distance) {
    const m = midpoint(P, Q);
    const dx = Q.x - P.x;
    const dy = Q.y - P.y;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    const toTowardX = toward.x - m.x;
    const toTowardY = toward.y - m.y;
    if (nx * toTowardX + ny * toTowardY > 0) {
      nx *= -1;
      ny *= -1;
    }
    return { x: m.x + nx * distance, y: m.y + ny * distance };
  }

  function sideArcGeometry(P, Q, center, labelPoint) {
    const mx = (P.x + Q.x) / 2;
    const my = (P.y + Q.y) / 2;
    const dx = Q.x - P.x;
    const dy = Q.y - P.y;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    const toCenterX = center.x - mx;
    const toCenterY = center.y - my;
    if (nx * toCenterX + ny * toCenterY > 0) {
      nx *= -1;
      ny *= -1;
    }
    const defaultCenter = { x: mx + nx * Math.max(26, len * 0.12), y: my + ny * Math.max(26, len * 0.12) };
    const desired = labelPoint || defaultCenter;
    return { control: { x: desired.x * 2 - mx, y: desired.y * 2 - my }, gapHalf: 0.14 };
  }

  function drawSideKind(stageNode, kind, P, Q) {
    if (!kind || kind === 'plain') return;
    if (window.InstantGeometryMobileAngleOrnaments && window.InstantGeometryMobileAngleOrnaments.drawSegmentKind(stageNode, kind, P, Q, createSvg)) return;
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
      stageNode.appendChild(createSvg('line', {
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
      stageNode.appendChild(createSvg('circle', { cx: mid.x, cy: mid.y, r: 8, fill: 'none', stroke: stroke, 'stroke-width': 3 }));
    } else if (kind === 'single') {
      addLine(mid.x, mid.y, 12);
    } else if (kind === 'double') {
      addLine(mid.x - tx * 9, mid.y - ty * 9, 12);
      addLine(mid.x + tx * 9, mid.y + ty * 9, 12);
    } else if (kind === 'cross') {
      addLine(mid.x, mid.y, 12);
      stageNode.appendChild(createSvg('line', {
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
      stageNode.appendChild(createSvg('polygon', {
        points: [p1, p2, p3].map(function (p) { return p.x + ',' + p.y; }).join(' '),
        fill: stroke,
        stroke: stroke,
        'stroke-width': 1.5
      }));
    }
  }

  function angleLabelPoint(vertex, p1, p2, radius) {
    const arc = arcPoints(vertex, p1, p2, radius);
    return arc[Math.floor(arc.length / 2)];
  }


  function attachHit(element, kind, id) {
    element.style.cursor = 'pointer';
    element.addEventListener('click', function (event) {
      event.stopPropagation();
      if (moveMode) return;
      if (labelController && typeof labelController.openEditSheet === 'function') {
        labelController.openEditSheet(kind, id);
        return;
      }
      openEditSheet(kind, id);
    });
  }

  function getPointText(id) {
    return String(state.points[id] || '').trim() || id;
  }

  function getSegmentText(id) {
    const raw = String(state.segmentInputs[id] || '');
    if (!raw) return null;
    if (isRatioLabelValue(raw)) return raw;
    if (!isNumericLabelValue(raw)) return raw;
    const ends = SEGMENTS[id];
    const a = geometry.points[ends[0]];
    const b = geometry.points[ends[1]];
    return formatNumber(Math.hypot(b.x - a.x, b.y - a.y));
  }

  function getAngleText(id) {
    const raw = String(state.angleInputs[id] || '');
    if (!raw) return null;
    if (isRatioLabelValue(raw)) return raw;
    if (!isNumericLabelValue(raw)) return raw;
    return formatNumber(geometry.angles[id]) + '°';
  }

  function createLabelNode(point, text, attrs) {
    const merged = Object.assign({
      x: point.x,
      y: point.y,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle'
    }, attrs || {});
    if (isRatioLabelValue(text)) {
      const parsed = parseRatioLabelInput(getRatioLabelInput(text));
      const node = createSvg('text', merged);
      const left = createSvg('tspan', {});
      left.textContent = parsed.left;
      const sep = createSvg('tspan', { dx: 6 });
      sep.textContent = ':';
      const right = createSvg('tspan', { dx: 6 });
      right.textContent = parsed.right;
      node.appendChild(left);
      node.appendChild(sep);
      node.appendChild(right);
      return node;
    }
    if (window.InstantGeometrySharedLabels && typeof window.InstantGeometrySharedLabels.createSvgKatexLabel === 'function') {
      const katexNode = window.InstantGeometrySharedLabels.createSvgKatexLabel({
        createSvg: createSvg,
        text: text,
        attrs: merged,
        kind: merged['data-label-kind'] || merged['data-kind'],
        id: merged['data-label-id'] || merged['data-id']
      });
      if (katexNode) return katexNode;
    }
    const node = createSvg('text', merged);
    node.textContent = text;
    return node;
  }

  function drawText(point, text, attrs) {
    const kind = attrs && (attrs['data-label-kind'] || attrs['data-kind']);
    const id = attrs && (attrs['data-label-id'] || attrs['data-id']);
    const offset = kind && id ? getLabelOffset(kind, id) : { x: 0, y: 0 };
    const movedPoint = { x: point.x + offset.x, y: point.y + offset.y };
    const mergedAttrs = Object.assign({}, attrs || {});
    if (kind && id) mergedAttrs.fill = getLabelColor(kind, id, mergedAttrs.fill);
    const node = createLabelNode(movedPoint, text, mergedAttrs);
    if (kind && id) attachMoveTarget(node, kind, id);
    stage.appendChild(node);
    return node;
  }

  function render() {
    try {
      geometry = computeGeometry();
      view = computeView(geometry.points);
      stage.innerHTML = '';
      stage.setAttribute('viewBox', '0 0 1000 1000');
      const screen = {};
      POINT_IDS.forEach(function (id) { screen[id] = fitPoint(geometry.points[id]); });
      const center = POINT_IDS.reduce(function (acc, id) {
        acc.x += geometry.points[id].x / POINT_IDS.length;
        acc.y += geometry.points[id].y / POINT_IDS.length;
        return acc;
      }, { x: 0, y: 0 });
      const screenCenter = fitPoint(center);

      Object.keys(SEGMENTS).forEach(function (id) {
        const ends = SEGMENTS[id];
        const line = createSvg('line', {
          x1: screen[ends[0]].x,
          y1: screen[ends[0]].y,
          x2: screen[ends[1]].x,
          y2: screen[ends[1]].y,
          stroke: '#2a5bd7',
          'stroke-width': '4',
          'stroke-linecap': 'round'
        });
        attachHit(line, 'segment', id);
        stage.appendChild(line);
        const hit = createSvg('line', {
          x1: screen[ends[0]].x,
          y1: screen[ends[0]].y,
          x2: screen[ends[1]].x,
          y2: screen[ends[1]].y,
          stroke: 'transparent',
          'stroke-width': '30',
          'stroke-linecap': 'round'
        });
        attachHit(hit, 'segment', id);
        stage.appendChild(hit);
        drawSideKind(stage, state.segmentKinds[id], screen[ends[0]], screen[ends[1]]);
      });

      Object.keys(ANGLES).forEach(function (id) {
        const ids = ANGLES[id];
        const kind = state.angleKinds[id] || 'plain';
        const arc = arcPoints(geometry.points[ids[1]], geometry.points[ids[0]], geometry.points[ids[2]], 0.48 * getAngleArcScale('angle', id)).map(fitPoint);
        if (window.InstantGeometryMobileAngleOrnaments.normalizeAngleKind(kind, geometry.angles[id]) !== kind) {
          state.angleKinds[id] = 'plain';
        }
        if (state.angleKinds[id] !== 'hidden' && state.angleKinds[id] !== 'right') {
          const path = createSvg('path', {
            d: pathFromPoints(arc),
            fill: 'none',
            stroke: '#687086',
            'stroke-width': '3',
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round'
          });
          attachHit(path, 'angle', id);
          stage.appendChild(path);
        }
        window.InstantGeometryMobileAngleOrnaments.drawAngleKind(stage, state.angleKinds[id], arc, screen[ids[1]], screenCenter, createSvg, {
          p1: screen[ids[0]],
          p2: screen[ids[2]]
        });
      });

      POINT_IDS.forEach(function (id) {
        const dot = createSvg('circle', { cx: screen[id].x, cy: screen[id].y, r: 8, fill: '#1f2430' });
        attachHit(dot, 'point', id);
        stage.appendChild(dot);
      });

      POINT_IDS.forEach(function (id) {
        if (!state.pointVisible[id]) return;
        const offset = id === 'P' || id === 'R' ? { x: -0.38, y: id === 'P' ? -0.2 : 0.2 } :
          id === 'Q' || id === 'S' ? { x: 0.38, y: id === 'Q' ? -0.2 : 0.2 } :
          { x: pointAwayFrom(center, geometry.points[id], 0.36).x - geometry.points[id].x, y: pointAwayFrom(center, geometry.points[id], 0.36).y - geometry.points[id].y };
        const pos = fitPoint({ x: geometry.points[id].x + offset.x, y: geometry.points[id].y + offset.y });
        const label = drawText(pos, getPointText(id), { 'font-size': scaledFontSize('point', id, 58), 'font-weight': '700', fill: '#1f2430', 'data-label-kind': 'point', 'data-label-id': id });
        attachHit(label, 'point', id);
      });

      Object.keys(SEGMENTS).forEach(function (id) {
        const labelText = getSegmentText(id);
        if (!labelText) return;
        const ends = SEGMENTS[id];
        const a = geometry.points[ends[0]];
        const b = geometry.points[ends[1]];
        const distance = Math.max(0.35, Math.hypot(b.x - a.x, b.y - a.y) * 0.08);
        const pos = fitPoint(normalOffset(a, b, center, distance));
        if (state.segmentArcVisible[id] !== false) {
          const geom = sideArcGeometry(screen[ends[0]], screen[ends[1]], screenCenter, pos);
          stage.appendChild(createSvg('path', {
            d: quadraticPathSegment(screen[ends[0]], geom.control, screen[ends[1]], 0, 0.5 - geom.gapHalf, 20),
            fill: 'none',
            stroke: '#2a5bd7',
            'stroke-width': '2',
            'stroke-linecap': 'round',
            'stroke-dasharray': '6 5'
          }));
          stage.appendChild(createSvg('path', {
            d: quadraticPathSegment(screen[ends[0]], geom.control, screen[ends[1]], 0.5 + geom.gapHalf, 1, 20),
            fill: 'none',
            stroke: '#2a5bd7',
            'stroke-width': '2',
            'stroke-linecap': 'round',
            'stroke-dasharray': '6 5'
          }));
        }
        const label = drawText(pos, labelText, { 'font-size': scaledFontSize('segment', id, 48), 'font-weight': '700', fill: '#2a5bd7', 'data-label-kind': 'segment', 'data-label-id': id });
        attachHit(label, 'segment', id);
      });

      Object.keys(ANGLES).forEach(function (id) {
        const labelText = getAngleText(id);
        if (!labelText) return;
        const ids = ANGLES[id];
        const pos = fitPoint(angleLabelPoint(geometry.points[ids[1]], geometry.points[ids[0]], geometry.points[ids[2]], 0.92));
        const label = drawText(pos, labelText, { 'font-size': scaledFontSize('angle', id, 46), 'font-weight': '700', fill: '#687086', 'data-label-kind': 'angle', 'data-label-id': id });
        attachHit(label, 'angle', id);
      });
      setStatus('入力をもとに平行線と角①を描画しています。', false);
    } catch (error) {
      stage.innerHTML = '';
      setStatus(error.message || '描画に失敗しました。', true);
    }
  }

  function closeSheets() {
    editSheet.classList.remove('open');
    editSheet.setAttribute('aria-hidden', 'true');
    saveSheet.classList.remove('open');
    saveSheet.setAttribute('aria-hidden', 'true');
    sheetBackdrop.classList.remove('open');
    sheetBody.innerHTML = '';
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
      hasNumericMode ? { value: 'numeric', label: '数値' } : null,
      { value: 'ratio', label: '比の値' },
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
      : getDisplayMode(value, hasNumericMode) === 'ratio'
        ? getRatioLabelInput(value)
        : '';
    input.setAttribute('inputmode', 'text');
    input.autocapitalize = 'none';
    input.autocomplete = 'off';
    input.spellcheck = false;
    function sync() {
      input.disabled = mode.value !== 'text' && mode.value !== 'ratio';
      input.placeholder = mode.value === 'ratio' ? RATIO_LABEL_HINT : '';
    }
    mode.addEventListener('change', sync);
    field.appendChild(label);
    field.appendChild(mode);
    field.appendChild(input);
    sync();
    return { field: field, mode: mode, input: input };
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

  function openEditSheet(kind, id) {
    closeSheets();
    const titlePrefix = kind === 'point' ? '点 ' : kind === 'segment' ? '線分 ' : '∠';
    sheetTitle.textContent = titlePrefix + id;
    let kindSelect = null;
    let arcCheckbox = null;
    let labelEditor = null;
    let pointVisible = null;
    if (kind === 'point') {
      pointVisible = buildCheckbox('表示する', state.pointVisible[id]);
      labelEditor = buildLabelEditor('ラベル', state.points[id] || '', false);
      sheetBody.appendChild(pointVisible.field);
      sheetBody.appendChild(labelEditor.field);
    } else if (kind === 'segment') {
      const built = buildSelect('種類', state.segmentKinds[id] || 'plain', [
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
      const checkboxBuilt = buildCheckbox('弧を表示', state.segmentArcVisible[id] !== false);
      arcCheckbox = checkboxBuilt.input;
      sheetBody.appendChild(checkboxBuilt.field);
      labelEditor = buildLabelEditor('ラベル', state.segmentInputs[id] || '', true);
      sheetBody.appendChild(labelEditor.field);
    } else {
      kindSelect = window.InstantGeometryMobileAngleOrnaments.appendAngleKindSelect(
        sheetBody,
        buildSelect,
        state.angleKinds[id] || 'plain',
        geometry ? geometry.angles[id] : null
      );
      labelEditor = buildLabelEditor('ラベル', state.angleInputs[id] || '', true);
      sheetBody.appendChild(labelEditor.field);
    }
    const hint = document.createElement('p');
    hint.className = 'sheet-hint';
    hint.textContent = kind === 'point'
      ? '非表示または自由入力を選べます。自由入力では数字や記号も文字として表示します。'
      : '非表示、数値、比の値、自由入力を選べます。自由入力では数字や記号も文字として表示します。';
    sheetBody.appendChild(hint);
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
      const mode = labelEditor.mode.value;
      const text = normalizeFreeLabel(labelEditor.input.value);
      if (kind === 'point') {
        state.pointVisible[id] = pointVisible.input.checked;
        state.points[id] = mode === 'text' ? text : '';
      } else if (kind === 'segment') {
        state.segmentKinds[id] = kindSelect.value;
        state.segmentArcVisible[id] = arcCheckbox.checked;
        if (mode === 'hidden') {
          state.segmentInputs[id] = '';
          state.segmentArcVisible[id] = false;
        } else if (mode === 'numeric') {
          state.segmentInputs[id] = ' ';
        } else if (mode === 'ratio') {
          const parsed = parseRatioLabelInput(text);
          if (!parsed) throw new Error('比の値を入力してください。');
          state.segmentInputs[id] = RATIO_LABEL_PREFIX + parsed.source;
        } else {
          state.segmentInputs[id] = text || '';
        }
      } else {
        state.angleKinds[id] = kindSelect.value;
        if (mode === 'hidden') {
          state.angleInputs[id] = '';
        } else if (mode === 'numeric') {
          state.angleInputs[id] = ' ';
        } else if (mode === 'ratio') {
          const parsed = parseRatioLabelInput(text);
          if (!parsed) throw new Error('比の値を入力してください。');
          state.angleInputs[id] = RATIO_LABEL_PREFIX + parsed.source;
        } else {
          state.angleInputs[id] = text || '';
        }
      }
      closeSheets();
      render();
    });
    actions.appendChild(cancel);
    actions.appendChild(save);
    sheetBody.appendChild(actions);
    editSheet.classList.add('open');
    editSheet.setAttribute('aria-hidden', 'false');
    sheetBackdrop.classList.add('open');
  }

  function openSaveSheet() {
    closeSheets();
    saveSheet.classList.add('open');
    saveSheet.setAttribute('aria-hidden', 'false');
    sheetBackdrop.classList.add('open');
  }

  async function saveAs(format) {
    const backgroundColor = format === 'transparent' ? null : '#ffffff';
    const canvas = await html2canvas(captureRoot, { backgroundColor: backgroundColor, scale: 2 });
    if (format === 'png' || format === 'transparent') {
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = format === 'transparent' ? 'parallel-lines-angle-transparent.png' : 'parallel-lines-angle.png';
      link.click();
      return;
    }
    const jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) throw new Error('PDF 出力に失敗しました。');
    const pdf = new jsPDF('portrait', 'mm', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    let drawW = pageW;
    let drawH = canvas.height * drawW / canvas.width;
    if (drawH > pageH) {
      drawH = pageH;
      drawW = canvas.width * drawH / canvas.height;
    }
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pageW - drawW) / 2, (pageH - drawH) / 2, drawW, drawH);
    pdf.save('parallel-lines-angle.pdf');
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

  theta1Input.addEventListener('input', render);
  theta2Input.addEventListener('input', render);
  backBtn.addEventListener('click', function () { window.history.back(); });
  saveBtn.addEventListener('click', openSaveSheet);
  sheetBackdrop.addEventListener('click', closeSheets);
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
  moveCancelBtn.addEventListener('click', function () { finishMoveMode(true); });
  moveDoneBtn.addEventListener('click', function () { finishMoveMode(false); });
  window.addEventListener('pointermove', function (event) {
    if (!moveDrag) return;
    const point = stagePointFromEvent(event);
    setLabelOffset(moveDrag.kind, moveDrag.id, {
      x: moveDrag.offset.x + point.x - moveDrag.start.x,
      y: moveDrag.offset.y + point.y - moveDrag.start.y
    });
    render();
  });
  window.addEventListener('pointerup', function () {
    moveDrag = null;
  });

  render();
})();
