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

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function parseNumericExpression(value, name) {
    const source = String(value || '').trim();
    if (!source) throw new Error(name + ' には 0 より大きい数を入力してください。');
    const text = source.replace(/\s+/g, '');
    let index = 0;

    function peek() {
      return text[index] || '';
    }

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
      if (!raw || raw === '.' || (raw.match(/\./g) || []).length > 1) {
        throw new Error(name + ' の入力式を確認してください。');
      }
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

    const result = parseExpression();
    if (index !== text.length || !Number.isFinite(result)) {
      throw new Error(name + ' の入力式を確認してください。');
    }
    return result;
  }

  function parseNatural(value, name) {
    const parsed = parseNumericExpression(value, name);
    if (!(parsed > 0)) {
      throw new Error(name + ' には 0 より大きい数を入力してください。');
    }
    return parsed;
  }

  function formatAutoInputLabel(source) {
    const text = String(source || '').trim().replace(/\s+/g, '');
    if (!text) return '';
    function formatRootRatio(multiplier, radicandFraction, denominator) {
      const fraction = radicandFraction && typeof radicandFraction === 'object'
        ? radicandFraction
        : { numerator: Number(radicandFraction), denominator: 1 };
      if (!fraction || !Number.isFinite(fraction.numerator) || !Number.isFinite(fraction.denominator) || fraction.denominator <= 0 || fraction.numerator < 0) return '';
      const root = formatRootFraction(fraction.numerator, fraction.denominator);
      if (!root) return '';
      if (multiplier === 1 && denominator === 1) return root;
      return formatRootFraction(
        fraction.numerator * multiplier * multiplier,
        fraction.denominator * denominator * denominator
      );
    }
    function parseRadicandFractionSource(raw) {
      const value = String(raw || '').trim();
      if (!value) return null;
      const slash = value.indexOf('/');
      if (slash !== -1) {
        const left = decimalToFraction(Number(value.slice(0, slash)));
        const right = decimalToFraction(Number(value.slice(slash + 1)));
        return left && right ? divideFractions(left, right) : null;
      }
      return decimalToFraction(Number(value));
    }
    function formatIntegerRootRatio(multiplier, radicand, denominator) {
      let inside = radicand;
      let outside = multiplier;
      for (let factor = Math.floor(Math.sqrt(inside)); factor >= 2; factor -= 1) {
        const square = factor * factor;
        if (inside % square === 0) {
          outside *= factor;
          inside /= square;
          factor = Math.floor(Math.sqrt(inside)) + 1;
        }
      }
      const divisor = gcd(outside, denominator);
      outside /= divisor;
      denominator /= divisor;
      if (inside === 1) {
        return denominator === 1 ? String(outside) : outside + '/' + denominator;
      }
      const root = (outside === 1 ? '' : String(outside)) + '√' + inside;
      return denominator === 1 ? root : root + '/' + denominator;
    }
    function formatAutoTerm(term) {
      if (/^[0-9]+(?:\.[0-9]+)?$/.test(term)) return term;
      if (/^[0-9]+\/[1-9][0-9]*$/.test(term)) {
        const parts = term.split('/');
        return formatPreferredNumber(Number(parts[0]) / Number(parts[1]), {
          type: 'rational',
          numerator: Number(parts[0]),
          denominator: Number(parts[1])
        });
      }
      const root = /^(?:(\d+)\*?)?(?:√\(?([0-9]+(?:\.[0-9]+)?(?:\/[1-9][0-9]*(?:\.[0-9]+)?)?)\)?|sqrt\(?([0-9]+(?:\.[0-9]+)?(?:\/[1-9][0-9]*(?:\.[0-9]+)?)?)\)?)(?:\/([1-9][0-9]*))?$/i.exec(term);
      if (!root) return '';
      const multiplier = root[1] ? Number(root[1]) : 1;
      const radicand = parseRadicandFractionSource(root[2] || root[3]);
      const denominator = root[4] ? Number(root[4]) : 1;
      if (!radicand || radicand.numerator < 0) return '';
      return formatRootRatio(multiplier, radicand, denominator);
    }
    function formatAdditiveExpression() {
      const terms = [];
      let start = 0;
      for (let i = 1; i < text.length; i += 1) {
        if (text[i] === '+' || text[i] === '-') {
          terms.push(text.slice(start, i));
          start = i;
        }
      }
      terms.push(text.slice(start));
      if (terms.length < 2) return '';
      return terms.map(function (term, index) {
        const sign = term[0] === '-' ? '-' : (term[0] === '+' ? '+' : '');
        const body = sign ? term.slice(1) : term;
        const formatted = formatAutoTerm(body);
        if (!formatted) return '';
        if (index === 0) return sign === '-' ? '-' + formatted : formatted;
        return (sign === '-' ? '-' : '+') + formatted;
      }).every(Boolean) ? terms.map(function (term, index) {
        const sign = term[0] === '-' ? '-' : (term[0] === '+' ? '+' : '');
        const body = sign ? term.slice(1) : term;
        const formatted = formatAutoTerm(body);
        return index === 0 ? (sign === '-' ? '-' + formatted : formatted) : (sign === '-' ? '-' : '+') + formatted;
      }).join('') : '';
    }
    if (/^[0-9]+\/[1-9][0-9]*$/.test(text)) {
      const parts = text.split('/');
      return formatPreferredNumber(Number(parts[0]) / Number(parts[1]), {
        type: 'rational',
        numerator: Number(parts[0]),
        denominator: Number(parts[1])
      });
    }
    const rootMatch = /^(?:(\d+)\*?)?(?:√\(?([0-9]+)\)?|sqrt\(?([0-9]+)\)?)(?:\/([1-9][0-9]*))?$/i.exec(text);
    if (rootMatch) {
      const multiplier = rootMatch[1] ? Number(rootMatch[1]) : 1;
      const radicand = Number(rootMatch[2] || rootMatch[3]);
      const denominator = rootMatch[4] ? Number(rootMatch[4]) : 1;
      if (Number.isFinite(radicand) && radicand >= 0) return formatIntegerRootRatio(multiplier, radicand, denominator);
    }
    const piText = text.replace(/pi/ig, 'π').replace(/\*/g, '');
    if (/^(?:[0-9]+)?π(?:\/[1-9][0-9]*)?$/.test(piText)) return piText;
    const additive = formatAdditiveExpression();
    if (additive) return additive;
    const singleTerm = formatAutoTerm(text);
    if (singleTerm) return singleTerm;
    return '';
  }

  function toDegrees(rad) {
    return rad * 180 / Math.PI;
  }

  function formatNumber(value) {
    const digits = activeDecimalPlaces;
    const factor = Math.pow(10, digits);
    const rounded = Math.round(value * factor) / factor;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '');
  }

  function hexToRgba(hex, alpha) {
    const text = String(hex || '').trim();
    const match = /^#?([0-9a-f]{6})$/i.exec(text);
    if (!match) return 'rgba(42,91,215,' + alpha + ')';
    const raw = match[1];
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function componentToHex(value) {
    return Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0');
  }

  function hslToHex(h, s, l) {
    const hue = ((h % 360) + 360) % 360;
    const sat = Math.max(0, Math.min(100, s)) / 100;
    const light = Math.max(0, Math.min(100, l)) / 100;
    const chroma = (1 - Math.abs(2 * light - 1)) * sat;
    const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
    const m = light - chroma / 2;
    let r = 0;
    let g = 0;
    let b = 0;
    if (hue < 60) { r = chroma; g = x; }
    else if (hue < 120) { r = x; g = chroma; }
    else if (hue < 180) { g = chroma; b = x; }
    else if (hue < 240) { g = x; b = chroma; }
    else if (hue < 300) { r = x; b = chroma; }
    else { r = chroma; b = x; }
    return '#' + componentToHex((r + m) * 255) + componentToHex((g + m) * 255) + componentToHex((b + m) * 255);
  }

  function hexToHsl(hex) {
    const text = String(hex || '').trim();
    const match = /^#?([0-9a-f]{6})$/i.exec(text);
    if (!match) return { h: 137, s: 44, l: 26 };
    const raw = match[1];
    const r = parseInt(raw.slice(0, 2), 16) / 255;
    const g = parseInt(raw.slice(2, 4), 16) / 255;
    const b = parseInt(raw.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    let h = 0;
    if (delta) {
      if (max === r) h = 60 * (((g - b) / delta) % 6);
      else if (max === g) h = 60 * ((b - r) / delta + 2);
      else h = 60 * ((r - g) / delta + 4);
    }
    const l = (max + min) / 2;
    const s = delta ? delta / (1 - Math.abs(2 * l - 1)) : 0;
    return { h: (h + 360) % 360, s: s * 100, l: l * 100 };
  }

  function areaLabelColor(hex) {
    const hsl = hexToHsl(hex || '#2a5bd7');
    if (hsl.s < 8) return hsl.l > 50 ? '#4b5563' : '#111827';
    return hslToHex(hsl.h, Math.max(42, hsl.s), 26);
  }

  function polygonCentroid(points) {
    let areaTwice = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < points.length; i += 1) {
      const p = points[i];
      const q = points[(i + 1) % points.length];
      const cross = p.x * q.y - q.x * p.y;
      areaTwice += cross;
      cx += (p.x + q.x) * cross;
      cy += (p.y + q.y) * cross;
    }
    if (Math.abs(areaTwice) < 1e-9) {
      return points.reduce(function (acc, point) {
        acc.x += point.x / points.length;
        acc.y += point.y / points.length;
        return acc;
      }, { x: 0, y: 0 });
    }
    return { x: cx / (3 * areaTwice), y: cy / (3 * areaTwice) };
  }

  function distanceToSegment(point, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
    const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
    return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t));
  }

  function fittedAreaLabel(points, label, maxFontSize) {
    const point = polygonCentroid(points);
    let distance = Infinity;
    for (let i = 0; i < points.length; i += 1) {
      distance = Math.min(distance, distanceToSegment(point, points[i], points[(i + 1) % points.length]));
    }
    const textLength = String(label || '').length || 1;
    const widthFactor = Math.max(1.05, textLength * 0.64);
    return {
      x: point.x,
      y: point.y,
      fontSize: Math.max(14, Math.min(maxFontSize || 54, Math.floor((distance * 1.82) / widthFactor)))
    };
  }

  function gcd(a, b) {
    let x = Math.abs(Math.round(a));
    let y = Math.abs(Math.round(b));
    while (y) {
      const t = y;
      y = x % y;
      x = t;
    }
    return x || 1;
  }

  function formatRational(value) {
    if (!Number.isFinite(value)) return null;
    const sign = value < 0 ? '-' : '';
    const abs = Math.abs(value);
    if (Number.isInteger(abs)) return sign + String(abs);
    const maxDenominator = 120;
    for (let denominator = 2; denominator <= maxDenominator; denominator += 1) {
      const numerator = Math.round(abs * denominator);
      if (Math.abs(abs - numerator / denominator) < 1e-10) {
        const divisor = gcd(numerator, denominator);
        return sign + (numerator / divisor) + '/' + (denominator / divisor);
      }
    }
    return null;
  }

  function formatSimplifiedRoot(radicand) {
    if (!Number.isFinite(radicand) || radicand < 0) return null;
    const rounded = Math.round(radicand);
    if (Math.abs(radicand - rounded) > 1e-10) return null;
    if (rounded === 0) return '0';
    const root = Math.sqrt(rounded);
    if (Number.isInteger(root)) return String(root);
    let outside = 1;
    let inside = rounded;
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

  function decimalToFraction(value) {
    if (!Number.isFinite(value)) return null;
    const sign = value < 0 ? -1 : 1;
    const text = String(Math.abs(value));
    if (text.indexOf('e') !== -1) return null;
    const dot = text.indexOf('.');
    if (dot === -1) return { numerator: sign * Math.round(Math.abs(value)), denominator: 1 };
    const decimals = text.length - dot - 1;
    const denominator = Math.pow(10, decimals);
    const numerator = Math.round(Math.abs(value) * denominator) * sign;
    if (denominator > 1000000 || Math.abs(numerator) > 1000000000) return null;
    const divisor = gcd(numerator, denominator);
    return { numerator: numerator / divisor, denominator: denominator / divisor };
  }

  function multiplyFractions(fractions) {
    return fractions.reduce(function (acc, fraction) {
      let numerator = acc.numerator * fraction.numerator;
      let denominator = acc.denominator * fraction.denominator;
      const divisor = gcd(numerator, denominator);
      return {
        numerator: numerator / divisor,
        denominator: denominator / divisor
      };
    }, { numerator: 1, denominator: 1 });
  }

  function multiplyFractionByInteger(fraction, integer) {
    if (!fraction || !Number.isFinite(integer)) return null;
    const numerator = fraction.numerator * Math.round(integer);
    const denominator = fraction.denominator;
    const divisor = gcd(numerator, denominator);
    return { numerator: numerator / divisor, denominator: denominator / divisor };
  }

  function addFractions(left, right) {
    if (!left || !right) return null;
    const numerator = left.numerator * right.denominator + right.numerator * left.denominator;
    const denominator = left.denominator * right.denominator;
    const divisor = gcd(numerator, denominator);
    return { numerator: numerator / divisor, denominator: denominator / divisor };
  }

  function negateFraction(value) {
    if (!value) return null;
    return { numerator: -value.numerator, denominator: value.denominator };
  }

  function sumFractions(values) {
    return values.reduce(function (acc, value) {
      return addFractions(acc, value);
    }, { numerator: 0, denominator: 1 });
  }

  function squareFraction(value) {
    const fraction = decimalToFraction(value);
    if (!fraction || Math.abs(fraction.numerator) > 1000000 || fraction.denominator > 1000000) return null;
    return {
      numerator: fraction.numerator * fraction.numerator,
      denominator: fraction.denominator * fraction.denominator
    };
  }

  function divideFractions(left, right) {
    if (!left || !right || !right.numerator) return null;
    const numerator = left.numerator * right.denominator;
    const denominator = left.denominator * right.numerator;
    if (denominator < 0) {
      return { numerator: -numerator, denominator: -denominator };
    }
    const divisor = gcd(numerator, denominator);
    return { numerator: numerator / divisor, denominator: denominator / divisor };
  }

  function fractionToText(fraction) {
    if (!fraction || !Number.isFinite(fraction.numerator) || !Number.isFinite(fraction.denominator) || !fraction.denominator) return null;
    let numerator = fraction.numerator;
    let denominator = fraction.denominator;
    if (denominator < 0) {
      numerator = -numerator;
      denominator = -denominator;
    }
    const divisor = gcd(numerator, denominator);
    numerator /= divisor;
    denominator /= divisor;
    return denominator === 1 ? String(numerator) : numerator + '/' + denominator;
  }

  function parseExactSquareInput(source) {
    const text = String(source || '').trim().replace(/\s+/g, '').replace(/sqrt/ig, '√');
    if (!text || /[+\-]/.test(text.slice(1)) || /π|pi/i.test(text)) return null;
    let index = 0;

    function peek() {
      return text[index] || '';
    }

    function readNumber() {
      const start = index;
      while (/[0-9.]/.test(peek())) index += 1;
      if (start === index) return null;
      const raw = text.slice(start, index);
      if (raw === '.' || (raw.match(/\./g) || []).length > 1) return null;
      return decimalToFraction(Number(raw));
    }

    function readRadicandSquare() {
      if (peek() !== '√') return null;
      index += 1;
      let raw = '';
      if (peek() === '(') {
        index += 1;
        const start = index;
        while (/[0-9./]/.test(peek())) index += 1;
        raw = text.slice(start, index);
        if (peek() !== ')') return null;
        index += 1;
      } else {
        const start = index;
        while (/[0-9./]/.test(peek())) index += 1;
        raw = text.slice(start, index);
      }
      if (!raw) return null;
      const slash = raw.indexOf('/');
      const radicand = slash === -1
        ? decimalToFraction(Number(raw))
        : divideFractions(decimalToFraction(Number(raw.slice(0, slash))), decimalToFraction(Number(raw.slice(slash + 1))));
      return radicand && radicand.numerator >= 0 ? radicand : null;
    }

    function readFactorSquare() {
      let square = { numerator: 1, denominator: 1 };
      let consumed = false;
      if (peek() === '√') {
        const rootSquare = readRadicandSquare();
        if (!rootSquare) return null;
        square = multiplyFractions([square, rootSquare]);
        consumed = true;
      } else if (/[0-9.]/.test(peek())) {
        const number = readNumber();
        if (!number) return null;
        square = multiplyFractions([square, { numerator: number.numerator * number.numerator, denominator: number.denominator * number.denominator }]);
        consumed = true;
        if (peek() === '√') {
          const rootSquare = readRadicandSquare();
          if (!rootSquare) return null;
          square = multiplyFractions([square, rootSquare]);
        }
      }
      return consumed ? square : null;
    }

    let result = readFactorSquare();
    if (!result) return null;
    while (index < text.length) {
      const operator = peek();
      if (operator === '*') {
        index += 1;
        const factor = readFactorSquare();
        if (!factor) return null;
        result = multiplyFractions([result, factor]);
      } else if (operator === '/') {
        index += 1;
        const factor = readFactorSquare();
        if (!factor) return null;
        result = divideFractions(result, factor);
        if (!result) return null;
      } else if (peek() === '√' || /[0-9.]/.test(peek())) {
        const factor = readFactorSquare();
        if (!factor) return null;
        result = multiplyFractions([result, factor]);
      } else {
        return null;
      }
    }
    return result;
  }

  function squarefreeFactor(value) {
    let inside = Math.abs(Math.round(value));
    let outside = 1;
    if (!inside) return { outside: 0, inside: 1 };
    for (let factor = Math.floor(Math.sqrt(inside)); factor >= 2; factor -= 1) {
      const square = factor * factor;
      if (inside % square === 0) {
        outside *= factor;
        inside /= square;
        factor = Math.floor(Math.sqrt(inside)) + 1;
      }
    }
    return { outside: outside, inside: inside };
  }

  function normalizeFraction(fraction) {
    if (!fraction || !Number.isFinite(fraction.numerator) || !Number.isFinite(fraction.denominator) || !fraction.denominator) return null;
    let numerator = Math.round(fraction.numerator);
    let denominator = Math.round(fraction.denominator);
    if (denominator < 0) {
      numerator = -numerator;
      denominator = -denominator;
    }
    const divisor = gcd(numerator, denominator);
    return { numerator: numerator / divisor, denominator: denominator / divisor };
  }

  function addFractionValues(left, right) {
    return normalizeFraction({
      numerator: left.numerator * right.denominator + right.numerator * left.denominator,
      denominator: left.denominator * right.denominator
    });
  }

  function multiplyFractionValues(left, right) {
    return normalizeFraction({
      numerator: left.numerator * right.numerator,
      denominator: left.denominator * right.denominator
    });
  }

  function createRadicalExpression() {
    return {};
  }

  function radicalExpressionFromFraction(fraction) {
    const expression = createRadicalExpression();
    if (fraction) addRadicalTerm(expression, 1, fraction);
    return Object.keys(expression).length ? expression : null;
  }

  function addRadicalTerm(expression, radicand, coefficient) {
    const normalized = normalizeFraction(coefficient);
    if (!normalized || normalized.numerator === 0) return expression;
    const key = String(radicand || 1);
    const current = expression[key] || { numerator: 0, denominator: 1 };
    const sum = addFractionValues(current, normalized);
    if (!sum || sum.numerator === 0) delete expression[key];
    else expression[key] = sum;
    return expression;
  }

  function cloneRadicalExpression(expression) {
    const result = {};
    Object.keys(expression || {}).forEach(function (key) {
      result[key] = { numerator: expression[key].numerator, denominator: expression[key].denominator };
    });
    return result;
  }

  function addRadicalExpressions(left, right) {
    const result = cloneRadicalExpression(left);
    Object.keys(right || {}).forEach(function (key) {
      addRadicalTerm(result, Number(key), right[key]);
    });
    return result;
  }

  function negateRadicalExpression(expression) {
    const result = {};
    Object.keys(expression || {}).forEach(function (key) {
      result[key] = { numerator: -expression[key].numerator, denominator: expression[key].denominator };
    });
    return result;
  }

  function scaleRadicalExpression(expression, scalar) {
    const factor = normalizeFraction(scalar);
    if (!factor) return null;
    const result = {};
    Object.keys(expression || {}).forEach(function (key) {
      const value = multiplyFractionValues(expression[key], factor);
      if (value && value.numerator) result[key] = value;
    });
    return result;
  }

  function multiplyRadicalExpressions(left, right) {
    const result = createRadicalExpression();
    Object.keys(left || {}).forEach(function (leftKey) {
      Object.keys(right || {}).forEach(function (rightKey) {
        const radicandProduct = Number(leftKey) * Number(rightKey);
        const simplified = squarefreeFactor(radicandProduct);
        const coefficient = multiplyFractionValues(left[leftKey], right[rightKey]);
        const scaled = multiplyFractionValues(coefficient, { numerator: simplified.outside, denominator: 1 });
        addRadicalTerm(result, simplified.inside, scaled);
      });
    });
    return result;
  }

  function parseExactValueExpression(source) {
    const text = String(source || '').trim().replace(/\s+/g, '').replace(/sqrt/ig, '√');
    if (!text || /π|pi/i.test(text)) return null;
    const parts = [];
    let start = 0;
    for (let i = 1; i < text.length; i += 1) {
      if (text[i] === '+' || text[i] === '-') {
        parts.push(text.slice(start, i));
        start = i;
      }
    }
    parts.push(text.slice(start));
    const result = createRadicalExpression();
    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];
      const sign = part[0] === '-' ? -1 : 1;
      const body = (part[0] === '-' || part[0] === '+') ? part.slice(1) : part;
      if (!body) return null;
      const root = /^(?:(\d+)\*?)?√\(?([0-9]+(?:\.[0-9]+)?(?:\/[1-9][0-9]*(?:\.[0-9]+)?)?)\)?(?:\/([1-9][0-9]*))?$/.exec(body);
      if (root) {
        const multiplier = root[1] ? Number(root[1]) : 1;
        const radicandText = root[2];
        const slash = radicandText.indexOf('/');
        const radicandFraction = slash === -1
          ? decimalToFraction(Number(radicandText))
          : divideFractions(decimalToFraction(Number(radicandText.slice(0, slash))), decimalToFraction(Number(radicandText.slice(slash + 1))));
        if (!radicandFraction) return null;
        const denominator = root[3] ? Number(root[3]) : 1;
        const simplified = squarefreeFactor(radicandFraction.numerator * radicandFraction.denominator);
        addRadicalTerm(result, simplified.inside, {
          numerator: sign * multiplier * simplified.outside,
          denominator: denominator * radicandFraction.denominator
        });
        continue;
      }
      const rational = /^([0-9]+(?:\.[0-9]+)?)(?:\/([1-9][0-9]*))?$/.exec(body);
      if (rational) {
        const number = decimalToFraction(Number(rational[1]));
        const denominator = rational[2] ? Number(rational[2]) : 1;
        const value = denominator === 1 ? number : divideFractions(number, { numerator: denominator, denominator: 1 });
        if (!value) return null;
        addRadicalTerm(result, 1, { numerator: sign * value.numerator, denominator: value.denominator });
        continue;
      }
      return null;
    }
    return Object.keys(result).length ? result : null;
  }

  function parseExactSquareExpressionInput(source) {
    const expression = parseExactValueExpression(source);
    return expression ? multiplyRadicalExpressions(expression, expression) : null;
  }

  function lcm(a, b) {
    return Math.abs(a * b) / gcd(a, b || 1);
  }

  function formatRadicalExpression(expression) {
    const keys = Object.keys(expression || {}).filter(function (key) {
      return expression[key] && expression[key].numerator;
    });
    if (!keys.length) return null;
    keys.sort(function (left, right) {
      if (left === '1') return -1;
      if (right === '1') return 1;
      return Number(left) - Number(right);
    });
    let commonDenominator = 1;
    keys.forEach(function (key) {
      commonDenominator = lcm(commonDenominator, expression[key].denominator);
    });
    const pieces = [];
    keys.forEach(function (key) {
      const fraction = expression[key];
      const numerator = fraction.numerator * (commonDenominator / fraction.denominator);
      const sign = numerator < 0 ? '-' : '+';
      const abs = Math.abs(numerator);
      let body = '';
      if (key === '1') {
        body = String(abs);
      } else {
        body = (abs === 1 ? '' : String(abs)) + '√' + key;
      }
      pieces.push({ sign: sign, body: body });
    });
    if (!pieces.length) return null;
    let numeratorText = pieces.map(function (piece, index) {
      return (index === 0 && piece.sign === '+' ? '' : piece.sign) + piece.body;
    }).join('');
    if (commonDenominator === 1) return numeratorText;
    return '(' + numeratorText + ')/' + commonDenominator;
  }

  function formatSquareRootOfRadicalExpression(expression) {
    const keys = Object.keys(expression || {});
    if (!keys.length) return null;
    let commonDenominator = 1;
    keys.forEach(function (key) {
      commonDenominator = lcm(commonDenominator, expression[key].denominator);
    });
    const scaled = scaleRadicalExpression(expression, { numerator: commonDenominator, denominator: 1 });
    const body = formatRadicalExpression(scaled);
    if (!body) return null;
    const rootBody = keys.length === 1 && keys[0] === '1' ? body : '(' + body + ')';
    const denominatorRoot = Math.sqrt(commonDenominator);
    if (Number.isInteger(denominatorRoot)) {
      const root = '√' + rootBody;
      return denominatorRoot === 1 ? root : root + '/' + denominatorRoot;
    }
    return '√(' + formatRadicalExpression(expression) + ')';
  }

  function formatPythagoreanRootFromRational(radicandFraction) {
    if (!radicandFraction || radicandFraction.numerator < 0) return null;
    return formatRootFraction(radicandFraction.numerator, radicandFraction.denominator);
  }

  function formatRootFraction(numerator, denominator) {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0 || numerator < 0) return null;
    const divisor = gcd(numerator, denominator);
    let n = numerator / divisor;
    let d = denominator / divisor;
    let radicand = n * d;
    let outside = 1;
    for (let factor = Math.floor(Math.sqrt(radicand)); factor >= 2; factor -= 1) {
      const square = factor * factor;
      if (radicand % square === 0) {
        outside *= factor;
        radicand /= square;
        factor = Math.floor(Math.sqrt(radicand)) + 1;
      }
    }
    const outsideDivisor = gcd(outside, d);
    outside /= outsideDivisor;
    d /= outsideDivisor;
    if (radicand === 1) {
      return d === 1 ? String(outside) : outside + '/' + d;
    }
    const root = (outside === 1 ? '' : String(outside)) + '√' + radicand;
    return d === 1 ? root : root + '/' + d;
  }

  function formatPreferredNumber(value, exact) {
    if (Number.isFinite(value) && Math.abs(value - Math.round(value)) < 1e-10) {
      return String(Math.round(value));
    }
    if (exact && exact.type === 'rational') {
      const numerator = exact.numerator;
      const denominator = exact.denominator;
      if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator) {
        const divisor = gcd(numerator, denominator);
        const reducedNumerator = numerator / divisor;
        const reducedDenominator = denominator / divisor;
        if (Math.abs(reducedDenominator) === 1) return String(reducedNumerator * Math.sign(reducedDenominator));
        return reducedNumerator + '/' + reducedDenominator;
      }
      const rational = formatRational(value);
      if (rational) return rational;
    }
    if (exact && exact.type === 'root') {
      const root = formatSimplifiedRoot(exact.radicand);
      if (root) return root;
    }
    const rational = formatRational(value);
    if (rational && rational.indexOf('/') !== -1) return rational;
    return formatNumber(value);
  }

  function formatPythagoreanLeg(hypotenuse, leg) {
    const radicand = (hypotenuse * hypotenuse) - (leg * leg);
    const hypotenuseSquare = squareFraction(hypotenuse);
    const legSquare = squareFraction(leg);
    const exact = hypotenuseSquare && legSquare ? addFractions(hypotenuseSquare, {
      numerator: -legSquare.numerator,
      denominator: legSquare.denominator
    }) : null;
    const exactRoot = formatPythagoreanRootFromRational(exact);
    if (exactRoot) return exactRoot;
    return formatPreferredNumber(Math.sqrt(Math.max(0, radicand)), {
      type: 'root',
      radicand: radicand
    });
  }

  function formatPythagoreanLegFromInputs(hypotenuse, leg, hypotenuseInput, legInput) {
    const hypotenuseSquare = parseExactSquareInput(hypotenuseInput) || squareFraction(hypotenuse);
    const legSquare = parseExactSquareInput(legInput) || squareFraction(leg);
    const exact = hypotenuseSquare && legSquare ? addFractions(hypotenuseSquare, {
      numerator: -legSquare.numerator,
      denominator: legSquare.denominator
    }) : null;
    const exactRoot = formatPythagoreanRootFromRational(exact);
    if (exactRoot) return exactRoot;
    return formatPythagoreanLeg(hypotenuse, leg);
  }

  function formatPythagoreanHypotenuse(legA, legB) {
    const radicand = (legA * legA) + (legB * legB);
    const exact = addFractions(squareFraction(legA), squareFraction(legB));
    const exactRoot = formatPythagoreanRootFromRational(exact);
    if (exactRoot) return exactRoot;
    return formatPreferredNumber(Math.sqrt(Math.max(0, radicand)), {
      type: 'root',
      radicand: radicand
    });
  }

  function joinRootTerms(terms) {
    return terms.map(function (term, index) {
      const sign = term.sign < 0 ? '-' : (index === 0 ? '' : '+');
      return sign + term.body;
    }).join('');
  }

  function formatScaledRootTerms(multiplier, denominator, terms) {
    if (!Number.isFinite(multiplier) || !Number.isFinite(denominator) || !denominator || !terms || !terms.length) return null;
    const divisor = gcd(multiplier, denominator);
    const numerator = multiplier / divisor;
    const reducedDenominator = denominator / divisor;
    const expression = joinRootTerms(terms);
    if (terms.length === 1) {
      const body = terms[0].body;
      if (body === '1') return formatPreferredNumber(numerator / reducedDenominator, { type: 'rational', numerator: numerator, denominator: reducedDenominator });
      if (reducedDenominator === 1) return numerator === 1 ? body : numerator + body;
      return (numerator === 1 ? body : numerator + body) + '/' + reducedDenominator;
    }
    if (reducedDenominator === 1) return numerator === 1 ? expression : numerator + '(' + expression + ')';
    return (numerator === 1 ? '(' + expression + ')' : numerator + '(' + expression + ')') + '/' + reducedDenominator;
  }

  function formatSpecialRightTriangleSide(hypotenuse, angleA, sideId) {
    const table = {
      15: {
        a: { denominator: 4, terms: [{ sign: 1, body: '√6' }, { sign: -1, body: '√2' }] },
        c: { denominator: 4, terms: [{ sign: 1, body: '√6' }, { sign: 1, body: '√2' }] }
      },
      30: {
        a: { denominator: 2, terms: [{ sign: 1, body: '1' }] },
        c: { denominator: 2, terms: [{ sign: 1, body: '√3' }] }
      },
      45: {
        a: { denominator: 2, terms: [{ sign: 1, body: '√2' }] },
        c: { denominator: 2, terms: [{ sign: 1, body: '√2' }] }
      },
      60: {
        a: { denominator: 2, terms: [{ sign: 1, body: '√3' }] },
        c: { denominator: 2, terms: [{ sign: 1, body: '1' }] }
      },
      75: {
        a: { denominator: 4, terms: [{ sign: 1, body: '√6' }, { sign: 1, body: '√2' }] },
        c: { denominator: 4, terms: [{ sign: 1, body: '√6' }, { sign: -1, body: '√2' }] }
      },
      18: {
        a: { denominator: 4, terms: [{ sign: 1, body: '√5' }, { sign: -1, body: '1' }] },
        c: { denominator: 4, terms: [{ sign: 1, body: '√(10+2√5)' }] }
      },
      36: {
        a: { denominator: 4, terms: [{ sign: 1, body: '√(10-2√5)' }] },
        c: { denominator: 4, terms: [{ sign: 1, body: '√5' }, { sign: 1, body: '1' }] }
      },
      54: {
        a: { denominator: 4, terms: [{ sign: 1, body: '√5' }, { sign: 1, body: '1' }] },
        c: { denominator: 4, terms: [{ sign: 1, body: '√(10-2√5)' }] }
      },
      72: {
        a: { denominator: 4, terms: [{ sign: 1, body: '√(10+2√5)' }] },
        c: { denominator: 4, terms: [{ sign: 1, body: '√5' }, { sign: -1, body: '1' }] }
      }
    };
    const config = table[angleA] && table[angleA][sideId];
    if (!config) return null;
    return formatScaledRootTerms(hypotenuse, config.denominator, config.terms);
  }

  function formatArea(a, b, c) {
    const s = (a + b + c) / 2;
    const area = Math.sqrt(Math.max(0, s * (s - a) * (s - b) * (s - c)));
    return formatPreferredNumber(area);
  }

  function pointTriangleArea(P, Q, R) {
    return Math.abs(((Q.x - P.x) * (R.y - P.y)) - ((Q.y - P.y) * (R.x - P.x))) / 2;
  }

  function formatHeronArea(a, b, c) {
    const values = [a + b + c, -a + b + c, a - b + c, a + b - c].map(decimalToFraction);
    if (values.some(function (value) { return !value; })) return formatArea(a, b, c);
    const product = multiplyFractions(values.concat([{ numerator: 1, denominator: 16 }]));
    const formatted = formatRootFraction(product.numerator, product.denominator);
    return formatted || formatArea(a, b, c);
  }

  function formatHeronAreaFromInputs(a, b, c, inputs) {
    const raw = inputs || {};
    const a2Expression = parseExactSquareExpressionInput(raw.a) || radicalExpressionFromFraction(squareFraction(a));
    const b2Expression = parseExactSquareExpressionInput(raw.b) || radicalExpressionFromFraction(squareFraction(b));
    const c2Expression = parseExactSquareExpressionInput(raw.c) || radicalExpressionFromFraction(squareFraction(c));
    if (a2Expression && b2Expression && c2Expression) {
      const area16Expression = addRadicalExpressions(addRadicalExpressions(addRadicalExpressions(addRadicalExpressions(addRadicalExpressions(
        scaleRadicalExpression(multiplyRadicalExpressions(a2Expression, b2Expression), { numerator: 2, denominator: 1 }),
        scaleRadicalExpression(multiplyRadicalExpressions(b2Expression, c2Expression), { numerator: 2, denominator: 1 })
      ),
        scaleRadicalExpression(multiplyRadicalExpressions(c2Expression, a2Expression), { numerator: 2, denominator: 1 })
      ),
        negateRadicalExpression(multiplyRadicalExpressions(a2Expression, a2Expression))
      ),
        negateRadicalExpression(multiplyRadicalExpressions(b2Expression, b2Expression))
      ),
        negateRadicalExpression(multiplyRadicalExpressions(c2Expression, c2Expression))
      );
      const areaSquareExpression = scaleRadicalExpression(area16Expression, { numerator: 1, denominator: 16 });
      const formattedExpression = areaSquareExpression ? formatSquareRootOfRadicalExpression(areaSquareExpression) : null;
      if (formattedExpression) return formattedExpression;
    }
    const a2 = parseExactSquareInput(raw.a) || squareFraction(a);
    const b2 = parseExactSquareInput(raw.b) || squareFraction(b);
    const c2 = parseExactSquareInput(raw.c) || squareFraction(c);
    if (a2 && b2 && c2) {
      const terms = [
        multiplyFractionByInteger(multiplyFractions([a2, b2]), 2),
        multiplyFractionByInteger(multiplyFractions([b2, c2]), 2),
        multiplyFractionByInteger(multiplyFractions([c2, a2]), 2),
        negateFraction(multiplyFractions([a2, a2])),
        negateFraction(multiplyFractions([b2, b2])),
        negateFraction(multiplyFractions([c2, c2]))
      ];
      const area16 = sumFractions(terms);
      const areaSquare = divideFractions(area16, { numerator: 16, denominator: 1 });
      const formatted = areaSquare && areaSquare.numerator > 0
        ? formatRootFraction(areaSquare.numerator, areaSquare.denominator)
        : null;
      if (formatted) return formatted;
    }
    return formatHeronArea(a, b, c);
  }

  function formatHeronInradius(a, b, c) {
    const fa = decimalToFraction(a);
    const fb = decimalToFraction(b);
    const fc = decimalToFraction(c);
    if (!fa || !fb || !fc) {
      const s = (a + b + c) / 2;
      const area = Math.sqrt(Math.max(0, s * (s - a) * (s - b) * (s - c)));
      return formatPreferredNumber(area / s);
    }
    const sum = sumFractions([fa, fb, fc]);
    const x = sumFractions([negateFraction(fa), fb, fc]);
    const y = sumFractions([fa, negateFraction(fb), fc]);
    const z = sumFractions([fa, fb, negateFraction(fc)]);
    if (!sum || !x || !y || !z || x.numerator <= 0 || y.numerator <= 0 || z.numerator <= 0 || sum.numerator <= 0) {
      const s = (a + b + c) / 2;
      const area = Math.sqrt(Math.max(0, s * (s - a) * (s - b) * (s - c)));
      return formatPreferredNumber(area / s);
    }
    const product = multiplyFractions([x, y, z]);
    const denominator = { numerator: 4 * sum.numerator, denominator: sum.denominator };
    const squared = divideFractions(product, denominator);
    const formatted = squared ? formatRootFraction(squared.numerator, squared.denominator) : null;
    if (formatted) return formatted;
    const s = (a + b + c) / 2;
    const area = Math.sqrt(Math.max(0, s * (s - a) * (s - b) * (s - c)));
    return formatPreferredNumber(area / s);
  }

  function formatIncenterSubArea(sideLength, a, b, c) {
    const side = decimalToFraction(sideLength);
    const fa = decimalToFraction(a);
    const fb = decimalToFraction(b);
    const fc = decimalToFraction(c);
    if (!side || !fa || !fb || !fc) {
      const s = (a + b + c) / 2;
      const area = Math.sqrt(Math.max(0, s * (s - a) * (s - b) * (s - c)));
      return formatPreferredNumber((sideLength * area / s) / 2);
    }
    const sum = sumFractions([fa, fb, fc]);
    const x = sumFractions([negateFraction(fa), fb, fc]);
    const y = sumFractions([fa, negateFraction(fb), fc]);
    const z = sumFractions([fa, fb, negateFraction(fc)]);
    if (!sum || !x || !y || !z || x.numerator <= 0 || y.numerator <= 0 || z.numerator <= 0 || sum.numerator <= 0) {
      const s = (a + b + c) / 2;
      const area = Math.sqrt(Math.max(0, s * (s - a) * (s - b) * (s - c)));
      return formatPreferredNumber((sideLength * area / s) / 2);
    }
    const sideSquared = multiplyFractions([side, side]);
    const product = multiplyFractions([sideSquared, x, y, z]);
    const denominator = multiplyFractionByInteger(sum, 16);
    const squared = divideFractions(product, denominator);
    const formatted = squared ? formatRootFraction(squared.numerator, squared.denominator) : null;
    if (formatted) return formatted;
    const s = (a + b + c) / 2;
    const area = Math.sqrt(Math.max(0, s * (s - a) * (s - b) * (s - c)));
    return formatPreferredNumber((sideLength * area / s) / 2);
  }

  function formatKnownRadianByCos(cosFraction) {
    if (!cosFraction) return null;
    const text = fractionToText(cosFraction);
    if (text === '1') return '0';
    if (text === '1/2') return 'π/3';
    if (text === '0') return 'π/2';
    if (text === '-1/2') return '2π/3';
    if (text === '-1') return 'π';
    return null;
  }

  function formatArccosFraction(cosFraction) {
    const known = formatKnownRadianByCos(cosFraction);
    if (known) return known;
    const text = fractionToText(cosFraction);
    return text ? 'arccos(' + text + ')' : null;
  }

  function computeTriangleFromSides(a, b, c) {
    if (a + b <= c || b + c <= a || c + a <= b) {
      throw new Error('入力条件が三角形の条件を満たしていません。');
    }
    const B = { x: 0, y: 0 };
    const C = { x: a, y: 0 };
    const x = (c * c + a * a - b * b) / (2 * a);
    const y = Math.sqrt(Math.max(0, c * c - x * x));
    const A = { x: x, y: y };
    const angleA = toDegrees(Math.acos((b * b + c * c - a * a) / (2 * b * c)));
    const angleB = toDegrees(Math.acos((a * a + c * c - b * b) / (2 * a * c)));
    const angleC = 180 - angleA - angleB;
    return { A: A, B: B, C: C, angleA: angleA, angleB: angleB, angleC: angleC };
  }

  function computeTriangleFromSAS(b, angleA, c) {
    if (!(angleA > 0 && angleA < 180)) {
      throw new Error('角 A には 0 より大きく 180 未満の数を入力してください。');
    }
    const rad = angleA * Math.PI / 180;
    const a = Math.sqrt((b * b) + (c * c) - (2 * b * c * Math.cos(rad)));
    return computeTriangleFromSides(a, b, c);
  }

  function computeTriangleFromASA(angleB, a, angleC) {
    if (!(angleB > 0 && angleC > 0 && angleB + angleC < 180)) {
      throw new Error('角 B と角 C は正で、和が 180 未満である必要があります。');
    }
    const angleA = 180 - angleB - angleC;
    const radA = angleA * Math.PI / 180;
    const radB = angleB * Math.PI / 180;
    const radC = angleC * Math.PI / 180;
    const b = a * Math.sin(radB) / Math.sin(radA);
    const c = a * Math.sin(radC) / Math.sin(radA);
    return computeTriangleFromSides(a, b, c);
  }

  function computeTriangleFromAAA(angleA, angleB, angleC, c) {
    if (!(angleA > 0 && angleB > 0 && angleC > 0)) {
      throw new Error('角 A、角 B、角 C には正の数を入力してください。');
    }
    if (Math.abs(angleA + angleB + angleC - 180) > 1e-6) {
      throw new Error('角 A + 角 B + 角 C が 180 になるように入力してください。');
    }
    const radA = angleA * Math.PI / 180;
    const radB = angleB * Math.PI / 180;
    const radC = angleC * Math.PI / 180;
    const a = c * Math.sin(radA) / Math.sin(radC);
    const b = c * Math.sin(radB) / Math.sin(radC);
    return computeTriangleFromSides(a, b, c);
  }

  function computeTriangleFromAAS(angleA, angleB, a) {
    if (!(angleA > 0 && angleB > 0 && angleA + angleB < 180)) {
      throw new Error('角 A と角 B は正で、和が 180 未満である必要があります。');
    }
    const angleC = 180 - angleA - angleB;
    const radA = angleA * Math.PI / 180;
    const radB = angleB * Math.PI / 180;
    const radC = angleC * Math.PI / 180;
    const b = a * Math.sin(radB) / Math.sin(radA);
    const c = a * Math.sin(radC) / Math.sin(radA);
    return computeTriangleFromSides(a, b, c);
  }

  function createSvg(tag, attrs) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (attrs[key] !== null && attrs[key] !== undefined) {
        node.setAttribute(key, String(attrs[key]));
      }
    });
    return node;
  }

  function fitStageViewBox(stage) {
    const nodes = Array.from(stage.querySelectorAll('path,line,polyline,polygon,rect,circle,ellipse,text'));
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    nodes.forEach(function (node) {
      if (node.getAttribute('data-debug-hit') === 'true') return;
      const stroke = String(node.getAttribute('stroke') || '').trim();
      const fill = String(node.getAttribute('fill') || '').trim();
      const opacity = String(node.getAttribute('opacity') || '').trim();
      const fillOpacity = String(node.getAttribute('fill-opacity') || '').trim();
      const strokeOpacity = String(node.getAttribute('stroke-opacity') || '').trim();
      if (stroke === 'transparent' || fill === 'transparent' || opacity === '0' || (fillOpacity === '0' && strokeOpacity === '0')) return;
      if ((fill === 'none' || fill === '') && (stroke === 'none' || stroke === '') && node.tagName.toLowerCase() !== 'text') return;
      let box;
      try {
        box = node.getBBox();
      } catch (error) {
        return;
      }
      if (!Number.isFinite(box.x) || !Number.isFinite(box.y)) return;
      minX = Math.min(minX, box.x);
      minY = Math.min(minY, box.y);
      maxX = Math.max(maxX, box.x + box.width);
      maxY = Math.max(maxY, box.y + box.height);
    });
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      stage.setAttribute('viewBox', '0 0 1000 1000');
      return;
    }
    const pad = 58;
    const x = minX - pad;
    const y = minY - pad;
    const width = Math.max(1, maxX - minX + pad * 2);
    const height = Math.max(1, maxY - minY + pad * 2);
    stage.setAttribute('viewBox', [
      Math.round(x * 1000) / 1000,
      Math.round(y * 1000) / 1000,
      Math.round(width * 1000) / 1000,
      Math.round(height * 1000) / 1000
    ].join(' '));
  }

  function midpoint(P, Q) {
    return { x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 };
  }

  function centroid(triangle) {
    return {
      x: (triangle.A.x + triangle.B.x + triangle.C.x) / 3,
      y: (triangle.A.y + triangle.B.y + triangle.C.y) / 3
    };
  }

  function circumcenter(triangle) {
    const A = triangle.A;
    const B = triangle.B;
    const C = triangle.C;
    const d = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
    if (Math.abs(d) < 1e-12) {
      throw new Error('中心を計算できません。三角形の条件を確認してください。');
    }
    const a2 = A.x * A.x + A.y * A.y;
    const b2 = B.x * B.x + B.y * B.y;
    const c2 = C.x * C.x + C.y * C.y;
    return {
      x: (a2 * (B.y - C.y) + b2 * (C.y - A.y) + c2 * (A.y - B.y)) / d,
      y: (a2 * (C.x - B.x) + b2 * (A.x - C.x) + c2 * (B.x - A.x)) / d
    };
  }

  function incenter(triangle) {
    const a = Math.hypot(triangle.B.x - triangle.C.x, triangle.B.y - triangle.C.y);
    const b = Math.hypot(triangle.C.x - triangle.A.x, triangle.C.y - triangle.A.y);
    const c = Math.hypot(triangle.A.x - triangle.B.x, triangle.A.y - triangle.B.y);
    const sum = a + b + c;
    return {
      x: (a * triangle.A.x + b * triangle.B.x + c * triangle.C.x) / sum,
      y: (a * triangle.A.y + b * triangle.B.y + c * triangle.C.y) / sum
    };
  }

  function orthocenter(triangle) {
    const O = circumcenter(triangle);
    return {
      x: triangle.A.x + triangle.B.x + triangle.C.x - 2 * O.x,
      y: triangle.A.y + triangle.B.y + triangle.C.y - 2 * O.y
    };
  }

  function triangleCenterPoint(triangle, type) {
    if (type === 'circumcenter') return circumcenter(triangle);
    if (type === 'incenter') return incenter(triangle);
    if (type === 'centroid') return centroid(triangle);
    if (type === 'orthocenter') return orthocenter(triangle);
    return null;
  }

  function distancePointToLine(point, P, Q) {
    const dx = Q.x - P.x;
    const dy = Q.y - P.y;
    const len = Math.hypot(dx, dy) || 1;
    return Math.abs((dy * point.x) - (dx * point.y) + (Q.x * P.y) - (Q.y * P.x)) / len;
  }

  function centerCircleGeometry(triangle, type, centerPoint) {
    if (type === 'circumcenter') {
      return {
        center: centerPoint,
        radius: Math.hypot(centerPoint.x - triangle.A.x, centerPoint.y - triangle.A.y)
      };
    }
    if (type === 'incenter') {
      return {
        center: centerPoint,
        radius: distancePointToLine(centerPoint, triangle.B, triangle.C)
      };
    }
    return null;
  }

  function circleCardinalPoints(circle) {
    if (!circle || !(circle.radius > 0)) return [];
    return [
      { x: circle.center.x - circle.radius, y: circle.center.y },
      { x: circle.center.x + circle.radius, y: circle.center.y },
      { x: circle.center.x, y: circle.center.y - circle.radius },
      { x: circle.center.x, y: circle.center.y + circle.radius }
    ];
  }

  function fitPoint(point, box) {
    const scale = box.scale;
    return {
      x: box.left + (point.x - box.minX) * scale,
      y: box.bottom - (point.y - box.minY) * scale
    };
  }

  function computeViewport(triangle, extraPoints) {
    const width = 1000;
    const height = 1000;
    const paddingX = 120;
    const paddingTop = 285;
    const paddingBottom = 125;
    const points = [triangle.A, triangle.B, triangle.C].concat(extraPoints || []);
    const xs = points.map(function (point) { return point.x; });
    const ys = points.map(function (point) { return point.y; });
    const minX = Math.min.apply(null, xs);
    const maxX = Math.max.apply(null, xs);
    const minY = Math.min.apply(null, ys);
    const maxY = Math.max.apply(null, ys);
    const contentWidth = Math.max(1, maxX - minX);
    const contentHeight = Math.max(1, maxY - minY);
    const availableWidth = width - paddingX * 2;
    const availableHeight = height - paddingTop - paddingBottom;
    const scale = Math.min(availableWidth / contentWidth, availableHeight / contentHeight);
    const drawWidth = contentWidth * scale;
    const drawHeight = contentHeight * scale;
    return {
      minX: minX,
      minY: minY,
      scale: scale,
      left: paddingX + (availableWidth - drawWidth) / 2,
      bottom: height - paddingBottom - (availableHeight - drawHeight) / 2
    };
  }

  function interiorLabel(vertex, center, rate) {
    return {
      x: vertex.x + (center.x - vertex.x) * rate,
      y: vertex.y + (center.y - vertex.y) * rate
    };
  }

  function normalOffset(P, Q, toward, distance) {
    const m = midpoint(P, Q);
    const dx = Q.x - P.x;
    const dy = Q.y - P.y;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    const toTowardX = toward.x - m.x;
    const toTowardY = toward.y - m.y;
    if (nx * toTowardX + ny * toTowardY > 0) {
      nx *= -1;
      ny *= -1;
    }
    return { x: m.x + nx * distance, y: m.y + ny * distance };
  }

  function screenNormalOffset(P, Q, toward, distance) {
    const m = midpoint(P, Q);
    const dx = Q.x - P.x;
    const dy = Q.y - P.y;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    const toTowardX = toward.x - m.x;
    const toTowardY = toward.y - m.y;
    if (nx * toTowardX + ny * toTowardY > 0) {
      nx *= -1;
      ny *= -1;
    }
    return { x: m.x + nx * distance, y: m.y + ny * distance };
  }

  function arcPoints(vertex, p1, p2, radius) {
    const a1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
    const a2 = Math.atan2(p2.y - vertex.y, p2.x - vertex.x);
    let delta = a2 - a1;
    while (delta <= -Math.PI) delta += Math.PI * 2;
    while (delta > Math.PI) delta -= Math.PI * 2;
    const steps = 24;
    const points = [];
    for (let i = 0; i <= steps; i += 1) {
      const angle = a1 + delta * (i / steps);
      points.push({
        x: vertex.x + radius * Math.cos(angle),
        y: vertex.y + radius * Math.sin(angle)
      });
    }
    return points;
  }

  function resolvePageAngleArcRadius(config, extraAngles) {
    if (Number.isFinite(config.pageAngleArcRadius)) return config.pageAngleArcRadius;
    if (Number.isFinite(config.baseAngleArcRadius)) return config.baseAngleArcRadius;
    if (config.baseAngleArcRadii) {
      const baseIds = ['A', 'B', 'C'];
      for (let i = 0; i < baseIds.length; i += 1) {
        const radius = config.baseAngleArcRadii[baseIds[i]];
        if (Number.isFinite(radius)) return radius;
      }
    }
    for (let i = 0; i < extraAngles.length; i += 1) {
      if (Number.isFinite(extraAngles[i].arcRadius)) return extraAngles[i].arcRadius;
    }
    return 0.52;
  }

  function pathFromPoints(points) {
    if (!points.length) return '';
    return points.map(function (p, index) {
      return (index === 0 ? 'M ' : 'L ') + p.x + ' ' + p.y;
    }).join(' ');
  }

  function quadraticPoint(P, control, Q, t) {
    return {
      x: (1 - t) * (1 - t) * P.x + 2 * (1 - t) * t * control.x + t * t * Q.x,
      y: (1 - t) * (1 - t) * P.y + 2 * (1 - t) * t * control.y + t * t * Q.y
    };
  }

  function sideArcGeometry(P, Q, center, labelPoint, labelWidth) {
    const mx = (P.x + Q.x) / 2;
    const my = (P.y + Q.y) / 2;
    const dx = Q.x - P.x;
    const dy = Q.y - P.y;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    const toCenterX = center.x - mx;
    const toCenterY = center.y - my;
    if (nx * toCenterX + ny * toCenterY > 0) {
      nx *= -1;
      ny *= -1;
    }
    const arcHeight = Math.max(26, len * 0.13);
    const defaultCenter = { x: mx + nx * arcHeight, y: my + ny * arcHeight };
    const desired = labelPoint || defaultCenter;
    const control = {
      x: desired.x * 2 - mx,
      y: desired.y * 2 - my
    };
    const gapFromLabel = labelWidth && len
      ? Math.min(0.42, Math.max(0.14, (labelWidth / len) * 0.62))
      : 0.14;
    return {
      control: control,
      gapHalf: gapFromLabel
    };
  }

  function insetSegment(P, Q, inset) {
    const dx = Q.x - P.x;
    const dy = Q.y - P.y;
    const length = Math.hypot(dx, dy);
    if (!Number.isFinite(length) || length <= 0) {
      return { p1: P, p2: Q };
    }
    const safeInset = Math.min(inset, length * 0.32);
    if (length <= safeInset * 2) {
      const mid = midpoint(P, Q);
      return { p1: mid, p2: mid };
    }
    const ux = dx / length;
    const uy = dy / length;
    return {
      p1: { x: P.x + ux * safeInset, y: P.y + uy * safeInset },
      p2: { x: Q.x - ux * safeInset, y: Q.y - uy * safeInset }
    };
  }

  function insetSegmentByEnds(P, Q, startInset, endInset) {
    const dx = Q.x - P.x;
    const dy = Q.y - P.y;
    const length = Math.hypot(dx, dy);
    if (!Number.isFinite(length) || length <= 0) {
      return { p1: P, p2: Q };
    }
    const safeStart = Math.min(Math.max(0, startInset || 0), length * 0.46);
    const safeEnd = Math.min(Math.max(0, endInset || 0), length * 0.46);
    if (length <= safeStart + safeEnd) {
      const mid = midpoint(P, Q);
      return { p1: mid, p2: mid };
    }
    const ux = dx / length;
    const uy = dy / length;
    return {
      p1: { x: P.x + ux * safeStart, y: P.y + uy * safeStart },
      p2: { x: Q.x - ux * safeEnd, y: Q.y - uy * safeEnd }
    };
  }

  function quadraticPathSegment(P, control, Q, start, end, steps) {
    const points = [];
    const count = steps || 24;
    for (let i = 0; i <= count; i += 1) {
      const t = start + (end - start) * (i / count);
      points.push(quadraticPoint(P, control, Q, t));
    }
    return pathFromPoints(points);
  }

  function sectorPath(vertex, arcPointsList) {
    if (!arcPointsList.length) return '';
    const parts = ['M ' + vertex.x + ' ' + vertex.y];
    arcPointsList.forEach(function (p) {
      parts.push('L ' + p.x + ' ' + p.y);
    });
    parts.push('Z');
    return parts.join(' ');
  }

  function angleHitRadiusFor(arcRadius) {
    return Math.max(0.42, Math.min(1.12, arcRadius * 1.75));
  }

  function drawSideKind(stage, kind, P, Q, color) {
    if (!kind || kind === 'plain') return;
    if (window.InstantGeometryMobileAngleOrnaments && window.InstantGeometryMobileAngleOrnaments.drawSegmentKind(stage, kind, P, Q, createSvg, { color: color || '#2a5bd7' })) return;
    const mid = midpoint(P, Q);
    const dx = Q.x - P.x;
    const dy = Q.y - P.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const tx = dx / len;
    const ty = dy / len;
    const stroke = color || '#2a5bd7';
    const addLine = function (cx, cy, half) {
      stage.appendChild(createSvg('line', {
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
      stage.appendChild(createSvg('circle', {
        cx: mid.x,
        cy: mid.y,
        r: 8,
        fill: 'none',
        stroke: stroke,
        'stroke-width': 3
      }));
    } else if (kind === 'single') {
      addLine(mid.x, mid.y, 12);
    } else if (kind === 'double') {
      addLine(mid.x - tx * 9, mid.y - ty * 9, 12);
      addLine(mid.x + tx * 9, mid.y + ty * 9, 12);
    } else if (kind === 'cross') {
      addLine(mid.x, mid.y, 12);
      stage.appendChild(createSvg('line', {
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
      stage.appendChild(createSvg('polygon', {
        points: [p1, p2, p3].map(function (p) { return p.x + ',' + p.y; }).join(' '),
        fill: stroke,
        stroke: stroke,
        'stroke-width': 1.5
      }));
    }
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

  function clampMathLabelScale(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 1;
    return Math.max(0.1, Math.min(4, number));
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

  function normalizeFreeLabel(value) {
    return String(value || '');
  }

  const RATIO_LABEL_PREFIX = 'ratio:';
  const RAW_NUMERIC_LABEL_VALUE = 'raw:';
  const DECIMAL_NUMERIC_LABEL_VALUE = 'decimal:';

  function parseRatioLabelInput(value) {
    const text = String(value || '').trim();
    const parts = text.split(/[,:：]/);
    if (parts.length !== 2) return null;
    const mark = parts[0].trim().toLowerCase();
    const labelValue = parts[1].trim();
    if (!/^[rts]$/.test(mark)) return null;
    if (!labelValue) return null;
    return { mark: mark, value: labelValue, source: mark + ',' + labelValue };
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

  function buildLabelEditor(labelText, value, hasNumericMode) {
    const field = document.createElement('div');
    field.className = 'sheet-field';
    const label = document.createElement('label');
    label.textContent = labelText;
    const mode = document.createElement('select');
    [
      { value: 'hidden', label: '非表示' },
      hasNumericMode ? { value: 'numeric', label: '数値（自動）' } : null,
      hasNumericMode ? { value: 'numericDecimal', label: '数値（小数）' } : null,
      hasNumericMode ? { value: 'ratio', label: '比の値' } : null,
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
    input.value = getDisplayMode(value, hasNumericMode) === 'text'
      ? normalizeFreeLabel(value)
      : getRatioLabelInput(value);
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
      function sync() {
        button.classList.toggle('is-selected', selected.toLowerCase() === entry[1].toLowerCase());
      }
      button.addEventListener('click', function () {
        selected = entry[1];
        Array.from(picker.children).forEach(function (child) {
          child.classList.toggle('is-selected', child.dataset.color.toLowerCase() === selected.toLowerCase());
        });
      });
      picker.appendChild(button);
      sync();
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

  function createPage(config) {
    const stage = document.getElementById('stage');
    const statusBox = document.getElementById('statusBox');
    const backBtn = document.getElementById('backBtn');
    const saveBtn = document.getElementById('saveBtn');
    const sheetBackdrop = document.getElementById('sheetBackdrop');
    const editSheet = document.getElementById('editSheet');
    const sheetTitle = document.getElementById('sheetTitle');
    const sheetBody = document.getElementById('sheetBody');
    const sheetClose = document.getElementById('sheetClose');
    const saveSheet = document.getElementById('saveSheet');
    const saveSheetClose = document.getElementById('saveSheetClose');
    const savePngBtn = document.getElementById('savePngBtn');
    const saveTransparentBtn = document.getElementById('saveTransparentBtn');
    const savePdfBtn = document.getElementById('savePdfBtn');
    const captureRoot = document.getElementById('captureRoot');
    const debugHitEnabled = new URLSearchParams(window.location.search).get('debugHit') === '1';
    const LabelEngine = window.InstantGeometryDrawLabelEngine || window.InstantGeometryTriangleLabelEngine || null;
    const katexLiveLayer = document.createElement('div');
    katexLiveLayer.className = 'triangle-katex-live-layer';
    katexLiveLayer.setAttribute('aria-hidden', 'true');
    if (captureRoot) captureRoot.appendChild(katexLiveLayer);
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

    const controlInputs = {};
    Object.keys(config.controlInputIds).forEach(function (key) {
      controlInputs[key] = document.getElementById(config.controlInputIds[key]);
    });

    const state = deepClone(config.initialState);
    const labelMoveEnabled = config.enableLabelMoveMode !== false;
    state.areaValue = state.areaValue !== undefined ? state.areaValue : (state.areaInput || '');
    state.areaColor = state.areaColor || '#2a5bd7';
    state.extraAngleInputs = state.extraAngleInputs || {};
    state.extraAngleKinds = state.extraAngleKinds || {};
    state.extraAreaInputs = state.extraAreaInputs || {};
    state.extraAreaColors = state.extraAreaColors || {};
    state.pointColors = state.pointColors || {};
    state.sideColors = state.sideColors || {};
    state.angleColors = state.angleColors || {};
    state.extraAngleColors = state.extraAngleColors || {};
    state.centerLineColors = state.centerLineColors || {};
    state.extraSegmentColors = state.extraSegmentColors || {};
    state.angleArcScales = state.angleArcScales || {};
    state.extraAngleArcScales = state.extraAngleArcScales || {};
    state.extraSegmentInputs = state.extraSegmentInputs || {};
    state.extraSegmentKinds = state.extraSegmentKinds || {};
    state.extraSegmentArcVisible = state.extraSegmentArcVisible || {};
    state.decimalPlaces = clampDecimalPlaces(state.decimalPlaces);
    state.mathLabelScale = clampMathLabelScale(state.mathLabelScale);
    state.mathLabelScales = state.mathLabelScales || {};
    setActiveDecimalPlaces(state.decimalPlaces);
    if (config.centerType && !state.centerLineInputs) {
      state.centerLineInputs = { A: '', B: '', C: '' };
    }
    if (config.centerType && !state.centerLineKinds) {
      state.centerLineKinds = { A: 'plain', B: 'plain', C: 'plain' };
    }
    if (config.centerType && !state.centerLineArcVisible) {
      state.centerLineArcVisible = { A: false, B: false, C: false };
    }
    state.rawControlInputs = {};

    let geometry = null;
    let activeSheet = null;
    let moveMode = null;
    let moveDrag = null;
    let currentLabelBases = {};
    let pendingKatexLabels = [];
    let labelController = null;

    if (!state.labelOffsets) state.labelOffsets = {};

    function getMathLabelScale(kind, id) {
      const group = state.mathLabelScales && state.mathLabelScales[kind];
      if (group && group[id] !== undefined) return clampMathLabelScale(group[id]);
      return clampMathLabelScale(state.mathLabelScale);
    }

    function setMathLabelScale(kind, id, value) {
      if (!state.mathLabelScales[kind]) state.mathLabelScales[kind] = {};
      state.mathLabelScales[kind][id] = clampMathLabelScale(value);
    }

    function clampAngleArcScale(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) return 1;
      return Math.max(0.3, Math.min(3, number));
    }

    function getAngleArcScale(kind, id) {
      const group = kind === 'extraAngle' ? state.extraAngleArcScales : state.angleArcScales;
      return group && group[id] !== undefined ? clampAngleArcScale(group[id]) : 1;
    }

    function setAngleArcScale(kind, id, value) {
      const group = kind === 'extraAngle' ? state.extraAngleArcScales : state.angleArcScales;
      group[id] = clampAngleArcScale(value);
    }

    function getPointColor(id, fallback) {
      return state.pointColors[id] || fallback || '#1f2430';
    }

    function getSideColor(id, fallback) {
      return state.sideColors[id] || fallback || '#2a5bd7';
    }

    function getAngleColor(kind, id, fallback) {
      const group = kind === 'extraAngle' ? state.extraAngleColors : state.angleColors;
      return group[id] || fallback || '#687086';
    }

    function getSegmentColor(kind, id, fallback) {
      if (kind === 'centerLine') return state.centerLineColors[id] || fallback || '#25603b';
      return state.extraSegmentColors[id] || fallback || '#25603b';
    }

    function labelKey(kind, id) {
      return kind + ':' + id;
    }

    function ensureLabelOffset(kind, id) {
      if (!state.labelOffsets[kind]) state.labelOffsets[kind] = {};
      if (!state.labelOffsets[kind][id]) state.labelOffsets[kind][id] = { x: 0, y: 0 };
      return state.labelOffsets[kind][id];
    }

    function getLabelOffset(kind, id) {
      return state.labelOffsets[kind] && state.labelOffsets[kind][id]
        ? state.labelOffsets[kind][id]
        : { x: 0, y: 0 };
    }

    function getLabelPosition(kind, id, basePosition) {
      currentLabelBases[labelKey(kind, id)] = { x: basePosition.x, y: basePosition.y };
      const offset = getLabelOffset(kind, id);
      return { x: basePosition.x + offset.x, y: basePosition.y + offset.y };
    }

    function isMoveTarget(kind, id) {
      return moveMode && moveMode.kind === kind && moveMode.payload && moveMode.payload.id === id;
    }

    function updateMoveModeUi() {
      const active = Boolean(moveMode);
      document.body.classList.toggle('label-move-active', active);
      captureRoot.classList.toggle('label-move-active', active);
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

    function startLabelMoveDrag(kind, id, event) {
      if (!isMoveTarget(kind, id)) return;
      event.preventDefault();
      event.stopPropagation();
      const startPoint = pointerToSvgPoint(event);
      const offset = ensureLabelOffset(kind, id);
      moveDrag = {
        kind: kind,
        id: id,
        startPoint: startPoint,
        startOffset: { x: offset.x, y: offset.y }
      };
    }

    function wireLabelNodeInteractions(node, kind, id) {
      node.dataset.labelTarget = 'true';
      node.dataset.kind = kind;
      node.dataset.id = id;
      if (isMoveTarget(kind, id)) {
        node.classList.add('label-move-target');
      }
      node.addEventListener('click', function (event) {
        event.stopPropagation();
        if (moveMode) return;
        openSheet(kind, { id: id });
      });
      node.addEventListener('pointerdown', function (event) {
        startLabelMoveDrag(kind, id, event);
      });
    }

    function setStatus(message, isError) {
      statusBox.textContent = message;
      statusBox.classList.toggle('error', Boolean(isError));
    }

    if (window.InstantGeometrySaveQuota) {
      window.InstantGeometrySaveQuota.createIndicator({ target: saveBtn });
    }

    function getPointName(id) {
      const raw = String(state.pointInputs[id] || '').trim();
      return raw || id;
    }

    function getSideName(id) {
      if (id === 'a') return getPointName('B') + getPointName('C');
      if (id === 'b') return getPointName('C') + getPointName('A');
      if (id === 'CH') return getPointName('C') + getPointName('H');
      if (id === 'AH') return getPointName('A') + getPointName('H');
      return getPointName('A') + getPointName('B');
    }

    function syncControlLabels() {
      ['a', 'b', 'c'].forEach(function (id) {
        const input = controlInputs[id];
        if (!input) return;
        const field = input.closest && input.closest('.field');
        const label = field && field.querySelector('.field-label');
        if (!label) return;
        label.textContent = '辺 ' + id + '（' + getSideName(id) + '）';
      });
    }

    function getAngleName(id) {
      if (config.angleNames && config.angleNames[id]) return config.angleNames[id];
      const extra = config.extraAngles && geometry
        ? config.extraAngles({ state: state, geometry: geometry }).find(function (angle) { return angle.id === id; })
        : null;
      if (extra && extra.name) return extra.name;
      if (id === 'A') return '∠' + getPointName('B') + getPointName('A') + getPointName('C');
      if (id === 'B') return '∠' + getPointName('C') + getPointName('B') + getPointName('A');
      return '∠' + getPointName('A') + getPointName('C') + getPointName('B');
    }

    function isBaseAngleHitEnabled(id) {
      if (!config.disabledBaseAngleHits) return true;
      if (Array.isArray(config.disabledBaseAngleHits)) {
        return config.disabledBaseAngleHits.indexOf(id) === -1;
      }
      if (typeof config.disabledBaseAngleHits === 'function') {
        return !config.disabledBaseAngleHits(id, { state: state, geometry: geometry });
      }
      return true;
    }

    function isBaseSideHitEnabled(id) {
      if (!config.disabledBaseSideHits) return true;
      if (Array.isArray(config.disabledBaseSideHits)) {
        return config.disabledBaseSideHits.indexOf(id) === -1;
      }
      if (typeof config.disabledBaseSideHits === 'function') {
        return !config.disabledBaseSideHits(id, { state: state, geometry: geometry });
      }
      return true;
    }

    function getAreaName() {
      return '△' + getPointName('A') + getPointName('B') + getPointName('C');
    }

    function getExtraAreaName(id) {
      const area = config.extraAreas && geometry
        ? config.extraAreas({ state: state, geometry: geometry }).find(function (item) { return item.id === id; })
        : null;
      if (area && area.name) return area.name;
      return '面積';
    }

    function getCenterName() {
      const id = config.centerLabel || 'O';
      const raw = state.pointInputs && String(state.pointInputs[id] || '').trim();
      return raw || id;
    }

    function getCenterLineName(id) {
      return getCenterName() + getPointName(id);
    }

    function getExtraSegmentName(id) {
      const segment = config.extraSegments && geometry
        ? config.extraSegments({ state: state, geometry: geometry }).find(function (item) { return item.id === id; })
        : null;
      if (segment && segment.name) return segment.name;
      return '線分';
    }

    function getPointLabelValue(id) {
      const raw = String(state.pointInputs[id] || '').trim();
      return raw || null;
    }

    function applyDrawSettingFormat(label, kind) {
      if (!label || isRatioLabelValue(label)) return label;
      const formatter = window.InstantGeometryDrawSettings;
      if (!formatter) return label;
      if (kind === 'angle' && typeof formatter.formatAngle === 'function') return formatter.formatAngle(label);
      if ((kind === 'side' || kind === 'segment') && typeof formatter.formatLength === 'function') return formatter.formatLength(label);
      if (kind === 'area' && typeof formatter.formatArea === 'function') return formatter.formatArea(label);
      return label;
    }

    function parseSimpleRootTerm(label) {
      const text = String(label || '').trim().replace(/\s+/g, '').replace(/sqrt/ig, '√').replace(/[()]/g, '');
      let match = /^(\d+)?√(\d+)(?:\/(\d+))?$/.exec(text);
      if (match) {
        return {
          numerator: Number(match[1] || 1),
          denominator: Number(match[3] || 1),
          radicand: Number(match[2])
        };
      }
      match = /^(\d+)\/(\d+)$/.exec(text);
      if (match) {
        return { numerator: Number(match[1]), denominator: Number(match[2]), radicand: 1 };
      }
      const exact = decimalToFraction(Number(text));
      if (exact) return { numerator: exact.numerator, denominator: exact.denominator, radicand: 1 };
      return null;
    }

    function formatRootProductHalf(labelA, labelB) {
      const first = parseSimpleRootTerm(labelA);
      const second = parseSimpleRootTerm(labelB);
      if (!first || !second) return null;
      let numerator = first.numerator * second.numerator;
      let denominator = first.denominator * second.denominator * 2;
      let radicand = first.radicand * second.radicand;
      let outside = 1;
      for (let factor = 2; factor * factor <= radicand; factor += 1) {
        const square = factor * factor;
        while (radicand % square === 0) {
          outside *= factor;
          radicand /= square;
        }
      }
      numerator *= outside;
      const divisor = gcd(Math.abs(numerator), Math.abs(denominator));
      numerator /= divisor;
      denominator /= divisor;
      if (radicand === 1) return denominator === 1 ? String(numerator) : numerator + '/' + denominator;
      const root = (numerator === 1 ? '' : String(numerator)) + '√' + radicand;
      return denominator === 1 ? root : root + '/' + denominator;
    }

    function getSideExactLabelForArea(id) {
      const rawInput = state.rawControlInputs && state.rawControlInputs[id];
      const autoInputLabel = formatAutoInputLabel(rawInput);
      if (autoInputLabel) return autoInputLabel;
      const raw = String(state.sideInputs[id] || '');
      if (isRawNumericLabelValue(raw) && rawInput) return formatAutoInputLabel(rawInput) || rawInput;
      if (isAnyNumericLabelValue(raw)) {
        const visible = getSideLabelValue(id);
        if (visible) return String(visible).replace(/(km²|cm²|m²|km|cm|m)$/g, '');
      }
      return state.sideDisplay && state.sideDisplay[id] ? state.sideDisplay[id] : formatPreferredNumber(state.sides[id]);
    }

    function formatRightAngleAreaLabel() {
      const legA = getSideExactLabelForArea('a');
      const legC = getSideExactLabelForArea('c');
      return formatRootProductHalf(legA, legC);
    }

    function getExactCosForAngle(id) {
      if (!state.sides) return null;
      const a2 = squareFraction(state.sides.a);
      const b2 = squareFraction(state.sides.b);
      const c2 = squareFraction(state.sides.c);
      const a = decimalToFraction(state.sides.a);
      const b = decimalToFraction(state.sides.b);
      const c = decimalToFraction(state.sides.c);
      if (!a2 || !b2 || !c2 || !a || !b || !c) return null;
      let numerator = null;
      let denominator = null;
      if (id === 'A') {
        numerator = sumFractions([b2, c2, negateFraction(a2)]);
        denominator = multiplyFractions([{ numerator: 2, denominator: 1 }, b, c]);
      } else if (id === 'B') {
        numerator = sumFractions([a2, c2, negateFraction(b2)]);
        denominator = multiplyFractions([{ numerator: 2, denominator: 1 }, a, c]);
      } else if (id === 'C') {
        numerator = sumFractions([a2, b2, negateFraction(c2)]);
        denominator = multiplyFractions([{ numerator: 2, denominator: 1 }, a, b]);
      }
      if (!numerator || !denominator || denominator.numerator === 0) return null;
      return divideFractions(numerator, denominator);
    }

    function getAutoAngleLabelValue(id) {
      const settings = window.InstantGeometryDrawSettings && typeof window.InstantGeometryDrawSettings.get === 'function'
        ? window.InstantGeometryDrawSettings.get()
        : null;
      if (settings && settings.angleUnit === 'radians') {
        const exact = formatArccosFraction(getExactCosForAngle(id));
        if (exact) return exact;
      }
      return applyDrawSettingFormat(formatNumber(geometry['angle' + id]) + '°', 'angle');
    }

    function getSideLabelValue(id) {
      const raw = String(state.sideInputs[id] || '');
      if (!raw) return null;
      if (isRatioLabelValue(raw)) return raw;
      if (isRawNumericLabelValue(raw)) {
        const controlText = state.rawControlInputs && state.rawControlInputs[id];
        if (controlText) return applyDrawSettingFormat(controlText, 'side');
      }
      if (isDecimalNumericLabelValue(raw)) {
        return applyDrawSettingFormat(formatNumber(state.sides[id]), 'side');
      }
      if (isAnyNumericLabelValue(raw)) {
        const controlText = state.rawControlInputs && state.rawControlInputs[id];
        const autoInputLabel = formatAutoInputLabel(controlText);
        if (autoInputLabel) return applyDrawSettingFormat(autoInputLabel, 'side');
        if (state.sideDisplay && state.sideDisplay[id]) return applyDrawSettingFormat(state.sideDisplay[id], 'side');
        return applyDrawSettingFormat(formatPreferredNumber(state.sides[id]), 'side');
      }
      return raw;
    }

    function getAngleLabelValue(id) {
      const raw = String(state.angleInputs[id] || '');
      if (!raw) return null;
      if (isRatioLabelValue(raw)) return raw;
      if (isRawNumericLabelValue(raw)) {
        const controlText = state.rawControlInputs && state.rawControlInputs[id];
        if (controlText) return applyDrawSettingFormat(controlText + '°', 'angle');
      }
      if (isDecimalNumericLabelValue(raw) && geometry) {
        return applyDrawSettingFormat(formatNumber(geometry['angle' + id]) + '°', 'angle');
      }
      if (isAnyNumericLabelValue(raw) && geometry) {
        return getAutoAngleLabelValue(id);
      }
      return raw;
    }

    function getExtraAngleLabelValue(angle) {
      const raw = String(state.extraAngleInputs[angle.id] || '');
      if (!raw) return null;
      if (isRatioLabelValue(raw)) return raw;
      if (isRawNumericLabelValue(raw)) {
        const controlText = state.rawControlInputs && state.rawControlInputs[angle.id];
        if (controlText) return applyDrawSettingFormat(controlText + '°', 'angle');
      }
      if (isDecimalNumericLabelValue(raw)) {
        return applyDrawSettingFormat(formatNumber(angle.value) + '°', 'angle');
      }
      if (isAnyNumericLabelValue(raw)) {
        return applyDrawSettingFormat(formatNumber(angle.value) + '°', 'angle');
      }
      return raw;
    }

    function getAreaLabelValue() {
      const raw = String(state.areaValue || '');
      if (!raw) return null;
      if (isRatioLabelValue(raw)) return raw;
      if (isDecimalNumericLabelValue(raw)) {
        const s = (state.sides.a + state.sides.b + state.sides.c) / 2;
        const decimalArea = Math.sqrt(Math.max(0, s * (s - state.sides.a) * (s - state.sides.b) * (s - state.sides.c)));
        if (config.formatAreaLabel) return applyDrawSettingFormat(config.formatAreaLabel(state, geometry, {
          formatArea: function () { return formatNumber(decimalArea); },
          formatHeronArea: function () { return formatNumber(decimalArea); },
          formatHeronAreaFromInputs: function () { return formatNumber(decimalArea); },
          formatPreferredNumber: formatNumber
        }), 'area');
        return applyDrawSettingFormat(formatNumber(decimalArea), 'area');
      }
      if (isAnyNumericLabelValue(raw)) {
        if (config.formatAreaLabel) return applyDrawSettingFormat(config.formatAreaLabel(state, geometry, {
          formatArea: formatArea,
          formatHeronArea: formatHeronArea,
          formatHeronAreaFromInputs: formatHeronAreaFromInputs,
          formatPreferredNumber: formatPreferredNumber
        }), 'area');
        return applyDrawSettingFormat(formatRightAngleAreaLabel() || formatArea(state.sides.a, state.sides.b, state.sides.c), 'area');
      }
      return raw;
    }

    function getExtraAreaLabelValue(area) {
      const raw = String(state.extraAreaInputs[area.id] || '');
      if (!raw) return null;
      if (isRatioLabelValue(raw)) return raw;
      if (isDecimalNumericLabelValue(raw)) {
        if (typeof area.value === 'function') {
          return applyDrawSettingFormat(area.value({
            geometry: geometry,
            pointTriangleArea: pointTriangleArea,
            formatPreferredNumber: formatNumber,
            formatIncenterSubArea: function (sideLength) {
              const s = (state.sides.a + state.sides.b + state.sides.c) / 2;
              const totalArea = Math.sqrt(Math.max(0, s * (s - state.sides.a) * (s - state.sides.b) * (s - state.sides.c)));
              return formatNumber((sideLength * totalArea / s) / 2);
            }
          }), 'area');
        }
        if (Number.isFinite(area.value)) return applyDrawSettingFormat(formatNumber(area.value), 'area');
        if (area.points && area.points.length === 3) {
          return applyDrawSettingFormat(formatNumber(pointTriangleArea(area.points[0], area.points[1], area.points[2])), 'area');
        }
      }
      if (isAnyNumericLabelValue(raw)) {
        if (typeof area.value === 'function') {
          return applyDrawSettingFormat(area.value({
            geometry: geometry,
            pointTriangleArea: pointTriangleArea,
            formatPreferredNumber: formatPreferredNumber,
            formatIncenterSubArea: function (sideLength) {
              return formatIncenterSubArea(sideLength, state.sides.a, state.sides.b, state.sides.c);
            }
          }), 'area');
        }
        if (Number.isFinite(area.value)) return applyDrawSettingFormat(formatPreferredNumber(area.value), 'area');
        if (area.points && area.points.length === 3) {
          return applyDrawSettingFormat(formatPreferredNumber(pointTriangleArea(area.points[0], area.points[1], area.points[2])), 'area');
        }
      }
      return raw;
    }

    function getCenterLineLabelValue(id, centerPoint) {
      const raw = String((state.centerLineInputs && state.centerLineInputs[id]) || '');
      if (!raw) return null;
      if (isRatioLabelValue(raw)) return raw;
      if (isRawNumericLabelValue(raw)) {
        const controlText = state.rawControlInputs && state.rawControlInputs[id];
        if (controlText) return applyDrawSettingFormat(controlText, 'segment');
      }
      if (isDecimalNumericLabelValue(raw) && geometry && centerPoint) {
        return applyDrawSettingFormat(formatNumber(Math.hypot(centerPoint.x - geometry[id].x, centerPoint.y - geometry[id].y)), 'segment');
      }
      if (isAnyNumericLabelValue(raw) && geometry && centerPoint) {
        return applyDrawSettingFormat(formatPreferredNumber(Math.hypot(centerPoint.x - geometry[id].x, centerPoint.y - geometry[id].y)), 'segment');
      }
      return raw;
    }

    function getExtraSegmentLabelValue(segment) {
      const raw = String(state.extraSegmentInputs[segment.id] || '');
      if (!raw) return null;
      if (isRatioLabelValue(raw)) return raw;
      if (isRawNumericLabelValue(raw)) {
        const controlText = state.rawControlInputs && state.rawControlInputs[segment.id];
        if (controlText) return applyDrawSettingFormat(controlText, 'segment');
      }
      if (isDecimalNumericLabelValue(raw)) {
        if (typeof segment.value === 'function') {
          return applyDrawSettingFormat(segment.value({
            geometry: geometry,
            formatPreferredNumber: formatNumber,
            formatHeronInradius: function () {
              const s = (state.sides.a + state.sides.b + state.sides.c) / 2;
              const area = Math.sqrt(Math.max(0, s * (s - state.sides.a) * (s - state.sides.b) * (s - state.sides.c)));
              return formatNumber(area / s);
            }
          }), 'segment');
        }
        if (Number.isFinite(segment.value)) return applyDrawSettingFormat(formatNumber(segment.value), 'segment');
        if (segment.p1 && segment.p2) {
          return applyDrawSettingFormat(formatNumber(Math.hypot(segment.p1.x - segment.p2.x, segment.p1.y - segment.p2.y)), 'segment');
        }
      }
      if (isAnyNumericLabelValue(raw)) {
        if (typeof segment.value === 'function') {
          return segment.value({
            geometry: geometry,
            formatPreferredNumber: formatPreferredNumber,
            formatHeronInradius: formatHeronInradius
          });
        }
        if (Number.isFinite(segment.value)) return applyDrawSettingFormat(formatPreferredNumber(segment.value), 'segment');
        if (segment.p1 && segment.p2) {
          return applyDrawSettingFormat(formatPreferredNumber(Math.hypot(segment.p1.x - segment.p2.x, segment.p1.y - segment.p2.y)), 'segment');
        }
      }
      return raw;
    }

    function closeSheets() {
      activeSheet = null;
      editSheet.classList.remove('open');
      editSheet.setAttribute('aria-hidden', 'true');
      saveSheet.classList.remove('open');
      saveSheet.setAttribute('aria-hidden', 'true');
      sheetBackdrop.classList.remove('open');
      sheetBody.innerHTML = '';
    }

    function finishMoveMode(restoreOffset) {
      if (!moveMode) return;
      const previous = moveMode;
      if (restoreOffset) {
        if (!state.labelOffsets[previous.kind]) state.labelOffsets[previous.kind] = {};
        state.labelOffsets[previous.kind][previous.payload.id] = previous.originalOffset;
      }
      moveMode = null;
      moveDrag = null;
      updateMoveModeUi();
      render();
      openSheet(previous.kind, previous.payload);
    }

    function enterMoveMode(kind, payload) {
      const key = labelKey(kind, payload.id);
      if (!currentLabelBases[key]) {
        setStatus('ラベルを表示してから移動してください。', true);
        openSheet(kind, payload);
        return;
      }
      const originalOffset = getLabelOffset(kind, payload.id);
      moveMode = {
        kind: kind,
        payload: { id: payload.id },
        originalOffset: { x: originalOffset.x, y: originalOffset.y }
      };
      closeSheets();
      updateMoveModeUi();
      render();
    }

    function getControllerLabelType(kind) {
      if (kind === 'side' || kind === 'centerLine' || kind === 'extraSegment') return 'segment';
      if (kind === 'angle' || kind === 'extraAngle') return 'angle';
      if (kind === 'area' || kind === 'extraArea') return 'area';
      return kind;
    }

    function getControllerTitle(kind, id) {
      if (kind === 'point') return getPointName(id);
      if (kind === 'side') return getSideName(id);
      if (kind === 'angle' || kind === 'extraAngle') return getAngleName(id);
      if (kind === 'centerLine') return getCenterLineName(id);
      if (kind === 'extraSegment') return getExtraSegmentName(id);
      if (kind === 'area') return getAreaName();
      if (kind === 'extraArea') return getExtraAreaName(id);
      return '設定';
    }

    function getControllerLabelValue(kind, id) {
      if (kind === 'point') return String(state.pointInputs[id] || '');
      if (kind === 'side') return String(state.sideInputs[id] || '');
      if (kind === 'angle') return String(state.angleInputs[id] || '');
      if (kind === 'extraAngle') return String(state.extraAngleInputs[id] || '');
      if (kind === 'centerLine') return String((state.centerLineInputs && state.centerLineInputs[id]) || '');
      if (kind === 'extraSegment') return String(state.extraSegmentInputs[id] || '');
      if (kind === 'area') return String(state.areaValue || '');
      if (kind === 'extraArea') return String(state.extraAreaInputs[id] || '');
      return '';
    }

    function setControllerLabelValue(kind, id, value) {
      const text = String(value || '');
      if (kind === 'point') state.pointInputs[id] = text;
      else if (kind === 'side') {
        state.sideInputs[id] = text;
        if (!text) state.sideArcVisible[id] = false;
      } else if (kind === 'angle') state.angleInputs[id] = text;
      else if (kind === 'extraAngle') state.extraAngleInputs[id] = text;
      else if (kind === 'centerLine') {
        if (!state.centerLineInputs) state.centerLineInputs = { A: '', B: '', C: '' };
        if (!state.centerLineArcVisible) state.centerLineArcVisible = { A: false, B: false, C: false };
        state.centerLineInputs[id] = text;
        if (!text) state.centerLineArcVisible[id] = false;
      } else if (kind === 'extraSegment') {
        state.extraSegmentInputs[id] = text;
        if (!text) state.extraSegmentArcVisible[id] = false;
      } else if (kind === 'area') state.areaValue = text;
      else if (kind === 'extraArea') state.extraAreaInputs[id] = text;
    }

    function getControllerColor(kind, id) {
      if (kind === 'point') return getPointColor(id);
      if (kind === 'side') return getSideColor(id);
      if (kind === 'angle' || kind === 'extraAngle') return getAngleColor(kind, id);
      if (kind === 'centerLine' || kind === 'extraSegment') return getSegmentColor(kind, id);
      if (kind === 'extraArea') return state.extraAreaColors[id] || state.areaColor || '#2a5bd7';
      if (kind === 'area') return state.areaColor || '#2a5bd7';
      return '#2a5bd7';
    }

    function setControllerColor(kind, id, value) {
      if (!value) return;
      if (kind === 'point') state.pointColors[id] = value;
      else if (kind === 'side') state.sideColors[id] = value;
      else if (kind === 'angle') state.angleColors[id] = value;
      else if (kind === 'extraAngle') state.extraAngleColors[id] = value;
      else if (kind === 'centerLine') state.centerLineColors[id] = value;
      else if (kind === 'extraSegment') state.extraSegmentColors[id] = value;
      else if (kind === 'area') state.areaColor = value;
      else if (kind === 'extraArea') state.extraAreaColors[id] = value;
    }

    function getControllerLabelScale(kind, id) {
      return getMathLabelScale(kind, kind === 'area' ? 'main' : id);
    }

    function setControllerLabelScale(kind, id, value) {
      setMathLabelScale(kind, kind === 'area' ? 'main' : id, value);
    }

    function getControllerGuideVisible(kind, id) {
      if (kind === 'side') return state.sideArcVisible[id] !== false;
      if (kind === 'centerLine') return state.centerLineArcVisible && state.centerLineArcVisible[id] === true;
      if (kind === 'extraSegment') return state.extraSegmentArcVisible[id] === true;
      return false;
    }

    function setControllerGuideVisible(kind, id, value) {
      if (kind === 'side') state.sideArcVisible[id] = value;
      else if (kind === 'centerLine') {
        if (!state.centerLineArcVisible) state.centerLineArcVisible = { A: false, B: false, C: false };
        state.centerLineArcVisible[id] = value;
      } else if (kind === 'extraSegment') state.extraSegmentArcVisible[id] = value;
    }

    function getControllerSegmentKind(kind, id) {
      if (kind === 'side') return state.sideKinds[id] || 'plain';
      if (kind === 'centerLine') return (state.centerLineKinds && state.centerLineKinds[id]) || 'plain';
      if (kind === 'extraSegment') return state.extraSegmentKinds[id] || 'plain';
      return 'plain';
    }

    function buildControllerSegmentKindSelect(kind, id, buildSelectFn) {
      return buildSelectFn('線分マーク', getControllerSegmentKind(kind, id), [
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
      const value = kind === 'extraAngle' ? state.extraAngleKinds[id] || 'plain' : state.angleKinds[id] || 'plain';
      let currentAngleValue = null;
      if (kind === 'angle' && geometry) currentAngleValue = geometry['angle' + id];
      if (kind === 'extraAngle' && config.extraAngles && geometry) {
        const angle = config.extraAngles({ state: state, geometry: geometry }).find(function (item) { return item.id === id; });
        currentAngleValue = angle ? angle.value : null;
      }
      if (window.InstantGeometryMobileAngleOrnaments) {
        return window.InstantGeometryMobileAngleOrnaments.appendAngleKindSelect(body, buildSelectFn, value, currentAngleValue);
      }
      const built = buildSelectFn('角マーク', value, [
        { value: 'hidden', label: '非表示' },
        { value: 'plain', label: '角弧のみ' }
      ]);
      body.appendChild(built.field);
      return built.select;
    }

    function setControllerKind(kind, id, value) {
      if (kind === 'side') state.sideKinds[id] = value;
      else if (kind === 'angle') state.angleKinds[id] = value;
      else if (kind === 'extraAngle') state.extraAngleKinds[id] = value;
      else if (kind === 'centerLine') {
        if (!state.centerLineKinds) state.centerLineKinds = { A: 'plain', B: 'plain', C: 'plain' };
        state.centerLineKinds[id] = value;
      } else if (kind === 'extraSegment') state.extraSegmentKinds[id] = value;
    }

    if (LabelEngine) {
      labelController = LabelEngine.createController({
        enabledLabels: config.labelTypes || config.enabledLabels || true,
        sheetTitle: sheetTitle,
        sheetBody: sheetBody,
        editSheet: editSheet,
        sheetBackdrop: sheetBackdrop,
        closeSheets: closeSheets,
        render: render,
        onMove: labelMoveEnabled ? function (kind, id) {
          enterMoveMode(kind, { id: id });
        } : null,
        onError: function (error) {
          setStatus(error.message || '入力を確認してください。', true);
        },
        getLabelType: getControllerLabelType,
        getModalSpec: function (kind, id, modalType) {
          return LabelEngine.getStandardModalSpec(modalType);
        },
        getTitle: getControllerTitle,
        getLabelValue: getControllerLabelValue,
        setLabelValue: setControllerLabelValue,
        getColor: getControllerColor,
        setColor: setControllerColor,
        getLabelScale: getControllerLabelScale,
        setLabelScale: setControllerLabelScale,
        getAngleArcScale: getAngleArcScale,
        setAngleArcScale: setAngleArcScale,
        hasGuideField: function (kind) {
          return kind === 'side' || kind === 'centerLine' || kind === 'extraSegment';
        },
        getGuideVisible: getControllerGuideVisible,
        setGuideVisible: setControllerGuideVisible,
        buildSegmentKindSelect: buildControllerSegmentKindSelect,
        buildAngleKindSelect: buildControllerAngleKindSelect,
        setKind: setControllerKind
      });
    }

    function openSheet(kind, payload) {
      closeSheets();
      activeSheet = { kind: kind, payload: payload };
      if (kind === 'save') {
        saveSheet.classList.add('open');
        saveSheet.setAttribute('aria-hidden', 'false');
        sheetBackdrop.classList.add('open');
      } else if (labelController) {
        labelController.openEditSheet(kind, payload.id);
        activeSheet = { kind: kind, payload: payload };
      } else {
        renderEditSheet(kind, payload);
        editSheet.classList.add('open');
        editSheet.setAttribute('aria-hidden', 'false');
        sheetBackdrop.classList.add('open');
      }
    }

    function registerDrawSettingsSection() {
      if (!window.InstantGeometryDrawSettings || typeof window.InstantGeometryDrawSettings.addSection !== 'function') return false;
      if (window.InstantGeometryDrawSettings.hasGlobalDecimalPlaces) return true;
      window.InstantGeometryDrawSettings.addSection('triangle-decimal-places', {
        render: function () {
          const value = String(clampDecimalPlaces(state.decimalPlaces));
          const options = [
            ['0', '整数'],
            ['1', '小数第1位'],
            ['2', '小数第2位'],
            ['3', '小数第3位'],
            ['4', '小数第4位'],
            ['5', '小数第5位'],
            ['6', '小数第6位']
          ].map(function (entry) {
            return '<option value="' + entry[0] + '"' + (entry[0] === value ? ' selected' : '') + '>' + entry[1] + '</option>';
          }).join('');
          return [
            '<div class="ig-settings-group">',
              '<label class="ig-settings-label" for="triangleDecimalPlaces">小数表示</label>',
              '<select class="ig-settings-select" id="triangleDecimalPlaces" data-triangle-decimal-places>',
                options,
              '</select>',
              '<p class="ig-settings-hint">数値（小数）を選んだラベルや、小数表示が必要な値に使う桁数です。</p>',
            '</div>'
          ].join('');
        },
        save: function (overlay) {
          const select = overlay.querySelector('[data-triangle-decimal-places]');
          if (!select) return;
          state.decimalPlaces = setActiveDecimalPlaces(select.value);
          render();
        }
      });
      return true;
    }

    if (!registerDrawSettingsSection()) {
      document.addEventListener('instant-geometry-draw-settings:ready', registerDrawSettingsSection, { once: true });
    }

    function drawRightAngleAtPoint(vertex, alongPoint, uprightPoint) {
      const v1 = { x: alongPoint.x - vertex.x, y: alongPoint.y - vertex.y };
      const v2 = { x: uprightPoint.x - vertex.x, y: uprightPoint.y - vertex.y };
      const l1 = Math.hypot(v1.x, v1.y) || 1;
      const l2 = Math.hypot(v2.x, v2.y) || 1;
      const u1 = { x: v1.x / l1, y: v1.y / l1 };
      const u2 = { x: v2.x / l2, y: v2.y / l2 };
      const size = Math.max(22, Math.min(42, Math.min(l1, l2) * 0.22));
      const p1 = { x: vertex.x + u1.x * size, y: vertex.y + u1.y * size };
      const p2 = { x: p1.x + u2.x * size, y: p1.y + u2.y * size };
      const p3 = { x: vertex.x + u2.x * size, y: vertex.y + u2.y * size };
      stage.appendChild(createSvg('polyline', {
        points: [p1, p2, p3].map(function (p) { return p.x + ',' + p.y; }).join(' '),
        fill: 'none',
        stroke: '#1f2430',
        'stroke-width': '3',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round'
      }));
    }

    function drawSideLabelArc(P, Q, centerPoint, labelPoint, labelWidth, color) {
      const geom = sideArcGeometry(P, Q, centerPoint, labelPoint, labelWidth);
      const stroke = color || '#2a5bd7';
      stage.appendChild(createSvg('path', {
        d: quadraticPathSegment(P, geom.control, Q, 0, 0.5 - geom.gapHalf, 20),
        fill: 'none',
        stroke: stroke,
        'stroke-width': '2',
        'stroke-linecap': 'round',
        'stroke-dasharray': '6 5'
      }));
      stage.appendChild(createSvg('path', {
        d: quadraticPathSegment(P, geom.control, Q, 0.5 + geom.gapHalf, 1, 20),
        fill: 'none',
        stroke: stroke,
        'stroke-width': '2',
        'stroke-linecap': 'round',
        'stroke-dasharray': '6 5'
      }));
    }

    function shouldUseKatexLabel(text) {
      return Boolean(window.katex && typeof window.katex.render === 'function' && /[\/√π°]|sqrt|pi|acos|arccos/i.test(String(text || '')));
    }

    function stripOuterParens(text) {
      const source = String(text || '').trim();
      if (source[0] !== '(' || source[source.length - 1] !== ')') return source;
      let depth = 0;
      for (let i = 0; i < source.length; i += 1) {
        if (source[i] === '(') depth += 1;
        if (source[i] === ')') {
          depth -= 1;
          if (depth === 0 && i < source.length - 1) return source;
        }
      }
      return source.slice(1, -1);
    }

    function findTopLevelSlash(text) {
      let depth = 0;
      for (let i = 0; i < text.length; i += 1) {
        if (text[i] === '(') depth += 1;
        else if (text[i] === ')') depth = Math.max(0, depth - 1);
        else if (text[i] === '/' && depth === 0) return i;
      }
      return -1;
    }

    function escapeLatexText(text) {
      return String(text || '').replace(/([\\{}_$&#%])/g, '\\$1');
    }

    function hasMathSyntax(text) {
      return /[\/√π°*_^()]|sqrt|pi|acos|arccos/i.test(String(text || ''));
    }

    function labelTextToLatex(text, kind) {
      const raw = String(text || '').trim().replace(/\s+/g, '');
      if (kind === 'point' && !hasMathSyntax(raw)) {
        if (/^[A-Za-z0-9]+$/.test(raw)) return '\\mathrm{' + escapeLatexText(raw) + '}';
        return '\\text{' + escapeLatexText(raw) + '}';
      }
      if ((kind === 'area' || kind === 'extraArea') && !hasMathSyntax(raw) && /[^0-9.]/.test(raw)) {
        return '\\text{' + escapeLatexText(raw) + '}';
      }
      const suffixMatch = raw.match(/^(.*?)(°|cm²|m²|km²|cm|m|km)$/);
      const core = suffixMatch ? suffixMatch[1] : raw;
      const suffix = suffixMatch ? suffixMatch[2] : '';

      function convert(input) {
        let value = stripOuterParens(String(input || '').trim());
        const slash = findTopLevelSlash(value);
        if (slash > 0 && slash < value.length - 1) {
          return '\\frac{' + convert(value.slice(0, slash)) + '}{' + convert(value.slice(slash + 1)) + '}';
        }
        value = value
          .replace(/arccos\(([^()]+)\)/ig, function (_, argument) {
            return '\\arccos\\left(' + convert(argument) + '\\right)';
          })
          .replace(/acos\(([^()]+)\)/ig, function (_, argument) {
            return '\\arccos\\left(' + convert(argument) + '\\right)';
          })
          .replace(/pi/ig, 'π')
          .replace(/sqrt\(([^()]+)\)/ig, '√($1)')
          .replace(/√\(([^()]+)\)/g, function (_, radicand) {
            return '\\sqrt{' + convert(radicand) + '}';
          })
          .replace(/(\d*)√([0-9A-Za-zπ]+)/g, function (_, coefficient, radicand) {
            return (coefficient || '') + '\\sqrt{' + convert(radicand) + '}';
          })
          .replace(/π/g, '\\pi')
          .replace(/\*/g, '\\cdot ');
        return value;
      }

      let latex = convert(core);
      if (suffix === '°') latex += '^{\\circ}';
      else if (suffix) latex += '\\,\\mathrm{' + suffix.replace('²', '^2') + '}';
      return latex;
    }

    function measureKatexLabel(latex, fontSize, color) {
      const measure = document.createElement('div');
      measure.className = 'triangle-katex-label triangle-katex-measure';
      measure.style.fontSize = fontSize + 'px';
      measure.style.color = color;
      try {
        window.katex.render(latex, measure, {
          throwOnError: false,
          output: 'html',
          strict: 'ignore'
        });
      } catch (_) {
        return null;
      }
      document.body.appendChild(measure);
      const rect = measure.getBoundingClientRect();
      measure.remove();
      if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0) return null;
      return {
        width: Math.ceil(rect.width) + Math.ceil(fontSize * 0.28),
        height: Math.ceil(rect.height) + Math.ceil(fontSize * 0.20)
      };
    }

    function createKatexLabel(text, attrs) {
      const x = Number(attrs.x) || 0;
      const y = Number(attrs.y) || 0;
      const baseFontSize = Number(attrs['font-size']) || 48;
      const isSideLabel = attrs['data-label-kind'] === 'side';
      const sideMaxFontSize = window.matchMedia && window.matchMedia('(max-width: 520px)').matches ? 38 : 50;
      const labelKind = attrs['data-label-kind'] || '';
      const labelId = attrs['data-label-id'] || '';
      const color = attrs.fill || '#1f2430';
      const latex = labelTextToLatex(text, labelKind);
      const userScale = labelKind && labelId
        ? getMathLabelScale(labelKind, labelId)
        : clampMathLabelScale(state.mathLabelScale);
      let fontSize = (isSideLabel ? Math.min(baseFontSize, sideMaxFontSize) : baseFontSize) * userScale;
      const sideLength = Number(attrs['data-side-length']);
      if (isSideLabel && Number.isFinite(sideLength) && sideLength > 0) {
        for (let i = 0; i < 5; i += 1) {
          const candidate = measureKatexLabel(latex, fontSize, color);
          if (!candidate) break;
          const maxWidth = Math.max(42, sideLength * 0.34);
          const maxHeight = Math.max(34, sideLength * 0.36);
          if (candidate.width <= maxWidth && candidate.height <= maxHeight) break;
          const widthScale = maxWidth / Math.max(candidate.width, 1);
          const heightScale = maxHeight / Math.max(candidate.height, 1);
          const nextSize = Math.max(24, Math.floor(fontSize * Math.min(widthScale, heightScale, 0.92)));
          if (nextSize >= fontSize) break;
          fontSize = nextSize;
        }
      }
      const measured = measureKatexLabel(latex, fontSize, color);
      if (!measured) return null;
      const foreignObject = createSvg('foreignObject', {
        x: x - measured.width / 2,
        y: y - measured.height / 2,
        width: measured.width,
        height: measured.height,
        class: 'triangle-katex-foreign',
        overflow: 'visible'
      });
      const div = document.createElement('div');
      div.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
      div.className = 'triangle-katex-label';
      div.style.fontSize = fontSize + 'px';
      div.style.color = color;
      try {
        window.katex.render(latex, div, {
          throwOnError: false,
          output: 'html',
          strict: 'ignore'
        });
      } catch (_) {
        return null;
      }
      foreignObject.appendChild(div);
      foreignObject.style.visibility = 'hidden';
      pendingKatexLabels.push({
        x: x - measured.width / 2,
        y: y - measured.height / 2,
        width: measured.width,
        height: measured.height,
        kind: labelKind,
        id: labelId,
        node: div.cloneNode(true)
      });
      return foreignObject;
    }

    function renderKatexLiveLayer() {
      katexLiveLayer.innerHTML = '';
      if (!pendingKatexLabels.length) return;
      const rootRect = captureRoot.getBoundingClientRect();
      const matrix = stage.getScreenCTM();
      if (!matrix) return;
      function toRootPoint(x, y) {
        const point = stage.createSVGPoint();
        point.x = x;
        point.y = y;
        const screen = point.matrixTransform(matrix);
        return { x: screen.x - rootRect.left, y: screen.y - rootRect.top };
      }
      pendingKatexLabels.forEach(function (entry) {
        const topLeft = toRootPoint(entry.x, entry.y);
        const bottomRight = toRootPoint(entry.x + entry.width, entry.y + entry.height);
        const node = entry.node.cloneNode(true);
        node.style.left = Math.min(topLeft.x, bottomRight.x) + 'px';
        node.style.top = Math.min(topLeft.y, bottomRight.y) + 'px';
        node.style.width = Math.abs(bottomRight.x - topLeft.x) + 'px';
        node.style.height = Math.abs(bottomRight.y - topLeft.y) + 'px';
        if (entry.kind && entry.id) {
          wireLabelNodeInteractions(node, entry.kind, entry.id);
        }
        katexLiveLayer.appendChild(node);
      });
    }

    function prepareKatexCaptureOverlay() {
      const katexNodes = Array.from(stage.querySelectorAll('foreignObject.triangle-katex-foreign'));
      if (!katexNodes.length || katexLiveLayer.children.length) return function () {};
      const rootRect = captureRoot.getBoundingClientRect();
      const overlay = document.createElement('div');
      overlay.className = 'triangle-katex-capture-layer';
      const hidden = [];

      function toRootPoint(x, y) {
        const point = stage.createSVGPoint();
        point.x = x;
        point.y = y;
        const matrix = stage.getScreenCTM();
        if (!matrix) return { x: 0, y: 0 };
        const screen = point.matrixTransform(matrix);
        return { x: screen.x - rootRect.left, y: screen.y - rootRect.top };
      }

      katexNodes.forEach(function (node) {
        const x = Number(node.getAttribute('x'));
        const y = Number(node.getAttribute('y'));
        const width = Number(node.getAttribute('width'));
        const height = Number(node.getAttribute('height'));
        if (![x, y, width, height].every(Number.isFinite)) return;
        const topLeft = toRootPoint(x, y);
        const bottomRight = toRootPoint(x + width, y + height);
        const clone = node.firstElementChild ? node.firstElementChild.cloneNode(true) : null;
        if (!clone) return;
        clone.style.left = Math.min(topLeft.x, bottomRight.x) + 'px';
        clone.style.top = Math.min(topLeft.y, bottomRight.y) + 'px';
        clone.style.width = Math.abs(bottomRight.x - topLeft.x) + 'px';
        clone.style.height = Math.abs(bottomRight.y - topLeft.y) + 'px';
        overlay.appendChild(clone);
        hidden.push({ node: node, visibility: node.style.visibility });
        node.style.visibility = 'hidden';
      });

      if (!overlay.children.length) return function () {};
      captureRoot.appendChild(overlay);
      return function () {
        hidden.forEach(function (entry) {
          entry.node.style.visibility = entry.visibility;
        });
        overlay.remove();
      };
    }

    function createTextLabel(text, attrs) {
      const parsed = isRatioLabelValue(text) ? parseRatioLabelInput(String(text).slice(RATIO_LABEL_PREFIX.length)) : null;
      if (parsed) {
        const x = Number(attrs.x) || 0;
        const y = Number(attrs.y) || 0;
        const fontSize = Number(attrs['font-size']) || 48;
        const textWidth = Math.max(fontSize * 0.7, parsed.value.length * fontSize * 0.62);
        const height = fontSize * 1.16;
        const width = parsed.mark === 't'
          ? Math.max(textWidth + fontSize * 0.8, height * 1.25)
          : Math.max(textWidth + fontSize * 0.55, height);
        const group = createSvg('g', {});
        const stroke = attrs.fill || '#1f2430';
        if (parsed.mark === 'r') {
          group.appendChild(createSvg('ellipse', { cx: x, cy: y, rx: width / 2, ry: height / 2, fill: '#ffffff', stroke: stroke, 'stroke-width': Math.max(2, fontSize * 0.055) }));
        } else if (parsed.mark === 't') {
          group.appendChild(createSvg('polygon', {
            points: [x + ',' + (y - height * 0.72), (x - width / 2) + ',' + (y + height * 0.48), (x + width / 2) + ',' + (y + height * 0.48)].join(' '),
            fill: '#ffffff',
            stroke: stroke,
            'stroke-width': Math.max(2, fontSize * 0.055),
            'stroke-linejoin': 'round'
          }));
        } else {
          group.appendChild(createSvg('rect', { x: x - width / 2, y: y - height / 2, width: width, height: height, fill: '#ffffff', stroke: stroke, 'stroke-width': Math.max(2, fontSize * 0.055) }));
        }
        const textNode = createSvg('text', Object.assign({}, attrs, { 'text-anchor': 'middle', 'dominant-baseline': 'middle' }));
        textNode.textContent = parsed.value;
        group.appendChild(textNode);
        return group;
      }
      if ((attrs['data-label-kind'] && window.katex && typeof window.katex.render === 'function') || shouldUseKatexLabel(text)) {
        const katexNode = createKatexLabel(text, attrs);
        if (katexNode) return katexNode;
      }
      if (window.InstantGeometrySvgLabels && window.InstantGeometrySvgLabels.parseMathLayout && /[\/√_^]|sqrt|pi|π/.test(String(text || ''))) {
        const x = Number(attrs.x) || 0;
        const y = Number(attrs.y) || 0;
        const fontSize = Number(attrs['font-size']) || 48;
        const color = attrs.fill || '#1f2430';
        const layout = window.InstantGeometrySvgLabels.parseMathLayout(stage, String(text), fontSize);
        layout.node.querySelectorAll('.function-rich-label-text').forEach(function (node) {
          node.setAttribute('fill', color);
          node.setAttribute('stroke', '#ffffff');
          node.setAttribute('stroke-width', '7');
          node.setAttribute('stroke-linejoin', 'round');
          node.setAttribute('paint-order', 'stroke');
          node.setAttribute('font-weight', '900');
        });
        layout.node.querySelectorAll('.function-rich-fraction-rule,.function-rich-sqrt-rule,.function-rich-vector-arrow,.function-rich-matrix-bracket').forEach(function (node) {
          node.setAttribute('fill', 'none');
          node.setAttribute('stroke', color);
          node.setAttribute('stroke-width', node.classList.contains('function-rich-sqrt-rule') ? '3.2' : '2.2');
          node.setAttribute('stroke-linecap', 'round');
          node.setAttribute('stroke-linejoin', 'round');
        });
        const group = createSvg('g', {
          class: 'function-rich-label triangle-rich-label',
          transform: 'translate(' + x + ' ' + y + ')',
          fill: color
        });
        group.appendChild(layout.node);
        return group;
      }
      const textNode = createSvg('text', attrs);
      textNode.textContent = text;
      return textNode;
    }

    function applyModalValue(kind, payload, editor, kindValue, arcVisibleValue, colorValue, angleArcScaleValue) {
      const mode = editor.mode.value;
      const text = normalizeFreeLabel(editor.input.value);
      if (kind === 'point') {
        if (colorValue) state.pointColors[payload.id] = colorValue;
        state.pointInputs[payload.id] = mode === 'text' ? text : '';
        return;
      }
      if (kind === 'side') {
        if (colorValue) state.sideColors[payload.id] = colorValue;
        if (kindValue) state.sideKinds[payload.id] = kindValue;
        if (arcVisibleValue !== null) state.sideArcVisible[payload.id] = Boolean(arcVisibleValue);
        if (mode === 'hidden') {
          state.sideInputs[payload.id] = '';
          state.sideArcVisible[payload.id] = false;
          return;
        }
        if (mode === 'numeric') {
          state.sideInputs[payload.id] = ' ';
          return;
        }
        if (mode === 'numericRaw') {
          state.sideInputs[payload.id] = RAW_NUMERIC_LABEL_VALUE;
          return;
        }
        if (mode === 'numericDecimal') {
          state.sideInputs[payload.id] = DECIMAL_NUMERIC_LABEL_VALUE;
          return;
        }
        if (mode === 'ratio') {
          const ratio = parseRatioLabelInput(text);
          if (!ratio) throw new Error('比の値は「r,5」「t,4.4」「s,5/3」の形式で入力してください。');
          state.sideInputs[payload.id] = RATIO_LABEL_PREFIX + ratio.source;
          return;
        }
        state.sideInputs[payload.id] = text || '';
        return;
      }
      if (kind === 'angle') {
        if (colorValue) state.angleColors[payload.id] = colorValue;
        if (angleArcScaleValue !== null && angleArcScaleValue !== undefined) setAngleArcScale('angle', payload.id, angleArcScaleValue);
        if (kindValue) state.angleKinds[payload.id] = kindValue;
        if (mode === 'hidden') {
          state.angleInputs[payload.id] = '';
          return;
        }
        if (mode === 'numeric') {
          state.angleInputs[payload.id] = ' ';
          return;
        }
        if (mode === 'numericRaw') {
          state.angleInputs[payload.id] = RAW_NUMERIC_LABEL_VALUE;
          return;
        }
        if (mode === 'numericDecimal') {
          state.angleInputs[payload.id] = DECIMAL_NUMERIC_LABEL_VALUE;
          return;
        }
        if (mode === 'ratio') {
          const ratio = parseRatioLabelInput(text);
          if (!ratio) throw new Error('比の値は「r,5」「t,4.4」「s,5/3」の形式で入力してください。');
          state.angleInputs[payload.id] = RATIO_LABEL_PREFIX + ratio.source;
          return;
        }
        state.angleInputs[payload.id] = text || '';
        return;
      }
      if (kind === 'extraAngle') {
        if (colorValue) state.extraAngleColors[payload.id] = colorValue;
        if (angleArcScaleValue !== null && angleArcScaleValue !== undefined) setAngleArcScale('extraAngle', payload.id, angleArcScaleValue);
        if (kindValue) state.extraAngleKinds[payload.id] = kindValue;
        if (mode === 'hidden') {
          state.extraAngleInputs[payload.id] = '';
          return;
        }
        if (mode === 'numeric') {
          state.extraAngleInputs[payload.id] = ' ';
          return;
        }
        if (mode === 'numericRaw') {
          state.extraAngleInputs[payload.id] = RAW_NUMERIC_LABEL_VALUE;
          return;
        }
        if (mode === 'numericDecimal') {
          state.extraAngleInputs[payload.id] = DECIMAL_NUMERIC_LABEL_VALUE;
          return;
        }
        if (mode === 'ratio') {
          const ratio = parseRatioLabelInput(text);
          if (!ratio) throw new Error('比の値は「r,5」「t,4.4」「s,5/3」の形式で入力してください。');
          state.extraAngleInputs[payload.id] = RATIO_LABEL_PREFIX + ratio.source;
          return;
        }
        state.extraAngleInputs[payload.id] = text || '';
        return;
      }
      if (kind === 'centerLine') {
        if (!state.centerLineInputs) state.centerLineInputs = { A: '', B: '', C: '' };
        if (!state.centerLineKinds) state.centerLineKinds = { A: 'plain', B: 'plain', C: 'plain' };
        if (!state.centerLineArcVisible) state.centerLineArcVisible = { A: false, B: false, C: false };
        if (colorValue) state.centerLineColors[payload.id] = colorValue;
        if (kindValue) state.centerLineKinds[payload.id] = kindValue;
        if (arcVisibleValue !== null) state.centerLineArcVisible[payload.id] = Boolean(arcVisibleValue);
        if (mode === 'hidden') {
          state.centerLineInputs[payload.id] = '';
          state.centerLineArcVisible[payload.id] = false;
          return;
        }
        if (mode === 'numeric') {
          state.centerLineInputs[payload.id] = ' ';
          return;
        }
        if (mode === 'numericRaw') {
          state.centerLineInputs[payload.id] = RAW_NUMERIC_LABEL_VALUE;
          return;
        }
        if (mode === 'numericDecimal') {
          state.centerLineInputs[payload.id] = DECIMAL_NUMERIC_LABEL_VALUE;
          return;
        }
        if (mode === 'ratio') {
          const ratio = parseRatioLabelInput(text);
          if (!ratio) throw new Error('比の値は「r,5」「t,4.4」「s,5/3」の形式で入力してください。');
          state.centerLineInputs[payload.id] = RATIO_LABEL_PREFIX + ratio.source;
          return;
        }
        state.centerLineInputs[payload.id] = text || '';
        return;
      }
      if (kind === 'extraSegment') {
        if (colorValue) state.extraSegmentColors[payload.id] = colorValue;
        if (kindValue) state.extraSegmentKinds[payload.id] = kindValue;
        if (arcVisibleValue !== null) state.extraSegmentArcVisible[payload.id] = Boolean(arcVisibleValue);
        if (mode === 'hidden') {
          state.extraSegmentInputs[payload.id] = '';
          state.extraSegmentArcVisible[payload.id] = false;
          return;
        }
        if (mode === 'numeric') {
          state.extraSegmentInputs[payload.id] = ' ';
          return;
        }
        if (mode === 'numericRaw') {
          state.extraSegmentInputs[payload.id] = RAW_NUMERIC_LABEL_VALUE;
          return;
        }
        if (mode === 'numericDecimal') {
          state.extraSegmentInputs[payload.id] = DECIMAL_NUMERIC_LABEL_VALUE;
          return;
        }
        if (mode === 'ratio') {
          const ratio = parseRatioLabelInput(text);
          if (!ratio) throw new Error('比の値は「r,5」「t,4.4」「s,5/3」の形式で入力してください。');
          state.extraSegmentInputs[payload.id] = RATIO_LABEL_PREFIX + ratio.source;
          return;
        }
        state.extraSegmentInputs[payload.id] = text || '';
        return;
      }
      if (kind === 'area') {
        if (colorValue) state.areaColor = colorValue;
        if (mode === 'hidden') {
          state.areaValue = '';
          return;
        }
        if (mode === 'numeric') {
          state.areaValue = ' ';
          return;
        }
        if (mode === 'numericRaw') {
          state.areaValue = RAW_NUMERIC_LABEL_VALUE;
          return;
        }
        if (mode === 'numericDecimal') {
          state.areaValue = DECIMAL_NUMERIC_LABEL_VALUE;
          return;
        }
        if (mode === 'ratio') {
          const ratio = parseRatioLabelInput(text);
          if (!ratio) throw new Error('比の値は「r,5」「t,4.4」「s,5/3」の形式で入力してください。');
          state.areaValue = RATIO_LABEL_PREFIX + ratio.source;
          return;
        }
        state.areaValue = text || '';
        return;
      }
      if (kind === 'extraArea') {
        if (colorValue) state.extraAreaColors[payload.id] = colorValue;
        if (mode === 'hidden') {
          state.extraAreaInputs[payload.id] = '';
          return;
        }
        if (mode === 'numeric') {
          state.extraAreaInputs[payload.id] = ' ';
          return;
        }
        if (mode === 'numericRaw') {
          state.extraAreaInputs[payload.id] = RAW_NUMERIC_LABEL_VALUE;
          return;
        }
        if (mode === 'numericDecimal') {
          state.extraAreaInputs[payload.id] = DECIMAL_NUMERIC_LABEL_VALUE;
          return;
        }
        if (mode === 'ratio') {
          const ratio = parseRatioLabelInput(text);
          if (!ratio) throw new Error('比の値は「r,5」「t,4.4」「s,5/3」の形式で入力してください。');
          state.extraAreaInputs[payload.id] = RATIO_LABEL_PREFIX + ratio.source;
          return;
        }
        state.extraAreaInputs[payload.id] = text || '';
      }
    }

    function renderEditSheet(kind, payload) {
      sheetBody.innerHTML = '';
      let title = '設定';
      let targetLabel = '';
      let value = '';
      let hint = '';
      let kindValue = '';
      let currentAngleValue = null;
      let sideArcVisible = true;
      let colorValue = null;
      let showColorPalette = false;
      let angleArcScaleBuilt = null;

      if (kind === 'point') {
        title = getPointName(payload.id);
        targetLabel = 'ラベル';
        value = state.pointInputs[payload.id] || '';
        colorValue = getPointColor(payload.id);
        showColorPalette = true;
        hint = '';
      } else if (kind === 'side') {
        title = getSideName(payload.id);
        targetLabel = 'ラベル';
        value = String(state.sideInputs[payload.id] || '');
        kindValue = state.sideKinds[payload.id] || 'plain';
        sideArcVisible = state.sideArcVisible[payload.id] !== false;
        colorValue = getSideColor(payload.id);
        showColorPalette = true;
        hint = '';
      } else if (kind === 'angle') {
        title = getAngleName(payload.id);
        targetLabel = 'ラベル';
        value = String(state.angleInputs[payload.id] || '');
        kindValue = state.angleKinds[payload.id] || 'plain';
        currentAngleValue = geometry ? geometry['angle' + payload.id] : null;
        colorValue = getAngleColor('angle', payload.id);
        showColorPalette = true;
        hint = '';
      } else if (kind === 'extraAngle') {
        const extra = config.extraAngles && geometry
          ? config.extraAngles({ state: state, geometry: geometry }).find(function (angle) { return angle.id === payload.id; })
          : null;
        title = extra && extra.name ? extra.name : '角';
        targetLabel = 'ラベル';
        value = String(state.extraAngleInputs[payload.id] || '');
        kindValue = state.extraAngleKinds[payload.id] || 'plain';
        currentAngleValue = extra ? extra.value : null;
        colorValue = getAngleColor('extraAngle', payload.id);
        showColorPalette = true;
        hint = '';
      } else if (kind === 'centerLine') {
        title = getCenterLineName(payload.id);
        targetLabel = 'ラベル';
        value = String((state.centerLineInputs && state.centerLineInputs[payload.id]) || '');
        kindValue = (state.centerLineKinds && state.centerLineKinds[payload.id]) || 'plain';
        sideArcVisible = state.centerLineArcVisible && state.centerLineArcVisible[payload.id] === true;
        colorValue = getSegmentColor('centerLine', payload.id);
        showColorPalette = true;
        hint = '';
      } else if (kind === 'extraSegment') {
        title = getExtraSegmentName(payload.id);
        targetLabel = 'ラベル';
        value = String(state.extraSegmentInputs[payload.id] || '');
        kindValue = state.extraSegmentKinds[payload.id] || 'plain';
        sideArcVisible = state.extraSegmentArcVisible[payload.id] === true;
        colorValue = getSegmentColor('extraSegment', payload.id);
        showColorPalette = true;
        hint = '';
      } else if (kind === 'area') {
        title = getAreaName();
        targetLabel = 'ラベル';
        value = String(state.areaValue || '');
        hint = '';
      } else if (kind === 'extraArea') {
        title = getExtraAreaName(payload.id);
        targetLabel = 'ラベル';
        value = String(state.extraAreaInputs[payload.id] || '');
        hint = '';
      }

      sheetTitle.textContent = title;

      let kindSelect = null;
      let arcCheckbox = null;
      let colorPalette = null;

      if ((kind === 'side' && state.sideKinds && Object.prototype.hasOwnProperty.call(state.sideKinds, payload.id)) || kind === 'centerLine' || kind === 'extraSegment') {
        const built = buildSelect('線分マーク', kindValue, [
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
        kindSelect = built.select;
        sheetBody.appendChild(built.field);

        const checkboxBuilt = buildCheckbox('ガイドを表示', sideArcVisible);
        arcCheckbox = checkboxBuilt.input;
        sheetBody.appendChild(checkboxBuilt.field);
      } else if (kind === 'angle' || kind === 'extraAngle') {
        kindSelect = window.InstantGeometryMobileAngleOrnaments.appendAngleKindSelect(
          sheetBody,
          buildSelect,
          kindValue,
          currentAngleValue
        );
        angleArcScaleBuilt = buildRangeField(
          '角弧サイズ',
          Math.round(getAngleArcScale(kind, payload.id) * 100),
          30,
          300,
          10,
          function (scaleValue) { return scaleValue + '%'; }
        );
        sheetBody.appendChild(angleArcScaleBuilt.field);
      }

      const labelEditor = buildLabelEditor(targetLabel, value, kind !== 'point');
      sheetBody.appendChild(labelEditor.field);
      const mathLabelScaleBuilt = buildRangeField(
        'ラベルサイズ',
        Math.round(getMathLabelScale(kind, kind === 'area' ? 'main' : payload.id) * 100),
        10,
        400,
        10,
        function (scaleValue) { return scaleValue + '%'; }
      );
      sheetBody.appendChild(mathLabelScaleBuilt.field);
      if (kind === 'area' || kind === 'extraArea') {
        const currentColor = kind === 'extraArea'
          ? (state.extraAreaColors[payload.id] || state.areaColor || '#2a5bd7')
          : (state.areaColor || '#2a5bd7');
        colorPalette = buildColorPalette('色', currentColor);
        sheetBody.appendChild(colorPalette.field);
      } else if (showColorPalette) {
        colorPalette = buildColorPalette('色', colorValue);
        sheetBody.appendChild(colorPalette.field);
      }

      if (hint) {
        const hintNode = document.createElement('p');
        hintNode.className = 'sheet-hint';
        hintNode.textContent = hint;
        sheetBody.appendChild(hintNode);
      }

      const actions = document.createElement('div');
      actions.className = 'sheet-actions';
      if (labelMoveEnabled) actions.classList.add('has-move');
      const cancel = document.createElement('button');
      cancel.className = 'btn';
      cancel.type = 'button';
      cancel.textContent = 'キャンセル';
      cancel.addEventListener('click', closeSheets);
      const move = document.createElement('button');
      move.className = 'btn action-secondary';
      move.type = 'button';
      move.textContent = '移動';
      move.addEventListener('click', function () {
        try {
          applyModalValue(
            kind,
            payload,
            labelEditor,
            kindSelect ? kindSelect.value : null,
            arcCheckbox ? arcCheckbox.checked : null,
            colorPalette ? colorPalette.value : null,
            angleArcScaleBuilt ? Number(angleArcScaleBuilt.input.value) / 100 : null
          );
          setMathLabelScale(kind, kind === 'area' ? 'main' : payload.id, Number(mathLabelScaleBuilt.input.value) / 100);
          render();
          enterMoveMode(kind, payload);
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
          applyModalValue(
            kind,
            payload,
            labelEditor,
            kindSelect ? kindSelect.value : null,
            arcCheckbox ? arcCheckbox.checked : null,
            colorPalette ? colorPalette.value : null,
            angleArcScaleBuilt ? Number(angleArcScaleBuilt.input.value) / 100 : null
          );
          setMathLabelScale(kind, kind === 'area' ? 'main' : payload.id, Number(mathLabelScaleBuilt.input.value) / 100);
          closeSheets();
          render();
        } catch (error) {
          setStatus(error.message || '入力を確認してください。', true);
        }
      });
      actions.appendChild(cancel);
      if (labelMoveEnabled) actions.appendChild(move);
      actions.appendChild(save);
      sheetBody.appendChild(actions);
    }

    function attachHit(element, kind, id) {
      element.style.cursor = 'pointer';
      element.setAttribute('data-kind', kind);
      element.setAttribute('data-id', id);
      if (isTransparentHitElement(element)) {
        applyHitDebugStyle(element, kind);
      }
      element.addEventListener('click', function (event) {
        event.stopPropagation();
        if (moveMode) return;
        openSheet(kind, { id: id });
      });
    }

    function isTransparentHitElement(element) {
      const stroke = String(element.getAttribute('stroke') || '').trim();
      const fill = String(element.getAttribute('fill') || '').trim();
      return stroke === 'transparent' || fill === 'transparent';
    }

    function hitDebugColor(kind) {
      if (kind === 'area' || kind === 'extraArea') return '#16a34a';
      if (kind === 'angle' || kind === 'extraAngle') return '#f97316';
      if (kind === 'side' || kind === 'extraSegment' || kind === 'centerLine') return '#2563eb';
      if (kind === 'point') return '#dc2626';
      return '#9333ea';
    }

    function applyHitDebugStyle(element, kind) {
      if (!debugHitEnabled) return;
      const color = hitDebugColor(kind);
      const tag = element.tagName.toLowerCase();
      const currentFill = String(element.getAttribute('fill') || '').trim();
      element.classList.add('triangle-hit-debug');
      element.setAttribute('data-debug-hit', 'true');
      if (tag === 'line' || (tag === 'path' && element.getAttribute('fill') === 'none')) {
        element.setAttribute('stroke', color);
        element.setAttribute('stroke-opacity', '0.65');
        element.setAttribute('fill', 'none');
        return;
      }
      if ((kind === 'area' || kind === 'extraArea') && currentFill && currentFill !== 'none' && currentFill !== 'transparent') {
        element.setAttribute('stroke', color);
        element.setAttribute('stroke-opacity', '0.7');
        element.setAttribute('stroke-width', element.getAttribute('stroke-width') || '3');
        return;
      }
      element.setAttribute('fill', hexToRgba(color, 0.16));
      element.setAttribute('stroke', color);
      element.setAttribute('stroke-opacity', '0.7');
      element.setAttribute('stroke-width', element.getAttribute('stroke-width') || '3');
    }

    function attachLabelHit(element, kind, id) {
      attachHit(element, kind, id);
      element.setAttribute('data-label-target', 'true');
      if (isMoveTarget(kind, id)) {
        element.classList.add('label-move-target');
      }
      element.addEventListener('pointerdown', function (event) {
        startLabelMoveDrag(kind, id, event);
      });
    }

    function bringHitKindsToFront(kinds) {
      const selector = kinds.map(function (kind) {
        return '[data-kind="' + kind + '"]';
      }).join(',');
      Array.from(stage.querySelectorAll(selector)).forEach(function (node) {
        stage.appendChild(node);
      });
    }

    function render() {
      try {
        setActiveDecimalPlaces(state.decimalPlaces);
        syncControlLabels();
        Object.keys(controlInputs).forEach(function (key) {
          state.rawControlInputs[key] = String(controlInputs[key].value || '').trim();
        });
        const parsed = config.readControls(controlInputs, parseNatural);
        config.applyControlsToState(state, parsed);
        geometry = config.computeGeometry(state, parsed, {
          computeTriangleFromSides: computeTriangleFromSides,
          computeTriangleFromSAS: computeTriangleFromSAS,
          computeTriangleFromASA: computeTriangleFromASA,
          computeTriangleFromAAA: computeTriangleFromAAA,
          computeTriangleFromAAS: computeTriangleFromAAS,
          formatPreferredNumber: formatPreferredNumber,
          formatPythagoreanLeg: formatPythagoreanLeg,
          formatPythagoreanLegFromInputs: formatPythagoreanLegFromInputs,
          formatPythagoreanHypotenuse: formatPythagoreanHypotenuse,
          formatSpecialRightTriangleSide: formatSpecialRightTriangleSide,
          formatHeronArea: formatHeronArea,
          formatHeronAreaFromInputs: formatHeronAreaFromInputs,
          formatHeronInradius: formatHeronInradius,
          formatIncenterSubArea: formatIncenterSubArea
        });
        currentLabelBases = {};
        pendingKatexLabels = [];
        katexLiveLayer.innerHTML = '';
        stage.innerHTML = '';

        ['A', 'B', 'C'].forEach(function (id) {
          if (window.InstantGeometryMobileAngleOrnaments.normalizeAngleKind(state.angleKinds[id], geometry['angle' + id]) !== state.angleKinds[id]) {
            state.angleKinds[id] = 'plain';
          }
        });
        const extraAngles = config.extraAngles ? config.extraAngles({ state: state, geometry: geometry }) : [];
        extraAngles.forEach(function (angle) {
          if (window.InstantGeometryMobileAngleOrnaments.normalizeAngleKind(state.extraAngleKinds[angle.id], angle.value) !== state.extraAngleKinds[angle.id]) {
            state.extraAngleKinds[angle.id] = 'plain';
          }
        });
        const pageAngleArcRadius = resolvePageAngleArcRadius(config, extraAngles);

        const centerPoint = config.centerType ? triangleCenterPoint(geometry, config.centerType) : null;
        const centerCircle = centerPoint ? centerCircleGeometry(geometry, config.centerType, centerPoint) : null;
        const rawExtraPoints = config.extraPoints ? config.extraPoints({ state: state, geometry: geometry }) : [];
        const extraViewportPoints = (centerPoint ? [centerPoint] : [])
          .concat(circleCardinalPoints(centerCircle))
          .concat(rawExtraPoints.map(function (item) { return item.point; }));
        const view = computeViewport(geometry, extraViewportPoints);
        const center = centroid(geometry);
        const tA = fitPoint(geometry.A, view);
        const tB = fitPoint(geometry.B, view);
        const tC = fitPoint(geometry.C, view);
        const tCenter = fitPoint(center, view);
        const tSpecialCenter = centerPoint ? fitPoint(centerPoint, view) : null;
        const extraAreas = config.extraAreas ? config.extraAreas({ state: state, geometry: geometry }) : [];
        const extraSegments = config.extraSegments ? config.extraSegments({ state: state, geometry: geometry }) : [];
        const extraPoints = rawExtraPoints.map(function (item) {
          return Object.assign({}, item, { screenPoint: fitPoint(item.point, view) });
        });

        const areaHit = createSvg('polygon', {
          points: [tA, tB, tC].map(function (p) { return p.x + ',' + p.y; }).join(' '),
          fill: hexToRgba(state.areaColor || '#2a5bd7', 0.16),
          stroke: 'none'
        });
        applyHitDebugStyle(areaHit, 'area');
        attachHit(areaHit, 'area', 'main');
        stage.appendChild(areaHit);

        extraAreas.forEach(function (area) {
          if (!area.points || area.points.length < 3) return;
          const color = state.extraAreaColors[area.id] || area.color || state.areaColor || '#2a5bd7';
          const areaNode = createSvg('polygon', {
            points: area.points.map(function (point) {
              const p = fitPoint(point, view);
              return p.x + ',' + p.y;
            }).join(' '),
            fill: hexToRgba(color, 0.1),
            stroke: 'none'
          });
          applyHitDebugStyle(areaNode, 'extraArea');
          attachHit(areaNode, 'extraArea', area.id);
          stage.appendChild(areaNode);
        });

        if (centerCircle) {
          const tCircleCenter = fitPoint(centerCircle.center, view);
          const circleRadius = centerCircle.radius * view.scale;
          stage.appendChild(createSvg('circle', {
            cx: tCircleCenter.x,
            cy: tCircleCenter.y,
            r: circleRadius,
            fill: 'none',
            stroke: '#25603b',
            'stroke-width': '2.4',
            'stroke-linecap': 'round'
          }));
        }

        [['a', tB, tC], ['b', tC, tA], ['c', tA, tB]].forEach(function (entry) {
          stage.appendChild(createSvg('line', {
            x1: entry[1].x,
            y1: entry[1].y,
            x2: entry[2].x,
            y2: entry[2].y,
            stroke: getSideColor(entry[0]),
            'stroke-width': '3',
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round'
          }));
        });

        [['a', tB, tC], ['b', tC, tA], ['c', tA, tB]].forEach(function (entry) {
          drawSideKind(stage, state.sideKinds[entry[0]], entry[1], entry[2], getSideColor(entry[0]));
        });

        if (config.drawAuxiliary) {
          config.drawAuxiliary({
            stage: stage,
            state: state,
            geometry: geometry,
            view: view,
            center: center,
            screen: { A: tA, B: tB, C: tC, center: tCenter },
            createSvg: createSvg,
            createTextLabel: createTextLabel,
            fitPoint: function (point) { return fitPoint(point, view); },
            attachHit: attachHit,
            getPointLabelValue: getPointLabelValue,
            getSideLabelValue: getSideLabelValue,
            drawRightAngleAtPoint: drawRightAngleAtPoint,
            drawSideKind: function (kindValue, P, Q) { drawSideKind(stage, kindValue, P, Q); },
            drawSideLabelArc: drawSideLabelArc
          });
        }

        extraSegments.forEach(function (segment) {
          const p1 = fitPoint(segment.p1, view);
          const p2 = fitPoint(segment.p2, view);
          const segmentHitEnabled = segment.hitEnabled !== false;
          if (segment.drawLine !== false) {
            const segmentColor = getSegmentColor('extraSegment', segment.id, segment.stroke);
            const line = createSvg('line', {
              x1: p1.x,
              y1: p1.y,
              x2: p2.x,
              y2: p2.y,
              stroke: segmentColor,
              'stroke-width': segment.strokeWidth || '2.4',
              'stroke-linecap': 'round',
              'stroke-dasharray': segment.dasharray || '7 7'
            });
            if (segmentHitEnabled) {
              attachHit(line, 'extraSegment', segment.id);
            }
            stage.appendChild(line);
          }
          const segmentColor = getSegmentColor('extraSegment', segment.id, segment.stroke);
          drawSideKind(stage, state.extraSegmentKinds[segment.id], p1, p2, segmentColor);
          if (segmentHitEnabled) {
            const hitLine = createSvg('line', {
              x1: p1.x,
              y1: p1.y,
              x2: p2.x,
              y2: p2.y,
              stroke: 'transparent',
              'stroke-width': '9',
              'stroke-linecap': 'round'
            });
            attachHit(hitLine, 'extraSegment', segment.id);
            stage.appendChild(hitLine);
          }
          const label = getExtraSegmentLabelValue(segment);
          if (label) {
            const basePos = segment.labelPoint ? fitPoint(segment.labelPoint, view) : midpoint(p1, p2);
            const pos = getLabelPosition('extraSegment', segment.id, basePos);
            if (state.extraSegmentArcVisible[segment.id]) {
              drawSideLabelArc(p1, p2, tCenter, pos, null, segmentColor);
            }
            const textNode = createTextLabel(label, {
              x: pos.x,
              y: pos.y,
              'text-anchor': 'middle',
              'dominant-baseline': 'middle',
              'font-size': '46',
              'font-weight': '700',
              fill: segmentColor,
              'data-label-kind': 'extraSegment',
              'data-label-id': segment.id
            });
            if (segmentHitEnabled) {
              attachLabelHit(textNode, 'extraSegment', segment.id);
            }
            stage.appendChild(textNode);
          }
        });

        if (centerPoint && tSpecialCenter) {
          [['A', tA], ['B', tB], ['C', tC]].forEach(function (entry) {
            const centerLineColor = getSegmentColor('centerLine', entry[0]);
            const visibleLine = createSvg('line', {
              x1: tSpecialCenter.x,
              y1: tSpecialCenter.y,
              x2: entry[1].x,
              y2: entry[1].y,
              stroke: centerLineColor,
              'stroke-width': '2.4',
              'stroke-linecap': 'round',
              'stroke-dasharray': '7 7'
            });
            attachHit(visibleLine, 'centerLine', entry[0]);
            stage.appendChild(visibleLine);
            drawSideKind(stage, state.centerLineKinds && state.centerLineKinds[entry[0]], tSpecialCenter, entry[1], centerLineColor);
            const hitLine = createSvg('line', {
              x1: tSpecialCenter.x,
              y1: tSpecialCenter.y,
              x2: entry[1].x,
              y2: entry[1].y,
              stroke: 'transparent',
              'stroke-width': '9',
              'stroke-linecap': 'round'
            });
            attachHit(hitLine, 'centerLine', entry[0]);
            stage.appendChild(hitLine);
            const label = getCenterLineLabelValue(entry[0], centerPoint);
            if (label) {
              const pos = getLabelPosition('centerLine', entry[0], midpoint(tSpecialCenter, entry[1]));
              if (state.centerLineArcVisible && state.centerLineArcVisible[entry[0]]) {
                drawSideLabelArc(tSpecialCenter, entry[1], tCenter, pos, null, centerLineColor);
              }
              const textNode = createTextLabel(label, {
                x: pos.x,
                y: pos.y,
                'text-anchor': 'middle',
                'dominant-baseline': 'middle',
                'font-size': '46',
                'font-weight': '700',
                fill: centerLineColor,
                'data-label-kind': 'centerLine',
                'data-label-id': entry[0]
              });
              attachLabelHit(textNode, 'centerLine', entry[0]);
              stage.appendChild(textNode);
            }
          });
          stage.appendChild(createSvg('circle', {
            cx: tSpecialCenter.x,
            cy: tSpecialCenter.y,
            r: 8,
            fill: '#25603b'
          }));
          const centerId = config.centerLabel || 'O';
          const centerPointNode = createSvg('circle', {
            cx: tSpecialCenter.x,
            cy: tSpecialCenter.y,
            r: 30,
            fill: 'transparent',
            stroke: 'none'
          });
          attachHit(centerPointNode, 'point', centerId);
          stage.appendChild(centerPointNode);
          const centerLabel = getPointLabelValue(centerId);
          if (centerLabel) {
            const centerLabelPoint = getLabelPosition('point', centerId, {
              x: tSpecialCenter.x + 34,
              y: tSpecialCenter.y - 30
            });
            const centerTextNode = createTextLabel(centerLabel, {
              x: centerLabelPoint.x,
              y: centerLabelPoint.y,
              'text-anchor': 'middle',
              'dominant-baseline': 'middle',
              'font-size': '54',
              'font-weight': '700',
              fill: getPointColor(centerId, '#25603b'),
              'data-label-kind': 'point',
              'data-label-id': centerId
            });
            attachLabelHit(centerTextNode, 'point', centerId);
            stage.appendChild(centerTextNode);
          }
        }

        [['A', tA], ['B', tB], ['C', tC]].forEach(function (entry) {
          const point = createSvg('circle', {
            cx: entry[1].x,
            cy: entry[1].y,
            r: 8,
            fill: '#1f2430'
          });
          attachHit(point, 'point', entry[0]);
          stage.appendChild(point);
        });

        extraPoints.forEach(function (entry) {
          const point = createSvg('circle', {
            cx: entry.screenPoint.x,
            cy: entry.screenPoint.y,
            r: entry.radius || 6,
            fill: entry.fill || '#25603b'
          });
          attachHit(point, 'point', entry.id);
          stage.appendChild(point);
        });

        const angleHitStrokeWidth = 44;
        const sideHitStrokeWidth = 9;
        const baseAngleHitScreenRadii = {};
        [['A', geometry.A, geometry.B, geometry.C], ['B', geometry.B, geometry.C, geometry.A], ['C', geometry.C, geometry.A, geometry.B]].forEach(function (entry) {
          const angleColor = getAngleColor('angle', entry[0]);
          const angleArcRadius = pageAngleArcRadius * getAngleArcScale('angle', entry[0]);
          const angleHitRadius = angleHitRadiusFor(angleArcRadius);
          baseAngleHitScreenRadii[entry[0]] = Math.max(
            angleHitRadius * view.scale,
            (angleArcRadius * view.scale) + (angleHitStrokeWidth / 2)
          );
          const arc = arcPoints(entry[1], entry[2], entry[3], angleArcRadius).map(function (point) { return fitPoint(point, view); });
          const kind = state.angleKinds[entry[0]] || 'plain';
          if (kind !== 'hidden') {
            if (kind !== 'right') {
              const visible = createSvg('path', {
                d: pathFromPoints(arc),
                fill: 'none',
                stroke: angleColor,
                'stroke-width': '2.2',
                'stroke-linecap': 'round',
                'stroke-linejoin': 'round'
              });
              stage.appendChild(visible);
            }
            window.InstantGeometryMobileAngleOrnaments.drawAngleKind(stage, kind, arc, fitPoint(entry[1], view), tCenter, createSvg, {
              p1: fitPoint(entry[2], view),
              p2: fitPoint(entry[3], view)
            }, {
              scale: config.angleMarkScale || 1,
              color: angleColor
            });
          }
          const arcHit = createSvg('path', {
            d: pathFromPoints(arc),
            fill: 'none',
            stroke: 'transparent',
            'stroke-width': String(angleHitStrokeWidth),
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
            'pointer-events': 'stroke'
          });
          const hitArc = arcPoints(entry[1], entry[2], entry[3], angleHitRadius).map(function (point) { return fitPoint(point, view); });
          const hit = createSvg('path', {
            d: sectorPath(fitPoint(entry[1], view), hitArc),
            fill: 'transparent',
            stroke: 'none'
          });
          if (isBaseAngleHitEnabled(entry[0])) {
            attachHit(arcHit, 'angle', entry[0]);
            stage.appendChild(arcHit);
            attachHit(hit, 'angle', entry[0]);
            stage.appendChild(hit);
          }
        });

        extraAngles.forEach(function (angle) {
          const vertex = angle.vertex;
          const p1 = angle.p1;
          const p2 = angle.p2;
          const angleColor = getAngleColor('extraAngle', angle.id);
          const angleArcRadius = pageAngleArcRadius * getAngleArcScale('extraAngle', angle.id);
          const arc = arcPoints(vertex, p1, p2, angleArcRadius).map(function (point) { return fitPoint(point, view); });
          const kind = state.extraAngleKinds[angle.id] || 'plain';
          if (kind !== 'hidden') {
            if (kind !== 'right') {
              stage.appendChild(createSvg('path', {
                d: pathFromPoints(arc),
                fill: 'none',
                stroke: angleColor,
                'stroke-width': '2.2',
                'stroke-linecap': 'round',
                'stroke-linejoin': 'round'
              }));
            }
            window.InstantGeometryMobileAngleOrnaments.drawAngleKind(stage, kind, arc, fitPoint(vertex, view), tCenter, createSvg, {
              p1: fitPoint(p1, view),
              p2: fitPoint(p2, view)
            }, {
              scale: angle.markScale || config.extraAngleMarkScale || config.angleMarkScale || 1,
              color: angleColor
            });
          }
          const arcHit = createSvg('path', {
            d: pathFromPoints(arc),
            fill: 'none',
            stroke: 'transparent',
            'stroke-width': String(angleHitStrokeWidth),
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
            'pointer-events': 'stroke'
          });
          const hitArc = arcPoints(vertex, p1, p2, angle.hitRadius || angleHitRadiusFor(angleArcRadius)).map(function (point) { return fitPoint(point, view); });
          const hit = createSvg('path', {
            d: sectorPath(fitPoint(vertex, view), hitArc),
            fill: 'transparent',
            stroke: 'none'
          });
          attachHit(arcHit, 'extraAngle', angle.id);
          stage.appendChild(arcHit);
          attachHit(hit, 'extraAngle', angle.id);
          stage.appendChild(hit);
        });

        [['a', tB, tC], ['b', tC, tA], ['c', tA, tB]].forEach(function (entry) {
          if (!isBaseSideHitEnabled(entry[0])) return;
          const endpointIds = {
            a: ['B', 'C'],
            b: ['C', 'A'],
            c: ['A', 'B']
          }[entry[0]];
          const startInset = (baseAngleHitScreenRadii[endpointIds[0]] || 118) + 1;
          const endInset = (baseAngleHitScreenRadii[endpointIds[1]] || 118) + 1;
          const segment = insetSegmentByEnds(entry[1], entry[2], startInset, endInset);
          const sideHit = createSvg('line', {
            x1: segment.p1.x,
            y1: segment.p1.y,
            x2: segment.p2.x,
            y2: segment.p2.y,
            stroke: 'transparent',
            'stroke-width': String(sideHitStrokeWidth),
            'stroke-linecap': 'butt',
            'pointer-events': 'stroke'
          });
          attachHit(sideHit, 'side', entry[0]);
          stage.appendChild(sideHit);
        });

        bringHitKindsToFront(['angle', 'extraAngle']);

        [['A', geometry.A], ['B', geometry.B], ['C', geometry.C]].forEach(function (entry) {
          const label = getPointLabelValue(entry[0]);
          if (!label) return;
          const target = getLabelPosition('point', entry[0], fitPoint(interiorLabel(entry[1], center, -0.12), view));
          const textNode = createTextLabel(label, {
            x: target.x,
            y: target.y,
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            'font-size': '60',
            'font-weight': '700',
            fill: getPointColor(entry[0]),
            'data-label-kind': 'point',
            'data-label-id': entry[0]
          });
          attachLabelHit(textNode, 'point', entry[0]);
          stage.appendChild(textNode);
        });

        extraPoints.forEach(function (entry) {
          const label = getPointLabelValue(entry.id);
          if (!label) return;
          const labelPoint = entry.labelPoint ? fitPoint(entry.labelPoint, view) : {
            x: entry.screenPoint.x + 25,
            y: entry.screenPoint.y + 24
          };
          const target = getLabelPosition('point', entry.id, labelPoint);
          const textNode = createTextLabel(label, {
            x: target.x,
            y: target.y,
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            'font-size': String(entry.labelFontSize || 42),
            'font-weight': '700',
            fill: getPointColor(entry.id, entry.fill || '#25603b'),
            'data-label-kind': 'point',
            'data-label-id': entry.id
          });
          attachLabelHit(textNode, 'point', entry.id);
          stage.appendChild(textNode);
        });

        extraAngles.forEach(function (angle) {
          const label = getExtraAngleLabelValue(angle);
          if (!label) return;
          const basePos = angle.labelPoint
            ? fitPoint(angle.labelPoint, view)
            : fitPoint(interiorLabel(angle.vertex, center, angle.labelRate || 0.38), view);
          const pos = getLabelPosition('extraAngle', angle.id, basePos);
          const textNode = createTextLabel(label, {
            x: pos.x,
            y: pos.y,
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            'font-size': String(angle.labelFontSize || 48),
            'font-weight': '700',
            fill: getAngleColor('extraAngle', angle.id),
            'data-label-kind': 'extraAngle',
            'data-label-id': angle.id
          });
          attachLabelHit(textNode, 'extraAngle', angle.id);
          stage.appendChild(textNode);
        });

        [['a', geometry.B, geometry.C], ['b', geometry.C, geometry.A], ['c', geometry.A, geometry.B]].forEach(function (entry) {
          const label = getSideLabelValue(entry[0]);
          if (!label) return;
          const p1 = fitPoint(entry[1], view);
          const p2 = fitPoint(entry[2], view);
          const base = screenNormalOffset(p1, p2, tCenter, 58);
          const pos = getLabelPosition('side', entry[0], base);
          const textNode = createTextLabel(label, {
            x: pos.x,
            y: pos.y,
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            'font-size': '60',
            'font-weight': '700',
            fill: getSideColor(entry[0]),
            'data-label-kind': 'side',
            'data-label-id': entry[0],
            'data-side-length': Math.hypot(p2.x - p1.x, p2.y - p1.y)
          });
          let labelWidth = 0;
          if (state.sideArcVisible[entry[0]] !== false) {
            try {
              stage.appendChild(textNode);
              const bbox = textNode.getBBox();
              labelWidth = Math.max(bbox.width, bbox.height * 0.9);
              textNode.remove();
            } catch (_) {
              if (textNode.parentNode === stage) stage.removeChild(textNode);
            }
            drawSideLabelArc(p1, p2, tCenter, pos, labelWidth, getSideColor(entry[0]));
          }
          attachLabelHit(textNode, 'side', entry[0]);
          stage.appendChild(textNode);
        });

        [['A', geometry.A], ['B', geometry.B], ['C', geometry.C]].forEach(function (entry) {
          const label = getAngleLabelValue(entry[0]);
          if (!label) return;
          const pos = getLabelPosition('angle', entry[0], fitPoint(interiorLabel(entry[1], center, 0.38), view));
          const textNode = createTextLabel(label, {
            x: pos.x,
            y: pos.y,
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            'font-size': '48',
            'font-weight': '700',
            fill: getAngleColor('angle', entry[0]),
            'data-label-kind': 'angle',
            'data-label-id': entry[0]
          });
          attachLabelHit(textNode, 'angle', entry[0]);
          stage.appendChild(textNode);
        });

        const areaLabel = getAreaLabelValue();
        if (areaLabel) {
          const fittedArea = fittedAreaLabel([tA, tB, tC], areaLabel, 60);
          const areaPos = getLabelPosition('area', 'main', fittedArea);
          const textNode = createTextLabel(areaLabel, {
            x: areaPos.x,
            y: areaPos.y,
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            'font-size': fittedArea.fontSize,
            style: 'font-size:' + fittedArea.fontSize + 'px',
            'font-weight': '700',
            fill: areaLabelColor(state.areaColor || '#2a5bd7'),
            'data-label-kind': 'area',
            'data-label-id': 'main'
          });
          attachLabelHit(textNode, 'area', 'main');
          stage.appendChild(textNode);
        }

        extraAreas.forEach(function (area) {
          const label = getExtraAreaLabelValue(area);
          if (!label) return;
          const color = state.extraAreaColors[area.id] || area.color || state.areaColor || '#2a5bd7';
          const areaPoints = area.points.map(function (point) { return fitPoint(point, view); });
          const fitted = fittedAreaLabel(areaPoints, label, 54);
          const pos = getLabelPosition('extraArea', area.id, fitted);
          const textNode = createTextLabel(label, {
            x: pos.x,
            y: pos.y,
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            'font-size': fitted.fontSize,
            style: 'font-size:' + fitted.fontSize + 'px',
            'font-weight': '700',
            fill: areaLabelColor(color),
            'data-label-kind': 'extraArea',
            'data-label-id': area.id
          });
          attachLabelHit(textNode, 'extraArea', area.id);
          stage.appendChild(textNode);
        });

        fitStageViewBox(stage);
        renderKatexLiveLayer();
        setStatus(config.readyMessage, false);
      } catch (error) {
        stage.setAttribute('viewBox', '0 0 1000 1000');
        katexLiveLayer.innerHTML = '';
        setStatus(error.message || '描画に失敗しました。', true);
      }
    }

    async function saveAs(format) {
      const backgroundColor = format === 'transparent' ? null : '#ffffff';
      if (document.fonts && document.fonts.ready) {
        try { await document.fonts.ready; } catch (_) {}
      }
      captureRoot.classList.add('capture-hide-hit-debug');
      const cleanupKatexOverlay = prepareKatexCaptureOverlay();
      let canvas;
      try {
        canvas = await html2canvas(captureRoot, {
          backgroundColor: backgroundColor,
          scale: 2
        });
      } finally {
        cleanupKatexOverlay();
        captureRoot.classList.remove('capture-hide-hit-debug');
      }
      if (format === 'png' || format === 'transparent') {
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = format === 'transparent' ? config.fileBase + '-transparent.png' : config.fileBase + '.png';
        link.click();
        return;
      }
      const jsPDF = window.jspdf && window.jspdf.jsPDF;
      if (!jsPDF) throw new Error('PDF 出力に失敗しました。');
      const pdf = new jsPDF('portrait', 'mm', 'a4');
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      let drawW = pageW;
      let drawH = canvas.height * drawW / canvas.width;
      if (drawH > pageH) {
        drawH = pageH;
        drawW = canvas.width * drawH / canvas.height;
      }
      const x = (pageW - drawW) / 2;
      const y = (pageH - drawH) / 2;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, drawW, drawH);
      pdf.save(config.fileBase + '.pdf');
    }

    async function saveWithQuota(format) {
      if (!window.InstantGeometrySaveQuota) {
        await saveAs(format);
        return;
      }
      await window.InstantGeometrySaveQuota.runWithQuota(function () {
        return saveAs(format);
      });
    }

    Object.keys(controlInputs).forEach(function (key) {
      controlInputs[key].addEventListener('input', render);
    });

    backBtn.addEventListener('click', function () {
      window.history.back();
    });

    saveBtn.addEventListener('click', function () {
      if (moveMode) return;
      openSheet('save');
    });

    document.addEventListener('instant-geometry-settings:changed', function () {
      if (window.InstantGeometryDrawSettings && typeof window.InstantGeometryDrawSettings.getDecimalPlaces === 'function') {
        state.decimalPlaces = setActiveDecimalPlaces(window.InstantGeometryDrawSettings.getDecimalPlaces());
      }
      render();
    });

    moveCancelBtn.addEventListener('click', function () {
      finishMoveMode(true);
    });

    moveDoneBtn.addEventListener('click', function () {
      finishMoveMode(false);
    });

    window.addEventListener('pointermove', function (event) {
      if (!moveDrag) return;
      event.preventDefault();
      const point = pointerToSvgPoint(event);
      const offset = ensureLabelOffset(moveDrag.kind, moveDrag.id);
      offset.x = moveDrag.startOffset.x + (point.x - moveDrag.startPoint.x);
      offset.y = moveDrag.startOffset.y + (point.y - moveDrag.startPoint.y);
      render();
    }, { passive: false });

    window.addEventListener('pointerup', function () {
      moveDrag = null;
    });

    window.addEventListener('pointercancel', function () {
      moveDrag = null;
    });

    sheetBackdrop.addEventListener('click', function () {
      if (!moveMode) closeSheets();
    });
    sheetClose.addEventListener('click', closeSheets);
    saveSheetClose.addEventListener('click', closeSheets);

    savePngBtn.addEventListener('click', async function () {
      try {
        await saveWithQuota('png');
        closeSheets();
      } catch (error) {
        setStatus(error.message || '保存に失敗しました。', true);
      }
    });

    saveTransparentBtn.addEventListener('click', async function () {
      try {
        await saveWithQuota('transparent');
        closeSheets();
      } catch (error) {
        setStatus(error.message || '保存に失敗しました。', true);
      }
    });

    savePdfBtn.addEventListener('click', async function () {
      try {
        await saveWithQuota('pdf');
        closeSheets();
      } catch (error) {
        setStatus(error.message || '保存に失敗しました。', true);
      }
    });

    render();
  }

  window.InstantGeometryTriangleMobile = {
    createPage: createPage,
    helpers: {
      computeTriangleFromSides: computeTriangleFromSides,
      computeTriangleFromSAS: computeTriangleFromSAS,
      computeTriangleFromASA: computeTriangleFromASA,
      computeTriangleFromAAA: computeTriangleFromAAA,
      computeTriangleFromAAS: computeTriangleFromAAS,
      parseNatural: parseNatural,
      formatPreferredNumber: formatPreferredNumber,
      formatPythagoreanLeg: formatPythagoreanLeg,
      formatPythagoreanLegFromInputs: formatPythagoreanLegFromInputs,
      formatPythagoreanHypotenuse: formatPythagoreanHypotenuse,
      formatSpecialRightTriangleSide: formatSpecialRightTriangleSide,
      formatHeronArea: formatHeronArea,
      formatHeronAreaFromInputs: formatHeronAreaFromInputs,
      formatHeronInradius: formatHeronInradius,
      formatIncenterSubArea: formatIncenterSubArea,
      triangleCenterPoint: triangleCenterPoint
    }
  };
})();
