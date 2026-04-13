(function () {
  'use strict';

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function toMathLikeHtml(text) {
    const safe = escapeHtml(String(text || ''));
    const suffixMatch = safe.match(/^(.*?)(km²|cm²|m²|km|cm|m|°)$/);
    const bodyRaw = suffixMatch ? suffixMatch[1] : safe;
    const suffix = suffixMatch ? suffixMatch[2] : '';
    let body = bodyRaw;

    body = body.replace(/√([0-9]+)/g, function (_, radicand) {
      return '<span class="math-root"><span class="math-root-sign">√</span><span class="math-radicand">' + radicand + '</span></span>';
    });

    body = body.replace(/([0-9]+(?:\.[0-9]+)?|[0-9]*<span class="math-root">[\s\S]*?<\/span>|π|[0-9]+π)\s*\/\s*([0-9]+(?:\.[0-9]+)?)/g, function (_, numerator, denominator) {
      return '<span class="math-frac"><span class="num">' + numerator + '</span><span class="den">' + denominator + '</span></span>';
    });

    if (suffix) {
      body += '<span class="math-unit">' + suffix + '</span>';
    }
    return body;
  }

  function toLatexMath(text) {
    const raw = String(text || '').trim();
    if (!raw) return '';
    const suffixMatch = raw.match(/^(.*?)(km²|cm²|m²|km|cm|m|°)$/);
    const coreRaw = suffixMatch ? suffixMatch[1].trim() : raw;
    const suffix = suffixMatch ? suffixMatch[2] : '';

    function latexCore(input) {
      let s = String(input || '').trim();
      s = s.replace(/\s+/g, '');
      const slashIndex = s.indexOf('/');
      if (slashIndex > 0 && slashIndex < s.length - 1) {
        const numerator = s.slice(0, slashIndex);
        const denominator = s.slice(slashIndex + 1);
        return '\\frac{' + latexCore(numerator) + '}{' + latexCore(denominator) + '}';
      }
      s = s.replace(/π/g, '\\pi');
      s = s.replace(/√([0-9]+)/g, '\\sqrt{$1}');
      return s;
    }

    let latex = latexCore(coreRaw);
    if (suffix === '°') {
      latex += '^{\\circ}';
    } else if (suffix) {
      const unit = suffix.replace('²', '^2');
      latex += '\\,\\mathrm{' + unit + '}';
    }
    return latex;
  }

  function userToScreenPoint(board, point) {
    return {
      x: board.origin.scrCoords[1] + point.x * board.unitX,
      y: board.origin.scrCoords[2] - point.y * board.unitY
    };
  }

  function createSelectableText(deps) {
    const board = deps.board;
    const labelLayer = deps.labelLayer;
    const currentLabelAnchors = deps.currentLabelAnchors;
    const getLabelStyle = deps.getLabelStyle;
    const position = deps.position;
    const text = deps.text;
    const fontSize = deps.fontSize;
    const labelKey = deps.labelKey;
    const options = deps.options || {};

    const style = getLabelStyle(labelKey.type, labelKey.id);
    const baseColor = style.color || options.color || '#2a5bd7';
    const screen = userToScreenPoint(board, position);
    const labelNode = document.createElement('div');
    labelNode.className = 'floating-label';
    labelNode.dataset.type = labelKey.type;
    labelNode.dataset.id = labelKey.id;
    if (window.katex && typeof window.katex.render === 'function') {
      try {
        window.katex.render(toLatexMath(text), labelNode, {
          throwOnError: false,
          output: 'html',
          strict: 'ignore'
        });
      } catch (_) {
        labelNode.innerHTML = toMathLikeHtml(text);
      }
    } else {
      labelNode.innerHTML = toMathLikeHtml(text);
    }
    labelNode.style.left = screen.x + 'px';
    labelNode.style.top = screen.y + 'px';
    labelNode.style.fontSize = fontSize + 'px';
    labelNode.style.color = baseColor;
    labelNode.style.transform = 'translate(-50%, -50%) rotate(' + (-style.rotation) + 'deg)';
    labelLayer.appendChild(labelNode);
    const domRect = labelNode.getBoundingClientRect();

    currentLabelAnchors.push({
      type: labelKey.type,
      id: labelKey.id,
      x: position.x,
      y: position.y,
      threshold: options.threshold || 0.45,
      curveThreshold: options.curveThreshold || null,
      curveHit: options.curveHit || null,
      visible: true,
      hidden: false,
      text: text,
      fontSize: fontSize,
      color: baseColor,
      rotation: style.rotation,
      screenRect: {
        left: domRect.left,
        top: domRect.top,
        right: domRect.right,
        bottom: domRect.bottom
      }
    });
    return labelNode;
  }

  function createDomSelectableLabel(deps) {
    const labelLayer = deps.labelLayer;
    const getLabelStyle = deps.getLabelStyle;
    const toScreenPoint = deps.toScreenPoint;
    const onPointerDown = deps.onPointerDown;
    const onWheel = deps.onWheel;
    const storeRef = deps.storeRef;
    const type = deps.type;
    const id = deps.id;
    const anchor = deps.anchor;
    const text = deps.text;
    const fontSize = deps.fontSize;

    const style = getLabelStyle(type, id);
    const screen = toScreenPoint(anchor);
    const labelNode = document.createElement('div');
    labelNode.className = 'floating-label';
    labelNode.dataset.type = type;
    labelNode.dataset.id = id;
    if (window.katex && typeof window.katex.render === 'function') {
      try {
        window.katex.render(toLatexMath(text), labelNode, {
          throwOnError: false,
          output: 'html',
          strict: 'ignore'
        });
      } catch (_) {
        labelNode.innerHTML = toMathLikeHtml(text);
      }
    } else {
      labelNode.innerHTML = toMathLikeHtml(text);
    }
    labelNode.style.left = screen.x + 'px';
    labelNode.style.top = screen.y + 'px';
    labelNode.style.fontSize = fontSize + 'px';
    labelNode.style.color = style.color;
    labelNode.style.transform = 'translate(-50%, -50%) translate(' + style.dx + 'px,' + style.dy + 'px) rotate(' + (-style.rotation) + 'deg) scale(' + style.scale + ')';
    if (typeof onPointerDown === 'function') labelNode.addEventListener('pointerdown', onPointerDown);
    if (typeof onWheel === 'function') labelNode.addEventListener('wheel', onWheel, { passive: false });
    labelLayer.appendChild(labelNode);
    if (storeRef) {
      storeRef[type + ':' + id] = { node: labelNode, anchor: anchor, fontSize: fontSize, type: type, id: id };
    }
    return labelNode;
  }

  function createToggleButton(options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = options.className || 'download-btn btn-bd';
    button.textContent = options.text || '';
    const pressed = !!options.pressed;
    button.setAttribute('aria-pressed', String(pressed));
    if (!pressed) button.style.opacity = '0.55';
    if (typeof options.onClick === 'function') {
      button.addEventListener('click', options.onClick);
    }
    if (typeof options.onContextMenu === 'function') {
      button.addEventListener('contextmenu', options.onContextMenu);
    }
    return button;
  }

  function createStyleStore() {
    return {};
  }

  function ensureLabelStyle(store, type, id, defaults) {
    if (!store[type]) store[type] = {};
    if (!store[type][id]) {
      const base = typeof defaults === 'function' ? defaults(type, id) : (defaults || {});
      store[type][id] = {
        dx: Number.isFinite(base.dx) ? base.dx : 0,
        dy: Number.isFinite(base.dy) ? base.dy : 0,
        rotation: Number.isFinite(base.rotation) ? base.rotation : 0,
        scale: Number.isFinite(base.scale) ? base.scale : 1,
        color: base.color || '#2a5bd7'
      };
    }
    return store[type][id];
  }

  function resetLabelStyle(store, type, id, defaults) {
    if (!store[type]) store[type] = {};
    const base = typeof defaults === 'function' ? defaults(type, id) : (defaults || {});
    store[type][id] = {
      dx: Number.isFinite(base.dx) ? base.dx : 0,
      dy: Number.isFinite(base.dy) ? base.dy : 0,
      rotation: Number.isFinite(base.rotation) ? base.rotation : 0,
      scale: Number.isFinite(base.scale) ? base.scale : 1,
      color: base.color || '#2a5bd7'
    };
    return store[type][id];
  }

  function clearStyleStore(store) {
    Object.keys(store).forEach(function (type) {
      delete store[type];
    });
  }

  window.InstantGeometrySharedLabels = {
    escapeHtml: escapeHtml,
    toMathLikeHtml: toMathLikeHtml,
    toLatexMath: toLatexMath,
    userToScreenPoint: userToScreenPoint,
    createSelectableText: createSelectableText,
    createDomSelectableLabel: createDomSelectableLabel,
    createToggleButton: createToggleButton,
    createStyleStore: createStyleStore,
    ensureLabelStyle: ensureLabelStyle,
    resetLabelStyle: resetLabelStyle,
    clearStyleStore: clearStyleStore
  };
})();
