(function () {
  'use strict';

  const exportAspects = [
    { label: '1:1', value: 1 },
    { label: '1:√2', value: 1 / Math.SQRT2 },
    { label: '√2:1', value: Math.SQRT2 }
  ];
  const unitOptions = ['', 'cm', 'm', 'km'];

  const inputElements = Array.from(document.querySelectorAll('[data-sector-input]')).reduce(function (acc, element) {
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
  const unitBtn = document.getElementById('unitBtn');
  const pageBackBtn = document.getElementById('pageBackBtn');
  const downloadButtons = document.querySelectorAll('[data-download-format]');
  const box = document.getElementById('box');
  const exportBackdrop = document.getElementById('exportBackdrop');
  const exportFrame = document.getElementById('exportFrame');

  const board = JXG.JSXGraph.initBoard('box', {
    boundingbox: [-6, 6, 6, -6],
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

  const pointLabelText = { O: 'O', A: 'A', B: 'B' };
  const defaultLabelState = {
    point: { O: true, A: true, B: true },
    segment: { OA: true, OB: true },
    angle: { AOB: false },
    angleMark: { AOB: false },
    rightAngleMark: { AOB: false },
    area: { main: false }
  };
  const labelState = JSON.parse(JSON.stringify(defaultLabelState));
  const labelFontDefaults = {
    point: { O: 36, A: 36, B: 36 },
    segment: { OA: 30, OB: 30 },
    angle: { AOB: 28 },
    angleMark: { AOB: 26 },
    rightAngleMark: { AOB: 26 },
    area: { main: 48 }
  };
  const labelFontSize = JSON.parse(JSON.stringify(labelFontDefaults));
  const styleDefaults = {
    point: { O: style('#1f2430'), A: style('#1f2430'), B: style('#1f2430') },
    segment: { OA: style('#2a5bd7'), OB: style('#2a5bd7') },
    angle: { AOB: style('#687086') },
    angleMark: { AOB: style('#687086') },
    rightAngleMark: { AOB: style('#111111') },
    area: { main: style('#25603b') }
  };
  let labelStyleState = JSON.parse(JSON.stringify(styleDefaults));
  const labelPositions = {
    point: { O: null, A: null, B: null },
    segment: { OA: null, OB: null },
    angle: { AOB: null },
    angleMark: { AOB: null },
    rightAngleMark: { AOB: null },
    area: { main: null }
  };
  const customLabelText = { segment: { OA: '', OB: '' }, angle: { AOB: '' }, area: { main: '' } };
  const angleMarkerMode = { AOB: 0 };
  const rightAngleMarkerMode = { AOB: 0 };
  const segmentArcMode = { OA: 1, OB: 1 };
  const segmentLineMode = { OA: 1, OB: 1 };

  let currentGeometry = null;
  let currentLabelAnchors = [];
  let currentSelectionOverlay = null;
  let selectedLabel = null;
  let selectedFigure = false;
  let dragState = null;
  let renderRafId = null;
  let exportAspectIndex = 0;
  let unitIndex = 1;
  let angleMode = 'degrees';
  let zoomScale = 1;
  let isDockCollapsed = false;
  let isRightDockCollapsed = false;
  let isPaletteOpen = false;
  let lastFitSignature = '';
  let figureState = { color: '#2a5bd7', rotation: 0, scale: 1, offset: { x: 0, y: 0 } };

  function style(color) { return { color: color, rotation: 0 }; }
  function setStatus(message, isError) { statusBox.textContent = message; statusBox.classList.toggle('error', !!isError); }
  function updateRatioButton() { ratioBtn.textContent = '画面比 ' + exportAspects[exportAspectIndex].label; }
  function updateUnitButton() { unitBtn.textContent = unitOptions[unitIndex] ? '長さ' + unitOptions[unitIndex] : '単位なし'; }
  function updateAngleModeButton() { angleModeBtn.textContent = angleMode === 'degrees' ? '度数法' : '弧度法'; }
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
      if (!Number.isFinite(value) || value <= 0) throw new Error('0より大きい値を入力してください。');
      return value;
    } catch (_) {
      throw new Error('式を読み取れませんでした。');
    }
  }
  function parseCentralAngle(raw) {
    const source = String(raw || '').trim();
    const value = evaluateExpression(source);
    if (!source) throw new Error('中心角を入力してください。');
    if (/[πpi]|deg|sin|cos|tan/i.test(source)) {
      const degrees = value * 180 / Math.PI;
      if (!(degrees > 0 && degrees < 360)) throw new Error('中心角は 0° より大きく 360° 未満にしてください。');
      return degrees;
    }
    if (!(value > 0 && value < 360)) throw new Error('中心角は 0° より大きく 360° 未満にしてください。');
    return value;
  }
  function formatNumber(value) {
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  }
  function appendUnit(text, square) {
    const unit = unitOptions[unitIndex];
    return unit ? (text + unit + (square ? '²' : '')) : text;
  }
  function hexToRgba(hex, alpha) {
    const normalized = String(hex || '#2a5bd7').replace('#', '');
    const source = normalized.length === 3 ? normalized.split('').map(function (s) { return s + s; }).join('') : normalized;
    const value = parseInt(source, 16);
    return 'rgba(' + ((value >> 16) & 255) + ',' + ((value >> 8) & 255) + ',' + (value & 255) + ',' + alpha + ')';
  }
  function rotatePoint(point, center, angleDeg) {
    const rad = angleDeg * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos };
  }
  function userToScreenPoint(point) { return { x: board.origin.scrCoords[1] + point.x * board.unitX, y: board.origin.scrCoords[2] - point.y * board.unitY }; }
  function getLabelStyle(type, id) { return labelStyleState[type] && labelStyleState[type][id] ? labelStyleState[type][id] : { color: '#2a5bd7', rotation: 0 }; }
  function createSelectableText(position, text, fontSize, labelKey, options) {
    return window.InstantGeometrySharedLabels.createSelectableText({
      board: board, labelLayer: labelLayer, currentLabelAnchors: currentLabelAnchors, getLabelStyle: getLabelStyle,
      position: position, text: text, fontSize: fontSize, labelKey: labelKey, options: options
    });
  }
  function getLabelPosition(type, id, basePosition) {
    const stored = labelPositions[type][id];
    if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) return stored;
    labelPositions[type][id] = { x: basePosition.x, y: basePosition.y };
    return labelPositions[type][id];
  }
  function getLabelBounds(anchor) {
    const padPx = 6;
    const widthPx = anchor.screenRect ? Math.max(10, (anchor.screenRect.right - anchor.screenRect.left) + padPx * 2) : Math.max(10, String(anchor.text || '').length * anchor.fontSize * 0.56) + padPx * 2;
    const heightPx = anchor.screenRect ? Math.max(10, (anchor.screenRect.bottom - anchor.screenRect.top) + padPx * 2) : Math.max(10, anchor.fontSize) + padPx * 2;
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

  function getGeometryFromInputs() {
    const radiusX = evaluateExpression(inputElements.radius1Len.value);
    const radiusY = evaluateExpression(inputElements.radius2Len.value);
    const degrees = parseCentralAngle(inputElements.angleLen.value);
    const theta = degrees * Math.PI / 180;
    const basePoints = {
      O: { x: 0, y: 0 },
      A: { x: radiusX, y: 0 },
      B: { x: radiusX * Math.cos(theta), y: radiusY * Math.sin(theta) }
    };
    const transformed = transformBasePoints(basePoints);
    return {
      points: transformed.points,
      centroid: transformed.centroid,
      radiusX: radiusX * figureState.scale,
      radiusY: radiusY * figureState.scale,
      ref: Math.max(radiusX, radiusY) * figureState.scale,
      angleDegrees: degrees,
      angleRadians: theta,
      area: 0.5 * radiusX * radiusY * theta * figureState.scale * figureState.scale,
      baseBounds: { width: radiusX * 2 * figureState.scale, height: radiusY * 2 * figureState.scale }
    };
  }
  function transformBasePoints(basePoints) {
    const points = {};
    Object.keys(basePoints).forEach(function (key) {
      const scaled = { x: basePoints[key].x * figureState.scale, y: basePoints[key].y * figureState.scale };
      const rotated = rotatePoint(scaled, { x: 0, y: 0 }, figureState.rotation);
      points[key] = { x: rotated.x + figureState.offset.x, y: rotated.y + figureState.offset.y };
    });
    return { points: points, centroid: { x: figureState.offset.x, y: figureState.offset.y } };
  }
  function getDefaultPosition(type, id, geometry) {
    const O = geometry.points.O;
    if (type === 'point') {
      if (id === 'O') return { x: O.x + geometry.ref * 0.18, y: O.y + geometry.ref * 0.18 };
      return { x: geometry.points[id].x * 1.08 - O.x * 0.08, y: geometry.points[id].y * 1.08 - O.y * 0.08 };
    }
    if (type === 'segment') {
      const P = geometry.points[id.charAt(0)];
      const Q = geometry.points[id.charAt(1)];
      const mid = { x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 };
      const dx = Q.x - P.x;
      const dy = Q.y - P.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      return { x: mid.x + nx * geometry.ref * 0.12, y: mid.y + ny * geometry.ref * 0.12 };
    }
    if (type === 'angle') {
      const half = geometry.angleRadians / 2 + figureState.rotation * Math.PI / 180;
      return { x: O.x + Math.cos(half) * geometry.ref * 0.28, y: O.y + Math.sin(half) * geometry.ref * 0.28 };
    }
    const half = geometry.angleRadians / 2 + figureState.rotation * Math.PI / 180;
    return { x: O.x + Math.cos(half) * geometry.ref * 0.46, y: O.y + Math.sin(half) * geometry.ref * 0.46 };
  }
  function getLabelText(type, id, geometry) {
    if (type === 'point') return pointLabelText[id];
    if (type === 'segment') {
      const custom = window.InstantGeometrySharedLabelConfig.normalizeCustomLabelInput(customLabelText.segment[id]);
      const P = geometry.points[id.charAt(0)];
      const Q = geometry.points[id.charAt(1)];
      return custom ? appendUnit(custom, false) : appendUnit(formatNumber(Math.hypot(Q.x - P.x, Q.y - P.y)), false);
    }
    if (type === 'angle') {
      const base = angleMode === 'degrees' ? (formatNumber(geometry.angleDegrees) + '°') : formatNumber(geometry.angleRadians);
      const custom = window.InstantGeometrySharedLabelConfig.normalizeCustomLabelInput(customLabelText.angle.AOB);
      return custom ? window.InstantGeometrySharedLabelConfig.formatAngleCustomText(custom, angleMode) : base;
    }
    const customArea = window.InstantGeometrySharedLabelConfig.normalizeCustomLabelInput(customLabelText.area.main);
    return customArea ? appendUnit(customArea, true) : appendUnit(formatNumber(geometry.area), true);
  }
  function getGeneralConfigs() {
    return [
      { type: 'point', id: 'O' }, { type: 'point', id: 'A' }, { type: 'point', id: 'B' },
      { type: 'segment', id: 'OA' }, { type: 'segment', id: 'OB' },
      { type: 'angle', id: 'AOB' },
      { type: 'area', id: 'main' }
    ];
  }
  function getToggleLabel(config) {
    if (config.type === 'point') return pointLabelText[config.id];
    if (config.type === 'segment') return config.id;
    if (config.type === 'angle') return '∠AOB';
    return '楕円扇形AOB';
  }
  function resetSingleLabel(type, id) {
    labelPositions[type][id] = null;
    labelFontSize[type][id] = labelFontDefaults[type][id];
    labelStyleState[type][id] = JSON.parse(JSON.stringify(styleDefaults[type][id]));
    if (customLabelText[type] && Object.prototype.hasOwnProperty.call(customLabelText[type], id)) customLabelText[type][id] = '';
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
        if (!labelState[config.type][config.id] && selectedLabel && selectedLabel.type === config.type && selectedLabel.id === config.id) { selectedLabel = null; isPaletteOpen = false; }
        if (labelState[config.type][config.id]) resetSingleLabel(config.type, config.id);
        renderLabelToggleButtons();
        render();
      });
      button.addEventListener('contextmenu', async function (event) {
        event.preventDefault();
        if (config.type === 'point') {
          const response = await window.InstantGeometrySharedLabelConfig.promptSingleText({ title: '点ラベル設定', firstLabel: '文字（A-Z のみ）', value: pointLabelText[config.id] });
          if (response === null) return;
          const normalized = String(response).trim().toUpperCase();
          if (!normalized) pointLabelText[config.id] = config.id;
          else if (/^[A-Z]+$/.test(normalized)) pointLabelText[config.id] = normalized.slice(0, 12);
          else { setStatus('点ラベルは英字大文字（A-Z）のみ入力できます。', true); return; }
          renderLabelToggleButtons();
          render();
          return;
        }
        if (config.type === 'segment') {
          const response = await window.InstantGeometrySharedLabelConfig.promptTripleSetting({
            title: '線分ラベル設定',
            firstLabel: '線分表示（0:線分を非表示 / 1:線分を表示）',
            firstValue: String(segmentLineMode[config.id]),
            secondLabel: '弧表示（0:弧を非表示 / 1:弧を表示）',
            secondValue: String(segmentArcMode[config.id]),
            thirdLabel: '文字（空欄で数値表示）',
            thirdValue: customLabelText.segment[config.id] || '',
            firstBinary: true, secondBinary: true
          });
          if (response === null) return;
          const lineMode = window.InstantGeometrySharedOrnaments.normalizeSegmentArcInput(response.first);
          const arcMode = window.InstantGeometrySharedOrnaments.normalizeSegmentArcInput(response.second);
          if (lineMode === null) { setStatus('線分表示は「0 / 1」で指定してください。', true); return; }
          if (arcMode === null) { setStatus('線分ラベルの弧表示は「0 / 1」で指定してください。', true); return; }
          segmentLineMode[config.id] = lineMode;
          segmentArcMode[config.id] = arcMode;
          customLabelText.segment[config.id] = response.third;
          render();
          return;
        }
        if (config.type === 'angle') {
          const geometry = currentGeometry || getGeometryFromInputs();
          const canUseRightMarker = Math.abs(geometry.angleDegrees - 90) < 1e-4;
          const response = await window.InstantGeometrySharedLabelConfig.promptTripleSetting({
            title: '角ラベル設定',
            firstLabel: '角マーク（0:なし / 1:記号なし / 2:○ / 3:| / 4:= / 5:× / 6:△ / 7:塗）',
            firstValue: String(angleMarkerMode.AOB),
            secondLabel: '文字（空欄で数値表示）',
            secondValue: customLabelText.angle.AOB || '',
            thirdLabel: '直角マーク（0:非表示 / 1:表示）',
            thirdValue: canUseRightMarker ? String(rightAngleMarkerMode.AOB) : '90°以外は設定不可',
            thirdDisabled: !canUseRightMarker
          });
          if (response === null) return;
          const mode = /^[0-7]$/.test(String(response.first || '').trim()) ? Number(response.first) : null;
          if (mode === null) { setStatus('角マークは「0 / 1 / 2 / 3 / 4 / 5 / 6 / 7」で指定してください。', true); return; }
          angleMarkerMode.AOB = mode;
          customLabelText.angle.AOB = response.second;
          if (canUseRightMarker) {
            const rightMode = String(response.third || '').trim();
            if (!(rightMode === '0' || rightMode === '1')) { setStatus('直角マークは「0 / 1」で指定してください。', true); return; }
            rightAngleMarkerMode.AOB = Number(rightMode);
          } else rightAngleMarkerMode.AOB = 0;
          labelState.angleMark.AOB = mode !== 0;
          labelState.rightAngleMark.AOB = rightAngleMarkerMode.AOB !== 0;
          if (labelState.angleMark.AOB) resetSingleLabel('angleMark', 'AOB');
          if (labelState.rightAngleMark.AOB) resetSingleLabel('rightAngleMark', 'AOB');
          render();
          return;
        }
        if (config.type === 'area') {
          const response = await window.InstantGeometrySharedLabelConfig.promptSingleText({ title: '面積ラベル設定', firstLabel: '文字（空欄で数値表示）', value: customLabelText.area.main || '' });
          if (response === null) return;
          customLabelText.area.main = response;
          render();
        }
      });
      generalLabelToggleGrid.appendChild(button);
    });
  }

  function translateLabelGroup(delta) {
    Object.keys(labelPositions).forEach(function (group) {
      Object.keys(labelPositions[group]).forEach(function (id) {
        const value = labelPositions[group][id];
        if (!value) return;
        labelPositions[group][id] = { x: value.x + delta.x, y: value.y + delta.y };
      });
    });
  }
  function rotateLabelGroupAround(center, angleDeg) {
    Object.keys(labelPositions).forEach(function (group) {
      Object.keys(labelPositions[group]).forEach(function (id) {
        const value = labelPositions[group][id];
        if (!value) return;
        labelPositions[group][id] = rotatePoint(value, center, angleDeg);
      });
    });
  }
  function scaleLabelGroupAround(center, ratio) {
    Object.keys(labelPositions).forEach(function (group) {
      Object.keys(labelPositions[group]).forEach(function (id) {
        const value = labelPositions[group][id];
        if (!value) return;
        labelPositions[group][id] = { x: center.x + (value.x - center.x) * ratio, y: center.y + (value.y - center.y) * ratio };
      });
    });
  }
  function scaleLabelFontGroup(ratio) {
    Object.keys(labelFontSize).forEach(function (group) {
      Object.keys(labelFontSize[group]).forEach(function (id) {
        const minFontSize = group === 'rightAngleMark' ? 4 : 10;
        labelFontSize[group][id] = Math.max(minFontSize, Math.min(320, Math.round(labelFontSize[group][id] * ratio)));
      });
    });
  }
  function renderSelectionOverlay(anchor) {
    currentSelectionOverlay = anchor ? window.InstantGeometrySharedSelection.renderSelectionOverlay({
      board: board, anchor: anchor, rotatePoint: rotatePoint, getLabelBounds: getLabelBounds, isPaletteOpen: isPaletteOpen
    }) : null;
  }
  function findSelectionControl(point) { return window.InstantGeometrySharedSelection.findSelectionControl(point, currentSelectionOverlay); }
  function getSelectedAnchor() {
    if (!selectedLabel) return null;
    return currentLabelAnchors.find(function (item) { return item.type === selectedLabel.type && item.id === selectedLabel.id; }) || null;
  }
  function getFigureSelectionAnchor() {
    if (!selectedFigure || !currentGeometry) return null;
    return { kind: 'figure', x: currentGeometry.centroid.x, y: currentGeometry.centroid.y, width: Math.max(currentGeometry.baseBounds.width, 0.8), height: Math.max(currentGeometry.baseBounds.height, 0.8), color: figureState.color, rotation: figureState.rotation };
  }
  function normalizeAngle(rad) {
    let value = rad;
    while (value < 0) value += Math.PI * 2;
    while (value >= Math.PI * 2) value -= Math.PI * 2;
    return value;
  }
  function pointInFigureZone(point) {
    if (!currentGeometry) return false;
    const local = rotatePoint(point, currentGeometry.centroid, -figureState.rotation);
    const dx = local.x - currentGeometry.points.O.x;
    const dy = local.y - currentGeometry.points.O.y;
    const ellipseValue = (dx * dx) / Math.max(currentGeometry.radiusX * currentGeometry.radiusX, 1e-9) + (dy * dy) / Math.max(currentGeometry.radiusY * currentGeometry.radiusY, 1e-9);
    if (ellipseValue > 1 + 1e-8) return false;
    const angle = normalizeAngle(Math.atan2(dy / Math.max(currentGeometry.radiusY, 1e-9), dx / Math.max(currentGeometry.radiusX, 1e-9)));
    return angle >= -1e-8 && angle <= currentGeometry.angleRadians + 1e-8;
  }
  function findAnchorAtPoint(point) {
    for (let index = currentLabelAnchors.length - 1; index >= 0; index -= 1) {
      const anchor = currentLabelAnchors[index];
      const screen = userToScreenPoint(point);
      if (screen.x >= anchor.screenRect.left && screen.x <= anchor.screenRect.right && screen.y >= anchor.screenRect.top && screen.y <= anchor.screenRect.bottom) return { type: anchor.type, id: anchor.id };
    }
    return null;
  }
  function fitBoard(geometry) {
    const width = Math.max(1, geometry.baseBounds.width);
    const height = Math.max(1, geometry.baseBounds.height);
    const padding = Math.max(width, height) * 0.42;
    const contentWidth = width + padding * 2;
    const contentHeight = height + padding * 2;
    const aspect = exportAspects[exportAspectIndex].value;
    let halfWidth = contentWidth / 2; let halfHeight = contentHeight / 2;
    if (contentWidth / contentHeight < aspect) halfWidth = (contentHeight * aspect) / 2; else halfHeight = (contentWidth / aspect) / 2;
    halfWidth /= zoomScale; halfHeight /= zoomScale;
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
    let width = rect.width - margin * 2; let height = width / aspect;
    if (height > rect.height - margin * 2) { height = rect.height - margin * 2; width = height * aspect; }
    exportFrame.style.width = Math.max(120, width) + 'px';
    exportFrame.style.height = Math.max(120, height) + 'px';
    const left = (rect.width - width) / 2; const top = (rect.height - height) / 2; const right = left + width; const bottom = top + height;
    exportBackdrop.style.setProperty('--frame-left', left + 'px');
    exportBackdrop.style.setProperty('--frame-top', top + 'px');
    exportBackdrop.style.setProperty('--frame-right', right + 'px');
    exportBackdrop.style.setProperty('--frame-bottom', bottom + 'px');
  }
  function cropCanvasToFrame(canvas) {
    const rect = box.getBoundingClientRect(); const frameRect = exportFrame.getBoundingClientRect();
    const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height;
    const sx = Math.round((frameRect.left - rect.left) * scaleX); const sy = Math.round((frameRect.top - rect.top) * scaleY);
    const sw = Math.round(frameRect.width * scaleX); const sh = Math.round(frameRect.height * scaleY);
    const cropped = document.createElement('canvas'); cropped.width = sw; cropped.height = sh;
    cropped.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
    return cropped;
  }
  function scheduleRender() {
    if (renderRafId !== null) return;
    renderRafId = requestAnimationFrame(function () { renderRafId = null; render(); });
  }
  function renderFigure(geometry) {
    const O = geometry.points.O; const A = geometry.points.A; const B = geometry.points.B;
    const color = figureState.color;
    const theta = currentGeometry.angleRadians;
    const rotationRad = figureState.rotation * Math.PI / 180;
    board.create('curve', [
      function (t) { return O.x + geometry.radiusX * Math.cos(t) * Math.cos(rotationRad) - geometry.radiusY * Math.sin(t) * Math.sin(rotationRad); },
      function (t) { return O.y + geometry.radiusX * Math.cos(t) * Math.sin(rotationRad) + geometry.radiusY * Math.sin(t) * Math.cos(rotationRad); },
      0, theta
    ], { fixed: true, strokeWidth: 2, strokeColor: color, highlight: false });
    if (labelState.segment.OA || segmentLineMode.OA !== 0 || labelState.angle.AOB || labelState.angleMark.AOB || labelState.rightAngleMark.AOB) {
      board.create('segment', [[O.x, O.y], [A.x, A.y]], { fixed: true, strokeWidth: 2, strokeColor: color, highlight: false });
    }
    if (labelState.segment.OB || segmentLineMode.OB !== 0 || labelState.angle.AOB || labelState.angleMark.AOB || labelState.rightAngleMark.AOB) {
      board.create('segment', [[O.x, O.y], [B.x, B.y]], { fixed: true, strokeWidth: 2, strokeColor: color, highlight: false });
    }
    const sectorPoints = [[O.x, O.y]];
    for (let i = 0; i <= 48; i += 1) {
      const t = theta * (i / 48);
      sectorPoints.push([
        O.x + geometry.radiusX * Math.cos(t) * Math.cos(rotationRad) - geometry.radiusY * Math.sin(t) * Math.sin(rotationRad),
        O.y + geometry.radiusX * Math.cos(t) * Math.sin(rotationRad) + geometry.radiusY * Math.sin(t) * Math.cos(rotationRad)
      ]);
    }
    board.create('polygon', sectorPoints, { fixed: true, borders: { visible: false, highlight: false }, vertices: { visible: false }, fillColor: hexToRgba(color, 0.08), fillOpacity: 1, highlight: false });
    board.create('point', [O.x, O.y], { name: '', size: 3, fixed: true, strokeColor: '#111111', fillColor: '#111111' });
    board.create('point', [A.x, A.y], { name: '', size: 3, fixed: true, strokeColor: '#111111', fillColor: '#111111' });
    board.create('point', [B.x, B.y], { name: '', size: 3, fixed: true, strokeColor: '#111111', fillColor: '#111111' });
  }
  function drawAngleDecoration(geometry) {
    const mode = Number.isFinite(angleMarkerMode.AOB) ? angleMarkerMode.AOB : 0;
    if (mode === 0) return;
    const vertex = geometry.points.O;
    const p1 = geometry.points.A;
    const p2 = geometry.points.B;
    const a1Base = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
    const a2Base = Math.atan2(p2.y - vertex.y, p2.x - vertex.x);
    let a1 = a1Base;
    let delta = a2Base - a1Base;
    while (delta <= -Math.PI) delta += Math.PI * 2;
    while (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < 0) {
      a1 = a2Base;
      delta = -delta;
    }
    const radius = Math.max(0.08, (geometry.ref / 10) * Math.max(0.35, Math.min(8, labelFontSize.angleMark.AOB / 26)));
    const color = getLabelStyle('angleMark', 'AOB').color || '#687086';
    const start = { x: vertex.x + radius * Math.cos(a1), y: vertex.y + radius * Math.sin(a1) };
    const end = { x: vertex.x + radius * Math.cos(a1 + delta), y: vertex.y + radius * Math.sin(a1 + delta) };
    board.create('segment', [[vertex.x, vertex.y], [start.x, start.y]], { fixed: true, strokeWidth: 1.4, strokeColor: color, highlight: false });
    board.create('segment', [[vertex.x, vertex.y], [end.x, end.y]], { fixed: true, strokeWidth: 1.4, strokeColor: color, highlight: false });
    board.create('curve', [function (t) { const angle = a1 + delta * t; return vertex.x + radius * Math.cos(angle); }, function (t) { const angle = a1 + delta * t; return vertex.y + radius * Math.sin(angle); }, 0, 1], { fixed: true, strokeWidth: 1.8, strokeColor: color, highlight: false });
    const midAngle = a1 + delta / 2;
    const symbolCenter = { x: vertex.x + radius * Math.cos(midAngle), y: vertex.y + radius * Math.sin(midAngle) };
    const towardCenter = { x: vertex.x - symbolCenter.x, y: vertex.y - symbolCenter.y };
    const towardLen = Math.hypot(towardCenter.x, towardCenter.y) || 1;
    const dir = { x: towardCenter.x / towardLen, y: towardCenter.y / towardLen };
    const normal = { x: -dir.y, y: dir.x };
    const symbolSize = Math.max(0.03, radius * 0.34);
    if (mode === 2) {
      const circleSize = symbolSize * 0.5;
      board.create('curve', [function (t) { return symbolCenter.x + circleSize * Math.cos(t); }, function (t) { return symbolCenter.y + circleSize * Math.sin(t); }, 0, Math.PI * 2], { fixed: true, strokeWidth: 1.6, strokeColor: color, highlight: false });
    } else if (mode === 3) {
      const barSize = symbolSize * 0.5;
      board.create('segment', [[symbolCenter.x - dir.x * barSize, symbolCenter.y - dir.y * barSize], [symbolCenter.x + dir.x * barSize, symbolCenter.y + dir.y * barSize]], { fixed: true, strokeWidth: 1.8, strokeColor: color, highlight: false });
    } else if (mode === 4) {
      const barSize = symbolSize * 0.5; const sep = barSize * 0.46;
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
        const t = i / 18; const angle = a1 + delta * t;
        sectorPoints.push({ x: vertex.x + radius * Math.cos(angle), y: vertex.y + radius * Math.sin(angle) });
      }
      board.create('polygon', sectorPoints.map(function (p) { return [p.x, p.y]; }), { fixed: true, borders: { visible: false, highlight: false }, vertices: { visible: false }, fillColor: color, fillOpacity: 1, highlight: false });
    }
    const sampleAngles = [0, 0.25, 0.5, 0.75, 1].map(function (t) { const angle = a1 + delta * t; return { x: vertex.x + radius * Math.cos(angle), y: vertex.y + radius * Math.sin(angle) }; });
    const boundsPoints = sampleAngles.concat(mode === 7 ? [{ x: vertex.x, y: vertex.y }] : [
      { x: symbolCenter.x + normal.x * symbolSize, y: symbolCenter.y + normal.y * symbolSize },
      { x: symbolCenter.x - normal.x * symbolSize, y: symbolCenter.y - normal.y * symbolSize },
      { x: symbolCenter.x + dir.x * symbolSize, y: symbolCenter.y + dir.y * symbolSize },
      { x: symbolCenter.x - dir.x * symbolSize, y: symbolCenter.y - dir.y * symbolSize }
    ]);
    const screenPoints = boundsPoints.map(userToScreenPoint);
    currentLabelAnchors.push({ type: 'angleMark', id: 'AOB', x: symbolCenter.x, y: symbolCenter.y, scaleCenter: { x: vertex.x, y: vertex.y }, screenRect: { left: Math.min.apply(null, screenPoints.map(function (p) { return p.x; })), right: Math.max.apply(null, screenPoints.map(function (p) { return p.x; })), top: Math.min.apply(null, screenPoints.map(function (p) { return p.y; })), bottom: Math.max.apply(null, screenPoints.map(function (p) { return p.y; })) }, fontSize: labelFontSize.angleMark.AOB, rotation: 0, color: color });
  }
  function drawRightAngleDecoration(geometry) {
    if (!(Math.abs(geometry.angleDegrees - 90) < 1e-4) || !rightAngleMarkerMode.AOB) return;
    const vertex = geometry.points.O;
    const p1 = geometry.points.A;
    const p2 = geometry.points.B;
    const v1 = { x: p1.x - vertex.x, y: p1.y - vertex.y };
    const v2 = { x: p2.x - vertex.x, y: p2.y - vertex.y };
    const l1 = Math.hypot(v1.x, v1.y) || 1; const l2 = Math.hypot(v2.x, v2.y) || 1;
    const u1 = { x: v1.x / l1, y: v1.y / l1 }; const u2 = { x: v2.x / l2, y: v2.y / l2 };
    const sizeScale = Math.max(0.12, Math.min(8, labelFontSize.rightAngleMark.AOB / 26));
    const size = Math.max(0.02, geometry.ref * 0.06 * sizeScale);
    const pA = { x: vertex.x + u1.x * size, y: vertex.y + u1.y * size };
    const pB = { x: pA.x + u2.x * size, y: pA.y + u2.y * size };
    const pC = { x: vertex.x + u2.x * size, y: vertex.y + u2.y * size };
    const color = getLabelStyle('rightAngleMark', 'AOB').color || '#111111';
    board.create('segment', [[pA.x, pA.y], [pB.x, pB.y]], { fixed: true, strokeWidth: 2, strokeColor: color, highlight: false });
    board.create('segment', [[pB.x, pB.y], [pC.x, pC.y]], { fixed: true, strokeWidth: 2, strokeColor: color, highlight: false });
    const screenPoints = [vertex, pA, pB, pC].map(userToScreenPoint);
    currentLabelAnchors.push({ type: 'rightAngleMark', id: 'AOB', x: (vertex.x + pB.x) / 2, y: (vertex.y + pB.y) / 2, scaleCenter: { x: vertex.x, y: vertex.y }, screenRect: { left: Math.min.apply(null, screenPoints.map(function (p) { return p.x; })), right: Math.max.apply(null, screenPoints.map(function (p) { return p.x; })), top: Math.min.apply(null, screenPoints.map(function (p) { return p.y; })), bottom: Math.max.apply(null, screenPoints.map(function (p) { return p.y; })) }, fontSize: labelFontSize.rightAngleMark.AOB, rotation: 0, color: color });
  }
  function renderLabels(geometry) {
    labelLayer.innerHTML = '';
    currentLabelAnchors = [];
    ['O', 'A', 'B'].forEach(function (id) {
      if (!labelState.point[id]) return;
      createSelectableText(getLabelPosition('point', id, getDefaultPosition('point', id, geometry)), getLabelText('point', id, geometry), labelFontSize.point[id], { type: 'point', id: id }, { color: '#1f2430' });
    });
    ['OA', 'OB'].forEach(function (id) {
      if (!labelState.segment[id]) return;
      const P = geometry.points[id.charAt(0)];
      const Q = geometry.points[id.charAt(1)];
      window.InstantGeometrySharedOrnaments.drawSideArcLabel({
        board: board, P: P, Q: Q, center: geometry.centroid, text: getLabelText('segment', id, geometry),
        labelType: 'segment', labelId: id, labelFontGroup: 'segment', showArc: segmentArcMode[id] !== 0,
        getLabelPosition: getLabelPosition, getLabelStyle: getLabelStyle, createSelectableText: createSelectableText, labelFontSize: labelFontSize
      });
    });
    if (labelState.angle.AOB) createSelectableText(getLabelPosition('angle', 'AOB', getDefaultPosition('angle', 'AOB', geometry)), getLabelText('angle', 'AOB', geometry), labelFontSize.angle.AOB, { type: 'angle', id: 'AOB' }, { color: '#687086', threshold: 0.6 });
    if (labelState.angleMark.AOB) drawAngleDecoration(geometry);
    if (labelState.rightAngleMark.AOB) drawRightAngleDecoration(geometry);
    if (labelState.area.main) createSelectableText(getLabelPosition('area', 'main', getDefaultPosition('area', 'main', geometry)), getLabelText('area', 'main', geometry), labelFontSize.area.main, { type: 'area', id: 'main' }, { color: '#25603b', threshold: 0.8 });
    renderSelectionOverlay(getSelectedAnchor() || getFigureSelectionAnchor());
  }
  function render() {
    if (renderRafId !== null) { cancelAnimationFrame(renderRafId); renderRafId = null; }
    board.suspendUpdate();
    board.removeObject(board.objectsList.slice());
    labelLayer.innerHTML = '';
    currentLabelAnchors = [];
    currentSelectionOverlay = null;
    try {
      currentGeometry = getGeometryFromInputs();
      updateExportFrame();
      const inputSignature = Object.keys(inputElements).sort().reduce(function (acc, key) { acc[key] = inputElements[key].value; return acc; }, {});
      const fitSignature = JSON.stringify({ inputs: inputSignature, aspect: exportAspectIndex, boxW: box.clientWidth, boxH: box.clientHeight, zoom: zoomScale });
      if (fitSignature !== lastFitSignature) { fitBoard(currentGeometry); lastFitSignature = fitSignature; }
      renderFigure(currentGeometry);
      renderLabels(currentGeometry);
      setStatus('楕円の扇形を描画しました。', false);
    } catch (error) {
      currentGeometry = null;
      setStatus(error.message || '描画に失敗しました。', true);
    } finally {
      board.unsuspendUpdate();
    }
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
        pdf.save('ellipse-sector.pdf');
      } else {
        const link = document.createElement('a');
        link.href = cropped.toDataURL('image/png');
        link.download = format === 'png-transparent' ? 'ellipse-sector-transparent.png' : 'ellipse-sector.png';
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
    const type = target.dataset.type; const id = target.dataset.id;
    if (!type || !id) return;
    selectedLabel = { type: type, id: id }; selectedFigure = false; isPaletteOpen = false; render();
    const anchor = currentLabelAnchors.find(function (item) { return item.type === type && item.id === id; });
    const position = (labelPositions[type] && labelPositions[type][id]) || (anchor ? { x: anchor.x, y: anchor.y } : null);
    if (!position) return;
    dragState = { mode: 'move', type: type, id: id, startClient: { x: event.clientX, y: event.clientY }, labelStart: { x: position.x, y: position.y } };
  });
  box.addEventListener('mousedown', function (event) {
    if (!currentGeometry) return;
    if (event.target.closest('.floating-label')) return;
    const coords = board.getUsrCoordsOfMouse(event); const point = { x: coords[0], y: coords[1] };
    const overlayControl = findSelectionControl(point);
    if ((selectedLabel || selectedFigure) && overlayControl) {
      if (overlayControl.mode === 'palette-color') {
        if (selectedLabel) labelStyleState[selectedLabel.type][selectedLabel.id].color = overlayControl.color; else figureState.color = overlayControl.color;
        isPaletteOpen = false; render(); return;
      }
      if (overlayControl.mode === 'palette') { isPaletteOpen = !isPaletteOpen; render(); return; }
      const anchor = selectedLabel ? getSelectedAnchor() : getFigureSelectionAnchor();
      if (!anchor) return;
      const dragCenter = { x: anchor.x, y: anchor.y };
      dragState = { mode: overlayControl.mode, target: selectedLabel ? 'label' : 'figure', type: selectedLabel ? selectedLabel.type : 'figure', id: selectedLabel ? selectedLabel.id : 'main', startClient: { x: event.clientX, y: event.clientY }, center: dragCenter, fontSizeStart: selectedLabel ? labelFontSize[selectedLabel.type][selectedLabel.id] : null, scaleStart: selectedFigure ? figureState.scale : null, rotationStart: selectedLabel ? labelStyleState[selectedLabel.type][selectedLabel.id].rotation : figureState.rotation, distanceStart: Math.hypot(point.x - dragCenter.x, point.y - dragCenter.y), angleStart: Math.atan2(point.y - dragCenter.y, point.x - dragCenter.x) };
      return;
    }
    if (selectedFigure && pointInFigureZone(point)) {
      dragState = { mode: 'figure-move', target: 'figure', startClient: { x: event.clientX, y: event.clientY }, offsetStart: { x: figureState.offset.x, y: figureState.offset.y } };
      return;
    }
    const anchorHit = findAnchorAtPoint(point);
    if (anchorHit) { selectedLabel = anchorHit; selectedFigure = false; isPaletteOpen = false; render(); return; }
    if (pointInFigureZone(point)) {
      selectedLabel = null; selectedFigure = true; isPaletteOpen = false;
      dragState = { mode: 'figure-move', target: 'figure', startClient: { x: event.clientX, y: event.clientY }, offsetStart: { x: figureState.offset.x, y: figureState.offset.y } };
      render(); return;
    }
    selectedLabel = null; selectedFigure = false; isPaletteOpen = false; render();
  });
  box.addEventListener('mousemove', function (event) {
    if (!dragState || !currentGeometry) return;
    const coords = board.getUsrCoordsOfMouse(event); const point = { x: coords[0], y: coords[1] };
    if (dragState.mode === 'move') {
      const boundingBox = board.getBoundingBox();
      const unitsPerPixelX = (boundingBox[2] - boundingBox[0]) / Math.max(box.clientWidth, 1);
      const unitsPerPixelY = (boundingBox[1] - boundingBox[3]) / Math.max(box.clientHeight, 1);
      labelPositions[dragState.type][dragState.id] = { x: dragState.labelStart.x + (event.clientX - dragState.startClient.x) * unitsPerPixelX, y: dragState.labelStart.y - (event.clientY - dragState.startClient.y) * unitsPerPixelY };
      scheduleRender(); return;
    }
    if (dragState.mode === 'resize') {
      const ratio = Math.max(0.3, Math.min(8, Math.hypot(point.x - dragState.center.x, point.y - dragState.center.y) / Math.max(dragState.distanceStart, 0.01)));
      if (dragState.target === 'label') labelFontSize[dragState.type][dragState.id] = Math.max(10, Math.min(320, Math.round(dragState.fontSizeStart * ratio)));
      else {
        const nextScale = Math.max(0.3, Math.min(4, dragState.scaleStart * ratio));
        const scaleRatio = nextScale / Math.max(figureState.scale, 1e-9);
        if (Math.abs(scaleRatio - 1) > 1e-9) { scaleLabelGroupAround(currentGeometry.centroid, scaleRatio); scaleLabelFontGroup(scaleRatio); }
        figureState.scale = nextScale;
      }
      scheduleRender(); return;
    }
    if (dragState.mode === 'rotate') {
      const currentAngle = Math.atan2(point.y - dragState.center.y, point.x - dragState.center.x);
      if (dragState.target === 'label') labelStyleState[dragState.type][dragState.id].rotation = dragState.rotationStart + ((currentAngle - dragState.angleStart) * 180 / Math.PI);
      else {
        const nextRotation = dragState.rotationStart + ((currentAngle - dragState.angleStart) * 180 / Math.PI);
        const deltaRotation = nextRotation - figureState.rotation;
        if (Math.abs(deltaRotation) > 1e-9) rotateLabelGroupAround(currentGeometry.centroid, deltaRotation);
        figureState.rotation = nextRotation;
      }
      scheduleRender(); return;
    }
    if (dragState.mode === 'figure-move') {
      const boundingBox = board.getBoundingBox();
      const unitsPerPixelX = (boundingBox[2] - boundingBox[0]) / Math.max(box.clientWidth, 1);
      const unitsPerPixelY = (boundingBox[1] - boundingBox[3]) / Math.max(box.clientHeight, 1);
      const nextOffset = { x: dragState.offsetStart.x + (event.clientX - dragState.startClient.x) * unitsPerPixelX, y: dragState.offsetStart.y - (event.clientY - dragState.startClient.y) * unitsPerPixelY };
      const delta = { x: nextOffset.x - figureState.offset.x, y: nextOffset.y - figureState.offset.y };
      if (Math.abs(delta.x) > 1e-9 || Math.abs(delta.y) > 1e-9) translateLabelGroup(delta);
      figureState.offset = nextOffset;
      scheduleRender();
    }
  });
  window.addEventListener('mouseup', function () { dragState = null; });
  Object.keys(inputElements).forEach(function (id) {
    inputElements[id].addEventListener('input', function () {
      selectedLabel = null; selectedFigure = false; isPaletteOpen = false; zoomScale = 1;
      figureState.offset = { x: 0, y: 0 }; figureState.rotation = 0; figureState.scale = 1; lastFitSignature = '';
      render();
    });
  });
  box.addEventListener('wheel', function (event) {
    event.preventDefault();
    zoomScale = Math.max(0.45, Math.min(4, zoomScale * (event.deltaY < 0 ? 1.08 : 1 / 1.08)));
    lastFitSignature = ''; render();
  }, { passive: false });
  ratioBtn.addEventListener('click', function () { exportAspectIndex = (exportAspectIndex + 1) % exportAspects.length; updateRatioButton(); lastFitSignature = ''; render(); });
  resetBtn.addEventListener('click', function () {
    inputElements.radius1Len.value = '6';
    inputElements.radius2Len.value = '3.5';
    inputElements.angleLen.value = '60';
    exportAspectIndex = 0; unitIndex = 1; angleMode = 'degrees'; zoomScale = 1;
    labelStyleState = JSON.parse(JSON.stringify(styleDefaults));
    Object.keys(labelPositions).forEach(function (group) { Object.keys(labelPositions[group]).forEach(function (id) { labelPositions[group][id] = null; labelFontSize[group][id] = labelFontDefaults[group][id]; labelState[group][id] = defaultLabelState[group][id]; }); });
    angleMarkerMode.AOB = 0; rightAngleMarkerMode.AOB = 0; segmentArcMode.OA = 1; segmentArcMode.OB = 1; segmentLineMode.OA = 1; segmentLineMode.OB = 1;
    customLabelText.segment.OA = ''; customLabelText.segment.OB = ''; customLabelText.angle.AOB = ''; customLabelText.area.main = '';
    pointLabelText.O = 'O'; pointLabelText.A = 'A'; pointLabelText.B = 'B';
    figureState = { color: '#2a5bd7', rotation: 0, scale: 1, offset: { x: 0, y: 0 } };
    selectedLabel = null; selectedFigure = false; isPaletteOpen = false;
    updateRatioButton(); updateUnitButton(); updateAngleModeButton(); renderLabelToggleButtons(); lastFitSignature = ''; render();
  });
  unitBtn.addEventListener('click', function () { unitIndex = (unitIndex + 1) % unitOptions.length; updateUnitButton(); render(); });
  angleModeBtn.addEventListener('click', function () { angleMode = angleMode === 'degrees' ? 'radians' : 'degrees'; updateAngleModeButton(); render(); });
  leftToggle.addEventListener('click', function () { isDockCollapsed = !isDockCollapsed; leftDock.classList.toggle('is-collapsed', isDockCollapsed); updateDockToggleButtons(); });
  rightToggle.addEventListener('click', function () { isRightDockCollapsed = !isRightDockCollapsed; rightDock.classList.toggle('is-collapsed', isRightDockCollapsed); updateDockToggleButtons(); });
  pageBackBtn.addEventListener('click', function () { window.history.back(); });
  downloadButtons.forEach(function (button) { button.addEventListener('click', function () { handleDownload(button.dataset.downloadFormat); }); });
  window.addEventListener('resize', function () { updateExportFrame(); lastFitSignature = ''; render(); });

  updateRatioButton();
  updateUnitButton();
  updateAngleModeButton();
  updateDockToggleButtons();
  renderLabelToggleButtons();
  render();
})();
