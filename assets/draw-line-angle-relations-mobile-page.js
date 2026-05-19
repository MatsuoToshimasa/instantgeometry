(function () {
  'use strict';

  const PAGE_TYPE = document.body.dataset.angleRelation || 'corresponding';
  const PAGE_CONFIGS = {
    corresponding: {
      ready: '平行線 PQ, RS を線分 AB が横切る同位角を描画しました。',
      fileBase: 'corresponding-angles',
      parameterAngle: 'QMN',
      pointIds: ['P', 'Q', 'R', 'S', 'A', 'B', 'M', 'N'],
      segments: { PQ: ['P', 'Q'], RS: ['R', 'S'], AB: ['A', 'B'] },
      angles: { QMB: ['Q', 'M', 'B'], SNB: ['S', 'N', 'B'] },
      visibleAngles: ['QMB', 'SNB']
    },
    alternate: {
      ready: '平行線 PQ, RS を線分 AB が横切る錯角を描画しました。',
      fileBase: 'alternate-interior-angles',
      parameterAngle: 'QMN',
      pointIds: ['P', 'Q', 'R', 'S', 'A', 'B', 'M', 'N'],
      segments: { PQ: ['P', 'Q'], RS: ['R', 'S'], AB: ['A', 'B'] },
      angles: { QMN: ['Q', 'M', 'N'], MNR: ['M', 'N', 'R'] },
      visibleAngles: ['QMN', 'MNR']
    },
    vertical: {
      ready: '2本の線分 AB と CD が交わる対頂角を描画しました。',
      fileBase: 'vertical-angles',
      parameterAngle: 'AOD',
      pointIds: ['A', 'B', 'C', 'D', 'O'],
      segments: { AB: ['A', 'B'], CD: ['C', 'D'] },
      angles: { AOC: ['A', 'O', 'C'], BOD: ['B', 'O', 'D'], AOD: ['A', 'O', 'D'], BOC: ['B', 'O', 'C'] },
      visibleAngles: ['AOD', 'BOC'],
      arcHiddenAngles: ['AOC', 'BOD']
    }
  };
  const config = PAGE_CONFIGS[PAGE_TYPE] || PAGE_CONFIGS.corresponding;

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
  const parameterInput = config.parameterAngle ? document.getElementById(config.parameterAngle.toLowerCase() + 'Input') : null;

  const state = {
    points: {},
    pointVisible: {},
    segmentInputs: {},
    segmentKinds: {},
    segmentArcVisible: {},
    angleInputs: {},
    angleKinds: {}
  };
  let geometry = null;
  let view = null;
  const LabelEngine = window.InstantGeometryDrawLabelEngine || window.InstantGeometryTriangleLabelEngine || null;
  let labelController = null;

  config.pointIds.forEach(function (id) {
    state.points[id] = id;
    state.pointVisible[id] = false;
  });
  Object.keys(config.segments).forEach(function (id) {
    state.segmentInputs[id] = '';
    state.segmentKinds[id] = 'plain';
    state.segmentArcVisible[id] = true;
  });
  Object.keys(config.angles).forEach(function (id) {
    state.angleInputs[id] = config.visibleAngles.indexOf(id) >= 0 ? ' ' : '';
    state.angleKinds[id] = 'plain';
  });

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

  function formatNumber(value) {
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  }

  function parseAngleInput(input, label) {
    const text = String(input && input.value || '').trim();
    if (!/^[1-9][0-9]*(?:\.[0-9]+)?$/.test(text)) throw new Error(label + ' は数値で入力してください。');
    const value = Number(text);
    if (!(value > 0 && value < 180)) throw new Error(label + ' は 0° より大きく 180° 未満で入力してください。');
    return value;
  }

  function computeGeometry() {
    if (PAGE_TYPE === 'vertical') {
      const aod = parseAngleInput(parameterInput, '∠AOD');
      const lineAngle = -34;
      const otherAngle = lineAngle + 180 - aod;
      const length = 4.1;
      const radians1 = lineAngle * Math.PI / 180;
      const radians2 = otherAngle * Math.PI / 180;
      const lineVector = { x: Math.cos(radians1) * length, y: Math.sin(radians1) * length };
      const otherVector = { x: Math.cos(radians2) * length, y: Math.sin(radians2) * length };
      const points = {
        A: { x: -lineVector.x, y: -lineVector.y },
        B: { x: lineVector.x, y: lineVector.y },
        C: { x: -otherVector.x, y: -otherVector.y },
        D: { x: otherVector.x, y: otherVector.y },
        O: { x: 0, y: 0 }
      };
      return {
        points: points,
        angles: {
          AOC: angleValue(points.A, points.O, points.C),
          BOD: angleValue(points.B, points.O, points.D),
          AOD: angleValue(points.A, points.O, points.D),
          BOC: angleValue(points.B, points.O, points.C)
        }
      };
    }

    const qmn = parseAngleInput(parameterInput, '∠QMN');
    const gap = 3.2;
    const radians = qmn * Math.PI / 180;
    const dx = gap / Math.tan(radians);
    const M = { x: -0.8, y: -1.6 };
    const N = { x: M.x + dx, y: M.y + gap };
    const v = { x: N.x - M.x, y: N.y - M.y };
    const points = {
      P: { x: -5.2, y: -1.6 },
      Q: { x: 5.2, y: -1.6 },
      R: { x: -5.2, y: 1.6 },
      S: { x: 5.2, y: 1.6 },
      A: { x: M.x - v.x * 0.42, y: M.y - v.y * 0.42 },
      B: { x: N.x + v.x * 0.42, y: N.y + v.y * 0.42 },
      M: M,
      N: N
    };
    return {
      points: points,
      angles: {
        QMN: angleValue(points.Q, points.M, points.N),
        QMB: angleValue(points.Q, points.M, points.B),
        SNB: angleValue(points.S, points.N, points.B),
        MNR: angleValue(points.M, points.N, points.R)
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
    const padding = Math.max(width, height) * 0.17;
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

  function angleValue(a, b, c) {
    const v1 = { x: a.x - b.x, y: a.y - b.y };
    const v2 = { x: c.x - b.x, y: c.y - b.y };
    const len1 = Math.hypot(v1.x, v1.y) || 1;
    const len2 = Math.hypot(v2.x, v2.y) || 1;
    const dot = Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / (len1 * len2)));
    return Math.acos(dot) * 180 / Math.PI;
  }

  function arcPoints(vertex, p1, p2, radius) {
    const a1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
    const a2 = Math.atan2(p2.y - vertex.y, p2.x - vertex.x);
    let delta = a2 - a1;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    const points = [];
    for (let i = 0; i <= 28; i += 1) {
      const angle = a1 + delta * (i / 28);
      points.push({ x: vertex.x + Math.cos(angle) * radius, y: vertex.y + Math.sin(angle) * radius });
    }
    return points;
  }

  function pathFromPoints(points) {
    return points.map(function (point, index) {
      return (index === 0 ? 'M ' : 'L ') + formatNumber(point.x) + ' ' + formatNumber(point.y);
    }).join(' ');
  }

  function midpoint(A, B) {
    return { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  }

  function normalizedDirection(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  }

  function drawSideKind(kind, A, B) {
    if (!kind || kind === 'plain') return;
    if (window.InstantGeometryMobileAngleOrnaments && window.InstantGeometryMobileAngleOrnaments.drawSegmentKind(stage, kind, A, B, createSvg, { color: 'rgb(42,91,215)' })) return;
    const mid = midpoint(A, B);
    const d = normalizedDirection(A, B);
    const n = { x: -d.y, y: d.x };
    const stroke = 'rgb(42,91,215)';
    const addLine = function (cx, cy, half) {
      stage.appendChild(createSvg('line', {
        x1: formatNumber(cx - n.x * half),
        y1: formatNumber(cy - n.y * half),
        x2: formatNumber(cx + n.x * half),
        y2: formatNumber(cy + n.y * half),
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
      addLine(mid.x - d.x * 9, mid.y - d.y * 9, 12);
      addLine(mid.x + d.x * 9, mid.y + d.y * 9, 12);
    } else if (kind === 'cross') {
      addLine(mid.x, mid.y, 12);
      stage.appendChild(createSvg('line', {
        x1: formatNumber(mid.x - d.x * 9),
        y1: formatNumber(mid.y - d.y * 9),
        x2: formatNumber(mid.x + d.x * 9),
        y2: formatNumber(mid.y + d.y * 9),
        stroke: stroke,
        'stroke-width': 3,
        'stroke-linecap': 'round'
      }));
    } else if (kind === 'triangle') {
      const p1 = { x: mid.x + d.x * 12, y: mid.y + d.y * 12 };
      const p2 = { x: mid.x - d.x * 8 + n.x * 7, y: mid.y - d.y * 8 + n.y * 7 };
      const p3 = { x: mid.x - d.x * 8 - n.x * 7, y: mid.y - d.y * 8 - n.y * 7 };
      stage.appendChild(createSvg('polygon', {
        points: [p1, p2, p3].map(function (p) { return formatNumber(p.x) + ',' + formatNumber(p.y); }).join(' '),
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

  function quadraticPathSegment(P, control, Q, start, end) {
    const points = [];
    for (let i = 0; i <= 20; i += 1) {
      const t = start + (end - start) * (i / 20);
      points.push(quadraticPoint(P, control, Q, t));
    }
    return pathFromPoints(points);
  }

  function drawSegmentArc(A, B, labelPoint) {
    const mid = midpoint(A, B);
    const control = { x: labelPoint.x * 2 - mid.x, y: labelPoint.y * 2 - mid.y };
    const gapHalf = 0.14;
    stage.appendChild(createSvg('path', {
      d: quadraticPathSegment(A, control, B, 0, 0.5 - gapHalf),
      fill: 'none',
      stroke: 'rgb(42,91,215)',
      'stroke-width': 2,
      'stroke-linecap': 'round',
      'stroke-dasharray': '6 5'
    }));
    stage.appendChild(createSvg('path', {
      d: quadraticPathSegment(A, control, B, 0.5 + gapHalf, 1),
      fill: 'none',
      stroke: 'rgb(42,91,215)',
      'stroke-width': 2,
      'stroke-linecap': 'round',
      'stroke-dasharray': '6 5'
    }));
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

  function createLabelNode(label, attrs) {
    const parsed = isRatioLabelValue(label) ? parseRatioLabelInput(String(label).slice(RATIO_LABEL_PREFIX.length)) : null;
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
    const group = createSvg('g', {
      class: attrs.class,
      'data-kind': attrs['data-kind'],
      'data-id': attrs['data-id']
    });
    const stroke = attrs.fill || '#687086';
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
    const textNode = createSvg('text', Object.assign({}, attrs, { class: null, 'data-kind': null, 'data-id': null }));
    textNode.textContent = parsed.value;
    group.appendChild(textNode);
    return group;
  }

  function drawText(text, x, y, className, data) {
    const node = createLabelNode(text, {
      x: formatNumber(x),
      y: formatNumber(y),
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      'font-size': className.indexOf('angle-label') >= 0 ? 40 : 42,
      'font-weight': 700,
      fill: className.indexOf('angle-label') >= 0 ? 'rgb(104,112,134)' : 'rgb(31,36,48)',
      class: 'shape-label ' + className,
      'data-label-kind': data.kind,
      'data-label-id': data.id,
      'data-kind': data.kind,
      'data-id': data.id
    });
    node.addEventListener('click', function (event) {
      event.stopPropagation();
      if (data.kind === 'point') openPointSheet(data.id);
      if (data.kind === 'segment') openSegmentSheet(data.id);
      if (data.kind === 'angle') openAngleSheet(data.id);
    });
    stage.appendChild(node);
    return node;
  }

  function getLabelMode(value) {
    if (value === '') return 'hidden';
    if (isRatioLabelValue(value)) return 'ratio';
    if (value === ' ' || value === '0') return 'numeric';
    return 'text';
  }

  function labelForAngle(id, value) {
    const mode = getLabelMode(state.angleInputs[id]);
    if (mode === 'hidden') return '';
    if (mode === 'numeric') return formatNumber(value) + '°';
    return state.angleInputs[id];
  }

  function labelForSegment(id) {
    const mode = getLabelMode(state.segmentInputs[id]);
    if (mode === 'hidden') return '';
    if (mode === 'numeric') {
      const pair = config.segments[id];
      const A = geometry.points[pair[0]];
      const B = geometry.points[pair[1]];
      return formatNumber(Math.hypot(B.x - A.x, B.y - A.y));
    }
    return state.segmentInputs[id];
  }

  function drawSegments(screenPoints) {
    Object.keys(config.segments).forEach(function (id) {
      const pair = config.segments[id];
      const A = screenPoints[pair[0]];
      const B = screenPoints[pair[1]];
      const line = createSvg('line', {
        x1: formatNumber(A.x),
        y1: formatNumber(A.y),
        x2: formatNumber(B.x),
        y2: formatNumber(B.y),
        stroke: 'rgb(42,91,215)',
        'stroke-width': 4,
        'stroke-linecap': 'round',
        'data-kind': 'segment',
        'data-id': id
      });
      const hit = createSvg('line', {
        x1: formatNumber(A.x),
        y1: formatNumber(A.y),
        x2: formatNumber(B.x),
        y2: formatNumber(B.y),
        stroke: 'rgba(0,0,0,0)',
        'stroke-width': 34,
        'stroke-linecap': 'round',
        'data-kind': 'segment',
        'data-id': id
      });
      [line, hit].forEach(function (node) {
        node.addEventListener('click', function (event) {
          event.stopPropagation();
          openSegmentSheet(id);
        });
        stage.appendChild(node);
      });
      drawSideKind(state.segmentKinds[id], A, B);

      const label = labelForSegment(id);
      if (label) {
        const m = midpoint(A, B);
        const d = normalizedDirection(A, B);
        const labelPoint = { x: m.x - d.y * 32, y: m.y + d.x * 32 };
        if (state.segmentArcVisible[id] !== false) drawSegmentArc(A, B, labelPoint);
        drawText(label, labelPoint.x, labelPoint.y, 'segment-label', { kind: 'segment', id: id });
      }
    });
  }

  function drawAngles(screenPoints) {
    Object.keys(config.angles).forEach(function (id) {
      const ids = config.angles[id];
      const A = screenPoints[ids[0]];
      const V = screenPoints[ids[1]];
      const B = screenPoints[ids[2]];
      const value = geometry && geometry.angles && geometry.angles[id] !== undefined
        ? geometry.angles[id]
        : angleValue(A, V, B);
      const label = labelForAngle(id, value);
      const kind = state.angleKinds[id] || 'plain';
      if (window.InstantGeometryMobileAngleOrnaments && window.InstantGeometryMobileAngleOrnaments.normalizeAngleKind(kind, value) !== kind) {
        state.angleKinds[id] = 'plain';
      }
      const arc = arcPoints(V, A, B, PAGE_TYPE === 'vertical' ? 90 : 70);
      const arcHidden = (config.arcHiddenAngles || []).indexOf(id) >= 0;
      if (!arcHidden && (state.angleKinds[id] || 'plain') !== 'hidden' && (state.angleKinds[id] || 'plain') !== 'right') {
        const path = createSvg('path', {
          d: pathFromPoints(arc),
          fill: 'none',
          stroke: 'rgb(104,112,134)',
          'stroke-width': 2.4,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          'data-kind': 'angle',
          'data-id': id
        });
        path.addEventListener('click', function (event) {
          event.stopPropagation();
          openAngleSheet(id);
        });
        stage.appendChild(path);
      }
      const hit = createSvg('path', {
        d: pathFromPoints(arc),
        fill: 'none',
        stroke: 'rgba(0,0,0,0)',
        'stroke-width': 36,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'data-kind': 'angle',
        'data-id': id
      });
      hit.addEventListener('click', function (event) {
        event.stopPropagation();
        openAngleSheet(id);
      });
      stage.appendChild(hit);

      if (!arcHidden && window.InstantGeometryMobileAngleOrnaments) {
        const ornamentCenter = arc[Math.floor(arc.length / 2)];
        window.InstantGeometryMobileAngleOrnaments.drawAngleKind(stage, state.angleKinds[id], arc, V, ornamentCenter, createSvg, { p1: A, p2: B });
      }
      if (!label) return;
      const mid = arc[Math.floor(arc.length / 2)];
      const dir = normalizedDirection(V, mid);
      drawText(label, V.x + dir.x * (PAGE_TYPE === 'vertical' ? 138 : 118), V.y + dir.y * (PAGE_TYPE === 'vertical' ? 138 : 118), 'angle-label', { kind: 'angle', id: id });
    });
  }

  function drawPoints(screenPoints) {
    config.pointIds.forEach(function (id) {
      const P = screenPoints[id];
      if (!P) return;
      const dot = createSvg('circle', {
        cx: formatNumber(P.x),
        cy: formatNumber(P.y),
        r: id === 'M' || id === 'N' || id === 'O' ? 7 : 8,
        fill: 'rgb(31,36,48)',
        'data-kind': 'point',
        'data-id': id
      });
      dot.addEventListener('click', function (event) {
        event.stopPropagation();
        openPointSheet(id);
      });
      stage.appendChild(dot);
      if (!state.pointVisible[id]) return;

      let dx = 0;
      let dy = -34;
      if (PAGE_TYPE !== 'vertical') {
        const offsets = { P: [-28, -34], Q: [28, -34], R: [-28, 34], S: [28, 34], A: [-28, -34], B: [30, 36], M: [-30, -34], N: [30, 34] };
        dx = offsets[id][0];
        dy = offsets[id][1];
      } else {
        const offsets = { A: [-30, 32], B: [32, -32], C: [-32, -32], D: [32, 32], O: [0, -40] };
        dx = offsets[id][0];
        dy = offsets[id][1];
      }
      drawText(state.points[id], P.x + dx, P.y + dy, '', { kind: 'point', id: id });
    });
  }

  function render() {
    try {
      geometry = computeGeometry();
      view = computeView(geometry.points);
      stage.innerHTML = '';
      stage.appendChild(createSvg('rect', { width: 1000, height: 1000, fill: '#fbfcff' }));
      const screenPoints = {};
      Object.keys(geometry.points).forEach(function (id) { screenPoints[id] = fitPoint(geometry.points[id]); });
      drawSegments(screenPoints);
      drawAngles(screenPoints);
      drawPoints(screenPoints);
      setStatus(config.ready, false);
    } catch (error) {
      setStatus(error.message || '描画できませんでした。', true);
    }
  }

  function buildInput(label, value, onInput) {
    const field = document.createElement('div');
    field.className = 'sheet-field';
    const labelNode = document.createElement('label');
    labelNode.textContent = label;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = value;
    input.addEventListener('input', function () { onInput(input.value); });
    field.appendChild(labelNode);
    field.appendChild(input);
    sheetBody.appendChild(field);
    input.focus();
    input.select();
    return input;
  }

  function buildCheckbox(label, checked, onChange) {
    const field = document.createElement('div');
    field.className = 'sheet-field';
    const labelNode = document.createElement('label');
    labelNode.textContent = label;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.addEventListener('change', function () { onChange(input.checked); });
    field.appendChild(labelNode);
    field.appendChild(input);
    sheetBody.appendChild(field);
  }

  function buildSelect(label, value, options, onChange) {
    if (Array.isArray(value)) {
      const legacyOptions = value;
      value = options;
      options = legacyOptions;
    }
    const field = document.createElement('div');
    field.className = 'sheet-field';
    const labelNode = document.createElement('label');
    labelNode.textContent = label;
    const select = document.createElement('select');
    (options || []).forEach(function (option) {
      const opt = document.createElement('option');
      opt.value = option.value;
      opt.textContent = option.label;
      select.appendChild(opt);
    });
    select.value = value;
    if (typeof onChange === 'function') {
      select.addEventListener('change', function () { onChange(select.value); });
    }
    field.appendChild(labelNode);
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
      hasNumericMode ? { value: 'ratio', label: '比の値' } : null,
      { value: 'text', label: '自由入力' }
    ].filter(Boolean).forEach(function (option) {
      const node = document.createElement('option');
      node.value = option.value;
      node.textContent = option.label;
      if (option.value === getLabelMode(value)) node.selected = true;
      mode.appendChild(node);
    });
    const input = document.createElement('input');
    input.type = 'text';
    input.value = getLabelMode(value) === 'text' ? String(value || '') : getRatioLabelInput(value);
    input.setAttribute('inputmode', 'text');
    input.autocapitalize = 'none';
    input.autocomplete = 'off';
    input.spellcheck = false;
    function sync() {
      const editable = mode.value === 'text' || mode.value === 'ratio';
      input.disabled = !editable;
      input.placeholder = mode.value === 'ratio' ? '例: s,5 / t,4.4 / r,5/3' : '';
    }
    mode.addEventListener('change', sync);
    field.appendChild(label);
    field.appendChild(mode);
    field.appendChild(input);
    sync();
    return { field: field, mode: mode, input: input };
  }

  function openSheet(title) {
    sheetTitle.textContent = title;
    sheetBody.innerHTML = '';
    editSheet.classList.add('open');
    editSheet.setAttribute('aria-hidden', 'false');
    sheetBackdrop.classList.add('open');
  }

  function closeEditSheet() {
    editSheet.classList.remove('open');
    editSheet.setAttribute('aria-hidden', 'true');
    sheetBackdrop.classList.remove('open');
  }

  function openPointSheet(id) {
    if (labelController) {
      labelController.openEditSheet('point', id);
      return;
    }
    openSheet('点 ' + id);
    buildInput('ラベル', state.points[id], function (value) {
      state.points[id] = value;
      render();
    });
    buildCheckbox('表示する', state.pointVisible[id], function (checked) {
      state.pointVisible[id] = checked;
      render();
    });
  }

  function openSegmentSheet(id) {
    if (labelController) {
      labelController.openEditSheet('segment', id);
      return;
    }
    openSheet('線分 ' + id);
    const kindSelect = buildSelect('種類', state.segmentKinds[id] || 'plain', [
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
    sheetBody.appendChild(kindSelect.field);
    const arcField = document.createElement('div');
    arcField.className = 'sheet-field';
    const arcLabel = document.createElement('label');
    arcLabel.textContent = '弧を表示';
    const arcInput = document.createElement('input');
    arcInput.type = 'checkbox';
    arcInput.checked = state.segmentArcVisible[id] !== false;
    arcField.appendChild(arcLabel);
    arcField.appendChild(arcInput);
    sheetBody.appendChild(arcField);
    const labelEditor = buildLabelEditor('ラベル', state.segmentInputs[id] || '', true);
    sheetBody.appendChild(labelEditor.field);
    const hint = document.createElement('p');
    hint.className = 'sheet-hint';
    hint.textContent = '非表示、数値、比の値、自由入力を選べます。\n比の値は「マーク,数値」の形式で入力します。例: s,5 / t,4.4 / r,5/3\ns: 四角で囲む\nt: 三角で囲む\nr: 丸で囲む';
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
      try {
        state.segmentKinds[id] = kindSelect.select.value;
        state.segmentArcVisible[id] = arcInput.checked;
        const mode = labelEditor.mode.value;
        const text = String(labelEditor.input.value || '');
        if (mode === 'hidden') {
          state.segmentInputs[id] = '';
          state.segmentArcVisible[id] = false;
        } else if (mode === 'numeric') {
          state.segmentInputs[id] = ' ';
        } else if (mode === 'ratio') {
          const ratio = parseRatioLabelInput(text);
          if (!ratio) throw new Error('比の値は「r,5」「t,4.4」「s,5/3」の形式で入力してください。');
          state.segmentInputs[id] = RATIO_LABEL_PREFIX + ratio.source;
        } else {
          state.segmentInputs[id] = text || '';
        }
        closeSheets();
        render();
      } catch (error) {
        setStatus(error.message || '入力を確認してください。', true);
      }
    });
    actions.appendChild(cancel);
    actions.appendChild(save);
    sheetBody.appendChild(actions);
  }

  function openAngleSheet(id) {
    if (labelController) {
      labelController.openEditSheet('angle', id);
      return;
    }
    openSheet('∠' + id);
    let kindSelect = null;
    if (window.InstantGeometryMobileAngleOrnaments) {
      kindSelect = window.InstantGeometryMobileAngleOrnaments.appendAngleKindSelect(
        sheetBody,
        buildSelect,
        state.angleKinds[id] || 'plain',
        geometry ? geometry.angles[id] : null
      );
    }
    const labelEditor = buildLabelEditor('ラベル', state.angleInputs[id] || '', true);
    sheetBody.appendChild(labelEditor.field);
    const hint = document.createElement('p');
    hint.className = 'sheet-hint';
    hint.textContent = '非表示、数値、比の値、自由入力を選べます。\n比の値は「マーク,数値」の形式で入力します。例: s,5 / t,4.4 / r,5/3\ns: 四角で囲む\nt: 三角で囲む\nr: 丸で囲む';
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
      try {
        if (kindSelect) state.angleKinds[id] = kindSelect.value;
        const mode = labelEditor.mode.value;
        const text = String(labelEditor.input.value || '');
        if (mode === 'hidden') {
          state.angleInputs[id] = '';
        } else if (mode === 'numeric') {
          state.angleInputs[id] = ' ';
        } else if (mode === 'ratio') {
          const ratio = parseRatioLabelInput(text);
          if (!ratio) throw new Error('比の値は「r,5」「t,4.4」「s,5/3」の形式で入力してください。');
          state.angleInputs[id] = RATIO_LABEL_PREFIX + ratio.source;
        } else {
          state.angleInputs[id] = text || '';
        }
        closeSheets();
        render();
      } catch (error) {
        setStatus(error.message || '入力を確認してください。', true);
      }
    });
    actions.appendChild(cancel);
    actions.appendChild(save);
    sheetBody.appendChild(actions);
  }

  function normalizeControllerLabelValue(value) {
    const text = String(value || '');
    if (LabelEngine && (
      text === LabelEngine.DECIMAL_NUMERIC_LABEL_VALUE ||
      text === LabelEngine.RAW_NUMERIC_LABEL_VALUE
    )) {
      return ' ';
    }
    return text;
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

  if (LabelEngine && typeof LabelEngine.createController === 'function') {
    labelController = LabelEngine.createController({
      enabledLabels: true,
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
        return LabelEngine.getStandardModalSpec(modalType);
      },
      getLabelValue: function (kind, id) {
        if (kind === 'point') return state.pointVisible[id] ? String(state.points[id] || id) : '';
        if (kind === 'segment') return String(state.segmentInputs[id] || '');
        if (kind === 'angle') return String(state.angleInputs[id] || '');
        return '';
      },
      setLabelValue: function (kind, id, value) {
        const text = normalizeControllerLabelValue(value);
        if (kind === 'point') {
          state.points[id] = text || id;
          state.pointVisible[id] = Boolean(text);
        } else if (kind === 'segment') {
          state.segmentInputs[id] = text;
          if (!text) state.segmentArcVisible[id] = false;
        } else if (kind === 'angle') {
          state.angleInputs[id] = text;
        }
      },
      hasGuideField: function (kind) {
        return kind === 'segment';
      },
      getGuideVisible: function (kind, id) {
        return kind === 'segment' ? state.segmentArcVisible[id] !== false : false;
      },
      setGuideVisible: function (kind, id, value) {
        if (kind === 'segment') state.segmentArcVisible[id] = value;
      },
      buildSegmentKindSelect: buildControllerSegmentKindSelect,
      buildAngleKindSelect: function (kind, id, buildSelectFn, body) {
        if (!window.InstantGeometryMobileAngleOrnaments) return null;
        return window.InstantGeometryMobileAngleOrnaments.appendAngleKindSelect(
          body,
          buildSelectFn,
          state.angleKinds[id] || 'plain',
          geometry ? geometry.angles[id] : null
        );
      },
      setKind: function (kind, id, value) {
        if (kind === 'segment') state.segmentKinds[id] = value;
        else if (kind === 'angle') state.angleKinds[id] = value;
      },
      hasColorField: function () {
        return false;
      }
    });
  }

  function openSaveSheet() {
    saveSheet.classList.add('open');
    saveSheet.setAttribute('aria-hidden', 'false');
    sheetBackdrop.classList.add('open');
  }

  function closeSaveSheet() {
    saveSheet.classList.remove('open');
    saveSheet.setAttribute('aria-hidden', 'true');
    sheetBackdrop.classList.remove('open');
  }

  function closeSheets() {
    closeEditSheet();
    closeSaveSheet();
  }

  function renderForExport(transparent) {
    const previousStatusDisplay = statusBox.style.display;
    statusBox.style.display = 'none';
    if (transparent) stage.style.background = 'transparent';
    return function restore() {
      statusBox.style.display = previousStatusDisplay;
      stage.style.background = '';
    };
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function savePng(transparent) {
    if (!window.html2canvas) return;
    const restore = renderForExport(transparent);
    window.html2canvas(captureRoot, {
      backgroundColor: transparent ? null : '#fbfcff',
      scale: Math.min(3, window.devicePixelRatio || 2)
    }).then(function (canvas) {
      restore();
      canvas.toBlob(function (blob) {
        if (blob) downloadBlob(blob, config.fileBase + (transparent ? '-transparent' : '') + '.png');
      });
    }).catch(function () {
      restore();
      setStatus('PNG保存に失敗しました。', true);
    });
  }

  function savePdf() {
    if (!window.html2canvas || !window.jspdf || !window.jspdf.jsPDF) return;
    const restore = renderForExport(false);
    window.html2canvas(captureRoot, { backgroundColor: '#fbfcff', scale: 2 }).then(function (canvas) {
      restore();
      const pdf = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 36;
      const maxWidth = pageWidth - margin * 2;
      const maxHeight = pageHeight - margin * 2;
      const ratio = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
      const width = canvas.width * ratio;
      const height = canvas.height * ratio;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pageWidth - width) / 2, (pageHeight - height) / 2, width, height);
      pdf.save(config.fileBase + '.pdf');
    }).catch(function () {
      restore();
      setStatus('PDF保存に失敗しました。', true);
    });
  }

  backBtn.addEventListener('click', function () {
    window.location.href = '/draw/';
  });
  saveBtn.addEventListener('click', openSaveSheet);
  sheetClose.addEventListener('click', closeEditSheet);
  saveSheetClose.addEventListener('click', closeSaveSheet);
  sheetBackdrop.addEventListener('click', closeSheets);
  savePngBtn.addEventListener('click', function () { closeSaveSheet(); savePng(false); });
  saveTransparentBtn.addEventListener('click', function () { closeSaveSheet(); savePng(true); });
  savePdfBtn.addEventListener('click', function () { closeSaveSheet(); savePdf(); });
  if (parameterInput) parameterInput.addEventListener('input', render);
  window.addEventListener('resize', render);

  render();
}());
