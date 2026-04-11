(function () {
  'use strict';

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
  const vertexLabelText = { A: 'A', B: 'B', C: 'C', D: 'D' };

  const board = JXG.JSXGraph.initBoard('box', {
    boundingbox: [0, 8, 12, 0],
    axis: false,
    showNavigation: false,
    showInfobox: false,
    showCopyright: false,
    keepaspectratio: true
  });

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

  const labelState = JSON.parse(JSON.stringify(defaultLabelState));
  const labelFontDefaults = {
    vertex: { A: 36, B: 36, C: 36, D: 36 },
    side: { AB: 32, BC: 32, CD: 32, DA: 32 },
    angle: { A: 30, B: 30, C: 30, D: 30 },
    area: { main: 48 },
    specialVertex: { O: 34 },
    diagonal: { AC: 28, BD: 28 }
  };
  const labelFontSize = JSON.parse(JSON.stringify(labelFontDefaults));
  const styleDefaults = {
    vertex: { A: style('#1f2430'), B: style('#1f2430'), C: style('#1f2430'), D: style('#1f2430') },
    side: { AB: style('#2a5bd7'), BC: style('#2a5bd7'), CD: style('#2a5bd7'), DA: style('#2a5bd7') },
    angle: { A: style('#687086'), B: style('#687086'), C: style('#687086'), D: style('#687086') },
    area: { main: style('#25603b') },
    specialVertex: { O: style('#1f2430') },
    diagonal: { AC: style('#7d8db8'), BD: style('#7d8db8') }
  };
  let labelStyleState = JSON.parse(JSON.stringify(styleDefaults));
  const labelPositions = {
    vertex: { A: null, B: null, C: null, D: null },
    side: { AB: null, BC: null, CD: null, DA: null },
    angle: { A: null, B: null, C: null, D: null },
    area: { main: null },
    specialVertex: { O: null },
    diagonal: { AC: null, BD: null }
  };

  const exportAspects = [
    { label: '1:1', value: 1 },
    { label: '1:√2', value: 1 / Math.SQRT2 },
    { label: '√2:1', value: Math.SQRT2 }
  ];
  const unitOptions = ['', 'cm', 'm', 'km'];

  let currentGeometry = null;
  let selectedLabel = null;
  let currentLabelAnchors = [];
  let currentSelectionOverlay = null;
  let dragState = null;
  let renderRafId = null;
  let exportAspectIndex = 0;
  let angleMode = 'degrees';
  let unitIndex = 1;
  let isDockCollapsed = false;
  let isRightDockCollapsed = false;
  let isPaletteOpen = false;
  let lastFitSignature = '';

  function style(color) {
    return { color: color, rotation: 0 };
  }

  function getVertexTokenByKey(vertexKey) {
    const raw = String(vertexLabelText[vertexKey] || vertexKey).trim().toUpperCase();
    return /^[A-Z]+$/.test(raw) ? raw : vertexKey;
  }

  function getAreaName() {
    return '□' + ['A', 'B', 'C', 'D'].map(getVertexTokenByKey).join('');
  }

  function getSideName(id) {
    return id.split('').map(getVertexTokenByKey).join('');
  }

  function setStatus(message, isError) {
    statusBox.textContent = message;
    statusBox.classList.toggle('error', !!isError);
  }

  function updateRatioButton() {
    ratioBtn.textContent = '画面比 ' + exportAspects[exportAspectIndex].label;
  }

  function updateUnitButton() {
    unitBtn.textContent = unitOptions[unitIndex] ? '長さ' + unitOptions[unitIndex] : '単位なし';
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

    try {
      const value = Function('s', '"use strict";const {pi,e,sqrt,sin,cos,tan,deg}=s;return (' + normalized + ');')(scope);
      if (!Number.isFinite(value) || value <= 0) throw new Error('0より大きい値を入力してください。');
      return value;
    } catch (_) {
      throw new Error('式を読み取れませんでした。');
    }
  }

  function formatNumber(value) {
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  }

  function getCurrentUnit() {
    return unitOptions[unitIndex];
  }

  function appendUnit(text, square) {
    const unit = getCurrentUnit();
    if (!unit) return text;
    return text + unit + (square ? '²' : '');
  }

  function rotatePoint(point, center, angleDeg) {
    const rad = angleDeg * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return {
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos
    };
  }

  function getLabelStyle(type, id) {
    return labelStyleState[type] && labelStyleState[type][id]
      ? labelStyleState[type][id]
      : { color: '#2a5bd7', rotation: 0 };
  }

  function getLabelPosition(type, id, basePosition) {
    if (type === 'area' && id === 'main') {
      labelPositions.area.main = { x: basePosition.x, y: basePosition.y };
      return labelPositions.area.main;
    }
    const stored = labelPositions[type] && labelPositions[type][id];
    if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) {
      return { x: stored.x, y: stored.y };
    }
    labelPositions[type][id] = { x: basePosition.x, y: basePosition.y };
    return labelPositions[type][id];
  }

  function getLabelBounds(anchor) {
    const padPx = 6;
    let widthPx = 0;
    let heightPx = 0;

    if (anchor.screenRect) {
      widthPx = Math.max(10, (anchor.screenRect.right - anchor.screenRect.left) + padPx * 2);
      heightPx = Math.max(10, (anchor.screenRect.bottom - anchor.screenRect.top) + padPx * 2);
    } else {
      const text = String(anchor.text || '');
      widthPx = Math.max(10, text.length * anchor.fontSize * 0.56) + padPx * 2;
      heightPx = Math.max(10, anchor.fontSize) + padPx * 2;
    }

    const width = widthPx / Math.max(Math.abs(board.unitX), 1e-6);
    const height = heightPx / Math.max(Math.abs(board.unitY), 1e-6);
    const center = { x: anchor.x, y: anchor.y };
    return {
      center: center,
      width: width,
      height: height,
      corners: {
        topLeft: rotatePoint({ x: center.x - width / 2, y: center.y + height / 2 }, center, anchor.rotation),
        topRight: rotatePoint({ x: center.x + width / 2, y: center.y + height / 2 }, center, anchor.rotation),
        bottomRight: rotatePoint({ x: center.x + width / 2, y: center.y - height / 2 }, center, anchor.rotation),
        bottomLeft: rotatePoint({ x: center.x - width / 2, y: center.y - height / 2 }, center, anchor.rotation)
      }
    };
  }

  function getSquareGeometry(side) {
    const half = side / 2;
    const points = {
      A: { x: -half, y: half },
      B: { x: -half, y: -half },
      C: { x: half, y: -half },
      D: { x: half, y: half }
    };
    const centroid = { x: 0, y: 0 };
    return { side: side, points: points, centroid: centroid };
  }

  function getVertexDefault(centroid, vertex) {
    return {
      x: (vertex.x * 10 - centroid.x) / 9,
      y: (vertex.y * 10 - centroid.y) / 9
    };
  }

  function getAngleDefault(centroid, vertex) {
    return {
      x: (centroid.x + vertex.x * 3) / 4,
      y: (centroid.y + vertex.y * 3) / 4
    };
  }

  function getPerpendicularDefault(P, Q, centroid, offset) {
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
    const P = geometry.points;
    const G = geometry.centroid;
    if (type === 'vertex') return getVertexDefault(G, P[id]);
    if (type === 'angle') return getAngleDefault(G, P[id]);
    if (type === 'area' || type === 'specialVertex') return { x: G.x, y: G.y };
    if (type === 'diagonal') {
      return id === 'AC'
        ? getPerpendicularDefault(P.A, P.C, G, 0.5)
        : getPerpendicularDefault(P.B, P.D, G, 0.5);
    }
    const sideMap = {
      AB: [P.A, P.B],
      BC: [P.B, P.C],
      CD: [P.C, P.D],
      DA: [P.D, P.A]
    };
    return getPerpendicularDefault(sideMap[id][0], sideMap[id][1], G, 0.9);
  }

  function getLabelText(type, id, geometry) {
    const side = geometry.side;
    if (type === 'vertex') return getVertexTokenByKey(id);
    if (type === 'specialVertex') return id;
    if (type === 'side') return appendUnit(formatNumber(side), false);
    if (type === 'angle') return angleMode === 'degrees' ? '90°' : 'π/2';
    if (type === 'area') return appendUnit(formatNumber(side * side), true);
    if (type === 'diagonal') return appendUnit((formatNumber(side) === '1' ? '' : formatNumber(side)) + '√2', false);
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
    if (config.type === 'vertex') return getVertexTokenByKey(config.id);
    if (config.type === 'side') return getSideName(config.id);
    if (config.type === 'angle') return '∠' + getVertexTokenByKey(config.id);
    if (config.type === 'area') return getAreaName();
    if (config.type === 'diagonal') return getSideName(config.id);
    return config.id;
  }

  function resetSingleLabel(type, id) {
    labelPositions[type][id] = null;
    labelFontSize[type][id] = labelFontDefaults[type][id];
    labelStyleState[type][id] = JSON.parse(JSON.stringify(styleDefaults[type][id]));
  }

  function renderLabelToggleButtons() {
    generalLabelToggleGrid.innerHTML = '';
    specialLabelToggleGrid.innerHTML = '';
    getGeneralConfigs().forEach(function (config) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'download-btn btn-bd';
      if (!labelState[config.type][config.id]) button.style.opacity = '0.55';
      button.textContent = getToggleLabel(config);
      button.addEventListener('click', function () {
        labelState[config.type][config.id] = !labelState[config.type][config.id];
        if (labelState[config.type][config.id]) resetSingleLabel(config.type, config.id);
        renderLabelToggleButtons();
        render();
      });
      if (config.type === 'vertex') {
        button.addEventListener('contextmenu', function (event) {
          event.preventDefault();
          const current = getVertexTokenByKey(config.id);
          const next = window.prompt('頂点ラベル文字を入力してください（A-Z のみ）', current);
          if (next === null) return;
          const normalized = String(next).trim().toUpperCase();
          vertexLabelText[config.id] = /^[A-Z]+$/.test(normalized) ? normalized : config.id;
          renderLabelToggleButtons();
          render();
        });
      }
      generalLabelToggleGrid.appendChild(button);
    });
    getSpecialConfigs().forEach(function (config) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'download-btn btn-bd';
      if (!labelState[config.type][config.id]) button.style.opacity = '0.55';
      button.textContent = getToggleLabel(config);
      button.addEventListener('click', function () {
        labelState[config.type][config.id] = !labelState[config.type][config.id];
        if (labelState[config.type][config.id]) resetSingleLabel(config.type, config.id);
        renderLabelToggleButtons();
        render();
      });
      specialLabelToggleGrid.appendChild(button);
    });
  }

  function getSelectedAnchor() {
    if (!selectedLabel) return null;
    return currentLabelAnchors.find(function (item) {
      return item.type === selectedLabel.type && item.id === selectedLabel.id;
    }) || null;
  }

  function renderSelectionOverlay(anchor) {
    currentSelectionOverlay = anchor ? window.InstantGeometrySharedSelection.renderSelectionOverlay({
      board: board,
      anchor: anchor,
      rotatePoint: rotatePoint,
      getLabelBounds: getLabelBounds,
      isPaletteOpen: isPaletteOpen
    }) : null;
  }

  function findSelectionControl(point) {
    return window.InstantGeometrySharedSelection.findSelectionControl(point, currentSelectionOverlay);
  }

  function fitBoard(geometry) {
    const points = Object.keys(geometry.points).map(function (key) { return geometry.points[key]; });
    const xs = points.map(function (p) { return p.x; });
    const ys = points.map(function (p) { return p.y; });
    const minX = Math.min.apply(null, xs);
    const maxX = Math.max.apply(null, xs);
    const minY = Math.min.apply(null, ys);
    const maxY = Math.max.apply(null, ys);
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const padding = Math.max(width, height) * 0.42;
    const contentWidth = width + padding * 2;
    const contentHeight = height + padding * 2;
    const aspect = exportAspects[exportAspectIndex].value;
    let halfWidth = contentWidth / 2;
    let halfHeight = contentHeight / 2;
    if (contentWidth / contentHeight < aspect) {
      halfWidth = (contentHeight * aspect) / 2;
    } else {
      halfHeight = (contentWidth / aspect) / 2;
    }
    board.setBoundingBox([geometry.centroid.x - halfWidth, geometry.centroid.y + halfHeight, geometry.centroid.x + halfWidth, geometry.centroid.y - halfHeight], true);
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

  function scheduleRender() {
    if (renderRafId !== null) return;
    renderRafId = requestAnimationFrame(function () {
      renderRafId = null;
      render();
    });
  }

  function renderLabels(geometry) {
    labelLayer.innerHTML = '';
    currentLabelAnchors = [];

    ['A', 'B', 'C', 'D'].forEach(function (id) {
      if (!labelState.vertex[id]) return;
      window.InstantGeometrySharedLabels.createSelectableText({
        board: board,
        labelLayer: labelLayer,
        currentLabelAnchors: currentLabelAnchors,
        getLabelStyle: getLabelStyle,
        position: getLabelPosition('vertex', id, getDefaultPosition('vertex', id, geometry)),
        text: getVertexTokenByKey(id),
        fontSize: labelFontSize.vertex[id],
        labelKey: { type: 'vertex', id: id },
        options: { color: '#1f2430' }
      });
    });

    const P = geometry.points;
    if (labelState.side.AB) window.InstantGeometrySharedOrnaments.drawSideArcLabel({ board: board, P: P.A, Q: P.B, center: geometry.centroid, text: getLabelText('side', 'AB', geometry), sideId: 'AB', getLabelPosition: getLabelPosition, getLabelStyle: getLabelStyle, createSelectableText: function (position, text, fontSize, labelKey, options) { return window.InstantGeometrySharedLabels.createSelectableText({ board: board, labelLayer: labelLayer, currentLabelAnchors: currentLabelAnchors, getLabelStyle: getLabelStyle, position: position, text: text, fontSize: fontSize, labelKey: labelKey, options: options }); }, labelFontSize: labelFontSize });
    if (labelState.side.BC) window.InstantGeometrySharedOrnaments.drawSideArcLabel({ board: board, P: P.B, Q: P.C, center: geometry.centroid, text: getLabelText('side', 'BC', geometry), sideId: 'BC', getLabelPosition: getLabelPosition, getLabelStyle: getLabelStyle, createSelectableText: function (position, text, fontSize, labelKey, options) { return window.InstantGeometrySharedLabels.createSelectableText({ board: board, labelLayer: labelLayer, currentLabelAnchors: currentLabelAnchors, getLabelStyle: getLabelStyle, position: position, text: text, fontSize: fontSize, labelKey: labelKey, options: options }); }, labelFontSize: labelFontSize });
    if (labelState.side.CD) window.InstantGeometrySharedOrnaments.drawSideArcLabel({ board: board, P: P.C, Q: P.D, center: geometry.centroid, text: getLabelText('side', 'CD', geometry), sideId: 'CD', getLabelPosition: getLabelPosition, getLabelStyle: getLabelStyle, createSelectableText: function (position, text, fontSize, labelKey, options) { return window.InstantGeometrySharedLabels.createSelectableText({ board: board, labelLayer: labelLayer, currentLabelAnchors: currentLabelAnchors, getLabelStyle: getLabelStyle, position: position, text: text, fontSize: fontSize, labelKey: labelKey, options: options }); }, labelFontSize: labelFontSize });
    if (labelState.side.DA) window.InstantGeometrySharedOrnaments.drawSideArcLabel({ board: board, P: P.D, Q: P.A, center: geometry.centroid, text: getLabelText('side', 'DA', geometry), sideId: 'DA', getLabelPosition: getLabelPosition, getLabelStyle: getLabelStyle, createSelectableText: function (position, text, fontSize, labelKey, options) { return window.InstantGeometrySharedLabels.createSelectableText({ board: board, labelLayer: labelLayer, currentLabelAnchors: currentLabelAnchors, getLabelStyle: getLabelStyle, position: position, text: text, fontSize: fontSize, labelKey: labelKey, options: options }); }, labelFontSize: labelFontSize });

    ['A', 'B', 'C', 'D'].forEach(function (id) {
      if (!labelState.angle[id]) return;
      window.InstantGeometrySharedLabels.createSelectableText({
        board: board,
        labelLayer: labelLayer,
        currentLabelAnchors: currentLabelAnchors,
        getLabelStyle: getLabelStyle,
        position: getLabelPosition('angle', id, getDefaultPosition('angle', id, geometry)),
        text: getLabelText('angle', id, geometry),
        fontSize: labelFontSize.angle[id],
        labelKey: { type: 'angle', id: id },
        options: { color: '#687086' }
      });
    });

    if (labelState.area.main) {
      window.InstantGeometrySharedLabels.createSelectableText({
        board: board,
        labelLayer: labelLayer,
        currentLabelAnchors: currentLabelAnchors,
        getLabelStyle: getLabelStyle,
        position: getLabelPosition('area', 'main', getDefaultPosition('area', 'main', geometry)),
        text: getLabelText('area', 'main', geometry),
        fontSize: labelFontSize.area.main,
        labelKey: { type: 'area', id: 'main' },
        options: { color: '#25603b' }
      });
    }

    if (labelState.specialVertex.O) {
      window.InstantGeometrySharedLabels.createSelectableText({
        board: board,
        labelLayer: labelLayer,
        currentLabelAnchors: currentLabelAnchors,
        getLabelStyle: getLabelStyle,
        position: { x: 0, y: 0 },
        text: 'O',
        fontSize: labelFontSize.specialVertex.O,
        labelKey: { type: 'specialVertex', id: 'O' },
        options: { color: '#1f2430' }
      });
    }

    ['AC', 'BD'].forEach(function (id) {
      if (!labelState.diagonal[id]) return;
      const pair = id === 'AC' ? [P.A, P.C] : [P.B, P.D];
      window.InstantGeometrySharedLabels.createSelectableText({
        board: board,
        labelLayer: labelLayer,
        currentLabelAnchors: currentLabelAnchors,
        getLabelStyle: getLabelStyle,
        position: getLabelPosition('diagonal', id, getDefaultPosition('diagonal', id, geometry)),
        text: getLabelText('diagonal', id, geometry),
        fontSize: labelFontSize.diagonal[id],
        labelKey: { type: 'diagonal', id: id },
        options: { color: '#7d8db8' }
      });
      board.create('segment', [[pair[0].x, pair[0].y], [pair[1].x, pair[1].y]], {
        fixed: true,
        strokeColor: '#9aa7c7',
        strokeWidth: 1.6,
        dash: 2,
        highlight: false
      });
    });

    renderSelectionOverlay(getSelectedAnchor());
  }

  function renderFigure(geometry) {
    const P = geometry.points;
    const pointA = board.create('point', [P.A.x, P.A.y], { name: '', size: 3, fixed: true, strokeColor: '#111111', fillColor: '#111111' });
    const pointB = board.create('point', [P.B.x, P.B.y], { name: '', size: 3, fixed: true, strokeColor: '#111111', fillColor: '#111111' });
    const pointC = board.create('point', [P.C.x, P.C.y], { name: '', size: 3, fixed: true, strokeColor: '#111111', fillColor: '#111111' });
    const pointD = board.create('point', [P.D.x, P.D.y], { name: '', size: 3, fixed: true, strokeColor: '#111111', fillColor: '#111111' });
    board.create('polygon', [pointA, pointB, pointC, pointD], {
      borders: { strokeWidth: 2, strokeColor: '#2a5bd7', fixed: true, highlight: false },
      fillColor: 'rgba(42,91,215,0.04)',
      fillOpacity: 0,
      vertices: { visible: false },
      highlight: false
    });
  }

  function render() {
    if (renderRafId !== null) {
      cancelAnimationFrame(renderRafId);
      renderRafId = null;
    }
    board.suspendUpdate();
    board.removeObject(board.objectsList.slice());
    labelLayer.innerHTML = '';
    currentLabelAnchors = [];
    currentSelectionOverlay = null;

    try {
      const side = evaluateExpression(sideInput.value);
      currentGeometry = getSquareGeometry(side);
      updateExportFrame();
      const fitSignature = JSON.stringify({ side: side, aspect: exportAspectIndex, boxW: box.clientWidth, boxH: box.clientHeight });
      if (fitSignature !== lastFitSignature) {
        fitBoard(currentGeometry);
        lastFitSignature = fitSignature;
      }
      renderFigure(currentGeometry);
      renderLabels(currentGeometry);
      setStatus('正方形を描画しました。', false);
    } catch (error) {
      currentGeometry = null;
      currentSelectionOverlay = null;
      setStatus(error.message || '描画に失敗しました。', true);
    } finally {
      board.unsuspendUpdate();
    }
  }

  async function handleDownload(format) {
    updateExportFrame();
    setStatus((format === 'pdf' ? 'PDF' : '画像') + ' を出力しています。', false);
    try {
      const canvas = await html2canvas(box, {
        backgroundColor: format === 'png-transparent' ? null : '#ffffff',
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
    } catch (_) {
      setStatus('ダウンロードに失敗しました。', true);
    }
  }

  labelLayer.addEventListener('pointerdown', function (event) {
    const target = event.target.closest('.floating-label');
    if (!target) return;
    selectedLabel = { type: target.dataset.type, id: target.dataset.id };
    isPaletteOpen = false;
    render();
    const position = labelPositions[target.dataset.type][target.dataset.id];
    dragState = {
      mode: 'move',
      type: target.dataset.type,
      id: target.dataset.id,
      startClient: { x: event.clientX, y: event.clientY },
      labelStart: { x: position.x, y: position.y }
    };
  });

  box.addEventListener('mousedown', function (event) {
    if (!currentGeometry) return;
    if (event.target.closest('.floating-label')) return;
    const coords = board.getUsrCoordsOfMouse(event);
    const point = { x: coords[0], y: coords[1] };
    const overlayControl = findSelectionControl(point);

    if (selectedLabel && overlayControl) {
      if (overlayControl.mode === 'palette-color') {
        labelStyleState[selectedLabel.type][selectedLabel.id].color = overlayControl.color;
        isPaletteOpen = false;
        render();
        return;
      }
      if (overlayControl.mode === 'palette') {
        isPaletteOpen = !isPaletteOpen;
        render();
        return;
      }
      const anchor = getSelectedAnchor();
      if (!anchor) return;
      dragState = {
        mode: overlayControl.mode,
        type: selectedLabel.type,
        id: selectedLabel.id,
        startClient: { x: event.clientX, y: event.clientY },
        center: { x: anchor.x, y: anchor.y },
        fontSizeStart: labelFontSize[selectedLabel.type][selectedLabel.id],
        rotationStart: labelStyleState[selectedLabel.type][selectedLabel.id].rotation,
        distanceStart: Math.hypot(point.x - anchor.x, point.y - anchor.y),
        angleStart: Math.atan2(point.y - anchor.y, point.x - anchor.x)
      };
      return;
    }

    selectedLabel = null;
    isPaletteOpen = false;
    render();
  });

  box.addEventListener('mousemove', function (event) {
    if (!dragState || !currentGeometry) return;
    const coords = board.getUsrCoordsOfMouse(event);
    const point = { x: coords[0], y: coords[1] };

    if (dragState.mode === 'move') {
      const boundingBox = board.getBoundingBox();
      const unitsPerPixelX = (boundingBox[2] - boundingBox[0]) / Math.max(box.clientWidth, 1);
      const unitsPerPixelY = (boundingBox[1] - boundingBox[3]) / Math.max(box.clientHeight, 1);
      labelPositions[dragState.type][dragState.id] = {
        x: dragState.labelStart.x + (event.clientX - dragState.startClient.x) * unitsPerPixelX,
        y: dragState.labelStart.y - (event.clientY - dragState.startClient.y) * unitsPerPixelY
      };
      scheduleRender();
      return;
    }

    if (dragState.mode === 'resize') {
      const ratio = Math.max(0.3, Math.min(8, Math.hypot(point.x - dragState.center.x, point.y - dragState.center.y) / Math.max(dragState.distanceStart, 0.01)));
      labelFontSize[dragState.type][dragState.id] = Math.max(10, Math.min(320, Math.round(dragState.fontSizeStart * ratio)));
      scheduleRender();
      return;
    }

    if (dragState.mode === 'rotate') {
      const currentAngle = Math.atan2(point.y - dragState.center.y, point.x - dragState.center.x);
      labelStyleState[dragState.type][dragState.id].rotation = dragState.rotationStart + ((currentAngle - dragState.angleStart) * 180 / Math.PI);
      scheduleRender();
    }
  });

  window.addEventListener('mouseup', function () {
    dragState = null;
  });

  sideInput.addEventListener('input', function () {
    selectedLabel = null;
    isPaletteOpen = false;
    render();
  });

  ratioBtn.addEventListener('click', function () {
    exportAspectIndex = (exportAspectIndex + 1) % exportAspects.length;
    updateRatioButton();
    lastFitSignature = '';
    render();
  });

  resetBtn.addEventListener('click', function () {
    sideInput.value = '5';
    exportAspectIndex = 0;
    unitIndex = 1;
    angleMode = 'degrees';
    labelStyleState = JSON.parse(JSON.stringify(styleDefaults));
    Object.keys(labelPositions).forEach(function (group) {
      Object.keys(labelPositions[group]).forEach(function (id) {
        labelPositions[group][id] = null;
        labelFontSize[group][id] = labelFontDefaults[group][id];
        labelState[group][id] = defaultLabelState[group][id];
      });
    });
    selectedLabel = null;
    isPaletteOpen = false;
    updateRatioButton();
    updateUnitButton();
    updateAngleModeButton();
    renderLabelToggleButtons();
    lastFitSignature = '';
    render();
  });

  unitBtn.addEventListener('click', function () {
    unitIndex = (unitIndex + 1) % unitOptions.length;
    updateUnitButton();
    render();
  });

  angleModeBtn.addEventListener('click', function () {
    angleMode = angleMode === 'degrees' ? 'radians' : 'degrees';
    updateAngleModeButton();
    render();
  });

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

  pageBackBtn.addEventListener('click', function () {
    window.history.back();
  });

  downloadButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      handleDownload(button.dataset.downloadFormat);
    });
  });

  window.addEventListener('resize', function () {
    updateExportFrame();
    lastFitSignature = '';
    render();
  });

  updateRatioButton();
  updateUnitButton();
  updateAngleModeButton();
  updateDockToggleButtons();
  renderLabelToggleButtons();
  render();
})();
