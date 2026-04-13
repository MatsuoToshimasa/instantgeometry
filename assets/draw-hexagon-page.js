(function () {
  'use strict';

  const pointIds = ['A', 'B', 'C', 'D', 'E', 'F'];
  const segmentIds = ['AB', 'BC', 'CD', 'DE', 'EF', 'FA'];
  const angleIds = ['A', 'B', 'C', 'D', 'E', 'F'];
  const shapeMeta = { name: '六角形', slug: 'hexagon' };
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

  const pointLabelText = { A: 'A', B: 'B', C: 'C', D: 'D', E: 'E', F: 'F' };
  const defaultLabelState = {
    point: { A: true, B: true, C: true, D: true, E: true, F: true },
    segment: { AB: true, BC: true, CD: true, DE: true, EF: true, FA: true },
    angle: { A: false, B: false, C: false, D: false, E: false, F: false },
    angleMark: { A: false, B: false, C: false, D: false, E: false, F: false },
    rightAngleMark: { A: true, B: true, C: true, D: true, E: true, F: true },
    area: { main: false }
  };
  const labelState = JSON.parse(JSON.stringify(defaultLabelState));
  const labelFontDefaults = {
    point: { A: 36, B: 36, C: 36, D: 36, E: 36, F: 36 },
    segment: { AB: 30, BC: 30, CD: 30, DE: 30, EF: 30, FA: 30 },
    angle: { A: 28, B: 28, C: 28, D: 28, E: 28, F: 28 },
    angleMark: { A: 26, B: 26, C: 26, D: 26, E: 26, F: 26 },
    rightAngleMark: { A: 26, B: 26, C: 26, D: 26, E: 26, F: 26 },
    area: { main: 48 }
  };
  const labelFontSize = JSON.parse(JSON.stringify(labelFontDefaults));
  const styleDefaults = {
    point: { A: style('#1f2430'), B: style('#1f2430'), C: style('#1f2430'), D: style('#1f2430'), E: style('#1f2430'), F: style('#1f2430') },
    segment: { AB: style('#2a5bd7'), BC: style('#2a5bd7'), CD: style('#2a5bd7'), DE: style('#2a5bd7'), EF: style('#2a5bd7'), FA: style('#2a5bd7') },
    segmentObject: { AB: style('#2a5bd7'), BC: style('#2a5bd7'), CD: style('#2a5bd7'), DE: style('#2a5bd7'), EF: style('#2a5bd7'), FA: style('#2a5bd7') },
    angle: { A: style('#687086'), B: style('#687086'), C: style('#687086'), D: style('#687086'), E: style('#687086'), F: style('#687086') },
    angleMark: { A: style('#687086'), B: style('#687086'), C: style('#687086'), D: style('#687086'), E: style('#687086'), F: style('#687086') },
    rightAngleMark: { A: style('#111111'), B: style('#111111'), C: style('#111111'), D: style('#111111'), E: style('#111111'), F: style('#111111') },
    area: { main: style('#25603b') }
  };
  let labelStyleState = JSON.parse(JSON.stringify(styleDefaults));
  const labelPositions = {
    point: { A: null, B: null, C: null, D: null, E: null, F: null },
    segment: { AB: null, BC: null, CD: null, DE: null, EF: null, FA: null },
    angle: { A: null, B: null, C: null, D: null, E: null, F: null },
    angleMark: { A: null, B: null, C: null, D: null, E: null, F: null },
    rightAngleMark: { A: null, B: null, C: null, D: null, E: null, F: null },
    area: { main: null }
  };
  const customLabelText = {
    segment: { AB: '', BC: '', CD: '', DE: '', EF: '', FA: '' },
    angle: { A: '', B: '', C: '', D: '', E: '', F: '' },
    area: { main: '' }
  };
  const angleMarkerMode = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
  const rightAngleMarkerMode = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
  const segmentArcMode = { AB: 1, BC: 1, CD: 1, DE: 1, EF: 1, FA: 1 };
  const segmentLineMode = { AB: 1, BC: 1, CD: 1, DE: 1, EF: 1, FA: 1 };

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
  function formatNumber(value) { const rounded = Math.round(value * 100) / 100; return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''); }
  function appendUnit(text, square) { const unit = unitOptions[unitIndex]; return unit ? (text + unit + (square ? '²' : '')) : text; }
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

  function polygonCentroidFromList(points) {
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
    if (Math.abs(twiceArea) < 1e-8) return { x: 0, y: 0 };
    return { x: cx / (3 * twiceArea), y: cy / (3 * twiceArea) };
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
  function getPointLabelToken(id) {
    const raw = String(pointLabelText[id] || id).trim().toUpperCase();
    return /^[A-Z]+$/.test(raw) ? raw : id;
  }
  function getAreaName() { return '多角形' + pointIds.map(getPointLabelToken).join(''); }
  function getSegmentName(id) { return id.split('').map(getPointLabelToken).join(''); }
  function getAngleName(id) { return '∠' + getPointLabelToken(id); }
  function normalizeAngleMarkerInput(input) { const value = String(input || '').trim(); return /^[0-7]$/.test(value) ? Number(value) : null; }
  function normalizeRightAngleMarkerInput(input) { const value = String(input || '').trim(); return value === '0' || value === '1' ? Number(value) : null; }
  function getLabelStyle(type, id) {
    labelStyleState[type] = labelStyleState[type] || {};
    if (!labelStyleState[type][id]) {
      labelStyleState[type][id] = styleDefaults[type] && styleDefaults[type][id]
        ? JSON.parse(JSON.stringify(styleDefaults[type][id]))
        : { color: '#2a5bd7', rotation: 0 };
    }
    return labelStyleState[type][id];
  }
  function registerSegmentObjectAnchor(type, id, start, end) {
    const screenStart = userToScreenPoint(start);
    const screenEnd = userToScreenPoint(end);
    const hitWidthPx = 20;
    const boxWidthPx = 14;
    const dx = screenEnd.x - screenStart.x;
    const dy = screenEnd.y - screenStart.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const hx = (hitWidthPx / 2) * nx;
    const hy = (hitWidthPx / 2) * ny;
    const hitCorners = [
      { x: screenStart.x + hx, y: screenStart.y + hy },
      { x: screenEnd.x + hx, y: screenEnd.y + hy },
      { x: screenEnd.x - hx, y: screenEnd.y - hy },
      { x: screenStart.x - hx, y: screenStart.y - hy }
    ];
    const xs = hitCorners.map(function (p) { return p.x; });
    const ys = hitCorners.map(function (p) { return p.y; });
    currentLabelAnchors.push({
      type: type,
      id: id,
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
      screenRect: {
        left: Math.min.apply(null, xs),
        right: Math.max.apply(null, xs),
        top: Math.min.apply(null, ys),
        bottom: Math.max.apply(null, ys)
      },
      boxWidthPx: len,
      boxHeightPx: boxWidthPx,
      fontSize: 16,
      rotation: Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI,
      color: getLabelStyle(type, id).color
    });
  }
  function getLabelPosition(type, id, basePosition) {
    const stored = labelPositions[type][id];
    if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) return stored;
    labelPositions[type][id] = { x: basePosition.x, y: basePosition.y };
    return labelPositions[type][id];
  }
  function getLabelBounds(anchor) {
    const padPx = 6;
    const widthPx = anchor.boxWidthPx && anchor.boxHeightPx
      ? Math.max(10, anchor.boxWidthPx)
      : anchor.screenRect ? Math.max(10, (anchor.screenRect.right - anchor.screenRect.left) + padPx * 2) : Math.max(10, String(anchor.text || '').length * anchor.fontSize * 0.56) + padPx * 2;
    const heightPx = anchor.boxWidthPx && anchor.boxHeightPx
      ? Math.max(10, anchor.boxHeightPx)
      : anchor.screenRect ? Math.max(10, (anchor.screenRect.bottom - anchor.screenRect.top) + padPx * 2) : Math.max(10, anchor.fontSize) + padPx * 2;
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
  function userToScreenPoint(point) { return { x: board.origin.scrCoords[1] + point.x * board.unitX, y: board.origin.scrCoords[2] - point.y * board.unitY }; }
  function createSelectableText(position, text, fontSize, labelKey, options) {
    return window.InstantGeometrySharedLabels.createSelectableText({
      board: board, labelLayer: labelLayer, currentLabelAnchors: currentLabelAnchors, getLabelStyle: getLabelStyle,
      position: position, text: text, fontSize: fontSize, labelKey: labelKey, options: options
    });
  }

  function circleIntersections(center1, radius1, center2, radius2) {
    const dx = center2.x - center1.x;
    const dy = center2.y - center1.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-8 || d > radius1 + radius2 + 1e-8 || d < Math.abs(radius1 - radius2) - 1e-8) return [];
    const a = (radius1 * radius1 - radius2 * radius2 + d * d) / (2 * d);
    const h2 = Math.max(0, radius1 * radius1 - a * a);
    const h = Math.sqrt(h2);
    const mx = center1.x + (a * dx) / d;
    const my = center1.y + (a * dy) / d;
    const rx = -dy * (h / d);
    const ry = dx * (h / d);
    const p1 = { x: mx + rx, y: my + ry };
    const p2 = { x: mx - rx, y: my - ry };
    return h < 1e-8 ? [p1] : [p1, p2];
  }
  function signedArea(points) {
    let sum = 0;
    for (let i = 0; i < points.length; i += 1) {
      const p = points[i];
      const q = points[(i + 1) % points.length];
      sum += p.x * q.y - q.x * p.y;
    }
    return sum / 2;
  }
  function orientation(a, b, c) { return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); }
  function onSegment(a, b, c) {
    return Math.min(a.x, c.x) - 1e-8 <= b.x && b.x <= Math.max(a.x, c.x) + 1e-8 &&
      Math.min(a.y, c.y) - 1e-8 <= b.y && b.y <= Math.max(a.y, c.y) + 1e-8;
  }
  function segmentsIntersect(a, b, c, d) {
    const o1 = orientation(a, b, c);
    const o2 = orientation(a, b, d);
    const o3 = orientation(c, d, a);
    const o4 = orientation(c, d, b);
    if (((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))) return true;
    if (Math.abs(o1) < 1e-8 && onSegment(a, c, b)) return true;
    if (Math.abs(o2) < 1e-8 && onSegment(a, d, b)) return true;
    if (Math.abs(o3) < 1e-8 && onSegment(c, a, d)) return true;
    if (Math.abs(o4) < 1e-8 && onSegment(c, b, d)) return true;
    return false;
  }
  function isSimpleHexagon(points) {
    const edges = [
      [points[0], points[1]], [points[1], points[2]], [points[2], points[3]],
      [points[3], points[4]], [points[4], points[5]], [points[5], points[0]]
    ];
    const skip = { '0-1': true, '1-2': true, '2-3': true, '3-4': true, '4-5': true, '0-5': true };
    for (let i = 0; i < edges.length; i += 1) {
      for (let j = i + 1; j < edges.length; j += 1) {
        if (skip[i + '-' + j]) continue;
        if (segmentsIntersect(edges[i][0], edges[i][1], edges[j][0], edges[j][1])) return false;
      }
    }
    return true;
  }

  function getBaseHexagon() {
    const ab = getInputValue('sideABLen');
    const bc = getInputValue('sideBCLen');
    const cd = getInputValue('sideCDLen');
    const de = getInputValue('sideDELen');
    const ef = getInputValue('sideEFLen');
    const fa = getInputValue('sideFALen');
    const ac = getInputValue('diagACLen');
    const ad = getInputValue('diagADLen');
    const ae = getInputValue('diagAELen');

    const A = { x: 0, y: 0 };
    const B = { x: ab, y: 0 };
    const cCandidates = circleIntersections(A, ac, B, bc).filter(function (point) { return point.y > 0; });
    if (!cCandidates.length) throw new Error('この条件では六角形を作れません。6辺・AC・AD・AE を見直してください。');
    const C = cCandidates.sort(function (l, r) { return r.y - l.y; })[0];
    const dCandidates = circleIntersections(A, ad, C, cd);
    if (!dCandidates.length) throw new Error('この条件では六角形を作れません。6辺・AC・AD・AE を見直してください。');

    let best = null;
    dCandidates.forEach(function (D) {
      const eCandidates = circleIntersections(A, ae, D, de);
      eCandidates.forEach(function (E) {
        const fCandidates = circleIntersections(A, fa, E, ef);
        fCandidates.forEach(function (F) {
          const points = [A, B, C, D, E, F];
          const area = signedArea(points);
          if (area <= 1e-6) return;
          if (!isSimpleHexagon(points)) return;
          const score = area + (Math.min(C.y, D.y, E.y, F.y) > -1e-6 ? 1000 : 0);
          if (!best || score > best.score) best = { points: points, score: score };
        });
      });
    });
    if (!best) throw new Error('この条件では六角形を作れません。6辺・AC・AD・AE を見直してください。');

    const points = best.points;
    const centroid = polygonCentroidFromList(points);
    const centered = {};
    pointIds.forEach(function (id, index) {
      centered[id] = { x: points[index].x - centroid.x, y: points[index].y - centroid.y };
    });
    const baseList = pointIds.map(function (id) { return centered[id]; });
    const xs = baseList.map(function (p) { return p.x; });
    const ys = baseList.map(function (p) { return p.y; });
    return {
      basePoints: centered,
      baseBounds: { width: Math.max.apply(null, xs) - Math.min.apply(null, xs), height: Math.max.apply(null, ys) - Math.min.apply(null, ys) },
      side: (ab + bc + cd + de + ef + fa) / 6,
      area: polygonArea(points)
    };
  }

  function getGeometryFromInputs() {
    const base = getBaseHexagon();
    const transformed = transformBasePoints(base.basePoints);
    return {
      points: transformed.points,
      centroid: transformed.centroid,
      side: base.side * figureState.scale,
      area: base.area * figureState.scale * figureState.scale,
      baseBounds: { width: base.baseBounds.width * figureState.scale, height: base.baseBounds.height * figureState.scale }
    };
  }

  function getAngleData(id, geometry) {
    const index = pointIds.indexOf(id);
    const prevId = pointIds[(index - 1 + pointIds.length) % pointIds.length];
    const nextId = pointIds[(index + 1) % pointIds.length];
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
    const P = geometry.points;
    const G = geometry.centroid;
    if (type === 'point') return getPointDefault(G, P[id]);
    if (type === 'segment') {
      const pair = { AB: [P.A, P.B], BC: [P.B, P.C], CD: [P.C, P.D], DE: [P.D, P.E], EF: [P.E, P.F], FA: [P.F, P.A] }[id];
      return getPerpendicularDefault(pair[0], pair[1], G, geometry.side * 0.18);
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
  function getCustomAreaText(fallback) {
    const custom = window.InstantGeometrySharedLabelConfig.normalizeCustomLabelInput(customLabelText.area.main);
    return custom ? appendUnit(custom, true) : appendUnit(fallback, true);
  }
  function getLabelText(type, id, geometry) {
    const P = geometry.points;
    if (type === 'point') return getPointLabelToken(id);
    if (type === 'segment') {
      const pair = { AB: [P.A, P.B], BC: [P.B, P.C], CD: [P.C, P.D], DE: [P.D, P.E], EF: [P.E, P.F], FA: [P.F, P.A] }[id];
      return getCustomSegmentText(id, formatNumber(segmentLength(pair[0], pair[1])));
    }
    if (type === 'angle') {
      const base = angleMode === 'degrees' ? (formatNumber(getAngleMeasureDegrees(id, geometry)) + '°') : formatNumber(getAngleMeasureDegrees(id, geometry) * Math.PI / 180);
      return getCustomAngleText(id, base);
    }
    return getCustomAreaText(formatNumber(geometry.area));
  }
  function getGeneralConfigs() {
    return pointIds.map(function (id) { return { type: 'point', id: id }; })
      .concat(segmentIds.map(function (id) { return { type: 'segment', id: id }; }))
      .concat(angleIds.map(function (id) { return { type: 'angle', id: id }; }))
      .concat([{ type: 'area', id: 'main' }]);
  }
  function getToggleLabel(config) {
    if (config.type === 'point') return getPointLabelToken(config.id);
    if (config.type === 'segment') return getSegmentName(config.id);
    if (config.type === 'angle') return getAngleName(config.id);
    return getAreaName();
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
    getGeneralConfigs().forEach(function (config) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'download-btn btn-bd';
      if (!labelState[config.type][config.id]) button.style.opacity = '0.55';
      button.textContent = getToggleLabel(config);
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
            firstBinary: true, secondBinary: true
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
      board: board, anchor: anchor, rotatePoint: rotatePoint, getLabelBounds: getLabelBounds, isPaletteOpen: isPaletteOpen
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
    return pointInPolygon(point, pointIds.map(function (id) { return currentGeometry.points[id]; }));
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
    const points = pointIds.map(function (id) { return geometry.points[id]; });
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
    const P = geometry.points;
    const points = pointIds.map(function (id) { return board.create('point', [P[id].x, P[id].y], { name: '', size: 3, fixed: true, strokeColor: '#111111', fillColor: '#111111' }); });
    board.create('polygon', points, { borders: { visible: false, fixed: true, highlight: false }, fillColor: hexToRgba(figureState.color, 0.08), fillOpacity: 0, vertices: { visible: false }, highlight: false });
    const pairMap = { AB: [points[0], points[1]], BC: [points[1], points[2]], CD: [points[2], points[3]], DE: [points[3], points[4]], EF: [points[4], points[5]], FA: [points[5], points[0]] };
    segmentIds.forEach(function (id) {
      if (labelState.segment[id] || segmentLineMode[id] !== 0) {
        board.create('segment', pairMap[id], {
          fixed: true,
          strokeWidth: 2,
          strokeColor: getLabelStyle('segmentObject', id).color,
          highlight: false
        });
        registerSegmentObjectAnchor('segmentObject', id, P[id.charAt(0)], P[id.charAt(1)]);
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
    const style = getLabelStyle('angleMark', id); const color = style.color || '#687086';
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
    pointIds.forEach(function (id) {
      if (!labelState.point[id]) return;
      createSelectableText(getLabelPosition('point', id, getDefaultPosition('point', id, geometry)), getPointLabelToken(id), labelFontSize.point[id], { type: 'point', id: id }, { color: '#1f2430' });
    });
    const P = geometry.points;
    const pairMap = { AB: [P.A, P.B], BC: [P.B, P.C], CD: [P.C, P.D], DE: [P.D, P.E], EF: [P.E, P.F], FA: [P.F, P.A] };
    segmentIds.forEach(function (id) {
      if (!labelState.segment[id]) return;
      window.InstantGeometrySharedOrnaments.drawSideArcLabel({
        board: board, P: pairMap[id][0], Q: pairMap[id][1], center: geometry.centroid, text: getLabelText('segment', id, geometry),
        labelType: 'segment', labelId: id, labelFontGroup: 'segment', showArc: segmentArcMode[id] !== 0,
        getLabelPosition: getLabelPosition, getLabelStyle: getLabelStyle, createSelectableText: createSelectableText, labelFontSize: labelFontSize
      });
    });
    angleIds.forEach(function (id) {
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
      setStatus('六角形を描画しました。', false);
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
    const anchorHit = findAnchorAtPoint(point);
    if (anchorHit) { selectedLabel = anchorHit; selectedFigure = false; isPaletteOpen = false; render(); return; }
    if (selectedFigure && pointInFigureZone(point)) {
      dragState = { mode: 'figure-move', target: 'figure', startClient: { x: event.clientX, y: event.clientY }, offsetStart: { x: figureState.offset.x, y: figureState.offset.y } };
      return;
    }
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
    inputElements.sideABLen.value = '5'; inputElements.sideBCLen.value = '4.7'; inputElements.sideCDLen.value = '4.4';
    inputElements.sideDELen.value = '4.2'; inputElements.sideEFLen.value = '4.5'; inputElements.sideFALen.value = '5.1';
    inputElements.diagACLen.value = '7.5'; inputElements.diagADLen.value = '8.3'; inputElements.diagAELen.value = '8.1';
    exportAspectIndex = 0; unitIndex = 1; angleMode = 'degrees'; zoomScale = 1;
    labelStyleState = JSON.parse(JSON.stringify(styleDefaults));
    Object.keys(labelPositions).forEach(function (group) { Object.keys(labelPositions[group]).forEach(function (id) { labelPositions[group][id] = null; labelFontSize[group][id] = labelFontDefaults[group][id]; labelState[group][id] = defaultLabelState[group][id]; }); });
    Object.keys(angleMarkerMode).forEach(function (id) { angleMarkerMode[id] = 0; });
    Object.keys(rightAngleMarkerMode).forEach(function (id) { rightAngleMarkerMode[id] = 0; });
    Object.keys(segmentArcMode).forEach(function (id) { segmentArcMode[id] = 1; });
    Object.keys(segmentLineMode).forEach(function (id) { segmentLineMode[id] = 1; });
    Object.keys(customLabelText.segment).forEach(function (id) { customLabelText.segment[id] = ''; });
    Object.keys(customLabelText.angle).forEach(function (id) { customLabelText.angle[id] = ''; });
    customLabelText.area.main = '';
    pointIds.forEach(function (id) { pointLabelText[id] = id; });
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

  updateRatioButton(); updateUnitButton(); updateAngleModeButton(); updateDockToggleButtons(); renderLabelToggleButtons(); render();
})();
