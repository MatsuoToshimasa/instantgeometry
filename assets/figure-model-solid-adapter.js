(function (root) {
  'use strict';

  function isPlainObject(value) {
    return Boolean(value) && Object.prototype.toString.call(value) === '[object Object]';
  }

  function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (isPlainObject(value)) {
      var out = {};
      Object.keys(value).forEach(function (key) {
        out[key] = clone(value[key]);
      });
      return out;
    }
    return value;
  }

  function valueOf(values, id, fallback) {
    if (values && Object.prototype.hasOwnProperty.call(values, id)) return values[id];
    return fallback;
  }

  function control(id, value) {
    return { id: id, value: String(value) };
  }

  function pointInputsFromModel(model) {
    var pointInputs = {};
    var points = model && model.objects && model.objects.points || {};
    Object.keys(points).forEach(function (id) {
      var label = points[id] && points[id].label || {};
      pointInputs[id] = label.visible === false ? '' : String(label.text || id);
    });
    return pointInputs;
  }

  function createSolidMobilePageConfig(model, overrides) {
    var construction = model && model.construction || '';
    var values = model && model.values || {};
    var fileBase = overrides && overrides.fileBase || 'figure-model-solid';
    var initialState = {
      pointInputs: pointInputsFromModel(model)
    };

    if (construction === 'triangularPyramid') {
      return {
        createMethod: 'createTriangularPyramidPage',
        controls: [
          control('ahInput', valueOf(values, 'AH', 7)),
          control('bcInput', valueOf(values, 'BC', 5)),
          control('cdInput', valueOf(values, 'CD', 6)),
          control('dbInput', valueOf(values, 'DB', 7))
        ],
        pageConfig: {
          ahInputId: 'ahInput',
          bcInputId: 'bcInput',
          cdInputId: 'cdInput',
          dbInputId: 'dbInput',
          fileBase: fileBase,
          initialState: initialState
        }
      };
    }

    if (construction === 'quadrangularPyramid') {
      return {
        createMethod: 'createQuadrangularPyramidPage',
        controls: [
          control('bcInput', valueOf(values, 'BC', 5)),
          control('cdInput', valueOf(values, 'CD', 6)),
          control('deInput', valueOf(values, 'DE', 5)),
          control('ebInput', valueOf(values, 'EB', 6)),
          control('ahInput', valueOf(values, 'AH', 7))
        ],
        pageConfig: {
          bcInputId: 'bcInput',
          cdInputId: 'cdInput',
          deInputId: 'deInput',
          ebInputId: 'ebInput',
          ahInputId: 'ahInput',
          fileBase: fileBase,
          initialState: initialState
        }
      };
    }

    if (construction === 'triangularPrism') {
      return {
        createMethod: 'createTriangularPrismPage',
        controls: [
          control('abInput', valueOf(values, 'AB', 5)),
          control('bcInput', valueOf(values, 'BC', 6)),
          control('caInput', valueOf(values, 'CA', 4)),
          control('adInput', valueOf(values, 'AD', 7))
        ],
        pageConfig: {
          abInputId: 'abInput',
          bcInputId: 'bcInput',
          caInputId: 'caInput',
          adInputId: 'adInput',
          fileBase: fileBase,
          initialState: initialState
        }
      };
    }

    if (construction === 'quadrangularPrism' || construction === 'rectangularCuboid') {
      return {
        createMethod: 'createQuadrangularPrismPage',
        controls: [
          control('efInput', valueOf(values, 'EF', construction === 'rectangularCuboid' ? 5 : 4)),
          control('fgInput', valueOf(values, 'FG', construction === 'rectangularCuboid' ? 3 : 5)),
          control('ghInput', valueOf(values, 'GH', construction === 'rectangularCuboid' ? 5 : 4)),
          control('heInput', valueOf(values, 'HE', construction === 'rectangularCuboid' ? 3 : 5)),
          control('aeInput', valueOf(values, 'AE', 7))
        ],
        pageConfig: {
          efInputId: 'efInput',
          fgInputId: 'fgInput',
          ghInputId: 'ghInput',
          heInputId: 'heInput',
          aeInputId: 'aeInput',
          fileBase: fileBase,
          initialState: initialState
        }
      };
    }

    if (construction === 'cube') {
      return {
        createMethod: 'createRegularHexahedronPage',
        controls: [
          control('aInput', valueOf(values, 'a', valueOf(values, 'edge', 6)))
        ],
        pageConfig: {
          aInputId: 'aInput',
          fileBase: fileBase,
          initialState: initialState
        }
      };
    }

    if (construction === 'cone') {
      return {
        createMethod: 'createConePage',
        controls: [
          control('radiusInput', valueOf(values, 'radius', valueOf(values, 'OB', 3))),
          control('heightInput', valueOf(values, 'height', valueOf(values, 'AO', 7)))
        ],
        pageConfig: {
          radiusInputId: 'radiusInput',
          heightInputId: 'heightInput',
          fileBase: fileBase,
          initialState: initialState
        }
      };
    }

    if (construction === 'cylinder') {
      return {
        createMethod: 'createCylinderPage',
        controls: [
          control('radiusInput', valueOf(values, 'radius', valueOf(values, 'OA', 3))),
          control('heightInput', valueOf(values, 'height', valueOf(values, 'AB', 7)))
        ],
        pageConfig: {
          radiusInputId: 'radiusInput',
          heightInputId: 'heightInput',
          heightLabel: '高さAB',
          fileBase: fileBase,
          initialState: initialState
        }
      };
    }

    if (construction === 'conicalFrustum') {
      return {
        createMethod: 'createFrustumRotationPage',
        controls: [
          control('adInput', valueOf(values, 'topRadius', valueOf(values, 'AD', 2))),
          control('cdInput', valueOf(values, 'height', valueOf(values, 'CD', 5))),
          control('bcInput', valueOf(values, 'bottomRadius', valueOf(values, 'BC', 4)))
        ],
        pageConfig: {
          adInputId: 'adInput',
          verticalInputId: 'cdInput',
          bcInputId: 'bcInput',
          fileBase: fileBase,
          initialState: initialState
        }
      };
    }

    throw new Error('Unsupported solid FigureModel construction: ' + construction);
  }

  var api = Object.freeze({
    createSolidMobilePageConfig: createSolidMobilePageConfig,
    adapt: createSolidMobilePageConfig,
    clone: clone
  });

  root.InstantGeometrySolidFigureAdapter = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
