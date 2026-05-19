(function () {
  'use strict';

  function formatNumber(value) {
    if (!Number.isFinite(value)) return '';
    if (Math.abs(value) < 1e-10) return '0';
    const rounded = Math.round(value * 1000) / 1000;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, '').replace(/\.$/, '');
  }

  function ensureState(state) {
    if (!Number.isFinite(Number(state.viewCenterX))) state.viewCenterX = 0;
    if (!Number.isFinite(Number(state.viewCenterY))) state.viewCenterY = 0;
    if (!Number.isFinite(Number(state.viewWidth)) || Number(state.viewWidth) <= 0) state.viewWidth = 20;
    if (!Number.isFinite(Number(state.viewHeight)) || Number(state.viewHeight) <= 0) state.viewHeight = 20;
  }

  function applyViewRange(state, plot) {
    ensureState(state);
    const width = Number(state.viewWidth);
    const height = Number(state.viewHeight);
    const centerX = Number(state.viewCenterX);
    const centerY = Number(state.viewCenterY);
    plot.xMin = centerX - width / 2;
    plot.xMax = centerX + width / 2;
    plot.yMin = centerY - height / 2;
    plot.yMax = centerY + height / 2;
  }

  function buildNumberInput(labelText, value) {
    const field = document.createElement('div');
    field.className = 'sheet-field';
    const label = document.createElement('label');
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'decimal';
    input.value = formatNumber(Number(value));
    field.appendChild(label);
    field.appendChild(input);
    return { field: field, input: input };
  }

  function parseNumber(input, labelText, positive) {
    const text = String(input.value || '').trim();
    if (!/^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$/.test(text)) {
      throw new Error(labelText + 'は数値で入力してください。');
    }
    const value = Number(text);
    if (positive && value <= 0) throw new Error(labelText + 'は0より大きい数値で入力してください。');
    return value;
  }

  function formatPiLabel(multiple) {
    if (multiple === 1) return 'π';
    if (multiple === -1) return '-π';
    return String(multiple) + 'π';
  }

  function gridStepFor(start, end) {
    const span = Math.max(0, end - start);
    if (span <= 120) return 1;
    return Math.max(1, Math.ceil(span / 120));
  }

  function isTickLabelValue(value, interval) {
    if (!(interval > 0)) return false;
    const quotient = value / interval;
    return Math.abs(quotient - Math.round(quotient)) < 1e-9;
  }

  const USER_ATTRIBUTE_STORAGE_KEY = 'instantgeometry-user-attribute';
  const DEFAULT_USER_ATTRIBUTE = 'auto';
  const USER_ATTRIBUTES = [
    {
      value: 'auto',
      label: '自動',
      role: 'auto',
      targetLevel: 'auto',
      displayProfile: 'auto'
    },
    {
      value: 'elementary-teacher',
      label: '小学校教員',
      role: 'teacher',
      targetLevel: 'elementary',
      displayProfile: 'elementary-teaching'
    },
    {
      value: 'grade-6-teacher',
      label: '小学6年生 教員',
      role: 'teacher',
      targetLevel: 'elementary',
      targetGrade: 'grade-6',
      displayProfile: 'elementary-fraction'
    },
    {
      value: 'junior-high-1-teacher',
      label: '中学1年生 数学教師',
      role: 'teacher',
      targetLevel: 'junior-high',
      targetGrade: 'junior-high-1',
      displayProfile: 'junior-high-exact'
    },
    {
      value: 'junior-high-2-teacher',
      label: '中学2年生 数学教師',
      role: 'teacher',
      targetLevel: 'junior-high',
      targetGrade: 'junior-high-2',
      displayProfile: 'junior-high-exact'
    },
    {
      value: 'junior-high-3-teacher',
      label: '中学3年生 数学教師',
      role: 'teacher',
      targetLevel: 'junior-high',
      targetGrade: 'junior-high-3',
      displayProfile: 'radical-first'
    },
    {
      value: 'high-school-teacher',
      label: '高校数学教師',
      role: 'teacher',
      targetLevel: 'high-school',
      displayProfile: 'high-school-exact'
    },
    {
      value: 'elementary-student',
      label: '小学生',
      role: 'learner',
      targetLevel: 'elementary',
      displayProfile: 'elementary-readable'
    },
    {
      value: 'junior-high-student',
      label: '中学生',
      role: 'learner',
      targetLevel: 'junior-high',
      displayProfile: 'junior-high-exact'
    },
    {
      value: 'high-school-student',
      label: '高校生',
      role: 'learner',
      targetLevel: 'high-school',
      displayProfile: 'high-school-exact'
    },
    {
      value: 'university-math',
      label: '大学生（数学系）',
      role: 'learner',
      targetLevel: 'university',
      domain: 'math',
      displayProfile: 'advanced-exact'
    },
    {
      value: 'university-physics',
      label: '大学生（物理学科）',
      role: 'learner',
      targetLevel: 'university',
      domain: 'physics',
      displayProfile: 'measurement-first'
    },
    {
      value: 'general',
      label: '一般',
      role: 'general',
      targetLevel: 'general',
      displayProfile: 'readable-decimal'
    }
  ];

  function findUserAttribute(value) {
    return USER_ATTRIBUTES.find(function (item) { return item.value === value; }) || USER_ATTRIBUTES[0];
  }

  function readUserAttribute() {
    try {
      return findUserAttribute(localStorage.getItem(USER_ATTRIBUTE_STORAGE_KEY) || DEFAULT_USER_ATTRIBUTE).value;
    } catch (error) {
      return DEFAULT_USER_ATTRIBUTE;
    }
  }

  function writeUserAttribute(value) {
    const normalized = findUserAttribute(value).value;
    try {
      localStorage.setItem(USER_ATTRIBUTE_STORAGE_KEY, normalized);
    } catch (error) {
      // localStorage is optional; page state still carries the value for this session.
    }
    return normalized;
  }

  function openSettings(options) {
    const state = options.state;
    ensureState(state);
    options.openSheet('設定');

    const centerXInput = buildNumberInput('中心のx座標', state.viewCenterX);
    const centerYInput = buildNumberInput('中心のy座標', state.viewCenterY);
    const widthInput = buildNumberInput('横幅', state.viewWidth);
    const heightInput = buildNumberInput('縦幅', state.viewHeight);
    options.sheetBody.appendChild(centerXInput.field);
    options.sheetBody.appendChild(centerYInput.field);
    options.sheetBody.appendChild(widthInput.field);
    options.sheetBody.appendChild(heightInput.field);

    const tickUnit = state.xTickLabelMode === 'pi' ? 'π刻み' : '刻み';
    const tickSelect = options.buildSelect('座標の数字', String(state.tickLabelInterval || 0), [
      { value: '1', label: '1' + tickUnit },
      { value: '2', label: '2' + tickUnit },
      { value: '5', label: '5' + tickUnit },
      { value: '0', label: '非表示' }
    ]);
    options.sheetBody.appendChild(tickSelect.field);

    const hintNode = document.createElement('p');
    hintNode.className = 'sheet-hint';
    hintNode.textContent = '表示する座標範囲と、座標軸に表示する数字の間隔を変更できます。対象・用途は入口ページの「表示設定」から変更できます。';
    options.sheetBody.appendChild(hintNode);

    const actions = document.createElement('div');
    actions.className = 'sheet-actions';
    const cancel = document.createElement('button');
    cancel.className = 'btn';
    cancel.type = 'button';
    cancel.textContent = 'キャンセル';
    cancel.addEventListener('click', options.closeSheets);
    const save = document.createElement('button');
    save.className = 'btn action-primary';
    save.type = 'button';
    save.textContent = '保存';
    save.addEventListener('click', function () {
      try {
        state.viewCenterX = parseNumber(centerXInput.input, '中心のx座標', false);
        state.viewCenterY = parseNumber(centerYInput.input, '中心のy座標', false);
        state.viewWidth = parseNumber(widthInput.input, '横幅', true);
        state.viewHeight = parseNumber(heightInput.input, '縦幅', true);
        state.tickLabelInterval = Number(tickSelect.select.value) || 0;
        applyViewRange(state, options.plot);
        options.closeSheets();
        options.render();
      } catch (error) {
        options.setStatus(error.message || '入力を確認してください。', true);
      }
    });
    actions.appendChild(cancel);
    actions.appendChild(save);
    options.sheetBody.appendChild(actions);
  }

  function resetState(state) {
    state.viewCenterX = 0;
    state.viewCenterY = 0;
    state.viewWidth = 20;
    state.viewHeight = 20;
  }

  function drawGrid(options) {
    const state = options.state;
    const plot = options.plot;
    const svg = options.svg;
    const sx = options.sx;
    const sy = options.sy;
    const stage = options.stage;
    const drawText = options.drawText;
    const group = svg('g', {});
    const tickLabelInterval = Number(state.tickLabelInterval) || 0;
    const piMode = state.xTickLabelMode === 'pi';
    const xStep = piMode ? Math.PI : 1;
    const startX = piMode ? Math.ceil(plot.xMin / xStep) : Math.ceil(plot.xMin);
    const endX = piMode ? Math.floor(plot.xMax / xStep) : Math.floor(plot.xMax);
    const startY = Math.ceil(plot.yMin);
    const endY = Math.floor(plot.yMax);
    const hasXAxis = plot.yMin <= 0 && plot.yMax >= 0;
    const hasYAxis = plot.xMin <= 0 && plot.xMax >= 0;

    const xGridStep = gridStepFor(startX, endX);
    const yGridStep = gridStepFor(startY, endY);

    for (let tick = startX; tick <= endX; tick += xGridStep) {
      const x = piMode ? tick * Math.PI : tick;
      const px = sx(x);
      group.appendChild(svg('line', {
        x1: px, y1: plot.top, x2: px, y2: plot.bottom,
        class: Math.abs(tick) < 1e-10 || tick % 5 === 0 ? 'function-grid-major' : 'function-grid-minor'
      }));
      if (hasXAxis && tick !== 0 && isTickLabelValue(tick, tickLabelInterval)) {
        const label = svg('text', { x: px - 12, y: sy(0) + 28, class: 'function-tick-label' });
        label.textContent = piMode ? formatPiLabel(tick) : String(tick);
        group.appendChild(label);
      }
    }
    for (let y = startY; y <= endY; y += yGridStep) {
      const py = sy(y);
      group.appendChild(svg('line', {
        x1: plot.left, y1: py, x2: plot.right, y2: py,
        class: y === 0 || y % 5 === 0 ? 'function-grid-major' : 'function-grid-minor'
      }));
      if (hasYAxis && y !== 0 && isTickLabelValue(y, tickLabelInterval)) {
        const label = svg('text', { x: sx(0) + 15, y: py + 7, class: 'function-tick-label' });
        label.textContent = String(y);
        group.appendChild(label);
      }
    }
    if (hasXAxis) group.appendChild(svg('line', { x1: plot.left, y1: sy(0), x2: plot.right, y2: sy(0), class: 'function-axis' }));
    if (hasYAxis) group.appendChild(svg('line', { x1: sx(0), y1: plot.top, x2: sx(0), y2: plot.bottom, class: 'function-axis' }));
    stage.appendChild(group);
    if (hasXAxis) drawText('x', plot.right + 14, sy(0) + 8, 'muted');
    if (hasYAxis) drawText('y', sx(0) + 12, plot.top - 14, 'muted');
  }

  window.InstantGeometryFunctionViewSettings = {
    applyViewRange: applyViewRange,
    openSettings: openSettings,
    resetState: resetState,
    drawGrid: drawGrid,
    userAttributes: USER_ATTRIBUTES.slice(),
    getUserAttribute: readUserAttribute,
    setUserAttribute: writeUserAttribute,
    getUserAttributeProfile: function (value) {
      const attribute = findUserAttribute(value || readUserAttribute());
      return Object.assign({}, attribute);
    }
  };
})();
