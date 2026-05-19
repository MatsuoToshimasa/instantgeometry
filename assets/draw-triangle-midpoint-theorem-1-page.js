(function () {
  'use strict';

  const stage = document.getElementById('stage');
  const statusBox = document.getElementById('statusBox');
  const mnInput = document.getElementById('mnInput');
  const amInput = document.getElementById('amInput');
  const anInput = document.getElementById('anInput');
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

  const SEGMENT_LABELS = {
    MN: { points: ['M', 'N'], color: '#2a5bd7', offset: { x: 0, y: -34 } },
    BC: { points: ['B', 'C'], color: '#2a5bd7', offset: { x: 0, y: 54 } },
    AM: { points: ['A', 'M'], color: '#2a5bd7', offset: { x: -34, y: -12 } },
    AN: { points: ['A', 'N'], color: '#2a5bd7', offset: { x: 34, y: -12 } },
    MB: { points: ['M', 'B'], color: '#2a5bd7', offset: { x: -38, y: 12 } },
    NC: { points: ['N', 'C'], color: '#2a5bd7', offset: { x: 38, y: 12 } }
  };

  const ANGLE_LABELS = {
    AMN: { points: ['A', 'M', 'N'] },
    ANM: { points: ['A', 'N', 'M'] },
    ABC: { points: ['A', 'B', 'C'] },
    ACB: { points: ['A', 'C', 'B'] }
  };
  const POINT_IDS = ['A', 'B', 'C', 'M', 'N'];

  const state = {
    pointInputs: { A: 'A', B: 'B', C: 'C', M: 'M', N: 'N' },
    segmentInputs: { MN: 'ratio:r,1', BC: 'ratio:r,2', AM: '', AN: '', MB: '', NC: '' },
    segmentKinds: { MN: 'plain', BC: 'plain', AM: 'double', AN: 'circle', MB: 'double', NC: 'circle' },
    segmentArcVisible: { MN: true, BC: true, AM: false, AN: false, MB: false, NC: false },
    angleInputs: { AMN: '', ANM: '', ABC: '', ACB: '' },
    angleKinds: { AMN: 'hidden', ANM: 'hidden', ABC: 'hidden', ACB: 'hidden' },
    areaInputs: { AMN: '', MNCB: '' },
    areaColors: { AMN: '#2a5bd7', MNCB: '#2a5bd7' },
    pointColors: { A: '#1f2430', B: '#1f2430', C: '#1f2430', M: '#1f2430', N: '#1f2430' },
    segmentColors: { MN: '#2a5bd7', BC: '#2a5bd7', AM: '#2a5bd7', AN: '#2a5bd7', MB: '#2a5bd7', NC: '#2a5bd7' },
    angleColors: { AMN: '#687086', ANM: '#687086', ABC: '#687086', ACB: '#687086' },
    angleArcScales: {},
    mathLabelScales: {},
    labelOffsets: {}
  };

  let currentGeometry = null;
  let moveMode = null;
  let moveDrag = null;
  let currentLabelBases = {};
  let labelController = null;

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

  function parsePositive(value, name) {
    const text = String(value || '').trim();
    const number = Number(text);
    if (!text || !Number.isFinite(number) || number <= 0) {
      throw new Error(name + ' には正の数を入力してください。');
    }
    return number;
  }

  function formatNumber(value) {
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
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
    const match = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!match) return { h: 221, s: 68, l: 50 };
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

  function hexToRgba(hex, alpha) {
    const match = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!match) return 'rgba(42,91,215,' + alpha + ')';
    const raw = match[1];
    return 'rgba(' + parseInt(raw.slice(0, 2), 16) + ',' + parseInt(raw.slice(2, 4), 16) + ',' + parseInt(raw.slice(4, 6), 16) + ',' + alpha + ')';
  }

  function areaLabelColor(hex) {
    const hsl = hexToHsl(hex || '#2a5bd7');
    if (hsl.s < 8) return hsl.l > 50 ? '#4b5563' : '#111827';
    return hslToHex(hsl.h, Math.max(42, hsl.s), 26);
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

  function midpoint(P, Q) {
    return {
      x: (P.x + Q.x) / 2,
      y: (P.y + Q.y) / 2
    };
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
    return {
      x: basePosition.x + offset.x,
      y: basePosition.y + offset.y
    };
  }

  function clampMathLabelScale(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 1;
    return Math.max(0.1, Math.min(4, number));
  }

  function clampAngleArcScale(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 1;
    return Math.max(0.3, Math.min(3, number));
  }

  function getMathLabelScale(kind, id) {
    return clampMathLabelScale(state.mathLabelScales[labelKey(kind, id)] || 1);
  }

  function setMathLabelScale(kind, id, value) {
    state.mathLabelScales[labelKey(kind, id)] = clampMathLabelScale(value);
  }

  function getAngleArcScale(id) {
    return clampAngleArcScale(state.angleArcScales[id] || 1);
  }

  function setAngleArcScale(id, value) {
    state.angleArcScales[id] = clampAngleArcScale(value);
  }

  function getLabelColor(kind, id) {
    if (kind === 'point') return (state.pointColors && state.pointColors[id]) || '#1f2430';
    if (kind === 'segment') return (state.segmentColors && state.segmentColors[id]) || (SEGMENT_LABELS[id] && SEGMENT_LABELS[id].color) || '#2a5bd7';
    if (kind === 'angle') return (state.angleColors && state.angleColors[id]) || '#687086';
    if (kind === 'area') return areaLabelColor((state.areaColors && state.areaColors[id]) || '#2a5bd7');
    return '#1f2430';
  }

  function setLabelColor(kind, id, value) {
    if (kind === 'point') state.pointColors[id] = value;
    else if (kind === 'segment') state.segmentColors[id] = value;
    else if (kind === 'angle') state.angleColors[id] = value;
    else if (kind === 'area') state.areaColors[id] = value;
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

  function isMoveTarget(kind, id) {
    return moveMode && moveMode.kind === kind && moveMode.id === id;
  }

  function updateMoveModeUi() {
    const active = Boolean(moveMode);
    document.body.classList.toggle('label-move-active', active);
    captureRoot.classList.toggle('label-move-active', active);
    moveToolbar.classList.toggle('open', active);
    moveToolbar.setAttribute('aria-hidden', active ? 'false' : 'true');
  }

  function pointerToSvgPoint(event) {
    const matrix = stage.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const point = stage.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const transformed = point.matrixTransform(matrix.inverse());
    return { x: transformed.x, y: transformed.y };
  }

  function startMoveDrag(event, kind, id) {
    event.preventDefault();
    event.stopPropagation();
    const offset = ensureLabelOffset(kind, id);
    moveDrag = {
      kind: kind,
      id: id,
      startPoint: pointerToSvgPoint(event),
      startOffset: { x: offset.x, y: offset.y }
    };
  }

  function addMoveHitArea(position, kind, id, fontSize, text) {
    if (!isMoveTarget(kind, id)) return;
    const rect = LabelEngine.createMoveHitArea(createSvg, position, kind, id, fontSize, text);
    attachHit(rect, kind, id);
    stage.appendChild(rect);
  }

  function isNumericLabelValue(value) {
    return value === ' ' || value === '0';
  }

  function isDecimalNumericLabelValue(value) {
    return LabelEngine.isDecimalNumericLabelValue(value);
  }

  function isAnyNumericLabelValue(value) {
    return isNumericLabelValue(value) || isDecimalNumericLabelValue(value);
  }

  const RATIO_LABEL_PREFIX = 'ratio:';
  const RATIO_LABEL_HINT = '例: r,1 / s,2 / t,3';

  function parseRatioLabelInput(value) {
    const source = String(value || '').trim();
    if (!source) return null;
    const parts = source.split(/[,:：]/).map(function (part) { return part.trim(); }).filter(Boolean);
    if (parts.length !== 2) throw new Error('比の値は「r,1」の形で入力してください。');
    const mark = parts[0].toLowerCase();
    if (!/^[rst]$/.test(mark)) throw new Error('比の値のマークは r, s, t から選んでください。');
    return { mark: mark, value: parts[1], source: mark + ',' + parts[1] };
  }

  function isRatioLabelValue(value) {
    return LabelEngine.isRatioLabelValue(value) || String(value || '').indexOf(RATIO_LABEL_PREFIX) === 0;
  }

  function getRatioLabelInput(value) {
    return LabelEngine.getRatioLabelInput(value);
  }

  function getDisplayMode(value, hasNumericMode) {
    return LabelEngine.getDisplayMode(value, hasNumericMode);
  }

  function getPointName(id) {
    const raw = String(state.pointInputs[id] || '').trim();
    return raw || id;
  }

  function getPointLabel(id) {
    const raw = String(state.pointInputs[id] || '').trim();
    return raw || null;
  }

  function angleDegrees(P, vertex, Q) {
    const v1 = { x: P.x - vertex.x, y: P.y - vertex.y };
    const v2 = { x: Q.x - vertex.x, y: Q.y - vertex.y };
    const len = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
    if (!len) return 0;
    const cos = Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / len));
    return Math.acos(cos) * 180 / Math.PI;
  }

  function angleLabelPosition(P, vertex, Q) {
    const a1 = Math.atan2(P.y - vertex.y, P.x - vertex.x);
    const a2 = Math.atan2(Q.y - vertex.y, Q.x - vertex.x);
    let delta = a2 - a1;
    while (delta <= -Math.PI) delta += Math.PI * 2;
    while (delta > Math.PI) delta -= Math.PI * 2;
    const midAngle = a1 + delta / 2;
    return {
      x: vertex.x + 78 * Math.cos(midAngle),
      y: vertex.y + 78 * Math.sin(midAngle)
    };
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
    if (isRatioLabelValue(text)) {
      const parsed = parseRatioLabelInput(getRatioLabelInput(text));
      const x = Number(merged.x) || 0;
      const y = Number(merged.y) || 0;
      const fontSize = Number(merged['font-size']) || 48;
      const textWidth = Math.max(fontSize * 0.7, parsed.value.length * fontSize * 0.62);
      const height = fontSize * 1.16;
      const width = parsed.mark === 't'
        ? Math.max(textWidth + fontSize * 0.8, height * 1.25)
        : Math.max(textWidth + fontSize * 0.55, height);
      const group = createSvg('g', {});
      const stroke = merged.fill || '#1f2430';
      const hitPadding = fontSize * 0.45;
      group.appendChild(createSvg('rect', {
        x: x - width / 2 - hitPadding,
        y: y - height / 2 - hitPadding,
        width: width + hitPadding * 2,
        height: height + hitPadding * 2,
        fill: 'transparent',
        'pointer-events': 'all'
      }));
      if (parsed.mark === 'r') {
        group.appendChild(createSvg('ellipse', { cx: x, cy: y, rx: width / 2, ry: height / 2, fill: '#ffffff', stroke: stroke, 'stroke-width': Math.max(2, fontSize * 0.055) }));
      } else if (parsed.mark === 't') {
        group.appendChild(createSvg('polygon', {
          points: [x + ',' + (y - height * 0.72), (x - width / 2) + ',' + (y + height * 0.48), (x + width / 2) + ',' + (y + height * 0.48)].join(' '),
          fill: '#ffffff',
          stroke: stroke,
          'stroke-width': Math.max(2, fontSize * 0.055),
          'stroke-linejoin': 'round'
        }));
      } else {
        group.appendChild(createSvg('rect', { x: x - width / 2, y: y - height / 2, width: width, height: height, rx: 5, ry: 5, fill: '#ffffff', stroke: stroke, 'stroke-width': Math.max(2, fontSize * 0.055) }));
      }
      const textNode = createSvg('text', merged);
      textNode.textContent = parsed.value;
      group.appendChild(textNode);
      stage.appendChild(group);
      return group;
    }
    const node = createSvg('text', merged);
    node.textContent = text;
    stage.appendChild(node);
    return node;
  }

  function attachHit(element, kind, id) {
    element.style.cursor = 'pointer';
    element.setAttribute('data-kind', kind);
    element.setAttribute('data-id', id);
    if (isMoveTarget(kind, id)) {
      element.classList.add('label-move-target');
      element.addEventListener('pointerdown', function (event) {
        startMoveDrag(event, kind, id);
      });
    }
    element.addEventListener('click', function (event) {
      event.stopPropagation();
      if (moveMode) return;
      openEditSheet(kind, id);
    });
  }

  function drawSideKind(kind, P, Q, color) {
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
    const stroke = color || '#2a5bd7';
    const addLine = function (cx, cy, half) {
      stage.appendChild(createSvg('line', {
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
      stage.appendChild(createSvg('circle', { cx: mid.x, cy: mid.y, r: 8, fill: 'none', stroke: stroke, 'stroke-width': 3 }));
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
        stroke: stroke,
        'stroke-width': 3,
        'stroke-linecap': 'round'
      }));
    } else if (kind === 'triangle') {
      const p1 = { x: mid.x + tx * 12, y: mid.y + ty * 12 };
      const p2 = { x: mid.x - tx * 8 + nx * 7, y: mid.y - ty * 8 + ny * 7 };
      const p3 = { x: mid.x - tx * 8 - nx * 7, y: mid.y - ty * 8 - ny * 7 };
      stage.appendChild(createSvg('polygon', {
        points: [p1, p2, p3].map(function (p) { return p.x + ',' + p.y; }).join(' '),
        fill: stroke,
        stroke: stroke,
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

  function pathFromPoints(points) {
    return points.map(function (point, index) {
      return (index === 0 ? 'M ' : 'L ') + formatNumber(point.x) + ' ' + formatNumber(point.y);
    }).join(' ');
  }

  function quadraticPathSegment(P, control, Q, start, end) {
    const points = [];
    for (let i = 0; i <= 20; i += 1) {
      const t = start + (end - start) * (i / 20);
      points.push(quadraticPoint(P, control, Q, t));
    }
    return pathFromPoints(points);
  }

  function sideArcGeometry(P, Q, labelPoint) {
    const mid = midpoint(P, Q);
    return {
      control: { x: labelPoint.x * 2 - mid.x, y: labelPoint.y * 2 - mid.y },
      gapHalf: 0.14
    };
  }

  function drawSegmentArc(P, Q, labelPoint, color) {
    const geom = sideArcGeometry(P, Q, labelPoint);
    stage.appendChild(createSvg('path', {
      d: quadraticPathSegment(P, geom.control, Q, 0, 0.5 - geom.gapHalf),
      fill: 'none',
      stroke: color,
      'stroke-width': 2,
      'stroke-linecap': 'round',
      'stroke-dasharray': '6 5'
    }));
    stage.appendChild(createSvg('path', {
      d: quadraticPathSegment(P, geom.control, Q, 0.5 + geom.gapHalf, 1),
      fill: 'none',
      stroke: color,
      'stroke-width': 2,
      'stroke-linecap': 'round',
      'stroke-dasharray': '6 5'
    }));
  }

  function getSegmentNumericText(id, values) {
    if (id === 'MN') return formatNumber(values.mn);
    if (id === 'BC') return formatNumber(values.mn * 2);
    if (id === 'AM' || id === 'MB') return formatNumber(values.am);
    if (id === 'AN' || id === 'NC') return formatNumber(values.an);
    return '';
  }

  function getSegmentText(id, values) {
    const raw = String(state.segmentInputs[id] || '');
    if (!raw) return null;
    if (isRatioLabelValue(raw)) return raw;
    if (!isAnyNumericLabelValue(raw)) return raw;
    return getSegmentNumericText(id, values);
  }

  function getAngleText(id, points) {
    const raw = String(state.angleInputs[id] || '');
    if (!raw) return null;
    if (isRatioLabelValue(raw)) return raw;
    if (!isAnyNumericLabelValue(raw)) return raw;
    const config = ANGLE_LABELS[id];
    return formatNumber(angleDegrees(points[config.points[0]], points[config.points[1]], points[config.points[2]])) + '°';
  }

  function areaRegions(points, values) {
    return [
      {
        id: 'AMN',
        name: '△AMN',
        points: [points.A, points.M, points.N],
        value: null
      },
      {
        id: 'MNCB',
        name: '四角形MNCB',
        points: [points.M, points.N, points.C, points.B],
        value: null
      }
    ];
  }

  function getAreaText(area) {
    const raw = String(state.areaInputs[area.id] || '');
    if (!raw) return null;
    if (isRatioLabelValue(raw)) return raw;
    if (!isAnyNumericLabelValue(raw)) return raw;
    return Number.isFinite(area.value) ? formatNumber(area.value) : null;
  }

  function renderAreas(points, values) {
    areaRegions(points, values).forEach(function (area) {
      const color = state.areaColors[area.id] || '#2a5bd7';
      const areaNode = createSvg('polygon', {
        points: area.points.map(function (point) { return point.x + ',' + point.y; }).join(' '),
        fill: hexToRgba(color, 0.1),
        stroke: 'none'
      });
      attachHit(areaNode, 'area', area.id);
      stage.appendChild(areaNode);
    });
  }

  function renderAreaLabels(points, values) {
    areaRegions(points, values).forEach(function (area) {
      const text = getAreaText(area);
      if (!text) return;
      const pos = fittedAreaLabel(area.points, text, 54);
      const movedPos = getLabelPosition('area', area.id, { x: pos.x, y: pos.y });
      const labelFontSize = pos.fontSize * getMathLabelScale('area', area.id);
      const label = drawText(movedPos, text, {
        class: 'shape-label area-label',
        'data-kind': 'area',
        'data-id': area.id,
        fill: getLabelColor('area', area.id),
        'font-size': labelFontSize,
        style: 'font-size:' + labelFontSize + 'px'
      });
      attachHit(label, 'area', area.id);
      addMoveHitArea(movedPos, 'area', area.id, labelFontSize, text);
    });
  }

  function renderSegmentLabels(points, values) {
    Object.keys(SEGMENT_LABELS).forEach(function (id) {
      const config = SEGMENT_LABELS[id];
      const labelText = getSegmentText(id, values);
      if (!labelText) return;
      const P = points[config.points[0]];
      const Q = points[config.points[1]];
      const color = getLabelColor('segment', id);
      const base = midpoint(P, Q);
      const position = getLabelPosition('segment', id, {
        x: base.x + config.offset.x,
        y: base.y + config.offset.y
      });
      if (state.segmentArcVisible[id] !== false) {
        drawSegmentArc(P, Q, position, color);
      }
      const label = drawText(position, labelText, {
        class: 'shape-label segment-label',
        'data-kind': 'segment',
        'data-id': id,
        fill: color,
        'font-size': 48 * getMathLabelScale('segment', id)
      });
      attachHit(label, 'segment', id);
      addMoveHitArea(position, 'segment', id, 48 * getMathLabelScale('segment', id), labelText);
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
      const color = getLabelColor('angle', id);
      const label = drawText(getLabelPosition('angle', id, angleLabelPosition(P, V, Q)), labelText, {
        class: 'shape-label angle-label',
        'data-kind': 'angle',
        'data-id': id,
        fill: color,
        'font-size': 46 * getMathLabelScale('angle', id)
      });
      attachHit(label, 'angle', id);
      addMoveHitArea(getLabelPosition('angle', id, angleLabelPosition(P, V, Q)), 'angle', id, 46 * getMathLabelScale('angle', id), labelText);
    });
  }

  function renderAngleHits(points) {
    const center = { x: 500, y: 560 };
    Object.keys(ANGLE_LABELS).forEach(function (id) {
      const config = ANGLE_LABELS[id];
      const P = points[config.points[0]];
      const V = points[config.points[1]];
      const Q = points[config.points[2]];
      const angleValue = angleDegrees(P, V, Q);
      const kind = window.InstantGeometryMobileAngleOrnaments
        ? window.InstantGeometryMobileAngleOrnaments.normalizeAngleKind(state.angleKinds[id], angleValue)
        : state.angleKinds[id];
      const color = getLabelColor('angle', id);
      const arc = angleArcPoints(V, P, Q, 56 * getAngleArcScale(id));
      if (kind !== state.angleKinds[id]) state.angleKinds[id] = kind;
      if (kind && kind !== 'hidden' && kind !== 'right') {
        const path = createSvg('path', {
          d: pathFromPoints(arc),
          fill: 'none',
          stroke: color,
          'stroke-width': 3,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round'
        });
        attachHit(path, 'angle', id);
        stage.appendChild(path);
      }
      if (window.InstantGeometryMobileAngleOrnaments) {
        window.InstantGeometryMobileAngleOrnaments.drawAngleKind(stage, state.angleKinds[id], arc, V, center, createSvg, { p1: P, p2: Q });
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

  function renderSegmentHits(points) {
    Object.keys(SEGMENT_LABELS).forEach(function (id) {
      const config = SEGMENT_LABELS[id];
      const P = points[config.points[0]];
      const Q = points[config.points[1]];
      const hit = drawLine(P, Q, {
        stroke: 'transparent',
        'stroke-width': 30
      });
      attachHit(hit, 'segment', id);
      drawSideKind(state.segmentKinds[id], P, Q, getLabelColor('segment', id));
    });
  }

  function fitPoints(rawPoints) {
    const values = Object.keys(rawPoints).map(function (key) { return rawPoints[key]; });
    const minX = Math.min.apply(null, values.map(function (p) { return p.x; }));
    const maxX = Math.max.apply(null, values.map(function (p) { return p.x; }));
    const minY = Math.min.apply(null, values.map(function (p) { return p.y; }));
    const maxY = Math.max.apply(null, values.map(function (p) { return p.y; }));
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const scale = Math.min(760 / width, 760 / height);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    return Object.keys(rawPoints).reduce(function (acc, key) {
      acc[key] = {
        x: 500 + (rawPoints[key].x - cx) * scale,
        y: 500 + (rawPoints[key].y - cy) * scale
      };
      return acc;
    }, {});
  }

  function constructPoints(mn, am, an) {
    if (am + an <= mn || Math.abs(am - an) >= mn) {
      throw new Error('MN, AM, AN で三角形 AMN が作れる長さを入力してください。');
    }
    const ax = (am * am - an * an + mn * mn) / (2 * mn);
    const heightSquared = am * am - ax * ax;
    if (heightSquared <= 0) {
      throw new Error('MN, AM, AN で三角形 AMN が作れる長さを入力してください。');
    }
    const height = Math.sqrt(heightSquared);
    const raw = {
      A: { x: ax, y: -height },
      M: { x: 0, y: 0 },
      N: { x: mn, y: 0 }
    };
    raw.B = { x: raw.A.x + 2 * (raw.M.x - raw.A.x), y: raw.A.y + 2 * (raw.M.y - raw.A.y) };
    raw.C = { x: raw.A.x + 2 * (raw.N.x - raw.A.x), y: raw.A.y + 2 * (raw.N.y - raw.A.y) };
    return fitPoints(raw);
  }

  function render() {
    try {
      const mn = parsePositive(mnInput.value, 'MN');
      const am = parsePositive(amInput.value, 'AM');
      const an = parsePositive(anInput.value, 'AN');
      const points = constructPoints(mn, am, an);
      const A = points.A;
      const B = points.B;
      const C = points.C;
      const M = points.M;
      const N = points.N;
      currentGeometry = { points: points, values: { mn: mn, am: am, an: an } };

      currentLabelBases = {};
      stage.innerHTML = '';
      stage.setAttribute('viewBox', '0 0 1000 1000');
      stage.appendChild(createSvg('polygon', {
        points: [A, B, C].map(function (p) { return p.x + ',' + p.y; }).join(' '),
        fill: 'rgba(42,91,215,0.03)',
        stroke: 'none'
      }));
      renderAreas(points, currentGeometry.values);

      drawLine(A, B);
      drawLine(A, C);
      const bcLine = drawLine(B, C);
      attachHit(bcLine, 'segment', 'BC');
      const mnLine = drawLine(M, N, { stroke: '#2a5bd7', 'stroke-width': 4 });
      attachHit(mnLine, 'segment', 'MN');

      [
        { id: 'A', point: A, label: { x: A.x, y: A.y - 48 } },
        { id: 'B', point: B, label: { x: B.x - 46, y: B.y + 32 } },
        { id: 'C', point: C, label: { x: C.x + 46, y: C.y + 32 } },
        { id: 'M', point: M, label: { x: M.x - 42, y: M.y + 12 } },
        { id: 'N', point: N, label: { x: N.x + 42, y: N.y + 12 } }
      ].forEach(function (item) {
        const dot = createSvg('circle', { cx: item.point.x, cy: item.point.y, r: 8, fill: '#1f2430' });
        attachHit(dot, 'point', item.id);
        stage.appendChild(dot);
        const label = getPointLabel(item.id);
        if (!label) return;
        const labelNode = drawText(getLabelPosition('point', item.id, item.label), label, {
          fill: getLabelColor('point', item.id),
          'font-size': 54 * getMathLabelScale('point', item.id)
        });
        attachHit(labelNode, 'point', item.id);
        addMoveHitArea(getLabelPosition('point', item.id, item.label), 'point', item.id, 54 * getMathLabelScale('point', item.id), label);
      });

      renderSegmentHits(points);
      renderSegmentLabels(points, currentGeometry.values);
      renderAngleHits(points);
      renderAngleLabels(points);
      renderAreaLabels(points, currentGeometry.values);

      setStatus('AB と AC の中点 M, N を描画しました。MN:BC = 1:2 です。', false);
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
    openEditSheet(previous.kind, previous.id);
  }

  function enterMoveMode(kind, id) {
    if (!currentLabelBases[labelKey(kind, id)]) {
      setStatus('ラベルを表示してから移動してください。', true);
      labelController.openEditSheet(kind, id);
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
      if (kind === 'area') {
        const area = currentGeometry
          ? areaRegions(currentGeometry.points, currentGeometry.values).find(function (item) { return item.id === id; })
          : null;
        return area ? area.name : '面積';
      }
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
      if (window.InstantGeometryMobileAngleOrnaments) {
        const angleValue = currentGeometry ? angleDegrees(
          currentGeometry.points[ANGLE_LABELS[id].points[0]],
          currentGeometry.points[ANGLE_LABELS[id].points[1]],
          currentGeometry.points[ANGLE_LABELS[id].points[2]]
        ) : null;
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

  function openEditSheet(kind, id) {
    labelController.openEditSheet(kind, id);
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
      link.download = format === 'transparent' ? 'triangle-midpoint-theorem-1-transparent.png' : 'triangle-midpoint-theorem-1.png';
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
    pdf.save('triangle-midpoint-theorem-1.pdf');
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

  mnInput.addEventListener('input', render);
  amInput.addEventListener('input', render);
  anInput.addEventListener('input', render);
  backBtn.addEventListener('click', function () { window.history.back(); });
  saveBtn.addEventListener('click', function () { if (!moveMode) openSaveSheet(); });
  moveCancelBtn.addEventListener('click', function () { finishMoveMode(true); });
  moveDoneBtn.addEventListener('click', function () { finishMoveMode(false); });
  window.addEventListener('pointermove', function (event) {
    if (!moveDrag) return;
    const point = pointerToSvgPoint(event);
    const offset = ensureLabelOffset(moveDrag.kind, moveDrag.id);
    offset.x = moveDrag.startOffset.x + (point.x - moveDrag.startPoint.x);
    offset.y = moveDrag.startOffset.y + (point.y - moveDrag.startPoint.y);
    render();
  });
  window.addEventListener('pointerup', function () { moveDrag = null; });
  window.addEventListener('pointercancel', function () { moveDrag = null; });
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

  render();
})();
