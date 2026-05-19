import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const scanRoots = ['assets', 'draw', 'function'];
const allowedExtensions = new Set(['.js', '.html']);
const excludedFiles = new Set([
  'draw/index.html',
  'function/index.html'
]);
const canonicalKinds = new Set(['point', 'segment', 'angle', 'area', 'arc', 'volume', 'function']);
const knownRawKinds = new Set([
  'point',
  'segment',
  'angle',
  'area',
  'arc',
  'volume',
  'function',
  'side',
  'vertex',
  'specialVertex',
  'specialPoint',
  'specialSegment',
  'diagonal',
  'extraSegment',
  'centerLine',
  'segmentObject',
  'angleMark',
  'rightAngleMark',
  'extraAngle',
  'extraArea',
  'discreteArea',
  'curve',
  'graph',
  'vector',
  'circle',
  'measure'
]);
const nonLabelKinds = new Set([
  'real',
  'label',
  'button',
  'text',
  'number',
  'range',
  'checkbox',
  'radio',
  'search',
  'decimal',
  'numeric'
]);

function loadTaxonomy() {
  const code = fs.readFileSync(path.join(root, 'assets/draw-label-taxonomy.js'), 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(code, sandbox, { filename: 'assets/draw-label-taxonomy.js' });
  if (!sandbox.window.InstantGeometryLabelTaxonomy) {
    throw new Error('InstantGeometryLabelTaxonomy was not created.');
  }
  return sandbox.window.InstantGeometryLabelTaxonomy;
}

function walk(dir, files) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      walk(fullPath, files);
      continue;
    }
    if (!allowedExtensions.has(path.extname(entry.name))) continue;
    const rel = path.relative(root, fullPath);
    if (excludedFiles.has(rel)) continue;
    files.push(fullPath);
  }
}

function lineForOffset(text, offset) {
  let line = 1;
  for (let i = 0; i < offset; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function cleanSnippet(text) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 180);
}

function addMatch(matches, seen, file, content, offset, kind, id, source, snippet) {
  if (!kind) return;
  const rawKind = String(kind);
  if (nonLabelKinds.has(rawKind)) return;
  const rawId = id == null ? '' : String(id);
  const key = [file, offset, rawKind, rawId, source].join('\u0000');
  if (seen.has(key)) return;
  seen.add(key);
  matches.push({
    file: path.relative(root, file),
    line: lineForOffset(content, offset),
    rawKind,
    rawId,
    source,
    snippet: cleanSnippet(snippet)
  });
}

function extractTargets(file, content) {
  const matches = [];
  const seen = new Set();
  const patterns = [
    {
      source: 'append-call',
      regex: /\bappend(?:Hit|Text)\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/g,
      kindIndex: 1,
      idIndex: 2
    },
    {
      source: 'open-label-call',
      regex: /\bopen(?:Label|Sheet|EditSheet|LabelEditor|LabelModal)?\(\s*['"](?:edit|label)?['"]?\s*,?\s*(?:\{\s*)?(?:kind\s*:\s*)?['"]([^'"]+)['"]\s*,\s*(?:id\s*:\s*)?['"]([^'"]+)['"]/g,
      kindIndex: 1,
      idIndex: 2
    },
    {
      source: 'inline-object',
      regex: /\{\s*(?:type|kind)\s*:\s*['"]([^'"]+)['"]\s*,\s*id\s*:\s*['"]([^'"]+)['"][^}]*\}/g,
      kindIndex: 1,
      idIndex: 2
    },
    {
      source: 'inline-object-reversed',
      regex: /\{\s*id\s*:\s*['"]([^'"]+)['"]\s*,\s*(?:type|kind)\s*:\s*['"]([^'"]+)['"][^}]*\}/g,
      kindIndex: 2,
      idIndex: 1
    },
    {
      source: 'html-data-kind',
      regex: /data-kind=["']([^"']+)["'][^>]{0,240}data-id=["']([^"']+)["']/g,
      kindIndex: 1,
      idIndex: 2
    },
    {
      source: 'html-data-kind-reversed',
      regex: /data-id=["']([^"']+)["'][^>]{0,240}data-kind=["']([^"']+)["']/g,
      kindIndex: 2,
      idIndex: 1
    },
    {
      source: 'js-data-kind',
      regex: /['"]data-kind['"]\s*:\s*['"]([^'"]+)['"][^}\n]{0,240}['"]data-id['"]\s*:\s*['"]([^'"]+)['"]/g,
      kindIndex: 1,
      idIndex: 2
    },
    {
      source: 'js-data-kind-reversed',
      regex: /['"]data-id['"]\s*:\s*['"]([^'"]+)['"][^}\n]{0,240}['"]data-kind['"]\s*:\s*['"]([^'"]+)['"]/g,
      kindIndex: 2,
      idIndex: 1
    },
    {
      source: 'target-config',
      regex: /\{[^}\n]{0,260}\bkey\s*:\s*['"]([^'"]+)['"][^}\n]{0,260}\btype\s*:\s*['"]([^'"]+)['"][^}\n]{0,260}\}/g,
      kindIndex: 2,
      idIndex: 1
    },
    {
      source: 'target-config-reversed',
      regex: /\{[^}\n]{0,260}\btype\s*:\s*['"]([^'"]+)['"][^}\n]{0,260}\bkey\s*:\s*['"]([^'"]+)['"][^}\n]{0,260}\}/g,
      kindIndex: 1,
      idIndex: 2
    }
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.regex.exec(content))) {
      addMatch(
        matches,
        seen,
        file,
        content,
        match.index,
        match[pattern.kindIndex],
        match[pattern.idIndex],
        pattern.source,
        match[0]
      );
    }
  }

  const anchorRegex = /currentLabelAnchors\.push\(\s*\{([\s\S]{0,900}?)\}\s*\)/g;
  let anchorMatch;
  while ((anchorMatch = anchorRegex.exec(content))) {
    const objectText = anchorMatch[1];
    const kindMatch = /\btype\s*:\s*['"]([^'"]+)['"]/.exec(objectText) || /\bkind\s*:\s*['"]([^'"]+)['"]/.exec(objectText);
    const idMatch = /\bid\s*:\s*['"]([^'"]+)['"]/.exec(objectText);
    if (kindMatch && idMatch) {
      addMatch(matches, seen, file, content, anchorMatch.index, kindMatch[1], idMatch[1], 'anchor-push', anchorMatch[0]);
    }
  }

  return matches;
}

function increment(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function formatCounts(map) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, count]) => `  ${key}: ${count}`)
    .join('\n');
}

function groupExamples(entries, limit) {
  return entries.slice(0, limit).map((entry) => (
    `  - ${entry.file}:${entry.line} ${entry.rawKind}:${entry.rawId} -> ${entry.normalized.kind}` +
    ` (${entry.source}) ${entry.snippet ? '\n    ' + entry.snippet : ''}`
  )).join('\n');
}

const args = new Set(process.argv.slice(2));
const taxonomy = loadTaxonomy();
const files = [];
scanRoots.forEach((scanRoot) => walk(path.join(root, scanRoot), files));

const entries = files.flatMap((file) => extractTargets(file, fs.readFileSync(file, 'utf8')));
for (const entry of entries) {
  entry.normalized = taxonomy.normalizeLabelTarget(entry.rawKind, entry.rawId);
}

const invalid = entries.filter((entry) => !canonicalKinds.has(entry.normalized.kind));
const inferred = entries.filter((entry) => entry.normalized.inferred);
const suspicious = inferred.filter((entry) => (
  !knownRawKinds.has(entry.rawKind) ||
  (entry.normalized.kind === 'function' && !/function|curve|graph|plot|locus|axis|circle/i.test(entry.rawKind))
));

const rawKindCounts = new Map();
const normalizedCounts = new Map();
const mappingCounts = new Map();
const sourceCounts = new Map();

for (const entry of entries) {
  increment(rawKindCounts, entry.rawKind || '(empty)');
  increment(normalizedCounts, entry.normalized.kind);
  increment(mappingCounts, `${entry.rawKind || '(empty)'} -> ${entry.normalized.kind}`);
  increment(sourceCounts, entry.source);
}

if (args.has('--json')) {
  console.log(JSON.stringify({
    filesScanned: files.length,
    targetsFound: entries.length,
    invalidCount: invalid.length,
    inferredCount: inferred.length,
    suspiciousCount: suspicious.length,
    invalid,
    suspicious,
    mappings: Object.fromEntries(mappingCounts)
  }, null, 2));
} else {
  console.log('Label taxonomy audit');
  console.log(`Files scanned: ${files.length}`);
  console.log(`Label targets found: ${entries.length}`);
  console.log(`Invalid normalized kinds: ${invalid.length}`);
  console.log(`Inferred mappings: ${inferred.length}`);
  console.log(`Suspicious inferred mappings: ${suspicious.length}`);
  console.log('');
  console.log('Normalized kind counts');
  console.log(formatCounts(normalizedCounts) || '  (none)');
  console.log('');
  console.log('Raw kind -> normalized kind');
  console.log(formatCounts(mappingCounts) || '  (none)');
  console.log('');
  console.log('Source pattern counts');
  console.log(formatCounts(sourceCounts) || '  (none)');
  if (invalid.length) {
    console.log('');
    console.log('Invalid examples');
    console.log(groupExamples(invalid, 20));
  }
  if (suspicious.length) {
    console.log('');
    console.log('Suspicious inferred examples');
    console.log(groupExamples(suspicious, 30));
  }
}

if (invalid.length || (args.has('--strict') && suspicious.length)) {
  process.exit(1);
}
