(function () {
  'use strict';

  function getPaletteColors() {
    return ['#1f2430', '#2a5bd7', '#c2410c', '#0f766e', '#7c3aed', '#be123c'];
  }

  function ensureDomSelectionStyles() {
    if (document.getElementById('instant-geometry-dom-selection-styles')) return;
    const style = document.createElement('style');
    style.id = 'instant-geometry-dom-selection-styles';
    style.textContent = ''
      + '.label-selection-box{position:absolute;border:1.6px dashed #2a5bd7;border-radius:8px;pointer-events:none;z-index:12}'
      + '.label-handle{position:absolute;width:22px;height:22px;border:none;background:transparent;display:flex;align-items:center;justify-content:center;padding:0;pointer-events:auto;z-index:13;cursor:pointer}'
      + '.label-handle svg{display:block;overflow:visible}'
      + '.label-handle.rotate svg circle{fill:#fff;stroke:#2a5bd7;stroke-width:1.6}'
      + '.label-handle.palette .palette-outer{fill:#fff;stroke:currentColor;stroke-width:1.6}'
      + '.label-handle.palette .palette-inner{fill:currentColor;stroke:currentColor;stroke-width:1}'
      + '.label-handle.resize .resize-main,.label-handle.resize .resize-wing{fill:none;stroke:#2a5bd7;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}'
      + '.palette-pop{position:absolute;pointer-events:auto;z-index:14}'
      + '.palette-pop button{position:absolute;width:18px;height:18px;border-radius:999px;border:1px solid rgba(31,36,48,.18);cursor:pointer;box-shadow:0 2px 8px rgba(27,39,94,.12)}';
    document.head.appendChild(style);
  }

  function renderSelectionOverlay(deps) {
    const anchor = deps.anchor;
    if (!anchor) return null;

    const bounds = anchor.bounds
      ? anchor.bounds
      : anchor.kind === 'figure'
      ? {
        center: { x: anchor.x, y: anchor.y },
        width: anchor.width,
        height: anchor.height,
        corners: {
          topLeft: deps.rotatePoint({ x: anchor.x - anchor.width / 2, y: anchor.y + anchor.height / 2 }, { x: anchor.x, y: anchor.y }, anchor.rotation),
          topRight: deps.rotatePoint({ x: anchor.x + anchor.width / 2, y: anchor.y + anchor.height / 2 }, { x: anchor.x, y: anchor.y }, anchor.rotation),
          bottomRight: deps.rotatePoint({ x: anchor.x + anchor.width / 2, y: anchor.y - anchor.height / 2 }, { x: anchor.x, y: anchor.y }, anchor.rotation),
          bottomLeft: deps.rotatePoint({ x: anchor.x - anchor.width / 2, y: anchor.y - anchor.height / 2 }, { x: anchor.x, y: anchor.y }, anchor.rotation)
        }
      }
      : deps.getLabelBounds(anchor);

    const corners = bounds.corners;
    const pxToUser = function (px) {
      const userPerPx = (1 / Math.max(Math.abs(deps.board.unitX), 1e-6) + 1 / Math.max(Math.abs(deps.board.unitY), 1e-6)) / 2;
      return px * userPerPx;
    };
    const boundsWidthPx = Math.max(1, Math.abs(bounds.width * deps.board.unitX));
    const boundsHeightPx = Math.max(1, Math.abs(bounds.height * deps.board.unitY));
    const iconBasePx = Math.max(9, Math.min(20, Math.min(boundsWidthPx, boundsHeightPx) * 0.23));
    const iconGapPx = 14;
    const iconGapUser = pxToUser(iconGapPx);

    function extendFromCorner(corner) {
      const vx = corner.x - bounds.center.x;
      const vy = corner.y - bounds.center.y;
      const vlen = Math.hypot(vx, vy) || 1;
      return {
        x: corner.x + (vx / vlen) * iconGapUser,
        y: corner.y + (vy / vlen) * iconGapUser
      };
    }

    const rotateHandle = extendFromCorner(corners.topRight);
    const resizeHandle = extendFromCorner(corners.bottomRight);
    const paletteHandle = extendFromCorner(corners.bottomLeft);

    [[corners.topLeft, corners.topRight], [corners.topRight, corners.bottomRight], [corners.bottomRight, corners.bottomLeft], [corners.bottomLeft, corners.topLeft]].forEach(function (pair) {
      deps.board.create('segment', [[pair[0].x, pair[0].y], [pair[1].x, pair[1].y]], {
        fixed: true,
        strokeColor: '#2a5bd7',
        strokeWidth: 1.6,
        dash: 2
      });
    });

    const resizeHalf = pxToUser(iconBasePx * 0.56);
    const resizeWing = pxToUser(iconBasePx * 0.25);
    const resizeDir = { x: -Math.SQRT1_2, y: Math.SQRT1_2 };
    const resizeNorm = { x: -resizeDir.y, y: resizeDir.x };
    const resizeStart = {
      x: resizeHandle.x - resizeDir.x * resizeHalf,
      y: resizeHandle.y - resizeDir.y * resizeHalf
    };
    const resizeEnd = {
      x: resizeHandle.x + resizeDir.x * resizeHalf,
      y: resizeHandle.y + resizeDir.y * resizeHalf
    };

    deps.board.create('segment', [[resizeStart.x, resizeStart.y], [resizeEnd.x, resizeEnd.y]], {
      fixed: true,
      strokeWidth: 1.6,
      strokeColor: '#2a5bd7'
    });
    deps.board.create('segment', [[resizeStart.x, resizeStart.y], [resizeStart.x + resizeDir.x * resizeWing + resizeNorm.x * resizeWing, resizeStart.y + resizeDir.y * resizeWing + resizeNorm.y * resizeWing]], {
      fixed: true,
      strokeWidth: 1.4,
      strokeColor: '#2a5bd7'
    });
    deps.board.create('segment', [[resizeStart.x, resizeStart.y], [resizeStart.x + resizeDir.x * resizeWing - resizeNorm.x * resizeWing, resizeStart.y + resizeDir.y * resizeWing - resizeNorm.y * resizeWing]], {
      fixed: true,
      strokeWidth: 1.4,
      strokeColor: '#2a5bd7'
    });
    deps.board.create('segment', [[resizeEnd.x, resizeEnd.y], [resizeEnd.x - resizeDir.x * resizeWing + resizeNorm.x * resizeWing, resizeEnd.y - resizeDir.y * resizeWing + resizeNorm.y * resizeWing]], {
      fixed: true,
      strokeWidth: 1.4,
      strokeColor: '#2a5bd7'
    });
    deps.board.create('segment', [[resizeEnd.x, resizeEnd.y], [resizeEnd.x - resizeDir.x * resizeWing - resizeNorm.x * resizeWing, resizeEnd.y - resizeDir.y * resizeWing - resizeNorm.y * resizeWing]], {
      fixed: true,
      strokeWidth: 1.4,
      strokeColor: '#2a5bd7'
    });

    deps.board.create('point', [rotateHandle.x, rotateHandle.y], {
      name: '',
      fixed: true,
      size: iconBasePx * 0.58,
      strokeColor: '#2a5bd7',
      fillColor: '#ffffff'
    });

    deps.board.create('point', [paletteHandle.x, paletteHandle.y], {
      name: '',
      fixed: true,
      size: iconBasePx * 0.54,
      strokeColor: anchor.color,
      fillColor: '#ffffff'
    });

    deps.board.create('point', [paletteHandle.x, paletteHandle.y], {
      name: '',
      fixed: true,
      size: iconBasePx * 0.28,
      strokeColor: anchor.color,
      fillColor: anchor.color
    });

    const palette = [];
    if (deps.isPaletteOpen) {
      getPaletteColors().forEach(function (color, index) {
        const radius = pxToUser(Math.max(30, iconBasePx * 2.8));
        const startAngle = 210;
        const endAngle = 330;
        const angle = startAngle + ((endAngle - startAngle) * (index / Math.max(1, getPaletteColors().length - 1)));
        const rad = angle * Math.PI / 180;
        const localPoint = {
          x: paletteHandle.x + Math.cos(rad) * radius,
          y: paletteHandle.y + Math.sin(rad) * radius
        };
        const point = deps.rotatePoint(localPoint, paletteHandle, anchor.rotation);
        deps.board.create('point', [point.x, point.y], {
          name: '',
          fixed: true,
          size: Math.max(4.5, iconBasePx * 0.5),
          strokeColor: color,
          fillColor: color
        });
        palette.push({ color: color, x: point.x, y: point.y });
      });
    }

    return {
      kind: anchor.kind || 'label',
      bounds: bounds,
      resizeHandle: resizeHandle,
      rotateHandle: rotateHandle,
      paletteHandle: paletteHandle,
      resizeHitRadius: pxToUser(iconBasePx * 0.9),
      rotateHitRadius: pxToUser(iconBasePx),
      paletteHitRadius: pxToUser(iconBasePx),
      paletteColorHitRadius: pxToUser(iconBasePx * 0.62),
      palette: palette
    };
  }

  function findSelectionControl(point, overlay) {
    if (!overlay) return null;
    if (Math.hypot(point.x - overlay.resizeHandle.x, point.y - overlay.resizeHandle.y) <= (overlay.resizeHitRadius || 0.22)) {
      return { mode: 'resize' };
    }
    if (Math.hypot(point.x - overlay.rotateHandle.x, point.y - overlay.rotateHandle.y) <= (overlay.rotateHitRadius || 0.28)) {
      return { mode: 'rotate' };
    }
    if (Math.hypot(point.x - overlay.paletteHandle.x, point.y - overlay.paletteHandle.y) <= (overlay.paletteHitRadius || 0.26)) {
      return { mode: 'palette' };
    }
    for (let index = 0; index < overlay.palette.length; index += 1) {
      const item = overlay.palette[index];
      if (Math.hypot(point.x - item.x, point.y - item.y) <= (overlay.paletteColorHitRadius || 0.18)) {
        return { mode: 'palette-color', color: item.color };
      }
    }
    return null;
  }

  function renderDomSelectionOverlay(deps) {
    ensureDomSelectionStyles();
    const labelLayer = deps.labelLayer;
    const existing = labelLayer.querySelectorAll('.label-selection-box,.label-handle,.palette-pop');
    existing.forEach(function (node) { node.remove(); });
    if (!deps.labelRef) return null;

    const rect = deps.labelRef.node.getBoundingClientRect();
    const layerRect = labelLayer.getBoundingClientRect();
    const rotation = Number.isFinite(deps.rotation) ? deps.rotation : 0;
    const scale = Number.isFinite(deps.scale) ? deps.scale : 1;
    const baseWidth = deps.labelRef.node.offsetWidth * scale;
    const baseHeight = deps.labelRef.node.offsetHeight * scale;
    const centerX = rect.left - layerRect.left + rect.width / 2;
    const centerY = rect.top - layerRect.top + rect.height / 2;
    const boxWidth = baseWidth + 6;
    const boxHeight = baseHeight + 6;
    const boxNode = document.createElement('div');
    boxNode.className = 'label-selection-box';
    boxNode.style.left = (centerX - boxWidth / 2) + 'px';
    boxNode.style.top = (centerY - boxHeight / 2) + 'px';
    boxNode.style.width = boxWidth + 'px';
    boxNode.style.height = boxHeight + 'px';
    boxNode.style.transformOrigin = 'center center';
    boxNode.style.transform = 'rotate(' + rotation + 'deg)';
    if (typeof deps.onBoxPointerDown === 'function') {
      boxNode.addEventListener('pointerdown', deps.onBoxPointerDown);
    }
    labelLayer.appendChild(boxNode);

    function rotatePoint(point) {
      const rad = rotation * Math.PI / 180;
      const dx = point.x - centerX;
      const dy = point.y - centerY;
      return {
        x: centerX + dx * Math.cos(rad) - dy * Math.sin(rad),
        y: centerY + dx * Math.sin(rad) + dy * Math.cos(rad)
      };
    }

    const topLeft = rotatePoint({ x: centerX - boxWidth / 2, y: centerY - boxHeight / 2 });
    const topRight = rotatePoint({ x: centerX + boxWidth / 2, y: centerY - boxHeight / 2 });
    const bottomRight = rotatePoint({ x: centerX + boxWidth / 2, y: centerY + boxHeight / 2 });
    const bottomLeft = rotatePoint({ x: centerX - boxWidth / 2, y: centerY + boxHeight / 2 });

    function extendFromCorner(corner) {
      const vx = corner.x - centerX;
      const vy = corner.y - centerY;
      const len = Math.hypot(vx, vy) || 1;
      const gap = 14;
      return {
        x: corner.x + (vx / len) * gap,
        y: corner.y + (vy / len) * gap
      };
    }

    function addHandle(name, left, top) {
      const handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'label-handle ' + name;
      handle.dataset.handle = name;
      handle.style.left = left + 'px';
      handle.style.top = top + 'px';
      if (name === 'palette') {
        handle.style.color = deps.color;
        handle.innerHTML = '<svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><circle class="palette-outer" cx="11" cy="11" r="8"></circle><circle class="palette-inner" cx="11" cy="11" r="4"></circle></svg>';
      } else if (name === 'rotate') {
        handle.innerHTML = '<svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle></svg>';
      } else if (name === 'resize') {
        handle.innerHTML = '<svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><path class="resize-main" d="M6 16 L16 6"></path><path class="resize-wing" d="M6 16 L6 11"></path><path class="resize-wing" d="M6 16 L11 16"></path><path class="resize-wing" d="M16 6 L16 11"></path><path class="resize-wing" d="M16 6 L11 6"></path></svg>';
      }
      handle.addEventListener('pointerdown', deps.onHandlePointerDown);
      labelLayer.appendChild(handle);
      return handle;
    }

    const palettePos = extendFromCorner(bottomLeft);
    const rotatePos = extendFromCorner(topRight);
    const resizePos = extendFromCorner(bottomRight);
    addHandle('palette', palettePos.x - 11, palettePos.y - 11);
    addHandle('rotate', rotatePos.x - 11, rotatePos.y - 11);
    addHandle('resize', resizePos.x - 11, resizePos.y - 11);

    if (deps.paletteOpen) {
      const pop = document.createElement('div');
      pop.className = 'palette-pop';
      const cx = palettePos.x;
      const cy = palettePos.y;
      getPaletteColors().forEach(function (color, index) {
        const angle = (30 + ((150 - 30) * index / Math.max(getPaletteColors().length - 1, 1))) * Math.PI / 180;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.style.background = color;
        btn.style.left = (cx + Math.cos(angle) * 42 - 9) + 'px';
        btn.style.top = (cy + Math.sin(angle) * 42 - 9) + 'px';
        btn.addEventListener('click', function (event) {
          event.stopPropagation();
          deps.onPaletteColorClick(color);
        });
        pop.appendChild(btn);
      });
      labelLayer.appendChild(pop);
    }

    return { rect: rect };
  }

  function renderDomSelectionForState(deps) {
    const selectedLabel = deps.selectedLabel;
    if (!selectedLabel) {
      renderDomSelectionOverlay({
        labelLayer: deps.labelLayer,
        labelRef: null
      });
      return { selectedLabel: null, paletteOpen: false };
    }
    const ref = deps.labelNodes[selectedLabel.type + ':' + selectedLabel.id];
    if (!ref) {
      renderDomSelectionOverlay({
        labelLayer: deps.labelLayer,
        labelRef: null
      });
      return { selectedLabel: null, paletteOpen: false };
    }
    renderDomSelectionOverlay({
      labelLayer: deps.labelLayer,
      labelRef: ref,
      color: deps.getLabelStyle(selectedLabel.type, selectedLabel.id).color,
      rotation: deps.getLabelStyle(selectedLabel.type, selectedLabel.id).rotation,
      scale: deps.getLabelStyle(selectedLabel.type, selectedLabel.id).scale,
      paletteOpen: deps.paletteOpen,
      onHandlePointerDown: deps.onHandlePointerDown,
      onPaletteColorClick: deps.onPaletteColorClick
    });
    return { selectedLabel: selectedLabel, paletteOpen: deps.paletteOpen };
  }

  function createVirtualSelectionRef(rect) {
    if (!rect) return null;
    return {
      node: {
        offsetWidth: rect.width,
        offsetHeight: rect.height,
        getBoundingClientRect: function () {
          return {
            left: rect.left,
            top: rect.top,
            right: rect.left + rect.width,
            bottom: rect.top + rect.height,
            width: rect.width,
            height: rect.height
          };
        }
      }
    };
  }

  function createAggregateSelectionRef(baseRect, labelNodes) {
    if (!baseRect) return null;
    const visibleRects = [baseRect];
    Object.keys(labelNodes || {}).forEach(function (key) {
      const ref = labelNodes[key];
      if (!ref || !ref.node || typeof ref.node.getBoundingClientRect !== 'function') return;
      const nodeRect = ref.node.getBoundingClientRect();
      if (!nodeRect.width && !nodeRect.height) return;
      visibleRects.push({
        left: nodeRect.left,
        top: nodeRect.top,
        width: nodeRect.width,
        height: nodeRect.height
      });
    });
    const union = visibleRects.reduce(function (acc, item) {
      if (!acc) {
        return {
          left: item.left,
          top: item.top,
          right: item.left + item.width,
          bottom: item.top + item.height
        };
      }
      return {
        left: Math.min(acc.left, item.left),
        top: Math.min(acc.top, item.top),
        right: Math.max(acc.right, item.left + item.width),
        bottom: Math.max(acc.bottom, item.top + item.height)
      };
    }, null);
    return createVirtualSelectionRef({
      left: union.left,
      top: union.top,
      width: union.right - union.left,
      height: union.bottom - union.top
    });
  }

  function computeRotatedBoundsFromPoints(center, rotationDeg, points, scaleMultiplier) {
    const rotation = (Number.isFinite(rotationDeg) ? rotationDeg : 0) * Math.PI / 180;
    const cos = Math.cos(-rotation);
    const sin = Math.sin(-rotation);
    const localPoints = (points || []).map(function (point) {
      const dx = point.x - center.x;
      const dy = point.y - center.y;
      return {
        x: dx * cos - dy * sin,
        y: dx * sin + dy * cos
      };
    });
    if (!localPoints.length) {
      localPoints.push({ x: 0, y: 0 });
    }
    const minX = Math.min.apply(null, localPoints.map(function (point) { return point.x; }));
    const maxX = Math.max.apply(null, localPoints.map(function (point) { return point.x; }));
    const minY = Math.min.apply(null, localPoints.map(function (point) { return point.y; }));
    const maxY = Math.max.apply(null, localPoints.map(function (point) { return point.y; }));
    const localCenter = {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2
    };
    const width = Math.max((maxX - minX) * (scaleMultiplier || 1), 1e-6);
    const height = Math.max((maxY - minY) * (scaleMultiplier || 1), 1e-6);
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const cornersLocal = {
      topLeft: { x: localCenter.x - halfWidth, y: localCenter.y + halfHeight },
      topRight: { x: localCenter.x + halfWidth, y: localCenter.y + halfHeight },
      bottomRight: { x: localCenter.x + halfWidth, y: localCenter.y - halfHeight },
      bottomLeft: { x: localCenter.x - halfWidth, y: localCenter.y - halfHeight }
    };
    const rotateForward = function (point) {
      const c = Math.cos(rotation);
      const s = Math.sin(rotation);
      return {
        x: center.x + point.x * c - point.y * s,
        y: center.y + point.x * s + point.y * c
      };
    };
    return {
      center: rotateForward(localCenter),
      width: width,
      height: height,
      corners: {
        topLeft: rotateForward(cornersLocal.topLeft),
        topRight: rotateForward(cornersLocal.topRight),
        bottomRight: rotateForward(cornersLocal.bottomRight),
        bottomLeft: rotateForward(cornersLocal.bottomLeft)
      }
    };
  }

  function isNonTransformableSelectionType(type) {
    return ['segment', 'side', 'diagonal', 'specialSegment', 'sideObject', 'specialSegmentObject', 'diagonalObject'].includes(type);
  }

  window.InstantGeometrySharedSelection = {
    computeRotatedBoundsFromPoints: computeRotatedBoundsFromPoints,
    createAggregateSelectionRef: createAggregateSelectionRef,
    createVirtualSelectionRef: createVirtualSelectionRef,
    isNonTransformableSelectionType: isNonTransformableSelectionType,
    getPaletteColors: getPaletteColors,
    ensureDomSelectionStyles: ensureDomSelectionStyles,
    renderSelectionOverlay: renderSelectionOverlay,
    findSelectionControl: findSelectionControl,
    renderDomSelectionOverlay: renderDomSelectionOverlay,
    renderDomSelectionForState: renderDomSelectionForState
  };
})();
