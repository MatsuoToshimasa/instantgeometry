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
  const labelLayer = document.getElementById('labelLayer');
  const exportBackdrop = document.getElementById('exportBackdrop');
  const exportFrame = document.getElementById('exportFrame');

  const generalConfigs = [
    { type: 'point', id: 'P' },
    { type: 'point', id: 'Q' },
    { type: 'point', id: 'R' },
    { type: 'point', id: 'S' },
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
    point: { P: false, Q: false, R: false, S: false, A: false, B: false, M: false },
    segment: { PQ: false, RS: false, AM: false, BM: false },
    angle: { PAM: false, QAM: true, AMB: true, RBM: false, SBM: true }
  };
  const customLabelText = {
    point: { P: '', Q: '', R: '', S: '', A: '', B: '', M: '' },
    segment: { PQ: '', RS: '', AM: '', BM: '' },
    angle: { PAM: '', QAM: '', AMB: '', RBM: '', SBM: '' }
  };
  const segmentLineMode = { PQ: 1, RS: 1, AM: 1, BM: 1 };
  const segmentArcMode = { PQ: 1, RS: 1, AM: 1, BM: 1 };
  const angleMarkerMode = { PAM: 0, QAM: 0, AMB: 0, RBM: 0, SBM: 0 };

  let svg = null;
  let currentView = null;
  let currentGeometry = null;
  let exportAspectIndex = 0;
  let angleMode = 'degrees';
  let isDockCollapsed = false;
  let isRightDockCollapsed = false;
  let selectedLabel = null;
  let paletteOpen = false;
  let dragState = null;
  let labelNodes = {};

  const labelStyles = {
    point: {},
    segment: {},
    angle: {}
  };

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
      if (config.type === 'point') {
        button.addEventListener('contextmenu', async function (event) {
          event.preventDefault();
          const response = await window.InstantGeometrySharedLabelConfig.promptSingleText({
            title: '点ラベル設定',
            firstLabel: '文字',
            value: customLabelText.point[config.id] || config.id
          });
          if (response === null) return;
          customLabelText.point[config.id] = String(response || '').trim();
          render();
          renderLabelToggleButtons();
        });
      } else if (config.type === 'segment') {
        button.addEventListener('contextmenu', async function (event) {
          event.preventDefault();
          const response = await window.InstantGeometrySharedLabelConfig.promptTripleSetting({
            title: '線分ラベル設定',
            firstLabel: '線分表示（0:線分を非表示 / 1:線分を表示）',
            firstValue: String(segmentLineMode[config.id]),
            secondLabel: '弧表示（0:弧を非表示 / 1:弧を表示）',
            secondValue: String(segmentArcMode[config.id]),
            thirdLabel: '文字（空欄で数値表示）',
            thirdValue: customLabelText.segment[config.id] || '',
            firstBinary: true,
            secondBinary: true
          });
          if (response === null) return;
          const lineMode = window.InstantGeometrySharedOrnaments.normalizeSegmentArcInput(response.first);
          const arcMode = window.InstantGeometrySharedOrnaments.normalizeSegmentArcInput(response.second);
          if (lineMode === null || arcMode === null) {
            setStatus('線分表示と弧表示は「0 / 1」で指定してください。', true);
            return;
          }
          segmentLineMode[config.id] = lineMode;
          segmentArcMode[config.id] = arcMode;
          customLabelText.segment[config.id] = String(response.third || '').trim();
          render();
        });
      } else if (config.type === 'angle') {
        button.addEventListener('contextmenu', async function (event) {
          event.preventDefault();
          const response = await window.InstantGeometrySharedLabelConfig.promptTripleSetting({
            title: '角ラベル設定',
            firstLabel: '角マーク（0:なし / 1:記号なし / 2:○ / 3:| / 4:= / 5:× / 6:△ / 7:塗）',
            firstValue: String(angleMarkerMode[config.id] || 0),
            secondLabel: '文字（空欄で数値表示）',
            secondValue: customLabelText.angle[config.id] || '',
            thirdLabel: '直角マーク（0:非表示 / 1:表示）',
            thirdValue: '90°以外は設定不可',
            thirdDisabled: true
          });
          if (response === null) return;
          const mode = normalizeAngleMarkerInput(response.first);
          if (mode === null) {
            setStatus('角マークは「0 / 1 / 2 / 3 / 4 / 5 / 6 / 7」で指定してください。', true);
            return;
          }
          angleMarkerMode[config.id] = mode;
          customLabelText.angle[config.id] = String(response.second || '').trim();
          render();
        });
      }
      generalLabelToggleGrid.appendChild(button);
    });
  }

  function normalizeAngleMarkerInput(input) {
    const value = String(input || '').trim();
    if (value === '') return 0;
    if (/^[0-7]$/.test(value)) return Number(value);
    return null;
  }

  function getPointLabelText(id) {
    return String(customLabelText.point[id] || '').trim() || id;
  }

  function getSegmentLabelText(id, geometry) {
    const custom = String(customLabelText.segment[id] || '').trim();
    if (custom) return custom;
    const map = { PQ: ['P', 'Q'], RS: ['R', 'S'], AM: ['A', 'M'], BM: ['B', 'M'] };
    const ends = map[id];
    const p1 = geometry.points[ends[0]];
    const p2 = geometry.points[ends[1]];
    return formatNumber(Math.hypot(p2.x - p1.x, p2.y - p1.y));
  }

  function getAngleLabelText(id, geometry) {
    const custom = window.InstantGeometrySharedLabelConfig.normalizeCustomLabelInput(customLabelText.angle[id]);
    if (custom) return window.InstantGeometrySharedLabelConfig.formatAngleCustomText(custom, angleMode);
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
    const degrees = angleValue(p1, vertex, p2);
    return angleMode === 'degrees' ? (formatNumber(degrees) + '°') : formatNumber(degrees * Math.PI / 180);
  }

  function getGeometry() {
    const upperY = 1;
    const lowerY = -1;
    const lineLength = evaluateExpression(inputElements.lineLength.value);
    if (!(lineLength > 0)) throw new Error('PQ＝RS の長さは 0 より大きくしてください。');
    const paLength = evaluateExpression(inputElements.paLength.value);
    const rbLength = evaluateExpression(inputElements.rbLength.value);
    if (!(paLength >= 0 && paLength <= lineLength)) throw new Error('PA の長さは 0 以上 PQ 以下で入力してください。');
    if (!(rbLength >= 0 && rbLength <= lineLength)) throw new Error('RB の長さは 0 以上 RS 以下で入力してください。');
    const theta1Deg = parseAngle(inputElements.theta1.value, '∠QAM');
    const theta2Deg = parseAngle(inputElements.theta2.value, '∠SBM');
    const leftX = -lineLength / 2;
    const A = { x: leftX + paLength, y: upperY };
    const B = { x: leftX + rbLength, y: lowerY };
    const dirA = { x: Math.cos(theta1Deg * Math.PI / 180), y: -Math.sin(theta1Deg * Math.PI / 180) };
    const dirB = { x: Math.cos(theta2Deg * Math.PI / 180), y: Math.sin(theta2Deg * Math.PI / 180) };
    const denominator = dirA.x * dirB.y - dirA.y * dirB.x;
    if (Math.abs(denominator) < 1e-9) throw new Error('AM と BM が交わりません。');
    const diff = { x: B.x - A.x, y: B.y - A.y };
    const t = (diff.x * dirB.y - diff.y * dirB.x) / denominator;
    const u = (diff.x * dirA.y - diff.y * dirA.x) / denominator;
    if (!(t > 0 && u > 0)) throw new Error('指定した値では、M が平行線の間にできません。');
    const M = { x: A.x + dirA.x * t, y: A.y + dirA.y * t };
    if (!(M.y < upperY && M.y > lowerY)) throw new Error('指定した値では、M が平行線の間にできません。');
    return {
      points: {
        P: { x: leftX, y: upperY },
        Q: { x: lineLength / 2, y: upperY },
        R: { x: leftX, y: lowerY },
        S: { x: lineLength / 2, y: lowerY },
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
    const oldSvg = box.querySelector('svg');
    if (oldSvg) oldSvg.remove();
    labelLayer.innerHTML = '';
    svg = createSvgElement('svg', { width: '100%', height: '100%', viewBox: '0 0 100 100', preserveAspectRatio: 'xMidYMid meet' });
    box.insertBefore(svg, labelLayer);
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

  function getLabelStyle(type, id) {
    if (!labelStyles[type][id]) {
      labelStyles[type][id] = { dx: 0, dy: 0, rotation: 0, scale: 1, color: type === 'point' ? '#1f2430' : (type === 'angle' ? '#687086' : '#2a5bd7') };
    }
    return labelStyles[type][id];
  }

  function userToScreenPoint(point) {
    const rect = box.getBoundingClientRect();
    if (!currentView) return { x: 0, y: 0 };
    return {
      x: ((point.x - currentView.x) / currentView.width) * rect.width,
      y: ((point.y - currentView.y) / currentView.height) * rect.height
    };
  }

  function screenToUserDelta(dx, dy) {
    const rect = box.getBoundingClientRect();
    return {
      x: (dx / Math.max(rect.width, 1)) * currentView.width,
      y: (dy / Math.max(rect.height, 1)) * currentView.height
    };
  }

  function pixelsToUser(pxX, pxY) {
    const rect = box.getBoundingClientRect();
    return {
      x: (pxX / Math.max(rect.width, 1)) * currentView.width,
      y: (pxY / Math.max(rect.height, 1)) * currentView.height
    };
  }

  function createDomLabel(type, id, anchor, text, fontSize) {
    const style = getLabelStyle(type, id);
    const screen = userToScreenPoint(anchor);
    const node = document.createElement('div');
    node.className = 'floating-label';
    node.dataset.type = type;
    node.dataset.id = id;
    if (window.katex && typeof window.katex.render === 'function') {
      try {
        window.katex.render(window.InstantGeometrySharedLabels.toLatexMath(text), node, { throwOnError: false, output: 'html', strict: 'ignore' });
      } catch (_) {
        node.innerHTML = window.InstantGeometrySharedLabels.toMathLikeHtml(text);
      }
    } else {
      node.innerHTML = window.InstantGeometrySharedLabels.toMathLikeHtml(text);
    }
    node.style.left = screen.x + 'px';
    node.style.top = screen.y + 'px';
    node.style.fontSize = fontSize + 'px';
    node.style.color = style.color;
    node.style.transform = 'translate(-50%, -50%) translate(' + style.dx + 'px,' + style.dy + 'px) rotate(' + (-style.rotation) + 'deg) scale(' + style.scale + ')';
    node.addEventListener('pointerdown', handleLabelPointerDown);
    node.addEventListener('wheel', handleLabelWheel, { passive: false });
    labelLayer.appendChild(node);
    labelNodes[type + ':' + id] = { node: node, anchor: anchor, fontSize: fontSize, type: type, id: id };
  }

  function renderSelectionBox() {
    const existing = labelLayer.querySelectorAll('.label-selection-box,.label-handle,.palette-pop');
    existing.forEach(function (node) { node.remove(); });
    if (!selectedLabel) return;
    const ref = labelNodes[selectedLabel.type + ':' + selectedLabel.id];
    if (!ref) {
      selectedLabel = null;
      paletteOpen = false;
      return;
    }
    const rect = ref.node.getBoundingClientRect();
    const layerRect = labelLayer.getBoundingClientRect();
    const boxNode = document.createElement('div');
    boxNode.className = 'label-selection-box';
    boxNode.style.left = (rect.left - layerRect.left - 3) + 'px';
    boxNode.style.top = (rect.top - layerRect.top - 3) + 'px';
    boxNode.style.width = (rect.width + 6) + 'px';
    boxNode.style.height = (rect.height + 6) + 'px';
    labelLayer.appendChild(boxNode);

    function addHandle(name, left, top) {
      const handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'label-handle ' + name;
      handle.dataset.handle = name;
      handle.style.left = left + 'px';
      handle.style.top = top + 'px';
      handle.addEventListener('pointerdown', handleControlPointerDown);
      if (name === 'palette') handle.style.color = getLabelStyle(selectedLabel.type, selectedLabel.id).color;
      labelLayer.appendChild(handle);
      return handle;
    }

    const left = rect.left - layerRect.left - 11;
    const top = rect.top - layerRect.top - 11;
    const right = rect.right - layerRect.left - 11;
    const bottom = rect.bottom - layerRect.top - 11;
    addHandle('palette', left, bottom);
    addHandle('rotate', right, top);
    addHandle('resize', right, bottom);

    if (paletteOpen) {
      const pop = document.createElement('div');
      pop.className = 'palette-pop';
      const cx = left + 11;
      const cy = bottom + 11;
      const colors = ['#1f2430', '#2a5bd7', '#c2410c', '#0f766e', '#7c3aed', '#be123c'];
      colors.forEach(function (color, index) {
        const angle = (Math.PI * 1.2) + (Math.PI * 0.8 * index / Math.max(colors.length - 1, 1));
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.style.background = color;
        btn.style.left = (cx + Math.cos(angle) * 42 - 9) + 'px';
        btn.style.top = (cy + Math.sin(angle) * 42 - 9) + 'px';
        btn.addEventListener('click', function (event) {
          event.stopPropagation();
          getLabelStyle(selectedLabel.type, selectedLabel.id).color = color;
          paletteOpen = false;
          render();
        });
        pop.appendChild(btn);
      });
      labelLayer.appendChild(pop);
    }
  }

  function handleLabelPointerDown(event) {
    event.preventDefault();
    event.stopPropagation();
    selectedLabel = { type: event.currentTarget.dataset.type, id: event.currentTarget.dataset.id };
    paletteOpen = false;
    const style = getLabelStyle(selectedLabel.type, selectedLabel.id);
    dragState = {
      mode: 'move',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseDx: style.dx,
      baseDy: style.dy
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    renderSelectionBox();
  }

  function handleLabelWheel(event) {
    const node = event.currentTarget;
    const style = getLabelStyle(node.dataset.type, node.dataset.id);
    event.preventDefault();
    selectedLabel = { type: node.dataset.type, id: node.dataset.id };
    paletteOpen = false;
    style.scale = Math.max(0.3, Math.min(6, style.scale * (event.deltaY < 0 ? 1.08 : 0.92)));
    render();
  }

  function handleControlPointerDown(event) {
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget.dataset.handle;
    if (!selectedLabel) return;
    const ref = labelNodes[selectedLabel.type + ':' + selectedLabel.id];
    if (!ref) return;
    const style = getLabelStyle(selectedLabel.type, selectedLabel.id);
    const rect = ref.node.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    if (handle === 'palette') {
      paletteOpen = !paletteOpen;
      renderSelectionBox();
      return;
    }
    dragState = {
      mode: handle,
      pointerId: event.pointerId,
      centerX: centerX,
      centerY: centerY,
      startAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX),
      baseRotation: style.rotation,
      startDistance: Math.hypot(event.clientX - centerX, event.clientY - centerY),
      baseScale: style.scale
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleGlobalPointerMove(event) {
    if (!dragState || !selectedLabel) return;
    const style = getLabelStyle(selectedLabel.type, selectedLabel.id);
    if (dragState.mode === 'move') {
      style.dx = dragState.baseDx + (event.clientX - dragState.startX);
      style.dy = dragState.baseDy + (event.clientY - dragState.startY);
    } else if (dragState.mode === 'rotate') {
      const angle = Math.atan2(event.clientY - dragState.centerY, event.clientX - dragState.centerX);
      style.rotation = dragState.baseRotation + ((angle - dragState.startAngle) * 180 / Math.PI);
    } else if (dragState.mode === 'resize') {
      const distance = Math.hypot(event.clientX - dragState.centerX, event.clientY - dragState.centerY);
      const ratio = distance / Math.max(dragState.startDistance, 12);
      style.scale = Math.max(0.3, Math.min(6, dragState.baseScale * ratio));
    }
    render();
  }

  function handleGlobalPointerUp() {
    dragState = null;
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
    const text = getSegmentLabelText(id, geometry);
    const control = offsetPoint(p1, p2, id === 'PQ' ? 0.28 : (id === 'RS' ? -0.28 : 0.28));
    if (segmentArcMode[id]) {
      const path = createSvgElement('path', {
        d: 'M ' + p1.x + ' ' + p1.y + ' Q ' + control.x + ' ' + control.y + ' ' + p2.x + ' ' + p2.y,
        stroke: '#2a5bd7',
        'stroke-width': 0.03,
        'stroke-dasharray': '0.15 0.1',
        fill: 'none'
      });
      svg.appendChild(path);
    }
    createDomLabel('segment', id, labelPoint, text, 28);
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
    const text = getAngleLabelText(id, geometry);
    createDomLabel('angle', id, { x: vertex.x + 0.52 * Math.cos(arc.midAngle), y: vertex.y + 0.52 * Math.sin(arc.midAngle) }, text, 26);
    drawAngleMarker(id, vertex, arc.midAngle);
  }

  function drawAngleMarker(id, vertex, midAngle) {
    const mode = Number.isFinite(angleMarkerMode[id]) ? angleMarkerMode[id] : 0;
    if (mode <= 1) return;
    const cx = vertex.x + 0.34 * Math.cos(midAngle);
    const cy = vertex.y + 0.34 * Math.sin(midAngle);
    const stroke = '#687086';
    if (mode === 2) {
      svg.appendChild(createSvgElement('circle', { cx: cx, cy: cy, r: 0.05, stroke: stroke, 'stroke-width': 0.02, fill: 'none' }));
      return;
    }
    if (mode === 3 || mode === 4) {
      const dx = 0.05 * Math.cos(midAngle + Math.PI / 2);
      const dy = 0.05 * Math.sin(midAngle + Math.PI / 2);
      svg.appendChild(createSvgElement('line', { x1: cx - dx, y1: cy - dy, x2: cx + dx, y2: cy + dy, stroke: stroke, 'stroke-width': 0.02 }));
      if (mode === 4) {
        svg.appendChild(createSvgElement('line', { x1: cx - dx + 0.045 * Math.cos(midAngle), y1: cy - dy + 0.045 * Math.sin(midAngle), x2: cx + dx + 0.045 * Math.cos(midAngle), y2: cy + dy + 0.045 * Math.sin(midAngle), stroke: stroke, 'stroke-width': 0.02 }));
      }
      return;
    }
    if (mode === 5) {
      const dx = 0.045 * Math.cos(midAngle + Math.PI / 4);
      const dy = 0.045 * Math.sin(midAngle + Math.PI / 4);
      svg.appendChild(createSvgElement('line', { x1: cx - dx, y1: cy - dy, x2: cx + dx, y2: cy + dy, stroke: stroke, 'stroke-width': 0.02 }));
      svg.appendChild(createSvgElement('line', { x1: cx - dy, y1: cy + dx, x2: cx + dy, y2: cy - dx, stroke: stroke, 'stroke-width': 0.02 }));
      return;
    }
    if (mode === 6) {
      const r = 0.065;
      const points = [
        [cx, cy - r],
        [cx - r * 0.866, cy + r * 0.5],
        [cx + r * 0.866, cy + r * 0.5]
      ].map(function (point) { return point.join(','); }).join(' ');
      svg.appendChild(createSvgElement('polygon', { points: points, stroke: stroke, 'stroke-width': 0.02, fill: 'none' }));
      return;
    }
    if (mode === 7) {
      const path = arcPath(vertex, { x: vertex.x + 0.2 * Math.cos(midAngle - 0.2), y: vertex.y + 0.2 * Math.sin(midAngle - 0.2) }, { x: vertex.x + 0.2 * Math.cos(midAngle + 0.2), y: vertex.y + 0.2 * Math.sin(midAngle + 0.2) }, 0.2);
      svg.appendChild(createSvgElement('path', { d: path.d + ' L ' + vertex.x + ' ' + vertex.y + ' Z', fill: 'rgba(104,112,134,0.35)', stroke: 'none' }));
    }
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
      currentGeometry = geometry;
      currentView = view;
      svg.setAttribute('viewBox', [view.x, view.y, view.width, view.height].join(' '));
      updateExportFrame();

      if (labelState.segment.PQ || segmentLineMode.PQ) drawSegment(geometry.points.P, geometry.points.Q, '#2a5bd7', 0.05);
      if (labelState.segment.RS || segmentLineMode.RS) drawSegment(geometry.points.R, geometry.points.S, '#2a5bd7', 0.05);
      if (labelState.segment.AM || segmentLineMode.AM) drawSegment(geometry.points.A, geometry.points.M, '#2a5bd7', 0.05);
      if (labelState.segment.BM || segmentLineMode.BM) drawSegment(geometry.points.B, geometry.points.M, '#2a5bd7', 0.05);
      drawPoint(geometry.points.P, '#111111');
      drawPoint(geometry.points.Q, '#111111');
      drawPoint(geometry.points.R, '#111111');
      drawPoint(geometry.points.S, '#111111');
      drawPoint(geometry.points.A, '#111111');
      drawPoint(geometry.points.B, '#111111');
      drawPoint(geometry.points.M, '#111111');

      if (labelState.point.P) {
        const delta = pixelsToUser(-2, 0);
        createDomLabel('point', 'P', { x: geometry.points.P.x + delta.x, y: geometry.points.P.y }, getPointLabelText('P'), 28);
      }
      if (labelState.point.Q) {
        const delta = pixelsToUser(2, 0);
        createDomLabel('point', 'Q', { x: geometry.points.Q.x + delta.x, y: geometry.points.Q.y }, getPointLabelText('Q'), 28);
      }
      if (labelState.point.R) {
        const delta = pixelsToUser(-2, 0);
        createDomLabel('point', 'R', { x: geometry.points.R.x + delta.x, y: geometry.points.R.y }, getPointLabelText('R'), 28);
      }
      if (labelState.point.S) {
        const delta = pixelsToUser(2, 0);
        createDomLabel('point', 'S', { x: geometry.points.S.x + delta.x, y: geometry.points.S.y }, getPointLabelText('S'), 28);
      }
      if (labelState.point.A) createDomLabel('point', 'A', { x: geometry.points.A.x - 0.22, y: geometry.points.A.y + 0.24 }, getPointLabelText('A'), 28);
      if (labelState.point.B) createDomLabel('point', 'B', { x: geometry.points.B.x + 0.22, y: geometry.points.B.y - 0.24 }, getPointLabelText('B'), 28);
      if (labelState.point.M) createDomLabel('point', 'M', { x: geometry.points.M.x + 0.22, y: geometry.points.M.y + 0.24 }, getPointLabelText('M'), 28);

      ['PQ', 'RS', 'AM', 'BM'].forEach(function (id) {
        if (labelState.segment[id]) drawSegmentLabel(id, geometry);
      });
      ['PAM', 'QAM', 'AMB', 'RBM', 'SBM'].forEach(function (id) {
        if (labelState.angle[id]) drawAngleLabel(id, geometry);
      });

      renderSelectionBox();

      setStatus('図形を描画しました。', false);
    } catch (error) {
      currentGeometry = null;
      currentView = null;
      const fallbackLength = Number.isFinite(evaluateExpressionSafe(inputElements.lineLength && inputElements.lineLength.value)) ? evaluateExpressionSafe(inputElements.lineLength.value) : 14;
      const fallback = {
        points: {
          P: { x: -fallbackLength / 2, y: 1 },
          Q: { x: fallbackLength / 2, y: 1 },
          R: { x: -fallbackLength / 2, y: -1 },
          S: { x: fallbackLength / 2, y: -1 }
        }
      };
      const fallbackBounds = getBounds(fallback.points);
      const width = Math.max(16, fallbackBounds.maxX - fallbackBounds.minX + 2);
      const cx = (fallbackBounds.minX + fallbackBounds.maxX) / 2;
      svg.setAttribute('viewBox', [cx - width / 2, -3, width, 6].join(' '));
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
    inputElements.lineLength.value = '14';
    inputElements.paLength.value = '7';
    inputElements.rbLength.value = '7';
    inputElements.theta1.value = '20';
    inputElements.theta2.value = '30';
    labelState.point = { P: false, Q: false, R: false, S: false, A: false, B: false, M: false };
    labelState.segment = { PQ: false, RS: false, AM: false, BM: false };
    labelState.angle = { PAM: false, QAM: true, AMB: true, RBM: false, SBM: true };
    Object.keys(customLabelText.point).forEach(function (key) { customLabelText.point[key] = ''; });
    Object.keys(customLabelText.segment).forEach(function (key) { customLabelText.segment[key] = ''; });
    Object.keys(customLabelText.angle).forEach(function (key) { customLabelText.angle[key] = ''; });
    Object.keys(segmentLineMode).forEach(function (key) { segmentLineMode[key] = 1; });
    Object.keys(segmentArcMode).forEach(function (key) { segmentArcMode[key] = 1; });
      Object.keys(angleMarkerMode).forEach(function (key) { angleMarkerMode[key] = 0; });
      Object.keys(labelStyles.point).forEach(function (key) { delete labelStyles.point[key]; });
      Object.keys(labelStyles.segment).forEach(function (key) { delete labelStyles.segment[key]; });
      Object.keys(labelStyles.angle).forEach(function (key) { delete labelStyles.angle[key]; });
      selectedLabel = null;
      paletteOpen = false;
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
  labelLayer.addEventListener('pointerdown', function (event) {
    if (event.target === labelLayer) {
      selectedLabel = null;
      paletteOpen = false;
      renderSelectionBox();
    }
  });
  box.addEventListener('pointerdown', function (event) {
    if (event.target === box || event.target === svg) {
      selectedLabel = null;
      paletteOpen = false;
      renderSelectionBox();
    }
  });
  window.addEventListener('pointermove', handleGlobalPointerMove);
  window.addEventListener('pointerup', handleGlobalPointerUp);
  window.addEventListener('pointercancel', handleGlobalPointerUp);

  updateRatioButton();
  updateAngleModeButton();
  updateDockToggleButtons();
  renderLabelToggleButtons();
  render();

  function evaluateExpressionSafe(raw) {
    try {
      return evaluateExpression(raw);
    } catch (_) {
      return NaN;
    }
  }
})();
