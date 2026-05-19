(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const config = Object.assign({
    type: 'flower',
    saveBase: 'function-biology',
    statusText: 'パラメータを入力すると、生物の形を関数で描画します。',
    params: ['a', 'b', 'c'],
    defaults: { a: 5, b: 6, c: 0.35 },
    labels: { a: '大きさ a', b: '係数 n', c: '厚み c' },
    viewWidth: 18,
    viewHeight: 18
  }, window.InstantGeometryBiologyFunctionConfig || {});

  const stage = document.getElementById('stage');
  const statusBox = document.getElementById('statusBox');
  const captureRoot = document.getElementById('captureRoot');
  const sheetBackdrop = document.getElementById('sheetBackdrop');
  const editSheet = document.getElementById('editSheet');
  const saveSheet = document.getElementById('saveSheet');
  const sheetBody = document.getElementById('sheetBody');
  const inputs = {
    a: document.getElementById('axisA'),
    b: document.getElementById('axisB'),
    c: document.getElementById('axisC')
  };
  const activeParams = Array.isArray(config.params) ? config.params : ['a', 'b', 'c'];

  if (!stage || activeParams.some(function (key) { return !inputs[key]; })) return;

  const plot = {
    left: 86,
    right: 914,
    top: 86,
    bottom: 914,
    xMin: -config.viewWidth / 2,
    xMax: config.viewWidth / 2,
    yMin: -config.viewHeight / 2,
    yMax: config.viewHeight / 2
  };

  function svg(tag, attrs) {
    const node = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (key) { node.setAttribute(key, attrs[key]); });
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function sx(x) {
    return plot.left + (x - plot.xMin) / (plot.xMax - plot.xMin) * (plot.right - plot.left);
  }

  function sy(y) {
    return plot.top + (plot.yMax - y) / (plot.yMax - plot.yMin) * (plot.bottom - plot.top);
  }

  function point(x, y) {
    return { x: sx(x), y: sy(y), ux: x, uy: y };
  }

  function pathFromPoints(points) {
    return points.map(function (p, index) {
      return (index === 0 ? 'M ' : 'L ') + p.x + ' ' + p.y;
    }).join(' ');
  }

  function drawPath(points, color, width, klass) {
    if (!points || points.length < 2) return;
    const path = svg('path', { d: pathFromPoints(points), class: klass || 'function-curve', fill: 'none' });
    path.style.stroke = color;
    path.style.strokeWidth = width || '4';
    path.style.strokeLinecap = 'round';
    path.style.strokeLinejoin = 'round';
    stage.appendChild(path);
  }

  function drawText(text, x, y, klass) {
    const label = svg('text', { x: x, y: y, class: 'function-label' + (klass ? ' ' + klass : '') });
    label.textContent = text;
    stage.appendChild(label);
  }

  function formatNumber(value) {
    if (!Number.isFinite(value)) return '';
    const rounded = Math.round(value * 1000) / 1000;
    if (Math.abs(rounded) < 1e-10) return '0';
    return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, '').replace(/\.$/, '');
  }

  function parseNumber(key) {
    const text = String(inputs[key].value || '').trim();
    if (!/^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$/.test(text)) {
      throw new Error((config.labels[key] || key) + ' は数値で入力してください。');
    }
    return Number(text);
  }

  function readParams() {
    const values = Object.assign({}, config.defaults || {});
    activeParams.forEach(function (key) { values[key] = parseNumber(key); });
    if (values.a <= 0) throw new Error((config.labels.a || 'a') + ' は0より大きい数値で入力してください。');
    if (values.b <= 0) throw new Error((config.labels.b || 'b') + ' は0より大きい数値で入力してください。');
    if (values.c <= 0) throw new Error((config.labels.c || 'c') + ' は0より大きい数値で入力してください。');
    return values;
  }

  function setStatus(message, isError) {
    if (!statusBox) return;
    statusBox.textContent = message;
    statusBox.classList.toggle('error', Boolean(isError));
  }

  function drawGrid() {
    const tick = 2;
    for (let x = Math.ceil(plot.xMin); x <= Math.floor(plot.xMax); x += 1) {
      stage.appendChild(svg('line', {
        x1: sx(x),
        y1: sy(plot.yMin),
        x2: sx(x),
        y2: sy(plot.yMax),
        class: x % tick === 0 ? 'function-grid-major' : 'function-grid-minor'
      }));
    }
    for (let y = Math.ceil(plot.yMin); y <= Math.floor(plot.yMax); y += 1) {
      stage.appendChild(svg('line', {
        x1: sx(plot.xMin),
        y1: sy(y),
        x2: sx(plot.xMax),
        y2: sy(y),
        class: y % tick === 0 ? 'function-grid-major' : 'function-grid-minor'
      }));
    }
    if (plot.yMin <= 0 && plot.yMax >= 0) stage.appendChild(svg('line', { x1: plot.left, y1: sy(0), x2: plot.right, y2: sy(0), class: 'function-axis' }));
    if (plot.xMin <= 0 && plot.xMax >= 0) stage.appendChild(svg('line', { x1: sx(0), y1: plot.top, x2: sx(0), y2: plot.bottom, class: 'function-axis' }));
  }

  function flowerFormula(v) {
    return 'r = ' + formatNumber(v.a) + '(1 - ' + formatNumber(v.c) + 'cos(' + formatNumber(v.b) + 'θ))';
  }

  function drawFlower(v) {
    const n = Math.max(1, Math.round(v.b));
    const points = [];
    const steps = 2200;
    for (let i = 0; i <= steps; i += 1) {
      const theta = 2 * Math.PI * (i / steps);
      const r = v.a * (1 - Math.min(0.9, v.c) * Math.cos(n * theta));
      points.push(point(r * Math.cos(theta), r * Math.sin(theta)));
    }
    drawPath(points, '#c74375', 5);
    for (let i = 0; i < n; i += 1) {
      const theta = 2 * Math.PI * i / n;
      drawPath([point(0, 0), point(v.a * 0.9 * Math.cos(theta), v.a * 0.9 * Math.sin(theta))], '#e3a1ba', 2);
    }
    drawText(flowerFormula(Object.assign({}, v, { b: n })), plot.left + 18, plot.top + 44, 'muted');
  }

  function shellFormula(v) {
    return 'r = ' + formatNumber(v.a) + 'e^(' + formatNumber(v.b) + 'θ), ribs=' + formatNumber(Math.round(v.c));
  }

  function drawShell(v) {
    const turns = 4.8;
    const thetaMax = turns * 2 * Math.PI;
    const growth = Math.min(0.23, v.b / 10);
    const points = [];
    const ribCount = Math.max(4, Math.round(v.c));
    const steps = 2600;
    for (let i = 0; i <= steps; i += 1) {
      const theta = thetaMax * (i / steps);
      const r = v.a * Math.exp(growth * theta);
      points.push(point(r * Math.cos(theta), r * Math.sin(theta)));
    }
    drawPath(points, '#8a5a32', 5);
    for (let i = 12; i < steps; i += Math.max(24, Math.floor(steps / (ribCount * turns)))) {
      const theta = thetaMax * (i / steps);
      const r = v.a * Math.exp(growth * theta);
      const outer = r * (1 + 0.08 + 0.04 * Math.sin(theta * 3));
      const inner = Math.max(v.a * 0.25, r * 0.72);
      drawPath([
        point(inner * Math.cos(theta - 0.05), inner * Math.sin(theta - 0.05)),
        point(outer * Math.cos(theta + 0.08), outer * Math.sin(theta + 0.08))
      ], '#d0a06f', 2);
    }
    drawText(shellFormula(v), plot.left + 18, plot.top + 44, 'muted');
  }

  function leafFormula(v) {
    return 'y = ±b(1 - (x/a)²)^0.62, veins=' + formatNumber(Math.round(v.c));
  }

  function leafHalfWidth(v, x) {
    const u = Math.max(0, 1 - Math.pow(x / v.a, 2));
    const taper = 0.92 + 0.08 * (x / v.a);
    return v.b * taper * Math.pow(u, 0.62);
  }

  function leafPoint(v, x, side) {
    return {
      x: x,
      y: side * leafHalfWidth(v, x)
    };
  }

  function drawLeaf(v) {
    const outline = [];
    const steps = 900;
    for (let i = 0; i <= steps; i += 1) {
      const x = -v.a + 2 * v.a * (i / steps);
      const p = leafPoint(v, x, 1);
      outline.push(point(p.x, p.y));
    }
    for (let i = steps; i >= 0; i -= 1) {
      const x = -v.a + 2 * v.a * (i / steps);
      const p = leafPoint(v, x, -1);
      outline.push(point(p.x, p.y));
    }
    const shape = svg('path', { d: pathFromPoints(outline) + ' Z', fill: 'rgba(63, 137, 78, .12)', class: 'function-area' });
    shape.style.stroke = '#2f7d48';
    shape.style.strokeWidth = '4';
    stage.appendChild(shape);
    drawPath([point(-v.a, 0), point(v.a, 0)], '#2f7d48', 4);

    const veins = Math.max(3, Math.round(v.c));
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 1; i <= veins; i += 1) {
        const x = -v.a + 2 * v.a * (i / (veins + 1));
        const edge = leafPoint(v, x, side);
        const base = { x: x * 0.82, y: 0 };
        const mid = { x: (base.x + edge.x) / 2, y: edge.y * 0.42 };
        const vein = [];
        for (let j = 0; j <= 32; j += 1) {
          const q = j / 32;
          const x = Math.pow(1 - q, 2) * base.x + 2 * (1 - q) * q * mid.x + q * q * edge.x;
          const y = Math.pow(1 - q, 2) * base.y + 2 * (1 - q) * q * mid.y + q * q * edge.y;
          vein.push(point(x, y));
        }
        drawPath(vein, '#7eaf79', 2);
      }
    }
    drawText(leafFormula(v), plot.left + 18, plot.top + 44, 'muted');
  }

  function render() {
    clear(stage);
    drawGrid();
    try {
      const values = readParams();
      if (config.type === 'shell') drawShell(values);
      else if (config.type === 'leaf') drawLeaf(values);
      else drawFlower(values);
      setStatus(config.statusText, false);
    } catch (error) {
      setStatus(error.message || '入力を確認してください。', true);
    }
  }

  function closeSheets() {
    [editSheet, saveSheet].forEach(function (sheet) {
      if (!sheet) return;
      sheet.classList.remove('open');
      sheet.setAttribute('aria-hidden', 'true');
    });
    if (sheetBackdrop) sheetBackdrop.classList.remove('open');
  }

  function openSheet(sheet) {
    closeSheets();
    if (sheetBackdrop) sheetBackdrop.classList.add('open');
    if (sheet) {
      sheet.classList.add('open');
      sheet.setAttribute('aria-hidden', 'false');
    }
  }

  function openSettingsSheet() {
    if (!sheetBody) return;
    clear(sheetBody);
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = '下の入力欄でパラメータを変更できます。保存ボタンからPNG・透過PNG・PDFを書き出せます。';
    sheetBody.appendChild(p);
    openSheet(editSheet);
  }

  function openSaveSheet() {
    openSheet(saveSheet);
  }

  function downloadUrl(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function saveImage(format) {
    if (!window.html2canvas || !captureRoot) return Promise.reject(new Error('保存ライブラリを読み込み中です。'));
    const transparent = format === 'transparent';
    return window.html2canvas(captureRoot, { backgroundColor: transparent ? null : '#ffffff', scale: 2 }).then(function (canvas) {
      downloadUrl(canvas.toDataURL('image/png'), config.saveBase + (transparent ? '-transparent' : '') + '.png');
    });
  }

  function savePdf() {
    if (!window.html2canvas || !window.jspdf || !window.jspdf.jsPDF || !captureRoot) return Promise.reject(new Error('PDF保存ライブラリを読み込み中です。'));
    return window.html2canvas(captureRoot, { backgroundColor: '#ffffff', scale: 2 }).then(function (canvas) {
      const pdf = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const width = 190;
      const height = canvas.height * width / canvas.width;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, 12, width, height);
      pdf.save(config.saveBase + '.pdf');
    });
  }

  function saveWithQuota(format) {
    const runner = window.InstantGeometrySaveQuota && window.InstantGeometrySaveQuota.runWithQuota
      ? window.InstantGeometrySaveQuota.runWithQuota
      : function (fn) { return fn(); };
    return runner(function () { return format === 'pdf' ? savePdf() : saveImage(format); }).then(function () {
      closeSheets();
      setStatus('保存しました。', false);
    }).catch(function (error) {
      setStatus(error.message || '保存に失敗しました。', true);
    });
  }

  activeParams.forEach(function (key) { inputs[key].addEventListener('input', render); });
  const backButton = document.getElementById('backBtn');
  if (backButton) backButton.addEventListener('click', function () { window.location.href = '../../'; });
  const settingsButton = document.getElementById('settingsBtn');
  if (settingsButton) settingsButton.addEventListener('click', openSettingsSheet);
  const saveButton = document.getElementById('saveBtn');
  if (window.InstantGeometrySaveQuota && saveButton) window.InstantGeometrySaveQuota.createIndicator({ target: saveButton });
  if (saveButton) saveButton.addEventListener('click', openSaveSheet);
  ['sheetClose', 'saveSheetClose'].forEach(function (id) {
    const button = document.getElementById(id);
    if (button) button.addEventListener('click', closeSheets);
  });
  if (sheetBackdrop) sheetBackdrop.addEventListener('click', closeSheets);
  const savePngButton = document.getElementById('savePngBtn');
  if (savePngButton) savePngButton.addEventListener('click', function () { saveWithQuota('png'); });
  const saveTransparentButton = document.getElementById('saveTransparentBtn');
  if (saveTransparentButton) saveTransparentButton.addEventListener('click', function () { saveWithQuota('transparent'); });
  const savePdfButton = document.getElementById('savePdfBtn');
  if (savePdfButton) savePdfButton.addEventListener('click', function () { saveWithQuota('pdf'); });

  render();
})();
