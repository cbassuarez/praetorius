import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const DEFAULT_MANIFEST_SCHEMA_VERSION = 1;

export function nowIso() {
  return new Date().toISOString();
}

export function readJsonFile(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

export function writeJsonFile(filePath, value) {
  const target = path.resolve(filePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function stableCanonicalize(value) {
  if (Array.isArray(value)) {
    return value.map((item) => stableCanonicalize(item));
  }
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const key of Object.keys(value).sort()) {
    out[key] = stableCanonicalize(value[key]);
  }
  return out;
}

export function stableStringify(value) {
  return JSON.stringify(stableCanonicalize(value));
}

export function stripSignature(manifest) {
  if (!manifest || typeof manifest !== 'object') return {};
  const clone = JSON.parse(JSON.stringify(manifest));
  delete clone.signature;
  return clone;
}

export function normalizeManifest(manifest) {
  const src = manifest && typeof manifest === 'object' ? manifest : {};
  const global = src.global && typeof src.global === 'object' ? src.global : {};
  const channels = src.channels && typeof src.channels === 'object' ? src.channels : {};
  return {
    schemaVersion: Number(src.schemaVersion || DEFAULT_MANIFEST_SCHEMA_VERSION),
    generatedAt: String(src.generatedAt || nowIso()),
    global: {
      killSwitch: global.killSwitch === true,
      forcePinVersion: global.forcePinVersion == null ? null : String(global.forcePinVersion).trim() || null
    },
    channels,
    ...(src.signature && typeof src.signature === 'object' ? { signature: src.signature } : {})
  };
}

export function parseSemver(value) {
  const match = String(value || '').trim().match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    raw: `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`
  };
}

export function compareSemver(aRaw, bRaw) {
  const a = parseSemver(aRaw);
  const b = parseSemver(bRaw);
  if (!a || !b) return 0;
  if (a.major !== b.major) return a.major > b.major ? 1 : -1;
  if (a.minor !== b.minor) return a.minor > b.minor ? 1 : -1;
  if (a.patch !== b.patch) return a.patch > b.patch ? 1 : -1;
  return 0;
}

export function normalizeAllowedOrigins(values) {
  const list = Array.isArray(values) ? values : [];
  const out = [];
  const seen = new Set();
  for (const entry of list) {
    const raw = String(entry || '').trim();
    if (!raw) continue;
    try {
      const u = new URL(raw);
      const protocol = String(u.protocol || '').toLowerCase();
      if (protocol !== 'https:' && protocol !== 'http:') continue;
      if (seen.has(u.origin)) continue;
      seen.add(u.origin);
      out.push(u.origin);
    } catch (_) {
      continue;
    }
  }
  return out;
}

export function safeUrl(input, { allowOrigins = null, allowHttp = false } = {}) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  let parsed;
  try {
    parsed = new URL(raw);
  } catch (_) {
    return '';
  }
  const protocol = String(parsed.protocol || '').toLowerCase();
  if (protocol !== 'https:' && !(allowHttp && protocol === 'http:')) return '';
  if (Array.isArray(allowOrigins) && allowOrigins.length) {
    const originSet = new Set(normalizeAllowedOrigins(allowOrigins));
    if (!originSet.has(parsed.origin)) return '';
  }
  return parsed.toString();
}

export function sha384Base64(content) {
  return crypto.createHash('sha384').update(content, 'utf8').digest('base64');
}

export function fileSha384(filePath) {
  const body = fs.readFileSync(path.resolve(filePath), 'utf8');
  return `sha384-${sha384Base64(body)}`;
}

export function normalizePublicKeys(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const out = {};
  for (const [key, value] of Object.entries(src)) {
    const keyId = String(key || '').trim();
    const raw = String(value || '').trim();
    if (!keyId || !raw) continue;
    out[keyId] = raw;
  }
  return out;
}

export function signManifest(manifest, { keyId, privateKeyPem }) {
  const normalized = normalizeManifest(manifest);
  const requiredKeyId = String(keyId || '').trim();
  const privateKey = String(privateKeyPem || '').trim();
  if (!requiredKeyId) throw new Error('missing keyId');
  if (!privateKey) throw new Error('missing private key');
  const payload = stableStringify(stripSignature(normalized));
  const sign = crypto.createSign('SHA256');
  sign.update(payload);
  sign.end();
  const sig = sign.sign(privateKey).toString('base64');
  return {
    ...stripSignature(normalized),
    signature: {
      alg: 'ecdsa-p256-sha256',
      keyId: requiredKeyId,
      sig
    }
  };
}

export function verifyManifestSignature(manifest, { publicKeys, requiredKeyId } = {}) {
  const normalized = normalizeManifest(manifest);
  const signature = normalized.signature && typeof normalized.signature === 'object' ? normalized.signature : null;
  if (!signature) return { ok: false, reason: 'manifest-signature-missing' };
  const keyId = String(signature.keyId || '').trim();
  const sig = String(signature.sig || '').trim();
  const alg = String(signature.alg || '').trim().toLowerCase();
  if (!keyId || !sig) return { ok: false, reason: 'manifest-signature-invalid' };
  if (alg && alg !== 'ecdsa-p256-sha256') return { ok: false, reason: 'manifest-signature-algorithm-unsupported' };
  const required = String(requiredKeyId || '').trim();
  if (required && keyId !== required) return { ok: false, reason: 'manifest-signature-keyid-mismatch' };
  const keys = normalizePublicKeys(publicKeys || {});
  const keyBase64 = String(keys[keyId] || '').trim();
  if (!keyBase64) return { ok: false, reason: 'manifest-signature-key-missing' };

  let publicKey;
  try {
    publicKey = crypto.createPublicKey({
      key: Buffer.from(keyBase64, 'base64'),
      type: 'spki',
      format: 'der'
    });
  } catch (_) {
    return { ok: false, reason: 'manifest-signature-key-invalid' };
  }

  const payload = stableStringify(stripSignature(normalized));
  const verify = crypto.createVerify('SHA256');
  verify.update(payload);
  verify.end();
  const ok = verify.verify(publicKey, Buffer.from(sig, 'base64'));
  if (!ok) return { ok: false, reason: 'manifest-signature-verify-failed' };
  return { ok: true, reason: 'ok', keyId };
}

export function resolvePrivateKey({ inlinePem = '', filePath = '' } = {}) {
  const inline = String(inlinePem || '').trim();
  if (inline) return inline;
  const rawPath = String(filePath || '').trim();
  if (!rawPath) return '';
  return fs.readFileSync(path.resolve(rawPath), 'utf8');
}

export function parseArgv(argv = process.argv.slice(2)) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      flags[key] = true;
      continue;
    }
    flags[key] = next;
    i += 1;
  }
  return flags;
}
