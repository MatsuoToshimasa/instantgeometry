(function () {
  'use strict';

  const POINT_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const DRAW_SEGMENTS = {
    AB: ['A', 'B'], BC: ['B', 'C'], CD: ['C', 'D'], DA: ['D', 'A'],
    CE: ['C', 'E'], BD: ['B', 'D'], AE: ['A', 'E']
  };
  const LABEL_SEGMENTS = {
    AB: ['A', 'B'], BC: ['B', 'C'], CE: ['C', 'E'],
    AG: ['A', 'G'], GE: ['G', 'E'], EF: ['E', 'F']
  };
  const AREA_REGIONS = {
    ABF: ['A', 'B', 'F'],
    ADF: ['A', 'D', 'F'],
    DFG: ['D', 'F', 'G'],
    BCGF: ['B', 'C', 'G', 'F'],
    CGE: ['C', 'G', 'E']
  };
  const RATIO_LABEL_PREFIX = 'ratio:';

  const stage = document.getElementById('stage');
  const statusBox = document.getElementById('statusBox');
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
  const abInput = document.getElementById('abInput');
  const bcInput = document.getElementById('bcInput');
  const ceInput = document.getElementById('ceInput');
  const lengthInputs = { AB: abInput, BC: bcInput, CE: ceInput };

  const state = {
    pointInputs: { A: 'A', B: 'B', C: 'C', D: 'D', E: 'E', F: 'F', G: 'G' },
    pointVisible: { A: true, B: true, C: true, D: true, E: true, F: true, G: true },
    segmentInputs: {
      AB: ' ', BC: ' ', CE: ' ',
      AG: '', GE: '', EF: ''
    },
    segmentKinds: {},
    segmentArcVisible: {},
    areaInputs: { ABF: '', ADF: '', DFG: '', BCGF: '', CGE: '' },
    areaColors: {}
  };
  state.labelScales = state.labelScales || {};
  let geometry = null;
  let view = null;

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
    if (kind === 'point') return state.pointVisible[id] ? (state.pointInputs[id] || '') : '';
    if (kind === 'segment') return state.segmentInputs[id] || '';
    if (kind === 'area') return state.areaInputs[id] || '';
    return '';
  }

  function setControllerLabelValue(kind, id, value) {
    let normalizedValue = value === LabelEngine.DECIMAL_NUMERIC_LABEL_VALUE ? ' ' : value;
    if (isRatioLabelValue(normalizedValue)) {
      const ratio = parseRatioLabelInput(rawRatioInput(normalizedValue), 'ラベル');
      normalizedValue = RATIO_LABEL_PREFIX + ratio.source;
      if (kind === 'segment' && typeof ratioInputs !== 'undefined' && ratioInputs[id]) ratioInputs[id].value = ratio.source;
    }
    if (kind === 'point') {
      state.pointVisible[id] = normalizedValue !== '';
      state.pointInputs[id] = normalizedValue || '';
      return;
    }
    if (kind === 'segment') {
      state.segmentInputs[id] = normalizedValue || '';
      if (normalizedValue === '') state.segmentArcVisible[id] = false;
      return;
    }
    if (kind === 'area') {
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

  function getAreaTitle(id) {
    if (!geometry) return '面ラベル';
    const area = areaRegions().find(function (item) { return item.id === id; });
    return area ? area.name : '面ラベル';
  }

  if (LabelEngine && typeof LabelEngine.createController === 'function') {
    labelController = LabelEngine.createController({
      enabledLabels: { point: true, segment: true, area: true },
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
      setKind: function (kind, id, value) {
        if (kind === 'segment') state.segmentKinds[id] = value;
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
    if (kind === 'segment') openSegmentSheet(id);
    if (kind === 'point') openPointSheet(id);
    if (kind === 'area') openAreaSheet(id);
  }

  Object.keys(LABEL_SEGMENTS).forEach(function (id) {
    state.segmentKinds[id] = 'plain';
    state.segmentArcVisible[id] = true;
  });

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
    if (!match) return { h: 223, s: 68, l: 58 };
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
    const light = (max + min) / 2;
    const sat = delta ? delta / (1 - Math.abs(2 * light - 1)) : 0;
    return { h: (h + 360) % 360, s: sat * 100, l: light * 100 };
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

  function parseRatioLabelInput(value, label) {
    const text = String(value || '').trim();
    const parts = text.split(',');
    if (parts.length !== 2) throw new Error(label + ' は「r,1」の形式で入力してください。');
    const mark = parts[0].trim().toLowerCase();
    const number = parts[1].trim();
    const decimalPattern = /^(?:[1-9][0-9]*(?:\.[0-9]+)?|0\.[0-9]*[1-9][0-9]*)$/;
    const fractionPattern = /^[1-9][0-9]*\/[1-9][0-9]*$/;
    if (!/^[rts]$/.test(mark)) throw new Error(label + ' のマークは r, s, t のいずれかにしてください。');
    if (!decimalPattern.test(number) && !fractionPattern.test(number)) throw new Error(label + ' の値には正の数を入力してください。');
    return { mark: mark, value: number, number: parseRatioNumber(number), source: mark + ',' + number };
  }

  function parseRatioNumber(value) {
    const parts = String(value).split('/');
    if (parts.length === 2) return Number(parts[0]) / Number(parts[1]);
    return Number(value);
  }

  function parsePositiveNumber(value, label) {
    const text = String(value || '').trim();
    if (!/^(?:[1-9][0-9]*(?:\.[0-9]+)?|0\.[0-9]*[1-9][0-9]*)$/.test(text)) {
      throw new Error(label + ' には0より大きい数を入力してください。');
    }
    return Number(text);
  }

  function isRatioLabelValue(value) {
    return String(value || '').indexOf(RATIO_LABEL_PREFIX) === 0;
  }

  function rawRatioInput(value) {
    return isRatioLabelValue(value) ? String(value).slice(RATIO_LABEL_PREFIX.length) : '';
  }

  function getLabelMode(value) {
    if (value === '') return 'hidden';
    if (isRatioLabelValue(value)) return 'ratio';
    if (value === ' ' || value === '0') return 'numeric';
    return 'text';
  }

  function labelText(value, length) {
    if (value === '') return '';
    if (value === ' ' || value === '0') return formatNumber(length);
    return value;
  }

  function areaLabelText(value, area) {
    if (value === '') return '';
    if (value === ' ' || value === '0') return formatNumber(area.value);
    return value;
  }

  function createLabelNode(label, attrs) {
    const parsed = isRatioLabelValue(label) ? parseRatioLabelInput(String(label).slice(RATIO_LABEL_PREFIX.length), 'ラベル') : null;
    if (!parsed) {
      if (window.InstantGeometrySharedLabels && typeof window.InstantGeometrySharedLabels.createSvgKatexLabel === 'function') {
        const katexNode = window.InstantGeometrySharedLabels.createSvgKatexLabel({
          createSvg: createSvg,
          text: label,
          attrs: attrs,
          kind: attrs['data-label-kind'] || attrs['data-kind'],
          id: attrs['data-label-id'] || attrs['data-id']
        });
        if (katexNode) return katexNode;
      }
      const textNode = createSvg('text', attrs);
      textNode.textContent = label;
      return textNode;
    }
    const x = Number(attrs.x) || 0;
    const y = Number(attrs.y) || 0;
    const fontSize = Number(attrs['font-size']) || 40;
    const textWidth = Math.max(fontSize * 0.7, parsed.value.length * fontSize * 0.62);
    const height = fontSize * 1.16;
    const width = parsed.mark === 't'
      ? Math.max(textWidth + fontSize * 0.8, height * 1.25)
      : Math.max(textWidth + fontSize * 0.55, height);
    const group = createSvg('g', { class: attrs.class, 'data-kind': attrs['data-kind'], 'data-id': attrs['data-id'] });
    const stroke = attrs.fill || '#687086';
    if (parsed.mark === 'r') {
      group.appendChild(createSvg('ellipse', { cx: x, cy: y, rx: width / 2, ry: height / 2, fill: '#fff', stroke: stroke, 'stroke-width': 2.3 }));
    } else if (parsed.mark === 't') {
      group.appendChild(createSvg('polygon', {
        points: [x + ',' + (y - height * 0.72), (x - width / 2) + ',' + (y + height * 0.48), (x + width / 2) + ',' + (y + height * 0.48)].join(' '),
        fill: '#fff', stroke: stroke, 'stroke-width': 2.3, 'stroke-linejoin': 'round'
      }));
    } else {
      group.appendChild(createSvg('rect', { x: x - width / 2, y: y - height / 2, width: width, height: height, rx: 5, ry: 5, fill: '#fff', stroke: stroke, 'stroke-width': 2.3 }));
    }
    const textNode = createSvg('text', Object.assign({}, attrs, { class: null, 'data-kind': null, 'data-id': null }));
    textNode.textContent = parsed.value;
    group.appendChild(textNode);
    return group;
  }

  function mix(P, Q, t) {
    return { x: P.x + (Q.x - P.x) * t, y: P.y + (Q.y - P.y) * t };
  }

  function intersectLines(P, Q, R, S) {
    const dx1 = Q.x - P.x;
    const dy1 = Q.y - P.y;
    const dx2 = S.x - R.x;
    const dy2 = S.y - R.y;
    const cross = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(cross) < 1e-9) throw new Error('指定した比では交点を作れません。');
    const t = ((R.x - P.x) * dy2 - (R.y - P.y) * dx2) / cross;
    return mix(P, Q, t);
  }

  function computeGeometry() {
    const ab = parsePositiveNumber(abInput.value, 'AB');
    const bc = parsePositiveNumber(bcInput.value, 'BC');
    const ce = parsePositiveNumber(ceInput.value, 'CE');
    const angle = 62 * Math.PI / 180;
    const v = { x: bc * Math.cos(angle), y: bc * Math.sin(angle) };
    const B = { x: 0, y: 0 };
    const A = { x: -ab, y: 0 };
    const C = { x: v.x, y: v.y };
    const D = { x: A.x + v.x, y: A.y + v.y };
    const E = { x: C.x + v.x * (ce / bc), y: C.y + v.y * (ce / bc) };
    const F = intersectLines(A, E, B, D);
    const G = intersectLines(A, E, C, D);
    return { points: { A: A, B: B, C: C, D: D, E: E, F: F, G: G } };
  }

  function computeView(points) {
    const values = Object.keys(points).map(function (id) { return points[id]; });
    const xs = values.map(function (p) { return p.x; });
    const ys = values.map(function (p) { return p.y; });
    const minX = Math.min.apply(null, xs);
    const maxX = Math.max.apply(null, xs);
    const minY = Math.min.apply(null, ys);
    const maxY = Math.max.apply(null, ys);
    const width = maxX - minX;
    const height = maxY - minY;
    const padding = Math.max(width, height) * 0.22;
    const size = Math.max(width, height) + padding * 2;
    return { x: minX - (size - width) / 2, y: minY - (size - height) / 2, size: size, width: size, height: size };
  }

  function fitPoint(point) {
    return { x: ((point.x - view.x) / view.size) * 1000, y: ((point.y - view.y) / view.size) * 1000 };
  }

  function midpoint(P, Q) {
    return { x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 };
  }

  function segmentLength(P, Q) {
    return Math.hypot(Q.x - P.x, Q.y - P.y);
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

  function areaRegions() {
    const names = {
      ABF: '△ABF',
      ADF: '△ADF',
      DFG: '△DFG',
      BCGF: '四角形BCGF',
      CGE: '△CGE'
    };
    return Object.keys(AREA_REGIONS).map(function (id) {
      const areaPoints = AREA_REGIONS[id].map(function (pointId) { return geometry.points[pointId]; });
      return {
        id: id,
        name: names[id] || '面積',
        points: areaPoints,
        value: polygonArea(areaPoints),
        labelPoint: polygonCentroid(areaPoints)
      };
    });
  }

  function labelPoint(P, Q, center, distance) {
    const mid = midpoint(P, Q);
    const dx = Q.x - P.x;
    const dy = Q.y - P.y;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    if ((center.x - mid.x) * nx + (center.y - mid.y) * ny > 0) {
      nx *= -1;
      ny *= -1;
    }
    return { x: mid.x + nx * distance, y: mid.y + ny * distance };
  }

  function normalizedDirection(P, Q) {
    const dx = Q.x - P.x;
    const dy = Q.y - P.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  }


  function drawSideKind(kind, P, Q) {
    if (!kind || kind === 'plain') return;
    if (window.InstantGeometryMobileAngleOrnaments && window.InstantGeometryMobileAngleOrnaments.drawSegmentKind(stage, kind, P, Q, createSvg)) return;
    const mid = midpoint(P, Q);
    const d = normalizedDirection(P, Q);
    const n = { x: -d.y, y: d.x };
    const stroke = 'rgb(42,91,215)';
    const addLine = function (cx, cy, half) {
      stage.appendChild(createSvg('line', {
        x1: formatNumber(cx - n.x * half), y1: formatNumber(cy - n.y * half),
        x2: formatNumber(cx + n.x * half), y2: formatNumber(cy + n.y * half),
        stroke: stroke, 'stroke-width': 3, 'stroke-linecap': 'round'
      }));
    };
    if (kind === 'circle') {
      stage.appendChild(createSvg('circle', { cx: mid.x, cy: mid.y, r: 8, fill: 'none', stroke: stroke, 'stroke-width': 3 }));
    } else if (kind === 'single') {
      addLine(mid.x, mid.y, 12);
    } else if (kind === 'double') {
      addLine(mid.x - d.x * 9, mid.y - d.y * 9, 12);
      addLine(mid.x + d.x * 9, mid.y + d.y * 9, 12);
    } else if (kind === 'cross') {
      addLine(mid.x, mid.y, 12);
      stage.appendChild(createSvg('line', {
        x1: formatNumber(mid.x - d.x * 9), y1: formatNumber(mid.y - d.y * 9),
        x2: formatNumber(mid.x + d.x * 9), y2: formatNumber(mid.y + d.y * 9),
        stroke: stroke, 'stroke-width': 3, 'stroke-linecap': 'round'
      }));
    } else if (kind === 'triangle') {
      const p1 = { x: mid.x + d.x * 12, y: mid.y + d.y * 12 };
      const p2 = { x: mid.x - d.x * 8 + n.x * 7, y: mid.y - d.y * 8 + n.y * 7 };
      const p3 = { x: mid.x - d.x * 8 - n.x * 7, y: mid.y - d.y * 8 - n.y * 7 };
      stage.appendChild(createSvg('polygon', {
        points: [p1, p2, p3].map(function (p) { return formatNumber(p.x) + ',' + formatNumber(p.y); }).join(' '),
        fill: stroke, stroke: stroke, 'stroke-width': 1.5
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

  function drawSegmentArc(P, Q, labelPoint) {
    const mid = midpoint(P, Q);
    const control = { x: labelPoint.x * 2 - mid.x, y: labelPoint.y * 2 - mid.y };
    const gapHalf = 0.14;
    stage.appendChild(createSvg('path', {
      d: quadraticPathSegment(P, control, Q, 0, 0.5 - gapHalf),
      fill: 'none', stroke: 'rgb(42,91,215)', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-dasharray': '6 5'
    }));
    stage.appendChild(createSvg('path', {
      d: quadraticPathSegment(P, control, Q, 0.5 + gapHalf, 1),
      fill: 'none', stroke: 'rgb(42,91,215)', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-dasharray': '6 5'
    }));
  }

  function drawText(kind, id, text, x, y, className) {
    if (!text) return;
    const node = createLabelNode(text, {
      x: formatNumber(x),
      y: formatNumber(y),
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      'font-size': scaledFontSize(kind, id, className === 'point-label' ? 42 : 38),
      'font-weight': 700,
      fill: className === 'point-label' ? 'rgb(31,36,48)' : 'rgb(104,112,134)',
      class: 'shape-label ' + className,
      'data-label-kind': kind,
      'data-label-id': id,
      'data-kind': kind,
      'data-id': id
    });
    node.addEventListener('click', function (event) {
      event.stopPropagation();
      openLabelSheet(kind, id);
    });
    stage.appendChild(node);
  }

  function drawSegment(id, P, Q, visible) {
    if (visible) {
      stage.appendChild(createSvg('line', {
        x1: formatNumber(P.x), y1: formatNumber(P.y), x2: formatNumber(Q.x), y2: formatNumber(Q.y),
        stroke: 'rgb(42,91,215)', 'stroke-width': 4, 'stroke-linecap': 'round'
      }));
    }
    stage.appendChild(createSvg('line', {
      x1: formatNumber(P.x), y1: formatNumber(P.y), x2: formatNumber(Q.x), y2: formatNumber(Q.y),
      stroke: 'rgba(0,0,0,0)', 'stroke-width': 34, 'stroke-linecap': 'round',
      'data-kind': 'segment', 'data-id': id
    }));
  }

  function render() {
    try {
      geometry = computeGeometry();
      view = computeView(geometry.points);
      const points = {};
      Object.keys(geometry.points).forEach(function (id) { points[id] = fitPoint(geometry.points[id]); });
      stage.innerHTML = '';
      stage.appendChild(createSvg('rect', { width: 1000, height: 1000, fill: '#fbfcff' }));
      stage.appendChild(createSvg('polygon', {
        points: [points.A, points.B, points.C, points.D].map(function (p) { return formatNumber(p.x) + ',' + formatNumber(p.y); }).join(' '),
        fill: 'rgba(42,91,215,0.03)', stroke: 'none'
      }));
      areaRegions().forEach(function (area) {
        const color = state.areaColors[area.id] || '#2a5bd7';
        stage.appendChild(createSvg('polygon', {
          points: AREA_REGIONS[area.id].map(function (pointId) {
            const p = points[pointId];
            return formatNumber(p.x) + ',' + formatNumber(p.y);
          }).join(' '),
          fill: hexToRgba(color, 0.1),
          stroke: 'none',
          'data-kind': 'area',
          'data-id': area.id
        }));
      });
      Object.keys(DRAW_SEGMENTS).forEach(function (id) {
        const pair = DRAW_SEGMENTS[id];
        drawSegment(id, points[pair[0]], points[pair[1]], true);
      });
      Object.keys(LABEL_SEGMENTS).forEach(function (id) {
        const pair = LABEL_SEGMENTS[id];
        if (!Object.prototype.hasOwnProperty.call(DRAW_SEGMENTS, id)) {
          drawSegment(id, points[pair[0]], points[pair[1]], false);
        }
        drawSideKind(state.segmentKinds[id], points[pair[0]], points[pair[1]]);
      });
      const center = { x: (points.A.x + points.C.x) / 2, y: (points.A.y + points.C.y) / 2 };
      Object.keys(LABEL_SEGMENTS).forEach(function (id) {
        const pair = LABEL_SEGMENTS[id];
        const P = points[pair[0]];
        const Q = points[pair[1]];
        const text = labelText(state.segmentInputs[id] || '', segmentLength(geometry.points[pair[0]], geometry.points[pair[1]]));
        const p = labelPoint(P, Q, center, id.length === 2 ? 34 : 30);
        if (text && state.segmentArcVisible[id] !== false) drawSegmentArc(P, Q, p);
        drawText('segment', id, text, p.x, p.y, 'segment-label');
      });
      areaRegions().forEach(function (area) {
        const text = areaLabelText(state.areaInputs[area.id] || '', area);
        if (!text) return;
        const p = fittedAreaLabel(area.points.map(fitPoint), text, 54);
        const fontSize = scaledFontSize('area', area.id, p.fontSize);
        const node = createLabelNode(text, {
          x: formatNumber(p.x),
          y: formatNumber(p.y),
          'text-anchor': 'middle',
          'dominant-baseline': 'middle',
          'font-size': fontSize,
          style: 'font-size:' + fontSize + 'px',
          'font-weight': 700,
          fill: areaLabelColor(state.areaColors[area.id] || '#2a5bd7'),
          class: 'shape-label area-label',
          'data-label-kind': 'area',
          'data-label-id': area.id,
          'data-kind': 'area',
          'data-id': area.id
        });
        node.addEventListener('click', function (event) {
          event.stopPropagation();
          openLabelSheet('area', area.id);
        });
        stage.appendChild(node);
      });
      POINT_IDS.forEach(function (id) {
        const p = points[id];
        stage.appendChild(createSvg('circle', {
          cx: formatNumber(p.x), cy: formatNumber(p.y), r: id === 'F' || id === 'G' ? 6.5 : 8,
          fill: 'rgb(31,36,48)', 'data-kind': 'point', 'data-id': id
        }));
        if (!state.pointVisible[id]) return;
        const offsets = {
          A: [-32, -34], B: [32, -34], C: [12, -34], D: [-34, 30],
          E: [38, 24], F: [-28, 24], G: [0, 34]
        };
        drawText('point', id, state.pointInputs[id], p.x + offsets[id][0], p.y + offsets[id][1], 'point-label');
      });
      setStatus('AB、BC、CE から、平行四辺形と連比③を描画しました。', false);
    } catch (error) {
      setStatus(error.message || '入力を確認してください。', true);
    }
  }

  function buildLabelEditor(value) {
  if (window.InstantGeometryDrawLabelEngine && typeof window.InstantGeometryDrawLabelEngine.buildLabelEditor === 'function') {
    return window.InstantGeometryDrawLabelEngine.buildLabelEditor('ラベル', value, true);
  }
    const field = document.createElement('div');
    field.className = 'sheet-field';
    const label = document.createElement('label');
    label.textContent = 'ラベル';
    const mode = document.createElement('select');
    [
      { value: 'hidden', label: '非表示' },
      { value: 'numeric', label: '数値' },
      { value: 'ratio', label: '比の値' },
      { value: 'text', label: '自由入力' }
    ].forEach(function (option) {
      const node = document.createElement('option');
      node.value = option.value;
      node.textContent = option.label;
      if (option.value === getLabelMode(value)) node.selected = true;
      mode.appendChild(node);
    });
    const input = document.createElement('input');
    input.type = 'text';
    input.value = getLabelMode(value) === 'ratio' ? rawRatioInput(value) : getLabelMode(value) === 'text' ? value : '';
    function sync() {
      input.disabled = mode.value !== 'ratio' && mode.value !== 'text';
      input.placeholder = mode.value === 'ratio' ? '例: r,1 / s,2 / t,3' : '';
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

  function openSegmentSheet(id) {
    sheetTitle.textContent = id;
    sheetBody.innerHTML = '';

    const kindField = document.createElement('div');
    kindField.className = 'sheet-field';
    const kindLabel = document.createElement('label');
    kindLabel.textContent = '種類';
    const kindSelect = document.createElement('select');
    [
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
    ].forEach(function (option) {
      const node = document.createElement('option');
      node.value = option.value;
      node.textContent = option.label;
      if (option.value === (state.segmentKinds[id] || 'plain')) node.selected = true;
      kindSelect.appendChild(node);
    });
    kindField.appendChild(kindLabel);
    kindField.appendChild(kindSelect);
    sheetBody.appendChild(kindField);

    const arcField = document.createElement('div');
    arcField.className = 'sheet-field';
    const arcLabel = document.createElement('label');
    arcLabel.textContent = '弧を表示';
    const arcInput = document.createElement('input');
    arcInput.type = 'checkbox';
    arcInput.checked = state.segmentArcVisible[id] !== false;
    arcInput.style.minHeight = '20px';
    arcInput.style.width = '20px';
    arcInput.style.justifySelf = 'start';
    arcField.appendChild(arcLabel);
    arcField.appendChild(arcInput);
    sheetBody.appendChild(arcField);

    const editor = buildLabelEditor(state.segmentInputs[id] || '');
    sheetBody.appendChild(editor.field);

    const hint = document.createElement('p');
    hint.className = 'sheet-hint';
    hint.textContent = lengthInputs[id]
      ? 'この線分は作図パラメータです。長さは下部の入力欄で変更できます。'
      : '非表示、数値、比の値、自由入力を選べます。比の値は「マーク,数値」の形式で入力します。例: r,1 / s,2 / t,3';
    sheetBody.appendChild(hint);

    appendActions(function () {
      const mode = editor.mode.value;
      const text = String(editor.input.value || '');
      state.segmentKinds[id] = kindSelect.value;
      state.segmentArcVisible[id] = arcInput.checked;
      if (mode === 'hidden') {
        state.segmentInputs[id] = '';
        state.segmentArcVisible[id] = false;
      } else if (mode === 'numeric') {
        state.segmentInputs[id] = ' ';
      } else if (mode === 'ratio') {
        const ratio = parseRatioLabelInput(text, 'ラベル');
        state.segmentInputs[id] = RATIO_LABEL_PREFIX + ratio.source;
      } else {
        state.segmentInputs[id] = text;
      }
      closeSheets();
      render();
    });
    openEditSheet();
  }

  function openPointSheet(id) {
    sheetTitle.textContent = id;
    sheetBody.innerHTML = '';
    const editor = buildLabelEditor(state.pointInputs[id] || '');
    editor.mode.querySelector('option[value="numeric"]').remove();
    editor.mode.querySelector('option[value="ratio"]').remove();
    sheetBody.appendChild(editor.field);
    const field = document.createElement('div');
    field.className = 'sheet-field';
    const label = document.createElement('label');
    label.textContent = '表示する';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = state.pointVisible[id];
    input.style.minHeight = '20px';
    input.style.width = '20px';
    input.style.justifySelf = 'start';
    field.appendChild(label);
    field.appendChild(input);
    sheetBody.appendChild(field);
    appendActions(function () {
      state.pointVisible[id] = input.checked;
      state.pointInputs[id] = editor.mode.value === 'text' ? String(editor.input.value || '') : '';
      closeSheets();
      render();
    });
    openEditSheet();
  }

  function openAreaSheet(id) {
    const area = areaRegions().find(function (item) { return item.id === id; });
    sheetTitle.textContent = area ? area.name : '面積';
    sheetBody.innerHTML = '';

    const editor = buildLabelEditor(state.areaInputs[id] || '');
    sheetBody.appendChild(editor.field);

    const palette = buildColorPalette('色', state.areaColors[id] || '#2a5bd7');
    sheetBody.appendChild(palette.field);

    const hint = document.createElement('p');
    hint.className = 'sheet-hint';
    hint.textContent = '非表示、数値、比の値、自由入力を選べます。比の値は「マーク,数値」の形式で入力します。例: r,1 / s,2 / t,3';
    sheetBody.appendChild(hint);

    appendActions(function () {
      const mode = editor.mode.value;
      const text = String(editor.input.value || '');
      state.areaColors[id] = palette.value;
      if (mode === 'hidden') {
        state.areaInputs[id] = '';
      } else if (mode === 'numeric') {
        state.areaInputs[id] = ' ';
      } else if (mode === 'ratio') {
        const ratio = parseRatioLabelInput(text, 'ラベル');
        state.areaInputs[id] = RATIO_LABEL_PREFIX + ratio.source;
      } else {
        state.areaInputs[id] = text;
      }
      closeSheets();
      render();
    });
    openEditSheet();
  }

  function appendActions(onSave) {
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
      try { onSave(); } catch (error) { setStatus(error.message || '入力を確認してください。', true); }
    });
    actions.appendChild(cancel);
    actions.appendChild(save);
    sheetBody.appendChild(actions);
  }

  function openEditSheet() {
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

  async function saveAs(format) {
    if (!window.html2canvas) throw new Error('保存機能の読み込みが完了していません。');
    const canvas = await window.html2canvas(captureRoot, { backgroundColor: format === 'transparent' ? null : '#fbfcff', scale: 2 });
    if (format === 'png' || format === 'transparent') {
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = format === 'transparent' ? 'parallelogram-ratio-3-transparent.png' : 'parallelogram-ratio-3.png';
      link.click();
      return;
    }
    const jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) throw new Error('PDF保存機能の読み込みが完了していません。');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 32;
    const imageWidth = pageWidth - margin * 2;
    const imageHeight = canvas.height * imageWidth / canvas.width;
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, margin, imageWidth, imageHeight);
    pdf.save('parallelogram-ratio-3.pdf');
  }

  async function saveWithQuota(format) {
    if (!window.InstantGeometrySaveQuota) return saveAs(format);
    return window.InstantGeometrySaveQuota.runWithQuota(function () { return saveAs(format); });
  }

  stage.addEventListener('click', function (event) {
    const target = event.target.closest('[data-kind][data-id]');
    if (!target) return;
    const kind = target.getAttribute('data-kind');
    const id = target.getAttribute('data-id');
    if (kind === 'segment' && LABEL_SEGMENTS[id]) openLabelSheet(kind, id);
    if (kind === 'point') openLabelSheet(kind, id);
    if (kind === 'area' && AREA_REGIONS[id]) openLabelSheet(kind, id);
  });
  backBtn.addEventListener('click', function () { window.location.href = '/draw/'; });
  saveBtn.addEventListener('click', function () {
    saveSheet.classList.add('open');
    saveSheet.setAttribute('aria-hidden', 'false');
    sheetBackdrop.classList.add('open');
  });
  sheetBackdrop.addEventListener('click', closeSheets);
  sheetClose.addEventListener('click', closeSheets);
  saveSheetClose.addEventListener('click', closeSheets);
  savePngBtn.addEventListener('click', async function () { try { await saveWithQuota('png'); closeSheets(); } catch (error) { setStatus(error.message, true); } });
  saveTransparentBtn.addEventListener('click', async function () { try { await saveWithQuota('transparent'); closeSheets(); } catch (error) { setStatus(error.message, true); } });
  savePdfBtn.addEventListener('click', async function () { try { await saveWithQuota('pdf'); closeSheets(); } catch (error) { setStatus(error.message, true); } });
  [abInput, bcInput, ceInput].forEach(function (input) {
    input.addEventListener('input', render);
  });

  render();
}());
