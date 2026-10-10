#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

// Ensure .vinext/fonts/ cache never contains stale foreign absolute filesystem paths.
// If style.css references a foreign path (e.g. /home/runner/work/...), rewrite it to match current root.
const fontCacheDir = path.resolve(process.cwd(), '.vinext', 'fonts');

if (fs.existsSync(fontCacheDir)) {
  const currentRoot = process.cwd().replace(/\\/g, '/');
  for (const familyDir of fs.readdirSync(fontCacheDir)) {
    const styleCssPath = path.join(fontCacheDir, familyDir, 'style.css');
    if (fs.existsSync(styleCssPath)) {
      let content = fs.readFileSync(styleCssPath, 'utf8');
      // Replace any foreign path prefix before /.vinext/fonts/...
      const foreignPathRegex = /url\([^)]*?(\/\.vinext\/fonts\/[^)]+)\)/g;
      if (foreignPathRegex.test(content)) {
        content = content.replace(foreignPathRegex, `url(${currentRoot}$1)`);
        fs.writeFileSync(styleCssPath, content);
        console.log(`[CLEAN-FONTS] Normalized font cache paths in ${familyDir}/style.css to active build root.`);
      }
    }
  }
}
