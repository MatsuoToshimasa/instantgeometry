(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const VIEW_WIDTH = 1200;
  const VIEW_HEIGHT = 800;
  const HANDLE_OFFSET = 18;
  const colorChoices = ['#1f2430', '#2a5bd7', '#687086', '#0f8b6e', '#b42318', '#b06a00'];

  const sideInput = document.getElementById('sideLen');
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
  const unitBtn = document.getElementById('unitBtn');
  const pageBackBtn = document.getElementById('pageBackBtn');
  const downloadButtons = document.querySelectorAll('[data-download-format]');
  const box = document.getElementById('box');
  const exportBackdrop = document.getElementById('exportBackdrop');
  const exportFrame = document.getElementById('exportFrame');

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 ' + VIEW_WIDTH + ' ' + VIEW_HEIGHT);
  svg.setAttribute('aria-label', '正方形のプレビュー');
  svg.style.position = 'absolute';
  svg.style.inset = '0';
  svg.style.width = '100%';
  svg.style.height = '100%';
  svg.style.display = 'block';
  box.appendChild(svg);

  const labelLayer = document.createElement('div');
  labelLayer.id = 'labelLayer';
  labelLayer.setAttribute('aria-hidden', 'true');
  box.appendChild(labelLayer);

  const defaultLabelState = {
    vertex: { A: true, B: true, C: true, D: true },
    side: { AB: true, BC: true, CD: true, DA: true },
    angle: { A: false, B: false, C: false, D: false },
    area: { main: false },
    specialVertex: { O: false },
    diagonal: { AC: false, BD: false }
  };

  const labelState = cloneState(defaultLabelState);

  const labelFontDefaults = {
    vertex: { A: 54, B: 54, C: 54, D: 54 },
    side: { AB: 34, BC: 34, CD: 34, DA: 34 },
    angle: { A: 30, B: 30, C: 30, D: 30 },
    area: { main: 52 },
    specialVertex: { O: 44 },
    diagonal: { AC: 30, BD: 30 }
  };

  const styleDefaults = {
    vertex: { A: style('#1f2430'), B: style('#1f2430'), C: style('#1f2430'), D: style('#1f2430') },
    side: { AB: style('#2a5bd7'), BC: style('#2a5bd7'), CD: style('#2a5bd7'), DA: style('#2a5bd7') },
    angle: { A: style('#687086'), B: style('#687086'), C: style('#687086'), D: style('#687086') },
    area: { main: style('#25603b') },
    specialVertex: { O: style('#1f2430') },
    diagonal: { AC: style('#7d8db8'), BD: style('#7d8db8') }
  };

  const labelFontSize = cloneState(labelFontDefaults);
  const labelStyle = cloneState(styleDefaults);
  const labelPositions = {
    vertex: { A: null, B: null, C: null, D: null },
    side: { AB: null, BC: null, CD: null, DA: null },
    angle: { A: null, B: null, C: null, D: null },
    area: { main: null },
    specialVertex: { O: null },
    diagonal: { AC: null, BD: null }
  };

  const aspectModes = [
    { label: '1:1', ratio: 1 },
    { label: '1:√2', ratio: 1 / Math.SQRT2 },
    { label: '√2:1', ratio: Math.SQRT2 }
  ];
  const unitModes = ['', 'cm', 'm', 'km'];

  let isLeftCollapsed = false;
  let isRightCollapsed = false;
  let aspectIndex = 0;
  let unitIndex = 1;
  let angleMode = 'degrees';
  let currentGeometry = null;
  let selectedLabel = null;
  let dragState = null;
  let selectionEls = { box: null, rotate: null, palette: null, scale: null, pop: null };

  function style(color) {
    return { color: color, rotation: 0 };
  }

  function cloneState(source) {
    return JSON.parse(JSON.stringify(source));
  }

  function setStatus(message, isError) {
    statusBox.textContent = message;
    statusBox.classList.toggle('error', !!isError);
  }

  function updateRatioButton() {
    ratioBtn.textContent = '画面比 ' + aspectModes[aspectIndex].label;
  }

  function updateUnitButton() {
    unitBtn.textContent = unitModes[unitIndex] ? '長さ' + unitModes[unitIndex] : '単位なし';
  }

  function updateAngleModeButton() {
    angleModeBtn.textContent = angleMode === 'degrees' ? '度数法' : '弧度法';
  }

  function syncDockButtons() {
    leftToggle.textContent = isLeftCollapsed ? '›' : '‹';
    leftToggle.setAttribute('aria-expanded', String(!isLeftCollapsed));
    rightToggle.textContent = isRightCollapsed ? '‹' : '›';
    rightToggle.setAttribute('aria-expanded', String(!isRightCollapsed));
  }

  function getBoxRect() {
    const rect = box.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      width: Math.max(1, rect.width),
      height: Math.max(1, rect.height)
    };
  }

  function unitToScreen(pos) {
    const rect = getBoxRect();
    return {
      x: (pos.x / VIEW_WIDTH) * rect.width,
      y: (pos.y / VIEW_HEIGHT) * rect.height
    };
  }

  function screenDeltaToUnit(dx, dy) {
    const rect = getBoxRect();
    return {
      x: (dx / rect.width) * VIEW_WIDTH,
      y: (dy / rect.height) * VIEW_HEIGHT
    };
  }

  function evaluateExpression(raw) {
    const normalized = String(raw || '')
      .trim()
      .replace(/\s+/g, '')
      .replace(/π/g, 'pi')
      .replace(/√/g, 'sqrt')
      .replace(/(\d+(?:\.\d+)?)deg\b/gi, 'deg($1)');

    if (!normalized) throw new Error('辺の長さを入力してください。');
    if (!/^[0-9+\-*/().,a-zA-Z]+$/.test(normalized)) throw new Error('使用できない文字が含まれています。');

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
      value = Function('s', '"use strict";const {pi,e,sqrt,sin,cos,tan,deg}=s;return (' + normalized + ');')(scope);
    } catch (error) {
      throw new Error('式を読み取れませんでした。');
    }
    if (!Number.isFinite(value) || value <= 0) throw new Error('0より大きい値を入力してください。');
    return value;
  }

  function formatNumber(value) {
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  }

  function getAreaText(side) {
    const base = formatNumber(side * side);
    const unit = unitModes[unitIndex];
    return unit ? '□ABCD = ' + base + unit + '²' : '□ABCD = ' + base;
  }

  function getDiagonalText(side) {
    const unit = unitModes[unitIndex];
    const prefix = formatNumber(side) === '1' ? '' : formatNumber(side);
    return prefix + '√2' + unit;
  }

  function getSideText(side) {
    const unit = unitModes[unitIndex];
    return formatNumber(side) + unit;
  }

  function getAngleText() {
    return angleMode === 'degrees' ? '90°' : 'π/2';
  }

  function createSvgElement(name, attrs) {
    const node = document.createElementNS(NS, name);
    Object.keys(attrs || {}).forEach(function (key) {
      node.setAttribute(key, String(attrs[key]));
    });
    return node;
  }

  function computeGeometry() {
    const margin = 160;
    const sidePx = Math.min(VIEW_WIDTH - margin * 2, VIEW_HEIGHT - margin * 2);
    const x0 = (VIEW_WIDTH - sidePx) / 2;
    const y0 = (VIEW_HEIGHT - sidePx) / 2;

    const points = {
      A: { x: x0, y: y0 },
      B: { x: x0, y: y0 + sidePx },
      C: { x: x0 + sidePx, y: y0 + sidePx },
      D: { x: x0 + sidePx, y: y0 }
    };
    const centroid = {
      x: (points.A.x + points.B.x + points.C.x + points.D.x) / 4,
      y: (points.A.y + points.B.y + points.C.y + points.D.y) / 4
    };
    return { points: points, centroid: centroid, sidePx: sidePx };
  }

  function getExternalPoint(centroid, vertex) {
    return {
      x: (vertex.x * 10 - centroid.x) / 9,
      y: (vertex.y * 10 - centroid.y) / 9
    };
  }

  function getInternalPoint(centroid, vertex) {
    return {
      x: (centroid.x + vertex.x * 3) / 4,
      y: (centroid.y + vertex.y * 3) / 4
    };
  }

  function getLineDefault(P, Q, centroid, offset) {
    const mid = { x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 };
    const dx = Q.x - P.x;
    const dy = Q.y - P.y;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    const toCentroid = { x: centroid.x - mid.x, y: centroid.y - mid.y };
    if ((nx * toCentroid.x + ny * toCentroid.y) > 0) {
      nx *= -1;
      ny *= -1;
    }
    return { x: mid.x + nx * offset, y: mid.y + ny * offset };
  }

  function getDefaultPosition(type, id, geometry) {
    const points = geometry.points;
    const centroid = geometry.centroid;
    if (type === 'vertex') return getExternalPoint(centroid, points[id]);
    if (type === 'angle') return getInternalPoint(centroid, points[id]);
    if (type === 'area') return { x: centroid.x, y: centroid.y };
    if (type === 'specialVertex') return { x: centroid.x, y: centroid.y };
    if (type === 'diagonal') {
      const pair = id === 'AC' ? [points.A, points.C] : [points.B, points.D];
      return getLineDefault(pair[0], pair[1], centroid, 34);
    }

    const map = {
      AB: [points.A, points.B],
      BC: [points.B, points.C],
      CD: [points.C, points.D],
      DA: [points.D, points.A]
    };
    const pair = map[id];
    return getLineDefault(pair[0], pair[1], centroid, 54);
  }

  function getLabelPosition(type, id, geometry) {
    const stored = labelPositions[type][id];
    if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) return stored;
    const fallback = getDefaultPosition(type, id, geometry);
    labelPositions[type][id] = { x: fallback.x, y: fallback.y };
    return labelPositions[type][id];
  }

  function getLabelText(type, id, sideValue) {
    if (type === 'vertex' || type === 'specialVertex') return id;
    if (type === 'side') return getSideText(sideValue);
    if (type === 'angle') return getAngleText();
    if (type === 'area') return getAreaText(sideValue);
    if (type === 'diagonal') return getDiagonalText(sideValue);
    return '';
  }

  function getGeneralConfigs() {
    return [
      { type: 'vertex', id: 'A' },
      { type: 'vertex', id: 'B' },
      { type: 'vertex', id: 'C' },
      { type: 'vertex', id: 'D' },
      { type: 'side', id: 'AB' },
      { type: 'side', id: 'BC' },
      { type: 'side', id: 'CD' },
      { type: 'side', id: 'DA' },
      { type: 'angle', id: 'A' },
      { type: 'angle', id: 'B' },
      { type: 'angle', id: 'C' },
      { type: 'angle', id: 'D' },
      { type: 'area', id: 'main' }
    ];
  }

  function getSpecialConfigs() {
    return [
      { type: 'specialVertex', id: 'O' },
      { type: 'diagonal', id: 'AC' },
      { type: 'diagonal', id: 'BD' }
    ];
  }

  function getToggleLabel(config) {
    if (config.type === 'vertex') return config.id;
    if (config.type === 'side') return config.id;
    if (config.type === 'angle') return '∠' + config.id;
    if (config.type === 'area') return '□ABCD';
    if (config.type === 'specialVertex') return config.id;
    if (config.type === 'diagonal') return config.id;
    return config.id;
  }

  function buildToggleButton(config) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toggle-btn';
    button.textContent = getToggleLabel(config);
    button.classList.toggle('is-off', !labelState[config.type][config.id]);
    button.addEventListener('click', function () {
      const nextState = !labelState[config.type][config.id];
      labelState[config.type][config.id] = nextState;
      if (nextState) resetSingleLabel(config.type, config.id);
      renderLabelToggleButtons();
      render();
    });
    return button;
  }

  function renderLabelToggleButtons() {
    generalLabelToggleGrid.innerHTML = '';
    specialLabelToggleGrid.innerHTML = '';
    getGeneralConfigs().forEach(function (config) {
      generalLabelToggleGrid.appendChild(buildToggleButton(config));
    });
    getSpecialConfigs().forEach(function (config) {
      specialLabelToggleGrid.appendChild(buildToggleButton(config));
    });
  }

  function clearSelectionElements() {
    Object.keys(selectionEls).forEach(function (key) {
      if (selectionEls[key]) selectionEls[key].remove();
      selectionEls[key] = null;
    });
  }

  function createHandle(x, y, content) {
    const node = document.createElement('div');
    node.textContent = content;
    node.style.position = 'absolute';
    node.style.left = (x - 12) + 'px';
    node.style.top = (y - 12) + 'px';
    node.style.width = '24px';
    node.style.height = '24px';
    node.style.borderRadius = '50%';
    node.style.border = '1.5px solid #2a5bd7';
    node.style.background = '#fff';
    node.style.color = '#2a5bd7';
    node.style.display = 'grid';
    node.style.placeItems = 'center';
    node.style.fontSize = '13px';
    node.style.fontWeight = '700';
    node.style.pointerEvents = 'auto';
    node.style.cursor = 'pointer';
    node.style.userSelect = 'none';
    node.style.zIndex = '11';
    node.className = 'label-handle';
    return node;
  }

  function renderSelection() {
    clearSelectionElements();
    if (!selectedLabel) return;
    const target = labelLayer.querySelector('[data-label-key="' + selectedLabel + '"]');
    if (!target) return;

    const hostRect = box.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    const padX = 3;
    const padY = 3;
    const x = rect.left - hostRect.left - padX;
    const y = rect.top - hostRect.top - padY;
    const w = rect.width + padX * 2;
    const h = rect.height + padY * 2;

    const frame = document.createElement('div');
    frame.style.position = 'absolute';
    frame.style.left = x + 'px';
    frame.style.top = y + 'px';
    frame.style.width = w + 'px';
    frame.style.height = h + 'px';
    frame.style.border = '1.5px solid #2a5bd7';
    frame.style.borderRadius = '8px';
    frame.style.pointerEvents = 'none';
    frame.style.zIndex = '10';
    labelLayer.appendChild(frame);
    selectionEls.box = frame;

    const rotate = createHandle(x + w + HANDLE_OFFSET, y - HANDLE_OFFSET, '○');
    rotate.dataset.mode = 'rotate';
    labelLayer.appendChild(rotate);
    selectionEls.rotate = rotate;

    const palette = createHandle(x - HANDLE_OFFSET, y + h + HANDLE_OFFSET, '●');
    palette.dataset.mode = 'palette';
    labelLayer.appendChild(palette);
    selectionEls.palette = palette;

    const scale = createHandle(x + w + HANDLE_OFFSET, y + h + HANDLE_OFFSET, '◯');
    scale.dataset.mode = 'scale';
    labelLayer.appendChild(scale);
    selectionEls.scale = scale;
  }

  function buildPalette(anchor) {
    if (selectionEls.pop) {
      selectionEls.pop.remove();
      selectionEls.pop = null;
    }
    const pop = document.createElement('div');
    pop.className = 'palette-pop';
    pop.style.position = 'absolute';
    pop.style.left = (anchor.offsetLeft + 24) + 'px';
    pop.style.top = (anchor.offsetTop + 24) + 'px';
    pop.style.display = 'flex';
    pop.style.gap = '6px';
    pop.style.padding = '6px';
    pop.style.border = '1px solid #cfd7ea';
    pop.style.borderRadius = '10px';
    pop.style.background = '#fff';
    pop.style.boxShadow = '0 10px 28px rgba(27,39,94,.08)';
    pop.style.pointerEvents = 'auto';
    pop.style.zIndex = '12';
    colorChoices.forEach(function (color) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.style.width = '18px';
      dot.style.height = '18px';
      dot.style.borderRadius = '50%';
      dot.style.border = '1px solid #cfd7ea';
      dot.style.background = color;
      dot.style.cursor = 'pointer';
      dot.addEventListener('click', function (event) {
        event.stopPropagation();
        const parts = selectedLabel.split(':');
        labelStyle[parts[0]][parts[1]].color = color;
        render();
      });
      pop.appendChild(dot);
    });
    labelLayer.appendChild(pop);
    selectionEls.pop = pop;
  }

  function renderLabels(sideValue, geometry) {
    labelLayer.innerHTML = '';
    const configs = getGeneralConfigs().concat(getSpecialConfigs());
    configs.forEach(function (config) {
      if (!labelState[config.type][config.id]) return;
      const pos = getLabelPosition(config.type, config.id, geometry);
      const screen = unitToScreen(pos);
      const labelNode = document.createElement('div');
      const labelKey = config.type + ':' + config.id;
      const currentStyle = labelStyle[config.type][config.id];
      labelNode.className = 'floating-label';
      labelNode.dataset.labelKey = labelKey;
      labelNode.dataset.type = config.type;
      labelNode.dataset.id = config.id;
      labelNode.textContent = getLabelText(config.type, config.id, sideValue);
      labelNode.style.left = screen.x + 'px';
      labelNode.style.top = screen.y + 'px';
      labelNode.style.fontSize = labelFontSize[config.type][config.id] + 'px';
      labelNode.style.color = currentStyle.color;
      labelNode.style.transform = 'translate(-50%, -50%) rotate(' + currentStyle.rotation + 'deg)';
      labelLayer.appendChild(labelNode);
    });
    renderSelection();
  }

  function drawSquare(sideValue) {
    svg.innerHTML = '';
    const geometry = computeGeometry();
    const points = geometry.points;

    svg.appendChild(createSvgElement('rect', {
      x: 120,
      y: 92,
      width: 960,
      height: 616,
      rx: 22,
      ry: 22,
      fill: '#fbfcff',
      stroke: '#c9d6fb',
      'stroke-width': 2
    }));

    svg.appendChild(createSvgElement('polygon', {
      points: [points.A, points.B, points.C, points.D].map(function (point) {
        return point.x + ',' + point.y;
      }).join(' '),
      fill: 'rgba(42,91,215,0.04)',
      stroke: '#2a5bd7',
      'stroke-width': 3
    }));

    if (labelState.diagonal.AC) {
      svg.appendChild(createSvgElement('line', {
        x1: points.A.x,
        y1: points.A.y,
        x2: points.C.x,
        y2: points.C.y,
        stroke: '#9aa7c7',
        'stroke-width': 2,
        'stroke-dasharray': '6 6'
      }));
    }

    if (labelState.diagonal.BD) {
      svg.appendChild(createSvgElement('line', {
        x1: points.B.x,
        y1: points.B.y,
        x2: points.D.x,
        y2: points.D.y,
        stroke: '#9aa7c7',
        'stroke-width': 2,
        'stroke-dasharray': '6 6'
      }));
    }

    [points.A, points.B, points.C, points.D].forEach(function (point) {
      svg.appendChild(createSvgElement('circle', {
        cx: point.x,
        cy: point.y,
        r: 4.5,
        fill: '#111'
      }));
    });

    currentGeometry = geometry;
    renderLabels(sideValue, geometry);
  }

  function constrainPosition(type, id, rawPos) {
    if (!currentGeometry) return rawPos;
    const G = currentGeometry.centroid;
    const P = currentGeometry.points;

    if (type === 'area' || type === 'specialVertex') return { x: G.x, y: G.y };

    if (type === 'vertex' || type === 'angle') {
      const V = P[id];
      const ux = V.x - G.x;
      const uy = V.y - G.y;
      const len2 = ux * ux + uy * uy || 1;
      let t = ((rawPos.x - G.x) * ux + (rawPos.y - G.y) * uy) / len2;
      if (type === 'vertex') t = Math.max(1, t);
      if (type === 'angle') t = Math.max(0, Math.min(1, t));
      return { x: G.x + ux * t, y: G.y + uy * t };
    }

    const map = {
      AB: ['A', 'B'],
      BC: ['B', 'C'],
      CD: ['C', 'D'],
      DA: ['D', 'A'],
      AC: ['A', 'C'],
      BD: ['B', 'D']
    };
    const pair = map[id];
    if (pair) {
      const S = P[pair[0]];
      const T = P[pair[1]];
      const mid = { x: (S.x + T.x) / 2, y: (S.y + T.y) / 2 };
      const dx = T.x - S.x;
      const dy = T.y - S.y;
      const nx = -dy;
      const ny = dx;
      const den = nx * nx + ny * ny || 1;
      const u = ((rawPos.x - mid.x) * nx + (rawPos.y - mid.y) * ny) / den;
      return { x: mid.x + nx * u, y: mid.y + ny * u };
    }

    return rawPos;
  }

  function resetSingleLabel(type, id) {
    labelPositions[type][id] = null;
    labelFontSize[type][id] = labelFontDefaults[type][id];
    labelStyle[type][id] = cloneState(styleDefaults[type][id]);
  }

  function resetAllLabels() {
    Object.keys(labelPositions).forEach(function (group) {
      Object.keys(labelPositions[group]).forEach(function (id) {
        labelPositions[group][id] = null;
        labelFontSize[group][id] = labelFontDefaults[group][id];
        labelStyle[group][id] = cloneState(styleDefaults[group][id]);
        labelState[group][id] = defaultLabelState[group][id];
      });
    });
    selectedLabel = null;
  }

  function render() {
    try {
      const sideValue = evaluateExpression(sideInput.value);
      drawSquare(sideValue);
      setStatus('正方形を描画しました。', false);
    } catch (error) {
      setStatus(error.message || '描画に失敗しました。', true);
      svg.innerHTML = '';
      labelLayer.innerHTML = '';
      clearSelectionElements();
    }
  }

  function updateExportFrame() {
    const rect = getBoxRect();
    const ratio = aspectModes[aspectIndex].ratio;
    const maxWidth = rect.width * 0.76;
    const maxHeight = rect.height * 0.78;
    let width = maxWidth;
    let height = width / ratio;
    if (height > maxHeight) {
      height = maxHeight;
      width = height * ratio;
    }
    exportFrame.style.width = width + 'px';
    exportFrame.style.height = height + 'px';

    const left = (rect.width - width) / 2;
    const top = (rect.height - height) / 2;
    const right = rect.width - left - width;
    const bottom = rect.height - top - height;

    exportBackdrop.classList.add('is-visible');
    exportBackdrop.querySelector('[data-piece="top"]').style.cssText =
      'left:0;top:0;width:100%;height:' + top + 'px;';
    exportBackdrop.querySelector('[data-piece="left"]').style.cssText =
      'left:0;top:' + top + 'px;width:' + left + 'px;height:' + height + 'px;';
    exportBackdrop.querySelector('[data-piece="right"]').style.cssText =
      'right:0;top:' + top + 'px;width:' + right + 'px;height:' + height + 'px;';
    exportBackdrop.querySelector('[data-piece="bottom"]').style.cssText =
      'left:0;bottom:0;width:100%;height:' + bottom + 'px;';
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
    const ctx = cropped.getContext('2d');
    ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
    return cropped;
  }

  function toggleSelectionVisibility(hidden) {
    [selectionEls.box, selectionEls.rotate, selectionEls.palette, selectionEls.scale, selectionEls.pop].forEach(function (node) {
      if (!node) return;
      node.style.display = hidden ? 'none' : '';
    });
  }

  async function handleDownload(format) {
    updateExportFrame();
    toggleSelectionVisibility(true);
    setStatus((format === 'pdf' ? 'PDF' : '画像') + ' を出力しています。', false);
    try {
      const canvas = await window.html2canvas(box, {
        backgroundColor: format === 'png-transparent' ? null : '#fbfcff',
        scale: 2,
        useCORS: true
      });
      const cropped = cropCanvasToFrame(canvas);
      if (format === 'pdf') {
        const pdf = new window.jspdf.jsPDF({
          orientation: cropped.width >= cropped.height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [cropped.width, cropped.height]
        });
        pdf.addImage(cropped.toDataURL('image/png'), 'PNG', 0, 0, cropped.width, cropped.height);
        pdf.save('square.pdf');
      } else {
        const link = document.createElement('a');
        link.href = cropped.toDataURL('image/png');
        link.download = format === 'png-transparent' ? 'square-transparent.png' : 'square.png';
        link.click();
      }
      setStatus('保存しました。', false);
    } catch (error) {
      setStatus('ダウンロードに失敗しました。', true);
    } finally {
      toggleSelectionVisibility(false);
    }
  }

  labelLayer.addEventListener('pointerdown', function (event) {
    const target = event.target;
    if (target.classList.contains('floating-label')) {
      selectedLabel = target.dataset.labelKey;
      renderSelection();
      const position = labelPositions[target.dataset.type][target.dataset.id];
      dragState = {
        mode: 'move',
        type: target.dataset.type,
        id: target.dataset.id,
        startX: event.clientX,
        startY: event.clientY,
        startPos: { x: position.x, y: position.y }
      };
      target.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }

    if (target.classList.contains('label-handle') && selectedLabel) {
      const parts = selectedLabel.split(':');
      const type = parts[0];
      const id = parts[1];
      const mode = target.dataset.mode;
      if (mode === 'palette') {
        buildPalette(target);
        event.preventDefault();
        return;
      }
      dragState = {
        mode: mode,
        type: type,
        id: id,
        startX: event.clientX,
        startY: event.clientY,
        startSize: labelFontSize[type][id],
        startRotation: labelStyle[type][id].rotation
      };
      target.setPointerCapture(event.pointerId);
      event.preventDefault();
    }
  });

  labelLayer.addEventListener('pointermove', function (event) {
    if (!dragState) return;
    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;

    if (dragState.mode === 'move') {
      const delta = screenDeltaToUnit(dx, dy);
      const rawPos = {
        x: dragState.startPos.x + delta.x,
        y: dragState.startPos.y + delta.y
      };
      labelPositions[dragState.type][dragState.id] = constrainPosition(dragState.type, dragState.id, rawPos);
      render();
      return;
    }

    if (dragState.mode === 'scale') {
      labelFontSize[dragState.type][dragState.id] = Math.max(12, Math.min(320, Math.round(dragState.startSize + (dx + dy) * 0.45)));
      render();
      return;
    }

    if (dragState.mode === 'rotate') {
      labelStyle[dragState.type][dragState.id].rotation = dragState.startRotation + dx * 0.35;
      render();
    }
  });

  labelLayer.addEventListener('pointerup', function () {
    dragState = null;
  });

  box.addEventListener('pointerdown', function (event) {
    if (event.target.closest('.floating-label') || event.target.closest('.label-handle') || event.target.closest('.palette-pop')) return;
    selectedLabel = null;
    clearSelectionElements();
  });

  leftToggle.addEventListener('click', function () {
    isLeftCollapsed = !isLeftCollapsed;
    leftDock.classList.toggle('is-collapsed', isLeftCollapsed);
    syncDockButtons();
  });

  rightToggle.addEventListener('click', function () {
    isRightCollapsed = !isRightCollapsed;
    rightDock.classList.toggle('is-collapsed', isRightCollapsed);
    syncDockButtons();
  });

  pageBackBtn.addEventListener('click', function () {
    window.history.back();
  });

  ratioBtn.addEventListener('click', function () {
    aspectIndex = (aspectIndex + 1) % aspectModes.length;
    updateRatioButton();
    updateExportFrame();
  });

  resetBtn.addEventListener('click', function () {
    sideInput.value = '5';
    aspectIndex = 0;
    unitIndex = 1;
    angleMode = 'degrees';
    updateRatioButton();
    updateUnitButton();
    updateAngleModeButton();
    resetAllLabels();
    renderLabelToggleButtons();
    render();
  });

  angleModeBtn.addEventListener('click', function () {
    angleMode = angleMode === 'degrees' ? 'radians' : 'degrees';
    updateAngleModeButton();
    render();
  });

  unitBtn.addEventListener('click', function () {
    unitIndex = (unitIndex + 1) % unitModes.length;
    updateUnitButton();
    render();
  });

  downloadButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      handleDownload(button.dataset.downloadFormat);
    });
  });

  sideInput.addEventListener('input', render);
  window.addEventListener('resize', function () {
    updateExportFrame();
    render();
  });

  updateRatioButton();
  updateUnitButton();
  updateAngleModeButton();
  syncDockButtons();
  renderLabelToggleButtons();
  updateExportFrame();
  render();
})();
