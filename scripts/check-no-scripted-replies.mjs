#!/usr/bin/env node
/**
 * Build guard: a production bundle must contain no pre-written Noor replies.
 *
 * Soul Ease once answered a member from a pool of scripted lines whenever the
 * realtime connection could not be made — the same handful of sentences
 * whatever they said, in a browser voice, with nothing on screen to say so.
 * The code path is gone, and the scripted engine now loads through a dynamic
 * import that a default build proves dead and drops entirely.
 *
 * This checks the artefact rather than the source, because the property that
 * matters is what ships. Fingerprints are exact substrings of lines from
 * src/realtime/demo/noorDemoScript.ts — if that file is edited, update these.
 *
 * Usage: node scripts/check-no-scripted-replies.mjs [distDir]
 *   Exit 0 — clean. Exit 1 — a scripted reply is in the bundle.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = process.argv[2] ?? 'dist';

const FINGERPRINTS = [
  "keeps coming back most often",
  'where do you notice it first',
  'Take your time with that',
  "What's been on your mind",
  'What happened most recently that',
];

function jsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...jsFiles(path));
    else if (entry.endsWith('.js') || entry.endsWith('.html')) out.push(path);
  }
  return out;
}

let files;
try {
  files = jsFiles(DIST);
} catch {
  console.error(`check-no-scripted-replies: no build found at ${DIST}/ — run the build first.`);
  process.exit(1);
}

const hits = [];
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  for (const fingerprint of FINGERPRINTS) {
    if (source.includes(fingerprint)) hits.push({ file, fingerprint });
  }
}

if (hits.length > 0) {
  console.error('check-no-scripted-replies: FAILED — pre-written Noor replies are in the bundle.\n');
  for (const hit of hits) console.error(`  ${hit.file}\n    contains: ${JSON.stringify(hit.fingerprint)}`);
  console.error(
    '\nA build that ships these can answer a member with a scripted line. Noor’s replies must come\n' +
      'from the realtime model reading what the member actually said. If this build is deliberately\n' +
      'VITE_REALTIME_PROVIDER=demo, that is expected — do not run this check against it.',
  );
  process.exit(1);
}

console.log(`check-no-scripted-replies: OK — ${files.length} built files, no pre-written replies.`);
