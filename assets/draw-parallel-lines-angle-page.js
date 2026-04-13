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
  const advancedSettingsBtn = document.getElementById('advancedSettingsBtn');
  const advancedSettingsBody = document.getElementById('advancedSettingsBody');
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
  let isAdvancedSettingsOpen = false;
  let selectedLabel = null;
  let paletteOpen = false;
  let dragState = null;
  let labelNodes = {};

  const labelStyles = window.InstantGeometrySharedLabels.createStyleStore();
  const lineTopY = 1.6;
  const lineBottomY = -1.6;

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

  function updateAdvancedSettingsButton() {
    advancedSettingsBody.hidden = !isAdvancedSettingsOpen;
    advancedSettingsBtn.textContent = isAdvancedSettingsOpen ? '閉じる' : '開く';
    advancedSettingsBtn.setAttribute('aria-expanded', String(isAdvancedSettingsOpen));
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
    if (!Number.isInteger(value)) throw new Error(label + 'は整数で入力してください。');
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
      const onClick = function () {
        const nextValue = !labelState[config.type][config.id];
        labelState[config.type][config.id] = nextValue;
        if (nextValue) {
          window.InstantGeometrySharedLabels.resetLabelStyle(labelStyles, config.type, config.id, getDefaultLabelStyle);
        } else if (selectedLabel && selectedLabel.type === config.type && selectedLabel.id === config.id) {
          selectedLabel = null;
          paletteOpen = false;
        }
        render();
        renderLabelToggleButtons();
      };
      let onContextMenu = null;
      if (config.type === 'point') {
        onContextMenu = async function (event) {
          event.preventDefault();
          const response = await window.InstantGeometrySharedLabelConfig.promptPointLabelSetting({
            value: customLabelText.point[config.id] || config.id
          });
          if (response === null) return;
          customLabelText.point[config.id] = String(response || '').trim();
          render();
          renderLabelToggleButtons();
        };
      } else if (config.type === 'segment') {
        onContextMenu = async function (event) {
          event.preventDefault();
          const response = await window.InstantGeometrySharedLabelConfig.promptSegmentLabelSetting({
            lineValue: String(segmentLineMode[config.id]),
            arcValue: String(segmentArcMode[config.id]),
            textValue: customLabelText.segment[config.id] || ''
          });
          if (response === null) return;
          const lineMode = window.InstantGeometrySharedOrnaments.normalizeSegmentArcInput(response.line);
          const arcMode = window.InstantGeometrySharedOrnaments.normalizeSegmentArcInput(response.arc);
          if (lineMode === null || arcMode === null) {
            setStatus('線分表示と弧表示は「0 / 1」で指定してください。', true);
            return;
          }
          segmentLineMode[config.id] = lineMode;
          segmentArcMode[config.id] = arcMode;
          customLabelText.segment[config.id] = String(response.text || '').trim();
          render();
        };
      } else if (config.type === 'angle') {
        onContextMenu = async function (event) {
          event.preventDefault();
          const response = await window.InstantGeometrySharedLabelConfig.promptAngleLabelSetting({
            markerValue: String(angleMarkerMode[config.id] || 0),
            textValue: customLabelText.angle[config.id] || '',
            rightAngleValue: '90°以外は設定不可',
            thirdDisabled: true
          });
          if (response === null) return;
          const mode = window.InstantGeometrySharedOrnaments.normalizeAngleMarkerInput(response.marker);
          if (mode === null) {
            setStatus('角マークは「0 / 1 / 2 / 3 / 4 / 5 / 6 / 7」で指定してください。', true);
            return;
          }
          angleMarkerMode[config.id] = mode;
          customLabelText.angle[config.id] = String(response.text || '').trim();
          render();
        };
      }
      const button = window.InstantGeometrySharedLabels.createToggleButton({
        className: 'download-btn btn-bd',
        text: getToggleLabel(config),
        pressed: !!labelState[config.type][config.id],
        onClick: onClick,
        onContextMenu: onContextMenu
      });
      generalLabelToggleGrid.appendChild(button);
    });
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
    const upperY = lineTopY;
    const lowerY = lineBottomY;
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
    return window.InstantGeometrySharedLabels.ensureLabelStyle(labelStyles, type, id, getDefaultLabelStyle);
  }

  function getDefaultLabelStyle(type) {
    return {
      dx: 0,
      dy: 0,
      rotation: 0,
      scale: 1,
      color: type === 'point' ? '#1f2430' : ((type === 'angle' || type === 'angleMarker') ? '#687086' : '#2a5bd7')
    };
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

  function getPointLabelAnchor(id, geometry) {
    const point = geometry.points[id];
    if (!point || !currentView) return point;
    if (id === 'A') return { x: point.x - 0.22, y: point.y + 0.24 };
    if (id === 'B') return { x: point.x + 0.22, y: point.y - 0.24 };
    if (id === 'M') return { x: point.x + 0.22, y: point.y + 0.24 };
    if (!['P', 'Q', 'R', 'S'].includes(id)) return point;

    const lineLength = Math.abs(geometry.points.Q.x - geometry.points.P.x);
    const offset = lineLength / 22;
    const marginX = lineLength / 40;
    const marginY = currentView.height * 0.035;
    const isLeft = id === 'P' || id === 'R';
    const isTop = id === 'P' || id === 'Q';

    let x = point.x + (isLeft ? -offset : offset);
    if (x < currentView.x + marginX || x > currentView.x + currentView.width - marginX) {
      x = point.x + (isLeft ? offset : -offset);
    }

    return {
      x: Math.max(currentView.x + marginX, Math.min(currentView.x + currentView.width - marginX, x)),
      y: Math.max(
        currentView.y + marginY,
        Math.min(
          currentView.y + currentView.height - marginY,
          point.y + (isTop ? marginY * 0.2 : -marginY * 0.2)
        )
      )
    };
  }

  function createDomLabel(type, id, anchor, text, fontSize) {
    return window.InstantGeometrySharedLabels.createDomSelectableLabel({
      labelLayer: labelLayer,
      getLabelStyle: getLabelStyle,
      toScreenPoint: userToScreenPoint,
      onPointerDown: handleLabelPointerDown,
      onWheel: handleLabelWheel,
      constrainToLayer: true,
      constrainMargin: 8,
      getConstraintRect: function () { return exportFrame.getBoundingClientRect(); },
      storeRef: labelNodes,
      type: type,
      id: id,
      anchor: anchor,
      text: text,
      fontSize: fontSize
    });
  }

  function createDomAngleMarker(id, anchor, mode, size) {
    return window.InstantGeometrySharedLabels.createDomSelectableMarkup({
      labelLayer: labelLayer,
      getLabelStyle: getLabelStyle,
      toScreenPoint: userToScreenPoint,
      onPointerDown: handleLabelPointerDown,
      onWheel: handleLabelWheel,
      constrainToLayer: true,
      constrainMargin: 8,
      getConstraintRect: function () { return exportFrame.getBoundingClientRect(); },
      storeRef: labelNodes,
      type: 'angleMarker',
      id: id,
      anchor: anchor,
      size: size,
      markup: window.InstantGeometrySharedOrnaments.buildAngleMarkerMarkup(mode)
    });
  }

  function renderSelectionBox() {
    if (!selectedLabel) {
      window.InstantGeometrySharedSelection.renderDomSelectionOverlay({
        labelLayer: labelLayer,
        labelRef: null
      });
      return;
    }
    const ref = labelNodes[selectedLabel.type + ':' + selectedLabel.id];
    if (!ref) {
      selectedLabel = null;
      paletteOpen = false;
      window.InstantGeometrySharedSelection.renderDomSelectionOverlay({
        labelLayer: labelLayer,
        labelRef: null
      });
      return;
    }
    window.InstantGeometrySharedSelection.renderDomSelectionOverlay({
      labelLayer: labelLayer,
      labelRef: ref,
      color: getLabelStyle(selectedLabel.type, selectedLabel.id).color,
      rotation: getLabelStyle(selectedLabel.type, selectedLabel.id).rotation,
      scale: getLabelStyle(selectedLabel.type, selectedLabel.id).scale,
      paletteOpen: paletteOpen,
      onHandlePointerDown: handleControlPointerDown,
      onPaletteColorClick: function (color) {
        getLabelStyle(selectedLabel.type, selectedLabel.id).color = color;
        paletteOpen = false;
        render();
      }
    });
  }

  function handleLabelPointerDown(event) {
    const result = window.InstantGeometrySharedLabels.beginDomLabelMove(event, getLabelStyle);
    selectedLabel = result.selectedLabel;
    paletteOpen = false;
    dragState = result.dragState;
    renderSelectionBox();
  }

  function handleLabelWheel(event) {
    selectedLabel = window.InstantGeometrySharedLabels.applyDomLabelWheel(event, getLabelStyle);
    paletteOpen = false;
    render();
  }

  function handleControlPointerDown(event) {
    const result = window.InstantGeometrySharedLabels.beginDomHandleGesture(
      event,
      selectedLabel,
      getLabelStyle,
      function (type, id) { return labelNodes[type + ':' + id]; }
    );
    const handle = result.handle;
    if (handle === 'palette') {
      paletteOpen = !paletteOpen;
      renderSelectionBox();
      return;
    }
    dragState = result.dragState;
  }

  function handleGlobalPointerMove(event) {
    if (window.InstantGeometrySharedLabels.applyDomPointerMove(event, dragState, selectedLabel, getLabelStyle, {
      getLabelRef: function (type, id) { return labelNodes[type + ':' + id]; },
      getConstraintRect: function () { return exportFrame.getBoundingClientRect(); },
      margin: 8
    })) render();
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

  function getSegmentLabelPosition(labelType, labelId, defaultPoint) {
    const style = getLabelStyle(labelType, labelId);
    const delta = screenToUserDelta(style.dx, style.dy);
    return {
      x: defaultPoint.x + delta.x,
      y: defaultPoint.y - delta.y
    };
  }

  function drawSegmentLabel(id, geometry) {
    const map = { PQ: ['P', 'Q'], RS: ['R', 'S'], AM: ['A', 'M'], BM: ['B', 'M'] };
    const ends = map[id];
    const p1 = geometry.points[ends[0]];
    const p2 = geometry.points[ends[1]];
    const style = getLabelStyle('segment', id);
    const labelGeometry = window.InstantGeometrySharedOrnaments.getSideLabelGeometry(
      p1,
      p2,
      geometry.points.M,
      'segment',
      id,
      getSegmentLabelPosition
    );
    const text = getSegmentLabelText(id, geometry);
    if (segmentArcMode[id]) {
      window.InstantGeometrySharedOrnaments.appendSplitQuadraticArc({
        svg: svg,
        createSvgElement: createSvgElement,
        P: p1,
        Q: p2,
        control: labelGeometry.control,
        leftEnd: labelGeometry.leftEnd,
        rightStart: labelGeometry.rightStart,
        stroke: style.color,
        strokeWidth: 0.03,
        dashArray: '0.15 0.1'
      });
    }
    createDomLabel('segment', id, labelGeometry.centerPoint, text, 28);
  }

  function angleHasLabel(id) {
    return !!labelState.angle[id];
  }

  function angleHasMarker(id) {
    return Number.isFinite(angleMarkerMode[id]) && angleMarkerMode[id] > 1;
  }

  function angleHasVisual(id) {
    return angleHasLabel(id) || angleHasMarker(id);
  }

  function segmentRequiredByAngle(id) {
    const map = {
      PQ: ['PAM', 'QAM'],
      RS: ['RBM', 'SBM'],
      AM: ['PAM', 'QAM', 'AMB'],
      BM: ['RBM', 'SBM', 'AMB']
    };
    return (map[id] || []).some(angleHasVisual);
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

  function drawAngleVisual(id, geometry) {
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
    const arc = window.InstantGeometrySharedOrnaments.getAngleArcData(vertex, p1, p2, 0.35);
    if (angleHasLabel(id) && !angleHasMarker(id)) {
      const style = getLabelStyle('angle', id);
      svg.appendChild(createSvgElement('path', { d: arc.d, stroke: style.color, 'stroke-width': 0.04, fill: 'none' }));
    }
    if (angleHasLabel(id)) {
      const text = getAngleLabelText(id, geometry);
      createDomLabel('angle', id, { x: vertex.x + 0.52 * Math.cos(arc.midAngle), y: vertex.y + 0.52 * Math.sin(arc.midAngle) }, text, 26);
    }
    if (angleHasMarker(id)) drawAngleMarker(id, vertex, arc.midAngle);
  }

  function drawAngleMarker(id, vertex, midAngle) {
    const mode = Number.isFinite(angleMarkerMode[id]) ? angleMarkerMode[id] : 0;
    if (mode <= 1) return;
    const cx = vertex.x + 0.34 * Math.cos(midAngle);
    const cy = vertex.y + 0.34 * Math.sin(midAngle);
    createDomAngleMarker(id, { x: cx, y: cy }, mode, 24);
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

      if (labelState.segment.PQ || segmentLineMode.PQ || segmentRequiredByAngle('PQ')) drawSegment(geometry.points.P, geometry.points.Q, '#2a5bd7', 0.05);
      if (labelState.segment.RS || segmentLineMode.RS || segmentRequiredByAngle('RS')) drawSegment(geometry.points.R, geometry.points.S, '#2a5bd7', 0.05);
      if (labelState.segment.AM || segmentLineMode.AM || segmentRequiredByAngle('AM')) drawSegment(geometry.points.A, geometry.points.M, '#2a5bd7', 0.05);
      if (labelState.segment.BM || segmentLineMode.BM || segmentRequiredByAngle('BM')) drawSegment(geometry.points.B, geometry.points.M, '#2a5bd7', 0.05);
      drawPoint(geometry.points.P, '#111111');
      drawPoint(geometry.points.Q, '#111111');
      drawPoint(geometry.points.R, '#111111');
      drawPoint(geometry.points.S, '#111111');
      drawPoint(geometry.points.A, '#111111');
      drawPoint(geometry.points.B, '#111111');
      drawPoint(geometry.points.M, '#111111');

      if (labelState.point.P) createDomLabel('point', 'P', getPointLabelAnchor('P', geometry), getPointLabelText('P'), 28);
      if (labelState.point.Q) createDomLabel('point', 'Q', getPointLabelAnchor('Q', geometry), getPointLabelText('Q'), 28);
      if (labelState.point.R) createDomLabel('point', 'R', getPointLabelAnchor('R', geometry), getPointLabelText('R'), 28);
      if (labelState.point.S) createDomLabel('point', 'S', getPointLabelAnchor('S', geometry), getPointLabelText('S'), 28);
      if (labelState.point.A) createDomLabel('point', 'A', getPointLabelAnchor('A', geometry), getPointLabelText('A'), 28);
      if (labelState.point.B) createDomLabel('point', 'B', getPointLabelAnchor('B', geometry), getPointLabelText('B'), 28);
      if (labelState.point.M) createDomLabel('point', 'M', getPointLabelAnchor('M', geometry), getPointLabelText('M'), 28);

      ['PQ', 'RS', 'AM', 'BM'].forEach(function (id) {
        if (labelState.segment[id]) drawSegmentLabel(id, geometry);
      });
      ['PAM', 'QAM', 'AMB', 'RBM', 'SBM'].forEach(function (id) {
        if (angleHasVisual(id)) drawAngleVisual(id, geometry);
      });

      renderSelectionBox();

      setStatus('図形を描画しました。', false);
    } catch (error) {
      currentGeometry = null;
      currentView = null;
      const fallbackLength = Number.isFinite(evaluateExpressionSafe(inputElements.lineLength && inputElements.lineLength.value)) ? evaluateExpressionSafe(inputElements.lineLength.value) : 14;
      const fallback = {
        points: {
          P: { x: -fallbackLength / 2, y: lineTopY },
          Q: { x: fallbackLength / 2, y: lineTopY },
          R: { x: -fallbackLength / 2, y: lineBottomY },
          S: { x: fallbackLength / 2, y: lineBottomY }
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
    inputElements.lineLength.value = '10';
    inputElements.paLength.value = '5';
    inputElements.rbLength.value = '5';
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
      window.InstantGeometrySharedLabels.clearStyleStore(labelStyles);
      selectedLabel = null;
      paletteOpen = false;
    exportAspectIndex = 0;
    angleMode = 'degrees';
    isAdvancedSettingsOpen = false;
    updateRatioButton();
    updateAngleModeButton();
    updateAdvancedSettingsButton();
    renderLabelToggleButtons();
    render();
  });
  advancedSettingsBtn.addEventListener('click', function () {
    isAdvancedSettingsOpen = !isAdvancedSettingsOpen;
    updateAdvancedSettingsButton();
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
  updateAdvancedSettingsButton();
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
