#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * sync-version.mjs
 * Runs automatically via npm "version" lifecycle hook (npm run ver:patch/minor/major/rc).
 * Reads the new version from package.json and updates downstream files:
 *   - docs/DEPLOYMENT.md, docs/MONITORING.md, docs/BACKUP.md
 *   - CHANGELOG.md ([Unreleased] → [x.y.z], new [Unreleased] inserted, diff links updated)
 *
 * Manual usage: node scripts/db/sync-version.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const version = pkg.version;
const today = new Date().toISOString().slice(0, 10);

console.log(`sync-version: syncing docs to v${version} (${today})`);

// ── Helper ──────────────────────────────────────────────────────────────────
function update(relPath, fn) {
  const abs = resolve(root, relPath);
  const before = readFileSync(abs, 'utf8');
  const after = fn(before);
  if (after !== before) {
    writeFileSync(abs, after, 'utf8');
    console.log(`  updated: ${relPath}`);
  } else {
    console.log(`  no change: ${relPath}`);
  }
}

// ── docs/ version headers ────────────────────────────────────────────────────
const docFiles = ['docs/DEPLOYMENT.md', 'docs/MONITORING.md', 'docs/BACKUP.md'];
for (const f of docFiles) {
  update(f, (src) =>
    src.replace(
      /CVG Line Maintenance Dashboard v\d+\.\d+\.\d+(-[\w.]+)?/g,
      `CVG Line Maintenance Dashboard v${version}`
    )
  );
}

// ── docs/DEPLOYMENT.md — health check example ────────────────────────────────
update('docs/DEPLOYMENT.md', (src) =>
  src.replace(/"version":"[\d.]+(-[\w.]+)?"/, `"version":"${version}"`)
);

// ── docs/MONITORING.md — JSON snippet ───────────────────────────────────────
update('docs/MONITORING.md', (src) =>
  src.replace(/"version": "[\d.]+(-[\w.]+)?"/, `"version": "${version}"`)
);

// ── CHANGELOG.md ─────────────────────────────────────────────────────────────
// Renames [Unreleased] → [version] - date, inserts new empty [Unreleased],
// and updates diff links at the bottom.
update('CHANGELOG.md', (src) => {
  // Find the previous latest released version from the diff link block
  const prevVersionMatch = src.match(/^\[(\d+\.\d+\.\d+(?:-[\w.]+)?)\]: https/m);
  const prevVersion = prevVersionMatch?.[1] ?? '0.1.0';

  // Skip if this version is already released
  if (src.includes(`## [${version}]`)) {
    console.log(`  CHANGELOG already has [${version}] — skipping`);
    return src;
  }

  // 1. Rename [Unreleased] header
  let out = src.replace(/^## \[Unreleased\]/m, `## [${version}] - ${today}`);

  // 2. Insert new [Unreleased] section immediately after the intro block
  //    (before the first ## [...] release header)
  out = out.replace(
    /^(## \[)/m,
    `## [Unreleased]\n\n---\n\n$1`
  );

  // 3. Update diff links at the bottom
  const unreleasedLink = `[Unreleased]: https://github.com/gh4-io/dts-dash/compare/v${version}...HEAD`;
  const newVersionLink = `[${version}]: https://github.com/gh4-io/dts-dash/compare/v${prevVersion}...v${version}`;

  // Replace existing [Unreleased] link
  out = out.replace(
    /^\[Unreleased\]: .+$/m,
    `${unreleasedLink}\n${newVersionLink}`
  );

  return out;
});

console.log(`sync-version: done — v${version}`);
