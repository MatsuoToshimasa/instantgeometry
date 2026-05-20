(function () {
  'use strict';

  const POINT_IDS = ['A', 'B', 'C', 'D'];
  const SIDE_IDS = ['AB', 'BC', 'CD', 'DA'];
  const ANGLE_IDS = ['A', 'B', 'C', 'D'];

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function parsePositiveNumber(value, name) {
    const text = String(value || '').trim();
    if (!/^[1-9][0-9]*(?:\.[0-9]+)?$|^0\.[0-9]*[1-9][0-9]*$/.test(text)) {
      throw new Error(name + ' には 0 より大きい数を入力してください。');
    }
    return Number(text);
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

  function hexToRgba(hex, alpha) {
    const text = String(hex || '').trim();
    const match = /^#?([0-9a-f]{6})$/i.exec(text);
    if (!match) return 'rgba(42,91,215,' + alpha + ')';
    const raw = match[1];
    return 'rgba(' + parseInt(raw.slice(0, 2), 16) + ',' + parseInt(raw.slice(2, 4), 16) + ',' + parseInt(raw.slice(4, 6), 16) + ',' + alpha + ')';
  }

  function areaLabelColor(hex) {
    const hsl = hexToHsl(hex || '#2a5bd7');
    if (hsl.s < 8) return hsl.l > 50 ? '#4b5563' : '#111827';
    return hslToHex(hsl.h, Math.max(42, hsl.s), 26);
  }

  function gcd(a, b) {
    let x = Math.abs(Math.round(a));
    let y = Math.abs(Math.round(b));
    while (y) {
      const t = y;
      y = x % y;
      x = t;
    }
    return x || 1;
  }

  function toFraction(value) {
    if (!Number.isFinite(value)) return null;
    const sign = value < 0 ? -1 : 1;
    const text = String(Math.abs(value));
    if (text.indexOf('e') !== -1) return null;
    const dot = text.indexOf('.');
    if (dot === -1) return { numerator: sign * Math.round(Math.abs(value)), denominator: 1 };
    const decimals = text.length - dot - 1;
    const denominator = Math.pow(10, decimals);
    const numerator = Math.round(Math.abs(value) * denominator) * sign;
    const divisor = gcd(numerator, denominator);
    return { numerator: numerator / divisor, denominator: denominator / divisor };
  }

  function formatSimplifiedRootFraction(numerator, denominator) {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0 || numerator < 0) return null;
    let n = numerator;
    let d = denominator;
    const exact = Math.sqrt(n);
    if (Number.isInteger(exact)) {
      const rationalDivisor = gcd(exact, d);
      const rationalNumerator = exact / rationalDivisor;
      const rationalDenominator = d / rationalDivisor;
      return rationalDenominator === 1 ? String(rationalNumerator) : rationalNumerator + '/' + rationalDenominator;
    }
    let outside = 1;
    let inside = n;
    for (let factor = Math.floor(Math.sqrt(inside)); factor >= 2; factor -= 1) {
      const square = factor * factor;
      if (inside % square === 0) {
        outside *= factor;
        inside /= square;
        factor = Math.floor(Math.sqrt(inside)) + 1;
      }
    }
    const outsideDivisor = gcd(outside, d);
    outside /= outsideDivisor;
    d /= outsideDivisor;
    const root = (outside === 1 ? '' : String(outside)) + '√' + inside;
    return d === 1 ? root : root + '/' + d;
  }

  function formatLengthFromDelta(dx, dy) {
    const fx = toFraction(dx);
    const fy = toFraction(dy);
    if (!fx || !fy) return formatNumber(Math.hypot(dx, dy));
    const denominator = fx.denominator * fy.denominator;
    const xNumerator = fx.numerator * fy.denominator;
    const yNumerator = fy.numerator * fx.denominator;
    const squaredNumerator = (xNumerator * xNumerator) + (yNumerator * yNumerator);
    return formatSimplifiedRootFraction(squaredNumerator, denominator) || formatNumber(Math.hypot(dx, dy));
  }

  function formatLengthBetween(P, Q) {
    return formatLengthFromDelta(Q.x - P.x, Q.y - P.y);
  }

  function createSvg(tag, attrs) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (attrs[key] !== null && attrs[key] !== undefined) {
        node.setAttribute(key, String(attrs[key]));
      }
    });
    return node;
  }

  function fitStageViewBox(stage) {
    const nodes = Array.from(stage.querySelectorAll('path,line,polyline,polygon,rect,circle,ellipse,text'));
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    nodes.forEach(function (node) {
      const stroke = String(node.getAttribute('stroke') || '').trim();
      const fill = String(node.getAttribute('fill') || '').trim();
      const opacity = String(node.getAttribute('opacity') || '').trim();
      const fillOpacity = String(node.getAttribute('fill-opacity') || '').trim();
      const strokeOpacity = String(node.getAttribute('stroke-opacity') || '').trim();
      if (stroke === 'transparent' || fill === 'transparent' || opacity === '0' || (fillOpacity === '0' && strokeOpacity === '0')) return;
      if ((fill === 'none' || fill === '') && (stroke === 'none' || stroke === '') && node.tagName.toLowerCase() !== 'text') return;
      let box;
      try {
        box = node.getBBox();
      } catch (error) {
        return;
      }
      if (!Number.isFinite(box.x) || !Number.isFinite(box.y)) return;
      minX = Math.min(minX, box.x);
      minY = Math.min(minY, box.y);
      maxX = Math.max(maxX, box.x + box.width);
      maxY = Math.max(maxY, box.y + box.height);
    });
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      stage.setAttribute('viewBox', '0 0 1000 1000');
      return;
    }
    const pad = 58;
    const x = minX - pad;
    const y = minY - pad;
    const width = Math.max(1, maxX - minX + pad * 2);
    const height = Math.max(1, maxY - minY + pad * 2);
    stage.setAttribute('viewBox', [
      Math.round(x * 1000) / 1000,
      Math.round(y * 1000) / 1000,
      Math.round(width * 1000) / 1000,
      Math.round(height * 1000) / 1000
    ].join(' '));
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

  function buildQuadrilateralFromAngles(angleMap) {
    const values = POINT_IDS.map(function (id) { return angleMap[id]; });
    let theta = 0;
    const directions = [];
    for (let i = 0; i < values.length; i += 1) {
      directions.push({ x: Math.cos(theta), y: Math.sin(theta) });
      theta += (180 - values[(i + 1) % values.length]) * Math.PI / 180;
    }

    let sxx = 0;
    let sxy = 0;
    let syy = 0;
    let sx = 0;
    let sy = 0;
    directions.forEach(function (unit) {
      sxx += unit.x * unit.x;
      sxy += unit.x * unit.y;
      syy += unit.y * unit.y;
      sx += unit.x;
      sy += unit.y;
    });
    const det = sxx * syy - sxy * sxy;
    if (Math.abs(det) < 1e-9) {
      throw new Error('この角の組み合わせでは四角形を作れません。');
    }
    const lambdaX = (sx * syy - sy * sxy) / det;
    const lambdaY = (sxx * sy - sxy * sx) / det;
    const lengths = directions.map(function (unit) {
      return 1 - unit.x * lambdaX - unit.y * lambdaY;
    });
    if (lengths.some(function (length) { return !(length > 0.08); })) {
      throw new Error('この角の組み合わせでは四角形を作れません。');
    }

    let current = { x: 0, y: 0 };
    let points = [current];
    for (let i = 0; i < directions.length - 1; i += 1) {
      current = {
        x: current.x + directions[i].x * lengths[i],
        y: current.y + directions[i].y * lengths[i]
      };
      points.push(current);
    }
    if (points.length === 4 && polygonArea(points) < 1e-8) {
      throw new Error('この角の組み合わせでは四角形を作れません。');
    }
    return { A: points[0], B: points[1], C: points[2], D: points[3] };
  }

  function angleDegrees(prev, vertex, next) {
    const ux = prev.x - vertex.x;
    const uy = prev.y - vertex.y;
    const vx = next.x - vertex.x;
    const vy = next.y - vertex.y;
    const denom = (Math.hypot(ux, uy) || 1) * (Math.hypot(vx, vy) || 1);
    const cosine = Math.max(-1, Math.min(1, (ux * vx + uy * vy) / denom));
    return Math.acos(cosine) * 180 / Math.PI;
  }

  function finalizeGeometry(pointsMap) {
    const points = POINT_IDS.map(function (id) { return pointsMap[id]; });
    const sides = {
      AB: segmentLength(pointsMap.A, pointsMap.B),
      BC: segmentLength(pointsMap.B, pointsMap.C),
      CD: segmentLength(pointsMap.C, pointsMap.D),
      DA: segmentLength(pointsMap.D, pointsMap.A)
    };
    const angles = {
      A: angleDegrees(pointsMap.B, pointsMap.A, pointsMap.D),
      B: angleDegrees(pointsMap.A, pointsMap.B, pointsMap.C),
      C: angleDegrees(pointsMap.B, pointsMap.C, pointsMap.D),
      D: angleDegrees(pointsMap.C, pointsMap.D, pointsMap.A)
    };
    return {
      A: pointsMap.A,
      B: pointsMap.B,
      C: pointsMap.C,
      D: pointsMap.D,
      points: points,
      sides: sides,
      angles: angles,
      center: polygonCentroid(points),
      area: polygonArea(points)
    };
  }

  function scalePointsToMinSide(pointsMap, targetMinSide) {
    const lengths = SIDE_IDS.map(function (id) {
      return segmentLength(pointsMap[id[0]], pointsMap[id[1]]);
    }).filter(function (value) {
      return Number.isFinite(value) && value > 0;
    });
    const minSide = Math.min.apply(null, lengths);
    if (!Number.isFinite(minSide) || minSide <= 0) return pointsMap;
    const scale = targetMinSide / minSide;
    const scaled = {};
    POINT_IDS.forEach(function (id) {
      scaled[id] = {
        x: pointsMap[id].x * scale,
        y: pointsMap[id].y * scale
      };
    });
    return scaled;
  }

  function fitPoint(point, box) {
    return {
      x: box.left + (point.x - box.minX) * box.scale,
      y: box.bottom - (point.y - box.minY) * box.scale
    };
  }

  function computeViewport(geometry, extraPoints) {
    const width = 1000;
    const height = 1000;
    const paddingX = 130;
    const paddingTop = 230;
    const paddingBottom = 130;
    const points = geometry.points.concat(extraPoints || []);
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

  function interiorLabel(vertex, center, rate) {
    return {
      x: vertex.x + (center.x - vertex.x) * rate,
      y: vertex.y + (center.y - vertex.y) * rate
    };
  }

  function normalOffset(P, Q, toward, distance) {
    const m = midpoint(P, Q);
    const dx = Q.x - P.x;
    const dy = Q.y - P.y;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    const toTowardX = toward.x - m.x;
    const toTowardY = toward.y - m.y;
    if (nx * toTowardX + ny * toTowardY > 0) {
      nx *= -1;
      ny *= -1;
    }
    return { x: m.x + nx * distance, y: m.y + ny * distance };
  }

  function arcPoints(vertex, p1, p2, radius) {
    const a1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
    const a2 = Math.atan2(p2.y - vertex.y, p2.x - vertex.x);
    let delta = a2 - a1;
    while (delta <= -Math.PI) delta += Math.PI * 2;
    while (delta > Math.PI) delta -= Math.PI * 2;
    const steps = 24;
    const points = [];
    for (let i = 0; i <= steps; i += 1) {
      const angle = a1 + delta * (i / steps);
      points.push({ x: vertex.x + radius * Math.cos(angle), y: vertex.y + radius * Math.sin(angle) });
    }
    return points;
  }

  function resolvePageAngleArcRadius(config, extraAngles) {
    if (Number.isFinite(config.pageAngleArcRadius)) return config.pageAngleArcRadius;
    if (Number.isFinite(config.angleArcRadius)) return config.angleArcRadius;
    for (let i = 0; i < extraAngles.length; i += 1) {
      if (Number.isFinite(extraAngles[i].arcRadius)) return extraAngles[i].arcRadius;
    }
    return 0.42;
  }

  function pathFromPoints(points) {
    return points.map(function (p, index) {
      return (index === 0 ? 'M ' : 'L ') + p.x + ' ' + p.y;
    }).join(' ');
  }

  function sectorPath(vertex, arc) {
    if (!arc.length) return '';
    const parts = ['M ' + vertex.x + ' ' + vertex.y];
    arc.forEach(function (p) { parts.push('L ' + p.x + ' ' + p.y); });
    parts.push('Z');
    return parts.join(' ');
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
    const toCenterX = center.x - mx;
    const toCenterY = center.y - my;
    if (nx * toCenterX + ny * toCenterY > 0) {
      nx *= -1;
      ny *= -1;
    }
    const defaultCenter = { x: mx + nx * Math.max(26, len * 0.12), y: my + ny * Math.max(26, len * 0.12) };
    const desired = labelPoint || defaultCenter;
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

  function drawSideKind(stage, kind, P, Q) {
    if (!kind || kind === 'plain') return;
    if (window.InstantGeometryMobileAngleOrnaments && window.InstantGeometryMobileAngleOrnaments.drawSegmentKind(stage, kind, P, Q, createSvg)) return;
    const isParallelReverse = kind === 'parallel-reverse' || kind === 'parallel-single-reverse' || kind === 'parallel-double-reverse';
    const hasParallelArrow = kind === 'parallel' || kind === 'parallel-single' || kind === 'parallel-double' || isParallelReverse;
    const equalityKind = kind === 'parallel-single' || kind === 'parallel-single-reverse'
      ? 'single'
      : (kind === 'parallel-double' || kind === 'parallel-double-reverse' ? 'double' : kind);
    const mid = midpoint(P, Q);
    const dx = Q.x - P.x;
    const dy = Q.y - P.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const tx = dx / len;
    const ty = dy / len;
    const stroke = '#2a5bd7';
    if (hasParallelArrow) {
      const arrowDir = isParallelReverse ? -1 : 1;
      const arrowCenter = { x: mid.x, y: mid.y };
      const arrowTip = { x: arrowCenter.x + tx * 13 * arrowDir, y: arrowCenter.y + ty * 13 * arrowDir };
      const wing = 9;
      stage.appendChild(createSvg('path', {
        d: [
          'M', arrowTip.x - tx * 18 * arrowDir + nx * wing, arrowTip.y - ty * 18 * arrowDir + ny * wing,
          'L', arrowTip.x, arrowTip.y,
          'L', arrowTip.x - tx * 18 * arrowDir - nx * wing, arrowTip.y - ty * 18 * arrowDir - ny * wing
        ].join(' '),
        fill: 'none',
        stroke: stroke,
        'stroke-width': 3,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round'
      }));
      if (equalityKind === 'parallel' || equalityKind === 'parallel-reverse') return;
    }
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
    if (equalityKind === 'circle') {
      stage.appendChild(createSvg('circle', { cx: mid.x, cy: mid.y, r: 8, fill: 'none', stroke: stroke, 'stroke-width': 3 }));
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
        'stroke-width': 3,
        'stroke-linecap': 'round'
      }));
      stage.appendChild(createSvg('line', {
        x1: mid.x - (tx - nx) * diagonalScale,
        y1: mid.y - (ty - ny) * diagonalScale,
        x2: mid.x + (tx - nx) * diagonalScale,
        y2: mid.y + (ty - ny) * diagonalScale,
        stroke: stroke,
        'stroke-width': 3,
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
  }

  function buildSelect(labelText, value, options) {
    if (window.InstantGeometryDrawLabelEngine && typeof window.InstantGeometryDrawLabelEngine.buildSelect === 'function') {
      return window.InstantGeometryDrawLabelEngine.buildSelect(labelText, value, options);
    }
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
    if (window.InstantGeometryDrawLabelEngine && typeof window.InstantGeometryDrawLabelEngine.buildCheckbox === 'function') {
      return window.InstantGeometryDrawLabelEngine.buildCheckbox(labelText, checked);
    }
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

  function normalizeFreeLabel(value) {
    return String(value || '');
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

  const RATIO_LABEL_HINT = '比の値は「マーク,数値」の形式で入力します。例: s,5 / t,4.4 / r,5/3\ns: 四角で囲む\nt: 三角で囲む\nr: 丸で囲む';

  function isNumericLabelValue(value) {
    return value === ' ' || value === '0';
  }

  function getDisplayMode(value, hasNumericMode) {
    if (value === '') return 'hidden';
    if (hasNumericMode && isRatioLabelValue(value)) return 'ratio';
    if (hasNumericMode && isNumericLabelValue(value)) return 'numeric';
    return 'text';
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
      : getRatioLabelInput(value);
    input.setAttribute('inputmode', 'text');
    input.autocapitalize = 'none';
    input.autocomplete = 'off';
    input.spellcheck = false;
    function sync() {
      const isEditable = mode.value === 'text' || mode.value === 'ratio';
      input.disabled = !isEditable;
      input.placeholder = mode.value === 'ratio' ? '例: s,5 / t,4.4 / r,5/3' : '';
    }
    mode.addEventListener('change', sync);
    field.appendChild(label);
    field.appendChild(mode);
    field.appendChild(input);
    sync();
    return { field: field, mode: mode, input: input };
  }

  function buildColorPalette(labelText, value) {
    if (window.InstantGeometryDrawLabelEngine && typeof window.InstantGeometryDrawLabelEngine.buildColorPalette === 'function') {
      return window.InstantGeometryDrawLabelEngine.buildColorPalette(labelText, value);
    }
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

  function createPage(config) {
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

    const controlInputs = {};
    Object.keys(config.controlInputIds).forEach(function (key) {
      controlInputs[key] = document.getElementById(config.controlInputIds[key]);
    });

    const state = deepClone(config.initialState);
    state.extraAngleInputs = state.extraAngleInputs || {};
    state.extraAngleKinds = state.extraAngleKinds || {};
    state.extraAreaInputs = state.extraAreaInputs || {};
    state.extraAreaColors = state.extraAreaColors || {};
    state.areaColor = state.areaColor || '#2a5bd7';
    state.labelOffsets = state.labelOffsets || {};
    const showArea = config.showArea !== false;
    const hiddenBaseSideSet = new Set(config.hiddenBaseSides || []);
    const labelMoveEnabled = config.enableLabelMoveMode !== false;
    const LabelEngine = window.InstantGeometryDrawLabelEngine || window.InstantGeometryTriangleLabelEngine || null;
    let labelController = null;
    let geometry = null;
    let moveMode = null;
    let moveDrag = null;
    let currentLabelBases = {};

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
      return { x: basePosition.x + offset.x, y: basePosition.y + offset.y };
    }

    function isMoveTarget(kind, id) {
      return moveMode && moveMode.kind === kind && moveMode.payload && moveMode.payload.id === id;
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

    function setStatus(message, isError) {
      statusBox.textContent = message;
      statusBox.classList.toggle('error', Boolean(isError));
    }

    if (window.InstantGeometrySaveQuota) {
      window.InstantGeometrySaveQuota.createIndicator({ target: saveBtn });
    }

    function getPointName(id) {
      const raw = String(state.pointInputs[id] || '').trim();
      return raw || id;
    }

    function getPointLabelValue(id) {
      const raw = String(state.pointInputs[id] || '').trim();
      return raw || null;
    }

    function getSideName(id) {
      return id.split('').map(getPointName).join('');
    }

    function getAngleName(id) {
      const extra = config.extraAngles && geometry
        ? config.extraAngles({ state: state, geometry: geometry }).find(function (angle) { return angle.id === id; })
        : null;
      if (extra && extra.name) return extra.name;
      const names = {
        A: ['B', 'A', 'D'],
        B: ['A', 'B', 'C'],
        C: ['B', 'C', 'D'],
        D: ['C', 'D', 'A']
      }[id];
      return '∠' + names.map(getPointName).join('');
    }

    function getAreaName() {
      return '□' + POINT_IDS.map(getPointName).join('');
    }

    function getExtraAreaName(id) {
      const area = config.extraAreas && geometry
        ? config.extraAreas({ state: state, geometry: geometry }).find(function (item) { return item.id === id; })
        : null;
      if (area && area.name) return area.name;
      return '面積';
    }

    function getSideLabelValue(id) {
      const raw = String(state.sideInputs[id] || '');
      if (!raw) return null;
      if (isRatioLabelValue(raw)) return raw;
      if (isNumericLabelValue(raw)) {
        if (state.sideDisplay && state.sideDisplay[id]) return state.sideDisplay[id];
        return formatNumber(state.sides[id]);
      }
      return raw;
    }

    function getAngleLabelValue(id) {
      const raw = String(state.angleInputs[id] || '');
      if (!raw) return null;
      if (isRatioLabelValue(raw)) return raw;
      if (isNumericLabelValue(raw) && state.angleDisplay && state.angleDisplay[id]) return state.angleDisplay[id];
      if (isNumericLabelValue(raw) && geometry) return formatAngleValue(geometry.angles[id]);
      return raw;
    }

    function getExtraAngleLabelValue(angle) {
      const raw = String(state.extraAngleInputs[angle.id] || '');
      if (!raw) return null;
      if (isRatioLabelValue(raw)) return raw;
      if (isNumericLabelValue(raw)) return formatAngleValue(angle.value);
      return raw;
    }

    function formatAngleValue(degrees) {
      const settings = window.InstantGeometryDrawSettings;
      if (settings && typeof settings.formatAngleDegrees === 'function') return settings.formatAngleDegrees(degrees);
      return formatNumber(degrees) + '°';
    }

    function getAreaLabelValue() {
      const raw = String(state.areaValue || '');
      if (!raw) return null;
      if (isRatioLabelValue(raw)) return raw;
      if (isNumericLabelValue(raw) && geometry) return formatNumber(geometry.area);
      return raw;
    }

    function getExtraAreaLabelValue(area) {
      const raw = String(state.extraAreaInputs[area.id] || '');
      if (!raw) return null;
      if (isRatioLabelValue(raw)) return raw;
      if (isNumericLabelValue(raw) && area.value !== undefined) {
        return typeof area.value === 'function' ? area.value({ formatNumber: formatNumber, polygonArea: polygonArea }) : formatNumber(area.value);
      }
      return raw;
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
        state.labelOffsets[previous.kind][previous.payload.id] = previous.originalOffset;
      }
      moveMode = null;
      moveDrag = null;
      updateMoveModeUi();
      render();
      openSheet(previous.kind, previous.payload);
    }

    function enterMoveMode(kind, payload) {
      const key = labelKey(kind, payload.id);
      if (!currentLabelBases[key]) {
        setStatus('ラベルを表示してから移動してください。', true);
        openSheet(kind, payload);
        return;
      }
      const originalOffset = getLabelOffset(kind, payload.id);
      moveMode = {
        kind: kind,
        payload: { id: payload.id },
        originalOffset: { x: originalOffset.x, y: originalOffset.y }
      };
      closeSheets();
      updateMoveModeUi();
      render();
    }

    function getControllerLabelValue(kind, id) {
      if (kind === 'point') return String(state.pointInputs[id] || '');
      if (kind === 'side') return String(state.sideInputs[id] || '');
      if (kind === 'angle') return String(state.angleInputs[id] || '');
      if (kind === 'extraAngle') return String(state.extraAngleInputs[id] || '');
      if (kind === 'area') return String(state.areaValue || '');
      if (kind === 'extraArea') return String(state.extraAreaInputs[id] || '');
      return '';
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

    function setControllerLabelValue(kind, id, value) {
      const text = normalizeControllerLabelValue(value);
      if (kind === 'point') state.pointInputs[id] = text;
      else if (kind === 'side') {
        state.sideInputs[id] = text;
        if (!text) state.sideArcVisible[id] = false;
      } else if (kind === 'angle') state.angleInputs[id] = text;
      else if (kind === 'extraAngle') state.extraAngleInputs[id] = text;
      else if (kind === 'area') state.areaValue = text;
      else if (kind === 'extraArea') state.extraAreaInputs[id] = text;
    }

    function getControllerSegmentKind(kind, id) {
      return kind === 'side' ? state.sideKinds[id] || 'plain' : 'plain';
    }

    function buildControllerSegmentKindSelect(kind, id, buildSelectFn) {
      return buildSelectFn('線分マーク', getControllerSegmentKind(kind, id), [
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
      const value = kind === 'extraAngle' ? state.extraAngleKinds[id] || 'plain' : state.angleKinds[id] || 'plain';
      let currentAngleValue = null;
      if (kind === 'angle' && geometry) currentAngleValue = geometry.angles[id];
      if (kind === 'extraAngle' && config.extraAngles && geometry) {
        const angle = config.extraAngles({ state: state, geometry: geometry }).find(function (item) { return item.id === id; });
        currentAngleValue = angle ? angle.value : null;
      }
      if (window.InstantGeometryMobileAngleOrnaments) {
        return window.InstantGeometryMobileAngleOrnaments.appendAngleKindSelect(body, buildSelectFn, value, currentAngleValue);
      }
      const built = buildSelectFn('角マーク', value, [
        { value: 'hidden', label: '非表示' },
        { value: 'plain', label: '角弧のみ' }
      ]);
      body.appendChild(built.field);
      return built.select;
    }

    function setControllerKind(kind, id, value) {
      if (kind === 'side') state.sideKinds[id] = value;
      else if (kind === 'angle') state.angleKinds[id] = value;
      else if (kind === 'extraAngle') state.extraAngleKinds[id] = value;
    }

    function getControllerGuideVisible(kind, id) {
      return kind === 'side' ? state.sideArcVisible[id] !== false : false;
    }

    function setControllerGuideVisible(kind, id, value) {
      if (kind === 'side') state.sideArcVisible[id] = value;
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
        labelMoveEnabled: labelMoveEnabled,
        onMove: function (kind, id) {
          enterMoveMode(kind, { id: id });
        },
        onError: function (error) {
          setStatus(error.message || '入力を確認してください。', true);
        },
        getModalSpec: function (kind, id, modalType) {
          return LabelEngine.getStandardModalSpec(modalType);
        },
        getLabelValue: getControllerLabelValue,
        setLabelValue: setControllerLabelValue,
        hasGuideField: function (kind) {
          return kind === 'side';
        },
        getGuideVisible: getControllerGuideVisible,
        setGuideVisible: setControllerGuideVisible,
        buildSegmentKindSelect: buildControllerSegmentKindSelect,
        buildAngleKindSelect: buildControllerAngleKindSelect,
        setKind: setControllerKind,
        hasColorField: function (kind) {
          return kind === 'area' || kind === 'extraArea';
        },
        getColor: function (kind, id) {
          return kind === 'extraArea'
            ? (state.extraAreaColors[id] || state.areaColor || '#2a5bd7')
            : (state.areaColor || '#2a5bd7');
        },
        setColor: function (kind, id, value) {
          if (!value) return;
          if (kind === 'extraArea') state.extraAreaColors[id] = value;
          else if (kind === 'area') state.areaColor = value;
        }
      });
    }

    function openSheet(kind, payload) {
      closeSheets();
      if (kind === 'save') {
        saveSheet.classList.add('open');
        saveSheet.setAttribute('aria-hidden', 'false');
      } else if (labelController) {
        labelController.openEditSheet(kind, payload.id);
      } else {
        renderEditSheet(kind, payload);
        editSheet.classList.add('open');
        editSheet.setAttribute('aria-hidden', 'false');
      }
      sheetBackdrop.classList.add('open');
    }

    function applyModalValue(kind, payload, editor, kindValue, arcVisibleValue, colorValue) {
      const mode = editor.mode.value;
      const text = normalizeFreeLabel(editor.input.value);
      if (kind === 'point') {
        state.pointInputs[payload.id] = mode === 'text' ? text : '';
        return;
      }
      if (kind === 'side') {
        if (kindValue) state.sideKinds[payload.id] = kindValue;
        if (arcVisibleValue !== null) state.sideArcVisible[payload.id] = Boolean(arcVisibleValue);
        if (mode === 'hidden') {
          state.sideInputs[payload.id] = '';
          state.sideArcVisible[payload.id] = false;
          return;
        }
        if (mode === 'numeric') {
          state.sideInputs[payload.id] = ' ';
          return;
        }
        if (mode === 'ratio') {
          const ratio = parseRatioLabelInput(text);
          if (!ratio) throw new Error('比の値は「r,5」「t,4.4」「s,5/3」の形式で入力してください。');
          state.sideInputs[payload.id] = RATIO_LABEL_PREFIX + ratio.source;
          return;
        }
        state.sideInputs[payload.id] = text || '';
        return;
      }
      if (kind === 'angle') {
        if (kindValue) state.angleKinds[payload.id] = kindValue;
        if (mode === 'hidden') {
          state.angleInputs[payload.id] = '';
          return;
        }
        if (mode === 'numeric') {
          state.angleInputs[payload.id] = ' ';
          return;
        }
        if (mode === 'ratio') {
          const ratio = parseRatioLabelInput(text);
          if (!ratio) throw new Error('比の値は「r,5」「t,4.4」「s,5/3」の形式で入力してください。');
          state.angleInputs[payload.id] = RATIO_LABEL_PREFIX + ratio.source;
          return;
        }
        state.angleInputs[payload.id] = text || '';
        return;
      }
      if (kind === 'extraAngle') {
        if (kindValue) state.extraAngleKinds[payload.id] = kindValue;
        if (mode === 'hidden') {
          state.extraAngleInputs[payload.id] = '';
          return;
        }
        if (mode === 'numeric') {
          state.extraAngleInputs[payload.id] = ' ';
          return;
        }
        if (mode === 'ratio') {
          const ratio = parseRatioLabelInput(text);
          if (!ratio) throw new Error('比の値は「r,5」「t,4.4」「s,5/3」の形式で入力してください。');
          state.extraAngleInputs[payload.id] = RATIO_LABEL_PREFIX + ratio.source;
          return;
        }
        state.extraAngleInputs[payload.id] = text || '';
        return;
      }
      if (kind === 'area') {
        if (colorValue) state.areaColor = colorValue;
        if (mode === 'hidden') {
          state.areaValue = '';
          return;
        }
        if (mode === 'numeric') {
          state.areaValue = ' ';
          return;
        }
        if (mode === 'ratio') {
          const ratio = parseRatioLabelInput(text);
          if (!ratio) throw new Error('比の値は「r,5」「t,4.4」「s,5/3」の形式で入力してください。');
          state.areaValue = RATIO_LABEL_PREFIX + ratio.source;
          return;
        }
        state.areaValue = text || '';
        return;
      }
      if (kind === 'extraArea') {
        if (colorValue) state.extraAreaColors[payload.id] = colorValue;
        if (mode === 'hidden') {
          state.extraAreaInputs[payload.id] = '';
          return;
        }
        if (mode === 'numeric') {
          state.extraAreaInputs[payload.id] = ' ';
          return;
        }
        if (mode === 'ratio') {
          const ratio = parseRatioLabelInput(text);
          if (!ratio) throw new Error('比の値は「r,5」「t,4.4」「s,5/3」の形式で入力してください。');
          state.extraAreaInputs[payload.id] = RATIO_LABEL_PREFIX + ratio.source;
          return;
        }
        state.extraAreaInputs[payload.id] = text || '';
      }
    }

    function renderEditSheet(kind, payload) {
      sheetBody.innerHTML = '';
      let title = '設定';
      let value = '';
      let hint = '';
      let kindValue = '';
      let sideArcVisible = true;
      let currentAngleValue = null;
      if (kind === 'point') {
        title = getPointName(payload.id);
        value = state.pointInputs[payload.id] || '';
        hint = '非表示または自由入力を選べます。自由入力では数字や記号も文字として表示します。';
      } else if (kind === 'side') {
        title = getSideName(payload.id);
        value = state.sideInputs[payload.id] || '';
        kindValue = state.sideKinds[payload.id] || 'plain';
        sideArcVisible = state.sideArcVisible[payload.id] !== false;
        hint = '非表示、数値、比の値、自由入力を選べます。\n' + RATIO_LABEL_HINT;
      } else if (kind === 'angle') {
        title = getAngleName(payload.id);
        value = state.angleInputs[payload.id] || '';
        kindValue = state.angleKinds[payload.id] || 'plain';
        currentAngleValue = geometry ? geometry.angles[payload.id] : null;
        hint = '非表示、数値、比の値、自由入力を選べます。\n' + RATIO_LABEL_HINT;
      } else if (kind === 'extraAngle') {
        const extra = config.extraAngles && geometry
          ? config.extraAngles({ state: state, geometry: geometry }).find(function (angle) { return angle.id === payload.id; })
          : null;
        title = extra && extra.name ? extra.name : '角';
        value = state.extraAngleInputs[payload.id] || '';
        kindValue = state.extraAngleKinds[payload.id] || 'plain';
        currentAngleValue = extra ? extra.value : null;
        hint = '非表示、数値、比の値、自由入力を選べます。\n' + RATIO_LABEL_HINT;
      } else if (kind === 'area') {
        title = getAreaName();
        value = state.areaValue || '';
        hint = '非表示、数値、比の値、自由入力を選べます。\n' + RATIO_LABEL_HINT;
      } else if (kind === 'extraArea') {
        title = getExtraAreaName(payload.id);
        value = state.extraAreaInputs[payload.id] || '';
        hint = '非表示、数値、比の値、自由入力を選べます。\n' + RATIO_LABEL_HINT;
      }
      sheetTitle.textContent = title;
      let kindSelect = null;
      let arcCheckbox = null;
      let colorPalette = null;
      if (kind === 'side') {
        const built = buildSelect('種類', kindValue, [
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
        const checkboxBuilt = buildCheckbox('弧を表示', sideArcVisible);
        arcCheckbox = checkboxBuilt.input;
        sheetBody.appendChild(checkboxBuilt.field);
      } else if (kind === 'angle' || kind === 'extraAngle') {
        kindSelect = window.InstantGeometryMobileAngleOrnaments.appendAngleKindSelect(
          sheetBody,
          buildSelect,
          kindValue,
          currentAngleValue
        );
      }
      const labelEditor = buildLabelEditor('ラベル', value, kind !== 'point');
      sheetBody.appendChild(labelEditor.field);
      if (kind === 'area' || kind === 'extraArea') {
        const currentColor = kind === 'extraArea'
          ? (state.extraAreaColors[payload.id] || state.areaColor || '#2a5bd7')
          : (state.areaColor || '#2a5bd7');
        colorPalette = buildColorPalette('色', currentColor);
        sheetBody.appendChild(colorPalette.field);
      }
      const hintNode = document.createElement('p');
      hintNode.className = 'sheet-hint';
      hintNode.textContent = hint;
      sheetBody.appendChild(hintNode);
      const actions = document.createElement('div');
      actions.className = 'sheet-actions';
      if (labelMoveEnabled) actions.classList.add('has-move');
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
          applyModalValue(
            kind,
            payload,
            labelEditor,
            kindSelect ? kindSelect.value : null,
            arcCheckbox ? arcCheckbox.checked : null,
            colorPalette ? colorPalette.value : null
          );
          render();
          enterMoveMode(kind, payload);
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
          applyModalValue(
            kind,
            payload,
            labelEditor,
            kindSelect ? kindSelect.value : null,
            arcCheckbox ? arcCheckbox.checked : null,
            colorPalette ? colorPalette.value : null
          );
          closeSheets();
          render();
        } catch (error) {
          setStatus(error.message || '入力を確認してください。', true);
        }
      });
      actions.appendChild(cancel);
      if (labelMoveEnabled) actions.appendChild(move);
      actions.appendChild(save);
      sheetBody.appendChild(actions);
    }

    function createLabelNode(label, attrs) {
      const parsed = isRatioLabelValue(label) ? parseRatioLabelInput(String(label).slice(RATIO_LABEL_PREFIX.length)) : null;
      if (!parsed) {
        if (window.InstantGeometrySharedLabels && typeof window.InstantGeometrySharedLabels.createSvgKatexLabel === 'function') {
          const katexNode = window.InstantGeometrySharedLabels.createSvgKatexLabel({
            createSvg: createSvg,
            text: label,
            attrs: attrs,
            kind: attrs['data-label-role'] || attrs['data-label-kind'] || attrs['data-kind'],
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
      const fontSize = Number(attrs['font-size']) || 48;
      const textWidth = Math.max(fontSize * 0.7, parsed.value.length * fontSize * 0.62);
      const height = fontSize * 1.16;
      const width = parsed.mark === 't'
        ? Math.max(textWidth + fontSize * 0.8, height * 1.25)
        : Math.max(textWidth + fontSize * 0.55, height);
      const group = createSvg('g', {});
      const stroke = attrs.fill || '#1f2430';
      if (parsed.mark === 'r') {
        group.appendChild(createSvg('ellipse', {
          cx: x,
          cy: y,
          rx: width / 2,
          ry: height / 2,
          fill: '#ffffff',
          stroke: stroke,
          'stroke-width': Math.max(2, fontSize * 0.055)
        }));
      } else if (parsed.mark === 't') {
        group.appendChild(createSvg('polygon', {
          points: [
            x + ',' + (y - height * 0.72),
            (x - width / 2) + ',' + (y + height * 0.48),
            (x + width / 2) + ',' + (y + height * 0.48)
          ].join(' '),
          fill: '#ffffff',
          stroke: stroke,
          'stroke-width': Math.max(2, fontSize * 0.055),
          'stroke-linejoin': 'round'
        }));
      } else {
        group.appendChild(createSvg('rect', {
          x: x - width / 2,
          y: y - height / 2,
          width: width,
          height: height,
          fill: '#ffffff',
          stroke: stroke,
          'stroke-width': Math.max(2, fontSize * 0.055)
        }));
      }
      const textAttrs = Object.assign({}, attrs, {
        'text-anchor': 'middle',
        'dominant-baseline': 'middle'
      });
      if (window.InstantGeometrySharedLabels && typeof window.InstantGeometrySharedLabels.createSvgKatexLabel === 'function') {
        const katexNode = window.InstantGeometrySharedLabels.createSvgKatexLabel({
          createSvg: createSvg,
          text: parsed.value,
          attrs: textAttrs,
          kind: attrs['data-label-role'] || attrs['data-label-kind'] || attrs['data-kind'],
          id: attrs['data-label-id'] || attrs['data-id']
        });
        if (katexNode) group.appendChild(katexNode);
      }
      if (!group.querySelector('foreignObject')) {
        const textNode = createSvg('text', textAttrs);
        textNode.textContent = parsed.value;
        group.appendChild(textNode);
      }
      return group;
    }

    function promoteSvgTextLabelToKatex(element, kind, id) {
      if (!element || element.tagName.toLowerCase() !== 'text') return;
      const text = String(element.textContent || '').trim();
      if (!text || element.dataset.katexPromoted === 'true') return;
      element.dataset.katexPromoted = 'true';
      window.requestAnimationFrame(function () {
        if (!element.parentNode || !window.InstantGeometrySharedLabels || typeof window.InstantGeometrySharedLabels.createSvgKatexLabel !== 'function') return;
        const attrs = {};
        Array.from(element.attributes).forEach(function (attr) {
          attrs[attr.name] = attr.value;
        });
        attrs.x = attrs.x || element.getAttribute('x') || '0';
        attrs.y = attrs.y || element.getAttribute('y') || '0';
        attrs['data-label-kind'] = attrs['data-label-kind'] || canonicalLabelKind(kind);
        if (kind !== attrs['data-label-kind']) attrs['data-label-role'] = attrs['data-label-role'] || kind;
        attrs['data-label-id'] = attrs['data-label-id'] || id;
        const katexNode = window.InstantGeometrySharedLabels.createSvgKatexLabel({
          createSvg: createSvg,
          text: text,
          attrs: attrs,
          kind: kind,
          id: id
        });
        if (!katexNode) return;
        katexNode.setAttribute('data-kind', kind);
        katexNode.setAttribute('data-id', id);
        katexNode.style.cursor = 'pointer';
        katexNode.addEventListener('pointerdown', function (event) {
          beginLabelMoveDrag(event, kind, id);
        });
        katexNode.addEventListener('click', function (event) {
          event.stopPropagation();
          if (moveMode) return;
          openSheet(kind, { id: id });
        });
        element.classList.add('triangle-katex-source-hidden');
        element.setAttribute('opacity', '0');
        element.parentNode.insertBefore(katexNode, element.nextSibling);
      });
    }

    function getLabelNodePoint(element) {
      const tag = element.tagName.toLowerCase();
      if (tag === 'foreignobject') {
        const x = Number(element.getAttribute('x'));
        const y = Number(element.getAttribute('y'));
        const width = Number(element.getAttribute('width'));
        const height = Number(element.getAttribute('height'));
        if ([x, y, width, height].every(Number.isFinite)) {
          return { x: x + width / 2, y: y + height / 2 };
        }
      }
      const textNode = tag === 'text' ? element : element.querySelector && element.querySelector('text');
      if (!textNode) return null;
      const x = Number(textNode.getAttribute('x'));
      const y = Number(textNode.getAttribute('y'));
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return { x: x, y: y };
    }

    function canonicalLabelKind(kind) {
      if (kind === 'side') return 'segment';
      if (kind === 'extraAngle') return 'angle';
      if (kind === 'extraArea') return 'area';
      return kind;
    }

    function offsetPointList(value, offset) {
      return String(value || '').trim().split(/\s+/).map(function (pair) {
        const parts = pair.split(',');
        const x = Number(parts[0]);
        const y = Number(parts[1]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return pair;
        return (x + offset.x) + ',' + (y + offset.y);
      }).join(' ');
    }

    function applyLabelOffsetToNode(element, offset) {
      const nodes = element.tagName.toLowerCase() === 'g' ? Array.from(element.children) : [element];
      nodes.forEach(function (node) {
        const tag = node.tagName.toLowerCase();
        if (node.hasAttribute('x')) node.setAttribute('x', String(Number(node.getAttribute('x')) + offset.x));
        if (node.hasAttribute('y')) node.setAttribute('y', String(Number(node.getAttribute('y')) + offset.y));
        if (node.hasAttribute('cx')) node.setAttribute('cx', String(Number(node.getAttribute('cx')) + offset.x));
        if (node.hasAttribute('cy')) node.setAttribute('cy', String(Number(node.getAttribute('cy')) + offset.y));
        if (tag === 'polygon' && node.hasAttribute('points')) node.setAttribute('points', offsetPointList(node.getAttribute('points'), offset));
      });
    }

    function beginLabelMoveDrag(event, kind, id) {
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

    function attachHit(element, kind, id) {
      element.style.cursor = 'pointer';
      element.setAttribute('data-kind', kind);
      element.setAttribute('data-id', id);
      promoteSvgTextLabelToKatex(element, kind, id);
      const labelPoint = getLabelNodePoint(element);
      if (labelPoint) {
        const key = labelKey(kind, id);
        if (!currentLabelBases[key]) {
          currentLabelBases[key] = { x: labelPoint.x, y: labelPoint.y };
          applyLabelOffsetToNode(element, getLabelOffset(kind, id));
        }
        if (isMoveTarget(kind, id)) element.classList.add('label-move-target');
        element.addEventListener('pointerdown', function (event) {
          beginLabelMoveDrag(event, kind, id);
        });
      }
      element.addEventListener('click', function (event) {
        event.stopPropagation();
        if (moveMode) return;
        openSheet(kind, { id: id });
      });
    }

    function render() {
      try {
        currentLabelBases = {};
        const parsed = config.readControls(controlInputs, parsePositiveNumber);
        config.applyControlsToState(state, parsed);
        geometry = config.computeGeometry(state, parsed, {
          finalizeGeometry: finalizeGeometry,
          scalePointsToMinSide: scalePointsToMinSide,
          segmentLength: segmentLength,
          polygonArea: polygonArea,
          polygonCentroid: polygonCentroid,
          buildQuadrilateralFromAngles: buildQuadrilateralFromAngles,
          formatNumber: formatNumber,
          formatLengthFromDelta: formatLengthFromDelta,
          formatLengthBetween: formatLengthBetween
        });
        stage.innerHTML = '';
        SIDE_IDS.forEach(function (id) {
          state.sides[id] = geometry.sides[id];
        });
        if (config.useRootSideLabels) {
          state.sideDisplay = {
            AB: formatLengthBetween(geometry.A, geometry.B),
            BC: formatLengthBetween(geometry.B, geometry.C),
            CD: formatLengthBetween(geometry.C, geometry.D),
            DA: formatLengthBetween(geometry.D, geometry.A)
          };
        }
        if (!config.skipBaseAngles) {
          ANGLE_IDS.forEach(function (id) {
            if (window.InstantGeometryMobileAngleOrnaments.normalizeAngleKind(state.angleKinds[id], geometry.angles[id]) !== state.angleKinds[id]) {
              state.angleKinds[id] = 'plain';
            }
          });
        }
        const extraAngles = config.extraAngles ? config.extraAngles({ state: state, geometry: geometry }) : [];
        extraAngles.forEach(function (angle) {
          if (window.InstantGeometryMobileAngleOrnaments.normalizeAngleKind(state.extraAngleKinds[angle.id], angle.value) !== state.extraAngleKinds[angle.id]) {
            state.extraAngleKinds[angle.id] = 'plain';
          }
        });
        const pageAngleArcRadius = resolvePageAngleArcRadius(config, extraAngles);
        const extraAreas = config.extraAreas ? config.extraAreas({ state: state, geometry: geometry }) : [];
        const view = computeViewport(geometry, extraAngles.reduce(function (points, angle) {
          return points.concat([angle.vertex, angle.p1, angle.p2, angle.labelPoint].filter(Boolean));
        }, extraAreas.reduce(function (points, area) {
          return points.concat((area.points || []).concat(area.labelPoint ? [area.labelPoint] : []));
        }, [])));
        const center = geometry.center;
        const t = {};
        POINT_IDS.forEach(function (id) {
          t[id] = fitPoint(geometry[id], view);
        });
        const tCenter = fitPoint(center, view);
        const polygonPoints = POINT_IDS.map(function (id) { return t[id].x + ',' + t[id].y; }).join(' ');
        if (showArea) {
          const areaHit = createSvg('polygon', { points: polygonPoints, fill: hexToRgba(state.areaColor || '#2a5bd7', 0.1), stroke: 'none' });
          attachHit(areaHit, 'area', 'main');
          stage.appendChild(areaHit);
        }
        extraAreas.forEach(function (area) {
          if (!area.points || area.points.length < 3) return;
          const color = state.extraAreaColors[area.id] || area.color || state.areaColor || '#2a5bd7';
          const areaNode = createSvg('polygon', {
            points: area.points.map(function (point) {
              const p = fitPoint(point, view);
              return p.x + ',' + p.y;
            }).join(' '),
            fill: hexToRgba(color, 0.1),
            stroke: 'none'
          });
          attachHit(areaNode, 'extraArea', area.id);
          stage.appendChild(areaNode);
        });
        stage.appendChild(createSvg('polygon', { points: polygonPoints, fill: 'none', stroke: '#2a5bd7', 'stroke-width': '3' }));
        SIDE_IDS.forEach(function (id) {
          if (hiddenBaseSideSet.has(id)) return;
          const p = id[0];
          const q = id[1];
          const hit = createSvg('line', {
            x1: t[p].x,
            y1: t[p].y,
            x2: t[q].x,
            y2: t[q].y,
            stroke: 'transparent',
            'stroke-width': '28',
            'stroke-linecap': 'round'
          });
          attachHit(hit, 'side', id);
          stage.appendChild(hit);
          drawSideKind(stage, state.sideKinds[id], t[p], t[q]);
        });
        if (typeof config.drawAuxiliary === 'function') {
          config.drawAuxiliary({
            stage: stage,
            state: state,
            geometry: geometry,
            view: view,
            center: center,
            screen: { A: t.A, B: t.B, C: t.C, D: t.D, center: tCenter },
            createSvg: createSvg,
            createLabelNode: createLabelNode,
            fitPoint: function (point) { return fitPoint(point, view); },
            attachHit: attachHit,
            getLabelPosition: getLabelPosition,
            getPointLabelValue: getPointLabelValue,
            getSideLabelValue: getSideLabelValue,
            drawSideKind: function (kindValue, P, Q) { drawSideKind(stage, kindValue, P, Q); },
            formatLengthBetween: formatLengthBetween,
            sideArcGeometry: sideArcGeometry,
            quadraticPathSegment: quadraticPathSegment
          });
        }
        const angleNeighbors = {
          A: ['B', 'D'],
          B: ['A', 'C'],
          C: ['B', 'D'],
          D: ['C', 'A']
        };
        if (!config.skipBaseAngles) ANGLE_IDS.forEach(function (id) {
          const kind = state.angleKinds[id] || 'plain';
          const neighbors = angleNeighbors[id];
          const angleHitArcRadius = Number.isFinite(config.angleHitArcRadius) ? config.angleHitArcRadius : 0.86;
          const arc = arcPoints(geometry[id], geometry[neighbors[0]], geometry[neighbors[1]], pageAngleArcRadius).map(function (point) {
            return fitPoint(point, view);
          });
          if (kind !== 'hidden') {
            if (kind !== 'right') {
              stage.appendChild(createSvg('path', {
                d: pathFromPoints(arc),
                fill: 'none',
                stroke: '#687086',
                'stroke-width': '2.2',
                'stroke-linecap': 'round',
                'stroke-linejoin': 'round'
              }));
            }
            window.InstantGeometryMobileAngleOrnaments.drawAngleKind(stage, kind, arc, t[id], tCenter, createSvg, {
              p1: t[neighbors[0]],
              p2: t[neighbors[1]]
            });
          }
          const hitArc = arcPoints(geometry[id], geometry[neighbors[0]], geometry[neighbors[1]], angleHitArcRadius).map(function (point) {
            return fitPoint(point, view);
          });
          const hit = createSvg('path', { d: sectorPath(t[id], hitArc), fill: 'transparent', stroke: 'none' });
          attachHit(hit, 'angle', id);
          stage.appendChild(hit);
        });
        extraAngles.forEach(function (angle) {
          const arc = arcPoints(angle.vertex, angle.p1, angle.p2, pageAngleArcRadius).map(function (point) {
            return fitPoint(point, view);
          });
          const kind = state.extraAngleKinds[angle.id] || 'plain';
          const vertex = fitPoint(angle.vertex, view);
          if (kind !== 'hidden') {
            if (kind !== 'right') {
              stage.appendChild(createSvg('path', {
                d: pathFromPoints(arc),
                fill: 'none',
                stroke: '#687086',
                'stroke-width': '2.2',
                'stroke-linecap': 'round',
                'stroke-linejoin': 'round'
              }));
            }
            window.InstantGeometryMobileAngleOrnaments.drawAngleKind(stage, kind, arc, vertex, tCenter, createSvg, {
              p1: fitPoint(angle.p1, view),
              p2: fitPoint(angle.p2, view)
            });
          }
          const hitArc = arcPoints(angle.vertex, angle.p1, angle.p2, angle.hitRadius || 0.86).map(function (point) {
            return fitPoint(point, view);
          });
          const hit = createSvg('path', { d: sectorPath(vertex, hitArc), fill: 'transparent', stroke: 'none' });
          attachHit(hit, 'extraAngle', angle.id);
          stage.appendChild(hit);
        });
        POINT_IDS.forEach(function (id) {
          const point = createSvg('circle', { cx: t[id].x, cy: t[id].y, r: 8, fill: '#1f2430' });
          attachHit(point, 'point', id);
          stage.appendChild(point);
        });
        POINT_IDS.forEach(function (id) {
          const label = getPointLabelValue(id);
          if (!label) return;
          const target = getLabelPosition('point', id, fitPoint(interiorLabel(geometry[id], center, -0.14), view));
          const textNode = createLabelNode(label, {
            x: target.x,
            y: target.y,
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            'font-size': '60',
            'font-weight': '700',
            fill: '#1f2430',
            'data-label-kind': 'point',
            'data-label-id': id
          });
          attachHit(textNode, 'point', id);
          stage.appendChild(textNode);
        });
        SIDE_IDS.forEach(function (id) {
          if (hiddenBaseSideSet.has(id)) return;
          const label = getSideLabelValue(id);
          if (!label) return;
          const p = id[0];
          const q = id[1];
          const distance = Math.max(0.45, geometry.sides[id] * 0.08);
          const base = normalOffset(geometry[p], geometry[q], center, distance);
          const pos = getLabelPosition('side', id, fitPoint(base, view));
          if (state.sideArcVisible[id] !== false) {
            const geom = sideArcGeometry(t[p], t[q], tCenter, pos);
            stage.appendChild(createSvg('path', {
              d: quadraticPathSegment(t[p], geom.control, t[q], 0, 0.5 - geom.gapHalf, 20),
              fill: 'none',
              stroke: '#2a5bd7',
              'stroke-width': '2',
              'stroke-linecap': 'round',
              'stroke-dasharray': '6 5'
            }));
            stage.appendChild(createSvg('path', {
              d: quadraticPathSegment(t[p], geom.control, t[q], 0.5 + geom.gapHalf, 1, 20),
              fill: 'none',
              stroke: '#2a5bd7',
              'stroke-width': '2',
              'stroke-linecap': 'round',
              'stroke-dasharray': '6 5'
            }));
          }
          const textNode = createLabelNode(label, {
            x: pos.x,
            y: pos.y,
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            'font-size': '56',
            'font-weight': '700',
            fill: '#2a5bd7',
            'data-label-kind': 'segment',
            'data-label-role': 'side',
            'data-label-id': id
          });
          attachHit(textNode, 'side', id);
          stage.appendChild(textNode);
        });
        if (!config.skipBaseAngles) ANGLE_IDS.forEach(function (id) {
          const label = getAngleLabelValue(id);
          if (!label) return;
          const pos = getLabelPosition('angle', id, fitPoint(interiorLabel(geometry[id], center, 0.34), view));
          const textNode = createLabelNode(label, {
            x: pos.x,
            y: pos.y,
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            'font-size': '46',
            'font-weight': '700',
            fill: '#687086',
            'data-label-kind': 'angle',
            'data-label-id': id
          });
          attachHit(textNode, 'angle', id);
          stage.appendChild(textNode);
        });
        extraAngles.forEach(function (angle) {
          const label = getExtraAngleLabelValue(angle);
          if (!label) return;
          const basePos = angle.labelPoint
            ? fitPoint(angle.labelPoint, view)
            : fitPoint(interiorLabel(angle.vertex, center, angle.labelRate || 0.34), view);
          const pos = getLabelPosition('extraAngle', angle.id, basePos);
          const textNode = createLabelNode(label, {
            x: pos.x,
            y: pos.y,
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            'font-size': '46',
            'font-weight': '700',
            fill: '#687086',
            'data-label-kind': 'angle',
            'data-label-role': 'extraAngle',
            'data-label-id': angle.id
          });
          attachHit(textNode, 'extraAngle', angle.id);
          stage.appendChild(textNode);
        });
        const areaLabel = showArea ? getAreaLabelValue() : '';
        if (areaLabel) {
          const fittedArea = fittedAreaLabel(POINT_IDS.map(function (id) { return t[id]; }), areaLabel, 58);
          const areaPos = getLabelPosition('area', 'main', fittedArea);
          const textNode = createLabelNode(areaLabel, {
            x: areaPos.x,
            y: areaPos.y,
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            'font-size': fittedArea.fontSize,
            style: 'font-size:' + fittedArea.fontSize + 'px',
            'font-weight': '700',
            fill: areaLabelColor(state.areaColor || '#2a5bd7'),
            'data-label-kind': 'area',
            'data-label-id': 'main'
          });
          attachHit(textNode, 'area', 'main');
          stage.appendChild(textNode);
        }
        extraAreas.forEach(function (area) {
          const label = getExtraAreaLabelValue(area);
          if (!label) return;
          const color = state.extraAreaColors[area.id] || area.color || state.areaColor || '#2a5bd7';
          const areaPoints = area.points.map(function (point) { return fitPoint(point, view); });
          const pos = getLabelPosition('extraArea', area.id, fittedAreaLabel(areaPoints, label, 54));
          const textNode = createLabelNode(label, {
            x: pos.x,
            y: pos.y,
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            'font-size': pos.fontSize,
            style: 'font-size:' + pos.fontSize + 'px',
            'font-weight': '700',
            fill: areaLabelColor(color),
            'data-label-kind': 'area',
            'data-label-role': 'extraArea',
            'data-label-id': area.id
          });
          attachHit(textNode, 'extraArea', area.id);
          stage.appendChild(textNode);
        });
        fitStageViewBox(stage);
        setStatus(config.readyMessage, false);
      } catch (error) {
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
        link.download = format === 'transparent' ? config.fileBase + '-transparent.png' : config.fileBase + '.png';
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
      pdf.save(config.fileBase + '.pdf');
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

    Object.keys(controlInputs).forEach(function (key) {
      controlInputs[key].addEventListener('input', render);
    });
    backBtn.addEventListener('click', function () { window.history.back(); });
    saveBtn.addEventListener('click', function () { if (!moveMode) openSheet('save'); });
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
    document.addEventListener('instant-geometry-settings:changed', render);
    document.addEventListener('instant-geometry-draw-settings:ready', render);
    render();
  }

  window.InstantGeometryQuadrilateralMobile = {
    createPage: createPage,
    helpers: {
      finalizeGeometry: finalizeGeometry,
      scalePointsToMinSide: scalePointsToMinSide,
      segmentLength: segmentLength,
      polygonArea: polygonArea,
      polygonCentroid: polygonCentroid,
      parsePositiveNumber: parsePositiveNumber,
      formatNumber: formatNumber,
      formatLengthFromDelta: formatLengthFromDelta,
      formatLengthBetween: formatLengthBetween
    }
  };
})();
