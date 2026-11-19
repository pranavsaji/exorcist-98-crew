// Bundles the dashboard page and the backend into single files with no
// runtime imports, so Crew can serve them without node_modules.
import { build } from 'esbuild';

// The host supplies these through its import map (Crew docs, SDK reference);
// they must never be bundled into the page.
const hostProvided = ['react', 'react-dom', 'react/jsx-runtime', 'lucide-react', '@kirocrew/app-sdk', '@kirocrew/app-sdk/*'];
const common = { bundle: true, format: 'esm', target: 'es2022', legalComments: 'none', logLevel: 'info' };

await build({
  ...common,
  entryPoints: ['ui/src/index.ts'],
  outfile: 'ui/dist/index.mjs',
  platform: 'browser',
  external: hostProvided,
  minify: true,
});

// What Crew loads: a React default export (see ui/src/crew.ts). Only `react`
// is imported, from the host's import map.
await build({
  ...common,
  entryPoints: ['ui/src/crew.ts'],
  outfile: 'ui/dist/crew.mjs',
  platform: 'browser',
  external: hostProvided,
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
