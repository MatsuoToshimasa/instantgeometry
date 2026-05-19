import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const failures = [];

class ClassList {
  constructor(node) {
    this.node = node;
    this.items = new Set();
  }

  add(...names) {
    names.filter(Boolean).forEach((name) => this.items.add(String(name)));
    this.sync();
  }

  remove(...names) {
    names.forEach((name) => this.items.delete(String(name)));
    this.sync();
  }

  contains(name) {
    return this.items.has(String(name));
  }

  toggle(name, force) {
    const key = String(name);
    const shouldAdd = force === undefined ? !this.items.has(key) : Boolean(force);
    if (shouldAdd) this.items.add(key);
    else this.items.delete(key);
    this.sync();
    return shouldAdd;
  }

  sync() {
    this.node.attributes.class = Array.from(this.items).join(' ');
  }
}

class FakeElement {
  constructor(tagName) {
    this.tagName = String(tagName || '').toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.attributes = {};
    this.dataset = {};
    this.style = {};
    this.eventListeners = {};
    this.classList = new ClassList(this);
    this._textContent = '';
    this.value = '';
    this.checked = false;
    this.disabled = false;
    this.selected = false;
    this.type = '';
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    if (this.tagName === 'SELECT' && this.value === '' && child.tagName === 'OPTION') {
      this.value = child.value;
    }
    if (this.tagName === 'SELECT' && child.tagName === 'OPTION' && child.selected) {
      this.value = child.value;
    }
    return child;
  }

  setAttribute(name, value) {
    const text = String(value);
    this.attributes[name] = text;
    if (name === 'class') {
      this.classList.items = new Set(text.split(/\s+/).filter(Boolean));
    } else if (name.startsWith('data-')) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      this.dataset[key] = text;
    } else if (name === 'value') {
      this.value = text;
    } else if (name === 'type') {
      this.type = text;
    }
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }

  addEventListener(type, handler) {
    if (!this.eventListeners[type]) this.eventListeners[type] = [];
    this.eventListeners[type].push(handler);
  }

  get textContent() {
    return this._textContent + this.children.map((child) => child.textContent).join('');
  }

  set textContent(value) {
    this._textContent = String(value ?? '');
    this.children = [];
  }

  get innerText() {
    return this.textContent;
  }

  set innerHTML(value) {
    this.textContent = value;
  }

  get options() {
    return this.children.filter((child) => child.tagName === 'OPTION');
  }

  querySelectorAll(selector) {
    const results = [];
    const selectors = String(selector || '').split(',').map((item) => item.trim()).filter(Boolean);
    const visit = (node) => {
      node.children.forEach((child) => {
        if (selectors.some((item) => matchesSelector(child, item))) results.push(child);
        visit(child);
      });
    };
    visit(this);
    return results;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
}

class FakeDocument {
  constructor() {
    this.body = new FakeElement('body');
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }

  createElementNS(_namespace, tagName) {
    return new FakeElement(tagName);
  }

  querySelector(selector) {
    return this.body.querySelector(selector);
  }

  querySelectorAll(selector) {
    return this.body.querySelectorAll(selector);
  }
}

function matchesSelector(node, selector) {
  if (selector.startsWith('#')) return node.attributes.id === selector.slice(1);
  if (selector.startsWith('.')) return node.classList.contains(selector.slice(1));
  const attrMatch = /^\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]$/.exec(selector);
  if (attrMatch) {
    const actual = node.getAttribute(attrMatch[1]);
    return attrMatch[2] === undefined ? actual !== null : actual === attrMatch[2];
  }
  return node.tagName.toLowerCase() === selector.toLowerCase();
}

function loadBrowserScripts() {
  const sandbox = {
    window: {},
    document: new FakeDocument(),
    console,
    URLSearchParams
  };
  sandbox.window.document = sandbox.document;
  sandbox.window.URLSearchParams = URLSearchParams;
  [
    'assets/draw-label-taxonomy.js',
    'assets/mobile-angle-ornaments.js',
    'assets/draw-shared-label-engine.js'
  ].forEach((file) => {
    const code = fs.readFileSync(path.join(root, file), 'utf8');
    vm.runInNewContext(code, sandbox, { filename: file });
  });
  return sandbox.window.InstantGeometryDrawLabelEngine;
}

function fieldLabels(rootNode) {
  return rootNode.querySelectorAll('label').map((label) => label.textContent.trim()).filter(Boolean);
}

function bodyText(rootNode) {
  return rootNode.textContent.replace(/\s+/g, ' ').trim();
}

function addFailure(type, message, detail = {}) {
  failures.push({ type, message, ...detail });
}

function assertIncludes(type, labels, expected) {
  expected.forEach((label) => {
    if (!labels.includes(label)) addFailure(type, `missing required field: ${label}`, { labels });
  });
}

function assertExcludes(type, labels, forbidden) {
  forbidden.forEach((label) => {
    if (labels.includes(label)) addFailure(type, `forbidden field present: ${label}`, { labels });
  });
}

function assertTextIncludes(type, text, expected) {
  expected.forEach((item) => {
    if (!text.includes(item)) addFailure(type, `missing required text: ${item}`, { text });
  });
}

function buildModal(engine, type) {
  const editSheet = new FakeElement('section');
  const sheetTitle = new FakeElement('h2');
  const sheetBody = new FakeElement('div');
  const sheetBackdrop = new FakeElement('div');
  const state = {
    kind: 'plain',
    label: type === 'function' || type === 'point' ? 'A' : ' ',
    guide: true,
    scale: 1,
    color: '#2a5bd7',
    angleArcScale: 1
  };
  const controller = engine.createController({
    enabledLabels: { [type]: true },
    editSheet,
    sheetTitle,
    sheetBody,
    sheetBackdrop,
    closeSheets() {
      sheetBody.children = [];
    },
    render() {},
    onMove() {},
    getTitle(_kind, _id) {
      return `${type}:sample`;
    },
    getKind() {
      return state.kind;
    },
    setKind(_kind, _id, value) {
      state.kind = value;
    },
    hasGuideField() {
      return true;
    },
    getGuideVisible() {
      return state.guide;
    },
    setGuideVisible(_kind, _id, checked) {
      state.guide = checked;
    },
    getLabelValue() {
      return state.label;
    },
    setLabelValue(_kind, _id, value) {
      state.label = value;
    },
    getLabelScale() {
      return state.scale;
    },
    setLabelScale(_kind, _id, value) {
      state.scale = value;
    },
    getAngleValue() {
      return 60;
    },
    getAngleArcScale() {
      return state.angleArcScale;
    },
    setAngleArcScale(_kind, _id, value) {
      state.angleArcScale = value;
    },
    getColor() {
      return state.color;
    },
    setColor(_kind, _id, value) {
      state.color = value;
    },
    hasColorField() {
      return true;
    }
  });
  controller.openEditSheet(type, 'sample');
  return { sheetTitle, sheetBody, editSheet, sheetBackdrop };
}

const contract = {
  point: {
    fields: ['ラベル', 'ラベルサイズ', '色'],
    text: ['自由入力', '移動', '保存'],
    forbiddenFields: ['線分マーク', '角マーク', 'ガイドを表示', '角弧サイズ'],
    forbiddenText: ['数値（自動）', '数値（小数）', '比の値']
  },
  segment: {
    fields: ['線分マーク', 'ガイドを表示', 'ラベル', 'ラベルサイズ', '色'],
    text: ['通常', '丸付き', '一本線付き', '二重線付き', '交差付き', '三角付き', '平行矢印付き', '数値（自動）', '数値（小数）', '比の値', '移動', '保存'],
    forbiddenFields: ['角マーク', '角弧サイズ'],
    forbiddenText: []
  },
  angle: {
    fields: ['角マーク', '角弧サイズ', 'ラベル', 'ラベルサイズ', '色'],
    text: ['非表示', '角弧のみ', '丸付き', '交差付き', '二重交差線付き', '三角付き', '数値（自動）', '数値（小数）', '比の値', '移動', '保存'],
    forbiddenFields: ['線分マーク', 'ガイドを表示'],
    forbiddenText: []
  },
  area: {
    fields: ['ガイドを表示', 'ラベル', 'ラベルサイズ', '色'],
    text: ['数値（自動）', '数値（小数）', '比の値', '移動', '保存'],
    forbiddenFields: ['線分マーク', '角マーク', '角弧サイズ'],
    forbiddenText: []
  },
  arc: {
    fields: ['ラベル', 'ラベルサイズ', '色'],
    text: ['数値（自動）', '数値（小数）', '比の値', '移動', '保存'],
    forbiddenFields: ['線分マーク', '角マーク', 'ガイドを表示', '角弧サイズ'],
    forbiddenText: []
  },
  volume: {
    fields: ['ガイドを表示', 'ラベル', 'ラベルサイズ', '色'],
    text: ['数値（自動）', '数値（小数）', '移動', '保存'],
    forbiddenFields: ['線分マーク', '角マーク', '角弧サイズ'],
    forbiddenText: ['比の値']
  },
  function: {
    fields: ['ラベル', 'ラベルサイズ', '色'],
    text: ['自由入力', '移動', '保存'],
    forbiddenFields: ['線分マーク', '角マーク', 'ガイドを表示', '角弧サイズ'],
    forbiddenText: ['数値（自動）', '数値（小数）', '比の値']
  }
};

const engine = loadBrowserScripts();
if (!engine) throw new Error('InstantGeometryDrawLabelEngine was not loaded.');

const expectedOrder = ['point', 'segment', 'angle', 'area', 'arc', 'volume', 'function'];
if (JSON.stringify(engine.LABEL_TYPE_ORDER) !== JSON.stringify(expectedOrder)) {
  addFailure('engine', 'LABEL_TYPE_ORDER mismatch', { actual: engine.LABEL_TYPE_ORDER, expected: expectedOrder });
}

expectedOrder.forEach((type) => {
  const spec = engine.getStandardModalSpec(type);
  if (!spec) {
    addFailure(type, 'missing standard modal spec');
    return;
  }
  const modal = buildModal(engine, type);
  const labels = fieldLabels(modal.sheetBody);
  const text = bodyText(modal.sheetBody);
  assertIncludes(type, labels, contract[type].fields);
  assertExcludes(type, labels, contract[type].forbiddenFields);
  assertTextIncludes(type, text, contract[type].text);
  contract[type].forbiddenText.forEach((item) => {
    if (text.includes(item)) addFailure(type, `forbidden text present: ${item}`, { text });
  });
});

console.log('Shared label modal contract audit');
console.log(`Label types checked: ${expectedOrder.length}`);
console.log(`Findings: ${failures.length}`);
if (failures.length) {
  failures.forEach((failure) => {
    console.log(`- [${failure.type}] ${failure.message}`);
    if (failure.labels) console.log(`  labels: ${failure.labels.join(', ')}`);
    if (failure.text) console.log(`  text: ${failure.text}`);
  });
  process.exitCode = 1;
}
