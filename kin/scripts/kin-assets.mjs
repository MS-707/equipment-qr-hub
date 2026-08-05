#!/usr/bin/env node
// Asset manifest generator for the Kin deploy (KIN-4).
//
// Walks kin/dist and emits kin/dist/asset-manifest.json mapping URL path ->
// sha256 of the bytes on disk. `kin_deploy` takes that map as `asset_manifest`;
// the Worker resolves it at request time via KIN_ASSET_MANIFEST_REF.
//
// Modes:
//   node kin/scripts/kin-assets.mjs            generate the manifest
//   node kin/scripts/kin-assets.mjs --check    recompute every hash and diff
//                                              against the committed manifest;
//                                              exit 1 on any drift
//   node kin/scripts/kin-assets.mjs --print    print "<path> <sha256>" lines
//
// The manifest file itself is never listed as an asset.

import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(HERE, '..', 'dist');
const MANIFEST = path.join(DIST, 'asset-manifest.json');
const MANIFEST_BASENAME = 'asset-manifest.json';

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(abs)));
    } else if (entry.isFile()) {
      out.push(abs);
    }
  }
  return out;
}

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

/** URL path for a file on disk: kin/dist/assets/app.js -> /assets/app.js */
function urlPath(abs) {
  return '/' + path.relative(DIST, abs).split(path.sep).join('/');
}

async function build() {
  if (!existsSync(DIST)) {
    throw new Error(`kin/dist does not exist — run \`npm run kin:build\` first.`);
  }
  const files = (await walk(DIST)).filter((f) => path.basename(f) !== MANIFEST_BASENAME);
  const manifest = {};
  for (const abs of files.sort()) {
    manifest[urlPath(abs)] = sha256(await readFile(abs));
  }
  return manifest;
}

const mode = process.argv.includes('--check')
  ? 'check'
  : process.argv.includes('--print')
    ? 'print'
    : 'generate';

const fresh = await build();

if (mode === 'generate') {
  await writeFile(MANIFEST, JSON.stringify(fresh, null, 2) + '\n');
  const count = Object.keys(fresh).length;
  console.log(`kin-assets: wrote ${path.relative(process.cwd(), MANIFEST)} (${count} asset${count === 1 ? '' : 's'})`);
  for (const [p, h] of Object.entries(fresh)) console.log(`  ${p}  ${h.slice(0, 12)}…`);
} else if (mode === 'print') {
  for (const [p, h] of Object.entries(fresh)) console.log(`${p} ${h}`);
} else {
  if (!existsSync(MANIFEST)) {
    console.error(`kin-assets --check: ${MANIFEST} is missing — run \`npm run kin:build\`.`);
    process.exit(1);
  }
  const stored = JSON.parse(await readFile(MANIFEST, 'utf8'));
  const problems = [];
  for (const [p, h] of Object.entries(fresh)) {
    if (!(p in stored)) problems.push(`on disk but not in manifest: ${p}`);
    else if (stored[p] !== h) problems.push(`hash drift: ${p} (manifest ${stored[p].slice(0, 12)}…, disk ${h.slice(0, 12)}…)`);
  }
  for (const p of Object.keys(stored)) {
    if (!(p in fresh)) problems.push(`in manifest but not on disk: ${p}`);
  }
  if (problems.length) {
    console.error('kin-assets --check FAILED:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`kin-assets --check: OK (${Object.keys(stored).length} assets match)`);
}
