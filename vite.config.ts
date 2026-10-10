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
  return {
    name: 'fix-vinext-link-navigation',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      const normalized = id.replace(/\\/g, '/');
      if (normalized.includes('vinext/dist/shims/link.js') || normalized.endsWith('/shims/link.js')) {
        const targetFunction = `function loadNavigationModule() {\n\treturn navigationModulePromise ??= import("./navigation.js").then((module) => {\n\t\tloadedNavigationModule = module;\n\t\treturn module;\n\t});\n}`;
        let transformed = code.replace('"use client";', '"use client";\nimport * as _vinextNavigation from "./navigation.js";');
        transformed = transformed.replace(
          'let loadedNavigationModule = null;',
          'let loadedNavigationModule = _vinextNavigation;'
        );
        transformed = transformed.replace(
          targetFunction,
          'function loadNavigationModule() {\n\treturn Promise.resolve(_vinextNavigation);\n}'
        );
        return transformed;
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
