(function () {
  'use strict';

  const stage = document.getElementById('stage');
  const statusBox = document.getElementById('statusBox');
  const vertexCountInput = document.getElementById('vertexCount');
  const sideLenInput = document.getElementById('sideLen');
  const radiusLenInput = document.getElementById('radiusLen');
  const mode = radiusLenInput ? 'radius' : 'side';
  const fileBase = document.body.dataset.fileBase || (mode === 'radius' ? 'regular-polygon-oa' : 'regular-polygon');
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
    pointLabels: {},
    sideLabels: {},
    sideKinds: {},
    sideArcVisible: {},
    radiusLabels: {},
    radiusKinds: {},
    radiusArcVisible: {},
    centerLabel: 'O',
    areaLabel: '',
    labelScales: {},
    labelColors: {},
    labelOffsets: {}
  };
  let geometry = null;
  let labelController = null;
  let moveMode = null;
  let moveDrag = null;
  let currentLabelBases = {};
  const LabelEngine = window.InstantGeometryDrawLabelEngine || window.InstantGeometryTriangleLabelEngine || null;
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

  if (window.InstantGeometrySaveQuota) {
    window.InstantGeometrySaveQuota.createIndicator({ target: saveBtn });
  }

  function normalizeExpression(raw) {
    return String(raw || '')
      .trim()
      .replace(/\s+/g, '')
      .replace(/π/g, 'pi')
      .replace(/√/g, 'sqrt')
      .replace(/(\d+(?:\.\d+)?)deg\b/gi, 'deg($1)');
  }

  function parsePositiveNumber(raw, name) {
    const text = normalizeExpression(raw);
    if (!text) throw new Error(name + ' を入力してください。');
    if (!/^[0-9+\-*/().,a-zA-Z]+$/.test(text)) throw new Error(name + ' に使用できない文字が含まれています。');
    const scope = {
      pi: Math.PI,
      e: Math.E,
      sqrt: Math.sqrt,
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      deg: function (value) { return value * Math.PI / 180; }
    };
    let value;
    try {
      value = Function('s', '"use strict";const {pi,e,sqrt,sin,cos,tan,deg}=s;return (' + text + ');')(scope);
    } catch (error) {
      throw new Error(name + ' の式を読み取れませんでした。');
    }
    if (!Number.isFinite(value) || value <= 0) throw new Error(name + ' には 0 より大きい値を入力してください。');
    return value;
  }

  function parseVertexCount() {
    const raw = String(vertexCountInput.value || '').trim();
    if (!/^\d+$/.test(raw)) throw new Error('Nは 5 以上の自然数で入力してください。');
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 5) throw new Error('Nは 5 以上の自然数で入力してください。');
    return value;
  }

  function formatNumber(value) {
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  }

  function getPointId(index) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (index < alphabet.length) return alphabet[index];
    return alphabet[index % alphabet.length] + String(Math.floor(index / alphabet.length) + 1);
  }

  function getPointIds(count) {
    return Array.from({ length: count }, function (_, index) { return getPointId(index); });
  }

  function segmentLength(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
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

  function midpoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function normalOffset(a, b, center, distance) {
    const m = midpoint(a, b);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    if (nx * (center.x - m.x) + ny * (center.y - m.y) > 0) {
      nx *= -1;
      ny *= -1;
    }
    return { x: m.x + nx * distance, y: m.y + ny * distance };
  }

  function pathFromPoints(points) {
    if (!points.length) return '';
    return points.map(function (p, index) {
      return (index === 0 ? 'M ' : 'L ') + p.x + ' ' + p.y;
    }).join(' ');
  }

  function quadraticPoint(P, control, Q, t) {
    return {
      x: (1 - t) * (1 - t) * P.x + 2 * (1 - t) * t * control.x + t * t * Q.x,
      y: (1 - t) * (1 - t) * P.y + 2 * (1 - t) * t * control.y + t * t * Q.y
    };
  }

  function sideArcGeometry(P, Q, center, labelPoint) {
    const mx = (P.x + Q.x) / 2;
    const my = (P.y + Q.y) / 2;
    const dx = Q.x - P.x;
    const dy = Q.y - P.y;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    if (nx * (center.x - mx) + ny * (center.y - my) > 0) {
      nx *= -1;
      ny *= -1;
    }
    const desired = labelPoint || { x: mx + nx * Math.max(26, len * 0.12), y: my + ny * Math.max(26, len * 0.12) };
    return { control: { x: desired.x * 2 - mx, y: desired.y * 2 - my }, gapHalf: 0.14 };
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

  function fitPoint(point, view) {
    return {
      x: view.left + (point.x - view.minX) * view.scale,
      y: view.bottom - (point.y - view.minY) * view.scale
    };
  }

  function computeViewport(points) {
    const width = 1000;
    const height = 1000;
    const paddingX = 118;
    const paddingTop = 185;
    const paddingBottom = 118;
    const xs = points.map(function (p) { return p.x; });
    const ys = points.map(function (p) { return p.y; });
    const minX = Math.min.apply(null, xs);
    const maxX = Math.max.apply(null, xs);
    const minY = Math.min.apply(null, ys);
    const maxY = Math.max.apply(null, ys);
    const contentWidth = Math.max(1, maxX - minX);
    const contentHeight = Math.max(1, maxY - minY);
    const availableWidth = width - paddingX * 2;
    const availableHeight = height - paddingTop - paddingBottom;
    const scale = Math.min(availableWidth / contentWidth, availableHeight / contentHeight);
    const drawWidth = contentWidth * scale;
    const drawHeight = contentHeight * scale;
    return {
      minX: minX,
      minY: minY,
      scale: scale,
      left: paddingX + (availableWidth - drawWidth) / 2,
      bottom: height - paddingBottom - (availableHeight - drawHeight) / 2
    };
  }

  function fitStageViewBox() {
    let box;
    try {
      box = stage.getBBox();
    } catch (error) {
      stage.setAttribute('viewBox', '0 0 1000 1000');
      return;
    }
    if (!Number.isFinite(box.x) || !Number.isFinite(box.y)) {
      stage.setAttribute('viewBox', '0 0 1000 1000');
      return;
    }
    const pad = 58;
    stage.setAttribute('viewBox', [
      Math.round((box.x - pad) * 1000) / 1000,
      Math.round((box.y - pad) * 1000) / 1000,
      Math.round((box.width + pad * 2) * 1000) / 1000,
      Math.round((box.height + pad * 2) * 1000) / 1000
    ].join(' '));
  }

  function getSegmentId(index, ids) {
    return ids[index] + ids[(index + 1) % ids.length];
  }

  function getRadiusId(id) {
    return 'O' + id;
  }

  function ensureDynamicState(ids) {
    ids.forEach(function (id, index) {
      const nextId = getSegmentId(index, ids);
      const radiusId = getRadiusId(id);
      if (!(id in state.pointLabels)) state.pointLabels[id] = id;
      if (!(nextId in state.sideLabels)) state.sideLabels[nextId] = mode === 'radius' ? '' : ' ';
      if (!(nextId in state.sideKinds)) state.sideKinds[nextId] = 'plain';
      if (!(nextId in state.sideArcVisible)) state.sideArcVisible[nextId] = true;
      if (!(radiusId in state.radiusLabels)) state.radiusLabels[radiusId] = mode === 'radius' && id === 'A' ? ' ' : '';
      if (!(radiusId in state.radiusKinds)) state.radiusKinds[radiusId] = 'plain';
      if (!(radiusId in state.radiusArcVisible)) state.radiusArcVisible[radiusId] = true;
    });
  }

  function computeGeometry() {
    const count = parseVertexCount();
    const radius = mode === 'radius'
      ? parsePositiveNumber(radiusLenInput.value, 'OAの長さ')
      : parsePositiveNumber(sideLenInput.value, '一辺の長さ') / (2 * Math.sin(Math.PI / count));
    const side = 2 * radius * Math.sin(Math.PI / count);
    const ids = getPointIds(count);
    ensureDynamicState(ids);
    const points = {};
    const list = [];
    const startAngle = -Math.PI / 2;
    ids.forEach(function (id, index) {
      const angle = startAngle + Math.PI * 2 * index / count;
      const point = { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
      points[id] = point;
      list.push(point);
    });
    const sides = {};
    const radii = {};
    ids.forEach(function (id, index) {
      sides[getSegmentId(index, ids)] = side;
      radii[getRadiusId(id)] = radius;
    });
    return {
      count: count,
      ids: ids,
      points: points,
      list: list,
      center: { x: 0, y: 0 },
      side: side,
      radius: radius,
      sides: sides,
      radii: radii,
      area: polygonArea(list),
      interiorAngle: (count - 2) * 180 / count
    };
  }

  function isNumericLabel(value) {
    return value === ' ' || value === '0' || value === 'decimal:' || value === 'raw:';
  }

  const RATIO_LABEL_PREFIX = 'ratio:';

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

  function getLabel(group, id, numericValue) {
    const raw = String(group[id] || '');
    if (!raw) return null;
    if (isRatioLabelValue(raw)) return raw;
    if (isNumericLabel(raw)) return formatNumber(numericValue);
    return raw;
  }

  function attachHit(element, kind, id) {
    element.style.cursor = 'pointer';
    element.setAttribute('data-kind', kind);
    element.setAttribute('data-id', id);
    element.addEventListener('click', function (event) {
      event.stopPropagation();
      if (moveMode) return;
      openEditSheet(kind, id);
    });
  }

  function attachLabelHit(element, kind, id) {
    attachHit(element, kind, id);
    element.setAttribute('data-label-target', 'true');
    if (isMoveTarget(kind, id)) element.classList.add('label-move-target');
    element.addEventListener('pointerdown', function (event) {
      beginLabelMoveDrag(kind, id, event);
    });
  }

  function closeSheets() {
    editSheet.classList.remove('open');
    editSheet.setAttribute('aria-hidden', 'true');
    saveSheet.classList.remove('open');
    saveSheet.setAttribute('aria-hidden', 'true');
    sheetBackdrop.classList.remove('open');
    sheetBody.innerHTML = '';
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
      if (
        (value === '' && option.value === 'hidden') ||
        (hasNumericMode && isNumericLabel(value) && option.value === 'numeric') ||
        (hasNumericMode && isRatioLabelValue(value) && option.value === 'ratio') ||
        (value && !isNumericLabel(value) && !isRatioLabelValue(value) && option.value === 'text')
      ) node.selected = true;
      mode.appendChild(node);
    });
    const input = document.createElement('input');
    input.type = 'text';
    input.value = isRatioLabelValue(value) ? getRatioLabelInput(value) : value && !isNumericLabel(value) ? value : '';
    function sync() {
      input.disabled = mode.value !== 'text' && mode.value !== 'ratio';
      input.placeholder = mode.value === 'ratio' ? '例: r,1 / s,2 / t,3' : '';
    }
    mode.addEventListener('change', sync);
    field.appendChild(label);
    field.appendChild(mode);
    field.appendChild(input);
    sync();
    return { field: field, mode: mode, input: input };
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

  function getPointName(id) {
    const raw = String(state.pointLabels[id] || '').trim();
    return raw || id;
  }

  function getSideName(id) {
    return id.split('').map(getPointName).join('');
  }

  function labelTarget(kind, id) {
    if (kind === 'point') return { title: getPointName(id), group: state.pointLabels, hasNumeric: false };
    if (kind === 'center') return { title: 'O', group: null, hasNumeric: false };
    if (kind === 'radius') return { title: '線分 ' + id, group: state.radiusLabels, hasNumeric: true };
    if (kind === 'side') return { title: '辺 ' + getSideName(id), group: state.sideLabels, hasNumeric: true };
    return { title: '面積', group: null, hasNumeric: true };
  }

  function labelStyleKey(kind, id) {
    return String(kind || '') + ':' + String(id || '');
  }

  function labelKey(kind, id) {
    return String(kind || '') + ':' + String(id || '');
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

  function beginLabelMoveDrag(kind, id, event) {
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
  }

  function enterMoveMode(kind, id) {
    const key = labelKey(kind, id);
    if (!currentLabelBases[key]) {
      setStatus('ラベルを表示してから移動してください。', true);
      openEditSheet(kind, id);
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

  function defaultLabelColor(kind, fallback) {
    if (kind === 'point' || kind === 'center') return '#1f2430';
    if (kind === 'area') return '#25603b';
    if (kind === 'radius') return '#687086';
    return fallback || '#2a5bd7';
  }

  function getLabelScale(kind, id) {
    const value = state.labelScales[labelStyleKey(kind, id)];
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  function setLabelScale(kind, id, value) {
    state.labelScales[labelStyleKey(kind, id)] = Math.max(0.1, Math.min(4, Number(value) || 1));
  }

  function getLabelColor(kind, id, fallback) {
    return state.labelColors[labelStyleKey(kind, id)] || defaultLabelColor(kind, fallback);
  }

  function setLabelColor(kind, id, value) {
    state.labelColors[labelStyleKey(kind, id)] = value || defaultLabelColor(kind);
  }

  function buildSegmentKindSelect(kind, id, buildSelectFn) {
    const kindGroup = kind === 'radius' ? state.radiusKinds : state.sideKinds;
    return buildSelectFn('線分マーク', kindGroup[id] || 'plain', [
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

  function initLabelController() {
    if (!LabelEngine || typeof LabelEngine.createController !== 'function') return;
    labelController = LabelEngine.createController({
      enabledLabels: { point: true, segment: true, area: true },
      taxonomyContext: { defaultKind: 'segment' },
      editSheet: editSheet,
      sheetTitle: sheetTitle,
      sheetBody: sheetBody,
      sheetBackdrop: sheetBackdrop,
      closeSheets: closeSheets,
      render: render,
      onError: function (error) { setStatus(error.message || '入力を確認してください。', true); },
      getModalSpec: function (kind, id, modalType) {
        return LabelEngine.getStandardModalSpec(modalType, {
          guideLabel: 'ガイドを表示'
        });
      },
      onMove: function (kind, id) {
        enterMoveMode(kind, id);
      },
      getTitle: function (kind, id) {
        return labelTarget(kind, id).title;
      },
      buildSegmentKindSelect: buildSegmentKindSelect,
      setKind: function (kind, id, value) {
        if (kind === 'radius') state.radiusKinds[id] = value;
        else state.sideKinds[id] = value;
      },
      hasGuideField: function (kind) {
        return kind === 'side' || kind === 'radius';
      },
      getGuideVisible: function (kind, id) {
        const group = kind === 'radius' ? state.radiusArcVisible : state.sideArcVisible;
        return group[id] !== false;
      },
      setGuideVisible: function (kind, id, checked) {
        const group = kind === 'radius' ? state.radiusArcVisible : state.sideArcVisible;
        group[id] = !!checked;
      },
      getLabelValue: function (kind, id) {
        if (kind === 'center') return state.centerLabel;
        if (kind === 'area') return state.areaLabel;
        const target = labelTarget(kind, id);
        return target.group ? target.group[id] : '';
      },
      setLabelValue: function (kind, id, value) {
        if (kind === 'center') state.centerLabel = value;
        else if (kind === 'area') state.areaLabel = value;
        else {
          const target = labelTarget(kind, id);
          if (target.group) target.group[id] = value;
          if (!value && kind === 'side') state.sideArcVisible[id] = false;
          if (!value && kind === 'radius') state.radiusArcVisible[id] = false;
        }
      },
      getLabelScale: getLabelScale,
      setLabelScale: setLabelScale,
      getColor: function (kind, id) {
        return getLabelColor(kind, id);
      },
      setColor: setLabelColor,
      hasColorField: function () { return true; }
    });
  }

  function openEditSheet(kind, id) {
    if (labelController) {
      labelController.openEditSheet(kind, id);
      return;
    }
    closeSheets();
    const target = labelTarget(kind, id);
    sheetTitle.textContent = target.title;
    const value = kind === 'center' ? state.centerLabel : kind === 'area' ? state.areaLabel : target.group[id];
    let kindSelect = null;
    let arcCheckbox = null;
    if (kind === 'side' || kind === 'radius') {
      const kindGroup = kind === 'side' ? state.sideKinds : state.radiusKinds;
      const arcGroup = kind === 'side' ? state.sideArcVisible : state.radiusArcVisible;
      const built = buildSelect('種類', kindGroup[id] || 'plain', [
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
      const checkboxBuilt = buildCheckbox('弧を表示', arcGroup[id] !== false);
      arcCheckbox = checkboxBuilt.input;
      sheetBody.appendChild(checkboxBuilt.field);
    }
    const editor = buildLabelEditor('ラベル', value, target.hasNumeric);
    sheetBody.appendChild(editor.field);
    const hint = document.createElement('p');
    hint.className = 'sheet-hint';
    hint.textContent = target.hasNumeric
      ? '非表示、数値、比の値、自由入力を選べます。'
      : '非表示または自由入力を選べます。';
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
      let next = '';
      if (editor.mode.value === 'numeric') {
        next = ' ';
      } else if (editor.mode.value === 'ratio') {
        const ratio = parseRatioLabelInput(editor.input.value);
        if (!ratio) throw new Error('比の値は「r,1」「s,2」「t,3」の形式で入力してください。');
        next = RATIO_LABEL_PREFIX + ratio.source;
      } else if (editor.mode.value === 'text') {
        next = editor.input.value;
      }
      if (kind === 'center') state.centerLabel = next;
      else if (kind === 'area') state.areaLabel = next;
      else {
        target.group[id] = next;
        if (kind === 'side') {
          if (kindSelect) state.sideKinds[id] = kindSelect.value;
          if (arcCheckbox) state.sideArcVisible[id] = arcCheckbox.checked;
          if (!next) state.sideArcVisible[id] = false;
        } else if (kind === 'radius') {
          if (kindSelect) state.radiusKinds[id] = kindSelect.value;
          if (arcCheckbox) state.radiusArcVisible[id] = arcCheckbox.checked;
          if (!next) state.radiusArcVisible[id] = false;
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

  initLabelController();

  function renderText(text, pos, attrs, kind, id) {
    if (!text) return;
    const labelPos = getLabelPosition(kind, id, pos);
    const scaledAttrs = Object.assign({}, attrs);
    const baseSize = Number(scaledAttrs['font-size']) || 42;
    scaledAttrs['font-size'] = String(baseSize * getLabelScale(kind, id));
    scaledAttrs.fill = getLabelColor(kind, id, scaledAttrs.fill);
    const textAttrs = Object.assign({
      x: labelPos.x,
      y: labelPos.y,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle'
    }, scaledAttrs);
    let node;
    if (isRatioLabelValue(text)) {
      const parsed = parseRatioLabelInput(getRatioLabelInput(text));
      const x = Number(textAttrs.x) || 0;
      const y = Number(textAttrs.y) || 0;
      const fontSize = Number(textAttrs['font-size']) || 42;
      const textWidth = Math.max(fontSize * 0.7, parsed.value.length * fontSize * 0.62);
      const height = fontSize * 1.16;
      const width = parsed.mark === 't'
        ? Math.max(textWidth + fontSize * 0.8, height * 1.25)
        : Math.max(textWidth + fontSize * 0.55, height);
      node = createSvg('g', {});
      const stroke = textAttrs.fill || '#687086';
      if (parsed.mark === 'r') {
        node.appendChild(createSvg('ellipse', { cx: x, cy: y, rx: width / 2, ry: height / 2, fill: '#fff', stroke: stroke, 'stroke-width': 2.3 }));
      } else if (parsed.mark === 't') {
        node.appendChild(createSvg('polygon', {
          points: [x + ',' + (y - height * 0.72), (x - width / 2) + ',' + (y + height * 0.48), (x + width / 2) + ',' + (y + height * 0.48)].join(' '),
          fill: '#fff', stroke: stroke, 'stroke-width': 2.3, 'stroke-linejoin': 'round'
        }));
      } else {
        node.appendChild(createSvg('rect', { x: x - width / 2, y: y - height / 2, width: width, height: height, rx: 5, ry: 5, fill: '#fff', stroke: stroke, 'stroke-width': 2.3 }));
      }
      const textNode = createSvg('text', textAttrs);
      textNode.textContent = parsed.value;
      node.appendChild(textNode);
    } else {
      node = window.InstantGeometrySharedLabels && typeof window.InstantGeometrySharedLabels.createSvgKatexLabel === 'function'
        ? window.InstantGeometrySharedLabels.createSvgKatexLabel({
          createSvg: createSvg,
          text: text,
          attrs: textAttrs,
          kind: kind,
          id: id
        })
        : null;
      if (!node) {
        node = createSvg('text', textAttrs);
        node.textContent = text;
      }
    }
    attachLabelHit(node, kind, id);
    stage.appendChild(node);
  }

  function render() {
    try {
      geometry = computeGeometry();
      currentLabelBases = {};
      stage.innerHTML = '';
      const view = computeViewport(geometry.list);
      const fitted = {};
      geometry.ids.forEach(function (id) {
        fitted[id] = fitPoint(geometry.points[id], view);
      });
      const fittedCenter = fitPoint(geometry.center, view);
      const pointsText = geometry.ids.map(function (id) { return fitted[id].x + ',' + fitted[id].y; }).join(' ');

      const areaHit = createSvg('polygon', { points: pointsText, fill: 'rgba(42,91,215,0.02)', stroke: 'none' });
      attachHit(areaHit, 'area', 'main');
      stage.appendChild(areaHit);
      stage.appendChild(createSvg('polygon', { points: pointsText, fill: 'rgba(42,91,215,0.08)', stroke: '#2a5bd7', 'stroke-width': '3', 'stroke-linejoin': 'round' }));

      geometry.ids.forEach(function (id) {
        const line = createSvg('line', {
          x1: fitted[id].x,
          y1: fitted[id].y,
          x2: fittedCenter.x,
          y2: fittedCenter.y,
          stroke: '#7d8db8',
          'stroke-width': '2',
          'stroke-linecap': 'round',
          'stroke-dasharray': '8 8'
        });
        stage.appendChild(line);
        const hit = createSvg('line', {
          x1: fitted[id].x,
          y1: fitted[id].y,
          x2: fittedCenter.x,
          y2: fittedCenter.y,
          stroke: 'transparent',
          'stroke-width': '30',
          'stroke-linecap': 'round'
        });
        attachHit(hit, 'radius', getRadiusId(id));
        stage.appendChild(hit);
        drawSideKind(state.radiusKinds[getRadiusId(id)], fittedCenter, fitted[id]);
      });

      geometry.ids.forEach(function (id, index) {
        const next = geometry.ids[(index + 1) % geometry.ids.length];
        const sideId = getSegmentId(index, geometry.ids);
        const hit = createSvg('line', {
          x1: fitted[id].x,
          y1: fitted[id].y,
          x2: fitted[next].x,
          y2: fitted[next].y,
          stroke: 'transparent',
          'stroke-width': '30',
          'stroke-linecap': 'round'
        });
        attachHit(hit, 'side', sideId);
        stage.appendChild(hit);
        drawSideKind(state.sideKinds[sideId], fitted[id], fitted[next]);
      });

      geometry.ids.forEach(function (id) {
        const dot = createSvg('circle', { cx: fitted[id].x, cy: fitted[id].y, r: 8, fill: '#1f2430' });
        attachHit(dot, 'point', id);
        stage.appendChild(dot);
      });
      const centerDot = createSvg('circle', { cx: fittedCenter.x, cy: fittedCenter.y, r: 8, fill: '#1f2430' });
      attachHit(centerDot, 'center', 'O');
      stage.appendChild(centerDot);

      geometry.ids.forEach(function (id) {
        const point = geometry.points[id];
        const pos = fitPoint({ x: point.x * 1.14, y: point.y * 1.14 }, view);
        renderText(state.pointLabels[id], pos, { 'font-size': '58', 'font-weight': '700', fill: '#1f2430' }, 'point', id);
      });
      renderText(state.centerLabel, { x: fittedCenter.x + 34, y: fittedCenter.y - 30 }, { 'font-size': '50', 'font-weight': '700', fill: '#1f2430' }, 'center', 'O');

      geometry.ids.forEach(function (id, index) {
        const next = geometry.ids[(index + 1) % geometry.ids.length];
        const sideId = getSegmentId(index, geometry.ids);
        const label = getLabel(state.sideLabels, sideId, geometry.sides[sideId]);
        const pos = fitPoint(normalOffset(geometry.points[id], geometry.points[next], geometry.center, geometry.side * 0.13), view);
        if (label && state.sideArcVisible[sideId] !== false) {
          const offset = getLabelOffset('side', sideId);
          const guidePos = { x: pos.x + offset.x, y: pos.y + offset.y };
          const geom = sideArcGeometry(fitted[id], fitted[next], fittedCenter, guidePos);
          stage.appendChild(createSvg('path', {
            d: quadraticPathSegment(fitted[id], geom.control, fitted[next], 0, 0.5 - geom.gapHalf, 20),
            fill: 'none',
            stroke: '#2a5bd7',
            'stroke-width': '2',
            'stroke-linecap': 'round',
            'stroke-dasharray': '6 5'
          }));
          stage.appendChild(createSvg('path', {
            d: quadraticPathSegment(fitted[id], geom.control, fitted[next], 0.5 + geom.gapHalf, 1, 20),
            fill: 'none',
            stroke: '#2a5bd7',
            'stroke-width': '2',
            'stroke-linecap': 'round',
            'stroke-dasharray': '6 5'
          }));
        }
        renderText(label, pos, { 'font-size': '48', 'font-weight': '700', fill: '#2a5bd7' }, 'side', sideId);
      });

      geometry.ids.forEach(function (id) {
        const radiusId = getRadiusId(id);
        const label = getLabel(state.radiusLabels, radiusId, geometry.radii[radiusId]);
        const p = geometry.points[id];
        const pos = fitPoint({ x: p.x * 0.47, y: p.y * 0.47 }, view);
        if (label && state.radiusArcVisible[radiusId] !== false) {
          const offset = getLabelOffset('radius', radiusId);
          const guidePos = { x: pos.x + offset.x, y: pos.y + offset.y };
          const geom = sideArcGeometry(fittedCenter, fitted[id], fitted[id], guidePos);
          stage.appendChild(createSvg('path', {
            d: quadraticPathSegment(fittedCenter, geom.control, fitted[id], 0, 0.5 - geom.gapHalf, 20),
            fill: 'none',
            stroke: '#7d8db8',
            'stroke-width': '2',
            'stroke-linecap': 'round',
            'stroke-dasharray': '6 5'
          }));
          stage.appendChild(createSvg('path', {
            d: quadraticPathSegment(fittedCenter, geom.control, fitted[id], 0.5 + geom.gapHalf, 1, 20),
            fill: 'none',
            stroke: '#7d8db8',
            'stroke-width': '2',
            'stroke-linecap': 'round',
            'stroke-dasharray': '6 5'
          }));
        }
        renderText(label, pos, { 'font-size': '42', 'font-weight': '700', fill: '#687086' }, 'radius', radiusId);
      });

      const areaLabel = state.areaLabel ? (isNumericLabel(state.areaLabel) ? formatNumber(geometry.area) : state.areaLabel) : null;
      renderText(areaLabel, { x: fittedCenter.x, y: fittedCenter.y + 52 }, { 'font-size': '48', 'font-weight': '700', fill: '#25603b' }, 'area', 'main');

      fitStageViewBox();
      setStatus((document.body.dataset.readyMessage || '正N角形を描画しました。'), false);
    } catch (error) {
      stage.innerHTML = '';
      stage.setAttribute('viewBox', '0 0 1000 1000');
      setStatus(error.message || '描画に失敗しました。', true);
    }
  }

  async function saveAs(format) {
    const backgroundColor = format === 'transparent' ? null : '#ffffff';
    const canvas = await html2canvas(captureRoot, { backgroundColor: backgroundColor, scale: 2 });
    if (format === 'png' || format === 'transparent') {
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = format === 'transparent' ? fileBase + '-transparent.png' : fileBase + '.png';
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
    pdf.save(fileBase + '.pdf');
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

  vertexCountInput.addEventListener('input', render);
  if (sideLenInput) sideLenInput.addEventListener('input', render);
  if (radiusLenInput) radiusLenInput.addEventListener('input', render);
  backBtn.addEventListener('click', function () {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = '/draw/';
  });
  saveBtn.addEventListener('click', function () {
    if (moveMode) return;
    closeSheets();
    saveSheet.classList.add('open');
    saveSheet.setAttribute('aria-hidden', 'false');
    sheetBackdrop.classList.add('open');
  });
  moveCancelBtn.addEventListener('click', function () { finishMoveMode(true); });
  moveDoneBtn.addEventListener('click', function () { finishMoveMode(false); });
  window.addEventListener('pointermove', function (event) {
    if (!moveDrag) return;
    event.preventDefault();
    const point = pointerToSvgPoint(event);
    const offset = ensureLabelOffset(moveDrag.kind, moveDrag.id);
    offset.x = moveDrag.startOffset.x + (point.x - moveDrag.startPoint.x);
    offset.y = moveDrag.startOffset.y + (point.y - moveDrag.startPoint.y);
    render();
  }, { passive: false });
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
