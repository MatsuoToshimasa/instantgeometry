(function () {
  'use strict';

  function drawAngleKind(stage, kind, arc, vertex, center, createSvg, edgePoints, options) {
    if (!kind || kind === 'plain' || kind === 'hidden') return;
    const stroke = (options && options.color) || '#687086';
    const scale = Math.max(0.5, (options && Number(options.scale)) || 1);
    const strokeWidth = 2.6 * scale;
    const mid = arc[Math.floor(arc.length / 2)];
    const radialX = mid.x - vertex.x;
    const radialY = mid.y - vertex.y;
    const radialLen = Math.hypot(radialX, radialY) || 1;
    const radialUx = radialX / radialLen;
    const radialUy = radialY / radialLen;
    const radialTx = -radialUy;
    const radialTy = radialUx;
    const vx = center.x - vertex.x;
    const vy = center.y - vertex.y;
    const vlen = Math.hypot(vx, vy) || 1;
    const ux = vx / vlen;
    const uy = vy / vlen;
    const tx = -uy;
    const ty = ux;
    const addLine = function (cx, cy, half, offset) {
      const ox = ux * offset;
      const oy = uy * offset;
      stage.appendChild(createSvg('line', {
        x1: cx + ox - tx * half,
        y1: cy + oy - ty * half,
        x2: cx + ox + tx * half,
        y2: cy + oy + ty * half,
        stroke: stroke,
        'stroke-width': strokeWidth,
        'stroke-linecap': 'round'
      }));
    };

    if (kind === 'circle') {
      stage.appendChild(createSvg('circle', {
        cx: mid.x,
        cy: mid.y,
        r: 7 * scale,
        fill: 'none',
        stroke: stroke,
        'stroke-width': strokeWidth
      }));
    } else if (kind === 'cross') {
      addLine(mid.x, mid.y, 10 * scale, 0);
      stage.appendChild(createSvg('line', {
        x1: mid.x - ux * 8 * scale,
        y1: mid.y - uy * 8 * scale,
        x2: mid.x + ux * 8 * scale,
        y2: mid.y + uy * 8 * scale,
        stroke: stroke,
        'stroke-width': strokeWidth,
        'stroke-linecap': 'round'
      }));
    } else if (kind === 'double-cross') {
      stage.appendChild(createSvg('line', {
        x1: mid.x - radialUx * 9 * scale - radialTx * 5 * scale,
        y1: mid.y - radialUy * 9 * scale - radialTy * 5 * scale,
        x2: mid.x + radialUx * 9 * scale - radialTx * 5 * scale,
        y2: mid.y + radialUy * 9 * scale - radialTy * 5 * scale,
        stroke: stroke,
        'stroke-width': strokeWidth,
        'stroke-linecap': 'round'
      }));
      stage.appendChild(createSvg('line', {
        x1: mid.x - radialUx * 9 * scale + radialTx * 5 * scale,
        y1: mid.y - radialUy * 9 * scale + radialTy * 5 * scale,
        x2: mid.x + radialUx * 9 * scale + radialTx * 5 * scale,
        y2: mid.y + radialUy * 9 * scale + radialTy * 5 * scale,
        stroke: stroke,
        'stroke-width': strokeWidth,
        'stroke-linecap': 'round'
      }));
    } else if (kind === 'triangle') {
      const p1 = { x: mid.x + ux * 12 * scale, y: mid.y + uy * 12 * scale };
      const p2 = { x: mid.x - ux * 8 * scale + tx * 6 * scale, y: mid.y - uy * 8 * scale + ty * 6 * scale };
      const p3 = { x: mid.x - ux * 8 * scale - tx * 6 * scale, y: mid.y - uy * 8 * scale - ty * 6 * scale };
      stage.appendChild(createSvg('polygon', {
        points: [p1, p2, p3].map(function (p) { return p.x + ',' + p.y; }).join(' '),
        fill: stroke,
        stroke: stroke,
        'stroke-width': 1.5 * scale
      }));
    } else if (kind === 'right' && edgePoints && edgePoints.p1 && edgePoints.p2) {
      const a = edgePoints.p1;
      const b = edgePoints.p2;
      const ax = a.x - vertex.x;
      const ay = a.y - vertex.y;
      const bx = b.x - vertex.x;
      const by = b.y - vertex.y;
      const alen = Math.hypot(ax, ay) || 1;
      const blen = Math.hypot(bx, by) || 1;
      const size = Math.min(38 * scale, Math.max(24 * scale, Math.min(alen, blen) * 0.18 * scale));
      const u1 = { x: ax / alen, y: ay / alen };
      const u2 = { x: bx / blen, y: by / blen };
      const q1 = { x: vertex.x + u1.x * size, y: vertex.y + u1.y * size };
      const q2 = { x: q1.x + u2.x * size, y: q1.y + u2.y * size };
      const q3 = { x: vertex.x + u2.x * size, y: vertex.y + u2.y * size };
      stage.appendChild(createSvg('path', {
        d: 'M ' + q1.x + ' ' + q1.y + ' L ' + q2.x + ' ' + q2.y + ' L ' + q3.x + ' ' + q3.y,
        fill: 'none',
        stroke: stroke,
        'stroke-width': strokeWidth,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round'
      }));
    }
  }

  function isRightAngleValue(value) {
    return Number.isFinite(value) && Math.abs(value - 90) < 0.01;
  }

  function getAngleKindOptions(angleValue) {
    const options = [
      { value: 'hidden', label: '非表示' },
      { value: 'plain', label: '角弧のみ' },
      { value: 'circle', label: '丸付き' },
      { value: 'cross', label: '交差付き' },
      { value: 'double-cross', label: '二重交差線付き' },
      { value: 'triangle', label: '三角付き' }
    ];
    if (isRightAngleValue(angleValue)) {
      options.push({ value: 'right', label: '直角記号付き' });
    }
    return options;
  }

  function normalizeAngleKind(kind, angleValue) {
    if (kind === 'right' && !isRightAngleValue(angleValue)) return 'plain';
    return kind || 'plain';
  }

  function appendAngleKindSelect(sheetBody, buildSelect, currentKind, angleValue) {
    const built = buildSelect('角マーク', normalizeAngleKind(currentKind, angleValue), getAngleKindOptions(angleValue));
    sheetBody.appendChild(built.field);
    return built.select;
  }

  const segmentKindOptions = [
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
  ];

  function getSegmentKindOptions() {
    return segmentKindOptions.slice();
  }

  function isSegmentKindSupported(kind) {
    return segmentKindOptions.some(function (option) { return option.value === kind; });
  }

  function drawSegmentKind(stage, kind, P, Q, createSvg, options) {
    if (!kind || kind === 'plain' || !stage || !P || !Q || !createSvg) return false;
    if (!isSegmentKindSupported(kind)) return false;
    const isParallelReverse = kind === 'parallel-reverse' || kind === 'parallel-single-reverse' || kind === 'parallel-double-reverse';
    const hasParallelArrow = kind === 'parallel' || kind === 'parallel-single' || kind === 'parallel-double' || isParallelReverse;
    const equalityKind = kind === 'parallel-single' || kind === 'parallel-single-reverse'
      ? 'single'
      : (kind === 'parallel-double' || kind === 'parallel-double-reverse' ? 'double' : kind);
    const mid = {
      x: (P.x + Q.x) / 2,
      y: (P.y + Q.y) / 2
    };
    const dx = Q.x - P.x;
    const dy = Q.y - P.y;
    const len = Math.hypot(dx, dy) || 1;
    const tx = dx / len;
    const ty = dy / len;
    const nx = -dy / len;
    const ny = dx / len;
    const stroke = (options && options.color) || '#2a5bd7';
    const strokeWidth = (options && options.strokeWidth) || 3;
    const addLine = function (cx, cy, half) {
      stage.appendChild(createSvg('line', {
        x1: cx - nx * half,
        y1: cy - ny * half,
        x2: cx + nx * half,
        y2: cy + ny * half,
        stroke: stroke,
        'stroke-width': strokeWidth,
        'stroke-linecap': 'round'
      }));
    };

    if (hasParallelArrow) {
      const arrowDir = isParallelReverse ? -1 : 1;
      const arrowTip = {
        x: mid.x + tx * 13 * arrowDir,
        y: mid.y + ty * 13 * arrowDir
      };
      const wing = 9;
      stage.appendChild(createSvg('path', {
        d: [
          'M', arrowTip.x - tx * 18 * arrowDir + nx * wing, arrowTip.y - ty * 18 * arrowDir + ny * wing,
          'L', arrowTip.x, arrowTip.y,
          'L', arrowTip.x - tx * 18 * arrowDir - nx * wing, arrowTip.y - ty * 18 * arrowDir - ny * wing
        ].join(' '),
        fill: 'none',
        stroke: stroke,
        'stroke-width': strokeWidth,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round'
      }));
      if (kind === 'parallel' || kind === 'parallel-reverse') return true;
    }

    if (equalityKind === 'circle') {
      stage.appendChild(createSvg('circle', { cx: mid.x, cy: mid.y, r: 8, fill: 'none', stroke: stroke, 'stroke-width': strokeWidth }));
    } else if (equalityKind === 'single') {
      const arrowDir = isParallelReverse ? -1 : 1;
      addLine(
        mid.x + tx * (hasParallelArrow ? -19 * arrowDir : 0),
        mid.y + ty * (hasParallelArrow ? -19 * arrowDir : 0),
        12
      );
    } else if (equalityKind === 'double') {
      const arrowDir = isParallelReverse ? -1 : 1;
      addLine(
        mid.x + tx * (hasParallelArrow ? -28 * arrowDir : -9),
        mid.y + ty * (hasParallelArrow ? -28 * arrowDir : -9),
        12
      );
      addLine(
        mid.x + tx * (hasParallelArrow ? -10 * arrowDir : 9),
        mid.y + ty * (hasParallelArrow ? -10 * arrowDir : 9),
        12
      );
    } else if (equalityKind === 'cross') {
      const crossHalf = 12;
      const diagonalScale = crossHalf / Math.SQRT2;
      stage.appendChild(createSvg('line', {
        x1: mid.x - (tx + nx) * diagonalScale,
        y1: mid.y - (ty + ny) * diagonalScale,
        x2: mid.x + (tx + nx) * diagonalScale,
        y2: mid.y + (ty + ny) * diagonalScale,
        stroke: stroke,
        'stroke-width': strokeWidth,
        'stroke-linecap': 'round'
      }));
      stage.appendChild(createSvg('line', {
        x1: mid.x - (tx - nx) * diagonalScale,
        y1: mid.y - (ty - ny) * diagonalScale,
        x2: mid.x + (tx - nx) * diagonalScale,
        y2: mid.y + (ty - ny) * diagonalScale,
        stroke: stroke,
        'stroke-width': strokeWidth,
        'stroke-linecap': 'round'
      }));
    } else if (equalityKind === 'triangle') {
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
    return true;
  }

  window.InstantGeometryMobileAngleOrnaments = {
    appendAngleKindSelect: appendAngleKindSelect,
    drawAngleKind: drawAngleKind,
    drawSegmentKind: drawSegmentKind,
    getSegmentKindOptions: getSegmentKindOptions,
    getAngleKindOptions: getAngleKindOptions,
    isRightAngleValue: isRightAngleValue,
    normalizeAngleKind: normalizeAngleKind
  };
})();
