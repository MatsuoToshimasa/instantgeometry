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

  function fmt(value) {
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
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

  function createText(text, x, y, className, anchor) {
    const node = svg('text', {
      x: x,
      y: y,
      class: className || 'shape-label',
      'text-anchor': anchor || 'middle',
      'dominant-baseline': 'middle'
    });
    node.textContent = text;
    return node;
  }

  function createPage(config) {
    const RATIO_LABEL_PREFIX = 'ratio:';
    const RATIO_LABEL_HINT = '比の値は「マーク,数値」の形式で入力します。例: s,5 / t,4.4 / r,5/3\ns: 四角で囲む\nt: 三角で囲む\nr: 丸で囲む';
    const stage = document.getElementById('stage');
    const captureRoot = document.getElementById('captureRoot');
    const statusBox = document.getElementById('statusBox');
    const slantInput = document.getElementById(config.slantInputId);
    const radiusInput = document.getElementById(config.radiusInputId);
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
    const segmentKinds = { OA: 'plain', "O'A": 'plain', "OO'": 'plain' };
    const segmentArcVisible = { OA: true, "O'A": true, "OO'": false };
    const segmentInputs = { OA: ' ', "O'A": ' ', "OO'": '' };
    const labelOffsets = { segment: { OA: { x: 0, y: 0 }, "O'A": { x: 0, y: 0 }, "OO'": { x: 0, y: 0 } }, point: { O: { x: 0, y: 0 }, Op: { x: 0, y: 0 }, A: { x: 0, y: 0 } } };
    const pointInputs = { O: 'O', Op: "O'", A: '' };
    const labelScales = {};
    const labelColors = {};
    const LabelEngine = window.InstantGeometryDrawLabelEngine || window.InstantGeometryTriangleLabelEngine || null;
    let labelController = null;
    let moveTarget = null;
    let labelDrag = null;
    const moveToolbar = document.createElement('div');
    moveToolbar.className = 'move-toolbar';
    moveToolbar.setAttribute('aria-hidden', 'true');
    const moveCancelBtn = document.createElement('button');
    moveCancelBtn.className = 'btn';
    moveCancelBtn.type = 'button';
    moveCancelBtn.textContent = 'キャンセル';
    const moveDoneBtn = document.createElement('button');
    moveDoneBtn.className = 'btn action-primary';
    moveDoneBtn.type = 'button';
    moveDoneBtn.textContent = '完了';
    moveToolbar.appendChild(moveCancelBtn);
    moveToolbar.appendChild(moveDoneBtn);
    document.body.appendChild(moveToolbar);

    function closeSheets() {
      if (editSheet) {
        editSheet.classList.remove('open');
        editSheet.setAttribute('aria-hidden', 'true');
      }
      if (sheetBody) sheetBody.textContent = '';
      if (saveSheet) saveSheet.classList.remove('open');
      if (sheetBackdrop) sheetBackdrop.classList.remove('open');
    }

    function setStatus(message, isError) {
      if (!statusBox) return;
      statusBox.textContent = message || '';
      statusBox.classList.toggle('error', Boolean(isError));
    }

    function updateMoveModeUi() {
      const active = Boolean(moveTarget);
      document.body.classList.toggle('label-move-active', active);
      captureRoot.classList.toggle('label-move-active', active);
      moveToolbar.classList.toggle('open', active);
      moveToolbar.setAttribute('aria-hidden', active ? 'false' : 'true');
    }

    function startMove(kind, id) {
      const offset = labelOffsets[kind][id];
      moveTarget = {
        kind: kind,
        id: id,
        originalOffset: { x: offset.x, y: offset.y }
      };
      closeSheets();
      updateMoveModeUi();
      render();
    }

    function finishMoveMode(restoreOffset) {
      if (!moveTarget) return;
      const previous = moveTarget;
      if (restoreOffset) {
        labelOffsets[previous.kind][previous.id] = previous.originalOffset;
      }
      moveTarget = null;
      labelDrag = null;
      updateMoveModeUi();
      render();
      if (previous.kind === 'segment') openSegmentModal(previous.id);
      if (previous.kind === 'point') openPointModal(previous.id);
    }

    function labelStyleKey(kind, id) {
      return String(kind || '') + ':' + String(id || '');
    }

    function defaultLabelColor(kind) {
      return kind === 'point' ? '#1f2430' : '#2a5bd7';
    }

    function getLabelScale(kind, id) {
      const value = labelScales[labelStyleKey(kind, id)];
      return Number.isFinite(value) && value > 0 ? value : 1;
    }

    function setLabelScale(kind, id, value) {
      labelScales[labelStyleKey(kind, id)] = Math.max(0.1, Math.min(4, Number(value) || 1));
    }

    function getLabelColor(kind, id) {
      return labelColors[labelStyleKey(kind, id)] || defaultLabelColor(kind);
    }

    function setLabelColor(kind, id, value) {
      labelColors[labelStyleKey(kind, id)] = value || defaultLabelColor(kind);
    }

    function openSaveSheet() {
      if (saveSheet) {
        saveSheet.classList.add('open');
        saveSheet.setAttribute('aria-hidden', 'false');
      }
      if (sheetBackdrop) sheetBackdrop.classList.add('open');
    }

    function addLine(x1, y1, x2, y2, className) {
      stage.appendChild(svg('line', { x1: x1, y1: y1, x2: x2, y2: y2, class: className }));
    }

    function pathFromPoints(points) {
      if (!points.length) return '';
      return points.map(function (point, index) {
        return (index === 0 ? 'M ' : 'L ') + point.x + ' ' + point.y;
      }).join(' ');
    }

    function quadraticPoint(p1, control, p2, t) {
      return {
        x: (1 - t) * (1 - t) * p1.x + 2 * (1 - t) * t * control.x + t * t * p2.x,
        y: (1 - t) * (1 - t) * p1.y + 2 * (1 - t) * t * control.y + t * t * p2.y
      };
    }

    function quadraticPathSegment(p1, control, p2, start, end, steps) {
      const points = [];
      const count = steps || 20;
      for (let index = 0; index <= count; index += 1) {
        const t = start + (end - start) * (index / count);
        points.push(quadraticPoint(p1, control, p2, t));
      }
      return pathFromPoints(points);
    }

    function addSegmentArc(p1, p2, bend, id, labelBase) {
      if (segmentArcVisible[id] === false || segmentInputs[id] === '') return;
      const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const length = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / length;
      const ny = dx / length;
      const offset = labelOffsets.segment[id] || { x: 0, y: 0 };
      const desired = labelBase
        ? { x: labelBase.x + offset.x, y: labelBase.y + offset.y }
        : { x: mid.x + nx * bend, y: mid.y + ny * bend };
      const control = {
        x: desired.x * 2 - mid.x,
        y: desired.y * 2 - mid.y
      };
      const gapHalf = 0.14;
      stage.appendChild(svg('path', {
        d: quadraticPathSegment(p1, control, p2, 0, 0.5 - gapHalf, 20),
        class: 'label-arc'
      }));
      stage.appendChild(svg('path', {
        d: quadraticPathSegment(p1, control, p2, 0.5 + gapHalf, 1, 20),
        class: 'label-arc'
      }));
    }

    function addSegmentHit(x1, y1, x2, y2, id) {
      const hit = svg('line', {
        x1: x1,
        y1: y1,
        x2: x2,
        y2: y2,
        class: 'rolling-hit',
        tabindex: '0',
        role: 'button',
        'aria-label': '線分' + id + 'を編集'
      });
      hit.addEventListener('click', function () { openSegmentModal(id); });
      hit.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openSegmentModal(id);
        }
      });
      stage.appendChild(hit);
    }

    function getSegmentLabel(id, value) {
      const raw = segmentInputs[id];
      if (raw === '') return '';
      if (raw === ' ' || raw === 'decimal:' || raw === 'raw:') return typeof value === 'string' ? value : fmt(value);
      if (String(raw || '').indexOf(RATIO_LABEL_PREFIX) === 0) return String(raw).slice(RATIO_LABEL_PREFIX.length);
      return String(raw || '');
    }

    function parseRatioLabelInput(value) {
      const text = String(value || '').trim();
      const parts = text.split(',');
      if (parts.length !== 2) return null;
      const mark = parts[0].trim().toLowerCase();
      const number = parts[1].trim();
      const decimalPattern = /^(?:[1-9][0-9]*(?:\.[0-9]+)?|0\.[0-9]*[1-9][0-9]*)$/;
      const fractionPattern = /^[1-9][0-9]*\/[1-9][0-9]*$/;
      if (!/^[rts]$/.test(mark)) return null;
      if (!decimalPattern.test(number) && !fractionPattern.test(number)) return null;
      return { mark: mark, value: number, source: mark + ',' + number };
    }

    function isRatioLabelValue(value) {
      return String(value || '').indexOf(RATIO_LABEL_PREFIX) === 0 && Boolean(parseRatioLabelInput(String(value).slice(RATIO_LABEL_PREFIX.length)));
    }

    function getRatioLabelInput(value) {
      return isRatioLabelValue(value) ? String(value).slice(RATIO_LABEL_PREFIX.length) : '';
    }

    function getDisplayMode(value) {
      if (value === '') return 'hidden';
      if (isRatioLabelValue(value)) return 'ratio';
      if (value === ' ' || value === 'decimal:' || value === 'raw:') return 'numeric';
      return 'text';
    }

    function segmentName(id) {
      if (id === "O'A") return "O'A";
      if (id === "OO'") return "OO'";
      return id;
    }

    function pointName(id) {
      return id === 'Op' ? "O'" : id;
    }

    function buildSegmentKindSelect(kind, id, buildSelectFn) {
      return buildSelectFn('線分マーク', segmentKinds[id] || 'plain', [
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
        enabledLabels: { point: true, segment: true },
        editSheet: editSheet,
        sheetTitle: sheetTitle,
        sheetBody: sheetBody,
        sheetBackdrop: sheetBackdrop,
        closeSheets: closeSheets,
        render: render,
        onError: function (error) { setStatus(error.message || '入力を確認してください。', true); },
        getModalSpec: function (kind, id, modalType) {
          return LabelEngine.getStandardModalSpec(modalType, { guideLabel: 'ガイドを表示' });
        },
        getTitle: function (kind, id) {
          return kind === 'point' ? '点' + pointName(id) : '線分' + segmentName(id);
        },
        buildSegmentKindSelect: buildSegmentKindSelect,
        setKind: function (kind, id, value) {
          if (kind === 'segment') segmentKinds[id] = value;
        },
        hasGuideField: function (kind) {
          return kind === 'segment';
        },
        getGuideVisible: function (kind, id) {
          return segmentArcVisible[id] !== false;
        },
        setGuideVisible: function (kind, id, checked) {
          segmentArcVisible[id] = !!checked;
        },
        getLabelValue: function (kind, id) {
          return kind === 'point' ? pointInputs[id] : segmentInputs[id];
        },
        setLabelValue: function (kind, id, value) {
          if (kind === 'point') pointInputs[id] = value || '';
          else {
            segmentInputs[id] = value || '';
            if (!value) segmentArcVisible[id] = false;
          }
        },
        getLabelScale: getLabelScale,
        setLabelScale: setLabelScale,
        getColor: getLabelColor,
        setColor: setLabelColor,
        hasColorField: function () { return true; },
        onMove: startMove
      });
    }

    function formatRootDifference(a, b) {
      const square = a * a - b * b;
      if (square <= 0) return '';
      const roundedSquare = Math.round(square);
      if (Number.isInteger(a) && Number.isInteger(b) && Math.abs(square - roundedSquare) < 1e-9) {
        let outside = 1;
        let inside = roundedSquare;
        for (let factor = 2; factor * factor <= inside; factor += 1) {
          const factorSquare = factor * factor;
          while (inside % factorSquare === 0) {
            outside *= factor;
            inside /= factorSquare;
          }
        }
        if (inside === 1) return String(outside);
        return (outside === 1 ? '' : String(outside)) + '√' + inside;
      }
      const rounded = Math.round(square * 100) / 100;
      return '√' + fmt(rounded);
    }

    function addMeasureLabel(id, value, x, y, anchor) {
      const text = getSegmentLabel(id, value);
      if (!text) return;
      const offset = labelOffsets.segment[id] || { x: 0, y: 0 };
      const fontSize = 42 * getLabelScale('segment', id);
      const color = getLabelColor('segment', id);
      const label = window.InstantGeometrySharedLabels && typeof window.InstantGeometrySharedLabels.createSvgKatexLabel === 'function'
        ? window.InstantGeometrySharedLabels.createSvgKatexLabel({
          createSvg: svg,
          text: text,
          kind: 'segment',
          id: id,
          attrs: {
            x: x + offset.x,
            y: y + offset.y,
            class: 'rolling-label rolling-label-hit',
            'font-size': fontSize,
            fill: color,
            'text-anchor': anchor || 'middle',
            'dominant-baseline': 'middle'
          }
        })
        : null;
      if (!label) {
        const fallback = createText(text, x + offset.x, y + offset.y, 'rolling-label rolling-label-hit', anchor || 'middle');
        fallback.setAttribute('font-size', String(fontSize));
        fallback.setAttribute('fill', color);
        stage.appendChild(fallback);
        wireMeasureLabel(fallback, id, offset);
        return;
      }
      label.classList.add('rolling-label-hit');
      label.style.cursor = 'pointer';
      label.setAttribute('tabindex', '0');
      label.setAttribute('role', 'button');
      label.setAttribute('aria-label', '線分' + id + 'を編集');
      wireMeasureLabel(label, id, offset);
      stage.appendChild(label);
    }

    function wireMeasureLabel(label, id, offset) {
      if (isMoveTarget('segment', id)) label.classList.add('is-moving', 'label-move-target');
      label.setAttribute('tabindex', '0');
      label.setAttribute('role', 'button');
      label.setAttribute('aria-label', '線分' + id + 'を編集');
      label.addEventListener('pointerdown', function (event) {
        if (!isMoveTarget('segment', id)) return;
        event.preventDefault();
        label.setPointerCapture(event.pointerId);
        const point = pointerToSvgPoint(event);
        labelDrag = {
          kind: 'segment',
          id: id,
          startPoint: point,
          startOffset: { x: offset.x, y: offset.y }
        };
      });
      label.addEventListener('click', function () {
        if (isMoveTarget('segment', id)) return;
        openSegmentModal(id);
      });
      label.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openSegmentModal(id);
        }
      });
    }

    function isMoveTarget(kind, id) {
      return moveTarget && moveTarget.kind === kind && moveTarget.id === id;
    }

    function addPointLabel(id, text, x, y) {
      if (!text) return;
      const offset = labelOffsets.point[id] || { x: 0, y: 0 };
      const fontSize = 42 * getLabelScale('point', id);
      const color = getLabelColor('point', id);
      const label = window.InstantGeometrySharedLabels && typeof window.InstantGeometrySharedLabels.createSvgKatexLabel === 'function'
        ? window.InstantGeometrySharedLabels.createSvgKatexLabel({
          createSvg: svg,
          text: text,
          kind: 'point',
          id: id,
          attrs: {
            x: x + offset.x,
            y: y + offset.y,
            class: 'shape-label rolling-label-hit',
            'font-size': fontSize,
            fill: color,
            'text-anchor': 'middle',
            'dominant-baseline': 'middle'
          }
        })
        : null;
      const node = label || createText(text, x + offset.x, y + offset.y, 'shape-label rolling-label-hit', 'middle');
      if (!label) {
        node.setAttribute('font-size', String(fontSize));
        node.setAttribute('fill', color);
      }
      node.classList.add('rolling-label-hit');
      node.style.cursor = 'pointer';
      if (isMoveTarget('point', id)) node.classList.add('is-moving', 'label-move-target');
      node.setAttribute('tabindex', '0');
      node.setAttribute('role', 'button');
      node.setAttribute('aria-label', '点' + text + 'を編集');
      node.addEventListener('pointerdown', function (event) {
        if (!isMoveTarget('point', id)) return;
        event.preventDefault();
        node.setPointerCapture(event.pointerId);
        const point = pointerToSvgPoint(event);
        labelDrag = {
          kind: 'point',
          id: id,
          startPoint: point,
          startOffset: { x: offset.x, y: offset.y }
        };
      });
      node.addEventListener('click', function () {
        if (isMoveTarget('point', id)) return;
        openPointModal(id);
      });
      node.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openPointModal(id);
        }
      });
      stage.appendChild(node);
    }

    function addPointHit(id, labelText, point, labelX, labelY, visiblePoint) {
      if (visiblePoint) {
        stage.appendChild(svg('circle', { cx: point.x, cy: point.y, r: 5.5, class: 'rolling-apex' }));
      }
      const hit = svg('circle', {
        cx: point.x,
        cy: point.y,
        r: 22,
        class: 'rolling-point-hit',
        tabindex: '0',
        role: 'button',
        'aria-label': '点' + labelText + 'を編集'
      });
      hit.addEventListener('click', function (event) {
        event.stopPropagation();
        openPointModal(id);
      });
      hit.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openPointModal(id);
        }
      });
      stage.appendChild(hit);
      addPointLabel(id, pointInputs[id], labelX, labelY);
    }

    function pointerToSvgPoint(event) {
      const point = stage.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      return point.matrixTransform(stage.getScreenCTM().inverse());
    }

    function buildSelect(labelText, value, options) {
      const field = document.createElement('div');
      field.className = 'sheet-field';
      const label = document.createElement('label');
      label.textContent = labelText;
      const select = document.createElement('select');
      options.forEach(function (option) {
        const node = document.createElement('option');
        node.value = option.value;
        node.textContent = option.label;
        select.appendChild(node);
      });
      select.value = value;
      field.appendChild(label);
      field.appendChild(select);
      return { field: field, select: select };
    }

    function buildCheckbox(labelText, checked) {
      const field = document.createElement('label');
      field.className = 'sheet-field checkbox-field';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = checked;
      const span = document.createElement('span');
      span.textContent = labelText;
      field.appendChild(input);
      field.appendChild(span);
      return { field: field, input: input };
    }

    function buildLabelEditor(labelText, value) {
      const field = document.createElement('div');
      field.className = 'sheet-field';
      const label = document.createElement('label');
      label.textContent = labelText;
      const mode = document.createElement('select');
      [
        { value: 'hidden', label: '非表示' },
        { value: 'numeric', label: '数値' },
        { value: 'ratio', label: '比の値' },
        { value: 'text', label: '自由入力' }
      ].forEach(function (option) {
        const node = document.createElement('option');
        node.value = option.value;
        node.textContent = option.label;
        mode.appendChild(node);
      });
      const input = document.createElement('input');
      input.type = 'text';
      input.value = getDisplayMode(value) === 'text' ? String(value || '') : getRatioLabelInput(value);
      input.setAttribute('inputmode', 'text');
      input.autocapitalize = 'none';
      input.autocomplete = 'off';
      input.spellcheck = false;
      mode.value = getDisplayMode(value);
      function sync() {
        input.disabled = mode.value !== 'text' && mode.value !== 'ratio';
        input.placeholder = mode.value === 'ratio' ? '例: s,5 / t,4.4 / r,5/3' : '';
      }
      mode.addEventListener('change', sync);
      field.appendChild(label);
      field.appendChild(mode);
      field.appendChild(input);
      sync();
      return { field: field, mode: mode, input: input };
    }

    function buildPointLabelEditor(labelText, value) {
      const field = document.createElement('div');
      field.className = 'sheet-field';
      const label = document.createElement('label');
      label.textContent = labelText;
      const mode = document.createElement('select');
      [
        { value: 'hidden', label: '非表示' },
        { value: 'text', label: '自由入力' }
      ].forEach(function (option) {
        const node = document.createElement('option');
        node.value = option.value;
        node.textContent = option.label;
        mode.appendChild(node);
      });
      const input = document.createElement('input');
      input.type = 'text';
      input.value = String(value || '');
      input.setAttribute('inputmode', 'text');
      input.autocapitalize = 'none';
      input.autocomplete = 'off';
      input.spellcheck = false;
      mode.value = value ? 'text' : 'hidden';
      function sync() {
        input.disabled = mode.value !== 'text';
      }
      mode.addEventListener('change', sync);
      field.appendChild(label);
      field.appendChild(mode);
      field.appendChild(input);
      sync();
      return { field: field, mode: mode, input: input };
    }

    function openPointModal(id) {
      if (labelController) {
        labelController.openEditSheet('point', id);
        return;
      }
      closeSheets();
      if (!editSheet || !sheetTitle || !sheetBody) return;
      const pointName = id === 'Op' ? "O'" : id;
      sheetTitle.textContent = '点' + pointName;
      const editor = buildPointLabelEditor('ラベル', pointInputs[id]);
      if (!pointInputs[id]) editor.input.value = pointName;
      sheetBody.appendChild(editor.field);
      const hint = document.createElement('p');
      hint.className = 'sheet-hint';
      hint.textContent = '点ラベルです。非表示または自由入力を選べます。';
      sheetBody.appendChild(hint);
      const actions = document.createElement('div');
      actions.className = 'sheet-actions';
      actions.classList.add('has-move');
      const cancel = document.createElement('button');
      cancel.className = 'btn';
      cancel.type = 'button';
      cancel.textContent = 'キャンセル';
      cancel.addEventListener('click', closeSheets);
      function applyCurrentValue() {
        pointInputs[id] = editor.mode.value === 'text' ? (String(editor.input.value || '').trim() || pointName) : '';
      }
      const move = document.createElement('button');
      move.className = 'btn action-secondary';
      move.type = 'button';
      move.textContent = '移動';
      move.addEventListener('click', function () {
        try {
          applyCurrentValue();
          startMove('point', id);
        } catch (error) {
          setStatus(error.message || '入力を確認してください。', true);
        }
      });
      const save = document.createElement('button');
      save.className = 'btn action-primary';
      save.type = 'button';
      save.textContent = '保存';
      save.addEventListener('click', function () {
        try {
          applyCurrentValue();
          closeSheets();
          render();
        } catch (error) {
          setStatus(error.message || '入力を確認してください。', true);
        }
      });
      actions.appendChild(cancel);
      actions.appendChild(move);
      actions.appendChild(save);
      sheetBody.appendChild(actions);
      editSheet.classList.add('open');
      editSheet.setAttribute('aria-hidden', 'false');
      if (sheetBackdrop) sheetBackdrop.classList.add('open');
    }

    function openSegmentModal(id) {
      if (labelController) {
        labelController.openEditSheet('segment', id);
        return;
      }
      closeSheets();
      if (!editSheet || !sheetTitle || !sheetBody) return;
      sheetTitle.textContent = '線分' + segmentName(id);

      const kindSelect = buildSelect('種類', segmentKinds[id] || 'plain', [
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
      sheetBody.appendChild(kindSelect.field);
      const checkbox = buildCheckbox('弧を表示', segmentArcVisible[id] !== false);
      sheetBody.appendChild(checkbox.field);
      const editor = buildLabelEditor('ラベル', segmentInputs[id]);
      sheetBody.appendChild(editor.field);
      const hint = document.createElement('p');
      hint.className = 'sheet-hint';
      hint.textContent = '線分ラベルです。非表示、数値、比の値、自由入力を選べます。\n' + RATIO_LABEL_HINT;
      sheetBody.appendChild(hint);

      const actions = document.createElement('div');
      actions.className = 'sheet-actions';
      actions.classList.add('has-move');
      const cancel = document.createElement('button');
      cancel.className = 'btn';
      cancel.type = 'button';
      cancel.textContent = 'キャンセル';
      cancel.addEventListener('click', closeSheets);
      function applyCurrentValue() {
        segmentKinds[id] = kindSelect.select.value;
        segmentArcVisible[id] = !!checkbox.input.checked;
        if (editor.mode.value === 'hidden') {
          segmentInputs[id] = '';
        } else if (editor.mode.value === 'numeric') {
          segmentInputs[id] = ' ';
        } else if (editor.mode.value === 'ratio') {
          const ratio = parseRatioLabelInput(editor.input.value);
          if (!ratio) throw new Error('比の値は「r,5」「t,4.4」「s,5/3」の形式で入力してください。');
          segmentInputs[id] = RATIO_LABEL_PREFIX + ratio.source;
        } else {
          segmentInputs[id] = String(editor.input.value || '');
        }
        if (editor.mode.value === 'hidden') segmentArcVisible[id] = false;
      }
      const move = document.createElement('button');
      move.className = 'btn action-secondary';
      move.type = 'button';
      move.textContent = '移動';
      move.addEventListener('click', function () {
        try {
          applyCurrentValue();
          startMove('segment', id);
        } catch (error) {
          setStatus(error.message || '入力を確認してください。', true);
        }
      });
      const save = document.createElement('button');
      save.className = 'btn action-primary';
      save.type = 'button';
      save.textContent = '保存';
      save.addEventListener('click', function () {
        try {
          applyCurrentValue();
          closeSheets();
          render();
        } catch (error) {
          setStatus(error.message || '入力を確認してください。', true);
        }
      });
      actions.appendChild(cancel);
      actions.appendChild(move);
      actions.appendChild(save);
      sheetBody.appendChild(actions);
      editSheet.classList.add('open');
      editSheet.setAttribute('aria-hidden', 'false');
      if (sheetBackdrop) sheetBackdrop.classList.add('open');
    }

    function render() {
      stage.textContent = '';
      statusBox.classList.remove('error');
      statusBox.textContent = '';

      try {
        const slant = parsePositive(slantInput.value, '母線');
        const radius = parsePositive(radiusInput.value, '底面半径');
        if (radius >= slant) throw new Error('底面半径は母線より小さい数を入力してください。');

        const scale = 43;
        const pathRx = Math.min(390, Math.max(260, slant * scale));
        const pathRy = pathRx * 0.43;
        const groundO = { x: 625, y: 540 };
        const slantPx = pathRx;
        const radiusPx = radius * (slantPx / slant);
        const axisPx = Math.sqrt(slantPx * slantPx - radiusPx * radiusPx);
        const a = { x: groundO.x - slantPx, y: groundO.y };
        const op = {
          x: groundO.x - (slantPx - (radiusPx * radiusPx / slantPx)),
          y: groundO.y - (radiusPx * axisPx / slantPx)
        };
        const b = { x: op.x * 2 - a.x, y: op.y * 2 - a.y };
        const diameterAngle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
        const labelMidOA = { x: (groundO.x + a.x) / 2, y: groundO.y + 40 };
        const labelMidOpA = { x: (op.x + a.x) / 2 - 22, y: (op.y + a.y) / 2 - 26 };
        const labelMidOOp = { x: (groundO.x + op.x) / 2 + 18, y: (groundO.y + op.y) / 2 - 20 };
        const ooPrimeLabel = formatRootDifference(slant, radius);

        stage.appendChild(svg('ellipse', {
          cx: groundO.x,
          cy: groundO.y,
          rx: pathRx,
          ry: pathRy,
          class: 'solid-hidden'
        }));

        addLine(groundO.x, groundO.y, a.x, a.y, 'solid-outline');
        addLine(groundO.x, groundO.y, b.x, b.y, 'solid-outline');
        addLine(groundO.x, groundO.y, op.x, op.y, 'solid-hidden');
        addLine(op.x, op.y, a.x, a.y, 'solid-radius');
        addSegmentArc(groundO, a, -46, 'OA', labelMidOA);
        addSegmentArc(op, a, -28, "O'A", labelMidOpA);
        addSegmentArc(groundO, op, -22, "OO'", labelMidOOp);
        stage.appendChild(svg('ellipse', {
          cx: op.x,
          cy: op.y,
          rx: radiusPx,
          ry: radiusPx * 0.34,
          transform: 'rotate(' + diameterAngle + ' ' + op.x + ' ' + op.y + ')',
          class: 'solid-outline'
        }));
        addSegmentHit(groundO.x, groundO.y, a.x, a.y, 'OA');
        addSegmentHit(op.x, op.y, a.x, a.y, "O'A");
        addSegmentHit(groundO.x, groundO.y, op.x, op.y, "OO'");
        addMeasureLabel('OA', slant, labelMidOA.x, labelMidOA.y, 'middle');
        addMeasureLabel("O'A", radius, labelMidOpA.x, labelMidOpA.y, 'middle');
        addMeasureLabel("OO'", ooPrimeLabel, labelMidOOp.x, labelMidOOp.y, 'middle');
        addPointHit('A', 'A', a, a.x - 30, a.y + 26, true);
        addPointHit('O', 'O', groundO, groundO.x + 32, groundO.y - 26, true);
        addPointHit('Op', "O'", op, op.x + 24, op.y - 30, true);
      } catch (error) {
        statusBox.textContent = error.message;
        statusBox.classList.add('error');
      }
    }

    function saveCanvas(transparent) {
      closeSheets();
      if (!window.html2canvas) return;
      html2canvas(captureRoot, {
        backgroundColor: transparent ? null : '#fbfcff',
        scale: Math.max(2, window.devicePixelRatio || 1)
      }).then(function (canvas) {
        canvas.toBlob(function (blob) {
          if (blob) downloadBlob(blob, (config.fileBase || 'solid-rolling-cone') + (transparent ? '-transparent' : '') + '.png');
        });
      });
    }

    function savePdf() {
      closeSheets();
      if (!window.html2canvas || !window.jspdf) return;
      html2canvas(captureRoot, { backgroundColor: '#fbfcff', scale: Math.max(2, window.devicePixelRatio || 1) }).then(function (canvas) {
        const pdf = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
        const w = canvas.width * ratio;
        const h = canvas.height * ratio;
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pageW - w) / 2, (pageH - h) / 2, w, h);
        pdf.save((config.fileBase || 'solid-rolling-cone') + '.pdf');
      });
    }

    slantInput.addEventListener('input', render);
    radiusInput.addEventListener('input', render);
    if (backBtn) backBtn.addEventListener('click', function () { window.location.href = '/draw/'; });
    if (saveBtn) saveBtn.addEventListener('click', openSaveSheet);
    moveCancelBtn.addEventListener('click', function () { finishMoveMode(true); });
    moveDoneBtn.addEventListener('click', function () { finishMoveMode(false); });
    if (sheetClose) sheetClose.addEventListener('click', closeSheets);
    if (saveSheetClose) saveSheetClose.addEventListener('click', closeSheets);
    if (sheetBackdrop) sheetBackdrop.addEventListener('click', closeSheets);
    window.addEventListener('pointermove', function (event) {
      if (!labelDrag) return;
      event.preventDefault();
      const point = pointerToSvgPoint(event);
      const offset = labelOffsets[labelDrag.kind][labelDrag.id];
      offset.x = labelDrag.startOffset.x + (point.x - labelDrag.startPoint.x);
      offset.y = labelDrag.startOffset.y + (point.y - labelDrag.startPoint.y);
      render();
    }, { passive: false });
    window.addEventListener('pointerup', function () {
      if (!labelDrag) return;
      labelDrag = null;
      render();
    });
    window.addEventListener('pointercancel', function () {
      labelDrag = null;
      render();
    });
    if (savePngBtn) savePngBtn.addEventListener('click', function () { saveCanvas(false); });
    if (saveTransparentBtn) saveTransparentBtn.addEventListener('click', function () { saveCanvas(true); });
    if (savePdfBtn) savePdfBtn.addEventListener('click', savePdf);
    initLabelController();
    render();
  }

  window.InstantGeometryRollingCone = {
    createPage: createPage
  };
}());
