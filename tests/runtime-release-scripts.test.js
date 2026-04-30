import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const PROMOTE = path.join(ROOT, 'scripts', 'release', 'runtime-promote.mjs');
const ROLLBACK = path.join(ROOT, 'scripts', 'release', 'runtime-rollback.mjs');
const KILLSWITCH = path.join(ROOT, 'scripts', 'release', 'runtime-killswitch.mjs');
const VERIFY = path.join(ROOT, 'scripts', 'release', 'runtime-verify.mjs');

function envBase(extra = {}) {
  return {
    FORCE_COLOR: '0',
    ...extra
  };
}

describe('runtime release helper scripts', () => {
  it('promotes, verifies, rollbacks, and toggles kill-switch with signatures', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'prae-runtime-release-'));
    const manifestPath = path.join(cwd, 'stable.json');
    const runtimePath = path.join(cwd, 'runtime.js');
    await fs.writeFile(runtimePath, 'window.__RUNTIME_TEST__ = true;\n', 'utf8');

    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
    const keyId = 'release-test-key';
    const publicKeyBase64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');

    await execa('node', [
      PROMOTE,
      '--manifest', manifestPath,
      '--channel', 'stable',
      '--version', '1.2.3',
      '--runtime-url', 'https://cdn.praetorius.dev/runtime/1.2.3/script.js',
      '--runtime-file', runtimePath,
      '--key-id', keyId,
      '--allow-origins', 'https://cdn.praetorius.dev'
    ], {
      cwd,
      env: envBase({ PRAE_MANIFEST_SIGNING_PRIVATE_KEY_PEM: privateKeyPem })
    });

    const promoted = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    expect(promoted.channels?.stable?.latest).toBe('1.2.3');
    expect(promoted.channels?.stable?.versions?.['1.2.3']?.url).toBe('https://cdn.praetorius.dev/runtime/1.2.3/script.js');
    expect(String(promoted.channels?.stable?.versions?.['1.2.3']?.integrity || '')).toMatch(/^sha384-/);
    expect(promoted.signature?.keyId).toBe(keyId);

    const verifyOk = await execa('node', [
      VERIFY,
      '--manifest', manifestPath,
      '--required-key-id', keyId,
      '--public-keys-json', JSON.stringify({ [keyId]: publicKeyBase64 }),
      '--allow-origins', 'https://cdn.praetorius.dev'
    ], { cwd, env: envBase() });
    const verified = JSON.parse(verifyOk.stdout);
    expect(verified.ok).toBe(true);

    await execa('node', [
      ROLLBACK,
      '--manifest', manifestPath,
      '--version', '1.2.3',
      '--key-id', keyId
    ], {
      cwd,
      env: envBase({ PRAE_MANIFEST_SIGNING_PRIVATE_KEY_PEM: privateKeyPem })
    });

    const rolled = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    expect(rolled.global?.forcePinVersion).toBe('1.2.3');

    await execa('node', [
      KILLSWITCH,
      '--manifest', manifestPath,
      '--enable', 'true',
      '--key-id', keyId
    ], {
      cwd,
      env: envBase({ PRAE_MANIFEST_SIGNING_PRIVATE_KEY_PEM: privateKeyPem })
    });

    const killed = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    expect(killed.global?.killSwitch).toBe(true);
    expect(killed.signature?.keyId).toBe(keyId);
  });
});
