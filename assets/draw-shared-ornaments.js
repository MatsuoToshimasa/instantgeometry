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

  window.InstantGeometrySharedOrnaments = {
    quadraticPoint: quadraticPoint,
    getSideArcData: getSideArcData,
    getSideLabelGeometry: getSideLabelGeometry,
    drawSideArcLabel: drawSideArcLabel,
    normalizeSegmentArcInput: normalizeSegmentArcInput
  };
})();
