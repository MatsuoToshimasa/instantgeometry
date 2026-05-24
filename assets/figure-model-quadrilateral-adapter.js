(function (root) {
  'use strict';

  var SEGMENT_TO_KIND = Object.freeze({
    'same-length:1': 'single',
    'same-length:2': 'double',
    'same-length:3': 'cross',
    parallel: 'parallel'
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
    if (isPlainObject(modelOrKey) && modelOrKey.model === 'figure.quadrilateral') return modelOrKey;
    var registry = root.InstantGeometryFigureModels || (typeof require === 'function' ? require('./figure-model-standard.js') : null);
    if (!registry || typeof registry.F !== 'function') {
      throw new Error('InstantGeometryFigureModels.F is required.');
    }
    return registry.F(modelOrKey, input || {});
  }

  function normalizeLabelInput(label, fallbackValue) {
    if (!label || label.visible === false || label.mode === 'hidden') return '';
    if (label.mode === 'space') return ' ';
    if (label.valueMode === 'raw' || label.mode === 'numeric') return ' ';
    if (label.text !== undefined && label.text !== null) return String(label.text);
    return fallbackValue !== undefined && fallbackValue !== null ? String(fallbackValue) : '';
  }

  function normalizeSideKind(segment) {
    if (!segment || segment.visible === false) return 'hidden';
    if (segment.stroke && segment.stroke.style === 'hidden') return 'hidden';
    if (segment.relationMark && segment.relationMark.visible !== false) {
      if (segment.relationMark.kind === 'parallel' || segment.relationMark.kind === 'parallel-two' || segment.relationMark.kind === 'parallel-three') {
        var suffix = segment.relationMark.direction === 'reverse' ? '-reverse' : '';
        return segment.relationMark.kind + suffix;
      }
      if (segment.relationMark.kind === 'same-length') {
        return SEGMENT_TO_KIND['same-length:' + (segment.relationMark.index || 1)] || 'single';
      }
    }
    return segment.kind || 'plain';
  }

  function normalizeAngleKind(angle) {
    if (!angle || angle.visible === false || !angle.mark || angle.mark.visible === false) return 'hidden';
    return angle.mark.kind === 'right' ? 'right' : (angle.kind || 'plain');
  }

  function segmentValue(segments, id) {
    var segment = segments[id];
    return segment && segment.value !== undefined ? segment.value : undefined;
  }

  function stateForQuadrilateral(model) {
    if (!model || model.model !== 'figure.quadrilateral') {
      throw new Error('figure.quadrilateral model is required.');
    }
    var objects = model.objects || {};
    var points = objects.points || {};
    var segments = objects.segments || {};
    var angles = objects.angles || {};
    var areas = objects.areas || {};
    var area = areas.ABCD || areas.main || {};
    var sideIds = ['AB', 'BC', 'CD', 'DA'];
    var angleIds = ['A', 'B', 'C', 'D'];
    var pointIds = ['A', 'B', 'C', 'D'];
    var state = {
      pointInputs: {},
      pointVisible: {},
      sides: {},
      sideInputs: {},
      sideKinds: {},
      sideArcVisible: {},
      angleInputs: {},
      angleKinds: {},
      areaValue: normalizeLabelInput(area.label, ''),
      areaColor: area.fillColor || area.color || '#2a5bd7',
      labelOffsets: {}
    };
    pointIds.forEach(function (id) {
      state.pointInputs[id] = points[id] && points[id].label && points[id].label.visible !== false
        ? String(points[id].label.text || id)
        : '';
      state.pointVisible[id] = !(points[id] && points[id].marker && points[id].marker.visible === false);
    });
    sideIds.forEach(function (id) {
      state.sides[id] = Number(segmentValue(segments, id)) || 0;
      state.sideInputs[id] = normalizeLabelInput(segments[id] && segments[id].label, segmentValue(segments, id));
      state.sideKinds[id] = normalizeSideKind(segments[id]);
      state.sideArcVisible[id] = Boolean(segments[id] && segments[id].guide && segments[id].guide.visible);
    });
    angleIds.forEach(function (id) {
      state.angleInputs[id] = normalizeLabelInput(angles[id] && angles[id].label, angles[id] && angles[id].value !== undefined ? angles[id].value + '°' : '');
      state.angleKinds[id] = normalizeAngleKind(angles[id]);
    });
    return state;
  }

  function geometryPointsForModel(model) {
    var points = model.objects && model.objects.geometry && model.objects.geometry.points;
    if (!points) throw new Error('figure.quadrilateral geometry points are required.');
    return clone(points);
  }

  function createQuadrilateralMobilePageConfig(modelOrKey, input, options) {
    var model = ensureFigureModel(modelOrKey, input);
    var opts = options || {};
    return {
      readyMessage: opts.readyMessage || 'FigureModelをもとに四角形を描画しています。',
      fileBase: opts.fileBase || 'figure-model-quadrilateral',
      pointLabelFontSize: Number.isFinite(opts.pointLabelFontSize) ? opts.pointLabelFontSize : 48,
      controlInputIds: opts.controlInputIds || {},
      initialState: stateForQuadrilateral(model),
      readControls: function () {
        return clone(model.values || {});
      },
      applyControlsToState: function () {},
      computeGeometry: function (state, parsed, helpers) {
        return helpers.finalizeGeometry(geometryPointsForModel(model));
      },
      sideNumericMode: function () {
        return 'readonly';
      },
      angleNumericMode: function () {
        return 'readonly';
      },
      updateSideControl: function () {},
      updateAngleControl: function () {}
    };
  }

  var api = Object.freeze({
    createQuadrilateralMobilePageConfig: createQuadrilateralMobilePageConfig,
    stateForQuadrilateral: stateForQuadrilateral
  });

  root.InstantGeometryQuadrilateralFigureAdapter = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
