(function () {
  'use strict';

  const allPointIds = 'ABCDEFGHIJKLMNOPQRST'.split('');
  const shapeMeta = { name: '正N角形', slug: 'regular-polygon' };
  const exportAspects = [
    { label: '1:1', value: 1 },
    { label: '1:√2', value: 1 / Math.SQRT2 },
    { label: '√2:1', value: Math.SQRT2 }
  ];
  const unitOptions = ['', 'cm', 'm', 'km'];

  const inputElements = Array.from(document.querySelectorAll('[data-polygon-input]')).reduce(function (acc, element) {
    acc[element.id] = element;
    return acc;
  }, {});

  const statusBox = document.getElementById('statusBox');
  const generalLabelToggleGrid = document.getElementById('generalLabelToggleGrid');
  const specialLabelToggleGrid = document.getElementById('specialLabelToggleGrid');
  const leftDock = document.getElementById('leftDock');
  const rightDock = document.getElementById('rightDock');
  const leftToggle = document.getElementById('dockToggleBtn');
  const rightToggle = document.getElementById('rightDockToggleBtn');
  const ratioBtn = document.getElementById('ratioBtn');
  const resetBtn = document.getElementById('resetBtn');
  const angleModeBtn = document.getElementById('angleModeBtn');
  const unitBtn = document.getElementById('unitBtn');
  const pageBackBtn = document.getElementById('pageBackBtn');
  const downloadButtons = document.querySelectorAll('[data-download-format]');
  const box = document.getElementById('box');
  const exportBackdrop = document.getElementById('exportBackdrop');
  const exportFrame = document.getElementById('exportFrame');

  const board = JXG.JSXGraph.initBoard('box', {
    boundingbox: [-6, 6, 6, -6],
    axis: false,
    showNavigation: false,
    showInfobox: false,
    showCopyright: false,
    keepaspectratio: true
  });

  const labelLayer = document.createElement('div');
  labelLayer.id = 'labelLayer';
  labelLayer.setAttribute('aria-hidden', 'true');
  box.appendChild(labelLayer);

  const pointLabelText = {};
  allPointIds.forEach(function (id) { pointLabelText[id] = id; });
  const labelState = { point: {}, segment: {}, angle: {}, angleMark: {}, rightAngleMark: {}, area: { main: false } };
  const labelFontDefaults = { point: {}, segment: {}, angle: {}, angleMark: {}, rightAngleMark: {}, area: { main: 48 } };
  const labelFontSize = { point: {}, segment: {}, angle: {}, angleMark: {}, rightAngleMark: {}, area: { main: 48 } };
  const styleDefaults = { point: {}, segment: {}, angle: {}, angleMark: {}, rightAngleMark: {}, area: { main: { color: '#25603b', rotation: 0 } } };
  const labelStyleState = { point: {}, segment: {}, angle: {}, angleMark: {}, rightAngleMark: {}, area: { main: { color: '#25603b', rotation: 0 } } };
  const labelPositions = { point: {}, segment: {}, angle: {}, angleMark: {}, rightAngleMark: {}, area: { main: null } };
  const customLabelText = { segment: {}, angle: {}, area: { main: '' } };
  const angleMarkerMode = {};
  const rightAngleMarkerMode = {};
  const segmentArcMode = {};
  const segmentLineMode = {};

  let currentGeometry = null;
  let currentLabelAnchors = [];
  let currentSelectionOverlay = null;
  let selectedLabel = null;
  let selectedFigure = false;
  let dragState = null;
  let renderRafId = null;
  let exportAspectIndex = 0;
  let angleMode = 'degrees';
  let unitIndex = 1;
  let zoomScale = 1;
  let isDockCollapsed = false;
  let isRightDockCollapsed = false;
  let isPaletteOpen = false;
  let lastFitSignature = '';
  let figureState = { color: '#2a5bd7', rotation: 0, scale: 1, offset: { x: 0, y: 0 } };

  function style(color) { return { color: color, rotation: 0 }; }
  function setStatus(message, isError) { statusBox.textContent = message; statusBox.classList.toggle('error', !!isError); }
  function updateRatioButton() { ratioBtn.textContent = '画面比 ' + exportAspects[exportAspectIndex].label; }
  function updateUnitButton() { unitBtn.textContent = unitOptions[unitIndex] ? '長さ' + unitOptions[unitIndex] : '単位なし'; }
  function updateAngleModeButton() { angleModeBtn.textContent = angleMode === 'degrees' ? '度数法' : '弧度法'; }
  function updateDockToggleButtons() {
    leftToggle.textContent = isDockCollapsed ? '›' : '‹';
    leftToggle.setAttribute('aria-expanded', String(!isDockCollapsed));
    rightToggle.textContent = isRightDockCollapsed ? '‹' : '›';
    rightToggle.setAttribute('aria-expanded', String(!isRightDockCollapsed));
  }

  function evaluateExpression(raw) {
    const normalized = String(raw || '').trim().replace(/\s+/g, '').replace(/π/g, 'pi').replace(/√/g, 'sqrt').replace(/(\d+(?:\.\d+)?)deg\b/gi, 'deg($1)');
    if (!normalized) throw new Error('値を入力してください。');
    if (!/^[0-9+\-*/().,a-zA-Z]+$/.test(normalized)) throw new Error('使用できない文字が含まれています。');
    const scope = { pi: Math.PI, e: Math.E, sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, deg: function (value) { return value * Math.PI / 180; } };
    try {
      const value = Function('s', '"use strict";const {pi,e,sqrt,sin,cos,tan,deg}=s;return (' + normalized + ');')(scope);
      if (!Number.isFinite(value) || value <= 0) throw new Error('0より大きい値を入力してください。');
      return value;
    } catch (_) {
      throw new Error('式を読み取れませんでした。');
    }
  }

  function getInputValue(id) { return evaluateExpression(inputElements[id].value); }
  function parseVertexCount() {
    const raw = String(inputElements.vertexCount.value || '').trim();
    if (!/^\d+$/.test(raw)) throw new Error('Nは 3 から 20 の整数で入力してください。');
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 3 || value > 20) throw new Error('Nは 3 から 20 の整数で入力してください。');
    return value;
  }
  function formatNumber(value) {
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  }
  function appendUnit(text, square) {
    const unit = unitOptions[unitIndex];
    return unit ? (text + unit + (square ? '²' : '')) : text;
  }
  function hexToRgba(hex, alpha) {
    const normalized = String(hex || '#2a5bd7').replace('#', '');
    const source = normalized.length === 3 ? normalized.split('').map(function (s) { return s + s; }).join('') : normalized;
    const value = parseInt(source, 16);
    return 'rgba(' + ((value >> 16) & 255) + ',' + ((value >> 8) & 255) + ',' + (value & 255) + ',' + alpha + ')';
  }
  function rotatePoint(point, center, angleDeg) {
    const rad = angleDeg * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos };
  }
  function transformBasePoints(basePoints) {
    const points = {};
    Object.keys(basePoints).forEach(function (key) {
      const scaled = { x: basePoints[key].x * figureState.scale, y: basePoints[key].y * figureState.scale };
      const rotated = rotatePoint(scaled, { x: 0, y: 0 }, figureState.rotation);
      points[key] = { x: rotated.x + figureState.offset.x, y: rotated.y + figureState.offset.y };
    });
    return { points: points, centroid: { x: figureState.offset.x, y: figureState.offset.y } };
  }
  function polygonArea(points) {
    let sum = 0;
    for (let i = 0; i < points.length; i += 1) {
      const p = points[i];
      const q = points[(i + 1) % points.length];
      sum += p.x * q.y - q.x * p.y;
    }
    return Math.abs(sum) / 2;
  }
  function segmentLength(P, Q) { return Math.hypot(P.x - Q.x, P.y - Q.y); }

  function getPointIds(count) { return allPointIds.slice(0, count); }
  function getSegmentIds(pointIds) {
    return pointIds.map(function (id, index) { return id + pointIds[(index + 1) % pointIds.length]; });
  }
  function getPointLabelToken(id) {
    const raw = String(pointLabelText[id] || id).trim().toUpperCase();
    return /^[A-Z]+$/.test(raw) ? raw : id;
  }
  function getAreaName(pointIds) { return '多角形' + pointIds.map(getPointLabelToken).join(''); }
  function getSegmentName(id) { return id.split('').map(getPointLabelToken).join(''); }
  function getAngleName(id) { return '∠' + getPointLabelToken(id); }
  function normalizeAngleMarkerInput(input) { const value = String(input || '').trim(); return /^[0-7]$/.test(value) ? Number(value) : null; }
  function normalizeRightAngleMarkerInput(input) { const value = String(input || '').trim(); return value === '0' || value === '1' ? Number(value) : null; }
  function getLabelStyle(type, id) {
    labelStyleState[type] = labelStyleState[type] || {};
    if (!labelStyleState[type][id]) {
      labelStyleState[type][id] = { color: type === 'segmentObject' ? '#2a5bd7' : '#2a5bd7', rotation: 0 };
    }
    return labelStyleState[type][id];
  }
  function registerSegmentObjectAnchor(type, id, start, end) {
    const screenStart = userToScreenPoint(start);
    const screenEnd = userToScreenPoint(end);
    const pad = 8;
    currentLabelAnchors.push({
      type: type,
      id: id,
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
      screenRect: {
        left: Math.min(screenStart.x, screenEnd.x) - pad,
        right: Math.max(screenStart.x, screenEnd.x) + pad,
        top: Math.min(screenStart.y, screenEnd.y) - pad,
        bottom: Math.max(screenStart.y, screenEnd.y) + pad
      },
      fontSize: 16,
      rotation: Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI,
      color: getLabelStyle(type, id).color
    });
  }

  function ensurePointState(id) {
    if (!(id in labelState.point)) labelState.point[id] = true;
    if (!(id in labelState.angle)) labelState.angle[id] = false;
    if (!(id in labelState.angleMark)) labelState.angleMark[id] = false;
    if (!(id in labelState.rightAngleMark)) labelState.rightAngleMark[id] = false;
    if (!(id in labelFontDefaults.point)) labelFontDefaults.point[id] = 36;
    if (!(id in labelFontDefaults.angle)) labelFontDefaults.angle[id] = 28;
    if (!(id in labelFontDefaults.angleMark)) labelFontDefaults.angleMark[id] = 26;
    if (!(id in labelFontDefaults.rightAngleMark)) labelFontDefaults.rightAngleMark[id] = 26;
    if (!(id in labelFontSize.point)) labelFontSize.point[id] = labelFontDefaults.point[id];
    if (!(id in labelFontSize.angle)) labelFontSize.angle[id] = labelFontDefaults.angle[id];
    if (!(id in labelFontSize.angleMark)) labelFontSize.angleMark[id] = labelFontDefaults.angleMark[id];
    if (!(id in labelFontSize.rightAngleMark)) labelFontSize.rightAngleMark[id] = labelFontDefaults.rightAngleMark[id];
    if (!(id in styleDefaults.point)) styleDefaults.point[id] = style('#1f2430');
    if (!(id in styleDefaults.angle)) styleDefaults.angle[id] = style('#687086');
    if (!(id in styleDefaults.angleMark)) styleDefaults.angleMark[id] = style('#687086');
    if (!(id in styleDefaults.rightAngleMark)) styleDefaults.rightAngleMark[id] = style('#111111');
    if (!(id in labelStyleState.point)) labelStyleState.point[id] = JSON.parse(JSON.stringify(styleDefaults.point[id]));
    if (!(id in labelStyleState.angle)) labelStyleState.angle[id] = JSON.parse(JSON.stringify(styleDefaults.angle[id]));
    if (!(id in labelStyleState.angleMark)) labelStyleState.angleMark[id] = JSON.parse(JSON.stringify(styleDefaults.angleMark[id]));
    if (!(id in labelStyleState.rightAngleMark)) labelStyleState.rightAngleMark[id] = JSON.parse(JSON.stringify(styleDefaults.rightAngleMark[id]));
    if (!(id in labelPositions.point)) labelPositions.point[id] = null;
    if (!(id in labelPositions.angle)) labelPositions.angle[id] = null;
    if (!(id in labelPositions.angleMark)) labelPositions.angleMark[id] = null;
    if (!(id in labelPositions.rightAngleMark)) labelPositions.rightAngleMark[id] = null;
    if (!(id in customLabelText.angle)) customLabelText.angle[id] = '';
    if (!(id in angleMarkerMode)) angleMarkerMode[id] = 0;
    if (!(id in rightAngleMarkerMode)) rightAngleMarkerMode[id] = 0;
  }
  function ensureSegmentState(id) {
    if (!(id in labelState.segment)) labelState.segment[id] = true;
    if (!(id in labelFontDefaults.segment)) labelFontDefaults.segment[id] = 30;
    if (!(id in labelFontSize.segment)) labelFontSize.segment[id] = labelFontDefaults.segment[id];
    if (!(id in styleDefaults.segment)) styleDefaults.segment[id] = style('#2a5bd7');
    if (!(id in labelStyleState.segment)) labelStyleState.segment[id] = JSON.parse(JSON.stringify(styleDefaults.segment[id]));
    if (!(id in labelPositions.segment)) labelPositions.segment[id] = null;
    if (!(id in customLabelText.segment)) customLabelText.segment[id] = '';
    if (!(id in segmentArcMode)) segmentArcMode[id] = 1;
    if (!(id in segmentLineMode)) segmentLineMode[id] = 1;
  }
  function ensureStateFor(pointIds) {
    pointIds.forEach(ensurePointState);
    getSegmentIds(pointIds).forEach(ensureSegmentState);
  }

  function getLabelPosition(type, id, basePosition) {
    const stored = labelPositions[type][id];
    if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) return stored;
    labelPositions[type][id] = { x: basePosition.x, y: basePosition.y };
    return labelPositions[type][id];
  }
  function getLabelBounds(anchor) {
    const padPx = 6;
    const widthPx = anchor.screenRect ? Math.max(10, (anchor.screenRect.right - anchor.screenRect.left) + padPx * 2) : Math.max(10, String(anchor.text || '').length * anchor.fontSize * 0.56) + padPx * 2;
    const heightPx = anchor.screenRect ? Math.max(10, (anchor.screenRect.bottom - anchor.screenRect.top) + padPx * 2) : Math.max(10, anchor.fontSize) + padPx * 2;
    const width = widthPx / Math.max(Math.abs(board.unitX), 1e-6);
    const height = heightPx / Math.max(Math.abs(board.unitY), 1e-6);
    const center = { x: anchor.x, y: anchor.y };
    return {
      center: center,
      width: width,
      height: height,
      corners: {
        topLeft: rotatePoint({ x: center.x - width / 2, y: center.y + height / 2 }, center, anchor.rotation),
        topRight: rotatePoint({ x: center.x + width / 2, y: center.y + height / 2 }, center, anchor.rotation),
        bottomRight: rotatePoint({ x: center.x + width / 2, y: center.y - height / 2 }, center, anchor.rotation),
        bottomLeft: rotatePoint({ x: center.x - width / 2, y: center.y - height / 2 }, center, anchor.rotation)
      }
    };
  }
  function userToScreenPoint(point) {
    return { x: board.origin.scrCoords[1] + point.x * board.unitX, y: board.origin.scrCoords[2] - point.y * board.unitY };
  }
  function createSelectableText(position, text, fontSize, labelKey, options) {
    return window.InstantGeometrySharedLabels.createSelectableText({
      board: board,
      labelLayer: labelLayer,
      currentLabelAnchors: currentLabelAnchors,
      getLabelStyle: getLabelStyle,
      position: position,
      text: text,
      fontSize: fontSize,
      labelKey: labelKey,
      options: options
    });
  }

  function getBaseRegularPolygon() {
    const radius = getInputValue('radiusLen');
    const vertexCount = parseVertexCount();
    const side = 2 * radius * Math.sin(Math.PI / vertexCount);
    const pointIds = getPointIds(vertexCount);
    const basePoints = {};
    const startAngle = -Math.PI / 2;
    pointIds.forEach(function (id, index) {
      const angle = startAngle + (Math.PI * 2 * index / vertexCount);
      basePoints[id] = { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
    });
    const points = pointIds.map(function (id) { return basePoints[id]; });
    const xs = points.map(function (p) { return p.x; });
    const ys = points.map(function (p) { return p.y; });
    return {
      vertexCount: vertexCount,
      pointIds: pointIds,
      segmentIds: getSegmentIds(pointIds),
      basePoints: basePoints,
      baseBounds: { width: Math.max.apply(null, xs) - Math.min.apply(null, xs), height: Math.max.apply(null, ys) - Math.min.apply(null, ys) },
      side: side,
      area: polygonArea(points)
    };
  }

  function getGeometryFromInputs() {
    const base = getBaseRegularPolygon();
    ensureStateFor(base.pointIds);
    const transformed = transformBasePoints(base.basePoints);
    return {
      vertexCount: base.vertexCount,
      pointIds: base.pointIds,
      segmentIds: base.segmentIds,
      points: transformed.points,
      centroid: transformed.centroid,
      side: base.side * figureState.scale,
      area: base.area * figureState.scale * figureState.scale,
      baseBounds: { width: base.baseBounds.width * figureState.scale, height: base.baseBounds.height * figureState.scale }
    };
  }

  function getAngleData(id, geometry) {
    const index = geometry.pointIds.indexOf(id);
    const prevId = geometry.pointIds[(index - 1 + geometry.pointIds.length) % geometry.pointIds.length];
    const nextId = geometry.pointIds[(index + 1) % geometry.pointIds.length];
    return { vertex: geometry.points[id], p1: geometry.points[prevId], p2: geometry.points[nextId] };
  }
  function getAngleMeasureDegrees(id, geometry) {
    const data = getAngleData(id, geometry);
    const v1x = data.p1.x - data.vertex.x;
    const v1y = data.p1.y - data.vertex.y;
    const v2x = data.p2.x - data.vertex.x;
    const v2y = data.p2.y - data.vertex.y;
    const len1 = Math.hypot(v1x, v1y) || 1;
    const len2 = Math.hypot(v2x, v2y) || 1;
    const dot = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (len1 * len2)));
    return Math.acos(dot) * 180 / Math.PI;
  }
  function isRightAngleId(id, geometry) { return Math.abs(getAngleMeasureDegrees(id, geometry) - 90) < 1e-4; }
  function getPerpendicularDefault(P, Q, centroid, offset) {
    const mid = { x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 };
    const dx = Q.x - P.x;
    const dy = Q.y - P.y;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    const toCentroid = { x: centroid.x - mid.x, y: centroid.y - mid.y };
    if (nx * toCentroid.x + ny * toCentroid.y > 0) { nx *= -1; ny *= -1; }
    return { x: mid.x + nx * offset, y: mid.y + ny * offset };
  }
  function getPointDefault(centroid, vertex) { return { x: (vertex.x * 10 - centroid.x) / 9, y: (vertex.y * 10 - centroid.y) / 9 }; }
  function getAngleDefault(id, geometry) {
    const data = getAngleData(id, geometry);
    const d1 = { x: data.p1.x - data.vertex.x, y: data.p1.y - data.vertex.y };
    const d2 = { x: data.p2.x - data.vertex.x, y: data.p2.y - data.vertex.y };
    const l1 = Math.hypot(d1.x, d1.y) || 1;
    const l2 = Math.hypot(d2.x, d2.y) || 1;
    const u1 = { x: d1.x / l1, y: d1.y / l1 };
    const u2 = { x: d2.x / l2, y: d2.y / l2 };
    let bisector = { x: u1.x + u2.x, y: u1.y + u2.y };
    const blen = Math.hypot(bisector.x, bisector.y);
    if (blen < 1e-6) bisector = { x: -u1.y, y: u1.x };
    else bisector = { x: bisector.x / blen, y: bisector.y / blen };
    return { x: data.vertex.x + bisector.x * geometry.side * 0.23, y: data.vertex.y + bisector.y * geometry.side * 0.23 };
  }
  function getDefaultPosition(type, id, geometry) {
    const G = geometry.centroid;
    if (type === 'point') return getPointDefault(G, geometry.points[id]);
    if (type === 'segment') {
      const P = geometry.points[id.charAt(0)];
      const Q = geometry.points[id.charAt(1)];
      return getPerpendicularDefault(P, Q, G, geometry.side * 0.18);
    }
    if (type === 'angle') return getAngleDefault(id, geometry);
    return { x: G.x, y: G.y };
  }
  function getCustomAngleText(id, fallback) {
    const custom = window.InstantGeometrySharedLabelConfig.normalizeCustomLabelInput(customLabelText.angle[id]);
    return custom ? window.InstantGeometrySharedLabelConfig.formatAngleCustomText(custom, angleMode) : fallback;
  }
  function getCustomSegmentText(id, fallback) {
    const custom = window.InstantGeometrySharedLabelConfig.normalizeCustomLabelInput(customLabelText.segment[id]);
    return custom ? appendUnit(custom, false) : appendUnit(fallback, false);
  }
  function getCustomAreaText(pointIds, fallback) {
    const custom = window.InstantGeometrySharedLabelConfig.normalizeCustomLabelInput(customLabelText.area.main);
    return custom ? appendUnit(custom, true) : appendUnit(fallback, true);
  }
  function getLabelText(type, id, geometry) {
    if (type === 'point') return getPointLabelToken(id);
    if (type === 'segment') return getCustomSegmentText(id, formatNumber(segmentLength(geometry.points[id.charAt(0)], geometry.points[id.charAt(1)])));
    if (type === 'angle') {
      const degrees = getAngleMeasureDegrees(id, geometry);
      const base = angleMode === 'degrees' ? (formatNumber(degrees) + '°') : formatNumber(degrees * Math.PI / 180);
      return getCustomAngleText(id, base);
    }
    return getCustomAreaText(geometry.pointIds, formatNumber(geometry.area));
  }
  function getGeneralConfigs(geometry) {
    return geometry.pointIds.map(function (id) { return { type: 'point', id: id }; })
      .concat(geometry.segmentIds.map(function (id) { return { type: 'segment', id: id }; }))
      .concat(geometry.pointIds.map(function (id) { return { type: 'angle', id: id }; }))
      .concat([{ type: 'area', id: 'main' }]);
  }
  function getToggleLabel(config, geometry) {
    if (config.type === 'point') return getPointLabelToken(config.id);
    if (config.type === 'segment') return getSegmentName(config.id);
    if (config.type === 'angle') return getAngleName(config.id);
    return getAreaName(geometry.pointIds);
  }
  function resetSingleLabel(type, id) {
    labelPositions[type][id] = null;
    labelFontSize[type][id] = labelFontDefaults[type][id];
    labelStyleState[type][id] = JSON.parse(JSON.stringify(styleDefaults[type][id]));
    if (customLabelText[type] && Object.prototype.hasOwnProperty.call(customLabelText[type], id)) customLabelText[type][id] = '';
  }
  function renderLabelToggleButtons() {
    generalLabelToggleGrid.innerHTML = '';
    specialLabelToggleGrid.innerHTML = '';
    const uiCount = (function () {
      const raw = String(inputElements.vertexCount.value || '').trim();
      const n = /^\d+$/.test(raw) ? Number(raw) : 6;
      return Math.max(3, Math.min(20, Number.isFinite(n) ? n : 6));
    })();
    const geometryStub = { pointIds: getPointIds(uiCount), segmentIds: getSegmentIds(getPointIds(uiCount)) };
    ensureStateFor(geometryStub.pointIds);
    getGeneralConfigs(geometryStub).forEach(function (config) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'download-btn btn-bd';
      if (!labelState[config.type][config.id]) button.style.opacity = '0.55';
      button.textContent = getToggleLabel(config, geometryStub);
      button.setAttribute('aria-pressed', String(!!labelState[config.type][config.id]));
      button.addEventListener('click', function () {
        labelState[config.type][config.id] = !labelState[config.type][config.id];
        if (!labelState[config.type][config.id] && selectedLabel && selectedLabel.type === config.type && selectedLabel.id === config.id) { selectedLabel = null; isPaletteOpen = false; }
        if (labelState[config.type][config.id]) resetSingleLabel(config.type, config.id);
        renderLabelToggleButtons();
        render();
      });
      button.addEventListener('contextmenu', async function (event) {
        event.preventDefault();
        if (config.type === 'point') {
          const response = await window.InstantGeometrySharedLabelConfig.promptSingleText({ title: '点ラベル設定', firstLabel: '文字（A-Z のみ）', value: getPointLabelToken(config.id) });
          if (response === null) return;
          const normalized = String(response).trim().toUpperCase();
          if (!normalized) pointLabelText[config.id] = config.id;
          else if (/^[A-Z]+$/.test(normalized)) pointLabelText[config.id] = normalized.slice(0, 12);
          else { setStatus('点ラベルは英字大文字（A-Z）のみ入力できます。', true); return; }
          renderLabelToggleButtons();
          render();
          return;
        }
        if (config.type === 'segment') {
          const response = await window.InstantGeometrySharedLabelConfig.promptTripleSetting({
            title: '線分ラベル設定',
            firstLabel: '線分表示（0:線分を非表示 / 1:線分を表示）',
            firstValue: String(segmentLineMode[config.id]),
            secondLabel: '弧表示（0:弧を非表示 / 1:弧を表示）',
            secondValue: String(segmentArcMode[config.id]),
            thirdLabel: '文字（空欄で数値表示）',
            thirdValue: customLabelText.segment[config.id] || '',
            firstBinary: true,
            secondBinary: true
          });
          if (response === null) return;
          const lineMode = window.InstantGeometrySharedOrnaments.normalizeSegmentArcInput(response.first);
          const arcMode = window.InstantGeometrySharedOrnaments.normalizeSegmentArcInput(response.second);
          if (lineMode === null) { setStatus('線分表示は「0 / 1」で指定してください。', true); return; }
          if (arcMode === null) { setStatus('線分ラベルの弧表示は「0 / 1」で指定してください。', true); return; }
          segmentLineMode[config.id] = lineMode;
          segmentArcMode[config.id] = arcMode;
          customLabelText.segment[config.id] = response.third;
          render();
          return;
        }
        if (config.type === 'angle') {
          const geometry = currentGeometry || getGeometryFromInputs();
          const canUseRightMarker = isRightAngleId(config.id, geometry);
          const response = await window.InstantGeometrySharedLabelConfig.promptTripleSetting({
            title: '角ラベル設定',
            firstLabel: '角マーク（0:なし / 1:記号なし / 2:○ / 3:| / 4:= / 5:× / 6:△ / 7:塗）',
            firstValue: String(angleMarkerMode[config.id]),
            secondLabel: '文字（空欄で数値表示）',
            secondValue: customLabelText.angle[config.id] || '',
            thirdLabel: '直角マーク（0:非表示 / 1:表示）',
            thirdValue: canUseRightMarker ? String(rightAngleMarkerMode[config.id]) : '90°以外は設定不可',
            thirdDisabled: !canUseRightMarker
          });
          if (response === null) return;
          const mode = normalizeAngleMarkerInput(response.first);
          if (mode === null) { setStatus('角マークは「0 / 1 / 2 / 3 / 4 / 5 / 6 / 7」で指定してください。', true); return; }
          angleMarkerMode[config.id] = mode;
          customLabelText.angle[config.id] = response.second;
          if (canUseRightMarker) {
            const rightMode = normalizeRightAngleMarkerInput(response.third);
            if (rightMode === null) { setStatus('直角マークは「0 / 1」で指定してください。', true); return; }
            rightAngleMarkerMode[config.id] = rightMode;
          } else {
            rightAngleMarkerMode[config.id] = 0;
          }
          labelState.angleMark[config.id] = mode !== 0;
          labelState.rightAngleMark[config.id] = rightAngleMarkerMode[config.id] !== 0;
          if (!labelState.angleMark[config.id] && selectedLabel && selectedLabel.type === 'angleMark' && selectedLabel.id === config.id) selectedLabel = null;
          if (!labelState.rightAngleMark[config.id] && selectedLabel && selectedLabel.type === 'rightAngleMark' && selectedLabel.id === config.id) selectedLabel = null;
          if (labelState.angleMark[config.id]) resetSingleLabel('angleMark', config.id);
          if (labelState.rightAngleMark[config.id]) resetSingleLabel('rightAngleMark', config.id);
          render();
          return;
        }
        if (config.type === 'area') {
          const response = await window.InstantGeometrySharedLabelConfig.promptSingleText({ title: '面積ラベル設定', firstLabel: '文字（空欄で数値表示）', value: customLabelText.area.main || '' });
          if (response === null) return;
          customLabelText.area.main = response;
          render();
        }
      });
      generalLabelToggleGrid.appendChild(button);
    });
  }

  function translateLabelGroup(delta) {
    Object.keys(labelPositions).forEach(function (group) {
      Object.keys(labelPositions[group]).forEach(function (id) {
        const value = labelPositions[group][id];
        if (!value) return;
        labelPositions[group][id] = { x: value.x + delta.x, y: value.y + delta.y };
      });
    });
  }
  function rotateLabelGroupAround(center, angleDeg) {
    Object.keys(labelPositions).forEach(function (group) {
      Object.keys(labelPositions[group]).forEach(function (id) {
        const value = labelPositions[group][id];
        if (!value) return;
        labelPositions[group][id] = rotatePoint(value, center, angleDeg);
      });
    });
  }
  function scaleLabelGroupAround(center, ratio) {
    Object.keys(labelPositions).forEach(function (group) {
      Object.keys(labelPositions[group]).forEach(function (id) {
        const value = labelPositions[group][id];
        if (!value) return;
        labelPositions[group][id] = { x: center.x + (value.x - center.x) * ratio, y: center.y + (value.y - center.y) * ratio };
      });
    });
  }
  function scaleLabelFontGroup(ratio) {
    Object.keys(labelFontSize).forEach(function (group) {
      Object.keys(labelFontSize[group]).forEach(function (id) {
        const minFontSize = group === 'rightAngleMark' ? 4 : 10;
        labelFontSize[group][id] = Math.max(minFontSize, Math.min(320, Math.round(labelFontSize[group][id] * ratio)));
      });
    });
  }
  function renderSelectionOverlay(anchor) {
    currentSelectionOverlay = anchor ? window.InstantGeometrySharedSelection.renderSelectionOverlay({
      board: board,
      anchor: anchor,
      rotatePoint: rotatePoint,
      getLabelBounds: getLabelBounds,
      isPaletteOpen: isPaletteOpen
    }) : null;
  }
  function findSelectionControl(point) { return window.InstantGeometrySharedSelection.findSelectionControl(point, currentSelectionOverlay); }
  function getSelectedAnchor() {
    if (!selectedLabel) return null;
    return currentLabelAnchors.find(function (item) { return item.type === selectedLabel.type && item.id === selectedLabel.id; }) || null;
  }
  function getFigureSelectionAnchor() {
    if (!selectedFigure || !currentGeometry) return null;
    const center = { x: currentGeometry.centroid.x, y: currentGeometry.centroid.y };
    const aggregatePoints = Object.keys(currentGeometry.points).map(function (key) { return currentGeometry.points[key]; });
    currentLabelAnchors
      .filter(function (item) { return item && item.screenRect; })
      .forEach(function (item) {
        const rect = item.screenRect;
        aggregatePoints.push(
          { x: (rect.left - board.origin.scrCoords[1]) / board.unitX, y: (board.origin.scrCoords[2] - rect.top) / board.unitY },
          { x: (rect.right - board.origin.scrCoords[1]) / board.unitX, y: (board.origin.scrCoords[2] - rect.top) / board.unitY },
          { x: (rect.right - board.origin.scrCoords[1]) / board.unitX, y: (board.origin.scrCoords[2] - rect.bottom) / board.unitY },
          { x: (rect.left - board.origin.scrCoords[1]) / board.unitX, y: (board.origin.scrCoords[2] - rect.bottom) / board.unitY }
        );
      });
    const bounds = window.InstantGeometrySharedSelection.computeRotatedBoundsFromPoints(center, figureState.rotation, aggregatePoints, 1.2);
    return { kind: 'figure', x: center.x, y: center.y, width: bounds.width, height: bounds.height, color: figureState.color, rotation: figureState.rotation, bounds: bounds };
  }
  function pointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
      const xi = polygon[i].x; const yi = polygon[i].y; const xj = polygon[j].x; const yj = polygon[j].y;
      const intersect = ((yi > point.y) !== (yj > point.y)) && (point.x < ((xj - xi) * (point.y - yi) / ((yj - yi) || 1e-9) + xi));
      if (intersect) inside = !inside;
    }
    return inside;
  }
  function pointInFigureZone(point) {
    if (!currentGeometry) return false;
    return pointInPolygon(point, currentGeometry.pointIds.map(function (id) { return currentGeometry.points[id]; }));
  }
  function findAnchorAtPoint(point) {
    for (let index = currentLabelAnchors.length - 1; index >= 0; index -= 1) {
      const anchor = currentLabelAnchors[index];
      const screen = userToScreenPoint(point);
      if (screen.x >= anchor.screenRect.left && screen.x <= anchor.screenRect.right && screen.y >= anchor.screenRect.top && screen.y <= anchor.screenRect.bottom) return { type: anchor.type, id: anchor.id };
    }
    return null;
  }
  function fitBoard(geometry) {
    const points = geometry.pointIds.map(function (id) { return geometry.points[id]; });
    const xs = points.map(function (p) { return p.x; });
    const ys = points.map(function (p) { return p.y; });
    const minX = Math.min.apply(null, xs); const maxX = Math.max.apply(null, xs);
    const minY = Math.min.apply(null, ys); const maxY = Math.max.apply(null, ys);
    const width = Math.max(1, maxX - minX); const height = Math.max(1, maxY - minY);
    const padding = Math.max(width, height) * 0.42;
    const contentWidth = width + padding * 2; const contentHeight = height + padding * 2;
    const aspect = exportAspects[exportAspectIndex].value;
    let halfWidth = contentWidth / 2; let halfHeight = contentHeight / 2;
    if (contentWidth / contentHeight < aspect) halfWidth = (contentHeight * aspect) / 2; else halfHeight = (contentWidth / aspect) / 2;
    halfWidth /= zoomScale; halfHeight /= zoomScale;
    if (box && exportFrame) {
      const frameWidthRatio = exportFrame.clientWidth / Math.max(box.clientWidth, 1);
      const frameHeightRatio = exportFrame.clientHeight / Math.max(box.clientHeight, 1);
      halfWidth /= Math.max(frameWidthRatio, 1e-4);
      halfHeight /= Math.max(frameHeightRatio, 1e-4);
    }
    board.setBoundingBox([geometry.centroid.x - halfWidth, geometry.centroid.y + halfHeight, geometry.centroid.x + halfWidth, geometry.centroid.y - halfHeight], true);
  }
  function updateExportFrame() {
    const rect = box.getBoundingClientRect();
    const aspect = exportAspects[exportAspectIndex].value;
    const margin = Math.min(56, rect.width * 0.06, rect.height * 0.06);
    let width = rect.width - margin * 2; let height = width / aspect;
    if (height > rect.height - margin * 2) { height = rect.height - margin * 2; width = height * aspect; }
    exportFrame.style.width = Math.max(120, width) + 'px';
    exportFrame.style.height = Math.max(120, height) + 'px';
    const left = (rect.width - width) / 2; const top = (rect.height - height) / 2; const right = left + width; const bottom = top + height;
    exportBackdrop.style.setProperty('--frame-left', left + 'px');
    exportBackdrop.style.setProperty('--frame-top', top + 'px');
    exportBackdrop.style.setProperty('--frame-right', right + 'px');
    exportBackdrop.style.setProperty('--frame-bottom', bottom + 'px');
  }
  function cropCanvasToFrame(canvas) {
    const rect = box.getBoundingClientRect(); const frameRect = exportFrame.getBoundingClientRect();
    const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height;
    const sx = Math.round((frameRect.left - rect.left) * scaleX); const sy = Math.round((frameRect.top - rect.top) * scaleY);
    const sw = Math.round(frameRect.width * scaleX); const sh = Math.round(frameRect.height * scaleY);
    const cropped = document.createElement('canvas'); cropped.width = sw; cropped.height = sh;
    cropped.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh); return cropped;
  }
  function scheduleRender() {
    if (renderRafId !== null) return;
    renderRafId = requestAnimationFrame(function () { renderRafId = null; render(); });
  }
  function renderFigure(geometry) {
    const points = geometry.pointIds.map(function (id) {
      return board.create('point', [geometry.points[id].x, geometry.points[id].y], { name: '', size: 3, fixed: true, strokeColor: '#111111', fillColor: '#111111' });
    });
    board.create('polygon', points, { borders: { visible: false, fixed: true, highlight: false }, fillColor: hexToRgba(figureState.color, 0.08), fillOpacity: 0, vertices: { visible: false }, highlight: false });
    geometry.segmentIds.forEach(function (segmentId, index) {
      if (labelState.segment[segmentId] || segmentLineMode[segmentId] !== 0) {
        board.create('segment', [points[index], points[(index + 1) % points.length]], {
          fixed: true,
          strokeWidth: 2,
          strokeColor: getLabelStyle('segmentObject', segmentId).color,
          highlight: false
        });
        registerSegmentObjectAnchor('segmentObject', segmentId, geometry.points[segmentId.charAt(0)], geometry.points[segmentId.charAt(1)]);
      }
    });
  }
  function drawAngleDecoration(id, geometry) {
    const mode = Number.isFinite(angleMarkerMode[id]) ? angleMarkerMode[id] : 0;
    if (mode === 0) return;
    const data = getAngleData(id, geometry);
    const vertex = data.vertex; const p1 = data.p1; const p2 = data.p2;
    const radius = Math.max(0.08, (geometry.side / 10) * Math.max(0.35, Math.min(8, labelFontSize.angleMark[id] / 26)));
    const a1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
    const a2 = Math.atan2(p2.y - vertex.y, p2.x - vertex.x);
    let delta = a2 - a1;
    while (delta <= -Math.PI) delta += Math.PI * 2;
    while (delta > Math.PI) delta -= Math.PI * 2;
    const styleValue = getLabelStyle('angleMark', id); const color = styleValue.color || '#687086';
    const start = { x: vertex.x + radius * Math.cos(a1), y: vertex.y + radius * Math.sin(a1) };
    const end = { x: vertex.x + radius * Math.cos(a1 + delta), y: vertex.y + radius * Math.sin(a1 + delta) };
    board.create('segment', [[vertex.x, vertex.y], [start.x, start.y]], { fixed: true, strokeWidth: 1.4, strokeColor: color, highlight: false });
    board.create('segment', [[vertex.x, vertex.y], [end.x, end.y]], { fixed: true, strokeWidth: 1.4, strokeColor: color, highlight: false });
    board.create('curve', [function (t) { const angle = a1 + delta * t; return vertex.x + radius * Math.cos(angle); }, function (t) { const angle = a1 + delta * t; return vertex.y + radius * Math.sin(angle); }, 0, 1], { fixed: true, strokeWidth: 1.8, strokeColor: color, highlight: false });
    const midAngle = a1 + delta / 2;
    const symbolCenter = { x: vertex.x + radius * Math.cos(midAngle), y: vertex.y + radius * Math.sin(midAngle) };
    const towardCenter = { x: vertex.x - symbolCenter.x, y: vertex.y - symbolCenter.y };
    const towardLen = Math.hypot(towardCenter.x, towardCenter.y) || 1;
    const dir = { x: towardCenter.x / towardLen, y: towardCenter.y / towardLen };
    const normal = { x: -dir.y, y: dir.x };
    const symbolSize = Math.max(0.03, radius * 0.34);
    if (mode === 2) {
      const circleSize = symbolSize * 0.5;
      board.create('curve', [function (t) { return symbolCenter.x + circleSize * Math.cos(t); }, function (t) { return symbolCenter.y + circleSize * Math.sin(t); }, 0, Math.PI * 2], { fixed: true, strokeWidth: 1.6, strokeColor: color, highlight: false });
    } else if (mode === 3) {
      const barSize = symbolSize * 0.5;
      board.create('segment', [[symbolCenter.x - dir.x * barSize, symbolCenter.y - dir.y * barSize], [symbolCenter.x + dir.x * barSize, symbolCenter.y + dir.y * barSize]], { fixed: true, strokeWidth: 1.8, strokeColor: color, highlight: false });
    } else if (mode === 4) {
      const barSize = symbolSize * 0.5; const sep = barSize * 0.46;
      board.create('segment', [[symbolCenter.x - dir.x * barSize + normal.x * sep, symbolCenter.y - dir.y * barSize + normal.y * sep], [symbolCenter.x + dir.x * barSize + normal.x * sep, symbolCenter.y + dir.y * barSize + normal.y * sep]], { fixed: true, strokeWidth: 1.8, strokeColor: color, highlight: false });
      board.create('segment', [[symbolCenter.x - dir.x * barSize - normal.x * sep, symbolCenter.y - dir.y * barSize - normal.y * sep], [symbolCenter.x + dir.x * barSize - normal.x * sep, symbolCenter.y + dir.y * barSize - normal.y * sep]], { fixed: true, strokeWidth: 1.8, strokeColor: color, highlight: false });
    } else if (mode === 5) {
      const crossSize = symbolSize * 0.5;
      board.create('segment', [[symbolCenter.x - dir.x * crossSize - normal.x * crossSize, symbolCenter.y - dir.y * crossSize - normal.y * crossSize], [symbolCenter.x + dir.x * crossSize + normal.x * crossSize, symbolCenter.y + dir.y * crossSize + normal.y * crossSize]], { fixed: true, strokeWidth: 1.8, strokeColor: color, highlight: false });
      board.create('segment', [[symbolCenter.x - dir.x * crossSize + normal.x * crossSize, symbolCenter.y - dir.y * crossSize + normal.y * crossSize], [symbolCenter.x + dir.x * crossSize - normal.x * crossSize, symbolCenter.y + dir.y * crossSize - normal.y * crossSize]], { fixed: true, strokeWidth: 1.8, strokeColor: color, highlight: false });
    } else if (mode === 6) {
      const triSize = symbolSize * 0.5;
      const tip = { x: symbolCenter.x - dir.x * triSize * 1.15, y: symbolCenter.y - dir.y * triSize * 1.15 };
      const baseL = { x: symbolCenter.x + dir.x * triSize * 0.85 + normal.x * triSize * 0.9, y: symbolCenter.y + dir.y * triSize * 0.85 + normal.y * triSize * 0.9 };
      const baseR = { x: symbolCenter.x + dir.x * triSize * 0.85 - normal.x * triSize * 0.9, y: symbolCenter.y + dir.y * triSize * 0.85 - normal.y * triSize * 0.9 };
      board.create('segment', [[tip.x, tip.y], [baseL.x, baseL.y]], { fixed: true, strokeWidth: 1.8, strokeColor: color, highlight: false });
      board.create('segment', [[baseL.x, baseL.y], [baseR.x, baseR.y]], { fixed: true, strokeWidth: 1.8, strokeColor: color, highlight: false });
      board.create('segment', [[baseR.x, baseR.y], [tip.x, tip.y]], { fixed: true, strokeWidth: 1.8, strokeColor: color, highlight: false });
    } else if (mode === 7) {
      const sectorPoints = [{ x: vertex.x, y: vertex.y }];
      for (let i = 0; i <= 18; i += 1) {
        const t = i / 18; const angle = a1 + delta * t;
        sectorPoints.push({ x: vertex.x + radius * Math.cos(angle), y: vertex.y + radius * Math.sin(angle) });
      }
      board.create('polygon', sectorPoints.map(function (p) { return [p.x, p.y]; }), { fixed: true, borders: { visible: false, highlight: false }, vertices: { visible: false }, fillColor: color, fillOpacity: 1, highlight: false });
    }
    const sampleAngles = [0, 0.25, 0.5, 0.75, 1].map(function (t) { const angle = a1 + delta * t; return { x: vertex.x + radius * Math.cos(angle), y: vertex.y + radius * Math.sin(angle) }; });
    const boundsPoints = sampleAngles.concat(mode === 7 ? [{ x: vertex.x, y: vertex.y }] : [
      { x: symbolCenter.x + normal.x * symbolSize, y: symbolCenter.y + normal.y * symbolSize },
      { x: symbolCenter.x - normal.x * symbolSize, y: symbolCenter.y - normal.y * symbolSize },
      { x: symbolCenter.x + dir.x * symbolSize, y: symbolCenter.y + dir.y * symbolSize },
      { x: symbolCenter.x - dir.x * symbolSize, y: symbolCenter.y - dir.y * symbolSize }
    ]);
    const screenPoints = boundsPoints.map(userToScreenPoint);
    currentLabelAnchors.push({ type: 'angleMark', id: id, x: symbolCenter.x, y: symbolCenter.y, scaleCenter: { x: vertex.x, y: vertex.y }, screenRect: { left: Math.min.apply(null, screenPoints.map(function (p) { return p.x; })), right: Math.max.apply(null, screenPoints.map(function (p) { return p.x; })), top: Math.min.apply(null, screenPoints.map(function (p) { return p.y; })), bottom: Math.max.apply(null, screenPoints.map(function (p) { return p.y; })) }, fontSize: labelFontSize.angleMark[id], rotation: 0, color: color });
  }
  function drawRightAngleDecoration(id, geometry) {
    if (!isRightAngleId(id, geometry) || !rightAngleMarkerMode[id]) return;
    const data = getAngleData(id, geometry);
    const vertex = data.vertex; const p1 = data.p1; const p2 = data.p2;
    const v1 = { x: p1.x - vertex.x, y: p1.y - vertex.y }; const v2 = { x: p2.x - vertex.x, y: p2.y - vertex.y };
    const l1 = Math.hypot(v1.x, v1.y) || 1; const l2 = Math.hypot(v2.x, v2.y) || 1;
    const u1 = { x: v1.x / l1, y: v1.y / l1 }; const u2 = { x: v2.x / l2, y: v2.y / l2 };
    const sizeScale = Math.max(0.12, Math.min(8, labelFontSize.rightAngleMark[id] / 26));
    const size = Math.max(0.02, geometry.side * 0.06 * sizeScale);
    const pA = { x: vertex.x + u1.x * size, y: vertex.y + u1.y * size };
    const pB = { x: pA.x + u2.x * size, y: pA.y + u2.y * size };
    const pC = { x: vertex.x + u2.x * size, y: vertex.y + u2.y * size };
    const color = getLabelStyle('rightAngleMark', id).color || '#111111';
    board.create('segment', [[pA.x, pA.y], [pB.x, pB.y]], { fixed: true, strokeWidth: 2, strokeColor: color, highlight: false });
    board.create('segment', [[pB.x, pB.y], [pC.x, pC.y]], { fixed: true, strokeWidth: 2, strokeColor: color, highlight: false });
    const screenPoints = [vertex, pA, pB, pC].map(userToScreenPoint);
    currentLabelAnchors.push({ type: 'rightAngleMark', id: id, x: (vertex.x + pB.x) / 2, y: (vertex.y + pB.y) / 2, scaleCenter: { x: vertex.x, y: vertex.y }, screenRect: { left: Math.min.apply(null, screenPoints.map(function (p) { return p.x; })), right: Math.max.apply(null, screenPoints.map(function (p) { return p.x; })), top: Math.min.apply(null, screenPoints.map(function (p) { return p.y; })), bottom: Math.max.apply(null, screenPoints.map(function (p) { return p.y; })) }, fontSize: labelFontSize.rightAngleMark[id], rotation: 0, color: color });
  }
  function renderLabels(geometry) {
    labelLayer.innerHTML = '';
    currentLabelAnchors = [];
    geometry.pointIds.forEach(function (id) {
      if (!labelState.point[id]) return;
      createSelectableText(getLabelPosition('point', id, getDefaultPosition('point', id, geometry)), getPointLabelToken(id), labelFontSize.point[id], { type: 'point', id: id }, { color: '#1f2430' });
    });
    geometry.segmentIds.forEach(function (segmentId) {
      if (!labelState.segment[segmentId]) return;
      window.InstantGeometrySharedOrnaments.drawSideArcLabel({
        board: board,
        P: geometry.points[segmentId.charAt(0)],
        Q: geometry.points[segmentId.charAt(1)],
        center: geometry.centroid,
        text: getLabelText('segment', segmentId, geometry),
        labelType: 'segment',
        labelId: segmentId,
        labelFontGroup: 'segment',
        showArc: segmentArcMode[segmentId] !== 0,
        getLabelPosition: getLabelPosition,
        getLabelStyle: getLabelStyle,
        createSelectableText: createSelectableText,
        labelFontSize: labelFontSize
      });
    });
    geometry.pointIds.forEach(function (id) {
      if (labelState.angle[id]) createSelectableText(getLabelPosition('angle', id, getDefaultPosition('angle', id, geometry)), getLabelText('angle', id, geometry), labelFontSize.angle[id], { type: 'angle', id: id }, { color: '#687086', threshold: 0.6 });
      if (labelState.angleMark[id]) drawAngleDecoration(id, geometry);
      if (labelState.rightAngleMark[id]) drawRightAngleDecoration(id, geometry);
    });
    if (labelState.area.main) createSelectableText(getLabelPosition('area', 'main', getDefaultPosition('area', 'main', geometry)), getLabelText('area', 'main', geometry), labelFontSize.area.main, { type: 'area', id: 'main' }, { color: '#25603b', threshold: 0.8 });
    renderSelectionOverlay(getSelectedAnchor() || getFigureSelectionAnchor());
  }
  function render() {
    if (renderRafId !== null) { cancelAnimationFrame(renderRafId); renderRafId = null; }
    board.suspendUpdate();
    board.removeObject(board.objectsList.slice());
    labelLayer.innerHTML = '';
    currentLabelAnchors = [];
    currentSelectionOverlay = null;
    try {
      currentGeometry = getGeometryFromInputs();
      updateExportFrame();
      const inputSignature = Object.keys(inputElements).sort().reduce(function (acc, key) { acc[key] = inputElements[key].value; return acc; }, {});
      const fitSignature = JSON.stringify({ inputs: inputSignature, aspect: exportAspectIndex, boxW: box.clientWidth, boxH: box.clientHeight, zoom: zoomScale });
      if (fitSignature !== lastFitSignature) { fitBoard(currentGeometry); lastFitSignature = fitSignature; }
      renderFigure(currentGeometry);
      renderLabels(currentGeometry);
      setStatus('正N角形を描画しました。', false);
    } catch (error) {
      currentGeometry = null;
      setStatus(error.message || '描画に失敗しました。', true);
    } finally {
      board.unsuspendUpdate();
    }
  }
  async function handleDownload(format) {
    updateExportFrame();
    setStatus((format === 'pdf' ? 'PDF' : '画像') + ' を出力しています。', false);
    try {
      const canvas = await html2canvas(box, { backgroundColor: format === 'png-transparent' ? null : '#ffffff', scale: 2, useCORS: true });
      const cropped = cropCanvasToFrame(canvas);
      if (format === 'pdf') {
        const pdf = new window.jspdf.jsPDF({ orientation: cropped.width >= cropped.height ? 'landscape' : 'portrait', unit: 'px', format: [cropped.width, cropped.height] });
        pdf.addImage(cropped.toDataURL('image/png'), 'PNG', 0, 0, cropped.width, cropped.height);
        pdf.save(shapeMeta.slug + '.pdf');
      } else {
        const link = document.createElement('a');
        link.href = cropped.toDataURL('image/png');
        link.download = format === 'png-transparent' ? (shapeMeta.slug + '-transparent.png') : (shapeMeta.slug + '.png');
        link.click();
      }
      setStatus('保存しました。', false);
    } catch (_) {
      setStatus('ダウンロードに失敗しました。', true);
    }
  }

  labelLayer.addEventListener('pointerdown', function (event) {
    const target = event.target.closest('.floating-label');
    if (!target) return;
    const type = target.dataset.type; const id = target.dataset.id;
    if (!type || !id) return;
    selectedLabel = { type: type, id: id }; selectedFigure = false; isPaletteOpen = false; render();
    const anchor = currentLabelAnchors.find(function (item) { return item.type === type && item.id === id; });
    const position = (labelPositions[type] && labelPositions[type][id]) || (anchor ? { x: anchor.x, y: anchor.y } : null);
    if (!position) return;
    dragState = { mode: 'move', type: type, id: id, startClient: { x: event.clientX, y: event.clientY }, labelStart: { x: position.x, y: position.y } };
  });
  box.addEventListener('mousedown', function (event) {
    if (!currentGeometry) return;
    if (event.target.closest('.floating-label')) return;
    const coords = board.getUsrCoordsOfMouse(event); const point = { x: coords[0], y: coords[1] };
    const overlayControl = findSelectionControl(point);
    if ((selectedLabel || selectedFigure) && overlayControl) {
      if (overlayControl.mode === 'palette-color') {
        if (selectedLabel) labelStyleState[selectedLabel.type][selectedLabel.id].color = overlayControl.color; else figureState.color = overlayControl.color;
        isPaletteOpen = false; render(); return;
      }
      if (overlayControl.mode === 'palette') { isPaletteOpen = !isPaletteOpen; render(); return; }
      if (overlayControl.mode === 'rotate' && selectedLabel && ((selectedLabel.type === 'angleMark' || selectedLabel.type === 'rightAngleMark') || window.InstantGeometrySharedSelection.isNonTransformableSelectionType(selectedLabel.type))) return;
      if (overlayControl.mode === 'resize' && selectedLabel && window.InstantGeometrySharedSelection.isNonTransformableSelectionType(selectedLabel.type)) return;
      const anchor = selectedLabel ? getSelectedAnchor() : getFigureSelectionAnchor();
      if (!anchor) return;
      const dragCenter = (selectedLabel && (selectedLabel.type === 'angleMark' || selectedLabel.type === 'rightAngleMark') && anchor.scaleCenter) ? anchor.scaleCenter : { x: anchor.x, y: anchor.y };
      dragState = { mode: overlayControl.mode, target: selectedLabel ? 'label' : 'figure', type: selectedLabel ? selectedLabel.type : 'figure', id: selectedLabel ? selectedLabel.id : 'main', startClient: { x: event.clientX, y: event.clientY }, center: dragCenter, fontSizeStart: selectedLabel ? labelFontSize[selectedLabel.type][selectedLabel.id] : null, scaleStart: selectedFigure ? figureState.scale : null, rotationStart: selectedLabel ? labelStyleState[selectedLabel.type][selectedLabel.id].rotation : figureState.rotation, distanceStart: Math.hypot(point.x - dragCenter.x, point.y - dragCenter.y), angleStart: Math.atan2(point.y - dragCenter.y, point.x - dragCenter.x) };
      return;
    }
    if (selectedFigure && pointInFigureZone(point)) {
      dragState = { mode: 'figure-move', target: 'figure', startClient: { x: event.clientX, y: event.clientY }, offsetStart: { x: figureState.offset.x, y: figureState.offset.y } };
      return;
    }
    const anchorHit = findAnchorAtPoint(point);
    if (anchorHit) { selectedLabel = anchorHit; selectedFigure = false; isPaletteOpen = false; render(); return; }
    if (pointInFigureZone(point)) {
      selectedLabel = null; selectedFigure = true; isPaletteOpen = false;
      dragState = { mode: 'figure-move', target: 'figure', startClient: { x: event.clientX, y: event.clientY }, offsetStart: { x: figureState.offset.x, y: figureState.offset.y } };
      render(); return;
    }
    selectedLabel = null; selectedFigure = false; isPaletteOpen = false; render();
  });
  box.addEventListener('mousemove', function (event) {
    if (!dragState || !currentGeometry) return;
    const coords = board.getUsrCoordsOfMouse(event); const point = { x: coords[0], y: coords[1] };
    if (dragState.mode === 'move') {
      const boundingBox = board.getBoundingBox();
      const unitsPerPixelX = (boundingBox[2] - boundingBox[0]) / Math.max(box.clientWidth, 1);
      const unitsPerPixelY = (boundingBox[1] - boundingBox[3]) / Math.max(box.clientHeight, 1);
      labelPositions[dragState.type][dragState.id] = { x: dragState.labelStart.x + (event.clientX - dragState.startClient.x) * unitsPerPixelX, y: dragState.labelStart.y - (event.clientY - dragState.startClient.y) * unitsPerPixelY };
      scheduleRender(); return;
    }
    if (dragState.mode === 'resize') {
      const ratio = Math.max(0.3, Math.min(8, Math.hypot(point.x - dragState.center.x, point.y - dragState.center.y) / Math.max(dragState.distanceStart, 0.01)));
      if (dragState.target === 'label') {
        if (window.InstantGeometrySharedSelection.isNonTransformableSelectionType(dragState.type)) return;
        const minFontSize = dragState.type === 'rightAngleMark' ? 4 : 10;
        labelFontSize[dragState.type][dragState.id] = Math.max(minFontSize, Math.min(320, Math.round(dragState.fontSizeStart * ratio)));
      } else {
        const nextScale = Math.max(0.3, Math.min(4, dragState.scaleStart * ratio));
        const scaleRatio = nextScale / Math.max(figureState.scale, 1e-9);
        if (Math.abs(scaleRatio - 1) > 1e-9) { scaleLabelGroupAround(currentGeometry.centroid, scaleRatio); scaleLabelFontGroup(scaleRatio); }
        figureState.scale = nextScale;
      }
      scheduleRender(); return;
    }
    if (dragState.mode === 'rotate') {
      const currentAngle = Math.atan2(point.y - dragState.center.y, point.x - dragState.center.x);
      if (dragState.target === 'label') {
        if (window.InstantGeometrySharedSelection.isNonTransformableSelectionType(dragState.type)) return;
        labelStyleState[dragState.type][dragState.id].rotation = dragState.rotationStart + ((currentAngle - dragState.angleStart) * 180 / Math.PI);
      }
      else {
        const nextRotation = dragState.rotationStart + ((currentAngle - dragState.angleStart) * 180 / Math.PI);
        const deltaRotation = nextRotation - figureState.rotation;
        if (Math.abs(deltaRotation) > 1e-9) rotateLabelGroupAround(currentGeometry.centroid, deltaRotation);
        figureState.rotation = nextRotation;
      }
      scheduleRender(); return;
    }
    if (dragState.mode === 'figure-move') {
      const boundingBox = board.getBoundingBox();
      const unitsPerPixelX = (boundingBox[2] - boundingBox[0]) / Math.max(box.clientWidth, 1);
      const unitsPerPixelY = (boundingBox[1] - boundingBox[3]) / Math.max(box.clientHeight, 1);
      const nextOffset = { x: dragState.offsetStart.x + (event.clientX - dragState.startClient.x) * unitsPerPixelX, y: dragState.offsetStart.y - (event.clientY - dragState.startClient.y) * unitsPerPixelY };
      const delta = { x: nextOffset.x - figureState.offset.x, y: nextOffset.y - figureState.offset.y };
      if (Math.abs(delta.x) > 1e-9 || Math.abs(delta.y) > 1e-9) translateLabelGroup(delta);
      figureState.offset = nextOffset;
      scheduleRender();
    }
  });
  window.addEventListener('mouseup', function () { dragState = null; });
  Object.keys(inputElements).forEach(function (id) {
    inputElements[id].addEventListener('input', function () {
      selectedLabel = null; selectedFigure = false; isPaletteOpen = false; zoomScale = 1;
      figureState.offset = { x: 0, y: 0 }; figureState.rotation = 0; figureState.scale = 1; lastFitSignature = '';
      renderLabelToggleButtons();
      render();
    });
  });
  box.addEventListener('wheel', function (event) {
    event.preventDefault();
    zoomScale = Math.max(0.45, Math.min(4, zoomScale * (event.deltaY < 0 ? 1.08 : 1 / 1.08)));
    lastFitSignature = ''; render();
  }, { passive: false });
  ratioBtn.addEventListener('click', function () { exportAspectIndex = (exportAspectIndex + 1) % exportAspects.length; updateRatioButton(); lastFitSignature = ''; render(); });
  resetBtn.addEventListener('click', function () {
    inputElements.vertexCount.value = '6';
    inputElements.radiusLen.value = '5';
    exportAspectIndex = 0; unitIndex = 1; angleMode = 'degrees'; zoomScale = 1;
    Object.keys(labelPositions).forEach(function (group) { Object.keys(labelPositions[group]).forEach(function (id) { labelPositions[group][id] = null; }); });
    Object.keys(labelFontSize).forEach(function (group) { Object.keys(labelFontSize[group]).forEach(function (id) { labelFontSize[group][id] = labelFontDefaults[group][id]; }); });
    Object.keys(labelStyleState).forEach(function (group) { Object.keys(labelStyleState[group]).forEach(function (id) { labelStyleState[group][id] = JSON.parse(JSON.stringify(styleDefaults[group][id])); }); });
    Object.keys(labelState.point).forEach(function (id) { labelState.point[id] = true; });
    Object.keys(labelState.segment).forEach(function (id) { labelState.segment[id] = true; });
    Object.keys(labelState.angle).forEach(function (id) { labelState.angle[id] = false; });
    Object.keys(labelState.angleMark).forEach(function (id) { labelState.angleMark[id] = false; });
    Object.keys(labelState.rightAngleMark).forEach(function (id) { labelState.rightAngleMark[id] = false; });
    labelState.area.main = false;
    Object.keys(angleMarkerMode).forEach(function (id) { angleMarkerMode[id] = 0; });
    Object.keys(rightAngleMarkerMode).forEach(function (id) { rightAngleMarkerMode[id] = 0; });
    Object.keys(segmentArcMode).forEach(function (id) { segmentArcMode[id] = 1; });
    Object.keys(segmentLineMode).forEach(function (id) { segmentLineMode[id] = 1; });
    Object.keys(customLabelText.segment).forEach(function (id) { customLabelText.segment[id] = ''; });
    Object.keys(customLabelText.angle).forEach(function (id) { customLabelText.angle[id] = ''; });
    customLabelText.area.main = '';
    allPointIds.forEach(function (id) { pointLabelText[id] = id; });
    figureState = { color: '#2a5bd7', rotation: 0, scale: 1, offset: { x: 0, y: 0 } };
    selectedLabel = null; selectedFigure = false; isPaletteOpen = false;
    updateRatioButton(); updateUnitButton(); updateAngleModeButton(); renderLabelToggleButtons(); lastFitSignature = ''; render();
  });
  unitBtn.addEventListener('click', function () { unitIndex = (unitIndex + 1) % unitOptions.length; updateUnitButton(); render(); });
  angleModeBtn.addEventListener('click', function () { angleMode = angleMode === 'degrees' ? 'radians' : 'degrees'; updateAngleModeButton(); render(); });
  leftToggle.addEventListener('click', function () { isDockCollapsed = !isDockCollapsed; leftDock.classList.toggle('is-collapsed', isDockCollapsed); updateDockToggleButtons(); });
  rightToggle.addEventListener('click', function () { isRightDockCollapsed = !isRightDockCollapsed; rightDock.classList.toggle('is-collapsed', isRightDockCollapsed); updateDockToggleButtons(); });
  pageBackBtn.addEventListener('click', function () { window.history.back(); });
  downloadButtons.forEach(function (button) { button.addEventListener('click', function () { handleDownload(button.dataset.downloadFormat); }); });
  window.addEventListener('resize', function () { updateExportFrame(); lastFitSignature = ''; render(); });

  updateRatioButton();
  updateUnitButton();
  updateAngleModeButton();
  updateDockToggleButtons();
  renderLabelToggleButtons();
  render();
})();
