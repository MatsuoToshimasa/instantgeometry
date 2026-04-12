(function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const exportAspects = [
    { label: '1:1', value: 1 },
    { label: '1:√2', value: 1 / Math.SQRT2 },
    { label: '√2:1', value: Math.SQRT2 }
  ];

  const inputElements = Array.from(document.querySelectorAll('[data-parallel-input]')).reduce(function (acc, element) {
    acc[element.id] = element;
    return acc;
  }, {});

  const statusBox = document.getElementById('statusBox');
  const generalLabelToggleGrid = document.getElementById('generalLabelToggleGrid');
  const specialLabelToggleGrid = document.getElementById('specialLabelToggleGrid');
  const leftDock = document.getElementById('leftDock');
  const rightDock = document.getElementById('rightDock');
  const leftToggle = document.getElementById('dockToggleBtn');
  const rightToggle = document.getElementById('rightDockToggleBtn');
  const ratioBtn = document.getElementById('ratioBtn');
  const resetBtn = document.getElementById('resetBtn');
  const angleModeBtn = document.getElementById('angleModeBtn');
  const pageBackBtn = document.getElementById('pageBackBtn');
  const downloadButtons = document.querySelectorAll('[data-download-format]');
  const box = document.getElementById('box');
  const exportBackdrop = document.getElementById('exportBackdrop');
  const exportFrame = document.getElementById('exportFrame');

  const generalConfigs = [
    { type: 'point', id: 'A' },
    { type: 'point', id: 'B' },
    { type: 'point', id: 'M' },
    { type: 'segment', id: 'PQ' },
    { type: 'segment', id: 'RS' },
    { type: 'segment', id: 'AM' },
    { type: 'segment', id: 'BM' },
    { type: 'angle', id: 'PAM' },
    { type: 'angle', id: 'QAM' },
    { type: 'angle', id: 'AMB' },
    { type: 'angle', id: 'RBM' },
    { type: 'angle', id: 'SBM' }
  ];

  const labelState = {
    point: { A: true, B: true, M: true },
    segment: { PQ: true, RS: true, AM: true, BM: true },
    angle: { PAM: false, QAM: false, AMB: false, RBM: false, SBM: false }
  };

  let svg = null;
  let exportAspectIndex = 0;
  let angleMode = 'degrees';
  let isDockCollapsed = false;
  let isRightDockCollapsed = false;

  function setStatus(message, isError) {
    statusBox.textContent = message;
    statusBox.classList.toggle('error', !!isError);
  }
  function updateRatioButton() {
    ratioBtn.textContent = '画面比 ' + exportAspects[exportAspectIndex].label;
  }
  function updateAngleModeButton() {
    angleModeBtn.textContent = angleMode === 'degrees' ? '度数法' : '弧度法';
  }
  function updateDockToggleButtons() {
    leftToggle.textContent = isDockCollapsed ? '›' : '‹';
    leftToggle.setAttribute('aria-expanded', String(!isDockCollapsed));
    rightToggle.textContent = isRightDockCollapsed ? '‹' : '›';
    rightToggle.setAttribute('aria-expanded', String(!isRightDockCollapsed));
  }

  function evaluateExpression(raw) {
    const normalized = String(raw || '').trim().replace(/\s+/g, '').replace(/π/g, 'pi').replace(/√/g, 'sqrt').replace(/(\d+(?:\.\d+)?)deg\b/gi, 'deg($1)');
    if (!normalized) throw new Error('値を入力してください。');
    if (!/^[0-9+\-*/().,a-zA-Z]+$/.test(normalized)) throw new Error('使用できない文字が含まれています。');
    const scope = { pi: Math.PI, e: Math.E, sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, deg: function (value) { return value * Math.PI / 180; } };
    try {
      const value = Function('s', '"use strict";const {pi,e,sqrt,sin,cos,tan,deg}=s;return (' + normalized + ');')(scope);
      if (!Number.isFinite(value)) throw new Error('値を入力してください。');
      return value;
    } catch (_) {
      throw new Error('式を読み取れませんでした。');
    }
  }

  function parseAngle(raw, label) {
    const value = evaluateExpression(raw);
    if (!(value > 0 && value < 180)) throw new Error(label + 'は 0° より大きく 180° 未満で入力してください。');
    return value;
  }

  function formatNumber(value) {
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  }

  function getToggleLabel(config) {
    if (config.type === 'point') return config.id;
    if (config.type === 'segment') return config.id;
    return '∠' + config.id;
  }

  function renderLabelToggleButtons() {
    generalLabelToggleGrid.innerHTML = '';
    specialLabelToggleGrid.innerHTML = '';
    generalConfigs.forEach(function (config) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'download-btn btn-bd';
      if (!labelState[config.type][config.id]) button.style.opacity = '0.55';
      button.textContent = getToggleLabel(config);
      button.setAttribute('aria-pressed', String(!!labelState[config.type][config.id]));
      button.addEventListener('click', function () {
        labelState[config.type][config.id] = !labelState[config.type][config.id];
        render();
        renderLabelToggleButtons();
      });
      generalLabelToggleGrid.appendChild(button);
    });
  }

  function getGeometry() {
    const topY = 1;
    const bottomY = -1;
    const leftX = -7;
    const rightX = 7;
    const aX = evaluateExpression(inputElements.aPos.value);
    const bX = evaluateExpression(inputElements.bPos.value);
    const theta1Deg = parseAngle(inputElements.theta1.value, 'θ1');
    const theta2Deg = parseAngle(inputElements.theta2.value, 'θ2');
    if (!(aX > leftX && aX < rightX)) throw new Error('点Aの位置は上の線分の内部にしてください。');
    if (!(bX > leftX && bX < rightX)) throw new Error('点Bの位置は下の線分の内部にしてください。');
    const A = { x: aX, y: topY };
    const B = { x: bX, y: bottomY };
    const dirA = { x: Math.cos(theta1Deg * Math.PI / 180), y: -Math.sin(theta1Deg * Math.PI / 180) };
    const dirB = { x: -Math.cos(theta2Deg * Math.PI / 180), y: Math.sin(theta2Deg * Math.PI / 180) };
    const denominator = dirA.x * dirB.y - dirA.y * dirB.x;
    if (Math.abs(denominator) < 1e-9) throw new Error('AM と BM が交わりません。');
    const diff = { x: B.x - A.x, y: B.y - A.y };
    const t = (diff.x * dirB.y - diff.y * dirB.x) / denominator;
    const u = (diff.x * dirA.y - diff.y * dirA.x) / denominator;
    if (!(t > 0 && u > 0)) throw new Error('指定した値では、M が平行線の間にできません。');
    const M = { x: A.x + dirA.x * t, y: A.y + dirA.y * t };
    if (!(M.y < topY && M.y > bottomY)) throw new Error('指定した値では、M が平行線の間にできません。');
    return {
      points: {
        P: { x: leftX, y: topY },
        Q: { x: rightX, y: topY },
        R: { x: leftX, y: bottomY },
        S: { x: rightX, y: bottomY },
        A: A,
        B: B,
        M: M
      }
    };
  }

  function getBounds(points) {
    const values = Object.keys(points).map(function (key) { return points[key]; });
    const xs = values.map(function (p) { return p.x; });
    const ys = values.map(function (p) { return p.y; });
    return {
      minX: Math.min.apply(null, xs),
      maxX: Math.max.apply(null, xs),
      minY: Math.min.apply(null, ys),
      maxY: Math.max.apply(null, ys)
    };
  }

  function fitViewBox(geometry) {
    const bounds = getBounds(geometry.points);
    const width = Math.max(1, bounds.maxX - bounds.minX);
    const height = Math.max(1, bounds.maxY - bounds.minY);
    const padding = Math.max(width, height) * 0.2;
    const aspect = exportAspects[exportAspectIndex].value;
    let viewWidth = width + padding * 2;
    let viewHeight = height + padding * 2;
    if (viewWidth / viewHeight < aspect) viewWidth = viewHeight * aspect;
    else viewHeight = viewWidth / aspect;
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;
    return {
      x: cx - viewWidth / 2,
      y: cy - viewHeight / 2,
      width: viewWidth,
      height: viewHeight
    };
  }

  function createSvgElement(tag, attrs) {
    const element = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs).forEach(function (key) { element.setAttribute(key, String(attrs[key])); });
    return element;
  }

  function clearBox() {
    box.innerHTML = '';
    svg = createSvgElement('svg', { width: '100%', height: '100%', viewBox: '0 0 100 100', preserveAspectRatio: 'xMidYMid meet' });
    box.appendChild(svg);
  }

  function drawSegment(p1, p2, color, width, dash) {
    const attrs = { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', fill: 'none' };
    if (dash) attrs['stroke-dasharray'] = dash;
    svg.appendChild(createSvgElement('line', attrs));
  }

  function drawPoint(p, color) {
    svg.appendChild(createSvgElement('circle', { cx: p.x, cy: p.y, r: 0.06, fill: color }));
  }

  function drawText(p, text, color, size) {
    const node = createSvgElement('text', { x: p.x, y: p.y, fill: color, 'font-size': size, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-family': '"Times New Roman", serif' });
    node.textContent = text;
    svg.appendChild(node);
  }

  function midpoint(p1, p2) {
    return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  }

  function offsetPoint(p1, p2, magnitude) {
    const mid = midpoint(p1, p2);
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: mid.x - dy / len * magnitude, y: mid.y + dx / len * magnitude };
  }

  function drawSegmentLabel(id, geometry) {
    const map = { PQ: ['P', 'Q'], RS: ['R', 'S'], AM: ['A', 'M'], BM: ['B', 'M'] };
    const ends = map[id];
    const p1 = geometry.points[ends[0]];
    const p2 = geometry.points[ends[1]];
    const labelPoint = offsetPoint(p1, p2, id === 'PQ' ? 0.18 : (id === 'RS' ? -0.18 : 0.18));
    const length = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const text = formatNumber(length);
    const control = offsetPoint(p1, p2, id === 'PQ' ? 0.28 : (id === 'RS' ? -0.28 : 0.28));
    const path = createSvgElement('path', {
      d: 'M ' + p1.x + ' ' + p1.y + ' Q ' + control.x + ' ' + control.y + ' ' + p2.x + ' ' + p2.y,
      stroke: '#2a5bd7',
      'stroke-width': 0.03,
      'stroke-dasharray': '0.15 0.1',
      fill: 'none'
    });
    svg.appendChild(path);
    drawText(labelPoint, text, '#2a5bd7', '0.34');
  }

  function angleValue(a, b, c) {
    const v1x = a.x - b.x;
    const v1y = a.y - b.y;
    const v2x = c.x - b.x;
    const v2y = c.y - b.y;
    const len1 = Math.hypot(v1x, v1y) || 1;
    const len2 = Math.hypot(v2x, v2y) || 1;
    const dot = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (len1 * len2)));
    return Math.acos(dot) * 180 / Math.PI;
  }

  function arcPath(vertex, p1, p2, radius) {
    const a1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
    const a2 = Math.atan2(p2.y - vertex.y, p2.x - vertex.x);
    let delta = a2 - a1;
    while (delta <= -Math.PI) delta += Math.PI * 2;
    while (delta > Math.PI) delta -= Math.PI * 2;
    const start = { x: vertex.x + radius * Math.cos(a1), y: vertex.y + radius * Math.sin(a1) };
    const end = { x: vertex.x + radius * Math.cos(a1 + delta), y: vertex.y + radius * Math.sin(a1 + delta) };
    const largeArc = Math.abs(delta) > Math.PI ? 1 : 0;
    const sweep = delta > 0 ? 1 : 0;
    return {
      d: 'M ' + start.x + ' ' + start.y + ' A ' + radius + ' ' + radius + ' 0 ' + largeArc + ' ' + sweep + ' ' + end.x + ' ' + end.y,
      midAngle: a1 + delta / 2
    };
  }

  function drawAngleLabel(id, geometry) {
    const anglePointMap = {
      PAM: ['P', 'A', 'M'],
      QAM: ['Q', 'A', 'M'],
      AMB: ['A', 'M', 'B'],
      RBM: ['R', 'B', 'M'],
      SBM: ['S', 'B', 'M']
    };
    const ids = anglePointMap[id];
    const p1 = geometry.points[ids[0]];
    const vertex = geometry.points[ids[1]];
    const p2 = geometry.points[ids[2]];
    const arc = arcPath(vertex, p1, p2, 0.35);
    svg.appendChild(createSvgElement('path', { d: arc.d, stroke: '#687086', 'stroke-width': 0.04, fill: 'none' }));
    const degrees = angleValue(p1, vertex, p2);
    const text = angleMode === 'degrees' ? (formatNumber(degrees) + '°') : formatNumber(degrees * Math.PI / 180);
    drawText({ x: vertex.x + 0.52 * Math.cos(arc.midAngle), y: vertex.y + 0.52 * Math.sin(arc.midAngle) }, text, '#687086', '0.3');
  }

  function updateExportFrame() {
    const rect = box.getBoundingClientRect();
    const aspect = exportAspects[exportAspectIndex].value;
    const margin = Math.min(56, rect.width * 0.06, rect.height * 0.06);
    let width = rect.width - margin * 2;
    let height = width / aspect;
    if (height > rect.height - margin * 2) {
      height = rect.height - margin * 2;
      width = height * aspect;
    }
    exportFrame.style.width = Math.max(120, width) + 'px';
    exportFrame.style.height = Math.max(120, height) + 'px';
    const left = (rect.width - width) / 2;
    const top = (rect.height - height) / 2;
    const right = left + width;
    const bottom = top + height;
    exportBackdrop.style.setProperty('--frame-left', left + 'px');
    exportBackdrop.style.setProperty('--frame-top', top + 'px');
    exportBackdrop.style.setProperty('--frame-right', right + 'px');
    exportBackdrop.style.setProperty('--frame-bottom', bottom + 'px');
  }

  function cropCanvasToFrame(canvas) {
    const rect = box.getBoundingClientRect();
    const frameRect = exportFrame.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const sx = Math.round((frameRect.left - rect.left) * scaleX);
    const sy = Math.round((frameRect.top - rect.top) * scaleY);
    const sw = Math.round(frameRect.width * scaleX);
    const sh = Math.round(frameRect.height * scaleY);
    const cropped = document.createElement('canvas');
    cropped.width = sw;
    cropped.height = sh;
    cropped.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
    return cropped;
  }

  async function handleDownload(format) {
    updateExportFrame();
    setStatus((format === 'pdf' ? 'PDF' : '画像') + ' を出力しています。', false);
    try {
      const canvas = await html2canvas(box, { backgroundColor: format === 'png-transparent' ? null : '#ffffff', scale: 2, useCORS: true });
      const cropped = cropCanvasToFrame(canvas);
      if (format === 'pdf') {
        const pdf = new window.jspdf.jsPDF({ orientation: cropped.width >= cropped.height ? 'landscape' : 'portrait', unit: 'px', format: [cropped.width, cropped.height] });
        pdf.addImage(cropped.toDataURL('image/png'), 'PNG', 0, 0, cropped.width, cropped.height);
        pdf.save('parallel-lines-angle.pdf');
      } else {
        const link = document.createElement('a');
        link.href = cropped.toDataURL('image/png');
        link.download = format === 'png-transparent' ? 'parallel-lines-angle-transparent.png' : 'parallel-lines-angle.png';
        link.click();
      }
      setStatus('保存しました。', false);
    } catch (_) {
      setStatus('ダウンロードに失敗しました。', true);
    }
  }

  function render() {
    clearBox();
    try {
      const geometry = getGeometry();
      const view = fitViewBox(geometry);
      svg.setAttribute('viewBox', [view.x, view.y, view.width, view.height].join(' '));
      updateExportFrame();

      drawSegment(geometry.points.P, geometry.points.Q, '#2a5bd7', 0.05);
      drawSegment(geometry.points.R, geometry.points.S, '#2a5bd7', 0.05);
      drawSegment(geometry.points.A, geometry.points.M, '#2a5bd7', 0.05);
      drawSegment(geometry.points.B, geometry.points.M, '#2a5bd7', 0.05);
      drawPoint(geometry.points.A, '#111111');
      drawPoint(geometry.points.B, '#111111');
      drawPoint(geometry.points.M, '#111111');

      if (labelState.point.A) drawText({ x: geometry.points.A.x - 0.22, y: geometry.points.A.y + 0.24 }, 'A', '#1f2430', '0.34');
      if (labelState.point.B) drawText({ x: geometry.points.B.x + 0.22, y: geometry.points.B.y - 0.24 }, 'B', '#1f2430', '0.34');
      if (labelState.point.M) drawText({ x: geometry.points.M.x + 0.22, y: geometry.points.M.y + 0.24 }, 'M', '#1f2430', '0.34');

      ['PQ', 'RS', 'AM', 'BM'].forEach(function (id) {
        if (labelState.segment[id]) drawSegmentLabel(id, geometry);
      });
      ['PAM', 'QAM', 'AMB', 'RBM', 'SBM'].forEach(function (id) {
        if (labelState.angle[id]) drawAngleLabel(id, geometry);
      });

      setStatus('図形を描画しました。', false);
    } catch (error) {
      const fallback = {
        points: {
          P: { x: -7, y: 1 },
          Q: { x: 7, y: 1 },
          R: { x: -7, y: -1 },
          S: { x: 7, y: -1 }
        }
      };
      svg.setAttribute('viewBox', [-8, -3, 16, 6].join(' '));
      updateExportFrame();
      drawSegment(fallback.points.P, fallback.points.Q, '#2a5bd7', 0.05);
      drawSegment(fallback.points.R, fallback.points.S, '#2a5bd7', 0.05);
      setStatus(error.message || '描画に失敗しました。', true);
    }
  }

  leftToggle.addEventListener('click', function () {
    isDockCollapsed = !isDockCollapsed;
    leftDock.classList.toggle('is-collapsed', isDockCollapsed);
    updateDockToggleButtons();
  });
  rightToggle.addEventListener('click', function () {
    isRightDockCollapsed = !isRightDockCollapsed;
    rightDock.classList.toggle('is-collapsed', isRightDockCollapsed);
    updateDockToggleButtons();
  });
  ratioBtn.addEventListener('click', function () {
    exportAspectIndex = (exportAspectIndex + 1) % exportAspects.length;
    updateRatioButton();
    render();
  });
  angleModeBtn.addEventListener('click', function () {
    angleMode = angleMode === 'degrees' ? 'radians' : 'degrees';
    updateAngleModeButton();
    render();
  });
  resetBtn.addEventListener('click', function () {
    inputElements.aPos.value = '-2.5';
    inputElements.bPos.value = '2.5';
    inputElements.theta1.value = '20';
    inputElements.theta2.value = '30';
    labelState.point = { A: true, B: true, M: true };
    labelState.segment = { PQ: true, RS: true, AM: true, BM: true };
    labelState.angle = { PAM: false, QAM: false, AMB: false, RBM: false, SBM: false };
    exportAspectIndex = 0;
    angleMode = 'degrees';
    updateRatioButton();
    updateAngleModeButton();
    renderLabelToggleButtons();
    render();
  });
  pageBackBtn.addEventListener('click', function () {
    window.history.back();
  });
  Object.keys(inputElements).forEach(function (id) {
    inputElements[id].addEventListener('input', render);
  });
  downloadButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      handleDownload(button.dataset.downloadFormat);
    });
  });
  window.addEventListener('resize', render);

  updateRatioButton();
  updateAngleModeButton();
  updateDockToggleButtons();
  renderLabelToggleButtons();
  render();
})();
