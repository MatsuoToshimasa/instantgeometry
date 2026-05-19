(function () {
  'use strict';

  if (!window.InstantGeometryDrawLabelEngine) {
    throw new Error('draw-shared-label-engine.js must be loaded before triangle-label-engine.js.');
  }
  window.InstantGeometryTriangleLabelEngine = window.InstantGeometryDrawLabelEngine;
})();
