import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const root = process.cwd();
const DRAW_ROOT = path.join(root, 'draw');
const FINDINGS = [];
const CONCURRENCY = Math.max(1, Number(process.env.SETTINGS_EFFECT_AUDIT_CONCURRENCY || 4));
const PAGE_TIMEOUT_MS = Math.max(2000, Number(process.env.SETTINGS_EFFECT_AUDIT_PAGE_TIMEOUT_MS || 7000));
const ACTION_TIMEOUT_MS = Math.max(1000, Number(process.env.SETTINGS_EFFECT_AUDIT_ACTION_TIMEOUT_MS || 2500));
const JSON_OUTPUT = process.argv.includes('--json');

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
  return /window\.location\.replace\(/.test(html) && !/id=["']stage["']/.test(html);
}

function discoverPages() {
  const only = process.argv.find((arg) => arg.startsWith('--only='));
  const onlyPattern = only ? only.slice('--only='.length) : '';
  return walk(DRAW_ROOT)
    .filter((file) => path.relative(root, file) !== 'draw/index.html')
    .filter((file) => !isRedirectOnly(fs.readFileSync(file, 'utf8')))
    .map((file) => ({ file, path: normalizePagePath(file), html: fs.readFileSync(file, 'utf8') }))
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
    || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium']
      .find((candidate) => fs.existsSync(candidate));
  if (executablePath) options.executablePath = executablePath;
  return options;
}

async function importPlaywright() {
  try {
    return await import('playwright');
  } catch (error) {
    throw new Error('Playwright is required. Run: npx -y -p playwright node scripts/audit-rendered-draw-settings-effects.mjs', { cause: error });
  }
}

function addFinding(pagePath, message, detail = {}) {
  FINDINGS.push({ page: pagePath, message, ...detail });
}

function includesAny(values, pattern) {
  return values.some((value) => pattern.test(value.text));
}

function numericLabel(value) {
  return /^-?[0-9]+(?:\.[0-9]+)?(?:°|cm²|m²|km²|cm|m|km)?$/.test(String(value.text || '').trim());
}

async function auditPage(page, pageInfo, baseUrl) {
  await page.goto(`${baseUrl}${pageInfo.path}?lang=ja&debugHit=1`, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
  await page.waitForTimeout(550);
  await page.waitForFunction(() => window.InstantGeometryDrawSettings, null, { timeout: ACTION_TIMEOUT_MS }).catch(() => {});

  const result = await page.evaluate(async () => {
    const labelSelector = [
      'text[data-kind]',
      'text[data-label-kind]',
      'text.segment-label',
      'text.measure-label',
      'text.angle-label',
      'text.arc-label',
      'text.area-label',
      'foreignObject[data-kind]',
      'foreignObject[data-label-kind]',
      '.floating-label[data-type]',
      '.floating-label[data-kind]',
      '.floating-label[data-label-kind]'
    ].join(',');
    const visible = (node) => {
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const kindOf = (node) => {
      const data = node.dataset || {};
      if (data.kind || data.type || data.labelKind) return data.kind || data.type || data.labelKind;
      if (node.classList.contains('segment-label') || node.classList.contains('measure-label')) return 'segment';
      if (node.classList.contains('angle-label')) return 'angle';
      if (node.classList.contains('arc-label')) return 'arc';
      if (node.classList.contains('area-label')) return 'area';
      return '';
    };
    const collect = () => Array.from(document.querySelectorAll(labelSelector))
      .filter(visible)
      .map((node) => ({
        kind: kindOf(node),
        text: (node.textContent || '').replace(/\s+/g, ' ').trim()
      }))
      .filter((entry) => entry.kind && entry.kind !== 'point' && entry.text);

    const before = collect();
    if (!window.InstantGeometryDrawSettings || typeof window.InstantGeometryDrawSettings.set !== 'function') {
      return { hasSettings: false, before, afterUnits: [], afterRadians: [], afterDecimalPi: [], afterDecimalPlaces: [] };
    }
    window.InstantGeometryDrawSettings.set({ distanceUnit: 'cm', angleUnit: 'degrees', piMode: 'symbol', decimalPlaces: 2 });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const afterUnits = collect();
    window.InstantGeometryDrawSettings.set({ distanceUnit: 'none', angleUnit: 'radians', piMode: 'symbol', decimalPlaces: 2 });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const afterRadians = collect();
    window.InstantGeometryDrawSettings.set({ distanceUnit: 'none', angleUnit: 'radians', piMode: 'decimal', decimalPlaces: 2 });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const afterDecimalPi = collect();
    window.InstantGeometryDrawSettings.set({ distanceUnit: 'none', angleUnit: 'degrees', piMode: 'symbol', decimalPlaces: 0 });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const afterDecimalPlaces = collect();
    return { hasSettings: true, before, afterUnits, afterRadians, afterDecimalPi, afterDecimalPlaces };
  });

  if (!result.hasSettings) {
    addFinding(pageInfo.path, 'draw settings engine is unavailable');
    return;
  }
  const beforeSegment = result.before.filter((item) => ['segment', 'side', 'measure', 'arc'].includes(item.kind) && numericLabel(item));
  const beforeArea = result.before.filter((item) => item.kind === 'area' && numericLabel(item));
  const beforeAngle = result.before.filter((item) => item.kind === 'angle' && /°$/.test(item.text));
  const beforePi = result.before.filter((item) => /π/.test(item.text));
  const beforeDecimal = result.before.filter((item) => /[0-9]\.[0-9]+/.test(item.text));

  if (beforeSegment.length && !includesAny(result.afterUnits, /(?:cm(?:\s|$)|\\mathrm\{cm\})/)) addFinding(pageInfo.path, 'distance unit did not affect rendered segment/arc labels', { sample: beforeSegment.slice(0, 3), afterSample: result.afterUnits.filter((item) => ['segment', 'side', 'measure', 'arc'].includes(item.kind)).slice(0, 5) });
  if (beforeArea.length && !includesAny(result.afterUnits, /(?:cm²|\\mathrm\{cm\^2\})/)) addFinding(pageInfo.path, 'distance unit did not affect rendered area labels', { sample: beforeArea.slice(0, 3) });
  if (beforeAngle.length && !result.afterRadians.some((item) => item.kind === 'angle' && !/°$/.test(item.text))) addFinding(pageInfo.path, 'angle unit did not affect rendered angle labels', { sample: beforeAngle.slice(0, 3) });
  if (beforePi.length && !result.afterDecimalPi.some((item) => !/π/.test(item.text))) addFinding(pageInfo.path, 'pi mode did not affect rendered pi labels', { sample: beforePi.slice(0, 3) });
  if (beforeDecimal.length && !result.afterDecimalPlaces.some((item) => /[0-9]/.test(item.text) && !/[0-9]\.[0-9]+/.test(item.text))) addFinding(pageInfo.path, 'decimal places did not affect rendered decimal labels', { sample: beforeDecimal.slice(0, 3) });
}

async function runPool(items, worker) {
  let index = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await worker(current);
    }
  });
  await Promise.all(workers);
}

const pages = discoverPages();
const server = await createStaticServer();
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;
const { chromium } = await importPlaywright();
const browser = await chromium.launch(getBrowserLaunchOptions());
let checked = 0;
try {
  await runPool(pages, async (pageInfo) => {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      window.katex = window.katex || {
        render: (latex, node) => {
          node.innerHTML = '<span class="katex"><span class="katex-html">' + String(latex || '')
            .replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])) +
            '</span></span>';
        }
      };
      localStorage.setItem('instantGeometryDrawSettings', JSON.stringify({ distanceUnit: 'none', angleUnit: 'degrees', piMode: 'symbol', decimalPlaces: 2 }));
    });
    const page = await context.newPage();
    page.setDefaultTimeout(ACTION_TIMEOUT_MS);
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith(baseUrl) || url.startsWith('data:') || url.startsWith('blob:')) route.continue();
      else route.abort();
    });
    try {
      await auditPage(page, pageInfo, baseUrl);
    } catch (error) {
      addFinding(pageInfo.path, 'audit failed', { error: String(error && error.message ? error.message : error) });
    } finally {
      checked += 1;
      if (!JSON_OUTPUT) process.stdout.write(`\rChecking ${checked}/${pages.length} ${pageInfo.path}`.padEnd(120));
      await context.close();
    }
  });
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

if (!JSON_OUTPUT) {
  process.stdout.write(`\rChecked ${checked}/${pages.length}`.padEnd(120) + '\n');
  console.log('Rendered draw settings effects audit');
  console.log(`Pages checked: ${pages.length}`);
  console.log(`Findings: ${FINDINGS.length}`);
  FINDINGS.slice(0, 200).forEach((finding) => {
    console.log(`- ${finding.page}: ${finding.message}`);
  });
  if (FINDINGS.length > 200) console.log(`... ${FINDINGS.length - 200} more`);
} else {
  console.log(JSON.stringify({ pages: pages.length, findings: FINDINGS }, null, 2));
}

if (FINDINGS.length) process.exitCode = 1;
