(function () {
  'use strict';

  function quadraticPoint(P, control, Q, t) {
    return {
      x: (1 - t) * (1 - t) * P.x + 2 * (1 - t) * t * control.x + t * t * Q.x,
      y: (1 - t) * (1 - t) * P.y + 2 * (1 - t) * t * control.y + t * t * Q.y
    };
  }

  function getSideArcData(P, Q, center) {
    const mx = (P.x + Q.x) / 2;
    const my = (P.y + Q.y) / 2;
    const dx = Q.x - P.x;
    const dy = Q.y - P.y;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    const toCenterX = center.x - mx;
    const toCenterY = center.y - my;

    if (nx * toCenterX + ny * toCenterY > 0) {
      nx *= -1;
      ny *= -1;
    }

    const arcHeight = Math.max(0.35, len * 0.13);
    const control = { x: mx + nx * arcHeight, y: my + ny * arcHeight };
    const gapHalf = 0.14;
    return {
      control: control,
      gapHalf: gapHalf,
      centerPoint: quadraticPoint(P, control, Q, 0.5),
      leftEnd: quadraticPoint(P, control, Q, 0.5 - gapHalf),
      rightStart: quadraticPoint(P, control, Q, 0.5 + gapHalf)
    };
  }

  function getSideLabelGeometry(P, Q, center, labelType, labelId, getLabelPosition) {
    const arc = getSideArcData(P, Q, center);
    const segmentMid = { x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 };
    const baseDirX = arc.centerPoint.x - segmentMid.x;
    const baseDirY = arc.centerPoint.y - segmentMid.y;
    const baseDirLen = Math.hypot(baseDirX, baseDirY) || 1;
    const defaultOffset = (labelId === 'a' || labelId === 'b') ? 0.14 : 0;
    const defaultPoint = {
      x: arc.centerPoint.x + (baseDirX / baseDirLen) * defaultOffset,
      y: arc.centerPoint.y + (baseDirY / baseDirLen) * defaultOffset
    };
    const desiredMidpoint = getLabelPosition(labelType, labelId, defaultPoint);
    const control = {
      x: (desiredMidpoint.x * 2) - ((P.x + Q.x) / 2),
      y: (desiredMidpoint.y * 2) - ((P.y + Q.y) / 2)
    };
    return {
      control: control,
      centerPoint: desiredMidpoint,
      gapHalf: arc.gapHalf,
      leftEnd: quadraticPoint(P, control, Q, 0.5 - arc.gapHalf),
      rightStart: quadraticPoint(P, control, Q, 0.5 + arc.gapHalf)
    };
  }

  function drawSideArcLabel(deps) {
    const labelType = deps.labelType || 'side';
    const labelId = deps.labelId || deps.sideId;
    const labelFontGroup = deps.labelFontGroup || labelType;
    const arc = getSideLabelGeometry(deps.P, deps.Q, deps.center, labelType, labelId, deps.getLabelPosition);
    const style = deps.getLabelStyle(labelType, labelId);
    const strokeWidth = 2;
    const showArc = deps.showArc !== false;

    if (showArc) {
      deps.board.create('curve', [
        function (t) { return quadraticPoint(deps.P, arc.control, deps.Q, t).x; },
        function (t) { return quadraticPoint(deps.P, arc.control, deps.Q, t).y; },
        0,
        0.5 - arc.gapHalf
      ], {
        strokeWidth: strokeWidth,
        dash: 2,
        fixed: true,
        strokeColor: style.color,
        highlight: false
      });

      deps.board.create('curve', [
        function (t) { return quadraticPoint(deps.P, arc.control, deps.Q, t).x; },
        function (t) { return quadraticPoint(deps.P, arc.control, deps.Q, t).y; },
        0.5 + arc.gapHalf,
        1
      ], {
        strokeWidth: strokeWidth,
        dash: 2,
        fixed: true,
        strokeColor: style.color,
        highlight: false
      });
    }

    deps.createSelectableText(
      arc.centerPoint,
      deps.text,
      deps.labelFontSize[labelFontGroup][labelId],
      { type: labelType, id: labelId },
      {
        color: style.color,
        threshold: 0.55,
        curveThreshold: showArc ? 0.22 : null,
        curveHit: showArc
          ? {
            P: deps.P,
            Q: deps.Q,
            control: arc.control,
            start: 0,
            gapHalf: arc.gapHalf,
            end: 1
          }
          : null
      }
    );
  }

  function normalizeSegmentArcInput(input) {
    const value = String(input || '').trim();
    if (!value || value === '0' || value === '非表示') return 0;
    if (value === '1' || value === '表示') return 1;
    return null;
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

  function getAngleArcData(vertex, p1, p2, radius) {
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

  function buildAngleMarkerMarkup(mode) {
    const common = 'stroke="currentColor" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
    if (mode === 2) {
      return '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2" ' + common + '></circle></svg>';
    }
    if (mode === 3) {
      return '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><line x1="8" y1="16" x2="16" y2="8" ' + common + '></line></svg>';
    }
    if (mode === 4) {
      return '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><line x1="7" y1="17" x2="15" y2="9" ' + common + '></line><line x1="10" y1="20" x2="18" y2="12" ' + common + '></line></svg>';
    }
    if (mode === 5) {
      return '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><line x1="8" y1="8" x2="16" y2="16" ' + common + '></line><line x1="16" y1="8" x2="8" y2="16" ' + common + '></line></svg>';
    }
    if (mode === 6) {
      return '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><polygon points="12,7 8,15 16,15" ' + common + '></polygon></svg>';
    }
    if (mode === 7) {
      return '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6 A6 6 0 0 1 18 12 L12 12 Z" fill="currentColor" stroke="none"></path></svg>';
    }
    return '';
  }

  function appendSplitQuadraticArc(deps) {
    const leftPath = deps.createSvgElement('path', {
      d: 'M ' + deps.P.x + ' ' + deps.P.y + ' Q ' + deps.control.x + ' ' + deps.control.y + ' ' + deps.leftEnd.x + ' ' + deps.leftEnd.y,
      stroke: deps.stroke,
      'stroke-width': deps.strokeWidth,
      'stroke-dasharray': deps.dashArray,
      fill: 'none'
    });
    const rightPath = deps.createSvgElement('path', {
      d: 'M ' + deps.rightStart.x + ' ' + deps.rightStart.y + ' Q ' + deps.control.x + ' ' + deps.control.y + ' ' + deps.Q.x + ' ' + deps.Q.y,
      stroke: deps.stroke,
      'stroke-width': deps.strokeWidth,
      'stroke-dasharray': deps.dashArray,
      fill: 'none'
    });
    deps.svg.appendChild(leftPath);
    deps.svg.appendChild(rightPath);
  }

  window.InstantGeometrySharedOrnaments = {
    quadraticPoint: quadraticPoint,
    getSideArcData: getSideArcData,
    getSideLabelGeometry: getSideLabelGeometry,
    drawSideArcLabel: drawSideArcLabel,
    normalizeSegmentArcInput: normalizeSegmentArcInput,
    normalizeAngleMarkerInput: normalizeAngleMarkerInput,
    getAngleArcData: getAngleArcData,
    buildAngleMarkerMarkup: buildAngleMarkerMarkup,
    appendSplitQuadraticArc: appendSplitQuadraticArc
  };
})();
