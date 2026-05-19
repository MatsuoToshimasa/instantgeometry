(function () {
  'use strict';

  const RATIO_LABEL_PREFIX = 'ratio:';
  const RAW_NUMERIC_LABEL_VALUE = 'raw:';
  const DECIMAL_NUMERIC_LABEL_VALUE = 'decimal:';
  const LABEL_TYPE_ORDER = ['point', 'segment', 'angle', 'area', 'arc', 'volume', 'function'];
  const LABEL_TYPES = Object.freeze({
    point: Object.freeze({
      key: 'point',
      name: '点',
      modalTitle: '点ラベル',
      supportsNumeric: false,
      supportsRatio: false,
      supportsGuide: false,
      supportsColor: true,
      supportsLabelSize: true,
      labelSizeLabel: 'ラベルサイズ',
      supportsMove: true,
      defaultMode: 'text'
    }),
    segment: Object.freeze({
      key: 'segment',
      name: '線分',
      modalTitle: '線分ラベル',
      supportsNumeric: true,
      supportsRatio: true,
      supportsGuide: true,
      guideLabel: 'ガイドを表示',
      supportsColor: true,
      supportsLabelSize: true,
      labelSizeLabel: 'ラベルサイズ',
      supportsMove: true,
      defaultMode: 'hidden'
    }),
    angle: Object.freeze({
      key: 'angle',
      name: '角',
      modalTitle: '角ラベル',
      supportsNumeric: true,
      supportsRatio: true,
      supportsGuide: false,
      supportsAngleArc: true,
      angleArcLabel: '角マーク',
      angleArcSizeLabel: '角弧サイズ',
      supportsColor: true,
      supportsLabelSize: true,
      labelSizeLabel: 'ラベルサイズ',
      supportsMove: true,
      defaultMode: 'auto'
    }),
    area: Object.freeze({
      key: 'area',
      name: '面',
      modalTitle: '面ラベル',
      supportsNumeric: true,
      supportsRatio: true,
      supportsGuide: true,
      guideLabel: 'ガイドを表示',
      supportsColor: true,
      supportsLabelSize: true,
      labelSizeLabel: 'ラベルサイズ',
      supportsMove: true,
      defaultMode: 'hidden'
    }),
    arc: Object.freeze({
      key: 'arc',
      name: '弧',
      modalTitle: '弧ラベル',
      supportsNumeric: true,
      supportsRatio: true,
      supportsGuide: false,
      supportsColor: true,
      supportsLabelSize: true,
      labelSizeLabel: 'ラベルサイズ',
      supportsMove: true,
      defaultMode: 'hidden'
    }),
    volume: Object.freeze({
      key: 'volume',
      name: '体積',
      modalTitle: '体積ラベル',
      supportsNumeric: true,
      supportsRatio: false,
      supportsGuide: true,
      guideLabel: 'ガイドを表示',
      supportsColor: true,
      supportsLabelSize: true,
      labelSizeLabel: 'ラベルサイズ',
      supportsMove: true,
      defaultMode: 'auto',
      defaultVisible: true
    }),
    function: Object.freeze({
      key: 'function',
      name: '関数',
      modalTitle: '関数ラベル',
      supportsNumeric: false,
      supportsRatio: false,
      supportsGuide: false,
      supportsColor: true,
      supportsLabelSize: true,
      labelSizeLabel: 'ラベルサイズ',
      supportsMove: true,
      defaultMode: 'text'
    })
  });

  function normalizeFreeLabel(value) {
    return String(value || '');
  }

  function parseRatioLabelInput(value) {
    const text = String(value || '').trim();
    const parts = text.split(/[,:：]/);
    if (parts.length !== 2) return null;
    const left = parts[0].trim();
    const number = parts[1].trim();
    const mark = left.toLowerCase();
    if (!left) return null;
    if (!number) return null;
    return { mark: mark, value: number, left: left, right: number, source: left + ',' + number };
  }

  function isRatioLabelValue(value) {
    return String(value || '').indexOf(RATIO_LABEL_PREFIX) === 0 && Boolean(parseRatioLabelInput(String(value).slice(RATIO_LABEL_PREFIX.length)));
  }

  function getRatioLabelInput(value) {
    return isRatioLabelValue(value) ? String(value).slice(RATIO_LABEL_PREFIX.length) : '';
  }

  function isNumericLabelValue(value) {
    return value === ' ' || value === '0';
  }

  function isRawNumericLabelValue(value) {
    return value === RAW_NUMERIC_LABEL_VALUE;
  }

  function isDecimalNumericLabelValue(value) {
    return value === DECIMAL_NUMERIC_LABEL_VALUE;
  }

  function isAnyNumericLabelValue(value) {
    return isNumericLabelValue(value) || isRawNumericLabelValue(value) || isDecimalNumericLabelValue(value);
  }

  function getDisplayMode(value, hasNumericMode) {
    if (value === '') return 'hidden';
    if (hasNumericMode && isRatioLabelValue(value)) return 'ratio';
    if (hasNumericMode && isRawNumericLabelValue(value)) return 'numeric';
    if (hasNumericMode && isDecimalNumericLabelValue(value)) return 'numericDecimal';
    if (hasNumericMode && isNumericLabelValue(value)) return 'numeric';
    return 'text';
  }

  function getLabelType(type) {
    const normalizedType = window.InstantGeometryLabelTaxonomy && typeof window.InstantGeometryLabelTaxonomy.normalizeKind === 'function'
      ? window.InstantGeometryLabelTaxonomy.normalizeKind(type)
      : type;
    return LABEL_TYPES[normalizedType] || null;
  }

  function getLabelTypes() {
    return LABEL_TYPE_ORDER.map(function (type) {
      return LABEL_TYPES[type];
    });
  }

  function isKnownLabelType(type) {
    return Boolean(getLabelType(type));
  }

  function normalizeLabelTarget(kind, id, context) {
    if (window.InstantGeometryLabelTaxonomy && typeof window.InstantGeometryLabelTaxonomy.normalizeLabelTarget === 'function') {
      return window.InstantGeometryLabelTaxonomy.normalizeLabelTarget(kind, id, context);
    }
    if (window.InstantGeometryLabelTaxonomy && typeof window.InstantGeometryLabelTaxonomy.normalize === 'function') {
      return window.InstantGeometryLabelTaxonomy.normalize({ kind: kind, id: id }, context);
    }
    return {
      kind: kind,
      id: id,
      originalKind: kind,
      originalId: id,
      canonical: isKnownLabelType(kind),
      role: ''
    };
  }

  function normalizeEnabledLabels(enabledLabels) {
    const normalized = {};
    LABEL_TYPE_ORDER.forEach(function (type) {
      normalized[type] = false;
    });
    if (enabledLabels === true) {
      LABEL_TYPE_ORDER.forEach(function (type) {
        normalized[type] = true;
      });
      return normalized;
    }
    if (!enabledLabels) return normalized;
    if (Array.isArray(enabledLabels)) {
      enabledLabels.forEach(function (type) {
        if (isKnownLabelType(type)) normalized[type] = true;
      });
      return normalized;
    }
    Object.keys(enabledLabels).forEach(function (type) {
      if (isKnownLabelType(type)) normalized[type] = Boolean(enabledLabels[type]);
    });
    return normalized;
  }

  function isLabelTypeEnabled(enabledLabels, type) {
    return Boolean(normalizeEnabledLabels(enabledLabels)[type]);
  }

  function getStandardModalSpec(type, overrides) {
    const labelType = getLabelType(type);
    if (!labelType) return null;
    return Object.freeze(Object.assign({
      type: labelType.key,
      title: labelType.modalTitle,
      labelField: true,
      labelFieldLabel: 'ラベル',
      numericLabel: Boolean(labelType.supportsNumeric),
      ratioLabel: Boolean(labelType.supportsRatio),
      guideField: Boolean(labelType.supportsGuide),
      guideLabel: labelType.guideLabel || 'ガイドを表示',
      angleArcField: Boolean(labelType.supportsAngleArc),
      angleArcLabel: labelType.angleArcLabel || '角マーク',
      angleArcSizeField: Boolean(labelType.supportsAngleArc),
      angleArcSizeLabel: labelType.angleArcSizeLabel || '角弧サイズ',
      labelSizeField: Boolean(labelType.supportsLabelSize),
      labelSizeLabel: labelType.labelSizeLabel || 'ラベルサイズ',
      colorField: Boolean(labelType.supportsColor),
      colorLabel: '色',
      moveAction: Boolean(labelType.supportsMove)
    }, overrides || {}));
  }

  function isDebugHitEnabled() {
    return new URLSearchParams(window.location.search).get('debugHit') === '1';
  }

  function moveHitAreaSize(fontSize, text, options) {
    const opts = options || {};
    const labelText = String(text || '');
    const size = Number(fontSize) || 48;
    return {
      width: Math.max(size * 7.2, labelText.length * size * 1.25, Number(opts.minWidth) || 360),
      height: Math.max(size * 4.8, Number(opts.minHeight) || 280)
    };
  }

  function createMoveHitArea(createSvg, position, kind, id, fontSize, text, options) {
    const opts = options || {};
    const debug = opts.debug === undefined ? isDebugHitEnabled() : Boolean(opts.debug);
    const size = moveHitAreaSize(fontSize, text, opts);
    const rect = createSvg('rect', {
      x: position.x - size.width / 2,
      y: position.y - size.height / 2,
      width: size.width,
      height: size.height,
      rx: opts.rx == null ? 14 : opts.rx,
      ry: opts.ry == null ? 14 : opts.ry,
      fill: debug ? 'rgba(255, 149, 0, 0.16)' : 'transparent',
      stroke: debug ? '#ff9500' : 'transparent',
      'stroke-width': debug ? 3 : 0,
      'stroke-dasharray': debug ? '10 7' : null,
      'pointer-events': 'all',
      'data-kind': kind,
      'data-id': id
    });
    rect.classList.add('label-move-target', 'label-move-hit-area');
    return rect;
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

  function buildRangeField(labelText, value, min, max, step, formatValue) {
    const field = document.createElement('div');
    field.className = 'sheet-field range-field';
    const label = document.createElement('label');
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    const output = document.createElement('output');
    function sync() {
      output.textContent = formatValue ? formatValue(input.value) : input.value;
    }
    input.addEventListener('input', sync);
    field.appendChild(label);
    field.appendChild(input);
    field.appendChild(output);
    sync();
    return { field: field, input: input };
  }

  function buildCheckbox(labelText, checked) {
    const field = document.createElement('div');
    field.className = 'sheet-field';
    const label = document.createElement('label');
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = Boolean(checked);
    input.style.minHeight = '20px';
    input.style.width = '20px';
    input.style.justifySelf = 'start';
    field.appendChild(label);
    field.appendChild(input);
    return { field: field, input: input };
  }

  function buildLabelEditor(labelText, value, hasNumericMode, hasRatioMode) {
    const allowRatio = hasRatioMode !== false;
    const field = document.createElement('div');
    field.className = 'sheet-field';
    const label = document.createElement('label');
    label.textContent = labelText;
    const mode = document.createElement('select');
    [
      { value: 'hidden', label: '非表示' },
      hasNumericMode ? { value: 'numeric', label: '数値（自動）' } : null,
      hasNumericMode ? { value: 'numericDecimal', label: '数値（小数）' } : null,
      hasNumericMode && allowRatio ? { value: 'ratio', label: '比の値' } : null,
      { value: 'text', label: '自由入力' }
    ].filter(Boolean).forEach(function (option) {
      const node = document.createElement('option');
      node.value = option.value;
      node.textContent = option.label;
      if (option.value === getDisplayMode(value, hasNumericMode)) node.selected = true;
      mode.appendChild(node);
    });
    const input = document.createElement('input');
    input.type = 'text';
    input.value = getDisplayMode(value, hasNumericMode) === 'text' ? normalizeFreeLabel(value) : getRatioLabelInput(value);
    input.setAttribute('inputmode', 'text');
    input.autocapitalize = 'none';
    input.autocomplete = 'off';
    input.spellcheck = false;
    function sync() {
      const isEditable = mode.value === 'text' || mode.value === 'ratio';
      input.disabled = !isEditable;
      input.placeholder = mode.value === 'ratio' ? '例: s,5 / t,4.4 / r,5/3' : '';
    }
    mode.addEventListener('change', sync);
    field.appendChild(label);
    field.appendChild(mode);
    field.appendChild(input);
    sync();
    return { field: field, mode: mode, input: input };
  }

  function readLabelEditorValue(labelEditor) {
    const mode = labelEditor && labelEditor.mode ? labelEditor.mode.value : 'hidden';
    const text = normalizeFreeLabel(labelEditor && labelEditor.input ? labelEditor.input.value : '');
    if (mode === 'hidden') return '';
    if (mode === 'numeric') return ' ';
    if (mode === 'numericDecimal') return DECIMAL_NUMERIC_LABEL_VALUE;
    if (mode === 'ratio') {
      const parsed = parseRatioLabelInput(text);
      if (!parsed) throw new Error('比の値を入力してください。');
      return RATIO_LABEL_PREFIX + parsed.source;
    }
    return text || '';
  }

  function buildColorPalette(labelText, value) {
    const field = document.createElement('div');
    field.className = 'sheet-field';
    const label = document.createElement('label');
    label.textContent = labelText;
    const picker = document.createElement('div');
    picker.className = 'color-swatch-picker';
    const colors = [
      ['白', '#ffffff'],
      ['赤', '#e53935'],
      ['青', '#2a5bd7'],
      ['緑', '#2e7d32'],
      ['黄', '#f2c94c'],
      ['紫', '#8e44ad'],
      ['桃', '#ff66a3'],
      ['茶', '#8b5a2b'],
      ['灰', '#8a94a6'],
      ['黒', '#111827']
    ];
    let selected = value || '#2a5bd7';
    colors.forEach(function (entry) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'color-swatch';
      button.dataset.color = entry[1];
      button.style.background = entry[1];
      button.textContent = entry[0];
      button.setAttribute('aria-label', entry[0]);
      button.classList.toggle('is-selected', selected.toLowerCase() === entry[1].toLowerCase());
      button.addEventListener('click', function () {
        selected = entry[1];
        Array.from(picker.children).forEach(function (child) {
          child.classList.toggle('is-selected', child.dataset.color.toLowerCase() === selected.toLowerCase());
        });
      });
      picker.appendChild(button);
    });
    field.appendChild(label);
    field.appendChild(picker);
    return {
      field: field,
      get value() {
        return selected;
      }
    };
  }

  function defaultAngleKindOptions(angleValue) {
    if (window.InstantGeometryMobileAngleOrnaments && typeof window.InstantGeometryMobileAngleOrnaments.getAngleKindOptions === 'function') {
      return window.InstantGeometryMobileAngleOrnaments.getAngleKindOptions(angleValue);
    }
    const options = [
      { value: 'hidden', label: '非表示' },
      { value: 'plain', label: '角弧のみ' },
      { value: 'circle', label: '丸付き' },
      { value: 'cross', label: '交差付き' },
      { value: 'double-cross', label: '二重交差線付き' },
      { value: 'triangle', label: '三角付き' }
    ];
    if (Number.isFinite(angleValue) && Math.abs(angleValue - 90) < 0.01) {
      options.push({ value: 'right', label: '直角記号付き' });
    }
    return options;
  }

  function normalizeAngleKind(kind, angleValue) {
    if (window.InstantGeometryMobileAngleOrnaments && typeof window.InstantGeometryMobileAngleOrnaments.normalizeAngleKind === 'function') {
      return window.InstantGeometryMobileAngleOrnaments.normalizeAngleKind(kind, angleValue);
    }
    if (kind === 'right' && !(Number.isFinite(angleValue) && Math.abs(angleValue - 90) < 0.01)) return 'plain';
    return kind || 'plain';
  }

  function defaultSegmentKindOptions() {
    if (window.InstantGeometryMobileAngleOrnaments && typeof window.InstantGeometryMobileAngleOrnaments.getSegmentKindOptions === 'function') {
      return window.InstantGeometryMobileAngleOrnaments.getSegmentKindOptions();
    }
    return [
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
    ];
  }

  function createController(config) {
    const cfg = config || {};
    const enabledLabels = normalizeEnabledLabels(cfg.enabledLabels || true);
    const sheetTitle = cfg.sheetTitle;
    const sheetBody = cfg.sheetBody;
    const editSheet = cfg.editSheet;
    const sheetBackdrop = cfg.sheetBackdrop;

    function noop() {}
    function openEditSheet(kind, id) {
      const normalizedTarget = normalizeLabelTarget(kind, id, cfg.taxonomyContext || {});
      const modalType = normalizedTarget.kind;
      if (!isLabelTypeEnabled(enabledLabels, modalType)) return;
      if (cfg.closeSheets) cfg.closeSheets();
      const modalSpec = cfg.getModalSpec ? cfg.getModalSpec(kind, id, modalType, normalizedTarget) : getStandardModalSpec(modalType);
      if (!modalSpec || !sheetTitle || !sheetBody || !editSheet || !sheetBackdrop) return;
      sheetTitle.textContent = cfg.getTitle ? cfg.getTitle(kind, id) : (modalSpec.title || '');
      sheetBody.textContent = '';

      let kindSelect = null;
      let guideCheckbox = null;
      let labelEditor = null;
      let colorPalette = null;
      let labelSizeBuilt = null;
      let angleArcScaleBuilt = null;

      if (modalType === 'segment' && cfg.buildSegmentKindSelect) {
        const built = cfg.buildSegmentKindSelect.length >= 3
          ? cfg.buildSegmentKindSelect(kind, id, buildSelect)
          : cfg.buildSegmentKindSelect(id, buildSelect);
        kindSelect = built && (built.select || built);
        if (built && built.field) sheetBody.appendChild(built.field);
      } else if (modalType === 'segment') {
        const currentKind = cfg.getKind ? cfg.getKind(kind, id, modalType, normalizedTarget) : 'plain';
        const built = buildSelect('線分マーク', currentKind || 'plain', defaultSegmentKindOptions());
        kindSelect = built.select;
        sheetBody.appendChild(built.field);
      } else if (modalType === 'angle' && cfg.buildAngleKindSelect) {
        kindSelect = cfg.buildAngleKindSelect.length >= 4
          ? cfg.buildAngleKindSelect(kind, id, buildSelect, sheetBody)
          : cfg.buildAngleKindSelect(id, buildSelect, sheetBody);
      } else if (modalType === 'angle' && modalSpec.angleArcField) {
        const angleValue = cfg.getAngleValue ? cfg.getAngleValue(kind, id) : null;
        const currentKind = cfg.getKind ? cfg.getKind(kind, id, modalType, normalizedTarget) : 'plain';
        const built = buildSelect(
          modalSpec.angleArcLabel || '角マーク',
          normalizeAngleKind(currentKind, angleValue),
          defaultAngleKindOptions(angleValue)
        );
        kindSelect = built.select;
        sheetBody.appendChild(built.field);
      }

      const hasGuideField = Boolean(modalSpec.guideField);
      if (hasGuideField) {
        const guideValue = cfg.getGuideVisible ? cfg.getGuideVisible(kind, id) : true;
        const built = buildCheckbox(modalSpec.guideLabel, guideValue);
        guideCheckbox = built.input;
        sheetBody.appendChild(built.field);
      }

      if (modalSpec.angleArcSizeField && cfg.getAngleArcScale) {
        const currentAngleArcScale = cfg.getAngleArcScale.length >= 2
          ? cfg.getAngleArcScale(kind, id)
          : cfg.getAngleArcScale(id);
        angleArcScaleBuilt = buildRangeField(
          modalSpec.angleArcSizeLabel,
          Math.round(currentAngleArcScale * 100),
          30,
          300,
          10,
          function (scaleValue) { return scaleValue + '%'; }
        );
        sheetBody.appendChild(angleArcScaleBuilt.field);
      }

      if (modalSpec.labelField) {
        labelEditor = buildLabelEditor(
          modalSpec.labelFieldLabel || 'ラベル',
          cfg.getLabelValue ? cfg.getLabelValue(kind, id) : '',
          Boolean(modalSpec.numericLabel),
          Boolean(modalSpec.ratioLabel)
        );
        sheetBody.appendChild(labelEditor.field);
      }

      if (modalSpec.labelSizeField && cfg.getLabelScale) {
        labelSizeBuilt = buildRangeField(
          modalSpec.labelSizeLabel,
          Math.round(cfg.getLabelScale(kind, id) * 100),
          10,
          400,
          10,
          function (scaleValue) { return scaleValue + '%'; }
        );
        sheetBody.appendChild(labelSizeBuilt.field);
      }

      const hasColorField = Boolean(modalSpec.colorField);
      if (hasColorField) {
        const currentColor = cfg.getColor ? cfg.getColor(kind, id) : '#2a5bd7';
        colorPalette = buildColorPalette(modalSpec.colorLabel || '色', currentColor);
        sheetBody.appendChild(colorPalette.field);
      }

      function applyValues() {
        if (kindSelect && cfg.setKind) cfg.setKind(kind, id, kindSelect.value);
        if (guideCheckbox && cfg.setGuideVisible) cfg.setGuideVisible(kind, id, guideCheckbox.checked);
        if (angleArcScaleBuilt && cfg.setAngleArcScale) {
          if (cfg.setAngleArcScale.length >= 3) cfg.setAngleArcScale(kind, id, Number(angleArcScaleBuilt.input.value) / 100);
          else cfg.setAngleArcScale(id, Number(angleArcScaleBuilt.input.value) / 100);
        }
        if (labelSizeBuilt && cfg.setLabelScale) cfg.setLabelScale(kind, id, Number(labelSizeBuilt.input.value) / 100);
        if (colorPalette && cfg.setColor) cfg.setColor(kind, id, colorPalette.value);
        if (labelEditor && cfg.setLabelValue) {
          const value = readLabelEditorValue(labelEditor);
          cfg.setLabelValue(kind, id, value, { guideCheckbox: guideCheckbox });
        }
      }

      const actions = document.createElement('div');
      actions.className = 'sheet-actions';
      const hasMoveAction = modalSpec.moveAction && cfg.labelMoveEnabled !== false && typeof cfg.onMove === 'function';
      if (hasMoveAction) actions.classList.add('has-move');
      const cancel = document.createElement('button');
      cancel.className = 'btn';
      cancel.type = 'button';
      cancel.textContent = 'キャンセル';
      cancel.addEventListener('click', cfg.closeSheets || noop);
      const move = document.createElement('button');
      move.className = 'btn action-secondary';
      move.type = 'button';
      move.textContent = '移動';
      move.addEventListener('click', function () {
        try {
          applyValues();
          if (cfg.render) cfg.render();
          if (cfg.onMove) cfg.onMove(kind, id);
        } catch (error) {
          if (cfg.onError) cfg.onError(error);
        }
      });
      const save = document.createElement('button');
      save.className = 'btn action-primary';
      save.type = 'button';
      save.textContent = '保存';
      save.addEventListener('click', function () {
        try {
          applyValues();
          if (cfg.closeSheets) cfg.closeSheets();
          if (cfg.render) cfg.render();
        } catch (error) {
          if (cfg.onError) cfg.onError(error);
        }
      });
      actions.appendChild(cancel);
      if (hasMoveAction) actions.appendChild(move);
      actions.appendChild(save);
      sheetBody.appendChild(actions);
      editSheet.classList.add('open');
      editSheet.setAttribute('aria-hidden', 'false');
      sheetBackdrop.classList.add('open');
    }

    return {
      openEditSheet: openEditSheet
    };
  }

  const api = {
    LABEL_TYPE_ORDER: LABEL_TYPE_ORDER.slice(),
    LABEL_TYPES: LABEL_TYPES,
    RATIO_LABEL_PREFIX: RATIO_LABEL_PREFIX,
    RAW_NUMERIC_LABEL_VALUE: RAW_NUMERIC_LABEL_VALUE,
    DECIMAL_NUMERIC_LABEL_VALUE: DECIMAL_NUMERIC_LABEL_VALUE,
    getLabelType: getLabelType,
    getLabelTypes: getLabelTypes,
    isKnownLabelType: isKnownLabelType,
    normalizeLabelTarget: normalizeLabelTarget,
    normalizeEnabledLabels: normalizeEnabledLabels,
    isLabelTypeEnabled: isLabelTypeEnabled,
    getStandardModalSpec: getStandardModalSpec,
    isDebugHitEnabled: isDebugHitEnabled,
    moveHitAreaSize: moveHitAreaSize,
    createMoveHitArea: createMoveHitArea,
    normalizeFreeLabel: normalizeFreeLabel,
    parseRatioLabelInput: parseRatioLabelInput,
    isRatioLabelValue: isRatioLabelValue,
    getRatioLabelInput: getRatioLabelInput,
    isNumericLabelValue: isNumericLabelValue,
    isRawNumericLabelValue: isRawNumericLabelValue,
    isDecimalNumericLabelValue: isDecimalNumericLabelValue,
    isAnyNumericLabelValue: isAnyNumericLabelValue,
    getDisplayMode: getDisplayMode,
    readLabelEditorValue: readLabelEditorValue,
    buildSelect: buildSelect,
    buildRangeField: buildRangeField,
    buildCheckbox: buildCheckbox,
    buildLabelEditor: buildLabelEditor,
    buildColorPalette: buildColorPalette,
    createController: createController
  };
  window.InstantGeometryDrawLabelEngine = api;
  window.InstantGeometryTriangleLabelEngine = api;
})();
