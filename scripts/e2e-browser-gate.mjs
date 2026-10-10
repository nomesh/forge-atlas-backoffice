#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const PORT = 3456;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function findBrowserExecutable() {
  const candidates = [
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status === 200) {
        return true;
      }
    } catch {
      // server not ready yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

async function runBrowserAcceptanceGate() {
  console.log('===============================================================');
  console.log('ATLAS BACKOFFICE — PRODUCTION-ARTIFACT BROWSER ACCEPTANCE GATE');
  console.log('===============================================================');

  const executablePath = findBrowserExecutable();
  if (!executablePath) {
    throw new Error('No compatible Chromium / Chrome / Edge browser executable found on host.');
  }
  console.log(`[BROWSER] Using Chromium executable: ${executablePath}`);

  // 1. Start production server
  console.log(`[SERVER] Starting production server on port ${PORT}...`);
  const serverProcess = spawn('node', ['node_modules/vinext/dist/cli.js', 'start', '-p', String(PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production' },
  });

  serverProcess.stdout.on('data', (d) => process.stdout.write(`[SERVER STDOUT] ${d}`));
  serverProcess.stderr.on('data', (d) => process.stderr.write(`[SERVER STDERR] ${d}`));

  let serverClosed = false;
  serverProcess.on('exit', (code) => {
    serverClosed = true;
    console.log(`[SERVER] Process exited with code ${code}`);
  });

  try {
    await waitForServer(BASE_URL);
    console.log(`[SERVER] Production server ready at ${BASE_URL}`);

    // 2. Launch browser
    const browser = await chromium.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });

    const page = await context.newPage();

    // Telemetry tracking
    const capturedPageErrors = [];
    const capturedConsoleErrors = [];
    const capturedForbiddenPatterns = [];
    const fontRequests = [];
    const failedNetworkRequests = [];

    page.on('pageerror', (err) => {
      const msg = err.stack || err.message || String(err);
      capturedPageErrors.push(msg);
      console.error(`[PAGEERROR] ${msg}`);
      if (
        msg.includes('[vinext] RSC prefetch setup error') ||
        msg.includes('f is not a function') ||
        msg.includes('e is not a function')
      ) {
        capturedForbiddenPatterns.push({ type: 'pageerror', text: msg });
      }
    });

    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error') {
        capturedConsoleErrors.push(text);
        console.error(`[CONSOLE ERROR] ${text}`);
      }
      if (
        text.includes('[vinext] RSC prefetch setup error') ||
        text.includes('f is not a function') ||
        text.includes('e is not a function')
      ) {
        capturedForbiddenPatterns.push({ type: 'console', text });
      }
    });

    page.on('request', (req) => {
      const url = req.url();
      // Check for build-path leaks in HTTP requests (strip scheme://host before checking for drive letters)
      const pathPart = url.replace(/^https?:\/\/[^/]+/i, '');
      const forbiddenSubstrings = ['/home/runner', 'backoffice-src', '.vinext/fonts'];
      const hasLocalDriveLeak = /[a-zA-Z]:[/\\]/.test(pathPart);
      if (forbiddenSubstrings.some((s) => url.includes(s)) || hasLocalDriveLeak) {
        capturedForbiddenPatterns.push({ type: 'request-path-leak', text: url });
        console.error(`[PATH LEAK IN REQUEST] ${url}`);
      }

      if (url.includes('_vinext_fonts') || url.endsWith('.woff2') || url.endsWith('.woff')) {
        fontRequests.push({ url, method: req.method() });
      }
    });

    page.on('requestfailed', (req) => {
      const url = req.url();
      const failure = req.failure()?.errorText || 'unknown failure';
      failedNetworkRequests.push({ url, failure });
      console.error(`[REQUEST FAILED] ${url}: ${failure}`);
    });

    // Inject mock token for isolated frontend testing
    await page.addInitScript(() => {
      window.__ATLAS_MOCK_TOKEN__ = 'mock-staff-jwt-token';
    });

    // Mock backend REST API calls gracefully
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('students') && !url.match(/students\/[^?]+/)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [], totalPages: 0, totalElements: 0 }),
        });
      }
    });

    // 3. User Journey Execution
    console.log('\n--- Step 1: Initial Page Load (/) ---');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    console.log(`Loaded URL: ${page.url()}`);
    await page.waitForSelector('nav[aria-label="Primary"]', { timeout: 5000 });
    console.log('✓ Primary sidebar navigation rendered.');

    const routesToTest = [
      { name: 'Customers', href: '/customers', linkText: 'Customers' },
      { name: 'Provisioning', href: '/provisioning', linkText: 'Provisioning' },
      { name: 'Learn Students', href: '/learn/students', linkText: 'Learn Students' },
      { name: 'Payments', href: '/learn/payments', linkText: 'Payment Slips' },
      { name: 'Curriculum', href: '/curriculum', linkText: 'Curriculum Base' },
      { name: 'Audit', href: '/audit', linkText: 'Audit Log' },
    ];

    console.log('\n--- Step 2: Client-side Navigation via Sidebar Clicks ---');
    for (const route of routesToTest) {
      console.log(`Clicking "${route.linkText}" -> expecting URL ${route.href}`);
      const linkLocator = page.locator(`nav[aria-label="Primary"] a[href="${route.href}"]`);
      await linkLocator.waitFor({ state: 'visible', timeout: 5000 });
      await linkLocator.click();

      // Wait for URL to update in browser
      await page.waitForURL(`**${route.href}`, { timeout: 5000 });
      console.log(`✓ Navigated to: ${page.url()}`);

      // Small delay to allow any client-side transitions / effects to complete
      await page.waitForTimeout(300);
    }

    console.log('\n--- Step 3: Browser Back and Forward Navigation ---');
    console.log('Testing browser Back to /curriculum...');
    await page.goBack();
    await page.waitForURL(`**${routesToTest[4].href}`, { timeout: 5000 });
    console.log(`✓ Back navigated to: ${page.url()}`);

    console.log('Testing browser Back to /learn/payments...');
    await page.goBack();
    await page.waitForURL(`**${routesToTest[3].href}`, { timeout: 5000 });
    console.log(`✓ Back navigated to: ${page.url()}`);

    console.log('Testing browser Forward to /curriculum...');
    await page.goForward();
    await page.waitForURL(`**${routesToTest[4].href}`, { timeout: 5000 });
    console.log(`✓ Forward navigated to: ${page.url()}`);

    console.log('Testing browser Forward to /audit...');
    await page.goForward();
    await page.waitForURL(`**${routesToTest[5].href}`, { timeout: 5000 });
    console.log(`✓ Forward navigated to: ${page.url()}`);

    console.log('\n--- Step 4: Direct URL Load and Refresh for Each Route ---');
    const allRoutes = ['/', ...routesToTest.map((r) => r.href)];
    for (const route of allRoutes) {
      console.log(`Direct load: ${BASE_URL}${route}`);
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('nav[aria-label="Primary"]', { timeout: 5000 });

      console.log(`Reloading: ${BASE_URL}${route}`);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForSelector('nav[aria-label="Primary"]', { timeout: 5000 });
      console.log(`✓ Direct load and reload succeeded for ${route}`);
    }

    console.log('\n--- Step 5: Interactive Control Verification ---');
    console.log('Navigating to /customers to test search input...');
    await page.goto(`${BASE_URL}/customers`, { waitUntil: 'networkidle' });
    const searchInput = page.locator('input[placeholder*="Search"]');
    if ((await searchInput.count()) > 0) {
      await searchInput.fill('Acme Corp Filter Test');
      await page.waitForTimeout(400);
      const val = await searchInput.inputValue();
      console.log(`✓ Search input interactivity verified: "${val}"`);
    } else {
      console.log('ℹ No search input on /customers; testing overview search input on /');
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
      const overviewInput = page.locator('input').first();
      await overviewInput.fill('Interactivity Test');
      await page.waitForTimeout(400);
      console.log('✓ Input interactivity verified.');
    }

    await browser.close();

    // 4. Verification and Release Gate Criteria
    console.log('\n===============================================================');
    console.log('GATE VERIFICATION SUMMARY');
    console.log('===============================================================');

    console.log(`Total captured page errors: ${capturedPageErrors.length}`);
    console.log(`Total captured console errors: ${capturedConsoleErrors.length}`);
    console.log(`Total font requests captured: ${fontRequests.length}`);
    console.log(`Total failed network requests: ${failedNetworkRequests.length}`);

    let gatePassed = true;

    // Check 1: Zero forbidden Vinext / RSC navigation exceptions
    if (capturedForbiddenPatterns.length > 0) {
      console.error('\n❌ FAILED GATE: Forbidden navigation runtime error detected:');
      for (const err of capturedForbiddenPatterns) {
        console.error(`  - [${err.type}] ${err.text}`);
      }
      gatePassed = false;
    } else {
      console.log('✓ PASS: Zero occurrences of [vinext] RSC prefetch setup error, TypeError: f is not a function, or TypeError: e is not a function.');
    }

    // Check 2: Font URLs integrity
    let fontErrors = 0;
    for (const font of fontRequests) {
      const parsed = new URL(font.url);
      if (!parsed.pathname.startsWith('/_next/static/_vinext_fonts/')) {
        console.error(`❌ Non-standard font URL requested: ${font.url}`);
        fontErrors++;
      }
    }
    if (fontErrors > 0) {
      console.error(`\n❌ FAILED GATE: ${fontErrors} font requests were not routed to /_next/static/_vinext_fonts/`);
      gatePassed = false;
    } else if (fontRequests.length === 0) {
      console.warn('⚠ WARNING: No font requests were captured (check if fonts were cached or bundled inline).');
    } else {
      console.log(`✓ PASS: All font requests (${fontRequests.length}) strictly routed to /_next/static/_vinext_fonts/...`);
    }

    // Check 3: Zero failed font network requests
    const failedFonts = failedNetworkRequests.filter((r) => r.url.includes('font') || r.url.endsWith('.woff2'));
    if (failedFonts.length > 0) {
      console.error('\n❌ FAILED GATE: Failed font requests detected:');
      for (const f of failedFonts) {
        console.error(`  - ${f.url}: ${f.failure}`);
      }
      gatePassed = false;
    } else {
      console.log('✓ PASS: Zero failed font network requests.');
    }

    if (!gatePassed) {
      console.error('\n❌ RELEASE GATE FAILED: One or more gate criteria were not met.');
      process.exit(1);
    }

    console.log('\n===============================================================');
    console.log('✓ ALL PRODUCTION-ARTIFACT BROWSER ACCEPTANCE GATES PASSED!');
    console.log('===============================================================');
    process.exit(0);
  } finally {
    if (!serverClosed) {
      console.log('[SERVER] Terminating production server process...');
      serverProcess.kill('SIGKILL');
    }
  }
}

runBrowserAcceptanceGate().catch((err) => {
  console.error('\n[FATAL ERROR IN ACCEPTANCE GATE]:', err);
  process.exit(1);
});
