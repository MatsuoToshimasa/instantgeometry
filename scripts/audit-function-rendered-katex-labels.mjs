import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const root = process.cwd();
const FUNCTION_ROOT = path.join(root, 'function');
const FINDINGS = [];
const CONCURRENCY = Math.max(1, Number(process.env.KATEX_LABEL_AUDIT_CONCURRENCY || 4));
const PAGE_TIMEOUT_MS = Math.max(2000, Number(process.env.KATEX_LABEL_AUDIT_PAGE_TIMEOUT_MS || 15000));
const ACTION_TIMEOUT_MS = Math.max(1000, Number(process.env.KATEX_LABEL_AUDIT_ACTION_TIMEOUT_MS || 2500));
const JSON_OUTPUT = process.argv.includes('--json');
const REAL_KATEX = process.argv.includes('--real-katex');

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
  return walk(FUNCTION_ROOT)
    .filter((file) => {
      const html = fs.readFileSync(file, 'utf8');
      return /id=["']stage["']/.test(html) && !isRedirectOnly(html);
    })
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
    throw new Error('Playwright is required. Run: npx -y -p playwright node scripts/audit-function-rendered-katex-labels.mjs', { cause: error });
  }
}

function addFinding(pagePath, message, detail = {}) {
  FINDINGS.push({ page: pagePath, message, ...detail });
}

async function auditPage(page, pageInfo, baseUrl) {
  await page.goto(`${baseUrl}${pageInfo.path}?lang=ja`, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
  await page.waitForTimeout(650);

  const result = await page.evaluate(() => {
    const labelSelector = [
      'text.function-label',
      'text.function-tick-label',
      'text.complex-label',
      'text.complex-tick-label',
      'text.la-label',
      'text.la-tick-label',
      'text.la-axis-label'
    ].join(',');
    const isVisible = (node) => {
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      if (Number(style.opacity) <= 0.01 || Number(node.getAttribute('opacity') || 1) <= 0.01) return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const textOf = (node) => (node.textContent || '').replace(/\s+/g, ' ').trim();
    const labelTexts = Array.from(document.querySelectorAll(labelSelector)).map((node) => ({
      text: textOf(node),
      className: node.getAttribute('class') || '',
      processed: node.getAttribute('data-rich-label-source') === '1',
      visible: isVisible(node),
      html: node.outerHTML.slice(0, 180)
    })).filter((entry) => entry.text);
    const rendered = Array.from(document.querySelectorAll('foreignObject.function-katex-label, .function-katex-label')).map((node) => ({
      text: textOf(node),
      katex: Boolean(node.querySelector && node.querySelector('.katex')),
      visible: isVisible(node),
      html: node.outerHTML.slice(0, 180)
    })).filter((entry) => entry.text);
    return {
      hasFunctionSvgLabels: Boolean(window.InstantGeometrySvgLabels),
      labelTexts,
      rendered
    };
  });

  if (!result.hasFunctionSvgLabels) addFinding(pageInfo.path, 'function KaTeX label engine is not loaded');
  result.labelTexts.forEach((label) => {
    if (label.visible || !label.processed) addFinding(pageInfo.path, 'SVG text label was not replaced by KaTeX', label);
  });
  result.rendered.forEach((label) => {
    if (label.visible && !label.katex) addFinding(pageInfo.path, 'rendered function label is not KaTeX', label);
  });
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
  console.log('Function rendered KaTeX label audit');
  console.log(`Pages checked: ${pages.length}`);
  console.log(`Findings: ${FINDINGS.length}`);
  FINDINGS.slice(0, 200).forEach((finding) => {
    console.log(`- ${finding.page}: ${finding.message}${finding.text ? ` text="${finding.text}"` : ''}`);
  });
  if (FINDINGS.length > 200) console.log(`... ${FINDINGS.length - 200} more`);
} else {
  console.log(JSON.stringify({ pages: pages.length, findings: FINDINGS }, null, 2));
}

if (FINDINGS.length) process.exitCode = 1;
