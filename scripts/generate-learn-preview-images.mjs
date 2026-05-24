import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const root = process.cwd();
const require = createRequire(import.meta.url);
const FigureModels = require(path.join(root, 'assets', 'figure-model-standard.js'));
const TriangleFigureAdapter = require(path.join(root, 'assets', 'figure-model-triangle-adapter.js'));
const QuadrilateralFigureAdapter = require(path.join(root, 'assets', 'figure-model-quadrilateral-adapter.js'));
const outputDir = path.join(root, 'assets', 'learn-previews');
const PAGE_TIMEOUT_MS = 10000;
const VIEWPORT = { width: 1120, height: 1120 };
const DEVICE_SCALE_FACTOR = 2;

const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon']
]);

const COLORS = {
  ink: '#1f2937',
  muted: '#687086',
  blue: '#2a5bd7',
  blueSoft: 'rgba(42, 91, 215, 0.08)',
  green: '#19735a',
  amber: '#a66800',
  line: '#dce4f2',
  surface: '#fbfcff'
};

function hiddenTextLabel() {
  return { visible: false, mode: 'hidden', text: '' };
}

function textLabel(text) {
  return { visible: true, mode: 'freeText', valueMode: 'text', text, color: COLORS.blue };
}

function sameLengthMark(index) {
  return { visible: true, kind: 'same-length', index, scale: 1.05 };
}

function sameAngleMark(index) {
  return { visible: true, kind: 'same-angle', index };
}

function rightTriangleCongruenceInput(kind) {
  const markSide = kind === 'hypotenuse-leg';
  return {
    values: { side1: 4, side2: 3, side3: 5 },
    preset: 'learn.condition',
    display: {
      pointLabels: true,
      labelScale: 0.78,
      segmentLabels: false,
      givenSegmentLabels: false,
      angleLabels: false,
      givenAngleLabels: false,
      guides: false
    },
    overrides: {
      objects: {
        figures: {
          first: {
            segments: {
              AB: { value: 4, label: hiddenTextLabel(), relationMark: markSide ? sameLengthMark(2) : { visible: false } },
              AC: { value: 3, label: hiddenTextLabel(), relationMark: { visible: false } },
              BC: { value: 5, label: hiddenTextLabel(), relationMark: sameLengthMark(1) }
            },
            angles: {
              A: { value: 90, visible: true, mark: { visible: true, kind: 'right' }, label: hiddenTextLabel(), relationMark: { visible: false } },
              B: { value: 37, visible: !markSide, mark: { visible: !markSide, kind: 'arc' }, label: hiddenTextLabel(), relationMark: markSide ? { visible: false } : sameAngleMark(1) },
              C: { value: 53, visible: false, mark: { visible: false }, label: hiddenTextLabel(), relationMark: { visible: false } }
            }
          },
          second: {
            segments: {
              DE: { value: 4, label: hiddenTextLabel(), relationMark: markSide ? sameLengthMark(2) : { visible: false } },
              DF: { value: 3, label: hiddenTextLabel(), relationMark: { visible: false } },
              EF: { value: 5, label: hiddenTextLabel(), relationMark: sameLengthMark(1) }
            },
            angles: {
              D: { value: 90, visible: true, mark: { visible: true, kind: 'right' }, label: hiddenTextLabel(), relationMark: { visible: false } },
              E: { value: 37, visible: !markSide, mark: { visible: !markSide, kind: 'arc' }, label: hiddenTextLabel(), relationMark: markSide ? { visible: false } : sameAngleMark(1) },
              F: { value: 53, visible: false, mark: { visible: false }, label: hiddenTextLabel(), relationMark: { visible: false } }
            }
          }
        }
      }
    }
  };
}

function triangleSimilarityInput(kind) {
  const showAllSides = kind === 'sss';
  const showIncluded = kind === 'sas';
  const showTwoAngles = kind === 'aa';
  return {
    values: { side1: 4, side2: 3, side3: 5 },
    preset: 'learn.condition',
    display: {
      pointLabels: true,
      labelScale: 0.78,
      segmentLabels: false,
      givenSegmentLabels: false,
      angleLabels: false,
      givenAngleLabels: false,
      guides: false
    },
    overrides: {
      relation: { type: 'similarity', condition: kind },
      objects: {
        figures: {
          first: {
            segments: {
              AB: { value: 4, label: showAllSides || showIncluded ? textLabel('4') : hiddenTextLabel(), relationMark: { visible: false }, guide: { visible: showAllSides || showIncluded, kind: 'measure-arc' } },
              AC: { value: 3, label: showAllSides || showIncluded ? textLabel('3') : hiddenTextLabel(), relationMark: { visible: false }, guide: { visible: showAllSides || showIncluded, kind: 'measure-arc' } },
              BC: { value: 5, label: showAllSides ? textLabel('5') : hiddenTextLabel(), relationMark: { visible: false }, guide: { visible: showAllSides, kind: 'measure-arc' } }
            },
            angles: {
              A: { value: 50, visible: showIncluded || showTwoAngles, mark: { visible: showIncluded || showTwoAngles, kind: 'arc' }, label: hiddenTextLabel(), relationMark: sameAngleMark(1) },
              B: { value: 60, visible: showTwoAngles, mark: { visible: showTwoAngles, kind: 'arc' }, label: hiddenTextLabel(), relationMark: sameAngleMark(2) },
              C: { value: 70, visible: false, mark: { visible: false }, label: hiddenTextLabel(), relationMark: { visible: false } }
            }
          },
          second: {
            segments: {
              DE: { value: 6, label: showAllSides || showIncluded ? textLabel('6') : hiddenTextLabel(), relationMark: { visible: false }, guide: { visible: showAllSides || showIncluded, kind: 'measure-arc' } },
              DF: { value: 4.5, label: showAllSides || showIncluded ? textLabel('4.5') : hiddenTextLabel(), relationMark: { visible: false }, guide: { visible: showAllSides || showIncluded, kind: 'measure-arc' } },
              EF: { value: 7.5, label: showAllSides ? textLabel('7.5') : hiddenTextLabel(), relationMark: { visible: false }, guide: { visible: showAllSides, kind: 'measure-arc' } }
            },
            angles: {
              D: { value: 50, visible: showIncluded || showTwoAngles, mark: { visible: showIncluded || showTwoAngles, kind: 'arc' }, label: hiddenTextLabel(), relationMark: sameAngleMark(1) },
              E: { value: 60, visible: showTwoAngles, mark: { visible: showTwoAngles, kind: 'arc' }, label: hiddenTextLabel(), relationMark: sameAngleMark(2) },
              F: { value: 70, visible: false, mark: { visible: false }, label: hiddenTextLabel(), relationMark: { visible: false } }
            }
          }
        }
      }
    }
  };
}

const PREVIEWS = [
  {
    id: 'triangle-definition',
    title: '三角形の定義',
    outputFile: 'triangle-definition.png',
    html: triangleFigureModelHtml,
    source: 'figure-model-triangle-mobile',
    figureModelKey: 'triangle',
    figureModelInput: {
      values: { BC: 5, CA: 6, AB: 7 },
      preset: 'learn.definition',
      display: {
        pointLabels: true,
        segmentLabels: false,
        angleLabels: false,
        guides: false
      }
    },
    fileBase: 'learn-triangle-definition'
  },
  {
    id: 'circle-definition',
    title: '円の定義',
    outputFile: 'circle-definition.png',
    html: conicFigureModelHtml,
    source: 'figure-model-conic-mobile',
    conicConfig: {
      shape: 'circle',
      readyMessage: '円を描画しています。',
      fileBase: 'learn-circle-definition',
      controlInputIds: { radius: 'radiusLen' },
      showArea: false,
      initialState: {
        pointInputs: { O: 'O', A: '' },
        measures: { r: 5 },
        measureInputs: { r: '半径' },
        measureKinds: { r: 'plain' },
        measureArcVisible: { r: true },
        measureColors: { r: COLORS.blue },
        areaInput: '',
        labelScales: { 'point:O': 1.1, 'measure:r': 1.15 }
      }
    }
  },
  {
    id: 'circle-radius-diameter',
    title: '円の半径と直径',
    outputFile: 'circle-radius-diameter.png',
    html: conicFigureModelHtml,
    source: 'figure-model-conic-mobile',
    conicConfig: {
      shape: 'circle',
      readyMessage: '円を描画しています。',
      fileBase: 'learn-circle-radius-diameter',
      controlInputIds: { radius: 'radiusLen' },
      showArea: false,
      initialState: {
        pointInputs: { O: '', A: '', B: '' },
        measures: { r: 5, AB: 10 },
        measureInputs: { r: '半径', AB: '直径' },
        measureKinds: { r: 'plain', AB: 'plain' },
        measureArcVisible: { r: true, AB: true },
        measureColors: { r: COLORS.green, AB: COLORS.blue },
        pointMarkerVisible: { O: true },
        areaInput: '',
        labelOffsets: {
          measure: {
            r: { x: 0, y: -118 }
          }
        },
        labelScales: { 'point:O': 1.05, 'point:A': 0.95, 'point:B': 0.95, 'measure:r': 1.1, 'measure:AB': 1.1 }
      }
    }
  },
  {
    id: 'circle-circumference',
    title: '円周の長さ',
    outputFile: 'circle-circumference.png',
    html: conicFigureModelHtml,
    source: 'figure-model-conic-mobile',
    conicConfig: {
      shape: 'circle',
      readyMessage: '円を描画しています。',
      fileBase: 'learn-circle-circumference',
      controlInputIds: { radius: 'radiusLen' },
      showArea: false,
      initialState: {
        pointInputs: { O: '', A: '', L: '', R: '' },
        measures: { r: 5, diameter: 10 },
        measureInputs: { r: '', diameter: '直径' },
        measureKinds: { r: 'plain', diameter: 'plain' },
        measureLineVisible: { r: false },
        measureArcVisible: { r: false, diameter: true },
        measureColors: { r: COLORS.blue, diameter: COLORS.green },
        areaInput: '',
        labelScales: { 'measure:diameter': 1.15 }
      }
    }
  },
  {
    id: 'circle-area',
    title: '円の面積',
    outputFile: 'circle-area.png',
    html: conicFigureModelHtml,
    source: 'figure-model-conic-mobile',
    conicConfig: {
      shape: 'circle',
      readyMessage: '円を描画しています。',
      fileBase: 'learn-circle-area',
      controlInputIds: { radius: 'radiusLen' },
      showArea: true,
      initialState: {
        pointInputs: { O: 'O', A: '' },
        measures: { r: 5 },
        measureInputs: { r: '半径' },
        measureKinds: { r: 'plain' },
        measureArcVisible: { r: true },
        measureColors: { r: COLORS.green },
        areaInput: '',
        areaColor: COLORS.blue,
        labelScales: { 'point:O': 1.05, 'measure:r': 1.1, 'area:main': 1.2 }
      }
    }
  },
  {
    id: 'circle-arc-chord',
    title: '弧と弦',
    outputFile: 'circle-arc-chord.png',
    html: conicFigureModelHtml,
    source: 'figure-model-conic-mobile',
    controlValues: { angleLen: '92' },
    conicConfig: {
      shape: 'circle-arc-chord',
      readyMessage: '弧と弦を描画しています。',
      fileBase: 'learn-circle-arc-chord',
      controlInputIds: { angle: 'angleLen' },
      showArea: false,
      initialState: {
        pointInputs: { O: 'O', A: 'A', B: 'B' },
        measures: { chordAB: 0, arcAB: 0 },
        measureInputs: { chordAB: '弦', arcAB: '弧' },
        measureArcVisible: { chordAB: true, arcAB: true },
        measureColors: { chordAB: COLORS.green, arcAB: COLORS.blue },
        angleInputs: { AOB: '' },
        angleKinds: { AOB: 'hidden' },
        areaInput: ''
      }
    }
  },
  {
    id: 'circle-inscribed-center-angle',
    title: '中心角と円周角',
    outputFile: 'circle-inscribed-center-angle.png',
    html: conicFigureModelHtml,
    source: 'figure-model-conic-mobile',
    controlValues: { angleLen: '45' },
    conicConfig: {
      shape: 'inscribed-center-angle',
      readyMessage: '中心角と円周角を描画しています。',
      fileBase: 'learn-circle-inscribed-center-angle',
      controlInputIds: { angle: 'angleLen' },
      showArea: false,
      initialState: {
        pointInputs: { O: 'O', A: '', B: '', C: '' },
        measures: {},
        measureInputs: {},
        angleInputs: { ACB: '円周角', AOB: '中心角', CAO: '', CBO: '' },
        angleKinds: { ACB: 'plain', AOB: 'plain', CAO: 'hidden', CBO: 'hidden' },
        angleColors: { ACB: COLORS.green, AOB: COLORS.blue },
        areaInput: '',
        labelScales: { 'point:O': 0.9, 'angle:ACB': 0.9, 'angle:AOB': 0.9 },
        labelOffsets: { point: { O: { x: 52, y: -38 } }, angle: { ACB: { x: 0, y: 72 } } }
      }
    }
  },
  {
    id: 'circle-tangent',
    title: '接線',
    outputFile: 'circle-tangent.png',
    html: conicFigureModelHtml,
    source: 'figure-model-conic-mobile',
    conicConfig: {
      shape: 'circle-tangent-radius',
      readyMessage: '円の接線を描画しています。',
      fileBase: 'learn-circle-tangent',
      controlInputIds: { radius: 'radiusLen' },
      showArea: false,
      showTangentRadius: false,
      initialState: {
        pointInputs: { O: '', P: '' },
        pointMarkerVisible: { P: true },
        measures: { tangentLine: 0 },
        measureInputs: { tangentLine: '接線' },
        measureColors: { tangentLine: COLORS.blue },
        measureArcVisible: { tangentLine: false },
        angleInputs: { OPT: '' },
        angleKinds: { OPT: 'hidden' },
        areaInput: '',
        labelScales: { 'measure:tangentLine': 1.15 }
      }
    }
  },
  {
    id: 'circle-tangent-radius',
    title: '接線と半径の関係',
    outputFile: 'circle-tangent-radius.png',
    html: conicFigureModelHtml,
    source: 'figure-model-conic-mobile',
    conicConfig: {
      shape: 'circle-tangent-radius',
      readyMessage: '接線と半径の関係を描画しています。',
      fileBase: 'learn-circle-tangent-radius',
      controlInputIds: { radius: 'radiusLen' },
      showArea: false,
      initialState: {
        pointInputs: { O: 'O', P: '' },
        pointMarkerVisible: { O: true, P: true },
        measures: { r: 5, tangentLine: 0 },
        measureInputs: { r: '半径', tangentLine: '接線' },
        measureKinds: { r: 'plain', tangentLine: 'plain' },
        measureArcVisible: { r: true, tangentLine: false },
        measureColors: { r: COLORS.green, tangentLine: COLORS.blue },
        angleInputs: { OPT: '90°' },
        angleKinds: { OPT: 'right' },
        angleColors: { OPT: COLORS.muted },
        areaInput: '',
        labelScales: { 'point:O': 0.9, 'measure:r': 1.05, 'measure:tangentLine': 1.1, 'angle:OPT': 0.9 }
      }
    }
  },
  {
    id: 'circle-cyclic-quadrilateral',
    title: '円に内接する四角形',
    outputFile: 'circle-cyclic-quadrilateral.png',
    html: cyclicQuadrilateralHtml,
    source: 'draw-quadrilateral-cyclic',
    fileBase: 'learn-circle-cyclic-quadrilateral'
  },
  {
    id: 'angle-vertical-angles',
    title: '対頂角',
    outputFile: 'angle-vertical-angles.png',
    html: lineAngleRelationPreviewHtml,
    source: 'draw-line-angle-relations',
    relationType: 'vertical',
    controlValue: '78',
    fileBase: 'learn-angle-vertical-angles'
  },
  {
    id: 'angle-corresponding-angles',
    title: '同位角',
    outputFile: 'angle-corresponding-angles.png',
    html: lineAngleRelationPreviewHtml,
    source: 'draw-line-angle-relations',
    relationType: 'corresponding',
    controlValue: '62',
    fileBase: 'learn-angle-corresponding-angles'
  },
  {
    id: 'angle-alternate-interior-angles',
    title: '錯角',
    outputFile: 'angle-alternate-interior-angles.png',
    html: lineAngleRelationPreviewHtml,
    source: 'draw-line-angle-relations',
    relationType: 'alternate',
    controlValue: '62',
    fileBase: 'learn-angle-alternate-interior-angles'
  },
  {
    id: 'line-perpendicular-bisector',
    title: '垂直二等分線',
    outputFile: 'line-perpendicular-bisector.png',
    draw: drawPerpendicularBisector
  },
  {
    id: 'angle-angle-bisector',
    title: '角の二等分線',
    outputFile: 'angle-angle-bisector.png',
    draw: drawAngleBisector
  },
  {
    id: 'transform-translation',
    title: '平行移動',
    outputFile: 'transform-translation.png',
    html: functionComplexPreviewHtml,
    source: 'function-complex-mobile',
    complexConfig: {
      kind: 'affine-transform',
      slug: 'learn-transform-translation',
      viewWidth: 10,
      viewHeight: 10,
      variables: [
        { id: 'a', re: 1, im: 0, reLabel: 'a 実部', imLabel: 'a 虚部' },
        { id: 'b', re: 2, im: 1.2, reLabel: 'b 実部', imLabel: 'b 虚部' },
        { id: 'z', re: 1.5, im: 1.2, reLabel: 'z 実部', imLabel: 'z 虚部' }
      ],
      targets: [
        { key: 'gridImage', title: '変換後の格子', defaultLabel: '', color: '#94a3b8' },
        { key: 'pointZ', title: '移動前の点', defaultLabel: '前', color: COLORS.blue },
        { key: 'pointW', title: '移動後の点', defaultLabel: '後', color: COLORS.green },
        { key: 'vectorZ', title: '移動前のベクトル', defaultLabel: '', color: COLORS.blue },
        { key: 'vectorW', title: '移動後のベクトル', defaultLabel: '', color: COLORS.green }
      ]
    }
  },
  {
    id: 'transform-rotation',
    title: '回転移動',
    outputFile: 'transform-rotation.png',
    html: functionComplexPreviewHtml,
    source: 'function-complex-mobile',
    complexConfig: {
      kind: 'affine-transform',
      slug: 'learn-transform-rotation',
      viewWidth: 10,
      viewHeight: 10,
      variables: [
        { id: 'a', re: 0, im: 1, reLabel: 'a 実部', imLabel: 'a 虚部' },
        { id: 'b', re: 0, im: 0, reLabel: 'b 実部', imLabel: 'b 虚部' },
        { id: 'z', re: 2, im: 1, reLabel: 'z 実部', imLabel: 'z 虚部' }
      ],
      targets: [
        { key: 'gridImage', title: '変換後の格子', defaultLabel: '', color: '#94a3b8' },
        { key: 'pointZ', title: '回転前の点', defaultLabel: '前', color: COLORS.blue },
        { key: 'pointW', title: '回転後の点', defaultLabel: '後', color: COLORS.green },
        { key: 'vectorZ', title: '回転前のベクトル', defaultLabel: '', color: COLORS.blue },
        { key: 'vectorW', title: '回転後のベクトル', defaultLabel: '', color: COLORS.green }
      ]
    }
  },
  {
    id: 'transform-reflection',
    title: '対称移動',
    outputFile: 'transform-reflection.png',
    html: functionComplexPreviewHtml,
    source: 'function-complex-mobile',
    complexConfig: {
      kind: 'conjugate',
      slug: 'learn-transform-reflection',
      viewWidth: 10,
      viewHeight: 10,
      variables: [{ id: 'z', re: 2.5, im: 1.8, reLabel: 'z 実部', imLabel: 'z 虚部' }],
      targets: [
        { key: 'pointZ', type: 'point', title: '移動前の点', defaultLabel: '前', color: COLORS.blue },
        { key: 'pointConj', type: 'point', title: '移動後の点', defaultLabel: '後', color: COLORS.green },
        { key: 'vectorOz', type: 'vector', title: '移動前のベクトル', defaultLabel: '', color: COLORS.blue },
        { key: 'vectorConj', type: 'vector', title: '移動後のベクトル', defaultLabel: '', color: COLORS.green },
        { key: 'symmetry', type: 'segment', title: '対称の対応', defaultLabel: '対称', color: '#8e44ad' },
        { key: 'modCircle', type: 'circle', title: '距離の円', defaultLabel: '', color: '#d97706' }
      ]
    }
  },
  {
    id: 'transform-dilation',
    title: '拡大・縮小',
    outputFile: 'transform-dilation.png',
    html: functionComplexPreviewHtml,
    source: 'function-complex-mobile',
    complexConfig: {
      kind: 'affine-transform',
      slug: 'learn-transform-dilation',
      viewWidth: 10,
      viewHeight: 10,
      variables: [
        { id: 'a', re: 1.6, im: 0, reLabel: 'a 実部', imLabel: 'a 虚部' },
        { id: 'b', re: 0, im: 0, reLabel: 'b 実部', imLabel: 'b 虚部' },
        { id: 'z', re: 1.4, im: 1, reLabel: 'z 実部', imLabel: 'z 虚部' }
      ],
      targets: [
        { key: 'gridImage', title: '変換後の格子', defaultLabel: '', color: '#94a3b8' },
        { key: 'pointZ', title: 'もとの点', defaultLabel: '前', color: COLORS.blue },
        { key: 'pointW', title: '拡大後の点', defaultLabel: '後', color: COLORS.green },
        { key: 'vectorZ', title: 'もとのベクトル', defaultLabel: '', color: COLORS.blue },
        { key: 'vectorW', title: '拡大後のベクトル', defaultLabel: '', color: COLORS.green }
      ]
    }
  },
  {
    id: 'ellipse-definition',
    title: '楕円の定義',
    outputFile: 'ellipse-definition.png',
    html: conicFigureModelHtml,
    source: 'figure-model-conic-mobile',
    conicConfig: {
      shape: 'ellipse',
      readyMessage: '楕円を描画しています。',
      fileBase: 'learn-ellipse-definition',
      controlInputIds: { radiusX: 'radius1Len', radiusY: 'radius2Len' },
      showArea: false,
      showEllipseMeasures: false,
      ellipsePointAngles: { A: -0.72, B: 2.24 },
      extraSegments: [
        { id: 'F1A', from: 'F1', to: 'A', className: 'learn-focus-guide', stroke: COLORS.green, strokeWidth: '3.2', dasharray: '10 8' },
        { id: 'F2A', from: 'F2', to: 'A', className: 'learn-focus-guide', stroke: COLORS.green, strokeWidth: '3.2', dasharray: '10 8' },
        { id: 'F1B', from: 'F1', to: 'B', className: 'learn-focus-guide', stroke: COLORS.blue, strokeWidth: '3.2', dasharray: '10 8' },
        { id: 'F2B', from: 'F2', to: 'B', className: 'learn-focus-guide', stroke: COLORS.blue, strokeWidth: '3.2', dasharray: '10 8' }
      ],
      initialState: {
        pointInputs: { O: '', A: 'A', B: 'B', F1: 'O', F2: "O'" },
        pointMarkerVisible: { A: true, B: true, F1: true, F2: true },
        pointColors: { A: COLORS.blue, B: COLORS.blue, F1: COLORS.blue, F2: COLORS.blue },
        measures: {},
        measureInputs: { a: '', b: '' },
        measureLineVisible: { a: false, b: false },
        measureArcVisible: { a: false, b: false },
        areaInput: '',
        labelOffsets: {
          point: {
            A: { x: 4, y: 30 },
            B: { x: 4, y: -26 },
            F1: { x: 18, y: 4 },
            F2: { x: -18, y: 4 }
          }
        },
        labelScales: { 'point:A': 0.9, 'point:B': 0.9, 'point:F1': 0.9, 'point:F2': 0.9 }
      }
    }
  },
  {
    id: 'solid-triangular-pyramid-definition',
    title: '三角錐の定義',
    outputFile: 'solid-triangular-pyramid-definition.png',
    html: solidFigureModelHtml,
    source: 'figure-model-solid-direct',
    figureModelKey: 'solid.triangularPyramid',
    figureModelInput: { values: { AH: 7, BC: 5, CD: 7, DB: 8 }, preset: 'learn.definition' },
    fileBase: 'learn-solid-triangular-pyramid-definition'
  },
  {
    id: 'solid-quadrangular-pyramid-definition',
    title: '四角錐の定義',
    outputFile: 'solid-quadrangular-pyramid-definition.png',
    html: solidFigureModelHtml,
    source: 'figure-model-solid-direct',
    figureModelKey: 'solid.quadrangularPyramid',
    figureModelInput: { values: { AH: 7, BC: 5, CD: 6, DE: 5, EB: 6 }, preset: 'learn.definition' },
    fileBase: 'learn-solid-quadrangular-pyramid-definition'
  },
  {
    id: 'solid-pentagonal-pyramid-definition',
    title: '五角錐の定義',
    outputFile: 'solid-pentagonal-pyramid-definition.png',
    html: solidFigureModelHtml,
    source: 'figure-model-solid-direct',
    figureModelKey: 'solid.pentagonalPyramid',
    figureModelInput: { values: { baseRadius: 4, AH: 7 }, preset: 'learn.definition' },
    fileBase: 'learn-solid-pentagonal-pyramid-definition'
  },
  {
    id: 'solid-hexagonal-pyramid-definition',
    title: '六角錐の定義',
    outputFile: 'solid-hexagonal-pyramid-definition.png',
    html: solidFigureModelHtml,
    source: 'figure-model-solid-direct',
    figureModelKey: 'solid.hexagonalPyramid',
    figureModelInput: { values: { baseRadius: 4, AH: 7 }, preset: 'learn.definition' },
    fileBase: 'learn-solid-hexagonal-pyramid-definition'
  },
  {
    id: 'solid-triangular-prism-definition',
    title: '三角柱の定義',
    outputFile: 'solid-triangular-prism-definition.png',
    html: solidFigureModelHtml,
    source: 'figure-model-solid-direct',
    figureModelKey: 'solid.triangularPrism',
    figureModelInput: { values: { AB: 5, BC: 6, CA: 4, AD: 7 }, preset: 'learn.definition' },
    fileBase: 'learn-solid-triangular-prism-definition'
  },
  {
    id: 'solid-quadrangular-prism-definition',
    title: '四角柱の定義',
    outputFile: 'solid-quadrangular-prism-definition.png',
    html: solidFigureModelHtml,
    source: 'figure-model-solid-direct',
    figureModelKey: 'solid.quadrangularPrism',
    figureModelInput: { values: { EF: 4, FG: 5, GH: 6, HE: 7, AE: 7 }, preset: 'learn.definition' },
    fileBase: 'learn-solid-quadrangular-prism-definition'
  },
  {
    id: 'solid-pentagonal-prism-definition',
    title: '五角柱の定義',
    outputFile: 'solid-pentagonal-prism-definition.png',
    html: solidFigureModelHtml,
    source: 'figure-model-solid-direct',
    figureModelKey: 'solid.pentagonalPrism',
    figureModelInput: { values: { baseRadius: 4, height: 7 }, preset: 'learn.definition' },
    fileBase: 'learn-solid-pentagonal-prism-definition'
  },
  {
    id: 'solid-hexagonal-prism-definition',
    title: '六角柱の定義',
    outputFile: 'solid-hexagonal-prism-definition.png',
    html: solidFigureModelHtml,
    source: 'figure-model-solid-direct',
    figureModelKey: 'solid.hexagonalPrism',
    figureModelInput: { values: { baseRadius: 4, height: 7 }, preset: 'learn.definition' },
    fileBase: 'learn-solid-hexagonal-prism-definition'
  },
  {
    id: 'solid-cone-definition',
    title: '円錐の定義',
    outputFile: 'solid-cone-definition.png',
    html: solidFigureModelHtml,
    source: 'figure-model-solid-direct',
    figureModelKey: 'solid.cone',
    figureModelInput: { values: { radius: 3, height: 7 }, preset: 'learn.definition' },
    fileBase: 'learn-solid-cone-definition'
  },
  {
    id: 'solid-cylinder-definition',
    title: '円柱の定義',
    outputFile: 'solid-cylinder-definition.png',
    html: solidFigureModelHtml,
    source: 'figure-model-solid-direct',
    figureModelKey: 'solid.cylinder',
    figureModelInput: { values: { radius: 3, height: 7 }, preset: 'learn.definition' },
    fileBase: 'learn-solid-cylinder-definition'
  },
  {
    id: 'solid-rectangular-cuboid-definition',
    title: '直方体の定義',
    outputFile: 'solid-rectangular-cuboid-definition.png',
    html: solidFigureModelHtml,
    source: 'figure-model-solid-direct',
    figureModelKey: 'solid.rectangularCuboid',
    figureModelInput: { values: { EF: 5, FG: 3, GH: 5, HE: 3, AE: 7 }, preset: 'learn.definition' },
    fileBase: 'learn-solid-rectangular-cuboid-definition'
  },
  {
    id: 'solid-cube-definition',
    title: '立方体の定義',
    outputFile: 'solid-cube-definition.png',
    html: solidFigureModelHtml,
    source: 'figure-model-solid-direct',
    figureModelKey: 'solid.cube',
    figureModelInput: { values: { a: 6 }, preset: 'learn.definition' },
    fileBase: 'learn-solid-cube-definition'
  },
  {
    id: 'solid-conical-frustum-definition',
    title: '円錐台の定義',
    outputFile: 'solid-conical-frustum-definition.png',
    html: solidFigureModelHtml,
    source: 'figure-model-solid-direct',
    figureModelKey: 'solid.conicalFrustum',
    figureModelInput: { values: { topRadius: 4, height: 10, bottomRadius: 8 }, preset: 'learn.definition' },
    fileBase: 'learn-solid-conical-frustum-definition'
  },
  {
    id: 'ellipse-axes',
    title: '楕円の長軸・短軸',
    outputFile: 'ellipse-axes.png',
    html: conicFigureModelHtml,
    source: 'figure-model-conic-mobile',
    conicConfig: {
      shape: 'ellipse',
      readyMessage: '楕円を描画しています。',
      fileBase: 'learn-ellipse-axes',
      controlInputIds: { radiusX: 'radius1Len', radiusY: 'radius2Len' },
      showArea: false,
      initialState: {
        pointInputs: { O: '', A: '', B: '' },
        measures: { majorAxis: 12, minorAxis: 7 },
        measureInputs: { majorAxis: '長軸', minorAxis: '短軸' },
        measureKinds: { majorAxis: 'plain', minorAxis: 'plain' },
        measureArcVisible: { majorAxis: false, minorAxis: false },
        measureColors: { majorAxis: COLORS.blue, minorAxis: COLORS.green },
        areaInput: '',
        labelOffsets: {
          measure: {
            majorAxis: { x: -100, y: 88 },
            minorAxis: { x: 120, y: -92 }
          }
        },
        labelScales: { 'measure:majorAxis': 1.15, 'measure:minorAxis': 1.15 }
      }
    }
  },
  {
    id: 'ellipse-foci',
    title: '楕円の焦点',
    outputFile: 'ellipse-foci.png',
    html: conicFigureModelHtml,
    source: 'figure-model-conic-mobile',
    conicConfig: {
      shape: 'ellipse',
      readyMessage: '楕円を描画しています。',
      fileBase: 'learn-ellipse-foci',
      controlInputIds: { radiusX: 'radius1Len', radiusY: 'radius2Len' },
      showArea: false,
      initialState: {
        pointInputs: { O: '', A: '', B: '', F1: '焦点', F2: '焦点' },
        pointMarkerVisible: { F1: true, F2: true },
        pointColors: { F1: COLORS.blue, F2: COLORS.blue },
        measures: { majorAxis: 12 },
        measureInputs: { majorAxis: '長軸' },
        measureKinds: { majorAxis: 'plain' },
        measureArcVisible: { majorAxis: false },
        measureColors: { majorAxis: COLORS.blue },
        areaInput: '',
        labelOffsets: {
          point: {
            F1: { x: 96, y: -4 },
            F2: { x: -96, y: -4 }
          },
          measure: {
            majorAxis: { x: -100, y: 88 }
          }
        },
        labelScales: { 'point:F1': 0.85, 'point:F2': 0.85, 'measure:majorAxis': 1.05 }
      }
    }
  },
  {
    id: 'ellipse-area',
    title: '楕円の面積',
    outputFile: 'ellipse-area.png',
    html: conicFigureModelHtml,
    source: 'figure-model-conic-mobile',
    conicConfig: {
      shape: 'ellipse',
      readyMessage: '楕円を描画しています。',
      fileBase: 'learn-ellipse-area',
      controlInputIds: { radiusX: 'radius1Len', radiusY: 'radius2Len' },
      showArea: true,
      initialState: {
        pointInputs: { O: '', A: '', B: '' },
        measures: { a: 6, b: 3.5 },
        measureInputs: { a: 'a', b: 'b' },
        measureKinds: { a: 'plain', b: 'plain' },
        measureArcVisible: { a: true, b: true },
        measureColors: { a: COLORS.blue, b: COLORS.green },
        areaInput: '',
        areaColor: COLORS.blue,
        labelScales: { 'measure:a': 1.15, 'measure:b': 1.15, 'area:main': 1.25 }
      }
    },
    afterRenderScript: `
      document.querySelectorAll('#stage .axis-line').forEach(function (line) {
        line.setAttribute('stroke-dasharray', '18 14');
        line.setAttribute('stroke-linecap', 'round');
      });
    `
  },
  {
    id: 'sector-arc-length',
    title: 'おうぎ形の弧の長さ',
    outputFile: 'sector-arc-length.png',
    html: conicFigureModelHtml,
    source: 'figure-model-conic-mobile',
    conicConfig: {
      shape: 'sector',
      readyMessage: 'おうぎ形を描画しています。',
      fileBase: 'learn-sector-arc-length',
      controlInputIds: { radius: 'radiusLen', angle: 'angleLen' },
      showArea: true,
      initialState: {
        pointInputs: { O: '', A: '', B: '', C: '' },
        measures: { r: 5, diameter: 10, arcAB: 5 * Math.PI * 2 / 3 },
        measureInputs: { r: '', diameter: '直径', arcAB: '弧' },
        measureKinds: { r: 'plain', diameter: 'plain', arcAB: 'plain' },
        measureArcVisible: { r: false, diameter: true, arcAB: true },
        measureColors: { r: COLORS.green, diameter: COLORS.blue, arcAB: COLORS.blue },
        complementArcVisible: true,
        angles: { AOB: 120 },
        angleInputs: { AOB: '中心角' },
        angleKinds: { AOB: 'plain' },
        angleColors: { AOB: COLORS.green },
        angleArcScales: { AOB: 0.4 },
        areaInput: '',
        areaColor: COLORS.blue,
        labelOffsets: {
          measure: {
            arcAB: { x: 12, y: -36 }
          },
          angle: {
            AOB: { x: 38, y: -18 }
          }
        },
        labelScales: { 'point:A': 0.9, 'point:C': 0.9, 'measure:diameter': 1.05, 'measure:arcAB': 1.15, 'angle:AOB': 0.95 }
      }
    },
    controlValues: { radiusLen: '5', angleLen: '120' }
  },
  {
    id: 'sector-area',
    title: 'おうぎ形の面積',
    outputFile: 'sector-area.png',
    html: conicFigureModelHtml,
    source: 'figure-model-conic-mobile',
    conicConfig: {
      shape: 'sector',
      readyMessage: 'おうぎ形を描画しています。',
      fileBase: 'learn-sector-area',
      controlInputIds: { radius: 'radiusLen', angle: 'angleLen' },
      showArea: true,
      initialState: {
        pointInputs: { O: '', A: '', B: '' },
        measures: { r: 5, arcAB: 5 * Math.PI * 2 / 3 },
        measureInputs: { r: '半径', arcAB: '' },
        measureKinds: { r: 'plain', arcAB: 'plain' },
        measureArcVisible: { r: true, arcAB: false },
        measureColors: { r: COLORS.green, arcAB: COLORS.blue },
        complementArcVisible: true,
        angles: { AOB: 120 },
        angleInputs: { AOB: '中心角' },
        angleKinds: { AOB: 'plain' },
        angleColors: { AOB: COLORS.green },
        angleArcScales: { AOB: 0.4 },
        areaInput: '',
        areaColor: COLORS.blue,
        labelScales: { 'measure:r': 1.05, 'angle:AOB': 0.9, 'area:main': 1.15 }
      }
    },
    controlValues: { radiusLen: '5', angleLen: '120' }
  },
  {
    id: 'polygon-definition',
    title: '多角形の定義',
    outputFile: 'polygon-definition.png',
    html: regularPolygonDrawToolPreviewHtml,
    source: 'draw-polygon-regular-mobile',
    polygonConfig: {
      vertexCount: 5,
      sideLen: 5,
      readyMessage: '多角形を描画しています。',
      fileBase: 'learn-polygon-definition',
      initialState: {
        points: [
          { x: -0.5, y: -5.2 },
          { x: 4.4, y: -2.4 },
          { x: 3.2, y: 2.5 },
          { x: -1.5, y: 3.8 },
          { x: -4.9, y: 0.2 }
        ]
      }
    }
  },
  {
    id: 'regular-polygon-definition',
    title: '正多角形の定義',
    outputFile: 'regular-polygon-definition.png',
    html: regularPolygonDrawToolPreviewHtml,
    source: 'draw-polygon-regular-mobile',
    polygonConfig: {
      vertexCount: 6,
      sideLen: 5,
      readyMessage: '正多角形を描画しています。',
      fileBase: 'learn-regular-polygon-definition',
      initialState: {
        sideKinds: {
          AB: 'single',
          BC: 'single',
          CD: 'single',
          DE: 'single',
          EF: 'single',
          FA: 'single'
        },
        angleKinds: {
          A: 'circle',
          B: 'circle',
          C: 'circle',
          D: 'circle',
          E: 'circle',
          F: 'circle'
        }
      }
    }
  },
  {
    id: 'polygon-interior-angle-sum',
    title: '多角形の内角の和',
    outputFile: 'polygon-interior-angle-sum.png',
    html: regularPolygonDrawToolPreviewHtml,
    source: 'draw-polygon-regular-mobile',
    polygonConfig: {
      vertexCount: 7,
      sideLen: 5,
      readyMessage: '多角形の内角の和を描画しています。',
      fileBase: 'learn-polygon-interior-angle-sum',
      initialState: {
        points: [
          { x: -1.0, y: -5.0 },
          { x: 3.7, y: -3.4 },
          { x: 5.0, y: 0.8 },
          { x: 2.7, y: 3.9 },
          { x: -0.8, y: 4.8 },
          { x: -4.6, y: 2.1 },
          { x: -5.2, y: -2.0 }
        ],
        diagonals: [['A', 'C'], ['A', 'D'], ['A', 'E'], ['A', 'F']],
        angleKinds: { A: 'plain', B: 'plain', C: 'plain', D: 'plain', E: 'plain', F: 'plain', G: 'plain' },
        pointLabels: { A: '', B: '', C: '', D: '', E: '', F: '', G: '' },
        sideLabels: { AB: '', BC: '', CD: '', DE: '', EF: '', FG: '', GA: '' },
        centerLabel: ''
      }
    }
  },
  {
    id: 'quadrilateral-interior-angle-sum',
    title: '四角形の内角の和',
    outputFile: 'quadrilateral-interior-angle-sum.png',
    html: quadrilateralFigureModelHtml,
    source: 'figure-model-quadrilateral-mobile',
    figureModelKey: 'quadrilateral',
    figureModelInput: {
      values: {},
      preset: 'learn.property',
      display: {
        pointLabels: true,
        labelScale: 0.9,
        segmentLabels: false,
        angleLabels: false,
        guides: false
      },
      overrides: {
        objects: {
          geometry: {
            points: {
              A: { x: -4.6, y: 1.2 },
              B: { x: -2.2, y: -3.7 },
              C: { x: 4.5, y: -2.2 },
              D: { x: -0.2, y: 3.8 }
            }
          }
        }
      }
    },
    configureScript: () => `
      config.initialState.sideKinds = Object.assign({}, config.initialState.sideKinds, {
        AB: "plain",
        BC: "plain",
        CD: "plain",
        DA: "plain"
      });
      config.initialState.angleKinds = Object.assign({}, config.initialState.angleKinds, {
        A: "plain",
        B: "plain",
        C: "plain",
        D: "plain"
      });
      config.initialState.pointInputs = Object.assign({}, config.initialState.pointInputs, {
        A: "",
        B: "",
        C: "",
        D: ""
      });
      config.pointLabelFontSize = 42;
      config.extraSegments = function (context) {
        var geometry = context.geometry;
        return [{
          id: "AC",
          p1: geometry.A,
          p2: geometry.C,
          stroke: "#687086",
          strokeWidth: "3",
          dasharray: "9 7",
          drawLine: true,
          hitEnabled: false
        }];
      };
    `,
    fileBase: 'learn-quadrilateral-interior-angle-sum'
  },
  {
    id: 'pentagon-interior-angle-sum',
    title: '五角形の内角の和',
    outputFile: 'pentagon-interior-angle-sum.png',
    html: regularPolygonDrawToolPreviewHtml,
    source: 'draw-polygon-regular-mobile',
    polygonConfig: {
      vertexCount: 5,
      sideLen: 5,
      readyMessage: '五角形の内角の和を描画しています。',
      fileBase: 'learn-pentagon-interior-angle-sum',
      initialState: {
        points: [
          { x: -0.5, y: -5.2 },
          { x: 4.4, y: -2.4 },
          { x: 3.2, y: 2.5 },
          { x: -1.5, y: 3.8 },
          { x: -4.9, y: 0.2 }
        ],
        diagonals: [['A', 'C'], ['A', 'D']],
        angleKinds: { A: 'plain', B: 'plain', C: 'plain', D: 'plain', E: 'plain' },
        pointLabels: { A: '', B: '', C: '', D: '', E: '' },
        sideLabels: { AB: '', BC: '', CD: '', DE: '', EA: '' },
        centerLabel: ''
      }
    }
  },
  {
    id: 'hexagon-interior-angle-sum',
    title: '六角形の内角の和',
    outputFile: 'hexagon-interior-angle-sum.png',
    html: regularPolygonDrawToolPreviewHtml,
    source: 'draw-polygon-regular-mobile',
    polygonConfig: {
      vertexCount: 6,
      sideLen: 5,
      readyMessage: '六角形の内角の和を描画しています。',
      fileBase: 'learn-hexagon-interior-angle-sum',
      initialState: {
        points: [
          { x: -0.5, y: -5.2 },
          { x: 4.4, y: -2.4 },
          { x: 3.2, y: 2.5 },
          { x: 0.2, y: 4.2 },
          { x: -3.6, y: 2.0 },
          { x: -4.9, y: -1.2 }
        ],
        diagonals: [['A', 'C'], ['A', 'D'], ['A', 'E']],
        angleKinds: { A: 'plain', B: 'plain', C: 'plain', D: 'plain', E: 'plain', F: 'plain' },
        pointLabels: { A: '', B: '', C: '', D: '', E: '', F: '' },
        sideLabels: { AB: '', BC: '', CD: '', DE: '', EF: '', FA: '' },
        centerLabel: ''
      }
    }
  },
  {
    id: 'polygon-exterior-angle-sum',
    title: '多角形の外角の和',
    outputFile: 'polygon-exterior-angle-sum.png',
    html: regularPolygonDrawToolPreviewHtml,
    source: 'draw-polygon-regular-mobile',
    polygonConfig: {
      vertexCount: 5,
      sideLen: 5,
      readyMessage: '多角形の外角の和を描画しています。',
      fileBase: 'learn-polygon-exterior-angle-sum',
      initialState: {
        points: [
          { x: -0.5, y: -5.2 },
          { x: 4.4, y: -2.4 },
          { x: 3.2, y: 2.5 },
          { x: -1.5, y: 3.8 },
          { x: -4.9, y: 0.2 }
        ],
        exteriorAngleKinds: { A: 'plain', B: 'plain', C: 'plain', D: 'plain', E: 'plain' },
        exteriorAngleLabels: { A: '', B: '', C: '', D: '', E: '' },
        pointLabels: { A: '', B: '', C: '', D: '', E: '' },
        sideLabels: { AB: '', BC: '', CD: '', DE: '', EA: '' },
        centerLabel: ''
      }
    }
  },
  {
    id: 'regular-polygon-one-interior-angle',
    title: '正多角形の1つの内角',
    outputFile: 'regular-polygon-one-interior-angle.png',
    html: regularPolygonDrawToolPreviewHtml,
    source: 'draw-polygon-regular-mobile',
    polygonConfig: {
      vertexCount: 6,
      sideLen: 5,
      readyMessage: '正多角形の1つの内角を描画しています。',
      fileBase: 'learn-regular-polygon-one-interior-angle',
      initialState: {
        sideKinds: { AB: 'single', BC: 'single', CD: 'single', DE: 'single', EF: 'single', FA: 'single' },
        sideLabels: { AB: '', BC: '', CD: '', DE: '', EF: '', FA: '' },
        angleKinds: { A: 'circle', B: 'circle', C: 'circle', D: 'circle', E: 'circle', F: 'circle' }
      }
    }
  },
  {
    id: 'regular-polygon-area',
    title: '正多角形の面積（底辺と高さ）',
    outputFile: 'regular-polygon-area.png',
    html: regularPolygonDrawToolPreviewHtml,
    source: 'draw-polygon-regular-mobile',
    polygonConfig: {
      vertexCount: 6,
      sideLen: 5,
      readyMessage: '正多角形の面積（底辺と高さ）を描画しています。',
      fileBase: 'learn-regular-polygon-area',
      initialState: {
        sideKinds: { AB: 'plain', BC: 'plain', CD: 'plain', DE: 'plain', EF: 'plain', FA: 'plain' },
        sideLabels: { AB: '', BC: '', CD: '', DE: '底辺', EF: '', FA: '' },
        sideArcVisible: { AB: false, BC: false, CD: false, DE: true, EF: false, FA: false },
        pointLabels: { A: '', B: '', C: '', D: '', E: '', F: '' },
        radiusLabels: { OA: '', OB: '', OC: '', OD: '', OE: '', OF: '' },
        radiusArcVisible: { OA: false, OB: false, OC: false, OD: false, OE: false, OF: false },
        extraPoints: {
          H: { x: -2.1650635094610964, y: 3.75 }
        },
        extraPointLabels: { H: 'H' },
        extraSegments: [
          { id: 'OH', p1: 'O', p2: 'H', stroke: '#687086', strokeWidth: '3' }
        ],
        extraSegmentLabels: { OH: '高さ' },
        extraSegmentKinds: { OH: 'plain' },
        extraSegmentArcVisible: { OH: true },
        labelOffsets: {
          extraPoint: { H: { x: -10, y: 10 } },
          extraSegment: { OH: { x: -42, y: -18 } }
        },
        labelScales: {
          'side:DE': 0.68,
          'extraSegment:OH': 0.72,
          'extraPoint:H': 0.82
        },
        diagonals: [['O', 'A'], ['O', 'B'], ['O', 'C'], ['O', 'D'], ['O', 'E'], ['O', 'F']]
      }
    }
  },
  {
    id: 'pentagon-definition',
    title: '五角形の定義',
    outputFile: 'pentagon-definition.png',
    html: regularPolygonDrawToolPreviewHtml,
    source: 'draw-polygon-regular-mobile',
    polygonConfig: {
      vertexCount: 5,
      sideLen: 5,
      readyMessage: '五角形を描画しています。',
      fileBase: 'learn-pentagon-definition'
    }
  },
  {
    id: 'hexagon-definition',
    title: '六角形の定義',
    outputFile: 'hexagon-definition.png',
    html: regularPolygonDrawToolPreviewHtml,
    source: 'draw-polygon-regular-mobile',
    polygonConfig: {
      vertexCount: 6,
      sideLen: 5,
      readyMessage: '六角形を描画しています。',
      fileBase: 'learn-hexagon-definition'
    }
  },
  {
    id: 'parallelogram-definition',
    title: '平行四辺形の定義',
    outputFile: 'parallelogram-definition.png',
    html: quadrilateralFigureModelHtml,
    source: 'figure-model-quadrilateral-mobile',
    figureModelKey: 'quadrilateral.parallelogram.definition',
    figureModelInput: {
      values: { width: 7, height: 4.6, shift: 2.5 },
      preset: 'learn.definition',
      display: {
        pointLabels: false,
        segmentLabels: false,
        angleLabels: false,
        guides: false
      },
      overrides: {
        objects: {
          points: {
            A: { marker: { visible: false } },
            B: { marker: { visible: false } },
            C: { marker: { visible: false } },
            D: { marker: { visible: false } }
          }
        }
      }
    },
    fileBase: 'learn-parallelogram-definition'
  },
  {
    id: 'parallelogram-opposite-sides',
    title: '平行四辺形の性質①（向かい合う辺）',
    outputFile: 'parallelogram-opposite-sides.png',
    html: quadrilateralFigureModelHtml,
    source: 'figure-model-quadrilateral-mobile',
    figureModelKey: 'quadrilateral.parallelogram.definition',
    figureModelInput: {
      values: { width: 7, height: 4.6, shift: 2.5 },
      preset: 'learn.property',
      display: {
        pointLabels: false,
        segmentLabels: false,
        angleLabels: false,
        guides: false,
        segmentMarkCongestion: 0
      },
      overrides: {
        objects: {
          points: {
            A: { marker: { visible: false } },
            B: { marker: { visible: false } },
            C: { marker: { visible: false } },
            D: { marker: { visible: false } }
          }
        }
      }
    },
    configureScript: quadrilateralParallelogramOppositeSidesConfigureScript,
    fileBase: 'learn-parallelogram-opposite-sides'
  },
  {
    id: 'parallelogram-opposite-angles',
    title: '平行四辺形の性質②（向かい合う角）',
    outputFile: 'parallelogram-opposite-angles.png',
    html: quadrilateralFigureModelHtml,
    source: 'figure-model-quadrilateral-mobile',
    figureModelKey: 'quadrilateral.parallelogram.definition',
    figureModelInput: {
      values: { width: 7, height: 4.6, shift: 2.5 },
      preset: 'learn.property',
      display: {
        pointLabels: false,
        segmentLabels: false,
        angleLabels: false,
        guides: false
      },
      overrides: {
        objects: {
          points: {
            A: { marker: { visible: false } },
            B: { marker: { visible: false } },
            C: { marker: { visible: false } },
            D: { marker: { visible: false } }
          }
        }
      }
    },
    configureScript: quadrilateralParallelogramOppositeAnglesConfigureScript,
    fileBase: 'learn-parallelogram-opposite-angles'
  },
  {
    id: 'parallelogram-diagonals-bisect',
    title: '平行四辺形の性質③（対角線）',
    outputFile: 'parallelogram-diagonals-bisect.png',
    html: quadrilateralFigureModelHtml,
    source: 'figure-model-quadrilateral-mobile',
    figureModelKey: 'quadrilateral.parallelogram.definition',
    figureModelInput: {
      values: { width: 7, height: 4.6, shift: 2.5 },
      preset: 'learn.property',
      display: {
        pointLabels: false,
        segmentLabels: false,
        angleLabels: false,
        guides: false,
        segmentMarkCongestion: 0
      },
      overrides: {
        objects: {
          points: {
            A: { marker: { visible: false } },
            B: { marker: { visible: false } },
            C: { marker: { visible: false } },
            D: { marker: { visible: false } }
          }
        }
      }
    },
    configureScript: quadrilateralParallelogramDiagonalsBisectConfigureScript,
    fileBase: 'learn-parallelogram-diagonals-bisect'
  },
  {
    id: 'parallelogram-one-pair-parallel-equal',
    title: '平行四辺形になる条件⑤（1組の向かい合う辺）',
    outputFile: 'parallelogram-one-pair-parallel-equal.png',
    html: quadrilateralFigureModelHtml,
    source: 'figure-model-quadrilateral-mobile',
    figureModelKey: 'quadrilateral.parallelogram.definition',
    figureModelInput: {
      values: { width: 7, height: 4.6, shift: 2.5 },
      preset: 'learn.property',
      display: {
        pointLabels: false,
        segmentLabels: false,
        angleLabels: false,
        guides: false,
        segmentMarkCongestion: 0
      },
      overrides: {
        objects: {
          points: {
            A: { marker: { visible: false } },
            B: { marker: { visible: false } },
            C: { marker: { visible: false } },
            D: { marker: { visible: false } }
          }
        }
      }
    },
    configureScript: quadrilateralParallelogramOnePairParallelEqualConfigureScript,
    fileBase: 'learn-parallelogram-one-pair-parallel-equal'
  },
  {
    id: 'rectangle-definition',
    title: '長方形の定義',
    outputFile: 'rectangle-definition.png',
    html: quadrilateralFigureModelHtml,
    source: 'figure-model-quadrilateral-mobile',
    figureModelKey: 'quadrilateral.rectangle.definition',
    figureModelInput: {
      values: { width: 7, height: 5 },
      preset: 'learn.definition',
      display: {
        pointLabels: false,
        segmentLabels: false,
        angleLabels: false,
        guides: false
      }
    },
    fileBase: 'learn-rectangle-definition'
  },
  {
    id: 'rectangle-diagonals',
    title: '長方形の性質①（対角線）',
    outputFile: 'rectangle-diagonals.png',
    html: quadrilateralFigureModelHtml,
    source: 'figure-model-quadrilateral-mobile',
    figureModelKey: 'quadrilateral.rectangle.definition',
    figureModelInput: {
      values: { width: 7, height: 5 },
      preset: 'learn.property',
      display: {
        pointLabels: false,
        segmentLabels: false,
        angleLabels: false,
        guides: false,
        segmentMarkCongestion: 0
      },
      overrides: {
        objects: {
          points: {
            A: { marker: { visible: false } },
            B: { marker: { visible: false } },
            C: { marker: { visible: false } },
            D: { marker: { visible: false } }
          }
        }
      }
    },
    configureScript: quadrilateralRectangleDiagonalsConfigureScript,
    fileBase: 'learn-rectangle-diagonals'
  },
  {
    id: 'rectangle-condition-diagonals',
    title: '長方形になるための条件①（対角線）',
    outputFile: 'rectangle-condition-diagonals.png',
    html: quadrilateralFigureModelHtml,
    source: 'figure-model-quadrilateral-mobile',
    figureModelKey: 'quadrilateral.rectangle.definition',
    figureModelInput: {
      values: { width: 7, height: 5 },
      preset: 'learn.property',
      display: {
        pointLabels: false,
        segmentLabels: false,
        angleLabels: false,
        guides: false,
        segmentMarkCongestion: 0
      },
      overrides: {
        objects: {
          points: {
            A: { marker: { visible: false } },
            B: { marker: { visible: false } },
            C: { marker: { visible: false } },
            D: { marker: { visible: false } }
          }
        }
      }
    },
    configureScript: quadrilateralRectangleConditionDiagonalsConfigureScript,
    fileBase: 'learn-rectangle-condition-diagonals'
  },
  {
    id: 'rectangle-condition-three-right-angles',
    title: '長方形になるための条件②（3つの角）',
    outputFile: 'rectangle-condition-three-right-angles.png',
    html: quadrilateralFigureModelHtml,
    source: 'figure-model-quadrilateral-mobile',
    figureModelKey: 'quadrilateral.rectangle.definition',
    figureModelInput: {
      values: { width: 7, height: 5 },
      preset: 'learn.property',
      display: {
        pointLabels: false,
        segmentLabels: false,
        angleLabels: false,
        guides: false,
        segmentMarkCongestion: 0
      },
      overrides: {
        objects: {
          points: {
            A: { marker: { visible: false } },
            B: { marker: { visible: false } },
            C: { marker: { visible: false } },
            D: { marker: { visible: false } }
          }
        }
      }
    },
    configureScript: quadrilateralRectangleConditionThreeRightAnglesConfigureScript,
    fileBase: 'learn-rectangle-condition-three-right-angles'
  },
  {
    id: 'rhombus-definition',
    title: 'ひし形の定義',
    outputFile: 'rhombus-definition.png',
    html: quadrilateralFigureModelHtml,
    source: 'figure-model-quadrilateral-mobile',
    figureModelKey: 'quadrilateral.rhombus.definition',
    figureModelInput: {
      values: { side: 6, slant: 3.8 },
      preset: 'learn.definition',
      display: {
        pointLabels: false,
        segmentLabels: false,
        angleLabels: false,
        guides: false
      }
    },
    fileBase: 'learn-rhombus-definition'
  },
  {
    id: 'rhombus-diagonals',
    title: 'ひし形の性質①（対角線）',
    outputFile: 'rhombus-diagonals.png',
    html: quadrilateralFigureModelHtml,
    source: 'figure-model-quadrilateral-mobile',
    figureModelKey: 'quadrilateral.rhombus.definition',
    figureModelInput: {
      values: { side: 6, slant: 3.8 },
      preset: 'learn.property',
      display: {
        pointLabels: false,
        segmentLabels: false,
        angleLabels: false,
        guides: false,
        segmentMarkCongestion: 0
      },
      overrides: {
        objects: {
          points: {
            A: { marker: { visible: false } },
            B: { marker: { visible: false } },
            C: { marker: { visible: false } },
            D: { marker: { visible: false } }
          }
        }
      }
    },
    configureScript: quadrilateralRhombusDiagonalsConfigureScript,
    fileBase: 'learn-rhombus-diagonals'
  },
  {
    id: 'rhombus-condition-diagonals',
    title: 'ひし形になるための条件①（対角線）',
    outputFile: 'rhombus-condition-diagonals.png',
    html: quadrilateralFigureModelHtml,
    source: 'figure-model-quadrilateral-mobile',
    figureModelKey: 'quadrilateral.rhombus.definition',
    figureModelInput: {
      values: { side: 6, slant: 3.8 },
      preset: 'learn.property',
      display: {
        pointLabels: false,
        segmentLabels: false,
        angleLabels: false,
        guides: false,
        segmentMarkCongestion: 0
      },
      overrides: {
        objects: {
          points: {
            A: { marker: { visible: false } },
            B: { marker: { visible: false } },
            C: { marker: { visible: false } },
            D: { marker: { visible: false } }
          }
        }
      }
    },
    configureScript: quadrilateralRhombusConditionDiagonalsConfigureScript,
    fileBase: 'learn-rhombus-condition-diagonals'
  },
  {
    id: 'rhombus-condition-four-equal-sides',
    title: 'ひし形になるための条件②（4つの辺）',
    outputFile: 'rhombus-condition-four-equal-sides.png',
    html: quadrilateralFigureModelHtml,
    source: 'figure-model-quadrilateral-mobile',
    figureModelKey: 'quadrilateral.rhombus.definition',
    figureModelInput: {
      values: { side: 6, slant: 3.8 },
      preset: 'learn.property',
      display: {
        pointLabels: false,
        segmentLabels: false,
        angleLabels: false,
        guides: false,
        segmentMarkCongestion: 0
      },
      overrides: {
        objects: {
          points: {
            A: { marker: { visible: false } },
            B: { marker: { visible: false } },
            C: { marker: { visible: false } },
            D: { marker: { visible: false } }
          }
        }
      }
    },
    configureScript: quadrilateralRhombusConditionFourEqualSidesConfigureScript,
    fileBase: 'learn-rhombus-condition-four-equal-sides'
  },
  {
    id: 'square-definition',
    title: '正方形の定義',
    outputFile: 'square-definition.png',
    html: quadrilateralFigureModelHtml,
    source: 'figure-model-quadrilateral-mobile',
    figureModelKey: 'quadrilateral.square.definition',
    figureModelInput: {
      values: { side: 6 },
      preset: 'learn.definition',
      display: {
        pointLabels: false,
        segmentLabels: false,
        angleLabels: false,
        guides: false
      },
      overrides: {
        objects: {
          points: {
            A: { marker: { visible: false } },
            B: { marker: { visible: false } },
            C: { marker: { visible: false } },
            D: { marker: { visible: false } }
          }
        }
      }
    },
    fileBase: 'learn-square-definition'
  },
  {
    id: 'square-diagonals',
    title: '正方形の性質①（対角線）',
    outputFile: 'square-diagonals.png',
    html: quadrilateralFigureModelHtml,
    source: 'figure-model-quadrilateral-mobile',
    figureModelKey: 'quadrilateral.square.definition',
    figureModelInput: {
      values: { side: 6 },
      preset: 'learn.property',
      display: {
        pointLabels: false,
        segmentLabels: false,
        angleLabels: false,
        guides: false,
        segmentMarkCongestion: 0
      },
      overrides: {
        objects: {
          points: {
            A: { marker: { visible: false } },
            B: { marker: { visible: false } },
            C: { marker: { visible: false } },
            D: { marker: { visible: false } }
          }
        }
      }
    },
    configureScript: quadrilateralSquareDiagonalsConfigureScript,
    fileBase: 'learn-square-diagonals'
  },
  {
    id: 'square-condition-diagonals',
    title: '正方形になるための条件①（対角線）',
    outputFile: 'square-condition-diagonals.png',
    html: quadrilateralFigureModelHtml,
    source: 'figure-model-quadrilateral-mobile',
    figureModelKey: 'quadrilateral.square.definition',
    figureModelInput: {
      values: { side: 6 },
      preset: 'learn.property',
      display: {
        pointLabels: false,
        segmentLabels: false,
        angleLabels: false,
        guides: false,
        segmentMarkCongestion: 0
      },
      overrides: {
        objects: {
          points: {
            A: { marker: { visible: false } },
            B: { marker: { visible: false } },
            C: { marker: { visible: false } },
            D: { marker: { visible: false } }
          }
        }
      }
    },
    configureScript: quadrilateralSquareConditionDiagonalsConfigureScript,
    fileBase: 'learn-square-condition-diagonals'
  },
  {
    id: 'square-condition-rectangle-equal-adjacent-sides',
    title: '正方形になるための条件②（長方形と辺）',
    outputFile: 'square-condition-rectangle-equal-adjacent-sides.png',
    html: quadrilateralFigureModelHtml,
    source: 'figure-model-quadrilateral-mobile',
    figureModelKey: 'quadrilateral.square.definition',
    figureModelInput: {
      values: { side: 6 },
      preset: 'learn.property',
      display: {
        pointLabels: false,
        segmentLabels: false,
        angleLabels: false,
        guides: false,
        segmentMarkCongestion: 0
      },
      overrides: {
        objects: {
          points: {
            A: { marker: { visible: false } },
            B: { marker: { visible: false } },
            C: { marker: { visible: false } },
            D: { marker: { visible: false } }
          }
        }
      }
    },
    configureScript: quadrilateralSquareConditionRectangleEqualAdjacentSidesConfigureScript,
    fileBase: 'learn-square-condition-rectangle-equal-adjacent-sides'
  },
  {
    id: 'square-condition-rhombus-right-angle',
    title: '正方形になるための条件③（ひし形と角）',
    outputFile: 'square-condition-rhombus-right-angle.png',
    html: quadrilateralFigureModelHtml,
    source: 'figure-model-quadrilateral-mobile',
    figureModelKey: 'quadrilateral.square.definition',
    figureModelInput: {
      values: { side: 6 },
      preset: 'learn.property',
      display: {
        pointLabels: false,
        segmentLabels: false,
        angleLabels: false,
        guides: false,
        segmentMarkCongestion: 0
      },
      overrides: {
        objects: {
          points: {
            A: { marker: { visible: false } },
            B: { marker: { visible: false } },
            C: { marker: { visible: false } },
            D: { marker: { visible: false } }
          }
        }
      }
    },
    configureScript: quadrilateralSquareConditionRhombusRightAngleConfigureScript,
    fileBase: 'learn-square-condition-rhombus-right-angle'
  },
  {
    id: 'square-condition-rectangle-perpendicular-diagonals',
    title: '正方形になるための条件④（長方形と対角線）',
    outputFile: 'square-condition-rectangle-perpendicular-diagonals.png',
    html: quadrilateralFigureModelHtml,
    source: 'figure-model-quadrilateral-mobile',
    figureModelKey: 'quadrilateral.square.definition',
    figureModelInput: {
      values: { side: 6 },
      preset: 'learn.property',
      display: {
        pointLabels: false,
        segmentLabels: false,
        angleLabels: false,
        guides: false,
        segmentMarkCongestion: 0
      },
      overrides: {
        objects: {
          points: {
            A: { marker: { visible: false } },
            B: { marker: { visible: false } },
            C: { marker: { visible: false } },
            D: { marker: { visible: false } }
          }
        }
      }
    },
    configureScript: quadrilateralSquareConditionRectanglePerpendicularDiagonalsConfigureScript,
    fileBase: 'learn-square-condition-rectangle-perpendicular-diagonals'
  },
  {
    id: 'square-condition-rhombus-equal-diagonals',
    title: '正方形になるための条件⑤（ひし形と対角線）',
    outputFile: 'square-condition-rhombus-equal-diagonals.png',
    html: quadrilateralFigureModelHtml,
    source: 'figure-model-quadrilateral-mobile',
    figureModelKey: 'quadrilateral.square.definition',
    figureModelInput: {
      values: { side: 6 },
      preset: 'learn.property',
      display: {
        pointLabels: false,
        segmentLabels: false,
        angleLabels: false,
        guides: false,
        segmentMarkCongestion: 0
      },
      overrides: {
        objects: {
          points: {
            A: { marker: { visible: false } },
            B: { marker: { visible: false } },
            C: { marker: { visible: false } },
            D: { marker: { visible: false } }
          }
        }
      }
    },
    configureScript: quadrilateralSquareConditionRhombusEqualDiagonalsConfigureScript,
    fileBase: 'learn-square-condition-rhombus-equal-diagonals'
  },
  {
    id: 'trapezoid-definition',
    title: '台形の定義',
    outputFile: 'trapezoid-definition.png',
    html: quadrilateralFigureModelHtml,
    source: 'figure-model-quadrilateral-mobile',
    figureModelKey: 'quadrilateral.trapezoid.definition',
    figureModelInput: {
      values: { topBase: 4, bottomBase: 8, height: 5, shift: 1.5 },
      preset: 'learn.definition',
      display: {
        pointLabels: false,
        segmentLabels: false,
        angleLabels: false,
        guides: false
      }
    },
    fileBase: 'learn-trapezoid-definition'
  },
  {
    id: 'rectangle-area',
    title: '長方形の面積',
    outputFile: 'rectangle-area.png',
    html: quadrilateralFigureModelHtml,
    source: 'figure-model-quadrilateral-mobile',
    figureModelKey: 'quadrilateral.rectangle.definition',
    figureModelInput: {
      values: { width: 7, height: 5 },
      preset: 'learn.formula',
      display: {
        pointLabels: false,
        segmentLabels: false,
        angleLabels: false,
        guides: false
      },
      modal: {
        sides: {
          AB: { mode: 'freeText', text: '縦', guide: true, color: '#2a5bd7' },
          BC: { mode: 'freeText', text: '横', guide: true, color: '#2a5bd7' }
        }
      }
    },
    configureScript: quadrilateralRectangleAreaConfigureScript,
    fileBase: 'learn-rectangle-area'
  },
  {
    id: 'rectangle-perimeter',
    title: '長方形の周の長さ',
    outputFile: 'rectangle-perimeter.png',
    html: quadrilateralFigureModelHtml,
    source: 'figure-model-quadrilateral-mobile',
    figureModelKey: 'quadrilateral.rectangle.definition',
    figureModelInput: {
      values: { width: 7, height: 5 },
      preset: 'learn.formula',
      display: {
        pointLabels: false,
        segmentLabels: false,
        angleLabels: false,
        guides: false
      },
      modal: {
        sides: {
          AB: { mode: 'freeText', text: '縦', guide: true, color: '#2a5bd7' },
          BC: { mode: 'freeText', text: '横', guide: true, color: '#2a5bd7' }
        }
      }
    },
    configureScript: quadrilateralRectangleAreaConfigureScript,
    fileBase: 'learn-rectangle-perimeter'
  },
  {
    id: 'square-area',
    title: '正方形の面積',
    outputFile: 'square-area.png',
    html: quadrilateralFigureModelHtml,
    source: 'figure-model-quadrilateral-mobile',
    figureModelKey: 'quadrilateral.square.definition',
    figureModelInput: {
      values: { side: 6 },
      preset: 'learn.formula',
      display: {
        pointLabels: false,
        segmentMarkCongestion: 0,
        segmentLabels: false,
        angleLabels: false,
        guides: false
      },
      modal: {
        sides: {
          BC: { mode: 'freeText', text: '1辺', guide: true, color: '#2a5bd7' }
        }
      }
    },
    fileBase: 'learn-square-area'
  },
  {
    id: 'square-perimeter',
    title: '正方形の周の長さ',
    outputFile: 'square-perimeter.png',
    html: quadrilateralFigureModelHtml,
    source: 'figure-model-quadrilateral-mobile',
    figureModelKey: 'quadrilateral.square.definition',
    figureModelInput: {
      values: { side: 6 },
      preset: 'learn.formula',
      display: {
        pointLabels: false,
        segmentMarkCongestion: 0,
        segmentLabels: false,
        angleLabels: false,
        guides: false
      },
      modal: {
        sides: {
          BC: { mode: 'freeText', text: '1辺', guide: true, color: '#2a5bd7' }
        }
      }
    },
    fileBase: 'learn-square-perimeter'
  },
  {
    id: 'parallelogram-area-base-height',
    title: '平行四辺形の面積（底辺と高さ）',
    outputFile: 'parallelogram-area-base-height.png',
    html: quadrilateralFigureModelHtml,
    source: 'figure-model-quadrilateral-mobile',
    figureModelKey: 'quadrilateral.parallelogram.definition',
    figureModelInput: {
      values: { width: 7, height: 4.8, shift: 2.1 },
      preset: 'learn.formula',
      display: {
        pointLabels: false,
        segmentLabels: false,
        angleLabels: false,
        guides: false
      },
      modal: {
        sides: {
          BC: { mode: 'freeText', text: '底辺', guide: true, color: '#2a5bd7' }
        }
      }
    },
    configureScript: quadrilateralBaseHeightConfigureScript,
    fileBase: 'learn-parallelogram-area-base-height'
  },
  {
    id: 'trapezoid-area-bases-height',
    title: '台形の面積（上底・下底・高さ）',
    outputFile: 'trapezoid-area-bases-height.png',
    html: quadrilateralFigureModelHtml,
    source: 'figure-model-quadrilateral-mobile',
    figureModelKey: 'quadrilateral.trapezoid.definition',
    figureModelInput: {
      values: { topBase: 4.2, bottomBase: 8, height: 5, shift: 1.4 },
      preset: 'learn.formula',
      display: {
        pointLabels: false,
        segmentLabels: false,
        angleLabels: false,
        guides: false
      },
      modal: {
        sides: {
          DA: { mode: 'freeText', text: '上底', guide: true, color: '#2a5bd7' },
          BC: { mode: 'freeText', text: '下底', guide: true, color: '#2a5bd7' }
        }
      }
    },
    configureScript: quadrilateralBaseHeightConfigureScript,
    fileBase: 'learn-trapezoid-area-bases-height'
  },
  {
    id: 'rhombus-area-diagonals',
    title: 'ひし形の面積（対角線）',
    outputFile: 'rhombus-area-diagonals.png',
    html: quadrilateralFigureModelHtml,
    source: 'figure-model-quadrilateral-mobile',
    figureModelKey: 'quadrilateral.rhombus.definition',
    figureModelInput: {
      values: { side: 6, slant: 3.8 },
      preset: 'learn.formula',
      display: {
        pointLabels: false,
        segmentMarkCongestion: 0,
        segmentLabels: false,
        angleLabels: false,
        guides: false
      }
    },
    configureScript: quadrilateralDiagonalsConfigureScript,
    fileBase: 'learn-rhombus-area-diagonals'
  },
  {
    id: 'triangle-congruence',
    title: '三角形の合同条件①（3組の辺）',
    outputFile: 'triangle-congruence.png',
    html: triangleToolPairHtml,
    source: 'figure-model-triangle-mobile-pair',
    figureModelKey: 'triangle.congruence.sss',
    figureModelInput: {
      values: {
        side1: 6,
        side2: 5,
        side3: 7
      },
      preset: 'learn.condition',
      display: {
        pointLabels: true,
        labelScale: 0.78,
        segmentMarkCongestion: 0,
        segmentLabels: false,
        givenSegmentLabels: false,
        angleLabels: false,
        givenAngleLabels: false,
        guides: false
      }
    },
    fileBase: 'learn-triangle-congruence'
  },
  {
    id: 'triangle-congruence-sas',
    title: '三角形の合同条件②（2辺とその間の角）',
    outputFile: 'triangle-congruence-sas.png',
    html: triangleToolPairHtml,
    source: 'figure-model-triangle-mobile-pair',
    figureModelKey: 'triangle.congruence.sas',
    figureModelInput: {
      values: {
        side1: 6,
        side2: 5,
        includedAngle: 58
      },
      preset: 'learn.condition',
      display: {
        pointLabels: true,
        labelScale: 0.78,
        segmentMarkCongestion: 0.18,
        segmentLabels: false,
        givenSegmentLabels: false,
        angleLabels: false,
        givenAngleLabels: false,
        guides: false
      }
    },
    fileBase: 'learn-triangle-congruence-sas'
  },
  {
    id: 'triangle-congruence-asa',
    title: '三角形の合同条件③（1辺とその両端の角）',
    outputFile: 'triangle-congruence-asa.png',
    html: triangleToolPairHtml,
    source: 'figure-model-triangle-mobile-pair',
    figureModelKey: 'triangle.congruence.asa',
    figureModelInput: {
      values: {
        side1: 6,
        angleA: 48,
        angleB: 66
      },
      preset: 'learn.condition',
      display: {
        pointLabels: true,
        labelScale: 0.78,
        segmentMarkCongestion: 0.22,
        segmentLabels: false,
        givenSegmentLabels: false,
        angleLabels: false,
        givenAngleLabels: false,
        guides: false
      }
    },
    fileBase: 'learn-triangle-congruence-asa'
  },
  {
    id: 'right-triangle-congruence-hypotenuse-leg',
    title: '直角三角形の合同条件①（斜辺と他の辺）',
    outputFile: 'right-triangle-congruence-hypotenuse-leg.png',
    html: triangleToolPairHtml,
    source: 'figure-model-triangle-mobile-pair',
    figureModelKey: 'triangle.congruence.sss',
    figureModelInput: rightTriangleCongruenceInput('hypotenuse-leg'),
    fileBase: 'learn-right-triangle-congruence-hypotenuse-leg'
  },
  {
    id: 'right-triangle-congruence-hypotenuse-acute-angle',
    title: '直角三角形の合同条件②（斜辺と1つの鋭角）',
    outputFile: 'right-triangle-congruence-hypotenuse-acute-angle.png',
    html: triangleToolPairHtml,
    source: 'figure-model-triangle-mobile-pair',
    figureModelKey: 'triangle.congruence.sss',
    figureModelInput: rightTriangleCongruenceInput('hypotenuse-acute-angle'),
    fileBase: 'learn-right-triangle-congruence-hypotenuse-acute-angle'
  },
  {
    id: 'triangle-similarity-sss',
    title: '三角形の相似条件①（3組の辺の比）',
    outputFile: 'triangle-similarity-sss.png',
    html: triangleToolPairHtml,
    source: 'figure-model-triangle-mobile-pair',
    figureModelKey: 'triangle.congruence.sss',
    figureModelInput: triangleSimilarityInput('sss'),
    fileBase: 'learn-triangle-similarity-sss'
  },
  {
    id: 'triangle-similarity-sas',
    title: '三角形の相似条件②（2組の辺の比とその間の角）',
    outputFile: 'triangle-similarity-sas.png',
    html: triangleToolPairHtml,
    source: 'figure-model-triangle-mobile-pair',
    figureModelKey: 'triangle.congruence.sss',
    figureModelInput: triangleSimilarityInput('sas'),
    fileBase: 'learn-triangle-similarity-sas'
  },
  {
    id: 'triangle-similarity-aa',
    title: '三角形の相似条件③（2組の角）',
    outputFile: 'triangle-similarity-aa.png',
    html: triangleToolPairHtml,
    source: 'figure-model-triangle-mobile-pair',
    figureModelKey: 'triangle.congruence.sss',
    figureModelInput: triangleSimilarityInput('aa'),
    fileBase: 'learn-triangle-similarity-aa'
  },
  {
    id: 'triangle-isosceles-definition',
    title: '二等辺三角形の定義',
    outputFile: 'triangle-isosceles-definition.png',
    html: triangleFigureModelHtml,
    source: 'figure-model-triangle-mobile',
    figureModelKey: 'triangle',
    figureModelInput: {
      variant: 'isosceles',
      purpose: 'definition',
      values: { equalSides: 5, base: 6 },
      preset: 'learn.definition',
      display: {
        pointLabels: true,
        labelScale: 0.9,
        segmentMarkCongestion: 0,
        segmentLabels: false,
        angleLabels: false,
        guides: false
      }
    },
    fileBase: 'learn-triangle-isosceles-definition'
  },
  {
    id: 'triangle-isosceles-base-angles',
    title: '二等辺三角形の性質①（底角）',
    outputFile: 'triangle-isosceles-base-angles.png',
    html: triangleFigureModelHtml,
    source: 'figure-model-triangle-mobile',
    figureModelKey: 'triangle',
    figureModelInput: {
      variant: 'isosceles',
      purpose: 'property',
      values: { equalSides: 5, base: 6, angleB: 53, angleC: 53 },
      preset: 'learn.property',
      display: {
        pointLabels: true,
        labelScale: 0.9,
        segmentMarkCongestion: 0.1,
        segmentLabels: false,
        angleLabels: false,
        guides: false
      },
      overrides: {
        objects: {
          angles: {
            B: { relationMark: { visible: true, kind: 'same-angle', index: 1 } },
            C: { relationMark: { visible: true, kind: 'same-angle', index: 1 } }
          }
        }
      }
    },
    fileBase: 'learn-triangle-isosceles-base-angles'
  },
  {
    id: 'triangle-isosceles-apex-bisector',
    title: '二等辺三角形の性質②（頂角の二等分線）',
    outputFile: 'triangle-isosceles-apex-bisector.png',
    html: triangleFigureModelHtml,
    source: 'figure-model-triangle-mobile',
    figureModelKey: 'triangle',
    figureModelInput: {
      variant: 'isosceles',
      purpose: 'property',
      values: { equalSides: 5, base: 6 },
      preset: 'learn.property',
      display: {
        pointLabels: true,
        labelScale: 0.9,
        segmentMarkCongestion: 0.1,
        segmentLabels: false,
        angles: false,
        angleLabels: false,
        guides: false
      }
    },
    configureScript: triangleIsoscelesApexBisectorConfigureScript,
    fileBase: 'learn-triangle-isosceles-apex-bisector'
  },
  {
    id: 'triangle-isosceles-condition-base-angles',
    title: '二等辺三角形になるための条件（2つの角）',
    outputFile: 'triangle-isosceles-condition-base-angles.png',
    html: triangleFigureModelHtml,
    source: 'figure-model-triangle-mobile',
    figureModelKey: 'triangle',
    figureModelInput: {
      variant: 'isosceles',
      purpose: 'property',
      values: { equalSides: 5, base: 6, angleB: 53, angleC: 53 },
      preset: 'learn.property',
      display: {
        pointLabels: true,
        labelScale: 0.9,
        segmentMarkCongestion: 0.1,
        relationMarks: false,
        segmentLabels: false,
        angleLabels: false,
        guides: false
      },
      overrides: {
        objects: {
          angles: {
            A: { mark: { visible: false } },
            B: { relationMark: { visible: true, kind: 'same-angle', index: 1 } },
            C: { relationMark: { visible: true, kind: 'same-angle', index: 1 } }
          }
        }
      }
    },
    fileBase: 'learn-triangle-isosceles-condition-base-angles'
  },
  {
    id: 'triangle-equilateral-definition',
    title: '正三角形の定義',
    outputFile: 'triangle-equilateral-definition.png',
    html: triangleFigureModelHtml,
    source: 'figure-model-triangle-mobile',
    figureModelKey: 'triangle',
    figureModelInput: {
      variant: 'equilateral',
      purpose: 'definition',
      values: { side: 6 },
      preset: 'learn.definition',
      display: {
        pointLabels: true,
        labelScale: 0.9,
        segmentMarkCongestion: 0,
        segmentLabels: false,
        angleLabels: false,
        guides: false
      }
    },
    fileBase: 'learn-triangle-equilateral-definition'
  },
  {
    id: 'triangle-equilateral-angles',
    title: '正三角形の3つの角',
    outputFile: 'triangle-equilateral-angles.png',
    html: triangleFigureModelHtml,
    source: 'figure-model-triangle-mobile',
    figureModelKey: 'triangle',
    figureModelInput: {
      variant: 'equilateral',
      purpose: 'property',
      values: { side: 6, angleA: 60, angleB: 60, angleC: 60 },
      preset: 'learn.property',
      display: {
        pointLabels: true,
        labelScale: 0.9,
        segmentMarkCongestion: 0.18,
        segmentLabels: false,
        angleLabels: true,
        guides: false
      },
      overrides: {
        objects: {
          angles: {
            A: { mark: { visible: false }, label: { visible: true, mode: 'space' }, relationMark: { visible: false } },
            B: { mark: { visible: false }, label: { visible: true, mode: 'space' }, relationMark: { visible: false } },
            C: { mark: { visible: false }, label: { visible: true, mode: 'space' }, relationMark: { visible: false } }
          }
        }
      }
    },
    fileBase: 'learn-triangle-equilateral-angles'
  },
  {
    id: 'triangle-right-definition',
    title: '直角三角形の定義',
    outputFile: 'triangle-right-definition.png',
    html: triangleFigureModelHtml,
    source: 'figure-model-triangle-mobile',
    figureModelKey: 'triangle',
    figureModelInput: {
      variant: 'rightRatio',
      purpose: 'definition',
      values: { ratio: [3, 4, 5], rightAngleAt: 'A' },
      preset: 'learn.definition',
      display: {
        pointLabels: true,
        labelScale: 0.9,
        segmentLabels: false,
        angles: true,
        angleLabels: false,
        guides: false
      }
    },
    fileBase: 'learn-triangle-right-definition'
  },
  {
    id: 'triangle-acute-definition',
    title: '鋭角三角形の定義',
    outputFile: 'triangle-acute-definition.png',
    html: triangleFigureModelHtml,
    source: 'figure-model-triangle-mobile',
    figureModelKey: 'triangle',
    figureModelInput: {
      purpose: 'definition',
      values: { BC: 4.596266658714, CA: 5.196152422707, AB: 5.638155724715, angleA: 50, angleB: 60, angleC: 70 },
      preset: 'learn.definition',
      display: {
        pointLabels: true,
        labelScale: 0.9,
        segmentLabels: false,
        angles: true,
        angleLabels: true,
        guides: false
      }
    },
    fileBase: 'learn-triangle-acute-definition'
  },
  {
    id: 'triangle-obtuse-definition',
    title: '鈍角三角形の定義',
    outputFile: 'triangle-obtuse-definition.png',
    html: triangleFigureModelHtml,
    source: 'figure-model-triangle-mobile',
    figureModelKey: 'triangle',
    figureModelInput: {
      purpose: 'definition',
      values: { BC: 5.638155724715, CA: 3.856725658119, AB: 3, angleA: 110, angleB: 40, angleC: 30 },
      preset: 'learn.definition',
      display: {
        pointLabels: true,
        labelScale: 0.9,
        segmentLabels: false,
        angles: true,
        angleLabels: true,
        guides: false
      },
      overrides: {
        objects: {
          angles: {
            B: { visible: false, mark: { visible: false }, label: { visible: false } },
            C: { visible: false, mark: { visible: false }, label: { visible: false } }
          }
        }
      }
    },
    fileBase: 'learn-triangle-obtuse-definition'
  },
  {
    id: 'triangle-angle-sum',
    title: '三角形の内角の和',
    outputFile: 'triangle-angle-sum.png',
    html: triangleFigureModelHtml,
    source: 'figure-model-triangle-mobile',
    figureModelKey: 'triangle',
    figureModelInput: {
      purpose: 'property',
      values: { BC: 4.596266658714, CA: 5.196152422707, AB: 5.638155724715, angleA: 50, angleB: 60, angleC: 70 },
      preset: 'learn.property',
      display: {
        pointLabels: true,
        labelScale: 0.9,
        segmentLabels: false,
        angles: true,
        angleLabels: true,
        guides: false
      }
    },
    fileBase: 'learn-triangle-angle-sum'
  },
  {
    id: 'triangle-existence-condition',
    title: '三角形の存在条件',
    outputFile: 'triangle-existence-condition.png',
    html: triangleFigureModelHtml,
    source: 'figure-model-triangle-mobile',
    figureModelKey: 'triangle',
    figureModelInput: {
      purpose: 'formula',
      values: { AB: 6, BC: 4, CA: 5 },
      preset: 'learn.formula',
      display: {
        pointLabels: true,
        labelScale: 0.9,
        segmentLabels: true,
        angles: false,
        angleLabels: false,
        guides: true,
        relationMarks: false
      },
      modal: {
        sides: {
          AB: { text: 'c', guide: true },
          BC: { text: 'a', guide: true },
          CA: { text: 'b', guide: true }
        }
      }
    },
    fileBase: 'learn-triangle-existence-condition'
  },
  {
    id: 'triangle-exterior-angle',
    title: '三角形の外角',
    outputFile: 'triangle-exterior-angle.png',
    html: triangleFigureModelHtml,
    source: 'figure-model-triangle-mobile',
    figureModelKey: 'triangle',
    figureModelInput: {
      purpose: 'property',
      values: { BC: 4, CA: 5.847608800326, AB: 5.847608800326, angleA: 40, angleB: 70, angleC: 70 },
      preset: 'learn.property',
      display: {
        pointLabels: true,
        labelScale: 0.9,
        segmentLabels: false,
        angles: false,
        angleLabels: false,
        guides: false
      },
      modal: {
        angles: {
          A: { mode: 'numeric', kind: 'plain', color: '#2a5bd7' },
          B: { mode: 'numeric', kind: 'plain', color: '#2a5bd7' },
          C: { mode: 'hidden' },
          exteriorC: { mode: 'numeric', kind: 'plain', color: '#a66800' }
        }
      }
    },
    configureScript: triangleExteriorAngleConfigureScript,
    fileBase: 'learn-triangle-exterior-angle'
  },
  {
    id: 'triangle-area-base-height',
    title: '三角形の面積（底辺と高さ）',
    outputFile: 'triangle-area-base-height.png',
    html: triangleFigureModelHtml,
    source: 'figure-model-triangle-mobile',
    figureModelKey: 'triangle',
    figureModelInput: {
      purpose: 'formula',
      construction: 'baseHeight',
      values: { base: 8, height: 5, offset: 3, BC: 8, CA: 5.830951894845, AB: 7.071067811865 },
      preset: 'learn.formula',
      display: {
        pointLabels: true,
        labelScale: 0.9,
        segmentLabels: false,
        angles: false,
        angleLabels: false,
        guides: false
      },
      modal: {
        sides: {
          a: { mode: 'freeText', text: '底辺', guide: true, color: '#2a5bd7' },
          AH: { mode: 'freeText', text: '高さ', guide: true, color: '#2a5bd7' }
        }
      }
    },
    configureScript: triangleAreaBaseHeightConfigureScript,
    fileBase: 'learn-triangle-area-base-height'
  },
  {
    id: 'triangle-segment-area-ratio-same-height',
    title: '線分比と面積比①（高さが等しい三角形）',
    outputFile: 'triangle-segment-area-ratio-same-height.png',
    html: triangleFigureModelHtml,
    source: 'figure-model-triangle-mobile',
    figureModelKey: 'triangle',
    figureModelInput: {
      purpose: 'property',
      values: { BC: 7, CA: 5.6, AB: 5.2 },
      preset: 'learn.property',
      display: {
        pointLabels: true,
        labelScale: 0.86,
        segmentLabels: false,
        angles: false,
        angleLabels: false,
        guides: false
      }
    },
    configureScript: triangleSegmentAreaRatioSameHeightConfigureScript,
    fileBase: 'learn-triangle-segment-area-ratio-same-height'
  },
  {
    id: 'triangle-segment-area-ratio-same-base',
    title: '線分比と面積比②（底辺が等しい三角形）',
    outputFile: 'triangle-segment-area-ratio-same-base.png',
    html: triangleFigureModelHtml,
    source: 'figure-model-triangle-mobile',
    figureModelKey: 'triangle',
    figureModelInput: {
      purpose: 'property',
      values: { BC: 7, CA: 5.8, AB: 5.4 },
      preset: 'learn.property',
      display: {
        pointLabels: true,
        labelScale: 0.86,
        segmentLabels: false,
        angles: false,
        angleLabels: false,
        guides: false
      }
    },
    configureScript: triangleSegmentAreaRatioSameBaseConfigureScript,
    fileBase: 'learn-triangle-segment-area-ratio-same-base'
  },
  {
    id: 'triangle-pythagorean-theorem',
    title: '三平方の定理',
    outputFile: 'triangle-pythagorean-theorem.png',
    html: triangleFigureModelHtml,
    source: 'figure-model-triangle-mobile',
    figureModelKey: 'triangle',
    figureModelInput: {
      variant: 'rightRatio',
      purpose: 'formula',
      values: { ratio: [3, 4, 5], rightAngleAt: 'A' },
      preset: 'learn.formula',
      display: {
        pointLabels: true,
        labelScale: 0.9,
        segmentLabels: true,
        angles: true,
        angleLabels: false,
        guides: false
      },
      overrides: {
        objects: {
          segments: {
            CA: { label: { visible: true, mode: 'text', valueMode: 'text', text: 'a' } },
            AB: { label: { visible: true, mode: 'text', valueMode: 'text', text: 'b' } },
            BC: { label: { visible: true, mode: 'text', valueMode: 'text', text: 'c' } }
          }
        }
      }
    },
    fileBase: 'learn-triangle-pythagorean-theorem'
  },
  {
    id: 'right-triangle-ratios',
    title: '整数比の直角三角形',
    outputFile: 'right-triangle-ratios.png',
    html: triangleFigureModelHtml,
    source: 'figure-model-triangle-mobile',
    figureModelKey: 'triangle',
    figureModelInput: {
      variant: 'rightRatio',
      purpose: 'example',
      values: { ratio: [3, 4, 5], rightAngleAt: 'A' },
      preset: 'learn.typical-example',
      display: {
        pointLabels: true,
        segmentLabels: true,
        angles: true,
        angleLabels: false,
        guides: false
      }
    },
    fileBase: 'learn-right-triangle-ratios'
  }
];

PREVIEWS.forEach((preview) => {
  if (!preview.figureModelInput) return;
  preview.figureModelInput.display = {
    ...(preview.figureModelInput.display || {}),
    points: false
  };
});

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function attrs(values) {
  return Object.entries(values)
    .filter(([, value]) => value !== null && value !== undefined && value !== false)
    .map(([key, value]) => `${key}="${esc(value)}"`)
    .join(' ');
}

function tag(name, values = {}, content = '') {
  return `<${name} ${attrs(values)}>${content}</${name}>`;
}

function single(name, values = {}) {
  return `<${name} ${attrs(values)} />`;
}

function line(x1, y1, x2, y2, extra = {}) {
  return single('line', { x1, y1, x2, y2, ...extra });
}

function circle(cx, cy, r, extra = {}) {
  return single('circle', { cx, cy, r, ...extra });
}

function polygon(points, extra = {}) {
  return single('polygon', { points: points.map((p) => `${p.x},${p.y}`).join(' '), ...extra });
}

function pathTag(d, extra = {}) {
  return single('path', { d, ...extra });
}

function polarPoint(cx, cy, r, degrees) {
  const rad = degrees * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx, cy, r, startDegrees, endDegrees) {
  const start = polarPoint(cx, cy, r, startDegrees);
  const end = polarPoint(cx, cy, r, endDegrees);
  const delta = Math.abs(endDegrees - startDegrees) % 360;
  const largeArc = delta > 180 ? 1 : 0;
  const sweep = endDegrees >= startDegrees ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} ${sweep} ${end.x} ${end.y}`;
}

function sectorPath(cx, cy, r, startDegrees, endDegrees) {
  const start = polarPoint(cx, cy, r, startDegrees);
  const end = polarPoint(cx, cy, r, endDegrees);
  const delta = Math.abs(endDegrees - startDegrees) % 360;
  const largeArc = delta > 180 ? 1 : 0;
  const sweep = endDegrees >= startDegrees ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} ${sweep} ${end.x} ${end.y} Z`;
}

function text(x, y, value, extra = {}) {
  return tag('text', { x, y, ...extra }, esc(value));
}

function marker(id, orient, pathData) {
  return tag('marker', {
    id,
    viewBox: '0 0 10 10',
    refX: '5',
    refY: '5',
    markerWidth: '7',
    markerHeight: '7',
    orient
  }, pathTag(pathData, { fill: COLORS.blue, stroke: 'none' }));
}

function baseDefs() {
  return tag('defs', {}, [
    marker('arrow-forward', 'auto', 'M 0 0 L 10 5 L 0 10 z'),
    marker('arrow-back', 'auto-start-reverse', 'M 0 0 L 10 5 L 0 10 z')
  ].join(''));
}

function pointLabel(point, label, dx = 0, dy = 0) {
  return [
    circle(point.x, point.y, 9, {
      fill: COLORS.ink,
      'data-kind': 'point',
      'data-id': label
    }),
    text(point.x + dx, point.y + dy, label, {
      class: 'ig-label point-label',
      'data-kind': 'point-label',
      'data-id': label
    })
  ].join('');
}

function segment(a, b, id, extra = {}) {
  return line(a.x, a.y, b.x, b.y, {
    class: 'ig-segment',
    'data-kind': 'segment',
    'data-id': id,
    ...extra
  });
}

function stageHtml(preview) {
  if (typeof preview.html === 'function') return preview.html(preview);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(preview.title)} preview</title>
  <style>
    html,
    body{
      margin:0;
      min-height:100%;
      background:${COLORS.surface};
    }
    body{
      display:grid;
      place-items:center;
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif;
    }
    #stage{
      display:block;
      width:1000px;
      height:1000px;
      background:${COLORS.surface};
    }
    .ig-segment,
    .ig-line{
      stroke:${COLORS.blue};
      stroke-width:6;
      stroke-linecap:round;
      stroke-linejoin:round;
      fill:none;
    }
    .ig-helper{
      stroke:${COLORS.muted};
      stroke-width:4;
      stroke-linecap:round;
      stroke-linejoin:round;
      fill:none;
    }
    .ig-label{
      fill:${COLORS.ink};
      font-family:KaTeX_Main,"Times New Roman","Hiragino Mincho ProN","Yu Mincho",serif;
      font-size:52px;
      font-weight:750;
      text-anchor:middle;
      dominant-baseline:middle;
    }
    .ig-small-label{
      fill:${COLORS.muted};
      font-family:KaTeX_Main,"Times New Roman","Hiragino Mincho ProN","Yu Mincho",serif;
      font-size:38px;
      font-weight:750;
      text-anchor:middle;
      dominant-baseline:middle;
    }
    .ig-note{
      fill:${COLORS.muted};
      font-family:KaTeX_Main,"Times New Roman","Hiragino Mincho ProN","Yu Mincho",serif;
      font-size:34px;
      font-weight:700;
      text-anchor:middle;
      dominant-baseline:middle;
    }
    .ig-mini-title{
      fill:${COLORS.ink};
      font-family:KaTeX_Main,"Times New Roman","Hiragino Mincho ProN","Yu Mincho",serif;
      font-size:34px;
      font-weight:750;
      text-anchor:middle;
      dominant-baseline:middle;
    }
  </style>
</head>
<body>
  <svg id="stage" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet" aria-label="${esc(preview.title)}の教材用描画">
    ${baseDefs()}
    <rect width="1000" height="1000" fill="${COLORS.surface}" />
    ${preview.draw()}
  </svg>
</body>
</html>`;
}

function regularPolygonDrawToolPreviewHtml(preview) {
  const config = preview.polygonConfig || {};
  const vertexCount = config.vertexCount || 5;
  const sideLen = config.sideLen || 5;
  const readyMessage = config.readyMessage || '正N角形を描画しています。';
  const fileBase = config.fileBase || preview.id;
  return `<!DOCTYPE html>
<html lang="ja" data-preview-source="draw-polygon-regular-mobile">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>${esc(preview.title)} preview</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" />
  <link rel="stylesheet" href="/assets/quadrilateral-mobile-page.css?v=regular-polygon-preview-1" />
  <style>
    html,
    body{
      margin:0;
      min-height:100%;
      background:${COLORS.surface};
    }
    body{
      display:grid;
      place-items:center;
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif;
    }
    .app,
    .stage-wrap{
      width:1000px;
      height:1000px;
      max-width:none;
      min-height:0;
      padding:0;
      margin:0;
      display:block;
      background:${COLORS.surface};
      border:0;
      box-shadow:none;
    }
    .topbar,
    .bottom-bar,
    .status,
    .sheet,
    .sheet-backdrop,
    .move-toolbar{
      display:none !important;
    }
    #stage{
      display:block;
      width:1000px;
      height:1000px;
      background:${COLORS.surface};
    }
    ${config.showText ? '' : '#stage text,\\n    #stage foreignObject,'}
    #stage line[stroke="#7d8db8"]{
      display:none !important;
    }
    #stage circle[fill="#1f2430"]{
      display:none !important;
    }
    #stage path[stroke-dasharray]{
      display:none !important;
    }
    #stage polygon[fill="rgba(42,91,215,0.02)"]{
      display:none !important;
    }
    #stage polygon[stroke="#2a5bd7"]{
      stroke-width:5;
    }
  </style>
</head>
<body data-ready-message="${esc(readyMessage)}" data-file-base="${esc(fileBase)}">
  <div class="app">
    <header class="topbar">
      <button class="btn" id="backBtn" type="button">戻る</button>
      <h1 class="topbar-title">${esc(preview.title)}</h1>
      <button class="btn" id="saveBtn" type="button">保存</button>
    </header>
    <section class="stage-wrap" id="captureRoot">
      <div class="status" id="statusBox">${esc(readyMessage)}</div>
      <svg class="stage" id="stage" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet" aria-label="${esc(preview.title)}の描画画面"></svg>
    </section>
    <footer class="bottom-bar many-fields">
      <div class="field"><div class="field-label">N（5以上の自然数）</div><input class="field-input" id="vertexCount" type="text" inputmode="numeric" pattern="[0-9]*" value="${esc(vertexCount)}" /></div>
      <div class="field"><div class="field-label">一辺の長さ</div><input class="field-input" id="sideLen" type="text" inputmode="decimal" value="${esc(sideLen)}" /></div>
    </footer>
  </div>
  <div class="sheet-backdrop" id="sheetBackdrop"></div>
  <section class="sheet" id="editSheet" aria-hidden="true">
    <div class="sheet-header"><h2 class="sheet-title" id="sheetTitle">設定</h2><button class="sheet-close" id="sheetClose" type="button" aria-label="閉じる">×</button></div>
    <div class="sheet-body" id="sheetBody"></div>
  </section>
  <section class="sheet" id="saveSheet" aria-hidden="true">
    <div class="sheet-header"><h2 class="sheet-title">保存</h2><button class="sheet-close" id="saveSheetClose" type="button" aria-label="閉じる">×</button></div>
    <div class="sheet-body">
      <div class="save-grid">
        <button class="btn" id="savePngBtn" type="button">PNG</button>
        <button class="btn" id="saveTransparentBtn" type="button">透過PNG</button>
        <button class="btn" id="savePdfBtn" type="button">PDF</button>
      </div>
    </div>
  </section>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
  <script src="/assets/mobile-angle-ornaments.js?v=segment-modal-1"></script>
  <script src="/assets/draw-shared-labels.js?v=regular-controller-1"></script>
  <script src="/assets/draw-label-taxonomy.js?v=regular-controller-1"></script>
  <script src="/assets/draw-shared-label-engine.js?v=regular-controller-1"></script>
  <script>window.InstantGeometryRegularPolygonInitialState = ${JSON.stringify(config.initialState || {})};</script>
  <script src="/assets/draw-regular-polygon-page.js?v=regular-move-2"></script>
  <script src="/assets/draw-geometry-role-definitions.js?v=role-defs-1"></script>
  <script src="/assets/draw-page-schema-adapter.js?v=schema-adapter-2"></script>
  <script src="/assets/draw-settings.js?v=settings-contract-1"></script>
  <script>
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        document.documentElement.dataset.previewReady = 'true';
      });
    });
  </script>
</body>
</html>`;
}

function functionComplexPreviewHtml(preview) {
  const config = JSON.stringify(preview.complexConfig || {});
  return `<!DOCTYPE html>
<html lang="ja" data-preview-source="function-complex-mobile">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>${esc(preview.title)} preview</title>
  <link rel="stylesheet" href="/assets/triangle-mobile-page.css" />
  <link rel="stylesheet" href="/assets/function-complex-page.css" />
  <style>
    html,
    body{
      margin:0;
      min-height:100%;
      background:${COLORS.surface};
    }
    body{
      display:grid;
      place-items:center;
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif;
    }
    .app,
    .stage-wrap{
      width:1000px;
      height:1000px;
      max-width:none;
      min-height:0;
      padding:0;
      margin:0;
      display:block;
      background:${COLORS.surface};
      border:0;
      box-shadow:none;
    }
    .topbar,
    .bottom-bar,
    .status,
    .complex-readout,
    .sheet,
    .sheet-backdrop{
      display:none !important;
    }
    #stage{
      display:block;
      width:1000px;
      height:1000px;
      background:${COLORS.surface};
    }
    #stage .complex-label{
      fill:${COLORS.blue};
      paint-order:normal;
      stroke:none;
      stroke-width:0;
    }
  </style>
</head>
<body>
  <div class="app function-complex-app">
    <header class="topbar"><div class="topbar-tools"><button class="btn" id="backBtn" type="button">戻る</button><button class="btn icon-btn" id="settingsBtn" type="button" aria-label="設定">⚙</button></div><h1 class="topbar-title">${esc(preview.title)}</h1><button class="btn" id="saveBtn" type="button">保存</button></header>
    <section class="stage-wrap function-stage-wrap" id="captureRoot"><div class="status" id="statusBox">${esc(preview.title)}を表示します。</div><svg class="stage function-complex-stage" id="stage" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet" aria-label="${esc(preview.title)}の描画画面"></svg></section>
    <div class="complex-readout" id="readout"></div>
    <footer class="bottom-bar four-fields" id="bottomBar"></footer>
  </div>
  <div class="sheet-backdrop" id="sheetBackdrop"></div>
  <section class="sheet" id="editSheet" aria-hidden="true"><div class="sheet-header"><h2 class="sheet-title" id="sheetTitle">設定</h2><button class="sheet-close" id="sheetClose" type="button" aria-label="閉じる">×</button></div><div class="sheet-body" id="sheetBody"></div></section>
  <section class="sheet" id="saveSheet" aria-hidden="true"><div class="sheet-header"><h2 class="sheet-title">保存</h2><button class="sheet-close" id="saveSheetClose" type="button" aria-label="閉じる">×</button></div><div class="sheet-body"><div class="save-grid"><button class="btn" id="savePngBtn" type="button">PNG</button><button class="btn" id="saveTransparentBtn" type="button">透過PNG</button><button class="btn" id="savePdfBtn" type="button">PDF</button></div></div></section>
  <script>window.InstantGeometryComplexConfig = ${config};</script>
  <script src="/assets/function-complex-core.js"></script>
  <script src="/assets/function-complex-page.js"></script>
  <script>
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        document.documentElement.dataset.previewReady = 'true';
      });
    });
  </script>
</body>
</html>`;
}

function conicFigureModelHtml(preview) {
  const controlValues = {
    radiusLen: '5',
    radius1Len: '6',
    radius2Len: '3.5',
    angleLen: '60',
    ...(preview.controlValues || {})
  };
  const conicConfig = JSON.stringify(preview.conicConfig || {});
  const afterRenderScript = preview.afterRenderScript || '';

  return `<!DOCTYPE html>
<html lang="ja" data-preview-source="figure-model-conic-mobile">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>${esc(preview.title)} preview</title>
  <link rel="stylesheet" href="/assets/conic-mobile-page.css?v=figure-model-preview-1" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" />
  <style>
    html,
    body{
      margin:0;
      min-height:100%;
      background:${COLORS.surface};
    }
    body{
      display:grid;
      place-items:center;
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif;
    }
    .app{
      width:1000px;
      height:1000px;
      max-width:none;
      min-height:0;
      padding:0;
      gap:0;
      background:${COLORS.surface};
    }
    .topbar,
    .bottom-bar,
    .status,
    .sheet,
    .sheet-backdrop,
    .move-toolbar{
      display:none !important;
    }
    .stage-wrap{
      width:1000px;
      height:1000px;
      min-height:0;
      padding:0;
      border:0;
      border-radius:0;
      box-shadow:none;
      background:${COLORS.surface};
      overflow:hidden;
    }
    .stage{
      display:block;
      width:1000px;
      height:1000px;
      background:${COLORS.surface};
      touch-action:none;
    }
    .shape-fill,
    .sector-fill{
      fill:rgba(42,91,215,.13);
    }
    .axis-line,
    .arc-line{
      stroke:${COLORS.blue};
      stroke-width:4.8;
    }
    .complement-arc{
      stroke:${COLORS.blue};
      stroke-width:4.2;
      stroke-dasharray:18 14;
      opacity:.52;
    }
    .angle-arc,
    .label-arc{
      stroke-width:3.2;
    }
    .diameter-line{
      stroke-width:4.2;
      stroke-dasharray:18 14;
    }
    .center-point,
    .curve-point{
      opacity:0;
    }
    .point-marker-visible{
      opacity:1;
    }
    .learn-diameter-line{
      stroke:${COLORS.blue};
      stroke-width:4.8;
      stroke-linecap:round;
      opacity:.9;
    }
    .learn-circumference-guide{
      fill:none;
      stroke:${COLORS.blue};
      stroke-width:6;
      stroke-dasharray:18 14;
      stroke-linecap:round;
    }
  </style>
</head>
<body>
  <div class="app">
    <header class="topbar">
      <button class="btn" id="backBtn" type="button">戻る</button>
      <h1 class="topbar-title">${esc(preview.title)}</h1>
      <button class="btn" id="saveBtn" type="button">保存</button>
    </header>
    <section class="stage-wrap" id="captureRoot">
      <div class="status" id="statusBox">描画しています。</div>
      <svg class="stage" id="stage" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet" aria-label="${esc(preview.title)}の教材用描画"></svg>
    </section>
    <footer class="bottom-bar" id="bottomBar">
      <input id="radiusLen" value="${esc(controlValues.radiusLen)}" />
      <input id="radius1Len" value="${esc(controlValues.radius1Len)}" />
      <input id="radius2Len" value="${esc(controlValues.radius2Len)}" />
      <input id="angleLen" value="${esc(controlValues.angleLen)}" />
    </footer>
  </div>
  <div class="sheet-backdrop" id="sheetBackdrop"></div>
  <section class="sheet" id="editSheet" aria-hidden="true">
    <div class="sheet-header"><h2 class="sheet-title" id="sheetTitle">設定</h2><button class="sheet-close" id="sheetClose" type="button">×</button></div>
    <div class="sheet-body" id="sheetBody"></div>
  </section>
  <section class="sheet" id="saveSheet" aria-hidden="true">
    <div class="sheet-header"><h2 class="sheet-title">保存</h2><button class="sheet-close" id="saveSheetClose" type="button">×</button></div>
    <div class="sheet-body"><button class="btn" id="savePngBtn" type="button">PNG</button><button class="btn" id="saveTransparentBtn" type="button">透過PNG</button><button class="btn" id="savePdfBtn" type="button">PDF</button></div>
  </section>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
  <script src="/assets/mobile-angle-ornaments.js?v=angle-modal-1"></script>
  <script src="/assets/function-svg-labels.js?v=triangle-katex-1"></script>
  <script src="/assets/draw-shared-labels.js?v=shared-katex-4"></script>
  <script src="/assets/draw-label-taxonomy.js?v=taxonomy-1"></script>
  <script src="/assets/draw-shared-label-engine.js?v=controller-1"></script>
  <script src="/assets/conic-mobile-page.js?v=controller-8"></script>
  <script>
    window.InstantGeometryConicMobile.createPage(${conicConfig});
    requestAnimationFrame(() => {
      ${afterRenderScript}
      document.getElementById('stage').setAttribute('viewBox', '0 0 1000 1000');
      requestAnimationFrame(() => {
        document.documentElement.dataset.previewReady = 'true';
      });
    });
  </script>
</body>
</html>`;
}

function solidFigureModelHtml(preview) {
  const figureModel = FigureModels.F(preview.figureModelKey || 'solid.cylinder', preview.figureModelInput || {});

  return `<!DOCTYPE html>
<html lang="ja" data-preview-source="figure-model-solid-direct">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>${esc(preview.title)} preview</title>
  <style>
    html,
    body{
      margin:0;
      min-height:100%;
      background:${COLORS.surface};
    }
    body{
      display:grid;
      place-items:center;
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif;
    }
    .app{
      width:1000px;
      height:1000px;
      max-width:none;
      min-height:0;
      padding:0;
      gap:0;
      background:${COLORS.surface};
    }
    .topbar,
    .status{
      display:none !important;
    }
    .stage-wrap{
      width:1000px;
      height:1000px;
      min-height:0;
      padding:0;
      border:0;
      border-radius:0;
      box-shadow:none;
      background:${COLORS.surface};
      overflow:hidden;
    }
    .stage{
      display:block;
      width:1000px;
      height:1000px;
      background:${COLORS.surface};
    }
  </style>
</head>
<body>
  <div class="app">
    <header class="topbar">
      <button class="btn" id="backBtn" type="button">戻る</button>
      <h1 class="topbar-title">${esc(preview.title)}</h1>
      <button class="btn" id="saveBtn" type="button">保存</button>
    </header>
    <section class="stage-wrap" id="captureRoot">
      <div class="status" id="statusBox">描画しています。</div>
      <svg class="stage" id="stage" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet" aria-label="${esc(preview.title)}の教材用描画"></svg>
    </section>
  </div>
  <script type="application/json" id="geometryFigureModel">${JSON.stringify(figureModel)}</script>
  <script src="/assets/figure-model-standard.js?v=solid-direct-renderer-1"></script>
  <script src="/assets/figure-model-solid-renderer.js?v=solid-direct-renderer-1"></script>
  <script>
    var figureModel = window.InstantGeometryFigureModels.F(${JSON.stringify(preview.figureModelKey || 'solid.cylinder')}, ${JSON.stringify(preview.figureModelInput || {})});
    window.InstantGeometrySolidFigureRenderer.render(document.getElementById('stage'), figureModel, ${JSON.stringify(preview.renderOptions || {})});
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.documentElement.dataset.previewReady = 'true';
      });
    });
  </script>
</body>
</html>`;
}

function triangleFigureModelHtml(preview) {
  const figureModel = FigureModels.F(preview.figureModelKey || 'triangle', preview.figureModelInput || {});
  const controlValues = TriangleFigureAdapter.toTriangleMobileControlValues(figureModel);

  return `<!DOCTYPE html>
<html lang="ja" data-preview-source="figure-model-triangle-mobile">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>${esc(preview.title)} preview</title>
  <link rel="stylesheet" href="/assets/triangle-mobile-page.css?v=figure-model-preview-1" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" />
  <style>
    html,
    body{
      width:100%;
      height:100%;
      margin:0;
      overflow:hidden;
      background:#fbfcff;
    }
    body{
      display:grid;
      place-items:center;
    }
    .app{
      width:1000px;
      height:1000px;
      padding:0;
      gap:0;
    }
    .topbar,
    .bottom-bar,
    .sheet,
    .sheet-backdrop{
      display:none !important;
    }
    .stage-wrap{
      width:1000px;
      height:1000px;
      flex:none;
      border:0;
      border-radius:0;
      box-shadow:none;
      background:#fbfcff;
    }
    .stage{
      width:1000px;
      height:1000px;
      background:#fbfcff;
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
</head>
<body>
  <div class="app">
    <header class="topbar">
      <button class="btn" id="backBtn" type="button">戻る</button>
      <h1 class="topbar-title">三角形</h1>
      <button class="btn" id="saveBtn" type="button">保存</button>
    </header>

    <section class="stage-wrap" id="captureRoot">
      <div class="status" id="statusBox">FigureModelをもとに三角形を描画しています。</div>
      <svg class="stage" id="stage" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet" aria-label="三角形の描画画面"></svg>
    </section>

    <footer class="bottom-bar">
      <div class="field">
        <div class="field-label">辺BC</div>
        <input class="field-input" id="sideA" type="text" inputmode="text" value="${esc(controlValues.a)}" />
      </div>
      <div class="field">
        <div class="field-label">辺CA</div>
        <input class="field-input" id="sideB" type="text" inputmode="text" value="${esc(controlValues.b)}" />
      </div>
      <div class="field">
        <div class="field-label">辺AB</div>
        <input class="field-input" id="sideC" type="text" inputmode="text" value="${esc(controlValues.c)}" />
      </div>
    </footer>
  </div>

  <div class="sheet-backdrop" id="sheetBackdrop"></div>
  <section class="sheet" id="editSheet" aria-hidden="true">
    <div class="sheet-header">
      <h2 class="sheet-title" id="sheetTitle">設定</h2>
      <button class="sheet-close" id="sheetClose" type="button" aria-label="閉じる">×</button>
    </div>
    <div class="sheet-body" id="sheetBody"></div>
  </section>

  <section class="sheet" id="saveSheet" aria-hidden="true">
    <div class="sheet-header">
      <h2 class="sheet-title">保存</h2>
      <button class="sheet-close" id="saveSheetClose" type="button" aria-label="閉じる">×</button>
    </div>
    <div class="sheet-body">
      <div class="save-grid">
        <button class="btn" id="savePngBtn" type="button">PNG</button>
        <button class="btn" id="saveTransparentBtn" type="button">透過PNG</button>
        <button class="btn" id="savePdfBtn" type="button">PDF</button>
      </div>
    </div>
  </section>

  <script src="/assets/mobile-angle-ornaments.js?v=label-wording-3"></script>
  <script src="/assets/function-svg-labels.js?v=triangle-katex-1"></script>
  <script src="/assets/draw-shared-labels.js?v=shared-katex-3"></script>
  <script src="/assets/draw-label-taxonomy.js?v=taxonomy-1"></script>
  <script src="/assets/draw-shared-label-engine.js?v=controller-1"></script>
  <script src="/assets/figure-model-standard.js?v=standard-1"></script>
  <script src="/assets/figure-model-triangle-adapter.js?v=adapter-2"></script>
  <script src="/assets/triangle-mobile-page.js?v=controller-26"></script>
  <script>
    var figureModel = window.InstantGeometryFigureModels.F(${JSON.stringify(preview.figureModelKey || 'triangle')}, ${JSON.stringify(preview.figureModelInput || {})});
    window.__InstantGeometryPreviewFigureModel = figureModel;
    window.__InstantGeometryPreviewRenderPlan = window.InstantGeometryTriangleFigureAdapter.renderPlanForTriangleModel(figureModel);
    var config = window.InstantGeometryTriangleFigureAdapter.createTriangleMobilePageConfig(figureModel, null, {
      readyMessage: "FigureModelをもとに三角形を描画しています。",
      fileBase: ${JSON.stringify(preview.fileBase || preview.id)}
    });
    ${preview.configureScript ? preview.configureScript(preview) : ''}
    window.InstantGeometryTriangleMobile.createPage(config);
    requestAnimationFrame(function () {
      document.documentElement.dataset.previewReady = "true";
      window.dispatchEvent(new CustomEvent("instantgeometry-preview-ready", {
        detail: window.__InstantGeometryPreviewRenderPlan
      }));
    });
  </script>
</body>
</html>`;
}

function quadrilateralFigureModelHtml(preview) {
  const figureModel = FigureModels.F(preview.figureModelKey || 'quadrilateral', preview.figureModelInput || {});
  QuadrilateralFigureAdapter.createQuadrilateralMobilePageConfig(figureModel, null, {
    fileBase: preview.fileBase || preview.id
  });

  return `<!DOCTYPE html>
<html lang="ja" data-preview-source="figure-model-quadrilateral-mobile">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>${esc(preview.title)} preview</title>
  <link rel="stylesheet" href="/assets/quadrilateral-mobile-page.css?v=figure-model-preview-2" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" />
  <style>
    html,
    body{
      width:100%;
      height:100%;
      margin:0;
      overflow:hidden;
      background:#fbfcff;
    }
    body{
      display:grid;
      place-items:center;
    }
    .app{
      width:1000px;
      height:1000px;
      padding:0;
      gap:0;
    }
    .topbar,
    .bottom-bar,
    .sheet,
    .sheet-backdrop,
    .move-toolbar{
      display:none !important;
    }
    .stage-wrap{
      width:1000px;
      height:1000px;
      flex:none;
      border:0;
      border-radius:0;
      box-shadow:none;
      background:#fbfcff;
    }
    .stage{
      width:1000px;
      height:1000px;
      background:#fbfcff;
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
</head>
<body>
  <div class="app">
    <header class="topbar">
      <button class="btn" id="backBtn" type="button">戻る</button>
      <h1 class="topbar-title">四角形</h1>
      <button class="btn" id="saveBtn" type="button">保存</button>
    </header>

    <section class="stage-wrap" id="captureRoot">
      <div class="status" id="statusBox">FigureModelをもとに四角形を描画しています。</div>
      <svg class="stage" id="stage" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet" aria-label="四角形の描画画面"></svg>
    </section>

    <footer class="bottom-bar"></footer>
  </div>

  <div class="sheet-backdrop" id="sheetBackdrop"></div>
  <section class="sheet" id="editSheet" aria-hidden="true">
    <div class="sheet-header">
      <h2 class="sheet-title" id="sheetTitle">設定</h2>
      <button class="sheet-close" id="sheetClose" type="button" aria-label="閉じる">×</button>
    </div>
    <div class="sheet-body" id="sheetBody"></div>
  </section>

  <section class="sheet" id="saveSheet" aria-hidden="true">
    <div class="sheet-header">
      <h2 class="sheet-title">保存</h2>
      <button class="sheet-close" id="saveSheetClose" type="button" aria-label="閉じる">×</button>
    </div>
    <div class="sheet-body">
      <div class="save-grid">
        <button class="btn" id="savePngBtn" type="button">PNG</button>
        <button class="btn" id="saveTransparentBtn" type="button">透過PNG</button>
        <button class="btn" id="savePdfBtn" type="button">PDF</button>
      </div>
    </div>
  </section>

  <script src="/assets/mobile-angle-ornaments.js?v=label-wording-3"></script>
  <script src="/assets/function-svg-labels.js?v=quadrilateral-katex-1"></script>
  <script src="/assets/draw-shared-labels.js?v=shared-katex-2"></script>
  <script src="/assets/draw-label-taxonomy.js?v=taxonomy-1"></script>
  <script src="/assets/draw-shared-label-engine.js?v=controller-1"></script>
  <script src="/assets/figure-model-standard.js?v=standard-3"></script>
  <script src="/assets/figure-model-quadrilateral-adapter.js?v=adapter-2"></script>
  <script src="/assets/quadrilateral-mobile-page.js?v=controller-2"></script>
  <script>
    var figureModel = window.InstantGeometryFigureModels.F(${JSON.stringify(preview.figureModelKey || 'quadrilateral')}, ${JSON.stringify(preview.figureModelInput || {})});
    window.__InstantGeometryPreviewFigureModel = figureModel;
    var config = window.InstantGeometryQuadrilateralFigureAdapter.createQuadrilateralMobilePageConfig(figureModel, null, {
      readyMessage: "FigureModelをもとに四角形を描画しています。",
      fileBase: ${JSON.stringify(preview.fileBase || preview.id)}
    });
    config.initialState.labelOffsets = {
      point: {
        A: { x: 44, y: 44 },
        B: { x: 44, y: -44 },
        C: { x: -44, y: -44 },
        D: { x: -44, y: 44 }
      }
    };
    ${preview.configureScript ? preview.configureScript(preview) : ''}
    window.InstantGeometryQuadrilateralMobile.createPage(config);
    requestAnimationFrame(function () {
      document.documentElement.dataset.previewReady = "true";
      window.dispatchEvent(new CustomEvent("instantgeometry-preview-ready", {
        detail: { model: figureModel.model, variant: figureModel.variant }
      }));
    });
  </script>
</body>
</html>`;
}

function cyclicQuadrilateralHtml(preview) {
  return `<!DOCTYPE html>
<html lang="ja" data-preview-source="draw-quadrilateral-cyclic">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>${esc(preview.title)} preview</title>
  <link rel="stylesheet" href="/assets/quadrilateral-mobile-page.css?v=figure-model-preview-2" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" />
  <style>
    html,body{width:100%;height:100%;margin:0;overflow:hidden;background:${COLORS.surface};}
    body{display:grid;place-items:center;}
    .app{width:1000px;height:1000px;padding:0;gap:0;}
    .topbar,.bottom-bar,.status,.sheet,.sheet-backdrop,.move-toolbar{display:none!important;}
    .stage-wrap{width:1000px;height:1000px;flex:none;border:0;border-radius:0;box-shadow:none;background:${COLORS.surface};}
    .stage{width:1000px;height:1000px;background:${COLORS.surface};}
    .point-dot{opacity:0;}
  </style>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
</head>
<body>
  <div class="app">
    <header class="topbar"><button class="btn" id="backBtn" type="button">戻る</button><h1 class="topbar-title">${esc(preview.title)}</h1><button class="btn" id="saveBtn" type="button">保存</button></header>
    <section class="stage-wrap" id="captureRoot"><div class="status" id="statusBox">描画しています。</div><svg class="stage" id="stage" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet" aria-label="${esc(preview.title)}の教材用描画"></svg></section>
    <footer class="bottom-bar"><input id="angleAInput" value="78" /><input id="angleBInput" value="104" /></footer>
  </div>
  <div class="sheet-backdrop" id="sheetBackdrop"></div>
  <section class="sheet" id="editSheet" aria-hidden="true"><div class="sheet-header"><h2 class="sheet-title" id="sheetTitle">設定</h2><button class="sheet-close" id="sheetClose" type="button">×</button></div><div class="sheet-body" id="sheetBody"></div></section>
  <section class="sheet" id="saveSheet" aria-hidden="true"><div class="sheet-header"><h2 class="sheet-title">保存</h2><button class="sheet-close" id="saveSheetClose" type="button">×</button></div><div class="sheet-body"><button class="btn" id="savePngBtn" type="button">PNG</button><button class="btn" id="saveTransparentBtn" type="button">透過PNG</button><button class="btn" id="savePdfBtn" type="button">PDF</button></div></section>
  <script src="/assets/mobile-angle-ornaments.js?v=angle-modal-1"></script>
  <script src="/assets/function-svg-labels.js?v=quadrilateral-katex-1"></script>
  <script src="/assets/draw-shared-labels.js?v=shared-katex-2"></script>
  <script src="/assets/draw-label-taxonomy.js?v=taxonomy-1"></script>
  <script src="/assets/draw-shared-label-engine.js?v=controller-1"></script>
  <script src="/assets/quadrilateral-mobile-page.js?v=controller-2"></script>
  <script>
    function pointOnCircle(degrees) {
      var radians = degrees * Math.PI / 180;
      return { x: Math.cos(radians), y: Math.sin(radians) };
    }
    function buildCyclicQuadrilateral(angleA, angleB) {
      var lower = Math.max(0.0001, 2 * angleA + 2 * angleB - 360 + 0.0001);
      var upper = Math.min(2 * angleA, 2 * angleB) - 0.0001;
      var arcCD = (lower + upper) / 2;
      var arcBC = 2 * angleA - arcCD;
      var arcDA = 2 * angleB - arcCD;
      var arcAB = 360 - arcBC - arcCD - arcDA;
      var angleOfA = -90 - arcAB / 2;
      var angleOfB = angleOfA + arcAB;
      var angleOfC = angleOfB + arcBC;
      var angleOfD = angleOfC + arcCD;
      return { A: pointOnCircle(angleOfA), B: pointOnCircle(angleOfB), C: pointOnCircle(angleOfC), D: pointOnCircle(angleOfD) };
    }
    window.InstantGeometryQuadrilateralMobile.createPage({
      readyMessage: "入力をもとに四角形と外接円を描画しています。",
      fileBase: ${JSON.stringify(preview.fileBase || preview.id)},
      angleArcRadius: 0.22,
      angleHitArcRadius: 0.52,
      controlInputIds: { A: "angleAInput", B: "angleBInput" },
      initialState: {
        pointInputs: { A: "", B: "", C: "", D: "" },
        sides: { AB: 0, BC: 0, CD: 0, DA: 0 },
        sideInputs: { AB: "", BC: "", CD: "", DA: "" },
        sideKinds: { AB: "plain", BC: "plain", CD: "plain", DA: "plain" },
        sideArcVisible: { AB: false, BC: false, CD: false, DA: false },
        angleInputs: { A: "", B: "", C: "", D: "" },
        angleKinds: { A: "hidden", B: "hidden", C: "hidden", D: "hidden" },
        areaValue: ""
      },
      readControls: function (inputs, parsePositiveNumber) {
        return { A: parsePositiveNumber(inputs.A.value, "角A"), B: parsePositiveNumber(inputs.B.value, "角B") };
      },
      applyControlsToState: function () {},
      computeGeometry: function (state, parsed, helpers) {
        var points = helpers.scalePointsToMinSide(buildCyclicQuadrilateral(parsed.A, parsed.B), 5);
        var geometry = helpers.finalizeGeometry(points);
        geometry.circumcircle = { center: { x: 0, y: 0 }, radius: Math.hypot(points.A.x, points.A.y) };
        return geometry;
      },
      drawAuxiliary: function (ctx) {
        if (!ctx.geometry.circumcircle) return;
        var center = ctx.fitPoint(ctx.geometry.circumcircle.center);
        var circle = ctx.createSvg("circle", {
          cx: center.x,
          cy: center.y,
          r: ctx.geometry.circumcircle.radius * ctx.view.scale,
          fill: "rgba(42,91,215,.08)",
          stroke: "#2a5bd7",
          "stroke-width": "4"
        });
        ctx.stage.insertBefore(circle, ctx.stage.firstChild);
      },
      sideNumericMode: function () { return "readonly"; },
      angleNumericMode: function () { return "readonly"; },
      updateSideControl: function () {},
      updateAngleControl: function () {}
    });
    requestAnimationFrame(function () {
      document.documentElement.dataset.previewReady = "true";
    });
  </script>
</body>
</html>`;
}

function lineAngleRelationPreviewHtml(preview) {
  const relationType = preview.relationType || 'corresponding';
  const inputId = relationType === 'vertical' ? 'aodInput' : 'qmnInput';
  const fieldLabel = relationType === 'vertical' ? '∠AOD' : '∠QMN';
  const readyMessage = relationType === 'vertical'
    ? '2本の線分 AB と CD が交わる対頂角を描画しました。'
    : relationType === 'alternate'
      ? '平行線 PQ, RS を線分 AB が横切る錯角を描画しました。'
      : '平行線 PQ, RS を線分 AB が横切る同位角を描画しました。';

  return `<!DOCTYPE html>
<html lang="ja" data-preview-source="draw-line-angle-relations">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>${esc(preview.title)} preview</title>
  <link rel="stylesheet" href="/assets/quadrilateral-mobile-page.css?v=line-angle-preview-1" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" />
  <style>
    html,body{margin:0;min-height:100%;background:${COLORS.surface};}
    body{display:grid;place-items:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif;}
    .app,.stage-wrap{width:1000px;height:1000px;max-width:none;min-height:0;padding:0;margin:0;display:block;background:${COLORS.surface};border:0;box-shadow:none;}
    .topbar,.bottom-bar,.status,.sheet,.sheet-backdrop,.move-toolbar{display:none!important;}
    #stage{display:block;width:1000px;height:1000px;background:${COLORS.surface};}
    #stage circle[fill="rgb(31,36,48)"]{display:none!important;}
    #stage .shape-label{paint-order:normal;stroke:none;}
  </style>
</head>
<body data-angle-relation="${esc(relationType)}">
  <div class="app">
    <header class="topbar"><button class="btn" id="backBtn" type="button">戻る</button><h1 class="topbar-title">${esc(preview.title)}</h1><button class="btn" id="saveBtn" type="button">保存</button></header>
    <section class="stage-wrap" id="captureRoot"><div class="status" id="statusBox">${esc(readyMessage)}</div><svg class="stage" id="stage" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet" aria-label="${esc(preview.title)}の描画画面"></svg></section>
    <footer class="bottom-bar one-field"><div class="field"><div class="field-label">${esc(fieldLabel)}</div><input class="field-input" id="${esc(inputId)}" type="text" inputmode="decimal" value="${esc(preview.controlValue || '70')}" /></div></footer>
  </div>
  <div class="sheet-backdrop" id="sheetBackdrop"></div>
  <section class="sheet" id="editSheet" aria-hidden="true"><div class="sheet-header"><h2 class="sheet-title" id="sheetTitle">設定</h2><button class="sheet-close" id="sheetClose" type="button" aria-label="閉じる">×</button></div><div class="sheet-body" id="sheetBody"></div></section>
  <section class="sheet" id="saveSheet" aria-hidden="true"><div class="sheet-header"><h2 class="sheet-title">保存</h2><button class="sheet-close" id="saveSheetClose" type="button" aria-label="閉じる">×</button></div><div class="sheet-body"><div class="save-grid"><button class="btn" id="savePngBtn" type="button">PNG</button><button class="btn" id="saveTransparentBtn" type="button">透過PNG</button><button class="btn" id="savePdfBtn" type="button">PDF</button></div></div></section>
  <script src="/assets/mobile-angle-ornaments.js?v=angle-modal-1"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
  <script src="/assets/draw-shared-labels.js?v=shared-katex-2"></script>
  <script src="/assets/draw-label-taxonomy.js?v=taxonomy-1"></script>
  <script src="/assets/draw-shared-label-engine.js?v=controller-contract-2"></script>
  <script src="/assets/draw-line-angle-relations-mobile-page.js?v=label-modal-contract-1"></script>
  <script>
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        document.documentElement.dataset.previewReady = 'true';
      });
    });
  </script>
</body>
</html>`;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function trianglePairMemberModel(preview, member) {
  const pairModel = FigureModels.F(preview.figureModelKey, preview.figureModelInput || {});
  const figure = pairModel.objects.figures[member];
  const isSecond = member === 'second';
  return {
    schemaVersion: pairModel.schemaVersion,
    model: 'figure.triangle',
    sourceKey: `${pairModel.sourceKey}:${member}`,
    variant: 'general',
    purpose: pairModel.purpose,
    construction: pairModel.construction,
    condition: pairModel.condition,
    preset: pairModel.preset,
    values: cloneJson(pairModel.values),
    display: cloneJson(pairModel.display),
    layout: { mode: 'single' },
    renderer: {
      engine: 'instantGeometry',
      katex: true,
      target: 'triangle-mobile'
    },
    objects: {
      points: {
        A: cloneJson(figure.points[isSecond ? 'D' : 'A']),
        B: cloneJson(figure.points[isSecond ? 'E' : 'B']),
        C: cloneJson(figure.points[isSecond ? 'F' : 'C'])
      },
      segments: {
        AB: cloneJson(figure.segments[isSecond ? 'DE' : 'AB']),
        AC: cloneJson(figure.segments[isSecond ? 'DF' : 'AC']),
        BC: cloneJson(figure.segments[isSecond ? 'EF' : 'BC'])
      },
      angles: {
        A: cloneJson(figure.angles[isSecond ? 'D' : 'A']),
        B: cloneJson(figure.angles[isSecond ? 'E' : 'B']),
        C: cloneJson(figure.angles[isSecond ? 'F' : 'C'])
      },
      areas: {
        ABC: cloneJson(figure.areas[isSecond ? 'DEF' : 'ABC'])
      }
    }
  };
}

function triangleToolFrameHtml(preview, member) {
  const model = trianglePairMemberModel(preview, member);
  const controlValues = TriangleFigureAdapter.toTriangleMobileControlValues(model);
  return `<!DOCTYPE html>
<html lang="ja" data-preview-source="figure-model-triangle-mobile-frame">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(preview.title)} ${esc(member)} frame</title>
  <link rel="stylesheet" href="/assets/triangle-mobile-page.css?v=figure-model-preview-1" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" />
  <style>
    html,
    body{
      width:100%;
      height:100%;
      margin:0;
      overflow:hidden;
      background:transparent;
    }
    .app{
      width:100vw;
      height:100vh;
      padding:0;
      gap:0;
      background:transparent;
    }
    .topbar,
    .bottom-bar,
    .sheet,
    .sheet-backdrop{
      display:none !important;
    }
    .stage-wrap{
      width:100vw;
      height:100vh;
      flex:none;
      border:0;
      border-radius:0;
      box-shadow:none;
      background:transparent;
    }
    .stage{
      width:100vw;
      height:100vh;
      background:transparent;
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
</head>
<body>
  <div class="app">
    <header class="topbar">
      <button class="btn" id="backBtn" type="button">戻る</button>
      <h1 class="topbar-title">三角形</h1>
      <button class="btn" id="saveBtn" type="button">保存</button>
    </header>
    <section class="stage-wrap" id="captureRoot">
      <div class="status" id="statusBox">FigureModelをもとに三角形を描画しています。</div>
      <svg class="stage" id="stage" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet" aria-label="三角形の描画画面"></svg>
    </section>
    <footer class="bottom-bar">
      <div class="field">
        <div class="field-label">辺BC</div>
        <input class="field-input" id="sideA" type="text" inputmode="text" value="${esc(controlValues.a)}" />
      </div>
      <div class="field">
        <div class="field-label">辺CA</div>
        <input class="field-input" id="sideB" type="text" inputmode="text" value="${esc(controlValues.b)}" />
      </div>
      <div class="field">
        <div class="field-label">辺AB</div>
        <input class="field-input" id="sideC" type="text" inputmode="text" value="${esc(controlValues.c)}" />
      </div>
    </footer>
  </div>
  <div class="sheet-backdrop" id="sheetBackdrop"></div>
  <section class="sheet" id="editSheet" aria-hidden="true">
    <div class="sheet-header">
      <h2 class="sheet-title" id="sheetTitle">設定</h2>
      <button class="sheet-close" id="sheetClose" type="button" aria-label="閉じる">×</button>
    </div>
    <div class="sheet-body" id="sheetBody"></div>
  </section>
  <section class="sheet" id="saveSheet" aria-hidden="true">
    <div class="sheet-header">
      <h2 class="sheet-title">保存</h2>
      <button class="sheet-close" id="saveSheetClose" type="button" aria-label="閉じる">×</button>
    </div>
    <div class="sheet-body">
      <div class="save-grid">
        <button class="btn" id="savePngBtn" type="button">PNG</button>
        <button class="btn" id="saveTransparentBtn" type="button">透過PNG</button>
        <button class="btn" id="savePdfBtn" type="button">PDF</button>
      </div>
    </div>
  </section>
  <script src="/assets/mobile-angle-ornaments.js?v=label-wording-3"></script>
  <script src="/assets/function-svg-labels.js?v=triangle-katex-1"></script>
  <script src="/assets/draw-shared-labels.js?v=shared-katex-2"></script>
  <script src="/assets/draw-label-taxonomy.js?v=taxonomy-1"></script>
  <script src="/assets/draw-shared-label-engine.js?v=controller-1"></script>
  <script src="/assets/figure-model-standard.js?v=standard-1"></script>
  <script src="/assets/figure-model-triangle-adapter.js?v=adapter-1"></script>
  <script src="/assets/triangle-mobile-page.js?v=controller-25"></script>
  <script>
    var figureModel = ${JSON.stringify(model)};
    var config = window.InstantGeometryTriangleFigureAdapter.createTriangleMobilePageConfig(figureModel, null, {
      readyMessage: "FigureModelをもとに三角形を描画しています。",
      fileBase: ${JSON.stringify(`${preview.fileBase || preview.id}-${member}`)}
    });
    config.initialState.labelOffsets = {
      point: {
        A: { x: 0, y: -34 },
        B: { x: -34, y: 24 },
        C: { x: 34, y: 24 }
      }
    };
    window.InstantGeometryTriangleMobile.createPage(config);
    requestAnimationFrame(function () {
      document.documentElement.dataset.previewReady = "true";
      window.parent.postMessage({ type: "instantgeometry-preview-frame-ready", member: ${JSON.stringify(member)} }, "*");
    });
  </script>
</body>
</html>`;
}

function triangleToolPairHtml(preview) {
  return `<!DOCTYPE html>
<html lang="ja" data-preview-source="figure-model-triangle-mobile-pair">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(preview.title)} preview</title>
  <style>
    html,
    body{
      width:100%;
      height:100%;
      margin:0;
      overflow:hidden;
      background:${COLORS.surface};
    }
    body{
      display:grid;
      place-items:center;
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif;
    }
    #stage{
      position:relative;
      width:1000px;
      height:1000px;
      background:${COLORS.surface};
      overflow:hidden;
    }
    .tool-frame{
      position:absolute;
      left:132.5px;
      width:735px;
      height:735px;
      border:0;
      background:transparent;
      overflow:hidden;
    }
    .tool-frame.first{
      top:-118px;
    }
    .tool-frame.second{
      top:383px;
    }
  </style>
</head>
<body>
  <div id="stage" aria-label="${esc(preview.title)}の教材用描画">
    <iframe class="tool-frame first" title="合同条件の左の三角形" src="/__learn-preview-frame__/${encodeURIComponent(preview.id)}/first/"></iframe>
    <iframe class="tool-frame second" title="合同条件の右の三角形" src="/__learn-preview-frame__/${encodeURIComponent(preview.id)}/second/"></iframe>
  </div>
  <script>
    var ready = {};
    window.addEventListener("message", function (event) {
      if (!event.data || event.data.type !== "instantgeometry-preview-frame-ready") return;
      ready[event.data.member] = true;
      if (ready.first && ready.second) {
        requestAnimationFrame(function () {
          document.documentElement.dataset.previewReady = "true";
        });
      }
    });
  </script>
</body>
</html>`;
}

function drawTriangleDefinition() {
  const a = { x: 220, y: 720 };
  const b = { x: 800, y: 720 };
  const c = { x: 540, y: 250 };
  return [
    polygon([a, b, c], { fill: COLORS.blueSoft, stroke: 'none', 'data-kind': 'area', 'data-id': 'triangle:ABC' }),
    segment(a, b, 'AB'),
    segment(b, c, 'BC'),
    segment(c, a, 'CA'),
    pointLabel(a, 'A', -42, 44),
    pointLabel(b, 'B', 44, 44),
    pointLabel(c, 'C', 0, -52)
  ].join('');
}

function drawCircleDefinition() {
  const o = { x: 500, y: 500 };
  const a = { x: 790, y: 500 };
  return [
    circle(o.x, o.y, 290, {
      fill: 'rgba(42, 91, 215, 0.04)',
      stroke: COLORS.blue,
      'stroke-width': 7,
      'data-kind': 'circle',
      'data-id': 'circle:O'
    }),
    line(o.x, o.y, a.x, a.y, {
      class: 'ig-helper',
      stroke: COLORS.green,
      'stroke-width': 6,
      'data-kind': 'radius',
      'data-id': 'OA'
    }),
    text(o.x - 34, o.y + 42, 'O', { class: 'ig-label', 'data-kind': 'point-label', 'data-id': 'O' }),
    text(a.x + 44, a.y + 10, 'A', { class: 'ig-label', 'data-kind': 'point-label', 'data-id': 'A' }),
    text(645, 462, '半径', { class: 'ig-small-label', fill: COLORS.green, 'data-kind': 'radius-label', 'data-id': 'OA' })
  ].join('');
}

function drawCircleRadiusDiameter() {
  const o = { x: 500, y: 500 };
  const r = 292;
  const a = { x: o.x - r, y: o.y };
  const b = { x: o.x + r, y: o.y };
  const c = polarPoint(o.x, o.y, r, -48);
  return [
    circle(o.x, o.y, r, {
      fill: 'rgba(42, 91, 215, 0.04)',
      stroke: COLORS.blue,
      'stroke-width': 7,
      'data-kind': 'circle',
      'data-id': 'circle:O'
    }),
    line(a.x, a.y, b.x, b.y, {
      class: 'ig-helper',
      stroke: COLORS.muted,
      'stroke-width': 5,
      'stroke-dasharray': '10 8',
      'data-kind': 'diameter',
      'data-id': 'AB'
    }),
    line(o.x, o.y, c.x, c.y, {
      class: 'ig-helper',
      stroke: COLORS.green,
      'stroke-width': 6,
      'data-kind': 'radius',
      'data-id': 'OC'
    }),
    pathTag(arcPath(o.x, o.y, 350, 178, 360), {
      class: 'ig-helper',
      stroke: COLORS.muted,
      'stroke-width': 3,
      'stroke-dasharray': '7 7',
      'data-kind': 'guide',
      'data-id': 'diameter-guide'
    }),
    pathTag(arcPath(o.x, o.y, 210, -42, 3), {
      class: 'ig-helper',
      stroke: COLORS.green,
      'stroke-width': 3,
      'stroke-dasharray': '7 7',
      'data-kind': 'guide',
      'data-id': 'radius-guide'
    }),
    text(o.x - 34, o.y + 42, 'O', { class: 'ig-label', 'data-kind': 'point-label', 'data-id': 'O' }),
    text(500, 858, '直径', { class: 'ig-label', fill: COLORS.muted, 'data-kind': 'diameter-label', 'data-id': 'AB' }),
    text(625, 360, '半径', { class: 'ig-label', fill: COLORS.green, 'data-kind': 'radius-label', 'data-id': 'OC' })
  ].join('');
}

function drawCircleCircumference() {
  const o = { x: 500, y: 500 };
  const r = 292;
  return [
    circle(o.x, o.y, r, {
      fill: 'rgba(42, 91, 215, 0.04)',
      stroke: COLORS.blue,
      'stroke-width': 7,
      'data-kind': 'circle',
      'data-id': 'circle:O'
    }),
    pathTag(arcPath(o.x, o.y, r + 52, 205, 515), {
      class: 'ig-helper',
      stroke: COLORS.green,
      'stroke-width': 5,
      'stroke-dasharray': '10 8',
      'data-kind': 'guide',
      'data-id': 'circumference-guide'
    }),
    text(o.x - 34, o.y + 42, 'O', { class: 'ig-label', 'data-kind': 'point-label', 'data-id': 'O' }),
    text(500, 858, '円周', { class: 'ig-label', fill: COLORS.green, 'data-kind': 'circumference-label', 'data-id': 'circle' })
  ].join('');
}

function drawCircleArea() {
  const o = { x: 500, y: 500 };
  const r = 292;
  return [
    circle(o.x, o.y, r, {
      fill: 'rgba(42, 91, 215, 0.12)',
      stroke: COLORS.blue,
      'stroke-width': 7,
      'data-kind': 'circle',
      'data-id': 'circle:O'
    }),
    line(o.x, o.y, o.x + r, o.y, {
      class: 'ig-helper',
      stroke: COLORS.green,
      'stroke-width': 5,
      'stroke-dasharray': '10 8',
      'data-kind': 'radius',
      'data-id': 'r'
    }),
    pathTag(arcPath(o.x, o.y, 210, 1, 38), {
      class: 'ig-helper',
      stroke: COLORS.green,
      'stroke-width': 3,
      'stroke-dasharray': '7 7',
      'data-kind': 'guide',
      'data-id': 'radius-guide'
    }),
    text(o.x - 34, o.y + 42, 'O', { class: 'ig-label', 'data-kind': 'point-label', 'data-id': 'O' }),
    text(500, 500, '面積', { class: 'ig-label', fill: COLORS.blue, 'data-kind': 'area-label', 'data-id': 'circle-area' }),
    text(650, 575, '半径', { class: 'ig-small-label', fill: COLORS.green, 'data-kind': 'radius-label', 'data-id': 'r' })
  ].join('');
}

function drawSectorArcLength() {
  const o = { x: 500, y: 560 };
  const r = 310;
  const start = -128;
  const end = -28;
  const a = polarPoint(o.x, o.y, r, start);
  const b = polarPoint(o.x, o.y, r, end);
  return [
    pathTag(sectorPath(o.x, o.y, r, start, end), {
      fill: 'rgba(42, 91, 215, 0.1)',
      stroke: 'none',
      'data-kind': 'area',
      'data-id': 'sector'
    }),
    line(o.x, o.y, a.x, a.y, { class: 'ig-segment', 'data-kind': 'radius', 'data-id': 'OA' }),
    line(o.x, o.y, b.x, b.y, { class: 'ig-segment', 'data-kind': 'radius', 'data-id': 'OB' }),
    pathTag(arcPath(o.x, o.y, r, start, end), {
      class: 'ig-segment',
      stroke: COLORS.blue,
      'stroke-width': 8,
      'data-kind': 'arc',
      'data-id': 'AB'
    }),
    pathTag(arcPath(o.x, o.y, r + 54, start + 8, end - 8), {
      class: 'ig-helper',
      stroke: COLORS.green,
      'stroke-width': 4,
      'stroke-dasharray': '8 7',
      'data-kind': 'guide',
      'data-id': 'arc-guide'
    }),
    text(o.x, o.y + 42, 'O', { class: 'ig-label', 'data-kind': 'point-label', 'data-id': 'O' }),
    text(500, 196, '弧', { class: 'ig-label', fill: COLORS.green, 'data-kind': 'arc-label', 'data-id': 'AB' }),
    text(500, 452, '中心角', { class: 'ig-small-label', fill: COLORS.muted, 'data-kind': 'angle-label', 'data-id': 'AOB' })
  ].join('');
}

function drawSectorArea() {
  const o = { x: 500, y: 560 };
  const r = 310;
  const start = -138;
  const end = -18;
  const a = polarPoint(o.x, o.y, r, start);
  const b = polarPoint(o.x, o.y, r, end);
  return [
    pathTag(sectorPath(o.x, o.y, r, start, end), {
      fill: 'rgba(42, 91, 215, 0.14)',
      stroke: 'none',
      'data-kind': 'area',
      'data-id': 'sector'
    }),
    line(o.x, o.y, a.x, a.y, { class: 'ig-segment', 'data-kind': 'radius', 'data-id': 'OA' }),
    line(o.x, o.y, b.x, b.y, { class: 'ig-segment', 'data-kind': 'radius', 'data-id': 'OB' }),
    pathTag(arcPath(o.x, o.y, r, start, end), {
      class: 'ig-segment',
      stroke: COLORS.blue,
      'stroke-width': 8,
      'data-kind': 'arc',
      'data-id': 'AB'
    }),
    pathTag(arcPath(o.x, o.y, 112, start, end), {
      class: 'ig-helper',
      stroke: COLORS.muted,
      'stroke-width': 4,
      'stroke-dasharray': '8 7',
      'data-kind': 'angle-guide',
      'data-id': 'central-angle'
    }),
    text(o.x, o.y + 42, 'O', { class: 'ig-label', 'data-kind': 'point-label', 'data-id': 'O' }),
    text(500, 392, '面積', { class: 'ig-label', fill: COLORS.blue, 'data-kind': 'area-label', 'data-id': 'sector-area' }),
    text(500, 470, '中心角', { class: 'ig-small-label', fill: COLORS.muted, 'data-kind': 'angle-label', 'data-id': 'AOB' })
  ].join('');
}

function drawParallelogramDefinition() {
  const a = { x: 250, y: 670 };
  const b = { x: 720, y: 670 };
  const c = { x: 825, y: 330 };
  const d = { x: 355, y: 330 };
  return [
    polygon([a, b, c, d], { fill: COLORS.blueSoft, stroke: 'none', 'data-kind': 'area', 'data-id': 'parallelogram:ABCD' }),
    segment(a, b, 'AB'),
    segment(b, c, 'BC'),
    segment(c, d, 'CD'),
    segment(d, a, 'DA'),
    line(370, 705, 600, 705, {
      class: 'ig-helper',
      stroke: COLORS.blue,
      'marker-start': 'url(#arrow-back)',
      'marker-end': 'url(#arrow-forward)',
      'data-kind': 'parallel-mark',
      'data-id': 'AB'
    }),
    line(475, 295, 705, 295, {
      class: 'ig-helper',
      stroke: COLORS.blue,
      'marker-start': 'url(#arrow-back)',
      'marker-end': 'url(#arrow-forward)',
      'data-kind': 'parallel-mark',
      'data-id': 'CD'
    }),
    line(217, 565, 280, 365, {
      class: 'ig-helper',
      stroke: COLORS.green,
      'marker-start': 'url(#arrow-back)',
      'marker-end': 'url(#arrow-forward)',
      'data-kind': 'parallel-mark',
      'data-id': 'AD'
    }),
    line(794, 635, 857, 435, {
      class: 'ig-helper',
      stroke: COLORS.green,
      'marker-start': 'url(#arrow-back)',
      'marker-end': 'url(#arrow-forward)',
      'data-kind': 'parallel-mark',
      'data-id': 'BC'
    }),
    pointLabel(a, 'A', -44, 44),
    pointLabel(b, 'B', 44, 44),
    pointLabel(c, 'C', 44, -42),
    pointLabel(d, 'D', -44, -42)
  ].join('');
}

function rightAngleMark(p, horizontal, vertical, id) {
  const h = { x: p.x + horizontal.x, y: p.y + horizontal.y };
  const hv = { x: p.x + horizontal.x + vertical.x, y: p.y + horizontal.y + vertical.y };
  const v = { x: p.x + vertical.x, y: p.y + vertical.y };
  return pathTag(`M ${h.x} ${h.y} L ${hv.x} ${hv.y} L ${v.x} ${v.y}`, {
    class: 'ig-helper',
    stroke: COLORS.green,
    'stroke-width': 5,
    'data-kind': 'right-angle',
    'data-id': id
  });
}

function tickMark(p1, p2, t, id, offset) {
  const x = p1.x + (p2.x - p1.x) * t;
  const y = p1.y + (p2.y - p1.y) * t;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  const size = 26;
  const shift = offset || 0;
  return line(x + nx * (shift - size), y + ny * (shift - size), x + nx * (shift + size), y + ny * (shift + size), {
    class: 'ig-helper',
    stroke: COLORS.green,
    'stroke-width': 6,
    'data-kind': 'equal-side-mark',
    'data-id': id
  });
}

function drawRectangleDefinition() {
  const a = { x: 240, y: 660 };
  const b = { x: 760, y: 660 };
  const c = { x: 760, y: 360 };
  const d = { x: 240, y: 360 };
  return [
    polygon([a, b, c, d], { fill: COLORS.blueSoft, stroke: 'none', 'data-kind': 'area', 'data-id': 'rectangle:ABCD' }),
    segment(a, b, 'AB'),
    segment(b, c, 'BC'),
    segment(c, d, 'CD'),
    segment(d, a, 'DA'),
    rightAngleMark(a, { x: 46, y: 0 }, { x: 0, y: -46 }, 'A'),
    rightAngleMark(b, { x: -46, y: 0 }, { x: 0, y: -46 }, 'B'),
    rightAngleMark(c, { x: -46, y: 0 }, { x: 0, y: 46 }, 'C'),
    rightAngleMark(d, { x: 46, y: 0 }, { x: 0, y: 46 }, 'D'),
    pointLabel(a, 'A', -44, 44),
    pointLabel(b, 'B', 44, 44),
    pointLabel(c, 'C', 44, -42),
    pointLabel(d, 'D', -44, -42)
  ].join('');
}

function drawRhombusDefinition() {
  const a = { x: 500, y: 715 };
  const b = { x: 780, y: 520 };
  const c = { x: 500, y: 325 };
  const d = { x: 220, y: 520 };
  return [
    polygon([a, b, c, d], { fill: COLORS.blueSoft, stroke: 'none', 'data-kind': 'area', 'data-id': 'rhombus:ABCD' }),
    segment(a, b, 'AB'),
    segment(b, c, 'BC'),
    segment(c, d, 'CD'),
    segment(d, a, 'DA'),
    tickMark(a, b, 0.5, 'AB'),
    tickMark(b, c, 0.5, 'BC'),
    tickMark(c, d, 0.5, 'CD'),
    tickMark(d, a, 0.5, 'DA'),
    pointLabel(a, 'A', 0, 62),
    pointLabel(b, 'B', 54, 6),
    pointLabel(c, 'C', 0, -54),
    pointLabel(d, 'D', -54, 6)
  ].join('');
}

function drawSquareDefinition() {
  const a = { x: 300, y: 700 };
  const b = { x: 700, y: 700 };
  const c = { x: 700, y: 300 };
  const d = { x: 300, y: 300 };
  return [
    polygon([a, b, c, d], { fill: COLORS.blueSoft, stroke: 'none', 'data-kind': 'area', 'data-id': 'square:ABCD' }),
    segment(a, b, 'AB'),
    segment(b, c, 'BC'),
    segment(c, d, 'CD'),
    segment(d, a, 'DA'),
    rightAngleMark(a, { x: 46, y: 0 }, { x: 0, y: -46 }, 'A'),
    rightAngleMark(b, { x: -46, y: 0 }, { x: 0, y: -46 }, 'B'),
    rightAngleMark(c, { x: -46, y: 0 }, { x: 0, y: 46 }, 'C'),
    rightAngleMark(d, { x: 46, y: 0 }, { x: 0, y: 46 }, 'D'),
    tickMark(a, b, 0.5, 'AB', 0),
    tickMark(b, c, 0.5, 'BC', 0),
    tickMark(c, d, 0.5, 'CD', 0),
    tickMark(d, a, 0.5, 'DA', 0),
    pointLabel(a, 'A', -44, 44),
    pointLabel(b, 'B', 44, 44),
    pointLabel(c, 'C', 44, -42),
    pointLabel(d, 'D', -44, -42)
  ].join('');
}

function drawTrapezoidDefinition() {
  const a = { x: 230, y: 690 };
  const b = { x: 800, y: 690 };
  const c = { x: 665, y: 350 };
  const d = { x: 365, y: 350 };
  return [
    polygon([a, b, c, d], { fill: COLORS.blueSoft, stroke: 'none', 'data-kind': 'area', 'data-id': 'trapezoid:ABCD' }),
    segment(a, b, 'AB'),
    segment(b, c, 'BC'),
    segment(c, d, 'CD'),
    segment(d, a, 'DA'),
    line(365, 725, 665, 725, {
      class: 'ig-helper',
      stroke: COLORS.blue,
      'marker-start': 'url(#arrow-back)',
      'marker-end': 'url(#arrow-forward)',
      'data-kind': 'parallel-mark',
      'data-id': 'AB'
    }),
    line(410, 315, 620, 315, {
      class: 'ig-helper',
      stroke: COLORS.blue,
      'marker-start': 'url(#arrow-back)',
      'marker-end': 'url(#arrow-forward)',
      'data-kind': 'parallel-mark',
      'data-id': 'CD'
    }),
    pointLabel(a, 'A', -44, 44),
    pointLabel(b, 'B', 44, 44),
    pointLabel(c, 'C', 44, -42),
    pointLabel(d, 'D', -44, -42)
  ].join('');
}

function triangleExteriorAngleConfigureScript() {
  return `
    function applyPreviewAngleModal(id, modalAngle, target) {
      if (!modalAngle) return;
      var inputs = target === "extra" ? config.initialState.extraAngleInputs : config.initialState.angleInputs;
      var kinds = target === "extra" ? config.initialState.extraAngleKinds : config.initialState.angleKinds;
      var colors = target === "extra" ? config.initialState.extraAngleColors : config.initialState.angleColors;
      var mode = modalAngle.mode || "text";
      if (mode === "hidden") {
        inputs[id] = "";
        kinds[id] = "hidden";
      } else if (mode === "numeric") {
        inputs[id] = " ";
      } else if (mode === "numericRaw") {
        inputs[id] = "raw:";
      } else if (mode === "numericDecimal") {
        inputs[id] = "decimal:";
      } else if (mode === "ratio") {
        inputs[id] = "ratio:" + (modalAngle.text || modalAngle.value || "");
      } else {
        inputs[id] = String(modalAngle.text || modalAngle.value || "");
      }
      if (modalAngle.kind) kinds[id] = modalAngle.kind;
      if (modalAngle.color) colors[id] = modalAngle.color;
    }
    var previewModalAngles = figureModel.modal && figureModel.modal.angles ? figureModel.modal.angles : {};
    config.initialState.angleInputs = Object.assign({}, config.initialState.angleInputs);
    config.initialState.angleKinds = Object.assign({}, config.initialState.angleKinds);
    config.initialState.angleColors = Object.assign({}, config.initialState.angleColors);
    config.initialState.extraAngleInputs = Object.assign({}, config.initialState.extraAngleInputs);
    config.initialState.extraAngleKinds = Object.assign({}, config.initialState.extraAngleKinds);
    config.initialState.extraAngleColors = Object.assign({}, config.initialState.extraAngleColors);
    applyPreviewAngleModal("A", previewModalAngles.A, "angle");
    applyPreviewAngleModal("B", previewModalAngles.B, "angle");
    applyPreviewAngleModal("C", previewModalAngles.C, "angle");
    applyPreviewAngleModal("exteriorC", previewModalAngles.exteriorC, "extra");
    config.initialState.angleArcScales = Object.assign({}, config.initialState.angleArcScales, { A: 0.5, B: 0.5 });
    config.initialState.extraAngleArcScales = Object.assign({}, config.initialState.extraAngleArcScales, { exteriorC: 0.5 });
    config.extraSegments = function (context) {
      var geometry = context.geometry;
      var dx = geometry.C.x - geometry.B.x;
      var dy = geometry.C.y - geometry.B.y;
      var length = Math.hypot(dx, dy) || 1;
      var extension = {
        x: geometry.C.x + dx / length * 2.4,
        y: geometry.C.y + dy / length * 2.4
      };
      return [{
        id: "extensionC",
        p1: geometry.C,
        p2: extension,
        stroke: "#687086",
        strokeWidth: "2.6",
        dasharray: "8 8",
        drawLine: true,
        hitEnabled: false
      }];
    };
    config.extraAngles = function (context) {
      var geometry = context.geometry;
      var dx = geometry.C.x - geometry.B.x;
      var dy = geometry.C.y - geometry.B.y;
      var length = Math.hypot(dx, dy) || 1;
      var extension = {
        x: geometry.C.x + dx / length * 2.4,
        y: geometry.C.y + dy / length * 2.4
      };
      var caLength = Math.hypot(geometry.A.x - geometry.C.x, geometry.A.y - geometry.C.y) || 1;
      var exteriorUx = (geometry.A.x - geometry.C.x) / caLength + (extension.x - geometry.C.x) / 2.4;
      var exteriorUy = (geometry.A.y - geometry.C.y) / caLength + (extension.y - geometry.C.y) / 2.4;
      var exteriorLength = Math.hypot(exteriorUx, exteriorUy) || 1;
      var exteriorLabel = {
        x: geometry.C.x + exteriorUx / exteriorLength * 1.35,
        y: geometry.C.y + exteriorUy / exteriorLength * 1.35
      };
      return [{
        id: "exteriorC",
        vertex: geometry.C,
        p1: geometry.A,
        p2: extension,
        value: 110,
        arcRadius: 1.04,
        markScale: 1.25,
        labelPoint: exteriorLabel,
        labelFontSize: 46
      }];
    };
  `;
}

function triangleAreaBaseHeightConfigureScript() {
  return `
    function applyPreviewSideModal(id, modalSide) {
      if (!modalSide) return;
      var mode = modalSide.mode || "text";
      if (mode === "hidden") {
        config.initialState.sideInputs[id] = "";
        config.initialState.sideArcVisible[id] = false;
      } else if (mode === "numeric") {
        config.initialState.sideInputs[id] = " ";
      } else if (mode === "numericRaw") {
        config.initialState.sideInputs[id] = "raw:";
      } else if (mode === "numericDecimal") {
        config.initialState.sideInputs[id] = "decimal:";
      } else if (mode === "ratio") {
        config.initialState.sideInputs[id] = "ratio:" + (modalSide.text || modalSide.value || "");
      } else {
        config.initialState.sideInputs[id] = String(modalSide.text || modalSide.value || "");
      }
      if (modalSide.guide !== undefined) config.initialState.sideArcVisible[id] = Boolean(modalSide.guide);
      if (modalSide.color) config.initialState.sideColors[id] = modalSide.color;
      if (modalSide.kind) config.initialState.sideKinds[id] = modalSide.kind;
    }
    var previewModalSides = figureModel.modal && figureModel.modal.sides ? figureModel.modal.sides : {};
    config.initialState.sideInputs = Object.assign({}, config.initialState.sideInputs);
    config.initialState.sideKinds = Object.assign({}, config.initialState.sideKinds, { AH: "plain" });
    config.initialState.sideArcVisible = Object.assign({}, config.initialState.sideArcVisible);
    config.initialState.sideColors = Object.assign({}, config.initialState.sideColors);
    applyPreviewSideModal("a", previewModalSides.a);
    applyPreviewSideModal("AH", previewModalSides.AH);
    config.drawAuxiliary = function (context) {
      var g = context.geometry;
      var stage = context.stage;
      var createSvg = context.createSvg;
      var fitPoint = context.fitPoint;
      var createTextLabel = context.createTextLabel;
      var ahColor = context.getSideColor("AH", "#687086");
      var vx = g.C.x - g.B.x;
      var vy = g.C.y - g.B.y;
      var lengthSq = vx * vx + vy * vy || 1;
      var t = ((g.A.x - g.B.x) * vx + (g.A.y - g.B.y) * vy) / lengthSq;
      var H = { x: g.B.x + vx * t, y: g.B.y + vy * t };
      var A = fitPoint(g.A);
      var B = fitPoint(g.B);
      var C = fitPoint(g.C);
      var h = fitPoint(H);
      context.drawRightAngleAtPoint(h, A, B);
      var ahLine = createSvg("line", {
        x1: A.x,
        y1: A.y,
        x2: h.x,
        y2: h.y,
        stroke: ahColor,
        "stroke-width": "3",
        "stroke-linecap": "round",
        "stroke-dasharray": "8 7"
      });
      context.attachHit(ahLine, "side", "AH");
      stage.appendChild(ahLine);
      context.drawSideKind(context.state.sideKinds.AH, A, h);
      var ahLabel = context.getSideLabelValue("AH");
      if (ahLabel) {
        var labelPos = { x: h.x - 48, y: (h.y + A.y) / 2 };
        if (context.state.sideArcVisible.AH !== false) {
          context.drawSideLabelArc(A, h, context.screen.center, labelPos, null, ahColor);
        }
        var labelAttrs = {
          x: labelPos.x,
          y: labelPos.y,
          "text-anchor": "middle",
          "dominant-baseline": "middle",
          "font-size": "52",
          "font-weight": "700",
          fill: ahColor,
          "data-label-kind": "segment",
          "data-label-role": "side",
          "data-label-id": "AH",
          "data-side-length": Math.hypot(A.x - h.x, A.y - h.y)
        };
        var labelNode = createTextLabel(ahLabel, labelAttrs);
        context.attachHit(labelNode, "side", "AH");
        stage.appendChild(labelNode);
      }
      stage.appendChild(createTextLabel("H", {
        x: h.x + 38,
        y: h.y - 30,
        "text-anchor": "middle",
        "dominant-baseline": "middle",
        "font-size": "46",
        "font-weight": "700",
        fill: "#1f2937",
        "data-label-kind": "point",
        "data-label-id": "H"
      }));
    };
  `;
}

function triangleIsoscelesApexBisectorConfigureScript() {
  return `
    config.initialState.extraAngleKinds = Object.assign({}, config.initialState.extraAngleKinds, {
      BAH: "circle",
      CAH: "circle"
    });
    config.initialState.extraAngleColors = Object.assign({}, config.initialState.extraAngleColors, {
      BAH: "#2a5bd7",
      CAH: "#2a5bd7"
    });
    config.extraAngles = function (context) {
      var g = context.geometry;
      var H = {
        x: (g.B.x + g.C.x) / 2,
        y: (g.B.y + g.C.y) / 2
      };
      return [
        {
          id: "BAH",
          vertex: g.A,
          p1: g.B,
          p2: H,
          value: 36,
          arcRadius: 0.72,
          markScale: 1.05
        },
        {
          id: "CAH",
          vertex: g.A,
          p1: g.C,
          p2: H,
          value: 36,
          arcRadius: 0.72,
          markScale: 1.05
        }
      ];
    };
    config.drawAuxiliary = function (context) {
      var g = context.geometry;
      var stage = context.stage;
      var createSvg = context.createSvg;
      var createTextLabel = context.createTextLabel;
      var A = context.fitPoint(g.A);
      var B = context.fitPoint(g.B);
      var C = context.fitPoint(g.C);
      var H = {
        x: (B.x + C.x) / 2,
        y: (B.y + C.y) / 2
      };
      var color = "#2a5bd7";
      stage.appendChild(createSvg("line", {
        x1: A.x,
        y1: A.y,
        x2: H.x,
        y2: H.y,
        stroke: color,
        "stroke-width": "3",
        "stroke-linecap": "round",
        "stroke-dasharray": "8 7"
      }));
      context.drawRightAngleAtPoint(H, A, B);
      context.drawSideKind("single", B, H, { scale: 0.85 });
      context.drawSideKind("single", H, C, { scale: 0.85 });
      stage.appendChild(createTextLabel("H", {
        x: H.x + 34,
        y: H.y - 26,
        "text-anchor": "middle",
        "dominant-baseline": "middle",
        "font-size": "46",
        "font-weight": "700",
        fill: "#1f2937",
        "data-label-kind": "point",
        "data-label-id": "H"
      }));
    };
  `;
}

function triangleSegmentAreaRatioSameHeightConfigureScript() {
  return `
    config.drawAuxiliary = function (context) {
      var g = context.geometry;
      var stage = context.stage;
      var createSvg = context.createSvg;
      var createTextLabel = context.createTextLabel;
      var A = context.fitPoint(g.A);
      var B = context.fitPoint(g.B);
      var C = context.fitPoint(g.C);
      var D = {
        x: B.x + (C.x - B.x) * 0.58,
        y: B.y + (C.y - B.y) * 0.58
      };
      var vx = C.x - B.x;
      var vy = C.y - B.y;
      var lengthSq = vx * vx + vy * vy || 1;
      var t = ((A.x - B.x) * vx + (A.y - B.y) * vy) / lengthSq;
      var H = {
        x: B.x + vx * t,
        y: B.y + vy * t
      };
      var blue = "#2a5bd7";
      var green = "#19735a";
      var muted = "#687086";
      function polygon(points, fill) {
        stage.appendChild(createSvg("polygon", {
          points: points.map(function (p) { return p.x + "," + p.y; }).join(" "),
          fill: fill,
          stroke: "none"
        }));
      }
      function line(P, Q, color, dash) {
        stage.appendChild(createSvg("line", {
          x1: P.x,
          y1: P.y,
          x2: Q.x,
          y2: Q.y,
          stroke: color || blue,
          "stroke-width": "3",
          "stroke-linecap": "round",
          "stroke-dasharray": dash || ""
        }));
      }
      function label(text, x, y, size, color) {
        stage.appendChild(createTextLabel(text, {
          x: x,
          y: y,
          "text-anchor": "middle",
          "dominant-baseline": "middle",
          "font-size": String(size || 46),
          "font-weight": "700",
          fill: color || blue,
          "data-label-kind": "ratio",
          "data-label-role": "modal-text"
        }));
      }
      function guideLabel(text, P, Q, y, color) {
        var labelPoint = { x: (P.x + Q.x) / 2, y: y };
        context.drawSideLabelArc(P, Q, context.screen.center, labelPoint, 72, color || blue);
        label(text, labelPoint.x, labelPoint.y, 44, color || blue);
      }
      polygon([A, B, D], "rgba(42, 91, 215, 0.10)");
      polygon([A, D, C], "rgba(25, 115, 90, 0.10)");
      line(A, D, blue, "");
      line(A, H, muted, "8 7");
      context.drawRightAngleAtPoint(H, A, B);
      label("S_1", (A.x + B.x + D.x) / 3 - 20, (A.y + B.y + D.y) / 3 + 25, 48);
      label("S_2", (A.x + D.x + C.x) / 3 + 22, (A.y + D.y + C.y) / 3 + 25, 48, green);
      guideLabel("a", B, D, B.y + 72, blue);
      guideLabel("b", D, C, C.y + 72, green);
      stage.appendChild(createTextLabel("D", {
        x: D.x,
        y: D.y + 56,
        "text-anchor": "middle",
        "dominant-baseline": "middle",
        "font-size": "44",
        "font-weight": "700",
        fill: "#1f2937",
        "data-label-kind": "point",
        "data-label-id": "D"
      }));
    };
  `;
}

function triangleSegmentAreaRatioSameBaseConfigureScript() {
  return `
    config.drawAuxiliary = function (context) {
      var g = context.geometry;
      var stage = context.stage;
      var createSvg = context.createSvg;
      var createTextLabel = context.createTextLabel;
      var A = context.fitPoint(g.A);
      var B = context.fitPoint(g.B);
      var C = context.fitPoint(g.C);
      var D = {
        x: B.x + (C.x - B.x) * 0.34,
        y: B.y + (A.y - B.y) * 0.56
      };
      var H1 = {
        x: A.x,
        y: B.y
      };
      var H2 = {
        x: D.x,
        y: B.y
      };
      var blue = "#2a5bd7";
      var green = "#19735a";
      var muted = "#687086";
      function polygon(points, fill) {
        stage.appendChild(createSvg("polygon", {
          points: points.map(function (p) { return p.x + "," + p.y; }).join(" "),
          fill: fill,
          stroke: "none"
        }));
      }
      function line(P, Q, color, dash, width) {
        stage.appendChild(createSvg("line", {
          x1: P.x,
          y1: P.y,
          x2: Q.x,
          y2: Q.y,
          stroke: color || blue,
          "stroke-width": String(width || 3),
          "stroke-linecap": "round",
          "stroke-dasharray": dash || ""
        }));
      }
      function label(text, x, y, size, color) {
        stage.appendChild(createTextLabel(text, {
          x: x,
          y: y,
          "text-anchor": "middle",
          "dominant-baseline": "middle",
          "font-size": String(size || 46),
          "font-weight": "700",
          fill: color || blue,
          "data-label-kind": "ratio",
          "data-label-role": "modal-text"
        }));
      }
      polygon([A, B, C], "rgba(42, 91, 215, 0.09)");
      polygon([D, B, C], "rgba(25, 115, 90, 0.13)");
      line(D, B, green, "", 3);
      line(D, C, green, "", 3);
      line(A, H1, muted, "8 7", 3);
      line(D, H2, muted, "8 7", 3);
      context.drawRightAngleAtPoint(H1, A, B);
      context.drawRightAngleAtPoint(H2, D, B);
      context.drawSideLabelArc(A, H1, context.screen.center, { x: H1.x + 58, y: (A.y + H1.y) / 2 - 40 }, 82, blue);
      context.drawSideLabelArc(D, H2, context.screen.center, { x: H2.x - 54, y: (D.y + H2.y) / 2 + 10 }, 82, green);
      label("S_1", A.x + 120, (A.y + B.y) / 2 + 20, 48);
      label("S_2", D.x + 60, (D.y + B.y) / 2 + 42, 48, green);
      label("h_1", H1.x + 58, (A.y + H1.y) / 2 - 40, 42);
      label("h_2", H2.x - 54, (D.y + H2.y) / 2 + 10, 42, green);
      stage.appendChild(createTextLabel("D", {
        x: D.x - 34,
        y: D.y - 28,
        "text-anchor": "middle",
        "dominant-baseline": "middle",
        "font-size": "44",
        "font-weight": "700",
        fill: "#1f2937",
        "data-label-kind": "point",
        "data-label-id": "D"
      }));
    };
  `;
}

function quadrilateralBaseHeightConfigureScript() {
  return `
    function drawAuxiliaryGuide(context, stage, createSvg, P, Q, center, labelPos, color) {
      var geom = context.sideArcGeometry(P, Q, center, labelPos);
      stage.appendChild(createSvg("path", {
        d: context.quadraticPathSegment(P, geom.control, Q, 0, 0.5 - geom.gapHalf, 20),
        fill: "none",
        stroke: color,
        "stroke-width": "2",
        "stroke-linecap": "round",
        "stroke-dasharray": "6 5"
      }));
      stage.appendChild(createSvg("path", {
        d: context.quadraticPathSegment(P, geom.control, Q, 0.5 + geom.gapHalf, 1, 20),
        fill: "none",
        stroke: color,
        "stroke-width": "2",
        "stroke-linecap": "round",
        "stroke-dasharray": "6 5"
      }));
    }
    config.drawAuxiliary = function (context) {
      var g = context.geometry;
      var stage = context.stage;
      var createSvg = context.createSvg;
      var createLabelNode = context.createLabelNode;
      var A = context.fitPoint(g.A);
      var B = context.fitPoint(g.B);
      var C = context.fitPoint(g.C);
      var vx = g.C.x - g.B.x;
      var vy = g.C.y - g.B.y;
      var lengthSq = vx * vx + vy * vy || 1;
      var t = ((g.A.x - g.B.x) * vx + (g.A.y - g.B.y) * vy) / lengthSq;
      var Hraw = { x: g.B.x + vx * t, y: g.B.y + vy * t };
      var H = context.fitPoint(Hraw);
      stage.appendChild(createSvg("line", {
        x1: A.x,
        y1: A.y,
        x2: H.x,
        y2: H.y,
        stroke: "#687086",
        "stroke-width": "3.2",
        "stroke-linecap": "round",
        "stroke-dasharray": "8 7"
      }));
      var size = 34;
      stage.appendChild(createSvg("path", {
        d: "M " + H.x + " " + (H.y - size) + " L " + (H.x + size) + " " + (H.y - size) + " L " + (H.x + size) + " " + H.y,
        fill: "none",
        stroke: "#687086",
        "stroke-width": "3.2",
        "stroke-linejoin": "round",
        "stroke-linecap": "round"
      }));
      var labelPos = { x: H.x + 58, y: (H.y + A.y) / 2 };
      drawAuxiliaryGuide(context, stage, createSvg, A, H, context.screen.center, labelPos, "#2a5bd7");
      var labelNode = createLabelNode("高さ", {
        x: labelPos.x,
        y: labelPos.y,
        "text-anchor": "middle",
        "dominant-baseline": "middle",
        "font-size": "48",
        "font-weight": "700",
        fill: "#2a5bd7",
        "data-label-kind": "segment",
        "data-label-role": "side",
        "data-label-id": "height"
      });
      stage.appendChild(labelNode);
    };
  `;
}

function quadrilateralRectangleAreaConfigureScript() {
  return `
    config.initialState.labelOffsets = Object.assign({}, config.initialState.labelOffsets, {
      point: config.initialState.labelOffsets.point || {},
      side: Object.assign({}, config.initialState.labelOffsets.side || {}, {
        AB: { x: 126, y: 0 }
      })
    });
  `;
}

function quadrilateralParallelogramOppositeSidesConfigureScript() {
  return `
    config.initialState.sideKinds = Object.assign({}, config.initialState.sideKinds, {
      AB: "single",
      CD: "single",
      BC: "double",
      DA: "double"
    });
    config.skipBaseAngles = true;
    config.pointLabelFontSize = 42;
  `;
}

function quadrilateralParallelogramOppositeAnglesConfigureScript() {
  return `
    config.initialState.sideKinds = Object.assign({}, config.initialState.sideKinds, {
      AB: "plain",
      BC: "plain",
      CD: "plain",
      DA: "plain"
    });
    config.initialState.angleKinds = Object.assign({}, config.initialState.angleKinds, {
      A: "circle",
      C: "circle",
      B: "cross",
      D: "cross"
    });
    config.pageAngleArcRadius = 0.476;
    config.pointLabelFontSize = 42;
  `;
}

function quadrilateralParallelogramOnePairParallelEqualConfigureScript() {
  return `
    config.initialState.sideKinds = Object.assign({}, config.initialState.sideKinds, {
      AB: "plain",
      CD: "plain",
      BC: "parallel-double",
      DA: "parallel-double-reverse"
    });
    config.skipBaseAngles = true;
    config.pointLabelFontSize = 42;
  `;
}

function quadrilateralParallelogramDiagonalsBisectConfigureScript() {
  return `
    config.initialState.sideKinds = Object.assign({}, config.initialState.sideKinds, {
      AB: "plain",
      BC: "plain",
      CD: "plain",
      DA: "plain"
    });
    config.skipBaseAngles = true;
    config.pointLabelFontSize = 42;
    config.drawAuxiliary = function (context) {
      var stage = context.stage;
      var createSvg = context.createSvg;
      var createLabelNode = context.createLabelNode;
      var A = context.screen.A;
      var B = context.screen.B;
      var C = context.screen.C;
      var D = context.screen.D;
      var O = { x: (A.x + C.x) / 2, y: (A.y + C.y) / 2 };
      stage.appendChild(createSvg("line", {
        x1: A.x,
        y1: A.y,
        x2: C.x,
        y2: C.y,
        stroke: "#687086",
        "stroke-width": "3",
        "stroke-linecap": "round",
        "stroke-dasharray": "9 7"
      }));
      stage.appendChild(createSvg("line", {
        x1: B.x,
        y1: B.y,
        x2: D.x,
        y2: D.y,
        stroke: "#687086",
        "stroke-width": "3",
        "stroke-linecap": "round",
        "stroke-dasharray": "9 7"
      }));
      context.drawSideKind("single", A, O);
      context.drawSideKind("single", O, C);
      context.drawSideKind("double", B, O);
      context.drawSideKind("double", O, D);
      stage.appendChild(createSvg("circle", {
        cx: O.x,
        cy: O.y,
        r: 6,
        fill: "#1f2430"
      }));
      stage.appendChild(createLabelNode("O", {
        x: O.x + 34,
        y: O.y - 34,
        "text-anchor": "middle",
        "dominant-baseline": "middle",
        "font-size": "42",
        "font-weight": "700",
        fill: "#1f2430",
        "data-label-kind": "point",
        "data-label-id": "O"
      }));
    };
  `;
}

function quadrilateralDiagonalPropertyBaseConfigureScript(options) {
  var showEqualDiagonalLabels = Boolean(options && options.showEqualDiagonalLabels);
  var showRightAngle = Boolean(options && options.showRightAngle);
  var markAllHalvesEqual = Boolean(options && options.markAllHalvesEqual);
  var markWholeDiagonalsEqual = Boolean(options && options.markWholeDiagonalsEqual);
  var showEqualDiagonalStatement = Boolean(options && options.showEqualDiagonalStatement);
  var showDiagonalGuideLabels = Boolean(options && options.showDiagonalGuideLabels);
  var diagonalEquationText = options && options.diagonalEquationText ? options.diagonalEquationText : '対角線1=対角線2';
  var showBisectMarks = !(options && options.showBisectMarks === false);
  var halfSegmentsCode = showBisectMarks
    ? `
        { id: "AO", p1: g.A, p2: O, drawLine: false, hitEnabled: false },
        { id: "OC", p1: O, p2: g.C, drawLine: false, hitEnabled: false },
        { id: "BO", p1: g.B, p2: O, drawLine: false, hitEnabled: false },
        { id: "OD", p1: O, p2: g.D, drawLine: false, hitEnabled: false }`
    : '';
  return `
    config.skipBaseAngles = true;
    config.initialState.sideKinds = Object.assign({}, config.initialState.sideKinds, {
      AB: "plain",
      BC: "plain",
      CD: "plain",
      DA: "plain"
    });
    config.initialState.extraSegmentKinds = Object.assign({}, config.initialState.extraSegmentKinds, {
      AC: "${markWholeDiagonalsEqual ? 'single' : 'plain'}",
      BD: "${markWholeDiagonalsEqual ? 'single' : 'plain'}",
      AO: "${markAllHalvesEqual ? 'single' : 'single'}",
      OC: "${markAllHalvesEqual ? 'single' : 'single'}",
      BO: "${markAllHalvesEqual ? 'single' : 'double'}",
      OD: "${markAllHalvesEqual ? 'single' : 'double'}",
      diagonalEquation: "plain"
    });
    config.initialState.extraSegmentInputs = Object.assign({}, config.initialState.extraSegmentInputs, {
      AC: ${showDiagonalGuideLabels ? JSON.stringify('対角線1') : (showEqualDiagonalStatement ? JSON.stringify('AC=BD') : (showEqualDiagonalLabels ? JSON.stringify('d') : JSON.stringify('')))},
      BD: ${showDiagonalGuideLabels ? JSON.stringify('対角線2') : (showEqualDiagonalLabels ? JSON.stringify('d') : JSON.stringify(''))},
      AO: "",
      OC: "",
      BO: "",
      OD: "",
      diagonalEquation: ${showDiagonalGuideLabels ? JSON.stringify(diagonalEquationText) : JSON.stringify('')}
    });
    config.initialState.extraSegmentArcVisible = Object.assign({}, config.initialState.extraSegmentArcVisible, {
      AC: ${showDiagonalGuideLabels ? 'true' : 'false'},
      BD: ${showDiagonalGuideLabels ? 'true' : 'false'}
    });
    config.initialState.extraSegmentColors = Object.assign({}, config.initialState.extraSegmentColors, {
      AC: "#687086",
      BD: "#687086",
      AO: "#2a5bd7",
      OC: "#2a5bd7",
      BO: "#2a5bd7",
      OD: "#2a5bd7",
      diagonalEquation: "#2a5bd7"
    });
    config.initialState.extraAngleKinds = Object.assign({}, config.initialState.extraAngleKinds, {
      diagonalsRight: ${showRightAngle ? JSON.stringify('right') : JSON.stringify('hidden')}
    });
    config.extraSegments = function (context) {
      var g = context.geometry;
      var O = {
        x: (g.A.x + g.C.x) / 2,
        y: (g.A.y + g.C.y) / 2
      };
      return [
        {
          id: "AC",
          p1: g.A,
          p2: g.C,
          stroke: "#687086",
          strokeWidth: "3.4",
          dasharray: "9 7",
          labelPoint: ${showDiagonalGuideLabels ? '{ x: O.x + 1.0, y: O.y + 0.42 }' : (showEqualDiagonalStatement ? '{ x: O.x, y: O.y - 1.05 }' : '{ x: O.x + 0.72, y: O.y - 0.62 }')},
          labelFontSize: ${showDiagonalGuideLabels ? JSON.stringify('38') : JSON.stringify('48')},
          hitEnabled: false
        },
        {
          id: "BD",
          p1: g.B,
          p2: g.D,
          stroke: "#687086",
          strokeWidth: "3.4",
          dasharray: "9 7",
          labelPoint: ${showDiagonalGuideLabels ? '{ x: O.x - 1.0, y: O.y + 0.42 }' : '{ x: O.x - 0.72, y: O.y + 0.62 }'},
          labelFontSize: ${showDiagonalGuideLabels ? JSON.stringify('38') : JSON.stringify('48')},
          hitEnabled: false
        }${(showDiagonalGuideLabels || halfSegmentsCode) ? ',' : ''}
        ${showDiagonalGuideLabels ? '{ id: "diagonalEquation", p1: { x: O.x - 0.1, y: O.y - 1.55 }, p2: { x: O.x + 0.1, y: O.y - 1.55 }, drawLine: false, labelPoint: { x: O.x, y: O.y - 1.55 }, labelFontSize: "40", hitEnabled: false }' : ''}
        ${showDiagonalGuideLabels && halfSegmentsCode ? ',' : ''}
${halfSegmentsCode}
      ];
    };
    config.extraAngles = function (context) {
      var g = context.geometry;
      if (!${showRightAngle ? 'true' : 'false'}) return [];
      var O = {
        x: (g.A.x + g.C.x) / 2,
        y: (g.A.y + g.C.y) / 2
      };
      return [{
        id: "diagonalsRight",
        vertex: O,
        p1: g.A,
        p2: g.B,
        value: 90,
        hitRadius: 0.58
      }];
    };
  `;
}

function quadrilateralRectangleDiagonalsConfigureScript() {
  return quadrilateralDiagonalPropertyBaseConfigureScript({
    showEqualDiagonalLabels: false,
    showRightAngle: false,
    markAllHalvesEqual: false
  });
}

function quadrilateralRectangleConditionDiagonalsConfigureScript() {
  return quadrilateralDiagonalPropertyBaseConfigureScript({
    showEqualDiagonalLabels: false,
    showRightAngle: false,
    markAllHalvesEqual: false,
    showEqualDiagonalStatement: true,
    showDiagonalGuideLabels: true,
    showBisectMarks: false
  });
}

function quadrilateralRectangleConditionThreeRightAnglesConfigureScript() {
  return `
    config.initialState.sideKinds = Object.assign({}, config.initialState.sideKinds, {
      AB: "plain",
      BC: "plain",
      CD: "plain",
      DA: "plain"
    });
    config.initialState.angleKinds = Object.assign({}, config.initialState.angleKinds, {
      A: "hidden",
      B: "right",
      C: "right",
      D: "right"
    });
    config.pageAngleArcRadius = 0.3;
  `;
}

function quadrilateralRhombusDiagonalsConfigureScript() {
  return quadrilateralDiagonalPropertyBaseConfigureScript({
    showEqualDiagonalLabels: false,
    showRightAngle: true,
    markAllHalvesEqual: false
  });
}

function quadrilateralRhombusConditionDiagonalsConfigureScript() {
  return quadrilateralDiagonalPropertyBaseConfigureScript({
    showEqualDiagonalLabels: false,
    showRightAngle: true,
    markAllHalvesEqual: false,
    markWholeDiagonalsEqual: false,
    showBisectMarks: false
  });
}

function quadrilateralRhombusConditionFourEqualSidesConfigureScript() {
  return `
    config.skipBaseAngles = true;
    config.initialState.sideKinds = Object.assign({}, config.initialState.sideKinds, {
      AB: "single",
      BC: "single",
      CD: "single",
      DA: "single"
    });
  `;
}

function quadrilateralSquareDiagonalsConfigureScript() {
  return quadrilateralDiagonalPropertyBaseConfigureScript({
    showEqualDiagonalLabels: false,
    showRightAngle: true,
    markAllHalvesEqual: true
  });
}

function quadrilateralSquareConditionDiagonalsConfigureScript() {
  return quadrilateralDiagonalPropertyBaseConfigureScript({
    showEqualDiagonalLabels: false,
    showRightAngle: true,
    markAllHalvesEqual: true,
    showEqualDiagonalStatement: true,
    showDiagonalGuideLabels: true,
    showBisectMarks: false
  });
}

function quadrilateralSquareConditionRectangleEqualAdjacentSidesConfigureScript() {
  return `
    config.initialState.sideKinds = Object.assign({}, config.initialState.sideKinds, {
      AB: "single",
      BC: "single",
      CD: "plain",
      DA: "plain"
    });
    config.initialState.angleKinds = Object.assign({}, config.initialState.angleKinds, {
      A: "right",
      B: "right",
      C: "right",
      D: "right"
    });
    config.pageAngleArcRadius = 0.34;
  `;
}

function quadrilateralSquareConditionRhombusRightAngleConfigureScript() {
  return `
    config.initialState.sideKinds = Object.assign({}, config.initialState.sideKinds, {
      AB: "single",
      BC: "single",
      CD: "single",
      DA: "single"
    });
    config.initialState.angleKinds = Object.assign({}, config.initialState.angleKinds, {
      A: "right",
      B: "hidden",
      C: "hidden",
      D: "hidden"
    });
    config.pageAngleArcRadius = 0.34;
  `;
}

function quadrilateralSquareConditionRectanglePerpendicularDiagonalsConfigureScript() {
  return quadrilateralDiagonalPropertyBaseConfigureScript({
    showRightAngle: true,
    showDiagonalGuideLabels: true,
    showBisectMarks: false,
    diagonalEquationText: '対角線1⊥対角線2'
  }) + `
    config.skipBaseAngles = false;
    config.initialState.angleKinds = Object.assign({}, config.initialState.angleKinds, {
      A: "right",
      B: "right",
      C: "right",
      D: "right"
    });
    config.pageAngleArcRadius = 0.34;
  `;
}

function quadrilateralSquareConditionRhombusEqualDiagonalsConfigureScript() {
  return quadrilateralDiagonalPropertyBaseConfigureScript({
    showDiagonalGuideLabels: true,
    showBisectMarks: false
  }) + `
    config.initialState.sideKinds = Object.assign({}, config.initialState.sideKinds, {
      AB: "single",
      BC: "single",
      CD: "single",
      DA: "single"
    });
  `;
}

function quadrilateralDiagonalsConfigureScript() {
  return `
    function drawAuxiliaryGuide(context, stage, createSvg, P, Q, center, labelPos, color) {
      var geom = context.sideArcGeometry(P, Q, center, labelPos);
      stage.appendChild(createSvg("path", {
        d: context.quadraticPathSegment(P, geom.control, Q, 0, 0.5 - geom.gapHalf, 20),
        fill: "none",
        stroke: color,
        "stroke-width": "2",
        "stroke-linecap": "round",
        "stroke-dasharray": "6 5"
      }));
      stage.appendChild(createSvg("path", {
        d: context.quadraticPathSegment(P, geom.control, Q, 0.5 + geom.gapHalf, 1, 20),
        fill: "none",
        stroke: color,
        "stroke-width": "2",
        "stroke-linecap": "round",
        "stroke-dasharray": "6 5"
      }));
    }
    config.drawAuxiliary = function (context) {
      var g = context.geometry;
      var stage = context.stage;
      var createSvg = context.createSvg;
      var createLabelNode = context.createLabelNode;
      var A = context.fitPoint(g.A);
      var B = context.fitPoint(g.B);
      var C = context.fitPoint(g.C);
      var D = context.fitPoint(g.D);
      stage.appendChild(createSvg("line", {
        x1: A.x,
        y1: A.y,
        x2: C.x,
        y2: C.y,
        stroke: "#19735a",
        "stroke-width": "3.4",
        "stroke-linecap": "round",
        "stroke-dasharray": "9 7"
      }));
      stage.appendChild(createSvg("line", {
        x1: B.x,
        y1: B.y,
        x2: D.x,
        y2: D.y,
        stroke: "#687086",
        "stroke-width": "3.4",
        "stroke-linecap": "round",
        "stroke-dasharray": "9 7"
      }));
      var acLabelPos = { x: (A.x + C.x) / 2, y: (A.y + C.y) / 2 + 72 };
      var bdLabelPos = { x: (B.x + D.x) / 2 + 92, y: (B.y + D.y) / 2 - 52 };
      drawAuxiliaryGuide(context, stage, createSvg, A, C, context.screen.center, acLabelPos, "#2a5bd7");
      drawAuxiliaryGuide(context, stage, createSvg, B, D, context.screen.center, bdLabelPos, "#2a5bd7");
      stage.appendChild(createLabelNode("対角線1", {
        x: acLabelPos.x,
        y: acLabelPos.y,
        "text-anchor": "middle",
        "dominant-baseline": "middle",
        "font-size": "48",
        "font-weight": "700",
        fill: "#2a5bd7",
        "data-label-kind": "segment",
        "data-label-role": "diagonal",
        "data-label-id": "AC"
      }));
      stage.appendChild(createLabelNode("対角線2", {
        x: bdLabelPos.x,
        y: bdLabelPos.y,
        "text-anchor": "middle",
        "dominant-baseline": "middle",
        "font-size": "48",
        "font-weight": "700",
        fill: "#2a5bd7",
        "data-label-kind": "segment",
        "data-label-role": "diagonal",
        "data-label-id": "BD"
      }));
    };
  `;
}

function miniTriangle(originX, originY, scale, options) {
  const a = { x: originX + 20 * scale, y: originY + 220 * scale };
  const b = { x: originX + 300 * scale, y: originY + 220 * scale };
  const c = { x: originX + 145 * scale, y: originY + 45 * scale };
  const centerX = originX + 160 * scale;
  const titleY = originY + 286 * scale;
  const sideStroke = (side) => options.highlightSides && options.highlightSides.includes(side) ? COLORS.green : COLORS.blue;
  const parts = [
    polygon([a, b, c], { fill: COLORS.blueSoft, stroke: 'none' }),
    segment(a, b, `${options.id}:AB`, { 'stroke-width': 5, stroke: sideStroke('AB') }),
    segment(b, c, `${options.id}:BC`, { 'stroke-width': 5, stroke: sideStroke('BC') }),
    segment(c, a, `${options.id}:CA`, { 'stroke-width': 5, stroke: sideStroke('CA') }),
    text(centerX, titleY, options.title, { class: 'ig-mini-title' })
  ];
  if (options.kind === 'sss') {
    parts.push(text(centerX, titleY + 42 * scale, '3辺', { class: 'ig-small-label', 'font-size': 28 }));
  }
  if (options.kind === 'sas') {
    parts.push(pathTag(`M ${a.x + 54 * scale} ${a.y} A ${54 * scale} ${54 * scale} 0 0 1 ${a.x + 34 * scale} ${a.y - 43 * scale}`, {
      fill: 'none',
      stroke: COLORS.amber,
      'stroke-width': 5,
      'stroke-linecap': 'round'
    }));
    parts.push(text(centerX, titleY + 42 * scale, '2辺と間の角', { class: 'ig-small-label', 'font-size': 28 }));
  }
  if (options.kind === 'asa') {
    parts.push(pathTag(`M ${a.x + 54 * scale} ${a.y} A ${54 * scale} ${54 * scale} 0 0 1 ${a.x + 34 * scale} ${a.y - 43 * scale}`, {
      fill: 'none',
      stroke: COLORS.amber,
      'stroke-width': 5,
      'stroke-linecap': 'round'
    }));
    parts.push(pathTag(`M ${b.x - 54 * scale} ${b.y} A ${54 * scale} ${54 * scale} 0 0 0 ${b.x - 28 * scale} ${b.y - 47 * scale}`, {
      fill: 'none',
      stroke: COLORS.amber,
      'stroke-width': 5,
      'stroke-linecap': 'round'
    }));
    parts.push(text(centerX, titleY + 42 * scale, '1辺と両端の角', { class: 'ig-small-label', 'font-size': 28 }));
  }
  return parts.join('');
}

function drawTriangleCongruence() {
  return [
    miniTriangle(115, 150, 0.8, { id: 'sss', kind: 'sss', title: 'SSS', highlightSides: ['AB', 'BC', 'CA'] }),
    miniTriangle(610, 150, 0.8, { id: 'sas', kind: 'sas', title: 'SAS', highlightSides: ['AB', 'CA'] }),
    miniTriangle(360, 560, 0.8, { id: 'asa', kind: 'asa', title: 'ASA', highlightSides: ['AB'] })
  ].join('');
}

function drawRightTriangleRatios() {
  const a = { x: 250, y: 730 };
  const b = { x: 730, y: 730 };
  const c = { x: 250, y: 370 };
  return [
    polygon([a, b, c], { fill: COLORS.blueSoft, stroke: 'none', 'data-kind': 'area', 'data-id': 'right-triangle:ABC' }),
    segment(a, b, 'AB'),
    segment(a, c, 'AC'),
    segment(c, b, 'CB'),
    line(a.x, a.y - 62, a.x + 62, a.y - 62, { class: 'ig-helper', stroke: COLORS.muted, 'stroke-width': 5 }),
    line(a.x + 62, a.y - 62, a.x + 62, a.y, { class: 'ig-helper', stroke: COLORS.muted, 'stroke-width': 5 }),
    text(490, 782, '4', { class: 'ig-label', fill: COLORS.blue, 'data-kind': 'length-label', 'data-id': 'AB' }),
    text(190, 550, '3', { class: 'ig-label', fill: COLORS.blue, 'data-kind': 'length-label', 'data-id': 'AC' }),
    text(520, 520, '5', { class: 'ig-label', fill: COLORS.blue, 'data-kind': 'length-label', 'data-id': 'CB' }),
    text(565, 250, '3 : 4 : 5', { class: 'ig-label', fill: COLORS.ink, 'data-kind': 'ratio-label', 'data-id': '3-4-5' }),
    pointLabel(a, 'A', -42, 42),
    pointLabel(b, 'B', 44, 42),
    pointLabel(c, 'C', -42, -42)
  ].join('');
}

function midpointTickMark(point, direction, size = 34) {
  const len = Math.hypot(direction.x, direction.y) || 1;
  const nx = -direction.y / len;
  const ny = direction.x / len;
  return line(point.x - nx * size / 2, point.y - ny * size / 2, point.x + nx * size / 2, point.y + ny * size / 2, {
    stroke: COLORS.blue,
    'stroke-width': 5,
    'stroke-linecap': 'round'
  });
}

function drawPerpendicularBisector() {
  const A = { x: 210, y: 620 };
  const B = { x: 790, y: 620 };
  const M = { x: 500, y: 620 };
  return [
    segment(A, B, 'AB', { 'stroke-width': 6 }),
    line(500, 190, 500, 850, {
      class: 'ig-line',
      stroke: COLORS.green,
      'stroke-width': 5,
      'stroke-linecap': 'round',
      'stroke-dasharray': '12 10',
      'data-kind': 'segment',
      'data-id': 'perpendicular-bisector'
    }),
    line(M.x, M.y - 66, M.x + 66, M.y - 66, { class: 'ig-helper', stroke: COLORS.muted, 'stroke-width': 5 }),
    line(M.x + 66, M.y - 66, M.x + 66, M.y, { class: 'ig-helper', stroke: COLORS.muted, 'stroke-width': 5 }),
    midpointTickMark({ x: 355, y: 620 }, { x: B.x - A.x, y: B.y - A.y }),
    midpointTickMark({ x: 645, y: 620 }, { x: B.x - A.x, y: B.y - A.y }),
    text(650, 330, '垂直二等分線', { class: 'ig-small-label', fill: COLORS.blue, 'font-size': 42, 'data-kind': 'segment-label', 'data-id': 'perpendicular-bisector' }),
    text(A.x, A.y + 58, 'A', { class: 'ig-small-label', 'data-kind': 'point-label', 'data-id': 'A' }),
    text(M.x - 42, M.y + 58, 'M', { class: 'ig-small-label', 'data-kind': 'point-label', 'data-id': 'M' }),
    text(B.x, B.y + 58, 'B', { class: 'ig-small-label', 'data-kind': 'point-label', 'data-id': 'B' })
  ].join('');
}

function drawAngleBisector() {
  const O = { x: 250, y: 720 };
  const A = { x: 770, y: 720 };
  const B = { x: 620, y: 305 };
  const D = { x: 690, y: 520 };
  return [
    segment(O, A, 'OA', { 'stroke-width': 6 }),
    segment(O, B, 'OB', { 'stroke-width': 6 }),
    line(O.x, O.y, D.x, D.y, {
      class: 'ig-line',
      stroke: COLORS.green,
      'stroke-width': 5,
      'stroke-linecap': 'round',
      'stroke-dasharray': '12 10',
      'data-kind': 'segment',
      'data-id': 'angle-bisector'
    }),
    pathTag(arcPath(O.x, O.y, 128, 0, -25), {
      fill: 'none',
      stroke: COLORS.muted,
      'stroke-width': 5,
      'stroke-linecap': 'round',
      'data-kind': 'angle',
      'data-id': 'AOD'
    }),
    pathTag(arcPath(O.x, O.y, 165, -25, -50), {
      fill: 'none',
      stroke: COLORS.muted,
      'stroke-width': 5,
      'stroke-linecap': 'round',
      'data-kind': 'angle',
      'data-id': 'DOB'
    }),
    text(790, 495, '二等分線', { class: 'ig-small-label', fill: COLORS.blue, 'font-size': 42, 'data-kind': 'segment-label', 'data-id': 'angle-bisector' }),
    text(455, 650, '∠1', { class: 'ig-small-label', fill: COLORS.muted, 'data-kind': 'angle-label', 'data-id': 'AOD' }),
    text(455, 555, '∠2', { class: 'ig-small-label', fill: COLORS.muted, 'data-kind': 'angle-label', 'data-id': 'DOB' }),
    text(O.x - 46, O.y + 46, 'O', { class: 'ig-small-label', 'data-kind': 'point-label', 'data-id': 'O' }),
    text(A.x + 38, A.y + 28, 'A', { class: 'ig-small-label', 'data-kind': 'point-label', 'data-id': 'A' }),
    text(B.x + 34, B.y - 34, 'B', { class: 'ig-small-label', 'data-kind': 'point-label', 'data-id': 'B' })
  ].join('');
}

function createStaticServer() {
  const server = http.createServer((req, res) => {
    try {
      const parsed = new URL(req.url || '/', 'http://127.0.0.1');
      if (parsed.pathname.startsWith('/__learn-preview__/')) {
        const id = parsed.pathname.split('/').filter(Boolean).at(1);
        const preview = PREVIEWS.find((item) => item.id === id);
        if (!preview) {
          res.writeHead(404);
          res.end('Preview not found');
          return;
        }
        res.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store'
        });
        res.end(stageHtml(preview));
        return;
      }
      if (parsed.pathname.startsWith('/__learn-preview-frame__/')) {
        const parts = parsed.pathname.split('/').filter(Boolean);
        const preview = PREVIEWS.find((item) => item.id === parts[1]);
        const member = parts[2];
        if (!preview || !['first', 'second'].includes(member)) {
          res.writeHead(404);
          res.end('Preview frame not found');
          return;
        }
        res.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store'
        });
        res.end(triangleToolFrameHtml(preview, member));
        return;
      }

      let pathname = decodeURIComponent(parsed.pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const requested = path.normalize(path.join(root, pathname));
      if (!requested.startsWith(root + path.sep)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      if (!fs.existsSync(requested) || !fs.statSync(requested).isFile()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, {
        'content-type': MIME_TYPES.get(path.extname(requested).toLowerCase()) || 'application/octet-stream',
        'cache-control': 'no-store'
      });
      fs.createReadStream(requested).pipe(res);
    } catch (error) {
      if (res.headersSent) {
        res.end();
        return;
      }
      res.writeHead(500);
      res.end(String(error && error.stack ? error.stack : error));
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function getBrowserLaunchOptions() {
  const options = { headless: true };
  const executablePath = process.env.PLAYWRIGHT_CHROME_EXECUTABLE
    || [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    ].find((candidate) => fs.existsSync(candidate));
  if (executablePath) options.executablePath = executablePath;
  return options;
}

async function importPlaywright() {
  try {
    return await import('playwright');
  } catch (error) {
    throw new Error('Playwright is required. Run: npm install', { cause: error });
  }
}

async function capturePreview(page, baseUrl, preview) {
  await page.goto(`${baseUrl}/__learn-preview__/${preview.id}/`, {
    waitUntil: 'domcontentloaded',
    timeout: PAGE_TIMEOUT_MS
  });
  const stage = page.locator('#stage');
  try {
    await stage.waitFor({ state: 'visible', timeout: PAGE_TIMEOUT_MS });
  } catch (error) {
    throw new Error(`Preview stage did not become visible: ${preview.id}`, { cause: error });
  }
  if (preview.source === 'figure-model-triangle-mobile'
    || preview.source === 'figure-model-triangle-mobile-pair'
    || preview.source === 'figure-model-conic-mobile'
    || preview.source === 'figure-model-solid-direct'
    || preview.source === 'draw-polygon-regular-mobile'
    || preview.source === 'draw-line-angle-relations'
    || preview.source === 'function-complex-mobile') {
    try {
      await page.waitForFunction(() => document.documentElement.dataset.previewReady === 'true', { timeout: PAGE_TIMEOUT_MS });
    } catch (error) {
      throw new Error(`Preview did not become ready: ${preview.id}`, { cause: error });
    }
  }
  const childCount = await stage.locator('*').count();
  if (childCount === 0) {
    throw new Error(`Stage did not render any children: ${preview.id}`);
  }

  const outputPath = path.join(outputDir, preview.outputFile);
  await stage.screenshot({
    path: outputPath,
    type: 'png'
  });
  const box = await stage.boundingBox();
  return {
    id: preview.id,
    outputFile: path.relative(root, outputPath),
    cssWidth: box ? Math.round(box.width) : null,
    cssHeight: box ? Math.round(box.height) : null,
    pixelWidth: box ? Math.round(box.width * DEVICE_SCALE_FACTOR) : null,
    pixelHeight: box ? Math.round(box.height * DEVICE_SCALE_FACTOR) : null,
    childCount
  };
}

fs.mkdirSync(outputDir, { recursive: true });

const server = await createStaticServer();
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;
const playwright = await importPlaywright();
const browser = await playwright.chromium.launch(getBrowserLaunchOptions());

const results = [];
try {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR
  });
  const page = await context.newPage();
  for (const preview of PREVIEWS) {
    results.push(await capturePreview(page, baseUrl, preview));
  }
  await context.close();
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify({
  source: 'learn-preview-mixed',
  deviceScaleFactor: DEVICE_SCALE_FACTOR,
  viewport: VIEWPORT,
  generated: results
}, null, 2));
