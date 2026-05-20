(function () {
  'use strict';

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
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
    const nodes = Array.from(stage.querySelectorAll('path,line,polyline,polygon,rect,circle,ellipse,text,foreignObject'));
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

  function normalizeExpression(raw) {
    return String(raw || '')
      .trim()
      .replace(/\s+/g, '')
      .replace(/π/g, 'pi')
      .replace(/√/g, 'sqrt')
      .replace(/(\d+(?:\.\d+)?)deg\b/gi, 'deg($1)');
  }

  function parsePositiveNumber(value, name) {
    const text = normalizeExpression(value);
    if (!text) throw new Error(name + ' を入力してください。');
    if (!/^[0-9+\-*/().,a-zA-Z]+$/.test(text)) {
      throw new Error(name + ' に使用できない文字が含まれています。');
    }
    const scope = {
      pi: Math.PI,
      e: Math.E,
      sqrt: Math.sqrt,
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      deg: function (v) { return v * Math.PI / 180; }
    };
    let result;
    try {
      result = Function('s', '"use strict";const {pi,e,sqrt,sin,cos,tan,deg}=s;return (' + text + ');')(scope);
    } catch (e) {
      throw new Error(name + ' の式を読み取れませんでした。');
    }
    if (!Number.isFinite(result) || result <= 0) {
      throw new Error(name + ' には 0 より大きい値を入力してください。');
    }
    return result;
  }

  function formatNumber(value) {
    if (window.InstantGeometryDrawSettings && typeof window.InstantGeometryDrawSettings.formatNumber === 'function') {
      return window.InstantGeometryDrawSettings.formatNumber(value);
    }
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  }

  function applyDrawSettingFormat(label, kind) {
    const formatter = window.InstantGeometryDrawSettings;
    if (!formatter) return label;
    if (kind === 'angle' && typeof formatter.formatAngle === 'function') return formatter.formatAngle(label);
    if (typeof formatter.formatByKind === 'function') return formatter.formatByKind(label, kind);
    return label;
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

  function signedArea(points) {
    let sum = 0;
    for (let i = 0; i < points.length; i += 1) {
      const p = points[i];
      const q = points[(i + 1) % points.length];
      sum += p.x * q.y - q.x * p.y;
    }
    return sum / 2;
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

  function circleIntersections(center1, radius1, center2, radius2) {
    const dx = center2.x - center1.x;
    const dy = center2.y - center1.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-8 || d > radius1 + radius2 + 1e-8 || d < Math.abs(radius1 - radius2) - 1e-8) return [];
    const a = (radius1 * radius1 - radius2 * radius2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, radius1 * radius1 - a * a));
    const mx = center1.x + (a * dx) / d;
    const my = center1.y + (a * dy) / d;
    const rx = -dy * (h / d);
    const ry = dx * (h / d);
    const p1 = { x: mx + rx, y: my + ry };
    const p2 = { x: mx - rx, y: my - ry };
    return h < 1e-8 ? [p1] : [p1, p2];
  }

  function orientation(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  }

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

  function isSimplePolygon(points) {
    const n = points.length;
    for (let i = 0; i < n; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % n];
      for (let j = i + 1; j < n; j += 1) {
        if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;
        const c = points[j];
        const d = points[(j + 1) % n];
        if (segmentsIntersect(a, b, c, d)) return false;
      }
    }
    return true;
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

  function fitPoint(point, box) {
    return {
      x: box.left + (point.x - box.minX) * box.scale,
      y: box.bottom - (point.y - box.minY) * box.scale
    };
  }

  function computeViewport(geometry, extraPoints) {
    const width = 1000;
    const height = 1000;
    const paddingX = 115;
    const paddingTop = 185;
    const paddingBottom = 115;
    const points = geometry.list.concat(extraPoints || []);
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
    const points = [];
    for (let i = 0; i <= 22; i += 1) {
      const angle = a1 + delta * (i / 22);
      points.push({ x: vertex.x + radius * Math.cos(angle), y: vertex.y + radius * Math.sin(angle) });
    }
    return points;
  }

  function resolvePageAngleArcRadius(config, geometry, extraAngles) {
    if (Number.isFinite(config.pageAngleArcRadius)) return config.pageAngleArcRadius;
    for (let i = 0; i < extraAngles.length; i += 1) {
      if (Number.isFinite(extraAngles[i].arcRadius)) return extraAngles[i].arcRadius;
    }
    const firstId = config.pointIds[0];
    const triplet = getAngleTriplet(config, firstId, 0);
    const next = triplet.next;
    const adjacentLength = geometry.sides[firstId + next] || geometry.sides[next + firstId] || segmentLength(geometry.points[firstId], geometry.points[next]);
    return Math.max(0.24, adjacentLength * 0.055);
  }

  function pathFromPoints(points) {
    if (!points.length) return '';
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

  function buildTextInput(labelText, value) {
    const field = document.createElement('div');
    field.className = 'sheet-field';
    const label = document.createElement('label');
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = value || '';
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

  function computePolygon(config, values) {
    if (config.mode === 'star-angles') return computeStarFromAngles(config, values);
    if (config.mode === 'fixed') return computeFixedPolygon(config);
    if (config.mode === 'angles') return computePolygonFromAngles(config, values);

    const A = { x: 0, y: 0 };
    const B = { x: values.AB, y: 0 };
    const C = circleIntersections(A, values.AC, B, values.BC).filter(function (p) { return p.y > 0; }).sort(function (l, r) { return r.y - l.y; })[0];
    if (!C) throw new Error(config.errorMessage);

    const dCandidates = circleIntersections(A, values.AD, C, values.CD);
    if (!dCandidates.length) throw new Error(config.errorMessage);

    let best = null;
    dCandidates.forEach(function (D) {
      if (config.pointIds.length === 5) {
        circleIntersections(A, values.EA, D, values.DE).forEach(function (E) {
          const points = [A, B, C, D, E];
          const area = signedArea(points);
          if (area <= 1e-6 || !isSimplePolygon(points)) return;
          const score = area + (Math.min(C.y, D.y, E.y) > -1e-6 ? 1000 : 0);
          if (!best || score > best.score) best = { points: points, score: score };
        });
        return;
      }

      circleIntersections(A, values.AE, D, values.DE).forEach(function (E) {
        circleIntersections(A, values.FA, E, values.EF).forEach(function (F) {
          const points = [A, B, C, D, E, F];
          const area = signedArea(points);
          if (area <= 1e-6 || !isSimplePolygon(points)) return;
          const score = area + (Math.min(C.y, D.y, E.y, F.y) > -1e-6 ? 1000 : 0);
          if (!best || score > best.score) best = { points: points, score: score };
        });
      });
    });

    if (!best) throw new Error(config.errorMessage);

    const centroid = polygonCentroid(best.points);
    const pointsMap = {};
    config.pointIds.forEach(function (id, index) {
      pointsMap[id] = {
        x: best.points[index].x - centroid.x,
        y: best.points[index].y - centroid.y
      };
    });
    const list = config.pointIds.map(function (id) { return pointsMap[id]; });
    const centeredCentroid = polygonCentroid(list);
    const sides = {};
    getSegmentIds(config).forEach(function (id) {
      sides[id] = segmentLength(pointsMap[id[0]], pointsMap[id[1]]);
    });
    const angles = {};
    config.pointIds.forEach(function (id, index) {
      const prev = config.pointIds[(index - 1 + config.pointIds.length) % config.pointIds.length];
      const next = config.pointIds[(index + 1) % config.pointIds.length];
      angles[id] = angleDegrees(pointsMap[prev], pointsMap[id], pointsMap[next]);
    });

    return {
      points: pointsMap,
      list: list,
      sides: sides,
      angles: angles,
      center: centeredCentroid,
      area: polygonArea(list)
    };
  }

  function computeStarFromAngles(config, values) {
    const order = config.drawOrder || config.pointIds;
    if (order.length !== 5) {
      throw new Error(config.errorMessage || '星形を作れません。');
    }

    const angles = {};
    config.pointIds.forEach(function (id) {
      const value = values[id];
      if (!(value > 0 && value < 180)) {
        throw new Error('角は 1 より大きく 180 未満で入力してください。');
      }
      angles[id] = value;
    });
    const total = config.pointIds.reduce(function (sum, id) { return sum + angles[id]; }, 0);
    const expected = config.starAngleSum || 180;
    if (Math.abs(total - expected) > 1e-6) {
      throw new Error('星形の先端角の和が ' + expected + '° になるように入力してください。');
    }

    const directions = [];
    let theta = (-90 - angles[order[0]] / 2) * Math.PI / 180;
    for (let i = 0; i < order.length; i += 1) {
      directions.push({
        x: Math.cos(theta),
        y: Math.sin(theta)
      });
      const next = order[(i + 1) % order.length];
      theta += (180 - angles[next]) * Math.PI / 180;
    }

    let best = null;
    for (let i = 0; i < directions.length; i += 1) {
      for (let j = i + 1; j < directions.length; j += 1) {
        let baseX = 0;
        let baseY = 0;
        for (let k = 0; k < directions.length; k += 1) {
          if (k === i || k === j) continue;
          baseX += directions[k].x;
          baseY += directions[k].y;
        }
        const solved = solve2x2(
          directions[i].x,
          directions[j].x,
          directions[i].y,
          directions[j].y,
          -baseX,
          -baseY
        );
        if (!solved) continue;
        const lengths = directions.map(function () { return 1; });
        lengths[i] = solved.x;
        lengths[j] = solved.y;
        if (lengths.some(function (length) { return length <= 0.08 || !Number.isFinite(length); })) continue;
        const mean = lengths.reduce(function (sum, length) { return sum + length; }, 0) / lengths.length;
        const score = lengths.reduce(function (sum, length) {
          return sum + Math.pow(length - mean, 2);
        }, 0);
        if (!best || score < best.score) best = { lengths: lengths, score: score };
      }
    }
    if (!best) throw new Error('この角の組み合わせでは星形を作れません。');

    const rawPoints = {};
    rawPoints[order[0]] = { x: 0, y: 0 };
    for (let i = 0; i < order.length - 1; i += 1) {
      const prev = rawPoints[order[i]];
      rawPoints[order[i + 1]] = {
        x: prev.x + directions[i].x * best.lengths[i],
        y: prev.y + directions[i].y * best.lengths[i]
      };
    }

    if (config.normalizeMinSide) {
      const sideLengths = getSegmentIds(config).map(function (id) {
        return segmentLength(rawPoints[id[0]], rawPoints[id[1]]);
      }).filter(function (value) {
        return Number.isFinite(value) && value > 0;
      });
      const minSide = Math.min.apply(null, sideLengths);
      if (Number.isFinite(minSide) && minSide > 0) {
        const scale = config.normalizeMinSide / minSide;
        Object.keys(rawPoints).forEach(function (id) {
          rawPoints[id] = { x: rawPoints[id].x * scale, y: rawPoints[id].y * scale };
        });
      }
    }

    const center = config.pointIds.reduce(function (acc, id) {
      acc.x += rawPoints[id].x / config.pointIds.length;
      acc.y += rawPoints[id].y / config.pointIds.length;
      return acc;
    }, { x: 0, y: 0 });
    const pointsMap = {};
    config.pointIds.forEach(function (id) {
      pointsMap[id] = {
        x: rawPoints[id].x - center.x,
        y: rawPoints[id].y - center.y
      };
    });
    const list = config.pointIds.map(function (id) { return pointsMap[id]; });
    const centeredCenter = { x: 0, y: 0 };
    const sides = {};
    getSegmentIds(config).forEach(function (id) {
      sides[id] = segmentLength(pointsMap[id[0]], pointsMap[id[1]]);
    });
    const angleMap = {};
    config.pointIds.forEach(function (id, index) {
      const triplet = getAngleTriplet(config, id, index);
      angleMap[id] = angleDegrees(pointsMap[triplet.prev], pointsMap[id], pointsMap[triplet.next]);
    });

    return {
      points: pointsMap,
      list: list,
      sides: sides,
      angles: angleMap,
      center: centeredCenter,
      area: polygonArea(getDrawOrder(config).map(function (id) { return pointsMap[id]; }))
    };
  }

  function getSegmentIds(config) {
    return (config.sideIds || []).concat(config.extraSegmentIds || []);
  }

  function getDrawOrder(config) {
    return config.drawOrder || config.pointIds;
  }

  function getAngleTriplet(config, id, index) {
    const names = config.angleNames && config.angleNames[id];
    if (names && names.length >= 3) {
      return { prev: names[0], vertex: names[1], next: names[2] };
    }
    return {
      prev: config.pointIds[(index - 1 + config.pointIds.length) % config.pointIds.length],
      vertex: id,
      next: config.pointIds[(index + 1) % config.pointIds.length]
    };
  }

  function computeFixedPolygon(config) {
    const sourcePoints = config.points || {};
    const pointsMap = {};
    config.pointIds.forEach(function (id) {
      const point = sourcePoints[id];
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        throw new Error(config.errorMessage || '図形を作れません。');
      }
      pointsMap[id] = { x: point.x, y: point.y };
    });
    const baseList = config.pointIds.map(function (id) { return pointsMap[id]; });
    const centroid = polygonCentroid(baseList);
    config.pointIds.forEach(function (id) {
      pointsMap[id] = {
        x: pointsMap[id].x - centroid.x,
        y: pointsMap[id].y - centroid.y
      };
    });
    const list = config.pointIds.map(function (id) { return pointsMap[id]; });
    const drawList = getDrawOrder(config).map(function (id) { return pointsMap[id]; });
    const center = polygonCentroid(list);
    const sides = {};
    getSegmentIds(config).forEach(function (id) {
      sides[id] = segmentLength(pointsMap[id[0]], pointsMap[id[1]]);
    });
    const angles = {};
    config.pointIds.forEach(function (id, index) {
      const triplet = getAngleTriplet(config, id, index);
      angles[id] = angleDegrees(pointsMap[triplet.prev], pointsMap[id], pointsMap[triplet.next]);
    });
    return {
      points: pointsMap,
      list: list,
      sides: sides,
      angles: angles,
      center: center,
      area: polygonArea(drawList)
    };
  }

  function solve2x2(a, b, c, d, e, f) {
    const det = a * d - b * c;
    if (Math.abs(det) < 1e-10) return null;
    return {
      x: (e * d - b * f) / det,
      y: (a * f - e * c) / det
    };
  }

  function computePolygonFromAngles(config, values) {
    const n = config.pointIds.length;
    const expected = (n - 2) * 180;
    const angles = config.pointIds.map(function (id) {
      const value = values[id];
      if (!(value > 0 && value < 180)) {
        throw new Error('角は 1 より大きく 180 未満で入力してください。');
      }
      return value;
    });
    const total = angles.reduce(function (sum, value) { return sum + value; }, 0);
    if (Math.abs(total - expected) > 1e-6) {
      throw new Error('角の和が ' + expected + '° になるように入力してください。');
    }

    const directions = [];
    let theta = 0;
    for (let i = 0; i < n; i += 1) {
      directions.push({
        x: Math.cos(theta),
        y: Math.sin(theta)
      });
      theta += (180 - angles[(i + 1) % n]) * Math.PI / 180;
    }

    let sxx = 0;
    let sxy = 0;
    let syy = 0;
    let sx = 0;
    let sy = 0;
    directions.forEach(function (u) {
      sxx += u.x * u.x;
      sxy += u.x * u.y;
      syy += u.y * u.y;
      sx += u.x;
      sy += u.y;
    });
    const lambda = solve2x2(sxx, sxy, sxy, syy, sx, sy);
    if (!lambda) throw new Error('この角の組み合わせでは作図できません。');
    const lengths = directions.map(function (u) {
      return 1 - u.x * lambda.x - u.y * lambda.y;
    });
    if (lengths.some(function (length) { return length <= 0.08 || !Number.isFinite(length); })) {
      throw new Error('この角の組み合わせでは凸多角形を作れません。');
    }

    let rawPoints = [{ x: 0, y: 0 }];
    for (let i = 0; i < n - 1; i += 1) {
      const prev = rawPoints[rawPoints.length - 1];
      rawPoints.push({
        x: prev.x + directions[i].x * lengths[i],
        y: prev.y + directions[i].y * lengths[i]
      });
    }
    if (!isSimplePolygon(rawPoints)) {
      throw new Error('この角の組み合わせでは凸多角形を作れません。');
    }
    if (signedArea(rawPoints) < 0) rawPoints.reverse();

    if (config.normalizeMinSide) {
      const sideLengths = rawPoints.map(function (point, index) {
        return segmentLength(point, rawPoints[(index + 1) % rawPoints.length]);
      }).filter(function (value) {
        return Number.isFinite(value) && value > 0;
      });
      const minSide = Math.min.apply(null, sideLengths);
      if (Number.isFinite(minSide) && minSide > 0) {
        const scale = config.normalizeMinSide / minSide;
        rawPoints = rawPoints.map(function (point) {
          return { x: point.x * scale, y: point.y * scale };
        });
      }
    }

    if (config.transformRawPoints) {
      rawPoints = config.transformRawPoints(rawPoints, config.pointIds);
    }

    const centroid = polygonCentroid(rawPoints);
    const pointsMap = {};
    config.pointIds.forEach(function (id, index) {
      pointsMap[id] = {
        x: rawPoints[index].x - centroid.x,
        y: rawPoints[index].y - centroid.y
      };
    });
    const list = config.pointIds.map(function (id) { return pointsMap[id]; });
    const centeredCentroid = polygonCentroid(list);
    const sides = {};
    getSegmentIds(config).forEach(function (id) {
      sides[id] = segmentLength(pointsMap[id[0]], pointsMap[id[1]]);
    });
    const angleMap = {};
    config.pointIds.forEach(function (id, index) {
      angleMap[id] = angles[index];
    });

    return {
      points: pointsMap,
      list: list,
      sides: sides,
      angles: angleMap,
      center: centeredCentroid,
      area: polygonArea(list)
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
    config.controls.forEach(function (control) {
      controlInputs[control.key] = document.getElementById(control.id);
    });

    const state = deepClone(config.initialState);
    const allSegmentIds = getSegmentIds(config);
    if (!state.sideKinds) {
      state.sideKinds = {};
      allSegmentIds.forEach(function (id) {
        state.sideKinds[id] = 'plain';
      });
    }
    if (!state.sideArcVisible) {
      state.sideArcVisible = {};
      allSegmentIds.forEach(function (id) {
        state.sideArcVisible[id] = true;
      });
    }
    if (!state.angleKinds) {
      state.angleKinds = {};
      config.pointIds.forEach(function (id) {
        state.angleKinds[id] = 'plain';
      });
    }
    state.extraAngleInputs = state.extraAngleInputs || {};
    state.extraAngleKinds = state.extraAngleKinds || {};
    state.extraAreaInputs = state.extraAreaInputs || {};
    state.extraAreaColors = state.extraAreaColors || {};
    state.areaColor = state.areaColor || '#2a5bd7';
    state.labelOffsets = state.labelOffsets || {};
    state.labelScales = state.labelScales || {};
    const showArea = config.showArea !== false;
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

    function getLabelScale(kind, id) {
      const value = Number(state.labelScales[labelKey(kind, id)]);
      return Number.isFinite(value) && value > 0 ? value : 1;
    }

    function setLabelScale(kind, id, value) {
      const scale = Math.max(0.1, Math.min(4, Number(value) || 1));
      state.labelScales[labelKey(kind, id)] = scale;
    }

    function scaledFontSize(kind, id, baseSize) {
      return Math.max(8, Math.round(Number(baseSize) * getLabelScale(kind, id)));
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

    function getPointName(id) {
      const raw = String(state.pointInputs[id] || '').trim();
      return raw || id;
    }

    function getPointLabel(id) {
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
      const names = (config.angleNames && config.angleNames[id]) || [];
      return '∠' + names.map(getPointName).join('');
    }

    function getAreaName() {
      const prefix = String(config.areaName || '').replace(/[A-Z][A-Z0-9]*$/, '');
      return prefix + config.pointIds.map(getPointName).join('');
    }

    function getExtraAreaName(id) {
      const area = config.extraAreas && geometry
        ? config.extraAreas({ state: state, geometry: geometry }).find(function (item) { return item.id === id; })
        : null;
      if (area && area.name) return area.name;
      return '面積';
    }

    function getSideLabel(id) {
      const raw = String(state.sideInputs[id] || '');
      if (!raw) return null;
      if (isRatioLabelValue(raw)) return raw;
      if (isNumericLabelValue(raw) && geometry) return formatNumber(geometry.sides[id]);
      return raw;
    }

    function getAngleLabel(id) {
      const raw = String(state.angleInputs[id] || '');
      if (!raw) return null;
      if (isRatioLabelValue(raw)) return raw;
      if (isNumericLabelValue(raw) && geometry) return applyDrawSettingFormat(formatNumber(geometry.angles[id]) + '°', 'angle');
      return raw;
    }

    function getExtraAngleLabel(angle) {
      const raw = String(state.extraAngleInputs[angle.id] || '');
      if (!raw) return null;
      if (isRatioLabelValue(raw)) return raw;
      if (isNumericLabelValue(raw)) return applyDrawSettingFormat(formatNumber(angle.value) + '°', 'angle');
      return raw;
    }

    function getAreaLabel() {
      const raw = String(state.areaValue || '');
      if (!raw) return null;
      if (isRatioLabelValue(raw)) return raw;
      if (isNumericLabelValue(raw) && geometry) return formatNumber(geometry.area);
      return raw;
    }

    function getExtraAreaLabel(area) {
      const raw = String(state.extraAreaInputs[area.id] || '');
      if (!raw) return null;
      if (isRatioLabelValue(raw)) return raw;
      if (isNumericLabelValue(raw) && area.value !== undefined) return formatNumber(area.value);
      return raw;
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

    function buildControllerSegmentKindSelect(kind, id, buildSelectFn) {
      return buildSelectFn('線分マーク', state.sideKinds[id] || 'plain', [
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
      const extra = kind === 'extraAngle' && config.extraAngles && geometry
        ? config.extraAngles({ state: state, geometry: geometry }).find(function (angle) { return angle.id === id; })
        : null;
      return window.InstantGeometryMobileAngleOrnaments.appendAngleKindSelect(
        body,
        buildSelectFn,
        kind === 'extraAngle' ? (state.extraAngleKinds[id] || 'plain') : (state.angleKinds[id] || 'plain'),
        extra ? extra.value : (geometry ? geometry.angles[id] : null)
      );
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
        getLabelScale: getLabelScale,
        setLabelScale: setLabelScale,
        hasGuideField: function (kind) {
          return kind === 'side';
        },
        getGuideVisible: function (kind, id) {
          return kind === 'side' ? state.sideArcVisible[id] !== false : false;
        },
        setGuideVisible: function (kind, id, value) {
          if (kind === 'side') state.sideArcVisible[id] = value;
        },
        buildSegmentKindSelect: buildControllerSegmentKindSelect,
        buildAngleKindSelect: buildControllerAngleKindSelect,
        setKind: function (kind, id, value) {
          if (kind === 'side') state.sideKinds[id] = value;
          else if (kind === 'angle') state.angleKinds[id] = value;
          else if (kind === 'extraAngle') state.extraAngleKinds[id] = value;
        },
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

    function renderEditSheet(kind, payload) {
      sheetBody.innerHTML = '';
      const id = payload.id;
      const labels = {
        point: getPointName(id),
        side: getSideName(id),
        angle: getAngleName(id),
        extraAngle: getAngleName(id),
        area: getAreaName(),
        extraArea: getExtraAreaName(id)
      };
      const value = kind === 'point' ? (state.pointInputs[id] || '')
        : kind === 'side' ? (state.sideInputs[id] || '')
          : kind === 'angle' ? (state.angleInputs[id] || '')
            : kind === 'extraAngle' ? (state.extraAngleInputs[id] || '')
              : kind === 'extraArea' ? (state.extraAreaInputs[id] || '')
                : (state.areaValue || '');
      const hints = {
        point: '非表示または自由入力を選べます。自由入力では数字や記号も文字として表示します。',
        side: '非表示、数値、比の値、自由入力を選べます。\n' + RATIO_LABEL_HINT,
        angle: '非表示、数値、比の値、自由入力を選べます。\n' + RATIO_LABEL_HINT,
        extraAngle: '非表示、数値、比の値、自由入力を選べます。\n' + RATIO_LABEL_HINT,
        area: '非表示、数値、比の値、自由入力を選べます。\n' + RATIO_LABEL_HINT,
        extraArea: '非表示、数値、比の値、自由入力を選べます。\n' + RATIO_LABEL_HINT
      };

      sheetTitle.textContent = labels[kind] || '設定';
      let kindSelect = null;
      let arcCheckbox = null;
      if (kind === 'side') {
        const built = buildSelect('種類', state.sideKinds[id] || 'plain', [
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
        const checkboxBuilt = buildCheckbox('弧を表示', state.sideArcVisible[id] !== false);
        arcCheckbox = checkboxBuilt.input;
        sheetBody.appendChild(checkboxBuilt.field);
      }
      if (kind === 'angle' || kind === 'extraAngle') {
        const extra = kind === 'extraAngle' && config.extraAngles && geometry
          ? config.extraAngles({ state: state, geometry: geometry }).find(function (angle) { return angle.id === id; })
          : null;
        kindSelect = window.InstantGeometryMobileAngleOrnaments.appendAngleKindSelect(
          sheetBody,
          buildSelect,
          kind === 'extraAngle' ? (state.extraAngleKinds[id] || 'plain') : (state.angleKinds[id] || 'plain'),
          extra ? extra.value : (geometry ? geometry.angles[id] : null)
        );
      }
      const built = buildLabelEditor('ラベル', value, kind !== 'point');
      sheetBody.appendChild(built.field);
      let colorPalette = null;
      if (kind === 'area' || kind === 'extraArea') {
        const currentColor = kind === 'extraArea'
          ? (state.extraAreaColors[id] || state.areaColor || '#2a5bd7')
          : (state.areaColor || '#2a5bd7');
        colorPalette = buildColorPalette('色', currentColor);
        sheetBody.appendChild(colorPalette.field);
      }
      const hint = document.createElement('p');
      hint.className = 'sheet-hint';
      hint.textContent = hints[kind];
      sheetBody.appendChild(hint);

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
          applyModalValue(kind, id, built, kindSelect ? kindSelect.value : null, arcCheckbox ? arcCheckbox.checked : null, colorPalette ? colorPalette.value : null);
          render();
          enterMoveMode(kind, { id: id });
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
          applyModalValue(kind, id, built, kindSelect ? kindSelect.value : null, arcCheckbox ? arcCheckbox.checked : null, colorPalette ? colorPalette.value : null);
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

    function applyModalValue(kind, id, editor, kindValue, arcVisibleValue, colorValue) {
      const mode = editor.mode.value;
      const text = normalizeFreeLabel(editor.input.value);
      if (kind === 'point') {
        state.pointInputs[id] = mode === 'text' ? text : '';
        return;
      }
      if (kind === 'side') {
        if (kindValue) state.sideKinds[id] = kindValue;
        if (arcVisibleValue !== null) state.sideArcVisible[id] = Boolean(arcVisibleValue);
        if (mode === 'hidden') {
          state.sideInputs[id] = '';
          state.sideArcVisible[id] = false;
          return;
        }
        if (mode === 'numeric') {
          state.sideInputs[id] = ' ';
          return;
        }
        if (mode === 'ratio') {
          const ratio = parseRatioLabelInput(text);
          if (!ratio) throw new Error('比の値は「r,5」「t,4.4」「s,5/3」の形式で入力してください。');
          state.sideInputs[id] = RATIO_LABEL_PREFIX + ratio.source;
          return;
        }
        state.sideInputs[id] = text || '';
        return;
      }
      if (kind === 'angle') {
        if (kindValue) state.angleKinds[id] = kindValue;
        if (mode === 'hidden') {
          state.angleInputs[id] = '';
          return;
        }
        if (mode === 'numeric') {
          state.angleInputs[id] = ' ';
          return;
        }
        if (mode === 'ratio') {
          const ratio = parseRatioLabelInput(text);
          if (!ratio) throw new Error('比の値は「r,5」「t,4.4」「s,5/3」の形式で入力してください。');
          state.angleInputs[id] = RATIO_LABEL_PREFIX + ratio.source;
          return;
        }
        state.angleInputs[id] = text || '';
        return;
      }
      if (kind === 'extraAngle') {
        if (kindValue) state.extraAngleKinds[id] = kindValue;
        if (mode === 'hidden') {
          state.extraAngleInputs[id] = '';
          return;
        }
        if (mode === 'numeric') {
          state.extraAngleInputs[id] = ' ';
          return;
        }
        if (mode === 'ratio') {
          const ratio = parseRatioLabelInput(text);
          if (!ratio) throw new Error('比の値は「r,5」「t,4.4」「s,5/3」の形式で入力してください。');
          state.extraAngleInputs[id] = RATIO_LABEL_PREFIX + ratio.source;
          return;
        }
        state.extraAngleInputs[id] = text || '';
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
        if (colorValue) state.extraAreaColors[id] = colorValue;
        if (mode === 'hidden') {
          state.extraAreaInputs[id] = '';
          return;
        }
        if (mode === 'numeric') {
          state.extraAreaInputs[id] = ' ';
          return;
        }
        if (mode === 'ratio') {
          const ratio = parseRatioLabelInput(text);
          if (!ratio) throw new Error('比の値は「r,5」「t,4.4」「s,5/3」の形式で入力してください。');
          state.extraAreaInputs[id] = RATIO_LABEL_PREFIX + ratio.source;
          return;
        }
        state.extraAreaInputs[id] = text || '';
      }
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
        if (window.InstantGeometrySvgLabels && window.InstantGeometrySvgLabels.parseMathLayout) {
          const x = Number(attrs.x) || 0;
          const y = Number(attrs.y) || 0;
          const fontSize = Number(attrs['font-size']) || 42;
          const color = attrs.fill || '#1f2430';
          const layout = window.InstantGeometrySvgLabels.parseMathLayout(stage, String(label), fontSize);
          layout.node.querySelectorAll('.function-rich-label-text').forEach(function (node) {
            node.setAttribute('fill', color);
            node.setAttribute('stroke', '#ffffff');
            node.setAttribute('stroke-width', '7');
            node.setAttribute('stroke-linejoin', 'round');
            node.setAttribute('paint-order', 'stroke');
            node.setAttribute('font-weight', '900');
          });
          layout.node.querySelectorAll('.function-rich-fraction-rule,.function-rich-sqrt-rule,.function-rich-vector-arrow,.function-rich-matrix-bracket').forEach(function (node) {
            node.setAttribute('fill', 'none');
            node.setAttribute('stroke', color);
            node.setAttribute('stroke-width', node.classList.contains('function-rich-sqrt-rule') ? '3.2' : '2.2');
            node.setAttribute('stroke-linecap', 'round');
            node.setAttribute('stroke-linejoin', 'round');
          });
          const group = createSvg('g', {
            class: attrs.class,
            transform: 'translate(' + x + ' ' + y + ')',
            fill: color,
            'data-kind': attrs['data-kind'],
            'data-id': attrs['data-id']
          });
          group.appendChild(layout.node);
          return group;
        }
        const text = createSvg('text', attrs);
        text.textContent = label;
        return text;
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
        group.appendChild(createSvg('rect', { x: x - width / 2, y: y - height / 2, width: width, height: height, fill: '#ffffff', stroke: stroke, 'stroke-width': Math.max(2, fontSize * 0.055) }));
      }
      const text = createSvg('text', Object.assign({}, attrs, { 'text-anchor': 'middle', 'dominant-baseline': 'middle' }));
      text.textContent = parsed.value;
      group.appendChild(text);
      return group;
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
      const foreignObject = element.querySelector && element.querySelector('foreignObject');
      if (foreignObject) {
        return getLabelNodePoint(foreignObject);
      }
      const textNode = tag === 'text' ? element : element.querySelector && element.querySelector('text');
      if (!textNode) return null;
      const x = Number(textNode.getAttribute('x'));
      const y = Number(textNode.getAttribute('y'));
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return { x: x, y: y };
    }

    function canonicalLabelKind(kind) {
      if (kind === 'side' || kind === 'extraSegment') return 'segment';
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

    function readValues() {
      if (config.readValues) {
        return config.readValues(controlInputs, parsePositiveNumber);
      }
      const values = {};
      config.controls.forEach(function (control) {
        values[control.key] = parsePositiveNumber(controlInputs[control.key].value, control.label);
      });
      return values;
    }

    function render() {
      try {
        currentLabelBases = {};
        geometry = computePolygon(config, readValues());
        stage.innerHTML = '';
        const extraAngles = config.extraAngles ? config.extraAngles({ state: state, geometry: geometry }) : [];
        extraAngles.forEach(function (angle) {
          const normalized = window.InstantGeometryMobileAngleOrnaments.normalizeAngleKind(state.extraAngleKinds[angle.id], angle.value);
          if (normalized !== state.extraAngleKinds[angle.id]) state.extraAngleKinds[angle.id] = 'plain';
        });
        const pageAngleArcRadius = resolvePageAngleArcRadius(config, geometry, extraAngles);
        const extraAreas = config.extraAreas ? config.extraAreas({ state: state, geometry: geometry }) : [];
        const view = computeViewport(geometry, extraAngles.reduce(function (points, angle) {
          return points.concat([angle.vertex, angle.p1, angle.p2, angle.labelPoint].filter(Boolean));
        }, extraAreas.reduce(function (points, area) {
          return points.concat((area.points || []).concat(area.labelPoint ? [area.labelPoint] : []));
        }, [])));
        const center = geometry.center;
        const fitted = {};
        config.pointIds.forEach(function (id) {
          if (window.InstantGeometryMobileAngleOrnaments.normalizeAngleKind(state.angleKinds[id], geometry.angles[id]) !== state.angleKinds[id]) {
            state.angleKinds[id] = 'plain';
          }
          fitted[id] = fitPoint(geometry.points[id], view);
        });
        const fittedCenter = fitPoint(center, view);
        const pointsText = getDrawOrder(config).map(function (id) { return fitted[id].x + ',' + fitted[id].y; }).join(' ');

        if (showArea) {
          const areaHit = createSvg('polygon', { points: pointsText, fill: hexToRgba(state.areaColor || '#2a5bd7', 0.08), stroke: 'none' });
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
          stage.appendChild(areaNode);
        });
        stage.appendChild(createSvg('polygon', { points: pointsText, fill: 'rgba(42,91,215,0.08)', stroke: '#2a5bd7', 'stroke-width': '3', 'stroke-linejoin': 'round' }));

        if (config.drawAuxiliary) {
          config.drawAuxiliary({
            stage: stage,
            createSvg: createSvg,
            createLabelNode: createLabelNode,
            attachHit: attachHit,
            getPointLabel: getPointLabel,
            geometry: geometry,
            screen: fitted,
            center: center,
            fittedCenter: fittedCenter,
            fitPoint: function (point) { return fitPoint(point, view); }
          });
        }

        config.sideIds.forEach(function (id) {
          const a = id[0];
          const b = id[1];
          const hit = createSvg('line', {
            x1: fitted[a].x,
            y1: fitted[a].y,
            x2: fitted[b].x,
            y2: fitted[b].y,
            stroke: 'transparent',
            'stroke-width': '30',
            'stroke-linecap': 'round'
          });
          attachHit(hit, 'side', id);
          stage.appendChild(hit);
          drawSideKind(stage, state.sideKinds[id], fitted[a], fitted[b]);
        });

        (config.extraSegmentIds || []).forEach(function (id) {
          const a = id[0];
          const b = id[1];
          stage.appendChild(createSvg('line', {
            x1: fitted[a].x,
            y1: fitted[a].y,
            x2: fitted[b].x,
            y2: fitted[b].y,
            fill: 'none',
            stroke: '#2a5bd7',
            'stroke-width': '2.4',
            'stroke-linecap': 'round',
            'stroke-dasharray': '8 8'
          }));
          const hit = createSvg('line', {
            x1: fitted[a].x,
            y1: fitted[a].y,
            x2: fitted[b].x,
            y2: fitted[b].y,
            stroke: 'transparent',
            'stroke-width': '30',
            'stroke-linecap': 'round'
          });
          attachHit(hit, 'side', id);
          stage.appendChild(hit);
          drawSideKind(stage, state.sideKinds[id], fitted[a], fitted[b]);
        });

        extraAreas.forEach(function (area) {
          if (!area.points || area.points.length < 3) return;
          const hit = createSvg('polygon', {
            points: area.points.map(function (point) {
              const p = fitPoint(point, view);
              return p.x + ',' + p.y;
            }).join(' '),
            fill: 'rgba(0,0,0,0.001)',
            stroke: 'none'
          });
          attachHit(hit, 'extraArea', area.id);
          stage.appendChild(hit);
        });

        config.pointIds.forEach(function (id, index) {
          const triplet = getAngleTriplet(config, id, index);
          const prev = triplet.prev;
          const next = triplet.next;
          const adjacentLength = geometry.sides[id + next] || geometry.sides[next + id] || segmentLength(geometry.points[id], geometry.points[next]);
          const arc = arcPoints(geometry.points[id], geometry.points[prev], geometry.points[next], pageAngleArcRadius).map(function (point) {
            return fitPoint(point, view);
          });
          const kind = state.angleKinds[id] || 'plain';
          if (kind !== 'hidden') {
            if (kind !== 'right') {
              stage.appendChild(createSvg('path', {
                d: pathFromPoints(arc),
                fill: 'none',
                stroke: '#687086',
                'stroke-width': '2',
                'stroke-linecap': 'round'
              }));
            }
            if (window.InstantGeometryMobileAngleOrnaments) {
              window.InstantGeometryMobileAngleOrnaments.drawAngleKind(stage, kind, arc, fitted[id], fittedCenter, createSvg, {
                p1: fitted[prev],
                p2: fitted[next]
              });
            }
          }
          const hitArc = arcPoints(geometry.points[id], geometry.points[prev], geometry.points[next], Math.max(0.72, adjacentLength * 0.16)).map(function (point) {
            return fitPoint(point, view);
          });
          const hit = createSvg('path', { d: sectorPath(fitted[id], hitArc), fill: 'transparent', stroke: 'none' });
          attachHit(hit, 'angle', id);
          stage.appendChild(hit);
        });

        extraAngles.forEach(function (angle) {
          const adjacentLength = Math.min(segmentLength(angle.vertex, angle.p1), segmentLength(angle.vertex, angle.p2));
          const arc = arcPoints(angle.vertex, angle.p1, angle.p2, pageAngleArcRadius).map(function (point) {
            return fitPoint(point, view);
          });
          const vertex = fitPoint(angle.vertex, view);
          const kind = state.extraAngleKinds[angle.id] || 'plain';
          if (kind !== 'hidden') {
            if (kind !== 'right') {
              stage.appendChild(createSvg('path', {
                d: pathFromPoints(arc),
                fill: 'none',
                stroke: '#687086',
                'stroke-width': '2',
                'stroke-linecap': 'round'
              }));
            }
            if (window.InstantGeometryMobileAngleOrnaments) {
              window.InstantGeometryMobileAngleOrnaments.drawAngleKind(stage, kind, arc, vertex, fittedCenter, createSvg, {
                p1: fitPoint(angle.p1, view),
                p2: fitPoint(angle.p2, view)
              });
            }
          }
          const hitArc = arcPoints(angle.vertex, angle.p1, angle.p2, Math.max(0.72, adjacentLength * 0.16)).map(function (point) {
            return fitPoint(point, view);
          });
          const hit = createSvg('path', { d: sectorPath(vertex, hitArc), fill: 'transparent', stroke: 'none' });
          attachHit(hit, 'extraAngle', angle.id);
          stage.appendChild(hit);
        });

        config.pointIds.forEach(function (id) {
          const dot = createSvg('circle', { cx: fitted[id].x, cy: fitted[id].y, r: 8, fill: '#1f2430' });
          attachHit(dot, 'point', id);
          stage.appendChild(dot);
        });

        extraAngles.forEach(function (angle) {
          const label = getExtraAngleLabel(angle);
          if (!label) return;
          const basePos = angle.labelPoint
            ? fitPoint(angle.labelPoint, view)
            : fitPoint(interiorLabel(angle.vertex, center, angle.labelRate || 0.34), view);
          const pos = getLabelPosition('extraAngle', angle.id, basePos);
          const fontSize = scaledFontSize('extraAngle', angle.id, 42);
          const text = createLabelNode(label, { x: pos.x, y: pos.y, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': fontSize, 'font-weight': '700', fill: '#687086', 'data-label-kind': 'angle', 'data-label-role': 'extraAngle', 'data-label-id': angle.id });
          attachHit(text, 'extraAngle', angle.id);
          stage.appendChild(text);
        });

        config.pointIds.forEach(function (id) {
          const label = getPointLabel(id);
          if (!label) return;
          const pos = getLabelPosition('point', id, fitPoint(interiorLabel(geometry.points[id], center, -0.16), view));
          const fontSize = scaledFontSize('point', id, 58);
          const text = createLabelNode(label, { x: pos.x, y: pos.y, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': fontSize, 'font-weight': '700', fill: '#1f2430', 'data-label-kind': 'point', 'data-label-id': id });
          attachHit(text, 'point', id);
          stage.appendChild(text);
        });

        config.sideIds.forEach(function (id) {
          const label = getSideLabel(id);
          if (!label) return;
          const a = id[0];
          const b = id[1];
          const pos = getLabelPosition('side', id, fitPoint(normalOffset(geometry.points[a], geometry.points[b], center, Math.max(0.5, geometry.sides[id] * 0.1)), view));
          if (state.sideArcVisible[id] !== false) {
            const geom = sideArcGeometry(fitted[a], fitted[b], fittedCenter, pos);
            stage.appendChild(createSvg('path', {
              d: quadraticPathSegment(fitted[a], geom.control, fitted[b], 0, 0.5 - geom.gapHalf, 20),
              fill: 'none',
              stroke: '#2a5bd7',
              'stroke-width': '2',
              'stroke-linecap': 'round',
              'stroke-dasharray': '6 5'
            }));
            stage.appendChild(createSvg('path', {
              d: quadraticPathSegment(fitted[a], geom.control, fitted[b], 0.5 + geom.gapHalf, 1, 20),
              fill: 'none',
              stroke: '#2a5bd7',
              'stroke-width': '2',
              'stroke-linecap': 'round',
              'stroke-dasharray': '6 5'
            }));
          }
          const fontSize = scaledFontSize('side', id, 48);
          const text = createLabelNode(label, { x: pos.x, y: pos.y, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': fontSize, 'font-weight': '700', fill: '#2a5bd7', 'data-label-kind': 'segment', 'data-label-role': 'side', 'data-label-id': id });
          attachHit(text, 'side', id);
          stage.appendChild(text);
        });

        (config.extraSegmentIds || []).forEach(function (id) {
          const label = getSideLabel(id);
          if (!label) return;
          const a = id[0];
          const b = id[1];
          const pos = getLabelPosition('side', id, fitPoint(normalOffset(geometry.points[a], geometry.points[b], center, Math.max(0.5, geometry.sides[id] * 0.07)), view));
          if (state.sideArcVisible[id] !== false) {
            const geom = sideArcGeometry(fitted[a], fitted[b], fittedCenter, pos);
            stage.appendChild(createSvg('path', {
              d: quadraticPathSegment(fitted[a], geom.control, fitted[b], 0, 0.5 - geom.gapHalf, 20),
              fill: 'none',
              stroke: '#2a5bd7',
              'stroke-width': '2',
              'stroke-linecap': 'round',
              'stroke-dasharray': '6 5'
            }));
            stage.appendChild(createSvg('path', {
              d: quadraticPathSegment(fitted[a], geom.control, fitted[b], 0.5 + geom.gapHalf, 1, 20),
              fill: 'none',
              stroke: '#2a5bd7',
              'stroke-width': '2',
              'stroke-linecap': 'round',
              'stroke-dasharray': '6 5'
            }));
          }
          const fontSize = scaledFontSize('side', id, 48);
          const text = createLabelNode(label, { x: pos.x, y: pos.y, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': fontSize, 'font-weight': '700', fill: '#2a5bd7', 'data-label-kind': 'segment', 'data-label-role': 'side', 'data-label-id': id });
          attachHit(text, 'side', id);
          stage.appendChild(text);
        });

        config.pointIds.forEach(function (id) {
          const label = getAngleLabel(id);
          if (!label) return;
          const pos = getLabelPosition('angle', id, fitPoint(interiorLabel(geometry.points[id], center, 0.34), view));
          const fontSize = scaledFontSize('angle', id, 42);
          const text = createLabelNode(label, { x: pos.x, y: pos.y, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': fontSize, 'font-weight': '700', fill: '#687086', 'data-label-kind': 'angle', 'data-label-id': id });
          attachHit(text, 'angle', id);
          stage.appendChild(text);
        });

        const area = showArea ? getAreaLabel() : null;
        if (area) {
          const areaFit = fittedAreaLabel(getDrawOrder(config).map(function (id) { return fitted[id]; }), area, 54);
          const areaPos = getLabelPosition('area', 'main', areaFit);
          const fontSize = scaledFontSize('area', 'main', areaFit.fontSize);
          const text = createLabelNode(area, { x: areaPos.x, y: areaPos.y, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': fontSize, style: 'font-size:' + fontSize + 'px', 'font-weight': '700', fill: areaLabelColor(state.areaColor || '#2a5bd7'), 'data-label-kind': 'area', 'data-label-id': 'main' });
          attachHit(text, 'area', 'main');
          stage.appendChild(text);
        }
        extraAreas.forEach(function (extraArea) {
          const label = getExtraAreaLabel(extraArea);
          if (!label) return;
          const color = state.extraAreaColors[extraArea.id] || extraArea.color || state.areaColor || '#2a5bd7';
          const pos = getLabelPosition('extraArea', extraArea.id, fittedAreaLabel(extraArea.points.map(function (point) { return fitPoint(point, view); }), label, 54));
          const fontSize = scaledFontSize('extraArea', extraArea.id, pos.fontSize);
          const text = createLabelNode(label, {
            x: pos.x,
            y: pos.y,
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            'font-size': fontSize,
            style: 'font-size:' + fontSize + 'px',
            'font-weight': '700',
            fill: areaLabelColor(color),
            'data-label-kind': 'area',
            'data-label-role': 'extraArea',
            'data-label-id': extraArea.id
          });
          attachHit(text, 'extraArea', extraArea.id);
          stage.appendChild(text);
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
    backBtn.addEventListener('click', function () {
      if (window.history.length > 1) {
        window.history.back();
        return;
      }
      const target = new URL('/draw/', window.location.origin);
      const lang = new URL(window.location.href).searchParams.get('lang');
      if (lang) target.searchParams.set('lang', lang);
      window.location.href = target.toString();
    });
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

    render();
  }

  window.InstantGeometryPolygonMobile = {
    createPage: createPage,
    helpers: {
      parsePositiveNumber: parsePositiveNumber,
      formatNumber: formatNumber
    }
  };
})();
