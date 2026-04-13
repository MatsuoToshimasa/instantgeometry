(function () {
  'use strict';

  const shape = document.body.dataset.conicShape || 'circle';
  const config = shape === 'ellipse'
    ? {
        title: '楕円',
        slug: 'ellipse',
        status: '入力をもとに楕円を描画しています。',
        pointIds: ['O'],
        segmentIds: ['a', 'b'],
        getInputs: function (inputElements, evaluateExpression) {
          return {
            r1: evaluateExpression(inputElements.radius1Len.value),
            r2: evaluateExpression(inputElements.radius2Len.value)
          };
        }
      }
    : {
        title: '円',
        slug: 'circle',
        status: '入力をもとに円を描画しています。',
        pointIds: ['O'],
        segmentIds: ['r'],
        getInputs: function (inputElements, evaluateExpression) {
          return { r: evaluateExpression(inputElements.radiusLen.value) };
        }
      };

  const exportAspects = [
    { label: '1:1', value: 1 },
    { label: '1:√2', value: 1 / Math.SQRT2 },
    { label: '√2:1', value: Math.SQRT2 }
  ];
  const unitOptions = ['', 'cm', 'm', 'km'];

  const inputElements = Array.from(document.querySelectorAll('[data-conic-input]')).reduce(function (acc, element) {
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

  const pointLabelText = { O: 'O' };
  const defaultLabelState = {
    point: { O: true },
    segment: shape === 'ellipse' ? { a: true, b: true } : { r: true },
    area: { main: false }
  };
  const labelState = JSON.parse(JSON.stringify(defaultLabelState));
  const labelFontDefaults = {
    point: { O: 36 },
    segment: shape === 'ellipse' ? { a: 30, b: 30 } : { r: 30 },
    area: { main: 48 }
  };
  const labelFontSize = JSON.parse(JSON.stringify(labelFontDefaults));
  const styleDefaults = {
    point: { O: { color: '#1f2430', rotation: 0 } },
    segment: shape === 'ellipse'
      ? { a: { color: '#2a5bd7', rotation: 0 }, b: { color: '#2a5bd7', rotation: 0 } }
      : { r: { color: '#2a5bd7', rotation: 0 } },
    area: { main: { color: '#25603b', rotation: 0 } }
  };
  let labelStyleState = JSON.parse(JSON.stringify(styleDefaults));
  const labelPositions = {
    point: { O: null },
    segment: shape === 'ellipse' ? { a: null, b: null } : { r: null },
    area: { main: null }
  };
  const customLabelText = {
    segment: shape === 'ellipse' ? { a: '', b: '' } : { r: '' },
    area: { main: '' }
  };
  const segmentArcMode = shape === 'ellipse' ? { a: 1, b: 1 } : { r: 1 };
  const segmentLineMode = shape === 'ellipse' ? { a: 1, b: 1 } : { r: 1 };

  let currentGeometry = null;
  let currentLabelAnchors = [];
  let currentSelectionOverlay = null;
  let selectedLabel = null;
  let selectedFigure = false;
  let dragState = null;
  let renderRafId = null;
  let exportAspectIndex = 0;
  let unitIndex = 1;
  let zoomScale = 1;
  let isDockCollapsed = false;
  let isRightDockCollapsed = false;
  let isPaletteOpen = false;
  let lastFitSignature = '';
  let figureState = { color: '#2a5bd7', rotation: 0, scale: 1, offset: { x: 0, y: 0 } };

  function setStatus(message, isError) { statusBox.textContent = message; statusBox.classList.toggle('error', !!isError); }
  function updateRatioButton() { ratioBtn.textContent = '画面比 ' + exportAspects[exportAspectIndex].label; }
  function updateUnitButton() { unitBtn.textContent = unitOptions[unitIndex] ? '長さ' + unitOptions[unitIndex] : '単位なし'; }
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

  function getBaseGeometry() {
    const values = config.getInputs(inputElements, evaluateExpression);
    if (shape === 'ellipse') {
      return {
        basePoints: { O: { x: 0, y: 0 }, A: { x: values.r1, y: 0 }, B: { x: 0, y: values.r2 } },
        baseBounds: { width: values.r1 * 2, height: values.r2 * 2 },
        ref: Math.max(values.r1, values.r2),
        area: Math.PI * values.r1 * values.r2
      };
    }
    return {
      basePoints: { O: { x: 0, y: 0 }, A: { x: values.r, y: 0 } },
      baseBounds: { width: values.r * 2, height: values.r * 2 },
      ref: values.r,
      area: Math.PI * values.r * values.r
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
  function getGeometryFromInputs() {
    const base = getBaseGeometry();
    const transformed = transformBasePoints(base.basePoints);
    const geometry = {
      points: transformed.points,
      centroid: transformed.centroid,
      ref: base.ref * figureState.scale,
      area: base.area * figureState.scale * figureState.scale,
      baseBounds: { width: base.baseBounds.width * figureState.scale, height: base.baseBounds.height * figureState.scale }
    };
    if (shape === 'ellipse') {
      geometry.rx = Math.hypot(geometry.points.A.x - geometry.points.O.x, geometry.points.A.y - geometry.points.O.y);
      geometry.ry = Math.hypot(geometry.points.B.x - geometry.points.O.x, geometry.points.B.y - geometry.points.O.y);
    } else {
      geometry.r = Math.hypot(geometry.points.A.x - geometry.points.O.x, geometry.points.A.y - geometry.points.O.y);
    }
    return geometry;
  }

  function getPointLabelToken() {
    const raw = String(pointLabelText.O || 'O').trim().toUpperCase();
    return /^[A-Z]+$/.test(raw) ? raw : 'O';
  }
  function getAreaName() { return shape === 'ellipse' ? '楕円' + getPointLabelToken() : '円' + getPointLabelToken(); }
  function getDefaultPosition(type, id, geometry) {
    const O = geometry.points.O;
    if (type === 'point') return { x: O.x + geometry.ref * 0.2, y: O.y + geometry.ref * 0.2 };
    if (type === 'segment') {
      if (shape === 'ellipse' && id === 'b') return { x: (geometry.points.O.x + geometry.points.B.x) / 2 - geometry.ref * 0.15, y: (geometry.points.O.y + geometry.points.B.y) / 2 };
      return { x: (geometry.points.O.x + geometry.points.A.x) / 2, y: (geometry.points.O.y + geometry.points.A.y) / 2 + geometry.ref * 0.14 };
    }
    return { x: O.x, y: O.y };
  }
  function getSegmentEndpoints(id, geometry) {
    if (shape === 'ellipse' && id === 'b') return [geometry.points.O, geometry.points.B];
    return [geometry.points.O, geometry.points.A];
  }
  function getLabelText(type, id, geometry) {
    if (type === 'point') return getPointLabelToken();
    if (type === 'segment') {
      const endpoints = getSegmentEndpoints(id, geometry);
      const fallback = formatNumber(Math.hypot(endpoints[1].x - endpoints[0].x, endpoints[1].y - endpoints[0].y));
      const custom = window.InstantGeometrySharedLabelConfig.normalizeCustomLabelInput(customLabelText.segment[id]);
      return custom ? appendUnit(custom, false) : appendUnit(fallback, false);
    }
    const customArea = window.InstantGeometrySharedLabelConfig.normalizeCustomLabelInput(customLabelText.area.main);
    return customArea ? appendUnit(customArea, true) : appendUnit(formatNumber(geometry.area), true);
  }
  function getGeneralConfigs() {
    return [{ type: 'point', id: 'O' }]
      .concat(config.segmentIds.map(function (id) { return { type: 'segment', id: id }; }))
      .concat([{ type: 'area', id: 'main' }]);
  }
  function getToggleLabel(label) {
    if (label.type === 'point') return getPointLabelToken();
    if (label.type === 'segment') return label.id;
    return getAreaName();
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
    getGeneralConfigs().forEach(function (configItem) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'download-btn btn-bd';
      if (!labelState[configItem.type][configItem.id]) button.style.opacity = '0.55';
      button.textContent = getToggleLabel(configItem);
      button.setAttribute('aria-pressed', String(!!labelState[configItem.type][configItem.id]));
      button.addEventListener('click', function () {
        labelState[configItem.type][configItem.id] = !labelState[configItem.type][configItem.id];
        if (!labelState[configItem.type][configItem.id] && selectedLabel && selectedLabel.type === configItem.type && selectedLabel.id === configItem.id) { selectedLabel = null; isPaletteOpen = false; }
        if (labelState[configItem.type][configItem.id]) resetSingleLabel(configItem.type, configItem.id);
        renderLabelToggleButtons();
        render();
      });
      button.addEventListener('contextmenu', async function (event) {
        event.preventDefault();
        if (configItem.type === 'point') {
          const response = await window.InstantGeometrySharedLabelConfig.promptSingleText({ title: '点ラベル設定', firstLabel: '文字（A-Z のみ）', value: getPointLabelToken() });
          if (response === null) return;
          const normalized = String(response).trim().toUpperCase();
          if (!normalized) pointLabelText.O = 'O';
          else if (/^[A-Z]+$/.test(normalized)) pointLabelText.O = normalized.slice(0, 12);
          else { setStatus('点ラベルは英字大文字（A-Z）のみ入力できます。', true); return; }
          renderLabelToggleButtons();
          render();
          return;
        }
        if (configItem.type === 'segment') {
          const response = await window.InstantGeometrySharedLabelConfig.promptTripleSetting({
            title: '線分ラベル設定',
            firstLabel: '線分表示（0:線分を非表示 / 1:線分を表示）',
            firstValue: String(segmentLineMode[configItem.id]),
            secondLabel: '弧表示（0:弧を非表示 / 1:弧を表示）',
            secondValue: String(segmentArcMode[configItem.id]),
            thirdLabel: '文字（空欄で数値表示）',
            thirdValue: customLabelText.segment[configItem.id] || '',
            firstBinary: true,
            secondBinary: true
          });
          if (response === null) return;
          const lineMode = window.InstantGeometrySharedOrnaments.normalizeSegmentArcInput(response.first);
          const arcMode = window.InstantGeometrySharedOrnaments.normalizeSegmentArcInput(response.second);
          if (lineMode === null) { setStatus('線分表示は「0 / 1」で指定してください。', true); return; }
          if (arcMode === null) { setStatus('線分ラベルの弧表示は「0 / 1」で指定してください。', true); return; }
          segmentLineMode[configItem.id] = lineMode;
          segmentArcMode[configItem.id] = arcMode;
          customLabelText.segment[configItem.id] = response.third;
          render();
          return;
        }
        if (configItem.type === 'area') {
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
        labelFontSize[group][id] = Math.max(10, Math.min(320, Math.round(labelFontSize[group][id] * ratio)));
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
  function pointInFigureZone(point) {
    if (!currentGeometry) return false;
    const dx = point.x - currentGeometry.centroid.x;
    const dy = point.y - currentGeometry.centroid.y;
    const local = rotatePoint({ x: currentGeometry.centroid.x + dx, y: currentGeometry.centroid.y + dy }, currentGeometry.centroid, -figureState.rotation);
    const lx = local.x - currentGeometry.centroid.x;
    const ly = local.y - currentGeometry.centroid.y;
    if (shape === 'ellipse') return ((lx * lx) / (currentGeometry.rx * currentGeometry.rx || 1) + (ly * ly) / (currentGeometry.ry * currentGeometry.ry || 1)) <= 1;
    return (lx * lx + ly * ly) <= (currentGeometry.r * currentGeometry.r);
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
    const O = geometry.points.O;
    const color = figureState.color;
    if (shape === 'ellipse') {
      const rx = geometry.rx;
      const ry = geometry.ry;
      board.create('curve', [
        function (t) {
          return O.x + rx * Math.cos(t) * Math.cos(figureState.rotation * Math.PI / 180) - ry * Math.sin(t) * Math.sin(figureState.rotation * Math.PI / 180);
        },
        function (t) {
          return O.y + rx * Math.cos(t) * Math.sin(figureState.rotation * Math.PI / 180) + ry * Math.sin(t) * Math.cos(figureState.rotation * Math.PI / 180);
        },
        0, Math.PI * 2
      ], { fixed: true, strokeWidth: 2, strokeColor: color, highlight: false });
    } else {
      board.create('curve', [
        function (t) { return O.x + geometry.r * Math.cos(t); },
        function (t) { return O.y + geometry.r * Math.sin(t); },
        0, Math.PI * 2
      ], { fixed: true, strokeWidth: 2, strokeColor: color, highlight: false });
    }
    config.segmentIds.forEach(function (segmentId) {
      if (!(labelState.segment[segmentId] || segmentLineMode[segmentId] !== 0)) return;
      const endpoints = getSegmentEndpoints(segmentId, geometry);
      board.create('segment', [[endpoints[0].x, endpoints[0].y], [endpoints[1].x, endpoints[1].y]], { fixed: true, strokeWidth: 2, strokeColor: color, highlight: false });
    });
    board.create('point', [O.x, O.y], { name: '', size: 3, fixed: true, strokeColor: '#111111', fillColor: '#111111' });
  }
  function renderLabels(geometry) {
    labelLayer.innerHTML = '';
    currentLabelAnchors = [];
    if (labelState.point.O) createSelectableText(getLabelPosition('point', 'O', getDefaultPosition('point', 'O', geometry)), getLabelText('point', 'O', geometry), labelFontSize.point.O, { type: 'point', id: 'O' }, { color: '#1f2430' });
    config.segmentIds.forEach(function (segmentId) {
      if (!labelState.segment[segmentId]) return;
      const endpoints = getSegmentEndpoints(segmentId, geometry);
      window.InstantGeometrySharedOrnaments.drawSideArcLabel({
        board: board,
        P: endpoints[0],
        Q: endpoints[1],
        center: geometry.centroid,
        text: getLabelText('segment', segmentId, geometry),
        labelType: 'segment',
        labelId: segmentId,
        labelFontGroup: 'segment',
        showArc: segmentArcMode[segmentId] !== 0,
        getLabelPosition: getLabelPosition,
        getLabelStyle: getLabelStyle,
        createSelectableText: createSelectableText,
        labelFontSize: labelFontSize
      });
    });
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
      setStatus(config.title + 'を描画しました。', false);
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
        pdf.save(config.slug + '.pdf');
      } else {
        const link = document.createElement('a');
        link.href = cropped.toDataURL('image/png');
        link.download = format === 'png-transparent' ? (config.slug + '-transparent.png') : (config.slug + '.png');
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
      dragState = { mode: overlayControl.mode, target: selectedLabel ? 'label' : 'figure', type: selectedLabel ? selectedLabel.type : 'figure', id: selectedLabel ? selectedLabel.id : 'main', startClient: { x: event.clientX, y: event.clientY }, center: { x: anchor.x, y: anchor.y }, fontSizeStart: selectedLabel ? labelFontSize[selectedLabel.type][selectedLabel.id] : null, scaleStart: selectedFigure ? figureState.scale : null, rotationStart: selectedLabel ? labelStyleState[selectedLabel.type][selectedLabel.id].rotation : figureState.rotation, distanceStart: Math.hypot(point.x - anchor.x, point.y - anchor.y), angleStart: Math.atan2(point.y - anchor.y, point.x - anchor.x) };
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
      if (dragState.target === 'label') {
        if (window.InstantGeometrySharedSelection.isNonTransformableSelectionType(dragState.type)) return;
        labelFontSize[dragState.type][dragState.id] = Math.max(10, Math.min(320, Math.round(dragState.fontSizeStart * ratio)));
      } else {
        const nextScale = Math.max(0.3, Math.min(4, dragState.scaleStart * ratio));
        const scaleRatio = nextScale / Math.max(figureState.scale, 1e-9);
        if (Math.abs(scaleRatio - 1) > 1e-9) { scaleLabelGroupAround(currentGeometry.centroid, scaleRatio); scaleLabelFontGroup(scaleRatio); }
        figureState.scale = nextScale;
      }
      scheduleRender(); return;
    }
    if (dragState.mode === 'rotate') {
      const currentAngle = Math.atan2(point.y - dragState.center.y, point.x - dragState.center.x);
      if (dragState.target === 'label') {
        if (window.InstantGeometrySharedSelection.isNonTransformableSelectionType(dragState.type)) return;
        labelStyleState[dragState.type][dragState.id].rotation = dragState.rotationStart + ((currentAngle - dragState.angleStart) * 180 / Math.PI);
      }
      else {
        const nextRotation = dragState.rotationStart + ((currentAngle - dragState.angleStart) * 180 / Math.PI);
        const deltaRotation = nextRotation - figureState.rotation;
        if (Math.abs(deltaRotation - 0) > 1e-9) rotateLabelGroupAround(currentGeometry.centroid, deltaRotation);
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
    if (shape === 'ellipse') {
      inputElements.radius1Len.value = '6';
      inputElements.radius2Len.value = '3.5';
    } else {
      inputElements.radiusLen.value = '5';
    }
    exportAspectIndex = 0; unitIndex = 1; zoomScale = 1;
    labelStyleState = JSON.parse(JSON.stringify(styleDefaults));
    Object.keys(labelPositions).forEach(function (group) { Object.keys(labelPositions[group]).forEach(function (id) { labelPositions[group][id] = null; labelFontSize[group][id] = labelFontDefaults[group][id]; labelState[group][id] = defaultLabelState[group][id]; }); });
    Object.keys(segmentArcMode).forEach(function (id) { segmentArcMode[id] = 1; });
    Object.keys(segmentLineMode).forEach(function (id) { segmentLineMode[id] = 1; });
    Object.keys(customLabelText.segment).forEach(function (id) { customLabelText.segment[id] = ''; });
    customLabelText.area.main = '';
    pointLabelText.O = 'O';
    figureState = { color: '#2a5bd7', rotation: 0, scale: 1, offset: { x: 0, y: 0 } };
    selectedLabel = null; selectedFigure = false; isPaletteOpen = false;
    updateRatioButton(); updateUnitButton(); renderLabelToggleButtons(); lastFitSignature = ''; render();
  });
  unitBtn.addEventListener('click', function () { unitIndex = (unitIndex + 1) % unitOptions.length; updateUnitButton(); render(); });
  leftToggle.addEventListener('click', function () { isDockCollapsed = !isDockCollapsed; leftDock.classList.toggle('is-collapsed', isDockCollapsed); updateDockToggleButtons(); });
  rightToggle.addEventListener('click', function () { isRightDockCollapsed = !isRightDockCollapsed; rightDock.classList.toggle('is-collapsed', isRightDockCollapsed); updateDockToggleButtons(); });
  pageBackBtn.addEventListener('click', function () { window.history.back(); });
  downloadButtons.forEach(function (button) { button.addEventListener('click', function () { handleDownload(button.dataset.downloadFormat); }); });
  window.addEventListener('resize', function () { updateExportFrame(); lastFitSignature = ''; render(); });

  updateRatioButton();
  updateUnitButton();
  updateDockToggleButtons();
  renderLabelToggleButtons();
  render();
})();
