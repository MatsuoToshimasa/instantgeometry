(function (root) {
  'use strict';

  var RAW_NUMERIC_LABEL_VALUE = 'raw:';
  var DECIMAL_NUMERIC_LABEL_VALUE = 'decimal:';
  var RATIO_LABEL_PREFIX = 'ratio:';

  var SEGMENT_TO_SIDE = Object.freeze({
    BC: 'a',
    CA: 'b',
    AC: 'b',
    AB: 'c'
  });

  var SIDE_TO_SEGMENT = Object.freeze({
    a: 'BC',
    b: 'CA',
    c: 'AB'
  });

  function isPlainObject(value) {
    return Boolean(value) && Object.prototype.toString.call(value) === '[object Object]';
  }

  function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (isPlainObject(value)) {
      var next = {};
      Object.keys(value).forEach(function (key) {
        next[key] = clone(value[key]);
      });
      return next;
    }
    return value;
  }

  function mergeDeep() {
    var output = {};
    Array.prototype.slice.call(arguments).forEach(function (source) {
      if (!isPlainObject(source)) return;
      Object.keys(source).forEach(function (key) {
        var value = source[key];
        if (isPlainObject(value) && isPlainObject(output[key])) output[key] = mergeDeep(output[key], value);
        else output[key] = clone(value);
      });
    });
    return output;
  }

  function ensureFigureModel(modelOrKey, input) {
    if (isPlainObject(modelOrKey) && modelOrKey.model === 'figure.triangle') return modelOrKey;
    var registry = root.InstantGeometryFigureModels || (typeof require === 'function' ? require('./figure-model-standard.js') : null);
    if (!registry || typeof registry.F !== 'function') {
      throw new Error('InstantGeometryFigureModels.F is required.');
    }
    return registry.F(modelOrKey, input || {});
  }

  function normalizeLabelInput(label, fallbackValue) {
    if (!label || label.visible === false || label.mode === 'hidden') return '';
    if (label.mode === 'space') return ' ';
    if (label.mode === 'ratio') return RATIO_LABEL_PREFIX + String(label.text || fallbackValue || '');
    if (label.valueMode === 'raw' || label.mode === 'numeric') return RAW_NUMERIC_LABEL_VALUE;
    if (label.valueMode === 'decimal' || label.mode === 'numericDecimal') return DECIMAL_NUMERIC_LABEL_VALUE;
    if (label.text !== undefined && label.text !== null) return String(label.text);
    return fallbackValue !== undefined && fallbackValue !== null ? String(fallbackValue) : '';
  }

  function normalizeSideKind(segment) {
    if (!segment || segment.visible === false) return 'hidden';
    if (segment.stroke && segment.stroke.style === 'hidden') return 'hidden';
    if (segment.relationMark && segment.relationMark.visible !== false && segment.relationMark.kind === 'same-length') {
      if (segment.relationMark.index === 2) return 'double';
      if (segment.relationMark.index === 3) return 'cross';
      return 'single';
    }
    if (segment.kind) return segment.kind;
    return 'plain';
  }

  function normalizeAngleKind(angle) {
    if (!angle || angle.visible === false || !angle.mark || angle.mark.visible === false) return 'hidden';
    if (angle.mark.kind === 'right') return 'right';
    if (angle.relationMark && angle.relationMark.visible !== false && angle.relationMark.kind === 'same-angle') {
      if (angle.relationMark.index === 2) return 'cross';
      if (angle.relationMark.index === 3) return 'double-cross';
      return 'circle';
    }
    if (angle.kind) return angle.kind;
    return 'plain';
  }

  function normalizeLabelScale(label, fallback) {
    var value = label && label.size !== undefined ? Number(label.size) : Number(fallback);
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  function normalizeSegmentMarkScale(segment) {
    var value = segment && segment.relationMark ? Number(segment.relationMark.scale) : 1;
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  function segmentValue(segments, id) {
    var segment = segments[id];
    return segment && segment.value !== undefined ? segment.value : undefined;
  }

  function stateForSingleTriangle(model) {
    if (!model || model.model !== 'figure.triangle') {
      throw new Error('figure.triangle model is required.');
    }
    if (model.objects && model.objects.figures) {
      throw new Error('triangle-mobile adapter only supports a single triangle. Use renderPlanForTriangleModel for paired figures.');
    }

    var objects = model.objects || {};
    var points = objects.points || {};
    var segments = objects.segments || {};
    var angles = objects.angles || {};
    var areas = objects.areas || {};
    var area = areas.ABC || areas.main || {};

    var state = {
      sides: {
        a: Number(segmentValue(segments, 'BC')),
        b: Number(segmentValue(segments, 'CA') !== undefined ? segmentValue(segments, 'CA') : segmentValue(segments, 'AC')),
        c: Number(segmentValue(segments, 'AB'))
      },
      pointInputs: {
        A: points.A && points.A.label && points.A.label.visible !== false ? String(points.A.label.text || 'A') : '',
        B: points.B && points.B.label && points.B.label.visible !== false ? String(points.B.label.text || 'B') : '',
        C: points.C && points.C.label && points.C.label.visible !== false ? String(points.C.label.text || 'C') : ''
      },
      sideInputs: {
        a: normalizeLabelInput(segments.BC && segments.BC.label, segmentValue(segments, 'BC')),
        b: normalizeLabelInput((segments.CA || segments.AC) && (segments.CA || segments.AC).label, segmentValue(segments, 'CA') !== undefined ? segmentValue(segments, 'CA') : segmentValue(segments, 'AC')),
        c: normalizeLabelInput(segments.AB && segments.AB.label, segmentValue(segments, 'AB'))
      },
      sideKinds: {
        a: normalizeSideKind(segments.BC),
        b: normalizeSideKind(segments.CA || segments.AC),
        c: normalizeSideKind(segments.AB)
      },
      sideMarkScales: {
        a: normalizeSegmentMarkScale(segments.BC),
        b: normalizeSegmentMarkScale(segments.CA || segments.AC),
        c: normalizeSegmentMarkScale(segments.AB)
      },
      sideArcVisible: {
        a: Boolean(segments.BC && segments.BC.guide && segments.BC.guide.visible),
        b: Boolean((segments.CA || segments.AC) && (segments.CA || segments.AC).guide && (segments.CA || segments.AC).guide.visible),
        c: Boolean(segments.AB && segments.AB.guide && segments.AB.guide.visible)
      },
      angleInputs: {
        A: normalizeLabelInput(angles.A && angles.A.label, angles.A && angles.A.value !== undefined ? angles.A.value + '°' : ''),
        B: normalizeLabelInput(angles.B && angles.B.label, angles.B && angles.B.value !== undefined ? angles.B.value + '°' : ''),
        C: normalizeLabelInput(angles.C && angles.C.label, angles.C && angles.C.value !== undefined ? angles.C.value + '°' : '')
      },
      angleKinds: {
        A: normalizeAngleKind(angles.A),
        B: normalizeAngleKind(angles.B),
        C: normalizeAngleKind(angles.C)
      },
      areaValue: normalizeLabelInput(area.label, ''),
      areaColor: area.fillColor || area.color || '#2a5bd7',
      pointVisible: {},
      pointColors: {},
      sideColors: {},
      angleColors: {},
      labelOffsets: {},
      mathLabelScales: {
        point: {
          A: normalizeLabelScale(points.A && points.A.label, model.display && model.display.labelScale),
          B: normalizeLabelScale(points.B && points.B.label, model.display && model.display.labelScale),
          C: normalizeLabelScale(points.C && points.C.label, model.display && model.display.labelScale)
        }
      },
      decimalPlaces: 2,
      mathLabelScale: 1
    };

    Object.keys(state.sides).forEach(function (side) {
      if (!Number.isFinite(state.sides[side]) || !(state.sides[side] > 0)) {
        throw new Error('Invalid triangle side value: ' + SIDE_TO_SEGMENT[side]);
      }
    });

    Object.keys(SEGMENT_TO_SIDE).forEach(function (segmentId) {
      var side = SEGMENT_TO_SIDE[segmentId];
      if (segmentId === 'AC' && segments.CA) return;
      var segment = segments[segmentId];
      if (segment && segment.stroke && segment.stroke.color) state.sideColors[side] = segment.stroke.color;
    });
    ['A', 'B', 'C'].forEach(function (id) {
      state.pointVisible[id] = !(points[id] && points[id].marker && points[id].marker.visible === false);
      if (points[id] && points[id].marker && points[id].marker.color) state.pointColors[id] = points[id].marker.color;
      if (angles[id] && angles[id].mark && angles[id].mark.stroke && angles[id].mark.stroke.color) state.angleColors[id] = angles[id].mark.stroke.color;
    });

    return state;
  }

  function controlValuesForSingleTriangle(model) {
    var state = stateForSingleTriangle(model);
    return {
      a: String(state.sides.a),
      b: String(state.sides.b),
      c: String(state.sides.c)
    };
  }

  function createTriangleMobilePageConfig(modelOrKey, input, options) {
    var model = ensureFigureModel(modelOrKey, input);
    var initialState = stateForSingleTriangle(model);
    var opts = options || {};
    return {
      readyMessage: opts.readyMessage || 'FigureModelをもとに三角形を描画しています。',
      fileBase: opts.fileBase || 'figure-model-triangle',
      controlInputIds: opts.controlInputIds || { a: 'sideA', b: 'sideB', c: 'sideC' },
      initialState: initialState,
      readControls: function (inputs, parseNatural) {
        return {
          a: parseNatural(inputs.a.value, '辺BC'),
          b: parseNatural(inputs.b.value, '辺CA'),
          c: parseNatural(inputs.c.value, '辺AB')
        };
      },
      applyControlsToState: function (state, parsed) {
        state.sides.a = parsed.a;
        state.sides.b = parsed.b;
        state.sides.c = parsed.c;
      },
      computeGeometry: function (state, parsed, helpers) {
        return helpers.computeTriangleFromSides(parsed.a, parsed.b, parsed.c);
      },
      formatAreaLabel: function (state, geometry, helpers) {
        return helpers.formatHeronAreaFromInputs(state.sides.a, state.sides.b, state.sides.c, state.rawControlInputs);
      },
      sideNumericMode: function () {
        return 'control';
      },
      angleNumericMode: function () {
        return 'readonly';
      },
      updateSideControl: function (id, value, state, inputs) {
        inputs[id].value = String(value);
        state.sides[id] = value;
      },
      updateAngleControl: function () {}
    };
  }

  function renderPlanForTriangleModel(modelOrKey, input) {
    var model = ensureFigureModel(modelOrKey, input);
    if (model.objects && model.objects.figures) {
      return {
        kind: 'triangle-pair',
        status: 'requires-pair-renderer',
        model: model,
        message: 'This FigureModel contains multiple triangles. The current triangle-mobile createPage adapter renders one triangle per stage.'
      };
    }
    return {
      kind: 'triangle-mobile',
      status: 'ready',
      model: model,
      initialState: stateForSingleTriangle(model),
      controlValues: controlValuesForSingleTriangle(model)
    };
  }

  var api = Object.freeze({
    toTriangleMobileInitialState: function (modelOrKey, input) {
      return stateForSingleTriangle(ensureFigureModel(modelOrKey, input));
    },
    toTriangleMobileControlValues: function (modelOrKey, input) {
      return controlValuesForSingleTriangle(ensureFigureModel(modelOrKey, input));
    },
    createTriangleMobilePageConfig: createTriangleMobilePageConfig,
    renderPlanForTriangleModel: renderPlanForTriangleModel,
    constants: Object.freeze({
      RAW_NUMERIC_LABEL_VALUE: RAW_NUMERIC_LABEL_VALUE,
      DECIMAL_NUMERIC_LABEL_VALUE: DECIMAL_NUMERIC_LABEL_VALUE,
      RATIO_LABEL_PREFIX: RATIO_LABEL_PREFIX
    })
  });

  root.InstantGeometryTriangleFigureAdapter = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
