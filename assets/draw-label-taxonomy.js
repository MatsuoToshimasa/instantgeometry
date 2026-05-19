(function () {
  'use strict';

  const CANONICAL_KINDS = Object.freeze(['point', 'segment', 'angle', 'area', 'arc', 'volume', 'function']);
  const CANONICAL_KIND_SET = CANONICAL_KINDS.reduce(function (set, kind) {
    set[kind] = true;
    return set;
  }, {});

  const KIND_ALIASES = Object.freeze({
    side: 'segment',
    vertex: 'point',
    specialVertex: 'point',
    specialPoint: 'point',
    specialSegment: 'segment',
    diagonal: 'segment',
    extraSegment: 'segment',
    centerLine: 'segment',
    segmentObject: 'segment',
    angleMark: 'angle',
    rightAngleMark: 'angle',
    extraAngle: 'angle',
    extraArea: 'area',
    discreteArea: 'area',
    curve: 'function',
    graph: 'function',
    vector: 'segment'
  });

  const SEGMENT_MEASURE_IDS = Object.freeze({
    r: true,
    a: true,
    b: true,
    h: true,
    height: true,
    base: true,
    slant: true,
    radius: true,
    diameter: true,
    shift: true,
    latus: true
  });

  const ARC_MEASURE_IDS = Object.freeze({
    l: true,
    circumference: true,
    perimeterArc: true
  });

  const KIND_WORD_ALIASES = Object.freeze([
    { pattern: /point|vertex|node|dot/i, kind: 'point' },
    { pattern: /segment|side|line|edge|radius|diameter|height|base|slant|vector/i, kind: 'segment' },
    { pattern: /angle|degree/i, kind: 'angle' },
    { pattern: /area|region|face/i, kind: 'area' },
    { pattern: /arc|circumference|perimeter/i, kind: 'arc' },
    { pattern: /volume|solid/i, kind: 'volume' },
    { pattern: /function|curve|graph|plot|locus|axis/i, kind: 'function' }
  ]);

  function rawKindOf(target) {
    if (!target) return '';
    if (typeof target === 'string') return target;
    return String(target.kind || target.type || target.labelKind || target['data-kind'] || '');
  }

  function rawIdOf(target) {
    if (!target || typeof target === 'string') return '';
    return String(target.id || target.labelId || target['data-id'] || '');
  }

  function isCanonicalKind(kind) {
    return Boolean(CANONICAL_KIND_SET[kind]);
  }

  function isArcId(id) {
    const text = String(id || '');
    return /^arc/i.test(text) || Boolean(ARC_MEASURE_IDS[text]);
  }

  function isSegmentId(id) {
    const text = String(id || '');
    return Boolean(SEGMENT_MEASURE_IDS[text]) || /^[A-Z][A-Z][A-Za-z']*$/.test(text);
  }

  function inferKind(rawKind, rawId, context) {
    const ctx = context || {};
    if (rawKind === 'measure') return isArcId(rawId) || ctx.role === 'arc' ? 'arc' : 'segment';
    if (rawKind === 'circle') return ctx.role === 'arc' ? 'arc' : 'function';
    if (KIND_ALIASES[rawKind]) return KIND_ALIASES[rawKind];
    if (isCanonicalKind(rawKind)) return rawKind;
    if (isArcId(rawId)) return 'arc';
    if (/^[A-Z]$/.test(String(rawId || ''))) return 'point';
    if (/^[A-Z]{3,}$/.test(String(rawId || ''))) return 'angle';
    if (isSegmentId(rawId)) return 'segment';
    for (let i = 0; i < KIND_WORD_ALIASES.length; i += 1) {
      if (KIND_WORD_ALIASES[i].pattern.test(rawKind)) return KIND_WORD_ALIASES[i].kind;
    }
    if (isCanonicalKind(ctx.defaultKind)) return ctx.defaultKind;
    return 'function';
  }

  function roleFor(rawKind, rawId, kind, context) {
    const ctx = context || {};
    if (rawKind === 'measure' && kind === 'arc') return 'arcMeasure';
    if (rawKind === 'measure' && kind === 'segment') return isSegmentId(rawId) ? 'segmentMeasure' : 'measure';
    if (rawKind === 'circle') return ctx.role || 'circle';
    if (rawKind === 'extraArea') return 'extraArea';
    if (rawKind !== kind) return rawKind || 'inferred';
    return '';
  }

  function normalizeLabelTarget(kind, id, context) {
    const target = typeof kind === 'object' && kind !== null ? kind : { kind: kind, id: id };
    const rawKind = rawKindOf(target);
    const rawId = rawIdOf(target);
    const normalizedKind = inferKind(rawKind, rawId, context);
    const normalizedId = rawKind === 'extraArea' && !rawId ? 'main' : rawId;
    return {
      kind: normalizedKind,
      id: normalizedId,
      originalKind: rawKind,
      originalId: rawId,
      canonical: true,
      inferred: rawKind !== normalizedKind,
      role: roleFor(rawKind, rawId, normalizedKind, context)
    };
  }

  function normalize(target, context) {
    return normalizeLabelTarget(target, null, context);
  }

  function normalizeKind(kind, id, context) {
    const rawKind = String(kind || '');
    if (isCanonicalKind(rawKind)) return rawKind;
    if (KIND_ALIASES[rawKind]) return KIND_ALIASES[rawKind];
    if (rawKind === 'measure') return isArcId(id) || (context && context.role === 'arc') ? 'arc' : 'segment';
    return rawKind;
  }

  function titlePrefixFor(target, context) {
    const normalized = normalize(target, context);
    const id = normalized.id;
    if (normalized.kind === 'point') return id ? '点 ' + id : '点';
    if (normalized.kind === 'segment') return id ? '線分 ' + id : '線分';
    if (normalized.kind === 'angle') return id ? '角 ' + id : '角';
    if (normalized.kind === 'area') return '面積';
    if (normalized.kind === 'arc') return id ? '弧 ' + id.replace(/^arc/i, '') : '弧';
    if (normalized.kind === 'volume') return '体積';
    if (normalized.kind === 'function') return '関数';
    return id ? normalized.kind + ' ' + id : normalized.kind;
  }

  window.InstantGeometryLabelTaxonomy = {
    CANONICAL_KINDS: CANONICAL_KINDS.slice(),
    KIND_ALIASES: KIND_ALIASES,
    normalize: normalize,
    normalizeLabelTarget: normalizeLabelTarget,
    normalizeKind: normalizeKind,
    isCanonicalKind: isCanonicalKind,
    isArcId: isArcId,
    isSegmentId: isSegmentId,
    titlePrefixFor: titlePrefixFor
  };
})();
