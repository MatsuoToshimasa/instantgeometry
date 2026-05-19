import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const targetRoots = ['draw', 'function'];
const requiredDrawSettings = [
  { key: 'distanceUnit', label: '距離単位' },
  { key: 'angleUnit', label: '角度単位' },
  { key: 'piMode', label: '円周率' },
  { key: 'decimalPlaces', label: '小数設定' }
];

function walk(dir) {
  const entries = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const full = path.join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) entries.push(...walk(full));
    else if (name === 'index.html') entries.push(full);
  }
  return entries;
}

function rel(file) {
  return path.relative(root, file);
}

function hasDrawSurface(html) {
  return /<svg[^>]+id=["']stage["']|class=["'][^"']*\bstage\b|id=["']editSheet["']|id=["']settingsBtn["']/.test(html);
}

const pages = targetRoots.flatMap((dir) => walk(path.join(root, dir)));
const rows = pages.map((file) => {
  const html = readFileSync(file, 'utf8');
  const isDraw = rel(file).startsWith('draw/');
  const isFunction = rel(file).startsWith('function/');
  const directDrawSettings = /assets\/draw-settings\.js|\/assets\/draw-settings\.js/.test(html);
  const siteAutoI18n = /site-auto-i18n\.js/.test(html);
  const functionViewSettings = /function-view-settings\.js/.test(html);
  return {
    file: rel(file),
    isDraw,
    isFunction,
    hasDrawSurface: hasDrawSurface(html),
    directDrawSettings,
    siteAutoI18n,
    functionViewSettings,
    drawSettingsAvailable: isDraw && (directDrawSettings || siteAutoI18n),
    functionSettingsAvailable: isFunction && functionViewSettings
  };
});

const drawPages = rows.filter((row) => row.isDraw);
const functionPages = rows.filter((row) => row.isFunction);
const drawSurfacePages = drawPages.filter((row) => row.hasDrawSurface);
const drawMissingSettings = drawSurfacePages.filter((row) => !row.drawSettingsAvailable);
const functionMissingSettings = functionPages.filter((row) => row.hasDrawSurface && !row.functionSettingsAvailable);
const directDrawSettings = drawPages.filter((row) => row.directDrawSettings);
const viaSiteAutoI18n = drawPages.filter((row) => row.siteAutoI18n);
const drawSettingsHtml = readFileSync(path.join(root, 'assets/draw-settings.js'), 'utf8');
const missingDrawSettingFields = requiredDrawSettings.filter((field) => !drawSettingsHtml.includes(`data-setting="${field.key}"`));
const missingDrawSettingState = requiredDrawSettings.filter((field) => !drawSettingsHtml.includes(field.key));
const missingDrawSettingLabels = requiredDrawSettings.filter((field) => !drawSettingsHtml.includes(field.label));

console.log('Draw/function settings coverage audit');
console.log(`Pages scanned: ${rows.length}`);
console.log('');
console.log('Draw pages');
console.log(`  total: ${drawPages.length}`);
console.log(`  draw-like surface: ${drawSurfacePages.length}`);
console.log(`  direct draw-settings.js: ${directDrawSettings.length}`);
console.log(`  via site-auto-i18n.js: ${viaSiteAutoI18n.length}`);
console.log(`  missing draw settings loader: ${drawMissingSettings.length}`);
console.log(`  required settings fields: ${requiredDrawSettings.length - missingDrawSettingFields.length}/${requiredDrawSettings.length}`);
console.log(`  required settings state keys: ${requiredDrawSettings.length - missingDrawSettingState.length}/${requiredDrawSettings.length}`);
console.log(`  required settings labels: ${requiredDrawSettings.length - missingDrawSettingLabels.length}/${requiredDrawSettings.length}`);
console.log('');
console.log('Function pages');
console.log(`  total: ${functionPages.length}`);
console.log(`  missing function-view-settings.js: ${functionMissingSettings.length}`);

if (drawMissingSettings.length) {
  console.log('');
  console.log('Draw pages missing draw settings loader');
  drawMissingSettings.forEach((row) => console.log(`  - ${row.file}`));
}

if (missingDrawSettingFields.length || missingDrawSettingState.length || missingDrawSettingLabels.length) {
  console.log('');
  console.log('Draw settings modal contract findings');
  missingDrawSettingFields.forEach((field) => console.log(`  - missing field: ${field.key} (${field.label})`));
  missingDrawSettingState.forEach((field) => console.log(`  - missing state key: ${field.key} (${field.label})`));
  missingDrawSettingLabels.forEach((field) => console.log(`  - missing label: ${field.key} (${field.label})`));
}

if (functionMissingSettings.length) {
  console.log('');
  console.log('Function pages missing function settings loader');
  functionMissingSettings.forEach((row) => console.log(`  - ${row.file}`));
}
