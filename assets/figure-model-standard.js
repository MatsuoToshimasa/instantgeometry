(function (root) {
  'use strict';

  var SCHEMA_VERSION = '2026-05-23.figure-model.standard.v1';

  var DEFAULT_STYLE = Object.freeze({
    segment: {
      color: '#2a5bd7',
      width: 4,
      style: 'solid'
    },
    guide: {
      color: '#687086',
      width: 3,
      style: 'solid'
    },
    point: {
      color: '#1f2937',
      radius: 8
    },
    area: {
      fill: 'rgba(42, 91, 215, 0.08)'
    },
    label: {
      color: '#1f2937',
      size: 1,
      mode: 'text',
      valueMode: 'text',
      decimalPlaces: 2,
      katex: true,
      offset: { dx: 0, dy: 0 }
    }
  });

  var PRESETS = Object.freeze({
    'learn.definition': {
      display: {
        points: true,
        pointLabels: true,
        segments: true,
        segmentLabels: false,
        angles: false,
        angleLabels: false,
        areaFill: true,
        areaLabel: false,
        volumeLabel: false,
        guides: false
      },
      layout: { mode: 'single', fit: 'center', aspectRatio: '1:1', padding: 80 }
    },
    'learn.condition': {
      display: {
        points: true,
        pointLabels: true,
        segments: true,
        segmentLabels: false,
        givenSegmentLabels: true,
        angles: true,
        angleLabels: false,
        givenAngleLabels: true,
        areaFill: true,
        areaLabel: false,
        guides: true
      },
      layout: { mode: 'pair', fit: 'center', aspectRatio: '1:1', padding: 70 }
    },
    'learn.property': {
      display: {
        points: true,
        pointLabels: true,
        segments: true,
        segmentLabels: false,
        angles: true,
        angleLabels: false,
        areaFill: true,
        areaLabel: false,
        guides: true
      },
      layout: { mode: 'single', fit: 'center', aspectRatio: '1:1', padding: 80 }
    },
    'learn.formula': {
      display: {
        points: true,
        pointLabels: true,
        segments: true,
        segmentLabels: true,
        angles: true,
        angleLabels: false,
        areaFill: true,
        areaLabel: false,
        guides: true
      },
      layout: { mode: 'single', fit: 'center', aspectRatio: '1:1', padding: 80 }
    },
    'learn.typical-example': {
      display: {
        points: true,
        pointLabels: true,
        segments: true,
        segmentLabels: true,
        angles: true,
        angleLabels: false,
        areaFill: true,
        areaLabel: false,
        guides: true
      },
      layout: { mode: 'single', fit: 'center', aspectRatio: '1:1', padding: 80 }
    }
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
        if (isPlainObject(value) && isPlainObject(output[key])) {
          output[key] = mergeDeep(output[key], value);
        } else {
          output[key] = clone(value);
        }
      });
    });
    return output;
  }

  function normalizeModelKey(modelKey, input) {
    var parts = String(modelKey || 'triangle').split('.').filter(Boolean);
    var shape = parts[0] || 'triangle';
    if (shape !== 'triangle' && shape !== 'quadrilateral' && shape !== 'solid') {
      throw new Error('Unsupported FigureModel shape: ' + shape);
    }

    if (shape === 'solid') {
      return {
        shape: shape,
        variant: input.variant || parts[1] || 'solid',
        purpose: input.purpose || (parts[2] === 'definition' ? 'definition' : parts[2] || 'definition'),
        construction: input.construction || parts[1] || 'solid',
        condition: input.condition || null
      };
    }

    if (shape === 'quadrilateral') {
      return {
        shape: shape,
        variant: input.variant || parts[1] || 'general',
        purpose: input.purpose || (parts[2] === 'definition' ? 'definition' : parts[2] || 'definition'),
        construction: input.construction || parts[1] || 'quadrilateral',
        condition: input.condition || null
      };
    }

    var variant = input.variant || 'general';
    var purpose = input.purpose || '';
    var construction = input.construction || '';
    var condition = input.condition || '';

    if (parts[1] === 'definition') {
      purpose = purpose || 'definition';
    } else if (parts[1] === 'congruence') {
      variant = input.variant || 'congruence';
      purpose = purpose || 'condition';
      condition = condition || parts[2] || '';
      construction = construction || condition || 'sas';
    } else if (parts[1]) {
      construction = construction || parts[1];
    }

    if (input.condition) condition = input.condition;
    if (!purpose) {
      purpose = variant === 'congruence' ? 'condition' : 'definition';
    }
    if (!construction) {
      if (variant === 'rightRatio') construction = 'ratio';
      else if (variant === 'right') construction = 'right';
      else if (variant === 'isosceles') construction = 'isosceles';
      else if (variant === 'equilateral') construction = 'equilateral';
      else construction = 'sss';
    }

    return {
      shape: shape,
      variant: variant,
      purpose: purpose,
      construction: construction,
      condition: condition || null
    };
  }

  function labelState(visible, text, extra) {
    return mergeDeep(DEFAULT_STYLE.label, {
      visible: Boolean(visible),
      mode: visible ? 'text' : 'hidden',
      text: text || ''
    }, extra || {});
  }

  function pointState(id, display, extra) {
    return mergeDeep({
      id: id,
      visible: display.points !== false,
      marker: mergeDeep(DEFAULT_STYLE.point, { visible: display.points !== false }),
      label: labelState(display.pointLabels !== false, id, {
        size: display.pointLabelScale || display.labelScale || DEFAULT_STYLE.label.size
      }),
      roles: ['vertex']
    }, extra || {});
  }

  function segmentState(id, value, display, extra) {
    var showLabel = display.segmentLabels === true;
    return mergeDeep({
      id: id,
      visible: display.segments !== false,
      value: value,
      stroke: DEFAULT_STYLE.segment,
      label: labelState(showLabel, value === undefined ? '' : String(value), {
        valueMode: typeof value === 'number' ? 'decimal' : 'text'
      }),
      guide: {
        visible: Boolean(display.guides && showLabel),
        kind: 'measure-arc'
      },
      roles: ['side']
    }, extra || {});
  }

  function angleState(id, value, display, extra) {
    var showAngle = display.angles === true;
    var showLabel = display.angleLabels === true;
    return mergeDeep({
      id: id,
      visible: showAngle,
      value: value,
      mark: {
        visible: showAngle,
        kind: value === 90 ? 'right' : 'arc',
        stroke: DEFAULT_STYLE.guide
      },
      label: labelState(showLabel, value === undefined ? '' : String(value) + '°', {
        valueMode: typeof value === 'number' ? 'decimal' : 'text'
      }),
      roles: ['angle']
    }, extra || {});
  }

  function areaState(id, display, extra) {
    return mergeDeep({
      id: id,
      visible: display.areaFill !== false,
      fill: DEFAULT_STYLE.area.fill,
      label: labelState(display.areaLabel === true, ''),
      roles: ['interior']
    }, extra || {});
  }

  function volumeState(id, display, extra) {
    return mergeDeep({
      id: id,
      visible: display.volume !== false,
      label: labelState(display.volumeLabel === true, ''),
      roles: ['solid']
    }, extra || {});
  }

  function valueOf(values, id, fallback) {
    if (values && Object.prototype.hasOwnProperty.call(values, id)) return values[id];
    return fallback;
  }

  function clamp(value, min, max) {
    var number = Number(value);
    if (!Number.isFinite(number)) return min;
    return Math.max(min, Math.min(max, number));
  }

  function estimateSegmentMarkCongestion(display) {
    var score = 0;
    if (display.pointLabels !== false) score += 0.18;
    if (display.segmentLabels === true || display.givenSegmentLabels === true) score += 0.24;
    if (display.angles === true) score += 0.18;
    if (display.angleLabels === true || display.givenAngleLabels === true) score += 0.2;
    if (display.guides === true) score += 0.2;
    return clamp(score, 0, 1);
  }

  function segmentMarkScale(display) {
    if (display.segmentMarkScale !== undefined) return clamp(display.segmentMarkScale, 0.55, 2.2);
    var congestion = display.segmentMarkCongestion !== undefined
      ? clamp(display.segmentMarkCongestion, 0, 1)
      : estimateSegmentMarkCongestion(display || {});
    return clamp(1.65 - congestion * 0.65, 0.75, 1.65);
  }

  function buildSingleTriangleObjects(values, display, meta) {
    var segmentValues = {
      AB: valueOf(values, 'AB', valueOf(values, 'c', undefined)),
      BC: valueOf(values, 'BC', valueOf(values, 'a', undefined)),
      CA: valueOf(values, 'CA', valueOf(values, 'b', undefined))
    };
    var angles = {
      A: valueOf(values, 'angleA', undefined),
      B: valueOf(values, 'angleB', undefined),
      C: valueOf(values, 'angleC', undefined)
    };

    var rightAngleAt = null;
    if (meta.variant === 'right' || meta.variant === 'rightRatio') {
      rightAngleAt = valueOf(values, 'rightAngleAt', 'A');
      angles.A = rightAngleAt === 'A' ? 90 : angles.A;
      angles.B = rightAngleAt === 'B' ? 90 : angles.B;
      angles.C = rightAngleAt === 'C' ? 90 : angles.C;
    }
    if (meta.variant === 'rightRatio' && Array.isArray(values.ratio)) {
      segmentValues.CA = values.ratio[0];
      segmentValues.AB = values.ratio[1];
      segmentValues.BC = values.ratio[2];
    }
    if (meta.variant === 'isosceles') {
      var equalSides = valueOf(values, 'equalSides', undefined);
      if (equalSides !== undefined) {
        segmentValues.CA = equalSides;
        segmentValues.AB = equalSides;
      }
      segmentValues.BC = valueOf(values, 'base', segmentValues.BC);
    }
    if (meta.variant === 'equilateral') {
      var side = valueOf(values, 'side', segmentValues.AB || segmentValues.BC || segmentValues.CA);
      segmentValues.AB = side;
      segmentValues.BC = side;
      segmentValues.CA = side;
    }

    var segments = {
      AB: segmentState('AB', segmentValues.AB, display),
      BC: segmentState('BC', segmentValues.BC, display),
      CA: segmentState('CA', segmentValues.CA, display)
    };
    var angleObjects = {
      A: angleState('A', angles.A, rightAngleAt && rightAngleAt !== 'A' && angles.A === undefined ? mergeDeep(display, { angles: false, angleLabels: false }) : display),
      B: angleState('B', angles.B, rightAngleAt && rightAngleAt !== 'B' && angles.B === undefined ? mergeDeep(display, { angles: false, angleLabels: false }) : display),
      C: angleState('C', angles.C, rightAngleAt && rightAngleAt !== 'C' && angles.C === undefined ? mergeDeep(display, { angles: false, angleLabels: false }) : display)
    };

    if (meta.variant === 'isosceles' && display.relationMarks !== false) {
      segments.CA = mergeDeep(segments.CA, { relationMark: { visible: true, kind: 'same-length', index: 1, scale: segmentMarkScale(display) } });
      segments.AB = mergeDeep(segments.AB, { relationMark: { visible: true, kind: 'same-length', index: 1, scale: segmentMarkScale(display) } });
    }
    if (meta.variant === 'equilateral' && display.relationMarks !== false) {
      segments.AB = mergeDeep(segments.AB, { relationMark: { visible: true, kind: 'same-length', index: 1, scale: segmentMarkScale(display) } });
      segments.BC = mergeDeep(segments.BC, { relationMark: { visible: true, kind: 'same-length', index: 1, scale: segmentMarkScale(display) } });
      segments.CA = mergeDeep(segments.CA, { relationMark: { visible: true, kind: 'same-length', index: 1, scale: segmentMarkScale(display) } });
    }

    return {
      points: {
        A: pointState('A', display),
        B: pointState('B', display),
        C: pointState('C', display)
      },
      segments: segments,
      angles: angleObjects,
      areas: {
        ABC: areaState('ABC', display)
      }
    };
  }

  function quadrilateralPointMap(kind, values) {
    var width = valueOf(values, 'width', 7);
    var height = valueOf(values, 'height', 5);
    var side = valueOf(values, 'side', 6);
    var topBase = valueOf(values, 'topBase', 4);
    var bottomBase = valueOf(values, 'bottomBase', 8);
    var shift = valueOf(values, 'shift', 1.5);
    var slant = valueOf(values, 'slant', 2.4);
    if (kind === 'rectangle') {
      return {
        A: { x: -width / 2, y: height / 2 },
        B: { x: -width / 2, y: -height / 2 },
        C: { x: width / 2, y: -height / 2 },
        D: { x: width / 2, y: height / 2 }
      };
    }
    if (kind === 'square') {
      return {
        A: { x: -side / 2, y: side / 2 },
        B: { x: -side / 2, y: -side / 2 },
        C: { x: side / 2, y: -side / 2 },
        D: { x: side / 2, y: side / 2 }
      };
    }
    if (kind === 'rhombus') {
      return {
        A: { x: -side / 2, y: 0 },
        B: { x: 0, y: -slant },
        C: { x: side / 2, y: 0 },
        D: { x: 0, y: slant }
      };
    }
    if (kind === 'trapezoid') {
      return {
        A: { x: (-topBase / 2) + (shift / 2), y: height / 2 },
        B: { x: -bottomBase / 2, y: -height / 2 },
        C: { x: bottomBase / 2, y: -height / 2 },
        D: { x: (topBase / 2) + (shift / 2), y: height / 2 }
      };
    }
    return {
      A: { x: -3, y: 2 },
      B: { x: -4, y: -2 },
      C: { x: 3, y: -2 },
      D: { x: 4, y: 2 }
    };
  }

  function distance(a, b) {
    return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
  }

  function buildQuadrilateralObjects(values, display, meta) {
    var kind = meta.variant || meta.construction || 'quadrilateral';
    var points = quadrilateralPointMap(kind, values || {});
    var showRightAngles = kind === 'rectangle' || kind === 'square';
    var segments = {
      AB: segmentState('AB', distance(points.A, points.B), display),
      BC: segmentState('BC', distance(points.B, points.C), display),
      CD: segmentState('CD', distance(points.C, points.D), display),
      DA: segmentState('DA', distance(points.D, points.A), display)
    };
    var angles = {
      A: angleState('A', showRightAngles ? 90 : undefined, mergeDeep(display, { angles: showRightAngles, angleLabels: false })),
      B: angleState('B', showRightAngles ? 90 : undefined, mergeDeep(display, { angles: showRightAngles, angleLabels: false })),
      C: angleState('C', showRightAngles ? 90 : undefined, mergeDeep(display, { angles: showRightAngles, angleLabels: false })),
      D: angleState('D', showRightAngles ? 90 : undefined, mergeDeep(display, { angles: showRightAngles, angleLabels: false }))
    };
    if (kind === 'rhombus' || kind === 'square') {
      ['AB', 'BC', 'CD', 'DA'].forEach(function (id) {
        segments[id] = mergeDeep(segments[id], {
          relationMark: { visible: true, kind: 'same-length', index: 1, scale: segmentMarkScale(display) }
        });
      });
    }
    if (kind === 'trapezoid' || kind === 'parallelogram') {
      segments.BC = mergeDeep(segments.BC, {
        relationMark: { visible: true, kind: 'parallel', direction: 'forward', scale: segmentMarkScale(display) }
      });
      segments.DA = mergeDeep(segments.DA, {
        relationMark: { visible: true, kind: 'parallel', direction: 'reverse', scale: segmentMarkScale(display) }
      });
    }
    if (kind === 'parallelogram') {
      segments.AB = mergeDeep(segments.AB, {
        relationMark: { visible: true, kind: 'parallel-two', direction: 'forward', scale: segmentMarkScale(display) }
      });
      segments.CD = mergeDeep(segments.CD, {
        relationMark: { visible: true, kind: 'parallel-two', direction: 'reverse', scale: segmentMarkScale(display) }
      });
    }
    return {
      points: {
        A: pointState('A', display),
        B: pointState('B', display),
        C: pointState('C', display),
        D: pointState('D', display)
      },
      segments: segments,
      angles: angles,
      areas: {
        ABCD: areaState('ABCD', display)
      },
      geometry: {
        points: points
      }
    };
  }

  function solidPointStates(ids, display, rolesById) {
    var points = {};
    ids.forEach(function (id) {
      points[id] = pointState(id, display, { roles: rolesById && rolesById[id] || ['vertex'] });
    });
    return points;
  }

  function solidSegmentStates(ids, values, display, rolesById) {
    var segments = {};
    ids.forEach(function (id) {
      segments[id] = segmentState(id, valueOf(values, id, undefined), display, {
        roles: rolesById && rolesById[id] || ['side']
      });
    });
    return segments;
  }

  function solidAreaStates(ids, display, rolesById) {
    var areas = {};
    ids.forEach(function (id) {
      areas[id] = areaState(id, display, {
        roles: rolesById && rolesById[id] || ['interior']
      });
    });
    return areas;
  }

  function rangeChars(startCode, count) {
    var ids = [];
    for (var index = 0; index < count; index += 1) {
      ids.push(String.fromCharCode(startCode + index));
    }
    return ids;
  }

  function buildPolygonalPyramidObjects(values, display, sides) {
    var baseIds = rangeChars(66, sides);
    var pointIds = ['A'].concat(baseIds, ['H']);
    var baseFace = baseIds.join('');
    var baseEdges = baseIds.map(function (id, index) {
      return id + baseIds[(index + 1) % baseIds.length];
    });
    var lateralEdges = baseIds.map(function (id) { return 'A' + id; });
    var faces = [baseFace].concat(baseIds.map(function (id, index) {
      return 'A' + id + baseIds[(index + 1) % baseIds.length];
    }));
    return {
      points: solidPointStates(pointIds, display, { H: ['point'] }),
      segments: solidSegmentStates(['AH'].concat(baseEdges, lateralEdges), values, display, { AH: ['height'] }),
      areas: solidAreaStates(faces, display, (function () {
        var roles = {};
        roles[baseFace] = ['base'];
        return roles;
      })()),
      volumes: { main: volumeState('main', display) },
      topology: {
        vertices: ['A'].concat(baseIds),
        auxiliaryPoints: ['H'],
        edges: lateralEdges.concat(baseEdges),
        height: 'AH',
        baseFace: baseFace,
        faces: faces
      }
    };
  }

  function buildPolygonalPrismObjects(values, display, sides) {
    var topIds = rangeChars(65, sides);
    var bottomIds = rangeChars(65 + sides, sides);
    var topFace = topIds.join('');
    var bottomFace = bottomIds.join('');
    var topEdges = topIds.map(function (id, index) {
      return id + topIds[(index + 1) % topIds.length];
    });
    var bottomEdges = bottomIds.map(function (id, index) {
      return id + bottomIds[(index + 1) % bottomIds.length];
    });
    var sideEdges = topIds.map(function (id, index) {
      return id + bottomIds[index];
    });
    var lateralFaces = topIds.map(function (id, index) {
      return id + topIds[(index + 1) % topIds.length] + bottomIds[(index + 1) % bottomIds.length] + bottomIds[index];
    });
    var faces = [topFace, bottomFace].concat(lateralFaces);
    var heightRoles = sideEdges.reduce(function (roles, id) {
      roles[id] = ['height'];
      return roles;
    }, {});
    return {
      points: solidPointStates(topIds.concat(bottomIds), display),
      segments: solidSegmentStates(topEdges.concat(bottomEdges, sideEdges), values, display, heightRoles),
      areas: solidAreaStates(faces, display, (function () {
        var roles = {};
        roles[topFace] = ['base'];
        roles[bottomFace] = ['base'];
        return roles;
      })()),
      volumes: { main: volumeState('main', display) },
      topology: {
        vertices: topIds.concat(bottomIds),
        edges: topEdges.concat(bottomEdges, sideEdges),
        baseFaces: [topFace, bottomFace],
        faces: faces
      }
    };
  }

  function buildSolidObjects(values, display, meta) {
    var kind = meta.variant || meta.construction || 'solid';
    if (kind === 'triangularPyramid') {
      return {
        points: solidPointStates(['A', 'B', 'C', 'D', 'H'], display, { H: ['point'] }),
        segments: solidSegmentStates(['AH', 'BC', 'CD', 'DB', 'AB', 'AC', 'AD'], values, display, { AH: ['height'] }),
        areas: solidAreaStates(['BCD', 'ABC', 'ACD', 'ADB'], display, { BCD: ['base'] }),
        volumes: { main: volumeState('main', display) },
        topology: {
          vertices: ['A', 'B', 'C', 'D'],
          auxiliaryPoints: ['H'],
          edges: ['AB', 'AC', 'AD', 'BC', 'CD', 'DB'],
          height: 'AH',
          baseFace: 'BCD',
          faces: ['BCD', 'ABC', 'ACD', 'ADB']
        }
      };
    }
    if (kind === 'quadrangularPyramid') {
      return {
        points: solidPointStates(['A', 'B', 'C', 'D', 'E', 'H'], display, { H: ['point'] }),
        segments: solidSegmentStates(['AH', 'BC', 'CD', 'DE', 'EB', 'AB', 'AC', 'AD', 'AE'], values, display, { AH: ['height'] }),
        areas: solidAreaStates(['BCDE', 'ABC', 'ACD', 'ADE', 'AEB'], display, { BCDE: ['base'] }),
        volumes: { main: volumeState('main', display) },
        topology: {
          vertices: ['A', 'B', 'C', 'D', 'E'],
          auxiliaryPoints: ['H'],
          edges: ['AB', 'AC', 'AD', 'AE', 'BC', 'CD', 'DE', 'EB'],
          height: 'AH',
          baseFace: 'BCDE',
          faces: ['BCDE', 'ABC', 'ACD', 'ADE', 'AEB']
        }
      };
    }
    if (kind === 'pentagonalPyramid') return buildPolygonalPyramidObjects(values, display, 5);
    if (kind === 'hexagonalPyramid') return buildPolygonalPyramidObjects(values, display, 6);
    if (kind === 'triangularPrism') {
      return {
        points: solidPointStates(['A', 'B', 'C', 'D', 'E', 'F'], display),
        segments: solidSegmentStates(['AB', 'BC', 'CA', 'AD', 'BE', 'CF', 'DE', 'EF', 'FD'], values, display, { AD: ['height'], BE: ['height'], CF: ['height'] }),
        areas: solidAreaStates(['ABC', 'DEF', 'ABED', 'BCFE', 'CAFD'], display, { ABC: ['base'], DEF: ['base'] }),
        volumes: { main: volumeState('main', display) },
        topology: {
          vertices: ['A', 'B', 'C', 'D', 'E', 'F'],
          edges: ['AB', 'BC', 'CA', 'AD', 'BE', 'CF', 'DE', 'EF', 'FD'],
          baseFaces: ['ABC', 'DEF'],
          faces: ['ABC', 'DEF', 'ABED', 'BCFE', 'CAFD']
        }
      };
    }
    if (kind === 'pentagonalPrism') return buildPolygonalPrismObjects(values, display, 5);
    if (kind === 'hexagonalPrism') return buildPolygonalPrismObjects(values, display, 6);
    if (kind === 'quadrangularPrism' || kind === 'rectangularCuboid') {
      return {
        points: solidPointStates(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], display),
        segments: solidSegmentStates(['EF', 'FG', 'GH', 'HE', 'AE', 'AB', 'BC', 'CD', 'DA', 'BF', 'CG', 'DH'], values, display, { AE: ['height'], BF: ['height'], CG: ['height'], DH: ['height'] }),
        areas: solidAreaStates(['ABCD', 'EFGH', 'ABFE', 'BCGF', 'CDHG', 'DAEH'], display, { ABCD: ['base'], EFGH: ['base'] }),
        volumes: { main: volumeState('main', display) },
        topology: {
          vertices: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
          edges: ['EF', 'FG', 'GH', 'HE', 'AE', 'AB', 'BC', 'CD', 'DA', 'BF', 'CG', 'DH'],
          baseFaces: ['ABCD', 'EFGH'],
          faces: ['ABCD', 'EFGH', 'ABFE', 'BCGF', 'CDHG', 'DAEH']
        }
      };
    }
    if (kind === 'cube') {
      return {
        points: solidPointStates(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], display),
        segments: solidSegmentStates(['AB', 'BC', 'CD', 'DA', 'EF', 'FG', 'GH', 'HE', 'AE', 'BF', 'CG', 'DH'], { AB: valueOf(values, 'a', valueOf(values, 'edge', 6)) }, display),
        areas: solidAreaStates(['ABCD', 'EFGH', 'ABFE', 'BCGF', 'CDHG', 'DAEH'], display),
        volumes: { main: volumeState('main', display) },
        topology: {
          vertices: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
          edges: ['AB', 'BC', 'CD', 'DA', 'EF', 'FG', 'GH', 'HE', 'AE', 'BF', 'CG', 'DH'],
          faces: ['ABCD', 'EFGH', 'ABFE', 'BCGF', 'CDHG', 'DAEH']
        }
      };
    }
    if (kind === 'cone') {
      return {
        points: solidPointStates(['A', 'O', 'B', 'C'], display, { O: ['center'] }),
        segments: solidSegmentStates(['AO', 'OB', 'OC', 'AB', 'AC'], values, display, { AO: ['height'], OB: ['radius'], OC: ['radius'] }),
        areas: solidAreaStates(['base', 'side'], display, { base: ['base'] }),
        volumes: { main: volumeState('main', display) },
        topology: {
          apex: 'A',
          baseCenter: 'O',
          baseRadii: ['OB', 'OC'],
          height: 'AO',
          faces: ['base', 'side']
        }
      };
    }
    if (kind === 'cylinder') {
      return {
        points: solidPointStates(['O', 'A', 'B', 'Op', 'C', 'D'], display, { O: ['center'], Op: ['center'] }),
        segments: solidSegmentStates(['OA', 'AB', 'CD', 'OpC', 'OpB', 'OD'], values, display, { OA: ['radius'], OpC: ['radius'], OpB: ['radius'], AB: ['height'], CD: ['height'] }),
        areas: solidAreaStates(['bottomBase', 'topBase', 'side'], display, { bottomBase: ['base'], topBase: ['base'] }),
        volumes: { main: volumeState('main', display) },
        topology: {
          baseCenters: ['O', 'Op'],
          radii: ['OA', 'OpC', 'OpB'],
          heights: ['AB', 'CD'],
          faces: ['bottomBase', 'topBase', 'side']
        }
      };
    }
    if (kind === 'conicalFrustum') {
      return {
        points: solidPointStates(['A', 'B', 'C', 'D', 'O', 'Op'], display, { O: ['center'], Op: ['center'] }),
        segments: solidSegmentStates(['AD', 'CD', 'BC', 'AB'], values, display, { AD: ['radius'], BC: ['radius'], CD: ['height'] }),
        areas: solidAreaStates(['bottomBase', 'topBase', 'side'], display, { bottomBase: ['base'], topBase: ['base'] }),
        volumes: { main: volumeState('main', display) },
        topology: {
          radii: ['AD', 'BC'],
          height: 'CD',
          faces: ['bottomBase', 'topBase', 'side']
        }
      };
    }
    return {
      points: {},
      segments: {},
      areas: {},
      volumes: { main: volumeState('main', display) },
      topology: {}
    };
  }

  function applyQuadrilateralModal(objects, modal) {
    var sides = modal && (modal.sides || modal.segments);
    if (!isPlainObject(sides) || !objects || !objects.segments) return objects;
    Object.keys(sides).forEach(function (id) {
      if (!objects.segments[id]) return;
      var input = sides[id] || {};
      if (input.mode === 'hidden') {
        objects.segments[id] = mergeDeep(objects.segments[id], {
          label: { visible: false, mode: 'hidden', text: '' },
          guide: { visible: false }
        });
        return;
      }
      var text = input.text !== undefined && input.text !== null
        ? String(input.text)
        : (input.value !== undefined && input.value !== null ? String(input.value) : '');
      objects.segments[id] = mergeDeep(objects.segments[id], {
        label: {
          visible: input.visible !== false,
          mode: input.mode || 'freeText',
          valueMode: input.valueMode || 'text',
          text: text,
          color: input.color || DEFAULT_STYLE.segment.color
        },
        guide: {
          visible: Boolean(input.guide),
          kind: input.guideKind || 'measure-arc'
        }
      });
    });
    return objects;
  }

  function givenSegment(id, value, display, markIndex) {
    return segmentState(id, value, mergeDeep(display, { segmentLabels: Boolean(display.givenSegmentLabels) }), {
      relationMark: { visible: true, kind: 'same-length', index: markIndex || 1, scale: segmentMarkScale(display) },
      guide: { visible: Boolean(display.guides), kind: 'given-side' }
    });
  }

  function hiddenSegment(id, value, display) {
    return segmentState(id, value, mergeDeep(display, { segmentLabels: false }), {
      guide: { visible: false }
    });
  }

  function givenAngle(id, value, display, markIndex) {
    return angleState(id, value, mergeDeep(display, { angles: true, angleLabels: Boolean(display.givenAngleLabels) }), {
      relationMark: { visible: true, kind: 'same-angle', index: markIndex || 1 },
      mark: { visible: true, kind: value === 90 ? 'right' : 'arc', stroke: DEFAULT_STYLE.guide }
    });
  }

  function hiddenAngle(id, value, display) {
    return angleState(id, value, mergeDeep(display, { angles: false, angleLabels: false }));
  }

  function buildCongruenceObjects(values, display, meta) {
    var condition = meta.condition || meta.construction || 'sas';
    var source = isPlainObject(values.first) ? values.first : values;
    var side1 = valueOf(source, 'side1', valueOf(source, 'AB', 6));
    var side2 = valueOf(source, 'side2', valueOf(source, 'AC', valueOf(source, 'CA', 5)));
    var side3 = valueOf(source, 'side3', valueOf(source, 'BC', 7));
    var includedAngle = valueOf(source, 'includedAngle', valueOf(source, 'angleA', 50));
    var baseAngleLeft = valueOf(source, 'angleA', 50);
    var baseAngleRight = valueOf(source, 'angleB', 60);

    var first = {
      points: {
        A: pointState('A', display),
        B: pointState('B', display),
        C: pointState('C', display)
      },
      segments: {
        AB: hiddenSegment('AB', side1, display),
        AC: hiddenSegment('AC', side2, display),
        BC: hiddenSegment('BC', side3, display)
      },
      angles: {
        A: hiddenAngle('A', includedAngle, display),
        B: hiddenAngle('B', baseAngleRight, display),
        C: hiddenAngle('C', undefined, display)
      },
      areas: { ABC: areaState('ABC', display) }
    };
    var second = {
      points: {
        D: pointState('D', display),
        E: pointState('E', display),
        F: pointState('F', display)
      },
      segments: {
        DE: hiddenSegment('DE', side1, display),
        DF: hiddenSegment('DF', side2, display),
        EF: hiddenSegment('EF', side3, display)
      },
      angles: {
        D: hiddenAngle('D', includedAngle, display),
        E: hiddenAngle('E', baseAngleRight, display),
        F: hiddenAngle('F', undefined, display)
      },
      areas: { DEF: areaState('DEF', display) }
    };

    if (condition === 'sas' && !valueOf(source, 'side3', valueOf(source, 'BC', null))) {
      var angleRadians = Number(includedAngle) * Math.PI / 180;
      var computedSide = Math.sqrt(Math.max(0, side1 * side1 + side2 * side2 - 2 * side1 * side2 * Math.cos(angleRadians)));
      first.segments.BC.value = computedSide;
      second.segments.EF.value = computedSide;
    }

    var pairs = {
      points: { A: 'D', B: 'E', C: 'F' },
      segments: {},
      angles: {}
    };

    if (condition === 'sss') {
      first.segments.AB = givenSegment('AB', side1, display, 1);
      first.segments.AC = givenSegment('AC', side2, display, 2);
      first.segments.BC = givenSegment('BC', side3, display, 3);
      second.segments.DE = givenSegment('DE', side1, display, 1);
      second.segments.DF = givenSegment('DF', side2, display, 2);
      second.segments.EF = givenSegment('EF', side3, display, 3);
      pairs.segments = { AB: 'DE', AC: 'DF', BC: 'EF' };
    } else if (condition === 'asa') {
      first.segments.AB = givenSegment('AB', side1, display, 1);
      second.segments.DE = givenSegment('DE', side1, display, 1);
      first.angles.A = givenAngle('A', baseAngleLeft, display, 1);
      first.angles.B = givenAngle('B', baseAngleRight, display, 2);
      second.angles.D = givenAngle('D', baseAngleLeft, display, 1);
      second.angles.E = givenAngle('E', baseAngleRight, display, 2);
      pairs.segments = { AB: 'DE' };
      pairs.angles = { A: 'D', B: 'E' };
    } else {
      first.segments.AB = givenSegment('AB', side1, display, 1);
      first.segments.AC = givenSegment('AC', side2, display, 2);
      second.segments.DE = givenSegment('DE', side1, display, 1);
      second.segments.DF = givenSegment('DF', side2, display, 2);
      first.angles.A = givenAngle('A', includedAngle, display, 1);
      second.angles.D = givenAngle('D', includedAngle, display, 1);
      pairs.segments = { AB: 'DE', AC: 'DF' };
      pairs.angles = { A: 'D' };
    }

    return {
      figures: {
        first: mergeDeep({ id: 'triangle:ABC', shape: 'triangle' }, first),
        second: mergeDeep({ id: 'triangle:DEF', shape: 'triangle' }, second)
      },
      relation: {
        type: 'congruence',
        condition: condition,
        pairs: pairs
      }
    };
  }

  function defaultPresetFor(meta) {
    if (meta.variant === 'congruence' || meta.purpose === 'condition') return 'learn.condition';
    if (meta.purpose === 'property') return 'learn.property';
    if (meta.purpose === 'formula') return 'learn.formula';
    if (meta.purpose === 'example') return 'learn.typical-example';
    return 'learn.definition';
  }

  function normalizeTriangle(modelKey, input) {
    var meta = normalizeModelKey(modelKey, input || {});
    var presetName = input.preset || defaultPresetFor(meta);
    var preset = PRESETS[presetName];
    if (!preset) throw new Error('Unsupported FigureModel preset: ' + presetName);

    var display = mergeDeep(preset.display, input.display || {});
    var layout = mergeDeep(preset.layout, input.layout || {});
    var values = clone(input.values || {});
    var modal = clone(input.modal || input.modalInputs || {});
    var objects = meta.variant === 'congruence' || meta.purpose === 'condition'
      ? buildCongruenceObjects(values, display, meta)
      : buildSingleTriangleObjects(values, display, meta);

    return mergeDeep({
      schemaVersion: SCHEMA_VERSION,
      model: 'figure.triangle',
      sourceKey: modelKey,
      variant: meta.variant,
      purpose: meta.purpose,
      construction: meta.construction,
      condition: meta.condition,
      preset: presetName,
      values: values,
      modal: modal,
      display: display,
      layout: layout,
      renderer: {
        engine: 'instantGeometry',
        katex: true,
        target: meta.variant === 'congruence' ? 'triangle-pair' : 'triangle-mobile'
      },
      objects: objects
    }, input.overrides || {});
  }

  function normalizeQuadrilateral(modelKey, input) {
    var meta = normalizeModelKey(modelKey, input || {});
    var presetName = input.preset || defaultPresetFor(meta);
    var preset = PRESETS[presetName];
    if (!preset) throw new Error('Unsupported FigureModel preset: ' + presetName);

    var display = mergeDeep(preset.display, input.display || {});
    var layout = mergeDeep(preset.layout, input.layout || {});
    var values = clone(input.values || {});
    var modal = clone(input.modal || input.modalInputs || {});
    var objects = applyQuadrilateralModal(buildQuadrilateralObjects(values, display, meta), modal);

    return mergeDeep({
      schemaVersion: SCHEMA_VERSION,
      model: 'figure.quadrilateral',
      sourceKey: modelKey,
      variant: meta.variant,
      purpose: meta.purpose,
      construction: meta.construction,
      condition: meta.condition,
      preset: presetName,
      values: values,
      modal: modal,
      display: display,
      layout: layout,
      renderer: {
        engine: 'instantGeometry',
        katex: true,
        target: 'quadrilateral-mobile'
      },
      objects: objects
    }, input.overrides || {});
  }

  function normalizeSolid(modelKey, input) {
    var meta = normalizeModelKey(modelKey, input || {});
    var presetName = input.preset || defaultPresetFor(meta);
    var preset = PRESETS[presetName];
    if (!preset) throw new Error('Unsupported FigureModel preset: ' + presetName);

    var display = mergeDeep(preset.display, input.display || {});
    var layout = mergeDeep(preset.layout, input.layout || {});
    var values = clone(input.values || {});
    var modal = clone(input.modal || input.modalInputs || {});
    var objects = buildSolidObjects(values, display, meta);

    return mergeDeep({
      schemaVersion: SCHEMA_VERSION,
      model: 'figure.' + meta.construction,
      sourceKey: modelKey,
      dimension: '3d',
      variant: meta.variant,
      purpose: meta.purpose,
      construction: meta.construction,
      condition: meta.condition,
      preset: presetName,
      values: values,
      modal: modal,
      display: display,
      layout: layout,
      renderer: {
        engine: 'instantGeometry',
        katex: true,
        target: 'solid-mobile'
      },
      objects: objects
    }, input.overrides || {});
  }

  function F(modelKey, input) {
    var shape = String(modelKey || 'triangle').split('.').filter(Boolean)[0] || 'triangle';
    if (shape === 'solid') return normalizeSolid(modelKey, input || {});
    if (shape === 'quadrilateral') return normalizeQuadrilateral(modelKey, input || {});
    return normalizeTriangle(modelKey, input || {});
  }

  var api = Object.freeze({
    F: F,
    normalize: F,
    presets: PRESETS,
    defaults: DEFAULT_STYLE,
    schemaVersion: SCHEMA_VERSION
  });

  root.InstantGeometryFigureModels = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
