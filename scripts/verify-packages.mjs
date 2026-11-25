#!/usr/bin/env node
/**
 * Pre-publish npm package verification for all v2 packages:
 * 1. Validates package.json metadata (name, version parity, exports, bin, publishConfig, engines).
 * 2. Verifies built entry files, TypeScript declarations, and executable CLI bin shebang/mode.
 * 3. Runs `pnpm pack` into a temp directory and inspects every tarball:
 *    - Ensures zero unresolved `workspace:*` dependencies remain inside packed package.json.
 *    - Ensures zero `*.test.*` or `fixtures/` files leak into published tarballs.
 *    - Ensures every declared main / types / exports / bin target is physically present in the tarball.
 * 4. Runs live ESM import + CLI `--version` / `--help` smoke checks.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');
const V2_PACKAGES = [
  'packages/playable-sdk',
  'packages/playable-validator',
  'packages/playable-core',
  'packages/playable-cli'
];

function stripDotSlash(p) {
  return p.replace(/^\.\//, '');
}

async function verifyPackage(relDir, tmpPackDir) {
  const pkgDir = path.join(ROOT_DIR, relDir);
  const pkgJsonPath = path.join(pkgDir, 'package.json');
  const pkg = JSON.parse(await fs.readFile(pkgJsonPath, 'utf-8'));

  // 1. Metadata assertions
  assert.ok(pkg.name?.startsWith('@ppgee/'), `${relDir}: name must be scoped under @ppgee/`);
  assert.equal(pkg.type, 'module', `${pkg.name}: type must be "module"`);
  assert.equal(pkg.publishConfig?.access, 'public', `${pkg.name}: publishConfig.access must be "public"`);
  assert.ok(pkg.engines?.node, `${pkg.name}: engines.node must be declared`);
  assert.ok(pkg.license, `${pkg.name}: license must be declared`);
  assert.equal(pkg.repository?.directory, relDir, `${pkg.name}: repository.directory should match "${relDir}"`);
  assert.ok(pkg.main, `${pkg.name}: main must be declared`);
  assert.ok(pkg.types, `${pkg.name}: types must be declared`);
  assert.ok(pkg.exports?.['.']?.import, `${pkg.name}: exports["."].import must be declared`);
  assert.ok(pkg.exports?.['.']?.types, `${pkg.name}: exports["."].types must be declared`);
  assert.equal(pkg.exports?.['./package.json'], './package.json', `${pkg.name}: exports["./package.json"] must be exposed`);

  // Collect all declared file targets
  const requiredRelFiles = new Set([
    'package.json',
    stripDotSlash(pkg.main),
    stripDotSlash(pkg.types),
    stripDotSlash(pkg.exports['.'].import),
    stripDotSlash(pkg.exports['.'].types)
  ]);

  if (pkg.bin && typeof pkg.bin === 'object') {
    for (const [binName, binTarget] of Object.entries(pkg.bin)) {
      const relBin = stripDotSlash(String(binTarget));
      requiredRelFiles.add(relBin);
      const absBin = path.join(pkgDir, relBin);
      assert.ok(existsSync(absBin), `${pkg.name}: bin "${binName}" target missing: ${relBin}`);
      const head = (await fs.readFile(absBin, 'utf-8')).slice(0, 64);
      assert.ok(head.startsWith('#!/usr/bin/env node'), `${pkg.name}: bin "${binName}" must start with #!/usr/bin/env node`);
      if (process.platform !== 'win32') {
        const stat = await fs.stat(absBin);
        assert.ok((stat.mode & 0o111) !== 0, `${pkg.name}: bin "${binName}" (${relBin}) must be executable (chmod +x)`);
      }

      // Smoke-test CLI binary execution
      const verOut = execFileSync(process.execPath, [absBin, '--version'], { encoding: 'utf-8' }).trim();
      assert.equal(verOut, pkg.version, `${pkg.name}: "${binName} --version" (${verOut}) must match package.json version (${pkg.version})`);
      const helpOut = execFileSync(process.execPath, [absBin, '--help'], { encoding: 'utf-8' });
      assert.ok(helpOut.includes('playable build') && helpOut.includes('--report'), `${pkg.name}: "${binName} --help" output incomplete`);
    }
  }

  for (const rel of requiredRelFiles) {
    assert.ok(existsSync(path.join(pkgDir, rel)), `${pkg.name}: missing built file "${rel}"`);
  }

  // 2. Verify live ESM import works
  const imported = await import(pathToFileURL(path.join(pkgDir, stripDotSlash(pkg.exports['.'].import))).href);
  assert.ok(Object.keys(imported).length > 0, `${pkg.name}: ESM entry exported zero symbols`);

  // 3. Run real `pnpm pack` and inspect tarball contents
  const packOut = execFileSync('pnpm', ['pack', '--pack-destination', tmpPackDir], {
    cwd: pkgDir,
    encoding: 'utf-8'
  }).trim();
  const tgzLine = packOut
    .split(/\r?\n/)
    .map((l) => l.trim())
    .reverse()
    .find((l) => l.endsWith('.tgz'));
  assert.ok(tgzLine && existsSync(tgzLine), `${pkg.name}: pnpm pack did not produce a .tgz tarball (output: ${packOut})`);

  const tarEntries = execFileSync('tar', ['-tzf', tgzLine], { encoding: 'utf-8' })
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const tarSet = new Set(tarEntries);

  for (const rel of requiredRelFiles) {
    assert.ok(tarSet.has(`package/${rel}`), `${pkg.name}: tarball missing required file "package/${rel}"`);
  }

  const leakedTests = tarEntries.filter((e) => /\.test\.(js|d\.ts|js\.map|d\.ts\.map)$/.test(e) || e.includes('/fixtures/'));
  assert.equal(leakedTests.length, 0, `${pkg.name}: test/fixture files leaked into npm tarball: ${leakedTests.join(', ')}`);

  // Inspect packed package.json for unresolved workspace:* protocols
  const packedPkgRaw = execFileSync('tar', ['-xOzf', tgzLine, 'package/package.json'], { encoding: 'utf-8' });
  assert.equal(
    packedPkgRaw.includes('workspace:'),
    false,
    `${pkg.name}: packed package.json still contains unresolved "workspace:" protocol!`
  );

  const stat = await fs.stat(tgzLine);
  return {
    name: pkg.name,
    version: pkg.version,
    fileCount: tarEntries.length,
    tarBytes: stat.size,
    exportKeys: Object.keys(imported).length
  };
}

const tmpPackDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cocos-pnp-pack-check-'));
try {
  const results = [];
  for (const relDir of V2_PACKAGES) {
    results.push(await verifyPackage(relDir, tmpPackDir));
  }

  // Ensure version parity across all 4 v2 packages
  const versions = new Set(results.map((r) => r.version));
  assert.equal(versions.size, 1, `Version mismatch across v2 packages: ${JSON.stringify(results)}`);

  console.log('\nnpm Publish & Tarball Verification [PASS]\n');
  for (const r of results) {
    console.log(
      `  [OK] ${r.name.padEnd(30)} v${r.version}  files=${String(r.fileCount).padStart(3)}  tarball=${(r.tarBytes / 1024).toFixed(1).padStart(6)} KB  exports=${r.exportKeys}`
    );
  }
  console.log('');
} finally {
  await fs.rm(tmpPackDir, { recursive: true, force: true });
}
