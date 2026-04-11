(function () {
  'use strict';

  const config = window.drawSimplePageConfig;
  const mount = document.getElementById('drawSimplePage');
  if (!config || !mount) return;

  const textTranslations = {
    en: {
      'トップ': 'Home',
      '図形を描く': 'Draw Shapes',
      '入力と表示': 'Input and Display',
      '入力項目': 'Inputs',
      '表示するもの': 'What to Show',
      '表示画面': 'Preview',
      '段階': 'Stage',
      '状態': 'Status',
      '設計方針': 'Design',
      '入力条件': 'Input',
      '表示方針': 'Display',
      '次の実装': 'Next Step',
      '図形種別': 'Shape',
      '入力軸': 'Input Basis',
      '半径': 'Radius',
      '直径': 'Diameter',
      '円周': 'Circumference',
      '長半径': 'Major Radius',
      '短半径': 'Minor Radius',
      '回転角': 'Rotation',
      '頂点数': 'Vertices',
      '一辺': 'Side',
      '長い対角線': 'Long Diagonal',
      '短い対角線': 'Short Diagonal',
      '上底': 'Top Base',
      '下底': 'Bottom Base',
      '高さ': 'Height',
      '円': 'Circle',
      '楕円': 'Ellipse',
      '星型': 'Star',
      '正方形': 'Square',
      '長方形': 'Rectangle',
      '菱形': 'Rhombus',
      '台形': 'Trapezoid',
      '正N角形': 'Regular Polygon',
      '三角形（SAS）': 'Triangle (SAS)',
      '三角形（ASA）': 'Triangle (ASA)',
      '三角形（AAS）': 'Triangle (AAS)',
      '三角形（AAA）': 'Triangle (AAA)',
      '三角形（3点座標）': 'Triangle (3 Points)',
      '三角形（底辺＋高さ）': 'Triangle (Base + Height)',
      '辺 1': 'Side 1',
      '辺 2': 'Side 2',
      'その間の角': 'Included Angle',
      '基準となる辺': 'Base Side',
      '左側の角': 'Left Angle',
      '右側の角': 'Right Angle',
      '与えられた辺': 'Given Side',
      '角 1': 'Angle 1',
      '角 2': 'Angle 2',
      '角 A': 'Angle A',
      '角 B': 'Angle B',
      '角 C': 'Angle C',
      'A (x, y)': 'A (x, y)',
      'B (x, y)': 'B (x, y)',
      'C (x, y)': 'C (x, y)',
      '底辺': 'Base',
      '足の位置': 'Foot Position',
      '中心': 'Center',
      '横': 'Width',
      '縦': 'Height',
      '外半径': 'Outer Radius',
      '内半径': 'Inner Radius',
      '角を表示': 'Show Angles',
      '頂点を表示': 'Show Vertices',
      '辺の長さを表示': 'Show Side Lengths',
      '対角線を表示': 'Show Diagonals',
      '高さを表示': 'Show Height',
      '中心を表示': 'Show Center',
      '半径を表示': 'Show Radius',
      '円周上の点を表示': 'Show Point on Circle',
      '長半径を表示': 'Show Major Radius',
      '短半径を表示': 'Show Minor Radius',
      '各角の値を表示します。': 'Display each angle value.',
      '頂点ラベルを外側に表示します。': 'Display vertex labels outside the figure.',
      '求まった辺長を弧付きで表示します。': 'Display computed side lengths with arc labels.',
      '3つの角を表示します。': 'Display all three angles.',
      'A, B, C のラベルを表示します。': 'Display labels A, B, and C.',
      '相似形の基準辺を表示します。': 'Display the reference side for the similar triangle.',
      '各角度を表示します。': 'Display each angle.',
      'A, B, C と座標を表示します。': 'Display A, B, C and their coordinates.',
      '辺の長さを表示します。': 'Display side lengths.',
      '三角形の角を表示します。': 'Display the triangle angles.',
      '頂点ラベルを表示します。': 'Display vertex labels.',
      '高さ線と高さラベルを表示します。': 'Display the altitude and its label.',
      '4頂点を表示します。': 'Display the four vertices.',
      '各辺の長さを表示します。': 'Display all side lengths.',
      '補助線として対角線を表示します。': 'Display diagonals as helper lines.',
      '対角線を表示します。': 'Display the diagonals.',
      '上底・下底・斜辺を表示します。': 'Display the top base, bottom base, and legs.',
      '中心点 O を表示します。': 'Display center point O.',
      '半径ラベルを表示します。': 'Display the radius label.',
      '基準点を表示します。': 'Display a reference point on the circle.',
      '中心 O を表示します。': 'Display center O.',
      '長半径ラベルを表示します。': 'Display the major radius label.',
      '短半径ラベルを表示します。': 'Display the minor radius label.',
      '頂点を表示します。': 'Display the vertices.',
      '中心点を表示します。': 'Display the center point.',
      '仮ページ': 'Draft Page',
      '正方形': 'Square',
      '長方形': 'Rectangle',
      '菱形': 'Rhombus',
      '台形': 'Trapezoid',
      '正N角形': 'Regular Polygon',
      '現在は仮作成のため、画面構成と導線を優先して整えています。': 'This page is still a draft, so the layout and navigation have been prioritized.',
      '条件から三角形を描画しました。': 'Triangle rendered from the given conditions.',
      '条件から四角形を描画しました。': 'Quadrilateral rendered from the given conditions.',
      '正N角形を描画しました。': 'Regular polygon rendered.',
      '円を描画しました。': 'Circle rendered.',
      '楕円を描画しました。': 'Ellipse rendered.',
      '星型を描画しました。': 'Star rendered.'
    },
    zh: {
      'トップ': '首页',
      '図形を描く': '绘制图形',
      '入力と表示': '输入与显示',
      '入力項目': '输入项',
      '表示するもの': '显示内容',
      '表示画面': '预览',
      '段階': '阶段',
      '状態': '状态',
      '設計方針': '设计方向',
      '入力条件': '输入条件',
      '表示方針': '显示方式',
      '次の実装': '下一步',
      '図形種別': '图形类型',
      '入力軸': '输入基础',
      '半径': '半径',
      '直径': '直径',
      '円周': '周长',
      '長半径': '长半轴',
      '短半径': '短半轴',
      '回転角': '旋转角',
      '頂点数': '顶点数',
      '一辺': '边长',
      '長い対角線': '长对角线',
      '短い対角線': '短对角线',
      '上底': '上底',
      '下底': '下底',
      '高さ': '高度',
      '円': '圆',
      '楕円': '椭圆',
      '星型': '星形',
      '正方形': '正方形',
      '長方形': '长方形',
      '菱形': '菱形',
      '台形': '梯形',
      '正N角形': '正N边形',
      '三角形（SAS）': '三角形（SAS）',
      '三角形（ASA）': '三角形（ASA）',
      '三角形（AAS）': '三角形（AAS）',
      '三角形（AAA）': '三角形（AAA）',
      '三角形（3点座標）': '三角形（3点坐标）',
      '三角形（底辺＋高さ）': '三角形（底边+高度）',
      '辺 1': '边 1',
      '辺 2': '边 2',
      'その間の角': '夹角',
      '基準となる辺': '基准边',
      '左側の角': '左侧角',
      '右側の角': '右侧角',
      '与えられた辺': '已知边',
      '角 1': '角 1',
      '角 2': '角 2',
      '角 A': '角 A',
      '角 B': '角 B',
      '角 C': '角 C',
      'A (x, y)': 'A (x, y)',
      'B (x, y)': 'B (x, y)',
      'C (x, y)': 'C (x, y)',
      '底辺': '底边',
      '足の位置': '垂足位置',
      '中心': '中心',
      '横': '宽',
      '縦': '高',
      '外半径': '外半径',
      '内半径': '内半径',
      '角を表示': '显示角',
      '頂点を表示': '显示顶点',
      '辺の長さを表示': '显示边长',
      '対角線を表示': '显示对角线',
      '高さを表示': '显示高度',
      '中心を表示': '显示中心',
      '半径を表示': '显示半径',
      '円周上の点を表示': '显示圆周点',
      '長半径を表示': '显示长半轴',
      '短半径を表示': '显示短半轴',
      '各角の値を表示します。': '显示各个角的数值。',
      '頂点ラベルを外側に表示します。': '将顶点标签显示在图形外侧。',
      '求まった辺長を弧付きで表示します。': '用弧线标签显示求得的边长。',
      '3つの角を表示します。': '显示三个角。',
      'A, B, C のラベルを表示します。': '显示 A、B、C 标签。',
      '相似形の基準辺を表示します。': '显示相似图形的基准边。',
      '各角度を表示します。': '显示各角度。',
      'A, B, C と座標を表示します。': '显示 A、B、C 及坐标。',
      '辺の長さを表示します。': '显示边长。',
      '三角形の角を表示します。': '显示三角形角度。',
      '頂点ラベルを表示します。': '显示顶点标签。',
      '高さ線と高さラベルを表示します。': '显示高线和高度标签。',
      '4頂点を表示します。': '显示四个顶点。',
      '各辺の長さを表示します。': '显示各边长度。',
      '補助線として対角線を表示します。': '将对角线作为辅助线显示。',
      '対角線を表示します。': '显示对角线。',
      '上底・下底・斜辺を表示します。': '显示上底、下底和斜边。',
      '中心点 O を表示します。': '显示中心点 O。',
      '半径ラベルを表示します。': '显示半径标签。',
      '基準点を表示します。': '显示参考点。',
      '中心 O を表示します。': '显示中心 O。',
      '長半径ラベルを表示します。': '显示长半轴标签。',
      '短半径ラベルを表示します。': '显示短半轴标签。',
      '頂点を表示します。': '显示顶点。',
      '中心点を表示します。': '显示中心点。',
      '仮ページ': '草稿页面',
      '現在は仮作成のため、画面構成と導線を優先して整えています。': '当前仍为草稿页面，因此优先整理了页面结构和入口。',
      '条件から三角形を描画しました。': '已根据条件绘制三角形。',
      '条件から四角形を描画しました。': '已根据条件绘制四边形。',
      '正N角形を描画しました。': '已绘制正N边形。',
      '円を描画しました。': '已绘制圆。',
      '楕円を描画しました。': '已绘制椭圆。',
      '星型を描画しました。': '已绘制星形。'
    },
    es: {
      'トップ': 'Inicio',
      '図形を描く': 'Dibujar figuras',
      '入力と表示': 'Entrada y visualización',
      '入力項目': 'Campos de entrada',
      '表示するもの': 'Qué mostrar',
      '表示画面': 'Vista previa',
      '段階': 'Etapa',
      '状態': 'Estado',
      '設計方針': 'Diseño',
      '入力条件': 'Entrada',
      '表示方針': 'Visualización',
      '次の実装': 'Siguiente paso',
      '図形種別': 'Figura',
      '入力軸': 'Base de entrada',
      '半径': 'Radio',
      '直径': 'Diámetro',
      '円周': 'Circunferencia',
      '長半径': 'Semieje mayor',
      '短半径': 'Semieje menor',
      '回転角': 'Rotación',
      '頂点数': 'Vértices',
      '一辺': 'Lado',
      '長い対角線': 'Diagonal mayor',
      '短い対角線': 'Diagonal menor',
      '上底': 'Base superior',
      '下底': 'Base inferior',
      '高さ': 'Altura',
      '円': 'Círculo',
      '楕円': 'Elipse',
      '星型': 'Estrella',
      '正方形': 'Cuadrado',
      '長方形': 'Rectángulo',
      '菱形': 'Rombo',
      '台形': 'Trapecio',
      '正N角形': 'Polígono regular',
      '三角形（SAS）': 'Triángulo (SAS)',
      '三角形（ASA）': 'Triángulo (ASA)',
      '三角形（AAS）': 'Triángulo (AAS)',
      '三角形（AAA）': 'Triángulo (AAA)',
      '三角形（3点座標）': 'Triángulo (3 puntos)',
      '三角形（底辺＋高さ）': 'Triángulo (base + altura)',
      '辺 1': 'Lado 1',
      '辺 2': 'Lado 2',
      'その間の角': 'Ángulo incluido',
      '基準となる辺': 'Lado base',
      '左側の角': 'Ángulo izquierdo',
      '右側の角': 'Ángulo derecho',
      '与えられた辺': 'Lado dado',
      '角 1': 'Ángulo 1',
      '角 2': 'Ángulo 2',
      '角 A': 'Ángulo A',
      '角 B': 'Ángulo B',
      '角 C': 'Ángulo C',
      'A (x, y)': 'A (x, y)',
      'B (x, y)': 'B (x, y)',
      'C (x, y)': 'C (x, y)',
      '底辺': 'Base',
      '足の位置': 'Posición del pie',
      '中心': 'Centro',
      '横': 'Ancho',
      '縦': 'Alto',
      '外半径': 'Radio exterior',
      '内半径': 'Radio interior',
      '角を表示': 'Mostrar ángulos',
      '頂点を表示': 'Mostrar vértices',
      '辺の長さを表示': 'Mostrar longitudes',
      '対角線を表示': 'Mostrar diagonales',
      '高さを表示': 'Mostrar altura',
      '中心を表示': 'Mostrar centro',
      '半径を表示': 'Mostrar radio',
      '円周上の点を表示': 'Mostrar punto de la circunferencia',
      '長半径を表示': 'Mostrar semieje mayor',
      '短半径を表示': 'Mostrar semieje menor',
      '各角の値を表示します。': 'Muestra el valor de cada ángulo.',
      '頂点ラベルを外側に表示します。': 'Muestra las etiquetas de los vértices por fuera.',
      '求まった辺長を弧付きで表示します。': 'Muestra las longitudes calculadas con etiquetas en arco.',
      '3つの角を表示します。': 'Muestra los tres ángulos.',
      'A, B, C のラベルを表示します。': 'Muestra las etiquetas A, B y C.',
      '相似形の基準辺を表示します。': 'Muestra el lado base de la figura semejante.',
      '各角度を表示します。': 'Muestra cada ángulo.',
      'A, B, C と座標を表示します。': 'Muestra A, B, C y sus coordenadas.',
      '辺の長さを表示します。': 'Muestra las longitudes.',
      '三角形の角を表示します。': 'Muestra los ángulos del triángulo.',
      '頂点ラベルを表示します。': 'Muestra las etiquetas de los vértices.',
      '高さ線と高さラベルを表示します。': 'Muestra la altura y su etiqueta.',
      '4頂点を表示します。': 'Muestra los cuatro vértices.',
      '各辺の長さを表示します。': 'Muestra la longitud de cada lado.',
      '補助線として対角線を表示します。': 'Muestra las diagonales como líneas auxiliares.',
      '対角線を表示します。': 'Muestra las diagonales.',
      '上底・下底・斜辺を表示します。': 'Muestra la base superior, la base inferior y los lados oblicuos.',
      '中心点 O を表示します。': 'Muestra el punto central O.',
      '半径ラベルを表示します。': 'Muestra la etiqueta del radio.',
      '基準点を表示します。': 'Muestra un punto de referencia.',
      '中心 O を表示します。': 'Muestra el centro O.',
      '長半径ラベルを表示します。': 'Muestra la etiqueta del semieje mayor.',
      '短半径ラベルを表示します。': 'Muestra la etiqueta del semieje menor.',
      '頂点を表示します。': 'Muestra los vértices.',
      '中心点を表示します。': 'Muestra el punto central.',
      '仮ページ': 'Página provisional',
      '現在は仮作成のため、画面構成と導線を優先して整えています。': 'La página sigue siendo provisional, así que se priorizó la estructura y la navegación.',
      '条件から三角形を描画しました。': 'Se dibujó el triángulo a partir de las condiciones dadas.',
      '条件から四角形を描画しました。': 'Se dibujó el cuadrilátero a partir de las condiciones dadas.',
      '正N角形を描画しました。': 'Se dibujó el polígono regular.',
      '円を描画しました。': 'Se dibujó el círculo.',
      '楕円を描画しました。': 'Se dibujó la elipse.',
      '星型を描画しました。': 'Se dibujó la estrella.'
    }
  };

  function getLang() {
    if (window.siteI18n && typeof window.siteI18n.getLanguage === 'function') {
      return window.siteI18n.getLanguage();
    }
    return document.documentElement.lang || 'ja';
  }

  function tt(text) {
    const lang = getLang();
    const dict = textTranslations[lang];
    if (!dict) return text;
    return dict[text] || text;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatNumber(value) {
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  }

  function toDegrees(rad) {
    return rad * 180 / Math.PI;
  }

  function degToRad(deg) {
    return deg * Math.PI / 180;
  }

  function normalizeExpression(source) {
    return String(source || '')
      .replace(/\s+/g, '')
      .replace(/π/g, 'pi')
      .replace(/√/g, 'sqrt')
      .replace(/(\d+(?:\.\d+)?)deg\b/gi, 'deg($1)');
  }

  function formatExpressionLabel(source) {
    const trimmed = String(source || '').replace(/\s+/g, '');
    if (!trimmed) return '';

    return trimmed
      .replace(/pi/gi, 'π')
      .replace(/([0-9.]+)deg\b/gi, '$1°')
      .replace(/deg\(([^)]+)\)/gi, '$1°')
      .replace(/sqrt\(([^()]+)\)/gi, '√($1)')
      .replace(/√\(([^()]+)\)/g, function (_, inner) {
        return /^[a-zA-Z0-9.+\-/*π]+$/.test(inner) ? '√' + inner : '√(' + inner + ')';
      });
  }

  function evaluateExpression(source, name) {
    const normalized = normalizeExpression(source);
    if (!normalized) throw new Error(name + ' を入力してください。');
    if (!/^[0-9+\-*/().,a-zA-Z]+$/.test(normalized)) {
      throw new Error(name + ' に使用できない文字が含まれています。');
    }

    const scope = {
      pi: Math.PI,
      e: Math.E,
      sqrt: Math.sqrt,
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      asin: Math.asin,
      acos: Math.acos,
      atan: Math.atan,
      deg: function (value) { return value * Math.PI / 180; }
    };

    let value;
    try {
      value = Function(
        'scope',
        '"use strict"; const { pi, e, sqrt, sin, cos, tan, asin, acos, atan, deg } = scope; return (' + normalized + ');'
      )(scope);
    } catch (error) {
      throw new Error(name + ' の式を読み取れませんでした。');
    }

    if (!Number.isFinite(value)) throw new Error(name + ' が数値になりませんでした。');

    return {
      value: value,
      label: formatExpressionLabel(source || normalized)
    };
  }

  function evaluatePositive(source, name) {
    const result = evaluateExpression(source, name);
    if (result.value <= 0) throw new Error(name + ' は 0 より大きい値を入力してください。');
    return result;
  }

  function parsePoint(source, name) {
    const text = String(source || '').trim();
    const match = text.match(/^\(?\s*([^,]+)\s*,\s*([^)]+)\s*\)?$/);
    if (!match) throw new Error(name + ' は (x, y) の形で入力してください。');
    const x = evaluateExpression(match[1], name + ' の x').value;
    const y = evaluateExpression(match[2], name + ' の y').value;
    return { x: x, y: y, label: '(' + formatNumber(x) + ', ' + formatNumber(y) + ')' };
  }

  function distance(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  function centroid(points) {
    const sum = points.reduce(function (acc, point) {
      return { x: acc.x + point.x, y: acc.y + point.y };
    }, { x: 0, y: 0 });
    return { x: sum.x / points.length, y: sum.y / points.length };
  }

  function triangleAngles(A, B, C) {
    const a = distance(B, C);
    const b = distance(C, A);
    const c = distance(A, B);
    return {
      A: toDegrees(Math.acos(Math.max(-1, Math.min(1, (b * b + c * c - a * a) / (2 * b * c))))),
      B: toDegrees(Math.acos(Math.max(-1, Math.min(1, (a * a + c * c - b * b) / (2 * a * c)))))
    };
  }

  function makeBoundingBox(points, paddingRatio) {
    const xs = points.map(function (point) { return point.x; });
    const ys = points.map(function (point) { return point.y; });
    const minX = Math.min.apply(null, xs);
    const maxX = Math.max.apply(null, xs);
    const minY = Math.min.apply(null, ys);
    const maxY = Math.max.apply(null, ys);
    const width = Math.max(maxX - minX, 1);
    const height = Math.max(maxY - minY, 1);
    const padding = Math.max(width, height) * (paddingRatio || 0.22);
    return {
      minX: minX - padding,
      maxX: maxX + padding,
      minY: minY - padding,
      maxY: maxY + padding
    };
  }

  function createProjector(points) {
    const box = makeBoundingBox(points, 0.24);
    const viewWidth = 720;
    const viewHeight = 480;
    const width = Math.max(box.maxX - box.minX, 1);
    const height = Math.max(box.maxY - box.minY, 1);
    const scale = Math.min((viewWidth - 80) / width, (viewHeight - 80) / height);
    const offsetX = (viewWidth - width * scale) / 2;
    const offsetY = (viewHeight - height * scale) / 2;

    return function (point) {
      return {
        x: offsetX + (point.x - box.minX) * scale,
        y: viewHeight - (offsetY + (point.y - box.minY) * scale)
      };
    };
  }

  function linePath(points, projector) {
    return points.map(function (point, index) {
      const p = projector(point);
      return (index === 0 ? 'M' : 'L') + p.x + ' ' + p.y;
    }).join(' ') + ' Z';
  }

  function outwardLabelPoint(point, center, projector, distancePx) {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const len = Math.hypot(dx, dy) || 1;
    const screenPoint = projector(point);
    return {
      x: screenPoint.x + dx / len * distancePx,
      y: screenPoint.y - dy / len * distancePx
    };
  }

  function midLabelPoint(a, b, center, projector, offsetPx) {
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const edgeDx = b.x - a.x;
    const edgeDy = b.y - a.y;
    let nx = -edgeDy;
    let ny = edgeDx;
    const toCenterX = center.x - mid.x;
    const toCenterY = center.y - mid.y;
    if (nx * toCenterX + ny * toCenterY > 0) {
      nx *= -1;
      ny *= -1;
    }
    const len = Math.hypot(nx, ny) || 1;
    const screenMid = projector(mid);
    return {
      x: screenMid.x + nx / len * offsetPx,
      y: screenMid.y - ny / len * offsetPx
    };
  }

  function angleLabelPoint(vertex, prev, next, projector, distancePx) {
    const v1 = { x: prev.x - vertex.x, y: prev.y - vertex.y };
    const v2 = { x: next.x - vertex.x, y: next.y - vertex.y };
    const l1 = Math.hypot(v1.x, v1.y) || 1;
    const l2 = Math.hypot(v2.x, v2.y) || 1;
    const dir = {
      x: v1.x / l1 + v2.x / l2,
      y: v1.y / l1 + v2.y / l2
    };
    const len = Math.hypot(dir.x, dir.y) || 1;
    const screenVertex = projector(vertex);
    return {
      x: screenVertex.x + dir.x / len * distancePx,
      y: screenVertex.y - dir.y / len * distancePx
    };
  }

  function renderPolygonSvg(points, options) {
    const projector = createProjector(points);
    const center = centroid(points);
    const projected = points.map(projector);
    const names = options.names || [];
    const sideTexts = options.sideTexts || [];
    const angleTexts = options.angleTexts || [];
    let markup = '<svg viewBox="0 0 720 480" aria-hidden="true">' +
      '<rect width="720" height="480" fill="#fbfcff"/>' +
      '<path d="' + linePath(points, projector) + '" fill="rgba(42,91,215,.10)" stroke="#2a5bd7" stroke-width="4"/>';

    if (options.extraLines) {
      options.extraLines.forEach(function (line) {
        const p1 = projector(line.a);
        const p2 = projector(line.b);
        markup += '<line x1="' + p1.x + '" y1="' + p1.y + '" x2="' + p2.x + '" y2="' + p2.y + '" stroke="' + (line.color || '#7d8db8') + '" stroke-width="' + (line.width || 3) + '" ' + (line.dash ? 'stroke-dasharray="' + line.dash + '"' : '') + '/>';
      });
    }

    projected.forEach(function (point) {
      markup += '<circle cx="' + point.x + '" cy="' + point.y + '" r="4.5" fill="#111111"/>';
    });

    if (options.showVertices) {
      points.forEach(function (point, index) {
        const pos = outwardLabelPoint(point, center, projector, 22);
        markup += '<text x="' + pos.x + '" y="' + pos.y + '" font-size="18" fill="#111111" font-family="sans-serif">' + escapeHtml(names[index] || String.fromCharCode(65 + index)) + '</text>';
      });
    }

    if (options.showLengths) {
      points.forEach(function (point, index) {
        const next = points[(index + 1) % points.length];
        const pos = midLabelPoint(point, next, center, projector, 24);
        markup += '<text x="' + pos.x + '" y="' + pos.y + '" font-size="16" fill="#2a5bd7" text-anchor="middle" font-family="sans-serif">' + escapeHtml(sideTexts[index] || formatNumber(distance(point, next))) + '</text>';
      });
    }

    if (options.showAngles && angleTexts.length) {
      points.forEach(function (point, index) {
        const prev = points[(index - 1 + points.length) % points.length];
        const next = points[(index + 1) % points.length];
        const pos = angleLabelPoint(point, prev, next, projector, 30);
        markup += '<text x="' + pos.x + '" y="' + pos.y + '" font-size="15" fill="#687086" text-anchor="middle" font-family="sans-serif">' + escapeHtml(angleTexts[index]) + '</text>';
      });
    }

    markup += '</svg>';
    return markup;
  }

  function getRendererTypeFromPath() {
    const path = window.location.pathname;
    if (path.indexOf('/draw/triangle/sas/') === 0) return 'triangle-sas';
    if (path.indexOf('/draw/triangle/asa/') === 0) return 'triangle-asa';
    if (path.indexOf('/draw/triangle/aas/') === 0) return 'triangle-aas';
    if (path.indexOf('/draw/triangle/aaa/') === 0) return 'triangle-aaa';
    if (path.indexOf('/draw/triangle/points/') === 0) return 'triangle-points';
    if (path.indexOf('/draw/triangle/base-height/') === 0) return 'triangle-base-height';
    if (path.indexOf('/draw/quadrilateral/square/') === 0) return 'quadrilateral-square';
    if (path.indexOf('/draw/quadrilateral/rectangle/') === 0) return 'quadrilateral-rectangle';
    if (path.indexOf('/draw/quadrilateral/rhombus/') === 0) return 'quadrilateral-rhombus';
    if (path.indexOf('/draw/quadrilateral/trapezoid/') === 0) return 'quadrilateral-trapezoid';
    if (path.indexOf('/draw/regular-polygon/') === 0) return 'regular-polygon';
    if (path.indexOf('/draw/circle/') === 0) return 'circle';
    if (path.indexOf('/draw/ellipse/') === 0) return 'ellipse';
    if (path.indexOf('/draw/star/') === 0) return 'star';
    return 'unknown';
  }

  function resolveRendererType() {
    const explicit = config && typeof config.rendererType === 'string' ? config.rendererType.trim() : '';
    if (explicit) return explicit;
    return getRendererTypeFromPath();
  }

  function currentToggleValues(toggleInputs) {
    return toggleInputs.map(function (input) { return input.checked; });
  }

  function triangleRenderResult(points, labels, toggles, extraLines, sideTexts) {
    const anglesObj = triangleAngles(points[0], points[1], points[2]);
    const angleTexts = [anglesObj.A, anglesObj.B, 180 - anglesObj.A - anglesObj.B].map(function (value) {
      return formatNumber(value) + '°';
    });

    return {
      svg: renderPolygonSvg(points, {
        names: ['A', 'B', 'C'],
        sideTexts: sideTexts,
        angleTexts: angleTexts,
        showAngles: toggles[0],
        showVertices: toggles[1],
        showLengths: toggles[2],
        extraLines: extraLines
      }),
      notes: [
        { label: labels[0], value: angleTexts[0] },
        { label: labels[1], value: angleTexts[1] },
        { label: labels[2], value: angleTexts[2] }
      ],
      status: tt('条件から三角形を描画しました。')
    };
  }

  function renderTriangleSAS(values, toggles) {
    const side1 = evaluatePositive(values[0], tt('辺 1'));
    const side2 = evaluatePositive(values[1], tt('辺 2'));
    const angle = evaluatePositive(values[2], tt('その間の角'));
    if (angle.value >= 180) throw new Error(tt('その間の角') + 'は 180° 未満で入力してください。');
    const A = { x: 0, y: 0 };
    const B = { x: side1.value, y: 0 };
    const C = { x: side2.value * Math.cos(degToRad(angle.value)), y: side2.value * Math.sin(degToRad(angle.value)) };
    return triangleRenderResult([A, B, C], [tt('角 A'), tt('角 B'), tt('角 C')], toggles, null, [side1.label || formatNumber(side1.value), formatNumber(distance(B, C)), side2.label || formatNumber(side2.value)]);
  }

  function renderTriangleASA(values, toggles) {
    const base = evaluatePositive(values[0], tt('基準となる辺'));
    const angleA = evaluatePositive(values[1], tt('左側の角'));
    const angleB = evaluatePositive(values[2], tt('右側の角'));
    if (angleA.value + angleB.value >= 180) throw new Error('2つの角の和は 180° 未満で入力してください。');
    const A = { x: 0, y: 0 };
    const B = { x: base.value, y: 0 };
    const slopeA = Math.tan(degToRad(angleA.value));
    const slopeB = Math.tan(degToRad(180 - angleB.value));
    const x = (slopeB * base.value) / (slopeB - slopeA);
    const y = slopeA * x;
    const C = { x: x, y: y };
    return triangleRenderResult([A, B, C], [tt('角 A'), tt('角 B'), tt('角 C')], toggles, null, [base.label || formatNumber(base.value), formatNumber(distance(B, C)), formatNumber(distance(C, A))]);
  }

  function renderTriangleAAS(values, toggles) {
    const side = evaluatePositive(values[0], tt('与えられた辺'));
    const angleA = evaluatePositive(values[1], tt('角 1'));
    const angleC = evaluatePositive(values[2], tt('角 2'));
    const angleB = 180 - angleA.value - angleC.value;
    if (angleB <= 0) throw new Error('角の条件が三角形になりません。');
    const A = { x: 0, y: 0 };
    const B = { x: side.value, y: 0 };
    const slopeA = Math.tan(degToRad(angleA.value));
    const slopeB = Math.tan(degToRad(180 - angleB));
    const x = (slopeB * side.value) / (slopeB - slopeA);
    const y = slopeA * x;
    const C = { x: x, y: y };
    return triangleRenderResult([A, B, C], [tt('角 A'), tt('角 B'), tt('角 C')], toggles, null, [side.label || formatNumber(side.value), formatNumber(distance(B, C)), formatNumber(distance(C, A))]);
  }

  function renderTriangleAAA(values, toggles) {
    const angleA = evaluatePositive(values[0], tt('角 A'));
    const angleB = evaluatePositive(values[1], tt('角 B'));
    const angleC = evaluatePositive(values[2], tt('角 C'));
    const sum = angleA.value + angleB.value + angleC.value;
    if (Math.abs(sum - 180) > 0.01) throw new Error('3つの角の和が 180° になるように入力してください。');
    const base = 8;
    const A = { x: 0, y: 0 };
    const B = { x: base, y: 0 };
    const slopeA = Math.tan(degToRad(angleA.value));
    const slopeB = Math.tan(degToRad(180 - angleB.value));
    const x = (slopeB * base) / (slopeB - slopeA);
    const y = slopeA * x;
    const C = { x: x, y: y };
    return triangleRenderResult([A, B, C], [tt('角 A'), tt('角 B'), tt('角 C')], toggles, null, [formatNumber(base), formatNumber(distance(B, C)), formatNumber(distance(C, A))]);
  }

  function renderTrianglePoints(values, toggles) {
    const A = parsePoint(values[0], 'A');
    const B = parsePoint(values[1], 'B');
    const C = parsePoint(values[2], 'C');
    const area2 = Math.abs((B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x));
    if (area2 < 1e-9) throw new Error('3点が一直線上にあります。');
    return triangleRenderResult([A, B, C], [tt('角 A'), tt('角 B'), tt('角 C')], toggles, null, [formatNumber(distance(A, B)), formatNumber(distance(B, C)), formatNumber(distance(C, A))]);
  }

  function renderTriangleBaseHeight(values, toggles) {
    const base = evaluatePositive(values[0], tt('底辺'));
    const height = evaluatePositive(values[1], tt('高さ'));
    const foot = evaluateExpression(values[2], tt('足の位置'));
    const A = { x: 0, y: 0 };
    const B = { x: base.value, y: 0 };
    const C = { x: foot.value, y: height.value };
    const extras = toggles[2] ? [{ a: C, b: { x: foot.value, y: 0 }, dash: '8 6' }] : [];
    return triangleRenderResult([A, B, C], [tt('角 A'), tt('角 B'), tt('角 C')], [toggles[0], toggles[1], true], extras, [base.label || formatNumber(base.value), formatNumber(distance(B, C)), formatNumber(distance(C, A))]);
  }

  function renderQuadrilateral(points, toggles, notes) {
    const sideTexts = points.map(function (point, index) {
      return formatNumber(distance(point, points[(index + 1) % points.length]));
    });
    return {
      svg: renderPolygonSvg(points, {
        names: ['A', 'B', 'C', 'D'],
        sideTexts: sideTexts,
        showAngles: false,
        showVertices: toggles[0],
        showLengths: toggles[1],
        extraLines: toggles[2] ? [{ a: points[0], b: points[2], dash: '8 6' }, { a: points[1], b: points[3], dash: '8 6' }] : null
      }),
      notes: notes,
      status: tt('条件から四角形を描画しました。')
    };
  }

  function renderQuadrilateralSquare(values, toggles) {
    const side = evaluatePositive(values[0], tt('一辺'));
    const h = side.value / 2;
    const A = { x: -h, y: h };
    const B = { x: -h, y: -h };
    const C = { x: h, y: -h };
    const D = { x: h, y: h };
    const O = { x: 0, y: 0 };
    const points = [A, B, C, D];
    const projector = createProjector(points.concat([O]));
    const P = {
      A: projector(A),
      B: projector(B),
      C: projector(C),
      D: projector(D),
      O: projector(O)
    };

    function on(index) {
      return toggles[index] !== false;
    }

    function mid(p, q) {
      return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    }

    function withOffset(p, dx, dy) {
      return { x: p.x + dx, y: p.y + dy };
    }

    const labelColor = '#1f2430';
    const accent = '#2a5bd7';
    const angleColor = '#687086';
    let svg = '<svg viewBox="0 0 720 480" aria-hidden="true">' +
      '<rect width="720" height="480" fill="#fbfcff"/>' +
      '<path d="' + linePath(points, projector) + '" fill="rgba(42,91,215,.08)" stroke="#2a5bd7" stroke-width="4"/>';

    if (on(13)) {
      svg += '<line x1="' + P.A.x + '" y1="' + P.A.y + '" x2="' + P.C.x + '" y2="' + P.C.y + '" stroke="#7d8db8" stroke-width="2.5" stroke-dasharray="8 6"/>';
    }
    if (on(14)) {
      svg += '<line x1="' + P.B.x + '" y1="' + P.B.y + '" x2="' + P.D.x + '" y2="' + P.D.y + '" stroke="#7d8db8" stroke-width="2.5" stroke-dasharray="8 6"/>';
    }

    [P.A, P.B, P.C, P.D].forEach(function (point) {
      svg += '<circle cx="' + point.x + '" cy="' + point.y + '" r="4.5" fill="#111111"/>';
    });
    if (on(12)) {
      svg += '<circle cx="' + P.O.x + '" cy="' + P.O.y + '" r="4.5" fill="#111111"/>';
    }

    function drawText(point, text, color, size, anchor) {
      svg += '<text x="' + point.x + '" y="' + point.y + '" font-size="' + (size || 15) + '" fill="' + (color || labelColor) + '" text-anchor="' + (anchor || 'middle') + '" font-family="sans-serif">' + escapeHtml(text) + '</text>';
    }

    if (on(0)) drawText(withOffset(P.A, -14, -8), 'A', labelColor, 18, 'end');
    if (on(1)) drawText(withOffset(P.B, -14, 18), 'B', labelColor, 18, 'end');
    if (on(2)) drawText(withOffset(P.C, 14, 18), 'C', labelColor, 18, 'start');
    if (on(3)) drawText(withOffset(P.D, 14, -8), 'D', labelColor, 18, 'start');
    if (on(12)) drawText(withOffset(P.O, 10, -10), 'O', labelColor, 17, 'start');

    if (on(4)) drawText(withOffset(projector(mid(A, B)), -20, 4), 'a', accent, 16, 'end');
    if (on(5)) drawText(withOffset(projector(mid(B, C)), 0, 22), 'b', accent, 16, 'middle');
    if (on(6)) drawText(withOffset(projector(mid(C, D)), 20, 4), 'c', accent, 16, 'start');
    if (on(7)) drawText(withOffset(projector(mid(D, A)), 0, -14), 'd', accent, 16, 'middle');
    if (on(13)) drawText(withOffset(projector(mid(A, C)), 14, -10), 'AC', accent, 14, 'start');
    if (on(14)) drawText(withOffset(projector(mid(B, D)), -14, -10), 'BD', accent, 14, 'end');

    if (on(8)) drawText(withOffset(P.A, 20, 18), '∠A', angleColor, 15, 'start');
    if (on(9)) drawText(withOffset(P.B, 20, -12), '∠B', angleColor, 15, 'start');
    if (on(10)) drawText(withOffset(P.C, -20, -12), '∠C', angleColor, 15, 'end');
    if (on(11)) drawText(withOffset(P.D, -20, 18), '∠D', angleColor, 15, 'end');

    if (on(15)) drawText(withOffset(P.A, 32, 10), '∠DAC', angleColor, 13, 'start');
    if (on(16)) drawText(withOffset(P.A, 12, 30), '∠BAC', angleColor, 13, 'start');
    if (on(17)) drawText(withOffset(P.B, 12, -22), '∠ABD', angleColor, 13, 'start');
    if (on(18)) drawText(withOffset(P.B, 30, -6), '∠CBD', angleColor, 13, 'start');
    if (on(19)) drawText(withOffset(P.C, -30, -6), '∠BCA', angleColor, 13, 'end');
    if (on(20)) drawText(withOffset(P.C, -12, -22), '∠DCA', angleColor, 13, 'end');
    if (on(21)) drawText(withOffset(P.D, -12, 30), '∠CDB', angleColor, 13, 'end');
    if (on(22)) drawText(withOffset(P.D, -30, 10), '∠ADB', angleColor, 13, 'end');
    if (on(23)) drawText(withOffset(P.O, -26, -10), '∠AOB', angleColor, 13, 'end');
    if (on(24)) drawText(withOffset(P.O, -26, 18), '∠BOC', angleColor, 13, 'end');
    if (on(25)) drawText(withOffset(P.O, 26, 18), '∠COD', angleColor, 13, 'start');
    if (on(26)) drawText(withOffset(P.O, 26, -10), '∠DOA', angleColor, 13, 'start');

    svg += '</svg>';
    return {
      svg: svg,
      notes: [
        { label: tt('一辺'), value: side.label || formatNumber(side.value) },
        { label: 'AC = BD', value: formatNumber(side.value * Math.SQRT2) },
        { label: tt('状態'), value: tt('正方形') }
      ],
      status: tt('条件から四角形を描画しました。')
    };
  }

  function renderQuadrilateralRectangle(values, toggles) {
    const width = evaluatePositive(values[1], tt('横'));
    const height = evaluatePositive(values[2], tt('縦'));
    const hw = width.value / 2;
    const hh = height.value / 2;
    const points = [
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh }
    ];
    return renderQuadrilateral(points, toggles, [
      { label: tt('横'), value: width.label || formatNumber(width.value) },
      { label: tt('縦'), value: height.label || formatNumber(height.value) },
      { label: tt('状態'), value: tt('長方形') }
    ]);
  }

  function renderQuadrilateralRhombus(values, toggles) {
    const d1 = evaluatePositive(values[0], tt('長い対角線'));
    const d2 = evaluatePositive(values[1], tt('短い対角線'));
    const points = [
      { x: 0, y: d1.value / 2 },
      { x: d2.value / 2, y: 0 },
      { x: 0, y: -d1.value / 2 },
      { x: -d2.value / 2, y: 0 }
    ];
    return renderQuadrilateral(points, toggles, [
      { label: tt('長い対角線'), value: d1.label || formatNumber(d1.value) },
      { label: tt('短い対角線'), value: d2.label || formatNumber(d2.value) },
      { label: tt('状態'), value: tt('菱形') }
    ]);
  }

  function renderQuadrilateralTrapezoid(values, toggles) {
    const top = evaluatePositive(values[0], tt('上底'));
    const bottom = evaluatePositive(values[1], tt('下底'));
    const height = evaluatePositive(values[2], tt('高さ'));
    const offset = evaluateExpression(values[3], 'ずれ');
    const points = [
      { x: 0, y: 0 },
      { x: bottom.value, y: 0 },
      { x: offset.value + top.value, y: height.value },
      { x: offset.value, y: height.value }
    ];
    return renderQuadrilateral(points, [toggles[0], toggles[1], false], [
      { label: tt('上底'), value: top.label || formatNumber(top.value) },
      { label: tt('下底'), value: bottom.label || formatNumber(bottom.value) },
      { label: tt('高さ'), value: height.label || formatNumber(height.value) }
    ]);
  }

  function renderRegularPolygon(values, toggles) {
    const radius = evaluatePositive(values[1], tt('半径'));
    const count = Math.round(evaluatePositive(values[2], tt('頂点数')).value);
    if (count < 3) throw new Error('頂点数は 3 以上で入力してください。');
    const angle = evaluateExpression(values[3], tt('回転角'));
    const points = Array.from({ length: count }, function (_, index) {
      const theta = degToRad(angle.value + index * 360 / count - 90);
      return { x: radius.value * Math.cos(theta), y: radius.value * Math.sin(theta) };
    });
    const sideText = formatNumber(distance(points[0], points[1]));
    return {
      svg: renderPolygonSvg(points, {
        names: points.map(function (_, index) { return String.fromCharCode(65 + (index % 26)); }),
        sideTexts: points.map(function () { return sideText; }),
        showAngles: false,
        showVertices: toggles[0],
        showLengths: toggles[1],
        extraLines: toggles[2] ? points.map(function (point) { return { a: { x: 0, y: 0 }, b: point, dash: '6 6' }; }) : null
      }),
      notes: [
        { label: tt('頂点数'), value: String(count) },
        { label: tt('半径'), value: radius.label || formatNumber(radius.value) },
        { label: tt('一辺'), value: sideText }
      ],
      status: tt('正N角形を描画しました。')
    };
  }

  function renderCircle(values, toggles) {
    const radius = evaluatePositive(values[1], tt('半径'));
    const r = Math.max(40, Math.min(150, radius.value * 18));
    let svg = '<svg viewBox="0 0 720 480" aria-hidden="true"><rect width="720" height="480" fill="#fbfcff"/><circle cx="360" cy="240" r="' + r + '" fill="rgba(42,91,215,.10)" stroke="#2a5bd7" stroke-width="4"/>';
    if (toggles[0]) {
      svg += '<circle cx="360" cy="240" r="4.5" fill="#111"/><text x="374" y="232" font-size="18" fill="#111" font-family="sans-serif">O</text>';
    }
    if (toggles[1]) {
      svg += '<line x1="360" y1="240" x2="' + (360 + r) + '" y2="240" stroke="#7d8db8" stroke-width="3"/><text x="' + (360 + r / 2) + '" y="228" font-size="16" fill="#2a5bd7" text-anchor="middle" font-family="sans-serif">' + escapeHtml(radius.label || formatNumber(radius.value)) + '</text>';
    }
    if (toggles[2]) {
      svg += '<circle cx="' + (360 + r) + '" cy="240" r="4.5" fill="#111"/>';
    }
    svg += '</svg>';
    return {
      svg: svg,
      notes: [
        { label: tt('半径'), value: radius.label || formatNumber(radius.value) },
        { label: tt('直径'), value: formatNumber(radius.value * 2) },
        { label: tt('円周'), value: formatNumber(Math.PI * radius.value * 2) }
      ],
      status: tt('円を描画しました。')
    };
  }

  function renderEllipse(values, toggles) {
    const a = evaluatePositive(values[1], tt('長半径'));
    const b = evaluatePositive(values[2], tt('短半径'));
    const angle = evaluateExpression(values[3], tt('回転角'));
    const rx = Math.max(60, Math.min(180, a.value * 18));
    const ry = Math.max(40, Math.min(120, b.value * 18));
    let svg = '<svg viewBox="0 0 720 480" aria-hidden="true"><rect width="720" height="480" fill="#fbfcff"/><g transform="rotate(' + (-angle.value) + ' 360 240)"><ellipse cx="360" cy="240" rx="' + rx + '" ry="' + ry + '" fill="rgba(42,91,215,.10)" stroke="#2a5bd7" stroke-width="4"/>';
    if (toggles[0]) svg += '<circle cx="360" cy="240" r="4.5" fill="#111"/><text x="374" y="232" font-size="18" fill="#111" font-family="sans-serif">O</text>';
    if (toggles[1]) svg += '<line x1="360" y1="240" x2="' + (360 + rx) + '" y2="240" stroke="#7d8db8" stroke-width="3"/>';
    if (toggles[2]) svg += '<line x1="360" y1="240" x2="360" y2="' + (240 - ry) + '" stroke="#7d8db8" stroke-width="3"/>';
    svg += '</g></svg>';
    return {
      svg: svg,
      notes: [
        { label: tt('長半径'), value: a.label || formatNumber(a.value) },
        { label: tt('短半径'), value: b.label || formatNumber(b.value) },
        { label: tt('回転角'), value: formatNumber(angle.value) + '°' }
      ],
      status: tt('楕円を描画しました。')
    };
  }

  function renderStar(values, toggles) {
    const outer = evaluatePositive(values[1], tt('外半径'));
    const inner = evaluatePositive(values[2], tt('内半径'));
    const count = Math.round(evaluatePositive(values[3], tt('頂点数')).value);
    if (count < 5) throw new Error('星型の頂点数は 5 以上で入力してください。');
    const points = [];
    for (let i = 0; i < count * 2; i++) {
      const radius = i % 2 === 0 ? outer.value : inner.value;
      const theta = degToRad(i * 180 / count - 90);
      points.push({ x: radius * Math.cos(theta), y: radius * Math.sin(theta) });
    }
    return {
      svg: renderPolygonSvg(points, {
        names: points.map(function (_, index) { return String(index + 1); }),
        sideTexts: points.map(function () { return ''; }),
        showAngles: false,
        showVertices: toggles[0],
        showLengths: false,
        extraLines: toggles[2] ? points.filter(function (_, index) { return index % 2 === 0; }).map(function (point) { return { a: { x: 0, y: 0 }, b: point, dash: '6 6' }; }) : null
      }),
      notes: [
        { label: tt('外半径'), value: outer.label || formatNumber(outer.value) },
        { label: tt('内半径'), value: inner.label || formatNumber(inner.value) },
        { label: tt('頂点数'), value: String(count) }
      ],
      status: tt('星型を描画しました。')
    };
  }

  function renderByType(type, values, toggles) {
    switch (type) {
      case 'triangle-sas': return renderTriangleSAS(values, toggles);
      case 'triangle-asa': return renderTriangleASA(values, toggles);
      case 'triangle-aas': return renderTriangleAAS(values, toggles);
      case 'triangle-aaa': return renderTriangleAAA(values, toggles);
      case 'triangle-points': return renderTrianglePoints(values, toggles);
      case 'triangle-base-height': return renderTriangleBaseHeight(values, toggles);
      case 'quadrilateral-square': return renderQuadrilateralSquare(values, toggles);
      case 'quadrilateral-rectangle': return renderQuadrilateralRectangle(values, toggles);
      case 'quadrilateral-rhombus': return renderQuadrilateralRhombus(values, toggles);
      case 'quadrilateral-trapezoid': return renderQuadrilateralTrapezoid(values, toggles);
      case 'regular-polygon': return renderRegularPolygon(values, toggles);
      case 'circle': return renderCircle(values, toggles);
      case 'ellipse': return renderEllipse(values, toggles);
      case 'star': return renderStar(values, toggles);
      default:
        return {
          svg: config.previewSvg || '',
          notes: config.notes || [],
          status: config.status || tt('現在は仮作成のため、画面構成と導線を優先して整えています。')
        };
    }
  }

  function buildFields(fields, stateValues) {
    return (fields || []).map(function (field, index) {
      const id = 'draw-simple-field-' + index;
      const value = stateValues && stateValues[index] != null ? stateValues[index] : (field.value || '');
      const inputHtml = field.type === 'select'
        ? '<select id="' + id + '">' + (field.options || []).map(function (option) {
            return '<option' + (option === value ? ' selected' : '') + '>' + escapeHtml(tt(option)) + '</option>';
          }).join('') + '</select>'
        : '<input id="' + id + '" type="text" value="' + escapeHtml(value) + '" />';

      return '<div class="draw-simple-field">' +
        '<label for="' + id + '">' + escapeHtml(tt(field.label)) + '</label>' +
        inputHtml +
      '</div>';
    }).join('');
  }

  function buildToggles(toggles, stateToggles) {
    return (toggles || []).map(function (toggle, index) {
      const id = 'draw-simple-toggle-' + index;
      const checked = stateToggles && stateToggles[index] != null ? stateToggles[index] : toggle.checked !== false;
      return '<label class="draw-simple-toggle" for="' + id + '">' +
        '<input id="' + id + '" type="checkbox" ' + (checked ? 'checked ' : '') + '/>' +
        '<span>' +
          '<strong>' + escapeHtml(tt(toggle.title)) + '</strong>' +
          '<span>' + escapeHtml(tt(toggle.description || '')) + '</span>' +
        '</span>' +
      '</label>';
    }).join('');
  }

  function buildNotes(notes) {
    return (notes || []).map(function (note) {
      return '<div class="draw-simple-note">' +
        '<span class="draw-simple-note-label">' + escapeHtml(tt(note.label)) + '</span>' +
        '<span class="draw-simple-note-value">' + escapeHtml(tt(note.value)) + '</span>' +
      '</div>';
    }).join('');
  }

  function getState() {
    return {
      values: Array.from(mount.querySelectorAll('.draw-simple-field input, .draw-simple-field select')).map(function (input) {
        return input.value;
      }),
      toggles: Array.from(mount.querySelectorAll('.draw-simple-toggle input')).map(function (input) {
        return input.checked;
      })
    };
  }

  function renderPage(savedState) {
    const generalCount = (config.toggles || []).length;
    const savedGeneralToggles = savedState && savedState.toggles ? savedState.toggles.slice(0, generalCount) : null;
    const savedSpecialToggles = savedState && savedState.toggles ? savedState.toggles.slice(generalCount) : null;
    const crumbsHtml = (config.crumbs || []).map(function (crumb, index, arr) {
      const isLast = index === arr.length - 1;
      const label = tt(crumb.label);
      const node = isLast || !crumb.href
        ? '<span>' + escapeHtml(label) + '</span>'
        : '<a href="' + escapeHtml(crumb.href) + '">' + escapeHtml(label) + '</a>';
      return index === 0 ? node : '<span>›</span>' + node;
    }).join('');

    mount.innerHTML =
      '<main class="draw-simple-page">' +
        '<section class="draw-simple-workspace">' +
          '<button class="page-back-btn" id="pageBackBtn" type="button">' + escapeHtml(tt('前の画面に戻る')) + '</button>' +
          '<div class="draw-simple-center">' +
            '<div class="draw-simple-board">' +
              '<div class="draw-simple-board-head">' +
                '<div class="draw-simple-board-title">' +
                  '<div class="draw-simple-crumb">' + crumbsHtml + '</div>' +
                  '<h1>' + escapeHtml(tt(config.title)) + '</h1>' +
                  '<p>' + escapeHtml(tt(config.lead || '')) + '</p>' +
                '</div>' +
                '<div class="draw-simple-board-status" id="drawSimpleStatus"></div>' +
              '</div>' +
              '<div class="draw-simple-board-wrap">' +
                '<div class="draw-simple-preview" id="drawSimplePreview"></div>' +
                '<div class="draw-simple-notes" id="drawSimpleNotes"></div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<aside class="draw-simple-left-dock" id="drawSimpleLeftDock">' +
            '<div class="draw-simple-dock-topbar">' +
              '<button class="draw-simple-dock-toggle" id="drawSimpleLeftDockToggle" type="button" aria-expanded="true">‹</button>' +
            '</div>' +
            '<div class="draw-simple-panel">' +
              '<h2>' + escapeHtml(tt(config.leftTitle || '入力')) + '</h2>' +
              '<p class="draw-simple-intro">' + escapeHtml(tt(config.leftIntro || '')) + '</p>' +
              '<div class="draw-simple-section">' +
                '<h3>' + escapeHtml(tt(config.fieldsTitle || '入力項目')) + '</h3>' +
                '<div class="draw-simple-field-grid">' + buildFields(config.fields, savedState && savedState.values) + '</div>' +
                '<p class="draw-simple-hint">' + escapeHtml(tt(config.fieldsHint || '')) + '</p>' +
              '</div>' +
              '<div class="draw-simple-badge">' + escapeHtml(tt(config.badge || '')) + '</div>' +
            '</div>' +
          '</aside>' +
          '<aside class="draw-simple-right-dock" id="drawSimpleRightDock">' +
            '<div class="draw-simple-dock-topbar">' +
              '<button class="draw-simple-dock-toggle draw-simple-dock-toggle-right" id="drawSimpleRightDockToggle" type="button" aria-expanded="true">›</button>' +
            '</div>' +
            '<div class="draw-simple-toggle-card">' +
              '<h3>' + escapeHtml(tt(config.togglesTitle || '一般ラベル')) + '</h3>' +
              '<div class="draw-simple-toggle-list">' + buildToggles(config.toggles, savedGeneralToggles) + '</div>' +
              '<div class="draw-simple-section">' +
                '<h3>' + escapeHtml(tt(config.specialTogglesTitle || '特別ラベル')) + '</h3>' +
                ((config.specialToggles && config.specialToggles.length)
                  ? '<div class="draw-simple-toggle-list">' + buildToggles(config.specialToggles, savedSpecialToggles) + '</div>'
                  : '<p class="draw-simple-hint">' + escapeHtml(tt(config.specialTogglesHint || 'この図形には特別ラベルはありません。')) + '</p>') +
              '</div>' +
            '</div>' +
          '</aside>' +
        '</section>' +
      '</main>';

    document.title = tt(config.title) + ' | Instant Geometry';

    const fieldInputs = Array.from(mount.querySelectorAll('.draw-simple-field input, .draw-simple-field select'));
    const toggleInputs = Array.from(mount.querySelectorAll('.draw-simple-toggle input'));
    const preview = document.getElementById('drawSimplePreview');
    const status = document.getElementById('drawSimpleStatus');
    const notes = document.getElementById('drawSimpleNotes');
    const pageBackBtn = document.getElementById('pageBackBtn');
    const leftDock = document.getElementById('drawSimpleLeftDock');
    const leftDockToggle = document.getElementById('drawSimpleLeftDockToggle');
    const rightDock = document.getElementById('drawSimpleRightDock');
    const rightDockToggle = document.getElementById('drawSimpleRightDockToggle');
    const rendererType = resolveRendererType();
    let isLeftCollapsed = false;
    let isRightCollapsed = false;

    function updateDockButtons() {
      if (leftDockToggle) {
        leftDockToggle.textContent = isLeftCollapsed ? '›' : '‹';
        leftDockToggle.setAttribute('aria-expanded', String(!isLeftCollapsed));
        leftDockToggle.setAttribute('title', isLeftCollapsed ? tt('表示') : tt('隠す'));
      }
      if (rightDockToggle) {
        rightDockToggle.textContent = isRightCollapsed ? '‹' : '›';
        rightDockToggle.setAttribute('aria-expanded', String(!isRightCollapsed));
        rightDockToggle.setAttribute('title', isRightCollapsed ? tt('表示') : tt('隠す'));
      }
    }

    function renderResult() {
      try {
        const values = fieldInputs.map(function (input) { return input.value; });
        const toggles = currentToggleValues(toggleInputs);
        const result = renderByType(rendererType, values, toggles);
        preview.innerHTML = result.svg;
        status.textContent = tt(result.status || '');
        status.classList.remove('error');
        notes.innerHTML = buildNotes(result.notes || config.notes || []);
      } catch (error) {
        status.textContent = error.message || '描画に失敗しました。';
        status.classList.add('error');
        preview.innerHTML =
          '<div style="padding:20px;color:#b42318;font-size:14px;line-height:1.7;">' +
            '描画処理でエラーが発生しました。入力値または描画設定を確認してください。' +
          '</div>';
        notes.innerHTML = buildNotes(config.notes || []);
      }
    }

    fieldInputs.forEach(function (input) {
      input.addEventListener('input', renderResult);
      input.addEventListener('change', renderResult);
    });

    toggleInputs.forEach(function (input) {
      input.addEventListener('change', renderResult);
    });

    if (leftDockToggle && leftDock) {
      leftDockToggle.addEventListener('click', function () {
        isLeftCollapsed = !isLeftCollapsed;
        leftDock.classList.toggle('is-collapsed', isLeftCollapsed);
        updateDockButtons();
      });
    }

    if (rightDockToggle && rightDock) {
      rightDockToggle.addEventListener('click', function () {
        isRightCollapsed = !isRightCollapsed;
        rightDock.classList.toggle('is-collapsed', isRightCollapsed);
        updateDockButtons();
      });
    }

    if (pageBackBtn) {
      pageBackBtn.addEventListener('click', function () {
        window.history.back();
      });
    }

    updateDockButtons();
    renderResult();
  }

  try {
    renderPage();
  } catch (error) {
    mount.innerHTML =
      '<main class="draw-simple-page">' +
        '<section class="draw-simple-workspace" style="display:grid;place-items:center;">' +
          '<div class="draw-simple-board" style="width:min(860px,calc(100vw - 48px));height:auto;">' +
            '<div class="draw-simple-board-head">' +
              '<div class="draw-simple-board-title">' +
                '<h1>' + escapeHtml(tt(config.title || '図形')) + '</h1>' +
                '<p>初期化中にエラーが発生しました。</p>' +
              '</div>' +
              '<p class="draw-simple-board-status error">' + escapeHtml(error.message || 'Unknown error') + '</p>' +
            '</div>' +
          '</div>' +
        '</section>' +
      '</main>';
  }

  document.addEventListener('site-language:changed', function () {
    try {
      renderPage(getState());
    } catch (error) {
      // keep previous UI as-is if rerender fails
      console.error('draw-simple-page rerender failed', error);
    }
  });
})();
