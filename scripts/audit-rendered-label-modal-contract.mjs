import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const DRAW_ROOT = path.join(root, 'draw');
const LABEL_TYPES = ['point', 'segment', 'angle', 'area', 'arc', 'volume', 'function'];
const FINDINGS = [];
const DEFAULT_TIMEOUT_MS = Math.max(1000, Number(process.env.LABEL_MODAL_AUDIT_ACTION_TIMEOUT_MS || 2500));
const PAGE_TIMEOUT_MS = Math.max(2000, Number(process.env.LABEL_MODAL_AUDIT_PAGE_TIMEOUT_MS || 5000));
const CONCURRENCY = Math.max(1, Number(process.env.LABEL_MODAL_AUDIT_CONCURRENCY || 4));
const JSON_OUTPUT = process.argv.includes('--json');

const CONTRACT = {
  point: {
    fields: ['ラベル', 'ラベルサイズ', '色'],
    actions: ['キャンセル', '移動', '保存'],
    text: ['自由入力'],
    forbiddenFields: ['線分マーク', '角マーク', 'ガイドを表示', '角弧サイズ']
  },
  segment: {
    fields: ['線分マーク', 'ガイドを表示', 'ラベル', 'ラベルサイズ', '色'],
    actions: ['キャンセル', '移動', '保存'],
    text: ['数値（自動）', '数値（小数）', '比の値'],
    forbiddenFields: ['角マーク', '角弧サイズ']
  },
  angle: {
    fields: ['角マーク', '角弧サイズ', 'ラベル', 'ラベルサイズ', '色'],
    actions: ['キャンセル', '移動', '保存'],
    text: ['数値（自動）', '数値（小数）', '比の値'],
    forbiddenFields: ['線分マーク', 'ガイドを表示']
  },
  area: {
    fields: ['ガイドを表示', 'ラベル', 'ラベルサイズ', '色'],
    actions: ['キャンセル', '移動', '保存'],
    text: ['数値（自動）', '数値（小数）', '比の値'],
    forbiddenFields: ['線分マーク', '角マーク', '角弧サイズ']
  },
  arc: {
    fields: ['ラベル', 'ラベルサイズ', '色'],
    actions: ['キャンセル', '移動', '保存'],
    text: ['数値（自動）', '数値（小数）', '比の値'],
    forbiddenFields: ['線分マーク', '角マーク', 'ガイドを表示', '角弧サイズ']
  },
  volume: {
    fields: ['ガイドを表示', 'ラベル', 'ラベルサイズ', '色'],
    actions: ['キャンセル', '移動', '保存'],
    text: ['数値（自動）', '数値（小数）'],
    forbiddenFields: ['線分マーク', '角マーク', '角弧サイズ'],
    forbiddenText: ['比の値']
  },
  function: {
    fields: ['ラベル', 'ラベルサイズ', '色'],
    actions: ['キャンセル', '移動', '保存'],
    text: ['自由入力'],
    forbiddenFields: ['線分マーク', '角マーク', 'ガイドを表示', '角弧サイズ'],
    forbiddenText: ['数値（自動）', '数値（小数）', '比の値']
  }
};

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

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name === 'index.html') out.push(full);
  }
  return out;
}

function normalizePagePath(file) {
  return '/' + path.relative(root, file).replaceAll(path.sep, '/').replace(/index\.html$/, '');
}

function isRedirectOnly(html) {
  return /window\.location\.replace\(/.test(html) && !/id=["']sheetBody["']/.test(html);
}

function discoverPages() {
  const only = process.argv.find((arg) => arg.startsWith('--only='));
  const onlyPattern = only ? only.slice('--only='.length) : '';
  return walk(DRAW_ROOT)
    .filter((file) => path.relative(root, file) !== 'draw/index.html')
    .filter((file) => !isRedirectOnly(fs.readFileSync(file, 'utf8')))
    .map((file) => {
      const html = fs.readFileSync(file, 'utf8');
      return {
        file,
        path: normalizePagePath(file),
        hasModalHost: /id=["']sheetBody["']/.test(html) && /id=["']editSheet["']/.test(html),
        hasSharedEngine: /draw-shared-label-engine\.js/.test(html)
      };
    })
    .filter((page) => !onlyPattern || page.path.includes(onlyPattern))
    .sort((a, b) => a.path.localeCompare(b.path));
}

function createStaticServer() {
  const server = http.createServer((req, res) => {
    try {
      const parsed = new URL(req.url || '/', 'http://127.0.0.1');
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
      res.writeHead(500);
      res.end(String(error && error.stack ? error.stack : error));
    }
  });
  return new Promise((resolve) => {
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
    const message = [
      'Playwright is required for rendered modal auditing.',
      'Run this audit with one of:',
      '  npm install --save-dev playwright',
      '  npx -y -p playwright node scripts/audit-rendered-label-modal-contract.mjs'
    ].join('\n');
    throw new Error(message, { cause: error });
  }
}

function addFinding(pagePath, type, message, detail = {}) {
  FINDINGS.push({ page: pagePath, type, message, ...detail });
}

function listMissing(actual, expected) {
  return expected.filter((item) => !actual.includes(item));
}

function assertContract(pagePath, kind, modal) {
  const contract = CONTRACT[kind];
  if (!contract) return;
  const missingFields = listMissing(modal.fields, contract.fields);
  const missingActions = listMissing(modal.actions, contract.actions);
  const missingText = listMissing(modal.text, contract.text || []);
  const forbiddenFields = (contract.forbiddenFields || []).filter((item) => modal.fields.includes(item));
  const forbiddenText = (contract.forbiddenText || []).filter((item) => modal.text.includes(item));

  if (missingFields.length) addFinding(pagePath, kind, `missing fields: ${missingFields.join(', ')}`, modal);
  if (missingActions.length) addFinding(pagePath, kind, `missing actions: ${missingActions.join(', ')}`, modal);
  if (missingText.length) addFinding(pagePath, kind, `missing text: ${missingText.join(', ')}`, modal);
  if (forbiddenFields.length) addFinding(pagePath, kind, `forbidden fields: ${forbiddenFields.join(', ')}`, modal);
  if (forbiddenText.length) addFinding(pagePath, kind, `forbidden text: ${forbiddenText.join(', ')}`, modal);
}

async function auditPage(page, pageInfo, baseUrl) {
  const url = `${baseUrl}${pageInfo.path}?lang=ja&debugHit=1&auditLabelModal=1`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: DEFAULT_TIMEOUT_MS });
  await page.waitForTimeout(350);

  const rendered = await page.evaluate(() => {
    const typeSet = new Set(['point', 'segment', 'angle', 'area', 'arc', 'volume', 'function']);
    const normalize = (value) => {
      const text = String(value || '').trim();
      if (window.InstantGeometryLabelTaxonomy && typeof window.InstantGeometryLabelTaxonomy.normalizeKind === 'function') {
        return window.InstantGeometryLabelTaxonomy.normalizeKind(text);
      }
      return text;
    };
    const invalidDataLabelKinds = Array.from(document.querySelectorAll('[data-label-kind]'))
      .map((node) => ({
        kind: String(node.getAttribute('data-label-kind') || '').trim(),
        role: String(node.getAttribute('data-label-role') || '').trim(),
        id: String(node.getAttribute('data-label-id') || node.getAttribute('data-id') || '').trim(),
        tag: node.tagName
      }))
      .filter((item) => item.kind && !typeSet.has(item.kind));
    const rawCandidates = [];
    [
      ['[data-point-id]', 'point', 'pointId'],
      ['[data-dimension-id]', 'segment', 'dimensionId'],
      ['[data-angle-id]', 'angle', 'angleId'],
      ['[data-area-id]', 'area', 'areaId']
    ].forEach(([selector, kind, datasetKey]) => {
      Array.from(document.querySelectorAll(selector)).forEach((node) => {
        const explicitKind = node.getAttribute('data-label-kind') || node.getAttribute('data-kind');
        rawCandidates.push({
          node,
          kind: normalize(explicitKind || kind),
          id: node.dataset[datasetKey],
          tag: node.tagName
        });
      });
    });
    Array.from(document.querySelectorAll('[data-kind][data-id]')).forEach((node) => {
      rawCandidates.push({
        node,
        kind: normalize(node.getAttribute('data-kind')),
        id: node.getAttribute('data-id'),
        tag: node.tagName
      });
    });
    Array.from(document.querySelectorAll('[data-label-kind][data-label-id]')).forEach((node) => {
      rawCandidates.push({
        node,
        kind: normalize(node.getAttribute('data-label-kind')),
        id: node.getAttribute('data-label-id'),
        tag: node.tagName
      });
    });
    const candidates = rawCandidates
      .filter((item) => item.id && typeSet.has(item.kind))
      .map((item, index) => {
        item.node.setAttribute('data-audit-label-modal-index', String(index));
        return {
          index,
          kind: item.kind,
          id: item.id,
          tag: item.tag
        };
      });
    const byKind = [];
    const seen = new Set();
    for (const candidate of candidates) {
      if (seen.has(candidate.kind)) continue;
      seen.add(candidate.kind);
      byKind.push(candidate);
    }
    return {
      title: document.title,
      hasModalHost: Boolean(document.getElementById('editSheet') && document.getElementById('sheetBody')),
      hasSharedEngine: Boolean(window.InstantGeometryDrawLabelEngine || window.InstantGeometryTriangleLabelEngine),
      invalidDataLabelKinds,
      targets: byKind
    };
  });

  if (!rendered.hasModalHost) {
    addFinding(pageInfo.path, 'page', 'missing modal host');
    return;
  }
  if (!rendered.hasSharedEngine) {
    addFinding(pageInfo.path, 'page', 'shared label engine not loaded');
    return;
  }
  for (const item of rendered.invalidDataLabelKinds) {
    addFinding(pageInfo.path, 'taxonomy', `data-label-kind is not one of 7 categories: ${item.kind}`, item);
  }
  if (!rendered.targets.length) {
    addFinding(pageInfo.path, 'page', 'no rendered label targets found');
    return;
  }

  for (const target of rendered.targets) {
    const modal = await page.evaluate(({ index, kind }) => {
      const close = document.getElementById('sheetClose');
      if (close) close.click();
      const node = document.querySelector('[data-audit-label-modal-index="' + index + '"]');
      if (!node) return { opened: false, fields: [], actions: [], text: '', reason: 'target disappeared' };
      const rect = node.getBoundingClientRect();
      const eventInit = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2
      };
      node.dispatchEvent(new PointerEvent('pointerdown', eventInit));
      node.dispatchEvent(new PointerEvent('pointerup', eventInit));
      node.dispatchEvent(new MouseEvent('click', eventInit));
      const sheet = document.getElementById('editSheet');
      const body = document.getElementById('sheetBody');
      const opened = Boolean(sheet && body && (sheet.classList.contains('open') || sheet.getAttribute('aria-hidden') === 'false'));
      const fields = body ? Array.from(body.querySelectorAll('label')).map((label) => label.textContent.trim()).filter(Boolean) : [];
      const actions = body ? Array.from(body.querySelectorAll('.sheet-actions button')).map((button) => button.textContent.trim()).filter(Boolean) : [];
      const text = body ? body.textContent.replace(/\s+/g, ' ').trim() : '';
      return {
        kind,
        opened,
        fields,
        actions: Array.from(new Set(actions)),
        text
      };
    }, target);

    if (!modal.opened) {
      addFinding(pageInfo.path, target.kind, `target did not open modal: ${target.id}`, modal);
      continue;
    }
    assertContract(pageInfo.path, target.kind, modal);
  }
}

function withTimeout(promise, timeoutMs, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function main() {
  const pages = discoverPages();
  const staticMissing = pages.filter((page) => page.hasModalHost && !page.hasSharedEngine);
  staticMissing.forEach((page) => addFinding(page.path, 'page', 'modal host exists but shared engine script is missing'));

  const { chromium } = await importPlaywright();
  const server = await createStaticServer();
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  let browser;

  try {
    browser = await chromium.launch(getBrowserLaunchOptions());
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1200 },
      deviceScaleFactor: 1
    });
    await context.route('**/*', (route) => {
      const requestUrl = route.request().url();
      if (requestUrl.startsWith(baseUrl) || requestUrl.startsWith('data:') || requestUrl.startsWith('blob:')) {
        route.continue();
        return;
      }
      route.abort();
    });
    let nextIndex = 0;
    let completed = 0;
    const runOne = async (pageInfo, index) => {
      if (process.env.CI !== 'true' && !JSON_OUTPUT) {
        process.stdout.write(`\rChecking ${index + 1}/${pages.length} ${pageInfo.path}`.padEnd(120));
      }
      const browserPage = await context.newPage();
      browserPage.setDefaultTimeout(DEFAULT_TIMEOUT_MS);
      browserPage.on('pageerror', (error) => {
        addFinding(pageInfo.path, 'runtime', error.message);
      });
      try {
        await withTimeout(
          auditPage(browserPage, pageInfo, baseUrl),
          PAGE_TIMEOUT_MS,
          `page audit timed out after ${PAGE_TIMEOUT_MS}ms`
        );
      } catch (error) {
        addFinding(pageInfo.path, 'page', error && error.message ? error.message : String(error));
      } finally {
        await browserPage.close({ runBeforeUnload: false }).catch(() => {});
        completed += 1;
      }
    };
    const worker = async () => {
      while (nextIndex < pages.length) {
        const index = nextIndex;
        nextIndex += 1;
        await runOne(pages[index], index);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pages.length) }, worker));
    if (process.env.CI !== 'true' && !JSON_OUTPUT) {
      process.stdout.write(`\rChecked ${completed}/${pages.length}`.padEnd(120));
    }
    if (process.env.CI !== 'true' && !JSON_OUTPUT) process.stdout.write('\n');
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }

  if (JSON_OUTPUT) {
    console.log(JSON.stringify({
      title: 'Rendered shared label modal contract audit',
      pagesChecked: pages.length,
      findings: FINDINGS
    }, null, 2));
    if (FINDINGS.length) process.exitCode = 1;
    return;
  }

  console.log('Rendered shared label modal contract audit');
  console.log(`Pages checked: ${pages.length}`);
  console.log(`Findings: ${FINDINGS.length}`);
  if (FINDINGS.length) {
    for (const finding of FINDINGS) {
      console.log(`- ${finding.page} [${finding.type}] ${finding.message}`);
      if (finding.fields) console.log(`  fields: ${finding.fields.join(', ')}`);
      if (finding.actions) console.log(`  actions: ${finding.actions.join(', ')}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error && error.message ? error.message : error);
  process.exitCode = 1;
});
