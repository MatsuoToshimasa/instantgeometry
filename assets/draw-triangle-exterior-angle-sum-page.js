(function () {
  'use strict';

  const stage = document.getElementById('stage');
  const statusBox = document.getElementById('statusBox');
  const angleDACInput = document.getElementById('angleDACInput');
  const angleEBAInput = document.getElementById('angleEBAInput');
  const angleFCBInput = document.getElementById('angleFCBInput');
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
  const LabelEngine = window.InstantGeometryDrawLabelEngine || window.InstantGeometryTriangleLabelEngine;
  const enabledLabels = LabelEngine.normalizeEnabledLabels({
    point: true,
    segment: true,
    angle: true,
    area: true
  });

  const ANGLE_LABELS = {
    DAC: { points: ['D', 'A', 'C'], parameter: true },
    EBA: { points: ['E', 'B', 'A'], parameter: true },
    FCB: { points: ['F', 'C', 'B'], parameter: true },
    BAC: { points: ['B', 'A', 'C'], parameter: false },
    ABC: { points: ['A', 'B', 'C'], parameter: false },
    BCA: { points: ['B', 'C', 'A'], parameter: false }
  };

  const SEGMENT_LABELS = {
    AB: { points: ['A', 'B'] },
    BC: { points: ['B', 'C'] },
    CA: { points: ['C', 'A'] }
  };

  const AREA_LABELS = {
    ABC: { points: ['A', 'B', 'C'], name: '△ABC' }
  };

  const state = {
    pointInputs: { A: 'A', B: 'B', C: 'C', D: '', E: '', F: '' },
    segmentInputs: { AB: '', BC: '', CA: '' },
    segmentKinds: { AB: 'plain', BC: 'plain', CA: 'plain' },
    segmentArcVisible: { AB: true, BC: true, CA: true },
    angleInputs: { DAC: ' ', EBA: ' ', FCB: ' ', BAC: '', ABC: '', BCA: '' },
    angleKinds: { DAC: 'plain', EBA: 'plain', FCB: 'plain', BAC: 'hidden', ABC: 'hidden', BCA: 'hidden' },
    areaInputs: { ABC: '' },
    labelColors: { point: {}, segment: {}, angle: {}, area: {} },
    mathLabelScales: { point: {}, segment: {}, angle: {}, area: {} },
    angleArcScales: {},
    labelOffsets: { point: {}, segment: {}, angle: {}, area: {} },
    decimalPlaces: 2
  };

  let currentGeometry = null;
  let currentLabelBases = {};
  let moveMode = null;
  let moveDrag = null;
  let labelController = null;
  let activeDecimalPlaces = clampDecimalPlaces(state.decimalPlaces);

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

  const RATIO_LABEL_PREFIX = LabelEngine.RATIO_LABEL_PREFIX;

  if (window.InstantGeometrySaveQuota) {
    window.InstantGeometrySaveQuota.createIndicator({ target: saveBtn });
  }

  function createSvg(tag, attrs) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (attrs[key] !== null && attrs[key] !== undefined) node.setAttribute(key, String(attrs[key]));
    });
    return node;
  }

  function setStatus(message, isError) {
    statusBox.textContent = message;
    statusBox.classList.toggle('error', Boolean(isError));
  }

  function parseAngle(value, name) {
    const text = String(value || '').trim();
    if (!/^(?:[1-9][0-9]?|1[0-7][0-9])(?:\.[0-9]+)?$|^0\.[0-9]*[1-9][0-9]*$/.test(text)) {
      throw new Error(name + ' には 0 より大きく 180 未満の数を入力してください。');
    }
    const angle = Number(text);
    if (!(angle > 0 && angle < 180)) throw new Error(name + ' には 0 より大きく 180 未満の数を入力してください。');
    return angle;
  }

  function formatNumber(value) {
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  }

  function clampDecimalPlaces(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 2;
    return Math.max(0, Math.min(6, Math.round(number)));
  }

  function setActiveDecimalPlaces(value) {
    activeDecimalPlaces = clampDecimalPlaces(value);
    return activeDecimalPlaces;
  }

  function formatDecimalNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '';
    const fixed = number.toFixed(activeDecimalPlaces);
    return activeDecimalPlaces === 0 ? fixed : fixed.replace(/0+$/, '').replace(/\.$/, '');
  }

  function formatWithDrawSettings(kind, label) {
    if (!label || typeof label !== 'string') return label;
    const formatter = window.InstantGeometryDrawSettings;
    if (!formatter) return label;
    if (kind === 'segment' && typeof formatter.formatLength === 'function') return formatter.formatLength(label);
    if (kind === 'area' && typeof formatter.formatArea === 'function') return formatter.formatArea(label);
    return label;
  }

  function hexToRgba(hex, alpha) {
    const text = String(hex || '').trim();
    const match = /^#?([0-9a-f]{6})$/i.exec(text);
    if (!match) return 'rgba(42,91,215,' + alpha + ')';
    const raw = match[1];
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function formatRadianAngle(degrees) {
    const rounded = Math.round(degrees * 1000000) / 1000000;
    const numerator = Math.round(rounded);
    if (Math.abs(rounded - numerator) < 1e-8) {
      const denominator = 180;
      const divisor = gcd(numerator, denominator);
      const n = numerator / divisor;
      const d = denominator / divisor;
      if (n === 0) return '0';
      if (d === 1) return n === 1 ? 'π' : n + 'π';
      return (n === 1 ? 'π' : n + 'π') + '/' + d;
    }
    return formatNumber(degrees * Math.PI / 180);
  }

  function formatAngleValue(degrees) {
    if (window.InstantGeometryDrawSettings && typeof window.InstantGeometryDrawSettings.formatAngle === 'function') {
      return window.InstantGeometryDrawSettings.formatAngle(formatNumber(degrees));
    }
    return formatNumber(degrees) + '°';
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

  function toRadians(deg) {
    return deg * Math.PI / 180;
  }

  function midpoint(P, Q) {
    return { x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 };
  }

  function parseRatioLabelInput(value) {
    return LabelEngine.parseRatioLabelInput(value);
  }

  function isRatioLabelValue(value) {
    return LabelEngine.isRatioLabelValue(value);
  }

  function getRatioLabelInput(value) {
    return LabelEngine.getRatioLabelInput(value);
  }

  function isNumericLabelValue(value) {
    return LabelEngine.isNumericLabelValue(value);
  }

  function isRawNumericLabelValue(value) {
    return LabelEngine.isRawNumericLabelValue(value);
  }

  function isDecimalNumericLabelValue(value) {
    return LabelEngine.isDecimalNumericLabelValue(value);
  }

  function isAnyNumericLabelValue(value) {
    return LabelEngine.isAnyNumericLabelValue(value);
  }

  function getDisplayMode(value, hasNumericMode) {
    return LabelEngine.getDisplayMode(value, hasNumericMode);
  }

  function labelKey(kind, id) {
    return kind + ':' + id;
  }

  function getLabelOffset(kind, id) {
    if (!state.labelOffsets[kind]) state.labelOffsets[kind] = {};
    if (!state.labelOffsets[kind][id]) state.labelOffsets[kind][id] = { x: 0, y: 0 };
    return state.labelOffsets[kind][id];
  }

  function getLabelPosition(kind, id, base) {
    currentLabelBases[labelKey(kind, id)] = { x: base.x, y: base.y };
    const offset = getLabelOffset(kind, id);
    return { x: base.x + offset.x, y: base.y + offset.y };
  }

  function getLabelColor(kind, id) {
    if (state.labelColors[kind] && state.labelColors[kind][id]) return state.labelColors[kind][id];
    if (kind === 'point') return '#1f2430';
    if (kind === 'area') return '#2a5bd7';
    if (kind === 'segment') return '#2a5bd7';
    return '#687086';
  }

  function setLabelColor(kind, id, color) {
    if (!state.labelColors[kind]) state.labelColors[kind] = {};
    state.labelColors[kind][id] = color;
  }

  function getLabelValue(kind, id) {
    if (kind === 'point') return state.pointInputs[id] || '';
    if (kind === 'segment') return state.segmentInputs[id] || '';
    if (kind === 'angle') return state.angleInputs[id] || '';
    if (kind === 'area') return state.areaInputs[id] || '';
    return '';
  }

  function setLabelValue(kind, id, value) {
    if (kind === 'point') state.pointInputs[id] = value;
    else if (kind === 'segment') {
      state.segmentInputs[id] = value;
      if (!value) state.segmentArcVisible[id] = false;
    } else if (kind === 'angle') state.angleInputs[id] = value;
    else if (kind === 'area') state.areaInputs[id] = value;
  }

  function getMathLabelScale(kind, id) {
    const group = state.mathLabelScales[kind] || {};
    const value = Number(group[id]);
    return Number.isFinite(value) ? Math.max(0.1, Math.min(4, value)) : 1;
  }

  function setMathLabelScale(kind, id, value) {
    if (!state.mathLabelScales[kind]) state.mathLabelScales[kind] = {};
    state.mathLabelScales[kind][id] = Math.max(0.1, Math.min(4, value));
  }

  function getAngleArcScale(id) {
    const value = Number(state.angleArcScales[id]);
    return Number.isFinite(value) ? Math.max(0.3, Math.min(3, value)) : 1;
  }

  function setAngleArcScale(id, value) {
    state.angleArcScales[id] = Math.max(0.3, Math.min(3, value));
  }

  function pointOnRay(P, Q, distance) {
    const dx = Q.x - P.x;
    const dy = Q.y - P.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: P.x + dx / len * distance, y: P.y + dy / len * distance };
  }

  function angleDegrees(P, vertex, Q) {
    const v1 = { x: P.x - vertex.x, y: P.y - vertex.y };
    const v2 = { x: Q.x - vertex.x, y: Q.y - vertex.y };
    const len = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
    if (!len) return 0;
    const cos = Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / len));
    return Math.acos(cos) * 180 / Math.PI;
  }

  function distance(P, Q) {
    return Math.hypot(P.x - Q.x, P.y - Q.y);
  }

  function triangleArea(P, Q, R) {
    return Math.abs((Q.x - P.x) * (R.y - P.y) - (R.x - P.x) * (Q.y - P.y)) / 2;
  }

  function normalizedTriangleSide(id) {
    if (!currentGeometry || !currentGeometry.values) return null;
    const angleA = currentGeometry.values.BAC;
    const angleB = currentGeometry.values.ABC;
    const angleC = currentGeometry.values.BCA;
    const sinC = Math.sin(toRadians(angleC));
    if (Math.abs(sinC) < 1e-10) return null;
    if (id === 'AB') return 1;
    if (id === 'BC') return Math.sin(toRadians(angleA)) / sinC;
    if (id === 'CA') return Math.sin(toRadians(angleB)) / sinC;
    return null;
  }

  function normalizedTriangleArea() {
    if (!currentGeometry || !currentGeometry.values) return null;
    const ca = normalizedTriangleSide('CA');
    if (!Number.isFinite(ca)) return null;
    return 0.5 * ca * Math.sin(toRadians(currentGeometry.values.BAC));
  }

  function formatSpecialNormalizedValue(value) {
    if (!Number.isFinite(value)) return null;
    const candidates = [
      { value: Math.sqrt(3) / 8, label: '√3/8' },
      { value: Math.sqrt(3) / 4, label: '√3/4' },
      { value: Math.sqrt(3) / 2, label: '√3/2' },
      { value: Math.sqrt(2) / 2, label: '√2/2' },
      { value: Math.sqrt(2) / 4, label: '√2/4' },
      { value: 1 / 2, label: '1/2' },
      { value: 1 / 4, label: '1/4' },
      { value: 1, label: '1' }
    ];
    for (let i = 0; i < candidates.length; i += 1) {
      if (Math.abs(value - candidates[i].value) < 1e-8) return candidates[i].label;
    }
    return formatNumber(value);
  }

  function centroid(points) {
    return {
      x: points.reduce(function (sum, point) { return sum + point.x; }, 0) / points.length,
      y: points.reduce(function (sum, point) { return sum + point.y; }, 0) / points.length
    };
  }

  function sideLabelPosition(P, Q) {
    return { x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 };
  }

  function drawLine(P, Q, attrs) {
    const node = createSvg('line', Object.assign({
      x1: P.x,
      y1: P.y,
      x2: Q.x,
      y2: Q.y,
      stroke: '#2a5bd7',
      'stroke-width': 4,
      'stroke-linecap': 'round'
    }, attrs || {}));
    stage.appendChild(node);
    return node;
  }

  function drawText(P, text, attrs) {
    const node = createSvg('text', Object.assign({
      x: P.x,
      y: P.y,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      'font-size': 54,
      'font-weight': 700,
      fill: '#1f2430'
    }, attrs || {}));
    if (moveMode && attrs && attrs['data-kind'] === moveMode.kind && attrs['data-id'] === moveMode.id) {
      node.classList.add('label-move-target');
    }
    node.textContent = text;
    stage.appendChild(node);
    return node;
  }

  function drawRatioLabel(P, ratio, attrs) {
    const group = createSvg('g', {});
    if (moveMode && attrs && attrs['data-kind'] === moveMode.kind && attrs['data-id'] === moveMode.id) {
      group.classList.add('label-move-target');
    }
    const size = Number(attrs && attrs['font-size']) || 42;
    const width = Math.max(size * 1.55, String(ratio.value).length * size * 0.82);
    const height = size * 1.35;
    let shape = null;
    if (ratio.mark === 'r') {
      shape = createSvg('ellipse', {
        cx: P.x,
        cy: P.y,
        rx: width / 2,
        ry: height / 2,
        fill: 'transparent',
        stroke: attrs.fill || '#2a5bd7',
        'stroke-width': 2
      });
    } else if (ratio.mark === 't') {
      const top = P.y - height / 2;
      const bottom = P.y + height / 2;
      shape = createSvg('polygon', {
        points: [
          P.x + ',' + top,
          (P.x - width / 2) + ',' + bottom,
          (P.x + width / 2) + ',' + bottom
        ].join(' '),
        fill: 'transparent',
        stroke: attrs.fill || '#2a5bd7',
        'stroke-width': 2
      });
    } else {
      shape = createSvg('rect', {
        x: P.x - width / 2,
        y: P.y - height / 2,
        width: width,
        height: height,
        rx: 7,
        ry: 7,
        fill: 'transparent',
        stroke: attrs.fill || '#2a5bd7',
        'stroke-width': 2
      });
    }
    const textAttrs = Object.assign({}, attrs || {});
    delete textAttrs.class;
    delete textAttrs['data-kind'];
    delete textAttrs['data-id'];
    const text = createSvg('text', Object.assign({
      x: P.x,
      y: P.y,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      'font-size': size,
      'font-weight': 700,
      fill: attrs.fill || '#2a5bd7'
    }, textAttrs));
    text.textContent = ratio.value;
    group.appendChild(shape);
    group.appendChild(text);
    stage.appendChild(group);
    return group;
  }

  function getPointName(id) {
    const raw = String(state.pointInputs[id] || '').trim();
    return raw || id;
  }

  function getPointLabelValue(id) {
    const raw = String(state.pointInputs[id] || '').trim();
    return raw || null;
  }

  function attachAngleHit(element, id) {
    if (!enabledLabels.angle) return;
    element.style.cursor = 'pointer';
    element.setAttribute('data-kind', 'angle');
    element.setAttribute('data-id', id);
    if (moveMode && moveMode.kind === 'angle' && moveMode.id === id) {
      element.classList.add('label-move-target');
    }
    element.addEventListener('click', function (event) {
      event.stopPropagation();
      if (moveMode) return;
      labelController.openEditSheet('angle', id);
    });
  }

  function attachPointHit(element, id) {
    if (!enabledLabels.point) return;
    element.style.cursor = 'pointer';
    element.setAttribute('data-kind', 'point');
    element.setAttribute('data-id', id);
    if (moveMode && moveMode.kind === 'point' && moveMode.id === id) {
      element.classList.add('label-move-target');
    }
    element.addEventListener('click', function (event) {
      event.stopPropagation();
      if (moveMode) return;
      labelController.openEditSheet('point', id);
    });
  }

  function attachSegmentHit(element, id) {
    if (!enabledLabels.segment) return;
    element.style.cursor = 'pointer';
    element.setAttribute('data-kind', 'segment');
    element.setAttribute('data-id', id);
    if (moveMode && moveMode.kind === 'segment' && moveMode.id === id) {
      element.classList.add('label-move-target');
    }
    element.addEventListener('click', function (event) {
      event.stopPropagation();
      if (moveMode) return;
      labelController.openEditSheet('segment', id);
    });
  }

  function attachAreaHit(element, id) {
    if (!enabledLabels.area) return;
    element.style.cursor = 'pointer';
    element.setAttribute('data-kind', 'area');
    element.setAttribute('data-id', id);
    if (moveMode && moveMode.kind === 'area' && moveMode.id === id) {
      element.classList.add('label-move-target');
    }
    element.addEventListener('click', function (event) {
      event.stopPropagation();
      if (moveMode) return;
      labelController.openEditSheet('area', id);
    });
  }

  function pathFromPoints(points) {
    return points.map(function (point, index) {
      return (index === 0 ? 'M ' : 'L ') + formatNumber(point.x) + ' ' + formatNumber(point.y);
    }).join(' ');
  }

  function eventToSvgPoint(event) {
    const rect = stage.getBoundingClientRect();
    const viewBox = stage.viewBox.baseVal;
    return {
      x: viewBox.x + (event.clientX - rect.left) * viewBox.width / rect.width,
      y: viewBox.y + (event.clientY - rect.top) * viewBox.height / rect.height
    };
  }

  function angleArcPoints(vertex, p1, p2, radius) {
    const a1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
    const a2 = Math.atan2(p2.y - vertex.y, p2.x - vertex.x);
    let delta = a2 - a1;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    const points = [];
    for (let i = 0; i <= 26; i += 1) {
      const angle = a1 + delta * (i / 26);
      points.push({ x: vertex.x + Math.cos(angle) * radius, y: vertex.y + Math.sin(angle) * radius });
    }
    return points;
  }

  function angleLabelPosition(P, vertex, Q, radius) {
    const a1 = Math.atan2(P.y - vertex.y, P.x - vertex.x);
    const a2 = Math.atan2(Q.y - vertex.y, Q.x - vertex.x);
    let delta = a2 - a1;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    const angle = a1 + delta / 2;
    return { x: vertex.x + Math.cos(angle) * radius, y: vertex.y + Math.sin(angle) * radius };
  }

  function getAngleText(id, points) {
    const raw = String(state.angleInputs[id] || '');
    if (!raw) return null;
    if (isRatioLabelValue(raw)) return parseRatioLabelInput(raw.slice(RATIO_LABEL_PREFIX.length));
    if (!isAnyNumericLabelValue(raw)) return raw;
    const config = ANGLE_LABELS[id];
    const degrees = angleDegrees(points[config.points[0]], points[config.points[1]], points[config.points[2]]);
    return formatAngleValue(degrees);
  }

  function getSegmentText(id, points) {
    const raw = String(state.segmentInputs[id] || '');
    if (!raw) return null;
    if (isRatioLabelValue(raw)) return parseRatioLabelInput(raw.slice(RATIO_LABEL_PREFIX.length));
    if (!isAnyNumericLabelValue(raw)) return raw;
    const config = SEGMENT_LABELS[id];
    const normalized = normalizedTriangleSide(id);
    if (isDecimalNumericLabelValue(raw)) return formatWithDrawSettings('segment', formatDecimalNumber(normalized));
    return formatWithDrawSettings('segment', formatSpecialNormalizedValue(normalized));
  }

  function getAreaText(id, points) {
    const raw = String(state.areaInputs[id] || '');
    if (!raw) return null;
    if (isRatioLabelValue(raw)) return parseRatioLabelInput(raw.slice(RATIO_LABEL_PREFIX.length));
    if (!isAnyNumericLabelValue(raw)) return raw;
    const normalized = normalizedTriangleArea();
    if (isDecimalNumericLabelValue(raw)) return formatWithDrawSettings('area', formatDecimalNumber(normalized));
    return formatWithDrawSettings('area', formatSpecialNormalizedValue(normalized));
  }

  function renderAreaHits(points) {
    Object.keys(AREA_LABELS).forEach(function (id) {
      const config = AREA_LABELS[id];
      const polygon = createSvg('polygon', {
        points: config.points.map(function (pointId) { return points[pointId].x + ',' + points[pointId].y; }).join(' '),
        fill: 'transparent',
        stroke: 'none'
      });
      attachAreaHit(polygon, id);
      stage.appendChild(polygon);
    });
  }

  function renderAreaLabels(points) {
    Object.keys(AREA_LABELS).forEach(function (id) {
      const config = AREA_LABELS[id];
      const labelText = getAreaText(id, points);
      if (!labelText) return;
      const base = centroid(config.points.map(function (pointId) { return points[pointId]; }));
      const position = getLabelPosition('area', id, base);
      const attrs = {
        class: 'shape-label area-label',
        'data-kind': 'area',
        'data-id': id,
        fill: getLabelColor('area', id),
        'font-size': 48 * getMathLabelScale('area', id)
      };
      const label = typeof labelText === 'object'
        ? drawRatioLabel(position, labelText, attrs)
        : drawText(position, labelText, attrs);
      attachAreaHit(label, id);
    });
  }

  function renderSegmentHits(points) {
    Object.keys(SEGMENT_LABELS).forEach(function (id) {
      const config = SEGMENT_LABELS[id];
      const P = points[config.points[0]];
      const Q = points[config.points[1]];
      const hit = drawLine(P, Q, {
        stroke: 'transparent',
        'stroke-width': 18
      });
      attachSegmentHit(hit, id);
    });
  }

  function renderSegmentLabels(points) {
    Object.keys(SEGMENT_LABELS).forEach(function (id) {
      const config = SEGMENT_LABELS[id];
      const labelText = getSegmentText(id, points);
      if (!labelText) return;
      const P = points[config.points[0]];
      const Q = points[config.points[1]];
      const position = getLabelPosition('segment', id, sideLabelPosition(P, Q));
      const attrs = {
        class: 'shape-label segment-label',
        'data-kind': 'segment',
        'data-id': id,
        fill: getLabelColor('segment', id),
        'font-size': 40 * getMathLabelScale('segment', id)
      };
      const label = typeof labelText === 'object'
        ? drawRatioLabel(position, labelText, attrs)
        : drawText(position, labelText, attrs);
      attachSegmentHit(label, id);
    });
  }

  function renderAngleHits(points) {
    Object.keys(ANGLE_LABELS).forEach(function (id) {
      const config = ANGLE_LABELS[id];
      const P = points[config.points[0]];
      const V = points[config.points[1]];
      const Q = points[config.points[2]];
      const angleValue = angleDegrees(P, V, Q);
      const kind = window.InstantGeometryMobileAngleOrnaments
        ? window.InstantGeometryMobileAngleOrnaments.normalizeAngleKind(state.angleKinds[id], angleValue)
        : state.angleKinds[id];
      const arc = angleArcPoints(V, P, Q, (config.parameter ? 62 : 50) * getAngleArcScale(id));
      if (kind !== state.angleKinds[id]) state.angleKinds[id] = kind;
      if (kind && kind !== 'hidden' && kind !== 'right') {
        const path = createSvg('path', {
          d: pathFromPoints(arc),
          fill: 'none',
          stroke: config.parameter ? '#687086' : '#9aa2b6',
          'stroke-width': config.parameter ? 3 : 2.4,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round'
        });
        attachAngleHit(path, id);
        stage.appendChild(path);
      }
      if (window.InstantGeometryMobileAngleOrnaments) {
        window.InstantGeometryMobileAngleOrnaments.drawAngleKind(stage, state.angleKinds[id], arc, V, { x: 500, y: 500 }, createSvg, { p1: P, p2: Q });
      }
      const hit = createSvg('path', {
        d: pathFromPoints(arc),
        fill: 'none',
        stroke: 'transparent',
        'stroke-width': 34,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round'
      });
      attachAngleHit(hit, id);
      stage.appendChild(hit);
    });
  }

  function renderAngleLabels(points) {
    Object.keys(ANGLE_LABELS).forEach(function (id) {
      const config = ANGLE_LABELS[id];
      const labelText = getAngleText(id, points);
      if (!labelText) return;
      const P = points[config.points[0]];
      const V = points[config.points[1]];
      const Q = points[config.points[2]];
      const position = getLabelPosition('angle', id, angleLabelPosition(P, V, Q, config.parameter ? 108 : 82));
      const attrs = {
        class: 'shape-label angle-label',
        'data-kind': 'angle',
        'data-id': id,
        fill: getLabelColor('angle', id),
        'font-size': (config.parameter ? 36 : 32) * getMathLabelScale('angle', id)
      };
      const label = typeof labelText === 'object'
        ? drawRatioLabel(position, labelText, attrs)
        : drawText(position, labelText, attrs);
      attachAngleHit(label, id);
    });
  }

  function computePoints(exteriorA, exteriorB, exteriorC) {
    const angleA = 180 - exteriorA;
    const angleB = 180 - exteriorB;
    const angleC = 180 - exteriorC;
    const base = 560;
    const A = { x: 0, y: 0 };
    const B = { x: base, y: 0 };
    const sideAC = base * Math.sin(toRadians(angleB)) / Math.sin(toRadians(angleC));
    const C = {
      x: Math.cos(toRadians(angleA)) * sideAC,
      y: -Math.sin(toRadians(angleA)) * sideAC
    };
    const ext = Math.max(130, base * 0.22);
    const D = pointOnRay(A, B, -ext);
    const E = pointOnRay(B, C, -ext);
    const F = pointOnRay(C, A, -ext);
    const raw = { A: A, B: B, C: C, D: D, E: E, F: F };
    const xs = Object.keys(raw).map(function (id) { return raw[id].x; });
    const ys = Object.keys(raw).map(function (id) { return raw[id].y; });
    const minX = Math.min.apply(null, xs);
    const maxX = Math.max.apply(null, xs);
    const minY = Math.min.apply(null, ys);
    const maxY = Math.max.apply(null, ys);
    const scale = Math.min(760 / Math.max(1, maxX - minX), 700 / Math.max(1, maxY - minY));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const points = {};
    Object.keys(raw).forEach(function (id) {
      points[id] = {
        x: 500 + (raw[id].x - cx) * scale,
        y: 500 + (raw[id].y - cy) * scale
      };
    });
    return { points: points, values: { DAC: exteriorA, EBA: exteriorB, FCB: exteriorC, BAC: angleA, ABC: angleB, BCA: angleC } };
  }

  function render() {
    try {
      const angleDAC = parseAngle(angleDACInput.value, '∠DAC');
      const angleEBA = parseAngle(angleEBAInput.value, '∠EBA');
      const angleFCB = parseAngle(angleFCBInput.value, '∠FCB');
      const sum = angleDAC + angleEBA + angleFCB;
      if (Math.abs(sum - 360) > 0.01) {
        throw new Error('∠DAC + ∠EBA + ∠FCB が 360° になるように入力してください。現在は ' + formatNumber(sum) + '° です。');
      }

      currentGeometry = computePoints(angleDAC, angleEBA, angleFCB);
      const points = currentGeometry.points;
      const A = points.A;
      const B = points.B;
      const C = points.C;
      const D = points.D;
      const E = points.E;
      const F = points.F;

      currentLabelBases = {};
      stage.innerHTML = '';
      stage.setAttribute('viewBox', '0 0 1000 1000');
      const mainArea = createSvg('polygon', {
        points: [A, B, C].map(function (p) { return p.x + ',' + p.y; }).join(' '),
        fill: hexToRgba(getLabelColor('area', 'ABC'), 0.12),
        stroke: hexToRgba(getLabelColor('area', 'ABC'), 0.45),
        'stroke-width': 1.5
      });
      attachAreaHit(mainArea, 'ABC');
      stage.appendChild(mainArea);

      drawLine(D, A, { stroke: '#7f8aa3', 'stroke-width': 3, 'stroke-dasharray': '9 7' });
      drawLine(E, B, { stroke: '#7f8aa3', 'stroke-width': 3, 'stroke-dasharray': '9 7' });
      drawLine(F, C, { stroke: '#7f8aa3', 'stroke-width': 3, 'stroke-dasharray': '9 7' });
      drawLine(A, B);
      drawLine(B, C);
      drawLine(C, A);

      [
        { id: 'A', point: A, label: { x: A.x - 34, y: A.y + 36 }, alwaysShowPoint: true },
        { id: 'B', point: B, label: { x: B.x + 38, y: B.y + 34 }, alwaysShowPoint: true },
        { id: 'C', point: C, label: { x: C.x + 2, y: C.y - 48 }, alwaysShowPoint: true },
        { id: 'D', point: D, label: { x: D.x - 32, y: D.y + 32 } },
        { id: 'E', point: E, label: { x: E.x - 34, y: E.y - 34 } },
        { id: 'F', point: F, label: { x: F.x + 34, y: F.y - 34 } }
      ].forEach(function (item) {
        const label = getPointLabelValue(item.id);
        const pointNode = createSvg('circle', {
          cx: item.point.x,
          cy: item.point.y,
          r: item.alwaysShowPoint || label ? 8 : 18,
          fill: item.alwaysShowPoint || label ? '#1f2430' : 'transparent'
        });
        attachPointHit(pointNode, item.id);
        stage.appendChild(pointNode);
        if (label) {
          const labelNode = drawText(getLabelPosition('point', item.id, item.label), label, {
            fill: getLabelColor('point', item.id),
            'font-size': 54 * getMathLabelScale('point', item.id)
          });
          attachPointHit(labelNode, item.id);
        }
      });

      renderSegmentHits(points);
      renderAngleHits(points);
      renderSegmentLabels(points);
      renderAngleLabels(points);
      renderAreaLabels(points);

      setStatus('∠DAC、∠EBA、∠FCB を外角として描画しました。', false);
    } catch (error) {
      stage.innerHTML = '';
      currentGeometry = null;
      setStatus(error.message || '描画に失敗しました。', true);
    }
  }

  function closeSheets() {
    if (editSheet) {
      editSheet.classList.remove('open');
      editSheet.setAttribute('aria-hidden', 'true');
    }
    saveSheet.classList.remove('open');
    saveSheet.setAttribute('aria-hidden', 'true');
    sheetBackdrop.classList.remove('open');
    if (sheetBody) sheetBody.innerHTML = '';
  }

  function updateMoveModeUi() {
    const active = Boolean(moveMode);
    document.body.classList.toggle('label-move-active', active);
    if (captureRoot) captureRoot.classList.toggle('label-move-active', active);
    moveToolbar.classList.toggle('open', active);
    moveToolbar.setAttribute('aria-hidden', active ? 'false' : 'true');
  }

  function openSheetForTarget(kind, id) {
    labelController.openEditSheet(kind, id);
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
    if (!currentLabelBases[labelKey(kind, id)]) {
      setStatus('ラベルを表示してから移動してください。', true);
      openSheetForTarget(kind, id);
      return;
    }
    const offset = getLabelOffset(kind, id);
    moveMode = {
      kind: kind,
      id: id,
      originalOffset: { x: offset.x, y: offset.y }
    };
    closeSheets();
    updateMoveModeUi();
    render();
  }

  function buildSelect(labelText, value, options) {
    return LabelEngine.buildSelect(labelText, value, options);
  }

  function buildRangeField(labelText, value, min, max, step, formatValue) {
    return LabelEngine.buildRangeField(labelText, value, min, max, step, formatValue);
  }

  function buildCheckbox(labelText, checked) {
    return LabelEngine.buildCheckbox(labelText, checked);
  }

  function buildLabelEditor(labelText, value, hasNumericMode) {
    return LabelEngine.buildLabelEditor(labelText, value, hasNumericMode);
  }

  function buildColorPalette(labelText, value) {
    return LabelEngine.buildColorPalette(labelText, value);
  }

  labelController = LabelEngine.createController({
    enabledLabels: enabledLabels,
    sheetTitle: sheetTitle,
    sheetBody: sheetBody,
    editSheet: editSheet,
    sheetBackdrop: sheetBackdrop,
    closeSheets: closeSheets,
    render: render,
    onMove: enterMoveMode,
    onError: function (error) {
      setStatus(error.message || '入力を確認してください。', true);
    },
    getModalSpec: function (kind) {
      return LabelEngine.getStandardModalSpec(kind);
    },
    getTitle: function (kind, id) {
      if (kind === 'point') return getPointName(id);
      if (kind === 'segment') return '線分 ' + id;
      if (kind === 'area') return AREA_LABELS[id] ? AREA_LABELS[id].name : '面積';
      return '∠' + id;
    },
    getLabelValue: getLabelValue,
    setLabelValue: setLabelValue,
    getColor: getLabelColor,
    setColor: setLabelColor,
    getLabelScale: getMathLabelScale,
    setLabelScale: setMathLabelScale,
    getAngleArcScale: getAngleArcScale,
    setAngleArcScale: setAngleArcScale,
    hasGuideField: function (kind) {
      return kind === 'segment';
    },
    getGuideVisible: function (kind, id) {
      return kind === 'segment' ? state.segmentArcVisible[id] !== false : false;
    },
    setGuideVisible: function (kind, id, value) {
      if (kind === 'segment') state.segmentArcVisible[id] = value;
    },
    buildSegmentKindSelect: function (id, buildSelectFn) {
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
    },
    buildAngleKindSelect: function (id, buildSelectFn, body) {
      if (!currentGeometry || !ANGLE_LABELS[id]) return null;
      const config = ANGLE_LABELS[id];
      const points = currentGeometry.points;
      const angleValue = angleDegrees(points[config.points[0]], points[config.points[1]], points[config.points[2]]);
      if (window.InstantGeometryMobileAngleOrnaments) {
        return window.InstantGeometryMobileAngleOrnaments.appendAngleKindSelect(
          body,
          buildSelectFn,
          state.angleKinds[id] || 'hidden',
          angleValue
        );
      }
      const builtAngle = buildSelectFn(LabelEngine.getStandardModalSpec('angle').angleArcLabel, state.angleKinds[id] || 'hidden', [
        { value: 'hidden', label: '非表示' },
        { value: 'plain', label: '角弧のみ' }
      ]);
      body.appendChild(builtAngle.field);
      return builtAngle.select;
    },
    setKind: function (kind, id, value) {
      if (kind === 'segment') state.segmentKinds[id] = value;
      else if (kind === 'angle') state.angleKinds[id] = value;
    }
  });

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
      link.download = format === 'transparent' ? 'triangle-exterior-angle-sum-transparent.png' : 'triangle-exterior-angle-sum.png';
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
    pdf.save('triangle-exterior-angle-sum.pdf');
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

  function registerDrawSettingsSections() {
    if (!window.InstantGeometryDrawSettings || typeof window.InstantGeometryDrawSettings.addSection !== 'function') return;
    if (window.InstantGeometryDrawSettings.hasGlobalDecimalPlaces) return;
    window.InstantGeometryDrawSettings.addSection('exterior-angle-sum-decimal-places', {
      render: function () {
        const value = String(clampDecimalPlaces(state.decimalPlaces));
        return [
          '<div class="ig-settings-group">',
          '<label class="ig-settings-label" for="exteriorAngleSumDecimalPlaces">小数表示</label>',
          '<select class="ig-settings-select" id="exteriorAngleSumDecimalPlaces">',
          '<option value="0"' + (value === '0' ? ' selected' : '') + '>整数</option>',
          '<option value="1"' + (value === '1' ? ' selected' : '') + '>小数第1位</option>',
          '<option value="2"' + (value === '2' ? ' selected' : '') + '>小数第2位</option>',
          '<option value="3"' + (value === '3' ? ' selected' : '') + '>小数第3位</option>',
          '<option value="4"' + (value === '4' ? ' selected' : '') + '>小数第4位</option>',
          '<option value="5"' + (value === '5' ? ' selected' : '') + '>小数第5位</option>',
          '<option value="6"' + (value === '6' ? ' selected' : '') + '>小数第6位</option>',
          '</select>',
          '<p class="ig-settings-hint">数値（小数）を選んだラベルや、小数表示が必要な値に使う桁数です。</p>',
          '</div>'
        ].join('');
      },
      save: function (root) {
        const select = root.querySelector('#exteriorAngleSumDecimalPlaces');
        if (!select) return;
        state.decimalPlaces = setActiveDecimalPlaces(select.value);
      }
    });
  }

  angleDACInput.addEventListener('input', render);
  angleEBAInput.addEventListener('input', render);
  angleFCBInput.addEventListener('input', render);
  backBtn.addEventListener('click', function () { window.history.back(); });
  saveBtn.addEventListener('click', function () { if (!moveMode) openSaveSheet(); });
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

  stage.addEventListener('pointerdown', function (event) {
    if (!moveMode) return;
    event.preventDefault();
    const start = eventToSvgPoint(event);
    const offset = getLabelOffset(moveMode.kind, moveMode.id);
    moveDrag = {
      pointerId: event.pointerId,
      start: start,
      baseOffset: { x: offset.x, y: offset.y }
    };
    stage.setPointerCapture(event.pointerId);
  });

  stage.addEventListener('pointermove', function (event) {
    if (!moveMode || !moveDrag) return;
    const point = eventToSvgPoint(event);
    const offset = getLabelOffset(moveMode.kind, moveMode.id);
    offset.x = moveDrag.baseOffset.x + point.x - moveDrag.start.x;
    offset.y = moveDrag.baseOffset.y + point.y - moveDrag.start.y;
    render();
  });

  stage.addEventListener('pointerup', function (event) {
    if (!moveDrag || moveDrag.pointerId !== event.pointerId) return;
    moveDrag = null;
    try { stage.releasePointerCapture(event.pointerId); } catch (_) {}
  });

  moveCancelBtn.addEventListener('click', function () {
    finishMoveMode(true);
  });

  moveDoneBtn.addEventListener('click', function () {
    finishMoveMode(false);
  });

  document.addEventListener('keydown', function (event) {
    if (!moveMode) return;
    if (event.key === 'Escape') finishMoveMode(true);
    if (event.key === 'Enter') finishMoveMode(false);
  });

  document.addEventListener('instant-geometry-draw-settings:ready', function () {
    registerDrawSettingsSections();
    render();
  });
  document.addEventListener('instant-geometry-settings:changed', function () {
    if (window.InstantGeometryDrawSettings && typeof window.InstantGeometryDrawSettings.getDecimalPlaces === 'function') {
      state.decimalPlaces = setActiveDecimalPlaces(window.InstantGeometryDrawSettings.getDecimalPlaces());
    }
    render();
  });

  registerDrawSettingsSections();
  setActiveDecimalPlaces(state.decimalPlaces);
  render();
})();
