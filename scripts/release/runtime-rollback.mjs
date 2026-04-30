#!/usr/bin/env node
import { nowIso, normalizeManifest, parseArgv, readJsonFile, resolvePrivateKey, signManifest, writeJsonFile } from './manifest-lib.mjs';

const flags = parseArgv();
const manifestPath = String(flags.manifest || '').trim();
const version = String(flags.version || '').trim();
const keyId = String(flags['key-id'] || flags.keyId || process.env.PRAE_MANIFEST_SIGNING_KEY_ID || '').trim();

if (!manifestPath) {
  console.error('Missing --manifest <path>.');
  process.exit(1);
}
if (!version) {
  console.error('Missing --version <x.y.z>.');
  process.exit(1);
}
if (!keyId) {
  console.error('Missing --key-id (or PRAE_MANIFEST_SIGNING_KEY_ID).');
  process.exit(1);
}

const privateKeyPem = resolvePrivateKey({
  inlinePem: process.env.PRAE_MANIFEST_SIGNING_PRIVATE_KEY_PEM || '',
  filePath: String(flags['private-key-file'] || flags.privateKeyFile || process.env.PRAE_MANIFEST_SIGNING_PRIVATE_KEY_FILE || '').trim()
});
if (!privateKeyPem) {
  console.error('Missing signing key. Use PRAE_MANIFEST_SIGNING_PRIVATE_KEY_PEM or --private-key-file.');
  process.exit(1);
}

const existing = readJsonFile(manifestPath, {});
const manifest = normalizeManifest(existing);
manifest.generatedAt = nowIso();
manifest.global = manifest.global || { killSwitch: false, forcePinVersion: null };
manifest.global.forcePinVersion = version;

const signed = signManifest(manifest, { keyId, privateKeyPem });
writeJsonFile(manifestPath, signed);

console.log(JSON.stringify({
  ok: true,
  manifestPath,
  forcePinVersion: version,
  keyId
}, null, 2));
