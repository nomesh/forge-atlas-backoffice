#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(process.cwd(), 'dist/client');

if (!fs.existsSync(distDir)) {
  console.error(`[GUARD ERROR] Directory not found: ${distDir}. Run build first.`);
  process.exit(1);
}

const FORBIDDEN_PATTERNS = [
  /localhost:8081/i,
  /127\.0\.0\.1:8081/i,
  /localhost:8080/i,
  /127\.0\.0\.1:8080/i,
  /localhost:3000/i,
  /127\.0\.0\.1:3000/i,
];

function scanDirectory(dir, fileList = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDirectory(fullPath, fileList);
    } else if (/\.(js|mjs|html|json)$/i.test(entry.name)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const files = scanDirectory(distDir);
let hasError = false;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  for (const pattern of FORBIDDEN_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      const idx = match.index;
      const snippet = content.substring(Math.max(0, idx - 50), Math.min(content.length, idx + 80));
      console.error(`[GUARD FAILED] Localhost leak detected in ${path.relative(process.cwd(), file)}:`);
      console.error(`  Pattern: ${pattern}`);
      console.error(`  Context: "...${snippet}..."\n`);
      hasError = true;
    }
  }
}

if (hasError) {
  console.error('[GUARD ERROR] Build artifact validation failed: localhost URLs must not leak into production bundle.');
  process.exit(1);
}

console.log(`[GUARD PASSED] Scanned ${files.length} client bundle files: No localhost/dev URLs found.`);
