(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const PROCESSED = 'data-rich-label-source';

  function svg(tag, attrs) {
    const node = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (key) {
      node.setAttribute(key, attrs[key]);
    });
    return node;
  }

  function normalizeMathText(text) {
    const subscriptMap = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };
    return String(text || '')
      .replace(/->/g, '→')
      .replace(/sqrt\s*\(?\s*([0-9a-zA-Zπθαβγδλμσω]+)\s*\)?/g, '√$1')
      .replace(/log([₀₁₂₃₄₅₆₇₈₉]+)/g, function (_, digits) {
        return 'log_' + digits.split('').map(function (digit) { return subscriptMap[digit] || digit; }).join('');
      })
      .replace(/\bpi\b/g, 'π')
      .replace(/\btheta\b/g, 'θ')
      .replace(/\balpha\b/g, 'α')
      .replace(/\bbeta\b/g, 'β')
      .replace(/\bgamma\b/g, 'γ')
      .replace(/\bdelta\b/g, 'δ')
      .replace(/\blambda\b/g, 'λ')
      .replace(/\bmu\b/g, 'μ')
      .replace(/\bsigma\b/g, 'σ')
      .replace(/\bomega\b/g, 'ω');
  }

  function createTextNode(text, size, className) {
    const node = svg('text', {
      x: 0,
      y: 0,
      class: 'function-rich-label-text ' + (className || ''),
      'font-size': size,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle'
    });
    node.textContent = normalizeMathText(text);
    return node;
  }

  function measure(stage, node, fallbackSize) {
    stage.appendChild(node);
    const box = node.getBBox();
    stage.removeChild(node);
    return {
      width: Math.max(box.width, fallbackSize * 0.3),
      height: Math.max(box.height, fallbackSize)
    };
  }

  function makeLayout(node, width, height, inner) {
    return { node: node, width: Math.max(1, width), height: Math.max(1, height), inner: inner || null };
  }

  function appendLayout(parent, layout, x, y, scale) {
    const node = layout.node;
    const parts = ['translate(' + x + ' ' + y + ')'];
    if (scale && Math.abs(scale - 1) > 1e-4) parts.push('scale(' + scale + ')');
    node.setAttribute('transform', parts.join(' '));
    parent.appendChild(node);
  }

  function createTextLayout(stage, text, size, className) {
    const node = createTextNode(text, size, className);
    const box = measure(stage, node.cloneNode(true), size);
    return makeLayout(node, box.width, box.height);
  }

  function createSequenceLayout(stage, items, size) {
    if (!items.length) return createTextLayout(stage, '', size);
    const gap = Math.max(2, size * 0.05);
    const width = items.reduce(function (sum, item, index) {
      return sum + item.width + (index ? gap : 0);
    }, 0);
    const height = items.reduce(function (max, item) { return Math.max(max, item.height); }, size);
    const group = svg('g', {});
    let cursor = -width / 2;
    items.forEach(function (item, index) {
      if (index) cursor += gap;
      appendLayout(group, item, cursor + item.width / 2, 0, 1);
      cursor += item.width;
    });
    return makeLayout(group, width, height);
  }

  function createParenthesizedLayout(stage, inner, size) {
    return createDelimitedLayout(stage, inner, '(', ')', size);
  }

  function createFractionLayout(numeratorLayout, denominatorLayout, size) {
    const group = svg('g', {});
    const scale = 0.78;
    const numerator = numeratorLayout.inner || numeratorLayout;
    const denominator = denominatorLayout.inner || denominatorLayout;
    const nWidth = numerator.width * scale;
    const dWidth = denominator.width * scale;
    const ruleWidth = Math.max(nWidth, dWidth, size * 0.8) + size * 0.18;
    appendLayout(group, numerator, 0, -size * 0.34, scale);
    group.appendChild(svg('line', {
      x1: -ruleWidth / 2,
      y1: 0,
      x2: ruleWidth / 2,
      y2: 0,
      class: 'function-rich-fraction-rule'
    }));
    appendLayout(group, denominator, 0, size * 0.44, scale);
    return makeLayout(group, ruleWidth, size * 1.25);
  }

  function createSqrtLayout(stage, radicand, size, indexLayout) {
    const group = svg('g', {});
    const scale = 0.86;
    const indexScale = 0.52;
    const radicalWidth = size * 0.58;
    const indexWidth = indexLayout ? indexLayout.width * indexScale + size * 0.06 : 0;
    const radicandWidth = radicand.width * scale;
    const width = indexWidth + radicalWidth + radicandWidth + size * 0.12;
    const topY = -size * 0.42;
    const radicalStart = -width / 2 + indexWidth;
    const radicandX = radicalStart + radicalWidth + radicandWidth / 2 + size * 0.04;
    const radicandLeft = radicandX - radicandWidth / 2;
    const radicandRight = radicandX + radicandWidth / 2;
    if (indexLayout) appendLayout(group, indexLayout, -width / 2 + indexLayout.width * indexScale / 2, topY + size * 0.08, indexScale);
    const radicalGlyph = createTextLayout(stage, '√', Math.round(size * 1.02), 'function-rich-sqrt-glyph');
    appendLayout(group, radicalGlyph, radicalStart + radicalWidth * 0.36, size * 0.04, 1);
    appendLayout(group, radicand, radicandX, size * 0.02, scale);
    group.appendChild(svg('path', {
      d: ['M', radicandLeft - size * 0.06, topY, 'L', radicandRight + size * 0.10, topY].join(' '),
      class: 'function-rich-sqrt-rule'
    }));
    return makeLayout(group, width, size * 1.18);
  }

  function createSubscriptLayout(stage, base, subscript, size) {
    const group = svg('g', {});
    const baseLayout = createTextLayout(stage, base, size);
    const subLayout = createTextLayout(stage, subscript, Math.round(size * 0.58));
    const gap = Math.max(1, size * 0.02);
    const width = baseLayout.width + gap + subLayout.width;
    appendLayout(group, baseLayout, -width / 2 + baseLayout.width / 2, 0, 1);
    appendLayout(group, subLayout, width / 2 - subLayout.width / 2, size * 0.22, 1);
    return makeLayout(group, width, size * 1.08);
  }

  function createSuperscriptLayout(base, exponent, size) {
    const group = svg('g', {});
    const scale = 0.66;
    const gap = Math.max(1, size * 0.02);
    const width = base.width + gap + exponent.width * scale;
    appendLayout(group, base, -width / 2 + base.width / 2, 0, 1);
    appendLayout(group, exponent, width / 2 - exponent.width * scale / 2, -size * 0.34, scale);
    return makeLayout(group, width, Math.max(base.height, size * 1.28));
  }

  function createVectorLayout(inner, size) {
    const group = svg('g', {});
    const width = inner.width + size * 0.16;
    appendLayout(group, inner, 0, size * 0.08, 1);
    const y = -inner.height * 0.5 - size * 0.12;
    const x1 = -inner.width / 2 + size * 0.08;
    const x2 = inner.width / 2 - size * 0.04;
    group.appendChild(svg('path', {
      d: ['M', x1, y, 'L', x2, y, 'M', x2 - size * 0.18, y - size * 0.10, 'L', x2, y, 'L', x2 - size * 0.18, y + size * 0.10].join(' '),
      class: 'function-rich-vector-arrow'
    }));
    return makeLayout(group, width, inner.height + size * 0.34);
  }

  function createDelimitedLayout(stage, inner, leftText, rightText, size) {
    const group = svg('g', {});
    const left = createTextLayout(stage, leftText, size);
    const right = createTextLayout(stage, rightText, size);
    const width = left.width + inner.width + right.width;
    appendLayout(group, left, -width / 2 + left.width / 2, 0, 1);
    appendLayout(group, inner, -width / 2 + left.width + inner.width / 2, 0, 1);
    appendLayout(group, right, width / 2 - right.width / 2, 0, 1);
    return makeLayout(group, width, Math.max(size, inner.height), inner);
  }

  function createFunctionCallLayout(stage, name, argument, size) {
    const group = svg('g', {});
    const nameLayout = createTextLayout(stage, name, size);
    const gap = Math.max(2, size * 0.08);
    const width = nameLayout.width + gap + argument.width;
    appendLayout(group, nameLayout, -width / 2 + nameLayout.width / 2, 0, 1);
    appendLayout(group, argument, width / 2 - argument.width / 2, 0, 1);
    return makeLayout(group, width, Math.max(nameLayout.height, argument.height));
  }

  function createLargeOperatorLayout(stage, symbol, lower, upper, body, size) {
    const group = svg('g', {});
    const operatorSize = symbol === 'lim' ? Math.round(size * 0.92) : (symbol === '∫' ? Math.round(size * 1.58) : Math.round(size * 1.30));
    const operator = createTextLayout(stage, symbol, operatorSize, 'function-rich-large-operator');
    const limitScale = symbol === 'lim' ? 0.50 : 0.56;
    const bodyGap = Math.max(5, size * 0.16);
    const limitWidth = Math.max(lower.width, upper.width) * limitScale;
    const limitShift = symbol === '∫' ? size * 0.34 : 0;
    const operatorWidth = Math.max(operator.width, limitWidth + limitShift);
    const bodyGapAdjusted = symbol === '∫' ? Math.max(bodyGap, size * 0.30) : (symbol === 'lim' ? Math.max(bodyGap, size * 0.24) : bodyGap);
    const bodyX = -((operatorWidth + bodyGapAdjusted + body.width) / 2) + operatorWidth + bodyGapAdjusted + body.width / 2;
    const operatorX = -((operatorWidth + bodyGapAdjusted + body.width) / 2) + operator.width / 2;
    const limitX = symbol === '∫' ? operatorX + size * 0.58 : operatorX;
    appendLayout(group, operator, operatorX, 0, 1);
    if (symbol !== 'lim') appendLayout(group, upper, limitX, -size * 0.76, limitScale);
    appendLayout(group, lower, limitX, symbol === 'lim' ? size * 0.50 : size * 0.78, limitScale);
    appendLayout(group, body, bodyX, 0, 1);
    return makeLayout(group, operatorWidth + bodyGapAdjusted + body.width, Math.max(operator.height, body.height) + size * 0.86);
  }

  function findMatching(text, start, open, close) {
    let depth = 0;
    for (let i = start; i < text.length; i += 1) {
      if (text[i] === open) depth += 1;
      if (text[i] === close) {
        depth -= 1;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  function findMatchingParen(text, start) { return findMatching(text, start, '(', ')'); }
  function findMatchingBracket(text, start) { return findMatching(text, start, '[', ']'); }

  function findClosingBars(text, start, count) {
    for (let i = start; i < text.length; i += 1) {
      if (count === 2 && text.slice(i, i + 2) === '||') return i;
      if (count === 1 && text[i] === '|' && text[i + 1] !== '|') return i;
    }
    return -1;
  }

  function splitTopLevel(text, separator) {
    const parts = [];
    let start = 0;
    let parenDepth = 0;
    let bracketDepth = 0;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (ch === '(') parenDepth += 1;
      if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
      if (ch === '[') bracketDepth += 1;
      if (ch === ']') bracketDepth = Math.max(0, bracketDepth - 1);
      if (ch === separator && parenDepth === 0 && bracketDepth === 0) {
        parts.push(text.slice(start, i));
        start = i + 1;
      }
    }
    parts.push(text.slice(start));
    return parts;
  }

  function parseDelimitedArgs(source, expectedCount) {
    const parts = splitTopLevel(source, ',').map(function (part) { return part.trim(); });
    if (parts.length !== expectedCount || parts.some(function (part) { return !part; })) return null;
    return parts;
  }

  function parseMatrixRows(source) {
    const text = source.trim();
    if (!text || text[0] !== '[' || text[text.length - 1] !== ']') return null;
    const body = text.slice(1, -1);
    const rows = [];
    for (let i = 0; i < body.length;) {
      if (body[i] === ',') {
        i += 1;
        continue;
      }
      if (body[i] !== '[') return null;
      const end = findMatchingBracket(body, i);
      if (end === -1) return null;
      const row = splitTopLevel(body.slice(i + 1, end), ',').map(function (cell) { return cell.trim(); });
      if (!row.length || row.length > 3 || row.some(function (cell) { return !cell; })) return null;
      rows.push(row);
      i = end + 1;
      if (body[i] === ',') i += 1;
    }
    if (!rows.length || rows.length > 3) return null;
    const width = rows[0].length;
    if (width > 3 || rows.some(function (row) { return row.length !== width; })) return null;
    return rows;
  }

  function createMatrixLayout(stage, rows, size) {
    const group = svg('g', {});
    const cellLayouts = rows.map(function (row) {
      return row.map(function (cell) { return parseMathLayout(stage, cell, Math.round(size * 0.72)); });
    });
    const columnCount = Math.max.apply(null, cellLayouts.map(function (row) { return row.length; }));
    const columnWidths = Array.from({ length: columnCount }, function (_, col) {
      return cellLayouts.reduce(function (max, row) { return Math.max(max, row[col] ? row[col].width : 0); }, size * 0.55);
    });
    const rowHeights = cellLayouts.map(function (row) {
      return row.reduce(function (max, cell) { return Math.max(max, cell.height); }, size * 0.78);
    });
    const colGap = Math.max(12, size * 0.34);
    const rowGap = Math.max(8, size * 0.24);
    const bracketPad = Math.max(9, size * 0.28);
    const contentWidth = columnWidths.reduce(function (sum, width) { return sum + width; }, 0) + colGap * Math.max(0, columnCount - 1);
    const contentHeight = rowHeights.reduce(function (sum, height) { return sum + height; }, 0) + rowGap * Math.max(0, rowHeights.length - 1);
    const width = contentWidth + bracketPad * 2;
    const height = Math.max(contentHeight, size);
    let y = -contentHeight / 2;
    cellLayouts.forEach(function (row, rowIndex) {
      let x = -contentWidth / 2;
      row.forEach(function (cell, colIndex) {
        const colWidth = columnWidths[colIndex];
        appendLayout(group, cell, x + colWidth / 2, y + rowHeights[rowIndex] / 2, 1);
        x += colWidth + colGap;
      });
      y += rowHeights[rowIndex] + rowGap;
    });
    const leftX = -width / 2;
    const rightX = width / 2;
    const topY = -height / 2;
    const bottomY = height / 2;
    const arm = Math.max(5, size * 0.16);
    group.appendChild(svg('path', { d: ['M', leftX + arm, topY, 'L', leftX, topY, 'L', leftX, bottomY, 'L', leftX + arm, bottomY].join(' '), class: 'function-rich-matrix-bracket' }));
    group.appendChild(svg('path', { d: ['M', rightX - arm, topY, 'L', rightX, topY, 'L', rightX, bottomY, 'L', rightX - arm, bottomY].join(' '), class: 'function-rich-matrix-bracket' }));
    return makeLayout(group, width, height);
  }

  function isOperator(ch) {
    return ch === '+' || ch === '=' || ch === '·' || ch === '*';
  }

  function consumePlain(text, index) {
    let i = index;
    if (text[i] === '-' && /[0-9.]/.test(text[i + 1] || '')) i += 1;
    while (i < text.length && !/[()[\],/√+\-=·*_^|]/.test(text[i])) i += 1;
    if (i === index) i += 1;
    return { raw: text.slice(index, i), next: i };
  }

  function readIdentifier(text, index) {
    const match = /^[a-zA-Z]+/.exec(text.slice(index));
    if (!match) return null;
    return { value: match[0], next: index + match[0].length };
  }

  function parseAtom(stage, text, index, size, includeParens) {
    const ch = text[index];
    if (text.slice(index, index + 4) === 'lim(') {
      const targetEnd = findMatchingParen(text, index + 3);
      if (targetEnd !== -1 && text[targetEnd + 1] === '(') {
        const bodyEnd = findMatchingParen(text, targetEnd + 1);
        if (bodyEnd !== -1) {
          return { layout: createLargeOperatorLayout(stage, 'lim', parseMathLayout(stage, text.slice(index + 4, targetEnd), Math.round(size * 0.72)), createTextLayout(stage, '', Math.round(size * 0.72)), parseMathLayout(stage, text.slice(targetEnd + 2, bodyEnd), size), size), next: bodyEnd + 1 };
        }
      }
    }
    if (text.slice(index, index + 4) === 'sum(' || text.slice(index, index + 4) === 'int(') {
      const kind = text.slice(index, index + 3);
      const boundsEnd = findMatchingParen(text, index + 3);
      if (boundsEnd !== -1 && text[boundsEnd + 1] === '(') {
        const bodyEnd = findMatchingParen(text, boundsEnd + 1);
        const bounds = parseDelimitedArgs(text.slice(index + 4, boundsEnd), 2);
        if (bodyEnd !== -1 && bounds) {
          return { layout: createLargeOperatorLayout(stage, kind === 'sum' ? 'Σ' : '∫', parseMathLayout(stage, bounds[0], Math.round(size * 0.72)), parseMathLayout(stage, bounds[1], Math.round(size * 0.72)), parseMathLayout(stage, text.slice(boundsEnd + 2, bodyEnd), size), size), next: bodyEnd + 1 };
        }
      }
    }
    if (text.slice(index, index + 4) === 'mat[') {
      const end = findMatchingBracket(text, index + 3);
      if (end !== -1) {
        const rows = parseMatrixRows(text.slice(index + 3, end + 1));
        if (rows) return { layout: createMatrixLayout(stage, rows, size), next: end + 1 };
      }
    }
    if (text.slice(index, index + 5) === 'root(') {
      const indexEnd = findMatchingParen(text, index + 4);
      if (indexEnd !== -1 && text[indexEnd + 1] === '(') {
        const radicandEnd = findMatchingParen(text, indexEnd + 1);
        if (radicandEnd !== -1) {
          return { layout: createSqrtLayout(stage, parseMathLayout(stage, text.slice(indexEnd + 2, radicandEnd), size), size, parseMathLayout(stage, text.slice(index + 5, indexEnd), Math.round(size * 0.72))), next: radicandEnd + 1 };
        }
      }
    }
    if (text.slice(index, index + 4) === 'vec(') {
      const end = findMatchingParen(text, index + 3);
      if (end !== -1) return { layout: createVectorLayout(parseMathLayout(stage, text.slice(index + 4, end), size), size), next: end + 1 };
    }
    if (text.slice(index, index + 2) === '||') {
      const end = findClosingBars(text, index + 2, 2);
      if (end !== -1) return { layout: createDelimitedLayout(stage, parseMathLayout(stage, text.slice(index + 2, end), size), '||', '||', size), next: end + 2 };
    }
    if (ch === '|') {
      const end = findClosingBars(text, index + 1, 1);
      if (end !== -1) return { layout: createDelimitedLayout(stage, parseMathLayout(stage, text.slice(index + 1, end), size), '|', '|', size), next: end + 1 };
    }
    if (ch === '(') {
      const end = findMatchingParen(text, index);
      if (end !== -1) {
        const inner = parseMathLayout(stage, text.slice(index + 1, end), size);
        return { layout: includeParens === false ? inner : createParenthesizedLayout(stage, inner, size), next: end + 1 };
      }
    }
    if (ch === '√') {
      if (text[index + 1] === '[') {
        const indexEnd = findMatchingBracket(text, index + 1);
        if (indexEnd !== -1 && text[indexEnd + 1] === '(') {
          const radicandEnd = findMatchingParen(text, indexEnd + 1);
          if (radicandEnd !== -1) return { layout: createSqrtLayout(stage, parseMathLayout(stage, text.slice(indexEnd + 2, radicandEnd), size), size, parseMathLayout(stage, text.slice(index + 2, indexEnd), Math.round(size * 0.72))), next: radicandEnd + 1 };
        }
      }
      if (text[index + 1] === '(') {
        const end = findMatchingParen(text, index + 1);
        if (end !== -1) return { layout: createSqrtLayout(stage, parseMathLayout(stage, text.slice(index + 2, end), size), size), next: end + 1 };
      }
      const next = consumePlain(text, index + 1);
      const raw = /^[0-9.]+/.exec(next.raw);
      const atom = raw ? raw[0] : next.raw.slice(0, 1);
      return { layout: createSqrtLayout(stage, createTextLayout(stage, atom, size), size), next: index + 1 + atom.length };
    }
    const identifier = readIdentifier(text, index);
    if (identifier) {
      if (identifier.value === 'log' && text[identifier.next] === '_') {
        const subscript = readSubscript(stage, text, identifier.next, size);
        if (subscript) return { layout: createSubscriptLayout(stage, 'log', text.slice(identifier.next + 1, subscript.next).replace(/[()]/g, ''), size), next: subscript.next };
      }
      if (/^(sin|cos|tan|cot|sec|csc|cosec|sinh|cosh|tanh|coth|sech|csch|cosech|arcsin|arccos|arctan|arccot|arcsec|arccsc|arccosec|arcsinh|arccosh|arctanh|arccoth|arcsech|arccsch|arccosech|ln|log)$/.test(identifier.value)) {
        if (text[identifier.next] === '(') {
          const end = findMatchingParen(text, identifier.next);
          if (end !== -1) return { layout: createFunctionCallLayout(stage, identifier.value, parseMathLayout(stage, text.slice(identifier.next + 1, end), size), size), next: end + 1 };
        }
        return { layout: createTextLayout(stage, identifier.value, size), next: identifier.next };
      }
    }
    const plain = consumePlain(text, index);
    return { layout: createTextLayout(stage, plain.raw, size), next: plain.next };
  }

  function readSubscript(stage, text, index, size) {
    if (text[index] !== '_') return null;
    if (text[index + 1] === '(') {
      const end = findMatchingParen(text, index + 1);
      if (end !== -1) return { layout: parseMathLayout(stage, text.slice(index + 2, end), Math.round(size * 0.7)), next: end + 1 };
    }
    const rest = text.slice(index + 1);
    const numeric = /^[0-9]+(?:\.[0-9]+)?/.exec(rest);
    if (numeric) return { layout: createTextLayout(stage, numeric[0], Math.round(size * 0.72)), next: index + 1 + numeric[0].length };
    if (rest[0]) return { layout: createTextLayout(stage, rest[0], Math.round(size * 0.72)), next: index + 2 };
    const atom = parseAtom(stage, text, index + 1, Math.round(size * 0.72), false);
    return { layout: atom.layout, next: atom.next };
  }

  function readSuperscript(stage, text, index, size) {
    if (text[index] !== '^') return null;
    if (text[index + 1] === '(') {
      const end = findMatchingParen(text, index + 1);
      if (end !== -1) return { layout: parseMathLayout(stage, text.slice(index + 2, end), Math.round(size * 0.72)), next: end + 1 };
    }
    const rest = text.slice(index + 1);
    const numeric = /^-?[0-9]+(?:\.[0-9]+)?/.exec(rest);
    if (numeric) return { layout: createTextLayout(stage, numeric[0], Math.round(size * 0.72)), next: index + 1 + numeric[0].length };
    if (rest[0]) return { layout: createTextLayout(stage, rest[0], Math.round(size * 0.72)), next: index + 2 };
    return null;
  }

  function parseMathLayout(stage, raw, size) {
    const text = normalizeMathText(raw).replace(/\s+/g, '');
    const items = [];
    for (let i = 0; i < text.length;) {
      const ch = text[i];
      if (ch === ')') break;
      if (ch === ']' || ch === ',' || ch === '[') {
        items.push(createTextLayout(stage, ch, size));
        i += 1;
        continue;
      }
      if (ch === '/') {
        const numerator = items.pop();
        const denominator = parseAtom(stage, text, i + 1, size, false);
        if (numerator && denominator.layout) {
          items.push(createFractionLayout(numerator, denominator.layout, size));
          i = denominator.next;
          continue;
        }
      }
      if (isOperator(ch) || (ch === '-' && !/[0-9.]/.test(text[i + 1] || ''))) {
        items.push(createTextLayout(stage, ch, size));
        i += 1;
        continue;
      }
      if (ch === '_') {
        const base = items.pop();
        const subscript = readSubscript(stage, text, i, size);
        if (base && subscript) {
          const group = svg('g', {});
          const scale = 0.7;
          const gap = Math.max(1, size * 0.02);
          const width = base.width + gap + subscript.layout.width * scale;
          appendLayout(group, base, -width / 2 + base.width / 2, 0, 1);
          appendLayout(group, subscript.layout, width / 2 - subscript.layout.width * scale / 2, size * 0.22, scale);
          items.push(makeLayout(group, width, size * 1.08));
          i = subscript.next;
          continue;
        }
      }
      if (ch === '^') {
        const base = items.pop();
        const exponent = readSuperscript(stage, text, i, size);
        if (base && exponent) {
          items.push(createSuperscriptLayout(base, exponent.layout, size));
          i = exponent.next;
          continue;
        }
      }
      const atom = parseAtom(stage, text, i, size, true);
      items.push(atom.layout);
      i = atom.next;
    }
    return createSequenceLayout(stage, items, size);
  }

  function shouldRenderRich(text) {
    return /[\/√_^|]|->|[₀₁₂₃₄₅₆₇₈₉]|sum\(|int\(|lim\(|root\(|vec\(|mat\[|sin|cos|tan|cot|sec|csc|log|ln|alpha|beta|gamma|delta|lambda|mu|sigma|omega|theta|pi/.test(String(text || ''));
  }

  function fontSizeFor(source) {
    if (source.classList.contains('muted')) return 26;
    const attr = Number(source.getAttribute('font-size'));
    if (Number.isFinite(attr) && attr > 0) return attr;
    return 34;
  }

  function renderSource(source) {
    if (source.getAttribute(PROCESSED) === '1') return;
    const stage = source.ownerSVGElement;
    if (!stage) return;
    const text = source.textContent || '';
    if (!shouldRenderRich(text)) return;
    const x = Number(source.getAttribute('x'));
    const y = Number(source.getAttribute('y'));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const size = fontSizeFor(source);
    const layout = parseMathLayout(stage, text, size);
    const group = svg('g', {
      class: 'function-rich-label' + (source.classList.contains('muted') ? ' muted' : ''),
      'data-rich-label': '1',
      'pointer-events': 'none',
      transform: 'translate(' + x + ' ' + (y - size * 0.34) + ')'
    });
    group.appendChild(layout.node);
    source.parentNode.insertBefore(group, source.nextSibling);
    source.setAttribute(PROCESSED, '1');
    source.classList.add('function-rich-label-source');
  }

  function renderStage(stage) {
    stage.querySelectorAll('text.function-label').forEach(renderSource);
  }

  function install() {
    const stages = Array.from(document.querySelectorAll('svg.stage, svg.function-stage, svg.function-complex-stage'));
    if (!stages.length) return;
    let scheduled = false;
    function schedule() {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(function () {
        scheduled = false;
        stages.forEach(renderStage);
      });
    }
    stages.forEach(function (stage) {
      const observer = new MutationObserver(schedule);
      observer.observe(stage, { childList: true, subtree: true, characterData: true });
    });
    schedule();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }

  window.InstantGeometrySvgLabels = {
    renderStage: renderStage,
    parseMathLayout: parseMathLayout
  };
})();
