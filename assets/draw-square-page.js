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
    angleMark: { A: false, B: false, C: false, D: false },
    area: { main: false },
    specialVertex: { O: false },
    diagonal: { AC: false, BD: false }
  };

  const labelState = JSON.parse(JSON.stringify(defaultLabelState));
  const labelFontDefaults = {
    vertex: { A: 36, B: 36, C: 36, D: 36 },
    side: { AB: 32, BC: 32, CD: 32, DA: 32 },
    angle: { A: 30, B: 30, C: 30, D: 30 },
    angleMark: { A: 26, B: 26, C: 26, D: 26 },
    area: { main: 48 },
    specialVertex: { O: 34 },
    diagonal: { AC: 28, BD: 28 }
  };
  const labelFontSize = JSON.parse(JSON.stringify(labelFontDefaults));
  const styleDefaults = {
    vertex: { A: style('#1f2430'), B: style('#1f2430'), C: style('#1f2430'), D: style('#1f2430') },
    side: { AB: style('#2a5bd7'), BC: style('#2a5bd7'), CD: style('#2a5bd7'), DA: style('#2a5bd7') },
    angle: { A: style('#687086'), B: style('#687086'), C: style('#687086'), D: style('#687086') },
    angleMark: { A: style('#687086'), B: style('#687086'), C: style('#687086'), D: style('#687086') },
    area: { main: style('#25603b') },
    specialVertex: { O: style('#1f2430') },
    diagonal: { AC: style('#7d8db8'), BD: style('#7d8db8') }
  };
  let labelStyleState = JSON.parse(JSON.stringify(styleDefaults));
  const labelPositions = {
    vertex: { A: null, B: null, C: null, D: null },
    side: { AB: null, BC: null, CD: null, DA: null },
    angle: { A: null, B: null, C: null, D: null },
    angleMark: { A: null, B: null, C: null, D: null },
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
  let selectedFigure = false;
  let currentLabelAnchors = [];
  let currentSelectionOverlay = null;
  let dragState = null;
  let renderRafId = null;
  let exportAspectIndex = 0;
  let angleMode = 'degrees';
  let unitIndex = 1;
  let zoomScale = 1;
  let isDockCollapsed = false;
  let isRightDockCollapsed = false;
  let isPaletteOpen = false;
  let lastFitSignature = '';
  const angleMarkerMode = { A: 0, B: 0, C: 0, D: 0 };
  const segmentArcMode = {
    side: { AB: 1, BC: 1, CD: 1, DA: 1 },
    diagonal: { AC: 1, BD: 1 }
  };
  const customLabelText = {
    side: { AB: '', BC: '', CD: '', DA: '' },
    angle: { A: '', B: '', C: '', D: '' },
    area: { main: '' },
    diagonal: { AC: '', BD: '' }
  };
  let figureState = {
    color: '#2a5bd7',
    rotation: 0,
    scale: 1,
    offset: { x: 0, y: 0 }
  };

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

  function getCustomAngleText(id, fallback) {
    const custom = window.InstantGeometrySharedLabelConfig.normalizeCustomLabelInput(customLabelText.angle[id]);
    return custom ? window.InstantGeometrySharedLabelConfig.formatAngleCustomText(custom, angleMode) : fallback;
  }

  function getCustomSegmentText(type, id, fallback) {
    const custom = window.InstantGeometrySharedLabelConfig.normalizeCustomLabelInput(customLabelText[type][id]);
    return custom ? appendUnit(custom, false) : appendUnit(fallback, false);
  }

  function getCustomAreaText(fallback) {
    const custom = window.InstantGeometrySharedLabelConfig.normalizeCustomLabelInput(customLabelText.area.main);
    return custom ? appendUnit(custom, true) : appendUnit(fallback, true);
  }

  function getSideName(id) {
    return id.split('').map(getVertexTokenByKey).join('');
  }

  function normalizeAngleMarkerInput(input) {
    const value = String(input || '').trim();
    if (!value || value === '0' || value === 'なし') return 0;
    if (value === '1' || value === '記号なし' || value === '弧') return 1;
    if (value === '2' || value === '○') return 2;
    if (value === '3' || value === '|' || value === '｜') return 3;
    if (value === '4' || value === '=') return 4;
    if (value === '5' || value.toLowerCase() === 'x' || value === '×') return 5;
    if (value === '6' || value === '△') return 6;
    if (value === '7' || value === '塗') return 7;
    return null;
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

  function hexToRgba(hex, alpha) {
    const normalized = String(hex || '#2a5bd7').replace('#', '');
    const source = normalized.length === 3
      ? normalized.split('').map(function (item) { return item + item; }).join('')
      : normalized;
    const value = parseInt(source, 16);
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
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
    const basePoints = {
      A: { x: -half, y: half },
      B: { x: -half, y: -half },
      C: { x: half, y: -half },
      D: { x: half, y: half }
    };
    const centroid = { x: figureState.offset.x, y: figureState.offset.y };
    const points = {};
    Object.keys(basePoints).forEach(function (key) {
      const scaled = {
        x: basePoints[key].x * figureState.scale,
        y: basePoints[key].y * figureState.scale
      };
      const rotated = rotatePoint(scaled, { x: 0, y: 0 }, figureState.rotation);
      points[key] = {
        x: rotated.x + figureState.offset.x,
        y: rotated.y + figureState.offset.y
      };
    });
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
    if (type === 'side') return getCustomSegmentText('side', id, formatNumber(side));
    if (type === 'angle') return getCustomAngleText(id, angleMode === 'degrees' ? '90°' : 'π/2');
    if (type === 'area') return getCustomAreaText(formatNumber(side * side));
    if (type === 'diagonal') return getCustomSegmentText('diagonal', id, (formatNumber(side) === '1' ? '' : formatNumber(side)) + '√2');
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
    if (customLabelText[type] && Object.prototype.hasOwnProperty.call(customLabelText[type], id)) {
      customLabelText[type][id] = '';
    }
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
      button.setAttribute('aria-pressed', String(!!labelState[config.type][config.id]));
      button.addEventListener('click', function () {
        labelState[config.type][config.id] = !labelState[config.type][config.id];
        if (!labelState[config.type][config.id] && selectedLabel && selectedLabel.type === config.type && selectedLabel.id === config.id) {
          selectedLabel = null;
          isPaletteOpen = false;
        }
        if (labelState[config.type][config.id]) resetSingleLabel(config.type, config.id);
        renderLabelToggleButtons();
        render();
      });
      if (config.type === 'vertex') {
        button.addEventListener('contextmenu', async function (event) {
          event.preventDefault();
          const current = getVertexTokenByKey(config.id);
          const next = window.prompt('頂点ラベル文字を入力してください（A-Z のみ）', current);
          if (next === null) return;
          const normalized = String(next).trim().toUpperCase();
          if (!normalized) {
            vertexLabelText[config.id] = config.id;
          } else if (/^[A-Z]+$/.test(normalized)) {
            vertexLabelText[config.id] = normalized.slice(0, 12);
          } else {
            setStatus('頂点ラベルは英字大文字（A-Z）のみ入力できます。', true);
            return;
          }
          renderLabelToggleButtons();
          render();
        });
      } else if (config.type === 'angle') {
        button.addEventListener('contextmenu', async function (event) {
          event.preventDefault();
          const currentMode = Number.isFinite(angleMarkerMode[config.id]) ? angleMarkerMode[config.id] : 0;
          const response = await window.InstantGeometrySharedLabelConfig.promptDualSetting({
            title: '角ラベル設定',
            firstLabel: '角マーク（0:なし / 1:記号なし / 2:○ / 3:| / 4:= / 5:× / 6:△ / 7:塗）',
            firstValue: String(currentMode),
            secondLabel: '文字（空欄で数値表示）',
            secondValue: customLabelText.angle[config.id] || ''
          });
          if (response === null) return;
          const mode = normalizeAngleMarkerInput(response.first);
          if (mode === null) {
            setStatus('角マークは「0 / 1 / 2 / 3 / 4 / 5 / 6 / 7」で指定してください。', true);
            return;
          }
          angleMarkerMode[config.id] = mode;
          customLabelText.angle[config.id] = response.second;
          labelState.angleMark[config.id] = (mode !== 0);
          if (!labelState.angleMark[config.id] && selectedLabel && selectedLabel.type === 'angleMark' && selectedLabel.id === config.id) {
            selectedLabel = null;
            isPaletteOpen = false;
          }
          if (mode !== 0) resetSingleLabel('angleMark', config.id);
          renderLabelToggleButtons();
          render();
        });
      } else if (config.type === 'side') {
        button.addEventListener('contextmenu', async function (event) {
          event.preventDefault();
          const currentMode = Number.isFinite(segmentArcMode.side[config.id]) ? segmentArcMode.side[config.id] : 1;
          const response = await window.InstantGeometrySharedLabelConfig.promptDualSetting({
            title: '線分ラベル設定',
            firstLabel: '弧表示（0:弧を非表示 / 1:弧を表示）',
            firstValue: String(currentMode),
            secondLabel: '文字（空欄で数値表示）',
            secondValue: customLabelText.side[config.id] || ''
          });
          if (response === null) return;
          const mode = window.InstantGeometrySharedOrnaments.normalizeSegmentArcInput(response.first);
          if (mode === null) {
            setStatus('線分ラベルの弧表示は「0 / 1」で指定してください。', true);
            return;
          }
          segmentArcMode.side[config.id] = mode;
          customLabelText.side[config.id] = response.second;
          render();
        });
      } else if (config.type === 'area') {
        button.addEventListener('contextmenu', async function (event) {
          event.preventDefault();
          const response = await window.InstantGeometrySharedLabelConfig.promptSingleText({
            title: '面積ラベル設定\n文字を使う場合は入力してください。空欄で数値表示に戻ります。',
            value: customLabelText.area.main || ''
          });
          if (response === null) return;
          customLabelText.area.main = response;
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
      button.setAttribute('aria-pressed', String(!!labelState[config.type][config.id]));
      button.addEventListener('click', function () {
        labelState[config.type][config.id] = !labelState[config.type][config.id];
        if (!labelState[config.type][config.id] && selectedLabel && selectedLabel.type === config.type && selectedLabel.id === config.id) {
          selectedLabel = null;
          isPaletteOpen = false;
        }
        if (labelState[config.type][config.id]) resetSingleLabel(config.type, config.id);
        renderLabelToggleButtons();
        render();
      });
      if (config.type === 'diagonal') {
        button.addEventListener('contextmenu', async function (event) {
          event.preventDefault();
          const currentMode = Number.isFinite(segmentArcMode.diagonal[config.id]) ? segmentArcMode.diagonal[config.id] : 1;
          const response = await window.InstantGeometrySharedLabelConfig.promptDualSetting({
            title: '線分ラベル設定',
            firstLabel: '弧表示（0:弧を非表示 / 1:弧を表示）',
            firstValue: String(currentMode),
            secondLabel: '文字（空欄で数値表示）',
            secondValue: customLabelText.diagonal[config.id] || ''
          });
          if (response === null) return;
          const mode = window.InstantGeometrySharedOrnaments.normalizeSegmentArcInput(response.first);
          if (mode === null) {
            setStatus('線分ラベルの弧表示は「0 / 1」で指定してください。', true);
            return;
          }
          segmentArcMode.diagonal[config.id] = mode;
          customLabelText.diagonal[config.id] = response.second;
          render();
        });
      }
      specialLabelToggleGrid.appendChild(button);
    });
  }

  function getSelectedAnchor() {
    if (!selectedLabel) return null;
    return currentLabelAnchors.find(function (item) {
      return item.type === selectedLabel.type && item.id === selectedLabel.id && !item.hidden;
    }) || null;
  }

  function getFigureSelectionAnchor() {
    if (!selectedFigure || !currentGeometry) return null;
    return {
      kind: 'figure',
      x: currentGeometry.centroid.x,
      y: currentGeometry.centroid.y,
      width: currentGeometry.side * figureState.scale,
      height: currentGeometry.side * figureState.scale,
      color: figureState.color,
      rotation: figureState.rotation
    };
  }

  function userToScreenPoint(point) {
    return {
      x: board.origin.scrCoords[1] + point.x * board.unitX,
      y: board.origin.scrCoords[2] - point.y * board.unitY
    };
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

  function rotateLabelGroupAround(center, angleDeg) {
    Object.keys(labelPositions).forEach(function (type) {
      Object.keys(labelPositions[type]).forEach(function (id) {
        const value = labelPositions[type][id];
        if (!value) return;
        labelPositions[type][id] = rotatePoint(value, center, angleDeg);
      });
    });
  }

  function translateLabelGroup(delta) {
    Object.keys(labelPositions).forEach(function (type) {
      Object.keys(labelPositions[type]).forEach(function (id) {
        const value = labelPositions[type][id];
        if (!value) return;
        labelPositions[type][id] = { x: value.x + delta.x, y: value.y + delta.y };
      });
    });
  }

  function scaleLabelGroupAround(center, ratio) {
    Object.keys(labelPositions).forEach(function (type) {
      Object.keys(labelPositions[type]).forEach(function (id) {
        const value = labelPositions[type][id];
        if (!value) return;
        labelPositions[type][id] = {
          x: center.x + (value.x - center.x) * ratio,
          y: center.y + (value.y - center.y) * ratio
        };
      });
    });
  }

  function scaleLabelFontGroup(ratio) {
    Object.keys(labelFontSize).forEach(function (type) {
      Object.keys(labelFontSize[type]).forEach(function (id) {
        labelFontSize[type][id] = Math.max(10, Math.min(320, Math.round(labelFontSize[type][id] * ratio)));
      });
    });
  }

  function distanceToSegment(point, P, Q) {
    const dx = Q.x - P.x;
    const dy = Q.y - P.y;
    const len2 = dx * dx + dy * dy;
    if (!len2) return Math.hypot(point.x - P.x, point.y - P.y);
    const t = Math.max(0, Math.min(1, ((point.x - P.x) * dx + (point.y - P.y) * dy) / len2));
    const proj = { x: P.x + dx * t, y: P.y + dy * t };
    return Math.hypot(point.x - proj.x, point.y - proj.y);
  }

  function pointInPolygon(point, vertices) {
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i, i += 1) {
      const xi = vertices[i].x;
      const yi = vertices[i].y;
      const xj = vertices[j].x;
      const yj = vertices[j].y;
      const intersect = ((yi > point.y) !== (yj > point.y)) &&
        (point.x < ((xj - xi) * (point.y - yi) / ((yj - yi) || 1e-9)) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function isFigureZone(point) {
    if (!currentGeometry) return false;
    const vertices = ['A', 'B', 'C', 'D'].map(function (key) { return currentGeometry.points[key]; });
    if (pointInPolygon(point, vertices)) return true;
    const tolerance = 0.22 * Math.max(1, figureState.scale);
    for (let index = 0; index < vertices.length; index += 1) {
      const P = vertices[index];
      const Q = vertices[(index + 1) % vertices.length];
      if (distanceToSegment(point, P, Q) <= tolerance) return true;
    }
    return false;
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
    halfWidth /= zoomScale;
    halfHeight /= zoomScale;
    if (box && exportFrame) {
      const frameWidthRatio = exportFrame.clientWidth / Math.max(box.clientWidth, 1);
      const frameHeightRatio = exportFrame.clientHeight / Math.max(box.clientHeight, 1);
      halfWidth /= Math.max(frameWidthRatio, 1e-4);
      halfHeight /= Math.max(frameHeightRatio, 1e-4);
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
    if (labelState.side.AB) window.InstantGeometrySharedOrnaments.drawSideArcLabel({ board: board, P: P.A, Q: P.B, center: geometry.centroid, text: getLabelText('side', 'AB', geometry), sideId: 'AB', showArc: segmentArcMode.side.AB !== 0, getLabelPosition: getLabelPosition, getLabelStyle: getLabelStyle, createSelectableText: function (position, text, fontSize, labelKey, options) { return window.InstantGeometrySharedLabels.createSelectableText({ board: board, labelLayer: labelLayer, currentLabelAnchors: currentLabelAnchors, getLabelStyle: getLabelStyle, position: position, text: text, fontSize: fontSize, labelKey: labelKey, options: options }); }, labelFontSize: labelFontSize });
    if (labelState.side.BC) window.InstantGeometrySharedOrnaments.drawSideArcLabel({ board: board, P: P.B, Q: P.C, center: geometry.centroid, text: getLabelText('side', 'BC', geometry), sideId: 'BC', showArc: segmentArcMode.side.BC !== 0, getLabelPosition: getLabelPosition, getLabelStyle: getLabelStyle, createSelectableText: function (position, text, fontSize, labelKey, options) { return window.InstantGeometrySharedLabels.createSelectableText({ board: board, labelLayer: labelLayer, currentLabelAnchors: currentLabelAnchors, getLabelStyle: getLabelStyle, position: position, text: text, fontSize: fontSize, labelKey: labelKey, options: options }); }, labelFontSize: labelFontSize });
    if (labelState.side.CD) window.InstantGeometrySharedOrnaments.drawSideArcLabel({ board: board, P: P.C, Q: P.D, center: geometry.centroid, text: getLabelText('side', 'CD', geometry), sideId: 'CD', showArc: segmentArcMode.side.CD !== 0, getLabelPosition: getLabelPosition, getLabelStyle: getLabelStyle, createSelectableText: function (position, text, fontSize, labelKey, options) { return window.InstantGeometrySharedLabels.createSelectableText({ board: board, labelLayer: labelLayer, currentLabelAnchors: currentLabelAnchors, getLabelStyle: getLabelStyle, position: position, text: text, fontSize: fontSize, labelKey: labelKey, options: options }); }, labelFontSize: labelFontSize });
    if (labelState.side.DA) window.InstantGeometrySharedOrnaments.drawSideArcLabel({ board: board, P: P.D, Q: P.A, center: geometry.centroid, text: getLabelText('side', 'DA', geometry), sideId: 'DA', showArc: segmentArcMode.side.DA !== 0, getLabelPosition: getLabelPosition, getLabelStyle: getLabelStyle, createSelectableText: function (position, text, fontSize, labelKey, options) { return window.InstantGeometrySharedLabels.createSelectableText({ board: board, labelLayer: labelLayer, currentLabelAnchors: currentLabelAnchors, getLabelStyle: getLabelStyle, position: position, text: text, fontSize: fontSize, labelKey: labelKey, options: options }); }, labelFontSize: labelFontSize });

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
        options: { color: '#687086', threshold: 0.6 }
      });
    });

    ['A', 'B', 'C', 'D'].forEach(function (id) {
      if (!labelState.angleMark[id]) return;
      drawAngleDecoration(id, geometry);
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
        options: { color: '#25603b', threshold: 0.8 }
      });
    }

    if (labelState.specialVertex.O) {
      window.InstantGeometrySharedLabels.createSelectableText({
        board: board,
        labelLayer: labelLayer,
        currentLabelAnchors: currentLabelAnchors,
        getLabelStyle: getLabelStyle,
        position: getLabelPosition('specialVertex', 'O', getDefaultPosition('specialVertex', 'O', geometry)),
        text: 'O',
        fontSize: labelFontSize.specialVertex.O,
        labelKey: { type: 'specialVertex', id: 'O' },
        options: { color: '#1f2430', threshold: 0.58 }
      });
    }

    ['AC', 'BD'].forEach(function (id) {
      if (!labelState.diagonal[id]) return;
      const pair = id === 'AC' ? [P.A, P.C] : [P.B, P.D];
      window.InstantGeometrySharedOrnaments.drawSideArcLabel({
        board: board,
        P: pair[0],
        Q: pair[1],
        center: geometry.centroid,
        text: getLabelText('diagonal', id, geometry),
        labelType: 'diagonal',
        labelId: id,
        labelFontGroup: 'diagonal',
        showArc: segmentArcMode.diagonal[id] !== 0,
        getLabelPosition: getLabelPosition,
        getLabelStyle: getLabelStyle,
        createSelectableText: function (position, text, fontSize, labelKey, options) {
          return window.InstantGeometrySharedLabels.createSelectableText({
            board: board,
            labelLayer: labelLayer,
            currentLabelAnchors: currentLabelAnchors,
            getLabelStyle: getLabelStyle,
            position: position,
            text: text,
            fontSize: fontSize,
            labelKey: labelKey,
            options: options
          });
        },
        labelFontSize: labelFontSize
      });
      board.create('segment', [[pair[0].x, pair[0].y], [pair[1].x, pair[1].y]], {
        fixed: true,
        strokeColor: '#9aa7c7',
        strokeWidth: 1.6,
        dash: 2,
        highlight: false
      });
    });

    renderSelectionOverlay(getSelectedAnchor() || getFigureSelectionAnchor());
  }

  function getAngleDecorationGeometry(angleId, geometry) {
    const P = geometry.points;
    if (angleId === 'A') return { vertex: P.A, p1: P.B, p2: P.D };
    if (angleId === 'B') return { vertex: P.B, p1: P.A, p2: P.C };
    if (angleId === 'C') return { vertex: P.C, p1: P.B, p2: P.D };
    if (angleId === 'D') return { vertex: P.D, p1: P.A, p2: P.C };
    return null;
  }

  function drawAngleDecoration(angleId, geometry) {
    const mode = Number.isFinite(angleMarkerMode[angleId]) ? angleMarkerMode[angleId] : 0;
    if (mode === 0) return;
    const data = getAngleDecorationGeometry(angleId, geometry);
    if (!data) return;
    const vertex = data.vertex;
    const p1 = data.p1;
    const p2 = data.p2;
    const side = geometry.side;
    const radius = Math.max(0.08, (side / 10) * Math.max(0.35, Math.min(8, labelFontSize.angleMark[angleId] / 26)));
    const a1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
    const a2 = Math.atan2(p2.y - vertex.y, p2.x - vertex.x);
    let delta = a2 - a1;
    while (delta <= -Math.PI) delta += Math.PI * 2;
    while (delta > Math.PI) delta -= Math.PI * 2;
    if (Math.abs(delta) < 1e-4) return;

    const style = getLabelStyle('angleMark', angleId);
    const color = style.color || '#687086';
    const start = { x: vertex.x + radius * Math.cos(a1), y: vertex.y + radius * Math.sin(a1) };
    const end = { x: vertex.x + radius * Math.cos(a1 + delta), y: vertex.y + radius * Math.sin(a1 + delta) };
    board.create('segment', [[vertex.x, vertex.y], [start.x, start.y]], { fixed: true, strokeWidth: 1.4, strokeColor: color, highlight: false });
    board.create('segment', [[vertex.x, vertex.y], [end.x, end.y]], { fixed: true, strokeWidth: 1.4, strokeColor: color, highlight: false });
    board.create('curve', [
      function (t) { const angle = a1 + delta * t; return vertex.x + radius * Math.cos(angle); },
      function (t) { const angle = a1 + delta * t; return vertex.y + radius * Math.sin(angle); },
      0,
      1
    ], { fixed: true, strokeWidth: 1.8, strokeColor: color, highlight: false });

    const midAngle = a1 + delta / 2;
    const symbolCenter = { x: vertex.x + radius * Math.cos(midAngle), y: vertex.y + radius * Math.sin(midAngle) };
    const towardCenter = { x: vertex.x - symbolCenter.x, y: vertex.y - symbolCenter.y };
    const towardLen = Math.hypot(towardCenter.x, towardCenter.y) || 1;
    const dir = { x: towardCenter.x / towardLen, y: towardCenter.y / towardLen };
    const normal = { x: -dir.y, y: dir.x };
    const symbolSize = Math.max(0.03, radius * 0.34);

    if (mode === 2) {
      const circleSize = symbolSize * 0.5;
      board.create('curve', [
        function (t) { return symbolCenter.x + circleSize * Math.cos(t); },
        function (t) { return symbolCenter.y + circleSize * Math.sin(t); },
        0,
        Math.PI * 2
      ], { fixed: true, strokeWidth: 1.6, strokeColor: color, highlight: false });
    } else if (mode === 3) {
      const barSize = symbolSize * 0.5;
      board.create('segment', [[symbolCenter.x - dir.x * barSize, symbolCenter.y - dir.y * barSize], [symbolCenter.x + dir.x * barSize, symbolCenter.y + dir.y * barSize]], { fixed: true, strokeWidth: 1.8, strokeColor: color, highlight: false });
    } else if (mode === 4) {
      const barSize = symbolSize * 0.5;
      const sep = barSize * 0.46;
      board.create('segment', [[symbolCenter.x - dir.x * barSize + normal.x * sep, symbolCenter.y - dir.y * barSize + normal.y * sep], [symbolCenter.x + dir.x * barSize + normal.x * sep, symbolCenter.y + dir.y * barSize + normal.y * sep]], { fixed: true, strokeWidth: 1.8, strokeColor: color, highlight: false });
      board.create('segment', [[symbolCenter.x - dir.x * barSize - normal.x * sep, symbolCenter.y - dir.y * barSize - normal.y * sep], [symbolCenter.x + dir.x * barSize - normal.x * sep, symbolCenter.y + dir.y * barSize - normal.y * sep]], { fixed: true, strokeWidth: 1.8, strokeColor: color, highlight: false });
    } else if (mode === 5) {
      const crossSize = symbolSize * 0.5;
      board.create('segment', [[symbolCenter.x - dir.x * crossSize - normal.x * crossSize, symbolCenter.y - dir.y * crossSize - normal.y * crossSize], [symbolCenter.x + dir.x * crossSize + normal.x * crossSize, symbolCenter.y + dir.y * crossSize + normal.y * crossSize]], { fixed: true, strokeWidth: 1.8, strokeColor: color, highlight: false });
      board.create('segment', [[symbolCenter.x - dir.x * crossSize + normal.x * crossSize, symbolCenter.y - dir.y * crossSize + normal.y * crossSize], [symbolCenter.x + dir.x * crossSize - normal.x * crossSize, symbolCenter.y + dir.y * crossSize - normal.y * crossSize]], { fixed: true, strokeWidth: 1.8, strokeColor: color, highlight: false });
    } else if (mode === 6) {
      const triSize = symbolSize * 0.5;
      const tip = { x: symbolCenter.x - dir.x * triSize * 1.15, y: symbolCenter.y - dir.y * triSize * 1.15 };
      const baseL = { x: symbolCenter.x + dir.x * triSize * 0.85 + normal.x * triSize * 0.9, y: symbolCenter.y + dir.y * triSize * 0.85 + normal.y * triSize * 0.9 };
      const baseR = { x: symbolCenter.x + dir.x * triSize * 0.85 - normal.x * triSize * 0.9, y: symbolCenter.y + dir.y * triSize * 0.85 - normal.y * triSize * 0.9 };
      board.create('segment', [[tip.x, tip.y], [baseL.x, baseL.y]], { fixed: true, strokeWidth: 1.8, strokeColor: color, highlight: false });
      board.create('segment', [[baseL.x, baseL.y], [baseR.x, baseR.y]], { fixed: true, strokeWidth: 1.8, strokeColor: color, highlight: false });
      board.create('segment', [[baseR.x, baseR.y], [tip.x, tip.y]], { fixed: true, strokeWidth: 1.8, strokeColor: color, highlight: false });
    } else if (mode === 7) {
      const sectorPoints = [{ x: vertex.x, y: vertex.y }];
      for (let i = 0; i <= 18; i += 1) {
        const t = i / 18;
        const angle = a1 + delta * t;
        sectorPoints.push({ x: vertex.x + radius * Math.cos(angle), y: vertex.y + radius * Math.sin(angle) });
      }
      board.create('polygon', sectorPoints.map(function (p) { return [p.x, p.y]; }), {
        fixed: true,
        borders: { visible: false, highlight: false },
        vertices: { visible: false },
        fillColor: color,
        fillOpacity: 1,
        highlight: false
      });
    }

    const sampleAngles = [0, 0.25, 0.5, 0.75, 1].map(function (t) {
      const angle = a1 + delta * t;
      return { x: vertex.x + radius * Math.cos(angle), y: vertex.y + radius * Math.sin(angle) };
    });
    const boundsPoints = sampleAngles.concat(
      mode === 7
        ? [{ x: vertex.x, y: vertex.y }]
        : [
          { x: symbolCenter.x + normal.x * symbolSize, y: symbolCenter.y + normal.y * symbolSize },
          { x: symbolCenter.x - normal.x * symbolSize, y: symbolCenter.y - normal.y * symbolSize },
          { x: symbolCenter.x + dir.x * symbolSize, y: symbolCenter.y + dir.y * symbolSize },
          { x: symbolCenter.x - dir.x * symbolSize, y: symbolCenter.y - dir.y * symbolSize }
        ]
    );
    const screenPoints = boundsPoints.map(userToScreenPoint);
    const xs = screenPoints.map(function (pt) { return pt.x; });
    const ys = screenPoints.map(function (pt) { return pt.y; });
    currentLabelAnchors.push({
      type: 'angleMark',
      id: angleId,
      x: symbolCenter.x,
      y: symbolCenter.y,
      scaleCenter: { x: vertex.x, y: vertex.y },
      screenRect: {
        left: Math.min.apply(null, xs),
        right: Math.max.apply(null, xs),
        top: Math.min.apply(null, ys),
        bottom: Math.max.apply(null, ys)
      },
      fontSize: labelFontSize.angleMark[angleId],
      rotation: 0,
      color: color
    });
  }

  function findAnchorAtPoint(point) {
    for (let index = currentLabelAnchors.length - 1; index >= 0; index -= 1) {
      const anchor = currentLabelAnchors[index];
      if (!anchor.screenRect) continue;
      const screen = userToScreenPoint(point);
      if (screen.x >= anchor.screenRect.left && screen.x <= anchor.screenRect.right && screen.y >= anchor.screenRect.top && screen.y <= anchor.screenRect.bottom) {
        return { type: anchor.type, id: anchor.id };
      }
    }
    return null;
  }

  function renderFigure(geometry) {
    const P = geometry.points;
    const pointA = board.create('point', [P.A.x, P.A.y], { name: '', size: 3, fixed: true, strokeColor: '#111111', fillColor: '#111111' });
    const pointB = board.create('point', [P.B.x, P.B.y], { name: '', size: 3, fixed: true, strokeColor: '#111111', fillColor: '#111111' });
    const pointC = board.create('point', [P.C.x, P.C.y], { name: '', size: 3, fixed: true, strokeColor: '#111111', fillColor: '#111111' });
    const pointD = board.create('point', [P.D.x, P.D.y], { name: '', size: 3, fixed: true, strokeColor: '#111111', fillColor: '#111111' });
    board.create('polygon', [pointA, pointB, pointC, pointD], {
      borders: { strokeWidth: 2, strokeColor: figureState.color, fixed: true, highlight: false },
      fillColor: hexToRgba(figureState.color, 0.08),
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
    const type = target.dataset.type;
    const id = target.dataset.id;
    if (!type || !id) return;
    selectedLabel = { type: type, id: id };
    selectedFigure = false;
    isPaletteOpen = false;
    render();
    const anchor = currentLabelAnchors.find(function (item) {
      return item.type === type && item.id === id && !item.hidden;
    });
    const position = (labelPositions[type] && labelPositions[type][id]) || (anchor ? { x: anchor.x, y: anchor.y } : null);
    if (!position) return;
    dragState = {
      mode: 'move',
      type: type,
      id: id,
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

    if ((selectedLabel || selectedFigure) && overlayControl) {
      if (overlayControl.mode === 'palette-color') {
        if (selectedLabel) {
          labelStyleState[selectedLabel.type][selectedLabel.id].color = overlayControl.color;
        } else {
          figureState.color = overlayControl.color;
        }
        isPaletteOpen = false;
        render();
        return;
      }
      if (overlayControl.mode === 'palette') {
        isPaletteOpen = !isPaletteOpen;
        render();
        return;
      }
      if (overlayControl.mode === 'rotate' && selectedLabel && selectedLabel.type === 'angleMark') {
        return;
      }
      const anchor = selectedLabel ? getSelectedAnchor() : getFigureSelectionAnchor();
      if (!anchor) return;
      const dragCenter = (selectedLabel && selectedLabel.type === 'angleMark' && anchor.scaleCenter)
        ? { x: anchor.scaleCenter.x, y: anchor.scaleCenter.y }
        : { x: anchor.x, y: anchor.y };
      dragState = {
        mode: overlayControl.mode,
        target: selectedLabel ? 'label' : 'figure',
        type: selectedLabel ? selectedLabel.type : 'figure',
        id: selectedLabel ? selectedLabel.id : 'main',
        startClient: { x: event.clientX, y: event.clientY },
        center: dragCenter,
        fontSizeStart: selectedLabel ? labelFontSize[selectedLabel.type][selectedLabel.id] : null,
        scaleStart: selectedFigure ? figureState.scale : null,
        rotationStart: selectedLabel ? labelStyleState[selectedLabel.type][selectedLabel.id].rotation : figureState.rotation,
        distanceStart: Math.hypot(point.x - dragCenter.x, point.y - dragCenter.y),
        angleStart: Math.atan2(point.y - dragCenter.y, point.x - dragCenter.x)
      };
      return;
    }

    const anchorHit = findAnchorAtPoint(point);
    if (anchorHit) {
      selectedLabel = anchorHit;
      selectedFigure = false;
      isPaletteOpen = false;
      render();
      if (anchorHit.type === 'angleMark') return;
      return;
    }

    if (isFigureZone(point)) {
      selectedLabel = null;
      selectedFigure = true;
      isPaletteOpen = false;
      dragState = {
        mode: 'figure-move',
        target: 'figure',
        startClient: { x: event.clientX, y: event.clientY },
        offsetStart: { x: figureState.offset.x, y: figureState.offset.y }
      };
      render();
      return;
    }

    selectedLabel = null;
    selectedFigure = false;
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
      if (dragState.target === 'label') {
        labelFontSize[dragState.type][dragState.id] = Math.max(10, Math.min(320, Math.round(dragState.fontSizeStart * ratio)));
      } else {
        const nextScale = Math.max(0.3, Math.min(4, dragState.scaleStart * ratio));
        const scaleRatio = nextScale / Math.max(figureState.scale, 1e-9);
        if (Math.abs(scaleRatio - 1) > 1e-9) {
          scaleLabelGroupAround(currentGeometry.centroid, scaleRatio);
          scaleLabelFontGroup(scaleRatio);
        }
        figureState.scale = nextScale;
      }
      scheduleRender();
      return;
    }

    if (dragState.mode === 'rotate') {
      const currentAngle = Math.atan2(point.y - dragState.center.y, point.x - dragState.center.x);
      if (dragState.target === 'label') {
        labelStyleState[dragState.type][dragState.id].rotation = dragState.rotationStart + ((currentAngle - dragState.angleStart) * 180 / Math.PI);
      } else {
        const nextRotation = dragState.rotationStart + ((currentAngle - dragState.angleStart) * 180 / Math.PI);
        const deltaRotation = nextRotation - figureState.rotation;
        if (Math.abs(deltaRotation) > 1e-9) {
          rotateLabelGroupAround(currentGeometry.centroid, deltaRotation);
        }
        figureState.rotation = nextRotation;
      }
      scheduleRender();
      return;
    }

    if (dragState.mode === 'figure-move') {
      const boundingBox = board.getBoundingBox();
      const unitsPerPixelX = (boundingBox[2] - boundingBox[0]) / Math.max(box.clientWidth, 1);
      const unitsPerPixelY = (boundingBox[1] - boundingBox[3]) / Math.max(box.clientHeight, 1);
      const nextOffset = {
        x: dragState.offsetStart.x + (event.clientX - dragState.startClient.x) * unitsPerPixelX,
        y: dragState.offsetStart.y - (event.clientY - dragState.startClient.y) * unitsPerPixelY
      };
      const delta = {
        x: nextOffset.x - figureState.offset.x,
        y: nextOffset.y - figureState.offset.y
      };
      if (Math.abs(delta.x) > 1e-9 || Math.abs(delta.y) > 1e-9) {
        translateLabelGroup(delta);
      }
      figureState.offset = nextOffset;
      scheduleRender();
    }
  });

  window.addEventListener('mouseup', function () {
    dragState = null;
  });

  sideInput.addEventListener('input', function () {
    selectedLabel = null;
    selectedFigure = false;
    isPaletteOpen = false;
    zoomScale = 1;
    render();
  });

  box.addEventListener('wheel', function (event) {
    event.preventDefault();
    zoomScale = Math.max(0.45, Math.min(4, zoomScale * (event.deltaY < 0 ? 1.08 : 1 / 1.08)));
    lastFitSignature = '';
    render();
  }, { passive: false });

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
    zoomScale = 1;
    labelStyleState = JSON.parse(JSON.stringify(styleDefaults));
    Object.keys(labelPositions).forEach(function (group) {
      Object.keys(labelPositions[group]).forEach(function (id) {
        labelPositions[group][id] = null;
        labelFontSize[group][id] = labelFontDefaults[group][id];
        labelState[group][id] = defaultLabelState[group][id];
      });
    });
    Object.keys(angleMarkerMode).forEach(function (id) {
      angleMarkerMode[id] = 0;
    });
    Object.keys(segmentArcMode.side).forEach(function (id) {
      segmentArcMode.side[id] = 1;
    });
    Object.keys(segmentArcMode.diagonal).forEach(function (id) {
      segmentArcMode.diagonal[id] = 1;
    });
    Object.keys(customLabelText.side).forEach(function (id) { customLabelText.side[id] = ''; });
    Object.keys(customLabelText.angle).forEach(function (id) { customLabelText.angle[id] = ''; });
    Object.keys(customLabelText.diagonal).forEach(function (id) { customLabelText.diagonal[id] = ''; });
    customLabelText.area.main = '';
    figureState = {
      color: '#2a5bd7',
      rotation: 0,
      scale: 1,
      offset: { x: 0, y: 0 }
    };
    selectedLabel = null;
    selectedFigure = false;
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
