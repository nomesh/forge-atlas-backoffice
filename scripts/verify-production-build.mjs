#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const distClientDir = path.resolve(projectRoot, 'dist/client');
const distServerDir = path.resolve(projectRoot, 'dist/server');

console.log('[VERIFY BUILD] Running Backoffice Production Build & Runtime Integrity Guard...');

if (!fs.existsSync(distClientDir) || !fs.existsSync(distServerDir)) {
  console.error('[GUARD FAILED] dist/client or dist/server directory not found. Run build first.');
  process.exit(1);
}

// Patterns that must never appear in client bundles
const FORBIDDEN_CLIENT_PATTERNS = [
  { pattern: /localhost:(3000|8080|8081)/i, name: 'Client localhost port leak' },
  { pattern: /127\.0\.0\.1:(3000|8080|8081)/i, name: 'Client 127.0.0.1 port leak' },
];

// Patterns that must never appear in ANY bundle (client or server)
const FORBIDDEN_GLOBAL_PATTERNS = [
  { pattern: /\/home\/runner\/work/i, name: 'GitHub Actions runner path leak' },
  { pattern: /backoffice-src\/\.vinext/i, name: 'Build context .vinext path leak' },
  { pattern: /[a-zA-Z]:[/\\][^\s"']*?\.vinext[/\\]fonts/i, name: 'Local machine absolute font path leak' },
];

function scanDirectory(dir, fileList = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDirectory(fullPath, fileList);
    } else if (/\.(js|mjs|html|json|css)$/i.test(entry.name)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const clientFiles = scanDirectory(distClientDir);
const serverFiles = scanDirectory(distServerDir);
const allFiles = [...clientFiles, ...serverFiles];
let leakErrors = 0;

for (const file of clientFiles) {
  const content = fs.readFileSync(file, 'utf8');
  for (const { pattern, name } of FORBIDDEN_CLIENT_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      const idx = match.index;
      const snippet = content.substring(Math.max(0, idx - 40), Math.min(content.length, idx + 80));
      console.error(`[GUARD FAILED] ${name} detected in ${path.relative(projectRoot, file)}:`);
      console.error(`  Context: "...${snippet}..."\n`);
      leakErrors++;
    }
  }
}

for (const file of allFiles) {
  const content = fs.readFileSync(file, 'utf8');
  for (const { pattern, name } of FORBIDDEN_GLOBAL_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      const idx = match.index;
      const snippet = content.substring(Math.max(0, idx - 40), Math.min(content.length, idx + 80));
      console.error(`[GUARD FAILED] ${name} detected in ${path.relative(projectRoot, file)}:`);
      console.error(`  Context: "...${snippet}..."\n`);
      leakErrors++;
    }
  }
}

if (leakErrors > 0) {
  console.error(`[GUARD FAILED] Found ${leakErrors} forbidden path/host leaks in build output.`);
  process.exit(1);
}
console.log('✓ [1/3] No localhost or build-machine path leaks detected.');

// 2. Check font assets integrity
const fontsDir = path.join(distClientDir, '_next/static/_vinext_fonts');
if (!fs.existsSync(fontsDir)) {
  console.error('[GUARD FAILED] _next/static/_vinext_fonts directory does not exist.');
  process.exit(1);
}
const fontSubdirs = fs.readdirSync(fontsDir);
if (fontSubdirs.length === 0) {
  console.error('[GUARD FAILED] No font family directories found in _vinext_fonts.');
  process.exit(1);
}
console.log(`✓ [2/3] Font assets verified (${fontSubdirs.length} font families hosted under /_next/static/_vinext_fonts).`);

// 3. Check client bundle navigation linking integrity
const chunksDir = path.join(distClientDir, '_next/static/chunks');
const chunkFiles = fs.readdirSync(chunksDir).filter(f => f.endsWith('.js'));
let linkFound = false;
let linkBroken = false;

for (const chunk of chunkFiles) {
  const content = fs.readFileSync(path.join(chunksDir, chunk), 'utf8');
  if (content.includes('RSC prefetch setup error:')) {
    linkFound = true;
    // Verify that rr() returns Promise.resolve and does not do dynamic import of entry
    if (content.match(/function\s+rr\(\)\s*\{return\s+nr\?\?=_/)) {
      console.error(`[GUARD FAILED] Broken dynamic navigation module import detected in ${chunk}!`);
      linkBroken = true;
    }
    // Verify that navigateClientSide is present
    if (!content.includes('navigateClientSide')) {
      console.error(`[GUARD FAILED] navigateClientSide not referenced in ${chunk}!`);
      linkBroken = true;
    }
  }
}

if (!linkFound) {
  console.error('[GUARD FAILED] Link prefetch implementation not found in any client chunk.');
  process.exit(1);
}
if (linkBroken) {
  console.error('[GUARD FAILED] Link client runtime bundling defect detected.');
  process.exit(1);
}

console.log('✓ [3/3] Client navigation runtime bindings verified. Statically linked and intact.');
console.log('[VERIFY BUILD PASSED] Production build integrity verified.');
