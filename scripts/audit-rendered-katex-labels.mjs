import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const root = process.cwd();
const DRAW_ROOT = path.join(root, 'draw');
const FINDINGS = [];
const CONCURRENCY = Math.max(1, Number(process.env.KATEX_LABEL_AUDIT_CONCURRENCY || 4));
const PAGE_TIMEOUT_MS = Math.max(2000, Number(process.env.KATEX_LABEL_AUDIT_PAGE_TIMEOUT_MS || 5000));
const ACTION_TIMEOUT_MS = Math.max(1000, Number(process.env.KATEX_LABEL_AUDIT_ACTION_TIMEOUT_MS || 2500));
const PAGE_HARD_TIMEOUT_MS = Math.max(PAGE_TIMEOUT_MS + ACTION_TIMEOUT_MS, Number(process.env.KATEX_LABEL_AUDIT_HARD_TIMEOUT_MS || 15000));
const RENDER_SETTLE_MS = Math.max(0, Number(process.env.KATEX_LABEL_AUDIT_RENDER_SETTLE_MS || 450));
const JSON_OUTPUT = process.argv.includes('--json');
const REAL_KATEX = process.argv.includes('--real-katex');
const BROWSER_NAME = (process.argv.find((arg) => arg.startsWith('--browser=')) || '--browser=chromium').slice('--browser='.length);

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
  return /window\.location\.replace\(/.test(html) && !/id=["']stage["']/.test(html);
}

function discoverPages() {
  const only = process.argv.find((arg) => arg.startsWith('--only='));
  const onlyPattern = only ? only.slice('--only='.length) : '';
  return walk(DRAW_ROOT)
    .filter((file) => path.relative(root, file) !== 'draw/index.html')
    .filter((file) => !isRedirectOnly(fs.readFileSync(file, 'utf8')))
    .map((file) => ({
      file,
      path: normalizePagePath(file),
      html: fs.readFileSync(file, 'utf8')
    }))
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

function getBrowserLaunchOptions(browserName) {
  const options = { headless: true };
  if (browserName === 'webkit') {
    const executablePath = process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE || findLatestPlaywrightExecutable('webkit-', 'pw_run.sh');
    if (executablePath) options.executablePath = executablePath;
    return options;
  }
  if (browserName !== 'chromium') return options;
  const executablePath = process.env.PLAYWRIGHT_CHROME_EXECUTABLE
    || [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    ].find((candidate) => fs.existsSync(candidate));
  if (executablePath) options.executablePath = executablePath;
  return options;
}

function findLatestPlaywrightExecutable(prefix, relativeExecutable) {
  const roots = [
    path.join(process.env.HOME || '', 'Library/Caches/ms-playwright'),
    path.join(process.env.HOME || '', '.cache/ms-playwright')
  ];
  for (const cacheRoot of roots) {
    try {
      const entries = fs.readdirSync(cacheRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        const candidate = path.join(cacheRoot, entries[index], relativeExecutable);
        if (fs.existsSync(candidate)) return candidate;
      }
    } catch (_) {}
  }
  return '';
}

async function importPlaywright() {
  try {
    return await import('playwright');
  } catch (error) {
    throw new Error('Playwright is required. Run: npx -y -p playwright node scripts/audit-rendered-katex-labels.mjs', { cause: error });
  }
}

function getBrowserLauncher(playwright) {
  if (BROWSER_NAME === 'webkit') return playwright.webkit;
  if (BROWSER_NAME === 'firefox') return playwright.firefox;
  if (BROWSER_NAME === 'chromium') return playwright.chromium;
  throw new Error(`Unsupported browser: ${BROWSER_NAME}`);
}

function addFinding(pagePath, message, detail = {}) {
  FINDINGS.push({ page: pagePath, message, ...detail });
}

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  if (timer && typeof timer.unref === 'function') timer.unref();
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function auditPage(page, pageInfo, baseUrl) {
  await page.goto(`${baseUrl}${pageInfo.path}?lang=ja&debugHit=1`, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
  await page.waitForTimeout(RENDER_SETTLE_MS);

  const result = await page.evaluate(() => {
    const isVisible = (node) => {
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const textOf = (node) => (node.textContent || '').replace(/\s+/g, ' ').trim();
    const isUiText = (text) => /^(戻る|保存|設定|PNG|PDF|透過PNG|キャンセル|移動|完了|閉じる)$/.test(text);
    const needsMathRenderer = (text) => Boolean(text && !isUiText(text));
    const hasKatex = (node) => Boolean(node.querySelector && node.querySelector('.katex'));
    const labels = [];

    Array.from(document.querySelectorAll('.floating-label')).forEach((node) => {
      if (!isVisible(node)) return;
      const text = textOf(node);
      if (!needsMathRenderer(text)) return;
      labels.push({
        source: 'floating-label',
        text,
        kind: node.dataset.kind || node.dataset.type || node.dataset.labelKind || '',
        id: node.dataset.id || node.dataset.labelId || '',
        katex: hasKatex(node),
        html: node.innerHTML.slice(0, 180)
      });
    });

    Array.from(document.querySelectorAll('foreignObject')).forEach((node) => {
      if (!isVisible(node)) return;
      const text = textOf(node);
      if (!needsMathRenderer(text)) return;
      labels.push({
        source: 'foreignObject',
        text,
        kind: node.getAttribute('data-label-kind') || node.getAttribute('data-kind') || '',
        id: node.getAttribute('data-label-id') || node.getAttribute('data-id') || '',
        katex: hasKatex(node),
        html: node.innerHTML.slice(0, 180)
      });
    });

    Array.from(document.querySelectorAll('svg text')).forEach((node) => {
      if (!isVisible(node)) return;
      if (node.classList.contains('triangle-katex-source-hidden')) return;
      const text = textOf(node);
      if (!needsMathRenderer(text)) return;
      const className = node.getAttribute('class') || '';
      const dataKind = node.getAttribute('data-kind') || node.getAttribute('data-label-kind') || '';
      const isLikelyGeometryLabel = /label|measure|angle|area|segment|point|shape/.test(className) || dataKind;
      if (!isLikelyGeometryLabel) return;
      labels.push({
        source: 'svg-text',
        text,
        kind: dataKind,
        id: node.getAttribute('data-id') || node.getAttribute('data-label-id') || '',
        katex: false,
        html: node.outerHTML.slice(0, 180)
      });
    });

    return {
      title: document.title,
      hasKatexApi: Boolean(window.katex && typeof window.katex.render === 'function'),
      hasSharedLabelApi: Boolean(window.InstantGeometrySharedLabels),
      labels
    };
  });

  if (pageInfo.html.includes('katex') && !result.hasKatexApi) {
    addFinding(pageInfo.path, 'KaTeX script is referenced but window.katex is unavailable');
  }
  result.labels.forEach((label) => {
    if (!label.katex) addFinding(pageInfo.path, 'rendered label is not KaTeX', label);
  });
  return result;
}

async function runPool(items, worker) {
  let index = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await worker(current, index);
    }
  });
  await Promise.all(workers);
}

const pages = discoverPages();
const server = await createStaticServer();
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;
const playwright = await importPlaywright();
const browser = await getBrowserLauncher(playwright).launch(getBrowserLaunchOptions(BROWSER_NAME));
let checked = 0;
try {
  await runPool(pages, async (pageInfo) => {
    const context = await browser.newContext();
    if (!REAL_KATEX) {
      await context.addInitScript(() => {
        window.katex = window.katex || {
          render: (latex, node) => {
            node.innerHTML = '<span class="katex"><span class="katex-html">' + String(latex || '')
              .replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])) +
              '</span></span>';
          }
        };
      });
    }
    const page = await context.newPage();
    page.setDefaultTimeout(ACTION_TIMEOUT_MS);
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (
        url.startsWith(baseUrl)
        || url.startsWith('data:')
        || url.startsWith('blob:')
        || (REAL_KATEX && url.includes('cdn.jsdelivr.net/npm/katex@'))
      ) route.continue();
      else route.abort();
    });
    try {
      await withTimeout(
        auditPage(page, pageInfo, baseUrl),
        PAGE_HARD_TIMEOUT_MS,
        `audit timed out after ${PAGE_HARD_TIMEOUT_MS}ms`
      );
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
  console.log('Rendered KaTeX label audit');
  console.log(`Browser: ${BROWSER_NAME}`);
  console.log(`Pages checked: ${pages.length}`);
  console.log(`Findings: ${FINDINGS.length}`);
  FINDINGS.slice(0, 200).forEach((finding) => {
    const target = [finding.kind, finding.id].filter(Boolean).join(':');
    console.log(`- ${finding.page}: ${finding.message}${target ? ` (${target})` : ''}${finding.text ? ` text="${finding.text}"` : ''}`);
  });
  if (FINDINGS.length > 200) console.log(`... ${FINDINGS.length - 200} more`);
} else {
  console.log(JSON.stringify({ pages: pages.length, findings: FINDINGS }, null, 2));
}

if (FINDINGS.length) process.exitCode = 1;
