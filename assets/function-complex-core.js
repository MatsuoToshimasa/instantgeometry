(function () {
  'use strict';

  function numberText(value) {
    if (!Number.isFinite(value)) return '';
    if (Math.abs(value) < 1e-10) return '0';
    const rounded = Math.round(value * 1000) / 1000;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, '').replace(/\.$/, '');
  }

  function complexText(z) {
    const re = numberText(z.re);
    const imAbs = numberText(Math.abs(z.im));
    if (Math.abs(z.im) < 1e-10) return re;
    if (Math.abs(z.re) < 1e-10) return (z.im < 0 ? '-' : '') + imAbs + 'i';
    return re + (z.im < 0 ? ' - ' : ' + ') + imAbs + 'i';
  }

  function add(a, b) {
    return { re: a.re + b.re, im: a.im + b.im };
  }

  function sub(a, b) {
    return { re: a.re - b.re, im: a.im - b.im };
  }

  function mul(a, b) {
    return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
  }

  function scale(z, k) {
    return { re: z.re * k, im: z.im * k };
  }

  function div(a, b) {
    const denominator = b.re * b.re + b.im * b.im;
    if (denominator < 1e-12) return { re: NaN, im: NaN };
    return { re: (a.re * b.re + a.im * b.im) / denominator, im: (a.im * b.re - a.re * b.im) / denominator };
  }

  function inverse(z) {
    return div({ re: 1, im: 0 }, z);
  }

  function conjugate(z) {
    return { re: z.re, im: -z.im };
  }

  function abs(z) {
    return Math.hypot(z.re, z.im);
  }

  function arg(z) {
    return Math.atan2(z.im, z.re);
  }

  function deg(rad) {
    return rad * 180 / Math.PI;
  }

  function fromPolar(r, theta) {
    return { re: r * Math.cos(theta), im: r * Math.sin(theta) };
  }

  function powInt(z, n) {
    const r = Math.pow(abs(z), n);
    const theta = arg(z) * n;
    return fromPolar(r, theta);
  }

  function polarText(z) {
    return '|z|=' + numberText(abs(z)) + ', arg=' + numberText(deg(arg(z))) + '°';
  }

  window.InstantGeometryComplexCore = {
    numberText: numberText,
    complexText: complexText,
    add: add,
    sub: sub,
    mul: mul,
    scale: scale,
    div: div,
    inverse: inverse,
    conjugate: conjugate,
    abs: abs,
    arg: arg,
    deg: deg,
    fromPolar: fromPolar,
    powInt: powInt,
    polarText: polarText
  };
})();
