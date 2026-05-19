(function () {
  'use strict';

  function ensureRecord(object, key) {
    if (!object[key]) object[key] = {};
    return object[key];
  }

  function styleKey(kind, id) {
    return String(kind || '') + ':' + String(id || '');
  }

  function defaultColor(kind, fallback) {
    if (fallback) return fallback;
    return kind === 'point' ? '#1f2430' : '#2a5bd7';
  }

  function segmentKindOptions() {
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

  function getSegmentDisplayLabel(raw, value, formatNumber) {
    const text = String(raw || '');
    const LabelEngine = window.InstantGeometryDrawLabelEngine || window.InstantGeometryTriangleLabelEngine || null;
    if (!text) return null;
    if (LabelEngine && typeof LabelEngine.isRatioLabelValue === 'function' && LabelEngine.isRatioLabelValue(text)) {
      return LabelEngine.getRatioLabelInput(text);
    }
    if (text === ' ' || text === '0' || text === 'decimal:' || text === 'raw:') {
      return typeof formatNumber === 'function' ? formatNumber(value) : String(value);
    }
    return text;
  }

  function create(config) {
    const cfg = config || {};
    const state = cfg.state || {};
    const LabelEngine = window.InstantGeometryDrawLabelEngine || window.InstantGeometryTriangleLabelEngine || null;
    const labelScales = ensureRecord(state, 'labelScales');
    const labelColors = ensureRecord(state, 'labelColors');
    let controller = null;

    function getLabelScale(kind, id) {
      const value = labelScales[styleKey(kind, id)];
      return Number.isFinite(value) && value > 0 ? value : 1;
    }

    function setLabelScale(kind, id, value) {
      labelScales[styleKey(kind, id)] = Math.max(0.1, Math.min(4, Number(value) || 1));
    }

    function getColor(kind, id, fallback) {
      return labelColors[styleKey(kind, id)] || defaultColor(kind, fallback);
    }

    function setColor(kind, id, value) {
      labelColors[styleKey(kind, id)] = value || defaultColor(kind);
    }

    function createSvgLabel(text, attrs, kind, id) {
      const nextAttrs = Object.assign({}, attrs || {});
      const baseSize = Number(nextAttrs['font-size']) || 48;
      nextAttrs['font-size'] = String(baseSize * getLabelScale(kind, id));
      nextAttrs.fill = getColor(kind, id, nextAttrs.fill);
      if (window.InstantGeometrySharedLabels && typeof window.InstantGeometrySharedLabels.createSvgKatexLabel === 'function') {
        return window.InstantGeometrySharedLabels.createSvgKatexLabel({
          createSvg: cfg.createSvg,
          text: text,
          attrs: nextAttrs,
          kind: kind,
          id: id
        });
      }
      return null;
    }

    if (LabelEngine && typeof LabelEngine.createController === 'function') {
      controller = LabelEngine.createController({
        enabledLabels: { point: true, segment: true },
        taxonomyContext: { defaultKind: 'segment' },
        editSheet: cfg.editSheet,
        sheetTitle: cfg.sheetTitle,
        sheetBody: cfg.sheetBody,
        sheetBackdrop: cfg.sheetBackdrop,
        closeSheets: cfg.closeSheets,
        render: cfg.render,
        onError: function (error) {
          if (cfg.setStatus) cfg.setStatus(error.message || '入力を確認してください。', true);
        },
        getModalSpec: function (kind, id, modalType) {
          return LabelEngine.getStandardModalSpec(modalType, {
            guideLabel: 'ガイドを表示',
            moveAction: false
          });
        },
        getTitle: function (kind, id) {
          if (cfg.getTitle) return cfg.getTitle(kind, id);
          return kind === 'point' ? '点 ' + id : '線分 ' + id;
        },
        buildSegmentKindSelect: function (kind, id, buildSelect) {
          return buildSelect('線分マーク', (state.segmentKinds && state.segmentKinds[id]) || 'plain', segmentKindOptions());
        },
        setKind: function (kind, id, value) {
          if (kind === 'segment' && state.segmentKinds) state.segmentKinds[id] = value;
        },
        hasGuideField: function (kind) {
          return kind === 'segment';
        },
        getGuideVisible: function (kind, id) {
          return !state.segmentArcVisible || state.segmentArcVisible[id] !== false;
        },
        setGuideVisible: function (kind, id, checked) {
          if (state.segmentArcVisible) state.segmentArcVisible[id] = !!checked;
        },
        getLabelValue: function (kind, id) {
          return kind === 'point'
            ? ((state.pointInputs && state.pointInputs[id]) || '')
            : ((state.segmentInputs && state.segmentInputs[id]) || '');
        },
        setLabelValue: function (kind, id, value) {
          if (kind === 'point') {
            if (state.pointInputs) state.pointInputs[id] = value || '';
          } else {
            if (state.segmentInputs) state.segmentInputs[id] = value || '';
            if (!value && state.segmentArcVisible) state.segmentArcVisible[id] = false;
          }
        },
        getLabelScale: getLabelScale,
        setLabelScale: setLabelScale,
        getColor: function (kind, id) {
          return getColor(kind, id);
        },
        setColor: setColor,
        hasColorField: function () { return true; }
      });
    }

    return {
      openEditSheet: function (kind, id) {
        if (!controller) return false;
        controller.openEditSheet(kind, id);
        return true;
      },
      createSvgLabel: createSvgLabel,
      getLabelScale: getLabelScale,
      getColor: getColor
    };
  }

  window.InstantGeometryInlinePointSegmentController = {
    create: create,
    getSegmentDisplayLabel: getSegmentDisplayLabel
  };
})();
