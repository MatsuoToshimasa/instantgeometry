(function () {
  'use strict';

  const stage = document.getElementById('stage');
  const statusBox = document.getElementById('statusBox');
  const baseABInput = document.getElementById('baseABInput');
  const baseDEInput = document.getElementById('baseDEInput');
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

  const TOP_ANGLE_A = 50;
  const TOP_ANGLE_B = 60;
  const POINT_IDS = ['A', 'B', 'C', 'D', 'E'];
  const SEGMENTS = {
    AB: ['A', 'B'],
    AC: ['A', 'C'],
    BC: ['B', 'C'],
    CD: ['C', 'D'],
    CE: ['C', 'E'],
    DE: ['D', 'E']
  };
  const ANGLES = {
    CAB: ['C', 'A', 'B'],
    ABC: ['A', 'B', 'C'],
    ACB: ['A', 'C', 'B'],
    CDE: ['C', 'D', 'E'],
    CED: ['C', 'E', 'D'],
    DCE: ['D', 'C', 'E']
  };
  const AREAS = {
    ABC: ['A', 'B', 'C'],
    CDE: ['C', 'D', 'E']
  };
  const state = {
    pointInputs: { A: 'A', B: 'B', C: 'C', D: 'D', E: 'E' },
    segmentInputs: { AB: ' ', AC: '', BC: '', CD: '', CE: '', DE: '' },
    segmentKinds: { AB: 'plain', AC: 'plain', BC: 'plain', CD: 'plain', CE: 'plain', DE: 'plain' },
    segmentArcVisible: { AB: true, AC: true, BC: true, CD: true, CE: true, DE: true },
    angleInputs: { CAB: ' ', ABC: ' ', ACB: '', CDE: '', CED: '', DCE: '' },
    angleKinds: { CAB: 'hidden', ABC: 'hidden', ACB: 'hidden', CDE: 'hidden', CED: 'hidden', DCE: 'hidden' },
    areaInputs: { ABC: '', CDE: '' },
    areaColors: { ABC: '#2a5bd7', CDE: '#2a5bd7' }
  };
  state.labelScales = state.labelScales || {};

  let currentGeometry = null;

  const LabelEngine = window.InstantGeometryDrawLabelEngine || window.InstantGeometryTriangleLabelEngine || null;
  let labelController = null;

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

  function scaledFontSize(kind, id, baseSize) {
    return Math.max(8, Math.round(Number(baseSize) * getLabelScale(kind, id)));
  }

  function getControllerLabelValue(kind, id) {
    if (kind === 'point') return state.pointInputs[id] || '';
    if (kind === 'segment') return state.segmentInputs[id] || '';
    if (kind === 'angle') return state.angleInputs[id] || '';
    if (kind === 'area') return state.areaInputs[id] || '';
    return '';
  }

  function setControllerLabelValue(kind, id, value) {
    let normalizedValue = value === LabelEngine.DECIMAL_NUMERIC_LABEL_VALUE ? ' ' : value;
    if (isRatioLabelValue(normalizedValue)) {
      const parsed = parseRatioLabelInput(getRatioLabelInput(normalizedValue));
      if (!parsed) throw new Error('比の値を入力してください。');
      normalizedValue = RATIO_LABEL_PREFIX + parsed.source;
    }
    if (kind === 'point') {
      state.pointInputs[id] = normalizedValue || '';
    } else if (kind === 'segment') {
      state.segmentInputs[id] = normalizedValue || '';
      if (normalizedValue === '') state.segmentArcVisible[id] = false;
    } else if (kind === 'angle') {
      state.angleInputs[id] = normalizedValue || '';
    } else if (kind === 'area') {
      state.areaInputs[id] = normalizedValue || '';
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
    let angleValue = null;
    if (currentGeometry) {
      if (typeof ANGLE_LABELS !== 'undefined' && ANGLE_LABELS[id] && currentGeometry.points) {
        const ids = ANGLE_LABELS[id].points;
        angleValue = angleDegrees(currentGeometry.points[ids[0]], currentGeometry.points[ids[1]], currentGeometry.points[ids[2]]);
      } else if (typeof ANGLES !== 'undefined' && ANGLES[id] && currentGeometry.unitPoints) {
        const ids = ANGLES[id];
        angleValue = angleDegrees(currentGeometry.unitPoints[ids[0]], currentGeometry.unitPoints[ids[1]], currentGeometry.unitPoints[ids[2]]);
      }
    }
    if (window.InstantGeometryMobileAngleOrnaments) {
      return window.InstantGeometryMobileAngleOrnaments.appendAngleKindSelect(body, buildSelectFn, state.angleKinds[id] || 'hidden', angleValue);
    }
    const built = buildSelectFn('角マーク', state.angleKinds[id] || 'hidden', [
      { value: 'hidden', label: 'なし' },
      { value: 'plain', label: '弧' }
    ]);
    body.appendChild(built.field);
    return built.select;
  }

  function getAreaTitle(id) {
    if (currentGeometry && typeof areaRegions === 'function') {
      try {
        const areas = currentGeometry.values !== undefined
          ? areaRegions(currentGeometry.points, currentGeometry.values)
          : areaRegions(currentGeometry.points || currentGeometry.unitPoints || {}, currentGeometry.values || {});
        const area = areas.find(function (item) { return item.id === id; });
        if (area && area.name) return area.name;
      } catch (error) {}
    }
    return '面ラベル';
  }

  if (LabelEngine && typeof LabelEngine.createController === 'function') {
    labelController = LabelEngine.createController({
      enabledLabels: { point: true, segment: true, angle: true, area: true },
      sheetTitle: sheetTitle,
      sheetBody: sheetBody,
      editSheet: editSheet,
      sheetBackdrop: sheetBackdrop,
      closeSheets: closeSheets,
      render: render,
      labelMoveEnabled: false,
      
      onError: function (error) {
        setStatus(error.message || '入力を確認してください。', true);
      },
      getModalSpec: function (kind, id, modalType) {
        return LabelEngine.getStandardModalSpec(modalType, { moveAction: false });
      },
      getTitle: function (kind, id) {
        if (kind === 'point') return '点ラベル';
        if (kind === 'segment') return '線分ラベル';
        if (kind === 'angle') return '角ラベル';
        return getAreaTitle(id);
      },
      getLabelValue: getControllerLabelValue,
      setLabelValue: setControllerLabelValue,
      getLabelScale: getLabelScale,
      setLabelScale: setLabelScale,
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
      hasColorField: function (kind) {
        return kind === 'area';
      },
      getColor: function (kind, id) {
        return kind === 'area' ? (state.areaColors[id] || '#2a5bd7') : '#2a5bd7';
      },
      setColor: function (kind, id, value) {
        if (kind === 'area') state.areaColors[id] = value || '#2a5bd7';
      }
    });
  }

  function removeUnsupportedMoveButton() {}

  if (window.MutationObserver && sheetBody) {
    new MutationObserver(removeUnsupportedMoveButton).observe(sheetBody, { childList: true, subtree: true });
  }

  function openLabelSheet(kind, id) {
    if (labelController && typeof labelController.openEditSheet === 'function') {
      labelController.openEditSheet(kind, id);
      removeUnsupportedMoveButton();
      return;
    }
    openEditSheet(kind, id);
  }

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

  function parseNatural(value, name) {
    const text = String(value || '').trim();
    if (!/^[1-9][0-9]*$/.test(text)) throw new Error(name + ' には自然数を入力してください。');
    return Number(text);
  }

  function formatNumber(value) {
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
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

  function areaLabelColor(hex) {
    const hsl = hexToHsl(hex || '#2a5bd7');
    if (hsl.s < 8) return hsl.l > 50 ? '#4b5563' : '#111827';
    return hslToHex(hsl.h, Math.max(42, hsl.s), 26);
  }

  function midpoint(P, Q) {
    return { x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 };
  }

  function polygonCentroid(points) {
    let areaTwice = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < points.length; i += 1) {
      const p = points[i];
      const q = points[(i + 1) % points.length];
      const cross = p.x * q.y - q.x * p.y;
      areaTwice += cross;
      cx += (p.x + q.x) * cross;
      cy += (p.y + q.y) * cross;
    }
    if (Math.abs(areaTwice) < 1e-9) {
      return points.reduce(function (acc, point) {
        acc.x += point.x / points.length;
        acc.y += point.y / points.length;
        return acc;
      }, { x: 0, y: 0 });
    }
    return { x: cx / (3 * areaTwice), y: cy / (3 * areaTwice) };
  }

  function distanceToSegment(point, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
    const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
    return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t));
  }

  function fittedAreaLabel(points, label, maxFontSize) {
    const point = polygonCentroid(points);
    let distance = Infinity;
    for (let i = 0; i < points.length; i += 1) {
      distance = Math.min(distance, distanceToSegment(point, points[i], points[(i + 1) % points.length]));
    }
    const textLength = String(label || '').length || 1;
    const widthFactor = Math.max(1.05, textLength * 0.64);
    return {
      x: point.x,
      y: point.y,
      fontSize: Math.max(14, Math.min(maxFontSize || 54, Math.floor((distance * 1.82) / widthFactor)))
    };
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
    if (hasNumericMode && isRatioLabelValue(value)) return 'ratio';
    if (hasNumericMode && isNumericLabelValue(value)) return 'numeric';
    return 'text';
  }

  function getPointName(id) {
    const raw = String(state.pointInputs[id] || '').trim();
    return raw || id;
  }

  function getPointLabel(id) {
    const raw = String(state.pointInputs[id] || '').trim();
    return raw || null;
  }

  function distance(P, Q) {
    return Math.hypot(Q.x - P.x, Q.y - P.y);
  }

  function angleDegrees(P, vertex, Q) {
    const v1 = { x: P.x - vertex.x, y: P.y - vertex.y };
    const v2 = { x: Q.x - vertex.x, y: Q.y - vertex.y };
    const len = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
    if (!len) return 0;
    const cos = Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / len));
    return Math.acos(cos) * 180 / Math.PI;
  }

  function triangleArea(P, Q, R) {
    return Math.abs((P.x * (Q.y - R.y) + Q.x * (R.y - P.y) + R.x * (P.y - Q.y)) / 2);
  }

  function angleArcPoints(vertex, p1, p2, radius) {
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

  function toRadians(deg) {
    return deg * Math.PI / 180;
  }

  function unitToScreen(point, scale) {
    return {
      x: 500 + point.x * scale,
      y: 500 - point.y * scale
    };
  }

  function computeGeometry() {
    const ab = parseNatural(baseABInput.value, 'AB');
    const de = parseNatural(baseDEInput.value, 'DE');
    const cotA = 1 / Math.tan(toRadians(TOP_ANGLE_A));
    const cotB = 1 / Math.tan(toRadians(TOP_ANGLE_B));
    const height = ab / (cotA + cotB);
    const scaleRatio = de / ab;
    const unitPoints = {
      A: { x: -height * cotA, y: height },
      B: { x: height * cotB, y: height },
      C: { x: 0, y: 0 },
      D: { x: -height * cotB * scaleRatio, y: -height * scaleRatio },
      E: { x: height * cotA * scaleRatio, y: -height * scaleRatio }
    };
    const xs = POINT_IDS.map(function (id) { return unitPoints[id].x; });
    const ys = POINT_IDS.map(function (id) { return unitPoints[id].y; });
    const width = Math.max.apply(null, xs) - Math.min.apply(null, xs);
    const heightTotal = Math.max.apply(null, ys) - Math.min.apply(null, ys);
    const scale = Math.min(118, 720 / Math.max(1, width), 660 / Math.max(1, heightTotal));
    const points = {};
    POINT_IDS.forEach(function (id) {
      points[id] = unitToScreen(unitPoints[id], scale);
    });
    return { points: points, unitPoints: unitPoints, values: { AB: ab, DE: de } };
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
    const merged = Object.assign({
      x: P.x,
      y: P.y,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      'font-size': 54,
      'font-weight': 700,
      fill: '#1f2430'
    }, attrs || {});
    if (!isRatioLabelValue(text) && window.InstantGeometrySharedLabels && typeof window.InstantGeometrySharedLabels.createSvgKatexLabel === 'function') {
      const katexNode = window.InstantGeometrySharedLabels.createSvgKatexLabel({
        createSvg: createSvg,
        text: text,
        attrs: merged,
        kind: merged['data-label-kind'] || merged['data-kind'],
        id: merged['data-label-id'] || merged['data-id']
      });
      if (katexNode) {
        stage.appendChild(katexNode);
        return katexNode;
      }
    }
    const node = createSvg('text', merged);
    if (isRatioLabelValue(text)) {
      const parsed = parseRatioLabelInput(getRatioLabelInput(text));
      const left = createSvg('tspan', {});
      left.textContent = parsed.left || parsed.mark || '';
      const sep = createSvg('tspan', { dx: 6 });
      sep.textContent = ':';
      const right = createSvg('tspan', { dx: 6 });
      right.textContent = parsed.right || parsed.value || '';
      node.appendChild(left);
      node.appendChild(sep);
      node.appendChild(right);
    } else {
      node.textContent = text;
    }
    stage.appendChild(node);
    return node;
  }

  function attachHit(element, kind, id) {
    element.style.cursor = 'pointer';
    element.setAttribute('data-kind', kind);
    element.setAttribute('data-id', id);
    element.addEventListener('click', function (event) {
      event.stopPropagation();
      openLabelSheet(kind, id);
    });
  }


  function drawSideKind(kind, P, Q) {
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
    const addLine = function (cx, cy, half) {
      stage.appendChild(createSvg('line', {
        x1: cx - nx * half,
        y1: cy - ny * half,
        x2: cx + nx * half,
        y2: cy + ny * half,
        stroke: '#2a5bd7',
        'stroke-width': 3,
        'stroke-linecap': 'round'
      }));
    };
    if (kind === 'circle') {
      stage.appendChild(createSvg('circle', { cx: mid.x, cy: mid.y, r: 8, fill: 'none', stroke: '#2a5bd7', 'stroke-width': 3 }));
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
        stroke: '#2a5bd7',
        'stroke-width': 3,
        'stroke-linecap': 'round'
      }));
    } else if (kind === 'triangle') {
      const p1 = { x: mid.x + tx * 12, y: mid.y + ty * 12 };
      const p2 = { x: mid.x - tx * 8 + nx * 7, y: mid.y - ty * 8 + ny * 7 };
      const p3 = { x: mid.x - tx * 8 - nx * 7, y: mid.y - ty * 8 - ny * 7 };
      stage.appendChild(createSvg('polygon', {
        points: [p1, p2, p3].map(function (p) { return p.x + ',' + p.y; }).join(' '),
        fill: '#2a5bd7',
        stroke: '#2a5bd7',
        'stroke-width': 1.5
      }));
    }
  }

  function quadraticPoint(P, control, Q, t) {
    return {
      x: (1 - t) * (1 - t) * P.x + 2 * (1 - t) * t * control.x + t * t * Q.x,
      y: (1 - t) * (1 - t) * P.y + 2 * (1 - t) * t * control.y + t * t * Q.y
    };
  }

  function quadraticPathSegment(P, control, Q, start, end) {
    const points = [];
    for (let i = 0; i <= 20; i += 1) {
      const t = start + (end - start) * (i / 20);
      points.push(quadraticPoint(P, control, Q, t));
    }
    return pathFromPoints(points);
  }

  function drawSegmentArc(P, Q, labelPoint) {
    const mid = midpoint(P, Q);
    const control = { x: labelPoint.x * 2 - mid.x, y: labelPoint.y * 2 - mid.y };
    const gapHalf = 0.14;
    ['left', 'right'].forEach(function (side) {
      stage.appendChild(createSvg('path', {
        d: side === 'left'
          ? quadraticPathSegment(P, control, Q, 0, 0.5 - gapHalf)
          : quadraticPathSegment(P, control, Q, 0.5 + gapHalf, 1),
        fill: 'none',
        stroke: '#2a5bd7',
        'stroke-width': 2,
        'stroke-linecap': 'round',
        'stroke-dasharray': '6 5'
      }));
    });
  }

  function outwardLabelPoint(id, P, Q) {
    const mid = midpoint(P, Q);
    const dx = Q.x - P.x;
    const dy = Q.y - P.y;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    const toward = id.indexOf('AB') !== -1 || id === 'AC' || id === 'BC' ? { x: 500, y: 500 } : { x: 500, y: 500 };
    if (nx * (toward.x - mid.x) + ny * (toward.y - mid.y) > 0) {
      nx *= -1;
      ny *= -1;
    }
    return { x: mid.x + nx * 40, y: mid.y + ny * 40 };
  }

  function getSegmentText(id) {
    const raw = String(state.segmentInputs[id] || '');
    if (!raw) return null;
    if (isRatioLabelValue(raw)) return raw;
    if (!isNumericLabelValue(raw)) return raw;
    const ends = SEGMENTS[id];
    return formatNumber(distance(currentGeometry.unitPoints[ends[0]], currentGeometry.unitPoints[ends[1]]));
  }

  function getAngleText(id) {
    const raw = String(state.angleInputs[id] || '');
    if (!raw) return null;
    if (isRatioLabelValue(raw)) return raw;
    if (!isNumericLabelValue(raw)) return raw;
    const ids = ANGLES[id];
    return formatNumber(angleDegrees(currentGeometry.unitPoints[ids[0]], currentGeometry.unitPoints[ids[1]], currentGeometry.unitPoints[ids[2]])) + '°';
  }

  function getAreaText(id) {
    const raw = String(state.areaInputs[id] || '');
    if (!raw) return null;
    if (isRatioLabelValue(raw)) return raw;
    if (!isNumericLabelValue(raw)) return raw;
    const ids = AREAS[id];
    return formatNumber(triangleArea(currentGeometry.unitPoints[ids[0]], currentGeometry.unitPoints[ids[1]], currentGeometry.unitPoints[ids[2]]));
  }

  function renderSegments(points) {
    Object.keys(SEGMENTS).forEach(function (id) {
      const ends = SEGMENTS[id];
      const line = drawLine(points[ends[0]], points[ends[1]]);
      attachHit(line, 'segment', id);
      const hit = drawLine(points[ends[0]], points[ends[1]], { stroke: 'transparent', 'stroke-width': 30 });
      attachHit(hit, 'segment', id);
      drawSideKind(state.segmentKinds[id], points[ends[0]], points[ends[1]]);
    });
  }

  function renderSegmentLabels(points) {
    Object.keys(SEGMENTS).forEach(function (id) {
      const labelText = getSegmentText(id);
      if (!labelText) return;
      const ends = SEGMENTS[id];
      const P = points[ends[0]];
      const Q = points[ends[1]];
      const position = outwardLabelPoint(id, P, Q);
      if (state.segmentArcVisible[id] !== false) drawSegmentArc(P, Q, position);
      const label = drawText(position, labelText, {
        class: 'shape-label segment-label',
        'data-label-kind': 'segment',
        'data-label-id': id,
        'data-kind': 'segment',
        'data-id': id,
        fill: '#2a5bd7',
        'font-size': 42
      });
      attachHit(label, 'segment', id);
    });
  }

  function renderAngleHits(points) {
    Object.keys(ANGLES).forEach(function (id) {
      const ids = ANGLES[id];
      const P = points[ids[0]];
      const V = points[ids[1]];
      const Q = points[ids[2]];
      const unitIds = ANGLES[id];
      const angleValue = angleDegrees(currentGeometry.unitPoints[unitIds[0]], currentGeometry.unitPoints[unitIds[1]], currentGeometry.unitPoints[unitIds[2]]);
      const kind = window.InstantGeometryMobileAngleOrnaments
        ? window.InstantGeometryMobileAngleOrnaments.normalizeAngleKind(state.angleKinds[id], angleValue)
        : state.angleKinds[id];
      const arc = angleArcPoints(V, P, Q, 58);
      if (kind !== state.angleKinds[id]) state.angleKinds[id] = kind;
      if (kind && kind !== 'hidden' && kind !== 'right') {
        const path = createSvg('path', {
          d: pathFromPoints(arc),
          fill: 'none',
          stroke: '#687086',
          'stroke-width': 3,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round'
        });
        attachHit(path, 'angle', id);
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
      attachHit(hit, 'angle', id);
      stage.appendChild(hit);
    });
  }

  function renderAngleLabels(points) {
    Object.keys(ANGLES).forEach(function (id) {
      const labelText = getAngleText(id);
      if (!labelText) return;
      const ids = ANGLES[id];
      const arc = angleArcPoints(points[ids[1]], points[ids[0]], points[ids[2]], 92);
      const label = drawText(arc[Math.floor(arc.length / 2)], labelText, {
        class: 'shape-label angle-label',
        'data-label-kind': 'angle',
        'data-label-id': id,
        'data-kind': 'angle',
        'data-id': id,
        fill: '#687086',
        'font-size': 40
      });
      attachHit(label, 'angle', id);
    });
  }

  function renderAreaLabels(points) {
    Object.keys(AREAS).forEach(function (id) {
      const ids = AREAS[id];
      const areaPoints = ids.map(function (pointId) { return points[pointId]; });
      const hit = createSvg('polygon', {
        points: ids.map(function (pointId) { return points[pointId].x + ',' + points[pointId].y; }).join(' '),
        fill: 'transparent',
        stroke: 'none'
      });
      attachHit(hit, 'area', id);
      stage.appendChild(hit);
      const labelText = getAreaText(id);
      if (!labelText) return;
      const fitted = fittedAreaLabel(areaPoints, labelText, 54);
      const label = drawText(fitted, labelText, {
        class: 'shape-label area-label',
        'data-kind': 'area',
        'data-id': id,
        fill: areaLabelColor(state.areaColors[id] || '#2a5bd7'),
        'font-size': fitted.fontSize,
        style: 'font-size:' + fitted.fontSize + 'px'
      });
      attachHit(label, 'area', id);
    });
  }

  function render() {
    try {
      currentGeometry = computeGeometry();
      const points = currentGeometry.points;
      stage.innerHTML = '';
      stage.setAttribute('viewBox', '0 0 1000 1000');
      stage.appendChild(createSvg('polygon', {
        points: ['A', 'B', 'C'].map(function (id) { return points[id].x + ',' + points[id].y; }).join(' '),
        fill: hexToRgba(state.areaColors.ABC || '#2a5bd7', 0.16),
        stroke: 'none'
      }));
      stage.appendChild(createSvg('polygon', {
        points: ['C', 'D', 'E'].map(function (id) { return points[id].x + ',' + points[id].y; }).join(' '),
        fill: hexToRgba(state.areaColors.CDE || '#2a5bd7', 0.16),
        stroke: 'none'
      }));
      renderAreaLabels(points);
      renderSegments(points);
      POINT_IDS.forEach(function (id) {
        const dot = createSvg('circle', { cx: points[id].x, cy: points[id].y, r: 8, fill: '#1f2430' });
        attachHit(dot, 'point', id);
        stage.appendChild(dot);
      });
      [
        { id: 'A', p: { x: points.A.x - 34, y: points.A.y - 32 } },
        { id: 'B', p: { x: points.B.x + 34, y: points.B.y - 32 } },
        { id: 'C', p: { x: points.C.x, y: points.C.y - 42 } },
        { id: 'D', p: { x: points.D.x - 34, y: points.D.y + 32 } },
        { id: 'E', p: { x: points.E.x + 34, y: points.E.y + 32 } }
      ].forEach(function (item) {
        const label = getPointLabel(item.id);
        if (!label) return;
        const labelNode = drawText(item.p, label, { 'data-label-kind': 'point', 'data-label-id': item.id, 'font-size': scaledFontSize('point', item.id, 54) });
        attachHit(labelNode, 'point', item.id);
      });
      renderSegmentLabels(points);
      renderAngleHits(points);
      renderAngleLabels(points);
      setStatus('A-C-E、B-C-D が一直線、AB ∥ DE となる2つの三角形を描画しました。', false);
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

  function buildColorPalette(labelText, value) {
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

  function openEditSheet(kind, id) {
    closeSheets();
    sheetTitle.textContent = kind === 'point' ? getPointName(id) : kind === 'segment' ? '線分 ' + id : kind === 'angle' ? '∠' + id : '面積 ' + id;
    let kindSelect = null;
    let arcCheckbox = null;
    let labelEditor = null;
    let colorPalette = null;

    if (kind === 'point') {
      labelEditor = buildLabelEditor('ラベル', state.pointInputs[id] || '', false);
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
    } else if (kind === 'angle') {
      const ids = ANGLES[id];
      const angleValue = currentGeometry ? angleDegrees(currentGeometry.unitPoints[ids[0]], currentGeometry.unitPoints[ids[1]], currentGeometry.unitPoints[ids[2]]) : null;
      if (window.InstantGeometryMobileAngleOrnaments) {
        kindSelect = window.InstantGeometryMobileAngleOrnaments.appendAngleKindSelect(sheetBody, buildSelect, state.angleKinds[id] || 'hidden', angleValue);
      } else {
        const builtAngle = buildSelect('種類', state.angleKinds[id] || 'hidden', [
          { value: 'hidden', label: 'なし' },
          { value: 'plain', label: '弧' }
        ]);
        kindSelect = builtAngle.select;
        sheetBody.appendChild(builtAngle.field);
      }
      labelEditor = buildLabelEditor('ラベル', state.angleInputs[id] || '', true);
      sheetBody.appendChild(labelEditor.field);
    } else {
      labelEditor = buildLabelEditor('ラベル', state.areaInputs[id] || '', true);
      sheetBody.appendChild(labelEditor.field);
      colorPalette = buildColorPalette('色', state.areaColors[id] || '#2a5bd7');
      sheetBody.appendChild(colorPalette.field);
    }


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
        state.pointInputs[id] = mode === 'text' ? text : '';
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
      } else if (kind === 'angle') {
        state.angleKinds[id] = kindSelect.value;
        if (mode === 'hidden') state.angleInputs[id] = '';
        else if (mode === 'numeric') state.angleInputs[id] = ' ';
        else if (mode === 'ratio') {
          const parsed = parseRatioLabelInput(text);
          if (!parsed) throw new Error('比の値を入力してください。');
          state.angleInputs[id] = RATIO_LABEL_PREFIX + parsed.source;
        }
        else state.angleInputs[id] = text || '';
      } else {
        if (mode === 'hidden') state.areaInputs[id] = '';
        else if (mode === 'numeric') state.areaInputs[id] = ' ';
        else if (mode === 'ratio') {
          const parsed = parseRatioLabelInput(text);
          if (!parsed) throw new Error('比の値を入力してください。');
          state.areaInputs[id] = RATIO_LABEL_PREFIX + parsed.source;
        }
        else state.areaInputs[id] = text || '';
        if (colorPalette) state.areaColors[id] = colorPalette.value;
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
      link.download = format === 'transparent' ? 'two-triangles-transparent.png' : 'two-triangles.png';
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
    pdf.save('two-triangles.pdf');
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

  baseABInput.addEventListener('input', render);
  baseDEInput.addEventListener('input', render);
  stage.addEventListener('click', function (event) {
    const target = event.target.closest && event.target.closest('[data-kind][data-id]');
    if (!target || !stage.contains(target)) return;
    const kind = target.getAttribute('data-kind');
    const id = target.getAttribute('data-id');
    openLabelSheet(kind, id);
  });

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

  render();
})();
