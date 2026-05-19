import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pageRoots = ['draw', 'function'];
const assetRoot = path.join(root, 'assets');
const args = new Set(process.argv.slice(2));
const excludedPages = new Set([
  'draw/index.html',
  'draw/regular-polygon/index.html'
]);

function walk(dir, files) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      walk(fullPath, files);
    } else if (entry.isFile() && entry.name === 'index.html') {
      files.push(fullPath);
    }
  }
}

function cleanSrc(src) {
  return String(src || '').split('?')[0].split('#')[0];
}

function resolveScriptPath(pageFile, src) {
  const clean = cleanSrc(src);
  if (!clean || /^https?:\/\//i.test(clean)) return null;
  if (clean.startsWith('/assets/')) return path.join(root, clean.slice(1));
  if (clean.startsWith('/')) return path.join(root, clean.slice(1));
  return path.resolve(path.dirname(pageFile), clean);
}

function readIfExists(file) {
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return '';
  return fs.readFileSync(file, 'utf8');
}

function extractScriptSrcs(html) {
  return Array.from(html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/g)).map((match) => match[1]);
}

function uniq(list) {
  return Array.from(new Set(list));
}

function rel(file) {
  return path.relative(root, file);
}

function localAssetName(file) {
  if (!file || !file.startsWith(assetRoot)) return rel(file);
  return path.relative(assetRoot, file);
}

function isSupportScript(file) {
  const name = path.basename(file || '');
  return [
    'draw-label-taxonomy.js',
    'draw-shared-label-engine.js',
    'triangle-label-engine.js',
    'draw-shared-labels.js',
    'draw-shared-label-config.js',
    'draw-shared-ornaments.js',
    'draw-shared-selection.js',
    'mobile-angle-ornaments.js',
    'function-view-settings.js',
    'function-svg-labels.js',
    'save-quota.js',
    'site-auto-i18n.js',
    'components.js'
  ].includes(name);
}

function analyzeJs(file) {
  const text = readIfExists(file);
  return {
    file,
    text,
    hasCreateController: /(?:InstantGeometryDrawLabelEngine|InstantGeometryTriangleLabelEngine|LabelEngine)\.createController\s*\(/.test(text),
    hasSharedEngineReference: /InstantGeometryDrawLabelEngine|InstantGeometryTriangleLabelEngine|LabelEngine/.test(text),
    hasRenderEditSheet: /\bfunction\s+renderEditSheet\b|\brenderEditSheet\s*\(/.test(text),
    hasOpenEditSheet: /\bfunction\s+openEditSheet\b|\bopenEditSheet\s*\(/.test(text),
    hasCommonBuilderUse: /InstantGeometryDrawLabelEngine\.(?:buildLabelEditor|buildSelect|buildCheckbox|buildColorPalette|buildRangeField|getStandardModalSpec)/.test(text),
    hasDirectSheetBuild: /\bsheetBody\.appendChild\b|\bsheetTitle\.textContent\b/.test(text)
  };
}

function classify(page) {
  if (page.hasEngine && page.hasTaxonomy && page.controllerScripts.length) return 'A: common-controller';
  if (page.hasEngine && page.hasTaxonomy && page.helperOnlyScripts.length) return 'B: shared-builders-only';
  if (page.hasEngine && page.hasTaxonomy) return 'B: engine-loaded-no-controller';
  if (page.hasLabelUi || page.hasDataKind || page.hasLocalDrawScript) return 'C: no-shared-engine';
  return 'D: no-label-surface-detected';
}

function summarizeBy(items, key) {
  const counts = new Map();
  for (const item of items) counts.set(item[key], (counts.get(item[key]) || 0) + 1);
  return Object.fromEntries(Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function formatPage(page) {
  const scripts = page.relevantScripts.length ? ` scripts=${page.relevantScripts.join(',')}` : '';
  const flags = [];
  if (page.customModalScripts.length) flags.push(`custom=${page.customModalScripts.join(',')}`);
  if (!page.hasTaxonomy && page.hasEngine) flags.push('missing-taxonomy');
  return `  - ${page.file} [${page.status}]${scripts}${flags.length ? ' ' + flags.join(' ') : ''}`;
}

const pageFiles = [];
pageRoots.forEach((pageRoot) => walk(path.join(root, pageRoot), pageFiles));

const excludedPageFiles = pageFiles.filter((pageFile) => excludedPages.has(rel(pageFile)));
const targetPageFiles = pageFiles.filter((pageFile) => !excludedPages.has(rel(pageFile)));

const pages = targetPageFiles.map((pageFile) => {
  const html = fs.readFileSync(pageFile, 'utf8');
  const srcs = extractScriptSrcs(html);
  const localScripts = srcs
    .map((src) => resolveScriptPath(pageFile, src))
    .filter(Boolean)
    .filter((file) => file.startsWith(root) && fs.existsSync(file));
  const jsAnalyses = localScripts.map(analyzeJs);
  const pageJsAnalyses = jsAnalyses.filter((analysis) => !isSupportScript(analysis.file));
  const hasTaxonomy = srcs.some((src) => /draw-label-taxonomy\.js/.test(src));
  const hasEngine = srcs.some((src) => /(?:draw-shared-label-engine|triangle-label-engine)\.js/.test(src));
  const hasLabelUi = /id=["']editSheet["']|id=["']sheetBody["']|id=["']sheetTitle["']/.test(html);
  const hasDataKind = /data-kind=|data-label-kind=/.test(html);
  const hasLocalDrawScript = pageJsAnalyses.some((analysis) => /(?:draw|triangle|quadrilateral|polygon|conic|solid|function)-/.test(path.basename(analysis.file)));
  const controllerScripts = pageJsAnalyses.filter((analysis) => analysis.hasCreateController).map((analysis) => localAssetName(analysis.file));
  const helperOnlyScripts = pageJsAnalyses
    .filter((analysis) => !analysis.hasCreateController && (analysis.hasCommonBuilderUse || analysis.hasSharedEngineReference))
    .map((analysis) => localAssetName(analysis.file));
  const customModalScripts = pageJsAnalyses
    .filter((analysis) => !analysis.hasCreateController && (analysis.hasRenderEditSheet || analysis.hasDirectSheetBuild))
    .map((analysis) => localAssetName(analysis.file));
  const relevantScripts = uniq(controllerScripts.concat(helperOnlyScripts, customModalScripts));
  const page = {
    file: rel(pageFile),
    hasTaxonomy,
    hasEngine,
    hasLabelUi,
    hasDataKind,
    hasLocalDrawScript,
    controllerScripts: uniq(controllerScripts),
    helperOnlyScripts: uniq(helperOnlyScripts),
    customModalScripts: uniq(customModalScripts),
    relevantScripts: uniq(relevantScripts)
  };
  page.status = classify(page);
  return page;
});

const statusCounts = summarizeBy(pages, 'status');
const enginePages = pages.filter((page) => page.hasEngine);
const missingTaxonomy = pages.filter((page) => page.hasEngine && !page.hasTaxonomy);
const notCommonController = pages.filter((page) => page.status.startsWith('B:') || page.status.startsWith('C:'));

if (args.has('--json')) {
  console.log(JSON.stringify({
    pagesScanned: pages.length,
    pagesExcluded: excludedPageFiles.map(rel),
    statusCounts,
    enginePages: enginePages.length,
    missingTaxonomy,
    notCommonController,
    pages
  }, null, 2));
} else {
  console.log('Label engine adoption audit');
  console.log(`Pages scanned: ${pages.length}`);
  console.log(`Pages excluded: ${excludedPageFiles.length}`);
  console.log(`Pages with shared label engine: ${enginePages.length}`);
  console.log(`Pages missing taxonomy before engine: ${missingTaxonomy.length}`);
  console.log('');
  console.log('Status counts');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });
  console.log('');
  console.log('Status meaning');
  console.log('  A: page loads taxonomy + shared engine, and its page JS calls LabelEngine.createController');
  console.log('  B: page loads taxonomy + shared engine, but page JS still builds the modal itself or only uses shared field builders');
  console.log('  C: page appears to have a label/edit surface but does not load the shared label engine');
  console.log('  D: no obvious label/edit surface was detected');
  if (notCommonController.length) {
    console.log('');
    console.log('Pages not on common controller yet');
    notCommonController.slice(0, args.has('--all') ? notCommonController.length : 80).forEach((page) => {
      console.log(formatPage(page));
    });
    if (!args.has('--all') && notCommonController.length > 80) {
      console.log(`  ... ${notCommonController.length - 80} more. Re-run with --all to show all.`);
    }
  }
  if (missingTaxonomy.length) {
    console.log('');
    console.log('Shared-engine pages missing taxonomy');
    missingTaxonomy.forEach((page) => console.log(formatPage(page)));
  }
}

if (missingTaxonomy.length || (args.has('--strict') && notCommonController.length)) {
  process.exit(1);
}
