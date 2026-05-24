(function (root) {
  'use strict';

  var KATEX_CSS = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
  var KATEX_JS = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js';
  var katexRequested = false;

  function ensureKatex(callback) {
    if (root.katex && typeof root.katex.render === 'function') {
      callback();
      return;
    }
    if (!document.getElementById('instantgeometry-solid-topic-katex-css')) {
      var link = document.createElement('link');
      link.id = 'instantgeometry-solid-topic-katex-css';
      link.rel = 'stylesheet';
      link.href = KATEX_CSS;
      document.head.appendChild(link);
    }
    if (katexRequested) {
      callback();
      return;
    }
    katexRequested = true;
    var script = document.createElement('script');
    script.id = 'instantgeometry-solid-topic-katex-js';
    script.src = KATEX_JS;
    script.onload = callback;
    script.onerror = callback;
    document.head.appendChild(script);
  }

  function normalizeKey(raw) {
    var key = String(raw || '').trim();
    if (!key) return '';
    if (key.indexOf('solid.') === 0) return key;
    if (key.indexOf('figure.') === 0) return 'solid.' + key.slice('figure.'.length);
    return key;
  }

  function readModelKey(stage) {
    var local = stage && stage.getAttribute('data-figure-model-key');
    if (local) return normalizeKey(local);
    var script = document.getElementById('geometryFigureModel');
    if (script && script.textContent) {
      try {
        var parsed = JSON.parse(script.textContent);
        if (parsed && parsed.model) return normalizeKey(parsed.model);
      } catch (error) {
        root.console && root.console.warn && root.console.warn('Could not parse geometryFigureModel.', error);
      }
    }
    return normalizeKey(document.documentElement.getAttribute('data-geometry-figure-model'));
  }

  function readModelInput(stage) {
    var input = { preset: 'learn.definition' };
    var rawValues = stage && stage.getAttribute('data-figure-model-values');
    if (rawValues) {
      try {
        input.values = JSON.parse(rawValues);
      } catch (error) {
        root.console && root.console.warn && root.console.warn('Could not parse data-figure-model-values.', error);
      }
    }
    return input;
  }

  function renderStage(stage) {
    var models = root.InstantGeometryFigureModels;
    var renderer = root.InstantGeometrySolidFigureRenderer;
    if (!models || !renderer || !stage) return;
    var key = readModelKey(stage);
    if (!key) return;
    var model = models.F(key, readModelInput(stage));
    var hiddenSegments = String(stage.getAttribute('data-hidden-segments') || '')
      .split(',')
      .map(function (id) { return id.trim(); })
      .filter(Boolean);
    var showPointLabels = stage.getAttribute('data-show-point-labels') === 'true';
    renderer.render(stage, model, {
      padding: Number(stage.getAttribute('data-render-padding') || 145),
      renderScale: Number(stage.getAttribute('data-render-scale') || 1),
      hiddenSegments: hiddenSegments,
      showPointLabels: showPointLabels
    });
    stage.setAttribute('data-rendered-source', 'figure-model-solid-direct');
  }

  function renderAll() {
    Array.prototype.slice.call(document.querySelectorAll('[data-solid-figure-stage]')).forEach(renderStage);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { ensureKatex(renderAll); });
  } else {
    ensureKatex(renderAll);
  }

  root.InstantGeometrySolidTopicRenderer = Object.freeze({
    renderAll: renderAll,
    renderStage: renderStage
  });
})(window);
