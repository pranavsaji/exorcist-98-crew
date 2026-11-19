// Bundles the dashboard page and the backend into single files with no
// runtime imports, so Crew can serve them without node_modules.
import { build } from 'esbuild';

const common = { bundle: true, format: 'esm', target: 'es2022', legalComments: 'none', logLevel: 'info' };

await build({
  ...common,
  entryPoints: ['ui/src/index.ts'],
  outfile: 'ui/dist/index.mjs',
  platform: 'browser',
  minify: true,
});

await build({
  ...common,
  entryPoints: ['backend/src/main.ts'],
  outfile: 'backend/dist/server.mjs',
  platform: 'node',
  target: 'node20',
  banner: { js: '// Built from backend/src by scripts/build.mjs. Do not edit.' },
});
