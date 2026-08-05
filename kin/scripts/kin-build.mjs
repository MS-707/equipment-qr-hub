#!/usr/bin/env node
// Build the Kin deploy payload into kin/dist (KIN-4).
//
// Pipeline:
//   1. wipe kin/dist
//   2. `vite build` with kin/vite.config.ts — root kin/src, outDir kin/dist.
//      Emits kin/dist/index.html plus content-hashed JS/CSS under
//      kin/dist/assets/. The hashed filenames are load-bearing: the Worker
//      serves /assets/* with `public, max-age=31536000, immutable`
//      (kin/worker/index.js serveAsset), so a non-hashed name there would
//      pin a stale bundle for a year.
//   3. stage kin/public over the result WITHOUT overwriting, for static
//      passthrough files that are not part of the Vite graph. Build output
//      always wins — nothing staged here can clobber the hashed index.html.
//
// kin/scripts/kin-assets.mjs runs next (npm run kin:build chains them) and
// hashes everything in kin/dist into kin/dist/asset-manifest.json.
//
// The Worker bundle is NOT built here. kin/worker/index.js is authored as a
// self-contained ES module with zero imports (KIN-4 requires exactly that), so
// there is nothing to bundle and no Worker bundler in the dependency tree.
// Vite is used for the SPA only.

import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIN = path.resolve(HERE, '..');
const REPO = path.resolve(KIN, '..');
const DIST = path.join(KIN, 'dist');
const PUBLIC = path.join(KIN, 'public');
const VITE_BIN = path.join(REPO, 'node_modules', 'vite', 'bin', 'vite.js');
const VITE_CONFIG = path.join(KIN, 'vite.config.ts');

await rm(DIST, { recursive: true, force: true });

if (!existsSync(VITE_BIN)) {
  console.error(`kin-build: ${path.relative(REPO, VITE_BIN)} is missing — run \`npm ci\`.`);
  process.exit(1);
}

const vite = spawnSync(process.execPath, [VITE_BIN, 'build', '--config', VITE_CONFIG], {
  cwd: REPO,
  stdio: 'inherit',
});
if (vite.error) {
  console.error(`kin-build: could not start vite — ${vite.error.message}`);
  process.exit(1);
}
if (vite.status !== 0) {
  console.error(`kin-build: vite build failed (exit ${vite.status})`);
  process.exit(vite.status ?? 1);
}

await mkdir(DIST, { recursive: true });

if (existsSync(PUBLIC)) {
  // force:false — an existing file (anything Vite emitted) is left alone.
  await cp(PUBLIC, DIST, { recursive: true, force: false, errorOnExist: false });
  console.log('kin-build: staged kin/public -> kin/dist (build output wins on conflict)');
}

// Fail loudly rather than handing kin-assets.mjs an empty directory: an
// index.html-less dist deploys a 404 for every route.
const missing = ['index.html'].filter((f) => !existsSync(path.join(DIST, f)));
if (missing.length) {
  console.error(`kin-build: expected kin/dist/${missing.join(', kin/dist/')} after the build — aborting.`);
  process.exit(1);
}

console.log('kin-build: done (run `node kin/scripts/kin-assets.mjs` next, or use `npm run kin:build`)');
