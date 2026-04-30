#!/usr/bin/env node
import { normalizeAllowedOrigins, normalizeManifest, normalizePublicKeys, parseArgv, readJsonFile, safeUrl, verifyManifestSignature } from './manifest-lib.mjs';

const flags = parseArgv();
const manifestPath = String(flags.manifest || '').trim();
const requiredKeyId = String(flags['required-key-id'] || flags.requiredKeyId || '').trim();
const allowOriginsRaw = String(flags['allow-origins'] || process.env.PRAE_RUNTIME_ALLOWED_ORIGINS || '').trim();
const allowOrigins = normalizeAllowedOrigins(allowOriginsRaw ? allowOriginsRaw.split(',') : []);
const publicKeysJson = String(flags['public-keys-json'] || process.env.PRAE_MANIFEST_PUBLIC_KEYS_JSON || '').trim();

if (!manifestPath) {
  console.error('Missing --manifest <path>.');
  process.exit(1);
}

const manifest = normalizeManifest(readJsonFile(manifestPath, null));
if (!manifest || !manifest.channels || typeof manifest.channels !== 'object') {
  console.error('Manifest is invalid or missing channels.');
  process.exit(1);
}

let publicKeys = {};
if (publicKeysJson) {
  try {
    publicKeys = normalizePublicKeys(JSON.parse(publicKeysJson));
  } catch (err) {
    console.error(`Invalid --public-keys-json payload: ${err?.message || String(err)}`);
    process.exit(1);
  }
}

const signature = verifyManifestSignature(manifest, { publicKeys, requiredKeyId });
if (!signature.ok) {
  console.error(`Signature verification failed: ${signature.reason}`);
  process.exit(1);
}

const urlIssues = [];
Object.entries(manifest.channels).forEach(([channel, node]) => {
  const versions = node && typeof node === 'object' && node.versions && typeof node.versions === 'object'
    ? node.versions
    : {};
  Object.entries(versions).forEach(([version, entry]) => {
    const url = entry && typeof entry === 'object' ? entry.url : '';
    const integrity = entry && typeof entry === 'object' ? String(entry.integrity || '') : '';
    const safe = safeUrl(url, { allowOrigins, allowHttp: false });
    if (!safe) {
      urlIssues.push(`${channel}@${version}: url is invalid or not allowed`);
    }
    if (!integrity.startsWith('sha384-')) {
      urlIssues.push(`${channel}@${version}: integrity must start with sha384-`);
    }
  });
});

if (urlIssues.length) {
  console.error('Manifest runtime validation failed:');
  urlIssues.forEach((issue) => console.error(`  - ${issue}`));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  signature,
  channels: Object.keys(manifest.channels),
  allowOrigins
}, null, 2));
