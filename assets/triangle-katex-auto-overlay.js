(function () {
  'use strict';

  const captureRoot = document.getElementById('captureRoot');
  const stage = document.getElementById('stage');
  if (!captureRoot || !stage) return;

  Array.from(captureRoot.querySelectorAll('.triangle-katex-auto-layer')).forEach(function (node) {
    node.remove();
  });

  const layer = document.createElement('div');
  layer.className = 'triangle-katex-auto-layer';
  layer.setAttribute('aria-hidden', 'true');
  captureRoot.appendChild(layer);

  function textToLatex(text) {
    const raw = String(text || '').trim();
    if (!raw) return '';
    if (/^[A-Za-z]+$/.test(raw)) return '\\mathrm{' + raw + '}';
    const degrees = raw.match(/^(.+)°$/);
    if (degrees) return textToLatex(degrees[1]) + '^\\circ';
    const fraction = raw.match(/^(.+)\/(.+)$/);
    if (fraction) {
      return '\\frac{' + textToLatex(fraction[1]) + '}{' + textToLatex(fraction[2]) + '}';
    }
    const sqrt = raw.match(/^([+-]?\d*(?:\.\d+)?)\s*(?:√|sqrt\(?)(\d+(?:\.\d+)?)\)?$/i);
    if (sqrt) {
      const coeff = sqrt[1] && sqrt[1] !== '1' ? sqrt[1] : '';
      return coeff + '\\sqrt{' + sqrt[2] + '}';
    }
    return raw
      .replace(/π/g, '\\pi')
      .replace(/√\s*(\d+(?:\.\d+)?)/g, '\\sqrt{$1}');
  }

  function fallbackHtml(text) {
    const raw = String(text || '').trim();
    const fraction = raw.match(/^(.+)\/(.+)$/);
    if (fraction) {
      return '<span class="katex"><span class="katex-html"><span style="display:inline-flex;flex-direction:column;align-items:center;line-height:.92;"><span style="border-bottom:0.08em solid currentColor;padding:0 .12em .06em;">' +
        fallbackHtml(fraction[1]) +
        '</span><span style="padding:.06em .12em 0;">' +
        fallbackHtml(fraction[2]) +
        '</span></span></span></span>';
    }
    const sqrt = raw.match(/^([+-]?\d*(?:\.\d+)?)\s*(?:√|sqrt\(?)(\d+(?:\.\d+)?)\)?$/i);
    if (sqrt) {
      const coeff = sqrt[1] && sqrt[1] !== '1' ? sqrt[1] : '';
      return '<span class="katex"><span class="katex-html">' + coeff + '<span style="font-size:1.08em;">√</span><span style="border-top:0.08em solid currentColor;padding:0 .1em;">' + sqrt[2] + '</span></span></span>';
    }
    return raw.replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function labelNodes() {
    return Array.from(stage.querySelectorAll('text.shape-label,text.segment-label,text.angle-label,text.area-label,text'));
  }

  function ratioGroupInfo(node) {
    const parent = node.parentNode;
    if (!parent || parent.tagName.toLowerCase() !== 'g') return null;
    const textNodes = Array.from(parent.children).filter(function (child) {
      return child.tagName && child.tagName.toLowerCase() === 'text';
    });
    if (textNodes.length !== 1 || textNodes[0] !== node) return null;
    const shape = Array.from(parent.children).find(function (child) {
      const tag = child.tagName && child.tagName.toLowerCase();
      if (tag === 'rect' && child.getAttribute('fill') === 'transparent') return false;
      return tag === 'ellipse' || tag === 'polygon' || tag === 'rect';
    });
    if (!shape) return null;
    const tag = shape.tagName.toLowerCase();
    return {
      group: parent,
      mark: tag === 'ellipse' ? 'r' : (tag === 'polygon' ? 't' : 's')
    };
  }

  function sync() {
    const katexApi = window.katex || globalThis.katex;
    Array.from(captureRoot.querySelectorAll('.triangle-katex-auto-layer')).forEach(function (node) {
      if (node !== layer) node.remove();
    });
    layer.innerHTML = '';
    const rootRect = captureRoot.getBoundingClientRect();
    labelNodes().forEach(function (node) {
      const text = (node.textContent || '').trim();
      if (!text) return;
      let rect;
      try {
        rect = node.getBoundingClientRect();
      } catch (_) {
        return;
      }
      if (!rect.width && !rect.height) return;
      const div = document.createElement('div');
      div.className = 'triangle-katex-auto-label';
      const ratioInfo = ratioGroupInfo(node);
      const sourceGroup = node.closest('g');
      if (node.classList.contains('label-move-target') || (sourceGroup && sourceGroup.classList.contains('label-move-target'))) {
        div.classList.add('label-move-target');
      }
      if (ratioInfo) {
        div.classList.add('triangle-katex-ratio-label', 'ratio-' + ratioInfo.mark);
      }
      div.style.left = (rect.left - rootRect.left + rect.width / 2) + 'px';
      div.style.top = (rect.top - rootRect.top + rect.height / 2) + 'px';
      div.style.fontSize = (Number(node.getAttribute('font-size')) || Math.max(rect.height, 20)) + 'px';
      div.style.color = node.getAttribute('fill') || '#1f2430';
      try {
        if (katexApi && typeof katexApi.render === 'function') {
          katexApi.render(textToLatex(text), div, { throwOnError: false, displayMode: false });
        } else {
          div.innerHTML = '<span class="katex"><span class="katex-html">' + fallbackHtml(text) + '</span></span>';
        }
        if (ratioInfo) {
          ratioInfo.group.classList.add('triangle-katex-source-hidden');
          ratioInfo.group.setAttribute('opacity', '0');
        } else {
          node.classList.add('triangle-katex-source-hidden');
          node.setAttribute('opacity', '0');
        }
        layer.appendChild(div);
      } catch (_) {}
    });
  }

  const observer = new MutationObserver(function () {
    window.requestAnimationFrame(sync);
  });
  observer.observe(stage, { childList: true, subtree: true, characterData: true });
  window.addEventListener('resize', sync);
  window.__triangleKatexAutoSync = sync;
  window.requestAnimationFrame(sync);
  window.setTimeout(sync, 0);
})();
