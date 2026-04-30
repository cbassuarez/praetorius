#!/usr/bin/env node
import { fileSha384, normalizeManifest, parseArgv, readJsonFile, resolvePrivateKey, safeUrl, signManifest, writeJsonFile, nowIso } from './manifest-lib.mjs';

const flags = parseArgv();
const manifestPath = String(flags.manifest || '').trim();
const channel = String(flags.channel || 'stable').trim().toLowerCase();
const version = String(flags.version || '').trim();
const runtimeUrl = String(flags['runtime-url'] || flags.runtimeUrl || '').trim();
const runtimeFile = String(flags['runtime-file'] || flags.runtimeFile || '').trim();
const providedIntegrity = String(flags.integrity || '').trim();
const keyId = String(flags['key-id'] || flags.keyId || process.env.PRAE_MANIFEST_SIGNING_KEY_ID || '').trim();
const allowOriginsRaw = String(flags['allow-origins'] || process.env.PRAE_RUNTIME_ALLOWED_ORIGINS || '').trim();
const allowOrigins = allowOriginsRaw ? allowOriginsRaw.split(',').map((entry) => entry.trim()).filter(Boolean) : [];
const setLatest = flags['no-set-latest'] ? false : true;

if (!manifestPath) {
  console.error('Missing --manifest <path>.');
  process.exit(1);
}
if (!channel) {
  console.error('Missing --channel <name>.');
  process.exit(1);
}
if (!version) {
  console.error('Missing --version <x.y.z>.');
  process.exit(1);
}
if (!runtimeUrl) {
  console.error('Missing --runtime-url <https://...>.');
  process.exit(1);
}
if (!keyId) {
  console.error('Missing --key-id (or PRAE_MANIFEST_SIGNING_KEY_ID).');
  process.exit(1);
}

const safeRuntimeUrl = safeUrl(runtimeUrl, { allowOrigins, allowHttp: false });
if (!safeRuntimeUrl) {
  console.error('Runtime URL is invalid or not allowed by --allow-origins.');
  process.exit(1);
}

const integrity = providedIntegrity || (runtimeFile ? fileSha384(runtimeFile) : '');
if (!integrity || !integrity.startsWith('sha384-')) {
  console.error('Missing runtime integrity. Provide --integrity or --runtime-file.');
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
manifest.channels = manifest.channels && typeof manifest.channels === 'object' ? manifest.channels : {};

const channelNode = manifest.channels[channel] && typeof manifest.channels[channel] === 'object'
  ? manifest.channels[channel]
  : { latest: version, versions: {} };
channelNode.versions = channelNode.versions && typeof channelNode.versions === 'object' ? channelNode.versions : {};
channelNode.versions[version] = {
  version,
  url: safeRuntimeUrl,
  integrity,
  releasedAt: nowIso()
};
if (setLatest) channelNode.latest = version;
manifest.channels[channel] = channelNode;

const signed = signManifest(manifest, { keyId, privateKeyPem });
writeJsonFile(manifestPath, signed);

console.log(JSON.stringify({
  ok: true,
  manifestPath,
  channel,
  version,
  latest: signed.channels[channel].latest,
  integrity,
  url: safeRuntimeUrl,
  keyId
}, null, 2));
