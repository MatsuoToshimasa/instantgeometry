(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const stage = document.getElementById('stage');
  const inputs = {
    A: document.getElementById('coefA'),
    B: document.getElementById('coefB'),
    C: document.getElementById('coefC'),
    D: document.getElementById('coefD'),
    E: document.getElementById('coefE'),
    F: document.getElementById('coefF')
  };
  const statusBox = document.getElementById('statusBox');
  const sheetBackdrop = document.getElementById('sheetBackdrop');
  const editSheet = document.getElementById('editSheet');
  const saveSheet = document.getElementById('saveSheet');
  const sheetTitle = document.getElementById('sheetTitle');
  const sheetBody = document.getElementById('sheetBody');

  if (!stage || Object.keys(inputs).some(function (key) { return !inputs[key]; })) return;

  const plot = {
    left: 86,
    right: 914,
    top: 86,
    bottom: 914,
    xMin: -10,
    xMax: 10,
    yMin: -10,
    yMax: 10
  };

  const state = {
    tickLabelInterval: 2
  };

  function svg(tag, attrs) {
    const node = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (key) {
      node.setAttribute(key, attrs[key]);
    });
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function parseNumber(input, name) {
    const text = String(input.value || '').trim();
    if (!/^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$/.test(text)) {
      throw new Error('係数 ' + name + ' は数値で入力してください。');
    }
    return Number(text);
  }

  function readCoefficients() {
    const values = {
      A: parseNumber(inputs.A, 'A'),
      B: parseNumber(inputs.B, 'B'),
      C: parseNumber(inputs.C, 'C'),
      D: parseNumber(inputs.D, 'D'),
      E: parseNumber(inputs.E, 'E'),
      F: parseNumber(inputs.F, 'F')
    };
    if (Math.abs(values.A) < 1e-10 && Math.abs(values.B) < 1e-10 && Math.abs(values.C) < 1e-10 && Math.abs(values.D) < 1e-10 && Math.abs(values.E) < 1e-10) {
      throw new Error('A, B, C, D, E のうち少なくとも1つは0以外にしてください。');
    }
    return values;
  }

  function formatNumber(value) {
    if (!Number.isFinite(value)) return '';
    if (Math.abs(value) < 1e-10) return '0';
    const rounded = Math.round(value * 1000) / 1000;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, '').replace(/\.$/, '');
  }

  function formatFormula(coef) {
    const terms = [];
    function addTerm(value, body) {
      if (Math.abs(value) < 1e-10) return;
      const abs = Math.abs(value);
      const coeff = body && Math.abs(abs - 1) < 1e-10 ? '' : formatNumber(abs);
      const text = coeff + body;
      if (!terms.length) {
        terms.push(value < 0 ? '-' + text : text);
      } else {
        terms.push((value < 0 ? ' - ' : ' + ') + text);
      }
    }
    addTerm(coef.A, 'x²');
    addTerm(coef.B, 'xy');
    addTerm(coef.C, 'y²');
    addTerm(coef.D, 'x');
    addTerm(coef.E, 'y');
    addTerm(coef.F, '');
    return (terms.length ? terms.join('') : '0') + ' = 0';
  }

  function setStatus(message, isError) {
    statusBox.textContent = message;
    statusBox.classList.toggle('error', Boolean(isError));
  }

  function sx(x) {
    return plot.left + (x - plot.xMin) / (plot.xMax - plot.xMin) * (plot.right - plot.left);
  }

  function sy(y) {
    return plot.top + (plot.yMax - y) / (plot.yMax - plot.yMin) * (plot.bottom - plot.top);
  }

  function valueAt(coef, x, y) {
    return coef.A * x * x + coef.B * x * y + coef.C * y * y + coef.D * x + coef.E * y + coef.F;
  }

  function drawText(text, x, y, className) {
    const node = svg('text', { x: x, y: y, class: 'function-label ' + (className || '') });
    node.textContent = text;
    stage.appendChild(node);
    return node;
  }

  function drawGrid() {
    if (window.InstantGeometryFunctionViewSettings && window.InstantGeometryFunctionViewSettings.drawGrid) {
      window.InstantGeometryFunctionViewSettings.drawGrid({
        state: state,
        plot: plot,
        svg: svg,
        sx: sx,
        sy: sy,
        stage: stage,
        drawText: drawText
      });
      return;
    }
    const group = svg('g', {});
    const tickLabelInterval = Number(state.tickLabelInterval) || 0;
    for (let x = plot.xMin; x <= plot.xMax; x += 1) {
      const px = sx(x);
      group.appendChild(svg('line', {
        x1: px, y1: plot.top, x2: px, y2: plot.bottom,
        class: x === 0 || x % 5 === 0 ? 'function-grid-major' : 'function-grid-minor'
      }));
      if (tickLabelInterval > 0 && x !== 0 && x % tickLabelInterval === 0) {
        const label = svg('text', { x: px - 12, y: sy(0) + 28, class: 'function-tick-label' });
        label.textContent = String(x);
        group.appendChild(label);
      }
    }
    for (let y = plot.yMin; y <= plot.yMax; y += 1) {
      const py = sy(y);
      group.appendChild(svg('line', {
        x1: plot.left, y1: py, x2: plot.right, y2: py,
        class: y === 0 || y % 5 === 0 ? 'function-grid-major' : 'function-grid-minor'
      }));
      if (tickLabelInterval > 0 && y !== 0 && y % tickLabelInterval === 0) {
        const label = svg('text', { x: sx(0) + 15, y: py + 7, class: 'function-tick-label' });
        label.textContent = String(y);
        group.appendChild(label);
      }
    }
    group.appendChild(svg('line', { x1: plot.left, y1: sy(0), x2: plot.right, y2: sy(0), class: 'function-axis' }));
    group.appendChild(svg('line', { x1: sx(0), y1: plot.top, x2: sx(0), y2: plot.bottom, class: 'function-axis' }));
    stage.appendChild(group);
    drawText('x', plot.right + 14, sy(0) + 8, 'muted');
    drawText('y', sx(0) + 12, plot.top - 14, 'muted');
  }

  function interpolate(p1, v1, p2, v2) {
    const denom = v1 - v2;
    const t = Math.abs(denom) < 1e-12 ? 0.5 : v1 / denom;
    return {
      x: p1.x + (p2.x - p1.x) * t,
      y: p1.y + (p2.y - p1.y) * t
    };
  }

  function edgeCrossings(corners) {
    const edges = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0]
    ];
    const points = [];
    edges.forEach(function (edge) {
      const a = corners[edge[0]];
      const b = corners[edge[1]];
      if (Math.abs(a.v) < 1e-10 && Math.abs(b.v) < 1e-10) return;
      if (Math.abs(a.v) < 1e-10) {
        points.push({ x: a.x, y: a.y });
      } else if (Math.abs(b.v) < 1e-10) {
        points.push({ x: b.x, y: b.y });
      } else if ((a.v < 0 && b.v > 0) || (a.v > 0 && b.v < 0)) {
        points.push(interpolate(a, a.v, b, b.v));
      }
    });
    const unique = [];
    points.forEach(function (p) {
      if (!unique.some(function (q) { return Math.hypot(q.x - p.x, q.y - p.y) < 1e-7; })) {
        unique.push(p);
      }
    });
    return unique;
  }

  function drawConic(coef) {
    const group = svg('g', {});
    const steps = 180;
    let count = 0;
    for (let ix = 0; ix < steps; ix += 1) {
      const x0 = plot.xMin + (plot.xMax - plot.xMin) * (ix / steps);
      const x1 = plot.xMin + (plot.xMax - plot.xMin) * ((ix + 1) / steps);
      for (let iy = 0; iy < steps; iy += 1) {
        const y0 = plot.yMin + (plot.yMax - plot.yMin) * (iy / steps);
        const y1 = plot.yMin + (plot.yMax - plot.yMin) * ((iy + 1) / steps);
        const corners = [
          { x: sx(x0), y: sy(y0), v: valueAt(coef, x0, y0) },
          { x: sx(x1), y: sy(y0), v: valueAt(coef, x1, y0) },
          { x: sx(x1), y: sy(y1), v: valueAt(coef, x1, y1) },
          { x: sx(x0), y: sy(y1), v: valueAt(coef, x0, y1) }
        ];
        const crossings = edgeCrossings(corners);
        if (crossings.length >= 2) {
          for (let i = 0; i + 1 < crossings.length; i += 2) {
            group.appendChild(svg('line', {
              x1: crossings[i].x,
              y1: crossings[i].y,
              x2: crossings[i + 1].x,
              y2: crossings[i + 1].y,
              class: 'function-curve'
            }));
            count += 1;
          }
        }
      }
    }
    stage.appendChild(group);
    return count;
  }

  function render() {
    clear(stage);
    drawGrid();
    let coef;
    try {
      coef = readCoefficients();
    } catch (error) {
      setStatus(error.message, true);
      coef = { A: 1, B: 0, C: 1, D: 0, E: 0, F: -9 };
    }
    const count = drawConic(coef);
    drawText(formatFormula(coef), plot.left + 18, plot.top + 36, 'muted');
    if (count) {
      setStatus('係数 A, B, C, D, E, F を入力すると、一般形の二次曲線を描画します。', false);
    } else {
      setStatus('表示範囲内に曲線がありません。係数または表示範囲を調整してください。', true);
    }
  }

  function openSheet(title) {
    sheetTitle.textContent = title;
    sheetBody.innerHTML = '';
    editSheet.classList.add('open');
    editSheet.setAttribute('aria-hidden', 'false');
    sheetBackdrop.classList.add('open');
  }

  function closeSheets() {
    editSheet.classList.remove('open');
    editSheet.setAttribute('aria-hidden', 'true');
    saveSheet.classList.remove('open');
    saveSheet.setAttribute('aria-hidden', 'true');
    sheetBackdrop.classList.remove('open');
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
      if (option.value === value) node.selected = true;
      select.appendChild(node);
    });
    field.appendChild(label);
    field.appendChild(select);
    return { field: field, select: select };
  }

  function openSettingsSheet() {
    openSheet('設定');
    const tickSelect = buildSelect('座標の数字', String(state.tickLabelInterval || 0), [
      { value: '1', label: '1刻み' },
      { value: '2', label: '2刻み' },
      { value: '5', label: '5刻み' },
      { value: '0', label: '非表示' }
    ]);
    sheetBody.appendChild(tickSelect.field);
    const hintNode = document.createElement('p');
    hintNode.className = 'sheet-hint';
    hintNode.textContent = '座標軸に表示する数字の間隔を変更できます。グリッド線は1刻みのまま表示します。';
    sheetBody.appendChild(hintNode);
    const actions = document.createElement('div');
    actions.className = 'sheet-actions';
    const cancel = document.createElement('button');
    cancel.className = 'btn';
    cancel.type = 'button';
    cancel.textContent = 'キャンセル';
    cancel.addEventListener('click', closeSheets);
    const save = document.createElement('button');
    save.className = 'btn action-primary';
    save.type = 'button';
    save.textContent = '保存';
    save.addEventListener('click', function () {
      state.tickLabelInterval = Number(tickSelect.select.value) || 0;
      closeSheets();
      render();
    });
    actions.appendChild(cancel);
    actions.appendChild(save);
    sheetBody.appendChild(actions);
  }

  function openSaveSheet() {
    saveSheet.classList.add('open');
    saveSheet.setAttribute('aria-hidden', 'false');
    sheetBackdrop.classList.add('open');
  }

  function captureCanvas(backgroundColor) {
    if (!window.html2canvas) return Promise.reject(new Error('保存に失敗しました。'));
    return window.html2canvas(document.getElementById('captureRoot'), { backgroundColor: backgroundColor, scale: 2 });
  }

  function saveImage(format) {
    const transparent = format === 'transparent';
    return captureCanvas(transparent ? null : '#ffffff').then(function (canvas) {
      const link = document.createElement('a');
      link.download = transparent ? 'function-conic-general-form-transparent.png' : 'function-conic-general-form.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  }

  function savePdf() {
    if (!window.jspdf || !window.jspdf.jsPDF) return Promise.reject(new Error('PDF保存に失敗しました。'));
    return captureCanvas('#ffffff').then(function (canvas) {
      const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
      const pdf = new window.jspdf.jsPDF({ orientation: orientation, unit: 'pt', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const scale = Math.min((pageW - margin * 2) / canvas.width, (pageH - margin * 2) / canvas.height);
      const drawW = canvas.width * scale;
      const drawH = canvas.height * scale;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pageW - drawW) / 2, (pageH - drawH) / 2, drawW, drawH);
      pdf.save('function-conic-general-form.pdf');
    });
  }

  function saveWithQuota(format) {
    const runner = window.InstantGeometrySaveQuota && window.InstantGeometrySaveQuota.runWithQuota
      ? window.InstantGeometrySaveQuota.runWithQuota
      : function (fn) { return fn(); };
    const task = function () { return format === 'pdf' ? savePdf() : saveImage(format); };
    return runner(task).then(function () {
      closeSheets();
      setStatus('保存しました。', false);
    }).catch(function (error) {
      setStatus(error.message || '保存に失敗しました。', true);
    });
  }

  Object.keys(inputs).forEach(function (key) {
    inputs[key].addEventListener('input', render);
  });
  document.getElementById('backBtn').addEventListener('click', function () {
    window.location.href = '../../';
  });
  document.getElementById('settingsBtn').addEventListener('click', openSettingsSheet);
  const saveButton = document.getElementById('saveBtn');
  if (window.InstantGeometrySaveQuota && saveButton) window.InstantGeometrySaveQuota.createIndicator({ target: saveButton });
  saveButton.addEventListener('click', openSaveSheet);
  document.getElementById('sheetClose').addEventListener('click', closeSheets);
  document.getElementById('saveSheetClose').addEventListener('click', closeSheets);
  document.getElementById('savePngBtn').addEventListener('click', function () { saveWithQuota('png'); });
  document.getElementById('saveTransparentBtn').addEventListener('click', function () { saveWithQuota('transparent'); });
  document.getElementById('savePdfBtn').addEventListener('click', function () { saveWithQuota('pdf'); });
  sheetBackdrop.addEventListener('click', closeSheets);

  render();
})();
