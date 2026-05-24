(function (root) {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var DEFAULTS = Object.freeze({
    width: 1000,
    height: 1000,
    padding: 145,
    faceFill: 'transparent',
    sideFill: 'transparent',
    stroke: '#2a5bd7',
    hiddenStroke: '#687086',
    pointFill: '#1f2937',
    labelFill: '#2a5bd7',
    showPoints: false,
    showPointLabels: true,
    hiddenSegments: []
  });

  function svg(tag, attrs) {
    var node = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (attrs[key] !== null && attrs[key] !== undefined) node.setAttribute(key, String(attrs[key]));
    });
    return node;
  }

  function valueOf(values, id, fallback) {
    if (values && Object.prototype.hasOwnProperty.call(values, id)) return Number(values[id]);
    return fallback;
  }

  function pointLabel(model, id) {
    var point = model && model.objects && model.objects.points && model.objects.points[id];
    var label = point && point.label || {};
    if (label.visible === false) return '';
    return String(label.text || id);
  }

  function normalize(raw, options) {
    var settings = Object.assign({}, DEFAULTS, options || {});
    var values = Object.keys(raw).map(function (id) { return raw[id]; });
    var minX = Math.min.apply(null, values.map(function (p) { return p.x; }));
    var maxX = Math.max.apply(null, values.map(function (p) { return p.x; }));
    var minY = Math.min.apply(null, values.map(function (p) { return p.y; }));
    var maxY = Math.max.apply(null, values.map(function (p) { return p.y; }));
    var scale = Math.min(
      (settings.width - settings.padding * 2) / Math.max(1, maxX - minX),
      (settings.height - settings.padding * 2) / Math.max(1, maxY - minY)
    );
    var offsetX = settings.width / 2 - ((minX + maxX) / 2) * scale;
    var offsetY = settings.height / 2 - ((minY + maxY) / 2) * scale;
    var out = {};
    Object.keys(raw).forEach(function (id) {
      out[id] = {
        x: raw[id].x * scale + offsetX,
        y: raw[id].y * scale + offsetY,
        z: raw[id].z || 0
      };
    });
    return out;
  }

  function project(point) {
    return {
      x: point.x + point.y * 0.42,
      y: -point.z + point.y * 0.28
    };
  }

  function projectBase(point, xSkew, yScale) {
    return {
      x: point.x + point.y * xSkew,
      y: point.y * yScale
    };
  }

  function regularPolygonBase(ids, radius, rotationDeg) {
    var base = {};
    var rotation = (rotationDeg || 0) * Math.PI / 180;
    ids.forEach(function (id, index) {
      var angle = rotation + Math.PI * 2 * index / ids.length;
      base[id] = {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        z: 0
      };
    });
    return base;
  }

  function polygonPath(points) {
    return points.map(function (p, index) {
      return (index === 0 ? 'M' : 'L') + p.x.toFixed(2) + ' ' + p.y.toFixed(2);
    }).join(' ') + ' Z';
  }

  function drawFace(stage, points, className, options) {
    if (!points || points.length < 3) return;
    stage.appendChild(svg('path', {
      d: polygonPath(points),
      class: className || 'solid-model-face',
      fill: options.faceFill,
      'fill-opacity': 0,
      stroke: 'none'
    }));
  }

  function drawLine(stage, a, b, muted, options) {
    if (!a || !b) return;
    var attrs = {
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      class: muted ? 'solid-model-edge muted' : 'solid-model-edge',
      stroke: muted ? options.hiddenStroke : options.stroke,
      'stroke-width': muted ? 3 : 4,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      fill: 'none'
    };
    if (muted) attrs['stroke-dasharray'] = '12 10';
    stage.appendChild(svg('line', attrs));
  }

  function drawFallbackLabel(stage, text, x, y, options) {
    var node = svg('text', {
      x: x,
      y: y,
      class: 'solid-model-label solid-model-label-fallback',
      fill: options.labelFill,
      'font-size': 34,
      'font-weight': 700,
      'font-family': 'KaTeX_Main,"Times New Roman","Hiragino Mincho ProN","Yu Mincho",serif',
      'text-anchor': 'middle',
      'dominant-baseline': 'middle'
    });
    node.textContent = text;
    stage.appendChild(node);
  }

  function drawLabel(stage, text, x, y, options) {
    if (!text) return;
    if (!root.katex || typeof root.katex.render !== 'function') {
      drawFallbackLabel(stage, text, x, y, options);
      return;
    }
    var width = 96;
    var height = 54;
    var node = svg('foreignObject', {
      x: x - width / 2,
      y: y - height / 2,
      width: width,
      height: height,
      class: 'solid-model-label solid-model-katex-label'
    });
    var div = document.createElement('div');
    div.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    div.className = 'solid-model-katex-label-inner';
    div.style.color = options.labelFill;
    div.style.fontSize = '34px';
    div.style.lineHeight = String(height) + 'px';
    div.style.textAlign = 'center';
    div.style.width = String(width) + 'px';
    div.style.height = String(height) + 'px';
    try {
      root.katex.render(String(text), div, {
        throwOnError: false,
        displayMode: false,
        output: 'html',
        strict: 'ignore'
      });
    } catch (error) {
      div.textContent = text;
    }
    node.appendChild(div);
    stage.appendChild(node);
  }

  function drawPoint(stage, point, label, center, options) {
    if (!point) return;
    if (options.showPoints !== false) {
      stage.appendChild(svg('circle', {
        cx: point.x,
        cy: point.y,
        r: 7,
        fill: options.pointFill,
        class: 'solid-model-point'
      }));
    }
    if (options.showPointLabels === false) return;
    var vx = point.x - center.x;
    var vy = point.y - center.y;
    var len = Math.hypot(vx, vy) || 1;
    drawLabel(stage, label, point.x + vx / len * 34, point.y + vy / len * 34, options);
  }

  function centerOf(points) {
    var ids = Object.keys(points);
    return ids.reduce(function (sum, id) {
      sum.x += points[id].x / ids.length;
      sum.y += points[id].y / ids.length;
      return sum;
    }, { x: 0, y: 0 });
  }

  function circleIntersection(p1, r1, p2, r2) {
    var dx = p2.x - p1.x;
    var dy = p2.y - p1.y;
    var d = Math.hypot(dx, dy) || 1;
    var a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    var h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
    var ux = dx / d;
    var uy = dy / d;
    var base = { x: p1.x + ux * a, y: p1.y + uy * a };
    return [
      { x: base.x - uy * h, y: base.y + ux * h },
      { x: base.x + uy * h, y: base.y - ux * h }
    ];
  }

  function triangleBase(ab, bc, ca) {
    var ax = (ab * ab + bc * bc - ca * ca) / (2 * bc);
    var ay = -Math.sqrt(Math.max(0, ab * ab - ax * ax));
    return {
      A: { x: ax, y: ay, z: 0 },
      B: { x: 0, y: 0, z: 0 },
      C: { x: bc, y: 0, z: 0 }
    };
  }

  function quadrilateralBase(a, b, c, d, ids) {
    var theta = 62 * Math.PI / 180;
    for (var deg = 62; deg >= 32; deg -= 2) {
      var testTheta = deg * Math.PI / 180;
      var testLast = { x: d * Math.cos(testTheta), y: d * Math.sin(testTheta) };
      var testDistance = Math.hypot(testLast.x - a, testLast.y);
      if (Math.abs(b - c) < testDistance && testDistance < b + c) {
        theta = testTheta;
        break;
      }
    }
    var base = {};
    base[ids[0]] = { x: 0, y: 0, z: 0 };
    base[ids[1]] = { x: a, y: 0, z: 0 };
    base[ids[3]] = { x: d * Math.cos(theta), y: d * Math.sin(theta), z: 0 };
    var candidates = circleIntersection(base[ids[1]], b, base[ids[3]], c);
    var chosen = candidates[0].y >= candidates[1].y ? candidates[0] : candidates[1];
    base[ids[2]] = { x: chosen.x, y: chosen.y, z: 0 };
    return base;
  }

  function projectedPolyhedron(model, values) {
    var kind = model.construction;
    var raw = {};
    if (kind === 'triangularPyramid') {
      var baseTri = triangleBase(valueOf(values, 'DB', 7), valueOf(values, 'BC', 5), valueOf(values, 'CD', 6));
      raw.B = projectBase(baseTri.B, 0.18, 0.55);
      raw.C = projectBase(baseTri.C, 0.18, 0.55);
      raw.D = projectBase(baseTri.A, 0.18, 0.55);
      var h = {
        x: (raw.B.x + raw.C.x + raw.D.x) / 3,
        y: (raw.B.y + raw.C.y + raw.D.y) / 3,
        z: 0
      };
      raw.H = h;
      raw.A = { x: h.x - valueOf(values, 'BC', 5) * 0.58, y: h.y - valueOf(values, 'AH', 7), z: 0 };
    } else if (kind === 'quadrangularPyramid') {
      var quadBase = quadrilateralBase(valueOf(values, 'BC', 5), valueOf(values, 'CD', 6), valueOf(values, 'DE', 5), valueOf(values, 'EB', 6), ['B', 'C', 'D', 'E']);
      raw = {};
      ['B', 'C', 'D', 'E'].forEach(function (id) {
        raw[id] = projectBase(quadBase[id], 0.24, 0.52);
      });
      var hq = {
        x: (raw.B.x + raw.C.x + raw.D.x + raw.E.x) / 4,
        y: (raw.B.y + raw.C.y + raw.D.y + raw.E.y) / 4,
        z: 0
      };
      raw.H = hq;
      raw.A = { x: hq.x, y: hq.y - valueOf(values, 'AH', 7), z: 0 };
    } else if (kind === 'pentagonalPyramid' || kind === 'hexagonalPyramid') {
      var pyramidBaseIds = kind === 'pentagonalPyramid' ? ['B', 'C', 'D', 'E', 'F'] : ['B', 'C', 'D', 'E', 'F', 'G'];
      var pyramidBase = regularPolygonBase(pyramidBaseIds, valueOf(values, 'baseRadius', 4), kind === 'pentagonalPyramid' ? -112 : -120);
      raw = {};
      pyramidBaseIds.forEach(function (id) {
        raw[id] = projectBase(pyramidBase[id], 0.22, 0.52);
      });
      var hp = pyramidBaseIds.reduce(function (sum, id) {
        sum.x += raw[id].x / pyramidBaseIds.length;
        sum.y += raw[id].y / pyramidBaseIds.length;
        return sum;
      }, { x: 0, y: 0, z: 0 });
      raw.H = hp;
      raw.A = { x: hp.x, y: hp.y - valueOf(values, 'AH', 7), z: 0 };
    } else if (kind === 'triangularPrism') {
      var t = triangleBase(valueOf(values, 'AB', 5), valueOf(values, 'BC', 6), valueOf(values, 'CA', 4));
      var depth = valueOf(values, 'AD', 7);
      var rise = { x: -depth * 0.26, y: -depth * 0.9 };
      raw.D = t.A;
      raw.E = t.B;
      raw.F = t.C;
      raw.A = { x: raw.D.x + rise.x, y: raw.D.y + rise.y, z: 0 };
      raw.B = { x: raw.E.x + rise.x, y: raw.E.y + rise.y, z: 0 };
      raw.C = { x: raw.F.x + rise.x, y: raw.F.y + rise.y, z: 0 };
    } else if (kind === 'quadrangularPrism' || kind === 'rectangularCuboid') {
      var q = quadrilateralBase(
        valueOf(values, 'EF', kind === 'rectangularCuboid' ? 5 : 4),
        valueOf(values, 'FG', kind === 'rectangularCuboid' ? 3 : 5),
        valueOf(values, 'GH', kind === 'rectangularCuboid' ? 5 : 6),
        valueOf(values, 'HE', kind === 'rectangularCuboid' ? 3 : 7),
        ['E', 'F', 'G', 'H']
      );
      var prismHeight = valueOf(values, 'AE', 7);
      raw.E = q.E;
      raw.F = q.F;
      raw.G = q.G;
      raw.H = q.H;
      raw.A = { x: q.E.x, y: q.E.y, z: prismHeight };
      raw.B = { x: q.F.x, y: q.F.y, z: prismHeight };
      raw.C = { x: q.G.x, y: q.G.y, z: prismHeight };
      raw.D = { x: q.H.x, y: q.H.y, z: prismHeight };
    } else if (kind === 'pentagonalPrism' || kind === 'hexagonalPrism') {
      var prismBottomIds = kind === 'pentagonalPrism' ? ['F', 'G', 'H', 'I', 'J'] : ['G', 'H', 'I', 'J', 'K', 'L'];
      var prismTopIds = kind === 'pentagonalPrism' ? ['A', 'B', 'C', 'D', 'E'] : ['A', 'B', 'C', 'D', 'E', 'F'];
      var prismBase = regularPolygonBase(prismBottomIds, valueOf(values, 'baseRadius', 4), kind === 'pentagonalPrism' ? -112 : -120);
      var polygonPrismHeight = valueOf(values, 'height', 7);
      raw = {};
      prismBottomIds.forEach(function (id, index) {
        var bottomPoint = prismBase[id];
        raw[id] = bottomPoint;
        raw[prismTopIds[index]] = { x: bottomPoint.x, y: bottomPoint.y, z: polygonPrismHeight };
      });
    } else if (kind === 'cube') {
      var a = valueOf(values, 'a', valueOf(values, 'edge', 6));
      raw = {
        A: { x: 0, y: 0, z: a },
        B: { x: a, y: 0, z: a },
        C: { x: a, y: a, z: a },
        D: { x: 0, y: a, z: a },
        E: { x: 0, y: 0, z: 0 },
        F: { x: a, y: 0, z: 0 },
        G: { x: a, y: a, z: 0 },
        H: { x: 0, y: a, z: 0 }
      };
    }

    var projected = {};
    if (kind === 'triangularPyramid' || kind === 'quadrangularPyramid' || kind === 'pentagonalPyramid' || kind === 'hexagonalPyramid') {
      Object.keys(raw).forEach(function (id) {
        projected[id] = raw[id];
      });
      return normalize(projected, { padding: 190 });
    }
    if (kind === 'triangularPrism') {
      Object.keys(raw).forEach(function (id) {
        projected[id] = raw[id];
      });
      return normalize(projected, { padding: 190 });
    }
    if (kind === 'quadrangularPrism' || kind === 'rectangularCuboid' || kind === 'cube' || kind === 'pentagonalPrism' || kind === 'hexagonalPrism') {
      var baseIds = kind === 'pentagonalPrism'
        ? ['F', 'G', 'H', 'I', 'J']
        : kind === 'hexagonalPrism'
          ? ['G', 'H', 'I', 'J', 'K', 'L']
          : ['E', 'F', 'G', 'H'];
      var minBaseX = Math.min.apply(null, baseIds.map(function (id) { return raw[id].x; }));
      var maxBaseX = Math.max.apply(null, baseIds.map(function (id) { return raw[id].x; }));
      var minBaseY = Math.min.apply(null, baseIds.map(function (id) { return raw[id].y; }));
      var maxBaseY = Math.max.apply(null, baseIds.map(function (id) { return raw[id].y; }));
      var baseW = Math.max(1, maxBaseX - minBaseX);
      var baseH = Math.max(1, maxBaseY - minBaseY);
      var scale = Math.min(420 / baseW, 260 / baseH, 520 / Math.max(valueOf(values, kind === 'cube' ? 'a' : kind === 'pentagonalPrism' || kind === 'hexagonalPrism' ? 'height' : 'AE', 7), 1));
      var height = (kind === 'cube' ? valueOf(values, 'a', valueOf(values, 'edge', 6)) : valueOf(values, kind === 'pentagonalPrism' || kind === 'hexagonalPrism' ? 'height' : 'AE', 7)) * scale;
      function prismProject(point) {
        var x = (point.x - minBaseX) * scale;
        var y = (point.y - minBaseY) * scale;
        return {
          x: x + y * 0.45,
          y: height - y * 0.36 - (point.z || 0) * scale
        };
      }
      Object.keys(raw).forEach(function (id) {
        projected[id] = prismProject(raw[id]);
      });
      return normalize(projected, { padding: 190 });
    }
    Object.keys(raw).forEach(function (id) {
      projected[id] = project(raw[id]);
    });
    return normalize(projected, { padding: 170 });
  }

  function edgeId(from, to) {
    return from + to;
  }

  function pointIdsFromFace(faceId) {
    return String(faceId || '').split('').filter(Boolean);
  }

  function undirectedKey(a, b) {
    return String(a) < String(b) ? String(a) + '|' + String(b) : String(b) + '|' + String(a);
  }

  function isPrismKind(kind) {
    return kind === 'triangularPrism' || kind === 'quadrangularPrism' || kind === 'pentagonalPrism' || kind === 'hexagonalPrism' || kind === 'rectangularCuboid' || kind === 'cube';
  }

  function isPyramidKind(kind) {
    return kind === 'triangularPyramid' || kind === 'quadrangularPyramid' || kind === 'pentagonalPyramid' || kind === 'hexagonalPyramid';
  }

  function segmentPointIds(id, points) {
    if (!id || id.length < 2) return null;
    var candidates = [];
    for (var index = 1; index < id.length; index += 1) {
      candidates.push([id.slice(0, index), id.slice(index)]);
    }
    for (var i = 0; i < candidates.length; i += 1) {
      var candidate = candidates[i];
      if (points[candidate[0]] && points[candidate[1]]) return candidate;
    }
    return null;
  }

  function pathOnCycle(ids, fromIndex, toIndex) {
    var path = [];
    var index = fromIndex;
    while (true) {
      path.push(ids[index]);
      if (index === toIndex) break;
      index = (index + 1) % ids.length;
    }
    return path;
  }

  function averageHumanY(ids, points) {
    if (!ids.length) return 0;
    return ids.reduce(function (sum, id) {
      return sum + (points[id] ? -points[id].y : 0);
    }, 0) / ids.length;
  }

  function frontPointsOnProjectedFace(faceId, points) {
    var ids = pointIdsFromFace(faceId);
    var minIndex = 0;
    var maxIndex = 0;
    ids.forEach(function (id, index) {
      if (points[id].x < points[ids[minIndex]].x) minIndex = index;
      if (points[id].x > points[ids[maxIndex]].x) maxIndex = index;
    });
    var pathForward = pathOnCycle(ids, minIndex, maxIndex);
    var pathBackward = pathOnCycle(ids, maxIndex, minIndex);
    var frontPath = averageHumanY(pathForward, points) <= averageHumanY(pathBackward, points) ? pathForward : pathBackward;
    return frontPath.reduce(function (set, id) {
      set[id] = true;
      return set;
    }, {});
  }

  function prismFaceVisibility(model, points, faces) {
    var topology = model.objects && model.objects.topology || {};
    var baseFaces = topology.baseFaces || [];
    var topFace = baseFaces[0] || faces[0];
    var bottomFace = baseFaces[1] || faces[1];
    var topIds = pointIdsFromFace(topFace);
    var bottomIds = pointIdsFromFace(bottomFace);
    var topIdSet = topIds.reduce(function (set, id) { set[id] = true; return set; }, {});
    var bottomIdSet = bottomIds.reduce(function (set, id) { set[id] = true; return set; }, {});
    var topFrontPoints = frontPointsOnProjectedFace(topFace, points);
    var bottomFrontPoints = frontPointsOnProjectedFace(bottomFace, points);
    var visibleFaces = {};
    var hiddenFaces = {};
    visibleFaces[topFace] = true;
    hiddenFaces[bottomFace] = true;
    faces.forEach(function (faceId) {
      if (faceId === topFace || faceId === bottomFace) return;
      var ids = pointIdsFromFace(faceId);
      var isFront = ids.every(function (id) {
        if (topIdSet[id]) return Boolean(topFrontPoints[id]);
        if (bottomIdSet[id]) return Boolean(bottomFrontPoints[id]);
        return false;
      });
      if (isFront) visibleFaces[faceId] = true;
      else hiddenFaces[faceId] = true;
    });
    return { visibleFaces: visibleFaces, hiddenFaces: hiddenFaces };
  }

  function pyramidFaceVisibility(model, points, faces) {
    var topology = model.objects && model.objects.topology || {};
    var baseFace = topology.baseFace || faces[0];
    var baseIds = pointIdsFromFace(baseFace);
    var baseIdSet = baseIds.reduce(function (set, id) { set[id] = true; return set; }, {});
    var baseFrontPoints = frontPointsOnProjectedFace(baseFace, points);
    var visibleFaces = {};
    var hiddenFaces = {};
    hiddenFaces[baseFace] = true;
    faces.forEach(function (faceId) {
      if (faceId === baseFace) return;
      var ids = pointIdsFromFace(faceId);
      var isFront = ids.every(function (id) {
        if (!baseIdSet[id]) return true;
        return Boolean(baseFrontPoints[id]);
      });
      if (isFront) visibleFaces[faceId] = true;
      else hiddenFaces[faceId] = true;
    });
    return { visibleFaces: visibleFaces, hiddenFaces: hiddenFaces };
  }

  function faceEdgeMap(faces) {
    return faces.reduce(function (map, faceId) {
      var ids = pointIdsFromFace(faceId);
      ids.forEach(function (id, index) {
        var nextId = ids[(index + 1) % ids.length];
        var key = undirectedKey(id, nextId);
        if (!map[key]) map[key] = [];
        map[key].push(faceId);
      });
      return map;
    }, {});
  }

  function occludedSegmentsFromPrismFaces(model, points, faces) {
    var visibility = prismFaceVisibility(model, points, faces);
    return occludedSegmentsFromFaceVisibility(visibility, faces);
  }

  function occludedSegmentsFromPyramidFaces(model, points, faces) {
    var visibility = pyramidFaceVisibility(model, points, faces);
    return occludedSegmentsFromFaceVisibility(visibility, faces);
  }

  function occludedSegmentsFromFaceVisibility(visibility, faces) {
    var edgeFaces = faceEdgeMap(faces);
    var occluded = {};
    Object.keys(edgeFaces).forEach(function (key) {
      var adjacentFaces = edgeFaces[key];
      if (adjacentFaces.length < 2) return;
      var allHidden = adjacentFaces.every(function (faceId) {
        return Boolean(visibility.hiddenFaces[faceId]);
      });
      if (allHidden) occluded[key] = true;
    });
    return occluded;
  }

  function hiddenByCameraSegments(kind) {
    var byKind = {
      triangularPyramid: ['DB', 'CD'],
      quadrangularPyramid: ['BC'],
      triangularPrism: ['AB', 'CA'],
      quadrangularPrism: ['CD', 'GH', 'CG', 'DH'],
      rectangularCuboid: ['CD', 'GH', 'CG', 'DH'],
      cube: ['CD', 'GH', 'CG', 'DH']
    };
    return (byKind[kind] || []).reduce(function (set, id) {
      set[id] = true;
      return set;
    }, {});
  }

  function renderPolyhedron(stage, model, options) {
    var points = projectedPolyhedron(model, model.values || {});
    var topology = model.objects && model.objects.topology || {};
    var faces = topology.faces || [];
    var center = centerOf(points);
    var hiddenSegments = (options.hiddenSegments || []).reduce(function (set, id) {
      set[String(id)] = true;
      return set;
    }, {});
    var occludedSegments = isPrismKind(model.construction)
      ? occludedSegmentsFromPrismFaces(model, points, faces)
      : isPyramidKind(model.construction)
        ? occludedSegmentsFromPyramidFaces(model, points, faces)
        : hiddenByCameraSegments(model.construction);
    faces.forEach(function (faceId) {
      drawFace(stage, faceId.split('').map(function (id) { return points[id]; }).filter(Boolean), 'solid-model-face', options);
    });
    var drawn = {};
    function drawSegmentById(id) {
      if (hiddenSegments[id]) return;
      var ids = segmentPointIds(id, points);
      if (!ids) return;
      var key = ids.join('');
      var reverseKey = ids.slice().reverse().join('');
      if (drawn[key] || drawn[reverseKey]) return;
      drawn[key] = true;
      drawLine(stage, points[ids[0]], points[ids[1]], Boolean(occludedSegments[undirectedKey(ids[0], ids[1])] || occludedSegments[key] || occludedSegments[reverseKey] || occludedSegments[id]), options);
    }
    (topology.edges || []).forEach(drawSegmentById);
    Object.keys(model.objects && model.objects.segments || {}).forEach(function (id) {
      var segment = model.objects.segments[id];
      if (segment && segment.visible === false) return;
      drawSegmentById(id);
    });
    Object.keys(points).forEach(function (id) {
      drawPoint(stage, points[id], pointLabel(model, id), center, options);
    });
  }

  function ellipsePath(cx, cy, rx, ry, start, end) {
    var s = start * Math.PI / 180;
    var e = end * Math.PI / 180;
    var sx = cx + Math.cos(s) * rx;
    var sy = cy + Math.sin(s) * ry;
    var ex = cx + Math.cos(e) * rx;
    var ey = cy + Math.sin(e) * ry;
    var large = Math.abs(end - start) > 180 ? 1 : 0;
    return 'M ' + sx + ' ' + sy + ' A ' + rx + ' ' + ry + ' 0 ' + large + ' 1 ' + ex + ' ' + ey;
  }

  function renderCurved(stage, model, options) {
    var kind = model.construction;
    var values = model.values || {};
    var cx = 500;
    var hiddenSegments = (options.hiddenSegments || []).reduce(function (set, id) {
      set[String(id)] = true;
      return set;
    }, {});
    function drawSegment(id, a, b, muted) {
      if (hiddenSegments[id]) return;
      drawLine(stage, a, b, muted, options);
    }
    if (kind === 'cone') {
      var radius = valueOf(values, 'radius', 3);
      var height = valueOf(values, 'height', 7);
      var scale = Math.min(250 / radius, 560 / height) * valueOf(options, 'renderScale', 1);
      var rx = radius * scale;
      var ry = rx * 0.28;
      var apex = { x: cx, y: 230 };
      var baseY = apex.y + height * scale;
      var left = { x: cx - rx, y: baseY };
      var right = { x: cx + rx, y: baseY };
      var center = { x: cx, y: baseY };
      stage.appendChild(svg('path', { d: 'M ' + apex.x + ' ' + apex.y + ' L ' + left.x + ' ' + left.y + ' A ' + rx + ' ' + ry + ' 0 0 0 ' + right.x + ' ' + right.y + ' Z', fill: options.faceFill, 'fill-opacity': 0, stroke: 'none' }));
      drawSegment('AB', apex, left, false);
      drawSegment('AC', apex, right, false);
      stage.appendChild(svg('path', { d: ellipsePath(cx, baseY, rx, ry, 180, 360), stroke: options.hiddenStroke, 'stroke-width': 3, 'stroke-dasharray': '12 10', fill: 'none' }));
      stage.appendChild(svg('path', { d: ellipsePath(cx, baseY, rx, ry, 0, 180), stroke: options.stroke, 'stroke-width': 4, fill: 'none' }));
      drawSegment('AO', apex, center, false);
      drawPoint(stage, apex, pointLabel(model, 'A'), { x: cx, y: baseY }, options);
      drawPoint(stage, center, pointLabel(model, 'O'), { x: cx, y: apex.y }, options);
      drawPoint(stage, left, pointLabel(model, 'B'), { x: cx, y: baseY }, options);
      drawPoint(stage, right, pointLabel(model, 'C'), { x: cx, y: baseY }, options);
      return;
    }
    if (kind === 'cylinder') {
      var r = valueOf(values, 'radius', 3);
      var h = valueOf(values, 'height', 7);
      var sc = Math.min(260 / r, 540 / h) * valueOf(options, 'renderScale', 1);
      var crx = r * sc;
      var cry = crx * 0.26;
      var topY = 250;
      var bottomY = topY + h * sc;
      var leftTop = { x: cx - crx, y: topY };
      var rightTop = { x: cx + crx, y: topY };
      var leftBottom = { x: cx - crx, y: bottomY };
      var rightBottom = { x: cx + crx, y: bottomY };
      stage.appendChild(svg('path', { d: 'M ' + leftTop.x + ' ' + topY + ' A ' + crx + ' ' + cry + ' 0 0 1 ' + rightTop.x + ' ' + topY + ' L ' + rightBottom.x + ' ' + bottomY + ' A ' + crx + ' ' + cry + ' 0 0 0 ' + leftBottom.x + ' ' + bottomY + ' Z', fill: options.faceFill, 'fill-opacity': 0, stroke: 'none' }));
      drawSegment('AB', leftTop, leftBottom, false);
      drawSegment('CD', rightTop, rightBottom, false);
      stage.appendChild(svg('ellipse', { cx: cx, cy: topY, rx: crx, ry: cry, stroke: options.stroke, 'stroke-width': 4, fill: 'none' }));
      stage.appendChild(svg('path', { d: ellipsePath(cx, bottomY, crx, cry, 180, 360), stroke: options.hiddenStroke, 'stroke-width': 3, 'stroke-dasharray': '12 10', fill: 'none' }));
      stage.appendChild(svg('path', { d: ellipsePath(cx, bottomY, crx, cry, 0, 180), stroke: options.stroke, 'stroke-width': 4, fill: 'none' }));
      drawPoint(stage, { x: cx, y: bottomY }, pointLabel(model, 'O'), { x: cx, y: topY }, options);
      drawPoint(stage, leftBottom, pointLabel(model, 'A'), { x: cx, y: bottomY }, options);
      drawPoint(stage, leftTop, pointLabel(model, 'B'), { x: cx, y: topY }, options);
      return;
    }
    if (kind === 'conicalFrustum') {
      var topR = valueOf(values, 'topRadius', 2);
      var bottomR = valueOf(values, 'bottomRadius', 4);
      var fh = valueOf(values, 'height', 5);
      var fs = Math.min(250 / bottomR, 500 / fh) * valueOf(options, 'renderScale', 1);
      var trx = topR * fs;
      var brx = bottomR * fs;
      var tryy = trx * 0.28;
      var bry = brx * 0.28;
      var fy1 = 270;
      var fy2 = fy1 + fh * fs;
      stage.appendChild(svg('path', { d: 'M ' + (cx - trx) + ' ' + fy1 + ' A ' + trx + ' ' + tryy + ' 0 0 1 ' + (cx + trx) + ' ' + fy1 + ' L ' + (cx + brx) + ' ' + fy2 + ' A ' + brx + ' ' + bry + ' 0 0 0 ' + (cx - brx) + ' ' + fy2 + ' Z', fill: options.faceFill, 'fill-opacity': 0, stroke: 'none' }));
      drawSegment('AB', { x: cx - trx, y: fy1 }, { x: cx - brx, y: fy2 }, false);
      drawSegment('DC', { x: cx + trx, y: fy1 }, { x: cx + brx, y: fy2 }, false);
      stage.appendChild(svg('ellipse', { cx: cx, cy: fy1, rx: trx, ry: tryy, stroke: options.stroke, 'stroke-width': 4, fill: 'none' }));
      stage.appendChild(svg('path', { d: ellipsePath(cx, fy2, brx, bry, 180, 360), stroke: options.hiddenStroke, 'stroke-width': 3, 'stroke-dasharray': '12 10', fill: 'none' }));
      stage.appendChild(svg('path', { d: ellipsePath(cx, fy2, brx, bry, 0, 180), stroke: options.stroke, 'stroke-width': 4, fill: 'none' }));
      var visualCenter = { x: cx, y: (fy1 + fy2) / 2 };
      drawPoint(stage, { x: cx - trx, y: fy1 }, pointLabel(model, 'A'), visualCenter, options);
      drawPoint(stage, { x: cx - brx, y: fy2 }, pointLabel(model, 'B'), visualCenter, options);
      drawPoint(stage, { x: cx + brx, y: fy2 }, pointLabel(model, 'C'), visualCenter, options);
      drawPoint(stage, { x: cx + trx, y: fy1 }, pointLabel(model, 'D'), visualCenter, options);
      drawPoint(stage, { x: cx, y: fy1 }, pointLabel(model, 'O'), { x: cx, y: fy2 }, options);
      drawPoint(stage, { x: cx, y: fy2 }, pointLabel(model, 'Op'), { x: cx, y: fy1 }, options);
    }
  }

  function render(stage, model, options) {
    var settings = Object.assign({}, DEFAULTS, options || {});
    if (options && Array.isArray(options.hiddenSegments)) settings.hiddenSegments = options.hiddenSegments.slice();
    if (!stage) throw new Error('Solid renderer requires an SVG stage.');
    stage.innerHTML = '';
    stage.setAttribute('viewBox', '0 0 ' + settings.width + ' ' + settings.height);
    if (!model || model.dimension !== '3d') throw new Error('Solid renderer requires a 3D FigureModel.');
    if (model.construction === 'cone' || model.construction === 'cylinder' || model.construction === 'conicalFrustum') {
      renderCurved(stage, model, settings);
    } else {
      renderPolyhedron(stage, model, settings);
    }
    return stage;
  }

  var api = Object.freeze({ render: render });
  root.InstantGeometrySolidFigureRenderer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
