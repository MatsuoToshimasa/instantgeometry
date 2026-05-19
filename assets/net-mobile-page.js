(function () {
  'use strict';

  function svg(tag, attrs) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (attrs[key] !== null && attrs[key] !== undefined) node.setAttribute(key, String(attrs[key]));
    });
    return node;
  }

  function parsePositive(value, name) {
    const text = String(value || '').trim();
    if (!/^[1-9][0-9]*(?:\.[0-9]+)?$|^0\.[0-9]*[1-9][0-9]*$/.test(text)) {
      throw new Error(name + ' には 0 より大きい数を入力してください。');
    }
    return Number(text);
  }

  function linePath(points) {
    return points.map(function (p, index) {
      return (index ? 'L ' : 'M ') + p.x + ' ' + p.y;
    }).join(' ');
  }

  function polar(cx, cy, radius, angle) {
    return {
      x: cx + radius * Math.cos(angle),
      y: cy - radius * Math.sin(angle)
    };
  }

  function arcPoints(cx, cy, radius, start, sweep) {
    const count = Math.max(24, Math.ceil(Math.abs(sweep) / (Math.PI * 2) * 144));
    const points = [];
    for (let i = 0; i <= count; i += 1) {
      points.push(polar(cx, cy, radius, start + sweep * i / count));
    }
    return points;
  }

  function sectorPath(cx, cy, radius, start, sweep) {
    const points = [{ x: cx, y: cy }].concat(arcPoints(cx, cy, radius, start, sweep));
    return linePath(points) + ' Z';
  }

  function addText(stage, text, x, y, className) {
    const attrs = {
      x: x,
      y: y,
      class: 'shape-label ' + (className || ''),
      'text-anchor': 'middle',
      'dominant-baseline': 'middle'
    };
    let node = window.InstantGeometrySharedLabels && typeof window.InstantGeometrySharedLabels.createSvgKatexLabel === 'function'
      ? window.InstantGeometrySharedLabels.createSvgKatexLabel({
        createSvg: svg,
        text: text,
        attrs: attrs,
        kind: className === 'area-label' ? 'area' : 'point',
        id: text
      })
      : null;
    if (!node) {
      node = svg('text', attrs);
      node.textContent = text;
    }
    stage.appendChild(node);
  }

  function downloadBlob(blob, filename) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  }

  function createConePage(config) {
    const stage = document.getElementById('stage');
    const captureRoot = document.getElementById('captureRoot');
    const statusBox = document.getElementById('statusBox');
    const radiusInput = document.getElementById(config.radiusInputId);
    const slantInput = document.getElementById(config.slantInputId);
    const backBtn = document.getElementById('backBtn');
    const saveBtn = document.getElementById('saveBtn');
    const editSheet = document.getElementById('editSheet');
    const sheetTitle = document.getElementById('sheetTitle');
    const sheetBody = document.getElementById('sheetBody');
    const sheetClose = document.getElementById('sheetClose');
    const saveSheet = document.getElementById('saveSheet');
    const sheetBackdrop = document.getElementById('sheetBackdrop');
    const saveSheetClose = document.getElementById('saveSheetClose');
    const savePngBtn = document.getElementById('savePngBtn');
    const saveTransparentBtn = document.getElementById('saveTransparentBtn');
    const savePdfBtn = document.getElementById('savePdfBtn');
    const LabelEngine = window.InstantGeometryDrawLabelEngine || window.InstantGeometryTriangleLabelEngine || null;
    const segmentInputs = { slant: ' ', radius: ' ' };
    const angleInputs = { sector: ' ' };
    const segmentKinds = { slant: 'plain', radius: 'plain' };
    const angleKinds = { sector: 'plain' };
    const segmentGuideVisible = { slant: true, radius: true };
    const angleArcScales = { sector: 1 };
    const labelScales = {};
    const labelColors = {};
    let labelController = null;

    if (window.InstantGeometrySaveQuota) {
      window.InstantGeometrySaveQuota.createIndicator({ target: saveBtn });
    }

    function setStatus(message, isError) {
      statusBox.textContent = message;
      statusBox.classList.toggle('error', !!isError);
    }

    function getDecimalPlaces() {
      const settings = window.InstantGeometryDrawSettings;
      if (settings && typeof settings.getDecimalPlaces === 'function') return settings.getDecimalPlaces();
      return 2;
    }

    function formatNumber(value) {
      const digits = getDecimalPlaces();
      const factor = Math.pow(10, digits);
      const rounded = Math.round(value * factor) / factor;
      return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '');
    }

    function formatAngleValue(degrees) {
      const text = formatNumber(degrees);
      const settings = window.InstantGeometryDrawSettings;
      if (settings && typeof settings.formatAngle === 'function') return settings.formatAngle(text);
      return text + '°';
    }

    function closeSaveSheet() {
      if (editSheet) {
        editSheet.classList.remove('open');
        editSheet.setAttribute('aria-hidden', 'true');
      }
      if (sheetBody) sheetBody.innerHTML = '';
      saveSheet.classList.remove('open');
      saveSheet.setAttribute('aria-hidden', 'true');
      sheetBackdrop.classList.remove('open');
    }

    function labelStyleKey(kind, id) {
      return String(kind || '') + ':' + String(id || '');
    }

    function getLabelScale(kind, id) {
      const value = labelScales[labelStyleKey(kind, id)];
      return Number.isFinite(value) && value > 0 ? value : 1;
    }

    function setLabelScale(kind, id, value) {
      labelScales[labelStyleKey(kind, id)] = Math.max(0.1, Math.min(4, Number(value) || 1));
    }

    function getDefaultLabelColor(kind) {
      return kind === 'angle' ? '#687086' : '#2a5bd7';
    }

    function getLabelColor(kind, id) {
      return labelColors[labelStyleKey(kind, id)] || getDefaultLabelColor(kind);
    }

    function setLabelColor(kind, id, value) {
      labelColors[labelStyleKey(kind, id)] = value || getDefaultLabelColor(kind);
    }

    function getAngleArcScale(kind, id) {
      const value = angleArcScales[id];
      return Number.isFinite(value) && value > 0 ? value : 1;
    }

    function setAngleArcScale(kind, id, value) {
      angleArcScales[id] = Math.max(0.3, Math.min(3, Number(value) || 1));
    }

    function getNumericLabel(raw, numericText) {
      if (!raw) return '';
      if (LabelEngine && typeof LabelEngine.isRatioLabelValue === 'function' && LabelEngine.isRatioLabelValue(raw)) {
        return LabelEngine.getRatioLabelInput(raw);
      }
      if (raw === ' ' || raw === '0' || raw === 'decimal:' || raw === 'raw:') return numericText;
      return String(raw || '');
    }

    function getSegmentLabel(id, numericValue) {
      const raw = segmentInputs[id];
      return getNumericLabel(raw, formatNumber(numericValue));
    }

    function getAngleLabel(id, numericValue) {
      const raw = angleInputs[id];
      return getNumericLabel(raw, formatAngleValue(numericValue));
    }

    function addHitLine(x1, y1, x2, y2, id) {
      const hit = svg('line', {
        x1: x1,
        y1: y1,
        x2: x2,
        y2: y2,
        stroke: 'transparent',
        'stroke-width': 34,
        'stroke-linecap': 'round',
        'pointer-events': 'stroke',
        cursor: 'pointer',
        tabindex: '0',
        role: 'button',
        'aria-label': '線分' + (id === 'slant' ? '母線' : '半径') + 'を編集',
        'data-kind': 'segment',
        'data-id': id
      });
      hit.addEventListener('click', function (event) {
        event.stopPropagation();
        openSegmentModal(id);
      });
      hit.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openSegmentModal(id);
        }
      });
      stage.appendChild(hit);
    }

    function quadraticPoint(P, control, Q, t) {
      return {
        x: (1 - t) * (1 - t) * P.x + 2 * (1 - t) * t * control.x + t * t * Q.x,
        y: (1 - t) * (1 - t) * P.y + 2 * (1 - t) * t * control.y + t * t * Q.y
      };
    }

    function quadraticPathSegment(P, control, Q, start, end, steps) {
      const points = [];
      const count = steps || 24;
      for (let i = 0; i <= count; i += 1) {
        const t = start + (end - start) * (i / count);
        points.push(quadraticPoint(P, control, Q, t));
      }
      return linePath(points);
    }

    function sideArcGeometry(P, Q, center, labelPoint, labelWidth) {
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
      const arcHeight = Math.max(24, len * 0.13);
      const defaultCenter = { x: mx + nx * arcHeight, y: my + ny * arcHeight };
      const desired = labelPoint || defaultCenter;
      const control = {
        x: desired.x * 2 - mx,
        y: desired.y * 2 - my
      };
      const gapHalf = labelWidth && len
        ? Math.min(0.42, Math.max(0.14, (labelWidth / len) * 0.62))
        : 0.14;
      return { control: control, gapHalf: gapHalf };
    }

    function drawSegmentGuide(id, P, Q, center, labelPoint, labelWidth) {
      if (segmentGuideVisible[id] === false) return;
      const geom = sideArcGeometry(P, Q, center, labelPoint, labelWidth);
      const attrs = {
        fill: 'none',
        stroke: getLabelColor('segment', id),
        'stroke-width': 2,
        'stroke-linecap': 'round',
        'stroke-dasharray': '6 5',
        'pointer-events': 'none',
        'data-guide-kind': 'segment',
        'data-guide-id': id
      };
      stage.appendChild(svg('path', Object.assign({
        d: quadraticPathSegment(P, geom.control, Q, 0, 0.5 - geom.gapHalf, 20)
      }, attrs)));
      stage.appendChild(svg('path', Object.assign({
        d: quadraticPathSegment(P, geom.control, Q, 0.5 + geom.gapHalf, 1, 20)
      }, attrs)));
    }

    function segmentLabelPoint(P, Q, insidePoint, offset) {
      const mx = (P.x + Q.x) / 2;
      const my = (P.y + Q.y) / 2;
      const dx = Q.x - P.x;
      const dy = Q.y - P.y;
      const len = Math.hypot(dx, dy) || 1;
      let nx = -dy / len;
      let ny = dx / len;
      const toInsideX = insidePoint.x - mx;
      const toInsideY = insidePoint.y - my;
      if (nx * toInsideX + ny * toInsideY > 0) {
        nx *= -1;
        ny *= -1;
      }
      return { x: mx + nx * offset, y: my + ny * offset };
    }

    function addAngleHitPath(points, id) {
      const hit = svg('path', {
        d: linePath(points),
        fill: 'none',
        stroke: 'transparent',
        'stroke-width': 34,
        'stroke-linecap': 'round',
        'pointer-events': 'stroke',
        cursor: 'pointer',
        tabindex: '0',
        role: 'button',
        'aria-label': '角' + (id === 'sector' ? '中心角' : '') + 'を編集',
        'data-kind': 'angle',
        'data-id': id
      });
      hit.addEventListener('click', function (event) {
        event.stopPropagation();
        openAngleModal(id);
      });
      hit.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openAngleModal(id);
        }
      });
      stage.appendChild(hit);
    }

    function addSegmentLabel(id, text, x, y) {
      if (!text) return;
      const attrs = {
        x: x,
        y: y,
        class: 'shape-label measure-label',
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
        'font-size': 42 * getLabelScale('segment', id),
        fill: getLabelColor('segment', id),
        'data-kind': 'segment',
        'data-id': id
      };
      let node = window.InstantGeometrySharedLabels && typeof window.InstantGeometrySharedLabels.createSvgKatexLabel === 'function'
        ? window.InstantGeometrySharedLabels.createSvgKatexLabel({ createSvg: svg, text: text, attrs: attrs, kind: 'segment', id: id })
        : null;
      if (!node) {
        node = svg('text', attrs);
        node.textContent = text;
      }
      node.style.cursor = 'pointer';
      node.setAttribute('tabindex', '0');
      node.setAttribute('role', 'button');
      node.setAttribute('aria-label', '線分' + (id === 'slant' ? '母線' : '半径') + 'を編集');
      node.addEventListener('click', function (event) {
        event.stopPropagation();
        openSegmentModal(id);
      });
      node.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openSegmentModal(id);
        }
      });
      stage.appendChild(node);
    }

    function addAngleLabel(id, text, x, y) {
      if (!text) return;
      const attrs = {
        x: x,
        y: y,
        class: 'shape-label angle-label',
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
        'font-size': 38 * getLabelScale('angle', id),
        fill: getLabelColor('angle', id),
        'data-kind': 'angle',
        'data-id': id
      };
      let node = window.InstantGeometrySharedLabels && typeof window.InstantGeometrySharedLabels.createSvgKatexLabel === 'function'
        ? window.InstantGeometrySharedLabels.createSvgKatexLabel({ createSvg: svg, text: text, attrs: attrs, kind: 'angle', id: id })
        : null;
      if (!node) {
        node = svg('text', attrs);
        node.textContent = text;
      }
      node.style.cursor = 'pointer';
      node.setAttribute('tabindex', '0');
      node.setAttribute('role', 'button');
      node.setAttribute('aria-label', '角' + (id === 'sector' ? '中心角' : '') + 'を編集');
      node.addEventListener('click', function (event) {
        event.stopPropagation();
        openAngleModal(id);
      });
      node.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openAngleModal(id);
        }
      });
      stage.appendChild(node);
    }

    function buildSegmentKindSelect(kind, id, buildSelect) {
      return buildSelect('線分マーク', segmentKinds[id] || 'plain', [
        { value: 'plain', label: '通常' },
        { value: 'circle', label: '丸付き' },
        { value: 'single', label: '一本線付き' },
        { value: 'double', label: '二重線付き' },
        { value: 'cross', label: '交差付き' },
        { value: 'triangle', label: '三角付き' },
        { value: 'parallel', label: '平行矢印付き' },
        { value: 'parallel-reverse', label: '平行矢印付き（逆向き）' },
        { value: 'parallel-single', label: '平行＋一本線付き' },
        { value: 'parallel-single-reverse', label: '平行＋一本線付き（逆向き）' },
        { value: 'parallel-double', label: '平行＋二重線付き' },
        { value: 'parallel-double-reverse', label: '平行＋二重線付き（逆向き）' }
      ]);
    }

    function initLabelController() {
      if (!LabelEngine || typeof LabelEngine.createController !== 'function') return;
      labelController = LabelEngine.createController({
        enabledLabels: { segment: true, angle: true },
        editSheet: editSheet,
        sheetTitle: sheetTitle,
        sheetBody: sheetBody,
        sheetBackdrop: sheetBackdrop,
        closeSheets: closeSaveSheet,
        render: render,
        onError: function (error) { setStatus(error.message || '入力を確認してください。', true); },
        getModalSpec: function (kind, id, modalType) {
          return LabelEngine.getStandardModalSpec(modalType, { guideLabel: 'ガイドを表示', moveAction: false });
        },
        getTitle: function (kind, id) {
          if (kind === 'angle') return id === 'sector' ? '角 中心角' : '角';
          return id === 'slant' ? '線分 母線' : '線分 半径';
        },
        buildSegmentKindSelect: buildSegmentKindSelect,
        getKind: function (kind, id) { return kind === 'angle' ? angleKinds[id] || 'plain' : segmentKinds[id] || 'plain'; },
        setKind: function (kind, id, value) {
          if (kind === 'angle') angleKinds[id] = value || 'plain';
          else if (kind === 'segment') segmentKinds[id] = value || 'plain';
        },
        getAngleValue: function (kind, id) { return id === 'sector' ? readGeometry().angle : null; },
        hasGuideField: function (kind) { return kind === 'segment'; },
        getGuideVisible: function (kind, id) { return segmentGuideVisible[id] !== false; },
        setGuideVisible: function (kind, id, checked) {
          if (kind === 'segment') segmentGuideVisible[id] = !!checked;
        },
        getLabelValue: function (kind, id) { return kind === 'angle' ? angleInputs[id] || '' : segmentInputs[id] || ''; },
        setLabelValue: function (kind, id, value) {
          if (kind === 'angle') angleInputs[id] = value || '';
          else segmentInputs[id] = value || '';
        },
        getLabelScale: getLabelScale,
        setLabelScale: setLabelScale,
        getAngleArcScale: getAngleArcScale,
        setAngleArcScale: setAngleArcScale,
        getColor: getLabelColor,
        setColor: setLabelColor,
        hasColorField: function () { return true; }
      });
    }

    function openSegmentModal(id) {
      if (!labelController) return;
      labelController.openEditSheet('segment', id);
    }

    function openAngleModal(id) {
      if (!labelController) return;
      labelController.openEditSheet('angle', id);
    }

    function openSaveSheet() {
      saveSheet.classList.add('open');
      saveSheet.setAttribute('aria-hidden', 'false');
      sheetBackdrop.classList.add('open');
    }

    function readGeometry() {
      const radius = parsePositive(radiusInput.value, '半径');
      const slant = parsePositive(slantInput.value, '母線');
      if (radius > slant) throw new Error('円錐の展開図では、半径は母線以下にしてください。');
      const angle = 360 * radius / slant;
      return {
        radius: radius,
        slant: slant,
        angle: angle,
        angleRad: angle * Math.PI / 180,
        arcLength: 2 * Math.PI * radius
      };
    }

    function render() {
      stage.innerHTML = '';
      try {
        const g = readGeometry();
        const scale = Math.min(300 / g.slant, 130 / g.radius);
        const sideR = g.slant * scale;
        const baseR = g.radius * scale;
        const cx = 500;
        const cy = 360;
        const start = Math.PI / 2 + g.angleRad / 2;
        const sweep = -g.angleRad;
        const sideStart = polar(cx, cy, sideR, start);
        const sideEnd = polar(cx, cy, sideR, start + sweep);
        const baseCx = 500;
        const baseCy = 800;
        const angleArcRadius = Math.max(42, sideR * 0.2) * getAngleArcScale('angle', 'sector');
        const angleArc = arcPoints(cx, cy, angleArcRadius, start, sweep);

        stage.appendChild(svg('path', { d: sectorPath(cx, cy, sideR, start, sweep), class: 'cone-net-side' }));
        stage.appendChild(svg('line', { x1: cx, y1: cy, x2: sideStart.x, y2: sideStart.y, class: 'cone-net-radius' }));
        stage.appendChild(svg('line', { x1: cx, y1: cy, x2: sideEnd.x, y2: sideEnd.y, class: 'cone-net-radius' }));
        const angleKind = angleKinds.sector || 'plain';
        if (angleKind !== 'hidden' && angleKind !== 'right') {
          stage.appendChild(svg('path', { d: linePath(angleArc), class: 'cone-net-guide', style: 'stroke:' + getLabelColor('angle', 'sector') }));
        }
        if (window.InstantGeometryMobileAngleOrnaments && typeof window.InstantGeometryMobileAngleOrnaments.drawAngleKind === 'function') {
          window.InstantGeometryMobileAngleOrnaments.drawAngleKind(
            stage,
            angleKind,
            angleArc,
            { x: cx, y: cy },
            angleArc[Math.floor(angleArc.length / 2)] || { x: cx, y: cy - angleArcRadius },
            svg,
            { p1: sideStart, p2: sideEnd },
            { color: getLabelColor('angle', 'sector') }
          );
        }
        stage.appendChild(svg('circle', { cx: baseCx, cy: baseCy, r: baseR, class: 'cone-net-base' }));
        stage.appendChild(svg('line', { x1: baseCx, y1: baseCy, x2: baseCx + baseR, y2: baseCy, class: 'cone-net-radius' }));
        addHitLine(cx, cy, sideStart.x, sideStart.y, 'slant');
        addHitLine(cx, cy, sideEnd.x, sideEnd.y, 'slant');
        addHitLine(baseCx, baseCy, baseCx + baseR, baseCy, 'radius');
        addAngleHitPath(angleArc, 'sector');
        stage.appendChild(svg('circle', { cx: cx, cy: cy, r: 8, class: 'center-point' }));
        stage.appendChild(svg('circle', { cx: baseCx, cy: baseCy, r: 8, class: 'center-point' }));

        addText(stage, 'O', cx - 38, cy - 28, '');
        const slantLabelPoint = segmentLabelPoint({ x: cx, y: cy }, sideEnd, { x: cx, y: cy - sideR }, 42);
        const radiusLabelPoint = { x: baseCx + baseR / 2, y: baseCy + 34 };
        drawSegmentGuide('slant', { x: cx, y: cy }, sideEnd, { x: cx, y: cy + sideR }, slantLabelPoint, 64);
        drawSegmentGuide('radius', { x: baseCx, y: baseCy }, { x: baseCx + baseR, y: baseCy }, { x: baseCx, y: baseCy - baseR }, radiusLabelPoint, 64);
        addSegmentLabel('slant', getSegmentLabel('slant', g.slant), slantLabelPoint.x, slantLabelPoint.y);
        addAngleLabel('sector', getAngleLabel('sector', g.angle), cx, cy - Math.max(58, angleArcRadius + 32));
        addSegmentLabel('radius', getSegmentLabel('radius', g.radius), radiusLabelPoint.x, radiusLabelPoint.y);
        addText(stage, '底面', baseCx, baseCy - baseR - 34, '');
        setStatus('入力をもとに円錐の展開図を描画しています。', false);
      } catch (error) {
        setStatus(error.message || '入力を確認してください。', true);
      }
    }

    function saveCanvas(transparent) {
      closeSaveSheet();
      if (!window.html2canvas) return;
      html2canvas(captureRoot, {
        backgroundColor: transparent ? null : '#fbfcff',
        scale: Math.max(2, window.devicePixelRatio || 1)
      }).then(function (canvas) {
        canvas.toBlob(function (blob) {
          if (blob) downloadBlob(blob, (config.fileBase || 'cone-net') + (transparent ? '-transparent' : '') + '.png');
        });
      });
    }

    function savePdf() {
      closeSaveSheet();
      if (!window.html2canvas || !window.jspdf) return;
      html2canvas(captureRoot, { backgroundColor: '#fbfcff', scale: Math.max(2, window.devicePixelRatio || 1) }).then(function (canvas) {
        const pdf = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
        const w = canvas.width * ratio;
        const h = canvas.height * ratio;
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pageW - w) / 2, (pageH - h) / 2, w, h);
        pdf.save((config.fileBase || 'cone-net') + '.pdf');
      });
    }

    radiusInput.addEventListener('input', render);
    slantInput.addEventListener('input', render);
    document.addEventListener('instant-geometry-draw-settings:ready', render);
    document.addEventListener('instant-geometry-settings:changed', render);
    if (backBtn) backBtn.addEventListener('click', function () { window.location.href = '/draw/'; });
    if (saveBtn) saveBtn.addEventListener('click', openSaveSheet);
    if (saveSheetClose) saveSheetClose.addEventListener('click', closeSaveSheet);
    if (sheetBackdrop) sheetBackdrop.addEventListener('click', closeSaveSheet);
    if (savePngBtn) savePngBtn.addEventListener('click', function () { saveCanvas(false); });
    if (saveTransparentBtn) saveTransparentBtn.addEventListener('click', function () { saveCanvas(true); });
    if (savePdfBtn) savePdfBtn.addEventListener('click', savePdf);
    if (sheetClose) sheetClose.addEventListener('click', closeSaveSheet);
    initLabelController();
    render();
  }

  window.InstantGeometryNetMobile = {
    createConePage: createConePage
  };
}());
