(function () {
  'use strict';

  const stage = document.getElementById('stage');
  const statusBox = document.getElementById('statusBox');
  const ratioAInput = document.getElementById('ratioAInput');
  const ratioBInput = document.getElementById('ratioBInput');
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
    segmentInputs: { MN: ' ', BC: ' ', AM: '', AN: '', MB: '', NC: '' },
    segmentKinds: { MN: 'plain', BC: 'plain', AM: 'plain', AN: 'plain', MB: 'plain', NC: 'plain' },
    segmentArcVisible: { MN: true, BC: true, AM: true, AN: true, MB: true, NC: true },
    angleInputs: { AMN: '', ANM: '', ABC: '', ACB: '' },
    angleKinds: { AMN: 'hidden', ANM: 'hidden', ABC: 'hidden', ACB: 'hidden' },
    angleArcScales: { AMN: 1, ANM: 1, ABC: 1, ACB: 1 },
    areaInputs: { AMN: '', MNCB: '' },
    areaColors: { AMN: '#2a5bd7', MNCB: '#2a5bd7' },
    labelColors: {},
    labelOffsets: {}
  };
  state.labelScales = state.labelScales || {};

  let currentGeometry = null;
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

  function getAngleArcScale(kind, id) {
    const value = Number(state.angleArcScales[id]);
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  function setAngleArcScale(kind, id, value) {
    state.angleArcScales[id] = Math.max(0.3, Math.min(3, Number(value) || 1));
  }

  function defaultLabelColor(kind) {
    if (kind === 'point') return '#1f2430';
    if (kind === 'segment') return '#2a5bd7';
    if (kind === 'angle') return '#687086';
    return '#2a5bd7';
  }

  function getLabelColor(kind, id) {
    if (kind === 'area') return state.areaColors[id] || '#2a5bd7';
    return state.labelColors[labelKey(kind, id)] || defaultLabelColor(kind);
  }

  function setLabelColor(kind, id, value) {
    if (kind === 'area') {
      state.areaColors[id] = value || '#2a5bd7';
      return;
    }
    state.labelColors[labelKey(kind, id)] = value || defaultLabelColor(kind);
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
        return LabelEngine.getStandardModalSpec(modalType);
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
      getAngleArcScale: getAngleArcScale,
      setAngleArcScale: setAngleArcScale,
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
        return kind === 'point' || kind === 'segment' || kind === 'angle' || kind === 'area';
      },
      getColor: getLabelColor,
      setColor: setLabelColor
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
    if (!/^[1-9][0-9]*$/.test(text)) {
      throw new Error(name + ' には自然数を入力してください。');
    }
    return Number(text);
  }

  function pointOnSegment(P, Q, t) {
    return {
      x: P.x + (Q.x - P.x) * t,
      y: P.y + (Q.y - P.y) * t
    };
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
    const kind = attrs && (attrs['data-label-kind'] || attrs['data-kind']);
    const id = attrs && (attrs['data-label-id'] || attrs['data-id']);
    const offset = kind && id ? getLabelOffset(kind, id) : { x: 0, y: 0 };
    const movedPoint = { x: P.x + offset.x, y: P.y + offset.y };
    const merged = Object.assign({
      x: movedPoint.x,
      y: movedPoint.y,
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
        if (kind && id) attachMoveTarget(katexNode, kind, id);
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
    if (kind && id) attachMoveTarget(node, kind, id);
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
    if (id === 'MN' || id === 'AM' || id === 'AN') return formatNumber(values.a);
    if (id === 'BC') return formatNumber(values.b);
    return formatNumber(Math.max(0, values.b - values.a));
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
    return formatNumber(angleDegrees(points[config.points[0]], points[config.points[1]], points[config.points[2]])) + '°';
  }

  function formatEquilateralArea(coefficient) {
    const value = Math.abs(Math.round(Number(coefficient) || 0));
    if (!value) return '0';
    if (value % 4 === 0) {
      const whole = value / 4;
      return whole === 1 ? '√3' : whole + '√3';
    }
    if (value % 2 === 0) {
      const half = value / 2;
      return half === 1 ? '√3/2' : half + '√3/2';
    }
    return value === 1 ? '√3/4' : value + '√3/4';
  }

  function areaRegions(points, values) {
    const smallCoefficient = values.a * values.a;
    const trapezoidCoefficient = values.b * values.b - values.a * values.a;
    return [
      {
        id: 'AMN',
        name: '△AMN',
        points: [points.A, points.M, points.N],
        value: smallCoefficient * Math.sqrt(3) / 4,
        exactLabel: formatEquilateralArea(smallCoefficient)
      },
      {
        id: 'MNCB',
        name: '四角形MNCB',
        points: [points.M, points.N, points.C, points.B],
        value: trapezoidCoefficient * Math.sqrt(3) / 4,
        exactLabel: formatEquilateralArea(trapezoidCoefficient)
      }
    ];
  }

  function getAreaText(area) {
    const raw = String(state.areaInputs[area.id] || '');
    if (!raw) return null;
    if (isRatioLabelValue(raw)) return raw;
    if (!isNumericLabelValue(raw)) return raw;
    return area.exactLabel || formatNumber(area.value);
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
      const label = drawText(pos, text, {
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
      const color = getLabelColor('segment', id);
      const base = midpoint(P, Q);
      const position = {
        x: base.x + config.offset.x,
        y: base.y + config.offset.y
      };
      if (state.segmentArcVisible[id] !== false) {
        drawSegmentArc(P, Q, position, color);
      }
      const label = drawText(position, labelText, {
        class: 'shape-label segment-label',
        'data-label-kind': 'segment',
        'data-label-id': id,
        'data-kind': 'segment',
        'data-id': id,
        fill: color,
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
        fill: getLabelColor('angle', id),
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
      const color = getLabelColor('angle', id);
      const kind = window.InstantGeometryMobileAngleOrnaments
        ? window.InstantGeometryMobileAngleOrnaments.normalizeAngleKind(state.angleKinds[id], angleValue)
        : state.angleKinds[id];
      const arc = angleArcPoints(V, P, Q, 56 * getAngleArcScale('angle', id));
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
        window.InstantGeometryMobileAngleOrnaments.drawAngleKind(stage, state.angleKinds[id], arc, V, center, createSvg, { p1: P, p2: Q }, {
          color: color,
          scale: getAngleArcScale('angle', id)
        });
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

  function render() {
    try {
      const a = parseNatural(ratioAInput.value, 'a');
      const b = parseNatural(ratioBInput.value, 'b');
      if (a > b) {
        throw new Error('M, N を辺 AB, AC 上に置くため、a は b 以下にしてください。');
      }

      const B = { x: 170, y: 840 };
      const C = { x: 830, y: 840 };
      const baseLength = Math.abs(C.x - B.x);
      const equilateralHeight = baseLength * Math.sqrt(3) / 2;
      const A = { x: (B.x + C.x) / 2, y: B.y - equilateralHeight };
      const t = a / b;
      const M = pointOnSegment(A, B, t);
      const N = pointOnSegment(A, C, t);
      const points = { A: A, B: B, C: C, M: M, N: N };
      currentGeometry = { points: points, values: { a: a, b: b } };

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
        const labelNode = drawText(item.label, label, {
          'data-label-kind': 'point',
          'data-label-id': item.id,
          fill: getLabelColor('point', item.id)
        });
        attachHit(labelNode, 'point', item.id);
      });

      renderSegmentHits(points);
      renderSegmentLabels(points, currentGeometry.values);
      renderAngleHits(points);
      renderAngleLabels(points);
      renderAreaLabels(points, currentGeometry.values);

      if (a === b) {
        setStatus('a = b のため、M は B、N は C と一致します。', false);
      } else {
        setStatus('MN:BC = ' + a + ':' + b + ' となるように描画しました。', false);
      }
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
      link.download = format === 'transparent' ? 'triangle-parallel-ratio-transparent.png' : 'triangle-parallel-ratio.png';
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
    pdf.save('triangle-parallel-ratio.pdf');
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

  ratioAInput.addEventListener('input', render);
  ratioBInput.addEventListener('input', render);
  stage.addEventListener('click', function (event) {
    if (moveMode) return;
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
