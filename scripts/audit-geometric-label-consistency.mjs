#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();

function rgFiles(pattern) {
  const result = spawnSync('rg', ['--files'], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) return [];
  return result.stdout
    .split('\n')
    .filter(Boolean)
    .filter((file) => pattern.test(file));
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

function snippetAroundFunction(source, functionName) {
  const marker = `function ${functionName}`;
  const start = source.indexOf(marker);
  if (start < 0) return '';
  let depth = 0;
  let seenBrace = false;
  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    if (char === '{') {
      seenBrace = true;
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (seenBrace && depth === 0) return source.slice(start, i + 1);
    }
  }
  return source.slice(start);
}

const files = rgFiles(/^(assets\/.*\.js|draw\/.*\/index\.html)$/);
const findings = [];

for (const file of files) {
  const abs = join(root, file);
  const source = readFileSync(abs, 'utf8');
  const areaFn = snippetAroundFunction(source, 'areaRegions');
  if (areaFn) {
    const hasAreaValues = /value\s*:/.test(areaFn);
    const derivesInsideAreaFunction = /polygonArea|areaValue|areaOfTriangle|triangleArea|areaValue\(/.test(areaFn);
    const usesExternalValues = /value\s*:\s*values\.|value\s*:[^,\n]*(values|Math\.sqrt|\*|\/)/.test(areaFn);
    const rawPolygonAreaAssignments = /areas\s*:\s*\{[\s\S]{0,900}polygonArea/.test(source);
    const emptyAreaAssignments = /areas\s*:\s*\{\s*\}/.test(source);
    const screenPointsAreModelPoints = /currentGeometry\s*=\s*\{\s*points\s*:\s*points,\s*values/.test(source);
    const equilateralModel = /equilateralHeight|Math\.sqrt\(3\)\s*\/\s*2/.test(source);
    const exactEquilateralArea = /Math\.sqrt\(3\)\s*\/\s*4|√3\/4/.test(source) && equilateralModel;
    if (hasAreaValues && usesExternalValues && !derivesInsideAreaFunction && !rawPolygonAreaAssignments && !emptyAreaAssignments && !exactEquilateralArea) {
      findings.push({
        severity: screenPointsAreModelPoints && !equilateralModel ? 'high' : 'review',
        file,
        line: lineNumber(source, source.indexOf('function areaRegions')),
        reason: 'area label value is not derived from the polygon points in areaRegions()'
      });
    }
  }

  const segmentFn = snippetAroundFunction(source, 'getSegmentNumericText');
  if (segmentFn && /return\s+formatNumber\([^)]*values\./.test(segmentFn)) {
    const modelConstructedFromInputs = /function constructGeometry|function constructPoints|function computeGeometry|fitPoints\(/.test(source);
    const currentScreenPointsOnly = /currentGeometry\s*=\s*\{\s*points\s*:\s*points,\s*values/.test(source);
    const hasModelCorrection = /equilateralHeight|unitPoints|rawPoints|raw\s*=/.test(source);
    if ((!modelConstructedFromInputs && !hasModelCorrection) || (currentScreenPointsOnly && !hasModelCorrection)) {
      findings.push({
        severity: 'high',
        file,
        line: lineNumber(source, source.indexOf('function getSegmentNumericText')),
        reason: 'segment numeric labels use input values while visible points may be independent screen coordinates'
      });
    }
  }

  const exactAreaIndex = source.search(/√3\/4|Math\.sqrt\(3\)\s*\/\s*4/);
  if (exactAreaIndex >= 0) {
    const hasEquilateralCoordinates = /equilateralHeight|Math\.sqrt\(3\)\s*\/\s*2|Math\.sin\(Math\.PI\s*\/\s*3\)|60/.test(source);
    if (!hasEquilateralCoordinates) {
      findings.push({
        severity: 'review',
        file,
        line: lineNumber(source, exactAreaIndex),
        reason: 'exact √3/4 area appears without an obvious equilateral coordinate construction'
      });
    }
  }
}

const order = { high: 0, review: 1 };
findings.sort((a, b) => (order[a.severity] - order[b.severity]) || a.file.localeCompare(b.file) || a.line - b.line);

console.log('Geometric label consistency audit');
console.log(`Files scanned: ${files.length}`);
console.log(`Findings: ${findings.length}`);
for (const finding of findings) {
  console.log(`- [${finding.severity}] ${relative(root, join(root, finding.file))}:${finding.line} ${finding.reason}`);
}

if (findings.some((finding) => finding.severity === 'high')) {
  process.exitCode = 1;
}
