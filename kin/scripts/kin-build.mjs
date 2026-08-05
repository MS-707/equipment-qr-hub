#!/usr/bin/env node
// Build the Kin deploy payload into kin/dist (KIN-4).
//
// Today this stages kin/public/* (the scaffold shell) and regenerates the asset
// manifest. When the SPA lands (KIN-M2), the Vite build writes its own
// content-hashed output into kin/dist/assets/ ahead of the staging step and this
// script grows a `vite build` invocation — the manifest step is unchanged.
//
// The Worker bundle is NOT built here. kin/worker/index.js is authored as a
// self-contained ES module with zero imports (KIN-4 requires exactly that), so
// there is nothing to bundle and no bundler in the dependency tree.

import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIN = path.resolve(HERE, '..');
const DIST = path.join(KIN, 'dist');
const PUBLIC = path.join(KIN, 'public');

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });

if (existsSync(PUBLIC)) {
  await cp(PUBLIC, DIST, { recursive: true });
  console.log(`kin-build: staged kin/public -> kin/dist`);
} else {
  console.warn(`kin-build: kin/public is missing; dist will contain build output only`);
}

console.log('kin-build: done (run `node kin/scripts/kin-assets.mjs` next, or use `npm run kin:build`)');
