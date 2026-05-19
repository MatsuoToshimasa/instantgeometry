(function () {
  'use strict';

  const stage = document.getElementById('stage');
  const statusBox = document.getElementById('statusBox');
  const adInput = document.getElementById('adInput');
  const dgInput = document.getElementById('dgInput');
  const agInput = document.getElementById('agInput');
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

  const SEGMENT_LABELS = {
    AD: { points: ['A', 'D'], color: '#2a5bd7', offset: { x: -34, y: -8 } },
    DE: { points: ['D', 'E'], color: '#2a5bd7', offset: { x: -34, y: 0 } },
    EB: { points: ['E', 'B'], color: '#2a5bd7', offset: { x: -34, y: 8 } },
    AG: { points: ['A', 'G'], color: '#2a5bd7', offset: { x: 32, y: -18 } },
    DG: { points: ['D', 'G'], color: '#2a5bd7', offset: { x: 0, y: -34 } },
    GF: { points: ['G', 'F'], color: '#2a5bd7', offset: { x: 34, y: 0 } },
    GC: { points: ['G', 'C'], color: '#2a5bd7', offset: { x: 34, y: 16 } },
    EF: { points: ['E', 'F'], color: '#2a5bd7', offset: { x: -18, y: -34 } },
    BF: { points: ['B', 'F'], color: '#2a5bd7', offset: { x: -8, y: 42 } },
    FC: { points: ['F', 'C'], color: '#2a5bd7', offset: { x: 14, y: 42 } }
  };

  const AREA_LABELS = {
    ADG: { points: ['A', 'D', 'G'], name: '面積 ADG' },
    DGFE: { points: ['D', 'G', 'F', 'E'], name: '面積 DGFE' },
    EFB: { points: ['E', 'F', 'B'], name: '面積 EFB' },
    GFC: { points: ['G', 'F', 'C'], name: '面積 GFC' }
  };

  const ANGLE_LABELS = {};
  const POINT_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

  const state = {
    pointInputs: { A: 'A', B: 'B', C: 'C', D: 'D', E: 'E', F: 'F', G: 'G' },
    segmentInputs: { AD: '', DE: '', EB: '', AG: ' ', DG: ' ', GF: ' ', GC: ' ', EF: ' ', BF: '', FC: '' },
    segmentKinds: { AD: 'plain', DE: 'plain', EB: 'plain', AG: 'plain', DG: 'plain', GF: 'plain', GC: 'plain', EF: 'plain', BF: 'double', FC: 'double' },
    segmentArcVisible: { AD: false, DE: false, EB: false, AG: true, DG: true, GF: true, GC: true, EF: true, BF: false, FC: false },
    angleInputs: {},
    angleKinds: {},
    areaInputs: { ADG: '', DGFE: '', EFB: '', GFC: '' },
    areaColors: { ADG: '#2a5bd7', DGFE: '#2a5bd7', EFB: '#2a5bd7', GFC: '#2a5bd7' },
    labelOffsets: {}
  };
  state.labelScales = state.labelScales || {};

  let currentGeometry = null;
  let moveMode = null;
  let moveDrag = null;
  let currentLabelBases = {};

  const LabelEngine = window.InstantGeometryDrawLabelEngine || window.InstantGeometryTriangleLabelEngine || null;
  let labelController = null;

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
      labelMoveEnabled: true,
      onMove: enterMoveMode,
      onError: function (error) {
        setStatus(error.message || '入力を確認してください。', true);
      },
      getModalSpec: function (kind, id, modalType) {
        return LabelEngine.getStandardModalSpec(modalType, { moveAction: true });
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

  function removeUnsupportedMoveButton() {
    if (true) return;
    Array.from(sheetBody.querySelectorAll('button')).forEach(function (button) {
      if (button.textContent.trim() === '移動') button.remove();
    });
  }

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

  function polygonArea(points) {
    let sum = 0;
    for (let i = 0; i < points.length; i += 1) {
      const p = points[i];
      const q = points[(i + 1) % points.length];
      sum += p.x * q.y - q.x * p.y;
    }
    return Math.abs(sum) / 2;
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

  function normalizeFreeLabel(value) {
    return String(value || '');
  }

  function isNumericLabelValue(value) {
    return value === ' ' || value === '0';
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
    if (window.InstantGeometrySharedLabels && typeof window.InstantGeometrySharedLabels.createSvgKatexLabel === 'function') {
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
        event.preventDefault();
        event.stopPropagation();
        const offset = ensureLabelOffset(kind, id);
        moveDrag = {
          kind: kind,
          id: id,
          startPoint: pointerToSvgPoint(event),
          startOffset: { x: offset.x, y: offset.y }
        };
      });
    }
    element.addEventListener('click', function (event) {
      event.stopPropagation();
      if (moveMode) return;
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
    const stroke = '#2a5bd7';
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
    if (id === 'AD' || id === 'DE' || id === 'EB') return formatNumber(values.ad);
    if (id === 'DG') return formatNumber(values.dg);
    if (id === 'AG' || id === 'GF') return formatNumber(values.ag);
    if (id === 'GC') return formatNumber(values.dg * 3);
    if (id === 'EF') return formatNumber(values.ef);
    if (id === 'BF' || id === 'FC') return formatNumber(values.bf);
    return '';
  }

  function getSegmentText(id, values) {
    const raw = String(state.segmentInputs[id] || '');
    if (!raw) return null;
    if (isRatioLabelValue(raw)) return raw;
    if (!isNumericLabelValue(raw)) return raw;
    return getSegmentNumericText(id, values);
  }

  function getAngleText(id, points) {
    const raw = String(state.angleInputs[id] || '');
    if (!raw) return null;
    if (isRatioLabelValue(raw)) return raw;
    if (!isNumericLabelValue(raw)) return raw;
    const config = ANGLE_LABELS[id];
    return formatAngleValue(angleDegrees(points[config.points[0]], points[config.points[1]], points[config.points[2]]));
  }

  function formatAngleValue(degrees) {
    const settings = window.InstantGeometryDrawSettings;
    if (settings && typeof settings.formatAngleDegrees === 'function') return settings.formatAngleDegrees(degrees);
    return formatNumber(degrees) + '°';
  }

  function areaRegions(points, values) {
    return Object.keys(AREA_LABELS).map(function (id) {
      const config = AREA_LABELS[id];
      return {
        id: id,
        name: config.name,
        points: config.points.map(function (pointId) { return points[pointId]; }),
        value: values.areas[id]
      };
    });
  }

  function getAreaText(area) {
    const raw = String(state.areaInputs[area.id] || '');
    if (!raw) return null;
    if (isRatioLabelValue(raw)) return raw;
    if (!isNumericLabelValue(raw)) return raw;
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
      const label = drawText(movedPos, text, {
        class: 'shape-label area-label',
        'data-label-kind': 'area',
        'data-label-id': area.id,
        'data-kind': 'area',
        'data-id': area.id,
        fill: areaLabelColor(state.areaColors[area.id] || '#2a5bd7'),
        'font-size': scaledFontSize('area', area.id, pos.fontSize),
        style: 'font-size:' + scaledFontSize('area', area.id, pos.fontSize) + 'px'
      });
      attachHit(label, 'area', area.id);
    });
  }

  function renderSegmentLabels(points, values) {
    Object.keys(SEGMENT_LABELS).forEach(function (id) {
      const config = SEGMENT_LABELS[id];
      const labelText = getSegmentText(id, values);
      if (!labelText) return;
      const P = points[config.points[0]];
      const Q = points[config.points[1]];
      const base = midpoint(P, Q);
      const position = getLabelPosition('segment', id, {
        x: base.x + config.offset.x,
        y: base.y + config.offset.y
      });
      if (state.segmentArcVisible[id] !== false) {
        drawSegmentArc(P, Q, position, config.color);
      }
      const label = drawText(position, labelText, {
        class: 'shape-label segment-label',
        'data-label-kind': 'segment',
        'data-label-id': id,
        'data-kind': 'segment',
        'data-id': id,
        fill: config.color,
        'font-size': scaledFontSize('segment', id, 48)
      });
      attachHit(label, 'segment', id);
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
      const label = drawText(angleLabelPosition(P, V, Q), labelText, {
        class: 'shape-label angle-label',
        'data-label-kind': 'angle',
        'data-label-id': id,
        'data-kind': 'angle',
        'data-id': id,
        fill: '#687086',
        'font-size': scaledFontSize('angle', id, 46)
      });
      attachHit(label, 'angle', id);
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
      const arc = angleArcPoints(V, P, Q, 56);
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
      drawSideKind(state.segmentKinds[id], P, Q);
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

  function distance(P, Q) {
    return Math.hypot(P.x - Q.x, P.y - Q.y);
  }

  function constructGeometry(ad, dg, ag) {
    if (ad + dg <= ag || ad + ag <= dg || dg + ag <= ad) {
      throw new Error('AD, DG, AG で三角形 ADG が作れる長さを入力してください。');
    }
    const gy = (ag * ag + ad * ad - dg * dg) / (2 * ad);
    const gxSquared = ag * ag - gy * gy;
    if (gxSquared <= 0) {
      throw new Error('AD, DG, AG で三角形 ADG が作れる長さを入力してください。');
    }
    const gx = Math.sqrt(gxSquared);
    const raw = {
      A: { x: 0, y: 0 },
      D: { x: 0, y: ad },
      E: { x: 0, y: ad * 2 },
      B: { x: 0, y: ad * 3 },
      G: { x: gx, y: gy }
    };
    raw.F = { x: raw.G.x * 2, y: raw.G.y * 2 };
    raw.C = { x: raw.G.x * 4 - raw.D.x * 3, y: raw.G.y * 4 - raw.D.y * 3 };
    return {
      points: fitPoints(raw),
      values: {
        ad: ad,
        dg: dg,
        ag: ag,
        ef: distance(raw.E, raw.F),
        bf: distance(raw.B, raw.F),
        areas: {
          ADG: polygonArea([raw.A, raw.D, raw.G]),
          DGFE: polygonArea([raw.D, raw.G, raw.F, raw.E]),
          EFB: polygonArea([raw.E, raw.F, raw.B]),
          GFC: polygonArea([raw.G, raw.F, raw.C])
        }
      }
    };
  }

  function render() {
    try {
      const ad = parsePositive(adInput.value, 'AD');
      const dg = parsePositive(dgInput.value, 'DG');
      const ag = parsePositive(agInput.value, 'AG');
      const geometry = constructGeometry(ad, dg, ag);
      const points = geometry.points;
      const A = points.A;
      const B = points.B;
      const C = points.C;
      const D = points.D;
      const E = points.E;
      const F = points.F;
      const G = points.G;
      currentGeometry = geometry;

      currentLabelBases = {};
      stage.innerHTML = '';
      stage.setAttribute('viewBox', '0 0 1000 1000');
      renderAreas(points, currentGeometry.values);

      drawLine(A, B);
      drawLine(B, C);
      drawLine(A, G);
      drawLine(D, G);
      drawLine(G, F);
      drawLine(G, C);
      drawLine(E, F);

      [
        { id: 'A', point: A, label: { x: A.x, y: A.y - 48 } },
        { id: 'B', point: B, label: { x: B.x - 46, y: B.y + 32 } },
        { id: 'C', point: C, label: { x: C.x + 46, y: C.y + 32 } },
        { id: 'D', point: D, label: { x: D.x - 42, y: D.y + 2 } },
        { id: 'E', point: E, label: { x: E.x - 42, y: E.y + 2 } },
        { id: 'F', point: F, label: { x: F.x, y: F.y + 44 } },
        { id: 'G', point: G, label: { x: G.x + 40, y: G.y - 22 } }
      ].forEach(function (item) {
        const dot = createSvg('circle', { cx: item.point.x, cy: item.point.y, r: 8, fill: '#1f2430' });
        attachHit(dot, 'point', item.id);
        stage.appendChild(dot);
        const label = getPointLabel(item.id);
        if (!label) return;
        const labelNode = drawText(getLabelPosition('point', item.id, item.label), label, { 'data-label-kind': 'point', 'data-label-id': item.id, 'font-size': scaledFontSize('point', item.id, 54) });
        attachHit(labelNode, 'point', item.id);
      });

      renderSegmentHits(points);
      renderSegmentLabels(points, currentGeometry.values);
      renderAngleHits(points);
      renderAngleLabels(points);
      renderAreaLabels(points, currentGeometry.values);

      setStatus('AB の三等分点 D, E、BC の中点 F、AF と DC の交点 G を描画しました。', false);
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
    openLabelSheet(previous.kind, previous.id);
  }

  function enterMoveMode(kind, id) {
    if (!currentLabelBases[labelKey(kind, id)]) {
      setStatus('ラベルを表示してから移動してください。', true);
      openLabelSheet(kind, id);
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
    const area = kind === 'area' && currentGeometry
      ? areaRegions(currentGeometry.points, currentGeometry.values).find(function (item) { return item.id === id; })
      : null;
    sheetTitle.textContent = kind === 'point'
      ? getPointName(id)
      : kind === 'segment'
        ? '線分 ' + id
        : kind === 'area'
          ? (area ? area.name : '面積')
          : '∠' + id;
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
      if (window.InstantGeometryMobileAngleOrnaments) {
        const angleValue = currentGeometry ? angleDegrees(
          currentGeometry.points[ANGLE_LABELS[id].points[0]],
          currentGeometry.points[ANGLE_LABELS[id].points[1]],
          currentGeometry.points[ANGLE_LABELS[id].points[2]]
        ) : null;
        kindSelect = window.InstantGeometryMobileAngleOrnaments.appendAngleKindSelect(
          sheetBody,
          buildSelect,
          state.angleKinds[id] || 'hidden',
          angleValue
        );
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
    } else if (kind === 'area') {
      labelEditor = buildLabelEditor('ラベル', state.areaInputs[id] || '', true);
      sheetBody.appendChild(labelEditor.field);
      colorPalette = buildColorPalette('色', state.areaColors[id] || '#2a5bd7');
      sheetBody.appendChild(colorPalette.field);
    }


    function applySheetValues() {
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
      } else if (kind === 'area') {
        if (colorPalette) state.areaColors[id] = colorPalette.value;
        if (mode === 'hidden') {
          state.areaInputs[id] = '';
        } else if (mode === 'numeric') {
          state.areaInputs[id] = ' ';
        } else if (mode === 'ratio') {
          const parsed = parseRatioLabelInput(text);
          if (!parsed) throw new Error('比の値を入力してください。');
          state.areaInputs[id] = RATIO_LABEL_PREFIX + parsed.source;
        } else {
          state.areaInputs[id] = text || '';
        }
      }
    }

    const actions = document.createElement('div');
    actions.className = 'sheet-actions';
    actions.classList.add('has-move');
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
        applySheetValues();
        render();
        enterMoveMode(kind, id);
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
        applySheetValues();
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
      link.download = format === 'transparent' ? 'triangle-midpoint-theorem-2-transparent.png' : 'triangle-midpoint-theorem-2.png';
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
    pdf.save('triangle-midpoint-theorem-2.pdf');
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

  adInput.addEventListener('input', render);
  dgInput.addEventListener('input', render);
  agInput.addEventListener('input', render);
  stage.addEventListener('click', function (event) {
    const target = event.target.closest && event.target.closest('[data-kind][data-id]');
    if (!target || !stage.contains(target)) return;
    const kind = target.getAttribute('data-kind');
    const id = target.getAttribute('data-id');
    openLabelSheet(kind, id);
  });

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
