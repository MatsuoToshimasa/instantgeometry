(function () {
  'use strict';

  let activeDecimalPlaces = 2;

  function clampDecimalPlaces(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 2;
    return Math.max(0, Math.min(6, Math.round(parsed)));
  }

  function setActiveDecimalPlaces(value) {
    activeDecimalPlaces = clampDecimalPlaces(value);
    return activeDecimalPlaces;
  }

  function svg(tag, attrs) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (attrs[key] !== null && attrs[key] !== undefined) node.setAttribute(key, String(attrs[key]));
    });
    return node;
  }

  function parsePositive(value, name) {
    const source = String(value || '').trim();
    if (!source) throw new Error(name + ' には 0 より大きい数を入力してください。');
    const text = source.replace(/\s+/g, '');
    let index = 0;

    function peek() { return text[index] || ''; }
    function consume(char) {
      if (peek() === char) {
        index += 1;
        return true;
      }
      return false;
    }
    function startsFactor() {
      const char = peek();
      return char === '('
        || char === '√'
        || char === 'π'
        || /[0-9.]/.test(char)
        || text.slice(index, index + 2).toLowerCase() === 'pi'
        || text.slice(index, index + 4).toLowerCase() === 'sqrt';
    }
    function parseNumber() {
      const start = index;
      while (/[0-9.]/.test(peek())) index += 1;
      const raw = text.slice(start, index);
      if (!raw || raw === '.' || (raw.match(/\./g) || []).length > 1) throw new Error(name + ' の入力式を確認してください。');
      return Number(raw);
    }
    function parseFactor() {
      if (consume('+')) return parseFactor();
      if (consume('-')) return -parseFactor();
      if (consume('√')) return Math.sqrt(parseFactor());
      if (text.slice(index, index + 4).toLowerCase() === 'sqrt') {
        index += 4;
        return Math.sqrt(parseFactor());
      }
      if (text.slice(index, index + 2).toLowerCase() === 'pi') {
        index += 2;
        return Math.PI;
      }
      if (consume('π')) return Math.PI;
      if (consume('(')) {
        const value = parseExpression();
        if (!consume(')')) throw new Error(name + ' の入力式を確認してください。');
        return value;
      }
      return parseNumber();
    }
    function parseTerm() {
      let value = parseFactor();
      while (true) {
        if (consume('*')) value *= parseFactor();
        else if (consume('/')) value /= parseFactor();
        else if (startsFactor()) value *= parseFactor();
        else break;
      }
      return value;
    }
    function parseExpression() {
      let value = parseTerm();
      while (true) {
        if (consume('+')) value += parseTerm();
        else if (consume('-')) value -= parseTerm();
        else break;
      }
      return value;
    }

    const parsed = parseExpression();
    if (index !== text.length || !Number.isFinite(parsed)) throw new Error(name + ' の入力式を確認してください。');
    if (!(parsed > 0)) {
      throw new Error(name + ' には 0 より大きい数を入力してください。');
    }
    return parsed;
  }

    function fmt(value) {
      const digits = activeDecimalPlaces;
      const factor = Math.pow(10, digits);
      const rounded = Math.round(value * factor) / factor;
      return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '');
    }

    function simplifyPythagoreanRadical(value) {
      const n = Math.round(value);
      if (!Number.isFinite(value) || Math.abs(value - n) > 1e-9 || n < 0) return '';
      const root = Math.sqrt(n);
      if (Number.isInteger(root)) return String(root);
      let outside = 1;
      let inside = n;
      for (let factor = Math.floor(Math.sqrt(inside)); factor >= 2; factor -= 1) {
        const square = factor * factor;
        if (inside % square === 0) {
          outside *= factor;
          inside /= square;
          factor = Math.floor(Math.sqrt(inside)) + 1;
        }
      }
      return (outside === 1 ? '' : String(outside)) + '√' + inside;
    }

    function formatPythagoreanLabel(a, b) {
      const roundedA = Math.round(a * 1000000) / 1000000;
      const roundedB = Math.round(b * 1000000) / 1000000;
      if (Number.isInteger(roundedA) && Number.isInteger(roundedB)) {
        return simplifyPythagoreanRadical(roundedA * roundedA + roundedB * roundedB);
      }
      return fmt(Math.hypot(a, b));
    }

    function hexToRgba(hex, alpha) {
      const normalized = String(hex || '#2a5bd7').replace('#', '');
      const full = normalized.length === 3
        ? normalized.split('').map(function (char) { return char + char; }).join('')
        : normalized;
      const value = parseInt(full, 16);
      if (!Number.isFinite(value)) return 'rgba(42,91,215,' + alpha + ')';
      const r = (value >> 16) & 255;
      const g = (value >> 8) & 255;
      const b = value & 255;
      return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    }

  function addText(stage, text, x, y, className, extraAttrs) {
    const attrs = Object.assign({
      x: x,
      y: y,
      class: 'shape-label ' + (className || ''),
      'text-anchor': 'middle',
      'dominant-baseline': 'middle'
    }, extraAttrs || {});
    if (window.InstantGeometrySharedLabels && typeof window.InstantGeometrySharedLabels.createSvgKatexLabel === 'function') {
      const katexNode = window.InstantGeometrySharedLabels.createSvgKatexLabel({
        createSvg: svg,
        text: text,
        attrs: attrs,
        kind: attrs['data-label-kind'] || attrs['data-kind'],
        id: attrs['data-label-id'] || attrs['data-id']
      });
      if (katexNode) {
        stage.appendChild(katexNode);
        return katexNode;
      }
    }
    const node = svg('text', attrs);
    node.textContent = text;
    stage.appendChild(node);
    return node;
  }

  function downloadBlob(blob, filename) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  }

  function createCylinderPage(config) {
    const isCone = config.shapeKind === 'cone';
    const isTriangularPrism = config.shapeKind === 'triangular-prism';
    const isQuadrangularPrism = config.shapeKind === 'quadrangular-prism';
    const isPentagonalPrism = config.shapeKind === 'pentagonal-prism';
    const isHexagonalPrism = config.shapeKind === 'hexagonal-prism';
    const isTriangularPyramid = config.shapeKind === 'triangular-pyramid';
    const isQuadrangularPyramid = config.shapeKind === 'quadrangular-pyramid';
    const isPentagonalPyramid = config.shapeKind === 'pentagonal-pyramid';
    const isHexagonalPyramid = config.shapeKind === 'hexagonal-pyramid';
    const isRightTriangularPyramid1 = config.shapeKind === 'right-triangular-pyramid-1';
    const isRightTriangularPyramid = config.shapeKind === 'right-triangular-pyramid';
    const isCrossSection1 = config.shapeKind === 'cross-section-1';
    const isCrossSection2 = config.shapeKind === 'cross-section-2';
    const isCrossSection3 = config.shapeKind === 'cross-section-3';
    const isRegularTetrahedron = config.shapeKind === 'regular-tetrahedron';
    const isRegularHexahedron = config.shapeKind === 'regular-hexahedron';
    const isRegularOctahedron = config.shapeKind === 'regular-octahedron';
    const isRegularDodecahedron = config.shapeKind === 'regular-dodecahedron';
    const isRegularIcosahedron = config.shapeKind === 'regular-icosahedron';
    const isSimilarSolid1 = config.shapeKind === 'similar-solid-1';
    const isSimilarSolid2 = config.shapeKind === 'similar-solid-2';
    const isSphere = config.shapeKind === 'sphere';
    const isHemisphere1 = config.shapeKind === 'hemisphere-1';
    const isHemisphere2 = config.shapeKind === 'hemisphere-2';
    const isQuarterSphere1 = config.shapeKind === 'quarter-sphere-1';
    const stage = document.getElementById('stage');
    const labelLayer = document.getElementById('labelLayer');
    const captureRoot = document.getElementById('captureRoot');
    const statusBox = document.getElementById('statusBox');
    const radiusInput = config.radiusInputId ? document.getElementById(config.radiusInputId) : null;
    const heightInput = config.heightInputId ? document.getElementById(config.heightInputId) : null;
    const aInput = config.aInputId ? document.getElementById(config.aInputId) : null;
    const baInput = config.baInputId ? document.getElementById(config.baInputId) : null;
    const abInput = config.abInputId ? document.getElementById(config.abInputId) : null;
    const bcInput = config.bcInputId ? document.getElementById(config.bcInputId) : null;
    const cbInput = config.cbInputId ? document.getElementById(config.cbInputId) : null;
    const oaInput = config.oaInputId ? document.getElementById(config.oaInputId) : null;
    const obInput = config.obInputId ? document.getElementById(config.obInputId) : null;
    const ocInput = config.ocInputId ? document.getElementById(config.ocInputId) : null;
    const caInput = config.caInputId ? document.getElementById(config.caInputId) : null;
    const adInput = config.adInputId ? document.getElementById(config.adInputId) : null;
    const efInput = config.efInputId ? document.getElementById(config.efInputId) : null;
    const fgInput = config.fgInputId ? document.getElementById(config.fgInputId) : null;
    const ghInput = config.ghInputId ? document.getElementById(config.ghInputId) : null;
    const heInput = config.heInputId ? document.getElementById(config.heInputId) : null;
    const aeInput = config.aeInputId ? document.getElementById(config.aeInputId) : null;
    const hiInput = config.hiInputId ? document.getElementById(config.hiInputId) : null;
    const ijInput = config.ijInputId ? document.getElementById(config.ijInputId) : null;
    const jfInput = config.jfInputId ? document.getElementById(config.jfInputId) : null;
    const afInput = config.afInputId ? document.getElementById(config.afInputId) : null;
    const bfInput = config.bfInputId ? document.getElementById(config.bfInputId) : null;
    const jkInput = config.jkInputId ? document.getElementById(config.jkInputId) : null;
    const klInput = config.klInputId ? document.getElementById(config.klInputId) : null;
    const lgInput = config.lgInputId ? document.getElementById(config.lgInputId) : null;
    const agInput = config.agInputId ? document.getElementById(config.agInputId) : null;
    const ahInput = config.ahInputId ? document.getElementById(config.ahInputId) : null;
    const cdInput = config.cdInputId ? document.getElementById(config.cdInputId) : null;
    const daInput = config.daInputId ? document.getElementById(config.daInputId) : null;
    const deInput = config.deInputId ? document.getElementById(config.deInputId) : null;
    const dbInput = config.dbInputId ? document.getElementById(config.dbInputId) : null;
    const ebInput = config.ebInputId ? document.getElementById(config.ebInputId) : null;
    const fbInput = config.fbInputId ? document.getElementById(config.fbInputId) : null;
    const gbInput = config.gbInputId ? document.getElementById(config.gbInputId) : null;
    const aopInput = config.aopInputId ? document.getElementById(config.aopInputId) : null;
    const opoInput = config.opoInputId ? document.getElementById(config.opoInputId) : null;
    const boInput = config.boInputId ? document.getElementById(config.boInputId) : null;
    const ogpInput = config.ogpInputId ? document.getElementById(config.ogpInputId) : null;
    const gpgInput = config.gpgInputId ? document.getElementById(config.gpgInputId) : null;
    const backBtn = document.getElementById('backBtn');
    const saveBtn = document.getElementById('saveBtn');
    const editSheet = document.getElementById('editSheet');
    const sheetTitle = document.getElementById('sheetTitle');
    const sheetBody = document.getElementById('sheetBody');
    const sheetClose = document.getElementById('sheetClose');
    const saveSheet = document.getElementById('saveSheet');
    const sheetBackdrop = document.getElementById('sheetBackdrop');
    const saveSheetClose = document.getElementById('saveSheetClose');
    const savePngBtn = document.getElementById('savePngBtn');
    const saveTransparentBtn = document.getElementById('saveTransparentBtn');
    const savePdfBtn = document.getElementById('savePdfBtn');
    const segmentArcVisible = isTriangularPrism
      ? { AB: true, BC: true, CA: true, AD: true, BE: false, CF: false, DE: false, EF: false, FD: false }
      : isTriangularPyramid
        ? { AH: true, BC: true, CD: true, DB: true, AB: false, AC: false, AD: false, BH: false, CH: false, DH: false }
      : isRightTriangularPyramid1
        ? { AB: true, CB: true, DB: true, AC: false, AD: false, CD: false }
      : isQuadrangularPyramid
        ? { AH: true, BC: true, CD: true, DE: true, EB: true, AB: false, AC: false, AD: false, AE: false, BH: false, CH: false, DH: false, EH: false }
      : isPentagonalPyramid
        ? { AH: true, BC: true, CD: true, DE: true, EF: true, FB: true, AB: false, AC: false, AD: false, AE: false, AF: false, BH: false, CH: false, DH: false, EH: false, FH: false }
      : isHexagonalPyramid
        ? { AH: true, BC: true, CD: true, DE: true, EF: true, FG: true, GB: true, AB: false, AC: false, AD: false, AE: false, AF: false, AG: false, BH: false, CH: false, DH: false, EH: false, FH: false, GH: false }
      : isRightTriangularPyramid
        ? { BA: true, BC: true, BF: true, AC: false, CF: false, FA: false, CD: false, DA: false, AE: false, EF: false, FG: false, GH: false, HE: false, CG: false, DH: false }
      : isCrossSection1
        ? { AE: true, EF: true, FG: true, AC: false, CF: false, FA: false }
      : isCrossSection2
        ? { CD: true, DA: true, AE: true }
      : isCrossSection3
        ? { BA: true, BC: true, BF: true, PQ: false, QR: false, RS: false, ST: false, TU: false, UP: false, AP: false, PD: false, DU: false, UC: false, CT: false, TG: false, GS: false, SF: false, FR: false, RE: false, EQ: false, QA: false }
      : isRegularTetrahedron
        ? { AB: false, AC: false, AD: false, BC: false, CD: false, DB: false }
      : isRegularHexahedron
        ? { AB: false, BC: false, CD: false, DA: false, EF: false, FG: false, GH: false, HE: false, AE: false, BF: false, CG: false, DH: false }
      : isRegularOctahedron
        ? { AB: false, AC: false, AD: false, AE: false, FB: false, FC: false, FD: false, FE: false, BC: false, CD: false, DE: false, EB: false }
      : isHexagonalPrism
        ? { GH: true, HI: true, IJ: true, JK: true, KL: true, LG: true, AG: true, AB: false, BC: false, CD: false, DE: false, EF: false, FA: false, BH: false, CI: false, DJ: false, EK: false, FL: false }
      : isPentagonalPrism
        ? { FG: true, GH: true, HI: true, IJ: true, JF: true, AF: true, AB: false, BC: false, CD: false, DE: false, EA: false, BG: false, CH: false, DI: false, EJ: false }
      : isQuadrangularPrism
        ? { EF: true, FG: true, GH: true, HE: true, AE: true, AB: false, BC: false, CD: false, DA: false, BF: false, CG: false, DH: false }
      : isCone
        ? { OB: true, AO: true, OC: false, AB: false, AC: false }
      : isSimilarSolid1
        ? { AOp: true, OpO: true, BO: true, CO: false, AM: false, AN: false, MB: false, NC: false }
      : isSimilarSolid2
        ? { OGp: true, GpG: true, AB: true, BC: true, CA: true, OL: false, LA: false, OM: false, MB: false, ON: false, NC: false, LM: false, MN: false, NL: false }
      : isQuarterSphere1
        ? { OA: true }
      : (isSphere || isHemisphere1 || isHemisphere2 || isQuarterSphere1)
        ? { R: true }
        : { OA: true, AB: true, CD: false, OpC: false, OpB: false, OD: false };
    const segmentInputs = isTriangularPrism
      ? { AB: ' ', BC: ' ', CA: ' ', AD: ' ', BE: '', CF: '', DE: '', EF: '', FD: '' }
      : isTriangularPyramid
        ? { AH: ' ', BC: ' ', CD: ' ', DB: ' ', AB: '', AC: '', AD: '', BH: '', CH: '', DH: '' }
      : isRightTriangularPyramid1
        ? { AB: ' ', CB: ' ', DB: ' ', AC: ' ', AD: ' ', CD: ' ' }
      : isQuadrangularPyramid
        ? { AH: ' ', BC: ' ', CD: ' ', DE: ' ', EB: ' ', AB: '', AC: '', AD: '', AE: '', BH: '', CH: '', DH: '', EH: '' }
      : isPentagonalPyramid
        ? { AH: ' ', BC: ' ', CD: ' ', DE: ' ', EF: ' ', FB: ' ', AB: '', AC: '', AD: '', AE: '', AF: '', BH: '', CH: '', DH: '', EH: '', FH: '' }
      : isHexagonalPyramid
        ? { AH: ' ', BC: ' ', CD: ' ', DE: ' ', EF: ' ', FG: ' ', GB: ' ', AB: '', AC: '', AD: '', AE: '', AF: '', AG: '', BH: '', CH: '', DH: '', EH: '', FH: '', GH: '' }
      : isRightTriangularPyramid
        ? { BA: ' ', BC: ' ', BF: ' ', AC: ' ', CF: ' ', FA: ' ', CD: '', DA: '', AE: '', EF: '', FG: '', GH: '', HE: '', CG: '', DH: '' }
      : isCrossSection1
        ? { AE: ' ', EF: ' ', FG: ' ', AC: ' ', CF: ' ', FA: ' ' }
      : isCrossSection2
        ? { CD: ' ', DA: ' ', AE: ' ' }
      : isCrossSection3
        ? { BA: ' ', BC: ' ', BF: ' ', PQ: '', QR: '', RS: '', ST: '', TU: '', UP: '', AP: '', PD: '', DU: '', UC: '', CT: '', TG: '', GS: '', SF: '', FR: '', RE: '', EQ: '', QA: '' }
      : isRegularTetrahedron
        ? { AB: '', AC: '', AD: '', BC: '', CD: '', DB: '' }
      : isRegularHexahedron
        ? { AB: '', BC: '', CD: '', DA: '', EF: '', FG: '', GH: '', HE: '', AE: '', BF: '', CG: '', DH: '' }
      : isRegularOctahedron
        ? { AB: '', AC: '', AD: '', AE: '', FB: '', FC: '', FD: '', FE: '', BC: '', CD: '', DE: '', EB: '' }
      : isHexagonalPrism
        ? { GH: ' ', HI: ' ', IJ: ' ', JK: ' ', KL: ' ', LG: ' ', AG: ' ', AB: '', BC: '', CD: '', DE: '', EF: '', FA: '', BH: '', CI: '', DJ: '', EK: '', FL: '' }
      : isPentagonalPrism
        ? { FG: ' ', GH: ' ', HI: ' ', IJ: ' ', JF: ' ', AF: ' ', AB: '', BC: '', CD: '', DE: '', EA: '', BG: '', CH: '', DI: '', EJ: '' }
      : isQuadrangularPrism
        ? { EF: ' ', FG: ' ', GH: ' ', HE: ' ', AE: ' ', AB: '', BC: '', CD: '', DA: '', BF: '', CG: '', DH: '' }
      : isCone
        ? { OB: ' ', AO: ' ', OC: '', AB: '', AC: '' }
      : isSimilarSolid1
        ? { AOp: ' ', OpO: ' ', BO: ' ', CO: '', AM: '', AN: '', MB: '', NC: '' }
      : isSimilarSolid2
        ? { OGp: ' ', GpG: ' ', AB: ' ', BC: ' ', CA: ' ', OL: '', LA: '', OM: '', MB: '', ON: '', NC: '', LM: '', MN: '', NL: '' }
      : isQuarterSphere1
        ? { OA: ' ' }
      : (isSphere || isHemisphere1 || isHemisphere2 || isQuarterSphere1)
        ? { R: ' ' }
        : { OA: ' ', AB: ' ', CD: '', OpC: '', OpB: '', OD: '' };
    const segmentKinds = isTriangularPrism
      ? { AB: 'plain', BC: 'plain', CA: 'plain', AD: 'plain', BE: 'plain', CF: 'plain', DE: 'plain', EF: 'plain', FD: 'plain' }
      : isTriangularPyramid
        ? { AH: 'plain', BC: 'plain', CD: 'plain', DB: 'plain', AB: 'plain', AC: 'plain', AD: 'plain', BH: 'plain', CH: 'plain', DH: 'plain' }
      : isRightTriangularPyramid1
        ? { AB: 'plain', CB: 'plain', DB: 'plain', AC: 'plain', AD: 'plain', CD: 'plain' }
      : isQuadrangularPyramid
        ? { AH: 'plain', BC: 'plain', CD: 'plain', DE: 'plain', EB: 'plain', AB: 'plain', AC: 'plain', AD: 'plain', AE: 'plain', BH: 'plain', CH: 'plain', DH: 'plain', EH: 'plain' }
      : isPentagonalPyramid
        ? { AH: 'plain', BC: 'plain', CD: 'plain', DE: 'plain', EF: 'plain', FB: 'plain', AB: 'plain', AC: 'plain', AD: 'plain', AE: 'plain', AF: 'plain', BH: 'plain', CH: 'plain', DH: 'plain', EH: 'plain', FH: 'plain' }
      : isHexagonalPyramid
        ? { AH: 'plain', BC: 'plain', CD: 'plain', DE: 'plain', EF: 'plain', FG: 'plain', GB: 'plain', AB: 'plain', AC: 'plain', AD: 'plain', AE: 'plain', AF: 'plain', AG: 'plain', BH: 'plain', CH: 'plain', DH: 'plain', EH: 'plain', FH: 'plain', GH: 'plain' }
      : isRightTriangularPyramid
        ? { BA: 'plain', BC: 'plain', BF: 'plain', AC: 'plain', CF: 'plain', FA: 'plain', CD: 'plain', DA: 'plain', AE: 'plain', EF: 'plain', FG: 'plain', GH: 'plain', HE: 'plain', CG: 'plain', DH: 'plain' }
      : isCrossSection1
        ? { AE: 'plain', EF: 'plain', FG: 'plain', AC: 'plain', CF: 'plain', FA: 'plain' }
      : isCrossSection2
        ? { CD: 'plain', DA: 'plain', AE: 'plain' }
      : isCrossSection3
        ? { BA: 'plain', BC: 'plain', BF: 'plain', PQ: 'plain', QR: 'plain', RS: 'plain', ST: 'plain', TU: 'plain', UP: 'plain', AP: 'single', PD: 'single', DU: 'circle', UC: 'circle', CT: 'cross', TG: 'cross', GS: 'single', SF: 'single', FR: 'circle', RE: 'circle', EQ: 'cross', QA: 'cross' }
      : isRegularTetrahedron
        ? { AB: 'plain', AC: 'plain', AD: 'plain', BC: 'plain', CD: 'plain', DB: 'plain' }
      : isRegularHexahedron
        ? { AB: 'plain', BC: 'plain', CD: 'plain', DA: 'plain', EF: 'plain', FG: 'plain', GH: 'plain', HE: 'plain', AE: 'plain', BF: 'plain', CG: 'plain', DH: 'plain' }
      : isRegularOctahedron
        ? { AB: 'plain', AC: 'plain', AD: 'plain', AE: 'plain', FB: 'plain', FC: 'plain', FD: 'plain', FE: 'plain', BC: 'plain', CD: 'plain', DE: 'plain', EB: 'plain' }
      : isHexagonalPrism
        ? { GH: 'plain', HI: 'plain', IJ: 'plain', JK: 'plain', KL: 'plain', LG: 'plain', AG: 'plain', AB: 'plain', BC: 'plain', CD: 'plain', DE: 'plain', EF: 'plain', FA: 'plain', BH: 'plain', CI: 'plain', DJ: 'plain', EK: 'plain', FL: 'plain' }
      : isPentagonalPrism
        ? { FG: 'plain', GH: 'plain', HI: 'plain', IJ: 'plain', JF: 'plain', AF: 'plain', AB: 'plain', BC: 'plain', CD: 'plain', DE: 'plain', EA: 'plain', BG: 'plain', CH: 'plain', DI: 'plain', EJ: 'plain' }
      : isQuadrangularPrism
        ? { EF: 'plain', FG: 'plain', GH: 'plain', HE: 'plain', AE: 'plain', AB: 'plain', BC: 'plain', CD: 'plain', DA: 'plain', BF: 'plain', CG: 'plain', DH: 'plain' }
      : isCone
        ? { OB: 'plain', AO: 'plain', OC: 'plain', AB: 'plain', AC: 'plain' }
      : isSimilarSolid1
        ? { AOp: 'plain', OpO: 'plain', BO: 'plain', CO: 'plain', AM: 'plain', AN: 'plain', MB: 'plain', NC: 'plain' }
      : isSimilarSolid2
        ? { OGp: 'plain', GpG: 'plain', AB: 'plain', BC: 'plain', CA: 'plain', OL: 'plain', LA: 'plain', OM: 'plain', MB: 'plain', ON: 'plain', NC: 'plain', LM: 'plain', MN: 'plain', NL: 'plain' }
      : isQuarterSphere1
        ? { OA: 'plain' }
      : (isSphere || isHemisphere1 || isHemisphere2 || isQuarterSphere1)
        ? { R: 'plain' }
        : { OA: 'plain', AB: 'plain', CD: 'plain', OpC: 'plain', OpB: 'plain', OD: 'plain' };
    const pointInputs = isTriangularPrism
      ? { A: 'A', B: 'B', C: 'C', D: 'D', E: 'E', F: 'F' }
      : isTriangularPyramid
        ? { A: 'A', B: 'B', C: 'C', D: 'D', H: 'H' }
      : isRightTriangularPyramid1
        ? { A: 'A', B: 'B', C: 'C', D: 'D' }
      : isQuadrangularPyramid
        ? { A: '', B: '', C: '', D: '', E: '', H: '' }
      : isPentagonalPyramid
        ? { A: '', B: '', C: '', D: '', E: '', F: '', H: '' }
      : isHexagonalPyramid
        ? { A: '', B: '', C: '', D: '', E: '', F: '', G: '', H: '' }
      : isRightTriangularPyramid
        ? { A: '', B: '', C: '', D: '', E: '', F: '', G: '', H: '' }
      : isCrossSection1
        ? { A: '', B: '', C: '', D: '', E: '', F: '', G: '', H: '' }
      : isCrossSection2
        ? { A: '', B: '', C: '', D: '', E: '', F: '', G: '', H: '' }
      : isCrossSection3
        ? { A: '', B: '', C: '', D: '', E: '', F: '', G: '', H: '', P: '', Q: '', R: '', S: '', T: '', U: '' }
      : isRegularTetrahedron
        ? { A: '', B: '', C: '', D: '' }
      : isRegularHexahedron
        ? { A: '', B: '', C: '', D: '', E: '', F: '', G: '', H: '' }
      : isRegularOctahedron
        ? { A: '', B: '', C: '', D: '', E: '', F: '' }
      : isRegularDodecahedron
        ? { A: '', B: '', C: '', D: '', E: '', F: '', G: '', H: '', I: '', J: '', K: '', L: '', M: '', N: '', O: '', P: '', Q: '', R: '', S: '', T: '' }
      : isRegularIcosahedron
        ? { A: '', B: '', C: '', D: '', E: '', F: '', G: '', H: '', I: '', J: '', K: '', L: '' }
      : isHexagonalPrism
        ? { A: '', B: '', C: '', D: '', E: '', F: '', G: '', H: '', I: '', J: '', K: '', L: '' }
      : isPentagonalPrism
        ? { A: '', B: '', C: '', D: '', E: '', F: '', G: '', H: '', I: '', J: '' }
      : isQuadrangularPrism
        ? { A: 'A', B: 'B', C: 'C', D: 'D', E: 'E', F: 'F', G: 'G', H: 'H' }
      : isCone
        ? { A: 'A', O: 'O', B: 'B', C: 'C' }
      : isSimilarSolid1
        ? { A: 'A', O: 'O', Op: "O'", B: 'B', C: 'C', M: 'M', N: 'N' }
      : isSimilarSolid2
        ? { O: 'O', G: 'G', Gp: "G'", A: 'A', B: 'B', C: 'C', L: 'L', M: 'M', N: 'N' }
      : isQuarterSphere1
        ? { O: 'O', A: 'A', B: 'B' }
      : (isSphere || isHemisphere1 || isHemisphere2 || isQuarterSphere1)
        ? { O: 'O', A: '' }
        : { O: 'O', A: 'A', B: 'B', Op: "O'", C: 'C', D: 'D' };
    const angleInputs = isTriangularPrism
      ? { BED: '', BEF: '', CFE: '', CFD: '', EBC: '', FCB: '', ABE: '', ACF: '', BAD: '', CAD: '' }
      : isRightTriangularPyramid1
        ? { ABC: '', ABD: '', CBD: '' }
      : isRightTriangularPyramid
        ? { ABC: '', CBF: '', FBA: '' }
      : {};
    const angleKinds = isTriangularPrism
      ? { BED: 'hidden', BEF: 'hidden', CFE: 'hidden', CFD: 'hidden', EBC: 'hidden', FCB: 'hidden', ABE: 'hidden', ACF: 'hidden', BAD: 'hidden', CAD: 'hidden' }
      : isRightTriangularPyramid1
        ? { ABC: 'right', ABD: 'right', CBD: 'right' }
      : isRightTriangularPyramid
        ? { ABC: 'right', CBF: 'right', FBA: 'right' }
      : {};
    const defaultAreaIds = isRightTriangularPyramid ? ['ABF', 'ABC', 'BCF'] : isCrossSection1 ? ['ACF'] : isCrossSection2 ? ['ACGE'] : isCrossSection3 ? ['PQRSTU'] : [];
    const areaIds = Array.isArray(config.areaIds) ? config.areaIds.slice() : defaultAreaIds;
    const areaInputs = {};
    const areaColors = {};
    areaIds.forEach(function (id) {
      areaInputs[id] = '';
      areaColors[id] = isCrossSection3 && id === 'PQRSTU' ? '#e5484d' : '#2a5bd7';
    });
    const labelOffsets = { segment: {}, point: {}, angle: {}, area: {} };
    const currentLabelBases = {};
    const currentAreas = {};
    let moveMode = null;
    let moveDrag = null;
    let decimalPlaces = 2;
    setActiveDecimalPlaces(decimalPlaces);
    const RATIO_LABEL_PREFIX = 'ratio:';
    const RAW_NUMERIC_LABEL_VALUE = 'raw:';
    const RATIO_LABEL_HINT = '比の値は「マーク,数値」の形式で入力します。例: s,5 / t,4.4 / r,5/3\ns: 四角で囲む\nt: 三角で囲む\nr: 丸で囲む';
    const LabelEngine = window.InstantGeometryDrawLabelEngine || window.InstantGeometryTriangleLabelEngine || null;
    let labelController = null;
    const moveToolbar = document.createElement('div');
    moveToolbar.className = 'move-toolbar';
    moveToolbar.setAttribute('aria-hidden', 'true');
    const moveCancelBtn = document.createElement('button');
    moveCancelBtn.className = 'btn';
    moveCancelBtn.type = 'button';
    moveCancelBtn.textContent = 'キャンセル';
    const moveDoneBtn = document.createElement('button');
    moveDoneBtn.className = 'btn action-primary';
    moveDoneBtn.type = 'button';
    moveDoneBtn.textContent = '完了';
    moveToolbar.appendChild(moveCancelBtn);
    moveToolbar.appendChild(moveDoneBtn);
    document.body.appendChild(moveToolbar);

    if (window.InstantGeometrySaveQuota) {
      window.InstantGeometrySaveQuota.createIndicator({ target: saveBtn });
    }

    function setStatus(message, isError) {
      statusBox.textContent = message;
      statusBox.classList.toggle('error', !!isError);
    }

    function closeSheets() {
      if (editSheet) {
        editSheet.classList.remove('open');
        editSheet.setAttribute('aria-hidden', 'true');
      }
      saveSheet.classList.remove('open');
      saveSheet.setAttribute('aria-hidden', 'true');
      sheetBackdrop.classList.remove('open');
      if (sheetBody) sheetBody.innerHTML = '';
    }

    function labelKey(kind, id) {
      return kind + ':' + id;
    }

    function ensureLabelOffset(kind, id) {
      if (!labelOffsets[kind]) labelOffsets[kind] = {};
      if (!labelOffsets[kind][id]) labelOffsets[kind][id] = { x: 0, y: 0 };
      return labelOffsets[kind][id];
    }

    function getLabelOffset(kind, id) {
      return labelOffsets[kind] && labelOffsets[kind][id] ? labelOffsets[kind][id] : { x: 0, y: 0 };
    }

    function getLabelPosition(kind, id, basePosition) {
      currentLabelBases[labelKey(kind, id)] = { x: basePosition.x, y: basePosition.y };
      const offset = getLabelOffset(kind, id);
      return { x: basePosition.x + offset.x, y: basePosition.y + offset.y };
    }

    function ensureAreaState(id) {
      if (!Object.prototype.hasOwnProperty.call(areaInputs, id)) areaInputs[id] = '';
      if (!Object.prototype.hasOwnProperty.call(areaColors, id)) areaColors[id] = '#2a5bd7';
    }

    function areaName(id, pointCount) {
      return pointCount === 3 ? '△' + id : '面積' + id;
    }

    function isMoveTarget(kind, id) {
      return moveMode && moveMode.kind === kind && moveMode.id === id;
    }

    function updateMoveModeUi() {
      const active = Boolean(moveMode);
      document.body.classList.toggle('label-move-active', active);
      if (captureRoot) captureRoot.classList.toggle('label-move-active', active);
      moveToolbar.classList.toggle('open', active);
      moveToolbar.setAttribute('aria-hidden', active ? 'false' : 'true');
    }

    function pointerToSvgPoint(event) {
      const matrix = stage.getScreenCTM();
      if (!matrix) return { x: 0, y: 0 };
      const point = stage.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const transformed = point.matrixTransform(matrix.inverse());
      return { x: transformed.x, y: transformed.y };
    }

    function finishMoveMode(restoreOffset) {
      if (!moveMode) return;
      const previous = moveMode;
      if (restoreOffset) {
        ensureLabelOffset(previous.kind, previous.id);
        labelOffsets[previous.kind][previous.id] = previous.originalOffset;
      }
      moveMode = null;
      moveDrag = null;
      updateMoveModeUi();
      render();
      if (previous.kind === 'point') openPointModal(previous.id);
      else if (previous.kind === 'angle') openAngleModal(previous.id);
      else if (previous.kind === 'area') openAreaModal(previous.id);
      else openSegmentModal(previous.id);
    }

    function enterMoveMode(kind, id) {
      if (kind === 'point' && !pointInputs[id]) {
        setStatus('ラベルを表示してから移動してください。', true);
        openPointModal(id);
        return;
      }
      if (kind === 'segment' && !segmentInputs[id]) {
        setStatus('ラベルを表示してから移動してください。', true);
        openSegmentModal(id);
        return;
      }
      if (kind === 'angle' && !angleInputs[id]) {
        setStatus('ラベルを表示してから移動してください。', true);
        openAngleModal(id);
        return;
      }
      if (kind === 'area') ensureAreaState(id);
      if (kind === 'area' && !areaInputs[id]) {
        setStatus('ラベルを表示してから移動してください。', true);
        openAreaModal(id);
        return;
      }
      const key = labelKey(kind, id);
      if (!currentLabelBases[key]) {
        setStatus('ラベルを表示してから移動してください。', true);
        if (kind === 'point') openPointModal(id);
        else if (kind === 'angle') openAngleModal(id);
        else if (kind === 'area') openAreaModal(id);
        else openSegmentModal(id);
        return;
      }
      const originalOffset = getLabelOffset(kind, id);
      moveMode = {
        kind: kind,
        id: id,
        originalOffset: { x: originalOffset.x, y: originalOffset.y }
      };
      closeSheets();
      updateMoveModeUi();
      render();
    }

    function openSaveSheet() {
      closeSheets();
      saveSheet.classList.add('open');
      saveSheet.setAttribute('aria-hidden', 'false');
      sheetBackdrop.classList.add('open');
    }

    function readGeometry() {
      if (isTriangularPrism) {
        const AB = parsePositive(abInput.value, 'AB');
        const BC = parsePositive(bcInput.value, 'BC');
        const CA = parsePositive(caInput.value, 'CA');
        const AD = parsePositive(adInput.value, 'AD');
        if (AB + BC <= CA || BC + CA <= AB || CA + AB <= BC) {
          throw new Error('AB, BC, CA が三角形になる長さを入力してください。');
        }
        return { AB: AB, BC: BC, CA: CA, AD: AD };
      }
      if (isTriangularPyramid) {
        const AH = parsePositive(ahInput.value, 'AH');
        const BC = parsePositive(bcInput.value, 'BC');
        const CD = parsePositive(cdInput.value, 'CD');
        const DB = parsePositive(dbInput.value, 'DB');
        if (BC + CD <= DB || CD + DB <= BC || DB + BC <= CD) {
          throw new Error('BC, CD, DB が三角形になる長さを入力してください。');
        }
        return { AH: AH, BC: BC, CD: CD, DB: DB };
      }
      if (isRightTriangularPyramid1) {
        const AB = parsePositive(abInput.value, 'AB');
        const CB = parsePositive(cbInput.value, 'CB');
        const DB = parsePositive(dbInput.value, 'DB');
        return { AB: AB, CB: CB, DB: DB };
      }
      if (isQuadrangularPyramid) {
        const AH = parsePositive(ahInput.value, 'AH');
        const BC = parsePositive(bcInput.value, 'BC');
        const CD = parsePositive(cdInput.value, 'CD');
        const DE = parsePositive(deInput.value, 'DE');
        const EB = parsePositive(ebInput.value, 'EB');
        const sides = [BC, CD, DE, EB];
        const maxSide = Math.max.apply(null, sides);
        const perimeter = BC + CD + DE + EB;
        if (maxSide >= perimeter - maxSide) {
          throw new Error('BC, CD, DE, EB が四角形になる長さを入力してください。');
        }
        return { AH: AH, BC: BC, CD: CD, DE: DE, EB: EB };
      }
      if (isPentagonalPyramid) {
        const AH = parsePositive(ahInput.value, 'AH');
        const BC = parsePositive(bcInput.value, 'BC');
        const CD = parsePositive(cdInput.value, 'CD');
        const DE = parsePositive(deInput.value, 'DE');
        const EF = parsePositive(efInput.value, 'EF');
        const FB = parsePositive(fbInput.value, 'FB');
        const sides = [BC, CD, DE, EF, FB];
        const maxSide = Math.max.apply(null, sides);
        const perimeter = BC + CD + DE + EF + FB;
        if (maxSide >= perimeter - maxSide) {
          throw new Error('BC, CD, DE, EF, FB が五角形になる長さを入力してください。');
        }
        return { AH: AH, BC: BC, CD: CD, DE: DE, EF: EF, FB: FB };
      }
      if (isHexagonalPyramid) {
        const AH = parsePositive(ahInput.value, 'AH');
        const BC = parsePositive(bcInput.value, 'BC');
        const CD = parsePositive(cdInput.value, 'CD');
        const DE = parsePositive(deInput.value, 'DE');
        const EF = parsePositive(efInput.value, 'EF');
        const FG = parsePositive(fgInput.value, 'FG');
        const GB = parsePositive(gbInput.value, 'GB');
        const sides = [BC, CD, DE, EF, FG, GB];
        const maxSide = Math.max.apply(null, sides);
        const perimeter = BC + CD + DE + EF + FG + GB;
        if (maxSide >= perimeter - maxSide) {
          throw new Error('BC, CD, DE, EF, FG, GB が六角形になる長さを入力してください。');
        }
        return { AH: AH, BC: BC, CD: CD, DE: DE, EF: EF, FG: FG, GB: GB };
      }
      if (isRightTriangularPyramid) {
        const BA = parsePositive(baInput.value, 'BA');
        const BC = parsePositive(bcInput.value, 'BC');
        const BF = parsePositive(bfInput.value, 'BF');
        return { BA: BA, BC: BC, BF: BF };
      }
      if (isCrossSection1) {
        const AE = parsePositive(aeInput.value, 'AE');
        const EF = parsePositive(efInput.value, 'EF');
        const FG = parsePositive(fgInput.value, 'FG');
        return { AE: AE, EF: EF, FG: FG };
      }
      if (isCrossSection2) {
        const CD = parsePositive(cdInput.value, 'CD');
        const DA = parsePositive(daInput.value, 'DA');
        const AE = parsePositive(aeInput.value, 'AE');
        return { CD: CD, DA: DA, AE: AE };
      }
      if (isCrossSection3) {
        const BA = parsePositive(baInput.value, 'BA');
        const BC = parsePositive(bcInput.value, 'BC');
        const BF = parsePositive(bfInput.value, 'BF');
        return { BA: BA, BC: BC, BF: BF };
      }
      if (isRegularTetrahedron) {
        return { a: parsePositive(aInput.value, 'a') };
      }
      if (isRegularHexahedron) {
        return { a: parsePositive(aInput.value, 'a') };
      }
      if (isRegularOctahedron) {
        return { a: parsePositive(aInput.value, 'a') };
      }
      if (isRegularDodecahedron) {
        return { a: parsePositive(aInput.value, 'a') };
      }
      if (isRegularIcosahedron) {
        return { a: parsePositive(aInput.value, 'a') };
      }
      if (isSimilarSolid1) {
        const AOp = parsePositive(aopInput.value, "AO'");
        const OpO = parsePositive(opoInput.value, "O'O");
        const BO = parsePositive(boInput.value, 'BO');
        return { AOp: AOp, OpO: OpO, BO: BO };
      }
      if (isSimilarSolid2) {
        const OGp = parsePositive(ogpInput.value, "OG'");
        const GpG = parsePositive(gpgInput.value, "G'G");
        const AB = parsePositive(abInput.value, 'AB');
        const BC = parsePositive(bcInput.value, 'BC');
        const CA = parsePositive(caInput.value, 'CA');
        if (AB + BC <= CA || BC + CA <= AB || CA + AB <= BC) {
          throw new Error('AB, BC, CA が三角形になる長さを入力してください。');
        }
        return { OGp: OGp, GpG: GpG, AB: AB, BC: BC, CA: CA };
      }
      if (isQuadrangularPrism) {
        const EF = parsePositive(efInput.value, 'EF');
        const FG = parsePositive(fgInput.value, 'FG');
        const GH = parsePositive(ghInput.value, 'GH');
        const HE = parsePositive(heInput.value, 'HE');
        const AE = parsePositive(aeInput.value, 'AE');
        const sides = [EF, FG, GH, HE];
        const maxSide = Math.max.apply(null, sides);
        const perimeter = EF + FG + GH + HE;
        if (maxSide >= perimeter - maxSide) {
          throw new Error('EF, FG, GH, HE が四角形になる長さを入力してください。');
        }
        return { EF: EF, FG: FG, GH: GH, HE: HE, AE: AE };
      }
      if (isPentagonalPrism) {
        const FG = parsePositive(fgInput.value, 'FG');
        const GH = parsePositive(ghInput.value, 'GH');
        const HI = parsePositive(hiInput.value, 'HI');
        const IJ = parsePositive(ijInput.value, 'IJ');
        const JF = parsePositive(jfInput.value, 'JF');
        const AF = parsePositive(afInput.value, 'AF');
        const sides = [FG, GH, HI, IJ, JF];
        const maxSide = Math.max.apply(null, sides);
        const perimeter = FG + GH + HI + IJ + JF;
        if (maxSide >= perimeter - maxSide) {
          throw new Error('FG, GH, HI, IJ, JF が五角形になる長さを入力してください。');
        }
        return { FG: FG, GH: GH, HI: HI, IJ: IJ, JF: JF, AF: AF };
      }
      if (isHexagonalPrism) {
        const GH = parsePositive(ghInput.value, 'GH');
        const HI = parsePositive(hiInput.value, 'HI');
        const IJ = parsePositive(ijInput.value, 'IJ');
        const JK = parsePositive(jkInput.value, 'JK');
        const KL = parsePositive(klInput.value, 'KL');
        const LG = parsePositive(lgInput.value, 'LG');
        const AG = parsePositive(agInput.value, 'AG');
        const sides = [GH, HI, IJ, JK, KL, LG];
        const maxSide = Math.max.apply(null, sides);
        const perimeter = GH + HI + IJ + JK + KL + LG;
        if (maxSide >= perimeter - maxSide) {
          throw new Error('GH, HI, IJ, JK, KL, LG が六角形になる長さを入力してください。');
        }
        return { GH: GH, HI: HI, IJ: IJ, JK: JK, KL: KL, LG: LG, AG: AG };
      }
      if (isQuarterSphere1) {
        return {
          radius: parsePositive(radiusInput.value, 'OA')
        };
      }
      if (isSphere || isHemisphere1 || isHemisphere2) {
        return {
          radius: parsePositive(radiusInput.value, '半径')
        };
      }
      return {
        radius: parsePositive(radiusInput.value, '半径'),
        height: parsePositive(heightInput.value, '高さ')
      };
    }

    function isNumericLabelValue(value) {
      return value === ' ' || value === '0';
    }

    function isRawNumericLabelValue(value) {
      return value === RAW_NUMERIC_LABEL_VALUE;
    }

    function rawSegmentInput(id) {
      const input = document.getElementById(String(id).toLowerCase() + 'Input');
      return input ? String(input.value || '').trim() : '';
    }

    function parseRatioLabelInput(value) {
      const text = String(value || '').trim();
      const parts = text.split(',');
      if (parts.length !== 2) return null;
      const mark = parts[0].trim().toLowerCase();
      const number = parts[1].trim();
      const decimalPattern = /^(?:[1-9][0-9]*(?:\.[0-9]+)?|0\.[0-9]*[1-9][0-9]*)$/;
      const fractionPattern = /^[1-9][0-9]*\/[1-9][0-9]*$/;
      if (!/^[rts]$/.test(mark)) return null;
      if (!decimalPattern.test(number) && !fractionPattern.test(number)) return null;
      return { mark: mark, value: number, source: mark + ',' + number };
    }

    function isRatioLabelValue(value) {
      return String(value || '').indexOf(RATIO_LABEL_PREFIX) === 0 && Boolean(parseRatioLabelInput(String(value).slice(RATIO_LABEL_PREFIX.length)));
    }

    function getRatioLabelInput(value) {
      return isRatioLabelValue(value) ? String(value).slice(RATIO_LABEL_PREFIX.length) : '';
    }

    function getDisplayMode(value) {
      if (value === '') return 'hidden';
      if (isRatioLabelValue(value)) return 'ratio';
      if (isRawNumericLabelValue(value)) return 'numeric';
      if (isNumericLabelValue(value)) return 'numeric';
      return 'text';
    }

    function dimensionText(id, fallbackValue, exactLabel) {
      const input = String(segmentInputs[id] || '');
      if (!input) return '';
      if (isRatioLabelValue(input)) return input;
      if (isRawNumericLabelValue(input)) {
        const raw = rawSegmentInput(id);
        if (raw) return raw;
      }
      if (isNumericLabelValue(input)) {
        return exactLabel || fmt(fallbackValue);
      }
      if (isRawNumericLabelValue(input)) return exactLabel || fmt(fallbackValue);
      const custom = input.trim();
      if (custom) return custom;
      return exactLabel || fmt(fallbackValue);
    }

    function angleText(id, fallbackValue) {
      const input = String(angleInputs[id] || '');
      if (!input) return '';
      if (isRatioLabelValue(input)) return input;
      if (isNumericLabelValue(input)) return formatAngleValue(fallbackValue);
      const custom = input.trim();
      if (custom) return custom;
      return formatAngleValue(fallbackValue);
    }

    function formatAngleValue(degrees) {
      const settings = window.InstantGeometryDrawSettings;
      if (settings && typeof settings.formatAngleDegrees === 'function') return settings.formatAngleDegrees(degrees);
      return fmt(degrees) + '°';
    }

    function areaText(id, fallbackValue) {
      ensureAreaState(id);
      const input = String(areaInputs[id] || '');
      if (!input) return '';
      if (isRatioLabelValue(input)) return input;
      if (isNumericLabelValue(input)) return fmt(fallbackValue);
      const custom = input.trim();
      if (custom) return custom;
      return fmt(fallbackValue);
    }

    function segmentName(id) {
      if (id === 'AOp') return "AO'";
      if (id === 'OpO') return "O'O";
      if (id === 'OGp') return "OG'";
      if (id === 'GpG') return "G'G";
      if (id === 'OpC') return "O'C";
      if (id === 'OpB') return "O'B";
      return id;
    }

    function stageToLayerPoint(x, y) {
      const rect = stage.getBoundingClientRect();
      const scale = Math.min(rect.width / 1000, rect.height / 1000);
      return {
        x: (rect.width - 1000 * scale) / 2 + x * scale,
        y: (rect.height - 1000 * scale) / 2 + y * scale
      };
    }

    function ratioLabelMarkup(parsed) {
      const safe = String(parsed.value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const shape = parsed.mark === 'r'
        ? 'border-radius:999px;'
        : parsed.mark === 't'
          ? 'clip-path:polygon(50% 3%, 97% 92%, 3% 92%);padding-top:.18em;'
          : 'border-radius:4px;';
      return '<span style="display:inline-flex;align-items:center;justify-content:center;min-width:1.55em;height:1.35em;padding:0 .24em;border:2px solid currentColor;background:#fff;' + shape + '">' + safe + '</span>';
    }

    function setLabelContent(node, text, type) {
      const labelType = type || 'segment';
      const parsed = isRatioLabelValue(text) ? parseRatioLabelInput(String(text).slice(RATIO_LABEL_PREFIX.length)) : null;
      if (parsed) {
        node.removeAttribute('data-type');
        node.dataset.kind = 'ratio';
        node.innerHTML = ratioLabelMarkup(parsed);
        return;
      }
      node.dataset.type = labelType;
      delete node.dataset.kind;
      node.dataset.igRawLabel = text;
      node.innerHTML = '';
      if (window.InstantGeometrySharedLabels && typeof window.InstantGeometrySharedLabels.renderKatexLabelContent === 'function') {
        if (window.InstantGeometrySharedLabels.renderKatexLabelContent(node, text, labelType)) return;
      }
      if (window.katex && typeof window.katex.render === 'function' && window.InstantGeometrySharedLabels && typeof window.InstantGeometrySharedLabels.labelTextToLatex === 'function') {
        try {
          window.katex.render(window.InstantGeometrySharedLabels.labelTextToLatex(text, labelType), node, {
            throwOnError: false,
            output: 'html',
            strict: 'ignore'
          });
          return;
        } catch (_) {}
      }
      if (window.katex && typeof window.katex.render === 'function') {
        try {
          window.katex.render(String(text || ''), node, {
            throwOnError: false,
            output: 'html',
            strict: 'ignore'
          });
          return;
        } catch (_) {}
      }
      if (window.InstantGeometrySharedLabels && typeof window.InstantGeometrySharedLabels.toMathLikeHtml === 'function') {
        node.innerHTML = window.InstantGeometrySharedLabels.toMathLikeHtml(text);
      } else {
        node.textContent = text;
      }
    }

    function addFloatingLabel(text, x, y, id) {
      if (!labelLayer) return null;
      if (!text) return null;
      const positioned = getLabelPosition('segment', id, { x: x, y: y });
      const point = stageToLayerPoint(positioned.x, positioned.y);
      const node = document.createElement('div');
      node.className = 'floating-label';
      node.dataset.id = id;
      if (isMoveTarget('segment', id)) node.classList.add('label-move-target');
      node.style.left = point.x + 'px';
      node.style.top = point.y + 'px';
      node.style.fontSize = '24px';
      node.style.transform = 'translate(-50%, -50%)';
      setLabelContent(node, text, 'segment');
      labelLayer.appendChild(node);
      return attachSegmentModal(node, id);
    }

    function addAngleLabel(text, x, y, id) {
      if (!labelLayer) return null;
      if (!text) return null;
      const positioned = getLabelPosition('angle', id, { x: x, y: y });
      const point = stageToLayerPoint(positioned.x, positioned.y);
      const node = document.createElement('div');
      node.className = 'floating-label';
      node.dataset.id = id;
      if (isMoveTarget('angle', id)) node.classList.add('label-move-target');
      node.style.left = point.x + 'px';
      node.style.top = point.y + 'px';
      node.style.fontSize = '22px';
      node.style.transform = 'translate(-50%, -50%)';
      setLabelContent(node, text, 'angle');
      labelLayer.appendChild(node);
      return attachAngleModal(node, id);
    }

    function addPointLabel(text, x, y, id) {
      if (!labelLayer) return null;
      if (!text) return null;
      const positioned = getLabelPosition('point', id, { x: x, y: y });
      const point = stageToLayerPoint(positioned.x, positioned.y);
      const node = document.createElement('div');
      node.className = 'floating-label';
      node.dataset.id = id;
      if (isMoveTarget('point', id)) node.classList.add('label-move-target');
      node.style.left = point.x + 'px';
      node.style.top = point.y + 'px';
      node.style.fontSize = '22px';
      node.style.transform = 'translate(-50%, -50%)';
      setLabelContent(node, text, 'point');
      labelLayer.appendChild(node);
      return attachPointModal(node, id);
    }

    function addAreaLabel(text, x, y, id) {
      if (!labelLayer) return null;
      if (!text) return null;
      ensureAreaState(id);
      const positioned = getLabelPosition('area', id, { x: x, y: y });
      const point = stageToLayerPoint(positioned.x, positioned.y);
      const color = areaColors[id] || '#2a5bd7';
      const node = document.createElement('div');
      node.className = 'floating-label';
      node.dataset.id = id;
      if (isMoveTarget('area', id)) node.classList.add('label-move-target');
      node.style.left = point.x + 'px';
      node.style.top = point.y + 'px';
      node.style.fontSize = '24px';
      node.style.color = color;
      node.style.transform = 'translate(-50%, -50%)';
      setLabelContent(node, text, 'area');
      labelLayer.appendChild(node);
      return attachAreaModal(node, id);
    }

    function buildCheckbox(labelText, checked) {
      if (window.InstantGeometryDrawLabelEngine && typeof window.InstantGeometryDrawLabelEngine.buildCheckbox === 'function') {
        return window.InstantGeometryDrawLabelEngine.buildCheckbox(labelText, checked);
      }
      const field = document.createElement('label');
      field.className = 'sheet-field checkbox-field';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = !!checked;
      const span = document.createElement('span');
      span.textContent = labelText;
      field.appendChild(input);
      field.appendChild(span);
      return { field: field, input: input };
    }

    function buildSelect(labelText, value, options) {
      if (window.InstantGeometryDrawLabelEngine && typeof window.InstantGeometryDrawLabelEngine.buildSelect === 'function') {
        return window.InstantGeometryDrawLabelEngine.buildSelect(labelText, value, options);
      }
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

    function buildDecimalPlacesSelect(value) {
      return buildSelect('小数表示', String(clampDecimalPlaces(value)), [
        { value: '0', label: '整数' },
        { value: '1', label: '小数第1位' },
        { value: '2', label: '小数第2位' },
        { value: '3', label: '小数第3位' },
        { value: '4', label: '小数第4位' },
        { value: '5', label: '小数第5位' },
        { value: '6', label: '小数第6位' }
      ]);
    }

    function buildLabelSizeField(kind, id) {
      if (window.InstantGeometryDrawLabelEngine && typeof window.InstantGeometryDrawLabelEngine.buildRangeField === 'function') {
        return window.InstantGeometryDrawLabelEngine.buildRangeField(
          'ラベルサイズ',
          Math.round(getLabelScale(kind, id) * 100),
          10,
          400,
          10,
          function (scaleValue) { return scaleValue + '%'; }
        );
      }
      return buildSelect('ラベルサイズ', '100', [
        { value: '100', label: '100%' },
        { value: '150', label: '150%' },
        { value: '200', label: '200%' }
      ]);
    }

    function buildColorField(kind, id) {
      if (window.InstantGeometryDrawLabelEngine && typeof window.InstantGeometryDrawLabelEngine.buildColorPalette === 'function') {
        return window.InstantGeometryDrawLabelEngine.buildColorPalette('色', getLabelColor(kind, id));
      }
      return buildSelect('色', getLabelColor(kind, id), [
        { value: '#2a5bd7', label: '青' },
        { value: '#111827', label: '黒' },
        { value: '#e53935', label: '赤' }
      ]);
    }

    function buildLabelEditor(labelText, value) {
      if (window.InstantGeometryDrawLabelEngine && typeof window.InstantGeometryDrawLabelEngine.buildLabelEditor === 'function') {
        return window.InstantGeometryDrawLabelEngine.buildLabelEditor(labelText, value, true);
      }
      const field = document.createElement('div');
      field.className = 'sheet-field';
      const label = document.createElement('label');
      label.textContent = labelText;
      const mode = document.createElement('select');
      [
        { value: 'hidden', label: '非表示' },
        { value: 'numeric', label: '数値（自動）' },
        { value: 'ratio', label: '比の値' },
        { value: 'text', label: '自由入力' }
      ].forEach(function (option) {
        const node = document.createElement('option');
        node.value = option.value;
        node.textContent = option.label;
        if (option.value === getDisplayMode(value)) node.selected = true;
        mode.appendChild(node);
      });
      const input = document.createElement('input');
      input.type = 'text';
      input.value = getDisplayMode(value) === 'text' ? String(value || '') : getRatioLabelInput(value);
      input.setAttribute('inputmode', 'text');
      input.autocapitalize = 'none';
      input.autocomplete = 'off';
      input.spellcheck = false;
      function sync() {
        const editable = mode.value === 'text' || mode.value === 'ratio';
        input.disabled = !editable;
        input.placeholder = mode.value === 'ratio' ? '例: s,5 / t,4.4 / r,5/3' : '';
      }
      mode.addEventListener('change', sync);
      field.appendChild(label);
      field.appendChild(mode);
      field.appendChild(input);
      sync();
      return { field: field, mode: mode, input: input };
    }

    function buildPointLabelEditor(labelText, value) {
      const field = document.createElement('div');
      field.className = 'sheet-field';
      const label = document.createElement('label');
      label.textContent = labelText;
      const mode = document.createElement('select');
      [
        { value: 'hidden', label: '非表示' },
        { value: 'text', label: '自由入力' }
      ].forEach(function (option) {
        const node = document.createElement('option');
        node.value = option.value;
        node.textContent = option.label;
        if ((value ? 'text' : 'hidden') === option.value) node.selected = true;
        mode.appendChild(node);
      });
      const input = document.createElement('input');
      input.type = 'text';
      input.value = String(value || '');
      input.setAttribute('inputmode', 'text');
      input.autocapitalize = 'none';
      input.autocomplete = 'off';
      input.spellcheck = false;
      function sync() {
        input.disabled = mode.value !== 'text';
      }
      mode.addEventListener('change', sync);
      field.appendChild(label);
      field.appendChild(mode);
      field.appendChild(input);
      sync();
      return { field: field, mode: mode, input: input };
    }

    function buildColorPalette(labelText, value) {
      if (window.InstantGeometryDrawLabelEngine && typeof window.InstantGeometryDrawLabelEngine.buildColorPalette === 'function') {
        return window.InstantGeometryDrawLabelEngine.buildColorPalette(labelText, value);
      }
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

    function openPointModal(id) {
      if (labelController) {
        labelController.openEditSheet('point', id);
        return;
      }
      closeSheets();
      if (!editSheet || !sheetTitle || !sheetBody) return;
      const pointName = id === 'Op' ? "O'" : id;
      sheetTitle.textContent = '点' + pointName;
      const editor = buildPointLabelEditor('ラベル', pointInputs[id]);
      if (!pointInputs[id]) editor.input.value = pointName;
      sheetBody.appendChild(editor.field);
      const hint = document.createElement('p');
      hint.className = 'sheet-hint';
      hint.textContent = '点ラベルです。非表示または自由入力を選べます。';
      sheetBody.appendChild(hint);
      const actions = document.createElement('div');
      actions.className = 'sheet-actions';
      actions.classList.add('has-move');
      const cancel = document.createElement('button');
      cancel.className = 'btn';
      cancel.type = 'button';
      cancel.textContent = 'キャンセル';
      cancel.addEventListener('click', closeSheets);
      function applyCurrentValue() {
        pointInputs[id] = editor.mode.value === 'text' ? (String(editor.input.value || '').trim() || pointName) : '';
      }
      const move = document.createElement('button');
      move.className = 'btn action-secondary';
      move.type = 'button';
      move.textContent = '移動';
      move.addEventListener('click', function () {
        try {
          applyCurrentValue();
          render();
          enterMoveMode('point', id);
        } catch (error) {
          setStatus(error.message || '入力を確認してください。', true);
        }
      });
      const save = document.createElement('button');
      save.className = 'btn action-primary';
      save.type = 'button';
      save.textContent = '保存';
      save.addEventListener('click', function () {
        try {
          applyCurrentValue();
          closeSheets();
          render();
        } catch (error) {
          setStatus(error.message || '入力を確認してください。', true);
        }
      });
      actions.appendChild(cancel);
      actions.appendChild(move);
      actions.appendChild(save);
      sheetBody.appendChild(actions);
      editSheet.classList.add('open');
      editSheet.setAttribute('aria-hidden', 'false');
      sheetBackdrop.classList.add('open');
    }

    function openSegmentModal(id) {
      if (labelController) {
        labelController.openEditSheet('segment', id);
        return;
      }
      closeSheets();
      if (!editSheet || !sheetTitle || !sheetBody) return;
      sheetTitle.textContent = '線分' + segmentName(id);
      const kindSelect = buildSelect('種類', segmentKinds[id] || 'plain', [
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
      ]);
      sheetBody.appendChild(kindSelect.field);
      const checkbox = buildCheckbox('弧を表示', segmentArcVisible[id] !== false);
      sheetBody.appendChild(checkbox.field);
      const editor = buildLabelEditor('ラベル', segmentInputs[id]);
      sheetBody.appendChild(editor.field);
      const decimalBuilt = buildDecimalPlacesSelect(decimalPlaces);
      sheetBody.appendChild(decimalBuilt.field);
      const hint = document.createElement('p');
      hint.className = 'sheet-hint';
      hint.textContent = '線分ラベルです。非表示、数値、比の値、自由入力を選べます。\n' + RATIO_LABEL_HINT;
      sheetBody.appendChild(hint);
      const actions = document.createElement('div');
      actions.className = 'sheet-actions';
      actions.classList.add('has-move');
      const cancel = document.createElement('button');
      cancel.className = 'btn';
      cancel.type = 'button';
      cancel.textContent = 'キャンセル';
      cancel.addEventListener('click', closeSheets);
      function applyCurrentValue() {
        decimalPlaces = setActiveDecimalPlaces(decimalBuilt.select.value);
        segmentKinds[id] = kindSelect.select.value;
        segmentArcVisible[id] = !!checkbox.input.checked;
        if (editor.mode.value === 'hidden') {
          segmentInputs[id] = '';
        } else if (editor.mode.value === 'numeric') {
          segmentInputs[id] = ' ';
        } else if (editor.mode.value === 'numericRaw') {
          segmentInputs[id] = RAW_NUMERIC_LABEL_VALUE;
        } else if (editor.mode.value === 'ratio') {
          const ratio = parseRatioLabelInput(editor.input.value);
          if (!ratio) throw new Error('比の値は「r,5」「t,4.4」「s,5/3」の形式で入力してください。');
          segmentInputs[id] = RATIO_LABEL_PREFIX + ratio.source;
        } else {
          segmentInputs[id] = String(editor.input.value || '');
        }
        if (editor.mode.value === 'hidden') segmentArcVisible[id] = false;
      }
      const move = document.createElement('button');
      move.className = 'btn action-secondary';
      move.type = 'button';
      move.textContent = '移動';
      move.addEventListener('click', function () {
        try {
          applyCurrentValue();
          render();
          enterMoveMode('segment', id);
        } catch (error) {
          setStatus(error.message || '入力を確認してください。', true);
        }
      });
      const save = document.createElement('button');
      save.className = 'btn action-primary';
      save.type = 'button';
      save.textContent = '保存';
      save.addEventListener('click', function () {
        try {
          applyCurrentValue();
          closeSheets();
          render();
        } catch (error) {
          setStatus(error.message || '入力を確認してください。', true);
        }
      });
      actions.appendChild(cancel);
      actions.appendChild(move);
      actions.appendChild(save);
      sheetBody.appendChild(actions);
      editSheet.classList.add('open');
      editSheet.setAttribute('aria-hidden', 'false');
      sheetBackdrop.classList.add('open');
    }

    function openAngleModal(id) {
      if (labelController) {
        labelController.openEditSheet('angle', id);
        return;
      }
      closeSheets();
      if (!editSheet || !sheetTitle || !sheetBody) return;
      sheetTitle.textContent = '角' + id;
      let kindSelect = null;
      if (window.InstantGeometryMobileAngleOrnaments) {
        kindSelect = window.InstantGeometryMobileAngleOrnaments.appendAngleKindSelect(
          sheetBody,
          buildSelect,
          angleKinds[id] || 'plain',
          90
        );
      } else {
        const built = buildSelect('種類', angleKinds[id] || 'plain', [
          { value: 'plain', label: '通常' },
          { value: 'right', label: '直角記号付き' },
          { value: 'hidden', label: '角弧なし' }
        ]);
        kindSelect = built.select;
        sheetBody.appendChild(built.field);
      }
      const editor = buildLabelEditor('ラベル', angleInputs[id]);
      sheetBody.appendChild(editor.field);
      const hint = document.createElement('p');
      hint.className = 'sheet-hint';
      hint.textContent = '角ラベルです。非表示、数値、比の値、自由入力を選べます。\n' + RATIO_LABEL_HINT;
      sheetBody.appendChild(hint);
      const actions = document.createElement('div');
      actions.className = 'sheet-actions';
      actions.classList.add('has-move');
      const cancel = document.createElement('button');
      cancel.className = 'btn';
      cancel.type = 'button';
      cancel.textContent = 'キャンセル';
      cancel.addEventListener('click', closeSheets);
      function applyCurrentValue() {
        angleKinds[id] = kindSelect ? kindSelect.value : (angleKinds[id] || 'plain');
        if (editor.mode.value === 'hidden') {
          angleInputs[id] = '';
        } else if (editor.mode.value === 'numeric') {
          angleInputs[id] = ' ';
        } else if (editor.mode.value === 'ratio') {
          const ratio = parseRatioLabelInput(editor.input.value);
          if (!ratio) throw new Error('比の値は「r,5」「t,4.4」「s,5/3」の形式で入力してください。');
          angleInputs[id] = RATIO_LABEL_PREFIX + ratio.source;
        } else {
          angleInputs[id] = String(editor.input.value || '');
        }
      }
      const move = document.createElement('button');
      move.className = 'btn action-secondary';
      move.type = 'button';
      move.textContent = '移動';
      move.addEventListener('click', function () {
        try {
          applyCurrentValue();
          render();
          enterMoveMode('angle', id);
        } catch (error) {
          setStatus(error.message || '入力を確認してください。', true);
        }
      });
      const save = document.createElement('button');
      save.className = 'btn action-primary';
      save.type = 'button';
      save.textContent = '保存';
      save.addEventListener('click', function () {
        try {
          applyCurrentValue();
          closeSheets();
          render();
        } catch (error) {
          setStatus(error.message || '入力を確認してください。', true);
        }
      });
      actions.appendChild(cancel);
      actions.appendChild(move);
      actions.appendChild(save);
      sheetBody.appendChild(actions);
      editSheet.classList.add('open');
      editSheet.setAttribute('aria-hidden', 'false');
      sheetBackdrop.classList.add('open');
    }

    function openAreaModal(id) {
      if (labelController) {
        labelController.openEditSheet('area', id);
        return;
      }
      closeSheets();
      if (!editSheet || !sheetTitle || !sheetBody) return;
      ensureAreaState(id);
      const area = currentAreas[id] || null;
      const colorPalette = buildColorPalette('色', areaColors[id] || '#2a5bd7');
      sheetTitle.textContent = area ? area.name : areaName(id, 0);
      const editor = buildLabelEditor('ラベル', areaInputs[id] || '');
      sheetBody.appendChild(editor.field);
      sheetBody.appendChild(colorPalette.field);
      const hint = document.createElement('p');
      hint.className = 'sheet-hint';
      hint.textContent = '非表示、数値、比の値、自由入力を選べます。\n' + RATIO_LABEL_HINT;
      sheetBody.appendChild(hint);
      const actions = document.createElement('div');
      actions.className = 'sheet-actions';
      actions.classList.add('has-move');
      const cancel = document.createElement('button');
      cancel.className = 'btn';
      cancel.type = 'button';
      cancel.textContent = 'キャンセル';
      cancel.addEventListener('click', closeSheets);
      function applyCurrentValue() {
        areaColors[id] = colorPalette.value;
        if (editor.mode.value === 'hidden') {
          areaInputs[id] = '';
        } else if (editor.mode.value === 'numeric') {
          areaInputs[id] = ' ';
        } else if (editor.mode.value === 'ratio') {
          const ratio = parseRatioLabelInput(editor.input.value);
          if (!ratio) throw new Error('比の値は「r,5」「t,4.4」「s,5/3」の形式で入力してください。');
          areaInputs[id] = RATIO_LABEL_PREFIX + ratio.source;
        } else {
          areaInputs[id] = String(editor.input.value || '');
        }
      }
      const move = document.createElement('button');
      move.className = 'btn action-secondary';
      move.type = 'button';
      move.textContent = '移動';
      move.addEventListener('click', function () {
        try {
          applyCurrentValue();
          render();
          enterMoveMode('area', id);
        } catch (error) {
          setStatus(error.message || '入力を確認してください。', true);
        }
      });
      const save = document.createElement('button');
      save.className = 'btn action-primary';
      save.type = 'button';
      save.textContent = '保存';
      save.addEventListener('click', function () {
        try {
          applyCurrentValue();
          closeSheets();
          render();
        } catch (error) {
          setStatus(error.message || '入力を確認してください。', true);
        }
      });
      actions.appendChild(cancel);
      if (area) actions.appendChild(move);
      actions.appendChild(save);
      sheetBody.appendChild(actions);
      editSheet.classList.add('open');
      editSheet.setAttribute('aria-hidden', 'false');
      sheetBackdrop.classList.add('open');
    }

    function normalizeControllerLabelValue(value) {
      const text = String(value || '');
      if (LabelEngine && text === LabelEngine.DECIMAL_NUMERIC_LABEL_VALUE) return ' ';
      return text;
    }

    function getControllerLabelValue(kind, id) {
      if (kind === 'point') return String(pointInputs[id] || '');
      if (kind === 'segment') return String(segmentInputs[id] || '');
      if (kind === 'angle') return String(angleInputs[id] || '');
      if (kind === 'area') {
        ensureAreaState(id);
        return String(areaInputs[id] || '');
      }
      return '';
    }

    function setControllerLabelValue(kind, id, value) {
      const text = normalizeControllerLabelValue(value);
      if (kind === 'point') pointInputs[id] = text || '';
      else if (kind === 'segment') {
        segmentInputs[id] = text;
        if (!text) segmentArcVisible[id] = false;
      } else if (kind === 'angle') angleInputs[id] = text;
      else if (kind === 'area') {
        ensureAreaState(id);
        areaInputs[id] = text;
      }
    }

    function buildControllerSegmentKindSelect(kind, id, buildSelectFn) {
      return buildSelectFn('線分マーク', segmentKinds[id] || 'plain', [
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
      ]);
    }

    function buildControllerAngleKindSelect(kind, id, buildSelectFn, body) {
      if (window.InstantGeometryMobileAngleOrnaments) {
        return window.InstantGeometryMobileAngleOrnaments.appendAngleKindSelect(body, buildSelectFn, angleKinds[id] || 'plain', 90);
      }
      const built = buildSelectFn('角マーク', angleKinds[id] || 'plain', [
        { value: 'plain', label: '通常' },
        { value: 'right', label: '直角記号付き' },
        { value: 'hidden', label: '角弧なし' }
      ]);
      body.appendChild(built.field);
      return built.select;
    }

    if (LabelEngine && typeof LabelEngine.createController === 'function') {
      labelController = LabelEngine.createController({
        enabledLabels: true,
        sheetTitle: sheetTitle,
        sheetBody: sheetBody,
        editSheet: editSheet,
        sheetBackdrop: sheetBackdrop,
        closeSheets: closeSheets,
        render: render,
        onMove: function (kind, id) {
          enterMoveMode(kind, id);
        },
        onError: function (error) {
          setStatus(error.message || '入力を確認してください。', true);
        },
        getModalSpec: function (kind, id, modalType) {
          return LabelEngine.getStandardModalSpec(modalType);
        },
        getLabelValue: getControllerLabelValue,
        setLabelValue: setControllerLabelValue,
        hasGuideField: function (kind) {
          return kind === 'segment';
        },
        getGuideVisible: function (kind, id) {
          return kind === 'segment' ? segmentArcVisible[id] !== false : false;
        },
        setGuideVisible: function (kind, id, value) {
          if (kind === 'segment') segmentArcVisible[id] = value;
        },
        buildSegmentKindSelect: buildControllerSegmentKindSelect,
        buildAngleKindSelect: buildControllerAngleKindSelect,
        setKind: function (kind, id, value) {
          if (kind === 'segment') segmentKinds[id] = value;
          else if (kind === 'angle') angleKinds[id] = value;
        },
        hasColorField: function (kind) {
          return kind === 'area';
        },
        getColor: function (kind, id) {
          ensureAreaState(id);
          return areaColors[id] || '#2a5bd7';
        },
        setColor: function (kind, id, value) {
          if (!value) return;
          ensureAreaState(id);
          areaColors[id] = value;
        }
      });
    }

    function attachSegmentModal(node, id) {
      if (!node) return node;
      node.dataset.dimensionId = id;
      node.setAttribute('tabindex', '0');
      node.setAttribute('role', 'button');
      node.style.cursor = 'pointer';
      node.addEventListener('pointerdown', function (event) {
        if (!isMoveTarget('segment', id)) return;
        event.preventDefault();
        event.stopPropagation();
        const offset = ensureLabelOffset('segment', id);
        moveDrag = {
          kind: 'segment',
          id: id,
          startPoint: pointerToSvgPoint(event),
          startOffset: { x: offset.x, y: offset.y }
        };
      });
      node.addEventListener('click', function (event) {
        if (moveMode) return;
        event.preventDefault();
        openSegmentModal(id);
      });
      node.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openSegmentModal(id);
      });
      return node;
    }

    function attachAreaModal(node, id) {
      if (!node) return node;
      node.dataset.areaId = id;
      node.setAttribute('tabindex', '0');
      node.setAttribute('role', 'button');
      node.style.cursor = 'pointer';
      node.addEventListener('pointerdown', function (event) {
        if (!isMoveTarget('area', id)) return;
        event.preventDefault();
        event.stopPropagation();
        const offset = ensureLabelOffset('area', id);
        moveDrag = {
          kind: 'area',
          id: id,
          startPoint: pointerToSvgPoint(event),
          startOffset: { x: offset.x, y: offset.y }
        };
      });
      node.addEventListener('click', function (event) {
        if (moveMode) return;
        event.preventDefault();
        openAreaModal(id);
      });
      node.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openAreaModal(id);
      });
      return node;
    }

    function attachPointModal(node, id) {
      if (!node) return node;
      node.dataset.pointId = id;
      node.setAttribute('tabindex', '0');
      node.setAttribute('role', 'button');
      node.style.cursor = 'pointer';
      node.addEventListener('pointerdown', function (event) {
        if (!isMoveTarget('point', id)) return;
        event.preventDefault();
        event.stopPropagation();
        const offset = ensureLabelOffset('point', id);
        moveDrag = {
          kind: 'point',
          id: id,
          startPoint: pointerToSvgPoint(event),
          startOffset: { x: offset.x, y: offset.y }
        };
      });
      node.addEventListener('click', function (event) {
        if (moveMode) return;
        event.preventDefault();
        openPointModal(id);
      });
      node.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openPointModal(id);
      });
      return node;
    }

    function attachAngleModal(node, id) {
      if (!node) return node;
      node.dataset.angleId = id;
      node.setAttribute('tabindex', '0');
      node.setAttribute('role', 'button');
      node.style.cursor = 'pointer';
      node.addEventListener('pointerdown', function (event) {
        if (!isMoveTarget('angle', id)) return;
        event.preventDefault();
        event.stopPropagation();
        const offset = ensureLabelOffset('angle', id);
        moveDrag = {
          kind: 'angle',
          id: id,
          startPoint: pointerToSvgPoint(event),
          startOffset: { x: offset.x, y: offset.y }
        };
      });
      node.addEventListener('click', function (event) {
        if (moveMode) return;
        event.preventDefault();
        openAngleModal(id);
      });
      node.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openAngleModal(id);
      });
      return node;
    }

    function arcPath(cx, cy, rx, ry, startDeg, endDeg) {
      const startRad = startDeg * Math.PI / 180;
      const endRad = endDeg * Math.PI / 180;
      const x1 = cx + Math.cos(startRad) * rx;
      const y1 = cy + Math.sin(startRad) * ry;
      const x2 = cx + Math.cos(endRad) * rx;
      const y2 = cy + Math.sin(endRad) * ry;
      const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
      const sweep = endDeg > startDeg ? 1 : 0;
      return 'M ' + x1 + ' ' + y1 + ' A ' + rx + ' ' + ry + ' 0 ' + large + ' ' + sweep + ' ' + x2 + ' ' + y2;
    }

    function quadraticPoint(P, C, Q, t) {
      return {
        x: (1 - t) * (1 - t) * P.x + 2 * (1 - t) * t * C.x + t * t * Q.x,
        y: (1 - t) * (1 - t) * P.y + 2 * (1 - t) * t * C.y + t * t * Q.y
      };
    }

    function pathFromQuadratic(P, C, Q, start, end) {
      const parts = [];
      for (let index = 0; index <= 20; index += 1) {
        const t = start + (end - start) * (index / 20);
        const point = quadraticPoint(P, C, Q, t);
        parts.push((index === 0 ? 'M ' : 'L ') + point.x + ' ' + point.y);
      }
      return parts.join(' ');
    }

    function segmentArcGeometry(P, Q, labelPoint) {
      return {
        control: {
          x: labelPoint.x * 2 - ((P.x + Q.x) / 2),
          y: labelPoint.y * 2 - ((P.y + Q.y) / 2)
        },
        gapHalf: 0.14
      };
    }

    function sideArcData(P, Q, center) {
      const mid = { x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 };
      const dx = Q.x - P.x;
      const dy = Q.y - P.y;
      const len = Math.hypot(dx, dy) || 1;
      let nx = -dy / len;
      let ny = dx / len;
      const toCenterX = center.x - mid.x;
      const toCenterY = center.y - mid.y;
      if (nx * toCenterX + ny * toCenterY > 0) {
        nx *= -1;
        ny *= -1;
      }
      const arcHeight = Math.max(35, len * 0.13);
      const control = { x: mid.x + nx * arcHeight, y: mid.y + ny * arcHeight };
      return {
        control: control,
        centerPoint: quadraticPoint(P, control, Q, 0.5),
        gapHalf: 0.14
      };
    }

    function appendSplitArc(P, Q, labelPoint) {
      const geom = segmentArcGeometry(P, Q, labelPoint);
      stage.appendChild(svg('path', {
        d: pathFromQuadratic(P, geom.control, Q, 0, 0.5 - geom.gapHalf),
        class: 'label-arc'
      }));
      stage.appendChild(svg('path', {
        d: pathFromQuadratic(P, geom.control, Q, 0.5 + geom.gapHalf, 1),
        class: 'label-arc'
      }));
    }

    function drawSideKind(kind, P, Q) {
      if (!kind || kind === 'plain') return;
      if (window.InstantGeometryMobileAngleOrnaments && window.InstantGeometryMobileAngleOrnaments.drawSegmentKind(stage, kind, P, Q, svg)) return;
      const mid = { x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 };
      const dx = Q.x - P.x;
      const dy = Q.y - P.y;
      const len = Math.hypot(dx, dy) || 1;
      const tx = dx / len;
      const ty = dy / len;
      const nx = -dy / len;
      const ny = dx / len;
      const stroke = '#2a5bd7';
      function addLine(cx, cy, half) {
        stage.appendChild(svg('line', {
          x1: cx - nx * half,
          y1: cy - ny * half,
          x2: cx + nx * half,
          y2: cy + ny * half,
          stroke: stroke,
          'stroke-width': 3,
          'stroke-linecap': 'round'
        }));
      }
      if (kind === 'circle') {
        stage.appendChild(svg('circle', { cx: mid.x, cy: mid.y, r: 8, fill: 'none', stroke: stroke, 'stroke-width': 3 }));
      } else if (kind === 'single') {
        addLine(mid.x, mid.y, 12);
      } else if (kind === 'double') {
        addLine(mid.x - tx * 9, mid.y - ty * 9, 12);
        addLine(mid.x + tx * 9, mid.y + ty * 9, 12);
      } else if (kind === 'cross') {
        addLine(mid.x, mid.y, 12);
        stage.appendChild(svg('line', {
          x1: mid.x - tx * 9,
          y1: mid.y - ty * 9,
          x2: mid.x + tx * 9,
          y2: mid.y + ty * 9,
          stroke: stroke,
          'stroke-width': 3,
          'stroke-linecap': 'round'
        }));
      } else if (kind === 'triangle') {
        const p1 = { x: mid.x + tx * 12, y: mid.y + ty * 12 };
        const p2 = { x: mid.x - tx * 8 + nx * 7, y: mid.y - ty * 8 + ny * 7 };
        const p3 = { x: mid.x - tx * 8 - nx * 7, y: mid.y - ty * 8 - ny * 7 };
        stage.appendChild(svg('polygon', {
          points: [p1, p2, p3].map(function (p) { return p.x + ',' + p.y; }).join(' '),
          fill: stroke,
          stroke: stroke,
          'stroke-width': 1.5
        }));
      }
    }

    function appendSegment(P, Q, id, fallbackValue, center, labelPointOverride, hitRange, exactLabel) {
      const base = labelPointOverride || sideArcData(P, Q, center).centerPoint;
      const labelPoint = getLabelPosition('segment', id, base);
      const text = dimensionText(id, fallbackValue, exactLabel);
      if (text && segmentArcVisible[id]) appendSplitArc(P, Q, labelPoint);
      drawSideKind(segmentKinds[id], P, Q);
      const hitStart = hitRange && typeof hitRange.start === 'number' ? hitRange.start : 0;
      const hitEnd = hitRange && typeof hitRange.end === 'number' ? hitRange.end : 1;
      const hitP = hitRange ? lerpPoint(P, Q, hitStart) : P;
      const hitQ = hitRange ? lerpPoint(P, Q, hitEnd) : Q;
      stage.appendChild(attachSegmentModal(svg('line', {
        x1: hitP.x,
        y1: hitP.y,
        x2: hitQ.x,
        y2: hitQ.y,
        class: 'solid-hit',
        style: hitRange && hitRange.width ? 'stroke-width:' + hitRange.width + 'px' : null
      }), id));
      addFloatingLabel(text, base.x, base.y, id);
      return { base: base, labelPoint: labelPoint, text: text };
    }

    function angleArcPoints(vertex, p1, p2, radius) {
      const a1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
      let a2 = Math.atan2(p2.y - vertex.y, p2.x - vertex.x);
      let delta = a2 - a1;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      const points = [];
      for (let index = 0; index <= 24; index += 1) {
        const t = index / 24;
        const a = a1 + delta * t;
        points.push({ x: vertex.x + Math.cos(a) * radius, y: vertex.y + Math.sin(a) * radius });
      }
      return points;
    }

    function pathFromPoints(points) {
      return points.map(function (point, index) {
        return (index === 0 ? 'M ' : 'L ') + point.x + ' ' + point.y;
      }).join(' ');
    }

    function sectorPath(vertex, points) {
      return 'M ' + vertex.x + ' ' + vertex.y + ' L ' + pathFromPoints(points).slice(2) + ' Z';
    }

    function appendAngle(vertex, p1, p2, id, value, labelBase) {
      const kind = angleKinds[id] || 'plain';
      const arc = angleArcPoints(vertex, p1, p2, 62);
      if (kind !== 'hidden' && kind !== 'right') {
        stage.appendChild(svg('path', {
          d: pathFromPoints(arc),
          fill: 'none',
          stroke: '#687086',
          'stroke-width': 2.2,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round'
        }));
      }
      if (kind !== 'hidden' && window.InstantGeometryMobileAngleOrnaments) {
        window.InstantGeometryMobileAngleOrnaments.drawAngleKind(stage, kind, arc, vertex, labelBase, svg, { p1: p1, p2: p2 });
      }
      stage.appendChild(attachAngleModal(svg('path', {
        d: sectorPath(vertex, angleArcPoints(vertex, p1, p2, 108)),
        class: 'solid-angle-hit'
      }), id));
      const text = angleText(id, value);
      addAngleLabel(text, labelBase.x, labelBase.y, id);
    }

    function polygonCentroid(points) {
      const total = points.reduce(function (sum, point) {
        return { x: sum.x + point.x, y: sum.y + point.y };
      }, { x: 0, y: 0 });
      return { x: total.x / points.length, y: total.y / points.length };
    }

    function appendAreaRegion(id, points, value, labelPointOverride) {
      ensureAreaState(id);
      const pointsText = points.map(function (point) { return point.x + ',' + point.y; }).join(' ');
      const labelPoint = labelPointOverride || polygonCentroid(points);
      const color = areaColors[id] || '#2a5bd7';
      currentAreas[id] = { id: id, name: areaName(id, points.length), value: value, labelPoint: labelPoint };
      stage.appendChild(attachAreaModal(svg('polygon', {
        points: pointsText,
        class: 'solid-area-hit',
        fill: hexToRgba(color, 0.1),
        stroke: 'none'
      }), id));
      addAreaLabel(areaText(id, value), labelPoint.x, labelPoint.y, id);
    }

    function appendAreaHitRegion(id, points) {
      ensureAreaState(id);
      stage.appendChild(attachAreaModal(svg('polygon', {
        points: points.map(function (point) { return point.x + ',' + point.y; }).join(' '),
        class: 'solid-area-hit',
        fill: 'rgba(42,91,215,0.02)',
        stroke: 'none'
      }), id));
    }

    function appendAreaHitDisk(id, point, radius) {
      ensureAreaState(id);
      stage.appendChild(attachAreaModal(svg('circle', {
        cx: point.x,
        cy: point.y,
        r: radius,
        class: 'solid-area-hit',
        fill: 'rgba(42,91,215,0.001)',
        stroke: 'none'
      }), id));
    }

    function renderCone(g) {
      const diameter = g.radius * 2;
      const scale = Math.min(560 / diameter, 560 / g.height);
      const rx = g.radius * scale;
      const coneH = g.height * scale;
      const ry = Math.max(34, Math.min(80, rx * 0.32));
      const cx = 540;
      const apexY = 220;
      const baseY = apexY + coneH;
      const left = cx - rx;
      const right = cx + rx;
      const pointA = { x: cx, y: apexY };
      const pointO = { x: cx, y: baseY };
      const pointB = { x: left, y: baseY };
      const pointC = { x: right, y: baseY };

      stage.appendChild(svg('line', { x1: pointA.x, y1: pointA.y, x2: pointB.x, y2: pointB.y, class: 'solid-outline' }));
      stage.appendChild(svg('line', { x1: pointA.x, y1: pointA.y, x2: pointC.x, y2: pointC.y, class: 'solid-outline' }));
      stage.appendChild(svg('path', { d: arcPath(cx, baseY, rx, ry, 180, 360), class: 'solid-hidden' }));
      stage.appendChild(svg('path', { d: arcPath(cx, baseY, rx, ry, 0, 180), class: 'solid-outline' }));

      appendSegment(pointO, pointB, 'OB', g.radius, { x: cx, y: baseY - 120 });
      appendSegment(pointA, pointO, 'AO', g.height, { x: pointA.x + 160, y: (pointA.y + pointO.y) / 2 });
      appendSegment(pointO, pointC, 'OC', g.radius, { x: cx, y: baseY - 120 });
      appendSegment(pointA, pointB, 'AB', Math.hypot(g.radius, g.height), { x: cx, y: (pointA.y + pointO.y) / 2 }, null, null, formatPythagoreanLabel(g.radius, g.height));
      appendSegment(pointA, pointC, 'AC', Math.hypot(g.radius, g.height), { x: cx, y: (pointA.y + pointO.y) / 2 }, null, null, formatPythagoreanLabel(g.radius, g.height));

      stage.appendChild(attachPointModal(svg('circle', { cx: pointA.x, cy: pointA.y, r: 28, class: 'solid-point-hit' }), 'A'));
      stage.appendChild(attachPointModal(svg('circle', { cx: pointO.x, cy: pointO.y, r: 28, class: 'solid-point-hit' }), 'O'));
      stage.appendChild(attachPointModal(svg('circle', { cx: pointB.x, cy: pointB.y, r: 28, class: 'solid-point-hit' }), 'B'));
      stage.appendChild(attachPointModal(svg('circle', { cx: pointC.x, cy: pointC.y, r: 28, class: 'solid-point-hit' }), 'C'));

      addPointLabel(pointInputs.A, pointA.x, pointA.y - 34, 'A');
      addPointLabel(pointInputs.O, pointO.x, pointO.y - 30, 'O');
      addPointLabel(pointInputs.B, pointB.x - 24, pointB.y + 24, 'B');
      addPointLabel(pointInputs.C, pointC.x + 24, pointC.y + 24, 'C');
      setStatus('入力をもとに円錐を描画しています。', false);
    }

    function renderSphere(g) {
      const scale = Math.min(620 / (g.radius * 2), 620 / (g.radius * 2));
      const r = g.radius * scale;
      const cx = 500;
      const cy = 500;
      const left = { x: cx - r, y: cy };
      const center = { x: cx, y: cy };
      const equatorRy = Math.max(38, Math.min(88, r * 0.24));
      const labelBase = { x: cx - r * 0.42, y: cy - 42 };
      const labelPoint = getLabelPosition('segment', 'R', labelBase);
      const labelText = dimensionText('R', g.radius);

      stage.appendChild(svg('circle', {
        cx: cx,
        cy: cy,
        r: r,
        class: 'solid-sphere-fill'
      }));
      stage.appendChild(svg('path', {
        d: arcPath(cx, cy, r, equatorRy, 180, 360),
        class: 'solid-hidden'
      }));
      if (labelText && segmentArcVisible.R) appendSplitArc(left, center, labelPoint);
      drawSideKind(segmentKinds.R, left, center);
      stage.appendChild(svg('line', {
        x1: left.x,
        y1: left.y,
        x2: center.x,
        y2: center.y,
        class: 'solid-radius'
      }));
      stage.appendChild(attachSegmentModal(svg('line', {
        x1: left.x,
        y1: left.y,
        x2: center.x,
        y2: center.y,
        class: 'solid-hit'
      }), 'R'));
      stage.appendChild(svg('path', {
        d: arcPath(cx, cy, r, equatorRy, 0, 180),
        class: 'solid-sphere-front'
      }));
      stage.appendChild(svg('circle', { cx: cx, cy: cy, r: 7, class: 'center-point' }));
      stage.appendChild(attachPointModal(svg('circle', { cx: center.x, cy: center.y, r: 28, class: 'solid-point-hit' }), 'O'));
      stage.appendChild(attachPointModal(svg('circle', { cx: left.x, cy: left.y, r: 28, class: 'solid-point-hit' }), 'A'));
      addFloatingLabel(labelText, labelBase.x, labelBase.y, 'R');
      addPointLabel(pointInputs.O, center.x + 26, center.y + 28, 'O');
      addPointLabel(pointInputs.A, left.x - 24, left.y + 26, 'A');
      setStatus('半径をもとに球を描画しています。', false);
    }

    function renderHemisphere1(g) {
      const scale = Math.min(620 / (g.radius * 2), 620 / g.radius);
      const r = g.radius * scale;
      const cx = 500;
      const cy = 610;
      const left = { x: cx - r, y: cy };
      const right = { x: cx + r, y: cy };
      const center = { x: cx, y: cy };
      const baseRy = Math.max(38, Math.min(88, r * 0.24));
      const labelBase = { x: cx - r * 0.42, y: cy - 42 };
      const labelPoint = getLabelPosition('segment', 'R', labelBase);
      const labelText = dimensionText('R', g.radius);
      const fillPath = [
        'M ' + left.x + ' ' + left.y,
        'A ' + r + ' ' + r + ' 0 0 1 ' + right.x + ' ' + right.y,
        'A ' + r + ' ' + baseRy + ' 0 0 1 ' + left.x + ' ' + left.y,
        'Z'
      ].join(' ');

      stage.appendChild(svg('path', {
        d: fillPath,
        class: 'solid-hemisphere-fill'
      }));
      stage.appendChild(svg('path', {
        d: arcPath(cx, cy, r, r, 180, 360),
        class: 'solid-sphere-front'
      }));
      stage.appendChild(svg('path', {
        d: arcPath(cx, cy, r, baseRy, 180, 360),
        class: 'solid-hidden'
      }));
      if (labelText && segmentArcVisible.R) appendSplitArc(left, center, labelPoint);
      drawSideKind(segmentKinds.R, left, center);
      stage.appendChild(svg('line', {
        x1: left.x,
        y1: left.y,
        x2: center.x,
        y2: center.y,
        class: 'solid-radius'
      }));
      stage.appendChild(attachSegmentModal(svg('line', {
        x1: left.x,
        y1: left.y,
        x2: center.x,
        y2: center.y,
        class: 'solid-hit'
      }), 'R'));
      stage.appendChild(svg('path', {
        d: arcPath(cx, cy, r, baseRy, 0, 180),
        class: 'solid-sphere-front'
      }));
      stage.appendChild(svg('circle', { cx: cx, cy: cy, r: 7, class: 'center-point' }));
      stage.appendChild(attachPointModal(svg('circle', { cx: center.x, cy: center.y, r: 28, class: 'solid-point-hit' }), 'O'));
      stage.appendChild(attachPointModal(svg('circle', { cx: left.x, cy: left.y, r: 28, class: 'solid-point-hit' }), 'A'));
      addFloatingLabel(labelText, labelBase.x, labelBase.y, 'R');
      addPointLabel(pointInputs.O, center.x + 26, center.y + 28, 'O');
      addPointLabel(pointInputs.A, left.x - 24, left.y + 26, 'A');
      setStatus('半径をもとに半球①を描画しています。', false);
    }

    function renderHemisphere2(g) {
      const scale = Math.min(620 / (g.radius * 2), 620 / g.radius);
      const r = g.radius * scale;
      const cx = 500;
      const cy = 390;
      const left = { x: cx - r, y: cy };
      const right = { x: cx + r, y: cy };
      const center = { x: cx, y: cy };
      const baseRy = Math.max(38, Math.min(88, r * 0.24));
      const labelBase = { x: cx - r * 0.42, y: cy - 42 };
      const labelPoint = getLabelPosition('segment', 'R', labelBase);
      const labelText = dimensionText('R', g.radius);
      const fillPath = [
        'M ' + left.x + ' ' + left.y,
        'A ' + r + ' ' + baseRy + ' 0 0 1 ' + right.x + ' ' + right.y,
        'A ' + r + ' ' + r + ' 0 0 1 ' + left.x + ' ' + left.y,
        'Z'
      ].join(' ');

      stage.appendChild(svg('path', {
        d: fillPath,
        class: 'solid-hemisphere-fill'
      }));
      stage.appendChild(svg('path', {
        d: arcPath(cx, cy, r, baseRy, 180, 360),
        class: 'solid-sphere-front'
      }));
      if (labelText && segmentArcVisible.R) appendSplitArc(left, center, labelPoint);
      drawSideKind(segmentKinds.R, left, center);
      stage.appendChild(svg('line', {
        x1: left.x,
        y1: left.y,
        x2: center.x,
        y2: center.y,
        class: 'solid-radius'
      }));
      stage.appendChild(attachSegmentModal(svg('line', {
        x1: left.x,
        y1: left.y,
        x2: center.x,
        y2: center.y,
        class: 'solid-hit'
      }), 'R'));
      stage.appendChild(svg('path', {
        d: arcPath(cx, cy, r, baseRy, 0, 180),
        class: 'solid-sphere-front'
      }));
      stage.appendChild(svg('path', {
        d: arcPath(cx, cy, r, r, 0, 180),
        class: 'solid-sphere-front'
      }));
      stage.appendChild(svg('circle', { cx: cx, cy: cy, r: 7, class: 'center-point' }));
      stage.appendChild(attachPointModal(svg('circle', { cx: center.x, cy: center.y, r: 28, class: 'solid-point-hit' }), 'O'));
      stage.appendChild(attachPointModal(svg('circle', { cx: left.x, cy: left.y, r: 28, class: 'solid-point-hit' }), 'A'));
      addFloatingLabel(labelText, labelBase.x, labelBase.y, 'R');
      addPointLabel(pointInputs.O, center.x + 26, center.y + 28, 'O');
      addPointLabel(pointInputs.A, left.x - 24, left.y + 26, 'A');
      setStatus('半径をもとに半球②を描画しています。', false);
    }

    function renderQuarterSphere1(g) {
      const scale = Math.min(640 / (g.radius * 2), 640 / (g.radius * 2));
      const r = g.radius * scale;
      const rx = r;
      const ry = r * 0.34;
      const O = { x: 500, y: 500 };
      const A = { x: O.x - rx, y: O.y };
      const B = { x: O.x + rx, y: O.y };
      const upperControl = { x: O.x, y: O.y - r * 0.9 };
      const lowerControl = { x: O.x, y: O.y + r * 0.52 };
      const labelBase = { x: O.x - rx * 0.48, y: O.y - 46 };
      const labelPoint = getLabelPosition('segment', 'OA', labelBase);
      const labelText = dimensionText('OA', g.radius);

      stage.appendChild(svg('path', {
        d: [
          'M ' + A.x + ' ' + A.y,
          'Q ' + upperControl.x + ' ' + upperControl.y + ' ' + B.x + ' ' + B.y,
          'A ' + rx + ' ' + ry + ' 0 0 1 ' + A.x + ' ' + A.y,
          'Z'
        ].join(' '),
        class: 'solid-quarter-sphere-fill'
      }));
      stage.appendChild(svg('path', {
        d: 'M ' + A.x + ' ' + A.y + ' Q ' + upperControl.x + ' ' + upperControl.y + ' ' + B.x + ' ' + B.y,
        class: 'solid-sphere-front'
      }));
      stage.appendChild(svg('path', {
        d: arcPath(O.x, O.y, rx, ry, 180, 360),
        class: 'solid-hidden'
      }));
      stage.appendChild(svg('path', {
        d: arcPath(O.x, O.y, rx, ry, 0, 180),
        class: 'solid-sphere-front'
      }));
      stage.appendChild(svg('path', {
        d: 'M ' + A.x + ' ' + A.y + ' Q ' + lowerControl.x + ' ' + lowerControl.y + ' ' + B.x + ' ' + B.y,
        class: 'solid-sphere-front'
      }));
      if (labelText && segmentArcVisible.OA) appendSplitArc(A, O, labelPoint);
      drawSideKind(segmentKinds.OA, A, O);
      stage.appendChild(svg('line', {
        x1: A.x,
        y1: A.y,
        x2: O.x,
        y2: O.y,
        class: 'solid-radius'
      }));
      stage.appendChild(attachSegmentModal(svg('line', {
        x1: A.x,
        y1: A.y,
        x2: O.x,
        y2: O.y,
        class: 'solid-hit'
      }), 'OA'));
      stage.appendChild(svg('circle', { cx: O.x, cy: O.y, r: 7, class: 'center-point' }));
      stage.appendChild(attachPointModal(svg('circle', { cx: A.x, cy: A.y, r: 28, class: 'solid-point-hit' }), 'A'));
      stage.appendChild(attachPointModal(svg('circle', { cx: O.x, cy: O.y, r: 28, class: 'solid-point-hit' }), 'O'));
      stage.appendChild(attachPointModal(svg('circle', { cx: B.x, cy: B.y, r: 28, class: 'solid-point-hit' }), 'B'));
      addFloatingLabel(labelText, labelBase.x, labelBase.y, 'OA');
      addPointLabel(pointInputs.A, A.x - 24, A.y + 26, 'A');
      addPointLabel(pointInputs.O, O.x + 26, O.y - 26, 'O');
      addPointLabel(pointInputs.B, B.x + 24, B.y + 26, 'B');
      setStatus('半径をもとに四分球①を描画しています。', false);
    }

    function renderSimilarSolid1(g) {
      const totalHeight = g.AOp + g.OpO;
      const scale = Math.min(560 / (g.BO * 2), 560 / totalHeight);
      const rx = g.BO * scale;
      const coneH = totalHeight * scale;
      const topH = g.AOp * scale;
      const cutRatio = g.AOp / totalHeight;
      const cutRx = rx * cutRatio;
      const baseRy = Math.max(34, Math.min(80, rx * 0.32));
      const cutRy = Math.max(18, baseRy * cutRatio);
      const cx = 540;
      const apexY = 205;
      const baseY = apexY + coneH;
      const cutY = apexY + topH;
      const pointA = { x: cx, y: apexY };
      const pointO = { x: cx, y: baseY };
      const pointOp = { x: cx, y: cutY };
      const pointB = { x: cx - rx, y: baseY };
      const pointC = { x: cx + rx, y: baseY };
      const pointM = { x: cx - cutRx, y: cutY };
      const pointN = { x: cx + cutRx, y: cutY };
      const slantTop = Math.hypot(cutRx, topH) / scale;
      const slantBottom = Math.hypot(rx - cutRx, g.OpO * scale) / scale;

      stage.appendChild(svg('line', { x1: pointA.x, y1: pointA.y, x2: pointB.x, y2: pointB.y, class: 'solid-outline' }));
      stage.appendChild(svg('line', { x1: pointA.x, y1: pointA.y, x2: pointC.x, y2: pointC.y, class: 'solid-outline' }));
      stage.appendChild(svg('line', { x1: pointA.x, y1: pointA.y, x2: pointO.x, y2: pointO.y, class: 'solid-hidden' }));
      stage.appendChild(svg('path', { d: arcPath(cx, baseY, rx, baseRy, 180, 360), class: 'solid-hidden' }));
      stage.appendChild(svg('path', { d: arcPath(cx, baseY, rx, baseRy, 0, 180), class: 'solid-outline' }));
      stage.appendChild(svg('path', { d: arcPath(cx, cutY, cutRx, cutRy, 180, 360), class: 'solid-hidden' }));
      stage.appendChild(svg('path', { d: arcPath(cx, cutY, cutRx, cutRy, 0, 180), class: 'solid-outline' }));
      stage.appendChild(svg('line', { x1: pointM.x, y1: pointM.y, x2: pointN.x, y2: pointN.y, class: 'solid-hidden' }));
      stage.appendChild(svg('line', { x1: pointB.x, y1: pointB.y, x2: pointO.x, y2: pointO.y, class: 'solid-hidden' }));
      stage.appendChild(svg('line', { x1: pointO.x, y1: pointO.y, x2: pointC.x, y2: pointC.y, class: 'solid-hidden' }));

      appendSegment(pointA, pointM, 'AM', slantTop, { x: cx, y: cutY });
      appendSegment(pointA, pointN, 'AN', slantTop, { x: cx, y: cutY });
      appendSegment(pointM, pointB, 'MB', slantBottom, { x: cx, y: baseY });
      appendSegment(pointN, pointC, 'NC', slantBottom, { x: cx, y: baseY });
      appendSegment(pointA, pointOp, 'AOp', g.AOp, { x: cx - 160, y: (pointA.y + pointOp.y) / 2 });
      appendSegment(pointOp, pointO, 'OpO', g.OpO, { x: cx - 160, y: (pointOp.y + pointO.y) / 2 });
      appendSegment(pointB, pointO, 'BO', g.BO, { x: cx, y: baseY - 110 });
      appendSegment(pointC, pointO, 'CO', g.BO, { x: cx, y: baseY - 110 });

      [
        ['A', pointA], ['O', pointO], ['Op', pointOp], ['B', pointB], ['C', pointC], ['M', pointM], ['N', pointN]
      ].forEach(function (item) {
        stage.appendChild(attachPointModal(svg('circle', { cx: item[1].x, cy: item[1].y, r: 28, class: 'solid-point-hit' }), item[0]));
      });

      addPointLabel(pointInputs.A, pointA.x, pointA.y - 34, 'A');
      addPointLabel(pointInputs.O, pointO.x + 28, pointO.y + 30, 'O');
      addPointLabel(pointInputs.Op, pointOp.x + 34, pointOp.y, 'Op');
      addPointLabel(pointInputs.B, pointB.x - 24, pointB.y + 24, 'B');
      addPointLabel(pointInputs.C, pointC.x + 24, pointC.y + 24, 'C');
      addPointLabel(pointInputs.M, pointM.x - 28, pointM.y - 18, 'M');
      addPointLabel(pointInputs.N, pointN.x + 28, pointN.y - 18, 'N');
      setStatus("AO'、O'O、BO から相似な立体①を描画しています。", false);
    }

    function lerpPoint(P, Q, t) {
      return {
        x: P.x + (Q.x - P.x) * t,
        y: P.y + (Q.y - P.y) * t
      };
    }

    function renderSimilarSolid2(g) {
      const totalHeight = g.OGp + g.GpG;
      const bx = 0;
      const by = 0;
      const cxRaw = g.AB;
      const cy = 0;
      const ax = (g.CA * g.CA + g.AB * g.AB - g.BC * g.BC) / (2 * g.AB);
      const ay = -Math.sqrt(Math.max(0, g.CA * g.CA - ax * ax));
      const rawA = { x: ax, y: ay };
      const rawB = { x: bx, y: by };
      const rawC = { x: cxRaw, y: cy };
      const rawG = {
        x: (rawA.x + rawB.x + rawC.x) / 3,
        y: (rawA.y + rawB.y + rawC.y) / 3
      };
      const rawO = { x: rawG.x, y: rawG.y - totalHeight };
      const values = [rawA, rawB, rawC, rawG, rawO];
      const minX = Math.min.apply(null, values.map(function (p) { return p.x; }));
      const maxX = Math.max.apply(null, values.map(function (p) { return p.x; }));
      const minY = Math.min.apply(null, values.map(function (p) { return p.y; }));
      const maxY = Math.max.apply(null, values.map(function (p) { return p.y; }));
      const scale = Math.min(650 / Math.max(1, maxX - minX), 650 / Math.max(1, maxY - minY));
      const offsetX = 500 - ((minX + maxX) / 2) * scale;
      const offsetY = 520 - ((minY + maxY) / 2) * scale;
      function project(point) {
        return { x: point.x * scale + offsetX, y: point.y * scale + offsetY };
      }
      const pointA = project(rawA);
      const pointB = project(rawB);
      const pointC = project(rawC);
      const pointG = project(rawG);
      const pointO = project(rawO);
      const cutRatio = g.OGp / totalHeight;
      const pointGp = lerpPoint(pointO, pointG, cutRatio);
      const pointL = lerpPoint(pointO, pointA, cutRatio);
      const pointM = lerpPoint(pointO, pointB, cutRatio);
      const pointN = lerpPoint(pointO, pointC, cutRatio);
      const center = { x: (pointO.x + pointG.x) / 2, y: (pointO.y + pointG.y) / 2 };
      const topScale = cutRatio;
      const bottomScale = 1 - cutRatio;

      drawVisibleSegment(pointA, pointB, false);
      drawVisibleSegment(pointB, pointC, false);
      drawVisibleSegment(pointC, pointA, true);
      drawVisibleSegment(pointO, pointA, false);
      drawVisibleSegment(pointO, pointB, false);
      drawVisibleSegment(pointO, pointC, false);
      drawVisibleSegment(pointO, pointG, true);
      drawVisibleSegment(pointL, pointM, false);
      drawVisibleSegment(pointM, pointN, false);
      drawVisibleSegment(pointN, pointL, true);

      appendSegment(pointO, pointL, 'OL', Math.hypot(rawA.x - rawO.x, rawA.y - rawO.y) * topScale, center, null, { start: 0.3, end: 0.72, width: 12 });
      appendSegment(pointL, pointA, 'LA', Math.hypot(rawA.x - rawO.x, rawA.y - rawO.y) * bottomScale, center, null, { start: 0.28, end: 0.82, width: 12 });
      appendSegment(pointO, pointM, 'OM', Math.hypot(rawB.x - rawO.x, rawB.y - rawO.y) * topScale, center, null, { start: 0.3, end: 0.72, width: 12 });
      appendSegment(pointM, pointB, 'MB', Math.hypot(rawB.x - rawO.x, rawB.y - rawO.y) * bottomScale, center, null, { start: 0.28, end: 0.82, width: 12 });
      appendSegment(pointO, pointN, 'ON', Math.hypot(rawC.x - rawO.x, rawC.y - rawO.y) * topScale, center, null, { start: 0.3, end: 0.72, width: 12 });
      appendSegment(pointN, pointC, 'NC', Math.hypot(rawC.x - rawO.x, rawC.y - rawO.y) * bottomScale, center, null, { start: 0.28, end: 0.82, width: 12 });
      appendSegment(pointA, pointB, 'AB', g.AB, center, null, { start: 0.18, end: 0.82, width: 14 });
      appendSegment(pointB, pointC, 'BC', g.BC, center, null, { start: 0.18, end: 0.82, width: 14 });
      appendSegment(pointC, pointA, 'CA', g.CA, center, null, { start: 0.18, end: 0.82, width: 14 });
      appendSegment(pointL, pointM, 'LM', g.AB * topScale, center, null, { start: 0.18, end: 0.82, width: 14 });
      appendSegment(pointM, pointN, 'MN', g.BC * topScale, center, null, { start: 0.18, end: 0.82, width: 14 });
      appendSegment(pointN, pointL, 'NL', g.CA * topScale, center, null, { start: 0.18, end: 0.82, width: 14 });
      appendSegment(pointO, pointGp, 'OGp', g.OGp, { x: pointO.x + 150, y: (pointO.y + pointGp.y) / 2 }, null, { start: 0.22, end: 0.78, width: 12 });
      appendSegment(pointGp, pointG, 'GpG', g.GpG, { x: pointG.x + 150, y: (pointGp.y + pointG.y) / 2 }, null, { start: 0.22, end: 0.78, width: 12 });

      [
        ['O', pointO], ['G', pointG], ['Gp', pointGp], ['A', pointA], ['B', pointB], ['C', pointC], ['L', pointL], ['M', pointM], ['N', pointN]
      ].forEach(function (item) {
        stage.appendChild(attachPointModal(svg('circle', { cx: item[1].x, cy: item[1].y, r: 28, class: 'solid-point-hit' }), item[0]));
      });

      addPointLabel(pointInputs.O, pointO.x, pointO.y - 34, 'O');
      addPointLabel(pointInputs.G, pointG.x + 30, pointG.y + 18, 'G');
      addPointLabel(pointInputs.Gp, pointGp.x + 34, pointGp.y, 'Gp');
      addPointLabel(pointInputs.A, pointA.x - 28, pointA.y - 22, 'A');
      addPointLabel(pointInputs.B, pointB.x - 26, pointB.y + 24, 'B');
      addPointLabel(pointInputs.C, pointC.x + 26, pointC.y + 24, 'C');
      addPointLabel(pointInputs.L, pointL.x - 24, pointL.y - 18, 'L');
      addPointLabel(pointInputs.M, pointM.x - 24, pointM.y + 22, 'M');
      addPointLabel(pointInputs.N, pointN.x + 24, pointN.y + 20, 'N');
      setStatus("OG'、G'G、AB、BC、CA から相似な立体②を描画しています。", false);
    }

    function drawVisibleSegment(P, Q, hidden) {
      stage.appendChild(svg('line', {
        x1: P.x,
        y1: P.y,
        x2: Q.x,
        y2: Q.y,
        class: hidden ? 'solid-hidden' : 'solid-outline'
      }));
    }

    function trianglePrismPoints(g) {
      const bx = 0;
      const by = 0;
      const cx = g.BC;
      const cy = 0;
      const ax = (g.AB * g.AB + g.BC * g.BC - g.CA * g.CA) / (2 * g.BC);
      const ay = -Math.sqrt(Math.max(0, g.AB * g.AB - ax * ax));
      const slantX = 0;
      const slantY = g.AD;
      const raw = {
        A: { x: ax, y: ay },
        B: { x: bx, y: by },
        C: { x: cx, y: cy }
      };
      raw.D = { x: raw.A.x + slantX, y: raw.A.y + slantY };
      raw.E = { x: raw.B.x + slantX, y: raw.B.y + slantY };
      raw.F = { x: raw.C.x + slantX, y: raw.C.y + slantY };
      const values = Object.keys(raw).map(function (key) { return raw[key]; });
      const minX = Math.min.apply(null, values.map(function (p) { return p.x; }));
      const maxX = Math.max.apply(null, values.map(function (p) { return p.x; }));
      const minY = Math.min.apply(null, values.map(function (p) { return p.y; }));
      const maxY = Math.max.apply(null, values.map(function (p) { return p.y; }));
      const scale = Math.min(620 / Math.max(1, maxX - minX), 620 / Math.max(1, maxY - minY));
      const offsetX = 500 - ((minX + maxX) / 2) * scale;
      const offsetY = 500 - ((minY + maxY) / 2) * scale;
      const points = {};
      Object.keys(raw).forEach(function (key) {
        points[key] = { x: raw[key].x * scale + offsetX, y: raw[key].y * scale + offsetY };
      });
      return points;
    }

    function triangularPyramidPoints(g) {
      const bx = 0;
      const by = 0;
      const cx = g.BC;
      const cy = 0;
      const dx = (g.DB * g.DB + g.BC * g.BC - g.CD * g.CD) / (2 * g.BC);
      const dy = Math.sqrt(Math.max(0, g.DB * g.DB - dx * dx));
      const hRaw = { x: (bx + cx + dx) / 3, y: (by + cy + dy) / 3 };
      const projectedBase = {};
      function projectBase(point) {
        return {
          x: point.x + point.y * 0.18,
          y: point.y * 0.55
        };
      }
      projectedBase.B = projectBase({ x: bx, y: by });
      projectedBase.C = projectBase({ x: cx, y: cy });
      projectedBase.D = projectBase({ x: dx, y: dy });
      projectedBase.H = projectBase(hRaw);
      const raw = {
        B: projectedBase.B,
        C: projectedBase.C,
        D: projectedBase.D,
        H: projectedBase.H,
        A: { x: projectedBase.H.x, y: projectedBase.H.y - g.AH }
      };
      const values = Object.keys(raw).map(function (key) { return raw[key]; });
      const minX = Math.min.apply(null, values.map(function (p) { return p.x; }));
      const maxX = Math.max.apply(null, values.map(function (p) { return p.x; }));
      const minY = Math.min.apply(null, values.map(function (p) { return p.y; }));
      const maxY = Math.max.apply(null, values.map(function (p) { return p.y; }));
      const scale = Math.min(600 / Math.max(1, maxX - minX), 620 / Math.max(1, maxY - minY));
      const offsetX = 500 - ((minX + maxX) / 2) * scale;
      const offsetY = 540 - ((minY + maxY) / 2) * scale;
      const points = {};
      Object.keys(raw).forEach(function (key) {
        points[key] = { x: raw[key].x * scale + offsetX, y: raw[key].y * scale + offsetY };
      });
      return points;
    }

    function rightTriangularPyramid1Points(g) {
      const rawBase = {
        B: { x: 0, y: 0 },
        C: { x: g.CB, y: 0 },
        D: { x: 0, y: g.DB }
      };
      const raw = {};
      function projectBase(point) {
        return {
          x: point.x + point.y * 0.24,
          y: point.y * 0.52
        };
      }
      raw.B = projectBase(rawBase.B);
      raw.C = projectBase(rawBase.C);
      raw.D = projectBase(rawBase.D);
      raw.A = { x: raw.B.x, y: raw.B.y - g.AB };
      const values = Object.keys(raw).map(function (key) { return raw[key]; });
      const minX = Math.min.apply(null, values.map(function (p) { return p.x; }));
      const maxX = Math.max.apply(null, values.map(function (p) { return p.x; }));
      const minY = Math.min.apply(null, values.map(function (p) { return p.y; }));
      const maxY = Math.max.apply(null, values.map(function (p) { return p.y; }));
      const scale = Math.min(620 / Math.max(1, maxX - minX), 660 / Math.max(1, maxY - minY));
      const offsetX = 500 - ((minX + maxX) / 2) * scale;
      const offsetY = 540 - ((minY + maxY) / 2) * scale;
      const points = {};
      Object.keys(raw).forEach(function (key) {
        points[key] = { x: raw[key].x * scale + offsetX, y: raw[key].y * scale + offsetY };
      });
      return points;
    }

    function regularTetrahedronPoints(g) {
      const a = g.a;
      const baseRadius = a / Math.sqrt(3);
      const height = Math.sqrt(2 / 3) * a;
      const vertices = {
        A: { x: 0, y: 0, z: height },
        B: { x: -a / 2, y: -baseRadius / 2, z: 0 },
        C: { x: 0, y: baseRadius, z: 0 },
        D: { x: a / 2, y: -baseRadius / 2, z: 0 }
      };
      const raw = {};
      Object.keys(vertices).forEach(function (key) {
        const point = vertices[key];
        raw[key] = {
          x: point.x,
          y: point.y * 0.48 - point.z
        };
      });
      const values = Object.keys(raw).map(function (key) { return raw[key]; });
      const minX = Math.min.apply(null, values.map(function (p) { return p.x; }));
      const maxX = Math.max.apply(null, values.map(function (p) { return p.x; }));
      const minY = Math.min.apply(null, values.map(function (p) { return p.y; }));
      const maxY = Math.max.apply(null, values.map(function (p) { return p.y; }));
      const scale = Math.min(650 / Math.max(1, maxX - minX), 680 / Math.max(1, maxY - minY));
      const offsetX = 500 - ((minX + maxX) / 2) * scale;
      const offsetY = 530 - ((minY + maxY) / 2) * scale;
      const points = {};
      Object.keys(raw).forEach(function (key) {
        points[key] = { x: raw[key].x * scale + offsetX, y: raw[key].y * scale + offsetY };
      });
      return points;
    }

    function regularHexahedronPoints(g) {
      const a = g.a;
      const depthX = a * 0.42;
      const depthY = -a * 0.34;
      const raw = {
        A: { x: 0, y: 0 },
        B: { x: a, y: 0 },
        C: { x: a, y: a },
        D: { x: 0, y: a }
      };
      raw.E = { x: raw.A.x + depthX, y: raw.A.y + depthY };
      raw.F = { x: raw.B.x + depthX, y: raw.B.y + depthY };
      raw.G = { x: raw.C.x + depthX, y: raw.C.y + depthY };
      raw.H = { x: raw.D.x + depthX, y: raw.D.y + depthY };
      const values = Object.keys(raw).map(function (key) { return raw[key]; });
      const minX = Math.min.apply(null, values.map(function (p) { return p.x; }));
      const maxX = Math.max.apply(null, values.map(function (p) { return p.x; }));
      const minY = Math.min.apply(null, values.map(function (p) { return p.y; }));
      const maxY = Math.max.apply(null, values.map(function (p) { return p.y; }));
      const scale = Math.min(660 / Math.max(1, maxX - minX), 660 / Math.max(1, maxY - minY));
      const offsetX = 500 - ((minX + maxX) / 2) * scale;
      const offsetY = 520 - ((minY + maxY) / 2) * scale;
      const points = {};
      Object.keys(raw).forEach(function (key) {
        points[key] = { x: raw[key].x * scale + offsetX, y: raw[key].y * scale + offsetY };
      });
      return points;
    }

    function regularOctahedronPoints(g) {
      const a = g.a;
      const r = a / Math.sqrt(2);
      const raw3d = {
        A: { x: 0, y: 0, z: r },
        B: { x: -r, y: 0, z: 0 },
        C: { x: 0, y: r, z: 0 },
        D: { x: r, y: 0, z: 0 },
        E: { x: 0, y: -r, z: 0 },
        F: { x: 0, y: 0, z: -r }
      };
      const raw = {};
      Object.keys(raw3d).forEach(function (key) {
        const point = raw3d[key];
        raw[key] = {
          x: point.x + point.y * 0.52,
          y: -point.z + point.y * 0.2
        };
      });
      const values = Object.keys(raw).map(function (key) { return raw[key]; });
      const minX = Math.min.apply(null, values.map(function (p) { return p.x; }));
      const maxX = Math.max.apply(null, values.map(function (p) { return p.x; }));
      const minY = Math.min.apply(null, values.map(function (p) { return p.y; }));
      const maxY = Math.max.apply(null, values.map(function (p) { return p.y; }));
      const scale = Math.min(690 / Math.max(1, maxX - minX), 710 / Math.max(1, maxY - minY));
      const offsetX = 500 - ((minX + maxX) / 2) * scale;
      const offsetY = 520 - ((minY + maxY) / 2) * scale;
      const points = {};
      Object.keys(raw).forEach(function (key) {
        points[key] = { x: raw[key].x * scale + offsetX, y: raw[key].y * scale + offsetY };
      });
      return points;
    }

    function regularDodecahedronData(g) {
      const phi = (1 + Math.sqrt(5)) / 2;
      const invPhi = 1 / phi;
      const base = [
        [-1, -1, -1], [-1, -1, 1], [-1, 1, -1], [-1, 1, 1],
        [1, -1, -1], [1, -1, 1], [1, 1, -1], [1, 1, 1],
        [0, -invPhi, -phi], [0, -invPhi, phi], [0, invPhi, -phi], [0, invPhi, phi],
        [-invPhi, -phi, 0], [-invPhi, phi, 0], [invPhi, -phi, 0], [invPhi, phi, 0],
        [-phi, 0, -invPhi], [phi, 0, -invPhi], [-phi, 0, invPhi], [phi, 0, invPhi]
      ];
      const pointIds = 'ABCDEFGHIJKLMNOPQRST'.split('');
      const scaleToA = g.a * phi / 2;
      const rotateX = -18 * Math.PI / 180;
      const rotateY = 23 * Math.PI / 180;
      const rotateZ = -7 * Math.PI / 180;
      const cx = Math.cos(rotateX);
      const sx = Math.sin(rotateX);
      const cy = Math.cos(rotateY);
      const sy = Math.sin(rotateY);
      const cz = Math.cos(rotateZ);
      const sz = Math.sin(rotateZ);
      function rotate(point) {
        let x = point[0] * scaleToA;
        let y = point[1] * scaleToA;
        let z = point[2] * scaleToA;
        const y1 = y * cx - z * sx;
        const z1 = y * sx + z * cx;
        y = y1;
        z = z1;
        const x2 = x * cy + z * sy;
        const z2 = -x * sy + z * cy;
        x = x2;
        z = z2;
        const x3 = x * cz - y * sz;
        const y3 = x * sz + y * cz;
        return { x: x3, y: y3, z: z };
      }
      const rotated = base.map(rotate);
      const raw = {};
      pointIds.forEach(function (id, index) {
        const p = rotated[index];
        raw[id] = {
          x: p.x + p.y * 0.24,
          y: -p.z + p.y * 0.14,
          depth: p.y
        };
      });
      const values = Object.keys(raw).map(function (key) { return raw[key]; });
      const minX = Math.min.apply(null, values.map(function (p) { return p.x; }));
      const maxX = Math.max.apply(null, values.map(function (p) { return p.x; }));
      const minY = Math.min.apply(null, values.map(function (p) { return p.y; }));
      const maxY = Math.max.apply(null, values.map(function (p) { return p.y; }));
      const scale = Math.min(690 / Math.max(1, maxX - minX), 690 / Math.max(1, maxY - minY));
      const offsetX = 500 - ((minX + maxX) / 2) * scale;
      const offsetY = 520 - ((minY + maxY) / 2) * scale;
      const points = {};
      pointIds.forEach(function (id) {
        points[id] = {
          x: raw[id].x * scale + offsetX,
          y: raw[id].y * scale + offsetY,
          depth: raw[id].depth
        };
      });
      const edges = [];
      for (let i = 0; i < rotated.length; i += 1) {
        for (let j = i + 1; j < rotated.length; j += 1) {
          const dx = rotated[i].x - rotated[j].x;
          const dy = rotated[i].y - rotated[j].y;
          const dz = rotated[i].z - rotated[j].z;
          const distance = Math.hypot(dx, dy, dz);
          if (Math.abs(distance - g.a) < g.a * 0.02) {
            const from = pointIds[i];
            const to = pointIds[j];
            const edgeId = from + to;
            edges.push({
              id: edgeId,
              from: from,
              to: to,
              hidden: edgeId === 'FJ' || edgeId === 'FT' || edgeId === 'BJ'
                ? false
                : (points[from].depth + points[to].depth) / 2 < -g.a * 0.18
            });
          }
        }
      }
      return { points: points, edges: edges, pointIds: pointIds };
    }

    function regularIcosahedronData(g) {
      const phi = (1 + Math.sqrt(5)) / 2;
      const base = [
        [0, -1, -phi], [0, -1, phi], [0, 1, -phi], [0, 1, phi],
        [-1, -phi, 0], [-1, phi, 0], [1, -phi, 0], [1, phi, 0],
        [-phi, 0, -1], [phi, 0, -1], [-phi, 0, 1], [phi, 0, 1]
      ];
      const pointIds = 'ABCDEFGHIJKL'.split('');
      const scaleToA = g.a / 2;
      const rotateX = -16 * Math.PI / 180;
      const rotateY = 26 * Math.PI / 180;
      const rotateZ = 8 * Math.PI / 180;
      const cx = Math.cos(rotateX);
      const sx = Math.sin(rotateX);
      const cy = Math.cos(rotateY);
      const sy = Math.sin(rotateY);
      const cz = Math.cos(rotateZ);
      const sz = Math.sin(rotateZ);
      function rotate(point) {
        let x = point[0] * scaleToA;
        let y = point[1] * scaleToA;
        let z = point[2] * scaleToA;
        const y1 = y * cx - z * sx;
        const z1 = y * sx + z * cx;
        y = y1;
        z = z1;
        const x2 = x * cy + z * sy;
        const z2 = -x * sy + z * cy;
        x = x2;
        z = z2;
        const x3 = x * cz - y * sz;
        const y3 = x * sz + y * cz;
        return { x: x3, y: y3, z: z };
      }
      const rotated = base.map(rotate);
      const raw = {};
      pointIds.forEach(function (id, index) {
        const p = rotated[index];
        raw[id] = {
          x: p.x + p.y * 0.24,
          y: -p.z + p.y * 0.14,
          depth: p.y
        };
      });
      const values = Object.keys(raw).map(function (key) { return raw[key]; });
      const minX = Math.min.apply(null, values.map(function (p) { return p.x; }));
      const maxX = Math.max.apply(null, values.map(function (p) { return p.x; }));
      const minY = Math.min.apply(null, values.map(function (p) { return p.y; }));
      const maxY = Math.max.apply(null, values.map(function (p) { return p.y; }));
      const scale = Math.min(690 / Math.max(1, maxX - minX), 710 / Math.max(1, maxY - minY));
      const offsetX = 500 - ((minX + maxX) / 2) * scale;
      const offsetY = 520 - ((minY + maxY) / 2) * scale;
      const points = {};
      pointIds.forEach(function (id) {
        points[id] = {
          x: raw[id].x * scale + offsetX,
          y: raw[id].y * scale + offsetY,
          depth: raw[id].depth
        };
      });
      const edges = [];
      for (let i = 0; i < rotated.length; i += 1) {
        for (let j = i + 1; j < rotated.length; j += 1) {
          const dx = rotated[i].x - rotated[j].x;
          const dy = rotated[i].y - rotated[j].y;
          const dz = rotated[i].z - rotated[j].z;
          const distance = Math.hypot(dx, dy, dz);
          if (Math.abs(distance - g.a) < g.a * 0.02) {
            const from = pointIds[i];
            const to = pointIds[j];
            edges.push({
              id: from + to,
              from: from,
              to: to,
              hidden: (points[from].depth + points[to].depth) / 2 < -g.a * 0.12
            });
          }
        }
      }
      return { points: points, edges: edges, pointIds: pointIds };
    }

    function rightTriangularPyramidPoints(g) {
      const ex = { x: -1.08, y: 0.05 };
      const ey = { x: 0.46, y: -0.36 };
      const ez = { x: 0, y: 1.05 };
      const raw = {};
      function fromB(x, y, z) {
        return {
          x: x * ex.x + y * ey.x + z * ez.x,
          y: x * ex.y + y * ey.y + z * ez.y
        };
      }
      raw.B = fromB(0, 0, 0);
      raw.A = fromB(g.BA, 0, 0);
      raw.C = fromB(0, g.BC, 0);
      raw.D = fromB(g.BA, g.BC, 0);
      raw.F = fromB(0, 0, g.BF);
      raw.E = fromB(g.BA, 0, g.BF);
      raw.G = fromB(0, g.BC, g.BF);
      raw.H = fromB(g.BA, g.BC, g.BF);
      const values = Object.keys(raw).map(function (key) { return raw[key]; });
      const minX = Math.min.apply(null, values.map(function (p) { return p.x; }));
      const maxX = Math.max.apply(null, values.map(function (p) { return p.x; }));
      const minY = Math.min.apply(null, values.map(function (p) { return p.y; }));
      const maxY = Math.max.apply(null, values.map(function (p) { return p.y; }));
      const scale = Math.min(680 / Math.max(1, maxX - minX), 660 / Math.max(1, maxY - minY));
      const offsetX = 500 - ((minX + maxX) / 2) * scale;
      const offsetY = 520 - ((minY + maxY) / 2) * scale;
      const points = {};
      Object.keys(raw).forEach(function (key) {
        points[key] = { x: raw[key].x * scale + offsetX, y: raw[key].y * scale + offsetY };
      });
      return points;
    }

    function quadrangularPyramidPoints(g) {
      const a = g.BC;
      const b = g.CD;
      const c = g.DE;
      const d = g.EB;
      let theta = 62 * Math.PI / 180;
      for (let deg = 62; deg >= 32; deg -= 2) {
        const testTheta = deg * Math.PI / 180;
        const testE = { x: d * Math.cos(testTheta), y: d * Math.sin(testTheta) };
        const testDistance = Math.hypot(testE.x - a, testE.y);
        if (Math.abs(b - c) < testDistance && testDistance < b + c) {
          theta = testTheta;
          break;
        }
      }
      const base = {
        B: { x: 0, y: 0 },
        C: { x: a, y: 0 },
        E: { x: d * Math.cos(theta), y: d * Math.sin(theta) }
      };
      const candidates = circleIntersection(base.C, b, base.E, c);
      base.D = candidates[0].y >= candidates[1].y ? candidates[0] : candidates[1];
      const hRaw = {
        x: (base.B.x + base.C.x + base.D.x + base.E.x) / 4,
        y: (base.B.y + base.C.y + base.D.y + base.E.y) / 4
      };
      const raw = {};
      function projectBase(point) {
        return {
          x: point.x + point.y * 0.24,
          y: point.y * 0.52
        };
      }
      ['B', 'C', 'D', 'E'].forEach(function (key) {
        raw[key] = projectBase(base[key]);
      });
      raw.H = projectBase(hRaw);
      raw.A = { x: raw.H.x, y: raw.H.y - g.AH };
      const values = Object.keys(raw).map(function (key) { return raw[key]; });
      const minX = Math.min.apply(null, values.map(function (p) { return p.x; }));
      const maxX = Math.max.apply(null, values.map(function (p) { return p.x; }));
      const minY = Math.min.apply(null, values.map(function (p) { return p.y; }));
      const maxY = Math.max.apply(null, values.map(function (p) { return p.y; }));
      const scale = Math.min(600 / Math.max(1, maxX - minX), 620 / Math.max(1, maxY - minY));
      const offsetX = 500 - ((minX + maxX) / 2) * scale;
      const offsetY = 540 - ((minY + maxY) / 2) * scale;
      const points = {};
      Object.keys(raw).forEach(function (key) {
        points[key] = { x: raw[key].x * scale + offsetX, y: raw[key].y * scale + offsetY };
      });
      return points;
    }

    function pentagonalPyramidPoints(g) {
      const baseList = cyclicPolygonPointsFromSides([g.BC, g.CD, g.DE, g.EF, g.FB]);
      const base = {
        B: baseList[0],
        C: baseList[1],
        D: baseList[2],
        E: baseList[3],
        F: baseList[4]
      };
      const hRaw = ['B', 'C', 'D', 'E', 'F'].reduce(function (sum, key) {
        sum.x += base[key].x / 5;
        sum.y += base[key].y / 5;
        return sum;
      }, { x: 0, y: 0 });
      const raw = {};
      function projectBase(point) {
        return {
          x: point.x + point.y * 0.24,
          y: point.y * 0.52
        };
      }
      ['B', 'C', 'D', 'E', 'F'].forEach(function (key) {
        raw[key] = projectBase(base[key]);
      });
      raw.H = projectBase(hRaw);
      raw.A = { x: raw.H.x, y: raw.H.y - g.AH };
      const values = Object.keys(raw).map(function (key) { return raw[key]; });
      const minX = Math.min.apply(null, values.map(function (p) { return p.x; }));
      const maxX = Math.max.apply(null, values.map(function (p) { return p.x; }));
      const minY = Math.min.apply(null, values.map(function (p) { return p.y; }));
      const maxY = Math.max.apply(null, values.map(function (p) { return p.y; }));
      const scale = Math.min(620 / Math.max(1, maxX - minX), 620 / Math.max(1, maxY - minY));
      const offsetX = 500 - ((minX + maxX) / 2) * scale;
      const offsetY = 540 - ((minY + maxY) / 2) * scale;
      const points = {};
      Object.keys(raw).forEach(function (key) {
        points[key] = { x: raw[key].x * scale + offsetX, y: raw[key].y * scale + offsetY };
      });
      return points;
    }

    function hexagonalPyramidPoints(g) {
      const baseList = cyclicPolygonPointsFromSides([g.BC, g.CD, g.DE, g.EF, g.FG, g.GB]);
      const base = {
        B: baseList[0],
        C: baseList[1],
        D: baseList[2],
        E: baseList[3],
        F: baseList[4],
        G: baseList[5]
      };
      const hRaw = ['B', 'C', 'D', 'E', 'F', 'G'].reduce(function (sum, key) {
        sum.x += base[key].x / 6;
        sum.y += base[key].y / 6;
        return sum;
      }, { x: 0, y: 0 });
      const raw = {};
      function projectBase(point) {
        return {
          x: point.x + point.y * 0.24,
          y: point.y * 0.52
        };
      }
      ['B', 'C', 'D', 'E', 'F', 'G'].forEach(function (key) {
        raw[key] = projectBase(base[key]);
      });
      raw.H = projectBase(hRaw);
      raw.A = { x: raw.H.x, y: raw.H.y - g.AH };
      const values = Object.keys(raw).map(function (key) { return raw[key]; });
      const minX = Math.min.apply(null, values.map(function (p) { return p.x; }));
      const maxX = Math.max.apply(null, values.map(function (p) { return p.x; }));
      const minY = Math.min.apply(null, values.map(function (p) { return p.y; }));
      const maxY = Math.max.apply(null, values.map(function (p) { return p.y; }));
      const scale = Math.min(630 / Math.max(1, maxX - minX), 620 / Math.max(1, maxY - minY));
      const offsetX = 500 - ((minX + maxX) / 2) * scale;
      const offsetY = 540 - ((minY + maxY) / 2) * scale;
      const points = {};
      Object.keys(raw).forEach(function (key) {
        points[key] = { x: raw[key].x * scale + offsetX, y: raw[key].y * scale + offsetY };
      });
      return points;
    }

    function circleIntersection(p1, r1, p2, r2) {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const d = Math.hypot(dx, dy) || 1;
      const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
      const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
      const ux = dx / d;
      const uy = dy / d;
      const base = { x: p1.x + ux * a, y: p1.y + uy * a };
      return [
        { x: base.x - uy * h, y: base.y + ux * h },
        { x: base.x + uy * h, y: base.y - ux * h }
      ];
    }

    function quadrangularPrismPoints(g) {
      const a = g.EF;
      const b = g.FG;
      const c = g.GH;
      const d = g.HE;
      let theta = 62 * Math.PI / 180;
      for (let deg = 62; deg >= 32; deg -= 2) {
        const testTheta = deg * Math.PI / 180;
        const testH = { x: d * Math.cos(testTheta), y: d * Math.sin(testTheta) };
        const testDistance = Math.hypot(testH.x - a, testH.y);
        if (Math.abs(b - c) < testDistance && testDistance < b + c) {
          theta = testTheta;
          break;
        }
      }
      const cosE = Math.cos(theta);
      const sinE = Math.sin(theta);
      const base = {
        E: { x: 0, y: 0 },
        F: { x: a, y: 0 },
        H: { x: d * cosE, y: d * sinE }
      };
      const candidates = circleIntersection(base.F, b, base.H, c);
      base.G = candidates[0].y >= candidates[1].y ? candidates[0] : candidates[1];
      const baseValues = [base.E, base.F, base.G, base.H];
      const minBaseX = Math.min.apply(null, baseValues.map(function (p) { return p.x; }));
      const maxBaseX = Math.max.apply(null, baseValues.map(function (p) { return p.x; }));
      const minBaseY = Math.min.apply(null, baseValues.map(function (p) { return p.y; }));
      const maxBaseY = Math.max.apply(null, baseValues.map(function (p) { return p.y; }));
      const baseW = Math.max(1, maxBaseX - minBaseX);
      const baseH = Math.max(1, maxBaseY - minBaseY);
      const scale = Math.min(420 / baseW, 260 / baseH, 520 / Math.max(g.AE, 1));
      const height = g.AE * scale;
      const raw = {};
      function project(point) {
        const x = (point.x - minBaseX) * scale;
        const y = (point.y - minBaseY) * scale;
        return {
          x: x + y * 0.45,
          y: height - y * 0.36
        };
      }
      ['E', 'F', 'G', 'H'].forEach(function (key) {
        raw[key] = project(base[key]);
      });
      raw.A = { x: raw.E.x, y: raw.E.y - height };
      raw.B = { x: raw.F.x, y: raw.F.y - height };
      raw.C = { x: raw.G.x, y: raw.G.y - height };
      raw.D = { x: raw.H.x, y: raw.H.y - height };
      const values = Object.keys(raw).map(function (key) { return raw[key]; });
      const minX = Math.min.apply(null, values.map(function (p) { return p.x; }));
      const maxX = Math.max.apply(null, values.map(function (p) { return p.x; }));
      const minY = Math.min.apply(null, values.map(function (p) { return p.y; }));
      const maxY = Math.max.apply(null, values.map(function (p) { return p.y; }));
      const offsetX = 500 - (minX + maxX) / 2;
      const offsetY = 500 - (minY + maxY) / 2;
      const points = {};
      Object.keys(raw).forEach(function (key) {
        points[key] = { x: raw[key].x + offsetX, y: raw[key].y + offsetY };
      });
      return points;
    }

    function cyclicPolygonPointsFromSides(sideLengths) {
      const maxSide = Math.max.apply(null, sideLengths);
      let lo = maxSide / 2 + 0.000001;
      let hi = Math.max(maxSide, sideLengths.reduce(function (sum, value) { return sum + value; }, 0));
      function angleSum(radius) {
        return sideLengths.reduce(function (sum, side) {
          return sum + 2 * Math.asin(Math.min(1, side / (2 * radius)));
        }, 0);
      }
      while (angleSum(hi) > Math.PI * 2) hi *= 2;
      for (let index = 0; index < 80; index += 1) {
        const midRadius = (lo + hi) / 2;
        if (angleSum(midRadius) > Math.PI * 2) lo = midRadius;
        else hi = midRadius;
      }
      const radius = hi;
      const centralAngles = sideLengths.map(function (side) {
        return 2 * Math.asin(Math.min(1, side / (2 * radius)));
      });
      const points = [{ x: radius, y: 0 }];
      let angle = 0;
      for (let index = 0; index < sideLengths.length - 1; index += 1) {
        angle += centralAngles[index];
        points.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
      }
      const dx = points[1].x - points[0].x;
      const dy = points[1].y - points[0].y;
      const rotate = -Math.atan2(dy, dx);
      const cos = Math.cos(rotate);
      const sin = Math.sin(rotate);
      const rotated = points.map(function (point) {
        return {
          x: point.x * cos - point.y * sin,
          y: point.x * sin + point.y * cos
        };
      });
      const frontY = (rotated[0].y + rotated[1].y) / 2;
      const restY = rotated.slice(2).reduce(function (sum, point) { return sum + point.y; }, 0) / Math.max(1, rotated.length - 2);
      if (restY < frontY) {
        rotated.forEach(function (point) { point.y *= -1; });
      }
      return rotated;
    }

    function pentagonalPrismPoints(g) {
      const baseList = cyclicPolygonPointsFromSides([g.FG, g.GH, g.HI, g.IJ, g.JF]);
      const base = {
        F: baseList[0],
        G: baseList[1],
        H: baseList[2],
        I: baseList[3],
        J: baseList[4]
      };
      const baseValues = [base.F, base.G, base.H, base.I, base.J];
      const minBaseX = Math.min.apply(null, baseValues.map(function (p) { return p.x; }));
      const maxBaseX = Math.max.apply(null, baseValues.map(function (p) { return p.x; }));
      const minBaseY = Math.min.apply(null, baseValues.map(function (p) { return p.y; }));
      const maxBaseY = Math.max.apply(null, baseValues.map(function (p) { return p.y; }));
      const baseW = Math.max(1, maxBaseX - minBaseX);
      const baseH = Math.max(1, maxBaseY - minBaseY);
      const scale = Math.min(430 / baseW, 260 / baseH, 520 / Math.max(g.AF, 1));
      const height = g.AF * scale;
      const raw = {};
      function project(point) {
        const x = (point.x - minBaseX) * scale;
        const y = (point.y - minBaseY) * scale;
        return {
          x: x + y * 0.45,
          y: height - y * 0.36
        };
      }
      ['F', 'G', 'H', 'I', 'J'].forEach(function (key) {
        raw[key] = project(base[key]);
      });
      raw.A = { x: raw.F.x, y: raw.F.y - height };
      raw.B = { x: raw.G.x, y: raw.G.y - height };
      raw.C = { x: raw.H.x, y: raw.H.y - height };
      raw.D = { x: raw.I.x, y: raw.I.y - height };
      raw.E = { x: raw.J.x, y: raw.J.y - height };
      const values = Object.keys(raw).map(function (key) { return raw[key]; });
      const minX = Math.min.apply(null, values.map(function (p) { return p.x; }));
      const maxX = Math.max.apply(null, values.map(function (p) { return p.x; }));
      const minY = Math.min.apply(null, values.map(function (p) { return p.y; }));
      const maxY = Math.max.apply(null, values.map(function (p) { return p.y; }));
      const offsetX = 500 - (minX + maxX) / 2;
      const offsetY = 500 - (minY + maxY) / 2;
      const points = {};
      Object.keys(raw).forEach(function (key) {
        points[key] = { x: raw[key].x + offsetX, y: raw[key].y + offsetY };
      });
      return points;
    }

    function hexagonalPrismPoints(g) {
      const baseList = cyclicPolygonPointsFromSides([g.GH, g.HI, g.IJ, g.JK, g.KL, g.LG]);
      const base = {
        G: baseList[0],
        H: baseList[1],
        I: baseList[2],
        J: baseList[3],
        K: baseList[4],
        L: baseList[5]
      };
      const baseValues = [base.G, base.H, base.I, base.J, base.K, base.L];
      const minBaseX = Math.min.apply(null, baseValues.map(function (p) { return p.x; }));
      const maxBaseX = Math.max.apply(null, baseValues.map(function (p) { return p.x; }));
      const minBaseY = Math.min.apply(null, baseValues.map(function (p) { return p.y; }));
      const maxBaseY = Math.max.apply(null, baseValues.map(function (p) { return p.y; }));
      const baseW = Math.max(1, maxBaseX - minBaseX);
      const baseH = Math.max(1, maxBaseY - minBaseY);
      const scale = Math.min(440 / baseW, 270 / baseH, 520 / Math.max(g.AG, 1));
      const height = g.AG * scale;
      const raw = {};
      function project(point) {
        const x = (point.x - minBaseX) * scale;
        const y = (point.y - minBaseY) * scale;
        return {
          x: x + y * 0.45,
          y: height - y * 0.36
        };
      }
      ['G', 'H', 'I', 'J', 'K', 'L'].forEach(function (key) {
        raw[key] = project(base[key]);
      });
      raw.A = { x: raw.G.x, y: raw.G.y - height };
      raw.B = { x: raw.H.x, y: raw.H.y - height };
      raw.C = { x: raw.I.x, y: raw.I.y - height };
      raw.D = { x: raw.J.x, y: raw.J.y - height };
      raw.E = { x: raw.K.x, y: raw.K.y - height };
      raw.F = { x: raw.L.x, y: raw.L.y - height };
      const values = Object.keys(raw).map(function (key) { return raw[key]; });
      const minX = Math.min.apply(null, values.map(function (p) { return p.x; }));
      const maxX = Math.max.apply(null, values.map(function (p) { return p.x; }));
      const minY = Math.min.apply(null, values.map(function (p) { return p.y; }));
      const maxY = Math.max.apply(null, values.map(function (p) { return p.y; }));
      const offsetX = 500 - (minX + maxX) / 2;
      const offsetY = 500 - (minY + maxY) / 2;
      const points = {};
      Object.keys(raw).forEach(function (key) {
        points[key] = { x: raw[key].x + offsetX, y: raw[key].y + offsetY };
      });
      return points;
    }

    function renderTriangularPrism(g) {
      const P = trianglePrismPoints(g);
      const center = {
        x: (P.A.x + P.B.x + P.C.x + P.D.x + P.E.x + P.F.x) / 6,
        y: (P.A.y + P.B.y + P.C.y + P.D.y + P.E.y + P.F.y) / 6
      };
      function mid(P1, P2, dx, dy) {
        return { x: (P1.x + P2.x) / 2 + (dx || 0), y: (P1.y + P2.y) / 2 + (dy || 0) };
      }

      drawVisibleSegment(P.D, P.E, true);
      drawVisibleSegment(P.E, P.F, false);
      drawVisibleSegment(P.F, P.D, true);
      drawVisibleSegment(P.A, P.D, true);
      drawVisibleSegment(P.B, P.E, false);
      drawVisibleSegment(P.C, P.F, false);
      drawVisibleSegment(P.A, P.B, false);
      drawVisibleSegment(P.B, P.C, false);
      drawVisibleSegment(P.C, P.A, false);

      appendSegment(P.A, P.B, 'AB', g.AB, center, mid(P.A, P.B, -28, -16));
      appendSegment(P.B, P.C, 'BC', g.BC, center, mid(P.B, P.C, 0, -28));
      appendSegment(P.C, P.A, 'CA', g.CA, center, mid(P.C, P.A, 28, -16));
      appendSegment(P.A, P.D, 'AD', g.AD, center, mid(P.A, P.D, 34, 0));
      appendSegment(P.B, P.E, 'BE', g.AD, center);
      appendSegment(P.C, P.F, 'CF', g.AD, center);
      appendSegment(P.D, P.E, 'DE', g.AB, center);
      appendSegment(P.E, P.F, 'EF', g.BC, center);
      appendSegment(P.F, P.D, 'FD', g.CA, center);
      appendAngle(P.E, P.B, P.D, 'BED', 90, {
        x: P.E.x + 82,
        y: P.E.y - 78
      });
      [
        { id: 'BEF', vertex: P.E, p1: P.B, p2: P.F, label: { x: P.E.x + 82, y: P.E.y - 30 } },
        { id: 'CFE', vertex: P.F, p1: P.C, p2: P.E, label: { x: P.F.x - 82, y: P.F.y - 30 } },
        { id: 'CFD', vertex: P.F, p1: P.C, p2: P.D, label: { x: P.F.x - 82, y: P.F.y - 78 } },
        { id: 'EBC', vertex: P.B, p1: P.E, p2: P.C, label: { x: P.B.x + 82, y: P.B.y + 42 } },
        { id: 'FCB', vertex: P.C, p1: P.F, p2: P.B, label: { x: P.C.x - 82, y: P.C.y + 42 } },
        { id: 'ABE', vertex: P.B, p1: P.A, p2: P.E, label: { x: P.B.x + 58, y: P.B.y + 76 } },
        { id: 'ACF', vertex: P.C, p1: P.A, p2: P.F, label: { x: P.C.x - 58, y: P.C.y + 76 } },
        { id: 'BAD', vertex: P.A, p1: P.B, p2: P.D, label: { x: P.A.x + 76, y: P.A.y + 62 } },
        { id: 'CAD', vertex: P.A, p1: P.C, p2: P.D, label: { x: P.A.x - 76, y: P.A.y + 62 } }
      ].forEach(function (angle) {
        appendAngle(angle.vertex, angle.p1, angle.p2, angle.id, 90, angle.label);
      });

      ['A', 'B', 'C', 'D', 'E', 'F'].forEach(function (id) {
        stage.appendChild(attachPointModal(svg('circle', { cx: P[id].x, cy: P[id].y, r: 28, class: 'solid-point-hit' }), id));
      });
      addPointLabel(pointInputs.A, P.A.x, P.A.y - 30, 'A');
      addPointLabel(pointInputs.B, P.B.x - 26, P.B.y - 22, 'B');
      addPointLabel(pointInputs.C, P.C.x + 26, P.C.y - 22, 'C');
      addPointLabel(pointInputs.D, P.D.x, P.D.y + 30, 'D');
      addPointLabel(pointInputs.E, P.E.x - 26, P.E.y + 24, 'E');
      addPointLabel(pointInputs.F, P.F.x + 26, P.F.y + 24, 'F');
      setStatus('入力をもとに三角柱を描画しています。', false);
    }

    function renderTriangularPyramid(g) {
      const P = triangularPyramidPoints(g);
      const center = {
        x: (P.A.x + P.B.x + P.C.x + P.D.x + P.H.x) / 5,
        y: (P.A.y + P.B.y + P.C.y + P.D.y + P.H.y) / 5
      };
      function mid(P1, P2, dx, dy) {
        return { x: (P1.x + P2.x) / 2 + (dx || 0), y: (P1.y + P2.y) / 2 + (dy || 0) };
      }

      drawVisibleSegment(P.A, P.B, false);
      drawVisibleSegment(P.A, P.C, false);
      drawVisibleSegment(P.A, P.D, false);
      drawVisibleSegment(P.B, P.C, true);
      drawVisibleSegment(P.C, P.D, false);
      drawVisibleSegment(P.D, P.B, false);
      drawVisibleSegment(P.A, P.H, true);

      appendSegment(P.A, P.H, 'AH', g.AH, center, mid(P.A, P.H, -64, 0));
      appendSegment(P.B, P.C, 'BC', g.BC, center, mid(P.B, P.C, 0, 38));
      appendSegment(P.C, P.D, 'CD', g.CD, center, mid(P.C, P.D, 42, -10));
      appendSegment(P.D, P.B, 'DB', g.DB, center, mid(P.D, P.B, -42, -10));
      appendSegment(P.A, P.B, 'AB', Math.hypot(g.AH, Math.hypot(P.B.x - P.H.x, P.B.y - P.H.y)), center);
      appendSegment(P.A, P.C, 'AC', Math.hypot(g.AH, Math.hypot(P.C.x - P.H.x, P.C.y - P.H.y)), center);
      appendSegment(P.A, P.D, 'AD', Math.hypot(g.AH, Math.hypot(P.D.x - P.H.x, P.D.y - P.H.y)), center);
      appendSegment(P.B, P.H, 'BH', 0, center);
      appendSegment(P.C, P.H, 'CH', 0, center);
      appendSegment(P.D, P.H, 'DH', 0, center);

      ['A', 'B', 'C', 'D', 'H'].forEach(function (id) {
        stage.appendChild(attachPointModal(svg('circle', { cx: P[id].x, cy: P[id].y, r: 28, class: 'solid-point-hit' }), id));
      });
      addPointLabel(pointInputs.A, P.A.x, P.A.y - 34, 'A');
      addPointLabel(pointInputs.B, P.B.x - 28, P.B.y + 22, 'B');
      addPointLabel(pointInputs.C, P.C.x + 28, P.C.y + 22, 'C');
      addPointLabel(pointInputs.D, P.D.x, P.D.y - 30, 'D');
      addPointLabel(pointInputs.H, P.H.x + 28, P.H.y + 20, 'H');
      setStatus('入力をもとに三角錐を描画しています。', false);
    }

    function renderRightTriangularPyramid1(g) {
      const P = rightTriangularPyramid1Points(g);
      const center = {
        x: (P.A.x + P.B.x + P.C.x + P.D.x) / 4,
        y: (P.A.y + P.B.y + P.C.y + P.D.y) / 4
      };
      function mid(P1, P2, dx, dy) {
        return { x: (P1.x + P2.x) / 2 + (dx || 0), y: (P1.y + P2.y) / 2 + (dy || 0) };
      }

      drawVisibleSegment(P.A, P.B, false);
      drawVisibleSegment(P.A, P.C, false);
      drawVisibleSegment(P.A, P.D, false);
      drawVisibleSegment(P.B, P.C, true);
      drawVisibleSegment(P.B, P.D, false);
      drawVisibleSegment(P.C, P.D, false);

      appendSegment(P.A, P.B, 'AB', g.AB, center, mid(P.A, P.B, -56, 0));
      appendSegment(P.C, P.B, 'CB', g.CB, center, mid(P.C, P.B, 0, -34));
      appendSegment(P.D, P.B, 'DB', g.DB, center, mid(P.D, P.B, -44, 22));
      appendSegment(P.A, P.C, 'AC', Math.hypot(g.AB, g.CB), center, mid(P.A, P.C, 42, -12), null, formatPythagoreanLabel(g.AB, g.CB));
      appendSegment(P.A, P.D, 'AD', Math.hypot(g.AB, g.DB), center, mid(P.A, P.D, -16, -34), null, formatPythagoreanLabel(g.AB, g.DB));
      appendSegment(P.C, P.D, 'CD', Math.hypot(g.CB, g.DB), center, mid(P.C, P.D, 42, 26), null, formatPythagoreanLabel(g.CB, g.DB));

      appendAngle(P.B, P.A, P.C, 'ABC', 90, { x: P.B.x + 58, y: P.B.y - 54 });
      appendAngle(P.B, P.A, P.D, 'ABD', 90, { x: P.B.x - 58, y: P.B.y - 34 });
      appendAngle(P.B, P.C, P.D, 'CBD', 90, { x: P.B.x + 38, y: P.B.y + 52 });

      ['A', 'B', 'C', 'D'].forEach(function (id) {
        stage.appendChild(attachPointModal(svg('circle', { cx: P[id].x, cy: P[id].y, r: 28, class: 'solid-point-hit' }), id));
      });
      addPointLabel(pointInputs.A, P.A.x - 28, P.A.y - 34, 'A');
      addPointLabel(pointInputs.B, P.B.x - 30, P.B.y + 18, 'B');
      addPointLabel(pointInputs.C, P.C.x + 30, P.C.y - 20, 'C');
      addPointLabel(pointInputs.D, P.D.x + 20, P.D.y + 28, 'D');
      setStatus('AB、CB、DB から直角三角錐①を描画しています。', false);
    }

    function renderRightTriangularPyramid(g) {
      const P = rightTriangularPyramidPoints(g);
      const center = {
        x: (P.A.x + P.B.x + P.C.x + P.D.x + P.E.x + P.F.x + P.G.x + P.H.x) / 8,
        y: (P.A.y + P.B.y + P.C.y + P.D.y + P.E.y + P.F.y + P.G.y + P.H.y) / 8
      };
      function mid(P1, P2, dx, dy) {
        return { x: (P1.x + P2.x) / 2 + (dx || 0), y: (P1.y + P2.y) / 2 + (dy || 0) };
      }

      drawVisibleSegment(P.C, P.D, false);
      drawVisibleSegment(P.D, P.A, false);
      drawVisibleSegment(P.A, P.E, false);
      drawVisibleSegment(P.C, P.G, false);
      drawVisibleSegment(P.D, P.H, true);
      drawVisibleSegment(P.E, P.F, false);
      drawVisibleSegment(P.F, P.G, false);
      drawVisibleSegment(P.G, P.H, true);
      drawVisibleSegment(P.H, P.E, true);
      drawVisibleSegment(P.A, P.C, false);
      drawVisibleSegment(P.C, P.F, false);
      drawVisibleSegment(P.F, P.A, false);

      appendAreaRegion('ABF', [P.A, P.B, P.F], g.BA * g.BF / 2);
      appendAreaRegion('ABC', [P.A, P.B, P.C], g.BA * g.BC / 2);
      appendAreaRegion('BCF', [P.B, P.C, P.F], g.BC * g.BF / 2);

      appendSegment(P.B, P.A, 'BA', g.BA, center, mid(P.B, P.A, 0, 32));
      appendSegment(P.B, P.C, 'BC', g.BC, center, mid(P.B, P.C, 38, -8));
      appendSegment(P.B, P.F, 'BF', g.BF, center, mid(P.B, P.F, -54, 0));
      appendSegment(P.A, P.C, 'AC', Math.hypot(g.BA, g.BC), center, mid(P.A, P.C, -4, -34), null, formatPythagoreanLabel(g.BA, g.BC));
      appendSegment(P.C, P.F, 'CF', Math.hypot(g.BC, g.BF), center, mid(P.C, P.F, 42, 12), null, formatPythagoreanLabel(g.BC, g.BF));
      appendSegment(P.F, P.A, 'FA', Math.hypot(g.BF, g.BA), center, mid(P.F, P.A, -18, 28), null, formatPythagoreanLabel(g.BF, g.BA));
      appendSegment(P.C, P.D, 'CD', g.BA, center);
      appendSegment(P.D, P.A, 'DA', g.BC, center);
      appendSegment(P.A, P.E, 'AE', g.BF, center);
      appendSegment(P.E, P.F, 'EF', g.BA, center);
      appendSegment(P.F, P.G, 'FG', g.BC, center);
      appendSegment(P.G, P.H, 'GH', g.BA, center);
      appendSegment(P.H, P.E, 'HE', g.BC, center);
      appendSegment(P.C, P.G, 'CG', g.BF, center);
      appendSegment(P.D, P.H, 'DH', g.BF, center);

      appendAngle(P.B, P.A, P.C, 'ABC', 90, { x: P.B.x - 46, y: P.B.y - 42 });
      appendAngle(P.B, P.C, P.F, 'CBF', 90, { x: P.B.x + 58, y: P.B.y + 34 });
      appendAngle(P.B, P.F, P.A, 'FBA', 90, { x: P.B.x - 20, y: P.B.y + 64 });
      appendAreaHitDisk('ABC', currentAreas.ABC.labelPoint, 70);

      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach(function (id) {
        stage.appendChild(attachPointModal(svg('circle', { cx: P[id].x, cy: P[id].y, r: 28, class: 'solid-point-hit' }), id));
      });
      addPointLabel(pointInputs.A, P.A.x, P.A.y - 34, 'A');
      addPointLabel(pointInputs.B, P.B.x + 54, P.B.y - 44, 'B');
      addPointLabel(pointInputs.C, P.C.x + 28, P.C.y - 24, 'C');
      addPointLabel(pointInputs.D, P.D.x - 24, P.D.y - 26, 'D');
      addPointLabel(pointInputs.E, P.E.x - 28, P.E.y + 24, 'E');
      addPointLabel(pointInputs.F, P.F.x + 28, P.F.y + 24, 'F');
      addPointLabel(pointInputs.G, P.G.x + 28, P.G.y + 22, 'G');
      addPointLabel(pointInputs.H, P.H.x - 28, P.H.y + 22, 'H');
      setStatus('BA、BC、BF から直方体内の直角三角錐②を描画しています。', false);
    }

    function renderCrossSection1(g) {
      const P = rightTriangularPyramidPoints({ BA: g.EF, BC: g.FG, BF: g.AE });
      const center = {
        x: (P.A.x + P.B.x + P.C.x + P.D.x + P.E.x + P.F.x + P.G.x + P.H.x) / 8,
        y: (P.A.y + P.B.y + P.C.y + P.D.y + P.E.y + P.F.y + P.G.y + P.H.y) / 8
      };
      function mid(P1, P2, dx, dy) {
        return { x: (P1.x + P2.x) / 2 + (dx || 0), y: (P1.y + P2.y) / 2 + (dy || 0) };
      }
      const sectionArea = 0.5 * Math.sqrt(
        Math.pow(g.FG * g.AE, 2) +
        Math.pow(g.EF * g.AE, 2) +
        Math.pow(g.EF * g.FG, 2)
      );

      drawVisibleSegment(P.C, P.D, false);
      drawVisibleSegment(P.D, P.A, false);
      drawVisibleSegment(P.A, P.E, false);
      drawVisibleSegment(P.C, P.G, false);
      drawVisibleSegment(P.D, P.H, true);
      drawVisibleSegment(P.E, P.F, false);
      drawVisibleSegment(P.F, P.G, false);
      drawVisibleSegment(P.G, P.H, true);
      drawVisibleSegment(P.H, P.E, true);
      drawVisibleSegment(P.A, P.C, false);
      drawVisibleSegment(P.C, P.F, false);
      drawVisibleSegment(P.F, P.A, false);

      appendAreaRegion('ACF', [P.A, P.C, P.F], sectionArea);
      appendAreaHitDisk('ACF', currentAreas.ACF.labelPoint, 76);

      appendSegment(P.A, P.E, 'AE', g.AE, center, mid(P.A, P.E, -54, 0));
      appendSegment(P.E, P.F, 'EF', g.EF, center, mid(P.E, P.F, 0, 34));
      appendSegment(P.F, P.G, 'FG', g.FG, center, mid(P.F, P.G, 42, 0));
      appendSegment(P.A, P.C, 'AC', Math.hypot(g.EF, g.FG), center, mid(P.A, P.C, -4, -34), null, formatPythagoreanLabel(g.EF, g.FG));
      appendSegment(P.C, P.F, 'CF', Math.hypot(g.FG, g.AE), center, mid(P.C, P.F, 42, 12), null, formatPythagoreanLabel(g.FG, g.AE));
      appendSegment(P.F, P.A, 'FA', Math.hypot(g.AE, g.EF), center, mid(P.F, P.A, -18, 28), null, formatPythagoreanLabel(g.AE, g.EF));

      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach(function (id) {
        stage.appendChild(attachPointModal(svg('circle', { cx: P[id].x, cy: P[id].y, r: 28, class: 'solid-point-hit' }), id));
      });
      addPointLabel(pointInputs.A, P.A.x, P.A.y - 34, 'A');
      addPointLabel(pointInputs.B, P.B.x + 54, P.B.y - 44, 'B');
      addPointLabel(pointInputs.C, P.C.x + 28, P.C.y - 24, 'C');
      addPointLabel(pointInputs.D, P.D.x - 24, P.D.y - 26, 'D');
      addPointLabel(pointInputs.E, P.E.x - 28, P.E.y + 24, 'E');
      addPointLabel(pointInputs.F, P.F.x + 28, P.F.y + 24, 'F');
      addPointLabel(pointInputs.G, P.G.x + 28, P.G.y + 22, 'G');
      addPointLabel(pointInputs.H, P.H.x - 28, P.H.y + 22, 'H');
      setStatus('AE、EF、FG から直方体の断面図①を描画しています。', false);
    }

    function renderCrossSection2(g) {
      const P = rightTriangularPyramidPoints({ BA: g.CD, BC: g.DA, BF: g.AE });
      const center = {
        x: (P.A.x + P.B.x + P.C.x + P.D.x + P.E.x + P.F.x + P.G.x + P.H.x) / 8,
        y: (P.A.y + P.B.y + P.C.y + P.D.y + P.E.y + P.F.y + P.G.y + P.H.y) / 8
      };
      function mid(P1, P2, dx, dy) {
        return { x: (P1.x + P2.x) / 2 + (dx || 0), y: (P1.y + P2.y) / 2 + (dy || 0) };
      }
      const sectionArea = Math.hypot(g.CD, g.DA) * g.AE;

      drawVisibleSegment(P.C, P.D, false);
      drawVisibleSegment(P.D, P.A, false);
      drawVisibleSegment(P.A, P.E, false);
      drawVisibleSegment(P.C, P.G, false);
      drawVisibleSegment(P.D, P.H, true);
      drawVisibleSegment(P.G, P.H, true);
      drawVisibleSegment(P.H, P.E, true);
      drawVisibleSegment(P.A, P.C, false);
      drawVisibleSegment(P.C, P.G, false);
      drawVisibleSegment(P.G, P.E, true);
      drawVisibleSegment(P.E, P.A, false);

      appendAreaRegion('ACGE', [P.A, P.C, P.G, P.E], sectionArea);

      appendSegment(P.C, P.D, 'CD', g.CD, center, mid(P.C, P.D, 0, -34));
      appendSegment(P.D, P.A, 'DA', g.DA, center, mid(P.D, P.A, -42, -10));
      appendSegment(P.A, P.E, 'AE', g.AE, center, mid(P.A, P.E, -54, 0));

      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach(function (id) {
        stage.appendChild(attachPointModal(svg('circle', { cx: P[id].x, cy: P[id].y, r: 28, class: 'solid-point-hit' }), id));
      });
      addPointLabel(pointInputs.A, P.A.x, P.A.y - 34, 'A');
      addPointLabel(pointInputs.B, P.B.x + 54, P.B.y - 44, 'B');
      addPointLabel(pointInputs.C, P.C.x + 28, P.C.y - 24, 'C');
      addPointLabel(pointInputs.D, P.D.x - 24, P.D.y - 26, 'D');
      addPointLabel(pointInputs.E, P.E.x - 28, P.E.y + 24, 'E');
      addPointLabel(pointInputs.F, P.F.x + 28, P.F.y + 24, 'F');
      addPointLabel(pointInputs.G, P.G.x + 28, P.G.y + 22, 'G');
      addPointLabel(pointInputs.H, P.H.x - 28, P.H.y + 22, 'H');
      setStatus('CD、DA、AE から直方体の断面図②を描画しています。', false);
    }

    function renderCrossSection3(g) {
      const P = rightTriangularPyramidPoints({ BA: g.BA, BC: g.BC, BF: g.BF });
      const center = {
        x: (P.A.x + P.B.x + P.C.x + P.D.x + P.E.x + P.F.x + P.G.x + P.H.x) / 8,
        y: (P.A.y + P.B.y + P.C.y + P.D.y + P.E.y + P.F.y + P.G.y + P.H.y) / 8
      };
      function midPoint(P1, P2) {
        return { x: (P1.x + P2.x) / 2, y: (P1.y + P2.y) / 2 };
      }
      function mid(P1, P2, dx, dy) {
        return { x: (P1.x + P2.x) / 2 + (dx || 0), y: (P1.y + P2.y) / 2 + (dy || 0) };
      }
      function dashedSegment(P1, P2) {
        stage.appendChild(svg('line', {
          x1: P1.x,
          y1: P1.y,
          x2: P2.x,
          y2: P2.y,
          class: 'solid-outline',
          'stroke-dasharray': '10 8'
        }));
      }
      const M = {
        P: midPoint(P.D, P.A),
        Q: midPoint(P.A, P.E),
        R: midPoint(P.E, P.F),
        S: midPoint(P.F, P.G),
        T: midPoint(P.G, P.C),
        U: midPoint(P.C, P.D)
      };
      const pq = Math.hypot(g.BC, g.BF) / 2;
      const qr = Math.hypot(g.BA, g.BF) / 2;
      const rs = Math.hypot(g.BA, g.BC) / 2;
      const hexArea = Math.sqrt(
        Math.pow(g.BA * g.BC, 2) +
        Math.pow(g.BC * g.BF, 2) +
        Math.pow(g.BF * g.BA, 2)
      ) * 0.75;

      drawVisibleSegment(P.A, P.B, false);
      drawVisibleSegment(P.B, P.C, false);
      drawVisibleSegment(P.C, P.D, false);
      drawVisibleSegment(P.D, P.A, false);
      drawVisibleSegment(P.A, P.E, false);
      drawVisibleSegment(P.B, P.F, false);
      drawVisibleSegment(P.C, P.G, false);
      drawVisibleSegment(P.D, P.H, true);
      drawVisibleSegment(P.E, P.F, false);
      drawVisibleSegment(P.F, P.G, false);
      drawVisibleSegment(P.G, P.H, true);
      drawVisibleSegment(P.H, P.E, true);

      appendAreaRegion('PQRSTU', [M.P, M.Q, M.R, M.S, M.T, M.U], hexArea);
      dashedSegment(M.P, M.Q);
      dashedSegment(M.Q, M.R);
      dashedSegment(M.R, M.S);
      dashedSegment(M.S, M.T);
      dashedSegment(M.T, M.U);
      dashedSegment(M.U, M.P);

      appendSegment(P.B, P.A, 'BA', g.BA, center, mid(P.B, P.A, 0, 32));
      appendSegment(P.B, P.C, 'BC', g.BC, center, mid(P.B, P.C, 38, -8));
      appendSegment(P.B, P.F, 'BF', g.BF, center, mid(P.B, P.F, -54, 0));
      appendSegment(M.P, M.Q, 'PQ', pq, center);
      appendSegment(M.Q, M.R, 'QR', qr, center);
      appendSegment(M.R, M.S, 'RS', rs, center);
      appendSegment(M.S, M.T, 'ST', pq, center);
      appendSegment(M.T, M.U, 'TU', qr, center);
      appendSegment(M.U, M.P, 'UP', rs, center);
      appendSegment(P.A, M.P, 'AP', g.BC / 2, center);
      appendSegment(M.P, P.D, 'PD', g.BC / 2, center);
      appendSegment(P.D, M.U, 'DU', g.BA / 2, center);
      appendSegment(M.U, P.C, 'UC', g.BA / 2, center);
      appendSegment(P.C, M.T, 'CT', g.BF / 2, center);
      appendSegment(M.T, P.G, 'TG', g.BF / 2, center);
      appendSegment(P.G, M.S, 'GS', g.BC / 2, center);
      appendSegment(M.S, P.F, 'SF', g.BC / 2, center);
      appendSegment(P.F, M.R, 'FR', g.BA / 2, center);
      appendSegment(M.R, P.E, 'RE', g.BA / 2, center);
      appendSegment(P.E, M.Q, 'EQ', g.BF / 2, center);
      appendSegment(M.Q, P.A, 'QA', g.BF / 2, center);

      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach(function (id) {
        stage.appendChild(attachPointModal(svg('circle', { cx: P[id].x, cy: P[id].y, r: 28, class: 'solid-point-hit' }), id));
      });
      ['P', 'Q', 'R', 'S', 'T', 'U'].forEach(function (id) {
        stage.appendChild(attachPointModal(svg('circle', { cx: M[id].x, cy: M[id].y, r: 28, class: 'solid-point-hit' }), id));
      });
      addPointLabel(pointInputs.A, P.A.x, P.A.y - 34, 'A');
      addPointLabel(pointInputs.B, P.B.x + 54, P.B.y - 44, 'B');
      addPointLabel(pointInputs.C, P.C.x + 28, P.C.y - 24, 'C');
      addPointLabel(pointInputs.D, P.D.x - 24, P.D.y - 26, 'D');
      addPointLabel(pointInputs.E, P.E.x - 28, P.E.y + 24, 'E');
      addPointLabel(pointInputs.F, P.F.x + 28, P.F.y + 24, 'F');
      addPointLabel(pointInputs.G, P.G.x + 28, P.G.y + 22, 'G');
      addPointLabel(pointInputs.H, P.H.x - 28, P.H.y + 22, 'H');
      addPointLabel(pointInputs.P, M.P.x - 24, M.P.y - 18, 'P');
      addPointLabel(pointInputs.Q, M.Q.x - 26, M.Q.y + 4, 'Q');
      addPointLabel(pointInputs.R, M.R.x, M.R.y + 34, 'R');
      addPointLabel(pointInputs.S, M.S.x + 26, M.S.y + 18, 'S');
      addPointLabel(pointInputs.T, M.T.x + 26, M.T.y - 6, 'T');
      addPointLabel(pointInputs.U, M.U.x, M.U.y - 34, 'U');
      setStatus('BA、BC、BF から直方体の断面図③を描画しています。', false);
    }

    function renderRegularTetrahedron(g) {
      const P = regularTetrahedronPoints(g);
      const center = {
        x: (P.A.x + P.B.x + P.C.x + P.D.x) / 4,
        y: (P.A.y + P.B.y + P.C.y + P.D.y) / 4
      };
      function mid(P1, P2, dx, dy) {
        return { x: (P1.x + P2.x) / 2 + (dx || 0), y: (P1.y + P2.y) / 2 + (dy || 0) };
      }

      drawVisibleSegment(P.B, P.D, true);
      drawVisibleSegment(P.A, P.B, false);
      drawVisibleSegment(P.A, P.D, false);
      drawVisibleSegment(P.A, P.C, false);
      drawVisibleSegment(P.B, P.C, false);
      drawVisibleSegment(P.C, P.D, false);

      appendSegment(P.A, P.B, 'AB', g.a, center, mid(P.A, P.B, -42, -18));
      appendSegment(P.A, P.C, 'AC', g.a, center, mid(P.A, P.C, 0, 0));
      appendSegment(P.A, P.D, 'AD', g.a, center, mid(P.A, P.D, 42, -18));
      appendSegment(P.B, P.C, 'BC', g.a, center, mid(P.B, P.C, -28, 34));
      appendSegment(P.C, P.D, 'CD', g.a, center, mid(P.C, P.D, 28, 34));
      appendSegment(P.D, P.B, 'DB', g.a, center, mid(P.D, P.B, 0, -28));

      ['A', 'B', 'C', 'D'].forEach(function (id) {
        stage.appendChild(attachPointModal(svg('circle', { cx: P[id].x, cy: P[id].y, r: 28, class: 'solid-point-hit' }), id));
      });
      addPointLabel(pointInputs.A, P.A.x, P.A.y - 34, 'A');
      addPointLabel(pointInputs.B, P.B.x - 28, P.B.y + 22, 'B');
      addPointLabel(pointInputs.C, P.C.x, P.C.y + 34, 'C');
      addPointLabel(pointInputs.D, P.D.x + 28, P.D.y + 22, 'D');
      setStatus('一辺 a から正四面体を描画しています。', false);
    }

    function renderRegularHexahedron(g) {
      const P = regularHexahedronPoints(g);
      const center = {
        x: (P.A.x + P.B.x + P.C.x + P.D.x + P.E.x + P.F.x + P.G.x + P.H.x) / 8,
        y: (P.A.y + P.B.y + P.C.y + P.D.y + P.E.y + P.F.y + P.G.y + P.H.y) / 8
      };
      function mid(P1, P2, dx, dy) {
        return { x: (P1.x + P2.x) / 2 + (dx || 0), y: (P1.y + P2.y) / 2 + (dy || 0) };
      }

      drawVisibleSegment(P.E, P.H, true);
      drawVisibleSegment(P.H, P.G, true);
      drawVisibleSegment(P.D, P.H, true);
      drawVisibleSegment(P.A, P.B, false);
      drawVisibleSegment(P.B, P.C, false);
      drawVisibleSegment(P.C, P.D, false);
      drawVisibleSegment(P.D, P.A, false);
      drawVisibleSegment(P.E, P.F, false);
      drawVisibleSegment(P.F, P.G, false);
      drawVisibleSegment(P.A, P.E, false);
      drawVisibleSegment(P.B, P.F, false);
      drawVisibleSegment(P.C, P.G, false);

      appendSegment(P.A, P.B, 'AB', g.a, center, mid(P.A, P.B, 0, -30));
      appendSegment(P.B, P.C, 'BC', g.a, center, mid(P.B, P.C, 38, 0));
      appendSegment(P.C, P.D, 'CD', g.a, center, mid(P.C, P.D, 0, 38));
      appendSegment(P.D, P.A, 'DA', g.a, center, mid(P.D, P.A, -38, 0));
      appendSegment(P.E, P.F, 'EF', g.a, center, mid(P.E, P.F, 0, -30));
      appendSegment(P.F, P.G, 'FG', g.a, center, mid(P.F, P.G, 38, 0));
      appendSegment(P.G, P.H, 'GH', g.a, center, mid(P.G, P.H, 0, 30));
      appendSegment(P.H, P.E, 'HE', g.a, center, mid(P.H, P.E, -34, 0));
      appendSegment(P.A, P.E, 'AE', g.a, center, mid(P.A, P.E, -20, -24));
      appendSegment(P.B, P.F, 'BF', g.a, center, mid(P.B, P.F, 22, -24));
      appendSegment(P.C, P.G, 'CG', g.a, center, mid(P.C, P.G, 26, 20));
      appendSegment(P.D, P.H, 'DH', g.a, center, mid(P.D, P.H, -24, 20));

      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach(function (id) {
        stage.appendChild(attachPointModal(svg('circle', { cx: P[id].x, cy: P[id].y, r: 28, class: 'solid-point-hit' }), id));
      });
      addPointLabel(pointInputs.A, P.A.x - 24, P.A.y - 28, 'A');
      addPointLabel(pointInputs.B, P.B.x + 24, P.B.y - 28, 'B');
      addPointLabel(pointInputs.C, P.C.x + 26, P.C.y + 24, 'C');
      addPointLabel(pointInputs.D, P.D.x - 26, P.D.y + 24, 'D');
      addPointLabel(pointInputs.E, P.E.x - 24, P.E.y - 24, 'E');
      addPointLabel(pointInputs.F, P.F.x + 26, P.F.y - 24, 'F');
      addPointLabel(pointInputs.G, P.G.x + 28, P.G.y + 20, 'G');
      addPointLabel(pointInputs.H, P.H.x - 28, P.H.y + 20, 'H');
      setStatus('一辺 a から正六面体を描画しています。', false);
    }

    function renderRegularOctahedron(g) {
      const P = regularOctahedronPoints(g);
      const center = {
        x: (P.A.x + P.B.x + P.C.x + P.D.x + P.E.x + P.F.x) / 6,
        y: (P.A.y + P.B.y + P.C.y + P.D.y + P.E.y + P.F.y) / 6
      };
      function mid(P1, P2, dx, dy) {
        return { x: (P1.x + P2.x) / 2 + (dx || 0), y: (P1.y + P2.y) / 2 + (dy || 0) };
      }

      drawVisibleSegment(P.A, P.E, true);
      drawVisibleSegment(P.E, P.B, true);
      drawVisibleSegment(P.E, P.D, true);
      drawVisibleSegment(P.E, P.F, true);
      drawVisibleSegment(P.A, P.B, false);
      drawVisibleSegment(P.A, P.C, false);
      drawVisibleSegment(P.A, P.D, false);
      drawVisibleSegment(P.B, P.C, false);
      drawVisibleSegment(P.C, P.D, false);
      drawVisibleSegment(P.F, P.B, false);
      drawVisibleSegment(P.F, P.C, false);
      drawVisibleSegment(P.F, P.D, false);

      appendSegment(P.A, P.B, 'AB', g.a, center, mid(P.A, P.B, -34, -18));
      appendSegment(P.A, P.C, 'AC', g.a, center, mid(P.A, P.C, 0, -20));
      appendSegment(P.A, P.D, 'AD', g.a, center, mid(P.A, P.D, 34, -18));
      appendSegment(P.A, P.E, 'AE', g.a, center, mid(P.A, P.E, 0, -28));
      appendSegment(P.F, P.B, 'FB', g.a, center, mid(P.F, P.B, -34, 18));
      appendSegment(P.F, P.C, 'FC', g.a, center, mid(P.F, P.C, 0, 28));
      appendSegment(P.F, P.D, 'FD', g.a, center, mid(P.F, P.D, 34, 18));
      appendSegment(P.F, P.E, 'FE', g.a, center, mid(P.F, P.E, 0, 28));
      appendSegment(P.B, P.C, 'BC', g.a, center, mid(P.B, P.C, -24, 22));
      appendSegment(P.C, P.D, 'CD', g.a, center, mid(P.C, P.D, 24, 22));
      appendSegment(P.D, P.E, 'DE', g.a, center, mid(P.D, P.E, 24, -18));
      appendSegment(P.E, P.B, 'EB', g.a, center, mid(P.E, P.B, -24, -18));

      ['A', 'B', 'C', 'D', 'E', 'F'].forEach(function (id) {
        stage.appendChild(attachPointModal(svg('circle', { cx: P[id].x, cy: P[id].y, r: 28, class: 'solid-point-hit' }), id));
      });
      addPointLabel(pointInputs.A, P.A.x, P.A.y - 34, 'A');
      addPointLabel(pointInputs.B, P.B.x - 30, P.B.y + 2, 'B');
      addPointLabel(pointInputs.C, P.C.x, P.C.y + 34, 'C');
      addPointLabel(pointInputs.D, P.D.x + 30, P.D.y + 2, 'D');
      addPointLabel(pointInputs.E, P.E.x, P.E.y - 32, 'E');
      addPointLabel(pointInputs.F, P.F.x, P.F.y + 34, 'F');
      setStatus('一辺 a から正八面体を描画しています。', false);
    }

    function renderRegularDodecahedron(g) {
      const data = regularDodecahedronData(g);
      const P = data.points;
      const center = data.pointIds.reduce(function (sum, id) {
        sum.x += P[id].x;
        sum.y += P[id].y;
        return sum;
      }, { x: 0, y: 0 });
      center.x /= data.pointIds.length;
      center.y /= data.pointIds.length;

      data.edges.filter(function (edge) { return edge.hidden; }).forEach(function (edge) {
        drawVisibleSegment(P[edge.from], P[edge.to], true);
      });
      data.edges.filter(function (edge) { return !edge.hidden; }).forEach(function (edge) {
        drawVisibleSegment(P[edge.from], P[edge.to], false);
      });
      data.edges.forEach(function (edge) {
        appendSegment(P[edge.from], P[edge.to], edge.id, g.a, center);
      });

      data.pointIds.forEach(function (id) {
        stage.appendChild(attachPointModal(svg('circle', { cx: P[id].x, cy: P[id].y, r: 22, class: 'solid-point-hit' }), id));
        const vx = P[id].x - center.x;
        const vy = P[id].y - center.y;
        const len = Math.hypot(vx, vy) || 1;
        addPointLabel(pointInputs[id], P[id].x + vx / len * 28, P[id].y + vy / len * 28, id);
      });
      setStatus('一辺 a から正十二面体を描画しています。', false);
    }

    function renderRegularIcosahedron(g) {
      const data = regularIcosahedronData(g);
      const P = data.points;
      const center = data.pointIds.reduce(function (sum, id) {
        sum.x += P[id].x;
        sum.y += P[id].y;
        return sum;
      }, { x: 0, y: 0 });
      center.x /= data.pointIds.length;
      center.y /= data.pointIds.length;

      data.edges.filter(function (edge) { return edge.hidden; }).forEach(function (edge) {
        drawVisibleSegment(P[edge.from], P[edge.to], true);
      });
      data.edges.filter(function (edge) { return !edge.hidden; }).forEach(function (edge) {
        drawVisibleSegment(P[edge.from], P[edge.to], false);
      });
      data.edges.forEach(function (edge) {
        appendSegment(P[edge.from], P[edge.to], edge.id, g.a, center);
      });

      data.pointIds.forEach(function (id) {
        stage.appendChild(attachPointModal(svg('circle', { cx: P[id].x, cy: P[id].y, r: 22, class: 'solid-point-hit' }), id));
        const vx = P[id].x - center.x;
        const vy = P[id].y - center.y;
        const len = Math.hypot(vx, vy) || 1;
        addPointLabel(pointInputs[id], P[id].x + vx / len * 28, P[id].y + vy / len * 28, id);
      });
      setStatus('一辺 a から正二十面体を描画しています。', false);
    }

    function renderQuadrangularPyramid(g) {
      const P = quadrangularPyramidPoints(g);
      const center = {
        x: (P.A.x + P.B.x + P.C.x + P.D.x + P.E.x + P.H.x) / 6,
        y: (P.A.y + P.B.y + P.C.y + P.D.y + P.E.y + P.H.y) / 6
      };
      function mid(P1, P2, dx, dy) {
        return { x: (P1.x + P2.x) / 2 + (dx || 0), y: (P1.y + P2.y) / 2 + (dy || 0) };
      }

      drawVisibleSegment(P.A, P.B, false);
      drawVisibleSegment(P.A, P.C, true);
      drawVisibleSegment(P.A, P.D, false);
      drawVisibleSegment(P.A, P.E, false);
      drawVisibleSegment(P.B, P.C, true);
      drawVisibleSegment(P.C, P.D, true);
      drawVisibleSegment(P.D, P.E, false);
      drawVisibleSegment(P.E, P.B, false);
      drawVisibleSegment(P.A, P.H, true);

      appendSegment(P.A, P.H, 'AH', g.AH, center, mid(P.A, P.H, -64, 0));
      appendSegment(P.B, P.C, 'BC', g.BC, center, mid(P.B, P.C, 0, -30));
      appendSegment(P.C, P.D, 'CD', g.CD, center, mid(P.C, P.D, 42, -8));
      appendSegment(P.D, P.E, 'DE', g.DE, center, mid(P.D, P.E, 0, 38));
      appendSegment(P.E, P.B, 'EB', g.EB, center, mid(P.E, P.B, -42, 0));
      appendSegment(P.A, P.B, 'AB', Math.hypot(P.A.x - P.B.x, P.A.y - P.B.y), center);
      appendSegment(P.A, P.C, 'AC', Math.hypot(P.A.x - P.C.x, P.A.y - P.C.y), center);
      appendSegment(P.A, P.D, 'AD', Math.hypot(P.A.x - P.D.x, P.A.y - P.D.y), center);
      appendSegment(P.A, P.E, 'AE', Math.hypot(P.A.x - P.E.x, P.A.y - P.E.y), center);
      appendSegment(P.B, P.H, 'BH', 0, center);
      appendSegment(P.C, P.H, 'CH', 0, center);
      appendSegment(P.D, P.H, 'DH', 0, center);
      appendSegment(P.E, P.H, 'EH', 0, center);

      ['A', 'B', 'C', 'D', 'E', 'H'].forEach(function (id) {
        stage.appendChild(attachPointModal(svg('circle', { cx: P[id].x, cy: P[id].y, r: 28, class: 'solid-point-hit' }), id));
      });
      addPointLabel(pointInputs.A, P.A.x, P.A.y - 34, 'A');
      addPointLabel(pointInputs.B, P.B.x - 28, P.B.y + 22, 'B');
      addPointLabel(pointInputs.C, P.C.x + 28, P.C.y - 20, 'C');
      addPointLabel(pointInputs.D, P.D.x + 28, P.D.y + 22, 'D');
      addPointLabel(pointInputs.E, P.E.x - 28, P.E.y + 22, 'E');
      addPointLabel(pointInputs.H, P.H.x + 28, P.H.y + 20, 'H');
      setStatus('入力をもとに四角錐を描画しています。', false);
    }

    function renderPentagonalPyramid(g) {
      const P = pentagonalPyramidPoints(g);
      const center = {
        x: (P.A.x + P.B.x + P.C.x + P.D.x + P.E.x + P.F.x + P.H.x) / 7,
        y: (P.A.y + P.B.y + P.C.y + P.D.y + P.E.y + P.F.y + P.H.y) / 7
      };
      function mid(P1, P2, dx, dy) {
        return { x: (P1.x + P2.x) / 2 + (dx || 0), y: (P1.y + P2.y) / 2 + (dy || 0) };
      }

      drawVisibleSegment(P.A, P.B, false);
      drawVisibleSegment(P.A, P.C, true);
      drawVisibleSegment(P.A, P.D, false);
      drawVisibleSegment(P.A, P.E, false);
      drawVisibleSegment(P.A, P.F, false);
      drawVisibleSegment(P.B, P.C, true);
      drawVisibleSegment(P.C, P.D, true);
      drawVisibleSegment(P.D, P.E, false);
      drawVisibleSegment(P.E, P.F, false);
      drawVisibleSegment(P.F, P.B, false);
      drawVisibleSegment(P.A, P.H, true);

      appendSegment(P.A, P.H, 'AH', g.AH, center, mid(P.A, P.H, -64, 0));
      appendSegment(P.B, P.C, 'BC', g.BC, center, mid(P.B, P.C, -8, -30));
      appendSegment(P.C, P.D, 'CD', g.CD, center, mid(P.C, P.D, 42, -8));
      appendSegment(P.D, P.E, 'DE', g.DE, center, mid(P.D, P.E, 36, 22));
      appendSegment(P.E, P.F, 'EF', g.EF, center, mid(P.E, P.F, 0, 42));
      appendSegment(P.F, P.B, 'FB', g.FB, center, mid(P.F, P.B, -42, 0));
      appendSegment(P.A, P.B, 'AB', Math.hypot(P.A.x - P.B.x, P.A.y - P.B.y), center);
      appendSegment(P.A, P.C, 'AC', Math.hypot(P.A.x - P.C.x, P.A.y - P.C.y), center);
      appendSegment(P.A, P.D, 'AD', Math.hypot(P.A.x - P.D.x, P.A.y - P.D.y), center);
      appendSegment(P.A, P.E, 'AE', Math.hypot(P.A.x - P.E.x, P.A.y - P.E.y), center);
      appendSegment(P.A, P.F, 'AF', Math.hypot(P.A.x - P.F.x, P.A.y - P.F.y), center);
      appendSegment(P.B, P.H, 'BH', 0, center);
      appendSegment(P.C, P.H, 'CH', 0, center);
      appendSegment(P.D, P.H, 'DH', 0, center);
      appendSegment(P.E, P.H, 'EH', 0, center);
      appendSegment(P.F, P.H, 'FH', 0, center);

      ['A', 'B', 'C', 'D', 'E', 'F', 'H'].forEach(function (id) {
        stage.appendChild(attachPointModal(svg('circle', { cx: P[id].x, cy: P[id].y, r: 28, class: 'solid-point-hit' }), id));
      });
      addPointLabel(pointInputs.A, P.A.x, P.A.y - 34, 'A');
      addPointLabel(pointInputs.B, P.B.x - 28, P.B.y + 22, 'B');
      addPointLabel(pointInputs.C, P.C.x + 28, P.C.y - 20, 'C');
      addPointLabel(pointInputs.D, P.D.x + 28, P.D.y + 18, 'D');
      addPointLabel(pointInputs.E, P.E.x + 18, P.E.y + 30, 'E');
      addPointLabel(pointInputs.F, P.F.x - 28, P.F.y + 22, 'F');
      addPointLabel(pointInputs.H, P.H.x + 28, P.H.y + 20, 'H');
      setStatus('入力をもとに五角錐を描画しています。', false);
    }

    function renderHexagonalPyramid(g) {
      const P = hexagonalPyramidPoints(g);
      const center = {
        x: (P.A.x + P.B.x + P.C.x + P.D.x + P.E.x + P.F.x + P.G.x + P.H.x) / 8,
        y: (P.A.y + P.B.y + P.C.y + P.D.y + P.E.y + P.F.y + P.G.y + P.H.y) / 8
      };
      function mid(P1, P2, dx, dy) {
        return { x: (P1.x + P2.x) / 2 + (dx || 0), y: (P1.y + P2.y) / 2 + (dy || 0) };
      }

      drawVisibleSegment(P.A, P.B, false);
      drawVisibleSegment(P.A, P.C, true);
      drawVisibleSegment(P.A, P.D, false);
      drawVisibleSegment(P.A, P.E, false);
      drawVisibleSegment(P.A, P.F, false);
      drawVisibleSegment(P.A, P.G, false);
      drawVisibleSegment(P.B, P.C, true);
      drawVisibleSegment(P.C, P.D, true);
      drawVisibleSegment(P.D, P.E, false);
      drawVisibleSegment(P.E, P.F, false);
      drawVisibleSegment(P.F, P.G, false);
      drawVisibleSegment(P.G, P.B, false);
      drawVisibleSegment(P.A, P.H, true);

      appendSegment(P.A, P.H, 'AH', g.AH, center, mid(P.A, P.H, -64, 0));
      appendSegment(P.B, P.C, 'BC', g.BC, center, mid(P.B, P.C, -8, -30));
      appendSegment(P.C, P.D, 'CD', g.CD, center, mid(P.C, P.D, 42, -8));
      appendSegment(P.D, P.E, 'DE', g.DE, center, mid(P.D, P.E, 44, 20));
      appendSegment(P.E, P.F, 'EF', g.EF, center, mid(P.E, P.F, 28, 42));
      appendSegment(P.F, P.G, 'FG', g.FG, center, mid(P.F, P.G, -6, 44));
      appendSegment(P.G, P.B, 'GB', g.GB, center, mid(P.G, P.B, -42, 0));
      appendSegment(P.A, P.B, 'AB', Math.hypot(P.A.x - P.B.x, P.A.y - P.B.y), center);
      appendSegment(P.A, P.C, 'AC', Math.hypot(P.A.x - P.C.x, P.A.y - P.C.y), center);
      appendSegment(P.A, P.D, 'AD', Math.hypot(P.A.x - P.D.x, P.A.y - P.D.y), center);
      appendSegment(P.A, P.E, 'AE', Math.hypot(P.A.x - P.E.x, P.A.y - P.E.y), center);
      appendSegment(P.A, P.F, 'AF', Math.hypot(P.A.x - P.F.x, P.A.y - P.F.y), center);
      appendSegment(P.A, P.G, 'AG', Math.hypot(P.A.x - P.G.x, P.A.y - P.G.y), center);
      appendSegment(P.B, P.H, 'BH', 0, center);
      appendSegment(P.C, P.H, 'CH', 0, center);
      appendSegment(P.D, P.H, 'DH', 0, center);
      appendSegment(P.E, P.H, 'EH', 0, center);
      appendSegment(P.F, P.H, 'FH', 0, center);
      appendSegment(P.G, P.H, 'GH', 0, center);

      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach(function (id) {
        stage.appendChild(attachPointModal(svg('circle', { cx: P[id].x, cy: P[id].y, r: 28, class: 'solid-point-hit' }), id));
      });
      addPointLabel(pointInputs.A, P.A.x, P.A.y - 34, 'A');
      addPointLabel(pointInputs.B, P.B.x - 28, P.B.y + 22, 'B');
      addPointLabel(pointInputs.C, P.C.x + 28, P.C.y - 20, 'C');
      addPointLabel(pointInputs.D, P.D.x + 28, P.D.y + 18, 'D');
      addPointLabel(pointInputs.E, P.E.x + 26, P.E.y + 26, 'E');
      addPointLabel(pointInputs.F, P.F.x, P.F.y + 34, 'F');
      addPointLabel(pointInputs.G, P.G.x - 28, P.G.y + 22, 'G');
      addPointLabel(pointInputs.H, P.H.x + 28, P.H.y + 20, 'H');
      setStatus('入力をもとに六角錐を描画しています。', false);
    }

    function renderQuadrangularPrism(g) {
      const P = quadrangularPrismPoints(g);
      const center = {
        x: (P.A.x + P.B.x + P.C.x + P.D.x + P.E.x + P.F.x + P.G.x + P.H.x) / 8,
        y: (P.A.y + P.B.y + P.C.y + P.D.y + P.E.y + P.F.y + P.G.y + P.H.y) / 8
      };
      function mid(P1, P2, dx, dy) {
        return { x: (P1.x + P2.x) / 2 + (dx || 0), y: (P1.y + P2.y) / 2 + (dy || 0) };
      }

      drawVisibleSegment(P.D, P.C, false);
      drawVisibleSegment(P.C, P.B, false);
      drawVisibleSegment(P.B, P.A, false);
      drawVisibleSegment(P.A, P.D, false);
      drawVisibleSegment(P.H, P.G, true);
      drawVisibleSegment(P.G, P.F, false);
      drawVisibleSegment(P.F, P.E, false);
      drawVisibleSegment(P.E, P.H, true);
      drawVisibleSegment(P.A, P.E, false);
      drawVisibleSegment(P.B, P.F, false);
      drawVisibleSegment(P.C, P.G, false);
      drawVisibleSegment(P.D, P.H, true);

      appendSegment(P.E, P.F, 'EF', g.EF, center, mid(P.E, P.F, 0, 38));
      appendSegment(P.F, P.G, 'FG', g.FG, center, mid(P.F, P.G, 44, 16));
      appendSegment(P.G, P.H, 'GH', g.GH, center, mid(P.G, P.H, 0, 30));
      appendSegment(P.H, P.E, 'HE', g.HE, center, mid(P.H, P.E, -34, 0));
      appendSegment(P.B, P.F, 'BF', g.AE, center);
      appendSegment(P.A, P.B, 'AB', g.EF, center, mid(P.A, P.B, 0, -28));
      appendSegment(P.B, P.C, 'BC', g.FG, center);
      appendSegment(P.C, P.D, 'CD', g.GH, center);
      appendSegment(P.D, P.A, 'DA', g.HE, center);
      appendSegment(P.A, P.E, 'AE', g.AE, center, mid(P.A, P.E, -72, 0));
      appendSegment(P.C, P.G, 'CG', g.AE, center);
      appendSegment(P.D, P.H, 'DH', g.AE, center);

      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach(function (id) {
        stage.appendChild(attachPointModal(svg('circle', { cx: P[id].x, cy: P[id].y, r: 28, class: 'solid-point-hit' }), id));
      });
      addPointLabel(pointInputs.A, P.A.x - 24, P.A.y - 28, 'A');
      addPointLabel(pointInputs.B, P.B.x + 24, P.B.y - 28, 'B');
      addPointLabel(pointInputs.C, P.C.x + 26, P.C.y - 20, 'C');
      addPointLabel(pointInputs.D, P.D.x - 26, P.D.y - 20, 'D');
      addPointLabel(pointInputs.E, P.E.x - 26, P.E.y + 24, 'E');
      addPointLabel(pointInputs.F, P.F.x + 26, P.F.y + 24, 'F');
      addPointLabel(pointInputs.G, P.G.x + 28, P.G.y + 24, 'G');
      addPointLabel(pointInputs.H, P.H.x - 28, P.H.y + 24, 'H');
      setStatus('入力をもとに四角柱を描画しています。', false);
    }

    function renderPentagonalPrism(g) {
      const P = pentagonalPrismPoints(g);
      const center = {
        x: (P.A.x + P.B.x + P.C.x + P.D.x + P.E.x + P.F.x + P.G.x + P.H.x + P.I.x + P.J.x) / 10,
        y: (P.A.y + P.B.y + P.C.y + P.D.y + P.E.y + P.F.y + P.G.y + P.H.y + P.I.y + P.J.y) / 10
      };
      function mid(P1, P2, dx, dy) {
        return { x: (P1.x + P2.x) / 2 + (dx || 0), y: (P1.y + P2.y) / 2 + (dy || 0) };
      }

      drawVisibleSegment(P.A, P.B, false);
      drawVisibleSegment(P.B, P.C, false);
      drawVisibleSegment(P.C, P.D, false);
      drawVisibleSegment(P.D, P.E, false);
      drawVisibleSegment(P.E, P.A, false);
      drawVisibleSegment(P.F, P.G, false);
      drawVisibleSegment(P.G, P.H, false);
      drawVisibleSegment(P.H, P.I, true);
      drawVisibleSegment(P.I, P.J, true);
      drawVisibleSegment(P.J, P.F, true);
      drawVisibleSegment(P.A, P.F, false);
      drawVisibleSegment(P.B, P.G, false);
      drawVisibleSegment(P.C, P.H, false);
      drawVisibleSegment(P.D, P.I, true);
      drawVisibleSegment(P.E, P.J, true);

      appendSegment(P.F, P.G, 'FG', g.FG, center, mid(P.F, P.G, 0, 40));
      appendSegment(P.G, P.H, 'GH', g.GH, center, mid(P.G, P.H, 48, 12));
      appendSegment(P.H, P.I, 'HI', g.HI, center, mid(P.H, P.I, 34, -18));
      appendSegment(P.I, P.J, 'IJ', g.IJ, center, mid(P.I, P.J, 0, -30));
      appendSegment(P.J, P.F, 'JF', g.JF, center, mid(P.J, P.F, -42, 0));
      appendSegment(P.A, P.F, 'AF', g.AF, center, mid(P.A, P.F, -74, 0));
      appendSegment(P.A, P.B, 'AB', g.FG, center);
      appendSegment(P.B, P.C, 'BC', g.GH, center);
      appendSegment(P.C, P.D, 'CD', g.HI, center);
      appendSegment(P.D, P.E, 'DE', g.IJ, center);
      appendSegment(P.E, P.A, 'EA', g.JF, center);
      appendSegment(P.B, P.G, 'BG', g.AF, center);
      appendSegment(P.C, P.H, 'CH', g.AF, center);
      appendSegment(P.D, P.I, 'DI', g.AF, center);
      appendSegment(P.E, P.J, 'EJ', g.AF, center);

      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].forEach(function (id) {
        stage.appendChild(attachPointModal(svg('circle', { cx: P[id].x, cy: P[id].y, r: 28, class: 'solid-point-hit' }), id));
      });
      addPointLabel(pointInputs.A, P.A.x - 24, P.A.y - 28, 'A');
      addPointLabel(pointInputs.B, P.B.x + 20, P.B.y - 30, 'B');
      addPointLabel(pointInputs.C, P.C.x + 28, P.C.y - 20, 'C');
      addPointLabel(pointInputs.D, P.D.x + 16, P.D.y - 26, 'D');
      addPointLabel(pointInputs.E, P.E.x - 28, P.E.y - 20, 'E');
      addPointLabel(pointInputs.F, P.F.x - 26, P.F.y + 24, 'F');
      addPointLabel(pointInputs.G, P.G.x + 24, P.G.y + 24, 'G');
      addPointLabel(pointInputs.H, P.H.x + 30, P.H.y + 18, 'H');
      addPointLabel(pointInputs.I, P.I.x + 18, P.I.y + 26, 'I');
      addPointLabel(pointInputs.J, P.J.x - 30, P.J.y + 18, 'J');
      setStatus('入力をもとに五角柱を描画しています。', false);
    }

    function renderHexagonalPrism(g) {
      const P = hexagonalPrismPoints(g);
      const center = {
        x: (P.A.x + P.B.x + P.C.x + P.D.x + P.E.x + P.F.x + P.G.x + P.H.x + P.I.x + P.J.x + P.K.x + P.L.x) / 12,
        y: (P.A.y + P.B.y + P.C.y + P.D.y + P.E.y + P.F.y + P.G.y + P.H.y + P.I.y + P.J.y + P.K.y + P.L.y) / 12
      };
      function mid(P1, P2, dx, dy) {
        return { x: (P1.x + P2.x) / 2 + (dx || 0), y: (P1.y + P2.y) / 2 + (dy || 0) };
      }

      drawVisibleSegment(P.A, P.B, false);
      drawVisibleSegment(P.B, P.C, false);
      drawVisibleSegment(P.C, P.D, false);
      drawVisibleSegment(P.D, P.E, false);
      drawVisibleSegment(P.E, P.F, false);
      drawVisibleSegment(P.F, P.A, false);
      drawVisibleSegment(P.G, P.H, false);
      drawVisibleSegment(P.H, P.I, false);
      drawVisibleSegment(P.I, P.J, true);
      drawVisibleSegment(P.J, P.K, true);
      drawVisibleSegment(P.K, P.L, true);
      drawVisibleSegment(P.L, P.G, true);
      drawVisibleSegment(P.A, P.G, false);
      drawVisibleSegment(P.B, P.H, false);
      drawVisibleSegment(P.C, P.I, false);
      drawVisibleSegment(P.D, P.J, true);
      drawVisibleSegment(P.E, P.K, true);
      drawVisibleSegment(P.F, P.L, false);

      appendSegment(P.G, P.H, 'GH', g.GH, center, mid(P.G, P.H, 0, 40));
      appendSegment(P.H, P.I, 'HI', g.HI, center, mid(P.H, P.I, 46, 16));
      appendSegment(P.I, P.J, 'IJ', g.IJ, center, mid(P.I, P.J, 42, -10));
      appendSegment(P.J, P.K, 'JK', g.JK, center, mid(P.J, P.K, 18, -30));
      appendSegment(P.K, P.L, 'KL', g.KL, center, mid(P.K, P.L, -18, -30));
      appendSegment(P.L, P.G, 'LG', g.LG, center, mid(P.L, P.G, -46, 6));
      appendSegment(P.A, P.G, 'AG', g.AG, center, mid(P.A, P.G, -74, 0));
      appendSegment(P.A, P.B, 'AB', g.GH, center);
      appendSegment(P.B, P.C, 'BC', g.HI, center);
      appendSegment(P.C, P.D, 'CD', g.IJ, center);
      appendSegment(P.D, P.E, 'DE', g.JK, center);
      appendSegment(P.E, P.F, 'EF', g.KL, center);
      appendSegment(P.F, P.A, 'FA', g.LG, center);
      appendSegment(P.B, P.H, 'BH', g.AG, center);
      appendSegment(P.C, P.I, 'CI', g.AG, center);
      appendSegment(P.D, P.J, 'DJ', g.AG, center);
      appendSegment(P.E, P.K, 'EK', g.AG, center);
      appendSegment(P.F, P.L, 'FL', g.AG, center);

      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].forEach(function (id) {
        stage.appendChild(attachPointModal(svg('circle', { cx: P[id].x, cy: P[id].y, r: 28, class: 'solid-point-hit' }), id));
      });
      addPointLabel(pointInputs.A, P.A.x - 24, P.A.y - 28, 'A');
      addPointLabel(pointInputs.B, P.B.x + 20, P.B.y - 30, 'B');
      addPointLabel(pointInputs.C, P.C.x + 28, P.C.y - 20, 'C');
      addPointLabel(pointInputs.D, P.D.x + 24, P.D.y - 20, 'D');
      addPointLabel(pointInputs.E, P.E.x + 14, P.E.y - 28, 'E');
      addPointLabel(pointInputs.F, P.F.x - 28, P.F.y - 20, 'F');
      addPointLabel(pointInputs.G, P.G.x - 26, P.G.y + 24, 'G');
      addPointLabel(pointInputs.H, P.H.x + 24, P.H.y + 24, 'H');
      addPointLabel(pointInputs.I, P.I.x + 30, P.I.y + 18, 'I');
      addPointLabel(pointInputs.J, P.J.x + 24, P.J.y + 24, 'J');
      addPointLabel(pointInputs.K, P.K.x + 10, P.K.y + 30, 'K');
      addPointLabel(pointInputs.L, P.L.x - 30, P.L.y + 18, 'L');
      setStatus('入力をもとに六角柱を描画しています。', false);
    }

    function render() {
      setActiveDecimalPlaces(decimalPlaces);
      stage.innerHTML = '';
      if (labelLayer) labelLayer.innerHTML = '';
      Object.keys(currentLabelBases).forEach(function (key) { delete currentLabelBases[key]; });
      Object.keys(currentAreas).forEach(function (key) { delete currentAreas[key]; });
      try {
        const g = readGeometry();
        if (isTriangularPrism) {
          renderTriangularPrism(g);
          return;
        }
        if (isTriangularPyramid) {
          renderTriangularPyramid(g);
          return;
        }
        if (isRightTriangularPyramid1) {
          renderRightTriangularPyramid1(g);
          return;
        }
        if (isRightTriangularPyramid) {
          renderRightTriangularPyramid(g);
          return;
        }
        if (isCrossSection1) {
          renderCrossSection1(g);
          return;
        }
        if (isCrossSection2) {
          renderCrossSection2(g);
          return;
        }
        if (isCrossSection3) {
          renderCrossSection3(g);
          return;
        }
        if (isRegularTetrahedron) {
          renderRegularTetrahedron(g);
          return;
        }
        if (isRegularHexahedron) {
          renderRegularHexahedron(g);
          return;
        }
        if (isRegularOctahedron) {
          renderRegularOctahedron(g);
          return;
        }
        if (isRegularDodecahedron) {
          renderRegularDodecahedron(g);
          return;
        }
        if (isRegularIcosahedron) {
          renderRegularIcosahedron(g);
          return;
        }
        if (isQuadrangularPyramid) {
          renderQuadrangularPyramid(g);
          return;
        }
        if (isPentagonalPyramid) {
          renderPentagonalPyramid(g);
          return;
        }
        if (isHexagonalPyramid) {
          renderHexagonalPyramid(g);
          return;
        }
        if (isQuadrangularPrism) {
          renderQuadrangularPrism(g);
          return;
        }
        if (isPentagonalPrism) {
          renderPentagonalPrism(g);
          return;
        }
        if (isHexagonalPrism) {
          renderHexagonalPrism(g);
          return;
        }
        if (isCone) {
          renderCone(g);
          return;
        }
        if (isSimilarSolid1) {
          renderSimilarSolid1(g);
          return;
        }
        if (isSimilarSolid2) {
          renderSimilarSolid2(g);
          return;
        }
        if (isSphere) {
          renderSphere(g);
          return;
        }
        if (isHemisphere1) {
          renderHemisphere1(g);
          return;
        }
        if (isHemisphere2) {
          renderHemisphere2(g);
          return;
        }
        if (isQuarterSphere1) {
          renderQuarterSphere1(g);
          return;
        }
        const diameter = g.radius * 2;
        const scale = Math.min(560 / diameter, 560 / g.height);
        const rx = g.radius * scale;
        const cylH = g.height * scale;
        const ry = Math.max(34, Math.min(80, rx * 0.32));
        const cx = 540;
        const topY = 240;
        const bottomY = topY + cylH;
        const left = cx - rx;
        const right = cx + rx;
        const labelTextY = topY + cylH / 2;

        stage.appendChild(svg('line', { x1: left, y1: topY, x2: left, y2: bottomY, class: 'solid-outline' }));
        stage.appendChild(attachSegmentModal(svg('line', { x1: left, y1: topY, x2: left, y2: bottomY, class: 'solid-hit' }), 'AB'));
        stage.appendChild(svg('line', { x1: right, y1: topY, x2: right, y2: bottomY, class: 'solid-outline' }));
        stage.appendChild(attachSegmentModal(svg('line', { x1: right, y1: topY, x2: right, y2: bottomY, class: 'solid-hit' }), 'CD'));
        stage.appendChild(svg('ellipse', { cx: cx, cy: topY, rx: rx, ry: ry, class: 'solid-outline' }));
        stage.appendChild(svg('path', { d: arcPath(cx, bottomY, rx, ry, 180, 360), class: 'solid-hidden' }));
        stage.appendChild(svg('path', { d: arcPath(cx, bottomY, rx, ry, 0, 180), class: 'solid-outline' }));

        const pointA = { x: left, y: topY };
        const pointO = { x: cx, y: topY };
        const pointB = { x: left, y: bottomY };
        const pointOp = { x: cx, y: bottomY };
        const pointC = { x: right, y: bottomY };
        const pointD = { x: right, y: topY };
        const oaBaseArc = sideArcData(pointA, pointO, { x: cx, y: topY + 120 });
        const oaLabelBase = oaBaseArc.centerPoint;
        const oaLabelPoint = getLabelPosition('segment', 'OA', oaLabelBase);
        if (segmentArcVisible.OA) appendSplitArc(pointA, pointO, oaLabelPoint);
        drawSideKind(segmentKinds.OA, pointA, pointO);
        stage.appendChild(attachSegmentModal(svg('line', { x1: pointA.x, y1: pointA.y, x2: pointO.x, y2: pointO.y, class: 'solid-hit' }), 'OA'));
        const abBaseArc = sideArcData(pointA, pointB, { x: cx, y: labelTextY });
        const abLabelBase = abBaseArc.centerPoint;
        const abLabelPoint = getLabelPosition('segment', 'AB', abLabelBase);
        const abArcGeom = segmentArcGeometry(pointA, pointB, abLabelPoint);
        const bracketPath = pathFromQuadratic(pointA, abArcGeom.control, pointB, 0, 1);
        if (segmentArcVisible.AB) {
          appendSplitArc(pointA, pointB, abLabelPoint);
        }
        drawSideKind(segmentKinds.AB, pointA, pointB);
        stage.appendChild(attachSegmentModal(svg('path', { d: bracketPath, class: 'solid-hit' }), 'AB'));

        const cdBaseArc = sideArcData(pointD, pointC, { x: cx, y: labelTextY });
        const cdLabelBase = cdBaseArc.centerPoint;
        const cdLabelPoint = getLabelPosition('segment', 'CD', cdLabelBase);
        const odBaseArc = sideArcData(pointO, pointD, { x: cx, y: topY + 120 });
        const odLabelBase = odBaseArc.centerPoint;
        const odLabelPoint = getLabelPosition('segment', 'OD', odLabelBase);
        stage.appendChild(attachSegmentModal(svg('line', { x1: pointO.x, y1: pointO.y, x2: pointD.x, y2: pointD.y, class: 'solid-hit' }), 'OD'));
        const opcBaseArc = sideArcData(pointOp, pointC, { x: cx, y: bottomY - 120 });
        const opcLabelBase = opcBaseArc.centerPoint;
        const opcLabelPoint = getLabelPosition('segment', 'OpC', opcLabelBase);
        stage.appendChild(attachSegmentModal(svg('line', { x1: pointOp.x, y1: pointOp.y, x2: pointC.x, y2: pointC.y, class: 'solid-hit' }), 'OpC'));
        const opbBaseArc = sideArcData(pointOp, pointB, { x: cx, y: bottomY - 120 });
        const opbLabelBase = opbBaseArc.centerPoint;
        const opbLabelPoint = getLabelPosition('segment', 'OpB', opbBaseArc.centerPoint);
        stage.appendChild(attachSegmentModal(svg('line', { x1: pointOp.x, y1: pointOp.y, x2: pointB.x, y2: pointB.y, class: 'solid-hit' }), 'OpB'));
        const cdText = dimensionText('CD', g.height);
        const odText = dimensionText('OD', g.radius);
        const opcText = dimensionText('OpC', g.radius);
        const opbText = dimensionText('OpB', g.radius);
        if (cdText && segmentArcVisible.CD) appendSplitArc(pointD, pointC, cdLabelPoint);
        if (odText && segmentArcVisible.OD) appendSplitArc(pointO, pointD, odLabelPoint);
        if (opcText && segmentArcVisible.OpC) appendSplitArc(pointOp, pointC, opcLabelPoint);
        if (opbText && segmentArcVisible.OpB) appendSplitArc(pointOp, pointB, opbLabelPoint);
        drawSideKind(segmentKinds.CD, pointD, pointC);
        drawSideKind(segmentKinds.OD, pointO, pointD);
        drawSideKind(segmentKinds.OpC, pointOp, pointC);
        drawSideKind(segmentKinds.OpB, pointOp, pointB);

        stage.appendChild(attachPointModal(svg('circle', { cx: pointO.x, cy: pointO.y, r: 28, class: 'solid-point-hit' }), 'O'));
        stage.appendChild(attachPointModal(svg('circle', { cx: pointA.x, cy: pointA.y, r: 28, class: 'solid-point-hit' }), 'A'));
        stage.appendChild(attachPointModal(svg('circle', { cx: pointB.x, cy: pointB.y, r: 28, class: 'solid-point-hit' }), 'B'));
        stage.appendChild(attachPointModal(svg('circle', { cx: pointOp.x, cy: pointOp.y, r: 28, class: 'solid-point-hit' }), 'Op'));
        stage.appendChild(attachPointModal(svg('circle', { cx: pointC.x, cy: pointC.y, r: 28, class: 'solid-point-hit' }), 'C'));
        stage.appendChild(attachPointModal(svg('circle', { cx: pointD.x, cy: pointD.y, r: 28, class: 'solid-point-hit' }), 'D'));

        addFloatingLabel(dimensionText('OA', g.radius), oaLabelBase.x, oaLabelBase.y, 'OA');
        addFloatingLabel(dimensionText('AB', g.height), abLabelBase.x, abLabelBase.y, 'AB');
        addFloatingLabel(cdText, cdLabelBase.x, cdLabelBase.y, 'CD');
        addFloatingLabel(odText, odLabelBase.x, odLabelBase.y, 'OD');
        addFloatingLabel(opcText, opcLabelBase.x, opcLabelBase.y, 'OpC');
        addFloatingLabel(opbText, opbLabelBase.x, opbLabelBase.y, 'OpB');
        addPointLabel(pointInputs.O, pointO.x + 24, pointO.y - 24, 'O');
        addPointLabel(pointInputs.A, pointA.x - 24, pointA.y - 24, 'A');
        addPointLabel(pointInputs.B, pointB.x - 24, pointB.y + 24, 'B');
        addPointLabel(pointInputs.Op, pointOp.x + 24, pointOp.y + 24, 'Op');
        addPointLabel(pointInputs.C, pointC.x + 24, pointC.y + 24, 'C');
        addPointLabel(pointInputs.D, pointD.x + 24, pointD.y - 24, 'D');
        setStatus('入力をもとに円柱を描画しています。', false);
      } catch (error) {
        setStatus(error.message || '入力を確認してください。', true);
      }
    }

    function saveCanvas(transparent) {
      closeSheets();
      if (!window.html2canvas) return;
      html2canvas(captureRoot, {
        backgroundColor: transparent ? null : '#fbfcff',
        scale: Math.max(2, window.devicePixelRatio || 1)
      }).then(function (canvas) {
        canvas.toBlob(function (blob) {
          if (blob) downloadBlob(blob, (config.fileBase || 'solid-cylinder') + (transparent ? '-transparent' : '') + '.png');
        });
      });
    }

    function savePdf() {
      closeSheets();
      if (!window.html2canvas || !window.jspdf) return;
      html2canvas(captureRoot, { backgroundColor: '#fbfcff', scale: Math.max(2, window.devicePixelRatio || 1) }).then(function (canvas) {
        const pdf = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
        const w = canvas.width * ratio;
        const h = canvas.height * ratio;
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pageW - w) / 2, (pageH - h) / 2, w, h);
        pdf.save((config.fileBase || 'solid-cylinder') + '.pdf');
      });
    }

    [radiusInput, heightInput, aInput, baInput, abInput, bcInput, cbInput, bfInput, oaInput, obInput, ocInput, caInput, adInput, efInput, fgInput, ghInput, heInput, aeInput, hiInput, ijInput, jfInput, afInput, jkInput, klInput, lgInput, agInput, ahInput, cdInput, daInput, deInput, dbInput, ebInput, fbInput, gbInput, aopInput, opoInput, boInput, ogpInput, gpgInput].forEach(function (input) {
      if (input) input.addEventListener('input', render);
    });
    window.addEventListener('resize', render);
    if (backBtn) backBtn.addEventListener('click', function () { window.location.href = '/draw/'; });
    if (saveBtn) saveBtn.addEventListener('click', function () { if (!moveMode) openSaveSheet(); });
    if (sheetClose) sheetClose.addEventListener('click', closeSheets);
    if (saveSheetClose) saveSheetClose.addEventListener('click', closeSheets);
    if (sheetBackdrop) sheetBackdrop.addEventListener('click', function () { if (!moveMode) closeSheets(); });
    moveCancelBtn.addEventListener('click', function () { finishMoveMode(true); });
    moveDoneBtn.addEventListener('click', function () { finishMoveMode(false); });
    window.addEventListener('pointermove', function (event) {
      if (!moveDrag) return;
      const point = pointerToSvgPoint(event);
      const offset = ensureLabelOffset(moveDrag.kind, moveDrag.id);
      offset.x = moveDrag.startOffset.x + (point.x - moveDrag.startPoint.x);
      offset.y = moveDrag.startOffset.y + (point.y - moveDrag.startPoint.y);
      render();
    });
    window.addEventListener('pointerup', function () { moveDrag = null; });
    window.addEventListener('pointercancel', function () { moveDrag = null; });
    if (savePngBtn) savePngBtn.addEventListener('click', function () { saveCanvas(false); });
    if (saveTransparentBtn) saveTransparentBtn.addEventListener('click', function () { saveCanvas(true); });
    if (savePdfBtn) savePdfBtn.addEventListener('click', savePdf);
    render();
  }

  function createCylinderRotationPage(config) {
    const stage = document.getElementById('stage');
    const captureRoot = document.getElementById('captureRoot');
    const statusBox = document.getElementById('statusBox');
    const verticalId = config.verticalLabel || 'AB';
    const horizontalId = config.horizontalLabel || 'BC';
    const topId = config.topLabel || 'AD';
    const shapeKind = config.shapeKind || 'cylinder';
    const radiusId = config.radiusLabel || 'OA';
    const hypotenuseId = shapeKind === 'cone' ? 'AB' : null;
    const displayName = config.displayName || '回転体①（円柱）';
    const pointIds = config.pointIds || ['A', 'B', 'C', 'D', 'X', 'Y'];
    const verticalInput = document.getElementById(config.oaInputId || config.abInputId || config.acInputId || config.verticalInputId);
    const horizontalInput = document.getElementById(config.bcInputId || config.horizontalInputId);
    const topInput = document.getElementById(config.adInputId || config.topInputId);
    const backBtn = document.getElementById('backBtn');
    const saveBtn = document.getElementById('saveBtn');
    const editSheet = document.getElementById('editSheet');
    const sheetTitle = document.getElementById('sheetTitle');
    const sheetBody = document.getElementById('sheetBody');
    const sheetClose = document.getElementById('sheetClose');
    const saveSheet = document.getElementById('saveSheet');
    const sheetBackdrop = document.getElementById('sheetBackdrop');
    const saveSheetClose = document.getElementById('saveSheetClose');
    const savePngBtn = document.getElementById('savePngBtn');
    const saveTransparentBtn = document.getElementById('saveTransparentBtn');
    const savePdfBtn = document.getElementById('savePdfBtn');
    const segmentInputs = {};
    const segmentKinds = {};
    const segmentArcVisible = {};
    const pointInputs = {};
    const initialSegmentIds = shapeKind === 'sphere' ? [radiusId] : (shapeKind === 'frustum' || shapeKind === 'bicone' || shapeKind === 'tube' || shapeKind === 'hollow-frustum' ? [topId, verticalId, horizontalId] : [verticalId, horizontalId, hypotenuseId]);
    initialSegmentIds.forEach(function (id) {
      if (!id) return;
      segmentInputs[id] = ' ';
      segmentKinds[id] = 'plain';
      segmentArcVisible[id] = true;
    });
    pointIds.forEach(function (id) { pointInputs[id] = ''; });
    const labelOffsets = { segment: {}, point: {} };
    const labelScales = { segment: {}, point: {} };
    const labelColors = { segment: {}, point: {} };
    const currentLabelBases = {};
    let moveMode = null;
    let moveDrag = null;
    let decimalPlaces = 2;
    setActiveDecimalPlaces(decimalPlaces);
    const RATIO_LABEL_PREFIX = 'ratio:';
    const RAW_NUMERIC_LABEL_VALUE = 'raw:';
    const RATIO_LABEL_HINT = '比の値は「マーク,数値」の形式で入力します。例: s,5 / t,4.4 / r,5/3\ns: 四角で囲む\nt: 三角で囲む\nr: 丸で囲む';
    const moveToolbar = document.createElement('div');
    moveToolbar.className = 'move-toolbar';
    moveToolbar.setAttribute('aria-hidden', 'true');
    const moveCancelBtn = document.createElement('button');
    moveCancelBtn.className = 'btn';
    moveCancelBtn.type = 'button';
    moveCancelBtn.textContent = 'キャンセル';
    const moveDoneBtn = document.createElement('button');
    moveDoneBtn.className = 'btn action-primary';
    moveDoneBtn.type = 'button';
    moveDoneBtn.textContent = '完了';
    moveToolbar.appendChild(moveCancelBtn);
    moveToolbar.appendChild(moveDoneBtn);
    document.body.appendChild(moveToolbar);

    if (window.InstantGeometrySaveQuota) {
      window.InstantGeometrySaveQuota.createIndicator({ target: saveBtn });
    }

    function setStatus(message, isError) {
      statusBox.textContent = message;
      statusBox.classList.toggle('error', !!isError);
    }

    function closeSheets() {
      if (editSheet) {
        editSheet.classList.remove('open');
        editSheet.setAttribute('aria-hidden', 'true');
      }
      saveSheet.classList.remove('open');
      saveSheet.setAttribute('aria-hidden', 'true');
      sheetBackdrop.classList.remove('open');
      if (sheetBody) sheetBody.innerHTML = '';
    }

    function labelKey(kind, id) {
      return kind + ':' + id;
    }

    function ensureLabelOffset(kind, id) {
      if (!labelOffsets[kind]) labelOffsets[kind] = {};
      if (!labelOffsets[kind][id]) labelOffsets[kind][id] = { x: 0, y: 0 };
      return labelOffsets[kind][id];
    }

    function getLabelOffset(kind, id) {
      return labelOffsets[kind] && labelOffsets[kind][id] ? labelOffsets[kind][id] : { x: 0, y: 0 };
    }

    function getLabelPosition(kind, id, basePosition) {
      currentLabelBases[labelKey(kind, id)] = { x: basePosition.x, y: basePosition.y };
      const offset = getLabelOffset(kind, id);
      return { x: basePosition.x + offset.x, y: basePosition.y + offset.y };
    }

    function getLabelScale(kind, id) {
      const value = labelScales[kind] && Number(labelScales[kind][id]);
      return Number.isFinite(value) && value > 0 ? value : 1;
    }

    function setLabelScale(kind, id, value) {
      if (!labelScales[kind]) labelScales[kind] = {};
      labelScales[kind][id] = Math.max(0.1, Math.min(4, Number(value) || 1));
    }

    function getLabelColor(kind, id, fallback) {
      return labelColors[kind] && labelColors[kind][id] ? labelColors[kind][id] : (fallback || (kind === 'point' ? '#1f2430' : '#2a5bd7'));
    }

    function setLabelColor(kind, id, value) {
      if (!labelColors[kind]) labelColors[kind] = {};
      labelColors[kind][id] = value || (kind === 'point' ? '#1f2430' : '#2a5bd7');
    }

    function isMoveTarget(kind, id) {
      return moveMode && moveMode.kind === kind && moveMode.id === id;
    }

    function updateMoveModeUi() {
      const active = Boolean(moveMode);
      document.body.classList.toggle('label-move-active', active);
      if (captureRoot) captureRoot.classList.toggle('label-move-active', active);
      moveToolbar.classList.toggle('open', active);
      moveToolbar.setAttribute('aria-hidden', active ? 'false' : 'true');
    }

    function pointerToSvgPoint(event) {
      const matrix = stage.getScreenCTM();
      if (!matrix) return { x: 0, y: 0 };
      const point = stage.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const transformed = point.matrixTransform(matrix.inverse());
      return { x: transformed.x, y: transformed.y };
    }

    function finishMoveMode(restoreOffset) {
      if (!moveMode) return;
      const previous = moveMode;
      if (restoreOffset) {
        ensureLabelOffset(previous.kind, previous.id);
        labelOffsets[previous.kind][previous.id] = previous.originalOffset;
      }
      moveMode = null;
      moveDrag = null;
      updateMoveModeUi();
      render();
      if (previous.kind === 'point') openPointModal(previous.id);
      else openSegmentModal(previous.id);
    }

    function enterMoveMode(kind, id) {
      const key = labelKey(kind, id);
      if (!currentLabelBases[key]) {
        setStatus('ラベルを表示してから移動してください。', true);
        if (kind === 'point') openPointModal(id);
        else openSegmentModal(id);
        return;
      }
      const originalOffset = getLabelOffset(kind, id);
      moveMode = {
        kind: kind,
        id: id,
        originalOffset: { x: originalOffset.x, y: originalOffset.y }
      };
      closeSheets();
      updateMoveModeUi();
      render();
    }

    function openSaveSheet() {
      closeSheets();
      saveSheet.classList.add('open');
      saveSheet.setAttribute('aria-hidden', 'false');
      sheetBackdrop.classList.add('open');
    }

    function readGeometry() {
      if (shapeKind === 'sphere') {
        return {
          radius: parsePositive(verticalInput.value, radiusId)
        };
      }
      if (shapeKind === 'frustum') {
        return {
          top: parsePositive(topInput.value, topId),
          vertical: parsePositive(verticalInput.value, verticalId),
          horizontal: parsePositive(horizontalInput.value, horizontalId)
        };
      }
      if (shapeKind === 'bicone') {
        return {
          top: parsePositive(topInput.value, topId),
          vertical: parsePositive(verticalInput.value, verticalId),
          horizontal: parsePositive(horizontalInput.value, horizontalId)
        };
      }
      if (shapeKind === 'tube' || shapeKind === 'hollow-frustum') {
        return {
          top: parsePositive(topInput.value, topId),
          vertical: parsePositive(verticalInput.value, verticalId),
          horizontal: parsePositive(horizontalInput.value, horizontalId)
        };
      }
      return {
        vertical: parsePositive(verticalInput.value, verticalId),
        horizontal: parsePositive(horizontalInput.value, horizontalId)
      };
    }

    function simplifyRadical(value) {
      const n = Math.round(value);
      if (!Number.isFinite(value) || Math.abs(value - n) > 1e-9 || n < 0) return '';
      const root = Math.sqrt(n);
      if (Number.isInteger(root)) return String(root);
      let outside = 1;
      let inside = n;
      for (let factor = Math.floor(Math.sqrt(inside)); factor >= 2; factor -= 1) {
        const square = factor * factor;
        if (inside % square === 0) {
          outside *= factor;
          inside /= square;
          factor = Math.floor(Math.sqrt(inside)) + 1;
        }
      }
      return (outside === 1 ? '' : String(outside)) + '√' + inside;
    }

    function pythagoreanLabel(a, b) {
      const roundedA = Math.round(a * 1000000) / 1000000;
      const roundedB = Math.round(b * 1000000) / 1000000;
      if (Number.isInteger(roundedA) && Number.isInteger(roundedB)) {
        return simplifyRadical(roundedA * roundedA + roundedB * roundedB);
      }
      return fmt(Math.hypot(a, b));
    }

    function segmentLabel(id, value, exactLabel) {
      const input = segmentInputs[id];
      if (input === '') return '';
      if (input === RAW_NUMERIC_LABEL_VALUE) {
        const rawInput = document.getElementById(String(id).toLowerCase() + 'Input');
        const raw = rawInput ? String(rawInput.value || '').trim() : '';
        return raw || exactLabel || fmt(value);
      }
      if (input === ' ') return exactLabel || fmt(value);
      return String(input || '');
    }

    function parseRatioLabelInput(value) {
      const text = String(value || '').trim();
      const parts = text.split(',');
      if (parts.length !== 2) return null;
      const mark = parts[0].trim().toLowerCase();
      const number = parts[1].trim();
      const decimalPattern = /^(?:[1-9][0-9]*(?:\.[0-9]+)?|0\.[0-9]*[1-9][0-9]*)$/;
      const fractionPattern = /^[1-9][0-9]*\/[1-9][0-9]*$/;
      if (!/^[rts]$/.test(mark)) return null;
      if (!decimalPattern.test(number) && !fractionPattern.test(number)) return null;
      return { mark: mark, value: number, source: mark + ',' + number };
    }

    function isRatioLabelValue(value) {
      return String(value || '').indexOf(RATIO_LABEL_PREFIX) === 0 && Boolean(parseRatioLabelInput(String(value).slice(RATIO_LABEL_PREFIX.length)));
    }

    function getRatioLabelInput(value) {
      return isRatioLabelValue(value) ? String(value).slice(RATIO_LABEL_PREFIX.length) : '';
    }

    function getDisplayMode(value) {
      if (value === '') return 'hidden';
      if (isRatioLabelValue(value)) return 'ratio';
      if (value === RAW_NUMERIC_LABEL_VALUE) return 'numeric';
      if (value === ' ') return 'numeric';
      return 'text';
    }

    function buildSelect(labelText, value, options) {
      if (window.InstantGeometryDrawLabelEngine && typeof window.InstantGeometryDrawLabelEngine.buildSelect === 'function') {
        return window.InstantGeometryDrawLabelEngine.buildSelect(labelText, value, options);
      }
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

    function buildCheckbox(labelText, checked) {
      if (window.InstantGeometryDrawLabelEngine && typeof window.InstantGeometryDrawLabelEngine.buildCheckbox === 'function') {
        return window.InstantGeometryDrawLabelEngine.buildCheckbox(labelText, checked);
      }
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

    function buildDecimalPlacesSelect(value) {
      return buildSelect('小数表示', String(clampDecimalPlaces(value)), [
        { value: '0', label: '整数' },
        { value: '1', label: '小数第1位' },
        { value: '2', label: '小数第2位' },
        { value: '3', label: '小数第3位' },
        { value: '4', label: '小数第4位' },
        { value: '5', label: '小数第5位' },
        { value: '6', label: '小数第6位' }
      ]);
    }

    function buildLabelSizeField(kind, id) {
      if (window.InstantGeometryDrawLabelEngine && typeof window.InstantGeometryDrawLabelEngine.buildRangeField === 'function') {
        return window.InstantGeometryDrawLabelEngine.buildRangeField(
          'ラベルサイズ',
          Math.round(getLabelScale(kind, id) * 100),
          10,
          400,
          10,
          function (scaleValue) { return scaleValue + '%'; }
        );
      }
      return buildSelect('ラベルサイズ', '100', [
        { value: '100', label: '100%' },
        { value: '150', label: '150%' },
        { value: '200', label: '200%' }
      ]);
    }

    function buildColorField(kind, id) {
      if (window.InstantGeometryDrawLabelEngine && typeof window.InstantGeometryDrawLabelEngine.buildColorPalette === 'function') {
        return window.InstantGeometryDrawLabelEngine.buildColorPalette('色', getLabelColor(kind, id));
      }
      return buildSelect('色', getLabelColor(kind, id), [
        { value: '#2a5bd7', label: '青' },
        { value: '#111827', label: '黒' },
        { value: '#e53935', label: '赤' }
      ]);
    }

    function buildLabelEditor(labelText, value) {
      if (window.InstantGeometryDrawLabelEngine && typeof window.InstantGeometryDrawLabelEngine.buildLabelEditor === 'function') {
        return window.InstantGeometryDrawLabelEngine.buildLabelEditor(labelText, value, true);
      }
      const field = document.createElement('div');
      field.className = 'sheet-field';
      const label = document.createElement('label');
      label.textContent = labelText;
      const mode = document.createElement('select');
      [
        { value: 'hidden', label: '非表示' },
        { value: 'numeric', label: '数値（自動）' },
        { value: 'ratio', label: '比の値' },
        { value: 'text', label: '自由入力' }
      ].forEach(function (option) {
        const node = document.createElement('option');
        node.value = option.value;
        node.textContent = option.label;
        if (option.value === getDisplayMode(value)) node.selected = true;
        mode.appendChild(node);
      });
      const input = document.createElement('input');
      input.type = 'text';
      input.value = getDisplayMode(value) === 'text' ? String(value || '') : getRatioLabelInput(value);
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

    function buildPointLabelEditor(labelText, value) {
      const field = document.createElement('div');
      field.className = 'sheet-field';
      const label = document.createElement('label');
      label.textContent = labelText;
      const mode = document.createElement('select');
      [
        { value: 'hidden', label: '非表示' },
        { value: 'text', label: '自由入力' }
      ].forEach(function (option) {
        const node = document.createElement('option');
        node.value = option.value;
        node.textContent = option.label;
        if ((value === '' && option.value === 'hidden') || (value !== '' && option.value === 'text')) node.selected = true;
        mode.appendChild(node);
      });
      const input = document.createElement('input');
      input.type = 'text';
      input.value = value || '';
      input.setAttribute('inputmode', 'text');
      input.autocapitalize = 'none';
      input.autocomplete = 'off';
      input.spellcheck = false;
      function sync() {
        input.disabled = mode.value !== 'text';
      }
      mode.addEventListener('change', sync);
      field.appendChild(label);
      field.appendChild(mode);
      field.appendChild(input);
      sync();
      return { field: field, mode: mode, input: input };
    }

    function drawSideKind(kind, P, Q) {
      if (!kind || kind === 'plain') return;
      if (window.InstantGeometryMobileAngleOrnaments && window.InstantGeometryMobileAngleOrnaments.drawSegmentKind(stage, kind, P, Q, svg)) return;
      const mid = { x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 };
      const dx = Q.x - P.x;
      const dy = Q.y - P.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const tx = dx / len;
      const ty = dy / len;
      const stroke = '#2a5bd7';
      const addLine = function (cx, cy, half) {
        stage.appendChild(svg('line', {
          x1: cx - nx * half,
          y1: cy - ny * half,
          x2: cx + nx * half,
          y2: cy + ny * half,
          stroke: stroke,
          'stroke-width': 3,
          'stroke-linecap': 'round'
        }));
      };
      if (kind === 'circle') {
        stage.appendChild(svg('circle', { cx: mid.x, cy: mid.y, r: 8, fill: 'none', stroke: stroke, 'stroke-width': 3 }));
      } else if (kind === 'single') {
        addLine(mid.x, mid.y, 12);
      } else if (kind === 'double') {
        addLine(mid.x - tx * 9, mid.y - ty * 9, 12);
        addLine(mid.x + tx * 9, mid.y + ty * 9, 12);
      } else if (kind === 'cross') {
        addLine(mid.x, mid.y, 12);
        stage.appendChild(svg('line', {
          x1: mid.x - tx * 9,
          y1: mid.y - ty * 9,
          x2: mid.x + tx * 9,
          y2: mid.y + ty * 9,
          stroke: stroke,
          'stroke-width': 3,
          'stroke-linecap': 'round'
        }));
      } else if (kind === 'triangle') {
        const p1 = { x: mid.x + tx * 12, y: mid.y + ty * 12 };
        const p2 = { x: mid.x - tx * 8 + nx * 7, y: mid.y - ty * 8 + ny * 7 };
        const p3 = { x: mid.x - tx * 8 - nx * 7, y: mid.y - ty * 8 - ny * 7 };
        stage.appendChild(svg('polygon', {
          points: [p1, p2, p3].map(function (p) { return p.x + ',' + p.y; }).join(' '),
          fill: stroke,
          stroke: stroke,
          'stroke-width': 1.5
        }));
      }
    }

    function quadraticPoint(P, C, Q, t) {
      return {
        x: (1 - t) * (1 - t) * P.x + 2 * (1 - t) * t * C.x + t * t * Q.x,
        y: (1 - t) * (1 - t) * P.y + 2 * (1 - t) * t * C.y + t * t * Q.y
      };
    }

    function pathFromQuadratic(P, C, Q, start, end) {
      const parts = [];
      for (let index = 0; index <= 20; index += 1) {
        const t = start + (end - start) * (index / 20);
        const point = quadraticPoint(P, C, Q, t);
        parts.push((index === 0 ? 'M ' : 'L ') + point.x + ' ' + point.y);
      }
      return parts.join(' ');
    }

    function drawSegmentLabelArc(P, Q, labelPoint) {
      const control = {
        x: labelPoint.x * 2 - ((P.x + Q.x) / 2),
        y: labelPoint.y * 2 - ((P.y + Q.y) / 2)
      };
      stage.appendChild(svg('path', { d: pathFromQuadratic(P, control, Q, 0, 0.36), class: 'label-arc' }));
      stage.appendChild(svg('path', { d: pathFromQuadratic(P, control, Q, 0.64, 1), class: 'label-arc' }));
    }

    function createTextLabel(text, attrs) {
      const parsed = isRatioLabelValue(text) ? parseRatioLabelInput(String(text).slice(RATIO_LABEL_PREFIX.length)) : null;
      if (parsed) {
        const x = Number(attrs.x) || 0;
        const y = Number(attrs.y) || 0;
        const fontSize = Number(attrs['font-size']) || 42;
        const textWidth = Math.max(fontSize * 0.7, parsed.value.length * fontSize * 0.62);
        const height = fontSize * 1.16;
        const width = parsed.mark === 't'
          ? Math.max(textWidth + fontSize * 0.8, height * 1.25)
          : Math.max(textWidth + fontSize * 0.55, height);
        const group = svg('g', {});
        const stroke = attrs.fill || '#2a5bd7';
        if (parsed.mark === 'r') {
          group.appendChild(svg('ellipse', { cx: x, cy: y, rx: width / 2, ry: height / 2, fill: '#ffffff', stroke: stroke, 'stroke-width': Math.max(2, fontSize * 0.055) }));
        } else if (parsed.mark === 't') {
          group.appendChild(svg('polygon', {
            points: [x + ',' + (y - height * 0.72), (x - width / 2) + ',' + (y + height * 0.48), (x + width / 2) + ',' + (y + height * 0.48)].join(' '),
            fill: '#ffffff',
            stroke: stroke,
            'stroke-width': Math.max(2, fontSize * 0.055),
            'stroke-linejoin': 'round'
          }));
        } else {
          group.appendChild(svg('rect', { x: x - width / 2, y: y - height / 2, width: width, height: height, fill: '#ffffff', stroke: stroke, 'stroke-width': Math.max(2, fontSize * 0.055) }));
        }
        const textNode = svg('text', Object.assign({}, attrs, { 'text-anchor': 'middle', 'dominant-baseline': 'middle' }));
        textNode.textContent = parsed.value;
        group.appendChild(textNode);
        return group;
      }
      if (window.InstantGeometrySharedLabels && typeof window.InstantGeometrySharedLabels.createSvgKatexLabel === 'function') {
        const katexNode = window.InstantGeometrySharedLabels.createSvgKatexLabel({
          createSvg: svg,
          text: text,
          attrs: attrs,
          kind: attrs['data-label-kind'] || attrs['data-kind'],
          id: attrs['data-label-id'] || attrs['data-id']
        });
        if (katexNode) return katexNode;
      }
      const node = svg('text', attrs);
      node.textContent = text;
      return node;
    }

    function addSegmentLabel(id, text, x, y) {
      if (!text) return null;
      const positioned = getLabelPosition('segment', id, { x: x, y: y });
      const node = createTextLabel(text, {
        x: positioned.x,
        y: positioned.y,
        class: 'shape-label measure-label',
        fill: '#2a5bd7',
        'font-size': 42,
        'font-weight': 700,
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
        'data-label-kind': 'segment',
        'data-label-id': id
      });
      if (isMoveTarget('segment', id)) node.classList.add('label-move-target');
      stage.appendChild(node);
      return attachSegmentModal(node, id);
    }

    function addPointLabel(id, x, y) {
      const text = String(pointInputs[id] || '');
      if (!text) return null;
      const positioned = getLabelPosition('point', id, { x: x, y: y });
      const node = addText(stage, text, positioned.x, positioned.y, '', {
        fill: '#1f2430',
        'font-size': 42,
        'font-weight': 700,
        'data-label-kind': 'point',
        'data-label-id': id
      });
      if (isMoveTarget('point', id)) node.classList.add('label-move-target');
      return attachPointModal(node, id);
    }

    function openPointModal(id) {
      closeSheets();
      if (!editSheet || !sheetTitle || !sheetBody) return;
      sheetTitle.textContent = '点 ' + id;
      const labelEditor = buildPointLabelEditor('ラベル', pointInputs[id] || '');
      sheetBody.appendChild(labelEditor.field);
      const hint = document.createElement('p');
      hint.className = 'sheet-hint';
      hint.textContent = '非表示または自由入力を選べます。自由入力では数字や記号も文字として表示します。';
      sheetBody.appendChild(hint);

      const actions = document.createElement('div');
      actions.className = 'sheet-actions';
      const cancel = document.createElement('button');
      cancel.className = 'btn';
      cancel.type = 'button';
      cancel.textContent = 'キャンセル';
      cancel.addEventListener('click', closeSheets);
      const save = document.createElement('button');
      save.className = 'btn action-primary';
      save.type = 'button';
      save.textContent = '保存';
      save.addEventListener('click', function () {
        pointInputs[id] = labelEditor.mode.value === 'text' ? String(labelEditor.input.value || '') : '';
        closeSheets();
        render();
      });
      actions.appendChild(cancel);
      actions.appendChild(save);
      sheetBody.appendChild(actions);
      editSheet.classList.add('open');
      editSheet.setAttribute('aria-hidden', 'false');
      sheetBackdrop.classList.add('open');
    }

    function attachPointModal(node, id) {
      if (!node) return node;
      node.dataset.dimensionId = id;
      if (isMoveTarget('point', id)) node.classList.add('label-move-target');
      node.addEventListener('pointerdown', function (event) {
        if (!isMoveTarget('point', id)) return;
        event.preventDefault();
        event.stopPropagation();
        const offset = ensureLabelOffset('point', id);
        moveDrag = {
          kind: 'point',
          id: id,
          startPoint: pointerToSvgPoint(event),
          startOffset: { x: offset.x, y: offset.y }
        };
      });
      node.addEventListener('click', function (event) {
        if (moveMode) return;
        event.preventDefault();
        openPointModal(id);
      });
      return node;
    }

    function openSegmentModal(id) {
      closeSheets();
      if (!editSheet || !sheetTitle || !sheetBody) return;
      sheetTitle.textContent = '線分 ' + id;
      const kindBuilt = buildSelect('線分マーク', segmentKinds[id] || 'plain', [
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
      ]);
      sheetBody.appendChild(kindBuilt.field);
      const checkboxBuilt = buildCheckbox('ガイドを表示', segmentArcVisible[id] !== false);
      sheetBody.appendChild(checkboxBuilt.field);
      const labelEditor = buildLabelEditor('ラベル', segmentInputs[id]);
      sheetBody.appendChild(labelEditor.field);
      const labelSizeBuilt = buildLabelSizeField('segment', id);
      sheetBody.appendChild(labelSizeBuilt.field);
      const colorBuilt = buildColorField('segment', id);
      sheetBody.appendChild(colorBuilt.field);
      const decimalBuilt = buildDecimalPlacesSelect(decimalPlaces);
      sheetBody.appendChild(decimalBuilt.field);

      const hint = document.createElement('p');
      hint.className = 'sheet-hint';
      hint.textContent = '線分ラベルです。非表示、数値、比の値、自由入力を選べます。\n' + RATIO_LABEL_HINT;
      sheetBody.appendChild(hint);

      const actions = document.createElement('div');
      actions.className = 'sheet-actions';
      actions.classList.add('has-move');
      const cancel = document.createElement('button');
      cancel.className = 'btn';
      cancel.type = 'button';
      cancel.textContent = 'キャンセル';
      cancel.addEventListener('click', closeSheets);
      function applyCurrentValue() {
        decimalPlaces = setActiveDecimalPlaces(decimalBuilt.select.value);
        segmentKinds[id] = kindBuilt.select.value;
        segmentArcVisible[id] = !!checkboxBuilt.input.checked;
        if (labelSizeBuilt.input) setLabelScale('segment', id, Number(labelSizeBuilt.input.value) / 100);
        else if (labelSizeBuilt.select) setLabelScale('segment', id, Number(labelSizeBuilt.select.value) / 100);
        if (colorBuilt.value) setLabelColor('segment', id, colorBuilt.value);
        else if (colorBuilt.select) setLabelColor('segment', id, colorBuilt.select.value);
        if (labelEditor.mode.value === 'hidden') {
          segmentInputs[id] = '';
          segmentArcVisible[id] = false;
        } else if (labelEditor.mode.value === 'numeric') {
          segmentInputs[id] = ' ';
        } else if (labelEditor.mode.value === 'numericRaw') {
          segmentInputs[id] = RAW_NUMERIC_LABEL_VALUE;
        } else if (labelEditor.mode.value === 'ratio') {
          const ratio = parseRatioLabelInput(labelEditor.input.value);
          if (!ratio) throw new Error('比の値は「r,5」「t,4.4」「s,5/3」の形式で入力してください。');
          segmentInputs[id] = RATIO_LABEL_PREFIX + ratio.source;
        } else {
          segmentInputs[id] = String(labelEditor.input.value || '');
        }
      }
      const move = document.createElement('button');
      move.className = 'btn action-secondary';
      move.type = 'button';
      move.textContent = '移動';
      move.addEventListener('click', function () {
        try {
          applyCurrentValue();
          render();
          enterMoveMode('segment', id);
        } catch (error) {
          setStatus(error.message || '入力を確認してください。', true);
        }
      });
      const save = document.createElement('button');
      save.className = 'btn action-primary';
      save.type = 'button';
      save.textContent = '保存';
      save.addEventListener('click', function () {
        try {
          applyCurrentValue();
          closeSheets();
          render();
        } catch (error) {
          setStatus(error.message || '入力を確認してください。', true);
        }
      });
      actions.appendChild(cancel);
      actions.appendChild(move);
      actions.appendChild(save);
      sheetBody.appendChild(actions);
      editSheet.classList.add('open');
      editSheet.setAttribute('aria-hidden', 'false');
      sheetBackdrop.classList.add('open');
    }

    function attachSegmentModal(node, id) {
      if (!node) return node;
      node.dataset.dimensionId = id;
      if (isMoveTarget('segment', id)) node.classList.add('label-move-target');
      node.addEventListener('pointerdown', function (event) {
        if (!isMoveTarget('segment', id)) return;
        event.preventDefault();
        event.stopPropagation();
        const offset = ensureLabelOffset('segment', id);
        moveDrag = {
          kind: 'segment',
          id: id,
          startPoint: pointerToSvgPoint(event),
          startOffset: { x: offset.x, y: offset.y }
        };
      });
      node.addEventListener('click', function (event) {
        if (moveMode) return;
        event.preventDefault();
        openSegmentModal(id);
      });
      return node;
    }

    function render() {
      setActiveDecimalPlaces(decimalPlaces);
      stage.innerHTML = '';
      Object.keys(currentLabelBases).forEach(function (key) { delete currentLabelBases[key]; });
      try {
        const g = readGeometry();
        if (shapeKind === 'sphere') {
          const axisLength = g.radius * 2.64;
          const scale = Math.min(560 / axisLength, 360 / g.radius);
          const radius = g.radius * scale;
          const axisX = 650;
          const centerY = 520;
          const top = centerY - radius;
          const bottom = centerY + radius;
          const axisTop = centerY - axisLength * scale / 2;
          const axisBottom = centerY + axisLength * scale / 2;
          const pointO = { x: axisX, y: centerY };
          const pointA = { x: axisX, y: top };
          const pointB = { x: axisX, y: bottom };
          const pointX = { x: axisX, y: axisTop };
          const pointY = { x: axisX, y: axisBottom };
          const radiusLabelPoint = { x: axisX + 72, y: (top + centerY) / 2 };
          const radiusLabelText = segmentLabel(radiusId, g.radius);
          const radiusPositionedLabelPoint = radiusLabelText ? getLabelPosition('segment', radiusId, radiusLabelPoint) : radiusLabelPoint;

          stage.appendChild(svg('line', { x1: axisX, y1: axisTop, x2: axisX, y2: axisBottom, class: 'rotation-axis' }));
          stage.appendChild(svg('line', { x1: axisX, y1: top, x2: axisX, y2: bottom, class: 'rotation-axis-guide' }));
          stage.appendChild(svg('path', {
            d: 'M ' + pointA.x + ' ' + pointA.y + ' A ' + radius + ' ' + radius + ' 0 0 0 ' + pointB.x + ' ' + pointB.y + ' Z',
            class: 'rotation-rect'
          }));
          stage.appendChild(svg('line', { x1: pointO.x, y1: pointO.y, x2: pointA.x, y2: pointA.y, class: 'rotation-side' }));
          stage.appendChild(attachSegmentModal(svg('line', { x1: pointO.x, y1: pointO.y, x2: pointA.x, y2: pointA.y, class: 'hit-target hit-line' }), radiusId));
          [['O', pointO.x, pointO.y], ['A', pointA.x, pointA.y], ['B', pointB.x, pointB.y], ['X', pointX.x, pointX.y], ['Y', pointY.x, pointY.y]].forEach(function (item) {
            stage.appendChild(attachPointModal(svg('circle', { cx: item[1], cy: item[2], r: 28, class: 'hit-target' }), item[0]));
          });
          drawSideKind(segmentKinds[radiusId], pointO, pointA);
          if (segmentArcVisible[radiusId] !== false && radiusLabelText) drawSegmentLabelArc(pointO, pointA, radiusPositionedLabelPoint);
          addSegmentLabel(radiusId, radiusLabelText, radiusLabelPoint.x, radiusLabelPoint.y);
          addPointLabel('O', axisX + 42, centerY);
          addPointLabel('A', axisX + 42, top - 26);
          addPointLabel('B', axisX + 42, bottom + 26);
          addPointLabel('X', axisX + 42, axisTop - 26);
          addPointLabel('Y', axisX + 42, axisBottom + 26);
          setStatus('入力をもとに' + displayName + 'の図を描画しています。', false);
          return;
        }
        if (shapeKind === 'frustum') {
          const axisLength = g.vertical * 1.32;
          const maxWidth = Math.max(g.top, g.horizontal);
          const scale = Math.min(560 / axisLength, 360 / maxWidth);
          const topW = g.top * scale;
          const bottomW = g.horizontal * scale;
          const rectH = g.vertical * scale;
          const axisH = axisLength * scale;
          const axisX = 650;
          const centerY = 520;
          const top = centerY - rectH / 2;
          const bottom = centerY + rectH / 2;
          const right = axisX;
          const axisTop = centerY - axisH / 2;
          const axisBottom = centerY + axisH / 2;
          const pointD = { x: right, y: top };
          const pointC = { x: right, y: bottom };
          const pointA = { x: right - topW, y: top };
          const pointB = { x: right - bottomW, y: bottom };
          const pointX = { x: axisX, y: axisTop };
          const pointY = { x: axisX, y: axisBottom };
          const topLabelPoint = { x: right - topW / 2, y: top - 70 };
          const verticalLabelPoint = { x: right + 72, y: centerY };
          const horizontalLabelPoint = { x: right - bottomW / 2, y: bottom + 70 };
          const topLabelText = segmentLabel(topId, g.top);
          const verticalLabelText = segmentLabel(verticalId, g.vertical);
          const horizontalLabelText = segmentLabel(horizontalId, g.horizontal);
          const topPositionedLabelPoint = topLabelText ? getLabelPosition('segment', topId, topLabelPoint) : topLabelPoint;
          const verticalPositionedLabelPoint = verticalLabelText ? getLabelPosition('segment', verticalId, verticalLabelPoint) : verticalLabelPoint;
          const horizontalPositionedLabelPoint = horizontalLabelText ? getLabelPosition('segment', horizontalId, horizontalLabelPoint) : horizontalLabelPoint;

          stage.appendChild(svg('line', { x1: axisX, y1: axisTop, x2: axisX, y2: axisBottom, class: 'rotation-axis' }));
          stage.appendChild(svg('line', { x1: axisX, y1: top, x2: axisX, y2: bottom, class: 'rotation-axis-guide' }));
          stage.appendChild(svg('polygon', {
            points: [pointA.x, pointA.y, pointB.x, pointB.y, pointC.x, pointC.y, pointD.x, pointD.y].join(' '),
            class: 'rotation-rect'
          }));
          stage.appendChild(svg('line', { x1: pointA.x, y1: pointA.y, x2: pointD.x, y2: pointD.y, class: 'rotation-side' }));
          stage.appendChild(svg('line', { x1: pointB.x, y1: pointB.y, x2: pointC.x, y2: pointC.y, class: 'rotation-side' }));
          stage.appendChild(attachSegmentModal(svg('line', { x1: pointA.x, y1: pointA.y, x2: pointD.x, y2: pointD.y, class: 'hit-target hit-line' }), topId));
          stage.appendChild(attachSegmentModal(svg('line', { x1: pointD.x, y1: pointD.y, x2: pointC.x, y2: pointC.y, class: 'hit-target hit-line' }), verticalId));
          stage.appendChild(attachSegmentModal(svg('line', { x1: pointB.x, y1: pointB.y, x2: pointC.x, y2: pointC.y, class: 'hit-target hit-line' }), horizontalId));
          [['A', pointA.x, pointA.y], ['B', pointB.x, pointB.y], ['C', pointC.x, pointC.y], ['D', pointD.x, pointD.y], ['X', pointX.x, pointX.y], ['Y', pointY.x, pointY.y]].forEach(function (item) {
            stage.appendChild(attachPointModal(svg('circle', { cx: item[1], cy: item[2], r: 28, class: 'hit-target' }), item[0]));
          });
          drawSideKind(segmentKinds[topId], pointA, pointD);
          drawSideKind(segmentKinds[verticalId], pointD, pointC);
          drawSideKind(segmentKinds[horizontalId], pointB, pointC);
          if (segmentArcVisible[topId] !== false && topLabelText) drawSegmentLabelArc(pointA, pointD, topPositionedLabelPoint);
          if (segmentArcVisible[verticalId] !== false && verticalLabelText) drawSegmentLabelArc(pointD, pointC, verticalPositionedLabelPoint);
          if (segmentArcVisible[horizontalId] !== false && horizontalLabelText) drawSegmentLabelArc(pointB, pointC, horizontalPositionedLabelPoint);
          addSegmentLabel(topId, topLabelText, topLabelPoint.x, topLabelPoint.y);
          addSegmentLabel(verticalId, verticalLabelText, verticalLabelPoint.x, verticalLabelPoint.y);
          addSegmentLabel(horizontalId, horizontalLabelText, horizontalLabelPoint.x, horizontalLabelPoint.y);
          addPointLabel('A', pointA.x - 38, top - 34);
          addPointLabel('B', pointB.x - 38, bottom + 34);
          addPointLabel('C', right + 38, bottom + 34);
          addPointLabel('D', right + 38, top - 34);
          addPointLabel('X', axisX + 42, axisTop - 26);
          addPointLabel('Y', axisX + 42, axisBottom + 26);
          setStatus('入力をもとに' + displayName + 'の図を描画しています。', false);
          return;
        }
        if (shapeKind === 'bicone') {
          const totalHeight = g.vertical + g.top;
          const axisLength = totalHeight * 1.32;
          const scale = Math.min(560 / axisLength, 360 / g.horizontal);
          const axisH = axisLength * scale;
          const axisX = 650;
          const centerY = 520;
          const acH = totalHeight * scale;
          const ahH = g.vertical * scale;
          const bhW = g.horizontal * scale;
          const top = centerY - acH / 2;
          const bottom = centerY + acH / 2;
          const axisTop = centerY - axisH / 2;
          const axisBottom = centerY + axisH / 2;
          const pointA = { x: axisX, y: top };
          const pointC = { x: axisX, y: bottom };
          const pointH = { x: axisX, y: top + ahH };
          const pointB = { x: axisX - bhW, y: pointH.y };
          const pointX = { x: axisX, y: axisTop };
          const pointY = { x: axisX, y: axisBottom };
          const verticalLabelPoint = { x: axisX + 72, y: (pointA.y + pointH.y) / 2 };
          const topLabelPoint = { x: axisX + 72, y: (pointH.y + pointC.y) / 2 };
          const horizontalLabelPoint = { x: (pointB.x + pointH.x) / 2, y: pointH.y + 70 };
          const verticalLabelText = segmentLabel(verticalId, g.vertical);
          const topLabelText = segmentLabel(topId, g.top);
          const horizontalLabelText = segmentLabel(horizontalId, g.horizontal);
          const verticalPositionedLabelPoint = verticalLabelText ? getLabelPosition('segment', verticalId, verticalLabelPoint) : verticalLabelPoint;
          const topPositionedLabelPoint = topLabelText ? getLabelPosition('segment', topId, topLabelPoint) : topLabelPoint;
          const horizontalPositionedLabelPoint = horizontalLabelText ? getLabelPosition('segment', horizontalId, horizontalLabelPoint) : horizontalLabelPoint;

          stage.appendChild(svg('line', { x1: axisX, y1: axisTop, x2: axisX, y2: axisBottom, class: 'rotation-axis' }));
          stage.appendChild(svg('line', { x1: axisX, y1: top, x2: axisX, y2: bottom, class: 'rotation-axis-guide' }));
          stage.appendChild(svg('polygon', {
            points: [pointA.x, pointA.y, pointB.x, pointB.y, pointC.x, pointC.y].join(' '),
            class: 'rotation-rect'
          }));
          stage.appendChild(svg('line', { x1: pointB.x, y1: pointB.y, x2: pointH.x, y2: pointH.y, class: 'rotation-side', 'stroke-dasharray': '10 8' }));
          stage.appendChild(attachSegmentModal(svg('line', { x1: pointA.x, y1: pointA.y, x2: pointH.x, y2: pointH.y, class: 'hit-target hit-line' }), verticalId));
          stage.appendChild(attachSegmentModal(svg('line', { x1: pointH.x, y1: pointH.y, x2: pointC.x, y2: pointC.y, class: 'hit-target hit-line' }), topId));
          stage.appendChild(attachSegmentModal(svg('line', { x1: pointB.x, y1: pointB.y, x2: pointH.x, y2: pointH.y, class: 'hit-target hit-line' }), horizontalId));
          [['A', pointA.x, pointA.y], ['B', pointB.x, pointB.y], ['C', pointC.x, pointC.y], ['H', pointH.x, pointH.y], ['X', pointX.x, pointX.y], ['Y', pointY.x, pointY.y]].forEach(function (item) {
            stage.appendChild(attachPointModal(svg('circle', { cx: item[1], cy: item[2], r: 28, class: 'hit-target' }), item[0]));
          });
          drawSideKind(segmentKinds[verticalId], pointA, pointH);
          drawSideKind(segmentKinds[topId], pointH, pointC);
          drawSideKind(segmentKinds[horizontalId], pointB, pointH);
          if (segmentArcVisible[verticalId] !== false && verticalLabelText) drawSegmentLabelArc(pointA, pointH, verticalPositionedLabelPoint);
          if (segmentArcVisible[topId] !== false && topLabelText) drawSegmentLabelArc(pointH, pointC, topPositionedLabelPoint);
          if (segmentArcVisible[horizontalId] !== false && horizontalLabelText) drawSegmentLabelArc(pointB, pointH, horizontalPositionedLabelPoint);
          addSegmentLabel(verticalId, verticalLabelText, verticalLabelPoint.x, verticalLabelPoint.y);
          addSegmentLabel(topId, topLabelText, topLabelPoint.x, topLabelPoint.y);
          addSegmentLabel(horizontalId, horizontalLabelText, horizontalLabelPoint.x, horizontalLabelPoint.y);
          addPointLabel('A', axisX + 42, top - 26);
          addPointLabel('B', pointB.x - 38, pointB.y);
          addPointLabel('C', axisX + 42, bottom + 26);
          addPointLabel('H', axisX + 42, pointH.y);
          addPointLabel('X', axisX + 42, axisTop - 26);
          addPointLabel('Y', axisX + 42, axisBottom + 26);
          setStatus('入力をもとに' + displayName + 'の図を描画しています。', false);
          return;
        }
        if (shapeKind === 'tube') {
          const axisLength = g.vertical * 1.32;
          const scale = Math.min(560 / axisLength, 420 / (g.horizontal + g.top));
          const rectH = g.vertical * scale;
          const rectW = g.horizontal * scale;
          const gap = g.top * scale;
          const axisH = axisLength * scale;
          const axisX = 650;
          const centerY = 520;
          const top = centerY - rectH / 2;
          const bottom = centerY + rectH / 2;
          const right = axisX - gap;
          const left = right - rectW;
          const axisTop = centerY - axisH / 2;
          const axisBottom = centerY + axisH / 2;
          const pointA = { x: left, y: top };
          const pointB = { x: left, y: bottom };
          const pointC = { x: right, y: bottom };
          const pointD = { x: right, y: top };
          const pointZ = { x: axisX, y: bottom };
          const pointX = { x: axisX, y: axisTop };
          const pointY = { x: axisX, y: axisBottom };
          const verticalLabelPoint = { x: left - 72, y: centerY };
          const horizontalLabelPoint = { x: left + rectW / 2, y: bottom + 70 };
          const topLabelPoint = { x: (pointC.x + pointZ.x) / 2, y: bottom + 70 };
          const verticalLabelText = segmentLabel(verticalId, g.vertical);
          const horizontalLabelText = segmentLabel(horizontalId, g.horizontal);
          const topLabelText = segmentLabel(topId, g.top);
          const verticalPositionedLabelPoint = verticalLabelText ? getLabelPosition('segment', verticalId, verticalLabelPoint) : verticalLabelPoint;
          const horizontalPositionedLabelPoint = horizontalLabelText ? getLabelPosition('segment', horizontalId, horizontalLabelPoint) : horizontalLabelPoint;
          const topPositionedLabelPoint = topLabelText ? getLabelPosition('segment', topId, topLabelPoint) : topLabelPoint;

          stage.appendChild(svg('line', { x1: axisX, y1: axisTop, x2: axisX, y2: axisBottom, class: 'rotation-axis' }));
          stage.appendChild(svg('polygon', {
            points: [pointA.x, pointA.y, pointB.x, pointB.y, pointC.x, pointC.y, pointD.x, pointD.y].join(' '),
            class: 'rotation-rect'
          }));
          stage.appendChild(svg('line', { x1: pointB.x, y1: pointB.y, x2: pointC.x, y2: pointC.y, class: 'rotation-side' }));
          stage.appendChild(svg('line', { x1: pointC.x, y1: pointC.y, x2: pointZ.x, y2: pointZ.y, class: 'rotation-side', 'stroke-dasharray': '10 8' }));
          stage.appendChild(attachSegmentModal(svg('line', { x1: pointA.x, y1: pointA.y, x2: pointB.x, y2: pointB.y, class: 'hit-target hit-line' }), verticalId));
          stage.appendChild(attachSegmentModal(svg('line', { x1: pointB.x, y1: pointB.y, x2: pointC.x, y2: pointC.y, class: 'hit-target hit-line' }), horizontalId));
          stage.appendChild(attachSegmentModal(svg('line', { x1: pointC.x, y1: pointC.y, x2: pointZ.x, y2: pointZ.y, class: 'hit-target hit-line' }), topId));
          [['A', pointA.x, pointA.y], ['B', pointB.x, pointB.y], ['C', pointC.x, pointC.y], ['D', pointD.x, pointD.y], ['Z', pointZ.x, pointZ.y], ['X', pointX.x, pointX.y], ['Y', pointY.x, pointY.y]].forEach(function (item) {
            stage.appendChild(attachPointModal(svg('circle', { cx: item[1], cy: item[2], r: 28, class: 'hit-target' }), item[0]));
          });
          drawSideKind(segmentKinds[verticalId], pointA, pointB);
          drawSideKind(segmentKinds[horizontalId], pointB, pointC);
          drawSideKind(segmentKinds[topId], pointC, pointZ);
          if (segmentArcVisible[verticalId] !== false && verticalLabelText) drawSegmentLabelArc(pointA, pointB, verticalPositionedLabelPoint);
          if (segmentArcVisible[horizontalId] !== false && horizontalLabelText) drawSegmentLabelArc(pointB, pointC, horizontalPositionedLabelPoint);
          if (segmentArcVisible[topId] !== false && topLabelText) drawSegmentLabelArc(pointC, pointZ, topPositionedLabelPoint);
          addSegmentLabel(verticalId, verticalLabelText, verticalLabelPoint.x, verticalLabelPoint.y);
          addSegmentLabel(horizontalId, horizontalLabelText, horizontalLabelPoint.x, horizontalLabelPoint.y);
          addSegmentLabel(topId, topLabelText, topLabelPoint.x, topLabelPoint.y);
          addPointLabel('A', left - 38, top - 34);
          addPointLabel('B', left - 38, bottom + 34);
          addPointLabel('C', right + 38, bottom + 34);
          addPointLabel('D', right + 38, top - 34);
          addPointLabel('Z', axisX + 42, bottom + 34);
          addPointLabel('X', axisX + 42, axisTop - 26);
          addPointLabel('Y', axisX + 42, axisBottom + 26);
          setStatus('入力をもとに' + displayName + 'の図を描画しています。', false);
          return;
        }
        if (shapeKind === 'hollow-frustum') {
          const axisLength = g.vertical * 1.32;
          const scale = Math.min(560 / axisLength, 420 / (g.horizontal + g.top));
          const acH = g.vertical * scale;
          const bcW = g.horizontal * scale;
          const czW = g.top * scale;
          const axisH = axisLength * scale;
          const axisX = 650;
          const centerY = 520;
          const top = centerY - acH / 2;
          const bottom = centerY + acH / 2;
          const right = axisX - czW;
          const left = right - bcW;
          const axisTop = centerY - axisH / 2;
          const axisBottom = centerY + axisH / 2;
          const mark = Math.min(42, bcW * 0.22, acH * 0.18);
          const pointA = { x: right, y: top };
          const pointC = { x: right, y: bottom };
          const pointB = { x: left, y: bottom };
          const pointZ = { x: axisX, y: bottom };
          const pointX = { x: axisX, y: axisTop };
          const pointY = { x: axisX, y: axisBottom };
          const verticalLabelPoint = { x: right + 72, y: centerY };
          const horizontalLabelPoint = { x: (pointB.x + pointC.x) / 2, y: bottom + 70 };
          const topLabelPoint = { x: (pointC.x + pointZ.x) / 2, y: bottom + 70 };
          const verticalLabelText = segmentLabel(verticalId, g.vertical);
          const horizontalLabelText = segmentLabel(horizontalId, g.horizontal);
          const topLabelText = segmentLabel(topId, g.top);
          const verticalPositionedLabelPoint = verticalLabelText ? getLabelPosition('segment', verticalId, verticalLabelPoint) : verticalLabelPoint;
          const horizontalPositionedLabelPoint = horizontalLabelText ? getLabelPosition('segment', horizontalId, horizontalLabelPoint) : horizontalLabelPoint;
          const topPositionedLabelPoint = topLabelText ? getLabelPosition('segment', topId, topLabelPoint) : topLabelPoint;

          stage.appendChild(svg('line', { x1: axisX, y1: axisTop, x2: axisX, y2: axisBottom, class: 'rotation-axis' }));
          stage.appendChild(svg('polygon', {
            points: [pointA.x, pointA.y, pointB.x, pointB.y, pointC.x, pointC.y].join(' '),
            class: 'rotation-rect'
          }));
          stage.appendChild(svg('line', { x1: pointC.x, y1: pointC.y, x2: pointZ.x, y2: pointZ.y, class: 'rotation-side', 'stroke-dasharray': '10 8' }));
          stage.appendChild(svg('path', { d: 'M ' + pointC.x + ' ' + (pointC.y - mark) + ' L ' + (pointC.x - mark) + ' ' + (pointC.y - mark) + ' L ' + (pointC.x - mark) + ' ' + pointC.y, class: 'rotation-right-mark' }));
          stage.appendChild(attachSegmentModal(svg('line', { x1: pointA.x, y1: pointA.y, x2: pointC.x, y2: pointC.y, class: 'hit-target hit-line' }), verticalId));
          stage.appendChild(attachSegmentModal(svg('line', { x1: pointB.x, y1: pointB.y, x2: pointC.x, y2: pointC.y, class: 'hit-target hit-line' }), horizontalId));
          stage.appendChild(attachSegmentModal(svg('line', { x1: pointC.x, y1: pointC.y, x2: pointZ.x, y2: pointZ.y, class: 'hit-target hit-line' }), topId));
          [['A', pointA.x, pointA.y], ['B', pointB.x, pointB.y], ['C', pointC.x, pointC.y], ['Z', pointZ.x, pointZ.y], ['X', pointX.x, pointX.y], ['Y', pointY.x, pointY.y]].forEach(function (item) {
            stage.appendChild(attachPointModal(svg('circle', { cx: item[1], cy: item[2], r: 28, class: 'hit-target' }), item[0]));
          });
          drawSideKind(segmentKinds[verticalId], pointA, pointC);
          drawSideKind(segmentKinds[horizontalId], pointB, pointC);
          drawSideKind(segmentKinds[topId], pointC, pointZ);
          if (segmentArcVisible[verticalId] !== false && verticalLabelText) drawSegmentLabelArc(pointA, pointC, verticalPositionedLabelPoint);
          if (segmentArcVisible[horizontalId] !== false && horizontalLabelText) drawSegmentLabelArc(pointB, pointC, horizontalPositionedLabelPoint);
          if (segmentArcVisible[topId] !== false && topLabelText) drawSegmentLabelArc(pointC, pointZ, topPositionedLabelPoint);
          addSegmentLabel(verticalId, verticalLabelText, verticalLabelPoint.x, verticalLabelPoint.y);
          addSegmentLabel(horizontalId, horizontalLabelText, horizontalLabelPoint.x, horizontalLabelPoint.y);
          addSegmentLabel(topId, topLabelText, topLabelPoint.x, topLabelPoint.y);
          addPointLabel('A', right + 38, top - 34);
          addPointLabel('B', left - 38, bottom + 34);
          addPointLabel('C', right + 38, bottom + 34);
          addPointLabel('Z', axisX + 42, bottom + 34);
          addPointLabel('X', axisX + 42, axisTop - 26);
          addPointLabel('Y', axisX + 42, axisBottom + 26);
          setStatus('入力をもとに' + displayName + 'の図を描画しています。', false);
          return;
        }
        const axisLength = g.vertical * 1.32;
        const scale = Math.min(560 / axisLength, 360 / g.horizontal);
        const rectH = g.vertical * scale;
        const rectW = g.horizontal * scale;
        const axisH = axisLength * scale;
        const axisX = 650;
        const centerY = 520;
        const top = centerY - rectH / 2;
        const bottom = centerY + rectH / 2;
        const right = axisX;
        const left = right - rectW;
        const axisTop = centerY - axisH / 2;
        const axisBottom = centerY + axisH / 2;
        const mark = Math.min(42, rectW * 0.18, rectH * 0.18);
        const pointA = shapeKind === 'cone' ? { x: right, y: top } : { x: left, y: top };
        const pointB = { x: left, y: bottom };
        const pointC = { x: right, y: bottom };
        const pointD = { x: right, y: top };
        const pointX = { x: axisX, y: axisTop };
        const pointY = { x: axisX, y: axisBottom };
        const verticalEndPoint = shapeKind === 'cone' ? pointC : pointB;
        const verticalLabelPoint = shapeKind === 'cone' ? { x: right + 72, y: centerY } : { x: left - 72, y: centerY };
        const horizontalLabelPoint = { x: left + rectW / 2, y: bottom + 70 };
        const hypotenuseLabelPoint = { x: left + rectW * 0.3, y: centerY - 52 };
        const verticalLabelText = segmentLabel(verticalId, g.vertical);
        const horizontalLabelText = segmentLabel(horizontalId, g.horizontal);
        const hypotenuseValue = Math.hypot(g.vertical, g.horizontal);
        const hypotenuseLabelText = hypotenuseId ? segmentLabel(hypotenuseId, hypotenuseValue, pythagoreanLabel(g.vertical, g.horizontal)) : '';
        const verticalPositionedLabelPoint = verticalLabelText ? getLabelPosition('segment', verticalId, verticalLabelPoint) : verticalLabelPoint;
        const horizontalPositionedLabelPoint = horizontalLabelText ? getLabelPosition('segment', horizontalId, horizontalLabelPoint) : horizontalLabelPoint;
        const hypotenusePositionedLabelPoint = hypotenuseLabelText ? getLabelPosition('segment', hypotenuseId, hypotenuseLabelPoint) : hypotenuseLabelPoint;

        stage.appendChild(svg('line', { x1: axisX, y1: axisTop, x2: axisX, y2: axisBottom, class: 'rotation-axis' }));
        stage.appendChild(svg('line', { x1: axisX, y1: top, x2: axisX, y2: bottom, class: 'rotation-axis-guide' }));
        stage.appendChild(svg('polygon', {
          points: shapeKind === 'cone'
            ? [pointA.x, pointA.y, pointB.x, pointB.y, pointC.x, pointC.y].join(' ')
            : [left, top, left, bottom, right, bottom, right, top].join(' '),
          class: 'rotation-rect'
        }));
        stage.appendChild(svg('line', { x1: left, y1: bottom, x2: right, y2: bottom, class: 'rotation-side' }));
        stage.appendChild(attachSegmentModal(svg('line', { x1: pointA.x, y1: pointA.y, x2: verticalEndPoint.x, y2: verticalEndPoint.y, class: 'hit-target hit-line' }), verticalId));
        stage.appendChild(attachSegmentModal(svg('line', { x1: pointB.x, y1: pointB.y, x2: pointC.x, y2: pointC.y, class: 'hit-target hit-line' }), horizontalId));
        if (hypotenuseId) {
          stage.appendChild(attachSegmentModal(svg('line', { x1: pointA.x, y1: pointA.y, x2: pointB.x, y2: pointB.y, class: 'hit-target hit-line' }), hypotenuseId));
        }
        const points = shapeKind === 'cone'
          ? [['A', pointA.x, pointA.y], ['B', pointB.x, pointB.y], ['C', pointC.x, pointC.y], ['X', pointX.x, pointX.y], ['Y', pointY.x, pointY.y]]
          : [['A', pointA.x, pointA.y], ['B', pointB.x, pointB.y], ['C', pointC.x, pointC.y], ['D', pointD.x, pointD.y], ['X', pointX.x, pointX.y], ['Y', pointY.x, pointY.y]];
        points.forEach(function (item) {
          stage.appendChild(attachPointModal(svg('circle', { cx: item[1], cy: item[2], r: 28, class: 'hit-target' }), item[0]));
        });
        drawSideKind(segmentKinds[verticalId], pointA, verticalEndPoint);
        drawSideKind(segmentKinds[horizontalId], pointB, pointC);
        if (hypotenuseId) drawSideKind(segmentKinds[hypotenuseId], pointA, pointB);
        if (segmentArcVisible[verticalId] !== false && verticalLabelText) drawSegmentLabelArc(pointA, verticalEndPoint, verticalPositionedLabelPoint);
        if (segmentArcVisible[horizontalId] !== false && horizontalLabelText) drawSegmentLabelArc(pointB, pointC, horizontalPositionedLabelPoint);
        if (hypotenuseId && segmentArcVisible[hypotenuseId] !== false && hypotenuseLabelText) drawSegmentLabelArc(pointA, pointB, hypotenusePositionedLabelPoint);
        if (shapeKind !== 'cone') {
          stage.appendChild(svg('path', { d: 'M ' + (right - mark) + ' ' + top + ' L ' + (right - mark) + ' ' + (top + mark) + ' L ' + right + ' ' + (top + mark), class: 'rotation-right-mark' }));
        }
        stage.appendChild(svg('path', { d: 'M ' + (right - mark) + ' ' + bottom + ' L ' + (right - mark) + ' ' + (bottom - mark) + ' L ' + right + ' ' + (bottom - mark), class: 'rotation-right-mark' }));

        addSegmentLabel(verticalId, verticalLabelText, verticalLabelPoint.x, verticalLabelPoint.y);
        addSegmentLabel(horizontalId, horizontalLabelText, horizontalLabelPoint.x, horizontalLabelPoint.y);
        if (hypotenuseId) addSegmentLabel(hypotenuseId, hypotenuseLabelText, hypotenuseLabelPoint.x, hypotenuseLabelPoint.y);
        addPointLabel('A', shapeKind === 'cone' ? right + 38 : left - 38, top - 34);
        addPointLabel('B', left - 38, bottom + 34);
        addPointLabel('C', right + 38, bottom + 34);
        if (shapeKind !== 'cone') addPointLabel('D', right + 38, top - 34);
        addPointLabel('X', axisX + 42, axisTop - 26);
        addPointLabel('Y', axisX + 42, axisBottom + 26);
        setStatus('入力をもとに' + displayName + 'の図を描画しています。', false);
      } catch (error) {
        setStatus(error.message || '入力を確認してください。', true);
      }
    }

    function saveCanvas(transparent) {
      closeSheets();
      if (!window.html2canvas) return;
      html2canvas(captureRoot, {
        backgroundColor: transparent ? null : '#fbfcff',
        scale: Math.max(2, window.devicePixelRatio || 1)
      }).then(function (canvas) {
        canvas.toBlob(function (blob) {
          if (blob) downloadBlob(blob, (config.fileBase || 'solid-revolution-cylinder') + (transparent ? '-transparent' : '') + '.png');
        });
      });
    }

    function savePdf() {
      closeSheets();
      if (!window.html2canvas || !window.jspdf) return;
      html2canvas(captureRoot, { backgroundColor: '#fbfcff', scale: Math.max(2, window.devicePixelRatio || 1) }).then(function (canvas) {
        const pdf = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
        const w = canvas.width * ratio;
        const h = canvas.height * ratio;
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pageW - w) / 2, (pageH - h) / 2, w, h);
        pdf.save((config.fileBase || 'solid-revolution-cylinder') + '.pdf');
      });
    }

    if (verticalInput) verticalInput.addEventListener('input', render);
    if (horizontalInput) horizontalInput.addEventListener('input', render);
    if (topInput) topInput.addEventListener('input', render);
    if (backBtn) backBtn.addEventListener('click', function () { window.location.href = '/draw/'; });
    if (saveBtn) saveBtn.addEventListener('click', openSaveSheet);
    if (sheetClose) sheetClose.addEventListener('click', closeSheets);
    if (saveSheetClose) saveSheetClose.addEventListener('click', closeSheets);
    if (sheetBackdrop) sheetBackdrop.addEventListener('click', function () { if (!moveMode) closeSheets(); });
    moveCancelBtn.addEventListener('click', function () { finishMoveMode(true); });
    moveDoneBtn.addEventListener('click', function () { finishMoveMode(false); });
    window.addEventListener('pointermove', function (event) {
      if (!moveDrag) return;
      const point = pointerToSvgPoint(event);
      const offset = ensureLabelOffset(moveDrag.kind, moveDrag.id);
      offset.x = moveDrag.startOffset.x + (point.x - moveDrag.startPoint.x);
      offset.y = moveDrag.startOffset.y + (point.y - moveDrag.startPoint.y);
      render();
    });
    window.addEventListener('pointerup', function () { moveDrag = null; });
    window.addEventListener('pointercancel', function () { moveDrag = null; });
    if (savePngBtn) savePngBtn.addEventListener('click', function () { saveCanvas(false); });
    if (saveTransparentBtn) saveTransparentBtn.addEventListener('click', function () { saveCanvas(true); });
    if (savePdfBtn) savePdfBtn.addEventListener('click', savePdf);
    render();
  }

  function createConeRotationPage(config) {
    createCylinderRotationPage(Object.assign({}, config, {
      shapeKind: 'cone',
      verticalLabel: 'AC',
      horizontalLabel: 'BC',
      pointIds: ['A', 'B', 'C', 'X', 'Y'],
      displayName: '回転体②（円錐）'
    }));
  }

  function createSphereRotationPage(config) {
    createCylinderRotationPage(Object.assign({}, config, {
      shapeKind: 'sphere',
      radiusLabel: 'OA',
      pointIds: ['O', 'A', 'B', 'X', 'Y'],
      displayName: '回転体③（球）'
    }));
  }

  function createFrustumRotationPage(config) {
    createCylinderRotationPage(Object.assign({}, config, {
      shapeKind: 'frustum',
      topLabel: 'AD',
      verticalLabel: 'CD',
      horizontalLabel: 'BC',
      pointIds: ['A', 'B', 'C', 'D', 'X', 'Y'],
      displayName: '回転体④（円錐台）'
    }));
  }

  function createBiconeRotationPage(config) {
    createCylinderRotationPage(Object.assign({}, config, {
      shapeKind: 'bicone',
      verticalLabel: 'AH',
      horizontalLabel: 'BH',
      topLabel: 'CH',
      pointIds: ['A', 'B', 'C', 'H', 'X', 'Y'],
      displayName: '回転体⑤（二錐）'
    }));
  }

  function createTubeRotationPage(config) {
    createCylinderRotationPage(Object.assign({}, config, {
      shapeKind: 'tube',
      verticalLabel: 'AB',
      horizontalLabel: 'BC',
      topLabel: 'CZ',
      pointIds: ['A', 'B', 'C', 'D', 'Z', 'X', 'Y'],
      displayName: '回転体⑥（円筒）'
    }));
  }

  function createHollowFrustumRotationPage(config) {
    createCylinderRotationPage(Object.assign({}, config, {
      shapeKind: 'hollow-frustum',
      verticalLabel: 'AC',
      horizontalLabel: 'BC',
      topLabel: 'CZ',
      pointIds: ['A', 'B', 'C', 'Z', 'X', 'Y'],
      displayName: '回転体⑦（空洞円錐台）'
    }));
  }

  function createConePage(config) {
    createCylinderPage(Object.assign({}, config, { shapeKind: 'cone' }));
  }

  function createSpherePage(config) {
    createCylinderPage(Object.assign({}, config, { shapeKind: 'sphere' }));
  }

  function createHemisphere1Page(config) {
    createCylinderPage(Object.assign({}, config, { shapeKind: 'hemisphere-1' }));
  }

  function createHemisphere2Page(config) {
    createCylinderPage(Object.assign({}, config, { shapeKind: 'hemisphere-2' }));
  }

  function createQuarterSphere1Page(config) {
    createCylinderPage(Object.assign({}, config, { shapeKind: 'quarter-sphere-1' }));
  }

  function createSimilarSolid1Page(config) {
    createCylinderPage(Object.assign({}, config, { shapeKind: 'similar-solid-1' }));
  }

  function createSimilarSolid2Page(config) {
    createCylinderPage(Object.assign({}, config, { shapeKind: 'similar-solid-2' }));
  }

  function createTriangularPrismPage(config) {
    createCylinderPage(Object.assign({}, config, { shapeKind: 'triangular-prism' }));
  }

  function createTriangularPyramidPage(config) {
    createCylinderPage(Object.assign({}, config, { shapeKind: 'triangular-pyramid' }));
  }

  function createRightTriangularPyramid1Page(config) {
    createCylinderPage(Object.assign({}, config, { shapeKind: 'right-triangular-pyramid-1' }));
  }

  function createRightTriangularPyramidPage(config) {
    createCylinderPage(Object.assign({}, config, { shapeKind: 'right-triangular-pyramid' }));
  }

  function createCrossSection1Page(config) {
    createCylinderPage(Object.assign({}, config, { shapeKind: 'cross-section-1' }));
  }

  function createCrossSection2Page(config) {
    createCylinderPage(Object.assign({}, config, { shapeKind: 'cross-section-2' }));
  }

  function createCrossSection3Page(config) {
    createCylinderPage(Object.assign({}, config, { shapeKind: 'cross-section-3' }));
  }

  function createRegularTetrahedronPage(config) {
    createCylinderPage(Object.assign({}, config, { shapeKind: 'regular-tetrahedron' }));
  }

  function createRegularHexahedronPage(config) {
    createCylinderPage(Object.assign({}, config, { shapeKind: 'regular-hexahedron' }));
  }

  function createRegularOctahedronPage(config) {
    createCylinderPage(Object.assign({}, config, { shapeKind: 'regular-octahedron' }));
  }

  function createRegularDodecahedronPage(config) {
    createCylinderPage(Object.assign({}, config, { shapeKind: 'regular-dodecahedron' }));
  }

  function createRegularIcosahedronPage(config) {
    createCylinderPage(Object.assign({}, config, { shapeKind: 'regular-icosahedron' }));
  }

  function createQuadrangularPyramidPage(config) {
    createCylinderPage(Object.assign({}, config, { shapeKind: 'quadrangular-pyramid' }));
  }

  function createPentagonalPyramidPage(config) {
    createCylinderPage(Object.assign({}, config, { shapeKind: 'pentagonal-pyramid' }));
  }

  function createHexagonalPyramidPage(config) {
    createCylinderPage(Object.assign({}, config, { shapeKind: 'hexagonal-pyramid' }));
  }

  function createQuadrangularPrismPage(config) {
    createCylinderPage(Object.assign({}, config, { shapeKind: 'quadrangular-prism' }));
  }

  function createPentagonalPrismPage(config) {
    createCylinderPage(Object.assign({}, config, { shapeKind: 'pentagonal-prism' }));
  }

  function createHexagonalPrismPage(config) {
    createCylinderPage(Object.assign({}, config, { shapeKind: 'hexagonal-prism' }));
  }

  window.InstantGeometrySolidMobile = {
    createConePage: createConePage,
    createSpherePage: createSpherePage,
    createHemisphere1Page: createHemisphere1Page,
    createHemisphere2Page: createHemisphere2Page,
    createQuarterSphere1Page: createQuarterSphere1Page,
    createSimilarSolid1Page: createSimilarSolid1Page,
    createSimilarSolid2Page: createSimilarSolid2Page,
    createTriangularPrismPage: createTriangularPrismPage,
    createTriangularPyramidPage: createTriangularPyramidPage,
    createRightTriangularPyramid1Page: createRightTriangularPyramid1Page,
    createRightTriangularPyramidPage: createRightTriangularPyramidPage,
    createCrossSection1Page: createCrossSection1Page,
    createCrossSection2Page: createCrossSection2Page,
    createCrossSection3Page: createCrossSection3Page,
    createRegularTetrahedronPage: createRegularTetrahedronPage,
    createRegularHexahedronPage: createRegularHexahedronPage,
    createRegularOctahedronPage: createRegularOctahedronPage,
    createRegularDodecahedronPage: createRegularDodecahedronPage,
    createRegularIcosahedronPage: createRegularIcosahedronPage,
    createQuadrangularPyramidPage: createQuadrangularPyramidPage,
    createPentagonalPyramidPage: createPentagonalPyramidPage,
    createHexagonalPyramidPage: createHexagonalPyramidPage,
    createQuadrangularPrismPage: createQuadrangularPrismPage,
    createPentagonalPrismPage: createPentagonalPrismPage,
    createHexagonalPrismPage: createHexagonalPrismPage,
    createCylinderPage: createCylinderPage,
    createCylinderRotationPage: createCylinderRotationPage,
    createConeRotationPage: createConeRotationPage,
    createSphereRotationPage: createSphereRotationPage,
    createFrustumRotationPage: createFrustumRotationPage,
    createBiconeRotationPage: createBiconeRotationPage,
    createTubeRotationPage: createTubeRotationPage,
    createHollowFrustumRotationPage: createHollowFrustumRotationPage
  };
}());
