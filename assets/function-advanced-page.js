(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const config = Object.assign({
    kind: 'gaussian',
    statusText: 'パラメータを入力すると、関数グラフを描画します。',
    saveBase: 'function-advanced',
    params: ['a', 'b'],
    defaults: { a: 1, b: 1, c: 0, d: 0, e: 0 },
    labels: {},
    tickLabelInterval: 2,
    defaultCoordinateMode: 'cartesian',
    defaultViewCenterX: 0,
    defaultViewCenterY: 0,
    defaultViewWidth: 20,
    defaultViewHeight: 20
  }, window.InstantGeometryAdvancedFunctionConfig || {});

  const stage = document.getElementById('stage');
  const statusBox = document.getElementById('statusBox');
  const sheetBackdrop = document.getElementById('sheetBackdrop');
  const editSheet = document.getElementById('editSheet');
  const saveSheet = document.getElementById('saveSheet');
  const sheetTitle = document.getElementById('sheetTitle');
  const sheetBody = document.getElementById('sheetBody');
  const captureRoot = document.getElementById('captureRoot');
  const inputs = {
    a: document.getElementById('axisA'),
    b: document.getElementById('axisB'),
    c: document.getElementById('axisC'),
    d: document.getElementById('axisD'),
    e: document.getElementById('axisE')
  };
  const activeParams = Array.isArray(config.params) ? config.params : ['a', 'b'];

  if (!stage || activeParams.some(function (key) { return !inputs[key]; })) return;

  const plot = {
    left: 86,
    right: 914,
    top: 86,
    bottom: 914,
    xMin: -10,
    xMax: 10,
    yMin: -10,
    yMax: 10
  };

  const state = {
    tickLabelInterval: config.tickLabelInterval || 2,
    coordinateMode: config.defaultCoordinateMode || 'cartesian',
    viewCenterX: Number(config.defaultViewCenterX) || 0,
    viewCenterY: Number(config.defaultViewCenterY) || 0,
    viewWidth: Number(config.defaultViewWidth) || 20,
    viewHeight: Number(config.defaultViewHeight) || 20,
    areaLabelMode: 'numeric',
    areaLabelText: '',
    areaColor: '#2a5bd7',
    curves: {},
    discreteAreas: {},
    labelOffsets: {}
  };

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

  let moveMode = null;
  let moveDrag = null;
  let moveInitialOffset = null;
  let currentLabelBases = {};

  function svg(tag, attrs) {
    const node = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (key) {
      node.setAttribute(key, attrs[key]);
    });
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function formatNumber(value) {
    if (!Number.isFinite(value)) return '';
    if (Math.abs(value) < 1e-10) return '0';
    const rounded = Math.round(value * 1000) / 1000;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, '').replace(/\.$/, '');
  }

  function signed(value) {
    if (Math.abs(value) < 1e-10) return '';
    return (value > 0 ? ' + ' : ' - ') + formatNumber(Math.abs(value));
  }

  function polynomialExpression(terms) {
    const parts = [];
    terms.forEach(function (term) {
      if (Math.abs(term.coefficient) < 1e-10) return;
      const abs = Math.abs(term.coefficient);
      const core = (Math.abs(abs - 1) < 1e-10 && term.variable ? '' : formatNumber(abs)) + term.variable;
      parts.push({ sign: term.coefficient < 0 ? '-' : '+', text: core });
    });
    if (!parts.length) return '0';
    return parts.map(function (part, index) {
      if (index === 0) return part.sign === '-' ? '-' + part.text : part.text;
      return ' ' + part.sign + ' ' + part.text;
    }).join('');
  }

  function cubicValue(v, x) {
    return v.a * Math.pow(x, 3) + v.b * x * x + v.c * x + v.d;
  }

  function cubicDerivative(v, x) {
    return 3 * v.a * x * x + 2 * v.b * x + v.c;
  }

  function setStatus(message, isError) {
    if (!statusBox) return;
    statusBox.textContent = message;
    statusBox.classList.toggle('error', Boolean(isError));
  }

  function parseNumber(key) {
    const text = String(inputs[key].value || '').trim();
    const label = config.labels[key] || key;
    if (!/^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$/.test(text)) {
      throw new Error(label + ' は数値で入力してください。');
    }
    return Number(text);
  }

  function readParams() {
    const values = Object.assign({ a: 1, b: 1, c: 0, d: 0, e: 0 }, config.defaults || {});
    activeParams.forEach(function (key) {
      values[key] = parseNumber(key);
    });
    if (config.kind === 'polar') {
      const polarType = config.polarType || 'rose-cos';
      if ((polarType === 'rose-cos'
        || polarType === 'rose-sin'
        || polarType === 'circle'
        || polarType === 'lemniscate'
        || polarType === 'logarithmic-spiral'
        || polarType === 'hyperbolic-spiral'
        || polarType === 'conchoid'
        || polarType === 'cissoid'
        || polarType === 'sinusoidal-spiral'
        || polarType === 'fermat-spiral'
        || polarType === 'lituus'
        || polarType === 'epispiral') && values.a <= 0) {
        throw new Error('大きさ a は0より大きい数値で入力してください。');
      }
      if ((polarType === 'rose-cos' || polarType === 'rose-sin' || polarType === 'sinusoidal-spiral' || polarType === 'epispiral') && values.b <= 0) {
        throw new Error('係数 n は0より大きい数値で入力してください。');
      }
      if ((polarType === 'sinusoidal-spiral' || polarType === 'epispiral') && Math.abs(values.b - Math.round(values.b)) > 1e-10) {
        throw new Error('係数 n は正の整数で入力してください。');
      }
      if (polarType === 'cardioid' && values.a <= 0) {
        throw new Error('大きさ a は0より大きい数値で入力してください。');
      }
      if (polarType === 'limacon') {
        if (values.a <= 0) throw new Error('係数 a は0より大きい数値で入力してください。');
        if (values.b <= 0) throw new Error('係数 b は0より大きい数値で入力してください。');
      }
      if (polarType === 'archimedean-spiral' && values.b <= 0) {
        throw new Error('係数 b は0より大きい数値で入力してください。');
      }
      if (polarType === 'logarithmic-spiral' && values.b <= 0) {
        throw new Error('係数 b は0より大きい数値で入力してください。');
      }
      if (polarType === 'conic') {
        if (values.a <= 0) throw new Error('離心率 e は0より大きい数値で入力してください。');
        if (values.b <= 0) throw new Error('基準距離 d は0より大きい数値で入力してください。');
      }
      if (polarType === 'conchoid' && values.b <= 0) {
        throw new Error('係数 b は0より大きい数値で入力してください。');
      }
    }
    if (config.kind === 'inverse-exp-log') {
      if (values.a <= 0) throw new Error('係数 a は0より大きい数値で入力してください。');
      if (Math.abs(values.b) < 1e-10) throw new Error('係数 b は0以外の数値で入力してください。');
    }
    if (config.kind === 'gaussian' && values.b <= 0) {
      throw new Error('係数 b は0より大きい数値で入力してください。');
    }
    if (config.kind === 'physics-damped-oscillation' && values.b < 0) {
      throw new Error('減衰係数 γ は0以上の数値で入力してください。');
    }
    if (config.kind === 'physics-projectile-motion') {
      if (values.a <= 0) throw new Error('初速度 v は0より大きい数値で入力してください。');
      if (values.d <= 0) throw new Error('重力加速度 g は0より大きい数値で入力してください。');
    }
    if (config.kind === 'physics-capacitor-discharge' && values.b <= 0) {
      throw new Error('時定数 τ は0より大きい数値で入力してください。');
    }
    if (config.kind === 'physics-newton-cooling' && values.c <= 0) {
      throw new Error('冷却係数 k は0より大きい数値で入力してください。');
    }
    if (config.kind === 'physics-spring-potential' && values.a <= 0) {
      throw new Error('ばね定数 k は0より大きい数値で入力してください。');
    }
    if (config.kind === 'physics-lorentz-factor' && values.a <= 0) {
      throw new Error('光速 c は0より大きい数値で入力してください。');
    }
    if (config.kind === 'physics-terminal-velocity') {
      if (values.a <= 0) throw new Error('終端速度 vT は0より大きい数値で入力してください。');
      if (values.b <= 0) throw new Error('係数 k は0より大きい数値で入力してください。');
    }
    if (config.kind === 'physics-drag-fall-velocity') {
      if (values.a <= 0) throw new Error('終端速度 vT は0より大きい数値で入力してください。');
      if (values.b <= 0) throw new Error('重力加速度 g は0より大きい数値で入力してください。');
    }
    if (config.kind === 'physics-pendulum-period') {
      if (values.a <= 0) throw new Error('重力加速度 g は0より大きい数値で入力してください。');
    }
    if (config.kind === 'physics-doppler-effect') {
      if (values.a <= 0) throw new Error('音源周波数 f は0より大きい数値で入力してください。');
      if (values.b <= 0) throw new Error('波の速さ v は0より大きい数値で入力してください。');
    }
    if (config.kind === 'physics-rc-charging' && values.b <= 0) {
      throw new Error('時定数 τ は0より大きい数値で入力してください。');
    }
    if (config.kind === 'physics-rl-current' && values.b <= 0) {
      throw new Error('時定数 τ は0より大きい数値で入力してください。');
    }
    if (config.kind === 'physics-rlc-resonance') {
      if (values.a <= 0) throw new Error('共振角周波数 ω₀ は0より大きい数値で入力してください。');
      if (values.b <= 0) throw new Error('減衰係数 β は0より大きい数値で入力してください。');
      if (values.c <= 0) throw new Error('倍率 A は0より大きい数値で入力してください。');
    }
    if (config.kind === 'physics-infinite-well-wavefunction' || config.kind === 'physics-infinite-well-density') {
      if (!Number.isInteger(values.a) || values.a < 1) throw new Error('量子数 n は1以上の整数で入力してください。');
      if (values.b <= 0) throw new Error('井戸の幅 L は0より大きい数値で入力してください。');
    }
    if (config.kind === 'physics-tunneling-decay' && values.b <= 0) {
      throw new Error('減衰定数 κ は0より大きい数値で入力してください。');
    }
    if (config.kind === 'physics-boltzmann-factor' && values.a <= 0) {
      throw new Error('kT は0より大きい数値で入力してください。');
    }
    if (config.kind === 'physics-planck-distribution') {
      if (values.a <= 0) throw new Error('温度 T は0より大きい数値で入力してください。');
      if (values.b <= 0) throw new Error('倍率 A は0より大きい数値で入力してください。');
      if (values.c <= 0) throw new Error('定数 B は0より大きい数値で入力してください。');
    }
    if (config.kind === 'physics-maxwell-speed-distribution') {
      if (values.a <= 0) throw new Error('倍率 A は0より大きい数値で入力してください。');
      if (values.b <= 0) throw new Error('係数 b は0より大きい数値で入力してください。');
    }
    if (config.kind === 'physics-gaussian-wave-packet' && values.b <= 0) {
      throw new Error('幅 σ は0より大きい数値で入力してください。');
    }
    if (config.kind === 'physics-fourier-square-wave') {
      if (values.a <= 0) throw new Error('振幅 A は0より大きい数値で入力してください。');
      if (values.b <= 0) throw new Error('角周波数 ω は0より大きい数値で入力してください。');
      if (!Number.isInteger(values.c) || values.c < 1) throw new Error('項数 N は1以上の整数で入力してください。');
    }
    if (config.kind === 'physics-lorentzian-line' && values.c <= 0) {
      throw new Error('線幅 γ は0より大きい数値で入力してください。');
    }
    if ((config.kind === 'physics-capacitor-energy' || config.kind === 'physics-inductor-energy') && values.a <= 0) {
      throw new Error('係数は0より大きい数値で入力してください。');
    }
    if (config.kind === 'physics-ac-power') {
      if (values.a <= 0) throw new Error('電圧振幅 V₀ は0より大きい数値で入力してください。');
      if (values.b <= 0) throw new Error('電流振幅 I₀ は0より大きい数値で入力してください。');
      if (values.c <= 0) throw new Error('角周波数 ω は0より大きい数値で入力してください。');
    }
    if (config.kind === 'physics-stefan-boltzmann' && values.a <= 0) {
      throw new Error('係数 A は0より大きい数値で入力してください。');
    }
    if (config.kind === 'physics-wien-displacement' && values.a <= 0) {
      throw new Error('定数 b は0より大きい数値で入力してください。');
    }
    if (config.kind === 'physics-ideal-gas-isotherm' && values.a <= 0) {
      throw new Error('nRT は0より大きい数値で入力してください。');
    }
    if (config.kind === 'physics-ideal-gas-adiabat') {
      if (values.a <= 0) throw new Error('定数 K は0より大きい数値で入力してください。');
      if (values.b <= 0) throw new Error('比熱比 γ は0より大きい数値で入力してください。');
    }
    if (config.kind === 'music-sine-frequency' && values.b <= 0) {
      throw new Error('周波数 f は0より大きい数値で入力してください。');
    }
    if (config.kind === 'music-harmonics') {
      if (values.b <= 0) throw new Error('基本角周波数 ω は0より大きい数値で入力してください。');
      if (!Number.isInteger(values.c) || values.c < 1) throw new Error('倍音番号 n は1以上の整数で入力してください。');
    }
    if (config.kind === 'music-decibel' && values.a <= 0) {
      throw new Error('基準振幅 A₀ は0より大きい数値で入力してください。');
    }
    if (config.kind === 'music-fourier-synthesis') {
      if (values.b <= 0) throw new Error('基本角周波数 ω は0より大きい数値で入力してください。');
      if (!Number.isInteger(values.c) || values.c < 1) throw new Error('項数 N は1以上の整数で入力してください。');
    }
    if (config.kind === 'music-adsr-envelope') {
      if (values.a <= 0 || values.b <= 0 || values.e <= 0) throw new Error('Attack、Decay、Release は0より大きい数値で入力してください。');
      if (values.c < 0 || values.c > 1) throw new Error('Sustain は0以上1以下の数値で入力してください。');
      if (values.d <= values.a + values.b) throw new Error('Release開始 tR は Attack + Decay より大きい数値で入力してください。');
    }
    if (config.kind === 'music-equal-temperament' && values.a <= 0) {
      throw new Error('基準周波数 f₀ は0より大きい数値で入力してください。');
    }
    if (config.kind === 'music-vibrato') {
      if (values.b <= 0) throw new Error('中心周波数 f は0より大きい数値で入力してください。');
      if (values.d < 0) throw new Error('ビブラート深さ d は0以上の数値で入力してください。');
      if (values.e <= 0) throw new Error('ビブラート周波数 m は0より大きい数値で入力してください。');
    }
    if (config.kind === 'music-tremolo') {
      if (values.b <= 0) throw new Error('音の周波数 f は0より大きい数値で入力してください。');
      if (values.c < 0 || values.c > 1) throw new Error('揺れの深さ d は0以上1以下の数値で入力してください。');
      if (values.d <= 0) throw new Error('揺れの周波数 m は0より大きい数値で入力してください。');
    }
    if (config.kind === 'music-am-modulation') {
      if (values.b <= 0) throw new Error('搬送波周波数 fc は0より大きい数値で入力してください。');
      if (values.c < 0 || values.c > 1) throw new Error('変調指数 m は0以上1以下の数値で入力してください。');
      if (values.d <= 0) throw new Error('変調周波数 fm は0より大きい数値で入力してください。');
    }
    if (config.kind === 'music-fm-modulation') {
      if (values.b <= 0) throw new Error('搬送波周波数 fc は0より大きい数値で入力してください。');
      if (values.c < 0) throw new Error('周波数偏移 Δf は0以上の数値で入力してください。');
      if (values.d <= 0) throw new Error('変調周波数 fm は0より大きい数値で入力してください。');
    }
    if (config.kind === 'music-decaying-tone') {
      if (values.b <= 0) throw new Error('周波数 f は0より大きい数値で入力してください。');
      if (values.c < 0) throw new Error('減衰係数 k は0以上の数値で入力してください。');
    }
    if (config.kind === 'music-just-intonation-ratio' && values.a <= 0) {
      throw new Error('基準周波数 f₀ は0より大きい数値で入力してください。');
    }
    if (config.kind === 'music-chord-superposition') {
      if (values.a <= 0) throw new Error('振幅 A は0より大きい数値で入力してください。');
      if (values.b <= 0) throw new Error('基準周波数 f₀ は0より大きい数値で入力してください。');
      if (values.c <= 0 || values.d <= 0 || values.e <= 0) throw new Error('周波数比は0より大きい数値で入力してください。');
    }
    if (config.kind === 'music-harmonic-spectrum') {
      if (values.a <= 0) throw new Error('基準振幅 A は0より大きい数値で入力してください。');
      if (values.b < 0) throw new Error('減衰指数 p は0以上の数値で入力してください。');
    }
    if (config.kind === 'music-low-pass-filter') {
      if (values.a <= 0) throw new Error('カットオフ周波数 fc は0より大きい数値で入力してください。');
      if (values.b <= 0) throw new Error('ゲイン G は0より大きい数値で入力してください。');
    }
    if (config.kind === 'music-sampling') {
      if (values.a <= 0) throw new Error('振幅 A は0より大きい数値で入力してください。');
      if (values.b <= 0) throw new Error('信号周波数 f は0より大きい数値で入力してください。');
      if (values.c <= 0) throw new Error('サンプリング周波数 fs は0より大きい数値で入力してください。');
    }
    if (config.kind === 'music-aliasing') {
      if (values.a <= 0) throw new Error('振幅 A は0より大きい数値で入力してください。');
      if (values.b <= 0) throw new Error('信号周波数 f は0より大きい数値で入力してください。');
      if (values.c <= 0) throw new Error('サンプリング周波数 fs は0より大きい数値で入力してください。');
    }
    if (config.kind === 'chemistry-ph-log' && values.a <= 0) {
      throw new Error('倍率 a は0より大きい数値で入力してください。');
    }
    if ((config.kind === 'chemistry-first-order-decay' || config.kind === 'chemistry-half-life') && (values.a <= 0 || values.b <= 0)) {
      throw new Error('初期量と定数は0より大きい数値で入力してください。');
    }
    if (config.kind === 'chemistry-henderson-hasselbalch' && values.b <= 0) {
      throw new Error('濃度比は0より大きい範囲で描画します。');
    }
    if (config.kind === 'chemistry-arrhenius') {
      if (values.a <= 0) throw new Error('頻度因子 A は0より大きい数値で入力してください。');
      if (values.b < 0) throw new Error('活性化エネルギー Ea は0以上の数値で入力してください。');
      if (values.c <= 0) throw new Error('気体定数 R は0より大きい数値で入力してください。');
    }
    if (config.kind === 'chemistry-ideal-gas-pressure') {
      if (values.a <= 0) throw new Error('物質量 n は0より大きい数値で入力してください。');
      if (values.b <= 0) throw new Error('温度 T は0より大きい数値で入力してください。');
      if (values.c <= 0) throw new Error('気体定数 R は0より大きい数値で入力してください。');
    }
    if (config.kind === 'chemistry-titration-curve') {
      if (values.c <= values.a) throw new Error('高pHは低pHより大きい数値で入力してください。');
      if (values.d <= 0) throw new Error('立ち上がり k は0より大きい数値で入力してください。');
    }
    if (config.kind === 'chemistry-reaction-rate') {
      if (values.a <= 0) throw new Error('速度定数 k は0より大きい数値で入力してください。');
      if (values.b < 0) throw new Error('反応次数 n は0以上の数値で入力してください。');
    }
    if (config.kind === 'chemistry-beer-lambert' && (values.a <= 0 || values.b <= 0)) {
      throw new Error('モル吸光係数 ε と光路長 l は0より大きい数値で入力してください。');
    }
    if (config.kind === 'chemistry-nernst') {
      if (values.b <= 0) throw new Error('温度 T は0より大きい数値で入力してください。');
      if (values.c <= 0) throw new Error('電子数 n は0より大きい数値で入力してください。');
      if (values.d <= 0) throw new Error('気体定数 R は0より大きい数値で入力してください。');
      if (values.e <= 0) throw new Error('ファラデー定数 F は0より大きい数値で入力してください。');
    }
    if (config.kind === 'chemistry-vanthoff' && values.c <= 0) {
      throw new Error('気体定数 R は0より大きい数値で入力してください。');
    }
    if (config.kind === 'chemistry-clausius-clapeyron' && values.c <= 0) {
      throw new Error('気体定数 R は0より大きい数値で入力してください。');
    }
    if (config.kind === 'chemistry-michaelis-menten' && (values.a <= 0 || values.b <= 0)) {
      throw new Error('Vmax と Km は0より大きい数値で入力してください。');
    }
    if (config.kind === 'chemistry-langmuir-isotherm' && values.a <= 0) {
      throw new Error('吸着定数 K は0より大きい数値で入力してください。');
    }
    if (config.kind === 'chemistry-extraction-efficiency' && (values.a <= 0 || values.b <= 0)) {
      throw new Error('有機相体積と水相体積は0より大きい数値で入力してください。');
    }
    if (config.kind === 'chemistry-dilution-dissociation' && values.a <= 0) {
      throw new Error('酸解離定数 Ka は0より大きい数値で入力してください。');
    }
    if (config.kind === 'chemistry-osmotic-pressure' && (values.a <= 0 || values.b <= 0 || values.c <= 0)) {
      throw new Error('i、R、T は0より大きい数値で入力してください。');
    }
    if (config.kind === 'chemistry-q10-temperature') {
      if (values.a <= 0) throw new Error('基準速度 rate₀ は0より大きい数値で入力してください。');
      if (values.b <= 0) throw new Error('Q10 は0より大きい数値で入力してください。');
    }
    if (config.kind === 'chemistry-absorbance-time' && values.c <= 0) {
      throw new Error('速度定数 k は0より大きい数値で入力してください。');
    }
    if (config.kind === 'chemistry-weak-acid-ph' && values.a <= 0) {
      throw new Error('pKa は0より大きい数値で入力してください。');
    }
    if (config.kind === 'chemistry-ksp-solubility' && values.a <= 0) {
      throw new Error('溶解度積 Ksp は0より大きい数値で入力してください。');
    }
    if (config.kind === 'chemistry-henry-law' && values.a <= 0) {
      throw new Error('ヘンリー定数 kH は0より大きい数値で入力してください。');
    }
    if (config.kind === 'chemistry-raoult-law' && values.a <= 0) {
      throw new Error('純溶媒の蒸気圧 P° は0より大きい数値で入力してください。');
    }
    if (config.kind === 'chemistry-colligative-temperature' && values.a <= 0) {
      throw new Error('比例定数 K は0より大きい数値で入力してください。');
    }
    if ((config.kind === 'chemistry-zero-order-reaction' || config.kind === 'chemistry-second-order-reaction') && (values.a <= 0 || values.b <= 0)) {
      throw new Error('初期濃度と速度定数は0より大きい数値で入力してください。');
    }
    if (config.kind === 'chemistry-half-life-rate-constant' && values.a <= 0) {
      throw new Error('初期濃度 [A]₀ は0より大きい数値で入力してください。');
    }
    if (config.kind === 'chemistry-boltzmann-distribution' && values.a <= 0) {
      throw new Error('温度係数 kT は0より大きい数値で入力してください。');
    }
    if (config.kind === 'chemistry-maxwell-boltzmann' && (values.a <= 0 || values.b <= 0)) {
      throw new Error('質量係数 m と温度係数 kT は0より大きい数値で入力してください。');
    }
    if (config.kind === 'medicine-blood-concentration') {
      if (values.a <= 0) throw new Error('投与量 D は0より大きい数値で入力してください。');
      if (values.b <= 0) throw new Error('分布容積 Vd は0より大きい数値で入力してください。');
      if (values.c <= 0) throw new Error('半減期 t1/2 は0より大きい数値で入力してください。');
    }
    if (config.kind === 'medicine-dose-response') {
      if (values.a <= 0) throw new Error('最大効果 Emax は0より大きい数値で入力してください。');
      if (values.b <= 0) throw new Error('EC50 は0より大きい数値で入力してください。');
      if (values.c <= 0) throw new Error('ヒル係数 n は0より大きい数値で入力してください。');
    }
    if (config.kind === 'medicine-sir-infected') {
      if (values.a <= 0) throw new Error('感染率 β は0より大きい数値で入力してください。');
      if (values.b <= 0) throw new Error('回復率 γ は0より大きい数値で入力してください。');
      if (values.c <= 0 || values.c >= 1) throw new Error('初期感染割合 I0 は0より大きく1より小さい数値で入力してください。');
    }
    if (config.kind === 'medicine-growth-curve') {
      if (values.a <= values.b) throw new Error('成人身長 Hmax は初期身長 H0 より大きい数値で入力してください。');
      if (values.c <= 0) throw new Error('成長率 k は0より大きい数値で入力してください。');
    }
    if (config.kind === 'medicine-bmi-curve') {
      if (values.a <= 0) throw new Error('BMI は0より大きい数値で入力してください。');
    }
    if (config.kind === 'medicine-vital-cycle') {
      if (values.b <= 0) throw new Error('周期 T は0より大きい数値で入力してください。');
    }
    if (config.kind === 'earth-atmospheric-pressure' && (values.a <= 0 || values.b <= 0)) {
      throw new Error('海面気圧 P0 とスケールハイト H は0より大きい数値で入力してください。');
    }
    if (config.kind === 'earth-seismic-wave-travel-time' && values.a <= 0) {
      throw new Error('波の速さ v は0より大きい数値で入力してください。');
    }
    if (config.kind === 'earth-radiocarbon-dating' && (values.a <= 0 || values.b <= 0)) {
      throw new Error('初期割合 N0 と半減期 T は0より大きい数値で入力してください。');
    }
    if (config.kind === 'earth-geothermal-gradient' && values.b < 0) {
      throw new Error('地温勾配 g は0以上の数値で入力してください。');
    }
    if (config.kind === 'earth-river-profile' && (values.a <= 0 || values.b <= 0)) {
      throw new Error('標高 H0 と減衰距離 L は0より大きい数値で入力してください。');
    }
    if (config.kind === 'environment-daily-temperature' && values.b < 0) {
      throw new Error('振幅 A は0以上の数値で入力してください。');
    }
    if (config.kind === 'environment-co2-increase') {
      if (values.a <= 0) throw new Error('初期濃度 C0 は0より大きい数値で入力してください。');
      if (values.b < 0) throw new Error('増加率 r は0以上の数値で入力してください。');
    }
    if (config.kind === 'environment-diffusion-model') {
      if (values.a <= 0) throw new Error('総量 M は0より大きい数値で入力してください。');
      if (values.b <= 0) throw new Error('拡散係数 D は0より大きい数値で入力してください。');
      if (values.c <= 0) throw new Error('時刻 t は0より大きい数値で入力してください。');
    }
    if (config.kind === 'environment-population-carrying-capacity') {
      if (values.a <= 0) throw new Error('環境容量 K は0より大きい数値で入力してください。');
      if (values.b <= 0) throw new Error('初期人口 N0 は0より大きい数値で入力してください。');
      if (values.b >= values.a) throw new Error('初期人口 N0 は環境容量 K より小さい数値で入力してください。');
    }
    if (config.kind === 'environment-precipitation-distribution') {
      if (values.a <= 0) throw new Error('形状 k は0より大きい数値で入力してください。');
      if (values.b <= 0) throw new Error('尺度 θ は0より大きい数値で入力してください。');
      if (values.c <= 0) throw new Error('倍率 A は0より大きい数値で入力してください。');
    }
    if (config.kind === 'environment-wind-power') {
      if (values.a <= 0) throw new Error('係数 c は0より大きい数値で入力してください。');
      if (values.b < 0) throw new Error('カットイン風速 v0 は0以上の数値で入力してください。');
    }
    if (config.kind === 'engineering-first-order-step' && values.b <= 0) {
      throw new Error('時定数 τ は0より大きい数値で入力してください。');
    }
    if (config.kind === 'engineering-second-order-step') {
      if (values.b <= 0 || values.b >= 1) throw new Error('減衰比 ζ は0より大きく1より小さい数値で入力してください。');
      if (values.c <= 0) throw new Error('固有角周波数 ωn は0より大きい数値で入力してください。');
    }
    if ((config.kind === 'engineering-low-pass' || config.kind === 'engineering-high-pass') && (values.a <= 0 || values.b <= 0)) {
      throw new Error('ゲイン A とカットオフ周波数 fc は0より大きい数値で入力してください。');
    }
    if (config.kind === 'engineering-stress-strain') {
      if (values.a <= 0) throw new Error('ヤング率 E は0より大きい数値で入力してください。');
      if (values.b <= 0) throw new Error('降伏ひずみ εy は0より大きい数値で入力してください。');
      if (values.c < 0) throw new Error('硬化係数 H は0以上の数値で入力してください。');
    }
    if (config.kind === 'engineering-beam-deflection' && (values.a <= 0 || values.b <= 0 || values.c <= 0)) {
      throw new Error('荷重 P、スパン L、曲げ剛性 EI は0より大きい数値で入力してください。');
    }
    if (config.kind === 'normal-distribution' && values.b <= 0) {
      throw new Error('標準偏差 σ は0より大きい数値で入力してください。');
    }
    if ((config.kind === 'normal-cdf-function' || config.kind === 'normal-survival-function') && values.b <= 0) {
      throw new Error('標準偏差 σ は0より大きい数値で入力してください。');
    }
    if (config.kind === 'derivative-logarithmic') {
      if (values.b <= 0) throw new Error('底 b は0より大きい数値で入力してください。');
      if (Math.abs(values.b - 1) < 1e-10) throw new Error('底 b は1以外の数値で入力してください。');
    }
    if (config.kind === 'standard-normal-distribution' && !Number.isFinite(values.a)) {
      throw new Error('右端 z は数値で入力してください。');
    }
    if (config.kind === 'uniform-distribution' && values.b <= values.a) {
      throw new Error('右端 b は左端 a より大きい数値で入力してください。');
    }
    if (config.kind === 'exponential-distribution' && values.a <= 0) {
      throw new Error('率 λ は0より大きい数値で入力してください。');
    }
    if (config.kind === 'binomial-distribution') {
      if (!Number.isInteger(values.a) || values.a < 1) throw new Error('試行回数 n は1以上の整数で入力してください。');
      if (values.b < 0 || values.b > 1) throw new Error('確率 p は0以上1以下の数値で入力してください。');
    }
    if (config.kind === 'poisson-distribution' && values.a <= 0) {
      throw new Error('平均 λ は0より大きい数値で入力してください。');
    }
    if (config.kind === 'gamma-distribution') {
      if (values.a <= 0) throw new Error('形状 α は0より大きい数値で入力してください。');
      if (values.b <= 0) throw new Error('尺度 θ は0より大きい数値で入力してください。');
    }
    if (config.kind === 'beta-distribution') {
      if (values.a <= 0) throw new Error('形状 α は0より大きい数値で入力してください。');
      if (values.b <= 0) throw new Error('形状 β は0より大きい数値で入力してください。');
    }
    if (config.kind === 'chi-square-distribution' && values.a <= 0) {
      throw new Error('自由度 k は0より大きい数値で入力してください。');
    }
    if (config.kind === 't-distribution' && values.a <= 0) {
      throw new Error('自由度 ν は0より大きい数値で入力してください。');
    }
    if (config.kind === 'f-distribution') {
      if (values.a <= 0) throw new Error('自由度 d1 は0より大きい数値で入力してください。');
      if (values.b <= 0) throw new Error('自由度 d2 は0より大きい数値で入力してください。');
    }
    if (config.kind === 'geometric-distribution' && (values.a <= 0 || values.a > 1)) {
      throw new Error('成功確率 p は0より大きく1以下の数値で入力してください。');
    }
    if (config.kind === 'cauchy-distribution' && values.b <= 0) {
      throw new Error('尺度 γ は0より大きい数値で入力してください。');
    }
    if (config.kind === 'bernoulli-distribution' && (values.a < 0 || values.a > 1)) {
      throw new Error('成功確率 p は0以上1以下の数値で入力してください。');
    }
    if (config.kind === 'negative-binomial-distribution') {
      if (!Number.isInteger(values.a) || values.a < 1) throw new Error('成功回数 r は1以上の整数で入力してください。');
      if (values.b <= 0 || values.b > 1) throw new Error('成功確率 p は0より大きく1以下の数値で入力してください。');
    }
    if (config.kind === 'hypergeometric-distribution') {
      if (!Number.isInteger(values.a) || values.a < 1) throw new Error('母集団 N は1以上の整数で入力してください。');
      if (!Number.isInteger(values.b) || values.b < 0 || values.b > values.a) throw new Error('成功数 K は0以上N以下の整数で入力してください。');
      if (!Number.isInteger(values.c) || values.c < 0 || values.c > values.a) throw new Error('抽出数 n は0以上N以下の整数で入力してください。');
    }
    if (config.kind === 'weibull-distribution') {
      if (values.a <= 0) throw new Error('形状 k は0より大きい数値で入力してください。');
      if (values.b <= 0) throw new Error('尺度 λ は0より大きい数値で入力してください。');
    }
    if (config.kind === 'lognormal-distribution' && values.b <= 0) {
      throw new Error('標準偏差 σ は0より大きい数値で入力してください。');
    }
    if (config.kind === 'laplace-distribution' && values.b <= 0) {
      throw new Error('尺度 b は0より大きい数値で入力してください。');
    }
    if (config.kind === 'logistic-distribution' && values.b <= 0) {
      throw new Error('尺度 s は0より大きい数値で入力してください。');
    }
    if (config.kind === 'rayleigh-distribution' && values.a <= 0) {
      throw new Error('尺度 σ は0より大きい数値で入力してください。');
    }
    if (config.kind === 'pareto-distribution') {
      if (values.a <= 0) throw new Error('最小値 xₘ は0より大きい数値で入力してください。');
      if (values.b <= 0) throw new Error('形状 α は0より大きい数値で入力してください。');
    }
    if (config.kind === 'triangular-distribution') {
      if (values.a >= values.c) throw new Error('最大値 b は最小値 a より大きい数値で入力してください。');
      if (values.b < values.a || values.b > values.c) throw new Error('最頻値 m は最小値 a 以上、最大値 b 以下で入力してください。');
    }
    return values;
  }

  function sx(x) {
    return plot.left + (x - plot.xMin) / (plot.xMax - plot.xMin) * (plot.right - plot.left);
  }

  function sy(y) {
    return plot.top + (plot.yMax - y) / (plot.yMax - plot.yMin) * (plot.bottom - plot.top);
  }

  function point(x, y) {
    return { x: sx(x), y: sy(y), ux: x, uy: y };
  }

  function gammaFunction(z) {
    const p = [
      676.5203681218851,
      -1259.1392167224028,
      771.3234287776531,
      -176.6150291621406,
      12.507343278686905,
      -0.13857109526572012,
      9.984369578019572e-6,
      1.5056327351493116e-7
    ];
    if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gammaFunction(1 - z));
    z -= 1;
    let x = 0.9999999999998099;
    for (let i = 0; i < p.length; i += 1) x += p[i] / (z + i + 1);
    const t = z + p.length - 0.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
  }

  function betaFunction(alpha, beta) {
    return gammaFunction(alpha) * gammaFunction(beta) / gammaFunction(alpha + beta);
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
    const svgPoint = stage.createSVGPoint();
    svgPoint.x = event.clientX;
    svgPoint.y = event.clientY;
    const transformed = svgPoint.matrixTransform(matrix.inverse());
    return { x: transformed.x, y: transformed.y };
  }

  function attachLabelHit(element, kind, id) {
    element.setAttribute('data-label-target', 'true');
    if (isMoveTarget(kind, id)) element.classList.add('label-move-target');
    element.addEventListener('pointerdown', function (event) {
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
    });
  }

  function drawText(text, x, y, klass, onClick, target) {
    const pos = target ? getLabelPosition(target.kind, target.id, { x: x, y: y }) : { x: x, y: y };
    const node = svg('text', { x: pos.x, y: pos.y, class: 'function-label' + (klass ? ' ' + klass : '') });
    node.textContent = text;
    if (onClick) {
      node.addEventListener('click', function (event) {
        event.stopPropagation();
        if (moveMode) return;
        onClick();
      });
    }
    if (target) attachLabelHit(node, target.kind, target.id);
    stage.appendChild(node);
  }

  function drawGrid() {
    if (config.kind === 'polar' && state.coordinateMode === 'polar') {
      drawPolarGrid();
      return;
    }
    if (window.InstantGeometryFunctionViewSettings && window.InstantGeometryFunctionViewSettings.drawGrid) {
      window.InstantGeometryFunctionViewSettings.drawGrid({
        state: state,
        plot: plot,
        svg: svg,
        sx: sx,
        sy: sy,
        stage: stage,
        drawText: drawText
      });
      return;
    }
    for (let x = Math.ceil(plot.xMin); x <= Math.floor(plot.xMax); x += 1) {
      stage.appendChild(svg('line', { x1: sx(x), y1: sy(plot.yMin), x2: sx(x), y2: sy(plot.yMax), class: 'function-grid-minor' }));
    }
    for (let y = Math.ceil(plot.yMin); y <= Math.floor(plot.yMax); y += 1) {
      stage.appendChild(svg('line', { x1: sx(plot.xMin), y1: sy(y), x2: sx(plot.xMax), y2: sy(y), class: 'function-grid-minor' }));
    }
    stage.appendChild(svg('line', { x1: sx(plot.xMin), y1: sy(0), x2: sx(plot.xMax), y2: sy(0), class: 'function-axis' }));
    stage.appendChild(svg('line', { x1: sx(0), y1: sy(plot.yMin), x2: sx(0), y2: sy(plot.yMax), class: 'function-axis' }));
  }

  function drawPolarGrid() {
    const group = svg('g', {});
    const origin = point(0, 0);
    const corners = [
      { x: plot.xMin, y: plot.yMin },
      { x: plot.xMin, y: plot.yMax },
      { x: plot.xMax, y: plot.yMin },
      { x: plot.xMax, y: plot.yMax }
    ];
    const maxRadius = corners.reduce(function (max, p) {
      return Math.max(max, Math.hypot(p.x, p.y));
    }, 0);
    const tick = Number(state.tickLabelInterval) || 2;
    const radiusStep = tick > 0 ? tick : 2;
    for (let r = radiusStep; r <= maxRadius + 1e-9; r += radiusStep) {
      group.appendChild(svg('ellipse', {
        cx: origin.x,
        cy: origin.y,
        rx: Math.abs(sx(r) - sx(0)),
        ry: Math.abs(sy(r) - sy(0)),
        class: r % (radiusStep * 2) === 0 ? 'function-grid-major' : 'function-grid-minor',
        fill: 'none'
      }));
      if (tick > 0 && r <= plot.xMax && r >= plot.xMin) {
        const label = svg('text', { x: sx(r) + 5, y: sy(0) - 6, class: 'function-tick-label' });
        label.textContent = formatNumber(r);
        group.appendChild(label);
      }
    }
    for (let deg = 0; deg < 360; deg += 15) {
      const theta = deg * Math.PI / 180;
      group.appendChild(svg('line', {
        x1: origin.x,
        y1: origin.y,
        x2: sx(maxRadius * Math.cos(theta)),
        y2: sy(maxRadius * Math.sin(theta)),
        class: deg % 45 === 0 ? 'function-grid-major' : 'function-grid-minor'
      }));
    }
    const hasXAxis = plot.yMin <= 0 && plot.yMax >= 0;
    const hasYAxis = plot.xMin <= 0 && plot.xMax >= 0;
    if (hasXAxis) group.appendChild(svg('line', { x1: plot.left, y1: sy(0), x2: plot.right, y2: sy(0), class: 'function-axis' }));
    if (hasYAxis) group.appendChild(svg('line', { x1: sx(0), y1: plot.top, x2: sx(0), y2: plot.bottom, class: 'function-axis' }));
    stage.appendChild(group);
    if (hasXAxis) drawText('0', origin.x + 8, origin.y + 22, 'muted');
  }

  function valueAt(x, v, variant) {
    if (config.kind === 'gaussian') return v.a * Math.exp(-v.b * Math.pow(x - v.c, 2)) + v.d;
    if (config.kind === 'physics-simple-harmonic-motion') return v.a * Math.cos(v.b * x + v.c) + v.d;
    if (config.kind === 'physics-damped-oscillation') {
      if (x < 0) return NaN;
      return v.a * Math.exp(-v.b * x) * Math.cos(v.c * x + v.d);
    }
    if (config.kind === 'physics-projectile-motion') {
      if (x < 0) return NaN;
      const theta = v.b * Math.PI / 180;
      const cos = Math.cos(theta);
      if (Math.abs(cos) < 1e-10) return NaN;
      return x * Math.tan(theta) - (v.d * x * x) / (2 * v.a * v.a * cos * cos) + v.c;
    }
    if (config.kind === 'physics-inverse-square-law') {
      if (Math.abs(x) < 1e-10) return NaN;
      return v.a / (x * x) + v.b;
    }
    if (config.kind === 'physics-capacitor-discharge') {
      if (x < 0) return NaN;
      return v.a * Math.exp(-x / v.b) + v.c;
    }
    if (config.kind === 'physics-gravitational-potential') {
      if (x <= 0) return NaN;
      return -v.a / x + v.b;
    }
    if (config.kind === 'physics-ac-voltage') return v.a * Math.sin(v.b * x + v.c) + v.d;
    if (config.kind === 'physics-traveling-wave') return v.a * Math.sin(v.b * x - v.c * v.d + v.e);
    if (config.kind === 'physics-newton-cooling') {
      if (x < 0) return NaN;
      return v.b + (v.a - v.b) * Math.exp(-v.c * x);
    }
    if (config.kind === 'physics-spring-potential') return 0.5 * v.a * x * x + v.b;
    if (config.kind === 'physics-lorentz-factor') {
      if (Math.abs(x) >= v.a) return NaN;
      return 1 / Math.sqrt(1 - (x * x) / (v.a * v.a));
    }
    if (config.kind === 'physics-terminal-velocity') {
      if (x < 0) return NaN;
      return v.a * (1 - Math.exp(-v.b * x)) + v.c;
    }
    if (config.kind === 'physics-constant-acceleration-position') return v.a + v.b * x + 0.5 * v.c * x * x;
    if (config.kind === 'physics-constant-acceleration-velocity') return v.a + v.b * x;
    if (config.kind === 'physics-drag-fall-velocity') {
      if (x < 0) return NaN;
      return v.a * Math.tanh(v.b * x / v.a) + v.c;
    }
    if (config.kind === 'physics-pendulum-period') {
      if (x <= 0) return NaN;
      return 2 * Math.PI * Math.sqrt(x / v.a);
    }
    if (config.kind === 'physics-standing-wave') return 2 * v.a * Math.sin(v.b * x) * Math.cos(v.c * v.d);
    if (config.kind === 'physics-beats') return 2 * v.a * Math.cos(v.b * x / 2) * Math.sin(v.c * x + v.d);
    if (config.kind === 'physics-doppler-effect') {
      const denominator = v.b - v.d;
      if (Math.abs(denominator) < 1e-10) return NaN;
      return v.a * (v.b + x) / denominator;
    }
    if (config.kind === 'physics-rc-charging') {
      if (x < 0) return NaN;
      return v.a * (1 - Math.exp(-x / v.b)) + v.c;
    }
    if (config.kind === 'physics-rl-current') {
      if (x < 0) return NaN;
      return v.a * (1 - Math.exp(-x / v.b)) + v.c;
    }
    if (config.kind === 'physics-rlc-resonance') {
      if (x < 0) return NaN;
      return v.c / Math.sqrt(Math.pow(v.a * v.a - x * x, 2) + Math.pow(v.b * x, 2)) + v.d;
    }
    if (config.kind === 'physics-electric-potential') {
      if (x <= 0) return NaN;
      return v.a / x + v.b;
    }
    if (config.kind === 'physics-infinite-well-wavefunction') {
      if (x < 0 || x > v.b) return NaN;
      return v.c * Math.sqrt(2 / v.b) * Math.sin(v.a * Math.PI * x / v.b);
    }
    if (config.kind === 'physics-infinite-well-density') {
      if (x < 0 || x > v.b) return NaN;
      const psi = Math.sqrt(2 / v.b) * Math.sin(v.a * Math.PI * x / v.b);
      return v.c * psi * psi;
    }
    if (config.kind === 'physics-tunneling-decay') {
      if (x < 0) return NaN;
      return v.a * Math.exp(-v.b * x) + v.c;
    }
    if (config.kind === 'physics-boltzmann-factor') {
      if (x < 0) return NaN;
      return v.b * Math.exp(-x / v.a);
    }
    if (config.kind === 'physics-planck-distribution') {
      if (x <= 0) return NaN;
      const z = v.c / (x * v.a);
      if (z > 80) return 0;
      return v.b / (Math.pow(x, 5) * (Math.exp(z) - 1));
    }
    if (config.kind === 'physics-maxwell-speed-distribution') {
      if (x < 0) return NaN;
      return v.a * x * x * Math.exp(-v.b * x * x);
    }
    if (config.kind === 'physics-gaussian-wave-packet') {
      return v.a * Math.exp(-Math.pow(x - v.c, 2) / (2 * v.b * v.b)) * Math.cos(v.d * x + v.e);
    }
    if (config.kind === 'physics-fourier-square-wave') {
      let sum = 0;
      const terms = Math.max(1, Math.round(v.c));
      for (let n = 1; n <= terms; n += 1) {
        const harmonic = 2 * n - 1;
        sum += Math.sin(harmonic * v.b * x + v.d) / harmonic;
      }
      return 4 * v.a * sum / Math.PI;
    }
    if (config.kind === 'physics-lorentzian-line') {
      return v.a * v.c * v.c / (Math.pow(x - v.b, 2) + v.c * v.c) + v.d;
    }
    if (config.kind === 'physics-capacitor-energy') return 0.5 * v.a * x * x + v.b;
    if (config.kind === 'physics-inductor-energy') return 0.5 * v.a * x * x + v.b;
    if (config.kind === 'physics-ac-power') return v.a * Math.sin(v.c * x) * v.b * Math.sin(v.c * x - v.d);
    if (config.kind === 'physics-stefan-boltzmann') {
      if (x < 0) return NaN;
      return v.a * Math.pow(x, 4) + v.b;
    }
    if (config.kind === 'physics-wien-displacement') {
      if (x <= 0) return NaN;
      return v.a / x + v.b;
    }
    if (config.kind === 'physics-ideal-gas-isotherm') {
      if (x <= 0) return NaN;
      return v.a / x + v.b;
    }
    if (config.kind === 'physics-ideal-gas-adiabat') {
      if (x <= 0) return NaN;
      return v.a / Math.pow(x, v.b) + v.c;
    }
    if (config.kind === 'music-sine-frequency') return v.a * Math.sin(2 * Math.PI * v.b * x + v.c) + v.d;
    if (config.kind === 'music-harmonics') return v.a * Math.sin(v.c * v.b * x + v.d);
    if (config.kind === 'music-decibel') {
      if (x <= 0) return NaN;
      return 20 * Math.log(x / v.a) / Math.LN10 + v.b;
    }
    if (config.kind === 'music-fourier-synthesis') {
      let sum = 0;
      const terms = Math.max(1, Math.round(v.c));
      for (let n = 1; n <= terms; n += 1) {
        const harmonic = 2 * n - 1;
        sum += Math.sin(harmonic * v.b * x + v.d) / harmonic;
      }
      return 4 * v.a * sum / Math.PI;
    }
    if (config.kind === 'music-adsr-envelope') {
      if (x < 0) return NaN;
      if (x <= v.a) return x / v.a;
      if (x <= v.a + v.b) return 1 - (1 - v.c) * ((x - v.a) / v.b);
      if (x <= v.d) return v.c;
      if (x <= v.d + v.e) return v.c * (1 - (x - v.d) / v.e);
      return 0;
    }
    if (config.kind === 'music-equal-temperament') return v.a * Math.pow(2, (x - v.b) / 12) + v.c;
    if (config.kind === 'music-vibrato') return v.a * Math.sin(2 * Math.PI * v.b * x + v.d / v.e * (1 - Math.cos(2 * Math.PI * v.e * x)) + v.c);
    if (config.kind === 'music-tremolo') {
      const envelope = 1 + v.c * Math.sin(2 * Math.PI * v.d * x + v.e);
      return v.a * envelope * Math.sin(2 * Math.PI * v.b * x);
    }
    if (config.kind === 'music-am-modulation') {
      const envelope = 1 + v.c * Math.sin(2 * Math.PI * v.d * x);
      return v.a * envelope * Math.sin(2 * Math.PI * v.b * x + v.e);
    }
    if (config.kind === 'music-fm-modulation') return v.a * Math.sin(2 * Math.PI * v.b * x + v.c / v.d * (1 - Math.cos(2 * Math.PI * v.d * x)) + v.e);
    if (config.kind === 'music-decaying-tone') {
      if (x < 0) return NaN;
      return v.a * Math.exp(-v.c * x) * Math.sin(2 * Math.PI * v.b * x + v.d);
    }
    if (config.kind === 'music-just-intonation-ratio') {
      if (x <= 0) return NaN;
      return v.a * x + v.b;
    }
    if (config.kind === 'music-chord-superposition') {
      const base = 2 * Math.PI * v.b * x;
      return v.a * (Math.sin(base) + Math.sin(base * v.c) + Math.sin(base * v.d) + Math.sin(base * v.e)) / 4;
    }
    if (config.kind === 'music-harmonic-spectrum') {
      if (x < 1) return NaN;
      return v.a / Math.pow(x, v.b) + v.c;
    }
    if (config.kind === 'music-low-pass-filter') {
      if (x < 0) return NaN;
      return v.b / Math.sqrt(1 + Math.pow(x / v.a, 2)) + v.c;
    }
    if (config.kind === 'music-sampling') return v.a * Math.sin(2 * Math.PI * v.b * x + v.d);
    if (config.kind === 'music-aliasing') {
      const freq = variant === 'alias' ? aliasFrequency(v.b, v.c) : v.b;
      return v.a * Math.sin(2 * Math.PI * freq * x + v.d);
    }
    if (config.kind === 'chemistry-ph-log') {
      if (x <= 0) return NaN;
      return -Math.log(v.a * x) / Math.LN10;
    }
    if (config.kind === 'chemistry-first-order-decay') {
      if (x < 0) return NaN;
      return v.a * Math.exp(-v.b * x);
    }
    if (config.kind === 'chemistry-half-life') {
      if (x < 0) return NaN;
      return v.a * Math.pow(0.5, x / v.b);
    }
    if (config.kind === 'chemistry-henderson-hasselbalch') {
      if (x <= 0) return NaN;
      return v.a + Math.log(x) / Math.LN10;
    }
    if (config.kind === 'chemistry-arrhenius') {
      if (x <= 0) return NaN;
      return v.a * Math.exp(-v.b / (v.c * x));
    }
    if (config.kind === 'chemistry-ideal-gas-pressure') {
      if (x <= 0) return NaN;
      return v.a * v.c * v.b / x;
    }
    if (config.kind === 'chemistry-titration-curve') {
      return v.a + (v.c - v.a) / (1 + Math.exp(-v.d * (x - v.b)));
    }
    if (config.kind === 'chemistry-solubility-curve') return v.a * x * x + v.b * x + v.c;
    if (config.kind === 'chemistry-reaction-rate') {
      if (x < 0) return NaN;
      return v.a * Math.pow(x, v.b);
    }
    if (config.kind === 'chemistry-beer-lambert') {
      if (x < 0) return NaN;
      return v.a * v.b * x;
    }
    if (config.kind === 'chemistry-nernst') {
      if (x <= 0) return NaN;
      return v.a - (v.d * v.b / (v.c * v.e)) * Math.log(x);
    }
    if (config.kind === 'chemistry-vanthoff') {
      if (x <= 0) return NaN;
      return -v.a / (v.c * x) + v.b / v.c;
    }
    if (config.kind === 'chemistry-clausius-clapeyron') {
      if (x <= 0) return NaN;
      return -v.a / (v.c * x) + v.b;
    }
    if (config.kind === 'chemistry-michaelis-menten') {
      if (x < 0) return NaN;
      return v.a * x / (v.b + x);
    }
    if (config.kind === 'chemistry-langmuir-isotherm') {
      if (x < 0) return NaN;
      return v.a * x / (1 + v.a * x);
    }
    if (config.kind === 'chemistry-extraction-efficiency') {
      if (x < 0) return NaN;
      return x * v.a / (v.b + x * v.a);
    }
    if (config.kind === 'chemistry-dilution-dissociation') {
      if (x <= 0) return NaN;
      return Math.sqrt(v.a / x);
    }
    if (config.kind === 'chemistry-osmotic-pressure') {
      if (x < 0) return NaN;
      return v.a * v.b * v.c * x;
    }
    if (config.kind === 'chemistry-q10-temperature') return v.a * Math.pow(v.b, (x - v.c) / 10);
    if (config.kind === 'chemistry-absorbance-time') {
      if (x < 0) return NaN;
      return v.b + (v.a - v.b) * Math.exp(-v.c * x);
    }
    if (config.kind === 'chemistry-weak-acid-ph') {
      if (x <= 0) return NaN;
      return 0.5 * (v.a - Math.log(x) / Math.LN10);
    }
    if (config.kind === 'chemistry-ksp-solubility') {
      if (x < 0) return NaN;
      return Math.pow(v.a / Math.pow(x || 1, Math.max(0, v.b - 1)), 1 / Math.max(1, v.b));
    }
    if (config.kind === 'chemistry-henry-law') {
      if (x < 0) return NaN;
      return v.a * x;
    }
    if (config.kind === 'chemistry-raoult-law') {
      if (x < 0 || x > 1) return NaN;
      return v.a * x;
    }
    if (config.kind === 'chemistry-colligative-temperature') {
      if (x < 0) return NaN;
      return v.a * v.b * x;
    }
    if (config.kind === 'chemistry-zero-order-reaction') {
      if (x < 0) return NaN;
      return Math.max(0, v.a - v.b * x);
    }
    if (config.kind === 'chemistry-second-order-reaction') {
      if (x < 0) return NaN;
      return 1 / (v.b * x + 1 / v.a);
    }
    if (config.kind === 'chemistry-half-life-rate-constant') {
      if (x <= 0) return NaN;
      return v.b === 2 ? 1 / (x * v.a) : Math.LN2 / x;
    }
    if (config.kind === 'chemistry-boltzmann-distribution') {
      if (x < 0) return NaN;
      return v.b * Math.exp(-x / v.a);
    }
    if (config.kind === 'chemistry-maxwell-boltzmann') {
      if (x < 0) return NaN;
      const c = Math.pow(v.a / v.b, 1.5);
      return v.c * c * x * x * Math.exp(-v.a * x * x / (2 * v.b));
    }
    if (config.kind === 'medicine-blood-concentration') {
      if (x < 0) return NaN;
      return (v.a / v.b) * Math.pow(0.5, x / v.c);
    }
    if (config.kind === 'medicine-dose-response') {
      if (x < 0) return NaN;
      const dosePower = Math.pow(x, v.c);
      return v.d + v.a * dosePower / (Math.pow(v.b, v.c) + dosePower);
    }
    if (config.kind === 'medicine-sir-infected') {
      if (x < 0) return NaN;
      const maxTime = Math.min(x, 120);
      const steps = Math.max(1, Math.ceil(maxTime * 16));
      const dt = maxTime / steps;
      let s = 1 - v.c;
      let i = v.c;
      let r = 0;
      for (let step = 0; step < steps; step += 1) {
        const infection = v.a * s * i;
        const recovery = v.b * i;
        s = Math.max(0, s - infection * dt);
        i = Math.max(0, i + (infection - recovery) * dt);
        r = Math.max(0, r + recovery * dt);
        const total = s + i + r;
        if (total > 0) {
          s /= total;
          i /= total;
          r /= total;
        }
      }
      return i;
    }
    if (config.kind === 'medicine-growth-curve') {
      return v.b + (v.a - v.b) / (1 + Math.exp(-v.c * (x - v.d)));
    }
    if (config.kind === 'medicine-bmi-curve') {
      if (x <= 0) return NaN;
      return v.a * Math.pow(x / 100, 2);
    }
    if (config.kind === 'medicine-vital-cycle') {
      return v.c + v.a * Math.sin(2 * Math.PI * x / v.b + v.d);
    }
    if (config.kind === 'earth-atmospheric-pressure') {
      if (x < 0) return NaN;
      return v.a * Math.exp(-x / v.b);
    }
    if (config.kind === 'earth-seismic-wave-travel-time') {
      if (x < 0) return NaN;
      return x / v.a + v.b;
    }
    if (config.kind === 'earth-radiocarbon-dating') {
      if (x < 0) return NaN;
      return v.a * Math.pow(0.5, x / v.b);
    }
    if (config.kind === 'earth-geothermal-gradient') {
      if (x < 0) return NaN;
      return v.a + v.b * x;
    }
    if (config.kind === 'earth-tidal-height') return v.a * Math.sin(v.b * x + v.c) + v.d;
    if (config.kind === 'earth-river-profile') {
      if (x < 0) return NaN;
      return v.c + v.a * Math.exp(-x / v.b);
    }
    if (config.kind === 'environment-daily-temperature') return v.a + v.b * Math.sin(2 * Math.PI * (x - v.c) / 24);
    if (config.kind === 'environment-co2-increase') {
      if (x < 0) return NaN;
      return v.c + v.a * Math.exp(v.b * x);
    }
    if (config.kind === 'environment-diffusion-model') {
      const denominator = Math.sqrt(4 * Math.PI * v.b * v.c);
      return v.a / denominator * Math.exp(-(x * x) / (4 * v.b * v.c)) + v.d;
    }
    if (config.kind === 'environment-population-carrying-capacity') {
      if (x < 0) return NaN;
      const ratio = (v.a - v.b) / v.b;
      return v.a / (1 + ratio * Math.exp(-v.c * x));
    }
    if (config.kind === 'environment-precipitation-distribution') {
      if (x < 0) return 0;
      if (x === 0 && v.a < 1) return Infinity;
      if (x === 0 && v.a > 1) return 0;
      return v.c * Math.pow(x, v.a - 1) * Math.exp(-x / v.b) / (gammaFunction(v.a) * Math.pow(v.b, v.a));
    }
    if (config.kind === 'environment-wind-power') {
      if (x < v.b) return 0;
      return v.a * Math.pow(x - v.b, 3) + v.c;
    }
    if (config.kind === 'engineering-first-order-step') {
      if (x < 0) return NaN;
      return v.c + v.a * (1 - Math.exp(-x / v.b));
    }
    if (config.kind === 'engineering-second-order-step') {
      if (x < 0) return NaN;
      const wd = v.c * Math.sqrt(1 - v.b * v.b);
      return v.d + v.a * (1 - Math.exp(-v.b * v.c * x) * (Math.cos(wd * x) + (v.b / Math.sqrt(1 - v.b * v.b)) * Math.sin(wd * x)));
    }
    if (config.kind === 'engineering-low-pass') {
      if (x < 0) return NaN;
      return v.a / Math.sqrt(1 + Math.pow(x / v.b, 2));
    }
    if (config.kind === 'engineering-high-pass') {
      if (x < 0) return NaN;
      return v.a * x / Math.sqrt(x * x + v.b * v.b);
    }
    if (config.kind === 'engineering-stress-strain') {
      if (x < 0) return NaN;
      return x <= v.b ? v.a * x : v.a * v.b + v.c * (x - v.b);
    }
    if (config.kind === 'engineering-beam-deflection') {
      if (x < 0 || x > v.b) return NaN;
      const leftDistance = Math.min(x, v.b - x);
      return v.a * leftDistance * (3 * v.b * v.b - 4 * leftDistance * leftDistance) / (48 * v.c);
    }
    if (config.kind === 'standard-normal-distribution') return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
    if (config.kind === 'normal-distribution') return Math.exp(-0.5 * Math.pow((x - v.a) / v.b, 2)) / (v.b * Math.sqrt(2 * Math.PI));
    if (config.kind === 'normal-cdf-function') return normalCdf(x, v.a, v.b);
    if (config.kind === 'normal-survival-function') return 1 - normalCdf(x, v.a, v.b);
    if (config.kind === 'uniform-distribution') return x >= v.a && x <= v.b ? 1 / (v.b - v.a) : 0;
    if (config.kind === 'exponential-distribution') return x >= 0 ? v.a * Math.exp(-v.a * x) : 0;
    if (config.kind === 'gamma-distribution') {
      if (x < 0) return 0;
      if (x === 0 && v.a < 1) return Infinity;
      if (x === 0 && Math.abs(v.a - 1) < 1e-10) return 1 / v.b;
      return Math.pow(x, v.a - 1) * Math.exp(-x / v.b) / (gammaFunction(v.a) * Math.pow(v.b, v.a));
    }
    if (config.kind === 'beta-distribution') {
      if (x < 0 || x > 1) return 0;
      if ((x === 0 && v.a < 1) || (x === 1 && v.b < 1)) return Infinity;
      if ((x === 0 && v.a > 1) || (x === 1 && v.b > 1)) return 0;
      return Math.pow(x, v.a - 1) * Math.pow(1 - x, v.b - 1) / betaFunction(v.a, v.b);
    }
    if (config.kind === 'chi-square-distribution') {
      if (x < 0) return 0;
      if (x === 0 && v.a < 2) return Infinity;
      if (x === 0 && Math.abs(v.a - 2) < 1e-10) return 0.5;
      return Math.pow(x, v.a / 2 - 1) * Math.exp(-x / 2) / (Math.pow(2, v.a / 2) * gammaFunction(v.a / 2));
    }
    if (config.kind === 't-distribution') {
      return gammaFunction((v.a + 1) / 2) / (Math.sqrt(v.a * Math.PI) * gammaFunction(v.a / 2)) * Math.pow(1 + x * x / v.a, -(v.a + 1) / 2);
    }
    if (config.kind === 'f-distribution') {
      if (x < 0) return 0;
      if (x === 0 && v.a < 2) return Infinity;
      if (x === 0 && Math.abs(v.a - 2) < 1e-10) return Math.pow(v.a / v.b, v.a / 2) / betaFunction(v.a / 2, v.b / 2);
      const numerator = Math.pow(v.a / v.b, v.a / 2) * Math.pow(x, v.a / 2 - 1);
      const denominator = betaFunction(v.a / 2, v.b / 2) * Math.pow(1 + v.a * x / v.b, (v.a + v.b) / 2);
      return numerator / denominator;
    }
    if (config.kind === 'cauchy-distribution') {
      return 1 / (Math.PI * v.b * (1 + Math.pow((x - v.a) / v.b, 2)));
    }
    if (config.kind === 'weibull-distribution') {
      if (x < 0) return 0;
      if (x === 0 && v.a < 1) return Infinity;
      if (x === 0 && Math.abs(v.a - 1) < 1e-10) return 1 / v.b;
      return (v.a / v.b) * Math.pow(x / v.b, v.a - 1) * Math.exp(-Math.pow(x / v.b, v.a));
    }
    if (config.kind === 'lognormal-distribution') {
      if (x <= 0) return 0;
      return Math.exp(-Math.pow(Math.log(x) - v.a, 2) / (2 * v.b * v.b)) / (x * v.b * Math.sqrt(2 * Math.PI));
    }
    if (config.kind === 'laplace-distribution') {
      return Math.exp(-Math.abs(x - v.a) / v.b) / (2 * v.b);
    }
    if (config.kind === 'logistic-distribution') {
      const z = Math.exp(-(x - v.a) / v.b);
      return z / (v.b * Math.pow(1 + z, 2));
    }
    if (config.kind === 'rayleigh-distribution') {
      if (x < 0) return 0;
      return x / (v.a * v.a) * Math.exp(-x * x / (2 * v.a * v.a));
    }
    if (config.kind === 'pareto-distribution') {
      if (x < v.a) return 0;
      return v.b * Math.pow(v.a, v.b) / Math.pow(x, v.b + 1);
    }
    if (config.kind === 'triangular-distribution') {
      if (x < v.a || x > v.c) return 0;
      if (Math.abs(v.a - v.b) < 1e-10) return x <= v.b ? 2 / (v.c - v.a) : 2 * (v.c - x) / ((v.c - v.a) * (v.c - v.b));
      if (Math.abs(v.b - v.c) < 1e-10) return x >= v.b ? 2 / (v.c - v.a) : 2 * (x - v.a) / ((v.c - v.a) * (v.b - v.a));
      if (x <= v.b) return 2 * (x - v.a) / ((v.c - v.a) * (v.b - v.a));
      return 2 * (v.c - x) / ((v.c - v.a) * (v.c - v.b));
    }
    if (config.kind === 'derivative-polynomial') {
      if (variant === 'derivative') return 4 * v.a * Math.pow(x, 3) + 3 * v.b * Math.pow(x, 2) + 2 * v.c * x + v.d;
      return v.a * Math.pow(x, 4) + v.b * Math.pow(x, 3) + v.c * x * x + v.d * x + v.e;
    }
    if (config.kind === 'derivative-trig') {
      if (variant === 'derivative') return v.a * v.b * Math.cos(v.b * x + v.c);
      return v.a * Math.sin(v.b * x + v.c) + v.d;
    }
    if (config.kind === 'derivative-exponential') {
      const fx = v.a * Math.exp(v.b * x);
      return variant === 'derivative' ? v.b * fx : fx;
    }
    if (config.kind === 'derivative-logarithmic') {
      if (x <= v.c) return NaN;
      if (variant === 'derivative') return v.a / ((x - v.c) * Math.log(v.b));
      return v.a * Math.log(x - v.c) / Math.log(v.b) + v.d;
    }
    if (config.kind === 'calculus-tangent-normal') {
      const t = v.e;
      const y0 = cubicValue(v, t);
      const m = cubicDerivative(v, t);
      if (variant === 'tangent') return m * (x - t) + y0;
      if (variant === 'normal') {
        if (Math.abs(m) < 1e-10) return NaN;
        return (-1 / m) * (x - t) + y0;
      }
      return cubicValue(v, x);
    }
    if (config.kind === 'piecewise') return x < v.e ? v.a * x + v.b : v.c * x + v.d;
    if (config.kind === 'step' || config.kind === 'floor') return Math.floor(v.a * x + v.b);
    if (config.kind === 'ceil') return Math.ceil(v.a * x + v.b);
    if (config.kind === 'composition-linear') {
      return variant === 'gf'
        ? v.c * (v.a * x + v.b) + v.d
        : v.a * (v.c * x + v.d) + v.b;
    }
    if (config.kind === 'inverse-exp-log') {
      if (variant === 'inverse') {
        if (x <= 0) return NaN;
        return Math.log(x / v.a) / v.b;
      }
      return v.a * Math.exp(v.b * x);
    }
    return NaN;
  }

  function formula(v, variant) {
    if (config.kind === 'parametric') return 'x = ' + formatNumber(v.a) + 'sin(' + formatNumber(v.c) + 't), y = ' + formatNumber(v.b) + 'sin(' + formatNumber(v.d) + 't)';
    if (config.kind === 'polar') return polarFormula(v);
    if (config.kind === 'piecewise') return 'x < ' + formatNumber(v.e) + ': y = ' + formatNumber(v.a) + 'x' + signed(v.b) + ' / x ≥ ' + formatNumber(v.e) + ': y = ' + formatNumber(v.c) + 'x' + signed(v.d);
    if (config.kind === 'step') return variant === 'ceil' ? 'y = ceil(' + formatNumber(v.a) + 'x' + signed(v.b) + ')' : 'y = floor(' + formatNumber(v.a) + 'x' + signed(v.b) + ')';
    if (config.kind === 'floor') return 'y = floor(' + formatNumber(v.a) + 'x' + signed(v.b) + ')';
    if (config.kind === 'ceil') return 'y = ceil(' + formatNumber(v.a) + 'x' + signed(v.b) + ')';
    if (config.kind === 'composition-linear') {
      const slope = v.a * v.c;
      const intercept = variant === 'gf' ? v.c * v.b + v.d : v.a * v.d + v.b;
      const name = variant === 'gf' ? 'g(f(x))' : 'f(g(x))';
      return name + ' = ' + formatNumber(slope) + 'x' + signed(intercept);
    }
    if (config.kind === 'inverse-exp-log') return variant === 'inverse' ? 'y = ln(x/' + formatNumber(v.a) + ')/' + formatNumber(v.b) : 'y = ' + formatNumber(v.a) + 'e^(' + formatNumber(v.b) + 'x)';
    if (config.kind === 'gaussian') return 'y = ' + formatNumber(v.a) + 'e^(-' + formatNumber(v.b) + '(x' + (v.c >= 0 ? ' - ' + formatNumber(v.c) : ' + ' + formatNumber(Math.abs(v.c))) + ')²)' + signed(v.d);
    if (config.kind === 'physics-simple-harmonic-motion') return 'x(t) = ' + formatNumber(v.a) + 'cos(' + formatNumber(v.b) + 't' + signed(v.c) + ')' + signed(v.d);
    if (config.kind === 'physics-damped-oscillation') return 'x(t) = ' + formatNumber(v.a) + 'e^(-' + formatNumber(v.b) + 't)cos(' + formatNumber(v.c) + 't' + signed(v.d) + ')';
    if (config.kind === 'physics-projectile-motion') return 'y = x tan ' + formatNumber(v.b) + '° - gx²/(2v²cos²' + formatNumber(v.b) + '°)' + signed(v.c);
    if (config.kind === 'physics-inverse-square-law') return 'y = ' + formatNumber(v.a) + '/x²' + signed(v.b);
    if (config.kind === 'physics-capacitor-discharge') return 'V(t) = ' + formatNumber(v.a) + 'e^(-t/' + formatNumber(v.b) + ')' + signed(v.c);
    if (config.kind === 'physics-gravitational-potential') return 'U(r) = -' + formatNumber(v.a) + '/r' + signed(v.b);
    if (config.kind === 'physics-ac-voltage') return 'V(t) = ' + formatNumber(v.a) + 'sin(' + formatNumber(v.b) + 't' + signed(v.c) + ')' + signed(v.d);
    if (config.kind === 'physics-traveling-wave') return 'y(x) = ' + formatNumber(v.a) + 'sin(' + formatNumber(v.b) + 'x - ' + formatNumber(v.c) + 't' + signed(v.e) + '), t=' + formatNumber(v.d);
    if (config.kind === 'physics-newton-cooling') return 'T(t) = ' + formatNumber(v.b) + ' + (' + formatNumber(v.a) + ' - ' + formatNumber(v.b) + ')e^(-' + formatNumber(v.c) + 't)';
    if (config.kind === 'physics-spring-potential') return 'U(x) = 1/2 ' + formatNumber(v.a) + 'x²' + signed(v.b);
    if (config.kind === 'physics-lorentz-factor') return 'γ(v) = 1/√(1 - v²/' + formatNumber(v.a) + '²)';
    if (config.kind === 'physics-terminal-velocity') return 'v(t) = ' + formatNumber(v.a) + '(1 - e^(-' + formatNumber(v.b) + 't))' + signed(v.c);
    if (config.kind === 'physics-constant-acceleration-position') return 'x(t) = ' + formatNumber(v.a) + signed(v.b) + 't' + signed(0.5 * v.c) + 't²';
    if (config.kind === 'physics-constant-acceleration-velocity') return 'v(t) = ' + formatNumber(v.a) + signed(v.b) + 't';
    if (config.kind === 'physics-drag-fall-velocity') return 'v(t) = ' + formatNumber(v.a) + 'tanh(' + formatNumber(v.b) + 't/' + formatNumber(v.a) + ')' + signed(v.c);
    if (config.kind === 'physics-pendulum-period') return 'T(L) = 2π√(L/' + formatNumber(v.a) + ')';
    if (config.kind === 'physics-standing-wave') return 'y(x) = 2·' + formatNumber(v.a) + 'sin(' + formatNumber(v.b) + 'x)cos(' + formatNumber(v.c) + 't), t=' + formatNumber(v.d);
    if (config.kind === 'physics-beats') return 'y(t) = 2·' + formatNumber(v.a) + 'cos(' + formatNumber(v.b) + 't/2)sin(' + formatNumber(v.c) + 't' + signed(v.d) + ')';
    if (config.kind === 'physics-doppler-effect') return "f' = " + formatNumber(v.a) + '(' + formatNumber(v.b) + ' + vₒ)/(' + formatNumber(v.b) + signed(-v.d) + ')';
    if (config.kind === 'physics-rc-charging') return 'V(t) = ' + formatNumber(v.a) + '(1 - e^(-t/' + formatNumber(v.b) + '))' + signed(v.c);
    if (config.kind === 'physics-rl-current') return 'I(t) = ' + formatNumber(v.a) + '(1 - e^(-t/' + formatNumber(v.b) + '))' + signed(v.c);
    if (config.kind === 'physics-rlc-resonance') return 'A(ω) = ' + formatNumber(v.c) + '/√((ω₀²-ω²)²+(βω)²)' + signed(v.d);
    if (config.kind === 'physics-electric-potential') return 'V(r) = ' + formatNumber(v.a) + '/r' + signed(v.b);
    if (config.kind === 'physics-infinite-well-wavefunction') return 'ψₙ(x) = √(2/' + formatNumber(v.b) + ')sin(' + formatNumber(v.a) + 'πx/' + formatNumber(v.b) + ')';
    if (config.kind === 'physics-infinite-well-density') return '|ψₙ(x)|², n=' + formatNumber(v.a) + ', L=' + formatNumber(v.b);
    if (config.kind === 'physics-tunneling-decay') return 'ψ(x) = ' + formatNumber(v.a) + 'e^(-' + formatNumber(v.b) + 'x)' + signed(v.c);
    if (config.kind === 'physics-boltzmann-factor') return 'y = ' + formatNumber(v.b) + 'e^(-E/' + formatNumber(v.a) + ')';
    if (config.kind === 'physics-planck-distribution') return 'B(λ) = A/(λ⁵(e^(B/(λT))-1))';
    if (config.kind === 'physics-maxwell-speed-distribution') return 'f(v) = ' + formatNumber(v.a) + 'v²e^(-' + formatNumber(v.b) + 'v²)';
    if (config.kind === 'physics-gaussian-wave-packet') return 'ψ(x) = ' + formatNumber(v.a) + 'e^{-((x-x₀)²)/(2σ²)}cos(kx+φ)';
    if (config.kind === 'physics-fourier-square-wave') return 'y(t) = 4A/π Σ sin((2m-1)ωt+φ)/(2m-1), N=' + formatNumber(v.c);
    if (config.kind === 'physics-lorentzian-line') return 'L(x) = Aγ²/((x-x₀)²+γ²)' + signed(v.d);
    if (config.kind === 'physics-capacitor-energy') return 'U(V) = 1/2 ' + formatNumber(v.a) + 'V²' + signed(v.b);
    if (config.kind === 'physics-inductor-energy') return 'U(I) = 1/2 ' + formatNumber(v.a) + 'I²' + signed(v.b);
    if (config.kind === 'physics-ac-power') return 'p(t) = V₀sin(ωt) I₀sin(ωt-φ)';
    if (config.kind === 'physics-stefan-boltzmann') return 'P(T) = ' + formatNumber(v.a) + 'T⁴' + signed(v.b);
    if (config.kind === 'physics-wien-displacement') return 'λmax(T) = ' + formatNumber(v.a) + '/T' + signed(v.b);
    if (config.kind === 'physics-ideal-gas-isotherm') return 'P(V) = ' + formatNumber(v.a) + '/V' + signed(v.b);
    if (config.kind === 'physics-ideal-gas-adiabat') return 'P(V) = ' + formatNumber(v.a) + '/V^' + formatNumber(v.b) + signed(v.c);
    if (config.kind === 'music-sine-frequency') return 'y(t) = ' + formatNumber(v.a) + 'sin(2π·' + formatNumber(v.b) + 't' + signed(v.c) + ')' + signed(v.d);
    if (config.kind === 'music-harmonics') return 'y(t) = ' + formatNumber(v.a) + 'sin(' + formatNumber(v.c) + '·' + formatNumber(v.b) + 't' + signed(v.d) + ')';
    if (config.kind === 'music-decibel') return 'L = 20log₁₀(A/' + formatNumber(v.a) + ')' + signed(v.b);
    if (config.kind === 'music-fourier-synthesis') return 'y(t) = 4·' + formatNumber(v.a) + '/π Σ sin((2k-1)' + formatNumber(v.b) + 't)/(2k-1), N=' + formatNumber(v.c);
    if (config.kind === 'music-adsr-envelope') return 'ADSR: A=' + formatNumber(v.a) + ', D=' + formatNumber(v.b) + ', S=' + formatNumber(v.c) + ', R=' + formatNumber(v.e);
    if (config.kind === 'music-equal-temperament') return 'f(n) = ' + formatNumber(v.a) + '·2^((n' + signed(-v.b) + ')/12)' + signed(v.c);
    if (config.kind === 'music-vibrato') return 'y(t) = ' + formatNumber(v.a) + 'sin(2π·' + formatNumber(v.b) + 't + vibrato)';
    if (config.kind === 'music-tremolo') return 'y(t) = ' + formatNumber(v.a) + '(1 + ' + formatNumber(v.c) + 'sin(2π·' + formatNumber(v.d) + 't))sin(2π·' + formatNumber(v.b) + 't)';
    if (config.kind === 'music-am-modulation') return 'AM: y(t) = ' + formatNumber(v.a) + '(1 + ' + formatNumber(v.c) + 'sin(2π·' + formatNumber(v.d) + 't))sin(2π·' + formatNumber(v.b) + 't)';
    if (config.kind === 'music-fm-modulation') return 'FM: y(t) = ' + formatNumber(v.a) + 'sin(2π·' + formatNumber(v.b) + 't + Δf/fm modulation)';
    if (config.kind === 'music-decaying-tone') return 'y(t) = ' + formatNumber(v.a) + 'e^(-' + formatNumber(v.c) + 't)sin(2π·' + formatNumber(v.b) + 't' + signed(v.d) + ')';
    if (config.kind === 'music-just-intonation-ratio') return 'f = ' + formatNumber(v.a) + '·ratio' + signed(v.b);
    if (config.kind === 'music-chord-superposition') return 'y(t) = sum of ratios 1:' + formatNumber(v.c) + ':' + formatNumber(v.d) + ':' + formatNumber(v.e);
    if (config.kind === 'music-harmonic-spectrum') return 'Aₙ = ' + formatNumber(v.a) + '/n^' + formatNumber(v.b) + signed(v.c);
    if (config.kind === 'music-low-pass-filter') return 'H(f) = ' + formatNumber(v.b) + '/√(1+(f/' + formatNumber(v.a) + ')²)' + signed(v.c);
    if (config.kind === 'music-sampling') return 'sampled: f=' + formatNumber(v.b) + ', fs=' + formatNumber(v.c);
    if (config.kind === 'music-aliasing') return variant === 'alias'
      ? 'alias f = ' + formatNumber(aliasFrequency(v.b, v.c))
      : 'original f = ' + formatNumber(v.b);
    if (config.kind === 'chemistry-ph-log') return 'pH = -log₁₀(' + formatNumber(v.a) + '[H⁺])';
    if (config.kind === 'chemistry-first-order-decay') return 'C(t) = ' + formatNumber(v.a) + 'e^(-' + formatNumber(v.b) + 't)';
    if (config.kind === 'chemistry-half-life') return 'N(t) = ' + formatNumber(v.a) + '(1/2)^(t/' + formatNumber(v.b) + ')';
    if (config.kind === 'chemistry-henderson-hasselbalch') return 'pH = ' + formatNumber(v.a) + ' + log₁₀([A⁻]/[HA])';
    if (config.kind === 'chemistry-arrhenius') return 'k = ' + formatNumber(v.a) + 'e^(-' + formatNumber(v.b) + '/(' + formatNumber(v.c) + 'T))';
    if (config.kind === 'chemistry-ideal-gas-pressure') return 'P = nRT/V';
    if (config.kind === 'chemistry-titration-curve') return 'pH = ' + formatNumber(v.a) + ' + (' + formatNumber(v.c) + ' - ' + formatNumber(v.a) + ')/(1+e^(-' + formatNumber(v.d) + '(V-' + formatNumber(v.b) + ')))';
    if (config.kind === 'chemistry-solubility-curve') return 'S(T) = ' + formatNumber(v.a) + 'T²' + signed(v.b) + 'T' + signed(v.c);
    if (config.kind === 'chemistry-reaction-rate') return 'rate = ' + formatNumber(v.a) + '[A]^' + formatNumber(v.b);
    if (config.kind === 'chemistry-beer-lambert') return 'A = εlc = ' + formatNumber(v.a) + '·' + formatNumber(v.b) + '·c';
    if (config.kind === 'chemistry-nernst') return 'E = ' + formatNumber(v.a) + ' - RT/(nF) ln Q';
    if (config.kind === 'chemistry-vanthoff') return 'ln K = -ΔH/(RT) + ΔS/R';
    if (config.kind === 'chemistry-clausius-clapeyron') return 'ln P = -ΔHᵥₐₚ/(RT) + C';
    if (config.kind === 'chemistry-michaelis-menten') return 'v = ' + formatNumber(v.a) + '[S]/(' + formatNumber(v.b) + ' + [S])';
    if (config.kind === 'chemistry-langmuir-isotherm') return 'θ = ' + formatNumber(v.a) + 'P/(1 + ' + formatNumber(v.a) + 'P)';
    if (config.kind === 'chemistry-extraction-efficiency') return 'E = KᴅVorg/(Vaq + KᴅVorg)';
    if (config.kind === 'chemistry-dilution-dissociation') return 'α ≈ √(Ka/C)';
    if (config.kind === 'chemistry-osmotic-pressure') return 'π = iCRT';
    if (config.kind === 'chemistry-q10-temperature') return 'rate = ' + formatNumber(v.a) + '·' + formatNumber(v.b) + '^((T-' + formatNumber(v.c) + ')/10)';
    if (config.kind === 'chemistry-absorbance-time') return 'A(t) = ' + formatNumber(v.b) + ' + (' + formatNumber(v.a) + ' - ' + formatNumber(v.b) + ')e^(-' + formatNumber(v.c) + 't)';
    if (config.kind === 'chemistry-weak-acid-ph') return 'pH ≈ 1/2(pKa - log C)';
    if (config.kind === 'chemistry-ksp-solubility') return 's ≈ (Ksp / c^(' + formatNumber(Math.max(0, v.b - 1)) + '))^(1/' + formatNumber(Math.max(1, v.b)) + ')';
    if (config.kind === 'chemistry-henry-law') return 'C = ' + formatNumber(v.a) + 'P';
    if (config.kind === 'chemistry-raoult-law') return 'P = ' + formatNumber(v.a) + 'X';
    if (config.kind === 'chemistry-colligative-temperature') return 'ΔT = ' + formatNumber(v.a) + '·' + formatNumber(v.b) + 'm';
    if (config.kind === 'chemistry-zero-order-reaction') return '[A] = ' + formatNumber(v.a) + ' - ' + formatNumber(v.b) + 't';
    if (config.kind === 'chemistry-second-order-reaction') return '[A] = 1/(' + formatNumber(v.b) + 't + 1/' + formatNumber(v.a) + ')';
    if (config.kind === 'chemistry-half-life-rate-constant') return v.b === 2 ? 't₁/₂ = 1/(k[A]₀)' : 't₁/₂ = ln2/k';
    if (config.kind === 'chemistry-boltzmann-distribution') return 'N(E) ∝ e^(-E/kT)';
    if (config.kind === 'chemistry-maxwell-boltzmann') return 'f(v) ∝ v²e^(-mv²/(2kT))';
    if (config.kind === 'medicine-blood-concentration') return 'C(t) = D/Vd · (1/2)^(t/t₁/₂)';
    if (config.kind === 'medicine-dose-response') return 'E(C) = E0 + Emax C^n/(EC50^n + C^n)';
    if (config.kind === 'medicine-sir-infected') return 'SIR: dI/dt = βSI - γI';
    if (config.kind === 'medicine-growth-curve') return 'H(t) = H0 + (Hmax-H0)/(1 + e^{-k(t-t0)})';
    if (config.kind === 'medicine-bmi-curve') return '体重 = BMI × (身長/100)²';
    if (config.kind === 'medicine-vital-cycle') return 'y(t) = baseline + A sin(2πt/T + φ)';
    if (config.kind === 'earth-atmospheric-pressure') return 'P(h) = ' + formatNumber(v.a) + 'e^(-h/' + formatNumber(v.b) + ')';
    if (config.kind === 'earth-seismic-wave-travel-time') return 't(d) = d/' + formatNumber(v.a) + signed(v.b);
    if (config.kind === 'earth-radiocarbon-dating') return 'N(t) = ' + formatNumber(v.a) + '(1/2)^(t/' + formatNumber(v.b) + ')';
    if (config.kind === 'earth-geothermal-gradient') return 'T(z) = ' + formatNumber(v.a) + signed(v.b) + 'z';
    if (config.kind === 'earth-tidal-height') return 'h(t) = ' + formatNumber(v.a) + 'sin(' + formatNumber(v.b) + 't' + signed(v.c) + ')' + signed(v.d);
    if (config.kind === 'earth-river-profile') return 'H(x) = ' + formatNumber(v.c) + ' + ' + formatNumber(v.a) + 'e^(-x/' + formatNumber(v.b) + ')';
    if (config.kind === 'environment-daily-temperature') return 'T(t) = ' + formatNumber(v.a) + ' + ' + formatNumber(v.b) + 'sin(2π(t-' + formatNumber(v.c) + ')/24)';
    if (config.kind === 'environment-co2-increase') return 'C(t) = ' + formatNumber(v.c) + ' + ' + formatNumber(v.a) + 'e^(' + formatNumber(v.b) + 't)';
    if (config.kind === 'environment-diffusion-model') return 'C(x) = M/√(4πDt) exp(-x²/(4Dt))' + signed(v.d);
    if (config.kind === 'environment-population-carrying-capacity') return 'N(t) = K/(1 + ((K-N0)/N0)e^(-rt))';
    if (config.kind === 'environment-precipitation-distribution') return 'f(x) = A x^(k-1)e^(-x/θ)/(Γ(k)θ^k)';
    if (config.kind === 'environment-wind-power') return 'P(v) = ' + formatNumber(v.a) + '(v' + signed(-v.b) + ')³' + signed(v.c);
    if (config.kind === 'engineering-first-order-step') return 'y(t) = ' + formatNumber(v.c) + ' + ' + formatNumber(v.a) + '(1 - e^(-t/' + formatNumber(v.b) + '))';
    if (config.kind === 'engineering-second-order-step') return 'y(t) = ' + formatNumber(v.d) + ' + step(K=' + formatNumber(v.a) + ', ζ=' + formatNumber(v.b) + ', ωn=' + formatNumber(v.c) + ')';
    if (config.kind === 'engineering-low-pass') return '|H(f)| = ' + formatNumber(v.a) + '/√(1 + (f/' + formatNumber(v.b) + ')²)';
    if (config.kind === 'engineering-high-pass') return '|H(f)| = ' + formatNumber(v.a) + 'f/√(f² + ' + formatNumber(v.b) + '²)';
    if (config.kind === 'engineering-stress-strain') return 'σ(ε) = Eε, ε≤εy / σy + H(ε-εy)';
    if (config.kind === 'engineering-beam-deflection') return 'δ(x) = Pa(3L² - 4a²)/(48EI), a=min(x,L-x)';
    if (config.kind === 'standard-normal-distribution') return 'P(Z ≤ ' + formatNumber(v.a) + ')';
    if (config.kind === 'normal-distribution') return 'y = 1/(' + formatNumber(v.b) + '√(2π)) e^{-((x' + (v.a >= 0 ? ' - ' + formatNumber(v.a) : ' + ' + formatNumber(Math.abs(v.a))) + ')²)/(2' + formatNumber(v.b) + '²)}';
    if (config.kind === 'normal-cdf-function') return 'F(x) = P(X ≤ x), X ~ N(' + formatNumber(v.a) + ', ' + formatNumber(v.b) + '²)';
    if (config.kind === 'normal-survival-function') return 'S(x) = P(X > x) = 1 - F(x)';
    if (config.kind === 'uniform-distribution') return formatNumber(v.a) + ' ≤ x ≤ ' + formatNumber(v.b) + ': y = ' + formatNumber(1 / (v.b - v.a));
    if (config.kind === 'exponential-distribution') return 'x ≥ 0: y = ' + formatNumber(v.a) + 'e^(-' + formatNumber(v.a) + 'x)';
    if (config.kind === 'gamma-distribution') return 'Gamma(α=' + formatNumber(v.a) + ', θ=' + formatNumber(v.b) + ')';
    if (config.kind === 'beta-distribution') return 'Beta(α=' + formatNumber(v.a) + ', β=' + formatNumber(v.b) + ')';
    if (config.kind === 'chi-square-distribution') return 'χ²(k=' + formatNumber(v.a) + ')';
    if (config.kind === 't-distribution') return 't(ν=' + formatNumber(v.a) + ')';
    if (config.kind === 'f-distribution') return 'F(d1=' + formatNumber(v.a) + ', d2=' + formatNumber(v.b) + ')';
    if (config.kind === 'geometric-distribution') return 'P(X=k) = (1 - ' + formatNumber(v.a) + ')^(k-1)' + formatNumber(v.a);
    if (config.kind === 'cauchy-distribution') return 'Cauchy(x₀=' + formatNumber(v.a) + ', γ=' + formatNumber(v.b) + ')';
    if (config.kind === 'bernoulli-distribution') return 'P(X=1) = ' + formatNumber(v.a) + ', P(X=0) = ' + formatNumber(1 - v.a);
    if (config.kind === 'negative-binomial-distribution') return 'P(X=k) = C(k-1, r-1)p^r(1-p)^(k-r)';
    if (config.kind === 'hypergeometric-distribution') return 'P(X=k) = C(K,k)C(N-K,n-k)/C(N,n)';
    if (config.kind === 'weibull-distribution') return 'Weibull(k=' + formatNumber(v.a) + ', λ=' + formatNumber(v.b) + ')';
    if (config.kind === 'lognormal-distribution') return 'Lognormal(μ=' + formatNumber(v.a) + ', σ=' + formatNumber(v.b) + ')';
    if (config.kind === 'laplace-distribution') return 'Laplace(μ=' + formatNumber(v.a) + ', b=' + formatNumber(v.b) + ')';
    if (config.kind === 'logistic-distribution') return 'Logistic(μ=' + formatNumber(v.a) + ', s=' + formatNumber(v.b) + ')';
    if (config.kind === 'rayleigh-distribution') return 'Rayleigh(σ=' + formatNumber(v.a) + ')';
    if (config.kind === 'pareto-distribution') return 'Pareto(xₘ=' + formatNumber(v.a) + ', α=' + formatNumber(v.b) + ')';
    if (config.kind === 'triangular-distribution') return 'Triangular(a=' + formatNumber(v.a) + ', m=' + formatNumber(v.b) + ', b=' + formatNumber(v.c) + ')';
    if (config.kind === 'derivative-polynomial') {
      if (variant === 'derivative') return "f'(x) = " + polynomialExpression([
        { coefficient: 4 * v.a, variable: 'x³' },
        { coefficient: 3 * v.b, variable: 'x²' },
        { coefficient: 2 * v.c, variable: 'x' },
        { coefficient: v.d, variable: '' }
      ]);
      return 'f(x) = ' + polynomialExpression([
        { coefficient: v.a, variable: 'x⁴' },
        { coefficient: v.b, variable: 'x³' },
        { coefficient: v.c, variable: 'x²' },
        { coefficient: v.d, variable: 'x' },
        { coefficient: v.e, variable: '' }
      ]);
    }
    if (config.kind === 'derivative-trig') {
      if (variant === 'derivative') return "f'(x) = " + formatNumber(v.a * v.b) + 'cos(' + formatNumber(v.b) + 'x' + signed(v.c) + ')';
      return 'f(x) = ' + formatNumber(v.a) + 'sin(' + formatNumber(v.b) + 'x' + signed(v.c) + ')' + signed(v.d);
    }
    if (config.kind === 'derivative-exponential') {
      if (variant === 'derivative') return "f'(x) = " + formatNumber(v.a * v.b) + 'e^(' + formatNumber(v.b) + 'x)';
      return 'f(x) = ' + formatNumber(v.a) + 'e^(' + formatNumber(v.b) + 'x)';
    }
    if (config.kind === 'derivative-logarithmic') {
      if (variant === 'derivative') return "f'(x) = " + formatNumber(v.a) + ' / ((x' + signed(-v.c) + ')ln ' + formatNumber(v.b) + ')';
      return 'f(x) = ' + formatNumber(v.a) + 'log_' + formatNumber(v.b) + '(x' + signed(-v.c) + ')' + signed(v.d);
    }
    if (config.kind === 'calculus-tangent-normal') {
      const t = v.e;
      const y0 = cubicValue(v, t);
      const m = cubicDerivative(v, t);
      if (variant === 'tangent') return '接線: y = ' + formatNumber(m) + '(x' + signed(-t) + ')' + signed(y0);
      if (variant === 'normal') {
        return Math.abs(m) < 1e-10
          ? '法線: x = ' + formatNumber(t)
          : '法線: y = ' + formatNumber(-1 / m) + '(x' + signed(-t) + ')' + signed(y0);
      }
      return 'f(x) = ' + polynomialExpression([
        { coefficient: v.a, variable: 'x³' },
        { coefficient: v.b, variable: 'x²' },
        { coefficient: v.c, variable: 'x' },
        { coefficient: v.d, variable: '' }
      ]);
    }
    if (config.kind === 'binomial-distribution') return 'P(X=k) = C(' + formatNumber(v.a) + ', k)' + formatNumber(v.b) + '^k(1-' + formatNumber(v.b) + ')^(' + formatNumber(v.a) + '-k)';
    if (config.kind === 'poisson-distribution') return 'P(X=k) = e^(-' + formatNumber(v.a) + ')' + formatNumber(v.a) + '^k / k!';
    return '';
  }

  function pathFromPoints(points) {
    return points.map(function (p, index) {
      return (index === 0 ? 'M ' : 'L ') + p.x + ' ' + p.y;
    }).join(' ');
  }

  function drawPath(points, stroke) {
    if (points.length < 2) return;
    const curveId = arguments.length > 2 && arguments[2] ? arguments[2] : 'function';
    const curveState = getCurveState(curveId, stroke || '#2a5bd7');
    const path = svg('path', { d: pathFromPoints(points), class: 'function-curve' });
    path.style.stroke = curveState.color || stroke || '#2a5bd7';
    stage.appendChild(path);
    const hit = svg('path', { d: path.getAttribute('d'), class: 'function-curve-hit' });
    hit.addEventListener('click', function () {
      if (!moveMode) openCurveSheet(curveId);
    });
    stage.appendChild(hit);
  }

  function drawSegments(segments, stroke) {
    const curveId = arguments.length > 2 && arguments[2] ? arguments[2] : 'function';
    segments.forEach(function (segment) {
      drawPath(segment, stroke, curveId);
    });
  }

  function drawVerticalCurveLine(x, stroke, curveId) {
    if (x < plot.xMin || x > plot.xMax) return;
    const curveState = getCurveState(curveId, stroke || '#2e7d32');
    const line = svg('line', {
      x1: sx(x),
      y1: sy(plot.yMin),
      x2: sx(x),
      y2: sy(plot.yMax),
      class: 'function-curve'
    });
    line.style.stroke = curveState.color || stroke || '#2e7d32';
    stage.appendChild(line);
    const hit = svg('line', {
      x1: sx(x),
      y1: sy(plot.yMin),
      x2: sx(x),
      y2: sy(plot.yMax),
      class: 'function-line-hit'
    });
    hit.addEventListener('click', function () {
      if (!moveMode) openCurveSheet(curveId);
    });
    stage.appendChild(hit);
  }

  function drawMarkedPoint(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < plot.xMin || x > plot.xMax || y < plot.yMin || y > plot.yMax) return;
    const p = point(x, y);
    const dot = svg('circle', { cx: p.x, cy: p.y, r: 7, fill: '#e25555', stroke: '#fff', 'stroke-width': 3 });
    stage.appendChild(dot);
  }

  function getCurveState(id, fallbackColor) {
    if (!state.curves[id]) {
      state.curves[id] = {
        labelMode: 'formula',
        labelText: '',
        color: fallbackColor || '#2a5bd7'
      };
    }
    if (!state.curves[id].color) state.curves[id].color = fallbackColor || '#2a5bd7';
    return state.curves[id];
  }

  function drawCurveFormulaLabel(v, variant, x, y, curveId) {
    const curveState = getCurveState(curveId, curveId === 'derivative' ? '#8e44ad' : '#2a5bd7');
    if (curveState.labelMode === 'hidden') return;
    const label = curveState.labelMode === 'text' ? curveState.labelText : formula(v, variant);
    if (!label) return;
    drawText(label, x, y, 'muted', function () { openCurveSheet(curveId); }, { kind: 'curve', id: curveId });
  }

  function hexToRgba(hex, alpha) {
    const match = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!match) return 'rgba(42,91,215,' + alpha + ')';
    const raw = match[1];
    return 'rgba(' + parseInt(raw.slice(0, 2), 16) + ',' + parseInt(raw.slice(2, 4), 16) + ',' + parseInt(raw.slice(4, 6), 16) + ',' + alpha + ')';
  }

  function gaussianAreaSegments(v) {
    const segments = [];
    let points = [];
    const steps = 700;
    const rightLimit = cumulativeRightLimit(v);
    for (let i = 0; i <= steps; i += 1) {
      const x = plot.xMin + (plot.xMax - plot.xMin) * (i / steps);
      if (Number.isFinite(rightLimit) && x > rightLimit + 1e-9) {
        if (points.length > 1) segments.push(points);
        points = [];
        continue;
      }
      const y = valueAt(x, v);
      if (!Number.isFinite(y) || y < plot.yMin - 1e-9 || y > plot.yMax + 1e-9 || plot.yMin > 0 || plot.yMax < 0) {
        if (points.length > 1) segments.push(points);
        points = [];
      } else {
        points.push(point(x, y));
      }
    }
    if (points.length > 1) segments.push(points);
    return segments;
  }

  function approximateAxisArea(v) {
    const exact = exactAxisArea(v);
    if (Number.isFinite(exact)) return exact;
    let area = 0;
    const steps = 1600;
    for (let i = 0; i < steps; i += 1) {
      const x1 = plot.xMin + (plot.xMax - plot.xMin) * (i / steps);
      const x2 = plot.xMin + (plot.xMax - plot.xMin) * ((i + 1) / steps);
      const y1 = valueAt(x1, v);
      const y2 = valueAt(x2, v);
      if (Number.isFinite(y1) && Number.isFinite(y2)) area += (Math.abs(y1) + Math.abs(y2)) * (x2 - x1) / 2;
    }
    return area;
  }

  function cumulativeRightLimit(v) {
    const key = config.cumulativeParam;
    if (!key) return NaN;
    return Number(v[key]);
  }

  function erf(x) {
    const sign = x < 0 ? -1 : 1;
    const ax = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * ax);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
    return sign * y;
  }

  function normalCdf(x, mu, sigma) {
    return 0.5 * (1 + erf((x - mu) / (sigma * Math.sqrt(2))));
  }

  function integrateFinite(fn, left, right) {
    if (!Number.isFinite(left) || !Number.isFinite(right) || right <= left) return 0;
    const steps = 3600;
    const width = (right - left) / steps;
    let total = 0;
    for (let i = 0; i < steps; i += 1) {
      const x = left + (i + 0.5) * width;
      const y = fn(x);
      if (Number.isFinite(y) && y > 0) total += y * width;
    }
    return Math.max(0, Math.min(1, total));
  }

  function cumulativeProbability(v, z) {
    if (!Number.isFinite(z)) return NaN;
    if (config.kind === 'standard-normal-distribution') return normalCdf(z, 0, 1);
    if (config.kind === 'normal-distribution') return normalCdf(z, v.a, v.b);
    if (config.kind === 'uniform-distribution') return z <= v.a ? 0 : (z >= v.b ? 1 : (z - v.a) / (v.b - v.a));
    if (config.kind === 'exponential-distribution') return z <= 0 ? 0 : 1 - Math.exp(-v.a * z);
    if (config.kind === 'weibull-distribution') return z <= 0 ? 0 : 1 - Math.exp(-Math.pow(z / v.b, v.a));
    if (config.kind === 'rayleigh-distribution') return z <= 0 ? 0 : 1 - Math.exp(-z * z / (2 * v.a * v.a));
    if (config.kind === 'lognormal-distribution') return z <= 0 ? 0 : normalCdf(Math.log(z), v.a, v.b);
    if (config.kind === 'pareto-distribution') return z < v.a ? 0 : 1 - Math.pow(v.a / z, v.b);
    if (config.kind === 'cauchy-distribution') return 0.5 + Math.atan((z - v.a) / v.b) / Math.PI;
    if (config.kind === 'laplace-distribution') {
      return z < v.a ? 0.5 * Math.exp((z - v.a) / v.b) : 1 - 0.5 * Math.exp(-(z - v.a) / v.b);
    }
    if (config.kind === 'logistic-distribution') return 1 / (1 + Math.exp(-(z - v.a) / v.b));
    if (config.kind === 'triangular-distribution') {
      if (z <= v.a) return 0;
      if (z >= v.c) return 1;
      if (z <= v.b) return Math.pow(z - v.a, 2) / ((v.c - v.a) * (v.b - v.a));
      return 1 - Math.pow(v.c - z, 2) / ((v.c - v.a) * (v.c - v.b));
    }
    if (config.kind === 'beta-distribution') return z <= 0 ? 0 : (z >= 1 ? 1 : integrateFinite(function (x) { return valueAt(x, v); }, 0, z));
    if (config.kind === 'gamma-distribution' || config.kind === 'chi-square-distribution' || config.kind === 'f-distribution') {
      return z <= 0 ? 0 : integrateFinite(function (x) { return valueAt(x, v); }, 0, z);
    }
    if (config.kind === 't-distribution') {
      return z <= -60 ? 0 : (z >= 60 ? 1 : integrateFinite(function (x) { return valueAt(x, v); }, -60, z));
    }
    return NaN;
  }

  function exactAxisArea(v) {
    const left = plot.xMin;
    const right = plot.xMax;
    if (right <= left) return NaN;
    const cumulativeRight = cumulativeRightLimit(v);
    if (Number.isFinite(cumulativeRight)) return cumulativeProbability(v, cumulativeRight);
    if (config.kind === 'standard-normal-distribution') {
      return normalCdf(v.a, 0, 1);
    }
    if (config.kind === 'normal-distribution') {
      return 1;
    }
    if (config.kind === 'uniform-distribution') {
      return 1;
    }
    if (config.kind === 'exponential-distribution') {
      return 1;
    }
    if (config.kind === 'gamma-distribution') {
      return 1;
    }
    if (config.kind === 'beta-distribution') {
      return 1;
    }
    if (config.kind === 'chi-square-distribution') {
      return 1;
    }
    if (config.kind === 't-distribution') {
      return 1;
    }
    if (config.kind === 'f-distribution') {
      return 1;
    }
    if (config.kind === 'cauchy-distribution') {
      return 1;
    }
    if (config.kind === 'weibull-distribution') {
      return 1;
    }
    if (config.kind === 'lognormal-distribution') {
      return 1;
    }
    if (config.kind === 'laplace-distribution'
      || config.kind === 'logistic-distribution'
      || config.kind === 'rayleigh-distribution'
      || config.kind === 'pareto-distribution'
      || config.kind === 'triangular-distribution') {
      return 1;
    }
    return NaN;
  }

  function hasAxisArea() {
    return config.kind === 'gaussian'
      || config.kind === 'standard-normal-distribution'
      || config.kind === 'normal-distribution'
      || config.kind === 'uniform-distribution'
      || config.kind === 'exponential-distribution'
      || config.kind === 'gamma-distribution'
      || config.kind === 'beta-distribution'
      || config.kind === 'chi-square-distribution'
      || config.kind === 't-distribution'
      || config.kind === 'f-distribution'
      || config.kind === 'cauchy-distribution'
      || config.kind === 'weibull-distribution'
      || config.kind === 'lognormal-distribution'
      || config.kind === 'laplace-distribution'
      || config.kind === 'logistic-distribution'
      || config.kind === 'rayleigh-distribution'
      || config.kind === 'pareto-distribution'
      || config.kind === 'triangular-distribution';
  }

  function drawAxisArea(v) {
    if (!hasAxisArea() || plot.yMin > 0 || plot.yMax < 0) return;
    const zero = sy(0);
    const segments = gaussianAreaSegments(v);
    segments.forEach(function (segment) {
      const polygonPoints = [{ x: segment[0].x, y: zero }].concat(segment).concat([{ x: segment[segment.length - 1].x, y: zero }]);
      const polygon = svg('polygon', {
        points: polygonPoints.map(function (p) { return formatNumber(p.x) + ',' + formatNumber(p.y); }).join(' '),
        class: 'function-area'
      });
      polygon.style.fill = hexToRgba(state.areaColor, 0.12);
      polygon.style.stroke = hexToRgba(state.areaColor, 0.35);
      polygon.addEventListener('click', function () { openAreaSheet(); });
      stage.appendChild(polygon);
    });
    if (state.areaLabelMode !== 'hidden' && segments.length) {
      const label = state.areaLabelMode === 'text' ? state.areaLabelText : formatNumber(approximateAxisArea(v));
      if (label) {
        const anchor = segments.reduce(function (best, segment) { return segment.length > best.length ? segment : best; }, [])[Math.floor(segments[0].length / 2)] || point((plot.xMin + plot.xMax) / 2, 0);
        drawText(
          label,
          Math.min(plot.right - 120, Math.max(plot.left + 16, anchor.x + 20)),
          Math.min(plot.bottom - 24, Math.max(plot.top + 38, (anchor.y + zero) / 2)),
          'muted',
          openAreaSheet,
          { kind: 'area', id: 'main' }
        );
      }
    }
  }

  function visibleSegments(v, variant) {
    const segments = [];
    let points = [];
    const steps = 1400;
    let previousY = null;
    for (let i = 0; i <= steps; i += 1) {
      const x = plot.xMin + (plot.xMax - plot.xMin) * (i / steps);
      const y = valueAt(x, v, variant);
      const jump = (config.kind === 'step'
        || config.kind === 'floor'
        || config.kind === 'ceil'
        || config.kind === 'uniform-distribution'
        || config.kind === 'exponential-distribution'
        || config.kind === 'gamma-distribution'
        || config.kind === 'beta-distribution'
        || config.kind === 'chi-square-distribution'
        || config.kind === 'f-distribution'
        || config.kind === 'rayleigh-distribution'
        || config.kind === 'pareto-distribution'
        || config.kind === 'triangular-distribution') && previousY !== null && Math.abs(y - previousY) > 1e-10;
      if (!Number.isFinite(y) || y < plot.yMin - 1e-9 || y > plot.yMax + 1e-9 || jump) {
        if (points.length > 1) segments.push(points);
        points = [];
      }
      if (Number.isFinite(y) && y >= plot.yMin - 1e-9 && y <= plot.yMax + 1e-9) points.push(point(x, y));
      previousY = y;
    }
    if (points.length > 1) segments.push(points);
    return segments;
  }

  function parametricPoints(v) {
    const points = [];
    const steps = 1600;
    for (let i = 0; i <= steps; i += 1) {
      const t = 2 * Math.PI * (i / steps);
      points.push(point(v.a * Math.sin(v.c * t), v.b * Math.sin(v.d * t)));
    }
    return points;
  }

  function polarPoints(v) {
    const segments = polarSegments(v);
    return segments.reduce(function (all, segment) {
      return all.concat(segment);
    }, []);
  }

  function polarSegments(v) {
    const segments = [];
    const thetaMin = Number.isFinite(Number(config.thetaMin)) ? Number(config.thetaMin) : 0;
    const thetaMax = Number.isFinite(Number(config.thetaMax)) ? Number(config.thetaMax) : 2 * Math.PI;
    const steps = Number.isInteger(config.thetaSteps) && config.thetaSteps > 0 ? config.thetaSteps : 1800;
    const rangeLimit = Math.max(Math.abs(plot.xMin), Math.abs(plot.xMax), Math.abs(plot.yMin), Math.abs(plot.yMax)) * 4;
    if (thetaMax <= thetaMin) return segments;
    let current = [];
    for (let i = 0; i <= steps; i += 1) {
      const theta = thetaMin + (thetaMax - thetaMin) * (i / steps);
      const r = polarRadius(v, theta);
      const x = r * Math.cos(theta);
      const y = r * Math.sin(theta);
      if (!Number.isFinite(r) || !Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > rangeLimit || Math.abs(y) > rangeLimit) {
        if (current.length > 1) segments.push(current);
        current = [];
      } else {
        current.push(point(x, y));
      }
    }
    if (current.length > 1) segments.push(current);
    return segments;
  }

  function polarRadius(v, theta) {
    const polarType = config.polarType || 'rose-cos';
    if (polarType === 'rose-sin') return v.a * Math.sin(v.b * theta);
    if (polarType === 'circle') return v.a;
    if (polarType === 'cardioid') return v.a * (1 + Math.cos(theta));
    if (polarType === 'limacon') return v.a + v.b * Math.cos(theta);
    if (polarType === 'archimedean-spiral') return v.a + v.b * theta;
    if (polarType === 'logarithmic-spiral') return v.a * Math.exp(v.b * theta);
    if (polarType === 'hyperbolic-spiral') return Math.abs(theta) < 1e-10 ? NaN : v.a / theta;
    if (polarType === 'conchoid') {
      const denominator = Math.cos(theta);
      return Math.abs(denominator) < 1e-10 ? NaN : v.a + v.b / denominator;
    }
    if (polarType === 'cissoid') {
      const denominator = Math.cos(theta);
      return Math.abs(denominator) < 1e-10 ? NaN : v.a * Math.pow(Math.sin(theta), 2) / denominator;
    }
    if (polarType === 'sinusoidal-spiral') {
      const n = Math.max(1, Math.round(v.b));
      const value = Math.cos(n * theta);
      if (value < 0 && n % 2 === 0) return NaN;
      return v.a * Math.sign(value || 1) * Math.pow(Math.abs(value), 1 / n);
    }
    if (polarType === 'fermat-spiral') return theta < 0 ? NaN : v.a * Math.sqrt(theta);
    if (polarType === 'lituus') return theta <= 0 ? NaN : v.a / Math.sqrt(theta);
    if (polarType === 'epispiral') {
      const denominator = Math.cos(v.b * theta);
      return Math.abs(denominator) < 1e-10 ? NaN : v.a / denominator;
    }
    if (polarType === 'lemniscate') {
      const value = Math.cos(2 * theta);
      return value < 0 ? NaN : v.a * Math.sqrt(value);
    }
    if (polarType === 'conic') {
      const denominator = 1 + v.a * Math.cos(theta);
      return Math.abs(denominator) < 1e-10 ? NaN : v.a * v.b / denominator;
    }
    return v.a * Math.cos(v.b * theta);
  }

  function polarFormula(v) {
    const polarType = config.polarType || 'rose-cos';
    if (polarType === 'rose-sin') return 'r = ' + formatNumber(v.a) + 'sin(' + formatNumber(v.b) + 'θ)';
    if (polarType === 'circle') return 'r = ' + formatNumber(v.a);
    if (polarType === 'cardioid') return 'r = ' + formatNumber(v.a) + '(1 + cosθ)';
    if (polarType === 'limacon') return 'r = ' + formatNumber(v.a) + ' + ' + formatNumber(v.b) + 'cosθ';
    if (polarType === 'archimedean-spiral') return 'r = ' + formatNumber(v.a) + ' + ' + formatNumber(v.b) + 'θ';
    if (polarType === 'logarithmic-spiral') return 'r = ' + formatNumber(v.a) + 'e^(' + formatNumber(v.b) + 'θ)';
    if (polarType === 'hyperbolic-spiral') return 'r = ' + formatNumber(v.a) + ' / θ';
    if (polarType === 'conchoid') return 'r = ' + formatNumber(v.a) + ' + ' + formatNumber(v.b) + 'secθ';
    if (polarType === 'cissoid') return 'r = ' + formatNumber(v.a) + 'sin²θ / cosθ';
    if (polarType === 'sinusoidal-spiral') return 'r^' + formatNumber(Math.round(v.b)) + ' = ' + formatNumber(Math.pow(v.a, Math.round(v.b))) + 'cos(' + formatNumber(Math.round(v.b)) + 'θ)';
    if (polarType === 'fermat-spiral') return 'r² = ' + formatNumber(v.a * v.a) + 'θ';
    if (polarType === 'lituus') return 'r² = ' + formatNumber(v.a * v.a) + ' / θ';
    if (polarType === 'epispiral') return 'r = ' + formatNumber(v.a) + 'sec(' + formatNumber(v.b) + 'θ)';
    if (polarType === 'lemniscate') return 'r² = ' + formatNumber(v.a * v.a) + 'cos(2θ)';
    if (polarType === 'conic') return 'r = ed/(1 + e cosθ), e=' + formatNumber(v.a) + ', d=' + formatNumber(v.b);
    return 'r = ' + formatNumber(v.a) + 'cos(' + formatNumber(v.b) + 'θ)';
  }

  function drawPolarConicReference(v) {
    if ((config.polarType || '') !== 'conic') return;
    drawMarkedPoint(0, 0);
    drawText('焦点', sx(0) + 10, sy(0) - 10, 'muted');
    if (!Number.isFinite(v.b)) return;
    const x = v.b;
    if (x < plot.xMin || x > plot.xMax) return;
    const line = svg('line', {
      x1: sx(x),
      y1: sy(plot.yMin),
      x2: sx(x),
      y2: sy(plot.yMax),
      class: 'function-line is-dashed'
    });
    line.style.stroke = '#8fa5da';
    line.style.strokeWidth = '3';
    stage.appendChild(line);
    drawText('準線', sx(x) + 10, plot.top + 34, 'muted');
  }

  function drawReferenceLine() {
    const line = svg('line', { x1: sx(plot.xMin), y1: sy(plot.xMin), x2: sx(plot.xMax), y2: sy(plot.xMax), class: 'function-line is-dashed' });
    line.style.stroke = '#8fa5da';
    line.style.strokeWidth = '3';
    stage.appendChild(line);
  }

  function aliasFrequency(signalFrequency, samplingFrequency) {
    if (!Number.isFinite(signalFrequency) || !Number.isFinite(samplingFrequency) || samplingFrequency <= 0) return NaN;
    return Math.abs(signalFrequency - Math.round(signalFrequency / samplingFrequency) * samplingFrequency);
  }

  function logFactorial(n) {
    let total = 0;
    for (let i = 2; i <= n; i += 1) total += Math.log(i);
    return total;
  }

  function binomialProbability(n, p, k) {
    if (k < 0 || k > n) return 0;
    if (p === 0) return k === 0 ? 1 : 0;
    if (p === 1) return k === n ? 1 : 0;
    return Math.exp(logFactorial(n) - logFactorial(k) - logFactorial(n - k) + k * Math.log(p) + (n - k) * Math.log(1 - p));
  }

  function poissonProbability(lambda, k) {
    if (k < 0) return 0;
    return Math.exp(-lambda + k * Math.log(lambda) - logFactorial(k));
  }

  function logCombination(n, k) {
    if (k < 0 || k > n) return -Infinity;
    return logFactorial(n) - logFactorial(k) - logFactorial(n - k);
  }

  function discreteProbability(v, k) {
    if (config.kind === 'binomial-distribution') return binomialProbability(v.a, v.b, k);
    if (config.kind === 'poisson-distribution') return poissonProbability(v.a, k);
    if (config.kind === 'geometric-distribution') return k >= 1 ? Math.pow(1 - v.a, k - 1) * v.a : 0;
    if (config.kind === 'bernoulli-distribution') return k === 0 ? 1 - v.a : (k === 1 ? v.a : 0);
    if (config.kind === 'negative-binomial-distribution') {
      if (k < v.a || v.b === 1) return k === v.a ? 1 : 0;
      return Math.exp(logCombination(k - 1, v.a - 1) + v.a * Math.log(v.b) + (k - v.a) * Math.log(1 - v.b));
    }
    if (config.kind === 'hypergeometric-distribution') {
      return Math.exp(logCombination(v.b, k) + logCombination(v.a - v.b, v.c - k) - logCombination(v.a, v.c));
    }
    return 0;
  }

  function getDiscreteAreaState(k) {
    const key = String(k);
    if (!state.discreteAreas[key]) {
      state.discreteAreas[key] = {
        labelMode: 'hidden',
        labelText: '',
        color: state.areaColor || '#2a5bd7'
      };
    }
    return state.discreteAreas[key];
  }

  function drawDiscreteDistribution(v) {
    const minK = config.kind === 'geometric-distribution' || config.kind === 'negative-binomial-distribution' ? 1 : 0;
    const start = Math.max(minK, Math.ceil(plot.xMin));
    let end = Math.floor(plot.xMax);
    if (config.kind === 'binomial-distribution') end = Math.min(v.a, end);
    if (config.kind === 'bernoulli-distribution') end = Math.min(1, end);
    if (config.kind === 'hypergeometric-distribution') end = Math.min(v.b, v.c, end);
    const zeroY = sy(0);
    for (let k = start; k <= end; k += 1) {
      const probability = discreteProbability(v, k);
      if (!Number.isFinite(probability) || probability < 0) continue;
      const areaState = getDiscreteAreaState(k);
      const color = areaState.color || state.areaColor || '#2a5bd7';
      const left = sx(k - 0.36);
      const right = sx(k + 0.36);
      const top = sy(probability);
      const centerX = sx(k);
      const rect = svg('rect', {
        x: Math.min(left, right),
        y: Math.min(top, zeroY),
        width: Math.abs(right - left),
        height: Math.max(1, Math.abs(zeroY - top)),
        class: 'function-area'
      });
      rect.style.fill = hexToRgba(color, 0.22);
      rect.style.stroke = color;
      rect.addEventListener('click', function () { if (!moveMode) openDiscreteAreaSheet(k, probability); });
      stage.appendChild(rect);
      const cap = svg('line', { x1: left, y1: top, x2: right, y2: top, class: 'function-curve' });
      cap.style.strokeWidth = '4';
      cap.style.stroke = color;
      cap.addEventListener('click', function () { if (!moveMode) openDiscreteAreaSheet(k, probability); });
      stage.appendChild(cap);
      if (areaState.labelMode !== 'hidden') {
        const label = areaState.labelMode === 'text' ? areaState.labelText : formatNumber(probability);
        if (label) {
          drawText(
            label,
            centerX + 10,
            Math.max(plot.top + 38, top - 10),
            'muted',
            function () { openDiscreteAreaSheet(k, probability); },
            { kind: 'discreteArea', id: String(k) }
          );
        }
      }
    }
    drawText(formula(v), plot.left + 18, plot.top + 44, 'muted');
  }

  function drawGraph(v) {
    if (config.kind === 'parametric') {
      drawPath(parametricPoints(v), '#2a5bd7', 'function');
      drawCurveFormulaLabel(v, null, plot.left + 18, plot.top + 44, 'function');
      return;
    }
    if (config.kind === 'polar') {
      drawPolarConicReference(v);
      drawSegments(polarSegments(v), '#2a5bd7', 'function');
      drawCurveFormulaLabel(v, null, plot.left + 18, plot.top + 44, 'function');
      return;
    }
    if (config.kind === 'inverse-exp-log') {
      drawReferenceLine();
      drawSegments(visibleSegments(v, 'function'), '#2a5bd7', 'function');
      drawSegments(visibleSegments(v, 'inverse'), '#2e7d32', 'inverse');
      drawCurveFormulaLabel(v, 'function', plot.left + 18, plot.top + 44, 'function');
      drawCurveFormulaLabel(v, 'inverse', plot.left + 18, plot.top + 84, 'inverse');
      return;
    }
    if (config.kind === 'step') {
      drawSegments(visibleSegments(v, 'floor'), '#2a5bd7', 'floor');
      drawSegments(visibleSegments(v, 'ceil'), '#2e7d32', 'ceil');
      drawCurveFormulaLabel(v, 'floor', plot.left + 18, plot.top + 44, 'floor');
      drawCurveFormulaLabel(v, 'ceil', plot.left + 18, plot.top + 84, 'ceil');
      return;
    }
    if (config.kind === 'composition-linear') {
      drawSegments(visibleSegments(v, 'fg'), '#2a5bd7', 'fg');
      drawSegments(visibleSegments(v, 'gf'), '#2e7d32', 'gf');
      drawCurveFormulaLabel(v, 'fg', plot.left + 18, plot.top + 44, 'fg');
      drawCurveFormulaLabel(v, 'gf', plot.left + 18, plot.top + 84, 'gf');
      return;
    }
    if (config.kind === 'derivative-polynomial'
      || config.kind === 'derivative-trig'
      || config.kind === 'derivative-exponential'
      || config.kind === 'derivative-logarithmic') {
      drawSegments(visibleSegments(v), '#2a5bd7', 'function');
      drawSegments(visibleSegments(v, 'derivative'), '#8e44ad', 'derivative');
      drawCurveFormulaLabel(v, null, plot.left + 18, plot.top + 44, 'function');
      drawCurveFormulaLabel(v, 'derivative', plot.left + 18, plot.top + 84, 'derivative');
      return;
    }
    if (config.kind === 'calculus-tangent-normal') {
      const t = v.e;
      const y0 = cubicValue(v, t);
      const m = cubicDerivative(v, t);
      drawSegments(visibleSegments(v), '#2a5bd7', 'function');
      drawSegments(visibleSegments(v, 'tangent'), '#2e7d32', 'tangent');
      if (Math.abs(m) < 1e-10) {
        drawVerticalCurveLine(t, '#8e44ad', 'normal');
      } else {
        drawSegments(visibleSegments(v, 'normal'), '#8e44ad', 'normal');
      }
      drawMarkedPoint(t, y0);
      drawCurveFormulaLabel(v, null, plot.left + 18, plot.top + 44, 'function');
      drawCurveFormulaLabel(v, 'tangent', plot.left + 18, plot.top + 84, 'tangent');
      drawCurveFormulaLabel(v, 'normal', plot.left + 18, plot.top + 124, 'normal');
      return;
    }
    if (config.kind === 'music-sampling') {
      drawSegments(visibleSegments(v), '#2a5bd7', 'function');
      const start = Math.ceil(plot.xMin * v.c);
      const end = Math.floor(plot.xMax * v.c);
      for (let i = start; i <= end; i += 1) {
        const t = i / v.c;
        drawMarkedPoint(t, valueAt(t, v));
      }
      drawCurveFormulaLabel(v, null, plot.left + 18, plot.top + 44, 'function');
      return;
    }
    if (config.kind === 'music-aliasing') {
      drawSegments(visibleSegments(v), '#2a5bd7', 'function');
      drawSegments(visibleSegments(v, 'alias'), '#e25555', 'alias');
      drawCurveFormulaLabel(v, null, plot.left + 18, plot.top + 44, 'function');
      drawCurveFormulaLabel(v, 'alias', plot.left + 18, plot.top + 84, 'alias');
      return;
    }
    if (config.kind === 'binomial-distribution'
      || config.kind === 'poisson-distribution'
      || config.kind === 'geometric-distribution'
      || config.kind === 'bernoulli-distribution'
      || config.kind === 'negative-binomial-distribution'
      || config.kind === 'hypergeometric-distribution') {
      drawDiscreteDistribution(v);
      return;
    }
    const segments = visibleSegments(v);
    drawAxisArea(v);
    drawSegments(segments, '#2a5bd7', 'function');
    drawCurveFormulaLabel(v, null, plot.left + 18, plot.top + 44, 'function');
  }

  function render() {
    if (window.InstantGeometryFunctionViewSettings) window.InstantGeometryFunctionViewSettings.applyViewRange(state, plot);
    clear(stage);
    drawGrid();
    try {
      const values = readParams();
      setStatus(config.statusText, false);
      drawGraph(values);
    } catch (error) {
      setStatus(error.message, true);
      drawGraph(Object.assign({ a: 1, b: 1, c: 0, d: 0, e: 0 }, config.defaults || {}));
    }
  }

  function closeSheets() {
    if (editSheet) editSheet.classList.remove('open');
    if (saveSheet) saveSheet.classList.remove('open');
    if (sheetBackdrop) sheetBackdrop.classList.remove('open');
  }

  function buildNumberField(label, value, step) {
    const wrap = document.createElement('label');
    wrap.className = 'sheet-field';
    const text = document.createElement('span');
    text.textContent = label;
    const input = document.createElement('input');
    input.type = 'number';
    input.step = step || '1';
    input.value = value;
    wrap.appendChild(text);
    wrap.appendChild(input);
    return { wrap: wrap, input: input };
  }

  function buildTextNumberField(labelText, value) {
    const field = document.createElement('div');
    field.className = 'sheet-field';
    const label = document.createElement('label');
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'decimal';
    input.value = formatNumber(Number(value));
    field.appendChild(label);
    field.appendChild(input);
    return { field: field, input: input };
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

  function buildColorPalette(labelText, value) {
    const field = document.createElement('div');
    field.className = 'sheet-field';
    const label = document.createElement('label');
    label.textContent = labelText;
    const picker = document.createElement('div');
    picker.className = 'color-swatch-picker';
    const colors = [
      ['白', '#ffffff'], ['赤', '#e53935'], ['青', '#2a5bd7'], ['緑', '#2e7d32'],
      ['黄', '#f2c94c'], ['紫', '#8e44ad'], ['桃', '#ff66a3'], ['茶', '#8b5a2b'], ['灰', '#8a94a6'], ['黒', '#111827']
    ];
    const result = { field: field, value: value || '#2a5bd7' };
    colors.forEach(function (entry) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'color-swatch' + (entry[1] === result.value ? ' is-selected' : '');
      button.dataset.color = entry[1];
      button.style.background = entry[1];
      button.textContent = entry[0];
      button.setAttribute('aria-label', entry[0]);
      button.addEventListener('click', function () {
        result.value = entry[1];
        picker.querySelectorAll('.color-swatch').forEach(function (node) { node.classList.remove('is-selected'); });
        button.classList.add('is-selected');
      });
      picker.appendChild(button);
    });
    field.appendChild(label);
    field.appendChild(picker);
    return result;
  }

  function parseSettingNumber(input, labelText, positive) {
    const text = String(input.value || '').trim();
    if (!/^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$/.test(text)) {
      throw new Error(labelText + 'は数値で入力してください。');
    }
    const value = Number(text);
    if (positive && value <= 0) throw new Error(labelText + 'は0より大きい数値で入力してください。');
    return value;
  }

  function openSheet(title) {
    sheetTitle.textContent = title;
    sheetBody.innerHTML = '';
    editSheet.classList.add('open');
    editSheet.setAttribute('aria-hidden', 'false');
    sheetBackdrop.classList.add('open');
  }

  function openSettingsSheet() {
    if (!editSheet || !sheetBody || !sheetTitle) return;
    openSheet('設定');

    const currentRadius = Math.max(Number(state.viewWidth) || 20, Number(state.viewHeight) || 20) / 2;
    const radiusInput = config.kind === 'polar' ? buildTextNumberField('表示する最大半径 r', currentRadius) : null;
    const centerXInput = buildTextNumberField('中心のx座標', state.viewCenterX);
    const centerYInput = buildTextNumberField('中心のy座標', state.viewCenterY);
    const widthInput = buildTextNumberField('横幅', state.viewWidth);
    const heightInput = buildTextNumberField('縦幅', state.viewHeight);
    if (config.kind === 'polar') {
      if (radiusInput) sheetBody.appendChild(radiusInput.field);
    } else {
      [centerXInput.field, centerYInput.field, widthInput.field, heightInput.field].forEach(function (field) {
        sheetBody.appendChild(field);
      });
    }

    const tickSelect = buildSelect('座標の数字', String(state.tickLabelInterval || 0), [
      { value: '1', label: '1刻み' },
      { value: '2', label: '2刻み' },
      { value: '5', label: '5刻み' },
      { value: '0', label: '非表示' }
    ]);
    sheetBody.appendChild(tickSelect.field);

    const hintNode = document.createElement('p');
    hintNode.className = 'sheet-hint';
    hintNode.textContent = config.kind === 'polar'
      ? 'このページは極座標で表示します。画面に表示する最大半径 r を指定できます。'
      : '表示範囲と、座標に表示する数字の間隔を変更できます。';
    sheetBody.appendChild(hintNode);

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
      try {
        state.coordinateMode = config.defaultCoordinateMode || 'cartesian';
        if (config.kind === 'polar') {
          const radius = parseSettingNumber(radiusInput.input, '表示する最大半径 r', true);
          state.viewCenterX = 0;
          state.viewCenterY = 0;
          state.viewWidth = radius * 2;
          state.viewHeight = radius * 2;
        } else {
          state.viewCenterX = parseSettingNumber(centerXInput.input, '中心のx座標', false);
          state.viewCenterY = parseSettingNumber(centerYInput.input, '中心のy座標', false);
          state.viewWidth = parseSettingNumber(widthInput.input, '横幅', true);
          state.viewHeight = parseSettingNumber(heightInput.input, '縦幅', true);
        }
        state.tickLabelInterval = Number(tickSelect.select.value) || 0;
        closeSheets();
        render();
      } catch (error) {
        setStatus(error.message || '入力を確認してください。', true);
      }
    });
    actions.appendChild(cancel);
    actions.appendChild(save);
    sheetBody.appendChild(actions);
  }

  function curveTitle(id) {
    if (id === 'derivative') return '導関数';
    if (id === 'tangent') return '接線';
    if (id === 'normal') return '法線';
    if (id === 'inverse') return '逆関数';
    if (id === 'floor') return '床関数';
    if (id === 'ceil') return '天井関数';
    if (id === 'fg') return 'f(g(x))';
    if (id === 'gf') return 'g(f(x))';
    return '関数グラフ';
  }

  function openCurveSheet(id) {
    const curveState = getCurveState(id, id === 'derivative' ? '#8e44ad' : '#2a5bd7');
    openSheet(curveTitle(id));
    const mode = buildSelect('ラベル', curveState.labelMode || 'formula', [
      { value: 'hidden', label: '非表示' },
      { value: 'formula', label: '式' },
      { value: 'text', label: '自由入力' }
    ]);
    sheetBody.appendChild(mode.field);

    const textField = buildTextNumberField('表示する文字', 0);
    textField.input.type = 'text';
    textField.input.inputMode = 'text';
    textField.input.value = curveState.labelText || '';
    sheetBody.appendChild(textField.field);

    const color = buildColorPalette('線の色', curveState.color || '#2a5bd7');
    sheetBody.appendChild(color.field);

    const hintNode = document.createElement('p');
    hintNode.className = 'sheet-hint';
    hintNode.textContent = '関数グラフのラベル表示と線の色を変更できます。移動を押すと、ラベルをドラッグできます。';
    sheetBody.appendChild(hintNode);

    const actions = document.createElement('div');
    actions.className = 'sheet-actions';
    const cancel = document.createElement('button');
    cancel.className = 'btn';
    cancel.type = 'button';
    cancel.textContent = 'キャンセル';
    cancel.addEventListener('click', closeSheets);
    const move = document.createElement('button');
    move.className = 'btn';
    move.type = 'button';
    move.textContent = '移動';
    move.addEventListener('click', function () {
      curveState.labelMode = mode.select.value;
      curveState.labelText = textField.input.value;
      curveState.color = color.value;
      closeSheets();
      moveMode = { kind: 'curve', id: id };
      updateMoveModeUi();
      render();
    });
    const save = document.createElement('button');
    save.className = 'btn action-primary';
    save.type = 'button';
    save.textContent = '保存';
    save.addEventListener('click', function () {
      curveState.labelMode = mode.select.value;
      curveState.labelText = textField.input.value;
      curveState.color = color.value;
      closeSheets();
      render();
    });
    actions.appendChild(cancel);
    actions.appendChild(move);
    actions.appendChild(save);
    sheetBody.appendChild(actions);
  }

  function openAreaSheet() {
    openSheet('面積');
    const mode = buildSelect('ラベル', state.areaLabelMode || 'numeric', [
      { value: 'hidden', label: '非表示' },
      { value: 'numeric', label: '数値' },
      { value: 'text', label: '自由入力' }
    ]);
    sheetBody.appendChild(mode.field);
    const textField = buildTextNumberField('表示する文字', 0);
    textField.input.type = 'text';
    textField.input.inputMode = 'text';
    textField.input.value = state.areaLabelText || '';
    sheetBody.appendChild(textField.field);
    function syncTextField() {
      textField.field.style.display = mode.select.value === 'text' ? '' : 'none';
    }
    mode.select.addEventListener('change', syncTextField);
    syncTextField();

    const colorPalette = buildColorPalette('色', state.areaColor || '#2a5bd7');
    sheetBody.appendChild(colorPalette.field);

    const hintNode = document.createElement('p');
    hintNode.className = 'sheet-hint';
    hintNode.textContent = '数値は現在の表示範囲で、関数とx軸に挟まれる面積を近似して表示します。';
    sheetBody.appendChild(hintNode);

    const actions = document.createElement('div');
    actions.className = 'sheet-actions has-move';
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
      state.areaLabelMode = mode.select.value;
      state.areaLabelText = String(textField.input.value || '');
      state.areaColor = colorPalette.value;
      render();
      enterMoveMode('area', 'main');
    });
    const save = document.createElement('button');
    save.className = 'btn action-primary';
    save.type = 'button';
    save.textContent = '保存';
    save.addEventListener('click', function () {
      state.areaLabelMode = mode.select.value;
      state.areaLabelText = String(textField.input.value || '');
      state.areaColor = colorPalette.value;
      closeSheets();
      render();
    });
    actions.appendChild(cancel);
    actions.appendChild(move);
    actions.appendChild(save);
    sheetBody.appendChild(actions);
  }

  function openDiscreteAreaSheet(k, probability) {
    const areaState = getDiscreteAreaState(k);
    openSheet('確率');
    const mode = buildSelect('ラベル', areaState.labelMode || 'hidden', [
      { value: 'hidden', label: '非表示' },
      { value: 'numeric', label: '数値' },
      { value: 'text', label: '自由入力' }
    ]);
    sheetBody.appendChild(mode.field);
    const textField = buildTextNumberField('表示する文字', 0);
    textField.input.type = 'text';
    textField.input.inputMode = 'text';
    textField.input.value = areaState.labelText || '';
    sheetBody.appendChild(textField.field);
    function syncTextField() {
      textField.field.style.display = mode.select.value === 'text' ? '' : 'none';
    }
    mode.select.addEventListener('change', syncTextField);
    syncTextField();

    const colorPalette = buildColorPalette('色', areaState.color || state.areaColor || '#2a5bd7');
    sheetBody.appendChild(colorPalette.field);

    const hintNode = document.createElement('p');
    hintNode.className = 'sheet-hint';
    hintNode.textContent = 'この棒は k = ' + formatNumber(k) + ' の確率 P(X=' + formatNumber(k) + ') = ' + formatNumber(probability) + ' を表します。';
    sheetBody.appendChild(hintNode);

    const actions = document.createElement('div');
    actions.className = 'sheet-actions has-move';
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
      areaState.labelMode = mode.select.value;
      areaState.labelText = String(textField.input.value || '');
      areaState.color = colorPalette.value;
      render();
      enterMoveMode('discreteArea', String(k));
    });
    const save = document.createElement('button');
    save.className = 'btn action-primary';
    save.type = 'button';
    save.textContent = '保存';
    save.addEventListener('click', function () {
      areaState.labelMode = mode.select.value;
      areaState.labelText = String(textField.input.value || '');
      areaState.color = colorPalette.value;
      closeSheets();
      render();
    });
    actions.appendChild(cancel);
    actions.appendChild(move);
    actions.appendChild(save);
    sheetBody.appendChild(actions);
  }

  function enterMoveMode(kind, id) {
    closeSheets();
    const currentOffset = getLabelOffset(kind, id);
    moveMode = { kind: kind, id: id };
    moveDrag = null;
    moveInitialOffset = { x: currentOffset.x, y: currentOffset.y };
    updateMoveModeUi();
    render();
  }

  function exitMoveMode(commit) {
    if (!commit && moveMode && moveInitialOffset) {
      const offset = ensureLabelOffset(moveMode.kind, moveMode.id);
      offset.x = moveInitialOffset.x;
      offset.y = moveInitialOffset.y;
    }
    moveMode = null;
    moveDrag = null;
    moveInitialOffset = null;
    updateMoveModeUi();
    render();
  }

  stage.addEventListener('pointermove', function (event) {
    if (!moveDrag) return;
    event.preventDefault();
    const current = pointerToSvgPoint(event);
    const offset = ensureLabelOffset(moveDrag.kind, moveDrag.id);
    offset.x = moveDrag.startOffset.x + current.x - moveDrag.startPoint.x;
    offset.y = moveDrag.startOffset.y + current.y - moveDrag.startPoint.y;
    render();
  });
  window.addEventListener('pointerup', function () {
    moveDrag = null;
  });
  moveCancelBtn.addEventListener('click', function () { exitMoveMode(false); });
  moveDoneBtn.addEventListener('click', function () { exitMoveMode(true); });

  function openSaveSheet() {
    if (moveMode) return;
    if (!saveSheet || !sheetBackdrop) return;
    saveSheet.classList.add('open');
    saveSheet.setAttribute('aria-hidden', 'false');
    sheetBackdrop.classList.add('open');
  }

  function captureCanvas(backgroundColor) {
    if (!window.html2canvas) return Promise.reject(new Error('保存に失敗しました。'));
    return window.html2canvas(captureRoot, { backgroundColor: backgroundColor, scale: 2 });
  }

  function saveImage(format) {
    const transparent = format === 'transparent';
    return captureCanvas(transparent ? null : '#ffffff').then(function (canvas) {
      const link = document.createElement('a');
      link.download = transparent ? config.saveBase + '-transparent.png' : config.saveBase + '.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  }

  function savePdf() {
    if (!window.jspdf || !window.jspdf.jsPDF) return Promise.reject(new Error('PDF保存に失敗しました。'));
    return captureCanvas('#ffffff').then(function (canvas) {
      const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
      const pdf = new window.jspdf.jsPDF({ orientation: orientation, unit: 'pt', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const scale = Math.min((pageW - margin * 2) / canvas.width, (pageH - margin * 2) / canvas.height);
      const drawW = canvas.width * scale;
      const drawH = canvas.height * scale;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pageW - drawW) / 2, (pageH - drawH) / 2, drawW, drawH);
      pdf.save(config.saveBase + '.pdf');
    });
  }

  function saveWithQuota(format) {
    const runner = window.InstantGeometrySaveQuota && window.InstantGeometrySaveQuota.runWithQuota
      ? window.InstantGeometrySaveQuota.runWithQuota
      : function (fn) { return fn(); };
    const task = function () { return format === 'pdf' ? savePdf() : saveImage(format); };
    return runner(task).then(function () {
      closeSheets();
      setStatus('保存しました。', false);
    }).catch(function (error) {
      setStatus(error.message || '保存に失敗しました。', true);
    });
  }

  activeParams.forEach(function (key) {
    inputs[key].addEventListener('input', render);
  });
  const backButton = document.getElementById('backBtn');
  if (backButton) backButton.addEventListener('click', function () { window.location.href = '../../'; });
  const settingsButton = document.getElementById('settingsBtn');
  if (settingsButton) settingsButton.addEventListener('click', openSettingsSheet);
  const saveButton = document.getElementById('saveBtn');
  if (window.InstantGeometrySaveQuota && saveButton) window.InstantGeometrySaveQuota.createIndicator({ target: saveButton });
  if (saveButton) saveButton.addEventListener('click', openSaveSheet);
  const sheetClose = document.getElementById('sheetClose');
  if (sheetClose) sheetClose.addEventListener('click', closeSheets);
  const saveSheetClose = document.getElementById('saveSheetClose');
  if (saveSheetClose) saveSheetClose.addEventListener('click', closeSheets);
  if (sheetBackdrop) sheetBackdrop.addEventListener('click', closeSheets);
  const savePngButton = document.getElementById('savePngBtn');
  if (savePngButton) savePngButton.addEventListener('click', function () { saveWithQuota('png'); });
  const saveTransparentButton = document.getElementById('saveTransparentBtn');
  if (saveTransparentButton) saveTransparentButton.addEventListener('click', function () { saveWithQuota('transparent'); });
  const savePdfButton = document.getElementById('savePdfBtn');
  if (savePdfButton) savePdfButton.addEventListener('click', function () { saveWithQuota('pdf'); });

  render();
})();
