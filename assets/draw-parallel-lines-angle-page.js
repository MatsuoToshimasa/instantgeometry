(function () {
  'use strict';

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

  const board = JXG.JSXGraph.initBoard('box', {
    boundingbox: [-8, 6, 8, -6],
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

  const pointLabelText = { A: 'A', B: 'B', M: 'M', P: 'P', Q: 'Q', R: 'R', S: 'S' };
  const angleIds = ['PAM', 'QAM', 'AMB', 'RBM', 'SBM'];
  const anglePointMap = {
    PAM: ['P', 'A', 'M'],
    QAM: ['Q', 'A', 'M'],
    AMB: ['A', 'M', 'B'],
    RBM: ['R', 'B', 'M'],
    SBM: ['S', 'B', 'M']
  };
  const defaultLabelState = {
    point: { A: true, B: true, M: true },
    segment: { PQ: true, RS: true, AM: true, BM: true },
    angle: { PAM: false, QAM: false, AMB: false, RBM: false, SBM: false },
    angleMark: { PAM: false, QAM: false, AMB: false, RBM: false, SBM: false },
    rightAngleMark: { PAM: false, QAM: false, AMB: false, RBM: false, SBM: false }
  };
  const labelState = JSON.parse(JSON.stringify(defaultLabelState));
  const labelFontDefaults = {
    point: { A: 36, B: 36, M: 36 },
    segment: { PQ: 30, RS: 30, AM: 30, BM: 30 },
    angle: { PAM: 28, QAM: 28, AMB: 28, RBM: 28, SBM: 28 },
    angleMark: { PAM: 26, QAM: 26, AMB: 26, RBM: 26, SBM: 26 },
    rightAngleMark: { PAM: 26, QAM: 26, AMB: 26, RBM: 26, SBM: 26 }
  };
  const labelFontSize = JSON.parse(JSON.stringify(labelFontDefaults));
  const styleDefaults = {
    point: { A: style('#1f2430'), B: style('#1f2430'), M: style('#1f2430') },
    segment: { PQ: style('#2a5bd7'), RS: style('#2a5bd7'), AM: style('#2a5bd7'), BM: style('#2a5bd7') },
    angle: { PAM: style('#687086'), QAM: style('#687086'), AMB: style('#687086'), RBM: style('#687086'), SBM: style('#687086') },
    angleMark: { PAM: style('#687086'), QAM: style('#687086'), AMB: style('#687086'), RBM: style('#687086'), SBM: style('#687086') },
    rightAngleMark: { PAM: style('#111111'), QAM: style('#111111'), AMB: style('#111111'), RBM: style('#111111'), SBM: style('#111111') }
  };
  let labelStyleState = JSON.parse(JSON.stringify(styleDefaults));
  const labelPositions = {
    point: { A: null, B: null, M: null },
    segment: { PQ: null, RS: null, AM: null, BM: null },
    angle: { PAM: null, QAM: null, AMB: null, RBM: null, SBM: null },
    angleMark: { PAM: null, QAM: null, AMB: null, RBM: null, SBM: null },
    rightAngleMark: { PAM: null, QAM: null, AMB: null, RBM: null, SBM: null }
  };
  const customLabelText = { segment: { PQ: '', RS: '', AM: '', BM: '' }, angle: { PAM: '', QAM: '', AMB: '', RBM: '', SBM: '' } };
  const angleMarkerMode = { PAM: 0, QAM: 0, AMB: 0, RBM: 0, SBM: 0 };
  const rightAngleMarkerMode = { PAM: 0, QAM: 0, AMB: 0, RBM: 0, SBM: 0 };
  const segmentArcMode = { PQ: 1, RS: 1, AM: 1, BM: 1 };
  const segmentLineMode = { PQ: 1, RS: 1, AM: 1, BM: 1 };

  let currentGeometry = null;
  let currentLabelAnchors = [];
  let currentSelectionOverlay = null;
  let selectedLabel = null;
  let selectedFigure = false;
  let dragState = null;
  let renderRafId = null;
  let exportAspectIndex = 0;
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
  function cross(v1, v2) { return v1.x * v2.y - v1.y * v2.x; }
  function segmentLength(P, Q) { return Math.hypot(P.x - Q.x, P.y - Q.y); }
  function userToScreenPoint(point) { return { x: board.origin.scrCoords[1] + point.x * board.unitX, y: board.origin.scrCoords[2] - point.y * board.unitY }; }
  function getLabelStyle(type, id) { return labelStyleState[type] && labelStyleState[type][id] ? labelStyleState[type][id] : { color: '#2a5bd7', rotation: 0 }; }
  function createSelectableText(position, text, fontSize, labelKey, options) {
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
    const denominator = cross(dirA, dirB);
    if (Math.abs(denominator) < 1e-9) throw new Error('AM と BM が交わりません。');
    const diff = { x: B.x - A.x, y: B.y - A.y };
    const t = cross(diff, dirB) / denominator;
    const u = cross(diff, dirA) / denominator;
    if (!(t > 0 && u > 0)) throw new Error('指定した値では、M が平行線の間にできません。');
    const M = { x: A.x + dirA.x * t, y: A.y + dirA.y * t };
    if (!(M.y < topY && M.y > bottomY)) throw new Error('指定した値では、M が平行線の間にできません。');

    return {
      basePoints: {
        P: { x: leftX, y: topY },
        Q: { x: rightX, y: topY },
        R: { x: leftX, y: bottomY },
        S: { x: rightX, y: bottomY },
        A: A,
        B: B,
        M: M
      },
      topY: topY,
      bottomY: bottomY,
      leftX: leftX,
      rightX: rightX,
      theta1Deg: theta1Deg,
      theta2Deg: theta2Deg
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
    const allPoints = Object.keys(transformed.points).map(function (key) { return transformed.points[key]; });
    const xs = allPoints.map(function (p) { return p.x; });
    const ys = allPoints.map(function (p) { return p.y; });
    return {
      points: transformed.points,
      centroid: transformed.centroid,
      theta1Deg: base.theta1Deg,
      theta2Deg: base.theta2Deg,
      ref: Math.max(2, Math.abs(base.rightX - base.leftX)) * figureState.scale,
      baseBounds: {
        width: Math.max.apply(null, xs) - Math.min.apply(null, xs),
        height: Math.max.apply(null, ys) - Math.min.apply(null, ys)
      }
    };
  }

  function getGeneralConfigs() {
    return [
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
  }
  function getPointLabelToken(id) {
    const raw = String(pointLabelText[id] || id).trim().toUpperCase();
    return /^[A-Z]+$/.test(raw) ? raw : id;
  }
  function getAngleToggleLabel(id) { return '∠' + id; }
  function getSegmentToggleLabel(id) { return id; }
  function getToggleLabel(config) {
    if (config.type === 'point') return getPointLabelToken(config.id);
    if (config.type === 'segment') return getSegmentToggleLabel(config.id);
    return getAngleToggleLabel(config.id);
  }
  function getAngleMeasureDegrees(id, geometry) {
    const ids = anglePointMap[id];
    const p1 = geometry.points[ids[0]];
    const vertex = geometry.points[ids[1]];
    const p2 = geometry.points[ids[2]];
    const v1x = p1.x - vertex.x;
    const v1y = p1.y - vertex.y;
    const v2x = p2.x - vertex.x;
    const v2y = p2.y - vertex.y;
    const len1 = Math.hypot(v1x, v1y) || 1;
    const len2 = Math.hypot(v2x, v2y) || 1;
    const dot = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (len1 * len2)));
    return Math.acos(dot) * 180 / Math.PI;
  }
  function isRightAngleId(id, geometry) { return Math.abs(getAngleMeasureDegrees(id, geometry) - 90) < 1e-4; }
  function getAngleData(id, geometry) {
    const ids = anglePointMap[id];
    return { vertex: geometry.points[ids[1]], p1: geometry.points[ids[0]], p2: geometry.points[ids[2]] };
  }
  function getCustomSegmentText(id, fallback) {
    const custom = window.InstantGeometrySharedLabelConfig.normalizeCustomLabelInput(customLabelText.segment[id]);
    return custom || fallback;
  }
  function getCustomAngleText(id, fallback) {
    const custom = window.InstantGeometrySharedLabelConfig.normalizeCustomLabelInput(customLabelText.angle[id]);
    return custom ? window.InstantGeometrySharedLabelConfig.formatAngleCustomText(custom, angleMode) : fallback;
  }
  function getDefaultPointPosition(id, geometry) {
    if (id === 'A') return { x: geometry.points.A.x - 0.35, y: geometry.points.A.y + 0.32 };
    if (id === 'B') return { x: geometry.points.B.x + 0.35, y: geometry.points.B.y - 0.32 };
    return { x: geometry.points.M.x + 0.28, y: geometry.points.M.y + 0.32 };
  }
  function getDefaultAnglePosition(id, geometry) {
    const data = getAngleData(id, geometry);
    const d1 = { x: data.p1.x - data.vertex.x, y: data.p1.y - data.vertex.y };
    const d2 = { x: data.p2.x - data.vertex.x, y: data.p2.y - data.vertex.y };
    const l1 = Math.hypot(d1.x, d1.y) || 1;
    const l2 = Math.hypot(d2.x, d2.y) || 1;
    const u1 = { x: d1.x / l1, y: d1.y / l1 };
    const u2 = { x: d2.x / l2, y: d2.y / l2 };
    let bisector = { x: u1.x + u2.x, y: u1.y + u2.y };
    const len = Math.hypot(bisector.x, bisector.y);
    if (len < 1e-6) bisector = { x: -u1.y, y: u1.x };
    else bisector = { x: bisector.x / len, y: bisector.y / len };
    return { x: data.vertex.x + bisector.x * 0.65, y: data.vertex.y + bisector.y * 0.65 };
  }
  function getLabelText(type, id, geometry) {
    if (type === 'point') return getPointLabelToken(id);
    if (type === 'segment') {
      const map = { PQ: ['P', 'Q'], RS: ['R', 'S'], AM: ['A', 'M'], BM: ['B', 'M'] };
      const ends = map[id];
      return getCustomSegmentText(id, formatNumber(segmentLength(geometry.points[ends[0]], geometry.points[ends[1]])));
    }
    const degrees = getAngleMeasureDegrees(id, geometry);
    const base = angleMode === 'degrees' ? (formatNumber(degrees) + '°') : formatNumber(degrees * Math.PI / 180);
    return getCustomAngleText(id, base);
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
        if (!labelState[config.type][config.id] && selectedLabel && selectedLabel.type === config.type && selectedLabel.id === config.id) {
          selectedLabel = null;
          isPaletteOpen = false;
        }
        if (labelState[config.type][config.id]) resetSingleLabel(config.type, config.id);
        renderLabelToggleButtons();
        render();
      });
      button.addEventListener('contextmenu', async function (event) {
        event.preventDefault();
        if (config.type === 'point') {
          const response = await window.InstantGeometrySharedLabelConfig.promptSingleText({
            title: '点ラベル設定',
            firstLabel: '文字（A-Z のみ）',
            value: getPointLabelToken(config.id)
          });
          if (response === null) return;
          const normalized = String(response).trim().toUpperCase();
          if (!normalized) pointLabelText[config.id] = config.id;
          else if (/^[A-Z]+$/.test(normalized)) pointLabelText[config.id] = normalized.slice(0, 12);
          else {
            setStatus('点ラベルは英字大文字（A-Z）のみ入力できます。', true);
            return;
          }
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
            firstBinary: true,
            secondBinary: true
          });
          if (response === null) return;
          const lineMode = window.InstantGeometrySharedOrnaments.normalizeSegmentArcInput(response.first);
          const arcMode = window.InstantGeometrySharedOrnaments.normalizeSegmentArcInput(response.second);
          if (lineMode === null) { setStatus('線分表示は「0 / 1」で指定してください。', true); return; }
          if (arcMode === null) { setStatus('弧表示は「0 / 1」で指定してください。', true); return; }
          segmentLineMode[config.id] = lineMode;
          segmentArcMode[config.id] = arcMode;
          customLabelText.segment[config.id] = response.third;
          render();
          return;
        }
        const geometry = currentGeometry || getGeometryFromInputs();
        const canUseRightMarker = isRightAngleId(config.id, geometry);
        const response = await window.InstantGeometrySharedLabelConfig.promptTripleSetting({
          title: '角ラベル設定',
          firstLabel: '角マーク（0:なし / 1:記号なし / 2:○ / 3:| / 4:= / 5:× / 6:△ / 7:塗）',
          firstValue: String(angleMarkerMode[config.id]),
          secondLabel: '文字（空欄で数値表示）',
          secondValue: customLabelText.angle[config.id] || '',
          thirdLabel: '直角マーク（0:非表示 / 1:表示）',
          thirdValue: canUseRightMarker ? String(rightAngleMarkerMode[config.id]) : '90°以外は設定不可',
          thirdDisabled: !canUseRightMarker
        });
        if (response === null) return;
        const mode = /^[0-7]$/.test(String(response.first).trim()) ? Number(response.first) : null;
        if (mode === null) {
          setStatus('角マークは「0 / 1 / 2 / 3 / 4 / 5 / 6 / 7」で指定してください。', true);
          return;
        }
        angleMarkerMode[config.id] = mode;
        customLabelText.angle[config.id] = response.second;
        if (canUseRightMarker) {
          const rightMode = String(response.third).trim();
          if (rightMode !== '0' && rightMode !== '1') {
            setStatus('直角マークは「0 / 1」で指定してください。', true);
            return;
          }
          rightAngleMarkerMode[config.id] = Number(rightMode);
        } else {
          rightAngleMarkerMode[config.id] = 0;
        }
        labelState.angleMark[config.id] = mode !== 0;
        labelState.rightAngleMark[config.id] = rightAngleMarkerMode[config.id] !== 0;
        if (!labelState.angleMark[config.id] && selectedLabel && selectedLabel.type === 'angleMark' && selectedLabel.id === config.id) selectedLabel = null;
        if (!labelState.rightAngleMark[config.id] && selectedLabel && selectedLabel.type === 'rightAngleMark' && selectedLabel.id === config.id) selectedLabel = null;
        if (labelState.angleMark[config.id]) resetSingleLabel('angleMark', config.id);
        if (labelState.rightAngleMark[config.id]) resetSingleLabel('rightAngleMark', config.id);
        render();
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
      board: board,
      anchor: anchor,
      rotatePoint: rotatePoint,
      getLabelBounds: getLabelBounds,
      isPaletteOpen: isPaletteOpen
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
  function pointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;
      const intersect = ((yi > point.y) !== (yj > point.y)) && (point.x < ((xj - xi) * (point.y - yi) / ((yj - yi) || 1e-9) + xi));
      if (intersect) inside = !inside;
    }
    return inside;
  }
  function pointInFigureZone(point) {
    if (!currentGeometry) return false;
    return pointInPolygon(point, [currentGeometry.points.T1, currentGeometry.points.T2, currentGeometry.points.B2, currentGeometry.points.B1]);
  }
  function findAnchorAtPoint(point) {
    const screen = userToScreenPoint(point);
    for (let index = currentLabelAnchors.length - 1; index >= 0; index -= 1) {
      const anchor = currentLabelAnchors[index];
      if (screen.x >= anchor.screenRect.left && screen.x <= anchor.screenRect.right && screen.y >= anchor.screenRect.top && screen.y <= anchor.screenRect.bottom) {
        return { type: anchor.type, id: anchor.id };
      }
    }
    return null;
  }

  function fitBoard(geometry) {
    const points = ['P', 'Q', 'R', 'S', 'A', 'B', 'M'].map(function (id) { return geometry.points[id]; });
    const xs = points.map(function (p) { return p.x; });
    const ys = points.map(function (p) { return p.y; });
    const minX = Math.min.apply(null, xs);
    const maxX = Math.max.apply(null, xs);
    const minY = Math.min.apply(null, ys);
    const maxY = Math.max.apply(null, ys);
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const padding = Math.max(width, height) * 0.22;
    const contentWidth = width + padding * 2;
    const contentHeight = height + padding * 2;
    const aspect = exportAspects[exportAspectIndex].value;
    let halfWidth = contentWidth / 2;
    let halfHeight = contentHeight / 2;
    if (contentWidth / contentHeight < aspect) halfWidth = (contentHeight * aspect) / 2;
    else halfHeight = (contentWidth / aspect) / 2;
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

  function renderFigure(geometry) {
    const lineStyle = { fixed: true, strokeWidth: 2, strokeColor: figureState.color, highlight: false };
    const fillStyle = { borders: { visible: false, fixed: true, highlight: false }, fillColor: hexToRgba(figureState.color, 0.08), fillOpacity: 0, vertices: { visible: false }, highlight: false };
    const P = board.create('point', [geometry.points.P.x, geometry.points.P.y], { visible: false, fixed: true });
    const Q = board.create('point', [geometry.points.Q.x, geometry.points.Q.y], { visible: false, fixed: true });
    const R = board.create('point', [geometry.points.R.x, geometry.points.R.y], { visible: false, fixed: true });
    const S = board.create('point', [geometry.points.S.x, geometry.points.S.y], { visible: false, fixed: true });
    const A = board.create('point', [geometry.points.A.x, geometry.points.A.y], { name: '', size: 3, fixed: true, strokeColor: '#111111', fillColor: '#111111' });
    const B = board.create('point', [geometry.points.B.x, geometry.points.B.y], { name: '', size: 3, fixed: true, strokeColor: '#111111', fillColor: '#111111' });
    const M = board.create('point', [geometry.points.M.x, geometry.points.M.y], { name: '', size: 3, fixed: true, strokeColor: '#111111', fillColor: '#111111' });
    board.create('polygon', [[geometry.points.P.x, geometry.points.P.y], [geometry.points.Q.x, geometry.points.Q.y], [geometry.points.S.x, geometry.points.S.y], [geometry.points.R.x, geometry.points.R.y]], fillStyle);
    if (labelState.segment.PQ || segmentLineMode.PQ !== 0) board.create('segment', [P, Q], lineStyle);
    if (labelState.segment.RS || segmentLineMode.RS !== 0) board.create('segment', [R, S], lineStyle);
    if (labelState.segment.AM || segmentLineMode.AM !== 0) board.create('segment', [A, M], lineStyle);
    if (labelState.segment.BM || segmentLineMode.BM !== 0) board.create('segment', [B, M], lineStyle);
  }

  function drawAngleDecoration(id, geometry) {
    const mode = Number.isFinite(angleMarkerMode[id]) ? angleMarkerMode[id] : 0;
    if (mode === 0) return;
    const data = getAngleData(id, geometry);
    const vertex = data.vertex;
    const p1 = data.p1;
    const p2 = data.p2;
    const radius = Math.max(0.08, (geometry.ref / 18) * Math.max(0.35, Math.min(8, labelFontSize.angleMark[id] / 26)));
    const a1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
    const a2 = Math.atan2(p2.y - vertex.y, p2.x - vertex.x);
    let delta = a2 - a1;
    while (delta <= -Math.PI) delta += Math.PI * 2;
    while (delta > Math.PI) delta -= Math.PI * 2;
    const color = getLabelStyle('angleMark', id).color || '#687086';
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
      board.create('polygon', sectorPoints.map(function (p) { return [p.x, p.y]; }), { fixed: true, borders: { visible: false, highlight: false }, vertices: { visible: false }, fillColor: color, fillOpacity: 1, highlight: false });
    }
    const sampleAngles = [0, 0.25, 0.5, 0.75, 1].map(function (t) {
      const angle = a1 + delta * t;
      return { x: vertex.x + radius * Math.cos(angle), y: vertex.y + radius * Math.sin(angle) };
    });
    const boundsPoints = sampleAngles.concat(mode === 7 ? [{ x: vertex.x, y: vertex.y }] : [
      { x: symbolCenter.x + normal.x * symbolSize, y: symbolCenter.y + normal.y * symbolSize },
      { x: symbolCenter.x - normal.x * symbolSize, y: symbolCenter.y - normal.y * symbolSize },
      { x: symbolCenter.x + dir.x * symbolSize, y: symbolCenter.y + dir.y * symbolSize },
      { x: symbolCenter.x - dir.x * symbolSize, y: symbolCenter.y - dir.y * symbolSize }
    ]);
    const screenPoints = boundsPoints.map(userToScreenPoint);
    currentLabelAnchors.push({
      type: 'angleMark',
      id: id,
      x: symbolCenter.x,
      y: symbolCenter.y,
      scaleCenter: { x: vertex.x, y: vertex.y },
      screenRect: {
        left: Math.min.apply(null, screenPoints.map(function (p) { return p.x; })),
        right: Math.max.apply(null, screenPoints.map(function (p) { return p.x; })),
        top: Math.min.apply(null, screenPoints.map(function (p) { return p.y; })),
        bottom: Math.max.apply(null, screenPoints.map(function (p) { return p.y; }))
      },
      fontSize: labelFontSize.angleMark[id],
      rotation: 0,
      color: color
    });
  }

  function drawRightAngleDecoration(id, geometry) {
    if (!isRightAngleId(id, geometry) || !rightAngleMarkerMode[id]) return;
    const data = getAngleData(id, geometry);
    const vertex = data.vertex;
    const p1 = data.p1;
    const p2 = data.p2;
    const v1 = { x: p1.x - vertex.x, y: p1.y - vertex.y };
    const v2 = { x: p2.x - vertex.x, y: p2.y - vertex.y };
    const l1 = Math.hypot(v1.x, v1.y) || 1;
    const l2 = Math.hypot(v2.x, v2.y) || 1;
    const u1 = { x: v1.x / l1, y: v1.y / l1 };
    const u2 = { x: v2.x / l2, y: v2.y / l2 };
    const sizeScale = Math.max(0.12, Math.min(8, labelFontSize.rightAngleMark[id] / 26));
    const size = Math.max(0.02, geometry.ref * 0.035 * sizeScale);
    const pA = { x: vertex.x + u1.x * size, y: vertex.y + u1.y * size };
    const pB = { x: pA.x + u2.x * size, y: pA.y + u2.y * size };
    const pC = { x: vertex.x + u2.x * size, y: vertex.y + u2.y * size };
    const color = getLabelStyle('rightAngleMark', id).color || '#111111';
    board.create('segment', [[pA.x, pA.y], [pB.x, pB.y]], { fixed: true, strokeWidth: 2, strokeColor: color, highlight: false });
    board.create('segment', [[pB.x, pB.y], [pC.x, pC.y]], { fixed: true, strokeWidth: 2, strokeColor: color, highlight: false });
    const screenPoints = [vertex, pA, pB, pC].map(userToScreenPoint);
    currentLabelAnchors.push({
      type: 'rightAngleMark',
      id: id,
      x: (vertex.x + pB.x) / 2,
      y: (vertex.y + pB.y) / 2,
      scaleCenter: { x: vertex.x, y: vertex.y },
      screenRect: {
        left: Math.min.apply(null, screenPoints.map(function (p) { return p.x; })),
        right: Math.max.apply(null, screenPoints.map(function (p) { return p.x; })),
        top: Math.min.apply(null, screenPoints.map(function (p) { return p.y; })),
        bottom: Math.max.apply(null, screenPoints.map(function (p) { return p.y; }))
      },
      fontSize: labelFontSize.rightAngleMark[id],
      rotation: 0,
      color: color
    });
  }

  function renderLabels(geometry) {
    labelLayer.innerHTML = '';
    currentLabelAnchors = [];
    ['A', 'B', 'M'].forEach(function (id) {
      if (!labelState.point[id]) return;
      createSelectableText(getLabelPosition('point', id, getDefaultPointPosition(id, geometry)), getLabelText('point', id, geometry), labelFontSize.point[id], { type: 'point', id: id }, { color: '#1f2430' });
    });
    ['PQ', 'RS', 'AM', 'BM'].forEach(function (id) {
      if (!labelState.segment[id]) return;
      const map = { PQ: ['P', 'Q'], RS: ['R', 'S'], AM: ['A', 'M'], BM: ['B', 'M'] };
      const ends = map[id];
      window.InstantGeometrySharedOrnaments.drawSideArcLabel({
        board: board,
        P: geometry.points[ends[0]],
        Q: geometry.points[ends[1]],
        center: geometry.centroid,
        text: getLabelText('segment', id, geometry),
        labelType: 'segment',
        labelId: id,
        labelFontGroup: 'segment',
        showArc: segmentArcMode[id] !== 0,
        getLabelPosition: getLabelPosition,
        getLabelStyle: getLabelStyle,
        createSelectableText: createSelectableText,
        labelFontSize: labelFontSize
      });
    });
    angleIds.forEach(function (id) {
      if (labelState.angle[id]) createSelectableText(getLabelPosition('angle', id, getDefaultAnglePosition(id, geometry)), getLabelText('angle', id, geometry), labelFontSize.angle[id], { type: 'angle', id: id }, { color: '#687086', threshold: 0.6 });
      if (labelState.angleMark[id]) drawAngleDecoration(id, geometry);
      if (labelState.rightAngleMark[id]) drawRightAngleDecoration(id, geometry);
    });
    renderSelectionOverlay(getSelectedAnchor() || getFigureSelectionAnchor());
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
      currentGeometry = getGeometryFromInputs();
      updateExportFrame();
      const inputSignature = Object.keys(inputElements).sort().reduce(function (acc, key) {
        acc[key] = inputElements[key].value;
        return acc;
      }, {});
      const fitSignature = JSON.stringify({ inputs: inputSignature, aspect: exportAspectIndex, boxW: box.clientWidth, boxH: box.clientHeight, zoom: zoomScale });
      if (fitSignature !== lastFitSignature) {
        fitBoard(currentGeometry);
        lastFitSignature = fitSignature;
      }
      renderFigure(currentGeometry);
      renderLabels(currentGeometry);
      setStatus('図形を描画しました。', false);
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
    const anchor = currentLabelAnchors.find(function (item) { return item.type === type && item.id === id; });
    const position = (labelPositions[type] && labelPositions[type][id]) || (anchor ? { x: anchor.x, y: anchor.y } : null);
    if (!position) return;
    dragState = { mode: 'move', type: type, id: id, startClient: { x: event.clientX, y: event.clientY }, labelStart: { x: position.x, y: position.y } };
  });

  box.addEventListener('mousedown', function (event) {
    if (!currentGeometry) return;
    if (event.target.closest('.floating-label')) return;
    const coords = board.getUsrCoordsOfMouse(event);
    const point = { x: coords[0], y: coords[1] };
    const overlayControl = findSelectionControl(point);
    if ((selectedLabel || selectedFigure) && overlayControl) {
      if (overlayControl.mode === 'palette-color') {
        if (selectedLabel) labelStyleState[selectedLabel.type][selectedLabel.id].color = overlayControl.color;
        else figureState.color = overlayControl.color;
        isPaletteOpen = false;
        render();
        return;
      }
      if (overlayControl.mode === 'palette') {
        isPaletteOpen = !isPaletteOpen;
        render();
        return;
      }
      if (overlayControl.mode === 'rotate' && selectedLabel && (selectedLabel.type === 'angleMark' || selectedLabel.type === 'rightAngleMark')) return;
      const anchor = selectedLabel ? getSelectedAnchor() : getFigureSelectionAnchor();
      if (!anchor) return;
      const dragCenter = (selectedLabel && (selectedLabel.type === 'angleMark' || selectedLabel.type === 'rightAngleMark') && anchor.scaleCenter) ? anchor.scaleCenter : { x: anchor.x, y: anchor.y };
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
    if (selectedFigure && pointInFigureZone(point)) {
      dragState = { mode: 'figure-move', target: 'figure', startClient: { x: event.clientX, y: event.clientY }, offsetStart: { x: figureState.offset.x, y: figureState.offset.y } };
      return;
    }
    const anchorHit = findAnchorAtPoint(point);
    if (anchorHit) {
      selectedLabel = anchorHit;
      selectedFigure = false;
      isPaletteOpen = false;
      render();
      return;
    }
    if (pointInFigureZone(point)) {
      selectedLabel = null;
      selectedFigure = true;
      isPaletteOpen = false;
      dragState = { mode: 'figure-move', target: 'figure', startClient: { x: event.clientX, y: event.clientY }, offsetStart: { x: figureState.offset.x, y: figureState.offset.y } };
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
      labelPositions[dragState.type][dragState.id] = { x: dragState.labelStart.x + (event.clientX - dragState.startClient.x) * unitsPerPixelX, y: dragState.labelStart.y - (event.clientY - dragState.startClient.y) * unitsPerPixelY };
      scheduleRender();
      return;
    }
    if (dragState.mode === 'resize') {
      const ratio = Math.max(0.3, Math.min(8, Math.hypot(point.x - dragState.center.x, point.y - dragState.center.y) / Math.max(dragState.distanceStart, 0.01)));
      if (dragState.target === 'label') {
        const minFontSize = dragState.type === 'rightAngleMark' ? 4 : 10;
        labelFontSize[dragState.type][dragState.id] = Math.max(minFontSize, Math.min(320, Math.round(dragState.fontSizeStart * ratio)));
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
      if (dragState.target === 'label') labelStyleState[dragState.type][dragState.id].rotation = dragState.rotationStart + ((currentAngle - dragState.angleStart) * 180 / Math.PI);
      else {
        const nextRotation = dragState.rotationStart + ((currentAngle - dragState.angleStart) * 180 / Math.PI);
        const deltaRotation = nextRotation - figureState.rotation;
        if (Math.abs(deltaRotation - 0) > 1e-9) rotateLabelGroupAround(currentGeometry.centroid, deltaRotation);
        figureState.rotation = nextRotation;
      }
      scheduleRender();
      return;
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
      selectedLabel = null;
      selectedFigure = false;
      isPaletteOpen = false;
      zoomScale = 1;
      figureState.offset = { x: 0, y: 0 };
      figureState.rotation = 0;
      figureState.scale = 1;
      lastFitSignature = '';
      renderLabelToggleButtons();
      render();
    });
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
    inputElements.aPos.value = '-2.5';
    inputElements.bPos.value = '2.5';
    inputElements.theta1.value = '60';
    inputElements.theta2.value = '70';
    exportAspectIndex = 0;
    angleMode = 'degrees';
    zoomScale = 1;
    Object.keys(labelPositions).forEach(function (group) {
      Object.keys(labelPositions[group]).forEach(function (id) { labelPositions[group][id] = null; });
    });
    Object.keys(labelFontSize).forEach(function (group) {
      Object.keys(labelFontSize[group]).forEach(function (id) { labelFontSize[group][id] = labelFontDefaults[group][id]; });
    });
    Object.keys(labelStyleState).forEach(function (group) {
      Object.keys(labelStyleState[group]).forEach(function (id) { labelStyleState[group][id] = JSON.parse(JSON.stringify(styleDefaults[group][id])); });
    });
    Object.keys(labelState.point).forEach(function (id) { labelState.point[id] = true; });
    Object.keys(labelState.segment).forEach(function (id) { labelState.segment[id] = true; });
    Object.keys(labelState.angle).forEach(function (id) { labelState.angle[id] = false; });
    Object.keys(labelState.angleMark).forEach(function (id) { labelState.angleMark[id] = false; });
    Object.keys(labelState.rightAngleMark).forEach(function (id) { labelState.rightAngleMark[id] = false; });
    Object.keys(segmentArcMode).forEach(function (id) { segmentArcMode[id] = 1; });
    Object.keys(segmentLineMode).forEach(function (id) { segmentLineMode[id] = 1; });
    Object.keys(customLabelText.segment).forEach(function (id) { customLabelText.segment[id] = ''; });
    Object.keys(angleMarkerMode).forEach(function (id) { angleMarkerMode[id] = 0; });
    Object.keys(rightAngleMarkerMode).forEach(function (id) { rightAngleMarkerMode[id] = 0; });
    Object.keys(customLabelText.angle).forEach(function (id) { customLabelText.angle[id] = ''; });
    ['A', 'B', 'M', 'P', 'Q', 'R', 'S'].forEach(function (id) { pointLabelText[id] = id; });
    figureState = { color: '#2a5bd7', rotation: 0, scale: 1, offset: { x: 0, y: 0 } };
    selectedLabel = null;
    selectedFigure = false;
    isPaletteOpen = false;
    updateRatioButton();
    updateAngleModeButton();
    renderLabelToggleButtons();
    lastFitSignature = '';
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
  pageBackBtn.addEventListener('click', function () { window.history.back(); });
  downloadButtons.forEach(function (button) { button.addEventListener('click', function () { handleDownload(button.dataset.downloadFormat); }); });
  window.addEventListener('resize', function () {
    updateExportFrame();
    lastFitSignature = '';
    render();
  });

  updateRatioButton();
  updateAngleModeButton();
  updateDockToggleButtons();
  renderLabelToggleButtons();
  render();
})();
