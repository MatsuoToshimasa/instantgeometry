(function () {
  'use strict';

  function getPaletteColors() {
    return ['#1f2430', '#2a5bd7', '#c2410c', '#0f766e', '#7c3aed', '#be123c'];
  }

  function renderSelectionOverlay(deps) {
    const anchor = deps.anchor;
    if (!anchor) return null;

    const bounds = anchor.kind === 'figure'
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

  window.InstantGeometrySharedSelection = {
    getPaletteColors: getPaletteColors,
    renderSelectionOverlay: renderSelectionOverlay,
    findSelectionControl: findSelectionControl
  };
})();
