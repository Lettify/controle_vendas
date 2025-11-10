import esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['api/trpc/[trpc].ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outdir: '.vercel/output/functions/api/trpc',
  outExtension: { '.js': '.func/index.js' },
  external: [
    'postgres',
    'drizzle-orm',
    '@trpc/server',
    'jsonwebtoken',
    'uuid',
    'zod'
  ],
  banner: {
    js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);'
  }
});

console.log('✓ API bundle created successfully');
