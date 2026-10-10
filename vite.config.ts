import { sites } from '@openai/sites-vite-plugin';
import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';
import hostingConfig from './.openai/hosting.json';

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  '00000000-0000-4000-8000-000000000000';

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === 'seatbelt';

const localBindingConfig = {
  main: 'vinext/server/fetch-handler',
  compatibility_flags: ['nodejs_compat'],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: 'site-creator-d1',
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: 'site-creator-r2',
        },
      ]
    : [],
};

function fixVinextLinkNavigationPlugin() {
  let transformedCount = 0;
  return {
    name: 'fix-vinext-link-navigation',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      const normalized = id.replace(/\\/g, '/');
      if (normalized.includes('vinext/dist/shims/link.js') || normalized.endsWith('/shims/link.js')) {
        const normalizedCode = code.replace(/\r\n/g, '\n');
        const targetDirective = '"use client";';
        const targetVariable = 'let loadedNavigationModule = null;';
        const targetFunction = `function loadNavigationModule() {\n\treturn navigationModulePromise ??= import("./navigation.js").then((module) => {\n\t\tloadedNavigationModule = module;\n\t\treturn module;\n\t});\n}`;
        const targetPromiseAll = `\t\t\t\tconst [navigation, { AppElementsWire }, rscCacheBusting, { APP_RSC_RENDER_MODE_PREFETCH_DYNAMIC_SHELL, APP_RSC_RENDER_MODE_PREFETCH_LOADING_SHELL }, headersModule, hybridRouteOwner] = await Promise.all([\n\t\t\t\t\tloadNavigationModule(),\n\t\t\t\t\timport("../server/app-elements.js"),\n\t\t\t\t\timport("../server/app-rsc-cache-busting.js"),\n\t\t\t\t\timport("../server/app-rsc-render-mode.js"),\n\t\t\t\t\timport("../server/headers.js"),\n\t\t\t\t\tHAS_PAGES_ROUTER || HAS_CLIENT_REWRITES ? loadHybridClientRouteOwnerModule() : null\n\t\t\t\t]);`;
        const targetPromotePromise = 'const [{ getPrefetchCache }, { stripRscCacheBustingSearchParam, stripRscSuffix }] = await Promise.all([loadNavigationModule(), import("../server/app-rsc-cache-busting.js")]);';

        if (!normalizedCode.includes(targetDirective)) {
          throw new Error(
            '[fix-vinext-link-navigation] FAIL-CLOSED: Missing expected "use client"; directive in vinext/dist/shims/link.js'
          );
        }
        if (!normalizedCode.includes(targetVariable)) {
          throw new Error(
            '[fix-vinext-link-navigation] FAIL-CLOSED: Missing expected "let loadedNavigationModule = null;" in vinext/dist/shims/link.js'
          );
        }
        if (!normalizedCode.includes(targetFunction)) {
          throw new Error(
            '[fix-vinext-link-navigation] FAIL-CLOSED: Missing expected loadNavigationModule implementation in vinext/dist/shims/link.js. Upstream Vinext source layout has changed!'
          );
        }
        if (!normalizedCode.includes(targetPromiseAll)) {
          throw new Error(
            '[fix-vinext-link-navigation] FAIL-CLOSED: Missing expected prefetch Promise.all implementation in vinext/dist/shims/link.js. Upstream Vinext source layout has changed!'
          );
        }
        if (!normalizedCode.includes(targetPromotePromise)) {
          throw new Error(
            '[fix-vinext-link-navigation] FAIL-CLOSED: Missing expected promotePrefetchEntriesForNavigation dynamic import in vinext/dist/shims/link.js. Upstream Vinext source layout has changed!'
          );
        }

        const staticImports = [
          'import * as _vinextNavigation from "./navigation.js";',
          'import * as _vinextAppElements from "../server/app-elements.js";',
          'import * as _vinextRscCacheBusting from "../server/app-rsc-cache-busting.js";',
          'import * as _vinextAppRscRenderMode from "../server/app-rsc-render-mode.js";',
          'import * as _vinextHeaders from "../server/headers.js";',
        ].join('\n');

        const replacementPromiseAll = `\t\t\t\tconst navigation = _vinextNavigation;\n\t\t\t\tconst { AppElementsWire } = _vinextAppElements;\n\t\t\t\tconst rscCacheBusting = _vinextRscCacheBusting;\n\t\t\t\tconst { APP_RSC_RENDER_MODE_PREFETCH_DYNAMIC_SHELL, APP_RSC_RENDER_MODE_PREFETCH_LOADING_SHELL } = _vinextAppRscRenderMode;\n\t\t\t\tconst headersModule = _vinextHeaders;\n\t\t\t\tconst hybridRouteOwner = HAS_PAGES_ROUTER || HAS_CLIENT_REWRITES ? await loadHybridClientRouteOwnerModule() : null;`;
        const replacementPromotePromise = 'const { getPrefetchCache } = _vinextNavigation;\n\tconst { stripRscCacheBustingSearchParam, stripRscSuffix } = _vinextRscCacheBusting;';

        let transformed = normalizedCode.replace(
          targetDirective,
          `${targetDirective}\n${staticImports}`
        );
        transformed = transformed.replace(
          targetVariable,
          'let loadedNavigationModule = _vinextNavigation;'
        );
        transformed = transformed.replace(
          targetFunction,
          'function loadNavigationModule() {\n\treturn Promise.resolve(_vinextNavigation);\n}'
        );
        transformed = transformed.replace(
          targetPromiseAll,
          replacementPromiseAll
        );
        transformed = transformed.replace(
          targetPromotePromise,
          replacementPromotePromise
        );
        transformedCount++;
        return transformed;
      }
    },
    buildEnd() {
      // In production build, fail closed if the expected Vinext shim was never encountered and transformed during client build
      if (process.env.NODE_ENV === 'production' && (this as any).environment?.name === 'client' && transformedCount === 0) {
        throw new Error(
          '[fix-vinext-link-navigation] FAIL-CLOSED: vinext/dist/shims/link.js was never encountered during client build. Upstream Vinext module path may have changed!'
        );
      }
    },
  };
}

export default defineConfig(async ({ mode }) => {
  const isTest = mode === 'test' || process.env.VITEST === 'true';
  if (isTest) {
    const path = await import('node:path');
    const projectRoot = process.cwd();
    return {
      resolve: {
        alias: {
          '@': projectRoot,
          'next/link': path.resolve(projectRoot, 'node_modules/vinext/dist/shims/link.js'),
          'next/navigation': path.resolve(projectRoot, 'node_modules/vinext/dist/shims/navigation.js'),
          'next/font/google': path.resolve(projectRoot, 'node_modules/vinext/dist/shims/font-google.js'),
        },
      },
      css: { postcss: { plugins: [tailwindcss()] } },
      test: {
        environment: 'jsdom',
        setupFiles: ['./vitest.setup.ts'],
        include: ['**/*.test.{ts,tsx}'],
        css: false,
      },
    };
  }
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import('@cloudflare/vite-plugin');

  return {
    css: { postcss: { plugins: [tailwindcss()] } },
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      fixVinextLinkNavigationPlugin(),
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        config: localBindingConfig,
      }),
    ],
    test: {
      environment: 'jsdom',
      setupFiles: ['./vitest.setup.ts'],
      include: ['**/*.test.{ts,tsx}'],
      css: false,
    },
  };
});
